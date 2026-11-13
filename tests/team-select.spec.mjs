import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL(`../web/config/${name}.json`, import.meta.url), 'utf8'));
const { teams } = read('teams');
const characters = read('characters');

async function open(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
  await page.locator('#enter').click(); // the opener joins #dock at app:enter
  // Record every team/character event the bus sees.
  await page.evaluate(async () => {
    const { events } = await import('./events.js');
    window.__picks = [];
    window.__avatarMaterial = arena.avatar.userData.material;
    for (const name of ['team:changed', 'character:changed'])
      events.addEventListener(name, e => window.__picks.push([name, e.detail]));
  });
  return errors;
}
const picks = page => page.evaluate(() => window.__picks);
const dialog = page => page.getByRole('dialog', { name: '팀·캐릭터 선택' });
const uniform = page => page.evaluate(() => {
  let material;
  arena.avatar.traverse(o => { if (o.material?.name === 'Uniform') material = o.material; });
  if (!material?.map?.image) return null;
  const canvas = document.createElement('canvas'), c = canvas.getContext('2d');
  c.drawImage(material.map.image, 0, 0);
  const pixel = [...c.getImageData(20, 20, 1, 1).data].slice(0, 3);
  return { map: material.map.uuid, color: '#' + pixel.map(n => n.toString(16).padStart(2, '0')).join(''),
    legacySame: arena.avatar.userData.material === window.__avatarMaterial, legacyColor: arena.avatar.userData.material.color.getHexString() };
});

test('config: two teams GEN.G and BLG with colours, four characters with names and a default', () => {
  expect(teams.map(t => t.name)).toEqual(['GEN.G', 'BLG']);
  for (const t of teams) expect(t.color).toMatch(/^#[0-9a-f]{6}$/i);
  expect(characters.ids).toEqual(['fan_f1', 'fan_f2', 'fan_m1', 'fan_m2']);
  expect(characters.ids).toContain(characters.default);
  for (const id of characters.ids) expect(characters.names[id]).toBeTruthy();
});

test('one window holds both team and character choices and opens from a button', async ({ page }) => {
  const errors = await open(page);
  await expect(dialog(page)).toBeHidden();
  await page.getByRole('button', { name: '팀·캐릭터' }).click();
  const d = dialog(page);
  await expect(d).toBeVisible();
  const teamGroup = d.getByRole('group', { name: '응원팀' });
  const charGroup = d.getByRole('group', { name: '캐릭터' });
  for (const t of teams) await expect(teamGroup.getByRole('button', { name: t.name })).toHaveAttribute('aria-pressed', 'false');
  for (const id of characters.ids)
    await expect(charGroup.getByRole('button', { name: characters.names[id] }))
      .toHaveAttribute('aria-pressed', String(id === characters.default));
  expect(errors).toEqual([]);
});

test('picking a team and a character sends events; picking again changes the Uniform picture only', async ({ page }) => {
  const errors = await open(page);
  await expect.poll(() => uniform(page)).not.toBeNull();
  const before = await uniform(page);
  await page.getByRole('button', { name: '팀·캐릭터' }).click();
  const d = dialog(page);
  const [a, b] = teams;
  const other = characters.ids.find(id => id !== characters.default);

  await d.getByRole('button', { name: a.name }).click();
  await d.getByRole('button', { name: characters.names[other] }).click();
  await expect(d.getByRole('button', { name: a.name })).toHaveAttribute('aria-pressed', 'true');
  await expect(d.getByRole('button', { name: characters.names[other] })).toHaveAttribute('aria-pressed', 'true');
  await expect(d.getByRole('button', { name: characters.names[characters.default] })).toHaveAttribute('aria-pressed', 'false');
  expect(await picks(page)).toEqual([['team:changed', { teamId: a.id }], ['character:changed', { characterId: other }]]);
  const first = await uniform(page);
  expect(first.color).toBe(a.color.toLowerCase());
  expect(first.map).not.toBe(before.map);
  expect(first.legacySame).toBe(true);
  expect(first.legacyColor).toBe(before.legacyColor);

  await d.getByRole('button', { name: b.name }).click();
  await d.getByRole('button', { name: characters.names[characters.default] }).click();
  await expect(d.getByRole('button', { name: a.name })).toHaveAttribute('aria-pressed', 'false');
  await expect(d.getByRole('button', { name: b.name })).toHaveAttribute('aria-pressed', 'true');
  expect((await picks(page)).slice(2)).toEqual([['team:changed', { teamId: b.id }], ['character:changed', { characterId: characters.default }]]);
  const second = await uniform(page);
  expect(second.color).toBe(b.color.toLowerCase());
  expect(second.map).not.toBe(first.map);
  expect(second.legacySame).toBe(true);
  expect(second.legacyColor).toBe(before.legacyColor);

  // Picking the current choice again sends nothing new.
  await d.getByRole('button', { name: b.name }).click();
  expect(await picks(page)).toHaveLength(4);
  expect(errors).toEqual([]);
});

test('Esc and the close button close the window and give focus back to the opener', async ({ page }) => {
  await open(page);
  const opener = page.getByRole('button', { name: '팀·캐릭터' });
  await opener.click();
  await dialog(page).getByRole('button', { name: teams[0].name }).focus();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  await dialog(page).getByRole('button', { name: '팀·캐릭터 선택 닫기' }).click();
  await expect(dialog(page)).toBeHidden();
});
