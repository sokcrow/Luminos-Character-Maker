(function (global) {
  "use strict";

  if (global.LuminousExistingRacialStatIntegration) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousExistingRacialStatIntegration;
    return;
  }

  const ABILITY_IDS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
  const ABILITY_KEYS = Object.freeze({ str: "fuerza", dex: "destreza", con: "constitucion", int: "inteligencia", wis: "sabiduria", cha: "carisma" });
  const ABILITY_LABELS = Object.freeze({ str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA" });
  const fixed = (values, choose) => Object.freeze({ fixed: Object.freeze(values || {}), ...(choose ? { choose: Object.freeze(choose) } : {}) });

  const RACIAL_STAT_RULES = Object.freeze({
    lizalin: Object.freeze({ base: fixed({ con: 2, wis: 1 }) }),
    kobold: Object.freeze({ base: fixed({ dex: 2, int: 1 }) }),
    kenku: Object.freeze({ base: fixed({ dex: 2, wis: 1 }) }),
    centaur: Object.freeze({ base: fixed({ str: 2, wis: 1 }) }),
    goliath: Object.freeze({ base: fixed({ str: 2, con: 1 }) }),
    lanae: Object.freeze({ base: fixed({ con: 2, wis: 1 }) }),
    goblin: Object.freeze({ base: fixed({ dex: 2, con: 1 }) }),
    fairy: Object.freeze({ base: fixed({ dex: 1, cha: 1 }) }),
    aasimar: Object.freeze({ base: fixed({ cha: 2 }), protector: fixed({ wis: 1 }), scourge: fixed({ con: 1 }), fallen: fixed({ str: 1 }) }),
    tiefling: Object.freeze({ base: fixed({ cha: 2 }, { count: 1, amount: 1, allowed: Object.freeze(["int", "dex"]) }) }),
    half_demon: Object.freeze({ base: fixed({ dex: 1, con: 1 }) }),
    warforged: Object.freeze({ base: fixed({ con: 2 }, { count: 1, amount: 1, exclude: Object.freeze(["con"]) }) }),
    felinae: Object.freeze({ base: fixed({ dex: 2 }, { count: 1, amount: 1, exclude: Object.freeze(["dex"]) }) }),
    half_dragon: Object.freeze({ base: fixed({ str: 1, cha: 1 }, { count: 1, amount: 1, exclude: Object.freeze(["str", "cha"]) }) }),
    lupae: Object.freeze({ base: fixed({ str: 2, wis: 1 }) }),
    moonfae: Object.freeze({ base: fixed({ dex: 2, cha: 1 }) }),
    yuan_ti_pureblood: Object.freeze({ base: fixed({ cha: 2 }, { count: 1, amount: 1, exclude: Object.freeze(["str"]) }) }),
  });

  const SOURCE_UNRESOLVED = Object.freeze([]);
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const integerOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const zeroBonuses = () => Object.fromEntries(ABILITY_IDS.map((id) => [id, 0]));
  let installedRules = null;
  let domBound = false;

  function choicesFrom(value) {
    const out = [];
    (Array.isArray(value) ? value : []).forEach((entry) => {
      const id = normalizeId(entry?.abilityId ?? entry?.id ?? entry);
      if (ABILITY_IDS.includes(id) && !out.includes(id)) out.push(id);
    });
    return out;
  }

  function choiceRuleFor(raceId, subtypeId) {
    const raceRule = RACIAL_STAT_RULES[normalizeId(raceId)] || null;
    if (!raceRule) return null;
    return (subtypeId ? raceRule[normalizeId(subtypeId)]?.choose : null) || raceRule.base?.choose || null;
  }

  function allowedChoiceAbilities(rule) {
    if (!rule) return [];
    const allowed = Array.isArray(rule.allowed) ? rule.allowed : ABILITY_IDS;
    const excluded = new Set(Array.isArray(rule.exclude) ? rule.exclude : []);
    return allowed.filter((id) => ABILITY_IDS.includes(id) && !excluded.has(id));
  }

  function validateChoices(input = {}) {
    const raceId = normalizeId(input.raceId || input.characterBuild?.raceId);
    const subtypeId = normalizeId(input.raceSubtypeId || input.characterBuild?.raceSubtypeId);
    const rule = choiceRuleFor(raceId, subtypeId);
    const supplied = input.racialStatChoices ?? input.characterBuild?.racialStatChoices ?? [];
    const raw = (Array.isArray(supplied) ? supplied : []).map((entry) => normalizeId(entry?.abilityId ?? entry?.id ?? entry)).filter(Boolean);
    const selected = choicesFrom(supplied);
    if (!rule) return { valid: true, errors: [], selected: [], allowed: [] };
    const allowed = allowedChoiceAbilities(rule);
    const errors = [];
    if (raw.length !== selected.length) errors.push("Las elecciones de Stats raciales deben ser diferentes y válidas.");
    if (selected.length !== Number(rule.count || 0)) errors.push(`Selecciona ${rule.count} Stats raciales diferentes.`);
    const invalid = selected.filter((id) => !allowed.includes(id));
    if (invalid.length) errors.push(`Stats raciales no permitidas: ${invalid.map((id) => ABILITY_LABELS[id]).join(", ")}.`);
    return { valid: !errors.length, errors, selected, allowed };
  }

  function resolveRacialStatBonuses(input = {}) {
    const raceId = normalizeId(input.raceId || input.characterBuild?.raceId);
    const subtypeId = normalizeId(input.raceSubtypeId || input.characterBuild?.raceSubtypeId);
    const raceRule = RACIAL_STAT_RULES[raceId];
    const result = zeroBonuses();
    if (!raceRule) return result;
    const add = (values) => Object.entries(values || {}).forEach(([id, amount]) => {
      if (ABILITY_IDS.includes(id)) result[id] += Number(amount) || 0;
    });
    add(raceRule.base?.fixed);
    if (subtypeId && raceRule[subtypeId]) add(raceRule[subtypeId].fixed);
    const choose = choiceRuleFor(raceId, subtypeId);
    if (choose) {
      const allowed = allowedChoiceAbilities(choose);
      choicesFrom(input.racialStatChoices ?? input.characterBuild?.racialStatChoices ?? [])
        .filter((id) => allowed.includes(id))
        .slice(0, choose.count)
        .forEach((id) => { result[id] += Number(choose.amount || 0); });
    }
    return result;
  }

  function resolveEffectiveStats(stats = {}, input = {}) {
    const bonuses = resolveRacialStatBonuses(input);
    return Object.fromEntries(ABILITY_IDS.map((id) => {
      const key = ABILITY_KEYS[id];
      return [key, integerOr(stats?.[key] ?? stats?.[id], 10) + bonuses[id]];
    }));
  }

  function installRules(base = global.LuminousCharacterBuildRules) {
    if (!base || !base.__canonicalRaceIntegration) return null;
    if (base.__existingRacialStatIntegration) {
      installedRules = base;
      return base;
    }

    const validateBuild = (input = {}) => {
      const validation = base.validateBuild(input);
      const raceId = normalizeId(input.raceId || validation.race?.id);
      if (!RACIAL_STAT_RULES[raceId]) return validation;
      const choice = validateChoices(input);
      const errors = [...(validation.errors || []), ...choice.errors];
      return { ...validation, complete: errors.length === 0, errors, racialStatChoices: choice.selected };
    };

    const calculateBuild = (input = {}) => {
      const result = base.calculateBuild(input);
      const raceId = normalizeId(input.raceId || result.raceId);
      if (!RACIAL_STAT_RULES[raceId]) return result;
      const validation = validateBuild(input);
      const bonuses = resolveRacialStatBonuses({
        ...input,
        raceId,
        raceSubtypeId: input.raceSubtypeId || result.raceSubtypeId,
        racialStatChoices: validation.racialStatChoices,
      });
      return {
        ...result,
        valid: validation.complete,
        errors: validation.errors.slice(),
        racialStatChoices: validation.racialStatChoices.slice(),
        racialStatBonuses: bonuses,
      };
    };

    const api = Object.freeze({
      ...base,
      __existingRacialStatIntegration: true,
      validateBuild,
      calculateBuild,
      EXISTING_RACIAL_STAT_RULES: RACIAL_STAT_RULES,
      SOURCE_UNRESOLVED_RACIAL_STAT_RACES: SOURCE_UNRESOLVED,
      resolveExistingRacialStatBonuses: resolveRacialStatBonuses,
      resolveExistingEffectiveStats: resolveEffectiveStats,
      validateExistingRacialStatChoices: validateChoices,
    });
    installedRules = api;
    global.LuminousCharacterBuildRules = api;
    return api;
  }

  const field = (id) => global.document?.getElementById(id) || null;

  function currentInput() {
    return {
      raceId: normalizeId(field("dm-player-build-race")?.value),
      raceSubtypeId: normalizeId(field("dm-player-build-subrace")?.value),
      racialStatChoices: choicesFrom([field("existing-racial-stat-choice-1")?.value, field("existing-racial-stat-choice-2")?.value]),
    };
  }

  function ensureChoiceUi() {
    const doc = global.document;
    if (!doc) return null;
    let box = field("existing-racial-stat-choices");
    if (box) return box;
    const anchor = field("dm-player-build-subrace-field") || field("dm-player-build-race")?.parentElement;
    if (!anchor?.parentElement) return null;
    box = doc.createElement("div");
    box.id = "existing-racial-stat-choices";
    box.style.cssText = "display:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px;";
    for (let index = 1; index <= 2; index += 1) {
      const select = doc.createElement("select");
      select.id = `existing-racial-stat-choice-${index}`;
      select.innerHTML = '<option value="">— Stat racial —</option>' + ABILITY_IDS.map((id) => `<option value="${id}">${ABILITY_LABELS[id]}</option>`).join("");
      select.addEventListener("change", refreshChoiceUi);
      box.appendChild(select);
    }
    anchor.insertAdjacentElement("afterend", box);
    return box;
  }

  function refreshChoiceUi() {
    const box = ensureChoiceUi();
    if (!box) return false;
    const input = currentInput();
    const rule = choiceRuleFor(input.raceId, input.raceSubtypeId);
    box.style.display = rule ? "grid" : "none";
    const allowed = new Set(allowedChoiceAbilities(rule));
    for (let index = 1; index <= 2; index += 1) {
      const select = field(`existing-racial-stat-choice-${index}`);
      if (!select) continue;
      select.style.display = rule && index <= rule.count ? "block" : "none";
      select.disabled = !rule || index > rule.count;
      Array.from(select.options || []).forEach((option) => {
        if (option.value) option.disabled = !allowed.has(option.value);
      });
      if (select.value && !allowed.has(select.value)) select.value = "";
    }
    return true;
  }

  function bindDom() {
    const doc = global.document;
    if (!doc) return false;
    ensureChoiceUi();
    refreshChoiceUi();
    if (domBound) return true;
    doc.addEventListener("change", (event) => {
      if (["dm-player-build-race", "dm-player-build-subrace"].includes(event.target?.id)) refreshChoiceUi();
    });
    domBound = true;
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
    RACIAL_STAT_RULES,
    SOURCE_UNRESOLVED,
    choicesFrom,
    choiceRuleFor,
    allowedChoiceAbilities,
    validateChoices,
    resolveRacialStatBonuses,
    resolveEffectiveStats,
    installRules,
    bindDom,
    refreshChoiceUi,
    install,
    get rules() { return installedRules; },
  });

  global.LuminousExistingRacialStatIntegration = api;
  install();
  if (global.document && typeof global.setInterval === "function") {
    const retry = global.setInterval(() => {
      const ready = Boolean(installRules());
      const uiReady = bindDom();
      if (ready && uiReady && field("dm-player-build-race")) global.clearInterval(retry);
    }, 100);
    global.setTimeout?.(() => global.clearInterval(retry), 10000);
  }

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);