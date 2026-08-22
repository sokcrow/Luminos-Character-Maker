(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousTraitStandardizationRuntime) return;

  const state = {
    traitEngineSource: null,
    combatEngineSource: null,
    theatreRollsSource: null,
    coinEngineSource: null,
    activeCheck: null,
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve();
    const existing = doc.getElementById(id);
    if (existing) {
      return new Promise((resolve, reject) => {
        if (ready?.()) return resolve();
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      });
    }
    return new Promise((resolve, reject) => {
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener("error", reject, { once: true });
      doc.head?.appendChild(script);
    });
  }

  function ensureDependencies() {
    return Promise.all([
      ensureScript("status-engine-script", "js/status-engine.js", () => Boolean(global.LuminousStatusEngine)),
      ensureScript("universal-modifier-engine-script", "js/universal-modifier-engine.js", () => Boolean(global.LuminousUniversalModifiers)),
    ]);
  }

  function identityValues(entity = {}) {
    return [entity?.id, entity?.playerId, entity?.player_id, entity?.characterId, entity?.character_id, entity?.uid, entity?.vinculo_jugador]
      .filter((value) => value != null && String(value).trim() !== "")
      .map((value) => String(value).trim());
  }

  function entityName(entity = {}) {
    return normalizeId(entity?.characterName || entity?.character_name || entity?.nombre || entity?.name || "");
  }

  function isCurrentPlayerUnit(unit) {
    const runtime = global.LuminousPlayerTraitRuntime;
    const character = runtime?.getCharacter?.() || global.datosJugador || null;
    if (!unit || !character) return false;
    if (unit === character) return true;
    const ids = new Set(identityValues(character));
    if (identityValues(unit).some((id) => ids.has(id))) return true;
    const name = entityName(character);
    return Boolean(name && name === entityName(unit));
  }

  function traitsForUnit(unit) {
    if (Array.isArray(unit?.traitDefinitions)) return unit.traitDefinitions;
    if (Array.isArray(unit?.traits) && unit.traits.every((entry) => entry && typeof entry === "object")) return unit.traits;
    if (isCurrentPlayerUnit(unit)) return global.LuminousPlayerTraitRuntime?.getTraits?.() || [];
    return [];
  }

  function enrichRuntime(runtime = {}) {
    const modifiers = global.LuminousUniversalModifiers;
    const self = runtime.self || runtime.character || null;
    const skill = runtime.skill ? modifiers?.normalizeSkill?.(runtime.skill) || runtime.skill : runtime.skill;
    return {
      ...(runtime || {}),
      skill,
      equipment: runtime.equipment || modifiers?.resolveEquipment?.(self || {}) || {},
    };
  }

  function resourceStore(unit) {
    if (!unit || typeof unit !== "object") return null;
    if (!unit.resources || typeof unit.resources !== "object" || Array.isArray(unit.resources)) unit.resources = {};
    return unit.resources;
  }

  function syncOutcome(outcome, runtime, traitState) {
    if (!outcome || typeof outcome !== "object") return;
    const statusEngine = global.LuminousStatusEngine;
    const self = runtime?.self || runtime?.character || null;
    const target = runtime?.target || runtime?.defender || null;
    const outcomeType = normalizeId(outcome.type);

    if (outcomeType === "apply_status") {
      statusEngine?.applyStatus?.(self, outcome.statusId, { ...(outcome.status || {}), mode: "set" });
    } else if (outcomeType === "remove_status") {
      statusEngine?.removeStatus?.(self, outcome.statusId, { protectedStatuses: traitState?.protectedStatuses, from: "effects" });
    } else if (outcomeType === "rule_status") {
      const unit = normalizeId(outcome.target) === "target" ? target : self;
      if (["gain", "inflict", "apply"].includes(normalizeId(outcome.action))) {
        statusEngine?.applyStatus?.(unit, outcome.statusId, { ...(outcome.status || {}), mode: "set" });
      } else if (normalizeId(outcome.action) === "remove") {
        statusEngine?.removeStatus?.(unit, outcome.statusId, { protectedStatuses: traitState?.protectedStatuses, from: "effects" });
      }
    } else if (outcomeType === "rule_status_protection") {
      statusEngine?.protectStatus?.(self, outcome.statusId, { from: outcome.from, sourceTraitId: outcome.traitId });
    } else if (outcomeType === "rule_resource" && outcome.resourceId && outcome.resourceId !== "sp") {
      const store = resourceStore(self);
      if (store) {
        const id = normalizeId(outcome.resourceId);
        const current = store[id] && typeof store[id] === "object" ? numberOr(store[id].value, 0) : numberOr(store[id], 0);
        const next = Number.isFinite(Number(outcome.after)) ? Number(outcome.after) : current + numberOr(outcome.amount, 0);
        store[id] = { value: next };
      }
    }

    (outcome.outcomes || []).forEach((nested) => syncOutcome(nested, runtime, traitState));
  }

  function syncResult(result) {
    if (!result || typeof result !== "object") return result;
    const runtime = result.runtime || {};
    const self = runtime.self || runtime.character || null;
    const traitState = result.state || null;
    if (self && traitState) global.LuminousStatusEngine?.syncTraitState?.(self, traitState);
    (result.outcomes || []).forEach((outcome) => syncOutcome(outcome, runtime, traitState));
    return result;
  }

  function installTraitEngineBridge() {
    const source = global.LuminousTraitEngine;
    if (!source || source.__universalStandardizationWrapped) return Boolean(source);
    if (state.traitEngineSource === source) return true;

    const wrapRuntimeCall = (name) => {
      const fn = source[name];
      if (typeof fn !== "function") return fn;
      if (name === "dispatchTrait") return (trait, trigger, runtime, traitState) => syncResult(fn.call(source, trait, trigger, enrichRuntime(runtime), traitState));
      if (name === "dispatchTraits") return (traits, trigger, runtime, traitState) => syncResult(fn.call(source, traits, trigger, enrichRuntime(runtime), traitState));
      if (name === "dispatchCombatEvent") return (trigger, input) => syncResult(fn.call(source, trigger, enrichRuntime(input), input?.state));
      if (name === "activateTrait") return (trait, runtime, traitState) => syncResult(fn.call(source, trait, enrichRuntime(runtime), traitState));
      return fn.bind(source);
    };

    const wrapped = Object.freeze({
      ...source,
      __universalStandardizationWrapped: true,
      dispatchTrait: wrapRuntimeCall("dispatchTrait"),
      dispatchTraits: wrapRuntimeCall("dispatchTraits"),
      dispatchCombatEvent: wrapRuntimeCall("dispatchCombatEvent"),
      activateTrait: wrapRuntimeCall("activateTrait"),
    });
    global.LuminousTraitEngine = wrapped;
    state.traitEngineSource = wrapped;
    return true;
  }

  function resolveCombatCheck(unit, request = {}) {
    const stats = unit?.stats || {};
    const ability = normalizeId(request.abilityId);
    const aliases = ability === "con" ? ["constitucion", "constitution"] : ability === "str" ? ["fuerza", "strength"] : [ability];
    const scoreKey = aliases.find((key) => Object.prototype.hasOwnProperty.call(stats, key));
    const score = numberOr(scoreKey ? stats[scoreKey] : 10, 10);
    const base = Math.floor((score - 10) / 2);
    const threshold = numberOr(request.threshold, 0);
    const headsChance = Math.max(5, Math.min(95, 50 + numberOr(unit?.sp ?? unit?.combatStats?.sp_actual, 0)));
    const coinEngine = global.LuminousCoinEngine;
    const coins = [];
    for (let index = 0; index < 5; index += 1) {
      const side = coinEngine?.rollSide ? coinEngine.rollSide(headsChance) : (Math.random() * 100 < headsChance ? "head" : "tail");
      coins.push({ index, side });
    }
    const heads = coins.filter((coin) => coin.side === "head").length;
    const total = base + heads * 4;
    const result = { passed: total >= threshold, total, threshold, abilityId: ability, coins, heads };
    if (typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("luminous:trait-check-resolved", { detail: result }));
    return result;
  }

  function precomputedLevel(unit, kind) {
    const combat = unit?.combatStats || {};
    const values = kind === "offensive"
      ? [combat.offensiveLevel, combat.off_level, unit?.offensiveLevel, unit?.offensive_level]
      : [combat.defensiveLevel, combat.def_level, unit?.defensiveLevel, unit?.defensive_level];
    const found = values.find((value) => Number.isFinite(Number(value)));
    return found == null ? null : Number(found);
  }

  function installCombatBridge() {
    const engine = global.CombatEngine;
    const modifiers = global.LuminousUniversalModifiers;
    const statusEngine = global.LuminousStatusEngine;
    if (!engine || !modifiers || engine.__universalModifierBridge) return Boolean(engine);
    if (state.combatEngineSource === engine) return true;

    const originalInitialize = typeof engine.initializeUnitData === "function" ? engine.initializeUnitData : null;
    const originalCreateSkill = typeof engine.createSkill === "function" ? engine.createSkill : null;
    const originalPassive = typeof engine.applyPassiveModifiers === "function" ? engine.applyPassiveModifiers : null;
    const originalOff = typeof engine.getOffensiveLevel === "function" ? engine.getOffensiveLevel : null;
    const originalDef = typeof engine.getDefensiveLevel === "function" ? engine.getDefensiveLevel : null;
    const originalFinalPower = typeof engine.calculateFinalPower === "function" ? engine.calculateFinalPower : null;
    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    const originalCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;

    if (originalInitialize) engine.initializeUnitData = function (unit, ...rest) {
      const result = originalInitialize.call(this, unit, ...rest);
      statusEngine.ensureStore(unit);
      const equipment = modifiers.resolveEquipment(unit);
      unit.equipmentState = equipment;
      [].concat(unit.attack_tier_1_sequence || [], unit.attack_tier_2_sequence || [], unit.attack_tier_3_sequence || []).forEach((skill) => modifiers.normalizeSkill(skill));
      return result;
    };

    if (originalCreateSkill) engine.createSkill = function (config, ...rest) {
      const skill = originalCreateSkill.call(this, config, ...rest);
      if (config?.skillFamily) skill.skillFamily = config.skillFamily;
      if (config?.attackMode) skill.attackMode = config.attackMode;
      if (config?.ammo) skill.ammo = { ...config.ammo };
      return modifiers.normalizeSkill(skill);
    };

    if (originalPassive) engine.applyPassiveModifiers = function (unit, contextOptions) {
      const statusMods = originalPassive.call(this, unit, contextOptions) || {};
      const traits = traitsForUnit(unit);
      const traitMods = modifiers.resolveTraitModifiers({
        unit,
        character: isCurrentPlayerUnit(unit) ? global.LuminousPlayerTraitRuntime?.getCharacter?.() || unit : unit,
        traits,
        skill: contextOptions?.skill || null,
        context: "combat",
      });
      return modifiers.mergeModifiers(statusMods, traitMods);
    };

    if (originalOff) engine.getOffensiveLevel = function (unit, skill = {}) {
      const base = precomputedLevel(unit, "offensive");
      if (base == null) return originalOff.call(this, unit, skill);
      const passive = this.applyPassiveModifiers(unit, { skill }) || {};
      let scaling = 0;
      if (unit?.stats && skill?.scaling_stat) scaling = numberOr(unit.stats[String(skill.scaling_stat).toLowerCase()], 0);
      else scaling = numberOr(skill?.offenseModifier, 0);
      return Math.max(1, base + scaling + numberOr(skill?.resonanceOffenseBonus, 0) + numberOr(passive.offensive_level, 0));
    };

    if (originalDef) engine.getDefensiveLevel = function (unit, skillOrPart = {}) {
      const base = precomputedLevel(unit, "defensive");
      if (base == null) return originalDef.call(this, unit, skillOrPart);
      const passive = this.applyPassiveModifiers(unit, { skill: skillOrPart }) || {};
      let scaling = 0;
      if (unit?.stats && skillOrPart?.scaling_stat) scaling = numberOr(unit.stats[String(skillOrPart.scaling_stat).toLowerCase()], 0);
      else scaling = numberOr(skillOrPart?.defenseModifier, 0);
      return Math.max(1, base + scaling + numberOr(skillOrPart?.resonanceDefenseBonus, 0) + numberOr(passive.defensive_level, 0));
    };

    if (originalFinalPower) engine.calculateFinalPower = function (skill, headsFlipped, unit) {
      modifiers.normalizeSkill(skill);
      const result = originalFinalPower.call(this, skill, headsFlipped, unit);
      return result + numberOr(skill?.final_power ?? skill?.finalPower, 0);
    };

    if (originalCoinDamage) engine.calculateCoinDamage = function (attacker, defender, skill, ...rest) {
      modifiers.normalizeSkill(skill);
      const result = originalCoinDamage.call(this, attacker, defender, skill, ...rest);
      if (isCurrentPlayerUnit(attacker)) {
        global.LuminousPlayerTraitRuntime?.dispatchCombatEvent?.("damage_dealt", {
          context: "combat", self: attacker, attacker, defender, target: defender, skill, damageDealt: result,
        });
      }
      return result;
    };

    if (originalApplyDamage) engine.applyDamage = function (unit, damage, tipoDaño, isCritical, skillUsed) {
      const hpBefore = numberOr(unit?.hp, 0);
      const result = originalApplyDamage.call(this, unit, damage, tipoDaño, isCritical, skillUsed);
      if (isCurrentPlayerUnit(unit)) {
        global.LuminousPlayerTraitRuntime?.dispatchCombatEvent?.("damage_taken", {
          context: "combat", self: unit, defender: unit, skill: skillUsed || null, damageTaken: Math.max(0, hpBefore - numberOr(unit?.hp, 0)),
        });
        if (hpBefore > 0 && numberOr(unit?.hp, 0) <= 0) {
          global.LuminousPlayerTraitRuntime?.dispatchCombatEvent?.("hp_zero", {
            context: "combat",
            self: unit,
            defender: unit,
            skill: skillUsed || null,
            DefensiveLevel: this.getDefensiveLevel?.(unit, unit),
            resolveCheck: (request) => resolveCombatCheck(unit, request),
          });
        }
      }
      return result;
    };

    if (originalTriggerEvent) engine.triggerEvent = function (tag, context, targetsHit) {
      const result = originalTriggerEvent.call(this, tag, context, targetsHit);
      if (tag === "[Attack End]" && isCurrentPlayerUnit(context?.attacker || context?.unitAttacker)) {
        const attacker = context?.attacker || context?.unitAttacker;
        global.LuminousPlayerTraitRuntime?.dispatchCombatEvent?.("skill_resource_gain", {
          context: "combat", self: attacker, attacker, skill: context?.skill || null, targetsHit: targetsHit || [],
        });
      }
      return result;
    };

    Object.defineProperty(engine, "__universalModifierBridge", { value: true, configurable: true });
    state.combatEngineSource = engine;
    return true;
  }

  function installTheatreCheckBridge() {
    const rolls = global.LuminousTheatreRolls;
    if (!rolls || typeof rolls.armCheck !== "function") return false;
    if (rolls.__universalCheckTraitBridge) return true;
    const originalArm = rolls.armCheck.bind(rolls);
    const wrapped = Object.freeze({
      ...rolls,
      __universalCheckTraitBridge: true,
      armCheck(check = {}) {
        state.activeCheck = { ...(check || {}) };
        return originalArm(check);
      },
    });
    global.LuminousTheatreRolls = wrapped;
    state.theatreRollsSource = wrapped;
    return true;
  }

  function applyCheckRetosses(result, options, check) {
    const playerRuntime = global.LuminousPlayerTraitRuntime;
    const coinEngine = state.coinEngineSource || global.LuminousCoinEngine;
    const kind = normalizeId(check?.kind);
    if (!playerRuntime || normalizeId(check?.abilityId) !== "str" || !["ability", "skill"].includes(kind)) return result;
    const failed = (result?.coins || []).filter((coin) => normalizeId(coin?.side) === "tail");
    if (!failed.length) return result;

    const failedIndex = failed.at(-1).index;
    const traitResult = playerRuntime.dispatch?.("check_coin_fail", {
      context: "theatre",
      check: { ...(check || {}), failedCoinIndex: failedIndex },
    });
    let attempts = Math.max(0, Math.trunc(numberOr(traitResult?.runtime?.check?.reTossLastCoin, 0)));
    if (!attempts) return result;

    const next = { ...(result || {}), coins: (result.coins || []).map((coin) => ({ ...coin })) };
    const headsChance = numberOr(next.headsChance, 50);
    const coin = next.coins.find((entry) => entry.index === failedIndex) || next.coins[failedIndex];
    if (!coin) return next;

    let used = 0;
    while (used < attempts && normalizeId(coin.side) === "tail") {
      used += 1;
      const side = coinEngine?.rollSide ? coinEngine.rollSide(headsChance) : (Math.random() * 100 < headsChance ? "head" : "tail");
      coin.side = side;
      if (coinEngine?.coinSrc) coin.src = coinEngine.coinSrc(side);
      if (side === "head") next.total = numberOr(next.total, 0) + numberOr(next.headBonus, 4);
    }
    next.heads = next.coins.filter((entry) => entry.side === "head").length;
    next.reTosses = { coinIndex: failedIndex, attempted: used, maximum: attempts };

    const node = options?.container?.querySelector?.(`[data-coin-index='${failedIndex}'] img`);
    if (node && coin.src) {
      node.src = coin.src;
      node.dataset.side = coin.side;
      node.alt = coin.side === "head" ? "Head" : "Tail";
    }
    if (options?.totalNode) options.totalNode.textContent = String(next.total);
    if (typeof global.CustomEvent === "function") global.dispatchEvent(new global.CustomEvent("luminous:check-coin-retoss", { detail: next.reTosses }));
    return next;
  }

  function installCoinCheckBridge() {
    const source = global.LuminousCoinEngine;
    if (!source || typeof source.runAnimatedRoll !== "function") return false;
    if (source.__universalCheckTraitBridge) return true;
    const originalRun = source.runAnimatedRoll.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __universalCheckTraitBridge: true,
      runAnimatedRoll(options = {}) {
        const check = state.activeCheck ? { ...state.activeCheck } : null;
        const onComplete = options.onComplete;
        const wrappedOptions = { ...options, onComplete: null };
        return originalRun(wrappedOptions).then((rawResult) => {
          const finalResult = check ? applyCheckRetosses(rawResult, options, check) : rawResult;
          state.activeCheck = null;
          onComplete?.(finalResult);
          return finalResult;
        });
      },
    });
    global.LuminousCoinEngine = wrapped;
    state.coinEngineSource = wrapped;
    return true;
  }

  function installAll() {
    installTraitEngineBridge();
    installCombatBridge();
    installTheatreCheckBridge();
    installCoinCheckBridge();
  }

  global.addEventListener?.("luminous:trait-activated", (event) => syncResult(event?.detail));
  global.addEventListener?.("luminous:skill-resource-gain", (event) => {
    const unit = event?.detail?.unit || event?.detail?.self;
    if (!isCurrentPlayerUnit(unit)) return;
    global.LuminousPlayerTraitRuntime?.dispatchCombatEvent?.("skill_resource_gain", { context: "combat", self: unit, ...(event.detail || {}) });
  });

  const api = Object.freeze({
    installAll,
    syncResult,
    resolveCombatCheck,
    applyCheckRetosses,
  });
  global.LuminousTraitStandardizationRuntime = api;

  ensureDependencies().then(() => {
    installAll();
    global.setInterval(installAll, 800);
  }).catch((error) => console.error("Trait Standardization Runtime:", error));
})(window);
