import {APP_ENTER,HUD_TOAST,SEAT_ENTER,SEAT_EXIT,FULLMODE_ENTER,FULLMODE_EXIT,SCREEN_STATE} from '../events.js';

// Toast times and count: docs/live/graphicmodel/ui/hud-controls.md 「알림(공용 정본)」 (toast-ms is not in tokens.md yet).
const TOAST_MS=2500,TOAST_MAX=2;

// Showtime wait line (UX entry-loading 6절): over a minute → minutes rounded up, under a minute → seconds.
export const waitText=ms=>{
 const s=Math.max(1,Math.ceil(ms/1000));
 return s>60?`${Math.ceil(s/60)}분 뒤 시작해요`:`${s}초 뒤 시작해요`;
};
// Milliseconds until the room's showtime (window.arena.screen.roundStart), or null when not waiting.
export const waitLeft=screen=>screen?.state?.status==='waiting'&&Number.isFinite(screen.roundStart)?screen.roundStart-Date.now():null;

export function create({events,config}){
 const hud=document.querySelector('#hud'),toasts=document.querySelector('#hud-toast'),wait=document.querySelector('#showtime-wait');
 const timers=new Set(),listeners=new AbortController(),options={signal:listeners.signal};
 let entered=false,seated=false,full=false,state='entry',waitTimer=0;
 const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);fn();},ms);timers.add(id);};

 // data-state: entry until app:enter, then full > seated > walking. There is no `free` (nothing locks the pointer).
 function update(){
  const next=!entered?'entry':full?'full':seated?'seated':'walking';
  if(next===state)return;
  state=next;hud.dataset.state=next;document.body.dataset.hud=next;
  if(next==='full')toasts.replaceChildren();
 }
 // #showtime-wait follows screen:state's `waiting`; it is one line, no window, and walking goes on underneath.
 function showWait(){
  const left=waitLeft(window.arena?.screen);
  if(left===null){wait.hidden=true;wait.textContent='';clearInterval(waitTimer);waitTimer=0;return;}
  wait.textContent=waitText(left);wait.hidden=false;
  if(!waitTimer)waitTimer=setInterval(showWait,1000);
 }
 const on=(name,fn)=>events.addEventListener(name,fn,options);
 on(APP_ENTER,()=>{entered=true;update();showWait();});
 on(SEAT_ENTER,()=>{seated=true;update();});
 on(SEAT_EXIT,()=>{seated=false;update();});
 on(FULLMODE_ENTER,()=>{full=true;update();});
 on(FULLMODE_EXIT,()=>{full=false;update();});
 on(SCREEN_STATE,()=>{if(entered)showWait();});
 on(HUD_TOAST,({detail={}})=>{
  if(state==='full'||state==='entry')return;
  const item=document.createElement('div');
  item.dataset.tone=detail.tone==='warning'?'warning':'info';
  item.textContent=(item.dataset.tone==='warning'?'⚠ ':'')+String(detail.text??'');
  toasts.append(item);
  while(toasts.children.length>TOAST_MAX)toasts.firstElementChild.remove();
  later(()=>item.remove(),Number(detail.ms)>0?Number(detail.ms):TOAST_MS);
 });
 // Key hint press feedback: light the keycap whose label matches the pressed key's bound action.
 const controls=config('controls'),caps=[...hud.querySelectorAll('kbd')];
 const capFor=code=>{
  const name=code.startsWith('Key')?code.slice(3):code==='Space'?'Space':code.startsWith('Shift')?'Shift':code.startsWith('Control')?'Ctrl':null;
  const move=['forward','backward','left','right'].some(action=>controls[action]?.includes(code));
  return caps.filter(cap=>cap.textContent===name||move&&cap.textContent==='WASD');
 };
 document.addEventListener('keydown',e=>{for(const cap of capFor(e.code))cap.classList.add('on');},options);
 document.addEventListener('keyup',e=>{for(const cap of capFor(e.code))cap.classList.remove('on');},options);

 // T67: seated, #dock is one big bar under the screen — [F Full Mode] [E / Esc 일어나기] [Ctrl 감정표현] [볼륨] (ui hud-controls.md).
 // The volume slider is a second view of screen-video.js's volume: it reads state.userVolume and writes through setVolume.
 const dock=document.querySelector('#dock'),volume=document.createElement('label');
 volume.id='seat-volume';volume.innerHTML='<span>볼륨</span><input type="range" min="0" max="100" aria-label="영상 음량">';
 const slider=volume.querySelector('input');
 slider.addEventListener('input',()=>window.arena?.screen?.setVolume(slider.value),options);
 const syncVolume=v=>{if(Number.isFinite(v)&&Number(slider.value)!==v)slider.value=v;};
 on(SCREEN_STATE,({detail})=>syncVolume(detail?.userVolume));
 dock?.append(volume);
 // Place the bar just under the projected screen, centred on it; when it does not fit there it stays at the bottom centre (CSS).
 // screen-video.js keepClear still moves or hides #dock if it ever meets the video (LG-H-4).
 let frame=0;
 function place(){
  frame=requestAnimationFrame(place);
  const r=window.arena?.screen?.element?.getBoundingClientRect(),gap=8,edge=parseFloat(getComputedStyle(dock).bottom)||0;
  const w=dock.offsetWidth,h=dock.offsetHeight,top=r?Math.round(r.bottom+gap):0;
  const under=r&&r.width>0&&r.bottom>0&&top+h<=innerHeight-edge;
  const x=under?Math.round(Math.min(Math.max((r.left+r.right)/2,w/2+gap),innerWidth-w/2-gap)):null;
  if(under){if(dock.dataset.place!=='under')dock.dataset.place='under';dock.style.setProperty('--bar-top',`${top}px`);dock.style.setProperty('--bar-x',`${x}px`);}
  else if(dock.dataset.place){delete dock.dataset.place;dock.style.removeProperty('--bar-top');dock.style.removeProperty('--bar-x');}
 }
 const placing=()=>{
  if(state==='seated'&&dock){syncVolume(window.arena?.screen?.state?.userVolume);if(!frame)place();return;}
  cancelAnimationFrame(frame);frame=0;
  if(dock){delete dock.dataset.place;dock.style.removeProperty('--bar-top');dock.style.removeProperty('--bar-x');}
 };
 for(const name of [SEAT_ENTER,SEAT_EXIT,FULLMODE_ENTER,FULLMODE_EXIT])on(name,placing);
 // Seated Esc stands up (seat-mode.js). With the emote menu open, Esc closes only the menu (T67 memo 1); with focus on the bar's
 // slider, seat-mode skips inputs, so stand up here. Full Mode keeps its own Esc (full-mode.js, before seat-mode's stand).
 window.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||e.repeat||!seated||full)return;
  const menu=document.querySelector('#emote-menu:not([hidden])');
  if(menu){e.stopImmediatePropagation();menu.querySelector('.close')?.click();}
  else if(e.target===slider)document.querySelector('#seat-toggle')?.click();
 },{capture:true,signal:listeners.signal});
 update();
 return {update,dispose(){listeners.abort();cancelAnimationFrame(frame);volume.remove();for(const id of timers)clearTimeout(id);timers.clear();clearInterval(waitTimer);toasts.replaceChildren();wait.hidden=true;}};
}
