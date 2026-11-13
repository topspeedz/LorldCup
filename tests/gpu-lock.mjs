// GPU lock (design 6.7). Two kinds of hold:
//   exclusive  _workspace/gpu-lock.json            alone: waits until every shared slot is free (bake, perf run, full test run)
//   shared     _workspace/gpu-lock.slot-<i>.json   up to GPU_LOCK_SLOTS (default 2) at once (functional browser tests)
// Waiters take a ticket in _workspace/gpu-lock.queue/ and enter first come first served; a shared waiter never
// overtakes an exclusive one queued ahead of it. gpu-lock.json keeps its old shape, so old-code runs still wait on it.
// Holds written with watch:true belong to a process that lives for the whole hold (npm test, a waiting ticket):
// when that pid is gone the file is cleared. CLI holds (watch absent) outlive their short-lived CLI process and
// are only freed by `release`.
// CLI: node tests/gpu-lock.mjs acquire|release <owner>  (exclusive)   Env: GPU_LOCK_WAIT_MS (default 30 min), GPU_LOCK_SLOTS.
// shortcut: a pid reused by a new process keeps a dead hold alive, and a clear can race a same-name re-create; both rare on one PC.
import { openSync, writeSync, closeSync, readFileSync, unlinkSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const LOCK_PATH = fileURLToPath(new URL('../_workspace/gpu-lock.json', import.meta.url));
const read = file => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };
const holder = path => read(path)?.owner ?? null;
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const unlink = file => { try { unlinkSync(file); } catch (e) { if (e.code !== 'ENOENT') throw e; } };
const create = (file, data) => {
  try { const fd = openSync(file, 'wx'); writeSync(fd, JSON.stringify(data)); closeSync(fd); return true; }
  catch (e) { if (e.code === 'EEXIST') return false; throw e; }
};
const files = path => {
  const dir = dirname(path), stem = basename(path).replace(/\.json$/, '');
  const list = prefix => { try { return readdirSync(prefix ? dir : `${join(dir, stem)}.queue`).filter(f => !prefix || f.startsWith(prefix)); } catch { return []; } };
  return {
    queue: `${join(dir, stem)}.queue`,
    slot: i => join(dir, `${stem}.slot-${i}.json`),
    slots: () => list(`${stem}.slot-`).map(f => join(dir, f)),
    tickets: () => list(null).sort().map(f => join(`${join(dir, stem)}.queue`, f)),
  };
};
// Clears holds whose process is gone. Only watch:true files; CLI and legacy holds stay.
const clearDead = (path, f) => {
  for (const file of [path, ...f.slots(), ...f.tickets()]) {
    const data = read(file);
    if (data?.watch && !alive(data.pid)) unlink(file);
  }
};
let seq = 0;

export async function acquire(owner, { path = LOCK_PATH, mode = 'exclusive', slots = Number(process.env.GPU_LOCK_SLOTS) || 2,
  watch = mode === 'shared', waitMs = Number(process.env.GPU_LOCK_WAIT_MS) || 30 * 60_000, pollMs = 2000 } = {}) {
  const f = files(path);
  mkdirSync(f.queue, { recursive: true });
  const hold = () => ({ owner, pid: process.pid, since: new Date().toISOString(), mode, ...(watch && { watch }) });
  const ticket = join(f.queue, `${String(Date.now()).padStart(15, '0')}-${String(seq++).padStart(6, '0')}-${process.pid}-${Math.random().toString(36).slice(2, 8)}.json`);
  const deadline = Date.now() + waitMs;
  let queued = false;
  try {
    for (;;) {
      clearDead(path, f);
      if (holder(path) === owner || f.slots().some(s => holder(s) === owner)) return;
      if (!queued) { create(ticket, { owner, pid: process.pid, mode, watch: true }); queued = true; }
      const tickets = f.tickets(), ahead = tickets.slice(0, tickets.indexOf(ticket));
      const exclusive = holder(path), taken = f.slots();
      if (mode === 'exclusive') {
        if (!ahead.length && !taken.length && create(path, hold())) return;
      } else if (!exclusive && ahead.every(t => read(t)?.mode === 'shared') && ahead.length < slots - taken.length) {
        for (let i = 0; i < slots; i++) if (create(f.slot(i), hold())) return;
      }
      if (Date.now() >= deadline) {
        const who = exclusive || taken.map(holder).join(', ') || ahead.map(t => read(t)?.owner).join(', ') || 'nobody';
        throw new Error(`GPU lock held by ${who}; waited ${waitMs} ms`);
      }
      await new Promise(r => setTimeout(r, pollMs));
    }
  } finally {
    if (queued) unlink(ticket);
  }
}

export function release(owner, { path = LOCK_PATH } = {}) {
  const current = holder(path);
  if (current === owner) return unlinkSync(path);
  const slot = files(path).slots().find(s => holder(s) === owner);
  if (slot) return unlinkSync(slot);
  throw new Error(current ? `GPU lock held by ${current}, not ${owner}` : `GPU lock is not held (${owner})`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [cmd, owner] = process.argv.slice(2);
  console.error('gpu-lock CLI is kept for old callers: use node tests/gpu-run.mjs (bake, perf) or npm run walk (browser walks).');
  try {
    if (!owner || !['acquire', 'release'].includes(cmd)) throw new Error('usage: node tests/gpu-lock.mjs acquire|release <owner>');
    if (cmd === 'acquire') await acquire(owner); else release(owner);
    console.log(`GPU lock ${cmd}d by ${owner}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
