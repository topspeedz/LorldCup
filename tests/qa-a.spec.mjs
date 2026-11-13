// T42 QA A: screen YouTube (VOD round sync, live), Full Mode and seat in the integrated app with the official player.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const screenConfig = JSON.parse(readFileSync(new URL('../web/config/screen.json', import.meta.url), 'utf8'));
const seats = JSON.parse(readFileSync(new URL('../web/config/seats.json', import.meta.url), 'utf8'));
const SHOTS = '_workspace/_run/2026-11-12-requirements-build/screens/';
const interval = screenConfig.roundIntervalMinutes * 60_000;

async function openApp(page, { fakeFullscreen = true } = {}) {
  await page.clock.setFixedTime(Date.parse('2026-11-13T04:10:30Z'));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (fakeFullscreen) await page.addInitScript(() => {
    // Headless Chromium has no real fullscreen; keep the browser contract (events, elements).
    let full = null;
    const fire = name => document.dispatchEvent(new Event(name));
    Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get: () => full });
    Element.prototype.requestFullscreen = function () { full = this; fire('fullscreenchange'); return Promise.resolve(); };
    Document.prototype.exitFullscreen = function () { full = null; fire('fullscreenchange'); return Promise.resolve(); };
  });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      window.qaA={sent:[]};
      for(const entry of modules){const original=entry.create;entry.create=ctx=>{qaA.ctx=ctx;const instance=original(ctx);qaA[entry.path]=instance;return instance;};}` });
  });
  await page.setViewportSize({ width: 960, height: 640 });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready && window.arena.screen, null, { timeout: 120_000 });
  await page.locator('#enter').click();
  await page.clock.setFixedTime(await page.evaluate(() => arena.screen.roundStart + 30_000));
  return errors;
}

// Face the front jumbotron from 10 m like a spectator who looks at it.
async function faceScreen(page) {
  await page.evaluate(() => {
    const { THREE, root, cameraRig } = qaA.ctx;
    const mesh = root.getObjectByName('REF_Jumbotron_0'), center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const normal = new THREE.Vector3(center.x, 0, center.z).normalize();
    cameraRig.setOverride(camera => { camera.fov = 45; camera.updateProjectionMatrix(); camera.position.copy(center).addScaledVector(normal, 10); camera.lookAt(center); });
  });
}

const settled = page => page.waitForFunction(() => arena.screen.state.playing || ['error', 'ended', 'blocked'].includes(arena.screen.state.status), null, { timeout: 45_000 }).catch(() => {});
const snapshot = async page => {
  const state = await page.evaluate(() => {
    const s = arena.screen, iframe = document.querySelector('#arena-screen-player iframe');
    return { ...s.state, roundStart: s.roundStart, now: Date.now(), notice: document.querySelector('#arena-screen-notice')?.hidden ? '' : document.querySelector('#arena-screen-notice')?.textContent,
      visible: getComputedStyle(s.element).visibility, aperture: qaA.ctx.scene.getObjectByName('ScreenVideoAperture').visible,
      start: iframe ? new URL(iframe.src).searchParams.get('start') : null };
  });
  const frame = page.frames().find(frame => frame.url().includes('youtube.com/embed/'));
  const media = frame ? await frame.evaluate(() => {
    const video = document.querySelector('video');
    return video ? { time: video.currentTime, paused: video.paused, ready: video.readyState, network: video.networkState,
      error: video.error ? { code: video.error.code, message: video.error.message } : null } : null;
  }).catch(() => null) : null;
  return { ...state, media };
};

test('A screen VOD: a joined past round seeks, becoming solo keeps playback, and an ended round waits for room:round', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await page.route('**/config/screen.json', route => route.fulfill({ json: { ...screenConfig, source: 'vod' } }));
  const errors = await openApp(page);
  await faceScreen(page);
  const log = [];
  await settled(page);
  const vod = await snapshot(page);vod.expected = (vod.now - vod.roundStart) / 1000;
  log.push({ step: 'vod', ...vod });
  const current = await page.evaluate(() => arena.screen.roundStart);
  await page.evaluate(start => qaA.ctx.events.dispatchEvent(new CustomEvent('room:joined', { detail: { code: 'qa', host: true, roundStart: start } })), current - interval);
  await page.waitForTimeout(4000);
  const past = await snapshot(page);past.expected = (past.now - past.roundStart) / 1000;
  log.push({ step: 'room-past-round', ...past });
  await page.evaluate(() => qaA.ctx.events.dispatchEvent(new CustomEvent('room:state', { detail: { key: 'qa', count: 1, host: true, phase: 'solo' } })));
  await page.waitForTimeout(500);
  const solo = await snapshot(page);solo.expected = (solo.now - solo.roundStart) / 1000;
  log.push({ step: 'room-solo', ...solo });
  const yt = page.frames().find(frame => frame.url().includes('youtube.com/embed/'));
  const duration = yt ? await yt.evaluate(() => document.querySelector('video')?.duration).catch(() => null) : null;
  log.push({ step: 'duration', duration });
  const start = Math.floor(((await page.evaluate(() => Date.now())) - ((duration || 3600) + 60) * 1000) / interval) * interval;
  await page.evaluate(s => qaA.ctx.events.dispatchEvent(new CustomEvent('room:joined', { detail: { code: 'qa2', host: false, roundStart: s } })), start);
  await page.waitForFunction(() => arena.screen.state.status === 'ended', null, { timeout: 20_000 }).catch(() => {});
  const ended = await snapshot(page);
  log.push({ step: 'room-ended', ...ended });
  await page.screenshot({ path: testInfo.outputPath('vod-ended.png') });
  await page.evaluate(() => qaA.ctx.events.dispatchEvent(new CustomEvent('room:state', { detail: { key: 'qa2', count: 1, host: true, phase: 'solo' } })));
  expect((await snapshot(page)).status).toBe('ended');
  await page.evaluate(roundStart => qaA.ctx.events.dispatchEvent(new CustomEvent('room:round', { detail: { roundStart } })), current);
  await page.waitForTimeout(500);await settled(page);
  const next = await snapshot(page);next.expected = (next.now - next.roundStart) / 1000;
  log.push({ step: 'room-next-round', ...next });
  console.log('QA-A vod', JSON.stringify(log));
  const tolerance = screenConfig.syncToleranceSeconds + 1.5;
  expect(vod.roundStart).toBe(Math.floor(vod.now / interval) * interval);
  expect(vod.playing, vod.notice).toBe(true);
  expect(Math.abs(vod.time - vod.expected)).toBeLessThan(tolerance);
  expect(past.roundStart).toBe(current - interval);
  expect(past.playing, past.notice).toBe(true);
  expect(Math.abs(past.time - past.expected)).toBeLessThan(tolerance);
  expect(solo.roundStart).toBe(past.roundStart);
  expect(solo.playing, solo.notice).toBe(true);
  expect(Math.abs(solo.time - solo.expected)).toBeLessThan(tolerance);
  expect(ended).toMatchObject({ status: 'ended', playing: false, visible: 'hidden', aperture: false });
  expect(ended.notice).toContain('끝났습니다');
  expect(next.roundStart).toBe(current);
  expect(next.playing, next.notice).toBe(true);
  expect(Math.abs(next.time - next.expected)).toBeLessThan(tolerance);
  expect(errors).toEqual([]);
});

test('A-H-1 / T62 Medium: source test API plays all five switches without a source selector', async ({ page }) => {
  test.setTimeout(420_000);
  const mediaRequests = [];
  page.on('response', response => {
    const host = new URL(response.url()).hostname;
    if (host.endsWith('.googlevideo.com') && response.status() >= 400) mediaRequests.push({ host, status: response.status() });
  });
  page.on('requestfailed', request => {
    const host = new URL(request.url()).hostname;
    if (host.endsWith('.googlevideo.com')) mediaRequests.push({ host, error: request.failure()?.errorText });
  });
  const errors = await openApp(page);
  await faceScreen(page);
  await expect(page.getByRole('combobox', { name: '영상 선택' })).toHaveCount(0);
  await page.evaluate(() => arena.screen.setSource('live'));
  const log = [];
  await settled(page);
  log.push({ step: 'default', ...await snapshot(page) });
  for (const [i, source] of ['vod', 'live', 'vod', 'live', 'vod'].entries()) {
    await page.evaluate(source => arena.screen.setSource(source), source);
    await page.waitForTimeout(300);await settled(page);
    const s = await snapshot(page);log.push({ step: `${i}-${source}`, ...s });
    if (!s.playing) { // T66: the buttons are gone (T67); record whether the automatic retry recovers
      await page.waitForFunction(() => arena.screen.state.playing, null, { timeout: 60_000 }).catch(() => {});
      log.push({ step: `${i}-${source}-auto`, ...await snapshot(page) });
    }
  }
  console.log('QA-A switch', JSON.stringify(log.map(({ step, playing, status, time, notice, media }) => ({ step, playing, status, time, notice, media }))));
  console.log('QA-A media requests', JSON.stringify(mediaRequests));
  await page.screenshot({ path: SHOTS + 'T52-A-H-1-switched-playing.png' });
  // T52 recheck: every switch (live too) plays without any fallback. T66: the filter now matches the real steps (0-vod … 4-vod).
  const switched = log.filter(e => /^\d-(vod|live)$/.test(e.step));
  expect(switched.map(e => e.step)).toEqual(['0-vod', '1-live', '2-vod', '3-live', '4-vod']);
  for (const e of switched) expect(e.playing, `${e.step} ${e.notice}`).toBe(true);
  // T52 recheck: force the delay notice by blocking video data on a switch; T66: the same player must then revive by itself (no 다시 재생 button since T67).
  const recover = [];
  for (const source of ['live', 'vod']) {
    await page.route(/googlevideo.com/, route => route.abort());
    await page.evaluate(source => arena.screen.setSource(source), source);
    await page.waitForFunction(() => arena.screen.state.status === 'error', null, { timeout: 40_000 }).catch(() => {});
    const failed = await snapshot(page);
    await page.unroute(/googlevideo.com/);
    await page.waitForFunction(() => arena.screen.state.playing, null, { timeout: 90_000 }).catch(() => {});
    const revived = await snapshot(page);
    recover.push({ source, failed: { status: failed.status, notice: failed.notice }, revived: { playing: revived.playing, status: revived.status, notice: revived.notice } });
    if (source === 'vod') await page.screenshot({ path: SHOTS + 'T52-A-H-1-retry-playing.png' });
  }
  console.log('QA-A recover', JSON.stringify(recover));
  for (const r of recover) { expect(r.failed.status, r.source).toBe('error'); expect(r.revived.playing, `${r.source} ${r.revived.notice}`).toBe(true); }
  expect(errors).toEqual([]);
});

test('A Full Mode: F/button/close/Esc cover the window with the same playing player and return to the walking controls', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await openApp(page);
  await page.evaluate(() => arena.screen.setSource('vod'));
  await expect.poll(() => page.evaluate(() => qaA.ctx.input.walking)).toBe(true);
  const full = async () => {
    await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
    await page.waitForTimeout(1500);
    // T71: judge after playback is ready or the automatic retry (15 s buffering → 3 s) has recovered; still fails after 45 s.
    await page.waitForFunction(() => arena.screen.state.playing, null, { timeout: 45_000 }).catch(() => {});
    return page.evaluate(() => {
      const frame = document.querySelector('#arena-screen-player iframe'), r = frame.getBoundingClientRect();
      const top = [[.25, .25], [.5, .5], [.75, .75]].map(([x, y]) => document.elementFromPoint(r.left + r.width * x, r.top + r.height * y) === frame);
      return { frame: !!frame, cover: Math.max(r.width / innerWidth, r.height / innerHeight), top, fullscreen: document.fullscreenElement?.id ?? null,
        walking: qaA.ctx.input.walking, state: arena.screen.state, close: !document.querySelector('#arena-screen-controls button:last-child').hidden, avatar: arena.player.toArray() };
    });
  };
  const back = async () => {
    await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(false);
    await expect.poll(() => page.evaluate(() => qaA.ctx.input.walking)).toBe(true);
    return page.evaluate(() => ({ fullscreen: document.fullscreenElement, full: document.querySelector('#css-layer').hasAttribute('data-screen-full') }));
  };
  const before = await page.evaluate(() => arena.player.toArray());
  const results = {};
  await page.keyboard.press('KeyF');
  results.f = await full();
  await page.screenshot({ path: testInfo.outputPath('full-mode.png') });
  await page.keyboard.press('KeyF');
  results.fBack = await back();
  await page.keyboard.press('KeyF');
  results.f2 = await full();
  await page.keyboard.press('Escape');
  results.escBack = await back();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.getByRole('button', { name: 'Full Mode' }).click();
  results.button = await full();
  await page.getByRole('button', { name: 'Full Mode 닫기' }).click();
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(false);
  results.closeWalking = await page.evaluate(() => qaA.ctx.input.walking);
  await page.keyboard.down('KeyW');await page.waitForTimeout(600);await page.keyboard.up('KeyW');
  results.moved = await page.evaluate(b => arena.player.distanceTo(new qaA.ctx.THREE.Vector3(...b)), before);
  console.log('QA-A full', JSON.stringify(results));
  for (const k of ['f', 'f2', 'button']) {
    expect(results[k].frame).toBe(true);
    expect(results[k].cover).toBeGreaterThan(.9);
    expect(results[k].top).toEqual([true, true, true]);
    expect(results[k].fullscreen).toBe('css-layer');
    expect(results[k].close).toBe(true);
  }
  expect(results.f.avatar).toEqual(before);
  for (const k of ['fBack', 'escBack']) expect(results[k]).toEqual({ fullscreen: null, full: false });
  expect(results.closeWalking).toBe(true);
  expect(results.moved).toBeGreaterThan(.1);
  expect(errors).toEqual([]);
});

test('A seat: E sits on a configured seat, the playing screen is larger at 45°, F works seated, E and movement stand', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await openApp(page);
  await page.evaluate(() => arena.screen.setSource('vod'));
  // Approach the first seat facing the screen (same approach as seat.spec).
  await page.evaluate(seat => {
    const { THREE, root, player, cameraRig } = qaA.ctx, [x, y, z] = seat.position;
    const approach = [x, y, z - Math.sign(z) * 1.2, Math.atan2(x, z)];
    approach[1] = player.groundAt(approach[0], approach[2], y);
    player.teleport(approach);
    const screen = new THREE.Box3();
    for (let i = 0; i < 4; i++) screen.union(new THREE.Box3().setFromObject(root.getObjectByName('REF_Jumbotron_' + i)));
    const target = screen.getCenter(new THREE.Vector3());
    const pitch = Math.atan2(target.y - approach[1] - 1.45, Math.hypot(target.x - approach[0], target.z - approach[2]));
    cameraRig.rotate(0, -(pitch + .2) / .002);
  }, seats.seats[0]);
  await page.waitForTimeout(1000);
  const area = () => page.evaluate(() => {
    const { THREE, root, camera } = qaA.ctx;camera.updateMatrixWorld(true);
    return Math.max(...[0, 1, 2, 3].map(i => {
      const mesh = root.getObjectByName('REF_Jumbotron_' + i), a = mesh.geometry.attributes.position, p = new THREE.Vector3();
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let j = 0; j < a.count; j++) { p.fromBufferAttribute(a, j).applyMatrix4(mesh.matrixWorld).project(camera);x0 = Math.min(x0, p.x);x1 = Math.max(x1, p.x);y0 = Math.min(y0, p.y);y1 = Math.max(y1, p.y); }
      return Math.max(0, Math.min(1, x1) - Math.max(-1, x0)) * Math.max(0, Math.min(1, y1) - Math.max(-1, y0));
    }));
  });
  const standing = { area: await area(), fov: await page.evaluate(() => qaA.ctx.camera.fov), pos: await page.evaluate(() => arena.player.toArray()) };
  await expect.poll(() => page.evaluate(() => !document.querySelector('#seat-toggle').hidden || document.querySelector('#seat-hint')?.hidden === false)).toBe(true); // T30: button with a free cursor, key hint while walking
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seats.seats[0].id);
  await page.waitForTimeout(4000);
  const seated = await page.evaluate(() => ({ fov: qaA.ctx.camera.fov, eye: qaA.ctx.camera.position.y, screen: arena.screen.state, face: arena.screen.face,
    iframe: (r => r.width * r.height)(document.querySelector('#arena-screen-player').getBoundingClientRect()) }));
  seated.area = await area();
  await page.screenshot({ path: testInfo.outputPath('seated.png') });
  // A-H-2 probe: is the seated screen big enough to play at common window sizes?
  const viewports = [];
  for (const [w, h] of [[960, 640], [1280, 720], [1920, 1080]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(5000);
    await page.waitForFunction(() => arena.screen.state.playing, null, { timeout: 45_000 }).catch(() => {}); // T71: same 45 s cap as Full Mode
    viewports.push(await page.evaluate(([w, h]) => { const r = document.querySelector('#arena-screen-player').getBoundingClientRect();
      return { viewport: [w, h], rect: [Math.round(r.width), Math.round(r.height)], playing: arena.screen.state.playing, status: arena.screen.state.status }; }, [w, h]));
    if (w < 1920) await page.screenshot({ path: SHOTS + `T52-A-H-2-seated-${w}x${h}.png` });
  }
  await page.setViewportSize({ width: 960, height: 640 });
  await page.waitForTimeout(1000);
  await page.keyboard.press('KeyF');
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(false);
  const afterFull = await page.evaluate(() => ({ seatId: arena.seat.seatId, fov: qaA.ctx.camera.fov, walking: qaA.ctx.input.walking }));
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(null);
  const stood = await page.evaluate(() => ({ fov: qaA.ctx.camera.fov, pos: arena.player.toArray() }));
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seats.seats[0].id);
  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(null);
  await page.keyboard.up('KeyW');
  console.log('QA-A seat', JSON.stringify({ standing, seated, afterFull, stood, viewports }));
  expect(seated.fov).toBe(seats.camera.fov);
  expect(seated.eye).toBeCloseTo(seats.seats[0].position[1] + seats.camera.eyeHeight);
  expect(seated.area).toBeGreaterThan(standing.area);
  for (const v of viewports) expect(v.playing, `A-H-2 ${JSON.stringify(v)}`).toBe(true);
  for (const v of viewports) expect(v.rect[1], `A-H-2 height ${JSON.stringify(v)}`).toBeGreaterThanOrEqual(200);
  // T31 full-mode.md UX-F-R05·F-D3 (with seat.md S-D1): leaving Full Mode from a seat returns to the seated view with the cursor free.
  expect(afterFull).toEqual({ seatId: seats.seats[0].id, fov: seats.camera.fov, walking: false });
  expect(stood.fov).toBe(standing.fov);
  expect(stood.pos).toEqual(standing.pos);
  expect(errors).toEqual([]);
});
