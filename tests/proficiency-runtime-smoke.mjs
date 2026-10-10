import assert from "node:assert/strict";

await import("../js/proficiency-runtime.js");

const runtime = globalThis.LuminousProficiencyRuntime;
if (!runtime) throw new Error("Universal proficiency runtime did not initialize.");

assert.equal(runtime.proficiencyBonus(1), 2);
assert.equal(runtime.proficiencyBonus(20), 2);
assert.equal(runtime.proficiencyBonus(21), 3);
assert.equal(runtime.proficiencyBonus(40), 3);
assert.equal(runtime.proficiencyBonus(41), 4);
assert.equal(runtime.proficiencyBonus(60), 4);
assert.equal(runtime.proficiencyBonus(61), 5);
assert.equal(runtime.proficiencyBonus(65), 5);

assert.equal(runtime.contribution(1, "none"), 0);
assert.equal(runtime.contribution(1, "proficient"), 2);
assert.equal(runtime.contribution(65, "proficient"), 5);
assert.equal(runtime.contribution(65, "expertise"), 10);
assert.equal(runtime.contribution(65, "half"), 2);

const hawk = {
  runtimeLevel: 65,
  scores: { wis: 14 },
  proficiencies: { skills: { perception: "expertise" } },
};
assert.equal(runtime.skillBonus(hawk, "perception"), 12);

const goat = {
  runtimeLevel: 65,
  scores: { str: 11 },
  proficiencies: { savingThrows: { str: "proficient" } },
};
assert.equal(runtime.savingThrowBonus(goat, "str"), 5);

console.log("universal proficiency runtime smoke: ok");
