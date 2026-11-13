// T61 재검 P: P-H-1(FPS)·P-H-2(텍스처 메모리)를 T49 조건(1920×1080, DPR 1, ANGLE D3D11 하드웨어)에서 다시 잰다.
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import launcher from '../.claude/scripts/browser/launch.cjs';

test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
  launchOptions: { args: launcher.gpuProfile().args } });
test.setTimeout(420_000);
const screens = resolve('_workspace/_run/2026-11-12-requirements-build/screens');
mkdirSync(screens, { recursive: true });
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

// Counts every texture the app actually allocates on the GPU (storage, uploads, mips, deletes) — a lower bound like T49.
const trackTextures = () => {
  const P = WebGL2RenderingContext.prototype, live = new Map(), bound = new Map(), unknown = new Set();
  let unit = 0x84C0;
  const BPP = { 0x8058: 4, 0x8C43: 4, 0x1908: 4, 0x1907: 4, 0x8051: 4, 0x8C41: 4, 0x881A: 8, 0x881B: 8, 0x8814: 16, 0x8815: 16,
    0x8229: 1, 0x822B: 2, 0x822D: 2, 0x822E: 4, 0x822F: 4, 0x8230: 8, 0x81A5: 2, 0x81A6: 4, 0x8CAC: 4, 0x88F0: 4, 0x8CAD: 8,
    0x1909: 1, 0x1906: 1, 0x190A: 2, 0x8D70: 16, 0x8236: 4, 0x8C3A: 4, 0x8C3D: 4, 0x8059: 4 };
  const bpp = f => BPP[f] ?? (unknown.add(f), 4);
  const isFace = t => t >= 0x8515 && t <= 0x851A;
  const texOf = target => bound.get(`${unit}:${isFace(target) ? 0x8513 : target}`);
  const entry = tex => { if (!live.has(tex)) live.set(tex, { levels: new Map(), storage: 0 }); return live.get(tex); };
  const wrap = (name, fn) => { const original = P[name]; P[name] = function (...args) { fn.apply(this, args); return original.apply(this, args); }; };
  wrap('activeTexture', u => { unit = u; });
  wrap('bindTexture', (target, tex) => bound.set(`${unit}:${target}`, tex));
  wrap('deleteTexture', tex => live.delete(tex));
  const storage = (target, levels, fmt, w, h, d) => {
    const tex = texOf(target); if (!tex) return;
    let bytes = 0;
    for (let l = 0; l < levels; l++) bytes += Math.max(1, w >> l) * Math.max(1, h >> l) * (target === 0x8C1A ? d : Math.max(1, d >> l)) * bpp(fmt);
    entry(tex).storage = bytes * (target === 0x8513 ? 6 : 1);
  };
  wrap('texStorage2D', (target, levels, fmt, w, h) => storage(target, levels, fmt, w, h, 1));
  wrap('texStorage3D', (target, levels, fmt, w, h, d) => storage(target, levels, fmt, w, h, d));
  wrap('texImage2D', function (target, level, fmt, ...rest) {
    const tex = texOf(target); if (!tex) return;
    let w, h;
    if (rest.length >= 6) [w, h] = rest; else { const s = rest[2]; w = s?.videoWidth || s?.naturalWidth || s?.width || 0; h = s?.videoHeight || s?.naturalHeight || s?.height || 0; }
    entry(tex).levels.set(`${target}:${level}`, { w, h, d: 1, fmt });
  });
  wrap('texImage3D', (target, level, fmt, w, h, d) => { const tex = texOf(target); if (tex) entry(tex).levels.set(`${target}:${level}`, { w, h, d, fmt }); });
  wrap('compressedTexImage2D', (target, level, fmt, w, h, border, data) => {
    const tex = texOf(target); if (tex) entry(tex).levels.set(`${target}:${level}`, { bytes: data?.byteLength || 0 });
  });
  wrap('generateMipmap', target => {
    const tex = texOf(target); if (!tex || !live.has(tex)) return;
    const e = live.get(tex);
    for (const [key, base] of [...e.levels]) {
      const [face, level] = key.split(':').map(Number); if (level !== 0 || base.bytes !== undefined) continue;
      for (let l = 1; (base.w >> (l - 1)) > 1 || (base.h >> (l - 1)) > 1; l++)
        e.levels.set(`${face}:${l}`, { w: Math.max(1, base.w >> l), h: Math.max(1, base.h >> l), d: base.d, fmt: base.fmt });
    }
  });
  window.__textureMemory = () => {
    let bytes = 0; const sizes = [];
    for (const e of live.values()) {
      let b = e.storage;
      if (!b) for (const l of e.levels.values()) b += l.bytes ?? l.w * l.h * l.d * bpp(l.fmt);
      bytes += b; sizes.push(b);
    }
    sizes.sort((a, b) => b - a);
    return { textures: live.size, mib: bytes / 1048576, largestMiB: sizes.slice(0, 12).map(b => +(b / 1048576).toFixed(3)), unknownFormats: [...unknown] };
  };
};

const exposeContext = (page, frozen) => page.route('**/modules.js', async route => {
  const response = await route.fetch();
  await route.fulfill({ response, body: `${await response.text()}
    for(const entry of modules){const original=entry.create;entry.create=ctx=>{
      window.perfContext=ctx;const instance=original(ctx),update=instance.update?.bind(instance);
      if(update)instance.update=(dt,now)=>update(${frozen ? '0,0' : 'dt,now'});return instance;
    };}` });
});
const seedRandom = page => page.addInitScript(() => { let seed = 61; Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); });
const open = async page => {
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready && arena.character?.ready && window.perfContext, null, { timeout: 120_000 });
};

test('P-H-1·P-H-2: FPS median ≥ 60 in arena and lobby, texture memory lower bound < 500 MiB', async ({ page }) => {
  const errors = [], results = {};
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/THREE.WebGLProgram: Shader Error/.test(message.text())) errors.push(message.text()); });
  await seedRandom(page);await page.addInitScript(trackTextures);await exposeContext(page, false);
  await open(page);
  const gpu = await page.evaluate(() => {
    const { renderer } = perfContext, gl = renderer.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
    return { renderer: debug && gl.getParameter(debug.UNMASKED_RENDERER_WEBGL), width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, dpr: renderer.getPixelRatio() };
  });
  expect(gpu).toMatchObject({ width: 1920, height: 1080, dpr: 1 });
  expect(gpu.renderer).toMatch(/ANGLE.*Direct3D11/i);
  expect(gpu.renderer).not.toMatch(/SwiftShader|software|llvmpipe/i);
  // Key actions (E 앉기) start only after app:enter (web/input.js:40). T47 원인 4; the FPS assertions are unchanged.
  await page.locator('#enter').click();
  await page.waitForFunction(() => document.body.classList.contains('walking'));
  const places = [
    { key: 'plaza', name: '광장', go: 'plaza' }, { key: 'lobby', name: '로비', go: 'lobby' },
    { key: 'arena', name: '경기장', go: 'arena' }, { key: 'seat', name: '첫좌석', seat: 'lower-entry-north-01' },
  ];
  for (const place of places) {
    if (place.seat) {
      const seat = await page.evaluate(id => { const { seats } = perfContext.config('seats'); return seats.find(s => s.id === id) || seats[0]; }, place.seat);
      await page.evaluate(seat => perfContext.player.teleport([...seat.position, 0]), seat);
      await page.keyboard.press('KeyE');
      await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seat.id);
      place.seatId = seat.id;
    } else await page.evaluate(place => arena.go(place), place.go);
    await page.waitForTimeout(5000);
    results[place.key] = await page.evaluate(async () => {
      const samples = [];
      for (let round = 0; round < 3; round++) {
        const intervals = []; let start, last;
        await new Promise(done => {
          const frame = now => { if (start === undefined) start = now; else intervals.push(now - last); last = now;
            if (now - start >= 5000) done(); else requestAnimationFrame(frame); };
          requestAnimationFrame(frame);
        });
        const sorted = [...intervals].sort((a, b) => a - b);
        samples.push({ fps: +(intervals.length * 1000 / (last - start)).toFixed(2), p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)], max: sorted.at(-1) });
      }
      // Distance representation: near chunks hold real models and hide their cards, far chunks show pictures only.
      const lod = arena.crowd.lod, show = lod?.impostors.geometry.getAttribute('crowdShow');
      const lodState = lod && { near: lod.chunks.filter(c => c.near).length, chunks: lod.chunks.length,
        consistent: lod.chunks.every(c => c.near ? c.details.length > 0 && c.seats.every(s => show.getX(s.card) === 0)
          : c.details.length === 0 && c.seats.every(s => show.getX(s.card) === 1)) };
      return { samples, camera: arena.camera.position.toArray().map(v => +v.toFixed(4)), fov: arena.camera.fov,
        drawCalls: arena.state.drawCalls, triangles: arena.state.triangles, infoTextures: perfContext.renderer.info.memory.textures,
        memory: window.__textureMemory(), lod: lodState };
    });
    results[place.key].median = median(results[place.key].samples.map(s => s.fps));
    if (place.name !== '첫좌석') await page.screenshot({ path: resolve(screens, `T61-${place.name}.png`) });
  }
  if (results.seat) await page.keyboard.press('KeyE');
  console.log('T61 P', JSON.stringify({ gpu, results }));
  writeFileSync(resolve(screens, 'T61-metrics.json'), JSON.stringify({ gpu, results }, null, 2));
  expect(errors).toEqual([]);
  for (const r of Object.values(results)) expect.soft(r.lod?.consistent, 'crowd near/far representation').toBe(true);
  expect.soft(results.arena.median, 'P-H-1 arena median FPS').toBeGreaterThanOrEqual(60);
  expect.soft(results.lobby.median, 'P-H-1 lobby median FPS').toBeGreaterThanOrEqual(60);
  expect.soft(results.arena.memory.mib, 'P-H-2 arena texture memory MiB').toBeLessThan(500);
  expect.soft(Math.max(...Object.values(results).map(r => r.memory.mib)), 'P-H-2 max texture memory MiB').toBeLessThan(500);
});

test('T59 observation: floor and foreground stay drawn after fresh start, plaza→lobby→arena and arena re-entry (3 loads)', async ({ page }) => {
  const shots = {}, diffs = [];
  await seedRandom(page);await exposeContext(page, true);
  const capture = async label => {
    await page.waitForTimeout(1500);
    await page.screenshot({ path: resolve(screens, `T61-visual-${label}.png`) });
    return page.evaluate(() => {
      const { renderer, scene, camera, THREE } = perfContext, target = new THREE.WebGLRenderTarget(480, 270);
      renderer.setRenderTarget(target);renderer.render(scene, camera);
      const data = new Uint8Array(480 * 270 * 4);renderer.readRenderTargetPixels(target, 0, 0, 480, 270, data);
      renderer.setRenderTarget(null);target.dispose();
      let s = '';for (let i = 0; i < data.length; i += 8192) s += String.fromCharCode(...data.subarray(i, i + 8192));
      return btoa(s);
    });
  };
  for (let round = 1; round <= 3; round++) {
    await open(page);
    await page.evaluate(() => { arena.crowd.setPaused(true);arena.crowd.seek(0);document.querySelector('#panel').style.display = 'none'; });
    const views = {};
    views.fresh = await capture(`r${round}-fresh`);
    for (const place of ['plaza', 'lobby', 'arena']) await page.evaluate(p => { perfContext.cameraRig.setOverride(null);arena.go(p); }, place);
    views.arena = await capture(`r${round}-arena`);
    await page.evaluate(() => arena.go('lobby'));await page.waitForTimeout(800);
    await page.evaluate(() => arena.go('arena'));
    views.reentry = await capture(`r${round}-reentry`);
    for (const [view, b64] of Object.entries(views)) (shots[view === 'reentry' ? 'arena' : view] ||= []).push({ round, view, b64 });
  }
  for (const [group, list] of Object.entries(shots)) {
    const ref = Buffer.from(list[0].b64, 'base64');
    for (const { round, view, b64 } of list.slice(1)) {
      const cur = Buffer.from(b64, 'base64');let changed = 0;
      for (let i = 0; i < ref.length; i += 4) if (Math.max(Math.abs(ref[i] - cur[i]), Math.abs(ref[i + 1] - cur[i + 1]), Math.abs(ref[i + 2] - cur[i + 2])) > 24) changed++;
      diffs.push({ group, round, view, changedFraction: changed / (ref.length / 4) });
    }
  }
  console.log('T61 visual', JSON.stringify(diffs));
  for (const d of diffs) expect.soft(d.changedFraction, `${d.view} r${d.round} vs r1 ${d.group}`).toBeLessThan(.02);
});
