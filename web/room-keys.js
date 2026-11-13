// Sequential room keys (BL-0032): find a room with a free seat from the lowest number up, or claim a free number and host it.
// Config values come in as arguments (network.json keys); createPeer(id?) wraps `new window.Peer(id, options)`.

export const roomKey = (n, digits) => String(n).padStart(digits, '0');

// Outside input (?room=): exactly `digits` digits, 1..maxRooms. Anything else → null.
export function parseRoomKey(value, { roomKeyDigits, maxRooms }) {
  if (typeof value !== 'string' || value.length !== roomKeyDigits || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= maxRooms ? value : null;
}

// A room's showtime (roundStart, epoch ms) from outside: a safe integer on a round boundary, within a day of now.
export function validShowtime(value, intervalMs, nowMs) {
  return Number.isSafeInteger(value) && value % intervalMs === 0 && Math.abs(value - nowMs) < 86_400_000;
}

// Invite URL ?b=<broadcast id>&t=<showtime>&room=<room key> (architecture, 방송과 상영 시각).
// Not an invite (bad room, unknown b) → null. A bad t is dropped to null; the invite stands.
// No room but a valid t (a link copied before the room was settled) → an invite to that showtime, roomKey null (UX-M15).
export function parseInvite(search, { broadcastIds, roundIntervalMinutes, roomKeyDigits, maxRooms, nowMs }) {
  const params = new URLSearchParams(search);
  const hasRoom = params.has('room');
  const roomKey = hasRoom ? parseRoomKey(params.get('room'), { roomKeyDigits, maxRooms }) : null;
  if (hasRoom && !roomKey) return null;
  const b = params.get('b'), broadcastId = b === null ? broadcastIds[0] : b;
  if (!broadcastIds.includes(broadcastId)) return null;
  const t = params.get('t'), n = /^\d{1,16}$/.test(t ?? '') ? Number(t) : NaN;
  const showtime = validShowtime(n, roundIntervalMinutes * 60_000, nowMs) ? n : null;
  if (!roomKey && showtime === null) return null;
  return { broadcastId, showtime, roomKey };
}

// Resolves 'open', the error type, or 'timeout'.
function opened(peer, ms) {
  return new Promise(resolve => {
    const finish = v => { clearTimeout(timer); peer.off('open', onOpen); peer.off('error', onError); resolve(v); };
    const onOpen = () => finish('open'), onError = e => finish(e?.type ?? 'error');
    const timer = setTimeout(() => finish('timeout'), ms);
    peer.on('open', onOpen); peer.on('error', onError);
  });
}

// One knock on one number with an already open peer. ops: say hello and wait for info (never counted as a guest).
// Result: {status:'joined', conn, roundStart} (connection kept open) | 'info' | 'full' | 'peer-unavailable' | 'timeout' | 'closed'.
// Every other answer closes the connection at once (legal N-2).
function knock(peer, key, { roomKeyPrefix, connectTimeoutSeconds, capacity = Infinity }, ops = false) {
  const id = roomKeyPrefix + key;
  return new Promise(resolve => {
    const conn = peer.connect(id, { reliable: false, serialization: 'json' });
    let hello = null;
    const done = (result, keep = false) => {
      clearTimeout(timer); clearInterval(hello);
      peer.off('error', onError); conn.off('open', onOpen); conn.off('data', onData); conn.off('close', onClose);
      if (keep) return resolve({ ...result, conn });
      conn.close(); resolve(result);
    };
    // PeerJS reports an unknown id on the peer, not the connection: "Could not connect to peer <id>".
    const onError = e => { if (e?.type === 'peer-unavailable' && String(e.message).endsWith(' ' + id)) done({ status: 'peer-unavailable' }); };
    const onOpen = () => {
      if (!ops) return;
      const say = () => conn.send({ type: 'hello', role: 'ops' });
      say(); hello = setInterval(say, 1000);
    };
    const onData = data => {
      if (data?.type === 'full') done({ status: 'full' });
      else if (!ops && data?.type === 'room' && Number.isSafeInteger(data.roundStart)) done({ status: 'joined', roundStart: data.roundStart }, true);
      else if (ops && data?.type === 'info' && Number.isInteger(data.count) && Number.isInteger(data.capacity)
        && data.count >= 1 && data.count <= data.capacity && data.capacity <= capacity) done({ status: 'info', count: data.count, capacity: data.capacity });
    };
    const onClose = () => done({ status: 'closed' });
    const timer = setTimeout(() => done({ status: 'timeout' }), connectTimeoutSeconds * 1000);
    peer.on('error', onError); conn.on('open', onOpen); conn.on('data', onData); conn.on('close', onClose);
  });
}

// For the ops page: knock without claiming the number.
export const probeRoom = (peer, key, options) => knock(peer, key, options, true);

// A free number: try to claim it. Lost the race (unavailable-id) → knock again as a guest.
async function settle(guest, key, first, options) {
  if (first.status !== 'peer-unavailable') return first;
  const host = options.createPeer(options.roomKeyPrefix + key);
  const claimed = await opened(host, options.connectTimeoutSeconds * 1000);
  if (claimed === 'open') return { status: 'host', peer: host };
  host.destroy();
  return claimed === 'unavailable-id' ? knock(guest, key, options) : { status: 'timeout' };
}

// Hand back {status, key, peer, conn?, roundStart?}; the peer that is not handed back is destroyed.
function finish(guest, key, result) {
  if (result.status === 'joined') return { ...result, key, peer: guest };
  guest.destroy();
  return { ...result, key };
}

async function openGuest(options) {
  const guest = options.createPeer();
  const state = await opened(guest, options.connectTimeoutSeconds * 1000);
  if (state === 'open') return { guest };
  guest.destroy();
  return { idle: { status: 'idle', reason: state } };
}

// Auto placement: 1..maxRooms in order, probeParallel knocks in flight; results are used in number order.
export async function findRoom(options) {
  const { roomKeyDigits, maxRooms, probeParallel = 1 } = options;
  const { guest, idle } = await openGuest(options);
  if (idle) return idle;
  const keys = Array.from({ length: maxRooms }, (_, i) => roomKey(i + 1, roomKeyDigits));
  const pending = [];
  let found = null;
  for (let i = 0; i < keys.length && !found; i++) {
    while (pending.length < Math.min(probeParallel, keys.length - i)) pending.push(knock(guest, keys[i + pending.length], options));
    const result = await settle(guest, keys[i], await pending.shift(), options);
    // Another showtime's room: let it go at once and try the next number (showtime null does not filter).
    if (result.status === 'joined' && options.showtime != null && result.roundStart !== options.showtime) { result.conn.close(); continue; }
    if (result.status === 'joined' || result.status === 'host') found = finish(guest, keys[i], result);
  }
  for (const p of pending) p.then(r => r.conn?.close()); // knocks still in flight: a later room that said yes is let go
  if (found) return found;
  guest.destroy();
  return { status: 'idle', reason: 'no-room' };
}

// Invite URL / multiplayer.join(key): that number only, whatever its showtime. full and timeout are returned for the caller to explain; no other room is tried.
export async function joinRoom(options) {
  const key = parseRoomKey(options.key, options);
  if (!key) return { status: 'idle', reason: 'bad-key' };
  const { guest, idle } = await openGuest(options);
  if (idle) return idle;
  return finish(guest, key, await settle(guest, key, await knock(guest, key, options), options));
}
