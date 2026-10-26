(function (global) {
  "use strict";

  if (global.LuminousRacialStatRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRacialStatRuntime;
    return;
  }

  const ABILITY_IDS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
  const ABILITY_KEYS = Object.freeze({ str: "fuerza", dex: "destreza", con: "constitucion", int: "inteligencia", wis: "sabiduria", cha: "carisma" });
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const zeroBonuses = () => Object.fromEntries(ABILITY_IDS.map((id) => [id, 0]));
  let dependencyPromise = null;

  function characterInput(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    return {
      raceId: normalizeId(build.raceId ?? character.raceId ?? character.race?.id ?? "human") || "human",
      raceSubtypeId: normalizeId(build.raceSubtypeId ?? character.raceSubtypeId ?? character.race?.subtypeId ?? "") || null,
      racialStatChoices: Array.isArray(build.racialStatChoices)
        ? build.racialStatChoices
        : Array.isArray(character.racialStatChoices) ? character.racialStatChoices : [],
    };
  }

  function rules() {
    return global.LuminousCharacterBuildRules || null;
  }

  function resolveBonuses(character = {}) {
    const api = rules();
    if (!api) return zeroBonuses();
    const input = characterInput(character);
    if (api.EXISTING_RACIAL_STAT_RULES?.[input.raceId] && typeof api.resolveExistingRacialStatBonuses === "function") {
      return api.resolveExistingRacialStatBonuses(input);
    }
    if (api.RACIAL_STAT_RULES?.[input.raceId] && typeof api.resolveRacialStatBonuses === "function") {
      return api.resolveRacialStatBonuses(input);
    }
    return zeroBonuses();
  }

  function hasStoredRacialBreakdown(character = {}) {
    const saved = character?.characterBuild?.breakdown?.racialStatBonuses;
    return Boolean(saved && typeof saved === "object" && !Array.isArray(saved));
  }

  function hasBaseStats(character = {}) {
    return Boolean(character?.baseStats && typeof character.baseStats === "object" && ABILITY_IDS.some((id) => {
      const key = ABILITY_KEYS[id];
      return Number.isFinite(Number.parseInt(character.baseStats?.[key] ?? character.baseStats?.[id], 10));
    }));
  }

  function baseStats(character = {}) {
    const modernBase = hasBaseStats(character);
    return Object.fromEntries(ABILITY_IDS.map((id) => {
      const key = ABILITY_KEYS[id];
      const storedBase = Number.parseInt(character?.baseStats?.[key] ?? character?.baseStats?.[id], 10);
      if (modernBase && Number.isFinite(storedBase)) return [key, storedBase];
      const storedStat = Number.parseInt(character?.stats?.[key] ?? character?.stats?.[id], 10);
      return [key, Number.isFinite(storedStat) ? storedStat : 10];
    }));
  }

  function effectiveStats(character = {}) {
    const bonuses = resolveBonuses(character);
    const modernBase = hasBaseStats(character);
    const alreadyEffective = !modernBase && hasStoredRacialBreakdown(character);
    return Object.fromEntries(ABILITY_IDS.map((id) => {
      const key = ABILITY_KEYS[id];
      if (alreadyEffective) {
        const storedEffective = Number.parseInt(character?.stats?.[key] ?? character?.stats?.[id], 10);
        if (Number.isFinite(storedEffective)) return [key, storedEffective];
      }
      const base = Number.parseInt(baseStats(character)?.[key], 10);
      return [key, integerOr(base, 10) + Number(bonuses?.[id] || 0)];
    }));
  }

  function abilityScore(abilityId, character = {}) {
    const id = normalizeId(abilityId);
    const key = ABILITY_KEYS[id];
    if (!key) return null;
    return integerOr(effectiveStats(character)?.[key], 10);
  }

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve(true);
    const doc = global.document;
    if (!doc?.head) return Promise.resolve(false);
    let script = doc.getElementById(id);
    if (!script) {
      script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      doc.head.appendChild(script);
    }
    if (ready?.()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const finish = () => resolve(Boolean(ready?.()));
      script.addEventListener("load", finish, { once: true });
      script.addEventListener("error", () => resolve(false), { once: true });
    });
  }

  function ensureDependencies() {
    if (dependencyPromise) return dependencyPromise;
    dependencyPromise = Promise.resolve()
      .then(() => ensureScript("character-build-rules-script", "js/character-build-rules.js", () => Boolean(global.LuminousCharacterBuildRules)))
      .then(() => ensureScript("canonical-race-integration-script", "js/canonical-race-integration.js", () => Boolean(global.LuminousCharacterBuildRules?.__canonicalRaceIntegration)))
      .then(() => ensureScript("existing-racial-stat-integration-script", "js/existing-racial-stat-integration.js", () => Boolean(global.LuminousCharacterBuildRules?.__existingRacialStatIntegration)))
      .then(() => Boolean(global.LuminousCharacterBuildRules?.__existingRacialStatIntegration));
    return dependencyPromise;
  }

  const api = Object.freeze({
    ABILITY_IDS,
    ABILITY_KEYS,
    characterInput,
    resolveBonuses,
    hasBaseStats,
    hasStoredRacialBreakdown,
    baseStats,
    effectiveStats,
    abilityScore,
    ensureDependencies,
  });

  global.LuminousRacialStatRuntime = api;
  ensureDependencies();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
