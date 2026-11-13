import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

// T16 BL-0032 (3): the ops page lists the room keys and the room count, never takes a number, shows no person info,
// keeps nothing, and refreshes every opsRefreshSeconds (shortened here, in the test only).
// Rooms run on a local PeerServer (V01 method, as in qa-x / room-handoff); the app's PeerJS Cloud setting is untouched.
const require = createRequire(new URL('../_workspace/qa/2026-11-12-webrtc-20-validation/V01/package.json', import.meta.url));
const express = require('express');
const { ExpressPeerServer } = require('peer');
const PREFIX = 'barclays-tps-room-final-'; // FIX1c: host peer id = prefix + broadcast id + '-' + key
const REFRESH = 2; // seconds, test only (network.json keeps 30)

test('ops page: two rooms → two keys and count 2, no person info, nothing kept, refresh interval', async ({ browser, baseURL }) => {
  test.setTimeout(120_000);
  const app = express(), server = createServer(app);
  // An unknown id answers peer-unavailable after expire_timeout (default 5 s): shortened toward PeerJS Cloud (~0.27 s, T14 R-2)
  // so one scan of 50 numbers fits the test.
  app.use('/signal', ExpressPeerServer(server, { path: '/', allow_discovery: false, concurrent_limit: 100, expire_timeout: 200, cleanup_out_msgs: 100 }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const contexts = [];
  const newContext = async () => {
    const context = await browser.newContext();
    await context.route(/\/vendor\/peerjs\.min\.js$/, async route => {
      const body = await (await route.fetch()).text();
      route.fulfill({ contentType: 'text/javascript', body: body + `
;(()=>{const N=window.Peer;window.Peer=function(id,o){if(id&&typeof id==='object'){o=id;id=undefined;}
return new N(id,{...o,host:'127.0.0.1',port:${port},path:'/signal/',secure:false});};window.Peer.prototype=N.prototype;})();` });
    });
    contexts.push(context);
    return context;
  };
  try {
    // Two room hosts (01: 1/16, 03: 5/16) that answer hello like multiplayer.js, plus person info the page must not show.
    const hosts = await (await newContext()).newPage();
    await hosts.goto(new URL('config/network.json', baseURL).href);
    await hosts.addScriptTag({ url: new URL('vendor/peerjs.min.js', baseURL).href });
    await hosts.evaluate(prefix => {
      window.rooms = {};
      window.host = (key, count) => new Promise((resolve, reject) => {
        const peer = new Peer(prefix + key), room = rooms[key] = { peer, open: 0, hellos: 0 };
        peer.on('connection', conn => {
          conn.on('open', () => room.open++);
          conn.on('close', () => room.open--);
          conn.on('data', d => {
            if (d?.type !== 'hello' || d.role !== 'ops') return;
            room.hellos++;
            const info = { type: 'info', count, capacity: 16, nickname: '팬9999', members: ['secret-peer-id'] };
            for (let i = 0; i < 3; i++) conn.send(info);
            setTimeout(() => conn.close(), 1000);
          });
        });
        peer.on('open', () => resolve()); peer.on('error', reject);
      });
    }, PREFIX);
    await hosts.evaluate(() => Promise.all([host('01', 1), host('03', 5)]));

    // The ops page, with opsRefreshSeconds shortened and every storage / console / outgoing request watched.
    const opsContext = await newContext();
    await opsContext.route(/\/config\/network\.json$/, async route => {
      const json = await (await route.fetch()).json();
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...json, opsRefreshSeconds: REFRESH }) });
    });
    const ops = await opsContext.newPage();
    const errors = [], requests = [];
    ops.on('pageerror', e => errors.push(e.message));
    ops.on('request', r => requests.push(r.method() + ' ' + new URL(r.url()).pathname));
    await ops.addInitScript(() => {
      window.__kept = [];
      for (const m of ['log', 'info', 'warn', 'error', 'debug', 'table', 'dir']) {
        const f = console[m]; console[m] = (...a) => { window.__kept.push('console.' + m); return f.apply(console, a); };
      }
      // On the prototype: assigning localStorage.setItem would itself store an item named "setItem".
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { window.__kept.push('storage ' + k); return set.call(this, k, v); };
      const click = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function () { window.__kept.push('anchor click'); return click.call(this); };
    });
    await ops.goto('/ops.html');

    // FIX1c: per broadcast (broadcasts.json); with the one broadcast "final" the page reads "결승전 방 N개" and one key list.
    const list = ops.getByRole('list', { name: '방 키' });
    const status = ops.getByRole('status');
    await expect(status).toContainText('방 2개', { timeout: 30_000 });
    await expect(list.getByRole('listitem')).toHaveText([/^01\b.*1\s*\/\s*16/, /^03\b.*5\s*\/\s*16/]);

    // No person info: the extra fields the hosts sent are not on the page.
    const text = await ops.locator('body').innerText();
    expect(text).not.toContain('팬9999');
    expect(text).not.toContain('secret-peer-id');

    // Never takes a number: no peer on the server holds a room-key id except the two hosts.
    // (Checked by opening the free numbers ourselves: 02 must be claimable.)
    expect(await hosts.evaluate(prefix => new Promise(resolve => {
      const p = new Peer(prefix + '02'); p.on('open', () => { p.destroy(); resolve('free'); }); p.on('error', e => resolve(e.type));
    }), PREFIX)).toBe('free');

    // Refresh: room 03 closes → within the shortened interval the list shows 01 only and count 1. Room 02 opens → 2 again.
    const hellos = await hosts.evaluate(() => rooms['01'].hellos);
    await hosts.evaluate(() => rooms['03'].peer.destroy());
    const t0 = Date.now();
    // Under 25 s tells the shortened 2 s interval from the 30 s default: the page reads opsRefreshSeconds.
    await expect(status).toContainText('방 1개', { timeout: 25_000 });
    await expect(list.getByRole('listitem')).toHaveText([/^01\b/]);
    expect(Date.now() - t0, 'refreshed by opsRefreshSeconds').toBeLessThan(25_000);
    await hosts.evaluate(() => host('02', 16));
    await expect(status).toContainText('방 2개', { timeout: 25_000 });
    await expect(list.getByRole('listitem')).toHaveText([/^01\b/, /^02\b.*16\s*\/\s*16/]);
    expect(await hosts.evaluate(() => rooms['01'].hellos)).toBeGreaterThan(hellos);

    // Every ops connection is closed once answered.
    await expect.poll(() => hosts.evaluate(() => rooms['01'].open + rooms['02'].open), { timeout: 5_000 }).toBe(0);

    // Keeps nothing: no console, no storage, no download, no request beyond the page's own files and signaling.
    expect(await ops.evaluate(() => window.__kept)).toEqual([]);
    expect(errors).toEqual([]);
    const own = /^GET \/(ops\.html|ops\.js|room-keys\.js|vendor\/peerjs\.min\.js|config\/(network|broadcasts)\.json|favicon\.ico)$/;
    expect(requests.filter(r => !own.test(r) && !r.includes('/signal/'))).toEqual([]);
    expect(await ops.evaluate(() => [...Object.keys(localStorage), ...Object.keys(sessionStorage)])).toEqual([]);
  } finally {
    await Promise.all(contexts.map(c => c.close()));
    await new Promise(r => server.close(r));
  }
});

test('ops page is not linked from the app screen', () => {
  const root = new URL('../web/', import.meta.url);
  for (const f of ['index.html', 'main.js', 'modules.js']) {
    let src = '';
    try { src = readFileSync(new URL(f, root), 'utf8'); } catch { continue; }
    expect(src, f).not.toContain('ops.html');
  }
});
