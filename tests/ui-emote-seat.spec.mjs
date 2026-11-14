import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// T30 (BL-0031 (1)(2)(4), P-L-2): emote menu and seat UI per docs/live/product/ux/{emote-menu,seat}.md 5절
// and docs/live/graphicmodel/ui/{emote-menu,seat}.md.
const seats = JSON.parse(readFileSync(new URL('../web/config/seats.json', import.meta.url), 'utf8'));
test.setTimeout(90_000);

async function open(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    // Deterministic pointer lock; headless browsers differ.
    let locked = null;
    const fire = () => queueMicrotask(() => document.dispatchEvent(new Event('pointerlockchange')));
    Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get: () => locked });
    Element.prototype.requestPointerLock = function () { locked = this; fire(); return Promise.resolve(); };
    Document.prototype.exitPointerLock = function () { if (locked) { locked = null; fire(); } };
  });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      const entry=modules.find(m=>m.path==='seat-mode.js'),original=entry.create;
      entry.create=ctx=>{window.t30={ctx};const instance=original(ctx);t30.instance=instance;return instance;};` });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready && arena.character?.ready);
  await page.evaluate(() => {
    window.__requests = [];
    t30.ctx.events.addEventListener('emote:request', e => __requests.push(e.detail));
  });
  return errors;
}
const menu = page => page.getByRole('dialog', { name: '감정표현' });
const walking = page => page.evaluate(() => document.body.classList.contains('walking'));
async function enter(page) {
  await page.locator('#enter').click();
  await expect.poll(() => walking(page)).toBe(true);
}
async function nearSeat(page, seat = seats.seats[0]) {
  await page.evaluate(seat => {
    const { player } = t30.ctx;
    const approach = seat.standPosition.slice();
    approach[1] = player.groundAt(approach[0], approach[2], 0);
    player.teleport([...approach, 0]);
  }, seat);
}

test('E-W2/E-W12: a Ctrl tap opens the menu with names, close hint and a focus that stays inside', async ({ page }) => {
  const errors = await open(page);
  await enter(page);
  await page.keyboard.press('Control');
  await expect(menu(page)).toBeVisible();
  expect(await walking(page)).toBe(false);
  for (const name of ['박수 환호', '하트', '화내기', '계란 던지기']) await expect(menu(page).getByRole('button', { name, exact: true })).toBeVisible();
  await expect(menu(page)).toContainText('Ctrl·Esc 닫기');
  await expect(menu(page).getByRole('button', { name: '박수 환호' })).toBeFocused();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press(i % 2 ? 'Shift+Tab' : 'Tab');
    expect(await page.evaluate(() => document.querySelector('#emote-menu').contains(document.activeElement))).toBe(true);
  }
  // Arrows move in the 2x2 grid: right then down reaches the fourth emote.
  await menu(page).getByRole('button', { name: '박수 환호' }).focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await expect(menu(page).getByRole('button', { name: '계란 던지기' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menu(page)).toBeHidden();
  expect(await page.evaluate(() => __requests)).toEqual([{ id: 'egg_throw' }]);
  expect(errors).toEqual([]);
});

test('E-W6/E-D4: walking shows the HUD "감정표현" button (no Esc needed); outside click closes', async ({ page }) => {
  await open(page);
  await enter(page);
  const opener = page.locator('#dock #emote-open');
  await expect(opener).toBeVisible();
  await expect(opener).toContainText('감정표현');
  await expect(opener).toHaveAttribute('aria-expanded', 'false');
  await expect(opener).toHaveAttribute('aria-keyshortcuts', 'Control'); // T95
  await opener.click();
  await expect(menu(page)).toBeVisible();
  await expect(opener).toHaveAttribute('aria-expanded', 'true');
  await menu(page).getByRole('button', { name: '하트' }).click();
  await expect(menu(page)).toBeHidden();
  expect(await walking(page)).toBe(true); // picking hands movement keys back
  await opener.click();
  await expect(menu(page)).toBeVisible();
  await page.mouse.click(5, 300);
  await expect(menu(page)).toBeHidden();
  expect(await walking(page)).toBe(true); // an outside click must not strand movement either
  expect(await page.evaluate(() => __requests)).toEqual([{ id: 'heart' }]);
});

test('E-W10: Ctrl does nothing in Full Mode', async ({ page }) => {
  await open(page);
  await enter(page); // Ctrl acts only after app:enter (web/input.js:40); without it the last step could never open the menu
  await page.evaluate(() => t30.ctx.events.dispatchEvent(new CustomEvent('fullmode:enter')));
  await page.keyboard.press('Control');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await expect(menu(page)).toBeHidden();
  await page.evaluate(() => t30.ctx.events.dispatchEvent(new CustomEvent('fullmode:exit')));
  await page.keyboard.press('Control');
  await expect(menu(page)).toBeVisible();
});

test('S-W2/S-W10: walking shows "E 앉기" and the "앉기" button near a seat; marker colours follow tokens', async ({ page }) => {
  await open(page);
  await enter(page);
  const hint = page.locator('#hud-keys #seat-hint');
  // UX walk (T34): the plaza spawn is far from every seat, so the hint must not show there.
  await expect(hint).toBeHidden();
  await nearSeat(page);
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText('E앉기');
  await expect(hint.locator('kbd')).toHaveText('E');
  await expect(page.getByRole('button', { name: '앉기', exact: true })).toBeVisible(); // architecture #seat-toggle: shown while walking
  const colours = await page.evaluate(id => {
    const markers = t30.ctx.scene.getObjectByName('SeatMarkers').children;
    return { near: markers.find(m => m.name === id).material.color.getHexString(), other: markers.find(m => m.name !== id).material.color.getHexString() };
  }, seats.seats[0].id);
  expect(colours).toEqual({ near: 'edf6ff', other: '7fdcff' });
});

test('S-W3/S-W4/S-W8/E-W7/E-W8: seated frees the cursor, shows the action group, keys stand up and picks toast', async ({ page }) => {
  const errors = await open(page);
  await enter(page);
  await nearSeat(page);
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seats.seats[0].id);
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement || document.body.classList.contains('walking'))).toBe(false);
  await expect(page.locator('#hud')).toHaveAttribute('data-state', 'seated');
  await expect(page.locator('#dock').getByRole('button', { name: /일어나기$/ })).toBeVisible();
  await expect(page.locator('#dock #emote-open')).toBeVisible();
  // T67: seated, E shows once — as the "E / Esc" keycap on the bar's 일어나기 — and the top-right key box hides.
  await expect(page.locator('#hud-keys')).toBeHidden();
  expect(await page.locator('#seat-toggle').evaluate(el => getComputedStyle(el, '::before').content)).toBe('"E / Esc"');
  // T67 bar order: Full Mode, 일어나기, 감정표현.
  const order = await page.evaluate(() => [document.querySelector('#seat-toggle'), document.querySelector('#emote-open')].map(b => b.getBoundingClientRect().x));
  expect(order[0]).toBeLessThan(order[1]);
  await page.locator('#dock #emote-open').click();
  // E-W8 (coordinator msg_4beded3d8634): seated, the menu is one column so it fits beside the screen player.
  await expect(menu(page)).toBeVisible();
  const box = await page.evaluate(() => {
    const r = document.querySelector('#emote-menu').getBoundingClientRect();
    const xs = [...document.querySelectorAll('#emote-menu .emote')].map(b => Math.round(b.getBoundingClientRect().x));
    return { width: r.width, height: r.height, columns: new Set(xs).size };
  });
  expect(box.columns).toBe(1);
  expect(box.width).toBeLessThanOrEqual(230);
  expect(box.height).toBeLessThanOrEqual(460);
  await menu(page).getByRole('button', { name: '하트' }).click();
  await expect(page.locator('#hud-toast')).toContainText('하트를 보냈어요');
  expect(await page.evaluate(() => arena.seat.seatId)).toBe(seats.seats[0].id);
  // W stands up even though the cursor is free, and walking resumes.
  await page.keyboard.down('KeyW');
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(null);
  await page.keyboard.up('KeyW');
  await expect.poll(() => walking(page)).toBe(true);
  expect(errors).toEqual([]);
});

test('S-W7: the "일어나기" button stands up and walking resumes', async ({ page }) => {
  await open(page);
  await enter(page);
  await nearSeat(page);
  await page.getByRole('button', { name: '앉기', exact: true }).click();
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seats.seats[0].id);
  await page.getByRole('button', { name: /일어나기$/ }).click(); // T67: "E / Esc 일어나기" on the bar
  await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(null);
  await expect.poll(() => walking(page)).toBe(true);
});

test('P-L-2: the seat UI does not touch the DOM while nothing changes', async ({ page }) => {
  await open(page);
  await enter(page);
  await nearSeat(page);
  // FX2: read the prompt through the page (as the seat checks above do with expect.poll). In this run the locator's own
  // visibility polling never saw seat-mode's per-frame prompt land (hidden for 5 s), while page-side polling sees it in 0.5 s.
  await expect.poll(() => page.evaluate(() => !document.querySelector('#seat-toggle').hidden)).toBe(true);
  await expect(page.locator('#seat-toggle')).toBeVisible();
  const mutations = await page.evaluate(() => new Promise(resolve => {
    let count = 0;
    const observer = new MutationObserver(list => { count += list.length; });
    observer.observe(document.querySelector('#seat-toggle'), { attributes: true, childList: true, subtree: true, characterData: true });
    let frames = 0;
    const tick = () => { if (++frames < 30) requestAnimationFrame(tick); else { observer.disconnect(); resolve(count); } };
    requestAnimationFrame(tick);
  }));
  expect(mutations).toBe(0);
});

test.describe('touch', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('S-W11: on touch, after 들어가기 the arena still shows the "앉기" button near a seat', async ({ page }) => {
    await open(page);
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('touch'))).toBe(true);
    await enter(page);
    await nearSeat(page);
    await page.getByRole('button', { name: '앉기', exact: true }).tap();
    await expect.poll(() => page.evaluate(() => arena.seat.seatId)).toBe(seats.seats[0].id);
  });
});
