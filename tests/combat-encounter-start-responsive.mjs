/* Production Battle Viewer and canonical Status renderer, with an isolated Firebase fixture. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/`)('playwright')}
const root=path.resolve('.'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const fixture=read('tests/combat-v073-player-menu-visual.spec.mjs').match(/const FIREBASE_STUB = `([\s\S]*?)`;/)[1];
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
  const box=await badge.boundingBox();
  assert.ok(box&&box.width>0&&box.height>0&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`${width}x${height}: badge stays in view`);
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
  assert.deepEqual(errors,[],`${width}x${height}: no page errors`);
  console.log(`${width}x${height}: real viewer, zero icon, keyboard focus, live Hit/Clash gains and viewport passed`);
  await page.close();
}}finally{await browser.close()}
