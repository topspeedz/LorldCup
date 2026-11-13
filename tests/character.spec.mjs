import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

const ids = ['fan_f1', 'fan_f2', 'fan_m1', 'fan_m2'];
const emit = (page, type, detail) => page.evaluate(([type, detail]) => {
  fixture.ctx.events.dispatchEvent(new CustomEvent(type, { detail }));
}, [type, detail]);

async function fixturePage(page) {
  await page.route('**/__character-test', route => route.fulfill({ contentType: 'text/html', body:
    '<script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>' }));
  await page.goto('/__character-test');
  await page.evaluate(async () => {
    const THREE = await import('three');
    const { createAvatar } = await import('/avatar.js');
    const { create } = await import('/character.js');
    const config = Object.fromEntries(await Promise.all(['characters', 'teams'].map(async n => [n, await fetch(`/config/${n}.json`).then(r => r.json())])));
    const scene = new THREE.Scene(), avatar = createAvatar(0x45bfff);
    const camera = new THREE.PerspectiveCamera(40, 1, .1, 20);
    camera.position.set(1.8, 1.4, -3.6); camera.lookAt(0, .9, 0);
    const renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    renderer.setSize(256, 256); renderer.setClearColor(0x223344); document.body.append(renderer.domElement);
    scene.add(avatar, new THREE.HemisphereLight(0xffffff, 0x888888, 3));
    const avatars = new Map(), states = new Map();
    const mp = { avatarOf: id => avatars.get(id) ?? null, get peers() { return [...states.values()]; } };
    const ctx = { THREE, scene, camera, renderer, player: { avatar }, config: n => config[n], events: new EventTarget(), multiplayer: mp };
    window.arena = { avatar };
    window.fixture = { THREE, ctx, create, createAvatar, avatars, states, original: avatar.children.slice(), material: avatar.userData.material };
    renderer.render(scene, camera);
    fixture.instance = create(ctx);
    fixture.frame = () => { fixture.instance.update?.(0, performance.now()); renderer.render(scene, camera); };
    fixture.timer = setInterval(fixture.frame, 16);
  });
}

const loaded = page => expect.poll(() => page.evaluate(() => !!arena.avatar.getObjectByName('FanRig')), { timeout: 10_000 }).toBe(true);
const visibleBodies = (page, peerId = null) => page.evaluate(([ids, peerId]) => {
  const avatar = peerId ? fixture.avatars.get(peerId) : arena.avatar;
  return ids.filter(id => avatar?.getObjectByName(id)?.visible);
}, [ids, peerId]);

test('createAvatar retains its colour argument, group, material and original geometry', async ({ page }) => {
  await fixturePage(page);
  const result = await page.evaluate(() => {
    const a = fixture.createAvatar('#123456'), b = fixture.createAvatar('#abcdef');
    return { group: a.isGroup, colour: a.userData.material.color.getHexString(), separate: a.userData.material !== b.userData.material,
      material: a.children.slice(0, 2).every(o => o.material === a.userData.material),
      parts: a.children.map(o => [o.geometry.type, ...o.position.toArray()]),
      shadows: a.children.every(o => o.castShadow && o.receiveShadow) };
  });
  expect(result).toEqual({ group: true, colour: '123456', separate: true, material: true, shadows: true,
    parts: [['CapsuleGeometry', 0, .95, 0], ['SphereGeometry', 0, 1.62, 0], ['BoxGeometry', 0, 1.64, -.2],
      ['CapsuleGeometry', -.14, .26, 0], ['CapsuleGeometry', .14, .26, 0]] });
});

test('all four actual bodies render separately and only Uniform.map changes with the team', async ({ page }, info) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await fixturePage(page); await loaded(page);
  const images = [], triangles = [];
  for (const id of ids) {
    await emit(page, 'character:changed', { characterId: id });
    expect(await visibleBodies(page)).toEqual([id]);
    const metrics = await page.evaluate(id => {
      fixture.frame();
      const group = arena.avatar.getObjectByName(id), meshes = [];
      group.traverse(o => { if (o.isMesh) meshes.push(o); });
      const box = new fixture.THREE.Box3().setFromObject(group);
      return { triangles: meshes.reduce((n, o) => n + o.geometry.index.count / 3, 0), meshes: meshes.length,
        height: box.max.y - box.min.y, bottom: box.min.y, skinned: meshes.every(o => o.isSkinnedMesh && o.skeleton.bones.length === 23),
        legacyHidden: fixture.original.every(o => !o.visible), rotation: group.parent.parent.rotation.y,
        calls: fixture.ctx.renderer.info.render.calls };
    }, id);
    expect(metrics).toMatchObject({ meshes: 2, skinned: true, legacyHidden: true, calls: 2 });
    expect(metrics.height).toBeGreaterThan(1.6); expect(metrics.height).toBeLessThan(1.84);
    expect(Math.abs(metrics.bottom)).toBeLessThan(.002); expect(Math.abs(metrics.rotation)).toBeCloseTo(Math.PI);
    triangles.push(metrics.triangles);
    const png = await page.locator('canvas').screenshot();
    images.push(createHash('sha256').update(png).digest('hex'));
    await info.attach(id, { body: png, contentType: 'image/png' });
  }
  expect(triangles).toEqual([5788, 9160, 4584, 5296]); expect(new Set(images).size).toBe(4);
  const uniforms = await page.evaluate(() => {
    const meshes = []; arena.avatar.getObjectByName('FanRig').traverse(o => { if (o.isMesh) meshes.push(o); });
    const shirt = meshes.find(o => o.material.name === 'Uniform').material, neutral = shirt.map;
    const snapshot = meshes.map(o => ({ mesh: o, geometry: o.geometry, colour: o.material.color.getHex(), vertexColors: o.material.vertexColors, map: o.material.map }));
    const maps = fixture.ctx.config('teams').teams.map(team => {
      fixture.ctx.events.dispatchEvent(new CustomEvent('team:changed', { detail: { teamId: team.id } }));
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
      const c = canvas.getContext('2d'); c.drawImage(shirt.map.image, 0, 0);
      return { uuid: shirt.map.uuid, pixel: Array.from(c.getImageData(256, 256, 1, 1).data),
        width: shirt.map.image.width, height: shirt.map.image.height, srgb: shirt.map.colorSpace, flipY: shirt.map.flipY,
        path: new URL(shirt.map.image.src).pathname, changed: shirt.map !== neutral,
        untouched: snapshot.every(s => s.geometry === s.mesh.geometry && s.colour === s.mesh.material.color.getHex() &&
          s.vertexColors === s.mesh.material.vertexColors && (s.mesh.material.name === 'Uniform' || s.map === s.mesh.material.map)),
        oneUniform: meshes.filter(o => o.material.name === 'Uniform').every(o => o.material === shirt) };
    });
    return { maps, sameLegacyMaterial: arena.avatar.userData.material === fixture.material, legacyColour: fixture.material.color.getHexString() };
  });
  expect(uniforms.sameLegacyMaterial).toBe(true); expect(uniforms.legacyColour).toBe('45bfff');
  expect(uniforms.maps.map(m => m.pixel)).toEqual([[175, 148, 79, 255], [64, 77, 87, 255]]);
  expect(uniforms.maps.map(m => m.path)).toEqual(['/assets/characters/uniform-geng.png', '/assets/characters/uniform-blg.png']);
  expect(uniforms.maps[0].uuid).not.toBe(uniforms.maps[1].uuid);
  for (const map of uniforms.maps) expect(map).toMatchObject({ width: 512, height: 512, srgb: 'srgb', flipY: false, changed: true, untouched: true, oneUniform: true });
  expect(errors).toEqual([]);
});

test('teams without a uniform keep their plain team-colour PNG', async ({ page }) => {
  await page.route('**/config/teams.json', async route => {
    const response = await route.fetch(), json = await response.json();
    for (const team of json.teams) team.uniform = null;
    await route.fulfill({ response, json });
  });
  await fixturePage(page); await loaded(page);
  const maps = await page.evaluate(() => fixture.ctx.config('teams').teams.map(team => {
    fixture.ctx.events.dispatchEvent(new CustomEvent('team:changed', { detail: { teamId: team.id } }));
    let map; arena.avatar.getObjectByName('fan_f1').traverse(o => { if (o.material?.name === 'Uniform') map = o.material.map; });
    const canvas = document.createElement('canvas'), c = canvas.getContext('2d'); c.drawImage(map.image, 0, 0);
    return { pixel: Array.from(c.getImageData(20, 20, 1, 1).data), png: map.image.src.startsWith('data:image/png') };
  }));
  expect(maps).toEqual([{ pixel: [16, 19, 26, 255], png: true }, { pixel: [233, 241, 244, 255], png: true }]);
});

test('early selections and state-before-pose survive loading; peers have independent rigs and uniforms', async ({ page }) => {
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/assets/characters/fan.glb', async route => { await gate; await route.continue(); });
  await fixturePage(page);
  await emit(page, 'character:changed', { characterId: 'fan_m1' });
  await emit(page, 'team:changed', { teamId: 'blg' });
  await page.evaluate(() => {
    for (const peerId of ['one', 'two']) {
      const state = { peerId, character: 'fan_f2', team: 'geng', nickname: '팬1234' };
      fixture.states.set(peerId, state);
      fixture.ctx.events.dispatchEvent(new CustomEvent('peer:state', { detail: state }));
    }
  });
  release(); await loaded(page);
  expect(await visibleBodies(page)).toEqual(['fan_m1']);
  await page.evaluate(() => {
    for (const id of fixture.states.keys()) {
      const a = fixture.createAvatar(0xffb34d); fixture.avatars.set(id, a); fixture.ctx.scene.add(a);
    }
  });
  await expect.poll(() => visibleBodies(page, 'one')).toEqual(['fan_f2']);
  await expect.poll(() => visibleBodies(page, 'two')).toEqual(['fan_f2']);
  const independent = await page.evaluate(() => {
    const a = fixture.avatars.get('one'), b = fixture.avatars.get('two');
    const mesh = avatar => { let result; avatar.getObjectByName('fan_f2').traverse(o => { if (o.material?.name === 'Uniform') result = o; }); return result; };
    const ma = mesh(a), mb = mesh(b); const before = mb.skeleton.bones.map(o => o.quaternion.toArray());
    ma.skeleton.bones[3].rotation.x += .2;
    fixture.ctx.events.dispatchEvent(new CustomEvent('peer:state', { detail: { peerId: 'one', character: 'fan_m2', team: 'blg' } }));
    return { bones: ma.skeleton.bones.every((o, i) => o !== mb.skeleton.bones[i]),
      unchanged: JSON.stringify(before) === JSON.stringify(mb.skeleton.bones.map(o => o.quaternion.toArray())),
      material: ma.material !== mb.material, maps: ma.material.map !== mb.material.map, geometry: ma.geometry === mb.geometry };
  });
  expect(independent).toEqual({ bones: true, unchanged: true, material: true, maps: true, geometry: true });
  expect(await visibleBodies(page, 'one')).toEqual(['fan_m2']);
  expect(await visibleBodies(page, 'two')).toEqual(['fan_f2']);
  await emit(page, 'peer:state', { peerId: 'one', character: 'FanRig', team: '../../untrusted.png' });
  expect(await visibleBodies(page, 'one')).toEqual(['fan_f1']);
  const removed = await page.evaluate(() => {
    const avatar = fixture.avatars.get('one'); let disposed = 0;
    avatar.getObjectByName('fan_f1').traverse(o => { if (o.material?.name === 'Uniform') o.material.addEventListener('dispose', () => disposed++); });
    fixture.states.delete('one'); fixture.avatars.delete('one'); fixture.ctx.scene.remove(avatar); fixture.frame();
    return { disposed, removed: !avatar.getObjectByName('FanRig') };
  });
  expect(removed).toEqual({ disposed: 1, removed: true });
});

test('three create/dispose cycles release model resources and restore the original avatar', async ({ page }) => {
  await fixturePage(page); const counts = [];
  for (let i = 0; i < 3; i++) {
    await loaded(page);
    counts.push(await page.evaluate(() => {
      fixture.frame(); const before = { ...fixture.ctx.renderer.info.memory };
      fixture.instance.dispose(); fixture.frame();
      const after = { ...fixture.ctx.renderer.info.memory };
      return { before, after, restored: fixture.original.every(o => o.visible),
        children: arena.avatar.children.length, same: arena.avatar.userData.material === fixture.material };
    }));
    if (i < 2) await page.evaluate(() => { fixture.instance = fixture.create(fixture.ctx); });
  }
  for (const result of counts) expect(result).toMatchObject({ after: { geometries: 4, textures: 0 }, restored: true, children: 5, same: true });
  expect(counts[1].before).toEqual(counts[0].before); expect(counts[2].before).toEqual(counts[0].before);
});

test('failed model loading leaves the existing avatar usable without an unhandled rejection', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('**/assets/characters/fan.glb', route => route.abort());
  await fixturePage(page);
  await expect.poll(() => page.evaluate(() => !!arena.character?.error)).toBe(true);
  expect(await page.evaluate(() => ({ ready: arena.character.ready, visible: fixture.original.every(o => o.visible), children: arena.avatar.children.length })))
    .toEqual({ ready: false, visible: true, children: 5 });
  expect(errors).toEqual([]);
});

test('real room peers see the selected character, team picture and automatic nickname', async ({ browser }) => {
  test.setTimeout(180_000);
  const hostContext = await browser.newContext(), guestContext = await browser.newContext();
  const host = await hostContext.newPage(), guest = await guestContext.newPage();
  const errors = []; for (const page of [host, guest]) page.on('pageerror', e => errors.push(e.message));
  const open = async (page, url) => { await page.goto(url); await page.waitForFunction(() => window.arena?.ready, null, { timeout: 90_000 }); await loaded(page); };
  try {
    // U-H-12: no "방 만들기" any more — 들어가기 auto-places the host in a room; the guest follows the invite link.
    await open(host, '/');
    await host.locator('#enter').click();
    await host.waitForFunction(() => arena.multiplayer.room, null, { timeout: 60_000 });
    const code = await host.evaluate(() => arena.multiplayer.room.code);
    await open(guest, '/?b=final&room=' + code);
    await guest.getByRole('button', { name: '들어가기', exact: true }).click();
    await guest.waitForFunction(() => arena.multiplayer.count === 2);
    await guest.getByRole('button', { name: '팀·캐릭터', exact: true }).click();
    const dialog = guest.getByRole('dialog', { name: '팀·캐릭터 선택' });
    await dialog.getByRole('button', { name: 'BLG', exact: true }).click();
    await dialog.getByRole('button', { name: '남성 팬 2', exact: true }).click();
    const peerId = await guest.evaluate(() => arena.multiplayer.peerId);
    const appearance = () => host.evaluate(peerId => {
      const a = arena.multiplayer.avatarOf(peerId), body = a?.getObjectByName('fan_m2'); let material;
      body?.traverse(o => { if (o.material?.name === 'Uniform') material = o.material; });
      if (!body?.visible || !material?.map?.image) return null;
      const canvas = document.createElement('canvas'), c = canvas.getContext('2d'); c.drawImage(material.map.image, 0, 0);
      return { pixel: Array.from(c.getImageData(20, 20, 1, 1).data), nickname: arena.multiplayer.peers.find(p => p.peerId === peerId)?.nickname };
    }, peerId);
    await expect.poll(appearance, { timeout: 20_000 }).toMatchObject({ pixel: [0, 188, 212, 255], nickname: expect.stringMatching(/^팬\d{4,5}$/) });
    const { nickname } = await appearance();
    await expect(host.getByText(nickname, { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'GEN.G', exact: true }).click();
    await expect.poll(appearance, { timeout: 10_000 }).toMatchObject({ pixel: [214, 180, 90, 255], nickname });
    await guest.evaluate(() => arena.multiplayer.leave()); // no leave button on screen (architecture)
    await host.waitForFunction(id => !arena.multiplayer.avatarOf(id), peerId);
    await expect(host.getByText(nickname, { exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally { await hostContext.close(); await guestContext.close(); }
});
