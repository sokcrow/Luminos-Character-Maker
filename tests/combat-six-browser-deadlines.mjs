// Renderer/transport integration: seven isolated Chromium contexts. Firebase is
// replaced by delayed delivery; this does not certify deployed Auth/RTDB rules.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
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
    await page.setContent('<style>body{margin:0;background:#171923;color:#f4dfad;font:20px sans-serif}main{display:flex;gap:16px;padding:16px}.hud{flex:1;min-width:0;padding:12px;border:1px solid #9c793f}.roll{display:flex;flex-wrap:wrap}</style><div id="status"></div><main><div class="hud" id="a"><b>A</b><div class="clash-float-power"></div><div class="roll"></div></div><div class="hud" id="b"><b>B</b><div class="clash-float-power"></div><div class="roll"></div></div></main>');
    await page.evaluate(({index}) => {
      window.testIndex=index; window.log=[]; window.final=[]; window.applied=[];
      window.combatData={a:{hp:100},b:{hp:100}}; window.round=1;
      window.COMBAT_PACE={coinInterval:300};
      window.clashData=()=>({coinAmount:1});
      window.setFloatingClashHud=entry=>document.getElementById(entry.ownerId);
      window.prepareFloatingClashRoll=entry=>document.querySelector('#'+entry.ownerId+' .roll');
      window.setFloatingPowerCoinState=()=>{};
      window.setCameraFocus=()=>{};
      window.LuminousCombatAudiovisual073={ duration:ms=>ms*(index===3?2:1), clear(){} };
      window.LuminousCombatLiveAdapter073={state:{role:index?'player':'dm',hydratedOnce:true,db:{ref:()=>({
        orderByKey(){return this},startAt(){return this},on(_kind,handler){window.deliver=value=>handler({val:()=>value})},off(){}
      })}},scheduleHydrate(){}};
      window.LuminousCombat073={combatants:()=>window.combatData};
    }, {index});
    await page.addScriptTag({content:coins});
    for (const path of ['js/combat-v073-playback.js','js/combat-v073-steps.js','js/combat-v073-playback-sync.js']) await page.addScriptTag({content:read(path)});
    await page.addScriptTag({content:runtime});
    await page.evaluate(() => {
      const sync=LuminousCombatPlaybackSync;
      const authority={state:{},snapshotRuntime:()=>combatData,applySnapshot(snapshot){Object.assign(combatData,snapshot);applied.push(snapshot)}};
      sync.state.authority=authority;
      const data={id:'browser-round',round:1,phase:'running',initialStateJson:JSON.stringify(combatData),playback:{schemaVersion:1,engineVersion:LuminousCombatPlayback.engineVersion,timelineVersion:1,session:sync.session}};
      authority.state.current=data;
      window.LuminousCombatAuthority073={state:{runningLocal:false},isDm:()=>!testIndex,snapshotRuntime:()=>combatData,publishPresentation(){
        // Split both sides deliberately; use the shipped delta encoder.
        const batch=Object.values(sync.batchUpdates({type:'presentation',updatedAt:Date.now()}))[0];
        void publishBatch(batch);
      }};
      const engine=combatStepRuntime(); window.engine=engine;
      const draw=async(cue,args)=>{
        log.push({cue,owner:args[0]?.ownerId,index:args[1]?.index,at:Date.now()});
        await engine.present(cue,args);
      };
      window.LuminousCombatStepRuntime={capturePresentation:value=>engine.capturePresentation(value),events:after=>engine.events(after),
        beginPlayback(){},refreshPlayback(){},acceptEvent(){},present:draw,
        finishPlayback(next){final.push(next)}};
      // The DM uses the exact same runtime presentation; instrument its draw.
      if(!testIndex){
        const original=sync.presentScheduled;
        window.LuminousCombatPlaybackSync={...sync,presentScheduled(event,render){
          return original(event,()=>{log.push({cue:event.cue,owner:event.args[0]?.ownerId,index:event.args[1]?.index,at:Date.now()});return render()});
        }};
        sync.beginUpdates(data);
      }else window.ready=sync.observe(data);
    });
  }
  await Promise.all(pages.slice(1).map(page=>page.evaluate(()=>ready)));
  const execution=pages[0].evaluate(async()=>{
    const a={ownerId:'a',plan:{data:{}},localIndex:0},b={ownerId:'b',plan:{data:{}},localIndex:0};
    for(let n=0;n<8;n++){
      await Promise.all([engine.show('powerStart',a,1,4),engine.show('powerStart',b,1,4)]);
      await Promise.all([engine.show('powerCoin',a,{index:n,side:'head'},8),engine.show('powerCoin',b,{index:n,side:'tail'},4)]);
      await Promise.all([engine.show('powerEnd',a,1,8,[]),engine.show('powerEnd',b,1,4,[])]);
    }
    await LuminousCombatPlaybackSync.drainPresentation();
    const batch=Object.values(LuminousCombatPlaybackSync.batchUpdates({type:'round_complete',updatedAt:Date.now(),nextRound:2,combatants:{a:{hp:77},b:{hp:50}}}))[0];
    await publishBatch(batch);
  });
  await pages[1].waitForFunction(()=>document.querySelector('.luminous-core-coin[data-state="spinning"]'));
  await Promise.all(pages.slice(1).map((page,i)=>page.screenshot({path:`${output}/viewer-${i+1}.png`})));
  await execution;
  while(deliveries.size) await Promise.all([...deliveries]);
  await Promise.all(pages.slice(1).map(page=>page.waitForFunction(()=>final.length===1)));
  const results=await Promise.all(pages.map(page=>page.evaluate(()=>({log,final,units:combatData,visuals:document.querySelectorAll('.luminous-core-coin').length}))));
  let maxSkew=0;
  for(const [index,result] of results.slice(1).entries()){
    assert.equal(result.log.length,results[0].log.length,`viewer ${index}: no lost visuals`);
    assert.deepEqual(result.log.map(({at,...cue})=>cue),results[0].log.map(({at,...cue})=>cue));
    for(let cue=0;cue<result.log.length;cue++){
      const skew=Math.abs(result.log[cue].at-results[0].log[cue].at);maxSkew=Math.max(maxSkew,skew);
      assert.ok(skew<=400,`viewer ${index}, cue ${cue}: ${skew}ms exceeds live budget`);
    }
    assert.deepEqual(result.final,[2]);assert.equal(result.units.a.hp,77);assert.equal(result.units.b.hp,50);
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
