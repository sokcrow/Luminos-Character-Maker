(function (global) {
  "use strict";
  if (global.LuminousEnchantmentCombatLink) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEnchantmentCombatLink;
    return;
  }

  const clean = (value) => String(value ?? "").trim();
  const normalize = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const itemInstanceId = (item) => clean(item?.instanceId || item?.instance_id);
  const definitionId = (item) => clean(item?.definitionId || item?.definition_id || item?.id);
  const objectItems = (values) => values && typeof values === "object" ? Object.values(values).filter(Boolean) : [];

  function activeItemMap(inventory = {}) {
    const map = {};
    for (const item of objectItems(inventory)) {
      if (item && typeof item === "object" && itemInstanceId(item) && Number(item.quantity ?? item.cantidad ?? 1) > 0) {
        map[itemInstanceId(item)] = item;
      }
    }
    return map;
  }
  function resolveEquipment(unit = {}, player = null, liveInventory = null) {
    const playerData = player && typeof player === "object" ? player : {};
    const inventory = liveInventory || playerData.inventario_activo || unit.inventario_activo || {};
    const active = activeItemMap(inventory);
    const rawEquipment = playerData.equipment || unit.equipment || {};
    const refs = playerData.itemEquipmentRefs || unit.itemEquipmentRefs || {};
    function resolve(ref) {
      const id = typeof ref === "object" ? itemInstanceId(ref) : clean(ref);
      return id && active[id] ? active[id] : null;
    }
    const resolved = {};
    for (const key of ["mainHand", "offHand", "armor", "shield"]) {
      resolved[key] = resolve(refs[key]) || resolve(rawEquipment[key]) || null;
    }
    const accessoryRefs = Array.isArray(refs.accessoryIds) ? refs.accessoryIds :
      Array.isArray(rawEquipment.accessories) ? rawEquipment.accessories : [];
    resolved.accessories = accessoryRefs.map(resolve).filter(Boolean);
    const attuned = Array.isArray(playerData.attunedItemInstanceIds)
      ? playerData.attunedItemInstanceIds
      : Array.isArray(unit.attunedItemInstanceIds) ? unit.attunedItemInstanceIds : [];
    return { equipment: resolved, attunedItemInstanceIds: attuned.map(clean).filter(Boolean) };
  }

  function isWeaponSkill(skill = {}) {
    const type = normalize(skill.type || skill.skillType);
    const family = normalize(skill.skillFamily || skill.skill_family);
    const source = normalize(skill.sourceType || skill.source_type);
    return skill.isItemSkill === true || skill.is_item_skill === true ||
      skill.requiresWeapon === true || skill.requires_weapon === true ||
      source === "weapon" || source === "equipment" ||
      (family === "attack" && (skill.requiresEquipment === true || skill.requires_equipment === true)) ||
      ((type === "attack" || type === "skill") && (skill.weaponDefinitionId || skill.weaponSlot));
  }
  function equippedWeapons(unit = {}) {
    const equipment = unit.equipment || {};
    const seen = new Set();
    return [equipment.mainHand, equipment.offHand].filter((item) => {
      const id = itemInstanceId(item);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return normalize(item.itemType || item.category || item.type) === "weapon";
    });
  }
  function bindTrustedSkill(unit, skillInput = {}, requestedInstanceId = null) {
    const skill = clone(skillInput);
    const supplied = clean(requestedInstanceId || skill.sourceItemInstanceId || skill.weaponInstanceId || skill.equipmentInstanceId);
    delete skill.sourceItemInstanceId;
    delete skill.weaponInstanceId;
    delete skill.equipmentInstanceId;
    // Never turn generic class/spell Skills into weapon Skills merely because a weapon is equipped.
    if (!isWeaponSkill(skill)) return { skill, bound: false, reason: "not_weapon_skill" };
    const weapons = equippedWeapons(unit);
    const slot = normalize(skill.weaponSlot || skill.weapon_slot);
    const requiredDef = clean(skill.weaponDefinitionId || skill.weapon_definition_id);
    const choices = weapons.filter((item) => {
      if (requiredDef && definitionId(item) !== requiredDef) return false;
      const main = itemInstanceId(unit.equipment?.mainHand) === itemInstanceId(item);
      const off = itemInstanceId(unit.equipment?.offHand) === itemInstanceId(item);
      if (["main_hand", "mainhand", "main"].includes(slot) && !main) return false;
      if (["off_hand", "offhand", "off"].includes(slot) && !off) return false;
      return true;
    });
    let selected = supplied ? choices.find((item) => itemInstanceId(item) === supplied) : null;
    if (!selected && !supplied && choices.length === 1) selected = choices[0];
    if (!selected) return { skill, bound: false, reason: supplied ? "weapon_not_equipped_or_incompatible" : "weapon_source_ambiguous_or_missing" };
    skill.sourceItemInstanceId = itemInstanceId(selected);
    skill.weaponInstanceId = itemInstanceId(selected);
    return { skill, bound: true, instanceId: itemInstanceId(selected) };
  }
  const api = Object.freeze({
    version: 1, activeItemMap, resolveEquipment, isWeaponSkill, equippedWeapons, bindTrustedSkill,
  });
  global.LuminousEnchantmentCombatLink = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
