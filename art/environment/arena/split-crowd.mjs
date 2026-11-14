// Split the crowd (audience heads/torsos, fan lightsticks) out of an arena GLB without re-encoding anything:
// bufferView bytes are copied as they are, indices are remapped. Each crowd node records where it sat in the arena
// (extras.arenaParent = parent node name or null for the scene root, extras.arenaIndex = child position) so
// web/main.js can put it back and the runtime tree is the same as the unsplit file.
// Usage: node art/environment/arena/split-crowd.mjs <in.glb> <arena-out.glb> <crowd-out.glb>
import { readFileSync, writeFileSync } from 'node:fs';

export const CROWD = /^(Audience_(heads|torsos)|REF_FanLightsticks)/;

export function readGlb(path) {
  const b = readFileSync(path), jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.subarray(20, 20 + jsonLen).toString('utf8'));
  const binLen = b.readUInt32LE(20 + jsonLen);
  return { json, bin: b.subarray(28 + jsonLen, 28 + jsonLen + binLen) };
}

function writeGlb(path, json, bin) {
  const pad = (buf, byte) => Buffer.concat([buf, Buffer.alloc((4 - buf.length % 4) % 4, byte)]);
  const j = pad(Buffer.from(JSON.stringify(json)), 0x20), b = pad(bin, 0);
  const head = Buffer.alloc(12); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + j.length + 8 + b.length, 8);
  const chunk = (buf, type) => { const h = Buffer.alloc(8); h.writeUInt32LE(buf.length, 0); h.write(type, 4); return Buffer.concat([h, buf]); };
  writeFileSync(path, Buffer.concat([head, chunk(j, 'JSON'), chunk(b, 'BIN\0')]));
}

// Build a GLB holding only `roots` (node indices, with their subtrees) as scene roots.
function subset({ json: src, bin }, roots, keepChildren, wrapper = () => false) {
  const maps = {}, out = {}, take = (kind, i, make) => {
    maps[kind] ??= new Map(); out[kind] ??= [];
    if (!maps[kind].has(i)) { maps[kind].set(i, out[kind].length); out[kind].push(null); out[kind][maps[kind].get(i)] = make(structuredClone(src[kind][i])); }
    return maps[kind].get(i);
  };
  const chunks = []; let offset = 0;
  const view = i => take('bufferViews', i, v => {
    const bytes = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength);
    const start = Math.ceil(offset / 8) * 8; if (start > offset) chunks.push(Buffer.alloc(start - offset));
    chunks.push(bytes); offset = start + bytes.length; v.buffer = 0; v.byteOffset = start; return v;
  });
  const accessor = i => take('accessors', i, a => {
    if (a.bufferView != null) a.bufferView = view(a.bufferView);
    if (a.sparse) { a.sparse.indices.bufferView = view(a.sparse.indices.bufferView); a.sparse.values.bufferView = view(a.sparse.values.bufferView); }
    return a;
  });
  const image = i => take('images', i, im => { if (im.bufferView != null) im.bufferView = view(im.bufferView); return im; });
  const texture = i => take('textures', i, t => {
    if (t.sampler != null) t.sampler = take('samplers', t.sampler, s => s);
    if (t.source != null) t.source = image(t.source);
    for (const ext of Object.values(t.extensions ?? {})) if (ext.source != null) ext.source = image(ext.source);
    return t;
  });
  const remapTextures = o => { // every textureInfo ({index, texCoord…}) under a material, core or extension
    if (!o || typeof o !== 'object') return;
    for (const [k, v] of Object.entries(o)) {
      if (v && typeof v === 'object' && /Texture$/.test(k) && Number.isInteger(v.index)) v.index = texture(v.index);
      remapTextures(v);
    }
  };
  const material = i => take('materials', i, m => { remapTextures(m); return m; });
  const mesh = i => take('meshes', i, m => {
    for (const p of m.primitives) {
      for (const k of Object.keys(p.attributes)) p.attributes[k] = accessor(p.attributes[k]);
      if (p.indices != null) p.indices = accessor(p.indices);
      if (p.material != null) p.material = material(p.material);
      for (const t of p.targets ?? []) for (const k of Object.keys(t)) t[k] = accessor(t[k]);
      const draco = p.extensions?.KHR_draco_mesh_compression; if (draco) draco.bufferView = view(draco.bufferView);
    }
    return m;
  });
  const node = i => take('nodes', i, n => {
    if (wrapper(i)) { delete n.mesh; delete n.camera; n.extras = { arenaWrapper: true }; } // transform-only stand-in for an arena parent
    if (n.mesh != null) n.mesh = mesh(n.mesh);
    const kids = (n.children ?? []).filter(c => keepChildren(c));
    if (kids.length) n.children = kids.map(node); else delete n.children;
    if (n.skin != null) throw new Error(`skins not handled: ${n.name}`);
    if (n.camera != null) n.camera = take('cameras', n.camera, c => c);
    return n;
  });
  const json = { asset: src.asset, extensionsUsed: src.extensionsUsed, extensionsRequired: src.extensionsRequired, scene: 0,
    scenes: [{ ...src.scenes[0], nodes: roots.map(node) }] };
  if (src.extensions) json.extensions = src.extensions; // KHR_lights_punctual etc. stay index-stable on the arena side
  for (const kind of ['nodes', 'cameras', 'meshes', 'materials', 'textures', 'images', 'samplers', 'accessors', 'bufferViews']) if (out[kind]) json[kind] = out[kind];
  const data = Buffer.concat(chunks);
  json.buffers = [{ byteLength: data.length }];
  return { json, bin: data };
}

export function split(glb) {
  const { json } = glb, crowd = i => CROWD.test(json.nodes[i].name ?? '');
  if (json.scenes.length !== 1 || (json.animations ?? []).length || (json.skins ?? []).length) throw new Error('expects one scene, no animations or skins');
  const parent = new Map(); json.nodes.forEach((n, i) => (n.children ?? []).forEach((c, k) => parent.set(c, [i, k])));
  const rootIndex = new Map(json.scenes[0].nodes.map((n, k) => [n, k]));
  const crowdNodes = json.nodes.map((_, i) => i).filter(crowd);
  for (const i of crowdNodes) if (json.nodes[i].children?.length) throw new Error(`crowd node with children: ${json.nodes[i].name}`);
  const arena = subset(glb, json.scenes[0].nodes.filter(i => !crowd(i)), c => !crowd(c));
  // Crowd file: scene-root crowd nodes stay roots; nested ones keep their parent as a transform-only wrapper.
  const wrappers = new Map(), roots = [];
  for (const i of crowdNodes) {
    const [p, k] = parent.get(i) ?? [null, rootIndex.get(i)];
    json.nodes[i].extras = { ...json.nodes[i].extras, arenaParent: p == null ? null : json.nodes[p].name, arenaIndex: k };
    if (p == null) roots.push(i);
    else if (parent.has(p)) throw new Error(`crowd node nested two deep: ${json.nodes[i].name}`);
    else if (!wrappers.has(p)) { wrappers.set(p, true); roots.push(p); }
  }
  const crowdGlb = subset(glb, roots, c => crowd(c), i => wrappers.has(i));
  return { arena, crowd: crowdGlb };
}

if (process.argv[1] && import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const [input, arenaOut, crowdOut] = process.argv.slice(2);
  const { arena, crowd } = split(readGlb(input));
  writeGlb(arenaOut, arena.json, arena.bin); writeGlb(crowdOut, crowd.json, crowd.bin);
  console.log(`arena ${arena.json.nodes.length} nodes ${(arena.bin.length / 1e6).toFixed(1)}MB, crowd ${crowd.json.nodes.length} nodes ${(crowd.bin.length / 1e6).toFixed(1)}MB`);
}
