import {APP_ENTER,TEAM_CHANGED,CHARACTER_CHANGED,TEAM_SELECT_OPEN} from '../events.js';

// Layout: docs/live/graphicmodel/ui/team-select.md (dialog-width 360, team-height 64, close-size 32 are its non-token sizes).
const css=`
#dock>#team-select-open{order:0}
#team-select{position:fixed;z-index:var(--z-menu);right:var(--space-5);top:50%;transform:translateY(-50%);width:min(360px,calc(100vw - var(--space-4)*2));max-height:calc(100vh - var(--space-5)*2);overflow:auto;padding:var(--space-5);background:var(--color-panel);border:var(--border-width) solid var(--color-border-subtle);border-radius:var(--radius-md);box-shadow:var(--shadow-panel);backdrop-filter:blur(var(--panel-blur));animation:team-select-in var(--motion-base) var(--ease-out)}
#team-select h2{margin:0 0 var(--space-4);font-size:var(--font-size-md)}
#team-select fieldset{margin:0 0 var(--space-4);padding:0;border:0;display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)}
#team-select legend{margin-bottom:var(--space-2);color:var(--color-text-subtle);letter-spacing:var(--letter-spacing-label);font-size:var(--font-size-xs)}
#team-select .unpicked{grid-column:1/-1;margin:0;color:var(--color-text-muted);font-size:var(--font-size-xs)}
#team-select fieldset button{height:64px;display:flex;flex-direction:column;justify-content:space-between;align-items:flex-start;text-align:left;padding:var(--space-2) var(--space-3);overflow:hidden}
#team-select fieldset button .name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
#team-select fieldset button .mark{font-size:var(--font-size-xs);font-weight:var(--font-weight-bold);min-height:1em}
#team-select fieldset button[aria-pressed=true]{box-shadow:inset 0 0 0 2px var(--color-accent)}
#team-select .teams button{font-weight:var(--font-weight-bold);border-left-width:6px}
#team-select .teams button .mark{order:-1;align-self:flex-end}
#team-select .close{position:absolute;top:var(--space-3);right:var(--space-3);width:32px;height:32px;padding:0}
@keyframes team-select-in{from{opacity:0;transform:translate(var(--space-4),-50%)}}
@media(prefers-reduced-motion:reduce){@keyframes team-select-in{from{opacity:0}}}
@media(max-width:800px){#team-select{top:auto;transform:none;left:max(var(--space-4),env(safe-area-inset-left));right:max(var(--space-4),env(safe-area-inset-right));bottom:max(var(--space-4),env(safe-area-inset-bottom));width:auto;max-height:58vh;padding:var(--space-4)}#team-select fieldset button{min-height:var(--size-target-touch)}#team-select .close{width:var(--size-target-touch);height:var(--size-target-touch)}@keyframes team-select-in{from{opacity:0}}}
body.touch #team-select-open{min-height:var(--size-target-touch)}`;

// Team button and ticket card text: whichever of the two text tokens contrasts more with the team colour (team-select.md, computed, not hand-picked).
const luminance=hex=>{
 const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.03928?c/12.92:((c+.055)/1.055)**2.4);
 return .2126*r+.7152*g+.0722*b;
};
const contrast=(a,b)=>{const [x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x+.05)/(y+.05);};
export const textOn=bg=>contrast(bg,'#edf6ff')>=contrast(bg,'#082338')?'var(--color-text)':'var(--color-text-on-accent)';

export function create(ctx){
 const {events,uiRoot}=ctx,teams=ctx.config('teams').teams,chars=ctx.config('characters');
 let team=null,character=chars.default,returnTo=null,onClose=null;

 const style=document.createElement('style');style.textContent=css;
 const opener=document.createElement('button');
 opener.type='button';opener.id='team-select-open';opener.textContent='팀·캐릭터';
 const root=document.createElement('section');
 root.id='team-select';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-labelledby','team-select-title');
 root.innerHTML=`<h2 id="team-select-title">팀·캐릭터 선택</h2><fieldset class="teams"><legend>응원팀</legend><p class="unpicked">아직 고르지 않음</p></fieldset>
<fieldset class="chars"><legend>캐릭터</legend></fieldset><button type="button" class="close" aria-label="팀·캐릭터 선택 닫기">✕</button>`;
 const [teamSet,charSet]=root.querySelectorAll('fieldset'),unpicked=root.querySelector('.unpicked');
 const choice=(parent,label,pick)=>{
  const b=document.createElement('button');b.type='button';b.setAttribute('aria-pressed','false');
  b.innerHTML='<span class="name"></span><span class="mark" aria-hidden="true"></span>';b.firstChild.textContent=label;
  b.addEventListener('click',pick);parent.append(b);return b;
 };
 const teamButtons=teams.map(t=>{
  const b=choice(teamSet,t.name,()=>{if(team!==t){team=t;refresh();
   events.dispatchEvent(new CustomEvent(TEAM_CHANGED,{detail:{teamId:t.id}}));}});
  b.style.background=t.color;b.style.borderLeftColor=t.accent;b.style.color=textOn(t.color);
  return b;
 });
 const charButtons=chars.ids.map(id=>choice(charSet,chars.names[id],()=>{if(character!==id){character=id;refresh();
  events.dispatchEvent(new CustomEvent(CHARACTER_CHANGED,{detail:{characterId:id}}));}}));
 function refresh(){
  unpicked.hidden=!!team;
  const mark=(b,on)=>{b.setAttribute('aria-pressed',String(on));b.lastChild.textContent=on?'✓ 선택됨':'';};
  teamButtons.forEach((b,i)=>mark(b,teams[i]===team));
  charButtons.forEach((b,i)=>mark(b,chars.ids[i]===character));
 }
 const focusables=()=>[...root.querySelectorAll('button')];
 const close=()=>{
  if(root.hidden)return;
  root.hidden=true;document.removeEventListener('pointerdown',outside,true);
  const back=onClose;onClose=null;back?.();
  (returnTo?.isConnected&&!returnTo.closest('[hidden]')?returnTo:opener).focus();
 };
 // UX-T10: a click outside only closes the window; capture phase keeps it from reaching the canvas (which would start walking).
 const outside=e=>{if(!root.contains(e.target)){e.stopPropagation();e.preventDefault();close();}};
 // TEAM_SELECT_OPEN detail {returnFocus, onClose}: the ticket hides under the picker and takes focus back (B-M-1, T21u).
 const open=e=>{
  returnTo=e?.detail?.returnFocus??opener;onClose=e?.detail?.onClose??null;
  root.hidden=false;
  (teamButtons[teams.indexOf(team)]||teamButtons[0]||charButtons[0])?.focus();
  setTimeout(()=>document.addEventListener('pointerdown',outside,true)); // not the click that opened it
 };
 opener.addEventListener('click',()=>open());events.addEventListener(TEAM_SELECT_OPEN,open);
 // T64: the ticket popup picks the team too; show that pick here.
 const onTeam=e=>{const t=teams.find(t=>t.id===e.detail?.teamId);if(t&&t!==team){team=t;refresh();}};
 events.addEventListener(TEAM_CHANGED,onTeam);
 root.querySelector('.close').addEventListener('click',close);
 root.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.stopPropagation();close();return;}
  if(e.key!=='Tab')return;
  const list=focusables(),i=list.indexOf(document.activeElement);
  const next=list[(i+(e.shiftKey?-1:1)+list.length)%list.length];
  e.preventDefault();next.focus();
 });
 refresh();
 // The window sits on <body> with an opaque panel (A-T39-H-1: the UI behind read through the translucent one).
 // The opener is not on the first page; it joins #dock at app:enter and stays visible in every state (architecture 새 ID).
 const place=()=>(document.querySelector('#dock')||uiRoot).prepend(opener);
 events.addEventListener(APP_ENTER,place);
 uiRoot.append(style);document.body.append(root);

 return {dispose(){events.removeEventListener(APP_ENTER,place);events.removeEventListener(TEAM_SELECT_OPEN,open);events.removeEventListener(TEAM_CHANGED,onTeam);document.removeEventListener('pointerdown',outside,true);style.remove();opener.remove();root.remove();}};
}
