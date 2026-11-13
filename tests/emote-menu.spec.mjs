import { test, expect } from '@playwright/test';

// BL-0009 (decisions 14, 15): Alt opens a 2x2 emote menu; each button requests its own emote.
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
    // Record whether Alt's default action (browser menu bar) was suppressed.
    window.__alt = [];
    for (const type of ['keydown', 'keyup'])
      window.addEventListener(type, e => { if (e.key === 'Alt') __alt.push([type, e.defaultPrevented]); });
  });
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
  await page.locator('#enter').click(); // into the arena: the dock and walking input exist from app:enter
  await page.evaluate(async () => {
    const { events } = await import('./events.js');
    window.__requests = [];
    events.addEventListener('emote:request', e => __requests.push(e.detail));
  });
  return errors;
}
const menu = page => page.getByRole('dialog', { name: '감정표현' });
const requests = page => page.evaluate(() => window.__requests);

test('Alt shows four square buttons in a 2x2 grid; releasing Alt keeps it open', async ({ page }) => {
  const errors = await open(page);
  await expect(menu(page)).toBeHidden();
  await page.keyboard.down('Alt');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.up('Alt');
  await expect(menu(page)).toBeVisible();
  const boxes = [];
  for (const [name] of emotes) boxes.push(await menu(page).getByRole('button', { name }).boundingBox());
  expect(await menu(page).getByRole('button').count()).toBe(4);
  for (const b of boxes) expect(Math.abs(b.width - b.height)).toBeLessThan(2);
  expect(new Set(boxes.map(b => Math.round(b.x))).size).toBe(2);
  expect(new Set(boxes.map(b => Math.round(b.y))).size).toBe(2);
  expect(errors).toEqual([]);
});

test('Alt does not trigger the browser menu bar', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Alt');
  await page.keyboard.press('Alt');
  const alt = await page.evaluate(() => window.__alt);
  expect(alt.length).toBe(4);
  for (const [, prevented] of alt) expect(prevented).toBe(true);
});

test('Alt again and Esc close the menu', async ({ page }) => {
  await open(page);
  await page.keyboard.press('Alt');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Alt');
  await expect(menu(page)).toBeHidden();
  await page.keyboard.press('Alt');
  await expect(menu(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  expect(await requests(page)).toEqual([]);
});

test('each button sends its own emote:request and closes the menu', async ({ page }) => {
  const errors = await open(page);
  for (const [name] of emotes) {
    await page.keyboard.press('Alt');
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
  await page.keyboard.press('Alt');
  await page.keyboard.press('Escape');
  await expect(menu(page)).toBeHidden();
  await expect(page.locator('body')).toHaveClass(/walking/); // mouse-first: Esc must not strand the avatar
  await page.keyboard.press('Alt');
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
