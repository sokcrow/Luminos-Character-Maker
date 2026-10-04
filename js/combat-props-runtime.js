(function (global) {
  "use strict";

  if (global.LuminousCombatPropsRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCombatPropsRuntime;
    return;
  }

  const VERSION = "0.1.0";
  const registry = new Map();
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function propId(prop = {}) {
    return String(prop.id ?? prop.propId ?? prop.objectId ?? prop.assetId ?? "").trim();
  }

  function configuredHiddenHp(prop = {}) {
    const candidates = [
      prop.hiddenHp, prop.hiddenHP, prop.hidden_hp,
      prop.durabilityUses, prop.durability_uses,
      prop.usesRemaining, prop.uses_remaining,
      prop.durability
    ];
    const found = candidates.find((value) => Number.isFinite(Number(value)));
    return found == null ? 1 : Math.max(0, Math.trunc(Number(found)));
  }

  function ensurePropState(prop = {}) {
    if (!prop || typeof prop !== "object") return null;
    if (!prop.__luminousPropState || typeof prop.__luminousPropState !== "object") {
      const maximum = configuredHiddenHp(prop);
      Object.defineProperty(prop, "__luminousPropState", {
        configurable: true,
        enumerable: false,
        writable: true,
        value: {
          hiddenHp: maximum,
          maxHiddenHp: maximum,
          broken: maximum <= 0,
          uses: 0,
          lastCause: null
        }
      });
    }
    return prop.__luminousPropState;
  }

  function registerEncounterProps(input) {
    const values = Array.isArray(input) ? input : Object.values(input || {});
    for (const prop of values) {
      const id = propId(prop);
      if (!id || !prop || typeof prop !== "object") continue;
      registry.set(id, prop);
      ensurePropState(prop);
    }
    return values.length;
  }

  function globalPropCollections() {
    return [
      global.combatProps,
      global.encounterProps,
      global.LuminousCombatProps,
      global.combatData?.props,
      global.LuminousBattleViewerPlayerSpellPlanner074?.state?.props
    ].filter(Boolean);
  }

  function syncGlobalProps() {
    for (const collection of globalPropCollections()) registerEncounterProps(collection);
    return registry;
  }

  function resolveProp(input) {
    if (input && typeof input === "object") {
      const id = propId(input);
      if (id) {
        registry.set(id, input);
        ensurePropState(input);
      }
      return input;
    }
    const id = String(input ?? "").trim();
    if (!id) return null;
    syncGlobalProps();
    return registry.get(id) || null;
  }

  function publicProp(prop = {}) {
    const state = ensurePropState(prop);
    return {
      id: propId(prop),
      name: prop.name || prop.nombre || propId(prop) || "Prop",
      weight: Number.isFinite(Number(prop.weight ?? prop.weightLb ?? prop.weight_lbs)) ? Number(prop.weight ?? prop.weightLb ?? prop.weight_lbs) : null,
      broken: Boolean(state?.broken)
    };
  }

  function listUsableProps() {
    syncGlobalProps();
    return [...registry.values()]
      .filter((prop) => {
        const state = ensurePropState(prop);
        return state && !state.broken && prop.throwable !== false && prop.isThrowable !== false;
      })
      .map(publicProp);
  }

  function applyPropWear(input, amount = 1, cause = "use") {
    const prop = resolveProp(input);
    if (!prop) return { applied: false, reason: "prop_not_found" };
    const state = ensurePropState(prop);
    const wear = Math.max(0, Math.trunc(numberOr(amount, 1)));
    const before = state.hiddenHp;
    state.hiddenHp = Math.max(0, before - wear);
    state.uses += wear;
    state.lastCause = String(cause || "use");
    state.broken = state.hiddenHp <= 0;
    prop.broken = state.broken;
    return {
      applied: true,
      propId: propId(prop),
      before,
      after: state.hiddenHp,
      broken: state.broken,
      cause: state.lastCause
    };
  }

  function strengthScore(actor = {}) {
    const stats = actor.dndStats || actor.stats || {};
    const candidates = [
      actor.strength, actor.str, actor.STR,
      stats.strength, stats.str, stats.STR,
      stats.Fuerza, actor.Fuerza
    ];
    const value = candidates.find((entry) => Number.isFinite(Number(entry)));
    return value == null ? 10 : Number(value);
  }

  function strengthMod(actor = {}) {
    const stats = actor.dndStats || actor.stats || {};
    const direct = [
      actor.strengthMod, actor.strMod, actor.STRMod,
      stats.strengthMod, stats.strMod, stats.STRMod,
      stats.modifiers?.str, stats.modifiers?.strength
    ].find((entry) => Number.isFinite(Number(entry)));
    if (direct != null) return Math.trunc(Number(direct));
    return Math.floor((strengthScore(actor) - 10) / 2);
  }

  function improvisedThrownPower(actor = {}) {
    const score = strengthScore(actor);
    return {
      basePower: strengthMod(actor),
      coinPower: Math.floor(score / 3),
      strengthScore: score
    };
  }

  function statusLikeEffect(effect = {}) {
    const type = normalizeId(effect.type);
    return type === "status"
      || type === "apply_status"
      || type === "inflict_status"
      || Boolean(effect.status || effect.statusId || effect.status_id);
  }

  function stripStatusEffects(skill = {}) {
    const next = clone(skill) || {};
    if (Array.isArray(next.effects)) next.effects = next.effects.filter((effect) => !statusLikeEffect(effect));
    if (Array.isArray(next.coins)) {
      next.coins = next.coins.map((coin) => ({
        ...coin,
        effects: Array.isArray(coin.effects) ? coin.effects.filter((effect) => !statusLikeEffect(effect)) : coin.effects
      }));
    }
    return next;
  }

  function improvisedThrownSkill(actor, input) {
    const prop = resolveProp(input);
    if (!prop) return { ok: false, reason: "prop_not_found", skill: null };
    const state = ensurePropState(prop);
    if (state.broken) return { ok: false, reason: "prop_broken", skill: null };
    const power = improvisedThrownPower(actor);
    return {
      ok: true,
      reason: null,
      prop: publicProp(prop),
      skill: {
        id: `improvised_throw_${normalizeId(propId(prop) || "prop")}`,
        name: `Improvised Throw · ${prop.name || prop.nombre || "Prop"}`,
        type: "Attack",
        basePower: power.basePower,
        coinPower: power.coinPower,
        coinAmount: 1,
        coins: 1,
        coinType: "standard",
        attackWeight: 1,
        targetingType: "Focused Attack",
        effects: [],
        __luminousPropUse: { propId: propId(prop), wear: 1, cause: "thrown" }
      }
    };
  }

  function improvisedWeaponSkill(baseSkill, input) {
    const prop = resolveProp(input);
    if (!prop) return { ok: false, reason: "prop_not_found", skill: null };
    const state = ensurePropState(prop);
    if (state.broken) return { ok: false, reason: "prop_broken", skill: null };
    const skill = stripStatusEffects(baseSkill);
    skill.damageMultiplier = 0.6;
    skill.improvisedWeapon = true;
    skill.__luminousPropUse = { propId: propId(prop), wear: 1, cause: "improvised_weapon" };
    return { ok: true, reason: null, prop: publicProp(prop), skill };
  }

  function catapultMaxWeight(slotLevel = 1) {
    return Math.max(1, Math.trunc(numberOr(slotLevel, 1))) * 5;
  }

  function validateCatapultProp(input, slotLevel = 1) {
    const prop = resolveProp(input);
    if (!prop) return { ok: false, reason: "prop_not_found", prop: null };
    const state = ensurePropState(prop);
    if (state.broken) return { ok: false, reason: "prop_broken", prop: publicProp(prop) };
    if (prop.throwable === false || prop.isThrowable === false) return { ok: false, reason: "prop_not_throwable", prop: publicProp(prop) };
    const weight = Number(prop.weight ?? prop.weightLb ?? prop.weight_lbs);
    const maxWeight = catapultMaxWeight(slotLevel);
    if (Number.isFinite(weight) && weight > maxWeight) return { ok: false, reason: "prop_too_heavy", maxWeight, prop: publicProp(prop) };
    return { ok: true, reason: null, maxWeight, prop: publicProp(prop), rawProp: prop };
  }

  function propUseForSkill(skill = {}) {
    if (skill.__luminousPropUse?.propId) return skill.__luminousPropUse;
    const rule = skill.mechanics?.combatProp || skill.luminousMechanics?.combatProp;
    const selected = skill.selectedPropId || skill.combatPropId;
    if (rule && selected) return { propId: selected, wear: rule.hiddenHpCost ?? 1, cause: rule.mode || "spell" };
    return null;
  }

  function install(engine = global.CombatEngine) {
    if (!engine || typeof engine.triggerEvent !== "function") return false;
    if (engine.__luminousCombatPropsRuntime) return true;
    const originalTriggerEvent = engine.triggerEvent;
    engine.triggerEvent = function (tag, context, targetsHit = []) {
      const key = normalizeId(tag);
      if (key === "before_use") {
        const use = propUseForSkill(context?.skill || {});
        if (use && !context.__luminousPropWearApplied) {
          context.__luminousPropWearApplied = true;
          context.propWear = applyPropWear(use.propId, use.wear ?? 1, use.cause || "use");
        }
      }
      return originalTriggerEvent.call(this, tag, context, targetsHit);
    };
    Object.defineProperty(engine, "__luminousCombatPropsRuntime", { value: true, configurable: true });
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    propId,
    ensurePropState,
    registerEncounterProps,
    syncGlobalProps,
    resolveProp,
    publicProp,
    listUsableProps,
    applyPropWear,
    strengthScore,
    strengthMod,
    improvisedThrownPower,
    stripStatusEffects,
    improvisedThrownSkill,
    improvisedWeaponSkill,
    catapultMaxWeight,
    validateCatapultProp,
    install
  });

  global.LuminousCombatPropsRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  install();
})(typeof window !== "undefined" ? window : globalThis);
