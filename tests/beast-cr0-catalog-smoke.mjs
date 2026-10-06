import assert from "node:assert/strict";

await import("../js/proficiency-runtime.js");
await import("../js/movement-speed-runtime.js");
await import("../js/combat-skill-schema.js");
await import("../js/skill-catalog-beast-cr0.js");
await import("../js/unit-catalog-beast-cr0.js");

const prof = globalThis.LuminousProficiencyRuntime;
const movement = globalThis.LuminousMovementSpeedRuntime;
const skills = globalThis.LuminousBeastCr0SkillCatalog;
const units = globalThis.LuminousBeastCr0UnitCatalog;

if (!prof || !movement || !skills || !units) throw new Error("CR0 beast catalogs did not initialize.");

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
  "hyena",
  "jackal",
  "lizard",
  "octopus",
  "owl",
  "piranha",
  "rat",
  "raven",
  "scorpion",
];
assert.deepEqual(Object.keys(units.firebasePayload()).sort(), expectedIds.slice().sort());
assert.equal(skills.list().length, 20);

assert.deepEqual(units.get("baboon").scores, { str: 8, dex: 14, con: 11, int: 4, wis: 12, cha: 6 });
assert.deepEqual(units.get("badger").proficiencies.skills, { perception: "proficient" });
assert.deepEqual(units.get("cat").proficiencies, {
  savingThrows: { dex: "proficient" },
  skills: { perception: "proficient", stealth: "proficient" },
});
assert.deepEqual(units.get("goat").proficiencies, {
  savingThrows: { str: "proficient" },
  skills: { perception: "proficient" },
});
assert.equal(units.get("eagle").proficiencies.skills.perception, "expertise");
assert.equal(units.get("hawk").proficiencies.skills.perception, "expertise");

assert.deepEqual(units.get("hyena").scores, { str: 11, dex: 13, con: 12, int: 2, wis: 12, cha: 5 });
assert.deepEqual(units.get("hyena").proficiencies.skills, { perception: "proficient" });
assert.deepEqual(units.get("jackal").proficiencies.skills, { perception: "expertise", stealth: "proficient" });
assert.deepEqual(units.get("octopus").proficiencies.skills, { perception: "proficient", stealth: "expertise" });
assert.deepEqual(units.get("owl").proficiencies.skills, { perception: "expertise", stealth: "expertise" });
assert.deepEqual(units.get("rat").proficiencies.skills, { perception: "proficient" });
assert.deepEqual(units.get("raven").proficiencies.skills, { perception: "proficient" });

assert.equal(units.CAT_APPEARANCES.length, 10);
assert.equal(units.get("cat").summon.selectableAppearance, true);
assert.equal(units.get("cat").summonAppearanceOptions[0].id, "domestic_longhair");
assert.equal(units.get("cat").summonAppearanceOptions[9].id, "sphynx");

const bat = units.get("bat");
assert.equal(bat.flying, true);
assert.equal(bat.mechanics.flight.groundedQuickAction, "fly");
assert.deepEqual(bat.mechanics.flyingTargetability.canBeHitIfAny, [
  "lost_clash_against_skill",
  "attacker_weapon_is_ranged",
  "attacker_weapon_has_reach",
]);
assert.equal(bat.mechanics.blindsight.detectsInvisible, true);
assert.equal(bat.mechanics.blindsight.ignoresDarkness, true);

const lizard = units.get("lizard");
const spiderClimb = lizard.traits.find((trait) => trait.id === "spider_climb");
assert.equal(spiderClimb.activation.actionCost, "quick_action");
assert.equal(spiderClimb.mechanics.terrestrial, true);
assert.deepEqual(spiderClimb.mechanics.targetabilityWhileClimbing.canBeHitIfAny, [
  "lost_clash_against_skill",
  "attacker_weapon_is_ranged",
  "attacker_weapon_has_reach",
]);

const octopus = units.get("octopus");
assert.equal(octopus.mechanics.waterBreathing.underwater.gainsAirCounter, false);
assert.equal(octopus.mechanics.waterBreathing.outsideWater.gainsAirCounter, true);
const ink = octopus.traits.find((trait) => trait.id === "ink_spitting");
assert.equal(ink.mechanics.usableOutsideWater, true);
assert.equal(ink.mechanics.applyToAttacker.status, "blind");
assert.equal(ink.mechanics.afterSkill.action, "escape");

const owl = units.get("owl");
assert.equal(owl.flying, true);
assert.equal(owl.traits.find((trait) => trait.id === "flyby").mechanics.whileFlying.evasionPowerBonus, 8);

const raven = units.get("raven");
const mimicry = raven.traits.find((trait) => trait.id === "mimicry");
assert.equal(mimicry.activation.actionCost, "quick_action");
assert.deepEqual(mimicry.mechanics.save, { ability: "wis", threshold: 10 });
assert.equal(mimicry.mechanics.onFail.status, "clash_power_down");
assert.equal(mimicry.mechanics.onFail.potency, 1);

const badger = units.get("badger");
assert.equal(badger.mechanics.poisonResistance.statusDamageMultiplier, 0.5);
assert.equal(badger.mechanics.burrow.durationTurns, 1);
assert.equal(badger.mechanics.burrow.untargetable, true);

assert.equal(units.get("crab").traits[0].mechanics.underwaterEncounter.gainsAirCounter, false);
assert.equal(units.get("deer").traits[0].mechanics.skillsTriggerCounterAttacks, false);
assert.equal(units.get("cat").traits[0].mechanics.jumpCheckAbility, "dex");
assert.equal(units.get("cat").traits[0].mechanics.jumpCheckFinalPowerBonus, 3);

const expectedFinalPower = {
  baboon_bite: 11,
  badger_bite: 10,
  bat_bite: 10,
  cat_scratch: 10,
  crab_claw: 10,
  deer_ram: 11,
  eagle_talons: 11,
  frog_bite: 10,
  giant_fire_beetle_bite: 10,
  goat_ram: 10,
  hawk_talons: 10,
  hyena_bite: 11,
  jackal_bite: 10,
  lizard_bite: 10,
  octopus_tentacles: 10,
  owl_talons: 10,
  piranha_bite: 10,
  rat_bite: 10,
  raven_beak: 10,
  scorpion_sting: 10,
};
Object.entries(expectedFinalPower).forEach(([id, value]) => assert.equal(skills.finalPower(id), value, id));

assert.equal(skills.get("cat_scratch").coins[0].effects[0].status, "bleed");
assert.equal(skills.get("crab_claw").coins[0].effects[0].status, "tremor");
assert.equal(skills.get("deer_ram").coins[0].effects[0].status, "tremor");
assert.equal(skills.get("giant_fire_beetle_bite").coins[0].effects[0].status, "burn");
assert.equal(skills.get("goat_ram").metadata.conditionalClashPower.bonus, 1);
assert.equal(skills.get("bat_bite").metadata.healOnBleedingTarget, 2);
assert.equal(skills.get("piranha_bite").metadata.conditionalFlatDamage.bonus, 10);
assert.equal(skills.get("piranha_bite").metadata.conditionalClashPower.bonus, 1);
assert.equal(skills.get("scorpion_sting").coins[0].effects[0].status, "poison");

assert.deepEqual(units.get("hyena").speedRange, [1, 10]);
assert.deepEqual(units.get("jackal").speedRange, [1, 10]);
assert.deepEqual(units.get("lizard").speedRange, [1, 6]);
assert.deepEqual(units.get("octopus").speedRange, [1, 8]);
assert.deepEqual(units.get("owl").speedRange, [1, 14]);
assert.deepEqual(units.get("piranha").speedRange, [1, 10]);
assert.deepEqual(units.get("rat").speedRange, [1, 6]);
assert.deepEqual(units.get("raven").speedRange, [1, 12]);
assert.deepEqual(units.get("scorpion").speedRange, [1, 4]);

for (const unit of units.list()) {
  assert.ok(unit.speedRange[0] >= 1, `${unit.id} Min Speed must never be below 1`);
  assert.ok(unit.speedRange[1] >= 2, `${unit.id} Max Speed must never be below 2`);
}

const eagle65 = units.resolve("eagle", { level: 65 });
assert.equal(eagle65.proficiencyBonus, 4);
assert.equal(prof.skillBonus(eagle65, "perception"), 10);
assert.equal(eagle65.maxHp, 9);
assert.equal(eagle65.speedProfileMode, "fly");

const groundedOwl = units.resolve("owl", { level: 1, flying: false });
assert.deepEqual(groundedOwl.speedRange, [1, 4]);
assert.equal(groundedOwl.speedProfileMode, "ground");

const underwaterOctopus = units.resolve("octopus", { level: 1, encounterTags: ["underwater"] });
assert.deepEqual(underwaterOctopus.speedRange, [1, 8]);
assert.equal(underwaterOctopus.speedProfileMode, "swim");

const dryOctopus = units.resolve("octopus", { level: 1, encounterTags: ["land"] });
assert.deepEqual(dryOctopus.speedRange, [1, 4]);
assert.equal(dryOctopus.speedProfileMode, "ground");

console.log("CR0 beast catalog smoke: ok");
