import * as THREE from 'three';
import {createCameraOcclusion} from './camera-occlusion.js';
import {events,APP_READY,FULLMODE_ENTER,FULLMODE_EXIT} from './events.js';

export function createCameraRig({camera,player,config}){
 const ray=new THREE.Raycaster(),target=new THREE.Vector3(),direction=new THREE.Vector3(),defaultFov=camera.fov;
 let yaw=-Math.PI/2,pitch=0,override=null,zoom=config.distance,occlusion=null,fullMode=false;
 const listeners=new AbortController(),options={signal:listeners.signal};
 // shortcut: the app has one arena canvas; pass it explicitly if multiple views are introduced.
 document.querySelector('canvas').addEventListener('wheel',e=>{
  if(override||e.ctrlKey||!e.deltaY)return;
  e.preventDefault();
  zoom=Math.max(config.minDistance,Math.min(config.maxDistance,zoom+Math.sign(e.deltaY)*config.wheelStep));
 },{...options,passive:false});
 events.addEventListener(APP_READY,()=>{
  let root=player.floorMeshes[0];if(!root||!config.occlusion)return;
  while(root.parent&&!root.parent.isScene)root=root.parent;
  occlusion=createCameraOcclusion(root,config.occlusion,player.floorMeshes);update(0);
 },{...options,once:true});
 events.addEventListener(FULLMODE_ENTER,()=>{fullMode=true;occlusion?.update(0);},options);
 events.addEventListener(FULLMODE_EXIT,()=>{fullMode=false;update(0);},options);
 window.addEventListener('pagehide',e=>{if(!e.persisted){listeners.abort();occlusion?.dispose();occlusion=null;}},options);
 function update(dt){
  if(override){override(camera,dt);return;}
  target.copy(player.position);target.y+=1.45;
  direction.set(Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch));
  // shortcut: center ray checks existing collision meshes; use a swept camera volume for edge clipping.
  ray.set(target,direction);ray.far=zoom+.3;
  const obstruction=ray.intersectObjects(player.wallMeshes.concat(player.floorMeshes),false)[0];
  const distance=obstruction?Math.min(zoom,Math.max(.12,obstruction.distance-.25)):zoom;
  camera.position.copy(target).addScaledVector(direction,distance);
  camera.lookAt(target.sub(direction));player.avatar.visible=distance>.65;
  occlusion?.update(!fullMode&&distance>.65?distance:0);
 }
 return {
  get yaw(){return yaw;},update,
  rotate(x,y){yaw-=x*.002;pitch=Math.max(-1.35,Math.min(1.35,pitch-y*.002));},
  reset(value=-Math.PI/2){yaw=value;pitch=-.2;},
  setOverride(fn){override=fn;if(fn)occlusion?.update(0);if(fn===null){camera.fov=defaultFov;camera.updateProjectionMatrix();}},
 };
}
