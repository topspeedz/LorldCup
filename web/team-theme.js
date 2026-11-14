// Per-match teams (broadcasts.json teams → teams.json). The arena model has two team slots named after the final:
// 'GEN.G' (jersey AudienceDetail_GEN.G, accent AudienceDetail_Gold, gold lightsticks, left backdrop) and
// 'BLG' (AudienceDetail_BLG, AudienceDetail_Cyan, cyan and pink lightsticks, right backdrop). Each team names its slot;
// a match recolours a slot only when its team differs from the model's own, so the final renders as before.

export function pickBroadcast(broadcasts,search){
 const id=new URLSearchParams(search).get('b');
 // A soon match (broadcasts.json soon) cannot be entered yet.
 const open=broadcasts.filter(b=>!b.soon);
 return open.find(b=>b.id===id)??open[0]??broadcasts[0];
}

export function broadcastTeams(config,broadcast){
 if(!broadcast?.teams)return config.teams;
 const all=[...config.teams,...(config.extraTeams??[])];
 const teams=broadcast.teams.map(id=>all.find(t=>t.id===id));
 if(teams.some(t=>!t)||new Set(teams.map(t=>t.slot)).size!==teams.length)throw Error(`방송 ${broadcast.id}의 팀 설정이 올바르지 않습니다`);
 return teams;
}

const bySlot=(teams,slot)=>teams.find(t=>t.slot===slot);

// Block crowd (far and upper seats): shirt colours per slot, lightstick colours Gold = GEN.G slot, Cyan/Pink = BLG slot.
export function themeCrowdConfig(crowd,teams){
 const a=bySlot(teams,'GEN.G'),b=bySlot(teams,'BLG');
 if(!a||!b)return crowd;
 return {...crowd,shirts:{'GEN.G':a.crowdShirt,BLG:b.crowdShirt},
  lightsticks:{...crowd.lightsticks,colors:{Gold:a.lightsticks[0],Cyan:b.lightsticks[0],Pink:b.lightsticks[1]??b.lightsticks[0]}}};
}

const DEFAULT={'GEN.G':'geng',BLG:'blg'};
export const isModelTeam=team=>DEFAULT[team.slot]===team.id;

// Banner LED art per slot (ribbon panels and wave ribbons); a match's team keeps the pattern in its LED colour.
const ART={'GEN.G':['REF_RearGoldArt','REF_GoldWaves'],BLG:['REF_RearBlueArt','REF_BlueWaves']};
export function tintPixels(data,rgb){
 for(let i=0;i<data.length;i+=4){const v=Math.max(data[i],data[i+1],data[i+2]);data[i]=v*rgb[0];data[i+1]=v*rgb[1];data[i+2]=v*rgb[2];}
 return data;
}
// The ribbon name texts are geometry: "GEN.G" is ~4.2 heights wide, "BLG" ~2.7, in all three ribbon fonts.
export const brandSlot=(width,height)=>width/height>3.4?'GEN.G':'BLG';

// White team name on a transparent canvas of the given aspect, or on a dark plate with LED lines (desk fronts).
export function teamNameTexture(team,aspect,THREE,plate=false){
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=Math.max(32,Math.round(1024/aspect));
 const ink=canvas.getContext('2d'),{width:w,height:h}=canvas,led=`rgb(${team.lightsticks[0].map(v=>Math.round(v*255))})`;
 if(plate){
  ink.fillStyle='#07090d';ink.fillRect(0,0,w,h);
  const glow=ink.createLinearGradient(0,0,w,0);glow.addColorStop(0,led);glow.addColorStop(.3,'#07090d00');glow.addColorStop(.7,'#07090d00');glow.addColorStop(1,led);
  ink.globalAlpha=.45;ink.fillStyle=glow;ink.fillRect(0,0,w,h);ink.globalAlpha=1;
  ink.fillStyle=led;ink.fillRect(0,0,w,h*.06);ink.fillRect(0,h*.94,w,h*.06);
 }
 const size=h*(plate?.55:.9);ink.font=`900 ${size}px system-ui,sans-serif`;
 const fit=Math.min(1,w*.92/ink.measureText(team.name).width);
 ink.font=`900 ${size*fit}px system-ui,sans-serif`;ink.textAlign='center';ink.textBaseline='middle';ink.fillStyle='#fff';ink.fillText(team.name,w/2,h/2);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.userData.team=team.name;
 return texture;
}

function tinted(texture,team,THREE){
 const {width,height}=texture.image,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ink=canvas.getContext('2d');ink.drawImage(texture.image,0,0);
 const pixels=ink.getImageData(0,0,width,height);tintPixels(pixels.data,team.lightsticks[0]);ink.putImageData(pixels,0,0);
 const copy=texture.clone();copy.source=new THREE.Source(canvas);copy.userData={...texture.userData,team:team.name};copy.needsUpdate=true; // own source: the clone shares the original's otherwise
 return copy;
}

// Model local axes of a name text: reading +x, up -z, front +y (Blender text axes after the glTF conversion).
function nameplate(box,THREE){
 const {min,max}=box,g=new THREE.BufferGeometry(),y=(min.y+max.y)/2;
 g.setAttribute('position',new THREE.Float32BufferAttribute([min.x,y,max.z, max.x,y,max.z, max.x,y,min.z, min.x,y,min.z],3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute([0,1,0,0,1,0,0,1,0,0,1,0],3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex([0,1,2,0,2,3]);
 return g;
}

function applyBanners(root,changed,materials,THREE){
 const copies=new Map(),swap=(texture,team)=>{if(!texture?.image)return texture;const key=texture.uuid+team.id;if(!copies.has(key))copies.set(key,tinted(texture,team,THREE));return copies.get(key);};
 for(const team of changed)for(const name of ART[team.slot])for(const m of materials.get(name)??[]){m.map=swap(m.map,team);m.emissiveMap=swap(m.emissiveMap,team);m.needsUpdate=true;}
 const plates=new Map();
 root.traverse(o=>{
  if(!o.isMesh||!/^REF_(RibbonBrand|SuiteBrand)_/.test(o.name))return;
  o.geometry.computeBoundingBox();
  const box=o.geometry.boundingBox,width=box.max.x-box.min.x,height=box.max.z-box.min.z,team=changed.find(t=>t.slot===brandSlot(width,height));
  if(!team)return;
  if(!plates.has(team)){
   const paint=o.material.clone(),map=teamNameTexture(team,width/height,THREE);
   paint.map=map;if(paint.emissive?.getHex())paint.emissiveMap=map;paint.alphaTest=.5;paint.userData={}; // own material: not merged by baked-lighting source
   plates.set(team,paint);
  }
  o.geometry=nameplate(box,THREE);o.material=plates.get(team);
 });
}

export async function applyTeamTheme(root,teams,THREE){
 const changed=Object.keys(DEFAULT).map(slot=>bySlot(teams,slot)).filter(t=>t&&!isModelTeam(t));
 if(!changed.length)return;
 const materials=new Map();
 root.traverse(o=>{for(const m of o.isMesh?[o.material].flat():[])materials.set(m.name,[...(materials.get(m.name)??[]),m]);});
 const loader=new THREE.TextureLoader();
 for(const team of changed){
  const slot=team.slot,accent=slot==='GEN.G'?'AudienceDetail_Gold':'AudienceDetail_Cyan';
  const sticks=slot==='GEN.G'?[['REF_Fan_REF_Gold',0]]:[['REF_Fan_REF_Cyan',0],['REF_Fan_REF_Pink',1]];
  const jersey=await loader.loadAsync(team.uniform);
  jersey.colorSpace=THREE.SRGBColorSpace;jersey.flipY=false; // glTF UVs
  for(const m of materials.get(`AudienceDetail_${slot}`)??[]){jersey.wrapS=m.map?.wrapS??jersey.wrapS;jersey.wrapT=m.map?.wrapT??jersey.wrapT;m.map=jersey;m.needsUpdate=true;}
  for(const m of materials.get(accent)??[])m.color.set(team.accent);
  for(const [name,i] of sticks)for(const m of materials.get(name)??[]){
   const rgb=team.lightsticks[i]??team.lightsticks[0];m.color.fromArray(rgb);m.emissive?.fromArray(rgb);
  }
 }
 applyBanners(root,changed,materials,THREE);
}
