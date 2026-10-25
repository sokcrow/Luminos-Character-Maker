import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);let pw;try{pw=require('playwright')}catch{pw=createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/`)('playwright')}
const root=path.resolve('.'),fixture=fs.readFileSync('tests/combat-v073-player-menu-visual.spec.mjs','utf8').match(/const FIREBASE_STUB = `([\s\S]*?)`;/)[1];
const browser=await pw.chromium.launch({headless:true,args:['--no-sandbox']});fs.mkdirSync('artifacts/universal-actions',{recursive:true});
try{for(const [width,height]of [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]]){
 const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const url=new URL(route.request().url());if(/firebase-(app|auth|database)\.js/.test(url.pathname))return route.fulfill({contentType:'application/javascript',body:url.pathname.endsWith('firebase-app.js')?fixture:''});if(url.hostname!=='combat.test')return route.fulfill({status:200,body:''});const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});const mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.woff2':'font/woff2'}[path.extname(file)]||'text/plain';return route.fulfill({contentType:mime,body:fs.readFileSync(file)});});
 await page.goto('http://combat.test/Battle-viewer.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.LuminousCombat073?.combatants?.()['player:p1']&&window.LuminousCombatEconomyMenu073?.state?.installed,{timeout:30000});
 await page.locator('.command[data-menu="global"]').click({timeout:10000});
 for(const label of ['Grapple','Help','Retreat','Escape']){
  await page.locator('#category-body .clean-row').filter({hasText:label}).first().click();const button=page.locator('#action-confirm');await button.waitFor({state:'visible'});await button.scrollIntoViewIfNeeded();const box=await button.boundingBox();assert.ok(box&&box.height>=44&&box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`${width}x${height}: ${label} confirmation`);await page.screenshot({path:`artifacts/universal-actions/${width}x${height}-${label}.png`});await page.locator('#back').click();
 }
 await page.locator('[data-economy="free_action"]').click();assert.match(await page.locator('#category-body').innerText(),/Analyse/);await page.locator('#category-body .clean-row').filter({hasText:'Analyse'}).click();await page.locator('#economy-action-confirm').click();assert.equal(await page.evaluate(()=>window.LuminousCombat073.uiState().analyse),true);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);await page.close();
}}finally{await browser.close()}
console.log('Universal Globals confirmation/back, Free Analyse and screenshot coverage passed at all six TX-01 viewports');
