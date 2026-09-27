import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const BASE=process.env.DM_VISUAL_BASE_URL||'http://127.0.0.1:4173';
const DM_UID='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';

const FIREBASE_APP_STUB=`
(()=>{
  const DM_UID='${DM_UID}';
  const apps=[];
  const listeners=new Map();
  const sprite=(label,body,accent)=>{
    const markup='<svg xmlns="http://www.w3.org/2000/svg" width="220" height="280" viewBox="0 0 220 280"><rect width="220" height="280" rx="26" fill="'+body+'"/><circle cx="110" cy="78" r="42" fill="'+accent+'"/><path d="M48 238c7-65 35-99 62-99s55 34 62 99" fill="'+accent+'"/><text x="110" y="266" text-anchor="middle" font-size="18" font-family="sans-serif" fill="white">'+label+'</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup);
  };
  const VISUAL_COMBATANTS={
    'visual-ally':{id:'visual-ally',name:'DM ALLY',actorCategory:'player',isPlayer:true,faction:'ally',battleActive:true,hp:100,maxHp:100,sp:0,actionSlots:1,combatSprite:sprite('ALLY','#23354a','#77b7ff'),x:18,y:28,scale:0.9,statusEffects:{}},
    'visual-enemy-a':{id:'visual-enemy-a',name:'ENEMY A',actorCategory:'enemy',faction:'enemy',battleActive:true,hp:90,maxHp:90,sp:0,actionSlots:1,combatSprite:sprite('ENEMY A','#4a2424','#ff8b77'),x:72,y:22,scale:0.9,statusEffects:{}},
    'visual-enemy-b':{id:'visual-enemy-b',name:'ENEMY B',actorCategory:'enemy',faction:'enemy',battleActive:true,hp:85,maxHp:85,sp:0,actionSlots:1,combatSprite:sprite('ENEMY B','#3e2949','#d58cff'),x:80,y:48,scale:0.9,statusEffects:{}}
  };
  const valueFor=(path='')=>{
    const clean=String(path).replace(/^\/+|\/+$/g,'');
    if(clean==='campaña/config/dm_uid')return DM_UID;
    if(clean==='campaña/combate/combatants')return VISUAL_COMBATANTS;
    if(clean==='campaña/combate/estado')return {phase:'PRE_COMBAT_PLANNING',round:1};
    if(clean==='campaña/jugadores')return {};
    return null;
  };
  const snapshot=(path='')=>({
    key:String(path).split('/').filter(Boolean).pop()||null,
    val(){return valueFor(path)},
    exists(){return valueFor(path)!=null},
    forEach(callback){
      const value=valueFor(path);
      if(!value||typeof value!=='object')return false;
      Object.entries(value).forEach(([key,row])=>callback({key,val:()=>row,exists:()=>true}));
      return false;
    }
  });
  const makeRef=(path='')=>({
    key:String(path).split('/').filter(Boolean).pop()||null,
    path,
    child(next){return makeRef([path,next].filter(Boolean).join('/'))},
    once(){return Promise.resolve(snapshot(path))},
    on(event,callback){queueMicrotask(()=>callback(snapshot(path)));listeners.set(path+':'+event,callback);return callback},
    off(){},
    set(){return Promise.resolve()},
    update(){return Promise.resolve()},
    remove(){return Promise.resolve()},
    push(value){const ref=makeRef([path,'visual-ci-key'].filter(Boolean).join('/'));return value===undefined?ref:Object.assign(Promise.resolve(ref),ref)}
  });
  const auth={
    currentUser:{uid:DM_UID,email:'dm-visual-ci@local.invalid'},
    onAuthStateChanged(callback){queueMicrotask(()=>callback(this.currentUser));return()=>{}},
    signOut(){this.currentUser=null;return Promise.resolve()}
  };
  const db={ref(path=''){return makeRef(path)}};
  function authFn(){return auth}
  function databaseFn(){return db}
  databaseFn.ServerValue={TIMESTAMP:Date.now()};
  window.firebase={
    apps,
    initializeApp(config){if(!apps.length)apps.push({name:'[DEFAULT]',options:config||{}});return apps[0]},
    auth:authFn,
    database:databaseFn
  };
})();
`;

async function installFirebaseDmStub(page){
  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/8\.10\.1\/firebase-(app|auth|database)\.js/,async route=>{
    const url=route.request().url();
    const body=url.includes('firebase-app.js')?FIREBASE_APP_STUB:'/* Firebase module provided by DM visual CI stub. */';
    await route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body});
  });
}


test.use({ viewport:{width:1440,height:1100}, colorScheme:'dark' });

test.afterEach(async({page},testInfo)=>{
  fs.mkdirSync('artifacts/dm-combat-visual',{recursive:true});
  const safe=testInfo.status==='passed'?'passed':'failed';
  await page.screenshot({path:`artifacts/dm-combat-visual/dm-combat-${safe}-fullpage.png`,fullPage:true,animations:'disabled'}).catch(()=>{});
});

test('DM real Combat tab renders a visible FIELD with all deployed sprites', async({page})=>{
  const browserErrors=[];
  page.on('pageerror',error=>browserErrors.push(`pageerror: ${error?.stack||error?.message||error}`));
  page.on('console',message=>{
    if(message.type()==='error')browserErrors.push(`console.error: ${message.text()}`);
  });
  await installFirebaseDmStub(page);
  await page.goto(`${BASE}/pantalla_dm.html`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="tab-combate"]').click();
  await page.evaluate(()=>window.hideLoadingOverlay?.());

  try{
    await expect(page.locator('#dm-combat-live-frame')).toHaveAttribute('src',/Battle-viewer\.html/,{timeout:10000});
  }catch(error){
    const tabState=await page.evaluate(()=>{
      const button=document.querySelector('[data-tab="tab-combate"]');
      const pane=document.getElementById('tab-combate');
      const frame=document.getElementById('dm-combat-live-frame');
      const rect=pane?.getBoundingClientRect?.()||{};
      const style=pane?getComputedStyle(pane):null;
      return {
        buttonActive:button?.classList?.contains('active')||false,
        paneActive:pane?.classList?.contains('active')||false,
        paneDisplay:style?.display||'',
        paneVisibility:style?.visibility||'',
        paneWidth:rect.width||0,
        paneHeight:rect.height||0,
        frameSrc:frame?.getAttribute?.('src')||null,
        liveViewer:Boolean(window.LuminousDmCombatLiveViewer),
        liveViewerVisible:window.LuminousDmCombatLiveViewer?.isVisible?.()??null
      };
    });
    console.error('DM_VISUAL_TAB_STATE',JSON.stringify(tabState));
    console.error('DM_VISUAL_BROWSER_ERRORS',JSON.stringify(browserErrors));
    throw error;
  }

  let frame=null;
  await expect.poll(()=>{
    frame=page.frames().find(candidate=>candidate.url().includes('Battle-viewer.html'))||null;
    return Boolean(frame);
  },{timeout:10000,message:'canonical Battle-viewer iframe must be loaded by the real DM tab'}).toBe(true);

  await frame.waitForFunction(()=>{
    return Boolean(window.LuminousCombat073&&document.getElementById('game-container')&&document.getElementById('battlefield'));
  },null,{timeout:30000});

  const bootstrap=await frame.evaluate(()=>window.LuminousCombatBootstrapState?{...window.LuminousCombatBootstrapState}:null);
  expect(bootstrap?.error||null,'real Battle bootstrap must not fail before the visual probe').toBeNull();

  await frame.waitForFunction(()=>{
    const adapter=window.LuminousCombatLiveAdapter073?.state;
    const runtime=window.LuminousCombat073;
    const game=document.getElementById('game-container');
    const combatants=runtime?.combatants?.()||{};
    return adapter?.role==='dm'&&game?.dataset?.viewerRole==='dm'&&Object.keys(combatants).length===3;
  },null,{timeout:15000});

  await frame.evaluate(()=>{
    window.LuminousCombat073?.camera?.('full',false);
    window.LuminousCombatDmObserver073?.enforceDmView?.();
    window.LuminousCombatDmObserver073?.ensureVisualSurface?.();
    window.LuminousWebGL2Renderer?.requestRender?.(500);
  });

  await frame.waitForFunction(()=>{
    const game=document.getElementById('game-container');
    const sprites=Array.from(game?.querySelectorAll?.('.sprite-img')||[]);
    const visible=sprites.filter(node=>{
      const rect=node.getBoundingClientRect();
      const style=getComputedStyle(node);
      return rect.width>2&&rect.height>2&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)!==0;
    });
    return game?.dataset?.viewerRole==='dm'&&sprites.length>=3&&visible.length>=3;
  },null,{timeout:10000});

  await page.evaluate(()=>{
    window.LuminousDmCombatLiveViewer?.nudgeBattle?.({allowFallback:true});
  });

  const proof=await frame.evaluate(()=>{
    const game=document.getElementById('game-container');
    const field=document.getElementById('battlefield');
    const sprites=Array.from(game?.querySelectorAll?.('.sprite-img')||[]);
    const visible=sprites.filter(node=>{
      const rect=node.getBoundingClientRect();
      const style=getComputedStyle(node);
      return rect.width>2&&rect.height>2&&style.display!=='none'&&style.visibility!=='hidden'&&Number(style.opacity||1)!==0;
    });
    return {
      role:game?.dataset?.viewerRole||'',
      visualMode:game?.dataset?.dmVisualMode||'',
      backgroundOwnedByWebgl:game?.classList?.contains?.('webgl2-background-ready')||false,
      field:{width:field?.getBoundingClientRect?.().width||0,height:field?.getBoundingClientRect?.().height||0},
      sprites:sprites.length,
      visibleSprites:visible.length
    };
  });

  expect(proof.role).toBe('dm');
  expect(proof.visualMode).toBe('dom-base-webgl-vfx');
  expect(proof.backgroundOwnedByWebgl).toBe(false);
  expect(proof.field.width).toBeGreaterThan(100);
  expect(proof.field.height).toBeGreaterThan(100);
  expect(proof.visibleSprites).toBeGreaterThanOrEqual(3);
  expect(proof.visibleSprites).toBe(proof.sprites);

  await expect(page.locator('#dm-combat-live-status')).toContainText('BATTLE VISIBLE',{timeout:10000});

  fs.mkdirSync('artifacts/dm-combat-visual',{recursive:true});
  await page.locator('#dm-combat-live-battle').screenshot({
    path:'artifacts/dm-combat-visual/dm-combat-battle.png',
    animations:'disabled'
  });
  await page.screenshot({
    path:'artifacts/dm-combat-visual/dm-combat-panel.png',
    fullPage:true,
    animations:'disabled'
  });
});
