(function (global) {
  "use strict";

  if (global.LuminousRacialStatPreviewBridge) return;

  const ABILITY_IDS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
  const ABILITY_KEYS = Object.freeze({ str: "fuerza", dex: "destreza", con: "constitucion", int: "inteligencia", wis: "sabiduria", cha: "carisma" });
  const doc = global.document || null;
  let bound = false;

  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const field = (id) => doc?.getElementById(id) || null;

  function currentInput() {
    const canonicalChoices = [field("canonical-racial-stat-choice-1")?.value, field("canonical-racial-stat-choice-2")?.value];
    const existingChoices = [field("existing-racial-stat-choice-1")?.value, field("existing-racial-stat-choice-2")?.value];
    const choices = existingChoices.some(Boolean) ? existingChoices : canonicalChoices;
    return {
      raceId: normalizeId(field("dm-player-build-race")?.value || "human") || "human",
      raceSubtypeId: normalizeId(field("dm-player-build-subrace")?.value || ""),
      racialStatChoices: choices.filter(Boolean),
    };
  }

  function readBaseStats() {
    return Object.fromEntries(ABILITY_IDS.map((id) => [ABILITY_KEYS[id], integerOr(field(`dm-player-stat-${id}`)?.value, 10)]));
  }

  function writeStats(stats) {
    ABILITY_IDS.forEach((id) => {
      const input = field(`dm-player-stat-${id}`);
      const key = ABILITY_KEYS[id];
      if (input && stats?.[key] != null) input.value = String(integerOr(stats[key], 10));
    });
  }

  function effectiveStats(baseStats, input = currentInput()) {
    const rules = global.LuminousCharacterBuildRules;
    if (!rules) return baseStats;
    if (rules.EXISTING_RACIAL_STAT_RULES?.[input.raceId] && typeof rules.resolveExistingEffectiveStats === "function") {
      return rules.resolveExistingEffectiveStats(baseStats, input);
    }
    if (typeof rules.resolveEffectiveStats === "function") return rules.resolveEffectiveStats(baseStats, input);
    return baseStats;
  }

  function exposeForCurrentEvent() {
    const base = readBaseStats();
    writeStats(effectiveStats(base));
    const restore = () => writeStats(base);
    if (typeof global.queueMicrotask === "function") global.queueMicrotask(restore);
    else Promise.resolve().then(restore);
  }

  function bind() {
    if (!doc || bound) return false;
    doc.addEventListener("input", (event) => {
      if (ABILITY_IDS.some((id) => event.target?.id === `dm-player-stat-${id}`)) exposeForCurrentEvent();
    }, true);
    doc.addEventListener("change", (event) => {
      if ([
        "dm-player-build-race",
        "dm-player-build-subrace",
        "canonical-racial-stat-choice-1",
        "canonical-racial-stat-choice-2",
        "existing-racial-stat-choice-1",
        "existing-racial-stat-choice-2",
      ].includes(event.target?.id)) exposeForCurrentEvent();
    }, true);
    bound = true;
    return true;
  }

  const api = Object.freeze({ currentInput, readBaseStats, effectiveStats, exposeForCurrentEvent, bind });
  global.LuminousRacialStatPreviewBridge = api;
  bind();
  if (doc && typeof global.setInterval === "function") {
    const retry = global.setInterval(() => { if (bind()) global.clearInterval(retry); }, 100);
    global.setTimeout?.(() => global.clearInterval(retry), 10000);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
