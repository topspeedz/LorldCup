import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../web/config/sky-show.json', import.meta.url), 'utf8'));

async function harness(page, overrides = {}, random = .5) {
  await page.route('**/main.js', route => route.fulfill({ contentType: 'text/javascript', body: '' }));
  await page.goto('/');
  await page.evaluate(async ({ overrides, random }) => {
    const THREE = await import('/vendor/three.module.js'), { create } = await import('/sky-show.js');
    const config = await (await fetch('/config/sky-show.json')).json();
    for (const key of Object.keys(overrides)) Object.assign(config[key], overrides[key]);
    const scene = new THREE.Scene(), lighting = await (await fetch('/lighting-config.json')).json();
    for (const source of lighting.lights.filter(light => /^REF_(OverheadBeam|WingUplight)/.test(light.name))) {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({
        uniforms: { beamColor: { value: new THREE.Color(...source.color) } }
      }));
      mesh.name = source.name + '_WebBeam';mesh.visible = false;scene.add(mesh);
    }
    Math.random = () => random;
    const ctx = { THREE, scene, config: () => config };
    const instance = create(ctx);instance.update?.(0, 0);
    window.skyProbe = { ctx, config, create, instance,
      beams: () => scene.getObjectByName('Sky_Show')?.children.filter(object => object.isMesh) || [],
      bursts: () => scene.getObjectByName('Sky_Show')?.children.filter(object => object.isPoints) || [] };
  }, { overrides, random });
}

test('sky show retains the approved beam and firework defaults', () => {
  expect(config.beams).toMatchObject({ count: 3, periodSeconds: 8, angleDegrees: 25, opacity: .055 });
  expect(config.fireworks).toMatchObject({ intervalSeconds: [20, 40], count: [1, 3] });
});

test('three upward diagonal beams sweep both ways in eight seconds at 30, 60 and 144 Hz', async ({ page }) => {
  await harness(page);
  const result = await page.evaluate(() => {
    const { ctx, create, beams } = skyProbe, samples = [];
    if (beams().length !== 3) return { count: beams().length };
    for (const rate of [30, 60, 144]) {
      skyProbe.instance.dispose();const instance = create(ctx);skyProbe.instance = instance;instance.update(0, 0);
      const angles = [];
      for (let step = 1; step <= rate * 8; step++) {
        instance.update(1 / rate, step * 1000 / rate);
        if (step % (rate * 2) === 0) angles.push(beams().map(beam => beam.rotation.y * 180 / Math.PI));
      }
      samples.push(angles);
    }
    return { count: beams().length, samples, upward: beams().every(beam => {
      const direction = new ctx.THREE.Vector3(0, 1, 0).applyQuaternion(beam.quaternion);
      return direction.y > 0 && Math.hypot(direction.x, direction.z) > .1;
    }), opacity: beams().map(beam => beam.material.uniforms.opacity.value),
    depth: beams().every(beam => beam.material.depthTest && !beam.material.depthWrite) };
  });
  expect(result.count).toBe(3);
  expect(result.upward).toBe(true);
  expect(result.depth).toBe(true);
  expect(result.opacity).toEqual([.055, .055, .055]);
  for (const samples of result.samples) for (const [i, angles] of samples.entries()) {
    for (const angle of angles) expect(angle).toBeCloseTo([25, 0, -25, 0][i], 5);
  }
});

for (const [random, interval, count] of [[0, 20, 1], [.999999, 40, 3]]) {
  test(`fireworks wait ${interval} seconds and repeat ${count} separate bursts without leaking`, async ({ page }) => {
    await harness(page, {}, random);
    const result = await page.evaluate(({ interval }) => {
      const { instance, bursts, config } = skyProbe;
      if (!instance.update) return { missing: true };
      const active = () => bursts().filter(burst => burst.visible);
      instance.update(0, (interval - .001) * 1000);const before = active().length;
      instance.update(.001, interval * 1000);const first = active();
      const positions = first.map(burst => burst.position.toArray());
      const initial = first.map(burst => [...burst.geometry.attributes.position.array]);
      instance.update(.6, interval * 1000 + 600);
      const moved = first.every((burst, i) => burst.geometry.attributes.position.array.some((value, j) => Math.abs(value - initial[i][j]) > .01));
      const fading = first.every(burst => burst.material.opacity > 0 && burst.material.opacity < config.fireworks.opacity);
      const finite = first.every(burst => burst.geometry.attributes.position.array.every(Number.isFinite));
      instance.update(.6, interval * 1000 + config.fireworks.lifetimeSeconds * 1000);const expired = active().length;
      instance.update(0, interval * 2000 - 1);const beforeSecond = active().length;
      instance.update(.001, interval * 2000);const second = active().length;
      const resources = bursts().map(burst => [burst.geometry.id, burst.material.id]);
      for (let event = 3; event <= 30; event++) instance.update(interval, interval * event * 1000);
      return { before, first: first.length, positions, moved, fading, finite, expired, beforeSecond, second,
        resourcesStable: JSON.stringify(resources) === JSON.stringify(bursts().map(burst => [burst.geometry.id, burst.material.id])),
        pool: bursts().length };
    }, { interval });
    expect(result.missing).not.toBe(true);
    expect(result.before).toBe(0);
    expect(result.first).toBe(count);
    expect(new Set(result.positions.map(position => JSON.stringify(position))).size).toBe(count);
    expect(result.moved).toBe(true);
    expect(result.fading).toBe(true);
    expect(result.finite).toBe(true);
    expect(result.expired).toBe(0);
    expect(result.beforeSecond).toBe(0);
    expect(result.second).toBe(count);
    expect(result.resourcesStable).toBe(true);
    expect(result.pool).toBe(3);
  });
}

test('settings drive timing, angle, opacity and burst count', async ({ page }) => {
  await harness(page, { beams: { periodSeconds: 4, angleDegrees: 10, opacity: .03 }, fireworks: { intervalSeconds: [2, 2], count: [2, 2] } });
  const result = await page.evaluate(() => {
    const { instance, beams, bursts } = skyProbe;
    if (!instance.update) return { missing: true };
    instance.update(1, 1000);
    const angle = beams()[0].rotation.y * 180 / Math.PI, opacity = beams()[0].material.uniforms.opacity.value;
    instance.update(1, 2000);return { angle, opacity, count: bursts().filter(burst => burst.visible).length };
  });
  expect(result.missing).not.toBe(true);
  expect(result.angle).toBeCloseTo(10, 5);
  expect(result.opacity).toBe(.03);
  expect(result.count).toBe(2);
});

test('hidden tabs pause the show, resume without catch-up and dispose only owned resources', async ({ page }) => {
  await harness(page, {}, 0);
  const result = await page.evaluate(() => {
    const { ctx, instance, beams, bursts } = skyProbe;
    if (!instance.update) return { missing: true };
    const owned = new Set([...beams(), ...bursts()].flatMap(object => [object.geometry, object.material]));
    const disposed = new Set();for (const resource of owned) resource.addEventListener('dispose', () => disposed.add(resource));
    const shared = ctx.scene.children.filter(object => object.name.startsWith('REF_'));let sharedDisposed = 0;
    for (const object of shared) object.material.addEventListener('dispose', () => sharedDisposed++);
    instance.update(2, 2000);const angle = beams()[0].rotation.y;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));instance.update(30, 32000);
    const paused = beams()[0].rotation.y === angle && bursts().every(burst => !burst.visible);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));instance.update(30, 62000);
    const resumed = beams()[0].rotation.y === angle && bursts().every(burst => !burst.visible);
    instance.update(1, 63000);const moving = beams()[0].rotation.y !== angle;
    instance.update(1000, 1063000);const bounded = bursts().filter(burst => burst.visible).length;
    instance.dispose();instance.dispose();instance.update(1, 1064000);
    document.dispatchEvent(new Event('visibilitychange'));
    return { paused, resumed, moving, bounded, owned: owned.size, disposed: disposed.size, sharedDisposed,
      removed: !ctx.scene.getObjectByName('Sky_Show'), sharedRemain: shared.every(object => object.parent === ctx.scene) };
  });
  expect(result.missing).not.toBe(true);
  expect(result.paused).toBe(true);
  expect(result.resumed).toBe(true);
  expect(result.moving).toBe(true);
  expect(result.bounded).toBe(1);
  expect(result.disposed).toBe(result.owned);
  expect(result.sharedDisposed).toBe(0);
  expect(result.removed).toBe(true);
  expect(result.sharedRemain).toBe(true);
});

test('reduced motion keeps three fixed beams and fading stationary sparks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await harness(page, {}, 0);
  const result = await page.evaluate(() => {
    const { instance, beams, bursts } = skyProbe;
    if (!instance.update) return { missing: true };
    const angles = beams().map(beam => beam.rotation.y);instance.update(20, 20000);
    const active = bursts().filter(burst => burst.visible), positions = [...active[0].geometry.attributes.position.array];
    instance.update(.6, 20600);
    return { beams: beams().length, fixed: beams().every((beam, i) => beam.rotation.y === angles[i]),
      count: active.length, stationary: active[0].geometry.attributes.position.array.every((value, i) => value === positions[i]),
      faded: active[0].material.opacity < skyProbe.config.fireworks.opacity };
  });
  expect(result.missing).not.toBe(true);
  expect(result.beams).toBe(3);
  expect(result.fixed).toBe(true);
  expect(result.count).toBe(1);
  expect(result.stationary).toBe(true);
  expect(result.faded).toBe(true);
});

test('the real arena renders the outdoor show with stage colors and releases GPU resources', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/THREE.WebGLProgram: Shader Error/.test(message.text())) errors.push(message.text()); });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const entry=modules.find(module=>module.path==='sky-show.js'),create=entry.create;
      entry.create=ctx=>{const instance=create(ctx);window.skyProbe={ctx,create,instance};return {dispose:()=>instance.dispose?.()};};` });
  });
  await page.goto('/');await page.waitForFunction(() => window.arena?.ready);
  const result = await page.evaluate(() => {
    const { ctx, instance, create } = skyProbe, { THREE, scene, renderer } = ctx;
    const group = scene.getObjectByName('Sky_Show');if (!group) return { missing: true };
    const beams = group.children.filter(object => object.isMesh), bursts = group.children.filter(object => object.isPoints);
    const palette = [];scene.traverse(object => { if (/^REF_(OverheadBeam|WingUplight).*_WebBeam$/.test(object.name)) palette.push(object.material.uniforms.beamColor.value); });
    const camera = new THREE.PerspectiveCamera(68, 16 / 9, .08, 650);camera.position.set(-139, 1.7, 0);camera.lookAt(-190, 38, 0);
    const target = new THREE.WebGLRenderTarget(480, 270);
    const pixels = () => { renderer.setRenderTarget(target);renderer.render(scene, camera);const bytes = new Uint8Array(480 * 270 * 4);renderer.readRenderTargetPixels(target, 0, 0, 480, 270, bytes);return bytes; };
    const difference = (a, b) => { let count = 0;for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 3) count++;return count; };
    instance.update(0, 0);group.visible = false;const background = pixels();group.visible = true;
    const beamPixels = difference(pixels(), background);
    const savedRandom = Math.random;let randomCalls = 0;Math.random = () => randomCalls++ === 0 ? .999999 : savedRandom();
    instance.update(40, 40000);instance.update(.6, 40600);Math.random = savedRandom;
    const lit = pixels();bursts.forEach(burst => { burst.visible = false; });const fireworkPixels = difference(lit, pixels());
    const metrics = { ...renderer.info.memory, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
    const ownScene = new THREE.Scene();ownScene.add(group);bursts.forEach(burst => { burst.visible = true; });renderer.render(ownScene, camera);
    const effect = { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, points: renderer.info.render.points };scene.add(group);
    const colorsReused = beams.every(beam => palette.some(color => color.equals(beam.material.uniforms.beamColor.value)));
    const positions = beams.map(beam => beam.position.toArray());
    const memories = [];
    instance.dispose();renderer.render(scene, camera);memories.push({ ...renderer.info.memory });
    for (let i = 0; i < 3; i++) { const next = create(ctx);next.update(0, 0);next.update(40, 40000);renderer.render(scene, camera);next.dispose();renderer.render(scene, camera);memories.push({ ...renderer.info.memory }); }
    renderer.setRenderTarget(null);target.dispose();return { beamPixels, fireworkPixels, colorsReused, positions, metrics, effect, memories };
  });
  console.log('T25 rendered sky show:', JSON.stringify(result));
  expect(result.missing).not.toBe(true);
  expect(result.positions).toHaveLength(3);
  expect(result.positions.every(position => position[0] < -96)).toBe(true);
  expect(result.colorsReused).toBe(true);
  expect(result.beamPixels).toBeGreaterThan(30);
  expect(result.fireworkPixels).toBeGreaterThan(2);
  for (const memory of result.memories) expect(memory).toEqual(result.memories[0]);
  expect(errors).toEqual([]);
});
