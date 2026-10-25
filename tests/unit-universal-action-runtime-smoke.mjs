import assert from 'node:assert/strict';
import '../js/unit-universal-action-policy.js';
import '../js/unit-universal-action-runtime.js';
import '../js/mastermind-archetype-runtime.js';
const p=globalThis.LuminousUnitUniversalActionPolicy,r=globalThis.LuminousUnitUniversalActionRuntime;
const unit=(id,controlled='player')=>({id,name:id,controlled,hp:40,maxHp:40,battleActive:true,faction:'ally',actionSlots:3,speed:6,statusEffects:{}});
const skill=id=>({type:'granted',data:{id,kind:'skill',basePower:4,coinPower:4,coinAmount:5},targetId:'enemy',targetSlotIndex:0});
const ua=(key,targetId=null,targetSlotIndex=null)=>({type:'global',data:{actionKey:key},targetId,targetSlotIndex});
for(const controlled of ['player','ai','remote']){
 const actor=unit(controlled,controlled),friend=unit('friend'),enemy={...unit('enemy','ai'),faction:'enemy'},units={[actor.id]:actor,friend,enemy},plans={[actor.id]:[ua('help','friend',2),skill('attack'),ua('escape')],friend:[skill('a'),skill('b'),skill('c')]};
 const prepared=r.prepare(units,plans,{round:1});assert.equal(prepared.ok,true);for(const [id,ledger]of Object.entries(prepared.ledgers))units[id][p.STORE]=ledger;
 const entry={ownerId:actor.id,localIndex:0,plan:plans[actor.id][0]};assert.equal(r.commitEntry(entry,units,plans,1,'combat_phase').ok,true);assert.equal(r.commitEntry(entry,units,plans,1,'combat_phase').ok,false);
 r.applyHelp(actor,friend,plans.friend[2],2,1,units);assert.equal(r.helpBonus(friend,plans.friend[2],2,1,units),1);assert.equal(r.helpBonus(friend,plans.friend[0],0,1,units),0);assert.equal(r.helpBonus(friend,skill('replacement'),2,1,units),0);
 actor.hp=0;assert.equal(r.helpBonus(friend,plans.friend[2],2,1,units),0);assert.equal(r.commitEntry({ownerId:actor.id,localIndex:2,plan:plans[actor.id][2]},units,plans,1,'on_turn_end').reason,'unit_not_active');assert.deepEqual(p.snapshot(actor,{round:1}).ledger.reserved,{});
}
for(const controlled of ['player','ai']){
 const actor=unit(controlled,controlled),target={...unit('target'),statusEffects:{frightened:{count:1},restrained:{count:3},sleep:{count:1}}},units={[actor.id]:actor,target,enemy:{...unit('enemy'),faction:'enemy'}};
 for(const [a,b]of [['calm','liberate'],['help','grapple'],['retreat','escape'],['wake_up','retreat']]){const plans={[actor.id]:[ua(a,'target',0),ua(b,b==='grapple'?'enemy':'target',0)]};assert.equal(r.prepare(units,plans,{round:1,strictTargets:false}).reason,'universal_phase_reserved');}
 assert.equal(r.prepare(units,{[actor.id]:{'3':skill('out')}},{round:1}).reason,'invalid_action_slot');
}
for(const quickFirst of [false,true]){
 const actor={...unit('mind'),classes:[{id:'rogue',level:65}],characterBuild:{archetypes:[{classId:'rogue',archetypeId:'mastermind'}]}},a={...unit('a'),speed:1},b={...unit('b'),speed:4},c={...unit('c'),speed:8},units={mind:actor,a,b,c},plans={mind:[ua('help','a',2)],a:[skill('a0'),skill('a1'),skill('a2')],b:[skill('b0')],c:[skill('c0')]};
 const quick=(id,index=0)=>r.useInstant(actor,'help',{round:1,variant:'mastermind_quick',phase:'planning',units,plans,target:units[id],targetSlotIndex:index,targetActionSlotId:r.slotId(id,index)});
 if(quickFirst)assert.equal(quick('b').used,true);const prepared=r.prepare(units,plans,{round:1});assert.equal(prepared.ok,true);actor[p.STORE]=prepared.ledgers.mind;assert.equal(quick('a',2).used,false);if(!quickFirst)assert.equal(quick('b').used,true);assert.equal(actor.quickActionRemaining,0);assert.equal(quick('c').used,false);
 assert.equal(r.commitEntry({ownerId:'mind',localIndex:0,plan:plans.mind[0]},units,plans,1,'combat_phase').ok,true);r.applyHelp(actor,a,plans.a[2],2,1,units);assert.equal(r.helpBonus(a,plans.a[2],2,1,units),4);assert.ok(a.statusEffects.assist_guard_mind);
}
console.log('Universal runtime: Player/IA quotas, HP 0, exact Help target and real Mastermind/Misdirection passed');
