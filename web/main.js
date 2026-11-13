import * as THREE from 'three';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {createCrowdMotion} from './crowd-motion.js';
import {createAvatar} from './avatar.js';
import {createMultiplayer} from './multiplayer.js';
import {createHybridLighting} from './lighting.js';
import {APP_READY,WORLD_CLICK,events} from './events.js';
import {modules} from './modules.js';
import {createInput} from './input.js';
import {createPlayerController} from './player-controller.js';
import {createCameraRig} from './camera-rig.js';
import {createRenderBatches} from './render-batch.js';

const scene=new THREE.Scene();scene.background=new THREE.Color('#1a2c45');
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.08,650);
camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',alpha:true});
renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=1;
const cssLayer=document.createElement('div'),uiRoot=document.createElement('div');
cssLayer.id='css-layer';uiRoot.id='ui-root';
cssLayer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:0';
renderer.domElement.style.cssText='position:fixed;inset:0;z-index:0';
uiRoot.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:1';
const uiStyle=document.createElement('style');uiStyle.textContent='#ui-root>*{pointer-events:auto}';uiRoot.append(uiStyle);
document.body.prepend(cssLayer,renderer.domElement,uiRoot);
const status=document.querySelector('#status');
let ready=false,crowd=null,lighting=null;

async function start(){
 const configNames=['controls','camera','screen','seats','teams','characters','ticket','stage-monitors','crowd','environment','sky-show','stage-players','network','broadcasts'];
 const configs=Object.fromEntries(await Promise.all(configNames.map(async name=>{
  const response=await fetch('./config/'+name+'.json');
  if(!response.ok)throw Error('설정을 불러오지 못했습니다: '+name);
  return [name,await response.json()];
 })));
 const config=name=>configs[name];
 const avatar=createAvatar(0x45bfff);scene.add(avatar);
 const input=createInput({canvas:renderer.domElement,events,controls:config('controls'),isReady:()=>ready,
  onLook:(x,y)=>cameraRig.rotate(x,y),onJump:()=>player.jump(),onClick:worldClick});
 const player=createPlayerController({avatar,input,getYaw:()=>cameraRig.yaw,onTeleport:yaw=>cameraRig.reset(yaw),clickSit:config('seats').clickSit});
 const cameraRig=createCameraRig({camera,player,config:config('camera')});
 const clickRay=new THREE.Raycaster(),pointer=new THREE.Vector2(),normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
 function worldClick(x,y){
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);
  clickRay.setFromCamera(pointer,camera);
  const hit=clickRay.intersectObjects(player.floorMeshes,false).find(hit=>normal.copy(hit.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).y>0);
  const point=hit?.point.toArray()??null;
  const event=new CustomEvent(WORLD_CLICK,{cancelable:true,detail:{ray:{origin:clickRay.ray.origin.toArray(),direction:clickRay.ray.direction.toArray()},point}});
  if(events.dispatchEvent(event)&&point)player.walkTo(point);
 }
 let cameraDirty=true,cameraOverride=false;
 const cameraPlayer=new THREE.Vector3(Infinity,Infinity,Infinity),invalidateCamera=()=>{cameraDirty=true;};
 // The obstruction geometry is static; an active camera override still runs every frame.
 for(const [owner,name] of [[cameraRig,'rotate'],[cameraRig,'reset'],[player,'addBlocker'],[player,'removeBlocker']]){
  const original=owner[name];owner[name]=(...args)=>{invalidateCamera();return original(...args);};
 }
 const setOverride=cameraRig.setOverride;
 cameraRig.setOverride=fn=>{cameraOverride=fn!==null;invalidateCamera();setOverride(fn);};
 renderer.domElement.addEventListener('wheel',invalidateCamera,{passive:true});
 const ctx={THREE,scene,camera,renderer,root:null,cssLayer,uiRoot,events,config,player,cameraRig,input};
 const multiplayer=createMultiplayer(scene,()=>[player.position.x,player.position.y,player.position.z,avatar.rotation.y],ctx);
 ctx.multiplayer=multiplayer;
 // Local verification uses the same movement and collision code as keyboard input.
 window.arena={get ready(){return ready;},camera,player:player.position,avatar,multiplayer,get crowd(){return crowd;},get lighting(){return lighting;},go:player.teleport,attempt:player.attempt,groundAt:player.groundAt,get state(){return {x:player.position.x,y:player.foot,z:player.position.z,walking:input.walking,airborne:player.airborne,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}};
 player.teleport('plaza');
 let instances=[],last=performance.now(),frameId;
 function frame(now){
  frameId=requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;
  if(ready)player.update(dt);else avatar.position.copy(player.position);
  for(const instance of instances)instance.update?.(dt,now);
  if(cameraOverride||cameraDirty||!cameraPlayer.equals(player.position)){
   cameraRig.update(dt);cameraPlayer.copy(player.position);cameraDirty=false;
  }
  multiplayer.update(now);crowd?.update(now);
  const position=player.position,inside=position.x>-95&&position.x<94&&Math.abs(position.z)<70;
  lighting?.update(inside,position);
  renderer.render(scene,camera);
 }
 frameId=requestAnimationFrame(frame);
 const resize=()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);};
 window.addEventListener('resize',resize);
 window.addEventListener('pagehide',event=>{
  if(event.persisted)return;
  cancelAnimationFrame(frameId);
  for(const instance of [...instances].reverse())instance.dispose?.();
  ctx.renderBatches?.dispose();renderer.domElement.removeEventListener('wheel',invalidateCamera);
  input.dispose();window.removeEventListener('resize',resize);renderer.dispose();
 });
 const draco=new DRACOLoader().setDecoderPath('./vendor/draco/').setDecoderConfig({type:'wasm'}).setWorkerLimit(2);
 const g=await new GLTFLoader().setDRACOLoader(draco).loadAsync('./arena-v2.glb',e=>{
  if(e.total)status.textContent='경기장 불러오는 중 '+Math.round(e.loaded/e.total*100)+'%';
 });
 // Keep the unsplit crowd off the GPU until its distance-based representation is ready.
 g.scene.visible=false;scene.add(g.scene);g.scene.updateMatrixWorld(true);ctx.root=g.scene;
 g.scene.traverse(o=>{if(!o.isMesh)return;
  o.geometry.computeBoundingBox();o.geometry.computeBoundingSphere();
  if(o.name==='Stage_light_beams'){o.material.transparent=true;o.material.opacity=.025;o.material.depthWrite=false;o.material.blending=THREE.AdditiveBlending;}
 });
 player.registerWorld(g.scene);
 invalidateCamera();
 status.textContent='경기장 조명 불러오는 중';
 lighting=await createHybridLighting(g.scene,renderer,scene);
 crowd=createCrowdMotion(g.scene,ctx);
 instances=modules.map(module=>module.create(ctx));
 ctx.renderBatches=createRenderBatches(g.scene);
 g.scene.visible=true;
 ready=true;events.dispatchEvent(new CustomEvent(APP_READY));
}
start().catch(error=>{
 status.textContent='경기장을 불러오지 못했습니다. start.ps1로 서버를 실행한 뒤 다시 열어주세요.';console.error(error);
});
