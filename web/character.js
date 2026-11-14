import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {clone} from './vendor/SkeletonUtils.js';
import {APP_ENTER,SCREEN_STATE,FULLMODE_ENTER,TEAM_CHANGED,CHARACTER_CHANGED,PEER_STATE,ROOM_LEFT,EMOTE_REQUEST,EMOTE_PLAYED,SEAT_ENTER,SEAT_EXIT} from './events.js';

const emotes={cheer_clap:'Emote_CheerClap',heart:'Emote_Heart',angry:'Emote_Angry',egg_throw:'Emote_EggThrow'};
const heartSounds=['heart-pop_01.mp3','heart-pop_02.mp3','heart-pop_03.mp3'];
const sounds={
 cheer_clap:{files:['cheer-clap_01.mp3','cheer-clap_02.mp3','cheer-clap_03.mp3'],gain:.3,interval:.12},
 heart_send:{files:heartSounds,gain:.18,interval:.15},heart_pop:{files:heartSounds,gain:.3,interval:.15},
 angry_voice:{files:['angry-voice_01.mp3','angry-voice_02.mp3','angry-voice_03.mp3'],gain:.32,interval:.75},
 egg_scream:{files:['egg-scream_01.mp3'],gain:.25,interval:.05},
 egg_impact:{files:['egg-impact_01.mp3','egg-impact_02.mp3','egg-impact_03.mp3'],interval:.15}
};

export function remoteEmoteState(lastSeq,emoteSeq){
 // The first snapshot is history, even when its emote is still in progress (FIX2 ruling).
 const advanced=Number.isInteger(emoteSeq)&&emoteSeq>(lastSeq??-1);
 return {seq:advanced?emoteSeq:lastSeq,play:advanced&&lastSeq!==undefined};
}

export function create(ctx){
 const {THREE,events,player,multiplayer}=ctx,chars=ctx.config('characters'),teams=ctx.config('teams').teams;
 const teamMaps=new Map(),remotes=new Map(),pending=new Map(),sequences=new Map();
 const fx=chars.fx,eggFx=fx.egg_throw,heartFx=fx.heart,batches={},batchList=[],splats=[],fxObjects=[];
 const preludes=new Set(['cheer_windup','heart_open','angry_raise']);
 const cues=Object.fromEntries(Object.entries(chars.cues).map(([clip,frames])=>[clip,
  Object.entries(frames).flatMap(([event,values])=>[].concat(values).map((frame,eventIndex)=>({event,eventIndex,time:frame/chars.clipFps}))).sort((a,b)=>a.time-b.time)]));
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const transform=new THREE.Object3D(),point=new THREE.Vector3(),other=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),cameraRotation=new THREE.Quaternion();
 const firstPerson=new THREE.Group();firstPerson.name='EggFirstPerson';firstPerson.visible=false;
 let firstPersonEgg=null,ownsCamera=false;
 let effectTime=0,lastNow=null;
 let source=null,neutral=null,uniformSource=null,local=null,ready=false,disposed=false,error=null;
 let character=chars.default,team=null,seated=false,animationSource=null,clips=[],eggSource=null,listener=null,skipFrame=false,soundMuted=true;
 const soundBuffers=new Map(),soundEnabled=()=>window.arena?.screen?.state?.muted===false;
 // Reserve the ten stage-player voices within T34's combined 26 / 24 voice budget.
 const fanVoices=matchMedia('(pointer:coarse)').matches?14:16;
 const draco=new DRACOLoader().setDecoderPath('./vendor/draco/').setDecoderConfig({type:'wasm'}).setWorkerLimit(1);

 function effectTexture(id){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
  const paint=canvas.getContext('2d');paint.fillStyle=paint.strokeStyle='#fff';paint.beginPath();
  if(id==='cheer_clap'){
   for(const [i,x,y] of [[0,128,12],[1,145,110],[2,244,128],[3,145,146],[4,128,244],[5,111,146],[6,12,128],[7,111,110]]){
    if(i)paint.lineTo(x,y);else paint.moveTo(x,y);
   }
   paint.closePath();paint.fill();
  }else if(id==='heart'){
   paint.moveTo(128,232);paint.bezierCurveTo(12,148,0,64,57,32);paint.bezierCurveTo(86,16,116,30,128,58);
   paint.bezierCurveTo(140,30,170,16,199,32);paint.bezierCurveTo(256,64,244,148,128,232);paint.fill();
  }else if(id==='angry'){
   paint.lineWidth=22;paint.lineJoin='miter';
   for(const [x,y,sx,sy] of [[104,104,-1,-1],[152,104,1,-1],[104,152,-1,1],[152,152,1,1]]){
    paint.moveTo(x+sx*54,y);paint.lineTo(x,y);paint.lineTo(x,y+sy*54);
   }
   paint.stroke();
  }else{
   paint.moveTo(216,128);paint.bezierCurveTo(250,180,188,170,179,217);paint.bezierCurveTo(150,245,121,204,80,221);
   paint.bezierCurveTo(35,224,59,179,24,160);paint.bezierCurveTo(4,130,47,109,38,69);
   paint.bezierCurveTo(43,31,95,60,120,24);paint.bezierCurveTo(153,9,173,61,209,56);paint.bezierCurveTo(249,61,210,104,216,128);paint.fill();
  }
  const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.generateMipmaps=false;
  map.minFilter=map.magFilter=THREE.LinearFilter;return map;
 }
 function createEffects(){
  const plane=new THREE.PlaneGeometry(1,1);
  const batch=(id,geometry,material,count)=>{
   const mesh=new THREE.InstancedMesh(geometry,material,count);mesh.name=`EmoteFX_${id}`;
   mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.visible=false;mesh.frustumCulled=false;
   ctx.scene.add(mesh);fxObjects.push(mesh);batchList.push(mesh);batches[id]=mesh;return mesh;
  };
  for(const id of ['cheer_clap','heart','angry'])batch(id,plane,new THREE.MeshBasicMaterial({
   map:effectTexture(id),color:fx[id].color,alphaTest:.5,depthWrite:false,toneMapped:false}),16*(fx[id].maxParticles+(id==='heart'?heartFx.burstParticles:0)));
  batches.heart.material.side=THREE.DoubleSide;batches.heart.renderOrder=heartFx.renderOrder;
  batch('flight',eggSource.geometry,eggSource.material,eggFx.maxConcurrentEffects).renderOrder=eggFx.renderOrder;
  const triangle=new THREE.BufferGeometry();triangle.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.4,0,.5,-.4,0,0,.5,0],3));
  batch('shells',triangle,new THREE.MeshBasicMaterial({color:eggFx.shellColor,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}),eggFx.maxConcurrentEffects*eggFx.maxParticles).renderOrder=eggFx.renderOrder;
  const map=effectTexture('splat');
  batch('yolk',plane,new THREE.MeshBasicMaterial({map,color:eggFx.yolkColor,alphaTest:.5,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}),eggFx.maxConcurrentEffects*eggFx.yolkParticles).renderOrder=eggFx.renderOrder;
  for(let i=0;i<4;i++){
   const mesh=new THREE.Mesh(plane,new THREE.MeshBasicMaterial({map,color:eggFx.yolkColor,transparent:true,depthWrite:false,toneMapped:false}));
   mesh.name='EmoteFX_splat';mesh.renderOrder=eggFx.renderOrder;mesh.visible=false;mesh.owner=null;
   ctx.scene.add(mesh);fxObjects.push(mesh);splats.push(mesh);
  }
  const cfg=eggFx.firstPerson,skin=new THREE.MeshBasicMaterial({color:cfg.skinColor,depthTest:false,depthWrite:false,toneMapped:false});
  const palm=new THREE.SphereGeometry(1,12,8);
  const arm=new THREE.Mesh(new THREE.CylinderGeometry(.7,1,1,10),skin),hand=new THREE.Mesh(palm,skin),thumb=new THREE.Mesh(palm,skin);
  arm.scale.fromArray(cfg.armSize);arm.position.y=-cfg.armSize[1]/2-cfg.handSize[1]/2;
  hand.name='EggFirstPersonHand';hand.scale.fromArray(cfg.handSize);
  thumb.scale.copy(hand.scale).multiplyScalar(.5);thumb.position.set(-cfg.handSize[0],0,cfg.handSize[2]);
  firstPersonEgg=new THREE.Mesh(eggSource.geometry,new THREE.MeshBasicMaterial({color:eggFx.shellColor,depthTest:false,depthWrite:false,toneMapped:false}));firstPersonEgg.name='EggFirstPersonEgg';
  firstPersonEgg.position.fromArray(cfg.eggOffset);firstPersonEgg.quaternion.copy(eggSource.quaternion);
  for(const mesh of [arm,hand,thumb,firstPersonEgg]){mesh.renderOrder=eggFx.renderOrder+1;firstPerson.add(mesh);fxObjects.push(mesh);}
  ownsCamera=!ctx.camera.parent;if(ownsCamera)ctx.scene.add(ctx.camera);
  ctx.camera.add(firstPerson);
 }
 function disposeEffects(){
  const resources=new Set();
  for(const object of fxObjects){
   object.removeFromParent();if(object.isInstancedMesh)object.dispose();
   if(object===batches.flight)continue;
   if(object.geometry!==eggSource.geometry)resources.add(object.geometry);
   resources.add(object.material);if(object.material.map)resources.add(object.material.map);
  }
  firstPerson.removeFromParent();if(ownsCamera)ctx.camera.removeFromParent();
  for(const resource of resources)resource.dispose();
 }
 function drawFirstPerson(at,hidden){
  const cfg=eggFx.firstPerson,age=at-local.eggBorn;
  firstPerson.visible=local.emote==='egg_throw'&&local.eggSeated&&local.seated&&!hidden&&age<cfg.seconds-1e-8&&(!reducedMotion.matches||!local.released);
  if(!firstPerson.visible)return;
  const throwing=age<=eggFx.seatedReleaseSeconds;
  const from=throwing?cfg.start:cfg.release,to=throwing?cfg.release:cfg.finish;
  let u=Math.max(0,Math.min(1,throwing?age/eggFx.seatedReleaseSeconds:(age-eggFx.seatedReleaseSeconds)/(cfg.seconds-eggFx.seatedReleaseSeconds)));
  u=reducedMotion.matches?0:u*u*(3-2*u);
  const height=cfg.depthMeters*Math.tan(THREE.MathUtils.degToRad(ctx.camera.fov)/2)/ctx.camera.zoom;
  firstPerson.position.set(THREE.MathUtils.lerp(from[0],to[0],u)*height*ctx.camera.aspect,THREE.MathUtils.lerp(from[1],to[1],u)*height,-cfg.depthMeters);
  firstPerson.scale.setScalar(height);firstPerson.rotation.z=THREE.MathUtils.lerp(cfg.tiltRadians[0],cfg.tiltRadians[1],throwing?u:1-u);
  firstPersonEgg.scale.copy(eggSource.scale).multiplyScalar(eggFx.projectileScale/height);firstPersonEgg.visible=!local.released;
  firstPerson.updateWorldMatrix(true,true);
 }
 function hands(record,target){
  record.model.updateWorldMatrix(true,true);record.handL.getWorldPosition(target);record.handR.getWorldPosition(other);target.add(other).multiplyScalar(.5);
 }
 function mark(record,event,at){
  const id=record.emote,cfg=fx[id];record.model.updateWorldMatrix(true,true);
  const left=record.handL.getWorldPosition(new THREE.Vector3()),right=record.handR.getWorldPosition(new THREE.Vector3());
  const center=left.clone().add(right).multiplyScalar(.5),side=new THREE.Vector3(1,0,0).applyQuaternion(record.avatar.getWorldQuaternion(new THREE.Quaternion()));
  if(id==='angry')record.head.getWorldPosition(center).addScaledVector(side,cfg.headOffsetMeters).addScaledVector(up,cfg.headOffsetMeters);
  if(id==='heart')center.y+=cfg.handOffsetMeters;
  record.marker={id,event,born:at,left,right,center,side};
 }
 function screenFlight(record,at,origin){
  let face=null,score=0;
  record.avatar.getWorldPosition(point);
  for(const candidate of window.arena?.screen?.faces??[]){
   const facing=other.copy(point).sub(new THREE.Vector3().fromArray(candidate.position)).normalize().dot(new THREE.Vector3().fromArray(candidate.normal).normalize());
   if(facing>score){score=facing;face=candidate;}
  }
  if(!face)return;
  const normal=new THREE.Vector3().fromArray(face.normal).normalize(),right=new THREE.Vector3().crossVectors(up,normal).normalize(),vertical=new THREE.Vector3().crossVectors(normal,right);
  return {face,born:at,seq:record.emoteSeq,origin,target:new THREE.Vector3().fromArray(face.position),normal,right,vertical,
   faceRotation:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,vertical,normal))};
 }
 function releaseEgg(record,at){
  const held=record===local&&record.eggSeated&&record.seated?firstPersonEgg:record.egg;
  if(held===firstPersonEgg)drawFirstPerson(at,false);
  record.released=true;record.egg.visible=false;record.model.updateWorldMatrix(true,true);
  const active=[local,...remotes.values()].filter(r=>r!==record&&r.eggEffectUntil>effectTime).length;
  if(active>=eggFx.maxConcurrentEffects)return;
  const flight=screenFlight(record,at,held.getWorldPosition(new THREE.Vector3()));
  if(!flight)return;
  record.shards=null;for(const splat of splats)if(splat.owner===record){splat.owner=null;splat.visible=false;}
  record.flight=flight;record.eggEffectUntil=at+eggFx.flightSeconds+Math.max(eggFx.seconds,eggFx.splatSeconds);
  Object.assign(flight,{rotation:held.getWorldQuaternion(new THREE.Quaternion()),scale:record.egg.getWorldScale(new THREE.Vector3())});
 }
 function releaseHeart(record,at){
  const origin=new THREE.Vector3();hands(record,origin);origin.y+=heartFx.handOffsetMeters;
  record.marker=null;record.heart=screenFlight(record,at,origin);
  if(record.heart)queueSound(record,'heart_send',at,0,record.heart.seq,origin);
 }
 function impact(record,flight){
  const born=flight.born+eggFx.flightSeconds;
  record.shards={...flight,born};
  queueSound(record,'egg_impact',born,0,flight.seq,flight.target);
  const splat=splats.find(s=>s.owner&&s.userData.face===flight.face.name)??splats.find(s=>!s.owner);
  if(!splat||eggFx.maxSplatsPerFace<1)return;
  const {width,height}=flight.face,size=Math.min(eggFx.splatSizeMeters,Math.sqrt(width*height*eggFx.maxSplatAreaRatio),width,height);
  splat.owner=record;splat.born=born;splat.userData.face=flight.face.name;
  splat.position.copy(flight.target).addScaledVector(flight.normal,eggFx.surfaceOffsetMeters);splat.quaternion.copy(flight.faceRotation);splat.scale.set(size,size,1);
 }
 function put(batch){
  if(batch.count>=batch.instanceMatrix.count)return;
  transform.updateMatrix();batch.setMatrixAt(batch.count++,transform.matrix);
 }
 function drawMarker(record){
  const m=record.marker;if(!m)return;
  const cfg=fx[m.id],age=effectTime-m.born,prelude=preludes.has(m.event),hold=m.event==='heart_form';
  const seconds=prelude?cfg.preludeSeconds:cfg.seconds,reduced=reducedMotion.matches;
  let count=prelude?cfg.preludeParticles:m.event==='cheer_raise'?cfg.raiseParticles:cfg.maxParticles;
  if(reduced)count=Math.min(count,cfg.reducedMotionParticles);
  if(hold){hands(record,m.center);m.center.y+=cfg.handOffsetMeters;}
  else if(age>=seconds-1e-8){record.marker=null;return;}
  for(let j=0;j<count;j++){
   const angle=j/count*Math.PI*2,central=hold&&j===0;
   if(hold&&!central&&age>=cfg.seconds-1e-8)continue;
   let size=cfg.size*(prelude?cfg.preludeScale:hold&&!central?cfg.secondaryScale:1);
   if(central){
    transform.position.copy(m.center);
   }else{
    const u=Math.min(1,Math.max(0,age/seconds));size*=Math.min(1,(1-u)*1.5);
    transform.position.copy(m.id!=='angry'&&(prelude||m.event==='cheer_raise')?(j%2?m.right:m.left):m.center);
    if(!reduced){
     if(m.id==='heart')transform.position.addScaledVector(m.side,Math.cos(angle)*cfg.size*.5).addScaledVector(up,cfg.riseMeters*u);
     else transform.position.addScaledVector(m.side,Math.cos(angle)*cfg.spreadMeters*u).addScaledVector(up,Math.sin(angle)*cfg.spreadMeters*u);
    }
   }
   transform.quaternion.copy(cameraRotation);transform.scale.setScalar(Math.max(0,size));put(batches[m.id]);
  }
 }
 function drawHeart(record,hidden,suspended){
  const h=record.heart;if(!h)return;
  if(!h.burst&&effectTime-h.born>=heartFx.flightSeconds-1e-8){
   h.born+=heartFx.flightSeconds;h.burst=true;
   if(!suspended)queueSound(record,'heart_pop',h.born,0,h.seq,h.target);
  }
  const age=Math.max(0,effectTime-h.born),reduced=reducedMotion.matches;
  if(h.burst&&age>=heartFx.burstSeconds-1e-8){record.heart=null;return;}
  if(hidden)return;
  if(!h.burst){
   const u=Math.min(1,age/heartFx.flightSeconds);
   transform.position.copy(h.origin).lerp(h.target,u);if(!reduced)transform.position.y+=4*heartFx.arcHeightMeters*u*(1-u);
   transform.quaternion.copy(cameraRotation);transform.scale.setScalar(heartFx.size);put(batches.heart);return;
  }
  const {width,height}=h.face,size=Math.min(heartFx.burstSizeMeters,width,height),u=age/heartFx.burstSeconds;
  const radius=Math.max(0,Math.min(heartFx.burstRadiusMeters,(width-size)/2,(height-size)/2));
  const count=reduced?Math.min(heartFx.burstParticles,heartFx.reducedMotionParticles):heartFx.burstParticles;
  for(let j=0;j<count;j++){
   const angle=2*Math.PI*j/count+Math.PI/4;
   transform.position.copy(h.target).addScaledVector(h.normal,heartFx.surfaceOffsetMeters);
   if(!reduced)transform.position.addScaledVector(h.right,Math.cos(angle)*radius*u).addScaledVector(h.vertical,Math.sin(angle)*radius*u);
   transform.quaternion.copy(h.faceRotation);transform.scale.setScalar(size*Math.min(1,(1-u)*1.5));put(batches.heart);
  }
 }
 function drawRecordEffects(record,hidden,suspended){
   if(record.egg)record.egg.visible=record.emote==='egg_throw'&&!record.released&&!hidden&&!(record===local&&record.eggSeated&&record.seated);
   if(record.flight&&effectTime-record.flight.born>=eggFx.flightSeconds-1e-8){
    if(!suspended&&effectTime-record.flight.born<eggFx.flightSeconds+eggFx.splatSeconds)impact(record,record.flight);
    record.flight=null;
   }
   if(!hidden)drawMarker(record);
   drawHeart(record,hidden,suspended);
   if(record.flight&&!hidden){
    const f=record.flight,u=Math.max(0,Math.min(1,(effectTime-f.born)/eggFx.flightSeconds));
    transform.position.copy(f.origin).lerp(f.target,u);if(!reducedMotion.matches)transform.position.y+=4*eggFx.arcHeightMeters*u*(1-u);
    transform.quaternion.copy(f.rotation);transform.scale.copy(f.scale);put(batches.flight);
   }
   if(record.shards){
    const s=record.shards,t=Math.max(0,effectTime-s.born);
    if(t>=eggFx.seconds-1e-8){record.shards=null;return;}
    if(hidden)return;
    const count=reducedMotion.matches?Math.min(eggFx.maxParticles,eggFx.reducedMotionParticles):eggFx.maxParticles;
    for(let j=0;j<count;j++){
     const angle=2*Math.PI*j/count;
     transform.position.copy(s.target).addScaledVector(s.normal,eggFx.surfaceOffsetMeters+eggFx.shardNormalSpeedMetersPerSecond*t)
      .addScaledVector(s.right,Math.cos(angle)*eggFx.shardSpeedMetersPerSecond*t).addScaledVector(s.vertical,Math.sin(angle)*eggFx.shardSpeedMetersPerSecond*t);
     transform.position.y-=eggFx.shardGravityMetersPerSecondSquared*t*t/2;transform.quaternion.copy(s.faceRotation);transform.scale.setScalar(eggFx.size*(1-t/eggFx.seconds));put(batches.shells);
    }
    const yolks=reducedMotion.matches?Math.min(eggFx.yolkParticles,eggFx.reducedMotionParticles):eggFx.yolkParticles;
    for(let j=0;j<yolks;j++){
     const angle=2*Math.PI*(j+.5)/yolks;
     transform.position.copy(s.target).addScaledVector(s.normal,eggFx.surfaceOffsetMeters*2)
      .addScaledVector(s.right,Math.cos(angle)*eggFx.shardSpeedMetersPerSecond*t).addScaledVector(s.vertical,Math.sin(angle)*eggFx.shardSpeedMetersPerSecond*t);
     transform.position.y-=eggFx.shardGravityMetersPerSecondSquared*t*t/2;
     transform.quaternion.copy(s.faceRotation);transform.scale.setScalar(eggFx.size*(1-t/eggFx.seconds));put(batches.yolk);
    }
   }
 }
 function drawEffects(suspended=false){
  if(!batches.flight)return;
  for(const batch of batchList)batch.count=0;
  ctx.camera.getWorldQuaternion(cameraRotation);
  const hidden=window.arena?.screen?.fullMode===true||document.hidden;
  drawFirstPerson(effectTime,hidden);
  drawRecordEffects(local,hidden,suspended);for(const record of remotes.values())drawRecordEffects(record,hidden,suspended);
  for(const batch of batchList){batch.visible=batch.count>0;batch.instanceMatrix.needsUpdate=true;}
  for(const splat of splats){
   const age=effectTime-splat.born;
   if(splat.owner&&age>=eggFx.splatSeconds-1e-8)splat.owner=null;
   splat.visible=!!splat.owner&&!hidden;
   if(splat.owner){const fade=Math.max(0,Math.min(1,(age-eggFx.splatSeconds+eggFx.splatFadeSeconds)/eggFx.splatFadeSeconds));splat.material.opacity=eggFx.splatOpacity*(1-fade)**2;}
  }
 }
 function clearReleased(record){
  record.flight=null;record.shards=null;record.heart=null;record.eggEffectUntil=0;
  for(const splat of splats)if(splat.owner===record){splat.owner=null;splat.visible=false;}
 }
 function addSound(record){
  if(!listener||!record.mixer||record.sound)return;
  record.sound=new THREE.PositionalAudio(listener).setVolume(.25).setRefDistance(4);
  record.model.getObjectByName('head').add(record.sound);
  const buffer=soundBuffers.get(sounds.egg_scream.files[0]);if(buffer)record.sound.setBuffer(buffer);
 }
 const stopSound=(record,delay=0)=>{record.pendingSound=null;if(record.sound?.isPlaying)record.sound.stop(delay);};
 const soundVolume=record=>record.soundGain*(window.arena.screen.state.userVolume/ctx.config('screen').volume);
 const stopSounds=()=>{if(local)stopSound(local);for(const record of remotes.values())stopSound(record);};
 function unlockSound(){
  if(disposed)return;
  try{
   if(!listener){
    listener=new THREE.AudioListener();ctx.camera.add(listener);
    if(local)addSound(local);for(const record of remotes.values())addSound(record);
    const loader=new THREE.AudioLoader();
    for(const file of new Set(Object.values(sounds).flatMap(sound=>sound.files)))loader.loadAsync(`./assets/audio/sfx/${file}`).then(buffer=>{
     if(disposed)return;soundBuffers.set(file,buffer);
     if(file===sounds.egg_scream.files[0])for(const record of [local,...remotes.values()])if(record?.sound&&!record.sound.buffer)record.sound.setBuffer(buffer);
    }).catch(reason=>console.warn('감정표현 효과음을 불러오지 못했습니다.',file,reason));
   }
   listener.context.resume().catch(()=>{});
  }catch(reason){console.warn('감정표현 효과음을 재생할 수 없습니다.',reason);}
 }
 const onScreen=e=>{
  if(e.detail.muted===false&&soundMuted)unlockSound();soundMuted=e.detail.muted;
  if(soundMuted){stopSounds();return;}
  for(const record of [local,...remotes.values()])if(record?.sound){
   const gain=record.sound.gain.gain,now=listener.context.currentTime;
   gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);gain.linearRampToValueAtTime(soundVolume(record),now+.02);
  }
 };
 function clearEffect(record){
  stopSound(record);record.marker=null;
  if(record===local)firstPerson.visible=false;
  if(record.egg){
   record.socket.add(record.egg);record.egg.position.copy(eggSource.position);
   record.egg.quaternion.copy(eggSource.quaternion);record.egg.scale.copy(eggSource.scale).multiplyScalar(eggFx.projectileScale);record.egg.visible=false;
  }
 }
 function transition(record,name,restart=false){
  const next=record.actions?.[name],previous=record.action;
  if(!next||next===previous&&!restart)return;
  const phase=previous&&['Walk','Run'].includes(previous.getClip().name)&&['Walk','Run'].includes(name)?previous.time/previous.getClip().duration:0;
  for(const action of Object.values(record.actions))if(action!==next&&action!==previous)action.stop();
  next.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).play();
  if(phase)next.time=phase*next.getClip().duration;
  if(previous&&previous!==next)next.crossFadeFrom(previous,.2,false);
  record.action=next;record.mixer.update(0);
 }
 function beginEmote(record,id,seq=record.emoteSeq+1){
  if(!record.mixer||!Object.hasOwn(emotes,id))return false;
  clearEffect(record);record.emote=id;record.emoteSeq=seq;record.cue=0;record.released=false;
  record.eggSeated=id==='egg_throw'&&record.seated;record.eggBorn=effectTime;
  transition(record,emotes[id],true);record.egg.visible=id==='egg_throw'&&!window.arena?.screen?.fullMode;return true;
 }
 function attach(avatar){
  const model=clone(source),uniform=uniformSource.clone(),original=avatar.children.map(object=>({object,visible:object.visible}));
  // The delivered GLB faces +Z; movement and the existing avatar face -Z.
  model.rotation.y=Math.PI;
  model.traverse(o=>{if(o.isMesh){
   if(o.material.name==='Uniform')o.material=uniform;
   o.castShadow=true;o.receiveShadow=true;
  }});
  for(const {object} of original)object.visible=false;
  avatar.add(model);
  const record={avatar,model,uniform,original,bodies:chars.ids.map(id=>model.getObjectByName(id)),
   seated:false,emote:null,emoteSeq:0,soundGain:.25,soundTimes:new Map(),soundVariants:new Map(),previous:avatar.position.clone(),poseAge:.1,speed:0,airborne:false};
  if(clips.length){
   record.mixer=new THREE.AnimationMixer(model);
   record.actions=Object.fromEntries(clips.map(clip=>{
    const action=record.mixer.clipAction(clip),loop=['Idle','Walk','Run'].includes(clip.name);
    action.setLoop(loop?THREE.LoopRepeat:THREE.LoopOnce,loop?Infinity:1);action.clampWhenFinished=true;
    return [clip.name,action];
   }));
   record.egg=eggSource.clone();record.socket=model.getObjectByName('prop_R');record.hips=model.getObjectByName('hips');
   record.handL=model.getObjectByName('hand_L');record.handR=model.getObjectByName('hand_R');record.head=model.getObjectByName('head');
   clearEffect(record);transition(record,'Idle');addSound(record);
  }
  return record;
 }
 function choose(record,characterId,teamId){
  const id=chars.ids.includes(characterId)?characterId:chars.default;
  for(const body of record.bodies)body.visible=body.name===id;
  record.uniform.map=teamMaps.get(teamId)??neutral;
 }
 function detach(record){
  clearEffect(record);clearReleased(record);record.egg?.removeFromParent();
  if(record.sound){record.sound.disconnect();record.sound.gain.disconnect();record.sound.removeFromParent();}
  record.mixer?.stopAllAction();record.mixer?.uncacheRoot(record.model);
  record.avatar.remove(record.model);
  const skeletons=new Set();record.model.traverse(o=>{if(o.isSkinnedMesh)skeletons.add(o.skeleton);});
  for(const skeleton of skeletons)skeleton.dispose();
  record.uniform.dispose();
  for(const {object,visible} of record.original)object.visible=visible;
 }
 function syncPeer(state){
  if(!ready)return false;
  const avatar=multiplayer.avatarOf(state.peerId);if(!avatar)return false;
  let record=remotes.get(state.peerId);
  if(record?.avatar!==avatar){
   if(record)detach(record);
   record=attach(avatar);remotes.set(state.peerId,record);
  }
  choose(record,state.character,state.team);record.seated=state.seated===true;
  const emote=remoteEmoteState(sequences.get(state.peerId),state.emoteSeq);
  sequences.set(state.peerId,emote.seq);
  if(emote.play)beginEmote(record,state.emote,state.emoteSeq);
  return true;
 }
 function queueSound(record,id,at,eventIndex=0,seq=record.emoteSeq,position=null){
  if(skipFrame||document.hidden||window.arena?.screen?.fullMode||!soundEnabled())return;
  if(!record.pendingSound||at>=record.pendingSound.at)record.pendingSound={id,at,eventIndex,seq,position};
 }
 function playSound(record){
  const cue=record.pendingSound;record.pendingSound=null;
  if(!cue||effectTime-cue.at>.1+1e-8||!record.sound||listener.context.state!=='running')return;
  const cfg=sounds[cue.id];
  if(cue.at-(record.soundTimes.get(cue.id)??-Infinity)<cfg.interval-1e-8)return;
  let variant=(cue.seq+cue.eventIndex)%cfg.files.length;
  if(variant===record.soundVariants.get(cue.id))variant=(variant+1)%cfg.files.length;
  const buffer=soundBuffers.get(cfg.files[variant]);if(!buffer)return;
  const voices=[local,...remotes.values()].filter(r=>r?.sound?.isPlaying&&r!==record);
  if(voices.length>=fanVoices){
   const distance=r=>r.avatar.position.distanceToSquared(player.avatar.position);
   const farthest=voices.filter(r=>r!==local).sort((a,b)=>distance(b)-distance(a))[0];
   if(!farthest||record!==local&&distance(record)>=distance(farthest))return;
   stopSound(farthest);
  }
  const sound=record.sound,delay=sound.isPlaying?.02:0,now=listener.context.currentTime,gain=sound.gain.gain;
  stopSound(record,delay);record.soundGain=cue.id==='egg_impact'?eggFx.impactGain:cfg.gain;sound.setBuffer(buffer);
  if(cue.position){ctx.scene.add(sound);sound.position.copy(cue.position);}
  else {record.head.add(sound);sound.position.set(0,0,0);}
  gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);gain.linearRampToValueAtTime(0,now+delay);gain.linearRampToValueAtTime(soundVolume(record),now+delay+.02);
  record.soundTimes.set(cue.id,cue.at);record.soundVariants.set(cue.id,variant);
  sound.updateWorldMatrix(true,false);sound.play(delay);sound.updateMatrixWorld(true);
 }
 function advance(record,dt){
  record.mixer.update(dt);
  // Seat coordinates are cushion centres; cancel Sit's backward hip travel, including its blend.
  const sit=record.actions.Sit;record.model.position.z=sit.isScheduled()&&sit.enabled?record.hips.position.z:0;if(sit.isScheduled()&&sit.enabled)record.hips.position.y=Math.max(.56,record.hips.position.y);
 }
 function animate(record,dt,elapsed){
  if(!record.mixer)return;
  const position=record.avatar.position,dx=position.x-record.previous.x,dz=position.z-record.previous.z;
  const moved=position.distanceToSquared(record.previous)>1e-8;
  record.poseAge+=dt;
  if(record===local){record.speed=dt?Math.hypot(dx,dz)/dt:0;record.airborne=player.airborne===true;}
  else if(moved){
   record.speed=Math.hypot(dx,dz)/Math.max(record.poseAge,dt);
   const floor=player.groundAt?.(position.x,position.z,position.y,.02);
   record.airborne=floor!=null&&position.y-floor>.12;record.poseAge=0;
  }else if(record.poseAge>.2){record.speed=0;record.airborne=false;}
  record.previous.copy(position);
  const moving=record.speed>.05&&record.speed<12;
  if(record.emote&&!record.seated&&(moved||record.airborne)){record.emote=null;clearEffect(record);}
  const base=record.seated?'Sit':record.airborne?'Jump':moving?(record.speed>6?'Run':'Walk'):'Idle';
  transition(record,record.emote?emotes[record.emote]:base);
  if(!record.emote&&moving&&!record.seated&&!record.airborne)record.action.setEffectiveTimeScale(record.speed/(base==='Run'?8:4));
  if(record.emote){
   let remaining=elapsed;
   let rate=record.eggSeated&&!record.released?chars.cues.Emote_EggThrow.egg_release/chars.clipFps/eggFx.seatedReleaseSeconds:1;
   const timeline=cues[emotes[record.emote]];
   while(record.cue<timeline.length&&record.action.time+remaining*rate>=timeline[record.cue].time-1e-8){
    const {time,event,eventIndex}=timeline[record.cue++],step=Math.max(0,time-record.action.time)/rate;
    advance(record,step*rate);remaining=Math.max(0,remaining-step);const at=effectTime-remaining;
    if(event==='egg_scream')queueSound(record,'egg_scream',at);
    else if(event==='egg_release'){releaseEgg(record,at);rate=1;}
    else if(event==='heart_release')releaseHeart(record,at);
    else if(record.emote!=='egg_throw')mark(record,event,at);
    if(event==='clap_contact')queueSound(record,'cheer_clap',at,eventIndex,record.emoteSeq,record.marker.center.clone());
    if(event==='angry_swing'&&eventIndex===0)queueSound(record,'angry_voice',at);
   }
   advance(record,remaining*rate);
  }else advance(record,dt);
  if(record.emote&&record.action.paused){record.emote=null;clearEffect(record);transition(record,base);}
  if(!soundEnabled()||document.hidden||window.arena?.screen?.fullMode)stopSound(record);
 }
 function update(dt=0,now=performance.now()){
  if(!ready||disposed)return;
  const elapsed=lastNow!==null&&Number.isFinite(now)&&now>=lastNow?(now-lastNow)/1000:Math.max(0,Number.isFinite(dt)?dt:0);
  lastNow=now;effectTime+=elapsed;
  for(const [id,record] of remotes)if(multiplayer.avatarOf(id)!==record.avatar){detach(record);remotes.delete(id);}
  // State can arrive before the pose creates the remote avatar.
  let peers;
  for(const [id,state] of pending){
   if(syncPeer(state))pending.delete(id);
   else {peers??=multiplayer.peers;if(!peers.some(p=>p.peerId===id))pending.delete(id);}
  }
  dt=Number.isFinite(dt)?Math.min(.25,Math.max(0,dt)):0;
  const resumed=skipFrame;
  if(skipFrame){dt=0;local.previous.copy(local.avatar.position);for(const record of remotes.values())record.previous.copy(record.avatar.position);}
  animate(local,dt,elapsed);for(const record of remotes.values())animate(record,dt,elapsed);
  drawEffects(resumed||document.hidden);
  playSound(local);for(const record of remotes.values())playSound(record);
  skipFrame=false;
 }
 const onTeam=e=>{if(!teams.some(t=>t.id===e.detail?.teamId))return;team=e.detail.teamId;if(local)choose(local,character,team);};
 const onCharacter=e=>{if(!chars.ids.includes(e.detail?.characterId))return;character=e.detail.characterId;if(local)choose(local,character,team);};
 const onPeer=e=>{const state=e.detail;pending.set(state.peerId,state);if(syncPeer(state))pending.delete(state.peerId);};
 const clearPeers=()=>{for(const record of remotes.values())detach(record);remotes.clear();pending.clear();sequences.clear();if(local){clearEffect(local);clearReleased(local);local.emote=null;}};
 const played=e=>{if(!disposed&&!document.hidden&&local&&beginEmote(local,e.detail?.id))events.dispatchEvent(new CustomEvent(EMOTE_PLAYED,{detail:{id:e.detail.id}}));};
 const sit=()=>{seated=true;if(local)local.seated=true;};
 const stand=()=>{seated=false;if(local)local.seated=false;};
 const visibility=()=>{skipFrame=true;if(document.hidden)stopSounds();};
 const listeners=[[APP_ENTER,unlockSound],[SCREEN_STATE,onScreen],[FULLMODE_ENTER,stopSounds],[TEAM_CHANGED,onTeam],[CHARACTER_CHANGED,onCharacter],[PEER_STATE,onPeer],[ROOM_LEFT,clearPeers],[EMOTE_REQUEST,played],[SEAT_ENTER,sit],[SEAT_EXIT,stand]];
 for(const [name,listener] of listeners)events.addEventListener(name,listener);
 document.addEventListener('visibilitychange',visibility);
 for(const state of multiplayer.peers)pending.set(state.peerId,state);

 function releaseSource(){
  const resources=new Set(teamMaps.values());
  for(const root of [source,animationSource])root?.traverse(o=>{if(o.isMesh){resources.add(o.geometry);resources.add(o.material);if(o.material.map)resources.add(o.material.map);}if(o.isSkinnedMesh)resources.add(o.skeleton);});
  for(const resource of resources){resource.dispose();if(resource.isTexture)resource.image?.close?.();}
  source=null;animationSource=null;eggSource=null;clips=[];neutral=null;uniformSource=null;teamMaps.clear();
 }
 async function load(){
  try{
   source=(await new GLTFLoader().setDRACOLoader(draco).loadAsync(chars.modelFile)).scene;
   if(disposed){releaseSource();return;}
   source.traverse(o=>{if(o.material?.name==='Uniform')uniformSource=o.material;});
   if(!uniformSource?.map||!source.getObjectByName('FanRig')||chars.ids.some(id=>!source.getObjectByName(id)))throw Error(`${chars.modelFile} 캐릭터 규약 불일치`);
   try{
    const animation=await new GLTFLoader().setDRACOLoader(draco).loadAsync(chars.clipFile);
    animationSource=animation.scene;eggSource=animationSource.getObjectByName('Prop_Egg');
    if(!eggSource||['prop_R','head','hand_L','hand_R'].some(name=>!source.getObjectByName(name))||
     ['Idle','Walk','Run','Jump','Sit',...Object.values(emotes)].some(name=>!animation.animations.some(clip=>clip.name===name)))throw Error(`${chars.clipFile} 클립 규약 불일치`);
    clips=animation.animations;
   }catch(reason){error=reason.message;console.warn('캐릭터 애니메이션을 불러오지 못해 응원 티켓을 발급할 수 없습니다.',reason);}
   if(disposed){releaseSource();return;}
   neutral=uniformSource.map;
   for(const t of teams){
    let url=t.uniform;
    if(!url){
     const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
     const paint=canvas.getContext('2d');paint.fillStyle=t.color;paint.fillRect(0,0,512,512);
     url=canvas.toDataURL('image/png');
    }
    const map=await new THREE.TextureLoader().loadAsync(url);
    map.colorSpace=THREE.SRGBColorSpace;map.flipY=false;map.wrapS=map.wrapT=THREE.RepeatWrapping;
    teamMaps.set(t.id,map);
   }
   if(disposed){releaseSource();return;}
   if(clips.length)createEffects();
   local=attach(player.avatar);local.seated=seated;choose(local,character,team);ready=true;update();
  }catch(reason){error=reason.message;releaseSource();if(!disposed)console.error('캐릭터를 불러오지 못했습니다.',reason);}
  finally{draco.dispose();}
 }
 const api={get ready(){return ready;},get error(){return error;},update,
  dispose(){
   if(disposed)return;disposed=true;ready=false;
   for(const [name,listener] of listeners)events.removeEventListener(name,listener);
   document.removeEventListener('visibilitychange',visibility);
   clearPeers();if(local){detach(local);local=null;}disposeEffects();releaseSource();
   if(listener){listener.gain.disconnect();listener.removeFromParent();}soundBuffers.clear();
  }};
 if(window.arena)window.arena.character=api;
 api.loaded=load();return api;
}
