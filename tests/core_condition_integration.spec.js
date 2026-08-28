const { test, expect } = require('@playwright/test');

function snapshotGlobals(keys) {
  return Object.fromEntries(keys.map((key) => [key, global[key]]));
}

function restoreGlobals(snapshot) {
  Object.entries(snapshot).forEach(([key, value]) => {
    if (value === undefined) delete global[key];
    else global[key] = value;
  });
}

test('condition combat bridge enforces phases, saves, poison damage, targeting, action gates, and Grapple slots', () => {
  const keys = ['CombatEngine', 'LuminousConditionRuntime', 'LuminousConditionCombatBridge', 'LuminousStatusEngine', 'LuminousActionEconomy', 'CustomEvent', 'dispatchEvent', 'LuminousSpellcastingRuntime'];
  const previous = snapshotGlobals(keys);
  const events = [];
  const phases = [];
  try {
    delete require.cache[require.resolve('../js/core-condition-combat-bridge.js')];
    delete require.cache[require.resolve('../js/universal-action-economy.js')];
    delete global.LuminousConditionCombatBridge;
    delete global.LuminousActionEconomy;
    global.CustomEvent = class CustomEvent { constructor(name, init) { this.type = name; this.detail = init?.detail; } };
    global.dispatchEvent = (event) => { events.push(event); return true; };
    global.LuminousStatusEngine = { advanceDurations: () => [] };
    global.LuminousConditionRuntime = {
      turnStart(unit, options) {
        phases.push(`start:${unit.id}`);
        if (unit.invisible) options.resolvePerceptionChecks({ initiator: unit, targets: options.units });
        return [{ type: 'start' }];
      },
      turnEnd(unit, options) {
        phases.push(`end:${unit.id}`);
        const result = options.resolveCheck({ type: 'save_check', unit, check: { kind: 'save', abilityId: 'con', threshold: 10 } });
        return [{ type: 'save', result }];
      },
      poisonDamageMultiplier(unit) { return unit.petrified ? 0 : (unit.poisoned ? 1.5 : 1); },
      actionAvailability(unit) { return unit.actionBlocked ? { available: false, reason: 'blocked_action' } : { available: true }; },
      canTarget(unit, target) { return target?.conditionBlocked ? { allowed: false, reason: 'blocked_target' } : { allowed: true }; },
      canUseUniversalAction(unit) { return unit.actionBlocked ? { available: false, reason: 'blocked_action' } : { available: true }; },
      onActionUsed() { return []; },
      grapple(unitA, unitB, options) {
        const opposed = options.resolveOpposedCheck();
        return { applied: opposed.unitBPassed === false, unitA: unitA.id, unitB: unitB.id, opposed };
      },
    };
    global.CombatEngine = {
      currentState: 'COMBAT_ACTIVE',
      triggerPhase(tag) { return tag; },
      applyDamage(unit, damage) { unit.hp -= damage; return { hp: unit.hp, shield: unit.shield || 0 }; },
      autoTarget(attacker, skill, enemies) { return enemies[0] || null; },
      calculateAoETargets(skill, primary, all) { return [primary, ...all.filter((unit) => unit !== primary)]; },
      resolveUnilateralWithCounter() { return { resolved: true }; },
      resolveStandardClash() { return { resolved: true }; },
      resolveActionSlot() { return { handled: false }; },
      getCoinProbability() { return 100; },
    };

    const economy = require('../js/universal-action-economy.js');
    const bridge = require('../js/core-condition-combat-bridge.js');
    expect(bridge.install()).toBe(true);

    const source = { id: 'source', spellDC: 14 };
    const victim = { id: 'victim', stats: { constitucion: 10 }, hp: 20 };
    const sourceDcSave = bridge.resolveConditionCheck(global.CombatEngine, {
      type: 'save_check', unit: victim, sourceUnitId: 'source', check: { kind: 'save', abilityId: 'con', threshold: NaN },
    }, [source, victim], { rng: () => 0 });
    expect(sourceDcSave.threshold).toBe(14);
    expect(sourceDcSave.passed).toBe(true);

    const units = [{ id: 'a', hp: 20, invisible: true }, { id: 'b', hp: 20 }];
    expect(global.CombatEngine.triggerPhase('[Round Start]', units)).toBe('[Round Start]');
    global.CombatEngine.triggerPhase('[Round End]', units);
    expect(phases).toEqual(['start:a', 'start:b', 'end:a', 'end:b']);
    expect(events.some((event) => event.type === 'luminous:condition-turn-start-resolved')).toBe(true);
    expect(events.some((event) => event.type === 'luminous:condition-turn-end-resolved')).toBe(true);

    const poisoned = { hp: 30, poisoned: true };
    const poisonResult = global.CombatEngine.applyDamage(poisoned, 10, 'poison');
    expect(poisoned.hp).toBe(15);
    expect(poisonResult.conditionDamageMultiplier).toBe(1.5);

    const petrified = { hp: 30, petrified: true };
    const immuneResult = global.CombatEngine.applyDamage(petrified, 10, 'directo', false, { damageType: 'Poison' });
    expect(petrified.hp).toBe(30);
    expect(immuneResult.conditionDamageMultiplier).toBe(0);

    const blocked = { id: 'blocked', conditionBlocked: true, hp: 10, actionSlots: 1 };
    const allowed = { id: 'allowed', hp: 10, actionSlots: 1 };
    expect(global.CombatEngine.autoTarget({}, {}, [blocked, allowed])).toBe(allowed);
    expect(global.CombatEngine.calculateAoETargets({}, blocked, [blocked, allowed], {})).toEqual([]);
    expect(global.CombatEngine.calculateAoETargets({}, allowed, [blocked, allowed], {})).toEqual([allowed]);

    const blockedAttack = global.CombatEngine.resolveUnilateralWithCounter({}, {}, blocked, null, {});
    expect(blockedAttack.conditionBlocked).toBe(true);
    expect(blockedAttack.reason).toBe('blocked_target');

    const actionBlocked = { id: 'actor', actionBlocked: true };
    const slot = global.CombatEngine.resolveActionSlot(actionBlocked, 0, {});
    expect(slot.conditionBlocked).toBe(true);
    expect(slot.reason).toBe('blocked_action');

    const grappler = { id: 'grappler', actionSlots: 1, stats: { fuerza: 14 }, hp: 20 };
    const held = { id: 'held', actionSlots: 1, stats: { fuerza: 10 }, hp: 20 };
    economy.beginPlanning(grappler);
    const scheduled = economy.scheduleGrapple(grappler, held, { phase: 'planning' });
    expect(scheduled.scheduled).toBe(true);
    expect(scheduled.slotIndex).toBe(0);
    expect(scheduled.entry.kind).toBe('universal_action');
    expect(scheduled.entry.sourceId).toBe('grapple');
    expect(scheduled.entry.targetId).toBe('held');
    expect(economy.snapshot(grappler, { phase: 'planning' }).action).toBe(0);

    const resolvedGrapple = global.CombatEngine.resolveActionSlot(grappler, 0, {
      plannedAction: scheduled.entry,
      combatData: { grappler, held },
      rng: () => 0,
    });
    expect(resolvedGrapple.handled).toBe(true);
    expect(resolvedGrapple.result.applied).toBe(true);
    expect(resolvedGrapple.opposed.unitATotal).toBeGreaterThan(resolvedGrapple.opposed.unitBTotal);
  } finally {
    restoreGlobals(previous);
    delete require.cache[require.resolve('../js/core-condition-combat-bridge.js')];
    delete require.cache[require.resolve('../js/universal-action-economy.js')];
  }
});

test('condition theatre bridge injects the real roll spec before arming a Check', () => {
  const keys = ['document', 'datosJugador', 'combatData', 'LuminousPlayerTraitRuntime', 'LuminousConditionRuntime', 'LuminousConditionTheatreBridge', 'LuminousTheatreCheckCoordinator', 'LuminousTheatreRolls'];
  const previous = snapshotGlobals(keys);
  let captured = null;
  try {
    delete require.cache[require.resolve('../js/core-condition-theatre-bridge.js')];
    delete global.LuminousConditionTheatreBridge;
    global.datosJugador = { id: 'player', statusEffects: { blinded: { count: 1 } } };
    global.combatData = {};
    global.LuminousConditionRuntime = {
      sameUnit(a, b) { return a === b || a?.id === b?.id; },
      applyCheckThreshold(unit, check) {
        const modifier = check.skillId === 'perception' ? 99 : 0;
        check.thresholdRaw = Number(check.thresholdRaw) + modifier;
        return { check, modifier };
      },
    };
    global.LuminousTheatreCheckCoordinator = {
      ABILITIES: [{ id: 'wis', name: 'WISDOM', skills: [{ id: 'perception', name: 'Perception' }] }],
    };
    global.document = {
      querySelector(selector) {
        if (selector.includes('player-ability-console')) return { dataset: { activeStat: 'wis' } };
        if (selector === '#theatre-check-command-prompt strong') return { textContent: 'Perception' };
        return null;
      },
    };
    global.LuminousTheatreRolls = Object.freeze({
      armCheck(check) { captured = { ...check }; return { ...check }; },
      clearArmedCheck() {},
    });

    const bridge = require('../js/core-condition-theatre-bridge.js');
    expect(bridge.install()).toBe(true);
    const result = global.LuminousTheatreRolls.armCheck({ thresholdRaw: 10, hiddenThreshold: false });
    expect(captured.kind).toBe('skill');
    expect(captured.abilityId).toBe('wis');
    expect(captured.skillId).toBe('perception');
    expect(captured.thresholdRaw).toBe(109);
    expect(result.thresholdRaw).toBe(109);
  } finally {
    restoreGlobals(previous);
    delete require.cache[require.resolve('../js/core-condition-theatre-bridge.js')];
  }
});

test('status engine loads both condition integration bridges', () => {
  const fs = require('fs');
  const source = fs.readFileSync(require.resolve('../js/status-engine.js'), 'utf8');
  expect(source).toContain('core-condition-combat-bridge.js');
  expect(source).toContain('core-condition-theatre-bridge.js');
});
