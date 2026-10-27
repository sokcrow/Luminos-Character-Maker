// Renderer/transport integration: seven isolated Chromium contexts. Firebase is
// replaced by delayed delivery; this does not certify deployed Auth/RTDB rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { comparePresentations } from './helpers/combat-presentation-assertions.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const emulator = process.env.COMBAT_FIREBASE_EMULATOR === '1';
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9199';
const dbHost = process.env.FIREBASE_DATABASE_EMULATOR_HOST || '127.0.0.1:9100';
const namespace = 'demo-combat-results-default-rtdb';
const accounts = [];
if (emulator) {
  for (const host of [authHost, dbHost]) assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/, 'Never target production');
  for (let i=0;i<7;i++) {
    const email=`playback-${Date.now()}-${i}@example.test`;
    const response=await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:'temporary-test-password',returnSecureToken:true})});
    assert.ok(response.ok,'Create independent emulator identity'); accounts.push({...await response.json(),email});
  }
  const seed={config:{dm_uid:accounts[0].localId},jugadores:Object.fromEntries(accounts.slice(1).map((user,i)=>[`p${i+1}`,{uid:user.localId}])),combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1}}};
  const response=await fetch(`http://${dbHost}/campa%C3%B1a.json?ns=${namespace}`, {method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify(seed)});
  assert.ok(response.ok,'Seed emulator only');
}
const read = path => fs.readFileSync(path, 'utf8');
const html = read('combat/source/combat-v073-live.html');
const coinStart = html.indexOf('(function (global) {', html.indexOf('<script src="js/combat-v073-live-adapter'));
const coins = html.slice(coinStart, html.indexOf('</script>', coinStart));
const runtime = html.slice(html.indexOf('let combatStepsInstance=null;'), html.indexOf('async function rollClashPower('));
assert.ok(coins.includes('function runAnimatedRoll') && runtime.includes('async powerCoin'));
const viewports = [[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080]];
const browser = await chromium.launch({ headless:true,
  ...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),
  args:['--no-sandbox','--disable-dev-shm-usage'] });
const contexts = [], pages = [], deliveries = new Set(), errors = [];
const output = process.env.COMBAT_DEADLINES_OUTPUT || 'artifacts/combat-deadlines';
fs.mkdirSync(output, { recursive:true });
let accepting = true;
try {
  for (let index=0; index<7; index++) {
    const [width,height] = index ? viewports[index-1] : [1280,720];
    const context = await browser.newContext({ viewport:{width,height} });
    contexts.push(context);
    // Local, deterministic art is exclusive to this integration fixture.
    await context.route('https://**/*', route => route.fulfill({ contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><circle cx="30" cy="30" r="28" fill="#d6aa45"/></svg>' }));
    const page = await context.newPage(); pages.push(page);
    page.on('pageerror', error => errors.push(error.message));
    await page.exposeFunction('publishBatch', batch => {
      if (!accepting) return;
      for (let peer=1;peer<pages.length;peer++) {
        let task;
        task = new Promise(resolve => setTimeout(resolve, [20,60,100,140,180,210][peer-1]))
          .then(() => pages[peer].evaluate(value => window.deliver(value), batch))
          .catch(error => errors.push(error.message)).finally(() => deliveries.delete(task));
        deliveries.add(task);
      }
    });
    await page.setContent('<style>body{margin:0;background:#171923;color:#f4dfad;font:20px sans-serif}main{display:flex;gap:16px;padding:16px}.hud{flex:1;min-width:0;padding:12px;border:1px solid #9c793f}.roll{display:flex;flex-wrap:wrap}</style><div id="game-container" style="position:relative;min-height:100vh"><div id="status"></div><main><div class="hud" id="a"><b>A</b><div class="clash-float-power"></div><div class="roll"></div></div><div class="hud" id="b"><b>B</b><div class="clash-float-power"></div><div class="roll"></div></div></main></div>');
    await page.addStyleTag({content:read('css/combat-v073-audiovisual.css')});
    if (emulator) {
      const firebaseRoot=path.dirname(require.resolve('firebase/package.json'));
      for (const module of ['app','auth','database']) await page.addScriptTag({content:read(path.join(firebaseRoot,`firebase-${module}.js`))});
      await page.evaluate(async({authHost,dbHost,namespace,email})=>{
        const app=firebase.initializeApp({apiKey:'demo',projectId:'demo-combat-results',databaseURL:`http://${dbHost}/?ns=${namespace}`});
        app.auth().useEmulator(`http://${authHost}`,{disableWarnings:true});
        const [host,port]=dbHost.split(':');app.database().useEmulator(host,Number(port));
        await app.auth().signInWithEmailAndPassword(email,'temporary-test-password');
        window.firebaseDb=app.database();
      },{authHost,dbHost,namespace,email:accounts[index].email});
    }
    await page.evaluate(({index}) => {
      window.testIndex=index; window.log=[]; window.final=[]; window.applied=[]; window.roundRunning=true;
      window.combatData={a:{hp:100},b:{hp:100}}; window.round=1;
      window.COMBAT_PACE={coinInterval:300};
      window.clashData=()=>({coinAmount:1});
      window.setFloatingClashHud=entry=>document.getElementById(entry.ownerId);
      window.prepareFloatingClashRoll=entry=>document.querySelector('#'+entry.ownerId+' .roll');
      window.setFloatingPowerCoinState=()=>{};
      window.setCameraFocus=()=>{};
      window.LuminousCombatLiveAdapter073={state:{role:index?'player':'dm',hydratedOnce:true,db:window.firebaseDb||{ref:()=>({
        orderByKey(){return this},startAt(){return this},on(_kind,handler){window.deliver=value=>handler({val:()=>value})},off(){}
      })}},scheduleHydrate(){}};
      window.LuminousCombat073={combatants:()=>window.combatData};
    }, {index});
    await page.addScriptTag({content:coins});
    for (const path of ['js/combat-v073-playback.js','js/combat-v073-steps.js','js/combat-v073-playback-sync.js','js/combat-v073-audiovisual.js']) await page.addScriptTag({content:read(path)});
    await page.addScriptTag({content:runtime});
    await page.evaluate(async() => {
      const sync=LuminousCombatPlaybackSync;
      const authority={state:{},snapshotRuntime:()=>combatData,applySnapshot(snapshot){Object.assign(combatData,snapshot);applied.push(snapshot)}};
      sync.state.authority=authority;
      LuminousCombatAudiovisual073.preferences({sound:false});
      let data={id:'browser-round',round:1,phase:'running',initialStateJson:JSON.stringify(combatData),playback:{schemaVersion:1,engineVersion:LuminousCombatPlayback.engineVersion,timelineVersion:1,session:sync.session}};
      if(window.firebaseDb){
        if(!testIndex) await firebaseDb.ref('campaña/combate/authority/current').set(data);
        else data=(await firebaseDb.ref('campaña/combate/authority/current').once('value')).val();
      }
      authority.state.current=data;
      window.writeErrors=[];window.pendingWrites=new Set();
      window.publishUpdates=updates=>{
        const operation=window.firebaseDb?firebaseDb.ref().update(updates):Promise.all(Object.values(updates).map(batch=>publishBatch(batch)));
        pendingWrites.add(operation);operation.catch(error=>writeErrors.push(error.message)).finally(()=>pendingWrites.delete(operation));
        return operation;
      };
      window.LuminousCombatAuthority073={state:{runningLocal:false},isDm:()=>!testIndex,snapshotRuntime:()=>combatData,publishPresentation(){
        // Split both sides deliberately; use the shipped delta encoder.
        void publishUpdates(sync.batchUpdates({type:'presentation',updatedAt:Date.now()}));
      }};
      const engine=combatStepRuntime(); window.engine=engine;
      const draw=async(cue,args,visual,event)=>{
        log.push({cue,owner:args[0]?.ownerId,index:args[1]?.index,at:Date.now(),sequence:event.sequence,phase:event.timing.phase,durationMs:LuminousCombatAudiovisual073.duration(1000)});
        await engine.present(cue,args,visual);
      };
      window.LuminousCombatStepRuntime={capturePresentation:value=>engine.capturePresentation(value),events:after=>engine.events(after),
        beginPlayback(){},refreshPlayback(){},acceptEvent(){},present:draw,
        finishPlayback(next){final.push(next)}};
      // The DM uses the exact same runtime presentation; instrument its draw.
      if(!testIndex){
        const original=sync.presentScheduled;
        window.LuminousCombatPlaybackSync={...sync,presentScheduled(event,render){
          return original(event,visual=>{log.push({cue:event.cue,owner:event.args[0]?.ownerId,index:event.args[1]?.index,at:Date.now(),sequence:event.sequence,phase:event.timing.phase,durationMs:LuminousCombatAudiovisual073.duration(1000)});return render(visual)});
        }};
        authority.state.runningLocal=true;
        const initial=sync.beginUpdates(data);
        if(window.firebaseDb) await firebaseDb.ref().update(initial);
      }else window.ready=sync.observe(data);
    });
  }
  // The removed option must be absent from the mounted production settings
  // on DM and all six viewport sizes; the three remaining controls stay usable.
  for (const [index,page] of pages.entries()) {
    assert.equal(await page.locator('#combat-av-speed').count(),0,'No playback speed selector');
    assert.equal(await page.locator('#combat-av-settings input,#combat-av-settings select').count(),3);
    await page.locator('#combat-av-settings summary').click();
    const box=await page.locator('#combat-av-settings').boundingBox();
    const size=page.viewportSize();
    assert.ok(box.x>=0 && box.y>=0 && box.x+box.width<=size.width && box.y+box.height<=size.height,'Settings fit the viewport');
    await page.screenshot({path:`${output}/settings-${index}.png`});
    await page.locator('#combat-av-settings summary').click();
  }
  await Promise.all(pages.slice(1).map(page=>page.evaluate(()=>ready)));
  if(emulator) for(const page of pages.slice(1)) assert.equal(await page.evaluate(async()=>{
    try{await firebaseDb.ref('campaña/combate/playback/current/batches/forbidden').set({payload:'forged'});return false}
    catch(error){return error.code==='PERMISSION_DENIED'}
  }),true,'A player must not forge DM playback');
  const execution=pages[0].evaluate(async()=>{
    const a={ownerId:'a',plan:{data:{}},localIndex:0},b={ownerId:'b',plan:{data:{}},localIndex:0};
    for(let n=0;n<8;n++){
      await Promise.all([engine.show('powerStart',a,1,4),engine.show('powerStart',b,1,4)]);
      await Promise.all([engine.show('powerCoin',a,{index:n,side:'head'},8),engine.show('powerCoin',b,{index:n,side:'tail'},4)]);
      await Promise.all([engine.show('powerEnd',a,1,8,[]),engine.show('powerEnd',b,1,4,[])]);
    }
    await LuminousCombatPlaybackSync.drainPresentation();
    // This fixture injects its terminal state; compare every viewer with the DM
    // snapshot rather than merely comparing six players with each other.
    combatData.a.hp=77; combatData.b.hp=50;
    const updates=LuminousCombatPlaybackSync.batchUpdates({type:'round_complete',updatedAt:Date.now(),combatants:combatData});
    LuminousCombatStepRuntime.finishPlayback(2);
    await publishUpdates(updates);await Promise.all([...pendingWrites]);
  });
  await pages[1].waitForFunction(()=>document.querySelector('.luminous-core-coin[data-state="spinning"]'));
  await Promise.all(pages.slice(1).map((page,i)=>page.screenshot({path:`${output}/viewer-${i+1}.png`})));
  await execution;
  while(deliveries.size) await Promise.all([...deliveries]);
  await Promise.all(pages.slice(1).map(page=>page.waitForFunction(()=>final.length===1)));
  errors.push(...(await Promise.all(pages.map(page=>page.evaluate(()=>writeErrors)))).flat());
  const results=await Promise.all(pages.map(page=>page.evaluate(()=>({log,final,units:combatData,visuals:document.querySelectorAll('.luminous-core-coin').length,sampleDuration:LuminousCombatAudiovisual073.duration(1000)}))));
  // Preserve raw evidence even if any assertion below fails.
  fs.writeFileSync(`${output}/raw-results.json`,JSON.stringify({transport:emulator?'Auth + RTDB emulators, production rules':'simulated delivery',clients:7,viewports,exchanges:8,results,errors},null,2));
  let maxSkew=0;
  assert.ok(results[0].log.every(cue=>cue.durationMs===1000),'The DM also uses the fixed timing');
  for(const [index,result] of results.slice(1).entries()){
    maxSkew=Math.max(maxSkew,comparePresentations(results[0].log,result.log));
    assert.deepEqual(result.final,results[0].final);assert.deepEqual(result.units,results[0].units);
    assert.ok(result.log.every(cue=>cue.durationMs===1000),'One fixed timing for every Player and the DM');
    assert.equal(result.sampleDuration,1000,'Timing stays fixed after the round');
    assert.ok(result.visuals>0,'production Coin renderer created real DOM');
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${output}/metrics.json`,JSON.stringify({clients:7,viewports,exchanges:8,maxSkewMs:maxSkew,results},null,2));
  console.log(`DM + six Chromium renderers: all cues in order, final HP identical, max skew ${maxSkew}ms.`);
} finally {
  accepting=false;
  await Promise.all([...deliveries]);
  await Promise.all(contexts.map(context=>context.close()));
  await browser.close();
}
