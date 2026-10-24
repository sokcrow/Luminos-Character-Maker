import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root=process.cwd(),project='demo-combat-results',ns=project+'-default-rtdb',base='http://127.0.0.1:4173';
let server,dm,player,friend,initial;const errors=[],production=[],contexts=new Set();
const clone=v=>JSON.parse(JSON.stringify(v));
const endpoint=p=>`http://127.0.0.1:9100/${p.split('/').map(encodeURIComponent).join('/')}.json?ns=${ns}`;
async function admin(p,method='GET',value){const r=await fetch(endpoint(p),{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})});expect(r.ok,await r.clone().text()).toBeTruthy();return r.json();}
async function account(label){const email=label+Date.now()+'@example.test',password='temporary-password';const r=await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});const data=await r.json();expect(data.localId,JSON.stringify(data)).toBeTruthy();return {uid:data.localId,email,password,token:data.idToken};}
function fixture(){
 const potion={instanceId:'potion',definitionId:'hp_generic_pocket_recovery_patch',category:'consumable',quantity:2,runtime:{actionCost:'action',targetMode:'self',consumeQty:1,healing:{flat:2,maxHpPercent:3,capMaxHpPercent:100}}};
 const p={uid:player.uid,characterName:'LIORA',hp:110,maxHp:130,actionSlots:1,characterBuild:{skillDeck:{tier1:'s1',tier2:'s2',tier3:'s3'}},inventario_activo:{potion}};
 const sprite=color=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="180" height="240"><circle cx="90" cy="55" r="40" fill="'+color+'"/><path d="M30 230V130Q90 70 150 130V230Z" fill="'+color+'"/></svg>');p.combatSprite=sprite('#72baff');
 const units={'player:p1':{...clone(p),id:'player:p1',combatId:'player:p1',isPlayer:true,canonicalScope:'player',canonicalPlayerKey:'p1',canonicalOwnerUid:player.uid,ownerPlayerId:'p1',ownerUid:player.uid,playerId:'p1',category:'player',faction:'ally',battleActive:true,isBackup:false,deploymentState:'field',skillIds:['s1','s2','s3'],skillSlotIds:['s1','s1','s1','s2','s2','s3'],equippedSkillIndex:{s1:true,s2:true,s3:true},actionSlotIndex:{0:true},usableItemIndex:{potion:true}},kobold:{id:'kobold',name:'Kobold',isPlayer:false,category:'enemy',faction:'enemy',battleActive:true,isBackup:false,deploymentState:'field',hp:1000,maxHp:1000,actionSlots:1,skillIds:['enemy_s1'],equippedSkillIndex:{enemy_s1:true},actionSlotIndex:{0:true},level:1}};
 units['player:p1'].combatSprite=p.combatSprite;units.kobold.combatSprite=sprite('#e27254');
 const skills={};for(const [i,id]of ['s1','s2','s3'].entries())skills[id]={id,name:'Strike '+id,kind:'skill',tier:i+1,basePower:12+i,coinPower:2,coinAmount:1,damageType:'Blunt',sinAffinity:'wrath',effects:[],coins:[{effects:[]}]};skills.enemy_s1={id:'enemy_s1',name:'Kobold Strike',kind:'skill',basePower:2,coinPower:1,coinAmount:1,damageType:'Blunt',sinAffinity:'wrath',effects:[],coins:[{effects:[]}]};
 const players={p1:p,p2:{uid:friend.uid,name:'Other player'}};for(let i=3;i<=8;i++)players['p'+i]={uid:'absent'+i,name:'Absent '+i};
 return {config:{dm_uid:dm.uid},estado_mundo:{instancia_activa:'combate'},jugadores:players,base_datos_skills:skills,base_datos_unidades:{},actores:{},combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1,active:true,encounterId:'story',presentation:'full'},combatants:units}};
}
async function setupContext(browser,phone=false,viewport=null){
 const context=await browser.newContext({viewport:viewport||(phone?{width:390,height:844}:{width:1280,height:800}),reducedMotion:'no-preference'});
 contexts.add(context);context.on('close',()=>contexts.delete(context));
 await context.route('**/*',async route=>{
  const url=route.request().url();const match=url.match(/firebasejs\/8\.10\.1\/(firebase-[a-z]+\.js)/);
  if(match){let body=fs.readFileSync(path.join(root,'node_modules/firebase',match[1]),'utf8');if(match[1]==='firebase-app.js')body+=`\n(function(){const original=firebase.initializeApp;firebase.initializeApp=function(config,name){const app=original.call(firebase,{...config,apiKey:'fake',projectId:'${project}',databaseURL:'https://${ns}.firebaseio.com'},name);app.auth().useEmulator('http://127.0.0.1:9199',{disableWarnings:true});app.database().useEmulator('127.0.0.1',9100);return app;};})();`;await route.fulfill({contentType:'text/javascript',body});return;}
  if(/firebaseio\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/.test(url)&&!url.includes('127.0.0.1')){production.push(url);await route.abort();return;}
  if(!url.startsWith(base)&&!url.startsWith('http://127.0.0.1:9')&&!url.startsWith('data:')){await route.abort();return;}
  await route.continue();
 });
 await context.addInitScript(()=>{
  window.__qaCues=[];let api;
  Object.defineProperty(window,'LuminousCombatSteps',{configurable:true,get:()=>api,set(value){api=Object.freeze({...value,create(options){const onPresentation=options.onPresentation;return value.create({...options,onPresentation(cue,args){window.__qaCues.push({cue,at:Date.now(),phase:window.LuminousCombatAuthority073?.state.current?.phase});onPresentation?.(cue,args);}});}});}});
 });
 context.on('page',page=>{page.on('pageerror',e=>{errors.push(e.stack||e.message);console.log('BROWSER_UNCAUGHT',e.stack||e.message);});page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('BROWSER',m.type(),m.text());});});return context;
}
async function login(page,user,url='/combate.html'){
 await page.goto(base+url);const form=url.startsWith('/mirror')?'mirror':'combat-entry';await page.locator('#'+form+'-email').fill(user.email);await page.locator('#'+form+'-password').fill(user.password);await page.locator('#'+form+'-login button').click();
}
async function frame(page,query='Battle-viewer'){
 try{await expect.poll(()=>page.frames().filter(f=>f.url().includes(query)).length,{timeout:40000}).toBeGreaterThan(0);}
 catch(error){await page.screenshot({path:test.info().outputPath('entry-failure.png')});console.log('ENTRY_FAILURE',JSON.stringify(await page.evaluate(()=>({uid:window.firebase?.auth?.().currentUser?.uid,text:document.body.innerText}))));throw error;}
 const f=page.frames().find(f=>f.url().includes(query));
 await f.waitForFunction(()=>window.LuminousCombatLiveAdapter073?.state.hydratedOnce&&window.LuminousCombat073?.playerId?.(),{},{timeout:60000});
 await f.waitForFunction(()=>window.LuminousCombatAuthority073&&window.LuminousCombatRemoteIntents073&&window.LuminousCombatSlotDeck073&&window.LuminousCombatPlanSync073,{},{timeout:40000});return f;
}
async function choose(f,kind='skill'){
 await expect(f.locator('#ready')).toBeEnabled({timeout:20000});
 await f.waitForFunction(()=>!document.getElementById('game-container')?.classList.contains('intro-running')&&!window.LuminousCombat073.uiState().running&&window.LuminousCombatEconomyMenu073?.rowsFor,{},{timeout:20000});
 await f.evaluate(kind=>{
  const r=window.LuminousCombat073,s=window.LuminousCombatLiveAdapter073.state,unit=r.combatants()[r.playerId()];let plan;
  if(kind==='skill'){const card=window.LuminousCombatSlotDeck073.hand(unit.id,0)[0];if(!card)throw Error('No deck hand');plan={type:'deck',sourceSlotIndex:0,drawId:card.drawId,targetId:Object.values(r.combatants()).find(u=>u.faction==='enemy'&&u.hp>0)?.id,targetSlotIndex:0,clashChoice:'clash',clashConfirmed:true,data:card.skill};}
  else if(kind==='item'){const item=window.LuminousCombatEconomyMenu073.rowsFor('items')[0];if(!item)throw Error('No active inventory item');plan={type:'items',sourceSlotIndex:0,targetId:unit.id,targetSlotIndex:0,data:item};}
  else plan={type:'global',sourceSlotIndex:0,targetId:unit.id,targetSlotIndex:0,data:{id:'help',actionKey:'help',name:'Help',kind:'global'}};
  r.restorePlanning([plan],false);
 },kind);await expect(f.locator('#ready')).toBeEnabled({timeout:20000});await f.locator('#ready').click({timeout:20000});
 console.log('READY_REQUEST',JSON.stringify(await f.evaluate(()=>({ui:window.LuminousCombat073.uiState(),delivery:window.LuminousCombatPlanSync073.delivery,status:document.getElementById('status')?.textContent}))));
}
test.beforeAll(async()=>{
 server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,base).pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(error,body)=>{if(error){res.writeHead(404).end();return;}const ext=path.extname(p);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[ext]||'application/octet-stream');res.end(body);});});await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
 dm=await account('dm');player=await account('player');friend=await account('friend');initial=fixture();
});
test.afterEach(async()=>{await Promise.all([...contexts].map(context=>context.close()));});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));expect(production).toEqual([]);expect(errors).toEqual([]);});

async function waitRound(f,round){await expect.poll(()=>f.evaluate(()=>({round:window.LuminousCombat073.uiState().round,running:window.LuminousCombatAuthority073.state.runningLocal})),{timeout:90000}).toEqual({round,running:false});}
async function screenshot(page,info,name){await page.screenshot({path:info.outputPath(name+'.png')});}
async function endEntry(page,result){await page.locator('#combat-entry-menu > summary').click();await page.locator('#combat-entry-end').click();await page.locator('#combat-entry-result').selectOption(result);await page.locator('#combat-entry-confirm-end').click();}
function corpseCampaign(){
 const c=clone(initial),u=c.combate.combatants.kobold;
 Object.assign(u,{hp:0,defeated:true,battleActive:false,deploymentState:'defeated',libraryUnitId:'qa_wolf',species:'wolf',creatureType:'beast',
 bodyProfile:{version:1,kind:'organic',sizeClass:'medium',materials:['flesh','blood','bone','pelt'],edible:true,resources:[{id:'meat',integrityFamily:'meat',sourceMaterial:'flesh',itemId:'meat_wolf',catalogFamily:'meat',culinary:true,knownUses:['cooking'],yield:{min:1,max:1}}]},
 lootProfile:{version:1,carried:[],equipment:{source:'none'},currency:null,harvest:{source:'body_profile'},impossibleCategories:[]}});
 return c;
}
async function setRules(rules){const r=await fetch('http://127.0.0.1:9100/.settings/rules.json?ns='+ns,{method:'PUT',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(rules)});expect(r.ok,await r.text()).toBe(true);}
for (const [width,height] of [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]]) {
test(`PC and phone present synchronized Clash cues at ${width}x${height}, then converge`,async({browser},info)=>{
 test.setTimeout(150000);await admin('campaña','PUT',initial);
 const dc=await setupContext(browser),pc=await setupContext(browser),cc=await setupContext(browser,true,{width,height});
 await cc.addInitScript(()=>{
  let api;Object.defineProperty(window,'LuminousCombatPlayback',{configurable:true,get:()=>api,set(value){api=Object.freeze({...value,createConsumer(options){
   const core=value.createConsumer(options);return Object.freeze({...core,receive(row){setTimeout(()=>core.receive(row),150+(row.seq%3)*20);}});
  }});}});
 });
 const dp=await dc.newPage(),pp=await pc.newPage(),cp=await cc.newPage();
 await login(dp,dm);const df=await frame(dp);await login(pp,player);const pf=await frame(pp);await login(cp,player);const cf=await frame(cp);
 await choose(cf);
 for(const f of [pf,cf])await expect.poll(()=>f.evaluate(()=>window.__qaCues.some(c=>c.cue==='clashStart')),{timeout:30000}).toBe(true);
 expect(await df.evaluate(()=>window.LuminousCombatAuthority073.state.runningLocal)).toBe(true);
 const times=await Promise.all([df,pf,cf].map(f=>f.evaluate(()=>window.__qaCues.find(c=>c.cue==='clashStart').at)));
 expect(Math.max(...times)-Math.min(...times)).toBeLessThan(350);
 expect((await admin('campaña/combate/authority/current/playback')).timelineVersion).toBe(1);
 await expect.poll(()=>cf.evaluate(()=>window.__qaCues.some(c=>c.cue==='powerCoin')),{timeout:15000}).toBe(true);
 await screenshot(cp,info,'phone-live-clash');await screenshot(pp,info,'pc-live-clash');await screenshot(dp,info,'dm-live-clash');
 await expect.poll(async()=> (await admin('campaña/combate/estado')).round,{timeout:90000}).toBe(2);
 await Promise.all([waitRound(pf,2),waitRound(cf,2)]);
 const canonical=(await admin('campaña/combate/combatants/kobold')).hp;
 const allCues=await Promise.all([df,pf,cf].map(f=>f.evaluate(()=>window.__qaCues)));
 for(const cues of allCues.slice(1)){
  expect(cues.map(c=>c.cue)).toEqual(allCues[0].map(c=>c.cue));
  expect(Math.max(...cues.map((c,i)=>Math.abs(c.at-allCues[0][i].at)))).toBeLessThan(350);
 }
 for(const f of [pf,cf]){
  const data=await f.evaluate(()=>({hp:window.LuminousCombat073.combatants().kobold.hp,cues:window.__qaCues.map(c=>c.cue)}));
  expect(data.hp).toBe(canonical);expect(data.cues).toContain('hitMotion');expect(data.cues).toContain('clashEnd');
 }
 console.log('LIVE_CUES_PASS',JSON.stringify({cueSkewMs:Math.max(...times)-Math.min(...times),pcAndPhone:true,finalHp:canonical}));
 await Promise.all([dc.close(),pc.close(),cc.close()]);
});
}

test('Ten enemies use eight field slots and two FIFO reinforcements; Victory shows this encounter loot and the next fight starts at one',async({browser},info)=>{
 test.setTimeout(240000);
 const campaign=clone(initial),template=corpseCampaign().combate.combatants.kobold;
 delete campaign.combate.combatants.kobold;
 const authored={...template,id:'qa_wolf',name:'Lobo de prueba',hp:12,maxHp:12,defeated:false,battleActive:true,deploymentState:'field',removed:false,skillIds:['enemy_s1'],skillSlotIds:['enemy_s1'],action_slots:['enemy_s1'],speedRange:[1,2]};
 campaign.base_datos_unidades.qa_wolf=authored;
 for(const id of ['s1','s2','s3'])campaign.base_datos_skills[id].basePower=200;
 campaign.combate.estado.presentation='simple';
 campaign.jugadores.p1.scores={wis:30,int:30};campaign.jugadores.p1.proficiencyBonus=6;campaign.jugadores.p1.proficiencies={skills:{survival:'expertise',investigation:'expertise'}};
 campaign.jugadores.p1.hp=1300;campaign.jugadores.p1.maxHp=1300;campaign.combate.combatants['player:p1'].hp=1300;campaign.combate.combatants['player:p1'].maxHp=1300;
 await admin('campaña','PUT',campaign);
 const dc=await setupContext(browser),pc=await setupContext(browser,true),oc=await setupContext(browser);
 const dp=await dc.newPage(),pp=await pc.newPage(),op=await oc.newPage();dp.on('dialog',d=>d.accept());
 await login(dp,dm);const df=await frame(dp);await login(pp,player);let pf=await frame(pp);await login(op,friend);
 await df.waitForFunction(()=>window.LuminousCombat073UnitDeployBridge&&window.LuminousCombatDmSetup073.state.units.qa_wolf);
 await df.locator('#c073-dm-setup > summary').click();await df.locator('#c073-unit').selectOption('qa_wolf');await df.locator('#c073-qty').fill('10');await df.locator('#c073-enemy').click();
 await expect.poll(async()=>Object.keys(await admin('campaña/combate/reserves')||{}).length,{timeout:30000}).toBe(2);
 let raw=await admin('campaña/combate');const enemyIds=Object.entries(raw.combatants).filter(([,u])=>u.faction==='enemy').map(([id])=>id),reserveIds=Object.keys(raw.reserves);
 expect(enemyIds.length).toBe(8);expect(reserveIds.every(id=>raw.reserves[id].isBackup&&raw.reserves[id].battleActive===false)).toBe(true);
 await expect.poll(()=>pf.evaluate(()=>Object.values(window.LuminousCombat073.combatants()).filter(u=>u.faction==='enemy').length)).toBe(8);
 expect(await pf.evaluate(ids=>ids.every(id=>!window.LuminousCombat073.combatants()[id]),reserveIds)).toBe(true);
 await screenshot(dp,info,'eight-field-two-reserves');await df.locator('#c073-dm-setup > summary').click();
 for(let round=1;round<=2;round++){
  await choose(pf);await expect.poll(async()=>(await admin('campaña/combate/estado')).round,{timeout:90000}).toBe(round+1);await waitRound(pf,round+1);
  raw=await admin('campaña/combate');console.log('WAVE_STATE',JSON.stringify({round,units:Object.entries(raw.combatants||{}).map(([id,u])=>({id,hp:u.hp,maxHp:u.maxHp,incapacitated:u.incapacitated})),defeated:Object.keys(raw.defeated||{}),reserves:Object.keys(raw.reserves||{})}));expect(Object.keys(raw.defeated||{}).length).toBe(round);expect(Object.keys(raw.reserves||{}).length).toBe(2-round);
  expect(Object.values(raw.combatants).filter(u=>u.faction==='enemy').length).toBe(8);
  const promoted=raw.combatants[reserveIds[round-1]];expect(promoted).toBeTruthy();expect(promoted.isBackup).toBe(false);expect(promoted.battleActive).toBe(true);
 }
 const firstId=raw.estado.encounterId;
 await endEntry(dp,'victory');
 await expect.poll(async()=>(await admin('campaña/combate/estado')).phase,{timeout:40000}).toBe('ENDED');
 await expect.poll(()=>admin('campaña/estado_mundo/instancia_activa'),{timeout:15000}).toBe('teatro');
 expect((await admin('campaña/combate/estado')).round).toBe(1);
 await expect(pp.locator('#postcombat-loot-modal')).toBeVisible({timeout:20000});await expect(pp.locator('.loot-corpse')).toHaveCount(2);await expect(op.locator('#postcombat-loot-modal')).not.toBeVisible();
 expect((await admin('campaña/loot_encounters/'+firstId+'/meta')).corpseCount).toBe(2);
 const lootId=Object.keys(await admin('campaña/loot_postcombat'))[0];
 const rejection=await op.evaluate(async lootId=>{try{await firebase.database().ref('campaña/loot_postcombat/'+lootId+'/revision').set(999);return false;}catch(error){return error.code==='PERMISSION_DENIED';}},lootId);
 expect(rejection).toBe(true);
 const absentRejection=await op.evaluate(async lootId=>{try{await firebase.database().ref('campaña/loot_requests/p2/forbidden').set({uid:firebase.auth().currentUser.uid,playerId:'p2',lootInstanceId:lootId,actionId:'harvest',checkHeads:5,status:'pending',createdAt:Date.now()});return false;}catch(error){return error.code==='PERMISSION_DENIED';}},lootId);
 expect(absentRejection).toBe(true);
 await screenshot(pp,info,'phone-victory-loot-two-waves');
 const recovered=async()=>Object.values((await admin('campaña/jugadores/p1')).inventario_activo||{}).filter(i=>i.definitionId==='meat_wolf').reduce((n,i)=>n+Number(i.quantity||0),0);
 // The player-facing Corpse Loot HUD shows only the selected corpse's actions.
 // Explicitly select the corpse with a remaining Harvest before clicking, so
 // Playwright never waits on the hidden, disabled buttons of other corpses.
 const selectHarvest = async () => {
  const card=pp.locator('#postcombat-loot-list .loot-corpse').filter({has:pp.locator('[data-loot-action="harvest"]')}).first();
  const id=await card.getAttribute('data-loot-card');
  expect(id).toBeTruthy();
  await expect.poll(()=>pp.evaluate(()=>window.LuminousPlayerPostCombatLoot?.state?.claiming)).toBe(false);
  // The mobile HUD replaces the desktop corpse sidebar with the real picker.
  // Follow the visible control rather than waiting on its hidden counterpart.
  await pp.locator('[data-loot-tab="actions"]').click();
  const picker=pp.locator('#postcombat-loot-corpse-picker');
  if(await picker.isVisible())await picker.selectOption(id);
  else await pp.locator('[data-corpse-select="'+id+'"]').click();
  await expect.poll(()=>pp.evaluate(()=>window.LuminousPlayerPostCombatLoot?.state?.selectedLootId),{timeout:20000}).toBe(id);
  const action=pp.locator('[data-loot-card="'+id+'"] [data-loot-action="harvest"]');
  await expect(action).toBeVisible({timeout:20000});
  await expect(action).toBeEnabled({timeout:20000});
  return action;
 };
 await (await selectHarvest()).click();
 await expect.poll(recovered,{timeout:30000}).toBe(1);
 await expect(pp.locator('#postcombat-loot-message')).toContainText('recuperadas');
 await pp.reload();await expect(pp.locator('#combat-entry-menu')).toBeVisible();
 await pp.locator('#combat-entry-menu > summary').click();await pp.locator('#btn-postcombat-loot').click();
 await expect(pp.locator('[data-loot-action="harvest"]')).toHaveCount(1);
 expect(await recovered()).toBe(1);
 await admin('campaña/jugadores/p1/inventoryRules','PUT',{activeSlotLimit:0,stashSlotLimit:0});
 await (await selectHarvest()).click();await expect(pp.locator('[data-pending-id]')).toHaveCount(1,{timeout:30000});
 await expect(pp.locator('#postcombat-loot-message')).toContainText('reservada');
 await admin('campaña/jugadores/p1/inventoryRules','PUT',{activeSlotLimit:20,stashSlotLimit:80});
 await pp.locator('[data-pending-id]').click();await expect.poll(recovered,{timeout:30000}).toBe(2);
 await expect(pp.locator('[data-pending-id]')).toHaveCount(0);
 await screenshot(pp,info,'phone-loot-recovered-into-inventory');await pp.locator('.loot-close').click();
 await pp.locator('#combat-entry-menu > summary').click();await expect.poll(()=>pp.locator('#combat-entry-menu').evaluate(menu=>menu.open)).toBe(false);
 await dp.locator('#combat-entry-open').click();
 await expect.poll(async()=>(await admin('campaña/combate/estado')).encounterId).not.toBe(firstId);
 raw=await admin('campaña/combate');expect(raw.estado.round).toBe(1);for(const key of ['combatants','reserves','defeated','departed','authority','playback','readyPlayers','plannedActions'])expect(raw[key]||null).toBeNull();
 const nextFrame=await frameWaitingForSetup(dp,raw.estado.encounterId);
 await nextFrame.evaluate(()=>window.LuminousCombatDmSetup073.deployPlayer('p1'));
 await nextFrame.waitForFunction(()=>window.LuminousCombat073UnitDeployBridge&&window.LuminousCombatDmSetup073.state.units.qa_wolf);
 await nextFrame.locator('#c073-dm-setup > summary').click();await nextFrame.locator('#c073-unit').selectOption('qa_wolf');await nextFrame.locator('#c073-qty').fill('1');await nextFrame.locator('#c073-enemy').click();
 pf=await frame(pp);await expect.poll(()=>pf.evaluate(()=>window.LuminousCombat073.uiState().round)).toBe(1);
 await choose(pf);await expect.poll(async()=>(await admin('campaña/combate/estado')).round,{timeout:90000}).toBe(2);await waitRound(pf,2);
 await endEntry(dp,'victory');await expect.poll(()=>admin('campaña/estado_mundo/instancia_activa'),{timeout:15000}).toBe('teatro');
 await expect(pp.locator('#postcombat-loot-modal')).toBeVisible({timeout:20000});await expect(pp.locator('.loot-corpse')).toHaveCount(1);
 expect((await admin('campaña/loot_encounters/'+firstId+'/meta')).corpseCount).toBe(2);
 expect(Object.keys(await admin('campaña/loot_instances')).length).toBe(3);await screenshot(pp,info,'phone-second-encounter-one-corpse');
 console.log('ROLLOVER_PASS',JSON.stringify({field:8,reserves:2,fifoPromotions:2,firstEncounterCorpses:2,nextEncounterCorpses:1,nextStartsAt:1,absentPlayerPopup:false,inventoryMeat:2,pendingDeliveryResumed:true}));
 await Promise.all([dc.close(),pc.close(),oc.close()]);
});
async function frameWaitingForSetup(page,encounterId){
 const viewer=page.locator('#combat-entry-view');
 await expect(viewer).toHaveAttribute('data-encounter',encounterId,{timeout:30000});
 await expect(viewer).toBeVisible();
 const element=await viewer.elementHandle(),f=await element.contentFrame();
 expect(f,'the fresh encounter must have its own viewer').toBeTruthy();
 await f.waitForFunction(()=>window.LuminousCombatDmSetup073?.state.started,{},{timeout:60000});return f;
}

test('Defeat and cancellation finish without loot and permit a fresh encounter',async({browser},info)=>{
 test.setTimeout(120000);
 for(const result of ['defeat','cancelled']){
  await admin('campaña','PUT',initial);const dc=await setupContext(browser),pc=await setupContext(browser);
  const dp=await dc.newPage(),pp=await pc.newPage();await login(dp,dm);await frame(dp);await login(pp,player);await frame(pp);
  await endEntry(dp,result);
  await expect.poll(()=>admin('campaña/estado_mundo/instancia_activa'),{timeout:20000}).toBe('teatro');
  const state=await admin('campaña/combate/estado');expect(state.result).toBe(result);expect(state.round).toBe(1);
  expect(await admin('campaña/loot_encounters')).toBeNull();await expect(pp.locator('#postcombat-loot-modal')).not.toBeVisible();
  await screenshot(dp,info,'ended-'+result);await dp.locator('#combat-entry-open').click();
  await expect.poll(async()=>(await admin('campaña/combate/estado')).encounterId).not.toBe('story');
  expect((await admin('campaña/combate/estado')).round).toBe(1);await dc.close();await pc.close();
 }
});

test('DM dashboard: INICIAR COMBATE starts a fresh fight after a sealed victory and does not reset an active fight',async({browser})=>{
 test.setTimeout(125000);
 const campaign=clone(initial);
 campaign.estado_mundo.instancia_activa='teatro';
 campaign.combate={
   estado:{encounterId:'previous-victory',phase:'ENDED',round:1,completedRound:42,result:'victory',active:false},
   authority:{current:{id:'sealed-from-previous-fight',phase:'sealed'}},
   combatants:{oldEnemy:{id:'oldEnemy',hp:0}},
   defeated:{oldEnemy:{id:'oldEnemy',hp:0}},
   reserves:{waitingEnemy:{id:'waitingEnemy',hp:33}},
 };
 await admin('campaña','PUT',campaign);
 const context=await setupContext(browser,true);
 const page=await context.newPage();
 await page.goto(base+'/hoja_de_DM.html');
 await page.evaluate(async credentials=>firebase.auth().signInWithEmailAndPassword(credentials.email,credentials.password),dm);
 await expect(page.locator('#auth-blocker')).toBeHidden({timeout:20000});
 const start=page.locator('#btn-start-encounter');
 await expect(start).toBeVisible({timeout:20000});
 await expect(start).toHaveAttribute('data-bound','true',{timeout:20000});
 await expect(start).toBeEnabled();
 await start.click({timeout:10000});
 await page.waitForTimeout(1400);
 console.log('DM_START_EVIDENCE',JSON.stringify({
   ui:await page.evaluate(()=>({
     authUid:firebase.auth().currentUser?.uid,
     buttonText:document.getElementById('btn-start-encounter')?.textContent,
     buttonBound:document.getElementById('btn-start-encounter')?.dataset.bound,
     status:document.getElementById('dm-encounter-start-status')?.textContent,
     statusHidden:document.getElementById('dm-encounter-start-status')?.hidden,
     instance:document.querySelector('input[name="instancia"]:checked')?.value,
   })),
   stored:(await admin('campaña/combate/estado')),
 }));
 await expect.poll(async()=> (await admin('campaña/combate/estado')).phase,{timeout:25000}).toBe('PRE_COMBAT_PLANNING');
 await expect.poll(async()=> (await admin('campaña/estado_mundo/instancia_activa')),{timeout:20000}).toBe('combate');
 const fresh=await admin('campaña/combate');
 expect(fresh.estado.encounterId).not.toBe('previous-victory');
 expect(fresh.estado.round).toBe(1);
 for(const key of ['authority','playback','combatants','defeated','reserves','readyPlayers','plannedActions'])
   expect(fresh[key]||null,key+' should not leak into a new fight').toBeNull();
 // Reopening the active combat must never recreate its round or delete units.
 await admin('campaña/combate/combatants/test-ally','PUT',{id:'test-ally',faction:'ally',hp:47});
 await admin('campaña/combate/estado/round','PUT',7);
 await start.click({timeout:10000});
 const resumed=await admin('campaña/combate');
 expect(resumed.estado.encounterId).toBe(fresh.estado.encounterId);
 expect(resumed.estado.round).toBe(7);
 expect(resumed.combatants['test-ally'].hp).toBe(47);
 await context.close();
});

test('Studio Combat uses the same live Theatre/Combat Director, retaining encounter while switching views',async({browser})=>{
 test.setTimeout(120000);
 const campaign=clone(initial);
 campaign.estado_mundo.instancia_activa='teatro';
 campaign.combate.estado.round=6;
 // The live adapter syncs the sheet's current HP into its corresponding
 // combatant on initial hydration; seed consistent canonical fixtures.
 campaign.jugadores.p1.hp=43;
 campaign.combate.combatants['player:p1'].hp=43;
 await admin('campaña','PUT',campaign);
 const context=await setupContext(browser);
 try {
 const studio=await context.newPage();
 // pantalla_dm.html deliberately redirects unauthenticated visitors to index:
 // sign in from the established Combat entry first, then enter the DM Studio
 // with the same persisted Firebase auth state.
 await studio.goto(base+'/hoja_de_DM.html',{waitUntil:'domcontentloaded'});
 await studio.evaluate(async credentials=>{
   await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
   await firebase.auth().signInWithEmailAndPassword(credentials.email,credentials.password);
 },dm);
 await studio.waitForFunction(uid=>firebase.auth().currentUser?.uid===uid,dm.uid,{timeout:20000});
 await studio.goto(base+'/pantalla_dm.html',{waitUntil:'domcontentloaded'});
 try {
   await studio.waitForFunction(()=>window.__luminousDmAuthReady===true,{},{timeout:20000});
 } catch(error) {
   const reason=await studio.evaluate(()=>({
     href:location.href,authUid:window.firebase?.auth?.().currentUser?.uid||null,
     authReady:window.__luminousDmAuthReady,dmLoading:document.querySelector('#dm-loading-overlay')?.textContent?.slice(0,280),
     studioStartPresent:!!document.getElementById('dm-studio-start-encounter')
   })).catch(()=>({href:studio.url()}));
   console.error('STUDIO_AUTH_DIAGNOSTIC',JSON.stringify(reason));
   throw error;
 }
 await studio.locator('button.dm-tab-btn[data-tab="tab-combate"]').click({timeout:25000});
 const start=studio.locator('#dm-studio-start-encounter');
 await expect(start).toBeVisible({timeout:25000});
 const directorPromise=context.waitForEvent('page',{timeout:25000});
 await start.click({timeout:20000});
 const director=await directorPromise;
 await director.waitForLoadState('domcontentloaded');
 expect(new URL(director.url()).pathname).toBe('/hoja_de_DM.html');
 await expect.poll(()=>admin('campaña/estado_mundo/instancia_activa'),{timeout:30000}).toBe('combate');
 await expect(director.locator('#modulo-combate')).toHaveClass(/active-module/,{timeout:30000});
 const before=await admin('campaña/combate');
 expect(before.estado.encounterId).toBe('story');
 expect(before.estado.round).toBe(6);
 expect(before.combatants['player:p1'].hp).toBe(43);
 // Theatre is an interlude, not End Combat and not a disconnected second session.
 await director.locator('input[name="instancia"][value="teatro"]').check({timeout:15000});
 await expect.poll(()=>admin('campaña/estado_mundo/instancia_activa'),{timeout:20000}).toBe('combat_theatre');
 await expect(director.locator('#modulo-teatro')).toHaveClass(/active-module/,{timeout:20000});
 const interlude=await admin('campaña/combate');
 expect(interlude.estado.encounterId).toBe(before.estado.encounterId);
 expect(interlude.estado.round).toBe(6);
 expect(interlude.combatants['player:p1'].hp).toBe(43);
 await director.locator('input[name="instancia"][value="combate"]').check({timeout:15000});
 await expect.poll(()=>admin('campaña/estado_mundo/instancia_activa'),{timeout:20000}).toBe('combate');
 await expect(director.locator('#modulo-combate')).toHaveClass(/active-module/,{timeout:20000});
 const resumed=await admin('campaña/combate');
 expect(resumed.estado.encounterId).toBe(before.estado.encounterId);
 expect(resumed.estado.round).toBe(6);
 expect(resumed.combatants['player:p1'].hp).toBe(43);
 const samePages=context.pages().length;
 await start.click({timeout:15000});
 expect(context.pages().length).toBe(samePages);
 await expect.poll(()=>admin('campaña/estado_mundo/instancia_activa'),{timeout:20000}).toBe('combate');
 } finally {
   await context.close();
 }
});


test('ENTRAR A SESIÓN EN VIVO really enters Theatre and recovers a stale Director window without starting combat',async({browser})=>{
 test.setTimeout(125000);
 const campaign=clone(initial);
 campaign.estado_mundo.instancia_activa='teatro';
 campaign.combate.estado.round=9;
 campaign.jugadores.p1.hp=57;
 campaign.combate.combatants['player:p1'].hp=57;
 await admin('campaña','PUT',campaign);
 const context=await setupContext(browser);
 try {
   const studio=await context.newPage();
   await studio.goto(base+'/hoja_de_DM.html',{waitUntil:'domcontentloaded'});
   await studio.evaluate(async credentials=>{
     await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
     await firebase.auth().signInWithEmailAndPassword(credentials.email,credentials.password);
   },dm);
   await studio.goto(base+'/pantalla_dm.html',{waitUntil:'domcontentloaded'});
   await studio.waitForFunction(()=>window.__luminousDmAuthReady===true,{},{timeout:25000});
   const enter=studio.locator('#btn-modo-director');
   await expect(enter).toBeVisible({timeout:20000});
   const newWindow=context.waitForEvent('page',{timeout:20000});
   await enter.click({timeout:20000});
   const director=await newWindow;
   await director.waitForLoadState('domcontentloaded');
   await expect.poll(()=>new URL(director.url()).pathname,{timeout:20000}).toBe('/hoja_de_DM.html');
   await expect(director.locator('#modulo-teatro')).toHaveClass(/active-module/,{timeout:25000});
   await expect(director.locator('#auth-blocker')).toBeHidden({timeout:25000});
   await director.locator('#modulo-teatro > .theatre-dm-menu > summary').click({timeout:20000});
   await expect(director.locator('#theatre-dialogue-input')).toBeVisible({timeout:25000});
   expect(await admin('campaña/estado_mundo/instancia_activa')).toBe('teatro');
   const before=await admin('campaña/combate');
   expect(before.estado.encounterId).toBe('story');
   expect(before.estado.round).toBe(9);
   expect(before.combatants['player:p1'].hp).toBe(57);

   // The regression in #1009: focus() on a stale Window handle was not
   // navigation. The original button must return it to the real Director.
   await director.goto(base+'/index.html',{waitUntil:'domcontentloaded'});
   const existingTabs=context.pages().length;
   await enter.click({timeout:20000});
   await expect.poll(()=>new URL(director.url()).pathname,{timeout:20000}).toBe('/hoja_de_DM.html');
   expect(context.pages().length).toBe(existingTabs);
   await expect(director.locator('#modulo-teatro')).toHaveClass(/active-module/,{timeout:25000});
   const after=await admin('campaña/combate');
   expect(after.estado.encounterId).toBe(before.estado.encounterId);
   expect(after.estado.round).toBe(before.estado.round);
   expect(after.combatants['player:p1'].hp).toBe(before.combatants['player:p1'].hp);
   expect(await admin('campaña/estado_mundo/instancia_activa')).toBe('teatro');
 } finally {
   await context.close();
 }
});

test('DM retires an inaccessible legacy loot queue and Player loses its stale corpse without losing delivered rewards',async({browser},info)=>{
 test.setTimeout(120000);
 const campaign=clone(initial),lootId='legacy-kobold-loot';
 campaign.estado_mundo.instancia_activa='teatro';
 campaign.combate={estado:{phase:'ENDED',result:'victory',active:false,round:1,encounterId:'legacy-loot'}};
 campaign.loot_encounters={'legacy-loot':{meta:{open:true,result:'victory',corpseCount:1},corpses:{kobold:{name:'Kobold',lootInstanceId:lootId}}}};
 campaign.loot_instances={[lootId]:{lootInstanceId:lootId,encounterId:'legacy-loot',locked:true}};
 campaign.loot_postcombat={[lootId]:{lootInstanceId:lootId,carried:[],currency:{remaining:0},harvest:{resources:[]},attempts:{}}};
 await admin('campaña','PUT',campaign);
 const dc=await setupContext(browser),pc=await setupContext(browser,true);
 try{
  const studio=await dc.newPage(),pp=await pc.newPage();
  await studio.goto(base+'/hoja_de_DM.html',{waitUntil:'domcontentloaded'});
  await studio.evaluate(async credentials=>{
   await firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL);
   await firebase.auth().signInWithEmailAndPassword(credentials.email,credentials.password);
  },dm);
  await studio.goto(base+'/pantalla_dm.html',{waitUntil:'domcontentloaded'});
  await studio.waitForFunction(()=>window.__luminousDmAuthReady===true,{},{timeout:25000});
  await studio.locator('.dm-tab-btn[data-tab="tab-loot"]').click({timeout:25000});
  await login(pp,player);
  await pp.locator('#combat-entry-menu > summary').click();
  await expect(pp.locator('#btn-postcombat-loot')).toBeVisible({timeout:25000});
  await pp.locator('#btn-postcombat-loot').click();
  await expect(pp.locator('.loot-corpse')).toHaveCount(1);
  const access=await pp.evaluate(async lootId=>{
   try{await window.LuminousLootLivePostCombatRuntime.checkPlayerLootAccess({playerId:'p1',lootInstanceId:lootId});return 'unexpected';}
   catch(error){return error.message;}
  },lootId);
  expect(access).toContain('participantes');
  const denied=await pp.evaluate(async()=>{
   try{await firebase.database().ref('campaña/loot_encounters/legacy-loot/meta/open').set(false);return false;}
   catch(error){return error.code==='PERMISSION_DENIED';}
  });
  expect(denied).toBe(true);
  const playerBefore=await admin('campaña/jugadores/p1');
  const remove=studio.getByRole('button',{name:'Retirar botín de Kobold',exact:true});
  await expect(remove).toBeVisible({timeout:25000});
  await screenshot(studio,info,'dm-legacy-loot-before-removal');
  studio.once('dialog',dialog=>dialog.dismiss());await remove.click();
  expect((await admin('campaña/loot_encounters/legacy-loot/meta')).open).toBe(true);
  studio.once('dialog',dialog=>dialog.accept());await remove.click();
  await expect.poll(()=>admin('campaña/loot_encounters/legacy-loot/meta/open'),{timeout:15000}).toBe(false);
  await expect(studio.locator('#dm-loot-queues')).toHaveText('No hay botines pendientes.');
  await expect(pp.locator('#postcombat-loot-modal')).not.toBeVisible();
  await expect(pp.locator('#btn-postcombat-loot')).not.toBeVisible();
  expect(await admin('campaña/jugadores/p1')).toEqual(playerBefore);
  const reclose=await studio.evaluate(async()=>window.LuminousLootLivePostCombatRuntime.finalizeEncounterLoot({encounterId:'legacy-loot',result:'victory'}));
  expect(reclose.closed).toBe(true);
  expect(await admin('campaña/loot_encounters/legacy-loot/meta/open')).toBe(false);
  await screenshot(studio,info,'dm-legacy-loot-removed');
 }finally{await Promise.all([dc.close(),pc.close()]);}
});

test('NPC belongings enter live deployment, AI spends its own dose on a wounded ally and only the remaining bag becomes loot',async({browser},info)=>{
 test.setTimeout(150000);
 const campaign=clone(initial),template=corpseCampaign().combate.combatants.kobold;
 delete campaign.combate.combatants.kobold;
 campaign.combate.estado.presentation='simple';
 campaign.base_datos_unidades.qa_carrier={...template,id:'qa_carrier',name:'Goblin de prueba',species:'goblin',creatureType:'humanoid',
  hp:100,maxHp:100,dead:false,defeated:false,battleActive:true,deploymentState:'field',scores:{int:10,wis:12},
  actionSlots:1,skillIds:['enemy_s1'],skillSlotIds:['enemy_s1'],action_slots:['enemy_s1'],speedRange:[5,6],
  lootProfile:{version:1,carried:[{itemId:'hp_generic_pocket_recovery_patch',rarity:'guaranteed',quantity:1}],equipment:{source:'none'},currency:{currencyId:'ahn',min:10,max:20},harvest:{source:'body_profile'},impossibleCategories:[]}};
 await admin('campaña','PUT',campaign);
 const dc=await setupContext(browser),pc=await setupContext(browser);
 try{
  const dp=await dc.newPage(),pp=await pc.newPage();dp.on('dialog',dialog=>dialog.accept());
  await login(dp,dm);const df=await frame(dp);
  await df.waitForFunction(()=>window.LuminousCombat073UnitDeployBridge&&window.LuminousCombatDmSetup073.state.units.qa_carrier);
  await df.locator('#c073-dm-setup > summary').click();
  await df.locator('#c073-unit').selectOption('qa_carrier');await df.locator('#c073-qty').fill('2');await df.locator('#c073-enemy').click();
  await expect.poll(async()=>Object.values((await admin('campaña/combate/combatants'))||{}).filter(unit=>unit.libraryUnitId==='qa_carrier').length,{timeout:25000}).toBe(2);
  let enemies=Object.values(await admin('campaña/combate/combatants')).filter(unit=>unit.libraryUnitId==='qa_carrier');
  const [healer,wounded]=enemies;
  expect(healer.npcBelongings.version).toBe(1);
  const item=Object.values(healer.inventario_activo).find(row=>row.definitionId==='hp_generic_pocket_recovery_patch');
  expect(item.quantity).toBe(1);
  await admin('campaña/combate/combatants/'+wounded.id,'PATCH',{hp:1,scores:{int:5,wis:12}});
  await df.locator('#c073-dm-setup > summary').click();
  await login(pp,player);const pf=await frame(pp);
  await expect.poll(()=>df.evaluate(id=>window.LuminousCombat073.combatants()[id]?.hp,wounded.id),{timeout:20000}).toBe(1);
  await expect.poll(()=>df.evaluate(id=>window.LuminousCombat073.combatants()[id]?.autoPlans?.[0]?.type,healer.id),{timeout:20000}).toBe('items');
  await choose(pf);await waitRound(pf,2);
  await expect.poll(async()=>(await admin('campaña/combate/combatants/'+healer.id+'/inventario_activo/'+item.instanceId+'/quantity')),{timeout:30000}).toBe(0);
  const survivor=await admin('campaña/combate/combatants/'+wounded.id);
  expect(survivor.hp).toBeGreaterThan(1);
  expect(Object.values(survivor.inventario_activo).find(row=>row.definitionId==='hp_generic_pocket_recovery_patch').quantity).toBe(1);
  await screenshot(dp,info,'npc-heals-ally-with-carried-dose');
  const spent=await admin('campaña/combate/combatants/'+healer.id);
  await admin('campaña/combate/defeated/'+healer.id,'PUT',{...spent,hp:0,defeated:true,battleActive:false,deploymentState:'defeated'});
  await admin('campaña/combate/combatants/'+healer.id,'DELETE');
  await endEntry(dp,'victory');
  await expect.poll(()=>admin('campaña/combate/estado/phase'),{timeout:30000}).toBe('ENDED');
  const corpses=Object.values((await admin('campaña/loot_encounters/story/corpses'))||{});
  const corpse=corpses.find(row=>row.sourceUnitInstanceId===healer.id);
  expect(corpse).toBeTruthy();
  const loot=await admin('campaña/loot_instances/'+corpse.lootInstanceId);
  expect((loot.carried||[]).some(row=>row.instanceId===item.instanceId)).toBe(false);
  expect(loot.currency.amount).toBe(spent.carriedCurrency.amount);
 }finally{await Promise.all([dc.close(),pc.close()]);}
});
