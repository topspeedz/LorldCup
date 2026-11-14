import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import * as THREE from '../web/vendor/three.module.js';

const config = JSON.parse(readFileSync(new URL('../web/config/camera.json', import.meta.url), 'utf8'));
const shaderFor = material => {
  const shader = { uniforms: {}, vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader, {});
  return shader;
};

test('T76 CPU: occlusion defaults preserve the approved wheel zoom distances', () => {
  expect(config).toEqual({ distance: 5, maxDistance: 7.5, minDistance: 0, wheelStep: .5,
    occlusion: { opacity: .12, fadeDistance: .5, targetPadding: .35, radius: 1.6 } });
});

test('T76 CPU: merged and instanced scenery share the fade while protected materials and shader hooks survive', async () => {
  const { createCameraOcclusion } = await import('../web/camera-occlusion.js');
  const root = new THREE.Group(), original = new THREE.MeshStandardMaterial(), geometry = new THREE.BoxGeometry();
  original.onBeforeCompile = shader => { shader.uniforms.bakedLightRange = { value: 8 }; };
  original.customProgramCacheKey = () => 'baked-and-crowd';
  const scenery = new THREE.Mesh(geometry, original), crowd = new THREE.InstancedMesh(geometry, original, 2);
  const screen = new THREE.Group(), screenMesh = new THREE.Mesh(geometry, original);
  screen.name = 'REF_Jumbotron_0';screen.add(screenMesh);
  const avatar = new THREE.SkinnedMesh(geometry, original), monitor = new THREE.Mesh(geometry, original);
  monitor.name = 'REF_Reused_Monitor_pixels__cyan';
  root.add(scenery, crowd, screen, avatar, monitor);
  const occlusion = createCameraOcclusion(root, config.occlusion), material = scenery.material;
  expect(material).not.toBe(original);
  expect(crowd.material).toBe(material);
  for (const mesh of [screenMesh, avatar, monitor]) expect(mesh.material).toBe(original);
  expect([material.transparent, material.depthWrite, material.opacity]).toEqual([false, true, 1]);
  expect(material.customProgramCacheKey()).toContain('baked-and-crowd');
  const shader = shaderFor(material);
  expect(shader.uniforms.bakedLightRange.value).toBe(8);
  expect(shader.vertexShader).toContain('#include <project_vertex>');
  expect(shader.vertexShader).toContain('cameraOcclusionPosition=mvPosition.xyz');
  expect(shader.fragmentShader).toContain('gl_FragCoord.w');
  occlusion.update(5);
  expect(shader.uniforms.cameraOcclusionLimit.value).toBeCloseTo(4.65);
  expect(shader.uniforms.cameraOcclusionOpacity.value).toBe(.12);
  expect(shader.uniforms.cameraOcclusionRadius.value).toBe(1.6);
  occlusion.update(0);
  expect(shader.uniforms.cameraOcclusionLimit.value).toBe(0);
  const lateLodMesh = new THREE.Mesh(geometry, crowd.material);root.add(lateLodMesh);
  let disposed = 0, originalDisposed = 0;
  material.addEventListener('dispose', () => disposed++);original.addEventListener('dispose', () => originalDisposed++);
  occlusion.dispose();
  for (const mesh of [scenery, crowd, lateLodMesh]) expect(mesh.material).toBe(original);
  expect([disposed, originalDisposed]).toEqual([1, 0]);
  geometry.dispose();original.dispose();
});

test('T84 CPU: walkable and seating floors keep shared original materials while occluders are patched', async () => {
  const { createCameraOcclusion } = await import('../web/camera-occlusion.js');
  const root = new THREE.Group(), original = new THREE.MeshStandardMaterial(), geometry = new THREE.BoxGeometry();
  const floors = ['registered-floor', 'Walk_Tier0__concrete', 'Walk_Tier1__concrete', 'Suites_floor__concrete'].map(name => {
    const mesh = new THREE.Mesh(geometry, original);mesh.name = name;root.add(mesh);return mesh;
  });
  const chair = new THREE.Mesh(geometry, original);chair.name = 'Seats__seat';root.add(chair);
  const occlusion = createCameraOcclusion(root, config.occlusion, [floors[0]]);
  for (const floor of floors) expect(floor.material, floor.name).toBe(original);
  expect(chair.material).not.toBe(original);
  occlusion.dispose();expect(chair.material).toBe(original);
  geometry.dispose();original.dispose();
});

test('T84: looking down keeps floors and side scenery opaque while actual occluders still dither', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/Shader Error|GL_INVALID|INVALID_OPERATION/.test(message.text())) errors.push(message.text()); });
  await page.route('**/occlusion-fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Occlusion regression</title>' }));
  await page.goto('/occlusion-fixture');
  const result = await page.evaluate(async config => {
    const THREE = await import('/vendor/three.module.js');
    const { createCameraOcclusion } = await import('/camera-occlusion.js');
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(68, 1, .08, 100);
    const target = new THREE.Vector3(0, 1.45, 0);
    camera.position.set(0, 5, 5);camera.lookAt(target);camera.updateMatrixWorld(true);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    floor.rotation.x = -Math.PI / 2;scene.add(floor);
    const chair = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
    chair.position.set(0, 0, -3).applyMatrix4(camera.matrixWorld);chair.quaternion.copy(camera.quaternion);scene.add(chair);
    const side = chair.clone();side.position.set(2.1, 0, -4).applyMatrix4(camera.matrixWorld);scene.add(side);
    const renderer = new THREE.WebGLRenderer(), renderTarget = new THREE.WebGLRenderTarget(256, 256);
    const occlusion = createCameraOcclusion(scene, config, [floor]);
    const pixels = () => {
      renderer.setRenderTarget(renderTarget);renderer.render(scene, camera);
      const data = new Uint8Array(256 * 256 * 4);renderer.readRenderTargetPixels(renderTarget, 0, 0, 256, 256, data);return data;
    };
    try {
      const before = pixels();occlusion.update(camera.position.distanceTo(target));const after = pixels();
      const counts = { floor: 0, changedFloor: 0, center: 0, changedCenter: 0, side: 0, changedSide: 0 };
      for (let i = 0; i < before.length; i += 4) {
        const changed = before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2];
        if (before[i] > 250 && before[i + 1] < 5) { counts.floor++;if (changed) counts.changedFloor++; }
        if (before[i + 1] > 250 && before[i] < 5) {
          if (i / 4 % 256 < 180) { counts.center++;if (changed) counts.changedCenter++; }
          else { counts.side++;if (changed) counts.changedSide++; }
        }
      }
      return counts;
    } finally {
      occlusion.dispose();renderTarget.dispose();renderer.dispose();
      floor.geometry.dispose();floor.material.dispose();chair.geometry.dispose();chair.material.dispose();
    }
  }, config.occlusion);
  expect(result.floor).toBeGreaterThan(1000);expect(result.changedFloor).toBe(0);
  expect(result.center).toBeGreaterThan(100);expect(result.changedCenter / result.center).toBeGreaterThan(.8);
  expect(result.side).toBeGreaterThan(100);expect(result.changedSide).toBe(0);
  expect(errors).toEqual([]);
  console.log('T84 rendered floor and occluder pixels:', JSON.stringify(result));
});

test('T76 CPU: camera collision, first person, overrides, Full Mode and page disposal keep their existing behavior', async () => {
  const source = readFileSync(new URL('../web/camera-rig.js', import.meta.url), 'utf8')
    .replace("'three'", JSON.stringify(new URL('../web/vendor/three.module.js', import.meta.url).href))
    .replace("'./camera-occlusion.js'", JSON.stringify(new URL('../web/camera-occlusion.js', import.meta.url).href))
    .replace("'./events.js'", JSON.stringify(new URL('../web/events.js', import.meta.url).href));
  const { createCameraRig } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const { events, APP_READY, FULLMODE_ENTER, FULLMODE_EXIT } = await import('../web/events.js');
  const previous = { window: globalThis.window, document: globalThis.document }, canvas = new EventTarget();
  globalThis.window = new EventTarget();globalThis.document = { querySelector: () => canvas };
  const scene = new THREE.Scene(), root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const floor = new THREE.Mesh(new THREE.BoxGeometry(20, .2, 20), material);floor.position.y = -.1;root.add(floor);scene.add(root);
  const chair = new THREE.Mesh(new THREE.BoxGeometry(), material);root.add(chair);
  const player = { position: new THREE.Vector3(), avatar: new THREE.Group(), wallMeshes: [], floorMeshes: [floor] };scene.add(player.avatar);
  const camera = new THREE.PerspectiveCamera(68, 1.6, .08, 650), rig = createCameraRig({ camera, player, config });
  const distance = () => camera.position.distanceTo(player.position.clone().add(new THREE.Vector3(0, 1.45, 0)));
  try {
    scene.updateMatrixWorld(true);rig.update(0);events.dispatchEvent(new Event(APP_READY));
    expect(floor.material).toBe(material);
    const shader = shaderFor(chair.material), limit = () => shader.uniforms.cameraOcclusionLimit.value;
    expect(distance()).toBeCloseTo(5);expect(limit()).toBeCloseTo(4.65);
    events.dispatchEvent(new Event(FULLMODE_ENTER));expect(limit()).toBe(0);
    rig.update(0);expect(limit()).toBe(0);
    events.dispatchEvent(new Event(FULLMODE_EXIT));expect(limit()).toBeCloseTo(4.65);
    rig.setOverride(view => { view.position.set(10, 20, 30);view.fov = 50; });rig.update(0);
    expect(camera.position.toArray()).toEqual([10, 20, 30]);expect(limit()).toBe(0);
    events.dispatchEvent(new Event(FULLMODE_ENTER));events.dispatchEvent(new Event(FULLMODE_EXIT));expect(limit()).toBe(0);
    rig.setOverride(null);rig.update(0);expect(camera.fov).toBe(68);expect(limit()).toBeCloseTo(4.65);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(.2, 10, 10), material);wall.position.x = -2;wall.updateMatrixWorld(true);
    player.wallMeshes.push(wall);rig.update(0);
    expect(distance()).toBeCloseTo(1.65);expect(limit()).toBeCloseTo(1.3);
    player.wallMeshes.length = 0;rig.update(0);expect(distance()).toBeCloseTo(5);
    for (let i = 0; i < 10; i++) canvas.dispatchEvent(Object.assign(new Event('wheel', { cancelable: true }), { deltaY: -100 }));
    rig.update(0);expect(distance()).toBeCloseTo(0);expect(limit()).toBe(0);expect(player.avatar.visible).toBe(false);
    window.dispatchEvent(new Event('pagehide'));expect(floor.material).toBe(material);expect(chair.material).toBe(material);
    events.dispatchEvent(new Event(APP_READY));expect(floor.material).toBe(material);
    wall.geometry.dispose();
  } finally {
    window.dispatchEvent(new Event('pagehide'));
    globalThis.window = previous.window;globalThis.document = previous.document;
    floor.geometry.dispose();chair.geometry.dispose();material.dispose();
  }
});
