(function (global) {
  "use strict";

  if (global.LuminousLevel1SpellBatchRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLevel1SpellBatchRuntime;
    return;
  }

  const VERSION = "0.1.0";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const unitId = (unit = {}) => String(unit.id || unit.unitId || unit.combatId || unit.playerId || "").trim();

  const STATUS_DEFINITIONS = Object.freeze({
    bane: Object.freeze({
      name: "Bane",
      type: "negative",
      mode: "single",
      maxCount: 10,
      rules: [{ trigger: "passive", cond_type: "potency", cond_input: 1, affectation: "final_power", operation: "sub", aff_input: 2 }],
      description: "-2 Final Power while the source maintains Bane Concentration."
    }),
    bless: Object.freeze({
      name: "Bless",
      type: "positive",
      mode: "single",
      maxCount: 10,
      rules: [{ trigger: "passive", cond_type: "potency", cond_input: 1, affectation: "final_power", operation: "add", aff_input: 2 }],
      description: "+2 Final Power while the source maintains Bless Concentration."
    }),
    reaction_suppressed: Object.freeze({
      name: "Reaction Suppressed",
      type: "negative",
      mode: "single",
      maxCount: 1,
      rules: [],
      description: "Cannot spend a Reaction until this status expires."
    }),
    armor_of_agathys: Object.freeze({
      name: "Armor of Agathys",
      type: "positive",
      mode: "single",
      maxCount: 1,
      rules: [],
      description: "Tracks the active Armor of Agathys retaliation."
    })
  });

  function statusEngine() {
    if (global.LuminousStatusEngine) return global.LuminousStatusEngine;
    if (typeof require === "function") {
      try { return require("./status-engine.js"); } catch (_) {}
    }
    return null;
  }

  function shieldRuntime() {
    if (global.LuminousShieldDurationRuntime) return global.LuminousShieldDurationRuntime;
    if (typeof require === "function") {
      try { return require("./shield-duration-runtime.js"); } catch (_) {}
    }
    return null;
  }

  function registerStatuses() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    Object.entries(STATUS_DEFINITIONS).forEach(([id, definition]) => {
      global.STATUS_REGISTRY[id] = { id, ...definition };
    });
    return true;
  }

  function getStatus(unit, id) {
    return statusEngine()?.getStatus?.(unit, id) || unit?.statusEffects?.[normalizeId(id)] || null;
  }

  function applyStatus(unit, id, input = {}) {
    const engine = statusEngine();
    if (engine?.applyStatus) return engine.applyStatus(unit, id, input);
    if (!unit || typeof unit !== "object") return null;
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    const key = normalizeId(id);
    unit.statusEffects[key] = { id: key, count: numberOr(input.count, 1), potency: numberOr(input.potency, 0), duration: input.duration || "until_removed", sourceUnitId: input.sourceUnitId || null, data: { ...(input.data || {}) } };
    return unit.statusEffects[key];
  }

  function removeStatus(unit, id) {
    const engine = statusEngine();
    if (engine?.removeStatus) return engine.removeStatus(unit, id, { from: "spell", ignoreProtection: true });
    const key = normalizeId(id);
    if (unit?.statusEffects?.[key]) delete unit.statusEffects[key];
    return { removed: true, statusId: key };
  }

  function sourceStillConcentrating(source, spellId) {
    const active = normalizeId(source?.spellcastingState?.concentration?.active?.spellId || source?.spellcastingState?.concentration?.spellId);
    return active === normalizeId(spellId);
  }

  function findSource(units, sourceUnitId) {
    const wanted = String(sourceUnitId || "");
    return (units || []).find((unit) => unitId(unit) === wanted) || null;
  }

  function applyBane(target, sourceUnitId = null) {
    return applyStatus(target, "bane", {
      mode: "set",
      count: 10,
      potency: 1,
      sourceUnitId,
      data: { sourceUnitId, concentrationSpellId: "bane" }
    });
  }

  function applyBless(target, sourceUnitId = null) {
    return applyStatus(target, "bless", {
      mode: "set",
      count: 10,
      potency: 1,
      sourceUnitId,
      data: { sourceUnitId, concentrationSpellId: "bless" }
    });
  }

  function suppressReaction(target) {
    return applyStatus(target, "reaction_suppressed", {
      mode: "set",
      count: 1,
      duration: "next_turn_end",
      data: { sourceSpellId: "arms_of_hadar" }
    });
  }

  function grantArmorOfAgathys(unit, slotLevel = 1) {
    const level = Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    const amount = 5 * level;
    const shields = shieldRuntime();
    const gained = shields?.gainShield
      ? shields.gainShield(unit, amount, shields.SHIELD_TYPES?.ENCOUNTER || "encounter")
      : (() => { unit.shield = Math.max(0, numberOr(unit.shield, 0)) + amount; return amount; })();

    unit.__luminousArmorOfAgathys = {
      active: true,
      slotLevel: level,
      retaliationDamage: 5 * level,
      grantedShield: gained,
      sourceSpellId: "armor_of_agathys"
    };
    applyStatus(unit, "armor_of_agathys", { mode: "set", count: 1, data: { slotLevel: level } });
    return { resolved: gained > 0, shieldGranted: gained, retaliationDamage: 5 * level, slotLevel: level };
  }

  function clearArmorOfAgathys(unit) {
    if (unit && typeof unit === "object") delete unit.__luminousArmorOfAgathys;
    removeStatus(unit, "armor_of_agathys");
    return true;
  }

  function armorOfAgathysState(unit) {
    const state = unit?.__luminousArmorOfAgathys;
    if (!state?.active) return null;
    if (numberOr(unit?.shield, 0) <= 0) {
      clearArmorOfAgathys(unit);
      return null;
    }
    return state;
  }

  function isMeleeSkill(skill = {}) {
    const range = numberOr(skill.range ?? skill.skillRange ?? skill.rangeTiles ?? skill.range_tiles, NaN);
    if (Number.isFinite(range)) return range <= 1;
    const id = normalizeId(skill.rangeType || skill.range_type || skill.attackRange || skill.attack_range || skill.targetingType || skill.targeting_type || "");
    if (skill.isRanged === true || id.includes("ranged")) return false;
    if (id) return id === "melee" || id === "close" || id === "focused_attack";
    return true;
  }

  function retaliateArmorOfAgathys(engine, attacker, defender, attackSkill, result) {
    const state = armorOfAgathysState(defender);
    if (!state || !attacker || numberOr(result?.damageTaken, 0) <= 0 || !isMeleeSkill(attackSkill)) return null;
    const damage = Math.max(0, Math.trunc(numberOr(state.retaliationDamage, 0)));
    if (damage <= 0) return null;
    const before = numberOr(attacker.hp, 0);
    const applied = typeof engine?.applyDamage === "function"
      ? engine.applyDamage(attacker, damage, "cold", false, null, { sourceSpellId: "armor_of_agathys", sourceUnitId: unitId(defender) })
      : null;
    if (numberOr(defender?.shield, 0) <= 0) clearArmorOfAgathys(defender);
    return { damage, hpBefore: before, hpAfter: numberOr(attacker.hp, before), applied };
  }

  function createAlarmWard(caster, options = {}) {
    if (!caster || typeof caster !== "object") return { resolved: false, reason: "caster_required" };
    const mode = normalizeId(options.mode || "mental");
    const ward = {
      id: String(options.id || `alarm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      sourceSpellId: "alarm",
      sourceUnitId: unitId(caster),
      mode: ["audible", "mental"].includes(mode) ? mode : "mental",
      areaId: options.areaId || options.targetId || null,
      excludedUnitIds: Array.isArray(options.excludedUnitIds) ? [...new Set(options.excludedUnitIds.map(String))] : [],
      durationHours: 8,
      createdAt: Date.now()
    };
    if (!Array.isArray(caster.__luminousAlarmWards)) caster.__luminousAlarmWards = [];
    caster.__luminousAlarmWards.push(ward);
    return { resolved: true, ward };
  }

  function maxHpOf(unit = {}) {
    return Math.max(0, numberOr(unit.maxHp ?? unit.maxHP ?? unit.hpMax ?? unit.max_hp, 0));
  }

  function currentHpOf(unit = {}) {
    return Math.max(0, numberOr(unit.hp ?? unit.currentHp ?? unit.currentHP ?? unit.current_hp, 0));
  }

  function setCurrentHp(unit, value) {
    const next = Math.max(0, numberOr(value, 0));
    if ("hp" in unit || (!("currentHp" in unit) && !("currentHP" in unit) && !("current_hp" in unit))) unit.hp = next;
    else if ("currentHp" in unit) unit.currentHp = next;
    else if ("currentHP" in unit) unit.currentHP = next;
    else unit.current_hp = next;
    return next;
  }

  function calculateCureWoundsHealing(slotLevel = 1, spellMod = 0, maxHp = 0) {
    const slot = Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    const mod = numberOr(spellMod, 0);
    const hp = Math.max(0, numberOr(maxHp, 0));
    const flat = 2 * slot;
    const maxHpPercent = Math.max(2, 2 * mod);
    const percentHealing = hp * (maxHpPercent / 100);
    return { slotLevel: slot, spellMod: mod, flat, maxHpPercent, percentHealing, total: flat + percentHealing };
  }

  function applyCureWounds(target, slotLevel = 1, spellMod = 0) {
    if (!target || typeof target !== "object") return { resolved: false, reason: "target_required" };
    const maxHp = maxHpOf(target);
    if (maxHp <= 0) return { resolved: false, reason: "max_hp_required" };
    const hpBefore = Math.min(maxHp, currentHpOf(target));
    const healing = calculateCureWoundsHealing(slotLevel, spellMod, maxHp);
    const hpAfter = Math.min(maxHp, hpBefore + healing.total);
    setCurrentHp(target, hpAfter);
    return {
      resolved: true,
      targetId: unitId(target),
      hpBefore,
      hpAfter,
      healed: Math.max(0, hpAfter - hpBefore),
      ...healing
    };
  }

  function resolveCureWoundsSpellMod(actor, action = {}, effect = {}) {
    const explicit = effect.spellMod
      ?? action?.metadata?.spellMod
      ?? action?.metadata?.viewerPlan?.spellMod
      ?? actor?.SpellMod
      ?? actor?.spellMod;
    if (Number.isFinite(Number(explicit))) return Number(explicit);
    const classId = action?.metadata?.sourceClassId || effect.classId || "";
    const runtime = global.LuminousSpellcastingRuntime;
    const resolved = runtime?.resolveSpellcasting?.(actor || {}, classId, action?.metadata?.viewerPlan || {}, action?.metadata?.variables || {});
    return numberOr(resolved?.spellMod, 0);
  }

  function cleanupConcentrationStatuses(units = []) {
    for (const unit of units || []) {
      for (const statusId of ["bane", "bless"]) {
        const entry = getStatus(unit, statusId);
        if (!entry) continue;
        const sourceUnitId = entry.sourceUnitId || entry.data?.sourceUnitId;
        const required = entry.data?.concentrationSpellId || statusId;
        const source = findSource(units, sourceUnitId);
        if (source && !sourceStillConcentrating(source, required)) removeStatus(unit, statusId);
      }
      if (getStatus(unit, "reaction_suppressed")) removeStatus(unit, "reaction_suppressed");
      if (unit?.__luminousArmorOfAgathys && numberOr(unit.shield, 0) <= 0) clearArmorOfAgathys(unit);
    }
  }

  function patchActionEconomy() {
    const current = global.LuminousActionEconomy;
    if (!current || current.__level1SpellBatchRuntime) return Boolean(current);
    const baseAvailability = current.availability;
    const baseConsume = current.consume;
    const blocked = (unit, cost) => normalizeId(cost) === "reaction" && Boolean(getStatus(unit, "reaction_suppressed"));
    global.LuminousActionEconomy = Object.freeze({
      ...current,
      __level1SpellBatchRuntime: true,
      availability(unit, cost, options = {}) {
        if (blocked(unit, cost)) return { available: false, reason: "reaction_suppressed", remaining: 0 };
        return baseAvailability?.(unit, cost, options) || { available: true, reason: null };
      },
      consume(unit, cost, options = {}) {
        if (blocked(unit, cost)) return false;
        return baseConsume?.(unit, cost, options);
      },
      consumeCounterReaction(unit, skill, options = {}) {
        if (blocked(unit, "reaction")) return false;
        return current.consumeCounterReaction?.(unit, skill, options) ?? baseConsume?.(unit, "reaction", options);
      }
    });
    return true;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__level1SpellBatchRuntime) return Boolean(engine);
    const originalResolveSpell = typeof engine.resolveSpell === "function" ? engine.resolveSpell : null;
    const originalUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;

    if (originalResolveSpell) {
      engine.resolveSpell = function (spellSkill, target, targetHeadsFlipped) {
        const result = originalResolveSpell.call(this, spellSkill, target, targetHeadsFlipped) || {};
        if (result.isSuccess === false) {
          const id = normalizeId(spellSkill?.id || spellSkill?.spellId || spellSkill?.name);
          const sourceUnitId = spellSkill?.sourceUnitId || spellSkill?.casterId || null;
          if (id === "bane") applyBane(target, sourceUnitId);
          if (id === "arms_of_hadar") suppressReaction(target);
        }
        return result;
      };
    }

    if (originalUnilateral) {
      engine.resolveUnilateralWithCounter = function (unitAttacker, attackSkill, unitDefender, counterSkill, options = {}) {
        const result = originalUnilateral.call(this, unitAttacker, attackSkill, unitDefender, counterSkill, options);
        const retaliation = retaliateArmorOfAgathys(this, unitAttacker, unitDefender, attackSkill, result);
        if (retaliation && result && typeof result === "object") result.armorOfAgathysRetaliation = retaliation;
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        const phase = normalizeId(phaseTag).replace(/^_+|_+$/g, "");
        if (["turn_end", "round_end"].includes(phase)) cleanupConcentrationStatuses(allUnits || []);
        return result;
      };
    }

    Object.defineProperty(engine, "__level1SpellBatchRuntime", { value: true, configurable: true });
    return true;
  }

  function effectHandlers() {
    return {
      level1_alarm({ actor, effect, action } = {}) {
        const options = action?.metadata?.viewerPlan?.alarm || effect?.alarm || {};
        return createAlarmWard(actor, options);
      },
      level1_armor_of_agathys({ actor, action, effect } = {}) {
        const slotLevel = action?.metadata?.slotLevel ?? effect?.slotLevel ?? 1;
        return grantArmorOfAgathys(actor, slotLevel);
      },
      level1_bless({ actor, targets = [] } = {}) {
        const sourceUnitId = unitId(actor);
        const applied = (targets || []).filter(Boolean).map((target) => ({ targetId: unitId(target), status: applyBless(target, sourceUnitId) }));
        return { resolved: applied.length > 0, applied };
      },
      level1_cure_wounds({ actor, targets = [], action = {}, effect = {} } = {}) {
        const target = (targets || []).filter(Boolean)[0] || actor;
        const slotLevel = action?.metadata?.slotLevel ?? effect.slotLevel ?? 1;
        const spellMod = resolveCureWoundsSpellMod(actor, action, effect);
        return applyCureWounds(target, slotLevel, spellMod);
      }
    };
  }

  function install() {
    registerStatuses();
    patchActionEconomy();
    patchCombatEngine();
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    STATUS_DEFINITIONS,
    registerStatuses,
    getStatus,
    applyStatus,
    removeStatus,
    applyBane,
    applyBless,
    suppressReaction,
    grantArmorOfAgathys,
    clearArmorOfAgathys,
    armorOfAgathysState,
    retaliateArmorOfAgathys,
    createAlarmWard,
    calculateCureWoundsHealing,
    applyCureWounds,
    resolveCureWoundsSpellMod,
    cleanupConcentrationStatuses,
    effectHandlers,
    patchActionEconomy,
    patchCombatEngine,
    install
  });

  global.LuminousLevel1SpellBatchRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  install();
})(typeof window !== "undefined" ? window : globalThis);
