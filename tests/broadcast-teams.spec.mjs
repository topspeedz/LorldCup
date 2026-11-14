// Per-match teams: each broadcast names its two teams; the crowd jerseys, lightsticks, stage backdrops, ticket and
// team picker follow them (web/team-theme.js). The final keeps the arena model's own GEN.G/BLG look.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { pickBroadcast, broadcastTeams, themeCrowdConfig } from '../web/team-theme.js';

const read = name => JSON.parse(readFileSync(new URL(`../web/config/${name}.json`, import.meta.url), 'utf8'));
const teams = read('teams'), { broadcasts } = read('broadcasts'), crowd = read('crowd');
const of = id => broadcastTeams(teams, broadcasts.find(b => b.id === id));

test('each match resolves its two teams in banner order, one per arena slot; the final is the model default', () => {
  expect(of('final').map(t => [t.id, t.slot])).toEqual([['geng', 'GEN.G'], ['blg', 'BLG']]);
  expect(of('sf-t1-blg').map(t => [t.id, t.slot])).toEqual([['t1', 'GEN.G'], ['blg', 'BLG']]);
  expect(of('sf-ig-geng').map(t => [t.id, t.slot])).toEqual([['ig', 'BLG'], ['geng', 'GEN.G']]);
  expect(pickBroadcast(broadcasts, '?b=sf-t1-blg').id).toBe('sf-t1-blg');
  expect(pickBroadcast(broadcasts, '?b=nope').id).toBe('final');
  expect(() => broadcastTeams(teams, { id: 'x', teams: ['t1', 'geng'] })).toThrow(); // two teams in one slot
  // Lightsticks: T1 red on the gold side, IG white on the cyan/pink side.
  expect(themeCrowdConfig(crowd, of('sf-t1-blg')).lightsticks.colors.Gold).toEqual([1, 0.012, 0.04]);
  expect(themeCrowdConfig(crowd, of('sf-ig-geng')).lightsticks.colors.Cyan).toEqual([1, 1, 1]);
  expect(themeCrowdConfig(crowd, of('final')).lightsticks.colors).toEqual({ Gold: [1, 0.47, 0.075], Cyan: [0.008, 0.68, 1], Pink: [1, 0.012, 0.3] });
});

async function openMatch(page, url) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.route('**/modules.js', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: `${await response.text()}
      for(const entry of modules){const original=entry.create;entry.create=ctx=>{window.teamProbe=ctx;return original(ctx);};}` });
  });
  await page.goto(url);
  await page.waitForFunction(() => window.arena?.ready && window.teamProbe, null, { timeout: 120_000 });
}
const look = page => page.evaluate(() => {
  const { root, config } = teamProbe, mat = name => { let m; root.traverse(o => { for (const x of o.isMesh ? [o.material].flat() : []) if (x.name === name) m = x; }); return m; };
  const src = m => m?.map?.image?.src ?? m?.map?.image?.currentSrc ?? '';
  return {
    teams: config('teams').teams.map(t => t.name),
    jerseyA: src(mat('AudienceDetail_GEN.G')), jerseyB: src(mat('AudienceDetail_BLG')),
    gold: mat('REF_Fan_REF_Gold')?.color.toArray().map(v => +v.toFixed(3)), cyan: mat('REF_Fan_REF_Cyan')?.color.toArray().map(v => +v.toFixed(3)),
    left: src(root.getObjectByName('REF_BackdropArtwork_-1')?.material), right: src(root.getObjectByName('REF_BackdropArtwork_1')?.material),
  };
});

test('clicking the T1 vs BLG banner reloads that match: showtimes step, T1 jerseys, red lightsticks, T1 backdrop, T1/BLG ticket', async ({ page }) => {
  await openMatch(page, '/');
  await page.locator('#broadcasts button[data-broadcast="sf-t1-blg"]').click();
  await page.waitForURL(/\?b=sf-t1-blg$/);
  await page.waitForFunction(() => window.arena?.ready && window.teamProbe, null, { timeout: 120_000 });
  await expect(page.locator('#showtimes-label')).toHaveText('4강전 T1 vs BLG 상영 시각');
  await expect(page.locator('#enter')).toBeFocused();
  const t1 = await look(page);
  expect(t1.teams).toEqual(['T1', 'BLG']);
  expect(t1.jerseyA).toContain('uniform-t1.png');
  expect(t1.jerseyB).toBe(''); // BLG keeps the model's own embedded jersey
  expect(t1.gold).toEqual([1, 0.012, 0.04]);
  expect(t1.left).toContain('team-backdrop-t1.jpg');
  expect(t1.right).toContain('team-backdrop-blg.png');
  // The ticket and the team picker list config('teams').teams: T1 and BLG.
  await page.locator('#enter').click();
  await page.locator('#team-select-open').click();
  const picker = page.getByRole('dialog', { name: '팀·캐릭터 선택' });
  for (const name of ['T1', 'BLG']) await expect(picker.getByRole('button', { name, exact: true })).toBeVisible();
  await expect(picker.getByRole('button', { name: 'GEN.G', exact: true })).toHaveCount(0);
});

test('IG vs Gen.G: IG takes the BLG side (white lightsticks, IG jersey and backdrop); Gen.G stays as the model has it', async ({ page }) => {
  await openMatch(page, '/?b=sf-ig-geng');
  const ig = await look(page);
  expect(ig.teams).toEqual(['IG', 'GEN.G']);
  expect(ig.jerseyB).toContain('uniform-ig.png');
  expect(ig.jerseyA).toBe('');
  expect(ig.cyan).toEqual([1, 1, 1]);
  expect(ig.right).toContain('team-backdrop-ig.jpg');
  expect(ig.left).toContain('team-backdrop-geng.png');
});

test('the final looks as before: model jerseys, gold and cyan lightsticks, GEN.G and BLG backdrops', async ({ page }) => {
  await openMatch(page, '/');
  const final = await look(page);
  expect(final.teams).toEqual(['GEN.G', 'BLG']);
  expect([final.jerseyA, final.jerseyB]).toEqual(['', '']);
  expect(final.gold).toEqual([1, 0.47, 0.075]);
});
