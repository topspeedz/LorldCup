// Local PeerServer for multi-person walks (qa-x method, test only; the app's PeerJS Cloud setting is untouched).
// Uses the peer/express already installed for V01; no new dependency.
// close() destroys open sockets (WebSocket peers keep server.close() waiting forever) and gives up after 5 s.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';

const require = createRequire(new URL('../../_workspace/qa/2026-11-12-webrtc-20-validation/V01/package.json', import.meta.url));
const express = require('express');
const { ExpressPeerServer } = require('peer');

export async function startPeerServer() {
  const app = express(), server = createServer(app), sockets = new Set();
  server.on('connection', s => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
  app.use('/signal', ExpressPeerServer(server, { path: '/', allow_discovery: false, concurrent_limit: 100 }));
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  return {
    port,
    // Points the vendored PeerJS of every page in this browser context at this server.
    route: context => context.route(/\/vendor\/peerjs\.min\.js$/, async route => {
      const body = await (await route.fetch()).text();
      route.fulfill({ contentType: 'text/javascript', body: body + `
;(()=>{const N=window.Peer;window.Peer=function(id,o){if(id&&typeof id==='object'){o=id;id=undefined;}
return new N(id,{...o,host:'127.0.0.1',port:${port},path:'/signal/',secure:false});};window.Peer.prototype=N.prototype;})();` });
    }),
    close: () => {
      for (const s of sockets) s.destroy();
      return Promise.race([new Promise(r => server.close(() => r())), new Promise(r => setTimeout(r, 5000).unref())]);
    },
  };
}
