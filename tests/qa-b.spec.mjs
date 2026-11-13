// T43 QA B: character, team, emote and ticket flows in the integrated app, driven through the real UI where a user would.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';

const read = name => JSON.parse(readFileSync(new URL(`../web/config/${name}.json`, import.meta.url), 'utf8'));
const ticket = read('ticket'), teams = read('teams').teams, chars = read('characters'), seats = read('seats').seats;
const { x: bx, z: [z0, z1] } = ticket.barrier, midZ = (z0 + z1) / 2;
const emotes = [['cheer_clap', '박수 환호'], ['heart', '하트'], ['angry', '화내기'], ['egg_throw', '계란 던지기']];

// Installed before the app runs: event log and pose sampling of a rig.
const helpers = () => {
  if (window !== window.top) return; // not inside the YouTube iframe
  window.qaB = { events: [] };
  addEventListener('DOMContentLoaded', async () => {
    const { events } = await import('./events.js');
    for (const type of ['team:changed', 'character:changed', 'emote:request', 'emote:played', 'ticket:issued'])
      events.addEventListener(type, e => qaB.events.push({ type, detail: e.detail }));
  });
  qaB.rig = (avatar = arena.avatar) => avatar.children.find(o => o.getObjectByName?.('FanRig'));
  // Every bone's position relative to the avatar: a pose signature.
  qaB.pose = (avatar = arena.avatar) => {
    const rig = qaB.rig(avatar); if (!rig) return null;
    avatar.updateWorldMatrix(true, true);
    const inv = avatar.matrixWorld.clone().invert(), out = [];
    rig.traverse(o => { if (o.isBone) { const p = o.getWorldPosition(o.position.clone()).applyMatrix4(inv); out.push(p.x, p.y, p.z); } });
    return out;
  };
  qaB.diff = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
  qaB.count = type => qaB.events.filter(e => e.type === type).length;
  qaB.root = () => { let r = arena.avatar; while (r.parent) r = r.parent; return r; };
  // Peak displacement from `ref` over `ms` of live frames, plus egg flight and the pose at the peak.
  qaB.watch = async (ref, ms, avatar = arena.avatar) => {
    let max = 0, peak = null, eggFlew = false, finite = true; const end = performance.now() + ms, scene = qaB.root();
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      const p = qaB.pose(avatar); if (!p) continue;
      finite &&= p.every(Number.isFinite);
      const d = qaB.diff(p, ref); if (d > max) { max = d; peak = p; }
      eggFlew ||= scene.children.some(o => (o.name.startsWith('Prop_Egg') || o.name === 'EmoteFX_flight') && o.visible && (o.count ?? 1) > 0); // T18: one shared flight batch
    }
    return { max, peak, eggFlew, finite };
  };
};

async function open(page, { abort, url = '/' } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (abort) await page.route(abort, route => route.abort());
  await page.addInitScript(helpers);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url);
  await page.waitForFunction(() => window.arena?.ready, null, { timeout: 120_000 });
  await page.locator('#enter').click(); // first page (or invite page) → arena; sound comes on with this click
  return errors;
}
const characterSettled = page => page.waitForFunction(() => arena.character?.ready || arena.character?.error, null, { timeout: 90_000 });
const ticketDialog = page => page.getByRole('dialog', { name: '입장 티켓' });
const picker = page => page.getByRole('dialog', { name: '팀·캐릭터 선택' });
const emoteMenu = page => page.getByRole('dialog', { name: '감정표현' });
const walkEast = (page, x, z, steps = 40) => page.evaluate(([x, z, steps]) => {
  arena.go([x, -.02, z, -Math.PI / 2]);
  for (let i = 0; i < steps; i++) arena.attempt(.25, 0);
  return arena.state.x;
}, [x, z, steps]);
const pixelOfUniform = (page, id) => page.evaluate(id => {
  const body = qaB.rig()?.getObjectByName(id); let material;
  body?.traverse(o => { if (o.material?.name === 'Uniform') material = o.material; });
  if (!material?.map?.image) return null;
  const c = document.createElement('canvas').getContext('2d'); c.canvas.width = c.canvas.height = 64;
  c.drawImage(material.map.image, 0, 0, 64, 64); return Array.from(c.getImageData(20, 20, 1, 1).data);
}, id);

test('B ticket: real clicks — a team click in the centred ticket popup issues the card, then the entrance opens (T64: no emote step)', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors = await open(page);
  const readyAtArenaReady = await page.evaluate(() => arena.character?.ready === true), t0 = Date.now();
  await characterSettled(page);
  const characterLagMs = Date.now() - t0;
  expect(await page.evaluate(() => arena.character.error)).toBeNull();
  expect(await walkEast(page, bx - 2, midZ)).toBeLessThan(bx);
  await page.evaluate(([x, z]) => arena.go([x, -.02, z, -Math.PI / 2]), [bx - 2, midZ]);
  await expect(ticketDialog(page)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('1-ticket-open.png') });
  await expect(ticketDialog(page).getByRole('button', { name: /감정표현/ })).toHaveCount(0);
  await ticketDialog(page).getByRole('button', { name: teams[1].name, exact: true }).click();
  const card = ticketDialog(page).getByRole('img', { name: new RegExp(teams[1].name) });
  await expect(card).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('2-ticket-card.png') });
  await page.waitForFunction(() => qaB.count('ticket:issued') === 1);
  expect(await page.evaluate(() => qaB.count('emote:played'))).toBe(0);
  await expect.poll(() => walkEast(page, bx - 2, midZ)).toBeGreaterThan(bx + 1);
  console.log('QA-B ticket', JSON.stringify({ readyAtArenaReady, characterLagMs }));
  expect(errors).toEqual([]);
});

test('B emote menu: Alt opens 2x2; releasing Alt keeps it; Esc and Alt close; four distinct clips; egg flies and scream plays', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors = await open(page);
  await characterSettled(page);
  await page.evaluate(async () => {
    const THREE = await import('three');
    qaB.plays = 0; const play = THREE.PositionalAudio.prototype.play;
    THREE.PositionalAudio.prototype.play = function (...a) { if (this.parent?.name === 'head' && qaB.rig()?.getObjectByName('head') === this.parent) qaB.plays++; return play.apply(this, a); }; // local fan only
  });
  // BL-0034: no crowd-sound button; sound is on from 들어가기.
  await page.waitForFunction(() => arena.crowd?.sounding === true, null, { timeout: 10_000 });
  await page.waitForTimeout(1500); // scream buffer fetch
  await page.evaluate(() => arena.go('plaza'));
  const menu = emoteMenu(page);
  await page.keyboard.down('AltLeft');
  await expect(menu).toBeVisible();
  await page.keyboard.up('AltLeft');
  await page.waitForTimeout(300);
  await expect(menu).toBeVisible();
  const boxes = await menu.getByRole('button').evaluateAll(bs => bs.map(b => { const r = b.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }));
  await page.screenshot({ path: testInfo.outputPath('emote-menu-2x2.png') });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await page.keyboard.press('AltLeft');
  await expect(menu).toBeVisible();
  await page.keyboard.press('AltLeft');
  await expect(menu).toBeHidden();

  const idle = await page.evaluate(() => qaB.pose());
  const result = {};
  for (const [id, label] of emotes) {
    await page.waitForTimeout(500);
    await page.keyboard.press('AltLeft');
    await menu.getByRole('button', { name: label }).click();
    await expect(menu).toBeHidden();
    await page.waitForFunction(id => qaB.events.at(-1)?.type === 'emote:played' && qaB.events.at(-1).detail.id === id, id, { timeout: 5000 });
    const playsBefore = await page.evaluate(() => qaB.plays);
    result[id] = await page.evaluate(idle => qaB.watch(idle, 4000), idle);
    result[id].screams = await page.evaluate(() => qaB.plays) - playsBefore;
    if (id === 'egg_throw') await page.screenshot({ path: testInfo.outputPath('egg-throw-end.png') });
  }
  const peaks = Object.fromEntries(Object.entries(result).map(([id, r]) => [id, { max: +r.max.toFixed(3), eggFlew: r.eggFlew, screams: r.screams, finite: r.finite }]));
  const ids = emotes.map(e => e[0]), distinct = [];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) distinct.push([ids[i], ids[j], +(await page.evaluate(([a, b]) => qaB.diff(a, b), [result[ids[i]].peak, result[ids[j]].peak])).toFixed(3)]);
  console.log('QA-B emotes', JSON.stringify({ boxes, peaks, distinct }));
  expect(boxes).toHaveLength(4);
  expect(new Set(boxes.map(b => b[0])).size).toBe(2);
  expect(new Set(boxes.map(b => b[1])).size).toBe(2);
  for (const id of ids) { expect(result[id].max).toBeGreaterThan(.1); expect(result[id].finite).toBe(true); }
  for (const [, , d] of distinct) expect(d).toBeGreaterThan(.05);
  expect(result.egg_throw.eggFlew).toBe(true);
  expect(result.egg_throw.screams).toBeGreaterThan(0);
  for (const id of ['cheer_clap', 'heart', 'angry']) expect(result[id].eggFlew).toBe(false);
  expect(errors).toEqual([]);
});

test('B character and team: four bodies, team uniforms painted on the body mesh, switching back; walk, run, jump and sit play for every body', async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  const errors = await open(page);
  await characterSettled(page);
  await page.click('#team-select-open');
  const dialog = picker(page);
  await expect(dialog).toBeVisible();
  // Uniform must be a material of the body mesh itself, not a separate garment mesh.
  const structure = await page.evaluate(ids => ids.map(id => {
    const body = qaB.rig().getObjectByName(id), meshes = [];
    body.traverse(o => { if (o.isMesh) meshes.push({ name: o.name, materials: [].concat(o.material).map(m => m.name) }); });
    return { id, meshes };
  }), chars.ids);
  const pixels = {}, visible = {};
  for (const id of chars.ids) {
    await dialog.getByRole('button', { name: chars.names[id], exact: true }).click();
    visible[id] = await page.evaluate(ids => ids.filter(c => qaB.rig().getObjectByName(c).visible), chars.ids);
    for (const t of [teams[0], teams[1], teams[0]]) {
      await dialog.getByRole('button', { name: t.name, exact: true }).click();
      (pixels[id] ??= []).push(await pixelOfUniform(page, id));
    }
  }
  await dialog.getByRole('button', { name: '팀·캐릭터 선택 닫기' }).click();
  await page.screenshot({ path: testInfo.outputPath('character-geng.png') });
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  // Locomotion and sit for each body.
  const loco = {};
  for (const id of chars.ids) {
    await page.click('#team-select-open'); // always shown in #dock (mouse-first)
    await dialog.getByRole('button', { name: chars.names[id], exact: true }).click();
    await dialog.getByRole('button', { name: '팀·캐릭터 선택 닫기' }).click();
    await page.evaluate(() => arena.go('plaza'));
    await page.waitForTimeout(400);
    const idle = await page.evaluate(() => qaB.pose());
    loco[id] = await page.evaluate(async idle => {
      const r = {}, frame = () => new Promise(requestAnimationFrame);
      for (const [name, step] of [['walk', .06], ['run', .14]]) {
        let max = 0;
        for (let i = 0; i < 60; i++) { arena.attempt(0, step); await frame(); max = Math.max(max, qaB.diff(qaB.pose(), idle)); }
        r[name] = +max.toFixed(3); arena.go('plaza'); for (let i = 0; i < 20; i++) await frame();
      }
      return r;
    }, idle);
    // Jump through the key, like a user.
    await page.locator('canvas').first().dispatchEvent('pointerdown', { pointerId: 1, isPrimary: true });
    await page.keyboard.press('Space');
    loco[id].jump = +(await page.evaluate(idle => qaB.watch(idle, 700), idle)).max.toFixed(3);
    await page.keyboard.press('Escape');
    // Sit at the first seat with E.
    const s = seats[0].position;
    await page.evaluate(([x, y, z]) => arena.go([x + .8, y, z, 0]), s);
    await page.waitForTimeout(300);
    const standing = await page.evaluate(() => qaB.pose());
    await page.keyboard.press('KeyE');
    const sit = await page.evaluate(standing => qaB.watch(standing, 1200), standing);
    loco[id].sit = +sit.max.toFixed(3);
    loco[id].sitHeadDrop = +(await page.evaluate(([a, b]) => {
      const head = qaB.rig().getObjectByName('head'), i = []; qaB.rig().traverse(o => { if (o.isBone) i.push(o); });
      const k = i.indexOf(head) * 3 + 1; return a[k] - b[k];
    }, [standing, sit.peak])).toFixed(3);
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(300);
  }
  console.log('QA-B character', JSON.stringify({ structure, visible, pixels, loco }));
  for (const id of chars.ids) {
    expect(visible[id]).toEqual([id]);
    expect(pixels[id].map(p => p?.slice(0, 3))).toEqual([hex(teams[0].color), hex(teams[1].color), hex(teams[0].color)]);
    for (const k of ['walk', 'run', 'jump', 'sit']) expect(loco[id][k]).toBeGreaterThan(.05);
    expect(loco[id].sitHeadDrop).toBeGreaterThan(.2);
  }
  expect(errors).toEqual([]);
});

test('B ticket bypass: walking and jumping around the whole building finds no way into the lobby or bowl before a ticket', async ({ page }, testInfo) => {
  test.setTimeout(600_000);
  const errors = await open(page);
  const result = await page.evaluate(async ([bx]) => {
    const frame = () => new Promise(requestAnimationFrame), found = [];
    // Inside = lobby (between the inner curtain wall and the bowl) or down in the bowl.
    const inside = (x, z, y) => Math.hypot(x + 83, z) < 10 || y < -3; // lobby spawn area or the bowl (the outer wall curves, so a box is wrong)
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, isPrimary: true })); // #enter already enabled walking
    let starts = 0, ends = [];
    for (let k = 0; k < 96; k++) {
      const a = k / 96 * Math.PI * 2;
      let sx, sz, sy = null;
      for (const r of [160, 145, 130, 120]) { sx = 130 * Math.cos(a) * (r / 130) - 10; sz = 110 * Math.sin(a) * (r / 130); sy = arena.groundAt(sx, sz, 0); if (sy != null) break; }
      if (sy == null) continue;
      for (const [tx, tz] of [[-83, 0], [0, 0]]) {
        starts++; arena.go([sx, sy, sz, 0]);
        let hit = null, detour = 0, side = 1;
        for (let i = 0; i < 1200 && !hit; i++) {
          const p = arena.player; let dx = tx - p.x, dz = tz - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          if (detour > 0) { [dx, dz] = [-dz * side, dx * side]; detour--; } // follow the wall for a while
          if (i % 15 === 0) document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
          if (!arena.attempt(dx * .25, dz * .25) && !arena.attempt(dx * .25, 0) && !arena.attempt(0, dz * .25)) { detour = 40; side = (i / 40 | 0) % 2 ? 1 : -1; }
          if (inside(p.x, p.z, arena.state.y)) hit = [k, tx, +p.x.toFixed(1), +p.z.toFixed(1), +arena.state.y.toFixed(1)];
          if (i % 10 === 0) await frame();
        }
        if (hit) found.push(hit);
        ends.push([+arena.player.x.toFixed(0), +arena.player.z.toFixed(0)]);
      }
    }
    // Direct pushes east past both ends of the outer glass.
    for (const z of [61, 64, 70, -63, -66, -72]) for (let dz of [0, .1, -.1]) {
      starts++; arena.go([-110, 0, z, 0]);
      for (let i = 0; i < 400; i++) { arena.attempt(.25, dz); const p = arena.player; if (inside(p.x, p.z, arena.state.y)) { found.push(['glass-end', z, +p.x.toFixed(1), +p.z.toFixed(1)]); break; } if (i % 10 === 0) await frame(); }
      ends.push([+arena.player.x.toFixed(0), +arena.player.z.toFixed(0)]);
    }
    arena.go('plaza');
    return { starts, found, ends };
  }, [bx]);
  console.log('QA-B bypass', JSON.stringify(result));
  expect(result.starts).toBeGreaterThan(60);
  expect(result.found).toEqual([]);
  expect(errors).toEqual([]);
});

// B-M-2 (clip file fails, an emote pick still finishes the ticket) was removed with the emote step (T64): the ticket no longer needs an emote.

test('B remote: in a real room the guest’s character, team uniform and emote show on the host', async ({ browser }) => {
  test.setTimeout(300_000);
  // T15/decision 11: no "방 만들기" any more — #enter places the host in room 01, the guest follows the invite key.
  // Rooms run on a local PeerServer as in qa-x (V01 method); the app's PeerJS Cloud setting is untouched.
  const require = createRequire(new URL('../_workspace/qa/2026-11-12-webrtc-20-validation/V01/package.json', import.meta.url));
  const app = require('express')(), server = createServer(app);
  app.use('/signal', require('peer').ExpressPeerServer(server, { path: '/', allow_discovery: false }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const local = async context => context.route(/\/vendor\/peerjs\.min\.js$/, async route => {
    const body = await (await route.fetch()).text();
    route.fulfill({ contentType: 'text/javascript', body: body + `
;(()=>{const N=window.Peer;window.Peer=function(id,o){if(id&&typeof id==='object'){o=id;id=undefined;}
return new N(id,{...o,host:'127.0.0.1',port:${port},path:'/signal/',secure:false});};window.Peer.prototype=N.prototype;})();` });
  });
  const hostContext = await browser.newContext(), guestContext = await browser.newContext();
  await local(hostContext); await local(guestContext);
  const host = await hostContext.newPage(), guest = await guestContext.newPage();
  try {
    const errors = [...await open(host)];
    await characterSettled(host);
    await host.waitForFunction(() => arena.multiplayer.room, null, { timeout: 30_000 });
    const code = await host.evaluate(() => arena.multiplayer.room.code);
    errors.push(...await open(guest, { url: '/?room=' + code }));
    await characterSettled(guest);
    await guest.waitForFunction(() => arena.multiplayer.count === 2, null, { timeout: 30_000 });
    await guest.click('#team-select-open');
    await picker(guest).getByRole('button', { name: teams[0].name, exact: true }).click();
    await picker(guest).getByRole('button', { name: chars.names.fan_f2, exact: true }).click();
    await picker(guest).getByRole('button', { name: '팀·캐릭터 선택 닫기' }).click();
    const peerId = await guest.evaluate(() => arena.multiplayer.peerId);
    const look = () => host.evaluate(peerId => {
      const a = arena.multiplayer.avatarOf(peerId), rig = a && qaB.rig(a); if (!rig) return null;
      return { visible: ['fan_f1', 'fan_f2', 'fan_m1', 'fan_m2'].filter(id => rig.getObjectByName(id).visible) };
    }, peerId);
    await expect.poll(look, { timeout: 20_000 }).toEqual({ visible: ['fan_f2'] });
    const idle = await host.evaluate(peerId => qaB.pose(arena.multiplayer.avatarOf(peerId)), peerId);
    await guest.keyboard.press('AltLeft');
    await emoteMenu(guest).getByRole('button', { name: '하트' }).click();
    const seen = await host.evaluate(([peerId, idle]) => qaB.watch(idle, 4000, arena.multiplayer.avatarOf(peerId)), [peerId, idle]);
    const state = await host.evaluate(peerId => arena.multiplayer.peers.find(p => p.peerId === peerId), peerId);
    console.log('QA-B remote', JSON.stringify({ max: seen.max, state }));
    expect(state).toMatchObject({ team: teams[0].id, character: 'fan_f2', emote: 'heart', emoteSeq: 1 });
    expect(seen.max).toBeGreaterThan(.1);
    expect(errors).toEqual([]);
  } finally { await hostContext.close(); await guestContext.close(); server.close(); }
});

test('B bypass probe: from the north plaza side, walking south then toward the lobby centre, with no ticket', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await open(page);
  const trail = [];
  for (const [sx, sz] of [[-88, 75], [-92, 75], [-88, -75]]) {
    const r = await page.evaluate(async ([sx, sz]) => {
      const y = arena.groundAt(sx, sz, 0); if (y == null) return { sx, sz, noGround: true };
      arena.go([sx, y, sz, Math.PI]); const pts = [], frame = () => new Promise(requestAnimationFrame);
      const toward = (tx, tz, n) => { for (let i = 0; i < n; i++) { const p = arena.player, dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz) || 1;
        if (!arena.attempt(dx / l * .2, dz / l * .2)) { arena.attempt(dx / l * .2, 0); arena.attempt(0, dz / l * .2); } } };
      for (const [tx, tz] of [[sx, 0], [-83, 0], [-60, 0], [-25, 0]]) { toward(tx, tz, 500); await frame(); pts.push([+arena.player.x.toFixed(1), +arena.player.z.toFixed(1), +arena.state.y.toFixed(1)]); }
      return { sx, sz, pts };
    }, [sx, sz]);
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath(`probe-${sx}_${sz}.png`) });
    trail.push(r);
  }
  console.log('QA-B probe', JSON.stringify(trail));
  for (const r of trail) for (const [x, z, y] of r.pts ?? []) expect(Math.hypot(x + 83, z) < 10 || y < -3, `reached ${x},${z},${y}`).toBe(false);
  expect(errors).toEqual([]);
});

test('B-H-1: the walker that starts north of the building (k=32) must not reach the lobby without a ticket', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors = await open(page);
  const run = () => page.evaluate(async () => {
    const frame = () => new Promise(requestAnimationFrame), a = 32 / 96 * Math.PI * 2, r = 160;
    const sx = r * Math.cos(a) - 10, sz = 110 * Math.sin(a) * (r / 130), sy = arena.groundAt(sx, sz, 0);
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown'));
    arena.go([sx, sy, sz, 0]);
    const trail = [], [tx, tz] = [-83, 0]; let detour = 0, side = 1, hit = null;
    for (let i = 0; i < 1200 && !hit; i++) {
      const p = arena.player; let dx = tx - p.x, dz = tz - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (detour > 0) { [dx, dz] = [-dz * side, dx * side]; detour--; }
      if (i % 15 === 0) document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
      if (!arena.attempt(dx * .25, dz * .25) && !arena.attempt(dx * .25, 0) && !arena.attempt(0, dz * .25)) { detour = 40; side = (i / 40 | 0) % 2 ? 1 : -1; }
      if (i % 20 === 0) trail.push([i, +p.x.toFixed(1), +p.z.toFixed(1), +arena.state.y.toFixed(1)]);
      if (Math.hypot(p.x + 83, p.z) < 10 || arena.state.y < -3) hit = [i, +p.x.toFixed(1), +p.z.toFixed(1), +arena.state.y.toFixed(1)];
      if (i % 10 === 0) await frame();
    }
    return { start: [+sx.toFixed(1), +sz.toFixed(1)], hit, trail };
  });
  const results = [];
  for (let n = 0; n < 3; n++) {
    results.push(await run());
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath(`b-h-1-end-${n}.png`) });
  }
  console.log('QA-B B-H-1', JSON.stringify(results));
  expect(results.map(r => r.hit)).toEqual([null, null, null]);
  expect(errors).toEqual([]);
});

// T53 recheck B-H-1: the same wall-following walker from the north plaza (k=32) and its mirror from the south (z negated).
test('B-H-1 recheck: north walker and its south mirror do not reach the lobby without a ticket', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = await open(page);
  const results = {};
  for (const [side, sign] of [['북', 1], ['남', -1]]) {
    results[side] = await page.evaluate(async sign => {
      const frame = () => new Promise(requestAnimationFrame), a = 32 / 96 * Math.PI * 2, r = 160;
      // The exact south mirror (-90, -117.2) cannot take a first step, so fall back to the next start on the same line toward the corridor.
      const starts = [[r * Math.cos(a) - 10, sign * 110 * Math.sin(a) * (r / 130)], [-88, sign * 90], [-88, sign * 75]];
      let sx, sz, sy;
      for ([sx, sz] of starts) {
        sy = arena.groundAt(sx, sz, 0); if (sy == null) continue;
        arena.go([sx, sy, sz, 0]);
        if (arena.attempt(0, -sign * .25)) { arena.go([sx, sy, sz, 0]); break; }
        sy = null;
      }
      if (sy == null) return { start: [sx, sz], noGround: true };
      document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown'));
      const [tx, tz] = [-83, 0]; let detour = 0, side = 1, hit = null, i = 0;
      for (; i < 1200 && !hit; i++) {
        const p = arena.player; let dx = tx - p.x, dz = tz - p.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        if (detour > 0) { [dx, dz] = [-dz * side, dx * side]; detour--; }
        if (i % 15 === 0) document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        if (!arena.attempt(dx * .25, dz * .25) && !arena.attempt(dx * .25, 0) && !arena.attempt(0, dz * .25)) { detour = 40; side = (i / 40 | 0) % 2 ? 1 : -1; }
        if (Math.hypot(p.x + 83, p.z) < 10 || arena.state.y < -3) hit = [i, +p.x.toFixed(1), +p.z.toFixed(1), +arena.state.y.toFixed(1)];
        if (i % 10 === 0) await frame();
      }
      const s = arena.state;
      return { start: [+sx.toFixed(1), +sz.toFixed(1)], hit, steps: i, end: [s.x, s.y, s.z].map(n => +n.toFixed(2)), ticket: qaB.count('ticket:issued') };
    }, sign);
    await page.waitForTimeout(600);
    await page.screenshot({ path: fileURLToPath(new URL(`../_workspace/_run/2026-11-12-requirements-build/screens/T53-B-H-1-${side}-end.png`, import.meta.url)) });
  }
  console.log('T53 B-H-1', JSON.stringify(results));
  for (const [side, r] of Object.entries(results)) {
    expect(r.noGround, `${side}: start has ground`).toBeFalsy();
    expect(r.ticket, `${side}: no ticket issued`).toBe(0);
    expect(r.hit, `B-H-1 ${side}: reached the lobby or bowl`).toBeNull();
    const [x, , z] = r.end;
    expect(Math.hypot(x - r.start[0], z - r.start[1]), `${side}: the walker actually moved`).toBeGreaterThan(5);
    expect(x > -103.99 && Math.abs(z) < 59.21, `B-H-1 ${side}: ended past the glass line at ${r.end}`).toBe(false);
  }
  expect(errors).toEqual([]);
});
