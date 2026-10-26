import assert from "node:assert/strict";

for (const key of [
  "LuminousTraitEngine",
  "LuminousTraitCatalogCore",
  "LuminousUniversalModifiers",
  "LuminousFightingStyleCatalog",
  "LuminousFightingStyleRuntime",
  "LuminousActionEconomy",
]) delete globalThis[key];

await import("../js/trait-engine.js");
await import("../js/universal-modifier-engine.js");

globalThis.LuminousTraitCatalogCore = Object.freeze({
  DEFINITIONS: Object.freeze({}),
  GRANTS: Object.freeze([]),
  allDefinitions() { return {}; },
  allGrants() { return []; },
  getDefinition() { return null; },
  validateAll() { return { valid: true, errors: [], warnings: [] }; },
});

await import("../js/fighting-style-runtime.js");

const catalog = globalThis.LuminousFightingStyleCatalog;
const runtime = globalThis.LuminousFightingStyleRuntime;
const modifiers = globalThis.LuminousUniversalModifiers;
const traitEngine = globalThis.LuminousTraitEngine;

assert.ok(catalog, "Fighting Style catalog should install");
assert.ok(runtime, "Fighting Style runtime should install");
assert.equal(catalog.list().length, 6, "2014 core catalog should contain exactly six Fighting Styles");
assert.deepEqual(catalog.STYLE_IDS, ["archery", "defense", "dueling", "great_weapon_fighting", "protection", "two_weapon_fighting"]);

assert.deepEqual(catalog.classFeature("fighter").styles, catalog.STYLE_IDS);
assert.deepEqual(catalog.classFeature("ranger"), {
  classId: "ranger", dndUnlockLevel: 2, limbusUnlockLevel: 10,
  styles: ["archery", "defense", "dueling", "two_weapon_fighting"],
});
assert.deepEqual(catalog.classFeature("paladin"), {
  classId: "paladin", dndUnlockLevel: 2, limbusUnlockLevel: 10,
  styles: ["defense", "dueling", "great_weapon_fighting", "protection"],
});
assert.equal(catalog.validateSelection(["archery", "archery"], { classId: "fighter", maxChoices: 2 }).valid, false);
assert.equal(catalog.validateSelection("great_weapon_fighting", { classId: "ranger" }).valid, false);
assert.equal(catalog.validateSelection("archery", { classId: "ranger" }).valid, true);
assert.equal(catalog.grantFor("archery", { sourceId: "ranger", atLevel: 10 }).traitId, "fighting_style_archery");

for (const definition of catalog.list()) {
  const validation = traitEngine.validateTrait(definition);
  assert.equal(validation.valid, true, `${definition.name} should validate: ${validation.errors.join("; ")}`);
}
assert.equal(globalThis.LuminousTraitCatalogCore.getDefinition("fighting_style_archery")?.name, "Archery");
assert.equal(Object.keys(globalThis.LuminousTraitCatalogCore.allDefinitions()).filter((id) => id.startsWith("fighting_style_")).length, 6);

const weapon = (classification, handCost) => ({ category: "weapon", classification, equipment: { handCost } });
const shield = { category: "shield", itemType: "shield", tags: ["shield"] };
const rangedSkill = { skillFamily: "attack", attackMode: "ranged", coinAmount: 2 };
const meleeSkill = { skillFamily: "attack", attackMode: "melee", coinAmount: 2 };

let result = modifiers.resolveTraitModifiers({ unit: {}, traits: [catalog.get("archery")], skill: rangedSkill });
assert.equal(result.clash_power, 1, "Archery should grant +1 Clash Power to Ranged Attack Skills");
result = modifiers.resolveTraitModifiers({ unit: {}, traits: [catalog.get("archery")], skill: meleeSkill });
assert.equal(result.clash_power, 0, "Archery should not affect Melee Attack Skills");

result = modifiers.resolveTraitModifiers({
  unit: { equipment: { armor: { id: "test_armor", category: "medium" } } },
  traits: [catalog.get("defense")], skill: meleeSkill,
});
assert.equal(result.defensive_level, 1, "Defense should grant +1 Defensive Level while armored");

result = modifiers.resolveTraitModifiers({
  unit: { equipment: { mainHand: weapon("martial_melee", 1), offHand: shield, shield } },
  traits: [catalog.get("dueling")], skill: meleeSkill,
});
assert.equal(result.damage_dealt_multiplier, 1, "Dueling should map to +10% Damage through the Rule of 0.1 channel");

result = modifiers.resolveTraitModifiers({
  unit: { equipment: { mainHand: weapon("martial_melee", 2) } },
  traits: [catalog.get("great_weapon_fighting")], skill: meleeSkill,
});
assert.equal(result.damage_dealt_multiplier, 1, "Great Weapon Fighting should grant +10% Damage with a two-handed melee weapon");

result = modifiers.resolveTraitModifiers({
  unit: { equipment: { mainHand: weapon("martial_melee", 1), offHand: weapon("simple_melee", 1) } },
  traits: [catalog.get("two_weapon_fighting")], skill: meleeSkill,
});
assert.equal(result.damage_dealt_multiplier, 1, "Two-Weapon Fighting should grant +10% Damage while dual-wielding melee weapons");

let reaction = 1;
const actionEconomy = {
  availability(cost) { return { available: cost !== "reaction" || reaction > 0, reason: reaction > 0 ? null : "reaction_unavailable" }; },
  consume(cost) {
    if (cost !== "reaction") return { consumed: false, reason: "wrong_cost" };
    if (reaction <= 0) return { consumed: false, reason: "reaction_unavailable" };
    reaction -= 1; return { consumed: true };
  },
};
const protector = { id: "protector", fightingStyles: ["protection"], equipment: { shield, offHand: shield }, grid_pos: { x: 0, y: 0 } };
const ally = { id: "ally", grid_pos: { x: 1, y: 1 } };
const attacker = { id: "attacker", grid_pos: { x: 2, y: 0 } };
const protection = runtime.useProtection({ protector, ally, attacker, skill: meleeSkill, visible: true, actionEconomy });
assert.equal(protection.used, true, "Protection should work for a diagonally adjacent Ally");
assert.equal(protection.finalPowerModifier, -2);
assert.equal(reaction, 0, "Protection should spend the Reaction");
assert.equal(runtime.useProtection({ protector, ally, attacker, skill: meleeSkill, visible: true, actionEconomy }).used, false, "Protection cannot be used after the Reaction is spent");

console.log("Fighting Style 2014 runtime smoke passed: six universal styles, class matrices, modifier contracts, uniqueness, and Protection reaction verified.");
