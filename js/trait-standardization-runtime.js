(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousTraitStandardizationRuntime) return;

  const HEAD_COIN_SRC = "https://imgur.com/yshLPnQ.png";
  const TAIL_COIN_SRC = "https://imgur.com/XDx0ICt.png";
  const state = {
    traitEngineSource: null,
    combatEngineSource: null,
    theatreRollsSource: null,
    coinEngineSource: null,
    activeCheck: null,
    legacyCheckBridgeBound: false,
    legacyCheckObserver: null,
    legacyCheckToken: 0,
    combatUnits: new Map(),
    viewerEncounterBound: false,
    viewerEncounterActive: false,
    viewerEncounterPending: false,
    viewerEncounterRef: null,
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

  function combatUnitKey(unit) {
    return identityValues(unit)[0] || entityName(unit) || unit;
  }

  function registeredCombatUnits() {
    return Array.from(state.combatUnits.values());
  }

  function currentRegisteredPlayerUnit() {
    return registeredCombatUnits().find((unit) => isCurrentPlayerUnit(unit)) || null;
  }

  function dispatchPendingEncounterStart() {
    if (!state.viewerEncounterPending) return false;
    const runtime = global.LuminousPlayerTraitRuntime;
    const unit = currentRegisteredPlayerUnit();
    if (!runtime?.dispatchCombatEvent || !unit) return false;
    state.viewerEncounterPending = false;
    runtime.dispatchCombatEvent("encounter_start", {
      context: "combat",
      self: unit,
      units: registeredCombatUnits(),
    });
    return true;
  }

  function registerCombatUnit(unit) {
    if (!unit || typeof unit !== "object") return unit;
    state.combatUnits.set(combatUnitKey(unit), unit);
    dispatchPendingEncounterStart();
    return unit;
  }

  function installViewerEncounterBridge() {
    if (state.viewerEncounterBound) {
      dispatchPendingEncounterStart();
      return true;
    }
    if (!global.firebase?.database || !global.firebase?.apps?.length) return false;
    const ref = global.firebase.database().ref("campaña/combate/combatants");
    state.viewerEncounterBound = true;
    state.viewerEncounterRef = ref;
    ref.on("value", (snapshot) => {
      const combatants = snapshot.val() || {};
      const active = Object.keys(combatants).length > 0;
      if (!active) {
        state.viewerEncounterActive = false;
        state.viewerEncounterPending = false;
        state.combatUnits.clear();
        return;
      }
      if (state.viewerEncounterActive) return;
      state.viewerEncounterActive = true;
      state.viewerEncounterPending = true;
      dispatchPendingEncounterStart();
    });
    return true;
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

  function restrictionTraitsForUnit(unit) {
    return traitsForUnit(unit).map((trait) => ({
      ...trait,
      effects: [],
      rules: (trait.rules || []).filter((rule) => normalizeId(rule?.type) === "restriction"),
    })).filter((trait) => trait.rules.length > 0);
  }

  function restrictionMatchesSkill(restriction, skillInput) {
    const modifiers = global.LuminousUniversalModifiers;
    const skill = modifiers?.normalizeSkill?.(skillInput) || skillInput || {};
    const id = normalizeId(restriction);
    if (id === "spell_skills") return normalizeId(skill.skillFamily) === "spell";
    if (id === "attack_skills") return normalizeId(skill.skillFamily) === "attack";
    if (id === "melee_skills") return normalizeId(skill.skillFamily) === "attack" && normalizeId(skill.attackMode) === "melee";
    if (id === "ranged_skills") return normalizeId(skill.skillFamily) === "attack" && normalizeId(skill.attackMode) === "ranged";
    if (id === "defense_skills") return normalizeId(skill.skillFamily) === "defense";
    if (id === "roll_skills") return normalizeId(skill.skillFamily) === "roll";
    return false;
  }

  function canUseSkillByTraits(unit, skillInput) {
    const traitEngine = global.LuminousTraitEngine;
    const modifiers = global.LuminousUniversalModifiers;
    const skill = modifiers?.normalizeSkill?.(skillInput) || skillInput;
    if (!unit || !skill) return { usable: true, reason: null, restriction: null };

    const ammoResult = modifiers?.canUseSkill?.(unit, skill);
    if (ammoResult && ammoResult.usable === false) return { ...ammoResult, restriction: null };

    const traits = restrictionTraitsForUnit(unit);
    if (!traits.length || !traitEngine?.dispatchTraits || !traitEngine?.createState) return { usable: true, reason: null, restriction: null };
    const character = isCurrentPlayerUnit(unit) ? global.LuminousPlayerTraitRuntime?.getCharacter?.() || unit : unit;
    const result = traitEngine.dispatchTraits(traits, "passive", {
      context: "combat",
      character,
      self: unit,
      skill,
      equipment: modifiers?.resolveEquipment?.(unit) || {},
    }, traitEngine.createState());
    const flags = result?.state?.flags || {};
    const activeRestriction = Object.keys(flags)
      .filter((key) => key.startsWith("restriction_") && flags[key])
      .map((key) => key.slice("restriction_".length))
      .find((restriction) => restrictionMatchesSkill(restriction, skill));
    if (!activeRestriction) return { usable: true, reason: null, restriction: null };
    return {
      usable: false,
      restriction: activeRestriction,
      reason: `Skill blocked by active restriction: ${activeRestriction}.`,
    };
  }

  function blockedSkillResult(check, extra = {}) {
    return {
      blocked: true,
      pendingActions: [],
      reason: check?.reason || "Skill is restricted.",
      restriction: check?.restriction || null,
      ...extra,
    };
  }

  function installCombatBridge() {
    const engine = global.CombatEngine;
    const modifiers = global.LuminousUniversalModifiers;
    const statusEngine = global.LuminousStatusEngine;
    if (!engine || !modifiers || engine.__universalModifierBridge) return Boolean(engine);
    if (state.combatEngineSource === engine) return true;

    const originalInitialize = typeof engine.initializeUnitData === "function" ? engine.initializeUnitData : null;
    const originalCreateSkill = typeof engine.createSkill === "function" ? engine.createSkill : null;
    const originalCanUseSkill = typeof engine.canUseSkill === "function" ? engine.canUseSkill : null;
    const originalUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const originalClash = typeof engine.resolveStandardClash === "function" ? engine.resolveStandardClash : null;
    const originalSpell = typeof engine.resolveSpell === "function" ? engine.resolveSpell : null;
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
      registerCombatUnit(unit);
      return result;
    };

    if (originalCreateSkill) engine.createSkill = function (config = {}, ...rest) {
      const skill = originalCreateSkill.call(this, config, ...rest);
      const legacyFields = ["skillRange", "skill_range", "rangeType", "isRanged", "isMelee", "targeting_type", "targetingType", "priority", "ammoType", "ammo_type", "ammoCost", "ammo_cost"];
      legacyFields.forEach((field) => {
        if (Object.prototype.hasOwnProperty.call(config, field)) skill[field] = config[field];
      });
      if (config?.skillFamily) skill.skillFamily = config.skillFamily;
      if (config?.attackMode) skill.attackMode = config.attackMode;
      if (config?.ammo) skill.ammo = { ...config.ammo };
      if (config?.caster) skill.caster = config.caster;
      if (skill.skillRange === undefined && config?.skill_range !== undefined) skill.skillRange = config.skill_range;
      return modifiers.normalizeSkill(skill);
    };

    engine.canUseSkill = function (unit, skill, ...rest) {
      if (originalCanUseSkill) {
        const legacy = originalCanUseSkill.call(this, unit, skill, ...rest);
        if (legacy === false || legacy?.usable === false) return legacy;
      }
      return canUseSkillByTraits(unit, skill);
    };

    if (originalUnilateral) engine.resolveUnilateralWithCounter = function (unitAttacker, attackSkill, ...rest) {
      const check = canUseSkillByTraits(unitAttacker, attackSkill);
      if (!check.usable) return blockedSkillResult(check, { attackLogs: [{ message: check.reason, class: "error" }], damageTaken: 0 });
      return originalUnilateral.call(this, unitAttacker, attackSkill, ...rest);
    };

    if (originalClash) engine.resolveStandardClash = function (unitA, skillA, unitB, skillB, ...rest) {
      const checkA = canUseSkillByTraits(unitA, skillA);
      const checkB = canUseSkillByTraits(unitB, skillB);
      if (!checkA.usable || !checkB.usable) {
        const winner = !checkA.usable && !checkB.usable ? "Tie" : (!checkA.usable ? "B" : "A");
        return blockedSkillResult(!checkA.usable ? checkA : checkB, {
          winner,
          clashWinner: winner,
          clashLogs: [{ winner, note: [!checkA.usable ? checkA.reason : null, !checkB.usable ? checkB.reason : null].filter(Boolean).join(" | ") }],
        });
      }
      return originalClash.call(this, unitA, skillA, unitB, skillB, ...rest);
    };

    if (originalSpell) engine.resolveSpell = function (spellSkill, target, ...rest) {
      const caster = spellSkill?.caster || spellSkill?.owner || null;
      if (caster) {
        const check = canUseSkillByTraits(caster, spellSkill);
        if (!check.usable) return blockedSkillResult(check, { winner: "Target", isSuccess: true, dc: spellSkill?.saveDC ?? null, savePower: null });
      }
      return originalSpell.call(this, spellSkill, target, ...rest);
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
      coin.src = coinEngine?.coinSrc ? coinEngine.coinSrc(side) : (side === "head" ? HEAD_COIN_SRC : TAIL_COIN_SRC);
      if (side === "head") next.total = numberOr(next.total, 0) + numberOr(next.headBonus, 4);
    }
    next.heads = next.coins.filter((entry) => entry.side === "head").length;
    next.reTosses = { coinIndex: failedIndex, attempted: used, maximum: attempts };

    let node = options?.container?.querySelector?.(`[data-coin-index='${failedIndex}'] img`);
    if (!node) node = options?.container?.querySelectorAll?.(".coin-toss-item")?.[failedIndex]?.querySelector?.("img") || null;
    if (node && coin.src) {
      node.src = coin.src;
      node.dataset.side = coin.side;
      node.alt = coin.side === "head" ? "Head" : "Tail";
    }
    if (options?.totalNode) {
      const wroteSafely = global.LuminousPlayerStats?.setRollTotalWithoutAdjustment?.(next.total, options.totalNode);
      if (!wroteSafely) options.totalNode.textContent = String(next.total);
    }
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

  function abilityIdFromLegacyKey(value) {
    const id = normalizeId(value);
    const aliases = {
      str: "str", strength: "str", fuerza: "str",
      dex: "dex", dexterity: "dex", destreza: "dex",
      con: "con", constitution: "con", constitucion: "con",
      int: "int", intelligence: "int", inteligencia: "int",
      wis: "wis", wisdom: "wis", sabiduria: "wis",
      cha: "cha", charisma: "cha", carisma: "cha",
    };
    return aliases[id] || null;
  }

  function inferLegacyCheckFromButton(button) {
    const actName = String(button?.getAttribute?.("name") || "");
    if (!actName.startsWith("act_roll_skill_")) return null;
    const raw = normalizeId(actName.slice("act_roll_skill_".length));
    const row = button.closest?.(".sheet-skill-row");
    const label = String(row?.querySelector?.(".sheet-skill-name")?.textContent || raw).trim();
    const labelId = normalizeId(label);
    const abilities = global.LuminousPlayerStats?.ABILITIES || [];
    let ability = abilities.find((entry) => {
      const keys = [entry?.id, entry?.key, entry?.code, entry?.name, entry?.spanish].map(normalizeId);
      return keys.includes(raw) || keys.includes(labelId) || (entry?.skills || []).some((skill) => [normalizeId(skill?.id), normalizeId(skill?.name)].includes(raw));
    });
    if (!ability) {
      ability = abilities.find((entry) => (entry?.skills || []).some((skill) => [normalizeId(skill?.id), normalizeId(skill?.name)].includes(labelId)));
    }
    const abilityId = normalizeId(ability?.id) || abilityIdFromLegacyKey(raw);
    const savingThrow = /saving[\s_-]*throw|save|salvaci[oó]n/i.test(label);
    const abilityLabels = [ability?.id, ability?.key, ability?.code, ability?.name, ability?.spanish, raw].filter(Boolean).map(normalizeId);
    const matchedSkill = (ability?.skills || []).find((skill) => [normalizeId(skill?.id), normalizeId(skill?.name)].includes(labelId));
    const kind = savingThrow ? "save" : matchedSkill ? "skill" : (abilityLabels.includes(labelId) ? "ability" : "skill");
    return {
      kind,
      abilityId,
      skillId: matchedSkill?.id || (kind === "skill" ? raw : null),
      label,
    };
  }

  function legacyCoinSnapshot(container) {
    const items = Array.from(container?.querySelectorAll?.(".coin-toss-item") || []);
    if (!items.length || items.some((item) => item.dataset?.stopped !== "true")) return null;
    const coins = items.map((item, index) => {
      const img = item.querySelector("img");
      const side = String(img?.src || "").includes("yshLPnQ") ? "head" : "tail";
      return { index, side, src: side === "head" ? HEAD_COIN_SRC : TAIL_COIN_SRC };
    });
    const statsText = String(doc.getElementById("coin-toss-stats")?.textContent || "");
    const probability = Number(statsText.match(/([0-9]+(?:\.[0-9]+)?)\s*%/)?.[1]);
    const totalNode = doc.getElementById("roll-total-score");
    return {
      coins,
      heads: coins.filter((coin) => coin.side === "head").length,
      headsChance: Number.isFinite(probability) ? probability : 50,
      headBonus: 4,
      total: numberOr(totalNode?.textContent, 0),
      totalNode,
    };
  }

  function watchLegacyCheckRoll(check) {
    const container = doc.getElementById("coin-toss-coins-container");
    if (!container || !check) return false;
    state.legacyCheckObserver?.disconnect?.();
    const token = String(++state.legacyCheckToken);
    container.dataset.luminousCheckToken = token;
    delete container.dataset.luminousRetossProcessed;

    const tryResolve = () => {
      if (container.dataset.luminousCheckToken !== token || container.dataset.luminousRetossProcessed === token) return;
      const snapshot = legacyCoinSnapshot(container);
      if (!snapshot) return;
      container.dataset.luminousRetossProcessed = token;
      applyCheckRetosses(snapshot, { container, totalNode: snapshot.totalNode }, check);
      state.activeCheck = null;
      state.legacyCheckObserver?.disconnect?.();
      state.legacyCheckObserver = null;
    };

    state.legacyCheckObserver = new MutationObserver(tryResolve);
    state.legacyCheckObserver.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-stopped", "src"] });
    global.setTimeout?.(tryResolve, 0);
    return true;
  }

  function installLegacyCheckBridge() {
    if (state.legacyCheckBridgeBound) return true;
    state.legacyCheckBridgeBound = true;
    doc.addEventListener("click", (event) => {
      const button = event.target?.closest?.(".sheet-roll-skill-btn");
      if (!button) return;
      const inferred = state.activeCheck ? { ...state.activeCheck } : inferLegacyCheckFromButton(button);
      if (!inferred) return;
      if (!inferred.abilityId) inferred.abilityId = inferLegacyCheckFromButton(button)?.abilityId || null;
      state.activeCheck = inferred;
      if (normalizeId(inferred.abilityId) === "str" && ["ability", "skill"].includes(normalizeId(inferred.kind))) {
        watchLegacyCheckRoll(inferred);
      }
    });
    return true;
  }

  function installAll() {
    installTraitEngineBridge();
    installCombatBridge();
    installViewerEncounterBridge();
    installTheatreCheckBridge();
    installCoinCheckBridge();
    installLegacyCheckBridge();
    dispatchPendingEncounterStart();
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
    canUseSkillByTraits,
    restrictionMatchesSkill,
    applyCheckRetosses,
    inferLegacyCheckFromButton,
    legacyCoinSnapshot,
    installLegacyCheckBridge,
    installViewerEncounterBridge,
    registerCombatUnit,
    registeredCombatUnits,
    currentRegisteredPlayerUnit,
  });
  global.LuminousTraitStandardizationRuntime = api;

  ensureDependencies().then(() => {
    installAll();
    global.setInterval(installAll, 800);
  }).catch((error) => console.error("Trait Standardization Runtime:", error));
})(window);
