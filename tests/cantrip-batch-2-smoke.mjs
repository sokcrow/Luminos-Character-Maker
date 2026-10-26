import assert from 'node:assert/strict';

globalThis.STATUS_REGISTRY = {};
globalThis.combatData = {};

const baseEngine = {
  calculateFinalPower() { return 10; },
  calculateCoinDamage() { return 100; },
  triggerEvent() { return null; },
  triggerPhase() { return null; },
  resolveStandardClash() { return { winner:'A', clashLogs:[{}] }; },
  applyDamage(target, amount) { target.hp = Math.max(0, Number(target.hp || 0) - Number(amount || 0)); return { amount }; },
  resolveUnilateralWithCounter(attacker, skill, target, counterSkill = null) {
    this.__lastUnopposed = { attacker, skill, target, counterSkill };
    this.__lastCounterSkill = counterSkill;
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
  'lightning_lure','infestation','create_bonfire','eldritch_blast',
  'acid_splash','ray_of_frost','frostbite','sacred_flame',
  'shocking_grasp','toll_the_dead','word_of_radiance','thunderclap',
  'sapping_sting','primal_savagery','sword_burst','dancing_lights','light','mending','druidcraft'
]) {
  assert.ok(catalog[id], `missing cantrip ${id}`);
  assert.equal(catalog[id].cantrip, true);
}

assert.equal(batch.STATUS_DEFINITIONS.blade_guard.icon, 'Assets/Icons/status/cantrips/blade_guard.png');
assert.equal(batch.summonMaxHp({ spellMod: 1 }), 10);
assert.equal(batch.summonMaxHp({ spellMod: 4 }), 40);
assert.equal(batch.summonMaxHp({ spellMod: -2 }), 10);

const summoner = { id:'caster', side:'allies', level:30, spellMod:4, hp:100, maxHp:100, speed:8, statusEffects:{} };
const ally = { id:'ally', side:'allies', hp:100, maxHp:100, speed:6, statusEffects:{}, size:'medium' };
const fastAlly = { id:'fast-ally', side:'allies', hp:100, maxHp:100, speed:10, statusEffects:{} };
const farAlly = { id:'far-ally', side:'allies', hp:100, maxHp:100, speed:4, statusEffects:{} };
const enemy = { id:'enemy', side:'enemies', hp:100, maxHp:100, speed:2, statusEffects:{} };
globalThis.combatData = { caster:summoner, ally, fastAlly, farAlly, enemy };

const infestation = batch.spawnSpellEntity(summoner,'infestation',{
  kind:'summon',summonerLevel:30,spellMod:4,context:{combatData:globalThis.combatData}
});
assert.equal(infestation.hp,40);
assert.equal(infestation.maxHp,40);
assert.equal(infestation.targetable,true);
assert.equal(infestation.visual.spriteUrl,'Assets/Images/SpellUnits/infestation.png');
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
assert.equal(bonfire.visual.spriteUrl,'Assets/Images/SpellUnits/bonfire.png');
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
assert.equal(flame.visual.spriteUrl,'Assets/Images/SpellUnits/produce_flame.png');
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

const acidTarget = { id:'acid-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
batch.onCantripHit({ unitAttacker:summoner,currentTarget:acidTarget,skill:{id:'acid_splash',materializedAtLevel:30} });
assert.equal(acidTarget.statusEffects.corrosion.count,3);

const frostTarget = { id:'frost-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
batch.onCantripHit({ unitAttacker:summoner,currentTarget:frostTarget,skill:{id:'ray_of_frost',materializedAtLevel:30} });
assert.equal(frostTarget.statusEffects.bind.count,2);
assert.equal(frostTarget.statusEffects.chill.count,3);

const frostbiteTarget = { id:'frostbite-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
batch.onCantripHit({ unitAttacker:summoner,currentTarget:frostbiteTarget,skill:{id:'frostbite',materializedAtLevel:30} });
assert.equal(frostbiteTarget.statusEffects.attack_power_down.count,1);
assert.equal(frostbiteTarget.statusEffects.chill.count,3);

const sacredTarget = { id:'sacred-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
batch.onCantripHit({ unitAttacker:summoner,currentTarget:sacredTarget,skill:{id:'sacred_flame',materializedAtLevel:30} });
assert.equal(sacredTarget.statusEffects.radiance.count,3);

const shockTarget = { id:'shock-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
batch.onCantripHit({ unitAttacker:summoner,currentTarget:shockTarget,skill:{id:'shocking_grasp',materializedAtLevel:30} });
assert.equal(shockTarget.statusEffects.shock.count,3);
globalThis.CombatEngine.resolveUnilateralWithCounter(summoner,{id:'shocking_grasp'},shockTarget,{id:'counter'});
assert.equal(globalThis.CombatEngine.__lastCounterSkill,null);

const tollTarget = { id:'toll-target', side:'enemies', hp:50, maxHp:100, statusEffects:{} };
assert.equal(globalThis.CombatEngine.calculateCoinDamage(summoner,tollTarget,{id:'toll_the_dead',materializedAtLevel:30},10,false,0,{}),126);
const fullHpTollTarget = { id:'full-toll-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
assert.equal(globalThis.CombatEngine.calculateCoinDamage(summoner,fullHpTollTarget,{id:'toll_the_dead',materializedAtLevel:30},10,false,0,{}),100);
batch.onCantripHit({ unitAttacker:summoner,currentTarget:tollTarget,skill:{id:'toll_the_dead',materializedAtLevel:30} });
assert.equal(tollTarget.statusEffects.decay.count,3);

const radianceAoeTarget = { id:'radiance-aoe-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
batch.onCantripHit({ unitAttacker:summoner,currentTarget:radianceAoeTarget,skill:{id:'word_of_radiance',materializedAtLevel:30} });
assert.equal(radianceAoeTarget.statusEffects.radiance.count,3);

const thunderTarget = { id:'thunder-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
batch.onCantripHit({ unitAttacker:summoner,currentTarget:thunderTarget,skill:{id:'thunderclap',materializedAtLevel:30} });
assert.equal(thunderTarget.statusEffects.tremor.potency,3);


const stingTarget = { id:'sting-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
batch.onCantripHit({ unitAttacker:summoner,currentTarget:stingTarget,skill:{id:'sapping_sting',materializedAtLevel:30} });
assert.equal(stingTarget.statusEffects.prone.count,1);
assert.equal(stingTarget.statusEffects.decay.count,3);

const primalTarget = { id:'primal-target', side:'enemies', hp:100, maxHp:100, statusEffects:{} };
batch.onCantripHit({ unitAttacker:summoner,currentTarget:primalTarget,skill:{id:'primal_savagery',materializedAtLevel:30} });
assert.equal(primalTarget.statusEffects.corrosion.count,3);

const lightResult = batch.handleAutomaticCantrip({
  action:{source:{id:'light'}},actor:summoner,targets:[summoner],context:{units:[fastAlly,summoner,ally,farAlly,enemy],combatData:globalThis.combatData}
});
assert.equal(lightResult.ok,true);
assert.deepEqual(batch.adjacentUnits(summoner,[fastAlly,summoner,ally,farAlly,enemy]).map((unit)=>unit.id),['fast-ally','ally']);
assert.equal(batch.ignoresDarknessDisadvantage(summoner,[fastAlly,summoner,ally,farAlly,enemy]),true);
assert.equal(batch.ignoresDarknessDisadvantage(fastAlly,[fastAlly,summoner,ally,farAlly,enemy]),true);
assert.equal(batch.ignoresDarknessDisadvantage(ally,[fastAlly,summoner,ally,farAlly,enemy]),true);
assert.equal(batch.ignoresDarknessDisadvantage(farAlly,[fastAlly,summoner,ally,farAlly,enemy]),false);

const dancing = batch.handleAutomaticCantrip({
  action:{source:{id:'dancing_lights'}},actor:summoner,targets:[summoner,ally,fastAlly,farAlly],context:{units:[summoner,ally,fastAlly,farAlly,enemy],combatData:globalThis.combatData}
});
assert.equal(dancing.ok,true);
assert.equal(dancing.count,4);
assert.equal(batch.ignoresDarknessDisadvantage(farAlly,[fastAlly,summoner,ally,farAlly,enemy]),true);

const construct = { id:'construct', creatureType:'construct', hp:10, maxHp:30, statusEffects:{} };
const mendingUnit = batch.handleAutomaticCantrip({action:{source:{id:'mending'}},actor:summoner,targets:[construct],context:{}});
assert.equal(mendingUnit.ok,true);
assert.equal(construct.hp,15);
const item = { currentDurability:10, maxDurability:40 };
const repairedItem = batch.repairItemDurability(item,1);
assert.equal(repairedItem.repaired,true);
assert.equal(item.currentDurability,11);

globalThis.LuminousWeatherEngine = {
  getState:()=>({actual:{tipo:'soleado'}}),
  getDefinition:(id)=>({label:id}),
  getTransitionBreakdown:(id)=>[{target:id==='soleado'?'nublado':'soleado',probability:100}],
};
const forecastResult = batch.handleAutomaticCantrip({
  action:{source:{id:'druidcraft'},metadata:{spellChoice:{key:'druidcraftMode',value:'forecast'}}},
  actor:summoner,targets:[summoner],context:{}
});
assert.equal(forecastResult.ok,true);
assert.equal(forecastResult.forecast.hours,24);
assert.equal(forecastResult.forecast.entries[0].tipo,'soleado');
assert.equal(forecastResult.forecast.entries.at(-1).etaMin,1440);

const burstTarget = { id:'burst-target', side:'enemies', hp:20, maxHp:20, statusEffects:{} };
batch.handleAutomaticCantrip({action:{source:{id:'sword_burst'}},actor:summoner,targets:[summoner],context:{}});
globalThis.CombatEngine.resolveStandardClash(summoner,{id:'a'},burstTarget,{id:'b'});
assert.equal(burstTarget.hp,17);

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

assert.equal(catalog.acid_splash.attackWeight,3);
assert.equal(catalog.acid_splash.basePower,4);
assert.equal(catalog.acid_splash.coinPower,5);
assert.equal(catalog.ray_of_frost.basePower,5);
assert.equal(catalog.ray_of_frost.coinPower,5);
assert.equal(catalog.frostbite.coinPower,4);
assert.equal(catalog.sacred_flame.coinPower,5);
assert.equal(catalog.shocking_grasp.mechanics.suppressCounter,true);
assert.equal(catalog.toll_the_dead.mechanics.woundedTargetDamagePercent.base,20);
assert.equal(catalog.word_of_radiance.attackWeight,3);
assert.equal(catalog.thunderclap.attackWeight,3);
assert.equal(catalog.sapping_sting.save.abilityId,'con');
assert.equal(catalog.sapping_sting.mechanics.saveAttackOnFailure,true);
assert.equal(catalog.primal_savagery.basePower,5);
assert.equal(catalog.primal_savagery.coinPower,6);
assert.equal(catalog.sword_burst.mechanics.afterClashFixedDamage,3);
assert.equal(catalog.dancing_lights.concentration,true);
assert.equal(catalog.light.mechanics.adjacentRule,'speed_order');
assert.equal(catalog.mending.castingTimeSeconds,60);
assert.equal(catalog.druidcraft.mechanics.forecastHours,24);

console.log('Cantrip batch 2 smoke: OK');
