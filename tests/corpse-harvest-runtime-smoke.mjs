import assert from "node:assert/strict";

globalThis.window = globalThis;

await import("../js/item-harvest-integrity-engine.js");
await import("../js/unit-loot-profile-contract.js");
await import("../js/unit-catalog-kobold-tier1.js");
await import("../js/unit-catalog-goblin.js");
await import("../js/unit-catalog-wolf.js");
await import("../js/corpse-harvest-runtime.js");

const harvest = globalThis.LuminousItemHarvestIntegrityEngine;
const corpse = globalThis.LuminousCorpseHarvestRuntime;
const kobolds = globalThis.LuminousKoboldUnitCatalog;
const goblins = globalThis.LuminousGoblinUnitCatalog;
const wolves = globalThis.LuminousWolfUnitCatalog;

assert.ok(harvest);
assert.ok(corpse);

const kobold = kobolds.get("kobold_dagger");
const goblin = goblins.get("goblin");
const wolf = wolves.get("wolf");
const dire = wolves.get("dire_wolf");

assert.equal(kobold.bodyProfile.sizeClass, "small");
assert.equal(goblin.bodyProfile.sizeClass, "small");
assert.equal(wolf.bodyProfile.sizeClass, "medium");
assert.equal(dire.bodyProfile.sizeClass, "large");

const cleanWolf = corpse.resolveCorpseHarvest(wolf, harvest.createDamageRecord());
const wolfMeat = cleanWolf.resources.find((entry) => entry.id === "meat");
const wolfPelt = cleanWolf.resources.find((entry) => entry.id === "pelt");
assert.deepEqual({ min: wolfMeat.baseYield.min, max: wolfMeat.baseYield.max }, { min: 2, max: 4 });
assert.equal(wolfMeat.integrity.status, "intact");
assert.deepEqual({ min: wolfMeat.recoverableYield.min, max: wolfMeat.recoverableYield.max }, { min: 2, max: 4 });
assert.equal(wolfPelt.integrity.status, "intact");

const cleanDire = corpse.resolveCorpseHarvest(dire, harvest.createDamageRecord());
const direMeat = cleanDire.resources.find((entry) => entry.id === "meat");
assert.deepEqual({ min: direMeat.baseYield.min, max: direMeat.baseYield.max }, { min: 4, max: 8 }, "large body must scale harvest capacity");

const cleanKobold = corpse.resolveCorpseHarvest(kobold, harvest.createDamageRecord());
const koboldMeat = cleanKobold.resources.find((entry) => entry.id === "meat");
assert.deepEqual({ min: koboldMeat.baseYield.min, max: koboldMeat.baseYield.max }, { min: 1, max: 3 }, "small body must scale harvest capacity");

const slashed = harvest.createDamageRecord();
harvest.recordEvent(slashed, { sourceType: "weapon", physical: true, damageType: "slashing", damage: 3 });
const damagedWolf = corpse.resolveCorpseHarvest(wolf, slashed);
const damagedMeat = damagedWolf.resources.find((entry) => entry.id === "meat");
const damagedPelt = damagedWolf.resources.find((entry) => entry.id === "pelt");
assert.equal(damagedMeat.integrity.status, "damaged");
assert.equal(damagedPelt.integrity.status, "damaged");
assert.ok(damagedMeat.integrity.integrityPercent < 100);
assert.ok(damagedMeat.recoverableYield.max < wolfMeat.recoverableYield.max, "combat damage must reduce recoverable meat yield");
assert.ok(damagedPelt.recoverableYield.qualityMultiplier < 1, "combat damage must reduce harvest quality");

const poisoned = harvest.createDamageRecord();
harvest.recordStatusExposure(poisoned, "poison", 2);
const contaminatedWolf = corpse.resolveCorpseHarvest(wolf, poisoned);
const contaminatedBlood = contaminatedWolf.resources.find((entry) => entry.id === "blood");
assert.equal(contaminatedBlood.integrity.status, "contaminated");
assert.equal(contaminatedBlood.integrity.contaminated, true);
assert.ok(contaminatedBlood.recoverableYield.qualityMultiplier < contaminatedBlood.recoverableYield.quantityMultiplier);

const crushed = harvest.createDamageRecord();
harvest.recordEvent(crushed, { sourceType: "weapon", physical: true, damageType: "bludgeoning", damage: 100 });
const destroyedKobold = corpse.resolveCorpseHarvest(kobold, crushed);
const bones = destroyedKobold.resources.find((entry) => entry.id === "bones");
assert.equal(bones.integrity.status, "destroyed");
assert.deepEqual({ min: bones.recoverableYield.min, max: bones.recoverableYield.max }, { min: 0, max: 0 });

const explicit = corpse.baseYieldRange({
  bodyProfile: { sizeClass: "gargantuan" },
}, {
  integrityFamily: "meat",
  yield: { min: 7, max: 9 },
});
assert.deepEqual({ min: explicit.min, max: explicit.max, source: explicit.source }, { min: 7, max: 9, source: "profile_override" }, "authored species/profile yield overrides size defaults");

console.log("Corpse harvest yield + integrity smoke passed.");
