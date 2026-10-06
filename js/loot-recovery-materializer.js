(function (global) {
  "use strict";

  if (global.LuminousLootRecoveryMaterializer) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootRecoveryMaterializer;
    return;
  }

  const VERSION = 1;
  const ACQUISITION_METHODS = Object.freeze(["search", "harvest", "extract", "salvage", "equipment", "dm_grant"]);

  function inventory() { return global.LuminousItemInventoryRuntime || null; }
  function knowledge() { return global.LuminousLootKnowledgeRuntime || null; }
  function creatureTypes() { return global.LuminousCreatureTypeCatalog || null; }
  function lootRuntime() { return global.LuminousLootInstanceRuntime || null; }
  function postCombat() { return global.LuminousLootPostCombatRuntime || null; }

  const CATALOGS = Object.freeze({
    meat: () => global.LuminousMeatCatalog || null,
    hide_pelt: () => global.LuminousHidePeltCatalog || null,
    hard_parts: () => global.LuminousHardPartsCatalog || null,
    organ_gland: () => global.LuminousOrganGlandCatalog || null,
    blood_ichor: () => global.LuminousBloodIchorCatalog || null,
    venom_secretion: () => global.LuminousVenomSecretionCatalog || null,
    ooze_gel: () => global.LuminousOozeGelCatalog || null,
    scale_shell_chitin: () => global.LuminousScaleShellChitinCatalog || null,
    feather_raw_fiber: () => global.LuminousFeatherRawFiberCatalog || null,
    raw_salvage: () => global.LuminousRawSalvageCatalog || null,
  });

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }
  function numberOr(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, numberOr(value, min))); }
  function integer(value, fallback = 0) { const n = Number.parseInt(value, 10); return Number.isFinite(n) ? n : fallback; }

  function creatureTypeOf(unit = {}) {
    const explicit = normalizeId(unit.creatureType ?? unit.metadata?.creatureType ?? unit.mechanics?.creatureType);
    if (explicit) return explicit;
    try {
      const profile = creatureTypes()?.profileForUnit?.(unit, { required: false });
      if (profile?.creatureType) return normalizeId(profile.creatureType);
    } catch (_) {}
    const species = normalizeId(unit.species ?? unit.family);
    if (["kobold", "goblin", "human", "humanoid"].includes(species)) return "humanoid";
    if (species.includes("wolf")) return "beast";
    return "";
  }

  function lineageOf(unit = {}) {
    return {
      id: normalizeId(unit.species ?? unit.lineageId ?? unit.family ?? unit.id),
      name: String(unit.speciesName ?? unit.lineageName ?? unit.species ?? unit.name ?? unit.id ?? "Unknown").trim(),
    };
  }

  function mappingForResource(resource = {}, unit = {}) {
    const authoredItemId = normalizeId(resource.itemId ?? resource.definitionId);
    const family = normalizeId(resource.integrityFamily);
    const resourceId = normalizeId(resource.resourceId ?? resource.id);
    const material = normalizeId(resource.sourceMaterial);
    const species = normalizeId(unit.species ?? unit.family ?? unit.id);
    const creatureType = creatureTypeOf(unit);

    if (authoredItemId) {
      const familyCatalog = {
        organ_internal: "organ_gland",
        organ_sensory: "organ_gland",
        organ_brain: "organ_gland",
        organ_gland: "organ_gland",
        hard_cover_modular: "scale_shell_chitin",
        hard_cover_structural: "scale_shell_chitin",
        feather_raw: "feather_raw_fiber",
        raw_fiber: "feather_raw_fiber",
      };
      return deepFreeze({ catalog: normalizeId(resource.catalogFamily || familyCatalog[family] || family), itemId: authoredItemId, source: "authored" });
    }

    if (family === "meat") {
      const itemId = species.includes("wolf") ? "meat_wolf" : creatureType === "humanoid" ? "meat_humanoid" : null;
      return itemId ? deepFreeze({ catalog: "meat", itemId, source: "canonical_family_mapping" }) : null;
    }

    if (family === "hide_pelt") {
      let itemId = null;
      if (resourceId.includes("pelt") || species.includes("wolf")) itemId = "pelt_fur";
      else if (creatureType === "humanoid") itemId = "hide_humanoid";
      else if (material === "hide" || creatureType === "beast") itemId = "hide_mammal";
      return itemId ? deepFreeze({ catalog: "hide_pelt", itemId, source: "canonical_family_mapping" }) : null;
    }

    if (family === "hard_parts") {
      const direct = {
        bone: "hard_bone", bones: "hard_bone", skull: "hard_bone", fang: "hard_fang", fangs: "hard_fang",
        claw: "hard_claw", claws: "hard_claw", talon: "hard_talon", talons: "hard_talon",
        horn: "hard_horn", horns: "hard_horn", antler: "hard_antler", antlers: "hard_antler",
        tusk: "hard_tusk", tusks: "hard_tusk", ivory: "hard_ivory",
      };
      if (direct[resourceId]) return deepFreeze({ catalog: "hard_parts", itemId: direct[resourceId], source: "canonical_family_mapping" });
      if (["bone"].includes(material)) return deepFreeze({ catalog: "hard_parts", itemId: "hard_bone", source: "canonical_material_mapping" });
    }

    if (["organ_internal", "organ_sensory", "organ_brain", "organ_gland"].includes(family)) {
      const direct = {
        internal_organs: "internal_organ", internal_organ: "internal_organ",
        sensory_organs: "eye", sensory_organ: "eye", eye: "eye",
        brain: "brain", gland: "gland", glands: "gland",
      };
      const itemId = direct[resourceId] || (family === "organ_internal" ? "internal_organ" : family === "organ_sensory" ? "eye" : family === "organ_brain" ? "brain" : "gland");
      return deepFreeze({ catalog: "organ_gland", itemId, source: "canonical_family_mapping" });
    }

    if (family === "blood_ichor") {
      let itemId = "blood";
      if (resourceId.includes("ichor")) itemId = "ichor";
      else if (resourceId.includes("hemolymph")) itemId = "hemolymph";
      else if (creatureType === "humanoid") itemId = "humanoid_blood";
      if (species.includes("dragon") || resourceId.includes("draconic")) itemId = "draconic_blood";
      return deepFreeze({ catalog: "blood_ichor", itemId, source: "canonical_family_mapping" });
    }

    if (family === "venom_secretion") {
      const direct = ["venom", "toxic_secretion", "acid_secretion", "ink_secretion", "pheromone_scent", "defensive_secretion", "exotic_secretion"];
      return deepFreeze({ catalog: "venom_secretion", itemId: direct.includes(resourceId) ? resourceId : "venom", source: "canonical_family_mapping" });
    }

    if (family === "ooze_gel") {
      const direct = ["slime", "mucus", "gel", "adhesive_ooze", "regenerative_gel", "conductive_gel", "exotic_ooze"];
      return deepFreeze({ catalog: "ooze_gel", itemId: direct.includes(resourceId) ? resourceId : "slime", source: "canonical_family_mapping" });
    }

    if (family === "feather_raw") {
      return deepFreeze({ catalog: "feather_raw_fiber", itemId: resourceId === "flight_feather" ? "flight_feather" : "feather", source: "canonical_family_mapping" });
    }

    if (family === "raw_fiber") {
      const direct = ["down", "wool", "animal_hair", "raw_silk", "exotic_raw_fiber"];
      return deepFreeze({ catalog: "feather_raw_fiber", itemId: direct.includes(resourceId) ? resourceId : "animal_hair", source: "canonical_family_mapping" });
    }

    if (family === "hard_cover_modular" || family === "hard_cover_structural") {
      const cover = {
        scale: "scale", scales: "scale", scute: "scute", shell: "shell", carapace: "carapace",
        chitin: "chitin", exoskeleton_plate: "exoskeleton_plate",
      };
      if (cover[resourceId] || cover[material]) return deepFreeze({ catalog: "scale_shell_chitin", itemId: cover[resourceId] || cover[material], source: "canonical_family_mapping" });
    }

    if (["metal", "mechanical", "stone", "mineral", "synthetic", "crystal", "wood", "plant"].includes(material)) {
      const salvage = CATALOGS.raw_salvage()?.itemForMaterial?.(material);
      if (salvage?.id) return deepFreeze({ catalog: "raw_salvage", itemId: salvage.id, source: "canonical_salvage_mapping" });
    }

    return null;
  }

  function catalogFor(mapping = {}) {
    return CATALOGS[normalizeId(mapping.catalog)]?.() || null;
  }

  function definitionFor(mapping = {}) {
    return catalogFor(mapping)?.get?.(mapping.itemId) || null;
  }

  function qualityTierFor(resource = {}) {
    const multiplier = resource.recoverableYield?.qualityMultiplier;
    if (Number.isFinite(Number(multiplier))) return clamp(Math.round(1 + clamp(multiplier, 0, 1) * 4), 1, 5);
    const pct = Number(resource.integrity?.integrityPercent);
    if (Number.isFinite(pct)) return clamp(Math.round(1 + clamp(pct / 100, 0, 1) * 4), 1, 5);
    return 3;
  }

  function conditionFor(resource = {}) {
    const pct = Number(resource.integrity?.integrityPercent);
    return Number.isFinite(pct) ? clamp(Math.round(pct), 0, 100) : 100;
  }

  function commonHarvestOptions(resource = {}, unit = {}, options = {}) {
    const lineage = lineageOf(unit);
    return {
      quantity: Math.max(1, integer(resource.quantity, 1)),
      size: unit.bodyProfile?.sizeClass || resource.sizeClass || "medium",
      partSize: resource.partSize || unit.bodyProfile?.sizeClass || "medium",
      creatureSize: unit.bodyProfile?.sizeClass || resource.sizeClass || "medium",
      lineageId: lineage.id,
      lineageName: lineage.name,
      sourceInstanceId: resource.provenance?.corpseId || options.corpseId || null,
      sourceEntityId: resource.provenance?.sourceUnitInstanceId || options.sourceUnitInstanceId || null,
      originCreatureType: creatureTypeOf(unit) || null,
      originCreatureId: resource.provenance?.sourceUnitId || normalizeId(unit.id) || null,
      originRaceId: normalizeId(unit.raceId ?? unit.species) || null,
      originSubtypeId: normalizeId(unit.subtypeId ?? unit.variant) || null,
      integritySnapshot: clone(resource.integrity || null),
      integrityRecoverableMax: Math.max(0, integer(resource.quantity, 0)),
    };
  }

  function harvestVariant(mapping, resource, unit, options = {}) {
    const catalog = catalogFor(mapping);
    if (!catalog) return null;
    const common = commonHarvestOptions(resource, unit, options);
    const family = normalizeId(resource.integrityFamily);

    if (["meat", "hide_pelt", "blood_ichor", "venom_secretion", "ooze_gel", "feather_raw", "raw_fiber"].includes(family) && catalog.createHarvestStack) {
      const stackOptions = { ...common };
      if (family === "blood_ichor") stackOptions.bloodUnits = common.quantity;
      if (family === "venom_secretion") stackOptions.secretionUnits = common.quantity;
      if (family === "ooze_gel") stackOptions.oozeUnits = common.quantity;
      return catalog.createHarvestStack(mapping.itemId, stackOptions);
    }

    if (["hard_parts", "organ_internal", "organ_sensory", "organ_brain", "organ_gland", "hard_cover_modular", "hard_cover_structural"].includes(family) && catalog.createHarvestPart) {
      return catalog.createHarvestPart(mapping.itemId, common);
    }

    return {
      itemId: mapping.itemId,
      family: catalog.FAMILY || mapping.catalog,
      quantity: common.quantity,
      size: common.size,
      quality: "standard",
      lineageId: common.lineageId,
      lineageName: common.lineageName,
      integritySnapshot: common.integritySnapshot,
      originCreatureType: common.originCreatureType,
      originCreatureId: common.originCreatureId,
      sourceEntityId: common.sourceEntityId,
    };
  }

  function deterministicInstanceId(resource = {}, mapping = {}, options = {}) {
    const hash = lootRuntime()?.hashHex;
    const raw = [
      resource.provenance?.lootInstanceId,
      resource.provenance?.corpseId,
      resource.provenance?.acquiredByActorId,
      resource.provenance?.acquisitionMethod,
      resource.resourceId,
      mapping.itemId,
      resource.quantity,
      options.ordinal || 0,
    ].join("|");
    return `harvest_${hash ? hash(raw) : normalizeId(raw).slice(-32)}_${normalizeId(mapping.itemId)}`;
  }

  function definitionSummary(definition = {}, variant = {}) {
    return deepFreeze({
      family: normalizeId(definition.family),
      category: normalizeId(definition.category),
      itemType: normalizeId(definition.itemType),
      tags: deepFreeze([...(definition.tags || [])].map(normalizeId).filter(Boolean)),
      useTags: deepFreeze([...(definition.useTags || [])].map(normalizeId).filter(Boolean)),
      edibleRaw: definition.edibleRaw === true,
      rawCraftingReagent: definition.rawCraftingReagent === true || variant.rawCraftingReagent === true,
      unitValueAhn: numberOr(variant.unitValueAhn ?? definition.standardUnitValueAhn ?? definition.mediumStandardValueAhn ?? definition.priceAhn, 0),
      totalValueAhn: numberOr(variant.totalValueAhn, 0),
      transplantMedicalStandardMediumValueAhn: definition.transplantMedicalStandardMediumValueAhn ?? null,
      transplantMedicalRangeAhn: clone(definition.transplantMedicalRangeAhn || variant.transplantMedicalValueRangeAhn || null),
    });
  }

  function stampAcquisition(item = {}, method, options = {}) {
    const normalized = normalizeId(method);
    if (!ACQUISITION_METHODS.includes(normalized)) throw new Error(`UNKNOWN_LOOT_ACQUISITION_METHOD:${normalized}`);
    return deepFreeze({
      ...clone(item),
      provenance: deepFreeze({
        ...clone(item.provenance || {}),
        acquisitionMethod: normalized,
        acquiredByActorId: String(options.actorId ?? item.provenance?.acquiredByActorId ?? "").trim() || null,
        acquiredAt: options.now == null ? (item.provenance?.acquiredAt ?? null) : Number(options.now),
        ...(options.extraProvenance || {}),
      }),
    });
  }

  function materializeResource(resource = {}, unit = {}, options = {}) {
    const inv = inventory();
    if (!inv?.createItemInstance) throw new Error("ITEM_INVENTORY_RUNTIME_REQUIRED");
    const mapping = mappingForResource(resource, unit);
    if (!mapping) return deepFreeze({ materialized: false, reason: "unmapped_resource", resource: clone(resource) });

    const definition = definitionFor(mapping);
    if (!definition) return deepFreeze({ materialized: false, reason: "catalog_definition_missing", mapping, resource: clone(resource) });

    const variant = harvestVariant(mapping, resource, unit, options) || {};
    const quantity = Math.max(0, integer(
      variant.quantity ??
      variant.bloodUnits ??
      variant.secretionUnits ??
      variant.oozeUnits ??
      resource.quantity,
      0,
    ));
    if (quantity <= 0) return deepFreeze({ materialized: false, reason: "zero_materialized_quantity", mapping, resource: clone(resource) });

    const method = normalizeId(resource.provenance?.acquisitionMethod || options.acquisitionMethod || "harvest");
    const provenance = {
      ...clone(resource.provenance || {}),
      acquisitionMethod: method,
      resourceId: normalizeId(resource.resourceId),
      integrityFamily: normalizeId(resource.integrityFamily),
      sourceMaterial: normalizeId(resource.sourceMaterial),
      mappingSource: mapping.source,
      mappedDefinitionId: mapping.itemId,
    };

    const item = inv.createItemInstance(definition, {
      ...clone(variant),
      catalog: options.catalog,
      instanceId: deterministicInstanceId(resource, mapping, options),
      quantity,
      qualityTier: qualityTierFor(resource),
      condition: conditionFor(resource),
      currentOwnerId: null,
      provenance,
      customData: {
        harvest: {
          resource: clone(resource),
          variant: clone(variant),
          definition: clone(definitionSummary(definition, variant)),
        },
      },
    });

    return deepFreeze({
      materialized: true,
      mapping,
      item: stampAcquisition(item, method, {
        actorId: resource.provenance?.acquiredByActorId,
        now: options.now,
      }),
    });
  }

  function materializeRecovery(recovery = {}, unit = {}, options = {}) {
    const items = [];
    const failures = [];

    for (const raw of recovery.items || []) {
      const method = normalizeId(raw.provenance?.acquisitionMethod || options.acquisitionMethod || "search");
      try {
        items.push(stampAcquisition(raw, method, {
          actorId: raw.provenance?.acquiredByActorId || options.actorId,
          now: options.now,
        }));
      } catch (error) {
        failures.push({ type: "item", id: raw.instanceId || raw.definitionId || null, reason: String(error?.message || error) });
      }
    }

    (recovery.resources || []).forEach((resource, ordinal) => {
      const result = materializeResource(resource, unit, { ...options, ordinal });
      if (result.materialized) items.push(result.item);
      else failures.push({
        type: "resource",
        id: resource.resourceId || null,
        reason: result.reason,
        resource: clone(resource),
      });
    });

    return deepFreeze({
      materialized: failures.length === 0,
      items: deepFreeze(items),
      failures: deepFreeze(failures),
      currency: recovery.currency ? deepFreeze(clone(recovery.currency)) : null,
    });
  }

  function ownerIdOf(unit = {}, options = {}) {
    return String(options.ownerId ?? unit.playerId ?? unit.uid ?? unit.actorId ?? unit.id ?? "").trim();
  }

  function destinations(policy) {
    const id = normalizeId(policy || "active_then_stash");
    if (id === "active") return ["active"];
    if (id === "stash") return ["stash"];
    if (id === "stash_then_active") return ["stash", "active"];
    return ["active", "stash"];
  }

  function insertFully(simulatedUnit, rawItem, policy, options = {}) {
    const inv = inventory();
    const ownerId = ownerIdOf(simulatedUnit, options);
    let remaining = Math.max(0, integer(rawItem.quantity, 0));
    const placements = [];
    let item = clone(rawItem);
    if (ownerId && inv?.transferOwnership) inv.transferOwnership(item, ownerId);

    for (const destination of destinations(policy)) {
      if (remaining <= 0) break;
      item.quantity = remaining;
      if (placements.length) item.instanceId = inv.createInstanceId?.(item.definitionId) || `${item.instanceId}_overflow_${placements.length}`;
      const result = inv.insertItem(simulatedUnit, item, destination, options);
      const inserted = Math.max(0, integer(result.quantity, 0));
      remaining = Math.max(0, remaining - inserted);
      placements.push(deepFreeze({
        destination,
        inserted,
        remaining,
        reason: result.reason || null,
        container: result.container || null,
        insertedKeys: deepFreeze([...(result.insertedKeys || [])]),
      }));
    }

    return deepFreeze({
      inserted: remaining === 0,
      requested: Math.max(0, integer(rawItem.quantity, 0)),
      insertedQuantity: Math.max(0, integer(rawItem.quantity, 0)) - remaining,
      remaining,
      placements: deepFreeze(placements),
    });
  }

  function commitInventoryClone(target, simulated) {
    const inv = inventory();
    const active = inv.activeContainer(simulated, true);
    const stash = inv.stashContainer(simulated, true);
    target[active.key] = clone(active.value);
    target[stash.key] = clone(stash.value);
    if (simulated.itemInventorySchemaVersion != null) target.itemInventorySchemaVersion = simulated.itemInventorySchemaVersion;
    return target;
  }

  function simulateDelivery(recipient = {}, materialized = {}, options = {}) {
    const inv = inventory();
    if (!inv?.insertItem) throw new Error("ITEM_INVENTORY_RUNTIME_REQUIRED");
    if (!materialized.materialized) return { delivered: false, reason: "materialization_failed", failures: clone(materialized.failures || []) };

    const simulated = clone(recipient);
    const results = [];
    for (const item of materialized.items || []) {
      const result = insertFully(simulated, item, options.destinationPolicy || "active_then_stash", {
        ...options,
        ownerId: ownerIdOf(recipient, options),
      });
      results.push({ instanceId: item.instanceId, definitionId: item.definitionId, ...clone(result) });
      if (!result.inserted) {
        return {
          delivered: false,
          reason: "inventory_capacity_rejected_recovery",
          results,
          failedItem: item.instanceId,
        };
      }
    }

    return {
      delivered: true,
      results,
      simulated,
    };
  }

  function deliverAtomic(recipient = {}, materialized = {}, options = {}) {
    const inv = inventory();
    const simulation = simulateDelivery(recipient, materialized, options);
    if (!simulation.delivered) return deepFreeze(clone(simulation));
    commitInventoryClone(recipient, simulation.simulated);
    return deepFreeze({
      delivered: true,
      results: deepFreeze(clone(simulation.results)),
      inventory: deepFreeze(inv.describeInventory?.(recipient) || {}),
    });
  }

  function mergeKnowledgeFromItems(compendium, sourceUnitId, items, options = {}) {
    const k = knowledge();
    if (!compendium || !k?.materializedLootFacts || !k?.mergeFacts) return compendium || null;
    const facts = k.materializedLootFacts(items, {
      discoveredBy: options.actorId,
      discoveredAt: options.now,
      visibility: options.visibility || "private",
    });
    return k.mergeFacts(compendium, sourceUnitId, facts, {
      visibility: options.visibility || "private",
      now: options.now,
    });
  }

  function commitActionRecovery(originalState, actionOutcome, recipient, unitTruth, options = {}) {
    if (!actionOutcome?.result?.recovery) throw new Error("POST_COMBAT_ACTION_OUTCOME_REQUIRED");
    const actorId = actionOutcome.result.actorId || options.actorId || null;
    const materialized = materializeRecovery(actionOutcome.result.recovery, unitTruth, {
      ...options,
      actorId,
    });

    if (!materialized.materialized) {
      return deepFreeze({
        committed: false,
        state: clone(originalState),
        reason: "materialization_failed",
        materialized,
      });
    }

    const currency = materialized.currency;
    const currencyAmount = Math.max(0, integer(currency?.amount, 0));
    const currencyHandler = options.currencyHandler || null;
    if (currencyAmount > 0 && (!currencyHandler?.preview || !currencyHandler?.commit)) {
      return deepFreeze({
        committed: false,
        state: clone(originalState),
        reason: "currency_delivery_handler_required",
        materialized,
      });
    }

    if (currencyAmount > 0) {
      const preview = currencyHandler.preview(currency, recipient, options);
      if (preview === false || preview?.accepted === false) {
        return deepFreeze({
          committed: false,
          state: clone(originalState),
          reason: preview?.reason || "currency_delivery_rejected",
          materialized,
        });
      }
    }

    const simulation = simulateDelivery(recipient, materialized, {
      ...options,
      ownerId: ownerIdOf(recipient, { ownerId: actorId || options.ownerId }),
    });

    if (!simulation.delivered) {
      return deepFreeze({
        committed: false,
        state: clone(originalState),
        reason: simulation.reason,
        materialized,
        delivery: deepFreeze(clone(simulation)),
      });
    }

    let currencyReceipt = null;
    if (currencyAmount > 0) {
      currencyReceipt = currencyHandler.commit(currency, recipient, options);
      if (currencyReceipt === false || currencyReceipt?.credited === false) {
        return deepFreeze({
          committed: false,
          state: clone(originalState),
          reason: currencyReceipt?.reason || "currency_delivery_failed",
          materialized,
        });
      }
    }

    commitInventoryClone(recipient, simulation.simulated);
    const inv = inventory();
    const delivery = deepFreeze({
      delivered: true,
      results: deepFreeze(clone(simulation.results)),
      inventory: deepFreeze(inv.describeInventory?.(recipient) || {}),
    });

    const compendium = mergeKnowledgeFromItems(
      options.compendium || actionOutcome.result.knowledge?.compendium || null,
      originalState.sourceUnitId,
      materialized.items,
      { ...options, actorId },
    );

    return deepFreeze({
      committed: true,
      state: clone(actionOutcome.state),
      materialized,
      delivery,
      compendium: compendium ? clone(compendium) : null,
      currency: materialized.currency,
      currencyReceipt: currencyReceipt ? clone(currencyReceipt) : null,
    });
  }

  function performAndDeliver(state, actor, actionId, recipient, unitTruth, options = {}) {
    const pc = postCombat();
    if (!pc?.performAction) throw new Error("LOOT_POST_COMBAT_RUNTIME_REQUIRED");
    const outcome = pc.performAction(state, actor, actionId, options);
    return commitActionRecovery(state, outcome, recipient, unitTruth, options);
  }

  async function performAndDeliverWithCoinEngine(state, actor, actionId, recipient, unitTruth, options = {}) {
    const pc = postCombat();
    if (!pc?.performActionWithCoinEngine) throw new Error("LOOT_POST_COMBAT_RUNTIME_REQUIRED");
    const outcome = await pc.performActionWithCoinEngine(state, actor, actionId, options);
    return commitActionRecovery(state, outcome, recipient, unitTruth, options);
  }

  const API = Object.freeze({
    VERSION,
    ACQUISITION_METHODS,
    CATALOGS,
    normalizeId,
    creatureTypeOf,
    lineageOf,
    mappingForResource,
    catalogFor,
    definitionFor,
    qualityTierFor,
    conditionFor,
    commonHarvestOptions,
    harvestVariant,
    deterministicInstanceId,
    definitionSummary,
    stampAcquisition,
    materializeResource,
    materializeRecovery,
    ownerIdOf,
    destinations,
    insertFully,
    simulateDelivery,
    deliverAtomic,
    mergeKnowledgeFromItems,
    commitActionRecovery,
    performAndDeliver,
    performAndDeliverWithCoinEngine,
  });

  global.LuminousLootRecoveryMaterializer = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
