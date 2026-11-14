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
    // T64: a team pick alone issues the ticket (no emote step).
    const issued = new Promise(resolve => events.addEventListener('ticket:issued', resolve, { once: true }));
    events.dispatchEvent(new CustomEvent('team:changed', { detail: { teamId: config('teams').teams[0].id } }));
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
      // T63b moved the seats to the entrance, 54 m from the gate: a point that far lies behind walls and the click finds no
      // floor (world:click point null). Click the floor a short way ahead on the line to the seat, like a user does.
      for (const distance of [12, 8, 5, 3]) {
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
    <canvas></canvas><div id="hud"><div id="hud-keys"></div><div id="hud-toast" role="status"></div><div id="showtime-wait"></div><div id="dock"></div></div><button id="close">닫기</button>` }));
  await page.goto('/__fix1-seat');
  await page.evaluate(async () => {
    const THREE = await import('three');
    const { createInput } = await import('/input.js'), { createPlayerController } = await import('/player-controller.js');
    const { create } = await import('/seat-mode.js');
    const { create: createHud } = await import('/ui/hud.js');
    const seats = await (await fetch('/config/seats.json')).json(), controls = await (await fetch('/config/controls.json')).json();
    const scene = new THREE.Scene(), root = new THREE.Group(), camera = new THREE.PerspectiveCamera(68, 1.6, .08, 650);
    const events = new EventTarget(), canvas = document.querySelector('canvas'), peers = [];
    const screen = { fullMode: false, faces: [[-1,0,0],[0,0,1],[1,0,0],[0,0,-1]].map((normal, i) => ({
      name: 'face-' + i, position: [normal[0] * 6, 3.1, normal[2] * 6], normal, width: 12, height: 6.75,
    })) };
    window.arena = { screen };let lockCalls = 0;canvas.requestPointerLock = () => { lockCalls++; };
    const clicks = [], walkTargets = [], flights = [];
    function worldClick(x, y) {
      const rect = canvas.getBoundingClientRect(), ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera);
      const event = new CustomEvent('world:click', { cancelable: true, detail: {
        ray: { origin: ray.ray.origin.toArray(), direction: ray.ray.direction.toArray() }, point: [5, -.44, 5],
      } });
      if (events.dispatchEvent(event)) { walkTargets.push(event.detail.point);player.walkTo(event.detail.point); }
      clicks.push(event.defaultPrevented);return event.defaultPrevented;
    }
    const input = createInput({ canvas, events, controls, isReady: () => true, onLook() {}, onJump: () => player.jump(), onClick: worldClick });
    const player = createPlayerController({ avatar: new THREE.Group(), input, getYaw: () => 0, onTeleport() {}, clickSit: seats.clickSit });
    const fly = player.flyTo;player.flyTo = (...args) => { flights.push(args);return fly(...args); };
    const cameraRig = { setOverride(fn) { this.override = fn; } };
    const floor = new THREE.Mesh(new THREE.BoxGeometry(400, .2, 400));floor.name = 'Walk_ArenaFloor';floor.position.y = -.54;root.add(floor);root.updateMatrixWorld(true);
    scene.add(root, player.avatar);player.registerWorld(root);player.teleport([-25, -.44, 0, 0]);
    const notices = [], transitions = [], poses = [];
    events.addEventListener('hud:toast', e => notices.push(e.detail));
    events.addEventListener('seat:enter', e => transitions.push(e.detail.seatId));
    const ctx = { THREE, scene, root, camera, player, input, cameraRig, events, uiRoot: document.body,
      renderer: { domElement: canvas }, multiplayer: { positions: peers }, config: name => name === 'seats' ? seats : controls };
    const instance = create(ctx);createHud(ctx);events.dispatchEvent(new CustomEvent('app:enter'));
    window.probe = { ...ctx, instance, seats, peers, notices, transitions, poses, clicks, walkTargets, flights, get lockCalls() { return lockCalls; },
      aimScreen(index) {
        const face = screen.faces[index];camera.position.fromArray(face.position).addScaledVector(new THREE.Vector3(...face.normal), 24);
        camera.lookAt(new THREE.Vector3(...face.position));camera.updateMatrixWorld(true);
      },
      screenClick(index = 0) { this.aimScreen(index);return worldClick(400, 250); },
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

for (let face = 0; face < 4; face++) test(`T94: screen face ${face} flies to the nearest free seat and sits after landing`, async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async face => {
    probe.player.walkTo([-10, -.44, 0]);probe.step(.1);
    const before = probe.player.position.toArray();
    const expected = [...probe.seats.seats].sort((a, b) => Math.hypot(...a.position.map((v, i) => v - before[i])) - Math.hypot(...b.position.map((v, i) => v - before[i])))[0];
    const consumed = probe.screenClick(face), seconds = probe.seats.clickSit.flightSeconds;
    const start = { airborne: probe.player.airborne, seat: arena.seat.seatId, position: probe.player.position.toArray() };
    probe.input.keys.add('KeyW');probe.player.jump();probe.step(seconds / 2);probe.input.keys.clear();
    const middle = { airborne: probe.player.airborne, seat: arena.seat.seatId, position: probe.player.position.toArray() };
    probe.step(seconds / 2);await Promise.resolve();probe.instance.update();probe.cameraRig.override(probe.camera);
    return { expected, before, consumed, start, middle, seat: arena.seat.seatId, position: probe.player.position.toArray(),
      airborne: probe.player.airborne, transitions: probe.transitions, walkTargets: probe.walkTargets, fov: probe.camera.fov, config: probe.seats };
  }, face);
  expect(result.consumed).toBe(true);expect(result.walkTargets).toEqual([]);
  expect(result.start).toEqual({ airborne: true, seat: null, position: result.before });
  expect(result.middle.airborne).toBe(true);expect(result.middle.seat).toBeNull();
  expect(result.middle.position[0]).toBeCloseTo((result.before[0] + result.expected.position[0]) / 2);
  expect(result.middle.position[1]).toBeCloseTo((result.before[1] + result.expected.position[1]) / 2 + result.config.clickSit.arcHeightMeters);
  expect(result.airborne).toBe(false);expect(result.seat).toBe(result.expected.id);expect(result.position).toEqual(result.expected.position);
  expect(result.transitions).toEqual([result.expected.id]);expect(result.fov).toBe(result.config.camera.fov);
});

test('T94: screen clicks skip the nearest occupied seat', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const p = probe.player.position.toArray();
    const ordered = [...probe.seats.seats].sort((a, b) => Math.hypot(...a.position.map((v, i) => v - p[i])) - Math.hypot(...b.position.map((v, i) => v - p[i])));
    probe.peers.push(ordered[0].position);probe.instance.update();
    const consumed = probe.screenClick();probe.step(probe.seats.clickSit.flightSeconds);await Promise.resolve();
    return { consumed, seat: arena.seat.seatId, expected: ordered[1].id, notices: probe.notices };
  });
  expect(result).toEqual({ consumed: true, seat: result.expected, expected: result.expected, notices: [] });
});

test('T94: a full arena consumes the screen click and briefly shows the no-seat notice without moving', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    probe.peers.push(...probe.seats.seats.map(seat => seat.position));probe.instance.update();
    const before = probe.player.position.toArray(), consumed = probe.screenClick();probe.step(1);
    return { before, consumed, position: probe.player.position.toArray(), airborne: probe.player.airborne,
      seat: arena.seat.seatId, flights: probe.flights, walkTargets: probe.walkTargets };
  });
  expect(result).toEqual({ before: result.before, consumed: true, position: result.before, airborne: false, seat: null, flights: [], walkTargets: [] });
  await expect(page.locator('#hud-toast')).toContainText('빈 좌석이 없어요');
  await expect(page.locator('#hud-toast > div')).toBeVisible();
  await expect(page.locator('#hud-toast > div')).toHaveCount(0, { timeout: 3000 });
});

test('T94: dragging over the screen never becomes a click, but a subsequent tap starts flight', async ({ page }) => {
  await fixture(page);await page.evaluate(() => probe.aimScreen(0));
  await page.mouse.move(400, 250);await page.mouse.down();await page.mouse.move(450, 250, { steps: 5 });await page.mouse.up();
  expect(await page.evaluate(() => ({ clicks: probe.clicks, flights: probe.flights, airborne: probe.player.airborne })))
    .toEqual({ clicks: [], flights: [], airborne: false });
  await page.mouse.click(400, 250);
  expect(await page.evaluate(() => probe.player.airborne)).toBe(true);
});

test('T94: screen clicks do nothing outside walking, in Full Mode, during flight or when seated', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    probe.input.releasePointer();const idle = probe.screenClick();probe.input.capturePointer();
    arena.screen.fullMode = true;const full = probe.screenClick();arena.screen.fullMode = false;
    const first = probe.screenClick(), flying = probe.screenClick(1);
    probe.step(probe.seats.clickSit.flightSeconds);await Promise.resolve();
    const before = probe.player.position.toArray(), seated = probe.screenClick(2);
    return { idle, full, first, flying, seated, flights: probe.flights.length, transitions: probe.transitions.length,
      before, after: probe.player.position.toArray(), notices: probe.notices };
  });
  expect(result).toEqual({ idle: false, full: false, first: true, flying: false, seated: false, flights: 1, transitions: 1,
    before: result.before, after: result.before, notices: [] });
});

test('T94: rays outside the screen rectangles, parallel to them or pointing away do not start flight', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const rays = [
      { origin: [-30, 3.1, 6.1], direction: [1, 0, 0] },
      { origin: [-30, 6.5, 0], direction: [1, 0, 0] },
      { origin: [-30, 3.1, 0], direction: [0, 1, 0] },
      { origin: [30, 3.1, 0], direction: [1, 0, 0] },
    ];
    const consumed = rays.map(ray => {
      probe.aimScreen(0);
      const e = new CustomEvent('world:click', { cancelable: true, detail: { ray, point: null } });probe.events.dispatchEvent(e);return e.defaultPrevented;
    });
    return { consumed, flights: probe.flights, airborne: probe.player.airborne };
  });
  expect(result).toEqual({ consumed: [false, false, false, false], flights: [], airborne: false });
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
