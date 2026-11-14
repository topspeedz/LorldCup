import {TEAM_CHANGED,TICKET_ISSUED} from '../events.js';
import {textOn} from './team-select.js';

// T64 (user, 2026-11-14): the ticket is one big centred "응원할 팀 고르기" popup; a team pick issues it at once (no emote step).
// Panel, card and close keep docs/live/graphicmodel/ui/ticket.md (card-height 150, close-size 32); width 480 (clear of the 360px picker at 1280) and team-button height 96 are T64 starting values.
const css=`
#ticket{position:fixed;z-index:var(--z-menu);left:50%;top:50%;transform:translate(-50%,-50%);width:min(480px,calc(100vw - var(--space-4)*2));max-height:calc(100vh - var(--space-5)*2);overflow:auto;padding:var(--space-5);background:var(--color-panel);border:var(--border-width) solid var(--color-border-subtle);border-radius:var(--radius-md);box-shadow:var(--shadow-panel);text-align:center;animation:ticket-in var(--motion-base) var(--ease-out)}
#ticket .tag{font-size:var(--font-size-xs);letter-spacing:var(--letter-spacing-label);color:var(--color-text-subtle)}
#ticket h2{margin:var(--space-1) 0;font-size:var(--font-size-xl);font-weight:var(--font-weight-bold)}#ticket p{margin:0 0 var(--space-4);color:var(--color-text-muted)}
#ticket .teams{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:var(--space-3)}
#ticket .teams button{height:96px;font-size:var(--font-size-lg);font-weight:var(--font-weight-bold);border-left-width:8px}
#ticket .teams button:hover{filter:brightness(1.1)}
#ticket .go{background:var(--color-accent);border-color:var(--color-accent);color:var(--color-text-on-accent);font-weight:var(--font-weight-bold)}
#ticket .close{position:absolute;top:var(--space-3);right:var(--space-3);width:32px;height:32px;padding:0}
#ticket .card{height:150px;border-radius:var(--radius-md);border-left:6px solid;box-shadow:var(--shadow-panel);display:grid;place-content:center;text-align:center;font-size:var(--font-size-lg);font-weight:var(--font-weight-bold);animation:ticket-card var(--card-ms,1.8s) var(--ease-out) both}
#ticket .card small{display:block;font-size:var(--font-size-xs);letter-spacing:var(--letter-spacing-label);margin-top:var(--space-1)}
#ticket .opened{margin-top:var(--space-4)}#ticket .opened h3{margin:0 0 var(--space-1);font-size:var(--font-size-md)}#ticket .opened h3::before{content:'● ';color:var(--color-accent)}
#ticket .go{width:100%;padding:var(--space-3)}
#ticket .preparing{margin:0;padding:var(--space-5) 0;font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-text)}
#ticket-reopen{padding:var(--space-2) var(--space-3);background:rgb(7 18 29/var(--panel-alpha-hud));border:0;border-left:3px solid var(--color-accent);border-radius:var(--radius-sm)}
@keyframes ticket-in{from{opacity:0;transform:translate(-50%,-50%) scale(.96)}}
@keyframes ticket-card{from{opacity:0;transform:perspective(600px) rotateY(180deg)}}
@media(prefers-reduced-motion:reduce){#ticket,#ticket .card{animation:none}}
@media(max-width:800px){#ticket{top:max(var(--space-4),env(safe-area-inset-top));bottom:auto;transform:none;left:max(var(--space-4),env(safe-area-inset-left));right:max(var(--space-4),env(safe-area-inset-right));width:auto;max-height:calc(100vh - var(--tier2-bottom) - var(--size-target-touch)*2 - var(--space-2) - var(--space-4)*2);padding:var(--space-4);animation:none}#ticket button{min-height:var(--size-target-touch)}#ticket .teams button{height:72px}#ticket .card{height:120px}#ticket-reopen{min-height:var(--size-target-touch)}}`;

const OBJECTIVE='입구로 가서 티켓 받기',TOUCH_M=1;

export function create(ctx){
 const {THREE,scene,events,player,uiRoot}=ctx,cfg=ctx.config('ticket'),teams=ctx.config('teams').teams;
 const {barrier:b,sideGlass:g}=cfg,y0=b.y[0],y1=b.y[1],[z0,z1]=b.z;
 const material=new THREE.MeshBasicMaterial({visible:false});
 const box=(xa,xb,za,zb)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(xb-xa,y1-y0,zb-za),material);
  mesh.position.set((xa+xb)/2,(y0+y1)/2,(za+zb)/2);mesh.updateMatrixWorld(true);player.addBlocker(mesh);return mesh;
 };
 const gate=box(b.x-.1,b.x+.1,z0,z1);
 // Outer glass has no collision of its own; block it so the opening is the only way in.
 // The corridor between the glass and the curtain wall is open at both ends; close each from the glass to the curtain wall.
 const glass=[box(g.x[0],g.x[1],g.z[0],z0),box(g.x[0],g.x[1],z1,g.z[1]),...cfg.corridorEnds.map(e=>box(e.x[0],e.x[1],e.z[0],e.z[1]))];
 // UX-K01/K04: a floor line across the opening, warning colour while shut, accent once open (ticket.md 입구 3D 표시).
 // shortcut: floor line only, no door-post bands; add them with the vfx designer's glow values.
 const markColor={shut:'#ffdba1',open:'#7fdcff'};
 const mark=new THREE.Mesh(new THREE.BoxGeometry(.08,.02,z1-z0),new THREE.MeshBasicMaterial({color:markColor.shut,transparent:true,opacity:.6}));
 mark.name='Ticket_GateMark';mark.position.set(b.x-.15,y0+.01,(z0+z1)/2);scene.add(mark);

 let team=null,issued=false,issuing=false,opened=false,dismissed=false,near=false,timer=0;
 let disposed=false;

 const style=document.createElement('style');style.textContent=css;
 const root=document.createElement('section');
 root.id='ticket';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-label','입장 티켓');
 root.innerHTML=`<span class="tag">입장 티켓</span><div class="pick"><h2>응원할 팀 고르기</h2><p>팀을 고르면 바로 티켓이 나오고 입구가 열립니다.</p><div class="teams" role="group" aria-label="응원할 팀"></div></div>
<p class="preparing" role="status" hidden>티켓팅 중...</p><div class="slot" aria-live="polite"></div><button type="button" class="close" aria-label="티켓 창 닫기">✕</button>`;
 uiRoot.append(style);document.body.append(root); // on <body>, above the static HUD boxes
 const pick=root.querySelector('.pick'),slot=root.querySelector('.slot'),closeButton=root.querySelector('.close');
 const preparing=root.querySelector('.preparing');
 // A pick goes out as TEAM_CHANGED, so the character, the room and the team picker all follow it; onTeam below issues the ticket.
 const teamButtons=teams.map(t=>{
  const b=document.createElement('button');b.type='button';b.textContent=t.name;
  b.style.background=t.color;b.style.borderLeftColor=t.accent;b.style.color=textOn(t.color);
  b.addEventListener('click',()=>events.dispatchEvent(new CustomEvent(TEAM_CHANGED,{detail:{teamId:t.id}})));
  root.querySelector('.teams').append(b);return b;
 });
 const objective=document.querySelector('#hud-objective');
 const reopen=document.createElement('button');
 reopen.type='button';reopen.id='ticket-reopen';reopen.textContent='입구 앞 · 티켓 창 열기';

 const show=()=>{
  root.hidden=false; // the cursor is always free (mouse-first): walking input stays on
  (issued?root.querySelector('.go'):issuing?null:teamButtons[0])?.focus();
 };
 closeButton.addEventListener('click',()=>{dismissed=true;root.hidden=true;});
 reopen.addEventListener('click',()=>{dismissed=false;show();});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!issued&&!issuing){e.stopPropagation();dismissed=true;root.hidden=true;}});

 function setObjective(){
  if(!objective)return;
  const want=issued?null:near&&dismissed?reopen:OBJECTIVE;
  if(want===reopen){if(reopen.parentNode!==objective)objective.replaceChildren(reopen);}
  else if(objective.textContent!==(want??'')||objective.firstChild===reopen)objective.textContent=want??'';
 }
 function issue(){
  issuing=true;
  pick.hidden=true;closeButton.hidden=true;preparing.hidden=false;root.hidden=false;root.setAttribute('aria-busy','true');
  ctx.prepareCrowd().then(()=>{
   if(disposed)return;
   preparing.hidden=true;root.removeAttribute('aria-busy');showCard();
  }).catch(error=>{
   if(disposed)return;
   preparing.textContent='입장 준비에 실패했습니다. 새로고침해 주세요.';root.removeAttribute('aria-busy');console.error('Crowd preparation failed',error);
  });
 }
 function showCard(){
  const card=document.createElement('div');
  card.className='card';card.setAttribute('role','img');card.setAttribute('aria-label',`${team.name} 입장 티켓`);
  card.style.setProperty('--card-ms',cfg.cardMs+'ms');
  card.style.background=team.color;card.style.borderColor=team.accent;card.style.color=textOn(team.color);
  card.innerHTML=`<span></span><small>WORLDS 2026 · ADMIT ONE</small>`;card.firstChild.textContent=team.name;
  slot.append(card);
  timer=setTimeout(finishIssue,cfg.cardMs);
 }
 function finishIssue(){
   if(disposed||issued)return;
   issued=true;player.removeBlocker(gate);
   mark.material.color.set(markColor.open);mark.material.opacity=1;
   const done=document.createElement('div');done.className='opened';
   done.innerHTML='<h3>입구가 열렸습니다</h3><p>입구를 지나 경기장으로 들어가세요.</p><button type="button" class="go">들어가기</button>';
   done.querySelector('.go').addEventListener('click',()=>{root.hidden=true;});
   slot.append(done);opened=true;setObjective();
   if(!root.hidden)done.querySelector('.go').focus();
   events.dispatchEvent(new CustomEvent(TICKET_ISSUED,{detail:{teamId:team.id}}));
 }
 // Any team pick issues the ticket (this popup or the 팀·캐릭터 picker); later picks change only the team, not the ticket.
 const onTeam=e=>{const t=teams.find(t=>t.id===e.detail?.teamId);if(t&&!issuing){team=t;issue();}};
 events.addEventListener(TEAM_CHANGED,onTeam);
 setObjective();

 return {
  update(){
   const p=player.position,dz=p.z-Math.min(Math.max(p.z,z0),z1),d=Math.hypot(p.x-b.x,dz);
   near=d<cfg.promptDistance;
   if(opened){if(!near)root.hidden=true;return;} // walking is always on now; the opened note goes when you walk away
   if(!near){dismissed=false;if(!issuing)root.hidden=true;}
   else if(dismissed&&d<TOUCH_M&&!issuing){dismissed=false;show();} // K9: bumping the barrier brings it back
   else if(root.hidden&&!dismissed)show();
   setObjective();
  },
  dispose(){
   disposed=true;
   clearTimeout(timer);
   events.removeEventListener(TEAM_CHANGED,onTeam);
   for(const mesh of [gate,...glass]){player.removeBlocker(mesh);mesh.geometry.dispose();}
   scene.remove(mark);mark.geometry.dispose();mark.material.dispose();
   material.dispose();style.remove();root.remove();reopen.remove();if(objective)objective.textContent='';
  },
 };
}
