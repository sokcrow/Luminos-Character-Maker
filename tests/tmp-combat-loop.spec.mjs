import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
const root=process.cwd(),project='demo-combat-loop',ns=project+'-default-rtdb',base='http://127.0.0.1:4173';
let server,dm,player,friend,initial;const errors=[],production=[];
const clone=v=>JSON.parse(JSON.stringify(v));
const endpoint=p=>`http://127.0.0.1:9100/${p.split('/').map(encodeURIComponent).join('/')}.json?ns=${ns}`;
async function admin(p,method='GET',value){const r=await fetch(endpoint(p),{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})});expect(r.ok,await r.clone().text()).toBeTruthy();return r.json();}
async function account(label){const email=label+'@example.test',password='temporary-password';const r=await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});const data=await r.json();expect(data.localId).toBeTruthy();return {uid:data.localId,email,password,token:data.idToken};}
function fixture(){
 const potion={instanceId:'potion',definitionId:'hp_generic_pocket_recovery_patch',category:'consumable',quantity:2,runtime:{actionCost:'action',targetMode:'self',consumeQty:1,healing:{flat:2,maxHpPercent:3,capMaxHpPercent:100}}};
 const p={uid:player.uid,characterName:'LIORA',hp:130,maxHp:130,actionSlots:1,characterBuild:{skillDeck:{tier1:'s1',tier2:'s2',tier3:'s3'}},inventario_activo:{potion}};
 const units={'player:p1':{...clone(p),id:'player:p1',combatId:'player:p1',isPlayer:true,canonicalScope:'player',canonicalPlayerKey:'p1',canonicalOwnerUid:player.uid,ownerPlayerId:'p1',ownerUid:player.uid,playerId:'p1',category:'player',faction:'ally',battleActive:true,isBackup:false,deploymentState:'field',skillIds:['s1','s2','s3'],skillSlotIds:['s1','s1','s1','s2','s2','s3'],equippedSkillIndex:{s1:true,s2:true,s3:true},actionSlotIndex:{0:true},usableItemIndex:{potion:true}},kobold:{id:'kobold',name:'Kobold',isPlayer:false,category:'enemy',faction:'enemy',battleActive:true,isBackup:false,deploymentState:'field',hp:1000,maxHp:1000,actionSlots:1,skillIds:['enemy_s1'],equippedSkillIndex:{enemy_s1:true},actionSlotIndex:{0:true},level:1}};
 const skills={};for(const [i,id]of ['s1','s2','s3'].entries())skills[id]={id,name:'Strike '+id,kind:'skill',tier:i+1,basePower:12+i,coinPower:2,coinAmount:1,damageType:'Blunt',sinAffinity:'wrath',effects:[],coins:[{effects:[]}]};skills.enemy_s1={id:'enemy_s1',name:'Kobold Strike',kind:'skill',basePower:2,coinPower:1,coinAmount:1,damageType:'Blunt',sinAffinity:'wrath',effects:[],coins:[{effects:[]}]};
 const players={p1:p,p2:{uid:friend.uid,name:'Other player'}};for(let i=3;i<=8;i++)players['p'+i]={uid:'absent'+i,name:'Absent '+i};
 return {config:{dm_uid:dm.uid},estado_mundo:{instancia_activa:'combate'},jugadores:players,base_datos_skills:skills,base_datos_unidades:{},actores:{},combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1,active:true,encounterId:'story',presentation:'simple'},combatants:units}};
}
async function setupContext(browser,phone=false){
 const context=await browser.newContext({viewport:phone?{width:390,height:844}:{width:1280,height:800},reducedMotion:'reduce'});
 await context.route('**/*',async route=>{
  const url=route.request().url();const match=url.match(/firebasejs\/8\.10\.1\/(firebase-[a-z]+\.js)/);
  if(match){let body=fs.readFileSync(path.join(root,'node_modules/firebase',match[1]),'utf8');if(match[1]==='firebase-app.js')body+=`\n(function(){const original=firebase.initializeApp;firebase.initializeApp=function(config,name){const app=original.call(firebase,{...config,apiKey:'fake',projectId:'${project}',databaseURL:'https://${ns}.firebaseio.com'},name);app.auth().useEmulator('http://127.0.0.1:9199',{disableWarnings:true});app.database().useEmulator('127.0.0.1',9100);return app;};})();`;await route.fulfill({contentType:'text/javascript',body});return;}
  if(/firebaseio\.com|googleapis\.com/.test(url)&&!url.includes('127.0.0.1')){production.push(url);await route.abort();return;}
  if(!url.startsWith(base)&&!url.startsWith('http://127.0.0.1:9')&&!url.startsWith('data:')){await route.abort();return;}
  await route.continue();
 });
 context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));return context;
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
 await f.evaluate(kind=>{
  const r=window.LuminousCombat073,s=window.LuminousCombatLiveAdapter073.state,unit=r.combatants()[r.playerId()];let plan;
  if(kind==='skill'){const card=window.LuminousCombatSlotDeck073.hand(unit.id,0)[0];if(!card)throw Error('No deck hand');plan={type:'deck',sourceSlotIndex:0,drawId:card.drawId,targetId:'kobold',targetSlotIndex:0,clashChoice:'clash',clashConfirmed:true,data:card.skill};}
  else if(kind==='item'){const item=window.LuminousCombatEconomyMenu073.rowsFor('items')[0];if(!item)throw Error('No active inventory item');plan={type:'items',sourceSlotIndex:0,targetId:unit.id,targetSlotIndex:0,data:item};}
  else plan={type:'global',sourceSlotIndex:0,targetId:unit.id,targetSlotIndex:0,data:{id:'help',actionKey:'help',name:'Help',kind:'global'}};
  r.restorePlanning([plan],false);
 },kind);await f.locator('#ready').click({force:true});
}
test.beforeAll(async()=>{
 server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,base).pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(p,(error,body)=>{if(error){res.writeHead(404).end();return;}const ext=path.extname(p);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[ext]||'application/octet-stream');res.end(body);});});await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
 dm=await account('dm');player=await account('player');friend=await account('friend');initial=fixture();
});
test.afterAll(async()=>{await new Promise(resolve=>server.close(resolve));expect(production).toEqual([]);expect(errors).toEqual([]);});
test('Story: READY, same-player PC/phone, Clash, damage, items, global actions and canonical end',async({browser},info)=>{
 test.setTimeout(240000);await admin('campaña','PUT',initial);
 const dc=await setupContext(browser),pc=await setupContext(browser),cc=await setupContext(browser,true);
 const dp=await dc.newPage(),pp=await pc.newPage(),cp=await cc.newPage();await login(pp,player);const pf=await frame(pp);await login(cp,player);const cf=await frame(cp);
 await choose(cf);await expect.poll(async()=> (await admin('campaña/combate/readyPlayers/p1'))?.ready,{timeout:12000}).toBe(true);
 await expect.poll(()=>pf.evaluate(()=>window.LuminousCombat073.uiState().ready),{timeout:15000}).toBe(true);
 await info.attach('phone-ready',{body:await cp.screenshot(),contentType:'image/png'});
 await login(dp,dm);const df=await frame(dp);
 await expect.poll(async()=> (await admin('campaña/combate/estado'))?.round,{timeout:60000}).toBe(2);
 expect((await admin('campaña/combate/combatants/kobold')).hp).toBeLessThan(1000);
 await expect.poll(()=>pf.evaluate(()=>window.LuminousCombat073.uiState().round),{timeout:20000}).toBe(2);
 for(const kind of ['skill','item','global']){
  const round=(await admin('campaña/combate/estado')).round;
  await expect.poll(()=>cf.evaluate(()=>window.LuminousCombat073.uiState().round),{timeout:20000}).toBe(round);
  await choose(cf,kind);
  await expect.poll(async()=> (await admin('campaña/combate/estado'))?.round,{timeout:60000}).toBe(round+1);
 }
 const state=await admin('campaña/combate/estado');expect(state.active).toBe(true);expect(state.round).toBe(5);expect(await admin('campaña/combate/readyPlayers')).toBeNull();
 await info.attach('dm-round-five',{body:await dp.screenshot(),contentType:'image/png'});
 await df.evaluate(()=>window.LuminousBattleViewerDmConsole074.finishEncounter('cancelled',{confirm:false,displayMs:0,blackoutMs:0}));
 expect((await admin('campaña/combate/estado')).phase).toBe('ENDED');expect(await admin('campaña/estado_mundo/instancia_activa')).toBe('teatro');
 console.log('STORY_PASS',JSON.stringify({round:state.round,activeBetweenRounds:state.active,onlyOneOfEightRequired:true,phoneAndPc:true,skillsItemsGlobals:true}));
 await Promise.all([dc.close(),pc.close(),cc.close()]);
});
test('Online and local encounters keep independent state and authority',async({browser},info)=>{
 test.setTimeout(180000);await admin('campaña','PUT',initial);const untouched=await admin('campaña/combate');
 function record(hostUid,recordId){const state={'campaña':clone(initial)};state['campaña'].config.dm_uid=hostUid;state['campaña'].jugadores={p1:clone(initial.jugadores.p1)};state['campaña'].combate.estado.encounterId=recordId;return {hostUid,members:{[hostUid]:true,[player.uid]:true},mode:'online',state};}
 const a=record(player.uid,'mirror-a'),b=record(dm.uid,'mirror-b');await admin('campaña/encuentros/mirror-a','PUT',a);await admin('campaña/encuentros/mirror-b','PUT',b);
 const context=await setupContext(browser,true),page=await context.newPage();await login(page,player,'/mirror.html?encounter=mirror-a');const f=await frame(page);
 expect(await f.evaluate(()=>window.LuminousCombatLiveAdapter073.state.isAuthority)).toBe(true);
 expect(await f.evaluate(()=>window.LuminousCombatLiveAdapter073.state.role)).toBe('player');
 await choose(f);await expect.poll(async()=> (await admin('campaña/encuentros/mirror-a/state/campaña/combate/estado'))?.round,{timeout:60000}).toBe(2);
 expect(await admin('campaña/combate')).toEqual(untouched);expect((await admin('campaña/encuentros/mirror-b/state/campaña/combate/estado')).round).toBe(1);
 const scoped=await admin('campaña/encuentros/mirror-a');scoped.mode='local';scoped.state['campaña'].combate.estado.encounterId='local-a';
 const localContext=await setupContext(browser),lp=await localContext.newPage();await localContext.addInitScript(record=>localStorage.setItem('luminous:encounter:local-a',JSON.stringify(record)),scoped);
 await lp.goto(base+'/mirror.html?encounter=local-a&mode=local');const lf=await frame(lp);const beforeRequests=production.length;
 await choose(lf);await expect.poll(()=>lf.evaluate(()=>window.LuminousCombat073.uiState().round),{timeout:60000}).toBe(3);
 expect(production.length).toBe(beforeRequests);expect(await admin('campaña/combate')).toEqual(untouched);expect((await admin('campaña/encuentros/mirror-a/state/campaña/combate/estado')).round).toBe(2);
 await info.attach('local-next-turn',{body:await lp.screenshot(),contentType:'image/png'});
 console.log('ISOLATION_PASS',JSON.stringify({storyUnchanged:true,otherEncounterUnchanged:true,hostCanPlayAndResolve:true,localNextTurn:3}));
 await Promise.all([context.close(),localContext.close()]);
});
