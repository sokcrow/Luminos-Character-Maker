const EQUIPMENT_SLOTS = Object.freeze([
  ["mainHand", "Mano principal"],
  ["offHand", "Mano secundaria"],
  ["armor", "Armadura"],
  ["shield", "Escudo"],
  ["accessory0", "Accesorio A"],
  ["accessory1", "Accesorio B"]
]);

function text(value, fallback = "") {
  const out = String(value ?? "").trim();
  return out || fallback;
}

function itemName(item = {}) {
  return text(item.displayName || item.nombre || item.name || item.definitionId || item.id, "Item");
}

function itemKind(item = {}, equipmentBridge = null) {
  return text(equipmentBridge?.schemaOf?.(item)?.kind || item.category || item.itemType || item.type, "item");
}

function itemIcon(item = {}, iconRegistry = null) {
  const explicit = text(item.icon || item.iconPath || item.image || item.imagePath);
  if (explicit) return explicit;
  const candidates = [
    item.iconFamily,
    item.icon_family,
    item.definitionId,
    item.family,
    item.category,
    item.itemType
  ].map(value => text(value)).filter(Boolean);
  for (const candidate of candidates) {
    const resolved = text(iconRegistry?.resolveIcon?.(candidate, { fallback: false }));
    if (resolved) return resolved.startsWith("Assets/") ? `../../${resolved}` : resolved;
  }
  return "";
}

function itemRow(entry, equipmentBridge, iconRegistry, container) {
  const item = entry?.item || {};
  const instanceId = text(item.instanceId || entry?.key || item.definitionId || item.id);
  const equippedSlot = text(equipmentBridge?.itemEquippedSlot?.(entry?.unit, item));
  return {
    key: text(entry?.key || instanceId),
    instanceId,
    definitionId: text(item.definitionId || item.id),
    name: itemName(item),
    kind: itemKind(item, equipmentBridge),
    quantity: Math.max(0, Number(item.quantity ?? item.qty ?? item.count ?? 1) || 0),
    equipped: item.equipped === true || Boolean(equippedSlot),
    equippedSlot,
    compatibleSlots: equipmentBridge?.compatibleSlots?.(item) || [],
    icon: itemIcon(item, iconRegistry),
    container
  };
}

export const INVENTORY_EQUIPMENT_VIEW_CONTRACT = "luminous.inventory-equipment-view/v1";

export function createInventoryEquipmentViewModel({ unit, inventoryRuntime, equipmentBridge, iconRegistry } = {}) {
  const snapshot = inventoryRuntime?.inventorySnapshot?.(unit) || {
    activeSlotLimit: 0,
    stashSlotLimit: 0,
    active: [],
    stash: []
  };
  const describe = inventoryRuntime?.describeInventory?.(unit) || {};

  const active = (snapshot.active || []).map(entry => itemRow({ ...entry, unit }, equipmentBridge, iconRegistry, "active"));
  const stash = (snapshot.stash || []).map(entry => itemRow({ ...entry, unit }, equipmentBridge, iconRegistry, "stash"));
  const equipment = EQUIPMENT_SLOTS.map(([slot, label]) => {
    const item = equipmentBridge?.getSlotItem?.(unit, slot) || null;
    return {
      slot,
      label,
      item: item ? {
        instanceId: text(item.instanceId || item.definitionId || item.id),
        name: itemName(item),
        kind: itemKind(item, equipmentBridge),
        icon: itemIcon(item, iconRegistry)
      } : null
    };
  });

  return Object.freeze({
    contract: INVENTORY_EQUIPMENT_VIEW_CONTRACT,
    unitId: text(unit?.id, "unknown-unit"),
    activeSlots: Number(describe.activeSlots ?? active.length),
    activeSlotLimit: Number(snapshot.activeSlotLimit ?? describe.activeSlotLimit ?? 0),
    stashSlots: Number(describe.stashSlots ?? stash.length),
    stashSlotLimit: Number(snapshot.stashSlotLimit ?? describe.stashSlotLimit ?? 0),
    active,
    stash,
    equipment
  });
}
