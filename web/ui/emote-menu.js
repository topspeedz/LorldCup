import {INPUT_ACTION,EMOTE_REQUEST,EMOTE_MENU_OPEN,SEAT_ENTER,SEAT_EXIT,FULLMODE_ENTER,FULLMODE_EXIT,HUD_TOAST} from '../events.js';

// BL-0009/BL-0031: Alt, the HUD "감정표현" button or the ticket's "응원하기" opens a 2x2 emote menu.
// Layout and strings: docs/live/graphicmodel/ui/emote-menu.md, docs/live/product/ux/emote-menu.md 6절.
// Seated, one column so it fits beside the screen player (coordinator msg_4beded3d8634, T31 slides it aside).
const emotes=[['cheer_clap','박수 환호','👏'],['heart','하트','💖'],['angry','화내기','😠'],['egg_throw','계란 던지기','🥚']];
const SEATED_TOAST_MS=1500;

export function create(ctx){
 const {events,input,uiRoot}=ctx;
 let resume=false,seated=false,full=false,opener=null;
 const style=document.createElement('style');
 style.textContent=`#emote-menu{position:fixed;z-index:var(--z-menu);left:50%;top:50%;transform:translate(-50%,-50%);display:grid;grid-template-columns:repeat(2,calc(var(--space-5)*4));gap:var(--space-2);padding:var(--space-5);background:rgb(7 18 29/var(--panel-alpha));border:var(--border-width) solid var(--color-border-subtle);border-radius:var(--radius-md);box-shadow:var(--shadow-panel);backdrop-filter:blur(var(--panel-blur));animation:emote-in var(--motion-base) var(--ease-out)}
#emote-menu[hidden]{display:none}
#emote-menu>.bar{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);margin-bottom:var(--space-1)}
#emote-menu h2{margin:0;font-size:var(--font-size-md);font-weight:var(--font-weight-bold)}
#emote-menu .hint{color:var(--color-text-muted);font-size:var(--font-size-xs);white-space:nowrap}
#emote-menu .close{display:none;min-height:var(--size-target-touch)}
body.touch #emote-menu .hint{display:none}body.touch #emote-menu .close{display:inline-block}
#emote-menu .emote{width:calc(var(--space-5)*4);height:calc(var(--space-5)*4);display:grid;place-content:center;gap:var(--space-1);padding:0;font-size:var(--font-size-sm)}
#emote-menu .emote span{font-size:var(--font-size-md);line-height:1}
body[data-hud=seated] #emote-menu{grid-template-columns:calc(var(--space-5)*5);padding:var(--space-3)}
body[data-hud=seated] #emote-menu>.bar{flex-wrap:wrap;gap:var(--space-1)}
body[data-hud=seated] #emote-menu .emote{width:auto;height:calc(var(--space-5)*3);grid-auto-flow:column;justify-content:start;gap:var(--space-2);padding:0 var(--space-3)}
#emote-open{display:inline-flex;align-items:center}#emote-open[aria-expanded=true]{background:var(--color-panel-hover);border-color:var(--color-accent)}
@keyframes emote-in{from{opacity:0}}`;
 const root=document.createElement('section');
 root.id='emote-menu';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-labelledby','emote-menu-title');
 root.innerHTML='<div class="bar"><h2 id="emote-menu-title">감정표현</h2><span class="hint"><kbd>Alt</kbd>·<kbd>Esc</kbd> 닫기</span><button type="button" class="close">닫기</button></div>';
 root.querySelector('.close').addEventListener('click',()=>close(false));
 const buttons=emotes.map(([id,label,icon])=>{
  const b=document.createElement('button');b.type='button';b.className='emote';
  b.innerHTML=`<span aria-hidden="true">${icon}</span>${label}`;
  b.addEventListener('click',()=>{
   close(true);
   events.dispatchEvent(new CustomEvent(EMOTE_REQUEST,{detail:{id}}));
   // Seated, my avatar is hidden, so the pick needs its own visible answer (UX-E-R05).
   if(seated)events.dispatchEvent(new CustomEvent(HUD_TOAST,{detail:{text:`${label}를 보냈어요`,ms:SEATED_TOAST_MS}}));
  });
  root.append(b);return b;
 });
 const button=document.createElement('button');
 button.id='emote-open';button.type='button';button.setAttribute('aria-expanded','false');button.setAttribute('aria-keyshortcuts','Alt');
 button.textContent='감정표현'; // no keycap on dock buttons: keys live in the #hud-keys box (ui hud-controls.md)
 button.addEventListener('click',()=>root.hidden?open():close(false));
 const dock=document.querySelector('#dock');
 uiRoot.append(style,root);
 if(dock)dock.prepend(button);else uiRoot.append(button);
 function open(){
  if(!root.hidden||full)return;
  opener=document.activeElement;
  root.hidden=false;button.setAttribute('aria-expanded','true');
  resume=input.walking;
  if(resume)input.releasePointer(); // arrows move focus in the menu, not the avatar
  buttons[0].focus();
 }
 function close(back){
  if(root.hidden)return;
  root.hidden=true;button.setAttribute('aria-expanded','false');
  if(resume)input.capturePointer(); // every close gives walking back (mouse-first: no Esc-to-free-the-cursor state)
  if(!back&&opener?.isConnected&&opener!==document.body)opener.focus();
  resume=false;opener=null;
 }
 const action=e=>{if(e.detail.action==='emoteMenu'&&e.detail.down)root.hidden?open():close(true);};
 const key=e=>{if(!root.hidden&&e.key==='Escape')close(false);};
 // Focus stays inside: Tab cycles, arrows move in the 2x2 grid.
 const moves={ArrowLeft:-1,ArrowRight:1,ArrowUp:-2,ArrowDown:2};
 root.addEventListener('keydown',e=>{
  const items=[...root.querySelectorAll('button')].filter(b=>b.checkVisibility()),at=items.indexOf(document.activeElement);
  if(e.key==='Tab'){e.preventDefault();items[(at+(e.shiftKey?-1:1)+items.length)%items.length].focus();return;}
  const i=buttons.indexOf(document.activeElement);
  // Seated, the menu is one column (E-W8): every arrow moves by one.
  if(e.key in moves&&i>=0){e.preventDefault();buttons[(i+(seated?Math.sign(moves[e.key]):moves[e.key])+4)%4].focus();}
 });
 const outside=e=>{if(!root.hidden&&!root.contains(e.target)&&!button.contains(e.target))close(false);};
 const seat=e=>{seated=e.type===SEAT_ENTER;};
 const fullMode=e=>{full=e.type===FULLMODE_ENTER;if(full)close(false);};
 events.addEventListener(INPUT_ACTION,action);events.addEventListener(EMOTE_MENU_OPEN,open);
 for(const name of [SEAT_ENTER,SEAT_EXIT])events.addEventListener(name,seat);
 for(const name of [FULLMODE_ENTER,FULLMODE_EXIT])events.addEventListener(name,fullMode);
 document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside,true);
 return {
  dispose(){
   events.removeEventListener(INPUT_ACTION,action);events.removeEventListener(EMOTE_MENU_OPEN,open);
   for(const name of [SEAT_ENTER,SEAT_EXIT])events.removeEventListener(name,seat);
   for(const name of [FULLMODE_ENTER,FULLMODE_EXIT])events.removeEventListener(name,fullMode);
   document.removeEventListener('keydown',key);document.removeEventListener('pointerdown',outside,true);
   root.remove();style.remove();button.remove();
  },
 };
}
