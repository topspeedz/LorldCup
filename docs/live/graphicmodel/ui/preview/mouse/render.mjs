// T60 mouse-first mockups: node docs/live/graphicmodel/ui/preview/mouse/render.mjs (run from repo root).
// Static HTML over saved app captures, chromium --disable-gpu (no WebGL, no new 3D capture).
// Writes <state>.png, counts.json (boxes · visible chars, same counting rule as T59 walk), checks.json, contrast.json.
// Exits 1 if any overlap / viewport / one-accent check fails.
import { chromium } from '@playwright/test';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve, dirname, relative } from 'node:path';
import { writeFileSync, readFileSync } from 'node:fs';
const dir = dirname(fileURLToPath(import.meta.url)) + '/';
const root = resolve('.') + '/';
const { serve } = await import(pathToFileURL(resolve('tests/serve.mjs')));
const D = [1280, 720], M = [390, 844];
const ALL = { 'd-first': D, 'm-first': M, 'd-invite': D, 'm-invite': M, 'd-walk': D, 'm-walk': M, 'd-copied': D, 'm-copied': M,
  'd-near-seat': D, 'm-near-seat': M, 'd-seated': D, 'm-seated': M, 'd-full': D, 'm-full': M,
  'd-wait': D, 'm-wait': M, 'd-wait-full': D, 'm-wait-full': M };
// video rect in the seated capture (temp/T59/shots/08-seated.png): every HUD box, the copied line and the toast included, stays off it (T60b LG-H-4)
// node render.mjs [state ...]: re-render only those states and merge them into the json files (T60b)
const only = process.argv.slice(2);
const S = only.length ? Object.fromEntries(only.map(s => [s, ALL[s]])) : ALL;
// T60c: screen rects read off the walk-arena captures (d: both faces of the hanging screen, m: the face at top-left)
const VIDEO = { 'd-seated': [232, 34, 1048, 600], 'd-wait': [420, 0, 850, 160], 'm-wait': [0, 0, 195, 170] };
const page$ = () => {
  const vis = e => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
  // box = visible element with a background or a border (kbd-like keycaps and clone patches excluded), as in T59
  const boxes = [...document.body.querySelectorAll('*')].filter(e => !e.matches('.kc,.patch,script,svg,svg *,span,b,u') && vis(e) && (() => {
    const c = getComputedStyle(e); return !c.backgroundColor.endsWith(', 0)') && c.backgroundColor !== 'transparent' || ['Top', 'Left'].some(k => parseFloat(c[`border${k}Width`]) > 0 && !c[`border${k}Color`].endsWith(', 0)'));
  })());
  const chars = document.body.innerText.replace(/\s/g, '').length;
  return { boxes: boxes.length, chars, accents: document.querySelectorAll('button.primary').length };
};
const check = (video) => {
  const R = e => e.getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
  const inView = r => r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
  const res = [], boxes = [...document.querySelectorAll('[data-box]')].map(e => [e.dataset.box, R(e)]);
  for (const [n, r] of boxes) res.push({ check: `${n} inside viewport`, ok: inView(r) });
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const nest = document.querySelector(`[data-box="${boxes[i][0]}"]`).contains(document.querySelector(`[data-box="${boxes[j][0]}"]`));
    if (!nest) res.push({ check: `${boxes[i][0]} × ${boxes[j][0]} no overlap`, ok: !hit(boxes[i][1], boxes[j][1]) });
  }
  if (video) { const v = { left: video[0], top: video[1], right: video[2], bottom: video[3] };
    for (const [n, r] of boxes) res.push({ check: `${n} off the video`, ok: !hit(r, v) }); }
  const targets = [...document.querySelectorAll('button,input')].map(R).filter(r => r.width);
  res.push({ check: 'all targets ≥ 24×24', ok: targets.every(r => r.width >= 24 && r.height >= 24) });
  res.push({ check: 'one accent button', ok: document.querySelectorAll('button.primary').length <= 1 });
  return res;
};
// contrast: brightest capture pixel under each text element, its panel composited over it (same method as ../../../../../_workspace/.../preview/ui/b)
const measure = () => new Promise(done => {
  const src = getComputedStyle(document.body).backgroundImage; if (src === 'none') { done([]); return; }
  const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); c.width = innerWidth; c.height = innerHeight;
    const g = c.getContext('2d'); const k = Math.max(innerWidth / img.width, innerHeight / img.height);
    g.drawImage(img, (innerWidth - img.width * k) / 2, (innerHeight - img.height * k) / 2, img.width * k, img.height * k);
    const lin = v => (v /= 255) <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4, L = ([r, gg, b]) => .2126 * lin(r) + .7152 * lin(gg) + .0722 * lin(b);
    const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };
    const rgb = s => s.match(/[\d.]+/g).slice(0, 3).map(Number), mix = (a, b, t) => a.map((v, i) => v * t + b[i] * (1 - t));
    const out = [];
    for (const el of document.querySelectorAll('[data-check]')) {
      const r = el.getBoundingClientRect(); if (!r.width) continue;
      const px = g.getImageData(Math.max(0, r.left | 0), Math.max(0, r.top | 0), Math.max(1, r.width | 0), Math.max(1, r.height | 0)).data;
      let worst = null, wl = -1; for (let i = 0; i < px.length; i += 4) { const p = [px[i], px[i + 1], px[i + 2]], l = L(p); if (l > wl) { wl = l; worst = p; } }
      let panel = null, alpha = 0;
      for (let n = el; n && n !== document.body; n = n.parentElement) {
        if (!panel && n.matches('button:not(.ghost)')) { panel = rgb(getComputedStyle(n).backgroundColor); alpha = 1; }
        if (!panel && n.matches('.panel-hud,.panel,.card')) { panel = [7, 18, 29]; alpha = n.matches('.panel-hud') ? .81 : n.matches('.card') ? 1 : .91; }
      }
      const under = panel ? mix(panel, worst, alpha) : worst;
      out.push({ text: el.textContent.trim().slice(0, 20), kind: el.dataset.check, contrast: +ratio(rgb(getComputedStyle(el).color), under).toFixed(2) });
    }
    done(out);
  }; img.src = src.slice(5, -2);
});
const server = await serve(root);
const browser = await chromium.launch({ channel: 'chromium', args: ['--disable-gpu'] });
const old = f => { try { return only.length ? JSON.parse(readFileSync(dir + f, 'utf8')) : {}; } catch { return {}; } };
const counts = old('counts.json'), checks = old('checks.json'), contrast = old('contrast.json'); let fail = 0;
try {
  for (const [s, [w, h]] of Object.entries(S)) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(`${server.url}${relative(root, dir).replaceAll('\\', '/')}/mock.html?s=${s}`); await page.waitForTimeout(400);
    counts[s] = await page.evaluate(page$); checks[s] = await page.evaluate(check, VIDEO[s]); contrast[s] = await page.evaluate(measure);
    await page.screenshot({ path: dir + s + '.png' }); await page.close();
    const bad = checks[s].filter(c => !c.ok); fail += bad.length;
    const t = contrast[s].filter(x => x.kind === 'text').map(x => x.contrast);
    console.log(s, `boxes ${counts[s].boxes} · chars ${counts[s].chars}`, 'min text contrast', t.length ? Math.min(...t) : '-', 'checks', `${checks[s].length - bad.length}/${checks[s].length}`, bad.map(b => b.check).join('; '));
  }
  writeFileSync(dir + 'counts.json', JSON.stringify(counts, null, 1));
  writeFileSync(dir + 'checks.json', JSON.stringify(checks, null, 1));
  writeFileSync(dir + 'contrast.json', JSON.stringify(contrast, null, 1));
} finally { await browser.close(); await server.close(); }
process.exit(fail ? 1 : 0);
