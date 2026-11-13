// TRUN: gpu-run holds the GPU lock for exactly the life of its child command. Runs against a temp lock path.
import { test, expect } from '@playwright/test';
import { mkdtempSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const GPU_RUN = fileURLToPath(new URL('./gpu-run.mjs', import.meta.url));
const GPU_LOCK = fileURLToPath(new URL('./gpu-lock.mjs', import.meta.url));
const lockDir = () => mkdtempSync(join(tmpdir(), 'gpu-run-'));
const holds = dir => readdirSync(dir).filter(f => /^gpu-lock(\.slot-\d+)?\.json$/.test(f));
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const node = code => ['node', '-e', code]; // code uses single quotes only (it passes through the shell)
const q = p => `'${p.replaceAll('\\', '/')}'`;
// Runs a script and resolves with its exit code, stdout and stderr.
const run = (args, env = {}) => new Promise(resolve => {
  const p = spawn(process.execPath, args, { env: { ...process.env, ...env } });
  let out = '', err = '';
  p.stdout.on('data', d => { out += d; });
  p.stderr.on('data', d => { err += d; });
  p.on('exit', code => resolve({ code, out, err }));
});
const gpuRun = (dir, args) => run([GPU_RUN, ...args], { GPU_LOCK_PATH: join(dir, 'gpu-lock.json'), GPU_LOCK_WAIT_MS: '20000' });

test('the lock is held while the child runs and freed when it exits 0', async () => {
  const dir = lockDir();
  const r = await gpuRun(dir, ['--owner', 'OK', '--', ...node(`console.log(require('fs').readdirSync(${q(dir)}).join(','))`)]);
  expect(r.code).toBe(0);
  expect(r.out).toContain('gpu-lock.json'); // exclusive by default
  expect(holds(dir)).toEqual([]);
});

test('a failing child: gpu-run exits with its code and the lock is freed', async () => {
  const dir = lockDir();
  const r = await gpuRun(dir, ['--owner', 'FAIL', '--', ...node('process.exit(3)')]);
  expect(r.code).toBe(3);
  expect(holds(dir)).toEqual([]);
});

test('over --max-min: the whole child tree is ended, the lock is freed, exit 124', async () => {
  const dir = lockDir(), pidFile = join(dir, 'grandchild.pid');
  // The child starts a grandchild that never ends, records its pid, then waits forever itself.
  const child = `const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});`
    + `require('fs').writeFileSync(${q(pidFile)},String(c.pid));setInterval(()=>{},1000)`;
  const t0 = Date.now();
  const r = await gpuRun(dir, ['--owner', 'SLOW', '--max-min', '0.03', '--', ...node(child)]);
  expect(r.code).toBe(124);
  expect(Date.now() - t0).toBeLessThan(15_000);
  expect(holds(dir)).toEqual([]);
  const grandchild = Number(readFileSync(pidFile, 'utf8'));
  await expect.poll(() => alive(grandchild), { timeout: 5000 }).toBe(false);
});

test('two --shared runs hold slots at the same time', async () => {
  const dir = lockDir();
  const seen = [];
  const watcher = setInterval(() => seen.push(holds(dir).length), 50);
  const sleeper = node('setTimeout(()=>{},2500)');
  const [a, b] = await Promise.all([gpuRun(dir, ['--shared', '--owner', 'SA', '--', ...sleeper]), gpuRun(dir, ['--shared', '--owner', 'SB', '--', ...sleeper])]);
  clearInterval(watcher);
  expect([a.code, b.code]).toEqual([0, 0]);
  expect(Math.max(...seen)).toBe(2);
  expect(holds(dir)).toEqual([]);
});

test('gpu-lock CLI points to gpu-run and npm run walk', async () => {
  const r = await run([GPU_LOCK]); // bad usage: touches no lock
  expect(r.err).toMatch(/gpu-run.*npm run walk/);
  expect(existsSync(GPU_LOCK)).toBe(true);
});
