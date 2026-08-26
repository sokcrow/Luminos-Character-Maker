(function (global) {
  "use strict";

  if (global.LuminousRacialSkillRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRacialSkillRuntime;
    return;
  }

  const SIN_TYPES = Object.freeze(["Wrath", "Lust", "Sloth", "Gluttony", "Gloom", "Pride", "Envy"]);
  const ABILITY_KEYS = Object.freeze({
    STR: Object.freeze(["STR", "str", "strength", "fuerza"]),
    DEX: Object.freeze(["DEX", "dex", "dexterity", "destreza"]),
    CON: Object.freeze(["CON", "con", "constitution", "constitucion", "constitución"]),
  });

  const ELEMENTS = Object.freeze({
    fire: Object.freeze({ sin: "Wrath", statusId: "burn", statusValue: "potency" }),
    cold: Object.freeze({ sin: "Gloom", statusId: "chill", statusValue: "count" }),
    lightning: Object.freeze({ sin: "Envy", statusId: "shock", statusValue: "count" }),
    acid: Object.freeze({ sin: "Gluttony", statusId: "corrosion", statusValue: "count" }),
    poison: Object.freeze({ sin: "Gluttony", statusId: "poison", statusValue: "potency" }),
    necrotic: Object.freeze({ sin: "Gloom", statusId: "decay", statusValue: "count" }),
    radiant: Object.freeze({ sin: "Pride", statusId: "radiance", statusValue: "count" }),
    psychic: Object.freeze({ sin: "Lust", statusId: "sinking", statusValue: "potency" }),
    thunder: Object.freeze({ sin: "Wrath", statusId: "tremor", statusValue: "potency" }),
    force: Object.freeze({ sin: "Sloth", statusId: "force", statusValue: "count" }),
  });

  const HALF_DRAGON_BREATHS = Object.freeze({
    red: "fire",
    black: "acid",
    green: "poison",
    white: "cold",
    blue: "lightning",
    gold: "radiant",
    brass: "fire",
    copper: "acid",
    bronze: "lightning",
    silver: "cold",
  });

  const NATURAL_SKILLS = Object.freeze({
    lizalin: Object.freeze({
      key: "lizalin_bite", id: "bite", name: "Bite", statPolicy: "STR", attackType: "Pierce",
      statusId: "ruptured", statusValue: "potency", naturalWeapon: "bite",
    }),
    felinae: Object.freeze({
      key: "felinae_claws", id: "claws", name: "Claws", statPolicy: "BEST_STR_DEX", attackType: "Slash",
      statusId: "bleed", statusValue: "potency", naturalWeapon: "claws",
    }),
    lupae: Object.freeze({
      key: "lupae_bite", id: "bite", name: "Bite", statPolicy: "STR", attackType: "Pierce",
      statusId: "ruptured", statusValue: "potency", naturalWeapon: "bite",
    }),
    centaur: Object.freeze({
      key: "centaur_hooves", id: "hooves", name: "Hooves", statPolicy: "STR", attackType: "Blunt",
      statusId: "tremor", statusValue: "potency", naturalWeapon: "hooves",
    }),
    lanae: Object.freeze({
      key: "lanae_horns", id: "horns", name: "Horns", statPolicy: "STR", attackType: "Blunt",
      statusId: "tremor", statusValue: "potency", naturalWeapon: "horns",
    }),
  });

  const BODY_SKILLS = Object.freeze({
    warforged: Object.freeze({
      subtype: "juggernaut", key: "warforged_iron_fists", id: "iron_fists", name: "Iron Fists",
      statPolicy: "STR", attackType: "Blunt", statusId: "tremor", statusValue: "potency", bodyWeapon: "iron_fists",
    }),
  });

  const state = {
    combatEngineSource: null,
    patchedTriggerEvent: null,
    patchedEncounterStart: null,
    patchedInitialize: null,
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clampLevel = (value) => Math.max(1, Math.trunc(numberOr(value, 1)));
  const dndModifier = (score) => Math.floor((numberOr(score, 10) - 10) / 2);

  function buildOf(unit = {}) {
    return unit.characterBuild && typeof unit.characterBuild === "object"
      ? unit.characterBuild
      : (unit.actor?.characterBuild && typeof unit.actor.characterBuild === "object" ? unit.actor.characterBuild : {});
  }

  function levelOf(unit = {}) {
    const build = buildOf(unit);
    return clampLevel(build.calculatedAtLevel ?? build.level ?? unit.level ?? unit.nivel ?? unit.actor?.level ?? 1);
  }

  function proficiencyBonus(unit = {}) {
    const level = levelOf(unit);
    const candidates = [
      unit.proficiencyBonus,
      unit.dndProficiencyBonus,
      unit.dndStats?.proficiencyBonus,
      unit.dnd?.proficiencyBonus,
      unit.actor?.proficiencyBonus,
      unit.actor?.dndStats?.proficiencyBonus,
    ];
    const explicit = candidates.find((value) => Number.isFinite(Number(value)));
    return explicit == null ? Math.ceil(level / 20) : Math.max(0, numberOr(explicit, 0));
  }

  function statContainers(unit = {}) {
    return [
      unit.stats,
      unit.dndStats,
      unit.abilities,
      unit.actor?.stats,
      unit.actor?.dndStats,
      unit.actor?.abilities,
    ].filter((value) => value && typeof value === "object");
  }

  function abilityScore(unit, ability) {
    const aliases = ABILITY_KEYS[ability] || [ability];
    for (const source of statContainers(unit)) {
      for (const key of aliases) {
        if (Number.isFinite(Number(source[key]))) return Number(source[key]);
      }
    }
    return 10;
  }

  function abilityModifier(unit, ability) {
    return dndModifier(abilityScore(unit, ability));
  }

  function resolveStat(unit, policy) {
    if (policy === "BEST_STR_DEX") {
      const str = abilityModifier(unit, "STR");
      const dex = abilityModifier(unit, "DEX");
      return dex > str ? { stat: "DEX", modifier: dex } : { stat: "STR", modifier: str };
    }
    const stat = policy || "STR";
    return { stat, modifier: abilityModifier(unit, stat) };
  }

  function levelTwentyStep(unit) {
    return Math.floor(levelOf(unit) / 20);
  }

  function statusAmount(unit) {
    return Math.max(1, Math.floor(levelOf(unit) / 5));
  }

  function canonicalSin(value) {
    const normalized = normalizeId(value);
    return SIN_TYPES.find((sin) => normalizeId(sin) === normalized) || null;
  }

  function naturalWeaponSin(unit = {}) {
    const build = buildOf(unit);
    const candidates = [
      build.naturalWeaponSin,
      build.racialNaturalWeaponSin,
      build.racialSkillSin,
      unit.naturalWeaponSin,
      unit.racialNaturalWeaponSin,
      unit.racialSkillSin,
    ];
    return candidates.map(canonicalSin).find(Boolean) || null;
  }

  function setNaturalWeaponSin(unit, sin) {
    if (!unit || typeof unit !== "object") return false;
    const canonical = canonicalSin(sin);
    if (!canonical) return false;
    if (!unit.characterBuild || typeof unit.characterBuild !== "object") unit.characterBuild = {};
    unit.characterBuild.naturalWeaponSin = canonical;
    refreshRacialSkills(unit);
    return true;
  }

  function raceIdentity(unit = {}) {
    const build = buildOf(unit);
    return {
      raceId: normalizeId(build.raceId ?? unit.raceId ?? unit.race?.id ?? unit.actor?.raceId ?? unit.actor?.race?.id),
      subtypeId: normalizeId(build.raceSubtypeId ?? unit.raceSubtypeId ?? unit.race?.subtypeId ?? unit.actor?.raceSubtypeId ?? unit.actor?.race?.subtypeId),
    };
  }

  function isNpc(unit = {}) {
    if (unit.isPlayer === true || unit.actor?.isPlayer === true) return false;
    if (unit.playerId || unit.player_id || unit.vinculo_jugador || unit.actor?.playerId || unit.actor?.vinculo_jugador) return false;
    if (unit.isPlayer === false || unit.actor?.isPlayer === false) return true;
    const explicitType = normalizeId(unit.characterType ?? unit.character_type ?? unit.tipo ?? unit.type ?? unit.actor?.tipo ?? unit.actor?.type);
    if (["npc", "enemy", "enemigo", "abnormality", "captain", "boss"].includes(explicitType)) return true;
    const faction = normalizeId(unit.faction ?? unit.faccion ?? unit.actor?.faction ?? unit.actor?.faccion);
    return ["enemy", "enemigo", "hostile", "hostil"].includes(faction);
  }

  function randomSin(rng = Math.random) {
    const raw = Math.max(0, Math.min(0.999999999, numberOr(rng(), 0)));
    return SIN_TYPES[Math.floor(raw * SIN_TYPES.length)];
  }

  function baseSkillConfig(unit, template, options = {}) {
    const resolved = resolveStat(unit, template.statPolicy);
    const step = levelTwentyStep(unit);
    const coinPowerBase = options.coinPowerBase ?? 15;
    return {
      basePower: proficiencyBonus(unit) + resolved.modifier + step,
      coinPower: coinPowerBase + resolved.modifier + step,
      coinAmount: 1,
      coinType: options.coinType || "standard",
      attackType: template.attackType,
      sinAffinity: options.sinAffinity ?? null,
      type: "Normal",
      statUsed: resolved.stat,
      skillFamily: "attack",
      attackMode: options.attackMode || "melee",
    };
  }

  function decorateSkill(skill, unit, template, options = {}) {
    const resolved = resolveStat(unit, template.statPolicy);
    skill.id = template.id;
    skill.name = template.name;
    skill.racialSkill = true;
    skill.racialSkillKey = template.key;
    skill.racialSkillKind = options.kind || "natural_weapon";
    skill.affinity = skill.sinAffinity ?? null;
    skill.pecado = skill.sinAffinity ?? null;
    skill.statUsed = resolved.stat;
    skill.skillFamily = "attack";
    skill.attackMode = options.attackMode || "melee";
    skill.tags = Array.from(new Set([...(skill.tags || []), "racial_skill", template.id, ...(options.tags || [])]));
    skill.damageType = options.damageType || template.attackType;
    if (template.naturalWeapon) skill.naturalWeapon = template.naturalWeapon;
    if (template.bodyWeapon) skill.bodyWeapon = template.bodyWeapon;
    skill.racialStatusOnHit = {
      statusId: options.statusId || template.statusId,
      valueMode: options.statusValue || template.statusValue || "count",
      amountFormula: "max(1, floor(Level / 5))",
    };
    skill.racialPowerFormula = {
      basePower: "Proficiency + StatMod + floor(Level / 20)",
      coinPower: `${options.coinPowerBase ?? 15} + StatMod + floor(Level / 20)`,
    };
    return skill;
  }

  function createSkill(engine, config) {
    if (engine?.createSkill) return engine.createSkill(config);
    const coinAmount = Math.max(1, config.coinAmount || 1);
    return {
      ...config,
      coins: Array.from({ length: coinAmount }, () => ({ type: config.coinType || "standard", status: "active", effects: [] })),
    };
  }

  function naturalTemplateFor(unit) {
    const { raceId, subtypeId } = raceIdentity(unit);
    if (NATURAL_SKILLS[raceId]) {
      const template = NATURAL_SKILLS[raceId];
      return { template, coinPowerBase: raceId === "felinae" && subtypeId === "large" ? 19 : 15 };
    }
    const body = BODY_SKILLS[raceId];
    if (body && (!body.subtype || body.subtype === subtypeId)) return { template: body, coinPowerBase: 15, kind: "body_weapon" };
    return null;
  }

  function breathTemplateFor(unit) {
    const { raceId, subtypeId } = raceIdentity(unit);
    if (raceId !== "half_dragon") return null;
    const elementId = HALF_DRAGON_BREATHS[subtypeId];
    const element = ELEMENTS[elementId];
    if (!element) return null;
    return {
      template: {
        key: `half_dragon_${subtypeId}_breath`,
        id: "dragon_breath",
        name: `${subtypeId === "gold" ? "Gold" : subtypeId.charAt(0).toUpperCase() + subtypeId.slice(1)} Dragon Breath`,
        statPolicy: "CON",
        attackType: elementId.charAt(0).toUpperCase() + elementId.slice(1),
        statusId: element.statusId,
        statusValue: element.statusValue,
      },
      elementId,
      element,
    };
  }

  function buildNaturalWeaponSkill(unit, engine = global.CombatEngine) {
    const resolved = naturalTemplateFor(unit);
    if (!resolved) return null;
    const selectedSin = isNpc(unit) ? (unit.__racialSkillEncounterSin || null) : naturalWeaponSin(unit);
    const config = baseSkillConfig(unit, resolved.template, {
      coinPowerBase: resolved.coinPowerBase,
      sinAffinity: selectedSin,
      coinType: "standard",
      attackMode: "melee",
    });
    const skill = createSkill(engine, config);
    skill.requiresSinSelection = !selectedSin && !isNpc(unit);
    return decorateSkill(skill, unit, resolved.template, {
      kind: resolved.kind || "natural_weapon",
      coinPowerBase: resolved.coinPowerBase,
      tags: [resolved.kind === "body_weapon" ? "body_weapon" : "natural_weapon"],
    });
  }

  function buildBreathWeaponSkill(unit, engine = global.CombatEngine) {
    const resolved = breathTemplateFor(unit);
    if (!resolved) return null;
    const config = baseSkillConfig(unit, resolved.template, {
      coinPowerBase: 15,
      sinAffinity: resolved.element.sin,
      coinType: "unbreakable",
      attackMode: "ranged",
    });
    const skill = createSkill(engine, config);
    decorateSkill(skill, unit, resolved.template, {
      kind: "breath_weapon",
      coinPowerBase: 15,
      statusId: resolved.element.statusId,
      statusValue: resolved.element.statusValue,
      tags: ["breath_weapon", "dragon_breath", resolved.elementId],
      attackMode: "ranged",
    });
    skill.breathWeapon = true;
    skill.breathElement = resolved.elementId;
    skill.damageType = resolved.elementId;
    return skill;
  }

  function allSequenceSkills(unit = {}) {
    return [1, 2, 3].flatMap((tier) => Array.isArray(unit[`attack_tier_${tier}_sequence`]) ? unit[`attack_tier_${tier}_sequence`] : []);
  }

  function mergeSkill(target, source) {
    if (!target || !source) return target;
    const oldCoins = target.coins;
    Object.assign(target, source);
    if (Array.isArray(oldCoins) && oldCoins.length === source.coinAmount) {
      target.coins = oldCoins.map((coin, index) => ({ ...source.coins?.[index], ...coin, type: source.coinType || coin.type }));
    }
    return target;
  }

  function upsertTierOne(unit, skill) {
    if (!skill) return null;
    if (!Array.isArray(unit.attack_tier_1_sequence)) unit.attack_tier_1_sequence = [];
    const existing = allSequenceSkills(unit).find((entry) => entry?.racialSkillKey === skill.racialSkillKey);
    if (existing) return mergeSkill(existing, skill);
    unit.attack_tier_1_sequence.push(skill);
    return skill;
  }

  function attachRacialSkills(unit, engine = global.CombatEngine) {
    if (!unit || typeof unit !== "object") return [];
    const attached = [];
    const natural = buildNaturalWeaponSkill(unit, engine);
    const breath = buildBreathWeaponSkill(unit, engine);
    if (natural) attached.push(upsertTierOne(unit, natural));
    if (breath) attached.push(upsertTierOne(unit, breath));
    return attached.filter(Boolean);
  }

  function refreshRacialSkills(unit, engine = global.CombatEngine) {
    return attachRacialSkills(unit, engine);
  }

  function prepareEncounter(allUnits = [], options = {}) {
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const engine = options.engine || global.CombatEngine;
    const units = Array.isArray(allUnits) ? allUnits : Object.values(allUnits || {});
    units.forEach((unit) => {
      if (!unit || typeof unit !== "object") return;
      if (naturalTemplateFor(unit) && isNpc(unit)) unit.__racialSkillEncounterSin = randomSin(rng);
      attachRacialSkills(unit, engine);
    });
    return units;
  }

  function statusInputFor(skill, unit) {
    const effect = skill?.racialStatusOnHit;
    if (!effect?.statusId) return null;
    const amount = statusAmount(unit);
    const input = { mode: "inflict", sourceUnitId: unit?.id || unit?.unitId || null };
    if (normalizeId(effect.valueMode) === "potency") input.potency = amount;
    else input.count = amount;
    return { statusId: effect.statusId, amount, input };
  }

  function applyRacialOnHit(context = {}, targets = []) {
    const skill = context.skill;
    if (!skill?.racialStatusOnHit) return [];
    const attacker = context.attacker || context.unitAttacker || context.self || null;
    const engine = global.LuminousStatusEngine;
    if (!engine?.applyStatus || !attacker) return [];
    const resolved = statusInputFor(skill, attacker);
    if (!resolved) return [];
    const contextTargets = Array.isArray(context.targetsHit) ? context.targetsHit.filter(Boolean) : [];
    const executionTargets = (contextTargets.length ? contextTargets : (targets && targets.length ? targets : [context.currentTarget || context.defender])).filter(Boolean);
    return executionTargets.map((target) => ({
      target,
      status: engine.applyStatus(target, resolved.statusId, resolved.input),
      statusId: resolved.statusId,
      amount: resolved.amount,
    }));
  }

  function installCombatBridge() {
    const engine = global.CombatEngine;
    if (!engine) return false;
    state.combatEngineSource = engine;

    if (typeof engine.initializeUnitData === "function" && !engine.initializeUnitData.__racialSkillRuntime) {
      const source = engine.initializeUnitData;
      const wrapped = function (unit, ...rest) {
        attachRacialSkills(unit, this);
        return source.call(this, unit, ...rest);
      };
      Object.defineProperty(wrapped, "__racialSkillRuntime", { value: true });
      engine.initializeUnitData = wrapped;
      state.patchedInitialize = wrapped;
    }

    if (typeof engine.triggerEncounterStart === "function" && !engine.triggerEncounterStart.__racialSkillRuntime) {
      const source = engine.triggerEncounterStart;
      const wrapped = function (allUnits = [], ...rest) {
        prepareEncounter(allUnits, { engine: this });
        return source.call(this, allUnits, ...rest);
      };
      Object.defineProperty(wrapped, "__racialSkillRuntime", { value: true });
      engine.triggerEncounterStart = wrapped;
      state.patchedEncounterStart = wrapped;
    }

    if (typeof engine.triggerEvent === "function" && !engine.triggerEvent.__racialSkillRuntime) {
      const source = engine.triggerEvent;
      const wrapped = function (tag, context, targets = []) {
        const result = source.call(this, tag, context, targets);
        if (String(tag) === "[On Hit]") applyRacialOnHit(context, targets);
        return result;
      };
      Object.defineProperty(wrapped, "__racialSkillRuntime", { value: true });
      engine.triggerEvent = wrapped;
      state.patchedTriggerEvent = wrapped;
    }
    return true;
  }

  const api = Object.freeze({
    SIN_TYPES,
    ELEMENTS,
    HALF_DRAGON_BREATHS,
    NATURAL_SKILLS,
    BODY_SKILLS,
    levelOf,
    proficiencyBonus,
    abilityScore,
    abilityModifier,
    resolveStat,
    statusAmount,
    canonicalSin,
    naturalWeaponSin,
    setNaturalWeaponSin,
    raceIdentity,
    isNpc,
    randomSin,
    naturalTemplateFor,
    breathTemplateFor,
    buildNaturalWeaponSkill,
    buildBreathWeaponSkill,
    attachRacialSkills,
    refreshRacialSkills,
    prepareEncounter,
    statusInputFor,
    applyRacialOnHit,
    installCombatBridge,
  });

  global.LuminousRacialSkillRuntime = api;
  installCombatBridge();
  if (global.document && typeof global.setInterval === "function") global.setInterval(installCombatBridge, 400);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
