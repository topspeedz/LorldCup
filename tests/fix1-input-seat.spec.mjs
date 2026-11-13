import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('RW-H-2 CPU: clicking again after a counter corner stop makes progress toward the same floor target', async () => {
  const THREE = await import('../web/vendor/three.module.js');
  const source = readFileSync(new URL('../web/player-controller.js', import.meta.url), 'utf8')
    .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href));
  const { createPlayerController } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const input = { keys: new Set(), walking: true, down(action) { return this.keys.has(action); } };
  const player = createPlayerController({ avatar: new THREE.Group(), input, getYaw: () => 0, onTeleport() {} });
  const root = new THREE.Group();
  for (const [name, size, at] of [
    ['Walk_Floor', [30, .2, 30], [0, -.1, 0]],
    ['CCR_Counter', [.2, 3, 8], [2, 1.5, 0]],
    ['CCR_Refrigerator', [6, 3, .2], [1, 1.5, -2]],
  ]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));mesh.name = name;mesh.position.set(...at);root.add(mesh);
  }
  root.updateMatrixWorld(true);player.registerWorld(root);player.teleport([0, 0, 0, 0]);
  const target = new THREE.Vector3(5, 0, -5);
  player.walkTo(target.toArray());for (let i = 0; i < 240; i++) player.update(1 / 60);
  const stopped = player.position.clone();for (let i = 0; i < 60; i++) player.update(1 / 60);
  expect(player.position.distanceTo(stopped), 'first click stops at the solid counter corner').toBeLessThan(1e-6);
  expect(stopped.x).toBeLessThan(1.6);expect(stopped.z).toBeGreaterThan(-1.6);
  player.walkTo(target.toArray());
  expect(player.position.toArray(), 'planning does not teleport the live player').toEqual(stopped.toArray());
  expect(player.airborne).toBe(false);
  for (let i = 0; i < 600; i++) {
    player.update(1 / 60);
    expect(player.position.distanceTo(stopped), 'local candidates stay within the 8m radius').toBeLessThanOrEqual(8.001);
  }
  expect(player.position.distanceTo(target), 'a new click can leave the local corner and approach its destination').toBeLessThan(1);
  for (const cancel of ['key', 'lock', 'teleport']) {
    player.teleport(stopped.toArray());player.walkTo(target.toArray());player.update(1 / 60);player.walkTo(target.toArray());
    if (cancel === 'key') { input.keys.add('backward');player.update(1 / 60);input.keys.clear(); }
    if (cancel === 'lock') { player.setLocked(true);player.setLocked(false); }
    if (cancel === 'teleport') player.teleport([0, 0, 0, 0]);
    const at = player.position.clone();for (let i = 0; i < 60; i++) player.update(1 / 60);
    expect(player.position.toArray(), `${cancel} cancels all detour waypoints`).toEqual(at.toArray());
  }
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(.2, 3, 40));barrier.position.set(2, 1.5, 0);barrier.updateMatrixWorld(true);
  player.addBlocker(barrier);player.teleport([0, 0, 0, 0]);player.walkTo([5, 0, 0]);
  for (let i = 0; i < 240; i++) player.update(1 / 60);
  const blocked = player.position.clone();player.walkTo([5, 0, 0]);
  for (let i = 0; i < 240; i++) player.update(1 / 60);
  expect(player.position.toArray(), 'no local route never crosses a ticket/wall blocker').toEqual(blocked.toArray());
});

test('RW-H-2: floor clicks continue from the post-ticket entrance to the nearest entrance seat without rescue teleports', async ({ page }) => {
  test.setTimeout(300_000);await page.setViewportSize({ width: 1280, height: 720 });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const original=modules[0].create;modules[0].create=ctx=>{window.fixContext=ctx;return original(ctx);};` });
  });
  await page.goto('/');await page.waitForFunction(() => window.arena?.ready);
  await page.locator('#enter').click();
  await page.evaluate(async () => {
    const { events, player, config } = fixContext;
    const issued = new Promise(resolve => events.addEventListener('ticket:issued', resolve, { once: true }));
    events.dispatchEvent(new CustomEvent('team:changed', { detail: { teamId: config('teams').teams[0].id } }));
    events.dispatchEvent(new CustomEvent('emote:played', { detail: { id: 'cheer_clap' } }));
    await issued;player.teleport([-107, -.02, 0, -Math.PI / 2]);
    window.walkClicks = [];
    events.addEventListener('world:click', e => walkClicks.push({ point: e.detail.point, cancelled: e.defaultPrevented }));
  });
  const ticketGo = page.locator('#ticket button.go');if (await ticketGo.isVisible()) await ticketGo.click();
  const state = () => page.evaluate(() => {
    const p = arena.player, seat = fixContext.config('seats').seats[0];
    return { x: p.x, y: p.y, z: p.z, distance: Math.hypot(p.x - seat.position[0], p.z - seat.position[2]) };
  });
  for (let attempt = 0; attempt < 30 && (await state()).distance >= 9; attempt++) {
    const at = await page.evaluate(() => {
      const { player, camera, config, THREE } = fixContext, p = player.position;
      const [x, , z] = config('seats').seats[0].position, d = Math.hypot(x - p.x, z - p.z);
      for (const distance of [d, 12, 8, 5, 3]) {
        if (distance > d) continue;
        const v = new THREE.Vector3(p.x + (x - p.x) * distance / d, p.y, p.z + (z - p.z) * distance / d).project(camera);
        const sx = (v.x + 1) * innerWidth / 2, sy = (1 - v.y) * innerHeight / 2;
        if (v.z <= 1 && Math.abs(v.x) < .95 && Math.abs(v.y) < .95 && document.elementFromPoint(sx, sy)?.tagName === 'CANVAS') return [sx, sy];
      }
      return null;
    });
    if (!at) {
      await page.mouse.move(640, 300);await page.mouse.down();await page.mouse.move(860, 300, { steps: 8 });await page.mouse.up();continue;
    }
    await page.mouse.click(...at);let previous = await state();
    for (let t = 0; t < 18; t++) {
      await page.waitForTimeout(400);const next = await state();
      if (Math.hypot(next.x - previous.x, next.z - previous.z) < .02) break;
      previous = next;
    }
  }
  expect((await state()).distance).toBeLessThan(9);
  expect(await page.evaluate(() => walkClicks.some(click => click.point && !click.cancelled))).toBe(true);
  expect(await page.evaluate(() => arena.seat.seatId), 'approach by walking, before the seat flight').toBeNull();
});

test('app:ready fires once after readiness; main routes floor clicks through cancelable world:click', async ({ page }) => {
  test.setTimeout(180_000);await page.setViewportSize({ width: 1280, height: 720 });
  await page.route('**/events.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      window.fixReady={count:0,ready:false};events.addEventListener(APP_READY,()=>{fixReady.count++;fixReady.ready=arena.ready;});` });
  });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const original=modules[0].create;modules[0].create=ctx=>{window.fixContext=ctx;return original(ctx);};` });
  });
  await page.goto('/');await page.waitForFunction(() => window.arena?.ready);
  expect(await page.evaluate(() => fixReady)).toEqual({ count: 1, ready: true });
  await page.locator('#enter').click();await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
  const point = await page.evaluate(() => {
    const { THREE, player, camera } = fixContext;window.floorClicks=[];window.walkTargets=[];
    const walk = player.walkTo;player.walkTo=point=>{walkTargets.push(point);walk(point);};
    fixContext.events.addEventListener('world:click',e=>floorClicks.push({cancelable:e.cancelable,detail:e.detail}));
    const point=new THREE.Vector3(-135,player.groundAt(-135,0,0),0).project(camera);
    return [(point.x+1)*innerWidth/2,(1-point.y)*innerHeight/2];
  });
  await page.mouse.click(...point);
  await expect.poll(() => page.evaluate(() => walkTargets.length)).toBe(1);
  expect(await page.evaluate(() => floorClicks[0].cancelable)).toBe(true);
  expect(await page.evaluate(() => floorClicks[0].detail.ray.origin.length)).toBe(3);
  await page.evaluate(() => fixContext.events.addEventListener('world:click',e=>e.preventDefault(),{once:true}));
  await page.mouse.click(...point);
  expect(await page.evaluate(() => floorClicks.length)).toBe(2);expect(await page.evaluate(() => walkTargets.length)).toBe(1);
  await page.mouse.move(...point);await page.mouse.down();await page.mouse.move(point[0]+50,point[1]);await page.mouse.up();
  expect(await page.evaluate(() => floorClicks.length)).toBe(2);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
});

async function fixture(page) {
  await page.route('**/__fix1-seat', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <style>body{margin:0}canvas{width:800px;height:500px}#hud-keys{position:fixed;right:0;top:0}</style>
    <script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>
    <canvas></canvas><div id="hud-keys"></div><div id="dock"></div><button id="close">닫기</button>` }));
  await page.goto('/__fix1-seat');
  await page.evaluate(async () => {
    const THREE = await import('three');
    const { createInput } = await import('/input.js'), { createPlayerController } = await import('/player-controller.js');
    const { create } = await import('/seat-mode.js');
    const seats = await (await fetch('/config/seats.json')).json(), controls = await (await fetch('/config/controls.json')).json();
    const scene = new THREE.Scene(), root = new THREE.Group(), camera = new THREE.PerspectiveCamera(68, 1.6, .08, 650);
    const events = new EventTarget(), canvas = document.querySelector('canvas'), peers = [];
    const screen = { fullMode: false, faces: [{ position: [0, 3.1, 0], normal: [-1, 0, 0], width: 12, height: 6.75 }] };
    window.arena = { screen };let lockCalls = 0;canvas.requestPointerLock = () => { lockCalls++; };
    const input = createInput({ canvas, events, controls, isReady: () => true, onLook() {}, onJump: () => player.jump(), onClick() {} });
    const player = createPlayerController({ avatar: new THREE.Group(), input, getYaw: () => 0, onTeleport() {}, clickSit: seats.clickSit });
    const cameraRig = { setOverride(fn) { this.override = fn; } };
    const floor = new THREE.Mesh(new THREE.BoxGeometry(400, .2, 400));floor.name = 'Walk_ArenaFloor';floor.position.y = -.54;root.add(floor);root.updateMatrixWorld(true);
    scene.add(root, player.avatar);player.registerWorld(root);player.teleport([-25, -.44, 0, 0]);
    const notices = [], transitions = [], poses = [];
    events.addEventListener('hud:toast', e => notices.push(e.detail));
    events.addEventListener('seat:enter', e => transitions.push(e.detail.seatId));
    const ctx = { THREE, scene, root, camera, player, input, cameraRig, events, uiRoot: document.body,
      renderer: { domElement: canvas }, multiplayer: { positions: peers }, config: name => name === 'seats' ? seats : controls };
    const instance = create(ctx);events.dispatchEvent(new CustomEvent('app:enter'));
    window.probe = { ...ctx, instance, seats, peers, notices, transitions, poses, get lockCalls() { return lockCalls; },
      step(dt) { player.update(dt);instance.update();poses.push([...player.position.toArray(), player.avatar.rotation.y]); },
      click(index) {
        instance.update();scene.updateMatrixWorld(true);
        const marker = scene.getObjectByName('SeatMarkers').children[index];
        camera.position.copy(marker.position).z += 3;camera.lookAt(marker.position);camera.updateMatrixWorld(true);
        const target = marker.position.clone().add(new THREE.Vector3(0, .08, 0));
        const ray = { origin: camera.position.toArray(), direction: target.sub(camera.position).normalize().toArray() };
        const event = new CustomEvent('world:click', { cancelable: true, detail: { ray, point: null } });events.dispatchEvent(event);
        return event.defaultPrevented;
      } };
  });
}

test('C-R-1 / U-H-1: arrows on the Full Mode close button preserve the seat and never capture a pointer', async ({ page }) => {
  await fixture(page);
  await page.evaluate(() => { probe.player.teleport([...probe.seats.seats[0].position, 0]);probe.instance.update(); });
  await page.locator('#seat-toggle').click();
  const before = await page.evaluate(() => {
    arena.screen.fullMode = true;probe.events.dispatchEvent(new CustomEvent('fullmode:enter'));
    document.querySelector('#close').focus();return probe.player.position.toArray();
  });
  for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) await page.keyboard.press(key);
  await page.evaluate(() => probe.step(1 / 60));
  expect(await page.evaluate(() => ({ seat: arena.seat.seatId, full: arena.screen.fullMode, walking: probe.input.walking, calls: probe.lockCalls, position: probe.player.position.toArray() })))
    .toEqual({ seat: await page.evaluate(() => probe.seats.seats[0].id), full: true, walking: false, calls: 0, position: before });
});

for (const width of [1280, 390]) test(`U-H-5: a nearby seat stays clickable while walking at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });await fixture(page);
  await page.evaluate(() => { probe.player.teleport([...probe.seats.seats[0].position, 0]);probe.instance.update(); });
  expect(await page.evaluate(() => probe.input.walking)).toBe(true);
  await expect(page.locator('#seat-toggle')).toBeVisible();
  await expect(page.locator('#hud-keys > :first-child')).toHaveText('E앉기');
  await page.locator('#seat-toggle').click();
  await expect(page.locator('#seat-toggle')).toHaveText('일어나기');
  await expect(page.locator('#hud-keys > :first-child')).toHaveText('E일어나기');
});

test('U-사용자-3: every empty seat takes a parabolic flight and sits only after landing with the same pose shape', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const { validPose } = await import('/multiplayer.js');const results = [];
    for (let i = 0; i < probe.seats.seats.length; i++) {
      if (arena.seat.seatId) document.querySelector('#seat-toggle').click();
      probe.player.teleport([-25, -.44, 0, 0]);probe.input.capturePointer();
      const consumed = probe.click(i), seconds = probe.seats.clickSit.flightSeconds;
      probe.step(seconds / 2);
      const middle = { airborne: probe.player.airborne, seat: arena.seat.seatId, height: probe.player.foot };
      probe.step(seconds / 2);await Promise.resolve();probe.instance.update();
      results.push({ consumed, middle, seat: arena.seat.seatId, expected: probe.seats.seats[i].id, landed: !probe.player.airborne });
    }
    return { results, posesValid: probe.poses.every(validPose), transitions: probe.transitions.length };
  });
  expect(result.posesValid).toBe(true);expect(result.transitions).toBe(result.results.length);
  for (const row of result.results) {
    expect(row.consumed).toBe(true);expect(row.middle.airborne).toBe(true);expect(row.middle.seat).toBeNull();
    expect(row.middle.height).toBeGreaterThan(0);expect(row.landed).toBe(true);expect(row.seat).toBe(row.expected);
  }
});

test('U-사용자-3: a seat occupied during flight gives the existing failure notice after landing', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const consumed = probe.click(0);probe.peers.push(probe.seats.seats[0].position);
    probe.step(probe.seats.clickSit.flightSeconds);await Promise.resolve();probe.instance.update();
    return { consumed, seat: arena.seat.seatId, airborne: probe.player.airborne, notices: probe.notices, transitions: probe.transitions };
  });
  expect(result).toMatchObject({ consumed: true, seat: null, airborne: false, transitions: [] });
  expect(result.notices).toContainEqual({ text: '다른 사람이 먼저 앉았어요', tone: 'warning' });
});

test('U-사용자-4: double-sided stair undersides cannot become a floor or admit an airborne body through a step', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const { THREE, player, root } = probe;
    const stair = new THREE.Mesh(new THREE.BoxGeometry(2, .2, 2), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
    stair.name = 'Walk_Stair';stair.position.set(2, .2, 0);root.add(stair);root.updateMatrixWorld(true);
    player.registerWorld(new THREE.Group().add(stair));stair.updateMatrixWorld(true);
    const floor = player.groundAt(2, 0, -.5);
    player.teleport([.5, -.44, 0, 0]);player.jump();probe.step(.05);
    const moved = player.attempt(.6, 0);
    return { floor, moved, x: player.position.x };
  });
  expect(result.floor).toBeCloseTo(-.44);
  expect(result.moved).toBe(false);expect(result.x).toBe(.5);
});
