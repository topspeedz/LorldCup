import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const config = JSON.parse(readFileSync(new URL('../web/config/seats.json', import.meta.url), 'utf8'));
const roundStart = Date.parse('2026-11-13T04:10:00Z');
test.setTimeout(180_000);

test('BL-0033 / T63: seats occupy the three entrance rows below the removed rim', () => {
  for (const seat of config.seats) {
    const [x, y, z] = seat.position;
    expect([-.87, -1.3, -1.73], seat.id).toContain(y);
    const rx = 31 + (y + 9.9) / .43 * 1.08, rz = rx - 10;
    expect(x * x / rx ** 2 + z * z / rz ** 2, seat.id).toBeCloseTo(1, 4);
    expect(Math.hypot(x + 61, z), seat.id).toBeLessThan(12);
  }
});

for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`BL-0033: level, undistorted, unobstructed seated screens at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    // A colored local player isolates camera occlusion from external video availability.
    await page.addInitScript(() => {
      window.YT = { Player: class {
        constructor(element, options) {
          this.options = options; this.id = options.videoId; this.time = 0; this.state = 2; this.muted = true;
          const target = typeof element === 'string' ? document.getElementById(element) : element;
          this.iframe = document.createElement('iframe');
          this.iframe.srcdoc = '<body style="margin:0;background:#146ca4;color:white;font:24px sans-serif">T30s screen fixture</body>';
          target.replaceWith(this.iframe); queueMicrotask(() => options.events.onReady({ target: this }));
        }
        emit(data) { this.state = data; this.options.events.onStateChange({ target: this, data }); }
        playVideo() { this.emit(1); } pauseVideo() { this.emit(2); } stopVideo() { this.pauseVideo(); }
        seekTo(time) { this.time = time; }
        cueVideoById({ videoId, startSeconds = 0 }) { this.id = videoId; this.time = startSeconds; this.emit(5); }
        loadVideoById(options) { this.cueVideoById(options); this.playVideo(); }
        getCurrentTime() { return this.time; } getDuration() { return 7200; } getPlayerState() { return this.state; }
        getVideoData() { return { video_id: this.id }; } getIframe() { return this.iframe; }
        mute() { this.muted = true; } unMute() { this.muted = false; } isMuted() { return this.muted; }
        setVolume() {} destroy() { this.iframe.remove(); }
      } };
    });
    await page.route('**/modules.js', async route => {
      const response = await route.fetch();
      await route.fulfill({ response, body: `${await response.text()}
        const entry=modules.find(m=>m.path==='seat-mode.js'),original=entry.create;
        entry.create=ctx=>{window.seatBackContext=ctx;return original(ctx);};` });
    });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.clock.setSystemTime(roundStart + 1000);
    await page.goto(`/?b=final&t=${roundStart}`);
    await page.waitForFunction(() => window.arena?.ready && arena.character?.ready);
    await page.locator('#enter').click();
    await expect.poll(() => page.evaluate(() => arena.state.walking)).toBe(true);
    const measurements = [];
    for (const seat of config.seats) {
      const approach = await page.evaluate(seat => {
        const { player } = seatBackContext, [x, y, z] = seat.position;
        const approach = [x, y, z - Math.sign(z) * 1.2];
        approach[1] = player.groundAt(approach[0], approach[2], 0);
        player.teleport([...approach, 0]);
        return { position: approach, canMove: player.attempt(0, -Math.sign(z) * .03) };
      }, seat);
      expect(approach.position[1], seat.id).not.toBeNull();
      expect(approach.canMove, seat.id).toBe(true);
      await expect(page.locator('#seat-toggle')).toBeVisible();
      await page.evaluate(() => seatBackContext.events.dispatchEvent(new CustomEvent('input:action', { detail: { action: 'sit', down: true } })));
      await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seat.id);
      await expect.poll(() => page.evaluate(() => arena.camera.fov)).toBe(config.camera.fov);
      await expect.poll(() => page.evaluate(() => arena.screen.state.playing)).toBe(true);
      await expect(page.locator('#arena-screen-player iframe')).toBeVisible();
      const measured = await page.evaluate(({ width, height }) => {
        const { THREE, camera, scene, renderer } = seatBackContext;
        camera.updateMatrixWorld(true);
        const f = arena.screen.faces.find(f => f.name === arena.screen.face), center = new THREE.Vector3(...f.position), normal = new THREE.Vector3(...f.normal);
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize(), up = new THREE.Vector3().crossVectors(normal, right).normalize();
        const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([x, y]) => center.clone().addScaledVector(right, x * f.width / 2).addScaledVector(up, y * f.height / 2).project(camera));
        const points = corners.map(p => new THREE.Vector2((p.x + 1) * width / 2, (1 - p.y) * height / 2));
        const top = points[0].distanceTo(points[1]), bottom = points[2].distanceTo(points[3]), left = points[0].distanceTo(points[3]), rightEdge = points[1].distanceTo(points[2]);
        renderer.render(scene, camera);
        const gl = renderer.getContext(), pixel = new Uint8Array(4), alpha = [];
        for (const x of [-.35, 0, .35]) for (const y of [-.35, 0, .35]) {
          const p = center.clone().addScaledVector(right, x * f.width).addScaledVector(up, y * f.height).project(camera);
          gl.readPixels(Math.floor((p.x + 1) * renderer.domElement.width / 2), Math.floor((p.y + 1) * renderer.domElement.height / 2), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); alpha.push(pixel[3]);
        }
        return { pitch: THREE.MathUtils.radToDeg(Math.asin(camera.getWorldDirection(new THREE.Vector3()).y)), centerError: Math.abs(center.clone().project(camera).y) / 2, ratio: (top + bottom) / (left + rightEdge), topBottom: top / bottom, points: points.map(p => p.toArray()), depth: corners.map(p => p.z), alpha, cameraPosition: camera.position.toArray(), cameraDistance: camera.position.distanceTo(center) };
      }, viewport);
      measurements.push({ seat: seat.id, ...measured });
      expect.soft(measured.cameraDistance, `${seat.id}: entrance viewing distance`).toBeGreaterThan(35);
      expect.soft(Math.abs(measured.pitch), seat.id).toBeLessThanOrEqual(2);
      expect.soft(measured.centerError, seat.id).toBeLessThanOrEqual(.01);
      expect.soft(Math.abs(measured.ratio / (16 / 9) - 1), seat.id).toBeLessThanOrEqual(.01);
      expect.soft(Math.abs(measured.topBottom - 1), seat.id).toBeLessThanOrEqual(.01);
      expect.soft(Math.max(...measured.alpha), `${seat.id}: WebGL must leave the screen visible`).toBeLessThanOrEqual(5);
      for (const [x, y] of measured.points) { expect.soft(x).toBeGreaterThanOrEqual(0); expect.soft(x).toBeLessThanOrEqual(viewport.width); expect.soft(y).toBeGreaterThanOrEqual(0); expect.soft(y).toBeLessThanOrEqual(viewport.height); }
      for (const z of measured.depth) { expect.soft(z).toBeGreaterThan(-1); expect.soft(z).toBeLessThan(1); }
      const screenshot = await page.screenshot({ ...(seat === config.seats[0] ? { path: testInfo.outputPath(`seat-${viewport.width}.png`) } : {}) });
      const colors = await page.evaluate(async ({ png, points }) => {
        const image = new Image(); image.src = 'data:image/png;base64,' + png; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ink = canvas.getContext('2d'); ink.drawImage(image, 0, 0);
        return [.25, .5, .75].map(t => {
          const x = points[0][0] + t * (points[1][0] - points[0][0]), y = points[0][1] + .7 * (points[3][1] - points[0][1]);
          return Array.from(ink.getImageData(Math.floor(x * image.width / innerWidth), Math.floor(y * image.height / innerHeight), 1, 1).data).slice(0, 3);
        });
      }, { png: screenshot.toString('base64'), points: measured.points });
      // Existing additive stage beams brighten the blue fixture without hiding it.
      for (const [red, green, blue] of colors) {
        expect.soft(green, `${seat.id}: visible player green`).toBeGreaterThanOrEqual(100);
        expect.soft(blue, `${seat.id}: visible player blue`).toBeGreaterThanOrEqual(155);
        expect.soft(blue - red, `${seat.id}: player color survives compositing`).toBeGreaterThan(100);
      }
      if (seat === config.seats[0]) {
        const resized = viewport.width === 1280 ? { width: 390, height: 844 } : { width: 1280, height: 720 };
        await page.setViewportSize(resized);
        await expect.poll(() => page.evaluate(() => arena.camera.aspect)).toBeCloseTo(resized.width / resized.height);
        expect(await page.evaluate(() => arena.camera.position.toArray())).toEqual(measured.cameraPosition);
        await page.setViewportSize(viewport);
        await expect.poll(() => page.evaluate(() => arena.camera.aspect)).toBeCloseTo(viewport.width / viewport.height);
      }
      await page.evaluate(() => seatBackContext.events.dispatchEvent(new CustomEvent('input:action', { detail: { action: 'sit', down: true } })));
      await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBeNull();
      expect(await page.evaluate(() => arena.camera.zoom)).toBe(1);
    }
    console.log('T30s seated geometry', JSON.stringify(measurements));
    expect(errors).toEqual([]);
  });
}
