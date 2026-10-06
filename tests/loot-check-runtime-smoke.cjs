"use strict";

const assert = require("node:assert/strict");
const runtime = require("../js/loot-check-runtime.js");

assert.equal(runtime.COIN_COUNT, 5);
assert.equal(runtime.HEAD_BONUS, 4);
assert.equal(runtime.getCheckProfile("loot_search").id, "search");
assert.equal(runtime.getCheckProfile("analyse").defaultSkill, "perception");

const player = {
  level: 40,
  sp: 20,
  stats: { sabiduria: 16, inteligencia: 12 },
  dndSkills: {
    investigation: { value: 7, proficiency: "expertise" },
  },
  skillProficiency: {
    survival: "expertise",
  },
};

const search = runtime.createLootCheckDefinition(player, "search", { dc: 18 });
assert.equal(search.skill, "investigation");
assert.equal(search.ability, "int");
assert.equal(search.base, 7);
assert.equal(search.math.source, "dndSkills.value");
assert.equal(search.headsChance, 70);
assert.equal(search.coinCount, 5);
assert.equal(search.headBonus, 4);
assert.equal(search.threshold, 18);

const survival = runtime.createLootCheckDefinition(player, "harvest");
assert.equal(survival.skill, "survival");
assert.equal(survival.ability, "wis");
assert.equal(survival.math.modifier, 3);
assert.equal(survival.math.proficiencyBonus, 2);
assert.equal(survival.math.proficiencyValue, 4);
assert.equal(survival.base, 7);

const canonicalUnit = {
  runtimeLevel: 20,
  scores: { int: 14, wis: 11 },
  proficiencies: {
    skills: {
      investigation: "proficient",
      medicine: "half",
    },
  },
  combatStats: { sp_actual: -10 },
};

const salvage = runtime.createLootCheckDefinition(canonicalUnit, "salvage");
assert.equal(salvage.base, 3);
assert.equal(salvage.math.modifier, 2);
assert.equal(salvage.math.proficiencyBonus, 1);
assert.equal(salvage.math.proficiencyValue, 1);
assert.equal(salvage.headsChance, 40);

const npc = {
  stats: { inteligencia: 18, sabiduria: 14 },
  proficiencyBonus: 3,
  skillProficiency: {
    investigation: "expertise",
    medicine: "proficient",
  },
};

const npcSearch = runtime.createLootCheckDefinition(npc, "search");
assert.equal(npcSearch.base, 10);
assert.equal(npcSearch.math.modifier, 4);
assert.equal(npcSearch.math.proficiencyValue, 6);

const autopsyMedicine = runtime.createLootCheckDefinition(npc, "autopsy");
assert.equal(autopsyMedicine.skill, "medicine");
assert.equal(autopsyMedicine.base, 5);

const autopsyInvestigation = runtime.createLootCheckDefinition(npc, "autopsy", { skill: "investigation" });
assert.equal(autopsyInvestigation.skill, "investigation");
assert.equal(autopsyInvestigation.base, 10);

assert.throws(
  () => runtime.createLootCheckDefinition(npc, "autopsy", { skill: "survival" }),
  /SKILL_NOT_ALLOWED_FOR_CHECK:autopsy:survival/,
);

assert.throws(
  () => runtime.createLootCheckDefinition(npc, "magic_loot"),
  /UNKNOWN_LOOT_CHECK:magic_loot/,
);

const sequence = [0.1, 0.9, 0.2, 0.8, 0.3];
let index = 0;
const resolved = runtime.resolveLootCheck(
  { ...canonicalUnit, combatStats: { sp_actual: 0 } },
  "search",
  {
    dc: 12,
    rng: () => sequence[index++],
  },
);
assert.equal(resolved.heads, 3);
assert.equal(resolved.tails, 2);
assert.equal(resolved.base, 3);
assert.equal(resolved.total, 15);
assert.equal(resolved.success, true);
assert.equal(resolved.margin, 3);
assert.deepEqual(resolved.coins.map((coin) => coin.side), ["head", "tail", "head", "tail", "head"]);

const failure = runtime.resolveLootCheck(
  { scores: { int: 8 }, sp: 0 },
  "search",
  {
    threshold: 20,
    rng: () => 0.99,
  },
);
assert.equal(failure.base, -1);
assert.equal(failure.heads, 0);
assert.equal(failure.total, -1);
assert.equal(failure.success, false);
assert.equal(failure.margin, -21);

const thresholdModified = runtime.createLootCheckDefinition(npc, "search", {
  threshold: 15,
  thresholdModifier: 3,
});
assert.equal(thresholdModified.thresholdBase, 15);
assert.equal(thresholdModified.thresholdModifier, 3);
assert.equal(thresholdModified.threshold, 18);

assert.equal(runtime.headsChance({ sp: 100 }), 95);
assert.equal(runtime.headsChance({ sp: -100 }), 5);

console.log("loot-check-runtime smoke: OK");
