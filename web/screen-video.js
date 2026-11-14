import {CSS3DObject,CSS3DRenderer} from './vendor/CSS3DRenderer.js';
import {createScreenMesh} from './screen-mesh.js';
import {APP_ENTER,SCREEN_STATE,ROOM_JOINED,ROOM_LEFT,ROOM_ROUND,SEAT_ENTER,SEAT_EXIT,FULLMODE_ENTER,FULLMODE_EXIT} from './events.js';

export function roundPosition(nowMs,roundStartMs,durationSec){
 const seconds=(nowMs-roundStartMs)/1000;
 return {seconds,ended:durationSec>0&&seconds>=durationSec};
}

export function scheduledSource(nowMs,screenConfig){
 return screenConfig.schedule.find(slot=>['live','vod'].includes(slot.source)&&Date.parse(slot.from)<=nowMs&&nowMs<Date.parse(slot.to))?.source||screenConfig.source;
}

export function upcomingRounds(nowMs,intervalMinutes,count){
 const interval=intervalMinutes*60000,next=(Math.floor(nowMs/interval)+1)*interval;
 return Array.from({length:count},(_,i)=>next+i*interval);
}

let youtubeAPI;
function loadYouTube(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(youtubeAPI)return youtubeAPI;
 youtubeAPI=new Promise((resolve,reject)=>{
  const script=document.createElement('script'),previous=window.onYouTubeIframeAPIReady;
  let settled=false;
  const finish=error=>{
   if(settled)return;settled=true;
   clearTimeout(timer);script.onerror=null;
   if(window.onYouTubeIframeAPIReady===onReady)window.onYouTubeIframeAPIReady=previous;
   if(error){script.remove();reject(error);}else resolve(window.YT);
  };
  const timer=setTimeout(()=>finish(Error('유튜브 연결 시간이 초과되었습니다.')),15000);
  const onReady=()=>{finish();previous?.();};window.onYouTubeIframeAPIReady=onReady;
  script.src='https://www.youtube.com/iframe_api';script.async=true;
  script.onerror=()=>finish(Error('유튜브를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.'));
  document.head.append(script);
 }).catch(error=>{youtubeAPI=null;throw error;});
 return youtubeAPI;
}

function sourceInfo(value){
 if(/^[\w-]{11}$/.test(value||''))return {id:value};
 try{
  const url=new URL(value);
  if(url.protocol!=='https:')return null;
  const host=url.hostname.replace(/^www\./,'');
  if(!['youtube.com','m.youtube.com','youtu.be'].includes(host))return null;
  const parts=url.pathname.split('/').filter(Boolean);
  const channel=url.searchParams.get('channel')||(parts[0]==='channel'&&parts[2]==='live'?parts[1]:null);
  if(channel&&/^UC[\w-]{22}$/.test(channel))return {channel};
  const id=host==='youtu.be'?parts[0]:url.searchParams.get('v')||(['embed','live','shorts'].includes(parts[0])?parts[1]:null);
  return /^[\w-]{11}$/.test(id||'')?{id}:null;
 }catch{return null;}
}

export function create(ctx){
 const {THREE,scene,camera,renderer,root,cssLayer,uiRoot,events}=ctx,config=ctx.config('screen');
 const interval=config.roundIntervalMinutes*60000;
 const currentRound=()=>config.defaultRound==='current'?Math.floor(Date.now()/interval)*interval:Number(config.defaultRound);
 const initialRound=ctx.multiplayer?.room?.roundStart;
 const slots=config.schedule.filter(slot=>['live','vod'].includes(slot.source)).map(slot=>({slot,from:Date.parse(slot.from),to:Date.parse(slot.to)}));
 const slotAt=now=>slots.find(slot=>slot.from<=now&&now<slot.to)?.slot||null;
 let scheduleTime=Date.now(),slot=slotAt(scheduleTime),scheduledFallback=false;
 const playbackSource=()=>scheduledFallback?config.liveFallback:scheduledSource(scheduleTime,config);
 let source=playbackSource(),roundStart=Number.isFinite(initialRound)?initialRound:currentRound(),inRoom=Number.isFinite(initialRound),fullMode=false,disposed=false,entered=false;
 let player=null,ready=false,cueing=false,starting=false,eligible=false,inView=false,hasImage=false,status='loading',error=null;
 let muted=config.muted,face=null,lastSync=0,lastState='',loadTimer,playTimer,retryTimer,startFrame,retryDelay=3000,playbackTimeouts=0,sourceVersion=0;
 let waitStarted=null,retryFailures=0,retryNoticeTimer,lastFailure='';
 let seated=false,sourceStarted=false,effectiveVolume=config.volume;
 const waitLimit=config.retry.waitLimitSeconds*1000;
 const isWaiting=()=>entered&&source==='vod'&&roundPosition(Date.now(),roundStart,0).seconds<0;
 const state=()=>({source,playing:ready&&status==='playing',time:ready?player.getCurrentTime():0,muted,status,error,volume:effectiveVolume,userVolume:Number(volume.value)});
 const emit=()=>{
  label();const value=state(),serialized=JSON.stringify(value);
  if(serialized!==lastState){lastState=serialized;events.dispatchEvent(new CustomEvent(SCREEN_STATE,{detail:value}));}
 };
 const css=new CSS3DRenderer(),cssScene=new THREE.Scene();
 css.domElement.id='arena-screen-layer';cssLayer.append(css.domElement);
 const element=document.createElement('div');element.id='arena-screen-player';
 element.style.cssText=`width:${config.playerWidth}px;height:${config.playerHeight}px;visibility:hidden;background:#000`;
 const object=new CSS3DObject(element);object.element.style.pointerEvents='none';cssScene.add(object);
 const geometry=new THREE.PlaneGeometry(1,1),material=new THREE.MeshBasicMaterial({color:0x000000,opacity:0,blending:THREE.NoBlending});
 const aperture=new THREE.Mesh(geometry,material);aperture.name='ScreenVideoAperture';aperture.renderOrder=1;aperture.visible=false;scene.add(aperture);
 const up=new THREE.Vector3(0,1,0),point=new THREE.Vector3(),direction=new THREE.Vector3(),matrix=new THREE.Matrix4();
 const normals=new THREE.Matrix3(),center=new THREE.Vector3();
 root.updateMatrixWorld(true);
 const screenMesh=createScreenMesh(ctx),meshes=screenMesh.meshes;
 for(const mesh of meshes)center.add(new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3()));
 if(meshes.length)center.multiplyScalar(1/meshes.length);
 const faces=meshes.map(mesh=>{
  const position=new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
  const normal=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,0).applyNormalMatrix(normals.getNormalMatrix(mesh.matrixWorld));
  if(normal.dot(direction.subVectors(position,center))<0)normal.negate();
  const right=new THREE.Vector3().crossVectors(up,normal).normalize(),vertical=new THREE.Vector3().crossVectors(normal,right).normalize();
  let left=Infinity,rightEdge=-Infinity,bottom=Infinity,top=-Infinity;
  const vertices=mesh.geometry.attributes.position;
  for(let i=0;i<vertices.count;i++){
   point.fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld).sub(position);
   const x=point.dot(right),y=point.dot(vertical);left=Math.min(left,x);rightEdge=Math.max(rightEdge,x);bottom=Math.min(bottom,y);top=Math.max(top,y);
  }
  const height=Math.min(top-bottom,(rightEdge-left)*config.aspectRatio[1]/config.aspectRatio[0]),width=height*config.aspectRatio[0]/config.aspectRatio[1];
  position.addScaledVector(normal,.015);
  return {name:mesh.userData.screenFace,position,normal,width,height,quaternion:new THREE.Quaternion().setFromRotationMatrix(matrix.makeBasis(right,vertical,normal))};
 });
 const corners=[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]].map(([x,y])=>new THREE.Vector3(x,y,0));
 const projected=corners.map(()=>new THREE.Vector3());
 let rect={left:0,top:0,right:0,bottom:0,width:0,height:0},width=0,height=0;

 const style=document.createElement('style');style.textContent=`
  #arena-screen-player iframe{width:100%;height:100%;border:0;display:block;pointer-events:none}
  [data-screen-occluded],[data-screen-occluded] *{visibility:hidden!important}
  #arena-screen-controls{position:fixed;left:var(--edge,12px);bottom:var(--edge,12px);z-index:var(--z-hud,auto);box-sizing:border-box;display:flex;align-items:center;gap:var(--space-2,8px);flex-wrap:wrap;max-width:calc(100vw - var(--edge,12px)*2);padding:var(--space-1,4px) var(--space-2,8px);background:rgb(7 18 29/var(--panel-alpha-hud,.92));border:var(--border-width,1px) solid var(--color-border-subtle,#345367);border-radius:var(--radius-md,6px);backdrop-filter:blur(var(--panel-blur,0px));color:var(--color-text,#edf6ff);pointer-events:auto;font:var(--font-size-sm,14px)/1.2 var(--font-family,system-ui)}
  body.walking #arena-screen-controls{opacity:var(--opacity-hud-idle,.72)}
  #arena-screen-controls button{font:inherit;color:inherit}
  #arena-screen-sound{min-width:var(--btn-h,32px);padding-inline:var(--space-1,4px)}
  #arena-screen-controls input{width:calc(var(--space-5,24px)*4);accent-color:var(--color-accent,#7fdcff)}
  #arena-screen-source{color:var(--color-text-muted,#b6cada);white-space:nowrap}
  #arena-screen-notice{color:var(--color-warning,#ffdba1);max-width:430px}
  body.touch #arena-screen-controls{right:var(--edge,12px)}body.touch #arena-screen-controls input{flex:1}body.touch #arena-screen-controls button{min-height:var(--size-target-touch,44px)}
  #settings #arena-screen-controls{position:static;max-width:100%;padding:0;border:0;background:none;backdrop-filter:none;opacity:1}
  #css-layer[data-screen-full]{--bar-h:calc(var(--size-target-touch,44px) + var(--space-1,4px)*2);z-index:2147483646!important;pointer-events:auto!important;background:var(--color-bg,#07101b)}
  #css-layer[data-screen-full] #arena-screen-layer{position:absolute;inset:0;width:100%!important;height:calc(100% - var(--bar-h))!important}
  #css-layer[data-screen-full] #arena-screen-layer>div,#css-layer[data-screen-full] #arena-screen-layer>div>div{transform:none!important;perspective:none!important;width:100%!important;height:100%!important}
  #css-layer[data-screen-full] #arena-screen-player{left:50%;top:50%;transform:translate(-50%,-50%)!important;width:min(100vw,calc((100vh - var(--bar-h))*16/9))!important;height:min(calc(100vw*9/16),calc(100vh - var(--bar-h)))!important;pointer-events:auto!important}
  #css-layer[data-screen-full] iframe{pointer-events:auto}
  #css-layer[data-screen-full] #arena-screen-controls{left:0;right:0;bottom:0;height:var(--bar-h);width:100%;max-width:none;flex-wrap:nowrap;padding:var(--space-1,4px) var(--space-4,16px);border-width:var(--border-width,1px) 0 0;border-radius:0;background:rgb(7 18 29/var(--panel-alpha,.91));opacity:1}
  #css-layer[data-screen-full] #arena-screen-controls button{min-height:var(--size-target-touch,44px)}#css-layer[data-screen-full] #arena-screen-sound{min-width:var(--size-target-touch,44px)}
  #css-layer[data-screen-full] #arena-screen-source,#css-layer[data-screen-full] #arena-screen-notice{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #arena-screen-controls [data-full-state]{margin-left:auto;flex:none;padding:0 var(--space-2,8px);border:var(--border-width,1px) solid var(--color-accent,#7fdcff);border-radius:var(--radius-sm,3px);color:var(--color-accent,#7fdcff);font:var(--font-weight-bold,700) var(--font-size-xs,12px)/var(--size-keycap,20px) var(--font-family,system-ui)}
  #arena-screen-controls #full-mode-close{flex:none;white-space:nowrap;padding-inline:var(--space-4,16px)}
  @media(max-width:650px){
   #css-layer[data-screen-full]{--bar-h:calc(var(--size-keycap,20px) + var(--size-target-touch,44px) + var(--space-1,4px)*3)}
   #css-layer[data-screen-full] #arena-screen-controls{flex-wrap:wrap;align-content:center;row-gap:var(--space-1,4px)}
   #css-layer[data-screen-full] [data-full-state]{order:1;margin-left:0}#css-layer[data-screen-full] #arena-screen-source{order:2;flex:1}#css-layer[data-screen-full] #arena-screen-notice{order:3;flex:none}
   #css-layer[data-screen-full] #arena-screen-controls::after{content:'';order:4;flex-basis:100%}
   #css-layer[data-screen-full] #arena-screen-sound{order:5}#css-layer[data-screen-full] #arena-screen-controls input{order:6;flex:1;min-width:calc(var(--space-5,24px)*2)}#css-layer[data-screen-full] #full-mode-close{order:7}
  }
 `;document.head.append(style);
 const controls=document.createElement('div');controls.id='arena-screen-controls';controls.setAttribute('role','group');controls.setAttribute('aria-label','스크린 영상');
 const sound=document.createElement('button');sound.type='button';sound.id='arena-screen-sound';
 const volume=document.createElement('input');volume.type='range';volume.min='0';volume.max='100';volume.value=config.volume;volume.setAttribute('aria-label','영상 음량');
 const sourceLabel=document.createElement('span');sourceLabel.id='arena-screen-source';
 const notice=document.createElement('span');notice.id='arena-screen-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 const controlsHome=()=>document.querySelector('#settings')||uiRoot;
 controls.append(sound,volume,sourceLabel,notice);controlsHome().append(controls);
 // Write only on change: every text mutation re-runs the overlap collector below.
 const setText=(el,text)=>{if(el.textContent!==text)el.textContent=text;};
 function label(){
  setText(sound,muted?'🔇':'🔊');if(sound.getAttribute('aria-label')!==(muted?'소리 켜기':'소리 끄기'))sound.setAttribute('aria-label',muted?'소리 켜기':'소리 끄기');
  setText(sourceLabel,source==='live'?'지금: 생방송':'지금: 재방');
 }
 const occluded=new Set(),moved=new Set(),KEEP='#arena-screen-controls,#panel,#dock,#emote-menu,#team-select';
 let candidates=[],kept=[];
 const collect=()=>{
  candidates=[...document.body.children,...uiRoot.querySelectorAll('*')].filter(el=>el!==cssLayer&&el!==renderer.domElement&&el!==uiRoot&&!['SCRIPT','STYLE','LINK','OPTION'].includes(el.tagName));
  kept=candidates.filter(el=>el.matches(KEEP)&&!el.closest('#settings'));
  for(const el of occluded)if(!candidates.includes(el)){el.removeAttribute('data-screen-occluded');occluded.delete(el);}
  for(const el of moved)if(!kept.includes(el)){el.style.removeProperty('translate');moved.delete(el);}
 };
 const observer=new MutationObserver(collect);observer.observe(document.body,{childList:true,subtree:true});collect();
 const hits=box=>box.width>0&&box.height>0&&Math.min(box.right,rect.right)>Math.max(box.left,rect.left)&&Math.min(box.bottom,rect.bottom)>Math.max(box.top,rect.top);
 // T31 R-2 / E-W8: the control bar, entry panel, action dock and emote menu move just above, below, right or left of the player
 // instead of hiding (legal S-2 still forbids covering it); they hide only when none of those fits on screen.
 function keepClear(el,show){
  const [sx=0,sy=0]=moved.has(el)?el.style.translate.split(' ').map(parseFloat):[],box=el.getBoundingClientRect();
  const home={left:box.left-sx,right:box.right-sx,top:box.top-sy,bottom:box.bottom-sy,width:box.width,height:box.height};
  let next=[0,0];
  if(show&&hits(home)){
   const gap=8,up=rect.top-gap-home.bottom,down=rect.bottom+gap-home.top,right=rect.right+gap-home.left,left=rect.left-gap-home.right;
   next=home.top+up>=0?[0,up]:home.bottom+down<=innerHeight?[0,down]:home.right+right<=innerWidth?[right,0]:home.left+left>=0?[left,0]:null;
   if(next)next=next.map(Math.round); // whole pixels: layout snapping would otherwise re-shift the element every frame
  }
  if(next===null){el.setAttribute('data-screen-occluded','');occluded.add(el);next=[0,0];}
  else if(occluded.delete(el))el.removeAttribute('data-screen-occluded');
  if(Math.abs(next[0]-sx)>=1||Math.abs(next[1]-sy)>=1||(!next[0]&&!next[1]&&(sx||sy))){if(next[0]||next[1]){el.style.translate=`${next[0]}px ${next[1]}px`;moved.add(el);}else{el.style.removeProperty('translate');moved.delete(el);}}
 }
 function hideOverlaps(show){
  for(const el of kept)keepClear(el,show);
  for(const el of candidates){
   if(kept.some(parent=>parent===el||parent.contains(el)))continue;
   const box=el.getBoundingClientRect();
   // Full-viewport layers carry independently positioned labels; check their descendants instead.
   const viewportLayer=el.childElementCount>0&&box.width>=innerWidth&&box.height>=innerHeight;
   const overlap=show&&!viewportLayer&&hits(box);
   if(overlap){el.setAttribute('data-screen-occluded','');occluded.add(el);}
   else if(occluded.delete(el))el.removeAttribute('data-screen-occluded');
  }
 }
 function display(){
  // A picker may not fit beside the seated video; keep its controls usable and the video unobscured.
  const pickerOpen=!!document.querySelector('#team-select:not([hidden])');
  const show=entered&&eligible&&hasImage&&!error&&status!=='ended'&&status!=='waiting'&&!pickerOpen;
  aperture.visible=show&&!fullMode;element.style.visibility=show?'visible':'hidden';
  hideOverlaps(show&&inView);
 }
 function fallback(message,kind='error'){
  clearTimeout(retryTimer);clearTimeout(retryNoticeTimer);clearTimeout(playTimer);playTimer=null;clearTimeout(loadTimer);cueing=false;starting=false;hasImage=false;error=message;status=kind;
  if(ready)player.pauseVideo();
  notice.textContent=message;notice.hidden=false;display();emit();
 }
 function resetRetry(){clearTimeout(retryNoticeTimer);waitStarted=null;retryFailures=0;lastFailure='';retryDelay=3000;playbackTimeouts=0;}
 function showRetryNotice(){
  if(retryFailures<config.retry.noticeFromFailure)return;
  const expired=performance.now()-waitStarted>=waitLimit;
  notice.textContent=expired?'연결이 원활하지 않아 계속 다시 시도합니다.':`다시 연결 중… ${lastFailure} 잠시 후 자동으로 다시 연결합니다.`;
  notice.hidden=false;if(expired){hasImage=false;display();}
 }
 function fallbackLive(){
  if(source!=='live'||slot?.source!=='live'||scheduledFallback)return false;
  scheduledFallback=true;setSource(config.liveFallback);return true;
 }
 function retry(message,playbackTimeout=false){
  if(fallbackLive())return;
  waitStarted??=performance.now();retryFailures++;lastFailure=message;
  fallback(message+' 잠시 후 자동으로 다시 연결합니다.');
  if(disposed)return;
  showRetryNotice();
  if(performance.now()-waitStarted<waitLimit)retryNoticeTimer=setTimeout(showRetryNotice,Math.ceil(waitLimit-(performance.now()-waitStarted)));
  if(playbackTimeout&&++playbackTimeouts>2)ready=false; // Initial stall plus two failed reconnects: replace the player.
  retryTimer=setTimeout(loadSource,retryDelay);retryDelay=Math.min(retryDelay*2,config.retry.maxIntervalSeconds*1000);
 }
 function advanceRound(value){
  if(!Number.isFinite(value)||value<=roundStart)return;
  roundStart=value;
  if(source==='vod'){
   if(status==='ended'){error=null;hasImage=false;status='ready';notice.hidden=true;}
   if(sync(true))startPlayback(true);emit();
  }
 }
 function endRound(){
  fallback('이 회차의 영상이 끝났습니다. 다음 회차를 기다리고 있습니다.','ended');
  if(!inRoom)advanceRound(currentRound());
 }
 function sync(force=false){
  if(isWaiting()){waitForRound();return false;}
  if(!ready||cueing||source!=='vod')return true;
  const position=roundPosition(Date.now(),roundStart,player.getDuration());
  if(position.ended){endRound();return false;}
  // start/cue already carries the offset; defer correction until the first PLAYING event.
  if(!sourceStarted)return true;
  if(force||Math.abs(player.getCurrentTime()-position.seconds)>config.syncToleranceSeconds)player.seekTo(position.seconds,true);
  return true;
 }
 function waitForRound(){
  if(error)return;
  clearTimeout(playTimer);playTimer=null;starting=false;
  if(!retryFailures)waitStarted=null;
  const changed=status!=='waiting';status='waiting';hasImage=false;notice.hidden=true;
  if(changed&&ready)player.pauseVideo();
  display();emit();
 }
 function startPlayback(synced=false){
  if(!entered)return;
  if(isWaiting()){waitForRound();return;}
  if(!ready||cueing||!eligible||error||starting||status==='playing'||status==='buffering')return;
  if(!synced&&!sync())return;
  starting=true;status='loading';waitStarted??=performance.now();
  clearTimeout(playTimer);playTimer=setTimeout(()=>{if(!muted&&status!=='buffering')audioBlocked();else retry(source==='live'?'방송이 없거나 연결이 지연되고 있습니다.':'영상 연결이 지연되고 있습니다.',true);},15000);
  player.playVideo();emit();
 }
 function onStateChange(event){
  if(disposed||event.target!==player)return;
  if(isWaiting()){
   if(event.data===5){clearTimeout(loadTimer);cueing=false;}
   waitForRound();if(event.data===1)player.pauseVideo();return;
  }
  if(error){if(event.data===1)player.pauseVideo();display();return;}
  // The previous video can still emit states while the next cue is loading.
  if(cueing&&event.data!==5)return;
  if(event.data===1){
   if(!eligible){player.pauseVideo();return;}
   clearTimeout(playTimer);playTimer=null;resetRetry();starting=false;hasImage=true;sourceStarted=true;status='playing';notice.hidden=true;
   if(!sync())return;
  }else if(event.data===0){if(source==='vod')endRound();else if(!fallbackLive())fallback('방송이 종료되었거나 현재 방송이 없습니다.','ended');return;}
  // YouTube can report PAUSED while a seek/play request is still starting.
  else if(event.data===2){if(starting&&eligible)return;starting=false;status=eligible?'paused':'hidden';startPlayback();}
  else if(event.data===3){status='buffering';waitStarted??=performance.now();if(!playTimer)playTimer=setTimeout(()=>retry('영상 연결이 지연되고 있습니다.',true),15000);}
  else if(event.data===5){clearTimeout(loadTimer);cueing=false;starting=false;status='ready';startPlayback();}
  display();emit();
 }
 function playerEvents(){return {
  onReady(event){
   if(disposed||event.target!==player||error)return;
   clearTimeout(loadTimer);ready=true;cueing=false;applyVolume(true);muted?player.mute():player.unMute();
   status='ready';if(retryFailures)showRetryNotice();else{notice.hidden=true;if(!eligible)waitStarted=null;}startPlayback();emit();
  },
  onStateChange,
  onError(event){
   if(disposed||event.target!==player)return;
   const reason=[101,150].includes(event.data)?'이 영상은 외부 재생이 허용되지 않습니다.':event.data===100?'영상을 찾을 수 없거나 현재 방송이 없습니다.':event.data===153?'유튜브가 사이트 출처를 확인하지 못했습니다. HTTP 서버로 열어 주세요.':'유튜브 영상을 재생할 수 없습니다.';
   const message=`${reason} (YouTube ${event.data})`;
   if(event.data===5){
    if(ready){error=message;player.pauseVideo();}
    ready=false; // Recreate the failed HTML5 player on the next retry.
    retry(message);
   }else if(!fallbackLive())fallback(message);
  },
  onAutoplayBlocked(event){if(!disposed&&event.target===player)audioBlocked();}
 };}
 function audioBlocked(){
  clearTimeout(playTimer);playTimer=null;starting=false;
  if(muted){fallback('','blocked');notice.hidden=true;return;}
  status='ready';error=null;notice.hidden=true;setMuted(true);startPlayback();
 }
 async function loadSource(){
  if(!entered||disposed)return;
  const version=++sourceVersion,info=sourceInfo(config[source]);
  cancelAnimationFrame(startFrame);clearTimeout(retryTimer);
  clearTimeout(playTimer);playTimer=null;clearTimeout(loadTimer);cueing=true;starting=false;sourceStarted=false;hasImage=false;error=null;status=isWaiting()?'waiting':'loading';display();
  waitStarted??=performance.now();
  if(!info){if(!fallbackLive())fallback('영상 주소가 없거나 올바른 유튜브 주소가 아닙니다.');return;}
  if(retryFailures)showRetryNotice();else{notice.textContent='유튜브 연결 중…';notice.hidden=isWaiting();}emit();
  try{
   const YT=await loadYouTube();if(disposed||version!==sourceVersion)return;
   const seconds=source==='vod'?Math.max(0,Math.floor(roundPosition(Date.now(),roundStart,0).seconds)):0;
   loadTimer=setTimeout(()=>retry('유튜브를 불러오지 못했습니다. 네트워크 연결을 확인해 주세요.',playbackTimeouts>0),15000);
   if(ready&&info.id){player.cueVideoById({videoId:info.id,startSeconds:seconds});return;}
   if(player)player.destroy();ready=false;
   const target=document.createElement(info.channel?'iframe':'div');element.replaceChildren(target);
   const playerVars={autoplay:0,controls:1,playsinline:1,enablejsapi:1,origin:location.origin,start:seconds};
   if(info.channel){
    const url=new URL('https://www.youtube.com/embed/live_stream');url.search=new URLSearchParams({...playerVars,channel:info.channel});target.src=url.href;
    target.allow='autoplay; encrypted-media; fullscreen; picture-in-picture';target.allowFullscreen=true;
   }
   player=new YT.Player(target,{width:config.playerWidth,height:config.playerHeight,videoId:info.id,playerVars,events:playerEvents()});
   const iframe=player.getIframe();iframe.title=source==='vod'?'경기장 재방 영상':'경기장 생방송';iframe.setAttribute('allow','autoplay; encrypted-media; fullscreen; picture-in-picture');iframe.setAttribute('allowfullscreen','');
  }catch(reason){if(!disposed&&version===sourceVersion)retry(reason.message);}
 }
 function setSource(value){if(!['vod','live'].includes(value))return;source=value;resetRetry();loadSource();emit();}
 function play(){retryDelay=3000;if(error){loadSource();}else startPlayback();emit();}
 function pause(){clearTimeout(playTimer);playTimer=null;starting=false;if(ready)player.pauseVideo();emit();}
 function setMuted(value){muted=Boolean(value);if(ready)muted?player.mute():player.unMute();emit();}
 function applyVolume(force=false){
  const {nearMeters,farMeters,farRatio}=config.distanceVolume;
  const distance=ctx.player.position.distanceTo(center);
  const ratio=seated||fullMode?1:1-(1-farRatio)*Math.max(0,Math.min(1,(distance-nearMeters)/(farMeters-nearMeters)));
  // YouTube takes integer levels; keep a nonzero slider audible at a distance.
  const level=Number(volume.value),amount=level?Math.max(1,Math.round(level*ratio)):0;
  if(!force&&amount===effectiveVolume)return;
  effectiveVolume=amount;if(ready)player.setVolume(amount);emit();
 }
 function resumeFromGesture(){
  if(status==='blocked'){error=null;status='ready';notice.hidden=true;}
  startPlayback();
 }
 function setVolume(value){const amount=Number(value);if(!Number.isFinite(amount))return;volume.value=Math.max(0,Math.min(100,amount));applyVolume();setMuted(Number(volume.value)===0);resumeFromGesture();}
 volume.oninput=()=>setVolume(volume.value);
 // UX-H-R03: muting keeps the slider; turning sound on from a zero slider restores the configured volume.
 sound.onclick=()=>{if(muted&&Number(volume.value)===0){volume.value=config.volume;applyVolume();}setMuted(!muted);resumeFromGesture();};
 const enter=event=>{
  if(entered||disposed)return;entered=true;
  if(!inRoom)roundStart=Number.isSafeInteger(event.detail?.showtime)?event.detail.showtime:currentRound();
  if(config.unmuteOnEnter)setMuted(false);
  if(isWaiting())waitForRound();
  // Let the first arena render upload textures before starting network timeout clocks.
  if(faces.length===4)startFrame=requestAnimationFrame(()=>{loadTimer=setTimeout(loadSource,0);});else fallback('경기장 스크린 네 면을 찾지 못했습니다.');
 };
 events.addEventListener(APP_ENTER,enter);
 function setFull(value){
  if(fullMode===value)return;
  fullMode=value;applyVolume();cssLayer.toggleAttribute('data-screen-full',value);
  (value?cssLayer:controlsHome()).append(controls);collect();
  events.dispatchEvent(new Event(value?FULLMODE_ENTER:FULLMODE_EXIT));
 }
 function enterFullMode(){
  if(disposed||fullMode)return;setFull(true);
  // A rejected Fullscreen request keeps the same player in the viewport fallback.
  try{cssLayer.requestFullscreen?.()?.catch(()=>{});}catch{}
 }
 function exitFullMode(){
  setFull(false);if(document.fullscreenElement===cssLayer)document.exitFullscreen().catch(()=>{});
 }
 const fullscreenChange=()=>{if(fullMode&&!document.fullscreenElement)setFull(false);};document.addEventListener('fullscreenchange',fullscreenChange);
 const joined=event=>{
  if(!Number.isFinite(event.detail?.roundStart))return;
  const changed=roundStart!==event.detail.roundStart;
  roundStart=event.detail.roundStart;inRoom=true;
  if(source==='vod'){
   if(status==='ended'){error=null;hasImage=false;status='ready';}
   if(sync(changed))startPlayback(true);emit();
  }
 };
 const left=()=>{inRoom=false;};
 const round=event=>{if(inRoom)advanceRound(event.detail?.roundStart);};
 const sit=()=>{seated=true;applyVolume();},stand=()=>{seated=false;applyVolume();};
 events.addEventListener(ROOM_JOINED,joined);events.addEventListener(ROOM_LEFT,left);events.addEventListener(ROOM_ROUND,round);
 events.addEventListener(SEAT_ENTER,sit);events.addEventListener(SEAT_EXIT,stand);
 const previousRender=scene.onBeforeRender;
 function beforeRender(...args){
  previousRender?.apply(scene,args);
  if(disposed)return;
  const viewport=renderer.domElement.getBoundingClientRect();
  if(width!==viewport.width||height!==viewport.height){width=viewport.width;height=viewport.height;css.setSize(width,height);}
  camera.updateMatrixWorld(true);
  let best=faces.find(candidate=>candidate.name===config.videoFace),score=-Infinity;
  if(seated)for(const candidate of faces){const facing=direction.subVectors(camera.position,candidate.position).normalize().dot(candidate.normal);if(facing>score){best=candidate;score=facing;}}
  let visible=false;inView=false;
  if(best){
   face=best.name;screenMesh.setVideoFace(face);aperture.position.copy(best.position);aperture.quaternion.copy(best.quaternion);aperture.scale.set(best.width,best.height,1);aperture.updateMatrixWorld(true);
   object.position.copy(best.position);object.quaternion.copy(best.quaternion);object.scale.set(best.width/config.playerWidth,best.height/config.playerHeight,1);
   if(!fullMode){
    css.render(cssScene,camera);
    for(let i=0;i<4;i++)projected[i].copy(corners[i]).applyMatrix4(aperture.matrixWorld).project(camera);
    rect.left=Infinity;rect.top=Infinity;rect.right=-Infinity;rect.bottom=-Infinity;
    for(const p of projected){const x=(p.x+1)*width/2+viewport.left,y=(1-p.y)*height/2+viewport.top;rect.left=Math.min(rect.left,x);rect.right=Math.max(rect.right,x);rect.top=Math.min(rect.top,y);rect.bottom=Math.max(rect.bottom,y);}
    rect.width=rect.right-rect.left;rect.height=rect.bottom-rect.top;
    const area=Math.max(0,Math.min(rect.right,viewport.right)-Math.max(rect.left,viewport.left))*Math.max(0,Math.min(rect.bottom,viewport.bottom)-Math.max(rect.top,viewport.top));
    inView=direction.subVectors(camera.position,best.position).dot(best.normal)>0&&projected.every(p=>p.z>-1&&p.z<1)&&area>0;
    visible=inView&&area>rect.width*rect.height*.5;
   }
  }
  if(fullMode){const box=element.getBoundingClientRect();rect={left:box.left,top:box.top,right:box.right,bottom:box.bottom,width:box.width,height:box.height};visible=true;inView=true;}
  // Use the app's lobby boundary and indoor bounds; keep the outside visibility rule.
  const position=ctx.player.position,bounds=config.arenaBounds,inArena=position.x>=bounds.minX&&position.x<bounds.maxX&&Math.abs(position.z)<bounds.maxAbsZ;
  applyVolume();
  const next=entered&&(inArena||(visible&&rect.width>=config.minimumVisiblePixels&&rect.height>=config.minimumVisiblePixels));
  if(next!==eligible){
   eligible=next;
   if(!eligible){starting=false;clearTimeout(playTimer);playTimer=null;if(ready)player.pauseVideo();}
   else startPlayback();
  }
  display();
 }
 scene.onBeforeRender=beforeRender;
 // A hidden tab (Alt+Tab, another window on top) keeps playing: the picture and sound go on (사용자 2026-11-14).
 const api={get state(){return state();},get source(){return source;},get schedule(){return {source:playbackSource(),slot:slot?{...slot}:null,fallback:scheduledFallback};},get face(){return face;},get faces(){return faces.map(({name,position,normal,width,height})=>({name,position:position.toArray(),normal:normal.toArray(),width,height}));},get roundStart(){return roundStart;},get fullMode(){return fullMode;},element,fullModeElement:cssLayer,controlsElement:controls,enterFullMode,exitFullMode,setSource,play,pause,setMuted,setVolume};
 window.arena.screen=api;
 emit();
 return {
  update(dt,now){
   if(disposed)return;
   const time=Date.now(),nextSlot=slotAt(time);
   if(nextSlot!==slot||slots.some(s=>s.from>scheduleTime&&s.from<=time||s.to>scheduleTime&&s.to<=time)){
    slot=nextSlot;scheduledFallback=false;scheduleTime=time;setSource(playbackSource());
   }
   scheduleTime=time;
   if(!entered)return;
   if(status==='waiting'&&!isWaiting()){status='ready';startPlayback();emit();}
   if(now-lastSync<config.syncIntervalSeconds*1000)return;lastSync=now;
   if(!inRoom&&status==='ended'){const next=currentRound();if(next!==roundStart)advanceRound(next);}
   if(ready){muted=player.isMuted();if(eligible&&!error&&status==='playing')sync();}startPlayback();emit();
  },
  dispose(){
   if(disposed)return;exitFullMode();disposed=true;cancelAnimationFrame(startFrame);clearTimeout(loadTimer);clearTimeout(playTimer);clearTimeout(retryTimer);clearTimeout(retryNoticeTimer);
   events.removeEventListener(ROOM_JOINED,joined);events.removeEventListener(ROOM_LEFT,left);events.removeEventListener(ROOM_ROUND,round);events.removeEventListener(APP_ENTER,enter);
   events.removeEventListener(SEAT_ENTER,sit);events.removeEventListener(SEAT_EXIT,stand);
   document.removeEventListener('fullscreenchange',fullscreenChange);
   observer.disconnect();for(const el of occluded)el.removeAttribute('data-screen-occluded');for(const el of moved)el.style.removeProperty('translate');
   if(scene.onBeforeRender===beforeRender)scene.onBeforeRender=previousRender;
   player?.destroy();screenMesh.dispose();aperture.removeFromParent();geometry.dispose();material.dispose();object.removeFromParent();css.domElement.remove();controls.remove();style.remove();
   if(window.arena.screen===api)delete window.arena.screen;
  }
 };
}
