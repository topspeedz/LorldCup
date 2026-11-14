// Reuse glb-inspect counts after selecting actual upper-floor triangles from Draco data.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import * as THREE from '../../../web/vendor/three.module.js';
import { inspect, parseGlb } from '../../../.claude/skills/blender-pipeline/scripts/glb-inspect.mjs';

const path = process.argv[2], label = process.argv[3];
assert(path && ['before', 'after'].includes(label));
const blob = readFileSync(path), { json: g, bin } = parseGlb(blob);
const require = createRequire(import.meta.url);
const draco = await require('../../../web/vendor/draco/draco_wasm_wrapper.js')({
  wasmBinary: readFileSync(new URL('../../../web/vendor/draco/draco_decoder.wasm', import.meta.url)),
});
const decoder = new draco.Decoder(), parents = new Map(), matrices = new Map();
g.nodes.forEach((node, i) => node.children?.forEach(child => parents.set(child, i)));
function matrix(i) {
  if (matrices.has(i)) return matrices.get(i);
  const n = g.nodes[i], m = n.matrix ? new THREE.Matrix4().fromArray(n.matrix) : new THREE.Matrix4().compose(
    new THREE.Vector3(...(n.translation ?? [0, 0, 0])), new THREE.Quaternion(...(n.rotation ?? [0, 0, 0, 1])),
    new THREE.Vector3(...(n.scale ?? [1, 1, 1])));
  if (parents.has(i)) m.premultiply(matrix(parents.get(i)));
  matrices.set(i, m); return m;
}
const categories = { chairs: [], mannequins: [], railsStairs: [], other: [] };
const rows = [];
for (const [i, node] of g.nodes.entries()) {
  if (node.mesh === undefined) continue;
  const name = node.name;
  const category = /^Seats__|^Seat_armrests__|^Fix_SeatBases/.test(name) ? 'chairs' :
    /^Audience_(torsos|heads)|^REF_FanLightsticks/.test(name) ? 'mannequins' :
    /^Walk_Tier1|^Aisle_|^AudienceDetail_Aisle|^Fix_(UpperWest|TierRisers|TierSoffits|TierFascia)/.test(name) ? 'railsStairs' :
    /^Tier_ribbon|^AudienceDetail_Ribbon|^REF_Ribbon(Program|Brand)_1_|^Section_number|^Suite_fascia/.test(name) ? 'other' : null;
  if (!category) continue;
  let upperTriangles = 0, upperDraws = 0;
  for (const primitive of g.meshes[node.mesh].primitives) {
    const ext = primitive.extensions?.KHR_draco_mesh_compression;
    assert(ext, name);
    const view = g.bufferViews[ext.bufferView], bytes = bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const mesh = new draco.Mesh(), buffer = new draco.DecoderBuffer(); buffer.Init(bytes, bytes.length);
    const status = decoder.DecodeBufferToMesh(buffer, mesh); assert(status.ok(), name);
    const attribute = decoder.GetAttributeByUniqueId(mesh, ext.attributes.POSITION);
    const length = mesh.num_points() * 3, pointer = draco._malloc(length * 4);
    decoder.GetAttributeDataArrayForAllPoints(mesh, attribute, draco.DT_FLOAT32, length * 4, pointer);
    const positions = new Float32Array(draco.HEAPF32.buffer, pointer, length).slice(); draco._free(pointer);
    const count = mesh.num_faces() * 3, indexPointer = draco._malloc(count * 4);
    decoder.GetTrianglesUInt32Array(mesh, count * 4, indexPointer);
    const indices = new Uint32Array(draco.HEAPF32.buffer, indexPointer, count).slice(); draco._free(indexPointer);
    const transform = matrix(i).elements;
    let selected = 0;
    for (let triangle = 0; triangle < count; triangle += 3) {
      let height = 0;
      for (let corner = 0; corner < 3; corner++) {
        const at = indices[triangle + corner] * 3;
        height += transform[1] * positions[at] + transform[5] * positions[at + 1] + transform[9] * positions[at + 2] + transform[13];
      }
      if (height / 3 > 5) selected++;
    }
    if (selected) {
      const subset = { asset: { version: '2.0' }, nodes: [{ mesh: 0 }],
        meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }], accessors: [{ count: 0 }, { count: selected * 3 }] };
      let json = Buffer.from(JSON.stringify(subset));
      json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)]);
      const header = Buffer.alloc(20); header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
      header.writeUInt32LE(20 + json.length, 8); header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
      const metrics = inspect(Buffer.concat([header, json]));
      assert.equal(metrics.triangles, selected);
      upperTriangles += metrics.triangles; upperDraws += metrics.draws;
    }
    draco.destroy(buffer); draco.destroy(mesh);
  }
  if (upperTriangles) { const row = { name, triangles: upperTriangles, draws: upperDraws }; rows.push(row); categories[category].push(row); }
}
draco.destroy(decoder);
const totals = Object.fromEntries(Object.entries(categories).map(([name, list]) => [name, {
  triangles: list.reduce((n, row) => n + row.triangles, 0), draws: list.reduce((n, row) => n + row.draws, 0),
}]));
const report = { label, source: path, full: inspect(blob), upper: {
  triangles: rows.reduce((n, row) => n + row.triangles, 0), draws: rows.reduce((n, row) => n + row.draws, 0), categories: totals, rows,
} };
writeFileSync(new URL(`../../../temp/T75/${label}-glb-stats.json`, import.meta.url), JSON.stringify(report, null, 2));
console.log('T75_GLB_UPPER', JSON.stringify({ label, ...report.upper, rows: undefined }));
