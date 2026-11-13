import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Load the module without its browser renderer imports; these exports must not touch the DOM.
const source = readFileSync(new URL('../web/screen-video.js', import.meta.url), 'utf8');
const screen = await import('data:text/javascript;base64,' + Buffer.from(source.replace(/^import .*;\r?$/gm, '')).toString('base64'));
const boundary = Date.parse('2026-11-13T04:10:00Z');

test('roundPosition preserves a future start and the exact end boundary', () => {
  expect(screen.roundPosition(boundary - 1, boundary, 600)).toEqual({ seconds: -.001, ended: false });
  expect(screen.roundPosition(boundary, boundary, 600)).toEqual({ seconds: 0, ended: false });
  expect(screen.roundPosition(boundary + 600_000, boundary, 600)).toEqual({ seconds: 600, ended: true });
  expect(screen.roundPosition(boundary + 600_000, boundary, 0).ended).toBe(false);
});

test('scheduledSource uses inclusive starts, exclusive ends and the configured default', () => {
  const config = { source: 'vod', schedule: [{ from: '2026-11-13T13:10:00+09:00', to: '2026-11-13T13:20:00+09:00', source: 'live' }] };
  const before = JSON.stringify(config);
  expect(screen.scheduledSource(boundary - 1, config)).toBe('vod');
  expect(screen.scheduledSource(boundary, config)).toBe('live');
  expect(screen.scheduledSource(boundary + 599_999, config)).toBe('live');
  expect(screen.scheduledSource(boundary + 600_000, config)).toBe('vod');
  expect(screen.scheduledSource(boundary, { source: 'live', schedule: [] })).toBe('live');
  expect(JSON.stringify(config)).toBe(before);
});

test('scheduledSource shares the runtime rule for invalid and overlapping slots', () => {
  const from = new Date(boundary).toISOString(), to = new Date(boundary + 600_000).toISOString();
  expect(screen.scheduledSource(boundary, { source: 'vod', schedule: [
    { from: 'invalid', to, source: 'live' }, { from, to, source: 'other' },
    { from, to, source: 'live' }, { from, to, source: 'vod' },
  ] })).toBe('live');
});

test('upcomingRounds returns only future interval boundaries, including at midnight', () => {
  expect(screen.upcomingRounds(boundary - 1, 10, 3)).toEqual([boundary, boundary + 600_000, boundary + 1_200_000]);
  expect(screen.upcomingRounds(boundary, 10, 3)).toEqual([boundary + 600_000, boundary + 1_200_000, boundary + 1_800_000]);
  expect(screen.upcomingRounds(boundary, 10, 0)).toEqual([]);
  const midnight = Date.parse('2026-11-14T00:00:00Z');
  expect(screen.upcomingRounds(midnight - 1, 15, 2)).toEqual([midnight, midnight + 900_000]);
});

// Execute the actual startup callbacks with only clocks/player/DOM effects stubbed; no browser or renderer.
function startup({ waiting = false, eligible = true } = {}) {
  const s = { waiting, eligible, entered: true, ready: false, disposed: false, cueing: false,
    starting: false, sourceStarted: false, source: 'vod', muted: false, status: 'loading', error: null,
    retryFailures: 0, waitStarted: null, playTimer: null, loadTimer: null, hasImage: false,
    notice: { hidden: true }, calls: [], timers: new Map(), performance: { now: () => 0 } };
  let timerId = 0;
  s.setTimeout = (fn, ms) => { s.timers.set(++timerId, { fn, ms }); return timerId; };
  s.clearTimeout = id => s.timers.delete(id);
  s.isWaiting = () => s.waiting;
  s.sync = () => true;
  for (const name of ['emit', 'display', 'applyVolume', 'resetRetry', 'showRetryNotice']) s[name] = () => {};
  s.player = { muted: true, playVideo() { s.calls.push(['play', this.muted]); }, pauseVideo() {},
    mute() { this.muted = true; }, unMute() { this.muted = false; } };
  runInNewContext(
    source.slice(source.indexOf(' function waitForRound(){'), source.indexOf(' async function loadSource(){')) +
    source.match(/ function setMuted\(value\)\{[^\n]+/)[0] + '\n' +
    source.slice(source.indexOf(' function resumeFromGesture(){'), source.indexOf(' function setVolume(value)')), s);
  s.playerEvents().onReady({ target: s.player });
  return s;
}

test('A-H-1: waiting ends with one audible playVideo call when eligible, then PLAYING clears the watchdog', () => {
  const s = startup({ waiting: true });
  expect(s.status).toBe('waiting');
  expect(s.calls).toEqual([]);
  s.waiting = false; s.status = 'ready'; s.startPlayback();
  expect(s.calls).toEqual([['play', false]]);
  expect(s.status).toBe('loading');
  s.onStateChange({ target: s.player, data: 1 });
  expect(s.status).toBe('playing');
  expect(s.timers.size).toBe(0);
});

test('A-H-1: ineligible ready is not an autoplay failure and makes no playVideo call until eligible', () => {
  const s = startup({ eligible: false });
  expect(s.status).toBe('ready');
  expect(s.error).toBeNull();
  expect(s.calls).toEqual([]);
  expect(s.timers.size).toBe(0);
  s.eligible = true; s.startPlayback();
  expect(s.calls).toEqual([['play', false]]);
});

for (const block of ['event', 'timeout']) test(`A-H-1: ${block} rejection retries muted and the sound action restores audible playback`, () => {
  const s = startup();
  expect(s.calls).toEqual([['play', false]]);
  if (block === 'event') s.playerEvents().onAutoplayBlocked({ target: s.player });
  else {
    const timer = s.timers.get(s.playTimer);
    expect(timer.ms).toBe(15_000);
    timer.fn();
  }
  expect(s.calls).toEqual([['play', false], ['play', true]]);
  expect(s.muted).toBe(true);
  s.onStateChange({ target: s.player, data: 1 });
  s.setMuted(false); s.resumeFromGesture();
  expect([s.status, s.muted, s.player.muted]).toEqual(['playing', false, false]);
  expect(s.timers.size).toBe(0);
});
