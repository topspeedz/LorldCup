// FIX1d (fix round 1, screen side): reproduction tests for U-H-3, U-H-4, LG-H-4, LG-H-4b, A-T39-H-1, BL-0034 and BL-0035.
// U-H-12 is reproduced in tests/character.spec.mjs ('real room peers see the selected character…'). Browser tests: written only, run once in the QA line.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = name => JSON.parse(readFileSync(new URL(`../web/config/${name}.json`, import.meta.url), 'utf8'));
const ticket = read('ticket'), screen = read('screen');
const { x: bx, z: [z0, z1] } = ticket.barrier, midZ = (z0 + z1) / 2;
const INTERVAL = screen.roundIntervalMinutes * 60_000;
const FIXED = Date.parse('2026-11-13T20:03:00+09:00'); // between round boundaries (UX E14)
// Legal T62 원문 (UX room-invite.md 6절, "(IP)" left out by user decision).
const NOTICE = '들어가면 다른 사람과 자동으로 연결돼요. 이때 내 접속 주소가 연결을 돕는 외부 서비스와 상대에게 전해져요.';
const DETAILS = [
  NOTICE,
  '입장하면 다른 관람객과 자동으로 연결되며, 이때 내 IP 주소가 연결 중개 서버(PeerJS Cloud·Google STUN)와 연결 상대에게 전달됩니다.',
  '같은 방 사람에게는 자동으로 정해진 닉네임, 캐릭터의 위치와 동작, 응원팀이 보입니다. 빈자리를 찾는 동안 다른 방의 방장과, 방 현황을 확인하는 운영자 화면과도 잠깐 연결될 수 있습니다. 이 앱은 이 정보를 저장하지 않습니다. 영상은 각자의 브라우저가 YouTube에서 직접 받습니다.',
  '제공 사진을 참고한 공간 재현 · 실제 2026 행사 배치와 실측 치수를 검증한 모델은 아닙니다.',
];

async function boot(page, { url = '/', size = { width: 1280, height: 720 }, clock = true } = {}) {
  await page.setViewportSize(size);
  if (clock) await page.clock.setFixedTime(FIXED);
  await page.addInitScript(() => {
    window.__enters = [];
    window.__storage = [];
    for (const store of [localStorage, sessionStorage]) {
      const set = store.setItem.bind(store);
      store.setItem = (k, v) => { __storage.push(k); set(k, v); };
    }
  });
  await page.goto(url);
  await page.evaluate(async () => {
    const { events } = await import('./events.js');
    events.addEventListener('app:enter', e => __enters.push(e.detail));
  });
}
// T73: the app is ready to enter once the arena and the character are loaded (ui/loading.js isReady); app:enter waits for both.
const ready = page => page.waitForFunction(() => window.arena?.ready && window.arena.character?.ready, null, { timeout: 120_000 });
const enter = async page => { await ready(page); await page.locator('#enter').click(); };
const box = (page, sel) => page.evaluate(s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
const meets = (a, b) => Math.min(a.r, b.r) > Math.max(a.l, b.l) && Math.min(a.b, b.b) > Math.max(a.t, b.t);
const onTop = (page, sel) => page.evaluate(s => {
  const el = document.querySelector(s), r = el.getBoundingClientRect();
  return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
}, sel);

// ---- BL-0035: first page ----

test('BL-0035 first page: one chosen broadcast card, three next showtimes with the nearest chosen, notice line right above 들어가기', async ({ page }) => {
  await boot(page);
  const card = page.locator('#broadcasts button[data-broadcast="final"]');
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await expect(card).toContainText('결승전');
  await expect(card).toContainText(/재방|생방송/);
  await expect(page.locator('#panel h1')).toHaveText('어떤 경기를 볼까요?');
  const first = Math.ceil(FIXED / INTERVAL) * INTERVAL;
  const times = await page.locator('#showtimes button[data-showtime]').evaluateAll(bs => bs.map(b => [Number(b.dataset.showtime), b.getAttribute('aria-pressed'), b.textContent]));
  expect(times.map(t => t[0])).toEqual([first - INTERVAL, first, first + INTERVAL, first + 2 * INTERVAL]); // T88: 20:00 상영 중, then 20:10·20:20·20:30
  expect(times.map(t => t[1])).toEqual(['false', 'true', 'false', 'false']);
  for (const [, , label] of times) expect(label).toMatch(/^\d{2}:\d{2}$/);
  await page.locator(`#showtimes button[data-showtime="${first + INTERVAL}"]`).click();
  expect(await page.locator('#showtimes [aria-pressed=true]').count()).toBe(1);
  await expect(page.locator('#showtimes [aria-pressed=true]')).toHaveAttribute('data-showtime', String(first + INTERVAL));
  // 사용자 2026-11-15 "확장됐을떄 볼수있도록만": folded, only the '연결·개인정보 안내' line shows right above 들어가기; opened, the Legal T62 원문 and the three texts in order.
  await expect(page.getByText(NOTICE)).toBeHidden();
  const notice = await box(page, '#entry-notice'), button = await box(page, '#enter');
  expect(notice.b).toBeLessThanOrEqual(button.t);
  await page.getByText('연결·개인정보 안내', { exact: true }).click();
  expect(await page.locator('#entry-notice details p').allTextContents()).toEqual(DETAILS);
  // Nothing in the arena is on screen yet: no key list, move buttons, team button or room panel.
  expect(await page.evaluate(() => ['#hud', '#dock', '#team-select-open'].filter(s => document.querySelector(s)?.checkVisibility()))).toEqual([]);
});

test('BL-0035 app:enter goes out once with {broadcastId, showtime, roomKey:null}, clicked before or after ready; no player before it; nothing stored', async ({ page }) => {
  await boot(page);
  expect(await page.locator('#enter').isEnabled()).toBe(true); // clickable before ready
  const chosen = Number(await page.locator('#showtimes [aria-pressed=true]').getAttribute('data-showtime'));
  expect(await page.locator('iframe[src*="youtube"]').count()).toBe(0); // LG-M-17: no player before app:enter
  await page.locator('#enter').click();
  await ready(page);
  await expect.poll(() => page.evaluate(() => __enters.length)).toBe(1);
  expect(await page.evaluate(() => __enters)).toEqual([{ broadcastId: 'final', showtime: chosen, roomKey: null }]);
  await expect(page.locator('#panel')).toBeHidden();
  await expect(page.locator('#loading')).toBeHidden();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => __enters.length)).toBe(1);
  expect(await page.evaluate(() => __storage)).toEqual([]);
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
});

test('BL-0035 invite link skips the first page: invite line, notice, 들어가기; app:enter carries the link values', async ({ page }) => {
  const t = Math.ceil(FIXED / INTERVAL) * INTERVAL;
  await boot(page, { url: `/?b=final&t=${t}&room=03` });
  await ready(page);
  await expect(page.locator('#panel')).toBeVisible();
  await expect(page.locator('#panel h1')).toHaveText('친구가 부른 방으로 들어가요');
  await expect(page.locator('#broadcasts')).toBeHidden();
  await expect(page.locator('#showtimes')).toBeHidden();
  await expect(page.getByText(NOTICE)).toBeHidden();
  await expect(page.getByText('연결·개인정보 안내', { exact: true })).toBeVisible();
  await page.locator('#enter').click();
  await expect.poll(() => page.evaluate(() => __enters)).toEqual([{ broadcastId: 'final', showtime: t, roomKey: '03' }]);
});

test('BL-0035 waiting: after 들어가기 with a later showtime, one "N분 뒤 시작해요" line, no window, walking still works', async ({ page }) => {
  await boot(page);
  await page.locator(`#showtimes button`).nth(3).click(); // 20:30 → 27 minutes away (T88: nth(0) is the running round)
  await enter(page);
  await expect.poll(() => page.evaluate(() => arena.screen.state.status)).toBe('waiting');
  const line = page.locator('#showtime-wait');
  await expect(line).toBeVisible();
  await expect(line).toHaveText(/^\d+분 뒤 시작해요$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  // T64: the line now sits top-centre; while waiting the video is not drawn, and a drawn video hides the line (screen-video.js hideOverlaps).
  const video = await page.evaluate(() => { const r = arena.screen.element.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, visible: arena.screen.element.checkVisibility({ visibilityProperty: true }) }; });
  if (video.visible) expect(meets(await box(page, '#showtime-wait'), video)).toBe(false);
  const before = await page.evaluate(() => arena.player.clone());
  await page.keyboard.down('KeyW');
  await page.waitForFunction(p => arena.player.distanceTo(p) > .3, before);
  await page.keyboard.up('KeyW');
});

test('first page: the 결승전 banner image sits under "어떤 경기를 볼까요?"; clicking it scrolls to its showtimes with 들어가기 focused', async ({ page }) => {
  await boot(page, { size: { width: 1280, height: 720 } });
  const card = page.locator('#broadcasts button[data-broadcast="final"]');
  await expect(card.locator('img')).toHaveAttribute('src', './assets/broadcasts/final.webp');
  await expect.poll(() => card.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  const title = await box(page, '#panel h1'), banner = await box(page, '#broadcasts button[data-broadcast="final"]');
  expect(banner.t).toBeGreaterThanOrEqual(title.b);
  const inView = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + .5; }, sel);
  expect(await inView('#showtimes')).toBe(false); // the showtimes are the next step, not on the first screen
  await card.click();
  await expect.poll(() => inView('#showtimes')).toBe(true);
  await expect.poll(() => inView('#enter')).toBe(true);
  await expect(page.locator('#showtimes-label')).toHaveText('결승전 상영 시각');
  await expect(page.locator('#enter')).toBeFocused();
});

test('in the arena "나가기 · 다른 경기 보기" goes back to the match picker, dropping an invite link', async ({ page }) => {
  const t = Math.ceil(FIXED / INTERVAL) * INTERVAL;
  await boot(page, { url: `/?b=final&t=${t}&room=03` });
  await enter(page);
  const leave = page.getByRole('button', { name: '나가기 · 다른 경기 보기' });
  await expect(leave).toBeVisible();
  await Promise.all([page.waitForEvent('load'), leave.click()]);
  expect(new URL(page.url()).search).toBe('');
  await expect(page.locator('#panel h1')).toHaveText('어떤 경기를 볼까요?');
  await expect(page.locator('#broadcasts button')).toHaveCount(3);
});

// ---- BL-0034: simple mouse-first frame ----

test('BL-0034 after entry: none of the 14 removed IDs, key hints top-right without Esc/R, settings group holds the sound bar, sound on', async ({ page }) => {
  await boot(page, { clock: false });
  await enter(page);
  const gone = await page.evaluate(() => ['quick', 'crowd-sound', 'zone', 'hud-state', 'room-code', 'host-room', 'join-room', 'leave-room', 'hud-room', 'fallback', 'walk-resume', 'menu-open', 'cross']
    .filter(id => document.getElementById(id)).concat(document.querySelector('[data-location]') ? ['data-location'] : []));
  expect(gone).toEqual([]);
  await expect(page.locator('#hud-keys')).not.toContainText(/Esc|입구로/);
  const keys = await box(page, '#hud-keys'), settings = await box(page, '#settings');
  expect(keys.r).toBeGreaterThan(1280 * .8);
  expect(settings.t).toBeGreaterThanOrEqual(keys.b);
  expect(await page.evaluate(() => arena.screen.controlsElement.parentElement.id)).toBe('settings');
  await expect.poll(() => page.evaluate(() => arena.screen.state.muted)).toBe(false);
  await expect(page.getByText(/관중 소리|걷는 중|커서 풀림|외부 광장/)).toHaveCount(0);
});

// ---- High defects ----

for (const size of [{ width: 390, height: 844 }, { width: 360, height: 640 }]) {
  test.describe(`touch ${size.width}`, () => {
    test.use({ viewport: size, hasTouch: true, isMobile: true });
    test(`U-H-3 ${size.width}: after entry "팀·캐릭터" takes the tap and opens the window (no #enter over it)`, async ({ page }) => {
      await boot(page, { size, clock: false });
      await enter(page);
      await expect(page.locator('#enter')).toBeHidden();
      expect(await onTop(page, '#team-select-open')).toBe(true);
      await page.locator('#team-select-open').tap();
      await expect(page.getByRole('dialog', { name: '팀·캐릭터 선택' })).toBeVisible();
    });
    // A-T39-H-1: the UI behind the picker must not read through it.
    test(`A-T39-H-1 ${size.width}: the team window is opaque and wins every point of its own box`, async ({ page }) => {
      await boot(page, { size, clock: false });
      await enter(page);
      await page.locator('#team-select-open').tap();
      const picker = page.locator('#team-select');
      await expect(picker).toBeVisible();
      expect(await picker.evaluate(el => getComputedStyle(el).backgroundColor)).toMatch(/^rgb\(\d+, \d+, \d+\)$/); // no alpha
      const leaks = await picker.evaluate(el => {
        const r = el.getBoundingClientRect(), out = [];
        for (const fx of [.1, .5, .9]) for (const fy of [.1, .5, .9]) {
          const hit = document.elementFromPoint(r.left + r.width * fx, r.top + r.height * fy);
          if (!el.contains(hit)) out.push(hit?.id || hit?.tagName);
        }
        return out;
      });
      expect(leaks).toEqual([]);
    });
    test(`LG-H-4b ${size.width}: the next-task line sits bottom-left, clear of the top-left screen corner and the arrow pad`, async ({ page }) => {
      await boot(page, { size, clock: false });
      await enter(page);
      await expect(page.locator('#hud-objective')).toHaveText('입구로 가서 티켓 받기');
      const line = await box(page, '#hud-objective'), pad = await box(page, '#touch');
      expect(meets(line, { l: 0, t: 0, r: 195, b: 170 })).toBe(false); // hung screen's corner (T60c)
      expect(line.t).toBeGreaterThan(size.height / 2);
      expect(meets(line, pad)).toBe(false);
    });
  });
}

test.describe('desktop 1280 A-T39-H-1', () => {
  test('A-T39-H-1 1280: the team window is opaque and nothing behind shows through its box', async ({ page }) => {
    await boot(page, { clock: false });
    await enter(page);
    await page.locator('#team-select-open').click();
    const picker = page.locator('#team-select');
    await expect(picker).toBeVisible();
    expect(await picker.evaluate(el => getComputedStyle(el).backgroundColor)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
  });
});

test('U-H-4: after closing the ticket, "입구 앞 · 티켓 창 열기" is on top and reopens it (no #status over it)', async ({ page }) => {
  await boot(page, { clock: false });
  await enter(page);
  await page.evaluate(([x, z]) => arena.go([x, -.02, z, -Math.PI / 2]), [bx - 2, midZ]);
  const dialog = page.getByRole('dialog', { name: '입장 티켓' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: '티켓 창 닫기' }).click();
  const reopen = page.getByRole('button', { name: '입구 앞 · 티켓 창 열기' });
  await expect(reopen).toBeVisible();
  expect(await onTop(page, '#ticket-reopen')).toBe(true);
  await reopen.click();
  await expect(dialog).toBeVisible();
});

for (const size of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  test(`LG-H-4 ${size.width}: the 같이 보기 result line folds inside the settings column and never meets the video`, async ({ page }) => {
    await boot(page, { size, clock: false });
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await enter(page);
    await page.locator('#watch-together').click();
    const note = page.locator('#watch-together-note');
    await expect(note).not.toBeEmpty();
    const n = await box(page, '#watch-together-note'), s = await box(page, '#settings');
    expect(n.l).toBeGreaterThanOrEqual(s.l - .5);
    expect(n.r).toBeLessThanOrEqual(s.r + .5);
    const video = await page.evaluate(() => { const r = arena.screen.element.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, visible: arena.screen.element.checkVisibility() }; });
    if (video.visible) expect(meets(n, video)).toBe(false);
  });
}
