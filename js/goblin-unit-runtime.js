(function (global) {
  'use strict';

  const normalizeId = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

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

  function lastCoinReuseSkill(originalSkill, preparedSkill, baseResult) {
    const coins = asArray(preparedSkill.coins);
    const lastCoin = clone(coins[coins.length - 1] || { index: 0, type: 'normal', status: 'active', effects: [] });
    lastCoin.index = 0;
    lastCoin.status = 'active';
    lastCoin.isReused = true;

    const logs = asArray(baseResult?.attackLogs);
    const lastLog = logs[logs.length - 1] || {};
    const coinPower = numberOr(preparedSkill.coinPower, 0);
    const tosses = asArray(lastLog.attackTosses);
    const lastToss = tosses.length ? Boolean(tosses[tosses.length - 1]) : false;
    const loggedPower = Number(lastLog.attackPower);
    const baseline = Number.isFinite(loggedPower) ? Math.max(0, loggedPower - (lastToss ? coinPower : 0)) : numberOr(preparedSkill.basePower, 0);

    return {
      ...clone(preparedSkill),
      id: `${originalSkill.id || preparedSkill.id || 'skill'}__goblin_last_coin_reuse`,
      name: `${originalSkill.name || preparedSkill.name || 'Skill'} · Reused Last Coin`,
      basePower: baseline,
      coinPower,
      coinAmount: 1,
      coins: [lastCoin],
      resourceCosts: [],
      metadata: { ...(preparedSkill.metadata || {}), goblinMultiAttackReuse: true, originalSkillId: originalSkill.id || preparedSkill.id || null },
    };
  }

  function installCombatBridge() {
    const engine = global.CombatEngine;
    if (!engine || engine.__goblinUnitRuntimeInstalled || typeof engine.resolveUnilateralWithCounter !== 'function') return Boolean(engine?.__goblinUnitRuntimeInstalled);
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

      const preparedSkill = prepareMultiAttackSkill(attacker, skill);
      const base = originalResolve.call(this, attacker, preparedSkill, actualDefender, counterSkill, { ...options, __goblinRedirectApplied: true });
      if (redirect && base && typeof base === 'object') base.redirectAttack = redirect;

      const eligibleReuse = options.__goblinMultiReuse !== true && hasTrait(attacker, MULTI_ATTACK.id) && isMeleeSkill(skill) && skillCoinCount(skill) >= 2;
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
    version: '1.0.0', MULTI_ATTACK, REDIRECT_ATTACK, hasTrait, effectiveLevel, skillCoinCount, isMeleeSkill, reuseTimes,
    prepareMultiAttackSkill, isGoblin, isFieldUnit, selectRedirectTarget, resetRedirect, onTurnStart, lastCoinReuseSkill,
    installCombatBridge, install,
  });

  global.LuminousGoblinUnitRuntime = api;
  install();
  if (global.document) {
    global.setTimeout?.(install, 0);
    global.setTimeout?.(install, 800);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
