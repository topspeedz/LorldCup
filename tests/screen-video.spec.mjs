import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../web/config/screen.json', import.meta.url)));
const now = Date.parse('2026-11-12T13:14:30+09:00');
const roundStart = Date.parse('2026-11-12T13:10:00+09:00');

async function fakeYouTube(page, { api = false } = {}) {
  const install = () => {
    window.ytCalls = [];
    window.YT = { Player: class {
      constructor(element, options) {
        this.options = options; this.time = options.playerVars?.start || 0;
        this.duration = 3600; this.state = -1; this.muted = true;
        this.id = options.videoId; window.ytPlayer = this;
        const target = typeof element === 'string' ? document.getElementById(element) : element;
        this.iframe = target.tagName === 'IFRAME' ? target : document.createElement('iframe');
        if (this.iframe !== target) target.replaceWith(this.iframe);
        if (!this.iframe.src) this.iframe.src = 'https://www.youtube.com/embed/' + this.id + '?' + new URLSearchParams(options.playerVars);
        this.iframe.style.cssText = 'width:100%;height:100%;border:0';
        const ready = () => options.events.onReady({ target: this });
        if (window.ytReadyDelay) setTimeout(ready, window.ytReadyDelay); else queueMicrotask(ready);
      }
      emit(data) { this.state = data; this.options.events.onStateChange({ target: this, data }); }
      playVideo() { ytCalls.push(['play']); this.emit(1); }
      pauseVideo() { ytCalls.push(['pause']); this.emit(2); }
      stopVideo() { this.pauseVideo(); }
      seekTo(value) { ytCalls.push(['seek', value]); this.time = value; }
      cueVideoById({ videoId, startSeconds = 0 }) { this.id = videoId; this.time = startSeconds; this.emit(5); }
      loadVideoById(options) { this.cueVideoById(options); this.playVideo(); }
      getCurrentTime() { return this.time; }
      getDuration() { return this.duration; }
      getPlayerState() { return this.state; }
      getVideoData() { return { video_id: this.id }; }
      getIframe() { return this.iframe; }
      mute() { this.muted = true; ytCalls.push(['mute']); }
      unMute() { this.muted = false; ytCalls.push(['unmute']); }
      isMuted() { return this.muted; }
      setVolume(value) { ytCalls.push(['volume', value]); }
      destroy() { this.iframe.remove(); ytCalls.push(['destroy']); }
    } };
  };
  if (api) await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType: 'text/javascript', body: `(${install})();window.onYouTubeIframeAPIReady?.();` }));
  else await page.addInitScript(install);
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#146ca4">YouTube test double</body>' }));
}

async function harness(page, { fake = true, source = 'vod', live = config.live, room = null, schedule = [], settings = true } = {}) {
  if (fake) await fakeYouTube(page);
  await page.clock.setFixedTime(now);
  await page.route('**/screen-video-harness', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <style>body{margin:0}#css-layer,canvas,#ui-root{position:fixed;inset:0}#css-layer{pointer-events:none}canvas{z-index:0}#ui-root{pointer-events:none;z-index:1}#ui-root>*{pointer-events:auto}#overlap-probe{position:fixed;left:50%;top:50%}</style>
    <script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>
    <div id="css-layer"></div><div id="ui-root">${settings ? '<div id="settings" style="position:fixed;right:12px;bottom:12px;width:240px"></div>' : ''}</div><div id="overlap-probe">+</div><button id="enter" style="position:fixed;right:0;bottom:0">입장</button>
    <script type="module">
      import * as THREE from '/vendor/three.module.js';
      import {create,roundPosition} from '/screen-video.js';
      const scene=new THREE.Scene();scene.background=new THREE.Color('#192633');
      const root=new THREE.Group();scene.add(root);
      for(let i=0;i<4;i++){
        const face=new THREE.Mesh(new THREE.PlaneGeometry(13.6,4),new THREE.MeshBasicMaterial({color:'#ac6025'}));
        face.name='REF_Jumbotron_'+i;face.rotation.y=i*Math.PI/2;
        face.position.set(Math.sin(face.rotation.y)*5,0,Math.cos(face.rotation.y)*5);root.add(face);
      }
      root.updateMatrixWorld(true);
      const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,500);camera.position.set(0,0,32);camera.lookAt(0,0,0);
      const renderer=new THREE.WebGLRenderer({alpha:true});renderer.setSize(innerWidth,innerHeight);
      document.body.insertBefore(renderer.domElement,document.getElementById('ui-root'));
      const events=new EventTarget();window.screenEvents=[];events.addEventListener('screen:state',e=>screenEvents.push(e.detail));
      const settings=${JSON.stringify({ ...config, source, live, schedule })};
      const ctx={THREE,scene,root,camera,renderer,cssLayer:document.getElementById('css-layer'),uiRoot:document.getElementById('ui-root'),events,config:()=>settings,player:{position:new THREE.Vector3(0,0,32)},multiplayer:{room:${JSON.stringify(room)}}};
      window.arena={};window.testContext=ctx;window.roundPosition=roundPosition;
      window.screenModule=create(ctx);
      document.querySelector('#enter').onclick=()=>{events.dispatchEvent(new CustomEvent('app:enter',{detail:{broadcastId:'final',showtime:null,roomKey:null}}));document.querySelector('#enter').hidden=true;};
      function frame(t){screenModule.update?.(.016,t);renderer.render(scene,camera);window.frame=requestAnimationFrame(frame)}
      frame(0);window.harnessReady=true;
    </script>` }));
  await page.goto('/screen-video-harness');
  await page.waitForFunction(() => window.harnessReady);
  await page.locator('#enter').click();
}

async function playing(page) {
  await expect.poll(() => page.evaluate(() => window.arena.screen.state.playing)).toBe(true);
}

test('T11: production defaults use an empty schedule, VOD and bounded automatic retries', () => {
  expect(config).toMatchObject({ source: 'vod', schedule: [], liveFallback: 'vod', ended: 'next-round', roundIntervalMinutes: 10,
    retry: { noticeFromFailure: 1, waitLimitSeconds: 60, maxIntervalSeconds: 30 } });
});

test('T11: schedule boundaries replace the test override and expose a read-only snapshot', async ({ page }) => {
  const slot = { from: '2026-11-12T13:15:00+09:00', to: '2026-11-12T13:16:00+09:00', source: 'live' };
  await harness(page, { schedule: [slot] });
  await playing(page);
  await expect(page.getByRole('combobox', { name: '영상 선택' })).toHaveCount(0);
  expect(await page.evaluate(() => arena.screen.schedule)).toEqual({ source: 'vod', slot: null, fallback: false });
  await page.evaluate(() => arena.screen.setSource('live'));
  await playing(page);
  expect(await page.evaluate(() => arena.screen.schedule.source)).toBe('vod');
  await page.evaluate(() => arena.screen.setSource('vod'));
  await page.clock.setFixedTime(Date.parse(slot.from));
  await expect.poll(() => page.evaluate(() => arena.screen.source)).toBe('live');
  expect(await page.evaluate(() => arena.screen.schedule)).toEqual({ source: 'live', slot, fallback: false });
  await page.evaluate(() => { const snapshot = arena.screen.schedule; snapshot.source = 'vod'; snapshot.slot.source = 'vod'; snapshot.fallback = true; });
  expect(await page.evaluate(() => arena.screen.schedule)).toEqual({ source: 'live', slot, fallback: false });
  await page.clock.setFixedTime(Date.parse(slot.to));
  await expect.poll(() => page.evaluate(() => arena.screen.source)).toBe('vod');
  await playing(page);
  expect(await page.evaluate(() => arena.screen.schedule)).toEqual({ source: 'vod', slot: null, fallback: false });
});

test('T11: returning after a whole schedule slot still clears a test override', async ({ page }) => {
  await harness(page, { schedule: [{ from: '2026-11-12T13:15:00+09:00', to: '2026-11-12T13:16:00+09:00', source: 'live' }] });
  await playing(page);
  await page.evaluate(() => arena.screen.setSource('live'));
  await playing(page);
  await page.clock.setFixedTime(Date.parse('2026-11-12T13:17:00+09:00'));
  await expect.poll(() => page.evaluate(() => arena.screen.source)).toBe('vod');
});

for (const failure of [5, 100, 101, 150, 'ended', 'missing', 'timeout']) {
  test(`T11: scheduled live ${failure} falls back to VOD until the slot ends`, async ({ page }) => {
    const slot = { from: '2026-11-12T13:00:00+09:00', to: '2026-11-12T13:20:00+09:00', source: 'live' };
    const next = { from: slot.to, to: '2026-11-12T13:30:00+09:00', source: 'live' };
    await harness(page, { schedule: [slot, next], live: failure === 'missing' ? '' : config.live });
    if (failure !== 'missing') {
      await playing(page);
      expect(await page.evaluate(() => arena.screen.source)).toBe('live');
      await page.evaluate(failure => {
        if (failure === 'ended') ytPlayer.emit(0);
        else if (failure === 'timeout') {
          const liveId = ytPlayer.id, play = ytPlayer.playVideo;
          ytPlayer.playVideo = function () { if (this.id === liveId) this.emit(3); else play.call(this); };
          ytPlayer.emit(3);
        }
        else ytPlayer.options.events.onError({ target: ytPlayer, data: failure });
      }, failure);
      if (failure === 'timeout') {
        await expect.poll(() => page.evaluate(() => arena.screen.source), { timeout: 18_000 }).toBe('vod');
        await page.evaluate(() => { ytPlayer.playVideo = YT.Player.prototype.playVideo; });
      }
    }
    await expect.poll(() => page.evaluate(() => arena.screen.source)).toBe('vod');
    await playing(page);
    expect(await page.evaluate(() => arena.screen.schedule)).toEqual({ source: 'vod', slot, fallback: true });
    await page.clock.setFixedTime(Date.parse(slot.to) - 1);
    await page.evaluate(() => screenModule.update(.016, performance.now() + 6000));
    expect(await page.evaluate(() => arena.screen.source)).toBe('vod');
    await page.evaluate(live => { testContext.config().live = live; }, config.live);
    await page.clock.setFixedTime(Date.parse(slot.to));
    await expect.poll(() => page.evaluate(() => arena.screen.source)).toBe('live');
    await playing(page);
    expect(await page.evaluate(() => arena.screen.schedule)).toEqual({ source: 'live', slot: next, fallback: false });
  });
}

test('T11: repeated error 5 keeps the first-failure notice and 60-second poster across retries, then recovers', async ({ page }) => {
  await page.clock.install({ time: now });
  await harness(page);
  await playing(page);
  await page.evaluate(() => cancelAnimationFrame(window.frame));
  await page.clock.pauseAt(now + 60_000);
  await page.evaluate(() => {
    window.normalPlay = YT.Player.prototype.playVideo; window.attempts = 0;
    YT.Player.prototype.playVideo = function () { attempts++; this.options.events.onError({ target: this, data: 5 }); };
    ytPlayer.options.events.onError({ target: ytPlayer, data: 5 });
  });
  await expect(page.locator('#arena-screen-notice')).toContainText('다시 연결 중');
  await page.clock.runFor(59_999);
  await expect(page.locator('#arena-screen-notice')).toContainText('다시 연결 중');
  await page.clock.runFor(1);
  await expect(page.locator('#arena-screen-notice')).toContainText('연결이 원활하지 않아 계속 다시 시도합니다');
  expect(await page.evaluate(() => ({ visible: arena.screen.element.style.visibility, hole: testContext.scene.getObjectByName('ScreenVideoAperture').visible })))
    .toEqual({ visible: 'hidden', hole: false });
  const attempts = await page.evaluate(() => window.attempts);
  await page.evaluate(() => { window.ytReadyDelay = 1000; });
  await page.clock.runFor(15_000);
  await expect(page.locator('#arena-screen-notice')).toContainText('연결이 원활하지 않아 계속 다시 시도합니다');
  await page.clock.runFor(1000);
  expect(await page.evaluate(() => window.attempts)).toBeGreaterThan(attempts);
  await page.evaluate(() => { YT.Player.prototype.playVideo = normalPlay; window.ytReadyDelay = 0; });
  await page.clock.runFor(30_000);
  await playing(page);
  await expect(page.locator('#arena-screen-notice')).toBeHidden();
  await page.evaluate(() => ytPlayer.options.events.onError({ target: ytPlayer, data: 5 }));
  await expect(page.locator('#arena-screen-notice')).toContainText('다시 연결 중');
  await page.evaluate(() => screenModule.dispose());
  const calls = await page.evaluate(() => ytCalls.length);
  await page.clock.runFor(120_000);
  expect(await page.evaluate(() => ytCalls.length)).toBe(calls);
});

test('T11: an ended room waits for room:round and resumes the same player at the newer round', async ({ page }) => {
  await harness(page, { room: { roundStart: roundStart - 600_000 } });
  await playing(page);
  await page.evaluate(() => { window.originalPlayer = ytPlayer; ytPlayer.duration = 800; ytPlayer.emit(0); });
  expect(await page.evaluate(() => screenEvents.at(-1))).toMatchObject({ source: 'vod', status: 'ended', playing: false });
  await expect(page.locator('#arena-screen-notice')).toContainText('다음 회차');
  await expect(page.locator('#arena-screen-notice')).not.toContainText('선택');
  await page.evaluate(start => testContext.events.dispatchEvent(new CustomEvent('room:round', { detail: { roundStart: start } })), roundStart);
  await playing(page);
  expect(await page.evaluate(() => ({ start: arena.screen.roundStart, same: ytPlayer === originalPlayer, time: ytPlayer.time })))
    .toEqual({ start: roundStart, same: true, time: 270 });
  await page.evaluate(start => {
    ytCalls.length = 0;
    for (const value of [start, start - 600_000, null, 'bad']) testContext.events.dispatchEvent(new CustomEvent('room:round', { detail: { roundStart: value } }));
  }, roundStart);
  expect(await page.evaluate(() => ytCalls.filter(c => c[0] === 'seek'))).toEqual([]);
});

test('T11: a short VOD outside a room waits for the next interval before resuming', async ({ page }) => {
  await harness(page);
  await playing(page);
  await page.evaluate(() => { ytPlayer.duration = 200; ytPlayer.emit(0); });
  expect(await page.evaluate(() => arena.screen.state.status)).toBe('ended');
  await page.clock.setFixedTime(roundStart + 600_000);
  await page.evaluate(() => screenModule.update(.016, performance.now() + 6000));
  await playing(page);
  expect(await page.evaluate(() => ({ start: arena.screen.roundStart, time: ytPlayer.time }))).toEqual({ start: roundStart + 600_000, time: 0 });
});

test('T11: a host can answer the ended event synchronously with a new room round', async ({ page }) => {
  await harness(page, { room: { roundStart: roundStart - 600_000 } });
  await playing(page);
  await page.evaluate(start => {
    testContext.events.addEventListener('screen:state', event => {
      if (event.detail.status === 'ended') testContext.events.dispatchEvent(new CustomEvent('room:round', { detail: { roundStart: start } }));
    });
    ytPlayer.duration = 800; ytPlayer.emit(0);
  }, roundStart);
  await playing(page);
  expect(await page.evaluate(() => arena.screen.roundStart)).toBe(roundStart);
});

test('T67: channel controls have no source selector and keep volume; the source test API keeps both channels playing', async ({ page }) => {
  await harness(page, { source: 'live' });
  await playing(page);
  await expect(page.locator('#arena-screen-controls button:not(#arena-screen-sound)')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: '영상 선택' })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: '영상 음량' })).toBeVisible();
  for (const source of ['vod', 'live']) {
    await page.evaluate(source => arena.screen.setSource(source), source);
    await playing(page);
    await page.evaluate(() => { ytPlayer.pauseVideo(); screenModule.update(.016, performance.now() + 6000); });
    await playing(page);
    expect(await page.evaluate(() => arena.screen.source)).toBe(source);
  }
});

test('T67: blocked sound falls back to muted playback and recovers through sound or volume without a play button', async ({ page }) => {
  await harness(page, { source: 'live' });
  await playing(page);
  for (const gesture of ['sound', 'volume']) {
    await page.evaluate(() => ytPlayer.options.events.onAutoplayBlocked({ target: ytPlayer }));
    await expect(page.locator('#arena-screen-notice')).not.toContainText('재생 버튼');
    if (gesture === 'sound') await page.getByRole('button', { name: '소리 켜기' }).click();
    else await page.getByRole('slider', { name: '영상 음량' }).evaluate(el => { el.value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await playing(page);
    expect(await page.evaluate(() => ytPlayer.muted)).toBe(false);
  }
});

test('T67: a pause emitted during an outstanding play request does not restart that request', async ({ page }) => {
  await harness(page, { source: 'live' });
  await playing(page);
  await page.evaluate(() => {
    window.startCalls = 0;
    ytPlayer.playVideo = function () {
      if (++startCalls > 5) return;
      this.emit(2);
      setTimeout(() => this.emit(1), 30);
    };
    arena.screen.setSource('vod');
  });
  await playing(page);
  expect(await page.evaluate(() => startCalls)).toBe(1);
});

test('T67: enlarged arena screen, matching cameras and unobstructed 16:9 faces', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const shots = '_workspace/_run/2026-11-12-requirements-build/screens';
  const phase = process.env.T67_CAPTURE_PHASE || 'after';
  mkdirSync(shots, { recursive: true });
  await page.setViewportSize({ width: 1280, height: 720 });
  await fakeYouTube(page);
  await page.clock.setFixedTime(now);
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nfor(const entry of modules){const original=entry.create;entry.create=ctx=>{window.testContext=ctx;return original(ctx)}}` });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready, null, { timeout: 120_000 });
  await page.locator('#enter').click();
  await page.clock.setFixedTime(await page.evaluate(() => arena.screen.roundStart + 30_000));
  await page.evaluate(() => {
    arena.crowd.update(0); arena.crowd.update = () => {};
    arena.go('arena');
  });
  const measurements = {};
  for (const view of ['default', 'upper']) {
    if (view === 'upper') await page.evaluate(() => {
      testContext.cameraRig.setOverride(camera => {
        camera.fov = 68; camera.updateProjectionMatrix(); camera.position.set(-32, 7, 24); camera.lookAt(0, 3, 0);
      });
    });
    await page.waitForTimeout(300);
    measurements[view] = await page.evaluate(() => {
      const { THREE, root, scene, camera, renderer } = testContext;
      const mask = scene.getObjectByName('ScreenVideoAperture'), r = arena.screen.element.getBoundingClientRect();
      const selected = [];
      root.traverse(mesh => {
        if (mesh.isMesh && /^(REF_Jumbotron_|REF_Scoreboard|REF_StageRig|REF_HeaderLight|REF_WorldsHeader|REF_ScreenUnderside)/.test(mesh.name)) {
          const box = new THREE.Box3().setFromObject(mesh);
          selected.push({ name: mesh.name, min: box.min.toArray(), max: box.max.toArray(), visible: mesh.visible });
        }
      });
      return { camera: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov,
        rect: { width: r.width, height: r.height, left: r.left, top: r.top, right: r.right, bottom: r.bottom },
        mask: { width: mask.scale.x, height: mask.scale.y, position: mask.position.toArray() },
        playing: arena.screen.state.playing, faces: arena.screen.faces, selected,
        metrics: { ...renderer.info.render, ...renderer.info.memory } };
    });
    await page.screenshot({ path: `${shots}/T67-${view}-${phase}.png` });
  }
  await page.locator('#arena-screen-controls').screenshot({ path: `${shots}/T67-controls-${phase}.png` });
  writeFileSync(`${shots}/T67-measurements-${phase}.json`, JSON.stringify(measurements, null, 2));
  console.log('T67 view measurements', JSON.stringify(Object.fromEntries(Object.entries(measurements).map(([name, m]) => [name, { camera: m.camera, rect: m.rect, mask: m.mask, playing: m.playing }]))));
  await testInfo.attach(`T67-${phase}`, { body: JSON.stringify(measurements), contentType: 'application/json' });
  expect(measurements.default.faces).toHaveLength(4);
  // Measured before T67 at the same 1280×720 default camera; no capture file is required to rerun.
  expect(measurements.default.rect.height).toBeGreaterThan(158.38095092773438 * 1.5);
  for (const m of Object.values(measurements)) {
    expect(m.mask.width / m.mask.height).toBeCloseTo(16 / 9);
    expect(m.faces.every(face => Math.abs(face.width / face.height - 16 / 9) < .0001)).toBe(true);
  }
  const clearance = await page.evaluate(() => {
    const { THREE, root } = testContext, group = root.getObjectByName('ArenaScreenMesh');
    const body = new THREE.Box3(), shared = [], preserved = [];
    const first = arena.screen.faces[0], normal = new THREE.Vector3(...first.normal), up = new THREE.Vector3(0,1,0);
    const right = new THREE.Vector3().crossVectors(up,normal).normalize();
    const toBody = new THREE.Matrix4().makeBasis(right,up,normal).invert();
    group.traverse(mesh => {
      if (!mesh.isMesh) return;
      const original = root.getObjectByName(mesh.name.replace('ScreenMesh_', ''));
      shared.push(mesh.geometry === original.geometry && mesh.material === original.material);
      preserved.push(original.visible === false);
      if (!/Suspension/.test(mesh.name)) {
        const points = mesh.geometry.attributes.position, matrix = toBody.clone().multiply(mesh.matrixWorld);
        for (let i=0;i<points.count;i++) body.expandByPoint(new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(matrix));
      }
    });
    const conflicts = [], point = new THREE.Vector3(), triangle = new THREE.Triangle();
    const tested = { crowd: 0, lighting: 0, stage: 0 };
    root.traverse(mesh => {
      if (!mesh.isMesh || mesh.isInstancedMesh) return;
      const category = mesh.geometry.attributes._cm_origin ? 'crowd' : /^(REF_StageRig|Roof_|Stage_light|REF_(Overhead|Bowl|TeamKey))/.test(mesh.name) ? 'lighting' : /^REF_(CircularStage|Trophy|TeamRiser|Desk|CenterBackdrop|Wing|Scenic|StageOrigin)/.test(mesh.name) ? 'stage' : null;
      if (!category || mesh.name.startsWith('ScreenMesh_')) return;
      tested[category]++;
      const bounds = new THREE.Box3().setFromObject(mesh).applyMatrix4(toBody);
      if (!body.intersectsBox(bounds)) return;
      const vertices = mesh.geometry.attributes.position, indices = mesh.geometry.index, matrix = toBody.clone().multiply(mesh.matrixWorld);
      for (let i = 0; i < (indices?.count ?? vertices.count); i += 3) {
        for (let j = 0; j < 3; j++) [triangle.a, triangle.b, triangle.c][j].copy(point.fromBufferAttribute(vertices, indices ? indices.getX(i+j) : i+j).applyMatrix4(matrix));
        if (body.intersectsTriangle(triangle)) { conflicts.push(mesh.name); break; }
      }
    });
    for (const chunk of arena.crowd.lod.chunks) for (const seat of chunk.seats) {
      if (!chunk.upper) continue;
      tested.crowd++;
      const position = seat.position.clone(); position.y += .7;
      const spectator = new THREE.Box3().setFromCenterAndSize(position, new THREE.Vector3(1.2,1.6,1.2)).applyMatrix4(toBody);
      if (body.intersectsBox(spectator)) conflicts.push('upper spectator '+seat.id);
    }
    return { shared: shared.every(Boolean), preserved: preserved.every(Boolean), tested, conflicts, min: body.min.toArray(), max: body.max.toArray() };
  });
  console.log('T67 clearance', JSON.stringify(clearance));
  await testInfo.attach('T67-clearance', { body: JSON.stringify(clearance), contentType: 'application/json' });
  expect(clearance.shared).toBe(true); expect(clearance.preserved).toBe(true);
  for (const count of Object.values(clearance.tested)) expect(count).toBeGreaterThan(0);
  expect(clearance.conflicts).toEqual([]);
  await page.evaluate(() => {
    const { THREE, cameraRig } = testContext, face = arena.screen.faces[0];
    const center = new THREE.Vector3(...face.position), normal = new THREE.Vector3(...face.normal);
    cameraRig.setOverride(camera => { camera.fov=45;camera.updateProjectionMatrix();camera.position.copy(center).addScaledVector(normal,face.width*1.2);camera.lookAt(center); });
  });
  await playing(page);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); // T31: measure after the override camera has rendered
  const fill = await page.evaluate(() => {
    const { renderer, scene, camera } = testContext, r = arena.screen.element.getBoundingClientRect();
    renderer.render(scene,camera);
    const gl = renderer.getContext(), pixel = new Uint8Array(4), alpha = [];
    for (const x of [.1,.3,.5,.7,.9]) for (const y of [.1,.3,.5,.7,.9]) {
      gl.readPixels(Math.floor((r.left+r.width*x)*gl.drawingBufferWidth/innerWidth), Math.floor((innerHeight-r.top-r.height*y)*gl.drawingBufferHeight/innerHeight), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      alpha.push(pixel[3]);
    }
    return { width:r.width, height:r.height, left:r.left, top:r.top, right:r.right, bottom:r.bottom, alpha };
  });
  expect(fill.width/fill.height).toBeCloseTo(16/9);
  expect(fill.height).toBeGreaterThan(200);
  expect(fill.left).toBeGreaterThanOrEqual(0);expect(fill.top).toBeGreaterThanOrEqual(0);
  expect(fill.right).toBeLessThanOrEqual(1280);expect(fill.bottom).toBeLessThanOrEqual(720);
  expect(fill.alpha.every(alpha => alpha === 0)).toBe(true);
  await page.screenshot({ path: `${shots}/T67-player-${phase}.png` });
  console.log('T67 visible player fill', JSON.stringify(fill));
});

test('roundPosition keeps the selected room round, including future starts and the end boundary', async ({ page }) => {
  await harness(page);
  expect(await page.evaluate(([now, start]) => [roundPosition(now, start, 600), roundPosition(now, start, 270), roundPosition(start - 1000, start, 600)], [now, roundStart]))
    .toEqual([{ seconds: 270, ended: false }, { seconds: 270, ended: true }, { seconds: -1, ended: false }]);
});

test('a room joined before the arena finishes loading supplies the initial round and start URL', async ({ page }) => {
  await harness(page, { room: { roundStart: roundStart - 600_000 } });
  await playing(page);
  expect(await page.evaluate(() => arena.screen.roundStart)).toBe(roundStart - 600_000);
  await expect(page.locator('#arena-screen-player iframe')).toHaveAttribute('src', /start=870/);
});

test('VOD uses start, room join seeks the same iframe, drift corrects every five seconds, live never seeks', async ({ page }) => {
  await harness(page);
  await playing(page);
  const iframe = page.locator('#arena-screen-player iframe');
  await expect(iframe).toHaveAttribute('src', /rQTHR3aL0SE.*start=270/);
  await page.evaluate(() => window.originalIframe = ytPlayer.getIframe());
  await page.evaluate(start => testContext.events.dispatchEvent(new CustomEvent('room:joined', { detail: { roundStart: start } })), roundStart - 600_000);
  expect(await page.evaluate(() => ytPlayer.time)).toBe(870);
  await page.evaluate(() => { ytPlayer.time = 12; ytCalls.length = 0; });
  await expect.poll(() => page.evaluate(() => ytCalls.filter(c => c[0] === 'seek').length), { timeout: 7000 }).toBe(1);
  expect(await page.evaluate(() => ({ time: ytPlayer.time, same: originalIframe === ytPlayer.getIframe() }))).toEqual({ time: 870, same: true });
  await page.evaluate(() => { arena.screen.setSource('live'); ytCalls.length = 0; });
  await playing(page);
  await page.waitForTimeout(5200);
  expect(await page.evaluate(() => ({ id: ytPlayer.id, seeks: ytCalls.filter(c => c[0] === 'seek'), same: originalIframe === ytPlayer.getIframe() })))
    .toEqual({ id: 'EacB7ADMGpY', seeks: [], same: true });
  expect(await page.evaluate(() => screenEvents.at(-1))).toMatchObject({ source: 'live', playing: true, muted: false, userVolume: config.volume });
  await page.evaluate(() => {ytPlayer.pauseVideo();screenModule.update(.016,performance.now()+6000);});
  expect(await page.evaluate(() => arena.screen.state.playing)).toBe(true);
});

test('A-H-1: asynchronous source cues play both sources and retry recovers a playback timeout', async ({ page }) => {
  await harness(page, { source: 'live' });
  await playing(page);
  await page.evaluate(() => {
    window.originalIframe = ytPlayer.getIframe();
    const play = ytPlayer.playVideo;
    ytPlayer.cueVideoById = function ({ videoId, startSeconds = 0 }) {
      this.cueing = true;
      setTimeout(() => { this.id = videoId; this.time = startSeconds; this.cueing = false; this.emit(5); }, 50);
    };
    ytPlayer.playVideo = function () {
      if (this.cueing) { ytCalls.push(['early-play']); return; }
      if (this.stalled) { this.emit(3); return; }
      play.call(this);
    };
  });
  for (const source of ['vod', 'live', 'vod']) {
    await page.evaluate(source => arena.screen.setSource(source), source);
    await playing(page);
    expect(await page.evaluate(() => ytPlayer.id)).toBe(new URL(config[source]).searchParams.get('v'));
  }
  await page.evaluate(() => { ytPlayer.stalled = true; ytPlayer.emit(3); });
  await expect.poll(() => page.evaluate(() => arena.screen.state.status), { timeout: 18000 }).toBe('error');
  await page.evaluate(() => { ytPlayer.stalled = false; });
  await playing(page);
  expect(await page.evaluate(() => ({ same: originalIframe === ytPlayer.getIframe(), early: ytCalls.filter(c => c[0] === 'early-play') })))
    .toEqual({ same: true, early: [] });
});

for (const source of ['vod', 'live']) {
  test(`T73: two failed ${source} buffering reconnects replace the player and resume automatically`, async ({ page }) => {
    await page.clock.install({ time: now });
    await harness(page, { source: source === 'vod' ? 'live' : 'vod' });
    await playing(page);
    await page.evaluate(() => cancelAnimationFrame(window.frame));
    await page.clock.pauseAt(now + 60_000);
    await page.evaluate(source => {
      arena.screen.setVolume(35);
      window.stalledPlayer = ytPlayer;
      window.attempts = 0;
      ytPlayer.playVideo = function () { attempts++; this.emit(3); };
      arena.screen.setSource(source);
    }, source);
    for (const [index, delay] of [3000, 6000, 12000].entries()) {
      await page.clock.runFor(15_000);
      expect(await page.evaluate(() => arena.screen.state)).toMatchObject({ playing: false, status: 'error' });
      await page.clock.runFor(delay - 1);
      expect(await page.evaluate(() => ({ same: ytPlayer === stalledPlayer, attempts })))
        .toEqual({ same: true, attempts: index + 1 });
      await page.clock.runFor(1);
      if (index < 2) {
        expect(await page.evaluate(() => ({ same: ytPlayer === stalledPlayer, attempts, status: arena.screen.state.status })))
          .toEqual({ same: true, attempts: index + 2, status: 'buffering' });
      }
    }
    await playing(page);
    const recovered = await page.evaluate(() => ({
      same: ytPlayer === stalledPlayer, id: ytPlayer.id, muted: ytPlayer.muted,
      destroyed: ytCalls.filter(call => call[0] === 'destroy').length,
      time: ytPlayer.time, expected: arena.screen.source === 'vod' ? (Date.now() - arena.screen.roundStart) / 1000 : 0,
    }));
    expect(recovered).toMatchObject({ same: false, id: new URL(config[source]).searchParams.get('v'), muted: false, destroyed: 1 });
    expect(recovered.time).toBe(recovered.expected);
    expect(await page.evaluate(() => ytCalls.filter(call => call[0] === 'volume').at(-1))).toEqual(['volume', 33]);
    await page.evaluate(() => {
      stalledPlayer.options.events.onError({ target: stalledPlayer, data: 100 });
      stalledPlayer.emit(0);
    });
    expect(await page.evaluate(() => arena.screen.state.playing)).toBe(true);
    await expect(page.locator('#arena-screen-player iframe')).toHaveCount(1);
    await expect(page.locator('#arena-screen-controls button:not(#arena-screen-sound)')).toHaveCount(0);
    await expect(page.locator('#arena-screen-notice')).toBeHidden();
  });
}

test('T73: a buffering reconnect that never finishes cueing also leads to replacement', async ({ page }) => {
  await page.clock.install({ time: now });
  await harness(page, { source: 'live' });
  await playing(page);
  await page.evaluate(() => cancelAnimationFrame(window.frame));
  await page.clock.pauseAt(now + 60_000);
  await page.evaluate(() => {
    window.stalledPlayer = ytPlayer;
    ytPlayer.playVideo = function () { this.emit(3); };
    arena.screen.setSource('vod');
  });
  await page.evaluate(() => { ytPlayer.cueVideoById = () => {}; });
  for (const delay of [18_000, 21_000]) {
    await page.clock.runFor(delay);
    expect(await page.evaluate(() => ({ same: ytPlayer === stalledPlayer, status: arena.screen.state.status })))
      .toEqual({ same: true, status: 'loading' });
  }
  await page.clock.runFor(27_000);
  await playing(page);
  expect(await page.evaluate(() => ytPlayer === stalledPlayer)).toBe(false);
});

test('T73: failed replacements keep backing off to 30 seconds; playback resets the delay and replacement threshold', async ({ page }) => {
  await page.clock.install({ time: now });
  await harness(page, { source: 'live' });
  await playing(page);
  await page.evaluate(() => cancelAnimationFrame(window.frame));
  await page.clock.pauseAt(now + 60_000);
  await page.evaluate(() => {
    window.normalPlay = YT.Player.prototype.playVideo;
    window.attempts = 0;
    YT.Player.prototype.playVideo = function () { attempts++; this.emit(3); };
    arena.screen.setSource('vod');
  });
  for (const [index, delay] of [3000, 6000, 12000, 24000, 30000, 30000].entries()) {
    await page.clock.runFor(14_999);
    expect(await page.evaluate(() => arena.screen.state.status)).toBe('buffering');
    await page.clock.runFor(1);
    expect(await page.evaluate(() => arena.screen.state.status)).toBe('error');
    await page.clock.runFor(delay - 1);
    expect(await page.evaluate(() => attempts)).toBe(index + 1);
    await page.clock.runFor(1);
    expect(await page.evaluate(() => attempts)).toBe(index + 2);
    expect(await page.evaluate(() => ytCalls.filter(call => call[0] === 'destroy').length)).toBe(Math.max(0, index - 1));
    await expect(page.locator('#arena-screen-player iframe')).toHaveCount(1);
  }
  await page.evaluate(() => { YT.Player.prototype.playVideo = normalPlay; });
  await page.clock.runFor(45_000);
  await playing(page);
  await page.evaluate(() => {
    window.recoveredPlayer = ytPlayer;
    ytPlayer.emit(3);
  });
  await page.clock.runFor(17_999);
  expect(await page.evaluate(() => arena.screen.state.playing)).toBe(false);
  await page.clock.runFor(1);
  await playing(page);
  expect(await page.evaluate(() => ytPlayer === recoveredPlayer)).toBe(true);
});

test('T73: a source change resets buffering failures and cancels its pending retry; disposal cancels replacement', async ({ page }) => {
  await page.clock.install({ time: now });
  await harness(page, { source: 'live' });
  await playing(page);
  await page.evaluate(() => cancelAnimationFrame(window.frame));
  await page.clock.pauseAt(now + 60_000);
  await page.evaluate(() => {
    window.originalPlayer = ytPlayer;
    ytPlayer.playVideo = function () { this.emit(3); };
    arena.screen.setSource('vod');
  });
  await page.clock.runFor(33_000);
  await page.evaluate(() => arena.screen.setSource('live'));
  await page.clock.runFor(17_999);
  expect(await page.evaluate(() => ytCalls.filter(call => call[0] === 'destroy'))).toEqual([]);
  expect(await page.evaluate(() => arena.screen.state.status)).toBe('error');
  await page.clock.runFor(1);
  expect(await page.evaluate(() => ({ same: ytPlayer === originalPlayer, id: ytPlayer.id, status: arena.screen.state.status })))
    .toEqual({ same: true, id: new URL(config.live).searchParams.get('v'), status: 'buffering' });
  await page.clock.runFor(36_000);
  expect(await page.evaluate(() => arena.screen.state.status)).toBe('error');
  await page.evaluate(() => screenModule.dispose());
  const calls = await page.evaluate(() => ytCalls.length);
  await page.clock.runFor(120_000);
  expect(await page.evaluate(() => ytCalls.length)).toBe(calls);
  await expect(page.locator('#arena-screen-player')).toHaveCount(0);
});

test('T70: error 5 after switching to VOD automatically returns to playback', async ({ page }) => {
  await harness(page, { source: 'live' });
  await playing(page);
  await page.evaluate(() => {
    window.originalIframe = ytPlayer.getIframe();
    window.brokenPlayer = ytPlayer;
    ytPlayer.playVideo = function () {
      window.failedAt ??= performance.now();
      this.options.events.onError({ target: this, data: 5 });
    };
  });
  await page.evaluate(() => arena.screen.setSource('vod'));
  await expect(page.locator('#arena-screen-notice')).toContainText('YouTube 5');
  expect(await page.evaluate(() => arena.screen.state.playing)).toBe(false);
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 10_000 }).toBe(true);
  const recovered = await page.evaluate(() => ({
    elapsed: performance.now() - failedAt, id: ytPlayer.id,
    same: originalIframe === ytPlayer.getIframe(), time: ytPlayer.time,
    expectedTime: (Date.now() - arena.screen.roundStart) / 1000,
  }));
  expect(recovered.elapsed).toBeGreaterThanOrEqual(3000);
  expect(recovered.elapsed).toBeLessThan(10_000);
  expect(recovered.id).toBe(new URL(config.vod).searchParams.get('v'));
  expect(recovered.same).toBe(false);
  expect(recovered.time).toBe(recovered.expectedTime);
  await page.evaluate(() => {
    brokenPlayer.options.events.onError({ target: brokenPlayer, data: 100 });
    brokenPlayer.emit(0);
  });
  expect(await page.evaluate(() => arena.screen.state.playing)).toBe(true);
  await expect(page.locator('#arena-screen-player iframe')).toHaveCount(1);
  await expect(page.locator('#arena-screen-controls button:not(#arena-screen-sound)')).toHaveCount(0);
  await expect(page.locator('#arena-screen-notice')).toBeHidden();
});

test('T70: repeated error 5 backs off to 30 seconds and successful playback resets the delay', async ({ page }) => {
  await page.clock.install({ time: now });
  await harness(page, { source: 'live' });
  await playing(page);
  await page.evaluate(() => cancelAnimationFrame(window.frame));
  await page.clock.pauseAt(now + 60_000);
  await page.evaluate(() => {
    window.normalPlay = YT.Player.prototype.playVideo; window.attempts = 0;
    YT.Player.prototype.playVideo = function () {
      attempts++;
      this.options.events.onError({ target: this, data: 5 });
    };
    arena.screen.setSource('vod');
  });
  let count = 1;
  for (const delay of [3000, 6000, 12000, 24000, 30000, 30000]) {
    await page.clock.runFor(delay - 1);
    expect(await page.evaluate(() => attempts)).toBe(count);
    await page.clock.runFor(1);
    expect(await page.evaluate(() => attempts)).toBe(++count);
  }
  await page.evaluate(() => { YT.Player.prototype.playVideo = normalPlay; });
  await page.clock.runFor(30_000);
  await playing(page);
  await page.evaluate(() => ytPlayer.options.events.onError({ target: ytPlayer, data: 5 }));
  await page.clock.runFor(2999);
  expect(await page.evaluate(() => arena.screen.state.playing)).toBe(false);
  await page.clock.runFor(1);
  await playing(page);
});

test('T70: permanent errors and missing addresses stop queued retries', async ({ page }) => {
  await page.clock.install({ time: now });
  await harness(page, { source: 'live' });
  await playing(page);
  await page.evaluate(() => cancelAnimationFrame(window.frame));
  await page.clock.pauseAt(now + 60_000);
  for (const failure of [100, 101, 150, 153, 2, 'missing']) {
    await page.evaluate(() => arena.screen.setSource('live'));
    await playing(page);
    await page.evaluate(failure => {
      ytPlayer.options.events.onError({ target: ytPlayer, data: 5 });
      if (failure === 'missing') { testContext.config().live = ''; arena.screen.setSource('live'); }
      else ytPlayer.options.events.onError({ target: ytPlayer, data: failure });
    }, failure);
    const calls = await page.evaluate(() => ytCalls.length);
    await page.clock.runFor(120_000);
    expect(await page.evaluate(() => ytCalls.length)).toBe(calls);
    expect(await page.evaluate(() => arena.screen.state)).toMatchObject({ status: 'error', playing: false });
    await expect(page.locator('#arena-screen-notice')).toContainText(failure === 'missing' ? '영상 주소' : `YouTube ${failure}`);
    await expect(page.locator('#arena-screen-notice')).not.toContainText('자동으로');
  }
});

test('T70: source changes and disposal cancel an error 5 retry', async ({ page }) => {
  await page.clock.install({ time: now });
  await harness(page, { source: 'live' });
  await playing(page);
  await page.evaluate(() => cancelAnimationFrame(window.frame));
  await page.clock.pauseAt(now + 60_000);
  await page.evaluate(() => {
    ytPlayer.options.events.onError({ target: ytPlayer, data: 5 });
    arena.screen.setSource('vod');
  });
  await playing(page);
  const calls = await page.evaluate(() => ytCalls.length);
  await page.clock.runFor(30_000);
  expect(await page.evaluate(() => ytCalls.length)).toBe(calls);
  expect(await page.evaluate(() => ytPlayer.id)).toBe(new URL(config.vod).searchParams.get('v'));
  await page.evaluate(() => {
    ytPlayer.options.events.onError({ target: ytPlayer, data: 5 });
    screenModule.dispose();
  });
  const disposedCalls = await page.evaluate(() => ytCalls.length);
  await page.clock.runFor(60_000);
  expect(await page.evaluate(() => ytCalls.length)).toBe(disposedCalls);
  await expect(page.locator('#arena-screen-player')).toHaveCount(0);
});

test('CSS3D matches the projected 16:9 aperture, switches faces, and hides overlapping app DOM', async ({ page }) => {
  await harness(page);
  await playing(page);
  const geometry = await page.evaluate(() => {
    const { THREE, scene, camera, renderer } = testContext;
    const mask = scene.getObjectByName('ScreenVideoAperture');
    const points = [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y]) => new THREE.Vector3(x,y,0).applyMatrix4(mask.matrixWorld).project(camera));
    const xs = points.map(p => (p.x+1)*innerWidth/2), ys = points.map(p => (1-p.y)*innerHeight/2);
    const rect = document.querySelector('#arena-screen-player iframe').getBoundingClientRect();
    renderer.render(scene,camera);const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(innerWidth/2,innerHeight/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
    return { projected: [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)], actual: [rect.left,rect.top,rect.right,rect.bottom], width: mask.scale.x, height: mask.scale.y, alpha: mask.material.opacity, pixelAlpha:pixel[3], blend: mask.material.blending, face: arena.screen.face, cross: getComputedStyle(document.querySelector('#overlap-probe')).visibility };
  });
  geometry.actual.forEach((v, i) => expect(Math.abs(v - geometry.projected[i])).toBeLessThan(1));
  expect(geometry.width / geometry.height).toBeCloseTo(16 / 9);
  expect(geometry.alpha).toBe(0); expect(geometry.pixelAlpha).toBe(0); expect(geometry.blend).toBe(0);
  expect(geometry.face).toBe('REF_Jumbotron_0'); expect(geometry.cross).toBe('hidden');
  await page.evaluate(() => {
    window.originalIframe=ytPlayer.getIframe();
    const layer=document.createElement('div'),label=document.createElement('div');label.id='late-nameplate';label.textContent='팬';label.style.cssText='position:fixed;left:49%;top:49%';layer.append(label);testContext.uiRoot.append(layer);
    testContext.camera.position.set(32,0,0);testContext.camera.lookAt(0,0,0);
  });
  await expect.poll(() => page.evaluate(() => arena.screen.face)).toBe('REF_Jumbotron_1');
  await expect(page.locator('#late-nameplate')).toHaveCSS('visibility', 'hidden');
  expect(await page.evaluate(() => originalIframe === ytPlayer.getIframe())).toBe(true);
});

test('viewport nameplate layers keep non-overlapping tags visible and hide overlapping tags during playback', async ({ page }) => {
  await harness(page); await playing(page);
  const placement = await page.evaluate(() => {
    const layer=document.createElement('div');
    layer.style.cssText='position:fixed;inset:0;pointer-events:none;overflow:hidden';
    for(const [id,position] of [['outside-nameplate','left:16px;top:16px'],['overlapping-nameplate','left:49%;top:49%']]){
      const label=document.createElement('div');label.id=id;label.textContent='팬';
      label.style.cssText='position:absolute;width:80px;height:24px;'+position;layer.append(label);
    }
    testContext.uiRoot.append(layer);
    const player=ytPlayer.getIframe().getBoundingClientRect(),box=layer.getBoundingClientRect();
    const tags=[...layer.children].map(el=>{
      const tag=el.getBoundingClientRect();
      return Math.min(tag.right,player.right)>Math.max(tag.left,player.left)&&Math.min(tag.bottom,player.bottom)>Math.max(tag.top,player.top);
    });
    return {fullViewport:box.width===innerWidth&&box.height===innerHeight,tags};
  });
  expect(placement).toEqual({fullViewport:true,tags:[false,true]});
  await expect(page.locator('#overlapping-nameplate')).toHaveCSS('visibility','hidden');
  await expect(page.locator('#outside-nameplate')).toHaveCSS('visibility','visible');
});

test('T72: default arena arrival plays with the screen mostly above the viewport', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const shots = '_workspace/_run/2026-11-12-requirements-build/screens';
  const phase = process.env.T72_CAPTURE_PHASE || 'after';
  await page.setViewportSize({ width: 1920, height: 1080 });
  await fakeYouTube(page);
  await page.clock.setFixedTime(now);
  await page.addInitScript(() => { let seed = 72; Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}\nfor(const entry of modules){const original=entry.create;entry.create=ctx=>{window.testContext=ctx;return original(ctx)}}` });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready && arena.character?.ready, null, { timeout: 120_000 });
  await page.locator('#enter').click();
  await page.clock.setFixedTime(await page.evaluate(() => arena.screen.roundStart + 30_000));
  await page.evaluate(() => { arena.crowd.setPaused(true); arena.crowd.seek(0); arena.go('arena'); });
  await page.waitForTimeout(500);
  const measured = await page.evaluate(() => {
    const r = arena.screen.element.getBoundingClientRect(), iframe = ytPlayer.getIframe(), css = getComputedStyle(iframe);
    return { state: arena.screen.state, camera: arena.camera.position.toArray(), quaternion: arena.camera.quaternion.toArray(), fov: arena.camera.fov,
      rect: { left: r.left, top: r.top, width: r.width, height: r.height }, layout: [parseFloat(css.width), parseFloat(css.height)] };
  });
  mkdirSync(shots, { recursive: true });
  await page.screenshot({ path: `${shots}/T72-arrival-${phase}.png` });
  writeFileSync(`${shots}/T72-arrival-${phase}.json`, JSON.stringify(measured, null, 2));
  await testInfo.attach(`T72-arrival-${phase}`, { body: JSON.stringify(measured), contentType: 'application/json' });
  console.log('T72 arrival', JSON.stringify(measured));
  expect(measured.rect.top).toBeLessThan(-measured.rect.height / 2);
  expect(measured.layout).toEqual([config.playerWidth, config.playerHeight]);
  expect(measured.state.playing).toBe(true);
  await expect(page.locator('#arena-screen-player')).toHaveCSS('visibility', 'visible');
});

for (const view of ['small', 'clipped', 'behind']) {
  test(`T72: ${view} arena view keeps both channels playing without restarting`, async ({ page }) => {
    await harness(page);
    await playing(page);
    await page.evaluate(view => {
      const { camera } = testContext;
      if (view === 'small') camera.position.z = 100;
      if (view === 'clipped') camera.setViewOffset(innerWidth, innerHeight, innerWidth * .6, 0, innerWidth, innerHeight);
      camera.lookAt(0, 0, view === 'behind' ? 100 : 0);
      ytCalls.length = 0;
    }, view);
    await page.waitForTimeout(300);
    if (view === 'small') expect(await page.locator('#arena-screen-player').evaluate(el => el.getBoundingClientRect().height)).toBeLessThan(200);
    for (const source of ['vod', 'live']) {
      await page.evaluate(source => arena.screen.setSource(source), source);
      await playing(page);
    }
    expect(await page.evaluate(() => ytCalls.filter(([call]) => call === 'pause'))).toEqual([]);
    if (view === 'behind') await expect(page.locator('#overlap-probe')).toHaveCSS('visibility', 'visible');
    await page.evaluate(() => { ytCalls.length = 0; testContext.camera.position.z = 32; testContext.camera.clearViewOffset(); testContext.camera.lookAt(0, 0, 0); });
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => ytCalls.filter(([call]) => ['play', 'pause'].includes(call)))).toEqual([]);
  });
}

test('T72: outside the arena the existing visibility gate still applies; a hidden tab pauses and resynchronizes', async ({ page }) => {
  await harness(page); await playing(page);
  for (const x of [-83, -139]) {
    await page.evaluate(x => { testContext.player.position.x=x;testContext.camera.position.z=100;testContext.camera.lookAt(0,0,0); }, x);
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(false);
    expect(await page.evaluate(() => testContext.scene.getObjectByName('ScreenVideoAperture').visible)).toBe(false);
    await expect(page.locator('#overlap-probe')).toHaveCSS('visibility', 'visible');
    await page.evaluate(() => { ytPlayer.time=0;testContext.camera.position.z=32;testContext.camera.lookAt(0,0,0); });
    await playing(page);
    expect(await page.evaluate(() => ytPlayer.time)).toBe(270);
    await page.evaluate(() => { testContext.camera.setViewOffset(innerWidth,innerHeight,innerWidth*.6,0,innerWidth,innerHeight);testContext.camera.updateProjectionMatrix(); });
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(false);
    await page.evaluate(() => { testContext.camera.clearViewOffset(); });
    await playing(page);
  }
  await page.evaluate(() => { testContext.player.position.x=0; });
  await page.evaluate(() => { Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(false);
  await page.evaluate(() => { ytPlayer.time=0;delete document.hidden;document.dispatchEvent(new Event('visibilitychange')); });
  await playing(page);
  expect(await page.evaluate(() => ytPlayer.time)).toBe(270);
});

test('video IDs and channel live URLs stay in the official player; entry and volume use its audio API', async ({ page }) => {
  await harness(page, { source:'live', live:'https://www.youtube.com/channel/UCabcdefghijklmnopqrstuv/live' });
  await playing(page);
  await expect(page.locator('#arena-screen-player iframe')).toHaveAttribute('src', /embed\/live_stream\?.*channel=UCabcdefghijklmnopqrstuv/);
  expect(await page.evaluate(() => ytPlayer.muted)).toBe(false);
  await page.getByRole('slider',{name:'영상 음량'}).evaluate(el=>{el.value='35';el.dispatchEvent(new Event('input',{bubbles:true}));});
  expect(await page.evaluate(() => ytCalls)).toContainEqual(['volume',33]);
  for (const amount of [0, 60]) {
    await page.getByRole('slider',{name:'영상 음량'}).evaluate((el,value)=>{el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));}, amount);
    expect(await page.evaluate(() => arena.screen.state)).toMatchObject({ playing: true, muted: amount === 0 });
  }
  await page.evaluate(() => {testContext.config().live='EacB7ADMGpY';arena.screen.setSource('live');});
  await expect.poll(() => page.evaluate(() => ytPlayer.id)).toBe('EacB7ADMGpY');
  expect(await page.evaluate(() => ytCalls.filter(c=>c[0]==='seek'))).toEqual([]);
});

test('VOD end, embed rejection and unavailable broadcasts keep original materials and show a notice', async ({ page }) => {
  await harness(page); await playing(page);
  await page.evaluate(() => window.posterMaterials = testContext.root.children.map(o=>o.material));
  for (const failure of ['ended', 101, 100]) {
    await page.evaluate(failure => {
      arena.screen.setSource(failure === 'ended' ? 'vod' : 'live');
      if(failure==='ended'){ytPlayer.duration=200;ytPlayer.emit(0);}
      else ytPlayer.options.events.onError({target:ytPlayer,data:failure});
    }, failure);
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(false);
    await expect(page.locator('#arena-screen-notice')).toBeVisible();
    expect(await page.evaluate(() => {
      const {renderer,scene,camera}=testContext;renderer.render(scene,camera);
      const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(innerWidth/2,innerHeight/2,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      return {hole:scene.getObjectByName('ScreenVideoAperture').visible,intact:testContext.root.children.every((o,i)=>o.material===posterMaterials[i]),posterAlpha:pixel[3]};
    })).toEqual({ hole:false, intact:true, posterAlpha:255 });
  }
});

test('missing source and a failed official API request produce a poster and useful notice', async ({ page }) => {
  await page.route('https://www.youtube.com/iframe_api', route => route.abort('internetdisconnected'));
  await harness(page, { fake: false, source: 'live', live: '' });
  await expect(page.locator('#arena-screen-notice')).toBeVisible();
  expect(await page.evaluate(() => arena.screen.state.playing)).toBe(false);
  await page.evaluate(() => arena.screen.setSource('vod'));
  await expect(page.locator('#arena-screen-notice')).toContainText(/연결|네트워크|불러/);
  expect(await page.evaluate(() => testContext.scene.getObjectByName('ScreenVideoAperture').visible)).toBe(false);
});

test('a stream that stalls shows the poster, then automatically resumes when the connection recovers', async ({ page }) => {
  await harness(page);await playing(page);
  await page.evaluate(()=>{
    ytCalls.length=0;
    window.normalPlay=ytPlayer.playVideo;
    ytPlayer.playVideo=function(){ytCalls.push(['play']);this.emit(3);};
    ytPlayer.emit(3);
  });
  await expect.poll(()=>page.evaluate(()=>arena.screen.state.status),{timeout:18000}).toBe('error');
  await expect(page.locator('#arena-screen-notice')).toContainText('연결');
  expect(await page.evaluate(()=>({hole:testContext.scene.getObjectByName('ScreenVideoAperture').visible,retries:ytCalls.filter(c=>c[0]==='play').length}))).toEqual({hole:false,retries:0});
  await page.evaluate(() => { ytPlayer.playVideo = normalPlay; });
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 10_000 }).toBe(true);
});

for (const failure of ['error', 'timeout']) {
  test(`T62: API ${failure} automatically retries without a button click`, async ({ page }) => {
    await fakeYouTube(page, { api: true });
    let requests = 0;
    await page.route('https://www.youtube.com/iframe_api', async route => {
      if (++requests === 1) {
        if (failure === 'timeout') await new Promise(resolve => setTimeout(resolve, 16_000));
        await route.abort('internetdisconnected');
      } else await route.fallback();
    });
    await harness(page, { fake: false, source: 'live' });
    await expect.poll(() => page.evaluate(() => arena.screen.state.status), { timeout: 18_000 }).toBe('error');
    const failed = await page.evaluate(() => ({ at: performance.now(), ...arena.screen.state }));
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 10_000 }).toBe(true);
    console.log('T62 API recovery', JSON.stringify({ failure, failed, recovered: await page.evaluate(() => ({ at: performance.now(), ...arena.screen.state })), requests }));
    expect(requests).toBe(2);
    await expect(page.locator('#arena-screen-player iframe')).toHaveCount(1);
  });
}

test('T62: a player readiness timeout recovers and ignores the replaced player late callback', async ({ page }) => {
  await page.addInitScript(() => { window.ytReadyDelay = 16_000; });
  await harness(page, { source: 'live' });
  await expect.poll(() => page.evaluate(() => arena.screen.state.status), { timeout: 18_000 }).toBe('error');
  await page.evaluate(() => { window.ytReadyDelay = 0; window.latePlayer = ytPlayer; });
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 10_000 }).toBe(true);
  await page.evaluate(() => { latePlayer.options.events.onReady({ target: latePlayer }); latePlayer.emit(0); });
  expect(await page.evaluate(() => arena.screen.state.playing)).toBe(true);
  await expect(page.locator('#arena-screen-player iframe')).toHaveCount(1);
});

test('T62: disposal cancels an API failure retry', async ({ page }) => {
  let requests = 0;
  await page.route('https://www.youtube.com/iframe_api', route => { requests++; return route.abort('internetdisconnected'); });
  await harness(page, { fake: false, source: 'live' });
  await expect.poll(() => page.evaluate(() => arena.screen.state.status)).toBe('error');
  await page.evaluate(() => { cancelAnimationFrame(window.frame); screenModule.dispose(); });
  await page.waitForTimeout(4000);
  expect(requests).toBe(1);
  await expect(page.locator('#arena-screen-player')).toHaveCount(0);
});

test('T62: a source choice cancels the old retry and plays only the chosen video', async ({ page }) => {
  await fakeYouTube(page, { api: true });
  let requests = 0;
  await page.route('https://www.youtube.com/iframe_api', route => ++requests === 1 ? route.abort('internetdisconnected') : route.fallback());
  await harness(page, { fake: false, source: 'live' });
  await expect.poll(() => page.evaluate(() => arena.screen.state.status)).toBe('error');
  await page.evaluate(() => arena.screen.setSource('vod'));
  await playing(page);
  await page.waitForTimeout(4000);
  expect(await page.evaluate(() => ytPlayer.id)).toBe(new URL(config.vod).searchParams.get('v'));
  expect(requests).toBe(2);
});

test('Full Mode keeps the iframe, enables pointer controls, leaves zero app overlap and restores on exit/dispose', async ({ page }) => {
  await harness(page); await playing(page);
  await page.evaluate(() => {
    window.originalIframe=ytPlayer.getIframe();window.oldTime=ytPlayer.time;
    arena.screen.enterFullMode();
  });
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  const full = await page.evaluate(() => {
    const frame=ytPlayer.getIframe(),r=frame.getBoundingClientRect();
    const overlaps=[...document.querySelectorAll('#overlap-probe,#enter,#ui-root button,#arena-screen-controls button')].filter(el=>{
      const s=getComputedStyle(el),b=el.getBoundingClientRect();
      return s.visibility!=='hidden'&&s.display!=='none'&&b.width>0&&b.height>0&&Math.min(b.right,r.right)>Math.max(b.left,r.left)&&Math.min(b.bottom,r.bottom)>Math.max(b.top,r.top);
    }).map(el=>el.id||el.textContent);
    return { same:frame===originalIframe,time:ytPlayer.time,oldTime,overlaps,pointer:getComputedStyle(frame).pointerEvents,width:r.width,height:r.height };
  });
  expect(full.same).toBe(true);expect(full.time).toBe(full.oldTime);expect(full.overlaps).toEqual([]);expect(full.pointer).toBe('auto');
  expect(full.width/full.height).toBeCloseTo(16/9);expect(full.height).toBeGreaterThan(500);
  await page.evaluate(() => arena.screen.exitFullMode());
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(false);
  await page.evaluate(() => { cancelAnimationFrame(window.frame);screenModule.dispose(); });
  await expect(page.locator('#arena-screen-player')).toHaveCount(0);
  await expect(page.locator('#overlap-probe')).toHaveCSS('visibility','visible');
  expect(await page.evaluate(() => testContext.scene.getObjectByName('ScreenVideoAperture'))).toBeUndefined();
  expect(await page.evaluate(() => testContext.root.getObjectByName('ArenaScreenMesh'))).toBeUndefined();
  expect(await page.evaluate(() => [0,1,2,3].every(i => testContext.root.getObjectByName('REF_Jumbotron_'+i).visible))).toBe(true);
});

test('real arena and official YouTube player play the supplied VOD and inspect the supplied live source', async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.setFixedTime(Date.parse('2026-11-13T04:10:30Z'));
  const errors=[], failedRequests=[];
  page.on('pageerror', error=>errors.push(error.message));
  page.on('requestfailed', request=>{if(/youtube|googlevideo|ytimg/.test(request.url()))failedRequests.push({url:request.url(),error:request.failure()?.errorText});});
  await page.route('**/config/screen.json', route=>route.fulfill({json:{...config,source:'vod'}}));
  await page.route('**/modules.js', async route=>{
    const response=await route.fetch();
    await route.fulfill({response,body:`${await response.text()}\nfor(const entry of modules){const original=entry.create;entry.create=ctx=>{window.testContext=ctx;return original(ctx)}}`});
  });
  await page.goto('/');
  await page.waitForFunction(()=>window.arena?.ready,{},{timeout:60_000});
  await page.locator('#enter').click();
  await page.clock.setFixedTime(await page.evaluate(() => arena.screen.roundStart + 30_000));
  await page.evaluate(() => {
    const {THREE,root,cameraRig}=testContext;
    const mesh=root.getObjectByName('REF_Jumbotron_0'),center=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
    const normal=new THREE.Vector3(center.x,0,center.z).normalize();
    cameraRig.setOverride(camera=>{camera.fov=45;camera.updateProjectionMatrix();camera.position.copy(center).addScaledVector(normal,10);camera.lookAt(center);});
  });
  const failures=[];
  for(const source of ['vod','live']){
    if(source==='live')await page.evaluate(source => arena.screen.setSource(source), source);
    try{
      await page.waitForFunction(()=>arena.screen.state.playing||['error','ended','blocked'].includes(arena.screen.state.status),{},{timeout:45_000});
      expect(await page.evaluate(()=>arena.screen.state)).toMatchObject({playing:true,source});
      const overlap=await page.evaluate(()=>{
        const {THREE,scene,camera}=testContext,mask=scene.getObjectByName('ScreenVideoAperture');
        const points=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>new THREE.Vector3(x,y,0).applyMatrix4(mask.matrixWorld).project(camera));
        const r=document.querySelector('#arena-screen-player iframe').getBoundingClientRect();
        return Math.max(...[Math.min(...points.map(p=>(p.x+1)*innerWidth/2))-r.left,Math.max(...points.map(p=>(p.x+1)*innerWidth/2))-r.right,Math.min(...points.map(p=>(1-p.y)*innerHeight/2))-r.top,Math.max(...points.map(p=>(1-p.y)*innerHeight/2))-r.bottom].map(Math.abs));
      });
      expect(overlap).toBeLessThan(1);
    }catch(error){failures.push(source+': '+error.message);}
    const evidence=await page.evaluate(()=>({screen:arena.screen.state,face:arena.screen.face,metrics:{...arena.state,...testContext.renderer.info.memory}}));
    const playerFrame=page.frames().find(frame=>frame.url().includes('youtube.com/embed/'));
    const playerErrors=playerFrame?await playerFrame.locator('.ytp-error-content-wrap').allTextContents():[];
    console.log('T13 external evidence:',JSON.stringify({source,...evidence,playerErrors,failedRequests:failedRequests.slice(0,6),errors}));
  }
  expect(errors).toEqual([]);expect(failures).toEqual([]);
});

// T31 (hud-controls.md H-W6·H-W7, UX-H-R03·R04): a separate sound button keeps the slider value; the source is read-only text.
test('T31 H-W7: the sound button mutes and unmutes without losing the volume; the bar names the current source', async ({ page }) => {
  await harness(page, { source: 'vod' });
  await playing(page);
  const bar = page.locator('#settings > #arena-screen-controls'), slider = bar.getByRole('slider', { name: '영상 음량' });
  await expect(bar.locator('#arena-screen-source')).toHaveText('지금: 재방');
  // app:enter already enabled the shared sound state.
  expect(await page.evaluate(() => arena.screen.state.muted)).toBe(false);
  await expect(bar.getByRole('button', { name: '소리 끄기' })).toBeVisible();
  await expect(slider).toHaveValue(String(config.volume));
  await bar.getByRole('button', { name: '소리 끄기' }).click();
  expect(await page.evaluate(() => arena.screen.state.muted)).toBe(true);
  await expect(slider).toHaveValue(String(config.volume));
  await bar.getByRole('button', { name: '소리 켜기' }).click();
  expect(await page.evaluate(() => ({ muted: arena.screen.state.muted, volume: arena.screen.state.volume }))).toMatchObject({ muted: false });
  await expect(slider).toHaveValue(String(config.volume));
  await page.evaluate(() => arena.screen.setSource('live'));
  await expect(bar.locator('#arena-screen-source')).toHaveText('지금: 생방송');
});

// Without #settings, the fallback control bar and action dock still move clear of the player.
test('T31 R-2: the control bar and #dock move off the player rectangle instead of being hidden', async ({ page }) => {
  await harness(page, { settings: false });
  await playing(page);
  await page.evaluate(() => {
    const panel = document.createElement('section'); panel.id = 'dock'; panel.textContent = '행동 버튼';
    panel.style.cssText = 'position:fixed;left:28px;bottom:28px;width:300px;height:96px;background:#123';
    document.body.append(panel);
    // Screen face 0 sits at z=5; look past it so the player fills the lower-left part of the viewport.
    testContext.camera.position.set(5, 5, 20); testContext.camera.lookAt(5, 5, 0);
  });
  const read = () => page.evaluate(() => {
    const r = arena.screen.element.getBoundingClientRect();
    return ['#arena-screen-controls', '#dock'].map(id => {
      const el = document.querySelector(id), b = el.getBoundingClientRect();
      const natural = b.bottom - (parseFloat(getComputedStyle(el).translate.split(' ')[1]) || 0);
      return { id, visible: getComputedStyle(el).visibility === 'visible', clear: !(Math.min(b.right, r.right) > Math.max(b.left, r.left) && Math.min(b.bottom, r.bottom) > Math.max(b.top, r.top)),
        inside: b.top >= 0 && b.bottom <= innerHeight, coveredAtHome: natural > r.top && b.left < r.right };
    });
  });
  await expect.poll(read).toEqual([
    { id: '#arena-screen-controls', visible: true, clear: true, inside: true, coveredAtHome: true },
    { id: '#dock', visible: true, clear: true, inside: true, coveredAtHome: true },
  ]);
  // Back to the far view: both return to their home corner.
  await page.evaluate(() => { testContext.camera.position.set(0, 0, 32); testContext.camera.lookAt(0, 0, 0); });
  await expect.poll(() => page.evaluate(() => ['#arena-screen-controls', '#dock'].map(id => getComputedStyle(document.querySelector(id)).translate))).toEqual(['none', 'none']);
});
