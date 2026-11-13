import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// T71 re-check U2: U-H-8 (YouTube error 5 recovers by itself, T70) and the user's decision
// "B로 해줘 생동감있께 영상은 그냥 원래 항상 틀려있는것이 목표" (inside the arena the screen always plays, T72).
// Whole app (arena-v2) loaded; the module context is exposed with the same probe as tests/qa-u.spec.mjs.
const shots = '_workspace/_run/2026-11-12-requirements-build/screens/';
const seatsConfig = JSON.parse(readFileSync(new URL('../web/config/seats.json', import.meta.url), 'utf8'));
const roundStart = Date.parse('2026-11-13T04:10:00Z');
test.setTimeout(300_000);

async function openApp(page, viewport = { width: 1920, height: 1080 }) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    // Headless Chromium has no real fullscreen; keep the browser contract (same stub as qa-a).
    let full = null;
    const fire = name => document.dispatchEvent(new Event(name));
    Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get: () => full });
    Element.prototype.requestFullscreen = function () { full = this; fire('fullscreenchange'); return Promise.resolve(); };
    Document.prototype.exitFullscreen = function () { full = null; fire('fullscreenchange'); return Promise.resolve(); };
    // Record every official YT.Player the app builds, so a test can raise that player's own onError (U-H-8 injection).
    window.qaPlayers = [];
    let ready;
    Object.defineProperty(window, 'onYouTubeIframeAPIReady', { configurable: true, set(v) { ready = v; }, get() {
      return ready && (() => {
        if (window.YT?.Player && !YT.Player.qaWrapped) {
          const Original = YT.Player;
          YT.Player = function (target, options) { const player = new Original(target, options); qaPlayers.push({ player, options }); return player; };
          YT.Player.qaWrapped = true;
        }
        ready();
      });
    } });
  });
  await page.setViewportSize(viewport);
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const entry=modules.find(m=>m.path==='seat-mode.js'),original=entry.create;
      entry.create=ctx=>{window.uProbe={ctx};return original(ctx);};` });
  });
  // Enter a started showtime without installing a clock on a running audio listener.
  await page.clock.setFixedTime(roundStart + 30_000);
  await page.goto(`/?b=final&t=${roundStart}`);
  await page.waitForFunction(() => window.arena?.ready && window.arena.screen && window.arena.character?.ready, null, { timeout: 180_000 });
  console.log('T11 U2 entry', await page.locator('#enter').evaluate(el => ({ hidden: el.hidden, display: getComputedStyle(el).display, visibility: getComputedStyle(el).visibility, disabled: el.disabled })));
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
  await page.evaluate(() => arena.go('arena'));
  return errors;
}

const screenState = page => page.evaluate(() => {
  const s = arena.screen, el = s.element, iframe = el.querySelector('iframe'), r = el.getBoundingClientRect(), notice = document.querySelector('#arena-screen-notice');
  return { ...s.state, players: qaPlayers.length, iframe: iframe?.src ?? null, notice: notice.hidden ? '' : notice.textContent,
    layout: [el.offsetWidth, el.offsetHeight], rect: [r.left, r.top, r.width, r.height].map(Math.round) };
});
const videoPlaying = page => {
  const frame = page.frames().find(f => f.url().includes('youtube.com/embed/'));
  return frame ? frame.evaluate(() => { const v = document.querySelector('video'); return !!v && !v.paused && v.readyState >= 2; }).catch(() => false) : false;
};
// Waits up to 90 s for playing; on a miss, logs the screen states it went through (status, notice, player count).
async function playing(page, label = '') {
  const seen = [];
  const ok = await expect.poll(async () => { const s = await screenState(page), k = `${s.status}|${s.players}|${s.notice}`;
    if (seen.at(-1) !== k) seen.push(k); return s.playing; }, { timeout: 90_000 }).toBe(true).then(() => true, () => false);
  if (!ok) console.log('T71 not playing', label, JSON.stringify(seen));
  expect(ok, `${label} ${seen.join(' → ')}`).toBe(true);
}
// Is the camera looking toward the screen (dot of the view direction and the direction to the screen centre)?
const facing = page => page.evaluate(() => {
  const { THREE, camera } = uProbe.ctx, faces = arena.screen.faces;
  const c = faces.reduce((a, f) => a.map((v, i) => v + f.position[i] / faces.length), [0, 0, 0]);
  const to = new THREE.Vector3(...c).sub(camera.position).normalize();
  return +camera.getWorldDirection(new THREE.Vector3()).dot(to).toFixed(3);
});
// App DOM (not the screen layer) drawn over the visible part of the player.
const overlaps = page => page.evaluate(() => {
  const el = arena.screen.element, r = el.getBoundingClientRect();
  const v = { left: Math.max(r.left, 0), top: Math.max(r.top, 0), right: Math.min(r.right, innerWidth), bottom: Math.min(r.bottom, innerHeight) };
  if (v.right <= v.left || v.bottom <= v.top) return [];
  return [...document.querySelectorAll('#ui-root *, body > *')].filter(n => {
    if (n.contains(el) || el.contains(n) || ['CANVAS', 'SCRIPT', 'STYLE', 'LINK', 'OPTION'].includes(n.tagName)) return false;
    const s = getComputedStyle(n), b = n.getBoundingClientRect();
    if (s.visibility === 'hidden' || s.display === 'none' || b.width === 0 || b.height === 0 || (b.width >= innerWidth && b.height >= innerHeight)) return false;
    return Math.min(b.right, v.right) > Math.max(b.left, v.left) && Math.min(b.bottom, v.bottom) > Math.max(b.top, v.top);
  }).map(n => n.id || n.tagName + ':' + n.textContent.trim().slice(0, 20));
});
async function sit(page, seat) {
  await page.evaluate(seat => {
    const { player } = uProbe.ctx, [x, y, z] = seat.position;
    const approach = [x, y, z - Math.sign(z) * 1.2, Math.atan2(-x, -z)];
    approach[1] = player.groundAt(approach[0], approach[2], y);
    player.teleport(approach);
  }, seat);
  await page.keyboard.press('KeyE'); // E remains available with the cursor visible
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seat.id);
}

test('U-H-8: after a live → VOD switch an injected YouTube error 5 comes back to playing with no user action', async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => arena.screen.setSource('live'));
  await playing(page);
  await page.evaluate(() => arena.screen.setSource('vod'));
  await page.waitForTimeout(300);
  await playing(page, 'vod after switch');
  const before = await screenState(page);
  const t0 = Date.now();
  await page.evaluate(() => { const { player, options } = qaPlayers.at(-1); options.events.onError({ target: player, data: 5 }); });
  const failed = await screenState(page);
  await expect.poll(() => page.evaluate(() => qaPlayers.length), { timeout: 30_000 }).toBeGreaterThan(before.players);
  await playing(page, 'after error 5');
  const seconds = (Date.now() - t0) / 1000;
  const videoRecovered = await expect.poll(() => videoPlaying(page), { timeout: 30_000 }).toBe(true).then(() => true, () => false);
  const after = await screenState(page);
  const videos = await Promise.all(page.frames().filter(frame => frame.url().includes('youtube.com/embed/')).map(frame => frame.evaluate(() =>
    [...document.querySelectorAll('video')].map(video => ({ time: video.currentTime, paused: video.paused, ready: video.readyState, network: video.networkState,
      error: video.error ? { code: video.error.code, message: video.error.message } : null }))
  ).catch(() => null)));
  console.log('T71 U-H-8', JSON.stringify({ seconds, before, failed, after, videoRecovered, videos }));
  expect(videoRecovered, 'actual video must recover within 30 seconds of the playing state').toBe(true);
  expect(before).toMatchObject({ source: 'vod', playing: true });
  expect(failed.playing).toBe(false);
  expect(failed.notice).toContain('YouTube 5');
  expect(failed.notice).toContain('자동으로 다시 연결');
  expect(after).toMatchObject({ source: 'vod', playing: true, notice: '' });
  expect(after.iframe).toMatch(/youtube\.com\/embed\/rQTHR3aL0SE/);
  expect(await page.locator('#arena-screen-player iframe').count()).toBe(1);
  expect(await page.locator('#settings > #arena-screen-controls button:not(#arena-screen-sound):visible').count()).toBe(0); // T31: only the sound button, no play/retry button
  expect(errors).toEqual([]);
});

test('U3 change: in the arena the screen plays at the default arrival view, facing away and seated; 480×270 layout, nothing over it', async ({ page }) => {
  const errors = await openApp(page);
  const log = [];
  const check = async (step, shot) => {
    await playing(page);
    await expect.poll(() => videoPlaying(page), { timeout: 30_000 }).toBe(true);
    log.push({ step, facing: await facing(page), over: await overlaps(page), ...await screenState(page) });
    if (shot) await page.screenshot({ path: shots + shot });
  };
  await check('arrival', 'T71-arrival-playing.png'); // no turning: the user's first view
  await page.evaluate(() => uProbe.ctx.cameraRig.rotate(Math.PI / .002, 0)); // turn the view half round
  await page.waitForTimeout(3000);
  await check('back-turned', 'T71-back-turned-playing.png');
  await sit(page, seatsConfig.seats[0]);
  await page.waitForTimeout(1500);
  await check('seated', 'T71-seated-playing.png');
  console.log('T71 always-play', JSON.stringify(log));
  expect(log[0].facing, 'arrival keeps the default view').toBeGreaterThan(0);
  expect(log[1].facing, 'the screen is behind the camera').toBeLessThan(0);
  for (const e of log) {
    expect(e.playing, e.step).toBe(true);
    expect(e.layout[0], e.step).toBeGreaterThanOrEqual(200);
    expect(e.layout[1], e.step).toBeGreaterThanOrEqual(200);
    if (e.facing > 0) expect(e.over, e.step).toEqual([]); // behind the camera the projected box is not on screen (product inView=false)
  }
  expect(errors).toEqual([]);
});

// T71 memo 1: is the Full Mode button visible and clickable in the real app where the big screen now hangs?
for (const [w, h] of [[1920, 1080], [1280, 720], [960, 640]]) {
  test(`Full Mode button at ${w}x${h}: visible and opens Full Mode at the arena default view and seated`, async ({ page }) => {
    const errors = await openApp(page, { width: w, height: h });
    const results = [];
    const probe = async step => {
      expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
      await playing(page);
      await page.waitForTimeout(1000);
      const button = page.getByRole('button', { name: 'Full Mode' });
      const seen = await page.evaluate(() => {
        const b = document.querySelector('#full-mode-open'), r = b.getBoundingClientRect();
        return { visibility: getComputedStyle(b).visibility, occluded: b.hasAttribute('data-screen-occluded'),
          top: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === b, box: [r.left, r.top, r.width, r.height].map(Math.round) };
      });
      console.log(`T71 full-mode probe ${w}x${h}`, JSON.stringify({ step, ...seen }));
      await page.screenshot({ path: shots + `T71-fullmode-${step}-${w}x${h}.png` });
      let opened = false;
      if (await button.isVisible()) {
        await button.click({ timeout: 5000 }).catch(() => {});
        opened = await page.waitForFunction(() => arena.screen.fullMode, null, { timeout: 5000 }).then(() => true, () => false);
        if (opened) { await page.keyboard.press('Escape'); await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(false); }
      }
      results.push({ step, ...seen, opened });
    };
    await probe('arrival');
    console.log(`T71 sit ${w}x${h}`);
    await sit(page, seatsConfig.seats[0]);
    await page.waitForTimeout(1500);
    await probe('seated');
    console.log(`T71 full-mode ${w}x${h}`, JSON.stringify(results));
    for (const r of results) expect(r, `${r.step} ${w}x${h}`).toMatchObject({ visibility: 'visible', occluded: false, top: true, opened: true });
    expect(errors).toEqual([]);
  });
}

// T74 re-check U3: U-H-9 forced. Media chunks (googlevideo) hang from the VOD switch on, so the player stays
// buffering past T73's replacement point; then the network is released and we time the return to playing.
test('U-H-9: VOD held in buffering by hung media requests comes back to playing within 60 s of release, no user action', async ({ page, context }) => {
  test.setTimeout(480_000);
  const errors = await openApp(page);
  await page.evaluate(() => arena.screen.setSource('live'));
  await playing(page, 'live at arrival');
  const hung = [];
  let holding = true;
  await context.route(/googlevideo\.com\//, route => holding ? hung.push(route) : route.continue());
  const before = await screenState(page);
  await page.evaluate(() => arena.screen.setSource('vod'));
  const trail = [], t0 = Date.now();
  const sample = async () => { const s = await screenState(page), k = `${s.status}|${s.players}|${s.notice}`;
    if (trail.at(-1)?.k !== k) trail.push({ t: Math.round((Date.now() - t0) / 1000), k }); return s; };
  while (Date.now() - t0 < 90_000) { await sample(); await page.waitForTimeout(1000); }
  const held = await sample();
  await page.screenshot({ path: shots + 'T74-held-buffering.png' });
  holding = false;
  for (const route of hung.splice(0)) await route.abort().catch(() => {});
  const t1 = Date.now();
  let back = null;
  while (Date.now() - t1 < 120_000) { if ((await sample()).playing) { back = (Date.now() - t1) / 1000; break; } await page.waitForTimeout(500); }
  if (back !== null) await expect.poll(() => videoPlaying(page), { timeout: 30_000 }).toBe(true);
  await page.screenshot({ path: shots + 'T74-after-release.png' });
  const after = await screenState(page);
  console.log('T74 U-H-9 forced', JSON.stringify({ back, before: before.players, held, after, trail }));
  expect(held.playing, 'the hold really kept VOD from playing').toBe(false);
  expect(held.players, 'T73 replaced the stalled player while held').toBeGreaterThan(before.players);
  expect(back, `seconds from release to playing; trail ${trail.map(e => e.t + 's ' + e.k).join(' → ')}`).not.toBeNull();
  expect(back).toBeLessThan(60);
  expect(after).toMatchObject({ source: 'vod', playing: true, notice: '' });
  expect(await page.locator('#arena-screen-player iframe').count()).toBe(1);
  expect(errors).toEqual([]);
});
