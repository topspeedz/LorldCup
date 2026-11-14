import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const json = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const glb = path => {
  const bytes = readFileSync(new URL('../web/' + path, import.meta.url));
  return JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
};
const cues = json('art/vfx/arena-show/cues.json');
const sky = json('web/config/sky-show.json');
const stage = json('web/config/stage-players.json');
const beamSources = json('web/lighting-config.json').lights.filter(light => /^REF_(OverheadBeam|WingUplight)/.test(light.name));
const shoutFiles = [1, 2, 3].map(i => `./assets/audio/sfx/pro-shout_0${i}.mp3`);
const ranges = { stage: 128, bowl: 16, seats: 8, concourse: 64, interior: 32, exterior: 8, city: 2 }; // T75 rebaked interior peaks at 17.934, above the previous RGBM range.
const lightmaps = Object.fromEntries(Object.entries(ranges).map(([name, range]) => [`./lightmaps/${name}-v2${name === 'exterior' ? '-2k' : ''}.png`, range]));
const required = /^(REF_Jumbotron_|REF_Reused_Monitor_pixels__cyan|REF_Player|Walk_|Collide_|Roof|Atrium_ceiling|Audience_|REF_FanLightsticks|REF_(CircularStage|TrophyIsland|RunwayTransition|CenterStairs|TeamRiser)|Seats__|Seat_armrests__|REF_OverheadBeam|REF_WingUplight|AudienceDetail_)/;
const blockers = /Player_desks|Player_PC|Player_chair|Plaza_bench|Bollards|REF_DeskBody|REF_CenterBackdrop|REF_WingMainFrame|CCR_(Counter|Timber|Refrigerator|Lounge|Banquette)/;
const names = glb('arena.glb').nodes.map(node => node.name).filter(name => required.test(name) || blockers.test(name));

test('v2 preserves GLB names and metadata; T39 beam sources remain in the lighting config', () => {
  const model = glb('arena-v2.glb'), byName = new Map(model.nodes.map(node => [node.name, node]));
  expect(names.filter(name => !byName.has(name))).toEqual([]);
  for (const prefix of ['Seats__', 'Seat_armrests__', 'AudienceDetail_']) {
    expect([...byName.keys()].filter(name => name?.startsWith(prefix)).length, prefix).toBeGreaterThan(0);
  }
  expect(beamSources.filter(light => light.name.startsWith('REF_OverheadBeam'))).toHaveLength(16);
  expect(beamSources.filter(light => light.name.startsWith('REF_WingUplight'))).toHaveLength(10);
  const baked = model.nodes.filter(node => node.extras?.bakedLighting);
  expect(Object.fromEntries(baked.map(node => {
    const info = node.extras.bakedLighting;
    for (const primitive of model.meshes[node.mesh].primitives) {
      expect(primitive.attributes).toHaveProperty('_LIGHTMAP_UV');
      expect(primitive.attributes).not.toHaveProperty('_CM_PART');
    }
    return [info.texture, info.range];
  }))).toEqual(lightmaps);
  for (const path of Object.keys(lightmaps)) {
    const png = readFileSync(new URL('../web/' + path, import.meta.url));
    const size = /\/(bowl|seats|concourse)-v2\.png$/.test(path) ? 4096 : 2048;
    expect([png.readUInt32BE(16), png.readUInt32BE(20)], path).toEqual([size, size]);
  }
  expect(baked.length).toBe(394); // T75 adds five ramp/curb nodes and six baked __lod10 copies.
});

test('local show settings match T33 cues and use all three T34 shout files', () => {
  expect(sky.beams).toMatchObject({ count: cues.defaults.sky_beam.count,
    periodSeconds: cues.defaults.sky_beam.roundTripSeconds, angleDegrees: cues.defaults.sky_beam.sweepDegrees,
    opacity: cues.defaults.sky_beam.opacity });
  const { quality, particlesPerBurst, ...firework } = cues.productionDefaults.firework;
  expect(sky.fireworks).toMatchObject({ ...firework, particlesPerBurst: particlesPerBurst[quality],
    intervalSeconds: cues.defaults.firework.intervalSeconds, count: cues.defaults.firework.burstsPerEvent });
  expect(cues.cues.find(cue => cue.id === 'pro_shout')).toMatchObject({ frame: 0, sound: 'pro_shout' });
  expect(stage.shout).toEqual({ files: shoutFiles, gain: cues.productionDefaults.audio.gain });
});

async function openArena(page) {
  const errors = [], loaded = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/THREE.WebGLProgram: Shader Error/.test(message.text())) errors.push(message.text()); });
  page.on('response', response => { if (response.ok()) loaded.push(new URL(response.url()).pathname); });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      window.arenaV2Probe={};
      for(const entry of modules){
        if(!['stage-players.js','sky-show.js'].includes(entry.path))continue;
        const original=entry.create;
        entry.create=ctx=>{
          const instance=original(ctx);arenaV2Probe.ctx=ctx;arenaV2Probe[entry.path]=instance;
          return {dispose:()=>instance.dispose()};
        };
      }` });
  });
  const started = Date.now();
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready, null, { timeout: 120_000 });
  console.log('T38 app ready after navigation (ms):', Date.now() - started);
  return { errors, loaded };
}

test('the app loads v2 and renders the support columns and stair infill with v2 lighting', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 960, height: 640 });
  const { errors, loaded } = await openArena(page);
  expect(loaded).toContain('/arena-v2.glb');
  expect(loaded).not.toContain('/arena.glb');
  expect([...new Set(loaded.filter(path => path.startsWith('/lightmaps/')))].sort())
    .toEqual(Object.keys(lightmaps).map(path => path.slice(1)).sort());
  const result = await page.evaluate(({ names, lightmaps, beamSources }) => {
    const { ctx } = arenaV2Probe, { THREE, root, scene } = ctx, actual = new Set(), invalid = [];
    root.traverse(object => {
      actual.add(object.name);
      if (!object.isMesh) return;
      let owner = object;while (owner && !owner.userData.bakedLighting) owner = owner.parent;
      if (!owner) return;
      const info = owner.userData.bakedLighting;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        const shader = { uniforms: {}, fragmentShader: '' };material.onBeforeCompile(shader, ctx.renderer);
        if (!material.userData.bakedLighting || !material.lightMap?.image?.complete ||
            !material.lightMap.image.src.endsWith(info.texture.slice(1)) ||
            shader.uniforms.bakedLightRange?.value !== lightmaps[info.texture] ||
            !object.geometry.attributes.uv3) invalid.push(object.name);
      }
    });
    const missing = names.map(THREE.PropertyBinding.sanitizeNodeName).filter(name => !actual.has(name));
    const sky = scene.getObjectByName('Sky_Show');
    const missingBeams = beamSources.filter(source => {
      const beam = scene.getObjectByName(source.name + '_WebBeam');
      return !beam?.isMesh || !beam.material.uniforms.beamColor.value.equals(new THREE.Color(...source.color));
    }).map(source => source.name);
    const skyBeams = sky.children.filter(o => o.isMesh);
    return { missing, invalid, baked: arena.lighting.baked, beams: sky.children.filter(o => o.isMesh).length,
      missingBeams, paletteMatches: skyBeams.every((beam, i) =>
        beam.material.uniforms.beamColor.value.equals(scene.getObjectByName(beamSources[i].name + '_WebBeam').material.uniforms.beamColor.value)),
      crowdBaked: arena.crowd.meshes.some(o => (Array.isArray(o.material) ? o.material : [o.material]).some(m => m.lightMap)) };
  }, { names, lightmaps, beamSources });
  expect(result.missing).toEqual([]);
  expect(result.invalid).toEqual([]);
  expect(result.baked).toEqual({ meshes: 468, materials: 468, textures: 7 }); // T75 adds 5 ramp/curb primitives and 38 baked __lod10 primitives.
  expect(result.beams).toBe(cues.defaults.sky_beam.count);
  expect(result.missingBeams).toEqual([]);
  expect(result.paletteMatches).toBe(true);
  expect(result.crowdBaked).toBe(false);
  await page.locator('#enter').click();
  // T31 inspection viewpoints, converted from Blender Z-up to runtime Y-up.
  for (const view of [
    { name: 'columns', position: [38, -8.7, -1], target: [43.15, -7, -6.63], object: 'Collide_TierColumns__concrete' },
    { name: 'stair-infill', position: [-53, -7, 8], target: [-50, -5.6, 2], object: 'Collide_RampInfill__concrete' },
  ]) {
    const evidence = await page.evaluate(view => {
      const { ctx } = arenaV2Probe, { THREE, camera, renderer, scene, root } = ctx;
      arena.crowd.setPaused(true);arena.crowd.seek(0);
      ctx.cameraRig.setOverride(camera => { camera.position.fromArray(view.position);camera.lookAt(...view.target); });
      camera.position.fromArray(view.position);camera.lookAt(...view.target);camera.updateMatrixWorld(true);
      const object = root.getObjectByName(view.object), target = new THREE.WebGLRenderTarget(480, 320);
      const pixels = () => {
        renderer.setRenderTarget(target);renderer.render(scene, camera);
        const data = new Uint8Array(480 * 320 * 4);renderer.readRenderTargetPixels(target, 0, 0, 480, 320, data);return data;
      };
      const visible = pixels();object.visible = false;const hidden = pixels();object.visible = true;
      let changed = 0;
      for (let i = 0; i < visible.length; i += 4) {
        if (Math.abs(visible[i] - hidden[i]) + Math.abs(visible[i + 1] - hidden[i + 1]) + Math.abs(visible[i + 2] - hidden[i + 2]) > 5) changed++;
      }
      renderer.setRenderTarget(null);target.dispose();renderer.render(scene, camera);
      return { changed, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ...renderer.info.memory };
    }, view);
    expect(evidence.changed, view.name).toBeGreaterThan(20);
    const screenshot = testInfo.outputPath(view.name + '.png');
    await page.screenshot({ path: screenshot });
    await testInfo.attach(view.name, { path: screenshot, contentType: 'image/png' });
    console.log('T38 viewpoint', view.name, JSON.stringify(evidence));
  }
  console.log('T38 v2 runtime', JSON.stringify(result));
  expect(errors).toEqual([]);
});

test('shout starts a decoded T34 voice once, varies takes, and stops on mute or disposal', async ({ page }) => {
  test.setTimeout(180_000);
  const { errors, loaded } = await openArena(page);
  let releaseAudio;
  const audioReady = new Promise(resolve => { releaseAudio = resolve; });
  await page.route(/\/pro-shout_0[123]\.mp3$/, async route => { await audioReady;await route.continue(); });
  await page.locator('#enter').click();
  const pending = await page.evaluate(() => {
    const instance = arena.stagePlayers, random = Math.random;Math.random = () => .05;
    instance.update(0, 0);
    for (const player of instance.players) { player.action = 'mouse';player.duration = 3;player.elapsed = 2.95; }
    instance.update(.1, 100);Math.random = random;
    return { shouts: instance.players.filter(player => player.action === 'shout').length,
      silent: instance.players.every(player => !player.sound?.isPlaying) };
  });
  releaseAudio();
  expect(pending.shouts).toBeGreaterThan(0);
  expect(pending.silent).toBe(true);
  await page.waitForFunction(() => arena.stagePlayers.players.every(player => player.sound?.buffer));
  expect(await page.evaluate(() => arena.stagePlayers.players.every(player => !player.sound.isPlaying))).toBe(true);
  expect(loaded.filter(path => /\/pro-shout_0[123]\.mp3$/.test(path)).sort()).toEqual(shoutFiles.map(path => path.slice(1)).sort());
  const result = await page.evaluate(async files => {
    const { ctx } = arenaV2Probe, instance = arena.stagePlayers, { players } = instance;
    const context = players[0].sound.context;
    const decoded = await Promise.all(files.map(async file => context.decodeAudioData(await (await fetch(file)).arrayBuffer())));
    const identify = buffer => decoded.findIndex(reference => reference.length === buffer.length &&
      reference.getChannelData(0).every((sample, i) => sample === buffer.getChannelData(0)[i]));
    const random = Math.random, selected = [], starts = players.map(() => 0);
    for (const [i, player] of players.entries()) {
      const play = player.sound.play.bind(player.sound);
      player.sound.play = (...args) => { starts[i]++;return play(...args); };
    }
    const shouter = players[0];let now = 0;instance.update(0, now);
    for (let round = 0; round < 6; round++) {
      for (const player of players) { player.action = 'mouse';player.elapsed = 0;player.duration = 8; }
      shouter.elapsed = 7.95;const draws = [.05, .5, round % 3 ? .999999 : 0];Math.random = () => draws.shift() ?? .5;
      instance.update(.1, now += 100);
      const source = shouter.sound.source;
      selected.push({ index: identify(shouter.sound.buffer), action: shouter.action,
        volume: shouter.sound.getVolume(), starts: starts[0], playing: shouter.sound.isPlaying,
        positional: shouter.sound instanceof ctx.THREE.PositionalAudio });
      instance.update(.1, now += 100);
      selected.at(-1).oneShot = source === shouter.sound.source && starts[0] === round + 1;
    }
    Math.random = random;
    const analyser = new ctx.THREE.AudioAnalyser(shouter.sound, 256);
    await new Promise(resolve => setTimeout(resolve, 100));
    const energy = analyser.getAverageFrequency();analyser.analyser.disconnect();
    arena.screen.setMuted(true);instance.update(.1, now += 100);
    const muted = players.every(player => !player.sound.isPlaying);
    instance.dispose();instance.dispose();
    return { selected, energy, muted, otherStarts: starts.slice(1),
      clips: decoded.map(buffer => ({ seconds: buffer.duration,
        onsetMs: buffer.getChannelData(0).findIndex(sample => Math.abs(sample) >= .01) / buffer.sampleRate * 1000 })),
      disposed: players.every(player => !player.sound.isPlaying && !player.sound.parent) };
  }, shoutFiles);
  expect(result.energy).toBeGreaterThan(0);
  expect([...new Set(result.selected.map(voice => voice.index))].sort()).toEqual([0, 1, 2]);
  for (const clip of result.clips) {
    expect(clip.seconds).toBeLessThanOrEqual(3);
    expect(clip.onsetMs).toBeGreaterThanOrEqual(0);
    expect(clip.onsetMs).toBeLessThanOrEqual(50);
  }
  for (const [i, voice] of result.selected.entries()) {
    expect(voice).toMatchObject({ action: 'shout', volume: cues.productionDefaults.audio.gain, playing: true, positional: true, oneShot: true });
    expect(voice.index).toBeGreaterThanOrEqual(0);
    if (i) expect(voice.index).not.toBe(result.selected[i - 1].index);
  }
  expect(result.otherStarts).toEqual(Array(9).fill(0));
  expect(result.muted).toBe(true);
  expect(result.disposed).toBe(true);
  expect(errors).toEqual([]);
  console.log('T38 real audio', JSON.stringify(result));
});
