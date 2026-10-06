import assert from "node:assert/strict";

globalThis.window = globalThis;

await import("../js/item-inventory-runtime.js");
await import("../js/item-economy-standard.js");
await import("../js/creature-type-catalog.js");
await import("../js/item-harvest-integrity-engine.js");
await import("../js/unit-loot-profile-contract.js");
await import("../js/loot-social-profile-contract.js");
await import("../js/loot-encounter-context.js");
await import("../js/corpse-harvest-runtime.js");

globalThis.LuminousUniversalRangedAmmoRuntime = {
  AMMO: { arrows: { id: "arrows" } },
  ammoCount(unit, ammoId) {
    return Number(unit?.liveAmmo?.[ammoId] ?? 0);
  },
};

await import("../js/loot-ammo-reconciliation.js");
await import("../js/loot-instance-runtime.js");

const inventory = globalThis.LuminousItemInventoryRuntime;
const lootContract = globalThis.LuminousUnitLootProfileContract;
const social = globalThis.LuminousLootSocialProfileContract;
const harvest = globalThis.LuminousItemHarvestIntegrityEngine;
const runtime = globalThis.LuminousLootInstanceRuntime;

assert.ok(inventory);
assert.ok(lootContract);
assert.ok(social);
assert.ok(harvest);
assert.ok(runtime);

const catalog = {
  ration: { id: "ration", name: "Ration", category: "food", stackable: true },
  medkit: { id: "medkit", name: "Medkit", category: "medicine", stackable: true },
  scrap_bundle: { id: "scrap_bundle", name: "Scrap Bundle", category: "material", stackable: true },
  luxury_case: { id: "luxury_case", name: "Luxury Case", category: "luxury", stackable: false },
  medical_crate: { id: "medical_crate", name: "Medical Crate", category: "medicine", stackable: false },
  ammo_arrows: { id: "ammo_arrows", name: "Arrows", category: "ammunition", stackable: true },
  iron_sword: { id: "iron_sword", name: "Iron Sword", category: "weapon", itemType: "weapon" },
};

const profiles = lootContract.createProfiles({
  bodyProfile: {
    kind: "organic",
    sizeClass: "medium",
    materials: ["flesh", "blood", "bone"],
    resources: [
      { id: "meat", integrityFamily: "meat", sourceMaterial: "flesh" },
      { id: "bones", integrityFamily: "hard_parts", sourceMaterial: "bone" },
      { id: "blood", integrityFamily: "blood_ichor", sourceMaterial: "blood" },
    ],
  },
  lootProfile: {
    carried: [
      { itemId: "ration", category: "food", rarity: "guaranteed", quantity: 2 },
      { itemId: "medkit", category: "medicine", chance: 1, min: 1, max: 2 },
      { itemId: "ammo_arrows", category: "ammunition", rarity: "guaranteed", quantity: 10, ammoId: "arrows", reconcilePostCombatAmmo: true },
    ],
    equipment: { source: "unit_loadout" },
    currency: { currencyId: "ahn", min: 100, max: 200, zeroAllowed: true },
    harvest: { source: "body_profile" },
    impossibleCategories: ["luxury"],
  },
}, { harvestEngine: harvest });

assert.equal(profiles.lootProfile.carried[0].itemId, "ration");
assert.equal(profiles.lootProfile.carried[1].chance, 1);
assert.equal(profiles.lootProfile.carried[1].max, 2);
assert.equal(profiles.lootProfile.carried[3].ammoId, "arrows");
assert.equal(profiles.lootProfile.carried[3].reconcilePostCombatAmmo, true);

const unit = {
  id: "test_scavenger",
  combatId: "enemy:test_scavenger:001",
  species: "goblin",
  metadata: { creatureType: "humanoid" },
  maxHp: 20,
  bodyProfile: profiles.bodyProfile,
  lootProfile: profiles.lootProfile,
  wealthProfile: social.normalizeWealthProfile({ bandId: "backstreets_very_poor", source: "test" }),
  roleProfile: social.normalizeRoleProfile({ roles: ["scavenger"], source: "test" }),
  mechanics: {
    weaponLoadout: [
      { weaponId: "iron_sword", range: "melee", skillId: "slash" },
    ],
  },
  liveAmmo: { arrows: 4 },
};

const damageRecord = harvest.createDamageRecord();
harvest.recordEvent(damageRecord, {
  sourceType: "weapon",
  physical: true,
  damageType: "slashing",
  damage: 3,
});

const liveSword = inventory.createItemInstance(catalog.iron_sword, {
  catalog,
  instanceId: "equipment_live_sword_001",
  quantity: 1,
  condition: 72,
  qualityTier: 2,
  equipped: true,
  currentOwnerId: unit.combatId,
});

const options = {
  encounterId: "encounter_alpha",
  unitInstanceId: unit.combatId,
  corpseId: "corpse_alpha_001",
  zone: {
    id: "poor_forest",
    profileId: "forest",
    impossibleCategories: ["gems"],
  },
  events: [
    {
      id: "medical_shipment_01",
      eventType: "medical_shipment",
      guaranteedItems: [
        { itemId: "medical_crate", quantity: 1, tags: ["sealed"] },
      ],
    },
  ],
  equipmentInstances: [liveSword],
  carriedCandidates: [
    { itemId: "luxury_case", category: "luxury", chance: 1, quantity: 1 },
  ],
  damageRecord,
  catalog,
  now: 1000,
};

const first = runtime.generateLootInstance(unit, options);
const second = runtime.generateLootInstance(unit, options);

assert.deepEqual(second, first, "same encounter + unit instance + sources must produce byte-equivalent deterministic loot");
assert.equal(runtime.validateLootInstance(first).valid, true);
assert.equal(first.locked, false);
assert.equal(first.generation, 0);
assert.equal(first.encounterId, "encounter_alpha");
assert.equal(first.sourceUnitId, "test_scavenger");
assert.equal(first.sourceUnitInstanceId, unit.combatId);
assert.equal(first.corpseId, "corpse_alpha_001");

const carriedIds = first.carried.map((item) => item.definitionId);
assert.ok(carriedIds.includes("ration"));
assert.ok(carriedIds.includes("medkit"));
assert.ok(carriedIds.includes("medical_crate"), "Event guaranteed Item must enter the frozen carried inventory");
assert.ok(carriedIds.includes("ammo_arrows"));
assert.ok(!carriedIds.includes("luxury_case"), "unit-level impossible category must stay impossible despite a perfect candidate chance");

for (const item of first.carried) {
  assert.equal(item.schemaVersion, inventory.schemaVersion);
  assert.ok(item.instanceId.startsWith("lootitem_"));
  assert.equal(item.provenance.sourceUnitId, "test_scavenger");
  assert.equal(item.provenance.sourceUnitInstanceId, unit.combatId);
  assert.equal(item.provenance.corpseId, "corpse_alpha_001");
  assert.equal(item.provenance.encounterId, "encounter_alpha");
  assert.equal(item.provenance.zoneId, "poor_forest");
}

const eventItem = first.carried.find((item) => item.definitionId === "medical_crate");
assert.equal(eventItem.provenance.sourceEventId, "medical_shipment_01");
assert.equal(eventItem.lootSource, "event_guaranteed");

assert.equal(first.equipment.items.length, 1);
assert.equal(first.equipment.items[0].instanceId, "equipment_live_sword_001");
assert.equal(first.equipment.items[0].condition, 72);
assert.equal(first.equipment.items[0].lootEquipmentSnapshot, true);
assert.ok(!first.carried.some((item) => item.instanceId === "equipment_live_sword_001"), "actual equipment must not be mixed into hidden carried loot");

assert.equal(first.currency.currencyId, "ahn");
assert.ok(first.currency.amount >= first.currency.resolvedRange.min);
assert.ok(first.currency.amount <= first.currency.resolvedRange.max);
assert.equal(second.currency.amount, first.currency.amount, "currency must be generated once deterministically for the source identity");
assert.equal(first.currency.provenance.encounterId, "encounter_alpha");

assert.equal(first.harvest.generated, true);
assert.equal(first.harvest.corpseId, "corpse_alpha_001");
assert.equal(first.harvest.resources.length, 3);
for (const resource of first.harvest.resources) {
  assert.equal(resource.capacity, resource.remaining);
  assert.ok(resource.capacity >= 0);
  assert.equal(resource.provenance.corpseId, "corpse_alpha_001");
}
assert.deepEqual(second.harvest, first.harvest, "corpse harvest capacity must not reroll on another read");

const ensured = runtime.ensureLootInstance(first, unit, options);
assert.deepEqual(ensured, first, "ensure must reuse an existing instance instead of regenerating it");

const regenerated = runtime.regenerateLootInstance(first, unit, {
  ...options,
  now: 1100,
});
assert.equal(regenerated.generation, 1);
assert.notEqual(regenerated.lootInstanceId, first.lootInstanceId);
assert.notEqual(regenerated.seedHash, first.seedHash);
assert.notDeepEqual(
  regenerated.carried.map((item) => item.instanceId),
  first.carried.map((item) => item.instanceId),
  "explicit pre-lock regeneration must produce a new generation of Item instance IDs",
);

const locked = runtime.lockLootInstance(first, {
  unit,
  now: 1200,
  reason: "post_combat_finalized",
});
assert.equal(locked.locked, true);
assert.equal(locked.lockedAt, 1200);
assert.equal(locked.lockReason, "post_combat_finalized");

const lockedAmmo = locked.carried.find((item) => item.definitionId === "ammo_arrows");
assert.equal(lockedAmmo.quantity, 4, "lock must reconcile ammunition to the authoritative remaining combat count instead of initial 10");
assert.equal(lockedAmmo.lootReconciliation.generatedQuantity, 10);
assert.equal(lockedAmmo.lootReconciliation.regenerated, false);

assert.throws(
  () => runtime.regenerateLootInstance(locked, unit, options),
  /LOCKED_LOOT_INSTANCE_CANNOT_REGENERATE/,
);

const lockedAgain = runtime.lockLootInstance(locked, { unit, now: 9999 });
assert.deepEqual(lockedAgain, locked, "locking is idempotent and must not rewrite an already locked instance");

const overridden = runtime.generateLootInstance(unit, {
  ...options,
  corpseId: "corpse_alpha_002",
  unitInstanceId: "enemy:test_scavenger:002",
  equipmentInstances: [],
  dmOverrides: {
    reason: "enemy_robbed_a_lab",
    removeItemIds: ["ration"],
    allowCategories: ["luxury"],
    guaranteedItems: [
      { itemId: "luxury_case", category: "luxury", quantity: 1 },
    ],
    currency: { currencyId: "ahn", amount: 777 },
    addEquipment: [
      { weaponId: "iron_sword", range: "melee", skillId: "slash" },
    ],
    harvest: {
      setQuantity: { meat: 1 },
    },
  },
});
assert.ok(!overridden.carried.some((item) => item.definitionId === "ration"));
assert.ok(overridden.carried.some((item) => item.definitionId === "luxury_case"));
assert.equal(overridden.currency.amount, 777);
assert.equal(overridden.currency.source, "dm_override");
assert.equal(overridden.equipment.items.length, 1);
assert.equal(overridden.equipment.items[0].weaponId, "iron_sword");
assert.equal(overridden.harvest.resources.find((resource) => resource.id === "meat").capacity, 1);
assert.equal(overridden.dmOverrides.reason, "enemy_robbed_a_lab");

const otherInstance = runtime.generateLootInstance(unit, {
  ...options,
  unitInstanceId: "enemy:test_scavenger:other",
  corpseId: "corpse_other",
});
assert.notEqual(otherInstance.lootInstanceId, first.lootInstanceId);
assert.notEqual(otherInstance.seedHash, first.seedHash);

assert.throws(
  () => runtime.ensureLootInstance(first, unit, {
    ...options,
    unitInstanceId: "enemy:wrong:999",
  }),
  /LOOT_INSTANCE_IDENTITY_MISMATCH/,
);

console.log("Deterministic Loot Instance generation + lock lifecycle smoke passed.");
