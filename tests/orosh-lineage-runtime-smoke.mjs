import assert from "node:assert/strict";

const character = {
  id: "player-orosh",
  name: "Orosh Tester",
  classes: [{ classId: "sorcerer", levels: 40, archetypeId: "orosh_lineage" }],
  archetypes: [{ id: "orosh_lineage", classId: "sorcerer" }],
};

const combatUnit = {
  id: "combat-unit-77",
  combatId: "combat-unit-77",
  name: "Orosh Tester",
  hp: 100,
};

globalThis.LuminousPlayerTraitRuntime = {
  getCharacter() { return character; },
};

globalThis.LuminousArchetypeEngine = {
  isSelected(input, archetypeId, classId) {
    return archetypeId === "orosh_lineage"
      && classId === "sorcerer"
      && (input?.archetypes || []).some((entry) => entry.id === "orosh_lineage");
  },
  getClassLevel(input, classId) {
    return input?.classes?.find((entry) => entry.classId === classId)?.levels || 0;
  },
};

globalThis.LuminousTraitEngine = {
  resolveTheatreCheck(input = {}) {
    return {
      check: { difficulty: 0, abilityPower: 0, finalPower: 0, ...(input.check || {}) },
      state: input.state || {},
      outcomes: [],
    };
  },
  dispatchTrait(trait, trigger, runtime = {}, traitState = {}) {
    return { trait, trigger, runtime, state: traitState, outcomes: [] };
  },
};

let lastAoEWeight = null;
globalThis.CombatEngine = {
  calculateFinalPower() { return 10; },
  calculateCoinDamage() { return 100; },
  calculateAoETargets(skill, primaryTarget) {
    lastAoEWeight = skill.attackWeight ?? skill.atkWeight ?? skill.weight ?? 1;
    return primaryTarget ? [primaryTarget] : [];
  },
};

await import("../js/orosh-lineage-runtime.js");
const runtime = globalThis.LuminousOroshLineageRuntime;
assert.ok(runtime, "Orosh runtime should expose an API");
assert.equal(runtime.isSelected(character), true, "Orosh should be detected");
assert.equal(runtime.isSelected(combatUnit), true, "Linked combat unit should resolve the player's Orosh build");
assert.equal(runtime.getLevel(character), 40, "Sorcerer class level should resolve");
assert.equal(runtime.getLevel(combatUnit), 40, "Linked combat unit should share the player class level");

const fragmentSelection = runtime.selectFragment(character, "Pride");
assert.equal(fragmentSelection.selected, true);
assert.equal(fragmentSelection.fragment, "pride");

const illegalReselection = runtime.selectFragment(character, "Wrath");
assert.equal(illegalReselection.selected, false, "Fragment cannot be reselected before Long Rest");
assert.equal(illegalReselection.reason, "fragment_locked_until_long_rest");
assert.equal(runtime.getState(character).selectedFragment, "pride", "Locked reselection must preserve the original Fragment");
assert.equal(runtime.getState(combatUnit), runtime.getState(character), "Theatre character and Combat unit must share one Orosh state record");

const fragmentedTrait = { id: "orosh_lineage_fragmented_blessing" };
const firstPersuasion = globalThis.LuminousTraitEngine.resolveTheatreCheck({
  character,
  traits: [fragmentedTrait],
  check: { skillId: "Persuasion", finalPower: 5 },
});
assert.equal(firstPersuasion.check.finalPower, 7, "Fragmented Blessing should add +2 Final Power");

const secondPersuasion = globalThis.LuminousTraitEngine.resolveTheatreCheck({
  character,
  traits: [fragmentedTrait],
  check: { skillId: "Persuasion", finalPower: 5 },
});
assert.equal(secondPersuasion.check.finalPower, 5, "Fragmented Blessing check bonus should only apply once before reset");

const failedRefill = runtime.selectFragment(character, "Pride");
assert.equal(failedRefill.selected, false, "Reselecting the same Fragment must not refill the once-per-rest check bonus");
assert.equal(runtime.getState(character).fragmentCheckBonusUsed, true, "Failed reselection must not refund the Fragment check bonus");

const emotionalTrait = { id: "orosh_lineage_emotional_echo" };
const emotionalRead = globalThis.LuminousTraitEngine.resolveTheatreCheck({
  character,
  traits: [emotionalTrait],
  target: { id: "human-target", raceId: "humano" },
  check: { skillId: "Insight", intent: "detect_lie", finalPower: 4 },
});
assert.equal(emotionalRead.check.finalPower, 6, "Emotional Echo should add +2 to an explicit emotional Insight check");

const yuanTiRead = globalThis.LuminousTraitEngine.resolveTheatreCheck({
  character,
  traits: [emotionalTrait],
  target: { id: "yuan-ti-target", raceId: "yuanti_pura_sangre" },
  check: { skillId: "Insight", intent: "detect_lie", finalPower: 4 },
});
assert.equal(yuanTiRead.check.finalPower, 4, "Emotional Echo should not apply against Yuan-ti");

const prideSkill = {
  type: "Attack",
  sinAffinity: "Pride",
  basePower: 4,
  coinPower: 4,
  attackWeight: 1,
};
assert.equal(
  globalThis.CombatEngine.calculateFinalPower(prideSkill, 1, combatUnit),
  12,
  "Level 40 Pride skill should receive +2 Final Power through the linked Combat unit",
);
assert.equal(
  globalThis.CombatEngine.calculateCoinDamage(combatUnit, {}, prideSkill),
  120,
  "Level 40 Pride skill should receive +20% Damage through the linked Combat unit",
);

const unrelatedSkill = {
  type: "Attack",
  sinAffinity: "Wrath",
  basePower: 4,
  coinPower: 4,
  attackWeight: 1,
};
assert.equal(
  globalThis.CombatEngine.calculateFinalPower(unrelatedSkill, 1, combatUnit),
  10,
  "Other Sins should not receive Fragmented Blessing power",
);
assert.equal(
  globalThis.CombatEngine.calculateCoinDamage(combatUnit, {}, unrelatedSkill),
  100,
  "Other Sins should not receive Fragmented Blessing damage",
);

const mentalSpellA = { type: "Spell", tags: ["emotion"], attackWeight: 1 };
globalThis.CombatEngine.calculateAoETargets(mentalSpellA, { id: "target-a" }, [], combatUnit);
assert.equal(lastAoEWeight, 2, "Primordial Bond should add +1 ATK Weight to the first eligible spell");

const mentalSpellB = { type: "Spell", tags: ["mind"], attackWeight: 1 };
globalThis.CombatEngine.calculateAoETargets(mentalSpellB, { id: "target-b" }, [], combatUnit);
assert.equal(lastAoEWeight, 1, "Primordial Bond should only apply once per turn");

globalThis.LuminousTraitEngine.dispatchTrait(
  { id: "orosh_lineage_primordial_bond" },
  "turn_start",
  { character: combatUnit, self: combatUnit },
  {},
);
const mentalSpellC = { type: "Spell", tags: ["mind"], attackWeight: 1 };
globalThis.CombatEngine.calculateAoETargets(mentalSpellC, { id: "target-c" }, [], combatUnit);
assert.equal(lastAoEWeight, 2, "Primordial Bond should reset at Turn Start");

assert.equal(runtime.canIgnoreTargetingObscurement(combatUnit, "normal_darkness"), true);
assert.equal(runtime.canIgnoreTargetingObscurement(combatUnit, "magical_darkness"), true);
assert.equal(runtime.canIgnoreTargetingObscurement(combatUnit, "visual_camouflage"), true);
assert.equal(runtime.canIgnoreTargetingObscurement(combatUnit, "solid_wall"), false);

runtime.resetLongRest(character);
assert.equal(runtime.getState(character).selectedFragment, null, "Long Rest should require a new Fragment selection");
assert.equal(runtime.getState(character).fragmentSelectionAvailable, true, "Long Rest should unlock Fragment selection");
assert.equal(runtime.getState(character).fragmentCheckBonusUsed, false, "Long Rest should reset the Fragment check use");

const postRestSelection = runtime.selectFragment(combatUnit, "Wrath");
assert.equal(postRestSelection.selected, true, "Fragment selection should be available again after Long Rest");
assert.equal(runtime.getState(character).selectedFragment, "wrath", "Combat-side selection must update the shared player state");

console.log("Orosh Lineage runtime smoke passed.");
