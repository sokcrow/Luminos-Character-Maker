/* DM character equipment/implant migration. Pure per-player snapshot mutation. */
(function (global) {
  "use strict";
  if (global.LuminousDmCharacterGearCore) return;
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const str = value => String(value == null ? "" : value).trim();
  const active = unit => unit.inventario_activo && typeof unit.inventario_activo === "object" ? unit.inventario_activo : {};
  const stash = unit => unit.inventario_stash && typeof unit.inventario_stash === "object" ? unit.inventario_stash : {};
  const idOf = item => str(item && (item.instanceId || item.instance_id));
  const slots = ["mainHand", "offHand", "armor", "shield"];
  const success = (unit, label) => ({ ok: true, unit, label });
  const failed = reason => ({ ok: false, reason });
  const refsFor = unit => unit.itemEquipmentRefs && typeof unit.itemEquipmentRefs === "object" ? unit.itemEquipmentRefs : {};
  const labelOf = item => str(item && (item.displayName || item.nombre || item.name || item.definitionId)) || "Objeto";

  function findItem(unit, source, key) {
    const container = source === "stash" ? stash(unit) : active(unit);
    if (!Object.prototype.hasOwnProperty.call(container, key)) return null;
    const item = container[key];
    return item && typeof item === "object" && idOf(item) ? item : null;
  }

  function hydrateEquipment(unit) {
    const refs = refsFor(unit);
    const bag = active(unit);
    const byId = id => Object.values(bag).find(item => idOf(item) === str(id)) || null;
    const equipment = {};
    for (const slot of slots) if (refs[slot]) equipment[slot] = byId(refs[slot]);
    equipment.accessories = Array.isArray(refs.accessoryIds) ? refs.accessoryIds.map(byId).filter(Boolean) : [];
    for (const item of [...slots.map(k => equipment[k]), ...equipment.accessories].filter(Boolean)) item.equipped = true;
    unit.equipment = equipment;
    return equipment;
  }

  function refSnapshot(equipment) {
    const result = {};
    for (const slot of slots) result[slot] = idOf(equipment[slot]) || null;
    result.accessoryIds = (equipment.accessories || []).map(idOf).filter(Boolean);
    return result;
  }

  function apply(playerInput, command = {}, deps = {}) {
    if (!playerInput || typeof playerInput !== "object") return failed("Jugador no encontrado");
    const equipment = deps.equipment || global.LuminousItemEquipmentBridge;
    const augmentation = deps.augmentation || global.LuminousItemAugmentationRuntime;
    const inventory = deps.inventory || global.LuminousItemInventoryRuntime;
    const unit = clone(playerInput);
    const type = str(command.type);
    const slot = str(command.slot);
    const key = str(command.key);

    if (type === "equip" || type === "unequip") {
      if (!equipment || typeof equipment.equipTo !== "function" || typeof equipment.unequipSlot !== "function")
        return failed("Motor de equipamiento no disponible");
      const hadEquipment = Object.prototype.hasOwnProperty.call(unit, "equipment");
      hydrateEquipment(unit);
      let result, item;
      if (type === "equip") {
        item = findItem(unit, "active", key);
        if (!item) return failed("El objeto debe existir en el Inventario Activo");
        if (Number(item.quantity || item.cantidad || 1) !== 1) return failed("Separa este conjunto en objetos individuales antes de equipar");
        const permitted = equipment.compatibleSlots(item);
        if (!Array.isArray(permitted) || !permitted.includes(slot) || slot.startsWith("augment"))
          return failed("Ese objeto no puede ocupar ese espacio");
        result = equipment.equipTo(unit, item, slot);
        if (!result.equipped) return failed(result.reason || "No se pudo equipar por las restricciones corporales");
      } else {
        const current = equipment.getSlotItem(unit, slot);
        if (!current) return failed("Ese espacio ya está vacío");
        item = current;
        result = equipment.unequipSlot(unit, slot);
        if (!result.unequipped) return failed(result.reason || "No puede retirarse ese equipo");
      }
      unit.itemEquipmentRefs = refSnapshot(unit.equipment);
      if (!hadEquipment) delete unit.equipment; // RTDB stores equipment refs, not redundant instances.
      return success(unit, labelOf(item) + (type === "equip" ? " equipado" : " desequipado"));
    }

    if (type === "install") {
      if (!augmentation || typeof augmentation.installAugment !== "function") return failed("Motor de Augments no disponible");
      const source = command.source === "stash" ? "stash" : "active";
      const item = findItem(unit, source, key);
      if (!item) return failed("El Augment no existe en el inventario indicado");
      if (Number(item.quantity || item.cantidad || 1) !== 1) return failed("Solo se puede implantar una instancia individual");
      const result = augmentation.installAugment(unit, item, { installedAt: Number(command.at) || Date.now() });
      if (!result.installed) return failed(result.reason || "No se puede instalar en esa anatomía");
      delete (source === "stash" ? stash(unit) : active(unit))[key];
      // Installed Augments live on the character, never as carried inventory.
      return success(unit, labelOf(item) + " instalado en el personaje");
    }

    if (type === "remove") {
      if (!augmentation || typeof augmentation.findInstalledAugment !== "function") return failed("Motor de Augments no disponible");
      const item = augmentation.findInstalledAugment(unit, key);
      if (!item) return failed("El Augment no está instalado");
      const result = augmentation.removeAugment(unit, item);
      if (!result.removed) return failed(result.reason || "Este Augment no se puede extraer");
      if (!inventory || typeof inventory.insertItem !== "function") return failed("Motor de inventario no disponible");
      const destination = command.destination === "stash" ? "stash" : "active";
      const inserted = inventory.insertItem(unit, result.item, destination, { currentOwnerId: unit.id || null });
      if (!inserted || !inserted.inserted || Number(inserted.remaining || 0) !== 0)
        return failed("No hay espacio para el Augment extraído. Libera espacio antes de retirarlo");
      return success(unit, labelOf(item) + " extraído al " + (destination === "stash" ? "alijo" : "inventario activo"));
    }
    return failed("Operación de equipo desconocida");
  }

  const api = Object.freeze({ version: 1, apply, hydrateEquipment, refSnapshot, idOf, labelOf, findItem });
  global.LuminousDmCharacterGearCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
