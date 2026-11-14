import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

// T45 QA X: controls (BL-0023, BL-0024), keyboard, console errors, security, and a 16-person room (BL-0010, BL-0021).
// The 16-person room reuses the V01 method: a local PeerServer (test only; the app's PeerJS Cloud setting is untouched).
const require = createRequire(new URL('../_workspace/qa/2026-11-12-webrtc-20-validation/V01/package.json', import.meta.url));
const express = require('express');
const { ExpressPeerServer } = require('peer');

const ready = page => page.waitForFunction(() => window.arena?.ready, null, { timeout: 150_000 });
const recordEvents = () => {
  window.__ev = [];
  const dispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (e) {
    if (e instanceof CustomEvent && /^(room|peer|ticket):/.test(e.type)) window.__ev.push({ type: e.type, detail: e.detail });
    return dispatch.call(this, e);
  };
};
async function openArena(context, url = '/') {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && m.text() !== 'Permissions policy violation: compute-pressure is not allowed in this document.') errors.push('console: ' + m.text()); });
  await page.addInitScript(recordEvents);
  await page.goto(url);
  await ready(page);
  return { page, errors };
}
// A point where the arena canvas itself receives the mouse (not a UI panel).
const canvasPoint = page => page.evaluate(() => {
  const canvas = document.querySelector('canvas');
  for (let y = innerHeight * .3; y < innerHeight * .9; y += 20)
    for (let x = innerWidth * .1; x < innerWidth * .9; x += 20)
      if (document.elementFromPoint(x, y) === canvas) return { x, y };
  return null;
});
const cameraDistance = page => page.evaluate(() => {
  const c = arena.camera.position, p = arena.player;
  return Math.hypot(c.x - p.x, c.y - (p.y + 1.45), c.z - p.z);
});

test('X controls: drag cursor, context menu, wheel zoom, keyboard, typing guard, ticket gate, invite-code injection, console errors', async ({ browser }) => {
  test.setTimeout(420_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const { page, errors } = await openArena(context, '/?room=%3Cimg%20src%3Dx%20onerror%3Dwindow.__xss%3D1%3E');

  // Invite-code injection: the malformed ?room= is not an invite (parseInvite → null): nothing runs, no text, no peer.
  // FIX1c: no failure line any more (the first page shows instead); the people line stays empty.
  await expect(page.locator('#network-status')).toBeHidden();
  expect(await page.evaluate(() => ({ xss: window.__xss ?? null, connected: arena.multiplayer.connected, imgs: document.querySelectorAll('#network img').length })))
    .toEqual({ xss: null, connected: false, imgs: 0 });
  await page.locator('#enter').click(); // mouse-first: entering turns walking on (no pointer lock)

  // BL-0023 (3): right-click on the 3D view does not open the browser menu.
  let point = await canvasPoint(page);
  expect(point, 'a visible canvas point').not.toBeNull();
  await page.evaluate(() => { window.__menu = []; addEventListener('contextmenu', e => window.__menu.push(e.defaultPrevented)); });
  await page.mouse.click(point.x, point.y, { button: 'right' });
  expect(await page.evaluate(() => window.__menu)).toEqual([true]);

  // H-D1: the cursor stays visible; only a left drag turns the view.
  point = await canvasPoint(page);
  const canvas = page.locator('canvas');
  const before = await canvas.evaluate(c => getComputedStyle(c).cursor);
  for (const button of ['left', 'right']) {
    const yaw = await page.evaluate(() => arena.camera.rotation.y);
    await page.mouse.move(point.x, point.y);
    await page.mouse.down({ button });
    await page.mouse.move(point.x + 60, point.y + 10, { steps: 4 });
    expect(await canvas.evaluate(c => getComputedStyle(c).cursor), `${button} drag cursor`).not.toBe('none');
    await page.waitForTimeout(100);
    expect(await page.evaluate(yaw => arena.camera.rotation.y !== yaw, yaw), `${button} drag turns view`).toBe(button === 'left');
    await page.mouse.up({ button });
    expect(await canvas.evaluate(c => getComputedStyle(c).cursor), `${button} release cursor`).toBe(before);
  }

  // BL-0024: wheel zoom from first person (min 0) to 7.5 m (1.5 x 5 m), 0.5 m a notch. Plaza is open sky.
  await page.evaluate(() => arena.go('plaza'));
  point = await canvasPoint(page) ?? point;
  await page.mouse.move(point.x, point.y);
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, -100);
  await page.waitForTimeout(200);
  expect(await cameraDistance(page), 'zoom-in end is first person').toBeLessThan(.15);
  expect(await page.evaluate(() => arena.avatar.visible), 'own body hidden in first person').toBe(false);
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(150);
  expect(await cameraDistance(page)).toBeCloseTo(.5, 1);
  for (let i = 0; i < 25; i++) await page.mouse.wheel(0, 100);
  await page.waitForTimeout(200);
  expect(await cameraDistance(page), 'zoom-out end').toBeCloseTo(7.5, 1);
  expect(await page.evaluate(() => arena.avatar.visible)).toBe(true);

  // Keyboard: walking after #enter, W moves, Shift runs faster, Space jumps. R and the Esc walk toggle are gone (mouse-first).
  const pos = () => page.evaluate(() => arena.state);
  expect((await pos()).walking).toBe(true);
  let a = await pos();
  await page.keyboard.down('KeyW'); await page.waitForTimeout(800); await page.keyboard.up('KeyW');
  let b = await pos();
  const walk = Math.hypot(b.x - a.x, b.z - a.z);
  expect(walk, 'W moves').toBeGreaterThan(1.5);
  await page.evaluate(() => arena.go('plaza'));
  a = await pos();
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW'); await page.waitForTimeout(800);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  b = await pos();
  expect(Math.hypot(b.x - a.x, b.z - a.z), 'Shift runs faster').toBeGreaterThan(walk * 1.5);
  await page.keyboard.press('Space');
  await expect.poll(() => pos().then(s => s.airborne)).toBe(true);
  await expect.poll(() => pos().then(s => s.airborne), { timeout: 3000 }).toBe(false);
  await page.keyboard.press('Escape');
  expect((await pos()).walking, 'Esc does not leave walking').toBe(true);

  // Ticket gate (T40 UI-4 follow-up): there are no quick-move buttons any more (FIX1c: #quick gone);
  // a breadth-first walk from the plaza with the real movement code never reaches the building.
  await page.evaluate(() => arena.go('plaza'));
  const walkResult = await page.evaluate(async () => {
    const step = .8, seen = new Set(), queue = [[-139, -.02, 0]], out = { visited: 0, breach: null, pastGlass: null, minX: 0, maxX: -999, minZ: 0, maxZ: 0 };
    const dirs = [[step, 0], [-step, 0], [0, step], [0, -step], [step * .7, step * .7], [step * .7, -step * .7], [-step * .7, step * .7], [-step * .7, -step * .7]];
    const key = (x, y, z) => `${Math.round(x / step)},${Math.round(z / step)},${Math.round(y * 2)}`;
    seen.add(key(...queue[0]));
    const parent = new Map();
    const deadline = performance.now() + 240_000;
    let chunk = performance.now();
    while (queue.length && performance.now() < deadline) {
      const p = queue.shift();
      for (const [dx, dz] of dirs) {
        arena.go([...p, -Math.PI / 2]);
        if (!arena.attempt(dx, dz)) continue;
        const s = arena.state, k = key(s.x, s.y, s.z);
        if (seen.has(k) || s.x < -230 || s.x > -60 || Math.abs(s.z) > 140) continue;
        seen.add(k); queue.push([s.x, s.y, s.z]); parent.set(queue.at(-1), p); out.visited++;
        out.minX = Math.min(out.minX, s.x); out.maxX = Math.max(out.maxX, s.x); out.minZ = Math.min(out.minZ, s.z); out.maxZ = Math.max(out.maxZ, s.z);
        // Past the glass line beside the glass: recorded only. Inside = lobby (x > -92, |z| < 55) or the arena bowl (foot < -4).
        if (s.x > -103.99 && Math.abs(s.z) < 62 && !out.pastGlass) out.pastGlass = [s.x, s.y, s.z].map(n => +n.toFixed(2));
        if (((s.x > -92 && Math.abs(s.z) < 55) || s.y < -4) && !out.breach) {
          out.breach = [s.x, s.y, s.z].map(n => +n.toFixed(2));
          const path = []; for (let n = queue.at(-1); n; n = parent.get(n)) path.unshift(n);
          // Replay as one continuous walk from the plaza (no teleports between steps).
          arena.go([...path[0], -Math.PI / 2]); let ok = true;
          for (let i = 1; i < path.length && ok; i++) ok = arena.attempt(path[i][0] - arena.state.x, path[i][2] - arena.state.z);
          out.replay = { ok, end: [arena.state.x, arena.state.y, arena.state.z].map(n => +n.toFixed(2)), zone: null, steps: path.length };
          out.replay.zone = (arena.state.x < -96 ? '외부 광장' : arena.state.x < -61 ? '입구 로비' : '관중석');
          out.waypoints = path.filter((_, i) => i % 12 === 0 || i === path.length - 1).map(n => n.map(v => +v.toFixed(1)));
        }
      }
      if (out.breach) break;
      if (performance.now() - chunk > 1500) { await new Promise(r => setTimeout(r, 0)); chunk = performance.now(); }
    }
    out.exhausted = queue.length === 0;
    arena.go('plaza');
    return out;
  });
  console.log('ticket walk', JSON.stringify(walkResult));
  expect(walkResult.visited, 'the walk explored the plaza').toBeGreaterThan(500);
  expect(walkResult.breach, 'X-H-1: no way into the building without a ticket').toBeNull();
  expect(await page.evaluate(() => window.__ev.filter(e => e.type === 'ticket:issued').length)).toBe(0);

  console.log('controls page errors', JSON.stringify(errors));
  expect(errors, 'no console errors or page errors').toEqual([]);
  await context.close();
});

test('X multi: 16 people in one room over a local PeerServer, live positions, state, AI crowd, leave, 17th refused, hostile peer data', async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  const app = express(), server = createServer(app);
  app.use('/signal', ExpressPeerServer(server, { path: '/', allow_discovery: false, concurrent_limit: 100 }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const cloudRequests = [];
  // Point the vendored PeerJS at the local server; the app code and config stay as they are.
  const local = async context => {
    await context.route(/\/vendor\/peerjs\.min\.js$/, async route => {
      const body = await (await route.fetch()).text();
      route.fulfill({ contentType: 'text/javascript', body: body + `
;(()=>{const N=window.Peer;window.Peer=function(id,o){if(id&&typeof id==='object'){o=id;id=undefined;}
return new N(id,{...o,host:'127.0.0.1',port:${port},path:'/signal/',secure:false});};window.Peer.prototype=N.prototype;})();` });
    });
    context.on('request', r => { if (/peerjs\.com/.test(r.url())) cloudRequests.push(r.url()); });
  };
  const contexts = [];
  const newContext = async () => { const c = await browser.newContext(); await local(c); contexts.push(c); return c; };
  try {
    // T15: auto placement starts only after #enter; the first person takes room key 01 as its host.
    const host = await openArena(await newContext());
    expect(await host.page.evaluate(() => arena.multiplayer.peerId), 'no peer before #enter').toBeNull();
    await host.page.locator('#enter').click();
    await host.page.waitForFunction(() => window.__ev.some(e => e.type === 'room:joined'), null, { timeout: 30_000 });
    const room = await host.page.evaluate(() => arena.multiplayer.room);
    expect(room.code).toBe('01');
    expect(room.roundStart % 600_000, 'roundStart is a showtime boundary').toBe(0);
    const crowdNow = page => page.evaluate(async () => { const t0 = arena.crowd.time; await new Promise(r => setTimeout(r, 500));
      return { meshes: arena.crowd.meshes.length, moving: arena.crowd.time !== t0 }; });
    // T80 (user decision): the AI crowd lives only inside the arena (hidden and paused outside), so watch it from inside.
    expect((await crowdNow(host.page)).moving, 'outside the arena the crowd is hidden and still').toBe(false);
    await host.page.evaluate(() => arena.go('arena'));
    const crowd0 = await crowdNow(host.page);
    expect(crowd0.moving).toBe(true);

    const guestContext = await newContext();
    // Invite link: the room key is used, but only after #enter.
    const guest = await openArena(guestContext, `/?b=final&t=${room.roundStart}&room=${room.code}`);
    expect(await guest.page.evaluate(() => arena.multiplayer.peerId), 'invite link: no peer before #enter').toBeNull();
    await guest.page.locator('#enter').click();
    await guest.page.waitForFunction(() => arena.multiplayer.count === 2, null, { timeout: 30_000 });
    expect(await guest.page.evaluate(() => arena.multiplayer.room)).toEqual({ code: room.code, host: false, roundStart: room.roundStart });

    // 14 light peers (PeerJS only) that send pose and state like the app does, at distinct spots.
    const filler = await (await newContext()).newPage();
    await filler.goto(new URL('config/network.json', baseURL).href);
    await filler.addScriptTag({ url: new URL('vendor/peerjs.min.js', baseURL).href });
    await filler.evaluate(() => {
      window.lights = [];
      window.addLight = (hostId, i) => new Promise((resolve, reject) => {
        const peer = new Peer(), me = { i, pose: [-139 + i, -.02, 3, 0], got: [], conn: null };
        peer.on('error', reject);
        peer.on('open', () => {
          const conn = peer.connect(hostId, { reliable: false, serialization: 'json' });
          me.conn = conn; conn.on('data', d => me.got.push(d?.type));
          conn.on('open', () => {
            const state = { team: null, character: null, nickname: '팬' + String(1000 + i), emote: null, emoteSeq: 0, seated: false };
            me.timer = setInterval(() => { if (conn.open) { conn.send({ type: 'pose', pose: me.pose }); conn.send({ type: 'state', state }); } }, 100);
            resolve();
          });
          conn.on('error', reject);
        });
        window.lights.push(me);
      });
    });
    const hostId = 'barclays-tps-room-final-' + room.code;
    await filler.evaluate(hostId => Promise.all(Array.from({ length: 14 }, (_, i) => addLight(hostId, i))), hostId);

    // BL-0010 (1): 16 people, everyone sees the other 15 and their live positions.
    for (const p of [host.page, guest.page]) await p.waitForFunction(() => arena.multiplayer.count === 16, null, { timeout: 30_000 });
    expect(await guest.page.evaluate(() => arena.multiplayer.positions.length)).toBe(15);
    await filler.evaluate(() => { lights[5].pose = [-120, -.02, -7, 0]; });
    await guest.page.waitForFunction(() => arena.multiplayer.positions.some(p => Math.abs(p[0] + 120) < .01 && Math.abs(p[2] + 7) < .01), null, { timeout: 3000 });
    // BL-0010 (4): states and auto nicknames reach everyone at 16 people.
    await host.page.evaluate(async () => { const { events } = await import('/events.js'); events.dispatchEvent(new CustomEvent('seat:enter', { detail: { seatId: 'qa' } })); });
    const hostPeer = await host.page.evaluate(() => arena.multiplayer.peerId);
    await guest.page.waitForFunction(id => arena.multiplayer.peers.some(p => p.peerId === id && p.seated), hostPeer, { timeout: 10_000 });
    const names = await guest.page.evaluate(() => arena.multiplayer.peers.map(p => p.nickname));
    expect(names).toHaveLength(15);
    expect(new Set(names).size).toBe(15);
    for (const n of names) expect(n).toMatch(/^팬\d{4,8}$/);

    // BL-0010 (2): AI crowd keeps going while people join and leave.
    const crowd1 = await crowdNow(host.page);
    expect(crowd1).toEqual(crowd0);
    await guestContext.close();
    await host.page.waitForFunction(() => arena.multiplayer.count === 15, null, { timeout: 15_000 });
    expect(await crowdNow(host.page)).toEqual(crowd0);

    // BL-0010 (3): back to 16, then a 17th app user gets the full notice at once and is disconnected.
    await filler.evaluate(hostId => addLight(hostId, 14), hostId);
    await host.page.waitForFunction(() => arena.multiplayer.count === 16, null, { timeout: 15_000 });
    // A full invite key (T32f M14, decision 10, FIX1c UX-M10): auto placement skips the full 01 and hosts 02 with the
    // link's showtime, and the "친구 방이 가득" toast shows. The link carries t so 02 has the host's showtime.
    const late = await openArena(await newContext(), `/?b=final&t=${room.roundStart}&room=${room.code}`);
    await late.page.locator('#enter').click();
    await late.page.waitForFunction(() => window.__ev.some(e => e.type === 'room:joined'), null, { timeout: 30_000 });
    expect(await late.page.evaluate(() => arena.multiplayer.room)).toEqual({ code: '02', host: true, roundStart: room.roundStart });
    await expect(late.page.locator('#hud-toast')).toContainText('친구 방이 가득 차서 다른 방으로 들어왔어요');
    expect(await host.page.evaluate(() => arena.multiplayer.count)).toBe(16);
    // BL-0032 (1)(2): the next person by auto placement (no room key, the first page's default showtime — the same
    // next boundary as the host, run within the same 10 minutes) skips the full 01 and joins 02, which has room.
    const next = await openArena(await newContext());
    await next.page.locator('#enter').click();
    await next.page.waitForFunction(() => window.__ev.some(e => e.type === 'room:joined'), null, { timeout: 30_000 });
    expect(await next.page.evaluate(() => arena.multiplayer.room)).toEqual({ code: '02', host: false, roundStart: expect.any(Number) });
    expect(await host.page.evaluate(() => arena.multiplayer.count)).toBe(16);

    // Security: a joined peer sends hostile data; the host keeps clean state and runs nothing.
    await filler.evaluate(() => {
      const c = lights[0].conn;
      window.hostile = [
        { type: 'state', state: { team: null, character: null, nickname: '<img src=x onerror=window.__xss=1>', emote: null, emoteSeq: 0, seated: false } },
        { type: 'state', state: { team: 'x'.repeat(5000), character: null, nickname: '팬1000', emote: null, emoteSeq: 0, seated: false } },
        { type: 'pose', pose: [NaN, 0, 0, 0] }, { type: 'pose', pose: [1e9, 0, 0, 0] },
        { type: 'world', players: [['spoof', [0, 0, 0, 0]]] }, { type: 'full' }, 'not an object', 0, null];
    });
    const perMessage = [];
    for (let i = 0; i < 9; i++) {
      const n = host.errors.length;
      await filler.evaluate(i => lights[0].conn.send(hostile[i]), i);
      await host.page.waitForTimeout(400);
      perMessage.push(host.errors.slice(n));
    }
    console.log('hostile per message', JSON.stringify(perMessage));
    // The same peer keeps syncing after the hostile messages.
    await filler.evaluate(() => { lights[0].pose = [-125, -.02, 9, 0]; });
    const stillSyncing = await host.page.waitForFunction(() => arena.multiplayer.positions.some(p => Math.abs(p[0] + 125) < .01 && Math.abs(p[2] - 9) < .01), null, { timeout: 5000 }).then(() => true, () => false);
    console.log('peer still syncing after hostile data', stillSyncing);
    expect(stillSyncing).toBe(true);
    const hostView = await host.page.evaluate(() => ({ xss: window.__xss ?? null, count: arena.multiplayer.count, connected: arena.multiplayer.connected,
      nicknames: arena.multiplayer.peers.map(p => p.nickname), positions: arena.multiplayer.positions }));
    expect(hostView.xss).toBeNull();
    expect(hostView.connected).toBe(true);
    expect(hostView.count).toBe(16);
    for (const n of hostView.nicknames) expect(n).toMatch(/^팬\d{4,8}$/);
    for (const p of hostView.positions) expect(p.every(n => Number.isFinite(n) && Math.abs(n) < 1000)).toBe(true);

    expect(cloudRequests, 'no request left for PeerJS Cloud in this test').toEqual([]);
    console.log('multi errors', JSON.stringify({ host: host.errors, guest: guest.errors, late: late.errors, next: next.errors }));
    expect([...host.errors, ...guest.errors, ...late.errors, ...next.errors]).toEqual([]);
  } finally {
    for (const c of contexts) await c.close().catch(() => {});
    server.closeAllConnections?.();
    await new Promise(r => server.close(r));
  }
});

// T53 recheck X-H-1: replay the original 141-step waypoint walk (north end of the side glass) and its mirror (south end)
// as one continuous walk with no ticket, then on to the lobby centre. Neither may end inside the building.
test('X-H-1 recheck ticket gate: original north-end walk and its south mirror do not reach the lobby', async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const { page } = await openArena(context);
  const waypoints = [[-110.2, 0], [-108, 7.8], [-108, 55.8], [-102.4, 59.8], [-92.8, 59.8], [-91.5, 54.4], [-92.5, 2.3]];
  const results = {};
  for (const [side, sign] of [['북', 1], ['남', -1]]) {
    results[side] = await page.evaluate(async ([wps, sign]) => {
      arena.go([-139, arena.groundAt(-139, 0, 0) ?? -.02, 0, -Math.PI / 2]);
      let steps = 0;
      for (const [tx, tz0] of wps) {
        const tz = tz0 * sign;
        for (let i = 0; i < 600; i++) {
          const p = arena.player, dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz);
          if (l < .2) break;
          const sx = dx / l * .2, sz = dz / l * .2;
          if (!arena.attempt(sx, sz) && !arena.attempt(sx, 0) && !arena.attempt(0, sz)) break; // blocked: go to next waypoint
          steps++;
          if (i % 20 === 0) await new Promise(requestAnimationFrame);
        }
      }
      const s = arena.state;
      return { end: [s.x, s.y, s.z].map(n => +n.toFixed(2)), steps, ticket: window.__ev.filter(e => e.type === 'ticket:issued').length };
    }, [waypoints, sign]);
    await page.waitForTimeout(600);
    await page.screenshot({ path: fileURLToPath(new URL(`../_workspace/_run/2026-11-12-requirements-build/screens/T53-X-H-1-${side}-end.png`, import.meta.url)) });
  }
  console.log('T53 X-H-1', JSON.stringify(results));
  for (const [side, r] of Object.entries(results)) {
    const [x, y, z] = r.end;
    expect(r.ticket, `${side}: no ticket issued`).toBe(0);
    expect((x > -92 && Math.abs(z) < 55) || y < -4, `X-H-1 ${side}: ended inside the building at ${r.end}`).toBe(false);
    expect(x > -103.99 && Math.abs(z) < 59.21, `X-H-1 ${side}: ended past the glass line at ${r.end}`).toBe(false);
  }
  await context.close();
});
