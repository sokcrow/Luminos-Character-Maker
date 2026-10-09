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

  const VERSION = 2;
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
      requireEquipped:true,
      requireLivingActor:true,
    });
    if (summary.resolved === false) {
      return {...summary,item,delivery:deliveryType(skill)};
    }
    const resourcePlan=Magic.activationResourcePlan?.(summary) || {charges:0,magicalDurability:0,sp:0};
    const resourceGate=Magic.canPayActivationResources?.(attacker || {},item,resourcePlan) || {allowed:true};
    if (!resourceGate.allowed) {
      return {
        active:false,
        resolved:false,
        suppressed:true,
        reason:resourceGate.reason,
        effects:[],
        magicHit:false,
        damageFlat:0,
        totalDamagePercent:0,
        item,
        delivery:deliveryType(skill),
        resourcePlan,
        resourceGate,
      };
    }
    return {
      ...summary,
      item,
      delivery:deliveryType(skill),
      resourcePlan,
      resourceGate,
    };
  }

  function adjustedDamage(baseDamage, attacker, defender, skill = {}, context = {}) {
    const item = sourceItem(attacker, skill, context);
    // A Skill's activation is decided once. If its first Coin spends the last
    // point of Magical Durability, its remaining Coins keep the same approved
    // snapshot; a NEW Skill must resolve again and can see depletion.
    const actionContext = context && typeof context === "object" ? context : null;
    const cached = actionContext?.__luminousEnchantmentSkillSnapshot || null;
    const sameAction = cached?.skill === skill &&
      cached?.item === item &&
      cached?.attacker === attacker;
    if (actionContext && cached && !sameAction) {
      delete actionContext.__luminousEnchantmentActivationSpent;
      delete actionContext.__luminousEnchantmentWearSpent;
    }
    const actorStillActive = Magic.actorCanEmitMagic?.(attacker) !== false;
    const itemStillEquipped = !item || Magic.itemEquippedBy?.(attacker, item) !== false;
    const resolution = sameAction && actorStillActive && itemStillEquipped
      ? cached.resolution
      : resolve(item, attacker, defender, skill, context);
    if (actionContext && (!sameAction || !actorStillActive || !itemStillEquipped)) {
      actionContext.__luminousEnchantmentSkillSnapshot = {skill,item,attacker,resolution};
    }
    let damage = Math.max(0, Number(baseDamage) || 0);

    if (resolution.active && resolution.resolved !== false) {
      const flat = Number(resolution.damageFlat) || 0;
      if (flat) damage += flat;
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


  function spendActivationOnce(attacker,item,resolution,skill={},context={}) {
    if (!item || !resolution?.effects?.length) return {activated:false,reason:"no_enchantment_effects"};
    if (context && context.__luminousEnchantmentActivationSpent===true) {
      return {activated:true,skipped:true,reason:"activation_resources_already_spent_for_action"};
    }
    const result=Magic.activateEnchantmentEffects?.(attacker || {},item,{
      trigger:"on_skill",
      selectedChannels:selectedChannels(skill,context),
      requireEquipped:true,
      requireLivingActor:true,
    }) || {activated:true,skipped:true,reason:"activation_runtime_unavailable"};
    if (context && result?.activated) context.__luminousEnchantmentActivationSpent=true;
    return result;
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
        adjusted.activation = spendActivationOnce(attacker,adjusted.item,adjusted.resolution,skill,runtimeContext);
        if (adjusted.activation?.activated === false) return base;
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
    spendActivationOnce,
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
