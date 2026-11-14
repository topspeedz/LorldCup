// Exercise the existing movement/collision implementation against the actual Blender triangles.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from '../../../web/vendor/three.module.js';

const out = new URL('../../../temp/T75/', import.meta.url);
const data = readFileSync(new URL('navigation.bin', out));
const root = new THREE.Group();
for (const node of JSON.parse(readFileSync(new URL('navigation.json', out)))) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.buffer, data.byteOffset + node.positionOffset, node.positionCount * 3).slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(data.buffer, data.byteOffset + node.indexOffset, node.indexCount).slice(), 1));
  geometry.computeBoundingBox();
  const object = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  object.name = node.name; root.add(object);
}
root.updateMatrixWorld(true);
const source = readFileSync(new URL('../../../web/player-controller.js', import.meta.url), 'utf8')
  .replace("'three'", JSON.stringify(new URL('../../../web/vendor/three.module.js', import.meta.url).href));
const { createPlayerController } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const input = { keys: new Set(), walking: true }, player = createPlayerController({ avatar: new THREE.Group(), input, getYaw: () => 0, onTeleport() {} });
player.registerWorld(root);
const results = [];
for (const [name, sign] of [['A', -1], ['B', 1]]) {
  player.teleport([0, 0, sign * 52, 0]);
  let steps = 0;
  for (; steps < 340; steps++) if (!player.attempt(0, -sign * .1)) break;
  results.push({ name, steps, reached: player.position.toArray(), expectedSteps: 340 });
}
for (const sign of [-1, 1]) {
  player.teleport([-60, -.3125, 0, 0]);
  let clear = true;
  for (let i = 0; i < 40; i++) if (!player.attempt(0, sign * .1)) { clear = false; break; }
  for (let i = 0; i < 70 && clear; i++) if (!player.attempt(.1, 0)) { clear = false; break; }
  results.push({ name: 'entry-side-' + sign, clear, reached: player.position.toArray() });
}
writeFileSync(new URL('navigation-check.json', out), JSON.stringify(results, null, 2));
console.log('T75_NAVIGATION', JSON.stringify(results));
assert(results.every(result => result.clear === true || result.steps === result.expectedSteps), 'A route is blocked; see navigation-check.json');
const width = [];
for (const [name, sign] of [['A', -1], ['B', 1]]) for (const x of [-2, 2]) {
  player.teleport([x, 0, sign * 52, 0]);
  let steps = 0;
  for (; steps < 340; steps++) if (!player.attempt(0, -sign * .1)) break;
  width.push({ name, x, steps, expectedSteps: 340, reached: player.position.toArray() });
}
writeFileSync(new URL('navigation-width.json', out), JSON.stringify(width, null, 2));
console.log('T75_WIDTH_HANDOFF', JSON.stringify(width));
