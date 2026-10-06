import assert from "node:assert/strict";

globalThis.window = globalThis;

await import("../js/item-economy-standard.js");
await import("../js/creature-type-catalog.js");
await import("../js/loot-social-profile-contract.js");
await import("../js/item-harvest-integrity-engine.js");
await import("../js/unit-loot-profile-contract.js");
await import("../js/unit-catalog-kobold-tier1.js");
await import("../js/unit-catalog-goblin.js");
await import("../js/unit-catalog-wolf.js");

const economy = globalThis.LuminousItemEconomyStandard;
const social = globalThis.LuminousLootSocialProfileContract;
const kobolds = globalThis.LuminousKoboldUnitCatalog;
const goblins = globalThis.LuminousGoblinUnitCatalog;
const wolves = globalThis.LuminousWolfUnitCatalog;

assert.ok(economy);
assert.ok(social);

const economyBands = economy.SALARY_BANDS.map((band) => band.id);
assert.deepEqual(social.canonicalSalaryBandIds(), economyBands, "Loot wealth bands must reuse the canonical AHN salary bands verbatim");
assert.equal(Object.keys(social.WEALTH_BIASES).length, economyBands.length);
for (const bandId of economyBands) {
  assert.ok(social.WEALTH_BIASES[bandId], `missing wealth bias for ${bandId}`);
  assert.equal(social.validateWealthProfile({ bandId }).valid, true);
}

assert.equal(social.validateWealthProfile({ bandId: "made_up_rich" }).valid, false);
assert.equal(
  social.validateWealthProfile({ bandId: "city_elite", carriedCash: 25000000 }).errors.includes("WEALTH_PROFILE_MUST_NOT_STORE_CARRIED_CASH"),
  true,
  "wealth profile must never double as pocket cash",
);

const requiredRoles = [
  "civilian", "worker", "miner", "cook", "merchant", "doctor", "medic",
  "soldier", "security", "fixer", "executive", "researcher", "hunter",
  "scavenger", "cultist", "smuggler",
];
for (const roleId of requiredRoles) {
  assert.ok(social.roleProfile(roleId), `${roleId} role profile must exist`);
  assert.equal(social.validateRoleProfile({ roles: [roleId] }).valid, true);
}

const customRole = social.normalizeRoleProfile({
  roles: ["wing_salvager"],
  customRoles: {
    wing_salvager: {
      carriedCategoryWeights: { material: 1.8, technology: 1.2 },
      guaranteedEquipmentTags: ["special_salvage_hook"],
    },
  },
});
assert.equal(social.validateRoleProfile(customRole).valid, true);
const customMerged = social.mergeRoleModifiers(customRole.roles, customRole.customRoles);
assert.equal(customMerged.carriedCategoryWeights.material, 1.8);
assert.ok(customMerged.guaranteedEquipmentTags.includes("special_salvage_hook"));

const poorScavenger = social.resolveSocialLootModifiers({
  species: "goblin",
  wealthProfile: { bandId: "backstreets_extreme_poverty" },
  roleProfile: { roles: ["scavenger"] },
});
assert.equal(poorScavenger.valid, true);
assert.equal(poorScavenger.carriedCash, null);
assert.equal(poorScavenger.carriedCashGeneratedSeparately, true);
assert.equal(poorScavenger.valuableLowCashAllowed, true);
assert.ok(poorScavenger.carriedCategoryWeights.material > 1);
assert.ok(poorScavenger.carriedCategoryWeights.currency < 1);

const eliteExecutive = social.resolveSocialLootModifiers({
  species: "goblin",
  wealthProfile: { bandId: "city_elite" },
  roleProfile: { roles: ["executive"] },
});
assert.equal(eliteExecutive.valid, true);
assert.equal(eliteExecutive.carriedCash, null, "even City elite wealth must not become total pocket cash");
assert.ok(eliteExecutive.itemValueMultiplier > poorScavenger.itemValueMultiplier);
assert.ok(eliteExecutive.qualityBias > poorScavenger.qualityBias);
assert.ok(eliteExecutive.carriedCategoryWeights.luxury > poorScavenger.carriedCategoryWeights.luxury);
assert.ok(eliteExecutive.carriedCategoryWeights.technology > poorScavenger.carriedCategoryWeights.technology);

const soldier = social.resolveSocialLootModifiers({
  species: "goblin",
  wealthProfile: { bandId: "backstreets_low" },
  roleProfile: { roles: ["soldier"] },
});
assert.ok(soldier.guaranteedEquipmentTags.includes("weapon_loadout"));
assert.ok(soldier.carriedCategoryWeights.ammunition > 1);

const medic = social.resolveSocialLootModifiers({
  species: "goblin",
  wealthProfile: { bandId: "backstreets_low" },
  roleProfile: { roles: ["medic"] },
});
assert.ok(medic.guaranteedEquipmentTags.includes("medical_kit"));
assert.ok(medic.carriedCategoryWeights.medicine > soldier.carriedCategoryWeights.medicine);

const canonicalUnits = [...kobolds.list(), ...goblins.list(), ...wolves.list()];
const humanoids = canonicalUnits.filter((unit) => social.isHumanoidEligible(unit));
const beasts = canonicalUnits.filter((unit) => !social.isHumanoidEligible(unit));
assert.equal(humanoids.length, 7);
assert.equal(beasts.length, 2);

for (const unit of humanoids) {
  assert.ok(unit.wealthProfile, `${unit.id} must have wealthProfile`);
  assert.ok(unit.roleProfile, `${unit.id} must have roleProfile`);
  assert.ok(Number(unit.schemaVersion) >= 4, `${unit.id} must migrate to social loot schema`);
  const validation = social.validateUnitSocialProfile(unit);
  assert.equal(validation.valid, true, `${unit.id}: ${validation.errors.join(", ")}`);
  assert.equal(unit.wealthProfile.carriedCashSeparate, true);
  const resolved = social.resolveSocialLootModifiers(unit);
  assert.equal(resolved.valid, true);
  assert.equal(resolved.carriedCash, null);
}

for (const unit of beasts) {
  assert.equal(unit.wealthProfile, undefined);
  assert.equal(unit.roleProfile, undefined);
  const validation = social.validateUnitSocialProfile(unit);
  assert.equal(validation.valid, true, `${unit.id} beast should not require economic social profile`);
  assert.equal(validation.eligibleForWealth, false);
}

assert.equal(kobolds.get("kobold_dagger").wealthProfile.bandId, "backstreets_very_poor");
assert.deepEqual(kobolds.get("kobold_dagger").roleProfile.roles, ["soldier"]);
assert.deepEqual(kobolds.get("kobold_sling").roleProfile.roles, ["hunter"]);
assert.equal(kobolds.get("dragonheart_kobold").wealthProfile.bandId, "backstreets_low");
assert.deepEqual(kobolds.get("dragonheart_kobold").roleProfile.roles, ["soldier", "commander"]);
assert.equal(goblins.get("goblin").wealthProfile.bandId, "backstreets_very_poor");
assert.equal(goblins.get("goblin_boss").wealthProfile.bandId, "backstreets_low");
assert.deepEqual(goblins.get("goblin_boss").roleProfile.roles, ["soldier", "commander"]);

console.log("Loot Wealth + Role profile smoke passed.");
