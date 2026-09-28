(function (global) {
  "use strict";

  if (global.LuminousBilgewaterDemolisherCombatRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBilgewaterDemolisherCombatRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const BRIDGE_KEY = "__luminousBilgewaterMarksmanCombatBridgeState";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function runtime() {
    return global.LuminousBilgewaterDemolisherArchetypeRuntime || safeRequire("./bilgewater-marksman-archetype-runtime.js");
  }

  function bridgeState() {
    if (!global[BRIDGE_KEY]) global[BRIDGE_KEY] = { actionSession: null, resolverSource: null, adapterSource: null, loadoutSource: null };
    return global[BRIDGE_KEY];
  }

  function entityId(entity = {}) {
    return runtime()?.entityId?.(entity) || String(entity.combatId ?? entity.unitId ?? entity.id ?? entity.playerId ?? entity.actorId ?? entity.name ?? "").trim();
  }

  function unitsFromContext(context = {}) {
    if (Array.isArray(context.units)) return context.units;
    if (context.combatData && typeof context.combatData === "object") return Object.values(context.combatData);
    if (Array.isArray(context.targetCandidates)) return context.targetCandidates;
    return [];
  }

  function unitById(context = {}, id) {
    const wanted = String(id ?? "").trim();
    if (!wanted) return null;
    if (typeof context.getUnitById === "function") {
      const found = context.getUnitById(wanted);
      if (found) return found;
    }
    return unitsFromContext(context).find((unit) => entityId(unit) === wanted) || null;
  }

  function combinedDurability(unit = {}) {
    return Math.max(0, numberOr(unit.hp, 0)) + Math.max(0, numberOr(unit.shield, 0));
  }

  function actionSourceId(action = {}) {
    return normalizeId(action?.source?.id || action?.sourceId || action?.id || "");
  }

  function currentSessionTargetInfo(skill = {}, options = {}) {
    const state = bridgeState();
    const session = state.actionSession;
    const explicitIndex = Number.isFinite(Number(options.bilgewaterTargetIndex)) ? Math.max(0, Math.trunc(Number(options.bilgewaterTargetIndex))) : null;
    const index = explicitIndex != null ? explicitIndex : session ? Math.max(0, session.nextTargetIndex++) : 0;
    const attackWeight = Math.max(1, numberOr(options.attackWeight ?? session?.attackWeight ?? skill.attackWeight ?? skill.atkWeight, 1));
    return {
      targetIndex: index,
      isSecondaryTarget: options.isSecondaryTarget === true || index > 0,
      attackWeight,
      session,
    };
  }

  function decorateSkill(actor = {}, skill = {}) {
    const api = runtime();
    if (!api) return skill;
    if (normalizeId(skill?.id || skill?.skillId || skill?.name) === api.SMOKE_SCREEN_SKILL_ID && api.smokeScreenUnlocked(actor)) {
      return api.smokeScreenSkill(actor);
    }
    return api.decorateShotgunSkill(actor, skill);
  }

  function patchSkillLoadout() {
    const source = global.LuminousCombatSkillLoadout074;
    const state = bridgeState();
    const api = runtime();
    if (!source?.skillIdsFor || !api) return false;
    if (source.__bilgewaterDemolisherSkillLoadoutWrapped) {
      state.loadoutSource = source;
      return true;
    }
    if (state.loadoutSource === source) return true;

    const originalSkillIdsFor = source.skillIdsFor.bind(source);
    const originalOwnsSkill = typeof source.ownsSkill === "function" ? source.ownsSkill.bind(source) : null;
    const originalResolve = typeof source.resolveSkillForCombatant === "function" ? source.resolveSkillForCombatant.bind(source) : null;
    const originalLibrary = typeof source.skillLibrary === "function" ? source.skillLibrary.bind(source) : null;

    const wrapped = Object.freeze({
      ...source,
      __bilgewaterDemolisherSkillLoadoutWrapped: true,
      skillIdsFor(unit = {}) {
        const base = originalSkillIdsFor(unit) || [];
        if (!api.smokeScreenUnlocked(unit) || base.includes(api.SMOKE_SCREEN_SKILL_ID)) return base;
        return [...base, api.SMOKE_SCREEN_SKILL_ID];
      },
      ownsSkill(unit = {}, skillId) {
        if (normalizeId(skillId) === api.SMOKE_SCREEN_SKILL_ID && api.smokeScreenUnlocked(unit)) return true;
        return originalOwnsSkill ? originalOwnsSkill(unit, skillId) : false;
      },
      resolveSkillForCombatant(unit = {}, skillId, skills) {
        if (normalizeId(skillId) === api.SMOKE_SCREEN_SKILL_ID && api.smokeScreenUnlocked(unit)) {
          return { ok: true, reason: null, skillId: api.SMOKE_SCREEN_SKILL_ID, skill: api.smokeScreenSkill(unit) };
        }
        return originalResolve ? originalResolve(unit, skillId, skills) : { ok: false, reason: "SKILL_LOADOUT_RUNTIME_REQUIRED", skillId, skill: null };
      },
      skillLibrary() {
        const library = originalLibrary ? originalLibrary() || {} : {};
        return { ...library, [api.SMOKE_SCREEN_SKILL_ID]: api.SMOKE_SCREEN_SKILL };
      },
    });

    global.LuminousCombatSkillLoadout074 = wrapped;
    state.loadoutSource = wrapped;
    return true;
  }

  function patchActionAdapters() {
    const source = global.LuminousCombatActionAdapters;
    const state = bridgeState();
    if (!source?.compileSkillToCombatAction) return false;
    if (source.__bilgewaterDemolisherCombatAdapterWrapped) {
      state.adapterSource = source;
      return true;
    }
    if (state.adapterSource === source) return true;

    const originalCompile = source.compileSkillToCombatAction.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __bilgewaterDemolisherCombatAdapterWrapped: true,
      compileSkillToCombatAction(actor, rawSkill = {}, options = {}) {
        return originalCompile(actor, decorateSkill(actor, rawSkill), options);
      },
    });
    global.LuminousCombatActionAdapters = wrapped;
    state.adapterSource = wrapped;
    return true;
  }

  function patchResolver() {
    const source = global.LuminousCombatActionResolver;
    const state = bridgeState();
    if (!source?.resolveCombatAction) return false;
    if (source.__bilgewaterDemolisherCombatResolverWrapped) {
      state.resolverSource = source;
      return true;
    }
    if (state.resolverSource === source) return true;

    const originalResolve = source.resolveCombatAction.bind(source);
    const originalPrepared = source.resolvePreparedUnopposed?.bind(source);

    const wrapped = Object.freeze({
      ...source,
      __bilgewaterDemolisherCombatResolverWrapped: true,
      resolveCombatAction(input = {}, context = {}) {
        const api = runtime();
        if (!api) return originalResolve(input, context);

        let action = input;
        const actor = unitById(context, input?.actorId);
        const sourceId = actionSourceId(input);

        if (actor && sourceId === api.SMOKE_SCREEN_SKILL_ID && api.smokeScreenUnlocked(actor)) {
          action = {
            ...input,
            resolution: {
              ...(input.resolution || {}),
              type: "save",
              save: {
                ...(input.resolution?.save || {}),
                abilityId: "dex",
                dc: api.rangerSpellSaveDC(actor),
                onSuccess: "negates",
              },
            },
            targeting: {
              ...(input.targeting || {}),
              mode: "aoe",
              allegiance: "enemy",
              attackWeight: 3,
            },
          };
        }

        const previous = state.actionSession;
        state.actionSession = {
          actionId: action?.id || null,
          sourceId,
          actor,
          attackWeight: Math.max(1, numberOr(action?.targeting?.attackWeight, 1)),
          nextTargetIndex: 0,
          trueGritQueued: false,
          collateralTargetIndexes: new Set(),
        };

        let result;
        try { result = originalResolve(action, context); }
        finally { state.actionSession = previous; }

        if (actor && sourceId === api.SMOKE_SCREEN_SKILL_ID && result?.resolved && result?.resolution?.type === "save") {
          for (const row of result.resolution.results || []) {
            if (row?.result?.isSuccess !== false) continue;
            const target = unitById(context, row.targetId);
            if (target) api.applySmokeScreenFailedSave(actor, target);
          }
        }
        return result;
      },
      resolvePreparedUnopposed(action, actor, targets, context = {}, options = {}) {
        if (!originalPrepared) return { resolved: false, reason: "resolver_unavailable" };
        const previous = state.actionSession;
        state.actionSession = {
          actionId: action?.id || null,
          sourceId: actionSourceId(action),
          actor,
          attackWeight: Math.max(1, numberOr(action?.targeting?.attackWeight, 1)),
          nextTargetIndex: 0,
          trueGritQueued: false,
          collateralTargetIndexes: new Set(),
        };
        try { return originalPrepared(action, actor, targets, context, options); }
        finally { state.actionSession = previous; }
      },
    });

    global.LuminousCombatActionResolver = wrapped;
    state.resolverSource = wrapped;
    return true;
  }

  function installEngine(engine = global.CombatEngine) {
    const api = runtime();
    if (!engine || !api) return false;
    if (engine.__bilgewaterDemolisherCombatWrapped) return true;

    const originalPassive = engine.applyPassiveModifiers?.bind(engine);
    const originalCoinDamage = engine.calculateCoinDamage?.bind(engine);
    const originalUnilateral = engine.resolveUnilateralWithCounter?.bind(engine);
    const originalTriggerPhase = engine.triggerPhase?.bind(engine);

    if (originalPassive) engine.applyPassiveModifiers = function (unit, contextOptions = null) {
      const modifiers = originalPassive(unit, contextOptions) || {};
      const skill = contextOptions?.skill || null;
      if (api.hasLevel(unit, 15) && api.isShotgunRangedSkill(skill)) {
        modifiers.damage_dealt_multiplier = numberOr(modifiers.damage_dealt_multiplier, 0) + 2;
        modifiers.crit_damage_multiplier = numberOr(modifiers.crit_damage_multiplier, 0) + 1;
      }
      return modifiers;
    };

    if (originalCoinDamage) engine.calculateCoinDamage = function (attacker, defender, skill, coinPower, isCritical, clashCount, context) {
      let damage = originalCoinDamage(attacker, defender, skill, coinPower, isCritical, clashCount, context);
      const info = skill?.__luminousBilgewaterResolutionContext || {};
      if (api.hasLevel(attacker, 15) && api.isShotgunRangedSkill(skill)) {
        if (info.isSecondaryTarget === true) damage *= 0.60;
        damage *= api.smokeScreenDamageMultiplier(attacker, defender);
      }
      return Math.max(0, Math.floor(damage));
    };

    if (originalUnilateral) engine.resolveUnilateralWithCounter = function (attacker, skill, defender, counterSkill, options = {}) {
      const decorated = decorateSkill(attacker, skill);
      const targetInfo = currentSessionTargetInfo(decorated, options);
      const previousContext = decorated.__luminousBilgewaterResolutionContext;
      decorated.__luminousBilgewaterResolutionContext = {
        targetIndex: targetInfo.targetIndex,
        isSecondaryTarget: targetInfo.isSecondaryTarget,
        attackWeight: targetInfo.attackWeight,
      };

      const durabilityBefore = combinedDurability(defender);
      let result;
      try {
        result = originalUnilateral(attacker, decorated, defender, counterSkill, options);
      } finally {
        if (previousContext === undefined) delete decorated.__luminousBilgewaterResolutionContext;
        else decorated.__luminousBilgewaterResolutionContext = previousContext;
      }

      if (!api.isShotgunRangedSkill(decorated) || !api.hasLevel(attacker, 15)) return result;

      const hit = Array.isArray(result?.attackLogs) && result.attackLogs.some((entry) => Number.isFinite(Number(entry?.attackPower)));
      if (!hit) return result;

      const damageDealtBySkill = Math.max(0, durabilityBefore - combinedDurability(defender));
      const session = targetInfo.session;
      if (api.hasLevel(attacker, 50) && (!session || session.trueGritQueued !== true)) {
        api.queueTrueGrit(attacker);
        if (session) session.trueGritQueued = true;
      }

      if (api.hasLevel(attacker, 75)) {
        const alreadyApplied = session?.collateralTargetIndexes?.has(targetInfo.targetIndex);
        if (!alreadyApplied) {
          api.applyCollateralDamage(attacker, defender, {
            engine,
            skill: decorated,
            isSecondaryTarget: targetInfo.isSecondaryTarget,
          });
          session?.collateralTargetIndexes?.add(targetInfo.targetIndex);
        }
      }

      if (api.hasLevel(attacker, 90) && !targetInfo.isSecondaryTarget && damageDealtBySkill > 0) {
        const endDamage = api.endOfLineDamage(attacker, damageDealtBySkill);
        if (endDamage > 0 && api.consumeEndOfLine(attacker)) {
          const endSkill = {
            id: "end_of_the_line",
            name: "End of the Line",
            type: "Trait",
            sourceType: "trait",
            sourceId: "end_of_the_line",
            isClashable: false,
            isUnclashable: true,
          };
          engine.applyDamage?.(defender, endDamage, "directo", false, endSkill);
          engine.triggerEvent?.("[On Hit]", {
            engine,
            attacker,
            defender,
            skill: endSkill,
            targetsHit: [defender],
            currentTarget: defender,
            damageDealt: endDamage,
            endOfTheLine: true,
          }, [defender]);
          result = { ...result, endOfTheLine: { damage: endDamage, targetId: entityId(defender) } };
        }
      }

      return result;
    };

    if (originalTriggerPhase) engine.triggerPhase = function (phaseTag, allUnits) {
      const result = originalTriggerPhase(phaseTag, allUnits);
      if (normalizeId(phaseTag) === "round_start") {
        for (const unit of Array.isArray(allUnits) ? allUnits : []) api.onTurnStart(unit);
      }
      return result;
    };

    try { Object.defineProperty(engine, "__bilgewaterDemolisherCombatWrapped", { value: true, configurable: true, enumerable: false }); }
    catch (_) { engine.__bilgewaterDemolisherCombatWrapped = true; }
    return true;
  }

  function install() {
    const loadoutReady = patchSkillLoadout();
    const adapterReady = patchActionAdapters();
    const resolverReady = patchResolver();
    const engineReady = installEngine(global.CombatEngine);
    return loadoutReady || adapterReady || resolverReady || engineReady;
  }

  const api = Object.freeze({
    install,
    installEngine,
    patchSkillLoadout,
    patchActionAdapters,
    patchResolver,
    currentSessionTargetInfo,
    decorateSkill,
  });

  global.LuminousBilgewaterDemolisherCombatRuntime = api;
  install();
  if (global.setInterval) { const timer = global.setInterval(install, 800); timer?.unref?.(); }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
