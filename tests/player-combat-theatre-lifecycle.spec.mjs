import { test, expect } from '@playwright/test';

const BASE=process.env.LIFECYCLE_BASE_URL||'http://127.0.0.1:4173';

async function bootHarness(page){
  await page.goto(BASE+'/index.html',{waitUntil:'domcontentloaded'});
  await page.setContent(`
    <!doctype html><html><body>
      <div class="sheet-phone-wrapper"></div>
      <div id="theatre-view-player" style="display:none"></div>
      <div id="player-instance-blackout"></div>
      <script src="/js/instance-control.js"></script>
    </body></html>
  `);
  await page.waitForFunction(()=>Boolean(window.LuminousInstanceControl));
}

test('Player Combat is fully destroyed outside Combat and does not accumulate hidden Battle viewers',async({page})=>{
  await bootHarness(page);

  await page.evaluate(()=>window.LuminousInstanceControl.applyPlayerInstance('teatro'));
  await expect(page.locator('#theatre-view-player')).toBeVisible();
  await expect(page.locator('#player-instance-combat')).toHaveCount(0);
  expect(page.frames().filter(frame=>frame.url().includes('Battle-viewer.html')).length).toBe(0);

  for(let cycle=0;cycle<6;cycle+=1){
    await page.evaluate(()=>window.LuminousInstanceControl.applyPlayerInstance('combate'));
    await expect(page.locator('#player-instance-combat')).toHaveCount(1);
    await expect(page.locator('#player-instance-combat')).toHaveAttribute('src','Battle-viewer.html');

    await expect.poll(()=>page.frames().filter(frame=>frame.url().includes('Battle-viewer.html')).length,{timeout:10000}).toBe(1);

    await page.evaluate(()=>window.LuminousInstanceControl.applyPlayerInstance('teatro'));
    await expect(page.locator('#player-instance-combat')).toHaveCount(0);
    await expect(page.locator('#theatre-view-player')).toBeVisible();
    await expect.poll(()=>page.frames().filter(frame=>frame.url().includes('Battle-viewer.html')).length,{timeout:10000}).toBe(0);
  }

  const bodyState=await page.evaluate(()=>({
    theatre:document.body.classList.contains('player-instance-theatre'),
    combat:document.body.classList.contains('player-instance-combat'),
    battleFrames:Array.from(document.querySelectorAll('iframe')).filter(frame=>String(frame.src).includes('Battle-viewer')).length
  }));
  expect(bodyState).toEqual({theatre:true,combat:false,battleFrames:0});
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
