(function (global) {
  "use strict";

  if (global.LuminousWeaponCantripBatchRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousWeaponCantripBatchRuntime;
    return;
  }

  const VERSION = "0.7.4-weapon-cantrips-batch-1";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

  const STATUS_DEFINITIONS = Object.freeze({
    booming: Object.freeze({
      name: "Booming", type: "negative", mode: "single",
      icon: "https://imgur.com/42ESliW.png", maxCount: 99,
      description: "After every Clash, raise Stagger Threshold by 2 and lose 1 Count. On Turn End, inflict Tremor equal to remaining Count, then remove this effect."
    }),
    shillelagh: Object.freeze({
      name: "Shillelagh", type: "positive", mode: "single",
      icon: "https://imgur.com/OtAgwTp.png", maxCount: 10,
      description: "Melee Skills deal +(2, 2 × WIS Mod)% Damage. On Turn End, lose 1 Count."
    })
  });

  function registry() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    return global.STATUS_REGISTRY;
  }

  function registerStatuses() {
    const target = registry();
    Object.entries(STATUS_DEFINITIONS).forEach(([id, definition]) => {
      target[id] = { ...(target[id] || {}), ...definition };
    });
    return target;
  }

  function statusEngine() { return global.LuminousStatusEngine || null; }

  function getStatus(unit, id) {
    const key = normalizeId(id);
    const viaEngine = statusEngine()?.getStatus?.(unit, key);
    if (viaEngine) return viaEngine;
    const raw = unit?.statusEffects?.[key];
    return raw && typeof raw === "object" ? raw : null;
  }

  function applyStatus(unit, id, input = {}) {
    if (!unit) return null;
    const key = normalizeId(id);
    if (typeof statusEngine()?.applyStatus === "function") return statusEngine().applyStatus(unit, key, input);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    const current = unit.statusEffects[key] || { id: key, count: 0, potency: 0, data: {} };
    const mode = normalizeId(input.mode || "gain");
    if (mode === "set") {
      current.count = Math.max(0, intOr(input.count, 1));
      current.potency = Math.max(0, intOr(input.potency, 0));
    } else {
      current.count = Math.max(0, intOr(current.count, 0) + Math.max(0, intOr(input.count, 1)));
      current.potency = Math.max(0, intOr(current.potency, 0) + Math.max(0, intOr(input.potency, 0)));
    }
    current.data = { ...(current.data || {}), ...(input.data || {}) };
    const maxCount = registry()[key]?.maxCount;
    if (Number.isFinite(Number(maxCount))) current.count = Math.min(Number(maxCount), current.count);
    unit.statusEffects[key] = current;
    return current;
  }

  function removeStatus(unit, id) {
    if (!unit) return false;
    const key = normalizeId(id);
    if (typeof statusEngine()?.removeStatus === "function") return statusEngine().removeStatus(unit, key, { from: "spell", ignoreProtection: true });
    if (unit.statusEffects?.[key]) { delete unit.statusEffects[key]; return true; }
    return false;
  }

  function reduceCount(unit, id, amount = 1) {
    const key = normalizeId(id);
    const entry = unit?.statusEffects?.[key];
    if (!entry || typeof entry !== "object") return 0;
    entry.count = Math.max(0, intOr(entry.count, 0) - Math.max(0, intOr(amount, 0)));
    if (entry.count <= 0) removeStatus(unit, key);
    return entry.count;
  }

  function actorLevel(actor = {}) {
    const direct = actor.Level ?? actor.level ?? actor.characterBuild?.calculatedAtLevel;
    if (Number.isFinite(Number(direct))) return Math.max(1, intOr(direct, 1));
    const classes = Array.isArray(actor.classes) ? actor.classes : (Array.isArray(actor.characterBuild?.classes) ? actor.characterBuild.classes : []);
    const total = classes.reduce((sum, row) => sum + Math.max(0, intOr(row?.levels ?? row?.level, 0)), 0);
    return Math.max(1, total || 1);
  }

  function abilityModifier(unit = {}, ability = "wis") {
    const key = normalizeId(ability);
    const direct = unit?.abilityMods?.[key] ?? unit?.abilityModifiers?.[key] ?? unit?.modifiers?.[key] ?? unit?.dndStats?.[key + "Mod"] ?? unit?.dndStats?.[key + "_mod"];
    if (Number.isFinite(Number(direct))) return intOr(direct, 0);
    const score = unit?.dndStats?.[key] ?? unit?.stats?.[key] ?? unit?.abilities?.[key] ?? unit?.[key];
    if (Number.isFinite(Number(score))) return Math.floor((Number(score) - 10) / 2);
    return 0;
  }

  function isMeleeSkill(skill = {}) {
    const range = Number(skill.skillRange ?? skill.range ?? skill.rangeTiles ?? 1);
    if (!Number.isFinite(range) || range > 1) return false;
    const type = normalizeId(skill.type);
    return !["guard", "evade", "counter", "clashable_guard", "clashable_counter", "spell", "roll", "save"].includes(type);
  }

  function skillWeight(skill = {}) {
    return Math.max(1, intOr(skill.atkWeight ?? skill.attackWeight ?? skill.weight, 1));
  }

  function prepareCantrip(actor, cantripId) {
    if (!actor) return { ok: false, reason: "actor_required" };
    const id = normalizeId(cantripId);
    const level = actorLevel(actor);
    if (id === "booming_blade") {
      actor.__luminousBoomingBladePending = { level };
      return { ok: true, spellId: id, level };
    }
    if (id === "green_flame_blade") {
      actor.__luminousGreenFlameBladePending = { level };
      return { ok: true, spellId: id, level };
    }
    if (id === "shillelagh") {
      applyStatus(actor, "shillelagh", { count: 10, mode: "set", data: { sourceSpellId: id } });
      return { ok: true, spellId: id, count: 10 };
    }
    return { ok: false, reason: "unsupported_weapon_cantrip", spellId: id };
  }

  function queueBoomingForNextTurn(target, count, sourceUnitId = null) {
    if (!target) return null;
    const next = Math.max(1, intOr(count, 1));
    const pending = target.__luminousBoomingNextTurn || { count: 0, sourceUnitId: null };
    pending.count = Math.min(99, Math.max(0, intOr(pending.count, 0)) + next);
    pending.sourceUnitId = sourceUnitId || pending.sourceUnitId || null;
    target.__luminousBoomingNextTurn = pending;
    return pending;
  }

  function activateQueuedBooming(unit) {
    const pending = unit?.__luminousBoomingNextTurn;
    if (!pending) return null;
    delete unit.__luminousBoomingNextTurn;
    return applyStatus(unit, "booming", {
      count: Math.max(1, intOr(pending.count, 1)),
      mode: "gain",
      sourceUnitId: pending.sourceUnitId || null,
      data: { sourceSpellId: "booming_blade" }
    });
  }

  function handleBoomingHit(context = {}) {
    const attacker = context.unitAttacker || context.attacker || null;
    const target = context.currentTarget || context.defender || null;
    const pending = attacker?.__luminousBoomingBladePending;
    if (!attacker || !target || !pending) return null;
    delete attacker.__luminousBoomingBladePending;
    const amount = Math.max(1, Math.floor(actorLevel(attacker) / 5));
    return queueBoomingForNextTurn(target, amount, attacker.id || attacker.unitId || null);
  }

  function armGreenFlameSkill(context = {}) {
    const attacker = context.unitAttacker || context.attacker || null;
    const skill = context.skill || null;
    const pending = attacker?.__luminousGreenFlameBladePending;
    if (!attacker || !skill || !pending || !isMeleeSkill(skill) || skillWeight(skill) !== 1 || skill.__luminousGreenFlameBlade) return null;

    const level = actorLevel(attacker);
    skill.__luminousGreenFlameBlade = {
      level,
      damagePct: 20 + Math.floor(level / 4),
      burn: 1 + Math.floor(level / 15),
      originalAttackWeight: skill.attackWeight,
      originalAtkWeight: skill.atkWeight,
      originalTargetingType: skill.targeting_type,
      originalAoePattern: skill.aoe_pattern,
      secondaryTarget: null
    };
    skill.attackWeight = 2;
    skill.atkWeight = 2;
    skill.targeting_type = "AoE";
    if (!skill.aoe_pattern) skill.aoe_pattern = "Radius";
    delete attacker.__luminousGreenFlameBladePending;
    return skill.__luminousGreenFlameBlade;
  }

  function restoreGreenFlameSkill(skill = {}) {
    const state = skill.__luminousGreenFlameBlade;
    if (!state) return false;
    if (state.originalAttackWeight === undefined) delete skill.attackWeight; else skill.attackWeight = state.originalAttackWeight;
    if (state.originalAtkWeight === undefined) delete skill.atkWeight; else skill.atkWeight = state.originalAtkWeight;
    if (state.originalTargetingType === undefined) delete skill.targeting_type; else skill.targeting_type = state.originalTargetingType;
    if (state.originalAoePattern === undefined) delete skill.aoe_pattern; else skill.aoe_pattern = state.originalAoePattern;
    delete skill.__luminousGreenFlameBlade;
    return true;
  }

  function handleGreenFlameHit(context = {}) {
    const skill = context.skill || {};
    const state = skill.__luminousGreenFlameBlade;
    const primary = context.currentTarget || context.defender || null;
    if (!state || !primary) return null;

    applyStatus(primary, "burn", { potency: state.burn, count: 1, mode: "gain", data: { sourceSpellId: "green_flame_blade" } });

    if (!state.secondaryTarget) {
      const targets = Array.isArray(context.targetsHit) ? context.targetsHit : [];
      state.secondaryTarget = targets.find((unit) => unit && unit !== primary) || null;
    }
    const secondary = state.secondaryTarget;
    if (!secondary || Number(secondary.hp ?? 1) <= 0) return { primary, secondary: null, damage: 0, burn: state.burn };

    const baseDamage = Math.max(0, numberOr(context.damageDealt, 0));
    const secondaryDamage = Math.max(0, Math.floor(baseDamage * state.damagePct / 100));
    const engine = context.engine || global.CombatEngine;
    if (secondaryDamage > 0 && typeof engine?.applyDamage === "function") engine.applyDamage(secondary, secondaryDamage, "directo", false, null);
    applyStatus(secondary, "burn", { potency: state.burn, count: 1, mode: "gain", data: { sourceSpellId: "green_flame_blade" } });
    return { primary, secondary, damage: secondaryDamage, damagePct: state.damagePct, burn: state.burn };
  }

  function resolveBoomingClash(unit, engine = global.CombatEngine) {
    const booming = getStatus(unit, "booming");
    if (!booming || intOr(booming.count, 0) <= 0) return null;
    if (typeof engine?.modifyNextStaggerThreshold === "function") engine.modifyNextStaggerThreshold(unit, 2);
    else unit.nextStaggerThreshold = numberOr(unit.nextStaggerThreshold, 0) + 2;
    const remaining = reduceCount(unit, "booming", 1);
    return { raised: 2, remaining };
  }

  function resolveBoomingTurnEnd(unit) {
    const booming = getStatus(unit, "booming");
    const amount = Math.max(0, intOr(booming?.count, 0));
    if (!booming) return null;
    if (amount > 0) applyStatus(unit, "tremor", { potency: amount, count: 1, mode: "gain", data: { sourceSpellId: "booming_blade" } });
    removeStatus(unit, "booming");
    return { tremor: amount };
  }

  function shillelaghDamagePercent(unit) {
    if (!getStatus(unit, "shillelagh")) return 0;
    return Math.max(2, 2 * abilityModifier(unit, "wis"));
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__weaponCantripBatchRuntime) return Boolean(engine);

    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalResolveStandardClash = typeof engine.resolveStandardClash === "function" ? engine.resolveStandardClash : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalCalculateCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const key = normalizeId(tag);
        if (key === "before_attack") armGreenFlameSkill(context || {});
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        if (key === "on_hit") {
          handleBoomingHit(context || {});
          handleGreenFlameHit(context || {});
        }
        if (key === "attack_end") restoreGreenFlameSkill(context?.skill || {});
        return result;
      };
    }

    if (originalResolveStandardClash) {
      engine.resolveStandardClash = function (unitA, skillA, unitB, skillB, ...rest) {
        const result = originalResolveStandardClash.call(this, unitA, skillA, unitB, skillB, ...rest);
        resolveBoomingClash(unitA, this);
        resolveBoomingClash(unitB, this);
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
        const phase = normalizeId(phaseTag);
        if (["turn_start", "round_start"].includes(phase)) {
          for (const unit of allUnits || []) activateQueuedBooming(unit);
        }
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (["turn_end", "round_end"].includes(phase)) {
          for (const unit of allUnits || []) {
            resolveBoomingTurnEnd(unit);
            if (getStatus(unit, "shillelagh")) reduceCount(unit, "shillelagh", 1);
          }
        }
        return result;
      };
    }

    if (originalCalculateCoinDamage) {
      engine.calculateCoinDamage = function (attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
        const base = originalCalculateCoinDamage.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
        const pct = isMeleeSkill(skill) ? shillelaghDamagePercent(attacker) : 0;
        return pct > 0 ? Math.max(0, Math.floor(numberOr(base, 0) * (1 + pct / 100))) : base;
      };
    }

    Object.defineProperty(engine, "__weaponCantripBatchRuntime", { value: true, configurable: true });
    return true;
  }

  function patchSpellAdapter() {
    const source = global.LuminousBattleViewerActionAdapter073;
    if (!source?.compilePlan || !source.__spellAdapter074) return false;
    if (source.__weaponCantripBatchRuntime) return true;
    const wrapped = Object.freeze({
      ...source,
      __weaponCantripBatchRuntime: true,
      compilePlan(slotId, explicitTargetSlotId = null, providedPlan = null) {
        const result = source.compilePlan(slotId, explicitTargetSlotId, providedPlan);
        const action = result?.action;
        if (!action || normalizeId(action.source?.type) !== "spell") return result;
        const id = normalizeId(action.source?.id || action.metadata?.sourceDefinition?.id);
        if (["booming_blade", "green_flame_blade", "shillelagh"].includes(id)) {
          action.effects = [...(action.effects || []), { type: "weapon_cantrip_prepare", cantripId: id }];
          action.resolution = { type: "automatic" };
          action.economy = { ...(action.economy || {}), cost: "quick_action" };
        }
        return result;
      }
    });
    global.LuminousBattleViewerActionAdapter073 = wrapped;
    return true;
  }

  function patchCombatActionResolver() {
    const source = global.LuminousCombatActionResolver;
    if (!source?.resolveCombatAction || source.__weaponCantripBatchRuntime) return Boolean(source);
    const wrapped = Object.freeze({
      ...source,
      __weaponCantripBatchRuntime: true,
      resolveCombatAction(input = {}, context = {}) {
        return source.resolveCombatAction(input, {
          ...context,
          effectHandlers: {
            ...(context.effectHandlers || {}),
            weapon_cantrip_prepare({ actor, effect }) {
              return prepareCantrip(actor, effect?.cantripId);
            }
          }
        });
      }
    });
    global.LuminousCombatActionResolver = wrapped;
    return true;
  }

  function install() {
    registerStatuses();
    patchCombatEngine();
    patchSpellAdapter();
    patchCombatActionResolver();
    return true;
  }

  const api = Object.freeze({
    version: VERSION, STATUS_DEFINITIONS,
    registerStatuses, getStatus, applyStatus, removeStatus, reduceCount,
    actorLevel, abilityModifier, isMeleeSkill, skillWeight,
    prepareCantrip, queueBoomingForNextTurn, activateQueuedBooming, handleBoomingHit,
    armGreenFlameSkill, restoreGreenFlameSkill, handleGreenFlameHit,
    resolveBoomingClash, resolveBoomingTurnEnd, shillelaghDamagePercent,
    patchCombatEngine, patchSpellAdapter, patchCombatActionResolver, install
  });

  global.LuminousWeaponCantripBatchRuntime = api;
  install();
  const timer = typeof global.setInterval === "function" ? global.setInterval(install, 250) : null;
  timer?.unref?.();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
