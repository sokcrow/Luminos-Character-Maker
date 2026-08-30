(function (global) {
  "use strict";

  const base = global.LuminousItemEquipmentBridge;
  if (!base || base.__luminousApprovedEquipmentSlots) return;

  function isShield(item = {}) {
    return String(base.categoryOf?.(item) || item.category || item.tipo_categoria || "")
      .trim()
      .toLowerCase() === "shield";
  }

  function normalizeVisibleSlot(slot) {
    const normalized = base.normalizeSlot?.(slot) || slot;
    return normalized === "shield" ? "offHand" : normalized;
  }

  function compatibleSlots(item = {}) {
    if (isShield(item)) return ["offHand"];
    return (base.compatibleSlots?.(item) || []).filter((slot) => slot !== "shield");
  }

  function getSlotItem(unit, slot) {
    const visible = normalizeVisibleSlot(slot);
    if (visible === "offHand") {
      return base.getSlotItem?.(unit, "offHand") || base.getSlotItem?.(unit, "shield") || null;
    }
    return base.getSlotItem?.(unit, visible) || null;
  }

  function canEquipTo(unit, item, slot) {
    const visible = normalizeVisibleSlot(slot);
    if (visible === "offHand" && isShield(item)) return base.canEquipTo(unit, item, "offHand");
    if (!compatibleSlots(item).includes(visible)) {
      return { allowed: false, reason: "incompatible_equipment_slot", item, slot: visible };
    }
    return base.canEquipTo(unit, item, visible);
  }

  function equipTo(unit, item, slot, options = {}) {
    const visible = normalizeVisibleSlot(slot);
    const gate = canEquipTo(unit, item, visible);
    if (!gate?.allowed) return { equipped: false, ...gate };
    return base.equipTo(unit, item, visible, options);
  }

  function unequipSlot(unit, slot, options = {}) {
    return base.unequipSlot(unit, normalizeVisibleSlot(slot), options);
  }

  function itemEquippedSlot(unit, item) {
    const slot = base.itemEquippedSlot?.(unit, item) || null;
    return slot === "shield" ? "offHand" : slot;
  }

  global.LuminousItemEquipmentBridge = Object.freeze({
    ...base,
    __luminousApprovedEquipmentSlots: true,
    compatibleSlots,
    getSlotItem,
    canEquipTo,
    equipTo,
    unequipSlot,
    itemEquippedSlot,
  });
})(typeof window !== "undefined" ? window : globalThis);
