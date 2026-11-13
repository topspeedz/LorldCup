import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';

// T14 BL-0032 (3)(4)(5), X-L-1: host handoff, solo watching, ops `info`, malformed room messages.
// Rooms run on a local PeerServer (V01 method, as in qa-x); the app's PeerJS Cloud setting is untouched.
const require = createRequire(new URL('../_workspace/qa/2026-11-12-webrtc-20-validation/V01/package.json', import.meta.url));
const express = require('express');
const { ExpressPeerServer } = require('peer');
const PREFIX = 'barclays-tps-room-final-'; // FIX1c: host peer id = prefix + broadcast id + '-' + key

const recordEvents = () => {
  window.__ev = [];
  // T26f R-1: keep every RTCPeerConnection so a test can fake a transient ICE `disconnected`.
  window.__pcs = [];
  const RTC = window.RTCPeerConnection;
  window.RTCPeerConnection = class extends RTC { constructor(...a) { super(...a); window.__pcs.push(this); } };
  const dispatch = EventTarget.prototype.dispatchEvent;
  EventTarget.prototype.dispatchEvent = function (e) {
    if (e instanceof CustomEvent && /^room:/.test(e.type)) window.__ev.push({ type: e.type, detail: e.detail });
    return dispatch.call(this, e);
  };
};
const states = page => page.evaluate(() => window.__ev.filter(e => e.type === 'room:state').map(e => e.detail));
const lastState = page => states(page).then(s => s.at(-1) ?? null);
const lefts = page => page.evaluate(() => window.__ev.filter(e => e.type === 'room:left').length);

async function rig(browser, baseURL) {
  const app = express(), server = createServer(app);
  app.use('/signal', ExpressPeerServer(server, { path: '/', allow_discovery: false, concurrent_limit: 100 }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port, contexts = [], cloud = [];
  const newContext = async () => {
    const context = await browser.newContext();
    await context.route(/\/vendor\/peerjs\.min\.js$/, async route => {
      const body = await (await route.fetch()).text();
      route.fulfill({ contentType: 'text/javascript', body: body + `
;(()=>{const N=window.Peer;window.Peer=function(id,o){if(id&&typeof id==='object'){o=id;id=undefined;}
return new N(id,{...o,host:'127.0.0.1',port:${port},path:'/signal/',secure:false});};window.Peer.prototype=N.prototype;})();` });
    });
    context.on('request', r => { if (/peerjs\.com/.test(r.url())) cloud.push(r.url()); });
    contexts.push(context);
    return context;
  };
  const open = async (url = '/') => {
    const page = await (await newContext()).newPage(), errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    // The YouTube iframe sometimes logs a browser permissions-policy line; it is not from the room code.
    page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Permissions policy violation')) errors.push('console: ' + m.text()); });
    await page.addInitScript(recordEvents);
    await page.goto(url);
    await page.waitForFunction(() => window.arena?.ready, null, { timeout: 150_000 });
    // T15: an invite link (?room=) joins only after #enter.
    if (/[?&]room=/.test(url)) await page.locator('#enter').click();
    return { page, errors };
  };
  // Light PeerJS-only helpers: guests, an ops probe, a fake host, a zombie id holder.
  const lightPage = async () => {
    const page = await (await newContext()).newPage();
    await page.goto(new URL('config/network.json', baseURL).href);
    await page.addScriptTag({ url: new URL('vendor/peerjs.min.js', baseURL).href });
    await page.evaluate(() => {
      window.made = {};
      const opened = id => new Promise((resolve, reject) => { const p = id ? new Peer(id) : new Peer(); p.on('open', () => resolve(p)); p.on('error', reject); });
      window.opened = opened;
      // A guest that sends pose and state like the app and ignores incoming connections.
      window.guest = async (name, hostId, i) => {
        const peer = await opened(), conn = peer.connect(hostId, { reliable: false, serialization: 'json' });
        const me = made[name] = { peer, conn, got: [] };
        conn.on('data', d => me.got.push(d));
        await new Promise((resolve, reject) => { conn.on('open', resolve); conn.on('error', reject); });
        const state = { team: null, character: null, nickname: '팬' + (2000 + i), emote: null, emoteSeq: 0, seated: false };
        me.timer = setInterval(() => { if (conn.open) { conn.send({ type: 'pose', pose: [-139 + i, -.02, 3, 0] }); conn.send({ type: 'state', state }); } }, 100);
        return peer.id;
      };
      // Ops screen probe: hello every second until the host closes; returns every message received.
      window.ops = key => new Promise(async resolve => {
        const peer = await opened(), conn = peer.connect('barclays-tps-room-final-' + key, { reliable: false, serialization: 'json' }), got = [];
        let t;
        conn.on('open', () => { conn.send({ type: 'hello', role: 'ops' }); t = setInterval(() => conn.open && conn.send({ type: 'hello', role: 'ops' }), 1000); });
        // The host also sends `room` to any caller that has not said who it is yet (it races hello); the real ops page ignores it.
        conn.on('data', d => { if (d?.type !== 'room') got.push(d); });
        const done = closed => { clearInterval(t); peer.destroy(); resolve({ got, closed }); };
        conn.on('close', () => setTimeout(() => done(true), 300));
        setTimeout(() => done(false), 12_000);
      });
      // Grab an id as soon as the signaling server frees it.
      window.grab = async (name, id, deadline = 60_000) => {
        const t0 = Date.now();
        for (;;) {
          try { const p = await opened(id); made[name] = { peer: p, got: [] }; return Date.now() - t0; }
          catch (e) { if (e.type !== 'unavailable-id' || Date.now() - t0 > deadline) throw e; await new Promise(r => setTimeout(r, 100)); }
        }
      };
    });
    return page;
  };
  const close = async () => {
    for (const c of contexts) await c.close().catch(() => {});
    server.closeAllConnections?.();
    await new Promise(r => server.close(r));
  };
  return { open, lightPage, close, cloud };
}

test('handoff on tab close: first member takes over, others rejoin, room key kept, newcomer joins, ops info, then solo', async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  const r = await rig(browser, baseURL);
  try {
    const host = await r.open();
    await host.page.locator('#enter').click(); // R-2: the room buttons do nothing before #enter; auto placement takes free key 01
    await expect.poll(() => lastState(host.page), { timeout: 30_000 }).toEqual({ key: '01', count: 1, host: true, phase: 'solo' });
    const { roundStart } = await host.page.evaluate(() => arena.multiplayer.room);
    expect(await host.page.evaluate(() => arena.multiplayer.peerId)).toBe(PREFIX + '01');

    const g1 = await r.open('/?room=01');
    await host.page.waitForFunction(() => arena.multiplayer.count === 2, null, { timeout: 30_000 });
    const g2 = await r.open('/?room=01');
    for (const p of [host.page, g1.page, g2.page]) await p.waitForFunction(() => arena.multiplayer.count === 3, null, { timeout: 30_000 });
    const [id1, id2] = await Promise.all([g1.page, g2.page].map(p => p.evaluate(() => arena.multiplayer.peerId)));
    for (const p of [g1.page, g2.page]) await expect.poll(() => p.evaluate(() => arena.multiplayer.members), { timeout: 5000 }).toEqual([id1, id2]);
    expect(await lastState(g1.page)).toEqual({ key: '01', count: 3, host: false, phase: 'room' });

    // Ops `hello`: only {count, capacity}, three times, then closed; the probe is not counted as a guest.
    const light = await r.lightPage();
    const ops = await light.evaluate(() => ops('01'));
    expect(ops.closed).toBe(true);
    expect(ops.got).toEqual([1, 2, 3].map(() => ({ type: 'info', count: 3, capacity: 16 })));
    expect(await host.page.evaluate(() => [arena.multiplayer.count, arena.multiplayer.members])).toEqual([3, [id1, id2]]);

    // Host closes the tab (pagehide): g1 takes over at once, g2 rejoins g1, nobody gets room:left.
    const t0 = Date.now();
    await host.page.goto('about:blank');
    await expect.poll(() => lastState(g1.page), { timeout: 20_000 }).toEqual({ key: '01', count: 2, host: true, phase: 'room' });
    await expect.poll(() => lastState(g2.page), { timeout: 20_000 }).toEqual({ key: '01', count: 2, host: false, phase: 'room' });
    console.log('pagehide handoff ms', Date.now() - t0);
    expect((await states(g2.page)).some(s => s.phase === 'handoff')).toBe(true);
    for (const p of [g1.page, g2.page]) {
      expect(await lefts(p)).toBe(0);
      expect(await p.evaluate(() => arena.multiplayer.room)).toEqual({ code: '01', host: p === g1.page, roundStart });
      expect(await p.evaluate(() => window.__ev.filter(e => e.type === 'room:joined').length)).toBe(1);
    }
    await expect.poll(() => g2.page.evaluate(() => arena.multiplayer.members), { timeout: 5000 }).toEqual([id2]);

    // The new host took the room key back: a newcomer on 01 lands in the same room.
    const g3 = await r.open('/?room=01');
    for (const p of [g1.page, g3.page]) await p.waitForFunction(() => arena.multiplayer.count === 3, null, { timeout: 40_000 });
    expect(await g3.page.evaluate(() => arena.multiplayer.room)).toEqual({ code: '01', host: false, roundStart });

    // Everyone else leaves: g1 stays host on 01, solo, no room:left, ops sees 1/16.
    await g2.page.goto('about:blank');
    await g3.page.goto('about:blank');
    await expect.poll(() => lastState(g1.page), { timeout: 30_000 }).toEqual({ key: '01', count: 1, host: true, phase: 'solo' });
    expect(await lefts(g1.page)).toBe(0);
    expect(await g1.page.locator('#network-status').textContent()).not.toMatch(/끊|종료/);
    const solo = await light.evaluate(() => ops('01'));
    expect(solo.got).toEqual([1, 2, 3].map(() => ({ type: 'info', count: 1, capacity: 16 })));

    expect(r.cloud).toEqual([]);
    expect([...host.errors, ...g1.errors, ...g2.errors, ...g3.errors]).toEqual([]);
  } finally { await r.close(); }
});

test('handoff on host crash: silent first member is skipped, the next one becomes host and retries the stale key id', async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  const r = await rig(browser, baseURL);
  try {
    const host = await r.open();
    await host.page.locator('#enter').click(); // R-2: the room buttons do nothing before #enter; auto placement takes free key 01
    await expect.poll(() => lastState(host.page), { timeout: 30_000 }).toMatchObject({ key: '01', phase: 'solo' });
    const { roundStart } = await host.page.evaluate(() => arena.multiplayer.room);
    const light = await r.lightPage();
    const silent = await light.evaluate(() => guest('silent', 'barclays-tps-room-final-01', 1)); // first in line, never answers as host
    await host.page.waitForFunction(() => arena.multiplayer.count === 2, null, { timeout: 30_000 });
    const g = await r.open('/?room=01');
    await g.page.waitForFunction(() => arena.multiplayer.count === 3, null, { timeout: 30_000 });
    const gid = await g.page.evaluate(() => arena.multiplayer.peerId);
    await expect.poll(() => g.page.evaluate(() => arena.multiplayer.members), { timeout: 5000 }).toEqual([silent, gid]);

    // Abnormal end: the renderer dies, no pagehide, no handoff message.
    const t0 = Date.now();
    const cdp = await host.page.context().newCDPSession(host.page);
    cdp.send('Page.crash').catch(() => {});
    // Someone who never answers grabs the key id the moment it is free: the new host must keep retrying.
    const freedMs = await light.evaluate(() => grab('zombie', 'barclays-tps-room-final-01'));
    console.log('key id freed after crash ms', freedMs);
    await expect.poll(() => lastState(g.page), { timeout: 40_000 }).toEqual({ key: '01', count: 1, host: true, phase: 'solo' });
    console.log('crash handoff (silent member skipped) ms', Date.now() - t0);
    expect((await states(g.page)).some(s => s.phase === 'handoff')).toBe(true);
    expect(await lefts(g.page)).toBe(0);
    expect(await g.page.evaluate(() => arena.multiplayer.room)).toEqual({ code: '01', host: true, roundStart });

    await g.page.waitForTimeout(12_000); // at least one failed claim + probe round while the zombie holds 01
    expect((await light.evaluate(() => ops('01'))).got).toEqual([]);
    await light.evaluate(() => made.zombie.peer.destroy());
    const t1 = Date.now();
    await expect.poll(async () => (await light.evaluate(() => ops('01'))).got[0] ?? null, { timeout: 40_000, intervals: [500] })
      .toEqual({ type: 'info', count: 1, capacity: 16 });
    console.log('key reclaimed after zombie freed ms', Date.now() - t1);
    expect(await lastState(g.page)).toEqual({ key: '01', count: 1, host: true, phase: 'solo' });
    expect(await lefts(g.page)).toBe(0);
    expect(g.errors).toEqual([]);
  } finally { await r.close(); }
});

test('T26 R-1: live host keeps the room through a guest ICE blip, and a member calling the first in line does not make it host', async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  const r = await rig(browser, baseURL);
  try {
    const host = await r.open();
    await host.page.locator('#enter').click();
    await expect.poll(() => lastState(host.page), { timeout: 30_000 }).toEqual({ key: '01', count: 1, host: true, phase: 'solo' });
    const m0 = await r.open('/?room=01');
    await host.page.waitForFunction(() => arena.multiplayer.count === 2, null, { timeout: 30_000 });
    const g = await r.open('/?room=01');
    for (const p of [host.page, m0.page, g.page]) await p.waitForFunction(() => arena.multiplayer.count === 3, null, { timeout: 30_000 });
    const [id0, idg] = await Promise.all([m0.page, g.page].map(p => p.evaluate(() => arena.multiplayer.peerId)));
    for (const p of [m0.page, g.page]) await expect.poll(() => p.evaluate(() => arena.multiplayer.members), { timeout: 5000 }).toEqual([id0, idg]);
    const whole = async (count = 3, members = [id0, idg]) => {
      expect(await lastState(host.page)).toEqual({ key: '01', count, host: true, phase: 'room' });
      for (const p of [m0.page, g.page]) expect(await lastState(p)).toEqual({ key: '01', count, host: false, phase: 'room' });
      expect(await host.page.evaluate(() => arena.multiplayer.members)).toEqual(members);
      for (const p of [m0.page, g.page]) expect((await states(p)).some(s => s.host || s.phase === 'handoff')).toBe(false);
    };

    // (a) g's link to the live host goes ICE `disconnected` for 1.5 s (Chrome does this on a short network hiccup), then recovers.
    const blipped = await g.page.evaluate(async () => {
      const pcs = window.__pcs.filter(pc => pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed');
      const fire = state => pcs.forEach(pc => { Object.defineProperty(pc, 'iceConnectionState', { get: () => state, configurable: true }); pc.oniceconnectionstatechange?.(); });
      fire('disconnected');
      await new Promise(res => setTimeout(res, 1500));
      fire('connected');
      for (const pc of pcs) delete pc.iceConnectionState;
      return pcs.length;
    });
    expect(blipped).toBe(1);
    await g.page.waitForTimeout(5000);
    await whole();

    // (b) A member of the room calls m0 (first in line) while the host is alive: m0 stays a guest of the same room.
    const light = await r.lightPage();
    const caller = await light.evaluate(() => guest('caller', 'barclays-tps-room-final-01', 7));
    for (const p of [host.page, m0.page, g.page]) await p.waitForFunction(() => arena.multiplayer.count === 4, null, { timeout: 30_000 });
    await expect.poll(() => m0.page.evaluate(() => arena.multiplayer.members), { timeout: 5000 }).toEqual([id0, idg, caller]);
    await light.evaluate(async id => {
      const conn = made.caller.peer.connect(id, { reliable: false, serialization: 'json' });
      await new Promise((res, rej) => { conn.on('open', res); conn.on('error', rej); });
      made.caller.side = setInterval(() => conn.open && conn.send({ type: 'pose', pose: [0, 0, 0, 0] }), 100);
    }, id0);
    await m0.page.waitForTimeout(5000);
    await whole(4, [id0, idg, caller]);
    expect(await m0.page.evaluate(() => arena.multiplayer.room.host)).toBe(false);

    expect(r.cloud).toEqual([]);
    expect([...host.errors, ...m0.errors, ...g.errors]).toEqual([]);
  } finally { await r.close(); }
});

test('malformed and null room data are dropped; a bad handoff counts as a cut; a key taken by another room moves to a free key', async ({ browser, baseURL }) => {
  test.setTimeout(600_000);
  const r = await rig(browser, baseURL);
  try {
    // A fake host holds 05 and answers ops hello like a real room.
    const light = await r.lightPage();
    await light.evaluate(async () => {
      await grab('fake', 'barclays-tps-room-final-05');
      const f = made.fake, now = Date.now(), interval = 30 * 60000;
      f.roundStart = Math.floor(now / interval) * interval;
      f.peer.on('connection', conn => {
        conn.on('data', d => {
          if (d?.type === 'hello') { for (let i = 0; i < 3; i++) conn.send({ type: 'info', count: 2, capacity: 16 }); setTimeout(() => conn.close(), 500); }
        });
        conn.on('open', () => { if (!f.conn) { f.conn = conn; f.timer = setInterval(() => conn.send({ type: 'room', roundStart: f.roundStart }), 200); } });
      });
    });
    const interval = await light.evaluate(() => made.fake.roundStart);
    const g = await r.open('/?room=05');
    await expect.poll(() => lastState(g.page), { timeout: 30_000 }).toMatchObject({ key: '05', host: false, phase: 'room' });
    const gid = await g.page.evaluate(() => arena.multiplayer.peerId);
    await light.evaluate(id => made.fake.conn.send({ type: 'members', members: [id] }), gid);
    await expect.poll(() => g.page.evaluate(() => arena.multiplayer.members), { timeout: 5000 }).toEqual([gid]);

    const junk = [null, 0, 'x', [], { type: 'members' }, { type: 'members', members: 'abc' }, { type: 'members', members: [1, 2] },
      { type: 'members', members: ['a', 'a'] }, { type: 'members', members: Array.from({ length: 16 }, (_, i) => 'p' + i) },
      { type: 'members', members: ['x'.repeat(81)] }, { type: 'info', count: 1, capacity: 16 }, { type: 'hello', role: 'ops' }];
    for (const d of junk) await light.evaluate(d => made.fake.conn.send(d), d);
    await g.page.waitForTimeout(1500);
    expect(g.errors, 'X-L-1: null and junk raise nothing').toEqual([]);
    expect(await g.page.evaluate(() => arena.multiplayer.members)).toEqual([gid]);
    expect(await lastState(g.page)).toMatchObject({ key: '05', host: false, phase: 'room' });

    // handoff naming someone outside the members list: dropped and treated as a cut.
    // g is first in line, becomes host; 05 is still held by a live room (it answers hello), so g takes free key 01.
    await light.evaluate(() => { clearInterval(made.fake.timer); for (let i = 0; i < 3; i++) made.fake.conn.send({ type: 'handoff', to: 'nobody' }); });
    await expect.poll(() => lastState(g.page), { timeout: 60_000 }).toEqual({ key: '01', count: 1, host: true, phase: 'solo' });
    expect((await states(g.page)).some(s => s.phase === 'handoff')).toBe(true);
    expect(await lefts(g.page)).toBe(0);
    expect(await g.page.evaluate(() => arena.multiplayer.room)).toEqual({ code: '01', host: true, roundStart: interval });

    // X-L-1 on the host side: a guest that sends null does not raise anything.
    await light.evaluate(() => guest('rude', 'barclays-tps-room-final-01', 3));
    await g.page.waitForFunction(() => arena.multiplayer.count === 2, null, { timeout: 30_000 });
    for (const d of [null, null, { type: 'handoff', to: 'x' }, { type: 'members', members: [] }]) await light.evaluate(d => made.rude.conn.send(d), d);
    await g.page.waitForTimeout(1000);
    expect(await lastState(g.page)).toEqual({ key: '01', count: 2, host: true, phase: 'room' });
    expect(g.errors).toEqual([]);
  } finally { await r.close(); }
});
