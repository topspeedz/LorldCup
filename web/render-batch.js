import * as THREE from 'three';

// These named meshes are interactive, deforming, or used by collision/camera raycasts.
const reserved=/^(REF_Jumbotron_|REF_Reused_Monitor_pixels|REF_Player|REF_FanLightsticks|Walk_|Collide_|Audience|Roof|Atrium_ceiling|Seats__|Seat_armrests__|REF_(CircularStage|TrophyIsland|RunwayTransition|CenterStairs|TeamRiser))|Player_desks|Player_PC|Player_chair|Plaza_bench|Bollards|REF_DeskBody|REF_CenterBackdrop|REF_WingMainFrame|CCR_(Counter|Timber|Refrigerator|Lounge|Banquette)/;

export function createRenderBatches(root){
 const groups=new Map(),batches=[],sources=[],inverse=root.matrixWorld.clone().invert();
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||!mesh.visible||reserved.test(mesh.name)||mesh.children.length)return;
  const g=mesh.geometry,m=mesh.material;
  if(Array.isArray(m)||m.transparent||m.transmission||g.attributes._cm_part||Object.keys(g.morphAttributes).length||mesh.matrixWorld.determinant()<=0)return;
  const layout=Object.entries(g.attributes).map(([name,a])=>`${name}:${a.itemSize}:${a.normalized}:${a.array.constructor.name}`).sort().join(',');
  const key=`${m.uuid}/${!!g.index}/${mesh.castShadow}/${mesh.receiveShadow}/${mesh.renderOrder}/${layout}`;
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
 });
 for(const meshes of groups.values()){
  if(meshes.length<2)continue;
  const vertices=meshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0),indices=meshes.reduce((n,m)=>n+(m.geometry.index?.count??0),0);
  const first=meshes[0],batch=new THREE.BatchedMesh(meshes.length,vertices,indices,first.material);
  batch.name='Static_RenderBatch';batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;batch.renderOrder=first.renderOrder;
  for(const mesh of meshes){
   const id=batch.addInstance(batch.addGeometry(mesh.geometry));batch.setMatrixAt(id,inverse.clone().multiply(mesh.matrixWorld));
   sources.push({mesh,mask:mesh.layers.mask});mesh.layers.disableAll();
  }
  batch.computeBoundingBox();batch.computeBoundingSphere();root.add(batch);batches.push(batch);
 }
 return {batches,sources,dispose(){
  for(const {mesh,mask} of sources)mesh.layers.mask=mask;
  for(const batch of batches){batch.removeFromParent();batch.dispose();}
 }};
}
