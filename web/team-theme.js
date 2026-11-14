// Per-match teams (broadcasts.json teams → teams.json). The arena model has two team slots named after the final:
// 'GEN.G' (jersey AudienceDetail_GEN.G, accent AudienceDetail_Gold, gold lightsticks, left backdrop) and
// 'BLG' (AudienceDetail_BLG, AudienceDetail_Cyan, cyan and pink lightsticks, right backdrop). Each team names its slot;
// a match recolours a slot only when its team differs from the model's own, so the final renders as before.

export function pickBroadcast(broadcasts,search){
 const id=new URLSearchParams(search).get('b');
 return broadcasts.find(b=>b.id===id)??broadcasts[0];
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

export async function applyTeamTheme(root,teams,THREE){
 const changed=Object.keys(DEFAULT).map(slot=>bySlot(teams,slot)).filter(t=>t&&t.id!==DEFAULT[t.slot]);
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
}
