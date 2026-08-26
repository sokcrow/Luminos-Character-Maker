(function (global) {
  "use strict";

  if (global.LuminousElementalStatusRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousElementalStatusRuntime;
    return;
  }

  const PATCH_INTERVAL_MS = 250;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const ELEMENT_TO_SIN = Object.freeze({
    fire: "Wrath",
    cold: "Gloom",
    lightning: "Envy",
    acid: "Gluttony",
    poison: "Gluttony",
    necrotic: "Gloom",
    radiant: "Pride",
    psychic: "Lust",
    thunder: "Wrath",
    force: "Sloth",
  });

  const ELEMENT_TO_STATUS = Object.freeze({
    fire: "burn",
    cold: "chill",
    lightning: "shock",
    acid: "corrosion",
    poison: "poison",
    necrotic: "decay",
    radiant: "radiance",
    psychic: "sinking",
    thunder: "tremor",
    force: "force",
  });

  const STATUS_DEFINITIONS = Object.freeze({
    chill: Object.freeze({
      name: "Chill",
      type: "negative",
      mode: "single",
      rules: Object.freeze([
        Object.freeze({ trigger: "passive", cond_input: 2, cond_type: "count", operation: "sub", aff_input: 1, affectation: "speed", decay: "none" }),
      ]),
      description: "Speed decreases by 1 for every 2 Count. At 20 Count, inflict Frozen. When hit by a Wrath Skill, reduce this effect by 2 Count. When taking Burn damage, reduce this effect by 1 Count.",
    }),
    frozen: Object.freeze({
      name: "Frozen",
      type: "negative",
      mode: "single",
      rules: Object.freeze([]),
      description: "Gain a Shield equal to 100 + 10% of Max HP. Each turn, lose 5% of Max HP directly. The Shield takes double damage from Wrath Skills and Burn damage.",
    }),
    shock: Object.freeze({
      name: "Shock",
      type: "negative",
      mode: "single",
      rules: Object.freeze([]),
      description: "At the start of the turn, gain 1 Paralyze for every 3 Count, then reduce this effect by 3 for each Paralyze gained.",
    }),
    corrosion: Object.freeze({
      name: "Corrosion",
      type: "negative",
      mode: "single",
      maxCount: 10,
      rules: Object.freeze([
        Object.freeze({ trigger: "passive", cond_input: 2, cond_type: "count", operation: "sub", aff_input: 1, affectation: "defensive_level", decay: "none" }),
        Object.freeze({ trigger: "passive", cond_input: 2, cond_type: "count", operation: "sub", aff_input: 1, affectation: "offensive_level", decay: "none" }),
      ]),
      description: "Max 10 Count. Defense and Offense Levels decrease by 1 for every 2 Count. At the start of the turn, take fixed damage equal to 1% of Max HP per Count, then reduce Count by 1.",
    }),
    poison: Object.freeze({
      name: "Poison",
      type: "negative",
      mode: "double",
      maxPotency: 10,
      rules: Object.freeze([]),
      description: "Max 10 Potency. At the end of the turn, take fixed damage equal to Count, raise Potency by 1, then halve Count. At 10 Potency, gain Poisoned, then reduce Potency to 0. While Poisoned, damage from this effect is doubled. At 10 Potency while already Poisoned, damage from this effect is tripled instead.",
    }),
    poisoned: Object.freeze({
      name: "Poisoned",
      type: "negative",
      mode: "single",
      rules: Object.freeze([]),
      description: "Poisoned condition. Source effects define its additional interactions.",
    }),
    decay: Object.freeze({
      name: "Decay",
      type: "negative",
      mode: "single",
      maxCount: 99,
      rules: Object.freeze([]),
      description: "Max 99 Count. Reduce Max HP by 1% per Count. Max HP cannot be reduced below 1 by this effect. When receiving healing, reduce Count by 5. When healed by Passive Regeneration, reduce Count by 2. On Short Rest, halve Count. On Long Rest, lose this effect.",
    }),
    radiance: Object.freeze({
      name: "Radiance",
      type: "negative",
      mode: "single",
      maxCount: 10,
      rules: Object.freeze([]),
      description: "Max 10 Count. When getting hit, take fixed damage equal to 1% of hit damage for every 2 Count. Shields take double damage. At the end of an Encounter, reduce Count by 2. On Short Rest, reduce Count by 5. On Long Rest, lose this effect.",
    }),
    force: Object.freeze({
      name: "Force",
      type: "negative",
      mode: "single",
      rules: Object.freeze([]),
      description: "Raise Stagger Threshold by Count, then lose this effect.",
    }),
  });

  function registry() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    return global.STATUS_REGISTRY;
  }

  function registerStatuses() {
    const target = registry();
    Object.entries(STATUS_DEFINITIONS).forEach(([id, definition]) => {
      target[id] = { ...(target[id] || {}), ...definition, rules: Array.from(definition.rules || []) };
    });
    return target;
  }

  function store(unit) {
    if (!unit || typeof unit !== "object") return null;
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    return unit.statusEffects;
  }

  function status(unit, id) {
    return store(unit)?.[normalizeId(id)] || null;
  }

  function countOf(unit, id) {
    const value = status(unit, id);
    if (value == null) return 0;
    if (typeof value === "number") return Math.max(0, numberOr(value, 0));
    return Math.max(0, numberOr(value.count, 0));
  }

  function potencyOf(unit, id) {
    const value = status(unit, id);
    if (!value || typeof value !== "object") return 0;
    return Math.max(0, numberOr(value.potency, 0));
  }

  function ensureStatusData(unit, id) {
    const value = status(unit, id);
    if (!value || typeof value !== "object") return null;
    if (!value.data || typeof value.data !== "object" || Array.isArray(value.data)) value.data = {};
    return value.data;
  }

  function removeStatus(unit, id) {
    const engine = global.LuminousStatusEngine;
    if (engine?.removeStatus) return engine.removeStatus(unit, normalizeId(id));
    const target = store(unit);
    if (!target) return false;
    const key = normalizeId(id);
    if (!target[key]) return false;
    const previous = target[key];
    delete target[key];
    onStatusRemoved(unit, key, previous);
    return true;
  }

  function reduceCount(unit, id, amount) {
    const key = normalizeId(id);
    const target = store(unit);
    const current = target?.[key];
    if (current == null) return 0;
    const nextAmount = Math.max(0, numberOr(amount, 0));
    let nextCount = 0;
    if (typeof current === "number") {
      nextCount = Math.max(0, current - nextAmount);
      if (nextCount <= 0) delete target[key];
      else target[key] = nextCount;
    } else {
      current.count = Math.max(0, numberOr(current.count, 0) - nextAmount);
      nextCount = current.count;
      if (current.count <= 0) {
        const previous = current;
        delete target[key];
        onStatusRemoved(unit, key, previous);
      }
    }
    if (key === "decay" && nextCount > 0) reconcileDecayMaxHp(unit);
    return nextCount;
  }

  function setCount(unit, id, count) {
    const key = normalizeId(id);
    const target = store(unit);
    const current = target?.[key];
    const next = Math.max(0, numberOr(count, 0));
    if (current == null) return 0;
    if (next <= 0) {
      const previous = current;
      delete target[key];
      onStatusRemoved(unit, key, previous);
      return 0;
    }
    if (typeof current === "number") target[key] = next;
    else current.count = next;
    if (key === "decay") reconcileDecayMaxHp(unit);
    return next;
  }

  function readMaxHp(entity = {}) {
    const combat = entity?.combatStats && typeof entity.combatStats === "object" ? entity.combatStats : {};
    const candidates = [entity.maxHp, entity.maxHP, entity.hp_max, combat.hp_max, combat.maxHp, combat.maxHP];
    const found = candidates.find((value) => Number.isFinite(Number(value)));
    return found == null ? null : Math.max(0, Number(found));
  }

  function writeMaxHp(entity, value) {
    if (!entity || typeof entity !== "object") return null;
    const next = Math.max(1, Math.floor(numberOr(value, 1)));
    let wrote = false;
    if (Object.prototype.hasOwnProperty.call(entity, "maxHp")) { entity.maxHp = next; wrote = true; }
    if (Object.prototype.hasOwnProperty.call(entity, "maxHP")) { entity.maxHP = next; wrote = true; }
    if (Object.prototype.hasOwnProperty.call(entity, "hp_max")) { entity.hp_max = next; wrote = true; }
    if (entity.combatStats && typeof entity.combatStats === "object") {
      if (Object.prototype.hasOwnProperty.call(entity.combatStats, "hp_max")) { entity.combatStats.hp_max = next; wrote = true; }
      if (Object.prototype.hasOwnProperty.call(entity.combatStats, "maxHp")) { entity.combatStats.maxHp = next; wrote = true; }
      if (Object.prototype.hasOwnProperty.call(entity.combatStats, "maxHP")) { entity.combatStats.maxHP = next; wrote = true; }
    }
    if (!wrote) entity.maxHp = next;
    return next;
  }

  function readCurrentHp(entity = {}) {
    const combat = entity?.combatStats && typeof entity.combatStats === "object" ? entity.combatStats : {};
    const candidates = [entity.hp, entity.currentHp, entity.currentHP, entity.hp_actual, combat.hp_actual, combat.currentHp];
    const found = candidates.find((value) => Number.isFinite(Number(value)));
    return found == null ? null : Math.max(0, Number(found));
  }

  function writeCurrentHp(entity, value) {
    if (!entity || typeof entity !== "object") return null;
    const next = Math.max(0, numberOr(value, 0));
    let wrote = false;
    if (Object.prototype.hasOwnProperty.call(entity, "hp")) { entity.hp = next; wrote = true; }
    if (Object.prototype.hasOwnProperty.call(entity, "currentHp")) { entity.currentHp = next; wrote = true; }
    if (Object.prototype.hasOwnProperty.call(entity, "currentHP")) { entity.currentHP = next; wrote = true; }
    if (Object.prototype.hasOwnProperty.call(entity, "hp_actual")) { entity.hp_actual = next; wrote = true; }
    if (entity.combatStats && typeof entity.combatStats === "object") {
      if (Object.prototype.hasOwnProperty.call(entity.combatStats, "hp_actual")) { entity.combatStats.hp_actual = next; wrote = true; }
      if (Object.prototype.hasOwnProperty.call(entity.combatStats, "currentHp")) { entity.combatStats.currentHp = next; wrote = true; }
    }
    if (!wrote) entity.hp = next;
    return next;
  }

  function reconcileDecayMaxHp(unit) {
    const decay = status(unit, "decay");
    if (!decay || typeof decay !== "object") return null;
    const data = ensureStatusData(unit, "decay");
    if (!Number.isFinite(Number(data.baseMaxHp))) data.baseMaxHp = Math.max(1, readMaxHp(unit) || 1);
    const baseMaxHp = Math.max(1, numberOr(data.baseMaxHp, 1));
    const count = clamp(numberOr(decay.count, 0), 0, 99);
    const effectiveMaxHp = Math.max(1, Math.floor(baseMaxHp * (100 - count) / 100));
    writeMaxHp(unit, effectiveMaxHp);
    const currentHp = readCurrentHp(unit);
    if (currentHp != null && currentHp > effectiveMaxHp) writeCurrentHp(unit, effectiveMaxHp);
    return { baseMaxHp, effectiveMaxHp, count };
  }

  function restoreDecayMaxHp(unit, previous) {
    const base = numberOr(previous?.data?.baseMaxHp, NaN);
    if (!Number.isFinite(base)) return null;
    const restored = writeMaxHp(unit, Math.max(1, base));
    const currentHp = readCurrentHp(unit);
    if (currentHp != null && currentHp > restored) writeCurrentHp(unit, restored);
    return restored;
  }

  function applyStatus(unit, id, input = {}) {
    const engine = global.LuminousStatusEngine;
    if (engine?.applyStatus) return engine.applyStatus(unit, normalizeId(id), input);
    const target = store(unit);
    if (!target) return null;
    const key = normalizeId(id);
    const definition = registry()[key] || {};
    const count = Math.max(0, numberOr(input.count, 1));
    const potency = Math.max(0, numberOr(input.potency, 0));
    target[key] = {
      id: key,
      name: definition.name || id,
      count: definition.maxCount == null ? count : Math.min(count, definition.maxCount),
      potency: definition.maxPotency == null ? potency : Math.min(potency, definition.maxPotency),
      data: { ...(input.data || {}) },
    };
    onStatusApplied(unit, key, target[key], null, input, definition);
    return target[key];
  }

  function isWrathSkill(skill = {}) {
    const affinity = normalizeId(skill.affinity ?? skill.sinAffinity ?? skill.sin_affinity ?? skill.sin ?? skill.elementAffinity);
    return affinity === "wrath";
  }

  function isBurnContext(context = {}) {
    return normalizeId(context.statusId ?? context.sourceStatusId ?? context.source_status_id) === "burn";
  }

  function frozenShieldData(unit) {
    const frozen = status(unit, "frozen");
    if (!frozen || typeof frozen !== "object") return null;
    const data = ensureStatusData(unit, "frozen");
    data.shieldRemaining = Math.max(0, numberOr(data.shieldRemaining, 0));
    return data;
  }

  function grantFrozenShield(unit) {
    const data = frozenShieldData(unit);
    if (!data || data.shieldGranted) return 0;
    const maxHp = Math.max(1, readMaxHp(unit) || 1);
    const amount = Math.max(0, 100 + Math.floor(maxHp * 0.10));
    unit.shield = Math.max(0, numberOr(unit.shield, 0)) + amount;
    data.shieldGranted = amount;
    data.shieldRemaining = amount;
    return amount;
  }

  function updateFrozenShieldRemaining(unit, loss) {
    const data = frozenShieldData(unit);
    if (!data) return 0;
    const consumed = Math.min(data.shieldRemaining, Math.max(0, numberOr(loss, 0)));
    data.shieldRemaining -= consumed;
    return data.shieldRemaining;
  }

  function routeShieldDamage(unit, incomingDamage, context = {}) {
    const damage = Math.max(0, numberOr(incomingDamage, 0));
    const totalShield = Math.max(0, numberOr(unit?.shield, 0));
    if (!unit || totalShield <= 0 || damage <= 0) return null;

    const hasRadiance = countOf(unit, "radiance") > 0;
    const frozenData = frozenShieldData(unit);
    const frozenRemaining = Math.min(totalShield, Math.max(0, numberOr(frozenData?.shieldRemaining, 0)));
    const frozenVulnerable = Boolean(frozenData && (isWrathSkill(context.skillUsed || {}) || isBurnContext(context)));

    if (!hasRadiance && !frozenVulnerable) return null;

    if (hasRadiance) {
      const shieldLoss = Math.min(totalShield, damage * 2);
      const damageBudgetSpent = shieldLoss / 2;
      const remainingDamage = Math.max(0, damage - damageBudgetSpent);
      updateFrozenShieldRemaining(unit, shieldLoss);
      return { shieldAfter: Math.max(0, totalShield - shieldLoss), shieldLoss, remainingDamage, multiplier: 2 };
    }

    let budget = damage;
    let lossFrozen = 0;
    if (frozenRemaining > 0 && budget > 0) {
      lossFrozen = Math.min(frozenRemaining, budget * 2);
      budget -= lossFrozen / 2;
    }
    const otherShield = Math.max(0, totalShield - frozenRemaining);
    const lossOther = Math.min(otherShield, budget);
    budget -= lossOther;
    const shieldLoss = lossFrozen + lossOther;
    updateFrozenShieldRemaining(unit, lossFrozen);
    return {
      shieldAfter: Math.max(0, totalShield - shieldLoss),
      shieldLoss,
      remainingDamage: Math.max(0, budget),
      multiplier: lossFrozen > 0 ? 2 : 1,
    };
  }

  function onStatusApplied(unit, id, next, previous = null, input = {}) {
    const key = normalizeId(id);
    if (!unit || !next) return next;

    if (key === "chill" && countOf(unit, "chill") >= 20 && countOf(unit, "frozen") <= 0) {
      applyStatus(unit, "frozen", { mode: "set", count: 1, potency: 0, sourceTraitId: input.sourceTraitId, sourceUnitId: input.sourceUnitId });
    }

    if (key === "frozen" && !previous) grantFrozenShield(unit);
    if (key === "decay") reconcileDecayMaxHp(unit);

    if (key === "force") {
      const engine = global.CombatEngine;
      const forceCount = countOf(unit, "force");
      if (forceCount > 0 && typeof engine?.modifyNextStaggerThreshold === "function") {
        engine.modifyNextStaggerThreshold(unit, forceCount);
        removeStatus(unit, "force");
      } else if (forceCount > 0) {
        const data = ensureStatusData(unit, "force");
        if (data) data.pendingInstant = true;
      }
    }
    return next;
  }

  function onStatusRemoved(unit, id, previous) {
    if (normalizeId(id) === "decay") restoreDecayMaxHp(unit, previous);
  }

  function applyConcreteDamage(unit, amount, options = {}) {
    const engine = options.engine || global.CombatEngine;
    const damage = Math.max(0, Math.floor(numberOr(amount, 0)));
    if (!unit || !engine || typeof engine.applyDamage !== "function" || damage <= 0) return { amount: 0, hp: readCurrentHp(unit), shield: unit?.shield || 0 };
    return engine.applyDamage(unit, damage, options.tipoDaño || "efecto_estado", false, options.skillUsed || null, options.damageContext || null);
  }

  function applyDirectHpLoss(unit, amount) {
    const loss = Math.max(0, Math.floor(numberOr(amount, 0)));
    const before = readCurrentHp(unit);
    if (before == null || loss <= 0) return { loss: 0, before, after: before };
    const after = Math.max(0, before - loss);
    writeCurrentHp(unit, after);
    return { loss: before - after, before, after };
  }

  function onRoundStart(unit, runtime = {}) {
    if (!unit) return null;
    const engine = runtime.engine || global.CombatEngine;
    const result = {};

    const force = status(unit, "force");
    if (force?.data?.pendingInstant && countOf(unit, "force") > 0 && typeof engine?.modifyNextStaggerThreshold === "function") {
      const amount = countOf(unit, "force");
      engine.modifyNextStaggerThreshold(unit, amount);
      removeStatus(unit, "force");
      result.force = amount;
    }

    const shockCount = countOf(unit, "shock");
    if (shockCount >= 3) {
      const paralyze = Math.floor(shockCount / 3);
      applyStatus(unit, "paralyze", { count: paralyze, potency: 0 });
      reduceCount(unit, "shock", paralyze * 3);
      result.shock = { paralyze, remaining: countOf(unit, "shock") };
    }

    const corrosionCount = countOf(unit, "corrosion");
    if (corrosionCount > 0) {
      const maxHp = Math.max(1, readMaxHp(unit) || 1);
      const damage = Math.max(0, Math.floor(maxHp * corrosionCount / 100));
      if (damage > 0) applyConcreteDamage(unit, damage, { engine, damageContext: { statusId: "corrosion", suppressRadianceTrigger: true } });
      reduceCount(unit, "corrosion", 1);
      result.corrosion = { damage, remaining: countOf(unit, "corrosion") };
    }

    if (countOf(unit, "frozen") > 0) {
      const maxHp = Math.max(1, readMaxHp(unit) || 1);
      const loss = Math.max(1, Math.floor(maxHp * 0.05));
      result.frozen = applyDirectHpLoss(unit, loss);
    }
    return result;
  }

  function onRoundEnd(unit, runtime = {}) {
    if (!unit) return null;
    const engine = runtime.engine || global.CombatEngine;
    const result = {};
    const poison = status(unit, "poison");
    if (poison && typeof poison === "object") {
      const count = Math.max(0, numberOr(poison.count, 0));
      const wasPoisoned = countOf(unit, "poisoned") > 0;
      const data = ensureStatusData(unit, "poison") || {};
      const multiplier = wasPoisoned ? clamp(numberOr(data.damageMultiplier, 2), 2, 3) : 1;
      const damage = Math.max(0, Math.floor(count * multiplier));
      if (damage > 0) applyConcreteDamage(unit, damage, { engine, damageContext: { statusId: "poison", suppressRadianceTrigger: true } });

      poison.potency = Math.min(10, Math.max(0, numberOr(poison.potency, 0)) + 1);
      if (poison.potency >= 10) {
        if (wasPoisoned) data.damageMultiplier = 3;
        else {
          applyStatus(unit, "poisoned", { mode: "set", count: 1, potency: 0 });
          data.damageMultiplier = 2;
        }
        poison.potency = 0;
      }

      const remaining = Math.floor(count / 2);
      setCount(unit, "poison", remaining);
      result.poison = { damage, multiplier, remaining, potency: potencyOf(unit, "poison"), poisoned: countOf(unit, "poisoned") > 0 };
    }
    return result;
  }

  function onHit(unit, hitDamage, context = {}) {
    if (!unit) return null;
    const result = {};
    if (isWrathSkill(context.skillUsed || context.skill || {})) {
      const before = countOf(unit, "chill");
      if (before > 0) {
        reduceCount(unit, "chill", 2);
        result.chillFromWrath = before - countOf(unit, "chill");
      }
    }

    const radianceCount = countOf(unit, "radiance");
    const suppress = Boolean(context.suppressRadianceTrigger || context.damageContext?.suppressRadianceTrigger);
    if (!suppress && radianceCount > 0 && context.tipoDaño === "directo") {
      const steps = Math.floor(radianceCount / 2);
      const extra = Math.max(0, Math.floor(Math.max(0, numberOr(hitDamage, 0)) * steps / 100));
      if (extra > 0) {
        applyConcreteDamage(unit, extra, {
          engine: context.engine,
          damageContext: { statusId: "radiance", suppressRadianceTrigger: true },
        });
      }
      result.radiance = { extra, steps };
    }
    return result;
  }

  function onBurnDamage(unit) {
    const before = countOf(unit, "chill");
    if (before <= 0) return 0;
    reduceCount(unit, "chill", 1);
    return before - countOf(unit, "chill");
  }

  function onHealingReceived(unit, options = {}) {
    if (!unit || countOf(unit, "decay") <= 0) return 0;
    const amount = options.passiveRegeneration || normalizeId(options.source) === "passive_regeneration" ? 2 : 5;
    const before = countOf(unit, "decay");
    reduceCount(unit, "decay", amount);
    return before - countOf(unit, "decay");
  }

  function onRest(unit, type) {
    const restType = normalizeId(type);
    const result = {};
    if (restType === "short_rest") {
      const decay = countOf(unit, "decay");
      if (decay > 0) {
        setCount(unit, "decay", Math.floor(decay / 2));
        result.decay = countOf(unit, "decay");
      }
      if (countOf(unit, "radiance") > 0) {
        reduceCount(unit, "radiance", 5);
        result.radiance = countOf(unit, "radiance");
      }
    } else if (restType === "long_rest") {
      if (countOf(unit, "decay") > 0) removeStatus(unit, "decay");
      if (countOf(unit, "radiance") > 0) removeStatus(unit, "radiance");
      result.decay = 0;
      result.radiance = 0;
    }
    return result;
  }

  function onEncounterEnd(units = []) {
    const result = [];
    (Array.isArray(units) ? units : []).forEach((unit) => {
      const before = countOf(unit, "radiance");
      if (before > 0) reduceCount(unit, "radiance", 2);
      result.push({ unit, before, after: countOf(unit, "radiance") });
    });
    return result;
  }

  function patchStatusEngine() {
    const source = global.LuminousStatusEngine;
    if (!source || source.__elementalStatusRuntimeBridge) return Boolean(source);

    const wrapped = Object.freeze({
      ...source,
      __elementalStatusRuntimeBridge: true,
      applyStatus(unit, statusId, input = {}) {
        const key = normalizeId(statusId);
        const previous = source.getStatus?.(unit, key) || null;
        const applied = source.applyStatus(unit, key, input);
        const actual = store(unit)?.[key] || applied;
        const definition = registry()[key] || source.getDefinition?.(key) || {};
        if (actual && typeof actual === "object") {
          if (definition.maxCount != null) actual.count = Math.min(Math.max(0, numberOr(actual.count, 0)), Number(definition.maxCount));
          if (definition.maxPotency != null) actual.potency = Math.min(Math.max(0, numberOr(actual.potency, 0)), Number(definition.maxPotency));
        }
        onStatusApplied(unit, key, actual, previous, input, definition);
        return actual;
      },
      removeStatus(unit, statusId) {
        const key = normalizeId(statusId);
        const previous = source.getStatus?.(unit, key) || null;
        const outcome = source.removeStatus(unit, key);
        const removed = outcome && typeof outcome === "object" ? Boolean(outcome.removed) : Boolean(outcome);
        if (removed) onStatusRemoved(unit, key, previous);
        return outcome;
      },
    });
    global.LuminousStatusEngine = wrapped;
    return true;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__elementalStatusRuntimeBridge) return Boolean(engine);

    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalProcessStatusEffects = typeof engine.processStatusEffects === "function" ? engine.processStatusEffects : null;

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, tipoDaño = "directo", isCritical = false, skillUsed = null, damageContext = null) {
        const normalizedType = normalizeId(tipoDaño);
        const context = { engine: this, unit, tipoDaño, isCritical, skillUsed, damageContext, ...(damageContext || {}) };
        const skipAutomatic = skillUsed && ["spell", "roll", "save"].includes(normalizeId(skillUsed.type));
        if (skipAutomatic) return originalApplyDamage.call(this, unit, damage, tipoDaño, isCritical, skillUsed);

        const routed = routeShieldDamage(unit, damage, { ...context, skillUsed, ...(damageContext || {}) });
        let result;
        if (routed) {
          const shieldBefore = Math.max(0, numberOr(unit.shield, 0));
          unit.shield = 0;
          result = originalApplyDamage.call(this, unit, routed.remainingDamage, tipoDaño, isCritical, skillUsed);
          unit.shield = routed.shieldAfter;
          result = { ...(result || {}), shield: unit.shield, shieldBefore, shieldLoss: routed.shieldLoss };
        } else {
          result = originalApplyDamage.call(this, unit, damage, tipoDaño, isCritical, skillUsed);
        }

        if (normalizedType === "directo") onHit(unit, damage, context);
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        if (phaseTag === "[Round Start]") (allUnits || []).forEach((unit) => onRoundStart(unit, { engine: this, allUnits }));
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (phaseTag === "[Round End]") (allUnits || []).forEach((unit) => onRoundEnd(unit, { engine: this, allUnits }));
        return result;
      };
    }

    if (originalProcessStatusEffects) {
      engine.processStatusEffects = function (unit, triggerKey, context = {}) {
        const hpBefore = readCurrentHp(unit);
        const normalizedTrigger = normalizeId(triggerKey);
        const burn = normalizedTrigger === "on_round_end" ? status(unit, "burn") : null;
        const burnConfig = registry().burn;
        const burnRules = burnConfig && Array.isArray(burnConfig.rules) ? burnConfig.rules : null;
        let result;

        if (burn && burnRules) burnConfig.rules = [];
        try {
          result = originalProcessStatusEffects.call(this, unit, triggerKey, context);
        } finally {
          if (burn && burnRules) burnConfig.rules = burnRules;
        }

        if (burn && normalizedTrigger === "on_round_end") {
          const burnPotency = typeof burn === "object" ? Math.max(0, numberOr(burn.potency, 0)) : 0;
          if (burnPotency > 0) {
            applyConcreteDamage(unit, burnPotency, {
              engine: this,
              damageContext: { statusId: "burn", suppressRadianceTrigger: true },
            });
            onBurnDamage(unit);
          }
          reduceCount(unit, "burn", 1);
        }

        const hpAfter = readCurrentHp(unit);
        if (hpBefore != null && hpAfter != null && hpAfter > hpBefore) {
          onHealingReceived(unit, {
            source: context?.passiveRegeneration || context?.passive_regeneration ? "passive_regeneration" : "status_healing",
            passiveRegeneration: Boolean(context?.passiveRegeneration || context?.passive_regeneration),
          });
        }
        return result;
      };
    }

    if (typeof engine.triggerEncounterEnd !== "function") {
      engine.triggerEncounterEnd = function (allUnits = []) {
        onEncounterEnd(allUnits);
        return this.currentState;
      };
    } else {
      const originalEncounterEnd = engine.triggerEncounterEnd;
      engine.triggerEncounterEnd = function (allUnits = [], ...rest) {
        const result = originalEncounterEnd.call(this, allUnits, ...rest);
        onEncounterEnd(allUnits);
        return result;
      };
    }

    Object.defineProperty(engine, "__elementalStatusRuntimeBridge", { value: true, configurable: true });
    return true;
  }

  function patchRestEngine() {
    const source = global.LuminousRestEngine;
    if (!source || source.__elementalStatusRuntimeBridge) return Boolean(source);

    const originalShortRest = typeof source.performShortRest === "function" ? source.performShortRest.bind(source) : null;
    const originalLongRest = typeof source.performLongRest === "function" ? source.performLongRest.bind(source) : null;
    if (!originalShortRest || !originalLongRest) return false;

    const wrapped = Object.freeze({
      ...source,
      __elementalStatusRuntimeBridge: true,
      performShortRest(character, options = {}) {
        const result = originalShortRest(character, options);
        if (!result?.success) return result;
        const target = options.healTarget || character;
        (result.recovers || []).forEach((entry) => {
          if (numberOr(entry?.healedHp, 0) > 0) onHealingReceived(target, { source: "short_rest_recover" });
        });
        onRest(target, "short_rest");
        if (target !== character) onRest(character, "short_rest");
        return result;
      },
      performLongRest(character, options = {}) {
        const result = originalLongRest(character, options);
        if (!result?.success) return result;
        const target = options.healTarget || character;
        if (numberOr(result?.healing?.amount, 0) > 0) onHealingReceived(target, { source: "long_rest_healing" });
        onRest(target, "long_rest");
        if (target !== character) onRest(character, "long_rest");
        return result;
      },
    });
    global.LuminousRestEngine = wrapped;
    return true;
  }

  function patchAll() {
    registerStatuses();
    return {
      status: patchStatusEngine(),
      combat: patchCombatEngine(),
      rest: patchRestEngine(),
    };
  }

  const api = Object.freeze({
    ELEMENT_TO_SIN,
    ELEMENT_TO_STATUS,
    STATUS_DEFINITIONS,
    registerStatuses,
    status,
    countOf,
    potencyOf,
    reduceCount,
    setCount,
    readMaxHp,
    writeMaxHp,
    readCurrentHp,
    writeCurrentHp,
    reconcileDecayMaxHp,
    routeShieldDamage,
    onStatusApplied,
    onStatusRemoved,
    onRoundStart,
    onRoundEnd,
    onHit,
    onBurnDamage,
    onHealingReceived,
    onRest,
    onEncounterEnd,
    patchStatusEngine,
    patchCombatEngine,
    patchRestEngine,
    patchAll,
  });

  global.LuminousElementalStatusRuntime = api;
  patchAll();
  const timer = typeof global.setInterval === "function" ? global.setInterval(patchAll, PATCH_INTERVAL_MS) : null;
  timer?.unref?.();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
