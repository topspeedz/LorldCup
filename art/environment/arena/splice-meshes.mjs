// Replace named meshes in an arena GLB with the same-named meshes from a small Blender export, without re-encoding
// anything else: the new Draco bufferViews are appended, materials are matched by name, the replaced meshes' old
// accessors and bufferViews are dropped, and every other bufferView is copied byte for byte.
// Usage: node art/environment/arena/splice-meshes.mjs <arena.glb> <parts.glb> <out.glb>
import { readFileSync, writeFileSync } from 'node:fs';
import { readGlb } from './split-crowd.mjs';

const [arenaPath, partsPath, outPath] = process.argv.slice(2);
const arena = readGlb(arenaPath), parts = readGlb(partsPath);
const A = arena.json, P = parts.json;
const chunks = [arena.bin];
let offset = arena.bin.length;
const pad = n => (4 - n % 4) % 4;

for (const node of P.nodes.filter(n => 'mesh' in n)) {
  const target = A.nodes.find(n => n.name === node.name);
  if (!target) throw new Error(`no node ${node.name} in arena`);
  const same = k => JSON.stringify(node[k]) === JSON.stringify(target[k]);
  // A crowd node split out of the arena keeps its arena parent's name; a selection-only export bakes that parent into the node, the mesh data is the same.
  if (!target.extras?.arenaParent && !['translation', 'rotation', 'scale', 'matrix'].every(same)) throw new Error(`transform differs for ${node.name}`);
  const oldMesh = A.meshes[target.mesh], newMesh = P.meshes[node.mesh];
  if (oldMesh.primitives.length !== newMesh.primitives.length) throw new Error(`primitive count differs for ${node.name}`);
  oldMesh.primitives = newMesh.primitives.map((p, i) => {
    const old = oldMesh.primitives[i], matName = P.materials[p.material].name;
    if (A.materials[old.material].name !== matName) throw new Error(`material order differs for ${node.name}`);
    if (Object.keys(p.attributes).sort().join() !== Object.keys(old.attributes).sort().join()) throw new Error(`attributes differ for ${node.name}`);
    const draco = p.extensions.KHR_draco_mesh_compression, view = P.bufferViews[draco.bufferView];
    const bytes = parts.bin.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    chunks.push(Buffer.alloc(pad(offset)));offset += pad(offset);
    A.bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: bytes.length });
    chunks.push(bytes);offset += bytes.length;
    const copy = i => { A.accessors.push(structuredClone(P.accessors[i])); return A.accessors.length - 1; };
    const out = { ...structuredClone(p), material: old.material, indices: copy(p.indices), attributes: {} };
    for (const [k, v] of Object.entries(p.attributes)) out.attributes[k] = copy(v);
    out.extensions.KHR_draco_mesh_compression.bufferView = A.bufferViews.length - 1;
    return out;
  });
  console.log(node.name, oldMesh.primitives.map(p => A.accessors[p.indices].count).join('/'));
}

// Drop the accessors and bufferViews only the replaced meshes used, then repack the kept views in their old order.
const full = Buffer.concat(chunks);
const accUsers = [];
for (const m of A.meshes) for (const p of m.primitives) {
  accUsers.push([p, 'indices'], ...Object.keys(p.attributes).map(k => [p.attributes, k]));
  for (const t of p.targets ?? []) accUsers.push(...Object.keys(t).map(k => [t, k]));
}
for (const s of A.skins ?? []) if ('inverseBindMatrices' in s) accUsers.push([s, 'inverseBindMatrices']);
for (const a of A.animations ?? []) for (const s of a.samplers) accUsers.push([s, 'input'], [s, 'output']);
const accMap = new Map(), accessors = [];
for (const [o, k] of accUsers) {
  if (o[k] == null) continue;
  if (!accMap.has(o[k])) { accMap.set(o[k], accessors.length); accessors.push(A.accessors[o[k]]); }
  o[k] = accMap.get(o[k]);
}
A.accessors = accessors;
const viewUsers = [];
for (const a of A.accessors) {
  if ('bufferView' in a) viewUsers.push([a, 'bufferView']);
  if (a.sparse) viewUsers.push([a.sparse.indices, 'bufferView'], [a.sparse.values, 'bufferView']);
}
for (const m of A.meshes) for (const p of m.primitives) if (p.extensions?.KHR_draco_mesh_compression) viewUsers.push([p.extensions.KHR_draco_mesh_compression, 'bufferView']);
for (const im of A.images ?? []) if ('bufferView' in im) viewUsers.push([im, 'bufferView']);
const kept = [...new Set(viewUsers.map(([o, k]) => o[k]))].sort((x, y) => x - y);
const viewMap = new Map(), views = [], packed = [];
let at = 0;
for (const i of kept) {
  const v = A.bufferViews[i], bytes = full.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
  packed.push(Buffer.alloc(pad(at)));at += pad(at);
  viewMap.set(i, views.length);views.push({ ...v, byteOffset: at, _src: bytes });
  packed.push(bytes);at += bytes.length;
}
for (const [o, k] of viewUsers) o[k] = viewMap.get(o[k]);
const bin = Buffer.concat(packed);
A.bufferViews = views.map(({ _src, ...v }) => v);
A.buffers[0].byteLength = bin.length;
const json = Buffer.from(JSON.stringify(A)), j = Buffer.concat([json, Buffer.alloc(pad(json.length), 0x20)]);
const b = Buffer.concat([bin, Buffer.alloc(pad(bin.length))]);
const head = Buffer.alloc(12);head.write('glTF', 0);head.writeUInt32LE(2, 4);head.writeUInt32LE(28 + j.length + b.length, 8);
const h = (len, type) => { const x = Buffer.alloc(8);x.writeUInt32LE(len, 0);x.write(type, 4);return x; };
writeFileSync(outPath, Buffer.concat([head, h(j.length, 'JSON'), j, h(b.length, 'BIN\0'), b]));
// self-check: every kept bufferView reads back byte-identical to its source
const back = readGlb(outPath);
views.forEach((v, i) => { if (!back.bin.subarray(v.byteOffset, v.byteOffset + v.byteLength).equals(v._src)) throw new Error(`bufferView ${i} changed`); });
console.log('wrote', outPath, readFileSync(outPath).length, `views ${kept.length}, accessors ${A.accessors.length}`);
