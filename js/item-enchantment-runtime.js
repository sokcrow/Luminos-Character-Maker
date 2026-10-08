(function LuminousEnchantmentCore(global) {
  "use strict";
  if (global.LuminousItemEnchantmentRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemEnchantmentRuntime;
    return;
  }

  const VERSION = 1;
  const TIERS = Object.freeze([1, 2, 3]);
  const FOCUS_BY_KIND = Object.freeze({
    weapon: "offensive_level",
    armor: "defensive_level",
    shield: "guard_power",
  });
  const CHANNELS_BY_KIND = Object.freeze({
    weapon: Object.freeze(["offensive_level", "base_power", "final_power", "clash_power"]),
    armor: Object.freeze(["defensive_level", "guard_power"]),
    shield: Object.freeze(["guard_power", "defensive_level"]),
    accessory: Object.freeze(["offensive_level", "defensive_level", "guard_power", "speed", "min_speed", "max_speed"]),
    valuable: Object.freeze(["offensive_level", "defensive_level", "guard_power", "speed", "min_speed", "max_speed"]),
  });

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const norm = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
  const itemId = (item) => String(item?.instanceId || item?.instance_id || "").trim();
  function kindOf(item) {
    const contract = global.LuminousEquipmentEnhancementContract;
    if (contract?.kindOf) return contract.kindOf(item);
    return norm(item?.itemType || item?.category || item?.equipment?.kind || item?.kind || item?.type);
  }
  function emit(name, detail) {
    if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
      try { global.dispatchEvent(new global.CustomEvent(name, { detail })); } catch (_) {}
    }
  }
  function tierOf(input) {
    const tier = Number(input?.tier ?? input?.level ?? input?.enhancementLevel);
    return Number.isInteger(tier) ? tier : NaN;
  }
  function validate(item, request = {}, options = {}) {
    if (!item || typeof item !== "object") return { valid: false, reason: "missing_item" };
    if (!itemId(item)) return { valid: false, reason: "missing_item_instance_id" };
    const kind = kindOf(item);
    if (!hasOwn(CHANNELS_BY_KIND, kind)) return { valid: false, reason: "ineligible_equipment_kind", kind };
    const tier = tierOf(request);
    if (!TIERS.includes(tier)) return { valid: false, reason: "unsupported_enchantment_level", kind, tier: Number.isNaN(tier) ? null : tier };
    if (request.enhancementSource != null && norm(request.enhancementSource) !== "enchantment") {
      return { valid: false, reason: "positive_enhancement_requires_enchantment_source", kind, tier };
    }
    if (["accessory", "valuable"].includes(kind) && item.enchantmentReady !== true) {
      return { valid: false, reason: "item_not_enchantment_ready", kind };
    }
    if ((item.enchantment || Number(item.enhancementLevel) > 0) && options.replace !== true) {
      return { valid: false, reason: "already_enchanted", kind };
    }
    const channel = norm(request.channel || request.focus?.channel || FOCUS_BY_KIND[kind]);
    if (!CHANNELS_BY_KIND[kind].includes(channel)) return { valid: false, reason: "incompatible_enchantment_channel", kind, channel };
    return { valid: true, kind, tier, channel };
  }
  function applyEnchantment(item, request = {}, options = {}) {
    const gate = validate(item, request, options);
    if (!gate.valid) return { applied: false, ...gate };
    const enchantment = {
      schemaVersion: VERSION,
      tier: gate.tier,
      kind: gate.kind,
      focus: { channel: gate.channel, value: gate.tier },
    };
    if (options.creatorId != null) enchantment.creatorId = String(options.creatorId);
    item.enhancementLevel = gate.tier;
    item.enhancementSource = "enchantment";
    item.enchanted = true;
    item.enchantment = enchantment;
    emit("luminous:item-enchanted", { itemInstanceId: itemId(item), enchantment: clone(enchantment) });
    return { applied: true, kind: gate.kind, enchantment: clone(enchantment), item };
  }
  function activeEnchantment(item) {
    if (!item || norm(item.enhancementSource) !== "enchantment" || item.enchanted !== true) return null;
    const ench = item.enchantment;
    if (!ench || ench.schemaVersion !== VERSION || !TIERS.includes(ench.tier)) return null;
    if (Number(item.enhancementLevel) !== ench.tier || kindOf(item) !== ench.kind) return null;
    if (!CHANNELS_BY_KIND[ench.kind]?.includes(ench.focus?.channel) || ench.focus?.value !== ench.tier) return null;
    return ench;
  }
  function removeEnchantment(item) {
    if (!activeEnchantment(item)) return { removed: false, reason: "item_not_enchanted" };
    item.enchantment = null;
    item.enhancementLevel = 0;
    item.enhancementSource = "mundane";
    item.enchanted = false;
    emit("luminous:item-enchantment-removed", { itemInstanceId: itemId(item) });
    return { removed: true, item };
  }
  function lookup(unit, ref) {
    if (!ref) return null;
    if (typeof ref === "object") return ref;
    const key = String(ref);
    const stores = [unit?.inventario_activo, unit?.inventario_stash, unit?.activeInventory, unit?.stashInventory];
    for (const store of stores) {
      if (store && typeof store === "object") {
        if (store[key]) return store[key];
        if (Array.isArray(store)) {
          const found = store.find((item) => itemId(item) === key);
          if (found) return found;
        }
      }
    }
    return null;
  }
  function requiresAttunement(item) {
    return item.requiresAttunement === true || item.requires_attunement === true ||
      item.magic?.requiresAttunement === true || item.runtime?.magic?.requiresAttunement === true;
  }
  function isAttuned(unit, item) {
    const magic = global.LuminousItemMagicRuntime;
    if (typeof magic?.isAttuned === "function") return magic.isAttuned(unit, item);
    return (unit?.attunedItemInstanceIds || []).some((entry) => String(entry) === itemId(item));
  }
  function skillUsesItem(skill, item) {
    if (!skill || typeof skill !== "object") return false;
    const ref = skill.sourceItemInstanceId || skill.weaponInstanceId || skill.itemInstanceId ||
      skill.equipmentInstanceId || skill.equipmentId || skill.equipment_id;
    return Boolean(ref && String(ref) === itemId(item));
  }
  function collectEquippedTraits(unit = {}, options = {}) {
    if (options.equipment?.equipmentInactive) return [];
    const equipment = unit.equipment && typeof unit.equipment === "object" ? unit.equipment : {};
    const slots = [
      ["weapon", equipment.mainHand || equipment.main_hand],
      ["weapon", equipment.offHand || equipment.off_hand],
      ["armor", equipment.armor],
      ["shield", equipment.shield],
      ...(Array.isArray(equipment.accessories) ? equipment.accessories.map((ref) => ["accessory", ref]) : []),
    ];
    const traits = [];
    const seen = new Set();
    for (const [slot, ref] of slots) {
      const item = lookup(unit, ref);
      const id = itemId(item);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const enchanted = activeEnchantment(item);
      if (!enchanted) continue;
      const kind = kindOf(item);
      if (slot === "weapon" && kind !== "weapon") continue;
      if (slot === "armor" && kind !== "armor") continue;
      if (slot === "shield" && kind !== "shield") continue;
      if (slot === "accessory" && !["accessory", "valuable"].includes(kind)) continue;
      if (requiresAttunement(item) && !isAttuned(unit, item)) continue;
      if (kind === "weapon" && !skillUsesItem(options.skill, item)) continue;
      const rule = { type: "modifier", trigger: "passive", channel: enchanted.focus.channel, value: enchanted.focus.value, mode: "add" };
      traits.push({
        id: `enchantment:${id}`,
        name: String(item.displayName || item.name || "Enchantment"),
        sourceType: "enchantment",
        sourceItemInstanceId: id,
        contexts: ["any"],
        rules: [rule],
      });
    }
    return traits;
  }
  const api = Object.freeze({
    VERSION, TIERS, FOCUS_BY_KIND, CHANNELS_BY_KIND,
    kindOf, validate, activeEnchantment, applyEnchantment,
    removeEnchantment, collectEquippedTraits,
  });
  global.LuminousItemEnchantmentRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
