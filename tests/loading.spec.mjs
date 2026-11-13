import { test, expect } from '@playwright/test';

// T65: the first visit is covered by a "로딩 중" screen until the arena is ready.
const overlay = page => page.getByRole('dialog', { name: '경기장 로딩 중' });

test('first page comes first; clicking 들어가기 before ready shows the cover, which lifts straight into the arena', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.route('**/arena-v2.glb', async route => { await new Promise(r => setTimeout(r, 3000)); await route.continue(); }); // keep it loading past the click
  await page.goto('/');
  const cover = overlay(page), enter = page.getByRole('button', { name: '들어가기', exact: true });
  await expect(cover).toBeHidden();
  await expect(enter).toBeEnabled(); // clickable before the arena is ready (architecture #enter)
  await expect(enter).toBeFocused();
  await enter.click();
  await expect(cover).toBeVisible();
  await expect(cover).toHaveAttribute('aria-busy', 'true');
  await expect(cover.getByRole('progressbar', { name: '로딩 진행률' })).toBeVisible();
  await expect(cover).toBeHidden({ timeout: 85_000 });
  await expect(page.locator('#panel')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-hud', 'walking');
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
});

// tests/serve.mjs sends no Content-Length, so main.js never writes "N%" here (start.ps1's python server does).
// Hold the GLB open and write the same #status text main.js writes (web/main.js:72, :80).
test('loading screen follows the progress main.js reports', async ({ page }) => {
  await page.route('**/arena-v2.glb', () => {}); // never answered: stays loading
  await page.goto('/');
  await page.locator('#enter').click(); // the cover shows only after the click (first page comes first)
  const cover = overlay(page), bar = cover.getByRole('progressbar', { name: '로딩 진행률' });
  const report = text => page.evaluate(t => { document.querySelector('#status').textContent = t; }, text);
  await report('경기장 불러오는 중 12%');
  await expect(bar).toHaveJSProperty('value', 12);
  await expect(cover.getByRole('status')).toHaveText('경기장 불러오는 중 12%');
  await report('경기장 불러오는 중 48%');
  await expect(bar).toHaveJSProperty('value', 48);
  await report('경기장 조명 불러오는 중');
  await expect(cover.getByRole('status')).toHaveText('경기장 조명 불러오는 중');
  await expect(bar).not.toHaveAttribute('value');
  await expect(cover).toBeVisible();
});

test('loading screen keeps covering and shows the failure notice when the arena cannot load', async ({ page }) => {
  await page.route('**/arena-v2.glb', route => route.abort());
  await page.goto('/');
  const cover = overlay(page);
  await expect(cover.getByRole('heading')).toHaveText('경기장을 불러오지 못했습니다');
  await expect(cover.getByRole('button', { name: '다시 시도' })).toBeFocused();
  await expect(cover).toBeVisible();
  await expect(cover).toHaveAttribute('aria-busy', 'false');
  await expect(cover.getByRole('progressbar')).toBeHidden();
});
