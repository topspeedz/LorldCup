import {isModelTeam,teamNameTexture} from './team-theme.js';

export async function createTeamBackdrops({THREE,root,config}){
 const teams=config('teams').teams,bySlot=slot=>teams.find(t=>t.slot===slot);
 const surfaces=[],loader=new THREE.TextureLoader();
 // Desk fronts keep the model's own artwork for its two teams; another team gets its name on a plate.
 const desks=[['REF_DeskFace_-1','GEN.G'],['REF_DeskFace_1','BLG']].filter(([,slot])=>bySlot(slot)&&!isModelTeam(bySlot(slot)));
 try{
  for(const [name,slot,desk] of [['REF_BackdropArtwork_-1','GEN.G'],['REF_BackdropArtwork_1','BLG'],...desks.map(d=>[...d,true])]){
   const team=bySlot(slot);
   const mesh=root.getObjectByName(name);
   if(!mesh?.isMesh)throw new Error(`Missing team backdrop: ${name}`);
   mesh.geometry.computeBoundingBox();
   const size=mesh.geometry.boundingBox.getSize(new THREE.Vector3());
   const map=desk?teamNameTexture(team,size.x/size.y,THREE,true):await loader.loadAsync(team?.backdrop??`./assets/screen/team-backdrop-${slot==='BLG'?'blg':'geng'}.png`);
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
