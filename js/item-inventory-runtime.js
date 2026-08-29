(function (global) {
  "use strict";

  if (global.LuminousItemInventoryRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemInventoryRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  // Capture the original functional item runtime before this module extends
  // global.LuminousItemRuntime. Keeping this reference stable prevents a
  // missing-item lookup from delegating back into this same findItem().
  const baseRuntime = global.LuminousItemRuntime || safeRequire("./item-runtime-engine.js");
  const base = () => baseRuntime;
  const registry = () => global.LuminousContentRegistry || safeRequire("./content-registry.js");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const normalizeId = (value) => base()?.normalizeId?.(value) || String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  const SCHEMA_VERSION = 2;
  const DEFAULT_ACTIVE_SLOT_LIMIT = 10;
  const DEFAULT_ACTIVE_STACK_LIMIT = 2;
  const DEFAULT_STASH_STACK_LIMIT = 99;
  let instanceCounter = 0;

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function createInstanceId(prefix = "item") {
    instanceCounter += 1;
    const entropy = Math.random().toString(36).slice(2, 8);
    return `${normalizeId(prefix) || "item"}_${Date.now()}_${instanceCounter}_${entropy}`;
  }

  function definitionIdOf(item = {}) {
    return base()?.definitionId?.(item) || String(item.definitionId || item.definition_id || item.canonicalId || item.itemId || item.item_id || item.id || item.key || "").trim();
  }

  function itemIdOf(item = {}) {
    return base()?.itemId?.(item) || String(item.instanceId || item.instance_id || definitionIdOf(item) || item.key || "").trim();
  }

  function quantityOf(item = {}) {
    return base()?.quantityOf?.(item) ?? Math.max(0, intOr(item.quantity ?? item.qty ?? item.cantidad ?? item.stack ?? item.count, 1));
  }

  function setQuantity(item = {}, value) {
    if (base()?.setQuantity) return base().setQuantity(item, value);
    item.quantity = Math.max(0, intOr(value, 0));
    return item.quantity;
  }

  function resolveDefinition(ref, options = {}) {
    if (ref && typeof ref === "object" && !ref.instanceId && !ref.instance_id) return clone(ref);
    const id = typeof ref === "object" ? definitionIdOf(ref) : String(ref ?? "").trim();
    if (!id) return null;

    if (options.catalog) {
      if (Array.isArray(options.catalog)) {
        const found = options.catalog.find((entry) => definitionIdOf(entry) === id || entry?.canonicalId === id || entry?.id === id);
        if (found) return clone(found.definition || found);
      } else if (typeof options.catalog === "object") {
        const found = options.catalog[id];
        if (found) return clone(found.definition || found);
      }
    }

    const content = registry();
    if (content?.get) {
      const canonical = content.get(id) || content.get("item", id);
      if (canonical) return clone(canonical.definition || canonical);
    }
    return null;
  }

  function compactInstance(input = {}, definition = null, options = {}) {
    const def = definition || resolveDefinition(input, options) || {};
    const definitionId = definitionIdOf(input) || definitionIdOf(def) || String(options.definitionId || "").trim();
    const maxCondition = Math.max(0, numberOr(input.conditionMax ?? input.maxCondition ?? input.maxDurability ?? def.conditionMax ?? def.condition_max, 100));
    const currentCondition = clamp(numberOr(input.condition ?? input.currentCondition ?? input.durability, maxCondition), 0, maxCondition);
    const qualityTier = clamp(intOr(input.qualityTier ?? input.quality_tier ?? input.quality ?? options.qualityTier ?? options.quality, 1), 1, 5);
    const chargesMax = input.chargesMax ?? input.maxCharges ?? input.charges_max ?? def.chargesMax ?? def.maxCharges ?? null;
    const chargesCurrent = input.chargesCurrent ?? input.charges_current ?? input.charges ?? options.charges ?? chargesMax;

    return {
      schemaVersion: SCHEMA_VERSION,
      instanceId: String(input.instanceId || input.instance_id || options.instanceId || createInstanceId(definitionId || "item")),
      definitionId,
      quantity: Math.max(1, intOr(input.quantity ?? input.qty ?? input.cantidad ?? input.stack ?? input.count ?? options.quantity, 1)),
      qualityTier,
      conditionMax: maxCondition,
      condition: currentCondition,
      manufacturerId: input.manufacturerId ?? input.manufacturer_id ?? options.manufacturerId ?? null,
      currentOwnerId: input.currentOwnerId ?? input.current_owner_id ?? options.currentOwnerId ?? null,
      sellerId: input.sellerId ?? input.seller_id ?? options.sellerId ?? null,
      previousOwnerIds: clone(input.previousOwnerIds || input.previous_owner_ids || options.previousOwnerIds || []),
      productLineId: input.productLineId ?? input.product_line_id ?? options.productLineId ?? null,
      modelName: input.modelName ?? input.model_name ?? options.modelName ?? null,
      commissionName: input.commissionName ?? input.commission_name ?? options.commissionName ?? null,
      productSerial: input.productSerial ?? input.product_serial ?? options.productSerial ?? null,
      installedModuleIds: clone(input.installedModuleIds || input.installed_module_ids || options.installedModuleIds || []),
      installedModules: clone(input.installedModules || options.installedModules || []),
      signatureTechnologyIds: clone(input.signatureTechnologyIds || input.signature_technology_ids || options.signatureTechnologyIds || []),
      signatureComponents: clone(input.signatureComponents || input.signature_components || options.signatureComponents || []),
      chargesCurrent: chargesCurrent == null ? null : Math.max(0, intOr(chargesCurrent, 0)),
      chargesMax: chargesMax == null ? null : Math.max(0, intOr(chargesMax, 0)),
      rechargeRule: input.rechargeRule ?? input.recharge_rule ?? def.rechargeRule ?? def.recharge_rule ?? null,
      stolen: input.stolen === true || options.stolen === true,
      originMarketId: input.originMarketId ?? input.origin_market_id ?? options.originMarketId ?? null,
      equipped: input.equipped === true,
      equippedPartIds: clone(input.equippedPartIds || input.assignedBodyParts || []),
      runtimeState: clone(input.runtimeState || input.runtime_state || {}),
      customData: clone(input.customData || input.custom_data || {}),
    };
  }

  function createItemInstance(definitionOrId, options = {}) {
    const definition = resolveDefinition(definitionOrId, options) || (typeof definitionOrId === "object" ? clone(definitionOrId) : { id: definitionOrId, definitionId: definitionOrId });
    const instance = compactInstance({ ...options, definitionId: definitionIdOf(definition) || String(definitionOrId || "") }, definition, options);
    emit("luminous:item-instance-created", { instance: clone(instance), definition: clone(definition) });
    return instance;
  }

  function serializeItemInstance(instance) {
    return compactInstance(instance || {}, null, {});
  }

  function deserializeItemInstance(data, options = {}) {
    return compactInstance(data || {}, resolveDefinition(data, options), options);
  }

  function hydrateItemInstance(instance, options = {}) {
    if (!instance || typeof instance !== "object") return null;
    const definition = resolveDefinition(instance, options) || {};
    const compact = compactInstance(instance, definition, options);
    const hydrated = { ...clone(definition), ...clone(compact) };
    hydrated.quality = compact.qualityTier;
    hydrated.charges = compact.chargesCurrent;
    if (!hydrated.nombre && hydrated.name) hydrated.nombre = hydrated.name;
    if (!hydrated.name && hydrated.nombre) hydrated.name = hydrated.nombre;
    return base()?.hydrateForEquipment?.(hydrated) || hydrated;
  }

  function getRawWorkshopName(manufacturer, options = {}) {
    if (!manufacturer) return null;
    if (typeof manufacturer === "object") return String(manufacturer.workshopName || manufacturer.name || manufacturer.nombre || "").trim() || null;
    const id = String(manufacturer);
    const source = options.workshops || options.workshopCatalog || global.LuminousWorkshopRuntime;
    if (source?.getWorkshop) {
      const found = source.getWorkshop(id);
      return found ? getRawWorkshopName(found, options) : null;
    }
    if (source && typeof source === "object" && source[id]) return getRawWorkshopName(source[id], options);
    return id;
  }

  function getProductLineName(item = {}, options = {}) {
    if (item.productLineName) return String(item.productLineName);
    if (options.productLineName) return String(options.productLineName);
    const lineId = item.productLineId || item.product_line_id;
    if (!lineId) return null;
    const source = options.workshops || options.workshopCatalog || global.LuminousWorkshopRuntime;
    const workshop = source?.getWorkshop?.(item.manufacturerId) || (source && typeof source === "object" ? source[item.manufacturerId] : null);
    const line = asArray(workshop?.productLines).find((entry) => String(entry?.productLineId || entry?.id || "") === String(lineId));
    return line?.productLineName || line?.name || null;
  }

  function formatWorkshopProductName(item, options = {}) {
    const hydrated = hydrateItemInstance(item, options) || item || {};
    const manufacturerRaw = getRawWorkshopName(hydrated.manufacturerId, options);
    const baseName = String(hydrated.baseItemName || hydrated.displayName || hydrated.name || hydrated.nombre || definitionIdOf(hydrated) || "Item").trim();
    if (!manufacturerRaw) return baseName;
    const cleanWorkshopName = manufacturerRaw.replace(/\s+Workshop$/i, "").trim();
    let display = `${cleanWorkshopName} Workshop ${baseName}`;
    const productLineName = getProductLineName(hydrated, options);
    if (productLineName) display += ` — ${productLineName}`;
    const commissionName = hydrated.commissionName || hydrated.modelName || null;
    if (commissionName) display += ` “${commissionName}”`;
    return display;
  }

  function resolveItem(instance, options = {}) {
    const hydrated = hydrateItemInstance(instance, options);
    if (!hydrated) return null;
    hydrated.displayName = hydrated.manufacturerId
      ? formatWorkshopProductName(hydrated, options)
      : String(hydrated.displayName || hydrated.name || hydrated.nombre || hydrated.definitionId || "Item");
    hydrated.conditionState = getConditionState(hydrated);
    return hydrated;
  }

  function activeContainer(unit = {}, create = false) {
    const candidates = ["inventario_activo", "activeInventory", "inventory", "inventario"];
    for (const key of candidates) if (unit[key] && typeof unit[key] === "object") return { key, value: unit[key] };
    if (!create) return { key: "inventario_activo", value: null };
    unit.inventario_activo = {};
    return { key: "inventario_activo", value: unit.inventario_activo };
  }

  function stashContainer(unit = {}, create = false) {
    const candidates = ["inventario_stash", "stashInventory", "stash"];
    for (const key of candidates) if (unit[key] && typeof unit[key] === "object") return { key, value: unit[key] };
    if (!create) return { key: "inventario_stash", value: null };
    unit.inventario_stash = {};
    return { key: "inventario_stash", value: unit.inventario_stash };
  }

  function objectEntries(container) {
    if (Array.isArray(container)) return container.map((item, index) => [String(index), item]);
    return container && typeof container === "object" ? Object.entries(container) : [];
  }

  function findInContainer(container, ref) {
    const wanted = String(typeof ref === "object" ? itemIdOf(ref) : ref ?? "").trim();
    if (!wanted) return null;
    for (const [key, item] of objectEntries(container)) {
      if (!item || typeof item !== "object") continue;
      const ids = [key, itemIdOf(item), definitionIdOf(item), item.id, item.key, item.itemId, item.canonicalId].map((value) => String(value ?? "").trim()).filter(Boolean);
      if (ids.includes(wanted)) return { key, item };
    }
    return null;
  }

  function findItem(unit, ref, options = {}) {
    if (ref && typeof ref === "object") return ref;
    const preferred = normalizeId(options.container || "");
    const order = preferred === "stash"
      ? [stashContainer(unit).value, activeContainer(unit).value, unit.equipment]
      : [activeContainer(unit).value, stashContainer(unit).value, unit.equipment];
    for (const container of order.filter(Boolean)) {
      const found = findInContainer(container, ref);
      if (found) return found.item;
    }
    return base()?.findItem?.(unit, ref) || null;
  }

  function containerCount(container) {
    return objectEntries(container).filter(([, item]) => item && quantityOf(item) > 0).length;
  }

  function activeSlotLimit(unit = {}) {
    return Math.max(0, intOr(unit.activeSlotLimit ?? unit.inventoryRules?.activeSlotLimit, DEFAULT_ACTIVE_SLOT_LIMIT));
  }

  function stackLimit(item, containerType = "active") {
    const type = normalizeId(containerType);
    if (type === "stash") return Math.max(1, intOr(item?.stashStackLimit ?? item?.limite_alijo, DEFAULT_STASH_STACK_LIMIT));
    return Math.max(1, intOr(item?.activeStackLimit ?? item?.limite_activo, DEFAULT_ACTIVE_STACK_LIMIT));
  }

  function stackSignature(item = {}) {
    return JSON.stringify({
      definitionId: definitionIdOf(item),
      qualityTier: intOr(item.qualityTier ?? item.quality, 1),
      condition: numberOr(item.condition, 100),
      conditionMax: numberOr(item.conditionMax, 100),
      manufacturerId: item.manufacturerId || null,
      productLineId: item.productLineId || null,
      modelName: item.modelName || null,
      commissionName: item.commissionName || null,
      installedModuleIds: asArray(item.installedModuleIds).map(String).sort(),
      signatureTechnologyIds: asArray(item.signatureTechnologyIds).map(String).sort(),
      chargesCurrent: item.chargesCurrent ?? item.charges ?? null,
      chargesMax: item.chargesMax ?? null,
      stolen: item.stolen === true,
    });
  }

  function canStack(a, b) {
    if (!a || !b) return false;
    if (a.equipped || b.equipped) return false;
    return stackSignature(a) === stackSignature(b);
  }

  function insertIntoContainer(container, item, containerType, options = {}) {
    const limit = stackLimit(item, containerType);
    let remaining = quantityOf(item);
    const insertedKeys = [];

    for (const [key, existing] of objectEntries(container)) {
      if (remaining <= 0) break;
      if (!canStack(existing, item)) continue;
      const available = Math.max(0, limit - quantityOf(existing));
      if (!available) continue;
      const moved = Math.min(available, remaining);
      setQuantity(existing, quantityOf(existing) + moved);
      remaining -= moved;
      insertedKeys.push(key);
    }

    while (remaining > 0) {
      if (normalizeId(containerType) === "active" && containerCount(container) >= (options.activeSlotLimit ?? DEFAULT_ACTIVE_SLOT_LIMIT)) {
        return { inserted: false, partial: remaining !== quantityOf(item), reason: "active_inventory_full", remaining, insertedKeys };
      }
      const moved = Math.min(limit, remaining);
      const copy = clone(item);
      copy.instanceId = remaining === quantityOf(item) ? item.instanceId : createInstanceId(definitionIdOf(item));
      setQuantity(copy, moved);
      if (Array.isArray(container)) {
        container.push(copy);
        insertedKeys.push(String(container.length - 1));
      } else {
        const key = copy.instanceId || createInstanceId(definitionIdOf(copy));
        copy.instanceId = key;
        container[key] = copy;
        insertedKeys.push(key);
      }
      remaining -= moved;
    }
    return { inserted: true, remaining: 0, insertedKeys };
  }

  function deleteFromContainer(container, key) {
    if (Array.isArray(container)) {
      const index = intOr(key, -1);
      if (index >= 0 && index < container.length) container.splice(index, 1);
    } else if (container && typeof container === "object") delete container[key];
  }

  function moveItem(unit, ref, fromType, toType, amount = null, options = {}) {
    const from = normalizeId(fromType) === "stash" ? stashContainer(unit, true) : activeContainer(unit, true);
    const to = normalizeId(toType) === "stash" ? stashContainer(unit, true) : activeContainer(unit, true);
    const found = findInContainer(from.value, ref);
    if (!found) return { moved: false, reason: "item_not_found_in_source", from: from.key, to: to.key };

    const before = quantityOf(found.item);
    const requested = amount == null ? before : Math.max(1, intOr(amount, 1));
    const movedQty = Math.min(before, requested);
    const moving = clone(found.item);
    if (movedQty < before) moving.instanceId = createInstanceId(definitionIdOf(moving));
    setQuantity(moving, movedQty);

    const result = insertIntoContainer(to.value, moving, toType, { activeSlotLimit: activeSlotLimit(unit), ...options });
    const actuallyMoved = movedQty - Math.max(0, result.remaining || 0);
    if (actuallyMoved <= 0) return { moved: false, reason: result.reason || "target_rejected_item", from: from.key, to: to.key };

    setQuantity(found.item, before - actuallyMoved);
    if (quantityOf(found.item) <= 0) deleteFromContainer(from.value, found.key);
    const output = { moved: true, amount: actuallyMoved, from: from.key, to: to.key, instanceId: itemIdOf(moving), partial: actuallyMoved < requested, reason: result.reason || null };
    emit("luminous:item-moved", { unit, ...output });
    return output;
  }

  function moveToActive(unit, ref, amount, options = {}) { return moveItem(unit, ref, "stash", "active", amount, options); }
  function moveToStash(unit, ref, amount, options = {}) { return moveItem(unit, ref, "active", "stash", amount, options); }

  function splitStack(unit, ref, amount, options = {}) {
    const container = normalizeId(options.container) === "stash" ? stashContainer(unit, true) : activeContainer(unit, true);
    const found = findInContainer(container.value, ref);
    if (!found) return { split: false, reason: "item_not_found" };
    const before = quantityOf(found.item);
    const qty = Math.max(1, intOr(amount, 1));
    if (qty >= before) return { split: false, reason: "split_amount_must_be_less_than_stack" };
    const created = clone(found.item);
    created.instanceId = createInstanceId(definitionIdOf(created));
    setQuantity(created, qty);
    setQuantity(found.item, before - qty);
    if (Array.isArray(container.value)) container.value.push(created);
    else container.value[created.instanceId] = created;
    return { split: true, source: found.item, created };
  }

  function mergeStacks(unit, sourceRef, targetRef, options = {}) {
    const container = normalizeId(options.container) === "stash" ? stashContainer(unit, true) : activeContainer(unit, true);
    const source = findInContainer(container.value, sourceRef);
    const target = findInContainer(container.value, targetRef);
    if (!source || !target) return { merged: false, reason: "stack_not_found" };
    if (source.key === target.key) return { merged: false, reason: "same_stack" };
    if (!canStack(source.item, target.item)) return { merged: false, reason: "stack_incompatible" };
    const limit = stackLimit(target.item, options.container || "active");
    const room = Math.max(0, limit - quantityOf(target.item));
    if (!room) return { merged: false, reason: "target_stack_full" };
    const moved = Math.min(room, quantityOf(source.item));
    setQuantity(target.item, quantityOf(target.item) + moved);
    setQuantity(source.item, quantityOf(source.item) - moved);
    if (quantityOf(source.item) <= 0) deleteFromContainer(container.value, source.key);
    return { merged: true, amount: moved, source: source.item, target: target.item };
  }

  function getCondition(item = {}) {
    const max = Math.max(0, numberOr(item.conditionMax ?? item.maxCondition ?? item.maxDurability, 100));
    return { current: clamp(numberOr(item.condition ?? item.currentCondition ?? item.durability, max), 0, max), max };
  }

  function getConditionState(item = {}) {
    const state = getCondition(item);
    const pct = state.max > 0 ? (state.current / state.max) * 100 : 0;
    const id = pct <= 0 ? "broken" : pct <= 25 ? "critical" : pct <= 50 ? "damaged" : pct <= 75 ? "worn" : "good";
    return { ...state, percent: pct, id };
  }

  function damageCondition(item, amount) {
    if (!item || typeof item !== "object") return { changed: false, reason: "missing_item" };
    const state = getCondition(item);
    const after = clamp(state.current - Math.max(0, numberOr(amount, 0)), 0, state.max);
    item.condition = after;
    const result = { changed: after !== state.current, before: state.current, after, max: state.max, state: getConditionState(item) };
    emit("luminous:item-condition-changed", { item, ...result });
    return result;
  }

  function setQualityTier(item, tier) {
    if (!item || typeof item !== "object") return null;
    item.qualityTier = clamp(intOr(tier, 1), 1, 5);
    item.quality = item.qualityTier;
    return item.qualityTier;
  }

  function getQualityTier(item = {}) { return clamp(intOr(item.qualityTier ?? item.quality, 1), 1, 5); }

  function installedModuleIds(item = {}) {
    const explicit = asArray(item.installedModuleIds).map(String).filter(Boolean);
    const legacy = asArray(item.installedModules).map((entry) => typeof entry === "string" ? entry : (entry?.definitionId || entry?.id || entry?.instanceId)).filter(Boolean).map(String);
    return [...new Set([...explicit, ...legacy])];
  }

  function moduleClass(module = {}) {
    return normalizeId(module.technologyClass || module.moduleClass || module.class || module.runtime?.technologyClass || "module");
  }

  function canRemoveModule(module = {}) {
    return !["structural_tech", "structural_technology"].includes(moduleClass(module)) && module.removable !== false;
  }

  function removeInstalledModule(host, moduleRef, options = {}) {
    if (!host) return { removed: false, reason: "missing_host" };
    const wanted = String(typeof moduleRef === "object" ? (definitionIdOf(moduleRef) || itemIdOf(moduleRef)) : moduleRef || "");
    const legacyEntry = asArray(host.installedModules).find((entry) => String(typeof entry === "string" ? entry : (entry?.definitionId || entry?.id || entry?.instanceId || "")) === wanted);
    const moduleDefinition = options.moduleDefinition || resolveDefinition(wanted, { ...options, type: "module" }) || legacyEntry || {};
    if (!canRemoveModule(moduleDefinition)) return { removed: false, reason: "structural_technology_not_removable" };

    if (Array.isArray(host.installedModuleIds)) host.installedModuleIds = host.installedModuleIds.filter((id) => String(id) !== wanted);
    if (Array.isArray(host.installedModules)) host.installedModules = host.installedModules.filter((entry) => String(typeof entry === "string" ? entry : (entry?.definitionId || entry?.id || entry?.instanceId || "")) !== wanted);
    return { removed: true, host, moduleRef: wanted, installedModuleIds: installedModuleIds(host) };
  }

  function getCharges(item = {}) {
    const max = item.chargesMax ?? item.maxCharges ?? item.charges_max ?? null;
    const current = item.chargesCurrent ?? item.charges_current ?? item.charges ?? max;
    return {
      current: current == null ? null : Math.max(0, intOr(current, 0)),
      max: max == null ? null : Math.max(0, intOr(max, 0)),
    };
  }

  function canSpendCharges(item, amount = 1) {
    const state = getCharges(item);
    const cost = Math.max(0, intOr(amount, 1));
    return state.current != null && state.current >= cost;
  }

  function spendCharges(item, amount = 1) {
    if (!item) return { spent: false, reason: "missing_item" };
    const state = getCharges(item);
    const cost = Math.max(0, intOr(amount, 1));
    if (state.current == null) return { spent: false, reason: "item_has_no_charges" };
    if (state.current < cost) return { spent: false, reason: "insufficient_charges", before: state.current, after: state.current };
    const after = state.current - cost;
    item.chargesCurrent = after;
    item.charges = after;
    return { spent: true, before: state.current, after, amount: cost };
  }

  function restoreCharges(item, amount) {
    if (!item) return { restored: false, reason: "missing_item" };
    const state = getCharges(item);
    if (state.current == null || state.max == null) return { restored: false, reason: "item_has_no_charge_capacity" };
    const after = clamp(state.current + Math.max(0, intOr(amount, 0)), 0, state.max);
    item.chargesCurrent = after;
    item.charges = after;
    return { restored: after > state.current, before: state.current, after, amount: after - state.current };
  }

  function processRecharge(item, trigger, options = {}) {
    if (!item) return { recharged: false, reason: "missing_item" };
    const rule = item.rechargeRule || item.recharge_rule || options.rechargeRule;
    if (!rule) return { recharged: false, reason: "no_recharge_rule" };
    const normalizedTrigger = normalizeId(trigger);
    const ruleTrigger = normalizeId(typeof rule === "string" ? rule : rule.trigger);
    if (ruleTrigger && ruleTrigger !== normalizedTrigger) return { recharged: false, reason: "trigger_mismatch" };
    const state = getCharges(item);
    if (state.max == null) return { recharged: false, reason: "item_has_no_charge_capacity" };
    const amount = typeof rule === "object" && Number.isFinite(Number(rule.amount)) ? Number(rule.amount) : state.max;
    const result = restoreCharges(item, amount);
    return { recharged: result.restored, trigger: normalizedTrigger, ...result };
  }

  function transferOwnership(item, newOwnerId, options = {}) {
    if (!item || typeof item !== "object") return { transferred: false, reason: "missing_item" };
    const previous = item.currentOwnerId ?? item.current_owner_id ?? null;
    if (previous && previous !== newOwnerId) {
      if (!Array.isArray(item.previousOwnerIds)) item.previousOwnerIds = [];
      if (!item.previousOwnerIds.includes(previous)) item.previousOwnerIds.push(previous);
    }
    item.currentOwnerId = newOwnerId || null;
    if (options.sellerId !== undefined) item.sellerId = options.sellerId;
    const result = { transferred: true, previousOwnerId: previous, currentOwnerId: item.currentOwnerId, manufacturerId: item.manufacturerId || null };
    emit("luminous:item-ownership-transferred", { item, ...result });
    return result;
  }

  function migrateLegacyItem(item, key = null, options = {}) {
    if (!item || typeof item !== "object") return null;
    if (intOr(item.schemaVersion, 0) >= SCHEMA_VERSION && item.instanceId && item.definitionId) return item;
    const definitionId = definitionIdOf(item) || String(key || normalizeId(item.name || item.nombre || "item"));
    const migrated = compactInstance({ ...item, instanceId: item.instanceId || key || createInstanceId(definitionId), definitionId }, resolveDefinition(definitionId, options), options);
    const legacyFields = ["nombre", "name", "displayName", "tipo_categoria", "category", "tags", "tag", "keywords", "limite_activo", "limite_alijo", "precio", "cost", "tier", "weapon_details", "armor_details", "shield_details", "accessory_details", "consumable_details", "upgrade_details", "runtime", "function", "functions"];
    legacyFields.forEach((field) => {
      if (item[field] === undefined) return;
      migrated.customData[field] = clone(item[field]);
      migrated[field] = clone(item[field]);
    });
    return migrated;
  }

  function migrateContainer(container, options = {}) {
    if (!container || typeof container !== "object") return container;
    if (Array.isArray(container)) return container.map((item, index) => migrateLegacyItem(item, String(index), options)).filter(Boolean);
    const next = {};
    Object.entries(container).forEach(([key, item]) => {
      const migrated = migrateLegacyItem(item, key, options);
      if (!migrated) return;
      next[migrated.instanceId || key] = migrated;
    });
    return next;
  }

  function migrateLegacyInventory(unit, options = {}) {
    if (!unit || typeof unit !== "object") return { migrated: false, reason: "missing_unit" };
    const active = activeContainer(unit, true);
    const stash = stashContainer(unit, true);
    unit[active.key] = migrateContainer(active.value, options);
    unit[stash.key] = migrateContainer(stash.value, options);
    unit.itemInventorySchemaVersion = SCHEMA_VERSION;
    const result = {
      migrated: true,
      schemaVersion: SCHEMA_VERSION,
      activeContainer: active.key,
      stashContainer: stash.key,
      activeCount: containerCount(unit[active.key]),
      stashCount: containerCount(unit[stash.key]),
    };
    emit("luminous:inventory-migrated", { unit, ...result });
    return result;
  }

  function inventorySnapshot(unit, options = {}) {
    const active = activeContainer(unit).value || {};
    const stash = stashContainer(unit).value || {};
    const mapItem = (item) => options.hydrate === false ? clone(item) : resolveItem(item, options);
    return {
      schemaVersion: intOr(unit?.itemInventorySchemaVersion, SCHEMA_VERSION),
      activeSlotLimit: activeSlotLimit(unit),
      active: objectEntries(active).map(([key, item]) => ({ key, item: mapItem(item) })),
      stash: objectEntries(stash).map(([key, item]) => ({ key, item: mapItem(item) })),
    };
  }

  function describeInventory(unit) {
    const active = activeContainer(unit).value || {};
    const stash = stashContainer(unit).value || {};
    return {
      activeSlots: containerCount(active),
      activeSlotLimit: activeSlotLimit(unit),
      stashSlots: containerCount(stash),
      activeQuantity: objectEntries(active).reduce((sum, [, item]) => sum + quantityOf(item), 0),
      stashQuantity: objectEntries(stash).reduce((sum, [, item]) => sum + quantityOf(item), 0),
    };
  }

  const inventoryApi = Object.freeze({
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    DEFAULT_ACTIVE_SLOT_LIMIT,
    DEFAULT_ACTIVE_STACK_LIMIT,
    DEFAULT_STASH_STACK_LIMIT,
    createInstanceId,
    resolveDefinition,
    createItemInstance,
    serializeItemInstance,
    deserializeItemInstance,
    hydrateItemInstance,
    resolveItem,
    formatWorkshopProductName,
    activeContainer,
    stashContainer,
    findItem,
    activeSlotLimit,
    stackLimit,
    canStack,
    splitStack,
    mergeStacks,
    moveItem,
    moveToActive,
    moveToStash,
    getCondition,
    getConditionState,
    damageCondition,
    getQualityTier,
    setQualityTier,
    installedModuleIds,
    moduleClass,
    canRemoveModule,
    removeInstalledModule,
    getCharges,
    canSpendCharges,
    spendCharges,
    restoreCharges,
    processRecharge,
    transferOwnership,
    migrateLegacyItem,
    migrateLegacyInventory,
    inventorySnapshot,
    describeInventory,
  });

  global.LuminousItemInventoryRuntime = inventoryApi;
  if (baseRuntime) {
    global.LuminousItemRuntime = Object.freeze({ ...baseRuntime, ...inventoryApi, __luminousInventoryRuntimeBridge: true, __luminousItemRuntimeBase: baseRuntime });
  }

  function loadExtension(globalName, scriptId, src, next) {
    if (!global.document) return;
    if (global[globalName]) {
      if (typeof next === "function") next();
      return;
    }
    const existing = global.document.getElementById(scriptId);
    if (existing) {
      existing.addEventListener?.("load", () => next?.(), { once: true });
      return;
    }
    const script = global.document.createElement("script");
    script.id = scriptId;
    script.src = src;
    script.async = false;
    script.addEventListener?.("load", () => next?.(), { once: true });
    global.document.head?.appendChild(script);
  }

  function ensureRuntimeExtensions() {
    if (!global.document) return;
    loadExtension("LuminousWorkshopRuntime", "workshop-runtime-script", "js/workshop-runtime.js", () => {
      loadExtension("LuminousItemMagicRuntime", "item-magic-runtime-script", "js/item-magic-runtime.js", () => {
        loadExtension("LuminousItemPersistenceRuntime", "item-persistence-runtime-script", "js/item-persistence-runtime.js");
      });
    });
  }

  ensureRuntimeExtensions();
  if (typeof module !== "undefined" && module.exports) module.exports = inventoryApi;
})(typeof window !== "undefined" ? window : globalThis);
