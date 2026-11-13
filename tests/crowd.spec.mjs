import { test, expect } from '@playwright/test';

async function openArena(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(message.text())) errors.push(message.text());
  });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      for(const entry of modules){const original=entry.create;entry.create=ctx=>{window.crowdContext=ctx;return original(ctx);};}` });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
  return errors;
}

test('upper spectators use simpler instances and retain the lower crowd', async ({ page }) => {
  const errors = await openArena(page);
  const result = await page.evaluate(() => {
    const crowd = window.arena.crowd, ctx = window.crowdContext;
    const original = crowd.meshes.filter(mesh => !mesh.isInstancedMesh);
    const instances = [];
    ctx.root.traverse(mesh => { if (mesh.isInstancedMesh && mesh.userData.crowdMannequin) instances.push(mesh); });
    const triangles = mesh => (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    return {
      instances: instances.length,
      positiveTransforms: instances.every(mesh => {
        const matrix = new ctx.THREE.Matrix4();
        for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix);if (matrix.determinant() <= 0) return false; }
        return true;
      }),
      upperTriangles: instances.reduce((n, mesh) => n + triangles(mesh) * mesh.count, 0),
      lowerTriangles: original.reduce((n, mesh) => n + triangles(mesh), 0),
      upperCount: crowd.stats?.upperSpectators,
      lowerCount: crowd.stats?.lowerSpectators,
      removedUpper: original.every(mesh => {
        const g = mesh.geometry, origins = g.getAttribute('_cm_origin'), p = new ctx.THREE.Vector3();
        const index = g.index;
        for (let i = 0; i < (index?.count ?? origins.count); i++) {
          const v = index ? index.getX(i) : i;
          p.set(origins.getX(v), origins.getZ(v), -origins.getY(v)).applyMatrix4(mesh.matrixWorld);
          if (p.y > ctx.config('crowd').upperFloorHeight) return false;
        }
        return true;
      }),
      counters: window.arena.state,
      resources: ctx.renderer.info.memory,
      textures: crowd.textures?.map(({ near, far }) => ({ from: [near.image.width, near.image.height], to: [far.image.width, far.image.height] })),
    };
  });
  console.log('T23 crowd geometry:', JSON.stringify(result));
  expect(result.instances).toBeGreaterThan(0);
  expect(result.upperCount).toBeGreaterThan(0);
  expect(result.lowerCount).toBeGreaterThan(0);
  expect(result.upperCount + result.lowerCount).toBeGreaterThan(5000);
  expect(result.upperCount + result.lowerCount).toBeLessThan(7100);
  expect(result.removedUpper).toBe(true);
  expect(result.positiveTransforms).toBe(true);
  expect(result.upperTriangles / result.upperCount).toBeLessThan(result.lowerTriangles / result.lowerCount);
  expect(result.textures.length).toBeGreaterThan(0);
  for (const map of result.textures) expect(map.to).toEqual(map.from.map(size => Math.max(1, Math.floor(size * .25))));
  expect(errors).toEqual([]);
});

test('crowd sound follows the shared mute and user volume, without distance attenuation', async ({ page }) => {
  await openArena(page);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.crowd.sounding)).toBe(true);
  await page.evaluate(() => arena.screen.setVolume(35));
  expect(await page.evaluate(() => arena.crowd.audio.volume)).toBeCloseTo(.15);
  await page.evaluate(() => arena.screen.setMuted(true));
  expect(await page.evaluate(() => arena.crowd.sounding)).toBe(false);
  await page.evaluate(() => arena.screen.setMuted(false));
  await expect.poll(() => page.evaluate(() => arena.crowd.sounding)).toBe(true);
  expect(await page.evaluate(() => arena.crowd.audio.volume)).toBeCloseTo(.15);
});

test('crowd density is repeatable and distant models upload only inside the configured range', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await openArena(page);
  const result = await page.evaluate(() => {
    const crowd = arena.crowd, { camera, renderer } = crowdContext, config = crowdContext.config('crowd');
    const density = crowd.density;
    if (!density || !crowd.lod) return { density, lod: !!crowd.lod };
    const sources = [...crowd.meshes, ...crowd.mannequins];
    camera.position.set(-200, 30, 0);crowd.update(performance.now());
    const distant = { near: crowd.lod.chunks.filter(c => c.near).length,
      details: crowd.lod.chunks.reduce((n, c) => n + c.details.length, 0),
      visible: crowd.lod.impostors.geometry.getAttribute('crowdShow').array.every(value => value === 1) };
    const chunk = crowd.lod.chunks.find(c => !c.upper), target = chunk.bounds.getCenter(new crowdContext.THREE.Vector3());
    camera.position.copy(target);crowd.update(performance.now());
    let uploads = 0;
    for (const mesh of chunk.details) {
      (mesh.instanceMatrix || mesh.geometry.attributes.position).onUpload(() => uploads++);mesh.frustumCulled = false;
    }
    renderer.render(crowdContext.scene, camera);
    const close = { active: chunk.near, uploaded: uploads === chunk.details.length,
      models: chunk.details.length, hiddenCards: chunk.seats.every(seat => crowd.lod.impostors.geometry.getAttribute('crowdShow').getX(seat.card) === 0) };
    camera.position.set(-200, 30, 0);crowd.update(performance.now());
    const released = chunk.details.length === 0 && !chunk.near;
    const { THREE, root } = crowdContext, pictureScene = new THREE.Scene(), picture = crowd.lod.impostors.clone();
    picture.count = 1;picture.frustumCulled = false;picture.matrixAutoUpdate = false;picture.matrix.copy(root.matrixWorld);pictureScene.add(picture);
    const matrix = new THREE.Matrix4();picture.getMatrixAt(0, matrix);
    const p = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(root.matrixWorld);
    const view = new THREE.OrthographicCamera(-.6, .6, .8, -.8, .1, 20);view.position.copy(p).add(new THREE.Vector3(0, 0, 4));view.lookAt(p);
    const targetTexture = new THREE.WebGLRenderTarget(96, 128);
    const pixels = time => {
      crowd.seek(time);renderer.setRenderTarget(targetTexture);renderer.render(pictureScene, view);
      const data = new Uint8Array(96 * 128 * 4);renderer.readRenderTargetPixels(targetTexture, 0, 0, 96, 128, data);return data;
    };
    const idle = pixels(0), cheer = pixels(14), picturePixels = idle.filter((value, i) => i % 4 === 3 && value > 0).length;
    const pictureStatic = idle.every((value, i) => value === cheer[i]);renderer.setRenderTarget(null);targetTexture.dispose();picture.dispose();
    const inClearedZones = crowd.lod.chunks.flatMap(chunk => chunk.seats).filter(seat => config.clearZones.some(zone => seat.position.toArray().every((value, axis) => value >= zone.min[axis] && value <= zone.max[axis]))).length;
    return { density, config, inClearedZones, distant, close, released, sourcesHidden: sources.every(mesh => !mesh.visible),
      cards: crowd.lod.impostors.count, sourceCounts: crowd.stats, picturePixels, pictureStatic };
  });
  expect(result.lod).not.toBe(false);
  expect(result.density.original).toEqual({ lower: 4473, upper: 7919 });
  for (const group of Object.values(result.density.groups)) {
    const rate = (group.upper ? result.config.density.upperKeepFraction : 1 - result.config.density.lowerEmptyFraction)
      * (group.rear ? result.config.density.rearKeepMultiplier : 1);
    expect(group.kept).toBe(Math.round(group.original * rate) - group.cleared);
  }
  expect(Object.values(result.density.groups).reduce((sum, group) => sum + group.cleared, 0)).toBeGreaterThan(0);
  expect(result.inClearedZones).toBe(0);
  expect(result.cards).toBe(result.sourceCounts.upperSpectators + result.sourceCounts.lowerSpectators);
  expect(result.distant).toEqual({ near: 0, details: 0, visible: true });
  expect(result.close).toMatchObject({ active: true, uploaded: true, hiddenCards: true });
  expect(result.close.models).toBeGreaterThan(0);
  expect(result.released).toBe(true);
  expect(result.sourcesHidden).toBe(true);
  expect(result.picturePixels).toBeGreaterThan(100);
  expect(result.pictureStatic).toBe(true);
  expect(errors).toEqual([]);
});

async function openFixture(page) {
  await page.route('**/crowd-fixture.html', route => route.fulfill({ contentType: 'text/html', body: '<script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
  await page.goto('/crowd-fixture.html');
  await page.evaluate(async () => {
    const THREE = await import('three'), { createCrowdMotion } = await import('./crowd-motion.js');
    const config = await (await fetch('./config/crowd.json')).json();
    // Isolate the existing far-texture and mannequin-pose contracts from density/LOD.
    delete config.density;delete config.impostor;
    const root = new THREE.Group(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 200);
    scene.add(root);
    const canvas = document.createElement('canvas');canvas.width = canvas.height = 64;
    const paint = canvas.getContext('2d');
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { paint.fillStyle = x % 2 ? '#ffffff' : '#000000';paint.fillRect(x, y, 1, 1); }
    const texture = new THREE.CanvasTexture(canvas);texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = texture.minFilter = THREE.NearestFilter;texture.generateMipmaps = false;
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const seats = [[-10, 0, 0], [10, 0, 0], [0, 0, 10], [0, 6, -10]];
    for (const [x, y, z] of seats) {
      const g = new THREE.BoxGeometry(.3, .5, .2);g.translate(x, y + .75, z);
      for (const [name, values] of Object.entries({ _cm_origin: [x, -z, y], _cm_right: [1, 0, 0], _cm_front: [0, -1, 0], _cm_part: [1], _cm_side: [0], _cm_seed: [.5], _cm_style: [0] })) {
        g.setAttribute(name, new THREE.Float32BufferAttribute(Array.from({ length: g.attributes.position.count }, () => values).flat(), values.length));
      }
      const mesh = new THREE.Mesh(g, material);mesh.name = 'Audience_torsos__fixture';root.add(mesh);
    }
    root.updateMatrixWorld(true);
    const events = new EventTarget();
    const ctx = { THREE, scene, camera, root, events, config: name => name === 'crowd' ? config : { crowdVolume: .3, volume: 70 } };
    window.arena = { screen: { state: { muted: false, userVolume: 70 } } };
    const crowd = createCrowdMotion(root, ctx);crowd.setPaused(true);
    window.fixture = { THREE, root, scene, camera, crowd, ctx, texture, material };
  });
}

test('far maps are smaller and the opposite sector follows the camera', async ({ page }) => {
  await openFixture(page);
  const result = await page.evaluate(() => {
    const { crowd, camera } = window.fixture;
    camera.position.set(-30, 2, 0);crowd.update(performance.now());
    const west = [[-10, 0, 0], [10, 0, 0], [0, 0, 10], [0, 6, -10]].map(p => crowd.isFar?.(...p));
    const edges = [59, 61, -59, -61].map(degrees => crowd.isFar?.(10 * Math.cos(degrees * Math.PI / 180), 0, 10 * Math.sin(degrees * Math.PI / 180)));
    camera.position.set(30, 2, 0);crowd.update(performance.now());
    const east = [[-10, 0, 0], [10, 0, 0], [0, 0, 10], [0, 6, -10]].map(p => crowd.isFar?.(...p));
    camera.position.set(0, 2, 0);crowd.update(performance.now());
    return { west, east, edges, center: crowd.isFar?.(10, 0, 0), maps: crowd.textures?.map(({ near, far }) => [near.image.width, near.image.height, far.image.width, far.image.height]), initialVolume: crowd.audio.volume };
  });
  expect(result.west).toEqual([false, true, false, true]);
  expect(result.east).toEqual([true, false, false, true]);
  expect(result.edges).toEqual([true, false, true, false]);
  expect(result.center).toBe(false);
  expect(result.maps).toEqual([[64, 64, 16, 16]]);
  expect(result.initialVolume).toBe(.3);
});

test('the rendered upper pose freezes between cheers and the far shader samples the reduced map', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openFixture(page);
  const result = await page.evaluate(() => {
    const { THREE, crowd, root, scene, camera } = window.fixture;
    const renderer = new THREE.WebGLRenderer();renderer.setSize(128, 128);
    const target = new THREE.WebGLRenderTarget(128, 128), view = new THREE.OrthographicCamera(-.3, .3, .3, -.3, .1, 10);
    renderer.setRenderTarget(target);
    const render = time => {
      crowd.seek(time);crowd.update(performance.now());renderer.render(scene, view);
      const pixels = new Uint8Array(128 * 128 * 4);renderer.readRenderTargetPixels(target, 0, 0, 128, 128, pixels);return pixels;
    };
    const variation = pixels => {
      const values = [];
      for (let y = 48; y < 80; y++) for (let x = 48; x < 80; x++) values.push(pixels[(y * 128 + x) * 4]);
      return Math.max(...values) - Math.min(...values);
    };
    root.children.forEach(mesh => { mesh.visible = !!mesh.userData.crowdMannequin; });
    view.position.set(0, 6.75, -8);view.lookAt(0, 6.75, -10);
    const idle = render(0), later = render(6), cheer = render(14), settled = render(20), second = render(25), wrapped = render(30), wrappedCheer = render(44);
    const difference = pixels => pixels.reduce((n, value, i) => n + (value !== idle[i]), 0);
    const upper = { visible: idle.filter((v, i) => i % 4 !== 3 && v > 0).length, variation: variation(idle), later: difference(later), cheer: difference(cheer), settled: difference(settled), second: difference(second), wrapped: difference(wrapped), wrappedCheer: wrappedCheer.every((v, i) => v === cheer[i]) };
    root.children.forEach(mesh => { mesh.visible = false; });root.children[1].visible = true;
    view.position.set(11, 1.1, 2);view.lookAt(10, .75, 0);
    camera.position.set(30, 2, 0);const nearPixels = render(0), near = variation(nearPixels);
    const lowerMoves = render(11.25).some((value, i) => value !== nearPixels[i]);
    camera.position.set(-30, 2, 0);const far = variation(render(0));
    const edges = [59, 61].map(degrees => { camera.position.set(-30 * Math.cos(degrees * Math.PI / 180), 2, -30 * Math.sin(degrees * Math.PI / 180));return variation(render(0)); });
    renderer.dispose();target.dispose();
    return { upper, near, far, edges, lowerMoves };
  });
  expect(result.upper.visible).toBeGreaterThan(0);
  expect(result.upper.variation).toBeLessThan(5);
  expect(result.upper.later).toBe(0);
  expect(result.upper.settled).toBe(0);
  expect(result.upper.cheer).toBeGreaterThan(0);
  expect(result.upper.second).toBeGreaterThan(0);
  expect(result.upper.wrapped).toBe(0);
  expect(result.upper.wrappedCheer).toBe(true);
  expect(result.near).toBeGreaterThan(100);
  expect(result.far).toBeLessThan(5);
  expect(result.edges[0]).toBeLessThan(5);
  expect(result.edges[1]).toBeGreaterThan(100);
  expect(result.lowerMoves).toBe(true);
  expect(errors).toEqual([]);
});

test('dispose releases new resources, keeps source textures and detaches the screen listener', async ({ page }) => {
  await openFixture(page);
  const result = await page.evaluate(async () => {
    const { crowd, root, texture, material, ctx } = window.fixture;
    let originalDisposals = 0, reducedDisposals = 0;
    texture.addEventListener('dispose', () => originalDisposals++);
    material.addEventListener('dispose', () => originalDisposals++);
    for (const { far } of crowd.textures) far.addEventListener('dispose', () => reducedDisposals++);
    const maps = crowd.textures.length;
    crowd.dispose();crowd.dispose();
    ctx.events.dispatchEvent(new CustomEvent('screen:state', { detail: { muted: true } }));
    const { createCrowdMotion } = await import('./crowd-motion.js');
    const counts = [];
    for (let i = 0; i < 3; i++) { const next = createCrowdMotion(root, ctx);counts.push(next.mannequins.length);next.dispose(); }
    const legacy = createCrowdMotion(root);legacy.seek(-1);legacy.setPaused(true);legacy.update(performance.now());
    const legacyState = { meshes: legacy.meshes.length, mannequins: legacy.mannequins.length, time: legacy.time, sounding: legacy.sounding };legacy.dispose();
    return { originalDisposals, reducedDisposals, maps, volume: crowd.audio.volume, width: texture.image.width, sourceMaterial: root.children.every(mesh => mesh.material === material), children: root.children.length, counts, legacyState };
  });
  expect(result).toMatchObject({ originalDisposals: 0, volume: .3, width: 64, sourceMaterial: true, children: 4 });
  expect(result.reducedDisposals).toBe(result.maps);
  expect(result.counts).toEqual([1, 1, 1]);
  expect(result.legacyState).toEqual({ meshes: 4, mannequins: 0, time: 29, sounding: false });
});
