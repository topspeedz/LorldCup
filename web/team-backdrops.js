export async function createTeamBackdrops({THREE,root}){
 const surfaces=[],loader=new THREE.TextureLoader();
 try{
  for(const [name,team] of [['REF_BackdropArtwork_-1','geng'],['REF_BackdropArtwork_1','blg']]){
   const mesh=root.getObjectByName(name);
   if(!mesh?.isMesh)throw new Error(`Missing team backdrop: ${name}`);
   const map=await loader.loadAsync(`./assets/screen/team-backdrop-${team}.png`);
   map.colorSpace=THREE.SRGBColorSpace;
   const geometry=mesh.geometry,material=mesh.material,copy=geometry.clone(),paint=material.clone();
   paint.onBeforeCompile=material.onBeforeCompile;paint.customProgramCacheKey=material.customProgramCacheKey;
   copy.computeBoundingBox();
   const box=copy.boundingBox,vertices=copy.attributes.position,uv=new THREE.Float32BufferAttribute(new Float32Array(vertices.count*2),2);
   // The original UVs sample an atlas; planar UVs keep the logo straight on the slanted outline.
   for(let i=0;i<vertices.count;i++)uv.setXY(i,(vertices.getX(i)-box.min.x)/(box.max.x-box.min.x),(vertices.getY(i)-box.min.y)/(box.max.y-box.min.y));
   copy.setAttribute('uv',uv);paint.map=paint.emissiveMap=map;
   mesh.geometry=copy;mesh.material=paint;
   surfaces.push({mesh,geometry,material,copy,paint,map});
  }
 }catch(error){dispose();throw error;}
 function dispose(){
  for(const {mesh,geometry,material,copy,paint,map} of surfaces){
   mesh.geometry=geometry;mesh.material=material;copy.dispose();paint.dispose();map.dispose();
  }
 }
 return {dispose};
}
