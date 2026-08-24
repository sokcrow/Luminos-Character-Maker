(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousArchetypeCombatEventRuntime) return;

  const PATCH_INTERVAL_MS = 250;
  const EVENT_MAP = Object.freeze({
    "[Before Use]": { trigger: "before_skill", timing: "before" },
    "[Before Attack]": { trigger: "before_attack", timing: "before" },
    "[Before Clash]": { trigger: "before_clash", timing: "before" },
    "[On Hit]": { trigger: "on_hit", timing: "after", perTarget: true },
    "[On Crit]": { trigger: "on_crit", timing: "after", perTarget: true },
    "[On Kill]": { trigger: "on_kill", timing: "after", perTarget: true },
    "[On Clash Win]": { trigger: "clash_win", timing: "after" },
    "[On Clash Lose]": { trigger: "clash_lose", timing: "after" },
    "[On Evade]": { trigger: "on_evade", timing: "after" },
    "[Attack End]": { trigger: "attack_end", timing: "after" },
  });

  const state = {
    combatSource: null,
    traitStateByKey: new Map(),
    traitStateByObject: typeof WeakMap === "function" ? new WeakMap() : null,
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");

  function identityValues(entity = {}) {
    return [
      entity.combatId, entity.combat_id, entity.unitId, entity.unit_id,
      entity.id, entity.playerId, entity.player_id, entity.characterId, entity.character_id,
      entity.actorId, entity.actor_id, entity.uid, entity.vinculo_jugador,
    ]
      .filter((value) => value != null && String(value).trim() !== "")
      .map((value) => String(value).trim());
  }

  function entityName(entity = {}) {
    return normalizeId(entity.characterName || entity.character_name || entity.nombre || entity.name || "");
  }

  function unitKey(unit = {}) {
    return identityValues(unit)[0] || entityName(unit) || null;
  }

  function sameUnit(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const aIds = new Set(identityValues(a));
    if (identityValues(b).some((id) => aIds.has(id))) return true;
    const aName = entityName(a);
    return Boolean(aName && aName === entityName(b));
  }

  function delegatedToPlayerRuntime(unit) {
    const runtime = global.LuminousPlayerTraitRuntime;
    if (!runtime?.dispatchCombatEvent || !runtime?.getCharacter) return false;
    return sameUnit(unit, runtime.getCharacter());
  }

  function isArchetypeTrait(trait = {}) {
    const source = trait.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType));
  }

  function traitsForUnit(unit = {}) {
    global.LuminousArchetypeRuntime?.syncArchetypeTraitsForUnit?.(unit);
    const definitions = Array.isArray(unit.traitDefinitions)
      ? unit.traitDefinitions
      : (Array.isArray(unit.traits) && unit.traits.every((entry) => entry && typeof entry === "object") ? unit.traits : []);
    return definitions.filter(isArchetypeTrait);
  }

  function traitStateFor(unit = {}) {
    const engine = global.LuminousTraitEngine;
    const key = unitKey(unit);
    if (key) {
      if (!state.traitStateByKey.has(key)) state.traitStateByKey.set(key, engine?.createState?.() || { usages: {}, ruleScopes: {}, counters: {} });
      return state.traitStateByKey.get(key);
    }
    if (state.traitStateByObject) {
      if (!state.traitStateByObject.has(unit)) state.traitStateByObject.set(unit, engine?.createState?.() || { usages: {}, ruleScopes: {}, counters: {} });
      return state.traitStateByObject.get(unit);
    }
    return engine?.createState?.() || { usages: {}, ruleScopes: {}, counters: {} };
  }

  function resetScopeForTrigger(trigger, traitState) {
    const engine = global.LuminousTraitEngine;
    if (!engine?.resetStateScope || !traitState) return;
    const id = normalizeId(trigger);
    if (id === "turn_start") engine.resetStateScope(traitState, "turn");
    else if (id === "encounter_start") engine.resetStateScope(traitState, "encounter");
    else if (id === "short_rest" || id === "long_rest") engine.resetStateScope(traitState, id);
    else if (id === "day_start") engine.resetStateScope(traitState, "day");
  }

  function dispatchForUnit(trigger, unit, input = {}) {
    const engine = global.LuminousTraitEngine;
    if (!unit || !engine?.dispatchTrait) return null;
    if (delegatedToPlayerRuntime(unit)) return { delegated: true, unit, trigger: normalizeId(trigger), outcomes: [] };

    const traits = traitsForUnit(unit);
    if (!traits.length) return { delegated: false, unit, trigger: normalizeId(trigger), outcomes: [] };

    const traitState = traitStateFor(unit);
    resetScopeForTrigger(trigger, traitState);
    const allOutcomes = [];
    const normalizedTrigger = normalizeId(trigger);

    traits.forEach((trait) => {
      const runtime = {
        context: "combat",
        character: unit,
        self: unit,
        sourceClassId: normalizeId(trait?.source?.classId || trait?.classId),
        ...(input || {}),
      };
      runtime.character = unit;
      runtime.self = unit;

      if (normalizedTrigger !== "passive") {
        const passive = engine.dispatchTrait(trait, "passive", runtime, traitState);
        if (Array.isArray(passive?.outcomes)) allOutcomes.push(...passive.outcomes);
      }
      const result = engine.dispatchTrait(trait, normalizedTrigger, runtime, traitState);
      if (Array.isArray(result?.outcomes)) allOutcomes.push(...result.outcomes);

      global.LuminousTraitStandardizationRuntime?.resolveTraitRuntimeResolutions?.(
        [trait],
        normalizedTrigger,
        result?.runtime || runtime,
        result,
      );
    });

    return { delegated: false, unit, trigger: normalizedTrigger, state: traitState, outcomes: allOutcomes };
  }

  function eventTargets(mapping, context = {}, targetsHit = []) {
    if (!mapping?.perTarget) return [context?.target || context?.currentTarget || context?.defender || null];
    const candidates = Array.isArray(targetsHit) && targetsHit.length
      ? targetsHit
      : (Array.isArray(context.targetsHit) && context.targetsHit.length ? context.targetsHit : [context?.currentTarget || context?.defender || null]);
    const seen = new Set();
    return candidates.filter((target) => {
      if (!target) return false;
      const key = unitKey(target) || target;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function dispatchMappedEvent(mapping, context = {}, targetsHit = []) {
    if (!mapping) return [];
    const attacker = context?.attacker || context?.unitAttacker || null;
    if (!attacker) return [];
    const targets = eventTargets(mapping, context, targetsHit);
    if (!mapping.perTarget) {
      const target = targets[0] || null;
      return [dispatchForUnit(mapping.trigger, attacker, {
        attacker,
        defender: target || context?.defender || null,
        target,
        targetsHit: Array.isArray(targetsHit) ? targetsHit : [],
        skill: context?.skill || null,
        currentCoin: context?.currentCoin || null,
        damageDealt: context?.damageDealt,
        isCritical: context?.isCritical,
      })].filter(Boolean);
    }
    return targets.map((target) => dispatchForUnit(mapping.trigger, attacker, {
      attacker,
      defender: target,
      target,
      targetsHit: targets,
      skill: context?.skill || null,
      currentCoin: context?.currentCoin || null,
      damageDealt: context?.damageDealt,
      isCritical: mapping.trigger === "on_crit" || context?.isCritical === true,
    })).filter(Boolean);
  }

  function clearEncounterState() {
    state.traitStateByKey.clear();
    state.traitStateByObject = typeof WeakMap === "function" ? new WeakMap() : null;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine) return false;
    if (engine.__archetypeCombatEventRuntimeIntegrated) {
      state.combatSource = engine;
      return true;
    }
    if (state.combatSource === engine) return true;

    const originalInitialize = typeof engine.initializeUnitData === "function" ? engine.initializeUnitData : null;
    const originalEncounterStart = typeof engine.triggerEncounterStart === "function" ? engine.triggerEncounterStart : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;

    if (originalInitialize) {
      engine.initializeUnitData = function (unit, ...rest) {
        const result = originalInitialize.call(this, unit, ...rest);
        global.LuminousArchetypeRuntime?.syncArchetypeTraitsForUnit?.(unit);
        return result;
      };
    }

    if (originalEncounterStart) {
      engine.triggerEncounterStart = function (allUnits = [], ...rest) {
        clearEncounterState();
        const result = originalEncounterStart.call(this, allUnits, ...rest);
        (Array.isArray(allUnits) ? allUnits : []).forEach((unit) => {
          dispatchForUnit("encounter_start", unit, { units: allUnits });
        });
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        const units = Array.isArray(allUnits) ? allUnits : [];
        if (phaseTag === "[Round Start]") {
          units.forEach((unit) => dispatchForUnit("turn_start", unit, { units }));
        } else if (phaseTag === "[Round End]") {
          units.forEach((unit) => dispatchForUnit("turn_end", unit, { units }));
        }
        return result;
      };
    }

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const mapping = EVENT_MAP[tag];
        if (mapping?.timing === "before") dispatchMappedEvent(mapping, context, targetsHit);
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        if (mapping?.timing === "after") dispatchMappedEvent(mapping, context, targetsHit);
        return result;
      };
    }

    Object.defineProperty(engine, "__archetypeCombatEventRuntimeIntegrated", { value: true, configurable: true });
    state.combatSource = engine;
    return true;
  }

  function install() {
    return patchCombatEngine();
  }

  const api = Object.freeze({
    EVENT_MAP,
    unitKey,
    sameUnit,
    traitsForUnit,
    traitStateFor,
    delegatedToPlayerRuntime,
    dispatchForUnit,
    dispatchMappedEvent,
    clearEncounterState,
    patchCombatEngine,
    install,
  });

  global.LuminousArchetypeCombatEventRuntime = api;
  install();
  global.setInterval?.(install, PATCH_INTERVAL_MS);
})(typeof window !== "undefined" ? window : globalThis);
