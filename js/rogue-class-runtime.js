(function (global) {
  "use strict";

  const CLASS_ID = "rogue";
  const CLASS_NAME = "Rogue";
  const CATALOG_VERSION = 5;
  const ABILITY_IDS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
  const LANGUAGE_ID = "thieves_cant";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const ROGUE_SOURCE = Object.freeze({ type: "class", id: CLASS_ID, classId: CLASS_ID, className: CLASS_NAME });
  const THIEVES_CANT_DEFINITION = Object.freeze({
    nombre: "Thieves' Cant",
    sistema: "dnd",
    tipo: "class_language",
    classRestricted: true,
    requiredClassId: CLASS_ID,
    requiredClassLevel: 1,
    estilo_ofuscacion: "ellipsis",
  });

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const ROGUE_DEFINITIONS = deepFreeze({
    rogue_expertise: {
      schemaVersion: 1,
      id: "rogue_expertise",
      name: "Expertise",
      description: "Choose 2 proficient Abilities/Skills to gain Expertise. At Rogue level 30 choose 2 additional proficiencies.",
      source: ROGUE_SOURCE,
      contexts: ["theatre", "any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [], rules: [],
      mechanics: { instancePerSource: true, expertise: { abilityChoices: 2, additionalAtSourceClassLevel: { level: 30, abilityChoices: 2 } } },
    },
    sneak_attack: {
      schemaVersion: 1, id: "sneak_attack", name: "Sneak Attack",
      description: "Deal +max(1, floor(Rogue Class Level / 2))% Damage with Melee and Range Unopposed Attacks. Does not apply to Spells.",
      source: ROGUE_SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { unopposedDamagePercentFormula: "max(1, floor(ClassLevel / 2))", attackKinds: ["melee", "range"], excludesSpells: true },
    },
    thieves_cant: {
      schemaVersion: 1, id: "thieves_cant", name: "Thieves' Cant",
      description: "Unlock Thieves' Cant as a Rogue-only language.", source: ROGUE_SOURCE, contexts: ["theatre", "any"],
      activation: { type: "passive", actionCost: "none" }, effects: [], rules: [], mechanics: { languageGrant: LANGUAGE_ID, classRestricted: true },
    },
    cunning_action: {
      schemaVersion: 1, id: "cunning_action", name: "Cunning Action",
      description: "Gain +max(1, floor(Rogue Class Level / 20)) Max Speed, +max(1, floor(Rogue Class Level / 10)) Defense Power, and use a Quick Action to Retreat.",
      source: ROGUE_SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [], mechanics: { quickRetreat: true },
    },
    uncanny_dodge: {
      schemaVersion: 1, id: "uncanny_dodge", name: "Uncanny Dodge",
      description: "Reaction [Before Getting]: take 50% less damage from the next Skill.", source: ROGUE_SOURCE, contexts: ["combat"],
      activation: { type: "manual", actionCost: "reaction", trigger: "before_getting" }, effects: [], rules: [], mechanics: { nextSkillDamageMultiplier: 0.5 },
    },
    nimble_reflexes: {
      schemaVersion: 1, id: "nimble_reflexes", name: "Nimble Reflexes",
      description: "[On Evaded] recover 2 SP. Take 25% less damage when you are a secondary target of a Skill/Spell with 2+ ATK Weight.",
      source: ROGUE_SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { recoverSpOnEvaded: 2, secondaryTargetDamageMultiplier: 0.75, minimumAttackWeight: 2 },
    },
    reliable_talent: {
      schemaVersion: 1, id: "reliable_talent", name: "Reliable Talent",
      description: "When making a Check with a Proficient Skill gain +3 Final Power.", source: ROGUE_SOURCE, contexts: ["theatre"],
      activation: { type: "passive", actionCost: "none" }, effects: [], rules: [], mechanics: { proficientCheckFinalPower: 3 },
    },
    blindsense: {
      schemaVersion: 1, id: "blindsense", name: "Blindsense",
      description: "Invisible targets do not gain Invisible-derived buffs against you.", source: ROGUE_SOURCE, contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" }, effects: [], rules: [], mechanics: { suppressInvisibleBuffsAgainstSelf: true },
    },
    slippery_mind: {
      schemaVersion: 1, id: "slippery_mind", name: "Slippery Mind",
      description: "Gain +6 Final Save Power against Frightened/Charmed-inducing Skills, Spells and Traits; take 30% less Sinking damage; reduce SP loss by 3.",
      source: ROGUE_SOURCE, contexts: ["combat", "theatre"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { finalSavePower: 6, saveAgainst: ["frightened", "charmed"], sinkingDamageMultiplier: 0.7, spLossReduction: 3 },
    },
    elusive: {
      schemaVersion: 1, id: "elusive", name: "Elusive",
      description: "Gain +15 Evade Power against Units with Positive Status effects. Gain Clash Power equal to the enemy's Power Buff.",
      source: ROGUE_SOURCE, contexts: ["combat"], activation: { type: "passive", actionCost: "none" }, effects: [], rules: [],
      mechanics: { evadePowerVsPositiveStatus: 15, mirrorEnemyPowerBuffAsClashPower: true },
    },
    stroke_of_luck: {
      schemaVersion: 1, id: "stroke_of_luck", name: "Stroke of Luck",
      description: "Repeat a Failed Check once. Gain +5% Heads Probability.", source: ROGUE_SOURCE, contexts: ["combat", "theatre"],
      activation: { type: "passive", actionCost: "none" }, effects: [], rules: [], mechanics: { repeatFailedCheckOnce: true, headsProbabilityBonus: 0.05 },
    },
  });

  const rogueGrant = (level, traitId) => ({
    id: `core_class_rogue_l${level}_${traitId}`,
    sourceType: "class", sourceId: CLASS_ID,
    source: { className: CLASS_NAME, atLevel: level, requiredClassLevel: level },
    atLevel: level, traitId, grantType: "trait", multiclassPolicy: "allowed",
  });

  const ROGUE_GRANTS = deepFreeze([
    rogueGrant(1, "rogue_expertise"), rogueGrant(1, "sneak_attack"), rogueGrant(1, "thieves_cant"),
    rogueGrant(10, "cunning_action"), rogueGrant(25, "uncanny_dodge"), rogueGrant(35, "nimble_reflexes"),
    rogueGrant(55, "reliable_talent"), rogueGrant(70, "blindsense"), rogueGrant(75, "slippery_mind"),
    rogueGrant(90, "elusive"), rogueGrant(100, "stroke_of_luck"),
  ]);

  function classEntries(character = {}) {
    const candidates = [character.classes, character.characterBuild?.classes, character.dnd?.classes, character.classLevels];
    for (const value of candidates) {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return Object.entries(value).map(([id, entry]) => typeof entry === "object" ? { id, ...entry } : { id, level: entry });
    }
    return [];
  }

  function getClassLevel(character = {}, classId = CLASS_ID, engine = global.LuminousTraitEngine) {
    if (engine?.getClassLevel) {
      const viaEngine = Number(engine.getClassLevel(character, classId));
      if (Number.isFinite(viaEngine)) return Math.max(0, Math.trunc(viaEngine));
    }
    const id = normalizeId(classId);
    const found = classEntries(character).find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === id);
    if (found) return Math.max(0, intOr(found.levels ?? found.level ?? found.classLevel, 0));
    const direct = character?.[`${id}Level`] ?? character?.classLevel?.[id];
    return Math.max(0, intOr(direct, 0));
  }

  function rogueLevel(character = {}, engine) { return getClassLevel(character, CLASS_ID, engine); }
  function activeAt(character, level, engine) { return rogueLevel(character, engine) >= level; }

  function proficiencyState(character = {}, check = {}) {
    const explicit = normalizeId(check.proficiencyState || check.profState || check.proficiency || "");
    if (["none", "half", "proficient", "expertise"].includes(explicit)) return explicit;
    const skillId = normalizeId(check.skillId || check.skill || "");
    const abilityId = normalizeId(check.abilityId || check.statId || check.ability || "");
    if (skillId) {
      const map = character.skillProficiency || character.skillProficiencies || character.dndSkillProficiency || {};
      const nested = character.dndSkills?.[skillId];
      const value = normalizeId(map?.[skillId] ?? nested?.proficiency ?? nested?.proficiencyState ?? "none");
      if (value) return value;
    }
    if (abilityId) {
      const value = normalizeId(character.abilityProficiency?.[abilityId] ?? character.abilityProficiencies?.[abilityId] ?? "none");
      if (value) return value;
    }
    return "none";
  }

  function expertiseChoiceCount(character = {}, engine) { return activeAt(character, 30, engine) ? 4 : activeAt(character, 1, engine) ? 2 : 0; }

  function applyExpertiseChoices(character = {}, abilityIds = [], engine) {
    const allowedCount = expertiseChoiceCount(character, engine);
    const choices = [...new Set((abilityIds || []).map(normalizeId).filter(Boolean))];
    if (choices.length > allowedCount) return { success: false, reason: `Expertise allows ${allowedCount} choices.`, allowedCount, choices };
    if (!character.abilityProficiency || typeof character.abilityProficiency !== "object" || Array.isArray(character.abilityProficiency)) character.abilityProficiency = {};
    if (!character.skillProficiency || typeof character.skillProficiency !== "object" || Array.isArray(character.skillProficiency)) character.skillProficiency = {};
    choices.forEach((id) => {
      if (ABILITY_IDS.includes(id)) character.abilityProficiency[id] = "expertise";
      else character.skillProficiency[id] = "expertise";
    });
    if (!character.traitChoices || typeof character.traitChoices !== "object" || Array.isArray(character.traitChoices)) character.traitChoices = {};
    character.traitChoices.rogue_expertise = { abilities: choices, sourceClassId: CLASS_ID };
    return { success: true, allowedCount, choices, remainingChoices: Math.max(0, allowedCount - choices.length) };
  }

  function attackKind(skill = {}) {
    const values = [skill.attackKind, skill.attack_kind, skill.rangeType, skill.range_type, skill.type, skill.skillType, skill.skill_type].map(normalizeId);
    if (values.some((id) => ["melee", "close", "close_range", "melee_attack"].includes(id))) return "melee";
    if (values.some((id) => ["range", "ranged", "ranged_attack", "long_range"].includes(id))) return "range";
    return "";
  }

  function isSpellSkill(skill = {}) {
    if (skill.isSpell === true || skill.spell === true) return true;
    return [skill.type, skill.skillType, skill.skill_type, skill.sourceType, skill.source_type, skill.category].map(normalizeId).some((id) => id === "spell" || id.includes("spell"));
  }

  function sneakAttackPercent(character = {}, engine) {
    const level = rogueLevel(character, engine);
    return level >= 1 ? Math.max(1, Math.floor(level / 2)) : 0;
  }

  function applySneakAttackDamage(baseDamage, input = {}) {
    const amount = Math.max(0, numberOr(baseDamage, 0));
    const character = input.character || input.attacker || {};
    const skill = input.skill || input.attackSkill || {};
    const unopposed = input.unopposed === true || input.clashMetadata?.unopposed === true || input.context?.unopposed === true;
    const kind = attackKind(skill);
    if (!activeAt(character, 1, input.engine) || !unopposed || isSpellSkill(skill) || !["melee", "range"].includes(kind)) return amount;
    return amount * (1 + sneakAttackPercent(character, input.engine) / 100);
  }

  function cunningActionBonuses(character = {}, engine) {
    const level = rogueLevel(character, engine);
    if (level < 10) return { maxSpeed: 0, defensePower: 0 };
    return { maxSpeed: Math.max(1, Math.floor(level / 20)), defensePower: Math.max(1, Math.floor(level / 10)) };
  }

  function useQuickRetreat(character = {}, options = {}) {
    if (!activeAt(character, 10, options.engine)) return { success: false, reason: "cunning_action_locked" };
    const economy = options.actionEconomy || global.LuminousActionEconomy;
    const phaseOptions = { ...(options.actionOptions || {}), phase: options.phase || "planning" };
    if (economy?.consume && !economy.consume(character, "quick_action", phaseOptions)) return { success: false, reason: "quick_action_unavailable" };
    if (typeof options.retreat === "function") options.retreat(character, options);
    if (typeof global.CustomEvent === "function" && global.document?.dispatchEvent) global.document.dispatchEvent(new global.CustomEvent("luminous:rogue-retreat", { detail: { character, sourceTraitId: "cunning_action" } }));
    return { success: true, actionCost: "quick_action", action: "retreat" };
  }

  const UNCANNY_KEY = "__luminousRogueUncannyDodge";
  function armUncannyDodge(character = {}, options = {}) {
    if (!activeAt(character, 25, options.engine)) return { success: false, reason: "uncanny_dodge_locked" };
    const economy = options.actionEconomy || global.LuminousActionEconomy;
    const phaseOptions = { ...(options.actionOptions || {}), phase: options.phase || "combat" };
    if (options.consumeReaction !== false && economy?.consume && !economy.consume(character, "reaction", phaseOptions)) return { success: false, reason: "reaction_unavailable" };
    character[UNCANNY_KEY] = true;
    return { success: true, armed: true };
  }

  function consumeUncannyDodge(character = {}) {
    if (!character?.[UNCANNY_KEY]) return false;
    character[UNCANNY_KEY] = false;
    return true;
  }

  function incomingSkillMultiplier(character = {}, context = {}) {
    let multiplier = 1;
    const consumedUncanny = activeAt(character, 25, context.engine) && consumeUncannyDodge(character);
    if (consumedUncanny) multiplier *= 0.5;
    if (activeAt(character, 35, context.engine) && context.isSecondaryTarget === true && numberOr(context.attackWeight, 1) >= 2) multiplier *= 0.75;
    if (activeAt(character, 75, context.engine) && normalizeId(context.damageType || context.statusId || context.damageSource) === "sinking") multiplier *= 0.7;
    return { multiplier, consumedUncanny };
  }

  function applyIncomingSkillDamage(character = {}, damage, context = {}) {
    const result = incomingSkillMultiplier(character, context);
    return { damage: Math.max(0, numberOr(damage, 0)) * result.multiplier, ...result };
  }

  function readSp(character = {}) {
    const keys = ["sp", "sanity", "currentSp", "currentSP"];
    for (const key of keys) if (Number.isFinite(Number(character?.[key]))) return { owner: character, key, value: Number(character[key]) };
    if (character.combatStats) for (const key of keys) if (Number.isFinite(Number(character.combatStats[key]))) return { owner: character.combatStats, key, value: Number(character.combatStats[key]) };
    return { owner: character, key: "sp", value: 0 };
  }

  function onEvaded(character = {}, options = {}) {
    if (!activeAt(character, 35, options.engine)) return { recovered: 0 };
    const rec = readSp(character);
    const maxSp = Number.isFinite(Number(character.maxSp ?? character.maxSP ?? character.combatStats?.maxSp ?? character.combatStats?.maxSP)) ? Number(character.maxSp ?? character.maxSP ?? character.combatStats?.maxSp ?? character.combatStats?.maxSP) : 45;
    const before = rec.value;
    rec.owner[rec.key] = Math.min(maxSp, before + 2);
    return { recovered: rec.owner[rec.key] - before, before, after: rec.owner[rec.key] };
  }

  function reduceSpLoss(character = {}, loss, engine) {
    const amount = Math.max(0, numberOr(loss, 0));
    return activeAt(character, 75, engine) ? Math.max(0, amount - 3) : amount;
  }

  function reliableTalentFinalPower(character = {}, check = {}, engine) {
    if (!activeAt(character, 55, engine)) return 0;
    const state = proficiencyState(character, check);
    return ["proficient", "expertise"].includes(state) ? 3 : 0;
  }

  function finalSavePowerBonus(character = {}, effect = {}, engine) {
    if (!activeAt(character, 75, engine)) return 0;
    const values = [effect.statusId, effect.conditionId, effect.effectId, effect.inflicts, effect.status, ...(Array.isArray(effect.statuses) ? effect.statuses : [])].map(normalizeId);
    return values.some((id) => id.includes("fright") || id.includes("charm")) ? 6 : 0;
  }

  function hasPositiveStatus(unit = {}) {
    if (unit.hasPositiveStatus === true) return true;
    const stores = [unit.positiveStatuses, unit.positiveStatusEffects, unit.buffs, unit.statusEffects, unit.statuses];
    return stores.some((store) => {
      if (Array.isArray(store)) return store.some((entry) => entry?.positive === true || normalizeId(entry?.polarity || entry?.type) === "positive");
      if (store && typeof store === "object") return Object.values(store).some((entry) => entry?.positive === true || normalizeId(entry?.polarity || entry?.type) === "positive");
      return false;
    });
  }

  function enemyPowerBuff(unit = {}) {
    const explicit = [unit.powerBuff, unit.power_buff, unit.bonusPower, unit.bonus_power, unit.combatStats?.powerBuff].map(Number).find(Number.isFinite);
    if (Number.isFinite(explicit)) return Math.max(0, explicit);
    const stores = [unit.buffs, unit.statusEffects, unit.statuses];
    let total = 0;
    stores.forEach((store) => {
      const entries = Array.isArray(store) ? store : Object.values(store || {});
      entries.forEach((entry) => {
        if (!entry || normalizeId(entry.stat || entry.statId || entry.effect) !== "power") return;
        total += Math.max(0, numberOr(entry.amount ?? entry.value ?? entry.potency, 0));
      });
    });
    return total;
  }

  function blindsenseSuppressesInvisibleBuffs(character = {}, source = {}, engine) {
    if (!activeAt(character, 70, engine)) return false;
    return source.invisible === true || source.isInvisible === true || Boolean(source.statusEffects?.invisible || source.statuses?.invisible);
  }

  function elusiveEvadePower(character = {}, enemy = {}, engine) { return activeAt(character, 90, engine) && hasPositiveStatus(enemy) ? 15 : 0; }
  function elusiveClashPower(character = {}, enemy = {}, engine) { return activeAt(character, 90, engine) ? enemyPowerBuff(enemy) : 0; }
  function headsProbabilityBonus(character = {}, engine) { return activeAt(character, 100, engine) ? 0.05 : 0; }
  function hasThievesCant(character = {}, engine) { return activeAt(character, 1, engine); }

  function isFailedCheck(result) {
    if (!result) return false;
    if (result.success === false || result.passed === false || result.failed === true) return true;
    const value = normalizeId(result.outcome || result.result || result.status);
    return ["fail", "failed", "failure"].includes(value);
  }

  function resolveTheatreCheck(character = {}, check = {}, attempt, options = {}) {
    if (typeof attempt !== "function") throw new TypeError("attempt must be a function");
    const finalPowerBonus = reliableTalentFinalPower(character, check, options.engine);
    const headsBonus = headsProbabilityBonus(character, options.engine);
    const context = { ...check, finalPowerBonus: numberOr(check.finalPowerBonus, 0) + finalPowerBonus, headsProbabilityBonus: numberOr(check.headsProbabilityBonus, 0) + headsBonus };
    const first = attempt(context, { attempt: 1, strokeOfLuck: false });
    const retry = (result) => {
      if (!activeAt(character, 100, options.engine) || !isFailedCheck(result)) return { result, attempts: 1, retried: false, context };
      const second = attempt({ ...context, strokeOfLuckRetry: true }, { attempt: 2, strokeOfLuck: true });
      if (second && typeof second.then === "function") return second.then((value) => ({ result: value, attempts: 2, retried: true, context }));
      return { result: second, attempts: 2, retried: true, context };
    };
    if (first && typeof first.then === "function") return first.then(retry);
    return retry(first);
  }

  function ensureThievesCantOnCharacter(character = {}, engine) {
    if (!hasThievesCant(character, engine)) return false;
    if (!character.languages || typeof character.languages !== "object") character.languages = {};
    const current = character.languages[LANGUAGE_ID];
    if (typeof current === "number") character.languages[LANGUAGE_ID] = Math.max(100, current);
    else character.languages[LANGUAGE_ID] = { ...(current && typeof current === "object" ? current : {}), habla: true, entiende: true, porcentaje: 100, classGranted: true };
    return true;
  }

  function wrapCatalog() {
    const source = global.LuminousTraitCatalogCore || (typeof require === "function" ? require("./trait-catalog-core.js") : null);
    if (!source || source.__rogueClassCatalogExtended) return Boolean(source);
    const baseDefinitions = source.allDefinitions?.bind(source) || (() => clone(source.DEFINITIONS || {}));
    const baseGrants = source.allGrants?.bind(source) || (() => clone(source.GRANTS || []));
    const baseGet = source.getDefinition?.bind(source) || (() => null);
    const allDefinitions = () => ({ ...baseDefinitions(), ...clone(ROGUE_DEFINITIONS) });
    const allGrants = () => [...baseGrants(), ...clone(ROGUE_GRANTS)];
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source, __rogueClassCatalogExtended: true,
      CATALOG_VERSION: Math.max(CATALOG_VERSION, Number(source.CATALOG_VERSION || 0)),
      DEFINITIONS: deepFreeze({ ...(source.DEFINITIONS || baseDefinitions()), ...clone(ROGUE_DEFINITIONS) }),
      GRANTS: deepFreeze([...(source.GRANTS || baseGrants()), ...clone(ROGUE_GRANTS)]),
      allDefinitions, allGrants,
      getDefinition(id) { return clone(ROGUE_DEFINITIONS[normalizeId(id)] || baseGet(id)); },
    });
    return true;
  }

  function wrapTraitEngine() {
    const source = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
    if (!source || source.__rogueClassRuntimeWrapped) return Boolean(source);
    const originalResolveTheatreCheck = source.resolveTheatreCheck?.bind(source);
    const originalActivateTrait = source.activateTrait?.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __rogueClassRuntimeWrapped: true,
      resolveTheatreCheck(input = {}) {
        const result = originalResolveTheatreCheck ? originalResolveTheatreCheck(input) : { check: { ...(input.check || {}) }, state: input.state, outcomes: [] };
        const character = input.character || input.self || {};
        const bonus = reliableTalentFinalPower(character, result.check || input.check || {}, source);
        result.check = { ...(result.check || input.check || {}), finalPowerBonus: numberOr(result.check?.finalPowerBonus, 0) + bonus };
        if (bonus) result.outcomes = [...(result.outcomes || []), { type: "rogue_reliable_talent", traitId: "reliable_talent", finalPowerBonus: bonus }];
        return result;
      },
      activateTrait(trait, runtime = {}, state) {
        const result = originalActivateTrait ? originalActivateTrait(trait, runtime, state) : { available: true, trait, runtime, outcomes: [] };
        const id = normalizeId(result?.trait?.id || trait?.id || trait?.name);
        if (id === "uncanny_dodge" && result?.available !== false) {
          const character = result.runtime?.self || result.runtime?.character || runtime.self || runtime.character || {};
          const armed = armUncannyDodge(character, { engine: source, consumeReaction: false });
          result.outcomes = [...(result.outcomes || []), { type: "rogue_uncanny_dodge_armed", traitId: "uncanny_dodge", ...armed }];
        }
        return result;
      },
    });
    global.LuminousTraitEngine = wrapped;
    return true;
  }

  function install() {
    const catalogReady = wrapCatalog();
    const engineReady = wrapTraitEngine();
    const character = global.datosJugador || global.currentCharacter || null;
    if (character) ensureThievesCantOnCharacter(character);
    return catalogReady && engineReady;
  }

  const api = Object.freeze({
    CLASS_ID, CLASS_NAME, CATALOG_VERSION, LANGUAGE_ID, THIEVES_CANT_DEFINITION, ROGUE_DEFINITIONS, ROGUE_GRANTS,
    install, wrapCatalog, wrapTraitEngine, getClassLevel, rogueLevel, proficiencyState, expertiseChoiceCount, applyExpertiseChoices,
    attackKind, isSpellSkill, sneakAttackPercent, applySneakAttackDamage, cunningActionBonuses, useQuickRetreat,
    armUncannyDodge, consumeUncannyDodge, incomingSkillMultiplier, applyIncomingSkillDamage, onEvaded, reduceSpLoss,
    reliableTalentFinalPower, finalSavePowerBonus, blindsenseSuppressesInvisibleBuffs, hasPositiveStatus, enemyPowerBuff,
    elusiveEvadePower, elusiveClashPower, headsProbabilityBonus, hasThievesCant, ensureThievesCantOnCharacter,
    isFailedCheck, resolveTheatreCheck,
  });

  global.LuminousRogueClassRuntime = api;
  install();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global.document && global.setInterval) global.setInterval(install, 800);
})(typeof window !== "undefined" ? window : globalThis);
