// `npm run walk -- <path>/<name>.walk.mjs`: UX walks and diagnostics in Playwright test form, run by the same runner as
// `npm test`, so the GPU lock (shared slot, held by this runner process), the web/ server and the shutdown live in one place.
// A walk file sits in a worker's folder or temp/<Task>/, never in tests/. Env: WALK_TIMEOUT_MS (one test, default 150 s),
// WALK_GLOBAL_TIMEOUT_MS (whole run, default 20 min of work + GPU_LOCK_WAIT_MS, because Playwright counts globalSetup —
// the GPU queue wait — inside globalTimeout). A hang after the slot is taken is cut by the per-test cap (afterAll too).
import { defineConfig } from '@playwright/test';
import { dirname, resolve } from 'node:path';

// The runner sees the file argument; its workers do not, but they inherit the env set here (like PW_RUN_ID).
process.env.WALK_DIR ??= dirname(resolve(process.argv.find(a => a.endsWith('.walk.mjs')) ?? 'temp'));
process.env.PW_RUN_ID ??= process.env.GPU_LOCK_OWNER || `walk-${process.pid}`;

export default defineConfig({
  testDir: process.env.WALK_DIR,
  testMatch: '*.walk.mjs',
  timeout: Number(process.env.WALK_TIMEOUT_MS) || 150_000,
  globalTimeout: Number(process.env.WALK_GLOBAL_TIMEOUT_MS) || 20 * 60_000 + (Number(process.env.GPU_LOCK_WAIT_MS) || 30 * 60_000),
  workers: 1,
  reporter: 'list',
  outputDir: `../test-results/${process.env.PW_RUN_ID}`, // config-relative, like playwright.config.mjs
  globalSetup: './global-setup.mjs',
  use: { baseURL: process.env.ARENA_URL, channel: 'chromium' },
});
