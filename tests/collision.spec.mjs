import { test, expect } from '@playwright/test';

async function fixture(page) {
  await page.route('**/__collision-test', route => route.fulfill({ contentType: 'text/html', body:
    '<script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
  await page.goto('/__collision-test');
  await page.evaluate(async () => {
    const THREE = await import('three');
    const { createPlayerController } = await import('/player-controller.js');
    window.collision = { THREE, createPlayerController,
      box(name, size, position) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
        mesh.name = name;mesh.position.set(...position);return mesh;
      },
      player(root, pose = [0, 0, 0, 0]) {
        const input = { keys: new Set(), walking: false, down(action) { return this.keys.has(action); } };
        const player = createPlayerController({ avatar: new THREE.Group(), input, getYaw: () => 0, onTeleport() {} });
        root.updateMatrixWorld(true);player.registerWorld(root);player.teleport(pose);
        return { player, input };
      },
      world() {
        const root = new THREE.Group();
        root.add(this.box('Walk_ArenaFloor__black', [24, .2, 24], [0, -.1, 0]));
        return root;
      },
    };
  });
}

test('Walk_Tier1 cannot be climbed by stairs or repeated jumps, while ground below stays open', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const { box, player: makePlayer } = collision, root = collision.world();
    root.add(box('Walk_Concourse__concrete', [4, .2, 4], [0, 5.9, 0]));
    root.add(box('Walk_Tier1__concrete', [4, .4, 4], [4, 6.2, 0]));
    const { player } = makePlayer(root, [1, 6, 0, 0]);
    const floorNames = player.floorMeshes.map(mesh => mesh.name);
    const upperGround = player.groundAt(3, 0, 6.4), underneath = player.groundAt(3, 0, 0);
    for (let i = 0; i < 100; i++) player.attempt(.1, 0);
    const stairs = player.position.toArray();
    player.teleport([1, 6, 0, 0]);let entered = false, peak = 6;
    for (let i = 0; i < 300; i++) {
      if (!player.airborne) player.jump();
      player.attempt(.06, 0);player.update(1 / 60);
      peak = Math.max(peak, player.foot);
      entered ||= player.position.x >= 2 && player.foot >= 6.39;
    }
    return { floorNames, upperGround, underneath, stairs, entered, peak, end: player.position.toArray() };
  });
  expect(result.floorNames).not.toContain('Walk_Tier1__concrete');
  expect(result.upperGround).toBeNull();
  expect(result.underneath).toBeCloseTo(0);
  expect(result.stairs[0]).toBeLessThan(2);
  expect(result.stairs[1]).toBeCloseTo(6);
  expect(result.peak).toBeGreaterThan(6.6);
  expect(result.entered).toBe(false);
  expect(result.end[0]).toBeLessThan(2);
});

for (const [label, name, size, center] of [
  ['wall', 'Collide_Lobby__concrete', [.1, 3, 4], [2, 1.5, 0]],
  ['chair rail between the old rays', 'Player_chair__steel', [.1, .12, 1], [2, .9, 0]],
  ['low bench base', 'Plaza_bench__steel', [.1, .18, 1], [2, .09, 0]],
  ['head-height desk part', 'REF_DeskBody__black', [.1, .1, 1], [2, 1.75, 0]],
  ['object touching the side of the body', 'Bollards__steel', [.1, 3, .08], [2, 1.5, .28]],
]) {
  test(`continuous movement and a large step cannot penetrate a ${label}`, async ({ page }) => {
    await fixture(page);
    const result = await page.evaluate(({ name, size, center }) => {
      const root = collision.world();root.add(collision.box(name, size, center));
      const { player } = collision.player(root);
      for (let i = 0; i < 120; i++) player.attempt(.1, 0);
      const repeated = player.position.x;
      player.teleport([0, 0, 0, 0]);const crossed = player.attempt(4, 0);
      return { repeated, crossed, largeStep: player.position.x };
    }, { name, size, center });
    expect(result.repeated).toBeGreaterThan(1);
    expect(result.repeated + .32).toBeLessThanOrEqual(1.95 + 1e-6);
    expect(result.crossed).toBe(false);
    expect(result.largeStep + .32).toBeLessThanOrEqual(1.95 + 1e-6);
  });
}

test('jumping cannot push the side of the head through an overhang or fall through a low object', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const root = collision.world();root.add(collision.box('Collide_Overhang', [.1, .1, 2], [.25, 1.95, 0]));
    const { player } = collision.player(root);player.jump();let peak = 0;
    for (let i = 0; i < 120; i++) { player.update(1 / 60);peak = Math.max(peak, player.foot); }
    const overhang = { peak, landed: !player.airborne, foot: player.foot };
    const landingRoot = collision.world();landingRoot.add(collision.box('Plaza_bench__steel', [1, .4, 2], [1, .2, 0]));
    const { player: landing } = collision.player(landingRoot);landing.jump();
    for (let i = 0; i < 18; i++) landing.update(1 / 60);
    landing.attempt(1, 0);
    for (let i = 0; i < 90; i++) landing.update(1 / 60);
    const landed = landing.position.toArray(), airborne = landing.airborne;
    landing.jump();const jumpsFromObject = landing.airborne;
    for (let i = 0; i < 90; i++) landing.update(1 / 60);
    for (let i = 0; i < 60; i++) { landing.attempt(.06, 0);landing.update(1 / 60); }
    return { overhang, landing: landed, airborne, jumpsFromObject, exit: landing.position.toArray() };
  });
  expect(result.overhang.peak).toBeLessThanOrEqual(.051);
  expect(result.overhang.landed).toBe(true);
  expect(result.overhang.foot).toBeCloseTo(0);
  expect(result.landing[0]).toBeCloseTo(1);
  expect(result.landing[1]).toBeGreaterThanOrEqual(.4 - .001);
  expect(result.airborne).toBe(false);
  expect(result.jumpsFromObject).toBe(true);
  expect(result.exit[0]).toBeGreaterThan(2);
  expect(result.exit[1]).toBeCloseTo(0);
});

test('wall sliding, gaps in merged meshes and dynamic invisible blockers keep working', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const { THREE } = collision;
    const root = collision.world();root.add(collision.box('Collide_Lobby', [.1, 3, 20], [2, 1.5, 0]));
    const { player, input } = collision.player(root);
    input.walking = true;input.keys.add('forward');input.keys.add('right');
    for (let i = 0; i < 120; i++) player.update(1 / 60);
    const slide = player.position.toArray();
    const { mergeGeometries } = await import('/vendor/BufferGeometryUtils.js');
    const gapRoot = collision.world();
    const pieces = [-2, 2].map(z => new THREE.BoxGeometry(.1, 3, 1).translate(2, 1.5, z));
    const merged = new THREE.Mesh(mergeGeometries(pieces), new THREE.MeshBasicMaterial());
    merged.name = 'Collide_Columns';gapRoot.add(merged);
    const { player: gap } = collision.player(gapRoot);
    const gapOpen = gap.attempt(4, 0);
    gap.teleport([0, 0, 0, 0]);
    const gate = collision.box('Gate', [.1, 3, 3], [2, 1.5, 0]);
    gate.visible = false;gate.updateMatrixWorld(true);gap.addBlocker(gate);
    const blocked = !gap.attempt(4, 0);gap.removeBlocker(gate);
    const released = gap.attempt(4, 0);
    return { slide, gapOpen, blocked, released };
  });
  expect(result.slide[0]).toBeGreaterThan(1);
  expect(result.slide[0] + .32).toBeLessThanOrEqual(1.95 + 1e-6);
  expect(result.slide[2]).toBeLessThan(-4);
  expect(result).toMatchObject({ gapOpen: true, blocked: true, released: true });
});

test('click walking uses wall sliding, stops at blockers and yields to keys, locks and teleport', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const root = collision.world();root.add(collision.box('Collide_Lobby', [.1, 3, 20], [2, 1.5, 0]));
    const { player, input } = collision.player(root);input.walking = true;
    player.walkTo([4, 0, -4]);for (let i = 0; i < 240; i++) player.update(1 / 60);
    const slide = player.position.toArray();
    for (let i = 0; i < 60; i++) player.update(1 / 60);
    const stopped = player.position.distanceTo(new collision.THREE.Vector3(...slide)) < 1e-6;
    player.teleport([0, 0, 0, 0]);player.walkTo([1, 0, 0]);
    for (let i = 0; i < 120; i++) player.update(1 / 60);
    const arrival = player.position.toArray();
    player.walkTo([1, 0, -5]);input.keys.add('left');player.update(.1);input.keys.clear();
    const manual = player.position.clone();player.update(.1);const keyCancelled = manual.equals(player.position);
    player.walkTo([1, 0, -5]);player.setLocked(true);player.setLocked(false);player.update(.1);const lockCancelled = manual.equals(player.position);
    player.walkTo([1, 0, -5]);player.teleport([0, 0, 0, 0]);player.update(.1);
    return { slide, stopped, arrival, keyCancelled, lockCancelled, teleported: player.position.toArray() };
  });
  expect(result.slide[0]).toBeGreaterThan(1);expect(result.slide[0] + .32).toBeLessThanOrEqual(1.95 + 1e-6);
  expect(Math.abs(result.slide[2] + 4)).toBeLessThan(.01);expect(result.stopped).toBe(true);expect(result.arrival[0]).toBeCloseTo(1);
  expect(result.keyCancelled).toBe(true);expect(result.lockCancelled).toBe(true);expect(result.teleported).toEqual([0, 0, 0]);
});

test('the real arena excludes the upper tier, blocks lower seats, and preserves validPose and the plaza route', async ({ page }) => {
  test.setTimeout(90_000);
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const original=modules[0].create;
      modules[0].create=ctx=>{window.collisionContext=ctx;return original(ctx);};` });
  });
  const errors = [];page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');await page.waitForFunction(() => window.arena?.ready);
  const result = await page.evaluate(async () => {
    const { player, root, THREE, events, config, renderer } = collisionContext;
    const upper = [];root.traverse(mesh => { if (mesh.isMesh && mesh.name.startsWith('Walk_Tier1')) upper.push(mesh.name); });
    const { validPose } = await import('./multiplayer.js');
    const poses = [[0, 0, 0, 0], [-999.9, 999.9, 0, Math.PI], null, [0, 0, 0], [NaN, 0, 0, 0], [0, Infinity, 0, 0], [0, 0, 1000, 0], [0, 0, 0, Math.PI + .01]];
    events.dispatchEvent(new CustomEvent('team:changed', { detail: { teamId: config('teams').teams[0].id } }));
    events.dispatchEvent(new CustomEvent('emote:played', { detail: { id: 'cheer_clap' } }));
    await new Promise(resolve => setTimeout(resolve, config('ticket').cardMs + 50));
    player.teleport('plaza');let moved = 0;
    for (let i = 0; i < 460; i++) if (player.attempt(.25, 0)) moved++;
    const routeEnd = player.position.toArray();
    const angle = Math.PI / 16;
    const x = 30 * Math.cos(angle), z = -20 * Math.sin(angle), y = player.groundAt(x, z, -9.9);
    player.teleport([x, y, z, 0]);
    for (let i = 0; i < 120; i++) player.attempt(.1 * Math.cos(angle), -.1 * Math.sin(angle));
    const seats = player.position.x ** 2 / 31 ** 2 + player.position.z ** 2 / 21 ** 2;
    const body = new THREE.Box3(
      new THREE.Vector3(player.position.x - .32, player.foot + .001, player.position.z - .32),
      new THREE.Vector3(player.position.x + .32, player.foot + 1.85, player.position.z + .32));
    const triangle = new THREE.Triangle();let seatIntersections = 0;
    root.traverse(mesh => {
      if (!mesh.isMesh || !/^Seats__|^Seat_armrests__/.test(mesh.name)) return;
      const { index, attributes: { position } } = mesh.geometry;
      for (let i = 0; i < (index?.count ?? position.count); i += 3) {
        triangle.a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
        triangle.b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
        triangle.c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
        if (body.intersectsTriangle(triangle)) seatIntersections++;
      }
    });
    const triangles = player.wallMeshes.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    return { upper, walkableUpper: player.floorMeshes.filter(mesh => mesh.name.startsWith('Walk_Tier1')).length,
      valid: poses.map(validPose), moved, routeEnd, seats, seatIntersections, seatFloor: y, triangles,
      metrics: { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, ...renderer.info.memory } };
  });
  console.log('T17 arena checks:', result);
  expect(result.upper.length).toBeGreaterThan(0);
  expect(result.walkableUpper).toBe(0);
  expect(result.valid).toEqual([true, true, false, false, false, false, false, false]);
  expect(result.moved).toBe(460);
  expect(result.routeEnd[0]).toBeCloseTo(-24);
  expect(result.seatFloor).not.toBeNull();
  expect(result.seats).toBeLessThanOrEqual(1);
  expect(result.seatIntersections).toBe(0);
  expect(errors).toEqual([]);
});
