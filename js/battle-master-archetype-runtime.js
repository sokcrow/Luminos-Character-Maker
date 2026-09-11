(function (global) {
  "use strict";

  if (global.LuminousBattleMasterArchetypeRuntime) return;

  const ARCHETYPE_ID = "battle_master";
  const ARCHETYPE_NAME = "Battle Master";
  const CLASS_ID = "fighter";
  const CLASS_NAME = "Fighter";
  const PATCH_INTERVAL_MS = 500;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;

  const ARCHETYPE = Object.freeze({ id: ARCHETYPE_ID, name: ARCHETYPE_NAME, classId: CLASS_ID, className: CLASS_NAME, unlockLevel: 15, traitLevels: [15, 35, 50, 75, 90] });
  const SOURCE = Object.freeze({ type: "archetype", id: ARCHETYPE_ID, archetypeId: ARCHETYPE_ID, archetypeName: ARCHETYPE_NAME, classId: CLASS_ID, className: CLASS_NAME });

  const DEFINITIONS = Object.freeze({
    combat_superiority: Object.freeze({
      schemaVersion: 1, id: "combat_superiority", name: "Combat Superiority",
      description: "Learn 3 Maneuvers from the Fighter Maneuver list. You can gain Superiority. [On Clash Win] Gain +3 Superiority. [On Hit] Gain +1 Superiority. Maneuver Damage Cap is 10%.",
      source: SOURCE, contexts: ["combat", "any"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { maneuverCatalog: "fighter", learnManeuvers: 3, superiority: { clashWinGain: 3, onHitGain: 1 }, maneuverDamageCap: 0.10, superiorTechniqueManeuverCountsAgainstLimit: false },
    }),
    student_of_war: Object.freeze({
      schemaVersion: 1, id: "student_of_war", name: "Student of War", description: "Gain proficiency with 1 Artisan Tool of your choice.",
      source: SOURCE, contexts: ["theatre", "any"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [], mechanics: { narrative: true, artisanToolChoices: 1 },
    }),
    know_your_enemy: Object.freeze({
      schemaVersion: 1, id: "know_your_enemy", name: "Know Your Enemy",
      description: "Every 10 Turns, unlock 1 feature from the currently observed Enemy Type without requiring an Analyse Check. This advances that Enemy Type's Observation Level in the Player Compendium.",
      source: SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { system: "analyse", observationScope: "encounter_global_enemy_type", everyTurns: 10, unlockFeatures: 1, bypassAnalyseCheck: true, advancesObservationLevel: true, compendium: "player", usesExistingObservationTarget: true },
    }),
    combat_superiority_plus: Object.freeze({
      schemaVersion: 1, id: "combat_superiority_plus", name: "Combat Superiority+",
      description: "Learn +1 additional Maneuver. [On Clash Win] Gain +4 Superiority. [On Hit] Gain +2 Superiority. Maneuver Damage Cap becomes 15%.",
      source: SOURCE, contexts: ["combat", "any"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { additionalManeuvers: 1, superiority: { clashWinGain: 4, onHitGain: 2 }, maneuverDamageCap: 0.15 },
    }),
    relentless: Object.freeze({
      schemaVersion: 1, id: "relentless", name: "Relentless",
      description: "While at 25% Max HP or lower, double all Maneuver effects and their caps. Superiority costs are not doubled.",
      source: SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { hpThresholdRatio: 0.25, maneuverEffectMultiplier: 2, maneuverCapMultiplier: 2, superiorityCostMultiplier: 1 },
    }),
    combat_superiority_plus_plus: Object.freeze({
      schemaVersion: 1, id: "combat_superiority_plus_plus", name: "Combat Superiority++",
      description: "Learn +1 additional Maneuver. [On Clash Win] Gain +5 Superiority. [On Hit] Gain +3 Superiority. Maneuver Damage Cap becomes 20%.",
      source: SOURCE, contexts: ["combat", "any"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { additionalManeuvers: 1, superiority: { clashWinGain: 5, onHitGain: 3 }, maneuverDamageCap: 0.20 },
    }),
  });

  const grant = (level, traitId) => Object.freeze({ sourceType: "archetype", sourceId: ARCHETYPE_ID, archetypeId: ARCHETYPE_ID, classId: CLASS_ID, atLevel: level, traitId, source: { ...SOURCE, atLevel: level, requiredClassLevel: level } });
  const GRANTS = Object.freeze([
    grant(15, "combat_superiority"), grant(15, "student_of_war"), grant(35, "know_your_enemy"),
    grant(50, "combat_superiority_plus"), grant(75, "relentless"), grant(90, "combat_superiority_plus_plus"),
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

  function selectedBattleMaster(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    const raw = character.characterBuild?.archetypes ?? character.archetypes ?? [];
    const list = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return list.some((entry) => normalizeId(entry?.classId || entry?.parentClassId) === CLASS_ID && normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id) === ARCHETYPE_ID);
  }

  function hasBattleMasterLevel(character, level) { return selectedBattleMaster(character) && fighterLevel(character) >= Number(level || 0); }

  function traitObjects(character = {}) {
    const candidates = [character.traitDefinitions, character.traits, character.characterBuild?.traits, character.characterBuild?.traitDefinitions];
    return candidates.flatMap((value) => Array.isArray(value) ? value : []).filter(Boolean);
  }

  function hasSuperiorTechnique(character = {}) {
    if (character.superiorTechnique === true || character.characterBuild?.superiorTechnique === true) return true;
    return traitObjects(character).some((trait) => normalizeId(typeof trait === "string" ? trait : trait.id || trait.name) === "superior_technique");
  }

  function combatSuperiorityProfile(character = {}) {
    if (!hasBattleMasterLevel(character, 15)) return null;
    const level = fighterLevel(character);
    if (level >= 90) return Object.freeze({ tier: 2, name: "Combat Superiority++", clashWinGain: 5, onHitGain: 3, damageCap: 0.20, battleMasterManeuvers: 5 });
    if (level >= 50) return Object.freeze({ tier: 1, name: "Combat Superiority+", clashWinGain: 4, onHitGain: 2, damageCap: 0.15, battleMasterManeuvers: 4 });
    return Object.freeze({ tier: 0, name: "Combat Superiority", clashWinGain: 3, onHitGain: 1, damageCap: 0.10, battleMasterManeuvers: 3 });
  }

  function maneuverCapacity(character = {}) {
    const profile = combatSuperiorityProfile(character);
    if (!profile) return 0;
    return profile.battleMasterManeuvers + (hasSuperiorTechnique(character) ? 1 : 0);
  }

  function superiorityGain(character = {}, trigger) {
    const profile = combatSuperiorityProfile(character);
    if (!profile) return 0;
    const id = normalizeId(trigger);
    if (["clash_win", "on_clash_win"].includes(id)) return profile.clashWinGain;
    if (["hit", "on_hit"].includes(id)) return profile.onHitGain;
    return 0;
  }

  function hpRatio(unit = {}) {
    const current = Number(unit.hp ?? unit.currentHp ?? unit.hp_actual ?? unit.combatStats?.hp_actual);
    const max = Number(unit.maxHp ?? unit.max_hp ?? unit.hp_max ?? unit.combatStats?.hp_max ?? unit.combatStats?.maxHp);
    if (!Number.isFinite(current) || !Number.isFinite(max) || max <= 0) return 1;
    return current / max;
  }

  function relentlessActive(character = {}, unit = character) { return hasBattleMasterLevel(character, 75) && hpRatio(unit) <= 0.25; }
  function maneuverEffectMultiplier(character = {}, unit = character) { return relentlessActive(character, unit) ? 2 : 1; }
  function maneuverDamageCap(character = {}, unit = character) {
    const profile = combatSuperiorityProfile(character);
    if (!profile) return 0;
    return profile.damageCap * maneuverEffectMultiplier(character, unit);
  }

  function maneuverCatalog() {
    const catalog = global.LuminousFighterManeuverCatalog;
    return catalog?.all ? catalog.all() : { ...(catalog?.MANEUVERS || {}) };
  }
  function maneuverDefinition(id) {
    const catalog = global.LuminousFighterManeuverCatalog;
    return catalog?.get ? catalog.get(id) : maneuverCatalog()[normalizeId(id)] || null;
  }

  function knowYourEnemyUnlockDue(character = {}, turnNumber) {
    if (!hasBattleMasterLevel(character, 35)) return false;
    const turn = Math.max(0, intOr(turnNumber, 0));
    return turn > 0 && turn % 10 === 0;
  }
  function knowYourEnemyRequest(character = {}, turnNumber, observedEnemyType = null) {
    if (!knowYourEnemyUnlockDue(character, turnNumber)) return null;
    return Object.freeze({ type: "analyse_feature_unlock", sourceTraitId: "know_your_enemy", enemyType: observedEnemyType, unlockFeatures: 1, bypassAnalyseCheck: true, advanceObservationLevel: true, useExistingObservationTarget: true });
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || !source?.allGrants || !source?.allArchetypes) return false;
    if (source.__battleMasterArchetypeIntegrated) return true;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;
    global.LuminousArchetypeTraitCatalog = Object.freeze({
      ...source, __battleMasterArchetypeIntegrated: true, BATTLE_MASTER_ID: ARCHETYPE_ID, BATTLE_MASTER_CLASS_ID: CLASS_ID,
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
        return [...byId.values()];
      },
    });
    return true;
  }

  function patchCoreCatalog() {
    const source = global.LuminousTraitCatalogCore;
    if (!source?.allDefinitions || !source?.allGrants || source.__battleMasterArchetypeIntegrated) return Boolean(source?.__battleMasterArchetypeIntegrated);
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source, __battleMasterArchetypeIntegrated: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS]; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__battleMasterArchetypeIntegrated) return Boolean(source?.__battleMasterArchetypeIntegrated);
    const originalResolve = source.resolveTraitGrants.bind(source);
    global.LuminousTraitEngine = Object.freeze({
      ...source, __battleMasterArchetypeIntegrated: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const base = originalResolve(character, grants, definitions) || [];
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants ? engine.resolveTraitGrants(character, GRANTS, { ...definitions, ...DEFINITIONS }, { [ARCHETYPE_ID]: ARCHETYPE }, source) || [] : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
        return [...byId.values()];
      },
    });
    return true;
  }

  function isBattleMasterTrait(trait = {}) {
    const source = trait.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType)) && normalizeId(source.archetypeId || source.id) === ARCHETYPE_ID;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__battleMasterArchetypeIntegrated) return Boolean(source?.__battleMasterArchetypeIntegrated);
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    global.LuminousArchetypeRuntime = Object.freeze({
      ...source, __battleMasterArchetypeIntegrated: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const engine = global.LuminousArchetypeEngine;
        const granted = engine?.resolveTraitGrants ? engine.resolveTraitGrants(unit, GRANTS, DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || [] : [];
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isBattleMasterTrait(trait)), ...granted].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
        unit.traitDefinitions = [...byId.values()];
        return [...base, ...granted];
      },
    });
    return true;
  }

  function install() { patchArchetypeCatalog(); patchCoreCatalog(); patchTraitEngine(); patchArchetypeRuntime(); return true; }

  const api = Object.freeze({
    ARCHETYPE_ID, ARCHETYPE_NAME, CLASS_ID, CLASS_NAME, ARCHETYPE, SOURCE, DEFINITIONS, GRANTS,
    fighterLevel, selectedBattleMaster, hasBattleMasterLevel, hasSuperiorTechnique, combatSuperiorityProfile,
    maneuverCapacity, superiorityGain, hpRatio, relentlessActive, maneuverEffectMultiplier, maneuverDamageCap,
    maneuverCatalog, maneuverDefinition, knowYourEnemyUnlockDue, knowYourEnemyRequest,
    patchArchetypeCatalog, patchCoreCatalog, patchTraitEngine, patchArchetypeRuntime, install,
  });

  global.LuminousBattleMasterArchetypeRuntime = api;
  install();
  if (global.document && global.setInterval) global.setInterval(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
