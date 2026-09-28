import assert from "node:assert/strict";

for (const key of [
  "LuminousStatusEngine",
  "LuminousStatusLibrary",
  "LuminousTraitEngine",
  "LuminousTraitCatalogCore",
  "LuminousUniversalModifiers",
  "LuminousFightingStyleCatalog",
  "LuminousFightingStyleRuntime",
  "LuminousActionEconomy",
  "LuminousClassMilestones",
  "LuminousClassStatusSemantics",
  "LuminousFighterClassRuntime",
  "STATUS_REGISTRY",
]) delete globalThis[key];

await import("../js/status-engine.js");
await import("../js/status-library.js");
await import("../js/trait-engine.js");
await import("../js/trait-catalog-core.js");
await import("../js/universal-modifier-engine.js");
await import("../js/universal-action-economy.js");
await import("../js/class-milestone-engine.js");
await import("../js/fighting-style-runtime.js");
await import("../js/class-status-semantics.js");
await import("../js/fighter-class-runtime.js");

const runtime = globalThis.LuminousFighterClassRuntime;
const fighting = globalThis.LuminousFightingStyleRuntime;
const engine = globalThis.LuminousTraitEngine;
const catalog = globalThis.LuminousTraitCatalogCore;
const statusLibrary = globalThis.LuminousStatusLibrary;

assert.ok(runtime, "Fighter class runtime should install");
assert.equal(runtime.CLASS_ID, "fighter");
assert.equal(statusLibrary.get("second_wind")?.icon, "https://imgur.com/VSxnVEo.png");

const secondWind = catalog.getDefinition("second_wind");
const fightingStyleFeature = catalog.getDefinition("fighting_style");
assert.ok(secondWind, "Second Wind should exist in the canonical Trait catalog");
assert.ok(fightingStyleFeature, "Universal Fighting Style feature should exist in the canonical Trait catalog");
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "fighter" && grant.atLevel === 1 && grant.traitId === "second_wind"));
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "fighter" && grant.atLevel === 10 && grant.traitId === "fighting_style"));
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "fighter" && grant.atLevel === 10 && grant.traitId === "action_surge"));
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "fighter" && grant.atLevel === 25 && grant.traitId === "additional_attack"));
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "fighter" && grant.atLevel === 45 && grant.traitId === "indomitable"));
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "fighter" && grant.atLevel === 55 && grant.traitId === "additional_attack_plus"));
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "fighter" && grant.atLevel === 100 && grant.traitId === "additional_attack_plus_plus"));
assert.equal(runtime.fightingStyleOptions().length, 6);

const lv9Style = runtime.applyFightingStyleChoice(makeCharacter(9), "archery");
assert.equal(lv9Style.success, false);
assert.equal(lv9Style.reason, "fighting_style_locked");
const lv10Style = runtime.applyFightingStyleChoice(makeCharacter(10), "archery");
assert.equal(lv10Style.success, true);

const makeCharacter = (level, hp = 100, maxHp = 200) => ({
  id: `fighter_${level}`,
  hp,
  maxHp,
  classes: [{ id: "fighter", level }],
});

assert.equal(runtime.secondWindMaximum(makeCharacter(1)), 1);
assert.equal(runtime.secondWindMaximum(makeCharacter(20)), 2);
assert.equal(runtime.secondWindMaximum(makeCharacter(40)), 3);
assert.equal(runtime.secondWindMaximum(makeCharacter(60)), 4);
assert.equal(runtime.secondWindMaximum(makeCharacter(80)), 5);
assert.equal(runtime.secondWindMaximum(makeCharacter(100)), 6);

const character = makeCharacter(45);
const styleChoice = runtime.applyFightingStyleChoice(character, "archery");
assert.equal(styleChoice.success, true);
assert.equal(styleChoice.styleId, "archery");
assert.equal(runtime.applyFightingStyleChoice(character, "archery").success, false, "Same Fighting Style cannot be chosen twice");

let traits = engine.resolveTraitGrants(character, catalog.allGrants(), catalog.allDefinitions());
assert.ok(traits.some((trait) => trait.id === "second_wind"));
assert.ok(traits.some((trait) => trait.id === "fighting_style"));
assert.ok(traits.some((trait) => trait.id === "fighting_style_archery"), "Chosen Fighter style should resolve as a live Trait");
assert.equal(fighting.hasStyle(character, "archery"), true);

const combatUnit = { id: "fighter_unit", hp: 100, maxHp: 200, statusEffects: {} };
let state = engine.createState();
let event = engine.dispatchCombatEvent("encounter_start", {
  character,
  self: combatUnit,
  traits,
  state,
});
state = event.state;
assert.equal(runtime.secondWindCount(combatUnit), 3, "Level 45 Fighter should start with 3 Second Wind Count");

event = engine.dispatchCombatEvent("turn_start", {
  character,
  self: combatUnit,
  traits,
  state,
});
state = event.state;
assert.equal(combatUnit.hp, 112, "3 Count should heal 6% Max HP at Turn Start");

const economy = { quick_action: 1 };
let activation = engine.activateTrait(secondWind, {
  context: "combat",
  character,
  self: combatUnit,
  actionEconomy: economy,
}, state);
state = activation.state;
assert.equal(activation.available, true);
assert.equal(economy.quick_action, 0);
assert.equal(runtime.secondWindCount(combatUnit), 2);
assert.equal(combatUnit.hp, 162, "Second Wind Quick Action should heal 25% Max HP");

event = engine.dispatchCombatEvent("encounter_end", {
  character,
  self: combatUnit,
  traits,
  state,
});
assert.equal(runtime.secondWindCount(combatUnit), 0);

// Action Surge: Lv10, one extra Action Slot this Turn, once per Turn, scaling uses, Short/Long Rest recharge.
const surgeCharacter = makeCharacter(10);
let surgeTraits = engine.resolveTraitGrants(surgeCharacter, catalog.allGrants(), catalog.allDefinitions());
const actionSurge = surgeTraits.find((trait) => trait.id === "action_surge");
assert.ok(actionSurge);
const surgeUnit = { id: "fighter_surge", activeSlots: 1 };
globalThis.LuminousActionEconomy.beginPlanning(surgeUnit);
let surgeState = engine.createState();
let surgeEconomy = globalThis.LuminousActionEconomy.runtimeFor(surgeUnit, { phase: "planning" });
assert.equal(surgeEconomy.action, 1);
let surge = engine.activateTrait(actionSurge, { context: "combat", phase: "planning", character: surgeCharacter, self: surgeUnit, actionEconomy: surgeEconomy }, surgeState);
surgeState = surge.state;
assert.equal(surge.available, true);
assert.equal(surgeEconomy.action, 2, "Action Surge should grant one additional Action Slot");
assert.equal(surge.remaining, 0);
assert.equal(engine.activateTrait(actionSurge, { context: "combat", phase: "planning", character: surgeCharacter, self: surgeUnit, actionEconomy: surgeEconomy }, surgeState).available, false, "Action Surge is once per Turn");
globalThis.LuminousActionEconomy.beginPlanning(surgeUnit);
surgeEconomy = globalThis.LuminousActionEconomy.runtimeFor(surgeUnit, { phase: "planning" });
surgeState = engine.dispatchCombatEvent("long_rest", { character: surgeCharacter, self: surgeUnit, traits: surgeTraits, state: surgeState }).state;
surge = engine.activateTrait(actionSurge, { context: "combat", phase: "planning", character: surgeCharacter, self: surgeUnit, actionEconomy: surgeEconomy }, surgeState);
assert.equal(surge.available, true, "Long Rest should also recharge Action Surge");
assert.equal(runtime.fighterScalingUses(makeCharacter(60)), 2);
assert.equal(runtime.fighterScalingUses(makeCharacter(90)), 3);

// Additional Attack progression: base is shared; + and ++ are Fighter-only replacements.
let attackTraits = engine.resolveTraitGrants(makeCharacter(25), catalog.allGrants(), catalog.allDefinitions());
assert.ok(attackTraits.some((trait) => trait.id === "additional_attack"));
attackTraits = engine.resolveTraitGrants(makeCharacter(55), catalog.allGrants(), catalog.allDefinitions());
assert.equal(attackTraits.some((trait) => trait.id === "additional_attack"), false);
assert.ok(attackTraits.some((trait) => trait.id === "additional_attack_plus"));
let skill = { skillFamily: "attack", attackMode: "melee", coinAmount: 4, coins: [{}, {}, {}, { id: "last" }] };
engine.dispatchCombatEvent("before_skill", { character: makeCharacter(55), self: makeCharacter(55), skill, traits: attackTraits, state: engine.createState() });
assert.equal(skill.coins.length, 5, "Additional Attack+ should reuse the last Coin on a 4-Coin Melee Attack Skill");
attackTraits = engine.resolveTraitGrants(makeCharacter(100), catalog.allGrants(), catalog.allDefinitions());
assert.equal(attackTraits.some((trait) => ["additional_attack", "additional_attack_plus"].includes(trait.id)), false);
assert.ok(attackTraits.some((trait) => trait.id === "additional_attack_plus_plus"));
skill = { skillFamily: "attack", attackMode: "melee", coinAmount: 5, coins: [{}, {}, {}, {}, { id: "last" }] };
engine.dispatchCombatEvent("before_skill", { character: makeCharacter(100), self: makeCharacter(100), skill, traits: attackTraits, state: engine.createState() });
assert.equal(skill.coins.length, 6, "Additional Attack++ should reuse the last Coin on a 5-Coin Melee Attack Skill");

// Indomitable: failed Save Check only, rerolls failed Coins once per Turn, Long Rest recharge.
const indomitableCharacter = makeCharacter(45);
const indomitableTraits = engine.resolveTraitGrants(indomitableCharacter, catalog.allGrants(), catalog.allDefinitions());
const indomitable = indomitableTraits.find((trait) => trait.id === "indomitable");
assert.ok(indomitable);
let indomitableState = engine.createState();
const saveCheck = { kind: "save", passed: false, headsChance: 50, tosses: [{ side: "tail" }, { side: "head" }, { side: "tail" }] };
let indomitableUse = engine.activateTrait(indomitable, { context: "combat", turnNumber: 1, character: indomitableCharacter, self: indomitableCharacter, check: saveCheck, rng: () => 0 }, indomitableState);
indomitableState = indomitableUse.state;
assert.equal(indomitableUse.available, true);
assert.equal(saveCheck.tosses.filter((coin) => coin.side === "tail").length, 0);
assert.equal(engine.activateTrait(indomitable, { context: "combat", turnNumber: 1, character: indomitableCharacter, self: indomitableCharacter, check: { kind: "save", passed: false, tosses: [{ side: "tail" }] }, rng: () => 0 }, indomitableState).available, false, "Indomitable is once per Turn");
assert.equal(engine.activateTrait(indomitable, { context: "combat", turnNumber: 2, character: indomitableCharacter, self: indomitableCharacter, check: { kind: "ability", passed: false, tosses: [{ side: "tail" }] }, rng: () => 0 }, indomitableState).available, false, "Indomitable only applies to Save Checks");

// Fighter-exclusive bonus Class Milestones.
const fighterMilestones = globalThis.LuminousClassMilestones.earnedMilestones([{ classId: "fighter", levels: 70 }]).map((entry) => entry.milestoneLevel);
assert.deepEqual(fighterMilestones, [20, 30, 40, 60, 70]);
const rangerMilestones = globalThis.LuminousClassMilestones.earnedMilestones([{ classId: "ranger", levels: 70 }]).map((entry) => entry.milestoneLevel);
assert.deepEqual(rangerMilestones, [20, 40, 60]);
assert.equal(globalThis.LuminousClassMilestones.earnedMilestones([{ classId: "fighter", levels: 30 }]).find((entry) => entry.milestoneLevel === 30)?.bonusClassMilestone, true);

assert.equal(catalog.validateAll(engine).valid, true, "Expanded Fighter catalog should validate");
console.log("Fighter class runtime smoke passed: complete Lv1-Lv100 Fighter trunk, Action Surge, Additional Attack upgrades, Indomitable, Fighting Style Lv10, Second Wind, and Fighter bonus milestones verified.");
