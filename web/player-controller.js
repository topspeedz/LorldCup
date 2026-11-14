import * as THREE from 'three';

// shortcut: the 2 m grid can miss narrow detours; refine only for a reproduced missed passage.
const detourRadius=8,detourStep=2,detourCandidates=49;
const detourDirections=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

export function createPlayerController({avatar,input,getYaw,onTeleport,clickSit}){
 const position=new THREE.Vector3(),floorMeshes=[],wallMeshes=[],ceilingMeshes=[],restrictedMeshes=[],seatMeshes=[],rampMeshes=[];
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),up=new THREE.Vector3(0,1,0),headHeight=1.85;
 const radius=.32,bodyBounds=new THREE.Box3(),meshBounds=new THREE.Box3(),localBounds=new THREE.Box3(),triangleBounds=new THREE.Box3();
 const triangle=new THREE.Triangle(),inverse=new THREE.Matrix4(),collisionCells=new WeakMap(),cellSize=4;
 const normal=new THREE.Vector3(),normalMatrix=new THREE.Matrix3(),before=new THREE.Vector3();
 const collisionMeshes=[wallMeshes,seatMeshes];
 const locations={plaza:[-139,-.02,0],lobby:[-83,0,0],arena:[-25,-8.9,0]};
 let foot=-.02,airborne=false,verticalSpeed=0,locked=false,walkTarget=null,flight=null,stoppedWalk=null;
 let lastSafe=null,lowestFloor=Infinity;
 let walkRoute=[];
 function cancelWalk(){walkTarget=null;walkRoute.length=0;stoppedWalk=null;}
 function registerWorld(root){
  root.traverse(o=>{
   if(!o.isMesh)return;
   if(/^Walk_Ramp[AB]__/.test(o.name))rampMeshes.push(o);
   if(o.name.startsWith('Walk_Tier1')){restrictedMeshes.push(o);wallMeshes.push(o);return;}
   if(/^Seats__|^Seat_armrests__/.test(o.name)){seatMeshes.push(o);return;}
   if(/^Roof|^Atrium_ceiling/.test(o.name))ceilingMeshes.push(o);
   if(o.name.startsWith('Walk_')||/^REF_(CircularStage|TrophyIsland|RunwayTransition|CenterStairs|TeamRiser)/.test(o.name)){
    floorMeshes.push(o);
    if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
    lowestFloor=Math.min(lowestFloor,meshBounds.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld).min.y);
   }
   if(o.name.startsWith('Collide_')||/Player_desks|Player_PC|Player_chair|Plaza_bench|Bollards|REF_DeskBody|REF_CenterBackdrop|REF_WingMainFrame|CCR_(Counter|Timber|Refrigerator|Lounge|Banquette)/.test(o.name))wallMeshes.push(o);
  });
 }
 function teleport(target){
  cancelWalk();if(flight){const pending=flight;flight=null;pending.resolve(false);}
  const p=typeof target==='string'?locations[target]:target,yaw=p[3]??-Math.PI/2;
  position.set(p[0],p[1],p[2]);foot=p[1];airborne=false;verticalSpeed=0;
  avatar.rotation.y=yaw;input.keys.clear();onTeleport(yaw);
 }
 function groundAt(x,z,previousFoot,stepHeight=.65){
  ray.set(new THREE.Vector3(x,previousFoot+stepHeight,z),down);ray.far=32;
  // Double-sided stair undersides are visible geometry, not a place to stand.
  const hit=ray.intersectObjects(floorMeshes,false).find(hit=>normal.copy(hit.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).y>0);
  const restricted=ray.intersectObjects(restrictedMeshes,false)[0];
  return hit&&(!restricted||hit.distance<restricted.distance)?hit.point.y:null;
 }
 function blocked(x,y,z,nx,ny,nz){
  // shortcut: a box encloses the .32 m body radius; use a capsule if tighter corner clearance is needed.
  bodyBounds.min.set(Math.min(x,nx)-radius,Math.min(y,ny)+.0001,Math.min(z,nz)-radius);
  bodyBounds.max.set(Math.max(x,nx)+radius,Math.max(y,ny)+headHeight,Math.max(z,nz)+radius);
  for(const meshes of collisionMeshes)for(const mesh of meshes){
   const geometry=mesh.geometry,vertices=geometry.attributes.position,index=geometry.index;
   if(!geometry.boundingBox)geometry.computeBoundingBox();
   meshBounds.copy(geometry.boundingBox).applyMatrix4(mesh.matrixWorld);
   if(!bodyBounds.intersectsBox(meshBounds))continue;
   // Keep the wall solid outside a doorway, even when its triangles span the opening.
   if(mesh.userData.collisionExclusions?.some(box=>box.containsBox(bodyBounds)))continue;
   localBounds.copy(bodyBounds).applyMatrix4(inverse.copy(mesh.matrixWorld).invert());
   let cache=collisionCells.get(geometry);
   if(!cache||cache.vertices!==vertices||cache.index!==index||cache.version!==vertices.version||cache.indexVersion!==index?.version){
    const cells=new Map();
    for(let i=0,count=index?index.count:vertices.count;i<count;i+=3){
     triangle.a.fromBufferAttribute(vertices,index?index.getX(i):i);
     triangle.b.fromBufferAttribute(vertices,index?index.getX(i+1):i+1);
     triangle.c.fromBufferAttribute(vertices,index?index.getX(i+2):i+2);
     triangleBounds.makeEmpty().expandByPoint(triangle.a).expandByPoint(triangle.b).expandByPoint(triangle.c);
     for(let x=Math.floor(triangleBounds.min.x/cellSize);x<=Math.floor(triangleBounds.max.x/cellSize);x++)
      for(let y=Math.floor(triangleBounds.min.y/cellSize);y<=Math.floor(triangleBounds.max.y/cellSize);y++)
       for(let z=Math.floor(triangleBounds.min.z/cellSize);z<=Math.floor(triangleBounds.max.z/cellSize);z++){
        const key=x+','+y+','+z,cell=cells.get(key);
        if(cell)cell.push(i);else cells.set(key,[i]);
       }
    }
    cache={cells,vertices,index,version:vertices.version,indexVersion:index?.version};collisionCells.set(geometry,cache);
   }
   for(let x=Math.floor(localBounds.min.x/cellSize);x<=Math.floor(localBounds.max.x/cellSize);x++)
    for(let y=Math.floor(localBounds.min.y/cellSize);y<=Math.floor(localBounds.max.y/cellSize);y++)
     for(let z=Math.floor(localBounds.min.z/cellSize);z<=Math.floor(localBounds.max.z/cellSize);z++){
      const cell=cache.cells.get(x+','+y+','+z);if(!cell)continue;
      for(const i of cell){
       triangle.a.fromBufferAttribute(vertices,index?index.getX(i):i);
       triangle.b.fromBufferAttribute(vertices,index?index.getX(i+1):i+1);
       triangle.c.fromBufferAttribute(vertices,index?index.getX(i+2):i+2);
       triangleBounds.makeEmpty().expandByPoint(triangle.a).expandByPoint(triangle.b).expandByPoint(triangle.c);
       if(!localBounds.intersectsBox(triangleBounds))continue;
       triangle.a.applyMatrix4(mesh.matrixWorld);triangle.b.applyMatrix4(mesh.matrixWorld);triangle.c.applyMatrix4(mesh.matrixWorld);
       if(bodyBounds.intersectsTriangle(triangle))return true;
      }
     }
  }
  return false;
 }
 function seatedArea(x,z,height){
  // The new side ramps cross the seating ellipse; only their actual surface is exempt.
  ray.ray.origin.set(x,height+.02,z);ray.ray.direction.copy(down);ray.far=.04;
  if(ray.intersectObjects(rampMeshes,false).some(hit=>normal.copy(hit.face.normal).applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld)).y>0))return false;
  // Keep seating-block access limits; blocked() checks clearance against the actual seats.
  const t=(Math.atan2(-z,x)+Math.PI*2)%(Math.PI*2),step=Math.PI/8;
  let aisleAngle=t;
  if(height<1&&x<0){
   const row=Math.max(0,Math.min(22,Math.round((height+9.9)/.43)));
   const ellipse=(Math.atan2(-z/(21+row*1.08),x/(31+row*1.08))+Math.PI*2)%(Math.PI*2);
   // The two entrance-side stairs follow the bowl ellipse, not a circle.
   if(Math.abs(ellipse-Math.PI)<Math.PI/4)aisleAngle=ellipse;
  }
  const aisle=Math.min(aisleAngle%step,step-aisleAngle%step)<.027;
  if(aisle)return false;
  if(x<0&&Math.abs(t-Math.PI)<.11&&height<1)return false;
  const lower=(x*x/31**2+z*z/21**2)>1&&(x*x/55.5**2+z*z/45.5**2)<1;
  const upper=(x*x/61**2+z*z/46**2)>1&&(x*x/85**2+z*z/70**2)<1;
  return (lower&&height<1)||(upper&&height>5);
 }
 function attempt(dx,dz){
  if(flight)return false;
  const dist=Math.hypot(dx,dz);if(dist<1e-8)return false;
  const steps=Math.ceil(dist/(radius/2)),sx=dx/steps,sz=dz/steps;
  let x=position.x,z=position.z,y=foot,falling=false;
  for(let i=0;i<steps;i++){
   const inAir=airborne||falling,nx=x+sx,nz=z+sz,h=groundAt(nx,nz,y);
   let ny=inAir?y:h;
   if(h===null||(inAir&&h>y+.02)||(!inAir&&(h-y>.65||y-h>1.25))||seatedArea(nx,nz,h))return false;
   if(blocked(x,y,z,nx,ny,nz)){
    if(inAir||h>=y||blocked(x,y,z,nx,y,nz))return false;
    ny=y;falling=true;
   }
   x=nx;z=nz;y=ny;
  }
  position.set(x,y,z);foot=y;
  if(falling){airborne=true;verticalSpeed=0;}
  return true;
 }
 function jump(){
  if(locked||airborne||flight)return;
  const ground=groundAt(position.x,position.z,foot);
  if((ground!==null&&Math.abs(foot-ground)<.1)||blocked(position.x,foot,position.z,position.x,foot-.01,position.z)){
   airborne=true;verticalSpeed=6.5;
  }
 }
 function updateJump(dt){
  let nextFoot=foot+verticalSpeed*dt-9*dt*dt;verticalSpeed-=18*dt;
  if(nextFoot>foot){
   ray.set(new THREE.Vector3(position.x,foot+headHeight,position.z),up);ray.far=nextFoot-foot+.03;
   const hit=ray.intersectObjects(wallMeshes.concat(floorMeshes,ceilingMeshes),false).find(hit=>!hit.object.userData.collisionExclusions?.some(box=>box.containsPoint(hit.point)));
   if(hit){nextFoot=foot+Math.max(0,hit.distance-.03);verticalSpeed=0;}
  }else{
   const ground=groundAt(position.x,position.z,foot,.02);
   if(ground!==null&&nextFoot<=ground){nextFoot=ground;verticalSpeed=0;airborne=false;}
  }
  if(blocked(position.x,foot,position.z,position.x,nextFoot,position.z)){
   let safe=foot,hit=nextFoot;
   for(let i=0;i<8;i++){
    const middle=(safe+hit)/2;
    if(blocked(position.x,foot,position.z,position.x,middle,position.z))hit=middle;else safe=middle;
   }
   if(nextFoot<foot)airborne=false;
   nextFoot=safe;verticalSpeed=0;
  }
  foot=nextFoot;position.y=foot;
 }
 function localDetour(target){
  const origin=position.clone(),savedFoot=foot,savedAirborne=airborne,savedSpeed=verticalSpeed;
  const nodes=[{x:0,z:0,point:origin,parent:null}],seen=new Set(['0,0']);
  let best=nodes[0],distance=Math.hypot(target.x-origin.x,target.z-origin.z);
  try{
   for(let i=0;i<nodes.length&&nodes.length<detourCandidates;i++)for(const [dx,dz] of detourDirections){
    const from=nodes[i],x=from.x+dx,z=from.z+dz,key=x+','+z;
    if(seen.has(key)||Math.hypot(x,z)*detourStep>detourRadius)continue;
    // Probe the same movement checks, then restore the live position before returning.
    position.copy(from.point);foot=position.y;airborne=false;verticalSpeed=0;
    if(!attempt(dx*detourStep,dz*detourStep)||airborne)continue;
    const node={x,z,point:position.clone(),parent:from};nodes.push(node);seen.add(key);
    const next=Math.hypot(target.x-position.x,target.z-position.z);
    if(next<distance-1e-6){best=node;distance=next;}
   }
  }finally{position.copy(origin);foot=savedFoot;airborne=savedAirborne;verticalSpeed=savedSpeed;}
  const route=[];for(let node=best;node.parent;node=node.parent)route.unshift(node.point);
  return route;
 }
 function walkTo(target){
  if(locked||flight||!input.walking)return;
  const next=new THREE.Vector3(...target);
  for(const mesh of wallMeshes){
   const boundary=mesh.userData.walkExclusion;if(!boundary)continue;
   const [cx,cz]=boundary.center;
   let dx=next.x-cx,dz=next.z-cz,distance=Math.hypot(dx,dz);
   if(distance>=boundary.radius)continue;
   if(distance<1e-8){dx=position.x-cx;dz=position.z-cz;distance=Math.hypot(dx,dz);}
   if(distance<1e-8){dx=-1;dz=0;distance=1;}
   dx/=distance;dz/=distance;
   // Clear the controller's square body in this direction, including diagonal approaches.
   const outside=boundary.radius+radius*(Math.abs(dx)+Math.abs(dz))+.02;
   next.set(cx+dx*outside,next.y,cz+dz*outside);
   next.y=groundAt(next.x,next.z,foot)??next.y;
  }
  walkRoute=[];
  if(stoppedWalk&&!airborne&&position.distanceToSquared(stoppedWalk.position)<1e-8&&
   (next.x-position.x)*(stoppedWalk.target.x-position.x)+(next.z-position.z)*(stoppedWalk.target.z-position.z)>0)walkRoute=localDetour(next);
  stoppedWalk=null;walkTarget=next;
 }
 function flyTo(target,seconds){
  if(locked||flight)return Promise.resolve(false);
  cancelWalk();airborne=true;verticalSpeed=0;
  return new Promise(resolve=>{flight={from:position.clone(),to:new THREE.Vector3(...target),yaw:target[3],seconds,elapsed:0,resolve};});
 }
 function update(dt){
  if(flight){
   flight.elapsed+=dt;
   const t=Math.min(1,flight.elapsed/flight.seconds);
   position.lerpVectors(flight.from,flight.to,t);position.y+=4*clickSit.arcHeightMeters*t*(1-t);
   foot=position.y;avatar.rotation.y=flight.yaw;avatar.position.copy(position);
   if(t===1){const landed=flight;flight=null;airborne=false;landed.resolve(true);}
   return;
  }
  if(!input.walking||locked)cancelWalk();
  if(input.walking&&!locked){
   const forward=Number(input.down('forward'))-Number(input.down('backward'));
   const side=Number(input.down('right'))-Number(input.down('left'));
   if(['forward','backward','left','right'].some(action=>input.down(action)))cancelWalk();
   const length=Math.hypot(forward,side),yaw=getYaw(),speed=(input.down('run')?8:4)*dt;
   let dx=0,dz=0,distance=0,target=null;
   if(length){dx=(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed/length;dz=(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed/length;}
   else if(walkTarget){
    target=walkRoute[0]??walkTarget;
    dx=target.x-position.x;dz=target.z-position.z;distance=Math.hypot(dx,dz);
    if(distance<1e-6){dx=dz=0;if(walkRoute.length)walkRoute.shift();else cancelWalk();}
    else{const step=Math.min(speed,distance)/distance;dx*=step;dz*=step;}
   }
   if(dx||dz){
    before.copy(position);
    if(!attempt(dx,dz)){attempt(dx,0);attempt(0,dz);}
    if(position.distanceToSquared(before)>1e-8)avatar.rotation.y=Math.atan2(-dx,-dz);
    if(walkTarget&&distance-Math.hypot(target.x-position.x,target.z-position.z)<1e-6){
     stoppedWalk={position:position.clone(),target:walkTarget};walkTarget=null;walkRoute.length=0;
    }
   }
  }
  if(airborne)updateJump(dt);
  if(!locked){
   if(lastSafe&&foot<lowestFloor-1)teleport([...lastSafe.toArray(),avatar.rotation.y]);
   if(!airborne&&(!lastSafe||!position.equals(lastSafe))){
    const ground=groundAt(position.x,position.z,foot,.02);
    if(ground!==null&&Math.abs(foot-ground)<.02){
     if(!lastSafe)lastSafe=new THREE.Vector3();
     lastSafe.copy(position);
    }
   }
  }
  avatar.position.copy(position);
 }
 return {
  position,avatar,floorMeshes,wallMeshes,registerWorld,groundAt,attempt,jump,update,teleport,walkTo,flyTo,
  standingAt(x,z,y){
   const h=groundAt(x,z,y);
   return h!==null&&Math.abs(h-y)<=.65&&!seatedArea(x,z,h)&&!blocked(x,h,z,x,h,z)?[x,h,z]:null;
  },
  get foot(){return foot;},get airborne(){return airborne;},
  addBlocker(mesh){if(!wallMeshes.includes(mesh))wallMeshes.push(mesh);},
  removeBlocker(mesh){const index=wallMeshes.indexOf(mesh);if(index!==-1)wallMeshes.splice(index,1);},
  setLocked(value){locked=value;if(value)cancelWalk();},
 };
}
