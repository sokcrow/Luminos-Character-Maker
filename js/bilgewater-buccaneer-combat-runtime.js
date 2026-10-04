(function (global) {
  "use strict";

  if (global.LuminousBilgewaterBuccaneerCombatRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBilgewaterBuccaneerCombatRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const BRIDGE_KEY = "__luminousBilgewaterBuccaneerCombatBridgeState";
  const normalizeId = (value) => String(value == null ? "" : value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function runtime() {
    return global.LuminousBilgewaterBuccaneerArchetypeRuntime || safeRequire("./bilgewater-buccaneer-archetype-runtime.js");
  }

  function deploymentRuntime() {
    return global.LuminousCombatDeploymentRuntime || safeRequire("./combat-deployment-runtime.js");
  }

  function deploymentBridge() {
    return global.LuminousCombatDeploymentBridge073 || null;
  }

  function bridgeState() {
    if (!global[BRIDGE_KEY]) global[BRIDGE_KEY] = { resolverSource: null, adapterSource: null, loadoutSource: null };
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
    const wanted = String(id == null ? "" : id).trim();
    if (!wanted) return null;
    if (typeof context.getUnitById === "function") {
      const found = context.getUnitById(wanted);
      if (found) return found;
    }
    return unitsFromContext(context).find((unit) => entityId(unit) === wanted) || null;
  }

  function sideOf(unit = {}) {
    const api = deploymentRuntime();
    if (api?.sideOf) return api.sideOf(unit);
    const raw = normalizeId(unit.faction ?? unit.faccion ?? unit.side ?? unit.team);
    return raw.includes("enemy") || raw.includes("enem") ? "enemy" : "ally";
  }

  function sameSide(a = {}, b = {}) {
    return sideOf(a) === sideOf(b);
  }

  function actionSourceId(action = {}) {
    return normalizeId(action?.source?.id || action?.sourceId || action?.id || "");
  }

  function planningPhase(options = {}) {
    return options.isAi === true ? "planning_phase_ai" : "planning_phase_player";
  }

  function patchSkillLoadout() {
    const source = global.LuminousCombatSkillLoadout074;
    const state = bridgeState();
    const api = runtime();
    if (!source?.skillIdsFor || !api) return false;
    if (source.__bilgewaterBuccaneerSkillLoadoutWrapped) {
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
      __bilgewaterBuccaneerSkillLoadoutWrapped: true,
      skillIdsFor(unit = {}) {
        const base = originalSkillIdsFor(unit) || [];
        const granted = api.grantedSkillIds(unit);
        return [...new Set([...base, ...granted])];
      },
      ownsSkill(unit = {}, skillId) {
        if (api.skillDefinition(unit, skillId) && normalizeId(skillId) !== api.BROADSIDE_SKILL_ID) return true;
        return originalOwnsSkill ? originalOwnsSkill(unit, skillId) : false;
      },
      resolveSkillForCombatant(unit = {}, skillId, skills) {
        const granted = api.skillDefinition(unit, skillId);
        if (granted && normalizeId(skillId) !== api.BROADSIDE_SKILL_ID) {
          return { ok: true, reason: null, skillId: normalizeId(skillId), skill: granted };
        }
        return originalResolve ? originalResolve(unit, skillId, skills) : { ok: false, reason: "SKILL_LOADOUT_RUNTIME_REQUIRED", skillId, skill: null };
      },
      skillLibrary() {
        const library = originalLibrary ? originalLibrary() || {} : {};
        return {
          ...library,
          [api.RICOCHET_SKILL_ID]: clone(api.RICOCHET_SKILL),
          [api.POWDER_RAIN_SKILL_ID]: clone(api.POWDER_RAIN_SKILL),
          [api.BROADSIDE_SKILL_ID]: clone(api.BROADSIDE_SKILL),
        };
      },
    });

    global.LuminousCombatSkillLoadout074 = wrapped;
    state.loadoutSource = wrapped;
    return true;
  }

  function patchActionAdapters() {
    const source = global.LuminousCombatActionAdapters;
    const state = bridgeState();
    const api = runtime();
    if (!source?.compileSkillToCombatAction || !api) return false;
    if (source.__bilgewaterBuccaneerCombatAdapterWrapped) {
      state.adapterSource = source;
      return true;
    }
    if (state.adapterSource === source) return true;

    const originalCompile = source.compileSkillToCombatAction.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __bilgewaterBuccaneerCombatAdapterWrapped: true,
      compileSkillToCombatAction(actor, rawSkill = {}, options = {}) {
        const id = normalizeId(rawSkill?.id || rawSkill?.skillId || rawSkill?.name);
        if (id === api.RICOCHET_SKILL_ID && api.hasLevel(actor, 35)) {
          const skill = api.ricochetSkill(actor);
          const actorId = entityId(actor);
          return originalCompile(actor, skill, {
            ...options,
            cost: "quick_action",
            executesAt: planningPhase(options),
            resolution: { type: "automatic" },
            targeting: { allegiance: "self", mode: "self", mainTargetId: actorId, targetIds: [actorId], attackWeight: 1 },
            effects: [{ type: "buccaneer_arm_ricochet" }],
          });
        }
        if (id === api.POWDER_RAIN_SKILL_ID && api.hasLevel(actor, 75)) {
          const skill = api.powderRainSkill(actor);
          return originalCompile(actor, skill, {
            ...options,
            cost: "quick_action",
            executesAt: planningPhase(options),
            targeting: {
              allegiance: "enemy",
              mode: "aoe",
              mainTargetId: options.mainTargetId ?? options.targetId ?? null,
              targetIds: options.targetIds || [],
              attackWeight: 4,
            },
          });
        }
        return originalCompile(actor, rawSkill, options);
      },
    });

    global.LuminousCombatActionAdapters = wrapped;
    state.adapterSource = wrapped;
    return true;
  }

  function powderRainDamage(engine, actor, target, skill) {
    if (!engine || !actor || !target) return 0;
    const damageSkill = {
      ...clone(skill),
      id: "powder_rain_damage",
      sourceId: "powder_rain_damage",
      type: "Attack",
      isClashable: false,
      isUnclashable: true,
      targetingType: "Focused Attack",
      targeting_type: "Focused Attack",
      coinAmount: 1,
      coins: [{ index: 0, type: "normal", status: "active", effects: [] }],
    };
    const probability = typeof engine.getCoinProbability === "function" ? numberOr(engine.getCoinProbability(actor.sp || 0), 50) : 50;
    const heads = [Math.random() * 100 < probability];
    const power = typeof engine.calculateFinalPower === "function"
      ? engine.calculateFinalPower(damageSkill, heads, actor)
      : numberOr(damageSkill.basePower, 3) + (heads[0] ? numberOr(damageSkill.coinPower, 3) : 0);
    const context = { engine, attacker: actor, defender: target, skill: damageSkill, currentCoin: damageSkill.coins[0], targetsHit: [target] };
    if (typeof engine.calculateCoinDamage === "function") return Math.max(0, Math.floor(engine.calculateCoinDamage(actor, target, damageSkill, power, false, 0, context)));
    return Math.max(0, Math.floor(power));
  }

  function applyPowderRainResolution(actor, result, context = {}) {
    const api = runtime();
    const engine = context.engine || global.CombatEngine;
    if (!api || !engine || !result?.resolved || result?.resolution?.type !== "save") return null;
    const skill = api.powderRainSkill(actor);
    const rows = [];
    for (const row of result.resolution.results || []) {
      const target = unitById(context, row.targetId);
      if (!target) continue;
      const full = powderRainDamage(engine, actor, target, skill);
      const success = row?.result?.isSuccess === true;
      const damage = success ? Math.floor(full / 2) : full;
      const damageSkill = {
        id: "powder_rain_damage",
        name: "Powder Rain",
        type: "Attack",
        sourceType: "skill",
        sourceId: api.POWDER_RAIN_SKILL_ID,
        damageType: "perforante",
        isClashable: false,
        isUnclashable: true,
      };
      if (damage > 0) engine.applyDamage?.(target, damage, "directo", false, damageSkill);
      if (!success) api.queuePowderRainFailedSave(target);
      rows.push({ targetId: entityId(target), saveSuccess: success, fullDamage: full, damage, queuedStatuses: success ? null : { bind: 2, fragile: 2 } });
    }
    result.powderRain = rows;
    return rows;
  }

  function patchResolver() {
    const source = global.LuminousCombatActionResolver;
    const state = bridgeState();
    const api = runtime();
    if (!source?.resolveCombatAction || !api) return false;
    if (source.__bilgewaterBuccaneerCombatResolverWrapped) {
      state.resolverSource = source;
      return true;
    }
    if (state.resolverSource === source) return true;

    const originalResolve = source.resolveCombatAction.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __bilgewaterBuccaneerCombatResolverWrapped: true,
      resolveCombatAction(input = {}, context = {}) {
        let action = input;
        const actor = unitById(context, input?.actorId);
        const sourceId = actionSourceId(input);
        if (actor && sourceId === api.RICOCHET_SKILL_ID && api.hasLevel(actor, 35)) {
          const actorId = entityId(actor);
          action = {
            ...input,
            economy: { ...(input.economy || {}), cost: "quick_action" },
            phase: { ...(input.phase || {}), executesAt: input.phase?.selectedAt || planningPhase({ isAi: input.phase?.selectedAt === "planning_phase_ai" }) },
            targeting: { allegiance: "self", mode: "self", mainTargetId: actorId, targetIds: [actorId], attackWeight: 1 },
            resolution: { type: "automatic" },
            effects: [{ type: "buccaneer_arm_ricochet" }],
          };
        } else if (actor && sourceId === api.POWDER_RAIN_SKILL_ID && api.hasLevel(actor, 75)) {
          action = {
            ...input,
            economy: { ...(input.economy || {}), cost: "quick_action" },
            phase: { ...(input.phase || {}), executesAt: input.phase?.selectedAt || planningPhase({ isAi: input.phase?.selectedAt === "planning_phase_ai" }) },
            resolution: {
              type: "save",
              save: { abilityId: "dex", dc: api.rangerSpellSaveDC(actor), onSuccess: "half" },
            },
            targeting: { ...(input.targeting || {}), allegiance: "enemy", mode: "aoe", attackWeight: 4, indiscriminate: false },
          };
        }

        const result = originalResolve(action, {
          ...context,
          effectHandlers: {
            ...(context.effectHandlers || {}),
            buccaneer_arm_ricochet({ actor: effectActor }) {
              return { armed: api.armRicochet(effectActor) };
            },
          },
        });

        if (actor && sourceId === api.POWDER_RAIN_SKILL_ID) applyPowderRainResolution(actor, result, context);
        return result;
      },
    });

    global.LuminousCombatActionResolver = wrapped;
    state.resolverSource = wrapped;
    return true;
  }

  function hostileFieldTargets(attacker = {}, allUnits = [], engine = global.CombatEngine) {
    const deployment = deploymentRuntime();
    let units = Array.isArray(allUnits) && allUnits.length ? allUnits : [];
    if (!units.length && typeof engine?.getAllAliveUnits === "function") units = engine.getAllAliveUnits() || [];
    return units.filter((unit) => {
      if (!unit || unit === attacker || entityId(unit) === entityId(attacker)) return false;
      if (Number.isFinite(Number(unit.hp)) && Number(unit.hp) <= 0) return false;
      if (deployment?.isField && !deployment.isField(unit)) return false;
      return !sameSide(attacker, unit);
    });
  }

  function selectBroadsideTarget(candidates = [], previousId = null, rng = Math.random) {
    if (!candidates.length) return null;
    let pool = candidates;
    if (previousId && candidates.length > 1) {
      const next = candidates.filter((unit) => entityId(unit) !== previousId);
      if (next.length) pool = next;
    }
    const index = Math.min(pool.length - 1, Math.floor(Math.max(0, numberOr(rng(), 0)) * pool.length));
    return pool[index] || null;
  }

  function executeBroadside(actor = {}, targets = [], damageMultiplier = 1, options = {}) {
    const api = runtime();
    const engine = options.engine || global.CombatEngine;
    if (!api || !engine?.resolveUnilateralWithCounter || !api.hasLevel(actor, 90)) return { executed: false, reason: "unavailable", hits: [] };
    if (!api.equippedPistol(actor)) return { executed: false, reason: "pistol_required", hits: [] };
    const candidates = hostileFieldTargets(actor, targets, engine);
    if (!candidates.length) return { executed: false, reason: "no_enemy_targets", hits: [] };

    const base = api.broadsideSkill(actor, damageMultiplier);
    const hits = [];
    let previousTargetId = null;
    for (let index = 0; index < 5; index++) {
      const currentCandidates = candidates.filter((unit) => !Number.isFinite(Number(unit.hp)) || Number(unit.hp) > 0);
      if (!currentCandidates.length) break;
      const target = selectBroadsideTarget(currentCandidates, previousTargetId, options.random || Math.random);
      if (!target) break;
      previousTargetId = entityId(target);
      const skill = {
        ...clone(base),
        coinAmount: 1,
        attackWeight: 1,
        atkWeight: 1,
        targetingType: "Focused Attack",
        targeting_type: "Focused Attack",
        coins: [{ index: 0, type: "normal", status: "active", effects: [] }],
        __buccaneerBroadsideDamageMultiplier: Math.max(0, numberOr(damageMultiplier, 1)),
        __buccaneerBroadsideCoinIndex: index,
      };
      const before = numberOr(target.hp, 0) + numberOr(target.shield, 0);
      const result = engine.resolveUnilateralWithCounter(actor, skill, target, null, {
        skipUseHooks: index > 0,
        clashResult: null,
        clashCount: 0,
        combatants: targets,
      });
      const after = numberOr(target.hp, 0) + numberOr(target.shield, 0);
      hits.push({ coinIndex: index, targetId: entityId(target), damage: Math.max(0, before - after), result });
    }
    return { executed: hits.length > 0, hits, damageMultiplier };
  }

  function patchCombatEngine(engine = global.CombatEngine) {
    const api = runtime();
    if (!engine || !api) return false;
    if (engine.__bilgewaterBuccaneerCombatWrapped) return true;

    const originalCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage.bind(engine) : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent.bind(engine) : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase.bind(engine) : null;

    if (originalCoinDamage) {
      engine.calculateCoinDamage = function (attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
        let damage = originalCoinDamage(attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
        const broadsideMultiplier = Number(skill?.__buccaneerBroadsideDamageMultiplier);
        if (Number.isFinite(broadsideMultiplier)) damage *= Math.max(0, broadsideMultiplier);

        if (api.hasLevel(attacker, 15) && api.isPistolRangedSkill(skill)) {
          const firstHitSeen = skill.__buccaneerTargetShiftFirstHitSeen === true;
          if (!firstHitSeen) {
            skill.__buccaneerTargetShiftFirstHitSeen = true;
            if (!api.hasOwnTargetMark(attacker, defender)) {
              damage *= 1.15;
              if (context && typeof context === "object") context.__buccaneerTargetShiftActivated = true;
            }
          }
        }
        return Math.max(0, Math.floor(damage));
      };
    }

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context = {}, targetsHit = []) {
        const key = String(tag || "");
        const actor = context.attacker || context.unitAttacker || context.actor || null;
        const target = context.defender || context.currentTarget || context.target || targetsHit?.[0] || null;
        const skill = context.skill || null;

        if (key === "[Before Use]" && actor && skill && api.isPistolRangedSkill(skill)) {
          skill.__buccaneerTargetShiftFirstHitSeen = false;
          skill.__buccaneerRicochetTriggered = false;
          if (api.hasLevel(actor, 35) && actor.__buccaneerRicochetArmed === true) {
            skill.__buccaneerRicochetActive = true;
            api.clearRicochet(actor);
          } else {
            skill.__buccaneerRicochetActive = false;
          }
        }

        const result = originalTriggerEvent(tag, context, targetsHit);

        if (key === "[On Hit]" && actor && target && skill && api.hasLevel(actor, 15) && api.isPistolRangedSkill(skill)) {
          api.moveTargetMark(actor, target);
          if (context.__buccaneerTargetShiftActivated === true) {
            api.queueSeaLegsFromTargetShift(actor);
            delete context.__buccaneerTargetShiftActivated;
          }
        }

        if (key === "[On Hit]" && actor && target && skill?.__buccaneerRicochetActive === true && skill.__buccaneerRicochetTriggered !== true) {
          skill.__buccaneerRicochetTriggered = true;
          const candidates = hostileFieldTargets(actor, typeof engine.getAllAliveUnits === "function" ? engine.getAllAliveUnits() : [], engine)
            .filter((unit) => entityId(unit) !== entityId(target));
          if (candidates.length) {
            const bounce = candidates[Math.floor(Math.random() * candidates.length)];
            const multiplier = Number(target.hp) <= 0 ? 1 : 0.5;
            const damage = Math.max(0, Math.floor(numberOr(context.damageDealt, 0) * multiplier));
            if (damage > 0) {
              const ricochetSkill = { id: "ricochet_hit", name: "Ricochet", type: "Attack", sourceType: "skill", sourceId: api.RICOCHET_SKILL_ID, damageType: skill.damageType || "perforante", isClashable: false, isUnclashable: true };
              engine.applyDamage?.(bounce, damage, "directo", false, ricochetSkill);
              context.__buccaneerRicochet = { targetId: entityId(bounce), damage, multiplier };
            }
          }
        }

        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
        const phase = normalizeId(phaseTag);
        const units = Array.isArray(allUnits) ? allUnits : [];
        const backups = deploymentBridge()?.backupUnits?.() || [];

        if (["turn_end", "round_end", "on_turn_end"].includes(phase)) {
          for (const unit of units) {
            if (!api.hasLevel(unit, 90) || unit.__buccaneerBroadsideTurnEndUsed === true) continue;
            if (deploymentRuntime()?.isField && !deploymentRuntime().isField(unit)) continue;
            unit.__buccaneerBroadsideTurnEndUsed = true;
            unit.__buccaneerLastBroadside = executeBroadside(unit, units, 1, { engine });
          }
        }

        const result = originalTriggerPhase(phaseTag, allUnits, ...rest);

        if (["round_start", "turn_start", "on_turn_start"].includes(phase)) {
          for (const unit of [...units, ...backups]) {
            unit.__buccaneerCoveringFireUsed = false;
            unit.__buccaneerBroadsideTurnEndUsed = false;
            api.onTurnStart(unit);
          }
        }

        if (["combat_phase", "combat"].includes(phase)) {
          const fieldTargets = units.length ? units : (typeof engine.getAllAliveUnits === "function" ? engine.getAllAliveUnits() : []);
          for (const unit of backups) {
            if (!api.hasLevel(unit, 90) || unit.__buccaneerCoveringFireUsed === true) continue;
            unit.__buccaneerCoveringFireUsed = true;
            unit.__buccaneerLastCoveringFire = executeBroadside(unit, fieldTargets, 0.25, { engine });
          }
        }

        if (["turn_end", "round_end", "on_turn_end"].includes(phase)) {
          for (const unit of [...units, ...backups]) api.onTurnEnd(unit);
        }

        return result;
      };
    }

    try { Object.defineProperty(engine, "__bilgewaterBuccaneerCombatWrapped", { value: true, configurable: true, enumerable: false }); }
    catch (_) { engine.__bilgewaterBuccaneerCombatWrapped = true; }
    return true;
  }

  function install() {
    const loadoutReady = patchSkillLoadout();
    const adapterReady = patchActionAdapters();
    const resolverReady = patchResolver();
    const engineReady = patchCombatEngine(global.CombatEngine);
    return loadoutReady || adapterReady || resolverReady || engineReady;
  }

  const api = Object.freeze({
    install,
    patchSkillLoadout,
    patchActionAdapters,
    patchResolver,
    patchCombatEngine,
    powderRainDamage,
    applyPowderRainResolution,
    hostileFieldTargets,
    selectBroadsideTarget,
    executeBroadside,
  });

  global.LuminousBilgewaterBuccaneerCombatRuntime = api;
  install();
  if (global.setInterval) { const timer = global.setInterval(install, 800); timer?.unref?.(); }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
