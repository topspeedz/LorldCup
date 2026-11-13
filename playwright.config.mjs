import { defineConfig } from '@playwright/test';

// Concurrent runs (GPU slots) each get their own output folder, so `clear output` only empties this run's.
// Set once in the runner; workers re-read this file but inherit the env, so they get the same id.
process.env.PW_RUN_ID ??= process.env.GPU_LOCK_OWNER || `run-${process.pid}`;

export default defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.mjs',
  timeout: 90_000,
  workers: 1, // one browser job at a time (GPU lock)
  reporter: 'list',
  outputDir: `test-results/${process.env.PW_RUN_ID}`,
  globalSetup: './tests/global-setup.mjs',
  // channel 'chromium' renders WebGL on the real GPU; the default headless shell falls back to SwiftShader and the arena stalls.
  use: { baseURL: process.env.ARENA_URL, channel: 'chromium' },
});
