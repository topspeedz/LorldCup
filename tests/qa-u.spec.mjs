import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// T66 re-check U: user-found U-H-1 (live screen, BL-0016) and the user's screen changes U-5 (always on, volume only),
// U-6 (big 16:9 screen filled by the player), U-7 (seated camera close to the screen).
// User conditions: whole app (arena-v2) loaded, 1920x1080. U-H-2, U-3, U-4 are T69's (tests/qa-u1.spec.mjs).
const shots = '_workspace/_run/2026-11-12-requirements-build/screens/';
const seatsConfig = JSON.parse(readFileSync(new URL('../web/config/seats.json', import.meta.url), 'utf8'));
// T64 baseline (user's request time: original screen + 36° camera) at 1280x720, from T68 report 21_…_v1.md.
const T64_HEIGHT = { [seatsConfig.seats[0].id]: 238.15, [seatsConfig.seats.find(seat => seat.position[2] > 0).id]: 367.76 };
const OLD_SCREEN_HEIGHT_M = 4.2696; // T67 report: the old YouTube area 7.5904 × 4.2696 m
const roundStart = Date.parse('2026-11-13T04:10:00Z');
test.setTimeout(300_000);

async function openApp(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  // Expose the module context only (same probe as tests/qa-u1.spec.mjs); the app still loads in full.
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const entry=modules.find(m=>m.path==='seat-mode.js'),original=entry.create;
      entry.create=ctx=>{window.uProbe={ctx};return original(ctx);};` });
  });
  // Enter a started showtime; installing the clock after entry resets the audio listener's elapsed time.
  await page.clock.setFixedTime(roundStart + 30_000);
  await page.goto(`/?b=final&t=${roundStart}`);
  await page.waitForFunction(() => window.arena?.ready && window.arena.screen && window.arena.character?.ready, null, { timeout: 180_000 });
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
  await page.evaluate(() => arena.go('arena'));
  return errors;
}

// What the user sees right after arriving at the arena spot (no turning). T71: the user's decision
// "B로 해줘 생동감있께 영상은 그냥 원래 항상 틀려있는것이 목표" — inside the arena it plays here too (was: U3 visibility rule).
const arrivalState = async page => {
  await page.waitForFunction(() => arena.screen.state.playing, null, { timeout: 90_000 }).catch(() => {});
  return screenState(page);
};
// Turn toward the hanging screen from the arena spot, like a user who looks up at it (same pitch approach as qa-a seat test).
const lookAtScreen = page => page.evaluate(() => {
  const { player, cameraRig } = uProbe.ctx, [x, y, z] = [arena.state.x, arena.state.y, arena.state.z];
  const faces = arena.screen.faces, c = faces.reduce((a, f) => a.map((v, i) => v + f.position[i] / faces.length), [0, 0, 0]);
  player.teleport([x, y, z, Math.atan2(-(c[0] - x), -(c[2] - z))]);
  const pitch = Math.atan2(c[1] - y - 1.45, Math.hypot(c[0] - x, c[2] - z));
  cameraRig.rotate(0, -(pitch + .2) / .002);
});

const screenState = page => page.evaluate(() => {
  const s = arena.screen, iframe = document.querySelector('#arena-screen-player iframe'), r = s.element.getBoundingClientRect();
  const notice = document.querySelector('#arena-screen-notice');
  return { ...s.state, iframe: iframe?.src ?? null, notice: notice.hidden ? '' : notice.textContent, rect: [r.left, r.top, r.width, r.height].map(Math.round) };
});
const videoPlaying = page => {
  const frame = page.frames().find(f => f.url().includes('youtube.com/embed/'));
  return frame ? frame.evaluate(() => { const v = document.querySelector('video'); return !!v && !v.paused && v.readyState >= 2; }).catch(() => false) : false;
};

for (const failFirst of [false, true]) {
  test(`U-H-1: after the first entry the arena screen plays the scheduled default VOD${failFirst ? ', recovering by itself from a failed first API request' : ''}`, async ({ page }) => {
    let requests = 0;
    if (failFirst) await page.route('https://www.youtube.com/iframe_api', route => ++requests === 1 ? route.abort('internetdisconnected') : route.continue());
    const errors = await openApp(page);
    const arrival = await arrivalState(page);
    console.log(`T66 U-H-1 arrival ${failFirst ? 'retry' : 'default'}`, JSON.stringify({ requests, ...arrival }));
    await page.screenshot({ path: shots + `T66-U-H-1-${failFirst ? 'api-retry' : 'default'}-arrival.png` });
    await lookAtScreen(page);
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 90_000 }).toBe(true);
    await expect.poll(() => videoPlaying(page), { timeout: 20_000 }).toBe(true);
    const s = await screenState(page);
    console.log(`T66 U-H-1 ${failFirst ? 'retry' : 'default'}`, JSON.stringify({ requests, ...s }));
    await page.screenshot({ path: shots + `T66-U-H-1-${failFirst ? 'api-retry' : 'default'}-facing.png` });
    expect(arrival.iframe ?? '', 'the scheduled iframe exists right after arriving').toMatch(/youtube\.com\/embed\//);
    expect(arrival.status, 'no load error after arriving').not.toBe('error');
    expect(arrival.playing, 'T71: plays at the default arrival view without looking up').toBe(true);
    expect(s.source).toBe('vod');
    expect(s.iframe).toMatch(/youtube\.com\/embed\//);
    if (failFirst) expect(requests).toBeGreaterThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}

test('U-5: settings keep sound and volume, with source switching only through the test API', async ({ page }) => {
  const errors = await openApp(page);
  await lookAtScreen(page);
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 90_000 }).toBe(true);
  const controls = page.getByRole('group', { name: '스크린 영상' });
  await expect(page.locator('#settings > #arena-screen-controls')).toHaveCount(1);
  await expect(controls.getByRole('button', { name: /소리 (켜기|끄기)/ })).toHaveCount(1);
  const buttons = await controls.getByRole('button').allTextContents();
  const log = [];
  for (const source of ['vod', 'live', 'vod', 'live']) {
    await page.evaluate(source => arena.screen.setSource(source), source);
    await page.waitForTimeout(300);
    const seen = [], t0 = Date.now(); // T71: keep the states a stalled switch went through
    await expect.poll(async () => { const s = await screenState(page), k = `${Math.round((Date.now() - t0) / 1000)}s ${s.status} ${s.notice}`;
      if (!seen.length || !seen.at(-1).endsWith(`${s.status} ${s.notice}`)) seen.push(k); return s.playing; }, { timeout: 60_000 }).toBe(true)
      .catch(error => { console.log('T71 U-5 stalled', source, JSON.stringify(seen)); throw error; });
    log.push({ source, ...await screenState(page) });
  }
  // A pause from anywhere (the official player's own control, or the API) must not leave the screen stopped.
  await page.evaluate(() => arena.screen.pause());
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 30_000 }).toBe(true);
  await controls.getByRole('slider', { name: '영상 음량' }).fill('40');
  const volume = await page.evaluate(() => document.querySelector('#settings > #arena-screen-controls input[type=range]').value);
  console.log('T66 U-5', JSON.stringify({ buttons, volume, log: log.map(({ source, playing, status }) => ({ source, playing, status })) }));
  await controls.screenshot({ path: shots + 'T66-U-5-controls.png' });
  for (const name of buttons) expect(name).not.toMatch(/재생|정지|일시|play|pause/i);
  await expect(controls.getByRole('combobox', { name: '영상 선택' })).toHaveCount(0);
  await expect(controls.getByRole('slider', { name: '영상 음량' })).toBeVisible();
  expect(volume).toBe('40');
  // T71: the volume change can catch a short buffering; record it, then judge after playback or the automatic retry (cap 45 s).
  const atVolume = await screenState(page);
  const settledPlaying = await page.waitForFunction(() => arena.screen.state.playing, null, { timeout: 45_000 }).then(() => true, () => false);
  console.log('T71 U-5 after volume', JSON.stringify({ status: atVolume.status, playing: atVolume.playing, notice: atVolume.notice, settledPlaying }));
  expect(settledPlaying, `${atVolume.status} ${atVolume.notice}`).toBe(true);
  expect(errors).toEqual([]);
});

test('U-6: the four screen faces are 16:9, about twice the old size, and the player fills a face without crop or stretch', async ({ page }) => {
  const errors = await openApp(page);
  await lookAtScreen(page);
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 90_000 }).toBe(true);
  const m = await page.evaluate(() => {
    const el = arena.screen.element, iframe = el.querySelector('iframe'), e = el.getBoundingClientRect(), f = iframe.getBoundingClientRect();
    return { faces: arena.screen.faces.map(({ name, width, height }) => ({ name, width, height })),
      element: [el.offsetWidth, el.offsetHeight], iframe: [iframe.offsetWidth, iframe.offsetHeight],
      onScreen: [Math.round(e.width), Math.round(e.height)], iframeOnScreen: [Math.round(f.width), Math.round(f.height)], viewport: [innerWidth, innerHeight] };
  });
  console.log('T66 U-6', JSON.stringify(m));
  await page.screenshot({ path: shots + 'T66-U-6-default-arena.png' });
  expect(m.faces).toHaveLength(4);
  for (const face of m.faces) {
    expect(face.width / face.height, face.name).toBeCloseTo(16 / 9, 2);
    expect(face.height / OLD_SCREEN_HEIGHT_M, face.name).toBeGreaterThan(1.9);
  }
  expect(m.element[0] / m.element[1]).toBeCloseTo(16 / 9, 2); // the player box mapped onto the face has the face's ratio
  expect(m.iframe).toEqual(m.element); // the official iframe fills that box
  expect(Math.abs(m.iframeOnScreen[0] - m.onScreen[0])).toBeLessThanOrEqual(1);
  expect(Math.abs(m.iframeOnScreen[1] - m.onScreen[1])).toBeLessThanOrEqual(1);
  expect(errors).toEqual([]);
});

test('U-7: seated on both sides of the entrance the screen is close: whole, playing, 200px+ and larger than T64', async ({ page }) => {
  const errors = await openApp(page);
  const results = [];
  for (const id of Object.keys(T64_HEIGHT)) {
    const seat = seatsConfig.seats.find(s => s.id === id);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(seat => {
      const { player } = uProbe.ctx, [x, y, z] = seat.position;
      const approach = [x, y, z - Math.sign(z) * 1.2, Math.atan2(-x, -z)];
      approach[1] = player.groundAt(approach[0], approach[2], y);
      player.teleport(approach);
    }, seat);
    await page.keyboard.press('KeyE'); // E remains available with the cursor visible
    await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(id);
    for (const [w, h] of [[1920, 1080], [1280, 720]]) {
      await page.setViewportSize({ width: w, height: h });
      await page.waitForTimeout(1500);
      await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 60_000 }).toBe(true);
      const s = await screenState(page);
      const [left, top, width, height] = s.rect;
      results.push({ id, viewport: [w, h], rect: s.rect, playing: s.playing, inside: left >= -1 && top >= -1 && left + width <= w + 1 && top + height <= h + 1 });
      if (w === 1920) await page.screenshot({ path: shots + `T66-U-7-${id}-seated.png` });
    }
    await page.getByRole('button', { name: /^일어나기/ }).click(); // T30 label '일어나기 (E)'
    await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(null);
  }
  console.log('T66 U-7', JSON.stringify(results));
  for (const r of results) {
    const key = `${r.id} ${r.viewport}`;
    expect(r.playing, key).toBe(true);
    expect(r.inside, key).toBe(true);
    expect(r.rect[3], key).toBeGreaterThanOrEqual(200);
    if (r.viewport[0] === 1280) expect(r.rect[3], key).toBeGreaterThan(T64_HEIGHT[r.id]);
  }
  expect(errors).toEqual([]);
});
