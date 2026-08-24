(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousArchetypeCombatEventRuntime) return;

  const PATCH_INTERVAL_MS = 250;
  const DEVIL_ARCHETYPE_ID = "path_of_the_devil_lineage";
  const DEVIL_CLASS_ID = "barbarian";
  const LOW_HP_CRIT_STATUS_ID = "devil_lineage_low_hp_crit_bonus";
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
    turnMechanicsByKey: new Map(),
    turnMechanicsByObject: typeof WeakMap === "function" ? new WeakMap() : null,
    attackStack: [],
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

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

  function traitCharacterForUnit(unit = {}) {
    const build = unit.characterBuild && typeof unit.characterBuild === "object" ? unit.characterBuild : {};
    const classes = Array.isArray(unit.classes)
      ? unit.classes
      : (Array.isArray(build.classes) ? build.classes : []);
    return {
      ...unit,
      classes,
      characterBuild: build,
    };
  }

  function devilLineageLevel(unit = {}) {
    const character = traitCharacterForUnit(unit);
    const playerRuntime = global.LuminousArchetypeRuntime;
    if (playerRuntime?.devilLineageLevel) {
      try {
        const value = numberOr(playerRuntime.devilLineageLevel(character), 0);
        if (value > 0) return value;
      } catch (_) {}
    }

    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected && engine?.getClassLevel) {
      try {
        if (engine.isSelected(character, DEVIL_ARCHETYPE_ID, DEVIL_CLASS_ID)) {
          return Math.max(0, numberOr(engine.getClassLevel(character, DEVIL_CLASS_ID), 0));
        }
      } catch (_) {}
    }

    const selections = Array.isArray(character.characterBuild?.archetypes) ? character.characterBuild.archetypes : [];
    const selected = selections.some((entry) =>
      normalizeId(entry?.classId || entry?.parentClassId) === DEVIL_CLASS_ID &&
      normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id) === DEVIL_ARCHETYPE_ID
    );
    if (!selected) return 0;
    const classes = Array.isArray(character.characterBuild?.classes) ? character.characterBuild.classes : character.classes || [];
    const barbarian = classes.find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === DEVIL_CLASS_ID);
    return Math.max(0, numberOr(barbarian?.level ?? barbarian?.levels, 0));
  }

  function unitHp(unit = {}) {
    return numberOr(unit.hp ?? unit.currentHp ?? unit.hp_actual ?? unit.combatStats?.hp_actual, 0);
  }

  function unitMaxHp(unit = {}) {
    return Math.max(1, numberOr(unit.maxHp ?? unit.max_hp ?? unit.hp_max ?? unit.combatStats?.hp_max ?? unit.combatStats?.maxHp, 1));
  }

  function criticalBonusApplies(unit = {}) {
    return devilLineageLevel(unit) >= 30 && unitHp(unit) <= unitMaxHp(unit) * 0.5;
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
    global.LuminousDevilLineageRuntime?.trackUnit?.(unit);
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

  function turnMechanicsFor(unit = {}) {
    const key = unitKey(unit);
    const create = () => ({ reuseLastUsed: false, reuseSkillUsed: false });
    if (key) {
      if (!state.turnMechanicsByKey.has(key)) state.turnMechanicsByKey.set(key, create());
      return state.turnMechanicsByKey.get(key);
    }
    if (state.turnMechanicsByObject) {
      if (!state.turnMechanicsByObject.has(unit)) state.turnMechanicsByObject.set(unit, create());
      return state.turnMechanicsByObject.get(unit);
    }
    return create();
  }

  function resetTurnMechanics(units = []) {
    const list = Array.isArray(units) ? units : [units];
    list.filter(Boolean).forEach((unit) => {
      const key = unitKey(unit);
      if (key) state.turnMechanicsByKey.delete(key);
      else if (state.turnMechanicsByObject) state.turnMechanicsByObject.delete(unit);
    });
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
    const character = traitCharacterForUnit(unit);

    traits.forEach((trait) => {
      const runtime = {
        context: "combat",
        character,
        self: unit,
        sourceClassId: normalizeId(trait?.source?.classId || trait?.classId),
        ...(input || {}),
      };
      runtime.character = character;
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

  function ensureCritRegistry() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    if (!global.STATUS_REGISTRY[LOW_HP_CRIT_STATUS_ID]) {
      global.STATUS_REGISTRY[LOW_HP_CRIT_STATUS_ID] = {
        id: LOW_HP_CRIT_STATUS_ID,
        name: "Devil Lineage Low HP Critical Bonus",
        type: "neutral",
        mode: "single",
        icon: null,
        rules: [],
        crit_vulnerability_per_count: 0.10,
        runtimeOnly: true,
      };
    }
    return global.STATUS_REGISTRY[LOW_HP_CRIT_STATUS_ID];
  }

  function clearCritMarkers(context = {}) {
    const markers = Array.isArray(context.__devilLineageCritMarkers) ? context.__devilLineageCritMarkers : [];
    markers.forEach((entry) => {
      const store = entry.target?.statusEffects;
      if (!store || typeof store !== "object") return;
      if (entry.hadOwn) store[LOW_HP_CRIT_STATUS_ID] = entry.previous;
      else delete store[LOW_HP_CRIT_STATUS_ID];
    });
    context.__devilLineageCritMarkers = [];
  }

  function prepareCritMarkers(context = {}, targetsHit = []) {
    clearCritMarkers(context);
    const attacker = context.attacker || context.unitAttacker || null;
    if (!attacker || !criticalBonusApplies(attacker)) return false;
    ensureCritRegistry();

    const candidates = [context.defender, ...(Array.isArray(targetsHit) ? targetsHit : []), ...(Array.isArray(context.targetsHit) ? context.targetsHit : [])];
    const seen = new Set();
    const markers = [];
    candidates.filter(Boolean).forEach((target) => {
      const key = unitKey(target) || target;
      if (seen.has(key)) return;
      seen.add(key);
      if (!target.statusEffects || typeof target.statusEffects !== "object" || Array.isArray(target.statusEffects)) target.statusEffects = {};
      const hadOwn = Object.prototype.hasOwnProperty.call(target.statusEffects, LOW_HP_CRIT_STATUS_ID);
      const previous = target.statusEffects[LOW_HP_CRIT_STATUS_ID];
      target.statusEffects[LOW_HP_CRIT_STATUS_ID] = {
        id: LOW_HP_CRIT_STATUS_ID,
        count: 1,
        potency: 0,
        duration: "runtime_coin",
        data: { runtimeOnly: true },
      };
      markers.push({ target, hadOwn, previous });
    });
    context.__devilLineageCritMarkers = markers;
    const tracker = currentAttackTracker(context);
    if (tracker) tracker.critMarkers = markers;
    return markers.length > 0;
  }

  function currentAttackTracker(context = {}) {
    const attacker = context.attacker || context.unitAttacker || null;
    const skill = context.skill || null;
    for (let index = state.attackStack.length - 1; index >= 0; index -= 1) {
      const tracker = state.attackStack[index];
      if ((!attacker || sameUnit(tracker.attacker, attacker)) && (!skill || tracker.skill === skill)) return tracker;
    }
    return null;
  }

  function captureDevilEvent(tag, context = {}, targetsHit = []) {
    if (tag === "[Coin Start]") prepareCritMarkers(context, targetsHit);
    if (tag === "[Current Coin Attack End]" || tag === "[Attack End]") clearCritMarkers(context);

    const tracker = currentAttackTracker(context);
    if (!tracker || tracker.reuseCall || devilLineageLevel(tracker.attacker) < 30) return tracker;
    const turn = turnMechanicsFor(tracker.attacker);
    const target = (Array.isArray(targetsHit) && targetsHit[0]) || context.currentTarget || context.defender || tracker.defender || null;

    if (tag === "[On Crit]" && tracker.baseCoinCount >= 2 && tracker.baseCoinCount <= 3 && !turn.reuseLastUsed) {
      tracker.pendingReuseLast = true;
      tracker.reuseLastTarget = target;
    }
    if (tag === "[On Crit Kill]" && tracker.baseCoinCount === 1 && !turn.reuseSkillUsed) {
      tracker.pendingReuseSkill = true;
      tracker.reuseSkillKilledTarget = target;
    }
    return tracker;
  }

  function cloneCoin(coin = {}, reused = false) {
    return {
      ...coin,
      status: "active",
      isReused: reused || coin.isReused === true,
      effects: Array.isArray(coin.effects) ? [...coin.effects] : [],
    };
  }

  function cloneSkillForReuse(skill = {}, coins = []) {
    const clonedCoins = coins.map((coin) => cloneCoin(coin, true));
    const next = {
      ...skill,
      coins: clonedCoins,
      coinAmount: Math.max(1, clonedCoins.length),
      effects: Array.isArray(skill.effects) ? [...skill.effects] : [],
    };
    delete next.__traitRuleScopes;
    return next;
  }

  function cleanupTraitAppendedCoins(tracker) {
    const skill = tracker?.skill;
    const count = Math.max(0, Math.trunc(numberOr(tracker?.appendedByTrait, 0)));
    if (!skill || !Array.isArray(skill.coins) || !count) return 0;
    const removable = Math.min(count, Math.max(0, skill.coins.length - tracker.baseCoinCount));
    if (removable > 0) skill.coins.splice(skill.coins.length - removable, removable);
    skill.coinAmount = skill.coins.length || tracker.baseCoinCount || skill.coinAmount;
    return removable;
  }

  function aliveHostiles(engine, attacker, options = {}, excluded = null) {
    const explicit = Array.isArray(options.combatants) ? options.combatants : [];
    const source = explicit.length ? explicit : (typeof engine.getAllAliveUnits === "function" ? engine.getAllAliveUnits() : []);
    const faction = attacker?.faction ?? attacker?.faccion;
    return (Array.isArray(source) ? source : []).filter((unit) => {
      if (!unit || sameUnit(unit, attacker) || (excluded && sameUnit(unit, excluded)) || unitHp(unit) <= 0) return false;
      const otherFaction = unit.faction ?? unit.faccion;
      return faction == null || otherFaction == null || otherFaction !== faction;
    });
  }

  function chooseReuseTarget(engine, tracker) {
    const candidates = aliveHostiles(engine, tracker.attacker, tracker.options || {}, tracker.reuseSkillKilledTarget);
    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function executeLastCoinReuse(engine, tracker) {
    const target = tracker.reuseLastTarget || tracker.defender;
    if (!target || unitHp(target) <= 0 || typeof engine.resolveUnilateralWithCounter !== "function") return null;
    const template = tracker.lastCoinTemplate || { type: tracker.skill?.coinType || "standard", effects: [] };
    const skill = cloneSkillForReuse(tracker.skill, [template]);
    const options = { ...(tracker.options || {}), skipUseHooks: true, __devilLineageReuse: true };
    return engine.resolveUnilateralWithCounter(tracker.attacker, skill, target, null, options);
  }

  function executeSkillReuse(engine, tracker) {
    const target = chooseReuseTarget(engine, tracker);
    if (!target || typeof engine.resolveUnilateralWithCounter !== "function") return null;
    const templates = tracker.baseCoinsTemplate.length ? tracker.baseCoinsTemplate : [{ type: tracker.skill?.coinType || "standard", effects: [] }];
    const skill = cloneSkillForReuse(tracker.skill, templates);
    const options = { ...(tracker.options || {}), skipUseHooks: true, skill_reused: true, __devilLineageReuse: true };
    return engine.resolveUnilateralWithCounter(tracker.attacker, skill, target, null, options);
  }

  function mergeReuseResult(base, extra, key) {
    if (!extra) return base;
    const result = base && typeof base === "object" ? base : {};
    if (Array.isArray(extra.attackLogs)) {
      if (!Array.isArray(result.attackLogs)) result.attackLogs = [];
      result.attackLogs.push(...extra.attackLogs);
    }
    if (Array.isArray(extra.pendingActions)) {
      if (!Array.isArray(result.pendingActions)) result.pendingActions = [];
      result.pendingActions.push(...extra.pendingActions);
    }
    result[key] = extra;
    return result;
  }

  function clearEncounterState() {
    state.traitStateByKey.clear();
    state.traitStateByObject = typeof WeakMap === "function" ? new WeakMap() : null;
    state.turnMechanicsByKey.clear();
    state.turnMechanicsByObject = typeof WeakMap === "function" ? new WeakMap() : null;
    state.attackStack.length = 0;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine) return false;
    if (engine.__archetypeCombatEventRuntimeIntegratedV2) {
      state.combatSource = engine;
      return true;
    }
    if (state.combatSource === engine && engine.__archetypeCombatEventRuntimeIntegratedV2) return true;

    const originalInitialize = typeof engine.initializeUnitData === "function" ? engine.initializeUnitData : null;
    const originalEncounterStart = typeof engine.triggerEncounterStart === "function" ? engine.triggerEncounterStart : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalResolveUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;

    if (originalInitialize) {
      engine.initializeUnitData = function (unit, ...rest) {
        const result = originalInitialize.call(this, unit, ...rest);
        global.LuminousArchetypeRuntime?.syncArchetypeTraitsForUnit?.(unit);
        global.LuminousDevilLineageRuntime?.trackUnit?.(unit);
        return result;
      };
    }

    if (originalEncounterStart) {
      engine.triggerEncounterStart = function (allUnits = [], ...rest) {
        clearEncounterState();
        const result = originalEncounterStart.call(this, allUnits, ...rest);
        (Array.isArray(allUnits) ? allUnits : []).forEach((unit) => {
          global.LuminousDevilLineageRuntime?.trackUnit?.(unit);
          dispatchForUnit("encounter_start", unit, { units: allUnits });
        });
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const units = Array.isArray(allUnits) ? allUnits : [];
        if (phaseTag === "[Round Start]") resetTurnMechanics(units);
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
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
        captureDevilEvent(tag, context, targetsHit);
        const mapping = EVENT_MAP[tag];
        if (mapping?.timing === "before") dispatchMappedEvent(mapping, context, targetsHit);
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        const tracker = currentAttackTracker(context || {});
        const beforeMappedCoins = Array.isArray(context?.skill?.coins) ? context.skill.coins.length : 0;
        if (mapping?.timing === "after") dispatchMappedEvent(mapping, context, targetsHit);
        if (tag === "[On Crit]" && tracker && Array.isArray(context?.skill?.coins)) {
          tracker.appendedByTrait += Math.max(0, context.skill.coins.length - beforeMappedCoins);
        }
        return result;
      };
    }

    if (originalResolveUnilateral) {
      engine.resolveUnilateralWithCounter = function (attacker, skill, defender, counterSkill, options = {}) {
        const baseCoins = Array.isArray(skill?.coins) && skill.coins.length
          ? skill.coins.map((coin) => cloneCoin(coin, false))
          : Array.from({ length: Math.max(1, Math.trunc(numberOr(skill?.coinAmount, 1))) }, () => ({ type: skill?.coinType || "standard", status: "active", effects: [] }));
        const tracker = {
          attacker,
          skill,
          defender,
          counterSkill,
          options: options || {},
          reuseCall: options?.__devilLineageReuse === true,
          baseCoinCount: baseCoins.length,
          baseCoinsTemplate: baseCoins,
          lastCoinTemplate: baseCoins.at(-1),
          pendingReuseLast: false,
          pendingReuseSkill: false,
          reuseLastTarget: null,
          reuseSkillKilledTarget: null,
          appendedByTrait: 0,
        };
        state.attackStack.push(tracker);
        let result;
        try {
          result = originalResolveUnilateral.call(this, attacker, skill, defender, counterSkill, options);
        } finally {
          const index = state.attackStack.lastIndexOf(tracker);
          if (index >= 0) state.attackStack.splice(index, 1);
          clearCritMarkers({ __devilLineageCritMarkers: tracker.critMarkers || [] });
        }

        cleanupTraitAppendedCoins(tracker);
        if (tracker.reuseCall || devilLineageLevel(attacker) < 30) return result;

        const turn = turnMechanicsFor(attacker);
        if (tracker.pendingReuseLast && !turn.reuseLastUsed) {
          turn.reuseLastUsed = true;
          result = mergeReuseResult(result, executeLastCoinReuse(this, tracker), "devilLineageReuseLastCoin");
        }
        if (tracker.pendingReuseSkill && !turn.reuseSkillUsed) {
          turn.reuseSkillUsed = true;
          result = mergeReuseResult(result, executeSkillReuse(this, tracker), "devilLineageReuseSkill");
        }
        return result;
      };
    }

    Object.defineProperty(engine, "__archetypeCombatEventRuntimeIntegrated", { value: true, configurable: true });
    Object.defineProperty(engine, "__archetypeCombatEventRuntimeIntegratedV2", { value: true, configurable: true });
    state.combatSource = engine;
    return true;
  }

  function install() {
    return patchCombatEngine();
  }

  const api = Object.freeze({
    EVENT_MAP,
    LOW_HP_CRIT_STATUS_ID,
    unitKey,
    sameUnit,
    traitCharacterForUnit,
    devilLineageLevel,
    criticalBonusApplies,
    traitsForUnit,
    traitStateFor,
    turnMechanicsFor,
    delegatedToPlayerRuntime,
    dispatchForUnit,
    dispatchMappedEvent,
    ensureCritRegistry,
    prepareCritMarkers,
    clearCritMarkers,
    captureDevilEvent,
    resetTurnMechanics,
    clearEncounterState,
    patchCombatEngine,
    install,
  });

  global.LuminousArchetypeCombatEventRuntime = api;
  install();
  global.setInterval?.(install, PATCH_INTERVAL_MS);
})(typeof window !== "undefined" ? window : globalThis);
