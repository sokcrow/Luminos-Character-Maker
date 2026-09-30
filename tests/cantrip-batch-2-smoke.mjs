import assert from 'node:assert/strict';

globalThis.STATUS_REGISTRY = {};
globalThis.combatData = {};

const baseEngine = {
  calculateFinalPower() { return 10; },
  calculateCoinDamage() { return 100; },
  triggerEvent() { return null; },
  triggerPhase() { return null; },
  resolveUnilateralWithCounter(attacker, skill, target) {
    this.__lastUnopposed = { attacker, skill, target };
    return { resolved: true, attackerId: attacker.id, targetId: target.id };
  },
};
globalThis.CombatEngine = baseEngine;

delete globalThis.LuminousSpellCatalog;
delete globalThis.LuminousCantripBatchRuntime;

await import('../js/spell-catalog-core.js');
await import('../js/spell-batch-cantrips-runtime.js');

const catalog = globalThis.LuminousSpellCatalog;
const batch = globalThis.LuminousCantripBatchRuntime;
assert.ok(catalog && batch);

for (const id of [
  'minor_illusion','produce_flame','blade_ward','thorn_whip',
  'lightning_lure','infestation','create_bonfire','eldritch_blast'
]) {
  assert.ok(catalog[id], `missing cantrip ${id}`);
  assert.equal(catalog[id].cantrip, true);
}

assert.equal(batch.STATUS_DEFINITIONS.blade_guard.icon, 'https://imgur.com/qs0vIeM.png');
assert.equal(batch.summonMaxHp({ spellMod: 1 }), 10);
assert.equal(batch.summonMaxHp({ spellMod: 4 }), 40);
assert.equal(batch.summonMaxHp({ spellMod: -2 }), 10);

const summoner = { id:'caster', side:'allies', level:30, spellMod:4, hp:100, statusEffects:{} };
const ally = { id:'ally', side:'allies', hp:100, statusEffects:{}, size:'medium' };
const enemy = { id:'enemy', side:'enemies', hp:100, statusEffects:{} };
globalThis.combatData = { caster:summoner, ally, enemy };

const infestation = batch.spawnSpellEntity(summoner,'infestation',{
  kind:'summon',summonerLevel:30,spellMod:4,context:{combatData:globalThis.combatData}
});
assert.equal(infestation.hp,40);
assert.equal(infestation.maxHp,40);
assert.equal(infestation.targetable,true);
assert.equal(infestation.skills[0].basePower,4);
assert.equal(infestation.skills[0].coinPower,4);
assert.equal(infestation.skills[0].coinAmount,1);

batch.onCantripHit({
  unitAttacker:infestation,
  currentTarget:enemy,
  skill:infestation.skills[0]
});
assert.equal(enemy.statusEffects.poison.potency,3);

const bonfire = batch.spawnSpellEntity(summoner,'create_bonfire',{
  kind:'summon',summonerLevel:30,spellMod:4,concentrationBound:true,
  context:{combatData:globalThis.combatData}
});
assert.equal(bonfire.hp,40);
batch.applyBonfirePresence([summoner,ally,enemy,bonfire,infestation]);
assert.equal(enemy.statusEffects.burn.potency,1);
assert.equal(enemy.statusEffects.burn.count,1);
assert.equal(ally.statusEffects.burn,undefined);

const flame = batch.spawnSpellEntity(summoner,'produce_flame',{
  kind:'background_unit',summonerLevel:30,spellMod:4,concentrationBound:true,
  context:{combatData:globalThis.combatData}
});
assert.equal(flame.isBackgroundUnit,true);
assert.equal(flame.targetable,false);
assert.equal(flame.hp,null);
assert.equal(flame.skills[0].basePower,4);
assert.equal(flame.skills[0].coinPower,5);

const thornTarget = { id:'thorn-target', side:'enemies', hp:100, statusEffects:{} };
batch.onCantripHit({
  unitAttacker:summoner,currentTarget:thornTarget,
  skill:{id:'thorn_whip',materializedAtLevel:30}
});
assert.equal(thornTarget.statusEffects.bind.count,3);
assert.equal(thornTarget.statusEffects.rupture.potency,3);
assert.equal(thornTarget.statusEffects.rupture.count,1);

const lureTarget = { id:'lure-target', side:'enemies', hp:100, statusEffects:{} };
batch.onCantripHit({
  unitAttacker:summoner,currentTarget:lureTarget,
  skill:{id:'lightning_lure',materializedAtLevel:30}
});
assert.equal(lureTarget.statusEffects.bind.count,3);
assert.equal(lureTarget.statusEffects.shock.count,3);

const illusionTarget = { id:'illusion-target', side:'allies', hp:100, size:'medium', statusEffects:{} };
const illusionResult = batch.handleAutomaticCantrip({
  action:{source:{id:'minor_illusion'}},actor:summoner,targets:[illusionTarget],context:{}
});
assert.equal(illusionResult.ok,true);
assert.equal(illusionTarget.statusEffects.illusion.count,10);
assert.equal(globalThis.CombatEngine.calculateFinalPower({isDefense:true},[],illusionTarget),13);
batch.onCantripHit({unitAttacker:enemy,currentTarget:illusionTarget,skill:{id:'enemy_hit'}});
assert.equal(illusionTarget.statusEffects.illusion,undefined);

const largeTarget = { id:'large-target', side:'allies', hp:100, size:'large', statusEffects:{} };
assert.equal(batch.handleAutomaticCantrip({
  action:{source:{id:'minor_illusion'}},actor:summoner,targets:[largeTarget],context:{}
}).reason,'minor_illusion_target_too_large');

const guarded = { id:'guarded', side:'allies', hp:100, statusEffects:{} };
batch.applyStatus(guarded,'blade_guard',{mode:'set',count:1});
assert.equal(globalThis.CombatEngine.calculateCoinDamage(enemy,guarded,{id:'attack'},10,false,0,{}),80);

assert.equal(batch.reuseCountForLevel(1),0);
assert.equal(batch.reuseCountForLevel(29),0);
assert.equal(batch.reuseCountForLevel(30),1);
assert.equal(batch.reuseCountForLevel(60),2);
assert.equal(batch.reuseCountForLevel(90),3);
assert.equal(batch.reuseCountForLevel(100),3);

assert.equal(catalog.thorn_whip.basePower,5);
assert.equal(catalog.thorn_whip.coinPower,4);
assert.equal(catalog.lightning_lure.basePower,5);
assert.equal(catalog.lightning_lure.coinPower,5);
assert.equal(catalog.eldritch_blast.basePower,5);
assert.equal(catalog.eldritch_blast.coinPower,5);
assert.equal(catalog.eldritch_blast.mechanics.reuseSkill.every,30);

console.log('Cantrip batch 2 smoke: OK');
