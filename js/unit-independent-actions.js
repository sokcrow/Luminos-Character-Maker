(function (global) {
  "use strict";
  if (global.LuminousUnitIndependentActions) return;

  // One resolver for Player, NPC, Enemy and AI. UI and GOAP only select sources.
  // No Action Slot is scheduled by this runtime.
  const VERSION = "1.1.0";
  const catalogState = { definitions: {}, grants: {} };
  function configureCatalog(value = {}) { Object.assign(catalogState, value); }
  const QUICK = "quick_action";
  const FREE = "free_action";
  const clean = (v) => String(v ?? "").trim();
  const norm = (v) => clean(v).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const arr = (v) => v == null ? [] : Array.isArray(v) ? v : [v];
  const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
  const active = (u) => u && u.battleActive !== false && !u.isBackup && !u.dead && !u.defeated && !u.escaped && Number(u.hp ?? 1) > 0;
  const economy = () => global.LuminousActionEconomy;
  const engine = () => global.LuminousTraitEngine;
  const currentRound = () => Math.max(1, Number(global.LuminousCombatLiveAdapter073?.state?.round || global.LuminousCombatAuthority073?.state?.current?.round || 1) || 1);
  const actorId = (unit) => clean(unit?.id || unit?.combatId || unit?.unitId);
  const typeOf = (row = {}) => norm(row.sourceType || row.kind || row.actionType || (row.activation ? "trait" : "skill"));
  const definitionOf = (row = {}) => row.definition || row.trait || row.skill || row.spell || row.item || row;

  function costOf(row = {}) {
    const d = definitionOf(row);
    const a = d.activation && typeof d.activation === "object" ? d.activation : {};
    const value = norm(d.economyCost ?? d.economy_cost ?? d.economy?.cost ?? d.actionCost ??
      d.action_cost ?? a.actionCost ?? a.action_cost ?? d.activationCost ??
      d.castingTime ?? d.casting_time ?? row.economyCost ?? row.actionCost);
    if (["quick", "quick_action", "quickaction", "bonus", "bonus_action", "bonusaction"].includes(value)) return QUICK;
    if (["free", "free_action", "freeaction", "none", "no_action"].includes(value)) return FREE;
    if (["reaction", "react"].includes(value)) return "reaction";
    return "action";
  }

  function characterFor(unit = {}) {
    const key = clean(unit.canonicalPlayerKey || unit.ownerPlayerId || unit.playerId);
    const player = key ? global.LuminousCombatLiveAdapter073?.state?.players?.[key] : null;
    return { ...(player || {}), ...unit,
      ...(player?.classes ? { classes: clone(player.classes) } : {}),
      characterBuild: { ...(unit.characterBuild || {}), ...(player?.characterBuild || {}) } };
  }

  function definitions() {
    return { ...(global.LuminousTraitCatalogCore?.allDefinitions?.() || {}),
      ...(global.LuminousRacialTraitCatalog?.allDefinitions?.() || {}),
      ...(global.LuminousArchetypeTraitCatalog?.allDefinitions?.() || {}),
      ...(global.LuminousDmTraitLibrary?.getDefinitions?.() || {}), ...catalogState.definitions };
  }

  function ownedTraits(unit = {}) {
    const character = characterFor(unit), catalog = definitions(), traitEngine = engine();
    const rows = [];
    const grants = [...(global.LuminousTraitCatalogCore?.allGrants?.() || []),
      ...Object.values(catalogState.grants)];
    try {
      if (traitEngine?.resolveTraitGrants) rows.push(...traitEngine.resolveTraitGrants(character, grants, catalog));
      rows.push(...(global.LuminousRacialTraitCatalog?.resolveTraitGrants?.(character, catalog) || []));
      rows.push(...(global.LuminousArchetypeTraitCatalog?.resolveTraitGrants?.(character, catalog) || []));
      rows.push(...(global.LuminousClassMilestones?.resolveSelectedGeneralTraits?.(character, catalog) || []));
    } catch (error) { global.console?.warn?.("[UnitIndependentActions] Grant resolution", error); }
    const explicit = [unit.traits, unit.combatTraits, unit.actionTraits, unit.classTraits,
      unit.archetypeTraits, unit.traitDefinitions, unit.features, character.traits, character.combatTraits,
      character.actionTraits, character.traitDefinitions, character.characterBuild?.traitDefinitions];
    for (const container of explicit) {
      const values = Array.isArray(container) ? container : typeof container === "object" && container
        ? Object.entries(container).map(([id, value]) => value === true ? id : typeof value === "object" ? { id, ...value } : value)
        : arr(container);
      for (const candidate of values) {
        const id = norm(typeof candidate === "string" ? candidate : candidate?.id || candidate?.traitId || candidate?.name);
        if (!id) continue;
        rows.push({ ...(catalog[id] || {}), ...(typeof candidate === "object" ? candidate : {}),
          activation: { ...(catalog[id]?.activation || {}), ...(candidate?.activation || {}) }, id });
      }
    }
    const seen = new Set();
    return rows.filter((trait) => {
      const id = norm(trait?.id || trait?.traitId || trait?.name);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      const activation = norm(trait?.activation?.type || trait?.activationType);
      return ["manual", "prompt", "choice"].includes(activation);
    });
  }

  function sourcesFor(unit = {}, options = {}) {
    const kit = options.kit || global.LuminousUnitAiKitAdapter?.buildKit?.(unit, options.kitOptions || {}) || {};
    const candidates = [...arr(kit.sources), ...arr(options.sources), ...ownedTraits(unit).map(definition => ({ sourceType: "trait", definition }))];
    const inventory = unit.inventario_activo || unit.activeInventory || unit.inventory || {};
    const items = Array.isArray(inventory) ? inventory.map((item,i)=>[String(i),item]) : Object.entries(inventory);
    for (const [key,item] of items) {
      if (!item || typeof item !== "object" || Number(item.quantity ?? item.qty ?? 1) <= 0) continue;
      const id = clean(item.instanceId || item.instance_id || key);
      const actionCost = item.actionCost ?? item.economyCost ?? item.runtime?.actionCost ?? item.runtime?.action_cost;
      if (!id || !actionCost) continue;
      candidates.push({ sourceType:"item", definition:{ ...item,id,instanceId:id,actionCost } });
    }
    const unique = new Map();
    for (const candidate of candidates) {
      const definition = definitionOf(candidate);
      if (!definition || typeof definition !== "object") continue;
      const type = typeOf(candidate);
      let cost = costOf(candidate);
      // Class/Archetype runtimes may upgrade an Action to Quick dynamically.
      // Ask the shared Trait Engine for the effective granted cost, never
      // hardcode Ranger/Barbarian/Fighter exceptions in Combat menus or GOAP.
      if (type === "trait" && engine()?.canActivateTrait) {
        try {
          const effective = engine().canActivateTrait(definition,{
            context:"combat",character:characterFor(unit),self:unit,actor:unit,
            actionEconomy:{canUse:()=>true}
          },engine().createState?.());
          const resolvedCost = costOf({actionCost:effective?.actionCost||effective?.trait?.activation?.actionCost});
          if ([QUICK,FREE].includes(resolvedCost)) cost=resolvedCost;
        } catch (_) {}
      }
      if (![QUICK, FREE].includes(cost) || ["reaction", "universal"].includes(type) || candidate.available === false) continue;
      if (type === "trait" && !["manual", "prompt", "choice"].includes(norm(definition.activation?.type || definition.activationType))) continue;
      const id = clean(definition.instanceId || definition.id || definition.traitId || definition.skillId || definition.spellId);
      if (!id) continue;
      const key = type + ":" + id;
      if (!unique.has(key)) unique.set(key, { sourceType: type, definition, cost });
    }
    return [...unique.values()];
  }

  function stateFor(unit) {
    const state = unit.combatIndependentActionState ||= { round: 0, freeUses: {} };
    // Encounter Start, manual activations and rest recovery share one Trait state.
    unit.combatTraitState ||= state.traitState || engine()?.createState?.() || { usages: {}, ruleScopes: {}, counters: {} };
    state.traitState = unit.combatTraitState;
    state.traitState.resources ||= {};
    for (const [id, resource] of Object.entries(unit.resources || {})) {
      const value = Number(typeof resource === "object" ? resource?.value : resource);
      if (Number.isFinite(value)) state.traitState.resources[id] = { ...state.traitState.resources[id], value, min: 0 };
    }
    state.freeUses ||= {};
    return state;
  }

  function prepareRound(unit, round = currentRound()) {
    const state = stateFor(unit), next = Math.max(1, Number(round) || 1);
    if (state.round !== next) {
      if (state.round > 0) {
        unit.quickActionRemaining = 1;
        engine()?.resetStateScope?.(state.traitState, "turn");
      }
      state.round = next; state.freeUses = {}; state.aiUsed = {};
    }
    const runtimeState = economy()?.ensureState?.(unit);
    if (runtimeState) runtimeState.quickActionRemaining = Math.max(0, Number(unit.quickActionRemaining ?? runtimeState.quickActionRemaining ?? 1));
    return state;
  }

  function selectTarget(unit, definition, candidates = [], explicitTarget = null) {
    const attack = Number(definition.basePower ?? definition.base_power) > 0 ||
      Number(definition.coinPower ?? definition.coin_power) > 0;
    const targetMode = norm(definition.activation?.target || definition.targeting?.allegiance ||
      definition.targeting?.mode || definition.runtime?.targetMode || definition.targetMode ||
      (attack ? "enemy" : "self"));
    if (["self", "caster", "owner"].includes(targetMode)) return unit;
    const allies = ["ally", "allies", "friendly", "selected_ally"].includes(targetMode);
    if (explicitTarget) {
      if (!active(explicitTarget)) return null;
      if (allies && explicitTarget.faction !== unit.faction) return null;
      if (!allies && !["any", "neutral"].includes(targetMode) && explicitTarget.faction === unit.faction) return null;
      return explicitTarget;
    }
    const friends = ["ally", "allies", "friendly", "selected_ally"].includes(targetMode);
    return candidates.find(other => active(other) && actorId(other) !== actorId(unit) &&
      (friends ? other.faction === unit.faction : other.faction !== unit.faction)) || (friends ? unit : null);
  }

  function executeDraft(unit, candidate, options = {}) {
    if (!active(unit) || unit.incapacitated) return { used: false, reason: "unit_not_active" };
    const definition = definitionOf(candidate), type = norm(options.sourceType || typeOf(candidate));
    const cost = candidate.cost || costOf(candidate);
    if (![QUICK, FREE].includes(cost)) return { used: false, reason: "not_independent_action" };
    const roundState = prepareRound(unit, options.round), sourceId = clean(definition.instanceId || definition.id || definition.traitId || definition.skillId || definition.spellId);
    const key = type + ":" + sourceId;
    if (!sourceId) return { used: false, reason: "missing_source_id" };
    const phase = norm(options.phase || (options.ai ? "combat" : "planning")), budget = economy();
    const condition = global.LuminousConditionRuntime?.actionAvailability?.(unit, cost, { phase });
    if (condition?.available === false) return { used: false, reason: condition.reason || "condition_blocks_action" };
    if (cost === QUICK) {
      const gate = budget?.availability?.(unit, QUICK, { phase });
      if (!budget || gate?.available === false) return { used: false, reason: gate?.reason || "quick_action_unavailable" };
    } else {
      // Free has no invented global cap. The authored uses/resources/mechanic
      // govern player activation; AI prevents loops in its decision traversal.
      const limit = Number(definition.maxFreeUsesPerTurn ?? definition.maxUsesPerTurn ?? definition.activation?.maxUsesPerTurn);
      if (limit > 0 && (roundState.freeUses[key] || 0) >= limit) return { used: false, reason: "free_action_limit_reached" };
    }
    const units = options.units || [unit], target = selectTarget(unit, definition, units, options.target);
    if (!target) return { used: false, reason: "invalid_target" };
    let result, handled = false;
    if (type === "trait") {
      const traitEngine = engine();
      if (!traitEngine?.activateTrait || !global.LuminousCombatEventRuntime?.activate) return { used: false, reason: "trait_engine_unavailable" };
      const runtime = { context: "combat", character: unit, self: unit, actor: unit, target, units,
        phase, round: roundState.round, turnNumber: roundState.round, choice: options.choice, skill: options.skill,
        actionEconomy: {
          canUse: actionCost => costOf({ actionCost }) !== QUICK || budget?.canUse?.(unit, QUICK, { phase }),
          consume: () => true,
          grantActionSlots: amount => budget?.grantTemporaryActionSlots?.(unit, amount, { phase: "planning" }),
        } };
      const check = traitEngine.canActivateTrait(definition, runtime, roundState.traitState);
      if (!check?.available) return { used: false, reason: check?.reasons?.join(" · ") || "trait_unavailable" };
      const before = JSON.stringify(units.map(gameplayState));
      result = global.LuminousCombatEventRuntime.activate(definition, unit, runtime);
      if (!result?.available) return { used: false, reason: result?.reasons?.join(" · ") || "activation_failed" };
      const outcomes = arr(result.outcomes).filter(row => !["log", "register_dm_effect"].includes(row.type));
      handled = outcomes.length > 0 || before !== JSON.stringify(units.map(gameplayState));
    } else if (type === "item") {
      const inventory = unit.inventario_activo || unit.activeInventory || unit.inventory || {};
      const entries = Array.isArray(inventory) ? inventory.map((value,index)=>[String(index),value]) : Object.entries(inventory);
      const instance = clean(definition.instanceId || definition.instance_id || definition.id);
      const live = entries.find(([key,item]) => item && clean(item.instanceId || item.instance_id || key) === instance)?.[1];
      if (!live || Number(live.quantity ?? live.qty ?? live.cantidad ?? 1) <= 0) return { used: false, reason: "active_inventory_item_missing" };
      result = global.LuminousItemRuntime?.useItem?.(unit, live, { phase, target, ignoreActionCost: true });
      handled = result?.used === true;
    } else if (type === "skill" || type === "spell") {
      const adapters = global.LuminousCombatActionAdapters, resolver = global.LuminousCombatActionResolver, schema = global.LuminousCombatAction;
      const compiler = type === "skill" ? adapters?.compileSkillToCombatAction : adapters?.compileSpellToCombatAction;
      if (compiler && resolver?.resolveCombatAction && schema) {
        const action = compiler(unit, definition, { actorId: actorId(unit), targetId: actorId(target), mainTargetId: actorId(target), targetIds: [actorId(target)],
          cost: cost === FREE ? "action" : QUICK, selectedAt: options.ai ? schema.PHASES.PLANNING_PHASE_AI : schema.PHASES.PLANNING_PHASE_PLAYER,
          executesAt: schema.PHASES.COMBAT_PHASE, metadata: { independentActionCost: cost, sourceDefinition: clone(definition) } });
        result = resolver.resolveCombatAction(action, { phase: schema.PHASES.COMBAT_PHASE, units,
          combatData: Object.fromEntries(units.map(u => [actorId(u), u])), engine: options.engine || global.CombatEngine,
          consumeQuickAction: () => ({ consumed: true }) });
        handled = result?.resolved === true;
      }
    }
    if (!handled) return { used: false, reason: result?.reason || (type === "trait" ? "trait_specific_runtime_required" : "independent_action_runtime_unavailable"), sourceId, cost };
    if (cost === QUICK) {
      if (!budget.consume(unit, QUICK, { phase })) return { used: false, reason: "quick_spend_failed" };
      unit.quickActionRemaining = Number(budget.snapshot(unit, { phase }).quick_action) || 0;
    } else roundState.freeUses[key] = (roundState.freeUses[key] || 0) + 1;
    // Materialize a granted Action once. It is a real temporary normal slot,
    // never a slot consumed by the Free Action itself.
    const extra = Number(budget?.ensureState?.(unit)?.bonusActionSlots) || 0;
    if (extra) {
      const base = Number(unit.activeSlots || unit.actionSlots) || 1;
      unit.actionSlots = base + extra; unit.activeSlots = unit.actionSlots;
      roundState.temporaryActionSlots = (Number(roundState.temporaryActionSlots) || 0) + extra;
      budget.ensureState(unit).bonusActionSlots = 0;
    }
    if (extra && options.ai) {
      const plans = planExtraActions(unit, options.units);
      if (!plans || plans.length <= (Number(unit.actionSlots) - extra)) return { used: false, reason: "additional_action_has_no_legal_plan" };
      unit.autoPlans = plans;
    }
    return { used: true, sourceId, sourceType: type, cost, targetId: actorId(target), additionalActions: extra };
  }

  function gameplayState(unit) {
    const { combatIndependentActionState, combatTraitState, currentHp, currentSp, ...rest } = unit;
    return rest;
  }
  function execute(unit, candidate, options = {}) {
    const live = options.units?.includes(unit) ? options.units : [unit, ...(options.units || [])];
    const drafts = clone(live), actor = drafts[live.indexOf(unit)];
    // Build metadata can come from the sheet; mutable resources belong to this
    // same combat entity, never to a detached character copy.
    Object.assign(actor, characterFor(actor));
    const target = options.target ? drafts.find(row => actorId(row) === actorId(options.target)) : null;
    if (options.target && !target) return { used: false, reason: "invalid_target" };
    drafts.forEach(row => { row.currentHp = row.hp; row.currentSp = row.sp; });
    let result;
    try { result = executeDraft(actor, candidate, { ...options, units: drafts, target }); }
    catch (error) { return { used: false, reason: error?.message || "activation_failed" }; }
    if (!result.used) return result;
    drafts.forEach((draft, index) => {
      const state = stateFor(draft);
      const fields = state.runtimeFields ||= {};
      for (const key of Object.keys(draft)) if (key.startsWith("__") && JSON.stringify(draft[key]) !== JSON.stringify(live[index][key])) fields[key] = clone(draft[key]);
      for (const key of Object.keys(live[index])) if (!(key in draft)) delete live[index][key];
      Object.assign(live[index], draft);
      const saved = economy()?.ensureState?.(live[index]);
      if (saved) saved.quickActionRemaining = Number(draft.quickActionRemaining ?? saved.quickActionRemaining);
    });
    if (!options.silent && typeof global.CustomEvent === "function") global.dispatchEvent?.(new global.CustomEvent("luminous:unit-independent-action-resolved", {
      detail: { ...result, unitId: actorId(unit), round: Number(options.round) || currentRound(), ai: options.ai === true }
    }));
    return result;
  }

  function planExtraActions(unit, units) {
    const rows = global.LuminousCombat073?.kit?.(unit.id)?.actions || [];
    const actor = { ...unit, resolvedSkills: rows.filter(row => row.kind !== "spell" && costOf(row) === "action"),
      resolvedSpells: rows.filter(row => row.kind === "spell" && costOf(row) === "action") };
    const plan = global.LuminousUnitAiKitAdapter?.planUnitTurn({ actor, availableSlots: unit.actionSlots,
      slotIds: Array.from({length: unit.actionSlots}, (_, index) => `${unit.id}_slot_${index}`), allowEscape: false,
      targets: units.filter(target => active(target) && target.faction !== unit.faction), random: global.LuminousCombatAuthority073?.random });
    if (!plan?.planned) return null;
    return plan.actions.map((action, index) => {
      const definition = clone(action.metadata?.sourceDefinition || rows.find(row => clean(row.id) === clean(action.source?.id)) || {});
      const kind = action.source?.type === "spell" ? "spell" : definition.kind === "defense" ? "defense" : "skill";
      return global.LuminousCombatRemoteIntents073?.runtimePlan({ kind, sourceSlotIndex: index, actionData: definition,
        ...(kind === "spell" ? {spellId: action.source.id, slotLevel: definition.slotLevel} : {skillId: action.source.id}),
        targetId: action.targeting?.mainTargetId, targetSlotIndex: 0, planType: "auto" }, index, unit);
    }).filter(Boolean);
  }
  function runAiPhase(timing, options = {}) {
    const units = options.units || Object.values(global.LuminousCombat073?.combatants?.() || {}), results = [];
    for (const unit of units) {
      if (unit.controlled !== "ai") continue;
      const decide = () => runAiTurn(unit, { ...options, units, timing });
      const run = () => global.LuminousCombatAuthority073?.withAuthorityRandom ? global.LuminousCombatAuthority073.withAuthorityRandom(decide) : decide();
      const result = options.mutate ? options.mutate("IndependentActionsResolved", null, { unitId: unit.id, timing }, run) : run();
      if (result.used?.length) {
        global.setUnitActionSlotCount?.(unit.id, unit.actionSlots);
        results.push(...result.used);
      }
    }
    global.LuminousCombat073?.render?.();
    return results;
  }
  function endRound(units) {
    for (const unit of units) {
      const count = Number(unit.combatIndependentActionState?.temporaryActionSlots) || 0;
      if (!count) continue;
      unit.combatIndependentActionState.temporaryActionSlots = 0;
      const size = Math.max(1, Number(unit.actionSlots) - count);
      global.setUnitActionSlotCount?.(unit.id, size);
      unit.actionSlots = size; unit.activeSlots = size;
    }
  }
  function runAiTurn(unit, options = {}) {
    if (!active(unit) || unit.controlled !== "ai") return { used: [], reason: "not_active_ai" };
    prepareRound(unit, options.round);
    const timing = options.timing || "before_actions", entries = sourcesFor(unit, options), used = [];
    const goap = global.LuminousIndividualGoapCombatAI;
    const decisions = goap?.rankIndependentActions?.(unit, entries, { ...options, timing }) || [];
    for (const candidate of decisions) {
      const state = stateFor(unit), key = candidate.sourceType + ":" + clean(candidate.definition.id);
      if (state.aiUsed?.[key]) continue;
      const outcome = execute(unit, candidate, { ...options, ai: true, phase: "combat" });
      if (outcome.used) { stateFor(unit).aiUsed ||= {}; stateFor(unit).aiUsed[key] = true; used.push(outcome); }
    }
    return { used, round: stateFor(unit).round };
  }
  async function prepare(units) { await global.LuminousCombatEventRuntime.prepare(units.map(characterFor)); }

  const api = Object.freeze({ VERSION, QUICK, FREE, costOf, characterFor, ownedTraits, sourcesFor,
    stateFor, prepareRound, selectTarget, execute, runAiTurn, runAiPhase, endRound, prepare, configureCatalog });
  global.LuminousUnitIndependentActions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
