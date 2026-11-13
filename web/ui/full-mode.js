import {INPUT_ACTION,FULLMODE_ENTER,FULLMODE_EXIT,SEAT_ENTER,SEAT_EXIT,SCREEN_STATE} from '../events.js';
import {waitText,waitLeft} from './hud.js';

// BL-0020: watch the arena's YouTube player over this screen only. The player, fullscreen and fallback belong to screen-video.js;
// this module owns the open/close buttons, the F/Esc/close inputs, walking input off/on, and the showtime wait text in the bar.
// T31 (docs/live/product/ux/full-mode.md, docs/live/graphicmodel/ui/full-mode.md): the open button lives in #dock and shows from the
// moment of sitting; leaving Full Mode returns to the state it was entered from.
export function create(ctx){
 const {events,input,uiRoot}=ctx,screen=window.arena?.screen,controls=ctx.config('controls');
 if(!screen)return {};
 let resume=false,seated=false;
 // F-D1: Full Mode is for watching only; scene actions are swallowed before input.js (document listeners) sees them.
 // Arrow keys stay free for the volume slider; walking-only keys (jump, run) are already off because Full Mode turns walking input off.
 const blocked=new Set(['sit','emoteMenu','forward','backward','left','right'].flatMap(action=>controls[action]||[]).filter(code=>!code.startsWith('Arrow')));
 const style=document.createElement('style');
 style.textContent=`
  #ui-root>#full-mode-open{position:fixed;right:24px;top:76px}
  #full-mode-open kbd,#full-mode-close kbd{margin:0 0 0 var(--space-1,4px);background:transparent;color:inherit;border-color:currentColor}
  #full-mode-open[data-seated],#arena-screen-controls #full-mode-close{background:var(--color-accent,#7fdcff);color:var(--color-text-on-accent,#082338);border-color:var(--color-accent,#7fdcff);font-weight:var(--font-weight-bold,700)}
  #full-mode-open[data-seated]:hover,#arena-screen-controls #full-mode-close:hover{border-color:var(--color-text,#edf6ff)}
  body.touch #full-mode-open kbd,body.touch #full-mode-close kbd{display:none}
  @media(max-width:650px){#ui-root>#full-mode-open{right:16px;top:142px}}
  #full-mode-wait{flex:none;font-weight:var(--font-weight-bold,700);font-variant-numeric:tabular-nums;white-space:nowrap}
  @media(max-width:800px){#full-mode-wait{flex-basis:100%;order:0}}`;
 const keycap=text=>{const kbd=document.createElement('kbd');kbd.textContent=text;return kbd;};
 const open=document.createElement('button');open.type='button';open.id='full-mode-open';open.title='스크린 영상 크게 보기 (F)';
 open.append('Full Mode'); // no keycap on dock buttons: F is in the #hud-keys box
 const state=document.createElement('span');state.dataset.fullState='';state.textContent='Full Mode';state.hidden=true;
 const close=document.createElement('button');close.type='button';close.id='full-mode-close';close.hidden=true;
 close.setAttribute('aria-label','Full Mode 닫기 (Esc)');close.append('Full Mode 닫기',keycap('Esc'));
 uiRoot.append(style);(document.querySelector('#dock')||uiRoot).append(open);
 // D2: while the showtime has not come, Full Mode shows the remaining time as one line in its own bar, left of the sound button.
 const wait=document.createElement('span');wait.id='full-mode-wait';wait.setAttribute('role','status');wait.hidden=true;
 screen.controlsElement.prepend(wait);
 screen.controlsElement.append(state,close); // close stays the bar's last button
 let waitTimer=0;
 function showWait(){
  const left=screen.fullMode?waitLeft(screen):null;
  wait.hidden=left===null;wait.textContent=left===null?'':waitText(left);
  if(left===null){clearInterval(waitTimer);waitTimer=0;}else if(!waitTimer)waitTimer=setInterval(showWait,1000);
 }
 function enter(){
  if(screen.fullMode)return;
  resume=input.walking&&!seated; // F-D3: a seat returns to the seated view with the cursor
  screen.enterFullMode(); // inside the click/key gesture so requestFullscreen is allowed
  if(input.walking)input.releasePointer();
 }
 const exit=()=>screen.exitFullMode();
 const entered=()=>{close.hidden=state.hidden=false;showWait();close.focus();};
 // Every exit path (close, F, Esc, browser fullscreenchange) arrives here through screen-video.js.
 const exited=()=>{close.hidden=state.hidden=true;showWait();if(resume){resume=false;input.capturePointer();}else requestAnimationFrame(()=>open.focus());}; // screen-video un-hides overlapped DOM on its next render
 const action=e=>{if(e.detail.action==='fullMode'&&e.detail.down)screen.fullMode?exit():enter();};
 const key=e=>{if(screen.fullMode&&e.key==='Escape'){e.preventDefault();exit();}};
 const block=e=>{if(screen.fullMode&&blocked.has(e.code)){e.preventDefault();e.stopImmediatePropagation();}};
 const sit=()=>{seated=true;open.toggleAttribute('data-seated',true);},stand=()=>{seated=false;open.removeAttribute('data-seated');};
 open.addEventListener('click',enter);close.addEventListener('click',exit);
 events.addEventListener(INPUT_ACTION,action);events.addEventListener(FULLMODE_ENTER,entered);events.addEventListener(FULLMODE_EXIT,exited);
 events.addEventListener(SEAT_ENTER,sit);events.addEventListener(SEAT_EXIT,stand);events.addEventListener(SCREEN_STATE,showWait);
 document.addEventListener('keydown',key);window.addEventListener('keydown',block,true);window.addEventListener('keyup',block,true);
 return {
  dispose(){
   resume=false;if(screen.fullMode)exit();
   open.removeEventListener('click',enter);close.removeEventListener('click',exit);
   events.removeEventListener(INPUT_ACTION,action);events.removeEventListener(FULLMODE_ENTER,entered);events.removeEventListener(FULLMODE_EXIT,exited);
   events.removeEventListener(SEAT_ENTER,sit);events.removeEventListener(SEAT_EXIT,stand);events.removeEventListener(SCREEN_STATE,showWait);clearInterval(waitTimer);wait.remove();
   document.removeEventListener('keydown',key);window.removeEventListener('keydown',block,true);window.removeEventListener('keyup',block,true);open.remove();close.remove();state.remove();style.remove();
  },
 };
}
