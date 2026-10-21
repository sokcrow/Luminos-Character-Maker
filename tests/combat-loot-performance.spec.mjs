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
  Object.defineProperty(window,'LuminousCombatSteps',{configurable:true,get:()=>api,set(value){api=Object.freeze({...value,create(options){const onPresentation=options.onPresentation;return value.create({...options,publish:async()=>{const t=performance.now();await options.publish?.();if(window.__perf?.active)window.__perf.publish.push(performance.now()-t);},onPresentation(cue,args){window.__qaCues.push({cue,at:Date.now(),phase:window.LuminousCombatAuthority073?.state.current?.phase});onPresentation?.(cue,args);}});}});}});
 });
 context.on('page',page=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log('BROWSER',m.type(),m.text());});});return context;
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

// Delays Firebase promise acknowledgements/reads, not animation timers. This
// reproduces awaited WAN round trips without touching a production campaign.
async function instrument(context) {
 await context.addInitScript(() => {
  const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  window.__perf={active:false,operations:[],publish:[],frames:[],longTasks:[]};
  let prior=performance.now();
  function tick(now){const p=window.__perf;if(p.active)p.frames.push(now-prior);prior=now;requestAnimationFrame(tick);}requestAnimationFrame(tick);
  new PerformanceObserver(list=>{if(window.__perf.active)window.__perf.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})));}).observe({type:'longtask',buffered:false});
  let database;
  Object.defineProperty(window,'firebase',{configurable:true,get:()=>database,set(value){database=value;}});
  // Firebase is extended by its own scripts; install after initializeApp, before
  // auth-driven runtime listeners start.
  const timer=setInterval(()=>{
   if(!window.firebase?.database?.Reference)return;
   clearInterval(timer);
   const proto=firebase.database.Reference.prototype;
   for(const method of ['once','update','set','transaction']){
    const original=proto[method];proto[method]=function(...args){
     const p=window.top.__perf?.active?window.top.__perf:window.__perf,op={method,path:this.toString().split('?')[0],start:performance.now(),bytes:method==='update'||method==='set'?JSON.stringify(args[0]??null).length:0};
     if(p.active)p.operations.push(op);
     const result=original.apply(this,args);
     if(!result?.then)return result;
     return result.then(async value=>{if(p.active)await delay(250);op.end=performance.now();return value;});
    };
   }
  },0);

 });
}
async function throttle(context,page){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});return cdp;}
async function startMeasure(frame){await frame.evaluate(()=>{const p=window.__perf;p.operations=[];p.frames=[];p.longTasks=[];p.publish=[];p.active=true;window.__qaCues=[];});}
async function stopMeasure(frame){return frame.evaluate(()=>{const p=window.__perf;p.active=false;const sorted=p.frames.slice().sort((a,b)=>a-b);return {...p,frameP95:sorted[Math.floor(sorted.length*.95)]||0,maxFrame:Math.max(0,...sorted),maxLongTask:Math.max(0,...p.longTasks.map(x=>x.duration)),writes:p.operations.filter(o=>o.method==='update'||o.method==='set').length,writeBytes:p.operations.reduce((n,o)=>n+o.bytes,0),cues:window.__qaCues};});}
function summary(p){return {frameP95:p.frameP95,maxFrame:p.maxFrame,maxLongTask:p.maxLongTask,longTasks:p.longTasks.length,writes:p.writes,writeBytes:p.writeBytes,cues:p.cues.length,publishWaitMs:p.publish.reduce((n,x)=>n+x,0),maxPublishWaitMs:Math.max(0,...p.publish)};}
async function saveMetrics(info,name,metrics){fs.writeFileSync(info.outputPath(name+'.json'),JSON.stringify(metrics,null,2));console.log('PERFORMANCE',name,JSON.stringify({...metrics,authority:summary(metrics.authority),viewer:summary(metrics.viewer)}));}

test('performance: visible combat with one player, one kobold, 1 and 3 coins, then eight enemies',async({browser},info)=>{
 test.setTimeout(300000);
 for(const [coins,enemies] of [[1,1],[3,1],[1,8]]){
  const campaign=clone(initial);
  campaign.jugadores.p1.hp=10000;campaign.jugadores.p1.maxHp=10000;
  campaign.combate.combatants['player:p1'].hp=10000;campaign.combate.combatants['player:p1'].maxHp=10000;
  for(const s of Object.values(campaign.base_datos_skills)){s.coinAmount=coins;s.coins=Array.from({length:coins},()=>({effects:[]}));}
  for(let n=1;n<enemies;n++)campaign.combate.combatants['kobold'+n]={...clone(campaign.combate.combatants.kobold),id:'kobold'+n,name:'Kobold '+n};
  await admin('campaña','PUT',campaign);
  const dc=await setupContext(browser),pc=await setupContext(browser,true);
  await instrument(dc);await instrument(pc);
  try{
   const dp=await dc.newPage(),pp=await pc.newPage();const profiler=await throttle(dc,dp);await throttle(pc,pp);
   await login(dp,dm);const df=await frame(dp);await login(pp,player);const pf=await frame(pp);
   await startMeasure(df);await startMeasure(pf);
   await profiler.send('Profiler.enable');await profiler.send('Profiler.start');
   const t=Date.now();await choose(pf);
   await expect.poll(()=>pf.evaluate(()=>window.__qaCues.some(c=>c.cue==='powerCoin')),{timeout:30000}).toBe(true);
   await screenshot(pp,info,`live-${coins}coins-${enemies}enemies`);
   await waitRound(pf,2);await waitRound(df,2);
   const authority=await stopMeasure(df),viewer=await stopMeasure(pf);
   const profile=await profiler.send('Profiler.stop');fs.writeFileSync(info.outputPath(`cpu-${coins}coins-${enemies}enemies.json`),JSON.stringify(profile.profile));
   const cueSkewMs=Math.max(0,...viewer.cues.map((c,i)=>c.at-(authority.cues[i]?.at||c.at)));
   const metrics={wallMs:Date.now()-t,cueSkewMs,coins,enemies,ackDelayMs:250,cpuRate:4,authority,viewer};
   await saveMetrics(info,`combat-${coins}coins-${enemies}enemies`,metrics);
   await screenshot(pp,info,`combat-${coins}coins-${enemies}enemies`);
   expect(viewer.cues.some(c=>c.cue==='hitMotion')).toBe(true);
   const canonical=await admin('campaña/combate/combatants');
   const view=await pf.evaluate(()=>Object.fromEntries(Object.entries(window.LuminousCombat073.combatants()).map(([id,u])=>[id,u.hp])));
   for(const [id,u]of Object.entries(canonical))expect(view[id]).toBe(u.hp);
   if(!process.env.PERFORMANCE_BASELINE){
    expect(cueSkewMs,'player animation cannot fall seconds behind the authority').toBeLessThan(2000);
    expect(authority.publish.length).toBeGreaterThan(0);
    expect(Math.max(...authority.publish),'network acknowledgement must not gate each visual cue').toBeLessThan(80);
    expect(authority.maxFrame,'no multi-second authority freeze').toBeLessThan(1000);
    expect(viewer.maxFrame,'no multi-second player freeze').toBeLessThan(1000);
   }
  }finally{await dc.close();await pc.close();}
 }
});

test('performance: eight corpses and visible loot to confirmed inventory',async({browser},info)=>{
 test.setTimeout(180000);
 const campaign=corpseCampaign();
 campaign.jugadores.p1.scores={wis:30,int:30};campaign.jugadores.p1.proficiencyBonus=6;campaign.jugadores.p1.proficiencies={skills:{survival:'expertise',investigation:'expertise'}};
 for(let n=1;n<8;n++)campaign.combate.combatants['kobold'+n]={...clone(campaign.combate.combatants.kobold),id:'kobold'+n,name:'Kobold '+n};
 await admin('campaña','PUT',campaign);
 const dc=await setupContext(browser),pc=await setupContext(browser,true);await instrument(dc);await instrument(pc);
 try{
  const dp=await dc.newPage(),pp=await pc.newPage();await throttle(dc,dp);await throttle(pc,pp);
  await login(dp,dm);await frame(dp);await login(pp,player);await frame(pp);
  await startMeasure(dp);await startMeasure(pp);
  let t=Date.now();await endEntry(dp,'victory');
  await expect(pp.locator('#postcombat-loot-modal')).toBeVisible({timeout:40000});
  await expect(pp.locator('.loot-corpse')).toHaveCount(8,{timeout:40000});
  const finalizeMs=Date.now()-t;
  t=Date.now();await pp.locator('[data-loot-action="harvest"]').first().click();
  await expect(pp.locator('#postcombat-loot-message')).toContainText('recuperadas',{timeout:30000});
  const lootMs=Date.now()-t;
  const actor=await admin('campaña/jugadores/p1');
  expect(Object.values(actor.inventario_activo||{}).filter(i=>i.definitionId==='meat_wolf').reduce((n,i)=>n+Number(i.quantity||0),0)).toBe(1);
  const authority=await stopMeasure(dp),viewer=await stopMeasure(pp);
  await saveMetrics(info,'loot',{finalizeMs,lootMs,ackDelayMs:250,cpuRate:4,authority,viewer});
  await screenshot(pp,info,'loot-confirmed-inventory');
  if(!process.env.PERFORMANCE_BASELINE){expect(lootMs).toBeLessThan(6000);expect(finalizeMs).toBeLessThan(10000);}
 }finally{await dc.close();await pc.close();}
});
