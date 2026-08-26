(function (global) {
  "use strict";

  if (global.LuminousConditionCombatBridge) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousConditionCombatBridge;
    return;
  }

  const PATCH_INTERVAL_MS = 250;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const conditionRuntime = () => global.LuminousConditionRuntime || null;

  const POISON_TYPES = new Set(["poison", "poison_damage", "venom", "veneno", "toxic", "toxico"]);
  const ABILITY_KEYS = Object.freeze({
    str: ["fuerza", "strength", "str"],
    dex: ["destreza", "dexterity", "dex"],
    con: ["constitucion", "constitution", "con"],
    int: ["inteligencia", "intelligence", "int"],
    wis: ["sabiduria", "wisdom", "wis"],
    cha: ["carisma", "charisma", "cha"],
  });
  const ABILITY_CODES = Object.freeze({ str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" });

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function isPoisonDamage(type, skill = null) {
    const values = [type, skill?.damageType, skill?.damage_type, skill?.attackType, skill?.attack_type]
      .map(normalizeId)
      .filter(Boolean);
    return values.some((value) => POISON_TYPES.has(value));
  }

  function unitIds(unit = {}) {
    return [
      unit.combatId, unit.combat_id, unit.id, unit.unitId, unit.unit_id,
      unit.characterId, unit.character_id, unit.playerId, unit.player_id,
      unit.actorId, unit.actor_id, unit.uid, unit.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function findUnitById(units, id) {
    if (id == null || String(id).trim() === "") return null;
    const wanted = String(id).trim();
    return (units || []).find((unit) => unitIds(unit).includes(wanted)) || null;
  }

  function scoreFor(unit, abilityId) {
    const id = normalizeId(abilityId);
    const keys = ABILITY_KEYS[id] || [id];
    const roots = [unit?.stats, unit?.dndStats, unit];
    for (const root of roots) {
      if (!root || typeof root !== "object") continue;
      for (const key of keys) {
        if (Number.isFinite(Number(root[key]))) return Number(root[key]);
        const upper = String(key).toUpperCase();
        if (Number.isFinite(Number(root[upper]))) return Number(root[upper]);
      }
    }
    return 10;
  }

  function proficiencyBonus(unit = {}) {
    const explicit = unit?.dndStats?.proficiencyBonus ?? unit?.proficiencyBonus ?? unit?.proficiency_bonus ?? unit?.proficiency;
    if (Number.isFinite(Number(explicit))) return Number(explicit);
    return Math.ceil(Math.max(0, numberOr(unit?.level ?? unit?.characterBuild?.calculatedAtLevel, 1)) / 20);
  }

  function proficiencyMultiplier(value) {
    const id = normalizeId(value || "none");
    if (id === "expertise") return 2;
    if (id === "proficient") return 1;
    if (id === "half") return 0.5;
    return 0;
  }

  function legacyProficiencies(unit = {}) {
    return Array.isArray(unit?.dndStats?.proficiencies)
      ? unit.dndStats.proficiencies.map((value) => String(value).toUpperCase())
      : [];
  }

  function fallbackCheckBonus(unit, check = {}) {
    const abilityId = normalizeId(check.abilityId || check.ability || "str");
    const score = scoreFor(unit, abilityId);
    let bonus = Math.floor((score - 10) / 2);
    const kind = normalizeId(check.kind || check.checkType || "ability");
    const skillId = normalizeId(check.skillId || check.skill || "");
    const pb = proficiencyBonus(unit);
    const legacy = legacyProficiencies(unit);
    if (kind === "skill" && skillId) {
      const stored = unit?.dndSkills?.[skillId]?.value;
      if (Number.isFinite(Number(stored))) return Number(stored);
      const prof = unit?.skillProficiency?.[skillId] ?? unit?.dndSkills?.[skillId]?.proficiency ?? unit?.dndSkills?.[skillId]?.proficiencyState;
      if (legacy.includes(skillId.toUpperCase())) bonus += pb;
      else bonus += Math.floor(pb * proficiencyMultiplier(prof));
    } else if (["save", "saving_throw", "savingthrow"].includes(kind)) {
      const code = ABILITY_CODES[abilityId] || String(abilityId).toUpperCase();
      if (legacy.includes(`${code}_SAVE`)) bonus += pb;
      else {
        const prof = unit?.saveProficiency?.[abilityId] ?? unit?.savingThrowProficiency?.[abilityId];
        bonus += Math.floor(pb * proficiencyMultiplier(prof));
      }
    } else {
      const prof = unit?.abilityProficiency?.[abilityId] ?? unit?.abilityProficiency?.[ABILITY_KEYS[abilityId]?.[0]];
      bonus += Math.floor(pb * proficiencyMultiplier(prof));
    }
    return bonus;
  }

  function checkBonus(_engine, unit, check = {}) {
    return fallbackCheckBonus(unit, check);
  }

  function sourceSpellDc(source = {}) {
    const direct = [
      source.spellDC, source.spellDc, source.spellSaveDC, source.spell_save_dc,
      source.spellcasting?.spellDC, source.spellcasting?.spellDc, source.spellcasting?.saveDC,
      source.combatStats?.spellDC, source.dndStats?.spellDC, source.dndStats?.spellSaveDC,
    ].map(Number).find(Number.isFinite);
    if (Number.isFinite(direct)) return direct;

    const spellcasting = global.LuminousSpellcastingRuntime;
    const classes = Array.isArray(source.classes)
      ? source.classes
      : (Array.isArray(source.characterBuild?.classes) ? source.characterBuild.classes : []);
    if (spellcasting?.resolveSpellcasting) {
      for (const entry of classes) {
        const classId = normalizeId(entry?.id || entry?.classId || entry?.class_id || entry?.name || entry);
        if (!classId) continue;
        try {
          const resolved = spellcasting.resolveSpellcasting(source, classId, {}, {});
          if (Number.isFinite(Number(resolved?.spellDC))) return Number(resolved.spellDC);
        } catch (_) {}
      }
    }
    return NaN;
  }

  function rollCheck(engine, unit, check = {}, options = {}) {
    if (!unit) return { pending: true, reason: "missing_unit" };
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const coinAmount = Math.max(1, Math.trunc(numberOr(check.coinAmount, 5)));
    const coinPower = numberOr(check.coinPower, 4);
    const headsChance = typeof engine?.getCoinProbability === "function"
      ? Math.max(5, Math.min(95, numberOr(engine.getCoinProbability(unit.sp || 0), 50)))
      : Math.max(5, Math.min(95, 50 + numberOr(unit.sp, 0)));
    const tosses = Array.from({ length: coinAmount }, () => (rng() * 100) < headsChance);
    const heads = tosses.filter(Boolean).length;
    const base = checkBonus(engine, unit, check);
    const total = base + (heads * coinPower);
    const threshold = Number(check.threshold ?? check.difficulty ?? check.thresholdRaw);
    const result = { total, base, heads, tosses, headsChance, coinAmount, coinPower };
    if (Number.isFinite(threshold)) {
      result.threshold = threshold;
      result.passed = total >= threshold;
    }
    return result;
  }

  function resolveConditionCheck(engine, request, units, options = {}) {
    if (!request || typeof request !== "object") return { pending: true, reason: "invalid_request" };
    if (request.type === "save_check") {
      const source = findUnitById(units, request.sourceUnitId);
      const check = { ...(request.check || {}) };
      let threshold = Number(check.threshold);
      if (!Number.isFinite(threshold) && source) threshold = sourceSpellDc(source);
      if (!Number.isFinite(threshold)) return { pending: true, reason: "missing_threshold", source };
      check.threshold = threshold;
      return { ...rollCheck(engine, request.unit, check, options), source };
    }
    if (request.type === "opposed_check") {
      const source = findUnitById(units, request.sourceUnitId);
      if (!source) return { pending: true, reason: "missing_opposed_source" };
      const unitRoll = rollCheck(engine, request.unit, request.check || { kind: "ability", abilityId: "str" }, options);
      const rivalRoll = rollCheck(engine, source, request.rivalCheck || { kind: "ability", abilityId: "str" }, options);
      return {
        passed: numberOr(unitRoll.total, 0) >= numberOr(rivalRoll.total, 0),
        unitTotal: unitRoll.total,
        rivalTotal: rivalRoll.total,
        unitRoll,
        rivalRoll,
        source,
      };
    }
    return { pending: true, reason: "unsupported_condition_check" };
  }

  function resolvePerceptionChecks(engine, request, units, options = {}) {
    const initiator = request?.initiator;
    if (!initiator) return { pending: true, reason: "missing_invisible_unit", results: [] };
    const stealth = rollCheck(engine, initiator, request.initiatorCheck || { kind: "skill", abilityId: "dex", skillId: "stealth" }, options);
    const candidates = (request.targets || units || []).filter((unit) => unit && unit !== initiator && numberOr(unit.hp, 1) > 0);
    const results = candidates.map((unit) => {
      const perception = rollCheck(engine, unit, request.rivalCheck || { kind: "skill", abilityId: "wis", skillId: "perception" }, options);
      return { unit, perception, stealth, passed: numberOr(perception.total, 0) >= numberOr(stealth.total, 0) };
    });
    return { pending: false, stealth, results };
  }

  function conditionGateForSkill(unit, target, skill, options = {}) {
    const runtime = conditionRuntime();
    if (!runtime) return { allowed: true, reason: null };
    const action = runtime.actionAvailability?.(unit, "action", options);
    if (action?.available === false) return { allowed: false, reason: action.reason || "condition_blocks_action" };
    return runtime.canTarget?.(unit, target, skill, options) || { allowed: true, reason: null };
  }

  function blockedAttackResult(reason) {
    return {
      attackLogs: [{ message: `Action blocked by Condition (${reason || "condition"}).`, class: "error" }],
      pendingActions: [],
      damageTaken: 0,
      conditionBlocked: true,
      reason: reason || "condition_blocks_action",
    };
  }

  function install() {
    const engine = global.CombatEngine;
    const runtime = conditionRuntime();
    if (!engine || !runtime) return false;
    if (engine.__luminousCoreConditionCombatBridge) return true;

    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    const originalAutoTarget = typeof engine.autoTarget === "function" ? engine.autoTarget : null;
    const originalAoE = typeof engine.calculateAoETargets === "function" ? engine.calculateAoETargets : null;
    const originalUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const originalClash = typeof engine.resolveStandardClash === "function" ? engine.resolveStandardClash : null;
    const originalResolveActionSlot = typeof engine.resolveActionSlot === "function" ? engine.resolveActionSlot : null;

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const units = Array.isArray(allUnits) ? allUnits.filter(Boolean) : [];
        const normalized = normalizeId(phaseTag).replace(/^_+|_+$/g, "");
        if (normalized === "round_start") {
          units.forEach((unit) => {
            const outcomes = runtime.turnStart?.(unit, {
              units,
              combatants: units,
              engine: this,
              resolvePerceptionChecks: (request) => resolvePerceptionChecks(this, request, units),
            }) || [];
            if (outcomes.length) emit("luminous:condition-turn-start-resolved", { unit, outcomes, units });
          });
        }
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (normalized === "round_end") {
          units.forEach((unit) => {
            const outcomes = runtime.turnEnd?.(unit, {
              units,
              combatants: units,
              engine: this,
              resolveCheck: (request) => resolveConditionCheck(this, request, units),
            }) || [];
            global.LuminousStatusEngine?.advanceDurations?.(unit, "round_end");
            if (outcomes.length) emit("luminous:condition-turn-end-resolved", { unit, outcomes, units });
          });
        }
        return result;
      };
    }

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, type = "directo", isCritical = false, skillUsed = null, ...rest) {
        const multiplier = isPoisonDamage(type, skillUsed) ? numberOr(runtime.poisonDamageMultiplier?.(unit), 1) : 1;
        const adjusted = Math.max(0, numberOr(damage, 0) * multiplier);
        const result = originalApplyDamage.call(this, unit, adjusted, type, isCritical, skillUsed, ...rest);
        if (result && typeof result === "object" && multiplier !== 1) {
          return { ...result, conditionDamageMultiplier: multiplier, incomingDamage: numberOr(damage, 0), adjustedDamage: adjusted };
        }
        return result;
      };
    }

    if (originalAutoTarget) {
      engine.autoTarget = function (attacker, skill, enemies, ...rest) {
        const list = (enemies || []).filter((target) => conditionGateForSkill(attacker, target, skill).allowed);
        if (!list.length) return null;
        return originalAutoTarget.call(this, attacker, skill, list, ...rest);
      };
    }

    if (originalAoE) {
      engine.calculateAoETargets = function (skill, primaryTarget, allPossibleTargets, unitAttacker, ...rest) {
        if (!conditionGateForSkill(unitAttacker, primaryTarget, skill).allowed) return [];
        const allowed = (allPossibleTargets || []).filter((target) => conditionGateForSkill(unitAttacker, target, skill).allowed);
        return originalAoE.call(this, skill, primaryTarget, allowed, unitAttacker, ...rest);
      };
    }

    if (originalUnilateral) {
      engine.resolveUnilateralWithCounter = function (attacker, attackSkill, defender, counterSkill, options, ...rest) {
        const gate = conditionGateForSkill(attacker, defender, attackSkill, options || {});
        if (!gate.allowed) return blockedAttackResult(gate.reason);
        return originalUnilateral.call(this, attacker, attackSkill, defender, counterSkill, options, ...rest);
      };
    }

    if (originalClash) {
      engine.resolveStandardClash = function (unitA, skillA, unitB, skillB, ...rest) {
        const gateA = conditionGateForSkill(unitA, unitB, skillA);
        const gateB = conditionGateForSkill(unitB, unitA, skillB);
        if (!gateA.allowed || !gateB.allowed) {
          return {
            winner: null,
            clashWinner: null,
            clashLogs: [{ note: "Clash blocked by Condition.", blockedA: !gateA.allowed, blockedB: !gateB.allowed }],
            pendingActions: [],
            conditionBlocked: true,
            blockedA: !gateA.allowed,
            blockedB: !gateB.allowed,
            reasons: { A: gateA.reason || null, B: gateB.reason || null },
          };
        }
        return originalClash.call(this, unitA, skillA, unitB, skillB, ...rest);
      };
    }

    if (originalResolveActionSlot) {
      engine.resolveActionSlot = function (unit, slotIndex, context = {}, ...rest) {
        const gate = runtime.actionAvailability?.(unit, "action", { ...context, phase: this.currentState });
        if (gate?.available === false) {
          return { handled: true, conditionBlocked: true, reason: gate.reason || "condition_blocks_action", planned: context?.plannedAction || null };
        }

        const localPlanned = context?.plannedAction || global.LuminousActionEconomy?.getPlannedAction?.(unit, slotIndex) || null;
        if (normalizeId(localPlanned?.kind) === "universal_action") {
          const actionId = normalizeId(localPlanned?.data?.actionId || localPlanned?.sourceId);
          if (actionId !== "grapple") {
            return { handled: true, planned: localPlanned, result: { applied: false, reason: "unknown_universal_action", actionId } };
          }
          const units = Object.values(context?.combatData || {}).filter(Boolean);
          if (!units.some((candidate) => candidate === unit)) units.push(unit);
          const target = findUnitById(units, localPlanned?.targetId);
          if (!target) {
            return { handled: true, planned: localPlanned, result: { applied: false, reason: "grapple_target_unavailable" } };
          }
          runtime.onActionUsed?.(unit, { ...context, combatants: units, units });
          const unitARoll = rollCheck(this, unit, { kind: "ability", abilityId: "str" }, context);
          const unitBRoll = rollCheck(this, target, { kind: "ability", abilityId: "str" }, context);
          const opposed = {
            unitATotal: unitARoll.total,
            unitBTotal: unitBRoll.total,
            unitBPassed: numberOr(unitBRoll.total, 0) >= numberOr(unitARoll.total, 0),
            unitARoll,
            unitBRoll,
          };
          const grappleResult = runtime.grapple?.(unit, target, {
            ...context,
            combatants: units,
            units,
            resolveOpposedCheck: () => opposed,
          }) || { applied: false, reason: "condition_runtime_unavailable" };
          if (!context?.plannedAction) global.LuminousActionEconomy?.cancelAction?.(unit, slotIndex);
          return { handled: true, planned: localPlanned, result: grappleResult, opposed };
        }

        return originalResolveActionSlot.call(this, unit, slotIndex, context, ...rest);
      };
    }

    try { Object.defineProperty(engine, "__luminousCoreConditionCombatBridge", { value: true, configurable: true }); }
    catch (_) { engine.__luminousCoreConditionCombatBridge = true; }
    return true;
  }

  const api = Object.freeze({
    POISON_TYPES,
    isPoisonDamage,
    fallbackCheckBonus,
    sourceSpellDc,
    rollCheck,
    resolveConditionCheck,
    resolvePerceptionChecks,
    conditionGateForSkill,
    install,
  });

  global.LuminousConditionCombatBridge = api;
  install();
  if (global.document) global.setInterval?.(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
