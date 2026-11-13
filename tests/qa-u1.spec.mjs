import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// T69 re-check U1: user-found defects U-H-2 (cursor, BL-0023), U-3 (seats, BL-0019), U-4 (first-load cover).
// User conditions: whole app (arena-v2) loaded, 1920x1080.
const shots = '_workspace/_run/2026-11-12-requirements-build/screens/';
const seatsConfig = JSON.parse(readFileSync(new URL('../web/config/seats.json', import.meta.url), 'utf8'));
test.setTimeout(300_000);
test.beforeEach(({ page }) => page.setViewportSize({ width: 1920, height: 1080 }));

const ready = page => page.waitForFunction(() => window.arena?.ready && window.arena.character?.ready, null, { timeout: 180_000 });
const cursorState = page => page.evaluate(() => ({ locked: !!document.pointerLockElement,
  cursor: getComputedStyle(document.querySelector('canvas')).cursor, walking: arena.state.walking }));

test('U-4: first visit shows the first page; 들어가기 before ready is covered by the loading screen, then walks', async ({ page }) => {
  await page.goto('/');
  const cover = page.getByRole('dialog', { name: '경기장 로딩 중' });
  const enter = page.getByRole('button', { name: '들어가기', exact: true });
  await expect(enter).toBeEnabled();
  await page.screenshot({ path: shots + 'T69-U-4-first-page.png' });
  await enter.click();
  if (!(await page.evaluate(() => window.arena?.ready))) await expect(cover.getByRole('status')).toContainText('불러오는 중');
  await page.screenshot({ path: shots + 'T69-U-4-loading.png' });
  await expect(cover).toBeHidden({ timeout: 180_000 });
  await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
  await page.screenshot({ path: shots + 'T69-U-4-ready.png' });
});

test('U-H-2: cursor is visible after left/right drag release, button-free moves and entering walking', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
  const results = {};
  // Entering walking, then moving without a button.
  await page.mouse.move(900, 500);
  await page.mouse.move(960, 540);
  await expect.poll(() => cursorState(page)).toMatchObject({ locked: false, walking: true });
  results.afterWalkMove = await cursorState(page);
  for (const button of ['left', 'right']) {
    await page.mouse.move(960, 540);
    await page.mouse.down({ button });
    await page.mouse.move(1060, 560, { steps: 5 });
    results[`${button}During`] = await cursorState(page);
    await page.mouse.up({ button });
    await page.mouse.move(1070, 570);
    await expect.poll(() => cursorState(page)).toMatchObject({ locked: false });
    results[`${button}After`] = await cursorState(page);
  }
  // Native cursors are not captured in screenshots: overlay the measured state as evidence.
  await page.evaluate(r => {
    const p = document.createElement('pre');
    p.textContent = 'T69 U-H-2\n' + Object.entries(r).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
    p.style.cssText = 'position:fixed;left:12px;bottom:120px;z-index:9999;background:#fff;color:#000;padding:12px;font:16px monospace;pointer-events:none';
    document.body.append(p);
  }, results);
  console.log('T69 U-H-2', JSON.stringify(results));
  await page.screenshot({ path: shots + 'T69-U-H-2-cursor.png' });
  for (const key of ['afterWalkMove', 'leftDuring', 'leftAfter', 'rightDuring', 'rightAfter']) {
    expect(results[key].locked, key).toBe(false);
    expect(results[key].cursor, key).not.toBe('none');
    expect(results[key].walking, key).toBe(true);
  }
});

test('U-3: seat markers are on screen from the default arena view, highlight on approach, and you can sit', async ({ page }) => {
  // Expose the module context only (same probe as tests/seat.spec.mjs); the app still loads in full.
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const entry=modules.find(m=>m.path==='seat-mode.js'),original=entry.create;
      entry.create=ctx=>{window.u1Probe={ctx};return original(ctx);};` });
  });
  await page.goto('/');
  await ready(page);
  await page.locator('#enter').click(); // the seat button lives in the arena, after app:enter
  const sections = new Set(seatsConfig.seats.map(s => Math.sign(s.position[2])));
  expect(sections.size).toBeGreaterThanOrEqual(2);
  expect(seatsConfig.seats.every(s => s.id.startsWith('lower-'))).toBe(true);

  await page.evaluate(() => arena.go('arena'));
  await page.waitForTimeout(1500);
  const onScreen = await page.evaluate(() => {
    const { scene, camera, THREE } = u1Probe.ctx, markers = scene.getObjectByName('SeatMarkers');
    if (!markers) return { count: 0, ids: [] };
    camera.updateMatrixWorld();
    const ids = markers.children.filter(m => {
      if (!m.visible) return false;
      const p = m.getWorldPosition(new THREE.Vector3()).project(camera);
      return Math.abs(p.x) < 1 && Math.abs(p.y) < 1 && p.z < 1;
    }).map(m => m.name);
    return { count: ids.length, ids };
  });
  const pixels = await page.evaluate(() => {
    const { scene, renderer, camera } = u1Probe.ctx, markers = scene.getObjectByName('SeatMarkers');
    const gl = renderer.getContext(), { width, height } = renderer.domElement;
    const a = new Uint8Array(width * height * 4), b = new Uint8Array(a.length);
    renderer.render(scene, camera); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, a);
    markers.visible = false; renderer.render(scene, camera); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, b);
    markers.visible = true; renderer.render(scene, camera);
    let n = 0;
    for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 30) n++;
    return n;
  });
  await page.screenshot({ path: shots + 'T69-U-3-default.png' });
  console.log('T69 U-3 default view', JSON.stringify({ onScreen, pixels }));
  expect(onScreen.count).toBeGreaterThan(0);
  expect(pixels).toBeGreaterThan(100);

  const seat = seatsConfig.seats[0];
  await page.evaluate(seat => {
    const { player } = u1Probe.ctx, [x, y, z] = seat.position, t = Math.atan2(-z, x);
    const approach = [x - 1.2 * Math.cos(t), y, z + 1.2 * Math.sin(t), Math.atan2(-x, -z)];
    approach[1] = player.groundAt(approach[0], approach[2], y);
    player.teleport(approach);
  }, seat);
  const sitButton = page.getByRole('button', { name: '앉기', exact: true });
  await expect(sitButton).toBeVisible();
  const highlight = await page.evaluate(id => {
    const markers = u1Probe.ctx.scene.getObjectByName('SeatMarkers').children;
    const near = markers.find(m => m.name === id), other = markers.find(m => m.name !== id);
    return { nearScale: near.scale.x, otherScale: other.scale.x, nearColor: near.material.color.getHexString(), otherColor: other.material.color.getHexString() };
  }, seat.id);
  await page.screenshot({ path: shots + 'T69-U-3-near.png' });
  console.log('T69 U-3 highlight', JSON.stringify(highlight));
  expect(highlight.nearScale).toBeGreaterThan(highlight.otherScale);
  expect(highlight.nearColor).not.toBe(highlight.otherColor);

  await sitButton.click();
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seat.id);
  await expect(page.getByRole('button', { name: '일어나기', exact: true })).toBeVisible();
  await page.screenshot({ path: shots + 'T69-U-3-seated.png' });
});
