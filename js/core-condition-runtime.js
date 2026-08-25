(function (global) {
  "use strict";

  if (global.LuminousConditionRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousConditionRuntime;
    return;
  }

  const statusEngine = () => global.LuminousStatusEngine || null;
  const exhaustion = global.LuminousExhaustionEngine || (typeof require === "function" ? require("./exhaustion-engine.js") : null);
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const PATCH_INTERVAL_MS = 250;

  const DEFINITIONS = Object.freeze({
    blinded: {
      name: "Blinded", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Conditional Check, Raises Perception Checks Threshold by 99\n-5 Clash Power\nOn Turn end make a [Unit A Spell DC] CON Save Check, on Pass Remove Effect.",
      rules: [{ trigger: "passive", cond_type: "count", cond_input: 1, operation: "sub", affectation: "clash_power", aff_input: 5 }],
    },
    charmed: {
      name: "Charmed", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Cannot target Unit A with Attack Skills or harmful effects.\nConditional Check, Unit A lowers CHA Checks Threshold by 3 against this Unit.\nOn Turn End make a [Unit A Spell DC] WIS Save Check, on Pass Remove Effect.", rules: [],
    },
    deafened: {
      name: "Deafened", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Conditional Check, Raises Hearing-based Perception Checks Threshold by 99\nOn Turn end make a [Unit A Spell DC] CON Save Check, on Pass Remove Effect.", rules: [],
    },
    frightened: {
      name: "Frightened", type: "negative", mode: "single", maxCount: 5, defaultCount: 5, icon: null,
      description: "Count 5\n-3 Clash Power, if target is Unit A -3 additional Clash Power\nCan't Target Unit A\nOn Turn end make a [Unit A Spell DC] WIS Save Check, on Pass Remove Effect, on fail lose 1 Count\nWith 0 Count on turn start Retreat from encounter.", rules: [],
    },
    grappled: {
      name: "Grappled", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Grappled by [Unit A Name]\nSpeed is Fixed to 1\nUnit B Can't use any Actions\nOn Turn end make a STR Opposed Check against [Unit A Name], on Pass Remove Effect\nIf Unit A uses an Action, Remove this Effect", rules: [],
    },
    incapacitated: {
      name: "Incapacitated", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Can't use Actions, Quick Actions or Reactions\nCan't use Universal Actions\nUntil Trigger is Removed.", rules: [],
    },
    invisible: {
      name: "Invisible - [Variant]", type: "positive", mode: "single", maxCount: 1, icon: null, variant: true,
      description: "Can't be Targeted by Skills with Weight 3 or less\nGain +5 Final Power & Defense Power\n[On Turn Start] all Units automatically make a Perception Check vs your Stealth Check\n[On Trigger] Remove this Effect",
      rules: [
        { trigger: "passive", cond_type: "count", cond_input: 1, operation: "add", affectation: "final_power", aff_input: 5 },
        { trigger: "passive", cond_type: "count", cond_input: 1, operation: "add", affectation: "defense_power", aff_input: 5 },
      ],
    },
    paralyzed: {
      name: "Paralyzed", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Speed is Fixed to 1\nCan't use Actions, Quick Actions, Reactions.\n[On Trigger] Remove this Effect", rules: [],
    },
    petrified: {
      name: "Petrified", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Speed is Fixed to 1\nCan't use Actions, Quick Actions, Reactions.\nOn Turn Start Gain 5 Protection\nImmune to Poisoned\nPoison deals 0 Damage\n[On Trigger] Remove this Effect", rules: [],
    },
    poisoned: {
      name: "Poisoned", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Raises Ability and Skill Checks Threshold by 2\n-2 Clash Power\nPoison deals +50% Damage\nOn Turn end make a [Unit A Spell DC] CON Save Check, on Pass Remove Effect.",
      rules: [{ trigger: "passive", cond_type: "count", cond_input: 1, operation: "sub", affectation: "clash_power", aff_input: 2 }],
    },
    prone: {
      name: "Prone", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Speed is Fixed to 1\n-15 Evasion Power\n-15 Counter Power\nSkills targeting this Unit gain +2 Final Power\nOn Turn Start Remove this Effect",
      rules: [
        { trigger: "passive", cond_type: "count", cond_input: 1, operation: "sub", affectation: "evade_power", aff_input: 15 },
        { trigger: "passive", cond_type: "count", cond_input: 1, operation: "sub", affectation: "counter_power", aff_input: 15 },
      ],
    },
    restrained: {
      name: "Restrained", type: "negative", mode: "single", maxCount: 1, icon: null,
      description: "Speed is Fixed to 1\n-5 Clash Power\n-10 Evasion Power\nSkills targeting this Unit gain +2 Final Power\nRaises DEX Save Checks Threshold by 3\n[On Trigger] Remove this Effect",
      rules: [
        { trigger: "passive", cond_type: "count", cond_input: 1, operation: "sub", affectation: "clash_power", aff_input: 5 },
        { trigger: "passive", cond_type: "count", cond_input: 1, operation: "sub", affectation: "evade_power", aff_input: 10 },
      ],
    },
  });

  const TRIGGER_REMOVAL_STATUSES = Object.freeze(["incapacitated", "invisible", "paralyzed", "petrified", "restrained"]);
  const FIXED_SPEED_STATUSES = Object.freeze(["grappled", "paralyzed", "petrified", "prone", "restrained"]);
  const bridgeState = { modifierSource: null };

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent(name, { detail }));
    } catch (_) {}
    return detail;
  }

  function installRegistry() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    Object.entries(DEFINITIONS).forEach(([id, definition]) => { global.STATUS_REGISTRY[id] = { id, ...clone(definition) }; });
    return global.STATUS_REGISTRY;
  }

  function getDefinition(statusId) {
    const id = normalizeId(statusId);
    return DEFINITIONS[id] ? { id, ...clone(DEFINITIONS[id]) } : null;
  }

  function normalizeStatusInput(statusId, input = {}) {
    const id = normalizeId(statusId);
    if (id === "frightened" && !Object.prototype.hasOwnProperty.call(input, "count")) return { ...input, count: 5 };
    return input;
  }

  function has(unit, statusId) {
    return Boolean(statusEngine()?.hasStatus?.(unit, statusId) || unit?.statusEffects?.[normalizeId(statusId)]);
  }

  function status(unit, statusId) {
    return statusEngine()?.getStatus?.(unit, statusId) || clone(unit?.statusEffects?.[normalizeId(statusId)] || null);
  }

  function unitIds(unit = {}) {
    return [unit.combatId, unit.combat_id, unit.id, unit.unitId, unit.unit_id, unit.characterId, unit.character_id, unit.playerId, unit.player_id, unit.actorId, unit.actor_id, unit.uid, unit.vinculo_jugador]
      .filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function primaryUnitId(unit = {}) {
    return unitIds(unit)[0] || normalizeId(unit.characterName || unit.character_name || unit.nombre || unit.name) || null;
  }

  function sameUnit(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const ids = new Set(unitIds(a));
    if (unitIds(b).some((id) => ids.has(id))) return true;
    const aName = normalizeId(a.characterName || a.character_name || a.nombre || a.name);
    const bName = normalizeId(b.characterName || b.character_name || b.nombre || b.name);
    return Boolean(aName && bName && aName === bName);
  }

  function statusSourceMatches(entry, sourceUnit) {
    if (!entry || !sourceUnit) return false;
    const sourceId = String(entry.sourceUnitId || entry.data?.sourceUnitId || "").trim();
    if (sourceId && unitIds(sourceUnit).includes(sourceId)) return true;
    const sourceName = normalizeId(entry.data?.sourceUnitName || "");
    const unitName = normalizeId(sourceUnit.characterName || sourceUnit.character_name || sourceUnit.nombre || sourceUnit.name);
    return Boolean(sourceName && sourceName === unitName);
  }

  function canApplyStatus(unit, statusId) {
    if (normalizeId(statusId) === "poisoned" && has(unit, "petrified")) return { allowed: false, reason: "petrified_poisoned_immunity" };
    return { allowed: true, reason: null };
  }

  function actionAvailability(unit, cost, options = {}) {
    const id = normalizeId(cost);
    if (has(unit, "incapacitated") && (options.universalAction === true || ["action", "quick_action", "reaction"].includes(id))) {
      return { available: false, reason: options.universalAction === true ? "incapacitated_universal_action" : `incapacitated_${id}` };
    }
    if ((has(unit, "paralyzed") || has(unit, "petrified")) && ["action", "quick_action", "reaction"].includes(id)) {
      return { available: false, reason: has(unit, "petrified") ? `petrified_${id}` : `paralyzed_${id}` };
    }
    if (id === "action" && status(unit, "grappled")?.data?.role === "held") return { available: false, reason: "grappled_action" };
    return { available: true, reason: null };
  }

  function canUseUniversalAction(unit, options = {}) {
    return actionAvailability(unit, normalizeId(options.cost || "action"), { ...options, universalAction: true });
  }

  function skillFamily(skill = {}) {
    return normalizeId(skill.skillFamily || skill.skill_family || skill.type || "attack");
  }

  function isHarmfulSkill(skill = {}) {
    return skill.harmful === true || skill.isHarmful === true || skill.dealsDamage === true || ["attack", "damage", "harmful"].includes(skillFamily(skill));
  }

  function canTarget(unit, target, skill = {}, options = {}) {
    if (!unit || !target) return { allowed: true, reason: null };
    const charmed = status(unit, "charmed");
    if (charmed && statusSourceMatches(charmed, target) && isHarmfulSkill(skill)) return { allowed: false, reason: "charmed_source_protected" };
    const frightened = status(unit, "frightened");
    if (frightened && statusSourceMatches(frightened, target)) return { allowed: false, reason: "frightened_source_untargetable" };
    if (has(target, "invisible")) {
      const weight = Math.max(1, numberOr(skill.weight ?? skill.skillWeight ?? skill.skill_weight, 1));
      if (weight <= 3 && options.ignoreInvisible !== true) return { allowed: false, reason: "invisible_weight_3_or_less", weight };
    }
    return { allowed: true, reason: null };
  }

  function checkKind(check = {}) {
    return normalizeId(check.kind || check.checkType || check.type || (check.skillId ? "skill" : "ability"));
  }

  function checkAbility(check = {}) {
    return normalizeId(check.abilityId || check.ability || check.stat || "");
  }

  function thresholdModifier(unit, check = {}, options = {}) {
    let value = exhaustion?.thresholdModifier?.(unit, check) || 0;
    const kind = checkKind(check);
    const skillId = normalizeId(check.skillId || check.skill || "");
    const senses = Array.isArray(check.senses) ? check.senses.map(normalizeId) : [normalizeId(check.sense || "")].filter(Boolean);
    if (has(unit, "blinded") && skillId === "perception") value += 99;
    if (has(unit, "deafened") && skillId === "perception" && (check.hearingBased === true || senses.includes("hearing"))) value += 99;
    if (has(unit, "poisoned") && ["ability", "ability_check", "skill", "skill_check", "check"].includes(kind)) value += 2;
    if (has(unit, "restrained") && ["save", "saving_throw", "savingthrow"].includes(kind) && checkAbility(check) === "dex") value += 3;
    const target = options.target || check.target || null;
    const targetCharmed = target ? status(target, "charmed") : null;
    if (targetCharmed && statusSourceMatches(targetCharmed, unit) && checkAbility(check) === "cha") value -= 3;
    return value;
  }

  function applyCheckThreshold(unit, check = {}, options = {}) {
    const modifier = thresholdModifier(unit, check, options);
    if (!modifier) return { check, modifier: 0 };
    if (Number.isFinite(Number(check.difficulty))) check.difficulty = Number(check.difficulty) + modifier;
    else if (Number.isFinite(Number(check.thresholdRaw))) check.thresholdRaw = Number(check.thresholdRaw) + modifier;
    else if (Number.isFinite(Number(check.threshold))) check.threshold = Number(check.threshold) + modifier;
    else check.conditionThresholdModifier = numberOr(check.conditionThresholdModifier, 0) + modifier;
    return { check, modifier };
  }

  function emptyModifiers() {
    return { final_power: 0, defense_power: 0, clash_power: 0, counter_power: 0, evade_power: 0, min_speed: 0, max_speed: 0, speed: 0 };
  }

  function contextualModifiers(options = {}) {
    const unit = options.unit || options.character || {};
    const target = options.target || null;
    const output = emptyModifiers();
    const frightened = status(unit, "frightened");
    if (frightened) {
      output.clash_power -= 3;
      if (target && statusSourceMatches(frightened, target)) output.clash_power -= 3;
    }
    if (target && (has(target, "prone") || has(target, "restrained"))) output.final_power += 2;
    const fatigue = exhaustion?.combatModifiers?.(unit) || {};
    output.clash_power += numberOr(fatigue.clash_power, 0);
    output.max_speed += numberOr(fatigue.max_speed, 0);
    return output;
  }

  function fixedSpeedFor(unit) {
    if (FIXED_SPEED_STATUSES.some((id) => has(unit, id))) return 1;
    return exhaustion?.fixedSpeed?.(unit) ?? null;
  }

  function poisonDamageMultiplier(unit) {
    if (has(unit, "petrified")) return 0;
    return has(unit, "poisoned") ? 1.5 : 1;
  }

  function retreat(unit, reason) {
    unit.lifeState = "retreated";
    unit.isRetreated = true;
    unit.isDowned = false;
    unit.actionQueue = [];
    emit("luminous:condition-retreat", { unit, reason });
    return unit;
  }

  function turnStart(unit, options = {}) {
    const outcomes = [];
    const frightened = status(unit, "frightened");
    if (frightened && numberOr(frightened.count, 0) <= 0) {
      retreat(unit, "frightened_count_0");
      outcomes.push({ type: "retreat", statusId: "frightened" });
    }
    if (has(unit, "petrified")) {
      const protection = statusEngine()?.applyStatus?.(unit, "protection", { mode: "gain", count: 5, duration: "until_removed", data: { sourceCondition: "petrified" } });
      outcomes.push({ type: "gain_status", statusId: "protection", count: 5, status: protection });
    }
    if (has(unit, "prone")) {
      const removed = statusEngine()?.removeStatus?.(unit, "prone", { from: "self", ignoreProtection: true });
      outcomes.push({ type: "remove_status", statusId: "prone", removed: Boolean(removed?.removed) });
    }
    if (has(unit, "invisible")) {
      const request = { type: "opposed_check_all", statusId: "invisible", initiator: unit, initiatorCheck: { kind: "skill", abilityId: "dex", skillId: "stealth" }, rivalCheck: { kind: "skill", abilityId: "wis", skillId: "perception" }, targets: options.units || options.combatants || null };
      outcomes.push(request);
      if (typeof options.resolvePerceptionChecks === "function") request.result = options.resolvePerceptionChecks(request);
      else emit("luminous:condition-check-requested", request);
    }
    return outcomes;
  }

  function sourceSpellDc(entry) {
    return numberOr(entry?.data?.spellDC ?? entry?.data?.spellDc ?? entry?.data?.sourceSpellDC, NaN);
  }

  function saveRequest(unit, statusId, abilityId, entry) {
    return { type: "save_check", statusId, unit, sourceUnitId: entry?.sourceUnitId || null, check: { kind: "save", abilityId, threshold: sourceSpellDc(entry), source: statusId } };
  }

  function combatantsFor(unit, options = {}) {
    const values = [unit, ...(options.combatants || options.units || Object.values(global.combatData || {}))].filter(Boolean);
    return values.filter((candidate, index) => values.findIndex((other) => sameUnit(other, candidate)) === index);
  }

  function breakGrapple(unit, options = {}) {
    const own = status(unit, "grappled");
    if (!own) return [];
    const grappleId = own.data?.grappleId || null;
    const results = [];
    combatantsFor(unit, options).forEach((candidate) => {
      const linked = status(candidate, "grappled");
      if (!linked || (grappleId && linked.data?.grappleId !== grappleId)) return;
      const removed = statusEngine()?.removeStatus?.(candidate, "grappled", { from: "self", ignoreProtection: true });
      if (removed?.removed) results.push(candidate);
    });
    emit("luminous:grapple-broken", { unit, grappleId, units: results });
    return results;
  }

  function turnEnd(unit, options = {}) {
    const outcomes = [];
    const resolver = typeof options.resolveCheck === "function" ? options.resolveCheck : null;
    [["blinded", "con"], ["charmed", "wis"], ["deafened", "con"], ["poisoned", "con"]].forEach(([statusId, abilityId]) => {
      const entry = status(unit, statusId);
      if (!entry) return;
      const request = saveRequest(unit, statusId, abilityId, entry);
      const result = resolver ? resolver(request) : null;
      request.result = result;
      if (result?.passed === true || result === true) statusEngine()?.removeStatus?.(unit, statusId, { from: "self", ignoreProtection: true });
      outcomes.push(request);
      if (!resolver) emit("luminous:condition-check-requested", request);
    });

    const frightened = status(unit, "frightened");
    if (frightened) {
      const request = saveRequest(unit, "frightened", "wis", frightened);
      const result = resolver ? resolver(request) : null;
      request.result = result;
      if (result?.passed === true || result === true) statusEngine()?.removeStatus?.(unit, "frightened", { from: "self", ignoreProtection: true });
      else if (resolver) statusEngine()?.applyStatus?.(unit, "frightened", { mode: "set", count: Math.max(0, numberOr(frightened.count, 5) - 1), duration: frightened.duration, sourceUnitId: frightened.sourceUnitId, data: frightened.data });
      outcomes.push(request);
      if (!resolver) emit("luminous:condition-check-requested", request);
    }

    const grappled = status(unit, "grappled");
    if (grappled?.data?.role === "held") {
      const request = { type: "opposed_check", statusId: "grappled", unit, sourceUnitId: grappled.sourceUnitId, check: { kind: "ability", abilityId: "str" }, rivalCheck: { kind: "ability", abilityId: "str" } };
      const result = resolver ? resolver(request) : null;
      request.result = result;
      if (result?.passed === true || result === true) breakGrapple(unit, options);
      outcomes.push(request);
      if (!resolver) emit("luminous:condition-check-requested", request);
    }
    return outcomes;
  }

  function resolveTrigger(unit, triggerId, options = {}) {
    const trigger = normalizeId(triggerId);
    const removed = [];
    TRIGGER_REMOVAL_STATUSES.forEach((statusId) => {
      const entry = status(unit, statusId);
      if (!entry) return;
      const expected = normalizeId(entry.data?.removeTrigger || entry.data?.trigger || entry.data?.triggerId || "");
      if (!expected || expected !== trigger) return;
      const result = statusEngine()?.removeStatus?.(unit, statusId, { from: "self", ignoreProtection: true, ...options });
      if (result?.removed) removed.push(statusId);
    });
    return removed;
  }

  function onActionUsed(unit, options = {}) {
    return status(unit, "grappled")?.data?.role === "grappler" ? breakGrapple(unit, options) : [];
  }

  function grapple(unitA, unitB, options = {}) {
    if (!unitA || !unitB || sameUnit(unitA, unitB)) return { applied: false, reason: "invalid_units" };
    const gate = canUseUniversalAction(unitA, { cost: "action" });
    if (!gate.available) return { applied: false, reason: gate.reason };
    const request = { type: "opposed_check", actionId: "grapple", initiator: unitA, rival: unitB, initiatorCheck: { kind: "ability", abilityId: "str" }, rivalCheck: { kind: "ability", abilityId: "str" } };
    let result = typeof options.resolveOpposedCheck === "function" ? options.resolveOpposedCheck(request) : null;
    if (!result && Number.isFinite(Number(options.unitATotal)) && Number.isFinite(Number(options.unitBTotal))) {
      result = { unitATotal: Number(options.unitATotal), unitBTotal: Number(options.unitBTotal), unitBPassed: Number(options.unitBTotal) >= Number(options.unitATotal) };
    }
    if (!result) {
      emit("luminous:condition-check-requested", request);
      return { applied: false, pending: true, request };
    }
    const unitBFailed = result.unitBFailed === true || result.failed === true || result.unitBPassed === false || (Number.isFinite(Number(result.unitATotal)) && Number.isFinite(Number(result.unitBTotal)) && Number(result.unitBTotal) < Number(result.unitATotal));
    if (!unitBFailed) return { applied: false, resisted: true, request, result };

    const grappleId = `grapple_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const aId = primaryUnitId(unitA);
    const bId = primaryUnitId(unitB);
    const aName = String(unitA.characterName || unitA.character_name || unitA.nombre || unitA.name || aId || "Unit A");
    const bName = String(unitB.characterName || unitB.character_name || unitB.nombre || unitB.name || bId || "Unit B");
    const aStatus = statusEngine()?.applyStatus?.(unitA, "grappled", { mode: "set", count: 1, sourceUnitId: aId, name: `Grappled with ${bName}`, data: { grappleId, role: "grappler", partnerUnitId: bId, sourceUnitName: aName } });
    const bStatus = statusEngine()?.applyStatus?.(unitB, "grappled", { mode: "set", count: 1, sourceUnitId: aId, name: `Grappled by ${aName}`, data: { grappleId, role: "held", partnerUnitId: aId, sourceUnitName: aName } });
    const applied = { applied: true, grappleId, unitA: aStatus, unitB: bStatus, request, result };
    emit("luminous:grapple-applied", { unitA, unitB, ...applied });
    return applied;
  }

  function mergeModifiers(source, ...parts) {
    if (source?.mergeModifiers) return source.mergeModifiers(...parts);
    const output = {};
    parts.forEach((part) => Object.entries(part || {}).forEach(([key, value]) => { output[key] = numberOr(output[key], 0) + numberOr(value, 0); }));
    return output;
  }

  function installModifierBridge() {
    const source = global.LuminousUniversalModifiers;
    if (!source) return false;
    if (source.__luminousCoreConditionsWrapped) { bridgeState.modifierSource = source; return true; }
    if (bridgeState.modifierSource === source) return true;
    const wrapped = { ...source, __luminousCoreConditionsWrapped: true };
    if (typeof source.resolveCharacterSnapshot === "function") {
      wrapped.resolveCharacterSnapshot = function (options = {}) {
        const base = source.resolveCharacterSnapshot.call(source, options);
        const extra = contextualModifiers(options);
        return {
          ...base,
          modifiers: mergeModifiers(source, base?.modifiers || {}, extra),
          maxSpeed: numberOr(base?.maxSpeed, 0) + numberOr(extra.max_speed, 0) + numberOr(extra.speed, 0),
          minSpeed: numberOr(base?.minSpeed, 0) + numberOr(extra.min_speed, 0) + numberOr(extra.speed, 0),
          statusModifiers: mergeModifiers(source, base?.statusModifiers || {}, { final_power: extra.final_power, clash_power: extra.clash_power }),
        };
      };
    }
    if (typeof source.canUseSkill === "function") {
      wrapped.canUseSkill = function (unit, skill, options = {}) {
        const base = source.canUseSkill.call(source, unit, skill);
        if (!base?.usable) return base;
        const target = options.target || skill?.target || null;
        const gate = target ? canTarget(unit, target, skill, options) : { allowed: true };
        return gate.allowed ? base : { ...base, usable: false, reason: gate.reason, restriction: "condition" };
      };
    }
    global.LuminousUniversalModifiers = Object.freeze(wrapped);
    bridgeState.modifierSource = global.LuminousUniversalModifiers;
    return true;
  }

  function install() {
    installRegistry();
    exhaustion?.bindRestListener?.();
    installModifierBridge();
    return true;
  }

  const api = Object.freeze({
    DEFINITIONS, TRIGGER_REMOVAL_STATUSES, FIXED_SPEED_STATUSES,
    installRegistry, getDefinition, normalizeStatusInput,
    hasStatus: has, getStatus: status, sameUnit, statusSourceMatches,
    canApplyStatus, actionAvailability, canUseUniversalAction, canTarget,
    thresholdModifier, applyCheckThreshold, contextualModifiers, fixedSpeedFor, poisonDamageMultiplier,
    turnStart, turnEnd, resolveTrigger, breakGrapple, onActionUsed, grapple,
    installModifierBridge, install,
  });

  global.LuminousConditionRuntime = api;
  install();
  if (global.document) global.setInterval?.(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
