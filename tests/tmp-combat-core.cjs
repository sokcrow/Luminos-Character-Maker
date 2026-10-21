const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(p,'utf8'),clone=v=>JSON.parse(JSON.stringify(v));
function env(files,other={}){const g={console,queueMicrotask,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},addEventListener(){},...other};g.window=g;vm.createContext(g);for(const f of files)vm.runInContext(read(f),g);return g;}
const store=new Map(),localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
const initial={hostUid:'u1',state:{'campaña':{config:{dm_uid:'u1'},combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1,active:true},combatants:{p1:{id:'p1',isPlayer:true,canonicalPlayerKey:'p1',canonicalOwnerUid:'u1',battleActive:true,hp:130,actionSlots:1}},readyPlayers:{p1:{ready:true,round:1,unitId:'p1'}},plannedActions:{p1:{0:{unitId:'p1',round:1,kind:'global',actionKey:'help'}}}}}}};
localStorage.setItem('test',JSON.stringify(initial));
const g=env(['js/combat-local-store.js','js/combat-participants.js','js/combat-session-lifecycle.js'],{localStorage});
async function run(){
 const db=g.LuminousCombatLocalStore.create('test','u1'),s=g.LuminousCombatSession;
 const raw=(await db.ref('campaña/combate').once('value')).val();const payload={round:1,plans:clone(raw.plannedActions)};
 assert.equal(s.canSeal(raw,payload),true);const cancelled=clone(raw);cancelled.readyPlayers.p1.ready=false;assert.equal(s.canSeal(cancelled,payload),false);
 const running=clone(raw);running.authority={current:{phase:'running'}};await db.ref('campaña/combate').set(running);
 let effects=0;await assert.rejects(s.claimEnd({db,uid:'u1',result:'victory',applyEffects:()=>effects++}),/Espera/);assert.equal(effects,0);
 await db.ref('campaña/combate').set(raw);
 const claim=await s.claimEnd({db,uid:'u1',result:'cancelled',applyEffects:units=>{effects++;units.p1.hp=91;}});
 const again=await s.claimEnd({db,uid:'u1',result:'cancelled',applyEffects:()=>effects++});assert.equal(effects,1);assert.equal(again.estado.ending.token,claim.estado.ending.token);
 assert.equal(s.canSeal(claim,payload),false);
 await s.commitEnd({db,uid:'u1',result:'cancelled',token:claim.estado.ending.token});assert.equal((await db.ref('campaña/combate/estado').once('value')).val().phase,'ENDED');
 const reloaded=g.LuminousCombatLocalStore.create('test','u1');assert.equal((await reloaded.ref('campaña/combate/combatants/p1/hp').once('value')).val(),91);
 const h=env(['js/combat-v073-steps.js']);const units={a:{id:'a',hp:130},b:{id:'b',hp:180}};
 const rules={data:p=>p.data,unit:id=>units[id],rollSide:()=> 'head',coinHeadsChanceForUnit:()=>50,coinSrc:()=>'',clashLevelPowerBonus:()=>0,statusAttackPowerModifier:()=>0,statusClashPowerModifier:()=>0,targetFinalPowerVulnerabilityBonus:()=>0,processConditionRemovalTrigger(){},markEntryStarted(){},triggerBleedOnCoinFlip(){},consumeParalysisOnHead:()=>false};
 const engine=h.LuminousCombatSteps.create({rules,snapshot:()=>units,context:()=>({round:1})});const e=id=>({ownerId:id,localIndex:0,plan:{data:{basePower:5,finalPowerBonus:0,coinPower:0,coinAmount:1}}});
 const clash=await engine.clash(e('a'),e('b'));assert.equal(clash.stalemate,true);assert.equal(clash.clashCount,20);assert.equal(units.a.hp,130);assert.equal(units.b.hp,180);assert.equal(clash.spGain,0);
 const processor=read('js/on-game-dashboard.js').match(/function theatreOutputIsActive\(instanceValue\)\s*\{[^}]+\}/)[0];assert.equal(vm.runInNewContext('('+processor+')')('combate'),true);
 console.log('CORE_PASS',JSON.stringify({cancelDuringResolutionBlocked:true,endingEffectsOnce:true,endingRejectsSealing:true,lateReadyCancellationRejected:true,localPersistence:true,stalemateAfter:clash.clashCount,theatreContinues:true}));
}
run().catch(e=>{console.error(e);process.exitCode=1;});
