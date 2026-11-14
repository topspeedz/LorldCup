import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from '../web/vendor/three.module.js';
import { create } from '../web/arena-fixes.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const crowd = read('../web/config/crowd.json'), config = read('../web/config/arena-fixes.json');
const source = readFileSync(new URL('../web/player-controller.js', import.meta.url), 'utf8')
  .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href));
const { createPlayerController } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const edges = [
  { zone: 'entry', start: [-58.9, 0, 3.388], end: [-55.5, 0, 3.388] },
  { zone: 'entry', start: [-58.9, 0, -3.388], end: [-55.5, 0, -3.388] },
  { zone: 'ramp-A', start: [-3.383, 0, -51], end: [-3.383, -10, -19] },
  { zone: 'ramp-A', start: [3.383, 0, -51], end: [3.383, -10, -19] },
  { zone: 'ramp-B', start: [-3.383, 0, 51], end: [-3.383, -10, 19] },
  { zone: 'ramp-B', start: [3.383, 0, 51], end: [3.383, -10, 19] },
];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('T75 removed crowd origins have small clear zones and the original zones/density remain', () => {
  expect(hash(crowd.clearZones.slice(0, 48))).toBe('d7ff3a5ef3669f9946fe6fef12e8c815a7688764a8a9683c7dbfae7aba5fa8a0');
  expect(crowd.density.upperKeepFraction).toBe(.3333);
  const added = crowd.clearZones.slice(48);
  // T75 runtime-handoff: A 157, B 163, entry 116, stair-7 47, stair-9 47; ±(.35,.18,.35) m, like T63b.
  expect(added).toHaveLength(530);
  expect(hash(added)).toBe('ddb4b1301b1201e1282fa2a351675ad33119ba44e1dcab0b21473e7eac8c4f50');
  for (const zone of added) for (const [axis, size] of [.7, .36, .7].entries()) expect(zone.max[axis] - zone.min[axis]).toBeCloseTo(size, 5);
  for (const point of [[3.5842,-9.9,-20.75005],[-30.42366,-9.9,-4.00516],[-29.14561,-9.9,7.12397],[-2.79018,-9.9,20.81612],[-31.20495,-9.04,-7.79046]]) {
    expect(added.some(zone => point.every((v, axis) => v >= zone.min[axis] && v <= zone.max[axis]))).toBe(true);
  }
});

function fixture() {
  const root = new THREE.Group(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();scene.add(root);
  const input = { keys: new Set(), walking: true, down(action) { return this.keys.has(action); } };
  const player = createPlayerController({ avatar: new THREE.Group(), input, getYaw: () => 0, onTeleport() {} });
  return { THREE, root, scene, camera, player, input };
}

test('all six T75 edges are invisible, block crossing and jumping, and unregister on disposal', () => {
  expect(config.edgeSegments).toEqual(edges);
  const ctx = fixture();
  const instance = create({ ...ctx, config: () => ({ ...config, bridgeGaps: [], readableText: [] }) });
  const walls = ctx.player.wallMeshes.filter(mesh => mesh.name.startsWith('Collide_AisleEdge_'));
  expect(walls).toHaveLength(6);
  for (const [i, edge] of edges.entries()) {
    const wall = walls[i], a = new THREE.Vector3(...edge.start), b = new THREE.Vector3(...edge.end);
    expect(wall.visible).toBe(false);expect(wall.geometry.index.count).toBe(6);
    expect(new THREE.Vector3().fromBufferAttribute(wall.geometry.attributes.position, 0).distanceTo(a)).toBeLessThan(1e-5);
    expect(new THREE.Vector3().fromBufferAttribute(wall.geometry.attributes.position, 2).distanceTo(b.clone().add(new THREE.Vector3(0,3.2,0)))).toBeLessThan(1e-5);
    const p = a.clone().lerp(b,.5), dx = b.x-a.x, dz = b.z-a.z;
    const across = new THREE.Vector3(-dz,0,dx).normalize();
    const probe = fixture(), floor = new THREE.Mesh(new THREE.BoxGeometry(12,.2,12));
    floor.name = edge.zone === 'entry' ? 'Walk_Floor' : 'Walk_Ramp'+edge.zone.slice(-1)+'__concrete';floor.position.copy(p).add(new THREE.Vector3(0,-.1,0));probe.root.add(floor);
    probe.root.updateMatrixWorld(true);probe.player.registerWorld(probe.root);probe.player.addBlocker(wall);
    for (const sign of [-1,1]) {
      const from = p.clone().addScaledVector(across,sign);
      probe.player.teleport(from.toArray());
      expect(probe.player.attempt(-across.x*sign*2,-across.z*sign*2)).toBe(false);
      probe.player.jump();
      for (let frame=0;frame<90;frame++) {
        probe.player.attempt(-across.x*sign*.05,-across.z*sign*.05);probe.player.update(1/60);
        expect(probe.player.position.clone().sub(p).dot(across)*sign).toBeGreaterThanOrEqual(.31);
      }
    }
    probe.player.removeBlocker(wall);probe.player.teleport(p.clone().add(across).toArray());
    expect(probe.player.attempt(-across.x*2,-across.z*2)).toBe(true);
  }
  instance.dispose();expect(ctx.player.wallMeshes).toHaveLength(0);
});

test('A/B ramps allow both side lanes but retain seating limits beside and above them', () => {
  const { root, player } = fixture();
  for (const [label, sign] of [['A',-1],['B',1]]) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([-3.383,0,sign*51,3.383,0,sign*51,3.383,-10,sign*19,-3.383,-10,sign*19],3));
    geometry.setIndex(sign<0?[0,2,1,0,3,2]:[0,1,2,0,2,3]);
    const mesh = new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.name='Walk_Ramp'+label+'__concrete';root.add(mesh);
  }
  root.updateMatrixWorld(true);player.registerWorld(root);
  for (const sign of [-1,1]) for (const x of [-2,2]) {
    player.teleport([x,-.3125,sign*50]);
    for (let step=0;step<290;step++) expect(player.attempt(0,-sign*.1),`${x}, ${sign}, step ${step}`).toBe(true);
    for (let step=0;step<290;step++) expect(player.attempt(0,sign*.1)).toBe(true);
  }
  const tier = new THREE.Mesh(new THREE.BoxGeometry(12,.2,10));tier.name='Walk_Tier0__concrete';tier.position.set(0,-4.1,-35);root.add(tier);
  tier.updateMatrixWorld(true);player.registerWorld(tier);
  player.teleport([4,-4,-35]);expect(player.attempt(.1,0)).toBe(false);
  player.teleport([2,-4,-35]);expect(player.attempt(.1,0)).toBe(false);
});

test('an overlapping runway above the allowed step does not hide the reachable ramp below', () => {
  const { root, player } = fixture();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(4,.2,4));floor.name='Walk_EntryRamp__concrete';floor.position.set(-30,-10.1,0);root.add(floor);
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(4,4));runway.name='REF_RunwayTransition';runway.rotation.x=-Math.PI/2;runway.position.set(-30,-9.3,0);root.add(runway);
  root.updateMatrixWorld(true);player.registerWorld(root);player.teleport([-30,-10,0]);
  expect(player.groundAt(-30.1,0,-10)).toBeCloseTo(-10,5);
  expect(player.attempt(-.1,0)).toBe(true);
});
