import assert from "node:assert/strict";

for (const key of [
  "LuminousTraitEngine",
  "LuminousTraitCatalogCore",
  "LuminousArchetypeEngine",
  "LuminousArchetypeTraitCatalog",
  "LuminousArchetypeRuntime",
  "LuminousStatusEngine",
  "LuminousStatusLibrary",
  "STATUS_REGISTRY",
  "LuminousSpellcastingRuntime",
  "LuminousUniversalModifiers",
  "LuminousActionEconomy",
  "LuminousWizardClassRuntime",
  "LuminousBladesingerArchetypeRuntime",
]) delete globalThis[key];

await import("../js/trait-engine.js");
await import("../js/trait-catalog-core.js");
await import("../js/archetype-engine.js");
await import("../js/archetype-trait-catalog.js");
await import("../js/status-engine.js");
await import("../js/status-library.js");
await import("../js/spellcasting-runtime.js");
await import("../js/spellcasting-basic-rules-runtime.js");
await import("../js/universal-action-economy.js");
await import("../js/universal-modifier-engine.js");
await import("../js/wizard-class-runtime.js");

globalThis.LuminousArchetypeRuntime = {
  syncArchetypeTraitsForUnit() { return []; },
};

await import("../js/bladesinger-archetype-runtime.js");

const runtime = globalThis.LuminousBladesingerArchetypeRuntime;
const archetypes = globalThis.LuminousArchetypeTraitCatalog;
const traitEngine = globalThis.LuminousTraitEngine;
const core = globalThis.LuminousTraitCatalogCore;
const modifiers = globalThis.LuminousUniversalModifiers;
const spellcasting = globalThis.LuminousSpellcastingRuntime;

assert.ok(runtime, "Bladesinger archetype runtime should install");
assert.equal(runtime.ARCHETYPE_ID, "bladesinger");
assert.equal(runtime.CLASS_ID, "wizard");
assert.equal(runtime.ARCHETYPE.unlockLevel, 10);
assert.equal(archetypes.allArchetypes().bladesinger.name, "Bladesinger");
assert.equal(globalThis.LuminousStatusLibrary.get("bladesong")?.icon, "https://imgur.com/kkJI5mM.png");

const makeWizard = (level, extra = {}) => ({
  id: `bladesinger_${level}`,
  hp: 100,
  maxHp: 100,
  stats: { intelligence: 20 },
  classes: [{ id: "wizard", level }],
  characterBuild: {
    archetypes: [{ classId: "wizard", archetypeId: "bladesinger", selectedAtClassLevel: 10 }],
  },
  equipment: {},
  ...extra,
});

function grantedIds(character) {
  return archetypes.resolveTraitGrants(character).map((trait) => trait.id).filter(Boolean);
}

assert.deepEqual(
  grantedIds(makeWizard(10)).sort(),
  ["training_in_war_and_song", "bladesong"].sort(),
  "Level 10 automatically grants Training in War and Song and Bladesong",
);

assert.deepEqual(
  grantedIds(makeWizard(30)).sort(),
  ["training_in_war_and_song", "bladesong", "additional_attack"].sort(),
  "Level 30 automatically grants the universal Additional Attack",
);

assert.deepEqual(
  grantedIds(makeWizard(50)).sort(),
  ["training_in_war_and_song", "bladesong", "additional_attack", "song_of_defense"].sort(),
  "Level 50 automatically grants Song of Defense",
);

assert.deepEqual(
  grantedIds(makeWizard(70)).sort(),
  ["training_in_war_and_song", "bladesong", "additional_attack", "song_of_defense", "song_of_victory"].sort(),
  "Level 70 automatically grants Song of Victory",
);

const wizard70 = makeWizard(70);
const allTraits = traitEngine.resolveTraitGrants(wizard70, core.allGrants(), core.allDefinitions());
for (const id of ["training_in_war_and_song", "bladesong", "additional_attack", "song_of_defense", "song_of_victory"]) {
  assert.ok(allTraits.some((trait) => trait.id === id), `${id} should resolve for a Level 70 Bladesinger`);
}

const training = runtime.ensureTrainingProficiencies(wizard70);
assert.equal(training.applied, true);
assert.ok(wizard70.armorProficiencies.includes("light"), "Training grants Light Armor proficiency");
assert.equal(wizard70.skillProficiency.performance, "proficient", "Training grants Performance proficiency");
assert.equal(runtime.setWarAndSongWeaponChoice(wizard70, "rapier").success, true);
assert.ok(wizard70.weaponProficiencies.includes("rapier"), "Chosen one-handed weapon proficiency is stored");

const activated = runtime.activateBladesong(wizard70, { consumeActionCost: false });
assert.equal(activated.success, true);
assert.equal(runtime.bladesongActive(wizard70), true);

const bladesongTrait = allTraits.find((trait) => trait.id === "bladesong");
const songOfVictory = allTraits.find((trait) => trait.id === "song_of_victory");
const bladeMods = modifiers.resolveTraitModifiers({
  unit: wizard70,
  character: wizard70,
  traits: [bladesongTrait],
  context: "combat",
  skill: { skillFamily: "defense", defenseSubtype: "Guard" },
});
assert.equal(bladeMods.defense_power, 5, "Bladesong gains INT Modifier Defense Power");
assert.equal(bladeMods.min_speed, 1, "Bladesong gains +1 Min Speed");
assert.equal(bladeMods.max_speed, 1, "Bladesong gains +1 Max Speed");

const victoryMods = modifiers.resolveTraitModifiers({
  unit: wizard70,
  character: wizard70,
  traits: [songOfVictory],
  context: "combat",
  skill: { skillFamily: "attack", attackMode: "melee" },
});
assert.equal(victoryMods.damage_dealt_multiplier, 2.5, "INT +5 yields +25% Melee Damage through Song of Victory");
assert.equal(runtime.songOfVictoryDamagePercent(wizard70), 25);

const rangedVictoryMods = modifiers.resolveTraitModifiers({
  unit: wizard70,
  character: wizard70,
  traits: [songOfVictory],
  context: "combat",
  skill: { skillFamily: "attack", attackMode: "ranged" },
});
assert.equal(rangedVictoryMods.damage_dealt_multiplier, 0, "Song of Victory does not boost ranged attacks");

const acrobatics = runtime.applyAcrobaticsBonus({ skillId: "acrobatics", finalPower: 7 }, wizard70);
assert.equal(acrobatics.finalPower, 11, "Bladesong grants +4 on Acrobatics Checks");
assert.equal(runtime.concentrationSaveBonus(wizard70), 5, "Bladesong grants INT Modifier to Concentration Saves");

spellcasting.spellSlotPool(wizard70, "wizard");
const slot5Before = spellcasting.spellSlotPool(wizard70, "wizard").levels[5].available;
const defense = runtime.armSongOfDefense(wizard70, 5, { consumeActionCost: false });
assert.equal(defense.success, true);
assert.equal(defense.reductionPercent, 50);
assert.equal(spellcasting.spellSlotPool(wizard70, "wizard").levels[5].available, slot5Before - 1, "Song of Defense spends a real Wizard Spell Slot");
const reduced = runtime.applySongOfDefenseDamage(wizard70, 100);
assert.equal(reduced.damage, 50);
assert.equal(reduced.reduced, 50);
assert.equal(runtime.applySongOfDefenseDamage(wizard70, 100).damage, 100, "Song of Defense applies to one incoming damage instance");

runtime.endBladesong(wizard70, "test");
assert.equal(runtime.bladesongActive(wizard70), false);
assert.equal(runtime.songOfVictoryDamagePercent(wizard70), 0);

runtime.activateBladesong(wizard70, { consumeActionCost: false });
wizard70.equipment = { armor: { category: "heavy", id: "plate" } };
const maintained = runtime.maintainBladesong(wizard70);
assert.equal(maintained.ended, true, "Bladesong ends with incompatible armor");
assert.equal(runtime.bladesongActive(wizard70), false);

const unselected = {
  id: "plain_wizard",
  classes: [{ id: "wizard", level: 70 }],
  characterBuild: { archetypes: [] },
};
assert.equal(archetypes.resolveTraitGrants(unselected).some((trait) => runtime.GRANTS.some((grant) => grant.traitId === trait.id)), false, "Unselected Wizards do not gain Bladesinger Traits through the Archetype catalog");
const unselectedCoreTraits = traitEngine.resolveTraitGrants(unselected, core.allGrants(), core.allDefinitions());
assert.equal(unselectedCoreTraits.some((trait) => runtime.GRANTS.some((grant) => grant.traitId === trait.id)), false, "Unselected Wizards do not gain Bladesinger Traits through the core Trait resolver");

console.log("Bladesinger archetype runtime smoke tests passed.");
