import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const source=read('combat/source/combat-v073-live.html');
function context(controlled='player'){
 const c=vm.createContext({console,JSON,Math,Map,Set,Promise,addEventListener(){}});c.window=c;
 for(const name of ['unit-universal-action-policy','unit-universal-action-runtime','mastermind-archetype-runtime','core-condition-runtime','item-equipment-effects-runtime'])vm.runInContext(read('js/'+name+'.js'),c);
 Object.assign(c,{round:1,PLAYER_ID:'actor',planReady:false,roundRunning:false,plannedActions:[],OBSERVATION_META:{hp:{stat:'perception'},sp:{stat:'insight'}},CHECK_COIN_COUNT:5,CHECK_COIN_POWER:4,
   conditionCheckThresholdPenalty:()=>0,charmedCheckBonus:()=>0,unitHasStatus:(unit,id)=>Boolean(unit.statusEffects?.[id]),
   syncAllUnitVisibility(){},syncConditionVisuals(){},renderTargetArrows(){}});
 c.combatData={actor:{id:'actor',controlled,hp:40,maxHp:40,faction:'ally',battleActive:true,actionSlots:3,quickActionRemaining:1,skillMods:{perception:0,insight:0},statusEffects:{}},
   friend:{id:'friend',controlled:'ai',hp:40,maxHp:40,faction:'ally',battleActive:true,actionSlots:1,autoPlans:[{type:'auto',data:{id:'strike',kind:'skill'},targetId:'enemy',targetSlotIndex:0}]},
   other:{id:'other',controlled:'ai',hp:40,maxHp:40,faction:'ally',battleActive:true,actionSlots:1,autoPlans:[{type:'auto',data:{id:'other-strike',kind:'skill'},targetId:'enemy',targetSlotIndex:0}]},
   enemy:{id:'enemy',controlled:'ai',hp:40,maxHp:40,faction:'enemy',battleActive:true,statusEffects:{},observationKnown:[]}};
 for(const name of ['plansForUnit','universalPlansByUnit','observationDifficulty','observationLinkedUnits','observationFactAvailable','observationStat','normalizeSaveAbility','unitAbilitySkillModifier','coinHeadsChanceForUnit','rollAbilitySkillCheck','resolveUniversalFreeDraft','requestUniversalInstant']){
   const match=source.match(new RegExp('(?:async )?function '+name+'\\([\\s\\S]*?\\n}'));
   assert.ok(match,name);vm.runInContext(match[0],c);
 }
 c.SAVE_ABILITY_ALIASES={perception:'perception',insight:'insight'};
 return c;
}
const gear=()=>({instanceId:'watcher',quantity:1,condition:100,conditionMax:100,runtime:{equipmentEffects:[{type:'skill_check_bonus',skill:'perception',value:2}]}});
for(const controlled of ['player','ai','remote'])for(const equipped of [true,false]){
 const c=context(controlled),actor=c.combatData.actor;
 if(equipped)actor.equipment={accessories:[gear()]};
 let count=0;c.LuminousCoinEngine={rollSide:()=>count++<2?'head':'tail',coinSrc:()=>''};
 const units=c.combatData,result=c.LuminousUnitUniversalActionRuntime.useInstant(actor,'analyse',{round:1,phase:'planning',units,target:units.enemy,choice:'hp',resolve:c.resolveUniversalFreeDraft});
 assert.equal(result.used,true);
 assert.equal(result.heads,2);
 assert.equal(result.total,equipped?10:8,'Equipment adds exactly +2 to the production check');
 assert.equal(result.threshold,9);
 assert.equal(result.success,equipped);
 assert.equal(units.enemy.observationKnown.includes('hp'),equipped);
 assert.equal(actor.universalActionPhaseLedger.spent.analyse,true);
}
for(const mode of ['duplicate','different','replanned']){
 const c=context(),actor=c.combatData.actor,r=c.LuminousUnitUniversalActionRuntime,p=c.LuminousUnitUniversalActionPolicy;
 actor.classes=[{id:'rogue',level:65}];actor.characterBuild={archetypes:[{classId:'rogue',archetypeId:'mastermind'}]};
 const help=id=>({type:'global',data:{actionKey:'help'},targetId:id,targetSlotIndex:0});
 c.plannedActions=[help('friend')];
 if(mode==='replanned'){
   const prepared=r.prepare(c.combatData,c.universalPlansByUnit(),{round:1});assert.equal(prepared.ok,true);
   actor[p.STORE]=prepared.ledgers.actor;c.plannedActions=[help('other')];
 }
 const targetId=mode==='different'?'other':'friend',before=JSON.stringify(c.combatData);
 const result=await c.requestUniversalInstant('help',{targetId,targetSlotIndex:0,variant:'mastermind_quick'});
 assert.equal(result.used,mode!=='duplicate',mode);
 if(mode==='duplicate'){
   assert.equal(result.reason,'help_target_already_assisted');
   assert.equal(JSON.stringify(c.combatData),before,'Offline rejection cannot spend Quick, mutate ledgers or apply Help/Misdirection');
 }else{
   assert.equal(actor.quickActionRemaining,0);
   assert.equal(Object.values(c.combatData[targetId].universalHelpBuffs).length,1);
 }
 assert.equal(r.prepare(c.combatData,c.universalPlansByUnit(),{round:1}).ok,true,'Offline plans can still start after Quick Help '+mode);
 assert.equal(c.planReady,false);assert.equal(c.roundRunning,false);
}
console.log('Live Free/offline: Analyse retains equipped Perception, and Quick Help respects current normal Help plans without spending on duplicate allies.');
