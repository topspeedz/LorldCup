import { test, expect } from '@playwright/test';
import { mkdtempSync, existsSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { acquire, release } from './gpu-lock.mjs';
import { lockMode } from './global-setup.mjs';

const lockPath = () => join(mkdtempSync(join(tmpdir(), 'gpu-lock-')), 'gpu-lock.json');
const fast = { pollMs: 20 };
const settle = ms => new Promise(r => setTimeout(r, ms));
// Tracks whether a pending acquire has resolved yet.
const track = promise => { const t = { done: false }; t.promise = promise.then(() => { t.done = true; }); return t; };
const deadPid = () => spawnSync(process.execPath, ['-e', '']).pid;

test('acquire then release frees the lock', async () => {
  const path = lockPath();
  await acquire('A', { path });
  expect(existsSync(path)).toBe(true);
  release('A', { path });
  expect(existsSync(path)).toBe(false);
});

test('a second owner waits and fails after the wait limit', async () => {
  const path = lockPath();
  await acquire('A', { path });
  await expect(acquire('B', { path, waitMs: 300, pollMs: 50 })).rejects.toThrow(/held by A/);
  release('A', { path });
});

test('a second owner gets the lock once it is released', async () => {
  const path = lockPath();
  await acquire('A', { path });
  setTimeout(() => release('A', { path }), 100);
  await acquire('B', { path, waitMs: 2000, pollMs: 25 });
  release('B', { path });
});

test('only the owner can release', async () => {
  const path = lockPath();
  await acquire('A', { path });
  expect(() => release('B', { path })).toThrow(/held by A/);
  release('A', { path });
});

test('two shared holders run at once and a third waits for a free slot', async () => {
  const path = lockPath();
  await acquire('S1', { path, mode: 'shared', slots: 2, ...fast });
  await acquire('S2', { path, mode: 'shared', slots: 2, waitMs: 300, ...fast });
  await expect(acquire('S3', { path, mode: 'shared', slots: 2, waitMs: 300, ...fast })).rejects.toThrow(/waited/);
  const s3 = track(acquire('S3', { path, mode: 'shared', slots: 2, waitMs: 3000, ...fast }));
  await settle(150);
  expect(s3.done).toBe(false);
  const freed = Date.now();
  release('S1', { path });
  await s3.promise;
  const slot = ['0', '1'].map(i => path.replace(/\.json$/, `.slot-${i}.json`)).map(f => JSON.parse(readFileSync(f, 'utf8'))).find(h => h.owner === 'S3');
  expect(Date.parse(slot.since)).toBeGreaterThanOrEqual(freed); // since = when the slot was taken, not when waiting began
  release('S2', { path }); release('S3', { path });
});

test('exclusive waits for shared holders to drain and keeps everyone out while held', async () => {
  const path = lockPath();
  await acquire('S1', { path, mode: 'shared', ...fast });
  const x = track(acquire('X', { path, waitMs: 3000, ...fast }));
  await settle(150);
  expect(x.done).toBe(false);
  release('S1', { path });
  await x.promise;
  await expect(acquire('S2', { path, mode: 'shared', waitMs: 300, ...fast })).rejects.toThrow(/held by X/);
  release('X', { path });
  await acquire('S2', { path, mode: 'shared', waitMs: 300, ...fast });
  release('S2', { path });
});

test('a shared run waits while a legacy gpu-lock.json is present', async () => {
  const path = lockPath();
  writeFileSync(path, JSON.stringify({ owner: 'OLD', pid: process.pid, since: new Date().toISOString() }));
  await expect(acquire('S1', { path, mode: 'shared', waitMs: 300, ...fast })).rejects.toThrow(/held by OLD/);
});

test('waiters enter first come first served and a queued exclusive is not overtaken', async () => {
  const path = lockPath();
  const o = { path, slots: 2, waitMs: 5000, ...fast };
  await acquire('A', { ...o, mode: 'shared' });
  await acquire('B', { ...o, mode: 'shared' });
  const x = track(acquire('X', o));
  await settle(60);
  const c = track(acquire('C', { ...o, mode: 'shared' }));
  await settle(60);
  release('A', { path });
  await settle(200);
  expect(c.done).toBe(false); // a slot is free, but X is ahead of C
  expect(x.done).toBe(false);
  release('B', { path });
  await x.promise;
  await settle(150);
  expect(c.done).toBe(false);
  release('X', { path });
  await c.promise;
  release('C', { path });
});

test('shared waiters enter in arrival order', async () => {
  const path = lockPath();
  const o = { path, mode: 'shared', slots: 1, waitMs: 5000, ...fast };
  await acquire('A', o);
  const b = track(acquire('B', o));
  await settle(60);
  const c = track(acquire('C', o));
  await settle(60);
  release('A', { path });
  await b.promise;
  await settle(150);
  expect(c.done).toBe(false);
  release('B', { path });
  await c.promise;
  release('C', { path });
});

test('slots, queue tickets and gpu-lock.json held by a dead pid are cleared', async () => {
  const path = lockPath(), pid = deadPid(), base = path.replace(/\.json$/, '');
  const hold = owner => JSON.stringify({ owner, pid, since: new Date().toISOString(), watch: true });
  writeFileSync(`${base}.slot-0.json`, hold('DEAD-S0'));
  writeFileSync(`${base}.slot-1.json`, hold('DEAD-S1'));
  mkdirSync(`${base}.queue`);
  writeFileSync(join(`${base}.queue`, '000000000000001-0-1-x.json'), JSON.stringify({ owner: 'DEAD-Q', pid, mode: 'exclusive', watch: true }));
  await acquire('S', { path, mode: 'shared', slots: 2, waitMs: 1000, ...fast });
  release('S', { path });
  writeFileSync(path, hold('DEAD-X'));
  await acquire('X', { path, waitMs: 1000, ...fast });
  expect(JSON.parse(readFileSync(path, 'utf8')).owner).toBe('X');
  release('X', { path });
});

test('a CLI-style lock (no watch flag) is never cleared by pid', async () => {
  const path = lockPath();
  writeFileSync(path, JSON.stringify({ owner: 'BAKE', pid: deadPid(), since: new Date().toISOString() }));
  await expect(acquire('X', { path, waitMs: 300, ...fast })).rejects.toThrow(/held by BAKE/);
  expect(existsSync(path)).toBe(true);
});

test('npm test picks exclusive for full and FPS runs, shared otherwise', () => {
  expect(lockMode([])).toBe('exclusive');
  expect(lockMode(['--grep', 'seat'])).toBe('exclusive');
  expect(lockMode(['tests/perf-fps.spec.mjs'])).toBe('exclusive');
  expect(lockMode(['tests/ui-frame.spec.mjs', 'tests/qa-p.spec.mjs:82'])).toBe('exclusive');
  expect(lockMode(['perf'])).toBe('exclusive');
  expect(lockMode(['D:\\Projects\\x\\tests\\qa-p.spec.mjs'])).toBe('exclusive');
  expect(lockMode(['tests\\ui-frame.spec.mjs'])).toBe('shared');
  expect(lockMode(['tests/ui-frame.spec.mjs'])).toBe('shared');
  expect(lockMode(['tests/ui-frame.spec.mjs', '--workers', '1', 'tests/loading.spec.mjs'])).toBe('shared');
  expect(lockMode(['tests/gpu-lock.spec.mjs', '--reporter=list'])).toBe('shared');
});
