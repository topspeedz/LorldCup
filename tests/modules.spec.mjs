import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const architecture = read('docs/live/web-metaverse-develop/architecture.md');
const modulePaths = [...architecture.split('### 기능 모듈')[1].split('### 모듈 목록 밖의 파일')[0]
  .matchAll(/^\| `(web\/[^`]+\.js)`/gm)].map(match => match[1]);
const configNames = [...architecture.split('## 설정 파일')[1].split('## 점유 표시')[0]
  .matchAll(/^\| `web\/config\/([^`]+)\.json`/gm)].map(match => match[1]);
// T63b adds the approved entrance fixes to the documented module registry.
if (!modulePaths.includes('web/arena-fixes.js')) modulePaths.push('web/arena-fixes.js');
if (!configNames.includes('arena-fixes')) configNames.push('arena-fixes');
if (!modulePaths.includes('web/ticket-staff.js')) modulePaths.push('web/ticket-staff.js');
if (!configNames.includes('ticket-staff')) configNames.push('ticket-staff');
const legacyKeys = ['ready', 'camera', 'player', 'avatar', 'multiplayer', 'crowd', 'lighting', 'go', 'attempt', 'groundAt', 'state'];

async function openArena(page) {
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      window.moduleProbe={created:[],updated:[],disposed:[]};
      for(const entry of modules){
        const original=entry.create;
        entry.create=ctx=>{
          window.moduleContext=ctx;
          moduleProbe.created.push({path:entry.path,ready:window.arena.ready,root:!!ctx.root,lighting:!!window.arena.lighting});
          const instance=original(ctx);
          if(instance instanceof Promise)throw Error('Asynchronous module create');
          return {...instance,update(dt,now){
            if(moduleProbe.now!==now){moduleProbe.now=now;moduleProbe.updated=[];}
            moduleProbe.updated.push(entry.path);moduleProbe.dt=dt;
            instance.update?.(dt,now);
          },dispose(){moduleProbe.disposed.push(entry.path);instance.dispose?.();}};
        };
      }` });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
}

test('module and config files match the architecture and approved defaults', async () => {
  expect(modulePaths).toHaveLength(16);
  expect(configNames).toHaveLength(16);
  for (const path of [...modulePaths, ...configNames.map(name => `web/config/${name}.json`)]) {
    expect(existsSync(new URL(`../${path}`, import.meta.url)), path).toBe(true);
  }
  const config = name => JSON.parse(read(`web/config/${name}.json`));
  expect(config('controls')).toMatchObject({
    forward: ['KeyW', 'ArrowUp'], backward: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    run: ['ShiftLeft', 'ShiftRight'], jump: ['Space'],
    emoteMenu: ['ControlLeft', 'ControlRight'], sit: ['KeyE'], fullMode: ['KeyF'],
  });
  expect(config('camera')).toMatchObject({ distance: 5, maxDistance: 7.5, minDistance: 0, wheelStep: 0.5 });
  expect(config('screen')).toMatchObject({
    vod: 'https://www.youtube.com/watch?v=rQTHR3aL0SE', live: 'https://www.youtube.com/watch?v=EacB7ADMGpY',
    source: 'vod', roundIntervalMinutes: 10, defaultRound: 'current', ended: 'next-round',
    syncIntervalSeconds: 5, syncToleranceSeconds: 2, face: 'front', aspectRatio: [16, 9], fit: 'contain', mesh: { width: expect.any(Number), centerY: expect.any(Number) },
    muted: true, unmuteOnEnter: true, volume: 70, crowdVolume: 0.3,
  });
  expect(config('characters')).toMatchObject({ ids: ['fan_f1', 'fan_f2', 'fan_m1', 'fan_m2'], default: 'fan_f1' });
  expect(config('teams').teams.map(team => team.name)).toEqual(['GEN.G', 'BLG']);
  expect(config('teams').teams.every(team => /^\.\/assets\/characters\/[^/]+$/.test(team.uniform) && existsSync(new URL(`../web/${team.uniform}`, import.meta.url)))).toBe(true);
  expect(config('environment')).toMatchObject({ stars: { count: 3000 }, moon: { elevationDegrees: 35 }, sea: { boundaryX: -180 } });
  expect(config('sky-show')).toMatchObject({ beams: { count: 3, periodSeconds: 8, angleDegrees: 25, opacity: 0.055 }, fireworks: { intervalSeconds: [20, 40], count: [1, 3] } });
  expect(config('ticket')).toMatchObject({ barrier: { x: -107.2, z: [-5.79, 6.7175], y: [-0.02, 2.9675] }, sideGlass: { x: [-107.06, -103.99], z: [-60.71, 59.21] }, promptDistance: 3, cardMs: 1800, guardLocations: ['lobby', 'arena'] });
  expect(config('seats')).toMatchObject({ seats: expect.any(Array), camera: { fov: 50, target: 'screen', height: 'eye', eyeHeight: 3.54, screenFill: 0.85 } });
  expect(config('stage-monitors')).toMatchObject({ source: 'generated', path: null });
  expect(config('stage-players')).toMatchObject({ intervalSeconds: [3, 8], shoutProbability: 0.1 });
  expect(config('crowd')).toMatchObject({ upperFloorHeight: 5, oppositeAngleDegrees: 60, farTextureScale: 0.25, mannequinTextureScale: 0.25, mannequinMotion: 'cheer-only' });
  expect(config('network')).toMatchObject({ capacity: 16, fullMessage: '방이 가득 찼습니다(16명)', nickname: { prefix: '팬', digits: 4, collisionExtraDigits: 1 } });
  expect(config('network')).not.toHaveProperty('roundOffsets'); // T32: decision 9, no round picker
  expect(config('controls')).not.toHaveProperty('menu'); // mouse-first: Esc releases nothing
  expect(config('broadcasts').broadcasts.map(b => b.id)).toEqual(['final', 'sf-t1-blg', 'sf-ig-geng']);
});

test('registry, lifecycle, ctx and window.arena retain the architecture contract', async ({ page }) => {
  await openArena(page);
  const result = await page.evaluate(async names => {
    const { modules } = await import('./modules.js');
    const ctx = window.moduleContext, a = window.arena;
    await new Promise(requestAnimationFrame);
    return {
      paths: modules.map(entry => `web/${entry.path}`), created: moduleProbe.created, updated: moduleProbe.updated,
      dt: moduleProbe.dt, now: moduleProbe.now, keys: Object.keys(a), state: Object.keys(a.state),
      samePosition: ctx.player.position === a.player, sameAvatar: ctx.player.avatar === a.avatar,
      sameMultiplayer: ctx.multiplayer === a.multiplayer, vector: a.player.isVector3, group: a.avatar.isGroup,
      material: !!a.avatar.userData.material, configs: names.map(name => !!ctx.config(name)),
      bus: ctx.events instanceof EventTarget, alpha: ctx.renderer.getContext().getContextAttributes().alpha,
      layers: [ctx.cssLayer, ctx.renderer.domElement, ctx.uiRoot].map(el => document.body.contains(el)),
      cssPointer: getComputedStyle(ctx.cssLayer).pointerEvents,
      metrics: { drawCalls: a.state.drawCalls, triangles: a.state.triangles, ...ctx.renderer.info.memory },
    };
  }, configNames);
  expect(result.paths).toEqual(modulePaths);
  expect(result.created.map(entry => `web/${entry.path}`)).toEqual(modulePaths);
  expect(result.created.every(entry => !entry.ready && entry.root && entry.lighting)).toBe(true);
  expect(result.updated.map(path => `web/${path}`)).toEqual(modulePaths);
  expect(result.dt).toBeGreaterThanOrEqual(0);
  expect(result.now).toBeGreaterThan(0);
  expect(result.keys).toEqual(expect.arrayContaining(legacyKeys));
  expect(result.state).toEqual(['x', 'y', 'z', 'walking', 'airborne', 'drawCalls', 'triangles']);
  for (const key of ['samePosition', 'sameAvatar', 'sameMultiplayer', 'vector', 'group', 'material', 'bus', 'alpha']) expect(result[key], key).toBe(true);
  expect(result.configs.every(Boolean)).toBe(true);
  expect(result.layers).toEqual([true, true, true]);
  expect(result.cssPointer).toBe('none');
  console.log('T11 render counters:', result.metrics);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => moduleProbe.disposed)).toEqual([...modulePaths].reverse().map(path => path.slice(4)));
});

test('player hooks preserve teleport, movement locks, invisible blockers and camera reset', async ({ page }) => {
  await openArena(page);
  const result = await page.evaluate(async () => {
    const { player, cameraRig, THREE } = window.moduleContext;
    const a = window.arena;
    a.go('arena');
    const bypass = a.state.x === -25;
    player.teleport([-139, -.02, 0, .4]);
    const pose = [...player.position.toArray(), player.avatar.rotation.y];
    player.teleport('plaza');
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(.1, 3, 3), new THREE.MeshBasicMaterial());
    blocker.position.set(-138.7, 1, 0);blocker.visible = false;blocker.updateMatrixWorld(true);
    player.addBlocker(blocker);
    const blocked = !a.attempt(.25, 0);
    player.removeBlocker(blocker);
    const unblocked = a.attempt(.25, 0);
    blocker.geometry.dispose();blocker.material.dispose();
    a.go('plaza');player.setLocked(true);
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown'));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true }));
    await new Promise(resolve => setTimeout(resolve, 150));
    const locked = a.state.x === -139 && !a.state.airborne;
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW' }));
    player.setLocked(false);
    cameraRig.setOverride(camera => { camera.position.set(10, 20, 30);camera.fov = 45;camera.updateProjectionMatrix(); });
    await new Promise(requestAnimationFrame);
    const overridden = a.camera.position.toArray();
    cameraRig.setOverride(null);
    await new Promise(requestAnimationFrame);
    return { bypass, pose, guard: typeof player.setTeleportGuard, blocked, unblocked, locked, overridden, restoredFov: a.camera.fov, restored: a.camera.position.x !== 10 };
  });
  expect(result).toMatchObject({ bypass: true, pose: [-139, -.02, 0, .4], guard: 'undefined', blocked: true, unblocked: true, locked: true, overridden: [10, 20, 30], restoredFov: 68, restored: true });
});

test('configured actions ignore typing and repeats; capsule acknowledges emotes once', async ({ page }) => {
  await page.route('**/config/controls.json', async route => {
    const response = await route.fetch(), controls = await response.json();
    controls.fullMode = ['KeyQ'];
    await route.fulfill({ response, json: controls });
  });
  await openArena(page);
  await page.waitForFunction(() => window.arena?.character?.ready);
  // Key actions start only after app:enter (web/input.js:40; architecture `app:enter` → input.js 이동 입력 켬). T47 원인 4.
  await page.locator('#enter').click();
  await page.waitForFunction(() => document.querySelector('#panel').hidden);
  const result = await page.evaluate(() => {
    const { events, input } = window.moduleContext, actions = [], played = [];
    events.addEventListener('input:action', event => actions.push(event.detail));
    events.addEventListener('emote:played', event => played.push(event.detail));
    const key = (type, code, target = document, repeat = false) => target.dispatchEvent(new KeyboardEvent(type, { code, repeat, bubbles: true, cancelable: true }));
    const prevented = !key('keydown', 'ControlLeft');
    key('keydown', 'ControlLeft', document, true);key('keyup', 'ControlLeft');
    key('keydown', 'KeyE');key('keyup', 'KeyE');
    key('keydown', 'KeyF');key('keyup', 'KeyF');
    key('keydown', 'KeyQ');key('keyup', 'KeyQ');
    const field = document.body.appendChild(document.createElement('input'));field.focus(); // no text field ships any more (the room code input is gone)
    key('keydown', 'ControlLeft', field);key('keyup', 'ControlLeft', field);
    key('keydown', 'KeyQ');key('keyup', 'KeyQ');key('keydown', 'KeyW');
    const typingKeys = input.keys.size;field.blur();field.remove();
    for (const id of ['cheer_clap', 'heart', 'angry', 'egg_throw']) events.dispatchEvent(new CustomEvent('emote:request', { detail: { id } }));
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown'));
    key('keydown', 'KeyW');window.dispatchEvent(new Event('blur'));
    return { actions, played, prevented, typingKeys, blurredKeys: input.keys.size, pointerAPI: [typeof input.releasePointer, typeof input.capturePointer] };
  });
  expect(result.actions).toEqual(['emoteMenu', 'sit', 'fullMode'].flatMap(action => [{ action, down: true }, { action, down: false }]));
  expect(result.played).toEqual(['cheer_clap', 'heart', 'angry', 'egg_throw'].map(id => ({ id })));
  expect(result).toMatchObject({ prevented: false, typingKeys: 0, blurredKeys: 0, pointerAPI: ['function', 'function'] });
});
