import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const read = path => readFileSync(path, 'utf8');
const cues = JSON.parse(read('art/vfx/emotes/cues.json'));
const current = JSON.parse(read('web/config/characters.json'));
const sources = read('web/assets/audio/sfx/sources.md');
const emotes = ['cheer_clap', 'heart', 'angry', 'egg_throw'];
const originalSizes = { cheer_clap: .1, heart: .24, angry: .16, egg_throw: .04 };
const files = new Set();
assert.equal(cues.clipFile, current.clipFile, 'active clip file');
assert.deepEqual(cues.eventFrames, current.cues, 'measured v2 event frames');
for (const id of emotes) {
  assert(cues.fx[id].size > originalSizes[id], `${id}: larger size`);
  assert(cues.cues.some(cue => cue.emote === id && cue.sound), `${id}: sound cue`);
}
for (const cue of cues.cues) {
  assert(Object.hasOwn(cue, 'sound'), `${cue.id}: sound field`);
  if (cue.clip) {
    const frames = cues.eventFrames[cue.clip][cue.event];
    assert.equal(cue.frame, (Array.isArray(frames) ? frames[cue.eventIndex] : frames) + cue.offsetFrames, cue.id);
  }
  if (cue.sound) assert(cues.sounds[cue.sound], `${cue.id}: registered sound`);
}
for (const [event, sound] of Object.entries(cues.sounds)) {
  assert(sound.files.length >= (event === 'egg_scream' ? 1 : 3), `${event}: variants`);
  for (const file of sound.files) {
    assert(sources.includes('`' + file + '`'), `${file}: provenance`);
    files.add(file);
  }
}
for (const file of files) {
  const path = 'web/assets/audio/sfx/' + file;
  assert(statSync(path).size > 0, path);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,channels,sample_rate', '-of', 'json', path], { encoding: 'utf8' });
  assert.equal(probe.status, 0, probe.stderr);
  const stream = JSON.parse(probe.stdout).streams[0];
  assert.equal(stream.codec_name, 'mp3', file);
  assert.equal(stream.channels, 1, file);
  assert.equal(Number(stream.sample_rate), 48000, file);
  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-f', 'f32le', '-'], { maxBuffer: 2 ** 22 });
  assert.equal(decoded.status, 0, decoded.stderr?.toString());
  const samples = decoded.stdout.length / 4;
  assert(samples > 2400 && samples <= 72000, `${file}: duration 0.05–1.5 s`);
  let peak = 0;
  for (let i = 0; i < samples; i++) peak = Math.max(peak, Math.abs(decoded.stdout.readFloatLE(i * 4)));
  assert(peak > .01 && peak < .9, `${file}: audible samples, no clipping`);
}
assert(cues.fx.egg_throw.flightSeconds < 1.2);
assert(cues.fx.egg_throw.projectileScale > 1);
for (const key of ['splatSeconds', 'maxSplatsPerFace', 'maxSplatAreaRatio']) assert.equal(cues.fx.egg_throw[key], current.fx.egg_throw[key], key);
assert(cues.cues.some(cue => cue.id === 'heart_impact' && cue.after === 'heart_release' && cue.sound));
assert(cues.budget.textureBytes <= 2097152);
assert.equal(cues.budget.maxParticles, 16 * (Math.max(...emotes.slice(0, 3).map(id => cues.fx[id].maxParticles)) + cues.fx.egg_throw.maxParticles + cues.fx.heart.burstParticles));
const report = read('_workspace/graphicmodel/2026-11-13-ux-motion-rooms/14_graphic-effect-vfx-designer_fx-bigger_v1.md');
assert.match(report, /^## 권장 값\r?$/m);
assert.match(report, /^## 런타임에 넘길 것\r?$/m);
const originals = {
  'egg-scream_01.mp3': '940da8fb6c13e5e0d4e47af6779dc25dc41f91564a675b97ff12449f0c2d050b',
  'pro-shout_01.mp3': 'f957237881e1cd1ba9c8520b62d83132986ae10e5d7f27f3e168bf9ee3f4e0ae',
  'pro-shout_02.mp3': 'eb147214d664b24347b3e307f30deea0e1adf403dcbaaebba932f178b341f631',
  'pro-shout_03.mp3': '474b4f501679437f3603e1d7c72a32b5d9a5b503e6df57929246b843f32ed2cd'
};
for (const [file, hash] of Object.entries(originals)) assert.equal(createHash('sha256').update(readFileSync('web/assets/audio/sfx/' + file)).digest('hex'), hash, `${file}: preserved`);
console.log(JSON.stringify({ ok: true, emotes: emotes.length, cues: cues.cues.length, audioFiles: files.size, preservedOriginals: Object.keys(originals).length }));
