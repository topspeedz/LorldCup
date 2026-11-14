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
  // T67: wait out the loading cover (T73 holds it until the character is ready); a teleport during it is overwritten by the spawn.
  await expect(page.locator('#loading')).toBeHidden({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(() => document.body.dataset.hud)).toBe('walking');
}

async function sit(page) {
  // T67: from the seat's standPosition (as ui-emote-seat/seat-back do); seat.position itself is no longer within reach after T63b/T83.
  await page.evaluate(seat => arena.go([...seat.standPosition, 0]), seats.seats[0]);
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
  // Seated: the Full Mode button wears the dock's default colour, not the accent (사용자 2026-11-14 "풀모드 켜져있는거같애 기본색으로칠해").
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim());
  const background = await open.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(await page.evaluate(c => { const e = document.createElement('i'); e.style.color = c; document.body.append(e); const v = getComputedStyle(e).color; e.remove(); return v; }, accent)).not.toBe(background);

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

test('F-W9: E, Ctrl and W do nothing in Full Mode entered from a seat', async ({ page }) => {
  await openArena(page);
  await sit(page);
  await openButton(page).click();
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  for (const key of ['KeyE', 'ControlLeft', 'KeyW']) {
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
  // 사용자 2026-11-14 "화면에서 가운데 가리면안돼 화면 우측에 나오도록해줘": the menu sits on the right half, never over the centre.
  expect(await page.evaluate(() => document.querySelector('#emote-menu').getBoundingClientRect().left)).toBeGreaterThan(await page.evaluate(() => innerWidth / 2));
  await menu.locator('.emote').first().click();
  await expect(menu).toBeHidden();
});

// T67 (사용자 2026-11-14 "스크린 바로 아래에 크게 표시해줘 단축키를 F 풀모드 E일어나기 버튼 감정표현버튼 그리고 볼륨조절까지"):
// seated, one big bar right under the projected screen (bottom centre when it does not fit) with the four controls, never over the
// video, and no copy of them top-right or bottom-right.
const seatBar = page => page.evaluate(() => {
  const dock = document.querySelector('#dock'), b = dock.getBoundingClientRect(), r = arena.screen.element.getBoundingClientRect();
  const key = sel => getComputedStyle(document.querySelector(sel), '::before').content.replace(/"/g, '');
  const centre = Math.min(Math.max((r.left + r.right) / 2, b.width / 2 + 8), innerWidth - b.width / 2 - 8);
  const under = b.top >= r.bottom - 1;
  return {
    keys: [key('#full-mode-open'), key('#seat-toggle'), key('#emote-open')],
    order: ['#full-mode-open', '#seat-toggle', '#emote-open', '#seat-volume'].map(sel => Math.round(document.querySelector(sel).getBoundingClientRect().x)),
    clear: !(Math.min(b.right, r.right) > Math.max(b.left, r.left) && Math.min(b.bottom, r.bottom) > Math.max(b.top, r.top)),
    placed: under ? Math.abs((b.left + b.right) / 2 - centre) <= 2 && b.top - r.bottom <= 16 : Math.abs(innerHeight - b.bottom - parseFloat(getComputedStyle(dock).bottom)) <= 2 && Math.abs((b.left + b.right) / 2 - innerWidth / 2) <= 2,
    inside: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight,
    tall: Math.min(...[...dock.querySelectorAll('button')].filter(el => el.checkVisibility()).map(el => el.getBoundingClientRect().height)) >= 44,
    keyBox: document.querySelector('#hud-keys').checkVisibility(),
    settingsVolume: document.querySelector('#settings #arena-screen-controls input').checkVisibility(),
    geometry: { bar: b.toJSON(), screen: r.toJSON() },
  };
});

test('T67: seated, the bar under the screen holds F Full Mode, E / Esc 일어나기, Ctrl 감정표현 and the volume, clear of the video, with no copies', async ({ page }) => {
  await openArena(page);
  await sit(page);
  await expect.poll(async () => { const v = await seatBar(page); console.log('T67 geometry', JSON.stringify(v.geometry)); delete v.geometry; return v; }).toEqual({
    keys: ['F', 'E / Esc', 'Ctrl'], order: expect.any(Array), clear: true, placed: true, inside: true, tall: true, keyBox: false, settingsVolume: false,
  });
  const { order } = await seatBar(page);
  expect([...order].sort((a, b) => a - b)).toEqual(order); // F, E, 감정표현, 볼륨 from left to right
  const dock = page.locator('#dock');
  await expect(dock.getByRole('button', { name: /Full Mode/ })).toBeVisible();
  await expect(dock.getByRole('button', { name: /일어나기/ })).toBeVisible();
  await expect(dock.getByRole('button', { name: /감정표현/ })).toBeVisible();
  // 사용자 2026-11-14 "여기버튼을 일관되게 해줘 풀모드 켜져있는거같애 기본색으로칠해": Full Mode is not lit like an active toggle.
  const look = sel => page.evaluate(s => { const c = getComputedStyle(document.querySelector(s)); return [c.backgroundColor, c.color, c.borderColor]; }, sel);
  expect(await look('#full-mode-open')).toEqual(await look('#seat-toggle'));

  // Volume: the bar slider drives the one existing volume (screen-video.js userVolume), both ways.
  const slider = dock.getByRole('slider', { name: '영상 음량' });
  await expect(slider).toHaveValue(String(await page.evaluate(() => arena.screen.state.userVolume)));
  await slider.fill('30');
  await expect.poll(() => page.evaluate(() => arena.screen.state.userVolume)).toBe(30);
  await page.evaluate(() => arena.screen.setVolume(55));
  await expect(slider).toHaveValue('55');

  // 감정표현 opens the menu; Full Mode opens and closes back to the seat; 일어나기 stands.
  await dock.getByRole('button', { name: /감정표현/ }).click();
  await expect(page.locator('#emote-menu')).toBeVisible();
  await page.locator('#emote-menu .emote').first().click();
  await dock.getByRole('button', { name: /Full Mode/ }).click();
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  await closeButton(page).click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.hud)).toBe('seated');
  await dock.getByRole('button', { name: /일어나기/ }).click();
  await expect.poll(() => page.evaluate(() => document.body.dataset.hud)).toBe('walking');
  await expect(page.locator('#seat-volume')).toBeHidden();
  await expect(page.locator('#hud-keys')).toBeVisible(); // walking HUD unchanged
});

test('T67: on a narrower window the bar stays inside, placed by the same rule, and never covers the video', async ({ page }) => {
  await openArena(page);
  await page.setViewportSize({ width: 900, height: 600 });
  await sit(page);
  await expect.poll(async () => { const v = await seatBar(page); console.log('T67 narrow', JSON.stringify(v.geometry));
    return { clear: v.clear, placed: v.placed, inside: v.inside, tall: v.tall }; })
    .toEqual({ clear: true, placed: true, inside: true, tall: true });
});

test('T67 memo 1: seated Esc stands up, but first closes Full Mode or the emote menu only', async ({ page }) => {
  await openArena(page);
  await sit(page);
  await page.locator('#full-mode-open').click();
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => arena.screen.fullMode)).toBe(false);
  await page.waitForFunction(() => new Promise(requestAnimationFrame));
  expect(await page.evaluate(() => [document.body.dataset.hud, arena.seat?.seatId])).toEqual(['seated', seats.seats[0].id]);

  await page.locator('#emote-open').click();
  await expect(page.locator('#emote-menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#emote-menu')).toBeHidden();
  await page.waitForFunction(() => new Promise(requestAnimationFrame));
  expect(await page.evaluate(() => document.body.dataset.hud)).toBe('seated');

  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.body.dataset.hud)).toBe('walking');
});
