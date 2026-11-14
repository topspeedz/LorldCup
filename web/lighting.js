import * as THREE from 'three';
import {RGBELoader} from './vendor/RGBELoader.js';
import {applyBakedLightmaps} from './baked-lighting.js';

const vector=p=>new THREE.Vector3(p[0],p[2],-p[1]);

export async function createHybridLighting(root,renderer,scene){
 const response=await fetch('./lighting-config.json');
 if(!response.ok)throw new Error(`Lighting config HTTP ${response.status}`);
 const config=await response.json();
 if(!Number.isFinite(config.exposureEV)||!Number.isFinite(config.screenExposureEV)||!Number.isFinite(config.backgroundStrength)||config.backgroundStrength<0||!Array.isArray(config.lights)||!Array.isArray(config.disabledLights)||config.disabledLights.some(name=>typeof name!=='string'))throw new Error('Invalid lighting config');
 renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=2**config.exposureEV;
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 const [baked,hdr,cafeHDR,outsideHDR,sky]=await Promise.all([applyBakedLightmaps(root,config.lightMapIntensity,2**(config.screenExposureEV-config.exposureEV)),new RGBELoader().loadAsync('./stage-reflections.hdr'),new RGBELoader().loadAsync('./concourse-reflections.hdr'),new RGBELoader().loadAsync('./exterior-reflections.hdr'),new THREE.TextureLoader().loadAsync('./world-background.png')]);
 sky.colorSpace=THREE.SRGBColorSpace;sky.mapping=THREE.EquirectangularReflectionMapping;hdr.mapping=THREE.EquirectangularReflectionMapping;
 const pmrem=new THREE.PMREMGenerator(renderer);
 cafeHDR.mapping=outsideHDR.mapping=THREE.EquirectangularReflectionMapping;
 const interiorReflection=pmrem.fromEquirectangular(hdr).texture,concourseReflection=pmrem.fromEquirectangular(cafeHDR).texture,exteriorReflection=pmrem.fromEquirectangular(outsideHDR).texture;
 hdr.dispose();cafeHDR.dispose();outsideHDR.dispose();pmrem.dispose();scene.environment=interiorReflection;scene.background=sky;scene.backgroundIntensity=config.backgroundStrength;
 const materials=new Map();
 root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  let owner=mesh;
  while(owner.parent&&owner.parent!==root&&!owner.userData.bakedLighting)owner=owner.parent;
  const exterior=/^(EXR_|City|Collide_City|Walk_Plaza|Road|Crosswalk|Plaza|Bollards|Bench|Event_)/.test(owner.name);
  const concourse=/^(CCR_|Walk_Concourse|Walk_Atrium|Walk_EntryBridge|Collide_Lobby|Collide_Columns|Atrium_ceiling)/.test(owner.name);
  const reflection=exterior?exteriorReflection:concourse?concourseReflection:interiorReflection;
  const assign=material=>{
   if(material.userData.bakedLighting){
    const key=material.userData.bakedSource+reflection.uuid;
    if(!materials.has(key)){material.envMap=reflection;material.envMapIntensity=1;materials.set(key,material);}
    return materials.get(key);
   }
   const key=material.uuid+reflection.uuid;
   if(!materials.has(key)){
    const copy=material.clone();copy.envMap=reflection;copy.envMapIntensity=1;
    if(copy.userData.thinGlassIOR){
     copy.transparent=true;copy.opacity=1;copy.depthWrite=false;
     const f0=((copy.userData.thinGlassIOR-1)/(copy.userData.thinGlassIOR+1))**2;
     copy.onBeforeCompile=shader=>{
      shader.uniforms.thinGlassF0={value:f0};
      shader.fragmentShader='uniform float thinGlassF0;\n'+shader.fragmentShader.replace('#include <opaque_fragment>',
       'diffuseColor.a=thinGlassF0+(1.-thinGlassF0)*pow(1.-abs(dot(normal,normalize(vViewPosition))),5.);\n#include <opaque_fragment>');
     };
     copy.customProgramCacheKey=()=> 'thin-display-glass';
    }
    materials.set(key,copy);
   }
   return materials.get(key);
  };
  mesh.material=Array.isArray(mesh.material)?mesh.material.map(assign):assign(mesh.material);
 });
 const dynamicLights=[];
 const cafeSources=config.lights.filter(l=>l.name.startsWith('CCR_')).map(l=>({...l,location:vector(l.position)}));
 const cafeLights=Array.from({length:3},()=>{const l=new THREE.PointLight(0xffffff,0,12,2);scene.add(l);dynamicLights.push(l);return l;});
 for(const source of config.lights.filter(l=>/^REF_(TeamKey_|BackdropWash_|TrophyFill$|BowlWash_-1_0$|BowlWash_1_0$)/.test(l.name)&&!config.disabledLights.includes(l.name))){
  // Area lights become bounded point lights for moving characters; static surfaces use the bake.
  const light=new THREE.PointLight(new THREE.Color(...source.color),source.energy/(4*Math.PI),45,2);
  light.name=source.name;light.position.copy(vector(source.position));scene.add(light);dynamicLights.push(light);
 }
 const deck=config.lights.find(l=>l.name==='REF_DeckSoftbox');
 if(!deck)throw new Error('Missing deck lighting reference');
 const shadowKey=new THREE.SpotLight(new THREE.Color(...deck.color),deck.energy/(4*Math.PI),65,1.15,.75,2);
 shadowKey.position.copy(vector(deck.position));shadowKey.target.position.set(0,-9.5,0);
 shadowKey.castShadow=true;shadowKey.shadow.mapSize.set(1024,1024);shadowKey.shadow.bias=-.0002;shadowKey.shadow.normalBias=.03;
 scene.add(shadowKey,shadowKey.target);dynamicLights.push(shadowKey);
 const beams=[];
 for(const source of config.lights.filter(l=>l.type==='SPOT'&&/^REF_(OverheadBeam|WingUplight)/.test(l.name))){
  const origin=vector(source.position),direction=vector(source.direction).normalize();
  const length=direction.y<-.01?Math.min(50,(-9.9-origin.y)/direction.y):18;
  if(length<=0)continue;
  const geometry=new THREE.CylinderGeometry(.035,Math.tan(source.spot_size/2)*length,length,16,1,true);
  // shortcut: translucent cones approximate scattering; no volumetric shadow integration.
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
   uniforms:{beamColor:{value:new THREE.Color(...source.color)}},
   vertexShader:'varying vec2 vUv; varying vec3 vN; varying vec3 vP; void main(){vUv=uv;vN=normalMatrix*normal;vec4 p=modelViewMatrix*vec4(position,1.);vP=p.xyz;gl_Position=projectionMatrix*p;}',
   fragmentShader:`uniform vec3 beamColor;varying vec2 vUv;varying vec3 vN;varying vec3 vP;
void main(){float edge=pow(abs(dot(normalize(vN),normalize(-vP))),1.8);
float fade=smoothstep(0.,.18,vUv.y)*(1.-.7*vUv.y);
gl_FragColor=vec4(beamColor,.055*edge*fade);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  const beam=new THREE.Mesh(geometry,material);beam.name=source.name+'_WebBeam';beam.position.copy(origin).addScaledVector(direction,length/2);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);beam.renderOrder=1;scene.add(beam);beams.push(beam);
 }
 return {baked,beams,dynamicLights,shadowKey,interiorReflection,concourseReflection,exteriorReflection,
  update(inside,position){
   const cafe=inside&&position.y>-.2&&position.y<.8&&((position.x/59)**2+(position.z/46)**2>1);
   scene.environment=!inside?exteriorReflection:cafe?concourseReflection:interiorReflection;
   const nearest=cafe?cafeSources.map(l=>({light:l,distance:l.location.distanceToSquared(position)})).sort((a,b)=>a.distance-b.distance).slice(0,3):[];
   cafeLights.forEach((l,i)=>{const source=nearest[i]?.light;l.intensity=source?source.energy/(4*Math.PI):0;if(source){l.position.copy(source.location);l.color.setRGB(...source.color);}});
  }
 };
}
