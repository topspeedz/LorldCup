import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as THREE from '../web/vendor/three.module.js';

async function cpuCrowd(run, preload = false) {
  const config = JSON.parse(readFileSync(new URL('../web/config/crowd.json', import.meta.url), 'utf8'));
  delete config.impostor;
  const source = readFileSync(new URL('../web/crowd-motion.js', import.meta.url), 'utf8')
    .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href))
    .replace("'./events.js'", JSON.stringify(new URL('../web/events.js', import.meta.url).href))
    .replaceAll('import.meta.url', JSON.stringify(new URL('../web/crowd-motion.js', import.meta.url).href));
  const { createCrowdMotion } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const originals = Object.fromEntries(['window', 'Audio', 'fetch'].map(key => [key, globalThis[key]]));
  const root = new THREE.Group(), material = new THREE.MeshBasicMaterial(), geometries = [];
  let crowd;
  try {
    globalThis.window = new EventTarget(); globalThis.Audio = class { pause() {} }; globalThis.fetch = () => new Promise(() => {});
    for (const upper of [false, true]) for (const rear of [false, true]) for (let i = 0; i < 20; i++) {
      const x = config.density.rearMinX + (rear ? 10 : -10), y = config.upperFloorHeight + (upper ? 1 : -1), z = 10 + i;
      const geometry = new THREE.BoxGeometry(.3, .5, .2); geometry.translate(x, y + .75, z); geometries.push(geometry);
      for (const [name, values] of Object.entries({ _cm_origin: [x, -z, y], _cm_right: [1, 0, 0], _cm_front: [0, -1, 0], _cm_part: [1], _cm_side: [0], _cm_seed: [.5], _cm_style: [0] })) {
        geometry.setAttribute(name, new THREE.Float32BufferAttribute(Array.from({ length: geometry.attributes.position.count }, () => values).flat(), values.length));
      }
      root.add(new THREE.Mesh(geometry, material));
    }
    root.updateMatrixWorld(true);
    const ctx = { events: new EventTarget(), camera: new THREE.PerspectiveCamera(), player: { position: new THREE.Vector3() }, config: name => name === 'crowd' ? config : {} };
    if (preload) ctx.renderer = {};
    crowd = createCrowdMotion(root, ctx);
    const shader = { uniforms: {}, vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>', fragmentShader: '' };
    if (!preload) crowd.meshes[0].material.onBeforeCompile(shader);
    await run({ crowd, config, ctx, shader });
  } finally {
    crowd?.dispose(); for (const geometry of geometries) geometry.dispose(); material.dispose();
    for (const [key, value] of Object.entries(originals)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
}

test('T92b CPU: ticket preparation starts once and waits for compilation', async () => {
  const source = readFileSync(new URL('../web/crowd-motion.js', import.meta.url), 'utf8')
    .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href))
    .replace("'./events.js'", JSON.stringify(new URL('../web/events.js', import.meta.url).href));
  const { createCrowdPreparation } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  let completed = 0, resolve;
  const compiling = new Promise(done => { resolve = done; });
  function* work() {
    for (let i = 0; i < 32; i++) { completed++; yield; }
    yield compiling;
    completed++;
  }
  const preparation = createCrowdPreparation(work());
  expect(completed).toBe(0);expect(preparation.ready).toBe(false);
  const loading = preparation.start();
  expect(completed).toBe(32);expect(preparation.ready).toBe(false);
  expect(preparation.start()).toBe(loading);
  resolve();await loading;
  expect(preparation.ready).toBe(true);expect(completed).toBe(33);
  expect(preparation.start()).toBe(loading);
  let resume, advanced = false, released = false;
  function* cancelledWork() {
    try { yield new Promise(done => { resume = done; });advanced = true; }
    finally { released = true; }
  }
  const cancelled = createCrowdPreparation(cancelledWork());cancelled.start();
  const cleanup = cancelled.dispose();
  expect(released).toBe(false);resume();await cleanup;
  expect(advanced).toBe(false);expect(released).toBe(true);expect(cancelled.ready).toBe(false);
});

test('T92b CPU: outside updates do no preparation and ticket preparation keeps the crowd hidden', async () => {
  await cpuCrowd(async ({ crowd }) => {
    expect(crowd.preparation?.ready).toBe(false);
    crowd.setVisible(false);
    for (let frame = 0; frame < 10; frame++) crowd.update(performance.now());
    expect(crowd.preparation.phase).toBe('idle');
    expect(crowd.mannequins).toHaveLength(0);
    expect(crowd.meshes.every(mesh => !mesh.visible)).toBe(true);
    await crowd.preparation.start();
    expect(crowd.preparation.ready).toBe(true);
    expect(crowd.stats.upperSpectators + crowd.stats.lowerSpectators).toBeGreaterThan(0);
    expect([...crowd.meshes, ...crowd.mannequins].every(mesh => !mesh.visible)).toBe(true);
    crowd.setVisible(true);
    expect(crowd.meshes.some(mesh => mesh.visible)).toBe(true);
    crowd.setVisible(false);
    expect([...crowd.meshes, ...crowd.mannequins].every(mesh => !mesh.visible)).toBe(true);
    crowd.dispose();crowd.update(performance.now());
    expect(crowd.preparation.ready).toBe(true);
  }, true);
});

test('T86 CPU: upper density increases and both tiers follow the configured fractions', async () => {
  await cpuCrowd(({ crowd, config }) => {
    expect(config.density.upperKeepFraction).toBeGreaterThan(1 / 3);
    expect(crowd.density.original).toEqual({ lower: 40, upper: 40 });
    for (const group of Object.values(crowd.density.groups)) {
      const fraction = (group.upper ? config.density.upperKeepFraction : 1 - config.density.lowerEmptyFraction) * (group.rear ? config.density.rearKeepMultiplier : 1);
      expect(group.kept).toBe(Math.round(group.original * fraction) - group.cleared);
    }
    for (const upper of [false, true]) expect(crowd.stats[upper ? 'upperSpectators' : 'lowerSpectators']).toBe(Object.values(crowd.density.groups).filter(group => group.upper === upper).reduce((sum, group) => sum + group.kept, 0));
  });
});

test('T86 CPU: motion direction follows the player with angular hysteresis and a center dead zone', async () => {
  await cpuCrowd(({ crowd, config, ctx, shader }) => {
    expect(config.motionZone).toBeDefined();
    const zone = config.motionZone, uniforms = shader.uniforms, direction = uniforms.crowdMotionDirection.value;
    expect(uniforms.crowdMotionEnabled.value).toBe(true);
    expect(uniforms.crowdMotionCos.value).toBeCloseTo(Math.cos(zone.halfAngleDegrees * Math.PI / 180));
    expect(direction.toArray()).toEqual([1, 0]);
    const move = degrees => { const radians = degrees * Math.PI / 180; ctx.player.position.set(-30 * Math.cos(radians), 0, -30 * Math.sin(radians)); crowd.update(performance.now()); };
    move(0); const initial = direction.clone();
    ctx.camera.position.set(30, 5, 0); crowd.update(performance.now());
    expect(direction.equals(initial)).toBe(true);
    move(zone.hysteresisDegrees * .9); expect(direction.equals(initial)).toBe(true);
    move(zone.hysteresisDegrees * 1.1); expect(direction.angle()).toBeCloseTo(zone.hysteresisDegrees * 1.1 * Math.PI / 180);
    const held = direction.clone(); move(zone.hysteresisDegrees * .9); expect(direction.equals(held)).toBe(true);
    ctx.player.position.set(zone.centerRadius * .9, 0, 0); crowd.update(performance.now()); expect(direction.equals(held)).toBe(true);
    ctx.player.position.set(30, 0, 0); crowd.update(performance.now()); expect(direction.x).toBeCloseTo(-1); expect(direction.y).toBeCloseTo(0);
    ctx.events.dispatchEvent(new Event('seat:enter')); expect(uniforms.crowdMotionEnabled.value).toBe(true);
    ctx.events.dispatchEvent(new Event('seat:exit')); expect(uniforms.crowdMotionEnabled.value).toBe(true);
    move(179); const wrapped = direction.clone(); move(-179); expect(direction.equals(wrapped)).toBe(true);
    crowd.setVisible(false); move(0); expect(direction.equals(wrapped)).toBe(true);
    crowd.setVisible(true); crowd.update(performance.now()); expect(direction.x).toBeCloseTo(1);
  });
});

test('T89 CPU: lower uniforms follow stage-relative sides, blend centrally and preserve upper uniforms', async () => {
  const config = JSON.parse(readFileSync(new URL('../web/config/crowd.json', import.meta.url), 'utf8'));
  expect(config.uniformSides).toEqual({ favoredFraction: .6, centerBandWidth: 12 });
  delete config.impostor;
  const settings = config.uniformSides;
  const source = readFileSync(new URL('../web/crowd-motion.js', import.meta.url), 'utf8')
    .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href))
    .replace("'./events.js'", JSON.stringify(new URL('../web/events.js', import.meta.url).href))
    .replaceAll('import.meta.url', JSON.stringify(new URL('../web/crowd-motion.js', import.meta.url).href));
  const { createCrowdMotion } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const originals = Object.fromEntries(['window', 'Audio', 'fetch'].map(key => [key, globalThis[key]]));
  const root = new THREE.Group(), names = ['GEN.G', 'BLG', 'Black', 'White', 'Gold', 'Cyan'];
  const buffers = Object.fromEntries(names.map(name => [name, {}])), geometries = [], materials = [];
  const triangle = (name, x, y, z, part) => {
    const buffer = buffers[name];
    for (let v = 0; v < 3; v++) for (const [attribute, values] of Object.entries({
      position: [x + (v === 1 ? .1 : 0), y + .75 + (v === 2 ? .1 : 0), z], normal: [0, 0, 1],
      _cm_origin: [x, -z, y], _cm_right: [1, 0, 0], _cm_front: [0, -1, 0],
      _cm_part: [part], _cm_side: [1], _cm_seed: [.5], _cm_style: [0],
    })) (buffer[attribute] ??= []).push(...values);
  };
  for (const upper of [false, true]) for (const region of [-1, 0, 1]) for (let i = 0; i < (upper ? 80 : 800); i++) {
    const x = Math.floor(i / 20) - 20, y = config.upperFloorHeight + (upper ? 2 : -6);
    const z = region ? region * (20 + (i % 20) / 2) : ((i % 20 + .5) / 20 - .5) * settings.centerBandWidth;
    const blg = i % 2 === 0, base = blg ? 'White' : 'Black';
    triangle(blg ? 'BLG' : 'GEN.G', x, y, z, 1);
    triangle(base, x, y, z, 1);triangle(base, x, y, z, 3);
    triangle(blg ? 'Cyan' : 'Gold', x, y, z, 1);
    triangle('Black', x, y, z, 0);triangle('Cyan', x, y, z, 6);
  }
  for (const name of names) {
    const geometry = new THREE.BufferGeometry(), material = new THREE.MeshStandardMaterial();
    material.name = 'AudienceDetail_' + name;
    for (const [attribute, data] of Object.entries(buffers[name])) geometry.setAttribute(attribute, new THREE.Float32BufferAttribute(data, /^(position|normal|_cm_origin|_cm_right|_cm_front)$/.test(attribute) ? 3 : 1));
    geometries.push(geometry);materials.push(material);root.add(new THREE.Mesh(geometry, material));
  }
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));face.name = 'REF_Jumbotron_3';face.rotation.y = -Math.PI / 2;face.position.x = -2;root.add(face);
  root.updateMatrixWorld(true);
  const ctx = { events: new EventTarget(), camera: new THREE.PerspectiveCamera(), config: name => name === 'crowd' ? config : { videoFace: face.name } };
  let crowd;
  const inspect = () => {
    const lower = {}, upper = {}, point = new THREE.Vector3(), matrix = new THREE.Matrix4();
    for (const mesh of [...crowd.meshes, ...crowd.mannequins]) {
      const a = mesh.geometry.attributes, index = mesh.geometry.index, team = mesh.material.name.slice('AudienceDetail_'.length);
      for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : index.count); i += mesh.isInstancedMesh ? 1 : 3) {
        const v = mesh.isInstancedMesh ? 0 : index.getX(i), part = Math.round(a._cm_part.getX(v)), swap = a._cm_uniformSwap?.getX(v) > .5;
        if (part === 0 || part === 6) expect(swap).toBe(false);
        if (part !== 1 || !['BLG', 'GEN.G'].includes(team)) continue;
        point.set(a._cm_origin.getX(v), a._cm_origin.getZ(v), -a._cm_origin.getY(v));
        if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, matrix);point.applyMatrix4(matrix); }
        point.applyMatrix4(mesh.matrixWorld);
        const key = point.toArray().map(n => n.toFixed(3)).join(',');
        (point.y > config.upperFloorHeight ? upper : lower)[key] = { team: swap ? (team === 'BLG' ? 'GEN.G' : 'BLG') : team, z: point.z };
      }
    }
    return { lower, upper, stats: { ...crowd.stats } };
  };
  try {
    globalThis.window = new EventTarget();globalThis.Audio = class { pause() {} };globalThis.fetch = () => new Promise(() => {});
    delete config.uniformSides;crowd = createCrowdMotion(root, ctx);const baseline = inspect();crowd.dispose();
    config.uniformSides = settings;crowd = createCrowdMotion(root, ctx);const actual = inspect();
    expect(actual.upper).toEqual(baseline.upper);expect(actual.stats).toEqual(baseline.stats);
    expect(Object.keys(actual.lower).sort()).toEqual(Object.keys(baseline.lower).sort());
    const seats = Object.values(actual.lower), half = settings.centerBandWidth / 2;
    for (const [group, team, fraction] of [[seats.filter(s => s.z < -half), 'GEN.G', settings.favoredFraction], [seats.filter(s => s.z > half), 'BLG', settings.favoredFraction], [seats.filter(s => Math.abs(s.z) < half), 'BLG', .5]]) {
      expect(group.length).toBeGreaterThan(400);
      expect(Math.abs(group.filter(s => s.team === team).length / group.length - fraction)).toBeLessThan(.05);
    }
    const shader = { uniforms: {}, vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>', fragmentShader: '#include <map_fragment>' };
    crowd.meshes.find(mesh => mesh.material.name === 'AudienceDetail_BLG').material.onBeforeCompile(shader);
    expect(shader.vertexShader).toContain('_cm_uniformSwap');expect(shader.fragmentShader).toContain('crowdAlternateColor');
    crowd.dispose();expect(geometries.every(geometry => !geometry.getAttribute('_cm_uniformSwap'))).toBe(true);
    crowd = createCrowdMotion(root, ctx);expect(inspect()).toEqual(actual);crowd.dispose();
    config.uniformSides = { ...settings, favoredFraction: 1 };crowd = createCrowdMotion(root, ctx);
    const extreme = Object.values(inspect().lower), left = extreme.filter(s => s.z <= -half), right = extreme.filter(s => s.z >= half);
    expect(left.every(s => s.team === 'GEN.G')).toBe(true);expect(right.every(s => s.team === 'BLG')).toBe(true);
    const middleLeft = extreme.filter(s => s.z < 0 && s.z > -half), middleRight = extreme.filter(s => s.z > 0 && s.z < half);
    for (const group of [middleLeft, middleRight]) expect(group.some(s => s.team === 'BLG') && group.some(s => s.team === 'GEN.G')).toBe(true);
    expect(middleLeft.filter(s => s.team === 'BLG').length / middleLeft.length).toBeLessThan(.4);
    expect(middleRight.filter(s => s.team === 'BLG').length / middleRight.length).toBeGreaterThan(.6);
  } finally {
    crowd?.dispose();for (const geometry of geometries) geometry.dispose();for (const material of materials) material.dispose();face.geometry.dispose();face.material.dispose();
    for (const [key, value] of Object.entries(originals)) if (value === undefined) delete globalThis[key];else globalThis[key] = value;
  }
});

test('T77 CPU: seated motion settings reach the shader only through seat events and detach on dispose', async () => {
  const config = JSON.parse(readFileSync(new URL('../web/config/crowd.json', import.meta.url), 'utf8'));
  expect(config.seatedMotion.amplitude).toBeGreaterThan(1);
  expect(config.seatedMotion.tempoVariation).toBeGreaterThan(0);
  expect(config.seatedMotion.tempoVariation).toBeLessThan(1);
  delete config.density;delete config.impostor;
  const source = readFileSync(new URL('../web/crowd-motion.js', import.meta.url), 'utf8')
    .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href))
    .replace("'./events.js'", JSON.stringify(new URL('../web/events.js', import.meta.url).href))
    .replaceAll('import.meta.url', JSON.stringify(new URL('../web/crowd-motion.js', import.meta.url).href));
  const { createCrowdMotion } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const originals = Object.fromEntries(['window', 'Audio', 'fetch'].map(key => [key, globalThis[key]]));
  let crowd;
  try {
    globalThis.window = new EventTarget();
    globalThis.Audio = class { pause() {} };
    globalThis.fetch = () => new Promise(() => {});
    const root = new THREE.Group(), geometry = new THREE.BoxGeometry(.3, .5, .2);
    for (const [name, values] of Object.entries({ _cm_origin: [0, 0, 0], _cm_right: [1, 0, 0], _cm_front: [0, -1, 0], _cm_part: [1], _cm_side: [0], _cm_seed: [.5], _cm_style: [0] })) {
      geometry.setAttribute(name, new THREE.Float32BufferAttribute(Array.from({ length: geometry.attributes.position.count }, () => values).flat(), values.length));
    }
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());root.add(mesh);root.updateMatrixWorld(true);
    const events = new EventTarget(), ctx = { events, camera: new THREE.PerspectiveCamera(), config: name => name === 'crowd' ? config : {} };
    crowd = createCrowdMotion(root, ctx);
    const shader = { uniforms: {}, vertexShader: '#include <beginnormal_vertex>\n#include <begin_vertex>', fragmentShader: '' };
    mesh.material.onBeforeCompile(shader);
    expect(shader.uniforms.crowdAmplitude.value).toBe(config.seatedMotion.amplitude);
    expect(shader.uniforms.crowdTempoVariation.value).toBe(config.seatedMotion.tempoVariation);
    expect(shader.uniforms.crowdSeated.value).toBe(false);
    events.dispatchEvent(new Event('screen:state'));crowd.update(performance.now());
    expect(shader.uniforms.crowdSeated.value).toBe(false);
    for (let i = 0; i < 3; i++) {
      events.dispatchEvent(new Event('seat:enter'));
      expect(shader.uniforms.crowdSeated.value).toBe(true);
      events.dispatchEvent(new Event('seat:exit'));
      expect(shader.uniforms.crowdSeated.value).toBe(false);
    }
    crowd.dispose();events.dispatchEvent(new Event('seat:enter'));
    expect(shader.uniforms.crowdSeated.value).toBe(false);
    geometry.dispose();mesh.material.dispose();
  } finally {
    crowd?.dispose();
    for (const [key, value] of Object.entries(originals)) if (value === undefined) delete globalThis[key];else globalThis[key] = value;
  }
});

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
  await page.evaluate(() => window.crowdContext.prepareCrowd());
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
  expect(result.upperCount + result.lowerCount).toBeGreaterThan(4000);
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
  await page.waitForFunction(() => arena.character?.ready);
  await page.locator('#enter').click();
  // T80 pauses crowd audio outside; exercise the unchanged volume contract inside.
  await page.evaluate(() => { arena.go('arena');crowdContext.arenaLod.update(); });
  await expect.poll(() => page.evaluate(() => arena.crowd.sounding)).toBe(true);
  await page.evaluate(() => arena.screen.setVolume(35));
  expect(await page.evaluate(() => arena.crowd.audio.volume)).toBeCloseTo(.15);
  await page.evaluate(() => arena.screen.setMuted(true));
  expect(await page.evaluate(() => arena.crowd.sounding)).toBe(false);
  await page.evaluate(() => arena.screen.setMuted(false));
  await expect.poll(() => page.evaluate(() => arena.crowd.sounding)).toBe(true);
  expect(await page.evaluate(() => arena.crowd.audio.volume)).toBeCloseTo(.15);
});

test('crowd density is repeatable and preloaded models display only inside the configured range', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await openArena(page);
  // T80 suspends hidden outdoor crowd LOD; distance/upload checks require an indoor viewer.
  await page.evaluate(() => { arena.go('arena');crowdContext.arenaLod.update(); });
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
    const close = { active: chunk.near, uploaded: uploads === 0,
      models: chunk.details.length, hiddenCards: chunk.seats.every(seat => crowd.lod.impostors.geometry.getAttribute('crowdShow').getX(seat.card) === 0) };
    camera.position.set(-200, 30, 0);crowd.update(performance.now());
    const released = chunk.details.length === 0 && !chunk.near;
    const { THREE, root } = crowdContext, pictureScene = new THREE.Scene(), picture = crowd.lod.impostors.clone();
    picture.geometry = picture.geometry.clone();
    picture.count = 1;picture.frustumCulled = false;picture.matrixAutoUpdate = false;picture.matrix.copy(root.matrixWorld);pictureScene.add(picture);
    const matrix = new THREE.Matrix4();picture.getMatrixAt(0, matrix);
    const p = new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(root.matrixWorld);
    const view = new THREE.OrthographicCamera(-.6, .6, .8, -.8, .1, 20);view.position.copy(p).add(new THREE.Vector3(0, 0, 4));view.lookAt(p);
    crowdContext.player.position.set(p.x * 3, 0, p.z * 3);crowd.update(performance.now());
    const targetTexture = new THREE.WebGLRenderTarget(96, 128);
    const pixels = time => {
      crowd.seek(time);renderer.setRenderTarget(targetTexture);renderer.render(pictureScene, view);
      const data = new Uint8Array(96 * 128 * 4);renderer.readRenderTargetPixels(targetTexture, 0, 0, 96, 128, data);return data;
    };
    const idle = pixels(0), cheer = pixels(14), picturePixels = idle.filter((value, i) => i % 4 === 3 && value > 0).length;
    const pictureStatic = idle.every((value, i) => value === cheer[i]);
    crowdContext.events.dispatchEvent(new Event('seat:enter'));
    const nearSeated = pixels(1), nearSeatedLater = pixels(2.25), pictureNearSeatedStatic = nearSeated.every((value, i) => value === nearSeatedLater[i]);
    crowdContext.player.position.set(-p.x * 3, 0, -p.z * 3);crowd.update(performance.now());
    const seated = pixels(1), later = pixels(2.25), pictureSeatedMoves = seated.some((value, i) => value !== later[i]);
    crowdContext.events.dispatchEvent(new Event('seat:exit'));
    const standing = pixels(1), standingLater = pixels(2.25), pictureStandingMoves = standing.some((value, i) => value !== standingLater[i]);
    crowdContext.player.position.set(p.x * 3, 0, p.z * 3);crowd.update(performance.now());
    const pictureRestored = pixels(2.25).every((value, i) => value === idle[i]);
    const cardChecks = [];
    for (const upper of [false, true]) {
      const seat = crowd.lod.chunks.flatMap(chunk => chunk.seats).find(seat => seat.upper === upper);
      crowd.lod.impostors.getMatrixAt(seat.card, matrix);picture.setMatrixAt(0, matrix);picture.instanceMatrix.needsUpdate = true;
      for (const name of ['crowdPortrait', 'crowdFacing']) {
        const from = crowd.lod.impostors.geometry.getAttribute(name), to = picture.geometry.getAttribute(name);
        for (let axis = 0; axis < from.itemSize; axis++) to.array[axis] = from.array[seat.card * from.itemSize + axis];
        to.needsUpdate = true;
      }
      p.setFromMatrixPosition(matrix).applyMatrix4(root.matrixWorld);view.position.copy(p).z += 4;view.lookAt(p);
      const changes = () => { const a = pixels(1), b = pixels(2.25);return b.reduce((n, v, i) => n + (v !== a[i]), 0); };
      for (const seated of [false, true]) {
        crowdContext.events.dispatchEvent(new Event(seated ? 'seat:enter' : 'seat:exit'));
        crowdContext.player.position.set(p.x * 3, 0, p.z * 3);crowd.update(performance.now());const near = changes();
        crowdContext.player.position.set(-p.x * 3, 0, -p.z * 3);crowd.update(performance.now());const far = changes();
        crowdContext.player.position.set(p.x * 3, 0, p.z * 3);crowd.update(performance.now());const returned = changes();
        cardChecks.push({ upper, seated, near, far, returned, visible: pixels(1).filter((v, i) => i % 4 === 3 && v > 0).length });
      }
    }
    renderer.setRenderTarget(null);targetTexture.dispose();picture.geometry.dispose();picture.dispose();
    const inClearedZones = crowd.lod.chunks.flatMap(chunk => chunk.seats).filter(seat => config.clearZones.some(zone => seat.position.toArray().every((value, axis) => value >= zone.min[axis] && value <= zone.max[axis]))).length;
    const seats = crowd.lod.chunks.flatMap(chunk => chunk.seats), face = arena.screen.faces.find(face => face.name === crowdContext.config('screen').videoFace);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...face.normal)).normalize(), center = new THREE.Vector3(...face.position);
    const uniforms = seats.map(seat => ({ upper: seat.upper, team: seat.team, original: seat.originalTeam, side: seat.position.clone().sub(center).dot(right), portrait: seat.portrait }));
    const lowerSeats = seats.filter(seat => !seat.upper), pairs = { BLG: 'GEN.G', 'GEN.G': 'BLG', Black: 'White', White: 'Black', Gold: 'Cyan', Cyan: 'Gold' };
    let modelMatchesSeats = true, accessoriesUnchanged = true, jerseyCount = 0;
    for (const mesh of crowd.meshes) {
      const name = mesh.material.name.slice('AudienceDetail_'.length);if (!pairs[name]) continue;
      const a = mesh.geometry.attributes, seen = new Set(), index = mesh.geometry.index;
      for (let i = 0; i < index.count; i += 3) {
        const v = index.getX(i), part = Math.round(a._cm_part.getX(v)), swap = a._cm_uniformSwap?.getX(v) > .5;
        if (part !== 1 && part !== 3) { accessoriesUnchanged &&= !swap;continue; }
        const key = [a._cm_origin.getX(v), a._cm_origin.getY(v), a._cm_origin.getZ(v), part].join(',');if (seen.has(key)) continue;seen.add(key);
        const position = new THREE.Vector3(a._cm_origin.getX(v), a._cm_origin.getZ(v), -a._cm_origin.getY(v)).applyMatrix4(mesh.matrixWorld);
        const seat = lowerSeats.find(seat => seat.position.distanceToSquared(position) < .025 ** 2);
        modelMatchesSeats &&= !!seat && swap === !!seat.uniformSwap;
        if (name === 'BLG' || name === 'GEN.G') { jerseyCount++;modelMatchesSeats &&= (swap ? pairs[name] : name) === seat?.team; }
      }
    }
    const portraits = new Map();let cardTeamsMatch = true;
    for (const seat of uniforms.filter(seat => !seat.upper)) {
      if (!portraits.has(seat.portrait)) portraits.set(seat.portrait, seat.team);
      cardTeamsMatch &&= portraits.get(seat.portrait) === seat.team;
    }
    const upperUnchanged = crowd.mannequins.every(mesh => {
      const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' };mesh.material.onBeforeCompile(shader);
      return !shader.uniforms.crowdAlternateColor && !mesh.geometry.getAttribute('_cm_uniformSwap');
    });
    return { density, config, inClearedZones, distant, close, released, sourcesHidden: sources.every(mesh => !mesh.visible),
      cards: crowd.lod.impostors.count, sourceCounts: crowd.stats, picturePixels, pictureStatic, pictureSeatedMoves, pictureStandingMoves, pictureNearSeatedStatic, pictureRestored, cardChecks,
      uniforms, modelMatchesSeats, accessoriesUnchanged, jerseyCount, cardTeamsMatch, upperUnchanged };
  });
  expect(result.lod).not.toBe(false);
  // T75 제거 530명: ramp-A 157 + ramp-B 163 + entry 116 + stair-7 47 + stair-9 47; T75 최종 GLB 기준으로 T83이 다시 확인.
  expect(result.density.original).toEqual({ lower: 3943, upper: 7919 });
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
  expect(result.pictureSeatedMoves).toBe(true);
  expect(result.pictureStandingMoves).toBe(true);
  expect(result.pictureNearSeatedStatic).toBe(true);
  expect(result.pictureRestored).toBe(true);
  for (const card of result.cardChecks) {
    expect(card.visible).toBeGreaterThan(100);expect(card.near).toBe(0);expect(card.far).toBeGreaterThan(0);expect(card.returned).toBe(0);
  }
  const half = result.config.uniformSides.centerBandWidth / 2, lower = result.uniforms.filter(seat => !seat.upper);
  for (const [group, team, fraction, tolerance] of [[lower.filter(s => s.side < -half), 'GEN.G', result.config.uniformSides.favoredFraction, .05], [lower.filter(s => s.side > half), 'BLG', result.config.uniformSides.favoredFraction, .05], [lower.filter(s => Math.abs(s.side) <= half), 'BLG', .5, .08]]) {
    expect(group.length).toBeGreaterThan(50);
    expect(Math.abs(group.filter(s => s.team === team).length / group.length - fraction)).toBeLessThan(tolerance);
    expect(group.some(s => s.team === 'GEN.G') && group.some(s => s.team === 'BLG')).toBe(true);
  }
  expect(result.uniforms.filter(seat => seat.upper).every(seat => seat.team === seat.original)).toBe(true);
  expect(result.jerseyCount).toBe(result.sourceCounts.lowerSpectators);
  expect(result.modelMatchesSeats && result.accessoriesUnchanged && result.cardTeamsMatch && result.upperUnchanged).toBe(true);
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
    const ctx = { THREE, scene, camera, root, events, player: { position: new THREE.Vector3(0, 0, 30) }, config: name => name === 'crowd' ? config : { crowdVolume: .3, volume: 70 } };
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

test('the rendered upper pose freezes nearby, moves across the arena and the far shader samples the reduced map', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openFixture(page);
  const result = await page.evaluate(() => {
    const { THREE, crowd, root, scene, camera, ctx } = window.fixture;
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
    ctx.player.position.set(0, 0, -30);
    const nearUpper = render(1), nearUpperLater = render(14), nearUpperStatic = nearUpper.every((value, i) => value === nearUpperLater[i]);
    ctx.player.position.set(0, 0, 30);
    const idle = render(0), swayStart = render(1), swayEnd = render(2.25), cheer = render(14), settled = render(20), second = render(25), wrapped = render(30), wrappedCheer = render(44);
    const difference = pixels => pixels.reduce((n, value, i) => n + (value !== idle[i]), 0);
    const upper = { visible: idle.filter((v, i) => i % 4 !== 3 && v > 0).length, variation: variation(idle), sway: swayEnd.reduce((n, value, i) => n + (value !== swayStart[i]), 0), cheer: difference(cheer), settled: difference(settled), second: difference(second), wrapped: difference(wrapped), wrappedCheer: wrappedCheer.every((v, i) => v === cheer[i]) };
    root.children.forEach(mesh => { mesh.visible = false; });root.children[1].visible = true;
    view.position.set(11, 1.1, 2);view.lookAt(10, .75, 0);
    camera.position.set(30, 2, 0);const nearPixels = render(0), near = variation(nearPixels);
    const lowerMoves = render(11.25).some((value, i) => value !== nearPixels[i]);
    camera.position.set(-30, 2, 0);const far = variation(render(0));
    const edges = [59, 61].map(degrees => { camera.position.set(-30 * Math.cos(degrees * Math.PI / 180), 2, -30 * Math.sin(degrees * Math.PI / 180));return variation(render(0)); });
    renderer.dispose();target.dispose();
    return { upper, near, far, edges, lowerMoves, nearUpperStatic };
  });
  console.log('T86 upper pose and texture:', JSON.stringify(result));
  expect(result.upper.visible).toBeGreaterThan(0);
  expect(result.upper.variation).toBeLessThan(5);
  expect(result.nearUpperStatic).toBe(true);
  expect(result.upper.sway).toBeGreaterThan(0);
  expect(result.upper.settled).toBeGreaterThan(0);
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

test('T77 GPU: seated lower and instanced upper spectators move in view and freeze outside it', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openFixture(page);
  const results = await page.evaluate(() => {
    const { THREE, crowd, root, scene, ctx } = fixture;
    const renderer = new THREE.WebGLRenderer(), target = new THREE.WebGLRenderTarget(128, 128);
    renderer.setRenderTarget(target);
    const view = new THREE.PerspectiveCamera(50, 1, .1, 200), observer = new THREE.OrthographicCamera(-.4, .4, .4, -.4, .1, 10);
    const probe = { value: new THREE.Matrix4() };
    // Observe the same body while the real view matrix tests visible, offscreen and behind-camera seats.
    for (const material of new Set([...crowd.meshes, ...crowd.mannequins].map(mesh => mesh.material))) {
      const compile = material.onBeforeCompile;
      material.onBeforeCompile = shader => {
        compile(shader);shader.uniforms.probe = probe;
        shader.vertexShader = 'uniform mat4 probe;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
          vec4 observed=vec4(transformed,1.);
          #ifdef USE_INSTANCING
           observed=instanceMatrix*observed;
          #endif
          gl_Position=probe*modelMatrix*observed;`);
      };
    }
    const render = time => {
      crowd.seek(time);crowd.update(performance.now());renderer.render(scene, view);
      const pixels = new Uint8Array(128 * 128 * 4);renderer.readRenderTargetPixels(target, 0, 0, 128, 128, pixels);return pixels;
    };
    const difference = () => { const a = render(1), b = render(2.25);return b.reduce((n, v, i) => n + (v !== a[i]), 0); };
    const results = [];
    for (const upper of [false, true]) {
      root.children.forEach(mesh => { mesh.frustumCulled = false;mesh.visible = upper ? !!mesh.userData.crowdMannequin : mesh === crowd.meshes[1]; });
      const p = new THREE.Vector3(...(upper ? [0, 6.75, -10] : [10, .75, 0]));
      ctx.player.position.set(-p.x * 3, 0, -p.z * 3);
      observer.position.copy(p).z += 2;observer.lookAt(p);observer.updateMatrixWorld(true);
      probe.value.multiplyMatrices(observer.projectionMatrix, observer.matrixWorldInverse);
      view.position.copy(observer.position);view.lookAt(p);
      const visible = render(1).some((v, i) => i % 4 === 3 && v > 0);
      const walking = difference();ctx.events.dispatchEvent(new Event('seat:enter'));
      const seated = difference();view.lookAt(p.clone().add(new THREE.Vector3(20, 0, 0)));
      const offscreen = difference(), offscreenObserved = render(1).some((v, i) => i % 4 === 3 && v > 0);
      view.lookAt(view.position.clone().add(new THREE.Vector3(0, 0, 1)));
      const behind = difference();ctx.events.dispatchEvent(new Event('seat:exit'));
      view.lookAt(p);
      const restored = difference();results.push({ upper, visible, walking, seated, offscreen, offscreenObserved, behind, restored });
    }
    renderer.dispose();target.dispose();return results;
  });
  console.log('T77 view gating:', JSON.stringify(results));
  for (const result of results) {
    expect(result.visible).toBe(true);
    expect(result.seated).toBeGreaterThan(0);
    expect(result.offscreen).toBe(0);
    expect(result.offscreenObserved).toBe(true);
    expect(result.behind).toBe(0);
    expect(result.restored).toBe(result.walking);
  }
  expect(results.find(result => result.upper).walking).toBeGreaterThan(0);
  expect(results.find(result => !result.upper).walking).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('T86 GPU: both tiers move opposite the player, near upper freezes and switching sides switches motion', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await openFixture(page);
  const results = await page.evaluate(() => {
    const { THREE, crowd, root, scene, ctx } = fixture, zone = ctx.config('crowd').motionZone;
    // Camera-driven texture LOD must not change the silhouette comparison.
    for (const material of new Set([...crowd.meshes, ...crowd.mannequins].map(mesh => mesh.material))) material.map = null;
    const renderer = new THREE.WebGLRenderer(), target = new THREE.WebGLRenderTarget(128, 128), view = new THREE.OrthographicCamera(-.4, .4, .4, -.4, .1, 10);
    renderer.setRenderTarget(target);
    const pixels = time => { crowd.seek(time);crowd.update(performance.now());renderer.render(scene, view);const data = new Uint8Array(128 * 128 * 4);renderer.readRenderTargetPixels(target, 0, 0, 128, 128, data);return data; };
    const changes = () => { const a = pixels(1), b = pixels(14);return b.reduce((n, v, i) => n + (v !== a[i]), 0); };
    const results = [];
    for (const upper of [false, true]) {
      root.children.forEach(mesh => { mesh.visible = upper ? !!mesh.userData.crowdMannequin : mesh === crowd.meshes[1]; });
      const p = new THREE.Vector3(...(upper ? [0, 6.75, -10] : [10, .75, 0]));
      view.position.copy(p).z += 2;view.lookAt(p);
      for (const seated of [false, true]) {
        ctx.events.dispatchEvent(new Event(seated ? 'seat:enter' : 'seat:exit'));
        ctx.player.position.set(p.x * 3, 0, p.z * 3);const near = changes();
        ctx.camera.position.set(-p.x * 3, 2, -p.z * 3);const cameraOnly = changes();
        ctx.player.position.set(-p.x * 3, 0, -p.z * 3);const far = changes();
        ctx.player.position.set(p.x * 3, 0, p.z * 3);const returned = changes();
        const edges = [zone.halfAngleDegrees - 1, zone.halfAngleDegrees + 1, -zone.halfAngleDegrees + 1, -zone.halfAngleDegrees - 1].map(degrees => {
          ctx.player.position.set(p.x * 3, 0, p.z * 3);crowd.update(performance.now());
          const angle = Math.atan2(p.z, p.x) + degrees * Math.PI / 180;
          ctx.player.position.set(-30 * Math.cos(angle), 0, -30 * Math.sin(angle));return changes();
        });
        results.push({ upper, seated, near, cameraOnly, far, returned, edges, visible: pixels(1).some((v, i) => i % 4 === 3 && v > 0) });
      }
    }
    renderer.dispose();target.dispose();return results;
  });
  console.log('T86 player motion:', JSON.stringify(results));
  for (const result of results) {
    expect(result.visible).toBe(true);
    expect(result.far).toBeGreaterThan(0);
    expect(result.cameraOnly).toBe(result.near);
    expect(result.returned).toBe(result.near);
    if (result.upper) { expect(result.near).toBe(0);expect(result.edges.map(n => n > 0)).toEqual([true, false, true, false]); }
    else expect(result.near).toBeGreaterThan(0);
  }
  expect(errors).toEqual([]);
});
