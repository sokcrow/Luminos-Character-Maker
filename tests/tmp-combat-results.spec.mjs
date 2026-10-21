import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root=process.cwd(),project='demo-combat-results',ns=project+'-default-rtdb',base='http://127.0.0.1:4173';
let server,dm,player,friend,initial;const errors=[],production=[];
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
async function setupContext(browser,phone=false){
 const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:800},reducedMotion:'no-preference'});
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
 context.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')console.log('BROWSER',m.type(),m.text());});});return context;
}
async function login(page,user,url='/combate.html'){
 await page.goto(base+url);const form=url.startsWith('/mirror')?'mirror':'combat-entry';await page.locator('#'+form+'-email').fill(user.email);await page.locator('#'+form+'-password').fill(user.password);await page.locator('#'+form+'-login button').click();
}
async function frame(page,query='Battle-viewer'){
 await expect.poll(()=>page.frames().filter(f=>f.url().includes(query)).length,{timeout:40000}).toBeGreaterThan(0);const f=page.frames().find(f=>f.url().includes(query));
 await f.waitForFunction(()=>window.LuminousCombatLiveAdapter073?.state.hydratedOnce&&window.LuminousCombat073?.playerId?.(),{},{timeout:60000});
 await f.waitForFunction(()=>window.LuminousCombatAuthority073&&window.LuminousCombatRemoteIntents073&&window.LuminousCombatSlotDeck073&&window.LuminousCombatPlanSync073,{},{timeout:40000});return f;
}
async function choose(f,kind='skill'){
 await expect(f.locator('#ready')).toBeEnabled({timeout:20000});
 await f.waitForFunction(()=>!document.getElementById('game-container')?.classList.contains('intro-running')&&!window.LuminousCombat073.uiState().running&&window.LuminousCombatEconomyMenu073?.rowsFor,{},{timeout:20000});
 await f.evaluate(kind=>{
  const r=window.LuminousCombat073,s=window.LuminousCombatLiveAdapter073.state,unit=r.combatants()[r.playerId()];let plan;
  if(kind==='skill'){const card=window.LuminousCombatSlotDeck073.hand(unit.id,0)[0];if(!card)throw Error('No deck hand');plan={type:'deck',sourceSlotIndex:0,drawId:card.drawId,targetId:'kobold',targetSlotIndex:0,clashChoice:'clash',clashConfirmed:true,data:card.skill};}
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
test('PC and phone present live Clash cues while the DM is resolving, then converge',async({browser},info)=>{
 test.setTimeout(150000);await admin('campaña','PUT',initial);
 const dc=await setupContext(browser),pc=await setupContext(browser),cc=await setupContext(browser,true);
 const dp=await dc.newPage(),pp=await pc.newPage(),cp=await cc.newPage();
 await login(dp,dm);const df=await frame(dp);await login(pp,player);const pf=await frame(pp);await login(cp,player);const cf=await frame(cp);
 await choose(cf);
 for(const f of [pf,cf])await expect.poll(()=>f.evaluate(()=>window.__qaCues.some(c=>c.cue==='clashStart')),{timeout:30000}).toBe(true);
 expect(await df.evaluate(()=>window.LuminousCombatAuthority073.state.runningLocal)).toBe(true);
 const times=await Promise.all([df,pf,cf].map(f=>f.evaluate(()=>window.__qaCues.find(c=>c.cue==='clashStart').at)));
 expect(Math.max(...times)-Math.min(...times)).toBeLessThan(2000);
 await expect.poll(()=>cf.evaluate(()=>window.__qaCues.some(c=>c.cue==='powerCoin')),{timeout:15000}).toBe(true);
 await screenshot(cp,info,'phone-live-clash');await screenshot(pp,info,'pc-live-clash');await screenshot(dp,info,'dm-live-clash');
 await expect.poll(async()=> (await admin('campaña/combate/estado')).round,{timeout:90000}).toBe(2);
 await Promise.all([waitRound(pf,2),waitRound(cf,2)]);
 const canonical=(await admin('campaña/combate/combatants/kobold')).hp;
 for(const f of [pf,cf]){
  const data=await f.evaluate(()=>({hp:window.LuminousCombat073.combatants().kobold.hp,cues:window.__qaCues.map(c=>c.cue)}));
  expect(data.hp).toBe(canonical);expect(data.cues).toContain('hitMotion');expect(data.cues).toContain('clashEnd');
 }
 console.log('LIVE_CUES_PASS',JSON.stringify({cueSkewMs:Math.max(...times)-Math.min(...times),pcAndPhone:true,finalHp:canonical}));
 await Promise.all([dc.close(),pc.close(),cc.close()]);
});
test('Victory saves a real corpse and both outcomes close through production controls',async({browser},info)=>{
 test.setTimeout(180000);
 for(const result of ['victory','defeat']){
  await admin('campaña','PUT',result==='victory'?corpseCampaign():initial);
  const c=await setupContext(browser),p=await c.newPage();p.on('dialog',d=>d.dismiss());
  await login(p,dm);let f=await frame(p);
  if(result==='defeat'){
   await p.goto(base+'/pantalla_dm.html');await p.evaluate(()=>window.hideLoadingOverlay?.());
   await p.locator('[data-tab="tab-combate"]').click();f=await frame(p);
   await p.locator('#dm-combat-end-encounter').click();await p.locator('#dm-combat-end-defeat').click();
  }else await endEntry(p,result);
  await expect.poll(async()=> (await admin('campaña/combate/estado')).phase,{timeout:40000}).toBe('ENDED');
  await expect.poll(()=>f.evaluate(()=>document.getElementById('combat-encounter-result-overlay')?.dataset.result),{timeout:10000}).toBe(result);
  await screenshot(p,info,result+'-result');
  await expect.poll(()=>admin('campaña/estado_mundo/instancia_activa'),{timeout:15000}).toBe('teatro');
  if(result==='victory'){
   expect((await admin('campaña/loot_encounters/story/meta')).corpseCount).toBe(1);
   expect(Object.keys(await admin('campaña/loot_instances')).length).toBe(1);
   await f.evaluate(()=>window.LuminousBattleViewerDmConsole074.finishEncounter('victory',{confirm:false,displayMs:0,blackoutMs:0}));
   expect(Object.keys(await admin('campaña/loot_instances')).length).toBe(1);
  }
  console.log('OUTCOME_PASS',result);await c.close();
 }
});
test('Missing loot permission is reported and a failed Victory can recover as Defeat',async({browser},info)=>{
 test.setTimeout(90000);const rules=JSON.parse(fs.readFileSync('database.rules.json','utf8')),old=clone(rules);
 for(const key of ['loot_instances','loot_postcombat','loot_encounters'])delete old.rules['campaña'][key];
 await setRules(old);
 try{
  await admin('campaña','PUT',corpseCampaign());const c=await setupContext(browser),p=await c.newPage(),alerts=[];
  p.on('dialog',async d=>{alerts.push(d.message());await d.dismiss();});await login(p,dm);const f=await frame(p);
  await endEntry(p,'victory');
  await expect.poll(async()=> (await admin('campaña/combate/estado/ending'))?.failed,{timeout:40000}).toBe(true);
  await expect.poll(()=>alerts.join(' ')).toContain('reglas actualizadas');
  await p.locator('#combat-entry-result').selectOption('defeat');await p.locator('#combat-entry-confirm-end').click();
  await expect.poll(async()=> (await admin('campaña/combate/estado')).result,{timeout:15000}).toBe('defeat');
  await expect.poll(()=>admin('campaña/estado_mundo/instancia_activa'),{timeout:15000}).toBe('teatro');
  console.log('FAILED_VICTORY_RECOVERY_PASS');await c.close();
 }finally{await setRules(rules);}
});
test('DM takeover discards partial presentation and clients resume the new generation',async({browser},info)=>{
 test.setTimeout(150000);await admin('campaña','PUT',initial);
 const pc=await setupContext(browser,true),dc=await setupContext(browser),pp=await pc.newPage(),dp=await dc.newPage();
 await login(dp,dm);const df=await frame(dp);await login(pp,player);const pf=await frame(pp);await choose(pf);
 await expect.poll(()=>pf.evaluate(()=>window.__qaCues.some(c=>c.cue==='clashStart')),{timeout:30000}).toBe(true);
 const generation=(await admin('campaña/combate/authority/current')).id;await dc.close();
 const rc=await setupContext(browser),rp=await rc.newPage();await login(rp,dm);const rf=await frame(rp);
 await rf.locator('#resume-combat-round').click();
 await expect.poll(async()=> (await admin('campaña/combate/estado')).round,{timeout:90000}).toBe(2);
 await waitRound(pf,2);
 const current=await admin('campaña/combate/authority/current');expect(current.id).not.toBe(generation);
 expect(await pf.evaluate(()=>window.LuminousCombat073.combatants().kobold.hp)).toBe((await admin('campaña/combate/combatants/kobold')).hp);
 await screenshot(pp,info,'phone-after-takeover');console.log('RECOVERY_PASS',JSON.stringify({generationChanged:true,round:2}));
 await Promise.all([pc.close(),rc.close()]);
});

