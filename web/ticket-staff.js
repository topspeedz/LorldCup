import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {clone} from './vendor/SkeletonUtils.js';

export function create(ctx){
 const {THREE,scene}=ctx,config=ctx.config('ticket-staff'),chars=ctx.config('characters');
 const staff=[],resources=new Set();
 const draco=new DRACOLoader().setDecoderPath('./vendor/draco/').setDecoderConfig({type:'wasm'}).setWorkerLimit(1);
 let ready=false,disposed=false,error=null;
 function retain(root){
  root.traverse(object=>{
   if(object.isMesh){
    resources.add(object.geometry);resources.add(object.material);
    if(object.material.map)resources.add(object.material.map);
   }
   if(object.isSkinnedMesh)resources.add(object.skeleton);
  });
 }
 function release(){
  ready=false;
  for(const {model,mixer} of staff){mixer.stopAllAction();mixer.uncacheRoot(model);model.removeFromParent();}
  staff.length=0;
  for(const resource of resources){resource.dispose();if(resource.isTexture)resource.image?.close?.();}
  resources.clear();
 }
 async function load(){
  try{
   const loader=new GLTFLoader().setDRACOLoader(draco);
   const fan=await loader.loadAsync('./assets/characters/fan.glb');retain(fan.scene);
   if(disposed){release();return;}
   const animation=await loader.loadAsync(chars.staffClipFile);retain(animation.scene);
   if(disposed){release();return;}
   const idle=animation.animations.find(clip=>clip.name==='Idle');
   let originalUniform;
   fan.scene.traverse(object=>{if(object.material?.name==='Uniform')originalUniform=object.material;});
   if(!idle||!originalUniform||!fan.scene.getObjectByName('FanRig')||chars.ids.some(id=>!fan.scene.getObjectByName(id)))throw Error('티켓 안내 직원 자산 규약 불일치');
   const uniform=originalUniform.clone();uniform.color.set(config.uniformColor);uniform.map=null;resources.add(uniform);
   for(const [index,member] of config.staff.entries()){
    const model=clone(fan.scene);model.name='TicketStaff_'+index;
    model.position.fromArray(member.position);model.rotation.y=member.yaw;
    for(const id of chars.ids)model.getObjectByName(id).visible=id===member.character;
    model.traverse(object=>{if(object.isMesh){
     if(object.material.name==='Uniform')object.material=uniform;
     object.castShadow=true;object.receiveShadow=true;
    }});
    retain(model);
    const mixer=new THREE.AnimationMixer(model);
    mixer.clipAction(idle).setLoop(THREE.LoopRepeat,Infinity).play();
    mixer.setTime(index*idle.duration/config.staff.length);
    staff.push({model,mixer});scene.add(model);
   }
   ready=true;
  }catch(reason){error=reason.message;release();if(!disposed)console.error('티켓 안내 직원을 불러오지 못했습니다.',reason);}
  finally{draco.dispose();}
 }
 const api={staff,get ready(){return ready;},get error(){return error;},
  update(dt){if(disposed||document.hidden)return;for(const {mixer} of staff)mixer.update(dt);},
  dispose(){
   if(disposed)return;disposed=true;release();
   if(window.arena.ticketStaff===api)delete window.arena.ticketStaff;
  }
 };
 window.arena.ticketStaff=api;load();return api;
}
