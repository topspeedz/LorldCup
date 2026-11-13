// Load the exported asset through the existing app without changing its asset URL.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { serve } from '../../../tests/serve.mjs';
import { acquire, release } from '../../../tests/gpu-lock.mjs';

const here = new URL('./', import.meta.url);
await acquire('T32-browser');
let server, browser;
try {
  server = await serve();
  const results = {};
  for (const version of ['v1', 'v2']) {
    // Release the large arena's GPU allocations before loading the other version.
    browser = await chromium.launch({ channel: 'chromium', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [], lightmaps = new Set();
    page.on('crash', () => console.error('T32_PAGE_CRASH', version));
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', response => {
      if (/\/lightmaps\//.test(response.url()) && response.ok()) lightmaps.add(new URL(response.url()).pathname);
    });
    if (version === 'v2') await page.route(/\/arena\.glb(?:\?|$)/, route => route.continue({
      url: new URL('arena-v2.glb', server.url).href,
    }));
    await page.goto(server.url);
    await page.waitForFunction(() => window.arena?.ready, null, { timeout: 180000 });
    await page.evaluate(() => { arena.crowd.setPaused(true); arena.crowd.seek(0); });
    const info = await page.evaluate(() => {
      const scene = arena.avatar.parent, newMeshes = [], bad = [], ranges = {}, motifs = [];
      let lightmapped = 0;
      scene.traverse(o => {
        if (o.name.startsWith('Fix_') || /^Collide_(RampInfill|TierColumns)/.test(o.name)) newMeshes.push(o.name);
        if (!o.isMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const mat of mats) {
          if (mat.userData.bakedLighting) {
            lightmapped++;
            if (!mat.lightMap || mat.lightMap.channel !== 3 || !o.geometry.attributes.uv3 || mat.lightMap.generateMipmaps) bad.push(o.name);
          }
          if (/^REF_Artwork_/.test(mat.name)) motifs.push({ node: o.name, material: mat.name, image: mat.emissiveMap?.name, transparent: mat.transparent });
        }
        let owner = o;
        while (owner && !owner.userData.bakedLighting) owner = owner.parent;
        if (owner) ranges[owner.userData.bakedLighting.texture] = owner.userData.bakedLighting.range;
      });
      return { baked: arena.lighting.baked, crowd: arena.crowd.meshes.length, crowdBaked: arena.crowd.meshes.some(o =>
        (Array.isArray(o.material) ? o.material : [o.material]).some(m => m.lightMap)), lightmapped, bad, newMeshes, ranges, motifs };
    });
    assert.equal(info.baked.textures, 7);
    assert.equal(info.crowd, 96);
    assert.equal(info.crowdBaked, false);
    assert.deepEqual(info.bad, []);
    if (version === 'v2') {
      assert.equal(info.newMeshes.length, 9);
      assert.equal(Object.keys(info.ranges).length, 7);
      assert(Object.keys(info.ranges).every(p => p.endsWith('-v2.png')));
      assert.equal(info.motifs.length, 12);
    }
    for (const location of ['plaza', 'arena']) {
      await page.evaluate(name => arena.go(name), location);
      await page.waitForTimeout(500);
      await page.screenshot({ path: fileURLToPath(new URL(`t32-${version}-${location}.png`, here)) });
    }
    assert.deepEqual(errors, []);
    assert.equal(lightmaps.size, 7);
    results[version] = { ...info, lightmaps: [...lightmaps], errors };
    writeFileSync(new URL('t32-browser-validation.json', here), JSON.stringify(results, null, 2));
    await page.close();
    await browser.close();
    browser = null;
  }
  console.log('T32_BROWSER', JSON.stringify(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, {
    baked: v.baked, crowd: v.crowd, added: v.newMeshes.length, motifs: v.motifs.length, errors: v.errors,
  }]))));
} finally {
  await browser?.close();
  await server?.close();
  release('T32-browser');
}
