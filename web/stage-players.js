import {APP_ENTER,SCREEN_STATE} from './events.js';

const actions=['mouse','keyboard','look','shout','hair'];
const step=1/60;

export function create(ctx){
 const {THREE,root,camera,scene}=ctx,config=ctx.config('stage-players');
 const meshes=[],jerseys=[];
 root.updateMatrixWorld(true);
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.name.startsWith('REF_Player'))return;
  meshes.push(mesh);if(mesh.name.startsWith('REF_PlayerJersey_'))jerseys.push(mesh);
 });
 if(jerseys.length!==10)throw Error('Expected 10 REF_PlayerJersey meshes');
 const frame=jerseys[0].matrixWorld.clone(),inverseFrame=frame.clone().invert();
 const point=new THREE.Vector3(),normal=new THREE.Vector3();
 const players=jerseys.map(mesh=>{
  mesh.geometry.computeBoundingBox();
  const center=mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseFrame);
  // Joint offsets come from reference-match/equipment-players.py, in the GLB's Y-up frame.
  const x=center.x,y=center.y-1.335,z=center.z-.143;
  const body=new THREE.Object3D();body.position.set(x,y+1,z);
  const joint=(parent,px,py,pz)=>{const object=new THREE.Object3D();object.position.set(px,py,pz);parent.add(object);return object;};
  const head=joint(body,0,.78,0),mouth=joint(head,0,.10,.133);
  const left=joint(body,-.20,.56,0),leftForearm=joint(left,-.09,-.26,.28);
  const right=joint(body,.20,.56,0),rightForearm=joint(right,.09,-.26,.28);
  body.updateMatrixWorld(true);
  const joints=[body,head,mouth,left,leftForearm,right,rightForearm].map(object=>({object,inverse:object.matrixWorld.clone().invert(),matrix:new THREE.Matrix4()}));
  return {id:mesh.name,x,y,z,body,joints,action:'',elapsed:0,duration:0,sound:null,lastShout:null};
 }).sort((a,b)=>a.x-b.x);
 const saved=[],bindings=[];
 for(const mesh of meshes){
  if(/REF_Player(Pelvis|Thighs|Shins|Shoes)/.test(mesh.name))continue;
  const original=mesh.geometry,geometry=original.clone();saved.push({mesh,original});mesh.geometry=geometry;
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  geometry.computeBoundingSphere();geometry.boundingSphere.radius+=2;
  geometry.computeBoundingBox();geometry.boundingBox.expandByScalar(2);
  const toFrame=new THREE.Matrix4().multiplyMatrices(inverseFrame,mesh.matrixWorld),toLocal=toFrame.clone().invert();
  const groups=new Map(),positions=original.attributes.position;
  for(let i=0;i<positions.count;i++){
   point.fromBufferAttribute(positions,i).applyMatrix4(toFrame);
   let player=players[0];for(const candidate of players)if(Math.abs(point.x-candidate.x)<Math.abs(point.x-player.x))player=candidate;
   let part=1;
   if(/REF_Player(Torso|Jersey|Necks)/.test(mesh.name))part=0;
   else if(mesh.name.startsWith('REF_PlayerMouths'))part=2;
   else if(/REF_Player(Sleeves|Elbows|Forearms|Hands)/.test(mesh.name))part=(point.x<player.x?3:5)+(/Forearms|Hands/.test(mesh.name)?1:0);
   const key=player.id+':'+part;
   if(!groups.has(key))groups.set(key,{player,part,indices:[],matrix:new THREE.Matrix4(),normalMatrix:new THREE.Matrix3()});
   groups.get(key).indices.push(i);
  }
  bindings.push({geometry,original,toFrame,toLocal,groups:[...groups.values()]});
 }
 let disposed=false,lastNow=null,accumulator=0,listener=null,shoutBuffers=[];
 const soundEnabled=()=>window.arena.screen?.state.muted===false;
 const stopSound=player=>{if(player.sound?.isPlaying)player.sound.stop();};
 const unlockSound=()=>{
  if(disposed)return;
  try{
   if(!listener){
    listener=new THREE.AudioListener();camera.add(listener);
    for(const player of players){
     player.sound=new THREE.PositionalAudio(listener).setVolume(config.shout.gain).setRefDistance(4);
     scene.add(player.sound);
    }
    const loader=new THREE.AudioLoader();
    Promise.all(config.shout.files.map(path=>loader.loadAsync(path))).then(buffers=>{
     if(disposed)return;
     shoutBuffers=buffers;for(const player of players)player.sound.setBuffer(buffers[0]);
    }).catch(error=>console.warn('Stage player audio unavailable',error));
   }
   listener.context.resume().catch(()=>{});
  }catch(error){console.warn('Stage player audio unavailable',error);}
 };
 let soundMuted=true;
 const onScreen=event=>{
  const state=event.detail;
  if(state.muted===false&&soundMuted)unlockSound();soundMuted=state.muted;
  const gain=config.shout.gain*(state.userVolume/ctx.config('screen').volume);
  for(const player of players){if(state.muted)stopSound(player);player.sound?.setVolume(gain);}
 };
 const select=player=>{
  const previous=player.action;
  const choices=actions.filter(action=>action!=='shout'&&action!==previous);
  let action=previous!=='shout'&&Math.random()<config.shoutProbability?'shout':choices[Math.floor(Math.random()*choices.length)];
  if(players.every(other=>other===player||other.action===action))action=choices.find(choice=>choice!==action);
  player.action=action;player.duration=config.intervalSeconds[0]+Math.random()*(config.intervalSeconds[1]-config.intervalSeconds[0]);
  stopSound(player);
  if(action==='shout'&&soundEnabled()&&listener?.context.state==='running'&&!document.hidden&&shoutBuffers.length){
   const variants=shoutBuffers.filter(buffer=>buffer!==player.lastShout);
   player.lastShout=variants[Math.floor(Math.random()*variants.length)];
   player.sound.setBuffer(player.lastShout).play();
  }
 };
 for(const player of players)select(player);
 const pose=player=>{
  const {joints,action}=player,t=player.elapsed+accumulator;
  const weight=Math.max(0,Math.min(1,t/.3,(player.duration-t)/.3));
  for(const {object} of joints){object.rotation.set(0,0,0);object.scale.set(1,1,1);}
  if(action==='mouse'){
   joints[6].object.rotation.x=.025*Math.sin(t*10)*weight;joints[6].object.rotation.y=.055*Math.sin(t*6)*weight;
  }else if(action==='keyboard'){
   joints[4].object.rotation.x=.05*Math.sin(t*24)*weight;joints[6].object.rotation.x=.05*Math.sin(t*24+Math.PI)*weight;
  }else if(action==='look')joints[1].object.rotation.y=.65*Math.sin(t*1.3)*weight;
  else if(action==='shout'){
   joints[0].object.rotation.x=-.08*weight;joints[1].object.rotation.x=-.28*weight;joints[2].object.scale.y=1+7*weight;
   joints[3].object.rotation.set(-.25*weight,0,.18*weight);joints[5].object.rotation.set(-.25*weight,0,-.18*weight);
   joints[4].object.rotation.x=joints[6].object.rotation.x=-.35*weight;
  }else if(action==='hair'){
   joints[0].object.rotation.x=.06*weight;joints[1].object.rotation.x=.12*weight;
   joints[5].object.rotation.x=-.3*weight;joints[6].object.rotation.set(-1.2*weight,(-.16+.07*Math.sin(t*3))*weight,0);
  }
  player.body.updateMatrixWorld(true);
  for(const joint of joints)joint.matrix.multiplyMatrices(joint.object.matrixWorld,joint.inverse);
  if(player.sound){
   player.sound.position.set(player.x,player.y+1.95,player.z+.015).applyMatrix4(joints[1].matrix).applyMatrix4(frame);
   player.sound.updateMatrixWorld(true);
  }
 };
 const visibility=()=>{lastNow=null;accumulator=0;if(document.hidden)for(const player of players)stopSound(player);};
 ctx.events.addEventListener(APP_ENTER,unlockSound);ctx.events.addEventListener(SCREEN_STATE,onScreen);document.addEventListener('visibilitychange',visibility);
 const api={players,
  update(dt,now){
   if(disposed||document.hidden)return;
   if(lastNow===null)lastNow=now;
   accumulator+=Math.min(.25,Math.max(0,(now-lastNow)/1000));lastNow=now;
   while(accumulator+1e-9>=step){
    accumulator-=step;
    for(const player of players){
     player.elapsed+=step;
     if(player.elapsed+1e-9>=player.duration){player.elapsed-=player.duration;select(player);}
    }
   }
   if(!soundEnabled())for(const player of players)stopSound(player);
   for(const player of players)pose(player);
   for(const {geometry,original,toFrame,toLocal,groups} of bindings){
    for(const group of groups){
     group.matrix.multiplyMatrices(toLocal,group.player.joints[group.part].matrix).multiply(toFrame);
     group.normalMatrix.getNormalMatrix(group.matrix);
     for(const i of group.indices){
      point.fromBufferAttribute(original.attributes.position,i).applyMatrix4(group.matrix);
      normal.fromBufferAttribute(original.attributes.normal,i).applyMatrix3(group.normalMatrix).normalize();
      geometry.attributes.position.setXYZ(i,point.x,point.y,point.z);geometry.attributes.normal.setXYZ(i,normal.x,normal.y,normal.z);
     }
    }
    geometry.attributes.position.needsUpdate=true;geometry.attributes.normal.needsUpdate=true;
   }
  },
  dispose(){
   if(disposed)return;disposed=true;
   ctx.events.removeEventListener(APP_ENTER,unlockSound);ctx.events.removeEventListener(SCREEN_STATE,onScreen);document.removeEventListener('visibilitychange',visibility);
   for(const player of players){
    stopSound(player);
    if(player.sound){player.sound.disconnect();player.sound.gain.disconnect();player.sound.removeFromParent();}
   }
   if(listener){listener.gain.disconnect();listener.removeFromParent();}
   for(const {mesh,original} of saved){mesh.geometry.dispose();mesh.geometry=original;}
   if(window.arena.stagePlayers===api)delete window.arena.stagePlayers;
  }
 };
 window.arena.stagePlayers=api;return api;
}
