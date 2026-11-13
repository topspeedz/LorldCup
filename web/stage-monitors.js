export function create(ctx){
 const {THREE,root}=ctx,config=ctx.config('stage-monitors');
 const mesh=root.getObjectByName('REF_Reused_Monitor_pixels__cyan');
 const originalGeometry=mesh.geometry,originalMaterial=mesh.material,geometry=originalGeometry.clone();
 const position=geometry.attributes.position,normal=geometry.attributes.normal,index=geometry.index;
 const parents=Array.from({length:position.count},(_,i)=>i),vertices=new Map(),bounds=new Map();
 const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 // Weld equal positions across normal seams, then identify the ten disconnected screens.
 for(let i=0;i<position.count;i++){
  const key=position.getX(i)+','+position.getY(i)+','+position.getZ(i);
  if(vertices.has(key))parents[i]=vertices.get(key);else vertices.set(key,i);
 }
 for(let i=0;i<(index?.count??position.count);i+=3){
  const a=find(index?index.getX(i):i),b=find(index?index.getX(i+1):i+1),c=find(index?index.getX(i+2):i+2);
  parents[b]=a;parents[c]=a;
 }
 for(let i=0;i<position.count;i++){
  const id=find(i),x=position.getX(i),y=position.getY(i);
  if(!bounds.has(id))bounds.set(id,{minX:x,maxX:x,minY:y,maxY:y});
  const box=bounds.get(id);
  box.minX=Math.min(box.minX,x);box.maxX=Math.max(box.maxX,x);
  box.minY=Math.min(box.minY,y);box.maxY=Math.max(box.maxY,y);
 }
 const uv=new Float32Array(position.count*2);
 for(let i=0;i<position.count;i++){
  const box=bounds.get(find(i)),u=(position.getX(i)-box.minX)/(box.maxX-box.minX);
  uv[i*2]=normal.getZ(i)<0?1-u:u;uv[i*2+1]=(position.getY(i)-box.minY)/(box.maxY-box.minY);
 }
 geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));

 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=144;
 const paint=canvas.getContext('2d'),colors=['#43dbd0','#f3ae62'];
 const generated=new THREE.CanvasTexture(canvas);
 generated.colorSpace=THREE.SRGBColorSpace;generated.generateMipmaps=false;generated.minFilter=THREE.LinearFilter;
 const material=new THREE.MeshBasicMaterial({map:generated,toneMapped:false});
 mesh.geometry=geometry;mesh.material=material;
 let disposed=false,lastFrame=-1,video=null,videoTexture=null;
 function draw(frame){
  const phase=frame/96*Math.PI*2;
  paint.fillStyle='#0a1d25';paint.fillRect(0,0,256,144);
  paint.fillStyle='#183a3d';paint.beginPath();paint.ellipse(128,67,110,48,0,0,Math.PI*2);paint.fill();
  paint.strokeStyle='#245052';paint.lineWidth=1;
  for(let x=16;x<256;x+=16){paint.beginPath();paint.moveTo(x,18);paint.lineTo(x,118);paint.stroke();}
  for(let y=22;y<118;y+=16){paint.beginPath();paint.moveTo(10,y);paint.lineTo(246,y);paint.stroke();}
  // Original geometric team skirmish and HUD; no game imagery, map, icons or characters.
  for(let team=0;team<2;team++){
   for(let i=0;i<5;i++){
    const angle=phase+(i/5+team*.5)*Math.PI*2;
    const x=128+Math.cos(angle)*(64+team*24),y=67+Math.sin(angle)*(22+team*12);
    paint.fillStyle=colors[team];paint.beginPath();paint.arc(x,y,3+i%2,0,Math.PI*2);paint.fill();
    paint.fillStyle='#07191c';paint.fillRect(x-6,y-9,12,3);
    paint.fillStyle='#83d994';paint.fillRect(x-6,y-9,8+3*Math.sin(phase+i),2);
    const pulse=(frame+i*13+team*7)%32/32;
    paint.strokeStyle=colors[team];paint.globalAlpha=1-pulse;
    paint.beginPath();paint.arc(x,y,5+pulse*12,0,Math.PI*2);paint.stroke();paint.globalAlpha=1;
   }
  }
  paint.fillStyle='#09151f';paint.fillRect(0,0,256,17);paint.fillRect(0,120,256,24);
  for(let team=0;team<2;team++){
   paint.fillStyle=colors[team];paint.fillRect(70+team*70,5,46,3);
   paint.fillStyle='#637879';paint.fillRect(76+team*70,11,34,2);
  }
  for(let i=0;i<6;i++){
   paint.fillStyle='#365666';paint.fillRect(52+i*25,125,19,12);
   paint.fillStyle=colors[i%2];paint.fillRect(54+i*25,132,15*(.5+.5*Math.sin(phase+i)),3);
  }
  generated.needsUpdate=true;lastFrame=frame;
 }
 draw(0);
 const fallback=()=>{if(!disposed){material.map=generated;material.needsUpdate=true;}};
 const play=()=>video.play().catch(fallback);
 const playing=()=>{
  if(disposed)return;
  if(!videoTexture){videoTexture=new THREE.VideoTexture(video);videoTexture.colorSpace=THREE.SRGBColorSpace;}
  material.map=videoTexture;material.needsUpdate=true;
 };
 const visibility=()=>{if(video){if(document.hidden)video.pause();else play();}};
 if(config.source==='video'&&typeof config.path==='string'&&config.path.trim()){
  video=document.createElement('video');video.crossOrigin='anonymous';
  video.muted=true;video.loop=true;video.playsInline=true;video.preload='auto';
  video.addEventListener('playing',playing);video.addEventListener('error',fallback);
  video.src=config.path;if(!document.hidden)play();
  document.addEventListener('visibilitychange',visibility);
 }
 return {
  update(dt,now){
   if(disposed||document.hidden||material.map!==generated)return;
   const frame=Math.floor(now*12/1000)%96;
   if(frame!==lastFrame)draw(frame);
  },
  dispose(){
   if(disposed)return;disposed=true;
   document.removeEventListener('visibilitychange',visibility);
   if(video){
    video.removeEventListener('playing',playing);video.removeEventListener('error',fallback);
    video.pause();video.removeAttribute('src');video.load();
   }
   mesh.geometry=originalGeometry;mesh.material=originalMaterial;
   geometry.dispose();material.dispose();generated.dispose();videoTexture?.dispose();
  }
 };
}
