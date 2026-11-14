import * as THREE from 'three';
import {SCREEN_STATE,SEAT_ENTER,SEAT_EXIT} from './events.js';

const uniformPairs={
 AudienceDetail_BLG:'AudienceDetail_GEN.G','AudienceDetail_GEN.G':'AudienceDetail_BLG',
 AudienceDetail_Black:'AudienceDetail_White',AudienceDetail_White:'AudienceDetail_Black',
 AudienceDetail_Gold:'AudienceDetail_Cyan',AudienceDetail_Cyan:'AudienceDetail_Gold'
};

export function createCrowdPreparation(work){
 let cancelled=false,pending;
 const state={ready:false,phase:'idle',
  start(){
   if(cancelled)return Promise.resolve();
   return pending??=(async()=>{
    state.phase='selection';
    let step;
    while(!cancelled&&!(step=work.next()).done){
     if(typeof step.value==='string')state.phase=step.value;
     if(step.value?.then)await step.value;
    }
    if(!cancelled){state.ready=true;state.phase='ready';}
   })();
  },
  dispose(){cancelled=true;if(pending&&!state.ready)return pending.then(()=>work.return(),()=>work.return());work.return();}
 };
 return state;
}

const seatedMotion = `
uniform bool crowdSeated;
uniform float crowdAmplitude;
uniform float crowdTempoVariation;
uniform bool crowdMotionEnabled;
uniform vec2 crowdMotionCenter;
uniform vec2 crowdMotionDirection;
uniform float crowdMotionCos;
bool crowdAcross(vec4 center){
 vec2 seat=center.xz-crowdMotionCenter;
 return crowdMotionEnabled&&dot(seat,crowdMotionDirection)>=length(seat)*crowdMotionCos;
}
bool crowdInView(vec4 center){
 vec4 clip=projectionMatrix*center;
 vec2 radius=vec2(projectionMatrix[0][0],projectionMatrix[1][1])*.9;
 return clip.w>0.0&&abs(clip.z)<=clip.w&&all(lessThanEqual(abs(clip.xy),vec2(clip.w)+radius));
}
vec2 crowdCardOffset(vec4 seatWorld,float height,float time){
 float phase=dot(seatWorld.xz,vec2(12.9898,78.233));
 float t=time+crowdTempoVariation*sin(time*6.28318530718/30.+phase)*30./6.28318530718;
 float weight=clamp((height+.8)/1.6,0.,1.);
 return vec2(sin(t*6.28318530718*13./30.+phase)*.055,sin(t*6.28318530718*23./30.+phase)*.025)*crowdAmplitude*weight;
}
`;

// Replays the Blender seated-crowd graph using the GLB's per-vertex joint metadata.
const jointMotion = `
uniform float crowdTime;
const float CM_PI = 3.141592653589793;
vec3 cmRotate(vec3 p,vec3 center,vec3 axis,float angle){
 vec3 q=p-center;float c=cos(angle),s=sin(angle);
 return center+q*c+cross(axis,q)*s+axis*dot(axis,q)*(1.0-c);
}
float cmWave(float t,float cycles,float phase){return sin(t*(2.0*CM_PI*cycles/30.0)+phase);}
float cmBurst(float t,float start,float end){return smoothstep(start,start+.48,t)*(1.0-smoothstep(end,end+1.6,t));}
vec3 cmPose(vec3 raw,vec3 origin,vec3 right,vec3 front,float part,float side,float seed,float style,bool lively,bool mannequin){
 vec3 source=vec3(raw.x,-raw.z,raw.y);
 vec3 rel=source-origin;
 vec3 p=vec3(dot(rel,right),dot(rel,front),rel.z);
 float t=mod(crowdTime,30.0),phase=seed*2.0*CM_PI;
 if(lively)t+=crowdTempoVariation*cmWave(t,1.0,phase)*30.0/(2.0*CM_PI);
 float td=t-(.06+seed*.38);
 float groupCheer=max(cmBurst(td,12.0,16.0),cmBurst(td,23.5,26.5));
 if(mannequin&&!lively&&groupCheer<=0.0)return raw;
 float idle=mannequin&&!lively?0.0:1.0;
 if(lively)idle*=crowdAmplitude;
 float individual=.38*smoothstep(.91,1.0,cmWave(t,2.0,phase));
 float cheer=max(groupCheer,individual*idle),clapper=abs(style-1.0)<.5?1.0:0.0;
 if(lively)cheer=max(cheer,.22+.3*smoothstep(-.4,1.0,cmWave(t,4.0,phase)));
 float clap=clapper*cheer,strength=.78+seed*.22;
 float armWave=cmWave(t,51.0,phase+side*.9);
 float raiseAngle=cheer*strength*1.7+cheer*armWave*.16-clap*1.18+idle*cmWave(t,7.0,phase)*.04;
 float inactive=((side<0.0&&seed>.73)||(side>0.0&&seed<.27))?1.0:0.0;
 raiseAngle*=1.0-.62*inactive*(1.0-clapper);
 float elbowAngle=cheer*.28+clap*.55;
 float clapAngle=side*clap*(.36+cmWave(t,75.0,phase)*.28);
 vec3 shoulder=vec3(side*.195,.005,.965),elbow=vec3(side*.22,.12,.73),wrist=vec3(side*.17,.31,.66);
 if(part>4.5){
  p=cmRotate(p,wrist,vec3(1,0,0),-.87*(raiseAngle+elbowAngle));
  p=cmRotate(p,wrist,vec3(0,1,0),cheer*cmWave(t,66.0,phase)*.16);
 }
 if(part>3.5)p=cmRotate(p,elbow,vec3(1,0,0),elbowAngle);
 if(part>2.5){p=cmRotate(p,shoulder,vec3(1,0,0),raiseAngle);p=cmRotate(p,shoulder,vec3(0,0,1),clapAngle);}
 if(abs(part-2.0)<.5){
  p=cmRotate(p,vec3(0,0,1.015),vec3(1,0,0),idle*cmWave(t,9.0,phase)*.045-cheer*.08);
  p=cmRotate(p,vec3(0,0,1.015),vec3(0,0,1),idle*cmWave(t,4.0,phase)*.085);
 }
 if(part>.5){
  float lean=idle*cmWave(t,5.0,phase)*.025+cheer*(-.07+cmWave(t,38.0,phase)*.018);
  p=cmRotate(p,vec3(0,0,.53),vec3(1,0,0),lean);
  p=cmRotate(p,vec3(0,0,.53),vec3(0,0,1),idle*cmWave(t,3.0,phase)*.025);
 }
 vec3 result=origin+right*p.x+front*p.y+vec3(0,0,p.z);
 return vec3(result.x,result.z,-result.y);
}
`;

const deformation = seatedMotion+jointMotion+`
uniform bool crowdMannequin;
attribute vec3 _cm_origin;
attribute vec3 _cm_right;
attribute vec3 _cm_front;
attribute float _cm_part;
attribute float _cm_side;
attribute float _cm_seed;
attribute float _cm_style;
vec3 crowdPose(vec3 raw){
 vec4 center=vec4(_cm_origin.x,_cm_origin.z+.75,-_cm_origin.y,1.0);
 #ifdef USE_INSTANCING
  center=instanceMatrix*center;
 #endif
 bool across=crowdAcross(modelMatrix*center),lively=crowdSeated||across;
 if(crowdMotionEnabled&&crowdMannequin&&!across)return raw;
 if(lively&&!crowdInView(modelViewMatrix*center))return raw;
 return cmPose(raw,_cm_origin,_cm_right,_cm_front,_cm_part,_cm_side,_cm_seed,_cm_style,lively,crowdMannequin);
}
`;

const lightstickMotion = seatedMotion+jointMotion+`
uniform float crowdStickTime;
uniform vec3 stickAngles;
uniform vec3 stickTiming;
uniform vec4 stickClasses[3];
uniform vec2 stickFractions;
uniform vec4 stickClassTiming;
uniform float stickZoneStrength;
uniform float stickTremble;
uniform vec3 stickLimits;
uniform vec2 stickSize;
attribute vec3 crowdSeat;
attribute float crowdUpper;
attribute vec3 crowdGrip;
attribute vec3 crowdPoseData;
attribute vec2 crowdForward;
attribute float crowdStickSeed;
attribute float crowdStickZone;
attribute float crowdDetail;
float stickHash(float value){return fract(sin(value*12.9898)*43758.5453);}
float stickState(float segment,float seed){return floor(stickHash(segment+seed*137.0)*5.0);}
float stickClass(float segment,float seed,float zone){
 float epoch=stickHash(seed+89.0)<stickClassTiming.w?segment:0.0;
 float rank=stickHash(seed+101.0+epoch*17.0)-zone*stickZoneStrength;
 return rank<stickFractions.x?0.0:rank<stickFractions.y?1.0:2.0;
}
float stickRate(float energy,float seed){return mix(stickClasses[int(energy)].z,stickClasses[int(energy)].w,stickHash(seed+47.0));}
float stickWave(float state,float t,float seed,float energy,float vertical){
 float phase=stickHash(seed+37.0)*2.0*CM_PI;
 float rate=stickRate(energy,seed)*2.0*CM_PI;
 if(state<.5)return vertical<.5?sin(t*rate+phase):0.0;
 if(state<1.5)return vertical>.5?sin(t*rate+phase):0.0;
 if(state<2.5)return sin((t*rate+phase)*(1.0+vertical));
 if(state<3.5)return sin(t*rate*stickTremble+phase+vertical*1.7)*.28+sin(t*rate*(stickTremble+2.0)+phase)*.12;
 return 0.0;
}
float stickClassWave(float t,float seed,float energy,float vertical){
 float duration=mix(stickTiming.x,stickTiming.y,stickHash(seed+23.0));
 float clock=t+stickHash(seed+11.0)*60.0,segment=floor(clock/duration);
 float blend=smoothstep(0.0,min(stickTiming.z,duration),clock-segment*duration);
 float wave=mix(stickWave(stickState(segment-1.0,seed),t,seed,energy,vertical),stickWave(stickState(segment,seed),t,seed,energy,vertical),blend);
 return wave*(vertical<.5?stickClasses[int(energy)].x:stickClasses[int(energy)].y);
}
float stickAngle(float t,float seed,float zone,float vertical){
 float duration=mix(stickClassTiming.x,stickClassTiming.y,stickHash(seed+83.0));
 float clock=t+stickHash(seed+97.0)*stickClassTiming.y,segment=floor(clock/duration);
 float blend=smoothstep(0.0,min(stickClassTiming.z,duration),clock-segment*duration);
 // Blend complete trajectories so a new speed cannot reset the phase.
 float wave=mix(stickClassWave(t,seed,stickClass(segment-1.0,seed,zone),vertical),stickClassWave(t,seed,stickClass(segment,seed,zone),vertical),blend);
 float rest=(stickHash(seed+71.0+vertical*19.0)*2.0-1.0)*(vertical<.5?stickAngles.y:stickAngles.z);
 if(vertical<.5)return clamp(rest+wave,-stickLimits.x,stickLimits.x);
 return clamp(stickAngles.x+rest+wave,stickLimits.y,stickLimits.z);
}
vec3 stickVertex(vec3 vertex){
 vec3 hand=crowdGrip;
 if(crowdUpper<.5&&crowdDetail>.5){
  bool lively=crowdSeated||crowdAcross(vec4(crowdSeat,1.));
  if(!lively||crowdInView(viewMatrix*vec4(crowdSeat+vec3(0.,.75,0.),1.))){
   vec3 posed=cmPose(vec3(hand.x,hand.z,-hand.y),vec3(0),vec3(1,0,0),vec3(0,1,0),5.0,crowdPoseData.x,crowdPoseData.y,crowdPoseData.z,lively,false);
   hand=vec3(posed.x,-posed.z,posed.y);
  }
 }
 vec3 anchor=(modelMatrix*instanceMatrix*vec4(hand.x,hand.z,hand.y,1.)).xyz;
 if(crowdUpper<.5&&crowdDetail<.5){
  vec4 seatWorld=vec4(crowdSeat+vec3(0.,.7,0.),1.);
  if((crowdMotionEnabled?crowdAcross(seatWorld):crowdSeated)&&crowdInView(viewMatrix*seatWorld)){
   vec3 toward=normalize(vec3(cameraPosition.x-seatWorld.x,0.,cameraPosition.z-seatWorld.z));
   vec2 offset=crowdCardOffset(seatWorld,hand.z-.7,crowdTime);
   anchor+=vec3(toward.z,0.,-toward.x)*offset.x+vec3(0.,offset.y,0.);
  }
 }
 float yaw=stickAngle(crowdStickTime,crowdStickSeed,crowdStickZone,0.0);
 float elevation=stickAngle(crowdStickTime,crowdStickSeed,crowdStickZone,1.0);
 vec3 forward=vec3(crowdForward.x,0.,crowdForward.y),right=vec3(forward.z,0.,-forward.x);
 vec3 planar=forward*cos(yaw)+right*sin(yaw),direction=planar*cos(elevation)+vec3(0.,sin(elevation),0.);
 vec3 lateral=vec3(planar.z,0.,-planar.x);
 return anchor+lateral*vertex.x*stickSize.x+direction*(vertex.y+.5)*stickSize.y+cross(lateral,direction)*vertex.z*stickSize.x;
}
`;

function* crowdSubset(source,indices){
 const geometry=new THREE.BufferGeometry(),vertices=[...new Set(indices)],remap=new Map(vertices.map((v,i)=>[v,i]));
 for(const [name,a] of Object.entries(source.attributes)){
  const values=new a.array.constructor(vertices.length*a.itemSize);
  for(let i=0;i<vertices.length;i++){
   if(i%128===0)yield;
   for(let j=0;j<a.itemSize;j++)values[i*a.itemSize+j]=a.array[vertices[i]*a.itemSize+j];
  }
  geometry.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize,a.normalized));
 }
 geometry.setIndex(indices.map(v=>remap.get(v)));return geometry;
}

function crowdRank(seat,seed=0){
 const p=seat.position;let n=Math.imul(Math.round(p.x*100),73856093)^Math.imul(Math.round(p.y*100),19349663)^Math.imul(Math.round(p.z*100),83492791)^seed;
 n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;
}

function lightstickZone(position,cellSize){
 const x=position.x/cellSize,z=position.z/cellSize,ix=Math.floor(x),iz=Math.floor(z),fx=x-ix,fz=z-iz;
 const sx=fx*fx*(3-2*fx),sz=fz*fz*(3-2*fz);
 const value=(dx,dz)=>crowdRank({position:{x:ix+dx,y:0,z:iz+dz}},105)/4294967296*2-1;
 return THREE.MathUtils.lerp(THREE.MathUtils.lerp(value(0,0),value(1,0),sx),THREE.MathUtils.lerp(value(0,1),value(1,1),sx),sz);
}

function* selectCrowd(meshes,config,uniformFrame){
 const upperBlocks=config.impostor?.representation==='upper-blocks';
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
   if(v%128===0)yield;
   if(Math.round(a._cm_part.getX(v))!==1)continue;
   const p=position(mesh,v),key=p.toArray().join(',');if(seen.has(key))continue;seen.add(key);
   const seat=at(p,true);
   seat.seed=a._cm_seed.getX(v);
   seat.bodyColor=mesh.material.color;
   seat.variant=mesh.material.name+(seat.upper?'/upper':'/lower');
   if(/^AudienceDetail_(BLG|GEN\.G)$/.test(mesh.material.name))seat.team=seat.originalTeam=mesh.material.name.slice('AudienceDetail_'.length);
   seat.front=new THREE.Vector3(a._cm_front.getX(v),a._cm_front.getZ(v),-a._cm_front.getY(v)).transformDirection(mesh.matrixWorld);
  }
 }
 const lookup=(mesh,v)=>{
  const a=mesh.geometry.attributes._cm_origin,key=`${a.getX(v)},${a.getY(v)},${a.getZ(v)}`,cache=caches.get(mesh);
  if(!cache.has(key))cache.set(key,at(position(mesh,v)));
  return cache.get(key);
 };
 const groups={},original={lower:0,upper:0};
 for(const upper of [false,true])for(const rear of [false,true]){
  const group=seats.filter(s=>s.upper===upper&&s.rear===rear).sort((a,b)=>crowdRank(a)-crowdRank(b));
  const rate=(upper?config.density.upperKeepFraction:1-config.density.lowerEmptyFraction)*(rear&&!upper?config.density.rearKeepMultiplier:1);
  const selected=group.slice(0,Math.round(group.length*rate));
  for(const seat of selected){
   yield;
   seat.keep=!config.clearZones?.some(zone=>seat.position.x>=zone.min[0]&&seat.position.x<=zone.max[0]&&seat.position.y>=zone.min[1]&&seat.position.y<=zone.max[1]&&seat.position.z>=zone.min[2]&&seat.position.z<=zone.max[2]);
  }
  const kept=selected.filter(seat=>seat.keep).length;
  groups[`${upper?'upper':'lower'}-${rear?'rear':'other'}`]={upper,rear,original:group.length,kept,cleared:selected.length-kept};original[upper?'upper':'lower']+=group.length;
 }
 const portraits=new Map();
 for(const seat of seats.filter(s=>s.keep)){
  yield;
  if(upperBlocks&&seat.upper)continue;
  if(uniformFrame&&!seat.upper&&seat.originalTeam){
   const side=point.copy(seat.position).sub(uniformFrame.center).dot(uniformFrame.right);
   const probability=.5+(config.uniformSides.favoredFraction-.5)*THREE.MathUtils.clamp(side/(config.uniformSides.centerBandWidth/2),-1,1);
   // A separate seed keeps team assignment independent of density selection.
   seat.team=crowdRank(seat,89)/4294967296<probability?'BLG':'GEN.G';seat.uniformSwap=seat.team!==seat.originalTeam;
   seat.variant=`AudienceDetail_${seat.team}/lower`;
  }
  if(!portraits.has(seat.variant))portraits.set(seat.variant,{seat,parts:[]});
  seat.portrait=[...portraits.keys()].indexOf(seat.variant);
 }
 if(upperBlocks||config.impostor?.representation==='blocks'){
  const local=new THREE.Vector3(),origin=new THREE.Vector3(),right=new THREE.Vector3(),front=new THREE.Vector3();
  for(const mesh of meshes.filter(mesh=>/^REF_FanLightsticks/.test(mesh.name))){
   const a=mesh.geometry.attributes,linear=new THREE.Matrix3().setFromMatrix4(mesh.matrixWorld);
   for(let v=0;v<a.position.count;v++){
    if(v%128===0)yield;
    const seat=lookup(mesh,v);if(!seat)continue;seat.lightstick=true;
    if(!seat.keep||seat.upper)continue;
    origin.fromBufferAttribute(a._cm_origin,v);right.fromBufferAttribute(a._cm_right,v);front.fromBufferAttribute(a._cm_front,v);
    if(!seat.grip)seat.grip={
     origin:new THREE.Vector3(origin.x,origin.z,-origin.y).applyMatrix4(mesh.matrixWorld),
     right:new THREE.Vector3(right.x,right.z,-right.y).applyMatrix3(linear),
     front:new THREE.Vector3(front.x,front.z,-front.y).applyMatrix3(linear),up:new THREE.Vector3(0,1,0).applyMatrix3(linear),
     side:a._cm_side.getX(v),seed:a._cm_seed.getX(v),style:a._cm_style.getX(v),bounds:new THREE.Box3()
    };
    local.fromBufferAttribute(a.position,v);local.set(local.x,-local.z,local.y).sub(origin);
    seat.grip.bounds.expandByPoint(new THREE.Vector3(local.dot(right),local.dot(front),local.z));
   }
  }
  if(!upperBlocks)return {seats:seats.filter(s=>s.keep),density:{original,groups}};
 }
 for(const mesh of meshes){
  const source=mesh.geometry,index=source.index,count=index?.count??source.attributes.position.count,indices=[],samples=new Map();
  const alternate=uniformFrame?.materials.get(uniformPairs[mesh.material.name]);
  const swaps=alternate?new Uint8Array(source.attributes.position.count):null;
  if(swaps)for(let v=0;v<swaps.length;v++){
   if(v%128===0)yield;
   const part=Math.round(source.attributes._cm_part.getX(v));
   if(part===1||part===3)swaps[v]=lookup(mesh,v)?.uniformSwap?1:0;
  }
  for(let i=0;i<count;i+=3){
   if(i%192===0)yield;
   const v=index?index.getX(i):i,seat=lookup(mesh,v);if(!seat?.keep)continue;
   // Independent bright sticks replace the original sticks in both lower LODs.
   if(upperBlocks&&(seat.upper||/^REF_FanLightsticks/.test(mesh.name)))continue;
   const triangle=[v,index?index.getX(i+1):i+1,index?index.getX(i+2):i+2];indices.push(...triangle);
   const portrait=portraits.get(seat.variant);
   if(portrait.seat===seat){if(!samples.has(portrait))samples.set(portrait,[[],[]]);samples.get(portrait)[swaps?.[v]??0].push(...triangle);}
  }
  for(const [portrait,parts] of samples)for(let swap=0;swap<2;swap++)if(parts[swap].length)portrait.parts.push({geometry:yield* crowdSubset(source,parts[swap]),material:swap?alternate:mesh.material,matrix:mesh.matrixWorld.clone()});
  const filtered=new THREE.BufferGeometry();
  for(const [name,a] of Object.entries(source.attributes))filtered.setAttribute(name,a);
  if(swaps)filtered.setAttribute('_cm_uniformSwap',new THREE.BufferAttribute(swaps,1));
  filtered.setIndex(indices);filtered.boundingSphere=source.boundingSphere?.clone();filtered.boundingBox=source.boundingBox?.clone();mesh.geometry=filtered;
 }
 return {seats:seats.filter(s=>s.keep),portraits:[...portraits.values()],lookup,at,density:{original,groups}};
}

function createBlockCrowd(root,seats,config,motionUniforms,screenCenter=root.getWorldPosition(new THREE.Vector3())){
 const group=new THREE.Group();group.name='Audience_Blocks';group.visible=false;root.add(group);
 const inverse=root.matrixWorld.clone().invert(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0),scale=new THREE.Vector3();
 const settings=config.lightsticks,colors=settings.colors??{Gold:[1,.47,.075],Cyan:[.008,.68,1],Pink:[1,.012,.3]};
 const sideAxis=new THREE.Vector3().fromArray(settings.sideAxis);
 const make=(name,entries,material,lightstick=false)=>{
  const geometry=new THREE.BoxGeometry(1,1,1),origins=[],upper=[],grips=[],poses=[],forwards=[],seeds=[],zones=[];
  const detail=lightstick?new THREE.InstancedBufferAttribute(new Float32Array(entries.length),1):null;
  const mesh=new THREE.InstancedMesh(geometry,material,entries.length);mesh.name=name;mesh.matrixAutoUpdate=false;
  for(let i=0;i<entries.length;i++){
   const {seat,position,size,color}=entries[i];
   if(lightstick){
    const grip=seat.grip;
    if(!seat.upper&&grip){
     matrix.makeBasis(grip.right,grip.up,grip.front).setPosition(grip.origin);
     const hand=grip.bounds.getCenter(new THREE.Vector3());hand.z=grip.bounds.min.z;
     grips.push(...hand.toArray());poses.push(grip.side,grip.seed,grip.style);
     seat.lightstickLod={attribute:detail,index:i};
    }else{
     matrix.makeBasis(new THREE.Vector3(seat.front.z,0,-seat.front.x),up,seat.front).setPosition(seat.position);
     grips.push(.23,.28,settings.handHeight);poses.push(1,seat.seed,0);
    }
    const forward=screenCenter.clone().sub(seat.position).setY(0).normalize();
    forwards.push(forward.x,forward.z);seeds.push(crowdRank(seat,104)/4294967296);
    zones.push(lightstickZone(seat.position,settings.motion.zone.cellSize));
    matrix.premultiply(inverse);
   }else{
    rotation.setFromAxisAngle(up,Math.atan2(seat.front.x,seat.front.z));
    matrix.compose(position,rotation,scale.fromArray(size)).premultiply(inverse);
   }
   mesh.setMatrixAt(i,matrix);
   if(color)mesh.setColorAt(i,color);
   origins.push(...seat.position.toArray());upper.push(seat.upper?1:0);
  }
  geometry.setAttribute('crowdSeat',new THREE.InstancedBufferAttribute(new Float32Array(origins),3));
  geometry.setAttribute('crowdUpper',new THREE.InstancedBufferAttribute(new Float32Array(upper),1));
  if(lightstick){
   for(const [name,values,size] of [['crowdGrip',grips,3],['crowdPoseData',poses,3],['crowdForward',forwards,2],['crowdStickSeed',seeds,1],['crowdStickZone',zones,1]])geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(values),size));
   geometry.setAttribute('crowdDetail',detail);
  }
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,motionUniforms);
   if(lightstick){
    const motion=settings.motion,radians=Math.PI/180;
    const total=motion.classes.reduce((sum,entry)=>sum+entry.fraction,0);
    Object.assign(shader.uniforms,{
     stickAngles:{value:new THREE.Vector3(settings.elevationDegrees*radians,settings.yawRangeDegrees*radians,settings.pitchRangeDegrees*radians)},
     stickTiming:{value:new THREE.Vector3(...motion.stateSeconds,motion.transitionSeconds)},
     stickClasses:{value:motion.classes.map(entry=>new THREE.Vector4(entry.yawDegrees*radians,entry.pitchDegrees*radians,...entry.speedHz))},
     stickFractions:{value:new THREE.Vector2(motion.classes[0].fraction/total,(motion.classes[0].fraction+motion.classes[1].fraction)/total)},
     stickClassTiming:{value:new THREE.Vector4(...motion.classChangeSeconds,motion.classTransitionSeconds,motion.classChangeFraction)},
     stickZoneStrength:{value:motion.zone.strength},stickTremble:{value:motion.trembleMultiplier},
     stickLimits:{value:new THREE.Vector3(motion.limits.yawDegrees*radians,...motion.limits.elevationDegrees.map(angle=>angle*radians))},
     stickSize:{value:new THREE.Vector2(settings.width,settings.length)}
    });
    shader.vertexShader=lightstickMotion+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','vec4 mvPosition=viewMatrix*vec4(stickVertex(transformed),1.);\ngl_Position=projectionMatrix*mvPosition;');
    return;
   }
   shader.vertexShader=seatedMotion+'uniform float crowdTime;\nattribute vec3 crowdSeat;\nattribute float crowdUpper;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
    vec4 world=modelMatrix*instanceMatrix*vec4(transformed,1.);
    bool moving=crowdUpper<.5||crowdAcross(vec4(crowdSeat,1.));
    if(moving&&crowdInView(viewMatrix*vec4(crowdSeat+vec3(0.,.75,0.),1.))){
     float phase=dot(crowdSeat.xz,vec2(12.9898,78.233));
     float t=crowdTime+crowdTempoVariation*sin(crowdTime*.20944+phase);
     float sway=sin(t*2.7227+phase)*.025*crowdAmplitude;
     world.x+=sway*clamp(world.y-crowdSeat.y,0.,1.5);
    }
    vec4 mvPosition=viewMatrix*world;
    gl_Position=projectionMatrix*mvPosition;
   `);
  };
  material.customProgramCacheKey=()=>`crowd-blocks:${name}${lightstick?':dynamic-v2':''}`;
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingSphere();mesh.boundingSphere.radius+=lightstick?2:.2;group.add(mesh);
 };
 const bodies=[],sticks={Gold:[],Cyan:[],Pink:[]};
 const shirts={'GEN.G':new THREE.Color(config.shirts?.['GEN.G']??'#443b22'),BLG:new THREE.Color(config.shirts?.BLG??'#739097')},skin=new THREE.Color('#76513a');
 for(const seat of seats){
  if(seat.upper||config.impostor.representation==='blocks'){
   bodies.push({seat,position:seat.position.clone().add(new THREE.Vector3(0,.77,0)),size:[.38,.48,.27],color:shirts[seat.team]??seat.bodyColor});
   bodies.push({seat,position:seat.position.clone().add(new THREE.Vector3(0,1.14,0)),size:[.22,.24,.22],color:skin});
  }
  if(!seat.upper&&!seat.lightstick)continue;
  const side=seat.position.dot(sideAxis);
  const goldFraction=side<settings.sideBoundary?settings.leftGoldFraction:settings.rightGoldFraction;
  // A second hash round keeps color independent of the density selection rank.
  let colorRank=crowdRank(seat,103);colorRank=Math.imul(colorRank^(colorRank>>>16),0x45d9f3b);
  const color=((colorRank^(colorRank>>>16))>>>0)/4294967296<goldFraction?'Gold':seat.seed<settings.pinkFraction?'Pink':'Cyan';
  sticks[color].push({seat});
 }
 make('Audience_BlockBodies',bodies,new THREE.MeshLambertMaterial());
 for(const [color,entries] of Object.entries(sticks))if(entries.length){
  make(`Audience_Lightsticks_${color}`,entries,new THREE.MeshBasicMaterial({color:new THREE.Color().fromArray(colors[color]).multiplyScalar(settings.intensity),toneMapped:false}),true);
 }
 return {group,update(){},dispose(){
  group.removeFromParent();for(const mesh of group.children){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}
 }};
}

function* createCrowdLod(root,meshes,mannequins,selection,ctx,config,motionUniforms,publish){
 const {renderer,scene,camera}=ctx,{seats,portraits}=selection,chunks=new Map(),inverseRoot=root.matrixWorld.clone().invert();
 const group=new THREE.Group();group.name='Audience_LOD';group.visible=false;root.add(group);
 const chunkFor=seat=>{
  const p=seat.position,size=config.cellSize,key=[p.x,p.y,p.z].map(n=>Math.floor(n/size)).join(',');
  if(!chunks.has(key))chunks.set(key,{upper:seat.upper,bounds:new THREE.Box3(),seats:[],sources:[],details:[],prepared:[],ready:false,near:false});
  return chunks.get(key);
 };
 const atlas=new THREE.WebGLRenderTarget(8*96,portraits.length*128),capture=new THREE.Scene(),warmScene=new THREE.Scene();
 capture.environment=warmScene.environment=scene.environment;
 for(const object of scene.children)if(object.isLight){
  const light=object.clone();light.castShadow=false;capture.add(light);
  // Arena LOD hides the outdoor moon light before showing the crowd.
  const warmLight=object.clone();if(/^Environment_/.test(object.name))warmLight.visible=false;warmScene.add(warmLight);
  if(object.target){light.target=object.target.clone();capture.add(light.target);warmLight.target=object.target.clone();warmScene.add(warmLight.target);}
 }
 const view=new THREE.OrthographicCamera(-.6,.6,.8,-.8,.1,20),target=new THREE.Vector3(),right=new THREE.Vector3();
 const uploaded=new Set(),compiled=new Set();
 function* upload(material){
  for(const value of Object.values(material))if(value?.isTexture&&!value.isRenderTargetTexture&&!uploaded.has(value)){
   renderer.initTexture(value);uploaded.add(value);yield;
  }
 }
 function* warm(mesh){
  const local=mesh.matrix.clone(),parent=mesh.parent,visible=mesh.visible,culled=mesh.frustumCulled;
  mesh.matrix.copy(root.matrixWorld).multiply(local);mesh.visible=true;mesh.frustumCulled=false;warmScene.add(mesh);
  try{
   yield* upload(mesh.material);
   const key=mesh.material.uuid+'/'+!!mesh.isInstancedMesh;
   if(!compiled.has(key)){yield renderer.compileAsync(mesh,camera,warmScene);compiled.add(key);}
   // Draw one pixel before the normal frame to upload the exact on-screen shader and buffers.
   const scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),clear=renderer.autoClear,shadows=renderer.shadowMap.autoUpdate;
   try{renderer.autoClear=false;renderer.shadowMap.autoUpdate=false;renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);renderer.render(warmScene,camera);}
   finally{renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=clear;renderer.shadowMap.autoUpdate=shadows;}
  }finally{
   warmScene.remove(mesh);if(parent)parent.add(mesh);mesh.matrix.copy(local);mesh.visible=visible;mesh.frustumCulled=culled;
  }
  yield;
 }
 let completed=false,lod;
 try{
 for(let i=0;i<seats.length;i++){
  if(i%128===0)yield;
  const seat=seats[i];seat.card=i;const chunk=chunkFor(seat);chunk.seats.push(seat);chunk.bounds.expandByPoint(seat.position);
 }
 yield 'chunks';
 for(const source of [...meshes,...mannequins]){
  source.visible=false;const groups=new Map(),matrix=new THREE.Matrix4(),p=new THREE.Vector3();
  const g=source.geometry,count=source.isInstancedMesh?source.count:g.index.count;
  for(let i=0;i<count;i+=source.isInstancedMesh?1:3){
   if(i%192===0)yield;
   let seat;
   if(source.isInstancedMesh){source.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix).applyMatrix4(root.matrixWorld);seat=selection.at(p);}
   else seat=selection.lookup(source,g.index.getX(i));
   if(!seat?.keep)continue;
   const chunk=chunkFor(seat);if(!groups.has(chunk))groups.set(chunk,[]);
   const indices=groups.get(chunk);if(source.isInstancedMesh)indices.push(i);else indices.push(g.index.getX(i),g.index.getX(i+1),g.index.getX(i+2));
  }
  for(const [chunk,indices] of groups)chunk.sources.push({source,indices});
 }
 yield 'portraits';
 // Render one portrait view per work unit and restore renderer state before every yield.
 atlas.scissorTest=true;
 for(let row=0;row<portraits.length;row++){
  const portrait=portraits[row],objects=[];
  for(const part of portrait.parts){
   const mesh=new THREE.Mesh(part.geometry,part.material);mesh.matrixAutoUpdate=false;mesh.matrix.copy(part.matrix);capture.add(mesh);objects.push(mesh);
   yield* upload(part.material);
   const oldTarget=renderer.getRenderTarget();let compiling;
   try{renderer.setRenderTarget(atlas);compiling=renderer.compileAsync(mesh,view,capture);}finally{renderer.setRenderTarget(oldTarget);}
   yield compiling;
  }
  target.copy(portrait.seat.position);target.y+=.7;right.set(portrait.seat.front.z,0,-portrait.seat.front.x);
  for(let side=0;side<8;side++){
   const angle=side*Math.PI/4;view.position.copy(target).addScaledVector(portrait.seat.front,Math.cos(angle)*4).addScaledVector(right,Math.sin(angle)*4);view.lookAt(target);
   const oldTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4());
   const scissorTest=renderer.getScissorTest(),clear=renderer.getClearColor(new THREE.Color()),alpha=renderer.getClearAlpha();
   try{
    atlas.viewport.set(side*96,row*128,96,128);atlas.scissor.set(side*96,row*128,96,128);
    renderer.setRenderTarget(atlas);renderer.setClearColor(0,0);renderer.render(capture,view);
   }finally{renderer.setRenderTarget(oldTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.setClearColor(clear,alpha);}
   yield;
  }
  for(const object of objects)capture.remove(object);
 }
 const geometry=new THREE.PlaneGeometry(1.2,1.6),material=new THREE.MeshBasicMaterial({map:atlas.texture,alphaTest:.5,side:THREE.DoubleSide});
 const show=new THREE.InstancedBufferAttribute(new Float32Array(seats.length).fill(1),1);
 geometry.setAttribute('crowdShow',show);geometry.setAttribute('crowdPortrait',new THREE.InstancedBufferAttribute(new Float32Array(seats.map(s=>s.portrait)),1));
 geometry.setAttribute('crowdFacing',new THREE.InstancedBufferAttribute(new Float32Array(seats.flatMap(s=>[s.front.x,s.front.z])),2));
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,motionUniforms);
  shader.vertexShader=seatedMotion+'uniform float crowdTime;\nattribute float crowdShow;\nattribute float crowdPortrait;\nattribute vec2 crowdFacing;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`
   vec4 seatWorld=modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
   vec3 toward=normalize(vec3(cameraPosition.x-seatWorld.x,0.,cameraPosition.z-seatWorld.z));
   vec3 right=vec3(toward.z,0.,-toward.x);
   float angle=atan(dot(toward.xz,vec2(crowdFacing.y,-crowdFacing.x)),dot(toward.xz,crowdFacing));
   float viewIndex=mod(floor(angle/(6.28318530718/8.)+.5)+8.,8.);
   vMapUv=vec2((uv.x+viewIndex)/8.,(uv.y+crowdPortrait)/${portraits.length.toFixed(1)});
   vec2 card=position.xy;
   if((crowdMotionEnabled?crowdAcross(seatWorld):crowdSeated)&&crowdShow>.5&&crowdInView(viewMatrix*seatWorld)){
    card+=crowdCardOffset(seatWorld,position.y,crowdTime);
   }
   vec4 mvPosition=viewMatrix*vec4(seatWorld.xyz+right*card.x+vec3(0.,card.y,0.),1.);
   gl_Position=projectionMatrix*mvPosition;
   if(crowdShow<.5)gl_Position=vec4(2.,2.,2.,1.);
  `);
 };
 const impostors=new THREE.InstancedMesh(geometry,material,seats.length),matrix=new THREE.Matrix4();
 impostors.name='Audience_DistantPictures';impostors.matrixAutoUpdate=false;
 for(let i=0;i<seats.length;i++){
  if(i%128===0)yield;
  const p=seats[i].position.clone();p.y+=.7;matrix.makeTranslation(...p.toArray()).premultiply(inverseRoot);impostors.setMatrixAt(i,matrix);
 }
 impostors.instanceMatrix.needsUpdate=true;impostors.computeBoundingBox();impostors.computeBoundingSphere();impostors.boundingSphere.radius+=2;group.add(impostors);
 const last=new THREE.Vector3(Infinity,Infinity,Infinity),position=new THREE.Vector3();
 const update=()=>{
  camera.getWorldPosition(position);if(position.distanceToSquared(last)<.25)return;last.copy(position);
  for(const chunk of chunks.values()){
   const near=chunk.ready&&chunk.bounds.distanceToPoint(position)<(chunk.near?config.farDistance:config.nearDistance);
   if(near===chunk.near)continue;chunk.near=near;
   chunk.details=near?chunk.prepared:[];
   for(const mesh of chunk.prepared)mesh.visible=near;
   for(const seat of chunk.seats){
    show.setX(seat.card,near?0:1);
    if(seat.lightstickLod){const {attribute,index}=seat.lightstickLod;attribute.setX(index,near?1:0);attribute.needsUpdate=true;}
   }
   show.needsUpdate=true;
  }
 };
 let disposed=false;
 lod={chunks:[...chunks.values()],impostors,group,update,dispose(){
  if(disposed)return;disposed=true;
  for(const chunk of chunks.values())for(const mesh of chunk.prepared){mesh.removeFromParent();mesh.geometry.dispose();if(mesh.isInstancedMesh)mesh.dispose();}
  group.removeFromParent();impostors.dispose();geometry.dispose();material.dispose();atlas.dispose();
 }};
 yield* warm(impostors);publish(lod);
 yield 'gpu';
 // Custom shader samplers are not material texture slots.
 for(const source of [...meshes,...mannequins]){
  const shader={uniforms:{},vertexShader:'',fragmentShader:''};source.material.onBeforeCompile(shader);
  for(const uniform of Object.values(shader.uniforms))if(uniform.value?.isTexture)yield* upload({map:uniform.value});
 }
 for(const chunk of chunks.values()){
  for(const {source,indices} of chunk.sources){
   let mesh;
   if(source.isInstancedMesh){
    const g=source.geometry.clone();
    for(const name of ['_cm_seed','_cm_style'])g.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(indices.map(i=>source.geometry.attributes[name].getX(i))),1));
    mesh=new THREE.InstancedMesh(g,source.material,indices.length);
    for(let i=0;i<indices.length;i++){if(i%128===0)yield;source.getMatrixAt(indices[i],matrix);mesh.setMatrixAt(i,matrix);}mesh.instanceMatrix.needsUpdate=true;
   }else mesh=new THREE.Mesh(yield* crowdSubset(source.geometry,indices),source.material);
   mesh.name=source.name+'_Near';mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;
   mesh.matrixAutoUpdate=false;mesh.matrix.copy(inverseRoot).multiply(source.matrixWorld);mesh.visible=false;
   if(mesh.isInstancedMesh){mesh.computeBoundingSphere();mesh.boundingSphere.radius+=1;}
   else{mesh.geometry.computeBoundingSphere();mesh.geometry.boundingSphere.radius+=1;}
   group.add(mesh);chunk.prepared.push(mesh);
   yield* warm(mesh);
  }
  chunk.ready=true;last.set(Infinity,Infinity,Infinity);update();yield;
 }
 completed=true;
 }finally{
  for(const portrait of portraits)for(const part of portrait.parts)part.geometry.dispose();
  if(!completed){if(lod)lod.dispose();else{group.removeFromParent();atlas.dispose();}}
 }
}

function* splitUpperCrowd(root,meshes,config,animate){
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
 let completed=false;
 try{
 for(const mesh of meshes){
  const source=mesh.geometry,a=source.attributes,lower=[],components=new Map(),counted=new Set();
  const index=source.index,count=index?.count??a.position.count;
  for(let i=0;i<count;i+=3){
   if(i%192===0)yield;
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
   yield;
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
  yield;
  batch.geometry.setAttribute('_cm_seed',new THREE.InstancedBufferAttribute(new Float32Array(batch.seeds),1));
  batch.geometry.setAttribute('_cm_style',new THREE.InstancedBufferAttribute(new Float32Array(batch.styles),1));
  const mesh=new THREE.InstancedMesh(batch.geometry,batch.material,batch.matrices.length);
  mesh.name='Audience_UpperMannequin';mesh.userData.crowdMannequin=true;mesh.visible=false;
  mesh.castShadow=batch.castShadow;mesh.receiveShadow=batch.receiveShadow;
  for(let i=0;i<batch.matrices.length;i++){if(i%128===0)yield;mesh.setMatrixAt(i,batch.matrices[i]);}mesh.instanceMatrix.needsUpdate=true;
  mesh.computeBoundingSphere();mesh.boundingSphere.radius+=1;root.add(mesh);mannequins.push(mesh);
 }
 completed=true;return {mannequins,stats};
 }finally{
  if(!completed){for(const mesh of mannequins){mesh.removeFromParent();mesh.dispose();}for(const batch of batches.values())batch.geometry.dispose();}
 }
}

export function createCrowdMotion(root,ctx){
 const time={value:0},stickTime={value:0},materials=new Map(),meshes=[],textures=[],textureCache=new Map(),saved=[];
 const config=ctx?.config('crowd'),viewer={value:new THREE.Vector3()},center={value:root.getWorldPosition(new THREE.Vector3())};
 const upperBlocks=config?.impostor?.representation==='upper-blocks';
 const zone=config?.motionZone,direction=new THREE.Vector2(1,0),opposite=new THREE.Vector2();
 const hysteresisCos=Math.cos((zone?.hysteresisDegrees??0)*Math.PI/180);
 const seated={value:false},motionUniforms={crowdTime:time,crowdStickTime:stickTime,crowdSeated:seated,
  crowdMotionEnabled:{value:!!zone},crowdMotionCenter:{value:new THREE.Vector2(center.value.x,center.value.z)},crowdMotionDirection:{value:direction},
  crowdMotionCos:{value:Math.cos((zone?.halfAngleDegrees??60)*Math.PI/180)},
  crowdAmplitude:{value:config?.seatedMotion?.amplitude??1},crowdTempoVariation:{value:config?.seatedMotion?.tempoVariation??0}};
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
  const alternate=!upper&&uniformFrame?.materials.get(uniformPairs[original.name]);
  const alternateFar=alternate?.map&&far?reduced(alternate.map,config.farTextureScale):null;
  if(upper&&far)material.map=far;
  if(upper&&/^AudienceDetail_Face/.test(original.name)){
   const skin=meshes.find(mesh=>mesh.material.name===original.name.replace('Face','Skin'));
   if(skin){material.map=null;material.color.copy(skin.material.color);}
  }
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,motionUniforms);shader.uniforms.crowdMannequin={value:upper};
   shader.vertexShader=deformation+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',
    '#include <beginnormal_vertex>\nobjectNormal=normalize(crowdPose(position+objectNormal)-crowdPose(position));');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed=crowdPose(position);'+(alternate?'crowdUniformSwap=_cm_uniformSwap;':''));
   let sample='texture2D( map, vMapUv )';
   if(far&&!upper){
    shader.uniforms.crowdViewer=viewer;shader.uniforms.crowdCenter=center;shader.uniforms.crowdOppositeCos={value:oppositeCos};shader.uniforms.crowdFarMap={value:far};
    shader.vertexShader='uniform vec3 crowdViewer;\nuniform vec3 crowdCenter;\nuniform float crowdOppositeCos;\nvarying float crowdFar;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`vec3 crowdSeat=(modelMatrix*vec4(_cm_origin.x,_cm_origin.z,-_cm_origin.y,1.0)).xyz;
     vec2 opposite=crowdCenter.xz-crowdViewer.xz,seat=crowdSeat.xz-crowdCenter.xz;
     float distanceProduct=length(opposite)*length(seat);
     crowdFar=distanceProduct>0.0001&&dot(opposite,seat)>=crowdOppositeCos*distanceProduct?1.0:0.0;
     #include <project_vertex>`);
    shader.fragmentShader='uniform sampler2D crowdFarMap;\nvarying float crowdFar;\n'+shader.fragmentShader;
    sample='(crowdFar>0.5?texture2D(crowdFarMap,vMapUv):texture2D(map,vMapUv))';
   }
   if(alternate){
    shader.vertexShader='attribute float _cm_uniformSwap;\nvarying float crowdUniformSwap;\n'+shader.vertexShader;
    shader.fragmentShader='uniform vec3 crowdAlternateColor;\nvarying float crowdUniformSwap;\n'+shader.fragmentShader;
    shader.uniforms.crowdAlternateColor={value:alternate.color};
    if(alternate.map){
     shader.uniforms.crowdAlternateMap={value:alternate.map};shader.uniforms.crowdAlternateFarMap={value:alternateFar};
     shader.fragmentShader='uniform sampler2D crowdAlternateMap;\nuniform sampler2D crowdAlternateFarMap;\n'+shader.fragmentShader;
     sample=`(crowdUniformSwap>.5?${alternateFar?'(crowdFar>.5?texture2D(crowdAlternateFarMap,vMapUv):texture2D(crowdAlternateMap,vMapUv))':'texture2D(crowdAlternateMap,vMapUv)'}:${sample})`;
    }
   }
   if(far&&!upper||alternate)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
    (alternate?'if(crowdUniformSwap>.5)diffuseColor.rgb=crowdAlternateColor;\n':'')+THREE.ShaderChunk.map_fragment.replace('texture2D( map, vMapUv )',sample));
  };
  material.customProgramCacheKey=()=>`barclays-crowd-upper-far:${upper}:${!!far}:${!!alternate}`;
  materials.set(key,material);return material;
 };
 root.traverse(mesh=>{
  if(!mesh.isMesh||!mesh.geometry.getAttribute('_cm_part'))return;
  meshes.push(mesh);saved.push({mesh,geometry:mesh.geometry,material:mesh.material,visible:mesh.visible});
 });
 const face=config?.uniformSides&&root.getObjectByName(ctx.config('screen')?.videoFace);
 let uniformFrame;
 if(face?.isMesh){
  const position=new THREE.Box3().setFromObject(face).getCenter(new THREE.Vector3());
  const normal=new THREE.Vector3().fromBufferAttribute(face.geometry.attributes.normal,0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(face.matrixWorld));
  if(normal.dot(position.clone().sub(center.value))<0)normal.negate();
  uniformFrame={center:position,right:new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),normal).normalize(),materials:new Map(meshes.map(mesh=>[mesh.material.name,mesh.material]))};
 }
 let selection=null,lod=null,blocks=null,mannequins=[],stats={},renderVisibility=[];
 const deferred=!!ctx?.renderer;
 if(deferred)for(const mesh of meshes)mesh.visible=false;
 function* prepare(){
  selection=config?.density?yield* selectCrowd(meshes,config,uniformFrame):null;
  if(selection&&config.impostor?.representation==='blocks'){
   stats={upperSpectators:selection.seats.filter(seat=>seat.upper).length,lowerSpectators:selection.seats.filter(seat=>!seat.upper).length};
   for(const mesh of meshes)mesh.visible=false;
   lod=createBlockCrowd(root,selection.seats,config,motionUniforms,uniformFrame?.center);lod.group.visible=visible;
   return;
  }
  const filtered=meshes.map(mesh=>mesh.geometry);
  yield 'instances';
  if(upperBlocks){
   stats={upperSpectators:selection.seats.filter(seat=>seat.upper).length,lowerSpectators:selection.seats.filter(seat=>!seat.upper).length};
   blocks=createBlockCrowd(root,selection.seats,config,motionUniforms,uniformFrame?.center);
  }else{
   if(config)({mannequins,stats}=yield* splitUpperCrowd(root,meshes,config,animate));
   if(selection)for(const geometry of filtered)geometry.dispose();
  }
  for(const mesh of meshes){
   yield;
   mesh.material=Array.isArray(mesh.material)?mesh.material.map(material=>animate(material)):animate(mesh.material);
   if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();mesh.geometry.boundingSphere.radius+=1;
  }
  const detailedSelection=upperBlocks?{...selection,seats:selection.seats.filter(seat=>!seat.upper)}:selection;
  if(selection&&config.impostor)yield* createCrowdLod(root,meshes,mannequins,detailedSelection,ctx,config.impostor,motionUniforms,value=>{
   lod=value;lod.group.visible=visible;
   if(blocks){lod.group.add(blocks.group);blocks.group.visible=true;}
  });
  else{
   renderVisibility=[...meshes,...mannequins].map(mesh=>({mesh,visible:saved.find(entry=>entry.mesh===mesh)?.visible??true}));
   for(const entry of renderVisibility)entry.mesh.visible=visible&&entry.visible;
  }
 }
 const preparation=createCrowdPreparation(prepare());
 const audio=new Audio();audio.loop=true;audio.preload='auto';
 let origin=performance.now(),sound=false,paused=false,disposed=false,audioURL,wanted=false,pending=false,blocked=false,visible=true,lastScreenState;
 let stickOrigin=origin;
 if(!deferred)preparation.start();
 const clearGesture=()=>{window.removeEventListener('pointerdown',retrySound);window.removeEventListener('keydown',retrySound);};
 const retrySound=()=>{clearGesture();blocked=false;startSound();};
 const startSound=()=>{
  if(disposed||!wanted||!audioURL||sound||pending||blocked)return;
  pending=true;audio.currentTime=time.value;
  audio.play().then(()=>{
   pending=false;sound=wanted&&!disposed&&!audio.paused;
   if(!sound){audio.pause();if(wanted&&!disposed)startSound();}
  }).catch(error=>{
   pending=false;sound=false;
   if(disposed||!wanted)return;
   if(error.name==='AbortError'){startSound();return;}
   console.warn('Crowd audio playback failed',error);blocked=true;
   window.addEventListener('pointerdown',retrySound);window.addEventListener('keydown',retrySound);
  });
 };
 const screenState=state=>{
  lastScreenState=state;
  const settings=ctx?.config('screen');
  audio.volume=Math.min(1,(settings?.crowdVolume??.3)*(state?.userVolume??settings?.volume??70)/(settings?.volume||70));
  wanted=visible&&state?.muted===false;
  if(wanted)startSound();
  else{audio.pause();if(sound)origin=performance.now()-time.value*1000;sound=false;blocked=false;clearGesture();}
 };
 const onScreen=event=>screenState(event.detail);ctx?.events.addEventListener(SCREEN_STATE,onScreen);
 const onSit=()=>{seated.value=true;},onStand=()=>{seated.value=false;};
 ctx?.events.addEventListener(SEAT_ENTER,onSit);ctx?.events.addEventListener(SEAT_EXIT,onStand);
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
  ctx?.events.removeEventListener(SEAT_ENTER,onSit);ctx?.events.removeEventListener(SEAT_EXIT,onStand);
  const release=()=>{
   lod?.dispose();blocks?.dispose();
   for(const mesh of mannequins){mesh.removeFromParent();mesh.geometry.dispose();mesh.dispose();}
   for(const entry of saved){if(entry.mesh.geometry!==entry.geometry)entry.mesh.geometry.dispose();entry.mesh.geometry=entry.geometry;entry.mesh.material=entry.material;entry.mesh.visible=entry.visible;}
   for(const material of materials.values())material.dispose();for(const {far} of textures)far.dispose();
  };
  const pending=preparation.dispose();if(pending)pending.then(release,release);else release();
 };
 const onPageHide=event=>{if(!event.persisted)dispose();};window.addEventListener('pagehide',onPageHide);
 return {
  meshes,get mannequins(){return mannequins;},get stats(){return stats;},textures,audio,dispose,preparation,
  get lod(){return lod;},get density(){return selection?.density;},get time(){return time.value;},get sounding(){return sound;},
  isFar(x,y,z){
   if(y>config.upperFloorHeight)return true;
   const ox=center.value.x-viewer.value.x,oz=center.value.z-viewer.value.z,sx=x-center.value.x,sz=z-center.value.z;
   const product=Math.hypot(ox,oz)*Math.hypot(sx,sz);return product>.0001&&ox*sx+oz*sz>=oppositeCos*product;
  },
  update(now){
   if(disposed)return;
   if(!visible)return;
   if(ctx)ctx.camera.getWorldPosition(viewer.value);
   if(zone&&ctx.player){
    opposite.set(center.value.x-ctx.player.position.x,center.value.z-ctx.player.position.z);
    // The shared shader sector changes only beyond the dead zone and angular hysteresis; no spectator scan.
    if(opposite.lengthSq()>zone.centerRadius**2&&direction.dot(opposite.normalize())<hysteresisCos)direction.copy(opposite);
   }
   lod?.update();
   if(paused)return;
   stickTime.value=(now-stickOrigin)/1000;
   if(sound&&!audio.paused){time.value=audio.currentTime%30;origin=now-time.value*1000;}
   else time.value=((now-origin)/1000)%30;
  },
  seek(seconds){time.value=((seconds%30)+30)%30;origin=performance.now()-time.value*1000;stickTime.value=seconds;stickOrigin=performance.now()-seconds*1000;if(sound)audio.currentTime=time.value;},
  setPaused(value){paused=value;if(!value){origin=performance.now()-time.value*1000;stickOrigin=performance.now()-stickTime.value*1000;}},
  setVisible(value){
   if(visible===value)return;visible=value;
   if(lod)lod.group.visible=value;
   else for(const entry of renderVisibility)entry.mesh.visible=value&&entry.visible;
   screenState(lastScreenState);
  }
 };
}
