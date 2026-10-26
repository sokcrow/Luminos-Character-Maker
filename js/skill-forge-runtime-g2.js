(function (global) {
  "use strict";

  if (global.LuminousSkillForgeRuntimeG2) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousSkillForgeRuntimeG2;
    return;
  }

  const VERSION = "0.1.0";
  const PATCH = Symbol.for("luminous.skillForgeRuntimeG2.patch");
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function statusEntry(unit, statusId) {
    const wanted = normalizeId(statusId);
    if (!unit || !wanted) return null;
    const collection = unit.statusEffects || unit.statuses || {};
    if (Array.isArray(collection)) return collection.find((entry) => normalizeId(entry?.id || entry?.status || entry?.name) === wanted) || null;
    return collection && typeof collection === "object" ? (collection[wanted] || collection[statusId] || null) : null;
  }

  function readConditionValue(unit, condition = {}) {
    if (!unit) return 0;
    const stat = normalizeId(condition.stat);
    const hp = numberOr(unit.hp ?? unit.currentHp ?? unit.currentHP, 0), maxHp = numberOr(unit.maxHp ?? unit.maxHP, 0), sp = numberOr(unit.sp ?? unit.currentSp ?? unit.currentSP, 0), maxSp = numberOr(unit.maxSp ?? unit.maxSP, 45);
    if (stat === "hp_current") return hp;
    if (stat === "hp_percent") return maxHp > 0 ? (hp / maxHp) * 100 : 0;
    if (stat === "sp_current") return sp;
    if (stat === "sp_percent") return maxSp > 0 ? (sp / maxSp) * 100 : 0;
    if (["status_potency", "status_count", "has_status", "missing_status"].includes(stat)) {
      const entry = statusEntry(unit, condition.status);
      if (stat === "has_status") return entry ? 1 : 0;
      if (stat === "missing_status") return entry ? 0 : 1;
      if (!entry) return 0;
      if (typeof entry === "number") return numberOr(entry, 0);
      return numberOr(entry[stat === "status_potency" ? "potency" : "count"], 0);
    }
    return numberOr(unit[condition.stat] ?? unit[stat], 0);
  }

  function compare(actual, operator, expected) {
    if (operator === "<") return actual < expected;
    if (operator === "<=") return actual <= expected;
    if (operator === "=") return actual === expected;
    if (operator === ">=") return actual >= expected;
    if (operator === ">") return actual > expected;
    return false;
  }

  function conditionUnit(condition, context = {}) {
    const target = normalizeId(condition?.target || "target");
    if (target === "self") return context.attacker || context.self || context.unitAttacker || null;
    if (target === "target") return context.defender || context.target || context.currentTarget || context.unitDefender || null;
    return context[target] || null;
  }

  function evaluateCondition(condition, context = {}) {
    if (!condition) return true;
    const unit = conditionUnit(condition, context);
    if (!unit) return false;
    return compare(readConditionValue(unit, condition), String(condition.operator || "="), numberOr(condition.value, 0));
  }

  function emptyNextCoin() { return { finalPower: 0, coinPower: 0, damagePercent: 0 }; }
  function stateFor(unit) {
    if (!unit) return null;
    if (!unit.__luminousForgeG2State) Object.defineProperty(unit, "__luminousForgeG2State", { value: { nextCoin: emptyNextCoin(), activeCoin: null, nextClashPower: 0, log: [] }, writable: true, configurable: true, enumerable: false });
    return unit.__luminousForgeG2State;
  }
  function resetUnit(unit) { if (!unit) return; try { delete unit.__luminousForgeG2State; } catch (_) { unit.__luminousForgeG2State = null; } }
  function isForgeSkill(skill) { return Boolean(skill?.metadata?.forge || skill?.sourceType === "skill_forge" || skill?.source_type === "skill_forge"); }
  function actorFrom(context = {}) { return context.attacker || context.self || context.unitAttacker || null; }

  function record(unit, row) {
    const state = stateFor(unit);
    if (!state) return;
    state.log.push({ at: Date.now(), ...clone(row) });
    if (state.log.length > 30) state.log.splice(0, state.log.length - 30);
    try { global.dispatchEvent?.(new global.CustomEvent("luminous:skill-forge-reward", { detail: clone(row) })); } catch (_) {}
  }

  function applyReward(effect, context = {}) {
    const reward = effect?.forgeReward || effect?.reward || null, actor = actorFrom(context);
    if (!actor || !reward?.kind) return { applied: false, reason: "missing_actor_or_reward" };
    if (!evaluateCondition(effect.condition, context)) return { applied: false, reason: "condition_false", condition: clone(effect.condition) };
    const state = stateFor(actor), kind = normalizeId(reward.kind), amount = Math.max(0, numberOr(reward.amount, 0));
    if (kind === "sp") {
      const engine = context.engine || global.CombatEngine, next = numberOr(actor.sp, 0) + amount;
      actor.sp = typeof engine?.limitSP === "function" ? engine.limitSP(next) : next;
      engine?.checkSanityStates?.(actor);
    } else if (kind === "clash_power") state.nextClashPower += amount;
    else if (kind === "final_power") state.nextCoin.finalPower += amount;
    else if (kind === "coin_power") state.nextCoin.coinPower += amount;
    else if (kind === "damage_percent") state.nextCoin.damagePercent += amount;
    else return { applied: false, reason: "unsupported_reward", reward: clone(reward) };
    const result = { applied: true, kind, amount, delivery: effect.timing || null, condition: clone(effect.condition), skillId: context.skill?.id || null };
    record(actor, result);
    return result;
  }

  function matchingForgeEffects(tag, context = {}) {
    const skill = context.skill;
    if (!isForgeSkill(skill)) return [];
    const effects = [];
    if (Array.isArray(skill.effects)) effects.push(...skill.effects);
    if (context.currentCoin && Array.isArray(context.currentCoin.effects)) effects.push(...context.currentCoin.effects);
    return effects.filter((effect) => effect?.type === "forge_reward" && String(effect.trigger || effect.tag || "") === String(tag));
  }

  function activatePendingCoin(unit) {
    const state = stateFor(unit);
    if (!state) return null;
    if (!state.activeCoin && (state.nextCoin.finalPower || state.nextCoin.coinPower || state.nextCoin.damagePercent)) { state.activeCoin = { ...state.nextCoin }; state.nextCoin = emptyNextCoin(); }
    return state.activeCoin;
  }
  function headsCount(headsFlipped) { return Array.isArray(headsFlipped) ? headsFlipped.filter(Boolean).length : (headsFlipped === true ? 1 : 0); }

  function install(engine = global.CombatEngine) {
    if (!engine || engine[PATCH]) return engine || null;
    const original = { triggerEvent: engine.triggerEvent, calculateFinalPower: engine.calculateFinalPower, calculateCoinDamage: engine.calculateCoinDamage, resolveStandardClash: engine.resolveStandardClash };
    if (typeof original.triggerEvent !== "function" || typeof original.calculateFinalPower !== "function") return null;
    engine[PATCH] = { original, version: VERSION };
    engine.__luminousForgeClashDepth = 0;
    engine.__luminousForgeClashSnapshot = null;

    engine.triggerEvent = function patchedForgeTrigger(tag, context, targetsHit) {
      const result = original.triggerEvent.call(this, tag, context, targetsHit);
      if (!context?.skill) return result;
      if ((tag === "[On Clash Win]" || tag === "[On Clash Lose]") && !this.__luminousForgeClashDepth) return result;
      for (const effect of matchingForgeEffects(tag, context)) applyReward(effect, { ...context, engine: this });
      return result;
    };

    engine.calculateFinalPower = function patchedForgeFinalPower(skill, headsFlipped, unit) {
      let result = original.calculateFinalPower.call(this, skill, headsFlipped, unit);
      if (!unit || !isForgeSkill(skill)) return result;
      if (this.__luminousForgeClashDepth > 0) return result + numberOr(this.__luminousForgeClashSnapshot?.get(unit), 0);
      const active = activatePendingCoin(unit);
      if (!active) return result;
      result += numberOr(active.finalPower, 0);
      if (String(skill.coinType || skill.coin_type || "positive").toLowerCase() !== "negative") result += numberOr(active.coinPower, 0) * headsCount(headsFlipped);
      return result;
    };

    if (typeof original.calculateCoinDamage === "function") engine.calculateCoinDamage = function patchedForgeCoinDamage(attacker, defender, skill, coinFinalPower, isCritical, clashCount, context) {
      let result = original.calculateCoinDamage.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
      if (!attacker || !isForgeSkill(skill)) return result;
      const state = stateFor(attacker), active = state?.activeCoin;
      if (active && typeof result === "number" && numberOr(active.damagePercent, 0) !== 0) result = Math.floor(result * (1 + numberOr(active.damagePercent, 0) / 100));
      if (state) state.activeCoin = null;
      return result;
    };

    if (typeof original.resolveStandardClash === "function") engine.resolveStandardClash = function patchedForgeClash(unitA, skillA, unitB, skillB, options) {
      const stateA = stateFor(unitA), stateB = stateFor(unitB), powerA = numberOr(stateA?.nextClashPower, 0), powerB = numberOr(stateB?.nextClashPower, 0), previousSnapshot = this.__luminousForgeClashSnapshot;
      this.__luminousForgeClashDepth += 1;
      this.__luminousForgeClashSnapshot = new Map([[unitA, powerA], [unitB, powerB]]);
      try { return original.resolveStandardClash.call(this, unitA, skillA, unitB, skillB, options); }
      finally {
        if (stateA && powerA > 0) stateA.nextClashPower = Math.max(0, stateA.nextClashPower - powerA);
        if (stateB && powerB > 0) stateB.nextClashPower = Math.max(0, stateB.nextClashPower - powerB);
        this.__luminousForgeClashDepth = Math.max(0, this.__luminousForgeClashDepth - 1);
        this.__luminousForgeClashSnapshot = previousSnapshot;
      }
    };
    return engine;
  }

  function uninstall(engine = global.CombatEngine) {
    const patch = engine?.[PATCH];
    if (!patch) return false;
    Object.assign(engine, patch.original);
    try { delete engine[PATCH]; } catch (_) { engine[PATCH] = null; }
    return true;
  }

  function inspectUnitState(unit) { const state = unit?.__luminousForgeG2State; return state ? clone(state) : { nextCoin: emptyNextCoin(), activeCoin: null, nextClashPower: 0, log: [] }; }

  const api = Object.freeze({ version: VERSION, install, uninstall, evaluateCondition, readConditionValue, applyReward, matchingForgeEffects, stateFor, resetUnit, inspectUnitState });
  global.LuminousSkillForgeRuntimeG2 = api;
  if (global.CombatEngine) install(global.CombatEngine);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
