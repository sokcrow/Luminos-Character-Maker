(function (global) {
  "use strict";

  if (global.LuminousDeathSaveRuntime) return;

  const PATCH_INTERVAL_MS = 250;
  const MAX_DEATH_SAVES = 3;
  const DEATH_SAVE_CHECK = Object.freeze({
    coinAmount: 5,
    coinPower: 4,
    basePower: 0,
    threshold: 10,
    flat: true,
    statModifiers: false,
    headsChance: 50,
  });

  const state = {
    combatSource: null,
    retreatQueue: [],
    skillTokens: typeof WeakMap === "function" ? new WeakMap() : null,
    nextSkillToken: 1,
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function unitIds(unit = {}) {
    return [unit.id, unit.unitId, unit.unit_id, unit.characterId, unit.character_id, unit.playerId, unit.player_id, unit.uid]
      .filter((value) => value != null && String(value).trim() !== "")
      .map((value) => String(value).trim());
  }

  function hasTag(unit = {}, tag) {
    const wanted = normalizeId(tag);
    const values = [];
    [unit.tags, unit.unitTags, unit.labels, unit.markers].forEach((list) => {
      if (Array.isArray(list)) values.push(...list);
    });
    return values.some((value) => normalizeId(value?.id || value?.name || value) === wanted);
  }

  function traitIds(unit = {}) {
    const values = [];
    [unit.traitIds, unit.grantedTraitIds, unit.racialTraitIds].forEach((list) => {
      if (Array.isArray(list)) values.push(...list);
    });
    [unit.traits, unit.traitDefinitions].forEach((list) => {
      if (Array.isArray(list)) values.push(...list.map((entry) => entry?.id || entry?.name || entry));
    });
    return new Set(values.filter(Boolean).map(normalizeId));
  }

  function isPlayerCharacter(unit = {}) {
    if (unit.isPlayer === true || unit.isPlayerCharacter === true || unit.playerCharacter === true) return true;
    const type = normalizeId(unit.unitType || unit.unit_type || unit.controlType || unit.control_type || unit.actorType || unit.actor_type);
    return ["player", "player_character", "pc"].includes(type);
  }

  function isCaptain(unit = {}) {
    if (unit.isCaptain === true || unit.captain === true || unit.enemyCaptain === true) return true;
    const rank = normalizeId(unit.rank || unit.unitRank || unit.unit_rank || unit.enemyRank || unit.enemy_rank);
    return rank === "captain" || hasTag(unit, "captain");
  }

  function isSinner(unit = {}) {
    return unit.isSinner === true || traitIds(unit).has("sinner");
  }

  function usesDeathSaves(unit = {}) {
    return isPlayerCharacter(unit) || isCaptain(unit);
  }

  function ensureDeathState(unit) {
    if (!unit || typeof unit !== "object") return null;
    if (!unit.deathSaves || typeof unit.deathSaves !== "object") unit.deathSaves = { successes: 0, failures: 0 };
    unit.deathSaves.successes = Math.max(0, Math.min(MAX_DEATH_SAVES, Math.trunc(numberOr(unit.deathSaves.successes, 0))));
    unit.deathSaves.failures = Math.max(0, Math.min(MAX_DEATH_SAVES, Math.trunc(numberOr(unit.deathSaves.failures, 0))));
    if (!unit.lifeState) {
      if (unit.isDead === true) unit.lifeState = "dead";
      else if (unit.isRetreated === true) unit.lifeState = "retreated";
      else if (unit.isDowned === true) unit.lifeState = "downed";
      else unit.lifeState = "alive";
    }
    return unit.deathSaves;
  }

  function resetDeathSaves(unit) {
    const saves = ensureDeathState(unit);
    if (!saves) return null;
    saves.successes = 0;
    saves.failures = 0;
    return saves;
  }

  function isDowned(unit = {}) {
    ensureDeathState(unit);
    return unit.lifeState === "downed" || unit.isDowned === true;
  }

  function isDead(unit = {}) {
    ensureDeathState(unit);
    return unit.lifeState === "dead" || unit.isDead === true;
  }

  function isRetreated(unit = {}) {
    ensureDeathState(unit);
    return unit.lifeState === "retreated" || unit.isRetreated === true;
  }

  function isTargetable(unit = {}) {
    if (!unit || isDead(unit) || isRetreated(unit)) return false;
    return numberOr(unit.hp, 0) > 0 || isDowned(unit);
  }

  function canAct(unit = {}) {
    return Boolean(unit) && !isDowned(unit) && !isDead(unit) && !isRetreated(unit) && numberOr(unit.hp, 0) > 0;
  }

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function dispatchLifeEvent(trigger, unit, context = {}) {
    if (!unit) return null;
    const input = { context: "combat", self: unit, character: unit, unit, target: unit, defender: unit, ...(context || {}) };
    let playerResult = null;
    if (isPlayerCharacter(unit)) {
      try { playerResult = global.LuminousPlayerTraitRuntime?.dispatchCombatEvent?.(trigger, input) || null; } catch (_) {}
    }
    let archetypeResult = null;
    try { archetypeResult = global.LuminousArchetypeCombatEventRuntime?.dispatchForUnit?.(trigger, unit, input) || null; } catch (_) {}
    emit(`luminous:${normalizeId(trigger).replace(/_/g, "-")}`, { unit, trigger, context: input });
    return { playerResult, archetypeResult };
  }

  function markAlive(unit) {
    if (!unit) return unit;
    unit.lifeState = "alive";
    unit.isDowned = false;
    unit.isDead = false;
    unit.isRetreated = false;
    delete unit.deathType;
    delete unit.sinnerDeath;
    return unit;
  }

  function enterDowned(unit, options = {}) {
    if (!unit || isDead(unit) || isRetreated(unit)) return { entered: false, reason: "not_available", unit };
    if (!usesDeathSaves(unit)) return resolveDeath(unit, { ...options, reason: options.reason || "hp_zero", immediateEnemyDeath: true });

    const wasDowned = isDowned(unit);
    ensureDeathState(unit);
    unit.hp = 0;
    unit.lifeState = "downed";
    unit.isDowned = true;
    unit.isDead = false;
    unit.isRetreated = false;
    unit.actionQueue = [];
    if (!wasDowned) resetDeathSaves(unit);

    const sourceKind = normalizeId(options.sourceKind || options.damageType || options.reason || "other");
    emit("luminous:downed", { unit, sourceKind, context: options.context || null });
    if (!wasDowned && ["status", "status_effect", "effect_status", "efecto_estado", "dot"].includes(sourceKind)) {
      const failure = addFailure(unit, { reason: "downed_by_status", context: options.context || null });
      return { entered: true, unit, failure };
    }
    return { entered: !wasDowned, unit };
  }

  function resolveDeath(unit, options = {}) {
    if (!unit) return { died: false, reason: "missing_unit" };
    ensureDeathState(unit);
    if (isDead(unit)) return { died: false, alreadyDead: true, unit };

    const wasDowned = isDowned(unit);
    unit.hp = 0;
    unit.lifeState = "dead";
    unit.isDead = true;
    unit.isDowned = false;
    unit.isRetreated = false;
    unit.actionQueue = [];
    unit.deathType = isSinner(unit) ? "sinner" : "normal";
    unit.sinnerDeath = unit.deathType === "sinner";
    unit.deleted = false;
    resetDeathSaves(unit);

    if (unit.dead_sprite) unit.current_sprite = unit.dead_sprite;
    const deathEventContext = { ...options, wasDowned, deathType: unit.deathType };
    if (options.deferOnDeath === true) unit.__luminousPendingDeathEvent = deathEventContext;
    else dispatchLifeEvent("on_death", unit, deathEventContext);
    emit("luminous:unit-dead", { unit, wasDowned, deathType: unit.deathType, reason: options.reason || "death" });
    return { died: true, unit, deathType: unit.deathType, permanentRecordDeletion: false };
  }

  function addFailure(unit, options = {}) {
    if (!isDowned(unit) || isDead(unit)) return { changed: false, unit, reason: "not_downed" };
    const saves = ensureDeathState(unit);
    saves.failures = Math.min(MAX_DEATH_SAVES, saves.failures + 1);
    const result = { changed: true, unit, failures: saves.failures, successes: saves.successes, reason: options.reason || "failure" };
    emit("luminous:death-save-failure", result);
    if (saves.failures >= MAX_DEATH_SAVES) result.death = resolveDeath(unit, { reason: options.reason || "three_failed_death_saves", context: options.context || null });
    return result;
  }

  function grantRetreat(unit, options = {}) {
    if (!unit) return null;
    unit.retreat = { pending: true, grantedAt: Date.now(), reason: options.reason || "death_save_success" };
    try {
      global.LuminousStatusEngine?.applyStatus?.(unit, "retreat", {
        mode: "set",
        count: 1,
        duration: "until_removed",
        data: { pending: true, systemStatus: true },
      });
    } catch (_) {}
    emit("luminous:retreat-granted", { unit, retreat: clone(unit.retreat) });
    return unit.retreat;
  }

  function resolveThreeSuccesses(unit) {
    if (!unit) return { resolved: false };
    const maxHp = Math.max(1, numberOr(unit.maxHp, 1));
    const recoveredHp = Math.max(1, Math.ceil(maxHp * 0.05));
    resetDeathSaves(unit);
    markAlive(unit);
    unit.hp = Math.min(maxHp, recoveredHp);
    grantRetreat(unit);
    emit("luminous:death-save-stabilized", { unit, hp: unit.hp, maxHp });
    return { resolved: true, unit, hp: unit.hp, retreat: true };
  }

  function addSuccess(unit, options = {}) {
    if (!isDowned(unit) || isDead(unit)) return { changed: false, unit, reason: "not_downed" };
    const saves = ensureDeathState(unit);
    saves.successes = Math.min(MAX_DEATH_SAVES, saves.successes + 1);
    const result = { changed: true, unit, successes: saves.successes, failures: saves.failures };
    emit("luminous:death-save-success", result);
    if (saves.successes >= MAX_DEATH_SAVES) result.stabilized = resolveThreeSuccesses(unit, options);
    return result;
  }

  function rollDeathSave(options = {}) {
    const coin = global.LuminousCoinEngine;
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const tosses = [];
    for (let index = 0; index < DEATH_SAVE_CHECK.coinAmount; index += 1) {
      const side = coin?.rollSide ? coin.rollSide(DEATH_SAVE_CHECK.headsChance, rng) : ((rng() * 100) < DEATH_SAVE_CHECK.headsChance ? "head" : "tail");
      tosses.push(side);
    }
    const heads = tosses.filter((side) => side === "head").length;
    const total = DEATH_SAVE_CHECK.basePower + heads * DEATH_SAVE_CHECK.coinPower;
    return { ...DEATH_SAVE_CHECK, tosses, heads, total, passed: total >= DEATH_SAVE_CHECK.threshold };
  }

  function resolveDeathSave(unit, options = {}) {
    if (!isDowned(unit) || isDead(unit)) return { resolved: false, reason: "not_downed", unit };
    const check = options.checkResult || rollDeathSave(options);
    const outcome = check.passed ? addSuccess(unit, { reason: "death_save", check }) : addFailure(unit, { reason: "death_save", check });
    const result = { resolved: true, unit, check, outcome };
    emit("luminous:death-save-resolved", result);
    return result;
  }

  function heal(unit, amount, options = {}) {
    if (!unit) return { applied: 0, reason: "missing_unit" };
    const requested = Math.max(0, numberOr(amount, 0));
    const source = normalizeId(options.source || options.healSource || "external");
    const revival = options.revive === true || options.resurrection === true || ["revival", "resurrection"].includes(source);

    if (isDead(unit)) {
      if (!revival) return { applied: 0, reason: "dead_requires_revival", unit };
      const maxHp = Math.max(1, numberOr(unit.maxHp, 1));
      const restored = Math.min(maxHp, Math.max(1, requested || 1));
      markAlive(unit);
      resetDeathSaves(unit);
      unit.hp = restored;
      emit("luminous:unit-revived", { unit, hp: restored, source });
      return { applied: restored, revived: true, unit };
    }

    if (isDowned(unit)) {
      if (["self", "passive", "regen", "trait", "self_passive", "self_regen"].includes(source)) {
        emit("luminous:downed-self-heal-negated", { unit, requested, source });
        return { applied: 0, negated: true, reason: "downed_self_heal", unit };
      }
      if (requested <= 0) return { applied: 0, reason: "no_healing", unit };
      const maxHp = Math.max(1, numberOr(unit.maxHp, 1));
      const restored = Math.min(maxHp, requested);
      markAlive(unit);
      resetDeathSaves(unit);
      unit.hp = restored;
      emit("luminous:downed-stabilized-by-heal", { unit, hp: restored, source });
      return { applied: restored, stabilized: true, unit };
    }

    const maxHp = Math.max(1, numberOr(unit.maxHp, numberOr(unit.hp, 1)));
    const before = Math.max(0, numberOr(unit.hp, 0));
    const after = Math.min(maxHp, before + requested);
    unit.hp = after;
    return { applied: after - before, unit };
  }

  function queueRetreat(unit) {
    if (!unit) return;
    const key = unitIds(unit)[0] || unit;
    if (!state.retreatQueue.some((entry) => entry.key === key)) state.retreatQueue.push({ key, unit, at: Date.now() });
  }

  function resolveRetreat(unit, options = {}) {
    if (!unit || !unit.retreat?.pending || isDead(unit)) return { retreated: false, unit };
    const forcedStagger = unit.isForcedStagger === true || unit.forcedStagger === true || unit.staggerForced === true;
    if (!forcedStagger) {
      unit.isStaggered = false;
      unit.staggerTurns = 0;
    }
    const snapshot = {
      hp: Math.max(0, numberOr(unit.hp, 0)),
      sp: numberOr(unit.sp, 0),
      releasedSlots: Math.max(0, numberOr(unit.activeSlots ?? unit.actionSlots, 0)),
      retreatedAt: Date.now(),
    };
    unit.retreatSnapshot = snapshot;
    unit.retreat.pending = false;
    unit.lifeState = "retreated";
    unit.isRetreated = true;
    unit.isDowned = false;
    unit.actionQueue = [];
    unit.activeSlots = 0;
    queueRetreat(unit);
    emit("luminous:unit-retreated", { unit, snapshot, chainBattle: options.chainBattle === true });
    return { retreated: true, unit, snapshot };
  }

  function statusPersistsThroughRetreat(statusId, instance) {
    if (instance?.data?.persistsThroughRetreat === true || instance?.persistsThroughRetreat === true) return true;
    try { return global.LuminousStatusEngine?.getDefinition?.(statusId)?.persistsThroughRetreat === true; }
    catch (_) { return false; }
  }

  function clearRetreatEffects(unit) {
    if (!unit?.statusEffects || typeof unit.statusEffects !== "object") return [];
    const kept = [];
    Object.keys({ ...unit.statusEffects }).forEach((statusId) => {
      const instance = unit.statusEffects[statusId];
      if (normalizeId(statusId) === "retreat") {
        delete unit.statusEffects[statusId];
        return;
      }
      if (statusPersistsThroughRetreat(statusId, instance)) kept.push(statusId);
      else delete unit.statusEffects[statusId];
    });
    return kept;
  }

  function returnFromRetreat(unit, options = {}) {
    if (!unit || !isRetreated(unit)) return { returned: false, unit };
    const snapshot = unit.retreatSnapshot || { hp: numberOr(unit.hp, 0), sp: numberOr(unit.sp, 0) };
    const key = unitIds(unit)[0] || unit;
    const firstQueued = state.retreatQueue[0] || null;
    if (firstQueued && firstQueued.key !== key && options.force !== true) return { returned: false, reason: "retreat_order", unit, nextUnit: firstQueued.unit };
    markAlive(unit);
    unit.hp = Math.max(1, numberOr(snapshot.hp, 1));
    unit.sp = numberOr(snapshot.sp, 0) < 0 ? 0 : numberOr(snapshot.sp, 0);
    const keptStatuses = clearRetreatEffects(unit);
    state.retreatQueue = state.retreatQueue.filter((entry) => entry.key !== key);
    emit("luminous:unit-returned-from-retreat", { unit, keptStatuses, options });
    return { returned: true, unit, keptStatuses };
  }

  function noteSkillHitOnDowned(unit, skill, context = {}) {
    if (!isDowned(unit) || isDead(unit)) return { changed: false, reason: "not_downed", unit };
    if (!skill || (skill.type && normalizeId(skill.type) === "status")) return { changed: false, reason: "not_skill", unit };
    let token = context.__luminousDeathSaveSkillToken || null;
    if (!token && state.skillTokens && typeof skill === "object") {
      token = state.skillTokens.get(skill);
      if (!token) {
        token = `skill_${state.nextSkillToken++}`;
        state.skillTokens.set(skill, token);
      }
    }
    token = token || `skill_${state.nextSkillToken++}`;
    if (unit.__luminousLastDownedFailureSkillToken === token) return { changed: false, deduped: true, unit };
    unit.__luminousLastDownedFailureSkillToken = token;
    return addFailure(unit, { reason: "skill_hit_while_downed", context });
  }

  function clearSkillHitToken(unit) {
    if (unit) delete unit.__luminousLastDownedFailureSkillToken;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine) return false;
    if (engine.__deathSaveRuntimeIntegrated) {
      state.combatSource = engine;
      return true;
    }

    const originalInitialize = typeof engine.initializeUnitData === "function" ? engine.initializeUnitData : null;
    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    const originalProcessStatusEffects = typeof engine.processStatusEffects === "function" ? engine.processStatusEffects : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalResolveUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const originalCalculateAoE = typeof engine.calculateAoETargets === "function" ? engine.calculateAoETargets : null;

    engine.isUnitTargetable = function (unit) { return isTargetable(unit); };
    engine.canUnitAct = function (unit) { return canAct(unit); };
    engine.applyHealing = function (unit, amount, options = {}) { return heal(unit, amount, options); };
    engine.reviveUnit = function (unit, amount = 1, options = {}) { return heal(unit, amount, { ...options, revive: true, source: options.source || "revival" }); };
    engine.resolveDeathSave = function (unit, options = {}) { return resolveDeathSave(unit, options); };
    engine.returnFromRetreat = function (unit, options = {}) { return returnFromRetreat(unit, options); };

    if (originalInitialize) {
      engine.initializeUnitData = function (unit, ...rest) {
        const result = originalInitialize.call(this, unit, ...rest);
        ensureDeathState(unit);
        return result;
      };
    }

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, damageType = "directo", isCritical = false, skillUsed = null, ...rest) {
        if (!unit) return originalApplyDamage.call(this, unit, damage, damageType, isCritical, skillUsed, ...rest);
        ensureDeathState(unit);
        const beforeHp = numberOr(unit.hp, 0);
        const wasDowned = isDowned(unit);
        const statusDamage = ["efecto_estado", "status", "status_effect", "dot"].includes(normalizeId(damageType));

        if (wasDowned) {
          if (statusDamage) return { hp: 0, shield: unit.shield, deathSave: addFailure(unit, { reason: "status_damage_while_downed" }) };
          if (skillUsed) {
            unit.__luminousDownedHitPending = true;
            return { hp: unit.hp, shield: unit.shield, downedHitDeferred: true };
          }
          return { hp: 0, shield: unit.shield };
        }

        const result = originalApplyDamage.call(this, unit, damage, damageType, isCritical, skillUsed, ...rest);
        const reachedZero = beforeHp > 0 && numberOr(unit.hp, 0) <= 0;
        if (!reachedZero) return result;

        if (usesDeathSaves(unit)) {
          const transition = enterDowned(unit, { sourceKind: statusDamage ? "status" : (skillUsed?.type === "Spell" ? "spell" : (skillUsed ? "skill" : normalizeId(damageType))), skill: skillUsed });
          return { ...(result || {}), hp: unit.hp, downed: true, transition };
        }
        const death = resolveDeath(unit, {
          reason: "hp_zero",
          sourceKind: statusDamage ? "status" : (skillUsed ? "skill" : normalizeId(damageType)),
          skill: skillUsed,
          deferOnDeath: Boolean(skillUsed && !statusDamage),
        });
        return { ...(result || {}), hp: 0, death };
      };
    }

    if (originalProcessStatusEffects) {
      engine.processStatusEffects = function (unit, triggerKey, context = {}, ...rest) {
        const downedBefore = isDowned(unit);
        const hpBefore = numberOr(unit?.hp, 0);
        const result = originalProcessStatusEffects.call(this, unit, triggerKey, context, ...rest);
        if (downedBefore && !isDead(unit) && numberOr(unit?.hp, 0) > hpBefore) {
          const healed = numberOr(unit?.hp, 0) - hpBefore;
          unit.hp = 0;
          emit("luminous:downed-self-heal-negated", { unit, requested: healed, source: "status_or_passive" });
        }
        return result;
      };
    }

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context = {}, targetsHit = [], ...rest) {
        const targets = Array.isArray(targetsHit) && targetsHit.length ? targetsHit : [context?.defender || context?.currentTarget].filter(Boolean);
        if (tag === "[On Kill]" && targets.some((target) => target?.__luminousDownedAttackProxy)) return;
        const result = originalTriggerEvent.call(this, tag, context, targetsHit, ...rest);
        if (tag === "[On Hit]" && context?.skill) {
          targets.forEach((target) => {
            if (target?.__luminousDownedHitPending || target?.__luminousDownedAttackProxy) {
              noteSkillHitOnDowned(target, context.skill, context);
              delete target.__luminousDownedHitPending;
            }
          });
        }
        if (tag === "[Attack End]") {
          targets.forEach((target) => {
            clearSkillHitToken(target);
            delete target.__luminousDownedHitPending;
            if (target?.__luminousPendingDeathEvent) {
              const pending = target.__luminousPendingDeathEvent;
              delete target.__luminousPendingDeathEvent;
              dispatchLifeEvent("on_death", target, pending);
            }
          });
        }
        return result;
      };
    }

    if (originalResolveUnilateral) {
      engine.resolveUnilateralWithCounter = function (attacker, skill, defender, counterSkill, options = {}, ...rest) {
        if (!defender || !isDowned(defender)) return originalResolveUnilateral.call(this, attacker, skill, defender, counterSkill, options, ...rest);
        const originalHp = defender.hp;
        defender.__luminousDownedAttackProxy = true;
        defender.hp = 1;
        try {
          const result = originalResolveUnilateral.call(this, attacker, skill, defender, counterSkill, options, ...rest);
          defender.hp = 0;
          return result;
        } finally {
          defender.hp = isDead(defender) ? 0 : originalHp;
          delete defender.__luminousDownedAttackProxy;
          clearSkillHitToken(defender);
        }
      };
    }

    if (originalCalculateAoE) {
      engine.calculateAoETargets = function (skill, primaryTarget, allPossibleTargets, attacker, ...rest) {
        const source = Array.isArray(allPossibleTargets) ? allPossibleTargets : [];
        const eligible = source.filter((unit) => isTargetable(unit));
        const targets = originalCalculateAoE.call(this, skill, primaryTarget, eligible, attacker, ...rest) || [];
        let remainingWeight = Math.max(0, numberOr(skill?.atkWeight ?? skill?.weight, 1) - targets.reduce((sum, unit) => sum + Math.max(1, numberOr(unit?.slotWeight, 1)), 0));
        if (remainingWeight <= 0) return targets;
        const primaryPos = primaryTarget?.grid_pos || null;
        const downedCandidates = eligible
          .filter((unit) => unit !== primaryTarget && isDowned(unit) && !targets.includes(unit))
          .sort((a, b) => {
            if (!primaryPos || !a?.grid_pos || !b?.grid_pos) return 0;
            const da = Math.hypot(a.grid_pos.x - primaryPos.x, a.grid_pos.y - primaryPos.y);
            const db = Math.hypot(b.grid_pos.x - primaryPos.x, b.grid_pos.y - primaryPos.y);
            return da - db;
          });
        downedCandidates.forEach((candidate) => {
          const weight = Math.max(1, numberOr(candidate?.slotWeight, 1));
          if (weight <= remainingWeight) {
            targets.push(candidate);
            remainingWeight -= weight;
          }
        });
        return targets;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const units = Array.isArray(allUnits) ? allUnits : [];
        if (phaseTag === "[Round Start]") {
          units.forEach((unit) => {
            ensureDeathState(unit);
            if (isDowned(unit)) unit.actionQueue = [];
          });
        }
        if (phaseTag === "[Round End]") {
          units.forEach((unit) => {
            if (isDowned(unit) && !isDead(unit)) resolveDeathSave(unit);
          });
        }
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (phaseTag === "[Round End]") {
          units.forEach((unit) => {
            if (unit?.retreat?.pending && !isDead(unit)) resolveRetreat(unit, { units });
          });
        }
        return result;
      };
    }

    Object.defineProperty(engine, "__deathSaveRuntimeIntegrated", { value: true, configurable: true });
    state.combatSource = engine;
    return true;
  }

  function install() { return patchCombatEngine(); }

  const api = Object.freeze({
    MAX_DEATH_SAVES,
    DEATH_SAVE_CHECK,
    SINNER_TRAIT: Object.freeze({
      schemaVersion: 1,
      id: "sinner",
      name: "Sinner",
      source: { type: "special", id: "sinner" },
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      description: "On actual death, use Sinner Death instead of normal permanent-death consequences. Player Sinners still use Downed and Death Saves to determine whether they remain available in the Encounter.",
      effects: [],
      rules: [],
    }),
    normalizeId,
    traitIds,
    isPlayerCharacter,
    isCaptain,
    isSinner,
    usesDeathSaves,
    ensureDeathState,
    resetDeathSaves,
    isDowned,
    isDead,
    isRetreated,
    isTargetable,
    canAct,
    enterDowned,
    resolveDeath,
    addFailure,
    addSuccess,
    rollDeathSave,
    resolveDeathSave,
    heal,
    grantRetreat,
    resolveRetreat,
    returnFromRetreat,
    noteSkillHitOnDowned,
    clearRetreatEffects,
    patchCombatEngine,
    install,
    getRetreatQueue: () => state.retreatQueue.slice(),
  });

  global.LuminousDeathSaveRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  install();
  global.setInterval?.(install, PATCH_INTERVAL_MS);
})(typeof window !== "undefined" ? window : globalThis);
