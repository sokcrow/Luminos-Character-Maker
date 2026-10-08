(function (global) {
  "use strict";

  if (global.LuminousSamuraiArchetypeRuntime) return;

  const ARCHETYPE_ID = "samurai";
  const ARCHETYPE_NAME = "Samurai";
  const CLASS_ID = "fighter";
  const CLASS_NAME = "Fighter";
  const COUNT_ID = "fighting_spirit";
  const PATCH_INTERVAL_MS = 500;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const ARCHETYPE = Object.freeze({ id: ARCHETYPE_ID, name: ARCHETYPE_NAME, classId: CLASS_ID, className: CLASS_NAME, unlockLevel: 15, traitLevels: [15, 35, 50, 75, 90] });
  const SOURCE = Object.freeze({ type: "archetype", id: ARCHETYPE_ID, archetypeId: ARCHETYPE_ID, archetypeName: ARCHETYPE_NAME, classId: CLASS_ID, className: CLASS_NAME });

  const DEFINITIONS = Object.freeze({
    fighting_spirit: Object.freeze({
      schemaVersion: 1, id: "fighting_spirit", name: "Fighting Spirit",
      description: "[On Hit] Gain 1 Fighting Spirit Count. [On Kill] Gain 3 Fighting Spirit Count. Gain 1 Shield per Fighting Spirit Count gained. Gain +1 Clash Power for every 5 Fighting Spirit Count (Max 2).",
      source: SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { countId: COUNT_ID, onHitGain: 1, onKillGain: 3, shieldPerCountGained: 1, clashPowerPerCount: 5, clashPowerMax: 2, replacedByTraitId: "fighting_spirit_plus" },
    }),
    elegant_courtier: Object.freeze({
      schemaVersion: 1, id: "elegant_courtier", name: "Elegant Courtier",
      description: "On Persuasion Checks, add your WIS Modifier to Final Power. Gain Proficiency on WIS Save Checks. If already proficient in WIS Saves, choose INT or CHA Save Checks instead.",
      source: SOURCE, contexts: ["theatre", "any"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { persuasionAddsWisdomModifier: true, saveProficiencyAbility: "wis", alternateSaveProficiencyChoices: ["int", "cha"] },
    }),
    fighting_spirit_plus: Object.freeze({
      schemaVersion: 1, id: "fighting_spirit_plus", name: "Fighting Spirit+",
      description: "[On Hit] Gain 2 Fighting Spirit Count. [On Kill] Gain 5 Fighting Spirit Count. Gain 2 Shield per Fighting Spirit Count gained. Gain +1 Clash Power for every 5 Fighting Spirit Count (Max 2). Gain +1 Final Power for every 15 Fighting Spirit Count (Max 2).",
      source: SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { countId: COUNT_ID, replacesTraitId: "fighting_spirit", onHitGain: 2, onKillGain: 5, shieldPerCountGained: 2, clashPowerPerCount: 5, clashPowerMax: 2, finalPowerPerCount: 15, finalPowerMax: 2, replacedByTraitId: "fighting_spirit_plus_plus" },
    }),
    tireless_spirit: Object.freeze({
      schemaVersion: 1, id: "tireless_spirit", name: "Tireless Spirit",
      description: "[Encounter Start] Gain 5 Fighting Spirit Count. [On Turn Start] Gain 2 Fighting Spirit Count.",
      source: SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { encounterStartGain: 5, turnStartGain: 2, countId: COUNT_ID },
    }),
    rapid_strike: Object.freeze({
      schemaVersion: 1, id: "rapid_strike", name: "Rapid Strike",
      description: "[On Melee Skill End] Once per Turn: at 10+ Fighting Spirit use a random Tier 1 Skill against a random Enemy; at 20+ use Tier 2 instead; at 30+ use Tier 3 instead.",
      source: SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { trigger: "melee_skill_end", oncePerTurn: true, tiers: [{ count: 10, tier: 1 }, { count: 20, tier: 2 }, { count: 30, tier: 3 }], highestTierOnly: true, consumeCount: false, randomEnemy: true },
    }),
    fighting_spirit_plus_plus: Object.freeze({
      schemaVersion: 1, id: "fighting_spirit_plus_plus", name: "Fighting Spirit++",
      description: "[On Hit] Gain 3 Fighting Spirit Count. [On Kill] Gain 7 Fighting Spirit Count. Gain 3 Shield per Fighting Spirit Count gained. Gain +1 Clash Power for every 5 Fighting Spirit Count (Max 2). Gain +1 Final Power for every 15 Fighting Spirit Count (Max 2). Deal +1% Damage for every Fighting Spirit Count.",
      source: SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { countId: COUNT_ID, replacesTraitId: "fighting_spirit_plus", onHitGain: 3, onKillGain: 7, shieldPerCountGained: 3, clashPowerPerCount: 5, clashPowerMax: 2, finalPowerPerCount: 15, finalPowerMax: 2, damagePercentPerCount: 1 },
    }),
    strength_before_death: Object.freeze({
      schemaVersion: 1, id: "strength_before_death", name: "Strength Before Death",
      description: "[On HP reaching 0] If you have Fighting Spirit Count, survive at 1 HP instead. Consume all Fighting Spirit Count. Recover 1% Max HP for each Fighting Spirit Count consumed. Once per Encounter.",
      source: SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { trigger: "hp_zero", requiresFightingSpirit: true, surviveHp: 1, consumeAllFightingSpirit: true, healMaxHpPercentPerCount: 1, oncePerEncounter: true },
    }),
  });

  const grant = (level, traitId) => Object.freeze({ sourceType: "archetype", sourceId: ARCHETYPE_ID, archetypeId: ARCHETYPE_ID, classId: CLASS_ID, atLevel: level, traitId, source: { ...SOURCE, atLevel: level, requiredClassLevel: level } });
  const GRANTS = Object.freeze([
    grant(15, "fighting_spirit"),
    grant(35, "elegant_courtier"),
    grant(50, "fighting_spirit_plus"),
    grant(50, "tireless_spirit"),
    grant(75, "rapid_strike"),
    grant(90, "fighting_spirit_plus_plus"),
    grant(90, "strength_before_death"),
  ]);

  const encounterStateByKey = new Map();
  const encounterStateByObject = typeof WeakMap === "function" ? new WeakMap() : null;

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

  function selectedSamurai(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    const raw = character.characterBuild?.archetypes ?? character.archetypes ?? [];
    const list = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return list.some((entry) => normalizeId(entry?.classId || entry?.parentClassId) === CLASS_ID && normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id) === ARCHETYPE_ID);
  }

  function hasSamuraiLevel(character = {}, level = 15) {
    return selectedSamurai(character) && fighterLevel(character) >= Number(level || 0);
  }

  function traitBaseId(trait = {}) {
    return normalizeId(trait?.baseTraitId || String(trait?.id || trait?.name || "").split("__class__")[0]);
  }

  function isSamuraiTrait(trait = {}) {
    const source = trait?.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType)) && normalizeId(source.archetypeId || source.id || trait.archetypeId) === ARCHETYPE_ID;
  }

  function collapseFightingSpiritProgression(character = {}, traits = []) {
    const level = fighterLevel(character);
    return (traits || []).filter((trait) => {
      const id = traitBaseId(trait);
      if (level >= 90 && ["fighting_spirit", "fighting_spirit_plus"].includes(id)) return false;
      if (level >= 50 && level < 90 && id === "fighting_spirit") return false;
      return true;
    });
  }

  function fightingSpiritProfile(character = {}) {
    if (!hasSamuraiLevel(character, 15)) return null;
    const level = fighterLevel(character);
    if (level >= 90) return Object.freeze({ tier: 2, traitId: "fighting_spirit_plus_plus", onHitGain: 3, onKillGain: 7, shieldPerCountGained: 3, clashPowerPerCount: 5, clashPowerMax: 2, finalPowerPerCount: 15, finalPowerMax: 2, damagePercentPerCount: 1 });
    if (level >= 50) return Object.freeze({ tier: 1, traitId: "fighting_spirit_plus", onHitGain: 2, onKillGain: 5, shieldPerCountGained: 2, clashPowerPerCount: 5, clashPowerMax: 2, finalPowerPerCount: 15, finalPowerMax: 2, damagePercentPerCount: 0 });
    return Object.freeze({ tier: 0, traitId: "fighting_spirit", onHitGain: 1, onKillGain: 3, shieldPerCountGained: 1, clashPowerPerCount: 5, clashPowerMax: 2, finalPowerPerCount: 0, finalPowerMax: 0, damagePercentPerCount: 0 });
  }

  function ensureTraitCounts(unit = {}) {
    if (!unit.traitCounts || typeof unit.traitCounts !== "object" || Array.isArray(unit.traitCounts)) unit.traitCounts = {};
    return unit.traitCounts;
  }

  function fightingSpiritCount(unit = {}) {
    return Math.max(0, intOr(unit?.traitCounts?.[COUNT_ID] ?? unit?.fightingSpiritCount, 0));
  }

  function setFightingSpiritCount(unit = {}, value = 0) {
    const next = Math.max(0, intOr(value, 0));
    ensureTraitCounts(unit)[COUNT_ID] = next;
    unit.fightingSpiritCount = next;
    return next;
  }

  function gainFightingSpirit(unit = {}, amount = 0, options = {}) {
    const profile = fightingSpiritProfile(unit);
    const gain = Math.max(0, intOr(amount, 0));
    if (!profile || !gain) return { gained: 0, count: fightingSpiritCount(unit), shieldGained: 0 };
    const count = setFightingSpiritCount(unit, fightingSpiritCount(unit) + gain);
    const shieldGained = options.grantShield === false ? 0 : gain * profile.shieldPerCountGained;
    if (shieldGained > 0) unit.shield = Math.max(0, numberOr(unit.shield, 0)) + shieldGained;
    return { gained: gain, count, shieldGained, profile };
  }

  function consumeAllFightingSpirit(unit = {}) {
    const consumed = fightingSpiritCount(unit);
    setFightingSpiritCount(unit, 0);
    return consumed;
  }

  function fightingSpiritModifiers(unit = {}) {
    const profile = fightingSpiritProfile(unit);
    const count = fightingSpiritCount(unit);
    if (!profile) return { clashPower: 0, finalPower: 0, damageDealtMultiplier: 0, count };
    return {
      count,
      clashPower: Math.min(profile.clashPowerMax, Math.floor(count / Math.max(1, profile.clashPowerPerCount))),
      finalPower: profile.finalPowerPerCount > 0 ? Math.min(profile.finalPowerMax, Math.floor(count / profile.finalPowerPerCount)) : 0,
      damageDealtMultiplier: profile.damagePercentPerCount > 0 ? (count * profile.damagePercentPerCount) / 10 : 0,
    };
  }

  function totalLevel(character = {}) {
    if (Number.isFinite(Number(character.level))) return Math.max(1, Number(character.level));
    const classes = Array.isArray(character.classes) ? character.classes : Array.isArray(character.characterBuild?.classes) ? character.characterBuild.classes : [];
    const total = classes.reduce((sum, entry) => sum + Math.max(0, numberOr(entry?.levels ?? entry?.level, 0)), 0);
    return Math.max(1, total || fighterLevel(character));
  }

  function proficiencyBonus(character = {}) {
    return Math.max(0, intOr(character.proficiency ?? character.proficiencyBonus, Math.ceil(totalLevel(character) / 20)));
  }

  function statMod(character = {}, abilityId) {
    const id = normalizeId(abilityId);
    const aliases = {
      wis: ["wis", "wisdom", "sabiduria"], wisdom: ["wis", "wisdom", "sabiduria"], sabiduria: ["wis", "wisdom", "sabiduria"],
      int: ["int", "intelligence", "inteligencia"], intelligence: ["int", "intelligence", "inteligencia"], inteligencia: ["int", "intelligence", "inteligencia"],
      cha: ["cha", "charisma", "carisma"], charisma: ["cha", "charisma", "carisma"], carisma: ["cha", "charisma", "carisma"],
    };
    const keys = aliases[id] || [id];
    const stats = character.stats || character.dndStats?.stats || {};
    let score = null;
    for (const key of keys) {
      if (Number.isFinite(Number(stats[key]))) { score = Number(stats[key]); break; }
      if (Number.isFinite(Number(character[key]))) { score = Number(character[key]); break; }
    }
    return Math.floor(((score == null ? 10 : score) - 10) / 2);
  }

  function proficiencyState(value) {
    const id = normalizeId(value);
    return ["proficient", "proficiency", "trained", "expertise", "expert"].includes(id) ? id : "none";
  }

  function hasSaveProficiency(character = {}, abilityId) {
    const id = normalizeId(abilityId);
    const aliases = id === "wis" ? ["wis", "wisdom", "sabiduria"] : id === "int" ? ["int", "intelligence", "inteligencia"] : id === "cha" ? ["cha", "charisma", "carisma"] : [id];
    const stores = [character.saveProficiency, character.savingThrowProficiency, character.savingThrowProficiencies, character.abilityProficiency, character.dndStats?.savingThrowProficiency];
    return stores.some((store) => store && typeof store === "object" && aliases.some((key) => proficiencyState(store[key]) !== "none" || store[key] === true));
  }

  function elegantCourtierChoice(character = {}) {
    const raw = character?.traitChoices?.elegant_courtier_save ?? character?.characterBuild?.traitChoices?.elegant_courtier_save ?? character?.elegantCourtierSave;
    const id = normalizeId(raw);
    return ["int", "cha"].includes(id) ? id : null;
  }

  function applyElegantCourtierSaveChoice(character = {}, abilityId) {
    const id = normalizeId(abilityId);
    if (!["int", "cha"].includes(id)) return { success: false, reason: "invalid_elegant_courtier_save_choice", options: ["int", "cha"] };
    if (!hasSamuraiLevel(character, 35)) return { success: false, reason: "elegant_courtier_locked", requiredLevel: 35 };
    if (!hasSaveProficiency(character, "wis")) return { success: false, reason: "wis_save_not_already_proficient" };
    if (!character.traitChoices || typeof character.traitChoices !== "object" || Array.isArray(character.traitChoices)) character.traitChoices = {};
    character.traitChoices.elegant_courtier_save = id;
    return { success: true, abilityId: id };
  }

  function checkKind(check = {}) {
    return normalizeId(check.kind || check.checkKind || check.type || check.rollType);
  }

  function checkAbility(check = {}) {
    return normalizeId(check.abilityId || check.statId || check.ability || check.stat || check.attribute);
  }

  function checkSkill(check = {}) {
    return normalizeId(check.skillId || check.skill || check.actionId || check.skillUsed);
  }

  function applyElegantCourtierCheck(checkInput = {}, character = {}) {
    const check = { ...(checkInput || {}) };
    if (check.__samuraiElegantCourtierAdjusted || !hasSamuraiLevel(character, 35)) return check;
    let bonus = 0;
    if (checkSkill(check) === "persuasion") bonus += statMod(character, "wis");

    if (checkKind(check) === "save") {
      const ability = checkAbility(check);
      const wisAlreadyProficient = hasSaveProficiency(character, "wis");
      const grantedAbility = wisAlreadyProficient ? elegantCourtierChoice(character) : "wis";
      if (grantedAbility && ability === grantedAbility && !hasSaveProficiency(character, grantedAbility)) {
        const current = normalizeId(character.abilityProficiency?.[ability]
          ?? character.saveProficiency?.[ability] ?? character.savingThrowProficiency?.[ability]
          ?? character.savingThrowProficiencies?.[ability]);
        const half = ["half", "half_proficiency"].includes(current) ? Math.floor(proficiencyBonus(character) / 2) : 0;
        bonus += proficiencyBonus(character) - half;
      }
    }

    check.finalPower = numberOr(check.finalPower, 0) + bonus;
    Object.defineProperty(check, "__samuraiElegantCourtierAdjusted", { value: true, enumerable: true, configurable: true });
    return check;
  }

  function unitKey(unit = {}) {
    const id = unit.id ?? unit.unitId ?? unit.characterId ?? unit.playerId ?? unit.firebaseKey;
    return id == null ? null : String(id);
  }

  function encounterState(unit = {}) {
    const key = unitKey(unit);
    const create = () => ({ rapidStrikeUsedThisTurn: false, strengthBeforeDeathUsed: false });
    if (key) {
      if (!encounterStateByKey.has(key)) encounterStateByKey.set(key, create());
      return encounterStateByKey.get(key);
    }
    if (encounterStateByObject) {
      if (!encounterStateByObject.has(unit)) encounterStateByObject.set(unit, create());
      return encounterStateByObject.get(unit);
    }
    if (!unit.__samuraiEncounterState) Object.defineProperty(unit, "__samuraiEncounterState", { value: create(), writable: true, configurable: true });
    return unit.__samuraiEncounterState;
  }

  function resetEncounterState(unit = {}) {
    const state = encounterState(unit);
    state.rapidStrikeUsedThisTurn = false;
    state.strengthBeforeDeathUsed = false;
    return state;
  }

  function resetTurnState(unit = {}) {
    const state = encounterState(unit);
    state.rapidStrikeUsedThisTurn = false;
    return state;
  }

  function tirelessEncounterStart(unit = {}) {
    if (!hasSamuraiLevel(unit, 50)) return { gained: 0, count: fightingSpiritCount(unit), shieldGained: 0 };
    return gainFightingSpirit(unit, 5);
  }

  function tirelessTurnStart(unit = {}) {
    if (!hasSamuraiLevel(unit, 50)) return { gained: 0, count: fightingSpiritCount(unit), shieldGained: 0 };
    return gainFightingSpirit(unit, 2);
  }

  function isMeleeSkill(skill = {}) {
    const family = normalizeId(skill.skillFamily || skill.family || skill.type);
    const mode = normalizeId(skill.attackMode || skill.attack_mode || skill.combatRange);
    if (skill.isMelee === true || mode === "melee") return family !== "defense";
    if (["spell", "roll", "save", "guard", "evade", "counter", "clashableguard", "clashablecounter"].includes(family)) return false;
    const range = numberOr(skill.skillRange ?? skill.range, 1);
    return range <= 1 && (family === "attack" || skill.isDefense !== true);
  }

  function rapidStrikeTier(unit = {}) {
    if (!hasSamuraiLevel(unit, 75)) return 0;
    const count = fightingSpiritCount(unit);
    if (count >= 30) return 3;
    if (count >= 20) return 2;
    if (count >= 10) return 1;
    return 0;
  }

  function tierSkills(unit = {}, tier = 0) {
    const list = unit?.[`attack_tier_${tier}_sequence`];
    return Array.isArray(list) ? list.filter(Boolean) : [];
  }

  function cloneSkill(skill = {}) {
    return {
      ...skill,
      effects: Array.isArray(skill.effects) ? [...skill.effects] : [],
      coins: Array.isArray(skill.coins) ? skill.coins.map((coin) => ({ ...coin, effects: Array.isArray(coin?.effects) ? [...coin.effects] : [] })) : skill.coins,
    };
  }

  function aliveHostiles(engine, attacker = {}) {
    const units = typeof engine?.getAllAliveUnits === "function" ? engine.getAllAliveUnits() : [];
    const faction = attacker?.faction ?? attacker?.faccion;
    return (Array.isArray(units) ? units : []).filter((unit) => {
      if (!unit || unit === attacker || numberOr(unit.hp ?? unit.currentHp, 0) <= 0) return false;
      const other = unit.faction ?? unit.faccion;
      return faction == null || other == null || other !== faction;
    });
  }

  function randomFrom(list = []) {
    if (!Array.isArray(list) || !list.length) return null;
    return list[Math.floor(Math.random() * list.length)] || null;
  }

  function executeRapidStrike(engine, attacker = {}, options = {}) {
    if (!engine || !attacker || encounterState(attacker).rapidStrikeUsedThisTurn) return null;
    const tier = rapidStrikeTier(attacker);
    if (!tier) return null;
    const skill = randomFrom(tierSkills(attacker, tier));
    const target = randomFrom(aliveHostiles(engine, attacker));
    if (!skill || !target || typeof engine.resolveUnilateralWithCounter !== "function") return null;
    encounterState(attacker).rapidStrikeUsedThisTurn = true;
    const rapidSkill = cloneSkill(skill);
    return engine.resolveUnilateralWithCounter(attacker, rapidSkill, target, null, { ...(options || {}), skipUseHooks: true, __samuraiRapidStrike: true, samuraiRapidStrikeTier: tier });
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

  function strengthBeforeDeathAvailable(unit = {}) {
    return hasSamuraiLevel(unit, 90) && fightingSpiritCount(unit) > 0 && !encounterState(unit).strengthBeforeDeathUsed;
  }

  function resolveStrengthBeforeDeath(unit = {}) {
    if (!strengthBeforeDeathAvailable(unit)) return { triggered: false, consumed: 0, healed: 0 };
    const state = encounterState(unit);
    state.strengthBeforeDeathUsed = true;
    const consumed = consumeAllFightingSpirit(unit);
    const hp = hpSnapshot(unit);
    const heal = Math.max(0, Math.floor(hp.max * consumed / 100));
    const before = Math.max(1, hp.current);
    const after = Math.min(hp.max, before + heal);
    writeHp(unit, after);
    return { triggered: true, consumed, healed: Math.max(0, after - before), before, after, max: hp.max };
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || !source?.allGrants || !source?.allArchetypes) return false;
    if (source.__samuraiArchetypeIntegrated) return true;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;
    global.LuminousArchetypeTraitCatalog = Object.freeze({
      ...source, __samuraiArchetypeIntegrated: true, SAMURAI_ID: ARCHETYPE_ID, SAMURAI_CLASS_ID: CLASS_ID,
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
        return collapseFightingSpiritProgression(character, [...byId.values()]);
      },
    });
    return true;
  }

  function patchCoreCatalog() {
    const source = global.LuminousTraitCatalogCore;
    if (!source?.allDefinitions || !source?.allGrants || source.__samuraiArchetypeIntegrated) return Boolean(source?.__samuraiArchetypeIntegrated);
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source, __samuraiArchetypeIntegrated: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS]; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__samuraiArchetypeIntegrated) return Boolean(source?.__samuraiArchetypeIntegrated);
    const originalResolve = source.resolveTraitGrants.bind(source);
    global.LuminousTraitEngine = Object.freeze({
      ...source, __samuraiArchetypeIntegrated: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const base = originalResolve(character, grants, definitions) || [];
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants ? engine.resolveTraitGrants(character, GRANTS, { ...definitions, ...DEFINITIONS }, { [ARCHETYPE_ID]: ARCHETYPE }, source) || [] : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
        return collapseFightingSpiritProgression(character, [...byId.values()]);
      },
    });
    return true;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__samuraiArchetypeIntegrated) return Boolean(source?.__samuraiArchetypeIntegrated);
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    global.LuminousArchetypeRuntime = Object.freeze({
      ...source, __samuraiArchetypeIntegrated: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const engine = global.LuminousArchetypeEngine;
        const granted = engine?.resolveTraitGrants ? engine.resolveTraitGrants(unit, GRANTS, DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || [] : [];
        const collapsed = collapseFightingSpiritProgression(unit, granted);
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isSamuraiTrait(trait)), ...collapsed].forEach((trait) => { const id = normalizeId(trait?.id || trait?.name); if (id && !byId.has(id)) byId.set(id, trait); });
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
    if (!source?.armCheck || source.__samuraiArchetypeIntegrated) return Boolean(source?.__samuraiArchetypeIntegrated);
    const originalArmCheck = source.armCheck.bind(source);
    global.LuminousTheatreRolls = Object.freeze({
      ...source, __samuraiArchetypeIntegrated: true,
      armCheck(check = {}) { return originalArmCheck(applyElegantCourtierCheck(check, currentCharacter())); },
    });
    return true;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__samuraiArchetypeIntegrated) return Boolean(engine?.__samuraiArchetypeIntegrated);

    const originalPassive = typeof engine.applyPassiveModifiers === "function" ? engine.applyPassiveModifiers : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalEncounterStart = typeof engine.triggerEncounterStart === "function" ? engine.triggerEncounterStart : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalResolveUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;

    if (originalPassive) {
      engine.applyPassiveModifiers = function (unit, contextOptions = null) {
        const base = originalPassive.call(this, unit, contextOptions) || {};
        const mods = fightingSpiritModifiers(unit);
        return {
          ...base,
          clash_power: numberOr(base.clash_power, 0) + mods.clashPower,
          final_power: numberOr(base.final_power, 0) + mods.finalPower,
          damage_dealt_multiplier: numberOr(base.damage_dealt_multiplier, 0) + mods.damageDealtMultiplier,
        };
      };
    }

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        const attacker = context?.attacker || context?.unitAttacker || null;
        if (!attacker || !hasSamuraiLevel(attacker, 15)) return result;
        const profile = fightingSpiritProfile(attacker);
        if (tag === "[On Hit]") gainFightingSpirit(attacker, profile?.onHitGain || 0);
        else if (tag === "[On Kill]") gainFightingSpirit(attacker, profile?.onKillGain || 0);
        return result;
      };
    }

    if (originalEncounterStart) {
      engine.triggerEncounterStart = function (allUnits = [], ...rest) {
        const result = originalEncounterStart.call(this, allUnits, ...rest);
        (Array.isArray(allUnits) ? allUnits : []).forEach((unit) => {
          global.LuminousArchetypeRuntime?.syncArchetypeTraitsForUnit?.(unit);
          resetEncounterState(unit);
          tirelessEncounterStart(unit);
        });
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const units = Array.isArray(allUnits) ? allUnits : [];
        units.forEach((unit) => global.LuminousArchetypeRuntime?.syncArchetypeTraitsForUnit?.(unit));
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (phaseTag === "[Round Start]") {
          units.forEach((unit) => {
            resetTurnState(unit);
            tirelessTurnStart(unit);
          });
        }
        return result;
      };
    }

    if (originalResolveUnilateral) {
      engine.resolveUnilateralWithCounter = function (attacker, skill, defender, counterSkill, options = {}) {
        const result = originalResolveUnilateral.call(this, attacker, skill, defender, counterSkill, options);
        if (!options?.__samuraiRapidStrike && attacker && isMeleeSkill(skill) && hasSamuraiLevel(attacker, 75)) executeRapidStrike(this, attacker, options);
        return result;
      };
    }

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, ...rest) {
        if (!strengthBeforeDeathAvailable(unit)) return originalApplyDamage.call(this, unit, damage, ...rest);
        const hp = hpSnapshot(unit);
        const incoming = Math.max(0, numberOr(damage, 0));
        const shield = Math.max(0, numberOr(unit?.shield, 0));
        const projectedHpLoss = Math.max(0, incoming - shield);
        if (hp.current - projectedHpLoss > 0) return originalApplyDamage.call(this, unit, damage, ...rest);

        const allowedHpLoss = Math.max(0, hp.current - 1);
        const adjustedDamage = Math.min(incoming, shield + allowedHpLoss);
        const result = originalApplyDamage.call(this, unit, adjustedDamage, ...rest);
        if (hpSnapshot(unit).current < 1) writeHp(unit, 1);
        resolveStrengthBeforeDeath(unit);
        return result;
      };
    }

    Object.defineProperty(engine, "__samuraiArchetypeIntegrated", { value: true, configurable: true });
    return true;
  }

  function watchCombatEngineAssignment() {
    if (global.CombatEngine || global.__luminousSamuraiCombatAssignmentWatch) return false;
    global.__luminousSamuraiCombatAssignmentWatch = true;
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
    ARCHETYPE_ID, ARCHETYPE_NAME, CLASS_ID, CLASS_NAME, COUNT_ID, ARCHETYPE, SOURCE, DEFINITIONS, GRANTS,
    fighterLevel, selectedSamurai, hasSamuraiLevel, traitBaseId, isSamuraiTrait, collapseFightingSpiritProgression, fightingSpiritProfile,
    fightingSpiritCount, setFightingSpiritCount, gainFightingSpirit, consumeAllFightingSpirit, fightingSpiritModifiers,
    proficiencyBonus, statMod, hasSaveProficiency, elegantCourtierChoice, applyElegantCourtierSaveChoice, applyElegantCourtierCheck,
    encounterState, resetEncounterState, resetTurnState, tirelessEncounterStart, tirelessTurnStart,
    isMeleeSkill, rapidStrikeTier, tierSkills, aliveHostiles, executeRapidStrike,
    hpSnapshot, writeHp, strengthBeforeDeathAvailable, resolveStrengthBeforeDeath,
    patchArchetypeCatalog, patchCoreCatalog, patchTraitEngine, patchArchetypeRuntime, patchTheatreRolls, patchCombatEngine, watchCombatEngineAssignment, install,
  });

  global.LuminousSamuraiArchetypeRuntime = api;
  install();
  if (global.document && global.setInterval) global.setInterval(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
