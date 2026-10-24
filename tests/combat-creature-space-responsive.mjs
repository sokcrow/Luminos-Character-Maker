/* Real packed Battle Viewer with an isolated Firebase session and canonical local sprite art. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright')}catch{playwright=createRequire(`${process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES}/`)('playwright')}
const root=path.resolve('.');
const fixture=fs.readFileSync('tests/combat-v073-player-menu-visual.spec.mjs','utf8').match(/const FIREBASE_STUB = `([\s\S]*?)`;/)[1];
process.env.TMPDIR=path.join(root,'artifacts/creature-space/tmp');fs.mkdirSync(process.env.TMPDIR,{recursive:true});
const browser=await playwright.chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||undefined,headless:true,args:['--no-sandbox']});
fs.mkdirSync('artifacts/creature-space',{recursive:true});
try{for(const role of ['player','dm'])for(const [width,height]of [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:width<900}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(/firebase-(app|auth|database)\.js/.test(url.pathname))return route.fulfill({contentType:'application/javascript',body:url.pathname.endsWith('firebase-app.js')?(role==='dm'?fixture.replace('currentUser:{uid:PLAYER_UID', 'currentUser:{uid:DM_UID'):fixture):''});
    if(url.hostname!=='combat.test')return route.fulfill({status:200,body:''});
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
    const type={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml'}[path.extname(file)]||'text/plain';
    return route.fulfill({contentType:type,body:fs.readFileSync(file)});
  });
  await page.goto('http://combat.test/Battle-viewer.html',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.LuminousCombat073?.combatants?.()['player:p1']&&window.LuminousCombatStage073&&window.LuminousCombatDeploymentRuntime,{timeout:30000});
  // Same sprite and manual scale: geometric ratios must come solely from size.
  const ratios=await page.evaluate(async()=>{
    const a=window.LuminousCombatLiveAdapter073,base=structuredClone(a.state.combatants['player:p1']);
    const image='Assets/Images/SpellUnits/mage_hand.png';
    const body=(id,size,extra={})=>({...base,id,combatId:id,name:size,characterName:size,category:'enemy',actorCategory:'enemy',canonicalScope:'unit',isPlayer:false,faction:'enemy',playerId:null,ownerPlayerId:null,canonicalPlayerKey:null,canonicalOwnerUid:null,ownerUid:null,scale:1,combatSprite:image,tokenImage:image,img:image,size,actionSlots:1,activeSlots:1,...extra});
    window.__creatureBody=body;window.__creatureBase=base;
    const result={};
    for(const size of ['tiny','small','medium','large','huge','gargantuan']){
      a.state.combatants={'player:p1':base,target:body('target',size)};a.state.lastSignature='';a.hydrateNow();
      window.LuminousCombatStage073.refresh();
      const img=document.getElementById('sprite-target');await img.decode();
      const box=img.getBoundingClientRect(),panel=document.getElementById('ui-panel-target').getBoundingClientRect();
      result[size]={height:box.height,control:panel.height,top:panel.bottom,bodyTop:box.top};
    }
    return result;
  });
  const scale={tiny:.55,small:.8,medium:1,large:1.35,huge:1.85,gargantuan:2.5};
  for(const [size,factor]of Object.entries(scale)){
    assert.ok(Math.abs(ratios[size].height/ratios.medium.height-factor)<.02,`${width}x${height}: ${size} body ratio`);
    assert.ok(Math.abs(ratios[size].control-ratios.medium.control)<1,`${size}: controls retain readable geometry`);
    if(['large','huge','gargantuan'].includes(size))assert.ok(ratios[size].top<=ratios[size].bodyTop+2,`${size}: action slots stay above the body`);
  }
  await page.evaluate(()=>{
    const a=window.LuminousCombatLiveAdapter073,body=window.__creatureBody;
    a.state.combatants={'player:p1':window.__creatureBase,...Object.fromEntries(['gargantuan','huge','large','tiny','tiny','medium'].map((size,i)=>['body'+i,body('body'+i,size)])),summon:body('summon','large',{isSummon:true})};
    a.state.lastSignature='';a.hydrateNow();window.setCameraFocus('full',false);window.LuminousCombatStage073.refresh();
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('.sprite-img')].every(img=>img.complete));
  await page.screenshot({path:`artifacts/creature-space/${role}-${width}x${height}-mixed.png`,animations:'disabled'});
  assert.equal(await page.evaluate(()=>window.LuminousCombatDeploymentRuntime.fieldSpaceUsed(window.LuminousCombatLiveAdapter073.state.combatants,'enemy')),8);
  // Packed Tiny side must create sixteen distinct, reachable battlefield anchors.
  const tiny=await page.evaluate(()=>{
    const a=window.LuminousCombatLiveAdapter073,body=window.__creatureBody;
    a.state.combatants={'player:p1':window.__creatureBase,...Object.fromEntries(Array.from({length:16},(_,i)=>['t'+i,body('t'+i,'tiny')]))};
    a.state.lastSignature='';a.hydrateNow();window.setCameraFocus('full',false);
    return Object.values(window.LuminousCombat073.combatants()).filter(u=>u.faction==='enemy').map(u=>({x:u.x,y:u.y}));
  });
  assert.equal(new Set(tiny.map(p=>p.x+':'+p.y)).size,16);
  await page.screenshot({path:`artifacts/creature-space/${role}-${width}x${height}-tiny.png`,animations:'disabled'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal document overflow');
  assert.deepEqual(errors,[],`${width}x${height}: real viewer boot has no page errors`);
  console.log(`${role} ${width}x${height}: all six body sizes, independent HUD, mixed side, summon and 16 Tiny passed`);
  await page.close();
}}finally{await browser.close()}
