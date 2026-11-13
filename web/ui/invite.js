import {APP_ENTER,ROOM_JOINED,ROOM_STATE,HUD_TOAST} from '../events.js';

// '같이 보기' in the settings group (#network): one button, one result line, the people-count line.
// Flow and wording: docs/live/product/ux/room-invite.md 6절 (verbatim). Look: docs/live/graphicmodel/ui/room-invite.md.
// The entry notice and the invited line belong to the first page (ui/loading.js, index.html). Connections stay in
// multiplayer.js; this module only reads room:state / room:joined and calls multiplayer.join().
const TEXT={
 button:'같이 보기',label:'같이 보기 — 초대 링크 복사',
 copied:'복사됐어요. 친구에게 보내면 같은 방으로 들어와요',
 copyFailed:'이 링크를 친구에게 보내세요: ',
 offline:'지금은 같이 보기에 연결되지 않아요. 잠시 뒤 다시 눌러 주세요',
 count:n=>`${n}명 같이 보는 중`,arrived:n=>`${n}명이 들어왔어요`,
 inviteFull:'친구 방이 가득 차서 다른 방으로 들어왔어요',
};
const NOTE_MS=6000,TOAST_MS=3000;

export function create(ctx){
 const mp=ctx.multiplayer,net=ctx.config('network'),events=ctx.events;
 const panel=document.querySelector('#network'),status=document.querySelector('#network-status');
 const button=document.createElement('button');
 Object.assign(button,{id:'watch-together',type:'button',textContent:TEXT.button});button.setAttribute('aria-label',TEXT.label);
 const note=document.createElement('p');note.id='watch-together-note';note.setAttribute('role','status');note.hidden=true;
 panel.append(button,note);
 status.setAttribute('role','status');

 let entry=null,last=null,handoffAt=-Infinity,noteTimer=null,firstJoin=true;
 const toast=(text,ms=TOAST_MS)=>events.dispatchEvent(new CustomEvent(HUD_TOAST,{detail:{text,tone:'info',ms}}));
 function say(parts,tone='info',ms=NOTE_MS){
  clearTimeout(noteTimer);note.replaceChildren(...parts);note.dataset.tone=tone;note.hidden=false;
  if(ms)noteTimer=setTimeout(clear,ms);
 }
 function clear(){clearTimeout(noteTimer);note.replaceChildren();note.hidden=true;}

 // Invite URL ?b=<broadcast>&t=<showtime>&room=<key>. t is the room's roundStart, left out when no showtime was chosen
 // (live). With no room yet the link still names the broadcast (and showtime).
 function inviteUrl(){
  const room=mp.room,url=new URL(location.pathname,location.origin);
  if(entry?.broadcastId)url.searchParams.set('b',entry.broadcastId);
  const t=room?room.roundStart:entry?.showtime;
  if(entry?.showtime!=null&&Number.isSafeInteger(t))url.searchParams.set('t',String(t));
  if(room)url.searchParams.set('room',room.code);
  return url.href;
 }
 async function copy(href){try{await navigator.clipboard.writeText(href);return true;}catch{return false;}}
 const touch=()=>typeof navigator.share==='function'&&matchMedia('(pointer: coarse)').matches;

 // RW-H-1: still finding a room (phase connecting) → wait until it is settled (a room, or idle), then copy the link
 // with room. A link copied before that would send the friend to a different room. Clicks while waiting are ignored.
 let wait=null;
 function settled(){
  return new Promise(resolve=>{
   const on=({detail:s})=>{if(!mp.room&&s?.phase!=='idle')return;events.removeEventListener(ROOM_STATE,on);wait=null;resolve();};
   wait=on;events.addEventListener(ROOM_STATE,on);
  });
 }
 async function onClick(){
  if(wait)return;
  if(!mp.room&&mp.roomState?.phase!=='idle'){
   button.setAttribute('aria-busy','true');await settled();button.removeAttribute('aria-busy');
  }
  const href=inviteUrl();
  if(!mp.room){
   // Not in a room (UX-M11): still copy, say so, and try placement once more when idle.
   if(mp.roomState?.phase==='idle')mp.join();
   await copy(href);say([TEXT.offline],'warning');return;
  }
  if(touch()){try{await navigator.share({url:href});}catch{}say([TEXT.copied]);return;}
  if(await copy(href)){say([TEXT.copied]);return;}
  const link=document.createElement('span');link.dataset.link='';link.textContent=href;link.tabIndex=0;link.style.userSelect='all';
  link.onclick=link.onfocus=()=>getSelection()?.selectAllChildren(link);
  say([TEXT.copyFailed,link],'info',0);  // stays until the next click elsewhere or on the button
 }
 button.addEventListener('click',onClick);
 // The copy-failed link stays until a click elsewhere (UI 명세); the button click itself replaces it.
 const away=e=>{if(note.querySelector('[data-link]')&&!button.contains(e.target)&&!note.contains(e.target))clear();};
 document.addEventListener('pointerdown',away);

 // room:state {key, count, host, phase} → only the people line: "N명 같이 보는 중" at 2+, otherwise empty and hidden.
 function show(){
  const n=last?.key&&last.count>=2?last.count:0;
  status.textContent=n?TEXT.count(n):'';status.hidden=!n;
 }
 function onState({detail:s}){
  const prev=last;last=s;
  if(s?.phase==='handoff')handoffAt=performance.now();
  // Someone arrived (not the first world update of a guest, not guests coming back after a handoff).
  const settled=performance.now()-handoffAt>net.handoffTimeoutSeconds*1000;
  if(prev&&s&&prev.key&&prev.key===s.key&&settled&&s.count>prev.count&&(prev.phase==='solo'||prev.count>1))toast(TEXT.arrived(s.count-prev.count));
  show();
 }
 // A named room (invite) that was full: multiplayer.js went on to auto placement, so the joined key differs.
 function onJoined({detail}){
  if(firstJoin&&entry?.roomKey&&detail?.code!==entry.roomKey)toast(TEXT.inviteFull);
  firstJoin=false;
 }
 const onEnter=e=>{entry=e.detail??{};};
 events.addEventListener(APP_ENTER,onEnter);events.addEventListener(ROOM_STATE,onState);events.addEventListener(ROOM_JOINED,onJoined);
 show();
 return {
  dispose(){
   events.removeEventListener(APP_ENTER,onEnter);events.removeEventListener(ROOM_STATE,onState);events.removeEventListener(ROOM_JOINED,onJoined);
   document.removeEventListener('pointerdown',away);clearTimeout(noteTimer);if(wait)events.removeEventListener(ROOM_STATE,wait);
   button.remove();note.remove();status.textContent='';status.hidden=true;
  },
 };
}
