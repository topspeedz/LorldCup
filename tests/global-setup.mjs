// Takes the GPU lock, then serves web/ on a free port. The returned function is the teardown.
// Full runs and runs that include an FPS spec hold the GPU alone; other runs share it (gpu-lock.mjs).
import { acquire, release } from './gpu-lock.mjs';
import { serve } from './serve.mjs';

// Specs that measure real frame rate (median FPS ≥ 60). character-clips and emote-fx only step simulated dt, not FPS.
export const FPS_SPECS = ['tests/perf-fps.spec.mjs', 'tests/qa-p.spec.mjs'];
// Playwright flags that take a separate value (`--flag value`); their value is not a file filter.
const VALUE_FLAGS = new Set(['-c', '--config', '-g', '--grep', '--grep-invert', '--project', '-j', '--workers', '--reporter',
  '--output', '--timeout', '--global-timeout', '--repeat-each', '--retries', '--max-failures', '--shard', '--trace', '--tsconfig']);
// A filter names an FPS spec if it ends with its file name or matches it as a regex; an unreadable filter counts as heavy.
const names = (filter, spec) => {
  const path = filter.replace(/:\d+(:\d+)?$/, '').replaceAll('\\', '/');
  if (path.endsWith(spec.split('/').pop())) return true;
  try { return new RegExp(path).test(spec) || new RegExp(filter).test(spec); } catch { return true; }
};

// args: what follows `playwright test`. File filters are regexes matched against the file path (`file:line` allowed).
export function lockMode(args) {
  if (!args) return 'exclusive';
  const filters = args.filter((a, i) => !a.startsWith('-') && !VALUE_FLAGS.has(args[i - 1]));
  if (!filters.length) return 'exclusive';
  return filters.some(f => FPS_SPECS.some(s => names(f, s))) ? 'exclusive' : 'shared';
}

export default async function () {
  const owner = process.env.GPU_LOCK_OWNER || `npm-test-${process.pid}`;
  const at = process.argv.indexOf('test');
  const mode = lockMode(at < 0 ? null : process.argv.slice(at + 1));
  await acquire(owner, { mode, watch: true });
  console.log(`GPU lock (${mode}) held by ${owner}`);
  let server;
  try { server = await serve(); } catch (e) { release(owner); throw e; }
  process.env.ARENA_URL = server.url;
  return async () => { await server.close(); release(owner); };
}
