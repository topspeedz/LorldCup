import {INPUT_ACTION} from '../events.js';

// C toggles YouTube's own chat for the video on the arena screen (live chat, or chat replay for a VOD).
// shortcut: YouTube only serves chat for videos that were live streams; other VODs show YouTube's "chat unavailable" page.
export function create(ctx){
 const {events,uiRoot}=ctx;
 const style=document.createElement('style');
 style.textContent=`#yt-chat{position:fixed;right:var(--edge,12px);top:var(--edge,12px);bottom:var(--edge,12px);width:min(360px,calc(100vw - var(--edge,12px)*2));z-index:var(--z-hud,auto);background:var(--color-panel,#0b1a28);border:var(--border-width,1px) solid var(--color-border-subtle,#345367);border-radius:var(--radius-md,6px);overflow:hidden}
  #yt-chat[hidden]{display:none}#yt-chat iframe{width:100%;height:100%;border:0;display:block}`;
 const panel=document.createElement('aside');panel.id='yt-chat';panel.hidden=true;panel.setAttribute('aria-label','유튜브 채팅');
 // The bar button is the visible way in; C stays the shortcut.
 const button=document.createElement('button');button.id='chat-open';button.type='button';button.textContent='채팅';
 button.title='유튜브 채팅 열기 (C)';button.setAttribute('aria-expanded','false');button.setAttribute('aria-keyshortcuts','C');
 uiRoot.append(style,panel);(document.querySelector('#dock')||uiRoot).append(button);
 // The panel starts just under the top-right #hud column (key hints, 같이 보기, 나가기) so it never covers it; the column's height changes with the state.
 const hud=document.querySelector('#hud');
 const fit=()=>{const r=hud?.getBoundingClientRect();panel.style.top=r?.height?`${Math.round(r.bottom+8)}px`:'';};
 const watch=hud?new ResizeObserver(fit):null;watch?.observe(hud);
 function open(){
  const screen=window.arena?.screen,id=screen?.videoId;
  if(!id)return;
  const url=new URL(screen.source==='vod'&&!screen.liveOn?'https://www.youtube.com/live_chat_replay':'https://www.youtube.com/live_chat');
  url.search=new URLSearchParams({v:id,embed_domain:location.hostname,dark_theme:1}); // dark_theme: YouTube's own dark chat, so its text and background match
  const frame=document.createElement('iframe');frame.title='유튜브 채팅';frame.src=url.href;
  fit();panel.replaceChildren(frame);panel.hidden=false;button.setAttribute('aria-expanded','true');
 }
 function close(){panel.hidden=true;panel.replaceChildren();button.setAttribute('aria-expanded','false');}
 const action=e=>{if(e.detail.action==='chat'&&e.detail.down)panel.hidden?open():close();};
 const toggle=()=>panel.hidden?open():close();
 button.addEventListener('click',toggle);
 events.addEventListener(INPUT_ACTION,action);
 return {dispose(){events.removeEventListener(INPUT_ACTION,action);watch?.disconnect();panel.remove();button.remove();style.remove();}};
}
