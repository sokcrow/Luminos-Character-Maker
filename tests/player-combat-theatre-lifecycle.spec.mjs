import { test, expect } from '@playwright/test';

const BASE=process.env.LIFECYCLE_BASE_URL||'http://127.0.0.1:4173';

async function bootHarness(page){
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  await page.setContent(`
    <!doctype html><html><body>
      <div class="sheet-phone-wrapper"></div>
      <div id="theatre-view-player" style="display:none;width:100vw;height:100vh"></div>
      <div id="player-instance-blackout"></div>
      <script src="/js/instance-control.js"></script>
    </body></html>
  `);
  await page.waitForFunction(()=>Boolean(window.LuminousInstanceControl));
}

test('Player Combat is fully destroyed outside Combat and does not accumulate hidden Battle viewers',async({page})=>{
  await bootHarness(page);

  await page.evaluate(()=>window.LuminousInstanceControl.applyPlayerInstance('teatro'));
  await expect(page.locator('#theatre-view-player')).toHaveCSS('display','flex');
  await expect(page.locator('#theatre-view-player')).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#player-instance-combat')).toHaveCount(0);
  expect(page.frames().filter(frame=>frame.url().includes('Battle-viewer.html')).length).toBe(0);

  for(let cycle=0;cycle<6;cycle+=1){
    await page.evaluate(()=>window.LuminousInstanceControl.applyPlayerInstance('combate'));
    await expect(page.locator('#player-instance-combat')).toHaveCount(1);
    await expect(page.locator('#player-instance-combat')).toHaveAttribute('src','Battle-viewer.html');

    await expect.poll(()=>page.frames().filter(frame=>frame.url().includes('Battle-viewer.html')).length,{timeout:10000}).toBe(1);

    await page.evaluate(()=>window.LuminousInstanceControl.applyPlayerInstance('teatro'));
    await expect(page.locator('#player-instance-combat')).toHaveCount(0);
    await expect(page.locator('#theatre-view-player')).toHaveCSS('display','flex');
    await expect(page.locator('#theatre-view-player')).toHaveAttribute('aria-hidden','false');
    await expect.poll(()=>page.frames().filter(frame=>frame.url().includes('Battle-viewer.html')).length,{timeout:10000}).toBe(0);

    const residue=await page.evaluate(()=>({
      combatIframeCount:document.querySelectorAll('#player-instance-combat').length,
      battleIframeCount:Array.from(document.querySelectorAll('iframe')).filter(frame=>String(frame.getAttribute('src')||'').includes('Battle-viewer')).length,
      theatreActive:document.body.classList.contains('player-instance-theatre'),
      combatActive:document.body.classList.contains('player-instance-combat')
    }));
    expect(residue).toEqual({combatIframeCount:0,battleIframeCount:0,theatreActive:true,combatActive:false});
  }

  const bodyState=await page.evaluate(()=>({
    theatre:document.body.classList.contains('player-instance-theatre'),
    combat:document.body.classList.contains('player-instance-combat'),
    battleFrames:Array.from(document.querySelectorAll('iframe')).filter(frame=>String(frame.src).includes('Battle-viewer')).length
  }));
  expect(bodyState).toEqual({theatre:true,combat:false,battleFrames:0});
});


test('Combat Theater preserves the live Battle viewer and resumes the same frame',async({page})=>{
  await bootHarness(page);

  await page.evaluate(()=>window.LuminousInstanceControl.applyPlayerInstance('combate'));
  await expect(page.locator('#player-instance-combat')).toHaveCount(1);
  await page.evaluate(()=>{ document.getElementById('player-instance-combat').dataset.lifecycleIdentity='same-frame'; });

  await page.evaluate(()=>window.LuminousInstanceControl.applyPlayerInstance('combat_theatre'));
  await expect(page.locator('#player-instance-combat')).toHaveCount(1);
  await expect(page.locator('#player-instance-combat')).toHaveCSS('display','none');
  await expect(page.locator('#player-instance-combat')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('#theatre-view-player')).toHaveCSS('display','flex');
  await expect(page.locator('body')).toHaveClass(/player-instance-combat-theatre/);
  expect(page.frames().filter(frame=>frame.url().includes('Battle-viewer.html')).length).toBe(1);

  await page.evaluate(()=>window.LuminousInstanceControl.applyPlayerInstance('combate'));
  await expect(page.locator('#player-instance-combat')).toHaveCount(1);
  await expect(page.locator('#player-instance-combat')).toHaveAttribute('data-lifecycle-identity','same-frame');
  await expect(page.locator('#player-instance-combat')).toHaveCSS('display','block');
  await expect(page.locator('#theatre-view-player')).toHaveCSS('display','none');
  await expect(page.locator('body')).not.toHaveClass(/player-instance-combat-theatre/);
  expect(page.frames().filter(frame=>frame.url().includes('Battle-viewer.html')).length).toBe(1);
});

test('DM opening Theater during Combat publishes combat_theatre instead of ending Combat',async({page})=>{
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  await page.setContent(`
    <!doctype html><html><body class="on-game-dashboard">
      <label><input id="theatre-radio" type="radio" name="instancia" value="teatro"></label>
      <label><input type="radio" name="instancia" value="combate"></label>
      <section id="modulo-standby" class="game-module"></section>
      <section id="modulo-teatro" class="game-module"></section>
      <section id="modulo-combate" class="game-module"></section>
      <span id="current-output-status"></span>
      <script src="/js/instance-control.js"></script>
    </body></html>
  `);
  await page.waitForFunction(()=>Boolean(window.LuminousInstanceControl));

  const writes=await page.evaluate(async()=>{
    const writes=[];
    let instanceHandler=null;
    const db={
      ref(path=''){
        return {
          set(value){writes.push({op:'set',path,value});return Promise.resolve()},
          update(value){writes.push({op:'update',path,value});return Promise.resolve()},
          once(){return Promise.resolve({exists:()=>true,val:()=>({phase:'PRE_COMBAT_PLANNING',round:3,active:true})})},
          on(event,handler){if(path==='campaña/estado_mundo/instancia_activa'&&event==='value')instanceHandler=handler},
        };
      }
    };
    window.firebase={database:{ServerValue:{TIMESTAMP:12345}}};
    window.LuminousInstanceControl.bindDashboard({db,doc:document});
    instanceHandler?.({val:()=> 'combate'});
    const radio=document.getElementById('theatre-radio');
    radio.checked=true;
    radio.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,20));
    return writes;
  });

  expect(writes).toContainEqual({
    op:'set',
    path:'campaña/estado_mundo/instancia_activa',
    value:'combat_theatre'
  });
  expect(writes.some(row=>row.path==='campaña/combate/estado')).toBe(false);
});

test('switching DM output back to Combat preserves an existing round',async({page})=>{
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  await page.setContent(`
    <!doctype html><html><body class="on-game-dashboard">
      <label><input type="radio" name="instancia" value="teatro"></label>
      <label><input id="combat-radio" type="radio" name="instancia" value="combate"></label>
      <section id="modulo-standby" class="game-module"></section>
      <section id="modulo-teatro" class="game-module"></section>
      <section id="modulo-combate" class="game-module"></section>
      <span id="current-output-status"></span>
      <script src="/js/instance-control.js"></script>
    </body></html>
  `);
  await page.waitForFunction(()=>Boolean(window.LuminousInstanceControl));

  const result=await page.evaluate(async()=>{
    const writes=[];
    const existingState={phase:'PRE_COMBAT_PLANNING',round:4,authorityUid:'dm'};
    const refs=new Map();
    function ref(path=''){
      if(refs.has(path))return refs.get(path);
      const api={
        path,
        set(value){writes.push({op:'set',path,value});return Promise.resolve()},
        update(value){writes.push({op:'update',path,value});return Promise.resolve()},
        once(){return Promise.resolve({exists:()=>path==='campaña/combate/estado',val:()=>path==='campaña/combate/estado'?existingState:null})},
        on(){},
      };
      refs.set(path,api);return api;
    }
    const db={ref};
    window.firebase={database:{ServerValue:{TIMESTAMP:12345}}};
    window.LuminousInstanceControl.bindDashboard({db,doc:document});
    const radio=document.getElementById('combat-radio');
    radio.checked=true;
    radio.dispatchEvent(new Event('change',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,20));
    return writes;
  });

  expect(result.some(row=>row.path==='campaña/combate/estado')).toBe(false);
});


test('DM instance callback sends Player Combat to Theatre with zero Battle residue',async({page})=>{
  await bootHarness(page);
  const result=await page.evaluate(async()=>{
    let instanceHandler=null;
    const db={
      ref(path){
        if(path!=='campaña/estado_mundo/instancia_activa')return {on(){},off(){}};
        return {
          on(event,handler){ if(event==='value')instanceHandler=handler; },
          off(){}
        };
      }
    };
    // page.setContent() replaces the document but preserves window globals from
    // index.html. Remove the inherited Auth surface so this unit harness binds
    // data immediately instead of waiting for a real auth restoration event.
    window.firebase={database:{ServerValue:{TIMESTAMP:12345}}};
    window.LuminousInstanceControl.bindPlayer({db,doc:document});
    const emit=value=>instanceHandler?.({val:()=>value});

    emit('combate');
    await new Promise(resolve=>setTimeout(resolve,50));
    const duringCombat={
      iframeCount:document.querySelectorAll('#player-instance-combat').length,
      battleSrc:document.getElementById('player-instance-combat')?.getAttribute('src')||''
    };

    emit('teatro');
    await new Promise(resolve=>setTimeout(resolve,50));
    const afterTheatre={
      iframeCount:document.querySelectorAll('#player-instance-combat').length,
      battleFrames:Array.from(document.querySelectorAll('iframe')).filter(frame=>String(frame.getAttribute('src')||'').includes('Battle-viewer')).length,
      theatreDisplay:getComputedStyle(document.getElementById('theatre-view-player')).display,
      theatreAria:document.getElementById('theatre-view-player')?.getAttribute('aria-hidden'),
      theatreClass:document.body.classList.contains('player-instance-theatre'),
      combatClass:document.body.classList.contains('player-instance-combat')
    };
    return {duringCombat,afterTheatre};
  });

  expect(result.duringCombat.iframeCount).toBe(1);
  expect(result.duringCombat.battleSrc).toBe('Battle-viewer.html');
  expect(result.afterTheatre).toEqual({
    iframeCount:0,
    battleFrames:0,
    theatreDisplay:'flex',
    theatreAria:'false',
    theatreClass:true,
    combatClass:false
  });
});
