// Ops page (BL-0032 (3), BL-0035): every opsRefreshSeconds, for each broadcast in broadcasts.json knock 1..maxRooms
// with one guest peer and show the room keys and the room count per broadcast. Never takes a number, shows no person info, keeps nothing (legal N-3).
import { roomKey, probeRoom } from './room-keys.js';

const $ = id => document.getElementById(id);
const peerOptions = { config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] } };

// One guest peer per scan; resolves the peer or null (signaling not reached).
function openGuest(ms) {
  return new Promise(resolve => {
    const peer = new window.Peer(peerOptions);
    const timer = setTimeout(() => { peer.destroy(); resolve(null); }, ms);
    peer.on('open', () => { clearTimeout(timer); resolve(peer); });
    peer.on('error', () => { if (!peer.open) { clearTimeout(timer); peer.destroy(); resolve(null); } });
  });
}

// One broadcast: knock 1..maxRooms on its own key prefix (roomKeyPrefix + broadcast id + '-').
async function scan(peer, net, broadcastId) {
  const options = { ...net, roomKeyPrefix: net.roomKeyPrefix + broadcastId + '-' };
  const rooms = [], unknown = [];
  for (let n = 1; n <= net.maxRooms; n++) {
    const key = roomKey(n, net.roomKeyDigits);
    const r = await probeRoom(peer, key, options);
    if (r.status === 'info') rooms.push({ key, label: `${r.count} / ${r.capacity}명` });
    else if (r.status === 'full') rooms.push({ key, label: '가득 참' });
    else if (r.status !== 'peer-unavailable') unknown.push(key);
  }
  return { rooms, unknown };
}

// Per broadcast: a heading, the key list and the numbers not confirmed. One status line sums the counts.
function render(broadcasts, results) {
  if (!results) { $('ops-status').textContent = '연결 중개에 닿지 못했습니다. 다음 갱신 때 다시 확인합니다.'; return; }
  $('ops-status').textContent = broadcasts.map((b, i) => `${b.name} 방 ${results[i].rooms.length}개`).join(' · ');
  $('ops-broadcasts').replaceChildren(...broadcasts.map((b, i) => {
    const { rooms, unknown } = results[i];
    const section = document.createElement('section'), h2 = document.createElement('h2'), ul = document.createElement('ul'), miss = document.createElement('p');
    h2.textContent = `${b.name} (${b.id}) · 방 ${rooms.length}개`;
    ul.setAttribute('aria-label', `${b.name} 방 키`);
    ul.replaceChildren(...rooms.map(r => { const li = document.createElement('li'); li.textContent = `${r.key} — ${r.label}`; return li; }));
    miss.className = 'note'; miss.hidden = !unknown.length; miss.textContent = `확인하지 못한 번호: ${unknown.join(', ')}`;
    section.append(h2, ul, miss);
    return section;
  }));
  $('ops-time').textContent = `마지막 확인 ${new Date().toLocaleTimeString('ko-KR')}`;
}

const [net, { broadcasts }] = await Promise.all(['network', 'broadcasts'].map(async n => (await fetch(`./config/${n}.json`)).json()));
for (;;) {
  const peer = await openGuest(net.connectTimeoutSeconds * 1000);
  let results = null;
  if (peer) { results = []; for (const b of broadcasts) results.push(await scan(peer, net, b.id)); peer.destroy(); }
  render(broadcasts, results);
  await new Promise(r => setTimeout(r, net.opsRefreshSeconds * 1000));
}
