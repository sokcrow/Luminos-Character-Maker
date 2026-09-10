(function (global) {
  'use strict';

  const normalizeId = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const MEANING = Object.freeze({
    id: 'wolf_meaning',
    name: 'Meaning',
    type: 'passive',
    description: "Can't be targeted by Units below 0 SP.",
    mechanics: Object.freeze({ targetRestriction: true, attackerSpBelow: 0 }),
  });

  const HUNTING_HOWLING = Object.freeze({
    id: 'hunting_howling',
    name: 'Hunting Howling',
    type: 'quick_action',
    description: 'Quick Action. All deployed allied Wolves recover 5 SP and gain 1 Attack Power Up. Once per Encounter, add 3 Wolf Backup Units.',
    mechanics: Object.freeze({
      economy: 'quick_action', spRecovery: 5, attackPowerUp: 1,
      backupUnitId: 'wolf', backupAmount: 3, backupLimit: 'once_per_encounter',
      wolfRequiredRank: 'captain', direWolfRequiredRank: 'leader',
    }),
  });

  function unitTemplateId(unit = {}) {
    return normalizeId(unit.catalogId ?? unit.templateId ?? unit.unitId ?? unit.id ?? unit.species);
  }
  function isWolf(unit = {}) {
    const id = unitTemplateId(unit);
    if (id === 'wolf' || id === 'dire_wolf') return true;
    const species = normalizeId(unit.species ?? unit.raceId);
    return species === 'wolf' || species === 'dire_wolf';
  }
  function isDireWolf(unit = {}) { return unitTemplateId(unit) === 'dire_wolf' || normalizeId(unit.species) === 'dire_wolf'; }
  function sameSide(a = {}, b = {}) {
    const af = normalizeId(a.faction ?? a.faccion ?? a.side ?? a.team);
    const bf = normalizeId(b.faction ?? b.faccion ?? b.side ?? b.team);
    return Boolean(af && bf && af === bf);
  }
  function isDeployed(unit = {}) {
    if (!unit || unit.hp === 0 || unit.dead === true || unit.removed === true || unit.retreated === true || unit.escaped === true || unit.isBackup === true) return false;
    const state = normalizeId(unit.deploymentState ?? unit.deployment ?? unit.positionState ?? unit.zone ?? 'field');
    return !['backup', 'reserve', 'reserves', 'retreated', 'escaped', 'removed', 'dead'].includes(state);
  }
  function spOf(unit = {}) { return numberOr(unit.sp ?? unit.currentSp ?? unit.currentSP, 0); }
  function rankOf(unit = {}) { return normalizeId(unit.rank ?? unit.mechanics?.rank ?? unit.unitRank ?? 'normal'); }

  function canTarget(attacker, target) {
    if (isWolf(target) && spOf(attacker) < 0) return { allowed: false, reason: 'wolf_meaning_negative_sp', traitId: MEANING.id };
    return { allowed: true, reason: null, traitId: isWolf(target) ? MEANING.id : null };
  }

  function statusEngine() {
    if (global.LuminousStatusEngine) return global.LuminousStatusEngine;
    if (typeof require === 'function') {
      try { return require('./status-engine.js'); } catch (_) {}
    }
    return null;
  }
  function actionEconomy() {
    if (global.LuminousActionEconomy) return global.LuminousActionEconomy;
    if (typeof require === 'function') {
      try { return require('./universal-action-economy.js'); } catch (_) {}
    }
    return null;
  }

  function statusComponent(unit, statusId, component = null) {
    const id = normalizeId(statusId);
    const entry = unit?.statusEffects?.[id] ?? unit?.statuses?.[id] ?? null;
    if (entry == null) return 0;
    if (typeof entry === 'number') return numberOr(entry, 0);
    const key = normalizeId(component);
    if (key === 'count') return numberOr(entry.count, 0);
    if (key === 'potency') return numberOr(entry.potency, 0);
    return numberOr(entry.potency ?? entry.count ?? entry.value, 0);
  }
  function conditionPasses(condition, context = {}) {
    if (!condition) return true;
    const targetKey = normalizeId(condition.target || 'target');
    const unit = targetKey === 'self'
      ? (context.attacker || context.self || context.unit)
      : (context.currentTarget || context.target || context.defender);
    if (!unit) return false;
    const actual = statusComponent(unit, condition.stat, condition.component);
    const expected = numberOr(condition.value, 0);
    const op = String(condition.operator || '=').trim();
    if (op === '<') return actual < expected;
    if (op === '<=') return actual <= expected;
    if (op === '>=') return actual >= expected;
    if (op === '>') return actual > expected;
    return actual === expected;
  }

  function applyStatusDescriptor(effect, context = {}) {
    if (!effect || effect.type !== 'status' || typeof effect.execute === 'function') return null;
    if (!conditionPasses(effect.condition, context)) return null;
    const target = normalizeId(effect.target || 'target') === 'self'
      ? (context.attacker || context.self || context.unit)
      : (context.currentTarget || context.target || context.defender);
    if (!target) return null;
    return statusEngine()?.applyStatus?.(target, effect.status, {
      mode: 'gain', potency: numberOr(effect.potency, 0), count: numberOr(effect.count, 0),
      sourceUnitId: context.attacker?.id || context.attacker?.unitId || null,
      data: { sourceSkillId: context.skill?.id || null, wolfConditionalEffect: Boolean(effect.condition) },
    }) || null;
  }

  function tagMatches(effect, tag) { return normalizeId(effect?.trigger) === normalizeId(tag); }
  function isWolfManagedSkill(skill = {}) { return skill?.metadata?.wolfRuntimeManagedStatusEffects === true; }
  function applyManagedSkillEffects(tag, context = {}, targetsHit = []) {
    const skill = context.skill;
    if (!isWolfManagedSkill(skill) || normalizeId(tag) !== 'on_hit') return [];
    const effects = [
      ...asArray(skill.effects).filter((effect) => tagMatches(effect, tag)),
      ...asArray(context.currentCoin?.effects).filter((effect) => tagMatches(effect, tag)),
    ];
    if (!effects.length) return [];
    const targets = asArray(targetsHit).length ? asArray(targetsHit) : [context.currentTarget || context.defender].filter(Boolean);
    const applied = [];
    targets.forEach((target) => {
      const local = { ...context, currentTarget: target, target, defender: context.defender || target };
      effects.forEach((effect) => {
        const result = applyStatusDescriptor(effect, local);
        if (result) applied.push({ target, effect, result });
      });
    });
    return applied;
  }

  function finalPowerConditionPasses(skill = {}, target = {}) {
    const rule = skill?.metadata?.wolfFinalPowerIf;
    const all = asArray(rule?.all);
    return Boolean(rule && all.length && all.every((entry) => conditionPasses(entry, { currentTarget: target, target, defender: target })));
  }
  function prepareConditionalSkill(skill = {}, target = {}) {
    const prepared = clone(skill);
    if (!finalPowerConditionPasses(prepared, target)) return prepared;
    prepared.metadata = { ...(prepared.metadata || {}), wolfConditionalFinalPowerBonus: numberOr(prepared.metadata?.wolfFinalPowerIf?.bonus, 1), wolfConditionalFinalPowerActive: true };
    return prepared;
  }

  function recoverSp(unit, amount = 5) {
    const before = spOf(unit);
    const raw = before + numberOr(amount, 0);
    let next = raw;
    if (global.CombatEngine?.limitSP) next = global.CombatEngine.limitSP(raw);
    else {
      const max = Number(unit?.maxSp ?? unit?.maxSP);
      if (Number.isFinite(max)) next = Math.min(max, raw);
    }
    unit.sp = next;
    if ('currentSp' in unit) unit.currentSp = next;
    if ('currentSP' in unit) unit.currentSP = next;
    return { before, after: next, recovered: next - before };
  }
  function applyHowlingBuff(unit, source) {
    return statusEngine()?.applyStatus?.(unit, 'attack_power_up', {
      mode: 'gain', count: 1, potency: 0, duration: 'this_turn',
      sourceTraitId: HUNTING_HOWLING.id, sourceUnitId: source?.id || source?.unitId || null,
    }) || null;
  }
  function requiredHowlingRank(source = {}) { return isDireWolf(source) ? 'leader' : 'captain'; }
  function canUseHuntingHowling(source, options = {}) {
    if (!isWolf(source)) return { allowed: false, reason: 'not_wolf' };
    const requiredRank = requiredHowlingRank(source);
    if (rankOf(source) !== requiredRank) return { allowed: false, reason: 'hunting_howling_rank_required', requiredRank };
    const economy = actionEconomy();
    if (economy?.availability) {
      const gate = economy.availability(source, 'quick_action', { ...options, phase: options.phase || 'planning' });
      if (!gate.available) return { allowed: false, reason: gate.reason || 'quick_action_unavailable', requiredRank };
    }
    return { allowed: true, reason: null, requiredRank };
  }

  function encounterStateFor(source, options = {}) {
    if (options.encounterState && typeof options.encounterState === 'object') return options.encounterState;
    if (!source.__wolfEncounterState || typeof source.__wolfEncounterState !== 'object') source.__wolfEncounterState = {};
    return source.__wolfEncounterState;
  }
  function backupKey(source, index, reserves = {}) {
    const root = normalizeId(source.instanceId || source.characterId || source.id || source.unitId || 'wolf_leader') || 'wolf_leader';
    let key = `${root}_howling_wolf_${index + 1}`;
    let n = 2;
    while (Object.prototype.hasOwnProperty.call(reserves || {}, key)) key = `${root}_howling_wolf_${index + 1}_${n++}`;
    return key;
  }
  function backupWolfTemplate(source = {}) {
    const catalog = global.LuminousWolfUnitCatalog;
    const base = catalog?.get?.('wolf') || {
      id: 'wolf', unitId: 'wolf', catalogId: 'wolf', name: 'Wolf', species: 'wolf', unitType: 'enemy', actorCategory: 'enemy', isPlayer: false,
      hpBase: 11, visual: { spriteUrl: 'https://imgur.com/W6efoaJ.png' },
    };
    const backup = clone(base);
    backup.id = 'wolf';
    backup.unitId = 'wolf';
    backup.catalogId = 'wolf';
    backup.rank = 'normal';
    backup.deployment = 'backup';
    backup.deploymentState = 'backup';
    backup.isBackup = true;
    backup.faction = source.faction ?? source.faccion ?? source.side ?? backup.faction ?? 'enemy';
    backup.spawnSourceTraitId = HUNTING_HOWLING.id;
    return backup;
  }
  function addHowlingBackups(source, options = {}) {
    const state = encounterStateFor(source, options);
    if (state.huntingHowlingBackupsUsed === true) return { added: [], alreadyUsed: true };
    state.huntingHowlingBackupsUsed = true;
    const reserves = options.reserves && typeof options.reserves === 'object' ? options.reserves : {};
    const added = [];
    for (let index = 0; index < 3; index += 1) {
      const unit = backupWolfTemplate(source);
      const key = backupKey(source, index, reserves);
      unit.instanceId = key;
      if (typeof options.addBackupUnit === 'function') options.addBackupUnit(unit, key);
      else reserves[key] = unit;
      added.push({ key, unit });
    }
    return { added, alreadyUsed: false, reserves };
  }
  function resetEncounter(source, options = {}) {
    const state = encounterStateFor(source, options);
    state.huntingHowlingBackupsUsed = false;
    return state;
  }

  function useHuntingHowling(source, options = {}) {
    const gate = canUseHuntingHowling(source, options);
    if (!gate.allowed) return { used: false, ...gate };
    const economy = actionEconomy();
    if (economy?.consume && !economy.consume(source, 'quick_action', { ...options, phase: options.phase || 'planning' })) {
      return { used: false, reason: 'quick_action_unavailable' };
    }
    const deployed = asArray(options.deployedUnits).length ? asArray(options.deployedUnits) : asArray(global.CombatEngine?.getAllAliveUnits?.());
    const wolves = deployed.filter((unit) => isWolf(unit) && isDeployed(unit) && sameSide(source, unit));
    if (isDeployed(source) && isWolf(source) && !wolves.includes(source)) wolves.push(source);
    const affected = wolves.map((unit) => ({ unit, sp: recoverSp(unit, 5), attackPowerUp: applyHowlingBuff(unit, source) }));
    const backup = addHowlingBackups(source, options);
    return { used: true, traitId: HUNTING_HOWLING.id, affected, backup, quickActionSpent: true };
  }

  function installCombatBridge() {
    const engine = global.CombatEngine;
    if (!engine || engine.__wolfUnitRuntimeInstalled) return Boolean(engine?.__wolfUnitRuntimeInstalled);

    if (typeof engine.triggerEvent === 'function') {
      const originalTrigger = engine.triggerEvent;
      engine.triggerEvent = function (tag, context = {}, targetsHit = []) {
        const result = originalTrigger.call(this, tag, context, targetsHit);
        const applied = applyManagedSkillEffects(tag, context, targetsHit);
        if (applied.length) context.wolfStatusEffectsApplied = [...asArray(context.wolfStatusEffectsApplied), ...applied];
        return result;
      };
    }

    if (typeof engine.calculateFinalPower === 'function') {
      const originalPower = engine.calculateFinalPower;
      engine.calculateFinalPower = function (skill, headsFlipped, unit) {
        const power = originalPower.call(this, skill, headsFlipped, unit);
        return power + numberOr(skill?.metadata?.wolfConditionalFinalPowerBonus, 0);
      };
    }

    if (typeof engine.resolveStandardClash === 'function') {
      const originalClash = engine.resolveStandardClash;
      engine.resolveStandardClash = function (unitA, skillA, unitB, skillB) {
        return originalClash.call(this, unitA, prepareConditionalSkill(skillA, unitB), unitB, prepareConditionalSkill(skillB, unitA));
      };
    }

    if (typeof engine.resolveUnilateralWithCounter === 'function') {
      const originalResolve = engine.resolveUnilateralWithCounter;
      engine.resolveUnilateralWithCounter = function (attacker, skill, defender, counterSkill, options = {}) {
        const targetGate = canTarget(attacker, defender);
        if (!targetGate.allowed) {
          return { blocked: true, reason: targetGate.reason, traitId: MEANING.id, attackerId: attacker?.id || attacker?.unitId || null, defenderId: defender?.id || defender?.unitId || null, attackLogs: [], pendingActions: [] };
        }
        return originalResolve.call(this, attacker, prepareConditionalSkill(skill, defender), defender, counterSkill, options);
      };
    }

    Object.defineProperty(engine, '__wolfUnitRuntimeInstalled', { value: true, configurable: true });
    return true;
  }

  function install() { return installCombatBridge(); }

  const api = Object.freeze({
    version: '1.0.0', MEANING, HUNTING_HOWLING,
    unitTemplateId, isWolf, isDireWolf, sameSide, isDeployed, spOf, rankOf, canTarget,
    statusComponent, conditionPasses, applyStatusDescriptor, applyManagedSkillEffects,
    finalPowerConditionPasses, prepareConditionalSkill, recoverSp, applyHowlingBuff,
    requiredHowlingRank, canUseHuntingHowling, backupWolfTemplate, addHowlingBackups, resetEncounter, useHuntingHowling,
    installCombatBridge, install,
  });

  global.LuminousWolfUnitRuntime = api;
  install();
  if (global.document) {
    global.setTimeout?.(install, 0);
    global.setTimeout?.(install, 800);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
