import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const character = {
  id: "player-orosh",
  name: "Orosh Tester",
  classes: [{ classId: "sorcerer", levels: 40, archetypeId: "orosh_lineage" }],
  archetypes: [{ id: "orosh_lineage", classId: "sorcerer" }],
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

const runtime = require("../js/orosh-lineage-runtime.js");
assert.ok(runtime, "Orosh runtime should export an API");
assert.equal(runtime.isSelected(character), true, "Orosh should be detected");
assert.equal(runtime.getLevel(character), 40, "Sorcerer class level should resolve");

const fragmentSelection = runtime.selectFragment(character, "Pride");
assert.equal(fragmentSelection.selected, true);
assert.equal(fragmentSelection.fragment, "pride");

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

runtime.selectFragment(character, "Pride");
const prideSkill = { type: "Attack", sinAffinity: "Pride", basePower: 4, coinPower: 4, attackWeight: 1 };
assert.equal(globalThis.CombatEngine.calculateFinalPower(prideSkill, 1, character), 12, "Level 40 Pride skill should receive +2 Final Power");
assert.equal(globalThis.CombatEngine.calculateCoinDamage(character, {}, prideSkill), 120, "Level 40 Pride skill should receive +20% Damage");

const unrelatedSkill = { type: "Attack", sinAffinity: "Wrath", basePower: 4, coinPower: 4, attackWeight: 1 };
assert.equal(globalThis.CombatEngine.calculateFinalPower(unrelatedSkill, 1, character), 10, "Other Sins should not receive Fragmented Blessing power");
assert.equal(globalThis.CombatEngine.calculateCoinDamage(character, {}, unrelatedSkill), 100, "Other Sins should not receive Fragmented Blessing damage");

const mentalSpellA = { type: "Spell", tags: ["emotion"], attackWeight: 1 };
globalThis.CombatEngine.calculateAoETargets(mentalSpellA, { id: "target-a" }, [], character);
assert.equal(lastAoEWeight, 2, "Primordial Bond should add +1 ATK Weight to the first eligible spell");

const mentalSpellB = { type: "Spell", tags: ["mind"], attackWeight: 1 };
globalThis.CombatEngine.calculateAoETargets(mentalSpellB, { id: "target-b" }, [], character);
assert.equal(lastAoEWeight, 1, "Primordial Bond should only apply once per turn");

globalThis.LuminousTraitEngine.dispatchTrait(
  { id: "orosh_lineage_primordial_bond" },
  "turn_start",
  { character, self: character },
  {},
);
const mentalSpellC = { type: "Spell", tags: ["mind"], attackWeight: 1 };
globalThis.CombatEngine.calculateAoETargets(mentalSpellC, { id: "target-c" }, [], character);
assert.equal(lastAoEWeight, 2, "Primordial Bond should reset at Turn Start");

assert.equal(runtime.canIgnoreTargetingObscurement(character, "normal_darkness"), true);
assert.equal(runtime.canIgnoreTargetingObscurement(character, "magical_darkness"), true);
assert.equal(runtime.canIgnoreTargetingObscurement(character, "visual_camouflage"), true);
assert.equal(runtime.canIgnoreTargetingObscurement(character, "solid_wall"), false);

runtime.resetLongRest(character);
assert.equal(runtime.getState(character).selectedFragment, null, "Long Rest should require a new Fragment selection");
assert.equal(runtime.getState(character).fragmentCheckBonusUsed, false, "Long Rest should reset the Fragment check use");

console.log("Orosh Lineage runtime smoke passed.");
