(function (global) {
  "use strict";

  if (global.LuminousItemEquipmentBridge) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemEquipmentBridge;
    return;
  }

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  function itemRuntime() { return global.LuminousItemRuntime || global.LuminousItemInventoryRuntime || null; }
  function inventoryRuntime() { return global.LuminousItemInventoryRuntime || itemRuntime(); }
  function persistenceRuntime() { return global.LuminousItemPersistenceRuntime || null; }
  function augmentationRuntime() { return global.LuminousItemAugmentationRuntime || null; }

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function itemId(item = {}) {
    const runtime = itemRuntime();
    return String(item.instanceId || item.instance_id || runtime?.itemId?.(item) || item.definitionId || item.id || item.key || "").trim();
  }

  function categoryOf(item = {}) {
    const runtime = itemRuntime();
    return normalizeId(runtime?.categoryOf?.(item) || item.category || item.tipo_categoria || item.itemType || item.type || "");
  }

  function schemaOf(item = {}) {
    const runtime = itemRuntime();
    return runtime?.equipmentSchema?.(item) || item.equipment || item.equipmentSchema || {};
  }

  function equipmentStore(unit = {}, create = false) {
    if (unit.equipment && typeof unit.equipment === "object" && !Array.isArray(unit.equipment)) {
      if (!Array.isArray(unit.equipment.accessories)) unit.equipment.accessories = [];
      return unit.equipment;
    }
    if (!create) return { accessories: [] };
    unit.equipment = { accessories: [] };
    return unit.equipment;
  }

  function sameItem(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return itemId(a) && itemId(a) === itemId(b);
  }

  function normalizeSlot(slot) {
    const id = normalizeId(slot);
    const aliases = {
      main: "mainHand", main_hand: "mainHand", mainhand: "mainHand",
      off: "offHand", off_hand: "offHand", offhand: "offHand",
      armour: "armor",
      accessory: "accessory0", accessory_a: "accessory0", accessory_0: "accessory0",
      accessory_b: "accessory1", accessory_1: "accessory1",
      augment: "augment0", augmentation: "augment0", augment_body: "augment0",
    };
    if (aliases[id]) return aliases[id];
    if (/^accessory\d+$/.test(id)) return id;
    if (/^augment\d+$/.test(id)) return id;
    if (["mainHand", "offHand", "armor", "shield"].includes(slot)) return slot;
    if (["armor", "shield"].includes(id)) return id;
    return slot;
  }

  function accessoryIndex(slot) {
    const match = String(normalizeSlot(slot)).match(/^accessory(\d+)$/);
    return match ? Number(match[1]) : -1;
  }

  function augmentIndex(slot) {
    const match = String(normalizeSlot(slot)).match(/^augment(\d+)$/);
    return match ? Number(match[1]) : -1;
  }

  function getSlotItem(unit = {}, slot) {
    const normalized = normalizeSlot(slot);
    const store = equipmentStore(unit);
    const accessory = accessoryIndex(normalized);
    if (accessory >= 0) return store.accessories?.[accessory] || null;
    if (augmentIndex(normalized) >= 0) {
      const augments = augmentationRuntime()?.installedAugments?.(unit)?.value || unit.augmentations || unit.augments || [];
      return augments[augmentIndex(normalized)] || null;
    }
    return store[normalized] || null;
  }

  function equippedSlots(unit = {}) {
    const store = equipmentStore(unit);
    const augments = augmentationRuntime()?.installedAugments?.(unit)?.value || unit.augmentations || unit.augments || [];
    return {
      mainHand: store.mainHand || null,
      offHand: store.offHand || null,
      armor: store.armor || null,
      shield: store.shield || null,
      accessories: asArray(store.accessories).filter(Boolean),
      augments: asArray(augments).filter(Boolean),
    };
  }

  function clearPointer(unit, item) {
    if (!unit || !item) return;
    const store = equipmentStore(unit, true);
    ["mainHand", "offHand", "armor", "shield"].forEach((slot) => {
      if (sameItem(store[slot], item)) delete store[slot];
    });
    store.accessories = asArray(store.accessories).filter((entry) => !sameItem(entry, item));
  }

  function findActiveItem(unit, ref) {
    const runtime = inventoryRuntime();
    const active = runtime?.activeContainer?.(unit)?.value || unit?.inventario_activo || unit?.activeInventory || {};
    const wanted = typeof ref === "object" ? itemId(ref) : String(ref || "").trim();
    if (!wanted) return typeof ref === "object" ? ref : null;
    for (const [key, item] of Object.entries(active || {})) {
      if (!item) continue;
      const ids = [key, itemId(item), item.instanceId, item.definitionId, item.id, item.key].map((value) => String(value ?? "").trim());
      if (ids.includes(wanted)) return item;
    }
    return null;
  }

  function compatibleSlots(item = {}) {
    const category = categoryOf(item);
    const schema = schemaOf(item);
    if (category === "weapon") {
      const handCost = Math.max(1, Number(schema.handCost || item.handCost || item.handsRequired || 1));
      return handCost >= 2 ? ["mainHand"] : ["mainHand", "offHand"];
    }
    if (category === "shield") return ["offHand", "shield"];
    if (category === "armor") return ["armor"];
    if (category === "accessory") return ["accessory0", "accessory1"];
    if (["augmentation", "augment", "aumento", "alteracion_corporal"].includes(category)) return ["augment0", "augment1"];
    return [];
  }

  function canEquipTo(unit, itemInput, slot) {
    const item = typeof itemInput === "object" ? itemInput : findActiveItem(unit, itemInput);
    const normalized = normalizeSlot(slot);
    if (!unit || !item) return { allowed: false, reason: "missing_unit_or_item", item, slot: normalized };
    if (!compatibleSlots(item).includes(normalized)) return { allowed: false, reason: "incompatible_equipment_slot", item, slot: normalized };

    if (augmentIndex(normalized) >= 0) {
      const aug = augmentationRuntime();
      if (!aug?.canInstallAugment) return { allowed: false, reason: "augmentation_runtime_unavailable", item, slot: normalized };
      const gate = aug.canInstallAugment(unit, item);
      return gate.allowed ? { allowed: true, item, slot: normalized, augmentation: gate } : { ...gate, item, slot: normalized };
    }

    const runtime = itemRuntime();
    if (!runtime?.equipItem) return { allowed: false, reason: "item_runtime_unavailable", item, slot: normalized };
    return { allowed: true, item, slot: normalized };
  }

  function unequipItemEverywhere(unit, item) {
    if (!item) return { unequipped: false, reason: "missing_item" };
    const runtime = itemRuntime();
    const result = runtime?.unequipItem ? runtime.unequipItem(unit, item) : { unequipped: true, item };
    clearPointer(unit, item);
    item.equipped = false;
    return result?.unequipped === false ? result : { unequipped: true, item, unit };
  }

  function equipTo(unit, itemInput, slot, options = {}) {
    const gate = canEquipTo(unit, itemInput, slot);
    if (!gate.allowed) return { equipped: false, ...gate };

    const item = gate.item;
    const normalized = gate.slot;
    const augmentSlot = augmentIndex(normalized);
    if (augmentSlot >= 0) {
      const aug = augmentationRuntime();
      const existing = getSlotItem(unit, normalized);
      if (existing && !sameItem(existing, item)) {
        const removed = aug?.removeAugment?.(unit, existing, options) || { removed: false, reason: "augmentation_runtime_unavailable" };
        if (removed.removed === false) return { equipped: false, reason: removed.reason || "augmentation_slot_occupied", item, slot: normalized };
      }
      const installed = aug.installAugment(unit, item, options);
      if (!installed.installed) return { equipped: false, reason: installed.reason || "augmentation_install_failed", item, slot: normalized, validation: installed };
      emit("luminous:item-equipment-bridge-equipped", { unit, item, slot: normalized, augmentation: true });
      return { equipped: true, unit, item, slot: normalized, augmentation: true, result: installed };
    }

    const runtime = itemRuntime();
    const schema = schemaOf(item);
    const category = categoryOf(item);
    const store = equipmentStore(unit, true);

    const occupied = getSlotItem(unit, normalized);
    if (occupied && !sameItem(occupied, item)) {
      const removed = unequipItemEverywhere(unit, occupied);
      if (removed.unequipped === false) return { equipped: false, reason: removed.reason || "equipment_slot_occupied", item, slot: normalized };
    }

    if (category === "weapon" && Number(schema.handCost || item.handCost || item.handsRequired || 1) >= 2) {
      [store.mainHand, store.offHand].filter(Boolean).forEach((entry) => {
        if (!sameItem(entry, item)) unequipItemEverywhere(unit, entry);
      });
    }

    const result = runtime.equipItem(unit, item, options);
    if (!result?.equipped) return { equipped: false, reason: result?.reason || "equipment_assignment_failed", item, slot: normalized, validation: result };

    clearPointer(unit, item);

    if (category === "weapon") {
      const handCost = Math.max(1, Number(schema.handCost || item.handCost || item.handsRequired || 1));
      if (handCost >= 2) {
        store.mainHand = item;
        store.offHand = item;
      } else if (normalized === "offHand") {
        store.offHand = item;
      } else {
        store.mainHand = item;
      }
    } else if (category === "shield") {
      store.shield = item;
      store.offHand = item;
    } else if (category === "armor") {
      store.armor = item;
    } else if (category === "accessory") {
      const index = Math.max(0, accessoryIndex(normalized));
      if (!Array.isArray(store.accessories)) store.accessories = [];
      const next = [...store.accessories];
      next[index] = item;
      store.accessories = next;
    }

    item.equipped = true;
    item.equippedSlot = normalized;
    item.equipped_slot = null;
    emit("luminous:item-equipment-bridge-equipped", { unit, item, slot: normalized, result });
    return { equipped: true, unit, item, slot: normalized, result };
  }

  function unequipSlot(unit, slot, options = {}) {
    const normalized = normalizeSlot(slot);
    const item = getSlotItem(unit, normalized);
    if (!item) return { unequipped: false, reason: "equipment_slot_empty", slot: normalized };

    if (augmentIndex(normalized) >= 0) {
      const aug = augmentationRuntime();
      const result = aug?.removeAugment?.(unit, item, options) || { removed: false, reason: "augmentation_runtime_unavailable" };
      if (!result.removed) return { unequipped: false, reason: result.reason || "augmentation_remove_failed", slot: normalized, item };
      emit("luminous:item-equipment-bridge-unequipped", { unit, item, slot: normalized, augmentation: true });
      return { unequipped: true, unit, item, slot: normalized, augmentation: true, result };
    }

    const result = unequipItemEverywhere(unit, item);
    if (result.unequipped === false) return { ...result, slot: normalized };
    emit("luminous:item-equipment-bridge-unequipped", { unit, item, slot: normalized });
    return { unequipped: true, unit, item, slot: normalized, result };
  }

  function itemEquippedSlot(unit, item) {
    if (!unit || !item) return null;
    for (const slot of ["mainHand", "offHand", "armor", "shield"]) if (sameItem(getSlotItem(unit, slot), item)) return slot;
    const accessories = equipmentStore(unit).accessories || [];
    for (let index = 0; index < accessories.length; index += 1) if (sameItem(accessories[index], item)) return `accessory${index}`;
    const augments = augmentationRuntime()?.installedAugments?.(unit)?.value || [];
    for (let index = 0; index < augments.length; index += 1) if (sameItem(augments[index], item)) return `augment${index}`;
    return null;
  }

  function moveItem(unit, ref, from, to, amount = null, options = {}) {
    const inventory = inventoryRuntime();
    if (!inventory?.moveItem) return { moved: false, reason: "inventory_runtime_unavailable" };
    const item = inventory.findItem?.(unit, ref, { container: from }) || findActiveItem(unit, ref);
    if (normalizeId(from) === "active" && normalizeId(to) === "stash" && item && itemEquippedSlot(unit, item)) unequipItemEverywhere(unit, item);
    return inventory.moveItem(unit, ref, from, to, amount, options);
  }

  async function persist(db, playerId, unit, options = {}) {
    const persistence = persistenceRuntime();
    if (!persistence?.saveInventoryState) return { saved: false, reason: "persistence_runtime_unavailable" };
    return persistence.saveInventoryState(db, playerId, unit, options);
  }

  const api = Object.freeze({
    version: 1,
    normalizeSlot,
    categoryOf,
    schemaOf,
    equipmentStore,
    getSlotItem,
    equippedSlots,
    compatibleSlots,
    canEquipTo,
    equipTo,
    unequipSlot,
    itemEquippedSlot,
    moveItem,
    persist,
  });

  global.LuminousItemEquipmentBridge = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
