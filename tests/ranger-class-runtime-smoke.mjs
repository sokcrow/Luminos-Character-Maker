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
  "LuminousCombatAction",
  "LuminousRangerClassRuntime",
]) delete globalThis[key];

await import("../js/trait-engine.js");
await import("../js/trait-catalog-core.js");
await import("../js/universal-modifier-engine.js");
await import("../js/creature-type-catalog.js");
await import("../js/fighting-style-runtime.js");
await import("../js/spellcasting-runtime.js");
await import("../js/caster-spellcasting-traits-runtime.js");
await import("../js/combat-action-schema.js");
await import("../js/ranger-class-runtime.js");
await import("../js/combat-analyze-check-contract.js");

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
const analyzeContract = globalThis.LuminousCombatAnalyzeCheckContract;
const favoredAnalyze = analyzeContract.resolveAnalyzeContract(lv1, wolf, { threshold: 12 });
assert.equal(favoredAnalyze.type, "automatic");
assert.equal(favoredAnalyze.bypassCheck, true);
assert.equal(favoredAnalyze.sourceTraitId, "favored_enemy");
const genericAnalyze = analyzeContract.resolveAnalyzeContract(lv1, goblin, { threshold: 12 });
assert.equal(genericAnalyze.type, "check");
assert.deepEqual(genericAnalyze.check, { stat: "wis", skill: "perception", threshold: 12 });
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

// Full automatic Ranger trunk grants.
const expectedGrantByLevel = [
  [15, "primeval_awareness"],
  [25, "additional_attack"],
  [40, "lands_stride"],
  [50, "hide_in_plain_sight"],
  [70, "vanish"],
  [90, "feral_senses"],
  [100, "foe_slayer"],
];
for (const [level, traitId] of expectedGrantByLevel) {
  const character = makeRanger(level);
  const granted = engine.resolveTraitGrants(character, catalog.allGrants(), catalog.allDefinitions());
  assert.ok(granted.some((trait) => trait.id === traitId), `Ranger Lv${level} should automatically receive ${traitId}`);
}
assert.equal(catalog.getDefinition("primeval_awareness").mechanics.loreOnly, true);
assert.equal(catalog.getDefinition("lands_stride").mechanics.loreOnly, true);

// Hide in Plain Sight is an Action at Lv50, resolves from a hidden Stealth result at Turn End,
// preserves the Encounter position contract, becomes untargetable for direct enemy targeting, and reveals before attacking.
const lv50 = makeRanger(50);
assert.equal(runtime.applyNaturalExplorerChoices(lv50, "forest").success, true);
assert.equal(runtime.hideInPlainSightActionCost(lv50), "action");
assert.deepEqual(runtime.hideInPlainSightAvailable(lv50, { terrain: "forest" }), { available: true, reason: null, actionCost: "action" });
assert.equal(runtime.hideInPlainSightAvailable(lv50, { terrain: "desert" }).reason, "favored_terrain_required");
assert.equal(runtime.armHideInPlainSight(lv50, { terrain: "forest" }).success, true);
let hideResult = runtime.completeHideInPlainSight(lv50, { success: true });
assert.equal(hideResult.hidden, true);
assert.equal(hideResult.leavesEncounter, false);
assert.equal(hideResult.preserveGridPosition, true);
assert.equal(runtime.isHiddenInPlainSight(lv50), true);
assert.deepEqual(runtime.filterEnemyDirectTargetCandidates([lv50, { id: "visible_enemy" }]).map((unit) => unit.id), ["visible_enemy"]);
assert.equal(runtime.onBeforeSkill(lv50, { skillFamily: "attack", attackMode: "ranged" }).revealed, true);
assert.equal(runtime.isHiddenInPlainSight(lv50), false);

// Vanish upgrades the same Hide action instead of creating a second Hide system.
const lv70 = makeRanger(70);
assert.equal(runtime.applyNaturalExplorerChoices(lv70, "forest").success, true);
assert.equal(runtime.hideInPlainSightActionCost(lv70), "quick_action");
assert.equal(runtime.vanishPreventsNonmagicalTracking(lv70, {}), true);
assert.equal(runtime.vanishPreventsNonmagicalTracking(lv70, { magical: true }), false);
assert.equal(runtime.vanishPreventsNonmagicalTracking(lv70, { leaveTrail: true }), false);
traits = engine.resolveTraitGrants(lv70, catalog.allGrants(), catalog.allDefinitions());
const hideAction = engine.listAvailableTraitActions(traits, { context: "combat", character: lv70, self: lv70, terrain: "forest" })
  .find((entry) => entry.traitId === "hide_in_plain_sight");
assert.equal(hideAction?.actionCost, "quick_action", "Vanish should upgrade Hide in Plain Sight to Quick Action");

// Feral Senses: Invisible enemies are seen only when they are Slower than the Ranger.
const lv90 = makeRanger(90);
lv90.speed = 6;
assert.equal(runtime.feralSensesCanSee(lv90, { invisible: true, speed: 5 }), true);
assert.equal(runtime.feralSensesCanSee(lv90, { invisible: true, speed: 6 }), false);
assert.equal(runtime.feralSensesCanSee(lv90, { invisible: false, speed: 5 }), false);

// Foe Slayer: each Turn starts with one choice; only that choice applies against Favored Enemy.
const lv100 = makeRanger(100);
lv100.stats = { sabiduria: 16 };
assert.equal(runtime.applyFavoredEnemyChoices(lv100, "beast").success, true);
assert.equal(runtime.beginFoeSlayerTurn(lv100).pendingChoice, true);
assert.equal(runtime.selectFoeSlayerChoice(lv100, "damage").success, true);
assert.deepEqual(runtime.foeSlayerBonuses(lv100, wolf), { choice: "damage", damagePercent: 30, finalPower: 0 });
traits = engine.resolveTraitGrants(lv100, catalog.allGrants(), catalog.allDefinitions());
result = modifiers.resolveTraitModifiers({ character: lv100, unit: lv100, target: wolf, traits, skill: { skillFamily: "attack", attackMode: "ranged" } });
assert.equal(result.damage_dealt_multiplier, 3, "Foe Slayer damage option should add +30% Damage at WIS Mod +3");
assert.equal(result.final_power, 1, "Damage option keeps only Favored Enemy's base +1 Final Power");
runtime.beginFoeSlayerTurn(lv100);
assert.equal(runtime.foeSlayerChoice(lv100), null, "Foe Slayer selection expires at the next Turn Start");
assert.equal(runtime.selectFoeSlayerChoice(lv100, "final_power").success, true);
assert.deepEqual(runtime.foeSlayerBonuses(lv100, wolf), { choice: "final_power", damagePercent: 0, finalPower: 3 });
result = modifiers.resolveTraitModifiers({ character: lv100, unit: lv100, target: wolf, traits, skill: { skillFamily: "attack", attackMode: "ranged" } });
assert.equal(result.damage_dealt_multiplier, 0);
assert.equal(result.final_power, 4, "Foe Slayer Final Power option stacks with Favored Enemy's base +1");
assert.deepEqual(runtime.foeSlayerBonuses(lv100, goblin), { choice: null, damagePercent: 0, finalPower: 0 }, "Foe Slayer only applies to Favored Enemies");

assert.equal(catalog.validateAll(engine).valid, true, "Expanded Ranger catalog should validate");

console.log("Ranger class runtime smoke passed: full Lv1-Lv100 automatic trunk grants, choices, Hide/Vanish, Feral Senses, and Foe Slayer verified.");
