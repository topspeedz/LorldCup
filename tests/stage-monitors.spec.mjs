import { test, expect } from '@playwright/test';

async function openArena(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/THREE.WebGLProgram: Shader Error/.test(message.text())) errors.push(message.text());
  });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const entry=modules.find(m=>m.path==='stage-monitors.js'),original=entry.create;
      entry.create=ctx=>{
        const mesh=ctx.root.getObjectByName('REF_Reused_Monitor_pixels__cyan');
        const geometry=mesh.geometry,material=mesh.material,instance=original(ctx);
        window.monitorProbe={ctx,mesh,geometry,material,instance};
        return {dispose:()=>monitorProbe.instance.dispose?.()};
      };` });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
  return errors;
}

test('all ten real monitors have complete upright UVs and a repeating animated screen', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await openArena(page);
  const result = await page.evaluate(() => {
    const { ctx, mesh, geometry: original, instance } = monitorProbe, { THREE } = ctx;
    const geometry = mesh.geometry, position = geometry.attributes.position, uv = geometry.attributes.uv;
    const index = geometry.index, front = new Map();
    // The asset has ten separate boxes: pair each front rectangle by its left X edge.
    for (let i = 0; i < (index?.count ?? position.count); i += 3) {
      const ids = [0, 1, 2].map(j => index ? index.getX(i + j) : i + j);
      const points = ids.map(id => new THREE.Vector3().fromBufferAttribute(position, id));
      const normal = points[1].clone().sub(points[0]).cross(points[2].clone().sub(points[0])).normalize();
      if (normal.z > -.99) continue;
      const key = Math.min(...points.map(p => p.x)).toFixed(3);
      if (!front.has(key)) front.set(key, new Set());
      ids.forEach(id => front.get(key).add(id));
    }
    const screens = [...front.values()].map(ids => {
      const vertices = [...ids].map(id => ({ x: position.getX(id), y: position.getY(id), z: position.getZ(id),
        u: uv?.getX(id), v: uv?.getY(id) }));
      const minX = Math.min(...vertices.map(p => p.x)), maxX = Math.max(...vertices.map(p => p.x));
      const minY = Math.min(...vertices.map(p => p.y)), maxY = Math.max(...vertices.map(p => p.y));
      return { vertices, center: [(minX + maxX) / 2, (minY + maxY) / 2, vertices[0].z],
        upright: vertices.every(p => Number.isFinite(p.u) && Number.isFinite(p.v) &&
          Math.abs(p.u - (maxX - p.x) / (maxX - minX)) < .001 &&
          Math.abs(p.v - (p.y - minY) / (maxY - minY)) < .001) };
    });
    const metadata = { count: screens.length, uvCount: uv?.count ?? 0, vertexCount: position.count,
      upright: screens.map(screen => screen.upright), sourceUV: !!original.attributes.uv,
      triangles: (index?.count ?? position.count) / 3, map: !!mesh.material.map,
      positionsUnchanged: position.array.every((value, i) => value === original.attributes.position.array[i]) };
    if (!mesh.material.map || !instance.update) return metadata;
    const sample = new THREE.Scene(), copy = new THREE.Mesh(geometry, mesh.material);sample.add(copy);
    const camera = new THREE.OrthographicCamera(-.4, .4, .225, -.225, .01, 5);
    const target = new THREE.WebGLRenderTarget(128, 72), renderer = ctx.renderer;
    const pixels = screen => {
      camera.position.set(screen.center[0], screen.center[1], screen.center[2] - 1);
      camera.lookAt(...screen.center);renderer.setRenderTarget(target);renderer.render(sample, camera);
      const data = new Uint8Array(128 * 72 * 4);renderer.readRenderTargetPixels(target, 0, 0, 128, 72, data);return data;
    };
    instance.update(0, 0);const first = screens.map(pixels);
    instance.update(.04, 1000);const moved = screens.map(pixels);
    instance.update(.04, 8000);const repeated = screens.map(pixels);
    const changed = first.map((data, n) => data.filter((value, i) => value !== moved[n][i]).length);
    const loops = first.map((data, n) => data.every((value, i) => value === repeated[n][i]));
    const colors = first.map(data => new Set(Array.from({ length: data.length / 4 }, (_, i) =>
      `${data[i * 4]},${data[i * 4 + 1]},${data[i * 4 + 2]}`)).size);
    renderer.setRenderTarget(null);target.dispose();
    return { ...metadata, changed, loops, colors, monitorCalls: renderer.info.render.calls,
      monitorTriangles: renderer.info.render.triangles, memory: { ...renderer.info.memory } };
  });
  console.log('T22_MONITORS', JSON.stringify(result));
  expect(result.count).toBe(10);
  expect(result.uvCount).toBe(result.vertexCount);
  expect(result.upright).toEqual(Array(10).fill(true));
  expect(result.sourceUV).toBe(false);
  expect(result.triangles).toBe(120);
  expect(result.positionsUnchanged).toBe(true);
  expect(result.map).toBe(true);
  expect(result.changed.every(count => count > 100)).toBe(true);
  expect(result.loops).toEqual(Array(10).fill(true));
  expect(result.colors.every(count => count > 12)).toBe(true);
  expect(result.monitorCalls).toBe(1);
  expect(result.monitorTriangles).toBe(120);
  expect(errors).toEqual([]);

  const lifecycle = await page.evaluate(async () => {
    const { create } = await import('./stage-monitors.js');
    const probe = monitorProbe, { ctx, mesh, geometry, material } = probe, { THREE } = ctx;
    let originalDisposals = 0, ownedDisposals = 0;
    geometry.addEventListener('dispose', () => originalDisposals++);
    material.addEventListener('dispose', () => originalDisposals++);
    const sample = new THREE.Scene(), copy = new THREE.Mesh(), camera = new THREE.PerspectiveCamera();sample.add(copy);
    camera.position.set(0, -7.4, -20);camera.lookAt(0, -7.4, 0);
    const target = new THREE.WebGLRenderTarget(16, 16);
    const render = () => {
      copy.geometry = mesh.geometry;copy.material = mesh.material;
      ctx.renderer.setRenderTarget(target);ctx.renderer.render(sample, camera);
      return { ...ctx.renderer.info.memory };
    };
    probe.instance.dispose();render();const baseline = render(), cycles = [];
    for (let i = 0; i < 3; i++) {
      const instance = create(ctx);probe.instance = instance;
      for (const resource of [mesh.geometry, mesh.material, mesh.material.map])
        resource.addEventListener('dispose', () => ownedDisposals++);
      instance.update(.04, 1000);render();instance.dispose();instance.dispose();
      cycles.push({ restored: mesh.geometry === geometry && mesh.material === material, memory: render() });
    }
    ctx.renderer.setRenderTarget(null);target.dispose();
    return { baseline, cycles, originalDisposals, ownedDisposals };
  });
  console.log('T22_LIFECYCLE', JSON.stringify(lifecycle));
  expect(lifecycle.originalDisposals).toBe(0);
  expect(lifecycle.ownedDisposals).toBe(9);
  for (const cycle of lifecycle.cycles) {
    expect(cycle.restored).toBe(true);
    expect(cycle.memory).toEqual(lifecycle.baseline);
  }
});

async function fixture(page, config) {
  await page.route('**/monitor-fixture', route => route.fulfill({ contentType: 'text/html', body:
    '<script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
  await page.goto('/monitor-fixture');
  await page.evaluate(async config => {
    const THREE = await import('three'), { create } = await import('./stage-monitors.js');
    const root = new THREE.Group(), geometry = new THREE.BoxGeometry(.8, .45, .015);geometry.deleteAttribute('uv');
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());mesh.name = 'REF_Reused_Monitor_pixels__cyan';root.add(mesh);
    const instance = create({ THREE, root, config: () => config });
    window.fileProbe = { instance, mesh, geometry };
  }, config);
}

test('a configured local video replaces the generated source and loops silently', async ({ page }) => {
  const clip = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');canvas.width = 128;canvas.height = 72;
    const context = canvas.getContext('2d'), stream = canvas.captureStream(12), chunks = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
    const finished = new Promise(resolve => { recorder.onstop = resolve; });
    recorder.ondataavailable = event => chunks.push(event.data);recorder.start();
    for (const color of ['#34cbd9', '#efac55', '#34cbd9', '#efac55']) {
      context.fillStyle = color;context.fillRect(0, 0, 128, 72);
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    recorder.stop();await finished;stream.getTracks().forEach(track => track.stop());
    return [...new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())];
  });
  await page.route('**/__t22-loop.webm', route => route.fulfill({ contentType: 'video/webm', body: Buffer.from(clip) }));
  await fixture(page, { source: 'video', path: './__t22-loop.webm' });
  await expect.poll(() => page.evaluate(() => fileProbe.mesh.material.map?.isVideoTexture ?? false)).toBe(true);
  await expect.poll(() => page.evaluate(() => fileProbe.mesh.material.map.image.currentTime)).toBeGreaterThan(.05);
  const result = await page.evaluate(async () => {
    const { instance, mesh, geometry } = fileProbe, texture = mesh.material.map, video = texture.image;
    let loops = 0;video.addEventListener('timeupdate', () => { if (video.currentTime < .1) loops++; });
    const before = texture.version;await new Promise(resolve => setTimeout(resolve, 1500));
    const state = { loop: video.loop, muted: video.muted, inline: video.playsInline, playing: !video.paused,
      source: video.currentSrc, frames: texture.version - before, loops };
    instance.dispose();return { ...state, pausedAfterDispose: video.paused,
      removedSource: !video.getAttribute('src'), restored: mesh.geometry === geometry };
  });
  expect(result).toMatchObject({ loop: true, muted: true, inline: true, playing: true, pausedAfterDispose: true, removedSource: true, restored: true });
  expect(result.source).toContain('/__t22-loop.webm');
  expect(result.frames).toBeGreaterThan(1);
  expect(result.loops).toBeGreaterThan(0);
});

test('an unavailable configured video keeps the generated animation usable', async ({ page }) => {
  const errors = [];page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__t22-missing.webm', route => route.fulfill({ status: 404, body: '' }));
  await fixture(page, { source: 'video', path: './__t22-missing.webm' });
  await page.waitForTimeout(300);
  const result = await page.evaluate(() => {
    const { instance, mesh } = fileProbe, texture = mesh.material.map;
    if (!texture?.isCanvasTexture || !instance.update) return { generated: false };
    instance.update(0, 0);const before = texture.image.toDataURL();
    instance.update(.04, 1000);const after = texture.image.toDataURL();
    instance.dispose();return { generated: true, changed: before !== after };
  });
  expect(result).toEqual({ generated: true, changed: true });
  expect(errors).toEqual([]);
});
