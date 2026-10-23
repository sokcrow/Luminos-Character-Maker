(function (global) {
  "use strict";
  if (global.LuminousUnitIndependentActions) return;

  // One resolver for Player, NPC, Enemy and AI. UI and GOAP only select sources.
  // No Action Slot is scheduled by this runtime.
  const VERSION = "1.0.0";
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
    return { ...unit, ...(player || {}), characterBuild: { ...(unit.characterBuild || {}), ...(player?.characterBuild || {}) } };
  }

  function definitions() {
    return { ...(global.LuminousTraitCatalogCore?.allDefinitions?.() || {}),
      ...(global.LuminousRacialTraitCatalog?.allDefinitions?.() || {}),
      ...(global.LuminousArchetypeTraitCatalog?.allDefinitions?.() || {}),
      ...(global.LuminousCombatEconomyMenu073?.state?.traitCatalogDefinitions || {}) };
  }

  function ownedTraits(unit = {}) {
    const character = characterFor(unit), catalog = definitions(), traitEngine = engine();
    const rows = [];
    const grants = [...(global.LuminousTraitCatalogCore?.allGrants?.() || []),
      ...Object.values(global.LuminousCombatEconomyMenu073?.state?.traitCatalogGrants || {})];
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
    const candidates = [...arr(options.sources || kit.sources), ...ownedTraits(unit).map(definition => ({ sourceType: "trait", definition }))];
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
      const id = norm(definition.id || definition.traitId || definition.skillId || definition.spellId || definition.instanceId);
      if (!id) continue;
      const key = type + ":" + id;
      if (!unique.has(key)) unique.set(key, { sourceType: type, definition, cost });
    }
    return [...unique.values()];
  }

  function stateFor(unit) {
    if (!unit.combatIndependentActionState || typeof unit.combatIndependentActionState !== "object")
      unit.combatIndependentActionState = { round: 0, freeUses: {}, traitState: engine()?.createState?.() || { usages: {}, ruleScopes: {}, counters: {} } };
    return unit.combatIndependentActionState;
  }

  function prepareRound(unit, round = currentRound()) {
    const state = stateFor(unit), next = Math.max(1, Number(round) || 1);
    if (state.round !== next) {
      if (state.round > 0) {
        unit.quickActionRemaining = 1;
        engine()?.resetStateScope?.(state.traitState, "turn");
      }
      state.round = next;
      state.freeUses = {};
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

  function execute(unit, candidate, options = {}) {
    if (!active(unit)) return { used: false, reason: "unit_not_active" };
    const definition = definitionOf(candidate), type = norm(options.sourceType || typeOf(candidate));
    const cost = candidate.cost || costOf({ ...candidate, definition });
    if (![QUICK, FREE].includes(cost)) return { used: false, reason: "not_independent_action" };
    const roundState = prepareRound(unit, options.round);
    const sourceId = norm(definition.id || definition.traitId || definition.skillId || definition.spellId || definition.instanceId);
    const key = type + ":" + sourceId;
    if (!sourceId) return { used: false, reason: "missing_source_id" };
    const phase = norm(options.phase || (options.ai ? "combat" : "planning"));
    const budget = economy();
    if (cost === QUICK) {
      const gate = budget?.availability?.(unit, QUICK, { phase });
      if (!budget || gate?.available === false) return { used: false, reason: gate?.reason || "quick_action_unavailable" };
    } else {
      const limit = Math.max(1, Number(definition.maxFreeUsesPerTurn || definition.maxUsesPerTurn || 1) || 1);
      if ((roundState.freeUses[key] || 0) >= limit) return { used: false, reason: "free_action_limit_reached" };
    }

    const units = options.units || Object.values(global.LuminousCombat073?.combatants?.() || {});
    const target = selectTarget(unit, definition, units, options.target || null);
    const character = options.character || characterFor(unit);
    let result = null, handled = false, reason = "independent_action_runtime_unavailable";
    if (type === "trait") {
      const traitEngine = engine();
      if (!traitEngine?.canActivateTrait || !traitEngine?.activateTrait) return { used: false, reason: "trait_engine_unavailable" };
      const runtime = {
        context: "combat", character, self: unit, actor: unit, target, phase,
        actionEconomy: {
          canUse: actionCost => costOf({ actionCost }) !== QUICK || budget?.availability?.(unit, QUICK, { phase })?.available !== false,
          // The shared controller commits the budget exactly once after success.
          consume: () => true,
        },
      };
      const check = traitEngine.canActivateTrait(definition, runtime, roundState.traitState);
      if (!check?.available) return { used: false, reason: (check?.reasons || ["trait_unavailable"]).join("; ") };
      const generic = arr(definition.effects).length > 0 || arr(definition.rules).length > 0;
      if (!generic) {
        const detail = { source: clone(definition), sourceType: "trait", unit, actor: unit,
          targetId: actorId(target), handled: false, result: null, preflight: check };
        if (typeof global.CustomEvent === "function")
          global.dispatchEvent?.(new global.CustomEvent("luminous:combat073-quick-action-request", { detail }));
        if (detail.handled) { handled = true; result = detail.result; }
      }
      const activation = traitEngine.activateTrait(definition, runtime, roundState.traitState);
      if (activation?.available === false) return { used: false, reason: (activation.reasons || ["activation_failed"]).join("; ") };
      if (generic || arr(activation?.outcomes).length || handled) {
        // The Trait Engine tracks status operations in its canonical state.
        // Mirror applied/removed status effects onto the live Unit so that the
        // shared Combat status renderer, class hooks and checkpoints see them.
        for (const outcome of arr(activation?.outcomes)) {
          if (norm(outcome?.type) === "apply_status" && outcome.statusId && outcome.status) {
            unit.statusEffects ||= {};
            unit.statusEffects[norm(outcome.statusId)] = clone(outcome.status);
          } else if (norm(outcome?.type) === "remove_status" && outcome.removed && outcome.statusId) {
            if (unit.statusEffects) delete unit.statusEffects[norm(outcome.statusId)];
          }
        }
        handled = true; result = activation;
      }
      else reason = "trait_specific_runtime_required";
    } else if (type === "item") {
      // Menus use display snapshots, but every Unit must mutate the actual
      // inventory instance (same identifier for Player, NPC and Enemy).
      const inventory = unit.inventario_activo || unit.activeInventory || unit.inventory || {};
      const entries = Array.isArray(inventory) ? inventory.map((value,index)=>[String(index),value]) : Object.entries(inventory);
      const instance = norm(definition.instanceId || definition.instance_id || definition.id);
      const found = entries.find(([key,item])=>item&&norm(item.instanceId||item.instance_id||key)===instance);
      const live = found?.[1] || null;
      if (!live || Number(live.quantity ?? live.qty ?? live.cantidad ?? 1) <= 0)
        return { used: false, reason: "active_inventory_item_missing" };
      const use = global.LuminousItemRuntime?.useItem;
      if (typeof use === "function") {
        result = use(unit, live, { phase, target, ignoreActionCost: true });
        handled = result?.used === true;
        reason = result?.reason || "item_use_failed";
      }
    } else if (type === "skill" || type === "spell") {
      const adapters = global.LuminousCombatActionAdapters;
      const resolver = global.LuminousCombatActionResolver;
      const schema = global.LuminousCombatAction;
      const compiler = type === "skill" ? adapters?.compileSkillToCombatAction : adapters?.compileSpellToCombatAction;
      if (compiler && resolver?.resolveCombatAction && schema) {
        const action = compiler(unit, definition, {
          actorId: actorId(unit), targetId: actorId(target), mainTargetId: actorId(target),
          targetIds: target ? [actorId(target)] : [],
          cost: cost === FREE ? "action" : QUICK,
          selectedAt: options.ai ? schema.PHASES.PLANNING_PHASE_AI : schema.PHASES.PLANNING_PHASE_PLAYER,
          executesAt: schema.PHASES.COMBAT_PHASE,
          metadata: { independentActionCost: cost, sourceDefinition: clone(definition) },
        });
        result = resolver.resolveCombatAction(action, {
          phase: schema.PHASES.COMBAT_PHASE, units, combatData: Object.fromEntries(units.map(u => [actorId(u), u])),
          engine: global.CombatEngine, consumeQuickAction: () => ({ consumed: true }),
        });
        handled = result?.resolved === true;
        reason = result?.reason || "action_resolution_failed";
      }
    }
    if (!handled) return { used: false, reason, sourceId, cost };
    if (cost === QUICK) {
      if (!budget.consume(unit, QUICK, { phase })) return { used: false, reason: "quick_spend_failed", sourceId, cost };
      unit.quickActionRemaining = Math.max(0, Number(budget.snapshot(unit, { phase }).quick_action) || 0);
    } else roundState.freeUses[key] = (roundState.freeUses[key] || 0) + 1;
    const detail = { unitId: actorId(unit), sourceId, sourceType: type, cost, round: roundState.round, targetId: actorId(target) || null, result, ai: options.ai === true };
    if (typeof global.CustomEvent === "function") global.dispatchEvent?.(new global.CustomEvent("luminous:unit-independent-action-resolved", { detail }));
    return { used: true, sourceId, cost, result };
  }

  function runAiTurn(unit, options = {}) {
    if (!active(unit) || unit.controlled !== "ai") return { used: [], reason: "not_active_ai" };
    const state = prepareRound(unit, options.round);
    if (state.aiExecutedRound === state.round) return { used: [], reason: "already_resolved_this_round" };
    const entries = sourcesFor(unit, options);
    // A deterministic decision; no RNG, no additional Action Slots.
    const hpRatio = Number(unit.hp || 0) / Math.max(1, Number(unit.maxHp || 1));
    const utility = candidate => {
      const d = candidate.definition, role = norm(d.aiRole || d.role || d.aiEstimate?.role);
      const id = norm(d.id || d.name);
      const recovery = role.includes("recover") || role.includes("heal") || /heal|recover|second_wind/.test(id);
      const defense = role.includes("defense") || role.includes("protect") || /rage|shield|guard/.test(id);
      return (recovery ? (hpRatio < 0.65 ? 100 : -100) : 0) + (defense ? 25 : 0) +
        Number(d.aiEstimate?.advantage || 0) + Number(d.aiPriority || 0);
    };
    entries.sort((a,b) => utility(b) - utility(a) || norm(a.definition.id).localeCompare(norm(b.definition.id)));
    const used = [];
    for (const cost of [QUICK, FREE]) {
      const pool = entries.filter(entry => entry.cost === cost).slice(0, cost === FREE ? 2 : 8);
      for (const candidate of pool) {
        const outcome = execute(unit, candidate, { ...options, ai: true, phase: "combat" });
        if (outcome.used) { used.push(outcome); if (cost === QUICK) break; }
      }
    }
    state.aiExecutedRound = state.round;
    return { used, round: state.round };
  }

  const api = Object.freeze({ VERSION, QUICK, FREE, costOf, characterFor, ownedTraits, sourcesFor,
    stateFor, prepareRound, selectTarget, execute, runAiTurn });
  global.LuminousUnitIndependentActions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
