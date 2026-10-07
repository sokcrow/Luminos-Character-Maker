import assert from "node:assert/strict";

await import("../js/status-engine.js");
await import("../js/universal-action-economy.js");
await import("../js/weapon-property-runtime.js");
await import("../js/unit-combat-mechanics-runtime.js");

const statuses = globalThis.LuminousStatusEngine;
const economy = globalThis.LuminousActionEconomy;
const mechanics = globalThis.LuminousUnitCombatMechanics;

if (!statuses || !economy || !mechanics) throw new Error("Beast mobility runtimes did not initialize.");

const flyer = {
  id: "owl_test",
  flying: true,
  mechanics: { flight: { capable: true }, flying: true },
  statusEffects: {},
  actionSlots: 1,
};

const melee = { id: "sword", skillRange: 1, properties: [] };
const reach = { id: "spear", skillRange: 1, properties: ["reach"] };
const ranged = { id: "bow", skillRange: 6, properties: [] };

assert.equal(mechanics.flyingTargetRule({ target: flyer, skill: melee, resolutionType: "unopposed" }).allowed, false);
assert.equal(mechanics.flyingTargetRule({ target: flyer, skill: reach, resolutionType: "unopposed" }).allowed, true);
assert.equal(mechanics.flyingTargetRule({ target: flyer, skill: ranged, resolutionType: "unopposed" }).allowed, true);
assert.equal(mechanics.flyingClashDamageRule({ defender: flyer, attackerSkill: melee }).canDamage, true);

const climber = {
  id: "lizard_test",
  climbing: true,
  mechanics: { climbing: true },
  statusEffects: {},
};
assert.equal(mechanics.elevatedTargetRule({ target: climber, skill: melee, resolutionType: "unopposed" }).allowed, false);
assert.equal(mechanics.elevatedTargetRule({ target: climber, skill: reach, resolutionType: "unopposed" }).allowed, true);
assert.equal(mechanics.elevatedClashDamageRule({ defender: climber, attackerSkill: melee }).canDamage, true);

statuses.applyStatus(flyer, "prone", { mode: "set", count: 1 });
assert.equal(flyer.flying, false, "Prone must ground a Flying Unit.");
assert.equal(mechanics.isFlyingUnit(flyer), false);

economy.beginPlanning(flyer);
const flyResult = mechanics.useFlyQuickAction(flyer, { phase: "planning" });
assert.equal(flyResult.used, true);
assert.equal(flyer.flying, true);
assert.equal(statuses.hasStatus(flyer, "prone"), false);
assert.equal(economy.snapshot(flyer, { phase: "planning" }).quick_action, 0);

const seahorse = {
  id: "seahorse_test",
  traitIds: ["water_breathing", "bubble_dash"],
  movementFeet: { ground: 5, swim: 20 },
  statusEffects: {},
  actionSlots: 1,
};
economy.beginPlanning(seahorse);
assert.equal(mechanics.canUseBubbleDash(seahorse, { encounterTags: ["land"], phase: "planning" }).available, false);
const dash = mechanics.useBubbleDash(seahorse, { encounterTags: ["underwater"], phase: "planning" });
assert.equal(dash.used, true);
assert.equal(dash.maxMovementFeet, 20);
assert.equal(dash.provokesCounterAttacks, false);
assert.equal(dash.provokesOpportunityAttacks, false);
assert.equal(economy.snapshot(seahorse, { phase: "planning" }).action, 0);

console.log("beast mobility runtime smoke: ok");
