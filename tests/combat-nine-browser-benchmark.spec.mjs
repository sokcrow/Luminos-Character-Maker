import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fixture,npcBenchmarkPlan} from './helpers/combat-nine-fixture.mjs';

const harnessRoot=process.cwd(),base='http://127.0.0.1:4173';
const namespace='demo-combat-results-default-rtdb';
const output=path.resolve(process.env.COMBAT_BENCH_OUTPUT||'artifacts/combat-nine');
const roots={before:path.resolve(process.env.COMBAT_BENCH_BASELINE_ROOT||''),after:harnessRoot};
const labels={before:process.env.COMBAT_BENCH_BASELINE_SHA||'unrecorded',after:process.env.COMBAT_BENCH_CANDIDATE_SHA||'unrecorded'};
const viewports=[[1280,720],[360,800],[390,844],[844,390],[768,1024],[1280,720],[1920,1080],[390,844],[1280,720]];
let sourceRoot=harnessRoot,server;
const endpoint=p=>`http://127.0.0.1:9100/${p.split('/').map(encodeURIComponent).join('/')}.json?ns=${namespace}`;
async function admin(p,method='GET',value){
  const response=await fetch(endpoint(p),{method,headers:{Authorization:'Bearer owner','Content-Type':'application/json'},...(value===undefined?{}:{body:JSON.stringify(value)})});
  expect(response.ok,await response.clone().text()).toBeTruthy();return response.json();
}
async function account(index){
  const email=`nine-${Date.now()}-${index}@example.test`,password='temporary-test-password';
  const response=await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});
  const data=await response.json();expect(data.localId,JSON.stringify(data)).toBeTruthy();return {uid:data.localId,email,password};
}

function instrument(){
  // Fixture seed only. Presentation clocks/timers and the combat resolver are
  // untouched. Different UUIDs and Auth identities remain genuinely random.
  const randomValues=crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues=values=>{if(values instanceof Uint32Array&&values.length===1){values[0]=0x1234abcd;return values}return randomValues(values)};
  try{localStorage.setItem('luminos.combat.presentation.v1',JSON.stringify({sound:false,volume:0,quality:'full'}));}catch{}
  const now=()=>performance.timeOrigin+performance.now()+(window.LuminousCombatPlaybackSync?.state.serverOffset||0);
  const data=window.__nine={cues:[],events:[],received:[],frames:[],longTasks:[],profile:[],active:false,ruleCalls:0,errors:[]};
  function measured(name,fn){
    if(fn.__nineProfile)return fn;
    const wrapped=function(...args){
      const active=data.active&&window.LuminousCombatAuthority073?.state.runningLocal,start=performance.now();
      try{return fn.apply(this,args)}finally{if(active)data.profile.push({name,ms:performance.now()-start,at:now()})}
    };
    Object.defineProperty(wrapped,'__nineProfile',{value:true});return wrapped;
  }
  for(const [name,methods]of [['LuminousCombatAuthority073',['applySnapshot']],['LuminousCombat073',['render']],['LuminousCombatStage073',['refresh','refreshUnit']],['LuminousCombatHudMotion073',['refresh','event','cue','scheduleStatusLayout']]]){
    let value;
    Object.defineProperty(window,name,{configurable:true,get:()=>value,set(api){
      const wrapped={...api};for(const method of methods)if(typeof api[method]==='function')wrapped[method]=measured(name+'.'+method,api[method]);value=Object.freeze(wrapped);
    }});
  }
  const pending=new Map(),renderEvents=new WeakMap();
  const key=(cue,args)=>JSON.stringify([cue,args?.[0]?.ownerId||args?.[0]||null,args?.[1]?.ownerId||null,cue==='powerCoin'?args?.[1]?.index:cue==='hitCoin'?args?.[2]:null]);
  const sides=coins=>(coins||[]).map(coin=>coin?.side||null);
  function resultValue(cue,args){
    if(cue==='powerCoin')return {side:args[1]?.side,power:args[2]};
    if(cue==='powerEnd')return {power:args[2],coins:sides(args[3])};
    if(cue==='hitCoin')return {index:args[2],coins:sides(args[3]),power:args[4]};
    if(cue==='clashOutcome')return {winner:args[2],remainingA:args[3],remainingB:args[4],powerA:args[5]?.power,powerB:args[6]?.power,coinsA:sides(args[5]?.coins),coinsB:sides(args[6]?.coins)};
    if(cue==='clashEnd')return {winner:args[2]?.ownerId||null};
    if(cue==='hitMotion')return {damage:args[2]?.finalDamage??null};
    return null;
  }
  function start(event,cue,args){
    if(!event){data.errors.push('Missing presentation identity: '+cue);return null;}
    const row={sequence:event.sequence,cue,owner:args?.[0]?.ownerId||null,opponent:args?.[1]?.ownerId||null,index:cue==='powerCoin'?args?.[1]?.index:cue==='hitCoin'?args?.[2]:null,result:resultValue(cue,args),startAt:now(),playAt:event.timing?.playAt??null,paintAt:null,endAt:null};
    data.cues.push(row);requestAnimationFrame(()=>{
      row.paintAt=now();
      if(['actionStart','actionApproach','clashStart','clashOutcome','hitMotion'].includes(cue))row.scene={
        camera:document.getElementById('battlefield')?.dataset.cameraMode||null,
        participants:[...document.querySelectorAll('.sprite-container.timeline-participant')].map(n=>n.id.replace(/^token-/,'' )).sort(),
        movement:[...document.querySelectorAll('.sprite-container.clash-moving')].map(n=>({id:n.id.replace(/^token-/,''),x:n.style.getPropertyValue('--clash-dx'),y:n.style.getPropertyValue('--clash-dy')}))
      };
    });return row;
  }
  let steps,protocol,surface;
  Object.defineProperty(window,'LuminousCombatSteps',{configurable:true,get:()=>steps,set(api){steps=Object.freeze({...api,create(options){
    const onEvent=options.onEvent,onPresentation=options.onPresentation;
    const rules={...options.rules};
    for(const name of ['damageCombatant','rollSide'])if(typeof rules[name]==='function'){
      const original=rules[name];rules[name]=function(...args){if(data.active&&window.LuminousCombatLiveAdapter073?.state.role==='player')data.ruleCalls++;return original.apply(this,args)};
    }
    return api.create({...options,rules,onEvent(event){
      const at=now();data.events.push({sequence:event.sequence,type:event.type,cue:event.cue,at,rngCursor:event.rngCursor});
      if(event.type==='Presentation'){const k=key(event.cue,event.args);if(!pending.has(k))pending.set(k,[]);pending.get(k).push(event)}
      onEvent?.(event);
    },onPresentation(cue,args){
      if(window.LuminousCombatLiveAdapter073?.state.role==='dm')start(pending.get(key(cue,args))?.shift(),cue,args);
      onPresentation?.(cue,args);
    }});
  }});}});
  Object.defineProperty(window,'LuminousCombatPlayback',{configurable:true,get:()=>protocol,set(api){protocol=Object.freeze({...api,createConsumer(options){
    const present=options.present;
    const core=api.createConsumer({...options,present(cue,args,row,event){renderEvents.set(args,event);return present(cue,args,row,event)}});
    return Object.freeze({...core,receive(row){data.received.push({seq:row.seq,at:now()});return core.receive(row)}});
  }});}});
  Object.defineProperty(window,'LuminousCombatStepRuntime',{configurable:true,get:()=>surface,set(api){
    const wrapped={...api,present(cue,args,...rest){
      const event=rest[1]||renderEvents.get(args),row=start(event,cue,args);
      const operation=measured('presentSync',api.present).call(surface,cue,args,...rest);
      return Promise.resolve(operation).finally(()=>{if(row)row.endAt=now()});
    }};
    for(const name of ['refreshPlayback','queuePlaybackRefresh','flushPlaybackRefresh'])if(typeof api[name]==='function')wrapped[name]=measured(name,api[name]);
    surface=Object.freeze(wrapped);
  }});
  let previous=performance.now();
  function frame(at){const active=data.active&&window.LuminousCombatAuthority073?.state.runningLocal;if(active)data.frames.push({at:now(),ms:at-previous});previous=at;requestAnimationFrame(frame)}requestAnimationFrame(frame);
  new PerformanceObserver(list=>{if(data.active)data.longTasks.push(...list.getEntries().map(e=>({at:performance.timeOrigin+e.startTime,duration:e.duration})))}).observe({type:'longtask'});
}
async function contextFor(browser,viewport,errors,blocked){
  const context=await browser.newContext({viewport:{width:viewport[0],height:viewport[1]},reducedMotion:'no-preference'});
  await context.addInitScript(instrument);
  await context.route('**/*',async route=>{
    const url=route.request().url(),match=url.match(/firebasejs\/8\.10\.1\/(firebase-[a-z]+\.js)/);
    if(match){let body=fs.readFileSync(path.join(harnessRoot,'node_modules/firebase',match[1]),'utf8');
      if(match[1]==='firebase-app.js')body+=`\n(()=>{const original=firebase.initializeApp;firebase.initializeApp=function(config,name){const app=original.call(firebase,{...config,apiKey:'fake',projectId:'demo-combat-results',databaseURL:'https://${namespace}.firebaseio.com'},name);app.auth().useEmulator('http://127.0.0.1:9199',{disableWarnings:true});app.database().useEmulator('127.0.0.1',9100);return app;}})();`;
      await route.fulfill({contentType:'text/javascript',body});return;
    }
    if(!url.startsWith(base)&&!url.startsWith('http://127.0.0.1:9')&&!url.startsWith('data:')){blocked.push(url);await route.abort();return;}
    await route.continue();
  });
  context.on('page',page=>page.on('pageerror',error=>errors.push(error.stack||error.message)));
  return context;
}
async function login(page,user){
  await page.goto(base+'/combate.html');
  await page.locator('#combat-entry-email').fill(user.email);await page.locator('#combat-entry-password').fill(user.password);await page.locator('#combat-entry-login button').click();
  await expect.poll(()=>page.frames().filter(f=>f.url().includes('Battle-viewer')).length,{timeout:60000}).toBeGreaterThan(0);
  const frame=page.frames().find(f=>f.url().includes('Battle-viewer'));
  await frame.waitForFunction(()=>window.LuminousCombatLiveAdapter073?.state.hydratedOnce&&window.LuminousCombat073?.playerId?.()&&window.LuminousCombatAuthority073&&window.LuminousCombatPlanSync073,{},{timeout:60000});
  await frame.waitForFunction(()=>!document.getElementById('game-container')?.classList.contains('intro-running'),{},{timeout:30000});return frame;
}
async function choose(frame,index){
  await expect(frame.locator('#ready')).toBeEnabled({timeout:30000});
  await frame.evaluate(index=>{
    const runtime=LuminousCombat073,unit=runtime.combatants()[runtime.playerId()],card=LuminousCombatSlotDeck073.hand(unit.id,0)[0];
    if(!card)throw Error('No canonical deck hand');
    runtime.restorePlanning([{type:'deck',sourceSlotIndex:0,drawId:card.drawId,targetId:`kobold${index===1?2:1}`,targetSlotIndex:0,clashChoice:'clash',clashConfirmed:true,data:card.skill}],false);
  },index);
  await frame.locator('#ready').click({timeout:30000});
}
async function snapshot(frame){return frame.evaluate(()=>({renderer:{spriteMode:window.LuminousWebGL2Renderer?.spriteMode?.(),quality:window.LuminousWebGL2Renderer?.qualityMode?.(),cores:navigator.hardwareConcurrency,textureCount:window.LuminousWebGL2Renderer?.textureCount?.()},ui:LuminousCombat073.uiState(),authority:{phase:LuminousCombatAuthority073.state.current?.phase,error:LuminousCombatAuthority073.state.lastStartError},domVitals:Object.fromEntries([...document.querySelectorAll('.sprite-container')].map(n=>[n.id.replace(/^token-/,''),{hp:n.querySelector('.hp-number')?.textContent,sp:n.querySelector('.floating-sp-group')?.textContent}])),units:Object.fromEntries(Object.entries(LuminousCombat073.combatants()).map(([id,u])=>[id,{hp:u.hp,sp:u.sp,lifeState:u.lifeState||null,statusEffects:u.statusEffects||{},pendingStatusEffects:u.pendingStatusEffects||[],shieldPools:u.shieldPools||{}}])),telemetry:window.__nine}));}

test('Nine real Battle Viewers compare identical Clashes before and after',async({browser})=>{
  test.setTimeout(1200000);fs.mkdirSync(output,{recursive:true});
  expect(roots.before!==harnessRoot,'A distinct baseline checkout is required').toBeTruthy();
  server=http.createServer((req,res)=>{
    const file=path.resolve(sourceRoot,'.'+decodeURIComponent(new URL(req.url,base).pathname));
    if(!file.startsWith(sourceRoot+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.wav':'audio/wav'})[path.extname(file)]||'application/octet-stream');res.end(body);});
  });await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
  const users=[];for(let index=0;index<9;index++)users.push(await account(index));
  const campaign=fixture(users),cases=[];
  try{
    // ABBA ordering limits warm-up and machine drift bias. All versions use
    // normal production timing, the same seed, fixture, plans and viewport mix.
    for(const [iteration,label] of ['before','after','after','before'].entries()){
      sourceRoot=roots[label];await admin('campaña','PUT',campaign);
      const directory=path.join(output,`${iteration+1}-${label}`);fs.mkdirSync(directory,{recursive:true});
      const contexts=[],pages=[],frames=[],errors=[],blocked=[];
      const result={label,iteration,sha:labels[label],viewports,seed:'0x1234abcd',accounts:9,players:8,fixture:'8 player actions + 2 opposed NPC actions, 3 Coins',complete:false,errors,blocked,clients:[]};
      try{
        for(let index=0;index<9;index++){
          const context=await contextFor(browser,viewports[index],errors,blocked);contexts.push(context);
          const page=await context.newPage();pages.push(page);frames.push(await login(page,users[index]));
        }
        const dm=frames[0];
        await expect.poll(async()=>Object.keys((await admin('campaña/combate/planningAi'))?.plans||{}).length,{timeout:30000}).toBe(2);
        // Explicit fixture actions authored through the real DM planning
        // channel. The real sealer, rules, resolver and animations still run.
        await dm.evaluate(async fixturePlans=>{
          const bridge=LuminousCombatRemoteIntents073,state=bridge.state;
          const row=JSON.parse(JSON.stringify(state.planningAi));
          for(let i=1;i<=2;i++){
            const id=`kobold${i}`,unit=LuminousCombat073.combatants()[id],skill=LuminousCombatLiveAdapter073.state.skills.enemy_s1;
            const option=LuminousCombatSlotDeck073.actionOptions(id,0).find(row=>row.id==='enemy_s1');
            if(!option?.__deckCard?.drawId)throw new Error('NPC fixture has no legal drawn Skill: '+id);
            const plan={...fixturePlans[i-1],type:'deck',drawId:option.__deckCard.drawId,data:option};
            row.plans[id]={0:LuminousCombatAuthority073.serializeRuntimePlan(plan,id,0)};
          }
          await LuminousCombatLiveAdapter073.state.db.ref('campaña/combate/planningAi').set(row);
        },[npcBenchmarkPlan(1,campaign.base_datos_skills.enemy_s1),npcBenchmarkPlan(2,campaign.base_datos_skills.enemy_s1)]);
        await expect.poll(()=>dm.evaluate(()=>LuminousCombat073.combatants().kobold1.autoPlans?.[0]?.targetId)).toBe('player:p1');
        for(const frame of frames)await frame.evaluate(()=>{__nine.active=true});
        const started=Date.now();
        for(let index=1;index<9;index++)await choose(frames[index],index-1);
        await expect.poll(()=>dm.evaluate(()=>__nine.cues.some(row=>row.cue==='clashStart')),{timeout:45000}).toBe(true);
        await Promise.all([pages[0].screenshot({path:path.join(directory,'dm-live-clash.png')}),pages[2].screenshot({path:path.join(directory,'phone-live-clash.png')})]);
        await expect.poll(async()=>(await admin('campaña/combate/estado'))?.round,{timeout:180000}).toBe(2);
        for(const frame of frames)await expect.poll(()=>frame.evaluate(()=>({round:LuminousCombat073.uiState().round,running:LuminousCombatAuthority073.state.runningLocal})),{timeout:60000}).toEqual({round:2,running:false});
        result.wallMs=Date.now()-started;
        result.authority=await admin('campaña/combate/authority/current');
        result.batches=await admin('campaña/combate/playback/current/batches');
        result.canonical=await admin('campaña/combate/combatants');
        result.clients=await Promise.all(frames.map(snapshot));
        const saved=result.authority.checkpoint;
        const checkpoint=saved.stateJson?JSON.parse(saved.stateJson):saved.combatants;
        expect(checkpoint,'Authoritative final combatant snapshot').toBeTruthy();
        const canonical=id=>{const u=checkpoint[id];return {hp:u.hp,sp:u.sp,lifeState:u.lifeState||null,statusEffects:u.statusEffects||{},pendingStatusEffects:u.pendingStatusEffects||[],shieldPools:u.shieldPools||{}}};
        const dmCues=new Map(result.clients[0].telemetry.cues.map(cue=>[cue.sequence,cue]));
        for(const client of result.clients){
          expect(client.telemetry.errors).toEqual([]);
          expect(client.telemetry.profile.length,'Measured runtime API calls').toBeGreaterThan(0);
          expect(client.telemetry.cues.some(row=>row.cue==='clashStart')).toBe(true);
          expect(client.telemetry.cues.some(row=>row.cue==='clashOutcome')).toBe(true);
          expect(client.telemetry.cues.some(row=>row.cue==='hitMotion')).toBe(true);
          for(const id of Object.keys(checkpoint))expect(client.units[id],`canonical results ${id}`).toEqual(canonical(id));
          for(const id of Object.keys(checkpoint).filter(id=>id.startsWith('player:'))){
            expect(client.domVitals[id]?.hp,`visible canonical HP ${id}`).toBe(String(Math.round(checkpoint[id].hp)));
            expect(client.domVitals[id]?.sp,`visible canonical SP ${id}`).toBe(String(Math.round(checkpoint[id].sp)));
          }
          for(const cue of client.telemetry.cues)expect(cue.result,`rendered result of event ${cue.sequence}`).toEqual(dmCues.get(cue.sequence)?.result);
        }
        if(label==='after')for(const client of result.clients){
          expect(client.renderer?.spriteMode,'Shared DOM base composition for DM and Players').toBe('dom-hybrid');
          expect(client.renderer?.textureCount,'No duplicate scene textures in the VFX canvas').toBe(0);
          for(const cue of client.telemetry.cues.filter(c=>c.cue==='clashStart')){
            expect(cue.scene?.camera,'Spectators follow the same Clash camera').toBe('combat');
            expect(cue.scene?.participants,'Real DOM highlights both Clash participants').toEqual([cue.owner,cue.opponent].sort());
            expect(cue.scene?.movement.some(row=>row.id===cue.owner||row.id===cue.opponent),'Clash approach moves actual tokens').toBe(true);
          }
          expect(client.telemetry.cues.some(c=>c.cue==='actionApproach'),'Unopposed movement is transmitted').toBe(true);
          for(const cue of client.telemetry.cues.filter(c=>c.cue==='actionApproach')){
            expect(cue.scene?.camera).toBe('combat');
            expect(cue.scene?.participants).toContain(cue.owner);
            expect(cue.scene?.movement.some(row=>row.id===cue.owner),'Attack approach moves the actual token').toBe(true);
          }
        }
        for(const client of result.clients.slice(1))expect(client.telemetry.ruleCalls,'Players never resolve damage or random Coins locally').toBe(0);
        expect(errors).toEqual([]);result.complete=true;
        await Promise.all(pages.map((page,index)=>page.screenshot({path:path.join(directory,`final-${index}.png`)})));
      }catch(error){
        result.failure=String(error.stack||error);
        result.clients=await Promise.all(frames.map(frame=>snapshot(frame).catch(error=>({failure:String(error)}))));
        result.combatSnapshot=await admin('campaña/combate').catch(()=>null);
        result.authority=result.combatSnapshot?.authority?.current||null;
        result.batches=await admin('campaña/combate/playback/current/batches').catch(()=>null);
        await Promise.all(pages.map((page,index)=>page.screenshot({path:path.join(directory,`failure-${index}.png`),timeout:5000}).catch(()=>{})));
      }finally{
        fs.writeFileSync(path.join(directory,'raw.json'),JSON.stringify(result,null,2));cases.push({label,iteration,complete:result.complete,failure:result.failure||null});
        await Promise.all(contexts.map(context=>context.close()));
      }
      console.log('NINE_BROWSER_CASE',JSON.stringify(cases.at(-1)));
    }
  }finally{fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify({labels,viewports,cases},null,2));await new Promise(resolve=>server.close(resolve));}
  expect(cases.every(row=>row.complete),JSON.stringify(cases,null,2)).toBe(true);
});
