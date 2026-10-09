(function (global) {
  "use strict";

  let engine = global.LuminousTraitEngine || (typeof require !== "undefined" ? require("./trait-engine.js") : null);
  if (!engine) return;

  function preserveGrantMetadata(engineApi) {
    if (!engineApi?.resolveTraitGrants || engineApi.__grantMetadataPreserved) return engineApi;
    const originalResolveTraitGrants = engineApi.resolveTraitGrants.bind(engineApi);
    return Object.freeze({
      ...engineApi,
      __grantMetadataPreserved: true,
      resolveTraitGrants(character = {}, grants = [], catalog = {}) {
        const grantList = Array.isArray(grants) ? grants : Object.values(grants || {});
        return originalResolveTraitGrants(character, grants, catalog).map((trait) => {
          const traitId = normalizeId(trait?.id || trait?.name);
          const source = trait?.source || {};
          const sourceType = normalizeId(source.type || trait?.sourceType);
          const sourceId = normalizeId(source.id || source.classId || trait?.sourceId);
          const grant = grantList.find((entry) => {
            const grantTraitId = normalizeId(entry?.traitId || entry?.id);
            const grantSourceType = normalizeId(entry?.sourceType || entry?.source?.type);
            const grantSourceId = normalizeId(entry?.sourceId || entry?.source?.id || entry?.source?.classId);
            return grantTraitId === traitId && grantSourceType === sourceType && grantSourceId === sourceId;
          });
          const atLevel = Number(grant?.atLevel ?? grant?.level);
          if (!Number.isFinite(atLevel) || atLevel <= 0) return trait;

          const next = {
            ...trait,
            source: {
              ...source,
              atLevel,
            },
          };
          if (sourceType === "class") next.source.requiredClassLevel = atLevel;
          else next.source.requiredLevel = atLevel;
          return next;
        });
      },
    });
  }

  engine = preserveGrantMetadata(engine);
  global.LuminousTraitEngine = engine;

  const CATEGORY_ORDER = Object.freeze(["all", "racial", "class", "archetype", "background", "general", "other"]);
  const CATEGORY_LABELS = Object.freeze({
    all: "All",
    racial: "Racial",
    class: "Class",
    archetype: "Archetype",
    background: "Background",
    general: "General",
    other: "Other",
  });
  const FORMULA_FUNCTIONS = new Set(["floor", "ceil", "round", "abs", "min", "max", "clamp"]);
  const VARIABLE_LABELS = Object.freeze({
    Level: "Level",
    ClassLevel: "Class Level",
    Proficiency: "Proficiency",
    StrengthMod: "STR Mod",
    DexterityMod: "DEX Mod",
    ConstitutionMod: "CON Mod",
    IntelligenceMod: "INT Mod",
    WisdomMod: "WIS Mod",
    CharismaMod: "CHA Mod",
    OffensiveLevel: "Offensive Level",
    DefensiveLevel: "Defensive Level",
    MinSpeed: "Min Speed",
    MaxSpeed: "Max Speed",
    MaxHP: "Max HP",
    CurrentHP: "Current HP",
    MaxSP: "Max SP",
    CurrentSP: "Current SP",
  });
  const BUILTIN_DISPLAY_METADATA = Object.freeze({
    lizalin_hungry_jaws: {
      playerDescription: "When Bite deals damage, gain Shield equal to {shieldRate} of that Bite damage.",
      resolvedValues: [{ id: "shieldRate", label: "Shield from Bite Damage", formula: "ConstitutionMod + Level / 4", unit: "percent" }],
    },
    goliath_stone_endurance: {
      playerDescription: "When damage is taken, reduce incoming damage by {damageReduction}.",
      resolvedValues: [{ id: "damageReduction", label: "Damage Reduction", formula: "max(0, ConstitutionMod)", unit: "flat" }],
    },
    goblin_fury_of_small: {
      playerDescription: "Once per Turn when damaging a larger Unit, add {fixedDamage} Fixed Damage.",
      resolvedValues: [{ id: "fixedDamage", label: "Fixed Damage", formula: "max(1, ConstitutionMod)", unit: "flat", signed: true }],
    },
    aasimar_healing_hands: {
      playerDescription: "Heal {healing}. Uses equal Proficiency; Long Rest.",
      resolvedValues: [{ id: "healing", label: "Healing", formula: "max(0, floor(Level / 2) + ConstitutionMod)", unit: "hp" }],
    },
    yuan_ti_wrath_affinity: {
      playerDescription: "Deal {sinBonus} Wrath Sin Damage.",
      resolvedValues: [{ id: "sinBonus", label: "Wrath Sin Damage", formula: "Level / 4", unit: "percent", signed: true }],
    },
    yuan_ti_envy_affinity: {
      playerDescription: "Deal {sinBonus} Envy Sin Damage.",
      resolvedValues: [{ id: "sinBonus", label: "Envy Sin Damage", formula: "Level / 4", unit: "percent", signed: true }],
    },
    yuan_ti_gloom_affinity: {
      playerDescription: "Deal {sinBonus} Gloom Sin Damage.",
      resolvedValues: [{ id: "sinBonus", label: "Gloom Sin Damage", formula: "Level / 4", unit: "percent", signed: true }],
    },
    yuan_ti_pride_affinity: {
      playerDescription: "Deal {sinBonus} Pride Sin Damage.",
      resolvedValues: [{ id: "sinBonus", label: "Pride Sin Damage", formula: "Level / 4", unit: "percent", signed: true }],
    },
    yuan_ti_gluttony_affinity: {
      playerDescription: "Deal {sinBonus} Gluttony Sin Damage.",
      resolvedValues: [{ id: "sinBonus", label: "Gluttony Sin Damage", formula: "Level / 4", unit: "percent", signed: true }],
    },
    yuan_ti_lust_affinity: {
      playerDescription: "Deal {sinBonus} Lust Sin Damage.",
      resolvedValues: [{ id: "sinBonus", label: "Lust Sin Damage", formula: "Level / 4", unit: "percent", signed: true }],
    },
    yuan_ti_sloth_affinity: {
      playerDescription: "Deal {sinBonus} Sloth Sin Damage.",
      resolvedValues: [{ id: "sinBonus", label: "Sloth Sin Damage", formula: "Level / 4", unit: "percent", signed: true }],
    },
  });
  let tooltipSequence = 0;

  function resolveHost(host) {
    if (!host) return null;
    if (typeof host === "string") return global.document?.querySelector(host) || null;
    return host;
  }

  function createElement(tag, className, text) {
    const node = global.document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  }

  function ensureStatusStore(unit) {
    if (!unit || typeof unit !== "object") return null;
    if (!unit.statusEffects || Array.isArray(unit.statusEffects) || typeof unit.statusEffects !== "object") unit.statusEffects = {};
    return unit.statusEffects;
  }

  function applyOutcomeStatus(unit, outcome) {
    if (!unit || !outcome || typeof outcome !== "object") return;
    const statusEngine = global.LuminousStatusEngine;
    const statusId = normalizeId(outcome.statusId || outcome.status?.id);
    if (!statusId) return;
    const type = normalizeId(outcome.type);
    const action = normalizeId(outcome.action || "");

    if (["apply_status", "rule_status"].includes(type) && ["", "gain", "apply", "inflict"].includes(action)) {
      if (statusEngine?.applyStatus) statusEngine.applyStatus(unit, statusId, { ...(outcome.status || {}), mode: "set" });
      else {
        const store = ensureStatusStore(unit);
        if (store) store[statusId] = { id: statusId, count: 1, potency: 0, ...(outcome.status || {}) };
      }
      return;
    }

    if (["remove_status", "rule_status"].includes(type) && (action || "remove") === "remove" && outcome.protected !== true && outcome.removed !== false) {
      if (statusEngine?.removeStatus) statusEngine.removeStatus(unit, statusId, { from: "self", ignoreProtection: true });
      else {
        const store = ensureStatusStore(unit);
        if (store) delete store[statusId];
      }
    }
  }

  function syncActivationStatuses(result, runtime = {}) {
    if (!result || typeof result !== "object") return result;
    const resolvedRuntime = result.runtime || runtime || {};
    const self = runtime.self || runtime.character || resolvedRuntime.self || resolvedRuntime.character || null;
    const target = runtime.target || runtime.defender || resolvedRuntime.target || resolvedRuntime.defender || null;
    const visit = (outcome) => {
      if (!outcome || typeof outcome !== "object") return;
      const unit = normalizeId(outcome.target) === "target" ? target : self;
      applyOutcomeStatus(unit, outcome);
      (outcome.outcomes || []).forEach(visit);
    };
    (result.outcomes || []).forEach(visit);
    return result;
  }

  function titleCaseId(value) {
    return String(value ?? "")
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function sourceCategory(trait = {}) {
    const source = trait?.source || {};
    const sourceType = normalizeId(source.type);
    const legacySourceType = normalizeId(trait.sourceType);
    const categoryType = normalizeId(trait.category || trait.traitCategory);
    const type = sourceType && sourceType !== "special"
      ? sourceType
      : legacySourceType && legacySourceType !== "special"
        ? legacySourceType
        : categoryType || sourceType || legacySourceType;
    if (["race", "racial", "subrace", "lineage", "ancestry"].includes(type)) return "racial";
    if (["class"].includes(type)) return "class";
    if (["archetype", "subclass", "class_archetype"].includes(type)) return "archetype";
    if (["background", "origin"].includes(type)) return "background";
    if (["general", "general_trait", "feat"].includes(type)) return "general";
    return "other";
  }

  function sourceMeta(trait = {}) {
    const source = trait?.source || {};
    const category = sourceCategory(trait);
    let rawName = "";
    let parentName = "";

    if (category === "racial") {
      rawName = source.raceName || source.subraceName || source.lineageName || source.name || source.raceId || source.subraceId || source.lineageId || source.id;
    } else if (category === "class") {
      rawName = source.className || source.name || source.classId || source.id;
    } else if (category === "archetype") {
      rawName = source.archetypeName || source.subclassName || source.name || source.archetypeId || source.subclassId || source.id;
      parentName = source.className || source.parentClassName || source.classId || source.parentClass || source.parentClassId || "";
    } else if (category === "background") {
      rawName = source.backgroundName || source.name || source.backgroundId || source.id;
    } else if (category === "general") {
      rawName = source.name || source.id;
    } else {
      rawName = source.name || source.id || trait.sourceName || "";
    }

    const sourceName = titleCaseId(rawName);
    const parent = titleCaseId(parentName);
    const level = [
      source.requiredLevel,
      source.requiredClassLevel,
      source.unlockLevel,
      source.milestoneLevel,
      source.atLevel,
      trait.requiredLevel,
      trait.requiredClassLevel,
      trait.atLevel,
    ].map((value) => Number(value)).find((value) => Number.isFinite(value) && value > 0) || null;

    let detail = normalizeId(source.kind) === "maneuver" ? "MANEUVER" : CATEGORY_LABELS[category].toUpperCase();
    if (sourceName) detail += ` • ${sourceName.toUpperCase()}`;
    if (category === "archetype" && parent) detail += ` · ${parent.toUpperCase()}`;
    if (level != null) detail += ` LV.${level}`;

    return { category, label: CATEGORY_LABELS[category], sourceName, parentName: parent, level, detail };
  }

  function useLabel(action) {
    if (action.maximum == null) return "";
    return `${action.remaining}/${action.maximum}`;
  }

  function reasonLabel(action) {
    return (action.reasons || []).join(" ") || "Unavailable";
  }

  function activationLabel(trait = {}) {
    const type = normalizeId(trait?.activation?.type || "passive");
    if (type === "automatic") return "AUTO";
    if (type === "manual") return "MANUAL";
    if (type === "choice") return "CHOICE";
    if (type === "prompt") return "PROMPT";
    return "PASSIVE";
  }

  function contextLabels(trait = {}) {
    const contexts = Array.isArray(trait.contexts) ? trait.contexts : trait.contexts ? [trait.contexts] : [];
    return [...new Set(contexts.map(normalizeId).filter(Boolean))]
      .filter((context) => context !== "any")
      .map((context) => context === "theatre" ? "THEATRE" : context === "combat" ? "COMBAT" : context.toUpperCase());
  }

  function filterTraits(traits = [], filter = "all") {
    const normalizedFilter = CATEGORY_ORDER.includes(normalizeId(filter)) ? normalizeId(filter) : "all";
    const list = Array.isArray(traits) ? traits : [];
    if (normalizedFilter === "all") return list;
    return list.filter((trait) => sourceCategory(trait) === normalizedFilter);
  }

  function formulaIdentifiers(formula) {
    const matches = String(formula || "").match(/[A-Za-z_][A-Za-z0-9_.]*/g) || [];
    return [...new Set(matches.filter((identifier) => !FORMULA_FUNCTIONS.has(identifier.toLowerCase())))];
  }

  function variableEntry(variables = {}, identifier) {
    const key = Object.keys(variables).find((candidate) => candidate.toLowerCase() === String(identifier).toLowerCase());
    return key ? { key, value: variables[key] } : null;
  }

  function formatNumber(value, precision) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    const digits = Number.isInteger(Number(precision)) && Number(precision) >= 0
      ? Math.min(6, Number(precision))
      : Number.isInteger(number) ? 0 : 2;
    const rounded = Number(number.toFixed(digits));
    return Object.is(rounded, -0) ? "0" : String(rounded);
  }

  function formatResolvedTraitValue(value, spec = {}) {
    const base = formatNumber(value, spec.precision);
    if (base == null) return "";
    const number = Number(base);
    const signed = spec.signed && number > 0 ? `+${base}` : base;
    const unit = normalizeId(spec.unit || "flat");
    const suffix = unit === "percent" ? "%" : unit === "hp" ? " HP" : unit === "sp" ? " SP" : "";
    return `${spec.prefix || ""}${signed}${suffix}${spec.suffix || ""}`;
  }

  function formatBreakdownValue(identifier, value) {
    const base = formatNumber(value);
    if (base == null) return "?";
    const number = Number(base);
    if (/Mod$/i.test(identifier) && number > 0) return `+${base}`;
    return base;
  }

  function traitFormulaBreakdown(spec = {}, variables = {}) {
    return formulaIdentifiers(spec.formula).map((identifier) => {
      const entry = variableEntry(variables, identifier);
      if (!entry) return null;
      return {
        identifier,
        label: VARIABLE_LABELS[entry.key] || VARIABLE_LABELS[identifier] || formulaHumanLabel(identifier),
        value: Number(entry.value),
        display: formatBreakdownValue(identifier, entry.value),
      };
    }).filter(Boolean);
  }


  const FORMULA_DYNAMIC_VARIABLES = new Set([
    "skillcoincount", "skillweight", "skillrange", "spellslotlevel",
    "targetlevel", "targetmaxhp", "targetcurrenthp", "targetoffensivelevel", "targetdefensivelevel",
    "aliveallies", "aliveenemies", "turnnumber", "roundnumber",
  ]);

  function escapeFormulaRegExp(value) {
    return String(value || "").replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  }

  function sourceClassIdForFormula(trait = {}) {
    const source = trait.source || {};
    const type = normalizeId(source.type || trait.sourceType);
    if (type === "class") return normalizeId(source.classId || source.id || trait.sourceId);
    if (type === "archetype") return normalizeId(source.classId || source.parentClassId || source.parentClass || trait.classId || trait.parentClassId);
    return normalizeId(source.classId || trait.classId || "");
  }

  function sourceClassNameForFormula(trait = {}) {
    const source = trait.source || {};
    return titleCaseId(source.className || source.parentClassName || source.parentClass || sourceClassIdForFormula(trait));
  }

  function normalizeDisplayFormula(formula, trait = {}) {
    let result = String(formula == null ? "" : formula).trim();
    [
      ["StrengthModifier", "StrengthMod"],
      ["DexterityModifier", "DexterityMod"],
      ["ConstitutionModifier", "ConstitutionMod"],
      ["IntelligenceModifier", "IntelligenceMod"],
      ["WisdomModifier", "WisdomMod"],
      ["CharismaModifier", "CharismaMod"],
    ].forEach((entry) => {
      result = result.replace(new RegExp("\\b" + entry[0] + "\\b", "gi"), entry[1]);
    });
    const classNames = [sourceClassNameForFormula(trait), sourceClassIdForFormula(trait)]
      .filter(Boolean)
      .map((value) => String(value).replace(/[^A-Za-z0-9]/g, ""));
    classNames.forEach((name) => {
      result = result.replace(new RegExp("\\b" + escapeFormulaRegExp(name) + "Level\\b", "gi"), "ClassLevel");
    });
    return result;
  }

  function formulaRuntimeForTrait(trait = {}, runtime = {}) {
    const classId = sourceClassIdForFormula(trait);
    if (!classId || runtime.sourceClassId) return runtime;
    return Object.assign({}, runtime, { sourceClassId: classId });
  }

  function formulaVariableReady(identifier, runtime = {}) {
    const id = String(identifier || "").toLowerCase();
    if (!FORMULA_DYNAMIC_VARIABLES.has(id)) return true;
    const custom = runtime.variables || {};
    if (Object.keys(custom).some((key) => key.toLowerCase() === id)) return true;
    const skill = runtime.skill || {};
    const target = runtime.target || runtime.defender || null;
    const has = (key) => Object.prototype.hasOwnProperty.call(runtime, key);
    if (id === "skillcoincount") return has("SkillCoinCount") || has("skillCoinCount") || skill.coinCount != null || skill.coinAmount != null || Array.isArray(skill.coins);
    if (id === "skillweight") return has("SkillWeight") || has("skillWeight") || skill.weight != null || skill.attackWeight != null;
    if (id === "skillrange") return has("SkillRange") || has("skillRange") || skill.skillRange != null;
    if (id === "spellslotlevel") return has("SpellSlotLevel") || has("spellSlotLevel") || skill.spellSlotLevel != null;
    if (id.indexOf("target") === 0) return Boolean(target) || has(identifier);
    if (id === "aliveallies") return has("AliveAllies") || has("aliveAllies");
    if (id === "aliveenemies") return has("AliveEnemies") || has("aliveEnemies");
    if (id === "turnnumber") return has("TurnNumber") || has("turnNumber");
    if (id === "roundnumber") return has("RoundNumber") || has("roundNumber");
    return false;
  }

  function formulaVariablePattern(identifier, trait = {}) {
    const key = String(identifier || "");
    const className = sourceClassNameForFormula(trait);
    const classPattern = className
      ? "(?:" + escapeFormulaRegExp(className) + "(?:\\s+Class)?\\s+Level|Class\\s+Level|ClassLevel)"
      : "(?:[A-Za-z][A-Za-z-]*\\s+Class\\s+Level|Class\\s+Level|ClassLevel)";
    const patterns = {
      ClassLevel: classPattern,
      StrengthMod: "(?:Strength\\s+(?:Modifier|Mod)|STR\\s+(?:Modifier|Mod)|StrengthMod)\\b",
      DexterityMod: "(?:Dexterity\\s+(?:Modifier|Mod)|DEX\\s+(?:Modifier|Mod)|DexterityMod)\\b",
      ConstitutionMod: "(?:Constitution\\s+(?:Modifier|Mod)|CON\\s+(?:Modifier|Mod)|ConstitutionMod)\\b",
      IntelligenceMod: "(?:Intelligence\\s+(?:Modifier|Mod)|INT\\s+(?:Modifier|Mod)|IntelligenceMod)\\b",
      WisdomMod: "(?:Wisdom\\s+(?:Modifier|Mod)|WIS\\s+(?:Modifier|Mod)|WisdomMod)\\b",
      CharismaMod: "(?:Charisma\\s+(?:Modifier|Mod)|CHA\\s+(?:Modifier|Mod)|CharismaMod)\\b",
      Proficiency: "(?:Proficiency(?:\\s+Bonus)?)\\b",
      SpellSlotLevel: "(?:Spell\\s+Slot\\s+Level|SpellSlotLevel)\\b",
    };
    return patterns[key] || escapeFormulaRegExp(key);
  }

  function formulaTextPattern(formula, trait = {}, unit = "flat") {
    const normalized = normalizeDisplayFormula(formula, trait);
    const tokens = normalized.match(/[A-Za-z_][A-Za-z0-9_.]*|\d+(?:\.\d+)?|[+\-*\/%,()]/g) || [];
    const semanticTokens = tokens.filter((token) => !["(", ")", ","].includes(token) && !FORMULA_FUNCTIONS.has(token.toLowerCase()));

    // A bare ClassLevel is too generic to replace narrative prose such as
    // "Rage scaling uses Barbarian Class Level". Only replace it when the
    // description actually marks it as a percentage expression.
    if (semanticTokens.length === 1 && semanticTokens[0] === "ClassLevel") {
      if (normalizeId(unit) !== "percent") return null;
      const variable = formulaVariablePattern("ClassLevel", trait);
      return new RegExp("(?:\\(\\s*" + variable + "\\s*\\)\\s*%|" + variable + "\\s*%)", "i");
    }

    // A capped class-level percentage can be worded as "(Monk Class Level)% (Max 50%)".
    // Replace the variable with the evaluated capped formula, not the raw level.
    const cappedLevel = normalized.match(/^min\(\s*(\d+(?:\.\d+)?)\s*,\s*ClassLevel\s*\)$/i);
    if (cappedLevel && normalizeId(unit) === "percent") {
      const variable = formulaVariablePattern("ClassLevel", trait);
      const cap = escapeFormulaRegExp(cappedLevel[1]);
      return new RegExp("(?:\\(\\s*" + variable + "\\s*\\)\\s*%|" + variable + "\\s*%)(?=\\s*\\(\\s*Max\\s*" + cap + "\\s*%\\s*\\))", "i");
    }

    const parts = [];
    tokens.forEach((token) => {
      if (token === "(" || token === ")" || token === ",") return;
      if (FORMULA_FUNCTIONS.has(token.toLowerCase())) {
        parts.push("(?:" + escapeFormulaRegExp(token) + "[\\s(),]*)?");
        return;
      }
      if (/^[A-Za-z_]/.test(token)) {
        parts.push(formulaVariablePattern(token, trait));
        return;
      }
      if (token === "*") parts.push("(?:\\*|×)");
      else if (token === "/") parts.push("(?:/|÷)");
      else if (token === "%") parts.push("%");
      else if (token === "+" || token === "-") parts.push("\\" + token);
      else parts.push(escapeFormulaRegExp(token) + "%?");
    });
    if (!parts.length) return null;
    const opening = "(?:\\(\\s*)*";
    const closing = "(?:\\s*\\))*";
    const tail = normalizeId(unit) === "percent" ? "(?:\\s*%)?" : "";
    return new RegExp(opening + parts.join("[\\s(),]*") + closing + tail, "i");
  }

  function formulaHumanLabel(value) {
    const separated = String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/_multiplier$/i, "")
      .replace(/Multiplier$/i, "");
    return titleCaseId(separated);
  }

  function formulaLabel(path = [], owner = {}) {
    const key = String(path[path.length - 1] || "");
    const parent = String(path[path.length - 2] || "value");
    const raw = key.toLowerCase() === "formula"
      ? owner.channel || owner.path || owner.resourceId || parent
      : key.replace(/Formula$/i, "");
    return formulaHumanLabel(raw);
  }

  function formulaUnit(path = [], owner = {}) {
    const explicit = normalizeId(owner.unit || "");
    if (explicit === "percent" || explicit === "percentage" || explicit === "percent_reduction") return "percent";
    if (explicit === "hp" || explicit === "sp") return explicit;
    const probe = (path.join(" ") + " " + (owner.channel || "") + " " + (owner.path || "")).toLowerCase();
    if (probe.indexOf("percent") >= 0 || probe.indexOf("percentage") >= 0) return "percent";
    return "flat";
  }

  function collectTraitFormulaSpecs(trait = {}) {
    const specs = [];
    let sequence = 0;
    const visit = (value, path) => {
      if (Array.isArray(value)) {
        value.forEach((entry, index) => visit(entry, path.concat(String(index))));
        return;
      }
      if (!value || typeof value !== "object") return;
      Object.entries(value).forEach(([key, child]) => {
        const nextPath = path.concat(key);
        if ((key.toLowerCase() === "formula" || /Formula$/i.test(key)) && (typeof child === "string" || typeof child === "number")) {
          sequence += 1;
          specs.push({
            id: "auto_formula_" + sequence,
            label: formulaLabel(nextPath, value),
            formula: String(child),
            unit: formulaUnit(nextPath, value),
            sourcePath: nextPath.join("."),
          });
        } else if (child && typeof child === "object") {
          visit(child, nextPath);
        }
      });
    };
    visit(trait.mechanics || {}, ["mechanics"]);
    visit(trait.activation || {}, ["activation"]);
    visit(trait.rules || [], ["rules"]);
    visit(trait.effects || [], ["effects"]);
    return specs;
  }


  function matchingFormulaParenEnd(source, openIndex) {
    let depth = 0;
    for (let index = openIndex; index < source.length; index += 1) {
      if (source[index] === "(") depth += 1;
      else if (source[index] === ")") {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }

  function expandSimplePowers(formula) {
    let next = String(formula || "").replace(/²/g, "^2").replace(/³/g, "^3");
    const power = /\b([A-Za-z_][A-Za-z0-9_]*|\d+(?:\.\d+)?)\^([2-4])\b/g;
    for (let pass = 0; pass < 4 && power.test(next); pass += 1) {
      power.lastIndex = 0;
      next = next.replace(power, (_, base, exponent) => {
        const count = Number(exponent);
        return "(" + Array.from({ length: count }, () => base).join(" * ") + ")";
      });
      power.lastIndex = 0;
    }
    return next;
  }

  function humanFormulaToEngine(text, trait = {}) {
    let formula = String(text || "").trim();
    while (
      formula.startsWith("(")
      && formula.endsWith(")")
      && matchingFormulaParenEnd(formula, 0) === formula.length - 1
    ) {
      formula = formula.slice(1, -1).trim();
    }

    formula = formula.replace(/×/g, "*").replace(/÷/g, "/").replace(/%/g, "");
    const className = sourceClassNameForFormula(trait);
    const classIdName = titleCaseId(sourceClassIdForFormula(trait));
    [className, classIdName].filter(Boolean).forEach((name) => {
      formula = formula.replace(
        new RegExp("\\b" + escapeFormulaRegExp(name) + "(?:\\s+Class)?\\s+Level\\b", "gi"),
        "ClassLevel",
      );
    });
    formula = formula.replace(/\bClass\s+Level\b/gi, "ClassLevel");

    [
      [/(?:Strength|STR)\s+(?:Modifier|Mod)\b/gi, "StrengthMod"],
      [/(?:Dexterity|DEX)\s+(?:Modifier|Mod)\b/gi, "DexterityMod"],
      [/(?:Constitution|CON)\s+(?:Modifier|Mod)\b/gi, "ConstitutionMod"],
      [/(?:Intelligence|INT)\s+(?:Modifier|Mod)\b/gi, "IntelligenceMod"],
      [/(?:Wisdom|WIS)\s+(?:Modifier|Mod)\b/gi, "WisdomMod"],
      [/(?:Charisma|CHA)\s+(?:Modifier|Mod)\b/gi, "CharismaMod"],
      [/\bProficiency\s+Bonus\b/gi, "Proficiency"],
      [/\bSpell\s+Slot\s+Level\b/gi, "SpellSlotLevel"],
    ].forEach(([pattern, replacement]) => {
      formula = formula.replace(pattern, replacement);
    });

    return expandSimplePowers(normalizeDisplayFormula(formula, trait).replace(/\s+/g, ""));
  }

  function descriptionFormulaLabel(source, endIndex) {
    const tail = String(source || "").slice(endIndex);
    const match = tail.match(/^\s*%?\s*([A-Z][A-Za-z]*(?:\s+[A-Z][A-Za-z]*){0,2})\b/);
    return match?.[1] || "Resolved Value";
  }

  function descriptionFormulaCandidates(source, trait = {}) {
    const text = String(source || "");
    const candidates = [];
    const seenRanges = new Set();

    const add = (start, end) => {
      if (start < 0 || end <= start) return;
      let finalEnd = end;
      const percent = text.slice(finalEnd).match(/^\s*%/);
      if (percent) finalEnd += percent[0].length;
      const key = start + ":" + finalEnd;
      if (seenRanges.has(key)) return;

      const raw = text.slice(start, finalEnd);
      const formula = humanFormulaToEngine(raw, trait);
      const identifiers = formulaIdentifiers(formula);
      if (!formula || !identifiers.length) return;
      try {
        engine?.evaluateFormula?.(formula, Object.fromEntries(identifiers.map((id) => [id, 1])));
      } catch (_) {
        return;
      }

      seenRanges.add(key);
      candidates.push({
        start,
        end: finalEnd,
        raw,
        formula,
        unit: raw.includes("%") || Boolean(percent) ? "percent" : "flat",
        label: descriptionFormulaLabel(text, finalEnd),
      });
    };

    // Function-shaped formulas: max(...), floor(...), etc. Advance past the
    // outer expression so nested calls are not emitted as duplicate values.
    const functionPattern = /\b(?:floor|ceil|round|abs|max|min|clamp)\s*\(/gi;
    let match;
    while ((match = functionPattern.exec(text))) {
      const openIndex = text.indexOf("(", match.index);
      const endIndex = matchingFormulaParenEnd(text, openIndex);
      if (endIndex >= 0) {
        add(match.index, endIndex + 1);
        functionPattern.lastIndex = endIndex + 1;
      }
    }

    // Parenthesized arithmetic such as (Class Level / 2) or (WIS Mod * 10).
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] !== "(") continue;
      const endIndex = matchingFormulaParenEnd(text, index);
      if (endIndex < 0) continue;
      const raw = text.slice(index, endIndex + 1);
      const normalized = humanFormulaToEngine(raw, trait);
      if (formulaIdentifiers(normalized).length && /[+\-*\/^²³]/.test(raw)) add(index, endIndex + 1);
      index = endIndex;
    }

    // Inline binary math such as 10% × WIS Mod or Class Level / 2.
    const variable = "(?:(?:Strength|STR|Dexterity|DEX|Constitution|CON|Intelligence|INT|Wisdom|WIS|Charisma|CHA)\\s+(?:Modifier|Mod)|(?:[A-Za-z][A-Za-z-]*\\s+)?Class\\s+Level|Spell\\s+Slot\\s+Level|Proficiency\\s+Bonus)";
    const scalar = "(?:\\d+(?:\\.\\d+)?%?|"+ variable +")";
    const inlinePattern = new RegExp(scalar + "\\s*(?:×|÷|\\*|/|\\^)\\s*" + scalar + "(?:[²³])?", "gi");
    while ((match = inlinePattern.exec(text))) add(match.index, match.index + match[0].length);

    const powerPattern = new RegExp(variable + "\\s*(?:\\^\\s*[2-4]|[²³])", "gi");
    while ((match = powerPattern.exec(text))) add(match.index, match.index + match[0].length);

    return candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  }

  function resolveTraitDisplayValue(trait = {}, spec = {}, runtime = {}) {
    if (!engine?.buildVariables || !engine?.evaluateFormula || !spec?.id || spec.formula == null) return null;
    const resolvedRuntime = formulaRuntimeForTrait(trait, runtime || {});
    const character = resolvedRuntime.character || resolvedRuntime.self || {};
    const formula = normalizeDisplayFormula(spec.formula, trait);
    const variables = engine.buildVariables(character, resolvedRuntime, trait);
    const identifiers = formulaIdentifiers(formula);
    const missing = identifiers.filter((identifier) => !variableEntry(variables, identifier));
    const pending = identifiers.filter((identifier) => !formulaVariableReady(identifier, resolvedRuntime));
    if (missing.length) return null;
    if (pending.length) {
      return {
        id: String(spec.id),
        label: String(spec.label || titleCaseId(spec.id)),
        formula: String(spec.formula),
        evaluationFormula: formula,
        value: null,
        display: "pending",
        variables,
        pending: true,
        pendingVariables: pending,
        breakdown: traitFormulaBreakdown({ ...spec, formula }, variables).map((row) => (
          pending.some((identifier) => identifier.toLowerCase() === row.identifier.toLowerCase())
            ? { ...row, value: null, display: "pending", pending: true }
            : row
        )),
      };
    }
    try {
      const value = engine.evaluateFormula(formula, variables);
      if (!Number.isFinite(Number(value))) return null;
      const display = formatResolvedTraitValue(value, spec);
      if (!display) return null;
      return {
        id: String(spec.id),
        label: String(spec.label || titleCaseId(spec.id)),
        formula: String(spec.formula),
        evaluationFormula: formula,
        value: Number(value),
        display,
        variables,
        pending: false,
        pendingVariables: [],
        breakdown: traitFormulaBreakdown({ ...spec, formula }, variables),
      };
    } catch (_) {
      return null;
    }
  }

  function resolveTraitDisplay(trait = {}, runtime = {}) {
    const display = trait?.display || BUILTIN_DISPLAY_METADATA[normalizeId(trait?.id || trait?.name)] || null;
    const explicitTemplate = typeof display?.playerDescription === "string" ? display.playerDescription : "";
    const explicitSpecs = Array.isArray(display?.resolvedValues) ? display.resolvedValues : [];
    if (explicitTemplate && explicitSpecs.length) {
      const values = {};
      let complete = true;
      for (const spec of explicitSpecs) {
        const resolved = resolveTraitDisplayValue(trait, spec, runtime);
        if (!resolved) {
          complete = false;
          break;
        }
        values[resolved.id] = resolved;
      }
      const placeholders = [...explicitTemplate.matchAll(/\{([A-Za-z0-9_-]+)\}/g)].map((match) => match[1]);
      if (complete && placeholders.length && placeholders.every((id) => values[id])) {
        return { template: explicitTemplate, values, extras: [] };
      }
    }

    const source = String(trait.description || "");
    const autoSpecs = collectTraitFormulaSpecs(trait);
    if (!source) return null;
    const values = {};
    const replacements = [];
    const extras = [];
    const occupied = [];
    const seenFormula = new Set();

    autoSpecs.forEach((spec) => {
      const resolved = resolveTraitDisplayValue(trait, spec, runtime);
      if (!resolved) return;
      resolved.unit = spec.unit;
      const formulaKey = normalizeDisplayFormula(resolved.evaluationFormula || resolved.formula, trait)
        + "|" + normalizeId(spec.unit || "flat");
      if (seenFormula.has(formulaKey)) return;

      const pattern = formulaTextPattern(resolved.evaluationFormula || resolved.formula, trait, spec.unit);
      const match = pattern ? pattern.exec(source) : null;
      if (match) {
        const range = { start: match.index, end: match.index + match[0].length };
        const overlaps = occupied.some((used) => range.start < used.end && used.start < range.end);
        if (!overlaps) {
          seenFormula.add(formulaKey);
          occupied.push(range);
          values[resolved.id] = resolved;
          replacements.push({ ...range, token: "{" + resolved.id + "}" });
          return;
        }
      }

      // Values that appear only in internal mechanics are not player-facing
      // summaries. Only show calculated values that match the description.
    });

    let descriptionSequence = 0;
    descriptionFormulaCandidates(source, trait).forEach((candidate) => {
      const range = { start: candidate.start, end: candidate.end };
      if (occupied.some((used) => range.start < used.end && used.start < range.end)) return;

      const formulaKey = normalizeDisplayFormula(candidate.formula, trait)
        + "|" + normalizeId(candidate.unit || "flat");
      if (seenFormula.has(formulaKey)) return;

      descriptionSequence += 1;
      const spec = {
        id: "description_formula_" + descriptionSequence,
        label: candidate.label,
        formula: candidate.formula,
        unit: candidate.unit,
      };
      const resolved = resolveTraitDisplayValue(trait, spec, runtime);
      if (!resolved) return;

      resolved.unit = candidate.unit;
      seenFormula.add(formulaKey);
      occupied.push(range);
      values[resolved.id] = resolved;
      replacements.push({ ...range, token: "{" + resolved.id + "}" });
    });

    let template = source;
    replacements.sort((a, b) => b.start - a.start).forEach((replacement) => {
      template = template.slice(0, replacement.start) + replacement.token + template.slice(replacement.end);
    });
    return replacements.length || extras.length ? { template, values, extras } : null;
  }

  function appendTooltipRows(tooltip, resolved) {
    tooltip.appendChild(createElement("strong", "player-trait-formula-tooltip__title", resolved.label));
    resolved.breakdown.forEach((row) => {
      const line = createElement("span", `player-trait-formula-tooltip__row${row.pending ? " is-pending" : ""}`);
      line.append(
        createElement("span", "player-trait-formula-tooltip__key", `${row.label}:`),
        createElement("b", "player-trait-formula-tooltip__number", row.display),
      );
      tooltip.appendChild(line);
    });
    const total = createElement("span", "player-trait-formula-tooltip__total");
    total.append(
      createElement("span", "", resolved.pending ? "Result:" : "Total:"),
      createElement("b", "", resolved.pending ? "waiting for context" : resolved.display),
    );
    tooltip.appendChild(total);
  }

  function createResolvedValueControl(resolved) {
    const wrapper = createElement("span", "player-trait-resolved-control");
    const control = createElement("button", `player-trait-resolved-value${resolved.pending ? " is-pending" : ""}`);
    control.type = "button";
    control.appendChild(createElement("span", "player-trait-resolved-value__display", resolved.display));
    control.dataset.traitResolvedValue = resolved.id;
    control.dataset.traitFormulaPending = resolved.pending ? "true" : "false";
    control.setAttribute("aria-expanded", "false");
    control.setAttribute("aria-label", `${resolved.label}: ${resolved.pending ? "waiting for context" : resolved.display}. Activate to show the calculation.`);
    control.title = "Show calculation";

    // Put the calculation beneath its card when expanded. A floating tooltip
    // gets clipped by the scrollable Traits panel, especially on mobile.
    const details = createElement("span", "player-trait-formula-tooltip");
    details.id = `player-trait-formula-tooltip-${++tooltipSequence}`;
    details.hidden = true;
    details.setAttribute("role", "region");
    control.setAttribute("aria-controls", details.id);
    details.setAttribute("aria-label", `${resolved.label} calculation`);
    appendTooltipRows(details, resolved);
    wrapper.append(control, details);

    const setOpen = (open) => {
      const card = control.closest(".player-trait-card");
      if (!card) return;
      const active = Boolean(open);

      if (active) {
        // A card should expose only one calculation at a time.
        const previous = card.querySelector(".player-trait-formula-tooltip.is-open");
        if (previous && previous !== details) {
          const oldControl = card.querySelector(`[aria-controls="${previous.id}"]`);
          oldControl?.setAttribute("aria-expanded", "false");
          oldControl?.classList.remove("is-open");
          const oldWrapper = oldControl?.closest(".player-trait-resolved-control");
          oldWrapper?.classList.remove("is-open");
          previous.classList.remove("is-open");
          previous.hidden = true;
          oldWrapper?.appendChild(previous);
        }
        const next = card.querySelector(".player-trait-card__meta, .player-trait-card__footer");
        details.hidden = false;
        details.classList.add("is-open");
        card.insertBefore(details, next || null);
      } else {
        details.classList.remove("is-open");
        details.hidden = true;
        wrapper.appendChild(details);
      }
      wrapper.classList.toggle("is-open", active);
      control.classList.toggle("is-open", active);
      control.setAttribute("aria-expanded", active ? "true" : "false");
    };
    control.addEventListener("click", (event) => {
      event.stopPropagation();
      setOpen(!wrapper.classList.contains("is-open"));
    });
    control.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setOpen(false);
      control.blur();
    });
    return wrapper;
  }

  function renderTraitDescription(trait = {}, runtime = {}) {
    const description = createElement("p", "player-trait-card__description");
    const fallback = trait.description || "No description available.";
    const resolved = resolveTraitDisplay(trait, runtime);
    if (!resolved) {
      description.textContent = fallback;
      return description;
    }
    const pattern = /\{([A-Za-z0-9_-]+)\}/g;
    let cursor = 0;
    let match;
    while ((match = pattern.exec(resolved.template))) {
      if (match.index > cursor) description.appendChild(global.document.createTextNode(resolved.template.slice(cursor, match.index)));
      description.appendChild(createResolvedValueControl(resolved.values[match[1]]));
      cursor = match.index + match[0].length;
    }
    if (cursor < resolved.template.length) description.appendChild(global.document.createTextNode(resolved.template.slice(cursor)));
    if (Array.isArray(resolved.extras) && resolved.extras.length) {
      const summary = createElement("span", "player-trait-resolved-summary");
      resolved.extras.forEach((value) => {
        const item = createElement("span", "player-trait-resolved-summary__item");
        item.append(
          createElement("span", "player-trait-resolved-summary__label", `${value.label}:`),
          createResolvedValueControl(value),
        );
        summary.appendChild(item);
      });
      description.appendChild(summary);
    }
    return description;
  }

  function ensureStyles() {
    const doc = global.document;
    if (!doc) return;
    if (doc.getElementById("player-trait-tabs-stylesheet")) return;
    const link = doc.createElement("link");
    link.id = "player-trait-tabs-stylesheet";
    link.rel = "stylesheet";
    link.href = "css/player-trait-tabs.css";
    link.dataset.ui = "player-trait-tabs";
    doc.head?.appendChild(link);
  }


  // Background selections are read from the saved character, never guessed from catalog options.
  function backgroundProfile(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const id = String(build.backgroundId || character.backgroundId || "").trim();
    const rule = global.LuminousCharacterBuildRules?.getBackground?.(id) || null;
    const narrative = global.LuminousBackgroundNarratives?.get?.(id) || null;
    const legacy = global.LuminousLegacyBackgroundCatalog?.get?.(id) || null;
    const custom = character.backgroundNarrative && typeof character.backgroundNarrative === "object" ? character.backgroundNarrative : {};
    const buildChoices = build.backgroundChoices && typeof build.backgroundChoices === "object" ? build.backgroundChoices : {};
    const savedChoices = character.backgroundChoices && typeof character.backgroundChoices === "object" ? character.backgroundChoices : {};
    const choices = {
      ...custom,
      ...(!buildChoices.backgroundId || buildChoices.backgroundId === id ? buildChoices : {}),
      ...(!savedChoices.backgroundId || savedChoices.backgroundId === id ? savedChoices : {}),
    };
    const label = (value) => String(value ?? "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
    const fallbackName = id ? label(id).replace(/\b\w/g, (match) => match.toUpperCase()) : "";
    const name = narrative?.name || rule?.name || legacy?.name || String(character.backgroundName || "").trim() || fallbackName;
    const rawBonus = build?.breakdown?.backgroundHpCoefBonus ?? rule?.hpCoefBonus;
    const bonus = rawBonus == null || rawBonus === "" || !Number.isFinite(Number(rawBonus)) ? null : Number(rawBonus);
    return { id, name, rule, narrative, legacy, choices, bonus, character };
  }

  function backgroundChoiceValue(choices, name, aliases, fallback) {
    for (const key of [name, ...aliases]) {
      if (Object.prototype.hasOwnProperty.call(choices, key)) return choices[key];
    }
    return fallback;
  }

  function choiceText(value, options = []) {
    const raw = typeof value === "object" && value !== null
      ? String(value.label || value.name || value.description || value.id || "")
      : String(value ?? "");
    if (!raw.trim()) return "";
    const matched = options.find((option) => normalizeId(option.id) === normalizeId(raw) || normalizeId(option.label) === normalizeId(raw));
    return matched?.label || raw.replace(/[_-]+/g, " ").trim();
  }

  function addBackgroundDetail(target, title, content, className = "") {
    if (!content) return;
    const card = createElement("article", "player-background-detail " + className);
    card.append(
      createElement("h3", "player-background-detail__title", title),
      createElement("p", "player-background-detail__value", content),
    );
    target.appendChild(card);
  }

  class TraitPlayerTray {
    constructor(options = {}) {
      this.host = resolveHost(options.host);
      this.getTraits = typeof options.getTraits === "function" ? options.getTraits : () => options.traits || [];
      this.getRuntime = typeof options.getRuntime === "function" ? options.getRuntime : () => options.runtime || {};
      this.state = options.state || engine.createState();
      this.onActivated = typeof options.onActivated === "function" ? options.onActivated : () => {};
      this.onBlocked = typeof options.onBlocked === "function" ? options.onBlocked : () => {};
      this.resolveChoice = typeof options.resolveChoice === "function" ? options.resolveChoice : null;
      this.resolveInputs = typeof options.resolveInputs === "function" ? options.resolveInputs : null;
      this.prepareRuntime = typeof options.prepareRuntime === "function" ? options.prepareRuntime : null;
      this.title = options.title || "TRAITS";
      this.saveBackgroundChoices = typeof options.saveBackgroundChoices === "function" ? options.saveBackgroundChoices : null;
      this.backgroundEditing = false;
      this.backgroundSaving = false;
      this.backgroundEditorId = "";
      this.expanded = options.expanded !== false;
      this.filter = "all";
      this.root = null;
      this.statsConsole = null;
      this.backgroundPanel = null;
      ensureStyles();
      if (this.host && global.document) this.mount();
    }

    mount() {
      if (!this.host || this.root) return this.root;
      this.setupStatsTabs();
      this.root = createElement("section", "luminous-trait-tray player-traits-catalog");
      this.root.setAttribute("aria-label", "Character Traits");
      this.host.appendChild(this.root);
      this.render();
      return this.root;
    }

    normalizedTraits() {
      const seen = new Set();
      return (this.getTraits() || [])
        .map((trait) => engine.normalizeTrait(trait))
        .filter((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        })
        .sort((a, b) => {
          const ca = CATEGORY_ORDER.indexOf(sourceCategory(a));
          const cb = CATEGORY_ORDER.indexOf(sourceCategory(b));
          if (ca !== cb) return ca - cb;
          return String(a.name || "").localeCompare(String(b.name || ""));
        });
    }

    actions() {
      return engine.listAvailableTraitActions(this.getTraits() || [], this.getRuntime() || {}, this.state);
    }

    actionMap() {
      return new Map(this.actions().map((action) => [normalizeId(action.traitId), action]));
    }

    async activate(action) {
      const trait = (this.getTraits() || []).map(engine.normalizeTrait).find((entry) => entry.id === action.traitId);
      if (!trait) return null;
      if (!action.available) {
        this.onBlocked(action);
        return { available: false, reasons: action.reasons || [] };
      }

      let runtime = Object.assign({}, this.getRuntime() || {});
      if (this.prepareRuntime) {
        const prepared = await this.prepareRuntime({ action, trait, runtime, state: this.state });
        if (prepared?.available === false || prepared?.blocked) {
          const blocked = { available: false, reasons: prepared.reasons || [prepared.reason || "Trait target is unavailable."] };
          this.onBlocked(blocked);
          this.render();
          return blocked;
        }
        runtime = Object.assign(runtime, prepared?.runtime || prepared || {});
      }
      if (action.activationType === engine.ACTIVATION_TYPES.CHOICE && this.resolveChoice) {
        const choice = await this.resolveChoice({ action, trait, runtime, state: this.state });
        if (choice == null) return { available: false, cancelled: true, reasons: ["Choice cancelled."] };
        runtime.choice = choice;
      }
      if (action.inputs?.length && this.resolveInputs) {
        const inputs = await this.resolveInputs({ action, trait, runtime, state: this.state });
        if (inputs == null) return { available: false, cancelled: true, reasons: ["Input cancelled."] };
        runtime.inputs = inputs;
      }

      const result = engine.activateTrait(trait, runtime, this.state);
      if (result.available) {
        syncActivationStatuses(result, runtime);
        this.onActivated(result, { action, trait, runtime });
      } else this.onBlocked(result);
      this.render();
      return result;
    }


    currentBackground() {
      const runtime = this.getRuntime() || {};
      return backgroundProfile(runtime.character || global.datosJugador || {});
    }

    renderBackground(force = false) {
      if (!this.backgroundPanel) return;
      const profile = this.currentBackground();
      const panel = this.backgroundPanel;
      if (this.backgroundEditing && this.backgroundEditorId !== profile.id) {
        this.backgroundEditing = false;
        this.backgroundSaving = false;
      }
      // Trait refreshes and live Firebase events must not erase unsaved typing.
      if (this.backgroundEditing && !force && panel.querySelector?.(".player-background-choice-editor")) return;
      panel.replaceChildren();
      if (!profile.id) {
        panel.appendChild(createElement("div", "player-background-empty", "Aún no tienes un Background asignado."));
        return;
      }

      const hero = createElement("header", "player-background-hero");
      hero.append(
        createElement("span", "player-background-eyebrow", "TU HISTORIA"),
        createElement("h2", "player-background-name", profile.name),
      );
      const overview = profile.narrative?.overview || profile.legacy?.description;
      if (overview) hero.appendChild(createElement("p", "player-background-overview", overview));
      if (profile.bonus !== null) {
        const bonus = (profile.bonus >= 0 ? "+" : "") + profile.bonus.toFixed(2);
        hero.appendChild(createElement("span", "player-background-hp-bonus", "HP COEF " + bonus));
      }
      panel.appendChild(hero);

      if (profile.rule?.retired) {
        const retired = createElement("section", "player-background-feature player-background-retired");
        retired.append(
          createElement("span", "player-background-eyebrow", "TRASFONDO ARCHIVADO"),
          createElement("h3", "player-background-feature__title", "Este origen ya no está disponible para personajes nuevos"),
          createElement("p", "player-background-feature__description", "Tu personaje conserva su trasfondo y HP Coef. El DM puede elegir un trasfondo vigente para reemplazarlo. Este origen no tiene Trait narrativo asignado."),
        );
        panel.appendChild(retired);
      }

      if (profile.narrative?.feature?.name) {
        const feature = createElement("section", "player-background-feature");
        feature.append(
          createElement("span", "player-background-eyebrow", "FEATURE · TRASFONDO"),
          createElement("h3", "player-background-feature__title", profile.narrative.feature.name),
          createElement("p", "player-background-feature__description", profile.narrative.feature.description),
        );
        if (profile.narrative.feature.limits) {
          feature.appendChild(createElement("p", "player-background-feature__limits", profile.narrative.feature.limits));
        }
        panel.appendChild(feature);
      }

      if (profile.legacy) {
        const origin = createElement("section", "player-background-feature");
        origin.append(
          createElement("span", "player-background-eyebrow", "ORIGEN · CREACIÓN DE PERSONAJE"),
          createElement("h3", "player-background-feature__title", "Beneficios iniciales"),
          createElement("p", "player-background-feature__description", profile.legacy.benefit),
          createElement("p", "player-background-feature__limits", "Estas bonificaciones ya forman parte de tus estadísticas."),
        );
        panel.appendChild(origin);
        if (profile.legacy.initialFunds) {
          addBackgroundDetail(panel, "FONDOS INICIALES · NO REPRESENTA EL SALDO ACTUAL", profile.legacy.initialFunds, "player-background-origin-funds");
        }
      }

      const choices = profile.choices;
      const decisions = createElement("section", "player-background-decisions");
      decisions.appendChild(createElement("h3", "player-background-section-title", "TUS DECISIONES"));
      const ideal = choiceText(backgroundChoiceValue(choices, "ideal", ["idealId"], profile.character.psychologicalIdeal), profile.narrative?.ideals);
      const bond = choiceText(backgroundChoiceValue(choices, "bond", ["bondId", "vinculo"], profile.character.psychologicalVinculo), profile.narrative?.bonds);
      const flaw = choiceText(backgroundChoiceValue(choices, "flaw", ["flawId", "grieta"], profile.character.psychologicalGrieta), profile.narrative?.flaws);
      const personality = backgroundChoiceValue(choices, "personality", ["personalityTraits"], []);
      const personalityText = Array.isArray(personality) ? personality.map((entry) => choiceText(entry)).filter(Boolean).join(" · ") : choiceText(personality);
      if (this.backgroundEditing && this.saveBackgroundChoices) {
        decisions.appendChild(this.renderBackgroundEditor(profile));
      } else {
        const grid = createElement("div", "player-background-decision-grid");
        addBackgroundDetail(grid, "IDEAL", ideal || "Sin elección registrada");
        addBackgroundDetail(grid, "VÍNCULO", bond || "Sin elección registrada");
        addBackgroundDetail(grid, "DEFECTO / GRIETA", flaw || "Sin elección registrada");
        addBackgroundDetail(grid, "PERSONALIDAD", personalityText || "Sin elección registrada");
        decisions.appendChild(grid);
        if (this.saveBackgroundChoices) {
          const missing = [ideal, bond, flaw, personalityText].filter((value) => !value).length;
          if (missing) decisions.appendChild(createElement("p", "player-background-edit-hint", "Puedes completar las " + missing + " decisiones pendientes sin salir de tu ficha."));
          const editButton = createElement("button", "player-background-edit-button", missing ? "COMPLETAR BACKGROUND" : "EDITAR MIS DECISIONES");
          editButton.type = "button";
          editButton.addEventListener("click", () => {
            this.backgroundEditing = true;
            this.backgroundEditorId = profile.id;
            this.renderBackground(true);
          });
          decisions.appendChild(editButton);
        }
      }
      panel.appendChild(decisions);

      const psychologyId = String(profile.character.psychologicalBackgroundId || "").trim();
      if (psychologyId) {
        const psychology = createElement("section", "player-background-psychology");
        addBackgroundDetail(psychology, "TRASFONDO PSICOLÓGICO", psychologyId.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase()));
        panel.appendChild(psychology);
      }

      const hasBackgroundTrait = Boolean(this.renderNarrativeBackgroundTrait(profile))
        || this.normalizedTraits().some((trait) => sourceCategory(trait) === "background");
      if (hasBackgroundTrait) {
        const openTrait = createElement("button", "player-background-trait-link", "VER TRAIT DE BACKGROUND →");
        openTrait.type = "button";
        openTrait.addEventListener("click", () => {
          this.filter = "background";
          this.render();
          this.setStatsView("traits");
        });
        panel.appendChild(openTrait);
      }
    }


    renderBackgroundEditor(profile) {
      const doc = global.document;
      const choices = profile.choices || {};
      const container = createElement("form", "player-background-choice-editor");
      container.setAttribute("aria-label", "Editar decisiones de Background");
      const fields = [];
      const configs = [
        { id: "ideal", label: "IDEAL", saved: backgroundChoiceValue(choices, "ideal", ["idealId"], profile.character.psychologicalIdeal), options: profile.narrative?.ideals || [] },
        { id: "bond", label: "VÍNCULO", saved: backgroundChoiceValue(choices, "bond", ["bondId", "vinculo"], profile.character.psychologicalVinculo), options: profile.narrative?.bonds || [] },
        { id: "flaw", label: "DEFECTO / GRIETA", saved: backgroundChoiceValue(choices, "flaw", ["flawId", "grieta"], profile.character.psychologicalGrieta), options: profile.narrative?.flaws || [] },
      ];
      configs.forEach((config) => {
        const wrapper = createElement("div", "player-background-choice-field");
        const title = createElement("label", "player-background-choice-label", config.label);
        const select = createElement("select", "player-background-choice-select");
        select.name = config.id;
        select.id = "player-background-choice-" + config.id;
        title.htmlFor = select.id;
        const empty = doc.createElement("option");
        empty.value = "";
        empty.textContent = "— Selecciona una opción —";
        select.appendChild(empty);
        (config.options || []).forEach((item) => {
          const option = doc.createElement("option");
          option.value = String(item.id || item.label);
          option.textContent = item.label;
          select.appendChild(option);
        });
        const customOption = doc.createElement("option");
        customOption.value = "__custom__";
        customOption.textContent = "Escribir mi propia opción";
        select.appendChild(customOption);
        const custom = createElement("input", "player-background-choice-custom");
        custom.type = "text";
        custom.maxLength = 180;
        custom.placeholder = "Describe tu " + config.label.toLowerCase() + " (máx. 180 caracteres)";
        custom.setAttribute("aria-label", "Personalizar " + config.label);
        const raw = typeof config.saved === "object" && config.saved !== null
          ? String(config.saved.id || config.saved.label || "")
          : String(config.saved || "");
        const match = config.options.find((entry) => normalizeId(entry.id) === normalizeId(raw) || normalizeId(entry.label) === normalizeId(raw));
        select.value = match ? String(match.id || match.label) : raw ? "__custom__" : "";
        custom.value = !match ? choiceText(config.saved) : "";
        custom.hidden = select.value !== "__custom__";
        select.addEventListener("change", () => {
          custom.hidden = select.value !== "__custom__";
          if (!custom.hidden) custom.focus?.();
        });
        wrapper.append(title, select, custom);
        container.appendChild(wrapper);
        fields.push({
          id: config.id,
          read: () => select.value === "__custom__" ? custom.value.trim() : select.value.trim(),
          initial: select.value === "__custom__" ? custom.value.trim() : select.value.trim(),
        });
      });

      const oldPersonality = backgroundChoiceValue(choices, "personality", ["personalityTraits"], []);
      const personality = (Array.isArray(oldPersonality) ? oldPersonality : [oldPersonality]).map((item) => choiceText(item));
      const personalityWrap = createElement("fieldset", "player-background-personality-field");
      const personalityTitle = createElement("legend", "player-background-choice-label", "PERSONALIDAD · HASTA 2 RASGOS");
      personalityWrap.appendChild(personalityTitle);
      const personalityInputs = [0, 1].map((index) => {
        const input = createElement("input", "player-background-personality-input");
        input.type = "text";
        input.maxLength = 120;
        input.value = personality[index] || "";
        input.placeholder = "Rasgo " + (index + 1) + " (máx. 120 caracteres)";
        input.setAttribute("aria-label", "Rasgo de personalidad " + (index + 1));
        personalityWrap.appendChild(input);
        return input;
      });
      container.appendChild(personalityWrap);
      const initialPersonality = personalityInputs.map((input) => input.value.trim()).filter(Boolean);
      container.appendChild(createElement("p", "player-background-edit-hint", "Son decisiones narrativas. No modifican tu HP Coef, Traits ni bonificaciones."));
      const status = createElement("p", "player-background-save-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      const actions = createElement("div", "player-background-editor-actions");
      const save = createElement("button", "player-background-edit-button", "GUARDAR DECISIONES");
      save.type = "submit";
      const cancel = createElement("button", "player-background-cancel-button", "CANCELAR");
      cancel.type = "button";
      cancel.addEventListener("click", () => {
        if (this.backgroundSaving) return;
        this.backgroundEditing = false;
        this.renderBackground(true);
      });
      actions.append(save, cancel);
      container.append(status, actions);
      // Each form is its own editing session. A save started for an old
      // Background must never close, reset, or overwrite a newer editor.
      const isActiveEditor = () => this.backgroundEditing
        && this.backgroundEditorId === profile.id
        && this.backgroundPanel?.querySelector?.(".player-background-choice-editor") === container;
      container.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!isActiveEditor() || this.backgroundSaving) return;
        const payload = {};
        // Submit only choices actually modified by the player. A live DM update
        // can change other fields while this editor deliberately preserves its draft.
        fields.forEach((field) => {
          const value = field.read();
          if (value !== field.initial) payload[field.id] = value;
        });
        const traits = personalityInputs.map((input) => input.value.trim()).filter(Boolean);
        if (JSON.stringify(traits) !== JSON.stringify(initialPersonality)) payload.personality = traits;
        if (!Object.keys(payload).length) {
          status.textContent = "Modifica al menos una decisión antes de guardar.";
          return;
        }
        this.backgroundSaving = true;
        save.disabled = true;
        cancel.disabled = true;
        status.textContent = "Guardando tus decisiones…";
        try {
          await this.saveBackgroundChoices(profile.id, payload);
          if (!isActiveEditor()) return;
          this.backgroundEditing = false;
          this.backgroundSaving = false;
          this.renderBackground(true);
        } catch (error) {
          if (!isActiveEditor()) return;
          this.backgroundSaving = false;
          save.disabled = false;
          cancel.disabled = false;
          status.textContent = error?.message || "No se pudieron guardar las decisiones. Inténtalo de nuevo.";
        }
      });
      return container;
    }

    renderNarrativeBackgroundTrait(profile) {
      const trait = profile.narrative?.trait?.name ? profile.narrative.trait : profile.legacy?.benefit
        ? { name: "Bonificaciones de origen", description: profile.legacy.benefit } : null;
      if (!trait) return null;
      const card = createElement("article", "player-trait-card player-background-narrative-trait");
      card.dataset.traitCategory = "background";
      const description = profile.legacy ? trait.description : String(trait.description)
        .replace(/Reduce en X el Threshold/gi, "Reduce el Threshold")
        .replace(/\+X\b/gi, "un bono de");
      card.append(
        createElement("span", "player-trait-source player-trait-source--background", "BACKGROUND · " + profile.name),
        createElement("h3", "player-trait-card__name", trait.name),
        createElement("p", "player-trait-card__description", description),
      );
      const note = profile.legacy
        ? "Estas ventajas ya están reflejadas en tus estadísticas. Consultarlas aquí no las suma de nuevo."
        : /(?:^|[^a-z])X(?:[^a-z]|$)/.test(trait.description)
          ? "El valor concreto de esta ventaja se determina durante la partida."
          : "Esta ventaja se utiliza según las circunstancias y las reglas de la partida.";
      card.appendChild(createElement("p", "player-background-trait-note", note));
      return card;
    }

    setStatsView(view) {
      const consoleRoot = this.statsConsole || global.document?.querySelector("#stats-modal .player-ability-console");
      if (!consoleRoot) return false;
      const nextView = ["stats", "traits", "background"].includes(view) ? view : "stats";
      consoleRoot.dataset.playerStatsView = nextView;

      const abilityBar = consoleRoot.querySelector(":scope .player-ability-bar");
      const statContent = consoleRoot.querySelector(":scope .player-stat-content");
      if (abilityBar) abilityBar.hidden = nextView !== "stats";
      if (statContent) statContent.hidden = nextView !== "stats";
      if (this.host) this.host.hidden = nextView !== "traits";
      if (this.backgroundPanel) this.backgroundPanel.hidden = nextView !== "background";
      if (nextView === "background") this.renderBackground();

      consoleRoot.querySelectorAll("[data-player-stats-view]").forEach((button) => {
        const active = button.dataset.playerStatsView === nextView;
        button.classList.toggle("active", active);
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
        button.tabIndex = active ? 0 : -1;
      });
      return true;
    }

    setupStatsTabs() {
      const doc = global.document;
      if (!doc || !this.host) return false;
      const consoleRoot = doc.querySelector("#stats-modal .player-ability-console");
      const infoPanel = consoleRoot?.querySelector(".player-stats-information-panel");
      const tabline = infoPanel?.querySelector(".player-stats-tabline");
      if (!consoleRoot || !infoPanel || !tabline) return false;
      this.statsConsole = consoleRoot;

      let tabs = tabline.querySelector(".player-stats-view-tabs");
      if (!tabs) {
        tabline.querySelector(":scope > .player-stats-tab")?.remove();
        tabs = createElement("div", "player-stats-view-tabs");
        tabs.setAttribute("role", "tablist");
        tabs.setAttribute("aria-label", "Character information view");
        [
          ["stats", "Stats"],
          ["traits", "Traits"],
          ["background", "Background"],
        ].forEach(([view, label], index) => {
          const button = createElement("button", `player-stats-tab player-stats-view-tab${index === 0 ? " active is-active" : ""}`, label);
          button.type = "button";
          button.dataset.playerStatsView = view;
          button.setAttribute("role", "tab");
          button.setAttribute("aria-selected", index === 0 ? "true" : "false");
          button.tabIndex = index === 0 ? 0 : -1;
          button.addEventListener("click", () => this.setStatsView(view));
          button.addEventListener("keydown", (event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const order = ["stats", "traits", "background"];
            const position = order.indexOf(view);
            const targetView = event.key === "Home" ? order[0]
              : event.key === "End" ? order[order.length - 1]
              : order[(position + (event.key === "ArrowLeft" ? -1 : 1) + order.length) % order.length];
            this.setStatsView(targetView);
            tabs.querySelector('[data-player-stats-view="' + targetView + '"]')?.focus();
          });
          tabs.appendChild(button);
        });
        tabline.prepend(tabs);
      }

      if (this.host.parentElement !== infoPanel) infoPanel.appendChild(this.host);
      this.host.classList.add("player-traits-panel");
      if (!this.backgroundPanel || !this.backgroundPanel.isConnected) {
        this.backgroundPanel = createElement("section", "player-background-panel");
        this.backgroundPanel.id = "player-background-panel";
        this.backgroundPanel.setAttribute("role", "tabpanel");
        this.backgroundPanel.setAttribute("aria-label", "Background del personaje");
        infoPanel.appendChild(this.backgroundPanel);
      }
      const current = ["stats", "traits", "background"].includes(consoleRoot.dataset.playerStatsView)
        ? consoleRoot.dataset.playerStatsView : "stats";
      this.setStatsView(current);
      return true;
    }

    renderFilterBar(container, traits, hasNarrativeTrait = false, hasBackground = false) {
      const counts = Object.fromEntries(CATEGORY_ORDER.map((category) => [category, 0]));
      counts.all = traits.length + Number(hasNarrativeTrait);
      traits.forEach((trait) => { counts[sourceCategory(trait)] += 1; });
      if (hasNarrativeTrait) counts.background += 1;
      if (this.filter !== "all" && !counts[this.filter] && !(this.filter === "background" && hasBackground)) this.filter = "all";

      CATEGORY_ORDER.forEach((category) => {
        if (category !== "all" && counts[category] === 0 && !(category === "background" && hasBackground)) return;
        const button = createElement("button", `player-trait-filter${this.filter === category ? " is-active" : ""}`);
        button.type = "button";
        button.dataset.traitFilter = category;
        button.setAttribute("aria-pressed", this.filter === category ? "true" : "false");
        button.textContent = category === "background" ? "Background Trait" : CATEGORY_LABELS[category];
        button.addEventListener("click", () => {
          this.filter = category;
          this.render();
          this.root?.querySelector(`[data-trait-filter="${category}"]`)?.focus();
        });
        container.appendChild(button);
      });
    }

    renderTraitCard(trait, action) {
      const meta = sourceMeta(trait);
      const card = createElement("article", "player-trait-card");
      card.dataset.traitId = trait.id;
      card.dataset.traitCategory = meta.category;

      const header = createElement("div", "player-trait-card__header");
      const source = createElement("span", `player-trait-source player-trait-source--${meta.category}`, meta.detail);
      header.appendChild(source);
      const family = global.LuminousTraitFamilies?.resolve?.(trait);
      if (family) {
        card.dataset.traitFamily = family.id;
        const marker = createElement("span", "player-trait-family");
        marker.title = "Familia funcional: " + family.label;
        const image = createElement("img", "player-trait-family__icon");
        image.src = family.icon;
        image.alt = "";
        image.setAttribute("aria-hidden", "true");
        image.loading = "lazy";
        image.addEventListener("error", () => image.remove(), { once: true });
        marker.append(image, createElement("span", "player-trait-family__label", family.label));
        header.appendChild(marker);
      }
      if (activationLabel(trait) === "AUTO") {
        header.appendChild(createElement("span", "player-trait-activation", "AUTO"));
      }

      const name = createElement("h3", "player-trait-card__name", trait.name || trait.id || "Unnamed Trait");
      const description = renderTraitDescription(trait, this.getRuntime() || {});
      const metaRow = createElement("div", "player-trait-card__meta");
      contextLabels(trait).forEach((context) => metaRow.appendChild(createElement("span", "player-trait-context", context)));

      const footer = createElement("div", "player-trait-card__footer");
      if (action) {
        const button = createElement("button", `luminous-trait-tray__action player-trait-use${action.available ? "" : " is-disabled"}`);
        button.type = "button";
        button.disabled = !action.available;
        const cost = String(action.actionCost || "special").replaceAll("_", " ").toUpperCase();
        button.textContent = action.available ? `USE · ${cost}` : "UNAVAILABLE";
        button.title = action.available ? `${action.name} · ${cost}` : reasonLabel(action);
        button.addEventListener("click", () => this.activate(action));
        footer.appendChild(button);
        const uses = useLabel(action);
        if (uses) footer.appendChild(createElement("b", "luminous-trait-tray__uses", `Uses ${uses}`));
        if (!action.available) footer.appendChild(createElement("small", "luminous-trait-tray__reason", reasonLabel(action)));
      }

      card.append(header, name, description);
      if (metaRow.childElementCount) card.appendChild(metaRow);
      if (footer.childElementCount) card.appendChild(footer);
      return card;
    }

    render() {
      if (!this.root) return;
      this.setupStatsTabs();
      this.renderBackground();
      this.root.replaceChildren();

      const traits = this.normalizedTraits();
      const profile = this.currentBackground();
      const hasGrantedBackgroundTrait = traits.some((trait) => sourceCategory(trait) === "background");
      const narrativeTraitCard = hasGrantedBackgroundTrait ? null : this.renderNarrativeBackgroundTrait(profile);
      const hasNarrativeTrait = Boolean(narrativeTraitCard);
      const actions = this.actionMap();
      const filters = createElement("nav", "player-trait-filters");
      filters.setAttribute("aria-label", "Filter Traits by source");
      this.renderFilterBar(filters, traits, hasNarrativeTrait, hasGrantedBackgroundTrait || hasNarrativeTrait);

      const list = createElement("div", "luminous-trait-tray__list player-trait-card-list");
      const visible = filterTraits(traits, this.filter);
      visible.forEach((trait) => list.appendChild(this.renderTraitCard(trait, actions.get(normalizeId(trait.id)))));
      if (narrativeTraitCard && ["all", "background"].includes(this.filter)) list.appendChild(narrativeTraitCard);
      if (!list.childElementCount) {
        const message = this.filter === "background" ? "No hay Trait de Background disponible." : traits.length ? "NO TRAITS IN THIS CATEGORY" : "NO TRAITS ASSIGNED";
        list.appendChild(createElement("div", "luminous-trait-tray__empty player-traits-empty", message));
      }

      this.root.append(filters, list);
    }

    refresh() { this.render(); }
  }

  function mount(options) {
    return new TraitPlayerTray(options);
  }

  ensureStyles();
  const api = Object.freeze({
    TraitPlayerTray,
    mount,
    preserveGrantMetadata,
    syncActivationStatuses,
    sourceCategory,
    sourceMeta,
    filterTraits,
    formulaIdentifiers,
    normalizeDisplayFormula,
    collectTraitFormulaSpecs,
    descriptionFormulaCandidates,
    formatResolvedTraitValue,
    traitFormulaBreakdown,
    resolveTraitDisplayValue,
    resolveTraitDisplay,
    BUILTIN_DISPLAY_METADATA,
    CATEGORY_ORDER,
    CATEGORY_LABELS,
  });
  global.LuminousTraitPlayerTray = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
