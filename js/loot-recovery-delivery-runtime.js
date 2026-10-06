(function (global) {
  "use strict";

  if (global.LuminousLootRecoveryDeliveryRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootRecoveryDeliveryRuntime;
    return;
  }

  const VERSION = 1;

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const inventory = () => global.LuminousItemInventoryRuntime || safeRequire("./item-inventory-runtime.js");
  const postCombat = () => global.LuminousLootPostCombatRuntime || safeRequire("./loot-postcombat-runtime.js");
  const qualityEngine = () => global.LuminousItemQualityEngine || safeRequire("./item-quality-engine.js");
  const lootInstances = () => global.LuminousLootInstanceRuntime || safeRequire("./loot-instance-runtime.js");

  const CATALOGS = Object.freeze({
    meat: () => global.LuminousMeatCatalog || safeRequire("./item-catalog-meat.js"),
    hide_pelt: () => global.LuminousHidePeltCatalog || safeRequire("./item-catalog-hide-pelt.js"),
    hard_parts: () => global.LuminousHardPartsCatalog || safeRequire("./item-catalog-hard-parts.js"),
    scale_shell_chitin: () => global.LuminousScaleShellChitinCatalog || safeRequire("./item-catalog-scale-shell-chitin.js"),
    organ_gland: () => global.LuminousOrganGlandCatalog || safeRequire("./item-catalog-organ-gland.js"),
    blood_ichor: () => global.LuminousBloodIchorCatalog || safeRequire("./item-catalog-blood-ichor.js"),
    venom_secretion: () => global.LuminousVenomSecretionCatalog || safeRequire("./item-catalog-venom-secretion.js"),
    ooze_gel: () => global.LuminousOozeGelCatalog || safeRequire("./item-catalog-ooze-gel.js"),
    feather_raw_fiber: () => global.LuminousFeatherRawFiberCatalog || safeRequire("./item-catalog-feather-raw-fiber.js"),
    raw_salvage: () => global.LuminousRawSalvageCatalog || safeRequire("./item-catalog-salvage-raw.js"),
  });

  const FAMILY_ALIASES = Object.freeze({
    hard_cover_modular: "scale_shell_chitin",
    hard_cover_structural: "scale_shell_chitin",
    feather_raw: "feather_raw_fiber",
    raw_fiber: "feather_raw_fiber",
    organ_internal: "organ_gland",
    organ_sensory: "organ_gland",
    organ_brain: "organ_gland",
    venom_secretion: "venom_secretion",
    blood_ichor: "blood_ichor",
    ooze_gel: "ooze_gel",
    meat: "meat",
    hide_pelt: "hide_pelt",
    hard_parts: "hard_parts",
    raw_salvage: "raw_salvage",
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
  function int(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function catalogFamily(recovery = {}) {
    const authored = normalizeId(recovery.catalogFamily);
    return FAMILY_ALIASES[authored] || authored || FAMILY_ALIASES[normalizeId(recovery.integrityFamily)] || normalizeId(recovery.integrityFamily);
  }
  function catalogFor(recovery = {}) {
    const family = catalogFamily(recovery);
    return CATALOGS[family]?.() || null;
  }

  function integrityQualityCap(recovery = {}) {
    const integrity = recovery.integrity || {};
    if (integrity.destroyed === true || Number(integrity.integrityPercent) <= 10) return "ruined";
    if (integrity.contaminated === true) return "poor";
    const pct = Number(integrity.integrityPercent);
    if (!Number.isFinite(pct)) return "exceptional";
    if (pct < 50) return "poor";
    if (pct < 80) return "standard";
    if (pct < 95) return "fine";
    return "exceptional";
  }

  function qualityForRecovery(recovery = {}, check = {}) {
    const engine = qualityEngine();
    const order = engine?.QUALITY_ORDER || ["ruined", "poor", "standard", "fine", "exceptional"];
    const skillQuality = engine?.resolveQualityFromMargin
      ? engine.resolveQualityFromMargin(Number(check.margin) || 0).id
      : "standard";
    const cap = integrityQualityCap(recovery);
    const skillIndex = Math.max(0, order.indexOf(skillQuality));
    const capIndex = Math.max(0, order.indexOf(cap));
    return order[Math.min(skillIndex, capIndex)] || "standard";
  }

  function qualityTier(quality) {
    const order = qualityEngine()?.QUALITY_ORDER || ["ruined", "poor", "standard", "fine", "exceptional"];
    const index = order.indexOf(normalizeId(quality));
    return index >= 0 ? index + 1 : 3;
  }

  function lineageOptions(recovery = {}, options = {}) {
    const sourceUnitId = normalizeId(recovery.provenance?.sourceUnitId || options.sourceUnitId);
    return {
      lineageId: normalizeId(recovery.lineageId || options.lineageId || sourceUnitId || "unknown"),
      lineageName: String(recovery.lineageName || options.lineageName || options.sourceUnitName || sourceUnitId || "Unknown").trim(),
      creatureSize: normalizeId(recovery.sizeClass || options.creatureSize || "medium"),
      size: normalizeId(recovery.sizeClass || options.creatureSize || "medium"),
      partSize: normalizeId(options.partSize || recovery.partSize || "medium"),
      originCreatureType: normalizeId(options.originCreatureType || options.species),
      originCreatureId: sourceUnitId || null,
      originRaceId: normalizeId(options.originRaceId || options.species) || null,
      originSubtypeId: normalizeId(options.originSubtypeId) || null,
      sourceEntityId: recovery.provenance?.corpseId || options.corpseId || null,
    };
  }

  function createVariant(recovery = {}, check = {}, options = {}) {
    const catalog = catalogFor(recovery);
    const itemId = normalizeId(recovery.itemId);
    if (!catalog || !itemId) return null;
    const quality = qualityForRecovery(recovery, check);
    const lineage = lineageOptions(recovery, options);
    const common = {
      ...lineage,
      quality,
      quantity: Math.max(1, int(recovery.quantity, 1)),
      integritySnapshot: clone(recovery.integrity || null),
      anatomicalIdentity: normalizeId(recovery.anatomicalIdentity || recovery.resourceId),
      anatomicalPart: normalizeId(recovery.anatomicalIdentity || recovery.resourceId),
      sourceInstanceId: recovery.provenance?.lootInstanceId || recovery.provenance?.corpseId || null,
    };

    const family = catalogFamily(recovery);
    if (family === "meat" && catalog.createHarvestStack) return catalog.createHarvestStack(itemId, common);
    if (family === "hide_pelt" && catalog.createHarvestStack) return catalog.createHarvestStack(itemId, common);
    if (family === "hard_parts" && catalog.createHarvestPart) return catalog.createHarvestPart(itemId, common);
    if (family === "scale_shell_chitin" && catalog.createHarvestPart) return catalog.createHarvestPart(itemId, common);
    if (family === "organ_gland" && catalog.createHarvestPart) return catalog.createHarvestPart(itemId, common);
    if (family === "blood_ichor" && catalog.createHarvestStack) return catalog.createHarvestStack(itemId, { ...common, bloodUnits: common.quantity });
    if (family === "venom_secretion" && catalog.createHarvestStack) return catalog.createHarvestStack(itemId, { ...common, secretionUnits: common.quantity });
    if (family === "ooze_gel" && catalog.createHarvestStack) return catalog.createHarvestStack(itemId, { ...common, oozeUnits: common.quantity });
    if (family === "feather_raw_fiber" && catalog.createHarvestStack) return catalog.createHarvestStack(itemId, common);
    return { itemId, quantity: common.quantity, quality, ...lineage, integritySnapshot: common.integritySnapshot };
  }

  function deterministicInstanceId(recovery = {}, actionId = "harvest", actorId = "") {
    const hash = lootInstances()?.hashHex;
    const source = [
      recovery.provenance?.lootInstanceId,
      recovery.provenance?.corpseId,
      recovery.resourceId,
      recovery.itemId,
      recovery.provenance?.acquisitionMethod || actionId,
      recovery.provenance?.acquiredByActorId || actorId,
      recovery.quantity,
    ].join("|");
    return `harvest_${typeof hash === "function" ? hash(source) : normalizeId(source).slice(0, 48)}_${normalizeId(recovery.itemId || recovery.resourceId)}`;
  }

  function materializeResourceRecovery(recovery = {}, check = {}, options = {}) {
    const inv = inventory();
    if (!inv?.createItemInstance) throw new Error("ITEM_INVENTORY_RUNTIME_REQUIRED");
    const catalog = catalogFor(recovery);
    const itemId = normalizeId(recovery.itemId);
    if (!catalog || !itemId) {
      return deepFreeze({ materialized: false, reason: "HARVEST_ITEM_MAPPING_REQUIRED", recovery: clone(recovery) });
    }
    const definition = catalog.get?.(itemId);
    if (!definition) {
      return deepFreeze({ materialized: false, reason: `HARVEST_ITEM_DEFINITION_NOT_FOUND:${itemId}`, recovery: clone(recovery) });
    }
    const variant = createVariant(recovery, check, options) || {};
    const quality = normalizeId(variant.quality || qualityForRecovery(recovery, check));
    const measurementQuantity = Number(
      variant.bloodUnits ?? variant.secretionUnits ?? variant.oozeUnits ?? variant.fiberUnits ?? variant.quantity ?? recovery.quantity
    );
    if (!(measurementQuantity > 0)) {
      return deepFreeze({ materialized: false, reason: "HARVEST_ZERO_RECOVERABLE_QUANTITY", recovery: clone(recovery) });
    }

    const condition = Math.max(0, Math.min(100, Number(recovery.integrity?.integrityPercent ?? 100) || 0));
    const provenance = {
      ...clone(recovery.provenance || {}),
      acquisitionMethod: normalizeId(recovery.provenance?.acquisitionMethod || options.actionId || "harvest"),
      harvestResourceId: normalizeId(recovery.resourceId),
      harvestItemId: itemId,
      harvestCatalogFamily: catalogFamily(recovery),
      integrityStatus: normalizeId(recovery.integrity?.status),
      integrityPercent: condition,
      culinarySource: recovery.culinary === true,
      knownUses: clone(recovery.knownUses || []),
    };

    const quantity = Math.max(1, int(variant.quantity ?? (variant.bloodUnits || variant.secretionUnits || variant.oozeUnits || variant.fiberUnits ? 1 : recovery.quantity), 1));
    const instance = inv.createItemInstance(definition, {
      instanceId: deterministicInstanceId(recovery, provenance.acquisitionMethod, provenance.acquiredByActorId),
      quantity,
      qualityTier: qualityTier(quality),
      condition,
      currentOwnerId: null,
      provenance,
      customData: {
        harvest: {
          resourceId: normalizeId(recovery.resourceId),
          integrityFamily: normalizeId(recovery.integrityFamily),
          sourceMaterial: normalizeId(recovery.sourceMaterial),
          itemId,
          catalogFamily: catalogFamily(recovery),
          quality,
          valuable: recovery.valuable === true,
          culinary: recovery.culinary === true,
          knownUses: clone(recovery.knownUses || []),
          integrity: clone(recovery.integrity || null),
        },
        culinaryProvenance: recovery.culinary === true ? {
          sourceUnitId: provenance.sourceUnitId || null,
          sourceUnitInstanceId: provenance.sourceUnitInstanceId || null,
          corpseId: provenance.corpseId || null,
          encounterId: provenance.encounterId || null,
          acquisitionMethod: provenance.acquisitionMethod,
          lineageId: variant.lineageId || null,
          lineageName: variant.lineageName || null,
          integrityStatus: provenance.integrityStatus || null,
          integrityPercent: provenance.integrityPercent,
          sourceResourceId: normalizeId(recovery.resourceId),
        } : null,
      },
      ...variant,
      quantity,
      quality,
      provenance,
    });

    return deepFreeze({
      materialized: true,
      item: deepFreeze(instance),
      definition: deepFreeze(clone(definition)),
      variant: deepFreeze(clone(variant)),
      recovery: deepFreeze(clone(recovery)),
    });
  }

  function materializeRecovery(result = {}, options = {}) {
    const items = [];
    const unresolved = [];
    for (const item of result.recovery?.items || []) items.push(deepFreeze(clone(item)));
    for (const resource of result.recovery?.resources || []) {
      const materialized = materializeResourceRecovery(resource, result.check || {}, {
        ...options,
        actionId: result.actionId,
      });
      if (materialized.materialized) items.push(materialized.item);
      else unresolved.push(materialized);
    }
    return deepFreeze({
      items: deepFreeze(items),
      unresolved: deepFreeze(unresolved),
      currency: result.recovery?.currency ? deepFreeze(clone(result.recovery.currency)) : null,
    });
  }

  function ownerId(unit = {}, options = {}) {
    return String(options.ownerId ?? unit.playerId ?? unit.uid ?? unit.actorId ?? unit.combatId ?? unit.instanceId ?? unit.id ?? "").trim();
  }

  function insertOne(unit, rawItem, options = {}) {
    const inv = inventory();
    const item = clone(rawItem);
    const ownerIdValue = ownerId(unit, options);
    if (ownerIdValue) inv.transferOwnership?.(item, ownerIdValue);

    const preferred = normalizeId(options.preferredContainer || "stash") === "active" ? "active" : "stash";
    const fallback = normalizeId(options.fallbackContainer || (preferred === "stash" ? "active" : "stash"));
    const originalQuantity = Math.max(1, int(item.quantity, 1));

    const first = inv.insertItem(unit, item, preferred, options);
    let inserted = Number(first.quantity || 0);
    const receipts = [{ container: preferred, ...clone(first) }];

    if (inserted < originalQuantity && fallback && fallback !== preferred) {
      const remaining = originalQuantity - inserted;
      const remainder = clone(item);
      remainder.quantity = remaining;
      remainder.instanceId = inv.createInstanceId?.(remainder.definitionId || "item") || `${remainder.instanceId}_remainder`;
      const second = inv.insertItem(unit, remainder, fallback, options);
      inserted += Number(second.quantity || 0);
      receipts.push({ container: fallback, ...clone(second) });
    }

    return {
      inserted: inserted === originalQuantity,
      insertedQuantity: inserted,
      requestedQuantity: originalQuantity,
      receipts,
      item: clone(item),
      reason: inserted === originalQuantity ? null : (receipts.at(-1)?.reason || "inventory_capacity_exceeded"),
    };
  }

  function insertBatchAtomic(recipient = {}, items = [], options = {}) {
    const working = clone(recipient);
    const receipts = [];
    for (const item of items || []) {
      const result = insertOne(working, item, options);
      receipts.push(result);
      if (!result.inserted) {
        return deepFreeze({
          inserted: false,
          recipient: deepFreeze(clone(recipient)),
          receipts: deepFreeze(receipts),
          reason: result.reason || "inventory_capacity_exceeded",
        });
      }
    }
    return deepFreeze({
      inserted: true,
      recipient: deepFreeze(working),
      receipts: deepFreeze(receipts),
      reason: null,
    });
  }

  function currencyAmount(materialized = {}) {
    return Math.max(0, int(materialized.currency?.amount, 0));
  }

  function previewCurrency(materialized = {}, recipientUnit = {}, options = {}) {
    const amount = currencyAmount(materialized);
    if (amount <= 0) return deepFreeze({ accepted: true, amount: 0, reason: null });
    const handler = options.currencyHandler;
    if (!handler?.preview || !handler?.commit) {
      return deepFreeze({ accepted: false, amount, reason: "currency_delivery_handler_required" });
    }
    const result = handler.preview(materialized.currency, recipientUnit, options);
    if (result === false || result?.accepted === false) {
      return deepFreeze({ accepted: false, amount, reason: result?.reason || "currency_delivery_rejected" });
    }
    return deepFreeze({ accepted: true, amount, reason: null, preview: clone(result || null) });
  }

  function commitCurrency(materialized = {}, recipientUnit = {}, options = {}) {
    const amount = currencyAmount(materialized);
    if (amount <= 0) return deepFreeze({ credited: true, amount: 0, receipt: null, recipientUnit: deepFreeze(clone(recipientUnit)) });
    const handler = options.currencyHandler;
    if (!handler?.commit) return deepFreeze({ credited: false, amount, reason: "currency_delivery_handler_required", recipientUnit: deepFreeze(clone(recipientUnit)) });
    const working = clone(recipientUnit);
    const receipt = handler.commit(materialized.currency, working, options);
    if (receipt === false || receipt?.credited === false) {
      return deepFreeze({ credited: false, amount, reason: receipt?.reason || "currency_delivery_failed", receipt: clone(receipt || null), recipientUnit: deepFreeze(clone(recipientUnit)) });
    }
    return deepFreeze({ credited: true, amount, receipt: clone(receipt || null), recipientUnit: deepFreeze(working) });
  }

  function pendingDeliveryId(state = {}, result = {}) {
    const hash = lootInstances()?.hashHex;
    const source = [
      state.lootInstanceId,
      result.actorId,
      result.actionId,
      result.attempt?.key,
      result.attempt?.total,
      state.revision,
    ].join("|");
    return `pending_${typeof hash === "function" ? hash(source) : normalizeId(source).slice(0, 48)}`;
  }

  function addPendingDelivery(state = {}, result = {}, materialized = {}, reason = "inventory_capacity_exceeded") {
    const next = clone(state);
    if (!Array.isArray(next.pendingDeliveries)) next.pendingDeliveries = [];
    const delivery = {
      id: pendingDeliveryId(state, result),
      actorId: result.actorId,
      actionId: result.actionId,
      reason,
      items: clone(materialized.items || []),
      currency: clone(materialized.currency || null),
      createdAt: null,
    };
    next.pendingDeliveries.push(delivery);
    return deepFreeze({ state: deepFreeze(next), delivery: deepFreeze(delivery) });
  }

  function performAndDeliver(state = {}, actor = {}, actionId, options = {}) {
    const runtime = postCombat();
    if (!runtime?.performAction) throw new Error("LOOT_POSTCOMBAT_RUNTIME_REQUIRED");
    if (!options.recipientUnit) throw new Error("LOOT_RECIPIENT_UNIT_REQUIRED");

    const provisional = runtime.performAction(state, actor, actionId, options);
    const materialized = materializeRecovery(provisional.result, options);
    if (materialized.unresolved.length) {
      return deepFreeze({
        committed: false,
        reason: materialized.unresolved[0].reason,
        state: deepFreeze(clone(state)),
        recipientUnit: deepFreeze(clone(options.recipientUnit)),
        result: provisional.result,
        materialized,
      });
    }

    const currencyPreview = previewCurrency(materialized, options.recipientUnit, options);
    if (!currencyPreview.accepted) {
      const pending = addPendingDelivery(provisional.state, provisional.result, materialized, currencyPreview.reason);
      return deepFreeze({
        committed: true, delivered: false, pending: pending.delivery, reason: currencyPreview.reason,
        state: pending.state, recipientUnit: deepFreeze(clone(options.recipientUnit)),
        result: provisional.result, materialized, delivery: null,
      });
    }

    const delivery = insertBatchAtomic(options.recipientUnit, materialized.items, options);
    if (!delivery.inserted) {
      const pending = addPendingDelivery(provisional.state, provisional.result, materialized, delivery.reason);
      return deepFreeze({
        committed: true, delivered: false, pending: pending.delivery, reason: delivery.reason,
        state: pending.state, recipientUnit: deepFreeze(clone(options.recipientUnit)),
        result: provisional.result, materialized, delivery,
      });
    }

    const currency = commitCurrency(materialized, delivery.recipient, options);
    if (!currency.credited) {
      const pending = addPendingDelivery(provisional.state, provisional.result, materialized, currency.reason);
      return deepFreeze({
        committed: true, delivered: false, pending: pending.delivery, reason: currency.reason,
        state: pending.state, recipientUnit: deepFreeze(clone(options.recipientUnit)),
        result: provisional.result, materialized, delivery: null,
      });
    }

    return deepFreeze({
      committed: true, delivered: true, pending: null, reason: null,
      state: provisional.state, recipientUnit: currency.recipientUnit,
      result: provisional.result, materialized, delivery, currencyReceipt: currency.receipt,
    });
  }

  async function performAndDeliverWithCoinEngine(state = {}, actor = {}, actionId, options = {}) {
    const runtime = postCombat();
    if (!runtime?.performActionWithCoinEngine) throw new Error("LOOT_POSTCOMBAT_RUNTIME_REQUIRED");
    if (!options.recipientUnit) throw new Error("LOOT_RECIPIENT_UNIT_REQUIRED");

    const provisional = await runtime.performActionWithCoinEngine(state, actor, actionId, options);
    const materialized = materializeRecovery(provisional.result, options);
    if (materialized.unresolved.length) {
      return deepFreeze({
        committed: false,
        reason: materialized.unresolved[0].reason,
        state: deepFreeze(clone(state)),
        recipientUnit: deepFreeze(clone(options.recipientUnit)),
        result: provisional.result,
        materialized,
      });
    }

    const currencyPreview = previewCurrency(materialized, options.recipientUnit, options);
    if (!currencyPreview.accepted) {
      const pending = addPendingDelivery(provisional.state, provisional.result, materialized, currencyPreview.reason);
      return deepFreeze({
        committed: true, delivered: false, pending: pending.delivery, reason: currencyPreview.reason,
        state: pending.state, recipientUnit: deepFreeze(clone(options.recipientUnit)),
        result: provisional.result, materialized, delivery: null,
      });
    }

    const delivery = insertBatchAtomic(options.recipientUnit, materialized.items, options);
    if (!delivery.inserted) {
      const pending = addPendingDelivery(provisional.state, provisional.result, materialized, delivery.reason);
      return deepFreeze({
        committed: true, delivered: false, pending: pending.delivery, reason: delivery.reason,
        state: pending.state, recipientUnit: deepFreeze(clone(options.recipientUnit)),
        result: provisional.result, materialized, delivery,
      });
    }

    const currency = commitCurrency(materialized, delivery.recipient, options);
    if (!currency.credited) {
      const pending = addPendingDelivery(provisional.state, provisional.result, materialized, currency.reason);
      return deepFreeze({
        committed: true, delivered: false, pending: pending.delivery, reason: currency.reason,
        state: pending.state, recipientUnit: deepFreeze(clone(options.recipientUnit)),
        result: provisional.result, materialized, delivery: null,
      });
    }

    return deepFreeze({
      committed: true, delivered: true, pending: null, reason: null,
      state: provisional.state, recipientUnit: currency.recipientUnit,
      result: provisional.result, materialized, delivery, currencyReceipt: currency.receipt,
    });
  }

  function claimPendingDelivery(state = {}, recipientUnit = {}, deliveryId, options = {}) {
    const next = clone(state);
    const list = Array.isArray(next.pendingDeliveries) ? next.pendingDeliveries : [];
    const index = list.findIndex((entry) => String(entry.id) === String(deliveryId));
    if (index < 0) return deepFreeze({ claimed: false, reason: "pending_delivery_not_found", state: deepFreeze(next), recipientUnit: deepFreeze(clone(recipientUnit)) });
    const pending = list[index];
    const materialized = { items: pending.items || [], currency: pending.currency || null };

    const currencyPreview = previewCurrency(materialized, recipientUnit, options);
    if (!currencyPreview.accepted) {
      return deepFreeze({ claimed: false, reason: currencyPreview.reason, state: deepFreeze(next), recipientUnit: deepFreeze(clone(recipientUnit)), pending: deepFreeze(clone(pending)) });
    }

    const delivery = insertBatchAtomic(recipientUnit, pending.items || [], options);
    if (!delivery.inserted) {
      return deepFreeze({ claimed: false, reason: delivery.reason, state: deepFreeze(next), recipientUnit: deepFreeze(clone(recipientUnit)), pending: deepFreeze(clone(pending)) });
    }

    const currency = commitCurrency(materialized, delivery.recipient, options);
    if (!currency.credited) {
      return deepFreeze({ claimed: false, reason: currency.reason, state: deepFreeze(next), recipientUnit: deepFreeze(clone(recipientUnit)), pending: deepFreeze(clone(pending)) });
    }

    next.pendingDeliveries.splice(index, 1);
    return deepFreeze({
      claimed: true, reason: null, state: deepFreeze(next),
      recipientUnit: currency.recipientUnit,
      currency: deepFreeze(clone(pending.currency || null)),
      currencyReceipt: currency.receipt,
      delivery,
    });
  }

  const API = Object.freeze({
    VERSION,
    CATALOGS,
    FAMILY_ALIASES,
    normalizeId,
    catalogFamily,
    catalogFor,
    integrityQualityCap,
    qualityForRecovery,
    qualityTier,
    lineageOptions,
    createVariant,
    deterministicInstanceId,
    materializeResourceRecovery,
    materializeRecovery,
    ownerId,
    insertOne,
    insertBatchAtomic,
    currencyAmount,
    previewCurrency,
    commitCurrency,
    pendingDeliveryId,
    addPendingDelivery,
    performAndDeliver,
    performAndDeliverWithCoinEngine,
    claimPendingDelivery,
  });

  global.LuminousLootRecoveryDeliveryRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
