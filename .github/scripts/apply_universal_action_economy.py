from pathlib import Path

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, text):
    (ROOT / path).write_text(text, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    if new in text:
        return False
    count = text.count(old)
    if count != 1:
        raise AssertionError(f'{path}: expected one match, found {count}: {old[:180]!r}')
    write(path, text.replace(old, new, 1))
    return True


def insert_before_once(path, marker, block, sentinel):
    text = read(path)
    if sentinel in text:
        return False
    count = text.count(marker)
    if count != 1:
        raise AssertionError(f'{path}: expected one marker, found {count}: {marker[:180]!r}')
    write(path, text.replace(marker, block.rstrip() + '\n\n' + marker, 1))
    return True


# ---------------------------------------------------------------------------
# Trait Engine: Action = scheduled slot, Quick Action/Reaction = live resources.
# ---------------------------------------------------------------------------
replace_once(
    'js/trait-engine.js',
    '  function actionAvailable(runtime, cost) { const c = normalizeId(cost || "none"); if (["none", "special"].includes(c) || !runtime.actionEconomy) return true; return num(runtime.actionEconomy[c] ?? getPath(runtime.actionEconomy, `available.${c}`)) > 0; }',
    '''  function actionAvailable(runtime, cost) {
    const c = normalizeId(cost || "none");
    if (["none", "special"].includes(c)) return true;
    if (runtime.executePlannedAction && c === "action") return true;
    if (!runtime.actionEconomy) return true;
    if (typeof runtime.actionEconomy.canUse === "function") return Boolean(runtime.actionEconomy.canUse(c));
    return num(runtime.actionEconomy[c] ?? getPath(runtime.actionEconomy, `available.${c}`)) > 0;
  }'''
)
replace_once(
    'js/trait-engine.js',
    '''  function activateTrait(input, runtime = {}, stateInput) {
    const state = stateInput || createState(), check = canActivateTrait(input, runtime, state); if (!check.available) return Object.assign(check, { outcomes: [] }); const trait = check.trait, cost = trait.activation.actionCost;
    if (!["none", "special"].includes(cost) && runtime.actionEconomy) { if (Object.prototype.hasOwnProperty.call(runtime.actionEconomy, cost)) runtime.actionEconomy[cost] = Math.max(0, num(runtime.actionEconomy[cost]) - 1); else if (runtime.actionEconomy.available) runtime.actionEconomy.available[cost] = Math.max(0, num(runtime.actionEconomy.available[cost]) - 1); }
    const record = usageRecord(state, trait); if (check.maximum != null) record.used += 1; if (trait.activation.type === "choice" && runtime.choice != null) state.choices[assertSafeKey(trait.id, "Trait id")] = clone(runtime.choice);
    const result = dispatchTrait(trait, "on_use", runtime, state); return { available: true, reasons: [], maximum: check.maximum, remaining: check.maximum == null ? null : Math.max(0, check.maximum - record.used), actionCost: cost, trait, state, runtime, outcomes: result.outcomes };
  }''',
    '''  function activateTrait(input, runtime = {}, stateInput) {
    const state = stateInput || createState(), check = canActivateTrait(input, runtime, state);
    if (!check.available) return Object.assign(check, { outcomes: [] });
    const trait = check.trait, cost = trait.activation.actionCost;

    // Combat Actions are assignments to Action Slots during Planning. Assignment does not
    // execute the Trait or spend limited uses; the slot resolves later in Combat Phase.
    if (cost === "action" && runtime.context === "combat" && !runtime.executePlannedAction && typeof runtime.actionEconomy?.schedule === "function") {
      const scheduled = runtime.actionEconomy.schedule({
        kind: "trait",
        traitId: trait.id,
        sourceId: trait.id,
        target: runtime.target || runtime.defender || null,
      });
      if (!scheduled?.scheduled) return Object.assign(check, { available: false, reasons: [scheduled?.reason || "No Action Slot available."], outcomes: [] });
      return {
        available: true,
        scheduled: true,
        slotIndex: scheduled.slotIndex,
        slotId: scheduled.slotId,
        reasons: [],
        maximum: check.maximum,
        remaining: check.remaining,
        actionCost: cost,
        trait,
        state,
        runtime,
        outcomes: [],
      };
    }

    if (!["none", "special", "action"].includes(cost) && runtime.actionEconomy) {
      if (typeof runtime.actionEconomy.consume === "function") {
        if (!runtime.actionEconomy.consume(cost)) return Object.assign(check, { available: false, reasons: [`No ${cost} remaining.`], outcomes: [] });
      } else if (Object.prototype.hasOwnProperty.call(runtime.actionEconomy, cost)) {
        runtime.actionEconomy[cost] = Math.max(0, num(runtime.actionEconomy[cost]) - 1);
      } else if (runtime.actionEconomy.available) {
        runtime.actionEconomy.available[cost] = Math.max(0, num(runtime.actionEconomy.available[cost]) - 1);
      }
    }

    const record = usageRecord(state, trait);
    if (check.maximum != null) record.used += 1;
    if (trait.activation.type === "choice" && runtime.choice != null) state.choices[assertSafeKey(trait.id, "Trait id")] = clone(runtime.choice);
    const result = dispatchTrait(trait, "on_use", runtime, state);
    return { available: true, reasons: [], maximum: check.maximum, remaining: check.maximum == null ? null : Math.max(0, check.maximum - record.used), actionCost: cost, trait, state, runtime, outcomes: result.outcomes };
  }'''
)

# ---------------------------------------------------------------------------
# Player runtime: bind the live Unit + combat phase to the universal economy.
# ---------------------------------------------------------------------------
replace_once(
    'js/player-trait-runtime.js',
    '''      .then(() => Promise.all([
        ensureScript("trait-catalog-core-script", "js/trait-catalog-core.js", () => Boolean(global.LuminousTraitCatalogCore)),
        ensureScript("racial-trait-catalog-script", "js/racial-trait-catalog.js", () => Boolean(global.LuminousRacialTraitCatalog)),
        ensureScript("class-milestone-engine-script", "js/class-milestone-engine.js", () => Boolean(global.LuminousClassMilestones)),
        ensureScript("trait-player-tray-script", "js/trait-player-tray.js", () => Boolean(global.LuminousTraitPlayerTray)),
      ]));''',
    '''      .then(() => Promise.all([
        ensureScript("trait-catalog-core-script", "js/trait-catalog-core.js", () => Boolean(global.LuminousTraitCatalogCore)),
        ensureScript("racial-trait-catalog-script", "js/racial-trait-catalog.js", () => Boolean(global.LuminousRacialTraitCatalog)),
        ensureScript("class-milestone-engine-script", "js/class-milestone-engine.js", () => Boolean(global.LuminousClassMilestones)),
        ensureScript("trait-player-tray-script", "js/trait-player-tray.js", () => Boolean(global.LuminousTraitPlayerTray)),
        ensureScript("universal-action-economy-script", "js/universal-action-economy.js", () => Boolean(global.LuminousActionEconomy)),
      ]));'''
)
replace_once(
    'js/player-trait-runtime.js',
    '''    const standard = global.LuminousTraitStandardizationRuntime;
    const allies = context === "combat" && standard?.liveCombatUnits ? standard.liveCombatUnits({ self }).filter((unit) => unit !== self && Number(unit?.hp ?? 1) > 0 && String(unit?.faction ?? "") === String(self?.faction ?? "")) : [];
    return { context, character, self, level, check, target, AliveAllies: input.AliveAllies ?? completed?.AliveAllies ?? allies.length, ...input };''',
    '''    const standard = global.LuminousTraitStandardizationRuntime;
    const allies = context === "combat" && standard?.liveCombatUnits ? standard.liveCombatUnits({ self }).filter((unit) => unit !== self && Number(unit?.hp ?? 1) > 0 && String(unit?.faction ?? "") === String(self?.faction ?? "")) : [];
    const actionEconomy = context === "combat"
      ? (input.actionEconomy || global.LuminousActionEconomy?.runtimeFor?.(self, { phase: input.phase || global.CombatEngine?.currentState }))
      : input.actionEconomy;
    return { context, character, self, level, check, target, actionEconomy, AliveAllies: input.AliveAllies ?? completed?.AliveAllies ?? allies.length, ...input };'''
)
replace_once(
    'js/player-trait-runtime.js',
    '''  function handleTraitActivated(result, meta = {}) {
    const runtime = result?.runtime || meta.runtime || getRuntime();
    global.LuminousTraitStandardizationRuntime?.resolveTraitRuntimeResolutions?.([meta.trait].filter(Boolean), "on_use", runtime, result);
    recalculateCompletedCheck(result);
    emit("luminous:trait-activated", result);
  }''',
    '''  function handleTraitActivated(result, meta = {}) {
    const runtime = result?.runtime || meta.runtime || getRuntime();
    if (result?.scheduled) {
      emit("luminous:trait-action-scheduled", result);
      emit("luminous:trait-activated", result);
      return;
    }
    global.LuminousTraitStandardizationRuntime?.resolveTraitRuntimeResolutions?.([meta.trait].filter(Boolean), "on_use", runtime, result);
    recalculateCompletedCheck(result);
    emit("luminous:trait-activated", result);
  }'''
)
insert_before_once(
    'js/player-trait-runtime.js',
    '  function recordCompletedTheatreCheck(detail = {}) {',
    '''  function executePlannedTraitAction(unit, slotIndex, context = {}) {
    const actionEconomy = global.LuminousActionEconomy;
    const traitEngine = global.LuminousTraitEngine;
    if (!actionEconomy?.getPlannedAction || !traitEngine?.activateTrait) return { handled: false, reason: "action_economy_unavailable" };
    const planned = actionEconomy.getPlannedAction(unit, slotIndex);
    if (!planned || planned.kind !== "trait" || !planned.traitId) return { handled: false, reason: "no_planned_trait" };
    const trait = resolveTraits().find((entry) => normalizeId(entry?.id || entry?.name) === normalizeId(planned.traitId));
    if (!trait) return { handled: false, reason: "planned_trait_missing", planned };
    const standard = global.LuminousTraitStandardizationRuntime;
    const units = standard?.liveCombatUnits?.({ self: unit }) || [];
    const target = planned.targetId
      ? units.find((candidate) => identityValues(candidate).includes(String(planned.targetId)) || String(candidate?.id || "") === String(planned.targetId)) || null
      : null;
    const taken = actionEconomy.takePlannedAction(unit, slotIndex, { phase: "combat" });
    if (!taken) return { handled: false, reason: "planned_action_not_in_combat_phase", planned };
    const runtime = getRuntime({
      context: "combat",
      self: unit,
      target,
      defender: target,
      executePlannedAction: true,
      actionEconomy: actionEconomy.runtimeFor(unit, { phase: "combat" }),
      ...(context || {}),
    });
    const result = traitEngine.activateTrait(trait, runtime, state.traitState || (state.traitState = traitEngine.createState()));
    if (result?.available) {
      global.LuminousTraitPlayerTray?.syncActivationStatuses?.(result, runtime);
      handleTraitActivated(result, { trait, runtime });
    }
    return { handled: true, planned: taken, result };
  }''',
    'function executePlannedTraitAction(unit, slotIndex, context = {})'
)
replace_once(
    'js/player-trait-runtime.js',
    '''      engine.triggerEncounterStart = function (...args) {
        const result = originalEncounterStart.apply(this, args);
        dispatchCombatEvent("encounter_start", { context: "combat", self: currentCombatUnit() });
        return result;
      };''',
    '''      engine.triggerEncounterStart = function (...args) {
        const result = originalEncounterStart.apply(this, args);
        const unit = currentCombatUnit();
        global.LuminousActionEconomy?.beginCombat?.(unit);
        dispatchCombatEvent("encounter_start", { context: "combat", self: unit });
        return result;
      };'''
)
replace_once(
    'js/player-trait-runtime.js',
    '''        if (unit && phaseTag === "[Round Start]") {
          dispatchCombatEvent("turn_start", { context: "combat", self: unit, units: allUnits });''',
    '''        if (unit && phaseTag === "[Round Start]") {
          global.LuminousActionEconomy?.resetTurnResources?.(unit);
          dispatchCombatEvent("turn_start", { context: "combat", self: unit, units: allUnits });'''
)
replace_once(
    'js/player-trait-runtime.js',
    '''    dispatchCombatEvent,
    prepareTraitRuntime,
    recordCompletedTheatreCheck,''',
    '''    dispatchCombatEvent,
    prepareTraitRuntime,
    executePlannedTraitAction,
    recordCompletedTheatreCheck,'''
)

# ---------------------------------------------------------------------------
# CombatEngine: universal phase entry + Counter Reaction consumption.
# ---------------------------------------------------------------------------
replace_once(
    'js/combatEngine.js',
    '''    triggerEncounterStart: function() {
        this.currentState = 'COMBAT_ACTIVE';
        // Add additional logic if needed when planning ends
    },''',
    '''    beginPlanningPhase: function(allUnits = []) {
        this.currentState = 'PRE_COMBAT_PLANNING';
        const economy = (typeof globalThis !== 'undefined') ? globalThis.LuminousActionEconomy : null;
        if (economy && Array.isArray(allUnits)) allUnits.forEach(unit => economy.beginPlanning(unit));
        return this.currentState;
    },

    triggerEncounterStart: function(allUnits = []) {
        this.currentState = 'COMBAT_ACTIVE';
        const economy = (typeof globalThis !== 'undefined') ? globalThis.LuminousActionEconomy : null;
        if (economy && Array.isArray(allUnits)) allUnits.forEach(unit => economy.beginCombat(unit));
        // Add additional logic if needed when planning ends
    },

    resolveActionSlot: function(unit, slotIndex, context = {}) {
        const runtime = (typeof globalThis !== 'undefined') ? globalThis.LuminousPlayerTraitRuntime : null;
        if (runtime && typeof runtime.executePlannedTraitAction === 'function') {
            const result = runtime.executePlannedTraitAction(unit, slotIndex, context);
            if (result && result.handled) return result;
        }
        return { handled: false };
    },'''
)
replace_once(
    'js/combatEngine.js',
    '''        for (let unit of allUnits) {
            // Evaluacion de inmovilizacion (al inicio del round)
            if (phaseTag === '[Round Start]') {''',
    '''        for (let unit of allUnits) {
            // Universal Turn resources: Quick Action and Reaction are each 1 per Turn.
            if (phaseTag === '[Round Start]' && typeof globalThis !== 'undefined') {
                globalThis.LuminousActionEconomy?.resetTurnResources?.(unit);
            }
            // Evaluacion de inmovilizacion (al inicio del round)
            if (phaseTag === '[Round Start]') {'''
)
replace_once(
    'js/combatEngine.js',
    '''        if (!unitDefender.isStaggered) {
            result.pendingActions.push({
                type: 'counter',
                unit: unitDefender,
                target: unitAttacker,
                skill: counterSkill
            });
        }''',
    '''        if (counterSkill && !unitDefender.isStaggered) {
            const economy = (typeof globalThis !== 'undefined') ? globalThis.LuminousActionEconomy : null;
            const reactionAvailable = !economy || economy.consumeCounterReaction(unitDefender, counterSkill, { phase: this.currentState });
            if (reactionAvailable) {
                result.pendingActions.push({
                    type: 'counter',
                    unit: unitDefender,
                    target: unitAttacker,
                    skill: counterSkill
                });
            } else {
                result.attackLogs.push({ message: `${unitDefender.name || 'Defender'} cannot Counter: Reaction already spent.`, class: 'interrupt' });
                result.counterReactionBlocked = true;
            }
        }'''
)
replace_once(
    'js/combatEngine.js',
    '''    resolveStandardClash: function(unitA, skillA, unitB, skillB) {
        if (this.currentState === 'PRE_COMBAT_PLANNING') return { logs: [{ message: 'Clash blocked during Planning Phase.', class: 'error' }], clashWinner: null, damageResult: null };
        // [Unclashable bypass fallback]''',
    '''    resolveStandardClash: function(unitA, skillA, unitB, skillB) {
        if (this.currentState === 'PRE_COMBAT_PLANNING') return { logs: [{ message: 'Clash blocked during Planning Phase.', class: 'error' }], clashWinner: null, damageResult: null };
        const actionEconomy = (typeof globalThis !== 'undefined') ? globalThis.LuminousActionEconomy : null;
        if (actionEconomy) {
            const counterA = actionEconomy.isCounterSkill(skillA);
            const counterB = actionEconomy.isCounterSkill(skillB);
            const blockedA = counterA && !actionEconomy.consumeCounterReaction(unitA, skillA, { phase: this.currentState });
            const blockedB = counterB && !actionEconomy.consumeCounterReaction(unitB, skillB, { phase: this.currentState });
            if (blockedA || blockedB) {
                return {
                    winner: blockedA && blockedB ? 'Tie' : (blockedA ? 'B' : 'A'),
                    clashLogs: [{ note: 'Counter Reaction unavailable.', blockedA, blockedB }],
                    pendingActions: [],
                    reactionBlocked: true,
                    blockedA,
                    blockedB,
                };
            }
        }
        // [Unclashable bypass fallback]'''
)

# ---------------------------------------------------------------------------
# Cold Fury: ClashableCounter inherits Counter Power from the same subtype.
# ---------------------------------------------------------------------------
replace_once(
    'js/racial-trait-catalog.js',
    '''    yuan_ti_cold_fury: passiveModifier("yuan_ti_cold_fury", "Cold Fury", "yuan_ti_pureblood", "counter_power", 4, {
      description: "Counter Skills gain +4 Counter Power.",
      conditions: [{ path: "skill.type", operator: "eq", value: "counter" }],
    }),''',
    '''    yuan_ti_cold_fury: passiveModifier("yuan_ti_cold_fury", "Cold Fury", "yuan_ti_pureblood", "counter_power", 4, {
      description: "Counter and ClashableCounter Skills gain +4 Counter Power.",
      conditions: [{ path: "skill.defense_subtype", operator: "in", value: ["counter", "clashablecounter", "clashable_counter"] }],
    }),'''
)

print('Universal action economy integration applied successfully.')
