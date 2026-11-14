// A board page beside the video: the 갤러리 button opens the League of Legends gallery list in a panel on the left edge.
// shortcut: a plain iframe of the desktop page (the mobile page redirects desktop browsers), so a narrow panel scrolls sideways,
// and the site can refuse embedding at any time; switch to a link that opens a new tab if it does.
const URL_='https://gall.dcinside.com/board/lists/?id=leagueoflegends6';

export function create(ctx){
 const {uiRoot}=ctx;
 const style=document.createElement('style');
 style.textContent=`#gallery{position:fixed;left:var(--edge,12px);top:var(--edge,12px);bottom:var(--edge,12px);width:min(clamp(360px,21vw,600px),calc(100vw - var(--edge,12px)*2));z-index:var(--z-hud,auto);background:#fff;border:var(--border-width,1px) solid var(--color-border-subtle,#345367);border-radius:var(--radius-md,6px);overflow:hidden}
  #gallery[hidden]{display:none}#gallery iframe{width:calc(100%/var(--zoom,.8));height:calc(100%/var(--zoom,.8));border:0;display:block;transform:scale(var(--zoom,.8));transform-origin:0 0} /* the desktop page shrunk (80%, the +/- buttons change it), so more of its list fits the panel */
  #dock>#gallery-open{order:1}body[data-hud=seated] #dock>#gallery-open{order:3}
  body:not(.touch)[data-hud=seated] #dock>#gallery-open{margin-left:0}
  #gallery-tools{position:fixed;top:var(--edge,12px);z-index:var(--z-hud,auto);display:flex;flex-direction:column;gap:var(--space-2,8px)}#gallery-tools[hidden]{display:none}
  #gallery-tools button{min-height:var(--size-target-touch,44px);white-space:nowrap;background:rgb(7 18 29/var(--panel-alpha,.91))}
  #gallery-tools [data-do=auto]{font-size:var(--font-size-xs,12px)}
  #gallery-tools [data-zoom]{text-align:center;font-size:var(--font-size-xs,12px);font-variant-numeric:tabular-nums;color:var(--color-text,#edf6ff);text-shadow:var(--text-shadow-hud,0 1px 2px #000000b3)}
  #gallery-tools button[aria-pressed=true]{background:var(--color-accent,#7fdcff);border-color:var(--color-accent,#7fdcff);color:var(--color-text-on-accent,#082338);font-weight:var(--font-weight-bold,700)}
  #gallery-open[aria-expanded=true]{background:var(--color-panel-hover);border-color:var(--color-accent)}`;
 const panel=document.createElement('aside');panel.id='gallery';panel.hidden=true;panel.setAttribute('aria-label','갤러리 게시판');
 const button=document.createElement('button');button.id='gallery-open';button.type='button';button.textContent='갤러리';
 button.title='게시판을 왼쪽에 열기';button.setAttribute('aria-expanded','false');
 // Beside the panel: reload now, and reload every minute. The page is another site's, so a reload can only load the list again.
 const tools=document.createElement('div');tools.id='gallery-tools';tools.hidden=true;
 tools.innerHTML='<button type="button" data-do="reload">새로고침</button><button type="button" data-do="auto" aria-pressed="false">1분마다 새로고침</button><button type="button" data-do="in" aria-label="글씨 크게">＋</button><span data-zoom role="status"></span><button type="button" data-do="out" aria-label="글씨 작게">－</button>';
 const [reloadButton,autoButton]=tools.children;let auto=0;
 const reload=()=>{const frame=panel.querySelector('iframe');if(frame)frame.src=URL_;};
 const setAuto=on=>{clearInterval(auto);auto=on?setInterval(reload,60000):0;autoButton.setAttribute('aria-pressed',String(on));};
 // Zoom: 50%–120% in 10% steps, shown between the two buttons.
 let zoom=80;
 const zoomLabel=tools.querySelector('[data-zoom]');
 const setZoom=v=>{zoom=Math.min(120,Math.max(50,v));panel.style.setProperty('--zoom',String(zoom/100));zoomLabel.textContent=`${zoom}%`;};
 tools.querySelector('[data-do=in]').addEventListener('click',()=>setZoom(zoom+10));
 tools.querySelector('[data-do=out]').addEventListener('click',()=>setZoom(zoom-10));
 setZoom(zoom);
 reloadButton.addEventListener('click',reload);autoButton.addEventListener('click',()=>setAuto(!auto));
 uiRoot.append(style,panel,tools);(document.querySelector('#dock')||uiRoot).append(button);
 // Fit between the left edge and the video so the player is not covered; under 280px of room the panel keeps 280px.
 let timer=0;
 const fit=()=>{
  const r=window.arena?.screen?.element?.getBoundingClientRect(),edge=parseFloat(getComputedStyle(panel).left)||0;
  const room=r&&r.width>0&&getComputedStyle(window.arena.screen.element).visibility!=='hidden'?r.left-edge-8:Infinity;
  panel.style.maxWidth=Number.isFinite(room)?`${Math.max(280,Math.round(room))}px`:'';
  tools.style.left=`${Math.round(panel.getBoundingClientRect().right+8)}px`;
 };
 function open(){
  const frame=document.createElement('iframe');frame.title='갤러리 게시판';frame.src=URL_;frame.referrerPolicy='no-referrer';
  fit();timer=setInterval(fit,500);panel.replaceChildren(frame);panel.hidden=false;tools.hidden=false;fit();button.setAttribute('aria-expanded','true');
 }
 function close(){clearInterval(timer);setAuto(false);tools.hidden=true;panel.hidden=true;panel.replaceChildren();button.setAttribute('aria-expanded','false');}
 button.addEventListener('click',()=>panel.hidden?open():close());
 return {dispose(){clearInterval(timer);clearInterval(auto);tools.remove();panel.remove();button.remove();style.remove();}};
}
