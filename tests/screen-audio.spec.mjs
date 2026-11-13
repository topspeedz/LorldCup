import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../web/config/screen.json', import.meta.url)));
const start = Date.parse('2026-11-13T04:10:00Z'), now = start + 270_000;

async function harness(page, overrides = {}) {
  await page.clock.setFixedTime(now);
  await page.addInitScript(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error('Use viewport Full Mode'));
    window.calls = []; window.screenEvents = [];
    window.YT = { Player: class {
      constructor(element, options) {
        this.options = options; this.time = options.playerVars.start; this.at = Date.now(); this.status = -1; this.muted = true;
        this.iframe = document.createElement('iframe'); element.replaceWith(this.iframe); window.yt = this;
        queueMicrotask(() => options.events.onReady({ target: this }));
      }
      emit(data) { this.time = this.getCurrentTime(); this.at = Date.now(); this.status = data; this.options.events.onStateChange({ target: this, data }); }
      playVideo() { calls.push(['play']); this.emit(1); }
      pauseVideo() { calls.push(['pause']); this.emit(2); }
      seekTo(time) { calls.push(['seek', time]); this.time = time; this.at = Date.now(); }
      cueVideoById({ startSeconds = 0 }) { calls.push(['cue']); this.time = startSeconds; this.at = Date.now(); this.emit(5); }
      getCurrentTime() { return this.time + (this.status === 1 ? (Date.now() - this.at) / 1000 : 0); }
      getDuration() { return 3600; }
      getIframe() { return this.iframe; }
      setVolume(value) { this.volume = value; calls.push(['volume', value]); }
      mute() { this.muted = true; } unMute() { this.muted = false; } isMuted() { return this.muted; }
      destroy() { calls.push(['destroy']); this.iframe.remove(); }
    } };
  });
  await page.route('**/screen-audio-harness', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <style>body{margin:0}canvas,#css-layer,#ui-root{position:fixed;inset:0}#css-layer,#ui-root{pointer-events:none}#ui-root>*{pointer-events:auto}</style>
    <script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>
    <div id="css-layer"></div><div id="ui-root"><div id="settings" style="position:fixed;right:0;bottom:0;width:240px"></div></div><button id="enter" style="position:fixed;right:0;bottom:0;z-index:2">입장</button>
    <script type="module">
      import * as THREE from '/vendor/three.module.js';
      import {create} from '/screen-video.js';
      const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
      for(let i=0;i<4;i++){
        const mesh=new THREE.Mesh(new THREE.PlaneGeometry(13.6,4),new THREE.MeshBasicMaterial());
        mesh.name='REF_Jumbotron_'+i;mesh.rotation.y=i*Math.PI/2;
        mesh.position.set(Math.sin(mesh.rotation.y)*5,0,Math.cos(mesh.rotation.y)*5);root.add(mesh);
      }
      const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,500);camera.position.set(0,0,32);camera.lookAt(0,0,0);
      const renderer=new THREE.WebGLRenderer({alpha:true});renderer.setSize(innerWidth,innerHeight);document.body.prepend(renderer.domElement);
      const settings=${JSON.stringify({ ...config, ...overrides })},events=new EventTarget();
      events.addEventListener('screen:state',e=>screenEvents.push(e.detail));
      window.ctx={THREE,scene,root,camera,renderer,events,config:()=>settings,player:{position:new THREE.Vector3(0,3.1,20)},multiplayer:{room:null},cssLayer:document.querySelector('#css-layer'),uiRoot:document.querySelector('#ui-root')};
      window.arena={};window.screenModule=create(ctx);window.emit=(name,detail)=>events.dispatchEvent(new CustomEvent(name,{detail}));
      document.querySelector('#enter').onclick=()=>{emit('app:enter',{broadcastId:'final',showtime:null,roomKey:null});document.querySelector('#enter').hidden=true;};
      function frame(t){screenModule.update(.016,t);renderer.render(scene,camera);window.frame=requestAnimationFrame(frame)}frame(0);
    </script>` }));
  await page.goto('/screen-audio-harness');
  await page.waitForFunction(() => window.arena?.screen);
  await page.locator('#enter').click();
  await expect(page.locator('#settings > #arena-screen-controls')).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.arena?.screen?.state.playing)).toBe(true);
  await page.evaluate(() => { window.originalPlayer = yt; window.originalIframe = yt.getIframe(); calls.length = 0; });
}

test('T12: audio defaults and arena boundaries match the approved values', () => {
  expect(config).toMatchObject({ volume: 70, muted: true, unmuteOnEnter: true, crowdVolume: .3, syncToleranceSeconds: 2,
    distanceVolume: { nearMeters: 25, farMeters: 90, farRatio: .4 }, arenaBounds: { minX: -61, maxX: 94, maxAbsZ: 70 } });
});

for (const source of ['vod', 'live']) {
  test(`T12: ${source} keeps playing audibly while facing away inside the arena`, async ({ page }) => {
    await harness(page, { source });
    await page.evaluate(() => { ctx.camera.lookAt(0,0,100); calls.length = 0; });
    await page.clock.setFixedTime(now + 1000);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => ({ ...arena.screen.state, actualVolume: yt.volume, actualMuted: yt.muted })))
      .toMatchObject({ playing: true, time: source === 'vod' ? 271 : 1, volume: 70, actualVolume: 70, muted: false, actualMuted: false });
    expect(await page.evaluate(() => calls)).toEqual([]);
  });
}

test('T12: distance scales the slider volume linearly, clamps at 40%, and updates the event', async ({ page }) => {
  await harness(page);
  for (const [distance, expected] of [[0,70], [25,70], [32,65], [57.5,49], [90,28], [120,28]]) {
    await page.evaluate(distance => ctx.player.position.set(distance,3.1,0), distance);
    await expect.poll(() => page.evaluate(() => yt.volume)).toBeCloseTo(expected, 6);
    expect(await page.evaluate(() => arena.screen.state.volume)).toBeCloseTo(expected, 6);
    expect(await page.evaluate(() => screenEvents.at(-1).volume)).toBeCloseTo(expected, 6);
    expect(await page.evaluate(() => screenEvents.at(-1).userVolume)).toBe(config.volume);
  }
  await page.getByRole('slider', { name: '영상 음량' }).evaluate(el => { el.value = '40'; el.dispatchEvent(new Event('input')); });
  expect(await page.evaluate(() => ({ volume: yt.volume, muted: yt.muted, slider: arena.screen.controlsElement.querySelector('input').value })))
    .toEqual({ volume: 16, muted: false, slider: '40' });
  for (const value of [1, 0]) {
    await page.evaluate(value => arena.screen.setVolume(value), value);
    expect(await page.evaluate(() => ({ volume: yt.volume, muted: yt.muted }))).toEqual({ volume: value, muted: value === 0 });
  }
  await page.evaluate(() => { calls.length = 0; });
  await page.waitForTimeout(100);
  expect(await page.evaluate(() => calls)).toEqual([]);
});

test('T12: seat and Full Mode use the slider volume, restore distance on exit and preserve zero', async ({ page }) => {
  await harness(page);
  await page.evaluate(() => ctx.player.position.set(90,3.1,0));
  await expect.poll(() => page.evaluate(() => yt.volume)).toBeCloseTo(28, 6);
  for (const mode of ['seat', 'full']) {
    await page.evaluate(mode => mode === 'seat' ? emit('seat:enter', { seatId: 'test' }) : arena.screen.enterFullMode(), mode);
    await expect.poll(() => page.evaluate(() => yt.volume)).toBe(70);
    await page.evaluate(() => arena.screen.setVolume(0));
    expect(await page.evaluate(() => ({ volume: yt.volume, muted: yt.muted, playing: arena.screen.state.playing })))
      .toEqual({ volume: 0, muted: true, playing: true });
    await page.evaluate(() => arena.screen.setVolume(70));
    await page.evaluate(mode => mode === 'seat' ? emit('seat:exit') : arena.screen.exitFullMode(), mode);
    await expect.poll(() => page.evaluate(() => yt.volume)).toBeCloseTo(28, 6);
  }
  expect(await page.evaluate(() => ({ same: yt === originalPlayer, seeks: calls.filter(c => c[0] === 'seek') })))
    .toEqual({ same: true, seeks: [] });
});

test('T12: indoor playback reads configured boundaries with the existing inclusive/exclusive edges', async ({ page }) => {
  await harness(page, { arenaBounds: { minX: -10, maxX: 10, maxAbsZ: 10 } });
  for (const [x,z,playing] of [[-10,0,true], [-10.01,0,false], [9.99,0,true], [10,0,false], [0,9.99,true], [0,10,false], [0,-10,false]]) {
    await page.evaluate(([x,z]) => { ctx.player.position.set(x,3.1,z); ctx.camera.lookAt(0,0,100); }, [x,z]);
    await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(playing);
  }
});

test('T12: outside only a sufficiently visible screen plays, with distance audio', async ({ page }) => {
  await harness(page);
  await page.evaluate(() => ctx.player.position.set(120,3.1,0));
  await expect.poll(() => page.evaluate(() => yt.volume)).toBeCloseTo(28, 6);
  expect(await page.evaluate(() => arena.screen.state.playing)).toBe(true);
  await page.evaluate(() => ctx.camera.lookAt(0,0,100));
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(false);
  await page.evaluate(() => { ctx.camera.position.z = 100; ctx.camera.lookAt(0,0,0); });
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(false);
  await page.evaluate(() => { ctx.camera.position.z = 32; ctx.camera.lookAt(0,0,0); });
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(true);
  expect(await page.evaluate(() => yt === originalPlayer && yt.getIframe() === originalIframe)).toBe(true);
});

test('T12: a same-round join preserves playback within tolerance and corrects only excessive drift', async ({ page }) => {
  await harness(page);
  for (const drift of [-2, 0, 2]) {
    await page.evaluate(({ start, drift }) => { yt.time = 270 + drift; calls.length = 0; emit('room:joined', { roundStart: start }); }, { start, drift });
    expect(await page.evaluate(() => calls)).toEqual([]);
    expect(await page.evaluate(() => yt.getCurrentTime())).toBe(270 + drift);
  }
  await page.evaluate(start => { yt.time = 267; emit('room:joined', { roundStart: start }); }, start);
  expect(await page.evaluate(() => calls)).toEqual([['seek', 270]]);
});

test('T12: handoff, solo, and leaving keep an older round and the same advancing player', async ({ page }) => {
  await harness(page);
  await page.evaluate(start => { emit('room:joined', { roundStart: start - 600_000 }); calls.length = 0; }, start);
  for (const phase of ['handoff', 'room', 'solo']) {
    await page.evaluate(phase => emit('room:state', { key: '01', count: phase === 'solo' ? 1 : 2, host: true, phase }), phase);
  }
  await page.evaluate(() => emit('room:left'));
  await page.clock.setFixedTime(now + 1000);
  expect(await page.evaluate(() => ({ calls, start: arena.screen.roundStart, time: yt.getCurrentTime(), playing: arena.screen.state.playing, same: yt === originalPlayer && yt.getIframe() === originalIframe })))
    .toEqual({ calls: [], start: start - 600_000, time: 871, playing: true, same: true });
});

test('T12: after playback begins, crossing two ten-minute boundaries never rewinds outside a room', async ({ page }) => {
  await harness(page);
  await page.evaluate(() => cancelAnimationFrame(frame));
  for (const seconds of [601, 1201]) {
    await page.clock.setFixedTime(start + seconds * 1000);
    await page.evaluate(seconds => screenModule.update(.016, performance.now() + seconds * 1000), seconds);
    expect(await page.evaluate(() => ({ start: arena.screen.roundStart, time: yt.getCurrentTime(), calls })))
      .toEqual({ start, time: seconds, calls: [] });
  }
});

test('T12: an ended room advances by one seek without recreating its player', async ({ page }) => {
  await harness(page);
  await page.evaluate(start => { emit('room:joined', { roundStart: start - 600_000 }); yt.emit(0); calls.length = 0; emit('room:round', { roundStart: start }); }, start);
  expect(await page.evaluate(() => ({ same: yt === originalPlayer, calls, playing: arena.screen.state.playing })))
    .toEqual({ same: true, calls: [['seek', 270], ['play']], playing: true });
});

test('T12: live ignores room timing, and disposal removes seat listeners', async ({ page }) => {
  await harness(page, { source: 'live' });
  await page.evaluate(start => {
    emit('room:joined', { roundStart: start - 600_000 }); emit('room:round', { roundStart: start }); emit('room:left');
  }, start);
  expect(await page.evaluate(() => calls)).toEqual([]);
  await page.evaluate(() => { cancelAnimationFrame(frame); screenModule.dispose(); calls.length = 0; emit('seat:enter', { seatId: 'test' }); emit('seat:exit'); });
  expect(await page.evaluate(() => calls)).toEqual([]);
});
