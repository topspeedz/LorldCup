export function create(ctx){
 const {THREE,root,scene,camera,player}=ctx,config=ctx.config('arena-fixes');
 const group=new THREE.Group();group.name='ArenaFixes';scene.add(group);
 const bridge=root.getObjectByName('Walk_EntryBridge__concrete'),floors=[],labels=[],edgeWalls=[],exclusions=[];
 for(const rule of config.collisionExclusions??[]){
  const mesh=root.getObjectByName(rule.mesh);if(!mesh)continue;
  exclusions.push([mesh,mesh.userData.collisionExclusions]);
  mesh.userData.collisionExclusions=rule.boxes.map(box=>new THREE.Box3(new THREE.Vector3(...box.min),new THREE.Vector3(...box.max)));
 }
 for(const gap of config.bridgeGaps){
  const geometry=bridge.geometry.clone().applyMatrix4(bridge.matrixWorld);
  geometry.computeBoundingBox();
  const bounds=geometry.boundingBox.clone(),vertices=geometry.attributes.position;
  for(let i=0;i<vertices.count;i++){
   const along=(vertices.getX(i)-bounds.min.x)/(bounds.max.x-bounds.min.x);
   const across=(vertices.getZ(i)-bounds.min.z)/(bounds.max.z-bounds.min.z);
   const near=THREE.MathUtils.lerp(...gap.zMin,along),far=THREE.MathUtils.lerp(...gap.zMax,along);
   vertices.setXYZ(i,THREE.MathUtils.lerp(...gap.x,along),vertices.getY(i),THREE.MathUtils.lerp(near,far,across));
  }
  vertices.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const floor=new THREE.Mesh(geometry,bridge.material);floor.name='Walk_EntryGap_'+floors.length;
  group.add(floor);floors.push(floor);
 }
 for(const name of config.readableText){
  const source=root.getObjectByName(name);if(!source)continue;
  const label=new THREE.Mesh(source.geometry,source.material);label.name='Readable_'+name;
  source.matrixWorld.decompose(label.position,label.quaternion,label.scale);group.add(label);
  source.geometry.computeBoundingBox();
  labels.push({source,label,visible:source.visible,position:label.position.clone(),scaleX:label.scale.x,
   centerX:source.geometry.boundingBox.getCenter(new THREE.Vector3()).x,
   axis:new THREE.Vector3(1,0,0).applyQuaternion(label.quaternion),inverse:source.matrixWorld.clone().invert(),flipped:null});
  source.visible=false;
 }
 const boundary=config.stageBoundary;
 const wall=new THREE.Mesh(new THREE.CylinderGeometry(boundary.radius,boundary.radius,boundary.y[1]-boundary.y[0],192,1,true),new THREE.MeshBasicMaterial());
 wall.name='Collide_StageBoundary';wall.visible=false;wall.userData.walkExclusion=boundary;
 wall.position.set(boundary.center[0],(boundary.y[0]+boundary.y[1])/2,boundary.center[1]);group.add(wall);
 for(const edge of config.edgeSegments??[]){
  const [ax,ay,az]=edge.start,[bx,by,bz]=edge.end;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([ax,ay,az,bx,by,bz,bx,by+3.2,bz,ax,ay+3.2,az],3));
  geometry.setIndex([0,1,2,0,2,3]);
  const blocker=new THREE.Mesh(geometry,wall.material);blocker.name='Collide_AisleEdge_'+edgeWalls.length;
  blocker.visible=false;group.add(blocker);edgeWalls.push(blocker);
 }
 for(const gap of config.rampGaps??[]){
  const [ax,bx]=gap.x,[ay,by]=gap.y,[az,bz]=gap.z;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([ax,ay,az,bx,by,az,bx,by,bz,ax,ay,bz],3));
  geometry.setIndex([0,2,1,0,3,2]);
  const floor=new THREE.Mesh(geometry,wall.material);floor.name='Walk_EntryRampGap_'+floors.length;
  floor.visible=false;group.add(floor);floors.push(floor);
 }
 group.updateMatrixWorld(true);player.registerWorld(group);
 const view=new THREE.Vector3();
 function update(){
  for(const item of labels){
   camera.getWorldPosition(view).applyMatrix4(item.inverse);
   const flipped=view.y<0;if(flipped===item.flipped)continue;
   // Extruded glyph backs mirror their front; reflect around the label centre only from behind.
   item.label.scale.x=item.scaleX*(flipped?-1:1);
   item.label.position.copy(item.position).addScaledVector(item.axis,flipped?2*item.centerX*item.scaleX:0);
   item.flipped=flipped;
  }
 }
 update();
 return {update,dispose(){
  player.removeBlocker(wall);wall.geometry.dispose();wall.material.dispose();
  for(const blocker of edgeWalls){player.removeBlocker(blocker);blocker.geometry.dispose();}
  for(const floor of floors){player.floorMeshes.splice(player.floorMeshes.indexOf(floor),1);floor.geometry.dispose();}
  for(const item of labels)item.source.visible=item.visible;
  for(const [mesh,previous] of exclusions){
   if(previous===undefined)delete mesh.userData.collisionExclusions;else mesh.userData.collisionExclusions=previous;
  }
  group.removeFromParent();
 }};
}
