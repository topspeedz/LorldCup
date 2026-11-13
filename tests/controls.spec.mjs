import { test, expect } from '@playwright/test';

async function fixture(page, cameraConfig = {}) {
  await page.route('**/__controls-test', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <style>body{margin:0}canvas{display:block;width:800px;height:500px}</style>
    <script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>
    <canvas style="cursor:crosshair"></canvas><button id="enter">Enter</button><input id="field">` }));
  await page.goto('/__controls-test');
  await page.evaluate(async cameraConfig => {
    const THREE = await import('three');
    const { createInput } = await import('/input.js');
    const { createCameraRig } = await import('/camera-rig.js');
    const { create: createEmoteMenu } = await import('/ui/emote-menu.js');
    const config = { ...await (await fetch('/config/camera.json')).json(), ...cameraConfig };
    const controls = await (await fetch('/config/controls.json')).json();
    const canvas = document.querySelector('canvas');
    const camera = new THREE.PerspectiveCamera(68, 1.6, .08, 650);
    const player = { position: new THREE.Vector3(), avatar: new THREE.Group(), wallMeshes: [], floorMeshes: [] };
    const rig = createCameraRig({ camera, player, config });
    const events = new EventTarget(), clicks = [];
    const input = createInput({ canvas, events, controls, isReady: () => true,
      onLook: (x, y) => rig.rotate(x, y), onJump() {}, onClick: (x, y) => clicks.push([x, y]) });
    document.querySelector('#enter').addEventListener('click', () => events.dispatchEvent(new CustomEvent('app:enter')));
    createEmoteMenu({ events, input, uiRoot: document.body, config: () => controls });
    window.controlsProbe = { THREE, camera, player, rig, input, canvas, clicks, events,
      sample() {
        rig.update(1 / 60);
        return { distance: camera.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 1.45, 0))),
          position: camera.position.toArray(), direction: camera.getWorldDirection(new THREE.Vector3()).toArray(),
          visible: player.avatar.visible };
      },
      wheel(deltaY, target = canvas, extra = {}) {
        const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true, ...extra });
        target.dispatchEvent(event);
        return { ...this.sample(), prevented: event.defaultPrevented };
      },
    };
  }, cameraConfig);
}

for (const button of ['left', 'right']) {
  test(`${button} drag keeps the cursor visible and only the left button turns the view`, async ({ page }) => {
    await fixture(page);
    await page.locator('#enter').click();
    const canvas = page.locator('canvas');
    const initial = await page.evaluate(() => controlsProbe.rig.yaw);
    await expect(canvas).toHaveCSS('cursor', 'crosshair');
    await page.mouse.move(300, 250);
    await page.mouse.down({ button });
    await page.mouse.move(350, 270);
    await expect(canvas).toHaveCSS('cursor', 'crosshair');
    expect(await page.evaluate(initial => controlsProbe.rig.yaw !== initial, initial)).toBe(button === 'left');
    await page.mouse.move(850, 550);
    await page.mouse.up({ button });
    await expect(canvas).toHaveCSS('cursor', 'crosshair');
    expect(await page.evaluate(() => document.pointerLockElement === null)).toBe(true);
    expect(await page.evaluate(() => controlsProbe.input.walking)).toBe(true);
    const released = await page.evaluate(() => controlsProbe.rig.yaw);
    await page.mouse.move(360, 260);
    expect(await page.evaluate(() => controlsProbe.rig.yaw)).toBe(released);
  });
}

test('a click emits a world position request while a drag does not', async ({ page }) => {
    await fixture(page);
    await page.locator('#enter').click();
    await page.mouse.move(300, 250);await page.mouse.down();
    const yaw = await page.evaluate(() => controlsProbe.rig.yaw);
    await page.mouse.move(350, 270);
    await expect(page.locator('canvas')).toHaveCSS('cursor', 'crosshair');
    expect(await page.evaluate(() => controlsProbe.rig.yaw)).not.toBe(yaw);
    await page.mouse.up();
    expect(await page.evaluate(() => controlsProbe.clicks)).toEqual([]);
    const released = await page.evaluate(() => controlsProbe.rig.yaw);
    await page.mouse.click(360, 260);
    expect(await page.evaluate(() => controlsProbe.clicks)).toEqual([[360, 260]]);
    expect(await page.evaluate(() => controlsProbe.rig.yaw)).toBe(released);
});

test('U-H-11: synthetic pointerdown without an active pointer preserves clicks, walking and held run keys', async ({ page }) => {
  const errors = [];page.on('pageerror', e => errors.push(e.message));
  await fixture(page);await page.locator('#enter').click();
  for (const key of ['ShiftLeft', 'KeyW', 'KeyD']) await page.keyboard.down(key);
  const result = await page.evaluate(() => {
    for (const pointer of [{}, { pointerId: 7, isPrimary: true }]) {
      controlsProbe.canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 300, clientY: 250, ...pointer }));
      document.dispatchEvent(new PointerEvent('pointerup', { button: 0, clientX: 300, clientY: 250, ...pointer }));
    }
    return { walking: controlsProbe.input.walking, held: ['run', 'forward', 'right'].map(a => controlsProbe.input.down(a)), clicks: controlsProbe.clicks };
  });
  expect(result).toEqual({ walking: true, held: [true, true, true], clicks: [[300, 250], [300, 250]] });
  for (const key of ['ShiftLeft', 'KeyW', 'KeyD']) await page.keyboard.up(key);
  expect(errors).toEqual([]);
});

test('hover, Escape and R preserve walking, held keys and view', async ({ page }) => {
  await fixture(page);
  await page.locator('#enter').click();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  const yaw = await page.evaluate(() => controlsProbe.rig.yaw);
  await page.keyboard.down('KeyW');
  await page.mouse.move(300, 250);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.locator('canvas')).toHaveCSS('cursor', 'crosshair');
  expect(await page.evaluate(() => ({ walking: controlsProbe.input.walking, forward: controlsProbe.input.down('forward'), yaw: controlsProbe.rig.yaw })))
    .toEqual({ walking: true, forward: true, yaw });
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyR');
  expect(await page.evaluate(() => controlsProbe.input.walking && controlsProbe.input.down('forward'))).toBe(true);
  await page.keyboard.up('KeyW');
});

test('clicking while running diagonally keeps the held run and direction keys', async ({ page }) => {
  await fixture(page);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => controlsProbe.input.walking)).toBe(true);
  for (const key of ['ShiftLeft', 'KeyW', 'KeyD']) await page.keyboard.down(key);
  await page.mouse.click(400, 250);
  expect(await page.evaluate(() => ['run', 'forward', 'right'].map(a => controlsProbe.input.down(a)))).toEqual([true, true, true]);
  for (const key of ['ShiftLeft', 'KeyW', 'KeyD']) await page.keyboard.up(key);
});

test('cursor recovers on a button-free move when pointerup did not reach the input listener', async ({ page }) => {
  await fixture(page);
  await page.locator('#enter').click();
  await page.mouse.move(300, 250);
  await page.mouse.down();
  await expect(page.locator('canvas')).toHaveCSS('cursor', 'crosshair');
  await page.evaluate(() => document.addEventListener('pointerup', e => e.stopImmediatePropagation(), { capture: true, once: true }));
  await page.mouse.up();
  const yaw = await page.evaluate(() => controlsProbe.rig.yaw);
  await page.mouse.move(350, 270);
  await expect(page.locator('canvas')).toHaveCSS('cursor', 'crosshair');
  expect(await page.evaluate(() => controlsProbe.rig.yaw)).toBe(yaw);
});

test('emote menu suspends movement and restores it without pointer lock', async ({ page }) => {
  await fixture(page);
  await page.locator('#enter').click();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.keyboard.press('Alt');
  const menu = page.getByRole('dialog', { name: '감정표현' });
  await expect(menu).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.locator('canvas')).toHaveCSS('cursor', 'crosshair');
  expect(await page.evaluate(() => controlsProbe.input.walking)).toBe(false);
  await menu.getByRole('button', { name: '화내기' }).click();
  await expect(menu).toBeHidden();
  await expect.poll(() => page.evaluate(() => controlsProbe.input.walking)).toBe(true);
  await page.mouse.move(300, 250);
  await expect.poll(() => page.evaluate(() => document.pointerLockElement === null)).toBe(true);
  await expect(page.locator('canvas')).toHaveCSS('cursor', 'crosshair');
  await page.keyboard.down('KeyW');
  expect(await page.evaluate(() => controlsProbe.input.walking && controlsProbe.input.down('forward'))).toBe(true);
  await page.keyboard.up('KeyW');
});

test('arena cursor after emote return and drag release has no native pointer lock', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready, null, { timeout: 150_000 });
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  await page.keyboard.press('Alt');
  await page.getByRole('dialog', { name: '감정표현' }).getByRole('button', { name: '화내기' }).click();
  await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
  await page.mouse.down();
  await page.mouse.move(640, 400);
  await page.mouse.up();
  await page.mouse.move(650, 410);
  // Native cursors are omitted by browser screenshots; display the actual lock and CSS state as evidence.
  const state = await page.evaluate(async () => {
    arena.go('plaza');
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const state = { locked: !!document.pointerLockElement, cursor: getComputedStyle(document.querySelector('canvas')).cursor,
      walking: arena.state.walking, camera: arena.camera.position.toArray(), direction: arena.camera.quaternion.toArray() };
    const evidence = document.createElement('pre');
    evidence.textContent = `T63 | mouse buttons: 0 | native pointer lock: ${state.locked} | CSS cursor: ${state.cursor} | walking: ${state.walking}`;
    evidence.style.cssText = 'position:fixed;left:12px;bottom:100px;z-index:9999;background:#fff;color:#000;padding:12px;font:14px monospace;pointer-events:none';
    document.body.append(evidence);
    return state;
  });
  console.log('T63 cursor evidence', JSON.stringify(state));
  await page.screenshot({ path: `_workspace/_run/2026-11-12-requirements-build/screens/T63-emote-drag-release-${process.env.T63_SCREENSHOT_PHASE || 'after'}.png` });
  expect(state.cursor).not.toBe('none');
  expect(state.walking).toBe(true);
  expect(state.locked).toBe(false);
});

test('cancel, focus loss, pointer release and disposal restore the previous cursor and stop dragging', async ({ page }) => {
  await fixture(page);
  await page.locator('#enter').click();
  const result = await page.evaluate(() => {
    const { canvas, input, rig } = controlsProbe;
    canvas.setPointerCapture = () => {};
    const stops = [
      () => canvas.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true })),
      () => window.dispatchEvent(new Event('blur')),
      () => input.releasePointer(),
      () => canvas.dispatchEvent(new Event('lostpointercapture')),
      () => input.dispose(),
    ];
    return stops.map(stop => {
      input.capturePointer();
      canvas.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }));
      const hidden = getComputedStyle(canvas).cursor;
      const yaw = rig.yaw;
      stop();
      document.dispatchEvent(new PointerEvent('pointermove', { movementX: 50 }));
      return { hidden, restored: getComputedStyle(canvas).cursor, stopped: rig.yaw === yaw };
    });
  });
  expect(result).toEqual(Array(5).fill({ hidden: 'crosshair', restored: 'crosshair', stopped: true }));
});

test('only app:enter enables input; sub-threshold jitter clicks without rotating', async ({ page }) => {
  await fixture(page);
  await page.mouse.click(300, 250);await page.keyboard.press('KeyW');
  expect(await page.evaluate(() => ({ walking: controlsProbe.input.walking, clicks: controlsProbe.clicks }))).toEqual({ walking: false, clicks: [] });
  await page.locator('#enter').click();const yaw = await page.evaluate(() => controlsProbe.rig.yaw);
  await page.mouse.move(300, 250);await page.mouse.down();await page.mouse.move(302, 251);await page.mouse.up();
  expect(await page.evaluate(() => controlsProbe.rig.yaw)).toBe(yaw);
  expect(await page.evaluate(() => controlsProbe.clicks)).toEqual([[302, 251]]);
});

test('the 3D canvas cancels its context menu and leaves UI context menus alone', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => [controlsProbe.canvas, document.querySelector('#field')].map(target => {
    const event = new MouseEvent('contextmenu', { button: 2, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }));
  expect(result).toEqual([true, false]);
});

test('wheel zoom starts at 5 m, steps 0.5 m and stops at first person and 7.5 m', async ({ page }) => {
  await fixture(page);
  await page.mouse.move(300, 250);
  await page.mouse.wheel(0, -100);
  await expect.poll(() => page.evaluate(() => controlsProbe.sample().distance)).toBeCloseTo(4.5);
  await page.mouse.wheel(0, 100);
  await expect.poll(() => page.evaluate(() => controlsProbe.sample().distance)).toBeCloseTo(5);
  const result = await page.evaluate(() => {
    const p = controlsProbe;
    p.rig.rotate(220, 90);
    const initial = p.sample(), closer = p.wheel(-100), back = p.wheel(100);
    for (let i = 0; i < 30; i++) p.wheel(-100);
    const near = p.sample();
    p.rig.rotate(100, -50);
    const turnedNear = p.sample();
    const leavingNear = p.wheel(100);
    for (let i = 0; i < 30; i++) p.wheel(100);
    const far = p.sample(), leavingFar = p.wheel(-100);
    return { initial, closer, back, near, turnedNear, leavingNear, far, leavingFar };
  });
  expect(result.initial.distance).toBeCloseTo(5);
  expect(result.closer.distance).toBeCloseTo(4.5);
  expect(result.closer.prevented).toBe(true);
  expect(result.back.distance).toBeCloseTo(5);
  expect(result.near.distance).toBeCloseTo(0);
  expect(result.near.position).toEqual([0, 1.45, 0]);
  expect(result.near.visible).toBe(false);
  result.near.direction.forEach((value, i) => expect(value).toBeCloseTo(result.initial.direction[i]));
  expect(result.turnedNear.direction).not.toEqual(result.near.direction);
  result.turnedNear.direction.forEach((value, i) => expect(value).toBeCloseTo(result.leavingNear.direction[i]));
  expect(result.leavingNear.distance).toBeCloseTo(.5);
  expect(result.far.distance).toBeCloseTo(7.5);
  expect(result.far.visible).toBe(true);
  expect(result.leavingFar.distance).toBeCloseTo(7);
});

test('zoom uses camera config and ignores UI, horizontal and browser-zoom wheel input', async ({ page }) => {
  await fixture(page, { distance: 3, maxDistance: 4, minDistance: 0, wheelStep: .25 });
  const result = await page.evaluate(() => {
    const p = controlsProbe, initial = p.sample();
    const ignored = [p.wheel(100, document.querySelector('#field')), p.wheel(0, p.canvas, { deltaX: 100 }),
      p.wheel(-100, p.canvas, { ctrlKey: true })];
    const pixel = p.wheel(-100), line = p.wheel(-3, p.canvas, { deltaMode: 1 });
    for (let i = 0; i < 30; i++) p.wheel(100);
    return { initial, ignored, pixel, line, far: p.sample() };
  });
  expect(result.initial.distance).toBeCloseTo(3);
  for (const value of result.ignored) {
    expect(value.distance).toBeCloseTo(3);
    expect(value.prevented).toBe(false);
  }
  expect(result.pixel.distance).toBeCloseTo(2.75);
  expect(result.line.distance).toBeCloseTo(2.5);
  expect(result.far.distance).toBeCloseTo(4);
});

test('zoom keeps collision clearance and restores the requested distance after an obstruction', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const p = controlsProbe;
    p.rig.reset(0);
    const wall = new p.THREE.Mesh(new p.THREE.BoxGeometry(10, 10, .2), new p.THREE.MeshBasicMaterial());
    wall.position.set(0, 1.45, 2);wall.updateMatrixWorld(true);p.player.wallMeshes.push(wall);
    const blocked = p.sample();
    for (let i = 0; i < 10; i++) p.wheel(100);
    const blockedFar = p.sample();
    for (let i = 0; i < 20; i++) p.wheel(-100);
    const near = p.sample();
    for (let i = 0; i < 20; i++) p.wheel(100);
    p.player.wallMeshes.length = 0;
    wall.geometry.dispose();wall.material.dispose();
    return { blocked, blockedFar, near, clear: p.sample() };
  });
  expect(result.blocked.distance).toBeGreaterThan(0);
  expect(result.blocked.distance).toBeLessThan(2);
  expect(result.blockedFar.distance).toBeCloseTo(result.blocked.distance);
  expect(result.near.distance).toBeCloseTo(0);
  expect(result.clear.distance).toBeCloseTo(7.5);
});

test('camera overrides retain their view and wheel listeners stop on page disposal', async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(() => {
    const p = controlsProbe;
    p.wheel(-100);
    p.rig.setOverride(camera => { camera.position.set(10, 20, 30);camera.fov = 45;camera.updateProjectionMatrix(); });
    const overridden = p.wheel(100);
    p.rig.setOverride(null);
    const restored = p.sample(), fov = p.camera.fov;
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
    const cached = p.wheel(-100);
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    const disposed = p.wheel(-100);
    return { overridden, restored, fov, cached, disposed };
  });
  expect(result.overridden.position).toEqual([10, 20, 30]);
  expect(result.overridden.prevented).toBe(false);
  expect(result.restored.distance).toBeCloseTo(4.5);
  expect(result.fov).toBe(68);
  expect(result.cached.distance).toBeCloseTo(4);
  expect(result.disposed.distance).toBeCloseTo(4);
  expect(result.disposed.prevented).toBe(false);
});
