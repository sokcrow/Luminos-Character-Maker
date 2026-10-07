import assert from "node:assert/strict";

await import("../js/movement-speed-runtime.js");
await import("../js/unit-rank-runtime.js");
await import("../js/universal-ranged-ammo-runtime.js");
await import("../js/unit-combat-mechanics-runtime.js");
await import("../js/skill-catalog-kobold-tier1.js");
await import("../js/goblin-unit-runtime.js");
await import("../js/skill-catalog-goblin-tier1.js");
await import("../js/wolf-unit-runtime.js");
await import("../js/skill-catalog-wolf.js");
await import("../js/unit-catalog-kobold-tier1.js");
await import("../js/unit-catalog-goblin.js");
await import("../js/unit-catalog-wolf.js");

const kobolds = globalThis.LuminousKoboldUnitCatalog;
const goblins = globalThis.LuminousGoblinUnitCatalog;
const wolves = globalThis.LuminousWolfUnitCatalog;

assert.ok(kobolds && goblins && wolves, "native enemy catalogs must initialize");

const expected = {
  kobold_dagger: {
    scores: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
    proficiencies: { savingThrows: {}, skills: {} },
    size: "small", movement: { ground: 30 }, speed: [1, 8], source: "Kobold Warrior",
  },
  kobold_sling: {
    scores: { str: 7, dex: 15, con: 9, int: 8, wis: 7, cha: 8 },
    proficiencies: { savingThrows: {}, skills: {} },
    size: "small", movement: { ground: 30 }, speed: [1, 8], source: "Kobold Warrior",
  },
  winged_kobold: {
    scores: { str: 7, dex: 16, con: 9, int: 8, wis: 7, cha: 8 },
    proficiencies: { savingThrows: {}, skills: {} },
    size: "small", movement: { ground: 30, fly: 30 }, speed: [1, 8], source: "Winged Kobold",
  },
  dragonheart_kobold: {
    scores: { str: 12, dex: 15, con: 14, int: 8, wis: 9, cha: 10 },
    proficiencies: { savingThrows: {}, skills: { perception: "proficient" } },
    size: "small", movement: { ground: 20 }, speed: [1, 7], source: "Kobold Dragonshield",
  },
  scale_sorcerer_kobold: {
    scores: { str: 7, dex: 15, con: 14, int: 10, wis: 9, cha: 14 },
    proficiencies: { savingThrows: {}, skills: { arcana: "proficient", medicine: "proficient" } },
    size: "small", movement: { ground: 30 }, speed: [1, 9], source: "Kobold Scale Sorcerer",
  },
  goblin: {
    scores: { str: 8, dex: 15, con: 10, int: 10, wis: 8, cha: 8 },
    proficiencies: { savingThrows: {}, skills: { stealth: "expertise" } },
    size: "small", movement: { ground: 30 }, speed: [1, 8], source: "Goblin Warrior",
  },
  goblin_boss: {
    scores: { str: 10, dex: 15, con: 10, int: 10, wis: 8, cha: 10 },
    proficiencies: { savingThrows: {}, skills: { stealth: "expertise" } },
    size: "small", movement: { ground: 30 }, speed: [1, 9], source: "Goblin Boss",
  },
  wolf: {
    scores: { str: 14, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    proficiencies: { savingThrows: {}, skills: { perception: "expertise", stealth: "proficient" } },
    size: "medium", movement: { ground: 40 }, speed: [1, 8], source: "Wolf",
  },
  dire_wolf: {
    scores: { str: 17, dex: 15, con: 15, int: 3, wis: 12, cha: 7 },
    proficiencies: { savingThrows: {}, skills: { perception: "expertise", stealth: "proficient" } },
    size: "large", movement: { ground: 50 }, speed: [1, 9], source: "Dire Wolf",
  },
};

function catalogFor(id) {
  if (id.includes("kobold")) return kobolds;
  if (id.includes("goblin")) return goblins;
  return wolves;
}

for (const [id, profile] of Object.entries(expected)) {
  const catalog = catalogFor(id);
  const unit = catalog.get(id);
  assert.ok(unit, `${id} must exist`);
  assert.deepEqual(unit.scores, profile.scores, `${id} canonical scores`);
  assert.deepEqual(unit.proficiencies, profile.proficiencies, `${id} canonical proficiencies`);
  assert.equal(unit.size, profile.size, `${id} canonical size`);
  assert.deepEqual(unit.movementFeet, profile.movement, `${id} canonical movement`);
  assert.equal(unit.metadata.speedPending, false, `${id} Speed must not be pending`);
  assert.equal(unit.metadata.canonicalSourceName, profile.source, `${id} source mapping`);

  const resolved = catalog.resolve(id, { level: unit.naturalWorldLevel.min });
  assert.deepEqual(resolved.speedRange, profile.speed, `${id} resolved Speed`);
  assert.ok(resolved.speedRange[0] >= 1, `${id} Min Speed floor`);
  assert.ok(resolved.speedRange[1] >= 2, `${id} Max Speed floor`);
}

assert.deepEqual(kobolds.resolve("kobold_dagger", { level: 1, rank: "captain" }).speedRange, [1, 9]);
assert.deepEqual(kobolds.resolve("kobold_dagger", { level: 1, rank: "leader" }).speedRange, [2, 10]);
assert.deepEqual(goblins.resolve("goblin", { level: 2, rank: "captain" }).speedRange, [1, 9]);
assert.deepEqual(goblins.resolve("goblin", { level: 2, rank: "leader" }).speedRange, [2, 10]);
assert.deepEqual(wolves.resolve("wolf", { level: 2, rank: "captain" }).speedRange, [1, 9]);
assert.deepEqual(wolves.resolve("dire_wolf", { level: 5, rank: "leader" }).speedRange, [2, 11]);

console.log("native enemy physical profiles smoke: ok");
