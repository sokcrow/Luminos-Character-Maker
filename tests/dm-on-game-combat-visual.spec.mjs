import fs from 'node:fs';
import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

const BASE=process.env.DM_VISUAL_BASE_URL||'http://127.0.0.1:4173';
const DM_UID='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';

const FIREBASE_STUB=`
(()=>{
  const DM_UID='${DM_UID}';
  const apps=[];
  const listeners=new Map();
  const sprite=(label,body,accent)=>{
    const markup='<svg xmlns="http://www.w3.org/2000/svg" width="220" height="280" viewBox="0 0 220 280"><rect width="220" height="280" rx="26" fill="'+body+'"/><circle cx="110" cy="78" r="42" fill="'+accent+'"/><path d="M48 238c7-65 35-99 62-99s55 34 62 99" fill="'+accent+'"/><text x="110" y="266" text-anchor="middle" font-size="18" font-family="sans-serif" fill="white">'+label+'</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup);
  };
  const COMBATANTS={
    'visual-ally':{id:'visual-ally',name:'DM ALLY',actorCategory:'player',isPlayer:true,faction:'ally',battleActive:true,hp:100,maxHp:100,sp:0,actionSlots:1,combatSprite:sprite('ALLY','#23354a','#77b7ff'),x:18,y:28,scale:0.9,statusEffects:{}},
    'visual-enemy-a':{id:'visual-enemy-a',name:'ENEMY A',actorCategory:'enemy',faction:'enemy',battleActive:true,hp:90,maxHp:90,sp:0,actionSlots:1,combatSprite:sprite('ENEMY A','#4a2424','#ff8b77'),x:72,y:22,scale:0.9,statusEffects:{}},
    'visual-enemy-b':{id:'visual-enemy-b',name:'ENEMY B',actorCategory:'enemy',faction:'enemy',battleActive:true,hp:85,maxHp:85,sp:0,actionSlots:1,combatSprite:sprite('ENEMY B','#3e2949','#d58cff'),x:80,y:48,scale:0.9,statusEffects:{}}
  };
  const UNITS={
    'visual-enemy-a':{id:'visual-enemy-a',name:'ENEMY A',faction:'enemy',combatSprite:COMBATANTS['visual-enemy-a'].combatSprite,skillIds:['a','b','c']},
    'visual-enemy-b':{id:'visual-enemy-b',name:'ENEMY B',faction:'enemy',combatSprite:COMBATANTS['visual-enemy-b'].combatSprite,skillIds:['a','b','c']}
  };
  const cleanPath=path=>String(path??'').split('/').filter(Boolean).join('/');
  const valueFor=(path='')=>{
    const clean=cleanPath(path);
    if(clean==='.info/connected')return true;
    if(clean==='campaña/config/dm_uid')return DM_UID;
    if(clean==='campaña/estado_mundo/instancia_activa')return 'combate';
    if(clean==='campaña/combate/combatants')return COMBATANTS;
    if(clean==='campaña/combate/estado')return {phase:'PRE_COMBAT_PLANNING',round:1};
    if(clean==='campaña/jugadores')return {};
    if(clean==='campaña/actores')return {};
    if(clean==='campaña/base_datos_unidades')return UNITS;
    if(clean==='campaña/base_datos_skills')return {};
    return null;
  };
  const snapshot=(path='')=>({
    key:cleanPath(path).split('/').filter(Boolean).pop()||null,
    val(){return valueFor(path)},
    exists(){return valueFor(path)!=null},
    forEach(callback){
      const value=valueFor(path);
      if(!value||typeof value!=='object'||Array.isArray(value))return false;
      Object.entries(value).forEach(([key,row])=>callback({key,val:()=>row,exists:()=>true}));
      return false;
    }
  });
  const makeRef=(path='')=>{
    const ref={
      key:cleanPath(path).split('/').filter(Boolean).pop()||'visual-ci-key',
      path:cleanPath(path),
      child(next){return makeRef([path,next].filter(Boolean).join('/'))},
      once(event,callback){const snap=snapshot(path);if(typeof callback==='function')queueMicrotask(()=>callback(snap));return Promise.resolve(snap)},
      on(event,callback){if(typeof callback==='function')queueMicrotask(()=>callback(snapshot(path)));listeners.set(cleanPath(path)+':'+event,callback);return callback},
      off(){},
      set(){return Promise.resolve()},
      update(){return Promise.resolve()},
      remove(){return Promise.resolve()},
      transaction(updateFn,complete){const snap=snapshot(path);const next=updateFn?.(snap.val());queueMicrotask(()=>complete?.(null,next!==undefined,{val:()=>next,exists:()=>next!=null}));return Promise.resolve({committed:next!==undefined,snapshot:{val:()=>next}})},
      push(value){const child=makeRef([path,'visual-ci-key'].filter(Boolean).join('/'));if(value===undefined)return child;return Promise.resolve(child)}
    };
    ['orderByChild','orderByKey','orderByPriority','orderByValue','startAt','startAfter','endAt','endBefore','equalTo','limitToFirst','limitToLast'].forEach(method=>{ref[method]=()=>ref});
    return ref;
  };
  const db={ref(path=''){return makeRef(path)}};
  const auth={
    currentUser:{uid:DM_UID,email:'dm-dashboard-ci@local.invalid'},
    onAuthStateChanged(callback){queueMicrotask(()=>callback(this.currentUser));return()=>{}},
    signOut(){this.currentUser=null;return Promise.resolve()}
  };
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

async function installFirebase(page){
  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/8\.10\.1\/firebase-(app|auth|database)\.js/,async route=>{
    const url=route.request().url();
    await route.fulfill({
      status:200,
      contentType:'application/javascript; charset=utf-8',
      body:url.includes('firebase-app.js')?FIREBASE_STUB:'/* provided by DM dashboard visual CI */'
    });
  });
}

test.use({viewport:{width:816,height:1536},colorScheme:'dark'});

test.afterEach(async({page},testInfo)=>{
  fs.mkdirSync('artifacts/dm-on-game-combat',{recursive:true});
  await page.screenshot({
    path:`artifacts/dm-on-game-combat/dashboard-${testInfo.status==='passed'?'passed':'failed'}.png`,
    fullPage:true,
    animations:'disabled'
  }).catch(()=>{});
});

test('ON GAME DM tactical Combat paints the actual battlefield on mobile portrait',async({page})=>{
  const errors=[];
  page.on('pageerror',error=>errors.push(`pageerror: ${error?.stack||error}`));
  page.on('console',message=>{if(message.type()==='error')errors.push(`console.error: ${message.text()}`)});
  await installFirebase(page);
  await page.goto(`${BASE}/hoja_de_DM.html`,{waitUntil:'domcontentloaded'});

  await expect(page.locator('input[name="instancia"][value="combate"]')).toBeChecked({timeout:10000});
  await expect(page.locator('#modulo-combate')).toHaveClass(/active-module/,{timeout:10000});
  await expect(page.locator('#dm-combat-view')).toHaveAttribute('src',/Battle-viewer\.html/,{timeout:10000});

  let frame=null;
  await expect.poll(()=>{
    frame=page.frames().find(candidate=>candidate.url().includes('Battle-viewer.html'))||null;
    return Boolean(frame);
  },{timeout:10000}).toBe(true);

  await frame.waitForFunction(()=>Boolean(
    window.LuminousCombat073 &&
    window.LuminousCombatLiveAdapter073 &&
    document.getElementById('game-container') &&
    document.getElementById('battlefield')
  ),null,{timeout:30000});

  await frame.waitForFunction(()=>{
    const adapter=window.LuminousCombatLiveAdapter073?.state;
    const units=window.LuminousCombat073?.combatants?.()||{};
    return adapter?.role==='dm'&&Object.keys(units).length===3;
  },null,{timeout:15000});

  const runtimeFunctions=await frame.evaluate(()=>({
    spriteCenter:typeof window.spriteCenter==='function'?String(window.spriteCenter):'missing',
    layoutRadialCommands:typeof window.layoutRadialCommands==='function'?String(window.layoutRadialCommands):'missing'
  }));
  console.log('DM_ON_GAME_RUNTIME_FUNCTIONS',JSON.stringify(runtimeFunctions));

  await frame.evaluate(()=>{
    window.LuminousCombatDmObserver073?.enforceDmView?.();
    window.LuminousCombatDmObserver073?.ensureVisualSurface?.();
    window.LuminousCombat073?.camera?.('full',false);
    window.LuminousWebGL2Renderer?.requestRender?.(600);
  });

  await page.waitForTimeout(800);

  const diagnostics=await frame.evaluate(()=>{
    const game=document.getElementById('game-container');
    const field=document.getElementById('battlefield');
    const rect=node=>{const r=node?.getBoundingClientRect?.()||{};return{x:r.x||0,y:r.y||0,width:r.width||0,height:r.height||0}};
    const fixed=Array.from(document.querySelectorAll('body *')).map(node=>{
      const style=getComputedStyle(node);
      if(style.position!=='fixed')return null;
      const r=node.getBoundingClientRect();
      if(r.width<100||r.height<100)return null;
      return {id:node.id||'',className:String(node.className||''),zIndex:style.zIndex,opacity:style.opacity,visibility:style.visibility,display:style.display,rect:{x:r.x,y:r.y,width:r.width,height:r.height}};
    }).filter(Boolean);
    const sprites=Array.from(document.querySelectorAll('.sprite-img')).map(img=>{
      const r=img.getBoundingClientRect();
      const x=Math.max(0,Math.min(innerWidth-1,r.left+r.width/2));
      const y=Math.max(0,Math.min(innerHeight-1,r.top+r.height/2));
      const hit=document.elementFromPoint(x,y);
      return {id:img.id||'',complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,rect:rect(img),hit:hit?{id:hit.id||'',className:String(hit.className||''),tag:hit.tagName}:null};
    });
    return {
      viewport:{width:innerWidth,height:innerHeight},
      role:game?.dataset?.viewerRole||'',
      visualMode:game?.dataset?.dmVisualMode||game?.dataset?.dmVisualFallback||'',
      gameClass:game?.className||'',
      field:rect(field),
      game:rect(game),
      setup:Boolean(document.getElementById('c073-dm-setup')),
      transition:{className:document.getElementById('turn-transition')?.className||'',style:document.getElementById('turn-transition')?.getAttribute('style')||''},
      sprites,
      fixed
    };
  });
  console.log('DM_ON_GAME_DIAGNOSTICS',JSON.stringify(diagnostics));
  console.log('DM_ON_GAME_BROWSER_ERRORS',JSON.stringify(errors));

  expect(diagnostics.role).toBe('dm');
  expect(diagnostics.setup).toBe(true);
  expect(diagnostics.field.width).toBeGreaterThan(300);
  expect(diagnostics.field.height).toBeGreaterThan(300);
  expect(diagnostics.sprites.length).toBeGreaterThanOrEqual(3);

  fs.mkdirSync('artifacts/dm-on-game-combat',{recursive:true});
  const fieldPng=await frame.locator('#battlefield').screenshot({
    path:'artifacts/dm-on-game-combat/field.png',
    animations:'disabled'
  });
  const decoded=PNG.sync.read(fieldPng);
  const accents=[[0x77,0xb7,0xff],[0xff,0x8b,0x77],[0xd5,0x8c,0xff]];
  let accentPixels=0;
  let nonBlackPixels=0;
  for(let i=0;i<decoded.data.length;i+=4){
    const r=decoded.data[i],g=decoded.data[i+1],b=decoded.data[i+2],a=decoded.data[i+3];
    if(a<160)continue;
    if(r>18||g>18||b>18)nonBlackPixels+=1;
    if(accents.some(([er,eg,eb])=>Math.abs(r-er)<=18&&Math.abs(g-eg)<=18&&Math.abs(b-eb)<=18))accentPixels+=1;
  }
  console.log('DM_ON_GAME_RASTER',JSON.stringify({width:decoded.width,height:decoded.height,accentPixels,nonBlackPixels}));
  expect(accentPixels,'ON GAME DM screenshot must contain actual painted combatant pixels').toBeGreaterThan(250);
  expect(nonBlackPixels,'ON GAME DM battlefield must not be an all-black surface').toBeGreaterThan(5000);

  await page.locator('#dm-combat-view').screenshot({
    path:'artifacts/dm-on-game-combat/combat-iframe.png',
    animations:'disabled'
  });
});
