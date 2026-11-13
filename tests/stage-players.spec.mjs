import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../web/config/stage-players.json', import.meta.url), 'utf8'));
const actions = ['hair', 'keyboard', 'look', 'mouse', 'shout'];

async function openArena(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (/THREE.WebGLProgram: Shader Error/.test(message.text())) errors.push(message.text());
  });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const entry=modules.find(m=>m.path==='stage-players.js'),original=entry.create;
      entry.create=ctx=>{
        const saved=[];ctx.root.traverse(mesh=>{
          if(mesh.isMesh&&mesh.name.startsWith('REF_Player'))saved.push({mesh,geometry:mesh.geometry,material:mesh.material});
        });
        const instance=original(ctx);window.stageProbe={ctx,instance,saved};
        return {dispose:()=>instance.dispose?.()};
      };` });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
  return errors;
}

test('ten real players retain their geometry and show five distinct joint motions', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await openArena(page);
  const result = await page.evaluate(() => {
    const { ctx, instance, saved } = stageProbe, { THREE } = ctx;
    if (!instance.players) return { missing: true, sourceMeshes: saved.length };
    const players = instance.players;
    const sourceTriangles = saved.reduce((sum, { geometry }) => sum + (geometry.index?.count ?? geometry.attributes.position.count) / 3, 0);
    const runtimeTriangles = saved.reduce((sum, { mesh }) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    const unchangedAtRest = saved.every(({ mesh, geometry }) =>
      mesh.geometry.attributes.position.array.every((v, i) => v === geometry.attributes.position.array[i]));
    const head = saved.find(({ mesh }) => mesh.name.startsWith('REF_PlayerHeads'));
    const hands = saved.find(({ mesh }) => mesh.name.startsWith('REF_PlayerHands'));
    const legs = saved.filter(({ mesh }) => /REF_Player(Thighs|Shins|Shoes|Pelvis)/.test(mesh.name));
    const sample = new THREE.Scene();sample.background = new THREE.Color('#202020');
    sample.add(new THREE.HemisphereLight(0xffffff, 0x777777, 3));
    for (const { mesh } of saved) {
      const copy = mesh.clone();copy.matrix.copy(mesh.matrixWorld);copy.matrixAutoUpdate = false;sample.add(copy);
    }
    const camera = new THREE.PerspectiveCamera(45, 1, .05, 100);
    const jersey = saved.find(({ mesh }) => mesh.name.startsWith('REF_PlayerJersey_'));
    const center = new THREE.Box3().setFromObject(jersey.mesh).getCenter(new THREE.Vector3());center.y += .6;
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(head.mesh.matrixWorld);
    camera.position.copy(center).addScaledVector(forward, 4).add(new THREE.Vector3(0, .6, 0));camera.lookAt(center);
    const target = new THREE.WebGLRenderTarget(256, 256);
    const pixels = () => {
      ctx.renderer.setRenderTarget(target);ctx.renderer.render(sample, camera);
      const data = new Uint8Array(256 * 256 * 4);ctx.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, data);return data;
    };
    const rest = pixels(), evidence = {};
    let now = 0;instance.update(0, now);
    for (const action of ['mouse', 'keyboard', 'look', 'shout', 'hair']) {
      for (const player of players) { player.action = action;player.elapsed = 0;player.duration = 8; }
      for (let i = 0; i < 7; i++) { now += 100;instance.update(.1, now); }
      const data = pixels();let changedPixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.abs(data[i] - rest[i]) + Math.abs(data[i + 1] - rest[i + 1]) + Math.abs(data[i + 2] - rest[i + 2]) > 5) changedPixels++;
      }
      const displacement = ({ mesh, geometry }) => {
        const a = mesh.geometry.attributes.position.array, b = geometry.attributes.position.array;let maximum = 0;
        for (let i = 0; i < a.length; i += 3) maximum = Math.max(maximum, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]));
        return maximum;
      };
      evidence[action] = { changedPixels, head: displacement(head), hands: displacement(hands),
        legs: Math.max(...legs.map(displacement)), finite: saved.every(({ mesh }) => mesh.geometry.attributes.position.array.every(Number.isFinite)) };
    }
    ctx.renderer.setRenderTarget(null);target.dispose();
    return { players: players.length, sourceMeshes: saved.length, runtimeTriangles, sourceTriangles, unchangedAtRest,
      materialsRetained: saved.every(({ mesh, material }) => mesh.material === material), evidence,
      metrics: { ...ctx.renderer.info.memory, drawCalls: ctx.renderer.info.render.calls, triangles: ctx.renderer.info.render.triangles } };
  });
  console.log('T26 geometry and rendered motions:', JSON.stringify(result));
  expect(result.missing).not.toBe(true);
  expect(result.players).toBe(10);
  expect(result.sourceMeshes).toBe(49);
  expect(result.runtimeTriangles).toBe(result.sourceTriangles);
  expect(result.unchangedAtRest).toBe(true);
  expect(result.materialsRetained).toBe(true);
  for (const action of actions) {
    expect(result.evidence[action].changedPixels, action).toBeGreaterThan(3);
    expect(result.evidence[action].finite, action).toBe(true);
    expect(result.evidence[action].legs, action).toBeLessThan(.00001);
  }
  expect(result.evidence.mouse.hands).toBeGreaterThan(.005);
  expect(result.evidence.keyboard.hands).toBeGreaterThan(.005);
  expect(result.evidence.look.head).toBeGreaterThan(.02);
  expect(result.evidence.shout.head).toBeGreaterThan(.02);
  expect(result.evidence.hair.hands).toBeGreaterThan(.5);
  expect(errors).toEqual([]);
});

test('random choices change every 3–8 seconds independently at 30, 60 and 144 Hz', async ({ page }) => {
  test.setTimeout(90_000);
  await openArena(page);
  const result = await page.evaluate(async () => {
    const { create } = await import('./stage-players.js');
    const { ctx, instance, saved } = stageProbe;
    if (!instance.players) return { missing: true };
    instance.dispose();
    const runs = [], random = Math.random;
    for (const hz of [30, 60, 144]) {
      const root = new ctx.THREE.Group();
      for (const { mesh } of saved.filter(({ mesh }) => mesh.name.startsWith('REF_PlayerJersey_'))) root.add(mesh.clone());
      let seed = 26;Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
      const module = create({ ...ctx, root });module.update(0, 0);
      const sequences = module.players.map(player => [player.action]), changes = [], violations = [];
      const last = module.players.map(() => 0);let synchronized = 0;
      for (let frame = 1; frame <= hz * 120; frame++) {
        const before = module.players.map(player => player.action), time = frame / hz;
        module.update(1 / hz, time * 1000);
        if (new Set(module.players.map(player => player.action)).size === 1) synchronized++;
        module.players.forEach((player, i) => {
          if (player.action === before[i]) return;
          const interval = time - last[i];
          if (interval < 3 - 1 / hz || interval > 8 + 1 / hz) violations.push(interval);
          last[i] = time;sequences[i].push(player.action);changes.push(time);
        });
      }
      const beforeHidden = module.players.map(player => player.elapsed);
      module.update(30, 150_000);
      const noCatchup = module.players.every((player, i) => player.elapsed - beforeHidden[i] <= .251);
      runs.push({ hz, sequences, violations, synchronized, noCatchup, changes: changes.length,
        variedTimes: new Set(changes.map(time => time.toFixed(2))).size });
      module.dispose();
    }
    Math.random = () => .5;
    const root = new ctx.THREE.Group();
    for (const { mesh } of saved.filter(({ mesh }) => mesh.name.startsWith('REF_PlayerJersey_'))) root.add(mesh.clone());
    const constant = create({ ...ctx, root });constant.update(0, 0);let allSame = false;
    for (let i = 1; i <= 200; i++) {
      constant.update(.1, i * 100);allSame ||= new Set(constant.players.map(player => player.action)).size === 1;
    }
    constant.dispose();Math.random = random;return { runs, allSame };
  });
  expect(config).toMatchObject({ intervalSeconds: [3, 8], shoutProbability: .1 });
  expect(result.missing).not.toBe(true);
  expect(result.allSame).toBe(false);
  for (const run of result.runs) {
    expect(run.violations).toEqual([]);
    expect(run.synchronized).toBe(0);
    expect(run.noCatchup).toBe(true);
    expect(run.changes).toBeGreaterThan(180);
    expect(run.variedTimes).toBeGreaterThan(100);
    for (const sequence of run.sequences) expect([...new Set(sequence)].sort()).toEqual(actions);
  }
  expect(result.runs[1].sequences).toEqual(result.runs[0].sequences);
  expect(result.runs[2].sequences).toEqual(result.runs[0].sequences);
  console.log('T26 random timing:', JSON.stringify(result.runs.map(({ sequences, ...run }) => run)));
});

test('shout produces one positional temporary sound after sound is enabled and respects mute', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await openArena(page);
  expect(await page.evaluate(() => !!stageProbe.instance.players)).toBe(true);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.screen.state.muted)).toBe(false);
  await page.waitForFunction(() => stageProbe.instance.players.every(player => player.sound?.buffer));
  const result = await page.evaluate(async () => {
    const { instance } = stageProbe;
    const random = Math.random;Math.random = () => .05;
    let now = 0;instance.update(0, now);
    for (const player of instance.players) { player.action = 'mouse';player.duration = 3;player.elapsed = 2.95; }
    instance.update(.1, now += 100);
    Math.random = random;
    const shouters = instance.players.filter(player => player.action === 'shout');
    const sound = shouters.find(player => player.sound?.isPlaying)?.sound;
    if (!sound) return { shouters: shouters.length, playing: false };
    const analyser = new stageProbe.ctx.THREE.AudioAnalyser(sound, 256);
    await new Promise(resolve => setTimeout(resolve, 120));
    const energy = analyser.getAverageFrequency();analyser.analyser.disconnect();
    const sources = shouters.map(player => player.sound.source);
    instance.update(.1, now += 100);
    return { shouters: shouters.length, playing: true, positional: sound instanceof stageProbe.ctx.THREE.PositionalAudio,
      running: sound.context.state, duration: sound.buffer.duration, energy,
      oneShot: shouters.every((player, i) => player.sound.source === sources[i]),
      bufferPeak: Math.max(...sound.buffer.getChannelData(0).map(Math.abs)) };
  });
  expect(result.playing).toBe(true);
  expect(result.positional).toBe(true);
  expect(result.running).toBe('running');
  expect(result.duration).toBeGreaterThan(0);
  expect(result.duration).toBeLessThanOrEqual(3);
  expect(result.energy).toBeGreaterThan(0);
  expect(result.bufferPeak).toBeGreaterThan(0);
  expect(result.oneShot).toBe(true);
  await page.evaluate(() => arena.screen.setMuted(true));
  await expect.poll(() => page.evaluate(() => arena.crowd.sounding)).toBe(false);
  expect(await page.evaluate(() => {
    stageProbe.instance.update(.1, 300);
    return stageProbe.instance.players.every(player => !player.sound?.isPlaying);
  })).toBe(true);
  console.log('T26 audible output:', result);
  expect(errors).toEqual([]);
});

test('three create/dispose cycles restore shared assets and release owned geometry and audio', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = await openArena(page);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.screen.state.muted)).toBe(false);
  const result = await page.evaluate(async () => {
    const { create } = await import('./stage-players.js');
    const { ctx, instance, saved } = stageProbe;
    if (!instance.players) return { missing: true };
    // EmoteFX_* meshes are added asynchronously by character.js (T18), not owned by stage players.
    const ownChildren = () => ctx.scene.children.filter(o => !o.name.startsWith('EmoteFX_')).length;
    instance.dispose();const cycles = [], childCount = ctx.camera.children.length, sceneChildren = ownChildren();
    for (let i = 0; i < 3; i++) {
      const module = create(ctx), owned = saved.filter(({ mesh, geometry }) => mesh.geometry !== geometry).map(({ mesh }) => mesh.geometry);
      let released = 0;for (const geometry of owned) geometry.addEventListener('dispose', () => released++);
      ctx.events.dispatchEvent(new CustomEvent('screen:state', { detail: arena.screen.state }));
      while (!module.players.every(player => player.sound?.buffer)) await new Promise(resolve => setTimeout(resolve, 10));
      module.update(.1, 0);module.update(.1, 100);
      const sounds = module.players.filter(player => player.sound).length;
      module.players[0].sound.play();const wasPlaying = module.players[0].sound.isPlaying;
      module.dispose();module.dispose();module.update(.1, 200);
      cycles.push({ owned: owned.length, released, restored: saved.every(({ mesh, geometry, material }) => mesh.geometry === geometry && mesh.material === material),
        cameraChildren: ctx.camera.children.length, sceneChildren: ownChildren(), sounds, wasPlaying,
        soundsStopped: module.players.every(player => !player.sound.isPlaying && player.sound.parent === null) });
    }
    return { cycles, childCount, sceneChildren };
  });
  expect(result.missing).not.toBe(true);
  for (const cycle of result.cycles) {
    expect(cycle.owned).toBeGreaterThan(0);
    expect(cycle.released).toBe(cycle.owned);
    expect(cycle.restored).toBe(true);
    expect(cycle.sounds).toBe(10);
    expect(cycle.wasPlaying).toBe(true);
    expect(cycle.soundsStopped).toBe(true);
    expect(cycle.cameraChildren).toBe(result.childCount);
    expect(cycle.sceneChildren).toBe(result.sceneChildren);
  }
  console.log('T26 active audio lifecycle:', JSON.stringify(result));
  expect(errors).toEqual([]);
});
