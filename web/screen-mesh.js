import {isModelTeam} from './team-theme.js';
export function createScreenMesh({THREE,root,config}){
 const screen=config('screen'),settings=screen.mesh,originals=[],meshes=[],surfaces=[],photos=new Map(),group=new THREE.Group();group.name='ArenaScreenMesh';
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
  const raisedRig=/^REF_StageRig(Chords__Steel|Crossbeams__Steel|Diagonals__Silver)$/.test(mesh.name);
  if(!mesh.isMesh||(!raisedRig&&!/^REF_(Jumbotron|Scoreboard|HeaderLight|WorldsHeader|ScreenUnderside)/.test(mesh.name)))return;
  const replacement=mesh.clone(false);replacement.name='ScreenMesh_'+mesh.name;
  // The enlarged header needs the approved central lighting rig below the roof at 25 m.
  let change=raisedRig?new THREE.Matrix4().makeTranslation(0,10.7,0):transform;
  // Keep the underside clear of the stage backdrop without lifting the video bottom.
  if(/^REF_(ScoreboardUndersideGrid$|ScreenUnderside)/.test(mesh.name))change=new THREE.Matrix4().makeTranslation(0,.1,0).multiply(transform);
  if(mesh.name.startsWith('REF_ScoreboardSuspension')){
   const box=new THREE.Box3().setFromObject(mesh),bottom=settings.centerY+(box.min.y-center.y)*sy;
   // Keep the roof anchor height while raising the screen end of the suspension.
   const stretch=(box.max.y-bottom)/(box.max.y-box.min.y);
   change=new THREE.Matrix4().makeTranslation(center.x,box.max.y,center.z)
    .multiply(new THREE.Matrix4().makeScale(sx,stretch,sx)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-box.max.y,-center.z));
  }
  inverse.clone().multiply(change).multiply(mesh.matrixWorld).decompose(replacement.position,replacement.quaternion,replacement.scale);
  group.add(replacement);originals.push({mesh,visible:mesh.visible});mesh.visible=false;
  if(/^REF_Jumbotron_[0-3]$/.test(mesh.name)){
   replacement.userData.screenFace=mesh.name;meshes.push(replacement);
   if(Object.keys(screen.photos||{}).length){
    const box=new THREE.Box3().setFromObject(mesh),position=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    const normal=new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.normal,0).applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld));
    if(normal.dot(position.clone().sub(center))<0)normal.negate();
    const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),normal).normalize(),point=new THREE.Vector3();
    const photoGeometry=mesh.geometry.clone(),vertices=photoGeometry.attributes.position,uv=new THREE.Float32BufferAttribute(new Float32Array(vertices.count*2),2);
    // The baked artwork UVs are an atlas; project each photo across its whole face.
    for(let i=0;i<vertices.count;i++){
     point.fromBufferAttribute(vertices,i).applyMatrix4(mesh.matrixWorld).sub(position);
     uv.setXY(i,point.dot(right)/Math.hypot(size.x,size.z)+.5,point.y/size.y+.5);
    }
    photoGeometry.setAttribute('uv',uv);
    // The model's idle artwork shows GEN.G (Artwork_G) or BLG (Artwork_B); another match shows its own team's backdrop.
    const slot=/Artwork_B/.test(mesh.material.name)?'BLG':/Artwork_G/.test(mesh.material.name)?'GEN.G':null,team=(config('teams')?.teams||[]).find(t=>t.slot===slot);
    let idle={geometry:mesh.geometry,material:mesh.material};
    if(team?.backdrop&&!isModelTeam(team)){
     const map=new THREE.TextureLoader().load(team.backdrop);map.colorSpace=THREE.SRGBColorSpace;
     idle={geometry:photoGeometry,material:new THREE.MeshBasicMaterial({map,toneMapped:false,side:mesh.material.side}),owned:true};
     replacement.geometry=idle.geometry;replacement.material=idle.material;
    }
    surfaces.push({mesh:replacement,...idle,photoGeometry});
    const path=screen.photos[mesh.name];
    if(path){
     const map=new THREE.TextureLoader().load(path);map.colorSpace=THREE.SRGBColorSpace;
     photos.set(mesh.name,new THREE.MeshBasicMaterial({map,color:new THREE.Color().setScalar(screen.photoBrightness),toneMapped:false,side:mesh.material.side}));
    }
   }
  }
 });
 let videoFace;
 function setVideoFace(name){
  if(videoFace===name||!photos.size)return;
  videoFace=name;
  for(const surface of surfaces){
   const isVideo=surface.mesh.userData.screenFace===name;
   surface.mesh.geometry=isVideo?surface.geometry:surface.photoGeometry;
   surface.mesh.material=isVideo?surface.material:photos.get(surface.mesh.userData.screenFace)||photos.get(name);
  }
 }
 setVideoFace(screen.videoFace);
 root.add(group);root.updateMatrixWorld(true);
 return {meshes,setVideoFace,dispose(){group.removeFromParent();for(const {photoGeometry,material,owned} of surfaces){photoGeometry.dispose();if(owned){material.map.dispose();material.dispose();}}for(const material of photos.values()){material.map.dispose();material.dispose();}for(const {mesh,visible} of originals)mesh.visible=visible;}};
}
