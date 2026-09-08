import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

globalThis.STATUS_REGISTRY = {};
globalThis.LuminousStatusEngine = (() => {
  const api = {
    getDefinition(id) { return globalThis.STATUS_REGISTRY[id] || null; },
    ensureStore(unit) { unit.statusEffects ||= {}; return unit.statusEffects; },
    applyStatus(unit, id, input = {}) {
      const gate = globalThis.LuminousConditionRuntime?.canApplyStatus?.(unit, id, input);
      if (gate?.allowed === false) return null;
      const store = api.ensureStore(unit); const existing = store[id]; const mode = input.mode || 'gain';
      const next = existing && typeof existing === 'object' ? existing : { id, count: 0, potency: 0, data: {} };
      if (mode === 'set') { next.count = Number(input.count ?? 1); next.potency = Number(input.potency ?? 0); }
      else { next.count += Number(input.count ?? 1); next.potency += Number(input.potency ?? 0); }
      next.sourceUnitId = input.sourceUnitId ?? next.sourceUnitId ?? null;
      next.data = { ...(next.data || {}), ...(input.data || {}) };
      store[id] = next; return next;
    },
    removeStatus(unit, id) { const removed = Boolean(unit.statusEffects?.[id]); if (removed) delete unit.statusEffects[id]; return { removed }; },
    hasStatus(unit, id) { return Boolean(unit.statusEffects?.[id]); },
    getStatus(unit, id) { return unit.statusEffects?.[id] || null; },
    advanceDurations() { return []; },
  };
  return api;
})();

globalThis.CombatEngine = {
  currentState: 'COMBAT_ACTIVE',
  getCoinProbability(sp = 0) { return Math.max(5, Math.min(95, 50 + Number(sp || 0))); },
  applyPassiveModifiers() { return {}; },
  getOffensiveLevel(unit) { return Number(unit?.offensiveLevel ?? unit?.offenseLevel ?? unit?.level ?? 1); },
  getDefensiveLevel(unit) { return Number(unit?.defensiveLevel ?? unit?.defenseLevel ?? unit?.level ?? 1); },
  calculateFinalPower(skill, tosses) {
    const heads = Array.isArray(tosses) ? tosses.filter(Boolean).length : Number(tosses || 0);
    return Number(skill?.basePower || 0) + heads * Number(skill?.coinPower || 0);
  },
  resolveStandardClash(unitA, skillA, unitB, skillB) {
    return {
      powerA: this.calculateFinalPower(skillA, Array(Math.max(1, Number(skillA.coinAmount || 1))).fill(false), unitA),
      powerB: this.calculateFinalPower(skillB, Array(Math.max(1, Number(skillB.coinAmount || 1))).fill(false), unitB),
    };
  },
  calculateCoinDamage(attacker, defender, skill, coinFinalPower, isCritical) {
    return { damage: isCritical ? Number(coinFinalPower) * 1.2 : Number(coinFinalPower), isCritical: Boolean(isCritical) };
  },
  processStatusEffects(unit, triggerKey) {
    if (triggerKey === 'on_round_end' && unit?.statusEffects?.burn) {
      const burn = unit.statusEffects.burn;
      unit.hp = Math.max(0, unit.hp - Number(burn.potency || 0));
      burn.count = Math.max(0, Number(burn.count || 0) - 1);
      if (burn.count <= 0) delete unit.statusEffects.burn;
    }
    if (triggerKey === 'on_crit' && unit?.statusEffects?.poise) {
      unit.statusEffects.poise.count = Math.max(0, Number(unit.statusEffects.poise.count || 0) - 1);
      if (unit.statusEffects.poise.count <= 0) delete unit.statusEffects.poise;
    }
  },
  applyDamage(unit, amount) {
    const damage = Math.floor(Number(amount) || 0); unit.hp = Math.max(0, unit.hp - damage); return { damageTaken: damage };
  },
  triggerPhase(phaseTag, units = []) {
    if (phaseTag === '[Round End]') units.forEach((unit) => this.processStatusEffects(unit, 'on_round_end', {}));
  },
  modifyNextStaggerThreshold(unit, amount) { unit.nextStaggerThreshold = (unit.nextStaggerThreshold || 0) + amount; },
};

require('../js/elemental-status-runtime.js');
require('../js/core-condition-runtime.js');
require('../js/core-condition-combat-bridge.js');
const requiredBattleViewer = require('../js/battle-viewer-runtime-073.js');

const E = globalThis.LuminousElementalStatusRuntime;
const C = globalThis.LuminousConditionRuntime;
const B = requiredBattleViewer?.version === '0.7.3' ? requiredBattleViewer : globalThis.LuminousBattleViewerRuntime073;
assert.equal(E.version, '0.7.3');
assert.equal(C.version, '0.7.3');
assert.equal(E.ELEMENT_TO_STATUS.force, null);
assert.equal(B.ACTIVE_FIELD_CAP, 8);

// Poison v0.7.3 merged model.
const poisonUnit = { id:'p', hp:200, maxHp:200, statusEffects:{} };
globalThis.LuminousStatusEngine.applyStatus(poisonUnit, 'poison', { mode:'set', potency:2, count:13 });
E.onTurnEnd(poisonUnit);
assert.equal(poisonUnit.hp, 174, '13 Count at 2 Potency should deal 26 Fixed Damage');
assert.equal(E.potencyOf(poisonUnit, 'poison'), 4, '13 Count should add floor(13/5)=2 Potency');
assert.equal(E.countOf(poisonUnit, 'poison'), 6, 'Poison Count halves with floor');
assert.equal(E.poisonCheckThresholdPenalty(poisonUnit), 4);
assert.equal(E.poisonClashPenalty(poisonUnit), 1);
E.onRest(poisonUnit, 'short_rest');
assert.equal(E.potencyOf(poisonUnit, 'poison'), 1);

// Frozen is created after existing Frozen damage resolves, so the new stack does not tick immediately.
const cold = { id:'cold', hp:100, maxHp:100, size:'tiny', statusEffects:{} };
globalThis.LuminousStatusEngine.applyStatus(cold, 'chill', { mode:'set', count:5, element:'cold' });
globalThis.CombatEngine.triggerPhase('[Round End]', [cold]);
assert.equal(cold.hp, 100, 'new Frozen must not take 5% damage on the same Turn End');
assert.equal(E.countOf(cold, 'chill'), 0);
assert.equal(E.countOf(cold, 'frozen'), 1);
assert.equal(cold.shield, 110);
globalThis.CombatEngine.triggerPhase('[Round End]', [cold]);
assert.equal(cold.hp, 95, 'existing Frozen takes 5% Max HP Fixed Damage on the next Turn End');
globalThis.LuminousStatusEngine.applyStatus(cold, 'chill', { mode:'set', count:2, element:'cold' });
assert.equal(E.countOf(cold, 'chill'), 4, 'Frozen doubles incoming Chill');

const resistant = { id:'r', size:'medium', coldResistant:true, statusEffects:{} };
assert.equal(E.chillThreshold(resistant), 60);
const immune = { id:'i', coldImmune:true, statusEffects:{} };
assert.equal(globalThis.LuminousStatusEngine.applyStatus(immune, 'chill', { count:20, element:'cold' }), null);

// Burn must be manually resolved once even though the legacy engine also has a Burn rule.
const burning = { id:'burning', hp:100, maxHp:100, statusEffects:{} };
globalThis.LuminousStatusEngine.applyStatus(burning, 'burn', { mode:'set', potency:5, count:2 });
globalThis.CombatEngine.triggerPhase('[Round End]', [burning]);
assert.equal(burning.hp, 95, 'Burn should not double-process through legacy + v0.7.3 runtimes');
assert.equal(E.countOf(burning, 'burn'), 1);

// Condition source restrictions and gates.
const petrifyTarget = { id:'stone', statusEffects:{} };
assert.equal(C.applyCondition(petrifyTarget, 'petrified', { sourceType:'normal' }), null);
assert.ok(C.applyCondition(petrifyTarget, 'petrified', { sourceType:'magic', mode:'set', count:1 }));

const mage = { id:'mage', hp:100, statusEffects:{} };
const charmed = { id:'charmed', hp:100, statusEffects:{} };
C.applyCondition(charmed, 'charmed', { mode:'set', count:2, sourceUnitId:'mage' });
assert.equal(C.canTarget(charmed, mage, { skillFamily:'support', harmful:false }).allowed, false, 'Charmed cannot target its source even with support/non-harmful Skills');

const paralyzed = { id:'para', statusEffects:{} };
C.applyCondition(paralyzed, 'paralyzed', { mode:'set', count:1 });
assert.equal(C.automaticCheckFailure(paralyzed, { kind:'save', abilityId:'str' }).failed, true);
assert.equal(C.automaticCheckFailure(paralyzed, { kind:'ability', abilityId:'str' }).failed, false);
const sleeping = { id:'sleep', sp:20, statusEffects:{} };
C.applyCondition(sleeping, 'sleep', { mode:'set', count:1, sourceType:'magic' });
assert.equal(sleeping.sp, 0);
assert.equal(C.automaticCheckFailure(sleeping, { kind:'save', abilityId:'str' }).failed, false);
assert.equal(C.automaticCheckFailure(sleeping, { kind:'ability', abilityId:'str' }).failed, true);

const prone = { id:'prone', speed:7, statusEffects:{} };
C.applyCondition(prone, 'prone', { mode:'set', count:1 });
C.turnStart(prone, { random:() => .9 });
assert.equal(C.hasStatus(prone, 'prone'), false);
assert.equal(C.fixedSpeedFor(prone), 1, 'Prone locks Speed 1 for the Turn even after the Status is removed at Turn Start');

const restrained = { id:'rest', statusEffects:{} };
C.applyCondition(restrained, 'restrained', { mode:'set', count:3 });
assert.equal(C.liberateThreshold(restrained, 'sleight_of_hand', { self:false, inCombat:true }), 15);
assert.equal(C.liberateThreshold(restrained, 'athletics', { self:true, inCombat:true }), 21);
assert.equal(C.liberateThreshold(restrained, 'strength', { self:false, inCombat:false }), 13);
const mods = C.contextualModifiers({ unit: restrained });
assert.equal(mods.clash_power, -3);
assert.equal(mods.evade_power, -6);
assert.equal(globalThis.CombatEngine.applyPassiveModifiers(restrained, { skill:{ type:'Attack' } }).clash_power, -3, 'Condition modifiers must reach the actual CombatEngine passive modifier path');

// Grapple reserves one Action Slot on both linked units when TeamActionEconomy is present.
const lockLog = []; const unlockLog = [];
globalThis.LuminousTeamActionEconomy = {
  lockUnitSlots(encounter, unit, count, reason) { lockLog.push([encounter.id, unit.id, count, reason]); return { locked:true }; },
  unlockUnitSlots(encounter, unit, count) { unlockLog.push([encounter.id, unit.id, count]); return true; },
};
const grappler = { id:'ga', statusEffects:{} }; const held = { id:'gb', statusEffects:{} }; const encounter = { id:'enc' };
const grapple = C.grapple(grappler, held, { encounter, units:[grappler,held], resolveOpposedCheck:() => ({ attackerWon:true }) });
assert.equal(grapple.applied, true);
assert.equal(lockLog.length, 2);
C.breakGrapple(grappler, { encounter, units:[grappler,held] });
assert.equal(unlockLog.length, 2);

// Concentration linkage remains authoritative for Magic Conditions.
const source = { id:'source', hp:100, statusEffects:{} };
const target = { id:'target', statusEffects:{} };
const concentration = C.startConcentration(source, { concentrationId:'c1', source:'spell' });
C.applyCondition(target, 'charmed', { mode:'set', count:1, sourceType:'magic', sourceUnitId:'source', removalMode:'concentration', concentrationId:concentration.id });
C.recordConcentrationDamage(source, 37);
assert.equal(C.concentrationThreshold(source), 13);
C.loseConcentration(source, { units:[source,target], reason:'test' });
assert.equal(C.hasStatus(target, 'charmed'), false);

const frightened = { id:'fear', sp:20, statusEffects:{} };
C.applyCondition(frightened, 'frightened', { mode:'set', count:1, frightenedOutcome:'retreat', saveThreshold:14, saveAbility:'wis' });
C.turnEnd(frightened, { units:[frightened] });
assert.equal(frightened.sp, 15);
assert.equal(frightened.isRetreated, true);

// Paralyzed + Poise forces Crit at damage calculation and the auto-Crit does not consume Poise.
const poiseAttacker = { id:'critA', statusEffects:{ poise:{ count:2, potency:1 } } };
const paraDefender = { id:'critB', statusEffects:{} };
C.applyCondition(paraDefender, 'paralyzed', { mode:'set', count:1 });
const critDamage = globalThis.CombatEngine.calculateCoinDamage(poiseAttacker, paraDefender, { name:'Hit' }, 10, false, 0, { defender:paraDefender });
assert.equal(critDamage.isCritical, true);
globalThis.CombatEngine.processStatusEffects(poiseAttacker, 'on_crit', { defender:paraDefender });
assert.equal(poiseAttacker.statusEffects.poise.count, 2, 'condition auto-Crit must not consume Poise');

// Exact Clash forecast and real Clash level bridge.
assert.equal(B.damageLevelModifier(10, 10), 0);
assert.equal(B.levelClashPower(7, 1), 2);
const skillA = { name:'A', type:'Attack', basePower:5, coinPower:0, coinAmount:1 };
const skillB = { name:'B', type:'Attack', basePower:5, coinPower:0, coinAmount:1 };
const levelA = { id:'la', sp:0, offensiveLevel:7, defensiveLevel:1, statusEffects:{} };
const levelB = { id:'lb', sp:0, offensiveLevel:1, defensiveLevel:1, statusEffects:{} };
const forecast = B.forecastClash(levelA, skillA, levelB, skillB);
assert.equal(forecast.probability, 1, '6 Offensive Level advantage gives +2 Clash Power and deterministic win at equal base power');
assert.equal(forecast.label, 'DOMINATING');
const actual = globalThis.CombatEngine.resolveStandardClash(levelA, skillA, levelB, skillB);
assert.equal(actual.powerA, 7, 'actual Clash receives the same +2 level Clash Power used by the forecast');
assert.equal(actual.powerB, 5);
assert.equal(Object.hasOwn(skillA, '__battleViewer073ClashLevelBonus'), false, 'temporary Clash level bonus must not leak into later damage');

console.log('combat-v073-rules-smoke: ok');
