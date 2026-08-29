(function (global) {
  "use strict";

  if (global.LuminousItemRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemRuntime;
    return;
  }

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const engines = {
    anatomy: () => global.LuminousAnatomyEquipmentEngine || safeRequire("./anatomy-equipment-engine.js"),
    actions: () => global.LuminousActionEconomy || safeRequire("./universal-action-economy.js"),
    statuses: () => global.LuminousStatusEngine || safeRequire("./status-engine.js"),
    injuries: () => global.LuminousInjuryEngine || safeRequire("./injury-engine.js"),
    modifiers: () => global.LuminousUniversalModifiers || safeRequire("./universal-modifier-engine.js"),
  };

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function itemId(item = {}) {
    return String(item.instanceId || item.instance_id || item.canonicalId || item.definitionId || item.itemId || item.item_id || item.id || item.key || item.nombre || item.name || "item").trim();
  }

  function definitionId(item = {}) {
    return String(item.definitionId || item.definition_id || item.canonicalId || item.canonical_id || item.itemId || item.item_id || item.id || item.key || "").trim();
  }

  function itemName(item = {}) {
    return String(item.displayName || item.nombre || item.name || definitionId(item) || "Item").trim();
  }

  function categoryOf(item = {}) {
    const raw = normalizeId(item.tipo_categoria || item.category || item.itemType || item.item_type || item.kind || item.type || item.tag);
    const aliases = {
      arma: "weapon", weapons: "weapon",
      armadura: "armor", armors: "armor",
      escudo: "shield", shields: "shield",
      accesorio: "accessory", accessories: "accessory",
      consumible: "consumable", consumables: "consumable",
      aumento: "augmentation", augment: "augmentation", alteracion_corporal: "augmentation",
      mejora: "upgrade", upgrades: "upgrade", module: "upgrade", modules: "upgrade",
      municion: "ammo", ammunition: "ammo",
      herramienta: "tool", tools: "tool",
    };
    return aliases[raw] || raw || "item";
  }

  function tagsOf(item = {}) {
    const tags = [];
    asArray(item.tags).forEach((tag) => {
      if (typeof tag === "string" && tag.includes("|")) tag.split("|").forEach((part) => tags.push(part));
      else tags.push(tag);
    });
    if (typeof item.tag === "string") item.tag.split(/[|,]/).forEach((tag) => tags.push(tag));
    return [...new Set(tags.map((tag) => String(tag ?? "").trim()).filter(Boolean))];
  }

  function normalizedTags(item = {}) {
    return tagsOf(item).map(normalizeId);
  }

  function tagValue(item, prefix) {
    const wanted = `${normalizeId(prefix)}:`;
    for (const raw of tagsOf(item)) {
      const text = String(raw).trim();
      const index = text.indexOf(":");
      if (index < 0) continue;
      if (`${normalizeId(text.slice(0, index))}:` === wanted) return text.slice(index + 1).trim();
    }
    return null;
  }

  function runtimeOf(item = {}) {
    return item.runtime && typeof item.runtime === "object" ? item.runtime
      : item.itemRuntime && typeof item.itemRuntime === "object" ? item.itemRuntime
        : item.item_runtime && typeof item.item_runtime === "object" ? item.item_runtime
          : {};
  }

  function parseFunctionTypes(item = {}) {
    const out = new Set();
    const raw = item.function ?? item.functions ?? runtimeOf(item).functions;
    asArray(raw).forEach((entry) => {
      if (typeof entry === "string") entry.split(/[|,;]/).forEach((part) => out.add(normalizeId(part)));
      else if (entry && typeof entry === "object") out.add(normalizeId(entry.functionType || entry.type || entry.id));
    });
    if (categoryOf(item) === "consumable") out.add("use");
    if (["weapon", "armor", "shield", "accessory"].includes(categoryOf(item))) out.add("equip");
    if (categoryOf(item) === "upgrade") { out.add("install"); out.add("remove"); }
    if (categoryOf(item) === "ammo") out.add("ammo");
    return [...out].filter(Boolean);
  }

  function hasFunction(item, functionType) {
    return parseFunctionTypes(item).includes(normalizeId(functionType));
  }

  function inferAccessoryType(item = {}) {
    const explicit = runtimeOf(item).equipment?.accessoryType || item.equipment?.accessoryType || item.accessorySlot || item.bodySlot || item.slotType || item.equipBodyPart;
    if (explicit) return normalizeId(explicit);
    const slot = normalizeId(tagValue(item, "slot"));
    const map = {
      face: "head", head: "head", helmet: "head",
      arm: "arm", arms: "arm", wrist: "arm",
      hand: "hand", hands: "hand", gloves: "hand",
      finger: "finger", ring: "finger",
      foot: "foot", feet: "foot", shoes: "foot", boots: "foot",
    };
    return map[slot] || (slot ? "legacy_accessory" : "legacy_accessory");
  }

  function inferHandCost(item = {}) {
    const explicit = runtimeOf(item).equipment?.handCost ?? item.equipment?.handCost ?? item.handCost ?? item.handsRequired;
    if (Number.isFinite(Number(explicit))) return Math.max(0, Math.trunc(Number(explicit)));
    const tag = tagValue(item, "hands");
    if (Number.isFinite(Number(tag))) return Math.max(0, Math.trunc(Number(tag)));
    if (categoryOf(item) === "weapon" || categoryOf(item) === "shield") return 1;
    return 0;
  }

  function equipmentSchema(item = {}) {
    const runtime = runtimeOf(item);
    const explicit = runtime.equipment || item.equipment || item.equipmentSchema || {};
    const category = categoryOf(item);
    const kind = normalizeId(explicit.kind || (["weapon", "armor", "shield", "accessory", "augmentation"].includes(category) ? category : "item"));
    const blockers = explicit.blocksAccessorySlots || item.blocksAccessorySlots || item.blockedAccessorySlots || [];
    return {
      ...clone(explicit),
      kind,
      handCost: inferHandCost(item),
      accessoryType: kind === "accessory" ? inferAccessoryType(item) : null,
      slotCost: Math.max(1, intOr(explicit.slotCost ?? item.slotCost, 1)),
      blocksAccessorySlots: clone(blockers),
    };
  }

  function hydrateForEquipment(item = {}) {
    if (!item || typeof item !== "object") return item;
    item.equipment = equipmentSchema(item);
    return item;
  }

  function containersFor(unit = {}) {
    return [unit.inventory, unit.inventario, unit.activeInventory, unit.items, unit.equipment].filter(Boolean);
  }

  function objectEntries(container) {
    if (Array.isArray(container)) return container.map((item, index) => [String(index), item]);
    if (container && typeof container === "object") return Object.entries(container);
    return [];
  }

  function findItem(unit, ref) {
    if (ref && typeof ref === "object") return ref;
    const wanted = String(ref ?? "").trim();
    if (!wanted) return null;
    for (const container of containersFor(unit)) {
      for (const [key, item] of objectEntries(container)) {
        if (!item || typeof item !== "object") continue;
        const candidates = [key, itemId(item), definitionId(item), item.id, item.key, item.itemId, item.item_id, item.canonicalId]
          .map((value) => String(value ?? "").trim()).filter(Boolean);
        if (candidates.includes(wanted)) return item;
      }
    }
    return null;
  }

  function quantityOf(item = {}) {
    const candidates = [item.quantity, item.qty, item.cantidad, item.stack, item.count];
    const found = candidates.find((value) => Number.isFinite(Number(value)));
    return Math.max(0, intOr(found, 1));
  }

  function setQuantity(item = {}, next) {
    const value = Math.max(0, Math.trunc(numberOr(next, 0)));
    const key = ["quantity", "qty", "cantidad", "stack", "count"].find((name) => Object.prototype.hasOwnProperty.call(item, name)) || "quantity";
    item[key] = value;
    return value;
  }

  function consumeQuantity(item = {}, amount = 1) {
    const qty = quantityOf(item);
    const cost = Math.max(0, Math.trunc(numberOr(amount, 1)));
    if (qty < cost) return { consumed: false, reason: "insufficient_quantity", before: qty, after: qty };
    const after = setQuantity(item, qty - cost);
    return { consumed: true, before: qty, after, amount: cost };
  }

  function makeInstance(definition = {}, options = {}) {
    const maxCondition = Math.max(0, numberOr(options.conditionMax ?? definition.conditionMax ?? definition.condition_max, 100));
    const instance = {
      ...clone(definition),
      definitionId: definitionId(definition) || normalizeId(itemName(definition)),
      instanceId: options.instanceId || `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      quantity: Math.max(1, intOr(options.quantity, 1)),
      conditionMax: maxCondition,
      condition: clamp(numberOr(options.condition, maxCondition), 0, maxCondition),
      quality: numberOr(options.quality, 1),
      stolen: options.stolen === true,
      originMarketId: options.originMarketId || null,
      installedModules: clone(options.installedModules || []),
      charges: options.charges == null ? null : Math.max(0, intOr(options.charges, 0)),
    };
    hydrateForEquipment(instance);
    return instance;
  }

  function equippedItems(unit = {}) {
    const anatomy = engines.anatomy();
    const items = anatomy?.collectEquippedItems?.(unit) || [];
    return items.map(hydrateForEquipment);
  }

  function equipItem(unit, itemInput, options = {}) {
    const item = hydrateForEquipment(findItem(unit, itemInput) || itemInput);
    if (!unit || !item || typeof item !== "object") return { equipped: false, reason: "missing_unit_or_item" };
    if (!["weapon", "armor", "shield", "accessory"].includes(equipmentSchema(item).kind)) return { equipped: false, reason: "item_not_equippable", item };
    const anatomy = engines.anatomy();
    if (!anatomy?.validateEquipment) return { equipped: false, reason: "anatomy_engine_unavailable", item };

    const wasEquipped = item.equipped === true;
    const previousParts = clone(item.equippedPartIds || []);
    item.equipped = true;
    const all = equippedItems(unit).filter((entry) => entry !== item);
    all.push(item);
    const result = anatomy.validateEquipment(unit, all, options);
    const assignment = result.assignments.find((entry) => entry.item === item || itemId(entry.item) === itemId(item));
    const invalid = result.invalid.find((entry) => entry.item === item || itemId(entry.item) === itemId(item));
    if (!assignment || invalid) {
      item.equipped = wasEquipped;
      item.equippedPartIds = previousParts;
      return { equipped: false, reason: invalid?.reason || "equipment_assignment_failed", item, validation: result };
    }
    item.equipped = true;
    item.equippedPartIds = [...assignment.partIds];
    item.assignedBodyParts = [...assignment.partIds];
    syncLegacyEquipmentPointers(unit, item, true);
    emit("luminous:item-equipped", { unit, item, assignment, validation: result });
    return { equipped: true, unit, item, assignment, validation: result };
  }

  function syncLegacyEquipmentPointers(unit, item, equip) {
    if (!unit || !item) return;
    if (!unit.equipment || typeof unit.equipment !== "object" || Array.isArray(unit.equipment)) unit.equipment = {};
    const kind = equipmentSchema(item).kind;
    if (kind === "armor") {
      if (equip) unit.equipment.armor = item;
      else if (unit.equipment.armor === item || itemId(unit.equipment.armor || {}) === itemId(item)) delete unit.equipment.armor;
      return;
    }
    if (kind === "shield") {
      if (equip) unit.equipment.shield = item;
      else if (unit.equipment.shield === item || itemId(unit.equipment.shield || {}) === itemId(item)) delete unit.equipment.shield;
      return;
    }
    if (kind === "weapon") {
      if (equip) {
        if (!unit.equipment.mainHand) unit.equipment.mainHand = item;
        else if (!unit.equipment.offHand && inferHandCost(item) <= 1) unit.equipment.offHand = item;
      } else {
        if (unit.equipment.mainHand === item || itemId(unit.equipment.mainHand || {}) === itemId(item)) delete unit.equipment.mainHand;
        if (unit.equipment.offHand === item || itemId(unit.equipment.offHand || {}) === itemId(item)) delete unit.equipment.offHand;
      }
    }
  }

  function unequipItem(unit, itemInput) {
    const item = findItem(unit, itemInput) || itemInput;
    if (!item || typeof item !== "object") return { unequipped: false, reason: "item_not_found" };
    item.equipped = false;
    item.equipped_slot = null;
    item.equippedSlot = null;
    item.equippedPartIds = [];
    item.assignedBodyParts = [];
    syncLegacyEquipmentPointers(unit, item, false);
    emit("luminous:item-unequipped", { unit, item });
    return { unequipped: true, unit, item };
  }

  function currentAndMax(unit, kind) {
    const lower = normalizeId(kind);
    const candidates = lower === "hp" ? [
      [unit?.combatStats, "hp_actual", ["hp_max", "max_hp", "maxHp"]],
      [unit, "hp", ["effectiveMaxHp", "maxHp", "max_hp", "hpMax"]],
      [unit, "currentHp", ["maxHp", "max_hp"]],
    ] : [
      [unit?.combatStats, "sp_actual", ["sp_max", "max_sp", "maxSp"]],
      [unit, "sp", ["maxSp", "max_sp", "spMax"]],
      [unit, "sanity", ["maxSanity", "sanityMax"]],
    ];
    for (const [owner, key, maxKeys] of candidates) {
      if (!owner || !Number.isFinite(Number(owner[key]))) continue;
      const maxKey = maxKeys.find((name) => Number.isFinite(Number(owner[name])));
      const fallbackMax = lower === "sp" ? 45 : Number(owner[key]);
      return { owner, key, maxKey, current: Number(owner[key]), max: maxKey ? Number(owner[maxKey]) : fallbackMax };
    }
    return null;
  }

  function recoverResource(unit, kind, amount) {
    const value = Math.max(0, numberOr(amount, 0));
    if (!value) return { changed: false, amount: 0, kind: normalizeId(kind) };
    const slot = currentAndMax(unit, kind);
    if (!slot) return { changed: false, reason: `${normalizeId(kind)}_resource_not_found`, amount: 0 };
    const before = slot.current;
    const after = clamp(before + value, 0, Math.max(before, slot.max));
    slot.owner[slot.key] = after;
    return { changed: after !== before, before, after, amount: after - before, kind: normalizeId(kind) };
  }

  function hpPercent(unit) {
    const slot = currentAndMax(unit, "hp");
    if (!slot || slot.max <= 0) return 100;
    return clamp((slot.current / slot.max) * 100, 0, 100);
  }

  function actionCostFor(item = {}) {
    const runtime = runtimeOf(item);
    const details = item.consumable_details || {};
    return normalizeId(runtime.actionCost || runtime.action_cost || details.action_cost || details.actionCost || "action") || "action";
  }

  function usageTarget(item, user, options = {}) {
    const details = item.consumable_details || {};
    const runtime = runtimeOf(item);
    if (details.is_throwable === true || normalizeId(runtime.targetMode || runtime.target_mode) === "target") return options.target || null;
    return options.target || user;
  }

  function runtimeUseProfile(item = {}) {
    const runtime = runtimeOf(item);
    const details = item.consumable_details || {};
    const effects = runtime.effects && typeof runtime.effects === "object" ? runtime.effects : {};
    const treatment = runtime.injuryTreatment || runtime.injury_treatment || details.injury_treatment || null;
    return {
      hp: numberOr(effects.hpRestore ?? effects.hp_restore ?? runtime.hpRestore ?? runtime.hp_restore ?? details.curacion_hp, 0),
      sp: numberOr(effects.spRestore ?? effects.sp_restore ?? runtime.spRestore ?? runtime.sp_restore ?? details.curacion_sp, 0),
      statusId: effects.statusId || effects.status_id || runtime.statusId || runtime.status_id || details.status_id || null,
      statusPotency: numberOr(effects.statusPotency ?? effects.status_potency ?? runtime.statusPotency ?? runtime.status_potency ?? details.status_potency, 0),
      statusCount: Math.max(0, intOr(effects.statusCount ?? effects.status_count ?? runtime.statusCount ?? runtime.status_count ?? details.status_count, 0)),
      statId: normalizeId(effects.statId || effects.stat_id || runtime.statId || runtime.stat_id || details.stat_increase),
      statValue: numberOr(effects.statValue ?? effects.stat_value ?? runtime.statValue ?? runtime.stat_value ?? details.stat_increase_value, 0),
      durationHours: Math.max(0, numberOr(effects.durationHours ?? effects.duration_hours ?? runtime.durationHours ?? runtime.duration_hours ?? details.duration_hours, 0)),
      injuryTreatment: treatment ? clone(treatment) : null,
      repairAmount: Math.max(0, numberOr(effects.repairAmount ?? effects.repair_amount ?? runtime.repairAmount ?? runtime.repair_amount, 0)),
      removeStatuses: asArray(effects.removeStatuses || effects.remove_statuses || runtime.removeStatuses || runtime.remove_statuses).map(normalizeId).filter(Boolean),
    };
  }

  function ensureRuntimeEffects(unit) {
    if (!unit || typeof unit !== "object") return [];
    if (!Array.isArray(unit.itemRuntimeEffects)) unit.itemRuntimeEffects = [];
    return unit.itemRuntimeEffects;
  }

  function addTemporaryStatEffect(unit, item, statId, value, hours) {
    if (!unit || !statId || !value || hours <= 0) return null;
    const effects = ensureRuntimeEffects(unit);
    const id = `item_effect_${normalizeId(itemId(item))}_${Date.now()}_${effects.length + 1}`;
    const effect = { id, sourceItemId: definitionId(item) || itemId(item), kind: "stat", statId, value, remainingHours: hours, active: true };
    effects.push(effect);
    emit("luminous:item-temporary-effect-added", { unit, item, effect: clone(effect) });
    return effect;
  }

  function advanceTime(unit, hours) {
    const elapsed = Math.max(0, numberOr(hours, 0));
    if (!elapsed) return [];
    const effects = ensureRuntimeEffects(unit);
    const changed = [];
    effects.forEach((effect) => {
      if (!effect || effect.active === false || effect.remainingHours == null) return;
      const before = Math.max(0, numberOr(effect.remainingHours, 0));
      effect.remainingHours = Math.max(0, before - elapsed);
      if (effect.remainingHours <= 0) effect.active = false;
      changed.push({ id: effect.id, before, after: effect.remainingHours, expired: effect.active === false });
    });
    unit.itemRuntimeEffects = effects.filter((effect) => effect && effect.active !== false);
    if (changed.length) emit("luminous:item-effects-time-advanced", { unit, hours: elapsed, changed });
    return changed;
  }

  function conditionOf(item = {}) {
    const current = numberOr(item.condition ?? item.currentCondition ?? item.durability, 0);
    const max = Math.max(0, numberOr(item.conditionMax ?? item.maxCondition ?? item.maxDurability, 100));
    return { current: clamp(current, 0, max), max };
  }

  function repairItem(targetItem, amount) {
    if (!targetItem || typeof targetItem !== "object") return { repaired: false, reason: "missing_target_item" };
    const state = conditionOf(targetItem);
    const repair = Math.max(0, numberOr(amount, 0));
    if (!repair) return { repaired: false, reason: "zero_repair", before: state.current, after: state.current, max: state.max };
    const after = clamp(state.current + repair, 0, state.max);
    if (Object.prototype.hasOwnProperty.call(targetItem, "condition")) targetItem.condition = after;
    else if (Object.prototype.hasOwnProperty.call(targetItem, "durability")) targetItem.durability = after;
    else targetItem.condition = after;
    return { repaired: after > state.current, before: state.current, after, max: state.max, amount: after - state.current };
  }

  function applyUseEffects(user, item, options = {}) {
    const profile = runtimeUseProfile(item);
    const target = usageTarget(item, user, options);
    if (!target) return { applied: false, reason: "missing_target", item };
    const results = { hp: null, sp: null, status: null, removedStatuses: [], injury: null, repair: null, temporaryEffect: null };

    if (profile.hp > 0) results.hp = recoverResource(target, "hp", profile.hp);
    if (profile.sp > 0) results.sp = recoverResource(target, "sp", profile.sp);

    const statusEngine = engines.statuses();
    profile.removeStatuses.forEach((statusId) => {
      if (statusEngine?.removeStatus) results.removedStatuses.push(statusEngine.removeStatus(target, statusId, { from: "item" }));
    });
    if (profile.statusId && statusEngine?.applyStatus) {
      results.status = statusEngine.applyStatus(target, profile.statusId, {
        count: profile.statusCount || 1,
        potency: profile.statusPotency,
        sourceUnitId: String(user?.id || user?.unitId || user?.characterId || ""),
        data: { sourceItemId: definitionId(item) || itemId(item) },
      });
    }

    if (profile.statId && profile.statValue && profile.durationHours > 0) {
      results.temporaryEffect = addTemporaryStatEffect(target, item, profile.statId, profile.statValue, profile.durationHours);
    }

    if (profile.injuryTreatment) {
      const injuryRef = options.injuryRef || options.injury || profile.injuryTreatment.injuryRef || profile.injuryTreatment.injury_ref;
      const injuryEngine = engines.injuries();
      if (injuryRef && injuryEngine?.treatInjury) results.injury = injuryEngine.treatInjury(target, injuryRef, profile.injuryTreatment);
    }

    if (profile.repairAmount > 0) results.repair = repairItem(options.itemTarget || options.repairTarget, profile.repairAmount);

    const effectCount = [results.hp, results.sp, results.status, results.temporaryEffect, results.injury, results.repair]
      .filter(Boolean).length + results.removedStatuses.length;
    return { applied: effectCount > 0, user, target, item, profile, results };
  }

  function applyAndConsume(user, item, options = {}) {
    const applied = applyUseEffects(user, item, options);
    if (!applied.applied && options.consumeOnNoEffect !== true) return { ...applied, consumed: false };
    const consumeQty = Math.max(0, intOr(runtimeOf(item).consumeQty ?? runtimeOf(item).consume_qty ?? options.consumeQty, 1));
    const consumption = consumeQty > 0 ? consumeQuantity(item, consumeQty) : { consumed: true, before: quantityOf(item), after: quantityOf(item), amount: 0 };
    if (!consumption.consumed) return { applied: false, reason: consumption.reason, item, consumption };
    const result = { ...applied, consumed: true, consumption };
    emit("luminous:item-used", result);
    return result;
  }

  function useItem(user, itemInput, options = {}) {
    const item = findItem(user, itemInput) || itemInput;
    if (!user || !item || typeof item !== "object") return { used: false, reason: "missing_user_or_item" };
    if (!hasFunction(item, "use") && categoryOf(item) !== "consumable") return { used: false, reason: "item_not_usable", item };
    if (quantityOf(item) <= 0) return { used: false, reason: "insufficient_quantity", item };

    const actionEngine = engines.actions();
    const phase = normalizeId(options.phase || actionEngine?.phaseFor?.(options) || "other");
    const cost = actionCostFor(item);
    const inActionEconomy = ["planning", "combat"].includes(phase);

    if (!inActionEconomy || options.ignoreActionCost === true || cost === "none" || cost === "free") {
      const result = applyAndConsume(user, item, options);
      return { used: Boolean(result.applied && result.consumed), immediate: true, cost, ...result };
    }

    if (!actionEngine) return { used: false, reason: "action_economy_unavailable", item, cost };

    if (cost === "action") {
      if (phase !== "planning") return { used: false, reason: "action_item_requires_planning_phase", item, cost };
      const scheduled = actionEngine.scheduleAction(user, {
        kind: "item_use",
        sourceId: definitionId(item) || itemId(item),
        targetId: options.target?.id || options.target?.unitId || options.target?.characterId || null,
        data: {
          itemInstanceId: item.instanceId || itemId(item),
          definitionId: definitionId(item),
          injuryRef: options.injuryRef || null,
        },
      }, options);
      if (!scheduled.scheduled) return { used: false, scheduled: false, reason: scheduled.reason, item, cost };
      emit("luminous:item-use-scheduled", { user, item, scheduled });
      return { used: true, scheduled: true, immediate: false, item, cost, ...scheduled };
    }

    const gate = actionEngine.availability?.(user, cost, options) || { available: true };
    if (!gate.available) return { used: false, reason: gate.reason || "action_cost_unavailable", item, cost };
    if (!actionEngine.consume?.(user, cost, options)) return { used: false, reason: "action_cost_not_consumed", item, cost };
    const result = applyAndConsume(user, item, options);
    return { used: Boolean(result.applied && result.consumed), immediate: true, cost, ...result };
  }

  function resolveScheduledUse(user, plannedAction, options = {}) {
    const entry = plannedAction?.entry || plannedAction;
    if (normalizeId(entry?.kind) !== "item_use") return { resolved: false, reason: "not_item_use_action" };
    const instanceRef = entry?.data?.itemInstanceId || entry?.data?.definitionId || entry?.sourceId;
    const item = options.item || findItem(user, instanceRef);
    if (!item) return { resolved: false, reason: "scheduled_item_not_found", instanceRef };
    const target = options.target || null;
    const result = applyAndConsume(user, item, { ...options, target, injuryRef: options.injuryRef || entry?.data?.injuryRef, ignoreActionCost: true });
    return { resolved: Boolean(result.applied && result.consumed), item, ...result };
  }

  function ammoResourceId(item = {}) {
    const runtime = runtimeOf(item);
    return normalizeId(runtime.ammoResourceId || runtime.ammo_resource_id || item.ammoResourceId || item.ammo_type || tagValue(item, "ammo") || item.subtype || "ammo");
  }

  function ensureResourceStore(unit) {
    if (!unit.resources || typeof unit.resources !== "object" || Array.isArray(unit.resources)) unit.resources = {};
    return unit.resources;
  }

  function resourceAmount(store, id) {
    const raw = store[id];
    if (raw && typeof raw === "object") return Math.max(0, numberOr(raw.value ?? raw.current ?? raw.amount, 0));
    return Math.max(0, numberOr(raw, 0));
  }

  function setResourceAmount(store, id, value) {
    const next = Math.max(0, Math.trunc(numberOr(value, 0)));
    if (store[id] && typeof store[id] === "object") {
      if (Object.prototype.hasOwnProperty.call(store[id], "value")) store[id].value = next;
      else if (Object.prototype.hasOwnProperty.call(store[id], "current")) store[id].current = next;
      else store[id].amount = next;
    } else store[id] = next;
    return next;
  }

  function reloadAmmo(unit, ammoInput, options = {}) {
    const ammoItem = findItem(unit, ammoInput) || ammoInput;
    if (!unit || !ammoItem || typeof ammoItem !== "object") return { reloaded: false, reason: "missing_unit_or_ammo" };
    if (!hasFunction(ammoItem, "ammo") && categoryOf(ammoItem) !== "ammo") return { reloaded: false, reason: "item_not_ammunition" };
    const available = quantityOf(ammoItem);
    if (available <= 0) return { reloaded: false, reason: "insufficient_quantity" };
    const wanted = Math.max(1, intOr(options.amount, 1));
    const moved = Math.min(wanted, available);
    const id = normalizeId(options.resourceId || ammoResourceId(ammoItem));
    const store = ensureResourceStore(unit);
    const before = resourceAmount(store, id);
    setResourceAmount(store, id, before + moved);
    consumeQuantity(ammoItem, moved);
    const result = { reloaded: true, unit, ammoItem, resourceId: id, amount: moved, before, after: before + moved };
    emit("luminous:item-ammo-reloaded", result);
    return result;
  }

  function moduleCapacity(host = {}) {
    const runtime = runtimeOf(host);
    return Math.max(0, intOr(runtime.moduleCapacity ?? runtime.module_capacity ?? host.max_upgrade_slots_capacity ?? host.upgrade_details?.max_upgrade_slots_capacity, 3));
  }

  function installedModules(host = {}) {
    if (!Array.isArray(host.installedModules)) host.installedModules = [];
    return host.installedModules;
  }

  function compatibleModule(host, module) {
    const runtime = runtimeOf(module);
    const allowed = asArray(runtime.compatibleKinds || runtime.compatible_kinds).map(normalizeId).filter(Boolean);
    if (!allowed.length) return true;
    return allowed.includes(equipmentSchema(host).kind) || allowed.includes(categoryOf(host));
  }

  function installModule(host, module, options = {}) {
    if (!host || !module) return { installed: false, reason: "missing_host_or_module" };
    const list = installedModules(host);
    const capacity = moduleCapacity(host);
    if (list.length >= capacity) return { installed: false, reason: "module_capacity_reached", capacity };
    if (!compatibleModule(host, module)) return { installed: false, reason: "module_incompatible" };
    const id = definitionId(module) || itemId(module);
    if (list.some((entry) => String(entry.definitionId || entry.id || entry) === id)) return { installed: false, reason: "module_already_installed" };
    list.push({ definitionId: id, instanceId: module.instanceId || null, installedAt: options.installedAt || Date.now(), data: clone(runtimeOf(module)) });
    if (options.consumeModule !== false) consumeQuantity(module, 1);
    const result = { installed: true, host, module, capacity, installedModules: clone(list) };
    emit("luminous:item-module-installed", result);
    return result;
  }

  function removeModule(host, moduleRef) {
    const list = installedModules(host);
    const wanted = String(typeof moduleRef === "object" ? (definitionId(moduleRef) || itemId(moduleRef)) : moduleRef || "");
    const index = list.findIndex((entry) => String(entry.definitionId || entry.id || entry) === wanted || String(entry.instanceId || "") === wanted);
    if (index < 0) return { removed: false, reason: "module_not_installed" };
    const [removed] = list.splice(index, 1);
    const result = { removed: true, host, module: removed, installedModules: clone(list) };
    emit("luminous:item-module-removed", result);
    return result;
  }

  function inventoryCounts(unit = {}) {
    const counts = new Map();
    const container = unit.inventory || unit.inventario || unit.items || [];
    objectEntries(container).forEach(([key, item]) => {
      if (!item || typeof item !== "object") return;
      const id = definitionId(item) || String(key);
      counts.set(id, (counts.get(id) || 0) + quantityOf(item));
    });
    return counts;
  }

  function recipeIngredients(recipe = {}) {
    const raw = recipe.ingredientes || recipe.ingredients || {};
    if (Array.isArray(raw)) return raw.map((entry) => ({ id: entry.definitionId || entry.itemId || entry.id, qty: Math.max(1, intOr(entry.qty ?? entry.quantity, 1)) }));
    return Object.entries(raw).map(([id, qty]) => ({ id, qty: Math.max(1, intOr(qty, 1)) }));
  }

  function canCraft(unit, recipe = {}) {
    const counts = inventoryCounts(unit);
    const missing = recipeIngredients(recipe).filter((entry) => (counts.get(entry.id) || 0) < entry.qty)
      .map((entry) => ({ ...entry, available: counts.get(entry.id) || 0 }));
    return { craftable: missing.length === 0, missing };
  }

  function consumeDefinition(unit, id, qty) {
    let remaining = Math.max(0, intOr(qty, 0));
    const container = unit.inventory || unit.inventario || unit.items || [];
    for (const [, item] of objectEntries(container)) {
      if (remaining <= 0) break;
      if (!item || definitionId(item) !== id) continue;
      const take = Math.min(remaining, quantityOf(item));
      consumeQuantity(item, take);
      remaining -= take;
    }
    return remaining === 0;
  }

  function addToInventory(unit, definition, qty = 1) {
    if (!unit.inventory) unit.inventory = [];
    if (Array.isArray(unit.inventory)) {
      const existing = unit.inventory.find((item) => definitionId(item) === definitionId(definition) && !item.instanceId);
      if (existing) setQuantity(existing, quantityOf(existing) + qty);
      else unit.inventory.push({ ...clone(definition), quantity: qty });
      return true;
    }
    const id = definitionId(definition) || normalizeId(itemName(definition));
    if (!unit.inventory[id]) unit.inventory[id] = { ...clone(definition), quantity: 0 };
    setQuantity(unit.inventory[id], quantityOf(unit.inventory[id]) + qty);
    return true;
  }

  function craft(unit, recipe = {}, options = {}) {
    const gate = canCraft(unit, recipe);
    if (!gate.craftable) return { crafted: false, reason: "missing_ingredients", missing: gate.missing };
    recipeIngredients(recipe).forEach((entry) => consumeDefinition(unit, entry.id, entry.qty));
    if (normalizeId(recipe.tipo_sintesis || recipe.type) === "upgrade") {
      const host = options.host || findItem(unit, recipe.base_equipable_id || recipe.baseEquipableId);
      const module = options.module || findItem(unit, recipe.target_upgrade_id || recipe.targetUpgradeId);
      const installation = installModule(host, module, { consumeModule: false });
      if (!installation.installed) return { crafted: false, reason: installation.reason, installation };
      return { crafted: true, kind: "upgrade", installation };
    }
    const resultId = recipe.item_resultado_id || recipe.resultId || recipe.result?.definitionId || recipe.result?.id;
    const resultDefinition = options.resultDefinition || options.catalog?.[resultId] || { id: resultId, definitionId: resultId, nombre: resultId };
    const qty = Math.max(1, intOr(recipe.cantidad_resultado ?? recipe.resultQty ?? recipe.result?.qty, 1));
    addToInventory(unit, resultDefinition, qty);
    const result = { crafted: true, kind: "craft", resultId, quantity: qty, resultDefinition };
    emit("luminous:item-crafted", { unit, recipe, ...result });
    return result;
  }

  function collectModifierTraits(unit = {}) {
    unit.hpPercent = hpPercent(unit);
    const traits = [];
    const pushModifier = (sourceId, channel, value, mode = "add", conditions = []) => {
      if (!channel || !Number.isFinite(Number(value)) || Number(value) === 0) return;
      traits.push({ id: `item_${normalizeId(sourceId)}_${normalizeId(channel)}_${traits.length}`, contexts: ["any"], rules: [{ type: "modifier", trigger: "passive", channel: normalizeId(channel), value: Number(value), mode, conditions }] });
    };
    const pushStat = (sourceId, statId, value) => {
      if (!statId || !Number.isFinite(Number(value)) || Number(value) === 0) return;
      traits.push({ id: `item_${normalizeId(sourceId)}_stat_${normalizeId(statId)}_${traits.length}`, contexts: ["any"], rules: [{ type: "stat", trigger: "passive", statId: normalizeId(statId), value: Number(value), mode: "add", conditions: [] }] });
    };

    equippedItems(unit).forEach((item) => {
      const id = definitionId(item) || itemId(item);
      const category = categoryOf(item);
      const details = category === "weapon" ? item.weapon_details || {}
        : category === "armor" ? item.armor_details || {}
          : category === "shield" ? item.shield_details || {}
            : category === "accessory" ? item.accessory_details || {}
              : {};
      pushModifier(id, "offensive_level", numberOr(details.off_lvl_mod, 0));
      pushModifier(id, "defensive_level", numberOr(details.def_lvl_mod, 0));
      if (category === "shield") pushModifier(id, "defense_power", numberOr(details.defense_power_scale, 0));
      const ruleList = details.passives || details.rules || [];
      asArray(ruleList).forEach((rule, index) => {
        if (normalizeId(rule.trigger || "passive") !== "passive") return;
        const affectation = normalizeId(rule.affectation);
        const raw = numberOr(rule.value, 0);
        const op = normalizeId(rule.operation || "add");
        const value = op === "sub" ? -Math.abs(raw) : raw;
        const conditions = Number.isFinite(Number(rule.condition_hp_threshold)) && Number(rule.condition_hp_threshold) < 100
          ? [{ path: "self.hpPercent", operator: "lte", value: Number(rule.condition_hp_threshold) }]
          : [];
        if (["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma", "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"].includes(affectation)) {
          const statMap = { fuerza: "strength", destreza: "dexterity", constitucion: "constitution", inteligencia: "intelligence", sabiduria: "wisdom", carisma: "charisma" };
          pushStat(`${id}_${index}`, statMap[affectation] || affectation, value);
        } else if (!["hp", "sp"].includes(affectation)) {
          pushModifier(`${id}_${index}`, affectation, value, op === "mult" ? "multiply" : "add", conditions);
        }
      });
      installedModules(item).forEach((module, index) => {
        const data = module.data || {};
        asArray(data.modifiers).forEach((rule) => pushModifier(`${id}_module_${index}`, rule.channel || rule.affectation, numberOr(rule.value, 0), normalizeId(rule.mode || rule.operation || "add")));
      });
    });

    ensureRuntimeEffects(unit).filter((effect) => effect?.active !== false).forEach((effect) => {
      if (effect.kind === "stat") pushStat(effect.id, effect.statId, effect.value);
      if (effect.kind === "modifier") pushModifier(effect.id, effect.channel, effect.value, effect.mode || "add");
    });
    return traits;
  }

  let modifierBridgeBase = null;
  function installModifierBridge() {
    const base = engines.modifiers();
    if (!base || base.__luminousItemRuntimeBridge) return Boolean(base);
    if (modifierBridgeBase && global.LuminousUniversalModifiers !== modifierBridgeBase && global.LuminousUniversalModifiers?.__luminousItemRuntimeBridge) return true;
    const mergeTraits = (options = {}) => {
      const unit = options.unit || options.character || {};
      return { ...options, traits: [...asArray(options.traits), ...collectModifierTraits(unit)] };
    };
    const wrapped = Object.freeze({
      ...base,
      __luminousItemRuntimeBridge: true,
      __luminousItemRuntimeBase: base,
      resolveTraitModifiers(options = {}) { return base.resolveTraitModifiers(mergeTraits(options)); },
      resolveStats(options = {}) { return base.resolveStats(mergeTraits(options)); },
      resolveCharacterSnapshot(options = {}) { return base.resolveCharacterSnapshot(mergeTraits(options)); },
    });
    global.LuminousUniversalModifiers = wrapped;
    modifierBridgeBase = wrapped;
    emit("luminous:item-modifier-bridge-installed", { runtime: api });
    return true;
  }

  function describeCapabilities(item = {}) {
    return {
      definitionId: definitionId(item),
      category: categoryOf(item),
      functions: parseFunctionTypes(item),
      equipment: equipmentSchema(item),
      use: runtimeUseProfile(item),
      ammoResourceId: (categoryOf(item) === "ammo" || hasFunction(item, "ammo")) ? ammoResourceId(item) : null,
      moduleCapacity: hasFunction(item, "module_host") || ["weapon", "armor", "shield", "accessory"].includes(categoryOf(item)) ? moduleCapacity(item) : 0,
    };
  }

  function install() {
    installModifierBridge();
    return true;
  }

  const api = Object.freeze({
    normalizeId,
    itemId,
    definitionId,
    itemName,
    categoryOf,
    tagsOf,
    normalizedTags,
    tagValue,
    runtimeOf,
    parseFunctionTypes,
    hasFunction,
    equipmentSchema,
    hydrateForEquipment,
    findItem,
    quantityOf,
    setQuantity,
    consumeQuantity,
    makeInstance,
    equippedItems,
    equipItem,
    unequipItem,
    recoverResource,
    hpPercent,
    actionCostFor,
    runtimeUseProfile,
    useItem,
    resolveScheduledUse,
    advanceTime,
    repairItem,
    ammoResourceId,
    reloadAmmo,
    moduleCapacity,
    installModule,
    removeModule,
    recipeIngredients,
    canCraft,
    craft,
    collectModifierTraits,
    installModifierBridge,
    describeCapabilities,
    install,
  });

  global.LuminousItemRuntime = api;
  install();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
