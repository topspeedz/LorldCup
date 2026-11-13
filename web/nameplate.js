import {PEER_STATE,ROOM_LEFT} from './events.js';

// Nickname tags above other participants' heads. Nicknames are set in multiplayer.js; text only, never HTML.
export function create(ctx){
 const mp=ctx.multiplayer,tags=new Map(),head=new ctx.THREE.Vector3();
 const layer=document.createElement('div');
 layer.style.cssText='position:fixed;inset:0;pointer-events:none;overflow:hidden';
 ctx.uiRoot.append(layer);
 function tag(peerId,nickname){
  let el=tags.get(peerId);
  if(!el){el=document.createElement('div');el.style.cssText='position:absolute;left:0;top:0;padding:2px 8px;border-radius:4px;background:#07121dcc;color:#edf6ff;font:13px/1.4 system-ui,sans-serif;white-space:nowrap;pointer-events:none';layer.append(el);tags.set(peerId,el);}
  el.textContent=nickname;
 }
 const onState=e=>tag(e.detail.peerId,e.detail.nickname);
 const clear=()=>{for(const el of tags.values())el.remove();tags.clear();};
 ctx.events.addEventListener(PEER_STATE,onState);ctx.events.addEventListener(ROOM_LEFT,clear);
 for(const p of mp.peers)tag(p.peerId,p.nickname);
 return {
  update(){
   for(const [peerId,el] of tags){
    const avatar=mp.avatarOf(peerId);
    if(!avatar){if(!mp.peers.some(p=>p.peerId===peerId)){el.remove();tags.delete(peerId);}else el.hidden=true;continue;}
    head.copy(avatar.position).y+=2.05;head.project(ctx.camera);
    el.hidden=head.z>1;
    el.style.transform=`translate(-50%,-100%) translate(${(head.x+1)/2*innerWidth}px,${(1-head.y)/2*innerHeight}px)`;
   }
  },
  dispose(){clear();layer.remove();ctx.events.removeEventListener(PEER_STATE,onState);ctx.events.removeEventListener(ROOM_LEFT,clear);},
 };
}
