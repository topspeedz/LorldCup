import {createAvatar} from './avatar.js';
import {findRoom,joinRoom,parseRoomKey,validShowtime} from './room-keys.js';
import {APP_ENTER,ROOM_JOINED,ROOM_LEFT,ROOM_STATE,ROOM_ROUND,SCREEN_STATE,PEER_STATE,TEAM_CHANGED,CHARACTER_CHANGED,EMOTE_PLAYED,SEAT_ENTER,SEAT_EXIT} from './events.js';

export function validPose(p){return Array.isArray(p)&&p.length===4&&p.every(Number.isFinite)&&p.slice(0,3).every(n=>Math.abs(n)<1000)&&Math.abs(p[3])<=Math.PI;}
// Same-room nickname clash: the host appends one digit at a time until the name is free.
export function uniqueNickname(name,taken,random=Math.random){while(taken.has(name))name+=Math.floor(random()*10);return name;}
// X-L-1: vendored PeerJS 1.5.5 throws on a JSON null or unparsable payload before our handler runs. Drop those first.
// shortcut: wraps PeerJS's private _handleDataMessage, recheck when the vendored PeerJS changes.
function guardData(conn){
 const handle=conn._handleDataMessage;if(typeof handle!=='function'||!conn.decoder||!conn.parse)return;
 conn._handleDataMessage=function(message){let value;try{value=this.parse(this.decoder.decode(message.data));}catch{return;}if(value!==null)handle.call(this,message);};
}
// Wait before claiming the room key id again while a cut host still holds it (T14 measured, see report).
const RETRY_MS=2000;
export function createMultiplayer(scene,getPose,ctx){
 const net=ctx.config('network'),intervalMs=ctx.config('screen').roundIntervalMinutes*60000,bus=ctx.events;
 const connections=new Map(),poses=new Map(),avatars=new Map(),states=new Map(),names=new Map(),emitted=new Map(),waits=new Map(),arrived=new Map();
 const random=n=>String(Math.floor(Math.random()*10**n)).padStart(n,'0');
 const mine={team:null,character:null,nickname:net.nickname.prefix+random(net.nickname.digits),emote:null,emoteSeq:0,seated:false};
 // Room keys are counted per broadcast: host peer id = roomKeyPrefix + broadcast id + '-' + key (BL-0035).
 let broadcast='',showtime=null;
 const prefix=()=>net.roomKeyPrefix+broadcast+'-',pad=n=>String(n).padStart(net.roomKeyDigits,'0'),keyId=k=>prefix()+k;
 const peerOptions={config:{iceServers:[{urls:'stun:stun.l.google.com:19302'}]}};
 const createPeer=id=>id?new window.Peer(id,peerOptions):new window.Peer(peerOptions);
 const currentRound=()=>Math.floor(Date.now()/intervalMs)*intervalMs;
 // This module writes no screen text: failures end in phase 'idle' (room:state) and ui/invite.js shows them.
 // members: host = connected guests in join order (original peer ids); guest = the last list the host sent.
 let peer=null,keyPeer=null,isHost=false,hostId='',key=null,phase='idle',members=[],prior=[],candidates=[],seq=0;
 let lastSend=0,lastResend=0,dirty=false,handoffTimer=null,claimTimer=null,roundTimer=null,screenEnded=false,room=null,published='',lastState=null,attempt=0;
 // LG-M-12: nothing reaches the signaling server (or STUN) before app:enter; an invite key waits for it too.
 let entered=false;
 const emit=(name,detail)=>bus.dispatchEvent(new CustomEvent(name,{detail}));
 const live=owner=>!!owner&&(owner===peer||owner===keyPeer);
 const text=(v,max)=>v===null||typeof v==='string'&&v.length<=max;
 const idList=(v,max)=>Array.isArray(v)&&v.length<=max&&v.every(id=>typeof id==='string'&&id.length<=80)&&new Set(v).size===v.length;
 function validNickname(v){
  if(typeof v!=='string'||!v.startsWith(net.nickname.prefix))return false;
  const digits=v.slice(net.nickname.prefix.length);
  return /^\d+$/.test(digits)&&digits.length>=net.nickname.digits&&digits.length<=net.nickname.digits+4;
 }
 // Untrusted input from other peers: copy only the known fields after checking their shape.
 function cleanState(s){
  if(!s||typeof s!=='object'||!text(s.team,40)||!text(s.character,40)||!validNickname(s.nickname)||!text(s.emote,40)||!Number.isInteger(s.emoteSeq)||s.emoteSeq<0||typeof s.seated!=='boolean')return null;
  return {team:s.team,character:s.character,nickname:s.nickname,emote:s.emote,emoteSeq:s.emoteSeq,seated:s.seated};
 }
 function setState(id,s){
  states.set(id,s);const key=JSON.stringify(s);
  if(emitted.get(id)===key)return false;
  emitted.set(id,key);emit(PEER_STATE,{peerId:id,...s});return true;
 }
 function changed(patch){Object.assign(mine,patch);dirty=true;}
 bus.addEventListener(TEAM_CHANGED,e=>changed({team:e.detail?.teamId??null}));
 bus.addEventListener(CHARACTER_CHANGED,e=>changed({character:e.detail?.characterId??null}));
 bus.addEventListener(EMOTE_PLAYED,e=>changed({emote:e.detail?.id??null,emoteSeq:mine.emoteSeq+1}));
 bus.addEventListener(SEAT_ENTER,()=>changed({seated:true}));
 bus.addEventListener(SEAT_EXIT,()=>changed({seated:false}));
 function joined(roomCode,host,roundStart){room={code:roomCode,host,roundStart};emit(ROOM_JOINED,{...room});}
 // 회차 넘김: the host moves the room to the round just started; guests follow the larger roundStart in `room`.
 function nextRound(r){room.roundStart=r;dirty=true;emit(ROOM_ROUND,{roundStart:r});}
 function roundEnded(){
  if(!isHost||!room||roundTimer)return;
  const r=currentRound();if(r>room.roundStart){nextRound(r);return;}
  // The video is shorter than the round: move once the next boundary has passed.
  roundTimer=setTimeout(()=>{roundTimer=null;if(isHost&&room&&currentRound()>room.roundStart)nextRound(currentRound());},r+intervalMs-Date.now()+50);
 }
 bus.addEventListener(SCREEN_STATE,e=>{screenEnded=e.detail?.status==='ended';if(screenEnded)roundEnded();});
 // room:state goes out whenever one of its four values changes.
 function publish(){
  const s={key,count:isHost?1+members.length:avatars.size+1,host:isHost,phase:isHost&&room?(members.length?'room':'solo'):phase};
  const json=JSON.stringify(s);if(json===published)return;published=json;lastState=s;emit(ROOM_STATE,{...s});
 }
 function remove(id){const a=avatars.get(id);if(a){scene.remove(a);a.userData.material.dispose();avatars.delete(id);}poses.delete(id);states.delete(id);emitted.delete(id);names.delete(id);}
 function display(entries){
  const present=new Set();
  for(const [id,pose] of entries){
   if(id===peer?.id)continue;
   present.add(id);let a=avatars.get(id);
   if(!a){a=createAvatar(0xffb34d);avatars.set(id,a);scene.add(a);}
   a.position.set(...pose.slice(0,3));a.rotation.y=pose[3];
  }
  for(const id of avatars.keys())if(!present.has(id))remove(id);
  publish();
 }
 function leave(){
  const old=peer,oldKey=keyPeer;peer=keyPeer=null;attempt++;
  for(const t of [handoffTimer,claimTimer,roundTimer])clearTimeout(t);handoffTimer=claimTimer=roundTimer=null;
  for(const c of connections.values())c.close();connections.clear();old?.destroy();oldKey?.destroy();
  for(const id of avatars.keys())remove(id);poses.clear();states.clear();emitted.clear();names.clear();waits.clear();arrived.clear();
  members=[];prior=[];candidates=[];hostId='';key=null;isHost=false;phase='idle';
  if(room){room=null;emit(ROOM_LEFT);}
  publish();
 }
 // Host side: guests in join order; after a handoff the previous list's order wins and newcomers go last.
 function addMember(id){
  arrived.set(id,seq++);members.push(id);
  const rank=m=>prior.includes(m)?prior.indexOf(m):prior.length+arrived.get(m);
  members.sort((a,b)=>rank(a)-rank(b));dirty=true;publish();
 }
 function sendInfo(conn){
  const info={type:'info',count:1+members.length,capacity:net.capacity};
  for(let i=0;i<3;i++)conn.send(info);setTimeout(()=>conn.close(),1000);
 }
 function attach(conn,owner){
  if(connections.has(conn.peer)){conn.close();return;}
  connections.set(conn.peer,conn);
  const timeout=setTimeout(()=>{
   // Not open in time, or (host) never said who it is.
   if(connections.get(conn.peer)===conn&&(!conn.open||isHost&&!members.includes(conn.peer))){conn.close();closed();}
  },net.connectTimeoutSeconds*1000);
  // B-H-1: the host answers `room` the moment a caller's channel opens. That answer lets it in (room-keys.js), and
  // it must not wait for the draw loop, which a hidden tab stops.
  conn.on('open',()=>{if(!live(owner))return;dirty=true;if(isHost&&room)conn.send({type:'room',roundStart:room.roundStart});});
  // A host that died without closing: ICE notices it long before the data channel does. T26 R-1: `disconnected` is
  // also a short network hiccup that recovers, so cut only if it is still not back after the grace time.
  let lost=null;
  conn.on('iceStateChanged',s=>{
   clearTimeout(lost);
   if(s==='disconnected')lost=setTimeout(()=>{if(live(owner)&&!isHost&&conn.peer===hostId&&connections.get(conn.peer)===conn)cut();},net.hostLostGraceSeconds*1000);
  });
  conn.on('data',data=>{
   if(!live(owner)||connections.get(conn.peer)!==conn||!data||typeof data!=='object')return;
   if(isHost){
    if(!members.includes(conn.peer)){
     // The first message tells who is calling: the ops screen gets {count, capacity} and is never a guest.
     if(data.type==='hello'&&data.role==='ops'){connections.delete(conn.peer);clearTimeout(timeout);sendInfo(conn);return;}
     if(data.type!=='pose'&&data.type!=='state')return;
     addMember(conn.peer);
    }
    if(data.type==='pose'&&validPose(data.pose))poses.set(conn.peer,data.pose);
    else if(data.type==='state'){
     const s=cleanState(data.state);if(!s)return;
     if(!names.has(conn.peer))names.set(conn.peer,uniqueNickname(s.nickname,new Set([mine.nickname,...names.values()])));
     s.nickname=names.get(conn.peer);
     if(setState(conn.peer,s))dirty=true;
    }
   }else if(conn.peer!==hostId)return;
   else if(data.type==='world'&&Array.isArray(data.players)&&data.players.length<=net.capacity){
    const ids=new Set();
    if(!data.players.every(e=>Array.isArray(e)&&e.length===2&&typeof e[0]==='string'&&e[0].length<=80&&!ids.has(e[0])&&ids.add(e[0])&&validPose(e[1])))return;
    display(data.players);
   }else if(data.type==='room'){
    const r=data.roundStart;
    if(!validShowtime(r,intervalMs,Date.now()))return;
    if(!room)joined(key,false,r);
    else if(r>room.roundStart){room.roundStart=r;emit(ROOM_ROUND,{roundStart:r});}
    if(phase!=='room'){phase='room';clearTimeout(handoffTimer);waits.delete(hostId);publish();}
   }else if(data.type==='members'){if(idList(data.members,net.capacity-1))members=[...data.members];}
   else if(data.type==='handoff'){if(room)cut();}  // valid `to` or not, the host is leaving: same path as a cut
   else if(data.type==='state'&&typeof data.peerId==='string'&&data.peerId.length<=80){
    const s=cleanState(data.state);if(!s)return;
    if(data.peerId===peer.id){if(mine.nickname!==s.nickname){mine.nickname=s.nickname;dirty=true;}}
    else setState(data.peerId,s);
   }else if(data.type==='full')leave();
  });
  function closed(){
   clearTimeout(timeout);if(!live(owner)||connections.get(conn.peer)!==conn)return;
   connections.delete(conn.peer);
   if(isHost){remove(conn.peer);const i=members.indexOf(conn.peer);if(i>=0){members.splice(i,1);dirty=true;}publish();}
   else if(conn.peer===hostId){if(!room)leave();else if(phase==='handoff')nextCandidate();else cut();}
  }
  conn.on('close',closed);conn.on('error',()=>{conn.close();closed();});
 }
 function connectTo(id){const conn=peer.connect(id,{reliable:false,serialization:'json'});guardData(conn);attach(conn,peer);}
 function dropHostConnection(){const c=connections.get(hostId);connections.delete(hostId);c?.close();remove(hostId);waits.delete(hostId);}
 // Guest: the host is gone (handoff message, closed channel, dead ICE). The first in the last members list takes over.
 function cut(){
  phase='handoff';
  candidates=[...members];dropHostConnection();publish();nextCandidate();
 }
 function nextCandidate(){
  clearTimeout(handoffTimer);dropHostConnection();
  const id=candidates.shift();
  if(id===undefined||id===peer.id){becomeHost();return;}
  hostId=id;
  handoffTimer=setTimeout(nextCandidate,net.handoffTimeoutSeconds*1000);
  waits.set(id,nextCandidate);connectTo(id);
 }
 function becomeHost(){
  clearTimeout(handoffTimer);dropHostConnection();hostId='';
  prior=members.filter(id=>id!==peer.id);members=[];
  isHost=true;room.host=true;phase='room';dirty=true;
  for(const id of avatars.keys())remove(id);
  publish();claim(key);
  if(screenEnded)roundEnded();  // a guest left waiting on an ended round moves the room on as its new host
 }
 // New host: take the room key id back on a second Peer. search=true walks to the next number (minimal free-key
 // search; T15 can swap it for room-keys.js).
 function claim(k,search=false){
  clearTimeout(claimTimer);const owner=peer;
  const p=new window.Peer(keyId(k),peerOptions);keyPeer=p;
  p.on('open',()=>{if(keyPeer!==p)return;if(key!==k){key=k;room.code=k;}publish();});
  p.on('connection',conn=>incoming(conn,p));
  p.on('error',e=>{
   if(keyPeer!==p)return;keyPeer=null;p.destroy();if(peer!==owner)return;
   if(e.type!=='unavailable-id')claimTimer=setTimeout(()=>claim(k,search),RETRY_MS);
   else if(search)claimTimer=setTimeout(()=>claim(+k<net.maxRooms?pad(+k+1):key,+k<net.maxRooms),+k<net.maxRooms?0:RETRY_MS);
   else probe(k);
  });
  p.on('disconnected',()=>{if(keyPeer!==p)return;keyPeer=null;p.destroy();if(peer===owner)claimTimer=setTimeout(()=>claim(key),RETRY_MS);});
 }
 // Who holds the key id? A live room answers hello (info or full): another room took the number, so move to a free
 // key. No answer: the cut host's id is not released yet, so try the same key again.
 function probe(k){
  const owner=peer,id=keyId(k),conn=owner.connect(id,{reliable:false,serialization:'json'});guardData(conn);
  let done=false,ping=null;
  const finish=(taken,delay=RETRY_MS)=>{
   if(done)return;done=true;clearInterval(ping);clearTimeout(limit);if(waits.get(id)===free)waits.delete(id);conn.close();
   if(peer===owner&&isHost)claimTimer=setTimeout(()=>taken?claim(pad(1),true):claim(k),taken?0:delay);
  };
  const free=()=>finish(false,0),limit=setTimeout(()=>finish(false),net.connectTimeoutSeconds*1000);
  waits.set(id,free);
  conn.on('open',()=>{const hello=()=>conn.open&&conn.send({type:'hello',role:'ops'});hello();ping=setInterval(hello,1000);});
  conn.on('data',d=>{if(d&&(d.type==='info'||d.type==='full'))finish(true);});
  conn.on('close',()=>finish(false));conn.on('error',()=>finish(false));
 }
 // Over capacity: open the channel only to say so, then close (reliable:false, so say it three times).
 function refuse(conn){
  conn.on('open',()=>{for(let i=0;i<3;i++)conn.send({type:'full'});setTimeout(()=>conn.close(),1000);});
 }
 function incoming(conn,owner){
  guardData(conn);
  if(!live(owner)){conn.close();return;}
  // Someone from my room calls me before I noticed the host is gone: I am the new host. T26 R-1: but while my own
  // link to the host is still open the host is alive, so only park the caller; my own cut() makes me host if it dies.
  if(!isHost){
   if(!room||!members.includes(conn.peer)){conn.close();return;}
   if(phase==='handoff'||!connections.get(hostId)?.open)becomeHost();
  }
  if(connections.size>=net.capacity-1){refuse(conn);return;}
  attach(conn,owner);
 }
 function adopt(owner){
  peer=owner;
  owner.on('connection',conn=>incoming(conn,owner));
  owner.on('error',error=>{
   if(peer!==owner)return;
   if(error.type==='peer-unavailable'){const id=String(error.message).split(' ').pop(),w=waits.get(id);if(w){waits.delete(id);w();}return;}
   leave();
  });
  owner.on('disconnected',()=>{if(peer===owner)leave();});
 }
 // k=null: auto placement (room-keys.js findRoom, 01 up, only rooms of the chosen showtime). k=room key: that room only
 // (joinRoom; free number → its host). A full named room goes on to auto placement (ui/invite.js tells the user).
 // Every failure ends in phase 'idle' (architecture 자동 배치): no screen text here.
 async function start(k){
  if(k!==null&&!parseRoomKey(k,net))return;
  if(typeof window.Peer!=='function'){console.warn('multiplayer: PeerJS not loaded');leave();return;}
  leave();const my=++attempt;phase='connecting';publish();
  const options={...net,roomKeyPrefix:prefix(),showtime,createPeer},r=k?await joinRoom({...options,key:k}):await findRoom(options);
  if(my!==attempt){r.conn?.close();r.peer?.destroy();return;}  // left (or started again) while searching
  if(r.status==='joined'&&!validShowtime(r.roundStart,intervalMs,Date.now())){r.conn.close();r.peer.destroy();leave();return;}
  if(r.status==='host'){
   // A new room's showtime is the chosen one (invite: the link's t); none chosen → the round just started.
   adopt(r.peer);isHost=true;key=r.key;joined(r.key,true,showtime??currentRound());publish();
  }else if(r.status==='joined'){
   adopt(r.peer);key=r.key;hostId=keyId(r.key);guardData(r.conn);attach(r.conn,r.peer);
   phase='room';dirty=true;joined(r.key,false,r.roundStart);publish();
  }else if(r.status==='full'&&k)start(null);
  else{if(r.status!=='full')console.warn('multiplayer: no room',r.status,r.reason??'',r.key??'');leave();}
 }
 const writable=conn=>conn?.open&&conn.dataChannel?.bufferedAmount<65536;
 const guests=()=>members.map(id=>connections.get(id)).filter(writable);
 // state, room and members ride reliable:false, so they go out on every change and again every second.
 function sendStates(now){
  if(!dirty&&now-lastResend<1000)return;dirty=false;lastResend=now;
  if(isHost){
   const all=[[peer.id,{...mine}],...states.entries()];
   // A caller that has not said who it is yet gets the room's round: that answer is what lets it in (room-keys.js).
   for(const [id,conn] of connections)if(!members.includes(id)&&writable(conn))conn.send({type:'room',roundStart:room.roundStart});
   for(const conn of guests()){
    conn.send({type:'room',roundStart:room.roundStart});
    conn.send({type:'members',members});
    for(const [peerId,state] of all)conn.send({type:'state',peerId,state});
   }
  }else{const conn=connections.get(hostId);if(writable(conn))conn.send({type:'state',state:{...mine}});}
 }
 // app:enter {broadcastId, showtime, roomKey} starts placement once: the invite key if there is one, else auto placement.
 bus.addEventListener(APP_ENTER,e=>{
  if(entered)return;entered=true;
  const d=e.detail??{};broadcast=String(d.broadcastId??'');showtime=Number.isSafeInteger(d.showtime)?d.showtime:null;
  start(parseRoomKey(d.roomKey,net));
 });
 // join(): auto placement again; join(key): that room. Nothing before app:enter (no signaling, no STUN).
 function join(k=null){if(!entered||k!==null&&!parseRoomKey(k,net))return;start(k);}
 // Closing the tab as host: name the next host three times, then let the key id go.
 window.addEventListener('pagehide',()=>{
  if(isHost&&members.length){const m={type:'handoff',to:members[0]};for(const conn of guests())for(let i=0;i<3;i++)conn.send(m);}
  leave();
 });
 // B-H-1: a hidden tab stops requestAnimationFrame, so the network beat also runs on a timer (update() throttles itself).
 setInterval(()=>tick(performance.now()),250);
 function tick(now){
  if(!peer?.open)return;
  if(room&&(isHost||phase==='room'))sendStates(now);
  if(now-lastSend<100)return;lastSend=now;
  const pose=getPose();if(!validPose(pose))return;
  if(isHost){
   const players=[[peer.id,pose],...poses.entries()];display(players);
   for(const conn of guests())conn.send({type:'world',players});
  }else{
   const conn=connections.get(hostId);if(writable(conn))conn.send({type:'pose',pose});
  }
 }
 return {join,leave:()=>leave(),get count(){return avatars.size+1;},get positions(){return [...avatars.values()].map(a=>a.position.toArray());},get connected(){return !!peer?.open;},
  get room(){return room&&{...room};},get roomState(){return lastState?{...lastState}:{key:null,count:1,host:false,phase:'idle'};},get nickname(){return mine.nickname;},get peerId(){return peer?.id??null;},get members(){return [...members];},
  get peers(){return [...states].map(([peerId,s])=>({peerId,...s}));},avatarOf(id){return avatars.get(id)??null;},
  update:tick};
}
