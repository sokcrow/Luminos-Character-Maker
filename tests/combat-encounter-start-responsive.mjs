/* Production Battle Viewer and canonical Status renderer, with an isolated Firebase fixture. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/`)('playwright')}
const root=path.resolve('.'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fixture=read('tests/combat-v073-player-menu-visual.spec.mjs').match(/const FIREBASE_STUB = `([\s\S]*?)`;/)[1].replaceAll("classId:'wizard'","classId:'fighter'");
const browser=await playwright.chromium.launch({headless:true,args:['--no-sandbox']});
fs.mkdirSync('artifacts/encounter-start',{recursive:true});
const sizes=[[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]];
try{for(const [width,height]of sizes){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(/firebase-(app|auth|database)\.js/.test(url.pathname))return route.fulfill({contentType:'application/javascript',body:url.pathname.endsWith('firebase-app.js')?fixture:''});
    if(url.hostname!=='combat.test')return route.fulfill({status:200,body:''});
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    const type={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml'}[path.extname(file)]||'text/plain';
    return route.fulfill({contentType:type,body:fs.readFileSync(file)});
  });
  await page.goto('http://combat.test/Battle-viewer.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.LuminousCombat073?.combatants?.()['player:p1']&&window.LuminousCombatEconomyMenu073?.state?.installed,{timeout:30000});
  await page.evaluate(async()=>{
    const id='player:p1',live=window.LuminousCombat073.combatants(),unit=live[id];
    unit.classes=[{classId:'fighter',levels:15}];unit.characterBuild={classes:unit.classes,archetypes:[{classId:'fighter',archetypeId:'battle_master'}],maneuvers:{battle_master:[]}};
    const event=window.LuminousCombatEventRuntime;
    const result=await event.planEncounterStart([unit],{encounterId:'responsive'});
    window.LuminousCombatAuthority073.applySnapshot({[id]:result.units[0]});
    window.__encounterTest={id};
  });
  const badge=page.locator('[data-status-id="superiority"]').first();
  await badge.waitFor({state:'visible',timeout:10000});
  assert.equal(await badge.locator('.status-count').innerText(),'0');
  assert.match(await badge.locator('img').getAttribute('src'),/Assets\/Icons\/status\/superiority\.png$/);
  await page.waitForFunction(()=>{
    const node=document.querySelector('[data-status-id="superiority"]'),box=node?.getBoundingClientRect();
    return box&&box.x>=0&&box.y>=0&&box.right<=innerWidth+1&&box.bottom<=innerHeight+1;
  },null,{timeout:5000});
  const box=await badge.boundingBox();
  assert.ok(box&&box.width>0&&box.height>0&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`${width}x${height}: badge stays in view ${JSON.stringify(box)}`);
  await badge.focus();assert.equal(await badge.evaluate(node=>node===document.activeElement),true);
  await page.screenshot({path:`artifacts/encounter-start/${width}x${height}.png`,animations:'disabled'});
  await page.evaluate(()=>{
    const unit=window.LuminousCombat073.combatants()['player:p1'];
    // Invoke the real live Skill event hook used by resolved Hits and Clashes.
    (0,eval)("applySkillStatusEffects({ownerId:'player:p1',plan:{data:{}}},null,'[On Hit]')");
    (0,eval)("applySkillStatusEffects({ownerId:'player:p1',plan:{data:{}}},null,'[Clash Win]')");
    if(unit.resources.superiority!==4)throw new Error('Live resource did not grow');
  });
  assert.equal(await badge.locator('.status-count').innerText(),'4');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  // Menu presentation uses a deferred authority boundary. The actual RTDB
  // protocol/atomic claim is exercised independently by the client/DM tests.
  await page.evaluate(()=>{
    const original=window.LuminousCombatPlanSync073;
    window.__pendingAbility=[];
    window.LuminousCombatPlanSync073=Object.freeze({...original,requestIndependentAction(selection){
      return new Promise(resolve=>window.__pendingAbility.push(()=>{
        const units=JSON.parse(JSON.stringify(Object.values(window.LuminousCombat073.combatants()))),unit=units.find(row=>row.id===selection.unitId);
        const source=window.LuminousUnitIndependentActions.sourcesFor(unit).find(row=>row.definition.id===selection.sourceId);
        const result=window.LuminousUnitIndependentActions.execute(unit,source,{round:1,phase:'planning',units,target:unit,silent:true});
        if(result.used)window.LuminousCombatAuthority073.applySnapshot(Object.fromEntries(units.map(row=>[row.id,row])));
        resolve(result);
      }));
    }});
  });
  await page.locator('.command-ring [data-menu="global"]').click();
  await page.locator('[data-economy="quick_action"]').click();
  await page.locator('#category-body .clean-row').filter({hasText:'Second Wind'}).click();
  await page.locator('#economy-action-confirm').click();
  assert.equal(await page.evaluate(()=>window.LuminousCombatEconomyMenu073.state.independentPending),true);
  assert.equal(await page.evaluate(()=>window.LuminousCombat073.combatants()['player:p1'].hp),72,'Pending authority cannot show speculative healing');
  await page.screenshot({path:`artifacts/encounter-start/${width}x${height}-quick-pending.png`,animations:'disabled'});
  await page.evaluate(()=>window.__pendingAbility.shift()());
  await page.waitForFunction(()=>window.LuminousCombat073.combatants()['player:p1'].hp===97);
  await page.locator('.command-ring [data-menu="global"]').click();
  await page.locator('[data-economy="free_action"]').click();
  const free=page.locator('#category-body .clean-row').filter({hasText:'Action Surge'});
  await free.click();
  const confirm=page.locator('#economy-action-confirm');
  assert.match(await confirm.innerText(),/FREE ACTION/);
  const control=await confirm.boundingBox();
  assert.ok(control&&control.x>=0&&control.y>=0&&control.x+control.width<=width+1&&control.y+control.height<=height+1,`${width}x${height}: Free confirmation remains reachable`);
  await page.screenshot({path:`artifacts/encounter-start/${width}x${height}-free.png`,animations:'disabled'});
  await confirm.click();await page.evaluate(()=>window.__pendingAbility.shift()());
  await page.waitForFunction(()=>window.LuminousCombat073.combatants()['player:p1'].actionSlots===3);
  assert.equal(await page.evaluate(()=>window.LuminousCombat073.combatants()['player:p1'].quickActionRemaining),0,'Free works after Quick is spent');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(errors,[],`${width}x${height}: no page errors`);
  console.log(`${width}x${height}: real viewer, zero icon, keyboard focus, live Hit/Clash gains, Quick confirmation and Free after Quick passed`);
  await page.close();
}}finally{await browser.close()}
