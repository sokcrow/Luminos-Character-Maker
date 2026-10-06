(function (global) {
  "use strict";

  const STATES = Object.freeze({
    none: Object.freeze({ label: "Not Proficient", multiplier: 0 }),
    half: Object.freeze({ label: "Half Proficient", multiplier: 0.5 }),
    proficient: Object.freeze({ label: "Proficient", multiplier: 1 }),
    expertise: Object.freeze({ label: "Expertise", multiplier: 2 }),
  });

  const SKILL_ABILITIES = Object.freeze({
    athletics: "str",
    acrobatics: "dex",
    sleight_of_hand: "dex",
    stealth: "dex",
    arcana: "int",
    history: "int",
    investigation: "int",
    nature: "int",
    religion: "int",
    animal_handling: "wis",
    insight: "wis",
    medicine: "wis",
    perception: "wis",
    survival: "wis",
    deception: "cha",
    intimidation: "cha",
    performance: "cha",
    persuasion: "cha",
  });

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function normalizeState(value) {
    const id = String(value || "none").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(STATES, id) ? id : "none";
  }

  function proficiencyBonus(level) {
    return Math.ceil(Math.max(0, finite(level, 0)) / 20);
  }

  function contribution(level, state) {
    return Math.floor(proficiencyBonus(level) * STATES[normalizeState(state)].multiplier);
  }

  function abilityModifier(score) {
    return Math.floor((finite(score, 10) - 10) / 2);
  }

  function entityLevel(entity = {}) {
    const value = entity.effectiveLevel ?? entity.runtimeLevel ?? entity.level ?? entity.baseLevelSelected ?? 1;
    return Math.max(1, Math.trunc(finite(value, 1)));
  }

  function scoreFor(entity = {}, abilityId) {
    const id = String(abilityId || "").trim().toLowerCase();
    return finite(entity.scores?.[id] ?? entity.stats?.[id], 10);
  }

  function savingThrowState(entity = {}, abilityId) {
    const id = String(abilityId || "").trim().toLowerCase();
    const map = entity.proficiencies?.savingThrows || entity.savingThrowProficiencies || {};
    return normalizeState(map[id]);
  }

  function skillState(entity = {}, skillId) {
    const id = String(skillId || "").trim().toLowerCase();
    const map = entity.proficiencies?.skills || entity.skillProficiencies || {};
    return normalizeState(map[id]);
  }

  function savingThrowBonus(entity = {}, abilityId, options = {}) {
    const level = options.level ?? entityLevel(entity);
    const score = options.score ?? scoreFor(entity, abilityId);
    const state = options.state ?? savingThrowState(entity, abilityId);
    return abilityModifier(score) + contribution(level, state);
  }

  function skillBonus(entity = {}, skillId, options = {}) {
    const id = String(skillId || "").trim().toLowerCase();
    const ability = options.ability ?? SKILL_ABILITIES[id];
    const level = options.level ?? entityLevel(entity);
    const score = options.score ?? scoreFor(entity, ability);
    const state = options.state ?? skillState(entity, id);
    return abilityModifier(score) + contribution(level, state);
  }

  const api = Object.freeze({
    version: "1.0.0",
    STATES,
    SKILL_ABILITIES,
    normalizeState,
    proficiencyBonus,
    contribution,
    abilityModifier,
    entityLevel,
    scoreFor,
    savingThrowState,
    skillState,
    savingThrowBonus,
    skillBonus,
  });

  global.LuminousProficiencyRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
