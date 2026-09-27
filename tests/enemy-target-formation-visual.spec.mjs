import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const BASE=process.env.DM_VISUAL_BASE_URL||'http://127.0.0.1:4173';
const DM_UID='e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';

const FIREBASE_STUB=`
(()=>{
  const DM_UID='${DM_UID}';
  const apps=[];
  const listeners=new Map();
  const sprite=(label,body,accent)=>{
    const markup='<svg xmlns="http://www.w3.org/2000/svg" width="160" height="210" viewBox="0 0 160 210"><rect width="160" height="210" rx="22" fill="'+body+'"/><circle cx="80" cy="62" r="30" fill="'+accent+'"/><path d="M35 178c6-48 25-75 45-75s39 27 45 75" fill="'+accent+'"/><text x="80" y="200" text-anchor="middle" font-size="13" font-family="sans-serif" fill="white">'+label+'</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup);
  };
  const combatants={};
  const playerSlots=[1,5,2,1,3,1,2];
  for(let i=0;i<7;i+=1){
    const id='player:p'+(i+1);
    combatants[id]={
      id,combatId:id,name:'PLAYER '+(i+1),characterName:'PLAYER '+(i+1),
      faction:'ally',actorCategory:'player',category:'player',isPlayer:true,
      playerId:'p'+(i+1),canonicalPlayerKey:'p'+(i+1),battleActive:true,
      hp:100,maxHp:100,sp:0,actionSlots:playerSlots[i],activeSlots:playerSlots[i],
      combatSprite:sprite('P'+(i+1),'#20334a','#72b5ff')
    };
  }
  for(let i=0;i<3;i+=1){
    const id='enemy:unit:wolf:'+(i+1);
    combatants[id]={
      id,combatId:id,name:'WOLF '+(i+1),characterName:'WOLF '+(i+1),
      faction:'enemy',actorCategory:'enemy',category:'enemy',isPlayer:false,
      libraryUnitId:'wolf',rank:'normal',battleActive:true,
      hp:11,maxHp:11,sp:0,actionSlots:1,activeSlots:1,
      combatSprite:sprite('W'+(i+1),'#3b2d25','#d9aa6d')
    };
  }

  const clean=path=>String(path??'').split('/').filter(Boolean).join('/');
  const valueFor=path=>{
    const key=clean(path);
    if(key==='campaña/config/dm_uid')return DM_UID;
    if(key==='campaña/combate/combatants')return combatants;
    if(key==='campaña/combate/estado')return {phase:'PRE_COMBAT_PLANNING',round:1};
    if(key==='campaña/jugadores')return {};
    if(key==='campaña/base_datos_skills')return {};
    return null;
  };
  const snapshot=path=>({
    key:clean(path).split('/').pop()||null,
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
      key:clean(path).split('/').pop()||null,path:clean(path),
      child(next){return makeRef([path,next].filter(Boolean).join('/'))},
      once(){return Promise.resolve(snapshot(path))},
      on(event,callback){queueMicrotask(()=>callback(snapshot(path)));listeners.set(clean(path)+':'+event,callback);return callback},
      off(){},set(){return Promise.resolve()},update(){return Promise.resolve()},remove(){return Promise.resolve()},
      push(){return makeRef([path,'ci'].filter(Boolean).join('/'))}
    };
    return ref;
  };
  const auth={
    currentUser:{uid:DM_UID,email:'dm-target-ci@local.invalid'},
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
    auth:authFn,database:databaseFn
  };
})();
`;

async function installFirebase(page){
  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/8\.10\.1\/firebase-(app|auth|database)\.js/,async route=>{
    const url=route.request().url();
    await route.fulfill({status:200,contentType:'application/javascript; charset=utf-8',body:url.includes('firebase-app.js')?FIREBASE_STUB:'/* firebase supplied by enemy target visual CI */'});
  });
}

test.use({viewport:{width:1440,height:1100},colorScheme:'dark'});

test.afterEach(async({page},testInfo)=>{
  fs.mkdirSync('artifacts/enemy-target-formation',{recursive:true});
  await page.screenshot({path:`artifacts/enemy-target-formation/${testInfo.status==='passed'?'passed':'failed'}-panel.png`,fullPage:true,animations:'disabled'}).catch(()=>{});
});

test('7 Players + 3 normal Wolves keep independent targets and zigzag spawn',async({page})=>{
  await installFirebase(page);
  await page.goto(`${BASE}/pantalla_dm.html`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-tab="tab-combate"]').click();
  await page.evaluate(()=>window.hideLoadingOverlay?.());

  await expect(page.locator('#dm-combat-live-frame')).toHaveAttribute('src',/Battle-viewer\.html/,{timeout:10000});
  let frame=null;
  await expect.poll(()=>{
    frame=page.frames().find(candidate=>candidate.url().includes('Battle-viewer.html'))||null;
    return Boolean(frame);
  },{timeout:10000}).toBe(true);

  await frame.waitForFunction(()=>{
    const adapter=window.LuminousCombatLiveAdapter073;
    const data=window.LuminousCombat073?.combatants?.()||{};
    return adapter?.state?.role==='dm'&&Object.keys(data).length===10;
  },null,{timeout:30000});

  await frame.waitForFunction(()=>Boolean(
    window.LuminousUnitRankRuntime &&
    (0,eval)("typeof assignTargetIntents === 'function'")
  ),null,{timeout:10000});

  const formation=await frame.evaluate(()=>{
    const rows=window.LuminousCombatLiveAdapter073.normalizedCombatants()
      .filter(unit=>unit.faction==='enemy')
      .map(unit=>({id:unit.id,x:unit.x,y:unit.y,row:unit.formationRow,column:unit.formationColumn,source:unit.formationSource}));
    const dom=rows.map(unit=>{
      const img=document.getElementById('sprite-'+unit.id);
      const token=document.getElementById('token-'+unit.id);
      const rect=img?.getBoundingClientRect?.();
      return {
        id:unit.id,
        centerY:rect?rect.top+rect.height/2:null,
        centerX:rect?rect.left+rect.width/2:null,
        left:token?.style?.left||'',
        bottom:token?.style?.bottom||''
      };
    });
    return {rows,dom};
  });

  expect(formation.rows).toHaveLength(3);
  expect(formation.rows.map(row=>row.y)).toEqual([18,42,18]);
  expect(formation.rows.map(row=>row.source)).toEqual(['pre_combat_zigzag','pre_combat_zigzag','pre_combat_zigzag']);
  expect(new Set(formation.rows.map(row=>row.y)).size).toBe(2);
  expect(formation.dom.map(row=>row.bottom)).toEqual(['18%','42%','18%']);
  expect(new Set(formation.dom.map(row=>row.bottom)).size).toBe(2);

  const targetProof=await frame.evaluate(()=>{
    return (0,eval)(`(()=>{
      const wolves=Object.values(combatData)
        .filter(unit=>unit.faction==='enemy'&&String(unit.rank||'normal').toLowerCase()==='normal')
        .sort((a,b)=>String(a.id).localeCompare(String(b.id)));
      return wolves.map(unit=>{
        const plan={type:'deck',sourceSlotIndex:0,data:{id:'ci_probe',basePower:5,coinPower:1,coinAmount:1,attackWeight:1}};
        const candidates=targetSlotCandidates(unit,plan);
        const uniqueTargetIds=[...new Set(candidates.map(row=>row?.target?.id).filter(Boolean))].sort();
        const slotCounts=Object.fromEntries(uniqueTargetIds.map(id=>[id,candidates.filter(row=>row?.target?.id===id).length]));
        const first=smartTargetForPlan(unit,plan);
        const second=smartTargetForPlan(unit,plan);
        return {
          enemyId:unit.id,
          candidateTargetIds:uniqueTargetIds,
          slotCounts,
          first,
          second
        };
      });
    })()`);
  });

  const lexicalTargetRuntime=await frame.evaluate(()=>({
    assignTargetIntents:(0,eval)("String(assignTargetIntents)"),
    smartTargetScore:(0,eval)("typeof smartTargetScore==='function'?String(smartTargetScore):'missing'"),
    autoActionScore:(0,eval)("typeof autoActionScore==='function'?String(autoActionScore):'missing'")
  }));
  console.log('LIVE_TARGET_RUNTIME_SOURCE',JSON.stringify(lexicalTargetRuntime));

  console.log('SEVEN_PLAYER_THREE_WOLF_FORMATION',JSON.stringify(formation));
  console.log('SEVEN_PLAYER_THREE_WOLF_TARGETS',JSON.stringify(targetProof));

  expect(targetProof).toHaveLength(3);
  for(const row of targetProof){
    expect(row.candidateTargetIds).toHaveLength(7);
    expect(row.first?.targetId).toBeTruthy();
    expect(row.second).toEqual(row.first);
    expect(row.candidateTargetIds).toContain(row.first.targetId);
  }
  const chosenTargets=targetProof.map(row=>row.first.targetId);
  expect(new Set(chosenTargets).size,'three normal Wolves must not deterministically dogpile the same Player').toBeGreaterThan(1);
  expect(chosenTargets.every(id=>id.startsWith('player:p'))).toBe(true);
  expect(targetProof[0].slotCounts['player:p2']).toBe(5);
  expect(targetProof[0].candidateTargetIds).toEqual(['player:p1','player:p2','player:p3','player:p4','player:p5','player:p6','player:p7']);

  fs.mkdirSync('artifacts/enemy-target-formation',{recursive:true});
  await frame.locator('#battlefield').screenshot({path:'artifacts/enemy-target-formation/field.png',animations:'disabled'});
});
