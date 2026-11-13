import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// T31 (BL-0031 (1)(2)(3)): HUD control bar and Full Mode in the real app.
// Rows: docs/live/product/ux/full-mode.md and hud-controls.md `## 5. 상태별 확인 표`.
const seats = JSON.parse(readFileSync(new URL('../web/config/seats.json', import.meta.url), 'utf8'));
const screenConfig = JSON.parse(readFileSync(new URL('../web/config/screen.json', import.meta.url), 'utf8'));

async function openArena(page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready && window.arena.screen);
  await page.locator('#enter').click(); // into the arena
}

async function sit(page) {
  await page.evaluate(seat => arena.go([...seat.position, 0]), seats.seats[0]);
  await page.keyboard.press('KeyE');
  await expect.poll(() => page.evaluate(() => arena.seat?.seatId)).toBe(seats.seats[0].id);
  await expect.poll(() => page.evaluate(() => document.body.dataset.hud)).toBe('seated');
}

const openButton = page => page.locator('#full-mode-open');
const closeButton = page => page.getByRole('button', { name: 'Full Mode 닫기 (Esc)' });

test('F-W1~F-W3 / BL-0031 (3): right after sitting, with no other key, Full Mode is visible, opens with one click and closes back to the seat', async ({ page }) => {
  await openArena(page);
  await sit(page);
  const open = openButton(page);
  await expect(open).toBeVisible();
  await expect(open).toHaveCSS('visibility', 'visible');
  await expect(open).toContainText('Full Mode');
  await expect(open.locator('kbd')).toHaveCount(0); // keys live in the #hud-keys box, not on dock buttons
  expect(await open.evaluate(el => el.parentElement.id)).toBe('dock');
  // Seated: the Full Mode button is the emphasised button of the state (ui/full-mode.md).
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
  const background = await open.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await page.evaluate(c => { const e = document.createElement('i'); e.style.color = c; document.body.append(e); const v = getComputedStyle(e).color; e.remove(); return v; }, accent)).toBe(background);

  await open.click();
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  await expect(closeButton(page)).toBeVisible();
  await expect(closeButton(page)).toBeFocused();
  await closeButton(page).click();
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(false);
  expect(await page.evaluate(() => arena.seat.seatId)).toBe(seats.seats[0].id);
  await expect.poll(() => page.evaluate(() => document.body.dataset.hud)).toBe('seated');
  await expect(open).toBeVisible();
});

test('F-W9: E, Alt and W do nothing in Full Mode entered from a seat', async ({ page }) => {
  await openArena(page);
  await sit(page);
  await openButton(page).click();
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  for (const key of ['KeyE', 'AltLeft', 'KeyW']) {
    await page.keyboard.down(key);
    await page.waitForFunction(() => new Promise(requestAnimationFrame));
    await page.keyboard.up(key);
  }
  await page.waitForFunction(() => new Promise(requestAnimationFrame));
  expect(await page.evaluate(() => ({ full: arena.screen.fullMode, seat: arena.seat.seatId, emote: !!document.querySelector('#emote-menu:not([hidden])') })))
    .toEqual({ full: true, seat: seats.seats[0].id, emote: false });
});

test('H-W6 / F-W7: the bar has a sound button, volume and a read-only source; Full Mode adds its state and close button in the bar', async ({ page }) => {
  await openArena(page);
  await expect.poll(() => page.evaluate(() => document.body.dataset.hud)).toBe('walking');
  const bar = page.locator('#arena-screen-controls');
  expect(await bar.evaluate(el => el.parentElement.id)).toBe('settings'); // BL-0034: sound and volume sit in the settings group
  await expect(bar.getByRole('combobox')).toHaveCount(0);
  await expect(bar.getByRole('slider', { name: '영상 음량' })).toHaveValue(String(screenConfig.volume));
  await expect(bar.getByRole('button', { name: /^소리 (끄기|켜기)$/ })).toBeVisible();
  await expect(bar.locator('#arena-screen-source')).toHaveText(/^지금: (재방|생방송)$/);

  await openButton(page).click();
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  const layout = await page.evaluate(() => {
    const bar = document.querySelector('#arena-screen-controls').getBoundingClientRect(), video = arena.screen.element.getBoundingClientRect();
    const inBar = id => { const b = document.querySelector(id).getBoundingClientRect(); return b.top >= bar.top - 1 && b.bottom <= bar.bottom + 1; };
    return { bottom: Math.round(bar.bottom), width: Math.round(bar.width), clear: bar.top >= video.bottom - 1, notice: document.querySelector('#arena-screen-notice').hidden || inBar('#arena-screen-notice'), noticeFloating: getComputedStyle(document.querySelector('#arena-screen-notice')).position === 'fixed', state: document.querySelector('#arena-screen-controls [data-full-state]')?.textContent };
  });
  expect(layout).toEqual({ bottom: 720, width: 1280, clear: true, notice: true, noticeFloating: false, state: 'Full Mode' });
  const close = await closeButton(page).boundingBox();
  expect(close.height).toBeGreaterThanOrEqual(44);
  expect(close.x + close.width).toBeGreaterThan(1280 - 40);
});

// E-W8 (T34/T30 walk, coordinator msg_db15089d6326): seated, the emote menu opened from the dock is visible, clear of the player
// (legal S-2: never over it) and an emote can be picked.
test('E-W8: seated, the emote menu is visible clear of the player and an emote can be chosen', async ({ page }) => {
  await openArena(page);
  await sit(page);
  await page.locator('#emote-open').click();
  const menu = page.locator('#emote-menu');
  await expect(menu).toBeVisible();
  // The video rectangle is the player only while it shows a picture (visibility visible) — the same rule screen-video.js
  // hideOverlaps/keepClear uses to move the menu aside (recheck R6: "메뉴가 영상 오른쪽으로 비켜 섬", 겹침 0). A hidden player
  // (no picture yet in the test) is not video on screen: nothing can cover it (docs/live/graphicmodel/ui/emote-menu.md:36
  // "장면과 영상을 가리지 않는다"; hud-controls.md 「'늘 보인다'의 예외」). T47 원인 7, 로그 42.
  const read = () => page.evaluate(() => {
    const m = document.querySelector('#emote-menu'), b = m.getBoundingClientRect(), p = arena.screen.element, r = p.getBoundingClientRect();
    const video = getComputedStyle(p).visibility === 'visible' && r.width > 0 && r.height > 0;
    return { visible: getComputedStyle(m).visibility === 'visible', clear: !video || !(Math.min(b.right, r.right) > Math.max(b.left, r.left) && Math.min(b.bottom, r.bottom) > Math.max(b.top, r.top)),
      inside: b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight };
  });
  console.log('E-W8 geometry', JSON.stringify(await page.evaluate(() => ({ menu: document.querySelector('#emote-menu').getBoundingClientRect().toJSON(), player: arena.screen.element.getBoundingClientRect().toJSON(), playerVisibility: getComputedStyle(arena.screen.element).visibility }))));
  await expect.poll(read).toEqual({ visible: true, clear: true, inside: true });
  await menu.locator('.emote').first().click();
  await expect(menu).toBeHidden();
});
