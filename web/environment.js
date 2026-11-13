export function create(ctx){
 const {THREE,scene,player,renderer}=ctx,config=ctx.config('environment');
 const previousIntensity=scene.backgroundIntensity,skyRadius=ctx.camera.far*.8;
 const direction=new THREE.Vector3(...config.moon.direction).normalize();
 scene.backgroundIntensity=config.skyIntensity;

 const positions=new Float32Array(config.stars.count*3),phases=new Float32Array(config.stars.count);
 let seed=24;
 const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<config.stars.count;i++){
  const y=.015+.985*random(),angle=random()*Math.PI*2,radius=skyRadius*Math.sqrt(1-y*y);
  positions.set([radius*Math.cos(angle),skyRadius*y,radius*Math.sin(angle)],i*3);phases[i]=random()*Math.PI*2;
 }
 const starGeometry=new THREE.BufferGeometry();
 starGeometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 starGeometry.setAttribute('phase',new THREE.BufferAttribute(phases,1));
 const starMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
  uniforms:{time:{value:0},opacity:{value:config.stars.opacity},amplitude:{value:config.stars.twinkleAmplitude},
   period:{value:config.stars.periodSeconds},pointSize:{value:config.stars.size*renderer.getPixelRatio()},color:{value:new THREE.Color(config.stars.color)}},
  vertexShader:`attribute float phase;uniform float time,opacity,amplitude,period,pointSize;varying float alpha;
void main(){alpha=opacity*(.8+.2*sin(phase*7.))*(1.+amplitude*sin(time*6.2831853/period+phase));
gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=pointSize;}`,
  fragmentShader:`uniform vec3 color;varying float alpha;
void main(){float edge=1.-smoothstep(.1,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(color,alpha*edge);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const stars=new THREE.Points(starGeometry,starMaterial);stars.name='Environment_Stars';stars.frustumCulled=false;
 stars.onBeforeRender=(_renderer,_scene,camera)=>{stars.position.copy(camera.position);stars.updateMatrixWorld();};

 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
 const paint=canvas.getContext('2d'),gradient=paint.createRadialGradient(48,42,8,64,64,64);
 gradient.addColorStop(0,'#ffffff');gradient.addColorStop(1,'#aab7c9');
 paint.fillStyle=gradient;paint.fillRect(0,0,128,128);paint.fillStyle='rgba(61,75,98,.18)';
 for(const [x,y,r] of [[39,48,13],[56,36,9],[45,77,15],[78,68,11],[86,93,6]]){
  paint.beginPath();paint.arc(x,y,r,0,Math.PI*2);paint.fill();
 }
 const moonMap=new THREE.CanvasTexture(canvas);moonMap.colorSpace=THREE.SRGBColorSpace;
 const moon=new THREE.Mesh(new THREE.CircleGeometry(skyRadius*Math.tan(THREE.MathUtils.degToRad(config.moon.angularDiameterDegrees/2)),48),
  new THREE.MeshBasicMaterial({map:moonMap,color:new THREE.Color(...config.moon.color),toneMapped:false}));
 moon.name='Environment_Moon';moon.frustumCulled=false;
 moon.onBeforeRender=(_renderer,_scene,camera)=>{
  moon.position.copy(camera.position).addScaledVector(direction,skyRadius);moon.quaternion.copy(camera.quaternion);moon.updateMatrixWorld();
 };
 const moonLight=new THREE.DirectionalLight(new THREE.Color(...config.moon.color),config.moon.lightIntensity);
 moonLight.name='Environment_MoonLight';moonLight.position.copy(direction).multiplyScalar(100);
 moonLight.target.name='Environment_MoonTarget';

 const seaGeometry=new THREE.PlaneGeometry(config.sea.extent,config.sea.extent);
 seaGeometry.rotateX(-Math.PI/2);seaGeometry.translate(config.sea.boundaryX-config.sea.extent/2,config.sea.level,0);
 const seaMaterial=new THREE.ShaderMaterial({
  uniforms:{time:{value:0},color:{value:new THREE.Color(config.sea.color)},horizon:{value:new THREE.Color(config.sea.horizonColor)}},
  vertexShader:`varying vec3 world;
void main(){vec4 p=modelMatrix*vec4(position,1.);world=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;
// Keep the distant surface at the horizon without extending the arena camera's far plane.
gl_Position.z=min(gl_Position.z,gl_Position.w*.99999);}`,
  fragmentShader:`uniform float time;uniform vec3 color,horizon;varying vec3 world;
void main(){float distanceToEye=length(world.xz-cameraPosition.xz),fade=1.-exp(-distanceToEye*.003);
float wave=sin(dot(world.xz,vec2(.18,.48))+time*.65)*sin(dot(world.xz,vec2(.75,.14))-time*.35);
vec3 water=color+vec3(.012,.025,.04)*pow(max(0.,wave),8.)*(1.-fade);
gl_FragColor=vec4(mix(water,horizon,fade),1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
 const sea=new THREE.Mesh(seaGeometry,seaMaterial);sea.name='Environment_Sea';
 const shoreline=new THREE.Mesh(new THREE.BoxGeometry(.2,8,config.sea.extent),new THREE.MeshBasicMaterial());
 shoreline.name='Environment_Shoreline';shoreline.position.set(config.sea.boundaryX,3,0);shoreline.visible=false;
 scene.add(stars,moon,moonLight,moonLight.target,sea,shoreline);shoreline.updateMatrixWorld(true);player.addBlocker(shoreline);

 function update(dt,now){
  starMaterial.uniforms.time.value=now/1000;seaMaterial.uniforms.time.value=now/1000;
  const position=player.position,inside=position.x>-95&&position.x<94&&Math.abs(position.z)<70;
  // shortcut: light follows the local indoor bounds; add per-avatar masking for simultaneous indoor/outdoor views.
  moonLight.intensity=inside?0:config.moon.lightIntensity;
 }
 update(0,0);
 return {update,dispose(){
  player.removeBlocker(shoreline);scene.remove(stars,moon,moonLight,moonLight.target,sea,shoreline);
  for(const object of [stars,moon,sea,shoreline]){object.geometry.dispose();object.material.dispose();}
  moonMap.dispose();moonLight.dispose();scene.backgroundIntensity=previousIntensity;
 }};
}
