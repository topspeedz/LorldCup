import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const design = JSON.parse(readFileSync(new URL('../art/vfx/emotes/cues.json', import.meta.url)));
const referenceClips = { clipFile: design.clipFile, clipFps: design.fps, cues: design.eventFrames };

async function fixture(page, reducedMotion = 'no-preference', clipConfig = referenceClips) {
  await page.emulateMedia({ reducedMotion });
  await page.route('**/__fx-test', route => route.fulfill({ contentType: 'text/html', body:
    '<main id="ui"><iframe id="player" src="about:blank" style="width:320px;height:180px"></iframe></main><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
  await page.goto('/__fx-test');
  await page.evaluate(async clipConfig => {
    const THREE = await import('three'), { createAvatar } = await import('/avatar.js'), { create } = await import('/character.js');
    const config = Object.fromEntries(await Promise.all(['characters', 'teams'].map(async n => [n, await fetch(`/config/${n}.json`).then(r => r.json())])));
    // Custom clip configuration exercises the same runtime cue lookup as production.
    Object.assign(config.characters, clipConfig);
    const scene = new THREE.Scene(), avatar = createAvatar(0x45bfff), camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
    avatar.position.set(0, 0, 8); scene.add(avatar, new THREE.HemisphereLight(0xffffff, 0x888888, 3));
    camera.position.set(3, 3, 12); camera.lookAt(0, 1, 8);
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true }); renderer.setSize(256, 256); document.body.append(renderer.domElement);
    const avatars = new Map(), states = new Map(), events = new EventTarget();
    const faces = [
      { name: 'north', position: [0, 3, 2], normal: [0, 0, 1], width: 12, height: 8 },
      { name: 'south', position: [0, 3, -2], normal: [0, 0, -1], width: 12, height: 8 },
      { name: 'east', position: [2, 3, 0], normal: [1, 0, 0], width: 8, height: 6 },
      { name: 'west', position: [-2, 3, 0], normal: [-1, 0, 0], width: 8, height: 6 },
    ];
    window.arena = { avatar, screen: { faces, fullMode: false, state: { muted: true } } };
    const ctx = { THREE, scene, camera, renderer, player: { avatar, airborne: false }, events, config: n => config[n],
      multiplayer: { avatarOf: id => avatars.get(id) ?? null, get peers() { return [...states.values()]; } } };
    const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));
    window.f = { THREE, ctx, config, avatars, states, emit, createAvatar, now: 0, faces, instance: create(ctx) };
    f.step = dt => { f.instance.update(dt, f.now += dt * 1000); scene.updateMatrixWorld(true); };
    f.advance = (seconds, step = 1 / 60) => { for (let left = seconds; left > 1e-8; left -= step) f.step(Math.min(left, step)); };
    f.batch = id => scene.getObjectByName(`EmoteFX_${id}`);
    f.count = id => { const batch = f.batch(id); return batch?.visible ? batch.count : 0; };
    f.point = (id, index = 0) => { const matrix = new THREE.Matrix4(); f.batch(id).getMatrixAt(index, matrix); return new THREE.Vector3().setFromMatrixPosition(matrix).toArray(); };
    f.splats = () => scene.children.filter(o => o.name === 'EmoteFX_splat' && o.visible);
    f.peer = (id, emote, seq, position = [0, 0, 8]) => {
      if (!avatars.has(id)) { const a = createAvatar(0xffb34d); a.position.fromArray(position); avatars.set(id, a); scene.add(a); }
      const state = { peerId: id, character: 'fan_f1', team: null, seated: false, emote, emoteSeq: seq }; states.set(id, state); emit('peer:state', state);
      return avatars.get(id);
    };
    f.render = () => renderer.render(scene, camera);
  }, clipConfig);
  await page.waitForFunction(() => arena.character?.ready);
  await page.evaluate(() => f.step(0));
}

test('configuration selects a real clip file with named frame cues and FX1 effect values', () => {
  const chars = JSON.parse(readFileSync(new URL('../web/config/characters.json', import.meta.url)));
  const glb = readFileSync(new URL(`../web/${chars.clipFile}`, import.meta.url));
  expect(glb.subarray(0, 4).toString()).toBe('glTF'); expect(chars.clipFps).toBeGreaterThan(0);
  for (const [clip, events] of Object.entries(design.eventFrames)) for (const event of Object.keys(events)) {
    const values = [].concat(chars.cues[clip][event]); expect(values.length).toBeGreaterThan(0);
    for (const frame of values) { expect(Number.isInteger(frame)).toBe(true); expect(frame).toBeGreaterThanOrEqual(0); }
  }
  expect(chars.fx).toEqual(design.fx);
});

test('clip path, frame rate and cue arrays come from configuration, and absent screen geometry skips flight', async ({ page }) => {
  let clipLoaded = false;
  const clipConfig = structuredClone(referenceClips);
  clipConfig.clipFile = './assets/characters/fx-test-clips.glb'; clipConfig.clipFps = 60; clipConfig.cues.Emote_CheerClap.clap_contact = [15, 45];
  await page.route('**/fx-test-clips.glb', async route => {
    clipLoaded = true; const response = await route.fetch({ url: route.request().url().replace('fx-test-clips.glb', 'fan-anim-v2.glb') });
    await route.fulfill({ response });
  });
  await fixture(page, 'no-preference', clipConfig);
  const result = await page.evaluate(() => {
    f.emit('emote:request', { id: 'cheer_clap' }); f.advance(.25); const first = f.count('cheer_clap');
    f.advance(.5); const second = f.count('cheer_clap');
    delete arena.screen; f.emit('emote:request', { id: 'egg_throw' }); f.advance(3);
    return { first, second, flights: f.count('flight'), splats: f.splats().length };
  });
  expect(clipLoaded).toBe(true); expect(result).toEqual({ first: 12, second: 12, flights: 0, splats: 0 });
});

test('named cues start local and remote silhouettes once, including skipped frames at 30/60/144 Hz', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message)); await fixture(page);
  const result = await page.evaluate(frames => {
    const rows = [];
    for (const remote of [false, true]) for (const fps of [30, 60, 144]) {
      let seq = 0;
      if (remote) f.peer(`peer-${fps}`, null, 0);
      for (const [id, clip, event, count] of [
        ['cheer_clap', 'Emote_CheerClap', 'clap_contact', 12], ['heart', 'Emote_Heart', 'heart_form', 4], ['angry', 'Emote_Angry', 'angry_swing', 4],
      ]) {
        if (remote) f.peer(`peer-${fps}`, id, ++seq); else f.emit('emote:request', { id });
        const frame = [].concat(frames[clip][event])[0]; f.advance(frame / 30 - .002, 1 / fps);
        const before = f.count(id); f.step(.002); const at = f.count(id);
        f.advance(.05, 1 / fps); const after = f.count(id);
        // FX1 windup lasts 0.2s from frame 2, overlapping the first clap at frame 7.
        const beforeCount = id === 'cheer_clap' ? f.config.characters.fx.cheer_clap.preludeParticles : 0;
        f.advance(4, 1 / fps); rows.push({ remote, fps, id, before, beforeCount, at, after, count, ended: f.count(id) });
      }
    }
    f.emit('emote:request', { id: 'cheer_clap' }); f.advance(29 / 30); f.step(.2);
    return { rows, skipped: f.count('cheer_clap') };
  }, design.eventFrames);
  for (const row of result.rows) { expect(row.before).toBe(row.beforeCount); expect(row.at).toBe(row.count); expect(row.after).toBe(row.count); expect(row.ended).toBe(0); }
  expect(result.skipped).toBe(12); expect(errors).toEqual([]);
});

test('the four effects draw visible pixels and the heart follows its hands until the release cue', async ({ page }, testInfo) => {
  await fixture(page);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const result = await page.evaluate(() => {
    const { THREE, ctx } = f, target = new THREE.WebGLRenderTarget(256, 256), pixels = new Uint8Array(256 * 256 * 4), before = new Uint8Array(pixels.length);
    const rows = [];
    ctx.camera.position.set(0, 2.2, 5); ctx.camera.lookAt(0, 1.4, 8);
    for (const [id, seconds] of [['cheer_clap', 7 / 30 + .08], ['heart', 34 / 30 + .08], ['angry', 22 / 30 + .08], ['egg_throw', 32 / 30 + .8 + .08]]) {
      f.emit('emote:request', { id }); f.advance(seconds);
      if (id === 'egg_throw') { ctx.camera.position.set(0, 3, 5); ctx.camera.lookAt(0, 3, 2); }
      ctx.renderer.setRenderTarget(target); ctx.renderer.render(ctx.scene, ctx.camera); ctx.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, before);
      const visible = ctx.scene.children.filter(o => o.name.startsWith('EmoteFX_') && o.visible); visible.forEach(o => o.visible = false);
      ctx.renderer.render(ctx.scene, ctx.camera); ctx.renderer.readRenderTargetPixels(target, 0, 0, 256, 256, pixels); visible.forEach(o => o.visible = true);
      let changed = 0; for (let i = 0; i < pixels.length; i += 4) if (Math.abs(pixels[i] - before[i]) + Math.abs(pixels[i + 1] - before[i + 1]) + Math.abs(pixels[i + 2] - before[i + 2]) > 12) changed++;
      rows.push({ id, changed }); f.advance(5);
    }
    ctx.renderer.setRenderTarget(null); target.dispose();
    ctx.camera.position.set(0, 2.2, 5); ctx.camera.lookAt(0, 1.4, 8);
    f.emit('emote:request', { id: 'heart' }); f.advance(2);
    const left = arena.avatar.getObjectByName('hand_L').getWorldPosition(new THREE.Vector3()), right = arena.avatar.getObjectByName('hand_R').getWorldPosition(new THREE.Vector3());
    left.add(right).multiplyScalar(.5).y += f.config.characters.fx.heart.handOffsetMeters;
    const gap = left.distanceTo(new THREE.Vector3().fromArray(f.point('heart')));
    f.advance(76 / 30 - 2); const start = new THREE.Vector3().fromArray(f.point('heart')); f.advance(.4);
    const midpoint = start.lerp(new THREE.Vector3().fromArray(f.faces[0].position), .5); midpoint.y += f.config.characters.fx.heart.arcHeightMeters;
    const flightGap = midpoint.distanceTo(new THREE.Vector3().fromArray(f.point('heart')));
    f.render(); return { rows, gap, flightGap };
  });
  console.log('T18 visible effects', JSON.stringify(result));
  await page.screenshot({ path: testInfo.outputPath('heart-release.png') });
  for (const row of result.rows) expect(row.changed, row.id).toBeGreaterThan(0);
  expect(result.gap).toBeLessThan(.001); expect(result.flightGap).toBeLessThan(.001); expect(errors).toEqual([]);
});

test('egg leaves the hand at frame 32, hits the thrower-facing centre in 0.8s and fades by 1.5s after impact', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const rows = [], placements = [[0, 0, 8], [0, 0, -8], [8, 0, 0], [-8, 0, 0]];
    let sequence = 0;
    for (const remote of [false, true]) for (const fps of [30, 60, 144]) for (let side = 0; side < 4; side++) {
      const avatar = remote ? f.peer('thrower', null, 0, placements[side]) : arena.avatar;
      avatar.position.fromArray(placements[side]); f.step(0);
      avatar.rotation.y = .8; f.ctx.camera.position.negate();
      if (remote) f.peer('thrower', 'egg_throw', ++sequence);
      else f.emit('emote:request', { id: 'egg_throw' });
      f.advance(32 / 30 - .002, 1 / fps); const before = f.count('flight');
      f.step(.002);
      const hand = avatar.getObjectByName('Prop_Egg').getWorldPosition(new f.THREE.Vector3()), start = f.point('flight');
      f.advance(.4, 1 / fps); const half = f.point('flight');
      const midpoint = hand.clone().lerp(new f.THREE.Vector3().fromArray(f.faces[side].position), .5); midpoint.y += .6;
      f.advance(.4, 1 / fps); const splat = f.splats()[0];
      const impact = { flights: f.count('flight'), shards: f.count('shells'), point: splat?.position.toArray(), face: splat?.userData.face, opacity: splat?.material.opacity };
      f.advance(.9, 1 / fps); const held = f.splats()[0]?.material.opacity;
      f.advance(.3, 1 / fps); const faded = f.splats()[0]?.material.opacity;
      f.advance(.3, 1 / fps);
      rows.push({ before, gap: hand.distanceTo(new f.THREE.Vector3().fromArray(start)), halfGap: midpoint.distanceTo(new f.THREE.Vector3().fromArray(half)), impact, held, faded, gone: f.splats().length, side });
      f.advance(1);
    }
    return rows;
  });
  for (const row of result) {
    expect(row.before).toBe(0); expect(row.gap).toBeLessThan(.001); expect(row.halfGap).toBeLessThan(.001);
    expect(row.impact).toMatchObject({ flights: 0, shards: 8, face: ['north', 'south', 'east', 'west'][row.side], opacity: .7 });
    const point = [[0, 3, 2.02], [0, 3, -2.02], [2.02, 3, 0], [-2.02, 3, 0]][row.side];
    row.impact.point.forEach((value, i) => expect(value).toBeCloseTo(point[i], 5));
    expect(row.held).toBeCloseTo(.7, 5); expect(row.faded).toBeCloseTo(.175, 5); expect(row.gone).toBe(0);
  }
});

test('clip completion and replacement preserve flight and splat; Full Mode hides every egg layer without touching the player', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const player = document.querySelector('#player'), original = player.outerHTML, windowBefore = player.contentWindow;
    let mutations = 0; const observer = new MutationObserver(records => mutations += records.length); observer.observe(document.querySelector('#ui'), { attributes: true, childList: true, subtree: true });
    f.emit('emote:request', { id: 'egg_throw' }); f.advance(32 / 30); f.emit('emote:request', { id: 'heart' }); f.advance(.4);
    const continued = f.count('flight') === 1;
    arena.screen.fullMode = true; f.step(0); const hiddenFlight = f.count('flight') === 0 && !arena.avatar.getObjectByName('Prop_Egg').visible;
    f.advance(.4); const hiddenImpact = f.count('shells') === 0 && f.splats().length === 0;
    arena.screen.fullMode = false; f.step(0); const revealed = f.splats().length === 1;
    f.advance(1.5); const expired = f.splats().length === 0;
    f.emit('emote:request', { id: 'egg_throw' }); f.advance(.2); const held = arena.avatar.getObjectByName('Prop_Egg').visible;
    arena.screen.fullMode = true; f.step(0); const hiddenHeld = !arena.avatar.getObjectByName('Prop_Egg').visible;
    f.advance(4); arena.screen.fullMode = false; f.step(0); const noRevival = f.count('flight') + f.count('shells') + f.splats().length === 0;
    observer.disconnect(); return { continued, hiddenFlight, hiddenImpact, revealed, expired, held, hiddenHeld, noRevival, unchanged: player.outerHTML === original && player.contentWindow === windowBefore, mutations };
  });
  expect(result).toEqual({ continued: true, hiddenFlight: true, hiddenImpact: true, revealed: true, expired: true, held: true, hiddenHeld: true, noRevival: true, unchanged: true, mutations: 0 });
});

test('consumed remote sequence survives avatar replacement and pending state, but new sequences still play', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    f.peer('one', null, 0); f.peer('one', 'egg_throw', 7); f.advance(32 / 30); const first = f.count('flight');
    f.avatars.get('one').removeFromParent(); f.avatars.delete('one'); f.step(0);
    f.emit('peer:state', f.states.get('one')); f.peer('one', 'egg_throw', 7); f.advance(1.5); const replay = f.count('flight');
    f.peer('one', 'heart', 6); f.advance(1.2); const older = f.count('heart');
    f.peer('one', 'egg_throw', 8); f.advance(32 / 30); const next = f.count('flight');
    f.emit('room:left'); f.step(0); const cleaned = f.count('flight') + f.count('shells') + f.splats().length;
    return { first, replay, older, next, cleaned };
  });
  expect(result).toEqual({ first: 1, replay: 0, older: 0, next: 1, cleaned: 0 });
});

test('16 throwers respect shared draw, texture, particle and per-face stain budgets; disposal returns resources', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const placements = [[0, 0, 8], [0, 0, -8], [8, 0, 0], [-8, 0, 0]];
    f.emit('emote:request', { id: 'egg_throw' });
    for (let i = 1; i < 16; i++) {
      f.peer(`crowd-${i}`, null, 0, placements[i % 4]); f.peer(`crowd-${i}`, 'egg_throw', 1);
    }
    f.advance(32 / 30); const flights = f.count('flight'); f.advance(.8);
    const shards = f.count('shells'), splats = f.splats().map(o => ({ width: o.scale.x, area: o.scale.x * o.scale.y, face: o.userData.face }));
    f.emit('emote:request', { id: 'cheer_clap' });
    for (let i = 1; i < 16; i++) f.peer(`crowd-${i}`, 'cheer_clap', 2);
    f.advance(8 / 30); f.render();
    const objects = f.ctx.scene.children.filter(o => o.name.startsWith('EmoteFX_'));
    const textures = new Set(objects.map(o => o.material.map).filter(Boolean));
    const bytes = [...textures].reduce((sum, t) => sum + t.image.width * t.image.height * 4, 0);
    const extraCalls = objects.filter(o => o.visible && (!o.isInstancedMesh || o.count)).length;
    let disposed = 0; const resources = new Set();
    for (const o of objects) { if (o.isInstancedMesh) resources.add(o); resources.add(o.geometry); resources.add(o.material); }
    for (const t of textures) resources.add(t);
    for (const r of resources) r.addEventListener('dispose', () => disposed++);
    f.instance.dispose(); f.instance.dispose();
    return { flights, shards, splats, bytes, textures: textures.size, mipmaps: [...textures].some(t => t.generateMipmaps), extraCalls,
      disposed, resources: resources.size, remained: f.ctx.scene.children.some(o => o.name.startsWith('EmoteFX_')) };
  });
  expect(result.flights).toBe(16); expect(result.shards).toBe(128); expect(result.splats).toHaveLength(4);
  for (const splat of result.splats) { expect(splat.width).toBeLessThanOrEqual(.7); expect(splat.area).toBeLessThanOrEqual((['north', 'south'].includes(splat.face) ? 96 : 48) * .0025 + 1e-8); }
  expect(result.textures).toBe(4); expect(result.bytes).toBe(1048576); expect(result.mipmaps).toBe(false); expect(result.extraCalls).toBeLessThanOrEqual(9);
  expect(result.disposed).toBe(result.resources); expect(result.remained).toBe(false);
  console.log('T18 FX budgets', JSON.stringify(result));
});

test('reduced motion uses capped particles and a straight flight; a hidden-tab expiry cannot create a late impact', async ({ page }) => {
  await fixture(page, 'reduce');
  const result = await page.evaluate(() => {
    f.emit('emote:request', { id: 'heart' }); f.advance(34 / 30); const hearts = f.count('heart');
    f.emit('emote:request', { id: 'egg_throw' }); f.advance(32 / 30); const start = f.point('flight');
    f.advance(.4); const midpoint = f.point('flight');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'));
    f.step(30);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); f.step(0);
    return { hearts, straight: Math.abs(midpoint[1] - (start[1] + 3) / 2) < .001, expired: f.count('flight') + f.count('shells') + f.splats().length };
  });
  expect(result).toEqual({ hearts: 1, straight: true, expired: 0 });
});
