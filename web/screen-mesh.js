export function createScreenMesh({THREE,root,config}){
 const settings=config('screen').mesh,originals=[],meshes=[],group=new THREE.Group();group.name='ArenaScreenMesh';
 root.updateMatrixWorld(true);
 const faces=[0,1,2,3].map(i=>root.getObjectByName('REF_Jumbotron_'+i)).filter(mesh=>mesh?.isMesh);
 if(faces.length!==4)return {meshes,dispose(){}};
 const bounds=new THREE.Box3().setFromObject(faces[0]),size=bounds.getSize(new THREE.Vector3()),center=new THREE.Vector3();
 for(const face of faces)center.add(new THREE.Box3().setFromObject(face).getCenter(new THREE.Vector3()));
 center.multiplyScalar(.25);
 const sx=settings.width/Math.hypot(size.x,size.z),sy=(settings.width*9/16)/size.y;
 const transform=new THREE.Matrix4().makeTranslation(center.x,settings.centerY,center.z)
  .multiply(new THREE.Matrix4().makeScale(sx,sy,sx)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z));
 const inverse=root.matrixWorld.clone().invert();
 root.traverse(mesh=>{
  if(!mesh.isMesh||!/^REF_(Jumbotron|Scoreboard|HeaderLight|WorldsHeader|ScreenUnderside)/.test(mesh.name))return;
  const replacement=mesh.clone(false);replacement.name='ScreenMesh_'+mesh.name;
  let change=transform;
  if(mesh.name.startsWith('REF_ScoreboardSuspension')){
   const box=new THREE.Box3().setFromObject(mesh),bottom=settings.centerY+(box.min.y-center.y)*sy;
   // Keep the roof anchor height while raising the screen end of the suspension.
   const stretch=(box.max.y-bottom)/(box.max.y-box.min.y);
   change=new THREE.Matrix4().makeTranslation(center.x,box.max.y,center.z)
    .multiply(new THREE.Matrix4().makeScale(sx,stretch,sx)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-box.max.y,-center.z));
  }
  inverse.clone().multiply(change).multiply(mesh.matrixWorld).decompose(replacement.position,replacement.quaternion,replacement.scale);
  group.add(replacement);originals.push({mesh,visible:mesh.visible});mesh.visible=false;
  if(/^REF_Jumbotron_[0-3]$/.test(mesh.name)){replacement.userData.screenFace=mesh.name;meshes.push(replacement);}
 });
 root.add(group);root.updateMatrixWorld(true);
 return {meshes,dispose(){group.removeFromParent();for(const {mesh,visible} of originals)mesh.visible=visible;}};
}
