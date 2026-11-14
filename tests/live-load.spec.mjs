import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const shots = '_workspace/_run/2026-11-12-requirements-build/screens';
const phase = process.env.T62_CAPTURE_PHASE || 'after';
test.use({ viewport: process.env.T62_HEADED === '1' ? { width: 1600, height: 900 } : { width: 1920, height: 1080 }, ...(process.env.T62_HEADED === '1' ? {
  headless: false, launchOptions: { args: [`--window-position=${process.env.T62_WINDOW_POSITION}`] },
} : {}) });

async function openArena(page, { arrival = false } = {}) {
  // Install before the app and the timer recorder; later changes only advance the chosen round.
  await page.clock.setFixedTime(Date.parse('2026-11-13T04:10:30Z'));
  const network = [], errors = [];
  if (process.env.T62_HEADED === '1') {
    const session = await page.context().newCDPSession(page);
    const { windowId } = await session.send('Browser.getWindowForTarget');
    const [left, top] = process.env.T62_WINDOW_POSITION.split(',').map(Number);
    await session.send('Browser.setWindowBounds', { windowId, bounds: { left, top, width: 1680, height: 1000 } });
    console.log('T62 headed bounds', (await session.send('Browser.getWindowBounds', { windowId })).bounds);
    await session.detach();
  }
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => {
    if (/youtube|googlevideo|ytimg/.test(request.url())) network.push({ url: request.url(), failure: request.failure()?.errorText });
  });
  page.on('response', response => {
    if (/iframe_api|www-widgetapi/.test(response.url())) network.push({ url: response.url(), status: response.status() });
  });
  await page.addInitScript(() => {
    window.liveLoad = { timers: [], scripts: [], longTasks: [], states: [] };
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) liveLoad.longTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: 'longtask', buffered: true });
    const schedule = window.setTimeout.bind(window), cancel = window.clearTimeout.bind(window), timers = new Map();
    window.setTimeout = (callback, delay, ...args) => {
      if (delay !== 15000 || typeof callback !== 'function') return schedule(callback, delay, ...args);
      const record = { start: performance.now(), ready: window.arena?.ready, callback: String(callback) };
      liveLoad.timers.push(record);
      const id = schedule(() => { record.fired = performance.now(); callback.apply(window, args); }, delay);
      timers.set(id, record); return id;
    };
    window.clearTimeout = id => {
      if (timers.has(id)) timers.get(id).cleared = performance.now();
      cancel(id);
    };
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.tagName !== 'SCRIPT' || !/iframe_api|www-widgetapi/.test(node.src)) continue;
        const entry = { url: node.src, start: performance.now(), ready: window.arena?.ready };
        liveLoad.scripts.push(entry);
        for (const event of ['load', 'error']) node.addEventListener(event, () => { entry[event] = performance.now(); });
      }
    }).observe(document, { childList: true, subtree: true });
    const poll = setInterval(() => {
      if (window.arena?.ready && !liveLoad.ready) liveLoad.ready = performance.now();
      if (window.YT?.Player && !liveLoad.apiReady) liveLoad.apiReady = performance.now();
      const screen = window.arena?.screen;
      if (screen && liveLoad.states.at(-1)?.status !== screen.state.status) {
        liveLoad.states.push({ at: performance.now(), ...screen.state });
      }
    }, 100);
    addEventListener('pagehide', () => clearInterval(poll));
  });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      for(const entry of modules){const original=entry.create;entry.create=ctx=>{
        if(!window.liveLoadContext){
          window.liveLoadContext=ctx;
          const render=ctx.renderer.render.bind(ctx.renderer);
          ctx.renderer.render=(...args)=>{
            if(window.arena.ready&&!liveLoad.firstRender){
              liveLoad.firstRender={start:performance.now()};
              const value=render(...args);liveLoad.firstRender.end=performance.now();return value;
            }
            return render(...args);
          };
        }
        return original(ctx);
      };}` });
  });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // T71b/FX2: loading waits for the character before app:enter (T73), and entry applies the chosen showtime.
  // Follow the user flow: enter once the character is ready, check the screen took the chosen showtime, then go 30 s into it.
  await page.waitForFunction(() => window.arena?.ready && window.arena.screen && arena.character?.ready, null, { timeout: 120_000 });
  expect(await page.locator('#arena-screen-player iframe').count()).toBe(0);
  const showtime = Number(await page.locator('#showtimes button[aria-pressed="true"]').getAttribute('data-showtime'));
  await page.locator('#enter').click();
  expect(await page.evaluate(() => arena.screen.roundStart)).toBe(showtime);
  await page.clock.setFixedTime(showtime + 30_000);
  await page.evaluate(arrival => {
    if (arrival) { arena.go('arena'); return; }
    const { THREE, root, cameraRig } = liveLoadContext;
    const mesh = root.getObjectByName('REF_Jumbotron_0'), center = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const normal = new THREE.Vector3(center.x, 0, center.z).normalize();
    cameraRig.setOverride(camera => { camera.fov = 45; camera.updateProjectionMatrix(); camera.position.copy(center).addScaledVector(normal, 10); camera.lookAt(center); });
  }, arrival);
  return { network, errors };
}

async function evidence(page, testInfo, name, network) {
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/T62-${name}${process.env.T62_HEADED === '1' ? '-headed' : ''}-${phase}.png` });
  const data = await page.evaluate(() => {
    const gl = liveLoadContext.renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      ...liveLoad, state: arena.screen.state, metrics: { ...arena.state, ...liveLoadContext.renderer.info.memory },
      gpu: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      resources: performance.getEntriesByType('resource').filter(entry => /arena-v2|iframe_api|www-widgetapi/.test(entry.name)).map(entry => ({ url: entry.name, start: entry.startTime, end: entry.responseEnd })),
      iframe: document.querySelector('#arena-screen-player iframe')?.src,
    };
  });
  data.network = network;
  const frame = page.frames().find(frame => frame.url().includes('youtube.com/embed/'));
  data.video = frame ? await frame.evaluate(() => {
    const video = document.querySelector('video');
    return { time: video?.currentTime, paused: video?.paused, readyState: video?.readyState, decoded: video?.getVideoPlaybackQuality().totalVideoFrames, error: document.querySelector('.ytp-error-content-wrap')?.textContent };
  }).catch(error => ({ error: error.message })) : null;
  console.log(`T62 ${name}`, JSON.stringify(data));
  await testInfo.attach(`${name}-timing`, { body: JSON.stringify(data, null, 2), contentType: 'application/json' });
  return data;
}

test('T72: official video advances on arrival, with the screen behind, and below 200 projected pixels', async ({ page }) => {
  test.setTimeout(240_000);
  const { errors } = await openArena(page, { arrival: true });
  for (const view of ['arrival', 'behind', 'small']) {
    if (view !== 'arrival') await page.evaluate(view => {
      const { THREE, cameraRig } = liveLoadContext;
      const face = arena.screen.faces[0], center = new THREE.Vector3(...face.position), normal = new THREE.Vector3(...face.normal);
      cameraRig.setOverride(camera => {
        camera.position.copy(center).addScaledVector(normal, view === 'small' ? 100 : 20);
        camera.lookAt(view === 'behind' ? camera.position.clone().add(normal) : center);
      });
    }, view);
    await page.waitForTimeout(300);
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 65_000 }).toBe(true);
    const frame = page.frames().find(frame => frame.url().includes('youtube.com/embed/'));
    const before = await frame.evaluate(() => document.querySelector('video')?.currentTime ?? 0);
    await expect.poll(() => frame.evaluate(before => {
      const video = document.querySelector('video');
      return !!video && !video.paused && video.readyState >= 2 && video.currentTime > before + .5;
    }, before), { timeout: 20_000 }).toBe(true);
    const measured = await page.evaluate(() => {
      const iframe = document.querySelector('#arena-screen-player iframe'), r = iframe.getBoundingClientRect(), css = getComputedStyle(iframe);
      return { state: arena.screen.state, layout: [parseFloat(css.width), parseFloat(css.height)], height: r.height };
    });
    console.log('T72 official playback', JSON.stringify({ view, ...measured }));
    expect(measured.layout).toEqual([480, 270]);
    if (view === 'small') expect(measured.height).toBeLessThan(200);
  }
  for (const place of ['lobby', 'plaza']) {
    await page.evaluate(place => { liveLoadContext.cameraRig.setOverride(null); arena.go(place); }, place);
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(false);
  }
  expect(errors).toEqual([]);
});

for (const failFirst of [false, true]) {
  const name = failFirst ? 'api-retry' : 'live-load';
  test(`T62 ${name}: full arena loads the scheduled VOD iframe and plays${failFirst ? ' after one API request failure' : ''}`, async ({ page }, testInfo) => {
    test.setTimeout(210_000);
    let requests = 0;
    if (failFirst) await page.route('https://www.youtube.com/iframe_api', route => ++requests === 1 ? route.abort('internetdisconnected') : route.continue());
    const { network, errors } = await openArena(page);
    let measured;
    try {
      await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 65_000 }).toBe(true);
    } finally {
      measured = await evidence(page, testInfo, name, network);
    }
    expect(measured.timers.length).toBeGreaterThan(0);
    expect(measured.timers[0].start).toBeGreaterThanOrEqual(measured.firstRender.end);
    expect(measured.timers[0].ready).toBe(true);
    await expect(page.locator('#arena-screen-player iframe')).toHaveAttribute('src', /youtube\.com\/embed\/rQTHR3aL0SE/);
    if (failFirst) expect(requests).toBeGreaterThanOrEqual(2);
    const frame = page.frames().find(frame => frame.url().includes('youtube.com/embed/'));
    await expect.poll(() => frame.evaluate(() => {
      const video = document.querySelector('video');
      return !!video && !video.paused && video.readyState >= 2 && video.getVideoPlaybackQuality().totalVideoFrames > 0;
    }), { timeout: 15_000 }).toBe(true);
    expect(errors).toEqual([]);
  });
}
