import * as THREE from 'three';
import {SCREEN_STATE} from './events.js';

// Replays the Blender seated-crowd graph using the GLB's per-vertex joint metadata.
const deformation = `
uniform float crowdTime;
uniform bool crowdMannequin;
attribute vec3 _cm_origin;
attribute vec3 _cm_right;
attribute vec3 _cm_front;
attribute float _cm_part;
attribute float _cm_side;
attribute float _cm_seed;
attribute float _cm_style;
const float CM_PI = 3.141592653589793;
vec3 cmRotate(vec3 p,vec3 center,vec3 axis,float angle){
 vec3 q=p-center;float c=cos(angle),s=sin(angle);
 return center+q*c+cross(axis,q)*s+axis*dot(axis,q)*(1.0-c);
}
float cmWave(float t,float cycles,float phase){return sin(t*(2.0*CM_PI*cycles/30.0)+phase);}
float cmBurst(float t,float start,float end){return smoothstep(start,start+.48,t)*(1.0-smoothstep(end,end+1.6,t));}
vec3 crowdPose(vec3 raw){
 vec3 source=vec3(raw.x,-raw.z,raw.y);
 vec3 rel=source-_cm_origin;
 vec3 p=vec3(dot(rel,_cm_right),dot(rel,_cm_front),rel.z);
 float t=mod(crowdTime,30.0),phase=_cm_seed*2.0*CM_PI,side=_cm_side;
 float td=t-(.06+_cm_seed*.38);
 float groupCheer=max(cmBurst(td,12.0,16.0),cmBurst(td,23.5,26.5));
 if(crowdMannequin&&groupCheer<=0.0)return raw;
 float idle=crowdMannequin?0.0:1.0;
 float individual=.38*smoothstep(.91,1.0,cmWave(t,2.0,phase));
 float cheer=max(groupCheer,individual*idle),clapper=abs(_cm_style-1.0)<.5?1.0:0.0;
 float clap=clapper*cheer,strength=.78+_cm_seed*.22;
 float armWave=cmWave(t,51.0,phase+side*.9);
 float raiseAngle=cheer*strength*1.7+cheer*armWave*.16-clap*1.18+idle*cmWave(t,7.0,phase)*.04;
 float inactive=((side<0.0&&_cm_seed>.73)||(side>0.0&&_cm_seed<.27))?1.0:0.0;
 raiseAngle*=1.0-.62*inactive*(1.0-clapper);
 float elbowAngle=cheer*.28+clap*.55;
 float clapAngle=side*clap*(.36+cmWave(t,75.0,phase)*.28);
 vec3 shoulder=vec3(side*.195,.005,.965),elbow=vec3(side*.22,.12,.73),wrist=vec3(side*.17,.31,.66);
 if(_cm_part>4.5){
  p=cmRotate(p,wrist,vec3(1,0,0),-.87*(raiseAngle+elbowAngle));
  p=cmRotate(p,wrist,vec3(0,1,0),cheer*cmWave(t,66.0,phase)*.16);
 }
 if(_cm_part>3.5)p=cmRotate(p,elbow,vec3(1,0,0),elbowAngle);
 if(_cm_part>2.5){p=cmRotate(p,shoulder,vec3(1,0,0),raiseAngle);p=cmRotate(p,shoulder,vec3(0,0,1),clapAngle);}
 if(abs(_cm_part-2.0)<.5){
  p=cmRotate(p,vec3(0,0,1.015),vec3(1,0,0),idle*cmWave(t,9.0,phase)*.045-cheer*.08);
  p=cmRotate(p,vec3(0,0,1.015),vec3(0,0,1),idle*cmWave(t,4.0,phase)*.085);
 }
 if(_cm_part>.5){
  float lean=idle*cmWave(t,5.0,phase)*.025+cheer*(-.07+cmWave(t,38.0,phase)*.018);
  p=cmRotate(p,vec3(0,0,.53),vec3(1,0,0),lean);
  p=cmRotate(p,vec3(0,0,.53),vec3(0,0,1),idle*cmWave(t,3.0,phase)*.025);
 }
 vec3 result=_cm_origin+_cm_right*p.x+_cm_front*p.y+vec3(0,0,p.z);
 return vec3(result.x,result.z,-result.y);
}
`;

function crowdSubset(source,indices){
 const geometry=new THREE.BufferGeometry(),vertices=[...new Set(indices)],remap=new Map(vertices.map((v,i)=>[v,i]));
 for(const [name,a] of Object.entries(source.attributes)){
  const values=new a.array.constructor(vertices.length*a.itemSize);
  for(let i=0;i<vertices.length;i++)for(let j=0;j<a.itemSize;j++)values[i*a.itemSize+j]=a.array[vertices[i]*a.itemSize+j];
  geometry.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize,a.normalized));
 }
 geometry.setIndex(indices.map(v=>remap.get(v)));return geometry;
}

function selectCrowd(meshes,config){
 const seats=[],grid=new Map(),caches=new Map(),point=new THREE.Vector3();
 const at=(p,create=false)=>{
  const x=Math.floor(p.x*10),y=Math.floor(p.y*10),z=Math.floor(p.z*10);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
   const seat=grid.get(`${x+dx},${y+dy},${z+dz}`)?.find(s=>s.position.distanceToSquared(p)<.025**2);
   if(seat)return seat;
  }
  if(!create)return null;
  const key=`${x},${y},${z}`,seat={id:seats.length,position:p.clone(),upper:p.y>config.upperFloorHeight,rear:p.x>=config.density.rearMinX,keep:false};
  if(!grid.has(key))grid.set(key,[]);grid.get(key).push(seat);seats.push(seat);return seat;
 };
 const position=(mesh,v)=>{
  const a=mesh.geometry.attributes._cm_origin;
  return point.set(a.getX(v),a.getZ(v),-a.getY(v)).applyMatrix4(mesh.matrixWorld);
 };
 for(const mesh of meshes){
  const a=mesh.geometry.attributes,seen=new Set();caches.set(mesh,new Map());
  for(let v=0;v<a.position.count;v++){
   if(Math.round(a._cm_part.getX(v))!==1)continue;
   const p=position(mesh,v),key=p.toArray().join(',');if(seen.has(key))continue;seen.add(key);
   const seat=at(p,true);
   seat.variant=mesh.material.name+(seat.upper?'/upper':'/lower');
   seat.front=new THREE.Vector3(a._cm_front.getX(v),a._cm_front.getZ(v),-a._cm_front.getY(v)).transformDirection(mesh.matrixWorld);
  }
 }
 const lookup=(mesh,v)=>{
  const a=mesh.geometry.attributes._cm_origin,key=`${a.getX(v)},${a.getY(v)},${a.getZ(v)}`,cache=caches.get(mesh);
  if(!cache.has(key))cache.set(key,at(position(mesh,v)));
  return cache.get(key);
 };
 const groups={},original={lower:0,upper:0};
 const rank=seat=>{
  const p=seat.position;let n=Math.imul(Math.round(p.x*100),73856093)^Math.imul(Math.round(p.y*100),19349663)^Math.imul(Math.round(p.z*100),83492791);
  n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;
 };
 for(const upper of [false,true])for(const rear of [false,true]){
  const group=seats.filter(s=>s.upper===upper&&s.rear===rear).sort((a,b)=>rank(a)-rank(b));
  const rate=(upper?config.density.upperKeepFraction:1-config.density.lowerEmptyFraction)*(rear?config.density.rearKeepMultiplier:1);
  const selected=group.slice(0,Math.round(group.length*rate));
  for(const seat of selected)seat.keep=!config.clearZones?.some(zone=>seat.position.toArray().every((value,axis)=>value>=zone.min[axis]&&value<=zone.max[axis]));
  const kept=selected.filter(seat=>seat.keep).length;
  groups[`${upper?'upper':'lower'}-${rear?'rear':'other'}`]={upper,rear,original:group.length,kept,cleared:selected.length-kept};original[upper?'upper':'lower']+=group.length;
 }
 const portraits=new Map();
 for(const seat of seats.filter(s=>s.keep)){
  if(!portraits.has(seat.variant))portraits.set(seat.variant,{seat,parts:[]});
  seat.portrait=[...portraits.keys()].indexOf(seat.variant);
 }
 for(const mesh of meshes){
  const source=mesh.geometry,index=source.index,count=index?.count??source.attributes.position.count,indices=[],samples=new Map();
  for(let i=0;i<count;i+=3){
   const v=index?index.getX(i):i,seat=lookup(mesh,v);if(!seat?.keep)continue;
   const triangle=[v,index?index.getX(i+1):i+1,index?index.getX(i+2):i+2];indices.push(...triangle);
   const portrait=portraits.get(seat.variant);
   if(portrait.seat===seat){if(!samples.has(portrait))samples.set(portrait,[]);samples.get(portrait).push(...triangle);}
  }
  for(const [portrait,part] of samples)portrait.parts.push({geometry:crowdSubset(source,part),material:mesh.material,matrix:mesh.matrixWorld.clone()});
  const filtered=new THREE.BufferGeometry();
  for(const [name,a] of Object.entries(source.attributes))filtered.setAttribute(name,a);
  filtered.setIndex(indices);filtered.boundingSphere=source.boundingSphere?.clone();filtered.boundingBox=source.boundingBox?.clone();mesh.geometry=filtered;
 }
 return {seats:seats.filter(s=>s.keep),portraits:[...portraits.values()],lookup,at,density:{original,groups}};
}

function createCrowdLod(root,meshes,mannequins,selection,ctx,config){
 const {renderer,scene,camera}=ctx,{seats,portraits}=selection,chunks=new Map(),inverseRoot=root.matrixWorld.clone().invert();
 const chunkFor=seat=>{
  const p=seat.position,size=config.cellSize,key=[p.x,p.y,p.z].map(n=>Math.floor(n/size)).join(',');
  if(!chunks.has(key))chunks.set(key,{upper:seat.upper,bounds:new THREE.Box3(),seats:[],sources:[],details:[],near:false});
  return chunks.get(key);
 };
 seats.forEach((seat,i)=>{seat.card=i;const chunk=chunkFor(seat);chunk.seats.push(seat);chunk.bounds.expandByPoint(seat.position);});
 for(const source of [...meshes,...mannequins]){
  source.visible=false;const groups=new Map(),matrix=new THREE.Matrix4(),p=new THREE.Vector3();
  const g=source.geometry,count=source.isInstancedMesh?source.count:g.index.count;
  for(let i=0;i<count;i+=source.isInstancedMesh?1:3){
   let seat;
   if(source.isInstancedMesh){source.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix).applyMatrix4(root.matrixWorld);seat=selection.at(p);}
   else seat=selection.lookup(source,g.index.getX(i));
   if(!seat?.keep)continue;
   const chunk=chunkFor(seat);if(!groups.has(chunk))groups.set(chunk,[]);
   const indices=groups.get(chunk);if(source.isInstancedMesh)indices.push(i);else indices.push(g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2));
  }
  for(const [chunk,indices] of groups)chunk.sources.push({source,indices});
 }
 // Eight views of real seated models form the static distant pictures; no full far model is uploaded.
 const atlas=new THREE.WebGLRenderTarget(8*96,portraits.length*128),capture=new THREE.Scene();capture.environment=scene.environment;
 for(const object of scene.children)if(object.isLight){const light=object.clone();light.castShadow=false;capture.add(light);if(object.target){light.target=object.target.clone();capture.add(light.target);}}
 const view=new THREE.OrthographicCamera(-.6,.6,.8,-.8,.1,20),target=new THREE.Vector3(),right=new THREE.Vector3();
 const oldTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4());
 const scissorTest=renderer.getScissorTest(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
 renderer.setRenderTarget(atlas);renderer.setClearColor(0,0);atlas.scissorTest=true;
 portraits.forEach((portrait,row)=>{
  const objects=portrait.parts.map(part=>{const mesh=new THREE.Mesh(part.geometry,part.material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(part.matrix);capture.add(mesh);return mesh;});
  target.copy(portrait.seat.position);target.y+=.7;right.set(portrait.seat.front.z,0,-portrait.seat.front.x);
  for(let side=0;side<8;side++){
   const angle=side*Math.PI/4;view.position.copy(target).addScaledVector(portrait.seat.front,Math.cos(angle)*4).addScaledVector(right,Math.sin(angle)*4);view.lookAt(target);
   atlas.viewport.set(side*96,row*128,96,128);atlas.scissor.set(side*96,row*128,96,128);renderer.setRenderTarget(atlas);renderer.render(capture,view);
  }
  for(const object of objects){capture.remove(object);object.geometry.dispose();}
 });
 renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clear,alpha);
 const geometry=new THREE.PlaneGeometry(1.2,1.6),material=new THREE.MeshBasicMaterial({map:atlas.texture,alphaTest:.5,side:THREE.DoubleSide});
 const show=new THREE.InstancedBufferAttribute(new Float32Array(seats.length).fill(1),1);
 geometry.setAttribute('crowdShow',show);geometry.setAttribute('crowdPortrait',new THREE.InstancedBufferAttribute(new Float32Array(seats.map(s=>s.portrait)),1));
 geometry.setAttribute('crowdFacing',new THREE.InstancedBufferAttribute(new Float32Array(seats.flatMap(s=>[s.front.x,s.front.z])),2));
 material.onBeforeCompile=shader=>{
  shader.vertexShader='attribute float crowdShow;\nattribute float crowdPortrait;\nattribute vec2 crowdFacing;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec4 seatWorld=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
   vec3 toward=normalize(vec3(cameraPosition.x-seatWorld.x,0.,cameraPosition.z-seatWorld.z));
   vec3 right=vec3(toward.z,0.,-toward.x);
   float angle=atan(dot(toward.xz,vec2(crowdFacing.y,-crowdFacing.x)),dot(toward.xz,crowdFacing));
   float viewIndex=mod(floor(angle/(6.28318530718/8.)+.5)+8.,8.);
   vMapUv=vec2((uv.x+viewIndex)/8.,(uv.y+crowdPortrait)/${portraits.length.toFixed(1)});
   vec4 mvPosition=viewMatrix*vec4(seatWorld.xyz+right*position.x+vec3(0.,position.y,0.),1.);
   gl_Position=projectionMatrix*mvPosition;
   if(crowdShow<.5)gl_Position=vec4(2.,2.,2.,1.);
  `);
 };
 const impostors=new THREE.InstancedMesh(geometry,material,seats.length),matrix=new THREE.Matrix4();
 impostors.name='Audience_DistantPictures';
 seats.forEach((seat,i)=>{const p=seat.position.clone();p.y+=.7;matrix.makeTranslation(...p.toArray()).premultiply(inverseRoot);impostors.setMatrixAt(i,matrix);});
 impostors.instanceMatrix.needsUpdate=true;impostors.computeBoundingSphere();impostors.boundingSphere.radius+=2;root.add(impostors);
 const last=new THREE.Vector3(Infinity,Infinity,Infinity),position=new THREE.Vector3();
 const release=chunk=>{for(const mesh of chunk.details){mesh.removeFromParent();mesh.geometry.dispose();if(mesh.isInstancedMesh)mesh.dispose();}chunk.details=[];};
 const update=()=>{
  camera.getWorldPosition(position);if(position.distanceToSquared(last)<.25)return;last.copy(position);
  for(const chunk of chunks.values()){
   const near=chunk.bounds.distanceToPoint(position)<(chunk.near?config.farDistance:config.nearDistance);if(near===chunk.near)continue;
   chunk.near=near;
   if(near)for(const {source,indices} of chunk.sources){
    let mesh;
    if(source.isInstancedMesh){
     const g=source.geometry.clone();
     for(const name of ['_cm_seed','_cm_style'])g.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(indices.map(i=>source.geometry.attributes[name].getX(i))),1));
     mesh=new THREE.InstancedMesh(g,source.material,indices.length);
     indices.forEach((index,i)=>{source.getMatrixAt(index,matrix);mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;
    }else mesh=new THREE.Mesh(crowdSubset(source.geometry,indices),source.material);
    mesh.name=source.name+'_Near';mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
    mesh.matrixAutoUpdate=false;mesh.matrix.copy(inverseRoot).multiply(source.matrixWorld);
    if(mesh.isInstancedMesh){mesh.computeBoundingSphere();mesh.boundingSphere.radius+=1;}
    else{mesh.geometry.computeBoundingSphere();mesh.geometry.boundingSphere.radius+=1;}
    root.add(mesh);chunk.details.push(mesh);
   }else release(chunk);
   for(const seat of chunk.seats)show.setX(seat.card,near?0:1);show.needsUpdate=true;
  }
 };
 update();
 return {chunks:[...chunks.values()],impostors,update,dispose(){
  for(const chunk of chunks.values())release(chunk);impostors.removeFromParent();impostors.dispose();geometry.dispose();material.dispose();atlas.dispose();
 }};
}

function splitUpperCrowd(root,meshes,config,animate){
 const batches=new Map(),seats=new Map(),mannequins=[],stats={upperSpectators:0,lowerSpectators:0};
 const point=new THREE.Vector3(),normal=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 const inverseRoot=root.matrixWorld.clone().invert();
 const countSeat=(position,upper)=>{
  const [x,y,z]=position.toArray().map(n=>Math.floor(n*10));
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
   if(seats.get(`${x+dx},${y+dy},${z+dz}`)?.some(seat=>seat.distanceToSquared(position)<.025**2))return;
  }
  const key=`${x},${y},${z}`;
  if(!seats.has(key))seats.set(key,[]);
  seats.get(key).push(position.clone());stats[upper?'upperSpectators':'lowerSpectators']++;
 };
 for(const mesh of meshes){
  const source=mesh.geometry,a=source.attributes,lower=[],components=new Map(),counted=new Set();
  const index=source.index,count=index?.count??a.position.count;
  for(let i=0;i<count;i+=3){
   const v=index?index.getX(i):i,part=Math.round(a._cm_part.getX(v)),side=Math.round(a._cm_side.getX(v));
   const ox=a._cm_origin.getX(v),oy=a._cm_origin.getY(v),oz=a._cm_origin.getZ(v);
   point.set(ox,oz,-oy).applyMatrix4(mesh.matrixWorld);
   const upper=point.y>config.upperFloorHeight,originKey=`${ox},${oy},${oz}`;
   if(part===1&&!counted.has(originKey)){countSeat(point,upper);counted.add(originKey);}
   if(!upper){for(let j=0;j<3;j++)lower.push(index?index.getX(i+j):i+j);continue;}
   // Hands join the simpler forearm; the existing head and hair keep their silhouette.
   if(part===5)continue;
   const key=`${originKey}/${part}/${side}`;
   let component=components.get(key);
   if(!component){component={v,part,side,indices:[]};components.set(key,component);}
   for(let j=0;j<3;j++)component.indices.push(index?index.getX(i+j):i+j);
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(a))geometry.setAttribute(name,attribute);
  geometry.setIndex(lower);geometry.boundingSphere=source.boundingSphere?.clone()??null;
  geometry.boundingBox=source.boundingBox?.clone()??null;mesh.geometry=geometry;
  for(const {v,part,side,indices} of components.values()){
   const origin=new THREE.Vector3(a._cm_origin.getX(v),a._cm_origin.getZ(v),-a._cm_origin.getY(v));
   const right=new THREE.Vector3(a._cm_right.getX(v),a._cm_right.getZ(v),-a._cm_right.getY(v));
   const back=new THREE.Vector3(-a._cm_front.getX(v),-a._cm_front.getZ(v),a._cm_front.getY(v));
   const frame=new THREE.Matrix4().makeBasis(right,up,back).setPosition(origin);
   const handedness=frame.determinant()<0?-1:1;
   // InstancedMesh cannot cull mirrored instances; carry the crowd basis sign in the attributes.
   if(handedness<0)frame.makeBasis(right,up,back.negate()).setPosition(origin);
   const inverse=frame.clone().invert();
   const positions=[],normals=[],uvs=[],bounds=new THREE.Box3();
   for(const vertex of indices){
    point.fromBufferAttribute(a.position,vertex).applyMatrix4(inverse);bounds.expandByPoint(point);positions.push(...point.toArray());
    normal.fromBufferAttribute(a.normal,vertex).transformDirection(inverse);normals.push(...normal.toArray());
    if(a.uv)uvs.push(a.uv.getX(vertex),a.uv.getY(vertex));
   }
   // Draco's millimetre rounding must not turn identical seated parts into separate draws.
   const shape=[...bounds.min.toArray(),...bounds.max.toArray()].map(n=>Math.round(n*10)).join(',');
   const key=`${mesh.material.uuid}/${part}/${side}/${handedness}/${part===3||part===4?'arm':`${indices.length}/${shape}`}`;
   let batch=batches.get(key);
   if(!batch){
    let template;
    if(part===3||part===4){
     const start=new THREE.Vector3(side*(part===3?.195:.22),part===3?.965:.73,(part===3?-.005:-.12)*handedness);
     const end=new THREE.Vector3(side*(part===3?.22:.17),part===3?.73:.66,(part===3?-.12:-.365)*handedness);
     template=new THREE.CylinderGeometry(part===3?.066:.048,part===3?.052:.031,start.distanceTo(end),3,1,true);
     template.setIndex([...template.index.array,0,1,2,4,6,5]);template.computeVertexNormals();
     template.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,start.clone().sub(end).normalize()));
     template.translate(...start.add(end).multiplyScalar(.5).toArray());
    }else{
     template=new THREE.BufferGeometry();template.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
     template.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
     if(a.uv)template.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    }
    for(const [name,values] of Object.entries({_cm_origin:[0,0,0],_cm_right:[1,0,0],_cm_front:[0,handedness,0],_cm_part:[part],_cm_side:[side]})){
     const data=new Float32Array(template.attributes.position.count*values.length);
     for(let i=0;i<data.length;i+=values.length)data.set(values,i);
     template.setAttribute(name,new THREE.BufferAttribute(data,values.length));
    }
    batch={geometry:template,material:animate(mesh.material,true),castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,matrices:[],seeds:[],styles:[]};batches.set(key,batch);
   }
   batch.matrices.push(inverseRoot.clone().multiply(mesh.matrixWorld).multiply(frame));
   batch.seeds.push(a._cm_seed.getX(v));batch.styles.push(a._cm_style.getX(v));
  }
 }
 for(const batch of batches.values()){
  batch.geometry.setAttribute('_cm_seed',new THREE.InstancedBufferAttribute(new Float32Array(batch.seeds),1));
  batch.geometry.setAttribute('_cm_style',new THREE.InstancedBufferAttribute(new Float32Array(batch.styles),1));
  const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.matrices.length);
  mesh.name='Audience_UpperMannequin';mesh.userData.crowdMannequin=true;
  mesh.castShadow=batch.castShadow;mesh.receiveShadow=batch.receiveShadow;
  batch.matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingSphere();mesh.boundingSphere.radius+=1;root.add(mesh);mannequins.push(mesh);
 }
 return {mannequins,stats};
}

export function createCrowdMotion(root,ctx){
 const time={value:0},materials=new Map(),meshes=[],textures=[],textureCache=new Map(),saved=[];
 const config=ctx?.config('crowd'),viewer={value:new THREE.Vector3()},center={value:root.getWorldPosition(new THREE.Vector3())};
 const oppositeCos=Math.cos((config?.oppositeAngleDegrees??60)*Math.PI/180);
 const reduced=(near,scale)=>{
  const key=`${near.uuid}/${scale}`;
  if(textureCache.has(key))return textureCache.get(key);
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.floor(near.image.width*scale));canvas.height=Math.max(1,Math.floor(near.image.height*scale));
  canvas.getContext('2d').drawImage(near.image,0,0,canvas.width,canvas.height);
  const far=near.clone();far.source=new THREE.Source(canvas);far.needsUpdate=true;
  textures.push({near,far});textureCache.set(key,far);return far;
 };
 const animate=(original,upper=false)=>{
  const key=`${original.uuid}/${upper}`;
  if(materials.has(key))return materials.get(key);
  const material=original.clone(),far=config&&original.map?reduced(original.map,upper?config.mannequinTextureScale:config.farTextureScale):null;
  if(upper&&far)material.map=far;
  if(upper&&/^AudienceDetail_Face/.test(original.name)){
   const skin=meshes.find(mesh=>mesh.material.name===original.name.replace('Face','Skin'));
   if(skin){material.map=null;material.color.copy(skin.material.color);}
  }
  material.onBeforeCompile=shader=>{
   shader.uniforms.crowdTime=time;shader.uniforms.crowdMannequin={value:upper};
   shader.vertexShader=deformation+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
    '#include <beginnormal_vertex>\nobjectNormal=normalize(crowdPose(position+objectNormal)-crowdPose(position));');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=crowdPose(position);');
   if(far&&!upper){
    shader.uniforms.crowdViewer=viewer;shader.uniforms.crowdCenter=center;shader.uniforms.crowdOppositeCos={value:oppositeCos};shader.uniforms.crowdFarMap={value:far};
    shader.vertexShader='uniform vec3 crowdViewer;\nuniform vec3 crowdCenter;\nuniform float crowdOppositeCos;\nvarying float crowdFar;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec3 crowdSeat=(modelMatrix*vec4(_cm_origin.x,_cm_origin.z,-_cm_origin.y,1.0)).xyz;
     vec2 opposite=crowdCenter.xz-crowdViewer.xz,seat=crowdSeat.xz-crowdCenter.xz;
     float distanceProduct=length(opposite)*length(seat);
     crowdFar=distanceProduct>0.0001&&dot(opposite,seat)>=crowdOppositeCos*distanceProduct?1.0:0.0;
     #include <project_vertex>`);
    shader.fragmentShader='uniform sampler2D crowdFarMap;\nvarying float crowdFar;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )','(crowdFar>0.5?texture2D(crowdFarMap,vMapUv):texture2D(map,vMapUv))'));
   }
  };
  material.customProgramCacheKey=()=>`barclays-crowd-upper-far:${upper}:${!!far}`;
  materials.set(key,material);return material;
 };
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry.getAttribute('_cm_part'))return;
  meshes.push(mesh);saved.push({mesh,geometry:mesh.geometry,material:mesh.material,visible:mesh.visible});
 });
 const selection=config?.density?selectCrowd(meshes,config):null,filtered=meshes.map(mesh=>mesh.geometry);
 const {mannequins,stats}=config?splitUpperCrowd(root,meshes,config,animate):{mannequins:[],stats:{}};
 if(selection)for(const geometry of filtered)geometry.dispose();
 for(const mesh of meshes){
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(material=>animate(material)):animate(mesh.material);
  mesh.geometry.computeBoundingSphere();mesh.geometry.boundingSphere.radius+=1;
 }
 const lod=selection&&config.impostor?createCrowdLod(root,meshes,mannequins,selection,ctx,config.impostor):null;
 const audio=new Audio();audio.loop=true;audio.preload='auto';
 let origin=performance.now(),sound=false,paused=false,disposed=false,audioURL,wanted=false,pending=false,blocked=false;
 const clearGesture=()=>{window.removeEventListener('pointerdown',retrySound);window.removeEventListener('keydown',retrySound);};
 const retrySound=()=>{clearGesture();blocked=false;startSound();};
 const startSound=()=>{
  if(disposed||!wanted||!audioURL||sound||pending||blocked)return;
  pending=true;audio.currentTime=time.value;
  audio.play().then(()=>{
   pending=false;sound=wanted&&!disposed&&!audio.paused;
   if(!sound)audio.pause();
  }).catch(error=>{
   pending=false;sound=false;
   if(disposed||!wanted)return;
   console.warn('Crowd audio playback failed',error);blocked=true;
   window.addEventListener('pointerdown',retrySound);window.addEventListener('keydown',retrySound);
  });
 };
 const screenState=state=>{
  const settings=ctx?.config('screen');
  audio.volume=Math.min(1,(settings?.crowdVolume??.3)*(state?.userVolume??settings?.volume??70)/(settings?.volume||70));
  wanted=state?.muted===false;
  if(wanted)startSound();
  else{audio.pause();if(sound)origin=performance.now()-time.value*1000;sound=false;blocked=false;clearGesture();}
 };
 const onScreen=event=>screenState(event.detail);ctx?.events.addEventListener(SCREEN_STATE,onScreen);
 screenState(window.arena?.screen?.state);
 // A blob remains seekable on static servers that do not support HTTP byte ranges.
 fetch(new URL('./crowd-performance.mp3',import.meta.url)).then(response=>{
  if(!response.ok)throw new Error(`Crowd audio HTTP ${response.status}`);
  return response.blob();
 }).then(blob=>{if(disposed)return;audioURL=URL.createObjectURL(blob);audio.src=audioURL;startSound();})
 .catch(error=>console.error('Crowd audio loading failed',error));
 const dispose=()=>{
  if(disposed)return;disposed=true;audio.pause();sound=false;clearGesture();
  if(audioURL)URL.revokeObjectURL(audioURL);
  ctx?.events.removeEventListener(SCREEN_STATE,onScreen);window.removeEventListener('pagehide',onPageHide);
  lod?.dispose();
  for(const mesh of mannequins){mesh.removeFromParent();mesh.geometry.dispose();mesh.dispose();}
  for(const entry of saved){if(entry.mesh.geometry!==entry.geometry)entry.mesh.geometry.dispose();entry.mesh.geometry=entry.geometry;entry.mesh.material=entry.material;entry.mesh.visible=entry.visible;}
  for(const material of materials.values())material.dispose();for(const {far} of textures)far.dispose();
 };
 const onPageHide=event=>{if(!event.persisted)dispose();};window.addEventListener('pagehide',onPageHide);
 return {
  meshes,mannequins,stats,textures,audio,dispose,lod,density:selection?.density,get time(){return time.value;},get sounding(){return sound;},
  isFar(x,y,z){
   if(y>config.upperFloorHeight)return true;
   const ox=center.value.x-viewer.value.x,oz=center.value.z-viewer.value.z,sx=x-center.value.x,sz=z-center.value.z;
   const product=Math.hypot(ox,oz)*Math.hypot(sx,sz);return product>.0001&&ox*sx+oz*sz>=oppositeCos*product;
  },
  update(now){
   if(ctx)ctx.camera.getWorldPosition(viewer.value);
   lod?.update();
   if(paused)return;
   if(sound&&!audio.paused){time.value=audio.currentTime%30;origin=now-time.value*1000;}
   else time.value=((now-origin)/1000)%30;
  },
  seek(seconds){time.value=((seconds%30)+30)%30;origin=performance.now()-time.value*1000;if(sound)audio.currentTime=time.value;},
  setPaused(value){paused=value;if(!value)origin=performance.now()-time.value*1000;}
 };
}
