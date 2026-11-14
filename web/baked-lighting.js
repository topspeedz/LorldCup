import * as THREE from 'three';

// Keep the installed shader's geometry/iridescence setup, but omit real-time light loops.
const staticBegin=THREE.ShaderChunk.lights_fragment_begin.split('IncidentLight directLight;')[0]+`
vec3 irradiance = vec3(0.0);
vec3 iblIrradiance = vec3(0.0);
vec3 radiance = vec3(0.0);
vec3 clearcoatRadiance = vec3(0.0);
`;
const staticMaps=THREE.ShaderChunk.lights_fragment_maps.replace(
 'lightMapTexel.rgb * lightMapIntensity',
 'lightMapTexel.rgb * lightMapTexel.a * bakedLightRange * lightMapIntensity');
const staticEnd=THREE.ShaderChunk.lights_fragment_end.replace(/\tRE_IndirectSpecular\([^;]+;/,
 call=>`vec3 bakedDiffuse = reflectedLight.indirectDiffuse;\n${call}\nreflectedLight.indirectDiffuse = bakedDiffuse;`)+`
reflectedLight.indirectDiffuse *= getShadowMask();
`;

export async function applyBakedLightmaps(root,intensities={},screenIntensity=1){
 if(Object.values(intensities).some(value=>!Number.isFinite(value)||value<0))throw new Error('Invalid lightmap intensity');
 if(!Number.isFinite(screenIntensity)||screenIntensity<0)throw new Error('Invalid screen intensity');
 const entries=[],textures=new Map(),loader=new THREE.TextureLoader();
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  let owner=mesh;
  while(owner&&!owner.userData.bakedLighting)owner=owner.parent;
  if(!owner)return;
  const info=owner.userData.bakedLighting;
  if(mesh.geometry.getAttribute('_cm_part'))throw new Error(`Moving crowd cannot use a lightmap: ${mesh.name}`);
  if(!/^\.\/lightmaps\/[a-zA-Z0-9._-]+\.png$/.test(info.texture)||!Number.isFinite(info.range)||info.range<=0)
   throw new Error(`Invalid baked lighting metadata: ${mesh.name}`);
  const uv=mesh.geometry.getAttribute(info.uvAttribute),position=mesh.geometry.getAttribute('position');
  if(!uv||uv.itemSize!==2||uv.count!==position?.count)throw new Error(`Missing lightmap UVs: ${mesh.name}`);
  for(let i=0;i<uv.count;i++)for(const value of [uv.getX(i),uv.getY(i)])
   if(!Number.isFinite(value)||value<-.00001||value>1.00001)throw new Error(`Invalid lightmap UVs: ${mesh.name}`);
  const originals=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(originals.some(m=>!m.isMeshStandardMaterial))throw new Error(`Lightmap requires a PBR material: ${mesh.name}`);
  entries.push({mesh,info,uv,originals});
  if(!textures.has(info.texture))textures.set(info.texture,null);
 });
 await Promise.all([...textures.keys()].map(async path=>{
  const texture=await loader.loadAsync(path);
  texture.colorSpace=THREE.NoColorSpace;texture.flipY=false;texture.channel=3;
  // shortcut: two-pixel chart padding cannot isolate mip levels; add mip-safe dilation before enabling mipmaps.
  texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
  textures.set(path,texture);
 }));
 let materialCount=0;
 for(const {mesh,info,uv,originals} of entries){
  mesh.geometry.setAttribute('uv3',uv);
  mesh.receiveShadow=true;
  const materials=originals.map(original=>{
   const material=original.clone();
   material.lightMap=textures.get(info.texture);
   // Cycles diffuse without COLOR stores outgoing radiance; Three expects irradiance.
   material.lightMapIntensity=Math.PI*(intensities[info.texture]??1);
   // shortcut: these posters have black base color; reassess compensation if the asset gains lit color.
   if(/^REF_Jumbotron_[0-3]$/.test(mesh.name))material.emissiveIntensity*=screenIntensity;
   material.onBeforeCompile=(shader,renderer)=>{
    original.onBeforeCompile.call(material,shader,renderer);
    shader.uniforms.bakedLightRange={value:info.range};
    // shortcut: moving shadows attenuate all baked diffuse; split direct/indirect maps to preserve indirect fill.
    shader.fragmentShader='uniform float bakedLightRange;\n'+shader.fragmentShader
     .replace('#include <shadowmap_pars_fragment>','#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
     .replace('#include <lights_fragment_begin>',staticBegin)
     .replace('#include <lights_fragment_maps>',staticMaps)
     .replace('#include <lights_fragment_end>',staticEnd);
   };
   material.customProgramCacheKey=()=>`barclays-lightmap-r170:${original.customProgramCacheKey()}`;
   material.userData.bakedLighting=true;
   material.userData.bakedSource=`${original.uuid}:${info.texture}:${info.range}:${material.emissiveIntensity}`;materialCount++;
   return material;
  });
  mesh.material=Array.isArray(mesh.material)?materials:materials[0];
 }
 return {meshes:entries.length,materials:materialCount,textures:textures.size};
}
