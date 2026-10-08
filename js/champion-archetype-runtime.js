(function (global) {
  "use strict";

  if (global.LuminousChampionArchetypeRuntime) return;

  const ARCHETYPE_ID = "champion";
  const ARCHETYPE_NAME = "Champion";
  const CLASS_ID = "fighter";
  const CLASS_NAME = "Fighter";
  const PATCH_INTERVAL_MS = 500;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const ARCHETYPE = Object.freeze({ id: ARCHETYPE_ID, name: ARCHETYPE_NAME, classId: CLASS_ID, className: CLASS_NAME, unlockLevel: 15, traitLevels: [15, 35, 50, 75, 90] });
  const SOURCE = Object.freeze({ type: "archetype", id: ARCHETYPE_ID, archetypeId: ARCHETYPE_ID, archetypeName: ARCHETYPE_NAME, classId: CLASS_ID, className: CLASS_NAME });

  const DEFINITIONS = Object.freeze({
    improved_critical: Object.freeze({
      schemaVersion: 1, id: "improved_critical", name: "Improved Critical",
      description: "Deal +10% Crit Damage. Gain +1 additional Poise from Skills that grant Poise. [On Turn Start] Gain 2 Poise.",
      source: SOURCE, contexts: ["combat", "any"], activation: { type: "passive", actionCost: "none" }, effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "crit_damage_multiplier", mode: "add", value: 10, unit: "percent" }],
      mechanics: { critDamagePercent: 10, additionalSkillPoise: 1, turnStartPoise: 2, replacedByTraitId: "superior_critical" },
    }),
    remarkable_athlete: Object.freeze({
      schemaVersion: 1, id: "remarkable_athlete", name: "Remarkable Athlete",
      description: "Gain +1 Final Power on STR, DEX and CON Checks. Gain +1 Max Speed.",
      source: SOURCE, contexts: ["any"], activation: { type: "passive", actionCost: "none" }, effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 1 }],
      mechanics: { physicalCheckFinalPower: 1, physicalCheckAbilities: ["strength", "dexterity", "constitution"], maxSpeedBonus: 1 },
    }),
    additional_fighting_style: Object.freeze({
      schemaVersion: 1, id: "additional_fighting_style", name: "Additional Fighting Style",
      description: "Gain 1 additional Fighting Style from the Fighter Fighting Style list.",
      source: SOURCE, contexts: ["any"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { fightingStyleChoice: true, additionalChoices: 1, classId: CLASS_ID, allowDuplicate: false },
    }),
    superior_critical: Object.freeze({
      schemaVersion: 1, id: "superior_critical", name: "Superior Critical",
      description: "Replaces Improved Critical. Deal +20% Crit Damage. Gain +2 additional Poise from Skills that grant Poise. [On Turn Start] Gain 3 Poise.",
      source: SOURCE, contexts: ["combat", "any"], activation: { type: "passive", actionCost: "none" }, effects: [],
      rules: [{ type: "modifier", trigger: "passive", target: "self", channel: "crit_damage_multiplier", mode: "add", value: 20, unit: "percent" }],
      mechanics: { replacesTraitId: "improved_critical", critDamagePercent: 20, additionalSkillPoise: 2, turnStartPoise: 3 },
    }),
    survivor: Object.freeze({
      schemaVersion: 1, id: "survivor", name: "Survivor",
      description: "[On Turn Start] If HP is 50% or lower, heal 5% Max HP.",
      source: SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { trigger: "turn_start", hpThresholdRatio: 0.50, healMaxHpPercent: 5 },
    }),
  });

  const grant = (level, traitId) => Object.freeze({ sourceType: "archetype", sourceId: ARCHETYPE_ID, archetypeId: ARCHETYPE_ID, classId: CLASS_ID, atLevel: level, traitId, source: { ...SOURCE, atLevel: level, requiredClassLevel: level } });
  const GRANTS = Object.freeze([
    grant(15, "improved_critical"),
    grant(35, "remarkable_athlete"),
    grant(50, "additional_fighting_style"),
    grant(75, "superior_critical"),
    grant(90, "survivor"),
  ]);

  function normalizedCharacter(character = {}) {
    if (Array.isArray(character.classes)) return character;
    if (Array.isArray(character.characterBuild?.classes)) return { ...character, classes: character.characterBuild.classes };
    return character;
  }

  function fighterLevel(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.getClassLevel) return Math.max(0, intOr(engine.getClassLevel(normalizedCharacter(character), CLASS_ID), 0));
    const classes = Array.isArray(character.classes) ? character.classes : Array.isArray(character.characterBuild?.classes) ? character.characterBuild.classes : [];
    const found = classes.find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === CLASS_ID);
    return Math.max(0, intOr(found?.levels ?? found?.level, 0));
  }

  function selectedChampion(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    const raw = character.characterBuild?.archetypes ?? character.archetypes ?? [];
    const list = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return list.some((entry) => normalizeId(entry?.classId || entry?.parentClassId) === CLASS_ID && normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id) === ARCHETYPE_ID);
  }

  function hasChampionLevel(character = {}, level = 15) {
    return selectedChampion(character) && fighterLevel(character) >= Number(level || 0);
  }

  function traitBaseId(trait = {}) {
    return normalizeId(trait?.baseTraitId || String(trait?.id || trait?.name || "").split("__class__")[0]);
  }

  function isChampionTrait(trait = {}) {
    const source = trait?.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType)) && normalizeId(source.archetypeId || source.id || trait.archetypeId) === ARCHETYPE_ID;
  }

  function championTraits(unit = {}) {
    const candidates = [unit.traitDefinitions, unit.traits, unit.characterBuild?.traits, unit.characterBuild?.traitDefinitions];
    return candidates.flatMap((value) => Array.isArray(value) ? value : []).filter((trait) => trait && typeof trait === "object" && isChampionTrait(trait));
  }

  function hasChampionTrait(unit = {}, traitId) {
    const id = normalizeId(traitId);
    return championTraits(unit).some((trait) => traitBaseId(trait) === id);
  }

  function collapseCriticalProgression(character = {}, traits = []) {
    if (!hasChampionLevel(character, 75)) return traits || [];
    return (traits || []).filter((trait) => traitBaseId(trait) !== "improved_critical");
  }

  function criticalProfile(unit = {}) {
    if (hasChampionTrait(unit, "superior_critical")) return Object.freeze({ tier: 1, critDamagePercent: 20, additionalSkillPoise: 2, turnStartPoise: 3 });
    if (hasChampionTrait(unit, "improved_critical")) return Object.freeze({ tier: 0, critDamagePercent: 10, additionalSkillPoise: 1, turnStartPoise: 2 });
    return null;
  }

  function fightingStyleChoiceLimit(character = {}) {
    return hasChampionLevel(character, 50) ? 2 : 1;
  }

  function applyAdditionalFightingStyleChoice(character = {}, styleId) {
    if (!hasChampionLevel(character, 50)) return { success: false, reason: "additional_fighting_style_locked", requiredLevel: 50 };
    const runtime = global.LuminousFightingStyleRuntime;
    if (!runtime?.applyChoice) return { success: false, reason: "fighting_style_runtime_unavailable" };
    const selected = runtime.selectedStyles?.(character) || [];
    const maximum = fightingStyleChoiceLimit(character);
    if (selected.length >= maximum) return { success: false, reason: "fighting_style_choice_limit", maximum, styles: selected };
    return runtime.applyChoice(character, CLASS_ID, styleId);
  }

  function physicalCheckAbility(check = {}) {
    return normalizeId(check.abilityId || check.statId || check.ability || check.stat || check.attribute);
  }

  function isPhysicalChampionCheck(check = {}) {
    return ["str", "strength", "fuerza", "dex", "dexterity", "destreza", "con", "constitution", "constitucion"].includes(physicalCheckAbility(check));
  }

  function applyRemarkableAthleteCheck(checkInput = {}, character = {}) {
    const check = { ...(checkInput || {}) };
    if (check.__championRemarkableAthleteAdjusted || !hasChampionLevel(character, 35) || !isPhysicalChampionCheck(check)) return check;
    check.finalPower = numberOr(check.finalPower, 0) + 1;
    Object.defineProperty(check, "__championRemarkableAthleteAdjusted", { value: true, enumerable: false, configurable: true });
    return check;
  }

  function ensureStatusStore(unit = {}) {
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    return unit.statusEffects;
  }

  function gainPoise(unit = {}, amount = 0, sourceTraitId = null) {
    const gain = Math.max(0, intOr(amount, 0));
    if (!gain || !unit) return null;
    const engine = global.LuminousStatusEngine;
    if (engine?.applyStatus) {
      return engine.applyStatus(unit, "poise", { count: gain, potency: 0, mode: "gain", sourceTraitId, sourceUnitId: unit.id || unit.unitId || unit.characterId || null });
    }
    const store = ensureStatusStore(unit);
    const existing = store.poise && typeof store.poise === "object" ? store.poise : { id: "poise", name: "Poise", count: 0, potency: 0 };
    store.poise = { ...existing, count: Math.max(0, intOr(existing.count, 0)) + gain, potency: numberOr(existing.potency, 0), sourceTraitId: sourceTraitId || existing.sourceTraitId || null };
    return clone(store.poise);
  }

  function hpSnapshot(unit = {}) {
    const current = numberOr(unit.hp ?? unit.currentHp ?? unit.hp_actual ?? unit.combatStats?.hp_actual, 0);
    const max = numberOr(unit.maxHp ?? unit.max_hp ?? unit.hp_max ?? unit.combatStats?.hp_max ?? unit.combatStats?.maxHp, current);
    return { current, max };
  }

  function writeHp(unit = {}, value) {
    const next = Math.max(0, Math.floor(numberOr(value, 0)));
    if (Object.prototype.hasOwnProperty.call(unit, "hp")) unit.hp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentHp")) unit.currentHp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "hp_actual")) unit.hp_actual = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "hp_actual")) unit.combatStats.hp_actual = next;
    else unit.hp = next;
    return next;
  }

  function applySurvivor(unit = {}) {
    if (!hasChampionTrait(unit, "survivor")) return { healed: 0, active: false };
    const hp = hpSnapshot(unit);
    if (hp.current <= 0 || hp.max <= 0 || hp.current / hp.max > 0.50) return { healed: 0, active: false, ...hp };
    const requested = Math.max(0, Math.floor(hp.max * 0.05));
    const after = Math.min(hp.max, hp.current + requested);
    writeHp(unit, after);
    return { healed: Math.max(0, after - hp.current), active: true, before: hp.current, after, max: hp.max };
  }

  function applyChampionTurnStart(unit = {}) {
    const profile = criticalProfile(unit);
    const poise = profile ? gainPoise(unit, profile.turnStartPoise, profile.tier > 0 ? "superior_critical" : "improved_critical") : null;
    const survivor = applySurvivor(unit);
    return { poise, survivor };
  }

  function poiseSkillEffects(context = {}, tag) {
    const skill = context?.skill;
    if (!skill) return [];
    const effects = [];
    const seen = new Set();
    const add = (effect) => {
      if (!effect || seen.has(effect)) return;
      if (String(effect.tag || effect.trigger || "") !== String(tag || "")) return;
      if (normalizeId(effect.type) !== "status" || normalizeId(effect.status || effect.statusId) !== "poise" || normalizeId(effect.target || "self") !== "self") return;
      seen.add(effect);
      effects.push(effect);
    };
    (Array.isArray(skill.effects) ? skill.effects : []).forEach(add);
    (Array.isArray(skill.coins) ? skill.coins : []).forEach((coin) => (Array.isArray(coin?.effects) ? coin.effects : []).forEach(add));
    (Array.isArray(context?.currentCoin?.effects) ? context.currentCoin.effects : []).forEach(add);
    return effects;
  }

  function withAdditionalSkillPoise(attacker = {}, context = {}, tag, callback) {
    const profile = criticalProfile(attacker);
    if (!profile?.additionalSkillPoise) return callback();
    const effects = poiseSkillEffects(context, tag);
    if (!effects.length) return callback();
    const previous = effects.map((effect) => [effect, effect.count]);
    effects.forEach((effect) => { effect.count = Math.max(0, numberOr(effect.count, 0)) + profile.additionalSkillPoise; });
    try { return callback(); }
    finally { previous.forEach(([effect, count]) => { if (count === undefined) delete effect.count; else effect.count = count; }); }
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || !source?.allGrants || !source?.allArchetypes) return false;
    if (source.__championArchetypeIntegrated) return true;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;
    global.LuminousArchetypeTraitCatalog = Object.freeze({
      ...source, __championArchetypeIntegrated: true, CHAMPION_ID: ARCHETYPE_ID, CHAMPION_CLASS_ID: CLASS_ID,
      ARCHETYPES: Object.freeze({ ...(source.ARCHETYPES || {}), [ARCHETYPE_ID]: ARCHETYPE }),
      DEFINITIONS: Object.freeze({ ...(source.DEFINITIONS || {}), ...DEFINITIONS }),
      GRANTS: Object.freeze([...(source.GRANTS || []), ...GRANTS]),
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS.map((entry) => ({ ...entry, source: { ...(entry.source || {}) } }))]; },
      allArchetypes() { return { ...originalArchetypes(), [ARCHETYPE_ID]: { ...ARCHETYPE } }; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
      resolveTraitGrants(character = {}, definitions) {
        const base = originalResolve ? originalResolve(character, definitions) || [] : [];
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants ? engine.resolveTraitGrants(character, GRANTS, definitions ? { ...definitions, ...DEFINITIONS } : DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || [] : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
        return collapseCriticalProgression(character, [...byId.values()]);
      },
    });
    return true;
  }

  function patchCoreCatalog() {
    const source = global.LuminousTraitCatalogCore;
    if (!source?.allDefinitions || !source?.allGrants || source.__championArchetypeIntegrated) return Boolean(source?.__championArchetypeIntegrated);
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source, __championArchetypeIntegrated: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS]; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__championArchetypeIntegrated) return Boolean(source?.__championArchetypeIntegrated);
    const originalResolve = source.resolveTraitGrants.bind(source);
    global.LuminousTraitEngine = Object.freeze({
      ...source, __championArchetypeIntegrated: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const base = originalResolve(character, grants, definitions) || [];
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants ? engine.resolveTraitGrants(character, GRANTS, { ...definitions, ...DEFINITIONS }, { [ARCHETYPE_ID]: ARCHETYPE }, source) || [] : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
        return collapseCriticalProgression(character, [...byId.values()]);
      },
    });
    return true;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__championArchetypeIntegrated) return Boolean(source?.__championArchetypeIntegrated);
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    global.LuminousArchetypeRuntime = Object.freeze({
      ...source, __championArchetypeIntegrated: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const engine = global.LuminousArchetypeEngine;
        const granted = engine?.resolveTraitGrants ? engine.resolveTraitGrants(unit, GRANTS, DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || [] : [];
        const collapsed = collapseCriticalProgression(unit, granted);
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isChampionTrait(trait)), ...collapsed].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
        unit.traitDefinitions = [...byId.values()];
        return [...base, ...collapsed];
      },
    });
    return true;
  }

  function currentCharacter() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || {};
  }

  function patchTheatreRolls() {
    const source = global.LuminousTheatreRolls;
    if (!source?.armCheck || source.__championArchetypeIntegrated) return Boolean(source?.__championArchetypeIntegrated);
    const originalArmCheck = source.armCheck.bind(source);
    global.LuminousTheatreRolls = Object.freeze({
      ...source, __championArchetypeIntegrated: true,
      armCheck(check = {}) { return originalArmCheck(global.LuminousPlayerTraitRuntime?.resolveTheatreCheck ? check : applyRemarkableAthleteCheck(check, currentCharacter())); },
    });
    return true;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__championArchetypeIntegrated) return Boolean(engine?.__championArchetypeIntegrated);
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const units = Array.isArray(allUnits) ? allUnits : [];
        units.forEach((unit) => global.LuminousArchetypeRuntime?.syncArchetypeTraitsForUnit?.(unit));
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (phaseTag === "[Round Start]") units.forEach((unit) => applyChampionTurnStart(unit));
        return result;
      };
    }

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const attacker = context?.attacker || context?.unitAttacker || null;
        if (attacker) global.LuminousArchetypeRuntime?.syncArchetypeTraitsForUnit?.(attacker);
        return withAdditionalSkillPoise(attacker || {}, context || {}, tag, () => originalTriggerEvent.call(this, tag, context, targetsHit));
      };
    }

    Object.defineProperty(engine, "__championArchetypeIntegrated", { value: true, configurable: true });
    return true;
  }

  function watchCombatEngineAssignment() {
    if (global.CombatEngine || global.__luminousChampionCombatAssignmentWatch) return false;
    global.__luminousChampionCombatAssignmentWatch = true;
    try {
      Object.defineProperty(global, "CombatEngine", {
        configurable: true, enumerable: true,
        get() { return undefined; },
        set(value) {
          Object.defineProperty(global, "CombatEngine", { value, writable: true, configurable: true, enumerable: true });
          patchCombatEngine();
        },
      });
      return true;
    } catch (_) { return false; }
  }

  function install() {
    patchArchetypeCatalog();
    patchCoreCatalog();
    patchTraitEngine();
    patchArchetypeRuntime();
    patchTheatreRolls();
    patchCombatEngine();
    watchCombatEngineAssignment();
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID, ARCHETYPE_NAME, CLASS_ID, CLASS_NAME, ARCHETYPE, SOURCE, DEFINITIONS, GRANTS,
    fighterLevel, selectedChampion, hasChampionLevel, traitBaseId, isChampionTrait, championTraits, hasChampionTrait,
    collapseCriticalProgression, criticalProfile, fightingStyleChoiceLimit, applyAdditionalFightingStyleChoice,
    physicalCheckAbility, isPhysicalChampionCheck, applyRemarkableAthleteCheck,
    gainPoise, applySurvivor, applyChampionTurnStart, poiseSkillEffects, withAdditionalSkillPoise,
    patchArchetypeCatalog, patchCoreCatalog, patchTraitEngine, patchArchetypeRuntime, patchTheatreRolls, patchCombatEngine, watchCombatEngineAssignment, install,
  });

  global.LuminousChampionArchetypeRuntime = api;
  install();
  if (global.document && global.setInterval) global.setInterval(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
