import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../web/config/screen.json', import.meta.url)));
const start = Date.parse('2026-11-13T04:10:00Z'), now = start + 30_000;

async function openScreen(page, { source = 'vod', schedule = [], enter = true, showtime = null } = {}) {
  await page.clock.setFixedTime(now);
  await page.addInitScript(() => {
    window.calls = []; window.players = []; window.states = [];
    Element.prototype.requestFullscreen = () => Promise.reject(Error('viewport fallback'));
    window.Audio = class {
      paused = true;
      currentTime = 0;
      play() { if (window.blockCrowd) return Promise.reject(Error('gesture required')); this.paused = false; return Promise.resolve(); }
      pause() { this.paused = true; }
    };
  });
  await page.route('**/crowd-performance.mp3', route => route.fulfill({ body: 'audio fixture' }));
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<body>Player fixture</body>' }));
  await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType: 'text/javascript', body: `
    window.YT={Player:class {
      constructor(target,options){this.options=options;this.time=options.playerVars.start;this.muted=true;this.duration=3600;this.state=-1;this.started=false;
        this.iframe=document.createElement('iframe');this.iframe.src='https://www.youtube.com/embed/'+options.videoId;target.replaceWith(this.iframe);
        players.push(this);window.yt=this;queueMicrotask(()=>options.events.onReady({target:this}));}
      emit(data){this.state=data;if(data===1)this.started=true;this.options.events.onStateChange({target:this,data});}
      playVideo(){calls.push(['play',this.muted]);if(window.blockVideo&&!this.muted){if(window.blockVideo!=='silent')this.options.events.onAutoplayBlocked({target:this});return;}this.emit(1);}
      pauseVideo(){calls.push(['pause']);this.emit(2);}
      seekTo(time){calls.push(['seek',time,this.started]);this.time=time;}
      cueVideoById({startSeconds=0}){this.time=startSeconds;this.started=false;queueMicrotask(()=>this.emit(5));}
      getCurrentTime(){return this.started?this.time:0;} getDuration(){return this.duration;} getIframe(){return this.iframe;}
      mute(){this.muted=true;} unMute(){this.muted=false;} isMuted(){return this.muted;} setVolume(value){this.volume=value;}
      destroy(){this.iframe.remove();}
    }};window.onYouTubeIframeAPIReady();` }));
  await page.route('**/fix1-screen', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html>
    <style>body{margin:0}canvas,#css-layer,#ui-root{position:fixed;inset:0}#css-layer,#ui-root{pointer-events:none}#ui-root>*{pointer-events:auto}
    #settings{position:fixed;right:0;bottom:0}#team-select{position:fixed;left:30%;top:25%;width:40%;height:50%;background:#fff;z-index:10}</style>
    <script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>
    <div id="css-layer"></div><div id="ui-root"><div id="settings"></div></div>
    <button id="enter" style="position:fixed;z-index:3">들어가기</button>
    <section id="team-select" role="dialog" hidden><button>팀·캐릭터</button></section>
    <script type="module">
      import * as THREE from '/vendor/three.module.js';
      import {create} from '/screen-video.js';
      import {createCrowdMotion} from '/crowd-motion.js';
      const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
      for(let i=0;i<4;i++){const mesh=new THREE.Mesh(new THREE.PlaneGeometry(13.6,4),new THREE.MeshBasicMaterial());
        mesh.name='REF_Jumbotron_'+i;mesh.rotation.y=i*Math.PI/2;mesh.position.set(Math.sin(mesh.rotation.y)*5,0,Math.cos(mesh.rotation.y)*5);root.add(mesh);}
      const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,500);camera.position.set(0,0,32);camera.lookAt(0,0,0);
      const renderer=new THREE.WebGLRenderer({alpha:true});renderer.setSize(innerWidth,innerHeight);document.body.prepend(renderer.domElement);
      const settings=${JSON.stringify({ ...config, source, schedule })},events=new EventTarget();events.addEventListener('screen:state',e=>states.push(e.detail));
      window.ctx={THREE,scene,root,camera,renderer,events,config:name=>name==='screen'?settings:undefined,player:{position:new THREE.Vector3(0,0,32)},multiplayer:{room:null},cssLayer:document.querySelector('#css-layer'),uiRoot:document.querySelector('#ui-root')};
      window.arena={};arena.crowd=createCrowdMotion(root,ctx);window.module=create(ctx);
      window.emit=(name,detail)=>events.dispatchEvent(new CustomEvent(name,{detail}));
      document.querySelector('#enter').onclick=()=>{emit('app:enter',{broadcastId:'final',showtime:${showtime},roomKey:null});document.querySelector('#enter').hidden=true;};
      function frame(t){module.update(.016,t);renderer.render(scene,camera);requestAnimationFrame(frame)}frame(0);
    </script>` }));
  await page.goto('/fix1-screen');
  await page.waitForFunction(() => window.arena?.screen);
  if (enter) await page.locator('#enter').click();
}

const playing = page => expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(true);

test('LG-M-17: no player or API request before app:enter, including API calls and Full Mode', async ({ page }) => {
  const requests = []; page.on('request', r => { if (/youtube\.com/.test(r.url())) requests.push(r.url()); });
  await openScreen(page, { enter: false });
  await page.evaluate(() => { arena.screen.play(); arena.screen.setSource('live'); arena.screen.enterFullMode(); arena.screen.exitFullMode(); });
  expect(await page.evaluate(() => players.length)).toBe(0);
  expect(requests).toEqual([]);
  await page.locator('#enter').click();
  await playing(page);
  expect(await page.evaluate(() => players.length)).toBe(1);
  expect(requests.filter(url => url.endsWith('/iframe_api'))).toHaveLength(1);
});

test('U-H-2: seated team dialog remains visible and usable without covering visible video', async ({ page }) => {
  await openScreen(page); await playing(page);
  await page.evaluate(() => { emit('seat:enter', { seatId: 'test' }); document.querySelector('#team-select').hidden = false; });
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).not.toHaveAttribute('data-screen-occluded');
  await page.getByRole('dialog').getByRole('button', { name: '팀·캐릭터', exact: true }).click();
  await expect(page.locator('#arena-screen-player')).toBeHidden();
  await playing(page);
  await page.evaluate(() => { document.querySelector('#team-select').hidden = true; });
  await expect(page.locator('#arena-screen-player')).toBeVisible();
});

test('U-H-6: sitting during startup preserves the pending player and reaches playback', async ({ page }) => {
  await openScreen(page, { enter: false });
  await page.evaluate(() => emit('seat:enter', { seatId: 'test' }));
  await page.locator('#enter').click(); await playing(page);
  expect(await page.evaluate(() => [players.length, arena.screen.state.volume])).toEqual([1, config.volume]);
});

test('U-H-7: 1280 Full Mode and seated Full Mode keep one playing iframe', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openScreen(page); await playing(page);
  for (const seated of [false, true]) {
    await page.evaluate(seated => { if (seated) emit('seat:enter', { seatId: 'test' }); arena.screen.enterFullMode(); }, seated);
    await playing(page);
    await expect(page.locator('#css-layer > #arena-screen-controls')).toHaveCount(1);
    await page.evaluate(() => arena.screen.exitFullMode());
    await expect(page.locator('#settings > #arena-screen-controls')).toHaveCount(1);
  }
  expect(await page.evaluate(() => players.length)).toBe(1);
});

test('U-H-8: first entry follows the default VOD schedule and starts with sound', async ({ page }) => {
  await openScreen(page); await playing(page);
  expect(await page.evaluate(() => arena.screen.state)).toMatchObject({ source: 'vod', muted: false, userVolume: config.volume });
  await expect.poll(() => page.evaluate(() => arena.crowd.sounding)).toBe(true);
});

test('U-H-9: selected future round stays waiting through room join, then starts at zero', async ({ page }) => {
  const future = start + 600_000;
  await openScreen(page, { showtime: future });
  await page.waitForFunction(() => window.yt);
  await page.evaluate(future => emit('room:joined', { code: '01', host: true, roundStart: future }), future);
  expect(await page.evaluate(() => arena.screen.state)).toMatchObject({ status: 'waiting', playing: false });
  expect(await page.evaluate(() => calls.filter(([name]) => name === 'play' || name === 'seek'))).toEqual([]);
  await expect.poll(() => page.evaluate(() => arena.crowd.sounding)).toBe(true);
  await page.clock.setFixedTime(future); await playing(page);
  expect(await page.evaluate(() => [arena.screen.roundStart, arena.screen.state.time])).toEqual([future, 0]);
  expect(await page.evaluate(() => calls.filter(([name]) => name === 'play'))).toEqual([['play', false]]);
});

test('A-H-1: a ready player outside the arena waits for visibility; entering the arena starts the due round', async ({ page }) => {
  const future = start + 600_000;
  await openScreen(page, { enter: false, showtime: future });
  await page.evaluate(minX => { ctx.player.position.x = minX - 20; ctx.camera.lookAt(0, 0, 100); }, config.arenaBounds.minX);
  await page.locator('#enter').click();
  await page.waitForFunction(() => window.yt);
  await expect.poll(() => page.evaluate(() => arena.screen.state.status)).toBe('waiting');
  await page.clock.setFixedTime(future);
  await expect.poll(() => page.evaluate(() => arena.screen.state.status)).toBe('ready');
  expect(await page.evaluate(() => arena.screen.state)).toMatchObject({ playing: false, muted: false, error: null });
  expect(await page.evaluate(() => calls.filter(([name]) => name === 'play'))).toEqual([]);
  await page.evaluate(() => ctx.player.position.set(0, 0, 32));
  await playing(page);
  expect(await page.evaluate(() => calls.filter(([name]) => name === 'play'))).toEqual([['play', false]]);
});

test('U-H-10: empty schedule is VOD; a live slot plays immediately despite a future showtime', async ({ page }) => {
  await openScreen(page, { schedule: [{ from: new Date(start).toISOString(), to: new Date(start + 600_000).toISOString(), source: 'live' }], showtime: start + 600_000 });
  await playing(page);
  expect(await page.evaluate(() => arena.screen.schedule)).toMatchObject({ source: 'live', fallback: false });
  await expect(page.locator('#arena-screen-player iframe')).toHaveAttribute('src', /EacB7ADMGpY/);
});

test('a newer room round pauses playback until its boundary and keeps the same player', async ({ page }) => {
  await openScreen(page); await playing(page);
  const future = start + 600_000;
  await page.evaluate(({ start, future }) => {
    emit('room:joined', { code: '01', host: false, roundStart: start });
    emit('room:round', { roundStart: future });
    window.playCount = calls.filter(([name]) => name === 'play').length;
  }, { start, future });
  expect(await page.evaluate(() => arena.screen.state.status)).toBe('waiting');
  await page.clock.setFixedTime(future - 1);
  expect(await page.evaluate(() => calls.filter(([name]) => name === 'play').length === playCount)).toBe(true);
  await page.clock.setFixedTime(future); await playing(page);
  expect(await page.evaluate(() => [players.length, arena.screen.state.time])).toEqual([1, 0]);
});

test('A-H-1: initial startup does not issue a seek before the first PLAYING event', async ({ page }) => {
  await openScreen(page); await playing(page);
  expect(await page.evaluate(() => calls.filter(([name, , started]) => name === 'seek' && !started))).toEqual([]);
  await page.evaluate(() => { yt.options.events.onError({ target: yt, data: 5 }); });
  await expect.poll(() => page.evaluate(() => players.length), { timeout: 6000 }).toBe(2);
  await playing(page);
});

for (const block of ['event', 'silent']) test(`A-H-1: ${block} autoplay rejection falls back to muted playback; the sound button restores audio`, async ({ page }) => {
  await openScreen(page, { enter: false });
  await page.evaluate(block => { window.blockVideo = block; }, block);
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => arena.screen.state.playing), { timeout: 20_000 }).toBe(true);
  expect(await page.evaluate(() => calls.filter(([name]) => name === 'play'))).toEqual([['play', false], ['play', true]]);
  expect(await page.evaluate(() => arena.screen.state.muted)).toBe(true);
  expect(await page.evaluate(() => arena.crowd.sounding)).toBe(false);
  await expect(page.locator('#arena-screen-notice')).toBeHidden();
  await page.evaluate(() => { window.blockVideo = false; });
  await page.getByRole('button', { name: '소리 켜기' }).click();
  expect(await page.evaluate(() => [arena.screen.state.muted, yt.isMuted(), arena.screen.state.playing])).toEqual([false, false, true]);
  await expect.poll(() => page.evaluate(() => arena.crowd.sounding)).toBe(true);
  await page.evaluate(() => arena.screen.setVolume(35));
  expect(await page.evaluate(() => arena.crowd.audio.volume)).toBeCloseTo(config.crowdVolume * .5);
  expect(await page.evaluate(() => states.at(-1).userVolume)).toBe(35);
});

test('crowd-only autoplay rejection retries once on the next gesture without muting video', async ({ page }) => {
  await openScreen(page, { enter: false });
  await page.evaluate(() => { window.blockCrowd = true; });
  await page.locator('#enter').click(); await playing(page);
  expect(await page.evaluate(() => [arena.screen.state.muted, arena.crowd.sounding])).toEqual([false, false]);
  await page.evaluate(() => { window.blockCrowd = false; });
  await page.mouse.click(2, 2);
  await expect.poll(() => page.evaluate(() => arena.crowd.sounding)).toBe(true);
});
