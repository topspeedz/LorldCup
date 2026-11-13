import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// The verify scripts are bare function expressions (made for Playwright MCP's browser_run_code_unsafe), not modules.
const load = name => (0, eval)(readFileSync(new URL(`../web/${name}`, import.meta.url), 'utf8'));

for (const name of ['verify-tps.mjs', 'verify-jump.mjs']) {
  test(name, async ({ page, baseURL }) => {
    test.setTimeout(180_000); // 2-3 page loads plus PeerJS connects (TPS took 49 s on the GPU)
    const result = await load(name)(page, baseURL);
    expect(result.passed).toBe(true);
  });
}
