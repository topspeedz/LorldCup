import { test, expect } from '@playwright/test';

test('arena loads and becomes ready with no page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
  expect(errors).toEqual([]);
});
