(function (global) {
  "use strict";

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const BRIDGE_KEY = "__luminousRogueCombatBridgeState";
  const SPEED_KEY = "__luminousRogueCunningSpeedBase";

  function runtime() { return global.LuminousRogueClassRuntime || (typeof require === "function" ? require("./rogue-class-runtime.js") : null); }
  function bridgeState() {
    if (!global[BRIDGE_KEY]) global[BRIDGE_KEY] = { actionSession: null, opponent: new WeakMap(), resolutionStack: [] };
    return global[BRIDGE_KEY];
  }

  function isInvisible(unit = {}) {
    return unit.invisible === true || unit.isInvisible === true || Boolean(unit.statusEffects?.invisible || unit.statuses?.invisible);
  }

  function withHiddenInvisibleStatus(unit, hidden, callback) {
    if (!hidden || !unit || typeof callback !== "function") return callback();
    const stores = [unit.statusEffects, unit.statuses].filter((store) => store && typeof store === "object" && !Array.isArray(store));
    const saved = stores.map((store) => ({ store, had: Object.prototype.hasOwnProperty.call(store, "invisible"), value: store.invisible }));
    saved.forEach((entry) => { if (entry.had) delete entry.store.invisible; });
    const direct = { invisible: unit.invisible, isInvisible: unit.isInvisible };
    unit.invisible = false;
    unit.isInvisible = false;
    try { return callback(); }
    finally {
      unit.invisible = direct.invisible;
      unit.isInvisible = direct.isInvisible;
      saved.forEach((entry) => { if (entry.had) entry.store.invisible = entry.value; });
    }
  }

  function currentOpponent(unit) { return bridgeState().opponent.get(unit) || null; }
  function setOpponents(a, b) {
    const state = bridgeState();
    if (a && typeof a === "object") state.opponent.set(a, b || null);
    if (b && typeof b === "object") state.opponent.set(b, a || null);
  }
  function clearOpponents(a, b) {
    const state = bridgeState();
    if (a && typeof a === "object") state.opponent.delete(a);
    if (b && typeof b === "object") state.opponent.delete(b);
  }

  function currentSessionTargetInfo(skill = {}, options = {}) {
    const session = bridgeState().actionSession;
    const index = Number.isFinite(Number(options.rogueTargetIndex)) ? Math.max(0, Math.trunc(Number(options.rogueTargetIndex)))
      : session ? Math.max(0, session.nextTargetIndex++) : 0;
    const attackWeight = Math.max(1, numberOr(options.attackWeight ?? session?.attackWeight ?? skill.attackWeight ?? skill.attack_weight, 1));
    return { targetIndex: index, isSecondaryTarget: options.isSecondaryTarget === true || index > 0, attackWeight };
  }

  function skillDamageType(skill = {}) {
    return normalizeId(skill.damageType || skill.damage_type || skill.statusDamageType || skill.status_damage_type || skill.statusId || "");
  }

  function applyCunningSpeed(unit = {}) {
    const rogue = runtime();
    if (!rogue) return 0;
    const bonus = rogue.cunningActionBonuses(unit).maxSpeed;
    if (!bonus) return 0;
    if (!unit[SPEED_KEY]) {
      const key = Object.prototype.hasOwnProperty.call(unit, "maxSpeed") ? "maxSpeed"
        : Object.prototype.hasOwnProperty.call(unit, "max_speed") ? "max_speed"
          : unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "max_speed") ? "combatStats.max_speed" : "maxSpeed";
      const base = key === "combatStats.max_speed" ? numberOr(unit.combatStats.max_speed, 0) : numberOr(unit[key], 0);
      try { Object.defineProperty(unit, SPEED_KEY, { value: { key, base }, writable: true, configurable: true, enumerable: false }); }
      catch (_) { unit[SPEED_KEY] = { key, base }; }
    }
    const record = unit[SPEED_KEY];
    if (record.key === "combatStats.max_speed") {
      if (!unit.combatStats) unit.combatStats = {};
      unit.combatStats.max_speed = record.base + bonus;
    } else unit[record.key] = record.base + bonus;
    return bonus;
  }

  function adjustSpLoss(unit, before) {
    const rogue = runtime();
    if (!rogue || !unit || !Number.isFinite(Number(before)) || !Number.isFinite(Number(unit.sp))) return;
    const after = Number(unit.sp);
    if (after >= before) return;
    const rawLoss = before - after;
    const reduced = rogue.reduceSpLoss(unit, rawLoss);
    unit.sp = before - reduced;
  }

  function withSpLossProtection(units, callback) {
    const unique = [...new Set((units || []).filter((unit) => unit && typeof unit === "object"))];
    const before = new Map(unique.map((unit) => [unit, Number.isFinite(Number(unit.sp)) ? Number(unit.sp) : null]));
    const result = callback();
    unique.forEach((unit) => adjustSpLoss(unit, before.get(unit)));
    return result;
  }

  function withProbabilityUnits(engine, units, callback) {
    const rogue = runtime();
    if (!rogue || !engine?.getCoinProbability || !units?.length) return callback();
    const originalProbability = engine.getCoinProbability;
    let callIndex = 0;
    engine.getCoinProbability = function (sp) {
      const base = originalProbability.call(engine, sp);
      const unit = units[callIndex % units.length];
      callIndex += 1;
      const bonus = rogue.headsProbabilityBonus(unit);
      return Math.max(0, Math.min(100, base + bonus * 100));
    };
    try { return callback(); }
    finally { engine.getCoinProbability = originalProbability; }
  }

  function wrapResolver() {
    const source = global.LuminousCombatActionResolver;
    if (!source || source.__rogueCombatResolverWrapped) return Boolean(source);
    const originalResolve = source.resolveCombatAction?.bind(source);
    const originalPrepared = source.resolvePreparedUnopposed?.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __rogueCombatResolverWrapped: true,
      resolveCombatAction(input = {}, context = {}) {
        if (!originalResolve) return { resolved: false, reason: "resolver_unavailable" };
        const previous = bridgeState().actionSession;
        bridgeState().actionSession = {
          resolutionType: normalizeId(input?.resolution?.type),
          attackWeight: Math.max(1, numberOr(input?.targeting?.attackWeight, 1)),
          nextTargetIndex: 0,
        };
        try { return originalResolve(input, context); }
        finally { bridgeState().actionSession = previous; }
      },
      resolvePreparedUnopposed(action, actor, targets, context = {}, options = {}) {
        if (!originalPrepared) return { resolved: false, reason: "resolver_unavailable" };
        const previous = bridgeState().actionSession;
        bridgeState().actionSession = {
          resolutionType: "unopposed",
          attackWeight: Math.max(1, numberOr(action?.targeting?.attackWeight, 1)),
          nextTargetIndex: 0,
        };
        try { return originalPrepared(action, actor, targets, context, options); }
        finally { bridgeState().actionSession = previous; }
      },
    });
    global.LuminousCombatActionResolver = wrapped;
    return true;
  }

  function installEngine(engine = global.CombatEngine) {
    const rogue = runtime();
    if (!engine || !rogue) return false;
    if (engine.__rogueClassCombatWrapped) return true;

    const originalInitialize = engine.initializeUnitData?.bind(engine);
    const originalPassive = engine.applyPassiveModifiers?.bind(engine);
    const originalFinalPower = engine.calculateFinalPower?.bind(engine);
    const originalCoinDamage = engine.calculateCoinDamage?.bind(engine);
    const originalUnilateral = engine.resolveUnilateralWithCounter?.bind(engine);
    const originalClash = engine.resolveStandardClash?.bind(engine);
    const originalEvade = engine.resolveEvade?.bind(engine);
    const originalGuard = engine.resolveGuard?.bind(engine);
    const originalSpell = engine.resolveSpell?.bind(engine);
    const originalProcessStatus = engine.processStatusEffects?.bind(engine);
    const originalTrigger = engine.triggerEvent?.bind(engine);

    if (originalInitialize) engine.initializeUnitData = function (unit) {
      const result = originalInitialize(unit);
      applyCunningSpeed(unit);
      return result;
    };

    if (originalPassive) engine.applyPassiveModifiers = function (unit, contextOptions = null) {
      const opponent = currentOpponent(unit);
      const suppressInvisible = opponent && rogue.blindsenseSuppressesInvisibleBuffs(opponent, unit) && isInvisible(unit);
      const modifiers = withHiddenInvisibleStatus(unit, suppressInvisible, () => originalPassive(unit, contextOptions)) || {};
      const cunning = rogue.cunningActionBonuses(unit);
      if (cunning.defensePower) modifiers.defense_power = numberOr(modifiers.defense_power, 0) + cunning.defensePower;
      if (opponent) modifiers.clash_power = numberOr(modifiers.clash_power, 0) + rogue.elusiveClashPower(unit, opponent);
      return modifiers;
    };

    if (originalFinalPower) engine.calculateFinalPower = function (skill, headsFlipped, unit) {
      let power = originalFinalPower(skill, headsFlipped, unit);
      const opponent = currentOpponent(unit);
      const type = normalizeId(skill?.defenseSubtype || skill?.type);
      if (unit && opponent && type === "evade") power += rogue.elusiveEvadePower(unit, opponent);
      return power;
    };

    if (originalCoinDamage) engine.calculateCoinDamage = function (attacker, defender, skill, coinPower, isCritical, clashCount, context) {
      let damage = originalCoinDamage(attacker, defender, skill, coinPower, isCritical, clashCount, context);
      const info = skill?.__luminousRogueResolutionContext || {};
      damage = rogue.applySneakAttackDamage(damage, { character: attacker, skill, unopposed: info.unopposed === true });
      if (Number.isFinite(Number(info.incomingMultiplier)) && info.incomingMultiplier !== 1 && rogue.rogueLevel(defender) > 0) damage *= info.incomingMultiplier;
      return damage;
    };

    if (originalUnilateral) engine.resolveUnilateralWithCounter = function (attacker, skill, defender, counterSkill, options = {}) {
      const targetInfo = currentSessionTargetInfo(skill, options);
      const unopposed = options.unopposed === true || options.clashMetadata?.unopposed === true || options.clashResult == null;
      const incoming = rogue.incomingSkillMultiplier(defender, {
        attackWeight: targetInfo.attackWeight,
        isSecondaryTarget: targetInfo.isSecondaryTarget,
        damageType: skillDamageType(skill),
      });
      const previous = skill.__luminousRogueResolutionContext;
      skill.__luminousRogueResolutionContext = { ...targetInfo, unopposed, incomingMultiplier: incoming.multiplier, consumedUncanny: incoming.consumedUncanny };
      setOpponents(attacker, defender);
      try { return withProbabilityUnits(engine, [attacker], () => originalUnilateral(attacker, skill, defender, counterSkill, options)); }
      finally {
        if (previous === undefined) delete skill.__luminousRogueResolutionContext;
        else skill.__luminousRogueResolutionContext = previous;
        clearOpponents(attacker, defender);
      }
    };

    if (originalClash) engine.resolveStandardClash = function (unitA, skillA, unitB, skillB) {
      setOpponents(unitA, unitB);
      try { return withProbabilityUnits(engine, [unitA, unitB], () => originalClash(unitA, skillA, unitB, skillB)); }
      finally { clearOpponents(unitA, unitB); }
    };

    if (originalEvade) engine.resolveEvade = function (defender, evadeSkill, attacker, attackSkill) {
      setOpponents(defender, attacker);
      try { return withProbabilityUnits(engine, [defender, attacker], () => originalEvade(defender, evadeSkill, attacker, attackSkill)); }
      finally { clearOpponents(defender, attacker); }
    };

    if (originalGuard) engine.resolveGuard = function (defender, guardSkill) {
      return withProbabilityUnits(engine, [defender], () => originalGuard(defender, guardSkill));
    };

    if (originalSpell) engine.resolveSpell = function (spellSkill, target, targetHeadsFlipped) {
      const result = originalSpell(spellSkill, target, targetHeadsFlipped) || {};
      const bonus = rogue.finalSavePowerBonus(target, spellSkill);
      if (bonus) {
        result.savePower = numberOr(result.savePower, 0) + bonus;
        result.isSuccess = result.savePower >= numberOr(result.dc ?? spellSkill?.saveDC, 0);
        result.winner = result.isSuccess ? "Target" : "Caster";
        result.rogueFinalSavePowerBonus = bonus;
      }
      return result;
    };

    if (originalProcessStatus) engine.processStatusEffects = function (unit, triggerKey, context = {}) {
      return withSpLossProtection([unit], () => originalProcessStatus(unit, triggerKey, context));
    };

    if (originalTrigger) engine.triggerEvent = function (triggerKey, context = {}, targets = []) {
      const units = [context?.attacker, context?.defender, context?.self, ...(Array.isArray(targets) ? targets : [])];
      const result = withSpLossProtection(units, () => originalTrigger(triggerKey, context, targets));
      if (normalizeId(triggerKey) === "on_evade") rogue.onEvaded(context?.defender || context?.self || targets?.[0] || {});
      return result;
    };

    try { Object.defineProperty(engine, "__rogueClassCombatWrapped", { value: true, configurable: true, enumerable: false }); }
    catch (_) { engine.__rogueClassCombatWrapped = true; }
    return true;
  }

  function install() {
    const engineReady = installEngine(global.CombatEngine);
    const resolverReady = wrapResolver();
    return engineReady || resolverReady;
  }

  const api = Object.freeze({ install, installEngine, wrapResolver, applyCunningSpeed, currentSessionTargetInfo });
  global.LuminousRogueCombatRuntime = api;
  install();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global.setInterval) global.setInterval(install, 800);
})(typeof window !== "undefined" ? window : globalThis);
