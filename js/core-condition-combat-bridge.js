(function (global) {
  "use strict";

  if (global.LuminousConditionCombatBridge?.version === "0.7.3") {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousConditionCombatBridge;
    return;
  }

  const PATCH_INTERVAL_MS = 250;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const runtime = () => global.LuminousConditionRuntime || null;

  const ABILITY_KEYS = Object.freeze({ str: ["str", "strength", "fuerza"], dex: ["dex", "dexterity", "destreza"], con: ["con", "constitution", "constitucion"], int: ["int", "intelligence", "inteligencia"], wis: ["wis", "wisdom", "sabiduria"], cha: ["cha", "charisma", "carisma"] });

  function emit(name, detail) {
    try { if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent(name, { detail })); } catch (_) {}
    return detail;
  }

  function unitIds(unit = {}) {
    return [unit.combatId, unit.id, unit.unitId, unit.characterId, unit.playerId, unit.actorId, unit.uid, unit.vinculo_jugador].filter((v) => v != null && String(v).trim()).map((v) => String(v).trim());
  }
  function findUnit(units, id) { const wanted = String(id || ""); return (units || []).find((u) => unitIds(u).includes(wanted)) || null; }

  function scoreFor(unit, abilityId) {
    const id = normalizeId(abilityId); const keys = ABILITY_KEYS[id] || [id]; const roots = [unit?.stats, unit?.dndStats, unit];
    for (const root of roots) if (root && typeof root === "object") for (const key of keys) {
      const value = root[key] ?? root[String(key).toUpperCase()]; if (Number.isFinite(Number(value))) return Number(value);
    }
    return 10;
  }
  function proficiencyBonus(unit = {}) {
    const explicit = unit?.dndStats?.proficiencyBonus ?? unit?.proficiencyBonus ?? unit?.proficiency_bonus;
    if (Number.isFinite(Number(explicit))) return Number(explicit);
    return Math.max(2, Math.ceil(Math.max(1, numberOr(unit.level ?? unit.characterBuild?.calculatedAtLevel, 1)) / 20));
  }
  function checkBonus(unit, check = {}) {
    const ability = normalizeId(check.abilityId || check.ability || "str");
    let bonus = Math.floor((scoreFor(unit, ability) - 10) / 2);
    const kind = normalizeId(check.kind || check.checkType || "ability"); const skill = normalizeId(check.skillId || check.skill || "");
    const pb = proficiencyBonus(unit);
    if (kind === "skill" && skill) {
      const stored = unit?.dndSkills?.[skill]?.value; if (Number.isFinite(Number(stored))) return Number(stored);
      const prof = normalizeId(unit?.dndSkills?.[skill]?.proficiency || unit?.skillProficiency?.[skill] || "");
      if (prof === "expertise") bonus += pb * 2; else if (["proficient", "true"].includes(prof)) bonus += pb; else if (prof === "half") bonus += Math.floor(pb / 2);
    } else if (["save", "saving_throw", "savingthrow"].includes(kind)) {
      const prof = unit?.saveProficiency?.[ability] ?? unit?.savingThrowProficiency?.[ability]; if (prof === true || normalizeId(prof) === "proficient") bonus += pb;
    }
    return bonus;
  }

  function rollCheck(engine, unit, rawCheck = {}, options = {}) {
    const check = { ...rawCheck };
    const rt = runtime();
    const auto = rt?.automaticCheckFailure?.(unit, check) || { failed: false };
    const applied = rt?.applyCheckThreshold?.(unit, check, options) || { check, modifier: 0, finalPowerModifier: 0 };
    if (auto.failed || applied.automaticFailure?.failed) return { passed: false, automaticFailure: true, reason: auto.reason || applied.automaticFailure?.reason, total: 0, threshold: Number(check.threshold ?? check.difficulty) };
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const coins = Math.max(1, Math.floor(numberOr(check.coinAmount, 5))); const coinPower = numberOr(check.coinPower, 4);
    const headsChance = typeof engine?.getCoinProbability === "function" ? Math.max(5, Math.min(95, numberOr(engine.getCoinProbability(unit?.sp || 0), 50))) : Math.max(5, Math.min(95, 50 + numberOr(unit?.sp, 0)));
    const tosses = Array.from({ length: coins }, () => rng() * 100 < headsChance); const heads = tosses.filter(Boolean).length;
    const base = checkBonus(unit, check); const finalPower = numberOr(applied.finalPowerModifier, 0); const total = base + heads * coinPower + finalPower;
    const threshold = Number(check.threshold ?? check.difficulty ?? check.thresholdRaw);
    return { total, base, finalPower, heads, tosses, headsChance, coinAmount: coins, coinPower, threshold, passed: Number.isFinite(threshold) ? total >= threshold : undefined };
  }

  function resolveConditionCheck(engine, request, units, options = {}) {
    if (!request) return { pending: true, reason: "invalid_request" };
    if (["save_check", "concentration_save", "calm_check", "find_check", "liberate_check"].includes(request.type)) return rollCheck(engine, request.actor || request.unit, request.check || {}, { ...options, target: request.target });
    if (request.type === "grapple_clash" || request.type === "opposed_check") {
      const initiator = request.initiator || request.actor || request.unit;
      const rival = request.rival || findUnit(units, request.sourceUnitId);
      if (!initiator || !rival) return { pending: true, reason: "missing_opposed_unit" };
      const a = rollCheck(engine, initiator, request.initiatorCheck || request.check || {}, options);
      const checks = request.rivalChecks || [request.rivalCheck || { kind: "skill", abilityId: "str", skillId: "athletics", coinAmount: 5, coinPower: 4 }];
      const rivalRolls = checks.map((c) => rollCheck(engine, rival, c, options));
      const b = rivalRolls.reduce((best, current) => !best || numberOr(current.total, -Infinity) > numberOr(best.total, -Infinity) ? current : best, null);
      return { attackerWon: numberOr(a.total, 0) > numberOr(b?.total, 0), passed: numberOr(a.total, 0) > numberOr(b?.total, 0), unitATotal: a.total, unitBTotal: b?.total, initiatorRoll: a, rivalRoll: b, rivalRolls };
    }
    return { pending: true, reason: "unsupported_condition_check" };
  }

  function resolveTurnStartOutcome(engine, outcome, units) {
    if (outcome?.type !== "invisible_arcana_notice") return outcome;
    if (!Number.isFinite(Number(outcome.threshold))) return { ...outcome, pending: true, reason: "missing_invisibility_threshold" };
    const result = rollCheck(engine, outcome.observer, outcome.check, { target: outcome.invisibleUnit });
    let findResult = null;
    if (result.passed) {
      runtime()?.markInvisibleNotice?.(outcome.observer, outcome.invisibleUnit, true);
      const control = normalizeId(outcome.observer?.controlled || outcome.observer?.control || outcome.observer?.controller);
      if (["ai", "enemy_ai", "npc"].includes(control)) {
        const findRequest = runtime()?.buildFindRequest?.(outcome.observer, outcome.invisibleUnit);
        if (findRequest && Number.isFinite(Number(findRequest.threshold))) {
          findResult = rollCheck(engine, outcome.observer, findRequest.check, { target: outcome.invisibleUnit });
          if (findResult.passed) runtime()?.markInvisibleLocated?.(outcome.observer, outcome.invisibleUnit, true);
        }
      }
    }
    return { ...outcome, result, findResult };
  }

  function confusionMode(unit) {
    return normalizeId(runtime()?.getStatus?.(unit, "confusion")?.data?.turnMode || "");
  }
  function randomIndiscriminateTarget(engine, actor, originalTarget, skill, options = {}) {
    if (confusionMode(actor) !== "indiscriminate") return originalTarget;
    const source = typeof engine?.getAllAliveUnits === "function"
      ? engine.getAllAliveUnits()
      : Object.values(global.combatData || {});
    const candidates = (source || []).filter((target) =>
      target && target !== actor && Number(target.hp ?? 1) > 0 &&
      runtime()?.canTarget?.(actor, target, { ...(skill || {}), attackWeight: Math.max(4, Number(skill?.attackWeight || skill?.weight || 1)) }, { ...options, ignoreInvisible: false })?.allowed !== false
    );
    if (!candidates.length) return originalTarget;
    const rng = typeof options.random === "function" ? options.random : Math.random;
    return candidates[Math.min(candidates.length - 1, Math.floor(Math.max(0, Math.min(.999999, Number(rng()) || 0)) * candidates.length))];
  }

  function conditionGate(actor, target, skill, options = {}) {
    const rt = runtime(); if (!rt) return { allowed: true };
    const action = rt.actionAvailability?.(actor, "action", options); if (action?.available === false) return { allowed: false, reason: action.reason };
    return rt.canTarget?.(actor, target, skill, options) || { allowed: true };
  }
  function blocked(reason) { return { attackLogs: [{ message: `Action blocked by Condition (${reason}).`, class: "error" }], pendingActions: [], damageTaken: 0, conditionBlocked: true, reason }; }

  function install() {
    const engine = global.CombatEngine; const rt = runtime(); if (!engine || !rt) return false;
    if (engine.__luminousConditionBridge073) return true;

    const triggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const applyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    const applySPDamage = typeof engine.applySPDamage === "function" ? engine.applySPDamage : (typeof engine.applySpDamage === "function" ? engine.applySpDamage : null);
    const calculateCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;
    const processStatusEffects = typeof engine.processStatusEffects === "function" ? engine.processStatusEffects : null;
    const applyPassiveModifiers = typeof engine.applyPassiveModifiers === "function" ? engine.applyPassiveModifiers : null;
    const autoTarget = typeof engine.autoTarget === "function" ? engine.autoTarget : null;
    const aoe = typeof engine.calculateAoETargets === "function" ? engine.calculateAoETargets : null;
    const unilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const clash = typeof engine.resolveStandardClash === "function" ? engine.resolveStandardClash : null;

    if (triggerPhase) engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
      const units = Array.isArray(allUnits) ? allUnits.filter(Boolean) : [];
      const phase = normalizeId(phaseTag).replace(/^_+|_+$/g, "");
      if (["turn_start", "round_start", "[turn_start]", "[round_start]"].includes(phase)) units.forEach((unit) => {
        const outcomes = (rt.turnStart?.(unit, { units, combatants: units, engine: this }) || []).map((outcome) => resolveTurnStartOutcome(this, outcome, units));
        if (outcomes.length) emit("luminous:condition-turn-start-resolved", { unit, outcomes, units });
      });
      const result = triggerPhase.call(this, phaseTag, allUnits, ...rest);
      if (["turn_end", "round_end", "[turn_end]", "[round_end]"].includes(phase)) units.forEach((unit) => {
        const outcomes = rt.turnEnd?.(unit, { units, combatants: units, engine: this, resolveCheck: (request) => resolveConditionCheck(this, request, units) }) || [];
        global.LuminousStatusEngine?.advanceDurations?.(unit, "round_end");
        if (outcomes.length) emit("luminous:condition-turn-end-resolved", { unit, outcomes, units });
      });
      return result;
    };

    if (applyPassiveModifiers) engine.applyPassiveModifiers = function (unit, contextOptions = {}) {
      const base = applyPassiveModifiers.call(this, unit, contextOptions) || {};
      const extra = rt.contextualModifiers?.({
        unit,
        character: unit,
        target: contextOptions?.target || contextOptions?.defender || null,
        skill: contextOptions?.skill || null,
        context: "combat",
      }) || {};
      const merged = { ...base };
      ["final_power", "defense_power", "clash_power", "counter_power", "evade_power", "min_speed", "max_speed", "speed"].forEach((key) => {
        merged[key] = numberOr(merged[key], 0) + numberOr(extra[key], 0);
      });
      if (numberOr(extra.damage_taken_percent, 0)) merged.condition_damage_taken_percent = numberOr(merged.condition_damage_taken_percent, 0) + numberOr(extra.damage_taken_percent, 0);
      if (numberOr(extra.sp_damage_taken_multiplier, 1) !== 1) merged.condition_sp_damage_taken_multiplier = numberOr(extra.sp_damage_taken_multiplier, 1);
      return merged;
    };

    if (calculateCoinDamage) engine.calculateCoinDamage = function (attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null, ...rest) {
      const autoCrit = Boolean(rt.shouldAutoCrit?.(attacker, defender));
      if (autoCrit && context && typeof context === "object") context.conditionAutoCrit = true;
      return calculateCoinDamage.call(this, attacker, defender, skill, coinFinalPower, Boolean(isCritical) || autoCrit, clashCount, context, ...rest);
    };

    if (processStatusEffects) engine.processStatusEffects = function (unit, triggerKey, context = {}, ...rest) {
      const trigger = normalizeId(triggerKey);
      const defender = context?.defender || context?.currentTarget || context?.target || null;
      const suppressPoiseConsume = trigger === "on_crit" && defender && rt.shouldAutoCrit?.(unit, defender);
      if (!suppressPoiseConsume || !unit?.statusEffects?.poise) return processStatusEffects.call(this, unit, triggerKey, context, ...rest);
      const poise = unit.statusEffects.poise;
      delete unit.statusEffects.poise;
      try { return processStatusEffects.call(this, unit, triggerKey, context, ...rest); }
      finally { if (!unit.statusEffects.poise) unit.statusEffects.poise = poise; }
    };

    if (applyDamage) engine.applyDamage = function (unit, damage, type = "directo", isCritical = false, skillUsed = null, damageContext = null, ...rest) {
      const context = damageContext || {}; const attacker = context.attacker || context.sourceUnit || context.source || null;
      if (rt.hasStatus?.(unit, "petrified") && normalizeId(context.element || skillUsed?.element || type) === "poison") return { damageTaken: 0, conditionImmune: true, reason: "petrified_poison_immunity" };
      let adjusted = Math.max(0, numberOr(damage, 0)) * numberOr(rt.damageTakenMultiplier?.(unit), 1);
      if (rt.hasStatus?.(unit, "sleep") && normalizeId(type) === "directo") adjusted *= numberOr(rt.sleepNextAttackMultiplier?.(unit), 1);
      let critical = Boolean(isCritical);
      const autoCrit = attacker && rt.shouldAutoCrit?.(attacker, unit); if (autoCrit) critical = true;
      const result = applyDamage.call(this, unit, adjusted, type, critical, skillUsed, damageContext, ...rest);
      const dealt = numberOr(result?.damageTaken ?? result?.damage ?? result?.hpDamage, adjusted);
      rt.onDamageTaken?.(unit, dealt, { attacker, skillUsed, type, result });
      if (rt.hasStatus?.(unit, "sleep") || numberOr(rt.sleepNextAttackMultiplier?.(unit), 1) > 1) rt.consumeSleepAttackBonus?.(unit);
      if (autoCrit && result && typeof result === "object") result.conditionAutoCrit = true;
      return result;
    };

    if (applySPDamage) {
      const name = typeof engine.applySPDamage === "function" ? "applySPDamage" : "applySpDamage";
      engine[name] = function (unit, damage, ...rest) {
        const multiplier = rt.hasStatus?.(unit, "sleep") ? 3 : 1;
        return applySPDamage.call(this, unit, Math.floor(Math.max(0, numberOr(damage, 0)) * multiplier), ...rest);
      };
    }

    if (autoTarget) engine.autoTarget = function (attacker, skill, enemies, ...rest) {
      const allowed = (enemies || []).filter((target) => conditionGate(attacker, target, skill).allowed); return allowed.length ? autoTarget.call(this, attacker, skill, allowed, ...rest) : null;
    };
    if (aoe) engine.calculateAoETargets = function (skill, primary, allTargets, attacker, ...rest) {
      if (!conditionGate(attacker, primary, skill).allowed) return [];
      return aoe.call(this, skill, primary, (allTargets || []).filter((target) => conditionGate(attacker, target, skill).allowed), attacker, ...rest);
    };
    if (unilateral) engine.resolveUnilateralWithCounter = function (attacker, attackSkill, defender, counterSkill, options, ...rest) {
      const resolvedTarget = randomIndiscriminateTarget(this, attacker, defender, attackSkill, options || {});
      const gate = conditionGate(attacker, resolvedTarget, attackSkill, options || {});
      const result = gate.allowed ? unilateral.call(this, attacker, attackSkill, resolvedTarget, counterSkill, options, ...rest) : blocked(gate.reason);
      if (result && typeof result === "object" && resolvedTarget !== defender) {
        result.conditionRetargeted = true;
        result.originalTarget = defender;
        result.target = resolvedTarget;
      }
      return result;
    };
    if (clash) engine.resolveStandardClash = function (unitA, skillA, unitB, skillB, options, ...rest) {
      const a = conditionGate(unitA, unitB, skillA, options || {}); const b = conditionGate(unitB, unitA, skillB, options || {});
      if (!a.allowed) return blocked(a.reason); if (!b.allowed) return blocked(b.reason);
      return clash.call(this, unitA, skillA, unitB, skillB, options, ...rest);
    };

    Object.defineProperty(engine, "__luminousConditionBridge073", { value: true, configurable: true });
    return true;
  }

  const api = Object.freeze({ version: "0.7.3", rollCheck, resolveConditionCheck, resolveTurnStartOutcome, confusionMode, randomIndiscriminateTarget, conditionGateForSkill: conditionGate, install });
  global.LuminousConditionCombatBridge = api;
  install();
  const timer = typeof global.setInterval === "function" ? global.setInterval(install, PATCH_INTERVAL_MS) : null;
  timer?.unref?.();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
