import assert from 'node:assert/strict';

globalThis.STATUS_REGISTRY = {};
globalThis.combatData = {};

function rawStatus(unit, id) {
  return unit?.statusEffects?.[String(id).toLowerCase().replace(/[^a-z0-9]+/g, '_')] || null;
}
globalThis.LuminousStatusEngine = {
  getStatus(unit, id) { return rawStatus(unit, id); },
  hasStatus(unit, id) { return Boolean(rawStatus(unit, id)); },
  applyStatus(unit, id, input = {}) {
    const key = String(id).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!unit.statusEffects) unit.statusEffects = {};
    const current = unit.statusEffects[key] || { id:key, count:0, potency:0, data:{} };
    if (input.mode === 'set') {
      current.count = Number(input.count ?? current.count ?? 0);
      current.potency = Number(input.potency ?? current.potency ?? 0);
    } else {
      current.count = Number(current.count || 0) + Number(input.count || 0);
      current.potency = Number(current.potency || 0) + Number(input.potency || 0);
    }
    current.data = { ...(current.data || {}), ...(input.data || {}) };
    if (input.sourceUnitId) current.sourceUnitId = input.sourceUnitId;
    unit.statusEffects[key] = current;
    return current;
  },
  removeStatus(unit, id) {
    const key = String(id).toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (!unit?.statusEffects?.[key]) return false;
    delete unit.statusEffects[key];
    return true;
  }
};

let itemSeq = 0;
globalThis.LuminousItemInventoryRuntime = {
  createItemInstance(definition, options = {}) {
    itemSeq += 1;
    return {
      ...definition,
      instanceId: `${definition.id}_${itemSeq}`,
      definitionId: definition.id,
      quantity: Number(options.quantity || 1),
      customData: { ...(options.customData || {}) },
      runtimeState: { ...(options.runtimeState || {}) },
      variantData: { ...(options.variantData || {}) }
    };
  },
  activeContainer(unit, create = false) {
    if (!unit.inventory && create) unit.inventory = {};
    return { key:'inventory', value:unit.inventory || null };
  },
  stashContainer(unit, create = false) {
    if (!unit.stash && create) unit.stash = {};
    return { key:'stash', value:unit.stash || null };
  },
  insertItem(unit, item) {
    if (!unit.inventory) unit.inventory = {};
    unit.inventory[item.instanceId] = item;
    return { inserted:true, quantity:item.quantity, instanceId:item.instanceId, container:'inventory' };
  }
};

globalThis.CombatEngine = {
  currentState: 'PRE_COMBAT_PLANNING',
  calculateDndBonus() { return 1; },
  calculateFinalPower() { return 10; },
  calculateCoinDamage() { return 100; },
  triggerEvent() { return null; },
  triggerPhase() { return null; },
  resolveStandardClash() { return { winner:'A', clashLogs:[{}] }; },
  resolveUnilateralWithCounter() { return { resolved:true }; },
  getCoinProbability() { return 50; },
  resolveSpell(spell, target) {
    return { isSuccess: target.saveSuccess === true, dc:spell.saveDC, savePower:target.saveSuccess ? spell.saveDC : 0 };
  },
  applyDamage(target, amount) {
    target.hp = Math.max(0, Number(target.hp || 0) - Number(amount || 0));
    return { amount };
  },
  getAllAliveUnits() { return Object.values(globalThis.combatData || {}).filter(unit => Number(unit.hp || 0) > 0); }
};

delete globalThis.LuminousSpellCatalog;
delete globalThis.LuminousCantripBatchRuntime;
delete globalThis.LuminousCantripUtilityRuntime;
delete globalThis.LuminousDeathSaveRuntime;

await import('../js/spell-catalog-core.js');
await import('../js/spell-batch-cantrips-runtime.js');
await import('../js/spell-batch-cantrips-utility-runtime.js');
await import('../js/death-save-runtime.js');

const catalog = globalThis.LuminousSpellCatalog;
const base = globalThis.LuminousCantripBatchRuntime;
const utility = globalThis.LuminousCantripUtilityRuntime;
const death = globalThis.LuminousDeathSaveRuntime;
assert.ok(catalog && base && utility && death);

const utilityIds = [
  'control_flames','gust','mold_earth','shape_water','friends','encode_thoughts','guidance',
  'resistance','spare_the_dying','message','thaumaturgy','mage_hand','prestidigitation','magic_stone'
];
for (const id of utilityIds) {
  assert.ok(catalog[id], `missing cantrip ${id}`);
  assert.equal(catalog[id].cantrip, true);
}
assert.equal(Object.values(catalog).filter(spell => spell?.cantrip === true).length, 46);

// Control Flames manipulates only existing Burn and scales slowly.
const caster = { id:'caster', side:'allies', level:40, spellMod:4, hp:100, maxHp:100, speed:8, statusEffects:{}, inventory:{} };
const ally = { id:'ally', side:'allies', hp:100, maxHp:100, speed:6, statusEffects:{} };
const fastAlly = { id:'fast', side:'allies', hp:100, maxHp:100, speed:10, statusEffects:{} };
const enemyA = { id:'enemy-a', side:'enemies', hp:100, maxHp:100, speed:1, statusEffects:{ burn:{id:'burn',potency:2,count:2,data:{}} } };
const enemyB = { id:'enemy-b', side:'enemies', hp:100, maxHp:100, speed:3, statusEffects:{} };
const enemyC = { id:'enemy-c', side:'enemies', hp:100, maxHp:100, speed:5, statusEffects:{} };
const enemyD = { id:'enemy-d', side:'enemies', hp:100, maxHp:100, speed:7, statusEffects:{} };
globalThis.combatData = { caster, ally, fast:fastAlly, 'enemy-a':enemyA, 'enemy-b':enemyB, 'enemy-c':enemyC, 'enemy-d':enemyD };

let result = utility.handleAutomaticCantrip({
  action:{source:{id:'control_flames'},metadata:{sourceDefinition:{materializedAtLevel:40},spellChoice:{key:'controlFlamesMode',value:'feed_potency'}}},
  actor:caster, targets:[enemyA], context:{units:Object.values(globalThis.combatData)}
});
assert.equal(result.amount, 2);
assert.equal(enemyA.statusEffects.burn.potency, 4);

result = utility.handleAutomaticCantrip({
  action:{source:{id:'control_flames'},metadata:{sourceDefinition:{materializedAtLevel:40},spellChoice:{key:'controlFlamesMode',value:'suppress_count'}}},
  actor:caster, targets:[enemyA], context:{units:Object.values(globalThis.combatData)}
});
assert.equal(enemyA.statusEffects.burn.count, 0);

result = utility.handleAutomaticCantrip({
  action:{source:{id:'control_flames'},metadata:{spellChoice:{key:'controlFlamesMode',value:'control_light'}}},
  actor:caster, targets:[caster], context:{units:Object.values(globalThis.combatData)}
});
assert.equal(result.ok, true);
assert.equal(base.ignoresDarknessDisadvantage(caster, Object.values(globalThis.combatData)), false, 'Controlled Flame should benefit Adjacent Units, not its anchor');
assert.equal(base.ignoresDarknessDisadvantage(fastAlly, Object.values(globalThis.combatData)), true);
assert.equal(base.ignoresDarknessDisadvantage(ally, Object.values(globalThis.combatData)), true);

// Gust: failed STR Save applies scaled Bind, no damage.
enemyB.saveSuccess = false;
result = utility.handleAutomaticCantrip({
  action:{source:{id:'gust'},metadata:{spellDC:12,sourceDefinition:{materializedAtLevel:40},spellChoice:{key:'gustMode',value:'push'}}},
  actor:caster, targets:[enemyB], context:{engine:globalThis.CombatEngine,rollSaveHeads:()=>[false,false,false,false,false]}
});
assert.equal(result.failedSave, true);
assert.equal(enemyB.statusEffects.bind.count, 4);

// Mold Earth and Shape Water create persistent abstract terrain affecting the three slowest enemies.
utility.handleAutomaticCantrip({
  action:{source:{id:'mold_earth'},metadata:{spellChoice:{key:'moldEarthMode',value:'difficult_terrain'}}},
  actor:caster,targets:[],context:{}
});
let terrainHits = utility.applyTerrainTurnStart(Object.values(globalThis.combatData));
assert.deepEqual(terrainHits.filter(hit => hit.statusId === 'bind').map(hit => hit.targetId), ['enemy-a','enemy-b','enemy-c']);
assert.equal(enemyD.statusEffects.bind, undefined);

utility.handleAutomaticCantrip({
  action:{source:{id:'shape_water'},metadata:{spellChoice:{key:'shapeWaterMode',value:'freeze'}}},
  actor:caster,targets:[],context:{}
});
terrainHits = utility.applyTerrainTurnStart(Object.values(globalThis.combatData));
assert.equal(enemyA.statusEffects.chill.count, 2);
assert.equal(enemyB.statusEffects.chill.count, 2);
assert.equal(enemyC.statusEffects.chill.count, 2);
assert.equal(enemyD.statusEffects.chill, undefined);

// Friends reuses Charmed and only gates enemies while combat is actually active.
const humanoid = { id:'humanoid', side:'neutral', creatureType:'humanoid', hp:20, speed:4, saveSuccess:false, statusEffects:{} };
globalThis.CombatEngine.currentState = 'PRE_COMBAT_PLANNING';
result = utility.handleAutomaticCantrip({
  action:{source:{id:'friends'},metadata:{spellDC:12}},
  actor:caster,targets:[humanoid],context:{engine:globalThis.CombatEngine,inCombat:false}
});
assert.equal(result.failedSave, true);
assert.ok(humanoid.statusEffects.charmed);
assert.equal(humanoid.statusEffects.charmed.data.removalMode, 'concentration');

// Guidance plugs into the existing Check bonus.
result = utility.handleAutomaticCantrip({
  action:{source:{id:'guidance'},metadata:{spellChoice:{key:'guidanceSkill',value:'perception'}}},
  actor:caster,targets:[ally],context:{}
});
assert.equal(result.ok, true);
assert.equal(globalThis.CombatEngine.calculateDndBonus(ally,'wis','perception'), 3);
assert.equal(globalThis.CombatEngine.calculateDndBonus(ally,'wis','survival'), 1);

// Resistance can protect a Sin once per turn.
utility.handleAutomaticCantrip({
  action:{source:{id:'resistance'},metadata:{spellChoice:{key:'resistanceChoice',value:'sin_wrath'}}},
  actor:caster,targets:[ally],context:{}
});
assert.equal(globalThis.CombatEngine.calculateCoinDamage(enemyA,ally,{sinAffinity:'wrath'},10,false,0,{}), 80);
assert.equal(globalThis.CombatEngine.calculateCoinDamage(enemyA,ally,{sinAffinity:'wrath'},10,false,0,{}), 100);

// Recasting Resistance for an Elemental Status reduces Potency first, once that turn.
utility.handleAutomaticCantrip({
  action:{source:{id:'resistance'},metadata:{spellChoice:{key:'resistanceChoice',value:'status_burn'}}},
  actor:caster,targets:[ally],context:{}
});
globalThis.LuminousStatusEngine.applyStatus(ally,'burn',{mode:'gain',potency:2,count:1});
assert.equal(ally.statusEffects.burn.potency, 1);
assert.equal(ally.statusEffects.burn.count, 1);

// Thaumaturgy Booming Voice uses the same Check channel.
utility.handleAutomaticCantrip({
  action:{source:{id:'thaumaturgy'},metadata:{spellChoice:{key:'thaumaturgyMode',value:'booming_voice'}}},
  actor:caster,targets:[caster],context:{}
});
assert.equal(globalThis.CombatEngine.calculateDndBonus(caster,'cha','intimidation'), 3);

// Encode Thoughts creates a unique 8-hour temporary inventory item.
result = utility.handleAutomaticCantrip({
  action:{source:{id:'encode_thoughts'},metadata:{thoughtContent:'Meet at dawn.'}},
  actor:caster,targets:[caster],context:{}
});
assert.equal(result.ok, true);
assert.equal(result.item.customData.thoughtContent, 'Meet at dawn.');
assert.equal(result.item.customData.sourceSpellId, 'encode_thoughts');
const firstStrand = result.item.instanceId;
result = utility.handleAutomaticCantrip({
  action:{source:{id:'encode_thoughts'},metadata:{thoughtContent:'Second memory.'}},
  actor:caster,targets:[caster],context:{}
});
assert.equal(result.ok, true);
assert.equal(caster.inventory[firstStrand], undefined);

// Prestidigitation Minor Creation is a 6-second Temporary Item and can expire through the shared cleanup.
result = utility.handleAutomaticCantrip({
  action:{source:{id:'prestidigitation'},metadata:{createdItemName:'Lock Pick',spellChoice:{key:'prestidigitationMode',value:'minor_creation'}}},
  actor:caster,targets:[caster],context:{}
});
assert.equal(result.ok, true);
assert.equal(result.item.name, 'Lock Pick');
assert.equal(result.item.customData.cannotDealDamage, true);
utility.cleanupExpiredTemporaryItems(caster, result.expiresAt + 1);
assert.equal(caster.inventory[result.item.instanceId], undefined);

// Magic Stone uses Temporary Ammo Items and remembers the enchanter's Spell Mod.
result = utility.handleAutomaticCantrip({
  action:{source:{id:'magic_stone'},metadata:{spellMod:4}},
  actor:caster,targets:[caster],context:{}
});
assert.equal(result.ok, true);
assert.equal(result.item.quantity, 3);
assert.equal(result.item.category, 'ammo');
assert.equal(result.item.customData.magicStoneDamage, 6);
const stoneTarget = { id:'stone-target', hp:20, statusEffects:{} };
assert.equal(utility.resolveMagicStoneHit(result.item, stoneTarget, {engine:globalThis.CombatEngine}).damage, 6);
assert.equal(stoneTarget.hp, 14);

// Mage Hand is a non-targetable Background Unit, not a Summon.
result = utility.handleAutomaticCantrip({
  action:{source:{id:'mage_hand'},metadata:{sourceDefinition:{materializedAtLevel:40}}},
  actor:caster,targets:[caster],context:{combatData:globalThis.combatData,units:Object.values(globalThis.combatData)}
});
assert.equal(result.ok, true);
assert.equal(result.entity.isBackgroundUnit, true);
assert.equal(result.entity.isSummon, false);
assert.equal(result.entity.targetable, false);

// Stable: remain Downed at 0 HP and skip Death Saves until destabilized.
const downed = { id:'downed', isPlayer:true, hp:0, maxHp:100, lifeState:'downed', isDowned:true, statusEffects:{} };
death.ensureDeathState(downed);
assert.equal(death.stabilize(downed,{source:'spare_the_dying'}).stabilized, true);
assert.equal(death.isStable(downed), true);
assert.equal(death.resolveDeathSave(downed).reason, 'stable');
assert.equal(downed.deathSaves.successes, 0);
assert.equal(downed.deathSaves.failures, 0);
death.addFailure(downed,{reason:'hit_while_downed'});
assert.equal(death.isStable(downed), false);
assert.equal(downed.deathSaves.failures, 1);

// Spare the Dying uses the Stable state directly.
death.stabilize(downed,{source:'test'});
result = utility.handleAutomaticCantrip({
  action:{source:{id:'spare_the_dying'}},actor:caster,targets:[downed],context:{}
});
assert.equal(result.ok, true);
assert.equal(death.isStable(downed), true);

console.log('Cantrip utility batch smoke: OK');
