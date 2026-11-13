import { test, expect } from '@playwright/test';
import { roomKey, parseRoomKey, parseInvite, findRoom, joinRoom, probeRoom } from '../web/room-keys.js';

// T13 (BL-0032 (1)(2)(6)): sequential room keys, auto placement, claiming a free number.
// Node-only: a fake PeerJS network stands in for PeerJS Cloud (no browser, no signaling server).

const NET = { roomKeyPrefix: 'barclays-tps-room-', roomKeyDigits: 2, maxRooms: 50, connectTimeoutSeconds: 8, capacity: 16 };
const wait = ms => new Promise(r => setTimeout(r, ms));

class Emitter {
  constructor() { this.handlers = {}; }
  on(name, fn) { (this.handlers[name] ??= []).push(fn); return this; }
  off(name, fn) { this.handlers[name] = (this.handlers[name] ?? []).filter(f => f !== fn); return this; }
  emit(name, ...args) { for (const fn of [...(this.handlers[name] ?? [])]) fn(...args); }
}

// rooms: key → 'room' (has a seat), 'full', 'silent' (channel never opens), 'info' (answers hello).
// A key absent from rooms is a free number. raceKeys: someone else grabs the id while we claim it.
function fakeNetwork({ rooms = {}, raceKeys = [], delay = {}, starts = {} } = {}) {
  const d = { open: 1, channel: 1, reply: 1, unavailable: 1, ...delay };
  const net = { connects: [], opened: [], closed: [], hellos: 0, peers: [], held: new Set() };
  const hostOf = id => id.startsWith(NET.roomKeyPrefix) ? id.slice(NET.roomKeyPrefix.length) : null;
  class FakeConn extends Emitter {
    constructor(peer, id) { super(); this.peer = id; this.open = false; this.closedByUs = false; }
    send(msg) {
      if (msg?.type === 'hello') { net.hellos++; const kind = rooms[hostOf(this.peer)]; if (kind === 'info') setTimeout(() => this.emit('data', { type: 'info', count: 3, capacity: 16 }), d.reply); }
    }
    close() { if (this.closedByUs) return; this.closedByUs = true; this.open = false; net.closed.push(hostOf(this.peer)); this.emit('close'); }
  }
  class FakePeer extends Emitter {
    constructor(id) {
      super(); this.id = id ?? 'guest-' + net.peers.length; this.destroyed = false; net.peers.push(this);
      const key = id && hostOf(id);
      setTimeout(() => {
        if (this.destroyed) return;
        if (key && (raceKeys.includes(key) || net.held.has(key))) {
          rooms[key] = 'room'; // the winner of the race now hosts it
          return this.emit('error', { type: 'unavailable-id', message: `ID "${id}" is taken` });
        }
        if (key) { net.held.add(key); net.opened.push(key); }
        this.emit('open', this.id);
      }, d.open);
    }
    connect(id) {
      const key = hostOf(id); net.connects.push(key);
      const conn = new FakeConn(this, id), kind = rooms[key];
      if (!kind) setTimeout(() => this.emit('error', { type: 'peer-unavailable', message: `Could not connect to peer ${id}` }), d.unavailable);
      else if (kind !== 'silent') setTimeout(() => {
        if (conn.closedByUs || this.destroyed) return;
        conn.open = true; conn.emit('open');
        if (kind === 'room') setTimeout(() => conn.emit('data', { type: 'room', roundStart: starts[key] ?? 1_800_000 }), d.reply);
        if (kind === 'full') setTimeout(() => conn.emit('data', { type: 'full' }), d.reply);
      }, d.channel);
      return conn;
    }
    destroy() { this.destroyed = true; }
  }
  net.createPeer = id => new FakePeer(id);
  return net;
}
const full = n => Object.fromEntries(Array.from({ length: n }, (_, i) => [roomKey(i + 1, 2), 'full']));

test('room keys: zero-padded numbers, outside values checked', () => {
  expect(roomKey(1, 2)).toBe('01');
  expect(roomKey(50, 2)).toBe('50');
  for (const ok of ['01', '16', '50']) expect(parseRoomKey(ok, NET)).toBe(ok);
  for (const bad of ['00', '51', '1', '001', 'ab', '<img>', null, 7, ' 01']) expect(parseRoomKey(bad, NET)).toBeNull();
});

test('a room that accepts → join it, the connection stays open', async () => {
  const net = fakeNetwork({ rooms: { '01': 'room' } });
  const r = await findRoom({ ...NET, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'joined', key: '01', roundStart: 1_800_000 });
  expect(r.conn.open).toBe(true);
  expect(r.peer.id).toBe('guest-0');
  expect(net.opened).toEqual([]);
});

test('full → next number; full rooms are closed as soon as they answer', async () => {
  const net = fakeNetwork({ rooms: { '01': 'full', '02': 'full', '03': 'room' } });
  const r = await findRoom({ ...NET, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'joined', key: '03' });
  expect(net.connects).toEqual(['01', '02', '03']);
  expect(net.closed).toEqual(['01', '02']);
});

test('peer-unavailable → claim that number and become its host', async () => {
  const net = fakeNetwork({ rooms: { '01': 'full' } });
  const r = await findRoom({ ...NET, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'host', key: '02' });
  expect(r.peer.id).toBe('barclays-tps-room-02');
  expect(net.opened).toEqual(['02']);
  expect(net.peers[0].destroyed).toBe(true); // the guest peer is no longer needed
});

test('unavailable-id while claiming → reconnect to that number as a guest', async () => {
  const net = fakeNetwork({ rooms: { '01': 'full' }, raceKeys: ['02'] });
  const r = await findRoom({ ...NET, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'joined', key: '02' });
  expect(net.connects).toEqual(['01', '02', '02']);
  expect(net.opened).toEqual([]);
});

test('timeout → next number', async () => {
  const net = fakeNetwork({ rooms: { '01': 'silent', '02': 'room' } });
  const t0 = Date.now();
  const r = await findRoom({ ...NET, connectTimeoutSeconds: 0.2, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'joined', key: '02' });
  expect(Date.now() - t0).toBeGreaterThanOrEqual(190);
  expect(net.closed).toContain('01');
});

test('never past maxRooms: all full → idle, no claim', async () => {
  const net = fakeNetwork({ rooms: full(6) });
  const r = await findRoom({ ...NET, maxRooms: 5, probeParallel: 2, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'idle', reason: 'no-room' });
  expect(net.connects).toEqual(['01', '02', '03', '04', '05']);
  expect(net.opened).toEqual([]);
});

test('parallel probes: the lower number wins even when a higher one answers first', async () => {
  const net = fakeNetwork({ rooms: { '01': 'silent', '02': 'room', '03': 'room' } });
  const r = await findRoom({ ...NET, connectTimeoutSeconds: 0.2, probeParallel: 2, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'joined', key: '02' });
  expect(net.connects.slice(0, 2)).toEqual(['01', '02']);
  await wait(50);
  expect(net.closed).not.toContain('02');
  expect(net.closed).toContain('03'); // the extra probe is closed, not kept
});

test('the signaling service unreachable → idle, nothing claimed', async () => {
  const net = fakeNetwork({ delay: { open: 1000 } });
  const r = await findRoom({ ...NET, connectTimeoutSeconds: 0.1, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'idle', reason: 'timeout' });
  expect(net.connects).toEqual([]);
});

test('joinRoom (invite / multiplayer.join(key)): only that number; full → full, free → host, taken → guest', async () => {
  let net = fakeNetwork({ rooms: { '07': 'full', '08': 'room' } });
  expect(await joinRoom({ ...NET, key: '07', createPeer: net.createPeer })).toMatchObject({ status: 'full', key: '07' });
  expect(net.connects).toEqual(['07']);
  expect(net.peers[0].destroyed).toBe(true);

  net = fakeNetwork({});
  expect(await joinRoom({ ...NET, key: '07', createPeer: net.createPeer })).toMatchObject({ status: 'host', key: '07' });

  net = fakeNetwork({ raceKeys: ['07'] });
  expect(await joinRoom({ ...NET, key: '07', createPeer: net.createPeer })).toMatchObject({ status: 'joined', key: '07' });

  net = fakeNetwork({ rooms: { '07': 'silent' } });
  expect(await joinRoom({ ...NET, key: '07', connectTimeoutSeconds: 0.1, createPeer: net.createPeer })).toMatchObject({ status: 'timeout', key: '07' });

  net = fakeNetwork({});
  expect(await joinRoom({ ...NET, key: '99', createPeer: net.createPeer })).toMatchObject({ status: 'idle', reason: 'bad-key' });
  expect(net.peers).toEqual([]);
});

test('probeRoom (ops): hello → info / full / peer-unavailable / timeout, never claims a number', async () => {
  const net = fakeNetwork({ rooms: { '01': 'info', '02': 'full', '04': 'silent' } });
  const peer = net.createPeer();
  await new Promise(r => peer.on('open', r));
  const o = { ...NET, connectTimeoutSeconds: 0.3 };
  expect(await probeRoom(peer, '01', o)).toEqual({ status: 'info', count: 3, capacity: 16 });
  expect(await probeRoom(peer, '02', o)).toEqual({ status: 'full' });
  expect(await probeRoom(peer, '03', o)).toEqual({ status: 'peer-unavailable' });
  expect(await probeRoom(peer, '04', o)).toEqual({ status: 'timeout' });
  expect(net.hellos).toBeGreaterThanOrEqual(1);
  expect(net.opened).toEqual([]);
  expect(net.closed).toEqual(['01', '02', '03', '04']); // every knock is let go

});

// Search time with delays close to PeerJS Cloud + STUN (ms): signaling open 500, data channel 800,
// host reply 60, peer-unavailable 250. Run at 1/10 scale, reported at full scale.
test('measure: search time to land on the Nth number, probeParallel 1/2/4', async () => {
  test.setTimeout(120_000);
  const scale = 0.1, delay = { open: 50, channel: 80, reply: 6, unavailable: 25 };
  const rows = [];
  for (const n of [1, 10, 30, 50]) for (const p of [1, 2, 4]) {
    const net = fakeNetwork({ rooms: { ...full(n - 1), [roomKey(n, 2)]: 'room' }, delay });
    const t0 = Date.now();
    const r = await findRoom({ ...NET, probeParallel: p, createPeer: net.createPeer });
    expect(r).toMatchObject({ status: 'joined', key: roomKey(n, 2) });
    rows.push({ n, p, seconds: +((Date.now() - t0) / scale / 1000).toFixed(1), hostsContacted: new Set(net.connects).size });
  }
  console.log('T13-MEASURE ' + JSON.stringify(rows));
});

// FIX1c (BL-0035): rooms per (broadcast, showtime). Auto placement only joins a room whose roundStart is the chosen
// showtime; showtime null does not filter. A different-showtime room is let go at once.
test('showtime: auto placement skips rooms of another showtime, null does not filter', async () => {
  let net = fakeNetwork({ rooms: { '01': 'room', '02': 'room' }, starts: { '01': 1_200_000, '02': 1_800_000 } });
  let r = await findRoom({ ...NET, showtime: 1_800_000, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'joined', key: '02', roundStart: 1_800_000 });
  expect(net.closed).toContain('01');

  net = fakeNetwork({ rooms: { '01': 'room' }, starts: { '01': 1_200_000 } });
  r = await findRoom({ ...NET, showtime: 1_800_000, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'host', key: '02' });

  net = fakeNetwork({ rooms: { '01': 'room' }, starts: { '01': 1_200_000 } });
  r = await findRoom({ ...NET, showtime: null, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'joined', key: '01' });

  // A named room (invite) is joined whatever its showtime.
  net = fakeNetwork({ rooms: { '07': 'room' }, starts: { '07': 1_200_000 } });
  r = await joinRoom({ ...NET, key: '07', showtime: 1_800_000, createPeer: net.createPeer });
  expect(r).toMatchObject({ status: 'joined', key: '07', roundStart: 1_200_000 });
});

test('room keys carry the broadcast id: the host peer id is prefix + broadcast + "-" + key', async () => {
  const prefix = NET.roomKeyPrefix + 'final-';
  const net = fakeNetwork({});
  const r = await findRoom({ ...NET, roomKeyPrefix: prefix, createPeer: net.createPeer });
  expect(r.peer.id).toBe('barclays-tps-room-final-01');
});

// parseInvite(search, {broadcastIds, roundIntervalMinutes, roomKeyDigits, maxRooms, nowMs}) — ui/loading.js imports it.
test('parseInvite: room, b, t checked as the architecture says', () => {
  const now = 1_763_000_000_000 - (1_763_000_000_000 % 600_000); // on a 10-minute boundary
  const o = { broadcastIds: ['final', 'semi'], roundIntervalMinutes: 10, roomKeyDigits: 2, maxRooms: 50, nowMs: now };
  expect(parseInvite('?room=07', o)).toEqual({ broadcastId: 'final', showtime: null, roomKey: '07' });
  expect(parseInvite(`?b=semi&t=${now + 600_000}&room=12`, o)).toEqual({ broadcastId: 'semi', showtime: now + 600_000, roomKey: '12' });
  expect(parseInvite(`b=final&t=${now}&room=01`, o)).toEqual({ broadcastId: 'final', showtime: now, roomKey: '01' });
  // not an invite → null (the first page shows)
  for (const bad of ['', '?b=final', '?room=00', '?room=51', '?room=7', '?room=<x>', '?b=nope&room=01', '?b=&room=01'])
    expect(parseInvite(bad, o)).toBeNull();
  // a bad t is dropped to null, the invite stands
  for (const t of [now + 1, now + 86_400_000, now - 86_400_000, 'abc', '1e12', '', String(now) + '.0', '-600000'])
    expect(parseInvite(`?t=${t}&room=03`, o)).toEqual({ broadcastId: 'final', showtime: null, roomKey: '03' });
});

// RW-H-1 (나): a link copied before the room was settled has b and t but no room. The friend still follows the link's
// showtime (docs/live/product/ux/room-invite.md UX-M15, M21) — no first page, no showtime choice, auto placement in that showtime.
test('parseInvite: no room but a valid t → an invite to that showtime (roomKey null)', () => {
  const now = 1_763_000_000_000 - (1_763_000_000_000 % 600_000);
  const o = { broadcastIds: ['final', 'semi'], roundIntervalMinutes: 10, roomKeyDigits: 2, maxRooms: 50, nowMs: now };
  expect(parseInvite(`?b=final&t=${now + 600_000}`, o)).toEqual({ broadcastId: 'final', showtime: now + 600_000, roomKey: null });
  expect(parseInvite(`?t=${now}`, o)).toEqual({ broadcastId: 'final', showtime: now, roomKey: null });
  expect(parseInvite(`?b=semi&t=${now - 600_000}`, o)).toEqual({ broadcastId: 'semi', showtime: now - 600_000, roomKey: null });
  // still not an invite: no room and no valid t, an unknown b, or a room value that is present but bad
  for (const bad of ['?b=final', `?b=final&t=${now + 1}`, `?b=final&t=abc`, `?b=nope&t=${now}`, `?b=final&t=${now}&room=7`, `?t=${now}&room=`])
    expect(parseInvite(bad, o)).toBeNull();
});
