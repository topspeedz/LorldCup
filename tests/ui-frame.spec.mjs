import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
// Architecture 「고정 ID와 index.html」 (BL-0034/0035): the 16 static IDs after the mouse-first revision.
const fixedIds = ['enter', 'status', 'loading', 'panel', 'network', 'network-status', 'touch', 'hud', 'hud-keys', 'hud-toast', 'hud-objective', 'dock', 'settings', 'broadcasts', 'showtimes', 'entry-notice'];
const removedIds = ['quick', 'crowd-sound', 'zone', 'hud-state', 'room-code', 'host-room', 'join-room', 'leave-room', 'hud-room', 'fallback', 'walk-resume', 'menu-open', 'cross'];
// Rows whose value cell is one plain value; compound rows (focus-ring) and env(*) are not single CSS values.
const tokens = [...read('docs/live/graphicmodel/ui/tokens.md').matchAll(/^\| `([a-z0-9-]+)` \| `([^`]+)` \|/gm)]
  .map(([, name, value]) => [name, value]).filter(([, value]) => !value.includes('*'));

async function openArena(page, { enter = true } = {}) {
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
  if (enter) await page.locator('#enter').click();
}
const hudState = page => page.locator('#hud').getAttribute('data-state');
const emit = (page, name, detail) => page.evaluate(async ([name, detail]) => {
  const { events } = await import('./events.js');
  events.dispatchEvent(new CustomEvent(name, { detail }));
}, [name, detail]);

test('index.html has the 16 fixed IDs, none of the 14 removed ones, and no style hiding things by body.walking', () => {
  const html = read('web/index.html');
  expect(fixedIds.filter(id => html.includes(`id="${id}"`))).toEqual(fixedIds);
  expect(removedIds.filter(id => html.includes(`id="${id}"`))).toEqual([]);
  expect(html).not.toMatch(/body\.walking/);
  expect(html).toContain('href="./ui/tokens.css"');
});

test('tokens.css defines every token of tokens.md with the same value', async ({ page }) => {
  expect(tokens.length).toBeGreaterThan(40);
  await openArena(page, { enter: false });
  const actual = await page.evaluate(names => {
    const style = getComputedStyle(document.documentElement);
    return Object.fromEntries(names.map(name => [name, style.getPropertyValue(`--${name}`).trim()]));
  }, tokens.map(([name]) => name));
  expect(actual).toEqual(Object.fromEntries(tokens));
});

test('data-state: entry → walking → seated → full and back; key hints sit top-right and never list Esc or R', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await openArena(page, { enter: false });
  expect(await hudState(page)).toBe('entry');
  await expect(page.locator('#hud')).toBeHidden();
  const keys = () => page.locator('#hud-keys').innerText();

  await page.locator('#enter').click();
  await expect.poll(() => hudState(page)).toBe('walking');
  await expect(page.locator('body')).toHaveAttribute('data-hud', 'walking');
  for (const key of ['WASD', 'Space', 'Shift', 'Ctrl', 'F']) expect(await keys()).toContain(key);
  expect(await keys()).not.toMatch(/Esc|\bR\b/);
  const box = await page.locator('#hud-keys').boundingBox();
  expect(box.x + box.width).toBeGreaterThan(1280 * .8);
  expect(box.y).toBeLessThan(720 * .15);

  await page.keyboard.press('Escape'); // Esc changes nothing on screen (UX E9)
  expect(await hudState(page)).toBe('walking');
  await expect(page.locator('#dock')).toBeVisible();

  await emit(page, 'seat:enter', { seatId: 'probe' });
  await expect.poll(() => hudState(page)).toBe('seated');
  // T67: seated, the keys sit on the bar under the screen (#dock); the top-right key box hides so they do not repeat.
  await expect(page.locator('#hud-keys')).toBeHidden();
  await emit(page, 'fullmode:enter');
  await expect.poll(() => hudState(page)).toBe('full');
  await expect(page.locator('#hud')).toBeHidden();
  await emit(page, 'fullmode:exit');
  await expect.poll(() => hudState(page)).toBe('seated');
  await emit(page, 'seat:exit');
  await expect.poll(() => hudState(page)).toBe('walking'); // there is no `free`
});

test('walking layout: key hints, settings, objective and dock do not overlap at 1280x720 and 1024x640', async ({ page }) => {
  await openArena(page);
  await expect.poll(() => hudState(page)).toBe('walking');
  for (const size of [{ width: 1280, height: 720 }, { width: 1024, height: 640 }]) {
    await page.setViewportSize(size);
    const overlaps = await page.evaluate(() => {
      const boxes = ['#hud-keys', '#settings', '#hud-objective', '#dock'].map(sel => [sel, document.querySelector(sel)])
        .filter(([, el]) => el.checkVisibility()).map(([sel, el]) => [sel, el.getBoundingClientRect()]);
      const hits = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const [a, r] = boxes[i], [b, s] = boxes[j];
        if (r.left < s.right && s.left < r.right && r.top < s.bottom && s.top < r.bottom) hits.push(`${a}×${b}`);
      }
      const outside = boxes.filter(([, r]) => r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight).map(([sel]) => sel);
      return { hits, outside, count: boxes.length, panel: document.querySelector('#panel').checkVisibility() };
    });
    expect(overlaps, JSON.stringify(size)).toEqual({ hits: [], outside: [], count: 4, panel: false });
  }
});

test('hud:toast shows text only, keeps at most two and removes them after ms', async ({ page }) => {
  await openArena(page);
  const toast = page.locator('#hud-toast');
  await expect(toast).toHaveAttribute('role', 'status');
  await emit(page, 'hud:toast', { text: 'first', ms: 5000 });
  await emit(page, 'hud:toast', { text: '<b>second</b>', ms: 5000 });
  await emit(page, 'hud:toast', { text: 'third', tone: 'warning', ms: 400 });
  await expect(toast.locator(':scope > *')).toHaveCount(2);
  await expect(toast).not.toContainText('first');
  await expect(toast.locator('b')).toHaveCount(0);
  await expect(toast).toContainText('<b>second</b>');
  await expect(toast).toContainText('⚠');
  await expect(toast).not.toContainText('third', { timeout: 3000 });
});

test.describe('touch 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  // H-W10 overlap B (BL-0029, T27f): the #dock buttons and its empty grid cells stay off the arrow pad in walking and seated.
  test('H-W10: #dock does not cover #touch and the ← arrow gets the touch, walking and seated', async ({ page }) => {
    await openArena(page);
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('touch'))).toBe(true);
    await expect.poll(() => hudState(page)).toBe('walking');
    const check = () => page.evaluate(() => {
      const dock = document.querySelector('#dock'), pad = document.querySelector('#touch'), left = pad.querySelector('[aria-label="왼쪽"]');
      const d = dock.getBoundingClientRect(), t = pad.getBoundingClientRect(), a = left.getBoundingClientRect();
      const hit = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
      return {
        dockShown: dock.checkVisibility(), buttons: [...dock.children].filter(el => el.checkVisibility()).length,
        overlap: d.left < t.right && t.left < d.right && d.top < t.bottom && t.top < d.bottom, arrow: hit === left
      };
    });
    const walking = await check();
    expect(walking, 'walking').toMatchObject({ dockShown: true, overlap: false, arrow: true });
    expect(walking.buttons, 'walking').toBeGreaterThan(0);
    await emit(page, 'seat:enter', { seatId: 'probe' });
    await expect.poll(() => hudState(page)).toBe('seated');
    const seated = await check();
    expect(seated, 'seated').toMatchObject({ dockShown: true, overlap: false, arrow: true });
    expect(seated.buttons, 'seated').toBeGreaterThan(1);
  });
});
