import { test, expect } from '@playwright/test';

// T65: the first visit is covered by a "로딩 중" screen until the arena is ready.
const overlay = page => page.getByRole('dialog', { name: '경기장 로딩 중' });

async function recordEntry(page) {
  await page.evaluate(async () => {
    const { events, APP_ENTER } = await import('./events.js');
    window.entryFrames = [];
    const sample = () => window.entryFrames.push({
      ready: arena.character.ready,
      dummyVisible: arena.avatar.children.some(o => o.isMesh && o.visible),
      fanAttached: !!arena.avatar.getObjectByName('FanRig'),
      coverHidden: document.querySelector('#loading').hidden,
    });
    events.addEventListener(APP_ENTER, () => { sample(); requestAnimationFrame(sample); });
  });
}

test('first page comes first; clicking 들어가기 before ready shows the cover, which lifts straight into the arena', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.route('**/arena-v2.glb', async route => { await new Promise(r => setTimeout(r, 3000)); await route.continue(); }); // keep it loading past the click
  await page.goto('/');
  const cover = overlay(page), enter = page.getByRole('button', { name: '들어가기', exact: true });
  await expect(cover).toBeHidden();
  await expect(enter).toBeEnabled(); // clickable before the arena is ready (architecture #enter)
  await expect(page.locator('#broadcasts button[data-broadcast="final"]')).toBeFocused(); // focus starts on the match banner
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

test('T73: the first uncovered frame has the fan and no dummy, even when its last uniform is delayed', async ({ page }) => {
  let uniform;
  await page.route('**/assets/characters/uniform-blg.png', route => { uniform = route; });
  await page.goto('/');
  await recordEntry(page);
  await page.locator('#enter').click();
  await page.waitForFunction(() => window.arena?.ready);
  await expect.poll(() => !!uniform).toBe(true);
  expect(await page.evaluate(() => arena.character.ready)).toBe(false);
  await expect(overlay(page)).toBeVisible();
  expect(await page.evaluate(() => entryFrames)).toEqual([]);
  await uniform.continue();
  await expect(overlay(page)).toBeHidden({ timeout: 30_000 });
  await expect.poll(() => page.evaluate(() => entryFrames.length)).toBe(2);
  expect(await page.evaluate(() => entryFrames)).toEqual([
    { ready: true, dummyVisible: false, fanAttached: true, coverHidden: true },
    { ready: true, dummyVisible: false, fanAttached: true, coverHidden: true },
  ]);
});

for (const fallback of ['failure', 'timeout']) {
  test(`T73: character ${fallback} uncovers the dummy without blocking entry`, async ({ page }) => {
    let fan;
    if (fallback === 'timeout') await page.clock.install();
    await page.route('**/assets/characters/fan.glb', route => { fan = route; });
    await page.goto('/');
    await recordEntry(page);
    await page.locator('#enter').click();
    await page.waitForFunction(() => window.arena?.ready);
    await expect.poll(() => !!fan).toBe(true);
    await expect(overlay(page)).toBeVisible();
    if (fallback === 'failure') await fan.abort();
    else await page.clock.fastForward(30_001);
    await expect(overlay(page)).toBeHidden();
    await expect.poll(() => page.evaluate(() => entryFrames.length)).toBe(2);
    expect(await page.evaluate(() => entryFrames[0])).toEqual({
      ready: false, dummyVisible: true, fanAttached: false, coverHidden: true,
    });
    await expect(page.locator('body')).toHaveAttribute('data-hud', 'walking');
    if (fallback === 'failure') expect(await page.evaluate(() => arena.character.error)).toBeTruthy();
    else {
      await fan.continue();
      await page.waitForFunction(() => arena.character.ready);
      await expect(overlay(page)).toBeHidden();
      expect(await page.evaluate(() => entryFrames.length)).toBe(2); // late success cannot enter twice
    }
  });
}
