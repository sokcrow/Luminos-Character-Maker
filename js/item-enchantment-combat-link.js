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
    if (skill.isDefense === true || ["spell", "roll", "save", "check", "guard", "evade", "counter", "defense"].includes(type) || family === "spell" || family === "defense") return false;
    return Boolean(skill.isItemSkill === true || skill.is_item_skill === true ||
      skill.requiresWeapon === true || skill.requires_weapon === true ||
      source === "weapon" || source === "equipment" ||
      (family === "attack" && (skill.requiresEquipment === true || skill.requires_equipment === true)) ||
      ((type === "attack" || type === "skill") && (skill.weaponDefinitionId || skill.weaponSlot)));
  }
  function equippedWeapons(unit = {}) {
    const equipment = unit.equipment || {};
    const seen = new Set();
    return [equipment.mainHand, equipment.offHand].filter((item) => {
      const id = itemInstanceId(item);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return normalize(item.itemType || item.category || item.type || item.equipment?.kind || item.runtime?.equipment?.kind) === "weapon";
    });
  }
  // One compatibility rule for Combat Master, Theatre's skill HUD and any
  // future action-picker. Skills remain learned even if no equipped weapon can
  // execute them. Damage type is never silently changed to match the item.
  const DAMAGE_ALIASES = Object.freeze({
    blunt: "blunt", bludgeoning: "blunt", contundente: "blunt", contusion: "blunt",
    slash: "slash", slashing: "slash", cortante: "slash", corte: "slash",
    pierce: "pierce", piercing: "pierce", perforante: "pierce", perforacion: "pierce"
  });
  const physicalType = value => DAMAGE_ALIASES[normalize(value)] || null;
  const list = value => value == null ? [] : Array.isArray(value) ? value.flatMap(list)
    : typeof value === "string" ? value.split(/[,|;]/).map(part => part.trim()).filter(Boolean) : [value];
  function independentSkill(skill = {}) {
    const usage = normalize(skill.weaponUsage || skill.weapon_usage || skill.attackSource || skill.attack_source);
    const kind = normalize(skill.kind || skill.type || skill.skillType);
    const family = normalize(skill.skillFamily || skill.skill_family);
    const source = normalize(skill.sourceType || skill.source_type);
    return skill.weaponIndependent === true || skill.weapon_independent === true ||
      skill.isUnarmed === true || skill.is_unarmed === true ||
      ["independent", "unarmed", "natural", "innate", "spell", "shield"].includes(usage) ||
      ["spell", "magic", "unarmed", "natural"].includes(source) ||
      skill.isDefense === true || skill.isSpell === true ||
      ["spell", "defense", "guard", "evade", "counter", "roll", "save", "check"].includes(kind) ||
      ["spell", "defense"].includes(family);
  }
  function physicalAttackSkill(skill = {}) {
    if (independentSkill(skill)) return false;
    const kind = normalize(skill.kind || skill.type || skill.skillType || "attack");
    return ["attack", "skill", "offense", "offensive"].includes(kind) &&
      Boolean(physicalType(skill.damageType || skill.damage_type || skill.physicalType || skill.tipo_dano));
  }
  function requiresEquippedWeapon(unit = {}, skill = {}) {
    if (independentSkill(skill)) return false;
    return isWeaponSkill(skill) || (equippedWeapons(unit).length > 0 && physicalAttackSkill(skill));
  }
  function weaponDamageTypes(weapon = {}) {
    const explicit = [
      ...list(weapon.damageTypes || weapon.damage_types),
      ...list(weapon.runtime?.weapon?.damageTypes),
      ...list(weapon.equipment?.damageTypes),
      weapon.damageType, weapon.damage_type, weapon.physicalType,
      weapon.runtime?.weapon?.damageType, weapon.equipment?.damageType
    ];
    return [...new Set(explicit.map(physicalType).filter(Boolean))];
  }
  function allowedWeaponDamageTypes(skill = {}) {
    // Deliberately authored alternatives permit e.g. a named pommel technique
    // doing Blunt with a Slash weapon. Without an explicit exception, match
    // the Skill's physical type to the weapon's supported type(s).
    const authored = skill.compatibleWeaponDamageTypes ?? skill.compatible_weapon_damage_types ??
      skill.allowedWeaponDamageTypes ?? skill.weaponDamageTypes;
    const types = authored == null
      ? [skill.damageType || skill.damage_type || skill.physicalType || skill.tipo_dano]
      : list(authored);
    return [...new Set(types.map(physicalType).filter(Boolean))];
  }
  function weaponSupportsSkill(weapon = {}, skill = {}) {
    if (independentSkill(skill)) return true;
    const required = allowedWeaponDamageTypes(skill);
    if (!required.length) return true; // Skills without physical type use existing source restrictions.
    return weaponDamageTypes(weapon).some(type => required.includes(type));
  }
  function compatibleWeapons(unit = {}, skill = {}) {
    const slot = normalize(skill.weaponSlot || skill.weapon_slot);
    const requiredDef = clean(skill.weaponDefinitionId || skill.weapon_definition_id);
    return equippedWeapons(unit).filter(item => {
      if (requiredDef && definitionId(item) !== requiredDef) return false;
      const main = itemInstanceId(unit.equipment?.mainHand) === itemInstanceId(item);
      const off = itemInstanceId(unit.equipment?.offHand) === itemInstanceId(item);
      if (["main_hand", "mainhand", "main"].includes(slot) && !main) return false;
      if (["off_hand", "offhand", "off"].includes(slot) && !off) return false;
      return weaponSupportsSkill(item, skill);
    });
  }
  function skillAvailability(unit = {}, skill = {}) {
    if (!requiresEquippedWeapon(unit, skill)) return { available: true, reason: null, needsWeapon: false };
    const weapons = equippedWeapons(unit);
    if (!weapons.length) return { available: false, reason: "weapon_source_ambiguous_or_missing", needsWeapon: true };
    if (!compatibleWeapons(unit, skill).length) return {
      available: false, reason: "weapon_damage_type_incompatible", needsWeapon: true
    };
    return { available: true, reason: null, needsWeapon: true };
  }
  function bindTrustedSkill(unit, skillInput = {}, requestedInstanceId = null) {
    const skill = clone(skillInput);
    const authored = clean(skill.sourceItemInstanceId || skill.weaponInstanceId || skill.equipmentInstanceId);
    const requested = clean(requestedInstanceId);
    const supplied = clean(requested || authored);
    delete skill.sourceItemInstanceId;
    delete skill.weaponInstanceId;
    delete skill.equipmentInstanceId;
    // Never turn generic class/spell Skills into weapon Skills merely because a weapon is equipped.
    if (!requiresEquippedWeapon(unit, skill)) return { skill, bound: false, reason: "not_weapon_skill" };
    if (authored && requested && authored !== requested) {
      return { skill, bound: false, reason: "weapon_source_conflicts_with_skill" };
    }
    const weapons = equippedWeapons(unit);
    const choices = compatibleWeapons(unit, skill);
    let selected = supplied ? choices.find((item) => itemInstanceId(item) === supplied) : null;
    if (!selected && !supplied && choices.length === 1) selected = choices[0];
    if (!selected) return { skill, bound: false, reason:
      weapons.length && !choices.length ? "weapon_damage_type_incompatible"
      : supplied ? "weapon_not_equipped_or_incompatible" : "weapon_source_ambiguous_or_missing" };
    skill.sourceItemInstanceId = itemInstanceId(selected);
    skill.weaponInstanceId = itemInstanceId(selected);
    return { skill, bound: true, instanceId: itemInstanceId(selected) };
  }
  const api = Object.freeze({
    version: 2, activeItemMap, resolveEquipment, isWeaponSkill, equippedWeapons, bindTrustedSkill,
    physicalType, weaponDamageTypes, allowedWeaponDamageTypes, weaponSupportsSkill,
    independentSkill, physicalAttackSkill, requiresEquippedWeapon, compatibleWeapons, skillAvailability,
  });
  global.LuminousEnchantmentCombatLink = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
