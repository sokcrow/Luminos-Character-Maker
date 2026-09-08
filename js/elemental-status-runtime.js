(function (global) {
  "use strict";

  if (global.LuminousElementalStatusRuntime?.version === "0.7.3") {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousElementalStatusRuntime;
    return;
  }

  const PATCH_INTERVAL_MS = 250;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const ELEMENT_TO_SIN = Object.freeze({
    fire: "Wrath", cold: "Gloom", lightning: "Envy", acid: "Gluttony", poison: "Gluttony",
    necrotic: "Gloom", radiant: "Pride", psychic: "Lust", thunder: "Wrath", force: "Sloth",
  });

  const ELEMENT_TO_STATUS = Object.freeze({
    fire: "burn", cold: "chill", lightning: "shock", acid: "corrosion", poison: "poison",
    necrotic: "decay", radiant: "radiance", psychic: "sinking", thunder: "tremor", force: null,
  });

  const STATUS_DEFINITIONS = Object.freeze({
    burn: Object.freeze({
      name: "Burn", type: "negative", mode: "double", icon: "https://imgur.com/L4bRd44.png",
      rules: Object.freeze([{ trigger: "on_round_end", cond_input: 1, cond_type: "potency", operation: "sub", aff_input: 1, affectation: "hp", decay: "sub_count_1" }]),
      description: "At Turn End, take Fixed Damage equal to Potency, then lose 1 Count.",
    }),
    tremor: Object.freeze({
      name: "Tremor", type: "negative", mode: "double", icon: "https://imgur.com/fuDGjpn.png",
      rules: Object.freeze([{ trigger: "on_tremor_burst", cond_input: 1, cond_type: "potency", operation: "add", aff_input: 1, affectation: "stagger_threshold", decay: "sub_count_1" }]),
      description: "When Tremor Burst occurs, raise the remaining Stagger Threshold by Potency, then lose 1 Count.",
    }),
    sinking: Object.freeze({
      name: "Sinking", type: "negative", mode: "double", icon: "https://imgur.com/ZnulGzZ.png", rules: Object.freeze([]),
      description: "On Hit, take Fixed SP Damage equal to Potency. Units without SP take normal Gloom Damage instead. Then lose 1 Count.",
    }),
    paralyze: Object.freeze({
      name: "Paralysis", type: "negative", mode: "single", icon: "https://imgur.com/9TkO8Ce.png", rules: Object.freeze([]),
      description: "When a Coin rolls Heads, that Coin's Coin Power becomes 0 and 1 Count is consumed.",
    }),
    chill: Object.freeze({
      name: "Chill", type: "negative", mode: "single", icon: "https://imgur.com/kJY0rBP.png",
      rules: Object.freeze([{ trigger: "passive", cond_input: 2, cond_type: "count", operation: "sub", aff_input: 1, affectation: "speed", decay: "none" }]),
      description: "Speed is Reduced by 1 every 2 Count. At Turn End, reaching the Size Cold threshold consumes Chill and gains 1 Frozen. Frozen doubles Chill gained.",
    }),
    frozen: Object.freeze({
      name: "Frozen", type: "negative", mode: "single", maxCount: 5, icon: "https://imgur.com/dbhWrJQ.png", rules: Object.freeze([]),
      description: "Gain a Frozen Shield equal to 100 + 10% Max HP. Chill gained is doubled. At Turn End take 5% Max HP Fixed Damage. If the Frozen Shield breaks, lose Frozen. At 5 Count, be Annihilated.",
    }),
    shock: Object.freeze({
      name: "Shock", type: "negative", mode: "single", icon: "https://imgur.com/KMQuv3T.png", rules: Object.freeze([]),
      description: "At Turn Start, every 3 Count grants 1 Paralysis and consumes those 3 Count.",
    }),
    corrosion: Object.freeze({
      name: "Corrosion", type: "negative", mode: "single", maxCount: 10, icon: "https://imgur.com/gUySOsd.png",
      rules: Object.freeze([
        { trigger: "passive", cond_input: 2, cond_type: "count", operation: "sub", aff_input: 1, affectation: "offensive_level", decay: "none" },
        { trigger: "passive", cond_input: 2, cond_type: "count", operation: "sub", aff_input: 1, affectation: "defensive_level", decay: "none" },
      ]),
      description: "Max 10 Count. Offensive and Defensive Level are Reduced by 1 every 2 Count. At Turn Start take 1% Max HP Fixed Damage per Count, then lose 1 Count.",
    }),
    poison: Object.freeze({
      name: "Poison", type: "negative", mode: "double", icon: "https://imgur.com/FNjARTt.png",
      rules: Object.freeze([{ trigger: "passive", cond_input: 3, cond_type: "potency", operation: "sub", aff_input: 1, affectation: "clash_power", decay: "none" }]),
      description: "Potency is persistent intoxication; Count is active Poison damage. At Turn End take Fixed Damage equal to Count, increased by 50% per Potency; gain 1 Potency every 5 Count, then halve Count (Floor). Ability/Skill Check Threshold +2 every 2 Potency; Clash Power -1 every 3 Potency. Short Rest -3 Potency; Long Rest -6 Potency. Poison persists between Encounters at 1+ Potency.",
    }),
    decay: Object.freeze({
      name: "Decay", type: "negative", mode: "single", maxCount: 99, icon: "https://imgur.com/TBIak3k.png", rules: Object.freeze([]),
      description: "Max 99 Count. Reduce Max HP by 1% of original Max HP per Count and immediately recalculate Stagger Thresholds. Removing Decay restores Max HP but does not heal. Healing -5 Count; Passive Regeneration -2; Short Rest halves Count; Long Rest removes it.",
    }),
    radiance: Object.freeze({
      name: "Radiance", type: "negative", mode: "single", maxCount: 10, icon: "https://imgur.com/kT4mJUi.png", rules: Object.freeze([]),
      description: "Max 10 Count. On Hit take extra Fixed Damage equal to 1% of final Hit damage every 2 Count. Shields take double damage and Radiance-only overflow never reaches HP. Encounter End -2 Count; Short Rest -5; Long Rest removes it.",
    }),
  });

  const SIZE_CHILL_THRESHOLD = Object.freeze({ tiny: 5, small: 10, medium: 20, large: 40, huge: 80, gargantuan: 160 });

  function registry() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    return global.STATUS_REGISTRY;
  }

  function registerStatuses() {
    const target = registry();
    Object.entries(STATUS_DEFINITIONS).forEach(([id, definition]) => {
      target[id] = { ...(target[id] || {}), ...definition, rules: Array.from(definition.rules || []) };
    });
    delete target.poisoned;
    delete target.force;
    delete target.paralysis;
    return target;
  }

  function statusKey(id) {
    const key = normalizeId(id);
    return key === "paralysis" ? "paralyze" : key;
  }

  function store(unit) {
    if (!unit || typeof unit !== "object") return null;
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    return unit.statusEffects;
  }
  function status(unit, id) { return store(unit)?.[statusKey(id)] || null; }
  function countOf(unit, id) {
    const value = status(unit, id);
    if (value == null) return 0;
    if (typeof value === "number") return Math.max(0, numberOr(value, 0));
    return Math.max(0, numberOr(value.count, 0));
  }
  function potencyOf(unit, id) {
    const value = status(unit, id);
    return value && typeof value === "object" ? Math.max(0, numberOr(value.potency, 0)) : 0;
  }
  function ensureData(unit, id) {
    const value = status(unit, id);
    if (!value || typeof value !== "object") return null;
    if (!value.data || typeof value.data !== "object" || Array.isArray(value.data)) value.data = {};
    return value.data;
  }

  function rawRemoveStatus(unit, id) {
    const target = store(unit);
    const key = statusKey(id);
    if (!target?.[key]) return false;
    const previous = target[key];
    delete target[key];
    onStatusRemoved(unit, key, previous);
    return true;
  }

  function removeStatus(unit, id, options = {}) {
    const key = statusKey(id);
    const previous = status(unit, key);
    const engine = global.LuminousStatusEngine;
    if (engine?.removeStatus && !options.__elementalInternal) {
      const result = engine.removeStatus(unit, key, options);
      const removed = typeof result === "object" ? Boolean(result.removed) : Boolean(result);
      if (removed) onStatusRemoved(unit, key, previous);
      return result;
    }
    return rawRemoveStatus(unit, key);
  }

  function keepPoisonWhenPotent(unit) {
    const poison = status(unit, "poison");
    return Boolean(poison && typeof poison === "object" && potencyOf(unit, "poison") > 0);
  }

  function setCount(unit, id, count) {
    const key = statusKey(id);
    const target = store(unit);
    const current = target?.[key];
    if (current == null) return 0;
    const next = Math.max(0, Math.floor(numberOr(count, 0)));
    if (next <= 0) {
      if (key === "poison" && keepPoisonWhenPotent(unit)) {
        current.count = 0;
        return 0;
      }
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

  function reduceCount(unit, id, amount) { return setCount(unit, id, countOf(unit, id) - Math.max(0, numberOr(amount, 0))); }
  function setPotency(unit, id, potency) {
    const current = status(unit, id);
    if (!current || typeof current !== "object") return 0;
    current.potency = Math.max(0, Math.floor(numberOr(potency, 0)));
    if (statusKey(id) === "poison" && current.potency <= 0 && countOf(unit, "poison") <= 0) rawRemoveStatus(unit, "poison");
    return current.potency;
  }

  function readMaxHp(entity = {}) {
    const combat = entity?.combatStats && typeof entity.combatStats === "object" ? entity.combatStats : {};
    const found = [entity.maxHp, entity.maxHP, entity.hp_max, combat.hp_max, combat.maxHp, combat.maxHP].find((v) => Number.isFinite(Number(v)));
    return found == null ? null : Math.max(0, Number(found));
  }
  function writeMaxHp(entity, value) {
    if (!entity || typeof entity !== "object") return null;
    const next = Math.max(1, Math.floor(numberOr(value, 1)));
    let wrote = false;
    for (const key of ["maxHp", "maxHP", "hp_max"]) if (Object.prototype.hasOwnProperty.call(entity, key)) { entity[key] = next; wrote = true; }
    if (entity.combatStats && typeof entity.combatStats === "object") {
      for (const key of ["hp_max", "maxHp", "maxHP"]) if (Object.prototype.hasOwnProperty.call(entity.combatStats, key)) { entity.combatStats[key] = next; wrote = true; }
    }
    if (!wrote) entity.maxHp = next;
    return next;
  }
  function readCurrentHp(entity = {}) {
    const combat = entity?.combatStats && typeof entity.combatStats === "object" ? entity.combatStats : {};
    const found = [entity.hp, entity.currentHp, entity.currentHP, entity.hp_actual, combat.hp_actual, combat.currentHp].find((v) => Number.isFinite(Number(v)));
    return found == null ? null : Math.max(0, Number(found));
  }
  function writeCurrentHp(entity, value) {
    if (!entity || typeof entity !== "object") return null;
    const next = Math.max(0, Math.floor(numberOr(value, 0)));
    let wrote = false;
    for (const key of ["hp", "currentHp", "currentHP", "hp_actual"]) if (Object.prototype.hasOwnProperty.call(entity, key)) { entity[key] = next; wrote = true; }
    if (entity.combatStats && typeof entity.combatStats === "object") {
      for (const key of ["hp_actual", "currentHp"]) if (Object.prototype.hasOwnProperty.call(entity.combatStats, key)) { entity.combatStats[key] = next; wrote = true; }
    }
    if (!wrote) entity.hp = next;
    return next;
  }

  function recalcStagger(unit) {
    const engine = global.CombatEngine;
    if (typeof engine?.recalculateStaggerThresholds === "function") return engine.recalculateStaggerThresholds(unit);
    if (typeof unit?.recalculateStaggerThresholds === "function") return unit.recalculateStaggerThresholds();
    const percents = unit?.staggerThresholdPercents || unit?.stagger_threshold_percents;
    if (Array.isArray(percents)) {
      const maxHp = Math.max(1, readMaxHp(unit) || 1);
      unit.staggerThresholds = percents.map((p) => Math.floor(maxHp * Number(p) / 100));
      return unit.staggerThresholds;
    }
    return null;
  }

  function reconcileDecayMaxHp(unit) {
    const entry = status(unit, "decay");
    if (!entry || typeof entry !== "object") return null;
    const data = ensureData(unit, "decay");
    if (!Number.isFinite(Number(data.originalMaxHp))) data.originalMaxHp = Math.max(1, readMaxHp(unit) || 1);
    const originalMaxHp = Math.max(1, numberOr(data.originalMaxHp, 1));
    const count = clamp(countOf(unit, "decay"), 0, 99);
    const effectiveMaxHp = Math.max(1, Math.floor(originalMaxHp * (100 - count) / 100));
    writeMaxHp(unit, effectiveMaxHp);
    const hp = readCurrentHp(unit);
    if (hp != null && hp > effectiveMaxHp) writeCurrentHp(unit, effectiveMaxHp);
    recalcStagger(unit);
    return { originalMaxHp, effectiveMaxHp, count };
  }
  function restoreDecayMaxHp(unit, previous) {
    const original = numberOr(previous?.data?.originalMaxHp ?? previous?.data?.baseMaxHp, NaN);
    if (!Number.isFinite(original)) return null;
    const restored = writeMaxHp(unit, original);
    const hp = readCurrentHp(unit);
    if (hp != null && hp > restored) writeCurrentHp(unit, restored);
    recalcStagger(unit);
    return restored;
  }

  function unitSize(unit = {}) { return normalizeId(unit.size || unit.unitSize || unit.unit_size || unit.creatureSize || "medium"); }
  function coldDisposition(unit = {}) {
    const explicit = normalizeId(unit.coldDisposition || unit.cold_disposition || unit.elementResistances?.cold || unit.resistances?.cold || "");
    const immune = unit.coldImmune === true || unit.immunities?.includes?.("cold") || ["immune", "immunity", "0"].includes(explicit);
    const resistant = !immune && (unit.coldResistant === true || unit.resistances?.includes?.("cold") || ["resist", "resistant", "half"].includes(explicit));
    return { immune, resistant };
  }
  function chillThreshold(unit = {}) {
    const base = SIZE_CHILL_THRESHOLD[unitSize(unit)] || SIZE_CHILL_THRESHOLD.medium;
    return base * (coldDisposition(unit).resistant ? 3 : 1);
  }

  function frozenData(unit) {
    const entry = status(unit, "frozen");
    if (!entry || typeof entry !== "object") return null;
    const data = ensureData(unit, "frozen");
    data.shieldRemaining = Math.max(0, numberOr(data.shieldRemaining, 0));
    return data;
  }
  function grantFrozenShield(unit) {
    const data = frozenData(unit);
    if (!data || data.shieldGranted) return 0;
    const amount = 100 + Math.floor(Math.max(1, readMaxHp(unit) || 1) * 0.10);
    unit.shield = Math.max(0, numberOr(unit.shield, 0)) + amount;
    data.shieldGranted = amount;
    data.shieldRemaining = amount;
    return amount;
  }
  function breakFrozen(unit, reason = "shield_break") {
    const entry = status(unit, "frozen");
    if (!entry) return false;
    rawRemoveStatus(unit, "frozen");
    try { global.dispatchEvent?.(new global.CustomEvent("luminous:frozen-broken", { detail: { unit, reason } })); } catch (_) {}
    return true;
  }

  function annihilate(unit, reason = "frozen_5") {
    unit.hp = 0;
    unit.dead = true;
    unit.defeated = true;
    unit.lifeState = "annihilated";
    unit.annihilated = true;
    try { global.dispatchEvent?.(new global.CustomEvent("luminous:unit-annihilated", { detail: { unit, reason } })); } catch (_) {}
  }

  function applyStatus(unit, id, input = {}) {
    const key = statusKey(id);
    if (key === "poisoned" || key === "force") return null;
    if ((key === "chill" || key === "frozen") && normalizeId(input.element || input.sourceElement) === "cold" && coldDisposition(unit).immune) return null;
    const payload = { ...input };
    if (key === "chill" && countOf(unit, "frozen") > 0 && !payload.__alreadyFrozenScaled) {
      payload.count = Math.max(0, numberOr(payload.count, 1)) * 2;
      payload.__alreadyFrozenScaled = true;
    }
    const engine = global.LuminousStatusEngine;
    if (engine?.applyStatus) return engine.applyStatus(unit, key, payload);
    const target = store(unit);
    const definition = registry()[key] || {};
    const existing = target[key] && typeof target[key] === "object" ? target[key] : null;
    const mode = normalizeId(payload.mode || "gain");
    const next = existing || { id: key, name: definition.name || key, count: 0, potency: 0, data: {} };
    if (mode === "set") { next.count = Math.max(0, numberOr(payload.count, 1)); next.potency = Math.max(0, numberOr(payload.potency, 0)); }
    else { next.count += Math.max(0, numberOr(payload.count, 1)); next.potency += Math.max(0, numberOr(payload.potency, 0)); }
    if (definition.maxCount != null) next.count = Math.min(next.count, definition.maxCount);
    next.data = { ...(next.data || {}), ...(payload.data || {}) };
    target[key] = next;
    onStatusApplied(unit, key, next, existing, payload, definition);
    return next;
  }

  function onStatusApplied(unit, id, next, previous = null) {
    const key = normalizeId(id);
    if (!unit || !next) return next;
    if (key === "frozen") {
      if (!previous) grantFrozenShield(unit);
      if (countOf(unit, "frozen") >= 5) annihilate(unit);
    }
    if (key === "decay") reconcileDecayMaxHp(unit);
    return next;
  }
  function onStatusRemoved(unit, id, previous) {
    const key = normalizeId(id);
    if (key === "decay") restoreDecayMaxHp(unit, previous);
  }

  function applyFixedDamage(unit, amount, context = {}) {
    const damage = Math.max(0, Math.floor(numberOr(amount, 0)));
    if (!unit || damage <= 0) return { amount: 0 };
    const fixed = global.LuminousFixedDamageRuntime;
    if (typeof fixed?.applyFixedDamage === "function") return fixed.applyFixedDamage(unit, damage, context);
    const before = readCurrentHp(unit) || 0;
    writeCurrentHp(unit, Math.max(0, before - damage));
    return { amount: Math.min(before, damage), before, after: readCurrentHp(unit) };
  }

  function poisonDamage(unit) {
    const count = countOf(unit, "poison");
    const potency = potencyOf(unit, "poison");
    return Math.floor(count * (1 + potency * 0.5));
  }
  function poisonCheckThresholdPenalty(unit) { return Math.floor(potencyOf(unit, "poison") / 2) * 2; }
  function poisonClashPenalty(unit) { return Math.floor(potencyOf(unit, "poison") / 3); }

  function hasSpResource(unit = {}) {
    return ["sp", "currentSp", "currentSP", "sp_actual"].some((key) => Object.prototype.hasOwnProperty.call(unit, key))
      || Boolean(unit.combatStats && ["sp", "sp_actual", "currentSp", "currentSP"].some((key) => Object.prototype.hasOwnProperty.call(unit.combatStats, key)));
  }

  function readSp(unit = {}) {
    const combat = unit.combatStats && typeof unit.combatStats === "object" ? unit.combatStats : {};
    const found = [unit.sp, unit.currentSp, unit.currentSP, unit.sp_actual, combat.sp, combat.sp_actual, combat.currentSp, combat.currentSP].find((v) => Number.isFinite(Number(v)));
    return found == null ? 0 : Number(found);
  }

  function writeSp(unit, value) {
    const next = Math.max(-45, Math.min(45, Math.floor(numberOr(value, 0))));
    if (Object.prototype.hasOwnProperty.call(unit, "sp")) unit.sp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentSp")) unit.currentSp = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "sp_actual")) unit.combatStats.sp_actual = next;
    else unit.sp = next;
    return next;
  }

  function sinResistanceValue(unit = {}, sin = "gloom") {
    const key = normalizeId(sin);
    const table = unit.sinResistances || unit.sin_resistances || unit.sinResistance || unit.sin_resistance;
    if (table && typeof table === "object" && Number.isFinite(Number(table[key] ?? table[sin] ?? table[String(sin).toUpperCase()]))) return Number(table[key] ?? table[sin] ?? table[String(sin).toUpperCase()]);
    if (Number.isFinite(Number(unit.sinRes))) return Number(unit.sinRes);
    return 1;
  }

  function applyGloomDamage(unit, amount, context = {}) {
    const base = Math.max(0, Math.floor(numberOr(amount, 0)));
    if (!unit || base <= 0) return 0;
    const resistance = sinResistanceValue(unit, "gloom");
    const engine = context.engine || global.CombatEngine;
    const resistanceMod = typeof engine?.calculateResistanceModifier === "function" ? numberOr(engine.calculateResistanceModifier(resistance), 0) : (resistance - 1);
    const damage = Math.max(1, Math.floor(base * Math.max(0, 1 + resistanceMod)));
    if (typeof engine?.applyDamage === "function") {
      const result = engine.applyDamage(unit, damage, "Gloom", false, { name: "Sinking", sinAffinity: "Gloom", element: "psychic", __sinkingFallback: true });
      return Math.max(0, Math.floor(numberOr(result?.damageTaken ?? result?.damage ?? result?.hpDamage, damage)));
    }
    applyFixedDamage(unit, damage, { statusId: "sinking", trigger: "on_hit_gloom_fallback" });
    return damage;
  }

  function resolveSinkingHit(unit, context = {}) {
    const entry = status(unit, "sinking");
    if (!entry || countOf(unit, "sinking") <= 0) return null;
    const potency = potencyOf(unit, "sinking");
    let damage = 0; let damageType = "sp";
    if (potency > 0 && hasSpResource(unit)) {
      const engine = context.engine || global.CombatEngine;
      if (typeof engine?.applySPDamage === "function") engine.applySPDamage(unit, potency);
      else if (typeof engine?.applySpDamage === "function") engine.applySpDamage(unit, potency);
      else writeSp(unit, readSp(unit) - potency);
      damage = potency;
    } else if (potency > 0) {
      damageType = "gloom";
      damage = applyGloomDamage(unit, potency, context);
    }
    reduceCount(unit, "sinking", 1);
    return { potency, damage, damageType, remaining: countOf(unit, "sinking") };
  }

  function onTurnStart(unit, runtime = {}) {
    if (!unit) return {};
    const out = {};
    const shock = countOf(unit, "shock");
    if (shock >= 3) {
      const gained = Math.floor(shock / 3);
      applyStatus(unit, "paralyze", { count: gained, mode: "gain", data: { sourceStatus: "shock" } });
      reduceCount(unit, "shock", gained * 3);
      out.shock = { paralysis: gained, remaining: countOf(unit, "shock") };
    }
    const corrosion = countOf(unit, "corrosion");
    if (corrosion > 0) {
      const damage = Math.floor(Math.max(1, readMaxHp(unit) || 1) * corrosion / 100);
      if (damage > 0) applyFixedDamage(unit, damage, { statusId: "corrosion", trigger: "turn_start" });
      reduceCount(unit, "corrosion", 1);
      out.corrosion = { damage, remaining: countOf(unit, "corrosion") };
    }
    return out;
  }

  function onTurnEnd(unit, runtime = {}) {
    if (!unit) return {};
    const out = {};

    if (countOf(unit, "frozen") > 0) {
      const damage = Math.max(1, Math.floor(Math.max(1, readMaxHp(unit) || 1) * 0.05));
      applyFixedDamage(unit, damage, { statusId: "frozen", trigger: "turn_end" });
      out.frozen = { damage, count: countOf(unit, "frozen") };
    }

    const burn = status(unit, "burn");
    if (burn && typeof burn === "object") {
      const potency = potencyOf(unit, "burn");
      if (potency > 0) {
        applyFixedDamage(unit, potency, { statusId: "burn", trigger: "turn_end" });
        if (countOf(unit, "chill") > 0) reduceCount(unit, "chill", 1);
      }
      reduceCount(unit, "burn", 1);
      out.burn = { damage: potency, remaining: countOf(unit, "burn") };
    }

    const poison = status(unit, "poison");
    if (poison && typeof poison === "object") {
      const count = countOf(unit, "poison");
      const damage = poisonDamage(unit);
      if (damage > 0) applyFixedDamage(unit, damage, { statusId: "poison", trigger: "turn_end" });
      const gainedPotency = Math.floor(count / 5);
      poison.potency = Math.max(0, potencyOf(unit, "poison") + gainedPotency);
      poison.count = Math.floor(count / 2);
      if (poison.potency <= 0 && poison.count <= 0) rawRemoveStatus(unit, "poison");
      out.poison = { damage, gainedPotency, potency: potencyOf(unit, "poison"), count: countOf(unit, "poison") };
    }

    const chill = countOf(unit, "chill");
    const threshold = chillThreshold(unit);
    if (chill >= threshold && !coldDisposition(unit).immune) {
      setCount(unit, "chill", 0);
      applyStatus(unit, "frozen", { count: 1, mode: "gain", element: "cold", data: { sourceStatus: "chill" } });
      out.chill = { consumed: chill, threshold, frozen: countOf(unit, "frozen") };
    }
    return out;
  }

  const onRoundStart = onTurnStart;
  const onRoundEnd = onTurnEnd;

  function onHit(unit, hitDamage, context = {}) {
    const out = {};
    const radiance = countOf(unit, "radiance");
    const hit = Math.max(0, Math.floor(numberOr(context.finalDamage ?? hitDamage, 0)));
    if (radiance > 0 && hit > 0 && !context.suppressRadianceTrigger) {
      const steps = Math.floor(radiance / 2);
      const extra = Math.floor(hit * steps / 100);
      if (extra > 0) applyFixedDamage(unit, extra, { statusId: "radiance", trigger: "on_hit" });
      out.radiance = { steps, extra };
    }
    return out;
  }

  function onHealingReceived(unit, options = {}) {
    const before = countOf(unit, "decay");
    if (before <= 0) return 0;
    const reduction = options.passiveRegeneration || normalizeId(options.source) === "passive_regeneration" ? 2 : 5;
    reduceCount(unit, "decay", reduction);
    return before - countOf(unit, "decay");
  }

  function onRest(unit, type) {
    const rest = normalizeId(type);
    const out = {};
    if (rest === "short_rest") {
      if (countOf(unit, "decay") > 0) setCount(unit, "decay", Math.floor(countOf(unit, "decay") / 2));
      if (countOf(unit, "radiance") > 0) reduceCount(unit, "radiance", 5);
      if (status(unit, "poison")) setPotency(unit, "poison", potencyOf(unit, "poison") - 3);
    } else if (rest === "long_rest") {
      if (countOf(unit, "decay") > 0) removeStatus(unit, "decay", { from: "rest", ignoreProtection: true });
      if (countOf(unit, "radiance") > 0) removeStatus(unit, "radiance", { from: "rest", ignoreProtection: true });
      if (status(unit, "poison")) setPotency(unit, "poison", potencyOf(unit, "poison") - 6);
    }
    out.poison = status(unit, "poison") ? { potency: potencyOf(unit, "poison"), count: countOf(unit, "poison") } : null;
    return out;
  }

  function onEncounterEnd(units = []) {
    return (Array.isArray(units) ? units : []).map((unit) => {
      const before = countOf(unit, "radiance");
      if (before > 0) reduceCount(unit, "radiance", 2);
      return { unit, radianceBefore: before, radianceAfter: countOf(unit, "radiance"), poisonPersists: potencyOf(unit, "poison") > 0 };
    });
  }

  function offenseDefensePenalty(unit) { return Math.floor(countOf(unit, "corrosion") / 2); }
  function speedPenalty(unit) { return Math.floor(countOf(unit, "chill") / 2); }

  function forceStaggerFromDamage(unit, damage, context = {}) {
    const element = normalizeId(context.element || context.skill?.element || context.spell?.element);
    if (element !== "force") return 0;
    const amount = Math.floor(Math.max(0, numberOr(damage, 0)) * 0.25);
    if (amount <= 0) return 0;
    const engine = context.engine || global.CombatEngine;
    if (typeof engine?.modifyNextStaggerThreshold === "function") engine.modifyNextStaggerThreshold(unit, amount);
    else if (Number.isFinite(Number(unit.nextStaggerThreshold))) unit.nextStaggerThreshold += amount;
    return amount;
  }

  function routeShieldDamage(unit, incomingDamage, context = {}) {
    const damage = Math.max(0, numberOr(incomingDamage, 0));
    const shield = Math.max(0, numberOr(unit?.shield, 0));
    if (!unit || damage <= 0 || shield <= 0) return null;
    const radiance = countOf(unit, "radiance") > 0;
    const fData = frozenData(unit);
    const frozenShield = Math.min(shield, Math.max(0, numberOr(fData?.shieldRemaining, 0)));
    const wrathOrBurn = normalizeId(context.skill?.sinAffinity || context.skillUsed?.sinAffinity || context.sinAffinity) === "wrath" || normalizeId(context.statusId) === "burn";
    const frozenVulnerable = frozenShield > 0 && wrathOrBurn;
    if (!radiance && !frozenVulnerable) return null;

    let budget = damage;
    let loss = 0;
    if (radiance) {
      const amplifiedLoss = Math.min(shield, budget * 2);
      const budgetSpent = amplifiedLoss / 2;
      loss += amplifiedLoss;
      budget -= budgetSpent;
      budget = Math.max(0, budget);
    } else if (frozenVulnerable) {
      const frozenLoss = Math.min(frozenShield, budget * 2);
      loss += frozenLoss;
      budget -= frozenLoss / 2;
      const otherShield = Math.max(0, shield - frozenShield);
      const normalLoss = Math.min(otherShield, budget);
      loss += normalLoss;
      budget -= normalLoss;
    }
    if (fData) {
      const consumedFrozen = Math.min(fData.shieldRemaining, loss);
      fData.shieldRemaining = Math.max(0, fData.shieldRemaining - consumedFrozen);
      if (fData.shieldRemaining <= 0) breakFrozen(unit, "shield_break");
    }
    return { shieldAfter: Math.max(0, shield - loss), shieldLoss: loss, remainingDamage: Math.max(0, budget) };
  }

  function patchStatusEngine() {
    const source = global.LuminousStatusEngine;
    if (!source || source.__elementalStatusRuntime073) return Boolean(source);
    const wrapped = Object.freeze({
      ...source,
      __elementalStatusRuntime073: true,
      applyStatus(unit, statusId, input = {}) {
        const key = statusKey(statusId);
        if (key === "poisoned" || key === "force") return null;
        if ((key === "chill" || key === "frozen") && normalizeId(input.element || input.sourceElement) === "cold" && coldDisposition(unit).immune) return null;
        const payload = { ...input };
        if (key === "chill" && countOf(unit, "frozen") > 0 && !payload.__alreadyFrozenScaled) {
          payload.count = Math.max(0, numberOr(payload.count, 1)) * 2;
          payload.__alreadyFrozenScaled = true;
        }
        const previous = source.getStatus?.(unit, key) || null;
        const applied = source.applyStatus(unit, key, payload);
        const actual = store(unit)?.[key] || applied;
        const definition = registry()[key] || source.getDefinition?.(key) || {};
        if (actual && typeof actual === "object" && Number.isFinite(Number(definition.maxCount))) actual.count = Math.min(actual.count, Number(definition.maxCount));
        onStatusApplied(unit, key, actual, previous, payload, definition);
        return actual;
      },
      removeStatus(unit, statusId, options = {}) {
        const key = statusKey(statusId);
        const previous = source.getStatus?.(unit, key) || null;
        const result = source.removeStatus(unit, key, options);
        const removed = typeof result === "object" ? Boolean(result.removed) : Boolean(result);
        if (removed) onStatusRemoved(unit, key, previous);
        return result;
      },
    });
    global.LuminousStatusEngine = wrapped;
    return true;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__elementalStatusRuntime073) return Boolean(engine);
    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalProcessStatusEffects = typeof engine.processStatusEffects === "function" ? engine.processStatusEffects : null;

    if (originalProcessStatusEffects) {
      engine.processStatusEffects = function (unit, triggerKey, context = {}) {
        const key = normalizeId(triggerKey);
        const targetStore = store(unit);
        const suppressSinking = key === "getting_hit" && Boolean(targetStore?.sinking);
        const suppressBurn = ["on_round_end", "round_end", "turn_end"].includes(key) && Boolean(targetStore?.burn);
        if (!suppressSinking && !suppressBurn) return originalProcessStatusEffects.call(this, unit, triggerKey, context);

        const sinkingEntry = suppressSinking ? targetStore.sinking : null;
        const burnEntry = suppressBurn ? targetStore.burn : null;
        if (sinkingEntry) delete targetStore.sinking;
        if (burnEntry) delete targetStore.burn;
        let result;
        try { result = originalProcessStatusEffects.call(this, unit, triggerKey, context); }
        finally {
          if (sinkingEntry && !targetStore.sinking) targetStore.sinking = sinkingEntry;
          if (burnEntry && !targetStore.burn) targetStore.burn = burnEntry;
        }
        if (suppressSinking) {
          const sinking = resolveSinkingHit(unit, { ...(context || {}), engine: this });
          if (sinking && context && typeof context === "object") context.sinking = sinking;
        }
        return result;
      };
    }

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, tipoDaño = "directo", isCritical = false, skillUsed = null, damageContext = null) {
        const context = { ...(damageContext || {}), engine: this, skill: skillUsed, skillUsed, tipoDaño };
        const routed = routeShieldDamage(unit, damage, context);
        let result;
        if (routed) {
          const beforeShield = Math.max(0, numberOr(unit.shield, 0));
          unit.shield = 0;
          result = originalApplyDamage.call(this, unit, routed.remainingDamage, tipoDaño, isCritical, skillUsed, damageContext);
          unit.shield = routed.shieldAfter;
          result = { ...(result || {}), shieldBefore: beforeShield, shield: unit.shield, shieldLoss: routed.shieldLoss };
        } else result = originalApplyDamage.call(this, unit, damage, tipoDaño, isCritical, skillUsed, damageContext);

        const finalDamage = numberOr(result?.damageTaken ?? result?.damage ?? result?.hpDamage, routed ? routed.remainingDamage : damage);
        if (normalizeId(tipoDaño) === "directo") onHit(unit, finalDamage, { ...context, finalDamage });
        forceStaggerFromDamage(unit, finalDamage, context);
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
        const normalized = normalizeId(phaseTag).replace(/^_+|_+$/g, "");
        if (["[turn_start]", "turn_start", "[round_start]", "round_start"].includes(normalized)) (allUnits || []).forEach((u) => onTurnStart(u, { engine: this, allUnits }));
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (["[turn_end]", "turn_end", "[round_end]", "round_end"].includes(normalized)) (allUnits || []).forEach((u) => onTurnEnd(u, { engine: this, allUnits }));
        return result;
      };
    }
    Object.defineProperty(engine, "__elementalStatusRuntime073", { value: true, configurable: true });
    return true;
  }

  function patchRestEngine() {
    const source = global.LuminousRestEngine;
    if (!source || source.__elementalStatusRuntime073) return Boolean(source);
    const short = typeof source.performShortRest === "function" ? source.performShortRest.bind(source) : null;
    const long = typeof source.performLongRest === "function" ? source.performLongRest.bind(source) : null;
    if (!short || !long) return false;
    global.LuminousRestEngine = Object.freeze({
      ...source, __elementalStatusRuntime073: true,
      performShortRest(character, options = {}) { const result = short(character, options); if (result?.success) onRest(options.healTarget || character, "short_rest"); return result; },
      performLongRest(character, options = {}) { const result = long(character, options); if (result?.success) onRest(options.healTarget || character, "long_rest"); return result; },
    });
    return true;
  }

  function ensureBattleViewerBridge() {
    if (!global.document) return false;
    const path = String(global.location?.pathname || "").toLowerCase();
    if (!path.includes("battle-viewer")) return false;

    const loadViewer = () => {
      if (global.LuminousBattleViewerRuntime073 || global.document.getElementById("battle-viewer-runtime-073-script")) return true;
      const script = global.document.createElement("script");
      script.id = "battle-viewer-runtime-073-script";
      script.src = "js/battle-viewer-runtime-073.js";
      script.async = false;
      global.document.head?.appendChild(script);
      return true;
    };

    if (global.LuminousTeamActionEconomy) return loadViewer();
    let economy = global.document.getElementById("team-action-economy-script");
    if (!economy) {
      economy = global.document.createElement("script");
      economy.id = "team-action-economy-script";
      economy.src = "js/team-action-economy.js";
      economy.async = false;
      global.document.head?.appendChild(economy);
    }
    economy.addEventListener?.("load", loadViewer, { once: true });
    if (global.LuminousTeamActionEconomy) loadViewer();
    return true;
  }

  function patchAll() {
    registerStatuses();
    return { status: patchStatusEngine(), combat: patchCombatEngine(), rest: patchRestEngine(), battleViewer: ensureBattleViewerBridge() };
  }

  const api = Object.freeze({
    version: "0.7.3", ELEMENT_TO_SIN, ELEMENT_TO_STATUS, STATUS_DEFINITIONS, SIZE_CHILL_THRESHOLD,
    registerStatuses, status, countOf, potencyOf, setCount, reduceCount, setPotency,
    readMaxHp, writeMaxHp, readCurrentHp, writeCurrentHp, reconcileDecayMaxHp,
    unitSize, coldDisposition, chillThreshold, poisonDamage, poisonCheckThresholdPenalty, poisonClashPenalty,
    hasSpResource, readSp, writeSp, sinResistanceValue, applyGloomDamage, resolveSinkingHit,
    offenseDefensePenalty, speedPenalty, forceStaggerFromDamage, routeShieldDamage,
    onStatusApplied, onStatusRemoved, onTurnStart, onTurnEnd, onRoundStart, onRoundEnd, onHit,
    onHealingReceived, onRest, onEncounterEnd, patchStatusEngine, patchCombatEngine, patchRestEngine, patchAll,
  });

  global.LuminousElementalStatusRuntime = api;
  patchAll();
  const timer = typeof global.setInterval === "function" ? global.setInterval(patchAll, PATCH_INTERVAL_MS) : null;
  timer?.unref?.();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
