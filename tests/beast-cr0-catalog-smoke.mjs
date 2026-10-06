import assert from "node:assert/strict";

await import("../js/proficiency-runtime.js");
await import("../js/combat-skill-schema.js");
await import("../js/skill-catalog-beast-cr0.js");
await import("../js/unit-catalog-beast-cr0.js");

const prof = globalThis.LuminousProficiencyRuntime;
const skills = globalThis.LuminousBeastCr0SkillCatalog;
const units = globalThis.LuminousBeastCr0UnitCatalog;

if (!prof || !skills || !units) throw new Error("CR0 beast catalogs did not initialize.");

const expectedIds = [
  "baboon",
  "badger",
  "bat",
  "cat",
  "crab",
  "deer",
  "eagle",
  "frog",
  "giant_fire_beetle",
  "goat",
  "hawk",
];
assert.deepEqual(Object.keys(units.firebasePayload()).sort(), expectedIds.slice().sort());
assert.equal(skills.list().length, 11);

assert.deepEqual(units.get("baboon").scores, { str: 8, dex: 14, con: 11, int: 4, wis: 12, cha: 6 });
assert.deepEqual(units.get("badger").proficiencies.skills, { perception: "proficient" });
assert.deepEqual(units.get("cat").proficiencies, {
  savingThrows: { dex: "proficient" },
  skills: { perception: "proficient", stealth: "proficient" },
});
assert.deepEqual(units.get("crab").proficiencies.skills, { stealth: "proficient" });
assert.deepEqual(units.get("deer").proficiencies.skills, { perception: "proficient" });
assert.equal(units.get("eagle").proficiencies.skills.perception, "expertise");
assert.deepEqual(units.get("frog").proficiencies.skills, { perception: "proficient", stealth: "proficient" });
assert.deepEqual(units.get("goat").proficiencies, {
  savingThrows: { str: "proficient" },
  skills: { perception: "proficient" },
});
assert.equal(units.get("hawk").proficiencies.skills.perception, "expertise");

assert.equal(units.CAT_APPEARANCES.length, 10);
assert.equal(units.get("cat").summon.selectableAppearance, true);
assert.equal(units.get("cat").summonAppearanceOptions[0].id, "domestic_longhair");
assert.equal(units.get("cat").summonAppearanceOptions[9].id, "sphynx");

const bat = units.get("bat");
assert.equal(bat.mechanics.flying, true);
assert.deepEqual(bat.mechanics.flyingTargetability.canBeHitIfAny, [
  "lost_clash_against_skill",
  "attacker_weapon_is_ranged",
  "attacker_weapon_has_reach",
]);
assert.equal(bat.mechanics.blindsight.detectsInvisible, true);
assert.equal(bat.mechanics.blindsight.ignoresDarkness, true);

const badger = units.get("badger");
assert.equal(badger.mechanics.poisonResistance.statusDamageMultiplier, 0.5);
assert.equal(badger.mechanics.burrow.durationTurns, 1);
assert.equal(badger.mechanics.burrow.untargetable, true);

assert.equal(units.get("crab").traits[0].mechanics.underwaterEncounter.gainsAirCounter, false);
assert.equal(units.get("deer").traits[0].mechanics.skillsTriggerCounterAttacks, false);
assert.equal(units.get("cat").traits[0].mechanics.jumpCheckAbility, "dex");
assert.equal(units.get("cat").traits[0].mechanics.jumpCheckFinalPowerBonus, 3);

assert.equal(skills.finalPower("baboon_bite"), 11);
assert.equal(skills.finalPower("badger_bite"), 10);
assert.equal(skills.finalPower("bat_bite"), 10);
assert.equal(skills.finalPower("cat_scratch"), 10);
assert.equal(skills.finalPower("crab_claw"), 10);
assert.equal(skills.finalPower("deer_ram"), 11);
assert.equal(skills.finalPower("eagle_talons"), 11);
assert.equal(skills.finalPower("frog_bite"), 10);
assert.equal(skills.finalPower("giant_fire_beetle_bite"), 10);
assert.equal(skills.finalPower("goat_ram"), 10);
assert.equal(skills.finalPower("hawk_talons"), 10);

assert.equal(skills.get("cat_scratch").coins[0].effects[0].status, "bleed");
assert.equal(skills.get("cat_scratch").coins[0].effects[0].potency, 2);
assert.equal(skills.get("crab_claw").coins[0].effects[0].status, "tremor");
assert.equal(skills.get("deer_ram").coins[0].effects[0].status, "tremor");
assert.equal(skills.get("giant_fire_beetle_bite").coins[0].effects[0].status, "burn");
assert.equal(skills.get("giant_fire_beetle_bite").coins[0].effects[1].conditionStatus, "burn");
assert.equal(skills.get("goat_ram").metadata.conditionalClashPower.bonus, 1);
assert.equal(skills.get("bat_bite").metadata.healOnBleedingTarget, 2);

const eagle65 = units.resolve("eagle", { level: 65 });
assert.equal(eagle65.proficiencyBonus, 4);
assert.equal(prof.skillBonus(eagle65, "perception"), 10);
assert.equal(eagle65.maxHp, 9);

const cat65 = units.resolve("cat", { level: 65 });
assert.equal(prof.savingThrowBonus(cat65, "dex"), 6);
assert.equal(prof.skillBonus(cat65, "stealth"), 6);

console.log("CR0 beast catalog smoke: ok");
