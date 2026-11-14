// Matched review views and one FPS sample per version, under gpu-run's exclusive lock.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { serve } from '../../../tests/serve.mjs';

const label = process.argv[2];
assert(['before', 'after'].includes(label));
const out = new URL('../../../temp/T75/', import.meta.url);
const views = [
  ['entrance', [-58, 2, 0], [-35, -7, 0]],
  ['panels', [-62, 2, 0], [-54, -1, 0]],
  ['screen', [-28, -6, 0], [0, 3, 0]],
  ['desks', [-10, -7.3, -9], [0, -8, -9]],
  ['upper', [-40, -2, 0], [50, 15, 0]],
  ['ramp-a', [0, 2, -52], [0, -9, -20]],
  ['ramp-b', [0, 2, 52], [0, -9, 20]],
  ['floor', [-22, -8.3, -20], [0, 3, 0]],
  ['seated', [-52.216487, 2.24, -5.134863], [0, 3.1, 0]],
  ['stairs', [-40, -3, -14], [-49, -1, -20]],
  ['exterior-inside', [-72, 2, -5], [-90, 9, -20]],
];
const server = await serve();
const browser = await chromium.launch({ channel: 'chromium', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 640 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const original = modules[0].create;
      modules[0].create = ctx => { window.t75ctx = ctx; return original(ctx); };` });
  });
  const started = Date.now();
  await page.goto(server.url);
  await page.waitForFunction(() => window.arena?.ready && window.t75ctx, null, { timeout: 180000 });
  const loadMilliseconds = Date.now() - started;
  await page.addStyleTag({ content: '#ui-root,#overlay,#menu,#loading-screen{visibility:hidden!important}' });
  const reviewStyle = await page.addStyleTag({ content: 'body > :not(canvas){visibility:hidden!important}' });
  await page.evaluate(() => { arena.crowd.setPaused(true); arena.crowd.seek(0); });
  for (const [name, position, target] of views) {
    await page.evaluate(({ position, target }) => {
      const { cameraRig, player } = t75ctx;
      player.position.fromArray(position).add({ x: 0, y: -1.7, z: 0 });
      cameraRig.setOverride(camera => { camera.position.fromArray(position); camera.lookAt(...target); player.avatar.visible = false; });
    }, { position, target });
    await page.waitForTimeout(600);
    await page.screenshot({ path: new URL(`${label}-${name}.png`, out).pathname.replace(/^\/(\w:)/, '$1') });
  }
  await reviewStyle.evaluate(element => element.remove());
  if (!process.argv.includes('--views-only')) {
  const measured = await page.evaluate(async () => {
    const { cameraRig, player, renderer, root } = t75ctx;
    player.position.set(-50, -3.4, 0);
    cameraRig.setOverride(camera => { camera.position.set(-50, -1.7, 0); camera.lookAt(0, 3.1, 0); });
    await new Promise(resolve => setTimeout(resolve, 3000));
    const intervals = [], start = performance.now();
    let previous = start;
    await new Promise(resolve => {
      function sample(now) {
        intervals.push(now - previous); previous = now;
        if (now - start >= 12000) resolve(); else requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
    });
    intervals.sort((a, b) => a - b);
    const render = { ...renderer.info.render };
    return { fps: intervals.length * 1000 / (previous - start), frames: intervals.length,
      milliseconds: previous - start, p95FrameMs: intervals[Math.floor(intervals.length * .95)],
      render, nodes: (() => { let n = 0; root.traverse(() => n++); return n; })(),
      baked: arena.lighting.baked, crowd: arena.crowd.stats ?? null };
  });
  const report = { label, loadMilliseconds, ...measured, viewport: [960, 640],
    screen: JSON.parse(readFileSync(new URL('../../../web/config/screen.json', import.meta.url))),
    crowdConfig: JSON.parse(readFileSync(new URL('../../../web/config/crowd.json', import.meta.url))), errors };
  writeFileSync(new URL(`${label}-browser.json`, out), JSON.stringify(report, null, 2));
  assert.deepEqual(errors, []);
  assert(measured.fps > 0 && measured.frames > 0);
  console.log('T75_BROWSER', JSON.stringify({ label, loadMilliseconds, ...measured, errors }));
  } else {
    assert.deepEqual(errors, []);
    console.log('T75_VIEWS_ONLY', label, views.length);
  }
} finally {
  await browser.close();
  await server.close();
}
