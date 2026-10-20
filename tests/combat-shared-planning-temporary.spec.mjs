import {test,expect} from '@playwright/test';import fs from 'node:fs';
const DB='http://127.0.0.1:9000/.json?ns=demo-limbus-default-rtdb';
let accounts={};
const request=async(url,body,method='POST')=>{const r=await fetch(url,{method,headers:{'Content-Type':'application/json',...(url.startsWith('http://127.0.0.1:9000')?{Authorization:'Bearer owner'}:{})},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;};
test.beforeAll(async()=>{for(const role of ['dm','p1','p2']){const email=`${role}@shared.local`;const data=await request('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{email,password:'qa-pass-123',returnSecureToken:true}).catch(()=>request('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo',{email,password:'qa-pass-123',returnSecureToken:true}));accounts[role]={email,uid:data.localId};}});
const sprite='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="220"><circle cx="60" cy="40" r="25" fill="#b5b5bf"/><path d="M25 205 38 85 82 85 95 205" fill="#774b63"/></svg>');
async function seed(){
 const skills={};for(let tier=1;tier<=3;tier++)skills['s'+tier]={id:'s'+tier,name:'Skill '+tier,kind:'skill',tier,deckCopies:4-tier,basePower:16+tier,coinPower:1,coinAmount:1,damageType:'Blunt',targetSide:'enemy',sinAffinity:'wrath',economyCost:'action'};
 skills.strike={id:'strike',name:'Enemy Strike',kind:'skill',basePower:1,coinPower:1,coinAmount:1,damageType:'Blunt',targetSide:'enemy'};
 const players={},units={};const deck={tier1:'s1',tier2:'s2',tier3:'s3'};
 for(const [index,p]of ['p1','p2'].entries()){
   players[p]={uid:accounts[p].uid,characterName:p==='p1'?'LIORA':'EMBER',hp:200,maxHp:200,currentHp:200,sp:10,classes:[{classId:'fighter',levels:1}],characterBuild:{skillDeck:deck},skillDeck:deck,skillIds:['s1','s2','s3'],equippedSkillIndex:{s1:true,s2:true,s3:true},combatSprite:sprite};
   units['player:'+p]={...players[p],id:'player:'+p,name:players[p].characterName,actorCategory:'player',category:'player',canonicalScope:'player',isPlayer:true,canonicalPlayerKey:p,ownerPlayerId:p,playerId:p,canonicalOwnerUid:accounts[p].uid,ownerUid:accounts[p].uid,faction:'ally',actionSlots:1,activeSlots:1,actionSlotIndex:{0:true},battleActive:true,speedRange:[9-index,9-index],staggerThresholds:[1],level:1,offensiveLevel:1,defensiveLevel:1};
 }
 for(let i=1;i<=2;i++)units['enemy:e'+i]={id:'enemy:e'+i,name:'GUARDIAN '+i,faction:'enemy',actorCategory:'enemy',category:'enemy',isPlayer:false,battleActive:true,actionSlots:1,activeSlots:1,hp:200,maxHp:200,sp:0,speedRange:[1,1],skillIds:['strike'],equippedSkillIndex:{strike:true},combatSprite:sprite,staggerThresholds:[1],level:1,offensiveLevel:1,defensiveLevel:1};
 await request(DB,{'campaña':{config:{dm_uid:accounts.dm.uid},jugadores:players,base_datos_skills:skills,combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1,encounterId:'shared-deck-qa'},combatants:units}}},'PUT');
}
async function open(browser,role,viewport){
 const context=await browser.newContext({viewport,hasTouch:viewport.width<900,isMobile:viewport.width<900});const page=await context.newPage();page.setDefaultTimeout(20000);page.errors=[];page.blocked=[];
 page.on('pageerror',e=>page.errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=route.request().url();
  if(url.includes('/js/combat-firebase-config.js'))return route.fulfill({contentType:'application/javascript',body:`window.LuminousCombatFirebaseConfig={apiKey:'demo',projectId:'demo-limbus',authDomain:'demo-limbus.firebaseapp.com',databaseURL:'https://demo-limbus-default-rtdb.firebaseio.com'};`});
  const sdk=url.match(/firebase-(app|auth|database)\.js/);
  if(sdk){let body=fs.readFileSync(`.qa-sdk/firebase-${sdk[1]}.js`,'utf8');if(sdk[1]==='database')body+=`\n firebase.initializeApp(window.LuminousCombatFirebaseConfig);firebase.auth().useEmulator('http://127.0.0.1:9099',{disableWarnings:true});firebase.database().useEmulator('127.0.0.1',9000);firebase.auth().signInWithEmailAndPassword('${accounts[role].email}','qa-pass-123');`;return route.fulfill({contentType:'application/javascript',body});}
  if(url.startsWith('http://127.0.0.1:4173')||url.startsWith('http://127.0.0.1:9000')||url.startsWith('http://127.0.0.1:9099'))return route.continue();
  if(/firebaseio|googleapis/.test(url))page.blocked.push(url);
  return route.abort();
 });
 await page.goto('http://127.0.0.1:4173/Battle-viewer.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(wanted=>window.LuminousCombatLiveAdapter073?.state.role===wanted&&window.LuminousCombat073?.combatants()?.['enemy:e2']&&window.LuminousCombatEconomyMenu073?.state.installed,role==='dm'?'dm':'player',{timeout:45000});
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
 else await page.locator('.action-slot-wrapper.target-valid[data-owner-id="'+target.replace('GUARDIAN ','enemy:e')+'"]').first().click();
 if(await page.locator('#clash-forecast-confirm').isVisible())await page.locator('#clash-forecast-confirm').click();
 await page.waitForTimeout(700);return before;
}
for(const mobile of [false,true])test(`DM and two players share READY Clash and preserve slot deck (${mobile?'mobile':'desktop'})`,async({browser})=>{
 test.setTimeout(240000);await seed();fs.mkdirSync('artifacts/shared-planning',{recursive:true});let dm,p1,p2;
 try{
  dm=await open(browser,'dm',{width:1365,height:768});p1=await open(browser,'p1',mobile?{width:390,height:844}:{width:1280,height:800});p2=await open(browser,'p2',{width:844,height:390});
  const name=mobile?'mobile':'desktop';
  expect(await dm.locator('[id="token-enemy:e1"] .hp-number').innerText()).toBe('200');
  expect(await p1.locator('[id="token-enemy:e1"] .hp-number').innerText()).toBe('???');
  const h1=await hands(p1);expect(h1).toHaveLength(2);
  const dmHand=await dm.evaluate(()=>window.LuminousCombatSlotDeck073.hand('player:p1',0).map(c=>({id:c.skillId,drawId:c.drawId})));expect(dmHand).toEqual(h1);
  await p1.reload({waitUntil:'domcontentloaded'});await p1.waitForFunction(()=>window.LuminousCombat073?.combatants()?.['enemy:e2']&&window.LuminousCombatLiveAdapter073?.state.hydratedOnce&&window.LuminousCombatSlotDeck073?.hand('player:p1',0).length===2);expect(await hands(p1)).toEqual(h1);
  await p1.waitForFunction(()=>!document.querySelector('#turn-transition.active')&&!document.querySelector('#game-container.intro-running'));
  const selected=await select(p1,'GUARDIAN 1');
  await p1.locator('#ready').click();
  for(const page of [dm,p2])await page.waitForFunction(()=>{const u=window.LuminousCombat073.combatants()['player:p1'];return u.autoPlans[0]?.drawId&&u.autoPlans[0]?.clashConfirmed===true;});
  await expect(dm.locator('[id="player:p1_slot_0"] .slot-intent-label')).toContainText('CLASH');
  await p2.locator('.command[data-menu=view]').click();await expect(p2.locator('[id="player:p1_slot_0"] .slot-intent-label')).toContainText('CLASH');
  if(mobile){const box=await p1.locator('[id="player:p1_slot_0"] .slot-intent-label').boundingBox();expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(390);}
  await dm.screenshot({path:`artifacts/shared-planning/${name}-dm-ready.png`});await p1.screenshot({path:`artifacts/shared-planning/${name}-player-ready.png`});await p2.screenshot({path:`artifacts/shared-planning/${name}-observer-ready.png`});
  await p1.reload({waitUntil:'domcontentloaded'});await p1.waitForFunction(()=>window.LuminousCombat073?.uiState()?.ready===true&&window.LuminousCombatSlotDeck073?.hand('player:p1',0).length===2);expect(await hands(p1)).toEqual(selected);
  await p1.locator('#ready').click();await dm.waitForFunction(()=>window.LuminousCombat073.combatants()['player:p1'].autoPlans[0]?.type==='intent');
  await p1.waitForTimeout(700);await p1.locator('#ready').click();
  await p2.locator('#view-return').click();await p2.waitForTimeout(600);await select(p2,'GUARDIAN 2');
  // Speed must not disclose another Player's chosen hand. Only READY commits it.
  await p2.locator('#ready').click();
  for(const page of [dm,p1,p2])await page.waitForFunction(()=>window.LuminousCombat073?.uiState()?.round>=2&&!window.LuminousCombat073?.uiState()?.running,null,{timeout:120000});
  const next=await hands(p1);expect(next).toHaveLength(2);expect(next.every(c=>!selected.some(old=>old.drawId===c.drawId))).toBe(true);
  const canonical=await dm.evaluate(()=>window.LuminousCombatSlotDeck073.hand('player:p1',0).map(c=>({id:c.skillId,drawId:c.drawId})));expect(next).toEqual(canonical);
  await p1.reload({waitUntil:'domcontentloaded'});await p1.waitForFunction(()=>window.LuminousCombatLiveAdapter073?.state.round===2&&window.LuminousCombatSlotDeck073?.hand('player:p1',0).length===2);expect(await hands(p1)).toEqual(next);
  for(const page of [dm,p1,p2]){expect(page.errors).toEqual([]);expect(page.blocked).toEqual([]);}
  console.log(JSON.stringify({name,opening:selected,next,errors:[],productionRequests:[]}));
 }catch(error){for(const [role,page]of [['dm',dm],['p1',p1],['p2',p2]])if(page){await page.screenshot({path:`artifacts/shared-planning/${mobile?'mobile':'desktop'}-${role}-failure.png`});console.log(role,await page.evaluate(()=>({state:window.LuminousCombat073?.uiState(),status:document.getElementById('status')?.textContent,network:window.LuminousCombatLiveAdapter073?.state?.combatState,ready:window.LuminousCombatRemoteIntents073?.state?.ready,ai:!!window.LuminousCombatRemoteIntents073?.state?.planningAi?.signature})));}throw error;}
 finally{for(const page of [dm,p1,p2])await page?.context().close();}
});
