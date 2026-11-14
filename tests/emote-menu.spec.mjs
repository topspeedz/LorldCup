import { test, expect } from '@playwright/test';

// BL-0009 (decisions 14, 15), T95: a lone Ctrl tap opens a 2x2 emote menu; each button requests its own emote.
const emotes = [['박수 환호', 'cheer_clap'], ['하트', 'heart'], ['화내기', 'angry'], ['계란 던지기', 'egg_throw']];

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
    // T95: record whether Ctrl combos keep their browser default (copy, close tab...).
    window.__combo = [];
    window.addEventListener('keydown', e => { if (e.ctrlKey && e.code !== 'ControlLeft' && e.code !== 'ControlRight') __combo.push([e.code, e.defaultPrevented]); });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
  await page.locator('#enter').click(); // into the arena: the dock and walking input exist from app:enter
  // T73: loading waits for the character before app:enter, and input ignores keys until then; wait for entry like a user.
  await expect(page.locator('#hud')).not.toHaveAttribute('data-state', 'entry', { timeout: 120_000 });
  await page.evaluate(async () => {
    const { events } = await import('./events.js');
    window.__requests = [];
    events.addEventListener('emote:request', e => __requests.push(e.detail));
  });
  return errors;
}
const menu = page => page.getByRole('dialog', { name: '감정표현' });
const requests = page => page.evaluate(() => window.__requests);

test('a lone Ctrl tap shows four square buttons in a 2x2 grid and it stays open', async ({ page }) => {
  const errors = await open(page);
  await expect(menu(page)).toBeHidden();
  await page.keyboard.press('Control');
  await expect(menu(page)).toBeVisible();
  const boxes = [];
  for (const [name] of emotes) boxes.push(await menu(page).getByRole('button', { name }).boundingBox());
  expect(await menu(page).getByRole('button').count()).toBe(4);
  for (const b of boxes) expect(Math.abs(b.width - b.height)).toBeLessThan(2);
  expect(new Set(boxes.map(b => Math.round(b.x))).size).toBe(2);
  expect(new Set(boxes.map(b => Math.round(b.y))).size).toBe(2);
  expect(errors).toEqual([]);
});

test('T95: Ctrl held with another key (Ctrl+C) never opens the menu and keeps the browser default; Alt no longer opens it', async ({ page }) => {
  await open(page);
  const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.keyboard.press('Control+KeyC');
  await settle();
  await expect(menu(page)).toBeHidden();
  // Ctrl released after the other key: still a combo, not a tap.
  await page.keyboard.down('ControlLeft'); await page.keyboard.down('KeyC'); await page.keyboard.up('KeyC'); await page.keyboard.up('ControlLeft');
  await settle();
  await expect(menu(page)).toBeHidden();
  expect(await page.evaluate(() => window.__combo)).toEqual([['KeyC', false], ['KeyC', false]]);
  // A mouse press while Ctrl is held cancels the tap too.
  await page.keyboard.down('ControlLeft'); await page.mouse.click(5, 300); await page.keyboard.up('ControlLeft');
  await settle();
  await expect(menu(page)).toBeHidden();
  for (const key of ['Alt', 'AltLeft', 'AltRight']) await page.keyboard.press(key);
  await settle();
  await expect(menu(page)).toBeHidden();
});

test('Ctrl again and Esc close the menu; ControlRight works like ControlLeft', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Control');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Control');
  await expect(menu(page)).toBeHidden();
  await page.keyboard.press('ControlRight');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('ControlRight');
  await expect(menu(page)).toBeHidden();
  await page.keyboard.press('Control');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  expect(await requests(page)).toEqual([]);
});

test('each button sends its own emote:request and closes the menu', async ({ page }) => {
  const errors = await open(page);
  for (const [name] of emotes) {
    await page.keyboard.press('Control');
    await menu(page).getByRole('button', { name }).click();
    await expect(menu(page)).toBeHidden();
  }
  expect(await requests(page)).toEqual(emotes.map(([, id]) => ({ id })));
  expect(errors).toEqual([]);
});

test('emoteMenu:open (ticket "응원하기") opens the same menu', async ({ page }) => {
  await open(page);
  await page.evaluate(async () => {
    const { events } = await import('./events.js');
    events.dispatchEvent(new CustomEvent('emoteMenu:open'));
  });
  await expect(menu(page)).toBeVisible();
  await menu(page).getByRole('button', { name: '하트' }).click();
  await expect(menu(page)).toBeHidden();
  expect(await requests(page)).toEqual([{ id: 'heart' }]);
});

test('opening pauses movement keys; picking or Esc hands them back (no pointer lock anywhere)', async ({ page }) => {
  await open(page);
  await page.waitForFunction(() => document.body.classList.contains('walking'));
  await page.keyboard.press('Control');
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/walking/); // mouse-first: Esc must not strand the avatar
  await page.keyboard.press('Control');
  await expect(menu(page)).toBeVisible();
  await expect(page.locator('body')).not.toHaveClass(/walking/);
  await menu(page).getByRole('button', { name: '화내기' }).click();
  await expect(page.locator('body')).toHaveClass(/walking/);
  const before = await page.evaluate(() => arena.player.clone());
  await page.keyboard.down('KeyW');
  await page.waitForFunction(p => arena.player.distanceTo(p) > 0.3, before);
  await page.keyboard.up('KeyW');
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
});
