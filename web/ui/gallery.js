// A board page beside the video: the 갤러리 button opens the League of Legends gallery list in a panel on the left edge.
// shortcut: a plain iframe of the desktop page (the mobile page redirects desktop browsers), so a narrow panel scrolls sideways,
// and the site can refuse embedding at any time; switch to a link that opens a new tab if it does.
const URL_='https://gall.dcinside.com/board/lists/?id=leagueoflegends6';

export function create(ctx){
 const {uiRoot}=ctx;
 const style=document.createElement('style');
 style.textContent=`#gallery{position:fixed;left:var(--edge,12px);top:var(--edge,12px);bottom:var(--edge,12px);width:min(clamp(360px,21vw,600px),calc(100vw - var(--edge,12px)*2));z-index:var(--z-hud,auto);background:#fff;border:var(--border-width,1px) solid var(--color-border-subtle,#345367);border-radius:var(--radius-md,6px);overflow:hidden}
  #gallery[hidden]{display:none}#gallery iframe{width:100%;height:100%;border:0;display:block}
  #dock>#gallery-open{order:1}body[data-hud=seated] #dock>#gallery-open{order:3}
  body:not(.touch)[data-hud=seated] #dock>#gallery-open{margin-left:0}
  #gallery-open[aria-expanded=true]{background:var(--color-panel-hover);border-color:var(--color-accent)}`;
 const panel=document.createElement('aside');panel.id='gallery';panel.hidden=true;panel.setAttribute('aria-label','갤러리 게시판');
 const button=document.createElement('button');button.id='gallery-open';button.type='button';button.textContent='갤러리';
 button.title='게시판을 왼쪽에 열기';button.setAttribute('aria-expanded','false');
 uiRoot.append(style,panel);(document.querySelector('#dock')||uiRoot).append(button);
 function open(){
  const frame=document.createElement('iframe');frame.title='갤러리 게시판';frame.src=URL_;frame.referrerPolicy='no-referrer';
  panel.replaceChildren(frame);panel.hidden=false;button.setAttribute('aria-expanded','true');
 }
 function close(){panel.hidden=true;panel.replaceChildren();button.setAttribute('aria-expanded','false');}
 button.addEventListener('click',()=>panel.hidden?open():close());
 return {dispose(){panel.remove();button.remove();style.remove();}};
}
