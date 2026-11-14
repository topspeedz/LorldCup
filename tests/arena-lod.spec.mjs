import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import * as THREE from '../web/vendor/three.module.js';
import {createArenaLod,arenaContains} from '../web/arena-lod.js';

const bounds={minX:-61,maxX:94,maxAbsZ:70};
const source=readFileSync(new URL('../web/render-batch.js',import.meta.url),'utf8')
 .replace("'three'",JSON.stringify(new URL('../web/vendor/three.module.js',import.meta.url).href));
const {createRenderBatches}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(){
 const config=JSON.parse(readFileSync(new URL('../web/config/arena-lod.json',import.meta.url),'utf8'));
 const scene=new THREE.Scene(),root=new THREE.Group(),camera=new THREE.PerspectiveCamera(68,1,.08,650);
 scene.add(root);scene.background=new THREE.Texture();
 const material=new THREE.MeshStandardMaterial({map:new THREE.Texture(),lightMap:new THREE.Texture(),normalMap:new THREE.Texture()});
 material.onBeforeCompile=shader=>{shader.uniforms.bakedLightRange={value:32};};
 material.customProgramCacheKey=()=> 'baked-fixture';
 const meshes={};
 for(const name of ['EXR_Folded_corten_facade','EXR_Canopy_upper_panels','EXR_Folded_corten_facade__lod10','CityWindows__glass','Collide_Arena_shell__black','Suite_fascia__ivory','REF_CenterBackdrop__Obsidian','Seats__seat','Walk_ArenaFloor__black','RemoteFan']){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),material);mesh.name=name;root.add(mesh);meshes[name]=mesh;
 }
 const sky=new THREE.Group();sky.name='Sky_Show';scene.add(sky);
 const player={position:new THREE.Vector3(-139,0,0)},calls=[];
 const crowd={setVisible:value=>calls.push(value)};
 const cssLayer={style:{display:''},hasAttribute:()=>false};
 const ctx={THREE,scene,root,camera,player,cssLayer,config:name=>name==='screen'?{arenaBounds:bounds}:config};
 root.updateMatrixWorld(true);
 const lod=createArenaLod(ctx,crowd),batches=createRenderBatches(root);lod.bindBatches(batches);
 const view=(x,z,targetX,targetZ)=>{player.position.set(x,0,z);camera.position.set(x,2,z);camera.lookAt(targetX,2,targetZ);camera.updateMatrixWorld(true);lod.update();};
 return {ctx,lod,batches,meshes,material,sky,calls,view,dispose(){lod.dispose();batches.dispose();}};
}

test('T80 CPU: arena boundary has a half-metre dead band and rejects invalid positions',()=>{
 expect(arenaContains({x:-61,z:0},bounds,null,.5)).toBe(true);
 expect(arenaContains({x:-60.8,z:0},bounds,false,.5)).toBe(false);
 expect(arenaContains({x:-60.4,z:0},bounds,false,.5)).toBe(true);
 expect(arenaContains({x:-61.4,z:0},bounds,true,.5)).toBe(true);
 expect(arenaContains({x:-61.6,z:0},bounds,true,.5)).toBe(false);
 expect(arenaContains({x:94.4,z:0},bounds,true,.5)).toBe(true);
 expect(arenaContains({x:94.6,z:0},bounds,true,.5)).toBe(false);
 expect(arenaContains({x:0,z:70.6},bounds,true,.5)).toBe(false);
 expect(arenaContains({x:NaN,z:0},bounds,true,.5)).toBe(true);
});

test('T80 CPU: outside restores the facade, inside hides both variants and all exterior batches',()=>{
 const f=fixture();
 try{
  f.view(-139,0,0,0);
  expect(f.meshes.EXR_Folded_corten_facade.visible).toBe(true);
  expect(f.meshes.EXR_Folded_corten_facade__lod10.visible).toBe(false);
  expect(f.calls.at(-1)).toBe(false);
  const exteriorBatch=f.batches.batches.find(b=>b.material===f.meshes.EXR_Folded_corten_facade.material);
  expect(exteriorBatch).toBeTruthy();expect(exteriorBatch.visible).toBe(true);
  f.view(-25,0,0,0);
  expect(f.lod.inside).toBe(true);expect(f.calls.at(-1)).toBe(true);
  expect(f.meshes.EXR_Folded_corten_facade.visible).toBe(false);
  expect(f.meshes.EXR_Folded_corten_facade__lod10.visible).toBe(false);
  expect(f.meshes.CityWindows__glass.visible).toBe(false);
  expect(exteriorBatch.visible).toBe(false);expect(f.sky.visible).toBe(false);expect(f.ctx.scene.background).toBe(null);
  expect(f.meshes.RemoteFan.visible).toBe(true);expect(f.meshes.Walk_ArenaFloor__black.visible).toBe(true);
  const count=f.calls.length;f.lod.update();expect(f.calls).toHaveLength(count);
  f.view(-83,0,0,0);
  expect(f.calls.at(-1)).toBe(false);expect(exteriorBatch.visible).toBe(true);expect(f.sky.visible).toBe(true);
  expect(f.ctx.scene.background).not.toBe(null);
 }finally{f.dispose();}
});

test('T80 CPU: the open entrance retains the stage and screen while an away-facing exterior view hides them',()=>{
 const f=fixture();
 try{
  f.view(-83,0,0,0);
  expect(f.lod.interiorVisible).toBe(true);expect(f.meshes.Seats__seat.visible).toBe(true);
  f.view(-139,0,-200,0);
  expect(f.lod.interiorVisible).toBe(false);expect(f.meshes.Seats__seat.visible).toBe(false);
  expect(f.meshes.REF_CenterBackdrop__Obsidian.visible).toBe(false);expect(f.ctx.cssLayer.style.display).toBe('none');
  expect(f.calls.at(-1)).toBe(false);expect(f.meshes.RemoteFan.visible).toBe(true);
  f.ctx.cssLayer.hasAttribute=()=>true;f.lod.update();expect(f.ctx.cssLayer.style.display).toBe('');
 }finally{f.dispose();}
});

test('T80 CPU: flat walls keep lightmaps and shader hooks without changing shared floor materials; disposal restores originals',()=>{
 const f=fixture(),wall=f.meshes.Collide_Arena_shell__black,floor=f.meshes.Walk_ArenaFloor__black;
 try{
  const before=wall.material;
  f.view(-25,0,0,0);
  expect(wall.material.map).toBe(null);expect(wall.material.normalMap).toBe(null);
  expect(wall.material.lightMap).toBe(f.material.lightMap);expect(wall.material.lightMapIntensity).toBe(f.material.lightMapIntensity);
  const shader={uniforms:{}};wall.material.onBeforeCompile(shader);expect(shader.uniforms.bakedLightRange.value).toBe(32);
  expect(floor.material.map).toBe(f.material.map);
  for(let i=0;i<3;i++){f.view(-83,0,0,0);expect(wall.material).toBe(before);f.view(-25,0,0,0);}
 }finally{f.dispose();}
 expect(wall.material).toBe(f.material);expect(wall.visible).toBe(true);expect(f.meshes.EXR_Folded_corten_facade.layers.mask).toBe(1);
});

test('T80 CPU: leaving hides crowd and stops pending audio; re-entry restores local audio without changing screen state',async()=>{
 const source=readFileSync(new URL('../web/crowd-motion.js',import.meta.url),'utf8')
  .replace("'three'",JSON.stringify(new URL('../web/vendor/three.module.js',import.meta.url).href))
  .replace("'./events.js'",JSON.stringify(new URL('../web/events.js',import.meta.url).href))
  .replaceAll('import.meta.url',JSON.stringify(new URL('../web/crowd-motion.js',import.meta.url).href));
 const {createCrowdMotion}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const saved=Object.fromEntries(['window','Audio','fetch'].map(key=>[key,globalThis[key]]));
 let crowd;
 try{
  globalThis.window=new EventTarget();
  let finishPlay,rejectPlay;
  globalThis.Audio=class{
   paused=true;currentTime=0;plays=0;
   play(){this.paused=false;this.plays++;return new Promise((resolve,reject)=>{finishPlay=resolve;rejectPlay=reject;});}
   pause(){this.paused=true;}
  };
  globalThis.fetch=async()=>({ok:true,blob:async()=>new Blob(['sound'])});
  const root=new THREE.Group(),geometry=new THREE.BoxGeometry(),mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial());
  for(const [name,values]of Object.entries({_cm_origin:[0,0,0],_cm_right:[1,0,0],_cm_front:[0,-1,0],_cm_part:[1],_cm_side:[0],_cm_seed:[.5],_cm_style:[0]})){
   geometry.setAttribute(name,new THREE.Float32BufferAttribute(Array.from({length:geometry.attributes.position.count},()=>values).flat(),values.length));
  }
  root.add(mesh);root.updateMatrixWorld(true);
  const events=new EventTarget(),ctx={events,camera:new THREE.PerspectiveCamera(),config:name=>name==='screen'?{crowdVolume:.3,volume:70}:null};
  crowd=createCrowdMotion(root,ctx);await new Promise(resolve=>setImmediate(resolve));
  const state={muted:false,userVolume:70},event=new Event('screen:state');event.detail=state;events.dispatchEvent(event);
  expect(crowd.audio.plays).toBe(1);
  crowd.setVisible(false);expect(mesh.visible).toBe(false);expect(crowd.audio.paused).toBe(true);
  finishPlay();await Promise.resolve();expect(crowd.sounding).toBe(false);
  events.dispatchEvent(event);expect(crowd.audio.plays).toBe(1);
  crowd.setVisible(true);expect(mesh.visible).toBe(true);expect(crowd.audio.plays).toBe(2);
  finishPlay();await Promise.resolve();expect(crowd.sounding).toBe(true);expect(state).toEqual({muted:false,userVolume:70});
  crowd.setVisible(false);crowd.setVisible(true);
  crowd.setVisible(false);crowd.setVisible(true);
  finishPlay();await Promise.resolve();expect(crowd.audio.plays).toBe(4);
  finishPlay();await Promise.resolve();expect(crowd.sounding).toBe(true);
  crowd.setVisible(false);crowd.setVisible(true);crowd.setVisible(false);crowd.setVisible(true);
  rejectPlay({name:'AbortError'});await Promise.resolve();await Promise.resolve();expect(crowd.audio.plays).toBe(6);
  finishPlay();await Promise.resolve();expect(crowd.sounding).toBe(true);
  crowd.dispose();geometry.dispose();mesh.material.dispose();
 }finally{crowd?.dispose();for(const [key,value]of Object.entries(saved))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
