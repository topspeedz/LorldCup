import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Match the screen logic tests: load pure exports without browser renderer imports.
const source = readFileSync(new URL('../web/character.js', import.meta.url), 'utf8');
const { remoteEmoteState } = await import('data:text/javascript;base64,' + Buffer.from(source.replace(/^import .*;\r?$/gm, '')).toString('base64'));

for (const state of ['finished', 'still in progress']) {
  test(`T47-H-1: a newcomer remembers the first ${state} emote without playing it`, () => {
    // FIX2 ruling: the wire has no timestamp, so every first snapshot is history.
    const first = remoteEmoteState(undefined, 7);
    expect(first).toEqual({ seq: 7, play: false });
    expect(remoteEmoteState(first.seq, 7)).toEqual({ seq: 7, play: false });
  });
}

test('T47-H-1: an existing receiver plays one new sequence once, ignoring duplicates and older states', () => {
  let lastSeq, plays = 0;
  for (const seq of [0, 1, 1, 0, 1]) {
    const next = remoteEmoteState(lastSeq, seq);
    lastSeq = next.seq;
    if (next.play) plays++;
  }
  expect(lastSeq).toBe(1);
  expect(plays).toBe(1);
});

test('T47-H-1: recreating an avatar cannot replay its remembered sequence', () => {
  const baseline = remoteEmoteState(undefined, 6);
  const played = remoteEmoteState(baseline.seq, 7);
  expect(played.play).toBe(true);
  // Peer sequence memory outlives the avatar; a cleared receiver also starts with a baseline.
  expect(remoteEmoteState(played.seq, 7)).toEqual({ seq: 7, play: false });
  expect(remoteEmoteState(undefined, 7)).toEqual({ seq: 7, play: false });
  expect(remoteEmoteState(played.seq, 8)).toEqual({ seq: 8, play: true });
});

test('T47-H-1: invalid sequences neither establish nor advance a baseline', () => {
  for (const seq of [undefined, null, -1, 1.5, '7', NaN, Infinity]) {
    expect(remoteEmoteState(undefined, seq)).toEqual({ seq: undefined, play: false });
    expect(remoteEmoteState(7, seq)).toEqual({ seq: 7, play: false });
  }
});
