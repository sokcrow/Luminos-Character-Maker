(function (global) {
  "use strict";

  if (global.LuminousLootCheckRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootCheckRuntime;
    return;
  }

  const VERSION = 1;
  const COIN_COUNT = 5;
  const HEAD_BONUS = 4;

  const PROFICIENCY_STATES = Object.freeze({
    none: Object.freeze({ multiplier: 0 }),
    half: Object.freeze({ multiplier: 0.5 }),
    proficient: Object.freeze({ multiplier: 1 }),
    expertise: Object.freeze({ multiplier: 2 }),
  });

  const ABILITIES = Object.freeze({
    str: Object.freeze({ id: "str", keys: Object.freeze(["str", "strength", "fuerza"]) }),
    dex: Object.freeze({ id: "dex", keys: Object.freeze(["dex", "dexterity", "destreza"]) }),
    con: Object.freeze({ id: "con", keys: Object.freeze(["con", "constitution", "constitucion"]) }),
    int: Object.freeze({ id: "int", keys: Object.freeze(["int", "intelligence", "inteligencia"]) }),
    wis: Object.freeze({ id: "wis", keys: Object.freeze(["wis", "wisdom", "sabiduria"]) }),
    cha: Object.freeze({ id: "cha", keys: Object.freeze(["cha", "charisma", "carisma"]) }),
  });

  const SKILLS = Object.freeze({
    athletics: Object.freeze({ id: "athletics", ability: "str" }),
    acrobatics: Object.freeze({ id: "acrobatics", ability: "dex" }),
    sleight_of_hand: Object.freeze({ id: "sleight_of_hand", ability: "dex" }),
    stealth: Object.freeze({ id: "stealth", ability: "dex" }),
    arcana: Object.freeze({ id: "arcana", ability: "int" }),
    history: Object.freeze({ id: "history", ability: "int" }),
    investigation: Object.freeze({ id: "investigation", ability: "int" }),
    nature: Object.freeze({ id: "nature", ability: "int" }),
    religion: Object.freeze({ id: "religion", ability: "int" }),
    animal_handling: Object.freeze({ id: "animal_handling", ability: "wis" }),
    insight: Object.freeze({ id: "insight", ability: "wis" }),
    medicine: Object.freeze({ id: "medicine", ability: "wis" }),
    perception: Object.freeze({ id: "perception", ability: "wis" }),
    survival: Object.freeze({ id: "survival", ability: "wis" }),
    deception: Object.freeze({ id: "deception", ability: "cha" }),
    intimidation: Object.freeze({ id: "intimidation", ability: "cha" }),
    performance: Object.freeze({ id: "performance", ability: "cha" }),
    persuasion: Object.freeze({ id: "persuasion", ability: "cha" }),
  });

  const CHECK_PROFILES = Object.freeze({
    search: Object.freeze({
      id: "search",
      label: "Search",
      phase: "post_combat",
      defaultSkill: "investigation",
      skills: Object.freeze(["investigation"]),
    }),
    harvest: Object.freeze({
      id: "harvest",
      label: "Harvest",
      phase: "post_combat",
      defaultSkill: "survival",
      skills: Object.freeze(["survival"]),
    }),
    extract: Object.freeze({
      id: "extract",
      label: "Extract",
      phase: "post_combat",
      defaultSkill: "medicine",
      skills: Object.freeze(["medicine"]),
    }),
    salvage: Object.freeze({
      id: "salvage",
      label: "Salvage",
      phase: "post_combat",
      defaultSkill: "investigation",
      skills: Object.freeze(["investigation"]),
    }),
    autopsy: Object.freeze({
      id: "autopsy",
      label: "Autopsy",
      phase: "post_combat",
      defaultSkill: "medicine",
      skills: Object.freeze(["medicine", "investigation"]),
    }),
    analyze: Object.freeze({
      id: "analyze",
      label: "Analyze",
      phase: "combat",
      defaultSkill: "perception",
      skills: Object.freeze(["perception"]),
    }),
  });

  const CHECK_ALIASES = Object.freeze({
    loot_search: "search",
    search_corpse: "search",
    butcher: "harvest",
    field_dress: "harvest",
    delicate_extract: "extract",
    organ_extract: "extract",
    scavenging: "salvage",
    examine_corpse: "autopsy",
    analyse: "analyze",
  });

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function numberOr(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function integerOr(value, fallback = 0) {
    const numeric = Number.parseInt(value, 10);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, numberOr(value, min)));
  }

  function normalizeProficiencyState(value) {
    if (value === true) return "proficient";
    if (value === false || value == null) return "none";
    const normalized = normalizeId(value);
    if (normalized === "expert" || normalized === "expertise") return "expertise";
    if (normalized === "half" || normalized === "half_proficient" || normalized === "half_proficiency") return "half";
    if (normalized === "proficient" || normalized === "proficiency" || normalized === "trained") return "proficient";
    return "none";
  }

  function proficiencyBonus(actor = {}) {
    const explicit = actor.proficiencyBonus ?? actor.dndProficiencyBonus ?? actor.dnd?.proficiencyBonus;
    if (Number.isFinite(Number(explicit))) return Math.max(0, numberOr(explicit, 0));

    const levelSource =
      actor.level ??
      actor.runtimeLevel ??
      actor.baseLevelSelected ??
      actor.effectiveLevel ??
      actor.mechanics?.runtimeLevel ??
      actor.mechanics?.level ??
      1;
    return Math.ceil(Math.max(1, numberOr(levelSource, 1)) / 20);
  }

  function proficiencyContribution(actor, state) {
    const normalized = normalizeProficiencyState(state);
    return Math.floor(proficiencyBonus(actor) * PROFICIENCY_STATES[normalized].multiplier);
  }

  function abilityModifier(score) {
    return Math.floor((numberOr(score, 10) - 10) / 2);
  }

  function abilityScore(actor = {}, abilityId) {
    const ability = ABILITIES[normalizeId(abilityId)];
    if (!ability) return 10;

    try {
      const racial = global.LuminousRacialStatRuntime?.abilityScore?.(ability.id, actor);
      if (Number.isFinite(Number(racial))) return Number(racial);
    } catch (_) {}

    const sources = [
      actor.scores,
      actor.stats,
      actor.dndStats,
      actor.abilities,
      actor.dnd?.scores,
      actor.dnd?.stats,
    ];
    for (const source of sources) {
      if (!source || typeof source !== "object") continue;
      for (const key of ability.keys) {
        if (Number.isFinite(Number(source[key]))) return Number(source[key]);
      }
    }

    for (const key of ability.keys) {
      if (Number.isFinite(Number(actor[key]))) return Number(actor[key]);
    }
    return 10;
  }

  function skillProficiencyState(actor = {}, skillId) {
    const id = normalizeId(skillId);
    const nested = actor.dndSkills?.[id];
    const sources = [
      actor.skillProficiency,
      actor.skillProficiencies,
      actor.dndSkillProficiency,
      actor.proficiencies?.skills,
      actor.dnd?.skillProficiency,
      actor.dnd?.skills,
    ];
    for (const source of sources) {
      if (!source || typeof source !== "object") continue;
      if (source[id] != null) {
        const value = source[id];
        if (value && typeof value === "object") {
          return normalizeProficiencyState(value.proficiency ?? value.proficiencyState ?? value.state);
        }
        return normalizeProficiencyState(value);
      }
    }
    return normalizeProficiencyState(nested?.proficiency ?? nested?.proficiencyState ?? nested?.state);
  }

  function skillMath(actor = {}, skillId) {
    const id = normalizeId(skillId);
    const skill = SKILLS[id];
    if (!skill) return null;

    const explicit = actor.dndSkills?.[id]?.value;
    const score = abilityScore(actor, skill.ability);
    const modifier = abilityModifier(score);
    const proficiencyState = skillProficiencyState(actor, id);
    const proficiencyValue = proficiencyContribution(actor, proficiencyState);
    const computedBase = modifier + proficiencyValue;
    const hasExplicit = Number.isFinite(Number(explicit));
    const base = hasExplicit ? Number(explicit) : computedBase;

    return Object.freeze({
      skill: id,
      ability: skill.ability,
      score,
      modifier,
      proficiencyState,
      proficiencyBonus: proficiencyBonus(actor),
      proficiencyValue,
      computedBase,
      explicitValue: hasExplicit ? Number(explicit) : null,
      source: hasExplicit ? "dndSkills.value" : "ability_plus_proficiency",
      base,
    });
  }

  function currentSp(actor = {}) {
    return integerOr(
      actor.combat_stats?.sp ??
      actor.combatStats?.sp_actual ??
      actor.combatStats?.sp ??
      actor.sp_actual ??
      actor.sp,
      0,
    );
  }

  function headsChance(actor = {}) {
    return clamp(50 + currentSp(actor), 5, 95);
  }

  function canonicalCheckId(checkId) {
    const normalized = normalizeId(checkId);
    return CHECK_ALIASES[normalized] || normalized;
  }

  function getCheckProfile(checkId) {
    return CHECK_PROFILES[canonicalCheckId(checkId)] || null;
  }

  function thresholdParts(options = {}) {
    const hasBase = Number.isFinite(Number(options.threshold ?? options.dc ?? options.thresholdBase));
    if (!hasBase) return Object.freeze({ thresholdBase: null, thresholdModifier: 0, threshold: null });
    const thresholdBase = numberOr(options.threshold ?? options.dc ?? options.thresholdBase, 0);
    const thresholdModifier = numberOr(options.thresholdModifier ?? options.dcModifier, 0);
    return Object.freeze({
      thresholdBase,
      thresholdModifier,
      threshold: thresholdBase + thresholdModifier,
    });
  }

  function createSkillCheckDefinition(actor = {}, skillId, options = {}) {
    const math = skillMath(actor, skillId);
    if (!math) throw new Error(`UNKNOWN_DND_SKILL:${normalizeId(skillId)}`);
    const threshold = thresholdParts(options);
    return Object.freeze({
      type: "check",
      checkId: normalizeId(options.checkId || "skill_check"),
      label: String(options.label || math.skill),
      phase: options.phase || null,
      actor,
      skill: math.skill,
      ability: math.ability,
      base: math.base,
      math,
      sp: currentSp(actor),
      headsChance: headsChance(actor),
      coinCount: Math.max(1, integerOr(options.coinCount, COIN_COUNT)),
      headBonus: integerOr(options.headBonus, HEAD_BONUS),
      ...threshold,
      metadata: options.metadata || null,
    });
  }

  function createLootCheckDefinition(actor = {}, checkId, options = {}) {
    const profile = getCheckProfile(checkId);
    if (!profile) throw new Error(`UNKNOWN_LOOT_CHECK:${canonicalCheckId(checkId)}`);
    const requestedSkill = normalizeId(options.skill || options.skillId || profile.defaultSkill);
    if (!profile.skills.includes(requestedSkill)) {
      throw new Error(`SKILL_NOT_ALLOWED_FOR_CHECK:${profile.id}:${requestedSkill}`);
    }
    return createSkillCheckDefinition(actor, requestedSkill, {
      ...options,
      checkId: profile.id,
      label: options.label || profile.label,
      phase: options.phase || profile.phase,
    });
  }

  function rollSide(chance, rng) {
    const random = typeof rng === "function" ? rng : Math.random;
    return random() * 100 < clamp(chance, 5, 95) ? "head" : "tail";
  }

  function rollCheck(definition, options = {}) {
    if (!definition || definition.type !== "check") throw new Error("CHECK_DEFINITION_REQUIRED");
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const coinCount = Math.max(1, integerOr(definition.coinCount, COIN_COUNT));
    const headBonus = integerOr(definition.headBonus, HEAD_BONUS);
    const coins = [];
    let heads = 0;
    for (let index = 0; index < coinCount; index += 1) {
      const side = rollSide(definition.headsChance, rng);
      if (side === "head") heads += 1;
      coins.push(Object.freeze({ index, side }));
    }
    const total = numberOr(definition.base, 0) + heads * headBonus;
    const threshold = Number.isFinite(Number(definition.threshold)) ? Number(definition.threshold) : null;
    const success = threshold == null ? null : total >= threshold;
    return Object.freeze({
      checkId: definition.checkId,
      label: definition.label,
      phase: definition.phase,
      skill: definition.skill,
      ability: definition.ability,
      base: definition.base,
      total,
      heads,
      tails: coinCount - heads,
      coinCount,
      headBonus,
      headsChance: definition.headsChance,
      threshold,
      success,
      margin: threshold == null ? null : total - threshold,
      coins: Object.freeze(coins),
      math: definition.math,
      metadata: definition.metadata,
    });
  }

  function resolveLootCheck(actor = {}, checkId, options = {}) {
    const definition = createLootCheckDefinition(actor, checkId, options);
    return rollCheck(definition, options);
  }

  const API = Object.freeze({
    VERSION,
    COIN_COUNT,
    HEAD_BONUS,
    PROFICIENCY_STATES,
    ABILITIES,
    SKILLS,
    CHECK_PROFILES,
    CHECK_ALIASES,
    normalizeId,
    normalizeProficiencyState,
    proficiencyBonus,
    proficiencyContribution,
    abilityModifier,
    abilityScore,
    skillProficiencyState,
    skillMath,
    currentSp,
    headsChance,
    canonicalCheckId,
    getCheckProfile,
    createSkillCheckDefinition,
    createLootCheckDefinition,
    rollCheck,
    resolveLootCheck,
  });

  global.LuminousLootCheckRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
