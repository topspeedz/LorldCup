import { test, expect } from '@playwright/test';

// T27/T15/FIX1c: rooms (per-broadcast sequential room keys, auto placement after #enter, invite, capacity) and peer state / nicknames.
// Connections go through PeerJS Cloud, as the app does.
test.setTimeout(240_000);

// Records every room:* and peer:* event the app dispatches, from page start, so late listeners miss nothing.
const recordEvents = () => {
  window.__ev = [];
  const dispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (e) {
    if (e instanceof CustomEvent && /^(room|peer):/.test(e.type)) window.__ev.push({ type: e.type, detail: e.detail });
    return dispatch.call(this, e);
  };
};
// LG-M-12: counts ICE starts (setLocalDescription starts gathering = STUN traffic) in the page itself.
// Constructing an RTCPeerConnection alone sends nothing (PeerJS builds one at load to test support).
const countRtc = () => {
  window.__rtc = 0;
  const proto = window.RTCPeerConnection?.prototype;
  if (!proto) return;
  const set = proto.setLocalDescription;
  proto.setLocalDescription = function (...args) { window.__rtc++; return set.apply(this, args); };
};
// T15b: the page clock can be moved forward (window.__shift ms) to reach a round boundary without waiting 10 minutes.
const shiftClock = () => { window.__shift = 0; const now = Date.now; Date.now = () => now() + window.__shift; };
const clockTo = (page, at) => page.evaluate(at => { window.__shift += at - Date.now(); }, at);
const events = (page, type) => page.evaluate(type => window.__ev.filter(e => e.type === type).map(e => e.detail), type);
const ready = page => page.waitForFunction(() => window.arena?.ready, null, { timeout: 120_000 });
async function openArena(context, url = '/') {
  const page = await context.newPage();
  const errors = [], cloud = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (/peerjs\.com/.test(r.url())) cloud.push(r.url()); });
  page.on('websocket', ws => { if (/peerjs\.com/.test(ws.url())) cloud.push(ws.url()); });
  await page.addInitScript(recordEvents);
  await page.addInitScript(countRtc);
  await page.addInitScript(shiftClock);
  await page.goto(url);
  await ready(page);
  return { page, errors, cloud };
}
const emit = (page, type, detail) => page.evaluate(async ([type, detail]) => {
  const { events } = await import('/events.js');
  events.dispatchEvent(new CustomEvent(type, { detail }));
}, [type, detail]);
const intervalMs = async page => (await page.evaluate(() => fetch('/config/screen.json').then(r => r.json()))).roundIntervalMinutes * 60_000;
const joinedRoom = async page => {
  await page.waitForFunction(() => window.__ev.some(e => e.type === 'room:joined'), null, { timeout: 60_000 });
  return (await events(page, 'room:joined'))[0];
};

test('no round picker; LG-M-12: no PeerJS Cloud or STUN before #enter, also with ?room=; pose rules unchanged', async ({ browser }) => {
  const context = await browser.newContext();
  for (const url of ['/', '/?room=01']) {
    const { page, errors, cloud } = await openArena(context, url);
    await expect(page.getByLabel('회차')).toHaveCount(0);
    expect(await page.evaluate(() => 'rounds' in arena.multiplayer || 'roundOffset' in arena.multiplayer)).toBe(false);
    // FIX1c: no room buttons or key input any more; join(key), join() and leave() before #enter must not connect either.
    await page.evaluate(() => { arena.multiplayer.join('01'); arena.multiplayer.join(); arena.multiplayer.leave(); });
    // The old invite path connected as soon as the arena was ready; give it time to show up.
    await page.waitForTimeout(3000);
    expect({ url, cloud, rtc: await page.evaluate(() => window.__rtc), peerId: await page.evaluate(() => arena.multiplayer.peerId), room: await page.evaluate(() => arena.multiplayer.room) },
      'LG-M-12: no connection before #enter').toEqual({ url, cloud: [], rtc: 0, peerId: null, room: null });
    expect(await events(page, 'room:joined')).toEqual([]);
    expect(errors).toEqual([]);
    if (url === '/') {
      // The gate is #enter: pressing it starts auto placement (reaches the PeerJS Cloud).
      await page.locator('#enter').click();
      await expect.poll(() => cloud.length, { timeout: 30_000 }).toBeGreaterThan(0);
    }
    await page.close();
  }
  const page = await context.newPage();
  await page.goto('/');
  const rules = await page.evaluate(async () => {
    const m = await import('/multiplayer.js');
    return {
      valid: m.validPose([0, 0, 0, 0]), invalid: m.validPose([0, 0, 0, 4]),
      unique: m.uniqueNickname('팬1234', new Set(['팬1234']), () => 0.7),
      untouched: m.uniqueNickname('팬1234', new Set(['팬9999']), () => 0.7),
    };
  });
  expect(rules).toEqual({ valid: true, invalid: false, unique: '팬12347', untouched: '팬1234' });
  await context.close();
});

test('#enter auto-places into a sequential room key; invite URL joins the same room and round; state flows; host leaving keeps the room', async ({ browser, baseURL }) => {
  const hostContext = await browser.newContext();
  await hostContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  const guestContext = await browser.newContext();
  const host = await openArena(hostContext);
  const interval = await intervalMs(host.page);

  await host.page.locator('#enter').click();
  const hostRoom = await joinedRoom(host.page);
  // FIX1c: a new room's roundStart is the chosen showtime (the first page's next showtime), else the round just started.
  expect(hostRoom).toEqual({ code: expect.stringMatching(/^\d{2}$/), host: true, roundStart: expect.any(Number) });
  expect(hostRoom.roundStart % interval).toBe(0);

  // FIX1c: '같이 보기' copies ?b=&t=&room= (no key input, no Escape: the button is always on screen).
  await host.page.getByRole('button', { name: '같이 보기 — 초대 링크 복사' }).click();
  const url = await host.page.evaluate(() => navigator.clipboard.readText());
  expect(new URL(url).searchParams.get('room')).toBe(hostRoom.code);
  expect(new URL(url).searchParams.get('b')).toBe('final');

  const guest = await openArena(guestContext, url);
  expect(await guest.page.evaluate(() => arena.multiplayer.room)).toBeNull();
  await guest.page.locator('#enter').click();
  const guestRoom = await joinedRoom(guest.page);
  expect(guestRoom).toEqual({ code: hostRoom.code, host: false, roundStart: hostRoom.roundStart });
  for (const p of [host.page, guest.page]) await p.waitForFunction(() => arena.multiplayer.count === 2, null, { timeout: 30_000 });

  const teams = await guest.page.evaluate(() => fetch('/config/teams.json').then(r => r.json()));
  const teamId = teams.teams.at(-1).id;
  await emit(guest.page, 'team:changed', { teamId });
  await emit(guest.page, 'character:changed', { characterId: 'fan_m2' });
  await emit(guest.page, 'emote:played', { id: 'heart' });
  await emit(guest.page, 'seat:enter', { seatId: 'test-seat' });
  const guestId = await guest.page.evaluate(() => arena.multiplayer.peerId);
  await host.page.waitForFunction(([id, teamId]) => window.__ev.some(e => e.type === 'peer:state' && e.detail.peerId === id &&
    e.detail.team === teamId && e.detail.character === 'fan_m2' && e.detail.emote === 'heart' && e.detail.emoteSeq === 1 && e.detail.seated === true),
    [guestId, teamId], { timeout: 15_000 });

  const nickname = /^팬\d{4,5}$/;
  const hostSees = (await events(host.page, 'peer:state')).at(-1);
  const guestSees = (await events(guest.page, 'peer:state')).at(-1);
  expect(hostSees.nickname).toMatch(nickname);
  expect(guestSees.nickname).toMatch(nickname);
  expect(hostSees.nickname).not.toBe(guestSees.nickname);
  expect(await guest.page.evaluate(() => arena.multiplayer.nickname)).toBe(hostSees.nickname);
  await expect(host.page.getByText(hostSees.nickname, { exact: true })).toBeVisible();
  await expect(guest.page.getByText(guestSees.nickname, { exact: true })).toBeVisible();

  // BL-0032: the host leaving does not end the room; the guest stays in it alone, as its host, same key.
  await host.page.evaluate(() => arena.multiplayer.leave());
  await guest.page.waitForFunction(code => {
    const s = window.__ev.filter(e => e.type === 'room:state').at(-1)?.detail;
    return s && s.key === code && s.count === 1 && s.host && s.phase === 'solo';
  }, hostRoom.code, { timeout: 30_000 });
  expect(await events(guest.page, 'room:left')).toEqual([]);
  await expect(guest.page.getByText(hostSees.nickname, { exact: true })).toHaveCount(0);
  expect([...host.errors, ...guest.errors]).toEqual([]);
  await hostContext.close(); await guestContext.close();
});

test('T32f M14 (FIX1c UX-M10): the 17th person with the invite key gets the "친구 방이 가득 차서 다른 방으로 들어왔어요" toast, not a timeout, and auto placement puts them in another room', async ({ browser, baseURL }) => {
  const hostContext = await browser.newContext();
  const host = await openArena(hostContext);
  await host.page.locator('#enter').click();
  const { code } = await joinedRoom(host.page);

  // 15 light guests (PeerJS only, no arena) fill the room to 16 with the host.
  const fillers = await browser.newContext();
  const filler = await fillers.newPage();
  await filler.goto(new URL('config/network.json', baseURL).href);
  await filler.addScriptTag({ url: new URL('vendor/peerjs.min.js', baseURL).href });
  await filler.evaluate(async hostId => {
    // Each sends pose and state like the app (the host counts a guest once it says who it is).
    const join = i => new Promise((resolve, reject) => {
      const peer = new Peer();
      peer.on('error', reject);
      peer.on('open', () => {
        const conn = peer.connect(hostId, { reliable: false, serialization: 'json' });
        const state = { team: null, character: null, nickname: '팬' + (3000 + i), emote: null, emoteSeq: 0, seated: false };
        conn.on('open', () => { setInterval(() => { if (conn.open) { conn.send({ type: 'pose', pose: [-139 + i, -.02, 3, 0] }); conn.send({ type: 'state', state }); } }, 100); resolve(); });
        conn.on('error', reject);
      });
    });
    await Promise.all(Array.from({ length: 15 }, (_, i) => join(i)));
  }, 'barclays-tps-room-final-' + code);
  await host.page.waitForFunction(() => arena.multiplayer.count === 16, null, { timeout: 30_000 });

  const lateContext = await browser.newContext();
  const late = await openArena(lateContext, '/?room=' + code);
  await late.page.locator('#enter').click();
  const started = Date.now();
  // Decision 10: auto placement skips the full room and makes the late person host of the next free number.
  await late.page.waitForFunction(() => window.__ev.some(e => e.type === 'room:joined'), null, { timeout: 30_000 });
  expect(Date.now() - started).toBeLessThan(30_000);
  expect(await late.page.evaluate(() => arena.multiplayer.room)).toEqual({ code: String(+code + 1).padStart(2, '0'), host: true, roundStart: expect.any(Number) });
  await expect(late.page.locator('#hud-toast')).toContainText('친구 방이 가득 차서 다른 방으로 들어왔어요');
  await expect(late.page.locator('#network-status')).toBeHidden(); // alone: no people line, no failure text
  expect(await host.page.evaluate(() => arena.multiplayer.count)).toBe(16);
  expect([...host.errors, ...late.errors]).toEqual([]);
  await hostContext.close(); await fillers.close(); await lateContext.close();
});

// T15b BL-0032 회차 넘김: screen:state {status:'ended'} on the host moves the room to the round just started.
// The whole state the real producer sends (web/screen-video.js state(): volume and userVolume included), with status
// 'ended'. A partial object left userVolume out and made web/stage-players.js gain NaN (T47 원인 2).
const ended = page => page.evaluate(() => ({ ...arena.screen.state, source: 'vod', playing: false, status: 'ended', error: null }));
const count = (page, type) => page.evaluate(type => window.__ev.filter(e => e.type === type).length, type);

test('T15b (가)(라): host on screen ended moves roundStart to the round just started, room:round once on host and guest, no room:left/joined again', async ({ browser }) => {
  const hostContext = await browser.newContext(), guestContext = await browser.newContext();
  const host = await openArena(hostContext);
  const interval = await intervalMs(host.page);
  await host.page.locator('#enter').click();
  const hostRoom = await joinedRoom(host.page);
  const guest = await openArena(guestContext, '/?room=' + hostRoom.code);
  await guest.page.locator('#enter').click();
  expect((await joinedRoom(guest.page)).roundStart).toBe(hostRoom.roundStart);
  for (const p of [host.page, guest.page]) await p.waitForFunction(() => arena.multiplayer.count === 2, null, { timeout: 30_000 });

  // Both clocks 5 s into the next round; the host's screen reports the end of the round.
  const next = hostRoom.roundStart + interval;
  for (const p of [host.page, guest.page]) await clockTo(p, next + 5000);
  await emit(host.page, 'screen:state', await ended(host.page));
  await expect.poll(() => events(host.page, 'room:round'), { timeout: 5000 }).toEqual([{ roundStart: next }]);
  await expect.poll(() => events(guest.page, 'room:round'), { timeout: 15_000 }).toEqual([{ roundStart: next }]);
  // Another `ended` in the same round and the 1 s resends do not move it again.
  await emit(host.page, 'screen:state', await ended(host.page));
  await host.page.waitForTimeout(2500);
  for (const p of [host.page, guest.page]) {
    expect(await events(p, 'room:round')).toEqual([{ roundStart: next }]);
    expect((await p.evaluate(() => arena.multiplayer.room)).roundStart).toBe(next);
    expect(await count(p, 'room:joined')).toBe(1);
    expect(await count(p, 'room:left')).toBe(0);
  }
  expect([...host.errors, ...guest.errors]).toEqual([]);
  await hostContext.close(); await guestContext.close();
});

test('T15b (다): ended before the next boundary (video shorter than the round) waits for the boundary, then moves once', async ({ browser }) => {
  const context = await browser.newContext();
  const host = await openArena(context);
  const interval = await intervalMs(host.page);
  await host.page.locator('#enter').click();
  const { roundStart } = await joinedRoom(host.page);
  const next = roundStart + interval;
  await clockTo(host.page, next - 2000);
  await emit(host.page, 'screen:state', await ended(host.page));
  expect(await events(host.page, 'room:round')).toEqual([]);
  expect((await host.page.evaluate(() => arena.multiplayer.room)).roundStart).toBe(roundStart);
  await expect.poll(() => events(host.page, 'room:round'), { timeout: 15_000 }).toEqual([{ roundStart: next }]);
  expect((await host.page.evaluate(() => arena.multiplayer.room)).roundStart).toBe(next);
  expect(await count(host.page, 'room:joined')).toBe(1);
  expect(await count(host.page, 'room:left')).toBe(0);
  expect(host.errors).toEqual([]);
  await context.close();
});

test('T15b (나): a guest raises room:round once for a larger roundStart; equal, smaller and malformed values are dropped', async ({ browser, baseURL }) => {
  // A fake host (PeerJS only) holds a high room key and sends whatever `room` the test sets, every second, like the app.
  const fakeContext = await browser.newContext();
  const fake = await fakeContext.newPage();
  await fake.goto(new URL('config/network.json', baseURL).href);
  await fake.addScriptTag({ url: new URL('vendor/peerjs.min.js', baseURL).href });
  const interval = await intervalMs(fake);
  const base = Math.floor(Date.now() / interval) * interval;
  const key = String(41 + Math.floor(Math.random() * 10));
  await fake.evaluate(([id, base]) => new Promise((resolve, reject) => {
    window.current = base;
    const peer = new Peer(id);
    peer.on('error', reject);
    peer.on('open', resolve);
    peer.on('connection', c => c.on('open', () => {
      const send = () => c.open && c.send({ type: 'room', roundStart: window.current });
      send(); setInterval(send, 1000);
    }));
  }), ['barclays-tps-room-final-' + key, base]);

  const guestContext = await browser.newContext();
  const guest = await openArena(guestContext, '/?room=' + key);
  await guest.page.locator('#enter').click();
  expect(await joinedRoom(guest.page)).toEqual({ code: key, host: false, roundStart: base });

  for (const bad of [base, base - interval, base + interval + 1, String(base + interval), base + 200 * interval, null, (base + interval) / 1e3 + 0.5]) {
    await fake.evaluate(v => { window.current = v; }, bad);
    await guest.page.waitForTimeout(1500);
  }
  expect(await events(guest.page, 'room:round')).toEqual([]);
  expect((await guest.page.evaluate(() => arena.multiplayer.room)).roundStart).toBe(base);

  await fake.evaluate(v => { window.current = v; }, base + interval);
  await expect.poll(() => events(guest.page, 'room:round'), { timeout: 10_000 }).toEqual([{ roundStart: base + interval }]);
  await guest.page.waitForTimeout(2500);
  expect(await events(guest.page, 'room:round')).toEqual([{ roundStart: base + interval }]);
  expect((await guest.page.evaluate(() => arena.multiplayer.room)).roundStart).toBe(base + interval);
  expect(await count(guest.page, 'room:joined')).toBe(1);
  expect(await count(guest.page, 'room:left')).toBe(0);
  expect(guest.errors).toEqual([]);
  await guestContext.close(); await fakeContext.close();
});
