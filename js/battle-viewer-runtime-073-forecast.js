(function (global) {
  "use strict";
  if (global.LuminousBattleViewerForecast073) return;
  const normalizeId = (v) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;

  function levelClashPower(level, opposingLevel) { return Math.floor(Math.max(0, numberOr(level) - numberOr(opposingLevel)) / 3); }
  function damageLevelModifier(offense, defense) { const d = numberOr(offense) - numberOr(defense); return d === 0 ? 0 : d / (Math.abs(d) + 25); }
  function fallbackLevel(unit, kind) {
    const values = kind === "offense"
      ? [unit?.offensive_level, unit?.offensiveLevel, unit?.combatStats?.offensive_level, unit?.level]
      : [unit?.defensive_level, unit?.defensiveLevel, unit?.combatStats?.defensive_level, unit?.level];
    return Math.max(1, numberOr(values.find((v) => Number.isFinite(Number(v))), 1));
  }
  function isDefense(skill = {}) {
    return Boolean(skill.isDefense || normalizeId(skill.skillFamily || skill.skill_family) === "defense" || ["guard", "evade", "counter", "clashableguard", "clashablecounter", "clashable_guard", "clashable_counter"].includes(normalizeId(skill.type || skill.defenseSubtype)));
  }
  function clashRelevantLevel(unit, skill = {}) {
    const engine = global.CombatEngine;
    if (isDefense(skill) && typeof engine?.getDefensiveLevel === "function") return Math.max(1, numberOr(engine.getDefensiveLevel(unit, skill), 1));
    if (!isDefense(skill) && typeof engine?.getOffensiveLevel === "function") return Math.max(1, numberOr(engine.getOffensiveLevel(unit, skill), 1));
    return fallbackLevel(unit, isDefense(skill) ? "defense" : "offense");
  }
  function headsChance(unit) {
    const engine = global.CombatEngine, sp = numberOr(unit?.sp ?? unit?.combatStats?.sp_actual, 0);
    const pct = typeof engine?.getCoinProbability === "function" ? numberOr(engine.getCoinProbability(sp), 50) : 50 + sp;
    return Math.max(.05, Math.min(.95, pct / 100));
  }
  function passive(unit, skill, target) { return global.CombatEngine?.applyPassiveModifiers?.(unit, { skill, target }) || {}; }
  function terms(unit, skill = {}, target = null) {
    const mods = passive(unit, skill, target);
    let base = numberOr(skill.basePower ?? skill.base_power, 0), coin = numberOr(skill.coinPower ?? skill.coin_power, 0), final = numberOr(skill.finalPower ?? skill.final_power, 0);
    if (isDefense(skill)) {
      base += numberOr(mods.defense_power, 0);
      const subtype = normalizeId(skill.defenseSubtype || skill.defense_subtype || skill.type);
      if (subtype.includes("counter")) base += numberOr(mods.counter_power, 0);
      else if (subtype === "evade") base += numberOr(mods.evade_power, 0);
      else if (subtype.includes("guard")) base += numberOr(mods.guard_power, 0);
      if (subtype.includes("clashable")) base += numberOr(mods.clash_power, 0);
    } else {
      base += numberOr(mods.base_power, 0);
      coin += numberOr(mods.coin_power, 0);
      final += numberOr(mods.final_power, 0) + numberOr(mods.clash_power, 0);
    }
    return { base, coin, final };
  }
  function coinStates(skill = {}) {
    if (Array.isArray(skill.coins) && skill.coins.length) return skill.coins.map((c) => ({ type: normalizeId(c.type || "standard"), status: normalizeId(c.status || "active") }));
    return Array.from({ length: Math.max(1, Math.floor(numberOr(skill.coinAmount ?? skill.coin_count, 1))) }, () => ({ type: normalizeId(skill.coinType || "standard"), status: "active" }));
  }
  function activeCount(states) { return states.filter((c) => c.status === "active").length; }
  function paralyzeCount(unit) { return Math.max(0, Math.floor(numberOr(unit?.statusEffects?.paralyze?.count ?? unit?.statusEffects?.paralysis?.count, 0))); }
  function loseCoin(states) {
    const next = states.map((c) => ({ ...c })), index = next.findIndex((c) => c.status === "active");
    if (index < 0) return next;
    next[index].status = next[index].type === "unbreakable" ? "latent" : next[index].type === "excision" ? "cracked" : "broken";
    return next;
  }
  function binomial(n, p) {
    const rows = [];
    for (let heads = 0; heads <= n; heads++) {
      let choose = 1;
      for (let i = 1; i <= heads; i++) choose = choose * (n - heads + i) / i;
      rows.push({ heads, probability: choose * Math.pow(p, heads) * Math.pow(1 - p, n - heads) });
    }
    return rows;
  }
  function distribution(unit, skill, target, states, paralysis, levelBonus) {
    const t = terms(unit, skill, target), active = activeCount(states), cracked = states.filter((c) => c.status === "cracked").length, rows = new Map();
    for (const flip of binomial(active, headsChance(unit))) {
      const blocked = Math.min(flip.heads, paralysis), effectiveHeads = flip.heads - blocked, nextParalysis = paralysis - blocked;
      const power = t.base + t.final + levelBonus + effectiveHeads * t.coin + cracked * (t.coin < 0 ? -1 : 1);
      const key = `${power}|${nextParalysis}`, row = rows.get(key) || { power, paralysis: nextParalysis, probability: 0 };
      row.probability += flip.probability; rows.set(key, row);
    }
    return [...rows.values()];
  }
  function stateKey(states) { return states.map((c) => `${c.type}:${c.status}`).join(","); }

  function exactClashWinProbability(unitA, skillA, unitB, skillB) {
    if (!unitA || !unitB || !skillA || !skillB) return .5;
    const levelA = clashRelevantLevel(unitA, skillA), levelB = clashRelevantLevel(unitB, skillB);
    const bonusA = levelClashPower(levelA, levelB), bonusB = levelClashPower(levelB, levelA), memo = new Map();
    function solve(aStates, bStates, parA, parB) {
      const activeA = activeCount(aStates), activeB = activeCount(bStates);
      if (!activeA && !activeB) return .5;
      if (!activeB) return 1;
      if (!activeA) return 0;
      const key = `${stateKey(aStates)}|${stateKey(bStates)}|${parA}|${parB}`;
      if (memo.has(key)) return memo.get(key);
      memo.set(key, .5);
      let selfLoop = 0, weighted = 0;
      for (const rollA of distribution(unitA, skillA, unitB, aStates, parA, bonusA)) for (const rollB of distribution(unitB, skillB, unitA, bStates, parB, bonusB)) {
        const pairP = rollA.probability * rollB.probability;
        let nextA = aStates, nextB = bStates;
        if (rollA.power > rollB.power) nextB = loseCoin(bStates);
        else if (rollB.power > rollA.power) nextA = loseCoin(aStates);
        const same = stateKey(nextA) === stateKey(aStates) && stateKey(nextB) === stateKey(bStates) && rollA.paralysis === parA && rollB.paralysis === parB;
        if (same) selfLoop += pairP;
        else weighted += pairP * solve(nextA, nextB, rollA.paralysis, rollB.paralysis);
      }
      const denominator = 1 - selfLoop, value = denominator <= 1e-12 ? .5 : Math.max(0, Math.min(1, weighted / denominator));
      memo.set(key, value); return value;
    }
    return solve(coinStates(skillA), coinStates(skillB), paralyzeCount(unitA), paralyzeCount(unitB));
  }

  function clashGrade(probability) {
    const p = Math.max(0, Math.min(1, numberOr(probability, .5)));
    if (p >= .90) return { label: "DOMINATING", className: "dominating" };
    if (p >= .60) return { label: "FAVORED", className: "favored" };
    if (p >= .40) return { label: "NEUTRAL", className: "neutral" };
    if (p >= .10) return { label: "STRUGGLING", className: "struggling" };
    return { label: "HOPELESS", className: "hopeless" };
  }
  function clashPowerRange(unit, skill, opponentUnit, opponentSkill = {}) {
    const level = clashRelevantLevel(unit, skill), other = clashRelevantLevel(opponentUnit, opponentSkill);
    const values = distribution(unit, skill, opponentUnit, coinStates(skill), paralyzeCount(unit), levelClashPower(level, other)).map((r) => r.power);
    return { min: values.length ? Math.min(...values) : 0, max: values.length ? Math.max(...values) : 0 };
  }
  function forecastDamageRange(unit, skill, target) {
    if (!unit || !skill || !target) return { min: 0, max: 0 };
    const t = terms(unit, skill, target), states = coinStates(skill), count = Math.max(1, activeCount(states));
    const off = global.CombatEngine?.getOffensiveLevel?.(unit, skill) ?? fallbackLevel(unit, "offense");
    const def = global.CombatEngine?.getDefensiveLevel?.(target, target) ?? fallbackLevel(target, "defense");
    const levelFactor = 1 + damageLevelModifier(off, def), paralysis = paralyzeCount(unit);
    let min = 0, max = 0, minPower = t.base + t.final, maxPower = minPower, parLeft = paralysis;
    for (let i = 0; i < count; i++) {
      const headGain = parLeft > 0 ? 0 : t.coin; if (parLeft > 0) parLeft--;
      minPower += Math.min(0, headGain); maxPower += Math.max(0, headGain);
      min += Math.max(1, Math.floor(Math.max(0, minPower) * Math.max(0, levelFactor)));
      max += Math.max(1, Math.floor(Math.max(0, maxPower) * Math.max(0, levelFactor)));
    }
    return { min, max };
  }
  function forecastClash(unitA, skillA, unitB, skillB) {
    const probability = exactClashWinProbability(unitA, skillA, unitB, skillB), grade = clashGrade(probability);
    return {
      probability, ...grade,
      left: { level: clashRelevantLevel(unitA, skillA), powerRange: clashPowerRange(unitA, skillA, unitB, skillB), damageRange: forecastDamageRange(unitA, skillA, unitB) },
      right: { level: clashRelevantLevel(unitB, skillB), powerRange: clashPowerRange(unitB, skillB, unitA, skillA), damageRange: forecastDamageRange(unitB, skillB, unitA) },
    };
  }

  function installClashLevelBridge() {
    const engine = global.CombatEngine;
    if (!engine?.calculateFinalPower || !engine?.resolveStandardClash) return false;
    if (engine.__battleViewer073ClashLevelBridge) return true;
    const originalPower = engine.calculateFinalPower, originalClash = engine.resolveStandardClash;
    engine.calculateFinalPower = function (skill, ...args) { return originalPower.call(this, skill, ...args) + numberOr(skill?.__battleViewer073ClashLevelBonus, 0); };
    engine.resolveStandardClash = function (unitA, skillA, unitB, skillB, ...args) {
      const levelA = clashRelevantLevel(unitA, skillA), levelB = clashRelevantLevel(unitB, skillB), oldA = skillA?.__battleViewer073ClashLevelBonus, oldB = skillB?.__battleViewer073ClashLevelBonus;
      if (skillA) skillA.__battleViewer073ClashLevelBonus = levelClashPower(levelA, levelB);
      if (skillB) skillB.__battleViewer073ClashLevelBonus = levelClashPower(levelB, levelA);
      try { return originalClash.call(this, unitA, skillA, unitB, skillB, ...args); }
      finally {
        if (skillA) oldA === undefined ? delete skillA.__battleViewer073ClashLevelBonus : skillA.__battleViewer073ClashLevelBonus = oldA;
        if (skillB) oldB === undefined ? delete skillB.__battleViewer073ClashLevelBonus : skillB.__battleViewer073ClashLevelBonus = oldB;
      }
    };
    Object.defineProperty(engine, "__battleViewer073ClashLevelBridge", { value: true, configurable: true });
    return true;
  }

  const api = Object.freeze({ levelClashPower, damageLevelModifier, clashRelevantLevel, headsChance, exactClashWinProbability, clashGrade, clashPowerRange, forecastDamageRange, forecastClash, installClashLevelBridge });
  global.LuminousBattleViewerForecast073 = api;
  installClashLevelBridge();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
