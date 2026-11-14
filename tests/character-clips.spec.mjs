import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ids = ['fan_f1', 'fan_f2', 'fan_m1', 'fan_m2'];
const emotes = { cheer_clap: 'Emote_CheerClap', heart: 'Emote_Heart', angry: 'Emote_Angry', egg_throw: 'Emote_EggThrow' };
const clips = ['Idle', 'Walk', 'Run', 'Jump', 'Sit', ...Object.values(emotes)];
const characters = JSON.parse(readFileSync(new URL('../web/config/characters.json', import.meta.url)));
const reference = JSON.parse(readFileSync(new URL('../art/vfx/emotes/cues.json', import.meta.url)));

async function fixturePage(page, waitForReady = true) {
  await page.route('**/__clips-test', route => route.fulfill({ contentType: 'text/html', body:
    '<button id="enter">들어가기</button><main id="ui"></main><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
  await page.goto('/__clips-test');
  await page.evaluate(async () => {
    const THREE = await import('three');
    const { createAvatar } = await import('/avatar.js');
    const { createPlayerController } = await import('/player-controller.js');
    const { create } = await import('/character.js');
    const config = Object.fromEntries(await Promise.all(['characters', 'teams', 'screen'].map(async n => [n, await fetch(`/config/${n}.json`).then(r => r.json())])));
    const mixers = [], starts = [], played = [], actions = new Map(), buffers = new Map();
    const loadAudio = THREE.AudioLoader.prototype.loadAsync;
    THREE.AudioLoader.prototype.loadAsync = async function (url) { const buffer = await loadAudio.call(this, url); buffers.set(buffer, url); return buffer; };
    const clipAction = THREE.AnimationMixer.prototype.clipAction, play = THREE.PositionalAudio.prototype.play;
    THREE.AnimationMixer.prototype.clipAction = function (...args) {
      if (!mixers.includes(this)) { mixers.push(this); actions.set(this, []); }
      const action = clipAction.apply(this, args);
      if (!actions.get(this).includes(action)) actions.get(this).push(action);
      return action;
    };
    THREE.PositionalAudio.prototype.play = function (...args) {
      starts.push({ sound: this, file: buffers.get(this.buffer), time: actions.get(mixers.find(m => m.getRoot().getObjectByName(this.parent?.name) === this.parent))?.find(a => a.getClip().name === 'Emote_EggThrow')?.time });
      return play.apply(this, args);
    };
    const scene = new THREE.Scene(), avatar = createAvatar(0x45bfff), camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
    camera.position.set(2, 1.8, -4); camera.lookAt(0, .9, 0);
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true }); renderer.setSize(128, 128);
    document.body.append(renderer.domElement); scene.add(avatar, new THREE.HemisphereLight(0xffffff, 0x888888, 3));
    const root = new THREE.Group(), floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial());
    floor.rotation.x = -Math.PI / 2; floor.name = 'Walk_Test'; root.add(floor); root.updateMatrixWorld(true);
    const held = new Set(), input = { keys: held, walking: true, down: action => held.has(action) };
    const player = createPlayerController({ avatar, input, getYaw: () => 0, onTeleport() {} }); player.registerWorld(root); player.teleport([0, 0, 0, 0]);
    const avatars = new Map(), states = new Map(), events = new EventTarget();
    const ctx = { THREE, scene, camera, renderer, root, player, input, events, uiRoot: document.querySelector('#ui'), config: n => config[n],
      multiplayer: { avatarOf: id => avatars.get(id) ?? null, get peers() { return [...states.values()]; }, positions: [] } };
    window.arena = { avatar, screen: { state: { muted: true, userVolume: config.screen.volume }, faces: [{ name: 'test', position: [-8, 3, 0], normal: [1, 0, 0], width: 12, height: 8 }] } };
    const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));
    document.querySelector('#enter').addEventListener('click', () => { arena.screen.state.muted = false; emit('app:enter'); emit('screen:state', arena.screen.state); });
    const active = (index = 0) => (actions.get(mixers[index]) ?? []).filter(a => a.isScheduled() && a.enabled && a.getEffectiveWeight() > .5).map(a => a.getClip().name);
    events.addEventListener('emote:played', e => played.push({ id: e.detail.id, scheduled: (actions.get(mixers[0]) ?? []).some(a => a.isScheduled() && a.getClip().name.startsWith('Emote_')) }));
    window.f = { THREE, ctx, createAvatar, mixers, actions, starts, buffers, played, avatars, states, held, emit, active, now: 0 };
    f.instance = create(ctx);
    f.step = dt => { player.update(dt); f.instance.update(dt, f.now += dt * 1000); scene.updateMatrixWorld(true); };
    f.advance = (seconds, step = 1 / 60) => { for (let remaining = seconds; remaining > 1e-8; remaining -= step) f.step(Math.min(step, remaining)); };
    f.pose = (index = 0) => { const values = []; f.mixers[index].getRoot().traverse(o => { if (o.isBone) values.push(...o.position.toArray(), ...o.quaternion.toArray()); }); return values; };
    f.sound = () => { let sound; avatar.traverse(o => { if (o instanceof THREE.PositionalAudio) sound = o; }); return sound; };
    f.flight = () => scene.getObjectByName('EmoteFX_flight');
    f.flightPosition = () => { const matrix = new THREE.Matrix4(); f.flight().getMatrixAt(0, matrix); return new THREE.Vector3().setFromMatrixPosition(matrix); };
  });
  if (waitForReady) await page.waitForFunction(() => arena.character?.ready);
}

test('AJ clip path and all eleven named cues are connected together', () => {
  expect(characters.clipFile).toBe('./assets/characters/fan-anim-v2.glb');
  expect(characters.clipFps).toBe(30);
  expect(characters.cues).toEqual({
    Emote_CheerClap: { cheer_windup: 2, cheer_raise: 14, clap_contact: [26, 38, 50, 62, 74] },
    Emote_Heart: { heart_open: 16, heart_form: 34, heart_release: 76 },
    Emote_Angry: { angry_raise: 14, angry_swing: [22, 42, 64, 86, 108, 126] },
    Emote_EggThrow: { egg_windup: 12, egg_scream: 26, egg_release: 32 },
  });
});

test('configured animation GLB has the nine contracted clips and the unskinned egg socket', () => {
  const data = readFileSync(new URL(`../web/${characters.clipFile}`, import.meta.url));
  const gltf = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
  expect(gltf.animations.map(a => a.name).sort()).toEqual([...clips].sort());
  expect(gltf.nodes.map(n => n.name)).toEqual(expect.arrayContaining(['FanRig', 'prop_R', 'head', 'Prop_Egg']));
  expect(gltf.nodes.find(n => n.name === 'Prop_Egg').translation[2]).toBeCloseTo(-.055, 5);
  expect(gltf.nodes.find(n => n.name === 'Prop_Egg').skin).toBeUndefined();
});

test('T19 repeated contacts and coincident cues keep the full impact visible at 30, 60 and 144 Hz', async ({ page }) => {
  await fixturePage(page);
  const rows = await page.evaluate(() => {
    const rows = [];
    for (const fps of [30, 60, 144]) for (const [id, frames] of [
      ['cheer_clap', [26, 38, 50, 62, 74]], ['angry', [22, 42, 64, 86, 108, 126]],
    ]) {
      f.emit('emote:request', { id }); let previous = 0;
      for (const frame of frames) {
        f.advance((frame - previous) / 30, 1 / fps); previous = frame;
        const batch = f.ctx.scene.getObjectByName(`EmoteFX_${id}`), matrix = new f.THREE.Matrix4();
        batch.getMatrixAt(0, matrix);
        rows.push({ id, fps, frame, count: batch.count, size: matrix.getMaxScaleOnAxis() });
      }
      f.advance(4);
    }
    return rows;
  });
  for (const row of rows) {
    expect(row.count, JSON.stringify(row)).toBe(characters.fx[row.id].maxParticles);
    expect(row.size, JSON.stringify(row)).toBeCloseTo(characters.fx[row.id].size, 5);
  }
});

test('actual movement selects Idle, Walk, Run, Jump and the held Sit pose without moving the avatar root', async ({ page }) => {
  await fixturePage(page);
  expect(await page.evaluate(() => f.mixers.length)).toBe(1);
  const result = await page.evaluate(() => {
    const phases = []; f.advance(.3); phases.push(f.active());
    f.held.add('forward'); f.advance(.3); phases.push(f.active());
    f.held.add('run'); f.advance(.3); phases.push(f.active());
    f.held.clear(); f.advance(.3);
    const rig = arena.avatar.getObjectByName('FanRig'), hips = rig.getObjectByName('hips');
    const idleHips = hips.position.toArray(), idleLeg = rig.getObjectByName('thigh_L').quaternion.clone();
    f.ctx.player.jump(); f.advance(.2); phases.push(f.active());
    const jump = { hips: hips.position.toArray(), idleHips, height: f.ctx.player.position.y,
      legAngle: idleLeg.angleTo(rig.getObjectByName('thigh_L').quaternion) };
    f.advance(.8); phases.push(f.active());
    const before = f.ctx.player.position.toArray();
    f.emit('seat:enter', { seatId: 'test' }); f.advance(1);
    const sit = { active: f.active(), pose: f.pose(), hips: hips.position.toArray(), hipsWorld: hips.getWorldPosition(new f.THREE.Vector3()).toArray(), root: f.ctx.player.position.toArray() };
    f.advance(1); const held = JSON.stringify(sit.pose) === JSON.stringify(f.pose());
    f.emit('seat:exit'); f.advance(.3);
    return { phases, jump, sit, held, before, stand: f.active(), names: f.actions.get(f.mixers[0]).map(a => a.getClip().name) };
  });
  expect(result.names.sort()).toEqual([...clips].sort());
  expect(result.phases).toEqual([['Idle'], ['Walk'], ['Run'], ['Jump'], ['Idle']]);
  result.jump.hips.forEach((value, i) => expect(value).toBeCloseTo(result.jump.idleHips[i], 5));
  expect(result.jump.height).toBeGreaterThan(.5); expect(result.jump.legAngle).toBeGreaterThan(.1);
  expect(result.sit.active).toEqual(['Sit']); expect(result.held).toBe(true);
  expect(result.sit.root).toEqual(result.before); expect(result.sit.hips[1]).toBeCloseTo(.56, 2);
  expect(result.sit.hipsWorld[0]).toBeCloseTo(result.before[0], 3); expect(result.sit.hipsWorld[2]).toBeCloseTo(result.before[2], 3);
  expect(result.stand).toEqual(['Idle']);
});

test('all four bodies play four distinct real emotes; seated cheers return to Sit and movement interrupts', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await fixturePage(page); expect(await page.evaluate(() => f.mixers.length)).toBe(1);
  const samples = await page.evaluate(({ ids, emotes }) => {
    const results = [];
    for (const characterId of ids) {
      f.emit('character:changed', { characterId }); const row = [];
      for (const [id, name] of Object.entries(emotes)) {
        f.emit('emote:request', { id }); const before = f.pose(); f.advance(.9);
        f.ctx.renderer.render(f.ctx.scene, f.ctx.camera);
        row.push({ active: f.active(), changed: before.some((v, i) => Math.abs(v - f.pose()[i]) > .05),
          image: f.ctx.renderer.domElement.toDataURL(), calls: f.ctx.renderer.info.render.calls,
          triangles: f.ctx.renderer.info.render.triangles, name });
        f.advance(f.actions.get(f.mixers[0]).find(a => a.getClip().name === name).getClip().duration); row.at(-1).returned = f.active();
      }
      results.push(row);
    }
    f.emit('emote:request', { id: 'unknown' }); f.emit('emote:request', { id: '__proto__' });
    f.emit('seat:enter', { seatId: 'test' }); f.advance(1);
    f.emit('emote:request', { id: 'cheer_clap' }); f.advance(.9); const cheer = f.active(); f.advance(4);
    const seated = f.active(); f.emit('seat:exit'); f.emit('emote:request', { id: 'heart' });
    f.held.add('forward'); f.advance(.3); const walking = f.active(); f.held.clear();
    f.emit('emote:request', { id: 'egg_throw' }); f.advance(.5); f.ctx.player.jump(); f.advance(.2);
    return { results, played: f.played, cheer, seated, walking, jump: f.active(), eggHidden: !arena.avatar.getObjectByName('Prop_Egg').visible };
  }, { ids, emotes });
  for (const row of samples.results) {
    expect(new Set(row.map(s => s.image)).size).toBe(4);
    for (const sample of row) { expect(sample.active).toEqual([sample.name]); expect(sample.changed).toBe(true); expect(sample.returned).toEqual(['Idle']); }
  }
  expect(samples.played).toHaveLength(19); expect(samples.played.every(p => p.scheduled)).toBe(true);
  expect(samples.cheer).toEqual(['Emote_CheerClap']); expect(samples.seated).toEqual(['Sit']);
  expect(samples.walking).toEqual(['Walk']); expect(samples.jump).toEqual(['Jump']); expect(samples.eggHidden).toBe(true);
  expect(errors).toEqual([]);
  console.log('T37 visible character budgets', samples.results.map(row => row.map(({ calls, triangles }) => ({ calls, triangles }))));
});

test('frame 26 plays the decoded scream once; frame 32 releases the egg from the hand for all bodies and frame rates', async ({ page }) => {
  await fixturePage(page); expect(await page.evaluate(() => f.mixers.length)).toBe(1);
  await page.locator('#enter').click();
  await page.waitForFunction(() => f.buffers.size === 13 && f.sound().context.state === 'running');
  const result = await page.evaluate(async ids => {
    const sound = f.sound(), decoded = await sound.context.decodeAudioData(await (await fetch('/assets/audio/sfx/egg-scream_01.mp3')).arrayBuffer());
    const rows = [];
    for (const characterId of ids) for (const fps of [30, 60, 144]) {
      f.emit('character:changed', { characterId }); arena.avatar.rotation.y = Math.PI / 2;
      f.emit('emote:request', { id: 'egg_throw' }); f.advance(24 / 30, 1 / fps);
      const egg = arena.avatar.getObjectByName('Prop_Egg'), count = f.starts.length;
      const before = { count, parent: egg.parent.name, visible: egg.visible };
      f.advance(2 / 30, 1 / fps); const scream = { count: f.starts.length, time: f.starts.at(-1)?.time, playing: sound.isPlaying, parent: sound.parent.name };
      f.advance(4 / 30, 1 / fps); const held = egg.parent.name;
      f.advance(2 / 30, 1 / fps);
      const start = f.flightPosition();
      const hand = new f.THREE.Vector3(0, 0, -.055); arena.avatar.getObjectByName('prop_R').localToWorld(hand);
      const released = f.flight().count === 1 && !egg.visible, gap = start.distanceTo(hand);
      f.advance(2 / 30, 1 / fps); const end = f.flightPosition(), target = new f.THREE.Vector3(-8, 3, 0);
      rows.push({ characterId, fps, before, scream, held, released, gap, dx: end.x - start.x, dz: end.z - start.z, expectedDx: (target.x - start.x) / 12, expectedDz: (target.z - start.z) / 12 });
      f.advance(4, 1 / fps); rows.at(-1).hidden = !egg.visible && !f.flight().count;
      rows.at(-1).once = f.starts.length === count + 2 && f.starts.at(-1).file.includes('egg-impact');
    }
    f.emit('emote:request', { id: 'egg_throw' }); f.advance(24 / 30); const beforeSlow = f.starts.length;
    f.step(.15); f.step(.2); const slow = { time: f.starts.at(-1).time, once: f.starts.length === beforeSlow + 1, released: f.flight().count === 1 };
    const analyser = new f.THREE.AudioAnalyser(sound, 256); await new Promise(resolve => setTimeout(resolve, 100));
    const energy = analyser.getAverageFrequency(); analyser.analyser.disconnect();
    return { rows, slow, energy, volume: sound.getVolume(), actualBuffer: decoded.length === sound.buffer.length && decoded.getChannelData(0).every((v, i) => v === sound.buffer.getChannelData(0)[i]) };
  }, ids);
  for (const r of result.rows) {
    expect(r.before).toMatchObject({ parent: 'prop_R', visible: true }); expect(r.held).toBe('prop_R');
    expect(r.scream).toMatchObject({ count: r.before.count + 1, playing: true, parent: 'head' }); expect(r.scream.time).toBeCloseTo(26 / 30, 5);
    expect(r.released).toBe(true); expect(r.gap).toBeLessThan(.001); expect(r.dx).toBeCloseTo(r.expectedDx, 3); expect(r.dz).toBeCloseTo(r.expectedDz, 3);
    expect(r.hidden && r.once).toBe(true);
  }
  expect(result.actualBuffer).toBe(true); expect(result.volume).toBeCloseTo(.25, 2); expect(result.energy).toBeGreaterThan(0);
  expect(result.slow).toMatchObject({ once: true, released: true }); expect(result.slow.time - 26 / 30).toBeLessThanOrEqual(.1);
});

test('remote state is independent, duplicate or older emoteSeq cannot replay, and leaving cleans a flying egg', async ({ page }) => {
  await fixturePage(page); expect(await page.evaluate(() => f.mixers.length)).toBe(1);
  const result = await page.evaluate(() => {
    const state = { peerId: 'one', character: 'fan_m2', team: 'blg', emote: 'egg_throw', emoteSeq: 1, seated: false };
    const initial = { ...state, emote: null, emoteSeq: 0 };
    f.states.set('one', initial); f.emit('peer:state', initial); f.advance(.1);
    const avatar = f.createAvatar(0xffb34d); f.avatars.set('one', avatar); f.ctx.scene.add(avatar); f.advance(1 / 60);
    f.states.set('one', state); f.emit('peer:state', state); f.advance(.6);
    const action = f.actions.get(f.mixers[1]).find(a => a.getClip().name === 'Emote_EggThrow');
    const before = action.time, local = f.active();
    f.emit('peer:state', { ...state, team: 'geng' }); f.advance(.2); const duplicate = action.time;
    f.emit('peer:state', { ...state, emoteSeq: 0, emote: 'heart' }); f.advance(.2); const old = f.active(1);
    const egg = avatar.getObjectByName('Prop_Egg'); f.advance(.5);
    const airborne = f.flight().count === 1;
    f.emit('room:left');
    return { before, duplicate, local, old, airborne, removed: !egg.parent && !avatar.getObjectByName('FanRig'), played: f.played.length };
  });
  expect(result.duplicate).toBeGreaterThan(result.before); expect(result.local).toEqual(['Idle']);
  expect(result.old).toEqual(['Emote_EggThrow']); expect(result.airborne && result.removed).toBe(true); expect(result.played).toBe(0);
});

test('mute, replacement, hidden tab and disposal stop sound, never replay a consumed cue or leak props', async ({ page }) => {
  await fixturePage(page); expect(await page.evaluate(() => f.mixers.length)).toBe(1);
  await page.locator('#enter').click(); await page.waitForFunction(() => f.buffers.size === 13);
  const result = await page.evaluate(() => {
    f.emit('emote:request', { id: 'egg_throw' }); f.advance(1.2); const sound = f.sound(), count = f.starts.length;
    Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange'));
    const stopped = !sound.isPlaying, action = f.actions.get(f.mixers[0]).find(a => a.getClip().name === 'Emote_EggThrow'), time = action.time;
    f.advance(30); const consumed = action.time !== time && !f.active().includes('Emote_EggThrow');
    Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange'));
    f.step(5); const noCatchup = !f.active().includes('Emote_EggThrow'); f.advance(.3); const once = f.starts.length === count;
    f.emit('emote:request', { id: 'heart' }); const cleaned = !f.ctx.scene.children.some(o => o.name === 'Prop_Egg');
    arena.screen.state.muted = true; f.emit('screen:state', arena.screen.state); f.emit('emote:request', { id: 'egg_throw' }); f.advance(1.2); const muted = f.starts.length === count;
    arena.screen.state.muted = false; f.emit('screen:state', arena.screen.state); f.advance(.1); const noLateSound = f.starts.length === count;
    f.emit('emote:request', { id: 'egg_throw' }); f.advance(1.2); arena.screen.state.muted = true; f.emit('screen:state', arena.screen.state); const mutedPlaying = !sound.isPlaying;
    const listeners = f.ctx.camera.children.filter(o => o instanceof f.THREE.AudioListener); f.instance.dispose(); f.instance.dispose();
    const disposed = !sound.isPlaying && !sound.parent && listeners.every(o => !o.parent) && !f.ctx.scene.getObjectByName('Prop_Egg');
    return { stopped, consumed, noCatchup, once, cleaned, muted, noLateSound, mutedPlaying, disposed };
  });
  expect(Object.values(result).every(Boolean)).toBe(true);
});

test('animation loading failure warns and cannot acknowledge an unplayed emote or issue a ticket', async ({ page }) => {
  const warnings = []; page.on('console', m => { if (m.type() === 'warning') warnings.push(m.text()); });
  await page.route(`**/${characters.clipFile.slice(2)}`, route => route.abort()); await fixturePage(page);
  await page.evaluate(() => { f.emit('emote:request', { id: 'cheer_clap' }); });
  expect(await page.evaluate(() => f.played.length)).toBe(0);
  expect(warnings.some(m => /애니메이션|animation|fan-anim/.test(m))).toBe(true);
});

test('requests before animation loading do not earn cheers, while a seat selected during loading is retained', async ({ page }) => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route(`**/${characters.clipFile.slice(2)}`, async route => { await gate; await route.continue(); });
  await fixturePage(page, false);
  await page.evaluate(() => { f.emit('seat:enter', { seatId: 'test' }); f.emit('emote:request', { id: 'heart' }); });
  expect(await page.evaluate(() => f.played.length)).toBe(0);
  release(); await page.waitForFunction(() => arena.character?.ready);
  expect(await page.evaluate(() => { f.advance(1); return f.active(); })).toEqual(['Sit']);
  expect(await page.evaluate(() => f.played.length)).toBe(0);
});

// T67 memo 2 (after T64): the ticket is one click on a team in the centred popup — no emote step — so the cheer clip comes from the HUD emote menu.
test('one team click earns one ticket, the HUD cheer starts the real clip; actual seat controls keep the Sit pose', async ({ page }) => {
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      for(const entry of modules){const original=entry.create;entry.create=ctx=>{window.clipContext=ctx;return original(ctx);};}` });
  });
  await page.goto('/'); await page.waitForFunction(() => window.arena?.ready && window.arena.character?.ready, null, { timeout: 90_000 });
  await page.locator('#enter').click(); await expect(page.locator('#loading')).toBeHidden();
  await page.evaluate(() => {
    window.clipPlayed = []; window.ticketIssued = [];
    clipContext.events.addEventListener('emote:played', e => clipPlayed.push(e.detail));
    clipContext.events.addEventListener('ticket:issued', e => ticketIssued.push(e.detail));
    const b = clipContext.config('ticket').barrier; arena.go([b.x - 2, -.02, 0, 0]);
    window.handBefore = arena.avatar.getObjectByName('upper_arm_L').quaternion.toArray();
  });
  await page.getByRole('dialog', { name: '입장 티켓' }).getByRole('group', { name: '응원할 팀' }).getByRole('button').first().click();
  await page.waitForFunction(() => ticketIssued.length === 1);
  await page.getByRole('dialog', { name: '입장 티켓' }).getByRole('button', { name: '들어가기', exact: true }).click(); // the centred popup would cover the menu
  await page.locator('#emote-open').click();
  await page.getByRole('button', { name: '박수 환호', exact: true }).click();
  await expect.poll(() => page.evaluate(() => arena.avatar.getObjectByName('upper_arm_L').quaternion.toArray().some((v, i) => Math.abs(v - handBefore[i]) > .01))).toBe(true);
  await page.waitForFunction(() => ticketIssued.length === 1);
  expect(await page.evaluate(() => clipPlayed)).toEqual([{ id: 'cheer_clap' }]);
  await page.evaluate(() => { const seat = clipContext.config('seats').seats[0]; arena.go([...seat.position, 0]); });
  await expect(page.locator('#seat-toggle')).toBeVisible();
  await page.locator('#seat-toggle').click(); await page.waitForFunction(() => arena.seat.seatId !== null);
  await expect.poll(() => page.evaluate(() => arena.avatar.getObjectByName('hips').position.y)).toBeCloseTo(.56, 2);
  const contact = await page.evaluate(() => {
    const { THREE, root } = clipContext, hips = arena.avatar.getObjectByName('hips').getWorldPosition(new THREE.Vector3());
    const cushions = []; root.traverse(o => { if (o.isMesh && /^Seats__/.test(o.name)) cushions.push(o); });
    const ray = new THREE.Raycaster(new THREE.Vector3(hips.x, hips.y + .2, hips.z), new THREE.Vector3(0, -1, 0), 0, 1);
    const hit = ray.intersectObjects(cushions, false)[0];
    return { cushion: !!hit, gap: hit ? hips.y - .105 - hit.point.y : null };
  });
  expect(contact.cushion).toBe(true); expect(Math.abs(contact.gap)).toBeLessThan(.03);
  await page.evaluate(() => clipContext.events.dispatchEvent(new CustomEvent('emote:request', { detail: { id: 'heart' } })));
  await expect.poll(() => page.evaluate(() => arena.avatar.getObjectByName('hips').position.y)).toBeGreaterThan(.8);
  await expect.poll(() => page.evaluate(() => arena.avatar.getObjectByName('hips').position.y), { timeout: 7000 }).toBeCloseTo(.56, 2);
  expect(await page.evaluate(() => ({ seated: !!arena.seat.seatId, fov: arena.camera.fov }))).toEqual({ seated: true, fov: await page.evaluate(() => clipContext.config('seats').camera.fov) });
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await expect(page.locator('#seat-toggle')).toBeVisible();
  await page.locator('#seat-toggle').click(); await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBeNull();
  expect(await page.evaluate(() => ({ locked: !!document.pointerLockElement, walking: arena.state.walking }))).toEqual({ locked: false, walking: true });
});

test('before and after captures show eight actions at identical clip times and camera settings', async ({ page }) => {
  expect(characters.clipFile).toBe('./assets/characters/fan-anim-v2.glb');
  const directory = new URL('../_workspace/web-metaverse-develop/2026-11-13-ux-motion-rooms/b25i/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  const samples = [['Walk', 6], ['Run', 6], ['Jump', 10.8], ['Sit', 24],
    ['Emote_CheerClap', 35], ['Emote_Heart', 34], ['Emote_Angry', 22], ['Emote_EggThrow', 32]];
  const rows = [];
  for (const version of ['before', 'after']) {
    const config = version === 'before' ? { ...characters, modelFile: './assets/characters/fan.glb', clipFile: reference.clipFile, clipFps: reference.fps, cues: reference.eventFrames } : characters;
    await page.route('**/config/characters.json', route => route.fulfill({ json: config }));
    for (const [clip, frame] of samples) {
      await fixturePage(page);
      const row = await page.evaluate(({ clip, frame, emotes }) => {
        const { renderer, camera, scene, player } = f.ctx;
        renderer.setSize(640, 640); scene.background = new f.THREE.Color(0x182533);
        f.emit('character:changed', { characterId: 'fan_f1' });
        if (clip === 'Walk' || clip === 'Run') f.held.add('forward');
        if (clip === 'Run') f.held.add('run');
        if (clip === 'Jump') player.jump();
        if (clip === 'Sit') f.emit('seat:enter', { seatId: 'test' });
        const id = Object.entries(emotes).find(([, name]) => name === clip)?.[0];
        if (id) f.emit('emote:request', { id });
        f.advance(frame / 30);
        camera.position.copy(player.position).add(new f.THREE.Vector3(2, 1.8, -4));
        camera.lookAt(player.position.clone().add(new f.THREE.Vector3(0, .9, 0)));
        renderer.render(scene, camera);
        return { clip, frame, active: f.active(), calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles, memory: renderer.info.memory };
      }, { clip, frame, emotes });
      expect(row.active).toEqual([clip]);
      await page.locator('canvas').screenshot({ path: fileURLToPath(new URL(`${version}-${clip}.png`, directory)) });
      rows.push({ version, ...row });
    }
    await page.unroute('**/config/characters.json');
  }
  console.log('T28 paired captures and render budgets', JSON.stringify(rows));
});
