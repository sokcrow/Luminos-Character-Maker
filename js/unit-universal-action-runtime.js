(function(global){
'use strict';
const policy=()=>global.LuminousUnitUniversalActionPolicy;
const clone=value=>JSON.parse(JSON.stringify(value));
const active=u=>Boolean(u&&u.battleActive!==false&&!u.isBackup&&!u.escaped&&!u.removed&&!u.dead&&!u.defeated&&!u.incapacitated&&Number(u.hp??1)>0);
const actionKey=plan=>policy()?.keyFor(plan?.data?.actionKey||plan?.actionKey||(plan?.source?.type==='universal'?plan.source.id:''))||'';
const slotId=(id,index)=>`${id}_slot_${index}`;
const fail=reason=>({ok:false,reason});
const count=u=>Math.max(1,Math.trunc(Number(u.actionSlots??u.activeSlots)||1));
function fingerprint(plan){const d=plan?.data||plan?.actionData||{},kind=d.kind||plan?.kind||plan?.type||plan?.planType;return JSON.stringify({sourceType:['deck','granted','auto','skill'].includes(kind)?'skill':kind==='spells'?'spell':kind,sourceId:d.actionKey||d.skillId||d.spellId||d.itemId||d.id||d.name,drawId:plan?.drawId||null,targetId:plan?.targetId||null,targetSlotIndex:plan?.targetSlotIndex??null,classId:d.classId||null,slotLevel:d.slotLevel??null,overcast:Boolean(d.overcast),liberateMethod:d.liberateMethod||null});}
function reservationId(unit,plan,index,round){let a=2166136261,b=5381;for(const c of fingerprint(plan)){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return `r${round}-s${index}-${(a>>>0).toString(36)}-${(b>>>0).toString(36)}`;}
function targetGate(unit,plan,units,plans,{strictTargets=true}={}){
const key=actionKey(plan),target=units[plan.targetId];if(['escape','retreat'].includes(key))return{ok:true};
if(!target)return strictTargets?fail('invalid_target'):{ok:true};if(!active(target))return fail('target_not_active');
if(key==='grapple')return target.id!==unit.id&&target.faction!==unit.faction?{ok:true}:fail('invalid_grapple_target');
if(target.faction!==unit.faction||(key==='help'&&target.id===unit.id))return fail('invalid_ally_target');
if(key==='help'){const index=Number(plan.targetSlotIndex);if(plan.targetSlotIndex==null||!Number.isInteger(index)||index<0||index>=count(target))return strictTargets?fail('help_target_slot_required'):{ok:true};const row=plans[target.id]?.[index];if(!row||actionKey(row)||row.type==='intent')return strictTargets?fail('help_target_action_required'):{ok:true};}
const s=target.statusEffects||{};if(key==='calm'&&!s.frightened)return fail('target_not_frightened');if(key==='wake_up'&&!s.sleep)return fail('target_not_asleep');if(key==='liberate'&&Number(s.restrained?.count??s.restrained?.potency??0)<=0)return fail('target_not_restrained');return{ok:true};}
function reservePlans(unit,rows,options={}){
const p=policy();if(!p)return fail('universal_runtime_unavailable');const draft=clone(unit),snap=p.snapshot(draft,options);if(!snap.ok)return snap;
for(const entry of Object.values(snap.ledger.reserved)){const result=p.cancel(draft,{...options,...entry});if(!result.ok)return result;}
for(const [rawIndex,plan]of Object.entries(rows||{})){if(!plan)continue;const index=Number(rawIndex),key=actionKey(plan),definition=p.definitionFor(key);
if(!Number.isInteger(index)||index<0||index>=count(unit)||(plan.sourceSlotIndex!=null&&Number(plan.sourceSlotIndex)!==index))return fail('invalid_action_slot');
if(!definition){if(key&&key!=='grapple_check')return fail('unknown_universal_action');continue;}if(!active(unit))return fail('unit_not_active');if(definition.cost!=='action'||plan.data?.universalVariant)return fail('instant_action_in_slot');
const units=options.units||{[unit.id]:unit},plans=options.plans||{[unit.id]:rows},gate=targetGate(unit,plan,units,plans,options);if(!gate.ok)return gate;
const token=reservationId(unit,plan,index,options.round);delete draft[p.STORE].reservations[token];const result=p.reserve(draft,key,{...options,slotId:slotId(unit.id,index),intentId:token,targetId:plan.targetId||(options.strictTargets===false?'pending':null),targetActionSlotId:plan.targetSlotIndex==null?(options.strictTargets===false?'pending':null):slotId(plan.targetId,plan.targetSlotIndex),targetActionId:plans[plan.targetId]?.[plan.targetSlotIndex]?fingerprint(plans[plan.targetId][plan.targetSlotIndex]):null});if(!result.ok)return result;}
return{ok:true,ledger:draft[p.STORE]};}
function prepare(units,plans,options={}){const ledgers={};for(const [id,rows]of Object.entries(plans||{})){if(!units[id])return fail('unit_required');const result=reservePlans(units[id],rows,{...options,units,plans});if(!result.ok)return{...result,unitId:id};ledgers[id]=result.ledger;}return{ok:true,ledgers};}
function plansFromRaw(raw,payload=null){const groups={},convert=global.LuminousCombatRemoteIntents073?.runtimePlan;function include(rows,fallback){for(const [index,row]of Object.entries(rows||{})){const id=row?.unitId||fallback;if(!id||Number(row.round||payload?.round||0)!==Number(raw.estado?.round||payload?.round||1))continue;groups[id]||={};groups[id][index]=convert?convert(row,Number(index),raw.combatants?.[id]):{type:row.planType||row.kind,data:row.actionData||{actionKey:row.actionKey},targetId:row.targetId,targetSlotIndex:row.targetSlotIndex,sourceSlotIndex:row.sourceSlotIndex,drawId:row.drawId};}}
if(!payload)for(const row of Object.values(raw.readyPlayers||{}))include(row.targetIntents,row.unitId);for(const rows of Object.values(payload?.plans||raw.plannedActions||{}))include(rows);for(const [id,rows]of Object.entries(payload?.aiPlans||raw.planningAi?.plans||{}))include(rows,id);return groups;}
function prepareSealed(raw,payload){const units=Object.fromEntries(Object.entries(raw.combatants||{}).map(([id,u])=>[id,{...u,id}]));return prepare(units,plansFromRaw(raw,payload),{round:Number(payload.round)});}
function planAiRoster(units,options={}){
const adapter=global.LuminousUnitAiKitAdapter;if(!adapter?.planUnitTurn)return false;
const ai=Object.values(units).filter(u=>u.controlled==='ai'&&active(u));
const groups=()=>Object.fromEntries(Object.values(units).map(unit=>[unit.id,unit.autoPlans||[]]));
const validRoster=()=>{const plans=groups();return ai.every(unit=>reservePlans(unit,unit.autoPlans||[],{...options,units,plans}).ok)};
const previous=ai.map(unit=>[unit,unit.autoPlans]);
function propose(unit,allowHelp){
if(unit.autoPlans?.some(plan=>plan?.data?.actionKey==='grapple_check'))return null;
const rows=global.LuminousCombat073?.kit?.(unit.id)?.actions||[],deck=global.LuminousCombatSlotDeck073;
const optionsBySlot=Array.from({length:count(unit)},(_,index)=>deck?.actionOptions?deck.actionOptions(unit.id,index,rows):rows);
const legalSkills=optionsBySlot.map(options=>new Set(options.filter(row=>row.kind!=='spell').map(row=>String(row.id||row.skillId))));
const legalRows=optionsBySlot.flat(),actor={...unit,traits:[],combatTraits:[],activeTraits:[],resolvedSkills:legalRows.filter(row=>row.kind!=='spell'&&global.LuminousUnitIndependentActions?.costOf(row)==='action'),resolvedSpells:legalRows.filter(row=>row.kind==='spell'&&global.LuminousUnitIndependentActions?.costOf(row)==='action')},allies=Object.values(units).filter(u=>u.faction===unit.faction&&active(u));
const committed=allies.flatMap(u=>(u.autoPlans||[]).flatMap((plan,index)=>!plan||actionKey(plan)?[]:[{id:fingerprint(plan),actorId:u.id,actionSlotId:slotId(u.id,index),phase:{executesAt:'combat_phase'},resolution:{type:'clash'},metadata:{sourceDefinition:plan.data}}]));
const result=adapter.planUnitTurn({actor,allies,allowHelp,isSourceAllowedInSlot:(candidate,_slot,index)=>candidate.sourceType!=='skill'||legalSkills[index].has(String(candidate.sourceId)),alliedCommittedActions:committed,targets:Object.values(units).filter(u=>u.faction!==unit.faction&&active(u)),availableSlots:count(unit),slotIds:Array.from({length:count(unit)},(_,i)=>slotId(unit.id,i)),supportsTurnEndActions:true,allowEscape:true,allowUniversalOnly:true,universalActions:Object.keys(policy().DEFINITIONS).filter(key=>policy().DEFINITIONS[key].cost==='action'&&(!Array.isArray(unit.aiUniversalActions)||unit.aiUniversalActions.includes(key)))});if(!result?.planned)return null;
const plans=[];let legal=true;
for(const action of result.actions){
const index=Array.from({length:count(unit)},(_,i)=>slotId(unit.id,i)).indexOf(action.actionSlotId);if(index<0||plans[index]){legal=false;break;}
const type=action.source?.type,option=type==='skill'?optionsBySlot[index].find(row=>String(row.id||row.skillId)===String(action.source.id)):null;
if(type==='skill'&&!option){legal=false;break;}
const d=clone(option||action.metadata?.sourceDefinition||rows.find(row=>row.id===action.source?.id)||{}),targetId=action.targeting?.mainTargetId;
if(type==='universal')plans[index]={type:'global',sourceSlotIndex:index,data:{...d,kind:'global',id:action.source.id,actionKey:action.source.id},targetId,targetSlotIndex:action.metadata?.targetActionSlotId==null?null:Number(String(action.metadata.targetActionSlotId).split('_slot_').at(-1))};
else plans[index]={type:d.__deckCard?'deck':type==='spell'?'spells':type==='item'?'items':d.kind==='defense'?'defense':'auto',sourceSlotIndex:index,...(d.__deckCard?{drawId:d.__deckCard.drawId}:{}),data:{...d,...(type==='item'?{npcItem:true}:{})},targetId,targetSlotIndex:0};
}
if(!legal)return null;
const proposed={...groups(),[unit.id]:plans};
return reservePlans(unit,plans,{...options,units,plans:proposed}).ok?plans:null;
}
// First finalize ordinary actions and withdrawal. Only then choose Help against
// that roster. A later helper cannot invalidate an aid accepted earlier.
for(const unit of ai){const plans=propose(unit,false);if(plans)unit.autoPlans=plans;}
if(!validRoster()){for(const [unit,plans]of previous)unit.autoPlans=plans;return false;}
for(const unit of ai){
const plans=propose(unit,true);if(!plans)continue;
const baseline=unit.autoPlans;unit.autoPlans=plans;
if(!validRoster())unit.autoPlans=baseline;
}
return validRoster();}
function cancelPending(unit,round){const p=policy(),snap=p?.snapshot(unit,{round});if(!snap?.ok)return;for(const entry of Object.values(snap.ledger.reserved))p.cancel(unit,{round,...entry});unit.retreatPendingRound=unit.escapePendingRound=0;}
function commitEntry(entry,units,plans,round,phase){const p=policy(),unit=units[entry.ownerId],key=actionKey(entry.plan),def=p?.definitionFor(key);if(!def)return{ok:true,ordinary:true};if(!active(unit)){if(unit)cancelPending(unit,round);return fail('unit_not_active');}if(def.phase!==phase)return fail('wrong_execution_phase');const snap=p.snapshot(unit,{round});if(!snap.ok)return snap;const gate=targetGate(unit,entry.plan,units,plans);if(!gate.ok){const row=snap.ledger.reserved[phase];if(row)p.cancel(unit,{round,...row});return gate;}const reserved=snap.ledger.reserved[phase],targetPlan=plans[entry.plan.targetId]?.[entry.plan.targetSlotIndex];if(key==='help'&&Number(targetPlan?._universalStartedRound)===round){if(reserved)p.cancel(unit,{round,...reserved});return fail('help_target_already_started');}if(key==='help'&&reserved?.targetActionId!==fingerprint(targetPlan))return fail('help_target_changed');return p.commit(unit,{round,phase,slotId:slotId(unit.id,entry.localIndex),reservationId:reservationId(unit,entry.plan,entry.localIndex,round)});}
function applyHelp(unit,target,plan,index,round,units={}){const m=global.LuminousMastermindArchetypeRuntime,amount=1+(m?.hasMastermindLevel?.(unit,15)?m.helpAdditionalBonus(unit,target,{units:Object.values(units).filter(active)}):0);target.universalHelpBuffs=Object.values(target.universalHelpBuffs||{});target.universalHelpBuffs.push({round,sourceId:unit.id,targetActionSlotId:slotId(target.id,index),targetActionId:fingerprint(plan),amount});if(m?.hasMastermindLevel?.(unit,65))m.applyAssistGuard(target,unit,1);return amount;}
function helpBonus(target,plan,index,round,units){return Object.values(target.universalHelpBuffs||{}).filter(b=>Number(b.round)===round&&b.targetActionSlotId===slotId(target.id,index)&&b.targetActionId===fingerprint(plan)&&active(units[b.sourceId])).reduce((sum,b)=>sum+b.amount,0);}
function useInstant(unit,key,options={}){const p=policy();if(!p)return{used:false,reason:'universal_runtime_unavailable'};if(!active(unit))return{used:false,reason:'unit_not_active'};if(!['planning','pre_combat_planning'].includes(options.phase||'planning'))return{used:false,reason:'planning_required'};
const variant=options.variant,round=Number(options.round),target=options.target;
const condition=global.LuminousConditionRuntime?.actionAvailability?.(unit,variant==='mastermind_quick'?'quick_action':'free_action',{phase:options.phase||'planning',universalAction:true});
if(condition?.available===false)return{used:false,reason:condition.reason||'condition_blocks_action'};
// Preview the current normal plans before Quick Help. UI previews do not
// install reservations; online and offline must enforce the same ally rule.
let gateUnit=unit;
if(variant==='mastermind_quick'&&options.plans){
const prepared=reservePlans(unit,options.plans[unit.id]||[],{round,units:options.units,plans:options.plans});
if(!prepared.ok)return{used:false,reason:prepared.reason};
gateUnit={...unit,[p.STORE]:prepared.ledger};
}
const gate=p.check(gateUnit,key,{round,variant,targetId:target?.id,targetActionSlotId:options.targetActionSlotId});if(!gate.ok)return{used:false,reason:gate.reason};
global.LuminousUnitIndependentActions?.prepareRound?.(unit,round);
if(variant==='mastermind_quick'){const index=options.targetSlotIndex,plan=options.plans?.[target?.id]?.[index],valid=targetGate(unit,{data:{actionKey:'help'},targetId:target?.id,targetSlotIndex:index},options.units,options.plans);if(!valid.ok||!plan)return{used:false,reason:valid.reason||'help_target_action_required'};if(Number(unit.quickActionRemaining??1)<=0)return{used:false,reason:'quick_action_spent'};const spent=p.useInstant(gateUnit,key,{round,variant,targetId:target.id,targetActionSlotId:slotId(target.id,index),targetActionId:fingerprint(plan)});if(!spent.ok)return{used:false,reason:spent.reason};unit[p.STORE]=gateUnit[p.STORE];unit.quickActionRemaining=Math.max(0,Number(unit.quickActionRemaining??1)-1);const budget=global.LuminousActionEconomy?.ensureState?.(unit);if(budget)budget.quickActionRemaining=unit.quickActionRemaining;applyHelp(unit,target,plan,index,round,options.units);return{used:true,cost:'quick_action',sourceId:'help',targetId:target.id};}
if(typeof options.resolve!=='function')return{used:false,reason:'universal_handler_missing'};const result=options.resolve(unit,key,options);if(!result?.attempted)return{used:false,reason:result?.reason||'invalid_target'};const spent=p.useInstant(unit,key,{round});if(!spent.ok)return{used:false,reason:spent.reason};return{used:true,cost:'free_action',sourceId:key,...result};}
global.LuminousUnitUniversalActionRuntime=Object.freeze({active,actionKey,slotId,planAiRoster,fingerprint,reservationId,targetGate,reservePlans,prepare,plansFromRaw,prepareSealed,cancelPending,commitEntry,applyHelp,helpBonus,useInstant});
})(typeof window!=='undefined'?window:globalThis);
