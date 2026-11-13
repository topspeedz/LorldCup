// Run with Playwright browser_run_code_unsafe (function expression).
async (page,base='http://127.0.0.1:8766/') => {
 const context=await page.context().browser().newContext({viewport:{width:960,height:720}});
 const pages=[],errors=[];
 const check=(ok,message)=>{if(!ok)throw new Error(message);};
 try{
  for(let i=0;i<3;i++){
   const p=await context.newPage();pages.push(p);p.on('pageerror',e=>errors.push(e.message));
   await p.goto(base);await p.waitForFunction(()=>window.arena?.ready);
  }
  const [host,a,b]=pages;
  const route=await host.evaluate(async()=>{
   // The entrance needs a ticket (team + one emote) since T21; issue it so the walk itself is what is checked.
   const {events}=await import('./events.js'),{teams}=await (await fetch('./config/teams.json')).json();
   const issued=new Promise(resolve=>events.addEventListener('ticket:issued',resolve,{once:true}));
   events.dispatchEvent(new CustomEvent('team:changed',{detail:{teamId:teams[0].id}}));
   events.dispatchEvent(new CustomEvent('emote:played',{detail:{id:'cheer_clap'}}));
   await issued;
   const a=window.arena;a.go('plaza');let moved=0;
   for(let i=0;i<460;i++)if(a.attempt(.25,0))moved++;
   const end=a.state;a.go('plaza');
   const {validPose}=await import('./multiplayer.js');
   if(!validPose([0,0,0,0])||[null,[NaN,0,0,0],[0,0,1001,0],[0,0,0,4]].some(validPose))throw Error('pose validation');
   return {moved,end};
  });
  check(route.moved===460,'plaza to stage movement regression');
  // U-H-11: #enter auto-places the host (app:enter); wait for its room, then the guests come in by the invite URL.
  await host.locator('#enter').click();
  await host.waitForFunction(()=>arena.multiplayer.room,null,{timeout:60000});
  const code=await host.evaluate(()=>arena.multiplayer.room.code);
  for(const guest of [a,b]){await guest.goto(base+'?room='+code);await guest.waitForFunction(()=>window.arena?.ready);await guest.locator('#enter').click();}
  for(const p of pages)await p.waitForFunction(()=>arena.multiplayer.count===3,null,{timeout:30000});
  await a.evaluate(()=>arena.go('arena'));
  for(const p of [host,b])await p.waitForFunction(()=>arena.multiplayer.positions.some(p=>p[0]===-25&&Math.abs(p[1]+8.9)<.001),null,{timeout:15000});
  const camera=await a.evaluate(()=>({distance:arena.camera.position.distanceTo(arena.player),visible:arena.avatar.visible,position:arena.avatar.position.toArray()}));
  check(camera.distance>1&&camera.distance<6&&camera.visible,'TPS camera or avatar');
  await a.evaluate(()=>{document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,isPrimary:true}));document.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));});
  await a.waitForFunction(()=>arena.state.x>-24.5,null,{timeout:10000});
  await a.evaluate(()=>{document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));document.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));});
  await a.evaluate(()=>arena.multiplayer.leave());
  for(const p of [host,b])await p.waitForFunction(()=>arena.multiplayer.count===2);
  await host.evaluate(()=>arena.multiplayer.leave());
  // The host leaving hands the room over: b keeps the key alone (solo), it is not cut off.
  await b.waitForFunction(()=>arena.multiplayer.count===1&&arena.multiplayer.roomState.phase==='solo',null,{timeout:30000});
  check(errors.length===0,errors.join(';'));
  return {passed:true,route,camera,threePeers:true,guestToGuestPosition:true,keyboardMovement:true,leaveCleanup:true,errors};
 }finally{await context.close();}
}
