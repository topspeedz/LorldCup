import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as THREE from '../web/vendor/three.module.js';

const config = JSON.parse(readFileSync(new URL('../web/config/environment.json', import.meta.url), 'utf8'));
const oldLighting = JSON.parse(readFileSync(new URL('../web/lighting-config.json', import.meta.url), 'utf8'));

test('T90 CPU: atlas intensity scales preserve RGBM range and default atlases, including zero', async () => {
  const source = readFileSync(new URL('../web/baked-lighting.js', import.meta.url), 'utf8')
    .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href));
  const { applyBakedLightmaps } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const root = new THREE.Group(), originals = [], textures = [];
  const load = THREE.TextureLoader.prototype.loadAsync;
  THREE.TextureLoader.prototype.loadAsync = async () => { const texture = new THREE.Texture();textures.push(texture);return texture; };
  try {
    for (const atlas of ['bowl', 'seats', 'stage', 'interior']) {
      const geometry = new THREE.PlaneGeometry(), material = new THREE.MeshStandardMaterial();
      const mesh = new THREE.Mesh(geometry, material);mesh.name = atlas === 'stage' ? 'REF_Jumbotron_0' : atlas;originals.push(material);
      geometry.setAttribute('_lightmap_uv', geometry.getAttribute('uv'));
      mesh.userData.bakedLighting = { texture: `./lightmaps/${atlas}-v2.png`, range: 32, uvAttribute: '_lightmap_uv' };
      root.add(mesh);
    }
    await applyBakedLightmaps(root, { './lightmaps/bowl-v2.png': .6, './lightmaps/seats-v2.png': 0 }, 2);
    expect(root.children.map(mesh => mesh.material.emissiveIntensity)).toEqual([1, 1, 2, 1]);
    expect(root.children.map(mesh => mesh.material.lightMapIntensity / Math.PI)).toEqual([.6, 0, 1, 1]);
    for (const mesh of root.children) {
      const shader = { uniforms: {}, fragmentShader: '' };mesh.material.onBeforeCompile(shader);
      expect(shader.uniforms.bakedLightRange.value).toBe(32);
    }
    for (const value of [-1, NaN, Infinity]) {
      await expect(applyBakedLightmaps(new THREE.Group(), { './lightmaps/bowl-v2.png': value })).rejects.toThrow('Invalid lightmap intensity');
      await expect(applyBakedLightmaps(new THREE.Group(), {}, value)).rejects.toThrow('Invalid screen intensity');
    }
  } finally {
    THREE.TextureLoader.prototype.loadAsync = load;
    for (const mesh of root.children) { mesh.geometry.dispose();mesh.material.dispose(); }
    for (const material of originals) material.dispose();
    for (const texture of textures) texture.dispose();
  }
});

test('CPU: WebP lightmaps load like PNG, other extensions are rejected', async () => {
  const source = readFileSync(new URL('../web/baked-lighting.js', import.meta.url), 'utf8')
    .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href));
  const { applyBakedLightmaps } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const load = THREE.TextureLoader.prototype.loadAsync, paths = [];
  THREE.TextureLoader.prototype.loadAsync = async path => { paths.push(path);return new THREE.Texture(); };
  const arena = texture => {
    const geometry = new THREE.PlaneGeometry(), mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
    geometry.setAttribute('_lightmap_uv', geometry.getAttribute('uv'));
    mesh.userData.bakedLighting = { texture, range: 8, uvAttribute: '_lightmap_uv' };
    return new THREE.Group().add(mesh);
  };
  try {
    const root = arena('./lightmaps/seats-v2.webp');
    await applyBakedLightmaps(root, { './lightmaps/seats-v2.webp': .5 });
    expect(paths).toEqual(['./lightmaps/seats-v2.webp']);
    expect(root.children[0].material.lightMapIntensity / Math.PI).toBe(.5);
    await expect(applyBakedLightmaps(arena('./lightmaps/seats-v2.jpg'))).rejects.toThrow('Invalid baked lighting metadata');
  } finally {
    THREE.TextureLoader.prototype.loadAsync = load;
  }
});

test('T90 exposure, per-atlas intensity and configured light count reach the arena without dimming photos', async ({ page }) => {
  await openArena(page);
  await page.waitForFunction(() => {
    const photos = [];environmentProbe.ctx.root.traverse(mesh => { if (mesh.userData.screenFace && mesh.material?.isMeshBasicMaterial) photos.push(mesh); });
    return photos.length === 3 && photos.every(mesh => mesh.material.map?.image?.width > 0);
  });
  const result = await page.evaluate(() => {
    const { ctx } = environmentProbe, { renderer, root, THREE } = ctx, intensities = {}, photos = [], posters = [];
    root.traverse(mesh => {
      for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (material?.lightMap) intensities['./lightmaps/' + material.lightMap.image.src.split('/').pop()] = material.lightMapIntensity / Math.PI;
      }
      if (mesh.userData.screenFace) (mesh.material?.isMeshBasicMaterial ? photos : posters).push(mesh);
    });
    // Use the canvas: Three skips tone mapping for ordinary render targets.
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 10);
    camera.position.z = 2;
    const geometry = new THREE.PlaneGeometry(2, 2), mismatches = [], maxChanges = [], photoPixels = [];
    geometry.setAttribute('uv3', geometry.getAttribute('uv'));
    const viewport = renderer.getViewport(new THREE.Vector4()), gl = renderer.getContext(), side = Math.floor(32 * renderer.getPixelRatio());
    const exposure = renderer.toneMappingExposure;
    renderer.setRenderTarget(null);renderer.setViewport(0, 0, 32, 32);
    try {
      for (const photo of [...photos, ...posters]) {
        const mesh = new THREE.Mesh(geometry, photo.material);scene.add(mesh);
        const intensity = photo.material.emissiveIntensity;
        const buffers = [1, exposure].map(value => {
          if (!photo.material.isMeshBasicMaterial) photo.material.emissiveIntensity = value === 1 ? 1 : intensity;
          renderer.toneMappingExposure = value;renderer.render(scene, camera);
          const data = new Uint8Array(side * side * 4);gl.readPixels(0, 0, side, side, gl.RGBA, gl.UNSIGNED_BYTE, data);return data;
        });
        if (!photo.material.isMeshBasicMaterial) photo.material.emissiveIntensity = intensity;
        mismatches.push(buffers[0].filter((value, i) => value !== buffers[1][i]).length);
        maxChanges.push(buffers[0].reduce((max, value, i) => Math.max(max, Math.abs(value - buffers[1][i])), 0));
        photoPixels.push(buffers[0].filter((value, i) => i % 4 !== 3 && value > 0).length);scene.remove(mesh);
      }
    } finally { renderer.setViewport(viewport);renderer.toneMappingExposure = exposure;geometry.dispose(); }
    return { exposure, intensities, lights: arena.lighting.dynamicLights.map(light => light.name),
      photoCount: photos.length, photoToneMapped: photos.map(photo => photo.material.toneMapped), mismatches, maxChanges, photoPixels,
      posters: posters.map(mesh => ({ intensity: mesh.material.emissiveIntensity, color: mesh.material.color.toArray() })),
      videoFilter: getComputedStyle(ctx.cssLayer).filter };
  });
  expect(oldLighting.exposureEV).toBeLessThan(0);
  expect(result.exposure).toBe(2 ** oldLighting.exposureEV);
  for (const [path, intensity] of Object.entries(result.intensities)) expect(intensity).toBeCloseTo(oldLighting.lightMapIntensity[path] ?? 1, 8);
  expect(result.intensities['./lightmaps/bowl-v2.png']).toBeLessThan(1);
  expect(result.intensities['./lightmaps/seats-v2.png']).toBeLessThan(1);
  expect(result.intensities['./lightmaps/stage-v2.png']).toBe(1);
  expect(result.intensities['./lightmaps/interior-v2.png']).toBe(1);
  expect(result.lights).toHaveLength(11);
  for (const name of oldLighting.disabledLights) expect(result.lights).not.toContain(name);
  expect(result.photoCount).toBeGreaterThan(0);
  expect(result.photoToneMapped.every(value => value === false)).toBe(true);
  expect(result.mismatches.slice(0, result.photoCount).every(value => value === 0)).toBe(true);
  expect(result.maxChanges.every(value => value <= 1)).toBe(true);
  expect(result.posters).toHaveLength(1);
  expect(result.posters[0].intensity).toBeCloseTo(2 ** (oldLighting.screenExposureEV - oldLighting.exposureEV), 8);
  expect(result.posters[0].color).toEqual([0, 0, 0]);
  expect(result.photoPixels.every(value => value > 0)).toBe(true);
  expect(result.videoFilter).toBe('none');
});

async function openArena(page) {
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const entry=modules.find(m=>m.path==='environment.js'),original=entry.create;
      entry.create=ctx=>{
        window.environmentProbe={ctx,before:ctx.scene.backgroundIntensity};
        const instance=original(ctx);environmentProbe.instance=instance;return instance;
      };` });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
}

test('night settings retain the approved stars, moon direction and west shoreline', () => {
  expect(config.stars.count).toBe(3000);
  expect(config.stars.opacity).toBeGreaterThan(0);
  expect(config.stars.opacity).toBeLessThan(.6);
  expect(config.stars.twinkleAmplitude).toBeGreaterThan(0);
  expect(config.stars.twinkleAmplitude).toBeLessThan(.2);
  expect(config.moon.elevationDegrees).toBe(35);
  expect(config.moon.direction).toEqual([-.7094, .5736, .4096]);
  expect(config.moon.lightIntensity).toBeGreaterThan(0);
  expect(config.moon.lightIntensity).toBeLessThan(.1);
  expect(config.skyIntensity).toBeGreaterThan(0);
  expect(config.skyIntensity).toBeLessThan(oldLighting.backgroundStrength);
  expect(config.sea.boundaryX).toBe(-180);
});

test('night sky, stars, moon and west sea render in the real arena', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/THREE.WebGLProgram: Shader Error/.test(message.text())) errors.push(message.text()); });
  await openArena(page);
  const result = await page.evaluate(() => {
    const { ctx, before } = environmentProbe, { THREE, scene, renderer } = ctx;
    const stars = scene.getObjectByName('Environment_Stars'), moon = scene.getObjectByName('Environment_Moon');
    const sea = scene.getObjectByName('Environment_Sea'), light = scene.getObjectByName('Environment_MoonLight');
    const world = [];
    ctx.root.traverse(object => {
      if (/^(Walk_Plaza|CityGround__|CityRoads__)/.test(object.name)) {
        const box = new THREE.Box3().setFromObject(object);
        world.push({ name: object.name, min: box.min.toArray(), max: box.max.toArray() });
      }
    });
    if (!stars || !moon || !sea || !light) return { missing: true, world };
    const camera = new THREE.PerspectiveCamera(68, 16 / 9, .08, 650);
    const target = new THREE.WebGLRenderTarget(320, 180);
    const pixels = () => {
      renderer.setRenderTarget(target);renderer.render(scene, camera);
      const data = new Uint8Array(320 * 180 * 4);
      renderer.readRenderTargetPixels(target, 0, 0, 320, 180, data);return data;
    };
    let seaHorizonPixels = 0;
    const difference = (object, threshold = 3) => {
      object.visible = true;const shown = pixels();object.visible = false;const hidden = pixels();object.visible = true;
      let changed = 0;
      for (let i = 0; i < shown.length; i += 4) {
        if (Math.abs(shown[i] - hidden[i]) + Math.abs(shown[i + 1] - hidden[i + 1]) + Math.abs(shown[i + 2] - hidden[i + 2]) <= threshold) continue;
        changed++;
        if (object === sea && Math.floor(i / 4 / 320) === 88) seaHorizonPixels++;
      }
      return changed;
    };
    camera.position.set(-139, 2, 0);
    camera.lookAt(camera.position.clone().add(new THREE.Vector3(...ctx.config('environment').moon.direction).multiplyScalar(500)));
    const moonPixels = difference(moon), starPixels = difference(stars);
    camera.position.set(-178, 2, 0);camera.lookAt(-700, 2, 0);
    const seaPixels = difference(sea);
    camera.position.set(-141, 1.6, 1.2);camera.lookAt(-139, 1, 0);
    const moonlightPixels = difference(light, 0);
    renderer.setRenderTarget(null);target.dispose();
    ctx.player.teleport([-179, -.02, 0, 0]);
    for (let i = 0; i < 30; i++) ctx.player.attempt(-.1, 0);
    const coastX = ctx.player.position.x;ctx.player.teleport('plaza');
    const geometry = stars.geometry.getAttribute('position');
    return {
      before, skyIntensity: scene.backgroundIntensity, stars: geometry.count,
      moonPixels, starPixels, seaPixels, seaHorizonPixels, moonlightPixels, coastX,
      shorelineRegistered: ctx.player.wallMeshes.includes(scene.getObjectByName('Environment_Shoreline')),
      direction: light.position.clone().sub(light.target.position).normalize().toArray(),
      lightIntensity: light.intensity, world,
      counters: { drawCalls: arena.state.drawCalls, triangles: arena.state.triangles, ...renderer.info.memory },
    };
  });
  console.log('T24 world/render evidence:', JSON.stringify(result));
  expect(result.missing).not.toBe(true);
  expect(result.skyIntensity).toBe(config.skyIntensity);
  expect(result.skyIntensity).toBeLessThan(result.before);
  expect(result.stars).toBe(config.stars.count);
  expect(result.moonPixels).toBeGreaterThan(2);
  expect(result.starPixels).toBeGreaterThan(30);
  expect(result.seaPixels).toBeGreaterThan(3000);
  expect(result.seaHorizonPixels).toBeGreaterThan(250);
  expect(result.moonlightPixels).toBeGreaterThan(5);
  expect(result.coastX).toBeGreaterThan(config.sea.boundaryX);
  expect(result.shorelineRegistered).toBe(true);
  expect(result.lightIntensity).toBe(config.moon.lightIntensity);
  for (let i = 0; i < 3; i++) expect(result.direction[i]).toBeCloseTo(config.moon.direction[i], 3);
  await page.evaluate(() => environmentProbe.ctx.cameraRig.setOverride(camera => {
    camera.position.set(-178, 2, 0);camera.lookAt(-700, 85, 300);
  }));
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await testInfo.attach('west-sea-and-night', { body: await page.locator('canvas').first().screenshot({ path: testInfo.outputPath('west-sea-and-night.png') }), contentType: 'image/png' });
  expect(errors).toEqual([]);
});

test('shoreline blocks walking and jumping, while moonlight and resources follow lifecycle', async ({ page }) => {
  test.setTimeout(90_000);
  await openArena(page);
  const result = await page.evaluate(async () => {
    const { ctx } = environmentProbe, { THREE } = ctx;
    const { create } = await import('./environment.js');
    const { createPlayerController } = await import('./player-controller.js');
    const { createAvatar } = await import('./avatar.js');
    const scene = new THREE.Scene(), root = new THREE.Group();
    scene.background = ctx.scene.background;scene.backgroundIntensity = .018;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshBasicMaterial());
    floor.name = 'Walk_Plaza';floor.rotation.x = -Math.PI / 2;
    root.add(floor);scene.add(root);root.updateMatrixWorld(true);
    const input = { keys: new Set(), walking: false };
    const player = createPlayerController({ avatar: createAvatar(0x88aacc), input, getYaw: () => 0, onTeleport() {} });
    player.registerWorld(root);scene.add(player.avatar);
    const isolated = { ...ctx, scene, root, player }, cycles = [];
    for (let cycle = 0; cycle < 3; cycle++) {
      player.teleport([-179, 0, 0, 0]);const instance = create(isolated);instance.update?.(1 / 60, 1000);
      const blocker = scene.getObjectByName('Environment_Shoreline');
      const light = scene.getObjectByName('Environment_MoonLight');
      if (!blocker || !light) return { missing: true };
      const resources = new Set();let released = 0;
      scene.traverse(object => {
        if (!object.name.startsWith('Environment_')) return;
        if (object.geometry) resources.add(object.geometry);
        if (object.material) { resources.add(object.material);if (object.material.map) resources.add(object.material.map); }
      });
      for (const resource of resources) resource.addEventListener('dispose', () => released++);
      const outsideIntensity = light.intensity;
      for (let i = 0; i < 20; i++) player.attempt(-.1, 0);
      const walkingX = player.position.x;
      player.jump();
      for (let i = 0; i < 60; i++) { player.update(1 / 60);player.attempt(-.1, 0); }
      const jumpingX = player.position.x;
      const sideways = player.attempt(0, 1);
      player.teleport([-179.8, 0, 0, 0]);
      const blocked = !player.attempt(-.5, 0);
      player.removeBlocker(blocker);const passesWithoutBlocker = player.attempt(-.5, 0);player.addBlocker(blocker);
      player.teleport('arena');instance.update(1 / 60, 2000);const insideIntensity = light.intensity;
      instance.dispose();
      cycles.push({ walkingX, jumpingX, sideways, blocked, passesWithoutBlocker, outsideIntensity, insideIntensity,
        released, resources: resources.size, blockers: player.wallMeshes.length, restored: scene.backgroundIntensity,
        remaining: scene.children.filter(object => object.name.startsWith('Environment_')).length });
    }
    floor.geometry.dispose();floor.material.dispose();return { cycles };
  });
  expect(result.missing).not.toBe(true);
  for (const cycle of result.cycles) {
    expect(cycle.walkingX).toBeGreaterThan(config.sea.boundaryX);
    expect(cycle.jumpingX).toBeGreaterThan(config.sea.boundaryX);
    expect(cycle).toMatchObject({ sideways: true, blocked: true, passesWithoutBlocker: true,
      outsideIntensity: config.moon.lightIntensity, insideIntensity: 0, blockers: 0, restored: .018, remaining: 0 });
    expect(cycle.released).toBe(cycle.resources);
  }
  console.log('T24 lifecycle evidence:', JSON.stringify(result));
});
