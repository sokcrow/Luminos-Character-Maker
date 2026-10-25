/**
 * Unit-scoped Universal Action phase policy (foundation only).
 * This has NO UI, Firebase, ownership or effect-resolution authority.
 * The authoritative encounter runner must call it atomically with its budgets.
 * The JSON ledger is attached to Unit and may travel with its state snapshot.
 */
(function (global) {
  'use strict';
  if (global.LuminousUnitUniversalActionPolicy) {
    if (typeof module !== 'undefined' && module.exports) module.exports = global.LuminousUnitUniversalActionPolicy;
    return;
  }
  const STORE = 'universalActionPhaseLedger';
  const PHASES = Object.freeze({ PLANNING: 'planning', COMBAT: 'combat_phase', TURN_END: 'on_turn_end', QUICK: 'quick_action' });
  const DEFINITIONS = Object.freeze({
    analyse: Object.freeze({ phase: PHASES.PLANNING, cost: 'free', timing: 'immediate' }),
    find: Object.freeze({ phase: PHASES.PLANNING, cost: 'free', timing: 'immediate' }),
    help: Object.freeze({ phase: PHASES.COMBAT, cost: 'action', timing: 'speed_order', timingRatified: false }),
    grapple: Object.freeze({ phase: PHASES.COMBAT, cost: 'action', timing: 'speed_order' }),
    calm: Object.freeze({ phase: PHASES.COMBAT, cost: 'action', timing: 'speed_order' }),
    liberate: Object.freeze({ phase: PHASES.COMBAT, cost: 'action', timing: 'speed_order' }),
    wake_up: Object.freeze({ phase: PHASES.TURN_END, cost: 'action', timing: 'turn_end' }),
    retreat: Object.freeze({ phase: PHASES.TURN_END, cost: 'action', timing: 'turn_end' }),
    escape: Object.freeze({ phase: PHASES.TURN_END, cost: 'action', timing: 'turn_end' }),
  });
  const ALIASES = Object.freeze({ wakeup: 'wake_up', observation: 'analyse', liberate_sleight_of_hand: 'liberate', liberate_strength: 'liberate', liberate_athletics: 'liberate' });
  const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const keyFor = value => ALIASES[normalize(value)] || normalize(value);
  const definitionFor = key => DEFINITIONS[keyFor(key)] || null;
  const clone = value => JSON.parse(JSON.stringify(value));
  const roundOf = options => Math.trunc(Number(options?.round ?? options?.turn));
  const validRound = round => Number.isSafeInteger(round) && round >= 1;
  const unitObject = unit => unit && typeof unit === 'object' && !Array.isArray(unit);
  const slotOf = options => options?.slotId == null ? '' : String(options.slotId).trim();
  const targetOf = options => options?.targetId == null ? '' : String(options.targetId).trim();
  const helpSlotOf = options => String(options?.targetHelpActionSlotId ?? options?.targetActionSlotId ?? '').trim();
  const reservationIdOf = options => String(options?.reservationId ?? options?.intentId ?? '').trim();
  const record = value => unitObject(value) ? value : {};
  const fail = reason => ({ ok: false, reason });
  const success = (additional = {}) => ({ ok: true, ...additional });

  function ledgerFor(unit, round) {
    if (!unitObject(unit)) return null;
    let ledger = unit[STORE];
    if (ledger && Number(ledger.round) > round) return null; // fail closed on stale intents
    if (!ledger || Number(ledger.round) !== round) {
      ledger = { round, reserved: {}, spent: {}, helpTargets: [], reservations: {}, serial: 0 };
      unit[STORE] = ledger;
    }
    ledger.reserved=record(ledger.reserved);ledger.spent=record(ledger.spent);ledger.reservations=record(ledger.reservations);
    ledger.helpTargets=[...new Set(Object.values(ledger.helpTargets||{}).filter(value=>typeof value==='string'))];
    ledger.serial=Math.max(0,Math.trunc(Number(ledger.serial)||0));
    return ledger;
  }

  function hasMastermindQuickHelp(unit) {
    // A client-supplied boolean is never proof of a canonical Class Trait.
    return global.LuminousMastermindArchetypeRuntime?.hasMastermindLevel?.(unit, 15) === true;
  }

  function check(unit, actionKey, options = {}) {
    if (!unitObject(unit)) return fail('unit_required');
    const round = roundOf(options);
    if (!validRound(round)) return fail('round_required');
    const action = keyFor(actionKey), definition = definitionFor(action);
    if (!definition) return fail('unknown_universal_action');
    const ledger = ledgerFor(unit, round);
    if (!ledger) return fail('stale_round');
    if (options.variant === 'mastermind_quick') {
      if (action !== 'help' || !hasMastermindQuickHelp(unit)) return fail('mastermind_trait_required');
      if (ledger.spent.mastermind_quick_help) return fail('mastermind_quick_help_spent');
      const targetId = targetOf(options);
      if (!targetId) return fail('help_target_required');
      if(!helpSlotOf(options))return fail('help_target_slot_required');
      if (ledger.helpTargets.includes(targetId) ||
          (ledger.reserved[PHASES.COMBAT]?.actionKey === 'help' &&
           ledger.reserved[PHASES.COMBAT]?.targetId === targetId)) return fail('help_target_already_assisted');
      return success({ phase: PHASES.QUICK, cost: 'quick_action', timing: 'immediate', requiresExternalQuickBudget: true });
    }
    if (options.variant) return fail('unknown_variant');
    if (ledger.spent[action]) return fail('universal_action_spent');
    if (action === 'help') {
      const targetId = targetOf(options);
      if (!targetId) return fail('help_target_required');
      if(!helpSlotOf(options))return fail('help_target_slot_required');
      if (ledger.helpTargets.includes(targetId)) return fail('help_target_already_assisted');
    }
    if (definition.phase !== PHASES.PLANNING) {
      if (!slotOf(options)) return fail('action_slot_required');
      if (ledger.reserved[definition.phase]) return fail('universal_phase_reserved');
      if (ledger.spent['phase:' + definition.phase]) return fail('universal_phase_spent');
      const occupied = Object.values(ledger.reserved).some(row => row.slotId === slotOf(options));
      if (occupied) return fail('slot_already_reserved');
    }
    return success({ ...definition, actionKey: action });
  }

  function reserve(unit, actionKey, options = {}) {
    const gate = check(unit, actionKey, options);
    if (!gate.ok) return gate;
    if (gate.cost !== 'action') return fail('instant_action_cannot_reserve');
    const ledger = ledgerFor(unit, roundOf(options));
    const requested=reservationIdOf(options);
    if(requested&&!/^[a-zA-Z0-9:_-]{1,200}$/.test(requested))return fail('invalid_reservation_id');
    if(requested&&(ledger.reservations[requested]||Object.values(ledger.reserved).some(row=>row.reservationId===requested)))return fail('reservation_id_reused');
    const entry = { actionKey:gate.actionKey,phase:gate.phase,slotId:slotOf(options),targetId:targetOf(options)||null,reservationId:requested||`reservation:${roundOf(options)}:${++ledger.serial}`,
      ...(gate.actionKey==='help'?{targetActionSlotId:helpSlotOf(options),targetActionId:String(options.targetActionId??'').trim()||null}:{}) };
    ledger.reserved[gate.phase] = entry;
    return success({ reservation: clone(entry) });
  }

  function cancel(unit, options = {}) {
    const round = roundOf(options);
    if (!unitObject(unit) || !validRound(round)) return fail('unit_and_round_required');
    const ledger = ledgerFor(unit, round);
    if (!ledger) return fail('stale_round');
    const phase = normalize(options.phase), entry = ledger.reserved[phase];
    if (!entry) return fail('reservation_missing');
    if (slotOf(options) !== entry.slotId) return fail('slot_mismatch');
    if(!reservationIdOf(options)||reservationIdOf(options)!==entry.reservationId)return fail('reservation_mismatch');
    ledger.reservations[entry.reservationId]='cancelled';
    delete ledger.reserved[phase];
    return success({ cancelled: clone(entry) });
  }

  function commit(unit, options = {}) {
    const round = roundOf(options);
    if (!unitObject(unit) || !validRound(round)) return fail('unit_and_round_required');
    const ledger = ledgerFor(unit, round);
    if (!ledger) return fail('stale_round');
    const phase = normalize(options.phase), entry = ledger.reserved[phase];
    if (!entry) return fail('reservation_missing');
    if (entry.slotId !== slotOf(options)) return fail('slot_mismatch');
    if(!reservationIdOf(options)||reservationIdOf(options)!==entry.reservationId)return fail('reservation_mismatch');
    if (ledger.spent[entry.actionKey] || ledger.spent['phase:' + phase]) return fail('already_spent');
    ledger.spent[entry.actionKey] = true;
    ledger.spent['phase:' + phase] = true;
    ledger.reservations[entry.reservationId]='committed';
    if (entry.actionKey === 'help' && entry.targetId) ledger.helpTargets.push(entry.targetId);
    delete ledger.reserved[phase];
    return success({ committed: clone(entry) });
  }

  function useInstant(unit, actionKey, options = {}) {
    const gate = check(unit, actionKey, options);
    if (!gate.ok) return gate;
    if (gate.cost !== 'free' && !(options.variant === 'mastermind_quick' && gate.cost === 'quick_action')) {
      return fail('slot_action_requires_reservation');
    }
    // External Quick budget + effect + this ledger transition MUST be atomic
    // in the authority. UI callers may never commit state directly.
    const ledger = ledgerFor(unit, roundOf(options)), action = keyFor(actionKey);
    if (options.variant === 'mastermind_quick') {
      ledger.spent.mastermind_quick_help = true;
      ledger.helpTargets.push(targetOf(options));
    } else ledger.spent[action] = true;
    return success({ actionKey: action, phase: gate.phase, cost: gate.cost,
      ...(action==='help'?{targetId:targetOf(options),targetActionSlotId:helpSlotOf(options),targetActionId:String(options.targetActionId??'').trim()||null}:{}),requiresExternalQuickBudget: Boolean(gate.requiresExternalQuickBudget) });
  }

  function snapshot(unit, options = {}) {
    const round = roundOf(options);
    if (!unitObject(unit) || !validRound(round)) return fail('unit_and_round_required');
    const ledger = ledgerFor(unit, round);
    return ledger ? success({ ledger: clone(ledger) }) : fail('stale_round');
  }

  const api = Object.freeze({ STORE, PHASES, DEFINITIONS, keyFor, definitionFor, check, reserve, cancel, commit, useInstant, snapshot, hasMastermindQuickHelp });
  global.LuminousUnitUniversalActionPolicy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
