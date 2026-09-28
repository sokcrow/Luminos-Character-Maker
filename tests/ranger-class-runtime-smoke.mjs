import assert from "node:assert/strict";

for (const key of [
  "LuminousTraitEngine",
  "LuminousTraitCatalogCore",
  "LuminousUniversalModifiers",
  "LuminousCreatureTypeCatalog",
  "LuminousSpellcastingRuntime",
  "LuminousCasterSpellcastingTraitsRuntime",
  "LuminousFightingStyleCatalog",
  "LuminousFightingStyleRuntime",
  "LuminousRangerClassRuntime",
]) delete globalThis[key];

await import("../js/trait-engine.js");
await import("../js/trait-catalog-core.js");
await import("../js/universal-modifier-engine.js");
await import("../js/creature-type-catalog.js");
await import("../js/fighting-style-runtime.js");
await import("../js/spellcasting-runtime.js");
await import("../js/caster-spellcasting-traits-runtime.js");
await import("../js/ranger-class-runtime.js");

const runtime = globalThis.LuminousRangerClassRuntime;
const engine = globalThis.LuminousTraitEngine;
const catalog = globalThis.LuminousTraitCatalogCore;
const modifiers = globalThis.LuminousUniversalModifiers;
const spellcasting = globalThis.LuminousSpellcastingRuntime;

assert.ok(runtime, "Ranger runtime should install");
assert.deepEqual(runtime.FAVORED_TERRAINS, ["forest", "grassland", "hills", "mountain", "swamp", "desert", "coast", "arctic", "underground"]);
assert.equal(runtime.fightingStyleOptions().length, 4);

const makeRanger = (level) => ({
  id: `ranger_${level}`,
  classes: [{ id: "ranger", level }],
});

const lv1 = makeRanger(1);
assert.equal(runtime.favoredEnemyChoiceCount(lv1), 1);
assert.equal(runtime.naturalExplorerChoiceCount(lv1), 1);
assert.deepEqual(spellcasting.getClassSpellSlotTable(lv1, "ranger"), {}, "Ranger must have no slots before Lv10");
let traits = engine.resolveTraitGrants(lv1, catalog.allGrants(), catalog.allDefinitions());
assert.ok(traits.some((trait) => trait.id === "favored_enemy"));
assert.ok(traits.some((trait) => trait.id === "natural_explorer"));
assert.ok(!traits.some((trait) => trait.id === "fighting_style"));
assert.ok(!traits.some((trait) => trait.id === "spellcasting_ability_ranger"));

assert.equal(runtime.applyFavoredEnemyChoices(lv1, "beast").success, true);
assert.equal(runtime.applyNaturalExplorerChoices(lv1, "forest").success, true);
const wolf = { species: "wolf" };
const goblin = { species: "goblin" };
assert.equal(runtime.favoredEnemyMatches(lv1, wolf), true);
assert.equal(runtime.favoredEnemyMatches(lv1, goblin), false);
assert.equal(runtime.favoredEnemyFinalPowerBonus(lv1, wolf), 1);
assert.equal(runtime.survivalTrackingBonus(lv1, wolf), 4);
assert.equal(runtime.analyseAutomaticallySucceeds(lv1, wolf), true);
assert.equal(runtime.resolveAnalyse(lv1, wolf).bypassCheck, true);
assert.equal(runtime.naturalExplorerMatches(lv1, { terrain: "forest" }), true);
assert.equal(runtime.naturalExplorerMatches(lv1, { terrain: "desert" }), false);

traits = engine.resolveTraitGrants(lv1, catalog.allGrants(), catalog.allDefinitions());
let result = modifiers.resolveTraitModifiers({ character: lv1, unit: lv1, target: wolf, traits, skill: { skillFamily: "attack", attackMode: "melee" } });
assert.equal(result.final_power, 1, "Favored Enemy should grant +1 Final Power against a matching Creature Type");
result = modifiers.resolveTraitModifiers({ character: lv1, unit: lv1, traits, terrain: "forest", skill: { skillFamily: "attack", attackMode: "melee" } });
assert.equal(result.clash_power, 1, "Natural Explorer should grant +1 Clash Power in Favored Terrain");

const tracking = engine.resolveTheatreCheck({
  character: lv1,
  traits,
  target: wolf,
  check: { abilityId: "wis", skillId: "survival", purpose: "tracking", finalPower: 0 },
});
assert.equal(tracking.check.finalPower, 4, "Favored Enemy should add +4 only to marked Survival tracking checks");
const normalSurvival = engine.resolveTheatreCheck({
  character: lv1,
  traits,
  target: wolf,
  check: { abilityId: "wis", skillId: "survival", purpose: "forage", finalPower: 0 },
});
assert.equal(normalSurvival.check.finalPower, 0, "Favored Enemy should not buff unrelated Survival checks");

const humanoidFail = runtime.applyFavoredEnemyChoices(makeRanger(1), { creatureType: "humanoid" });
assert.equal(humanoidFail.success, false);
assert.equal(humanoidFail.reason, "humanoid_subtype_required");

const humanoidRanger = makeRanger(1);
assert.equal(runtime.applyFavoredEnemyChoices(humanoidRanger, { creatureType: "humanoid", creatureSubtype: "goblinoid", languageId: "goblin" }).success, true);
assert.equal(runtime.favoredEnemyMatches(humanoidRanger, goblin), true);
assert.equal(runtime.favoredEnemyMatches(humanoidRanger, { species: "kobold" }), false);

const lv10 = makeRanger(10);
traits = engine.resolveTraitGrants(lv10, catalog.allGrants(), catalog.allDefinitions());
assert.ok(traits.some((trait) => trait.id === "fighting_style"), "Ranger Fighting Style unlocks at Lv10");
assert.ok(traits.some((trait) => trait.id === "spellcasting_ability_ranger"), "Ranger Spellcasting unlocks at Lv10");
assert.deepEqual(spellcasting.getClassSpellSlotTable(lv10, "ranger"), { 1: 2 });
assert.equal(runtime.applyFightingStyleChoice(lv10, "archery").success, true);
traits = engine.resolveTraitGrants(lv10, catalog.allGrants(), catalog.allDefinitions());
assert.ok(traits.some((trait) => trait.id === "fighting_style_archery"));
assert.equal(runtime.applyFightingStyleChoice(makeRanger(10), "great_weapon_fighting").success, false, "Ranger cannot choose Fighter-only styles");

assert.equal(runtime.favoredEnemyChoiceCount(makeRanger(30)), 2);
assert.equal(runtime.favoredEnemyChoiceCount(makeRanger(70)), 3);
assert.equal(runtime.naturalExplorerChoiceCount(makeRanger(30)), 2);
assert.equal(runtime.naturalExplorerChoiceCount(makeRanger(50)), 3);

console.log("Ranger class runtime smoke passed: Lv1 choices, combat/theatre bonuses, Humanoid subtype rule, Lv10 Fighting Style + Spellcasting, and scaling choices verified.");
