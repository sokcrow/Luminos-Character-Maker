(function (global) {
  "use strict";

  const MILESTONE_LEVELS = Object.freeze([20, 40, 60, 80, 95]);
  const MAX_STAT = 20;
  const STAT_KEYS = Object.freeze(["fuerza", "destreza", "constitucion", "inteligencia", "sabiduria", "carisma"]);
  const STAT_ALIASES = Object.freeze({
    str: "fuerza", strength: "fuerza", fuerza: "fuerza",
    dex: "destreza", dexterity: "destreza", destreza: "destreza",
    con: "constitucion", constitution: "constitucion", constitucion: "constitucion", constitución: "constitucion",
    int: "inteligencia", intelligence: "inteligencia", inteligencia: "inteligencia",
    wis: "sabiduria", wisdom: "sabiduria", sabiduria: "sabiduria", sabiduría: "sabiduria",
    cha: "carisma", charisma: "carisma", carisma: "carisma",
  });

  const int = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function canonicalStatKey(value) {
    return STAT_ALIASES[normalizeId(value)] || null;
  }

  function normalizeClasses(value) {
    const source = Array.isArray(value)
      ? value
      : Object.entries(value || {}).map(([classId, levels]) => ({ classId, levels: levels?.levels ?? levels?.level ?? levels }));
    const totals = new Map();
    source.forEach((entry) => {
      const classId = normalizeId(entry?.classId || entry?.id);
      const levels = Math.max(0, int(entry?.levels ?? entry?.level, 0));
      if (!classId || !levels) return;
      totals.set(classId, (totals.get(classId) || 0) + levels);
    });
    return [...totals.entries()].map(([classId, levels]) => ({ classId, levels }));
  }

  function milestoneKey(classId, level) {
    return `${normalizeId(classId)}:${int(level, 0)}`;
  }

  function earnedMilestones(classes) {
    return normalizeClasses(classes).flatMap((entry) => MILESTONE_LEVELS
      .filter((level) => entry.levels >= level)
      .map((level) => ({
        key: milestoneKey(entry.classId, level),
        classId: entry.classId,
        classLevel: entry.levels,
        milestoneLevel: level,
      })));
  }

  function normalizeAllocation(value) {
    const output = {};
    Object.entries(value || {}).forEach(([key, rawAmount]) => {
      const stat = canonicalStatKey(key);
      const amount = int(rawAmount, 0);
      if (!stat || amount <= 0) return;
      output[stat] = (output[stat] || 0) + amount;
    });
    return output;
  }

  function normalizeChoice(value = {}) {
    const rawType = normalizeId(value.type || value.choiceType || value.mode);
    const type = ["trait", "general_trait", "generaltrait"].includes(rawType) ? "trait" : rawType === "stats" || rawType === "stat" ? "stats" : rawType;
    const choice = { type };
    if (type === "stats") choice.allocation = normalizeAllocation(value.allocation || value.stats || value.statAllocation);
    if (type === "trait") choice.traitId = normalizeId(value.traitId || value.generalTraitId || value.id);
    if (value.classId) choice.classId = normalizeId(value.classId);
    if (value.milestoneLevel != null || value.level != null) choice.milestoneLevel = int(value.milestoneLevel ?? value.level, 0);
    return choice;
  }

  function choiceAt(choices, classId, level) {
    const cid = normalizeId(classId);
    const milestone = int(level, 0);
    if (!cid || !milestone || !choices) return null;

    if (Array.isArray(choices)) {
      const found = choices.find((entry) => normalizeId(entry?.classId) === cid && int(entry?.milestoneLevel ?? entry?.level, 0) === milestone);
      return found ? normalizeChoice(found) : null;
    }

    const direct = choices[milestoneKey(cid, milestone)];
    if (direct) return normalizeChoice(direct);
    const nested = choices[cid]?.[milestone] ?? choices[cid]?.[String(milestone)];
    return nested ? normalizeChoice(nested) : null;
  }

  function allChoices(choices) {
    if (!choices) return [];
    if (Array.isArray(choices)) return choices.map(normalizeChoice).filter((entry) => entry.type);
    const output = [];
    Object.entries(choices).forEach(([key, value]) => {
      if (key.includes(":")) {
        const [classId, level] = key.split(":");
        const entry = normalizeChoice(value);
        if (!entry.classId) entry.classId = normalizeId(classId);
        if (!entry.milestoneLevel) entry.milestoneLevel = int(level, 0);
        if (entry.type) output.push(entry);
        return;
      }
      if (!value || typeof value !== "object") return;
      Object.entries(value).forEach(([level, nested]) => {
        const entry = normalizeChoice(nested);
        if (!entry.classId) entry.classId = normalizeId(key);
        if (!entry.milestoneLevel) entry.milestoneLevel = int(level, 0);
        if (entry.type) output.push(entry);
      });
    });
    return output;
  }

  function pendingMilestones(classes, choices) {
    return earnedMilestones(classes).filter((entry) => !choiceAt(choices, entry.classId, entry.milestoneLevel));
  }

  function normalizeStats(stats = {}) {
    const output = {};
    STAT_KEYS.forEach((key) => { output[key] = 10; });
    Object.entries(stats || {}).forEach(([key, rawValue]) => {
      const stat = canonicalStatKey(key);
      if (!stat) return;
      output[stat] = int(rawValue, output[stat]);
    });
    return output;
  }

  function rawStatValue(stats, stat) {
    const entry = Object.entries(stats || {}).find(([key]) => canonicalStatKey(key) === stat);
    return entry ? entry[1] : undefined;
  }

  function validateStatAllocation(stats, allocation) {
    const current = normalizeStats(stats);
    const normalized = normalizeAllocation(allocation);
    const entries = Object.entries(normalized);
    const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
    const errors = [];

    const validPattern =
      (entries.length === 1 && entries[0][1] === 2) ||
      (entries.length === 2 && entries.every(([, amount]) => amount === 1));

    if (total !== 2 || !validPattern) errors.push("La mejora debe ser +2 a un Stat o +1 a dos Stats diferentes.");
    entries.forEach(([stat, amount]) => {
      const rawValue = rawStatValue(stats, stat);
      const numericValue = Number(rawValue);
      const validSubmittedValue = rawValue != null && String(rawValue).trim() !== "" && Number.isFinite(numericValue) && Number.isInteger(numericValue);
      if (!validSubmittedValue) {
        errors.push(`${stat} debe tener un valor entero válido antes de aplicar el milestone.`);
        return;
      }
      if (current[stat] + amount > MAX_STAT) errors.push(`${stat} no puede superar ${MAX_STAT}.`);
    });

    return { valid: errors.length === 0, errors, allocation: normalized, stats: current };
  }

  function validateChoice(choiceInput, stats = {}) {
    const choice = normalizeChoice(choiceInput);
    if (choice.type === "stats") {
      const result = validateStatAllocation(stats, choice.allocation);
      return { ...result, choice: { ...choice, allocation: result.allocation } };
    }
    if (choice.type === "trait") {
      const errors = choice.traitId ? [] : ["Selecciona un Trait General."];
      return { valid: errors.length === 0, errors, choice };
    }
    return { valid: false, errors: ["Selecciona Stats o Trait General."], choice };
  }

  function applyStatAllocation(stats, allocation) {
    const validation = validateStatAllocation(stats, allocation);
    if (!validation.valid) return { valid: false, errors: validation.errors, stats: validation.stats };
    const next = { ...validation.stats };
    Object.entries(validation.allocation).forEach(([stat, amount]) => { next[stat] += amount; });
    return { valid: true, errors: [], stats: next, allocation: validation.allocation };
  }

  function isGeneralTraitDefinition(definition = {}) {
    const sourceType = normalizeId(definition?.source?.type || definition?.sourceType);
    const category = normalizeId(definition?.category || definition?.traitCategory);
    return sourceType === "general" || category === "general";
  }

  function selectedGeneralTraitIds(character = {}) {
    const choices = character?.characterBuild?.classMilestones || character?.classMilestones || {};
    return [...new Set(allChoices(choices)
      .filter((choice) => choice.type === "trait" && choice.traitId)
      .map((choice) => normalizeId(choice.traitId))
      .filter(Boolean))];
  }

  function resolveSelectedGeneralTraits(character = {}, catalog = {}) {
    const byId = catalog instanceof Map
      ? catalog
      : new Map(Object.entries(catalog || {}).map(([id, definition]) => [normalizeId(id), definition]));
    return selectedGeneralTraitIds(character)
      .map((id) => byId.get(id))
      .filter((definition) => definition && isGeneralTraitDefinition(definition))
      .map(clone);
  }

  function milestonePath(classId, level) {
    return `characterBuild/classMilestones/${normalizeId(classId)}/${int(level, 0)}`;
  }

  const api = Object.freeze({
    MILESTONE_LEVELS,
    MAX_STAT,
    STAT_KEYS,
    STAT_ALIASES,
    canonicalStatKey,
    normalizeClasses,
    milestoneKey,
    milestonePath,
    earnedMilestones,
    pendingMilestones,
    normalizeAllocation,
    normalizeChoice,
    choiceAt,
    allChoices,
    normalizeStats,
    validateStatAllocation,
    validateChoice,
    applyStatAllocation,
    isGeneralTraitDefinition,
    selectedGeneralTraitIds,
    resolveSelectedGeneralTraits,
  });

  global.LuminousClassMilestones = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
