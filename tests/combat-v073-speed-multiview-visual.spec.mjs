import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const BASE = process.env.DM_VISUAL_BASE_URL || 'http://127.0.0.1:4173';
const DM_UID = 'speed-ci-dm';
const PLAYER_UID = 'speed-ci-player';

function firebaseStub(uid) {
  return `
(()=>{
  const CURRENT_UID=${JSON.stringify(uid)};
  const DM_UID=${JSON.stringify(DM_UID)};
  const apps=[];
  const listeners=new Map();
  const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
  const clean=path=>String(path??'').split('/').filter(Boolean).join('/');
  const sprite=(tone)=>{
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="140" height="210"><rect width="140" height="210" fill="'+tone+'"/><circle cx="70" cy="52" r="28" fill="#d7a270"/></svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  };
  const skill={id:'speed_ci_skill',skillId:'speed_ci_skill',kind:'skill',name:'Speed CI Skill',actionCost:'action',economyCost:'action',basePower:4,coinPower:2,coinAmount:1};
  const players={
    p1:{uid:${JSON.stringify(PLAYER_UID)},vinculado_a:${JSON.stringify(PLAYER_UID)},characterName:'SPEED PLAYER'},
    p2:{uid:'speed-ci-remote',vinculado_a:'speed-ci-remote',characterName:'REMOTE PLAYER'}
  };
  let combatants={
    'player:p1':{
      id:'player:p1',combatId:'player:p1',name:'SPEED PLAYER',characterName:'SPEED PLAYER',
      faction:'ally',actorCategory:'player',category:'player',canonicalScope:'player',isPlayer:true,
      playerId:'p1',ownerPlayerId:'p1',canonicalPlayerKey:'p1',ownerUid:${JSON.stringify(PLAYER_UID)},canonicalOwnerUid:${JSON.stringify(PLAYER_UID)},
      battleActive:true,positionPinned:true,x:16,y:24,hp:80,maxHp:100,sp:0,actionSlots:1,activeSlots:1,
      skillIds:['speed_ci_skill'],skillSlotIds:['speed_ci_skill'],equippedSkillIndex:{speed_ci_skill:true},
      speedRange:[1,6],speed:2,speedBaseRoll:2,speedRollTurn:7,speedTie:0.11,speedRolledAt:1001,
      combatSprite:sprite('#3d2931')
    },
    'player:p2':{
      id:'player:p2',combatId:'player:p2',name:'REMOTE PLAYER',characterName:'REMOTE PLAYER',
      faction:'ally',actorCategory:'player',category:'player',canonicalScope:'player',isPlayer:true,
      playerId:'p2',ownerPlayerId:'p2',canonicalPlayerKey:'p2',ownerUid:'speed-ci-remote',canonicalOwnerUid:'speed-ci-remote',
      battleActive:true,positionPinned:true,x:29,y:42,hp:74,maxHp:90,sp:0,actionSlots:1,activeSlots:1,
      skillIds:['speed_ci_skill'],speedRange:[1,6],speed:5,speedBaseRoll:5,speedRollTurn:7,speedTie:0.22,speedRolledAt:1002,
      combatSprite:sprite('#273646')
    },
    'enemy:wolf1':{
      id:'enemy:wolf1',combatId:'enemy:wolf1',name:'WOLF A',faction:'enemy',actorCategory:'enemy',category:'enemy',
      battleActive:true,positionPinned:true,x:72,y:22,hp:60,maxHp:60,sp:0,actionSlots:1,activeSlots:1,
      skillIds:['speed_ci_skill'],speedRange:[1,6],speed:3,speedBaseRoll:3,speedRollTurn:7,speedTie:0.33,speedRolledAt:1003,
      combatSprite:sprite('#47282a')
    },
    'enemy:wolf2':{
      id:'enemy:wolf2',combatId:'enemy:wolf2',name:'WOLF B',faction:'enemy',actorCategory:'enemy',category:'enemy',
      battleActive:true,positionPinned:true,x:84,y:44,hp:60,maxHp:60,sp:0,actionSlots:1,activeSlots:1,
      skillIds:['speed_ci_skill'],speedRange:[1,6],speed:6,speedBaseRoll:6,speedRollTurn:7,speedTie:0.44,speedRolledAt:1004,
      combatSprite:sprite('#402b25')
    }
  };
  let combatState={phase:'PRE_COMBAT_PLANNING',round:7};
  window.__speedTransactions={attempts:0,committed:0};

  const valueFor=path=>{
    const key=clean(path);
    if(key==='campaña/config/dm_uid')return DM_UID;
    if(key==='campaña/jugadores')return players;
    if(key==='campaña/jugadores/p1')return players.p1;
    if(key==='campaña/jugadores/p2')return players.p2;
    if(key==='campaña/combate/combatants')return combatants;
    if(key.startsWith('campaña/combate/combatants/'))return combatants[key.split('/').slice(3).join('/')];
    if(key==='campaña/combate/estado')return combatState;
    if(key==='campaña/base_datos_skills')return {speed_ci_skill:skill};
    if(key==='campaña/base_datos_skills/speed_ci_skill')return skill;
    if(key==='campaña/combate/libraryManifest/skills')return {};
    if(key==='campaña/combate/libraryManifest/skills/speed_ci_skill')return null;
    if(key==='campaña/combate/libraryManifest/units')return {};
    if(key==='campaña/combate/plannedActions')return {};
    if(key==='campaña/combate/readyPlayers')return {};
    if(key==='campaña/combate/authority/current')return {};
    return null;
  };
  const snapshot=path=>({
    key:clean(path).split('/').pop()||null,
    val(){return clone(valueFor(path))},
    exists(){return valueFor(path)!=null},
    forEach(callback){
      const value=valueFor(path);
      if(!value||typeof value!=='object'||Array.isArray(value))return false;
      Object.entries(value).forEach(([key,row])=>callback({key,val:()=>clone(row),exists:()=>true}));
      return false;
    }
  });
  const emit=path=>{
    for(const [key,callback] of listeners){
      if(key===clean(path)+':value')queueMicrotask(()=>callback(snapshot(path)));
    }
  };
  const makeRef=(path='')=>({
    key:clean(path).split('/').pop()||null,
    path:clean(path),
    child(next){return makeRef([path,next].filter(Boolean).join('/'))},
    once(){return Promise.resolve(snapshot(path))},
    on(event,callback){
      listeners.set(clean(path)+':'+event,callback);
      // Intentionally deliver combatants before estado. This reproduces the old
      // startup race where DM Speed could be rolled against the default round 1.
      const delay=clean(path)==='campaña/combate/estado'?180:0;
      setTimeout(()=>callback(snapshot(path)),delay);
      return callback;
    },
    off(event){listeners.delete(clean(path)+':'+event)},
    set(value){
      const key=clean(path);
      if(key==='campaña/combate/estado')combatState=clone(value);
      return Promise.resolve();
    },
    update(){return Promise.resolve()},
    remove(){return Promise.resolve()},
    push(){return makeRef([path,'ci'].filter(Boolean).join('/'))},
    transaction(updateFn){
      window.__speedTransactions.attempts++;
      const key=clean(path);
      const current=clone(valueFor(path));
      const next=updateFn(current);
      if(next===undefined)return Promise.resolve({committed:false,snapshot:snapshot(path)});
      if(key==='campaña/combate/combatants'){
        combatants=clone(next);
        window.__speedTransactions.committed++;
        emit(path);
      }
      return Promise.resolve({committed:true,snapshot:snapshot(path)});
    }
  });
  const auth={
    currentUser:{uid:CURRENT_UID,email:CURRENT_UID+'@local.invalid'},
    onAuthStateChanged(callback){queueMicrotask(()=>callback(this.currentUser));return()=>{}},
    signOut(){return Promise.resolve()}
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
}

async function installFirebase(page, uid) {
  const stub=firebaseStub(uid);
  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/8\.10\.1\/firebase-(app|auth|database)\.js/, async route => {
    await route.fulfill({
      status:200,
      contentType:'application/javascript; charset=utf-8',
      body:route.request().url().includes('firebase-app.js')?stub:'/* firebase supplied by speed CI */'
    });
  });
}

async function waitReady(page, role) {
  await page.waitForFunction(expectedRole => {
    const adapter=window.LuminousCombatLiveAdapter073;
    const speed=window.LuminousCombatSpeedAuthority073;
    const rows=window.LuminousCombat073?.combatants?.()||{};
    return adapter?.state?.role===expectedRole
      && adapter?.state?.round===7
      && speed?.state?.roundReady===true
      && Object.keys(rows).length===4
      && Object.values(rows).every(row=>Number(row.speedRollTurn)===7);
  }, role, {timeout:30000});
  await page.waitForTimeout(300);
}

async function snapshot(page) {
  return await page.evaluate(() => {
    const rows=window.LuminousCombat073?.combatants?.()||{};
    const units={};
    for(const [id,row] of Object.entries(rows)){
      const node=document.getElementById('sprite-'+id);
      const rect=node?.getBoundingClientRect?.();
      units[id]={
        speed:Number(row.speed),
        speedBaseRoll:Number(row.speedBaseRoll),
        speedRollTurn:Number(row.speedRollTurn),
        speedTie:Number(row.speedTie),
        x:Number(row.x),
        y:Number(row.y),
        rect:rect?{x:Math.round(rect.x*100)/100,y:Math.round(rect.y*100)/100}:null
      };
    }
    return {
      units,
      transactions:{...(window.__speedTransactions||{})},
      round:window.LuminousCombatLiveAdapter073?.state?.round,
      role:window.LuminousCombatLiveAdapter073?.state?.role
    };
  });
}

async function stressViewer(page) {
  await page.evaluate(async () => {
    for(let i=0;i<6;i++){
      window.LuminousCombatLiveAdapter073?.hydrateNow?.();
      window.rollTurnSpeeds?.(7);
      const rows=window.LuminousCombat073?.combatants?.()||{};
      for(const unit of Object.values(rows))window.rollUnitSpeed?.(unit);
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
      await new Promise(resolve=>setTimeout(resolve,30));
    }
  });
  await page.waitForTimeout(350);
}

function canonicalView(snap) {
  return Object.fromEntries(Object.entries(snap.units).map(([id,row])=>[id,{
    speed:row.speed,
    speedBaseRoll:row.speedBaseRoll,
    speedRollTurn:row.speedRollTurn,
    speedTie:row.speedTie,
    x:row.x,
    y:row.y
  }]));
}

test.use({viewport:{width:673,height:258},colorScheme:'dark'});

test('DM and Player keep one canonical Speed across tab changes, hydrations and legacy roll calls', async ({browser}) => {
  const context=await browser.newContext({viewport:{width:673,height:258},colorScheme:'dark'});
  const player=await context.newPage();
  const dm=await context.newPage();
  const errors=[];
  player.on('pageerror',error=>errors.push('PLAYER '+String(error?.stack||error)));
  dm.on('pageerror',error=>errors.push('DM '+String(error?.stack||error)));

  await installFirebase(player,PLAYER_UID);
  await installFirebase(dm,DM_UID);
  await Promise.all([
    player.goto(`${BASE}/Battle-viewer.html`,{waitUntil:'domcontentloaded'}),
    dm.goto(`${BASE}/Battle-viewer.html`,{waitUntil:'domcontentloaded'})
  ]);
  await Promise.all([waitReady(player,'player'),waitReady(dm,'dm')]);

  const playerBefore=await snapshot(player);
  const dmBefore=await snapshot(dm);
  expect(canonicalView(playerBefore)).toEqual(canonicalView(dmBefore));
  expect(playerBefore.transactions.committed).toBe(0);
  expect(dmBefore.transactions.committed).toBe(0);

  for(let i=0;i<5;i++){
    await player.bringToFront();
    await stressViewer(player);
    await dm.bringToFront();
    await stressViewer(dm);
  }

  const playerAfter=await snapshot(player);
  const dmAfter=await snapshot(dm);
  expect(canonicalView(playerAfter)).toEqual(canonicalView(playerBefore));
  expect(canonicalView(dmAfter)).toEqual(canonicalView(dmBefore));
  expect(canonicalView(playerAfter)).toEqual(canonicalView(dmAfter));
  expect(dmAfter.transactions.committed).toBe(0);
  expect(playerAfter.transactions.committed).toBe(0);

  // The battlefield itself must also stay put. Compare each viewer to its own baseline
  // because DM and Player use different camera framing.
  for(const id of Object.keys(playerBefore.units)){
    expect(playerAfter.units[id].rect).toEqual(playerBefore.units[id].rect);
    expect(dmAfter.units[id].rect).toEqual(dmBefore.units[id].rect);
  }

  fs.mkdirSync('artifacts/speed-authority-visual',{recursive:true});
  await player.bringToFront();
  await player.screenshot({path:'artifacts/speed-authority-visual/player-speed-stable.png',animations:'disabled'});
  await dm.bringToFront();
  await dm.screenshot({path:'artifacts/speed-authority-visual/dm-speed-stable.png',animations:'disabled'});

  expect(errors,errors.join('\n')).toEqual([]);
  await context.close();
});
