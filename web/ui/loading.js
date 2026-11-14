// BL-0035 first page and BL-0034 entry (docs/live/product/ux/entry-loading.md, docs/live/graphicmodel/ui/entry-loading.md).
// Owns the chosen broadcast and showtime; sends app:enter once after the #enter click, app:ready and character loading.
// Nothing chosen here goes to browser storage (legal T62).
import {events,APP_READY,APP_ENTER} from '../events.js';
import {scheduledSource,upcomingRounds} from '../screen-video.js';
import {parseInvite} from '../room-keys.js';

const SHOWTIME_COUNT=3; // UI D1: three next round boundaries, after the one running cell (T88)
const cover=document.querySelector('#loading'),text=cover.querySelector('[role=status]'),bar=cover.querySelector('progress');
const panel=document.querySelector('#panel'),status=document.querySelector('#status'),enter=document.querySelector('#enter');
const broadcastsBox=document.querySelector('#broadcasts'),showtimesBox=document.querySelector('#showtimes'),showtimeRow=showtimesBox.querySelector('.row');
const title=document.querySelector('#panel-title');

let choice=null,clicked=false,entered=false,failed=false,tick=0,invite=null;
let characterSettled=false,characterWaiting=false;
const isReady=()=>!!window.arena?.ready&&(window.arena.character?.ready||characterSettled);
const query=new URLSearchParams(location.search),hasRoom=query.has('room')||query.has('t'); // t alone is an invite too (UX-M15)

let coverWatch=null;
function showCover(on){
 cover.hidden=!on;cover.setAttribute('aria-busy',String(on&&!failed));
 for(const el of document.body.children)if(el!==cover&&el.tagName!=='SCRIPT')el.inert=on; // nothing under the cover takes focus
}
// main.js writes progress and failure into #status; the cover shows it.
function sync(){
 const message=status.textContent;
 if(message.startsWith('경기장을 불러오지 못했습니다')){fail();return;}
 text.textContent=message;
 const percent=message.match(/(\d+)%/);
 if(percent)bar.value=Number(percent[1]);
 else bar.removeAttribute('value'); // lighting stage has no byte count: indeterminate bar
}
// UX-E02: user words and a way out; main.js's developer hint (start.ps1) stays in the console only.
function fail(){
 if(failed)return;
 failed=true;coverWatch?.disconnect();clearInterval(tick);
 console.warn(status.textContent);
 panel.hidden=true;showCover(true);
 bar.hidden=true;
 cover.querySelector('h2').textContent='경기장을 불러오지 못했습니다';
 // shortcut: navigator.onLine is the only network signal here (main.js keeps the error), split fetch errors if main.js exposes them.
 text.textContent=navigator.onLine?'잠시 뒤 다시 시도하세요.':'인터넷 연결을 확인하고 다시 시도하세요.';
 const retry=document.createElement('button');
 retry.type='button';retry.className='retry';retry.textContent='다시 시도';
 retry.style.cssText='margin-top:var(--space-4);background:var(--color-accent);border-color:var(--color-accent);color:var(--color-text-on-accent);font-weight:var(--font-weight-bold);padding:var(--space-3) var(--space-5)';
 retry.addEventListener('click',()=>location.reload());
 cover.firstElementChild.append(retry);retry.focus();
}
coverWatch=new MutationObserver(sync);
coverWatch.observe(status,{childList:true,characterData:true,subtree:true});

function fire(){
 if(entered||failed)return;
 entered=true;showCover(false);panel.hidden=true;
 events.dispatchEvent(new CustomEvent(APP_ENTER,{detail:choice()}));
}
// Ready before the click: app:enter goes out inside the click handler, so sound can start on that gesture.
enter.addEventListener('click',()=>{
 if(clicked||failed)return;
 clicked=true;clearInterval(tick);
 if(isReady())fire();
 else{panel.hidden=true;showCover(true);}
});
const ready=()=>{
 if(!isReady()){
  if(characterWaiting)return;
  characterWaiting=true;
  const finish=()=>{
   if(characterSettled)return;
   characterSettled=true;clearTimeout(timer);ready();
  };
  const timer=setTimeout(()=>{
   console.warn('캐릭터 준비 시간이 초과되어 기본 캐릭터로 입장합니다.');
   finish();
  },30_000);
  window.arena.character.loaded.then(finish,finish);
  return;
 }
 if(clicked)fire();
 else if(invite&&!failed){showCover(false);panel.hidden=false;enter.focus();}
};
events.addEventListener(APP_READY,ready,{once:true});

const pad=n=>String(n).padStart(2,'0');
const clock=ms=>{const d=new Date(ms);return `${pad(d.getHours())}:${pad(d.getMinutes())}`;};

function firstPage(broadcasts,screen){
 let broadcastId=broadcasts[0].id,showtime=null,live=false;
 const cards=broadcasts.map(b=>{
  const card=document.createElement('button');
  card.type='button';card.dataset.broadcast=b.id;
  card.innerHTML='<span class="name"></span><span class="source"></span>';
  card.querySelector('.name').textContent=b.name;
  card.addEventListener('click',()=>{broadcastId=b.id;render();});
  broadcastsBox.append(card);return card;
 });
 const slots=Array.from({length:SHOWTIME_COUNT+1},()=>{
  const b=document.createElement('button');b.type='button';
  b.addEventListener('click',()=>{showtime=Number(b.dataset.showtime);render();});
  showtimeRow.append(b);return b;
 });
 // Re-run every second: a passed showtime drops out and the next boundary joins (UX E15); the cells never move.
 // T88: the first cell is the round that started last (상영 중); it is replaced once a round length (the interval) has passed.
 function render(){
  const now=Date.now();
  live=scheduledSource(now,screen)==='live';
  for(const card of cards){
   card.setAttribute('aria-pressed',String(card.dataset.broadcast===broadcastId));
   card.querySelector('.source').textContent=live?'생방송':'재방';
  }
  showtimesBox.hidden=live;
  if(live)return;
  const interval=screen.roundIntervalMinutes*60000,upcoming=upcomingRounds(now,screen.roundIntervalMinutes,SHOWTIME_COUNT);
  const times=[Math.floor(now/interval)*interval,...upcoming];
  if(!times.includes(showtime))showtime=upcoming[0];
  slots.forEach((b,i)=>{
   b.dataset.showtime=String(times[i]);b.textContent=clock(times[i]);
   b.setAttribute('aria-pressed',String(times[i]===showtime));
  });
 }
 render();tick=setInterval(render,1000);
 choice=()=>({broadcastId,showtime:live?null:showtime,roomKey:null});
 panel.hidden=false;enter.focus();
}

async function start(){
 if(hasRoom)showCover(true); // invite: cover first, then the short invite page once ready
 const load=name=>fetch(`./config/${name}.json`).then(r=>{if(!r.ok)throw new Error(`${name}.json ${r.status}`);return r.json();});
 const [{broadcasts},screen,network]=await Promise.all(['broadcasts','screen','network'].map(load));
 invite=parseInvite(location.search,{broadcastIds:broadcasts.map(b=>b.id),roundIntervalMinutes:screen.roundIntervalMinutes,
  roomKeyDigits:network.roomKeyDigits,maxRooms:network.maxRooms,nowMs:Date.now()});
 if(invite){
  const detail=invite;choice=()=>detail;
  panel.dataset.mode='invite';title.textContent='친구가 부른 방으로 들어가요';
  showCover(true);sync();
  if(window.arena?.ready)ready();
  return;
 }
 showCover(false);firstPage(broadcasts,screen);
 if(window.arena?.ready)ready();
}
start().catch(error=>{console.warn(error);status.textContent='경기장을 불러오지 못했습니다';});
