(function (global) {
  'use strict';

  const normalizeId = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const safeRequire = (path) => {
    if (typeof require !== 'function') return null;
    try { return require(path); } catch (_) { return null; }
  };
  const rangedAmmoRuntime = () => global.LuminousUniversalRangedAmmoRuntime || safeRequire('./universal-ranged-ammo-runtime.js');
  const statusEngineRuntime = () => global.LuminousStatusEngine || safeRequire('./status-engine.js');

  const MULTI_ATTACK = Object.freeze({
    id: 'goblin_multi_attack',
    name: 'Multi Attack',
    type: 'passive',
    description: 'Melee Skills with 2+ Coins reuse the last Coin 1 + floor(Level / 30) times. Melee Skills with 5+ Coins deal +5% Damage.',
    mechanics: Object.freeze({ meleeOnly: true, reuseMinimumCoins: 2, reuseFormula: '1 + floor(Level / 30)', damageMinimumCoins: 5, damageMultiplierBonus: 0.05 }),
  });

  const REDIRECT_ATTACK = Object.freeze({
    id: 'goblin_redirect_attack',
    name: 'Redirect Attack',
    type: 'passive',
    description: '[Before Getting Hit] If another allied Goblin is on the Field, redirect the attack to that Ally Goblin. Once per Turn.',
    mechanics: Object.freeze({ trigger: '[Before Getting Hit]', species: 'goblin', oncePerTurn: true }),
  });

  function unitId(unit = {}) { return String(unit.id ?? unit.unitId ?? unit.characterId ?? ''); }
  function traitIds(unit = {}) {
    const ids = [...asArray(unit.traitIds), ...asArray(unit.traits).map((trait) => trait?.id || trait)];
    return ids.filter(Boolean).map(normalizeId);
  }
  function hasTrait(unit, traitId) { return traitIds(unit).includes(normalizeId(traitId)); }
  function effectiveLevel(unit = {}) {
    return Math.max(0, Math.floor(numberOr(unit.effectiveLevel ?? unit.mechanics?.level ?? unit.level ?? unit.runtimeLevel, 0)));
  }
  function skillCoinCount(skill = {}) { return Math.max(0, Math.floor(numberOr(skill.coinAmount ?? skill.coins?.length, 0))); }
  function isMeleeSkill(skill = {}) {
    const range = Number(skill.skillRange ?? skill.range ?? skill.metadata?.skillRange);
    return !Number.isFinite(range) || range <= 1;
  }
  function reuseTimes(unit) { return 1 + Math.floor(effectiveLevel(unit) / 30); }

  function prepareMultiAttackSkill(unit, skill = {}) {
    const prepared = clone(skill);
    if (!hasTrait(unit, MULTI_ATTACK.id) || !isMeleeSkill(prepared) || skillCoinCount(prepared) < 5) return prepared;
    prepared.coins = asArray(prepared.coins).map((coin, index) => {
      const effects = asArray(coin?.effects).map(clone);
      effects.push({
        id: `goblin_multi_attack_damage_${index}`,
        type: 'percentage_damage',
        potency: 5,
        sourceTraitId: MULTI_ATTACK.id,
        trigger: 'damage',
      });
      return { ...(coin || {}), effects };
    });
    prepared.metadata = { ...(prepared.metadata || {}), goblinMultiAttackDamageBonus: 0.05 };
    return prepared;
  }

  function statusCount(unit = {}, statusId) {
    const runtime = rangedAmmoRuntime();
    if (typeof runtime?.statusCount === 'function') return Math.max(0, numberOr(runtime.statusCount(unit, statusId), 0));
    const wanted = normalizeId(statusId);
    const statuses = unit.statusEffects || unit.statuses || {};
    if (Array.isArray(statuses)) {
      const entry = statuses.find((status) => normalizeId(status?.id || status?.status || status?.name) === wanted);
      return Math.max(0, numberOr(entry?.count ?? entry?.potency ?? entry?.stacks, 0));
    }
    const entry = statuses[wanted] ?? statuses[statusId];
    if (Number.isFinite(Number(entry))) return Math.max(0, Number(entry));
    return Math.max(0, numberOr(entry?.count ?? entry?.potency ?? entry?.stacks, 0));
  }

  function statusActive(unit = {}, statusId) {
    const id = normalizeId(statusId);
    const entry = statusEngineRuntime()?.getStatus?.(unit, id);
    if (entry && (numberOr(entry.count, 0) > 0 || numberOr(entry.potency, 0) > 0 || numberOr(entry.stacks, 0) > 0)) return true;
    return statusCount(unit, id) > 0;
  }

  function targetStatusSnapshot(unit = {}) {
    return {
      bind: statusActive(unit, 'bind'),
      bleed: statusActive(unit, 'bleed'),
      pierced: statusActive(unit, 'pierced'),
    };
  }

  function requirementsMet(snapshot = {}, requires = []) {
    return asArray(requires).map(normalizeId).filter(Boolean).every((id) => snapshot[id] === true);
  }

  function prepareConditionalPowerSkill(attacker, skill = {}, defender = {}) {
    const prepared = clone(skill);
    if (!isGoblin(attacker)) return prepared;

    const snapshot = targetStatusSnapshot(defender);
    prepared.metadata = {
      ...(prepared.metadata || {}),
      goblinTargetStatusSnapshot: clone(snapshot),
    };

    const rules = prepared.metadata?.goblinConditionalPower;
    if (!rules) return prepared;

    const applied = { targetId: unitId(defender) || null, snapshot: clone(snapshot), finalPower: [], coinPower: [] };

    for (const rule of asArray(rules.finalPower)) {
      if (!requirementsMet(snapshot, rule?.requires)) continue;
      const amount = numberOr(rule?.amount, 0);
      if (!amount) continue;
      prepared.__combatActionFinalPowerBonus = numberOr(prepared.__combatActionFinalPowerBonus, 0) + amount;
      applied.finalPower.push({ requires: clone(rule.requires || []), amount });
    }

    for (const rule of asArray(rules.coinPower)) {
      if (!requirementsMet(snapshot, rule?.requires)) continue;
      const amount = numberOr(rule?.amount, 0);
      if (!amount) continue;
      if (rule?.allCoins === true) {
        prepared.coinPower = numberOr(prepared.coinPower, 0) + amount;
        applied.coinPower.push({ requires: clone(rule.requires || []), allCoins: true, amount });
        continue;
      }
      const coins = asArray(rule?.coins).map((value) => Math.max(1, Math.trunc(numberOr(value, 1))));
      if (!coins.length) continue;
      prepared.__combatActionIndexedCoinPowerBonuses = [
        ...asArray(prepared.__combatActionIndexedCoinPowerBonuses),
        ...coins.map((coinIndex) => ({ coinIndex, amount })),
      ];
      applied.coinPower.push({ requires: clone(rule.requires || []), coins, amount });
    }

    prepared.metadata = {
      ...(prepared.metadata || {}),
      goblinConditionalPowerApplied: applied,
    };
    return prepared;
  }

  function prepareBindBleedPayoffSkill(attacker, skill = {}, defender = {}) {
    const prepared = clone(skill);
    const payoff = prepared.metadata?.goblinBindBleedPayoff;
    if (!isGoblin(attacker) || !payoff || !isMeleeSkill(prepared)) return prepared;

    const bindActive = statusActive(defender, 'bind');
    const bleedActive = statusActive(defender, 'bleed');
    const bindBonus = bindActive ? Math.max(0, numberOr(payoff.bindFinalPower, 1)) : 0;
    const bleedBonus = bleedActive ? Math.max(0, numberOr(payoff.bleedFinalPower, 1)) : 0;
    const cap = Math.max(0, numberOr(payoff.maxFinalPowerBonus, bindBonus + bleedBonus));
    const finalPowerBonus = Math.min(cap, bindBonus + bleedBonus);
    if (!(finalPowerBonus > 0)) return prepared;

    prepared.__combatActionFinalPowerBonus = numberOr(prepared.__combatActionFinalPowerBonus, 0) + finalPowerBonus;
    prepared.metadata = {
      ...(prepared.metadata || {}),
      goblinBindBleedPayoffApplied: {
        bindActive,
        bleedActive,
        bindBonus,
        bleedBonus,
        finalPowerBonus,
        targetId: unitId(defender) || null,
      },
    };
    return prepared;
  }

  function isGoblin(unit = {}) {
    if (normalizeId(unit.species) === 'goblin' || normalizeId(unit.raceId) === 'goblin') return true;
    return asArray(unit.tags).map(normalizeId).includes('goblin');
  }
  function isFieldUnit(unit = {}) {
    if (!unit || numberOr(unit.hp ?? unit.mechanics?.hp, 0) <= 0) return false;
    if (unit.isBackup === true || unit.retreated === true || unit.escaped === true || unit.removed === true) return false;
    const state = normalizeId(unit.deploymentState || unit.deployment || unit.positionState || unit.zone || 'field');
    return !['backup', 'retreated', 'escaped', 'removed', 'dead'].includes(state);
  }
  function sameSide(a = {}, b = {}) {
    const af = normalizeId(a.faction ?? a.faccion ?? a.side);
    const bf = normalizeId(b.faction ?? b.faccion ?? b.side);
    return Boolean(af && bf && af === bf);
  }
  function selectRedirectTarget(defender, combatants = []) {
    if (!hasTrait(defender, REDIRECT_ATTACK.id) || defender.__goblinRedirectUsedThisTurn === true) return null;
    return asArray(combatants).find((candidate) => candidate && unitId(candidate) !== unitId(defender) && isGoblin(candidate) && isFieldUnit(candidate) && sameSide(defender, candidate)) || null;
  }
  function markRedirectUsed(unit) {
    if (!unit || typeof unit !== 'object') return;
    unit.__goblinRedirectUsedThisTurn = true;
  }
  function resetRedirect(unit) {
    if (unit && typeof unit === 'object') unit.__goblinRedirectUsedThisTurn = false;
  }
  function onTurnStart(unit) { resetRedirect(unit); return unit; }

  function tagMatches(effect, tag) { return normalizeId(effect?.trigger) === normalizeId(tag); }
  function isGoblinManagedSkill(skill = {}) { return skill?.metadata?.goblinRuntimeManagedStatusEffects === true; }

  function effectRequirementsMet(effect = {}, context = {}, target = {}) {
    const snapshot = context.skill?.metadata?.goblinTargetStatusSnapshot || targetStatusSnapshot(target);
    const all = asArray(effect.requiresTargetStatuses);
    const single = normalizeId(effect.requiresTargetStatus);
    if (single && snapshot[single] !== true) return false;
    if (all.length && !requirementsMet(snapshot, all)) return false;
    const any = asArray(effect.requiresAnyTargetStatuses).map(normalizeId).filter(Boolean);
    if (any.length && !any.some((id) => snapshot[id] === true)) return false;
    return true;
  }

  function applyStatusEffect(target, effect = {}, context = {}) {
    const statusId = normalizeId(effect.status);
    const count = Math.max(0, Math.trunc(numberOr(effect.count, 0)));
    const potency = Math.max(0, numberOr(effect.potency, 0));
    if (!statusId || (!count && !potency)) return null;
    const sourceUnitId = unitId(context.attacker) || null;
    if (statusId === 'pierced') {
      const result = rangedAmmoRuntime()?.applyPierced?.(target, count, { sourceUnitId });
      return result ? { targetId: unitId(target), statusId, count, potency, result } : null;
    }
    const result = statusEngineRuntime()?.applyStatus?.(target, statusId, {
      mode: 'gain', count, potency, sourceUnitId,
    });
    return result ? { targetId: unitId(target), statusId, count, potency, result } : null;
  }

  function applyManagedSkillEffects(tag, context = {}, targetsHit = []) {
    if (normalizeId(tag) !== 'on_hit' || !isGoblinManagedSkill(context.skill)) return [];
    const effects = [
      ...asArray(context.skill?.effects).filter((effect) => tagMatches(effect, tag)),
      ...asArray(context.currentCoin?.effects).filter((effect) => tagMatches(effect, tag)),
    ].filter((effect) => normalizeId(effect?.type) === 'status');
    if (!effects.length) return [];
    const targets = asArray(targetsHit).length ? asArray(targetsHit) : [context.currentTarget || context.defender].filter(Boolean);
    const applied = [];
    for (const target of targets) {
      for (const effect of effects) {
        if (!effectRequirementsMet(effect, context, target)) continue;
        const result = applyStatusEffect(target, effect, context);
        if (result) applied.push(result);
      }
    }
    return applied;
  }

  function indexedBonusForCoin(skill = {}, coinNumber) {
    return asArray(skill.__combatActionIndexedCoinPowerBonuses)
      .filter((entry) => Math.max(1, Math.trunc(numberOr(entry?.coinIndex, 1))) === coinNumber)
      .reduce((sum, entry) => sum + numberOr(entry?.amount, 0), 0);
  }

  function installIndexedCoinPowerBridge(engine) {
    if (!engine || typeof engine.calculateFinalPower !== 'function') return false;
    if (engine.__indexedCoinPowerBridgeInstalled) return true;
    const originalCalculateFinalPower = engine.calculateFinalPower;
    engine.calculateFinalPower = function (skill, headsFlipped, unit = null) {
      const base = originalCalculateFinalPower.call(this, skill, headsFlipped, unit);
      const rules = asArray(skill?.__combatActionIndexedCoinPowerBonuses);
      if (!rules.length || !Array.isArray(headsFlipped)) return base;
      const activeCoins = asArray(skill?.coins).filter((coin) => normalizeId(coin?.status || 'active') === 'active');
      let bonus = 0;
      headsFlipped.forEach((heads, tossIndex) => {
        if (heads !== true) return;
        const coin = activeCoins[tossIndex];
        const coinNumber = Math.max(1, Math.trunc(numberOr(coin?.index, tossIndex) + 1));
        bonus += indexedBonusForCoin(skill, coinNumber);
      });
      return base + bonus;
    };
    Object.defineProperty(engine, '__indexedCoinPowerBridgeInstalled', { value: true, configurable: true });
    return true;
  }

  function lastCoinReuseSkill(originalSkill, preparedSkill, baseResult) {
    const coins = asArray(preparedSkill.coins);
    const lastCoin = clone(coins[coins.length - 1] || { index: 0, type: 'normal', status: 'active', effects: [] });
    const originalCoinNumber = Math.max(1, Math.trunc(numberOr(lastCoin.index, coins.length - 1) + 1));
    lastCoin.index = 0;
    lastCoin.status = 'active';
    lastCoin.isReused = true;

    const logs = asArray(baseResult?.attackLogs);
    const lastLog = logs[logs.length - 1] || {};
    const coinPower = numberOr(preparedSkill.coinPower, 0);
    const tosses = asArray(lastLog.attackTosses);
    const lastToss = tosses.length ? Boolean(tosses[tosses.length - 1]) : false;
    const indexedBonus = lastToss ? indexedBonusForCoin(preparedSkill, originalCoinNumber) : 0;
    const loggedPower = Number(lastLog.attackPower);
    const baseline = Number.isFinite(loggedPower)
      ? Math.max(0, loggedPower - (lastToss ? coinPower + indexedBonus : 0))
      : numberOr(preparedSkill.basePower, 0);
    const reuseIndexedBonuses = indexedBonusForCoin(preparedSkill, originalCoinNumber);

    return {
      ...clone(preparedSkill),
      id: `${originalSkill.id || preparedSkill.id || 'skill'}__goblin_last_coin_reuse`,
      name: `${originalSkill.name || preparedSkill.name || 'Skill'} · Reused Last Coin`,
      basePower: baseline,
      coinPower,
      coinAmount: 1,
      coins: [lastCoin],
      resourceCosts: [],
      __combatActionIndexedCoinPowerBonuses: reuseIndexedBonuses ? [{ coinIndex: 1, amount: reuseIndexedBonuses }] : [],
      metadata: { ...(preparedSkill.metadata || {}), goblinMultiAttackReuse: true, originalSkillId: originalSkill.id || preparedSkill.id || null },
    };
  }

  function installTurnResetBridge(engine) {
    if (!engine || engine.__goblinRedirectTurnResetInstalled || typeof engine.triggerEvent !== 'function') return Boolean(engine?.__goblinRedirectTurnResetInstalled);
    const originalTriggerEvent = engine.triggerEvent;
    engine.triggerEvent = function (eventName, context = {}, targetUnits = []) {
      const event = normalizeId(eventName);
      if (event === 'turn_start' || event === 'round_start') {
        const units = asArray(targetUnits).length
          ? asArray(targetUnits)
          : (asArray(context.units).length ? asArray(context.units) : asArray(this.getAllAliveUnits?.()));
        units.forEach(resetRedirect);
      }
      const result = originalTriggerEvent.call(this, eventName, context, targetUnits);
      const applied = applyManagedSkillEffects(eventName, context, targetUnits);
      if (applied.length) context.goblinStatusEffectsApplied = [...asArray(context.goblinStatusEffectsApplied), ...applied];
      return result;
    };
    Object.defineProperty(engine, '__goblinRedirectTurnResetInstalled', { value: true, configurable: true });
    return true;
  }

  function installCombatBridge() {
    const engine = global.CombatEngine;
    if (!engine || typeof engine.resolveUnilateralWithCounter !== 'function') return false;
    installIndexedCoinPowerBridge(engine);
    installTurnResetBridge(engine);
    if (engine.__goblinUnitRuntimeInstalled) return true;
    const originalResolve = engine.resolveUnilateralWithCounter;

    engine.resolveUnilateralWithCounter = function (attacker, skill, defender, counterSkill, options = {}) {
      const combatants = asArray(options.combatants).length ? asArray(options.combatants) : asArray(this.getAllAliveUnits?.());
      let actualDefender = defender;
      let redirect = null;
      if (options.__goblinRedirectApplied !== true) {
        const ally = selectRedirectTarget(defender, combatants);
        if (ally) {
          markRedirectUsed(defender);
          redirect = { traitId: REDIRECT_ATTACK.id, fromId: unitId(defender), toId: unitId(ally) };
          actualDefender = ally;
        }
      }

      const conditionalSkill = prepareConditionalPowerSkill(attacker, skill, actualDefender);
      const payoffSkill = prepareBindBleedPayoffSkill(attacker, conditionalSkill, actualDefender);
      const preparedSkill = prepareMultiAttackSkill(attacker, payoffSkill);
      const base = originalResolve.call(this, attacker, preparedSkill, actualDefender, counterSkill, { ...options, __goblinRedirectApplied: true });
      if (redirect && base && typeof base === 'object') base.redirectAttack = redirect;
      if (base && typeof base === 'object' && preparedSkill.metadata?.goblinBindBleedPayoffApplied) {
        base.goblinBindBleedPayoff = clone(preparedSkill.metadata.goblinBindBleedPayoffApplied);
      }
      if (base && typeof base === 'object' && preparedSkill.metadata?.goblinConditionalPowerApplied) {
        base.goblinConditionalPower = clone(preparedSkill.metadata.goblinConditionalPowerApplied);
      }

      const eligibleReuse = options.__goblinMultiReuse !== true && hasTrait(attacker, MULTI_ATTACK.id) && isMeleeSkill(payoffSkill) && skillCoinCount(payoffSkill) >= 2;
      if (!eligibleReuse || !base || typeof base !== 'object') return base;

      const requested = reuseTimes(attacker);
      const attacks = [];
      const reuseSkill = lastCoinReuseSkill(skill, preparedSkill, base);
      for (let index = 0; index < requested; index += 1) {
        if (!actualDefender || numberOr(actualDefender.hp ?? actualDefender.mechanics?.hp, 0) <= 0) break;
        const reuseResult = originalResolve.call(this, attacker, clone(reuseSkill), actualDefender, null, {
          ...options,
          skipUseHooks: true,
          __goblinRedirectApplied: true,
          __goblinMultiReuse: true,
        });
        attacks.push(reuseResult);
      }
      base.multiAttackReuse = { traitId: MULTI_ATTACK.id, timesRequested: requested, timesResolved: attacks.length, attacks };
      return base;
    };

    Object.defineProperty(engine, '__goblinUnitRuntimeInstalled', { value: true, configurable: true });
    return true;
  }

  function install() { return installCombatBridge(); }

  const api = Object.freeze({
    version: '2.0.1', MULTI_ATTACK, REDIRECT_ATTACK, hasTrait, effectiveLevel, skillCoinCount, isMeleeSkill, reuseTimes,
    prepareMultiAttackSkill, statusCount, statusActive, targetStatusSnapshot, requirementsMet, prepareConditionalPowerSkill,
    prepareBindBleedPayoffSkill, isGoblin, isFieldUnit, selectRedirectTarget, resetRedirect, onTurnStart,
    tagMatches, isGoblinManagedSkill, effectRequirementsMet, applyStatusEffect, applyManagedSkillEffects,
    indexedBonusForCoin, installIndexedCoinPowerBridge, lastCoinReuseSkill,
    installTurnResetBridge, installCombatBridge, install,
  });

  global.LuminousGoblinUnitRuntime = api;
  install();
  if (global.document) {
    global.setTimeout?.(install, 0);
    global.setTimeout?.(install, 800);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);