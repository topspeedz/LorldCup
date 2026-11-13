// T44 QA C: world, stage, crowd and arena flows in the integrated app (all modules running together).
import { test, expect } from '@playwright/test';

async function openApp(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/Shader Error|VALIDATE_STATUS/.test(message.text())) errors.push(message.text()); });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      window.qaC={};
      for(const entry of modules){const original=entry.create;
        entry.create=ctx=>{const instance=original(ctx);qaC.ctx=ctx;qaC[entry.path]=instance;return instance;};}` });
  });
  await page.setViewportSize({ width: 960, height: 640 });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready, null, { timeout: 120_000 });
  await page.locator('#enter').click();
  return errors;
}

test('C world: west sea blocks walking and jumping; no lower-bowl route reaches the upper tier', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await openApp(page);
  const result = await page.evaluate(async () => {
    const { player } = qaC.ctx, boundaryX = qaC.ctx.config('environment').sea.boundaryX;
    const frame = () => new Promise(r => requestAnimationFrame(r));
    // Sea: approach the shoreline from the west plaza edge, walking and jumping.
    const sx = boundaryX + 6, sy = player.groundAt(sx, 0, 50) ?? player.groundAt(sx, 0, -1);
    player.teleport([sx, sy ?? 0, 0, 0]);
    let minX = Infinity;
    const seaStarted = performance.now();for (let i = 0; i < 120; i++) { if (i % 20 === 0) player.jump?.(); player.attempt(-.25, 0); player.update?.(1 / 60); minX = Math.min(minX, player.position.x); if (i % 30 === 0) await frame(); }
    // Upper tier: from 32 bearings in the lower bowl, push outward with jumps and record any foot inside the upper ring above 5 m.
    const isUpper = (x, z, y) => x * x / 61 ** 2 + z * z / 46 ** 2 > 1 && x * x / 85 ** 2 + z * z / 70 ** 2 < 1 && y > 5;
    const reached = [];let starts = 0, maxR = 0;
    for (let k = 0; k < 32; k++) {
      const a = k / 32 * Math.PI * 2, x = 36 * Math.cos(a), z = 26 * Math.sin(a), y = player.groundAt(x, z, 20);
      if (y == null) continue;
      starts++;player.teleport([x, y, z, 0]);
      for (let i = 0; i < 120; i++) {
        if (i % 6 === 0) player.jump?.();
        if (!player.attempt(.3 * Math.cos(a), .3 * Math.sin(a))) { player.attempt(.3 * Math.cos(a), 0);player.attempt(0, .3 * Math.sin(a)); }
        player.update?.(1 / 60);
        const p = player.position;maxR = Math.max(maxR, p.x * p.x / 61 ** 2 + p.z * p.z / 46 ** 2);if (isUpper(p.x, p.z, player.foot)) { reached.push([k, +p.x.toFixed(1), +player.foot.toFixed(1), +p.z.toFixed(1)]);break; }
      }
      await frame();
    }
    player.teleport('plaza');
    return { maxR: +maxR.toFixed(2), seaMs: Math.round(performance.now() - seaStarted), boundaryX, seaStart: sx, seaY: sy, minX, starts, reached };
  });
  console.log('QA-C world', JSON.stringify(result));
  expect(result.minX).toBeGreaterThan(result.boundaryX - .5);
  expect(result.starts).toBeGreaterThan(20);
  expect(result.reached).toEqual([]);
  // Visual evidence: west view (sea, moon, stars, beams) from the plaza.
  await page.evaluate(() => {
    const { cameraRig } = qaC.ctx;
    cameraRig.setOverride(camera => { camera.position.set(-120, 8, 30);camera.lookAt(-400, 40, -20); });
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: testInfo.outputPath('west-night.png') });
  await page.evaluate(() => qaC.ctx.cameraRig.setOverride(camera => { camera.position.set(-120, 4, 0);camera.lookAt(-400, 160, -280); }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: testInfo.outputPath('moon-sky.png') });
  expect(errors).toEqual([]);
});

test('C stage and crowd: monitors, players, beams and upper crowd keep running in the live loop', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await openApp(page);
  const result = await page.evaluate(async () => {
    const { scene } = qaC.ctx, players = arena.stagePlayers.players, crowd = arena.crowd;
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const beams = scene.getObjectByName('Sky_Show').children.filter(o => o.isMesh);
    const beamStart = beams.map(b => b.rotation.y);
    const seen = players.map(() => new Set()), sameMoments = [];let samples = 0;
    const monitorMaps = [scene.getObjectByName('REF_Reused_Monitor_pixels__cyan').material.map];
    const versionsStart = monitorMaps.map(m => m.version);
    const crowdTimes = [];
    for (let i = 0; i < 50; i++) {
      await wait(500);samples++;
      players.forEach((p, j) => seen[j].add(p.action));
      if (new Set(players.map(p => p.action)).size === 1) sameMoments.push(i);
      crowdTimes.push(crowd.time);
    }
    return {
      players: players.length, perPlayer: seen.map(s => [...s]), union: [...new Set(seen.flatMap(s => [...s]))].sort(), sameMoments, samples,
      beams: beams.length, beamMoved: beams.filter((b, i) => Math.abs(b.rotation.y - beamStart[i]) > 1e-4).length,
      beamAngles: beams.map(b => b.rotation.y),
      monitors: monitorMaps.length, monitorsAdvanced: monitorMaps.filter((m, i) => m.version > versionsStart[i]).length,
      crowdAdvancing: crowdTimes.at(-1) !== crowdTimes[0], upper: crowd.stats.upperSpectators, mannequins: crowd.mannequins.length,
      mannequinTriangles: crowd.mannequins.reduce((s, m) => s + (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3, 0),
    };
  });
  console.log('QA-C stage', JSON.stringify(result));
  expect(result.players).toBe(10);
  expect(result.union).toEqual(['hair', 'keyboard', 'look', 'mouse', 'shout']);
  for (const actions of result.perPlayer) expect(actions.length).toBeGreaterThan(1);
  expect(result.sameMoments).toEqual([]);
  expect(result.beams).toBe(3);
  expect(result.beamMoved).toBe(3);
  expect(result.monitors).toBe(1); // one merged mesh holds all ten screens (stage-monitors.spec checks the ten UV islands)
  expect(result.monitorsAdvanced).toBe(result.monitors);
  expect(result.upper).toBeGreaterThan(0);
  // Stage close-up for visual judgment of monitors and players.
  await page.evaluate(() => qaC.ctx.cameraRig.setOverride(camera => { camera.position.set(0, 3, 14);camera.lookAt(0, 1.5, 0); }));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: testInfo.outputPath('stage.png') });
  await page.evaluate(() => qaC.ctx.cameraRig.setOverride(camera => { camera.position.set(0, 1.7, 40);camera.lookAt(0, 12, -60); }));
  await page.waitForTimeout(1200);
  await page.screenshot({ path: testInfo.outputPath('upper-tier.png') });
  expect(errors).toEqual([]);
});

// T41 handed BL-0011 (3) to QA: floating seats, floor and stage props can only be judged on screen.
test('C arena: viewpoint captures for floating seats, props and stage furniture', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await openApp(page);
  const targets = ['Fix_SeatBases', 'Seats__', 'Plaza_bench', 'CCR_Lounge_table_tops', 'CCR_Standing_table_tops', 'CCR_Banquette_base', 'REF_DeskBody', 'REF_TeamRiser', 'Bench_legs', 'REF_Pedestal'];
  const shots = await page.evaluate(targets => {
    const { root, THREE } = qaC.ctx, out = [], rand = (i => () => (i = (i * 16807) % 2147483647) / 2147483647)(7);
    for (const prefix of targets) {
      const mesh = [];root.traverse(o => { if (o.isMesh && o.name.startsWith(prefix)) mesh.push(o); });
      if (!mesh.length) { out.push({ prefix, missing: true });continue; }
      const m = mesh[0], pos = m.geometry.attributes.position;
      for (let n = 0; n < 2; n++) {
        const v = new THREE.Vector3().fromBufferAttribute(pos, Math.floor(rand() * pos.count)).applyMatrix4(m.matrixWorld);
        const away = new THREE.Vector3(v.x, 0, v.z).normalize().multiplyScalar(-3.5);
        if (!isFinite(away.x)) away.set(3.5, 0, 0);
        const side = new THREE.Vector3(-away.z, 0, away.x).multiplyScalar(.6);
        out.push({ prefix, n, target: v.toArray(), eye: v.clone().add(away).add(side).add(new THREE.Vector3(0, .9, 0)).toArray() });
      }
    }
    return out;
  }, targets);
  for (const shot of shots) {
    if (shot.missing) continue;
    await page.evaluate(shot => qaC.ctx.cameraRig.setOverride(camera => { camera.position.fromArray(shot.eye);camera.lookAt(...shot.target); }), shot);
    await page.waitForTimeout(500);
    await page.screenshot({ path: testInfo.outputPath(`view-${shot.prefix.replace(/\W+/g, '_')}-${shot.n}.png`) });
  }
  // Moon: look along the configured moon direction from the plaza.
  await page.evaluate(() => qaC.ctx.cameraRig.setOverride(camera => {
    const d = qaC.ctx.config('environment').moon.direction;camera.position.set(-120, 4, 0);camera.lookAt(-120 + d[0] * 100, 4 + d[1] * 100, d[2] * 100);
  }));
  await page.waitForTimeout(800);
  await page.screenshot({ path: testInfo.outputPath('moon.png') });
  console.log('QA-C views', JSON.stringify(shots));
  expect(shots.filter(s => s.missing)).toEqual([]);
  expect(errors).toEqual([]);
});
