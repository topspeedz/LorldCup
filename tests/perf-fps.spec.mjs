import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import launcher from '../.claude/scripts/browser/launch.cjs';

test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  launchOptions: { args: launcher.gpuProfile().args } });
test.setTimeout(300_000);
const screens = resolve('_workspace/_run/2026-11-12-requirements-build/screens');
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

test('returning to the arena preserves the camera and foreground', async ({ page }, testInfo) => {
  const glErrors = [];
  page.on('console', message => { if (/WebGL|GL_INVALID|INVALID_OPERATION/.test(message.text())) glErrors.push(message.text()); });
  await page.addInitScript(() => { let seed = 59;Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      for(const entry of modules){const original=entry.create;entry.create=ctx=>{
        window.perfContext=ctx;const instance=original(ctx),update=instance.update?.bind(instance);
        if(update)instance.update=()=>update(0,0);return instance;
      };}` });
  });
  await page.goto('/');await page.waitForFunction(() => window.arena?.ready && arena.character?.ready, null, { timeout: 120_000 });
  await page.evaluate(() => { arena.crowd.setPaused(true);arena.crowd.seek(0);document.querySelector('#panel').style.display = 'none'; });
  const states = [];
  for (const [i, place] of ['arena', 'lobby', 'plaza', 'arena'].entries()) {
    await page.evaluate(place => { perfContext.cameraRig.setOverride(null);arena.go(place); }, place);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: testInfo.outputPath(`return-${i}-loop.png`) });
    states.push(await page.evaluate(() => {
      const { camera, scene, renderer, THREE } = perfContext, drawn = [];
      const probes = [];
      scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        const original = mesh.onBeforeRender;probes.push([mesh, original]);
        mesh.onBeforeRender = (...args) => { if(args[2]===camera)drawn.push(mesh.name);original.apply(mesh, args); };
      });
      renderer.render(scene, camera);for (const [mesh, original] of probes) mesh.onBeforeRender = original;
      return { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), near: camera.near, far: camera.far,
        avatar: { visible: arena.avatar.visible, position: arena.avatar.position.toArray(), bounds: new THREE.Box3().setFromObject(arena.avatar).min.toArray() },
        drawn: [...new Set(drawn)].filter(name => !/Audience|Static_RenderBatch/.test(name)) };
    }));
    await page.screenshot({ path: testInfo.outputPath(`return-${i}.png`) });
  }
  console.log('T59 return view', JSON.stringify(states.map(({ drawn, ...state }) => state)),
    'lost', JSON.stringify(states[0].drawn.filter(name => !states[3].drawn.includes(name))), 'WebGL messages', JSON.stringify(glErrors));
  expect(states[3].position).toEqual(states[0].position);
  expect(states[3].quaternion).toEqual(states[0].quaternion);
  expect(states[3].avatar.visible).toBe(true);
  expect(states[0].drawn.filter(name => !states[3].drawn.includes(name))).toEqual([]);
});

test('arena and lobby sustain median 60 FPS at 1920x1080 DPR 1 on hardware D3D11', async ({ page }, testInfo) => {
  const errors = [], results = {}, capture = process.env.PERF_CAPTURE;
  let frozen = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/THREE.WebGLProgram: Shader Error/.test(message.text())) errors.push(message.text()); });
  await page.addInitScript(() => {
    let seed = 59;
    Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
  });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      for(const entry of modules){const original=entry.create;entry.create=ctx=>{
        window.perfContext=ctx;const instance=original(ctx),update=instance.update?.bind(instance);
        if(update)instance.update=(dt,now)=>update(${frozen ? '0,0' : 'dt,now'});return instance;
      };}` });
  });
  const open = async () => {
    await page.goto('/');
    await page.waitForFunction(() => window.arena?.ready && arena.character?.ready, null, { timeout: 120_000 });
  };
  await open();
  const gpu = await page.evaluate(() => {
    const { renderer } = perfContext, gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, dpr: renderer.getPixelRatio() };
  });
  expect(gpu).toMatchObject({ width: 1920, height: 1080, dpr: 1 });
  expect(gpu.renderer).toMatch(/ANGLE.*Direct3D11/i);
  expect(gpu.renderer).not.toMatch(/SwiftShader|software|llvmpipe/i);
  for (const place of ['arena', 'lobby']) {
    await page.evaluate(place => arena.go(place), place);
    await page.waitForTimeout(5000);
    results[place] = await page.evaluate(async () => {
      const samples = [];
      for (let round = 0; round < 3; round++) {
        const intervals = [];
        let start, last;
        await new Promise(resolve => {
          const frame = now => {
            if (start === undefined) start = now;
            else intervals.push(now - last);
            last = now;
            if (now - start >= 5000) resolve(); else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        });
        const sorted = [...intervals].sort((a, b) => a - b);
        samples.push({ fps: intervals.length * 1000 / (last - start), frames: intervals.length, ms: last - start,
          p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)] });
      }
      return { samples, camera: arena.camera.position.toArray(), fov: arena.camera.fov,
        drawCalls: arena.state.drawCalls, triangles: arena.state.triangles, resources: perfContext.renderer.info.memory,
        crowd: arena.crowd.stats, density: arena.crowd.density };
    });
    results[place].median = median(results[place].samples.map(sample => sample.fps));
  }
  console.log('T59 FPS', JSON.stringify({ gpu, results }));
  const batching = await page.evaluate(() => {
    const { renderBatches, renderer, scene, camera, THREE } = perfContext;
    if (!renderBatches) return null;
    const target = new THREE.WebGLRenderTarget(960, 540);
    const pixels = () => {
      renderer.setRenderTarget(target);renderer.render(scene, camera);
      const data = new Uint8Array(960 * 540 * 4);renderer.readRenderTargetPixels(target, 0, 0, 960, 540, data);return data;
    };
    const batched = pixels(), calls = renderer.info.render.calls;
    renderBatches.batches.forEach(batch => { batch.visible = false; });renderBatches.sources.forEach(({ mesh, mask }) => { mesh.layers.mask = mask; });
    const original = pixels(), originalCalls = renderer.info.render.calls;
    renderBatches.batches.forEach(batch => { batch.visible = true; });renderBatches.sources.forEach(({ mesh }) => mesh.layers.disableAll());
    let changed = 0, absolute = 0, max = 0;
    for (let i = 0; i < batched.length; i++) { const d = Math.abs(batched[i] - original[i]);absolute += d;max = Math.max(max, d);if (d > 3) changed++; }
    renderer.setRenderTarget(null);target.dispose();
    return { batches: renderBatches.batches.length, sources: renderBatches.sources.length, calls, originalCalls,
      changedFraction: changed / batched.length, meanChannelDifference: absolute / batched.length, max };
  });
  console.log('T59 identical-frame batching comparison', JSON.stringify(batching));
  if (capture !== 'before') {
    expect(batching?.batches).toBeGreaterThan(0);
    expect(batching.calls).toBeLessThan(batching.originalCalls);
    expect(batching.changedFraction).toBeLessThan(.001);
    const cameraRefresh = await page.evaluate(async () => {
      const { cameraRig, camera, renderer, player } = perfContext, update = cameraRig.update;
      let calls = 0;cameraRig.update = dt => { calls++;update(dt); };
      const frame = () => new Promise(requestAnimationFrame);
      await frame();calls = 0;await frame();await frame();const stationary = calls;
      cameraRig.rotate(25, 10);await frame();const rotated = calls > 0;
      calls = 0;renderer.domElement.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, cancelable: true }));await frame();const zoomed = calls > 0;
      calls = 0;const blocker = new perfContext.THREE.Mesh();player.addBlocker(blocker);player.removeBlocker(blocker);await frame();const blockers = calls > 0;
      calls = 0;cameraRig.setOverride(view => view.position.set(10, 20, 30));await frame();await frame();const override = calls >= 2 && camera.position.y === 20;
      cameraRig.setOverride(null);await frame();const restored = camera.fov === 68 && camera.position.y !== 20;
      cameraRig.update = update;return { stationary, rotated, zoomed, blockers, override, restored };
    });
    expect(cameraRefresh).toEqual({ stationary: 0, rotated: true, zoomed: true, blockers: true, override: true, restored: true });
  }
  let cpuSamples;
  if (capture) {
    const session = await page.context().newCDPSession(page);
    await page.evaluate(() => arena.go('arena'));
    await session.send('Profiler.enable');await session.send('Profiler.start');
    await page.waitForTimeout(5000);
    const { profile } = await session.send('Profiler.stop');
    const nodes = new Map(profile.nodes.map(node => [node.id, node.callFrame])), counts = new Map();
    for (const id of profile.samples) {
      const node = nodes.get(id), key = `${node.functionName} ${node.url.split('/').at(-1)}:${node.lineNumber + 1}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    cpuSamples = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 24);
    console.log('T59 CPU samples', JSON.stringify(cpuSamples));
    await session.detach();
  }
  if (capture) {
    expect(['before', 'after']).toContain(capture);
    mkdirSync(screens, { recursive: true });
    writeFileSync(resolve(screens, `P-H-1-metrics-${capture}.json`), JSON.stringify({ gpu, results, batching, cpuSamples }, null, 2));
    frozen = true;await open();
    await page.evaluate(() => { arena.crowd.setPaused(true);arena.crowd.seek(0);document.querySelector('#panel').style.display = 'none'; });
    const views = [
      { name: '경기장', place: 'arena' }, { name: '로비', place: 'lobby' }, { name: '광장', place: 'plaza' },
      { name: 'crowd-기본관람', place: 'arena' },
      { name: 'crowd-무대뒤', place: 'arena', position: [25, 1, 0], target: [50, 3, 0] },
      { name: 'crowd-2층', place: 'arena', position: [-25, 4, 0], target: [20, 12, -30] },
    ];
    for (const view of views) {
      await page.evaluate(view => {
        perfContext.cameraRig.setOverride(null);arena.go(view.place);
        if (view.position) perfContext.cameraRig.setOverride(camera => { camera.position.fromArray(view.position);camera.lookAt(...view.target); });
      }, view);
      await page.waitForTimeout(1500);
      const path = resolve(screens, `P-H-1-${view.name}-${capture}.png`);
      await page.screenshot({ path });await testInfo.attach(view.name, { path, contentType: 'image/png' });
    }
  }
  expect(errors).toEqual([]);
  for (const [place, result] of Object.entries(results)) expect.soft(result.median, `${place} median FPS`).toBeGreaterThanOrEqual(60);
});
