import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
for(const name of ['status-library','status-engine','trait-engine','trait-catalog-core','archetype-engine','archetype-trait-catalog','fighter-maneuver-catalog','fighter-class-runtime','battle-master-archetype-runtime','combat-event-runtime'])await import(`../js/${name}.js`);
const g=globalThis;
g.LuminousClassRuntimeBootstrap={async boot(){g.LuminousBattleMasterArchetypeRuntime.install();return {ok:true}}};
const fighter={id:'master',hp:100,maxHp:100,sp:0,faction:'ally',classes:[{classId:'fighter',levels:15}],characterBuild:{archetypes:[{classId:'fighter',archetypeId:'battle_master'}],maneuvers:{battle_master:['ambush','tactical_assessment']}},equipment:{armor:{instanceId:'ward',effects:[{trigger:'[Combat Start]',type:'status',status:'protection',count:2,target:'self'}]}}};
// Already initialized allies may still receive Tactical Assessment's startup buff.
const ally={id:'ally',hp:100,maxHp:100,faction:'ally',combatEventState:{encounterStarted:'expiry'},statusEffects:{clash_power_up:{id:'clash_power_up',count:1,potency:0,appliedRound:0},damage_up:{id:'damage_up',count:1,potency:0,appliedRound:7}}};
const barbarian={id:'barbarian',hp:100,maxHp:100,sp:0,faction:'other',classes:[{classId:'barbarian',levels:35}]};
const plan=await g.LuminousCombatEventRuntime.planEncounterStart([fighter,ally,barbarian],{encounterId:'expiry',round:1,engine:{randomIntInclusive:()=>0}});
const units=Object.fromEntries(plan.units.map(unit=>[unit.id,unit]));
for(const [unitId,statusId] of [['master','haste'],['master','clash_power_up'],['master','protection'],['ally','clash_power_up'],['barbarian','haste']]){
  assert.equal(units[unitId].statusEffects[statusId].appliedRound,1,`${unitId}: ${statusId} receives live expiry metadata`);
}
assert.equal(units.ally.statusEffects.clash_power_up.count,2,'Existing allied buff was refreshed');
assert.equal(units.ally.statusEffects.damage_up.appliedRound,7,'Unrelated status lifetime is preserved');
// Execute the production viewer's expiry function, rather than a copy of its rule.
const source=fs.readFileSync(new URL('../combat/source/combat-v073-live.html',import.meta.url),'utf8');
const roundEnd=source.slice(source.indexOf('function processStatusRoundEnd('),source.indexOf('function processConditionRemovalTrigger('));
const c=vm.createContext({combatData:units,ensureCombatStatusStore:unit=>unit.statusEffects||{},getCombatStatus:(unit,id)=>unit.statusEffects?.[id]||null,statusDefinition:id=>g.LuminousStatusLibrary.get(id),processWakeUpTurnEnd(){},syncConditionVisuals(){},removeCombatStatus(id,status){delete units[id].statusEffects[status]}});
vm.runInContext(roundEnd,c);
c.processStatusRoundEnd(0);
assert.equal(units.master.statusEffects.haste.count,5,'Startup buffs are active throughout their round');
c.processStatusRoundEnd(1);
for(const [unitId,statusId] of [['master','haste'],['master','clash_power_up'],['master','protection'],['ally','clash_power_up'],['barbarian','haste']])assert.equal(units[unitId].statusEffects[statusId],undefined,`${unitId}: ${statusId} expires at the first round end`);
assert.equal(units.master.statusEffects.superiority.count,10,'Superiority is a persistent resource, not a temporary buff');
assert.equal(units.ally.statusEffects.damage_up.appliedRound,7);
c.processStatusRoundEnd(2);
assert.equal(units.master.statusEffects.haste,undefined,'No temporary bonus leaks into later rounds');
assert.equal(fighter.statusEffects,undefined,'Stamping only changes detached drafts');
console.log('Startup Status expiry: adapter, allied recipient, class and equipment effects expire in the real viewer; persistent resources remain.');
