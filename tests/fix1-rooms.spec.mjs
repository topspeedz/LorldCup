import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// FIX1c reproductions: B-H-1 (= B-사용자-1), U-H-11, BL-0035 room side, BL-0034 room panel side.
// Rooms run on a local PeerServer (V01 method, as in qa-x / room-handoff); the app's PeerJS Cloud setting is untouched.
const require = createRequire(new URL('../_workspace/qa/2026-11-12-webrtc-20-validation/V01/package.json', import.meta.url));
const express = require('express');
const { ExpressPeerServer } = require('peer');

async function rig(browser) {
  const app = express(), server = createServer(app);
  app.use('/signal', ExpressPeerServer(server, { path: '/', allow_discovery: false, concurrent_limit: 100, expire_timeout: 300 }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port, contexts = [];
  const open = async (url = '/') => {
    const context = await browser.newContext();
    contexts.push(context);
    await context.route(/\/vendor\/peerjs\.min\.js$/, async route => {
      const body = await (await route.fetch()).text();
      route.fulfill({ contentType: 'text/javascript', body: body + `
;(()=>{const N=window.Peer;window.Peer=function(id,o){if(id&&typeof id==='object'){o=id;id=undefined;}
return new N(id,{...o,host:'127.0.0.1',port:${port},path:'/signal/',secure:false});};window.Peer.prototype=N.prototype;})();` });
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.arena?.ready, null, { timeout: 150_000 });
    return { page, errors };
  };
  const close = async () => { for (const c of contexts) await c.close().catch(() => {}); server.closeAllConnections?.(); await new Promise(r => server.close(r)); };
  return { open, close };
}
const room = page => page.waitForFunction(() => arena.multiplayer.room, null, { timeout: 60_000 }).then(() => page.evaluate(() => arena.multiplayer.room));

test('B-H-1: a host whose draw loop stopped (hidden tab) still answers `room`; the next person joins its room, not 02', async ({ browser }) => {
  test.setTimeout(300_000);
  const r = await rig(browser);
  try {
    const host = await r.open();
    await host.page.locator('#enter').click();
    const hostRoom = await room(host.page);
    expect(hostRoom.code).toBe('01');
    // What a hidden or covered tab does: requestAnimationFrame stops firing.
    await host.page.evaluate(() => { window.requestAnimationFrame = () => 0; });
    await host.page.waitForTimeout(500);
    const guest = await r.open();
    await guest.page.locator('#enter').click(); // the same default showtime as the host
    expect(await room(guest.page)).toEqual({ code: '01', host: false, roundStart: hostRoom.roundStart });
    await expect.poll(() => host.page.evaluate(() => arena.multiplayer.roomState.count), { timeout: 15_000 }).toBe(2);
    // The invite path to the hidden host works too (was "방 01 응답 없음").
    const invited = await r.open('/?room=01');
    await invited.page.locator('#enter').click();
    expect((await room(invited.page)).code).toBe('01');
    // B-H-1 surfaced: the room shows as the people line, not as a room number.
    await expect(invited.page.locator('#network-status')).toHaveText('3명 같이 보는 중', { timeout: 15_000 });
    expect([...host.errors, ...guest.errors, ...invited.errors]).toEqual([]);
  } finally { await r.close(); }
});

test('BL-0035: room keys per broadcast, auto placement by showtime, invite URL ?b=&t=&room=', async ({ browser }) => {
  test.setTimeout(300_000);
  const r = await rig(browser);
  try {
    const a = await r.open();
    await a.page.locator('#enter').click();
    const ra = await room(a.page);
    expect(await a.page.evaluate(() => arena.multiplayer.peerId)).toBe('barclays-tps-room-final-' + ra.code);
    // A different showtime → a different room (the room's roundStart is that showtime).
    const b = await r.open();
    const second = b.page.locator('#showtimes button[data-showtime]').nth(1);
    const showtime = Number(await second.getAttribute('data-showtime'));
    expect(showtime).not.toBe(ra.roundStart);
    await second.click();
    await b.page.locator('#enter').click();
    expect(await room(b.page)).toEqual({ code: '02', host: true, roundStart: showtime });
    // The invite link of room 02 carries b, t (its roundStart) and room; the invitee joins 02 whatever its own pick.
    await b.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await b.page.getByRole('button', { name: '같이 보기 — 초대 링크 복사' }).click();
    const link = new URL(await b.page.evaluate(() => navigator.clipboard.readText()));
    expect(Object.fromEntries(link.searchParams)).toEqual({ b: 'final', t: String(showtime), room: '02' });
    const c = await r.open(link.pathname + link.search);
    await c.page.locator('#enter').click();
    expect(await room(c.page)).toEqual({ code: '02', host: false, roundStart: showtime });
    expect([...a.errors, ...b.errors, ...c.errors]).toEqual([]);
  } finally { await r.close(); }
});

test('BL-0034 room panel: one "같이 보기" button in #network, no room buttons or key input, no screen text from multiplayer.js', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready, null, { timeout: 150_000 });
  await page.locator('#enter').click();
  await expect(page.locator('#network').getByRole('button')).toHaveCount(1);
  await expect(page.locator('#network #watch-together')).toHaveText('같이 보기');
  await expect(page.locator('#network input')).toHaveCount(0);
  await expect(page.locator('#hud-room, #room-code, #host-room, #join-room, #leave-room, .room-copy')).toHaveCount(0);
  expect(await page.evaluate(() => typeof arena.multiplayer.join === 'function' && typeof arena.multiplayer.leave === 'function')).toBe(true);
});

test('U-H-11: the verify scripts use multiplayer.join/leave and room.code, and wait for the room after #enter (no old room ids)', () => {
  for (const name of ['verify-tps.mjs', 'verify-jump.mjs']) {
    const src = readFileSync(new URL(`../web/${name}`, import.meta.url), 'utf8');
    expect(src, name).not.toMatch(/#(room-code|host-room|join-room|leave-room)/);
    expect(src, name).toContain("locator('#enter').click()");
    expect(src, name).toContain('arena.multiplayer.room.code');
  }
  // The run itself is tests/regression.spec.mjs (browser, QA line).
});

// RW-H-1 (FIX2d): '같이 보기' pressed before the room is settled waits for it and copies the link with room
// (docs/live/product/ux/room-invite.md UX-M07, M9); the friend lands in the same room and showtime (UX-M15, M21).
test('RW-H-1: "같이 보기" right after #enter (still connecting) copies a link with room; the friend joins that room', async ({ browser }) => {
  test.setTimeout(300_000);
  const r = await rig(browser);
  try {
    const a = await r.open();
    await a.page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const pick = a.page.locator('#showtimes button[data-showtime]').nth(1);
    const showtime = Number(await pick.getAttribute('data-showtime'));
    await pick.click();
    await a.page.locator('#enter').click();
    await a.page.waitForFunction(() => arena.multiplayer.roomState.phase === 'connecting', null, { timeout: 10_000 });
    expect(await a.page.evaluate(() => arena.multiplayer.room)).toBeNull(); // the click below is the "before the room" case
    await a.page.getByRole('button', { name: '같이 보기 — 초대 링크 복사' }).click();
    await expect(a.page.locator('#watch-together-note')).toHaveText('복사됐어요. 친구에게 보내면 같은 방으로 들어와요', { timeout: 60_000 });
    const ra = await room(a.page);
    const link = new URL(await a.page.evaluate(() => navigator.clipboard.readText()));
    expect(Object.fromEntries(link.searchParams)).toEqual({ b: 'final', t: String(showtime), room: ra.code });
    const c = await r.open(link.pathname + link.search);
    await expect(c.page.locator('#panel-title')).toHaveText('친구가 부른 방으로 들어가요');
    await c.page.locator('#enter').click();
    expect(await room(c.page)).toEqual({ code: ra.code, host: false, roundStart: showtime });
    expect([...a.errors, ...c.errors]).toEqual([]);
  } finally { await r.close(); }
});

// RW-H-1 (나): a link with b and t but no room still follows the link's showtime: no first page, no showtime choice,
// auto placement in that showtime → the sender's room (room-invite.md UX-M15 "어느 경우에도 시각을 고르는 화면이 없다").
test('RW-H-1: a link without room (?b=&t=) skips the first page and lands in the room of that showtime', async ({ browser }) => {
  test.setTimeout(300_000);
  const r = await rig(browser);
  try {
    const a = await r.open();
    const pick = a.page.locator('#showtimes button[data-showtime]').nth(2);
    const showtime = Number(await pick.getAttribute('data-showtime'));
    await pick.click();
    await a.page.locator('#enter').click();
    const ra = await room(a.page);
    expect(ra.roundStart).toBe(showtime);
    const c = await r.open(`/?b=final&t=${showtime}`);
    await expect(c.page.locator('#panel')).toHaveAttribute('data-mode', 'invite');
    await expect(c.page.locator('#panel-title')).toHaveText('친구가 부른 방으로 들어가요');
    await expect(c.page.locator('#showtimes')).toBeHidden();
    await c.page.locator('#enter').click();
    expect(await room(c.page)).toEqual({ code: ra.code, host: false, roundStart: showtime });
    expect([...a.errors, ...c.errors]).toEqual([]);
  } finally { await r.close(); }
});
