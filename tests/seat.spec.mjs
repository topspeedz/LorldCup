import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../web/config/seats.json', import.meta.url), 'utf8'));
const screenConfig = JSON.parse(readFileSync(new URL('../web/config/screen.json', import.meta.url), 'utf8'));
const roundStart = Date.parse('2026-11-13T04:10:00Z');
const shots = 'temp/T71/size-seat-captures/';
test.setTimeout(90_000);

async function openArena(page) {
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const entry=modules.find(m=>m.path==='seat-mode.js'),original=entry.create;
      entry.create=ctx=>{
        window.seatProbe={ctx,events:[],locked:false};
        const lock=ctx.player.setLocked;
        ctx.player.setLocked=value=>{seatProbe.locked=value;lock(value);};
        const override=ctx.cameraRig.setOverride;
        ctx.cameraRig.setOverride=fn=>{seatProbe.cameraOverride=fn;override(fn);};
        for(const type of ['seat:enter','seat:exit'])ctx.events.addEventListener(type,e=>seatProbe.events.push({type,detail:e.detail}));
        const instance=original(ctx);seatProbe.instance=instance;return instance;
      };` });
  });
  // Start after the invited showtime, with the clock installed before the render/audio loops.
  await page.clock.setSystemTime(roundStart + 1000);
  await page.goto(`/?b=final&t=${roundStart}`);
  await page.waitForFunction(() => window.arena?.ready && window.arena.character?.ready);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
}

async function showCursor(page) {
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
}

async function useOldSeatCamera(page, seat) {
  await page.evaluate(seat => {
    const { THREE, root, cameraRig, player } = seatProbe.ctx, bounds = new THREE.Box3();
    for (let i = 0; i < 4; i++) bounds.union(new THREE.Box3().setFromObject(root.getObjectByName('REF_Jumbotron_' + i)));
    const target = bounds.getCenter(new THREE.Vector3());
    seatProbe.restoreCamera = seatProbe.cameraOverride;
    cameraRig.setOverride(camera => { camera.position.fromArray(seat.position).y += 1.4;camera.lookAt(target);camera.fov = 36;camera.zoom = 1;camera.updateProjectionMatrix();player.avatar.visible = false; });
  }, seat);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('seat settings provide surveyed seats and the approved seated camera', () => {
  expect(config.camera).toMatchObject({ height: 'eye', target: 'screen', fov: 50, eyeHeight: 3.54, screenFill: .85 });
  expect(config.seats.length).toBeGreaterThan(0);
  expect(new Set(config.seats.map(seat => seat.id)).size).toBe(config.seats.length);
  for (const seat of config.seats) {
    expect(seat.position).toHaveLength(3);
    expect(seat.position.every(Number.isFinite)).toBe(true);
  }
});

test('T63 seats occupy both sides of the entrance', () => {
  expect(config.seats.length).toBe(16);
  expect(new Set(config.seats.map(seat => Math.sign(seat.position[2]))).size).toBe(2);
  for (const seat of config.seats) {
    expect(Math.hypot(seat.position[0] + 61, seat.position[2]), seat.id).toBeLessThan(18);
    expect(seat.position[1], seat.id).toBeLessThan(-.8);
  }
});

test('T64 empty-seat markers render from the entrance view and highlight the nearby seat', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openArena(page);
  await page.evaluate(() => { arena.screen.pause();arena.crowd.seek(0);arena.crowd.setPaused(true);arena.go([-64, 0, 0, -Math.PI / 2]); });
  await page.waitForTimeout(1000);
  const phase = process.env.T64_CAPTURE_PHASE || 'after';
  await page.screenshot({ path: shots + `T64-default-${phase}.png` });
  const visiblePixels = await page.evaluate(() => {
    const { scene, renderer, camera } = seatProbe.ctx, markers = scene.getObjectByName('SeatMarkers');
    if (!markers) return 0;
    const gl = renderer.getContext(), { width, height } = renderer.domElement;
    const shown = new Uint8Array(width * height * 4), hidden = new Uint8Array(shown.length);
    renderer.render(scene, camera);gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, shown);
    markers.visible = false;
    renderer.render(scene, camera);gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, hidden);
    markers.visible = true;renderer.render(scene, camera);
    let changed = 0;
    for (let i = 0; i < shown.length; i += 4) if (Math.abs(shown[i] - hidden[i]) + Math.abs(shown[i + 1] - hidden[i + 1]) + Math.abs(shown[i + 2] - hidden[i + 2]) > 30) changed++;
    return changed;
  });
  await page.evaluate(seat => {
    const { player } = seatProbe.ctx, [x, y, z] = seat.position;
    const approach = [...seat.standPosition, Math.atan2(-x, -z)];
    approach[1] = player.groundAt(approach[0], approach[2], y);
    player.teleport(approach);
  }, config.seats[0]);
  await expect(page.getByRole('button', { name: '앉기', exact: true })).toBeVisible();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: shots + `T64-near-${phase}.png` });
  console.log('T64 default marker pixels:', visiblePixels);
  console.log('T64 near camera:', await page.evaluate(() => ({ position: arena.camera.position.toArray(), quaternion: arena.camera.quaternion.toArray(), fov: arena.camera.fov, ...arena.state })));
  expect(visiblePixels).toBeGreaterThan(100);
  const markers = await page.evaluate(() => seatProbe.ctx.scene.getObjectByName('SeatMarkers').children.map(marker => ({ id: marker.name, visible: marker.visible, scale: marker.scale.x })));
  expect(markers).toHaveLength(config.seats.length);
  expect(markers.find(marker => marker.id === config.seats[0].id).scale).toBeGreaterThan(markers.find(marker => marker.id === config.seats.at(-1).id).scale);
  const occupiedHidden = await page.evaluate(seat => {
    const { multiplayer, scene } = seatProbe.ctx, descriptor = Object.getOwnPropertyDescriptor(multiplayer, 'positions');
    try {
      Object.defineProperty(multiplayer, 'positions', { configurable: true, get: () => [seat.position] });
      seatProbe.instance.update();
      return !scene.getObjectByName('SeatMarkers').getObjectByName(seat.id).visible;
    } finally { Object.defineProperty(multiplayer, 'positions', descriptor); }
  }, config.seats[0]);
  expect(occupiedHidden).toBe(true);
  await page.evaluate(() => seatProbe.instance.dispose());
  expect(await page.evaluate(() => !!seatProbe.ctx.scene.getObjectByName('SeatMarkers'))).toBe(false);
});

test('T64 every seat sits with a visible 200px official player at both viewport sizes', async ({ page }) => {
  test.setTimeout(240_000);
  await openArena(page);
  const sizes = [];
  for (const seat of config.seats) {
    await page.evaluate(seat => seatProbe.ctx.player.teleport([...seat.position, 0]), seat);
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seat.id);
    await expect.poll(() => page.evaluate(() => arena.camera.fov)).toBe(config.camera.fov);
    expect(await page.evaluate(() => seatProbe.ctx.scene.getObjectByName('SeatMarkers').children.some(marker => marker.visible))).toBe(false);
    for (const [width, height] of [[1280, 720], [960, 640]]) {
      await page.setViewportSize({ width, height });
      await expect.poll(() => page.evaluate(() => arena.camera.aspect)).toBeCloseTo(width / height);
      await expect.poll(() => page.locator('#arena-screen-player').evaluate(el => el.getBoundingClientRect().height), { message: `${seat.id} at ${width}x${height}` }).toBeGreaterThanOrEqual(200);
      const rect = await page.locator('#arena-screen-player').evaluate(el => el.getBoundingClientRect().toJSON());
      expect(rect.width, seat.id).toBeGreaterThanOrEqual(200);
      expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(width);expect(rect.bottom).toBeLessThanOrEqual(height);
      await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 45_000, message: `${seat.id} at ${width}x${height}: ${rect.width}x${rect.height}` }).toBe(true);
      await expect(page.locator('#arena-screen-player iframe')).toBeVisible();
      sizes.push({ seat: seat.id, viewport: [width, height], player: [rect.width, rect.height] });
      console.log('T64 seat size:', JSON.stringify(sizes.at(-1)));
    }
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBeNull();
  }
});

test('T68 every seated view enlarges the actual screen without clipping at both viewport sizes', async ({ page }) => {
  test.setTimeout(240_000);
  const captureSeats = [config.seats[0], config.seats.find(seat => seat.position[2] > 0)];
  // Reproduce T64's unmodified GLB faces; production keeps T67's enlarged faces.
  await page.route('**/screen-mesh.js', route => route.fulfill({ contentType: 'application/javascript', body: `
    export function createScreenMesh({root}) {
      const meshes=[0,1,2,3].map(i=>root.getObjectByName('REF_Jumbotron_'+i));
      for(const mesh of meshes)mesh.userData.screenFace=mesh.name;
      return {meshes,dispose(){}};
    }` }));
  await page.setViewportSize({ width: 1280, height: 720 });
  await openArena(page);
  await page.evaluate(() => { arena.crowd.seek(0);arena.crowd.setPaused(true); });
  for (const seat of captureSeats) {
    await page.evaluate(seat => seatProbe.ctx.player.teleport([...seat.position, 0]), seat);
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seat.id);
    await useOldSeatCamera(page, seat);
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 45_000 }).toBe(true);
    await page.screenshot({ path: shots + `T68-${seat.id}-before.png` });
    await page.keyboard.press('KeyE');
  }
  await page.unroute('**/screen-mesh.js');
  await page.reload();
  await page.waitForFunction(() => window.arena?.ready && window.arena.character?.ready);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
  await page.evaluate(() => { arena.crowd.seek(0);arena.crowd.setPaused(true); });
  const measurements = [];
  for (const seat of config.seats) {
    await page.evaluate(seat => seatProbe.ctx.player.teleport([...seat.position, 0]), seat);
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seat.id);
    for (const [width, height] of [[1280, 720], [960, 640]]) {
      await page.setViewportSize({ width, height });
      await expect.poll(() => page.evaluate(() => arena.camera.aspect)).toBeCloseTo(width / height);
      await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 45_000 }).toBe(true);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const measured = await page.evaluate(({ seat, width, height }) => {
        const { THREE, root, camera } = seatProbe.ctx;
        const oldBounds = new THREE.Box3();
        for (let i = 0; i < 4; i++) oldBounds.union(new THREE.Box3().setFromObject(root.getObjectByName('REF_Jumbotron_' + i)));
        const before = camera.clone();before.fov = 36;before.zoom = 1;
        before.position.fromArray(seat.position).y += 1.4;
        before.lookAt(oldBounds.getCenter(new THREE.Vector3()));before.updateProjectionMatrix();before.updateMatrixWorld(true);
        const originalFaces = [0,1,2,3].map(i => {
          const mesh = root.getObjectByName('REF_Jumbotron_' + i), bounds = new THREE.Box3().setFromObject(mesh);
          const size = bounds.getSize(new THREE.Vector3()), position = bounds.getCenter(new THREE.Vector3());
          const normal = new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal, 0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
          if (normal.dot(position.clone().sub(oldBounds.getCenter(new THREE.Vector3()))) < 0) normal.negate();
          const height = Math.min(size.y, Math.hypot(size.x, size.z) * 9 / 16);
          return { name: mesh.name, position: position.addScaledVector(normal, .015).toArray(), normal: normal.toArray(), width: height * 16 / 9, height };
        });
        const measure = (view, screens) => {
          const faces = screens.map(face => ({ ...face, position: new THREE.Vector3(...face.position), normal: new THREE.Vector3(...face.normal) }));
          faces.sort((a, b) => view.position.clone().sub(b.position).normalize().dot(b.normal) - view.position.clone().sub(a.position).normalize().dot(a.normal));
          const face = faces[0], right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), face.normal).normalize();
          const up = new THREE.Vector3().crossVectors(face.normal, right).normalize();
          const points = [[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y]) => face.position.clone().addScaledVector(right, x * face.width / 2).addScaledVector(up, y * face.height / 2).project(view));
          const xs = points.map(p => (p.x + 1) * width / 2), ys = points.map(p => (1 - p.y) * height / 2);
          let maxAlpha = 0;
          if (view === camera) {
            const { renderer, scene } = seatProbe.ctx, gl = renderer.getContext(), pixel = new Uint8Array(4), canvas = renderer.domElement;
            renderer.render(scene, camera);
            for (let row = -2; row <= 2; row++) for (let column = -2; column <= 2; column++) {
              const p = face.position.clone().addScaledVector(right, column * .18 * face.width).addScaledVector(up, row * .18 * face.height).project(camera);
              gl.readPixels(Math.floor((p.x + 1) * canvas.width / 2), Math.floor((p.y + 1) * canvas.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
              maxAlpha = Math.max(maxAlpha, pixel[3]);
            }
          }
          return { face: face.name, left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys), height: Math.max(...ys) - Math.min(...ys), minDepth: Math.min(...points.map(p => p.z)), maxDepth: Math.max(...points.map(p => p.z)), distance: view.position.distanceTo(face.position), camera: view.position.toArray(), fov: view.fov, maxAlpha };
        };
        camera.updateMatrixWorld(true);
        return { seat: seat.id, viewport: [width, height], before: measure(before, originalFaces), t67Only: measure(before, arena.screen.faces), after: measure(camera, arena.screen.faces) };
      }, { seat, width, height });
      console.log('T68 seated screen:', JSON.stringify(measured));
      measurements.push(measured);
      expect.soft(measured.after.height, `${seat.id} ${width}: larger than T64`).toBeGreaterThan(measured.before.height);
      expect.soft(measured.after.distance, `${seat.id} ${width}: 35 m horizontal viewing distance`).toBeCloseTo(Math.hypot(35, screenConfig.mesh.centerY - Math.max(config.camera.minEyeY, seat.position[1] + config.camera.eyeHeight)), 2);
      expect.soft(measured.after.height, `${seat.id} ${width}: minimum player`).toBeGreaterThanOrEqual(200);
      expect.soft(measured.after.left, `${seat.id} ${width}: left`).toBeGreaterThanOrEqual(0);
      expect.soft(measured.after.top, `${seat.id} ${width}: top`).toBeGreaterThanOrEqual(0);
      expect.soft(measured.after.right, `${seat.id} ${width}: right`).toBeLessThanOrEqual(width);
      expect.soft(measured.after.bottom, `${seat.id} ${width}: bottom`).toBeLessThanOrEqual(height);
      expect.soft(measured.after.minDepth).toBeGreaterThan(-1);expect.soft(measured.after.maxDepth).toBeLessThan(1);
      expect.soft(measured.after.maxAlpha, `${seat.id} ${width}: WebGL does not cover player`).toBeLessThanOrEqual(5);
      await expect(page.getByRole('button', { name: /일어나기$/ })).toBeVisible(); // T67: "E / Esc 일어나기" on the bar
      if (width === 1280 && captureSeats.some(capture => capture.id === seat.id)) {
        await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 45_000 }).toBe(true);
        await page.screenshot({ path: shots + `T68-${seat.id}-after.png` });
        await useOldSeatCamera(page, seat);
        await page.screenshot({ path: shots + `T68-${seat.id}-t67-only-before.png` });
        await page.evaluate(() => seatProbe.ctx.cameraRig.setOverride(seatProbe.restoreCamera));
      }
    }
    await page.keyboard.press('KeyE');
    await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBeNull();
  }
  writeFileSync(shots + 'T68-measurements.json', JSON.stringify(measurements, null, 2));
});

test('configured seats are empty entrance cushions with a walkable approach', async ({ page }) => {
  await openArena(page);
  const survey = await page.evaluate(() => {
    const { THREE, root, player, config } = seatProbe.ctx;
    const occupants = arena.crowd.lod.chunks.flatMap(chunk => chunk.seats).filter(seat => seat.position.y < 1).map(seat => seat.position), cushions = [];
    root.traverse(mesh => {
      if (!mesh.isMesh) return;
      if (/^Seats__/.test(mesh.name)) cushions.push(mesh);
    });
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    const inspect = ({ position, standPosition }) => {
      const [x, y, z] = position;
      ray.set(new THREE.Vector3(x, y + .6, z), down);ray.far = .3;
      const cushion = ray.intersectObjects(cushions, false)[0];
      const nearest = Math.min(...occupants.map(p => Math.hypot(p.x - x, p.z - z)));
      const approach = standPosition.slice();
      approach[1] = player.groundAt(approach[0], approach[2], y);
      player.teleport([...approach, 0]);
      return { position, cushionY: cushion?.point.y ?? null, nearest, approach, canMove: player.attempt(0, -Math.sign(z) * .12) };
    };
    return { configured: config('seats').seats.map(inspect) };
  });
  console.log('T63 entrance survey:', JSON.stringify(survey));
  expect(survey.configured.length).toBeGreaterThan(0);
  for (const seat of survey.configured) {
    expect(seat.position[1]).toBeLessThan(1);
    expect(seat.cushionY).not.toBeNull();
    expect(seat.nearest).toBeGreaterThan(.5);
    expect(seat.approach[1]).not.toBeNull();
    expect(Math.abs(seat.approach[1] - seat.position[1])).toBeLessThan(.65);
    expect(seat.canMove).toBe(true);
  }
});

test('E and the seat button sit, enlarge the screen, and restore movement on E or a movement key', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await openArena(page);
  const button = page.getByRole('button', { name: '앉기', exact: true });
  await expect(button).toBeHidden();
  await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => seatProbe.events)).toEqual([]);
  expect(config.seats.length).toBeGreaterThan(0);
  await page.evaluate(seat => {
    const { player } = seatProbe.ctx, [x, y, z] = seat.position;
    const approach = [...seat.standPosition, Math.atan2(x, z)];
    approach[1] = player.groundAt(approach[0], approach[2], y);
    player.teleport(approach);
    const { THREE, root, cameraRig } = seatProbe.ctx, screen = new THREE.Box3();
    for (let i = 0; i < 4; i++) screen.union(new THREE.Box3().setFromObject(root.getObjectByName('REF_Jumbotron_' + i)));
    const target = screen.getCenter(new THREE.Vector3());
    const pitch = Math.atan2(target.y - approach[1] - 1.45, Math.hypot(target.x - approach[0], target.z - approach[2]));
    cameraRig.rotate(0, -(pitch + .2) / .002);
  }, config.seats[0]);
  // Walking keeps both the nearby seat button and its key hint available.
  await expect(page.locator('#seat-hint')).toBeVisible();
  await expect(button).toBeVisible();
  const before = await page.evaluate(() => ({ position: arena.player.toArray(), fov: arena.camera.fov }));
  expect(before.fov).toBe(68);
  const screenArea = () => page.evaluate(() => {
    const { THREE, root, camera } = seatProbe.ctx;
    camera.updateMatrixWorld(true);
    return Math.max(...[0, 1, 2, 3].map(i => {
      const mesh = root.getObjectByName('ScreenMesh_REF_Jumbotron_' + i), a = mesh.geometry.attributes.position;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const p = new THREE.Vector3();
      for (let j = 0; j < a.count; j++) {
        p.fromBufferAttribute(a, j).applyMatrix4(mesh.matrixWorld).project(camera);
        minX = Math.min(minX, p.x);maxX = Math.max(maxX, p.x);minY = Math.min(minY, p.y);maxY = Math.max(maxY, p.y);
      }
      return Math.max(0, Math.min(1, maxX) - Math.max(-1, minX)) * Math.max(0, Math.min(1, maxY) - Math.max(-1, minY));
    }));
  });
  const standingArea = await screenArea();
  expect(standingArea).toBeGreaterThan(0);
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => seatProbe.locked)).toBe(true);
  await expect(page.getByRole('button', { name: /일어나기$/ })).toBeVisible(); // T67: "E / Esc 일어나기" on the bar
  await expect.poll(() => page.evaluate(() => arena.camera.fov)).toBe(config.camera.fov);
  await expect.poll(() => page.evaluate(() => arena.avatar.getObjectByName('hips').position.y)).toBeCloseTo(.56, 2);
  expect(await page.evaluate(() => arena.camera.position.y)).toBeCloseTo(config.seats[0].position[1] + config.camera.eyeHeight);
  expect(await screenArea()).toBeGreaterThan(standingArea);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => { seatProbe.ctx.config('seats').camera.fov = 45; });
  await expect.poll(() => page.evaluate(() => arena.camera.fov)).toBe(45);
  // Keep the comparison outside the shared Playwright output that other GPU jobs clear.
  await page.screenshot({ path: shots + 'A-H-2-before-1280x720.png' });
  await page.evaluate(fov => { seatProbe.ctx.config('seats').camera.fov = fov; }, config.camera.fov);
  await expect.poll(() => page.evaluate(() => arena.camera.fov)).toBe(config.camera.fov);
  const viewports = [];
  for (const [width, height] of [[1280, 720], [960, 640]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.evaluate(() => arena.camera.aspect)).toBeCloseTo(width / height);
    await expect.poll(() => page.evaluate(() => document.querySelector('#arena-screen-player').getBoundingClientRect().height)).toBeGreaterThanOrEqual(200);
    const rect = await page.locator('#arena-screen-player').evaluate(el => el.getBoundingClientRect().toJSON());
    expect(rect.width).toBeGreaterThanOrEqual(200);
    expect(rect.x).toBeGreaterThanOrEqual(0);expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(width);expect(rect.y + rect.height).toBeLessThanOrEqual(height);
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 45000 }).toBe(true);
    if (width === 1280) await page.screenshot({ path: shots + 'A-H-2-after-1280x720.png' });
    viewports.push({ viewport: [width, height], width: rect.width, height: rect.height });
  }
  console.log('T50 seated player sizes:', JSON.stringify(viewports));
  expect(await page.evaluate(() => seatProbe.events.at(-1))).toMatchObject({ type: 'seat:enter', detail: { seatId: config.seats[0].id } });
  const seated = await page.evaluate(() => arena.player.toArray());
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => arena.player.toArray())).toEqual(seated);
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => seatProbe.locked)).toBe(false);
  expect(await page.evaluate(() => arena.camera.fov)).toBe(68);
  (await page.evaluate(() => arena.player.toArray())).forEach((value, axis) => expect(value).toBeCloseTo(config.seats[0].standPosition[axis], 3));
  await expect.poll(() => page.evaluate(() => arena.avatar.getObjectByName('hips').position.y)).toBeGreaterThan(.8);
  await showCursor(page);
  await button.click();
  await expect.poll(() => page.evaluate(() => seatProbe.locked)).toBe(true);
  await expect.poll(() => page.evaluate(() => arena.camera.fov)).toBe(config.camera.fov);
  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(() => seatProbe.locked)).toBe(false);
  await expect.poll(() => page.evaluate(position => arena.player.distanceTo(new seatProbe.ctx.THREE.Vector3(...position)), config.seats[0].standPosition)).toBeGreaterThan(.1);
  await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => arena.camera.fov)).toBe(68);
  expect(await page.evaluate(() => seatProbe.events.map(e => e.type))).toEqual(['seat:enter', 'seat:exit', 'seat:enter', 'seat:exit']);
  await showCursor(page);
  await page.evaluate(position => arena.go([...position, -.5]), before.position);
  await page.evaluate(() => { const field=document.createElement('input');field.id='seat-typing-probe';document.body.append(field);field.focus(); });
  await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => seatProbe.events.length)).toBe(4);
  await page.locator('#seat-typing-probe').evaluate(field => field.remove());
  let resources;
  for (let i = 0; i < 3; i++) {
    // Standing up keeps the cursor available for the next button click.
    await showCursor(page);
    await button.click();
    await expect.poll(() => page.evaluate(() => seatProbe.locked)).toBe(true);
    await showCursor(page);
    await page.getByRole('button', { name: /일어나기$/ }).click();
    await expect.poll(() => page.evaluate(() => seatProbe.locked)).toBe(false);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    if (i === 0) resources = await page.evaluate(() => ({ ...seatProbe.ctx.renderer.info.memory }));
  }
  expect(await page.evaluate(() => ({ ...seatProbe.ctx.renderer.info.memory }))).toEqual(resources);
  expect(await page.evaluate(() => seatProbe.events.length)).toBe(10);
  await showCursor(page);
  await button.click();
  await expect.poll(() => page.evaluate(() => seatProbe.locked)).toBe(true);
  await page.evaluate(() => seatProbe.instance.dispose());
  await expect(page.locator('#seat-toggle')).toHaveCount(0);
  expect(await page.evaluate(() => ({ locked: seatProbe.locked, fov: arena.camera.fov }))).toEqual({ locked: false, fov: 68 });
  await expect.poll(() => page.evaluate(() => arena.avatar.getObjectByName('hips').position.y)).toBeGreaterThan(.8);
  await page.keyboard.press('KeyE');
  expect(await page.evaluate(() => seatProbe.events.length)).toBe(12);
  expect(errors).toEqual([]);
  console.log('T18 render counters:', await page.evaluate(() => ({ drawCalls: arena.state.drawCalls, triangles: arena.state.triangles, ...seatProbe.ctx.renderer.info.memory })));
});
