import assert from "node:assert/strict";

for (const key of [
  "LuminousStatusEngine",
  "LuminousStatusLibrary",
  "LuminousTraitEngine",
  "LuminousTraitCatalogCore",
  "LuminousUniversalModifiers",
  "LuminousFightingStyleCatalog",
  "LuminousFightingStyleRuntime",
  "LuminousClassStatusSemantics",
  "LuminousFighterClassRuntime",
  "STATUS_REGISTRY",
]) delete globalThis[key];

await import("../js/status-engine.js");
await import("../js/status-library.js");
await import("../js/trait-engine.js");
await import("../js/trait-catalog-core.js");
await import("../js/universal-modifier-engine.js");
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
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "fighter" && grant.atLevel === 1 && grant.traitId === "fighting_style"));
assert.equal(runtime.fightingStyleOptions().length, 6);

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

console.log("Fighter class runtime smoke passed: Lv1 Fighting Style, restored Second Wind, style Trait resolution, healing, and cleanup verified.");
