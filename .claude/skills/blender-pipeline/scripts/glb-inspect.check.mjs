// glb-inspect.check.mjs — glb-inspect.mjs의 셀프테스트. `node .claude/skills/blender-pipeline/scripts/glb-inspect.check.mjs`
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize, inspect, overBudget, parseGlb } from './glb-inspect.mjs';

const pad4 = (b, fill) => Buffer.concat([b, Buffer.alloc((4 - (b.length % 4)) % 4, fill)]);
function makeGlb(json, bin = Buffer.alloc(0)) {
  const j = pad4(Buffer.from(JSON.stringify(json)), 0x20);
  const b = pad4(bin, 0);
  const parts = [Buffer.alloc(12), Buffer.alloc(8), j];
  parts[1].writeUInt32LE(j.length, 0);
  parts[1].writeUInt32LE(0x4e4f534a, 4);
  if (b.length) {
    const bh = Buffer.alloc(8);
    bh.writeUInt32LE(b.length, 0);
    bh.writeUInt32LE(0x004e4942, 4);
    parts.push(bh, b);
  }
  parts[0].writeUInt32LE(0x46546c67, 0);
  parts[0].writeUInt32LE(2, 4);
  parts[0].writeUInt32LE(parts.reduce((s, p) => s + p.length, 0), 8);
  return Buffer.concat(parts);
}
function png(w, h) {
  const b = Buffer.alloc(24);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12, 'latin1');
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
}

let passed = 0;
const test = (name, fn) => { try { fn(); passed++; } catch (e) { console.log(`❌ ${name}: ${e.message}`); process.exitCode = 1; } };

const image = png(64, 32);
const sample = {
  asset: { version: '2.0', generator: 'check' },
  nodes: [{ mesh: 0 }, { mesh: 0 }, { name: 'empty' }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }, { attributes: { POSITION: 2 } }] }],
  accessors: [{ count: 4 }, { count: 6 }, { count: 9 }, { count: 2, max: [1.5] }, { count: 5 }],
  materials: [{ name: 'body' }, {}],
  textures: [{ source: 0 }],
  images: [{ mimeType: 'image/png', bufferView: 0, name: 'base' }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: image.length }],
  buffers: [{ byteLength: image.length }],
  skins: [{ joints: [0, 1, 2] }, { joints: [0] }],
  animations: [{ name: 'Idle', channels: [{}], samplers: [{ input: 3 }] }],
  extensionsUsed: ['KHR_texture_transform'],
};
const glb = makeGlb(sample, image);

test('parseGlb: JSON과 BIN을 나눈다', () => {
  const { json, bin } = parseGlb(glb);
  assert.equal(json.asset.generator, 'check');
  assert.equal(bin.readUInt32BE(0), 0x89504e47);
});
test('삼각형과 드로 콜은 노드마다 센다', () => {
  const r = inspect(glb);
  assert.equal(r.triangles, 10); // (6/3 + 9/3) × 노드 2개
  assert.equal(r.draws, 4);
  assert.equal(r.vertices, 26);
  assert.equal(r.meshes, 1);
});
test('재질, 텍스처, 이미지 크기', () => {
  const r = inspect(glb);
  assert.equal(r.materials, 2);
  assert.equal(r.textures, 1);
  assert.deepEqual([r.images[0].width, r.images[0].height, r.maxTexturePx], [64, 32, 64]);
});
test('스킨 관절 최대값과 애니메이션 길이', () => {
  const r = inspect(glb);
  assert.equal(r.maxJoints, 3);
  assert.deepEqual(r.animations, [{ name: 'Idle', seconds: 1.5, channels: 1 }]);
});
test('노드와 재질 이름을 모은다(이름 없는 것은 뺀다)', () => {
  const r = inspect(glb);
  assert.deepEqual(r.nodeNames, ['empty']);
  assert.deepEqual(r.materialNames, ['body']);
});
test('스트립 모드는 n-2, 점은 0', () => {
  const g = { asset: { version: '2.0' }, meshes: [{ primitives: [{ attributes: { POSITION: 0 }, mode: 5 }, { attributes: { POSITION: 0 }, mode: 0 }] }], accessors: [{ count: 5 }] };
  assert.equal(inspect(makeGlb(g)).triangles, 3);
});
test('노드가 메시를 가리키지 않으면 메시 합으로 센다', () => {
  const g = { asset: { version: '2.0' }, meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ count: 3 }] };
  assert.deepEqual([inspect(makeGlb(g)).triangles, inspect(makeGlb(g)).draws], [1, 1]);
});
test('overBudget: 넘는 항목만 돌려준다', () => {
  const r = inspect(glb);
  assert.deepEqual(overBudget(r, { 'max-tris': 10, 'max-draws': 4 }), []);
  assert.equal(overBudget(r, { 'max-tris': 9, 'max-texture-px': 32 }).length, 2);
});
test('GLB가 아니면 던진다', () => {
  assert.throws(() => inspect(Buffer.from('not a glb file at all....')), /GLB가 아님/);
});
test('imageSize: JPEG', () => {
  const b = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x01, 0x00, 0x02, 0x00, 0x03, 0x01, 0x22, 0x00]);
  assert.deepEqual(imageSize(b), { w: 512, h: 256 });
});
test('imageSize: WebP(VP8X)와 KTX2', () => {
  const webp = Buffer.alloc(30);
  webp.write('RIFF', 0, 'latin1'); webp.write('WEBP', 8, 'latin1'); webp.write('VP8X', 12, 'latin1');
  webp.writeUIntLE(1023, 24, 3); webp.writeUIntLE(511, 27, 3);
  assert.deepEqual(imageSize(webp), { w: 1024, h: 512 });
  const ktx = Buffer.alloc(28);
  ktx.writeUInt32BE(0xab4b5458, 0); ktx.writeUInt32BE(0x203230bb, 4); ktx.writeUInt32LE(2048, 20); ktx.writeUInt32LE(1024, 24);
  assert.deepEqual(imageSize(ktx), { w: 2048, h: 1024, ktx2: true });
});
test('CLI: 예산을 넘으면 코드 1, 안 넘으면 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'glb-inspect-'));
  try {
    const file = join(dir, 'sample.glb');
    writeFileSync(file, glb);
    const script = join(dirname(fileURLToPath(import.meta.url)), 'glb-inspect.mjs');
    const over = spawnSync(process.execPath, [script, file, '--max-tris', '9'], { encoding: 'utf8' });
    assert.equal(over.status, 1);
    assert.match(over.stdout, /예산 초과: triangles 10 > 9/);
    const ok = spawnSync(process.execPath, [script, file, '--max-tris', '10', '--json'], { encoding: 'utf8' });
    assert.equal(ok.status, 0);
    assert.equal(JSON.parse(ok.stdout)[0].triangles, 10);
    const named = spawnSync(process.execPath, [script, file, '--names'], { encoding: 'utf8' });
    assert.match(named.stdout, /노드: empty/);
    assert.match(named.stdout, /재질: body/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

if (!process.exitCode) console.log(`glb-inspect.check: ${passed} passed`);
