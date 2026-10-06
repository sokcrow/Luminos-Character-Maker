"use strict";

const assert = require("node:assert/strict");
const harvest = require("../js/item-harvest-integrity-engine.js");
const contract = require("../js/unit-loot-profile-contract.js");
const kobolds = require("../js/unit-catalog-kobold-tier1.js");
const goblins = require("../js/unit-catalog-goblin.js");
const wolves = require("../js/unit-catalog-wolf.js");

assert.equal(contract.VERSION, 1);
assert.ok(contract.BODY_KINDS.includes("organic"));
assert.ok(contract.BODY_KINDS.includes("construct"));
assert.ok(contract.BODY_KINDS.includes("mineral"));
assert.ok(contract.BODY_KINDS.includes("mixed"));
assert.ok(contract.BODY_MATERIALS.includes("metal"));
assert.ok(contract.BODY_MATERIALS.includes("stone"));
assert.ok(contract.BODY_MATERIALS.includes("flesh"));
assert.ok(contract.RARITIES.includes("impossible"));
assert.ok(contract.RARITIES.includes("guaranteed"));

const metalBody = contract.createProfiles({
  bodyProfile: {
    kind: "construct",
    materials: ["metal", "mechanical"],
    resources: [
      { id: "plates", integrityFamily: "hard_cover_modular", sourceMaterial: "metal" },
      { id: "frame", integrityFamily: "hard_cover_structural", sourceMaterial: "mechanical" },
    ],
  },
  lootProfile: {
    carried: [],
    equipment: { source: "authored" },
    currency: null,
    harvest: { source: "body_profile" },
    impossibleCategories: [],
  },
}, { harvestEngine: harvest });

assert.equal(metalBody.bodyProfile.kind, "construct");
assert.equal(metalBody.bodyProfile.resources.length, 2);

const stoneBody = contract.createProfiles({
  bodyProfile: {
    kind: "mineral",
    materials: ["stone", "mineral"],
    resources: [
      { id: "stone_mass", integrityFamily: "hard_cover_structural", sourceMaterial: "stone" },
      { id: "mineral_chunks", integrityFamily: "hard_parts", sourceMaterial: "mineral" },
    ],
  },
  lootProfile: {
    carried: [],
    equipment: { source: "none" },
    harvest: { source: "body_profile" },
  },
}, { harvestEngine: harvest });
assert.equal(stoneBody.bodyProfile.kind, "mineral");

const mixedBody = contract.createProfiles({
  bodyProfile: {
    kind: "mixed",
    materials: ["flesh", "blood", "metal"],
    resources: [
      { id: "meat", integrityFamily: "meat", sourceMaterial: "flesh" },
      { id: "blood", integrityFamily: "blood_ichor", sourceMaterial: "blood" },
      { id: "metal_frame", integrityFamily: "hard_cover_structural", sourceMaterial: "metal" },
    ],
  },
  lootProfile: {
    carried: [],
    equipment: { source: "unit_loadout" },
    harvest: { source: "body_profile" },
  },
}, { harvestEngine: harvest });
assert.equal(mixedBody.bodyProfile.resources.length, 3);

const impossibleMeat = contract.validateBodyProfile({
  kind: "construct",
  materials: ["metal"],
  resources: [
    { id: "meat", integrityFamily: "meat", sourceMaterial: "metal" },
  ],
}, { harvestEngine: harvest });
assert.equal(impossibleMeat.valid, false);
assert.ok(impossibleMeat.errors.some((error) => error.startsWith("BODY_RESOURCE_MATERIAL_INCOMPATIBLE:meat")));
assert.ok(impossibleMeat.errors.some((error) => error === "BODY_RESOURCE_KIND_INCOMPATIBLE:construct:meat"));

const impossibleLoot = contract.validateLootProfile({
  carried: [{ category: "technology", rarity: "rare" }],
  impossibleCategories: ["technology"],
  equipment: { source: "none" },
  harvest: { source: "body_profile" },
});
assert.equal(impossibleLoot.valid, false);
assert.ok(impossibleLoot.errors.includes("IMPOSSIBLE_CATEGORY_HAS_NONZERO_ENTRY:technology"));

const currencyProfile = contract.normalizeLootProfile({
  currency: { currencyId: "AHN", min: 0, max: 500, zeroAllowed: true },
});
assert.deepEqual(currencyProfile.currency, {
  currencyId: "ahn",
  min: 0,
  max: 500,
  zeroAllowed: true,
});

const canonicalUnits = [
  ...kobolds.list(),
  ...goblins.list(),
  ...wolves.list(),
];

assert.equal(canonicalUnits.length, 9);

for (const unit of canonicalUnits) {
  assert.ok(unit.bodyProfile, `${unit.id} must expose bodyProfile`);
  assert.ok(unit.lootProfile, `${unit.id} must expose lootProfile`);
  assert.ok(Number(unit.schemaVersion) >= 3, `${unit.id} must bump schemaVersion for canonical loot-profile migration`);
  const validation = contract.validateUnit(unit, { harvestEngine: harvest });
  assert.equal(validation.valid, true, `${unit.id}: ${validation.errors.join(", ")}`);
  assert.equal(unit.lootProfile.harvest.source, "body_profile");
}

for (const unit of kobolds.list()) {
  assert.equal(unit.bodyProfile.kind, "organic");
  assert.ok(unit.bodyProfile.materials.includes("scale"));
  assert.equal(unit.bodyProfile.edible, true);
  assert.equal(unit.lootProfile.equipment.source, "unit_loadout");
}

for (const unit of goblins.list()) {
  assert.equal(unit.bodyProfile.kind, "organic");
  assert.ok(unit.bodyProfile.materials.includes("flesh"));
  assert.equal(unit.lootProfile.equipment.source, "unit_loadout");
}

for (const unit of wolves.list()) {
  assert.equal(unit.bodyProfile.kind, "organic");
  assert.ok(unit.bodyProfile.materials.includes("pelt"));
  assert.equal(unit.bodyProfile.edible, true);
  assert.equal(unit.lootProfile.equipment.source, "none");
}

assert.equal(
  kobolds.get("kobold_dagger").bodyProfile.resources.find((resource) => resource.id === "meat").integrityFamily,
  "meat",
);
assert.equal(
  wolves.get("wolf").bodyProfile.resources.find((resource) => resource.id === "pelt").integrityFamily,
  "hide_pelt",
);

console.log("unit-loot-profile-contract smoke: OK");
