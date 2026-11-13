import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL(`../web/config/${name}.json`, import.meta.url), 'utf8'));
const ticket = read('ticket');
const team = read('teams').teams[0];
const { x: bx, z: [z0, z1] } = ticket.barrier;
const midZ = (z0 + z1) / 2;

async function open(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.arena?.ready);
  await page.locator('#enter').click(); // into the arena (walking input on)
  return errors;
}
const fire = (page, name, detail) => page.evaluate(async ([name, detail]) => {
  const { events } = await import('./events.js');
  events.dispatchEvent(new CustomEvent(name, { detail }));
}, [name, detail]);
// Walks east in small steps from [x, z]; returns the furthest x reached.
const walkEast = (page, x, z, steps = 40) => page.evaluate(([x, z, steps]) => {
  arena.go([x, -.02, z, -Math.PI / 2]);
  for (let i = 0; i < steps; i++) arena.attempt(.25, 0);
  return arena.state.x;
}, [x, z, steps]);
const dialog = page => page.getByRole('dialog', { name: '입장 티켓' });

test('barrier sits on the first entrance opening from the config and blocks the opening, the side glass and jumps', async ({ page }) => {
  await open(page);
  expect(bx).toBeLessThan(-100); // outer glass opening, not the inner curtain wall (-95.6)
  expect(await walkEast(page, bx - 2, midZ)).toBeLessThan(bx);
  expect(await walkEast(page, bx - 2, z0 + .4)).toBeLessThan(bx);
  expect(await walkEast(page, bx - 2, z1 - .4)).toBeLessThan(bx);
  for (const z of [z0 - 3, z1 + 3, -40, 40]) expect(await walkEast(page, bx - 2, z)).toBeLessThan(ticket.sideGlass.x[0]);
  const jumped = await page.evaluate(async ([x, z]) => {
    arena.go([x, -.02, z, -Math.PI / 2]);
    document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown'));
    document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', cancelable: true }));
    document.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    let airborne = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(requestAnimationFrame);
      airborne ||= arena.state.airborne;
      arena.attempt(.1, 0);
    }
    return { airborne, x: arena.state.x };
  }, [bx - .6, midZ]);
  expect(jumped.airborne).toBe(true);
  expect(jumped.x).toBeLessThan(bx);
});

test('ticket window opens within the prompt distance only', async ({ page }) => {
  await open(page);
  await page.evaluate(([x, z]) => arena.go([x, -.02, z, -Math.PI / 2]), [bx - ticket.promptDistance - 2, midZ]);
  await expect(dialog(page)).toBeHidden();
  await page.evaluate(([x, z]) => arena.go([x, -.02, z, -Math.PI / 2]), [bx - ticket.promptDistance + .5, midZ]);
  await expect(dialog(page)).toBeVisible();
  await page.evaluate(() => arena.go('plaza'));
  await expect(dialog(page)).toBeHidden();
});

test('no ticket with only an emote: the entrance stays blocked, arena.go is not (no move buttons any more)', async ({ page }) => {
  await open(page);
  await fire(page, 'emote:played', { id: 'heart' });
  expect(await walkEast(page, bx - 2, midZ)).toBeLessThan(bx);
  await page.evaluate(() => arena.go('lobby'));
  expect(await page.evaluate(() => arena.state.x)).toBe(-83);
});

// T64 (2026-11-14 user change): the ticket is one big centred "응원할 팀 고르기" popup; a team click issues the ticket at once (no emote step).
test('T64 the ticket is a big centred team popup with no emote step; one team click issues a team-colour card and opens the entrance; reload starts over', async ({ page }) => {
  const errors = await open(page);
  await page.evaluate(([x, z]) => arena.go([x, -.02, z, -Math.PI / 2]), [bx - 2, midZ]);
  const d = dialog(page);
  await expect(d).toBeVisible();
  await expect(d.getByRole('heading', { name: '응원할 팀 고르기' })).toBeVisible();
  await expect(d.getByRole('button', { name: /감정표현/ })).toHaveCount(0);
  await expect(d.locator('kbd')).toHaveCount(0);
  const teams = read('teams').teams;
  for (const t of teams) await expect(d.getByRole('button', { name: t.name, exact: true })).toBeVisible();
  // Centred and big: its middle is the screen middle and it is wider than the old side window (360px).
  const b = await d.boundingBox(), v = page.viewportSize();
  expect(Math.abs(b.x + b.width / 2 - v.width / 2)).toBeLessThan(2);
  expect(Math.abs(b.y + b.height / 2 - v.height / 2)).toBeLessThan(2);
  expect(b.width).toBeGreaterThan(360);
  await page.evaluate(async () => {
    const { events } = await import('./events.js');
    events.addEventListener('ticket:issued', e => window.issued = e.detail);
  });
  expect(await walkEast(page, bx - 2, midZ)).toBeLessThan(bx);
  await page.evaluate(([x, z]) => arena.go([x, -.02, z, -Math.PI / 2]), [bx - 2, midZ]);
  await d.getByRole('button', { name: team.name, exact: true }).click();
  const card = d.getByRole('img', { name: new RegExp(team.name) });
  await expect(card).toBeVisible();
  const [r, g, bl] = [1, 3, 5].map(i => parseInt(team.color.slice(i, i + 2), 16));
  await expect(card).toHaveCSS('background-color', `rgb(${r}, ${g}, ${bl})`);
  await page.waitForFunction(() => window.issued);
  expect(await page.evaluate(() => window.issued)).toEqual({ teamId: team.id });
  await expect(d.getByText('입구가 열렸습니다')).toBeVisible();
  await expect.poll(() => walkEast(page, bx - 2, midZ)).toBeGreaterThan(bx + 1);
  // The team-and-character picker shows the same team as chosen.
  await page.locator('#team-select-open').click();
  await expect(page.getByRole('dialog', { name: '팀·캐릭터 선택' }).getByRole('button', { name: team.name })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);

  await page.reload();
  await page.waitForFunction(() => window.arena?.ready);
  expect(await walkEast(page, bx - 2, midZ)).toBeLessThan(bx);
});

test('T64 keyboard: the first team has focus, Tab moves to the next team, Enter issues; Esc before a pick closes it', async ({ page }) => {
  await open(page);
  await page.evaluate(([x, z]) => arena.go([x, -.02, z, -Math.PI / 2]), [bx - 2, midZ]);
  const d = dialog(page), teams = read('teams').teams;
  await expect(d.getByRole('button', { name: teams[0].name, exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(d).toBeHidden();
  await page.getByRole('button', { name: '입구 앞 · 티켓 창 열기' }).click();
  await expect(d.getByRole('button', { name: teams[0].name, exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(d.getByRole('button', { name: teams[1].name, exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(d.getByRole('img', { name: new RegExp(teams[1].name) })).toBeVisible();
  await expect(d.getByRole('button', { name: '들어가기' })).toBeFocused();
});

test.describe('T64 touch 390', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('a tap on a team issues the ticket and the popup fits the screen', async ({ page }) => {
    await open(page);
    await page.evaluate(([x, z]) => arena.go([x, -.02, z, -Math.PI / 2]), [bx - 2, midZ]);
    const d = dialog(page);
    await expect(d).toBeVisible();
    const b = await d.boundingBox();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390.5);
    expect(b.y + b.height).toBeLessThanOrEqual(844.5);
    await d.getByRole('button', { name: team.name, exact: true }).tap();
    await expect(d.getByText('입구가 열렸습니다')).toBeVisible();
  });
});

// X-H-1 / B-H-1: continuous walks (no teleport between steps) around both ends of the outer glass
// and down the corridor between the glass and the curtain wall must not get past the glass line without a ticket.
const walkPath = (page, points) => page.evaluate(points => {
  arena.go([points[0][0], -.02, points[0][1], 0]);
  for (const [tx, tz] of points.slice(1)) for (let i = 0; i < 800; i++) {
    const p = arena.player, dx = tx - p.x, dz = tz - p.z, l = Math.hypot(dx, dz);
    if (l < .2) break;
    if (!arena.attempt(dx / l * .2, dz / l * .2) && !arena.attempt(dx / l * .2, 0) && !arena.attempt(0, dz / l * .2)) break;
  }
  return [arena.state.x, arena.state.z];
}, points);
const pastGlass = ([x, z]) => x > ticket.sideGlass.x[1] && z > ticket.sideGlass.z[0] - 1 && z < ticket.sideGlass.z[1] + 1;

test('no ticket: walking around either end of the outer glass or down the glass-to-curtain-wall corridor does not get in', async ({ page }) => {
  await open(page);
  const routes = {
    'X-H-1 north end': [[-139, 0], [-110, 0], [-108, 8], [-108, 56], [-102.4, 59.8], [-92.8, 59.8], [-91.5, 54.4], [-92.5, 2.3]],
    'X-H-1 south end': [[-139, 0], [-110, 0], [-108, -8], [-108, -57], [-102.4, -61.3], [-92.8, -61.3], [-91.5, -54.4], [-92.5, 2.3]],
    'B-H-1 corridor from north': [[-90, 117], [-86, 70], [-95, 62], [-95, 34], [-95, 3], [-92.5, 2.3]],
    'B-H-1 corridor from south': [[-139, 0], [-120, -90], [-86, -75], [-86, -70], [-95, -63], [-95, -34], [-95, 3], [-92.5, 2.3]],
  };
  for (const [name, points] of Object.entries(routes)) expect(pastGlass(await walkPath(page, points)), name).toBe(false);
});
