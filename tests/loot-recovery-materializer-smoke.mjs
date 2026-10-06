import assert from "node:assert/strict";

globalThis.window = globalThis;

await import("../js/item-quality-engine.js");
await import("../js/item-size-lineage-engine.js");
await import("../js/item-culinary-affinity-data.js");
await import("../js/item-affinity-engine.js");
await import("../js/item-processing-engine.js");
await import("../js/item-runtime-engine.js");
await import("../js/item-inventory-runtime.js");
await import("../js/creature-type-catalog.js");

await import("../js/item-catalog-meat.js");
await import("../js/item-catalog-hide-pelt.js");
await import("../js/item-catalog-hard-parts.js");
await import("../js/item-catalog-organ-gland.js");
await import("../js/item-catalog-blood-ichor.js");
await import("../js/item-catalog-venom-secretion.js");
await import("../js/item-catalog-ooze-gel.js");
await import("../js/item-catalog-scale-shell-chitin.js");
await import("../js/item-catalog-feather-raw-fiber.js");
await import("../js/item-catalog-salvage-raw.js");

await import("../js/item-cooking-recipe-catalog.js");
await import("../js/item-cooking-recipe-resolver.js");

await import("../js/loot-instance-runtime.js");
await import("../js/loot-check-runtime.js");
await import("../js/loot-knowledge-runtime.js");
await import("../js/loot-postcombat-runtime.js");
await import("../js/loot-recovery-materializer.js");

const inventory = globalThis.LuminousItemInventoryRuntime;
const cookingResolver = globalThis.LuminousCookingRecipeResolver;
const knowledge = globalThis.LuminousLootKnowledgeRuntime;
const postCombat = globalThis.LuminousLootPostCombatRuntime;
const materializer = globalThis.LuminousLootRecoveryMaterializer;

assert.ok(inventory);
assert.ok(cookingResolver);
assert.ok(knowledge);
assert.ok(postCombat);
assert.ok(materializer);

const wolf = {
  id: "wolf",
  combatId: "enemy:wolf:001",
  species: "wolf",
  creatureType: "beast",
  bodyProfile: {
    kind: "organic",
    sizeClass: "medium",
    materials: ["flesh", "blood", "bone", "pelt"],
  },
};

const humanoid = {
  id: "goblin",
  combatId: "enemy:goblin:001",
  species: "goblin",
  creatureType: "humanoid",
  bodyProfile: {
    kind: "organic",
    sizeClass: "small",
    materials: ["flesh", "blood", "bone"],
  },
};

assert.deepEqual(materializer.mappingForResource({
  resourceId: "meat", integrityFamily: "meat", sourceMaterial: "flesh",
}, wolf), {
  catalog: "meat", itemId: "meat_wolf", source: "canonical_family_mapping",
});

assert.deepEqual(materializer.mappingForResource({
  resourceId: "pelt", integrityFamily: "hide_pelt", sourceMaterial: "pelt",
}, wolf), {
  catalog: "hide_pelt", itemId: "pelt_fur", source: "canonical_family_mapping",
});

assert.equal(materializer.mappingForResource({
  resourceId: "internal_organs", integrityFamily: "organ_internal", sourceMaterial: "flesh",
}, humanoid).itemId, "internal_organ");

assert.equal(materializer.mappingForResource({
  resourceId: "blood", integrityFamily: "blood_ichor", sourceMaterial: "blood",
}, humanoid).itemId, "humanoid_blood");

assert.equal(materializer.mappingForResource({
  resourceId: "metal_frame", integrityFamily: "hard_cover_structural", sourceMaterial: "metal",
}, { id: "construct", bodyProfile: { kind: "construct", sizeClass: "medium" } }).itemId, "scrap_metal");

assert.equal(materializer.mappingForResource({
  resourceId: "unknown_ectoplasm", integrityFamily: "ethereal", sourceMaterial: "ethereal",
}, { id: "ghost" }), null);

const meatRecovery = {
  resourceId: "meat",
  quantity: 2,
  integrityFamily: "meat",
  sourceMaterial: "flesh",
  integrity: {
    integrityPercent: 75,
    status: "damaged",
    contaminated: false,
  },
  recoverableYield: {
    qualityMultiplier: 0.75,
  },
  provenance: {
    acquisitionMethod: "harvest",
    acquiredByActorId: "player_hunter",
    sourceUnitId: "wolf",
    sourceUnitInstanceId: "enemy:wolf:001",
    corpseId: "corpse:wolf:001",
    encounterId: "encounter_01",
    lootInstanceId: "loot_wolf_01",
  },
};

const meat = materializer.materializeResource(meatRecovery, wolf, { now: 100 });
assert.equal(meat.materialized, true);
assert.equal(meat.item.definitionId, "meat_wolf");
assert.equal(meat.item.quantity, 2);
assert.equal(meat.item.condition, 75);
assert.equal(meat.item.qualityTier, 4);
assert.equal(meat.item.provenance.acquisitionMethod, "harvest");
assert.equal(meat.item.provenance.corpseId, "corpse:wolf:001");
assert.equal(meat.item.provenance.sourceUnitId, "wolf");
assert.equal(meat.item.lineageId, "wolf");
assert.equal(meat.item.originCreatureId, "wolf");
assert.ok(Array.isArray(meat.item.culinaryProperties));
assert.equal(meat.item.customData.harvest.definition.family, "meat");

const hydratedMeat = inventory.hydrateItemInstance(meat.item);
const cookingMatch = cookingResolver.matchRequirement("meat", hydratedMeat);
assert.equal(cookingMatch.matches, true, "harvested meat Item Instance must remain a valid Cooking meat ingredient");

const organRecovery = {
  resourceId: "internal_organs",
  quantity: 1,
  integrityFamily: "organ_internal",
  sourceMaterial: "flesh",
  integrity: {
    integrityPercent: 95,
    status: "intact",
    contaminated: false,
  },
  recoverableYield: { qualityMultiplier: 0.95 },
  provenance: {
    acquisitionMethod: "extract",
    acquiredByActorId: "player_medic",
    sourceUnitId: "goblin",
    sourceUnitInstanceId: "enemy:goblin:001",
    corpseId: "corpse:goblin:001",
    encounterId: "encounter_02",
    lootInstanceId: "loot_goblin_01",
  },
};

const organ = materializer.materializeResource(organRecovery, humanoid, { now: 110 });
assert.equal(organ.materialized, true);
assert.equal(organ.item.definitionId, "internal_organ");
assert.equal(organ.item.provenance.acquisitionMethod, "extract");
assert.equal(organ.item.customData.harvest.definition.transplantMedicalRangeAhn.minAhn > 0, true);

const scrapRecovery = {
  resourceId: "metal_frame",
  quantity: 2,
  integrityFamily: "hard_cover_structural",
  sourceMaterial: "metal",
  integrity: { integrityPercent: 80, status: "damaged", contaminated: false },
  recoverableYield: { qualityMultiplier: 0.8 },
  provenance: {
    acquisitionMethod: "salvage",
    acquiredByActorId: "player_salvager",
    sourceUnitId: "construct",
    sourceUnitInstanceId: "enemy:construct:001",
    corpseId: "corpse:construct:001",
    encounterId: "encounter_03",
    lootInstanceId: "loot_construct_01",
  },
};

const scrap = materializer.materializeResource(scrapRecovery, {
  id: "construct",
  combatId: "enemy:construct:001",
  species: "construct",
  bodyProfile: { kind: "construct", sizeClass: "medium", materials: ["metal", "mechanical"] },
}, { now: 120 });

assert.equal(scrap.materialized, true);
assert.equal(scrap.item.definitionId, "scrap_metal");
assert.equal(scrap.item.provenance.acquisitionMethod, "salvage");
assert.equal(scrap.item.customData.harvest.definition.rawCraftingReagent, true);

const useFacts = knowledge.materializedLootFacts([meat.item, organ.item, scrap.item], {
  discoveredBy: "player_hunter",
  discoveredAt: 130,
});
const knownUses = useFacts.find((fact) => fact.id === "loot.known_uses");
const valuables = useFacts.find((fact) => fact.id === "loot.valuable_organs_materials");
assert.ok(knownUses);
assert.ok(knownUses.value.find((entry) => entry.itemId === "meat_wolf").uses.includes("cooking"));
assert.ok(knownUses.value.find((entry) => entry.itemId === "scrap_metal").uses.includes("crafting"));
assert.ok(valuables);
assert.ok(valuables.value.some((entry) => entry.itemId === "internal_organ" && entry.reasons.includes("medical_value")));

const equipmentStamped = materializer.stampAcquisition(meat.item, "equipment", { actorId: "player_a", now: 140 });
const dmStamped = materializer.stampAcquisition(meat.item, "dm_grant", { actorId: "player_a", now: 141 });
assert.equal(equipmentStamped.provenance.acquisitionMethod, "equipment");
assert.equal(dmStamped.provenance.acquisitionMethod, "dm_grant");

const atomicRecipient = {
  id: "player_atomic",
  activeSlotLimit: 1,
  stashSlotLimit: 1,
  inventario_activo: {},
  inventario_stash: {},
};
const tooMany = {
  materialized: true,
  items: [meat.item, organ.item, scrap.item],
  failures: [],
  currency: null,
};
const atomicFailure = materializer.deliverAtomic(atomicRecipient, tooMany, {
  destinationPolicy: "active_then_stash",
});
assert.equal(atomicFailure.delivered, false);
assert.equal(Object.keys(atomicRecipient.inventario_activo).length, 0, "failed atomic delivery must not partially mutate Active Inventory");
assert.equal(Object.keys(atomicRecipient.inventario_stash).length, 0, "failed atomic delivery must not partially mutate Stash");

const enoughRecipient = {
  id: "player_enough",
  activeSlotLimit: 1,
  stashSlotLimit: 2,
  inventario_activo: {},
  inventario_stash: {},
};
const atomicSuccess = materializer.deliverAtomic(enoughRecipient, tooMany, {
  destinationPolicy: "active_then_stash",
});
assert.equal(atomicSuccess.delivered, true);
assert.equal(Object.keys(enoughRecipient.inventario_activo).length, 1);
assert.equal(Object.keys(enoughRecipient.inventario_stash).length, 2);
for (const item of [
  ...Object.values(enoughRecipient.inventario_activo),
  ...Object.values(enoughRecipient.inventario_stash),
]) {
  assert.equal(item.currentOwnerId, "player_enough");
}

const lockedHarvest = {
  lootInstanceId: "loot_harvest_delivery",
  locked: true,
  sourceUnitId: "wolf",
  sourceUnitInstanceId: "enemy:wolf:001",
  corpseId: "corpse:wolf:001",
  encounterId: "encounter_harvest_delivery",
  sourceDigest: "digest",
  generation: 0,
  carried: [],
  currency: { currencyId: "ahn", amount: 0, provenance: {} },
  equipment: { source: "none", items: [] },
  harvest: {
    bodyKind: "organic",
    sizeClass: "medium",
    resources: [{
      id: "meat",
      resourceId: "meat",
      integrityFamily: "meat",
      sourceMaterial: "flesh",
      capacity: 2,
      remaining: 2,
      depleted: false,
      recoverableYield: { min: 2, max: 2, quantityMultiplier: 1, qualityMultiplier: 1 },
      integrity: { integrityPercent: 100, status: "intact", contaminated: false },
      provenance: {
        sourceUnitId: "wolf",
        sourceUnitInstanceId: "enemy:wolf:001",
        corpseId: "corpse:wolf:001",
        encounterId: "encounter_harvest_delivery",
        lootInstanceId: "loot_harvest_delivery",
      },
    }],
  },
};

const state0 = postCombat.createInteractionState(lockedHarvest);
const hunter = {
  id: "player_hunter",
  scores: { wis: 14 },
  proficiencyBonus: 2,
  skillProficiency: { survival: "proficient" },
  sp: 0,
};
const fullRecipient = {
  id: "player_hunter",
  activeSlotLimit: 0,
  stashSlotLimit: 0,
  inventario_activo: {},
  inventario_stash: {},
};
const failedCommit = materializer.performAndDeliver(state0, hunter, "harvest", fullRecipient, wolf, {
  rng: () => 0,
  targetResourceId: "meat",
});
assert.equal(failedCommit.committed, false);
assert.equal(failedCommit.reason, "inventory_capacity_rejected_recovery");
assert.equal(failedCommit.state.harvest.resources[0].remaining, 2, "inventory rejection must roll back corpse resource consumption");

const harvestRecipient = {
  id: "player_hunter",
  activeSlotLimit: 2,
  stashSlotLimit: 2,
  inventario_activo: {},
  inventario_stash: {},
};
let compendium = knowledge.createCompendium("player_hunter");
const committedHarvest = materializer.performAndDeliver(state0, hunter, "harvest", harvestRecipient, wolf, {
  rng: () => 0,
  targetResourceId: "meat",
  compendium,
  now: 200,
});
assert.equal(committedHarvest.committed, true);
assert.equal(committedHarvest.state.harvest.resources[0].remaining, 0);
assert.equal(Object.values(harvestRecipient.inventario_activo)[0].definitionId, "meat_wolf");
assert.ok(committedHarvest.compendium.units.wolf.facts["loot.known_uses"]);

const ration = inventory.createItemInstance({
  id: "ration",
  name: "Ration",
  category: "food",
  itemType: "consumable",
  stackable: true,
}, {
  instanceId: "ration_loot_01",
  quantity: 1,
  provenance: {
    sourceUnitId: "goblin",
    sourceUnitInstanceId: "enemy:goblin:001",
    corpseId: "corpse:goblin:001",
    encounterId: "encounter_currency",
    lootInstanceId: "loot_currency",
  },
});

const lockedSearch = {
  lootInstanceId: "loot_currency",
  locked: true,
  sourceUnitId: "goblin",
  sourceUnitInstanceId: "enemy:goblin:001",
  corpseId: "corpse:goblin:001",
  encounterId: "encounter_currency",
  sourceDigest: "digest_currency",
  generation: 0,
  carried: [ration],
  currency: { currencyId: "ahn", amount: 100, provenance: { sourceUnitId: "goblin" } },
  equipment: { source: "none", items: [] },
  harvest: { bodyKind: "organic", sizeClass: "small", resources: [] },
};
const searchState = postCombat.createInteractionState(lockedSearch);
const searcher = {
  id: "player_searcher",
  stats: { int: 16 },
  proficiencyBonus: 2,
  skillProficiency: { investigation: "expertise" },
  sp: 0,
};
const searchRecipient = {
  id: "player_searcher",
  activeSlotLimit: 2,
  stashSlotLimit: 2,
  inventario_activo: {},
  inventario_stash: {},
  walletAhn: 0,
};

const blockedCurrency = materializer.performAndDeliver(searchState, searcher, "search", searchRecipient, humanoid, {
  rng: () => 0,
});
assert.equal(blockedCurrency.committed, false);
assert.equal(blockedCurrency.reason, "currency_delivery_handler_required");
assert.equal(blockedCurrency.state.currency.remaining, 100);
assert.equal(Object.keys(searchRecipient.inventario_activo).length, 0);

const currencyHandler = {
  preview(currency) {
    return { accepted: currency.currencyId === "ahn" };
  },
  commit(currency, recipient) {
    recipient.walletAhn = Number(recipient.walletAhn || 0) + currency.amount;
    return { credited: true, currencyId: currency.currencyId, amount: currency.amount };
  },
};
const committedSearch = materializer.performAndDeliver(searchState, searcher, "search", searchRecipient, humanoid, {
  rng: () => 0,
  currencyHandler,
});
assert.equal(committedSearch.committed, true);
assert.equal(committedSearch.state.currency.remaining, 0);
assert.equal(searchRecipient.walletAhn, 100);
assert.ok(Object.values(searchRecipient.inventario_activo).some((item) => item.definitionId === "ration"));
assert.equal(
  Object.values(searchRecipient.inventario_activo).find((item) => item.definitionId === "ration").provenance.acquisitionMethod,
  "search",
);

console.log("Loot recovery materialization + atomic inventory delivery smoke passed.");
