import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as THREE from '../web/vendor/three.module.js';
import { create } from '../web/arena-fixes.js';
import { create as createSeatMode } from '../web/seat-mode.js';
import { createInput } from '../web/input.js';
const controller = readFileSync(new URL('../web/player-controller.js', import.meta.url), 'utf8')
  .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href));
const { createPlayerController } = await import('data:text/javascript;base64,' + Buffer.from(controller).toString('base64'));

const config = JSON.parse(readFileSync(new URL('../web/config/arena-fixes.json', import.meta.url), 'utf8'));
const seats = JSON.parse(readFileSync(new URL('../web/config/seats.json', import.meta.url), 'utf8')).seats;
const playerFor = root => {
  const player = createPlayerController({ avatar: new THREE.Group(), input: { keys: new Set() }, getYaw: () => 0, onTeleport() {} });
  root.updateMatrixWorld(true);player.registerWorld(root);return player;
};

test('entry gap panels join the bridge to the concourse at floor height', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), camera = new THREE.PerspectiveCamera();scene.add(root);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4, .2, 6.766179), new THREE.MeshStandardMaterial());
  bridge.name = 'Walk_EntryBridge__concrete';bridge.position.set(-63, -.1, .0053705);root.add(bridge);
  for (const name of config.readableText) { const text = new THREE.Mesh(new THREE.BoxGeometry(2, .016, 1));text.name = name;root.add(text); }
  const player = playerFor(root), originalFloors = player.floorMeshes.length;
  const instance = create({ THREE, root, scene, camera, player, config: () => config });
  expect(config.bridgeGaps).toHaveLength(2);
  for (const name of config.readableText) expect(name).toBe(THREE.PropertyBinding.sanitizeNodeName(name));
  for (const side of [-1, 1]) for (const [x, z] of [[-64.9, 5.9], [-63, 5.6], [-61.1, 5.5]]) {
    const ground = player.groundAt(x, side * z, 0);
    expect(ground, `gap ${x},${side * z}`).toBeCloseTo(0, 3);
    player.teleport([x, ground, side * z, 0]);expect(player.attempt(.08, 0)).toBe(true);
  }
  expect(player.floorMeshes).toHaveLength(originalFloors + 2);
  instance.dispose();expect(player.floorMeshes).toHaveLength(originalFloors);
  expect(root.getObjectByName(config.readableText[0]).visible).toBe(true);
});

test('back-face text remains readable from either side without shifting the label', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(), camera = new THREE.PerspectiveCamera();scene.add(root);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(4, .2, 6.766179));bridge.name = 'Walk_EntryBridge__concrete';root.add(bridge);
  const text = new THREE.Mesh(new THREE.BoxGeometry(2, .016, 1).translate(.4, 0, 0));text.name = 'Welcome';text.position.x = 20;root.add(text);
  const player = playerFor(root);camera.position.set(20, 5, 0);
  const instance = create({ THREE, root, scene, camera, player, config: () => ({ ...config, bridgeGaps: [], readableText: ['Welcome'] }) });
  const readable = scene.getObjectByName('Readable_Welcome'), before = new THREE.Box3().setFromObject(readable).getCenter(new THREE.Vector3());
  expect(readable.scale.x).toBe(1);
  camera.position.y = -5;instance.update();
  expect(readable.scale.x).toBe(-1);
  expect(new THREE.Box3().setFromObject(readable).getCenter(new THREE.Vector3()).distanceTo(before)).toBeLessThan(1e-6);
  camera.position.y = 5;instance.update();expect(readable.scale.x).toBe(1);
  instance.dispose();expect(text.visible).toBe(true);
});

const stageBoundary = { center: [0, .0053705], radius: 16.06, y: [-10.1, 0] };
function stageFixture() {
  const scene = new THREE.Scene(), root = new THREE.Group(), camera = new THREE.PerspectiveCamera();scene.add(root);
  const floor = new THREE.Mesh(new THREE.BoxGeometry(64, .2, 64));floor.name = 'Walk_Floor';floor.position.y = -10.1;root.add(floor);
  const input = { keys: new Set(), walking: true, down(action) { return this.keys.has(action); } };
  const player = createPlayerController({ avatar: new THREE.Group(), input, getYaw: () => 0, onTeleport() {} });
  root.updateMatrixWorld(true);player.registerWorld(root);
  const instance = create({ THREE, root, scene, camera, player, config: () => ({ bridgeGaps: [], readableText: [], stageBoundary }) });
  return { scene, player, input, instance };
}

test('stage boundary config encloses the light rim and retains the entrance fixes', () => {
  expect(config.stageBoundary).toEqual(stageBoundary);
  expect(config.stageBoundary.center.every(Number.isFinite)).toBe(true);
  expect(config.stageBoundary.y.every(Number.isFinite)).toBe(true);
  expect(config.stageBoundary.y[0]).toBeLessThan(-10);
  expect(config.stageBoundary.y[1]).toBeGreaterThan(-8.9 + 6.5 ** 2 / 36 + 1.85);
  expect(config.bridgeGaps).toEqual([
    { x: [-65, -61], zMin: [-6.11155, -5.7975], zMax: [-3.377719, -3.377719] },
    { x: [-65, -61], zMin: [3.38846, 3.38846], zMax: [6.122291, 5.80824] },
  ]);
  expect(config.readableText).toEqual(['Section_number007', 'Section_number008', 'Entry_sign', 'Welcome']);
});

test('invisible stage perimeter blocks all approaches and jumping but leaves the runway open', () => {
  const { scene, player, input, instance } = stageFixture(), { radius, center } = stageBoundary;
  for (let i = 0; i < 192; i++) {
    const angle = (i + .5) * Math.PI * 2 / 192, x = Math.cos(angle), z = Math.sin(angle);
    player.teleport([center[0] + x * (radius + .6), -10, center[1] + z * (radius + .6)]);
    expect(player.attempt(-2 * x, -2 * z), `perimeter segment ${i}`).toBe(false);
  }
  for (const [action, x, z] of [['right', -1, 0], ['left', 1, 0], ['backward', 0, -1], ['forward', 0, 1]]) {
    player.teleport([center[0] + x * (radius + 2), -10, center[1] + z * (radius + 2)]);
    input.keys.add(action);input.keys.add('run');player.jump();
    for (let i = 0; i < 120; i++) player.update(1 / 60);
    expect(Math.hypot(player.position.x - center[0], player.position.z - center[1])).toBeGreaterThan(radius + .32);
    expect(player.airborne).toBe(false);
  }
  player.teleport([-25, -10, center[1]]);expect(player.attempt(6, 0), 'runway before the circle stays open').toBe(true);
  const wall = scene.getObjectByName('Collide_StageBoundary');expect(wall.visible).toBe(false);
  expect(player.wallMeshes).toContain(wall);expect(player.floorMeshes).not.toContain(wall);
  let geometryDisposed = false, materialDisposed = false;
  wall.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  wall.material.addEventListener('dispose', () => { materialDisposed = true; });
  instance.dispose();expect(player.wallMeshes).not.toContain(wall);expect(scene.getObjectByName(wall.name)).toBeUndefined();
  expect(geometryDisposed && materialDisposed).toBe(true);
  player.teleport([-19, -10, center[1]]);expect(player.attempt(6, 0), 'dispose removes collision').toBe(true);
});

test('stage floor click targets clamp to the nearest outside point, including the centre', () => {
  const { player, instance } = stageFixture(), { radius, center } = stageBoundary;
  for (let i = 0; i < 16; i++) for (const clickedRadius of [0, 8, radius - .01]) {
    const angle = i * Math.PI / 8, x = Math.cos(angle), z = Math.sin(angle);
    player.teleport([center[0] + 24 * x, -10, center[1] + 24 * z]);
    const target = [center[0] + clickedRadius * x, -9.1, center[1] + clickedRadius * z], original = [...target];
    player.walkTo(target);for (let frame = 0; frame < 240; frame++) player.update(1 / 60);
    const clearance = radius + .32 * (Math.abs(x) + Math.abs(z)) + .02;
    expect(player.position.x).toBeCloseTo(center[0] + clearance * x, 6);
    expect(player.position.z).toBeCloseTo(center[1] + clearance * z, 6);
    expect(player.position.y).toBeCloseTo(-10, 6);expect(target).toEqual(original);
    const stopped = player.position.clone();player.walkTo(target);for (let frame = 0; frame < 30; frame++) player.update(1 / 60);
    expect(player.position.distanceTo(stopped), 'repeat clicks remain outside').toBeLessThan(1e-6);
  }
  player.teleport([-25, -10, center[1]]);player.walkTo([-20, -10, center[1]]);
  for (let frame = 0; frame < 120; frame++) player.update(1 / 60);
  expect(player.position.x, 'outside target unchanged').toBeCloseTo(-20, 6);instance.dispose();
});

test('all six stand positions clear the chair and allow immediate aisle movement', () => {
  for (const seat of seats) {
    const [x, y, z] = seat.position, root = new THREE.Group();
    const radius = 31 + (y + 9.9) / .43 * 1.08, end = -(radius - .02) * Math.cos(Math.PI / 32);
    expect(seat.standPosition[0], `${seat.id} body stays inside T68 tread`).toBeLessThanOrEqual(end - .32);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(4, .2, 4));floor.name = 'Walk_Floor';floor.position.set(x, y - .1, z);root.add(floor);
    const chair = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.2, 1));chair.name = 'Seats__fixture';chair.position.set(x, y + .6, z);root.add(chair);
    const player = playerFor(root);
    player.teleport([...seat.position, 0]);expect(player.attempt(.1, 0), 'old flight landing is inside the chair').toBe(false);
    expect(seat.standPosition, seat.id).toHaveLength(3);
    expect(Math.sign(seat.standPosition[2])).toBe(Math.sign(z));
    expect(Math.abs(seat.standPosition[2])).toBeLessThan(Math.abs(z));
    for (const [dx, dz] of [[.1, 0], [-.1, 0], [0, .1], [0, -.1]]) {
      player.teleport([...seat.standPosition, 0]);expect(player.attempt(dx, dz), seat.id).toBe(true);
    }
  }
});

test('SEAT-H-1: E, Escape and button restore input and use the nearest clear aisle', () => {
  const controls = JSON.parse(readFileSync(new URL('../web/config/controls.json', import.meta.url), 'utf8'));
  const originals = Object.fromEntries(['document', 'window', 'HTMLElement', 'getComputedStyle', 'matchMedia'].map(key => [key, globalThis[key]]));
  class Element extends EventTarget {
    style = {};classList = { toggle() {} };lastChild = {};hidden = false;
    setAttribute() {} append() {} prepend() {} remove() {} matches() { return false; }
    getContext() { return Object.fromEntries(['beginPath', 'roundRect', 'fill', 'stroke', 'moveTo', 'lineTo', 'fillText'].map(name => [name, () => {}])); }
  }
  const key = (document, type, code) => document.dispatchEvent(Object.assign(new Event(type), { code }));
  try {
    globalThis.HTMLElement = Element;globalThis.getComputedStyle = () => ({ getPropertyValue: () => '' });globalThis.matchMedia = () => ({ matches: false });
    for (const obstructed of [false, true]) for (const [index, seat] of seats.entries()) for (const method of ['KeyE', 'Escape', 'button']) {
      const elements = [], document = new EventTarget(), window = new EventTarget(), canvas = new Element();
      document.body = new Element();document.createElement = () => { const element = new Element();elements.push(element);return element; };
      document.querySelector = selector => elements.find(element => '#' + element.id === selector) ?? null;
      document.querySelectorAll = () => [];
      globalThis.document = document;globalThis.window = window;
      window.arena = { screen: { fullMode: false, faces: [{ position: [0, 3.1, 0], normal: [-1, 0, 0], width: 12, height: 6.75 }] } };
      const events = new EventTarget();let clickTarget;
      const input = createInput({ canvas, events, controls, isReady: () => true, onLook() {}, onJump() {}, onClick: () => player.walkTo(clickTarget) });
      const root = new THREE.Group(), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();scene.add(root);
      const [x, y, z] = seat.position, floor = new THREE.Mesh(new THREE.BoxGeometry(8, .2, 8));
      floor.name = 'Walk_Floor';floor.position.set(x, y - .1, z);root.add(floor);
      const chair = new THREE.Mesh(new THREE.BoxGeometry(.8, 1.2, 1));chair.name = 'Seats__fixture';chair.position.set(x, y + .6, z);root.add(chair);
      if (obstructed) {
        const obstacle = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.2, .7));obstacle.name = 'Collide_aisle';
        obstacle.position.fromArray(seat.standPosition).y += .6;root.add(obstacle);
      }
      root.updateMatrixWorld(true);
      const player = createPlayerController({ avatar: new THREE.Group(), input, getYaw: () => 0, onTeleport() {} });player.registerWorld(root);
      const instance = createSeatMode({ THREE, root, scene, camera, player, input, events, uiRoot: document.body, renderer: { domElement: canvas },
        cameraRig: { setOverride() {} }, multiplayer: { positions: [] }, config: name => name === 'seats' ? { seats, camera: { eyeHeight: 3.54 }, interactionDistance: 1.8 } : controls });
      events.dispatchEvent(new Event('app:enter'));player.teleport([...seat.position, 0]);
      key(document, 'keydown', 'KeyE');key(document, 'keyup', 'KeyE');expect(window.arena.seat.seatId).toBe(seat.id);expect(input.walking).toBe(false);
      if (method === 'button') document.querySelector('#seat-toggle').dispatchEvent(new Event('click'));
      else { key(document, 'keydown', method);key(document, 'keyup', method); }
      expect(window.arena.seat.seatId, `${seat.id} ${method} blocked=${obstructed}`).toBeNull();expect(input.walking).toBe(true);
      const stood = player.position.toArray(), fallback = seats[[1, 2, 1, 4, 5, 4][index]].standPosition;
      expect(stood[0]).toBeCloseTo((obstructed ? fallback : seat.standPosition)[0], 5);
      expect(stood[2]).toBeCloseTo(seat.standPosition[2], 5);
      for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
        player.teleport([...stood, 0]);key(document, 'keydown', code);player.update(.025);key(document, 'keyup', code);
        expect(player.position.distanceTo(new THREE.Vector3(...stood)), `${method} ${code}`).toBeGreaterThan(.09);
      }
      player.teleport([...stood, 0]);clickTarget = [stood[0] + .15, stood[1], stood[2]];
      canvas.dispatchEvent(Object.assign(new Event('pointerdown'), { button: 0, pointerId: 1, clientX: 0, clientY: 0 }));
      document.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1, clientX: 0, clientY: 0 }));player.update(.04);
      expect(player.position.x - stood[0], `${method} floor click`).toBeGreaterThan(.14);
      instance.dispose();input.dispose();
    }
  } finally { for (const [key, value] of Object.entries(originals)) if (value === undefined) delete globalThis[key];else globalThis[key] = value; }
});
