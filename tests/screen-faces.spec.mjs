import { test, expect } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import * as THREE from '../web/vendor/three.module.js';
import { createScreenMesh } from '../web/screen-mesh.js';

const config = JSON.parse(readFileSync(new URL('../web/config/screen.json', import.meta.url)));

test('T85 CPU: only the three configured photo faces replace the original artwork', () => {
  const settings = { mesh: config.mesh, videoFace: 'REF_Jumbotron_3', photoBrightness: 1,
    photos: { REF_Jumbotron_0: './assets/screen/arena-rear.jpg', REF_Jumbotron_1: './assets/screen/arena-left.jpg', REF_Jumbotron_2: './assets/screen/arena-right.jpg' } };
  const root = new THREE.Group(), geometry = new THREE.PlaneGeometry(13.6, 4);
  const expectedUV = Array.from(geometry.attributes.uv.array);
  geometry.attributes.uv.array = geometry.attributes.uv.array.map(value => value * .25 + .2);
  const originalUV = Array.from(geometry.attributes.uv.array);
  const logo = new THREE.MeshStandardMaterial({ map: new THREE.Texture() });
  const originals = Array.from({ length: 4 }, (_, i) => {
    const mesh = new THREE.Mesh(geometry, logo);mesh.name = 'REF_Jumbotron_' + i;mesh.rotation.y = i * Math.PI / 2;
    mesh.position.set(Math.sin(mesh.rotation.y) * 5, 0, Math.cos(mesh.rotation.y) * 5);root.add(mesh);return mesh;
  });
  const loaded = [], disposed = [];
  class TextureLoader {
    load(path) { const texture = new THREE.Texture();texture.userData.path = path;loaded.push(texture);return texture; }
  }
  const screen = createScreenMesh({ THREE: { ...THREE, TextureLoader }, root, config: () => settings });
  try {
    expect(screen.meshes.map(mesh => mesh.userData.screenFace).sort()).toEqual(originals.map(mesh => mesh.name));
    expect(screen.meshes[3].material).toBe(logo);
    for (const mesh of screen.meshes.slice(0, 3)) {
      expect(mesh.geometry).not.toBe(geometry);
      expect(Array.from(mesh.geometry.attributes.position.array)).toEqual(Array.from(geometry.attributes.position.array));
      Array.from(mesh.geometry.attributes.uv.array).forEach((value, i) => expect(value).toBeCloseTo(expectedUV[i], 6));
      expect(mesh.material, mesh.name).not.toBe(logo);
      expect(mesh.material.isMeshBasicMaterial).toBe(true);
      expect(mesh.material.map.userData.path).toBe(settings.photos[mesh.userData.screenFace]);
      expect(mesh.material.map.colorSpace).toBe(THREE.SRGBColorSpace);
      expect(mesh.material.toneMapped).toBe(false);
      expect(mesh.material.color.r).toBe(settings.photoBrightness);
      for (const resource of [mesh.geometry, mesh.material, mesh.material.map]) resource.addEventListener('dispose', () => disposed.push(resource));
    }
    expect(loaded.map(texture => texture.userData.path).sort()).toEqual(Object.values(settings.photos).sort());
    expect(originals.every(mesh => !mesh.visible && mesh.material === logo)).toBe(true);
    expect(Array.from(geometry.attributes.uv.array)).toEqual(originalUV);
    const southPhoto = screen.meshes[0].material;
    screen.setVideoFace('REF_Jumbotron_0');
    expect(screen.meshes[0].material).toBe(logo);
    expect(screen.meshes[0].geometry).toBe(geometry);
    expect(screen.meshes[3].material).toBe(southPhoto);
    screen.meshes[3].geometry.addEventListener('dispose', () => disposed.push(screen.meshes[3]));
    screen.setVideoFace('REF_Jumbotron_3');
    expect(screen.meshes[0].material).toBe(southPhoto);
    expect(screen.meshes[3].material).toBe(logo);
    expect(screen.meshes[3].geometry).toBe(geometry);
    expect(loaded).toHaveLength(3);
    logo.addEventListener('dispose', () => { throw new Error('Shared original material was disposed'); });
    geometry.addEventListener('dispose', () => { throw new Error('Shared original geometry was disposed'); });
    screen.dispose();
    expect(disposed).toHaveLength(10);
    expect(new Set(disposed).size).toBe(10);
    expect(originals.every(mesh => mesh.visible && mesh.material === logo)).toBe(true);
    expect(root.getObjectByName('ArenaScreenMesh')).toBeUndefined();
  } finally {
    if (root.getObjectByName('ArenaScreenMesh')) screen.dispose();
  }
});

test('T85 CPU: production config supplies three distinct JPEGs within the deployment budget', () => {
  expect(config.playerWidth).toBe(1920);expect(config.playerHeight).toBe(1080);expect(config.mesh.width).toBe(26);
  expect(config.videoFace).toMatch(/^REF_Jumbotron_[0-3]$/);
  expect(Object.keys(config.photos).sort()).toEqual([0, 1, 2, 3].map(i => 'REF_Jumbotron_' + i).filter(name => name !== config.videoFace));
  expect(new Set(Object.values(config.photos)).size).toBe(3);
  expect(config.photoBrightness).toBeGreaterThan(0);
  for (const path of Object.values(config.photos)) {
    expect(path).toMatch(/^\.\/assets\/screen\/[a-z0-9-]+\.jpg$/);
    const file = new URL('../web/' + path, import.meta.url), bytes = readFileSync(file);
    expect(bytes.subarray(0, 2).toString('hex')).toBe('ffd8');
    expect(statSync(file).size).toBeLessThanOrEqual(400_000);
  }
});
