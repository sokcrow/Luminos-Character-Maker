import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const BASE='http://127.0.0.1:4173',DB='http://127.0.0.1:9000/.json?ns=demo-limbus-default-rtdb';
const config={apiKey:'demo',projectId:'demo-limbus',authDomain:'demo-limbus.firebaseapp.com',databaseURL:'https://demo-limbus-default-rtdb.firebaseio.com'};
const accounts={};
async function request(url,body,method='POST'){
 const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(url.startsWith('http://127.0.0.1:9000')?{Authorization:'Bearer owner'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});const value=await r.json();if(!r.ok)throw Error(JSON.stringify(value));return value;
}
test.beforeAll(async()=>{for(const role of ['dm','p1']){const email=role+'@roundtrip.local';const a=await request('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{email,password:'qa-pass-123',returnSecureToken:true});accounts[role]={email,uid:a.localId};}});
const sprite='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="220"><circle cx="60" cy="40" r="25" fill="#b5b5bf"/><path d="M25 205 38 85 82 85 95 205" fill="#774b63"/></svg>');
async function seed(){
 const deck={tier1:'s1',tier2:'s2',tier3:'s3'},skills={};
 for(let tier=1;tier<=3;tier++)skills['s'+tier]={id:'s'+tier,name:'Skill '+tier,kind:'skill',tier,deckCopies:4-tier,basePower:16+tier,coinPower:1,coinAmount:2,damageType:'Blunt',targetSide:'enemy',sinAffinity:'wrath',economyCost:'action'};
 skills.strike={id:'strike',name:'Enemy Strike',kind:'skill',basePower:8,coinPower:1,coinAmount:2,damageType:'Blunt',targetSide:'enemy'};
 const player={uid:accounts.p1.uid,characterName:'LIORA',hp:130,maxHp:130,currentHp:130,sp:10,classes:[{classId:'fighter',levels:1}],characterBuild:{skillDeck:deck},skillDeck:deck,skillIds:['s1','s2','s3'],equippedSkillIndex:{s1:true,s2:true,s3:true},combatSprite:sprite};
 const ally={...player,id:'player:p1',name:'LIORA',isPlayer:true,actorCategory:'player',canonicalScope:'player',canonicalPlayerKey:'p1',ownerPlayerId:'p1',canonicalOwnerUid:accounts.p1.uid,ownerUid:accounts.p1.uid,faction:'ally',battleActive:true,actionSlots:1,activeSlots:1,actionSlotIndex:{0:true},speedRange:[9,9],staggerThresholds:[1],level:1,offensiveLevel:1,defensiveLevel:1};
 const definition={id:'arena_guardian',name:'GUARDIAN',mechanics:{hp:180,maxHp:180,sp:0,speed:'1-2',actionSlots:1,skills:['strike']},combatSprite:sprite,staggerThresholds:[1],level:1,offensiveLevel:1,defensiveLevel:1};
 const enemy={...definition,id:'enemy:e1',libraryUnitId:'arena_guardian',unitRef:{id:'arena_guardian',scope:'units'},entrySource:'combat_v073_dm_setup',faction:'enemy',actorCategory:'enemy',isPlayer:false,battleActive:true,actionSlots:1,activeSlots:1,hp:1,maxHp:1,sp:0,speedRange:[1,2],skillIds:['strike'],equippedSkillIndex:{strike:true}};
 const players={p1:player};for(let i=2;i<=8;i++)players['p'+i]={uid:'offline-'+i,characterName:'OUTSIDE '+i};
 await request(DB,{'campaña':{config:{dm_uid:accounts.dm.uid},estado_mundo:{instancia_activa:'combate',escena_actual:{fondo:'',locacion:'Arena'}},jugadores:players,base_datos_unidades:{arena_guardian:definition},base_datos_skills:skills,combate:{estado:{phase:'COMBAT_ACTIVE',active:true,round:1,encounterId:'roundtrip'},combatants:{'player:p1':ally,'enemy:e1':enemy}}}},'PUT');
}
async function open(browser,role,viewport,dashboard=false){
 const context=await browser.newContext({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900});const page=await context.newPage();page.errors=[];page.blocked=[];page.setDefaultTimeout(25000);
 page.on('pageerror',error=>{page.errors.push(error.message);console.log(role,'PAGEERROR',error.stack||error.message)});page.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))console.log(role,'CONSOLE',m.text())});page.on('dialog',async dialog=>{page.lastDialog=dialog.message();await dialog.accept();});
 await page.addInitScript(()=>{window.__qaEvents=[];window.__qaSeen=new Set();window.__qaHud=false;window.__qaAnimation=false;setInterval(()=>{for(const event of window.LuminousCombatStepRuntime?.events?.()||[]){const key=[event.round,event.sequence,event.type].join(':');if(!window.__qaSeen.has(key)){window.__qaSeen.add(key);window.__qaEvents.push(event);}}if(document.querySelector('.clash-float-hud.open'))window.__qaHud=true;if(document.getAnimations().some(a=>a.playState==='running'))window.__qaAnimation=true;},20);});
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url.includes('/js/combat-firebase-config.js'))return route.fulfill({contentType:'application/javascript',body:'window.LuminousCombatFirebaseConfig='+JSON.stringify(config)+';'});
  const sdk=url.match(/firebase-(app|auth|database)\.js/);
  if(sdk){let body=fs.readFileSync('.qa-sdk/firebase-'+sdk[1]+'.js','utf8');if(sdk[1]==='database')body+=`\n{const init=firebase.initializeApp.bind(firebase);firebase.initializeApp=function(){const app=init(${JSON.stringify(config)});firebase.auth().useEmulator('http://127.0.0.1:9099',{disableWarnings:true});firebase.database().useEmulator('127.0.0.1',9000);firebase.auth().signInWithEmailAndPassword('${accounts[role].email}','qa-pass-123');return app;};}`;return route.fulfill({contentType:'application/javascript',body});}
  if(url.startsWith(BASE)||url.startsWith('http://127.0.0.1:9000')||url.startsWith('http://127.0.0.1:9099'))return route.continue();
  if(/firebaseio|identitytoolkit\.googleapis|securetoken\.googleapis|firebasedatabase/.test(url))page.blocked.push(url);
  return route.abort();
 });
 await page.goto(BASE+(dashboard?'/hoja_de_DM.html':'/Battle-viewer.html'),{waitUntil:'domcontentloaded'});
 let battle=page;
 if(dashboard){await expect(page.locator('#dm-combat-view')).toHaveAttribute('src',/Battle-viewer/,{timeout:45000});battle=await page.locator('#dm-combat-view').elementHandle().then(h=>h.contentFrame());}
 await battle.waitForFunction(wanted=>window.LuminousCombatLiveAdapter073?.state.role===wanted&&window.LuminousCombat073?.combatants()?.['enemy:e1']&&window.LuminousCombatEconomyMenu073?.state.installed,role==='dm'?'dm':'player',{timeout:60000});
 try{await battle.waitForFunction(()=>window.LuminousCombatLiveAdapter073.state.skills.s3&&window.LuminousCombatRemoteIntents073?.state.planningAi.signature,null,{timeout:45000});}catch(error){console.log('BOOT_FAILURE',await battle.evaluate(()=>({role:window.LuminousCombatLiveAdapter073?.state.role,phase:window.LuminousCombatLiveAdapter073?.state.combatState,skills:Object.keys(window.LuminousCombatLiveAdapter073?.state.skills||{}),authority:window.LuminousCombatAuthority073?.state.current,ai:window.LuminousCombatRemoteIntents073?.state.planningAi,status:document.getElementById('status')?.textContent})));await page.screenshot({path:'artifacts/roundtrip/boot-failure.png'});throw error;}
 await battle.waitForFunction(()=>!document.querySelector('#game-container.intro-running')&&!document.querySelector('#turn-transition.active'),null,{timeout:20000});
 return {page,battle,context};
}
async function choose(view,mobile){
 const p=view.battle;await p.locator('.command[data-menu=skills]').click();await expect(p.locator('#category-body .skill-option')).toHaveCount(2);await p.locator('#category-body .skill-option').last().click();await p.locator('#action-confirm').click();
 if(mobile)await p.locator('#combat-target-list button').filter({hasText:'GUARDIAN'}).first().click();
 else{await p.waitForTimeout(700);const slot=p.locator('.action-slot-wrapper.target-valid[data-owner-id="enemy:e1"]').first();await expect(slot).toBeVisible();const box=await slot.boundingBox();await view.page.mouse.click(box.x+box.width/2,box.y+box.height/2);}
 await expect(p.locator('#clash-forecast-confirm')).toBeVisible();await p.locator('#clash-forecast-confirm').click();await p.waitForTimeout(700);
 expect(await p.evaluate(()=>LuminousCombat073.plans()[0]?.clashConfirmed)).toBe(true);
}
const settled=async(view,round)=>view.battle.waitForFunction(r=>LuminousCombat073.uiState().round>=r&&!LuminousCombat073.uiState().running,round,{timeout:120000});
async function evidence(view,name){await view.page.screenshot({path:'artifacts/roundtrip/'+name+'.png'});console.log('QA_IMAGE:'+JSON.stringify({name,data:fs.readFileSync('artifacts/roundtrip/'+name+'.png').toString('base64')}));}
test('Actual DM panel, phone and PC: READY → Clash Coins animation damage → next round, retry offline',async({browser})=>{
 test.setTimeout(360000);fs.mkdirSync('artifacts/roundtrip',{recursive:true});await seed();let dm,phone,pc;
 try{
  dm=await open(browser,'dm',{width:1365,height:900},true);
  await dm.battle.waitForFunction(()=>LuminousCombatLiveAdapter073.state.combatState==='PRE_COMBAT_PLANNING'&&LuminousCombat073.combatants()['enemy:e1'].hp===180);
  await dm.page.locator('#btn-trigger-combat').click();await expect.poll(()=>dm.page.lastDialog).toContain('LIORA');
  let data=await request(DB,undefined,'GET');expect(data['campaña'].combate.estado.round).toBe(1);expect(data['campaña'].combate.estado.phase).toBe('PRE_COMBAT_PLANNING');expect(data['campaña'].combate.authority).toBeUndefined();
  await dm.context.close();dm=null;
  [phone,pc]=await Promise.all([open(browser,'p1',{width:390,height:844}),open(browser,'p1',{width:1280,height:800})]);
  await choose(phone,true);const first=await phone.battle.evaluate(()=>LuminousCombat073.plans()[0]);
  const started=Date.now();await phone.battle.locator('#ready').click();await phone.battle.waitForFunction(()=>LuminousCombatPlanSync073.delivery.status==='saved',null,{timeout:8000});const ackMs=Date.now()-started;
  await pc.battle.waitForFunction(()=>LuminousCombat073.uiState().ready&&LuminousCombat073.plans()[0]?.clashConfirmed===true);expect(await pc.battle.evaluate(()=>LuminousCombat073.plans()[0].drawId)).toBe(first.drawId);
  dm=await open(browser,'dm',{width:1365,height:900},true);
  await phone.battle.waitForFunction(()=>document.querySelector('.clash-float-hud.open'),null,{timeout:45000});await evidence(phone,'phone-clash');await evidence(dm,'dm-clash');
  await Promise.all([settled(dm,2),settled(phone,2),settled(pc,2)]);
  for(const view of [dm,phone,pc]){const result=await view.battle.evaluate(()=>({events:__qaEvents.map(e=>e.type),hud:__qaHud,animation:__qaAnimation,hp:LuminousCombat073.combatants()['enemy:e1'].hp,maxHp:LuminousCombat073.combatants()['enemy:e1'].maxHp}));for(const type of ['ClashStarted','CoinRolled','ClashFinished','DamageApplied'])expect(result.events).toContain(type);expect(result.hud).toBe(true);expect(result.animation).toBe(true);expect(result.hp).toBeGreaterThan(0);expect(result.hp).toBeLessThan(180);expect(result.maxHp).toBe(180);console.log('FIRST_ROUND',JSON.stringify(result));}
  await choose(pc,false);await pc.battle.locator('#ready').click();await Promise.all([settled(dm,3),settled(phone,3),settled(pc,3)]);
  data=await request(DB,undefined,'GET');const hp=data['campaña'].combate.combatants['enemy:e1'].hp;expect(hp).toBeGreaterThan(0);expect(hp).toBeLessThan(180);expect(data['campaña'].combate.estado.round).toBe(3);expect(data['campaña'].combate.readyPlayers).toBeUndefined();
  await dm.context.close();dm=null;await choose(phone,true);await phone.battle.evaluate(()=>firebase.database().goOffline());const offlineAt=Date.now();await phone.battle.locator('#ready').click();await expect(phone.battle.locator('#combat-phase-label')).toContainText('sin confirmar',{timeout:10000});expect(Date.now()-offlineAt).toBeLessThan(10000);await expect(phone.battle.locator('#ready')).toHaveText('REINTENTAR READY');await evidence(phone,'phone-retry');
  await phone.battle.locator('#ready').click();await phone.battle.evaluate(()=>firebase.database().goOnline());await phone.battle.waitForFunction(()=>LuminousCombatPlanSync073.delivery.status==='saved',null,{timeout:8000});
  dm=await open(browser,'dm',{width:1365,height:900},true);await Promise.all([settled(dm,4),settled(phone,4),settled(pc,4)]);
  data=await request(DB,undefined,'GET');expect(data['campaña'].combate.estado.round).toBe(4);expect(data['campaña'].combate.combatants['enemy:e1'].maxHp).toBe(180);for(const v of [dm,phone,pc]){expect(v.page.errors).toEqual([]);expect(v.page.blocked).toEqual([]);}
  console.log('ROUNDTRIP_PASS',JSON.stringify({ackMs,playerHp:130,enemyMaxHp:180,round:4,phoneAndPcSamePlayer:true,realDmButton:true,offlineDeadline:true,clashCoinsAnimationsDamage:true}));
 }catch(error){for(const [role,view]of [['dm',dm],['phone',phone],['pc',pc]])if(view&&!view.page.isClosed()){await view.page.screenshot({path:'artifacts/roundtrip/'+role+'-failure.png'});console.log(role,await view.battle.evaluate(()=>({ui:window.LuminousCombat073?.uiState?.(),phase:window.LuminousCombatLiveAdapter073?.state.combatState,delivery:window.LuminousCombatPlanSync073?.delivery,status:document.getElementById('status')?.textContent,errors:window.__qaEvents?.map(e=>e.type)})));}throw error;}
 finally{for(const view of [dm,phone,pc])await view?.context.close();}
});
