export function arenaContains(position,bounds,previous,margin){
 if(!Number.isFinite(position.x)||!Number.isFinite(position.z))return previous??false;
 const pad=previous===null?0:previous?margin:-margin;
 return position.x>=bounds.minX-pad&&position.x<bounds.maxX+pad&&Math.abs(position.z)<bounds.maxAbsZ+pad;
}

export function createArenaLod(ctx,crowd){
 const {THREE,root,scene,camera,player,cssLayer}=ctx,config=ctx.config('arena-lod'),bounds=ctx.config('screen').arenaBounds;
 const exterior=new RegExp(config.exterior),interior=new RegExp(config.interior),wallNames=new Set(config.walls);
 const portal=new THREE.Box3(new THREE.Vector3(...config.portal.min),new THREE.Vector3(...config.portal.max));
 const entries=[],materials=new Map(),materialZones=new Map(),flatMaterials=new Map(),originals=[];
 const background=scene.background,display=cssLayer.style.display,aperture=scene.getObjectByName('ScreenVideoAperture'),apertureMask=aperture?.layers.mask;
 const frustum=new THREE.Frustum(),view=new THREE.Matrix4(),lastView=new THREE.Matrix4(),box=new THREE.Box3();
 let inside=null,interiorVisible=null,lastX=Infinity,lastZ=Infinity,lastFull=null,disposed=false;
 const clone=original=>{
  const copy=original.clone();copy.onBeforeCompile=original.onBeforeCompile;copy.customProgramCacheKey=original.customProgramCacheKey;return copy;
 };
 const flat=original=>{
  if(flatMaterials.has(original))return flatMaterials.get(original);
  const copy=clone(original);
  if(original.map?.image){
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
   const paint=canvas.getContext('2d');paint.drawImage(original.map.image,0,0,1,1);
   const color=paint.getImageData(0,0,1,1).data;
   copy.color.multiply(new THREE.Color().setRGB(color[0]/255,color[1]/255,color[2]/255,THREE.SRGBColorSpace));
  }
  for(const key of Object.keys(copy))if(key!=='lightMap'&&copy[key]?.isTexture)copy[key]=null;
  copy.envMapIntensity=0;flatMaterials.set(original,copy);return copy;
 };
 const zonedMaterial=(original,zone)=>{
  if(!materials.has(zone))materials.set(zone,new Map());
  const copies=materials.get(zone);
  if(!copies.has(original)){
   const copy=clone(original);copies.set(original,copy);materialZones.set(copy,zone);
   if(zone==='wall')flat(copy);
  }
  return copies.get(original);
 };
 const eachMaterial=(value,fn)=>Array.isArray(value)?value.map(fn):fn(value);
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.geometry.attributes._cm_part||/^Audience_(DistantPictures|UpperMannequin)/.test(mesh.name))return;
  let zone=null;
  for(let owner=mesh;owner&&owner!==root;owner=owner.parent){
   if(/__lod10(?:_|$)/.test(owner.name)){zone='lod';break;}
   if(wallNames.has(owner.name)){zone='wall';break;}
   if(exterior.test(owner.name)){zone='exterior';break;}
   if(interior.test(owner.name)){zone='interior';break;}
   if(/^CCR_/.test(owner.name)&&box.setFromObject(mesh).max.x<bounds.minX){zone='exterior';break;}
  }
  if(!zone)return;
  originals.push({mesh,material:mesh.material,visible:mesh.visible});
  if(zone==='lod')mesh.visible=false;
  else mesh.material=eachMaterial(mesh.material,m=>zonedMaterial(m,zone));
  entries.push({mesh,zone,visible:mesh.visible,material:mesh.material});
 });
 for(const object of scene.children)if(/^Environment_|^Sky_Show$/.test(object.name)){
  entries.push({mesh:object,zone:'exterior',visible:object.visible});
  originals.push({mesh:object,visible:object.visible});
 }
 function update(){
  if(disposed)return;
  let changed=false;
  if(player.position.x!==lastX||player.position.z!==lastZ){
   lastX=player.position.x;lastZ=player.position.z;
   const next=arenaContains(player.position,bounds,inside,config.hysteresisMeters);
   if(next!==inside){inside=next;changed=true;crowd.setVisible(inside);scene.background=inside?null:background;}
  }
  camera.updateMatrixWorld();view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  if(changed||!view.equals(lastView)){
   lastView.copy(view);frustum.setFromProjectionMatrix(view);
   const visible=inside||frustum.intersectsBox(portal);
   if(visible!==interiorVisible){interiorVisible=visible;changed=true;}
  }
  if(changed)for(const entry of entries){
   const {mesh,zone}=entry;
   mesh.visible=entry.visible&&(zone==='exterior'?!inside:zone==='interior'?interiorVisible:zone!=='lod');
   if(zone==='wall')mesh.material=inside?eachMaterial(entry.material,flat):entry.material;
  }
  const full=cssLayer.hasAttribute('data-screen-full');
  if(changed||full!==lastFull){
   lastFull=full;cssLayer.style.display=interiorVisible||full?display:'none';
   if(aperture)aperture.layers.mask=interiorVisible?apertureMask:0;
  }
 }
 return {
  get inside(){return inside;},get interiorVisible(){return interiorVisible;},update,
  prepare(environment){
   if(disposed)return;
   const {renderer}=ctx,saved=entries.map(({mesh})=>[mesh,mesh.visible,mesh.material]),culling=[];
   const oldBackground=scene.background,oldEnvironment=scene.environment,group=crowd.lod?.group,visible=group?.visible;
   const apertureVisible=aperture?.visible,apertureLayers=aperture?.layers.mask;
   const scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest(),clear=renderer.autoClear;
   try{
    scene.traverse(mesh=>{if(mesh.isMesh){culling.push([mesh,mesh.frustumCulled]);mesh.frustumCulled=false;}});
    renderer.autoClear=false;renderer.setScissor(0,0,1,1);renderer.setScissorTest(true);
    if(aperture){aperture.visible=true;aperture.layers.mask=camera.layers.mask;}
    // The video cutout first appears on approach, including the glass transmission pass.
    for(const {mesh,visible,zone} of entries)mesh.visible=visible&&zone!=='lod';
    renderer.render(scene,camera);
    for(const {mesh,zone,visible,material} of entries){
     mesh.visible=visible&&zone!=='exterior'&&zone!=='lod';
     if(zone==='wall')mesh.material=eachMaterial(material,flat);
    }
    if(group){
     group.visible=true;
     group.traverse(mesh=>{if(mesh.isMesh){saved.push([mesh,mesh.visible,mesh.material]);mesh.visible=true;}});
    }
    scene.background=null;scene.environment=environment;
    // The first two interior draws compiled new programs in the entry trace.
    renderer.render(scene,camera);renderer.render(scene,camera);renderer.getContext().finish();
   }finally{
    for(const [mesh,visible,material] of saved){mesh.visible=visible;if(material)mesh.material=material;}
    for(const [mesh,culled] of culling)mesh.frustumCulled=culled;
    if(group)group.visible=visible;
    if(aperture){aperture.visible=apertureVisible;aperture.layers.mask=apertureLayers;}
    scene.background=oldBackground;scene.environment=oldEnvironment;
    renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);renderer.autoClear=clear;
   }
  },
  bindBatches({batches}){
   // Zone-specific materials prevent a static batch from mixing independently hidden surfaces.
   for(const mesh of batches){const zone=materialZones.get(mesh.material);if(zone)entries.push({mesh,zone,visible:mesh.visible,material:mesh.material});}
   update();
  },
  dispose(){
   if(disposed)return;disposed=true;
   for(const entry of originals){entry.mesh.visible=entry.visible;if(entry.material)entry.mesh.material=entry.material;}
   for(const copies of materials.values())for(const material of copies.values())material.dispose();
   for(const material of flatMaterials.values())material.dispose();
   scene.background=background;cssLayer.style.display=display;if(aperture)aperture.layers.mask=apertureMask;
  }
 };
}
