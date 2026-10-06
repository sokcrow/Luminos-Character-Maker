import assert from "node:assert/strict";

globalThis.window = globalThis;

await import("../js/item-quality-engine.js");
await import("../js/item-size-lineage-engine.js");
await import("../js/item-affinity-engine.js");
await import("../js/item-culinary-affinity-data.js");
await import("../js/item-inventory-runtime.js");
await import("../js/item-harvest-integrity-engine.js");

await import("../js/item-catalog-meat.js");
await import("../js/item-catalog-hide-pelt.js");
await import("../js/item-catalog-hard-parts.js");
await import("../js/item-catalog-scale-shell-chitin.js");
await import("../js/item-catalog-organ-gland.js");
await import("../js/item-catalog-blood-ichor.js");
await import("../js/item-catalog-venom-secretion.js");
await import("../js/item-catalog-ooze-gel.js");
await import("../js/item-catalog-feather-raw-fiber.js");

await import("../js/unit-loot-profile-contract.js");
await import("../js/unit-catalog-kobold-tier1.js");
await import("../js/unit-catalog-goblin.js");
await import("../js/unit-catalog-wolf.js");
await import("../js/corpse-harvest-runtime.js");
await import("../js/loot-check-runtime.js");
await import("../js/loot-instance-runtime.js");
await import("../js/loot-postcombat-runtime.js");
await import("../js/loot-recovery-delivery-runtime.js");

const inventory = globalThis.LuminousItemInventoryRuntime;
const harvest = globalThis.LuminousItemHarvestIntegrityEngine;
const kobolds = globalThis.LuminousKoboldUnitCatalog;
const goblins = globalThis.LuminousGoblinUnitCatalog;
const wolves = globalThis.LuminousWolfUnitCatalog;
const lootInstances = globalThis.LuminousLootInstanceRuntime;
const postCombat = globalThis.LuminousLootPostCombatRuntime;
const delivery = globalThis.LuminousLootRecoveryDeliveryRuntime;

assert.ok(inventory);
assert.ok(delivery);

const canonicalUnits = [...kobolds.list(), ...goblins.list(), ...wolves.list()];
for (const unit of canonicalUnits) {
  for (const resource of unit.bodyProfile.resources) {
    assert.ok(resource.itemId, `${unit.id}:${resource.id} must author a canonical harvest itemId`);
    const catalog = delivery.catalogFor(resource);
    assert.ok(catalog, `${unit.id}:${resource.id} must resolve a harvest catalog`);
    assert.ok(catalog.get(resource.itemId), `${unit.id}:${resource.id} -> ${resource.itemId} must exist in its catalog`);
  }
}

const wolf = wolves.get("wolf");
const damage = harvest.createDamageRecord();
harvest.recordEvent(damage, {
  sourceType: "weapon",
  physical: true,
  damageType: "slashing",
  damage: 2,
});

const generated = lootInstances.generateLootInstance(wolf, {
  encounterId: "encounter_delivery",
  unitInstanceId: "enemy:wolf:delivery:001",
  unitId: "wolf",
  corpseId: "corpse_wolf_delivery_001",
  damageRecord: damage,
  dmOverrides: {
    harvest: {
      setQuantity: {
        meat: 2,
        pelt: 1,
        bones: 2,
        internal_organs: 1,
        sensory_organs: 1,
        brain: 1,
        glands: 1,
        blood: 2,
      },
    },
  },
});
const locked = lootInstances.lockLootInstance(generated, { unit: wolf, now: 10 });
let state = postCombat.createInteractionState(locked, { now: 11 });

const hunter = {
  id: "player_hunter",
  scores: { wis: 16 },
  proficiencyBonus: 2,
  proficiencies: { skills: { survival: "expertise" } },
  sp: 0,
};
const medic = {
  id: "player_medic",
  scores: { wis: 16 },
  proficiencyBonus: 2,
  proficiencies: { skills: { medicine: "expertise" } },
  sp: 0,
};
const allHeads = () => 0;

const recipient = {
  id: "player_hunter",
  inventoryRules: { activeSlotLimit: 20, stashSlotLimit: 80 },
  inventario_activo: {},
  inventario_stash: {},
};

const meatResult = delivery.performAndDeliver(state, hunter, "harvest", {
  rng: allHeads,
  targetResourceId: "meat",
  recipientUnit: recipient,
  preferredContainer: "stash",
  sourceUnitId: "wolf",
  sourceUnitName: "Wolf",
  species: "wolf",
});
assert.equal(meatResult.committed, true);
assert.equal(meatResult.delivered, true);
assert.equal(meatResult.pending, null);
assert.equal(meatResult.materialized.items.length, 1);

const meat = Object.values(meatResult.recipientUnit.inventario_stash)[0];
assert.equal(meat.definitionId, "meat_wolf");
assert.equal(meat.schemaVersion, inventory.schemaVersion);
assert.equal(meat.quantity, 2);
assert.equal(meat.currentOwnerId, "player_hunter");
assert.equal(meat.provenance.acquisitionMethod, "harvest");
assert.equal(meat.provenance.sourceUnitId, "wolf");
assert.equal(meat.provenance.corpseId, "corpse_wolf_delivery_001");
assert.equal(meat.provenance.culinarySource, true);
assert.equal(meat.customData.harvest.culinary, true);
assert.equal(meat.customData.culinaryProvenance.sourceUnitId, "wolf");
assert.equal(meat.customData.culinaryProvenance.sourceResourceId, "meat");
assert.ok(meat.condition < 100, "combat damage must survive as harvested Item condition");
assert.ok(["ruined", "poor", "standard", "fine", "exceptional"].includes(meat.quality));
assert.equal(meat.originCreatureId, "wolf");
assert.equal(meat.originRaceId, "wolf");
assert.equal(meat.sourceEntityId, "corpse_wolf_delivery_001");
assert.ok(meat.hungerPerUnit > 0, "meat must retain culinary stack metadata");

state = meatResult.state;
const peltResult = delivery.performAndDeliver(state, hunter, "harvest", {
  rng: allHeads,
  targetResourceId: "pelt",
  recipientUnit: meatResult.recipientUnit,
  preferredContainer: "stash",
  sourceUnitId: "wolf",
  sourceUnitName: "Wolf",
  species: "wolf",
});
assert.equal(peltResult.delivered, true);
const pelt = Object.values(peltResult.recipientUnit.inventario_stash).find((item) => item.definitionId === "pelt_fur");
assert.ok(pelt);
assert.equal(pelt.provenance.acquisitionMethod, "harvest");
assert.ok(pelt.hideUnits > 0);
assert.equal(pelt.customData.harvest.valuable, true);

state = peltResult.state;
const organResult = delivery.performAndDeliver(state, medic, "extract", {
  rng: allHeads,
  targetResourceId: "internal_organs",
  recipientUnit: peltResult.recipientUnit,
  preferredContainer: "stash",
  sourceUnitId: "wolf",
  sourceUnitName: "Wolf",
  species: "wolf",
});
assert.equal(organResult.delivered, true);
const organ = Object.values(organResult.recipientUnit.inventario_stash).find((item) => item.definitionId === "internal_organ");
assert.ok(organ);
assert.equal(organ.provenance.acquisitionMethod, "extract");
assert.equal(organ.anatomicalIdentity, "internal_organ");
assert.equal(organ.customData.harvest.valuable, true);

const fullRecipient = {
  id: "player_full",
  inventoryRules: { activeSlotLimit: 0, stashSlotLimit: 0 },
  inventario_activo: {},
  inventario_stash: {},
};
const fullActor = { ...hunter, id: "player_full" };
const beforeBones = organResult.state.harvest.resources.find((r) => r.resourceId === "bones").remaining;

const pendingResult = delivery.performAndDeliver(organResult.state, fullActor, "harvest", {
  rng: allHeads,
  targetResourceId: "bones",
  recipientUnit: fullRecipient,
  preferredContainer: "stash",
  fallbackContainer: "active",
  sourceUnitId: "wolf",
  sourceUnitName: "Wolf",
  species: "wolf",
});
assert.equal(pendingResult.committed, true);
assert.equal(pendingResult.delivered, false);
assert.ok(pendingResult.pending);
assert.equal(Object.keys(pendingResult.recipientUnit.inventario_stash).length, 0);
assert.equal(Object.keys(pendingResult.recipientUnit.inventario_activo).length, 0);
assert.ok(pendingResult.state.pendingDeliveries.length === 1);
assert.ok(
  pendingResult.state.harvest.resources.find((r) => r.resourceId === "bones").remaining < beforeBones,
  "resource is reserved from corpse when a pending delivery is created",
);

const roomRecipient = {
  ...fullRecipient,
  inventoryRules: { activeSlotLimit: 20, stashSlotLimit: 80 },
};
const claimed = delivery.claimPendingDelivery(
  pendingResult.state,
  roomRecipient,
  pendingResult.pending.id,
  { preferredContainer: "stash" },
);
assert.equal(claimed.claimed, true);
assert.equal(claimed.state.pendingDeliveries.length, 0);
const boneItem = Object.values(claimed.recipientUnit.inventario_stash).find((item) => item.definitionId === "hard_bone");
assert.ok(boneItem);
assert.equal(boneItem.currentOwnerId, "player_full");
assert.equal(boneItem.provenance.acquisitionMethod, "harvest");

const missingMappingUnit = {
  id: "bad_harvest_mapping",
  bodyProfile: {
    kind: "organic",
    sizeClass: "medium",
    materials: ["flesh"],
    resources: [
      { id: "mystery_tissue", integrityFamily: "organ_internal", sourceMaterial: "flesh" },
    ],
  },
  lootProfile: {
    carried: [],
    equipment: { source: "none" },
    harvest: { source: "body_profile" },
  },
};
const badLoot = lootInstances.generateLootInstance(missingMappingUnit, {
  encounterId: "encounter_bad_mapping",
  unitInstanceId: "enemy:bad_mapping:001",
  corpseId: "corpse_bad_mapping",
  dmOverrides: { harvest: { setQuantity: { mystery_tissue: 1 } } },
});
const badLocked = lootInstances.lockLootInstance(badLoot, { unit: missingMappingUnit });
const badState = postCombat.createInteractionState(badLocked);
const badResult = delivery.performAndDeliver(badState, medic, "extract", {
  rng: allHeads,
  targetResourceId: "mystery_tissue",
  recipientUnit: recipient,
});
assert.equal(badResult.committed, false);
assert.equal(badResult.reason, "HARVEST_ITEM_MAPPING_REQUIRED");
assert.deepEqual(badResult.state, badState, "missing materialization metadata must not consume the corpse resource");

console.log("Harvest Item materialization + inventory delivery smoke passed.");
