// Adapted from web-export/validate-glb.cjs; reports stay inside the T32 scope.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const validator = require(path.join(root, 'web-export/validation-tools/node_modules/gltf-validator'));
const readGlb = file => {
  const bytes = fs.readFileSync(file);
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  return { bytes, gltf: JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12))) };
};
async function main() {
  const { bytes, gltf: g } = readGlb(path.join(root, 'web/arena-v2.glb'));
  const { gltf: old } = readGlb(path.join(root, 'web/arena.glb'));
  const inspection = JSON.parse(fs.readFileSync(path.join(__dirname, 't32-source-inspection.json')));
  const required = /^(REF_Jumbotron_[0-3]$|REF_Reused_Monitor_pixels__cyan$|REF_Player|Walk_|Collide_|Audience_|REF_FanLightsticks|Roof|Atrium_ceiling|REF_CircularStage|REF_TrophyIsland|REF_RunwayTransition|REF_CenterStairs|REF_TeamRiser)|Player_desks|Player_PC|Player_chair|Plaza_bench|Bollards|REF_DeskBody|REF_CenterBackdrop|REF_WingMainFrame|CCR_Counter|CCR_Timber|CCR_Refrigerator|CCR_Lounge|CCR_Banquette/;
  const names = new Set(g.nodes.map(n => n.name));
  const preserved = old.nodes.filter(n => required.test(n.name));
  assert.deepEqual(preserved.filter(n => !names.has(n.name)), [], 'Required runtime names missing');
  for (const key of ['bakedLighting', 'crowdMotion']) {
    const kept = new Set(g.nodes.filter(n => n.extras?.[key] !== undefined).map(n => n.name));
    assert.deepEqual(old.nodes.filter(n => n.extras?.[key] !== undefined && names.has(n.name) && !kept.has(n.name)).map(n => n.name), [], `Lost ${key}`);
  }
  for (const name of inspection.added.filter(n => n !== 'EXR_MoonLight')) assert(names.has(name), `Missing T31 mesh ${name}`);
  const attributes = ['_CM_ORIGIN', '_CM_RIGHT', '_CM_FRONT', '_CM_PART', '_CM_SIDE', '_CM_SEED', '_CM_STYLE'];
  const custom = gltf => new Set(gltf.meshes.flatMap(m => m.primitives.flatMap(p => Object.keys(p.attributes))).filter(a => a.startsWith('_')));
  assert.deepEqual([...custom(old)].filter(a => !custom(g).has(a)), [], 'Lost custom attributes');
  const crowd = g.nodes.filter(n => n.extras?.crowdMotion);
  assert.equal(crowd.length, 14);
  for (const n of crowd) {
    assert(!n.extras.bakedLighting, `Crowd baked: ${n.name}`);
    for (const p of g.meshes[n.mesh].primitives) for (const a of attributes) assert(a in p.attributes, `${n.name}: ${a}`);
  }
  const atlases = { stage: 2048, bowl: 4096, seats: 4096, concourse: 4096, interior: 2048, exterior: 4096, city: 2048 };
  const bake = JSON.parse(fs.readFileSync(path.join(__dirname, 't32-bake/lightmap-report.json')));
  assert.equal(bake.samples, 64);
  const ranges = Object.fromEntries(bake.atlases.map(a => [a.name, a.range]));
  let lightmapBytes = 0;
  const baked = g.nodes.filter(n => n.extras?.bakedLighting);
  assert(baked.length >= 375);
  for (const n of baked) {
    const info = n.extras.bakedLighting;
    assert(/^\.\/lightmaps\/(stage|bowl|seats|concourse|interior|exterior|city)-v2\.png$/.test(info.texture));
    const key = path.basename(info.texture).replace('-v2.png', '');
    assert.equal(info.range, ranges[key]);
    assert(info.range > 0 && Number.isFinite(info.range));
    assert.equal(info.uvAttribute, '_lightmap_uv');
    for (const p of g.meshes[n.mesh].primitives) {
      assert('_LIGHTMAP_UV' in p.attributes, `No lightmap UV: ${n.name}`);
      assert.equal(g.accessors[p.attributes._LIGHTMAP_UV].count, g.accessors[p.attributes.POSITION].count);
    }
  }
  for (const [name, size] of Object.entries(atlases)) {
    assert(bake.atlases.find(a => a.name === name).max <= ranges[name], 'RGBM clipped');
    const png = fs.readFileSync(path.join(root, `web/lightmaps/${name}-v2.png`));
    assert.equal(png.readUInt32BE(0), 0x89504e47);
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(png[25], 6, 'RGBM requires RGBA');
    assert(baked.some(n => n.extras.bakedLighting.texture === `./lightmaps/${name}-v2.png`));
    lightmapBytes += png.length;
  }
  assert(lightmapBytes <= 151 * 1024 * 1024, 'Lightmap budget exceeded');
  assert.equal(g.materials.filter(m => m.extras?.thinGlassIOR === 1.42).length, 1);
  assert(g.extensionsRequired.includes('KHR_draco_mesh_compression'));
  assert(g.extensionsUsed.every(e => old.extensionsUsed.includes(e)));
  assert(g.images.every(i => i.uri === undefined && i.bufferView !== undefined));
  const motifs = JSON.parse(fs.readFileSync(path.join(__dirname, 't32-motifs.json')));
  for (const entry of motifs.replacements) {
    assert(!g.images.some(i => i.name === entry.original_image || i.name === entry.original_image.replace(/\.[^.]+$/, '')), `Old artwork embedded: ${entry.original_image}`);
    assert(g.images.some(i => i.name === entry.new_image), `New artwork absent: ${entry.new_image}`);
  }
  assert(!g.images.some(i => /WORLDS crest alpha/.test(i.name)), 'Old crest embedded');
  for (const [file, hash] of Object.entries(inspection.original_sha256)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), hash, `Original changed: ${file}`);
  }
  const result = await validator.validateBytes(new Uint8Array(bytes), { maxIssues: 1000 });
  fs.writeFileSync(path.join(__dirname, 't32-gltf-validator.json'), JSON.stringify(result, null, 2));
  assert.equal(result.issues.numErrors, 0, JSON.stringify(result.issues.messages.slice(0, 5)));
  const summary = { bytes: bytes.length, requiredNamesPreserved: preserved.length, addedMeshes: inspection.added.length - 1,
    crowdNodes: crowd.length, lightmappedNodes: baked.length, lightmaps: 7, lightmapBytes,
    errors: result.issues.numErrors, warnings: result.issues.numWarnings, originalsUnchanged: true };
  fs.writeFileSync(path.join(__dirname, 't32-validation.json'), JSON.stringify(summary, null, 2));
  console.log('T32_VALIDATION', JSON.stringify(summary));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
