// Concurrent `npm test` runs (GPU slots) must not clear each other's output: each run writes under test-results/<run id>.
import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

test('this run writes into its own test-results/<run id>', async ({}, testInfo) => {
  const id = process.env.PW_RUN_ID;
  expect(id, 'run id is set once by the runner and shared with workers').toBeTruthy();
  expect(relative(resolve('test-results'), testInfo.project.outputDir)).toBe(id);
  // Left behind on purpose: a later overlapping run must not delete it.
  writeFileSync(testInfo.outputPath('marker.txt'), id);
});
