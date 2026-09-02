(function (global) {
  "use strict";

  const schema = global.LuminousCombatAction || (typeof require === "function" ? require("./combat-action-schema.js") : null);
  const bridge = global.LuminousCombatActionEngineBridge || (typeof require === "function" ? require("./combat-action-engine-bridge.js") : null);
  if (!schema) return;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  function entityId(entity = {}) {
    return String(entity.id ?? entity.unitId ?? entity.characterId ?? "").trim();
  }

  function unitById(context = {}, id) {
    const wanted = String(id ?? "");
    if (!wanted) return null;
    const units = Array.isArray(context.units) ? context.units : Object.values(context.combatData || {});
    return units.find((unit) => entityId(unit) === wanted) || null;
  }

  function currentPhase(context = {}) {
    return schema.normalizePhase(context.phase || context.currentPhase || context.state, schema.PHASES.COMBAT_PHASE);
  }

  function sourceDefinition(action = {}) {
    return clone(action.metadata?.sourceDefinition || {});
  }

  function finalPowerBonus(action = {}) {
    return asArray(action.modifiers).reduce((sum, modifier) => {
      if (normalizeId(modifier?.type) !== "final_power") return sum;
      const amount = Number(modifier.amount || 0);
      return Number.isFinite(amount) ? sum + amount : sum;
    }, 0);
  }

  function definitionForEngine(action = {}) {
    const definition = sourceDefinition(action);
    definition.id = definition.id || action.source?.id;
    definition.__combatActionFinalPowerBonus = finalPowerBonus(action);
    if (action.targeting?.mode && ["aoe", "multi", "indiscriminate"].includes(action.targeting.mode)) {
      definition.targeting_type = "Focused Attack";
      definition.targetingType = "Focused Attack";
    }
    return definition;
  }

  function isStaggered(unit = {}) {
    if (unit.isStaggered === true || unit.staggered === true) return true;
    const statuses = unit.statusEffects || unit.statuses || {};
    if (Array.isArray(statuses)) return statuses.some((entry) => normalizeId(entry?.id || entry) === "staggered" || normalizeId(entry?.id || entry) === "stagger");
    return Boolean(statuses.staggered || statuses.stagger);
  }

  function terminal(action = {}) {
    return action.state === "resolved" || action.state === "cancelled";
  }

  function phaseGate(action, context) {
    const phase = currentPhase(context);
    if (action.phase.executesAt !== phase) {
      return { allowed: false, pending: true, reason: "wrong_phase", expected: action.phase.executesAt, actual: phase };
    }
    return { allowed: true, pending: false, phase };
  }

  function sideForActor(actor = {}) {
    const raw = normalizeId(actor.side || actor.team || actor.faction || actor.faccion);
    if (raw.includes("enemy") || raw.includes("enem")) return "enemies";
    return "allies";
  }

  function consumeEconomy(action, actor, context = {}) {
    if (action.economy.cost === schema.ECONOMY_COSTS.ACTION) return { consumed: true, reason: null };

    if (action.economy.cost === schema.ECONOMY_COSTS.QUICK_ACTION) {
      const economy = context.teamEconomy || global.LuminousTeamActionEconomy;
      if (economy?.consumeQuickAction && context.encounter) {
        return economy.consumeQuickAction(context.encounter, sideForActor(actor));
      }
      if (typeof context.consumeQuickAction === "function") return context.consumeQuickAction({ action, actor, context });
      return { consumed: false, reason: "team_quick_action_runtime_required" };
    }

    if (action.economy.cost === schema.ECONOMY_COSTS.REACTION) {
      if (typeof context.consumeReaction === "function") return context.consumeReaction({ action, actor, context });
      const legacy = global.LuminousActionEconomy;
      if (legacy?.consume) {
        const ok = legacy.consume(actor, "reaction", { phase: "combat" });
        return { consumed: Boolean(ok), reason: ok ? null : "reaction_unavailable" };
      }
      return { consumed: false, reason: "reaction_runtime_required" };
    }

    return { consumed: true, reason: null };
  }

  function consumeHelpBudget(actor, context = {}) {
    const economy = context.teamEconomy || global.LuminousTeamActionEconomy;
    if (economy?.consumeHelp && context.encounter) return economy.consumeHelp(context.encounter, sideForActor(actor));
    if (typeof context.consumeHelp === "function") return context.consumeHelp({ actor, context });
    return { consumed: false, reason: "team_help_runtime_required" };
  }

  function resolveResourceHandler(resource, context = {}) {
    const direct = context.resourceHandlers?.[resource.type];
    if (direct) return direct;

    if (resource.type === "spell_slot") {
      const runtime = context.spellRuntime || global.LuminousSpellcastingRuntime;
      if (!runtime) return null;
      const slotLevel = Number(resource.metadata?.slotLevel || 0);
      const classId = resource.id;
      return {
        validate({ actor }) {
          if (typeof runtime.canSpendSpellSlot !== "function") return { available: false, reason: "spell_slot_validator_unavailable" };
          return runtime.canSpendSpellSlot(actor, classId, slotLevel);
        },
        consume({ actor }) {
          if (typeof runtime.spendSpellSlot !== "function") return { spent: 0, reason: "spell_slot_consumer_unavailable" };
          return runtime.spendSpellSlot(actor, classId, slotLevel);
        },
      };
    }
    return null;
  }

  function validateResources(action, actor, context = {}) {
    const checks = [];
    for (const resource of action.resources || []) {
      const handler = resolveResourceHandler(resource, context);
      if (!handler?.validate) return { available: false, reason: "resource_handler_missing", resource, checks };
      const result = handler.validate({ action, actor, resource, context }) || {};
      checks.push({ resource, result });
      if (result.available === false || result.valid === false || result.canUse === false) {
        return { available: false, reason: result.reason || "resource_unavailable", resource, checks };
      }
    }
    return { available: true, checks };
  }

  function consumeResources(action, actor, context = {}) {
    const consumed = [];
    for (const resource of action.resources || []) {
      const handler = resolveResourceHandler(resource, context);
      if (!handler?.consume) return { consumed: false, reason: "resource_consumer_missing", resource, results: consumed };
      const result = handler.consume({ action, actor, resource, context }) || {};
      consumed.push({ resource, result });
      if (result.success === false || result.consumed === false || result.available === false) {
        return { consumed: false, reason: result.reason || "resource_consume_failed", resource, results: consumed };
      }
    }
    return { consumed: true, results: consumed };
  }

  function resolveTargets(action, context = {}) {
    const candidates = asArray(context.targetCandidates || context.units || Object.values(context.combatData || {}));
    const selection = schema.resolveTargetSelection(action, candidates, { random: context.random });
    const targets = selection.targetIds.map((id) => unitById(context, id)).filter(Boolean);
    return { ...selection, targets };
  }

  function cloneAttackSkill(skill = {}) {
    const next = clone(skill);
    if (Array.isArray(next.coins)) next.coins = next.coins.map((coin) => ({ ...coin }));
    next.targeting_type = "Focused Attack";
    next.targetingType = "Focused Attack";
    return next;
  }

  function resolveDirectAttack(action, actor, targets, context = {}, options = {}) {
    const engine = context.engine || global.CombatEngine;
    if (!engine?.resolveUnilateralWithCounter) return { resolved: false, reason: "unilateral_resolver_unavailable", results: [] };
    bridge?.installCombatActionPowerBridge?.(engine);
    const baseSkill = options.skill || definitionForEngine(action);
    const results = [];
    for (let index = 0; index < targets.length; index++) {
      const target = targets[index];
      const skill = cloneAttackSkill(baseSkill);
      const result = engine.resolveUnilateralWithCounter(actor, skill, target, null, {
        skipUseHooks: options.skipUseHooks === true || index > 0,
        clashResult: options.clashResult || null,
        clashCount: options.clashCount || 0,
        mitigationPenalty: options.mitigationPenalty,
        combatants: context.units || Object.values(context.combatData || {}),
      });
      results.push({ targetId: entityId(target), result });
    }
    return { resolved: true, results };
  }

  function resolvePreparedUnopposed(action, actor, targets, context = {}, options = {}) {
    if (terminal(action)) return { resolved: action.state === "resolved", reason: "terminal_state", action };
    if (isStaggered(actor)) {
      const cancelled = schema.cancelCombatAction(action, { type: "stagger" }).action;
      return { resolved: false, cancelled: true, reason: "stagger", action: cancelled };
    }

    const resourceGate = validateResources(action, actor, context);
    if (!resourceGate.available) return { resolved: false, reason: resourceGate.reason, resourceGate, action };

    const economy = consumeEconomy(action, actor, context);
    if (economy.consumed === false) return { resolved: false, reason: economy.reason || "economy_unavailable", economy, resourceGate, action };

    const resources = consumeResources(action, actor, context);
    if (!resources.consumed) return { resolved: false, reason: resources.reason, resources, economy, resourceGate, action };

    action.state = "resolving";
    const attack = resolveDirectAttack(action, actor, targets, context, options);
    action.state = attack.resolved ? "resolved" : "locked";
    return {
      resolved: Boolean(attack.resolved),
      reason: attack.resolved ? null : attack.reason,
      attack,
      resources,
      economy,
      resourceGate,
      action,
      resolvedActionIds: attack.resolved ? [action.id] : [],
    };
  }

  function resolveClashPair(actionInput, opposingInput, context = {}) {
    const engine = context.engine || global.CombatEngine;
    if (!engine?.resolveStandardClash) return { resolved: false, reason: "clash_resolver_unavailable" };
    bridge?.installCombatActionPowerBridge?.(engine);

    const actionA = schema.normalizeCombatAction(actionInput);
    const actionB = schema.normalizeCombatAction(opposingInput);
    const unitA = unitById(context, actionA.actorId);
    const unitB = unitById(context, actionB.actorId);
    if (!unitA || !unitB) return { resolved: false, reason: "clash_actor_missing", actions: [actionA, actionB] };

    if (isStaggered(unitA)) {
      const cancelled = schema.cancelCombatAction(actionA, { type: "stagger" }).action;
      return { resolved: false, cancelled: true, reason: "stagger", actions: [cancelled, actionB], resolvedActionIds: [cancelled.id] };
    }

    const gateB = phaseGate(actionB, context);
    if (!gateB.allowed || terminal(actionB)) {
      const targetResolution = resolveTargets(actionA, context);
      const targets = targetResolution.targets.length ? targetResolution.targets : [unitB];
      const prepared = resolvePreparedUnopposed(actionA, unitA, targets, context, { skill: definitionForEngine(actionA) });
      return {
        ...prepared,
        type: "unopposed",
        reason: prepared.resolved ? (gateB.reason || "opposing_action_unavailable") : prepared.reason,
        actions: [prepared.action || actionA, actionB],
      };
    }

    if (isStaggered(unitB)) {
      const cancelled = schema.cancelCombatAction(actionB, { type: "stagger" }).action;
      const targetResolution = resolveTargets(actionA, context);
      let targets = targetResolution.targets;
      if (!targets.some((target) => entityId(target) === entityId(unitB))) targets.unshift(unitB);
      targets = targets.slice(0, Math.max(1, actionA.targeting.attackWeight));
      const prepared = resolvePreparedUnopposed(actionA, unitA, targets, context, { skill: definitionForEngine(actionA) });
      return {
        ...prepared,
        type: "unopposed",
        reason: prepared.resolved ? "opposing_action_cancelled_by_stagger" : prepared.reason,
        actions: [prepared.action || actionA, cancelled],
        resolvedActionIds: prepared.resolved ? [actionA.id, cancelled.id] : [cancelled.id],
      };
    }

    const resourcesA = validateResources(actionA, unitA, context);
    const resourcesB = validateResources(actionB, unitB, context);
    if (!resourcesA.available || !resourcesB.available) {
      return { resolved: false, reason: !resourcesA.available ? resourcesA.reason : resourcesB.reason, resourcesA, resourcesB, actions: [actionA, actionB] };
    }

    const economyA = consumeEconomy(actionA, unitA, context);
    const economyB = consumeEconomy(actionB, unitB, context);
    if (economyA.consumed === false || economyB.consumed === false) {
      return { resolved: false, reason: economyA.consumed === false ? economyA.reason : economyB.reason, economyA, economyB, actions: [actionA, actionB] };
    }

    const consumedA = consumeResources(actionA, unitA, context);
    const consumedB = consumeResources(actionB, unitB, context);
    if (!consumedA.consumed || !consumedB.consumed) {
      return { resolved: false, reason: !consumedA.consumed ? consumedA.reason : consumedB.reason, consumedA, consumedB, actions: [actionA, actionB] };
    }

    const skillA = definitionForEngine(actionA);
    const skillB = definitionForEngine(actionB);
    const clash = engine.resolveStandardClash(unitA, skillA, unitB, skillB);
    const winner = clash.winner;
    let attack = null;
    let winningAction = null;
    let losingAction = null;

    if (winner === "A" || winner === "B") {
      winningAction = winner === "A" ? actionA : actionB;
      losingAction = winner === "A" ? actionB : actionA;
      const winningUnit = winner === "A" ? unitA : unitB;
      const losingUnit = winner === "A" ? unitB : unitA;
      const winningSkill = winner === "A" ? skillA : skillB;
      const targetResolution = resolveTargets(winningAction, context);
      let targets = targetResolution.targets;
      if (!targets.some((target) => entityId(target) === entityId(losingUnit))) targets.unshift(losingUnit);
      targets = targets.slice(0, Math.max(1, winningAction.targeting.attackWeight));
      const aoe = schema.resolveAoeOutcome(winningAction, true);
      if (aoe.allowed) {
        attack = resolveDirectAttack(winningAction, winningUnit, targets, context, {
          skill: winningSkill,
          skipUseHooks: true,
          clashResult: "Win",
          clashCount: clash.clashLogs?.length || 0,
          mitigationPenalty: clash.mitigationPenalty,
        });
      }
    }

    actionA.state = "resolved";
    actionB.state = "resolved";
    return {
      resolved: true,
      type: "clash",
      winner,
      clash,
      attack,
      winningActionId: winningAction?.id || null,
      losingActionId: losingAction?.id || null,
      resources: { A: consumedA, B: consumedB },
      economy: { A: economyA, B: economyB },
      actions: [actionA, actionB],
      resolvedActionIds: [actionA.id, actionB.id],
    };
  }

  function rollSaveHeads(engine, target, context = {}) {
    if (typeof context.rollSaveHeads === "function") return context.rollSaveHeads(target, context);
    const probability = typeof engine?.getCoinProbability === "function" ? engine.getCoinProbability(target.sp || 0) : 50;
    const random = typeof context.random === "function" ? context.random : Math.random;
    return Array.from({ length: 5 }, () => random() * 100 < probability);
  }

  function resolveSave(action, actor, targets, context = {}) {
    const engine = context.engine || global.CombatEngine;
    if (!engine?.resolveSpell) return { resolved: false, reason: "save_resolver_unavailable", results: [] };
    const spell = definitionForEngine(action);
    spell.statUsed = action.resolution.save?.abilityId;
    spell.saveDC = Number(action.resolution.save?.dc || 0);
    const results = targets.map((target) => ({
      targetId: entityId(target),
      result: engine.resolveSpell(spell, target, rollSaveHeads(engine, target, context)),
    }));
    return { resolved: true, type: "save", results };
  }

  function resolveCheck(action, actor, targets, context = {}) {
    if (typeof context.checkResolver !== "function") return { resolved: false, reason: "check_resolver_required" };
    return { resolved: true, type: "check", result: context.checkResolver({ action, actor, targets, context }) };
  }

  function resolveContest(action, actor, targets, context = {}) {
    if (action.source.type === "universal" && normalizeId(action.source.id) === "grapple" && global.LuminousConditionRuntime?.grapple && targets[0]) {
      return { resolved: true, type: "contest", result: global.LuminousConditionRuntime.grapple(actor, targets[0], { combatAction: action, context }) };
    }
    if (typeof context.contestResolver !== "function") return { resolved: false, reason: "contest_resolver_required" };
    return { resolved: true, type: "contest", result: context.contestResolver({ action, actor, targets, context }) };
  }

  function applyAutomaticEffects(action, actor, targets, context = {}) {
    const results = [];
    for (const effect of action.effects || []) {
      const type = normalizeId(effect.type);
      if (type === "modify_combat_action") {
        const actionMap = context.actionMap || {};
        const targetAction = actionMap[effect.targetActionId] || (typeof context.getActionById === "function" ? context.getActionById(effect.targetActionId) : null);
        if (!targetAction) { results.push({ effect, applied: false, reason: "target_action_missing" }); continue; }
        const applied = schema.applyHelpModifier(targetAction, { amount: effect.modifier?.amount ?? 1, fromActorId: actor && entityId(actor) });
        if (applied.applied && actionMap[effect.targetActionId]) actionMap[effect.targetActionId] = applied.action;
        results.push({ effect, ...applied });
        continue;
      }
      const handler = context.effectHandlers?.[type] || context.effectHandler;
      if (typeof handler === "function") results.push({ effect, result: handler({ action, actor, targets, effect, context }), applied: true });
      else results.push({ effect, applied: false, reason: "effect_handler_missing" });
    }
    return results;
  }

  function resolveAutomatic(action, actor, targets, context = {}) {
    if (action.source.type === "universal" && normalizeId(action.source.id) === "help") {
      const budget = consumeHelpBudget(actor, context);
      if (budget.consumed === false) return { resolved: false, reason: budget.reason || "team_help_spent", budget };
    }
    const effects = applyAutomaticEffects(action, actor, targets, context);
    const structuralFailure = effects.find((entry) => ["retreat", "escape"].includes(normalizeId(entry.effect?.type)) && entry.applied === false);
    if (structuralFailure) return { resolved: false, type: "automatic", reason: structuralFailure.reason || "structural_effect_unhandled", effects };
    return { resolved: true, type: "automatic", effects };
  }

  function resolveCombatAction(input = {}, context = {}) {
    let action = schema.normalizeCombatAction(input);
    const validation = schema.validateCombatAction(action);
    if (!validation.valid) return { resolved: false, reason: "invalid_action", errors: validation.errors, action };
    action = validation.action;
    if (terminal(action)) return { resolved: action.state === "resolved", reason: "terminal_state", action };

    const gate = phaseGate(action, context);
    if (!gate.allowed) return { resolved: false, pending: gate.pending, reason: gate.reason, expectedPhase: gate.expected, actualPhase: gate.actual, action };

    const actor = unitById(context, action.actorId);
    if (!actor) return { resolved: false, reason: "actor_missing", action };
    if (isStaggered(actor)) {
      const cancelled = schema.cancelCombatAction(action, { type: "stagger" });
      return { resolved: false, cancelled: true, reason: "stagger", action: cancelled.action };
    }

    if (action.resolution.type === "clash" && context.opposingAction) {
      return resolveClashPair(action, context.opposingAction, context);
    }

    const resourceGate = validateResources(action, actor, context);
    if (!resourceGate.available) return { resolved: false, reason: resourceGate.reason, resourceGate, action };
    const economy = consumeEconomy(action, actor, context);
    if (economy.consumed === false) return { resolved: false, reason: economy.reason || "economy_unavailable", economy, action };
    const resources = consumeResources(action, actor, context);
    if (!resources.consumed) return { resolved: false, reason: resources.reason, resources, economy, action };

    action.state = "resolving";
    const targetResolution = resolveTargets(action, context);
    const targets = targetResolution.targets;
    let resolution;

    if (action.resolution.type === "clash") {
      resolution = resolveDirectAttack(action, actor, targets, context, { skill: definitionForEngine(action) });
    } else if (action.resolution.type === "unopposed") {
      resolution = resolveDirectAttack(action, actor, targets, context, { skill: definitionForEngine(action) });
    } else if (action.resolution.type === "save") {
      resolution = resolveSave(action, actor, targets, context);
    } else if (action.resolution.type === "check") {
      resolution = resolveCheck(action, actor, targets, context);
    } else if (action.resolution.type === "contest") {
      resolution = resolveContest(action, actor, targets, context);
    } else {
      resolution = resolveAutomatic(action, actor, targets, context);
    }

    if (resolution?.resolved === false) {
      action.state = "locked";
      return { resolved: false, reason: resolution.reason || "resolution_failed", resolution, resources, economy, action };
    }
    action.state = "resolved";
    return { resolved: true, action, resolution, resources, economy, targetResolution, resolvedActionIds: [action.id] };
  }

  const api = Object.freeze({
    currentPhase,
    consumeEconomy,
    validateResources,
    consumeResources,
    resolveTargets,
    resolveDirectAttack,
    resolvePreparedUnopposed,
    resolveClashPair,
    resolveSave,
    resolveCheck,
    resolveContest,
    resolveAutomatic,
    resolveCombatAction,
  });

  global.LuminousCombatActionResolver = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
