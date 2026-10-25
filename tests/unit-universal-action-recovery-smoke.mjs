import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const live=read('combat/source/combat-v073-live.html');
const slice=(start,end)=>live.slice(live.indexOf(start),live.indexOf(end,live.indexOf(start)));
function context(controlled){
  const c=vm.createContext({console,JSON,Math,Set,Object,Number,Array});c.window=c;
  for(const name of ['unit-universal-action-policy','unit-universal-action-runtime'])vm.runInContext(read('js/'+name+'.js'),c);
  c.round=1;c.roundEndProgress={round:1,phase:'actions'};c.PLAYER_ID='target';c.activeGrapples=[];c.grappleSerial=0;c.plannedActions=[];
  c.combatData={helper:{id:'helper',hp:30,battleActive:true,faction:'ally'},target:{id:'target',controlled,hp:30,battleActive:true,faction:'ally',autoPlans:[]}};
  c.unitSlots=()=>[];
  vm.runInContext(slice('function plansForUnit(', 'function allPlannedEntries('),c);
  vm.runInContext(slice('function universalPlansByUnit(', '\n',),c);
  const methods=slice('  captureExecution(queue,resolvedKeys){','  async present(cue,args){').trim().replace(/,$/,'');
  c.snapshot=vm.runInContext('({'+methods+'})',c);
  vm.runInContext(slice('function universalHelpBonusForPlan(', 'function clashData('),c);
  return c;
}
for(const controlled of ['player','ai']){
 const c=context(controlled),plan={type:'granted',data:{id:'strike',kind:'skill'},targetId:'enemy',targetSlotIndex:0};
 const plans=[structuredClone(plan),structuredClone(plan),structuredClone(plan)];
 if(controlled==='player')c.plannedActions=plans;else c.combatData.target.autoPlans=plans;
 const r=c.LuminousUnitUniversalActionRuntime;
 r.applyHelp(c.combatData.helper,c.combatData.target,plans[2],2,1,c.combatData);
 assert.equal(c.universalHelpBonusForPlan(plans[2]),1);
 const queue=plans.map((plan,localIndex)=>({ownerId:'target',localIndex,plan}));
 const saved=c.snapshot.captureExecution(queue,new Set(['helper:0']));
 c.plannedActions=[];c.combatData.target.autoPlans=[];
 const restored=[],keys=new Set();c.snapshot.restoreExecution(restored,keys,JSON.parse(JSON.stringify(saved)));
 assert.equal(keys.has('helper:0'),true);
 assert.equal(c.universalHelpBonusForPlan(restored[2].plan),1,'Help survives production capture/restore for '+controlled);
 assert.equal(c.universalHelpBonusForPlan(restored[0].plan),0,'Identical Skills in another Slot never acquire Help');
 assert.equal(c.universalHelpBonusForPlan(restored[1].plan),0);
 restored[2].plan.data.id='replacement';
 assert.equal(c.universalHelpBonusForPlan(restored[2].plan),0,'Changed action cannot inherit buff');
}
for(const controlled of ['player','ai']){
 const c=context(controlled);c.counts={status:0,concentration:0,death:0,after:0,wake:0,exit:0};
 c.combatData.target.hp=30;c.combatData.target.statusEffects={burn:{count:3},poison:{count:2}};
 c.combatStepRuntime=()=>({mutate(_type,_actor,_data,fn){return fn()}});
 c.processConcentrationChecks=()=>c.counts.concentration++;
 c.processStatusRoundEnd=()=>{c.counts.status++;c.combatData.target.hp-=5;c.combatData.target.statusEffects.burn.count--};
 c.processDeathSavesRoundEnd=()=>c.counts.death++;
 c.processWakeUpTurnEnd=()=>c.counts.wake++;
 c.processTurnEndExitActions=()=>c.counts.exit++;
 c.LuminousUnitIndependentActions={runAiPhase(){c.counts.after++}};
 c.entryKey=e=>e.ownerId+':'+e.localIndex;
 vm.runInContext(slice('async function finishRoundExecution(', 'async function startRound('),c);
 const queue=[{ownerId:'target',localIndex:0,plan:{data:{actionKey:'wake_up'}}},{ownerId:'target',localIndex:1,plan:{data:{actionKey:'retreat'}}}],keys=new Set();
 let checkpoint;
 c.executeQueueEntry=async(entry,q,resolved)=>{resolved.add(c.entryKey(entry));checkpoint=c.snapshot.captureExecution(q,resolved);throw Error('reload after first Turn End checkpoint')};
 await assert.rejects(c.finishRoundExecution(queue,keys),/reload/);
 assert.equal(checkpoint.roundEndProgress.phase,'turn_end');
 assert.equal(checkpoint.units.target.hp,25);
 // Model a stale tab before restoring the confirmed checkpoint.
 c.combatData.target.hp=30;c.roundEndProgress={round:1,phase:'actions'};
 const resumed=[],resolved=new Set();c.snapshot.restoreExecution(resumed,resolved,JSON.parse(JSON.stringify(checkpoint)));
 let executed=0;c.executeQueueEntry=async(entry,_queue,keys)=>{executed++;keys.add(c.entryKey(entry))};
 await c.finishRoundExecution(resumed,resolved);
 assert.equal(executed,1,'Only remaining Turn End action resumes');
 assert.equal(c.combatData.target.hp,25,'Burn/Poison cannot tick twice on recovery');
 assert.equal(c.combatData.target.statusEffects.burn.count,2,'Status decay cannot repeat');
 for(const name of ['status','concentration','death','after','wake','exit'])assert.equal(c.counts[name],1,name+' runs once for '+controlled);
 const finished=c.snapshot.captureExecution(resumed,resolved);
 c.snapshot.restoreExecution([],new Set(),finished);
 await c.finishRoundExecution(resumed,resolved);
 assert.equal(c.counts.exit,1,'Completed closing phase is idempotent');
}
console.log('Universal recovery: Player/IA Help identity and Turn End checkpoint resume passed.');

// Seal captures a baseline after a previous round completed. Replaying that
// baseline must execute the new round even before its first action checkpoint.
for(const controlled of ['player','ai'])for(const legacyMarker of [false,true]){
 const c=context(controlled);c.round=2;c.roundEndProgress={round:1,phase:'complete'};
 const plan={type:'granted',data:{id:'strike',kind:'skill'},targetId:'helper',targetSlotIndex:0};
 if(controlled==='player')c.plannedActions=[plan];else c.combatData.target.autoPlans=[plan];
 const saved=c.snapshot.captureExecution([{ownerId:'target',localIndex:0,plan}],new Set());
 assert.equal(saved.roundEndProgress.round,2,'Sealed baseline normalizes round before capture');
 assert.equal(saved.roundEndProgress.phase,'actions');
 if(legacyMarker)saved.roundEndProgress={round:1,phase:'complete'};
 c.recovered=JSON.parse(JSON.stringify(saved));c.timelineRuns=0;c.turnStartRuns=0;c.actions=0;
 c.buildExecutionQueue=()=>[];c.armReactiveDefenses=()=>{};
 c.applyEquipmentTurnStart=()=>c.turnStartRuns++;
 c.executeCombatTimeline=async queue=>{c.timelineRuns++;c.actions+=queue.length};
 c.LuminousCombatStepRuntime=c.snapshot;
 const start=live.indexOf('  const queue=buildExecutionQueue(),',live.indexOf('async function startRound('));
 const gate=live.slice(start,live.indexOf('  closeAllFloatingClashHuds();',start));
 await vm.runInContext('(async()=>{'+gate+'})()',c);
 assert.equal(c.timelineRuns,1,'New-round recovery executes timeline for '+controlled);
 assert.equal(c.actions,1,'Pending action survives recovery before first checkpoint');
 assert.equal(c.turnStartRuns,1);
 // A genuine same-round Turn End checkpoint must continue to skip the timeline.
 c.recovered.roundEndProgress={round:2,phase:'turn_end'};
 await vm.runInContext('(async()=>{'+gate+'})()',c);
 assert.equal(c.timelineRuns,1);
 assert.equal(c.turnStartRuns,1);
}
console.log('New-round recovery: normalized baseline and legacy previous-round markers execute Player/IA timelines; same-round Turn End stays deferred.');
