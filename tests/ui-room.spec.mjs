import { test, expect } from '@playwright/test';

// FIX1c (BL-0034 room side): '같이 보기' in the settings group, the people line, the result line, toasts.
// Rows: docs/live/product/ux/room-invite.md 5절, wording 6절 (verbatim). The entry notice and the invited line are the
// first page's (ui/loading.js) and are checked in tests/ui-entry.spec.mjs / fix1-entry-hud.spec.mjs.
test.setTimeout(240_000);

const ready = page => page.waitForFunction(() => window.arena?.ready, null, { timeout: 120_000 });
async function open(page, url = '/') {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(url);
  await ready(page);
  return errors;
}
const emit = (page, type, detail) => page.evaluate(async ([type, detail]) => {
  const { events } = await import('/events.js');
  events.dispatchEvent(new CustomEvent(type, { detail }));
}, [type, detail]);
const people = page => page.locator('#network-status');
const watch = page => page.getByRole('button', { name: '같이 보기 — 초대 링크 복사' });
const note = page => page.locator('#watch-together-note');
const toasts = page => page.locator('#hud-toast');
// A Peer that fails like an unreachable PeerJS Cloud (error type "network").
const unreachable = page => page.route('**/vendor/peerjs.min.js', route => route.fulfill({ contentType: 'text/javascript', body:
  'window.Peer=class{constructor(){this.h={};setTimeout(()=>this.emit("error",{type:"network"}),50)}on(e,f){(this.h[e]??=[]).push(f);return this}off(e,f){this.h[e]=(this.h[e]||[]).filter(g=>g!==f);return this}emit(e,v){for(const f of this.h[e]||[])f(v)}destroy(){}};' }));

test('M2 M3 M4 M7 M8 M18 M20: one button, people line only at 2+, no room number / solo / old wording, arrivals toast', async ({ page }) => {
  await unreachable(page);
  const errors = await open(page);
  await page.locator('#enter').click();
  // M2: the button is there right after entering, inside #network, no key input anywhere.
  await expect(watch(page)).toBeVisible();
  await expect(page.locator('#network #watch-together')).toHaveText('같이 보기');
  await expect(page.locator('input#room-code, #host-room, #join-room, #leave-room, #hud-room, .room-copy')).toHaveCount(0);
  await expect(people(page)).toBeHidden();

  // M3: 2+ people → "N명 같이 보는 중"; M4/M7: alone → the line is gone (no "혼자").
  await emit(page, 'room:state', { key: '03', count: 1, host: true, phase: 'solo' });
  await expect(people(page)).toBeHidden();
  // M8: someone arrives in a solo room → toast "1명이 들어왔어요" and the people line.
  await emit(page, 'room:state', { key: '03', count: 2, host: true, phase: 'room' });
  await expect(people(page)).toHaveText('2명 같이 보는 중');
  await expect(people(page)).toHaveAttribute('role', 'status');
  await expect(toasts(page)).toContainText('1명이 들어왔어요');
  // Handoff: no "방장" text, no new-host toast (UX 결정 3).
  await emit(page, 'room:state', { key: '03', count: 2, host: false, phase: 'handoff' });
  await emit(page, 'room:state', { key: '03', count: 2, host: true, phase: 'room' });
  await emit(page, 'room:state', { key: '03', count: 1, host: true, phase: 'solo' });
  await expect(people(page)).toBeHidden();

  // M18 M20: none of the removed wording, no room number, no peer ids.
  const text = await page.locator('body').innerText();
  for (const gone of ['혼자 시청 중', '같이 볼 사람 찾는 중', '방장', '방 번호', '이 방으로 옮기기', '방 나가기', '다시 같이 보기', '초대 링크 복사', '방 03'])
    expect(text, gone).not.toContain(gone);
  expect(text).not.toMatch(/barclays-tps-room-/);
  expect(errors).toEqual([]);
});

test('M9 M11 M15 (UX-M11): copy, blocked clipboard link, not connected → copy + retry once', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: baseURL });
  const page = await context.newPage();
  await unreachable(page);
  const errors = await open(page);
  await page.locator('#enter').click();
  await page.waitForFunction(() => arena.multiplayer.roomState.phase === 'idle', null, { timeout: 15_000 });

  // M15: no room → the link is still copied, one warning line, and placement is tried once more (join()).
  await page.evaluate(() => { const j = arena.multiplayer.join; window.__joins = 0; arena.multiplayer.join = (...a) => { window.__joins++; return j(...a); }; });
  await watch(page).click();
  await expect(note(page)).toHaveText('지금은 같이 보기에 연결되지 않아요. 잠시 뒤 다시 눌러 주세요');
  await expect(note(page)).toHaveAttribute('data-tone', 'warning');
  expect(await page.evaluate(() => window.__joins)).toBe(1);
  expect(new URL(await page.evaluate(() => navigator.clipboard.readText())).searchParams.get('b')).toBe('final');

  // M9: in a room (fake room object) → ?b=&t=&room= copied, "복사됐어요…" under the button.
  await page.evaluate(() => {
    const t = Math.floor(Date.now() / 600_000) * 600_000;
    Object.defineProperty(arena.multiplayer, 'room', { get: () => ({ code: '07', host: true, roundStart: t }), configurable: true });
  });
  await watch(page).click();
  await expect(note(page)).toHaveText('복사됐어요. 친구에게 보내면 같은 방으로 들어와요');
  const url = new URL(await page.evaluate(() => navigator.clipboard.readText()));
  expect(url.searchParams.get('room')).toBe('07');
  expect(url.searchParams.get('b')).toBe('final');
  // M11: blocked clipboard → "이 링크를 친구에게 보내세요: <link>", the link selects whole.
  await page.evaluate(() => { navigator.clipboard.writeText = () => Promise.reject(new Error('blocked')); });
  await watch(page).click();
  const link = note(page).locator('[data-link]');
  await expect(link).toHaveText(/[?&]room=07/);
  await expect(note(page)).toContainText('이 링크를 친구에게 보내세요:');
  expect(await link.evaluate(el => getComputedStyle(el).userSelect)).toBe('all');
  expect(errors).toEqual([]);
  await context.close();
});
