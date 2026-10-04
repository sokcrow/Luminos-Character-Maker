import fs from 'node:fs';
import { test, expect } from '@playwright/test';

const BASE = process.env.PLAYER_COMBAT_VISUAL_BASE_URL || 'http://127.0.0.1:4173';
const PLAYER_UID = 'player-skills-spells-ci';
const DM_UID = 'dm-skills-spells-ci';

const FIREBASE_STUB = `
(()=>{
  const PLAYER_UID='player-skills-spells-ci', DM_UID='dm-skills-spells-ci';
  const apps=[];
  const listeners=new Map();
  const svg=(label,body,accent)=>{
    const markup='<svg xmlns="http://www.w3.org/2000/svg" width="180" height="240" viewBox="0 0 180 240"><rect width="180" height="240" rx="24" fill="'+body+'"/><circle cx="90" cy="68" r="34" fill="'+accent+'"/><path d="M40 205c7-55 29-86 50-86s43 31 50 86" fill="'+accent+'"/><text x="90" y="228" text-anchor="middle" font-size="14" font-family="sans-serif" fill="white">'+label+'</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(markup);
  };

  const players={
    p1:{
      uid:PLAYER_UID,
      name:'CASTER PLAYER',
      characterName:'CASTER PLAYER',
      classes:[{classId:'wizard',levels:20}],
      classLevels:{wizard:20},
      spellIds:['fire_bolt','ray_of_frost'],
      knownSpellIds:['fire_bolt','ray_of_frost'],
      preparedSpellIds:['fire_bolt','ray_of_frost'],
      characterBuild:{
        calculatedAtLevel:20,
        classes:[{classId:'wizard',levels:20}],
        spellIds:['fire_bolt','ray_of_frost'],
        skillDeck:{tier1:'ci_slash',tier2:'ci_arc',tier3:'ci_slash'}
      }
    }
  };

  const skills={
    ci_slash:{
      id:'ci_slash',name:'CI Slash',kind:'skill',
      basePower:6,coinPower:4,coinAmount:1,coinType:'positive',
      sinAffinity:'wrath',damageType:'Slash',economyCost:'action',
      description:'Visible canonical Player Skill.'
    },
    ci_arc:{
      id:'ci_arc',name:'CI Arc',kind:'skill',
      basePower:4,coinPower:3,coinAmount:2,coinType:'positive',
      sinAffinity:'gloom',damageType:'Blunt',economyCost:'action',
      description:'Second visible canonical Player Skill.'
    }
  };

  const combatants={
    'player:p1':{
      id:'player:p1',combatId:'player:p1',
      name:'CASTER PLAYER',characterName:'CASTER PLAYER',
      isPlayer:true,category:'player',actorCategory:'player',canonicalScope:'player',
      playerId:'p1',ownerPlayerId:'p1',canonicalPlayerKey:'p1',
      ownerUid:PLAYER_UID,canonicalOwnerUid:PLAYER_UID,
      faction:'ally',battleActive:true,
      hp:100,maxHp:100,sp:20,maxSp:45,
      actionSlots:3,activeSlots:3,
      classes:[{classId:'wizard',levels:20}],
      classLevels:{wizard:20},
      spellIds:['fire_bolt','ray_of_frost'],
      knownSpellIds:['fire_bolt','ray_of_frost'],
      preparedSpellIds:['fire_bolt','ray_of_frost'],
      characterBuild:{
        calculatedAtLevel:20,
        classes:[{classId:'wizard',levels:20}],
        spellIds:['fire_bolt','ray_of_frost'],
        skillDeck:{tier1:'ci_slash',tier2:'ci_arc',tier3:'ci_slash'}
      },
      skillIds:['ci_slash','ci_arc'],
      skillSlotIds:['ci_slash','ci_slash','ci_slash','ci_arc','ci_arc','ci_slash'],
      equippedSkillIndex:{ci_slash:true,ci_arc:true},
      combatSprite:svg('PLAYER','#20344d','#74b9ff'),
      statusEffects:{}
    },
    'enemy:ci':{
      id:'enemy:ci',combatId:'enemy:ci',
      name:'CI ENEMY',characterName:'CI ENEMY',
      faction:'enemy',actorCategory:'enemy',category:'enemy',
      battleActive:true,hp:80,maxHp:80,sp:0,actionSlots:1,
      combatSprite:svg('ENEMY','#4b2525','#ff8a78'),
      statusEffects:{}
    }
  };

  const clean=(path='')=>String(path??'').split('/').filter(Boolean).join('/');
  const valueFor=(path='')=>{
    const key=clean(path);
    if(key==='campaña/config/dm_uid')return DM_UID;
    if(key==='campaña/jugadores')return players;
    if(key==='campaña/jugadores/p1')return players.p1;
    if(key==='campaña/combate/combatants')return combatants;
    if(key==='campaña/combate/estado')return {phase:'PRE_COMBAT_PLANNING',round:1};
    if(key==='campaña/combate/plannedActions')return {};
    if(key==='campaña/base_datos_unidades')return {};
    if(key==='campaña/combate/libraryManifest/units')return {};
    if(key==='campaña/combate/libraryManifest/skills')return {};
    if(key.startsWith('campaña/combate/libraryManifest/skills/'))return null;
    if(key.startsWith('campaña/base_datos_skills/')){
      const id=key.slice('campaña/base_datos_skills/'.length);
      return skills[id]||null;
    }
    if(key==='campaña/base_datos_skills')return skills;
    return null;
  };

  const snapshot=(path='')=>({
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
    const normalized=clean(path);
    return {
      key:normalized.split('/').pop()||null,
      path:normalized,
      child(next){return makeRef([normalized,next].filter(Boolean).join('/'))},
      once(){return Promise.resolve(snapshot(normalized))},
      on(event,callback){
        queueMicrotask(()=>callback(snapshot(normalized)));
        listeners.set(normalized+':'+event,callback);
        return callback;
      },
      off(){},
      set(){return Promise.resolve()},
      update(){return Promise.resolve()},
      remove(){return Promise.resolve()},
      transaction(update){
        const current=valueFor(normalized);
        return Promise.resolve({committed:true,snapshot:{val:()=>update(current)}});
      },
      push(value){
        const ref=makeRef([normalized,'ci-key'].filter(Boolean).join('/'));
        return value===undefined?ref:Object.assign(Promise.resolve(ref),ref);
      }
    };
  };

  const auth={
    currentUser:{uid:PLAYER_UID,email:'player-menu-ci@local.invalid'},
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

async function installFirebasePlayerStub(page){
  await page.route(/https:\/\/www\.gstatic\.com\/firebasejs\/8\.10\.1\/firebase-(app|auth|database)\.js/, async route=>{
    const url=route.request().url();
    await route.fulfill({
      status:200,
      contentType:'application/javascript; charset=utf-8',
      body:url.includes('firebase-app.js')?FIREBASE_STUB:'/* Firebase supplied by Player Combat visual CI. */'
    });
  });
}

async function clickMenuIcon(page, fileName){
  const icon=page.locator('img[src*="'+fileName+'"]').first();
  await expect(icon, fileName+' command icon must be visible').toBeVisible({timeout:30000});
  const diagnostic=await icon.evaluate((node,fileName)=>{
    const ancestors=[];
    let current=node;
    for(let depth=0;current&&depth<8;depth+=1,current=current.parentElement){
      ancestors.push({
        tag:current.tagName,
        id:current.id||'',
        className:String(current.className||''),
        role:current.getAttribute?.('role')||'',
        onclick:current.getAttribute?.('onclick')||'',
        data:{...current.dataset},
        pointerEvents:getComputedStyle(current).pointerEvents,
      });
    }
    let openCategorySource='missing', originalRenderCategorySource='missing', goRootSource='missing';
    try{openCategorySource=(0,eval)("typeof openCategory==='function'?String(openCategory):'missing'");}catch(error){openCategorySource=String(error);}
    try{originalRenderCategorySource=String(window.LuminousCombatEconomyMenu073?.state?.originals?.renderCategory||'missing');}catch(error){originalRenderCategorySource=String(error);}
    try{goRootSource=(0,eval)("typeof goRoot==='function'?String(goRoot):'missing'");}catch(error){goRootSource=String(error);}
    return {fileName,ancestors,openCategorySource,originalRenderCategorySource,goRootSource};
  },fileName);
  console.log('PLAYER_MENU_CONTROL_DIAGNOSTIC',JSON.stringify(diagnostic));
  const control=icon.locator('xpath=ancestor-or-self::*[self::button or @onclick or @role="button"][1]');
  if(await control.count()) await control.click({force:true});
  else await icon.click({force:true});
  const after=await page.evaluate(()=>({
    activeMenu:(0,eval)("typeof activeMenu!=='undefined'?activeMenu:null"),
    navState:(0,eval)("typeof navState!=='undefined'?navState:null"),
    selected:(0,eval)("typeof selected!=='undefined'&&selected?selected.type||selected.id||true:null"),
    categorySurface:Array.from(document.querySelectorAll('.category-surface')).map(node=>({
      className:String(node.className||''),
      display:getComputedStyle(node).display,
      visibility:getComputedStyle(node).visibility,
      opacity:getComputedStyle(node).opacity
    })),
    categoryBody:{
      className:String(document.getElementById('category-body')?.className||''),
      display:getComputedStyle(document.getElementById('category-body')).display,
      visibility:getComputedStyle(document.getElementById('category-body')).visibility,
      text:document.getElementById('category-body')?.textContent||''
    },
    introRunning:document.getElementById('game-container')?.classList?.contains('intro-running')||false
  }));
  console.log('PLAYER_MENU_AFTER_CLICK',JSON.stringify(after));
}

test.use({viewport:{width:1440,height:1000},colorScheme:'dark'});

test.afterEach(async({page},testInfo)=>{
  fs.mkdirSync('artifacts/player-combat-skills-spells',{recursive:true});
  await page.screenshot({
    path:'artifacts/player-combat-skills-spells/'+(testInfo.status==='passed'?'passed':'failed')+'-fullpage.png',
    fullPage:true,
    animations:'disabled'
  }).catch(()=>{});
});

test('Player caster opens Skills and Spells and sees canonical entries', async({page})=>{
  const pageErrors=[];
  page.on('pageerror',error=>pageErrors.push(String(error?.stack||error?.message||error)));
  await installFirebasePlayerStub(page);

  await page.goto(BASE+'/Battle-viewer.html',{waitUntil:'domcontentloaded'});

  await expect.poll(async()=>{
    return page.evaluate(()=>({
      role:window.LuminousCombatLiveAdapter073?.state?.role||null,
      economy:Boolean(window.LuminousCombatEconomyMenu073?.state?.installed),
      viewerRole:document.getElementById('game-container')?.dataset?.viewerRole||null
    }));
  },{timeout:30000,message:'Player Combat runtime must hydrate canonical menu data'}).toMatchObject({
    role:'player',
    economy:true,
    viewerRole:'player'
  });

  await expect.poll(()=>page.evaluate(()=>Object.keys(window.LuminousCombatLiveAdapter073?.state?.skills||{}).sort()),{
    timeout:15000,
    message:'Player canonical Skills must be loaded before opening the Skills menu'
  }).toEqual(['ci_arc','ci_slash']);

  await clickMenuIcon(page,'Skills.png');
  const category=page.locator('#category-body');
  await expect(category).toBeVisible({timeout:10000});
  await expect(category).toContainText('CI Slash');
  await expect(category).toContainText('CI Arc');
  await expect(category.locator('.skill-option')).toHaveCount(2);

  fs.mkdirSync('artifacts/player-combat-skills-spells',{recursive:true});
  await category.screenshot({
    path:'artifacts/player-combat-skills-spells/player-skills-visible.png',
    animations:'disabled'
  });

  const back=page.locator('.category-back').first();
  await expect(back).toBeVisible({timeout:10000});
  await back.click({force:true});

  await clickMenuIcon(page,'Spells.png');
  await expect(category).toBeVisible({timeout:10000});
  await expect(category).toContainText('Fire Bolt');
  await expect(category).toContainText('Ray of Frost');
  await expect(category.locator('.skill-option')).toHaveCount(2);

  fs.mkdirSync('artifacts/player-combat-skills-spells',{recursive:true});
  await category.screenshot({
    path:'artifacts/player-combat-skills-spells/player-spells-visible.png',
    animations:'disabled'
  });

  const proof=await page.evaluate(()=>({
    role:window.LuminousCombatLiveAdapter073?.state?.role||null,
    spellIds:window.LuminousCombatEconomyMenu073?.spellRowsForPlayer?.().map(row=>row.spellId||row.id)||[],
    isCaster:window.LuminousCombatEconomyMenu073?.isSpellcaster?.()===true
  }));
  console.log('PLAYER_SKILLS_SPELLS_VISUAL_PROOF',JSON.stringify(proof));
  console.log('PLAYER_SKILLS_SPELLS_PAGE_ERRORS',JSON.stringify(pageErrors));

  expect(proof.role).toBe('player');
  expect(proof.isCaster).toBe(true);
  expect(proof.spellIds.sort()).toEqual(['fire_bolt','ray_of_frost']);
  expect(pageErrors).toEqual([]);
});
