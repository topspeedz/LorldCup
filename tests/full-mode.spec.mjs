import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// BL-0020 / decision 10: Full Mode shows the local YouTube player over the whole screen and returns to the 3D controls.
const screenConfig = JSON.parse(readFileSync(new URL('../web/config/screen.json', import.meta.url)));
const controls = JSON.parse(readFileSync(new URL('../web/config/controls.json', import.meta.url)));
const now = Date.parse('2026-11-12T13:14:30+09:00');

async function fakeBrowser(page, { denyFullscreen = false } = {}) {
  await page.addInitScript(({ deny }) => {
    // Deterministic pointer lock and Fullscreen API; headless browsers differ in both.
    let locked = null, full = null;
    const fire = name => document.dispatchEvent(new Event(name));
    Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get: () => locked });
    Element.prototype.requestPointerLock = function () { locked = this; queueMicrotask(() => fire('pointerlockchange')); return Promise.resolve(); };
    Document.prototype.exitPointerLock = function () { if (locked) { locked = null; queueMicrotask(() => fire('pointerlockchange')); } };
    Object.defineProperty(Document.prototype, 'fullscreenElement', { configurable: true, get: () => full });
    Element.prototype.requestFullscreen = function () {
      if (deny) return Promise.reject(new TypeError('Fullscreen is not allowed'));
      full = this; fire('fullscreenchange'); return Promise.resolve();
    };
    Document.prototype.exitFullscreen = function () { full = null; fire('fullscreenchange'); return Promise.resolve(); };
    window.browserLeavesFullscreen = () => { full = null; fire('fullscreenchange'); };
    window.ytCalls = [];
    window.YT = { Player: class {
      constructor(element, options) {
        this.options = options; this.time = options.playerVars?.start || 0; this.state = -1; this.muted = true;
        this.id = options.videoId; window.ytPlayer = this;
        this.iframe = document.createElement('iframe'); element.replaceWith(this.iframe);
        this.iframe.src = 'https://www.youtube.com/embed/' + this.id + '?' + new URLSearchParams(options.playerVars);
        this.iframe.style.cssText = 'width:100%;height:100%;border:0';
        queueMicrotask(() => options.events.onReady({ target: this }));
      }
      emit(data) { this.state = data; this.options.events.onStateChange({ target: this, data }); }
      playVideo() { ytCalls.push(['play']); this.emit(1); }
      pauseVideo() { ytCalls.push(['pause']); this.emit(2); }
      seekTo(value) { ytCalls.push(['seek', value]); this.time = value; }
      cueVideoById({ videoId, startSeconds = 0 }) { this.id = videoId; this.time = startSeconds; this.emit(5); }
      getCurrentTime() { return this.time; }
      getDuration() { return 3600; }
      getIframe() { return this.iframe; }
      mute() { this.muted = true; } unMute() { this.muted = false; } isMuted() { return this.muted; }
      setVolume() {}
      destroy() { this.iframe.remove(); }
    } };
  }, { deny: denyFullscreen });
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0;background:#146ca4">YouTube test double</body>' }));
}

async function harness(page, options = {}) {
  await fakeBrowser(page, options);
  await page.clock.setFixedTime(now);
  await page.route('**/full-mode-harness', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
    <style>*{box-sizing:border-box}body{margin:0}canvas{display:block;width:100vw;height:100vh}</style>
    <script type="importmap">{"imports":{"three":"/vendor/three.module.js"}}</script>
    <script type="module">
      import * as THREE from '/vendor/three.module.js';
      import {events} from '/events.js';
      import {createInput} from '/input.js';
      import {create as screenVideo} from '/screen-video.js';
      import {create as fullMode} from '/ui/full-mode.js';
      const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
      for(let i=0;i<4;i++){
        const face=new THREE.Mesh(new THREE.PlaneGeometry(13.6,4),new THREE.MeshBasicMaterial({color:'#ac6025'}));
        face.name='REF_Jumbotron_'+i;face.rotation.y=i*Math.PI/2;
        face.position.set(Math.sin(face.rotation.y)*5,0,Math.cos(face.rotation.y)*5);root.add(face);
      }
      root.updateMatrixWorld(true);
      // Keep the fixture screen clear of the Full Mode button as its configured size changes.
      const camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,500);camera.position.set(0,${screenConfig.mesh.centerY},${screenConfig.mesh.width * 2});camera.lookAt(0,${screenConfig.mesh.centerY},0);
      const renderer=new THREE.WebGLRenderer({alpha:true});renderer.setSize(innerWidth,innerHeight);
      const cssLayer=document.createElement('div'),uiRoot=document.createElement('div');cssLayer.id='css-layer';uiRoot.id='ui-root';
      cssLayer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:0';
      renderer.domElement.style.cssText='position:fixed;inset:0;z-index:0';
      uiRoot.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:1';
      const uiStyle=document.createElement('style');uiStyle.textContent='#ui-root>*{pointer-events:auto}';uiRoot.append(uiStyle);
      document.body.prepend(cssLayer,renderer.domElement,uiRoot);
      const settings={screen:${JSON.stringify({ ...screenConfig, source: 'vod' })},controls:${JSON.stringify(controls)}};
      const input=createInput({canvas:renderer.domElement,events,controls:settings.controls,isReady:()=>true,onLook(){},onJump(){},onReset(){},onTeleport(){}});
      const ctx={THREE,scene,root,camera,renderer,cssLayer,uiRoot,events,config:name=>settings[name],input,player:{position:new THREE.Vector3(0,0,30)},multiplayer:{room:null}};
      window.arena={};window.testInput=input;window.testEvents=[];
      for(const name of ['fullmode:enter','fullmode:exit'])events.addEventListener(name,()=>testEvents.push(name));
      window.screenModule=screenVideo(ctx);window.fullModule=fullMode(ctx);
      // Mouse-first: the arena starts at app:enter (ui/loading.js sends it); the player is made after it.
      events.dispatchEvent(new CustomEvent('app:enter',{detail:{broadcastId:'final',showtime:${JSON.stringify(options.showtime ?? null)},roomKey:null}}));
      function frame(t){screenModule.update?.(.016,t);renderer.render(scene,camera);window.frame=requestAnimationFrame(frame)}
      frame(0);window.harnessReady=true;
    </script>` }));
  await page.goto('/full-mode-harness');
  await page.waitForFunction(() => window.harnessReady);
  if (options.showtime) return; // waiting: nothing plays yet
  await expect.poll(() => page.evaluate(() => window.arena.screen.state.playing)).toBe(true);
  await page.evaluate(() => { window.originalIframe = ytPlayer.getIframe(); window.oldTime = ytPlayer.time; ytCalls.length = 0; });
}

// The player must cover the screen, keep playing in the same iframe, and have no app DOM over it (legal LG-H-1).
async function expectFullPlayer(page, { nativeFullscreen = true } = {}) {
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  // screen-video.js hides overlapped app DOM on its next render, so wait for that frame.
  await expect.poll(() => page.evaluate(() => { const r = ytPlayer.getIframe().getBoundingClientRect();
    return [...document.querySelectorAll('#full-mode-open')].some(el => { const b = el.getBoundingClientRect();
      return getComputedStyle(el).visibility !== 'hidden' && b.width > 0 && Math.min(b.right, r.right) > Math.max(b.left, r.left) && Math.min(b.bottom, r.bottom) > Math.max(b.top, r.top); }); })).toBe(false);
  const full = await page.evaluate(() => {
    const frame = ytPlayer.getIframe(), r = frame.getBoundingClientRect(), layer = document.querySelector('#css-layer').getBoundingClientRect();
    const overlaps = [...document.body.querySelectorAll('*')].filter(el => {
      if (el.contains(frame) || frame.contains(el) || ['CANVAS', 'SCRIPT', 'STYLE'].includes(el.tagName) || el.id === 'ui-root') return false;
      const s = getComputedStyle(el), b = el.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0 &&
        Math.min(b.right, r.right) > Math.max(b.left, r.left) && Math.min(b.bottom, r.bottom) > Math.max(b.top, r.top);
    }).map(el => el.id || el.tagName + ':' + el.textContent.trim());
    const top = [[.25, .25], [.5, .5], [.75, .75], [.95, .05]].map(([x, y]) => document.elementFromPoint(r.left + r.width * x, r.top + r.height * y) === frame);
    return { same: frame === originalIframe, time: ytPlayer.time, oldTime, playing: arena.screen.state.playing,
      seeks: ytCalls.filter(c => c[0] === 'seek'), overlaps, top, pointer: getComputedStyle(frame).pointerEvents,
      cover: Math.max(r.width / innerWidth, r.height / innerHeight), layer: [layer.left, layer.top, layer.width, layer.height],
      viewport: [innerWidth, innerHeight], fullscreen: document.fullscreenElement?.id ?? null, src: frame.src };
  });
  expect(full.same).toBe(true);
  expect(full.time).toBe(full.oldTime);
  expect(full.playing).toBe(true);
  expect(full.seeks).toEqual([]);
  expect(full.overlaps).toEqual([]);
  expect(full.top).toEqual([true, true, true, true]);
  expect(full.pointer).toBe('auto');
  expect(full.src).not.toMatch(/controls=0/);
  expect(full.cover).toBeGreaterThan(.9);
  expect(full.layer).toEqual([0, 0, ...full.viewport]);
  expect(full.fullscreen).toBe(nativeFullscreen ? 'css-layer' : null);
}

async function expectBackIn3D(page, { walking }) {
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(false);
  await expect(page.locator('#arena-screen-player')).toBeVisible();
  await expect(page.getByRole('button', { name: '닫기' })).toBeHidden();
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  await expect.poll(() => page.evaluate(() => ({ walking: testInput.walking, locked: document.pointerLockElement?.tagName ?? null })))
    .toEqual({ walking, locked: null }); // nothing locks the pointer (mouse-first)
  if (walking) {
    await page.keyboard.down('KeyW');
    expect(await page.evaluate(() => testInput.down('forward'))).toBe(true);
    await page.keyboard.up('KeyW');
  }
}

async function walk(page) {
  await expect.poll(() => page.evaluate(() => ({ walking: testInput.walking, locked: document.pointerLockElement?.tagName ?? null })))
    .toEqual({ walking: true, locked: null }); // app:enter turned walking input on
}

test('the top-right Full Mode button opens the same playing player full screen; the close button returns', async ({ page }) => {
  await harness(page);
  const open = page.getByRole('button', { name: 'Full Mode' });
  await expect(open).toBeVisible();
  const box = await open.boundingBox(), viewport = page.viewportSize();
  expect(box.x + box.width).toBeGreaterThan(viewport.width * .8);
  expect(box.y).toBeLessThan(viewport.height * .25);
  await open.click();
  await expectFullPlayer(page);
  const close = page.getByRole('button', { name: '닫기' });
  await expect(close).toBeVisible();
  await close.click();
  await expectBackIn3D(page, { walking: true });
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => testEvents)).toEqual(['fullmode:enter', 'fullmode:exit']);
});

test('F enters from walking without moving the character, and F returns to movement keys', async ({ page }) => {
  await harness(page);
  await walk(page);
  await page.keyboard.press('KeyF');
  await expectFullPlayer(page);
  expect(await page.evaluate(() => ({ walking: testInput.walking, locked: document.pointerLockElement }))).toEqual({ walking: false, locked: null });
  await page.keyboard.down('KeyW');
  expect(await page.evaluate(() => testInput.down('forward'))).toBe(false);
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyF');
  await expectBackIn3D(page, { walking: true });
});

test('Esc and the browser leaving fullscreen (fullscreenchange) both return to the original controls', async ({ page }) => {
  await harness(page);
  await walk(page);
  await page.keyboard.press('KeyF');
  await expectFullPlayer(page);
  await page.keyboard.press('Escape');
  await expectBackIn3D(page, { walking: true });

  await page.keyboard.press('KeyF');
  await expectFullPlayer(page);
  await page.evaluate(() => browserLeavesFullscreen());
  await expectBackIn3D(page, { walking: true });
});

test('without the Fullscreen API the player covers the whole window and still exits with Esc', async ({ page }) => {
  await harness(page, { denyFullscreen: true });
  await page.getByRole('button', { name: 'Full Mode' }).click();
  await expectFullPlayer(page, { nativeFullscreen: false });
  await page.keyboard.press('Escape');
  await expectBackIn3D(page, { walking: true });
});

test('dispose removes the Full Mode controls and leaves full mode', async ({ page }) => {
  await harness(page);
  await page.getByRole('button', { name: 'Full Mode' }).click();
  await expectFullPlayer(page);
  await page.evaluate(() => fullModule.dispose?.());
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(false);
  await expect(page.getByRole('button', { name: 'Full Mode' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '닫기' })).toHaveCount(0);
});

// T31 (BL-0031 (3), full-mode.md F-W1~F-W3, F-D3): seated, the button shows without any key, opens on one click,
// and closing returns to the seated view (walking input stays off).
test('seated: Full Mode is visible right after sitting, opens with one click and closes back to the seat with the cursor', async ({ page }) => {
  await harness(page);
  await walk(page);
  await page.evaluate(async () => { const { events } = await import('/events.js'); events.dispatchEvent(new CustomEvent('seat:enter', { detail: { seatId: 'probe' } })); });
  const open = page.locator('#full-mode-open');
  await expect(open).toBeVisible();
  await expect(open).toContainText('Full Mode');
  await open.click();
  await expectFullPlayer(page);
  const close = page.getByRole('button', { name: 'Full Mode 닫기 (Esc)' });
  await expect(close).toBeFocused();
  await close.click();
  await expectBackIn3D(page, { walking: false });
  await expect(open).toBeVisible();
  await expect(open).toBeFocused();
});

// BL-0035 D2 (T46b memo): waiting for the showtime in Full Mode shows one line of remaining time inside the Full Mode bar, left of the sound button.
test('waiting showtime: Full Mode bar carries one remaining-time line, nothing else is added', async ({ page }) => {
  const showtime = Math.ceil(now / 600_000) * 600_000 + 600_000; // the round boundary after next
  await harness(page, { showtime });
  await expect.poll(() => page.evaluate(() => arena.screen.state.status)).toBe('waiting');
  await page.getByRole('button', { name: 'Full Mode' }).click();
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  const line = page.locator('#full-mode-wait');
  await expect(line).toBeVisible();
  await expect(line).toHaveText(/^\d+(분|초) 뒤 시작해요$/);
  const order = await page.evaluate(() => [...arena.screen.controlsElement.children].filter(el => el.checkVisibility()).map(el => el.id));
  expect(order[0]).toBe('full-mode-wait');
  await page.keyboard.press('Escape');
  await expect(line).toBeHidden();
});
