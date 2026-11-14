const protectedName=/^(REF_Jumbotron_|REF_Reused_Monitor_pixels|REF_Player)|^ScreenVideoAperture$/;

export function createCameraOcclusion(root,config,floorMeshes=[]){
 const copies=new Map(),originals=new Map(),floors=new Set(floorMeshes),limit={value:0};
 const opacity={value:config.opacity},fade={value:config.fadeDistance},radius={value:config.radius};
 root.traverse(mesh=>{
  if(!mesh.isMesh||mesh.isSkinnedMesh||floors.has(mesh)||/^(Walk_|Suites_floor)/.test(mesh.name))return;
  for(let owner=mesh;owner;owner=owner.parent)if(protectedName.test(owner.name))return;
  const patch=original=>{
   if(!original.isMeshStandardMaterial&&!original.isMeshBasicMaterial)return original;
   if(original.map?.isVideoTexture)return original;
   if(copies.has(original))return copies.get(original);
   const material=original.clone(),key=original.customProgramCacheKey();
   material.onBeforeCompile=function(shader,renderer){
    original.onBeforeCompile.call(this,shader,renderer);
    shader.uniforms.cameraOcclusionLimit=limit;shader.uniforms.cameraOcclusionOpacity=opacity;shader.uniforms.cameraOcclusionFade=fade;shader.uniforms.cameraOcclusionRadius=radius;
    // The rig aims at the player; view-space XY measures distance from that sight line after deformation and batching.
    shader.vertexShader='varying vec3 cameraOcclusionPosition;\n'+shader.vertexShader
     .replace('#include <project_vertex>','#include <project_vertex>\ncameraOcclusionPosition=mvPosition.xyz;');
    shader.fragmentShader='varying vec3 cameraOcclusionPosition;\nuniform float cameraOcclusionLimit;\nuniform float cameraOcclusionOpacity;\nuniform float cameraOcclusionFade;\nuniform float cameraOcclusionRadius;\n'+shader.fragmentShader
     .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      if(cameraOcclusionLimit>0.0&&length(cameraOcclusionPosition.xy)<cameraOcclusionRadius){
       float depth=1.0/gl_FragCoord.w;
       float coverage=mix(cameraOcclusionOpacity,1.0,smoothstep(cameraOcclusionLimit-cameraOcclusionFade,cameraOcclusionLimit,depth));
       coverage=mix(coverage,1.0,smoothstep(cameraOcclusionRadius-cameraOcclusionFade,cameraOcclusionRadius,length(cameraOcclusionPosition.xy)));
       float noise=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))));
       if(noise>=coverage)discard;
      }
     `);
   };
   material.customProgramCacheKey=()=>`${key}:camera-occlusion-v2`;
   copies.set(original,material);originals.set(material,original);return material;
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(patch):patch(mesh.material);
 });
 return {
  update(distance){limit.value=Math.max(0,distance-config.targetPadding);},
  dispose(){
   limit.value=0;
   // LOD meshes created later share their source's material too.
   root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    const restore=material=>originals.get(material)??material;
    mesh.material=Array.isArray(mesh.material)?mesh.material.map(restore):restore(mesh.material);
   });
   for(const material of copies.values())material.dispose();copies.clear();originals.clear();
  },
 };
}
