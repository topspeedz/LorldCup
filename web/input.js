import {APP_ENTER,INPUT_ACTION} from './events.js';

export function createInput({canvas,events,controls,isReady,onLook,onJump,onClick}){
 const keys=new Set(),listeners=new AbortController(),options={signal:listeners.signal},touchAction=canvas.style.touchAction;
 canvas.style.touchAction='none';
 let entered=false,walking=false,drag=null;
 const typing=target=>(target instanceof HTMLElement&&target.matches('input,textarea'))||document.activeElement?.matches('input,textarea');
 const bound=(action,code)=>controls[action].includes(code);
 const down=action=>!typing(document.activeElement)&&controls[action].some(code=>keys.has(code));
 // Only leaving walk mode drops held keys: a click while walking must not stop a run (Windows repeats only the last key).
 function walkMode(value){walking=value;document.body.classList.toggle('walking',value);if(!value)keys.clear();}
 function endDrag(){drag=null;}
 function releasePointer(){endDrag();walkMode(false);}
 function capturePointer(){
  if(!entered||!isReady())return;
  walkMode(true);
 }
 events.addEventListener(APP_ENTER,()=>{entered=true;capturePointer();},options);
 canvas.addEventListener('pointerdown',e=>{
  if(!walking||!isReady()||e.button!==0||drag)return;
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,turned:false};
  try{canvas.setPointerCapture(e.pointerId);}catch{} // Synthetic events have no active pointer to capture.
 },options);
 canvas.addEventListener('contextmenu',e=>e.preventDefault(),options);
 document.addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const click=!drag.turned&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<=4;
  endDrag();if(click)onClick?.(e.clientX,e.clientY);
 },options);
 document.addEventListener('pointercancel',endDrag,options);
 canvas.addEventListener('lostpointercapture',endDrag,options);
 document.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  if(!(e.buttons&1)){endDrag();return;}
  if(!drag.turned&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<=4)return;
  drag.turned=true;onLook(e.clientX-drag.lastX,e.clientY-drag.lastY);
  drag.lastX=e.clientX;drag.lastY=e.clientY;
 },options);
 document.addEventListener('keydown',e=>{
  if(!entered||typing(e.target))return;
  if(bound('jump',e.code)&&walking){e.preventDefault();if(isReady()&&!e.repeat)onJump();}
  if(walking&&['forward','backward','left','right','run'].some(action=>bound(action,e.code))){e.preventDefault();keys.add(e.code);}
  for(const action of ['emoteMenu','sit','fullMode']){
   if(bound(action,e.code)){e.preventDefault();if(!e.repeat)events.dispatchEvent(new CustomEvent(INPUT_ACTION,{detail:{action,down:true}}));}
  }
 },options);
 document.addEventListener('keyup',e=>{
  keys.delete(e.code);
  if(!entered||typing(e.target))return;
  for(const action of ['emoteMenu','sit','fullMode']){
   if(bound(action,e.code)){e.preventDefault();events.dispatchEvent(new CustomEvent(INPUT_ACTION,{detail:{action,down:false}}));}
  }
 },options);
 document.addEventListener('focusin',e=>{if(typing(e.target))keys.clear();},options);
 window.addEventListener('blur',()=>{keys.clear();endDrag();},options);
 if(matchMedia('(pointer:coarse)').matches)document.body.classList.add('touch');
 document.querySelectorAll('[data-key]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{if(!entered||!isReady())return;e.preventDefault();capturePointer();keys.add(b.dataset.key);b.setPointerCapture(e.pointerId);},options);
  const release=()=>keys.delete(b.dataset.key);
  b.addEventListener('pointerup',release,options);b.addEventListener('pointercancel',release,options);
 });
 return {keys,down,get walking(){return walking;},releasePointer,capturePointer,dispose(){listeners.abort();keys.clear();endDrag();canvas.style.touchAction=touchAction;}};
}
