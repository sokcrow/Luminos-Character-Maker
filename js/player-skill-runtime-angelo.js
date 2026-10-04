(function (global) {
  "use strict";

  if (global.LuminousAngeloPlayerSkillRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousAngeloPlayerSkillRuntime;
    return;
  }

  const VERSION = "0.7.4-angelo-signature-1";
  const IDS = Object.freeze({
    s1: "angelo_steps_to_perfection",
    s2: "angelo_blood_art",
    s3: "angelo_my_masterpiece",
  });
  const RANDOM_STATUS_POOL = Object.freeze(["burn", "rupture", "sinking", "tremor", "bleed"]);
  const clashBonusBySkill = new WeakMap();

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function skillId(skill = {}) {
    return normalizeId(skill.id || skill.skillId || skill.sourceId || skill.libraryKey);
  }

  function statusEntry(unit = {}, id) {
    const key = normalizeId(id);
    const collection = unit.statusEffects || unit.statuses || {};
    if (Array.isArray(collection)) {
      return collection.find((entry) => normalizeId(entry?.id || entry?.status || entry?.name) === key) || null;
    }
    return collection && typeof collection === "object" ? (collection[key] || collection[id] || null) : null;
  }

  function statusPotency(unit, id) {
    const entry = statusEntry(unit, id);
    if (typeof entry === "number") return Math.max(0, Number(entry) || 0);
    return Math.max(0, numberOr(entry?.potency, 0));
  }

  function statusCount(unit, id) {
    const entry = statusEntry(unit, id);
    if (typeof entry === "number") return Math.max(0, Number(entry) || 0);
    return Math.max(0, numberOr(entry?.count, 0));
  }

  function statusDefinition(id) {
    const key = normalizeId(id);
    return global.LuminousStatusLibrary?.get?.(key)
      || global.STATUS_REGISTRY?.[key]
      || null;
  }

  function negativeStatusTypeCount(unit = {}) {
    const collection = unit.statusEffects || unit.statuses || {};
    const rows = Array.isArray(collection)
      ? collection.map((entry) => [normalizeId(entry?.id || entry?.status || entry?.name), entry])
      : Object.entries(collection || {});
    let count = 0;
    const seen = new Set();
    for (const [rawId, entry] of rows) {
      const id = normalizeId(rawId);
      if (!id || seen.has(id)) continue;
      const active = typeof entry === "number"
        ? Number(entry) > 0
        : entry && typeof entry === "object"
          ? (Number(entry.count || 0) > 0 || Number(entry.potency || 0) > 0 || Object.keys(entry).length > 0)
          : Boolean(entry);
      if (!active) continue;
      const definition = statusDefinition(id);
      if (normalizeId(definition?.type) !== "negative") continue;
      seen.add(id);
      count += 1;
    }
    return count;
  }

  function applyStatus(unit, id, { potency = 0, count = 0, sourceSkillId = null } = {}) {
    if (!unit) return null;
    const key = normalizeId(id);
    const payload = {
      potency: Math.max(0, numberOr(potency, 0)),
      count: Math.max(0, numberOr(count, 0)),
      mode: "gain",
      data: { sourceSkillId: sourceSkillId || null, sourceCharacterId: "angelo_v" },
    };
    if (typeof global.LuminousStatusEngine?.applyStatus === "function") {
      return global.LuminousStatusEngine.applyStatus(unit, key, payload);
    }
    if (typeof global.LuminousElementalStatusRuntime?.applyStatus === "function") {
      return global.LuminousElementalStatusRuntime.applyStatus(unit, key, payload);
    }
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    const current = unit.statusEffects[key] || { id: key, potency: 0, count: 0, data: {} };
    current.potency = Math.max(0, numberOr(current.potency, 0) + payload.potency);
    current.count = Math.max(0, numberOr(current.count, 0) + payload.count);
    current.data = { ...(current.data || {}), ...payload.data };
    unit.statusEffects[key] = current;
    return current;
  }

  function pickRandomStatus(rng = Math.random) {
    const roll = Math.max(0, Math.min(0.999999999, Number(rng()) || 0));
    return RANDOM_STATUS_POOL[Math.floor(roll * RANDOM_STATUS_POOL.length)] || RANDOM_STATUS_POOL[0];
  }

  function currentCoinIndex(context = {}) {
    const coin = context.currentCoin;
    if (Number.isInteger(Number(coin?.index))) return Number(coin.index);
    const coins = context.skill?.coins || [];
    const index = coins.indexOf(coin);
    return index >= 0 ? index : null;
  }

  function angeloClashBonus(skill, target) {
    const id = skillId(skill);
    const potency = statusPotency(target, "bleed");
    const count = statusCount(target, "bleed");
    if (id === IDS.s1) return potency >= 6 ? 1 : 0;
    if (id === IDS.s2 || id === IDS.s3) {
      return Math.min(2, Math.floor(potency / 3)) + Math.min(2, Math.floor(count / 3));
    }
    return 0;
  }

  function handleSkillTrigger(tag, context = {}, rng = Math.random) {
    const id = skillId(context.skill);
    if (![IDS.s1, IDS.s2, IDS.s3].includes(id)) return null;
    const target = context.currentTarget || context.defender || null;
    if (!target) return null;
    const coinIndex = currentCoinIndex(context);
    const applied = [];

    if (id === IDS.s1) {
      if (tag === "[Heads]" && coinIndex === 0) {
        const status = pickRandomStatus(rng);
        applyStatus(target, status, { count: 2, sourceSkillId: id });
        applied.push({ status, count: 2 });
      }
      if (tag === "[On Hit]" && coinIndex === 2) {
        applyStatus(target, "bleed", { potency: 2, sourceSkillId: id });
        applied.push({ status: "bleed", potency: 2 });
      }
    }

    if (id === IDS.s2 && tag === "[On Hit]" && coinIndex === 0) {
      applyStatus(target, "bleed", { count: 1, sourceSkillId: id });
      const status = pickRandomStatus(rng);
      applyStatus(target, status, { count: 3, sourceSkillId: id });
      applied.push({ status: "bleed", count: 1 }, { status, count: 3 });
    }

    if (id === IDS.s3 && tag === "[On Hit]" && (coinIndex === 1 || coinIndex === 2)) {
      applyStatus(target, "bleed", { potency: 1, sourceSkillId: id });
      applied.push({ status: "bleed", potency: 1 });
      if (negativeStatusTypeCount(target) >= 3) {
        applyStatus(target, "bleed", { count: 2, sourceSkillId: id });
        applied.push({ status: "bleed", count: 2 });
      }
      const status = pickRandomStatus(rng);
      applyStatus(target, status, { count: 3, sourceSkillId: id });
      applied.push({ status, count: 3 });
    }

    return applied.length ? applied : null;
  }

  function bloodArtReuseChance(target) {
    const negativeTypes = Math.min(2, negativeStatusTypeCount(target));
    return Math.min(1, 0.40 + (0.20 * negativeTypes));
  }

  function install(engine = global.CombatEngine) {
    if (!engine || engine.__angeloPlayerSkillRuntime074) return Boolean(engine);

    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalResolveClash = typeof engine.resolveClash === "function" ? engine.resolveClash : null;
    const originalApplyPassiveModifiers = typeof engine.applyPassiveModifiers === "function" ? engine.applyPassiveModifiers : null;
    const originalCalculateCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;
    const originalResolveUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        try { handleSkillTrigger(tag, context); } catch (_) {}
        return result;
      };
    }

    if (originalApplyPassiveModifiers) {
      engine.applyPassiveModifiers = function (unit, context = {}) {
        const base = originalApplyPassiveModifiers.call(this, unit, context) || {};
        const bonus = context?.skill && typeof context.skill === "object" ? (clashBonusBySkill.get(context.skill) || 0) : 0;
        return bonus ? { ...base, clash_power: numberOr(base.clash_power, 0) + bonus } : base;
      };
    }

    if (originalResolveClash) {
      engine.resolveClash = function (unitA, skillA, unitB, skillB) {
        if (skillA && typeof skillA === "object") clashBonusBySkill.set(skillA, angeloClashBonus(skillA, unitB));
        if (skillB && typeof skillB === "object") clashBonusBySkill.set(skillB, angeloClashBonus(skillB, unitA));
        try {
          return originalResolveClash.apply(this, arguments);
        } finally {
          if (skillA && typeof skillA === "object") clashBonusBySkill.delete(skillA);
          if (skillB && typeof skillB === "object") clashBonusBySkill.delete(skillB);
        }
      };
    }

    if (originalCalculateCoinDamage) {
      engine.calculateCoinDamage = function (attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
        const baseDamage = originalCalculateCoinDamage.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
        if (skillId(skill) !== IDS.s3 || currentCoinIndex(context || {}) !== 3) return baseDamage;
        const negativeTypes = Math.min(5, negativeStatusTypeCount(defender));
        return Math.max(0, Math.floor(numberOr(baseDamage, 0) * (1 + (0.25 * negativeTypes))));
      };
    }

    if (originalResolveUnilateral) {
      engine.resolveUnilateralWithCounter = function (unitAttacker, attackSkill, unitDefender, counterSkill, options = {}) {
        const result = originalResolveUnilateral.call(this, unitAttacker, attackSkill, unitDefender, counterSkill, options);
        if (skillId(attackSkill) !== IDS.s2 || !unitDefender || numberOr(unitDefender.hp, 0) <= 0) return result;

        const maxReuses = 2;
        for (let reuse = 0; reuse < maxReuses; reuse += 1) {
          if (numberOr(unitDefender.hp, 0) <= 0) break;
          const chance = bloodArtReuseChance(unitDefender);
          if (Math.random() >= chance) break;
          const extra = originalResolveUnilateral.call(this, unitAttacker, attackSkill, unitDefender, null, {
            ...(options || {}),
            skipUseHooks: true,
            __angeloBloodArtReuse: reuse + 1,
          }) || {};
          if (Array.isArray(extra.attackLogs)) result.attackLogs = [...(result.attackLogs || []), ...extra.attackLogs];
          if (Array.isArray(extra.pendingActions)) result.pendingActions = [...(result.pendingActions || []), ...extra.pendingActions];
          if (Number.isFinite(Number(extra.damageTaken))) result.damageTaken = numberOr(result.damageTaken, 0) + Number(extra.damageTaken);
          result.angeloBloodArtReuses = reuse + 1;
        }
        return result;
      };
    }

    Object.defineProperty(engine, "__angeloPlayerSkillRuntime074", { value: true, configurable: true });
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    IDS,
    RANDOM_STATUS_POOL,
    statusPotency,
    statusCount,
    negativeStatusTypeCount,
    pickRandomStatus,
    angeloClashBonus,
    handleSkillTrigger,
    bloodArtReuseChance,
    install,
  });

  global.LuminousAngeloPlayerSkillRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  install();
})(typeof window !== "undefined" ? window : globalThis);
