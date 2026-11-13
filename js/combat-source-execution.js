/* Shared preparation for human and AI actions. No presentation or random draws. */
(function (global) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const norm = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  const safe = path => { try { return typeof require === 'function' ? require(path) : null; } catch (_) { return null; } };
  const adapter = () => { if (!global.LuminousBattleViewerSpellAdapter074) safe('./battle-viewer-spell-adapter-074.js'); return global.LuminousBattleViewerSpellAdapter074; };
  const triggers = { on_use: '[On Use]', on_hit: '[On Hit]', on_failed_save: '[On Save Fail]', turn_start: '[Turn Start]', on_crit: '[On Crit]' };

  function prepare(actor, raw = {}, options = {}) {
    const id = raw.spellId || raw.id;
    // Always start from an unmaterialized definition; reopening a menu or
    // hydrating a sealed plan must not add Power or status effects twice.
    const catalog = global.LuminousSpellCatalog;
    const source = catalog?.[id] || raw.preparedSpellSource || raw;
    const spell = { ...copy(source), ...(raw.castAbilityId ? { castAbilityId: raw.castAbilityId } : {}) }, choice = { ...(raw.choice || {}), ...(options.choice || {}) };
    const request = spell.mechanics?.requiresChoice;
    if (request?.key) {
      let value = options[request.key] ?? choice[request.key] ?? raw[request.key];
      if (request.key === 'element') value ??= raw.selectedElement;
      if (value == null && options.isAi === true) {
        // Use a declared preference when valid, otherwise a stable legal choice.
        // AI does not read hidden enemy resistances or consume combat RNG here.
        const preferred = actor.ai?.spellChoices?.[id]?.[request.key];
        value = request.values?.includes(preferred) ? preferred : request.values?.[0];
      }
      if (!request.values?.includes(value)) return { ok: false, reason: 'spell_choice_required', choiceKey: request.key };
      choice[request.key] = value;
    }
    const classes = actor.classes || actor.characterBuild?.classes || [];
    const castingClass = classes.find(row => spell.classIds?.includes(row.classId || row.id));
    const resolved = global.LuminousCombatSpellLoadout074?.resolveSpellForCombatant?.(actor, id);
    const classId = options.classId || raw.sourceClassId || raw.classId || (resolved?.ok ? resolved.classId : '') || castingClass?.classId || castingClass?.id || '';
    const slotLevel = Math.max(Number(spell.level ?? spell.spellLevel) || 0, Math.trunc(Number(options.slotLevel ?? raw.slotLevel) || 0));
    if (slotLevel > 9) return { ok: false, reason: 'spell_slot_level_invalid' };
    const materializer = adapter();
    if (!materializer?.materializeSpell) return { ok: false, reason: 'spell_runtime_unavailable' };
    const result = materializer.materializeSpell(actor, classId, spell, slotLevel, { ...options, choice, element: choice.element });
    if (!result.ok) return result;
    const definition = { ...copy(raw), ...result.definition, classId, sourceClassId: classId, choice, kind: 'spell', sourceType: 'magic' };
    if (!catalog?.[id]) definition.preparedSpellSource = copy(source);
    definition.coinAmount = Number(definition.coinAmount ?? (Array.isArray(definition.coins) ? definition.coins.length : definition.coins)) || 0;
    if (definition.save) definition.save = { ...definition.save, ability: definition.save.ability || definition.save.abilityId, threshold: definition.save.threshold ?? result.spellDC };
    return { ...result, definition, choice, classId, slotLevel };
  }

  function nativeDefinition(actor, raw, options = {}) {
    const result = prepare(actor, raw, options);
    if (!result.ok) return result;
    const definition = copy(result.definition);
    if (definition.targetType === 'self' || definition.targetingType === 'self') definition.targetSide = 'self';
    else if (definition.targetType === 'allies' || definition.targetAlly) definition.targetSide = 'ally';
    const mechanics = definition.mechanics || {};
    const levelStatus = mechanics.onHitLevelStatus;
    if (levelStatus?.status) {
      const amount = (Number(levelStatus.base) || 0) + Math.floor(definition.materializedAtLevel / Math.max(1, Number(levelStatus.every) || 20));
      definition.effects.push({ trigger: 'on_hit', type: 'status', status: levelStatus.status,
        potency: levelStatus.potencyAndCount || levelStatus.mode === 'potency' ? amount : 0,
        count: levelStatus.potencyAndCount || levelStatus.mode !== 'potency' ? amount : 0 });
    }
    if (mechanics.onHitStatusFromSlot?.status) {
      const status = mechanics.onHitStatusFromSlot, base = Number(status.base) || 0;
      definition.effects.push({ trigger: 'on_hit', type: 'status', status: status.status,
        potency: base + result.slotLevel * (Number(status.potencyPerSlot) || 0),
        count: base + result.slotLevel * (Number(status.countPerSlot) || 0) });
    }
    if (definition.upcast?.finalPowerPerLevel) definition.basePower = (Number(definition.basePower) || 0) + result.extraLevels * definition.upcast.finalPowerPerLevel;
    definition.effects = definition.effects.map(effect => ({ ...effect, trigger: triggers[norm(effect.trigger)] || effect.trigger,
      sourceElement: effect.element || definition.element || effect.sourceElement }));
    if (definition.concentration) definition.effects = definition.effects.map(effect =>
      norm(effect.trigger) === 'on_save_fail' ? { ...effect, durationType: 'concentration' } : effect);
    if (definition.save && !definition.coinAmount) {
      definition.saveOnly = true;
      definition.failedSaveEffects = definition.effects.filter(effect => norm(effect.trigger) === 'on_save_fail');
    }
    return { ...result, definition };
  }

  function nextOrbTarget(entry, targetId, critical, units, isTargetable) {
    const data = entry.plan?.data;
    if (!critical || !data?.mechanics?.onCritJump) return null;
    const state = entry.plan.chromaticOrbState ||= { visited: [targetId], jumps: 0 };
    if (!state.visited.includes(targetId)) state.visited.push(targetId);
    if (state.jumps >= Math.max(1, Number(data.slotLevel) || 1)) return null;
    const actor = units[entry.ownerId];
    const next = Object.values(units).filter(unit => unit && unit.id !== entry.ownerId && unit.faction !== actor?.faction &&
      !state.visited.includes(unit.id) && isTargetable(unit)).sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    if (!next) return null;
    state.visited.push(next.id); state.jumps++;
    return next.id;
  }

  function useEffects(actor, plan, units) {
    const data = plan.data, compiler = global.LuminousBattleViewerActionAdapter073;
    if (!compiler?.compilePlan) return data.coinAmount > 0 ? { ok: true, effects: [] } : { ok: false, reason: 'spell_effect_runtime_unavailable' };
    const compiled = compiler.compilePlan(`${actor.id}_slot_${plan.sourceSlotIndex || 0}`, null, {
      ...plan, type: 'spell', spellId: data.spellId || data.id, classId: data.classId,
      slotLevel: data.slotLevel, choice: data.choice, element: data.element,
    });
    if (!compiled?.action) return data.coinAmount > 0 ? { ok: true, effects: [] } : { ok: false, reason: compiled?.reason || 'spell_effect_runtime_unavailable' };
    const action = compiled.action, handlers = global.LuminousBattleViewerCombatHooks073?.effectHandlers || {};
    const effects = action.effects.filter(effect => !['status', 'heal_hp', 'heal_sp', 'damage'].includes(effect.type) &&
      (!effect.trigger || ['on_use', 'on_combat_start'].includes(norm(effect.trigger))));
    if (!data.coinAmount && !data.effects?.length && !effects.some(effect => effect.type !== 'viewer_spell_cast'))
      return { ok: false, reason: 'spell_effect_runtime_unavailable' };
    const missing = effects.find(effect => !handlers[effect.type]);
    if (missing) return { ok: false, reason: 'spell_effect_handler_unavailable:' + missing.type };
    return { ok: true, effects, action, apply() {
      const target = units[plan.targetId] || actor;
      return effects.map(effect => handlers[effect.type]({ action, actor, targets: [target], effect,
        context: { combatData: units, units: Object.values(units), engine: global.CombatEngine } }));
    } };
  }

  function resourceGate(actor, data) {
    if (!data || data.kind !== 'spell' || data.cantrip || Number(data.slotLevel ?? data.level) === 0) return { available: true };
    const runtime = global.LuminousSpellcastingRuntime;
    if (!runtime?.canSpendSpellSlot) return { available: false, reason: 'spell_slot_runtime_unavailable' };
    const classId = data.overcast ? '__overcast__' + data.classId : data.classId;
    try { return runtime.canSpendSpellSlot(actor, classId, data.slotLevel); }
    catch (_) { return { available: false, reason: 'spell_slot_unavailable' }; }
  }
  function spend(actor, plan, round) {
    if (plan.spellSpentRound === round) return { consumed: true };
    const data = plan.data, gate = resourceGate(actor, data);
    if (!gate.available) return { consumed: false, reason: gate.reason };
    if (data.kind === 'spell' && !data.cantrip && Number(data.slotLevel ?? data.level) > 0) {
      const result = global.LuminousSpellcastingRuntime.spendSpellSlot(actor, data.overcast ? '__overcast__' + data.classId : data.classId, data.slotLevel);
      if (!result || result.available === false || result?.consumed === false || result?.success === false || !(Number(result.spent) > 0)) return { consumed: false, reason: result.reason };
    }
    plan.spellSpentRound = round;
    return { consumed: true };
  }
  const api = Object.freeze({ prepare, nativeDefinition, nextOrbTarget, resourceGate, spend, useEffects });
  global.LuminousCombatSourceExecution = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
