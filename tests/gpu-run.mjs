// GPU work outside Playwright (bake, perf measurement): node tests/gpu-run.mjs [--shared] [--max-min <min>] [--owner <name>] -- <command…>
// Holds the GPU lock in this one process for exactly the life of the child command: takes it (exclusive, or a shared slot
// with --shared), runs the command, and frees it however the child ends. Exits with the child's code; over --max-min
// (default 30) it ends the whole child tree and exits 124. The hold is watch:true with this pid, so a killed gpu-run is cleared.
// Browser walks and diagnostics use `npm run walk` instead. Env: GPU_LOCK_PATH (tests only), GPU_LOCK_WAIT_MS, GPU_LOCK_SLOTS.
import { spawn, spawnSync } from 'node:child_process';
import { acquire, release, LOCK_PATH } from './gpu-lock.mjs';

const argv = process.argv.slice(2), cut = argv.indexOf('--');
const opts = cut < 0 ? argv : argv.slice(0, cut), cmd = cut < 0 ? [] : argv.slice(cut + 1);
const flag = name => { const i = opts.indexOf(name); return i < 0 ? undefined : opts[i + 1]; };
const shared = opts.includes('--shared');
const maxMin = Number(flag('--max-min') ?? 30), owner = flag('--owner') ?? `gpu-run-${process.pid}`;
const path = process.env.GPU_LOCK_PATH || LOCK_PATH;
if (!cmd.length || !(maxMin > 0)) {
  console.error('usage: node tests/gpu-run.mjs [--shared] [--max-min <min>] [--owner <name>] -- <command…>');
  process.exit(2);
}

let held = false, child, timedOut = false;
const free = () => { if (held) { held = false; try { release(owner, { path }); } catch (e) { console.error(e.message); } } };
const killTree = () => {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(child.pid)], { stdio: 'ignore' });
  else try { process.kill(-child.pid, 'SIGKILL'); } catch {}
};
process.on('exit', free);
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, () => { killTree(); free(); process.exit(130); });

try {
  await acquire(owner, { path, mode: shared ? 'shared' : 'exclusive', watch: true });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
held = true;
console.error(`gpu-run: GPU lock (${shared ? 'shared' : 'exclusive'}) held by ${owner}`);
const line = cmd.map(a => /[\s"&|<>^]/.test(a) ? `"${a.replaceAll('"', '\\"')}"` : a).join(' ');
child = spawn(line, { stdio: 'inherit', shell: true, detached: process.platform !== 'win32' });
const timer = setTimeout(() => { timedOut = true; console.error(`gpu-run: over ${maxMin} min, ending ${owner}`); killTree(); }, maxMin * 60_000);
child.on('exit', code => {
  clearTimeout(timer);
  free();
  process.exit(timedOut ? 124 : code ?? 1);
});
