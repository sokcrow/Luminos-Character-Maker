(function (global) {
  "use strict";

  if (global.LuminousItemAffinityEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemAffinityEngine;
    return;
  }

  const VERSION = 2;
  const CANONICAL_AFFINITY_TOTAL = 100;

  const TARGET_BRANCH = Object.freeze({
    athletics: "str",
    str_save: "str",

    acrobatics: "dex",
    sleight_of_hand: "dex",
    stealth: "dex",
    dex_save: "dex",

    con_save: "con",

    arcana: "int",
    history: "int",
    investigation: "int",
    nature: "int",
    religion: "int",
    int_save: "int",

    animal_handling: "wis",
    insight: "wis",
    medicine: "wis",
    perception: "wis",
    survival: "wis",
    wis_save: "wis",

    deception: "cha",
    persuasion: "cha",
    intimidation: "cha",
    performance: "cha",
    cha_save: "cha",
  });

  const VALID_TARGETS = Object.freeze(new Set(Object.keys(TARGET_BRANCH)));

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function affinitySource(itemOrMap) {
    if (!itemOrMap || typeof itemOrMap !== "object") return {};
    if (itemOrMap.culinaryAffinities && typeof itemOrMap.culinaryAffinities === "object") {
      return itemOrMap.culinaryAffinities;
    }
    return itemOrMap;
  }

  function normalizeAffinityEntries(itemOrMap) {
    const source = affinitySource(itemOrMap);
    const merged = new Map();
    const entries = Array.isArray(source)
      ? source.map((entry) => [entry?.target, entry?.weight ?? entry?.percent ?? entry?.affinity])
      : Object.entries(source);

    for (const [rawTarget, rawWeight] of entries) {
      const target = normalizeId(rawTarget);
      if (!VALID_TARGETS.has(target)) continue;
      const numeric = Number(rawWeight);
      if (!Number.isFinite(numeric) || numeric <= 0) continue;
      const weight = Math.min(100, Math.max(0, numeric));
      merged.set(target, Math.min(100, (merged.get(target) || 0) + weight));
    }

    return Object.freeze(
      [...merged.entries()]
        .map(([target, weight]) => Object.freeze({
          target,
          weight,
          branch: TARGET_BRANCH[target],
        }))
        .sort((a, b) => a.target.localeCompare(b.target))
    );
  }

  function affinityTotal(itemOrMap) {
    return normalizeAffinityEntries(itemOrMap).reduce((sum, entry) => sum + entry.weight, 0);
  }

  function isCanonicalAffinityDistribution(itemOrMap) {
    return affinityTotal(itemOrMap) === CANONICAL_AFFINITY_TOTAL;
  }

  function normalizedAffinityPercentages(itemOrMap) {
    const entries = normalizeAffinityEntries(itemOrMap);
    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    if (totalWeight <= 0) return Object.freeze([]);
    return Object.freeze(entries.map((entry) => Object.freeze({
      target: entry.target,
      branch: entry.branch,
      weight: entry.weight,
      percent: (entry.weight / totalWeight) * 100,
    })));
  }

  function branchAffinityWeights(itemOrMap) {
    const branchWeights = Object.create(null);
    for (const entry of normalizeAffinityEntries(itemOrMap)) {
      branchWeights[entry.branch] = (branchWeights[entry.branch] || 0) + entry.weight;
    }
    return Object.freeze({ ...branchWeights });
  }

  function affinityProfile(itemOrMap) {
    const entries = normalizeAffinityEntries(itemOrMap);
    return Object.freeze({
      entries,
      totalWeight: entries.reduce((sum, entry) => sum + entry.weight, 0),
      normalizedPercentages: normalizedAffinityPercentages(itemOrMap),
      branchWeights: branchAffinityWeights(itemOrMap),
    });
  }

  function pickWeightedAffinity(itemOrMap, options = {}) {
    const entries = normalizeAffinityEntries(itemOrMap);
    if (!entries.length) return null;

    const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const rawRoll = Number.isFinite(Number(options.roll)) ? Number(options.roll) : Number(rng());
    const roll = Math.min(0.999999999999, Math.max(0, Number.isFinite(rawRoll) ? rawRoll : 0));
    let cursor = roll * totalWeight;

    for (const entry of entries) {
      if (cursor < entry.weight) return entry;
      cursor -= entry.weight;
    }
    return entries[entries.length - 1];
  }

  function materializeCulinaryAffinity(item = {}, options = {}) {
    const existing = Array.isArray(item.culinaryProperties) ? item.culinaryProperties : [];
    if (existing.length && options.reroll !== true) {
      return Object.freeze({
        ...item,
        culinaryProperties: Object.freeze(existing.map((entry) => Object.freeze({ ...entry }))),
      });
    }

    const picked = pickWeightedAffinity(item, options);
    if (!picked) {
      return Object.freeze({
        ...item,
        culinaryProperties: Object.freeze([]),
      });
    }

    const sourceInstanceId = String(
      options.sourceInstanceId || item.sourceInstanceId || item.instanceId || ""
    ).trim();

    return Object.freeze({
      ...item,
      sourceInstanceId: sourceInstanceId || item.sourceInstanceId || null,
      culinaryProperties: Object.freeze([
        Object.freeze({
          target: picked.target,
          sourceInstanceId: sourceInstanceId || null,
          affinityBranch: picked.branch,
          source: "item_affinity_v1",
        }),
      ]),
    });
  }

  const API = Object.freeze({
    VERSION,
    CANONICAL_AFFINITY_TOTAL,
    TARGET_BRANCH,
    VALID_TARGETS,
    normalizeId,
    normalizeAffinityEntries,
    affinityTotal,
    isCanonicalAffinityDistribution,
    normalizedAffinityPercentages,
    branchAffinityWeights,
    affinityProfile,
    pickWeightedAffinity,
    materializeCulinaryAffinity,
  });

  global.LuminousItemAffinityEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
