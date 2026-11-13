export function create(ctx){
 const {THREE,scene}=ctx,{beams:beamConfig,fireworks:fireworkConfig}=ctx.config('sky-show');
 const group=new THREE.Group();group.name='Sky_Show';
 const palette=[];
 scene.traverse(object=>{
  if(/^REF_(OverheadBeam|WingUplight).*_WebBeam$/.test(object.name))palette.push(object.material.uniforms.beamColor.value);
 });
 const beamGeometry=new THREE.CylinderGeometry(beamConfig.radiusMeters,.035,beamConfig.lengthMeters,16,1,true);
 beamGeometry.translate(0,beamConfig.lengthMeters/2,0);
 const beams=[];
 for(let i=0;i<beamConfig.count;i++){
  // shortcut: translucent cones approximate scattering; use volumetrics only if shadowed beams are required.
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
   uniforms:{beamColor:{value:palette[i%palette.length].clone()},opacity:{value:beamConfig.opacity}},
   vertexShader:'varying vec2 vUv;varying vec3 vN;varying vec3 vP;void main(){vUv=uv;vN=normalMatrix*normal;vec4 p=modelViewMatrix*vec4(position,1.);vP=p.xyz;gl_Position=projectionMatrix*p;}',
   fragmentShader:`uniform vec3 beamColor;uniform float opacity;varying vec2 vUv;varying vec3 vN;varying vec3 vP;
void main(){float edge=pow(abs(dot(normalize(vN),normalize(-vP))),1.8);
float fade=smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.65,1.,vUv.y));
gl_FragColor=vec4(beamColor,opacity*edge*fade);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  const beam=new THREE.Mesh(beamGeometry,material);beam.name='Sky_Beam_'+(i+1);
  beam.position.fromArray(beamConfig.positions[i]);beam.rotation.order='YXZ';
  beam.rotation.z=THREE.MathUtils.degToRad(beamConfig.tiltDegrees);beam.renderOrder=1;
  group.add(beam);beams.push(beam);
 }
 const fireworks=[];
 for(let i=0;i<fireworkConfig.count[1];i++){
  const geometry=new THREE.BufferGeometry(),positions=new Float32Array(fireworkConfig.particlesPerBurst*3);
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3).setUsage(THREE.DynamicDrawUsage));
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),fireworkConfig.speedMetersPerSecond*fireworkConfig.lifetimeSeconds+
   fireworkConfig.gravityMetersPerSecondSquared*fireworkConfig.lifetimeSeconds**2/2);
  const material=new THREE.PointsMaterial({color:palette[i%palette.length],size:fireworkConfig.pointSizeMeters,
   transparent:true,opacity:fireworkConfig.opacity,depthWrite:false,blending:THREE.AdditiveBlending});
  material.onBeforeCompile=shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_particle_fragment>',
    '#include <map_particle_fragment>\ndiffuseColor.a*=1.-smoothstep(.15,.5,length(gl_PointCoord-.5));');
  };
  const mesh=new THREE.Points(geometry,material);mesh.name='Sky_Firework_'+(i+1);
  mesh.position.fromArray(fireworkConfig.positions[i]);mesh.visible=false;group.add(mesh);
  fireworks.push({mesh,velocities:new Float32Array(positions.length),started:-Infinity});
 }
 scene.add(group);
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const interval=()=>1000*(fireworkConfig.intervalSeconds[0]+Math.random()*(fireworkConfig.intervalSeconds[1]-fireworkConfig.intervalSeconds[0]));
 let elapsed=0,lastNow=null,nextFirework=interval(),disposed=false;
 const visibility=()=>{lastNow=null;};document.addEventListener('visibilitychange',visibility);
 return {
  update(_dt,now){
   if(disposed)return;
   if(document.hidden){lastNow=null;return;}
   if(lastNow!==null)elapsed+=Math.max(0,now-lastNow);lastNow=now;
   const reduced=reducedMotion.matches;
   const angle=reduced?0:Math.sin(elapsed*2*Math.PI/(beamConfig.periodSeconds*1000))*THREE.MathUtils.degToRad(beamConfig.angleDegrees);
   for(const beam of beams)beam.rotation.y=angle;
   if(elapsed>=nextFirework){
    const count=fireworkConfig.count[0]+Math.floor(Math.random()*(fireworkConfig.count[1]-fireworkConfig.count[0]+1));
    for(let i=0;i<count;i++){
     const burst=fireworks[i];burst.started=elapsed;
     for(let p=0;p<burst.velocities.length;p+=3){
      const y=Math.random()*2-1,azimuth=Math.random()*Math.PI*2,radius=Math.sqrt(1-y*y),speed=fireworkConfig.speedMetersPerSecond;
      burst.velocities[p]=radius*Math.cos(azimuth)*speed;burst.velocities[p+1]=y*speed;burst.velocities[p+2]=radius*Math.sin(azimuth)*speed;
     }
    }
    // Missed intervals produce at most one event, never a backlog after a stalled frame.
    nextFirework=elapsed+interval();
   }
   for(const {mesh,velocities,started} of fireworks){
    const age=(elapsed-started)/1000;mesh.visible=age<fireworkConfig.lifetimeSeconds;
    if(!mesh.visible)continue;
    const time=reduced?fireworkConfig.lifetimeSeconds/2:age,positions=mesh.geometry.attributes.position;
    for(let p=0;p<velocities.length;p+=3){
     positions.array[p]=velocities[p]*time;
     positions.array[p+1]=velocities[p+1]*time-fireworkConfig.gravityMetersPerSecondSquared*time*time/2;
     positions.array[p+2]=velocities[p+2]*time;
    }
    positions.needsUpdate=true;
    mesh.material.opacity=fireworkConfig.opacity*(1-age/fireworkConfig.lifetimeSeconds)*(reduced?.5:1);
   }
  },
  dispose(){
   if(disposed)return;disposed=true;
   document.removeEventListener('visibilitychange',visibility);group.removeFromParent();beamGeometry.dispose();
   for(const beam of beams)beam.material.dispose();
   for(const {mesh} of fireworks){mesh.geometry.dispose();mesh.material.dispose();}
  }
 };
}
