import * as THREE from 'three';
const bodyGeometry=new THREE.CapsuleGeometry(.25,.65,4,10);
const headGeometry=new THREE.SphereGeometry(.22,12,8);
const visorGeometry=new THREE.BoxGeometry(.29,.1,.07);
const legGeometry=new THREE.CapsuleGeometry(.09,.34,3,8);
const dark=new THREE.MeshStandardMaterial({color:0x13253d,roughness:.65});
export function createAvatar(color){
 const avatar=new THREE.Group(),material=new THREE.MeshStandardMaterial({color,roughness:.6});
 const body=new THREE.Mesh(bodyGeometry,material);body.position.y=.95;avatar.add(body);
 const head=new THREE.Mesh(headGeometry,material);head.position.y=1.62;avatar.add(head);
 const visor=new THREE.Mesh(visorGeometry,dark);visor.position.set(0,1.64,-.2);avatar.add(visor);
 for(const x of [-.14,.14]){const leg=new THREE.Mesh(legGeometry,dark);leg.position.set(x,.26,0);avatar.add(leg);}
 avatar.userData.material=material;
 avatar.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 return avatar;
}
