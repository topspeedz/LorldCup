// glb-inspect.mjs — GLB의 수치를 센다. 의존성 없음. 예산을 주면 넘는 항목을 찍고 코드 1로 끝난다.
//   node .claude/skills/blender-pipeline/scripts/glb-inspect.mjs <a.glb> [b.glb ...] [--json] [--names]
//     [--max-tris N] [--max-draws N] [--max-materials N] [--max-textures N] [--max-texture-px N]
//     [--max-texmem-mb N] [--max-joints N] [--max-kb N]
// --names는 노드와 재질 이름을 찍는다(코드가 이름으로 찾는 것이 규약과 맞는지 볼 때).
// 삼각형과 드로 콜은 메시를 가리키는 노드마다 센다(같은 메시를 두 노드가 쓰면 두 번).
// shortcut: 텍스처 GPU 메모리는 추정이다(RGBA8 + 밉 4/3, KTX2는 픽셀당 1바이트로 가정). 실측이 필요하면 브라우저에서 잰다.
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export function parseGlb(buf) {
  if (buf.length < 20 || buf.readUInt32LE(0) !== GLB_MAGIC) throw new Error('GLB가 아님(매직 불일치)');
  if (buf.readUInt32LE(4) !== 2) throw new Error(`glTF 버전 ${buf.readUInt32LE(4)}은 지원하지 않음`);
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(body.toString('utf8'));
    else if (type === CHUNK_BIN && !bin) bin = body;
    off += 8 + len;
  }
  if (!json) throw new Error('JSON 청크가 없음');
  return { json, bin };
}

// 이미지 헤더만 읽어 가로·세로를 얻는다. 모르는 형식은 null.
export function imageSize(b) {
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; // PNG
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) { // JPEG: SOF 마커를 찾는다
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }
  if (b.length >= 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const fmt = b.toString('latin1', 12, 16);
    if (fmt === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (fmt === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (fmt === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >>> 14) & 0x3fff) }; }
    return null;
  }
  if (b.length >= 28 && b.readUInt32BE(0) === 0xab4b5458 && b.readUInt32BE(4) === 0x203230bb) return { w: b.readUInt32LE(20), h: b.readUInt32LE(24), ktx2: true };
  return null;
}

export function inspect(buf) {
  const { json: g, bin } = parseGlb(buf);
  const acc = g.accessors ?? [];
  const primTris = (p) => {
    const n = p.indices !== undefined ? (acc[p.indices]?.count ?? 0) : (acc[p.attributes?.POSITION]?.count ?? 0);
    const mode = p.mode ?? 4;
    if (mode === 4) return Math.floor(n / 3);
    if (mode === 5 || mode === 6) return Math.max(0, n - 2);
    return 0; // 점과 선
  };
  const meshes = (g.meshes ?? []).map((m) => ({
    prims: m.primitives.length,
    tris: m.primitives.reduce((s, p) => s + primTris(p), 0),
    verts: m.primitives.reduce((s, p) => s + (acc[p.attributes?.POSITION]?.count ?? 0), 0),
  }));
  const used = (g.nodes ?? []).filter((n) => n.mesh !== undefined && meshes[n.mesh]).map((n) => meshes[n.mesh]);
  const drawn = used.length ? used : meshes; // 노드가 가리키지 않는 파일은 메시 합으로 센다
  const sum = (k) => drawn.reduce((s, m) => s + m[k], 0);

  const images = (g.images ?? []).map((im, index) => {
    let bytes = null;
    let size = null;
    if (im.bufferView !== undefined && bin) {
      const bv = g.bufferViews[im.bufferView];
      const start = bv.byteOffset ?? 0;
      bytes = bv.byteLength;
      size = imageSize(bin.subarray(start, start + bv.byteLength));
    }
    const external = im.uri && !im.uri.startsWith('data:') ? im.uri : null;
    return { index, name: im.name ?? null, mime: im.mimeType ?? null, uri: external, bytes, width: size?.w ?? null, height: size?.h ?? null, ktx2: !!size?.ktx2 };
  });
  const texBytes = images.reduce((s, im) => s + (im.width ? im.width * im.height * (im.ktx2 ? 1 : 4) * (4 / 3) : 0), 0);

  const animations = (g.animations ?? []).map((a, i) => ({
    name: a.name ?? `(이름 없음 ${i})`,
    seconds: Number(Math.max(0, ...a.samplers.map((s) => acc[s.input]?.max?.[0] ?? 0)).toFixed(3)),
    channels: a.channels.length,
  }));

  return {
    bytes: buf.length,
    kb: Number((buf.length / 1024).toFixed(1)),
    generator: g.asset?.generator ?? null,
    nodes: (g.nodes ?? []).length,
    meshes: meshes.length,
    draws: sum('prims'),
    triangles: sum('tris'),
    vertices: sum('verts'),
    materials: (g.materials ?? []).length,
    textures: (g.textures ?? []).length,
    images,
    maxTexturePx: Math.max(0, ...images.map((im) => Math.max(im.width ?? 0, im.height ?? 0))),
    textureMemoryMB: Number((texBytes / 1048576).toFixed(1)),
    skins: (g.skins ?? []).length,
    maxJoints: Math.max(0, ...(g.skins ?? []).map((s) => s.joints.length)),
    animations,
    nodeNames: (g.nodes ?? []).map((n) => n.name).filter(Boolean),
    materialNames: (g.materials ?? []).map((m) => m.name).filter(Boolean),
    extensionsUsed: g.extensionsUsed ?? [],
  };
}

export const LIMITS = {
  'max-tris': 'triangles',
  'max-draws': 'draws',
  'max-materials': 'materials',
  'max-textures': 'textures',
  'max-texture-px': 'maxTexturePx',
  'max-texmem-mb': 'textureMemoryMB',
  'max-joints': 'maxJoints',
  'max-kb': 'kb',
};

export function overBudget(result, limits) {
  return Object.entries(limits)
    .filter(([flag, max]) => result[LIMITS[flag]] > max)
    .map(([flag, max]) => `${LIMITS[flag]} ${result[LIMITS[flag]]} > ${max} (--${flag})`);
}

function format(file, r, over, hasLimits, names) {
  const n = (x) => x.toLocaleString('en-US');
  const lines = [
    file,
    `  크기 ${n(r.kb)} KB · 생성기 ${r.generator ?? '(없음)'}`,
    `  삼각형 ${n(r.triangles)} · 정점 ${n(r.vertices)} · 드로 콜(프리미티브) ${r.draws} · 메시 ${r.meshes} · 재질 ${r.materials}`,
    `  텍스처 ${r.textures} · 이미지 ${r.images.length} (최대 변 ${r.maxTexturePx}px, GPU 메모리 추정 ${r.textureMemoryMB} MB)`,
    ...r.images.map((im) => `    [${im.index}] ${im.name ?? im.uri ?? '(이름 없음)'} ${im.mime ?? ''} ${im.width ? `${im.width}x${im.height}` : '크기 모름'}${im.bytes ? ` ${n(Number((im.bytes / 1024).toFixed(1)))} KB` : ''}`),
    `  스킨 ${r.skins} (최대 관절 ${r.maxJoints}) · 애니메이션 ${r.animations.length}${r.animations.length ? `: ${r.animations.map((a) => `${a.name} ${a.seconds}s`).join(', ')}` : ''}`,
    `  확장: ${r.extensionsUsed.length ? r.extensionsUsed.join(', ') : '(없음)'}`,
  ];
  if (names) lines.push(`  노드: ${r.nodeNames.join(', ') || '(없음)'}`, `  재질: ${r.materialNames.join(', ') || '(없음)'}`);
  if (hasLimits) lines.push(over.length ? `  예산 초과: ${over.join(' · ')}` : '  예산: OK');
  return lines.join('\n');
}

function main(argv) {
  const files = [];
  const limits = {};
  let json = false;
  let names = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') json = true;
    else if (a === '--names') names = true;
    else if (a.startsWith('--')) {
      const flag = a.slice(2);
      const value = Number(argv[++i]);
      if (!(flag in LIMITS) || !Number.isFinite(value)) { console.error(`glb-inspect: 모르는 옵션이거나 값이 숫자가 아님: ${a}`); return 1; }
      limits[flag] = value;
    } else files.push(a);
  }
  if (!files.length) { console.error('사용법: glb-inspect.mjs <a.glb> [b.glb ...] [--json] [--names] [--max-tris N] [--max-draws N] [--max-materials N] [--max-textures N] [--max-texture-px N] [--max-texmem-mb N] [--max-joints N] [--max-kb N]'); return 1; }
  let code = 0;
  const out = [];
  for (const file of files) {
    try {
      const r = inspect(readFileSync(file));
      const over = overBudget(r, limits);
      if (over.length) code = 1;
      if (json) out.push({ file, ...r, overBudget: over });
      else console.log(format(file, r, over, Object.keys(limits).length > 0, names));
    } catch (e) {
      code = 1;
      if (json) out.push({ file, error: e.message });
      else console.log(`${file}\n  오류: ${e.message}`);
    }
  }
  if (json) console.log(JSON.stringify(out, null, 2));
  return code;
}

// realpath on both sides: run through a junction or symlink, main must still run
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) process.exitCode = main(process.argv.slice(2));
