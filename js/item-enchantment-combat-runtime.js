(function (global) {
  "use strict";

  if (global.LuminousItemEnchantmentCombatRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemEnchantmentCombatRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Magic = global.LuminousItemMagicRuntime || safeRequire("./item-magic-runtime.js");
  if (!Magic) throw new Error("LuminousItemMagicRuntime is required before LuminousItemEnchantmentCombatRuntime.");

  const VERSION = 1;
  const BRIDGE_FLAG = "__luminousItemEnchantmentCombatBridge";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function deliveryType(skill = {}) {
    const explicit = normalizeId(skill.deliveryType || skill.delivery || skill.rangeType);
    if (["melee","ranged"].includes(explicit)) return explicit;
    const range = Number(skill.skillRange ?? skill.range ?? skill.metadata?.skillRange);
    return Number.isFinite(range) && range > 1 ? "ranged" : "melee";
  }

  function sourceItem(attacker = {}, skill = {}, context = {}) {
    const candidates = [
      context.item,
      context.sourceItem,
      context.weapon,
      skill.sourceItem,
      skill.item,
      skill.weapon,
      attacker.equippedWeapon,
      attacker.weapon,
      attacker.mainHand,
      attacker.equipment?.mainHand,
      attacker.equipment?.main_hand,
    ];
    return candidates.find((entry) => entry && typeof entry === "object") || null;
  }

  function selectedChannels(skill = {}, context = {}) {
    return context.selectedEnchantmentChannels ||
      context.selectedChannels ||
      skill.selectedEnchantmentChannels ||
      skill.selectedChannels ||
      {};
  }

  function resolve(item, attacker, defender, skill = {}, context = {}) {
    if (!item) return { active:false, reason:"no_source_magic_item", effects:[], magicHit:false, totalDamagePercent:0 };
    const summary = Magic.enchantmentCombatSummary(attacker || {}, item, {
      trigger:"on_skill",
      selectedChannels:selectedChannels(skill, context),
      skill,
      defender,
    });
    return {
      ...summary,
      item,
      delivery:deliveryType(skill),
    };
  }

  function adjustedDamage(baseDamage, attacker, defender, skill = {}, context = {}) {
    const item = sourceItem(attacker, skill, context);
    const resolution = resolve(item, attacker, defender, skill, context);
    let damage = Math.max(0, Number(baseDamage) || 0);

    if (resolution.active && resolution.resolved !== false) {
      const percent = Number(resolution.totalDamagePercent) || 0;
      if (percent) damage *= 1 + percent / 100;
    }

    const defense = Magic.applyNonMagicHitDefense(damage, defender || {}, {
      magicHit:resolution.magicHit === true,
      delivery:resolution.delivery,
      actionType:"skill",
    });

    return {
      damage:Math.max(0, Math.floor(defense.damage)),
      baseDamage:Math.max(0, Number(baseDamage) || 0),
      item,
      resolution,
      defense,
    };
  }

  function spendWearOnce(item, resolution, context = {}) {
    if (!item || !resolution?.effects?.length) return { spent:false, reason:"no_enchantment_effects" };
    if (context && context.__luminousEnchantmentWearSpent === true) {
      return { spent:true, skipped:true, reason:"wear_already_spent_for_action" };
    }
    const result = Magic.spendResolvedEnchantmentWear(item, resolution, { specialUse:false });
    if (context && result?.spent) context.__luminousEnchantmentWearSpent = true;
    return result;
  }

  function patchCombatEngine(engine = global.CombatEngine) {
    if (!engine || typeof engine.calculateCoinDamage !== "function") {
      return { installed:false, reason:"combat_engine_unavailable" };
    }
    if (engine[BRIDGE_FLAG]) return { installed:true, alreadyInstalled:true };

    const original = engine.calculateCoinDamage;
    engine.calculateCoinDamage = function (attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
      const base = original.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
      const runtimeContext = context && typeof context === "object" ? context : {};
      const adjusted = adjustedDamage(base, attacker, defender, skill, runtimeContext);
      if (adjusted.item && adjusted.resolution?.effects?.length && adjusted.damage > 0) {
        adjusted.wear = spendWearOnce(adjusted.item, adjusted.resolution, runtimeContext);
      }
      if (context && typeof context === "object") {
        context.enchantmentMagicHit = adjusted.resolution?.magicHit === true;
        context.enchantmentDamagePercent = adjusted.resolution?.totalDamagePercent || 0;
        context.enchantmentDamageAdjusted = adjusted.damage;
      }
      return adjusted.damage;
    };

    Object.defineProperty(engine, BRIDGE_FLAG, {
      value:Object.freeze({originalCalculateCoinDamage:original}),
      configurable:true,
      enumerable:false,
    });
    return { installed:true, alreadyInstalled:false };
  }

  function uninstallCombatEngine(engine = global.CombatEngine) {
    const state = engine?.[BRIDGE_FLAG];
    if (!engine || !state?.originalCalculateCoinDamage) return false;
    engine.calculateCoinDamage = state.originalCalculateCoinDamage;
    try { delete engine[BRIDGE_FLAG]; } catch (_) {}
    return true;
  }

  const API = Object.freeze({
    VERSION,
    BRIDGE_FLAG,
    deliveryType,
    sourceItem,
    selectedChannels,
    resolve,
    adjustedDamage,
    spendWearOnce,
    patchCombatEngine,
    uninstallCombatEngine,
  });

  global.LuminousItemEnchantmentCombatRuntime = API;
  if (global.CombatEngine) patchCombatEngine(global.CombatEngine);
  if (global.addEventListener) {
    global.addEventListener("luminous:combat073-runtime-ready", () => patchCombatEngine(global.CombatEngine));
  }

  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
