(function (global) {
  "use strict";

  if (global.LuminousCanonicalRaceIntegration) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCanonicalRaceIntegration;
    return;
  }

  const ABILITY_IDS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
  const ABILITY_KEYS = Object.freeze({
    str: "fuerza",
    dex: "destreza",
    con: "constitucion",
    int: "inteligencia",
    wis: "sabiduria",
    cha: "carisma",
  });
  const PLAYERS_ROOT = "campaña/jugadores";

  const CANONICAL_RACES = Object.freeze([
    {
      id: "dwarf", name: "Enano", hpCoefBonus: 0, defMod: 0,
      tags: ["organic", "humanoid", "dwarf"],
      subtypes: [
        { id: "hill", name: "Enano de Colina", hpCoefBonus: 0, defMod: 0 },
        { id: "mountain", name: "Enano de Montaña", hpCoefBonus: 0, defMod: 0 },
        { id: "duergar", name: "Duergar", hpCoefBonus: 0, defMod: 0 },
      ],
    },
    {
      id: "elf", name: "Elfo", hpCoefBonus: 0, defMod: 0,
      tags: ["organic", "humanoid", "elf", "fae"],
      subtypes: [
        { id: "high", name: "Alto Elfo", hpCoefBonus: 0, defMod: 0 },
        { id: "wood", name: "Elfo del Bosque", hpCoefBonus: 0, defMod: 0 },
        { id: "drow", name: "Drow", hpCoefBonus: 0, defMod: 0 },
        { id: "sea", name: "Elfo Marino", hpCoefBonus: 0, defMod: 0 },
        { id: "eladrin", name: "Eladrin", hpCoefBonus: 0, defMod: 0 },
        { id: "shadar_kai", name: "Shadar-kai", hpCoefBonus: 0, defMod: 0 },
      ],
    },
    {
      id: "halfling", name: "Mediano", hpCoefBonus: 0, defMod: 0,
      tags: ["organic", "humanoid", "halfling", "small"],
      subtypes: [
        { id: "lightfoot", name: "Piesligeros", hpCoefBonus: 0, defMod: 0 },
        { id: "stout", name: "Fornido", hpCoefBonus: 0, defMod: 0 },
      ],
    },
    {
      id: "dragonborn", name: "Dracónido", hpCoefBonus: 0, defMod: 0,
      tags: ["organic", "humanoid", "draconic"],
      subtypes: [
        { id: "red", name: "Rojo", hpCoefBonus: 0, defMod: 0 },
        { id: "black", name: "Negro", hpCoefBonus: 0, defMod: 0 },
        { id: "green", name: "Verde", hpCoefBonus: 0, defMod: 0 },
        { id: "white", name: "Blanco", hpCoefBonus: 0, defMod: 0 },
        { id: "blue", name: "Azul", hpCoefBonus: 0, defMod: 0 },
        { id: "gold", name: "Oro", hpCoefBonus: 0, defMod: 0 },
        { id: "brass", name: "Latón", hpCoefBonus: 0, defMod: 0 },
        { id: "copper", name: "Cobre", hpCoefBonus: 0, defMod: 0 },
        { id: "bronze", name: "Bronce", hpCoefBonus: 0, defMod: 0 },
        { id: "silver", name: "Plata", hpCoefBonus: 0, defMod: 0 },
      ],
    },
    {
      id: "gnome", name: "Gnomo", hpCoefBonus: 0, defMod: 0,
      tags: ["organic", "humanoid", "gnome", "small"],
      subtypes: [
        { id: "forest", name: "Gnomo del Bosque", hpCoefBonus: 0, defMod: 0 },
        { id: "rock", name: "Gnomo de las Rocas", hpCoefBonus: 0, defMod: 0 },
      ],
    },
    { id: "half_elf", name: "Semielfo", hpCoefBonus: 0, defMod: 0, tags: ["organic", "humanoid", "elf", "human"] },
    { id: "half_orc", name: "Semiorco", hpCoefBonus: 0, defMod: 0, tags: ["organic", "humanoid", "orc", "human"] },
    { id: "orc", name: "Orco", hpCoefBonus: 0, defMod: 0, tags: ["organic", "humanoid", "orc"] },
  ]);

  const HUMAN_VARIANT = Object.freeze({ id: "variant", name: "Humano Variante", hpCoefBonus: 0, defMod: 0 });

  const RACIAL_STAT_RULES = Object.freeze({
    human: Object.freeze({
      base: Object.freeze({ fixed: Object.freeze({ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }) }),
      variant: Object.freeze({ fixed: Object.freeze({}), choose: Object.freeze({ count: 2, amount: 1 }), replaceBase: true }),
    }),
    dwarf: Object.freeze({
      base: Object.freeze({ fixed: Object.freeze({ con: 2 }) }),
      hill: Object.freeze({ fixed: Object.freeze({ wis: 1 }) }),
      mountain: Object.freeze({ fixed: Object.freeze({ str: 2 }) }),
      duergar: Object.freeze({ fixed: Object.freeze({ str: 1 }) }),
    }),
    elf: Object.freeze({
      base: Object.freeze({ fixed: Object.freeze({ dex: 2 }) }),
      high: Object.freeze({ fixed: Object.freeze({ int: 1 }) }),
      wood: Object.freeze({ fixed: Object.freeze({ wis: 1 }) }),
      drow: Object.freeze({ fixed: Object.freeze({ cha: 1 }) }),
      sea: Object.freeze({ fixed: Object.freeze({ con: 1 }) }),
      eladrin: Object.freeze({ fixed: Object.freeze({ cha: 1 }) }),
      shadar_kai: Object.freeze({ fixed: Object.freeze({ con: 1 }) }),
    }),
    halfling: Object.freeze({
      base: Object.freeze({ fixed: Object.freeze({ dex: 2 }) }),
      lightfoot: Object.freeze({ fixed: Object.freeze({ cha: 1 }) }),
      stout: Object.freeze({ fixed: Object.freeze({ con: 1 }) }),
    }),
    dragonborn: Object.freeze({ base: Object.freeze({ fixed: Object.freeze({ str: 2, cha: 1 }) }) }),
    gnome: Object.freeze({
      base: Object.freeze({ fixed: Object.freeze({ int: 2 }) }),
      forest: Object.freeze({ fixed: Object.freeze({ dex: 1 }) }),
      rock: Object.freeze({ fixed: Object.freeze({ con: 1 }) }),
    }),
    half_elf: Object.freeze({ base: Object.freeze({ fixed: Object.freeze({ cha: 2 }), choose: Object.freeze({ count: 2, amount: 1 }) }) }),
    half_orc: Object.freeze({ base: Object.freeze({ fixed: Object.freeze({ str: 2, con: 1 }) }) }),
    orc: Object.freeze({ base: Object.freeze({ fixed: Object.freeze({ str: 2, con: 1 }) }) }),
  });

  let installedRules = null;
  let baseRules = null;
  let domBound = false;
  const domState = { playerId: null, baseStats: null, bonuses: Object.fromEntries(ABILITY_IDS.map((id) => [id, 0])) };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;

  function loadBaseRules() {
    if (global.LuminousCharacterBuildRules?.__canonicalRaceIntegration) return global.LuminousCharacterBuildRules;
    if (global.LuminousCharacterBuildRules) return global.LuminousCharacterBuildRules;
    if (baseRules) return baseRules;
    if (typeof require === "function") {
      try { baseRules = require("./character-build-rules.js"); } catch (_) {}
    }
    return baseRules;
  }

  function choicesFrom(value) {
    const raw = Array.isArray(value) ? value : [];
    const out = [];
    raw.forEach((entry) => {
      const id = normalizeId(entry?.abilityId ?? entry?.id ?? entry);
      if (ABILITY_IDS.includes(id) && !out.includes(id)) out.push(id);
    });
    return out;
  }

  function domChoices() {
    const doc = global.document;
    if (!doc) return [];
    return choicesFrom([
      doc.getElementById("canonical-racial-stat-choice-1")?.value,
      doc.getElementById("canonical-racial-stat-choice-2")?.value,
    ]);
  }

  function choiceRuleFor(raceId, subtypeId) {
    const raceRule = RACIAL_STAT_RULES[normalizeId(raceId)] || null;
    if (!raceRule) return null;
    const subtypeRule = subtypeId ? raceRule[normalizeId(subtypeId)] : null;
    return subtypeRule?.choose || raceRule.base?.choose || null;
  }

  function resolveRacialStatBonuses(input = {}) {
    const raceId = normalizeId(input.raceId || input.characterBuild?.raceId || "human") || "human";
    const subtypeId = normalizeId(input.raceSubtypeId || input.characterBuild?.raceSubtypeId || "");
    const raceRule = RACIAL_STAT_RULES[raceId];
    const result = Object.fromEntries(ABILITY_IDS.map((id) => [id, 0]));
    if (!raceRule) return result;

    const addFixed = (fixed) => {
      Object.entries(fixed || {}).forEach(([id, amount]) => {
        if (ABILITY_IDS.includes(id)) result[id] += Number(amount) || 0;
      });
    };
    const subtypeRule = subtypeId ? raceRule[subtypeId] : null;
    if (!subtypeRule?.replaceBase) addFixed(raceRule.base?.fixed);
    if (subtypeRule) addFixed(subtypeRule.fixed);

    const choose = choiceRuleFor(raceId, subtypeId);
    const explicitChoices = input.racialStatChoices ?? input.characterBuild?.racialStatChoices;
    const selected = choicesFrom(explicitChoices == null ? domChoices() : explicitChoices);
    if (choose) selected.slice(0, choose.count).forEach((id) => { result[id] += choose.amount; });
    return result;
  }

  function resolveEffectiveStats(stats = {}, input = {}) {
    const bonuses = resolveRacialStatBonuses(input);
    const effective = {};
    ABILITY_IDS.forEach((id) => {
      const key = ABILITY_KEYS[id];
      const base = integerOr(stats?.[key] ?? stats?.[id], 10);
      effective[key] = base + bonuses[id];
    });
    return effective;
  }

  function installRules(base = loadBaseRules()) {
    if (!base) return null;
    if (base.__canonicalRaceIntegration) {
      installedRules = base;
      return base;
    }
    baseRules = base;

    const human = base.RACES.find((race) => race.id === "human") || { id: "human", name: "Humano", hpCoefBonus: 0, defMod: 0, tags: ["organic", "humanoid", "human"] };
    const humanExtended = Object.freeze({ ...human, subtypes: Object.freeze([HUMAN_VARIANT]) });
    const races = Object.freeze([...base.RACES.filter((race) => race.id !== "human")]);
    const orderedRaces = Object.freeze([
      humanExtended,
      ...races,
      ...CANONICAL_RACES.filter((race) => !base.RACES.some((existing) => existing.id === race.id)),
    ]);
    const raceMap = new Map(orderedRaces.map((race) => [race.id, race]));

    const raceSubtype = (race, subtypeId) => {
      if (!race || !subtypeId || !Array.isArray(race.subtypes)) return null;
      return race.subtypes.find((entry) => entry.id === subtypeId) || null;
    };

    function validateBuild(input = {}) {
      const raceId = normalizeId(input.raceId || base.SETTINGS.defaultRaceId || "human") || "human";
      const race = raceMap.get(raceId) || null;
      const subtypeId = normalizeId(input.raceSubtypeId || "");
      const subtype = raceSubtype(race, subtypeId);
      const baseHasRace = base.RACES.some((entry) => entry.id === raceId);
      const surrogate = base.validateBuild({
        ...input,
        raceId: baseHasRace ? raceId : "human",
        raceSubtypeId: raceId === "human" ? null : (baseHasRace ? input.raceSubtypeId : null),
      });
      const errors = surrogate.errors.filter((message) => message !== "Selecciona una raza." && message !== "Selecciona la subraza / variante racial.");
      if (!race) errors.push("Selecciona una raza.");
      const requiresSubtype = Boolean(race?.subtypes?.length && raceId !== "human");
      if (requiresSubtype && !subtype) errors.push("Selecciona la subraza / variante racial.");

      const choose = choiceRuleFor(raceId, subtypeId);
      const explicitChoices = input.racialStatChoices ?? input.characterBuild?.racialStatChoices;
      const selectedChoices = choicesFrom(explicitChoices == null ? domChoices() : explicitChoices);
      if (choose && selectedChoices.length !== choose.count) errors.push(`Selecciona ${choose.count} Stats raciales diferentes.`);

      return {
        ...surrogate,
        complete: errors.length === 0,
        errors,
        race,
        subtype,
        racialStatChoices: selectedChoices,
      };
    }

    function calculateBuild(input = {}) {
      const validation = validateBuild(input);
      const raceId = validation.race?.id || null;
      const subtypeId = validation.subtype?.id || null;
      const isBaseRace = Boolean(raceId && base.RACES.some((entry) => entry.id === raceId) && raceId !== "human");
      const baseCalculation = base.calculateBuild({
        ...input,
        raceId: isBaseRace ? raceId : "human",
        raceSubtypeId: isBaseRace ? subtypeId : null,
      });
      return {
        ...baseCalculation,
        valid: validation.complete,
        errors: validation.errors.slice(),
        raceId,
        raceSubtypeId: subtypeId,
        racialStatChoices: validation.racialStatChoices.slice(),
        racialStatBonuses: resolveRacialStatBonuses({ raceId, raceSubtypeId: subtypeId, racialStatChoices: validation.racialStatChoices }),
      };
    }

    const api = Object.freeze({
      ...base,
      __canonicalRaceIntegration: true,
      RACES: orderedRaces,
      CANONICAL_RACES,
      RACIAL_STAT_RULES,
      ABILITY_IDS,
      ABILITY_KEYS,
      validateBuild,
      calculateBuild,
      getRace: (id) => raceMap.get(normalizeId(id || base.SETTINGS.defaultRaceId || "human")) || null,
      resolveRacialStatBonuses,
      resolveEffectiveStats,
    });
    installedRules = api;
    global.LuminousCharacterBuildRules = api;
    return api;
  }

  function field(id) { return global.document?.getElementById(id) || null; }

  function currentRaceInput() {
    const rules = installedRules || installRules();
    return {
      raceId: normalizeId(field("dm-player-build-race")?.value || rules?.SETTINGS?.defaultRaceId || "human") || "human",
      raceSubtypeId: normalizeId(field("dm-player-build-subrace")?.value || ""),
      racialStatChoices: domChoices(),
    };
  }

  function ensureRaceOptions() {
    const rules = installedRules || installRules();
    const select = field("dm-player-build-race");
    if (!rules || !select) return false;
    const existing = new Set(Array.from(select.options || []).map((option) => option.value));
    rules.RACES.forEach((race) => {
      if (existing.has(race.id)) return;
      const option = global.document.createElement("option");
      option.value = race.id;
      option.textContent = race.name;
      select.appendChild(option);
    });
    return true;
  }

  function ensureChoiceUi() {
    const doc = global.document;
    if (!doc) return null;
    let box = field("canonical-racial-stat-choices");
    if (box) return box;
    const anchor = field("dm-player-build-subrace-field") || field("dm-player-build-race")?.parentElement;
    if (!anchor?.parentElement) return null;
    box = doc.createElement("div");
    box.id = "canonical-racial-stat-choices";
    box.className = "dm-player-build-field";
    box.hidden = true;
    const options = ABILITY_IDS.map((id) => `<option value="${id}">${id.toUpperCase()}</option>`).join("");
    box.innerHTML = `<label>RACIAL STAT CHOICES</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><select id="canonical-racial-stat-choice-1"><option value="">— Stat 1 —</option>${options}</select><select id="canonical-racial-stat-choice-2"><option value="">— Stat 2 —</option>${options}</select></div><small id="canonical-racial-stat-choice-copy" style="opacity:.7"></small>`;
    anchor.insertAdjacentElement("afterend", box);
    return box;
  }

  function renderChoiceUi(savedChoices) {
    const box = ensureChoiceUi();
    if (!box) return;
    const current = currentRaceInput();
    const choose = choiceRuleFor(current.raceId, current.raceSubtypeId);
    box.hidden = !choose;
    const one = field("canonical-racial-stat-choice-1");
    const two = field("canonical-racial-stat-choice-2");
    const copy = field("canonical-racial-stat-choice-copy");
    if (copy) copy.textContent = choose ? `Choose ${choose.count} different Stats · +${choose.amount} each` : "";
    if (Array.isArray(savedChoices)) {
      const selected = choicesFrom(savedChoices);
      if (one) one.value = selected[0] || "";
      if (two) two.value = selected[1] || "";
    }
  }

  function racialBonusesForForm() {
    const rules = installedRules || installRules();
    return rules?.resolveRacialStatBonuses(currentRaceInput()) || Object.fromEntries(ABILITY_IDS.map((id) => [id, 0]));
  }

  function decorateBonuses() {
    const bonuses = racialBonusesForForm();
    domState.bonuses = bonuses;
    ABILITY_IDS.forEach((id) => {
      const input = field(`dm-player-stat-${id}`);
      if (!input?.parentElement) return;
      let badge = input.parentElement.querySelector(`[data-canonical-racial-bonus="${id}"]`);
      if (!badge) {
        badge = global.document.createElement("small");
        badge.dataset.canonicalRacialBonus = id;
        badge.style.cssText = "display:block;opacity:.72;margin-top:2px";
        input.insertAdjacentElement("afterend", badge);
      }
      badge.textContent = bonuses[id] ? `RACE +${bonuses[id]} · FINAL ${integerOr(input.value, 10) + bonuses[id]}` : "";
    });
  }

  function captureBaseStatsFromForm() {
    const out = {};
    ABILITY_IDS.forEach((id) => { out[ABILITY_KEYS[id]] = integerOr(field(`dm-player-stat-${id}`)?.value, 10); });
    domState.baseStats = out;
    return out;
  }

  function applyEffectiveStatsToForm(baseStats) {
    const effective = (installedRules || installRules())?.resolveEffectiveStats(baseStats, currentRaceInput()) || baseStats;
    ABILITY_IDS.forEach((id) => {
      const input = field(`dm-player-stat-${id}`);
      if (input) input.value = String(integerOr(effective[ABILITY_KEYS[id]], 10));
    });
    return effective;
  }

  function restoreBaseStatsToForm(baseStats) {
    ABILITY_IDS.forEach((id) => {
      const input = field(`dm-player-stat-${id}`);
      if (input) input.value = String(integerOr(baseStats?.[ABILITY_KEYS[id]], 10));
    });
    decorateBonuses();
  }

  async function syncSelectedPlayer() {
    const playerId = String(field("dm-player-dnd-select")?.value || "").trim();
    domState.playerId = playerId || null;
    if (!playerId) return;
    const db = global.firebase?.database?.();
    if (!db) {
      captureBaseStatsFromForm();
      decorateBonuses();
      return;
    }
    try {
      const snap = await db.ref(`${PLAYERS_ROOT}/${playerId}`).once("value");
      const player = snap.val() || {};
      const savedChoices = player?.characterBuild?.racialStatChoices;
      renderChoiceUi(savedChoices);
      const bonuses = (installedRules || installRules())?.resolveRacialStatBonuses({
        raceId: player?.characterBuild?.raceId || field("dm-player-build-race")?.value || "human",
        raceSubtypeId: player?.characterBuild?.raceSubtypeId || field("dm-player-build-subrace")?.value || "",
        racialStatChoices: savedChoices || domChoices(),
      }) || Object.fromEntries(ABILITY_IDS.map((id) => [id, 0]));
      const base = {};
      ABILITY_IDS.forEach((id) => {
        const key = ABILITY_KEYS[id];
        const storedBase = Number.parseInt(player?.baseStats?.[key], 10);
        const storedEffective = Number.parseInt(player?.stats?.[key], 10);
        const hasRacialLayer = Boolean(player?.baseStats || player?.characterBuild?.breakdown?.racialStatBonuses);
        base[key] = Number.isFinite(storedBase)
          ? storedBase
          : Number.isFinite(storedEffective) ? storedEffective - (hasRacialLayer ? (bonuses[id] || 0) : 0) : integerOr(field(`dm-player-stat-${id}`)?.value, 10);
        const input = field(`dm-player-stat-${id}`);
        if (input) input.value = String(base[key]);
      });
      domState.baseStats = base;
      decorateBonuses();
    } catch (_) {
      captureBaseStatsFromForm();
      decorateBonuses();
    }
  }

  function persistBaseLayer(baseStats) {
    const playerId = String(field("dm-player-dnd-select")?.value || domState.playerId || "").trim();
    const db = global.firebase?.database?.();
    if (!playerId || !db) return Promise.resolve(false);
    const choices = domChoices();
    const updates = {};
    ABILITY_IDS.forEach((id) => { updates[`baseStats/${ABILITY_KEYS[id]}`] = integerOr(baseStats?.[ABILITY_KEYS[id]], 10); });
    updates["characterBuild/racialStatChoices"] = choices.length ? choices : null;
    const bonuses = racialBonusesForForm();
    updates["characterBuild/breakdown/racialStatBonuses"] = bonuses;
    return db.ref(`${PLAYERS_ROOT}/${playerId}`).update(updates).then(() => true);
  }

  function bindDom() {
    const doc = global.document;
    if (!doc || domBound) return false;
    ensureRaceOptions();
    ensureChoiceUi();
    renderChoiceUi();
    decorateBonuses();

    doc.addEventListener("change", (event) => {
      const target = event.target;
      if (!target) return;
      if (target.id === "dm-player-dnd-select") {
        global.setTimeout(syncSelectedPlayer, 0);
        return;
      }
      if (target.id === "dm-player-build-race" || target.id === "dm-player-build-subrace") {
        global.setTimeout(() => {
          ensureRaceOptions();
          renderChoiceUi();
          decorateBonuses();
        }, 0);
        return;
      }
      if (target.id === "canonical-racial-stat-choice-1" || target.id === "canonical-racial-stat-choice-2") decorateBonuses();
    }, true);

    doc.addEventListener("input", (event) => {
      if (ABILITY_IDS.some((id) => event.target?.id === `dm-player-stat-${id}`)) decorateBonuses();
    }, true);

    doc.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#dm-player-dnd-save");
      if (!button) return;
      const base = captureBaseStatsFromForm();
      applyEffectiveStatsToForm(base);
      persistBaseLayer(base).catch((error) => console.error("No se pudo persistir la capa base de Stats raciales:", error));
      queueMicrotask(() => restoreBaseStatsToForm(base));
    }, true);

    domBound = true;
    global.setTimeout(() => {
      ensureRaceOptions();
      renderChoiceUi();
      if (field("dm-player-dnd-select")?.value) syncSelectedPlayer();
      else decorateBonuses();
    }, 0);
    return true;
  }

  function install() {
    const rules = installRules();
    if (global.document) bindDom();
    return rules;
  }

  const api = Object.freeze({
    ABILITY_IDS,
    ABILITY_KEYS,
    CANONICAL_RACES,
    RACIAL_STAT_RULES,
    installRules,
    install,
    resolveRacialStatBonuses,
    resolveEffectiveStats,
    choicesFrom,
    choiceRuleFor,
  });

  global.LuminousCanonicalRaceIntegration = api;
  install();
  if (global.document && typeof global.setInterval === "function") {
    const retry = global.setInterval(() => {
      if (installRules()) {
        bindDom();
        if (ensureRaceOptions() && field("dm-player-build-race")) global.clearInterval(retry);
      }
    }, 100);
    global.setTimeout(() => global.clearInterval(retry), 10000);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);