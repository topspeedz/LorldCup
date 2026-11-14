// T29: entry-loading, team-select and ticket — rows of the 「5. 상태별 확인 표」 in docs/live/product/ux/{entry-loading,team-select,ticket}.md.
// BL-0034/0035 (FIX1d): the first page replaces the entry panel; nothing locks the pointer. First-page rows: tests/fix1-entry-hud.spec.mjs.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL(`../web/config/${name}.json`, import.meta.url), 'utf8'));
const ticket = read('ticket'), teams = read('teams').teams, chars = read('characters');
const { x: bx, z: [z0, z1] } = ticket.barrier, midZ = (z0 + z1) / 2;

async function open(page, { size = { width: 1280, height: 720 }, abort, enter = true } = {}) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  if (abort) await page.route(abort, route => route.abort());
  await page.setViewportSize(size);
  await page.goto('/');
  if (abort) return errors;
  // T73: app:enter waits for the character too (ui/loading.js isReady); wait for both so 들어가기 enters at once, like a user who waits for loading.
  await page.waitForFunction(() => window.arena?.ready && window.arena.character?.ready, null, { timeout: 120_000 });
  if (enter) await page.locator('#enter').click(); // mouse-first: everything in the arena exists from app:enter
  return errors;
}
const fire = (page, name, detail) => page.evaluate(async ([name, detail]) => {
  const { events } = await import('./events.js');
  events.dispatchEvent(new CustomEvent(name, { detail }));
}, [name, detail]);
const walking = page => page.evaluate(() => document.body.classList.contains('walking'));
const cover = page => page.getByRole('dialog', { name: '경기장 로딩 중' });
const picker = page => page.getByRole('dialog', { name: '팀·캐릭터 선택' });
const ticketDialog = page => page.getByRole('dialog', { name: '입장 티켓' });
const toNearGate = page => page.evaluate(([x, z]) => arena.go([x, -.02, z, -Math.PI / 2]), [bx - 2, midZ]);
const inViewport = async (locator, page) => {
  const b = await locator.boundingBox(), v = page.viewportSize();
  return b && b.x >= 0 && b.y >= 0 && b.x + b.width <= v.width + .5 && b.y + b.height <= v.height + .5;
};

// ---- entry-loading.md ----

test('E3·E4 load failure: user-words cause, focused "다시 시도", no start.ps1 on screen, retry reloads', async ({ page }) => {
  await open(page, { abort: '**/config/ticket.json' });
  const c = cover(page); // the failure shows on the cover even before 들어가기 is clicked
  await expect(c.getByText('경기장을 불러오지 못했습니다')).toBeVisible();
  await expect(c.getByText(/다시 시도하세요\./)).toBeVisible();
  const retry = c.getByRole('button', { name: '다시 시도' });
  await expect(retry).toBeFocused();
  await expect(c.getByRole('progressbar')).toBeHidden();
  expect(await page.evaluate(() => document.body.innerText)).not.toContain('start.ps1');
  await page.unroute('**/config/ticket.json');
  await Promise.all([page.waitForEvent('load'), retry.press('Enter')]);
  // Reloaded: the first page again (the cover comes only after 들어가기 — entry-loading.md:43 E4 :109); no failure left.
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0);
  await page.waitForFunction(() => window.arena?.ready, null, { timeout: 120_000 });
  await page.locator('#enter').click(); // the load from the start now succeeds: in the arena, no failure text
  await expect.poll(() => walking(page)).toBe(true);
  await expect(page.getByText('경기장을 불러오지 못했습니다')).toHaveCount(0);
});

test('E5·E7·E9·E10 first page: focused "들어가기", Enter goes in, Esc changes nothing, no "다시 걷기"', async ({ page }) => {
  const errors = await open(page, { enter: false });
  await expect(cover(page)).toBeHidden();
  const enter = page.getByRole('button', { name: '들어가기', exact: true });
  await expect(enter).toBeFocused();
  await page.keyboard.press('Enter');
  await expect.poll(() => walking(page)).toBe(true);
  await expect(page.locator('#panel')).toBeHidden();
  await page.keyboard.press('Escape');
  expect(await walking(page)).toBe(true);
  await expect(page.getByRole('button', { name: '다시 걷기' })).toHaveCount(0);
  await expect(page.locator('#enter')).toBeHidden();
  expect(errors).toEqual([]);
});

test('E8·K1 walking first view shows the next task "입구로 가서 티켓 받기"', async ({ page }) => {
  await open(page); // clicks #enter once (app:enter); #enter is hidden after that, so no second click
  await expect.poll(() => walking(page)).toBe(true);
  await expect(page.locator('#hud-objective')).toHaveText('입구로 가서 티켓 받기');
  await expect(page.locator('#hud-objective')).toBeVisible();
});

test('E14 at 360×640 the enter button and the notice line above it are on the first screen without scrolling', async ({ page }) => {
  await open(page, { size: { width: 360, height: 640 }, enter: false });
  await page.evaluate(() => scrollTo(0, 0));
  expect(await inViewport(page.locator('#enter'), page)).toBe(true);
  expect(await inViewport(page.locator('#entry-notice > p'), page)).toBe(true);
});

// ---- team-select.md ----

test('S2·S3·S4·S15 unpicked team is marked, picks show "✓ 선택됨", focus starts on the first team', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '팀·캐릭터', exact: true }).click();
  const d = picker(page);
  await expect(d.getByText('아직 고르지 않음')).toBeVisible();
  await expect(d.getByRole('button', { name: teams[0].name })).toBeFocused();
  const defaultChar = d.getByRole('button', { name: chars.names[chars.default] });
  await expect(defaultChar).toHaveAttribute('aria-pressed', 'true');
  await expect(defaultChar).toContainText('선택됨');
  const t = d.getByRole('button', { name: teams[1].name });
  await t.click();
  await expect(t).toHaveAttribute('aria-pressed', 'true');
  await expect(t).toContainText('선택됨');
  await expect(d.getByText('아직 고르지 않음')).toBeHidden();
  const other = d.getByRole('button', { name: chars.names[chars.ids.find(id => id !== chars.default)] });
  await other.click();
  await expect(other).toContainText('선택됨');
  await expect(defaultChar).not.toContainText('선택됨');
  await expect(d).toBeVisible();
});

test('UX-T02 the window leaves the screen centre (my character) uncovered', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: '팀·캐릭터', exact: true }).click();
  const b = await picker(page).boundingBox();
  expect(b.x).toBeGreaterThan(1280 / 2 + 100);
});

test('S5·S6·S7 Tab stays in the window; Esc and outside click close without moving the avatar', async ({ page }) => {
  await open(page);
  const opener = page.getByRole('button', { name: '팀·캐릭터', exact: true });
  await opener.click();
  const count = teams.length + chars.ids.length + 1;
  for (let i = 0; i < count + 2; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement.closest('#team-select'))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(picker(page)).toBeHidden();
  await expect(opener).toBeFocused();
  await opener.click();
  const before = await page.evaluate(() => arena.player.clone());
  await page.mouse.click(400, 360); // the canvas, outside the window: closes only, no click-to-walk
  await expect(picker(page)).toBeHidden();
  await page.waitForTimeout(500);
  expect(await page.evaluate(p => arena.player.distanceTo(p), before)).toBeLessThan(.05);
  await expect(page.getByRole('button', { name: '팀·캐릭터 선택 닫기', includeHidden: true })).toHaveCount(1);
});

// H-W10-A / BL-0034: the opener is not on the first page; after 들어가기 it sits in #dock in every state, clear of #settings.
test('H-W10-A·S1·S9·S11 the opener appears in #dock after entry, walking and seated, and never overlaps #settings', async ({ page }) => {
  await open(page, { enter: false });
  await expect(page.locator('#team-select-open')).toHaveCount(0);
  await page.locator('#enter').click();
  const opener = page.getByRole('button', { name: '팀·캐릭터', exact: true });
  const apart = () => page.evaluate(() => {
    const a = document.querySelector('#team-select-open').getBoundingClientRect(), b = document.querySelector('#settings').getBoundingClientRect();
    return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
  });
  await expect(opener).toBeVisible();
  expect(await opener.evaluate(el => el.parentElement.id)).toBe('dock');
  expect(await apart()).toBe(true);
  await opener.click({ trial: true }); // nothing covers it
  await fire(page, 'seat:enter', { seatId: 'probe' });
  await expect(opener).toBeVisible();
  await opener.click();
  await expect(picker(page)).toBeVisible();
});

test('S12 at 360×640 the window fits the screen with its close button visible', async ({ page }) => {
  await open(page, { size: { width: 360, height: 640 } });
  await page.evaluate(() => document.querySelector('#team-select-open').click());
  await expect(picker(page)).toBeVisible();
  expect(await inViewport(picker(page), page)).toBe(true);
  expect(await inViewport(picker(page).getByRole('button', { name: '팀·캐릭터 선택 닫기' }), page)).toBe(true);
});

// ---- ticket.md ----

test('K2·T64 the ticket window is one "응원할 팀 고르기" step with a button per team, no emote step, and focuses the first team', async ({ page }) => {
  await open(page);
  await toNearGate(page);
  const d = ticketDialog(page);
  await expect(d).toBeVisible();
  await expect(d.getByText('응원할 팀 고르기')).toBeVisible();
  await expect(d.getByText('감정표현 한 번')).toHaveCount(0);
  await expect(d.locator('kbd')).toHaveCount(0);
  await expect(d.getByRole('button', { name: teams[0].name, exact: true })).toBeFocused();
  for (const t of teams) await expect(d.getByRole('button', { name: t.name, exact: true })).toBeVisible();
  await expect(d.getByRole('button', { name: '티켓 창 닫기' })).toBeVisible();
});

test('S10·T64 a team pick in the ticket shows as chosen in the 팀·캐릭터 picker', async ({ page }) => {
  await open(page);
  await toNearGate(page);
  await ticketDialog(page).getByRole('button', { name: teams[0].name, exact: true }).click();
  await page.getByRole('button', { name: '팀·캐릭터', exact: true }).click();
  await expect(picker(page).getByRole('button', { name: teams[0].name })).toHaveAttribute('aria-pressed', 'true');
});

test('K5·K6·UX-K04 issue → "입구가 열렸습니다" and a focused "들어가기"; Enter closes it; next task line goes; gate mark turns open', async ({ page }) => {
  const errors = await open(page);
  const mark = () => page.evaluate(() => {
    let root = arena.avatar; while (root.parent) root = root.parent;
    return root.getObjectByName('Ticket_GateMark')?.material.color.getHexString();
  });
  expect(await mark()).toBe('ffdba1');
  await toNearGate(page);
  await expect(ticketDialog(page)).toBeVisible();
  await ticketDialog(page).getByRole('button', { name: teams[0].name, exact: true }).click();
  await expect(ticketDialog(page).getByText('입구가 열렸습니다')).toBeVisible({ timeout: 10_000 });
  const go = ticketDialog(page).getByRole('button', { name: '들어가기' });
  await expect(go).toBeFocused();
  await expect(page.locator('#hud-objective')).toBeHidden();
  expect(await mark()).toBe('7fdcff');
  await page.keyboard.press('Enter');
  await expect.poll(() => walking(page)).toBe(true);
  await expect(ticketDialog(page)).toBeHidden();
  expect(errors).toEqual([]);
});

test('K7·K9·K10 closing leaves a reopen button; it and bumping the barrier reopen the window; walking away hides', async ({ page }) => {
  await open(page);
  await toNearGate(page);
  await ticketDialog(page).getByRole('button', { name: '티켓 창 닫기' }).click();
  await expect(ticketDialog(page)).toBeHidden();
  const reopen = page.getByRole('button', { name: '입구 앞 · 티켓 창 열기' });
  await expect(reopen).toBeVisible();
  await reopen.click();
  await expect(ticketDialog(page)).toBeVisible();
  await expect(ticketDialog(page).getByRole('button', { name: teams[0].name, exact: true })).toBeFocused();
  await ticketDialog(page).getByRole('button', { name: '티켓 창 닫기' }).click();
  await page.evaluate(([x, z]) => { arena.go([x, -.02, z, -Math.PI / 2]); for (let i = 0; i < 20; i++) arena.attempt(.25, 0); }, [bx - 2, midZ]);
  await expect(ticketDialog(page)).toBeVisible();
  await page.evaluate(() => arena.go('plaza'));
  await expect(ticketDialog(page)).toBeHidden();
  await expect(page.locator('#hud-objective')).toHaveText('입구로 가서 티켓 받기');
});

test('K12 at 360×640 the ticket window fits and does not overlap the touch arrows', async ({ page }) => {
  await open(page, { size: { width: 360, height: 640 } });
  await page.evaluate(() => document.body.classList.add('touch'));
  await toNearGate(page);
  const d = ticketDialog(page);
  await expect(d).toBeVisible();
  expect(await inViewport(d, page)).toBe(true);
  expect(await inViewport(d.getByRole('button', { name: '티켓 창 닫기' }), page)).toBe(true);
  const a = await d.boundingBox(), t = await page.locator('#touch').boundingBox();
  expect(a.y + a.height <= t.y || t.y + t.height <= a.y).toBe(true);
});

// T33 walk (touch, 360×640): static boxes sat on top of the picker opener, the ticket and the enter button (U-H-3 is the same class).
const hit = (page, selector) => page.evaluate(s => {
  const el = document.querySelector(s), r = el.getBoundingClientRect();
  return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
}, selector);
test('S13·K13·E14 touch at 360×640: the opener, the ticket buttons and the enter button take the tap', async ({ page }) => {
  await open(page, { size: { width: 360, height: 640 }, enter: false });
  await page.evaluate(() => document.body.classList.add('touch'));
  expect(await hit(page, '#enter')).toBe(true);
  await page.locator('#enter').click();
  expect(await hit(page, '#team-select-open')).toBe(true);
  await toNearGate(page);
  await expect(ticketDialog(page)).toBeVisible();
  for (const s of ['#ticket .teams button:first-child', '#ticket .teams button:last-child', '#ticket .close']) expect(await hit(page, s), s).toBe(true);
  await ticketDialog(page).locator('.teams button').first().click();
  await expect(ticketDialog(page).getByRole('img', { name: new RegExp(teams[0].name) })).toBeVisible();
});
// B-M-2 (an emote pick finishes the ticket when clips fail) was removed with the emote step (T64).

// ---- T88: the round that started last (상영 중) as the first showtime cell ----
// User 2026-11-14: "이미 상영중인 방에도 들어갈수있게해줘" / "지금시간으로부터 딱 이전시간 방".
const INTERVAL = read('screen').roundIntervalMinutes * 60_000;
const fakeYouTube = `window.YT={Player:class {
  constructor(target,options){this.options=options;this.time=options.playerVars.start;this.muted=true;this.started=false;
    this.iframe=document.createElement('iframe');this.iframe.src='https://www.youtube.com/embed/'+options.videoId;target.replaceWith(this.iframe);
    window.yt=this;queueMicrotask(()=>options.events.onReady({target:this}));}
  emit(data){if(data===1)this.started=true;this.options.events.onStateChange({target:this,data});}
  playVideo(){this.emit(1);} pauseVideo(){this.emit(2);} seekTo(time){this.time=time;}
  cueVideoById({startSeconds=0}){this.time=startSeconds;this.started=false;queueMicrotask(()=>this.emit(5));}
  getCurrentTime(){return this.started?this.time:0;} getDuration(){return 3600;} getIframe(){return this.iframe;}
  mute(){this.muted=true;} unMute(){this.muted=false;} isMuted(){return this.muted;} setVolume(){} destroy(){this.iframe.remove();}
}};window.onYouTubeIframeAPIReady();`;

test('T88 the first showtime cell is the round that started last, marked 상영 중; entering it plays from now − its start; next cells as before', async ({ page }) => {
  const now = Date.parse('2026-11-13T04:14:30Z'), running = Math.floor(now / INTERVAL) * INTERVAL;
  await page.clock.setFixedTime(now);
  await page.route('https://www.youtube.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: '<body>Player fixture</body>' }));
  await page.route('https://www.youtube.com/iframe_api', route => route.fulfill({ contentType: 'text/javascript', body: fakeYouTube }));
  const errors = await open(page, { enter: false });
  const cells = page.locator('#showtimes button[data-showtime]');
  // (a) running round first, then the three next boundaries; only the first says 상영 중.
  expect(await cells.evaluateAll(bs => bs.map(b => Number(b.dataset.showtime)))).toEqual([0, 1, 2, 3].map(i => running + i * INTERVAL));
  // The tag is CSS ::after (labels stay HH:MM text); it is part of the button's name and shows on screen.
  await expect(cells.first()).toHaveAccessibleName(/^\d{2}:\d{2}\s*상영 중$/);
  expect(await cells.first().evaluate(b => getComputedStyle(b, '::after').content)).toBe('"상영 중"');
  for (const i of [1, 2, 3]) await expect(cells.nth(i)).toHaveAccessibleName(/^\d{2}:\d{2}$/);
  // (d) the nearest next round is still the default, and a next cell is picked as before (one pressed).
  await expect(page.locator('#showtimes [aria-pressed=true]')).toHaveAttribute('data-showtime', String(running + INTERVAL));
  await cells.nth(2).click();
  await expect(page.locator('#showtimes [aria-pressed=true]')).toHaveAttribute('data-showtime', String(running + 2 * INTERVAL));
  // (b) picking the running cell sends app:enter with that round's start.
  await cells.first().click();
  await expect(page.locator('#showtimes [aria-pressed=true]')).toHaveCount(1);
  await page.evaluate(async () => {
    const { events, APP_ENTER } = await import('./events.js');
    events.addEventListener(APP_ENTER, e => { window.__enter = e.detail; }, { once: true });
  });
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => window.__enter?.showtime)).toBe(running);
  // (c) the screen starts at now − round start (270 s here), not at 0, and does not wait.
  await expect.poll(() => page.evaluate(() => window.yt?.options.playerVars.start), { timeout: 30_000 }).toBe((now - running) / 1000);
  expect(await page.evaluate(() => arena.screen.state.status)).not.toBe('waiting');
  expect(await page.evaluate(() => arena.screen.roundStart)).toBe(running);
  expect(errors).toEqual([]);
});
