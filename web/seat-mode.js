import {INPUT_ACTION,SEAT_ENTER,SEAT_EXIT,WORLD_CLICK,HUD_TOAST,PEER_STATE} from './events.js';

// Seat UI: docs/live/product/ux/seat.md, docs/live/graphicmodel/ui/seat.md (T30). Seat search and the seated camera are T30s (BL-0033).
export function create(ctx){
 const {THREE,root,player,cameraRig,input,events,uiRoot}=ctx,config=ctx.config('seats'),controls=ctx.config('controls');
 const seats=config.seats.map(seat=>({...seat,point:new THREE.Vector3(...seat.position)}));
 const token=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
 // White ink is tinted by the sprite colour: empty seats color-accent, the near seat color-text + an "E" keycap.
 function badge(key){
  const canvas=document.createElement('canvas');canvas.width=key?352:288;canvas.height=128;
  const ink=canvas.getContext('2d');
  ink.fillStyle=token('--color-panel')||'#07121d';ink.strokeStyle='#ffffff';ink.lineWidth=5;
  ink.beginPath();ink.roundRect(5,5,278,87,14);ink.fill();ink.stroke();
  ink.fillStyle='#ffffff';ink.beginPath();ink.moveTo(132,95);ink.lineTo(156,95);ink.lineTo(144,114);ink.fill();
  ink.beginPath();ink.moveTo(28,24);ink.lineTo(28,61);ink.lineTo(68,61);ink.moveTo(34,61);ink.lineTo(34,77);ink.moveTo(62,61);ink.lineTo(62,77);ink.stroke();
  ink.font='bold 48px system-ui,sans-serif';ink.textBaseline='middle';ink.fillText('빈 좌석',85,49);
  if(key){
   ink.fillStyle=token('--color-panel')||'#07121d';ink.beginPath();ink.roundRect(291,22,54,54,8);ink.fill();ink.stroke();
   ink.fillStyle='#ffffff';ink.textAlign='center';ink.fillText('E',318,51);
  }
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
 }
 const texture=badge(false),nearTexture=badge(true);
 const markerMaterial=new THREE.SpriteMaterial({map:texture,color:token('--color-accent')||0x7fdcff,sizeAttenuation:false,depthWrite:false,toneMapped:false});
 const nearMaterial=new THREE.SpriteMaterial({map:nearTexture,color:token('--color-text')||0xedf6ff,sizeAttenuation:false,depthWrite:false,toneMapped:false});
 const markers=new THREE.Group();markers.name='SeatMarkers';ctx.scene.add(markers);
 for(const seat of seats){
  seat.marker=new THREE.Sprite(markerMaterial);seat.marker.name=seat.id;seat.marker.center.set(.5,0);
  seat.marker.position.copy(seat.point).y+=1.7;markers.add(seat.marker);
 }
 const faces=window.arena.screen.faces.map(face=>({...face,position:new THREE.Vector3(...face.position),normal:new THREE.Vector3(...face.normal)}));
 const screen=new THREE.Box3(),bounds=new THREE.Box3(),target=new THREE.Vector3(),direction=new THREE.Vector3();
 for(let i=0;i<4;i++){
  const face=root.getObjectByName('REF_Jumbotron_'+i);
  if(face)screen.union(bounds.setFromObject(face));
 }
 if(!screen.isEmpty())screen.getCenter(target);
 // Key hints stay in the top-right box; the nearby seat action stays at the bottom.
 const style=document.createElement('style');
 style.textContent=`#seat-toggle{position:fixed;left:50%;bottom:var(--space-5);transform:translateX(-50%);background:var(--color-accent);border-color:var(--color-accent);color:var(--color-text-on-accent);font-weight:var(--font-weight-bold)}
body.touch #seat-toggle{min-height:var(--size-target-touch);bottom:calc(var(--tier2-bottom) + var(--size-target-touch)*2 + var(--space-2) + var(--space-3))}
#dock>#seat-toggle{position:static;transform:none;order:1;background:var(--color-panel-raised);border-color:var(--color-border);color:var(--color-text);font-weight:var(--font-weight-regular)}
#hud-keys #seat-hint:not([hidden]){display:flex;color:var(--color-accent)}
#hud-keys #seat-hint[hidden]{display:none}`;
 const button=document.createElement('button');button.id='seat-toggle';button.type='button';button.hidden=true;
 button.setAttribute('aria-keyshortcuts',controls.sit.map(code=>code.replace(/^Key/,'')).join(' '));
 const hint=document.createElement('span');hint.id='seat-hint';hint.className='k';hint.hidden=true;hint.innerHTML='<kbd>E</kbd>앉기';
 uiRoot.append(style,button);
 document.querySelector('#hud-keys')?.prepend(hint);
 const canvas=ctx.renderer.domElement,cursor=canvas.style.cursor,raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
 const screenPlane=new THREE.Plane(),screenHit=new THREE.Vector3(),screenRight=new THREE.Vector3(),screenUp=new THREE.Vector3();
 let seated=null,flying=null,claimed=null,automatic=false,hovered=null,returnPose=null,returnZoom=1,temporaryPose=[],disposed=false,shown='';
 const positions=()=>ctx.multiplayer.unclaimedPositions??ctx.multiplayer.positions;
 function claim(seat){claimed=seat;ctx.multiplayer.claimSeat?.(seat?.id??null);}
 // Concurrent claims converge on the smaller peer id, regardless of message arrival order.
 function claimedByOther(seat){return (ctx.multiplayer.peers??[]).some(p=>p.seatClaim===seat.id&&(claimed!==seat||p.peerId<ctx.multiplayer.peerId));}
 function occupied(seat,peers){return claimedByOther(seat)||peers.some(p=>Math.abs(p[1]-seat.point.y)<1&&Math.hypot(p[0]-seat.point.x,p[2]-seat.point.z)<.55);}
 function nearest(peers=positions(),distance=config.interactionDistance**2){
  if(!faces.length)return null;
  let result=null;
  for(const seat of seats){
   const next=player.position.distanceToSquared(seat.point);
   if(next>=distance||occupied(seat,peers))continue;
   result=seat;distance=next;
  }
  return result;
 }
 // P-L-2: runs every frame, but touches markers and DOM only when what they show changes.
 function prompt(){
  const peers=positions(),near=nearest(peers);
  const free=seats.map(seat=>!seated&&!flying&&faces.length>0&&!occupied(seat,peers));
  if(hovered&&!free[seats.indexOf(hovered)])hovered=null;
  const next=[seated?.id,flying?.id,near?.id,hovered?.id,...free].join();
  if(next===shown)return;
  shown=next;
  canvas.style.cursor=hovered?'pointer':cursor;
  seats.forEach((seat,i)=>{
   const active=seat===near||seat===hovered;
   seat.marker.visible=free[i];
   seat.marker.material=active?nearMaterial:markerMaterial;
   seat.marker.scale.set(active?.145*352/288:.145,.0644,1).multiplyScalar(active?1.2:1);
  });
  (seated?document.querySelector('#dock')??uiRoot:uiRoot).append(button);
  button.hidden=!!flying||(!seated&&!near);hint.hidden=button.hidden;
  button.textContent=seated?'일어나기':'앉기';hint.lastChild.textContent=seated?'일어나기':'앉기';
  button.setAttribute('aria-pressed',String(!!seated));
 }
 function sit(seat){
  if(occupied(seat,positions())){missed();return;}
  claim(seat);
  let face=faces[0],score=-Infinity;
  for(const candidate of faces){
   const facing=direction.subVectors(seat.point,candidate.position).normalize().dot(candidate.normal);
   if(facing>score){face=candidate;score=facing;}
  }
  returnPose=[...seat.standPosition,player.avatar.rotation.y];
  returnZoom=ctx.camera.zoom;
  seated=seat;
  player.teleport([...seat.position,Math.atan2(seat.point.x-target.x,seat.point.z-target.z)]);
  player.setLocked(true);
  // The capsule is temporary; character.js owns Sit once the rig replaces it (T37).
  const parts=player.avatar.children;
  if(parts.length===5&&parts[0].geometry?.type==='CapsuleGeometry'){
   temporaryPose=parts.map(part=>({part,position:part.position.clone(),rotation:part.rotation.clone(),scale:part.scale.clone()}));
   parts[0].scale.y=.65;parts[0].position.y=.81;
   parts[1].position.y=1.38;parts[2].position.y=1.40;
   for(const leg of parts.slice(3)){leg.rotation.x=Math.PI/2;leg.position.y=.48;leg.position.z=-.32;}
  }
  const distance=Math.min(35,Math.hypot(seat.point.x-face.position.x,seat.point.z-face.position.z));
  cameraRig.setOverride(camera=>{
   // The pulled-forward camera must stay above the bowl chairs even for lower rows.
   camera.position.copy(face.position).addScaledVector(face.normal,distance);camera.position.y=Math.max(config.camera.minEyeY,seat.point.y+config.camera.eyeHeight);
   camera.lookAt(face.position);player.avatar.visible=false;
   // Keep the HUD margin and fit portrait screens without moving behind the bowl.
   const fit=Math.max(face.width/(camera.aspect*config.camera.screenFill),face.height/Math.min(config.camera.screenFill,.64));
   const zoom=2*distance*Math.tan(THREE.MathUtils.degToRad(config.camera.fov)/2)/fit;
   if(camera.fov!==config.camera.fov||camera.zoom!==zoom){camera.fov=config.camera.fov;camera.zoom=zoom;camera.updateProjectionMatrix();}
  });
  events.dispatchEvent(new CustomEvent(SEAT_ENTER,{detail:{seatId:seat.id}}));
  // A fixed seated camera ignores movement until the user stands up.
  input.releasePointer();prompt();
 }
 function stand(restore=true){
  if(!seated)return;
  if(restore){
   const distance=p=>(p[0]-seated.point.x)**2+(p[1]-seated.point.y)**2+(p[2]-seated.point.z)**2;
   const points=seats.map(seat=>seat.standPosition).sort((a,b)=>distance(a)-distance(b));
   const free=points.map(p=>player.standingAt(p[0],p[2],p[1])).find(Boolean);
   if(!free){events.dispatchEvent(new CustomEvent(HUD_TOAST,{detail:{text:'일어설 통로가 막혀 있어요',tone:'warning'}}));return false;}
   returnPose=[...free,returnPose[3]];
  }
  seated=null;automatic=false;
  for(const {part,position,rotation,scale} of temporaryPose){part.position.copy(position);part.rotation.copy(rotation);part.scale.copy(scale);}
  temporaryPose=[];
  if(restore){
   const held=[...input.keys];player.teleport(returnPose);
   for(const code of held)input.keys.add(code);
  }
  returnPose=null;player.setLocked(false);ctx.camera.zoom=returnZoom;cameraRig.setOverride(null);player.avatar.visible=true;
  if(!disposed&&!window.arena.screen.fullMode)input.capturePointer();
  events.dispatchEvent(new CustomEvent(SEAT_EXIT));claim(null);prompt();
  return true;
 }
 function toggle(){
  if(disposed||flying||window.arena.screen.fullMode)return;
  if(seated)stand();else{const seat=nearest();if(seat)sit(seat);}
 }
 const movement=['forward','backward','left','right'];
 // The cursor is free while seated, so input.js does not take movement keys: catch them here (UX-S-R05).
 const key=e=>{
  if(!seated||window.arena.screen.fullMode||e.target.matches?.('input,textarea'))return;
  const walking=movement.some(action=>controls[action].includes(e.code));
  if(!walking&&e.code!=='Escape')return;
  if(stand()&&walking)input.keys.add(e.code);
 };
 const action=e=>{if(e.detail.action==='sit'&&e.detail.down)toggle();};
 function hitSeat(){
  markers.updateMatrixWorld(true);raycaster.camera=ctx.camera;
  const hit=raycaster.intersectObjects(markers.children.filter(marker=>marker.visible),false)[0];
  return seats.find(seat=>seat.marker===hit?.object&&!occupied(seat,positions()))??null;
 }
 function hitScreen(){
  for(const face of faces){
   screenPlane.setFromNormalAndCoplanarPoint(face.normal,face.position);
   if(!raycaster.ray.intersectPlane(screenPlane,screenHit))continue;
   screenRight.set(face.normal.z,0,-face.normal.x).normalize();screenUp.crossVectors(face.normal,screenRight).normalize();
   screenHit.sub(face.position);
   if(Math.abs(screenHit.dot(screenRight))<=face.width/2&&Math.abs(screenHit.dot(screenUp))<=face.height/2)return true;
  }
  return false;
 }
 function fly(seat,fromScreen){
  automatic=fromScreen;flying=seat;claim(seat);prompt();
  player.flyTo([...seat.position,Math.atan2(seat.point.x-target.x,seat.point.z-target.z)],config.clickSit.flightSeconds).then(landed=>{
   if(disposed)return;
   flying=null;
   if(landed!==false)sit(seat);else{automatic=false;claim(null);prompt();}
  });
 }
 function missed(){
  const retry=automatic;
  if(seated)stand(false);
  automatic=false;claim(null);
  const next=retry?nearest(positions(),Infinity):null;
  if(next){fly(next,true);return;}
  events.dispatchEvent(new CustomEvent(HUD_TOAST,{detail:retry?{text:'빈 좌석이 없어요',tone:'warning',ms:2000}:{text:'다른 사람이 먼저 앉았어요',tone:'warning'}}));prompt();
 }
 const reconcile=()=>{if(!disposed&&seated&&claimedByOther(seated))missed();};
 function click(e){
  if(disposed||seated||flying||!input.walking||window.arena.screen.fullMode)return;
  raycaster.ray.origin.fromArray(e.detail.ray.origin);raycaster.ray.direction.fromArray(e.detail.ray.direction);
  let seat=hitSeat();const fromScreen=!seat;
  if(!seat){if(!hitScreen())return;seat=nearest(positions(),Infinity);}
  e.preventDefault();
  if(!seat){events.dispatchEvent(new CustomEvent(HUD_TOAST,{detail:{text:'빈 좌석이 없어요',tone:'warning',ms:2000}}));return;}
  fly(seat,fromScreen);
 }
 const hover=e=>{
  hovered=null;
  if(!e.buttons&&!seated&&!flying&&input.walking&&!window.arena.screen.fullMode){
   const rect=canvas.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2);
   raycaster.setFromCamera(pointer,ctx.camera);hovered=hitSeat();
  }
  prompt();
 };
 const leave=()=>{hovered=null;prompt();};
 events.addEventListener(WORLD_CLICK,click);canvas.addEventListener('pointermove',hover);canvas.addEventListener('pointerleave',leave);
 events.addEventListener(INPUT_ACTION,action);button.addEventListener('click',toggle);document.addEventListener('keydown',key);
 events.addEventListener(PEER_STATE,reconcile);
 const api={get seatId(){return seated?.id??null;}};window.arena.seat=api;
 prompt();
 return {
  update(){
   if(disposed)return;
   if(seated){
    if(player.position.distanceToSquared(seated.point)>.01)stand(false);
    else if(!window.arena.screen.fullMode&&movement.some(action=>input.down(action)))stand();
   }
   prompt();
  },
  dispose(){
   if(disposed)return;
   disposed=true;stand();claim(null);events.removeEventListener(PEER_STATE,reconcile);events.removeEventListener(INPUT_ACTION,action);button.removeEventListener('click',toggle);document.removeEventListener('keydown',key);
   events.removeEventListener(WORLD_CLICK,click);canvas.removeEventListener('pointermove',hover);canvas.removeEventListener('pointerleave',leave);canvas.style.cursor=cursor;
   button.remove();hint.remove();style.remove();
   markers.removeFromParent();texture.dispose();nearTexture.dispose();markerMaterial.dispose();nearMaterial.dispose();
   if(window.arena.seat===api)delete window.arena.seat;
  },
 };
}
