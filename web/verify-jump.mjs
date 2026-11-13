// Run with Playwright browser_run_code_unsafe (function expression).
async(page,base='http://127.0.0.1:8766/')=>{
 const context=await page.context().browser().newContext({viewport:{width:800,height:600}}),errors=[];
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 try{
  const host=await context.newPage(),guest=await context.newPage();
  for(const p of [host,guest]){
   p.on('pageerror',e=>errors.push(e.message));
   await p.goto(base);await p.waitForFunction(()=>arena.ready);
  }
  // U-H-11: #enter auto-places the host (app:enter); wait for its room, then the guest comes in by the invite URL.
  await host.locator('#enter').click();
  await host.waitForFunction(()=>arena.multiplayer.room,null,{timeout:60000});
  const room=await host.evaluate(()=>arena.multiplayer.room.code);
  await guest.goto(base+'?room='+room);await guest.waitForFunction(()=>window.arena?.ready);await guest.locator('#enter').click();
  for(const p of [host,guest])await p.waitForFunction(()=>arena.multiplayer.count===2,null,{timeout:30000});
  const result=await guest.evaluate(async()=>{
   const assert=(ok,message)=>{if(!ok)throw Error(message);};
   const key=(code,repeat=false)=>document.dispatchEvent(new KeyboardEvent('keydown',{code,repeat,cancelable:true}));
   const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
   const flight=()=>new Promise((resolve,reject)=>{
    let highest=-Infinity,lowest=Infinity,frames=0;const start=performance.now();
    function sample(){const s=arena.state;highest=Math.max(highest,s.y);lowest=Math.min(lowest,s.y);frames++;
     if(!s.airborne)return resolve({highest,lowest,frames,end:s});
     if(performance.now()-start>10000)return reject(Error('Landing timeout'));
     requestAnimationFrame(sample);
    }requestAnimationFrame(sample);
   });
   arena.go('plaza');const start=arena.state.y;
   // Mouse-first: walking is on from #enter, so there is no menu state that swallows Space any more.
   document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,isPrimary:true}));
   assert(key('Space')===false,'Space must prevent scrolling');
   assert(arena.state.airborne,'Space did not start jump');
   await wait(180);key('Space',true);key('Space');
   const first=await flight();
   assert(first.highest>start+.6&&first.highest<start+1.25,'Jump or double-jump height');
   assert(Math.abs(first.end.y-start)<.05,'Landing did not return to floor');
   key('Space',true);await wait(150);assert(!arena.state.airborne,'Held key re-jumped');
   document.dispatchEvent(new KeyboardEvent('keyup',{code:'Space'}));
   key('Space');assert(arena.state.airborne,'Cannot jump again after landing');
   key('KeyW');const moving=await flight();document.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));
   assert(moving.end.x>-138.5,'Horizontal movement blocked in air');
   key('Space');await wait(150);key('Escape');const paused=await flight();
   assert(!paused.end.airborne,'Opening menu froze jump');
   // The room-code field is gone (FIX1c); any text input must still not jump.
   const input=document.body.appendChild(document.createElement('input'));input.dispatchEvent(new KeyboardEvent('keydown',{code:'Space',bubbles:true}));
   assert(!arena.state.airborne,'Text input triggered jump');input.remove();
   document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerdown',{pointerId:1,isPrimary:true}));
   key('Space');arena.go('arena');assert(!arena.state.airborne,'Teleport retained jump');
   await wait(150);assert(Math.abs(arena.state.y+8.9)<.01,'Teleport retained vertical speed');
   key('Space');const arenaFlight=await flight();assert(Math.abs(arenaFlight.end.y+8.9)<.02,'Arena landing');
   return {first,moving,paused,arenaFlight};
  });
  await host.evaluate(()=>{window.jumpSeen=false;const end=performance.now()+8000;function sample(){if(arena.multiplayer.positions.some(p=>p[1]>-8.5&&p[0]===-25))window.jumpSeen=true;if(performance.now()<end)requestAnimationFrame(sample);}sample();});
  await guest.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{code:'Space'})));
  await host.waitForFunction(()=>window.jumpSeen,null,{timeout:8000});
  await guest.waitForFunction(()=>!arena.state.airborne);
  await host.waitForFunction(()=>arena.multiplayer.positions.some(p=>p[0]===-25&&Math.abs(p[1]+8.9)<.02));
  check(errors.length===0,errors.join(';'));
  return {passed:true,...result,remoteJumpAndLanding:true,errors};
 }finally{await context.close();}
}
