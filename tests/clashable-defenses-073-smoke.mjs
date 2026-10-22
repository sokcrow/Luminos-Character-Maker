import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const defenses = require("../js/combat-v073-clashable-defenses.js");
const economy = require("../js/universal-action-economy.js");
require("../js/combat-v073-steps.js");

function skill(type, basePower, coinAmount = 1) {
  return { name: type, type, defenseSubtype: type, defenseType: type,
    isDefense: true, isClashable: true, basePower, coinPower: 0, coinAmount,
    coins: Array.from({ length: coinAmount }, () => ({ effects: [] })) };
}
const guard = skill("ClashableGuard", 12);
const counter = skill("ClashableCounter", 11);
const defensePlan = data => ({ type: "defense", data });
const attackPlan = (basePower, coinAmount = 1) => ({
  type: "deck", targetId: "defender", targetSlotIndex: 0,
  data: { kind: "skill", name: "Attack", basePower, coinPower: 0, coinAmount,
    coins: Array.from({ length: coinAmount }, () => ({ effects: [] })) }
});

assert.equal(defenses.defenseTypeOf(guard), "clashableguard");
assert.equal(defenses.defenseTypeOf({ defense_subtype: "Clashable_Counter" }), "clashablecounter");
assert.equal(defenses.isClashableDefensePlan(defensePlan(guard)), true);
assert.equal(defenses.isClashableDefensePlan(defensePlan(counter)), true);
assert.equal(defenses.isClashableDefensePlan(defensePlan({ ...counter, isUnclashable: true })), false);
assert.equal(defenses.isClashableDefensePlan(defensePlan({ ...guard, isClashable: false })), false);
assert.equal(defenses.isClashableDefensePlan(defensePlan(skill("Guard", 12))), false);
assert.equal(defenses.isClashableDefensePlan(defensePlan(skill("Counter", 12))), false);
assert.equal(defenses.resultForClash(defensePlan(guard), attackPlan(4), 4, 12).guardTremorPower, 12);
assert.equal(defenses.resultForClash(attackPlan(9), defensePlan(guard), 3, 9).guardMitigation, 3);
assert.equal(defenses.resultForClash(defensePlan(counter), attackPlan(3), 3, 11).counterWin, true);
assert.equal(defenses.resultForClash(defensePlan(guard), attackPlan(3), 3, 12).performHits, false);

const reactiveUnit = { id: "unit", activeSlots: 1 };
economy.beginCombat(reactiveUnit);
const reactionBefore = economy.ensureState(reactiveUnit).reactionRemaining;
assert.equal(economy.consumeCounterReaction(reactiveUnit, counter, { phase: "combat" }), true);
assert.equal(economy.ensureState(reactiveUnit).reactionRemaining, reactionBefore,
  "ClashableCounter must not spend Reaction");
assert.equal(economy.consumeCounterReaction(reactiveUnit, { defenseSubtype: "Counter" }, { phase: "combat" }), true);
assert.equal(economy.ensureState(reactiveUnit).reactionRemaining, reactionBefore - 1,
  "Ordinary Counter keeps its Reaction gate");

// Deterministic real steps runtime, no mocked final winner or damage result.
globalThis.LuminousClashableDefenses073 = defenses;
function makeHarness(attacking, defending) {
  const units = {
    attacker: { id: "attacker", hp: 100, maxHp: 100 },
    defender: { id: "defender", hp: 100, maxHp: 100 }
  };
  const damage = [], tremor = [], hooks = [];
  const rules = {
    data: p => ({ basePower: Number(p.data.basePower), coinPower: Number(p.data.coinPower),
      coinAmount: Number(p.data.coinAmount), finalPowerBonus: 0 }),
    unit: id => units[id], coinHeadsChanceForUnit: () => 50,
    rollSide: () => "tail", coinSrc: x => x,
    clashLevelPowerBonus: () => 0, clashableDefenseLevelPowerBonus: () => 0,
    statusAttackPowerModifier: () => 0, statusDefensePowerModifier: () => 0,
    conditionCounterPowerModifier: () => 0, statusClashPowerModifier: () => 0,
    targetFinalPowerVulnerabilityBonus: () => 0,
    triggerBleedOnCoinFlip: () => {}, consumeParalysisOnHead: () => false,
    processConditionRemovalTrigger: () => {}, markEntryStarted: () => {},
    applySkillStatusEffects: (entry, target, trigger) => hooks.push({ entry: entry.ownerId, target, trigger }),
    healCombatantSP: () => {},
    raiseRemainingStaggerThresholdByDamage: (id, power) => { tremor.push({ id, power }); return power; },
    isUnitTargetable: unit => !!unit && unit.hp > 0,
    unitReactionBlocked: () => false,
    resolveEvadeAgainstCoin: async () => ({ evaded: false }),
    damageCombatant: (id, power) => {
      const dealt = Math.max(0, Number(power) || 0);
      units[id].hp -= dealt;
      damage.push({ id, dealt });
      return { finalDamage: dealt, critical: false };
    },
    triggerGettingHitStatuses: () => {},
    triggerTremorBurst: () => {},
    triggerCounterAfterHit: async () => false
  };
  const runtime = globalThis.LuminousCombatSteps.create({
    rules, context: () => ({ round: 1 }), snapshot: () => units
  });
  const a = { ownerId: "attacker", localIndex: 0, plan: attacking };
  const b = { ownerId: "defender", localIndex: 0, plan: defending };
  return { units, damage, tremor, hooks, runtime, a, b };
}
{
  const t = makeHarness(attackPlan(4, 2), defensePlan(skill("ClashableGuard", 12)));
  const result = await t.runtime.clash(t.a, t.b);
  assert.equal(result.winner.ownerId, "defender");
  assert.equal(t.units.attacker.hp, 100, "winning Clashable Guard deals no hit damage");
  assert.deepEqual(t.tremor, [{ id: "attacker", power: 12 }]);
  assert.equal(t.hooks.some(x => x.trigger === "[Clash Win]"), true);
}
{
  const t = makeHarness(attackPlan(10), defensePlan(skill("ClashableGuard", 3)));
  const result = await t.runtime.clash(t.a, t.b);
  assert.equal(result.winner.ownerId, "attacker");
  assert.deepEqual(t.damage, [{ id: "defender", dealt: 7 }],
    "Guard power mitigates the winner's attack Coin");
  assert.deepEqual(t.tremor, []);
}
{
  const t = makeHarness(attackPlan(4), defensePlan(skill("ClashableCounter", 11)));
  const result = await t.runtime.clash(t.a, t.b);
  assert.equal(result.winner.ownerId, "defender");
  assert.deepEqual(t.damage, [{ id: "attacker", dealt: 11 }], "winning Counter retaliates");
}
{
  const t = makeHarness(attackPlan(10), defensePlan(skill("ClashableCounter", 2)));
  await t.runtime.clash(t.a, t.b);
  assert.deepEqual(t.damage, [{ id: "defender", dealt: 10 }], "losing Counter does not retaliate");
}
{
  const t = makeHarness(attackPlan(10), attackPlan(4));
  await t.runtime.clash(t.a, t.b);
  assert.deepEqual(t.damage, [{ id: "defender", dealt: 10 }], "ordinary Clashes still hit");
}

// Detect an accidental split between the combat viewer and live resolver.
const viewer = readFileSync(new URL("../combat/source/combat-v073-live.html", import.meta.url), "utf8");
assert.match(viewer, /js\/combat-v073-clashable-defenses\.js/);
assert.match(viewer, /function findClashPartner\(/);
assert.match(viewer, /defenses\.isClashableDefensePlan\(direct\.plan\)/);
assert.match(viewer, /function renderDefenseSkills\(/);
assert.match(viewer, /\[\.\.\.equipped,\.\.\.permanent\.defense\]/);
assert.match(viewer, /raiseRemainingStaggerThresholdByDamage/);

console.log("Clashable defensive Guard/Counter mechanics + Action Slot economy: OK");
