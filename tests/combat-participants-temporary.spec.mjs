import {test,expect} from '@playwright/test';import fs from 'node:fs';
if(process.env.QA_CHROME)test.use({launchOptions:{executablePath:process.env.QA_CHROME}});
const DB='http://127.0.0.1:9000/.json?ns=demo-limbus-default-rtdb';
let accounts={};
const request=async(url,body,method='POST')=>{const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(url.startsWith('http://127.0.0.1:9000')?{Authorization:'Bearer owner'}:{})},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;};
test.beforeAll(async()=>{for(const role of ['dm','p1','p2']){const email=`${role}@shared.local`;const data=await request('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{email,password:'qa-pass-123',returnSecureToken:true}).catch(()=>request('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo',{email,password:'qa-pass-123',returnSecureToken:true}));accounts[role]={email,uid:data.localId};}});
const sprite='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="220"><circle cx="60" cy="40" r="25" fill="#b5b5bf"/><path d="M25 205 38 85 82 85 95 205" fill="#774b63"/></svg>');
async function seed(){
 const skills={};for(let tier=1;tier<=3;tier++)skills['s'+tier]={id:'s'+tier,name:'Skill '+tier,kind:'skill',tier,deckCopies:4-tier,basePower:16+tier,coinPower:1,coinAmount:1,damageType:'Blunt',targetSide:'enemy',sinAffinity:'wrath',economyCost:'action'};
 skills.strike={id:'strike',name:'Enemy Strike',kind:'skill',basePower:1,coinPower:1,coinAmount:1,damageType:'Blunt',targetSide:'enemy'};
 const players={},units={};const deck={tier1:'s1',tier2:'s2',tier3:'s3'};
 for(const [index,p]of ['p1','p2','p3','p4','p5','p6','p7','p8'].entries()){
   players[p]={uid:(accounts[p]?.uid||'offline-'+p),characterName:p==='p1'?'LIORA':'EMBER',hp:200,maxHp:200,currentHp:200,sp:10,classes:[{classId:'fighter',levels:1}],characterBuild:{skillDeck:deck},skillDeck:deck,skillIds:['s1','s2','s3'],equippedSkillIndex:{s1:true,s2:true,s3:true},combatSprite:sprite};
   units['player:'+p]={...players[p],id:'player:'+p,name:players[p].characterName,actorCategory:'player',category:'player',canonicalScope:'player',isPlayer:true,canonicalPlayerKey:p,ownerPlayerId:p,playerId:p,canonicalOwnerUid:(accounts[p]?.uid||'offline-'+p),ownerUid:(accounts[p]?.uid||'offline-'+p),faction:'ally',actionSlots:1,activeSlots:1,actionSlotIndex:{0:true},battleActive:true,speedRange:[9-index,9-index],staggerThresholds:[1],level:1,offensiveLevel:1,defensiveLevel:1};
 }
 delete units['player:p8'];
 Object.assign(units['player:p2'],{deploymentState:'reserve'});
 Object.assign(units['player:p3'],{removed:true});
 Object.assign(units['player:p4'],{escaped:true});
 Object.assign(units['player:p5'],{defeated:true});
 Object.assign(units['player:p6'],{dead:true});
 delete units['player:p7'].battleActive;
 for(let i=1;i<=1;i++)units['enemy:e'+i]={id:'enemy:e'+i,name:'KOBOLD '+i,faction:'enemy',actorCategory:'enemy',category:'enemy',isPlayer:false,battleActive:true,actionSlots:1,activeSlots:1,hp:200,maxHp:200,sp:0,speedRange:[1,1],skillIds:['strike'],equippedSkillIndex:{strike:true},combatSprite:sprite,staggerThresholds:[1],level:1,offensiveLevel:1,defensiveLevel:1};
 await request(DB,{'campaña':{config:{dm_uid:accounts.dm.uid},estado_mundo:{instancia_activa:'combate'},jugadores:players,base_datos_skills:skills,combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1,encounterId:'shared-deck-qa'},combatants:units}}},'PUT');
}
async function open(browser,role,viewport,existingContext=null,view='battle'){
 const context=existingContext||await browser.newContext({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900});const page=await context.newPage();page.setDefaultTimeout(20000);page.errors=[];page.blocked=[];
 page.on('pageerror',e=>{page.errors.push(e.message);console.log(role,'PAGEERROR',e.message)});page.on('console',m=>{if(m.type()==='error')console.log(role,'CONSOLE',m.text())});
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url.endsWith('/participants-player-harness.html'))return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><meta charset="utf-8"></head><body><section id="theatre-view-player" style="display:none">TEATRO · Tu escena continúa</section><div id="player-instance-blackout"></div><script src="/js/combat-firebase-config.js"></script><script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script><script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js"></script><script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-database.js"></script><script src="/js/combat-participants.js"></script><script src="/js/instance-control.js"></script><script>window.LuminousGameLoading={waitForTheatre:async()=>true,waitForCombatFrame:async()=>true};LuminousInstanceControl.bindPlayer({db:firebase.database()});</script></body></html>`});
  if(process.env.QA_BASELINE&&url.endsWith('/js/combat-v073-plan-sync.js'))return route.fulfill({contentType:'application/javascript',body:fs.readFileSync('.qa-sdk/plan-sync-baseline.js','utf8')});
  if(url.includes('/js/combat-firebase-config.js'))return route.fulfill({contentType:'application/javascript',body:`window.LuminousCombatFirebaseConfig={apiKey:'demo',projectId:'demo-limbus',authDomain:'demo-limbus.firebaseapp.com',databaseURL:'https://demo-limbus-default-rtdb.firebaseio.com'};`});
  const sdk=url.match(/firebase-(app|auth|database)\.js/);
  if(sdk){let body=fs.readFileSync(`.qa-sdk/firebase-${sdk[1]}.js`,'utf8');if(sdk[1]==='database')body+=`\n firebase.initializeApp(window.LuminousCombatFirebaseConfig);firebase.auth().useEmulator('http://127.0.0.1:9099',{disableWarnings:true});firebase.database().useEmulator('127.0.0.1',9000);firebase.auth().signInWithEmailAndPassword('${accounts[role].email}','qa-pass-123');`;return route.fulfill({contentType:'application/javascript',body});}
  if(url.startsWith('http://127.0.0.1:4173')||url.startsWith('http://127.0.0.1:9000')||url.startsWith('http://127.0.0.1:9099'))return route.continue();
  if(/firebaseio|identitytoolkit\.googleapis|securetoken\.googleapis|firebasedatabase/.test(url))page.blocked.push(url);
  return route.abort();
 });
 await page.goto(view==='theatre'?'http://127.0.0.1:4173/participants-player-harness.html':view==='entry'?'http://127.0.0.1:4173/combate.html':'http://127.0.0.1:4173/Battle-viewer.html',{waitUntil:'domcontentloaded'});
 if(view!=='battle')return page;
 await page.waitForFunction(wanted=>window.LuminousCombatLiveAdapter073?.state.role===wanted&&window.LuminousCombat073?.combatants()?.['enemy:e1']&&window.LuminousCombatEconomyMenu073?.state.installed,role==='dm'?'dm':'player',{timeout:45000});
 await page.waitForFunction(()=>window.LuminousCombatLiveAdapter073.state.skills.s3&&window.LuminousCombatRemoteIntents073?.state.planningAi.signature,null,{timeout:30000});
 await page.waitForFunction(()=>!document.querySelector('#game-container.intro-running')&&!document.querySelector('#turn-transition.active'),null,{timeout:15000});
 return page;
}
const hands=page=>page.evaluate(()=>{const id=window.LuminousCombat073.playerId();return window.LuminousCombatSlotDeck073.hand(id,0).map(c=>({id:c.skillId,drawId:c.drawId}));});
async function select(page,target){
 const before=await hands(page);
 await page.locator('.command[data-menu=skills]').click();
 await expect(page.locator('#category-body .skill-option')).toHaveCount(2);
 expect(await page.locator('#category-body .skill-option').first().getAttribute('data-deck-draw-id')).toBeTruthy();
 await page.locator('#category-body .skill-option').nth(1).click();await page.locator('#action-confirm').click();
 const mobile=page.viewportSize().width<900;
 if(mobile)await page.locator('#combat-target-list button').filter({hasText:target}).first().click();
 else {
  // The game's capture handler deliberately resolves slots through overlapping token boxes.
  await page.waitForTimeout(700);const slot=page.locator('.action-slot-wrapper.target-valid[data-owner-id="'+target.replace('KOBOLD ','enemy:e')+'"]').first();await expect(slot).toBeVisible();const box=await slot.boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);
 }
 if(await page.locator('#clash-forecast-confirm').isVisible())await page.locator('#clash-forecast-confirm').click();
 await page.waitForTimeout(700);return before;
}

for(const mobile of [false,true])test(`Eight campaign players, one combat participant (${mobile?'mobile':'desktop'})`,async({browser})=>{
 test.setTimeout(360000);await seed();fs.mkdirSync('artifacts/shared-planning',{recursive:true});let dm,p1,p2,entry;
 try{
  dm=await open(browser,'dm',{width:1365,height:768});p1=await open(browser,'p1',mobile?{width:390,height:844}:{width:1280,height:800});
  p2=await open(browser,'p2',{width:844,height:390},null,'theatre');
  await expect(p2.locator('body')).toHaveClass(/player-instance-theatre/);await expect(p2.locator('#theatre-view-player')).toBeVisible();await expect(p2.locator('#player-instance-combat')).toHaveCount(0);
  entry=await open(browser,'p2',{width:844,height:390},null,'entry');await expect(entry.locator('#combat-entry-message')).toContainText('permanece en teatro');await expect(entry.locator('#combat-entry-view')).toHaveCount(0);await entry.context().close();entry=null;
  const field=await dm.evaluate(()=>Object.keys(LuminousCombat073.combatants()).sort());expect(field).toEqual(['enemy:e1','player:p1']);
  await expect(dm.locator('#combat-phase-label')).toContainText('0/1');expect(await dm.evaluate(()=>LuminousCombatParticipants.playerIds(LuminousCombatLiveAdapter073.state.combatants))).toEqual(['p1']);
  await select(p1,'KOBOLD 1');await p1.locator('#ready').click();
  for(const page of [dm,p1])await page.waitForFunction(()=>LuminousCombat073.uiState().round>=2&&!LuminousCombat073.uiState().running,null,{timeout:120000});
  await expect(p2.locator('#player-instance-combat')).toHaveCount(0);await expect(p2.locator('#theatre-view-player')).toBeVisible();
  await dm.screenshot({path:`artifacts/shared-planning/${mobile?'mobile':'desktop'}-one-participant-dm.png`});await p1.screenshot({path:`artifacts/shared-planning/${mobile?'mobile':'desktop'}-one-participant.png`});await p2.screenshot({path:`artifacts/shared-planning/${mobile?'mobile':'desktop'}-nonparticipant-theatre.png`});
  for(const name of ['one-participant-dm','one-participant','nonparticipant-theatre'])console.log('QA_IMAGE:'+JSON.stringify({mobile,name,data:fs.readFileSync(`artifacts/shared-planning/${mobile?'mobile':'desktop'}-${name}.png`).toString('base64')}));
  await dm.locator('#c073-dm-setup summary').click();await dm.locator('#c073-player').selectOption('p2');await dm.locator('#c073-add-player').click();
  await expect(p2.locator('body')).toHaveClass(/player-instance-combat/);await expect(p2.locator('#player-instance-combat')).toHaveCount(1);
  const f=p2.frameLocator('#player-instance-combat');await expect(f.locator('#ready')).toBeVisible({timeout:45000});
  await expect(dm.locator('.combat-participant-progress')).toContainText('Participantes: 2');await expect(dm.locator('#combat-phase-label')).toContainText('0/2');
  await p1.locator('#ready').click();await expect(dm.locator('#combat-phase-label')).toContainText('1/2');expect(await dm.evaluate(()=>LuminousCombat073.uiState().round)).toBe(2);
  await f.locator('#ready').click();for(const page of [dm,p1])await page.waitForFunction(()=>LuminousCombat073.uiState().round>=3&&!LuminousCombat073.uiState().running,null,{timeout:120000});
  await dm.locator('[data-remove="player:p2"]').click();await expect(p2.locator('body')).toHaveClass(/player-instance-theatre/);await expect(p2.locator('#player-instance-combat')).toHaveCount(0);await expect(p2.locator('#theatre-view-player')).toBeVisible();
  await expect(dm.locator('.combat-participant-progress')).toContainText('Participantes: 1');await p1.locator('#ready').click();await dm.waitForFunction(()=>LuminousCombat073.uiState().round>=4&&!LuminousCombat073.uiState().running,null,{timeout:120000});
  for(const page of [dm,p1,p2]){expect(page.errors).toEqual([]);expect(page.blocked).toEqual([]);}
  console.log(JSON.stringify({mobile,campaignPlayers:8,initialParticipants:1,soloRoundCompleted:true,lateEntryRequiresReady:true,removalReturnsToTheatre:true,errors:[]}));
 }catch(error){for(const [name,page]of [['dm',dm],['p1',p1],['p2',p2]])if(page&&!page.isClosed()){await page.screenshot({path:`artifacts/shared-planning/${mobile?'mobile':'desktop'}-${name}-failure.png`});console.log(name,await page.evaluate(()=>({auth:window.firebase?.auth?.()?.currentUser?.uid,body:document.body.className,errors:window.__qaErrors,state:window.LuminousCombat073?.uiState(),phase:document.getElementById('combat-phase-label')?.textContent,status:document.getElementById('status')?.textContent})));}throw error;}
 finally{for(const page of [dm,p1,p2,entry])await page?.context().close();}
});
