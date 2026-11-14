import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const design = JSON.parse(readFileSync(new URL('../art/vfx/emotes/cues.json', import.meta.url)));

async function fixture(page, reducedMotion = 'no-preference', network = null) {
  await page.emulateMedia({ reducedMotion });
  await page.route('**/__fix1-fx', route => route.fulfill({ contentType: 'text/html', body:
    '<button id="enter">들어가기</button><button id="sound">소리</button><iframe src="about:blank"></iframe><script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' + (network ? '<script src="/vendor/peerjs.min.js"></script>' : '') }));
  await page.goto('/__fix1-fx');
  await page.evaluate(async network => {
    const THREE = await import('three'), { create } = await import('/character.js'), { createAvatar } = await import('/avatar.js');
    const config = Object.fromEntries(await Promise.all(['characters', 'teams', 'screen', 'network'].map(async name => [name, await fetch(`/config/${name}.json`).then(r => r.json())])));
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(), avatar = createAvatar(0xffffff), events = new EventTarget();
    const avatars = new Map(), states = new Map(), buffers = new Map(), starts = [], played = [];
    avatar.position.set(0, 0, 8); camera.position.set(0, 2, 8); scene.add(avatar, camera);
    const load = THREE.AudioLoader.prototype.loadAsync, play = THREE.PositionalAudio.prototype.play;
    THREE.AudioLoader.prototype.loadAsync = async function (url) { const buffer = await load.call(this, url); buffers.set(buffer, url); return buffer; };
    THREE.PositionalAudio.prototype.play = function (...args) {
      starts.push({ file: buffers.get(this.buffer), point: this.getWorldPosition(new THREE.Vector3()).toArray(), sound: this });
      return play.apply(this, args);
    };
    const faces = [
      { name: 'north', position: [0, 3, 2], normal: [0, 0, 1], width: 12, height: 8 },
      { name: 'south', position: [0, 3, -2], normal: [0, 0, -1], width: 12, height: 8 },
      { name: 'east', position: [2, 3, 0], normal: [1, 0, 0], width: 8, height: 6 },
      { name: 'west', position: [-2, 3, 0], normal: [-1, 0, 0], width: 8, height: 6 },
    ];
    window.arena = { avatar, screen: { faces, fullMode: false, state: { muted: true, userVolume: config.screen.volume } } };
    const emit = (type, detail) => events.dispatchEvent(new CustomEvent(type, { detail }));
    document.querySelector('#enter').onclick = () => { arena.screen.state.muted = false; emit('app:enter', network); emit('screen:state', arena.screen.state); };
    document.querySelector('#sound').onclick = () => { arena.screen.state.muted = !arena.screen.state.muted; emit('screen:state', arena.screen.state); };
    events.addEventListener('emote:played', e => played.push(e.detail.id));
    const ctx = { THREE, scene, camera, events, player: { avatar }, config: name => config[name],
      multiplayer: { avatarOf: id => avatars.get(id), get peers() { return [...states.values()]; } } };
    if (network) {
      const { createMultiplayer } = await import('/multiplayer.js');
      ctx.multiplayer = createMultiplayer(scene, () => [...avatar.position.toArray(), avatar.rotation.y], ctx);
      setInterval(() => ctx.multiplayer.update(performance.now()), 20);
    }
    window.f = { THREE, ctx, config, faces, avatars, states, starts, buffers, played, emit, now: 0, api: create(ctx) };
    f.step = dt => { f.now += dt * 1000; f.api.update(dt, f.now); scene.updateMatrixWorld(true); };
    f.advance = (seconds, step = 1 / 60) => { for (let left = seconds; left > 1e-8; left -= step) f.step(Math.min(left, step)); };
    f.request = id => emit('emote:request', { id });
    f.batch = id => scene.getObjectByName(`EmoteFX_${id}`);
    f.count = id => f.batch(id)?.visible ? f.batch(id).count : 0;
    f.matrix = (id, index = 0) => { const matrix = new THREE.Matrix4(); f.batch(id).getMatrixAt(index, matrix); return matrix; };
    f.point = (id, index = 0) => new THREE.Vector3().setFromMatrixPosition(f.matrix(id, index));
    f.peer = (peerId, emote, emoteSeq) => {
      if (!avatars.has(peerId)) { const a = createAvatar(0xffffff); a.position.set(0, 0, 8); avatars.set(peerId, a); scene.add(a); }
      const state = { peerId, emote, emoteSeq, character: config.characters.default }; states.set(peerId, state); emit('peer:state', state);
    };
  }, network);
  await page.waitForFunction(() => arena.character?.ready);
  await page.evaluate(() => f.step(0));
}

test('U-사용자-5 / C-사용자-1: configured enlarged egg, heart flight and bounded burst after clip end', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const rows = [], { THREE } = f;
    f.request('egg_throw'); const heldScale = arena.avatar.getObjectByName('Prop_Egg').getWorldScale(new THREE.Vector3());
    f.advance(32 / 30); const flightScale = new THREE.Vector3().setFromMatrixScale(f.matrix('flight'));
    f.advance(f.config.characters.fx.egg_throw.flightSeconds); const eggImpact = f.count('shells'); f.advance(2);
    const positions = [[0, 0, 8], [0, 0, -8], [8, 0, 0], [-8, 0, 0]];
    for (let side = 0; side < 4; side++) for (const fps of [30, 60, 144]) {
      arena.avatar.position.fromArray(positions[side]); f.step(0); f.request('heart'); f.advance(76 / 30, 1 / fps);
      const start = f.point('heart'), target = new THREE.Vector3().fromArray(f.faces[side].position);
      f.advance(.4, 1 / fps); const expected = start.clone().lerp(target, .5); expected.y += 1.2;
      const gap = f.point('heart').distanceTo(expected);
      f.advance(.4, 1 / fps); const burst = f.count('heart'), centre = f.point('heart');
      const impactGap = centre.distanceTo(target.clone().addScaledVector(new THREE.Vector3().fromArray(f.faces[side].normal), .04));
      f.advance(.3, 1 / fps); const afterClip = f.count('heart');
      f.advance(.2, 1 / fps); rows.push({ gap, burst, impactGap, afterClip, ended: f.count('heart') });
    }
    return { fx: f.config.characters.fx, heldScale: heldScale.toArray(), flightScale: flightScale.toArray(), eggImpact, rows };
  });
  // T82b / T96 approved stronger angry and egg effects; the others retain FX1 values.
  const { angry, egg_throw: egg, ...rest } = result.fx, { angry: designAngry, egg_throw: designEgg, ...designRest } = design.fx;
  expect(rest).toEqual(designRest);
  expect(angry.maxParticles).toBeGreaterThan(designAngry.maxParticles); expect(angry.seconds).toBeGreaterThan(designAngry.seconds);
  expect(egg.projectileScale).toBe(designEgg.projectileScale * 4);
  result.heldScale.forEach((v, i) => { expect(v).toBeCloseTo(egg.projectileScale, 5); expect(result.flightScale[i]).toBeCloseTo(v, 5); });
  expect(result.eggImpact).toBe(egg.maxParticles);
  for (const row of result.rows) {
    expect(row.gap).toBeLessThan(.001); expect(row.impactGap).toBeLessThan(.001);
    expect(row).toMatchObject({ burst: 4, afterClip: 4, ended: 0 });
  }
});

test('U-사용자-5 / C-사용자-2: entry unlocks all four SFX, remote sequences and shared mute/volume', async ({ page }) => {
  await fixture(page); await page.locator('#enter').click();
  await page.waitForFunction(() => f.buffers.size === 13);
  const result = await page.evaluate(() => {
    const rows = [];
    for (const id of ['cheer_clap', 'heart', 'angry', 'egg_throw']) {
      const before = f.starts.length; f.request(id); f.advance(5);
      rows.push({ id, sounds: f.starts.slice(before).map(s => ({ file: s.file, point: s.point })) });
    }
    const joining = f.starts.length;
    f.peer('one', 'angry', 7); f.advance(1); const first = f.starts.length - joining, before = f.starts.length;
    f.emit('peer:state', f.states.get('one')); f.advance(1);
    f.avatars.get('one').removeFromParent(); f.avatars.delete('one'); f.step(0); f.peer('one', 'angry', 7); f.advance(1);
    f.peer('one', 'angry', 6); f.advance(1); const replay = f.starts.length - before;
    f.peer('one', 'angry', 8); f.advance(1); const fresh = f.starts.length - before;
    arena.screen.state.userVolume /= 2; f.emit('screen:state', arena.screen.state);
    return { rows, first, replay, fresh, gain: f.starts.at(-1).sound.gain.gain.value, played: f.played.length, claps: [].concat(f.config.characters.cues.Emote_CheerClap.clap_contact).length };
  });
  // T79: one cheer sound per clap_contact cue in characters.json.
  expect(result.rows.map(r => r.sounds.length)).toEqual([result.claps, 2, 1, 2]); expect(result.first).toBe(0); expect(result.replay).toBe(0); expect(result.fresh).toBe(1); expect(result.played).toBe(4);
  for (const [index, prefix] of ['cheer-clap', 'heart-pop', 'angry-voice', 'egg-scream'].entries()) expect(result.rows[index].sounds[0].file).toContain(prefix);
  expect(result.rows[1].sounds[1].point).toEqual([0, 3, 2]); expect(result.rows[3].sounds[1].file).toContain('egg-impact');
  await expect.poll(() => page.evaluate(() => f.starts.at(-1).sound.getVolume())).toBeCloseTo(.16, 2);
  await page.locator('#sound').click();
  const muted = await page.evaluate(() => {
    const before = f.starts.length; f.request('cheer_clap');
    f.advance([].concat(f.config.characters.cues.Emote_CheerClap.clap_contact)[0] / f.config.characters.clipFps);
    return { sounds: f.starts.length - before, visuals: f.count('cheer_clap') };
  });
  expect(muted).toEqual({ sounds: 0, visuals: 12 });
});

test('U-사용자-5 / N-4: full mode, hidden expiry, late cues, missing faces and cleanup', async ({ page }) => {
  await fixture(page); await page.locator('#enter').click(); await page.waitForFunction(() => f.buffers.size === 13);
  const result = await page.evaluate(() => {
    const iframe = document.querySelector('iframe'), original = iframe.outerHTML, frame = iframe.contentWindow;
    arena.screen.fullMode = true;
    for (const id of ['cheer_clap', 'heart', 'angry', 'egg_throw']) { f.request(id); f.advance(1.2); }
    const full = f.ctx.scene.children.filter(o => o.name.startsWith('EmoteFX_') && o.visible).length, silent = f.starts.length;
    f.advance(5); arena.screen.fullMode = false;
    f.request('heart'); f.advance(.2); Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); f.step(30);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); f.step(0); f.advance(4);
    const expired = f.count('heart'), hiddenSounds = f.starts.length;
    f.request('cheer_clap'); f.step(.9); const latestOnly = f.starts.length;
    // A cue more than 0.1 s behind effect time is dropped; step past the first angry_swing (T81b/T82b moved it) by 0.2 s.
    f.request('angry'); f.step([].concat(f.config.characters.cues.Emote_Angry.angry_swing)[0] / f.config.characters.clipFps + .2); const staleDropped = f.starts.length === latestOnly;
    arena.screen.faces = []; f.request('heart'); f.advance(4); const missing = f.starts.length === latestOnly && f.count('heart') === 0;
    const maps = new Set(f.ctx.scene.children.filter(o => o.name.startsWith('EmoteFX_')).map(o => o.material.map).filter(Boolean));
    const bytes = [...maps].reduce((sum, map) => sum + map.image.width * map.image.height * 4, 0);
    f.api.dispose(); f.api.dispose();
    return { full, silent, expired, hiddenSounds, latestOnly, staleDropped, missing, bytes,
      cleaned: !f.ctx.scene.children.some(o => o.name.startsWith('EmoteFX_')), unchanged: iframe.outerHTML === original && iframe.contentWindow === frame };
  });
  expect(result).toEqual({ full: 0, silent: 0, expired: 0, hiddenSounds: 0, latestOnly: 1, staleDropped: true, missing: true, bytes: 1048576, cleaned: true, unchanged: true });
});

test('U-사용자-5: reduced motion has straight heart flight and one bounded screen particle', async ({ page }) => {
  await fixture(page, 'reduce');
  const result = await page.evaluate(() => {
    arena.screen.faces[0].width = .2; arena.screen.faces[0].height = .3;
    f.request('heart'); f.advance(76 / 30); const start = f.point('heart'); f.advance(.4);
    const gap = f.point('heart').distanceTo(start.lerp(new f.THREE.Vector3(0, 3, 2), .5));
    f.advance(.4); return { gap, count: f.count('heart'), size: f.matrix('heart').getMaxScaleOnAxis() };
  });
  expect(result.gap).toBeLessThan(.001); expect(result.count).toBe(1); expect(result.size).toBeCloseTo(.2, 5);
});

test('T96: two browser contexts in one real room share seated egg size, release, impact sound and expiry; late join does not replay', async ({ browser }) => {
  test.setTimeout(180_000);
  const hostContext = await browser.newContext(), guestContext = await browser.newContext();
  const host = await hostContext.newPage(), guest = await guestContext.newPage();
  const network = { broadcastId: `t96-${Date.now()}`, showtime: Math.floor(Date.now() / 600000) * 600000, roomKey: '01' };
  try {
    await fixture(host, 'no-preference', network); await host.locator('#enter').click();
    await host.waitForFunction(() => f.ctx.multiplayer.room, null, { timeout: 45000 });
    await fixture(guest, 'no-preference', network); await guest.locator('#enter').click();
    for (const page of [host, guest]) {
      await page.waitForFunction(() => { f.step(0); return f.ctx.multiplayer.count === 2 && f.ctx.multiplayer.peers.length === 1 && f.buffers.size === 13; }, null, { timeout: 45000 });
    }
    expect(await guest.evaluate(() => f.ctx.multiplayer.room)).toMatchObject({ code: '01', roundStart: network.showtime });
    await host.evaluate(() => { f.emit('seat:enter'); f.request('egg_throw'); });
    await guest.waitForFunction(() => { f.step(0); return f.ctx.multiplayer.peers.some(p => p.emote === 'egg_throw' && p.emoteSeq === 1 && p.seated); });
    const rows = [];
    for (const page of [host, guest]) rows.push(await page.evaluate(() => {
      const cfg = f.config.characters.fx.egg_throw, arm = f.ctx.camera.getObjectByName('EggFirstPerson');
      f.advance(cfg.seatedReleaseSeconds - .001); const before = f.count('flight'), armBefore = arm.visible; f.step(.001);
      const flight = f.count('flight'), scale = new f.THREE.Vector3().setFromMatrixScale(f.matrix('flight')).toArray();
      f.advance(cfg.flightSeconds); const impact = { shells: f.count('shells'), yolk: f.count('yolk'),
        sound: f.starts.at(-1)?.file, splat: f.ctx.scene.children.find(o => o.name === 'EmoteFX_splat' && o.visible)?.scale.x };
      f.advance(cfg.splatSeconds); const gone = !f.ctx.scene.children.some(o => o.name === 'EmoteFX_splat' && o.visible);
      return { before, armBefore, flight, scale, impact, gone, cfg, sounds: f.starts.length };
    }));
    expect(rows[0].armBefore).toBe(true); expect(rows[1].armBefore).toBe(false);
    for (const row of rows) {
      expect(row).toMatchObject({ before: 0, flight: 1, gone: true, sounds: 2 });
      row.scale.forEach(value => expect(value).toBeCloseTo(10, 5)); expect(row.impact).toMatchObject({ shells: 12, yolk: 8, sound: expect.stringContaining('egg-impact_') });
    }
    expect(rows[0].impact.splat).toBe(rows[1].impact.splat);
    for (const page of [host, guest]) await expect.poll(() => page.evaluate(() => f.starts.at(-1).sound.getVolume())).toBeCloseTo(.65, 2);
    await fixture(guest, 'no-preference', network); await guest.locator('#enter').click();
    await guest.waitForFunction(() => { f.step(0); return f.ctx.multiplayer.peers.some(p => p.emoteSeq === 1); }, null, { timeout: 45000 });
    const late = await guest.evaluate(() => { f.advance(5); return { sounds: f.starts.length, flight: f.count('flight'), shells: f.count('shells'), arm: f.ctx.camera.getObjectByName('EggFirstPerson').visible }; });
    expect(late).toEqual({ sounds: 0, flight: 0, shells: 0, arm: false });
  } finally { await guestContext.close(); await hostContext.close(); }
});

test('T96: stronger seated impact still follows shared volume and mute', async ({ page }) => {
  await fixture(page); await page.locator('#enter').click(); await page.waitForFunction(() => f.buffers.size === 13);
  await page.evaluate(() => { f.emit('seat:enter'); f.request('egg_throw'); f.advance(.18 + .55); });
  await expect.poll(() => page.evaluate(() => f.starts.at(-1).sound.getVolume())).toBeCloseTo(.65, 2);
  await page.evaluate(() => { arena.screen.state.userVolume /= 2; f.emit('screen:state', arena.screen.state); });
  await expect.poll(() => page.evaluate(() => f.starts.at(-1).sound.getVolume())).toBeCloseTo(.325, 2);
  await page.locator('#sound').click();
  const result = await page.evaluate(() => {
    const before = f.starts.length, stopped = !f.starts.at(-1).sound.isPlaying;
    f.advance(5); f.request('egg_throw'); f.advance(.18 + .55);
    return { stopped, silent: f.starts.length === before, shells: f.count('shells') };
  });
  expect(result).toEqual({ stopped: true, silent: true, shells: 12 });
});
