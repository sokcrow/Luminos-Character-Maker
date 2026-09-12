import assert from "node:assert/strict";

for (const key of [
  "LuminousStatusEngine",
  "LuminousStatusLibrary",
  "LuminousTraitEngine",
  "LuminousTraitCatalogCore",
  "LuminousClassStatusSemantics",
  "LuminousFighterClassRuntime",
  "STATUS_REGISTRY",
]) delete globalThis[key];

await import("../js/status-engine.js");
await import("../js/status-library.js");
await import("../js/trait-engine.js");
await import("../js/trait-catalog-core.js");
await import("../js/class-status-semantics.js");
await import("../js/fighter-class-runtime.js");

const runtime = globalThis.LuminousFighterClassRuntime;
const engine = globalThis.LuminousTraitEngine;
const catalog = globalThis.LuminousTraitCatalogCore;
const statusLibrary = globalThis.LuminousStatusLibrary;

assert.ok(runtime, "Fighter class runtime should install");
assert.equal(runtime.CLASS_ID, "fighter");
assert.equal(statusLibrary.get("second_wind")?.icon, "https://imgur.com/VSxnVEo.png");

const secondWind = catalog.getDefinition("second_wind");
assert.ok(secondWind, "Second Wind should exist in the canonical Trait catalog");
assert.equal(secondWind.activation.type, "manual");
assert.equal(secondWind.activation.actionCost, "quick_action");
assert.ok(catalog.allGrants().some((grant) => grant.sourceId === "fighter" && grant.atLevel === 5 && grant.traitId === "second_wind"));

const makeCharacter = (level, hp = 100, maxHp = 200) => ({
  id: `fighter_${level}`,
  hp,
  maxHp,
  classes: [{ id: "fighter", level }],
});

assert.equal(runtime.secondWindMaximum(makeCharacter(5)), 1);
assert.equal(runtime.secondWindMaximum(makeCharacter(20)), 2);
assert.equal(runtime.secondWindMaximum(makeCharacter(40)), 3);
assert.equal(runtime.secondWindMaximum(makeCharacter(60)), 4);
assert.equal(runtime.secondWindMaximum(makeCharacter(80)), 5);
assert.equal(runtime.secondWindMaximum(makeCharacter(100)), 6);

const character = makeCharacter(45);
const combatUnit = { id: "fighter_unit", hp: 100, maxHp: 200, statusEffects: {} };
const traits = engine.resolveTraitGrants(character, catalog.allGrants(), catalog.allDefinitions());
assert.ok(traits.some((trait) => trait.id === "second_wind"));
let state = engine.createState();

let event = engine.dispatchCombatEvent("encounter_start", {
  character,
  self: combatUnit,
  traits,
  state,
});
state = event.state;
assert.equal(runtime.secondWindCount(combatUnit), 3, "Level 45 Fighter should start an Encounter with 3 Second Wind Count");

// 3 Count => 6% Max HP at Turn Start: 12 HP from a 200 Max HP unit.
event = engine.dispatchCombatEvent("turn_start", {
  character,
  self: combatUnit,
  traits,
  state,
});
state = event.state;
assert.equal(combatUnit.hp, 112);
assert.ok(event.outcomes.some((outcome) => outcome.type === "fighter_second_wind_turn_heal" && outcome.heal.amount === 12));

// Quick Action spends exactly 1 Count and heals 25% Max HP: 50 HP here.
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
assert.equal(combatUnit.hp, 162);
assert.ok(activation.outcomes.some((outcome) => outcome.type === "fighter_second_wind_used" && outcome.heal.amount === 50));

// 2 Count => 4% Max HP at the next Turn Start: 8 HP.
event = engine.dispatchCombatEvent("turn_start", {
  character,
  self: combatUnit,
  traits,
  state,
});
state = event.state;
assert.equal(combatUnit.hp, 170);

// Spend the final two Count. Healing clamps at Max HP and the Status disappears at zero Count.
for (let i = 0; i < 2; i += 1) {
  const actionEconomy = { quick_action: 1 };
  activation = engine.activateTrait(secondWind, {
    context: "combat",
    character,
    self: combatUnit,
    actionEconomy,
  }, state);
  state = activation.state;
  assert.equal(activation.available, true);
  assert.equal(actionEconomy.quick_action, 0);
}
assert.equal(runtime.secondWindCount(combatUnit), 0);
assert.equal(globalThis.LuminousStatusEngine.hasStatus(combatUnit, "second_wind"), false);
assert.equal(combatUnit.hp, 200);

// With 0 Count, activation is blocked before spending the Quick Action.
const emptyEconomy = { quick_action: 1 };
activation = engine.activateTrait(secondWind, {
  context: "combat",
  character,
  self: combatUnit,
  actionEconomy: emptyEconomy,
}, state);
assert.equal(activation.available, false);
assert.equal(emptyEconomy.quick_action, 1);
assert.match(activation.reasons.join(" "), /Second Wind Count/);

// A new Encounter refreshes the Count to the current Fighter-level maximum.
event = engine.dispatchCombatEvent("encounter_start", {
  character,
  self: combatUnit,
  traits,
  state,
});
state = event.state;
assert.equal(runtime.secondWindCount(combatUnit), 3);

engine.dispatchCombatEvent("encounter_end", {
  character,
  self: combatUnit,
  traits,
  state,
});
assert.equal(runtime.secondWindCount(combatUnit), 0);

console.log("Fighter class runtime smoke passed: Second Wind Count, passive healing, Quick Action spend, refresh, cleanup, and icon contract verified.");
