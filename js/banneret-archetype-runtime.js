(function (global) {
  "use strict";

  if (global.LuminousBanneretArchetypeRuntime) return;

  const ARCHETYPE_ID = "banneret";
  const ARCHETYPE_NAME = "Banneret / Purple Dragon Knight";
  const CLASS_ID = "fighter";
  const CLASS_NAME = "Fighter";
  const PATCH_INTERVAL_MS = 500;

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;

  const ARCHETYPE = Object.freeze({
    id: ARCHETYPE_ID,
    name: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
    unlockLevel: 15,
    traitLevels: [15, 35, 50, 75, 90],
  });

  const SOURCE = Object.freeze({
    type: "archetype",
    id: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
  });

  const DEFINITIONS = Object.freeze({
    rallying_cry: Object.freeze({
      schemaVersion: 1,
      id: "rallying_cry",
      name: "Rallying Cry",
      description: "[On Use Second Wind] Heal the 3 Allies with the lowest current HP percentage for 10% of their Max HP.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { trigger: "second_wind_used", allyCount: 3, targetPriority: "lowest_hp_percentage", healMaxHpPercent: 10 },
    }),
    royal_envoy: Object.freeze({
      schemaVersion: 1,
      id: "royal_envoy",
      name: "Royal Envoy",
      description: "Gain Proficiency on Persuasion Checks. If already Proficient, gain Expertise on Persuasion Checks instead.",
      source: SOURCE,
      contexts: ["theatre", "any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { skillId: "persuasion", grant: "proficient", upgradeExistingProficiencyTo: "expertise" },
    }),
    inspiring_surge: Object.freeze({
      schemaVersion: 1,
      id: "inspiring_surge",
      name: "Inspiring Surge",
      description: "[On Use Action Surge] The Ally with the highest Speed immediately uses a completely random offensive Skill against a random Enemy. Once per Action Surge.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { trigger: "action_surge_used", allyCount: 1, targetPriority: "highest_speed", skillSelection: "random_offensive", enemySelection: "random", replacedByTraitId: "inspiring_surge_plus" },
    }),
    bulwark: Object.freeze({
      schemaVersion: 1,
      id: "bulwark",
      name: "Bulwark",
      description: "[On Use Indomitable] The Ally with the lowest Save Check result against the same effect immediately rerolls that Save Check and uses the new result. Once per Indomitable use.",
      source: SOURCE,
      contexts: ["combat", "theatre", "any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { trigger: "indomitable_used", targetPriority: "lowest_save_check_result", sameEffectOnly: true, rerollEntireSaveCheck: true, oncePerIndomitableUse: true },
    }),
    inspiring_surge_plus: Object.freeze({
      schemaVersion: 1,
      id: "inspiring_surge_plus",
      name: "Inspiring Surge+",
      description: "Replaces Inspiring Surge. [On Use Action Surge] The 2 Allies with the highest Speed each immediately use a completely random offensive Skill against a random Enemy. Once per Action Surge.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { trigger: "action_surge_used", replacesTraitId: "inspiring_surge", allyCount: 2, targetPriority: "highest_speed", skillSelection: "random_offensive", enemySelection: "random" },
    }),
  });

  const grant = (level, traitId) => Object.freeze({
    sourceType: "archetype",
    sourceId: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    classId: CLASS_ID,
    atLevel: level,
    traitId,
    source: { ...SOURCE, atLevel: level, requiredClassLevel: level },
  });

  const GRANTS = Object.freeze([
    grant(15, "rallying_cry"),
    grant(35, "royal_envoy"),
    grant(50, "inspiring_surge"),
    grant(75, "bulwark"),
    grant(90, "inspiring_surge_plus"),
  ]);

  function fighterLevel(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.getClassLevel) return Math.max(0, intOr(engine.getClassLevel(character, CLASS_ID), 0));
    const classes = Array.isArray(character.classes) ? character.classes : Array.isArray(character.characterBuild?.classes) ? character.characterBuild.classes : [];
    const found = classes.find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === CLASS_ID);
    return Math.max(0, intOr(found?.levels ?? found?.level, 0));
  }

  function selectedBanneret(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    const raw = character.characterBuild?.archetypes ?? character.archetypes ?? [];
    const list = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return list.some((entry) => normalizeId(entry?.classId || entry?.parentClassId) === CLASS_ID && ["banneret", "purple_dragon_knight"].includes(normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id)));
  }

  function hasBanneretLevel(character = {}, level = 15) {
    return selectedBanneret(character) && fighterLevel(character) >= Number(level || 0);
  }

  function traitBaseId(trait = {}) {
    return normalizeId(trait?.baseTraitId || String(trait?.id || trait?.name || "").split("__class__")[0]);
  }

  function isBanneretTrait(trait = {}) {
    const source = trait?.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType))
      && normalizeId(source.archetypeId || source.id || trait.archetypeId) === ARCHETYPE_ID;
  }

  function collapseInspiringSurgeProgression(character = {}, traits = []) {
    if (fighterLevel(character) < 90) return traits || [];
    return (traits || []).filter((trait) => traitBaseId(trait) !== "inspiring_surge");
  }

  function hpSnapshot(unit = {}) {
    const current = numberOr(unit.hp ?? unit.currentHp ?? unit.hp_actual ?? unit.combatStats?.hp_actual, 0);
    const max = numberOr(unit.maxHp ?? unit.max_hp ?? unit.hp_max ?? unit.combatStats?.hp_max ?? unit.combatStats?.maxHp, current);
    return { current, max };
  }

  function writeHp(unit = {}, value = 0) {
    const next = Math.max(0, Math.floor(numberOr(value, 0)));
    if (Object.prototype.hasOwnProperty.call(unit, "hp")) unit.hp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "currentHp")) unit.currentHp = next;
    else if (Object.prototype.hasOwnProperty.call(unit, "hp_actual")) unit.hp_actual = next;
    else if (unit.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "hp_actual")) unit.combatStats.hp_actual = next;
    else unit.hp = next;
    return next;
  }

  function healPercent(unit = {}, percent = 0) {
    const hp = hpSnapshot(unit);
    if (hp.max <= 0) return { amount: 0, before: hp.current, after: hp.current, max: hp.max, percent };
    const requested = Math.max(0, Math.floor(hp.max * Math.max(0, numberOr(percent, 0)) / 100));
    const after = Math.min(hp.max, hp.current + requested);
    writeHp(unit, after);
    return { amount: Math.max(0, after - hp.current), before: hp.current, after, max: hp.max, requested, percent };
  }

  function unitFaction(unit = {}) {
    return unit.faction ?? unit.faccion ?? null;
  }

  function sameFaction(a = {}, b = {}) {
    const af = unitFaction(a);
    const bf = unitFaction(b);
    return af == null || bf == null ? false : af === bf;
  }

  function availableUnits(runtime = {}) {
    if (Array.isArray(runtime.combatants)) return runtime.combatants;
    if (Array.isArray(runtime.allUnits)) return runtime.allUnits;
    const engine = runtime.combatEngine || global.CombatEngine;
    if (typeof engine?.getAllAliveUnits === "function") return engine.getAllAliveUnits();
    return [];
  }

  function aliveAllies(unit = {}, runtime = {}) {
    return availableUnits(runtime).filter((other) => {
      if (!other || other === unit) return false;
      if (hpSnapshot(other).current <= 0) return false;
      return sameFaction(unit, other);
    });
  }

  function rallyingCryTargets(unit = {}, runtime = {}) {
    return aliveAllies(unit, runtime)
      .map((ally, index) => {
        const hp = hpSnapshot(ally);
        return { ally, index, ratio: hp.max > 0 ? hp.current / hp.max : 1 };
      })
      .sort((a, b) => a.ratio - b.ratio || a.index - b.index)
      .slice(0, 3)
      .map((entry) => entry.ally);
  }

  function applyRallyingCry(unit = {}, runtime = {}) {
    if (!hasBanneretLevel(unit, 15)) return { triggered: false, targets: [], heals: [] };
    const targets = rallyingCryTargets(unit, runtime);
    const heals = targets.map((ally) => ({ ally, heal: healPercent(ally, 10) }));
    return { triggered: true, targets, heals };
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

  function normalizeProficiency(value) {
    const id = normalizeId(value);
    if (["expertise", "expert"].includes(id)) return "expertise";
    if (["proficient", "proficiency", "trained"].includes(id) || value === true) return "proficient";
    if (["half", "half_proficiency"].includes(id)) return "half";
    return "none";
  }

  function persuasionProficiency(character = {}) {
    return normalizeProficiency(
      character?.skillProficiency?.persuasion
      ?? character?.dndSkills?.persuasion?.proficiency
      ?? character?.dndSkills?.persuasion?.proficiencyState
    );
  }

  function effectivePersuasionProficiency(character = {}) {
    const current = persuasionProficiency(character);
    if (!hasBanneretLevel(character, 35)) return current;
    if (current === "expertise") return "expertise";
    if (current === "proficient") return "expertise";
    return "proficient";
  }

  function proficiencyMultiplier(state) {
    return state === "expertise" ? 2 : state === "proficient" ? 1 : state === "half" ? 0.5 : 0;
  }

  function applyRoyalEnvoyCheck(checkInput = {}, character = {}) {
    const check = { ...(checkInput || {}) };
    if (check.__banneretRoyalEnvoyAdjusted || !hasBanneretLevel(character, 35)) return check;
    const skillId = normalizeId(check.skillId || check.skill || check.actionId || check.skillUsed);
    if (skillId !== "persuasion") return check;
    const before = persuasionProficiency(character);
    const after = effectivePersuasionProficiency(character);
    // Calculate from the actual rounded proficiency contributions. This
    // matters when upgrading Half Proficiency at odd proficiency bonuses.
    const bonus = Math.floor(proficiencyBonus(character) * proficiencyMultiplier(after))
      - Math.floor(proficiencyBonus(character) * proficiencyMultiplier(before));
    check.finalPower = numberOr(check.finalPower, 0) + bonus;
    check.royalEnvoyProficiency = after;
    Object.defineProperty(check, "__banneretRoyalEnvoyAdjusted", { value: true, enumerable: true, configurable: true });
    return check;
  }

  function unitSpeed(unit = {}) {
    return numberOr(unit.speed ?? unit.currentSpeed ?? unit.combatStats?.speed_actual ?? unit.combatStats?.speed, 0);
  }

  function isOffensiveSkill(skill = {}) {
    if (!skill || skill.isDefense === true) return false;
    const type = normalizeId(skill.type || skill.skillFamily || skill.family);
    return !["guard", "evade", "counter", "clashableguard", "clashablecounter", "save", "roll", "defense"].includes(type);
  }

  function offensiveSkills(unit = {}) {
    return [1, 2, 3]
      .flatMap((tier) => Array.isArray(unit?.[`attack_tier_${tier}_sequence`]) ? unit[`attack_tier_${tier}_sequence`] : [])
      .filter(isOffensiveSkill);
  }

  function randomFrom(list = [], rng = Math.random) {
    if (!Array.isArray(list) || !list.length) return null;
    const roll = Math.max(0, Math.min(0.999999999, Number(rng()) || 0));
    return list[Math.floor(roll * list.length)] || null;
  }

  function cloneSkill(skill = {}) {
    return {
      ...skill,
      effects: Array.isArray(skill.effects) ? [...skill.effects] : [],
      coins: Array.isArray(skill.coins) ? skill.coins.map((coin) => ({ ...coin, effects: Array.isArray(coin?.effects) ? [...coin.effects] : [] })) : skill.coins,
    };
  }

  function inspiringSurgeAllyCount(character = {}) {
    return hasBanneretLevel(character, 90) ? 2 : hasBanneretLevel(character, 50) ? 1 : 0;
  }

  function inspiringSurgeAllies(unit = {}, runtime = {}) {
    const count = inspiringSurgeAllyCount(unit);
    return aliveAllies(unit, runtime)
      .map((ally, index) => ({ ally, index, speed: unitSpeed(ally) }))
      .sort((a, b) => b.speed - a.speed || a.index - b.index)
      .slice(0, count)
      .map((entry) => entry.ally);
  }

  function randomEnemy(unit = {}, runtime = {}, rng = Math.random) {
    const enemies = availableUnits(runtime).filter((other) => other && other !== unit && hpSnapshot(other).current > 0 && !sameFaction(unit, other));
    return randomFrom(enemies, rng);
  }

  function executeInspiringSurge(unit = {}, runtime = {}) {
    const engine = runtime.combatEngine || global.CombatEngine;
    if (!engine || typeof engine.resolveUnilateralWithCounter !== "function") return { triggered: false, reason: "combat_resolver_unavailable", attacks: [] };
    const allies = inspiringSurgeAllies(unit, runtime);
    if (!allies.length) return { triggered: false, reason: "no_eligible_allies", attacks: [] };
    const rng = runtime.rng || Math.random;
    const attacks = [];
    for (const ally of allies) {
      const skill = randomFrom(offensiveSkills(ally), rng);
      const target = randomEnemy(unit, runtime, rng);
      if (!skill || !target) continue;
      const options = { skipUseHooks: true, __banneretInspiringSurge: true, sourceUnit: unit };
      const result = engine.resolveUnilateralWithCounter(ally, cloneSkill(skill), target, null, options);
      attacks.push({ ally, target, skillId: skill.id || skill.name || null, result });
    }
    return { triggered: attacks.length > 0, allies, attacks };
  }

  function checkIsSave(check = {}) {
    return [check.kind, check.checkType, check.type, check.category].map(normalizeId).some((id) => ["save", "save_check", "saving_throw", "savingthrow"].includes(id));
  }

  function checkCoins(check = {}) {
    if (Array.isArray(check.tosses)) return check.tosses;
    if (Array.isArray(check.coins)) return check.coins;
    return [];
  }

  function effectKey(check = {}) {
    return normalizeId(check.effectId || check.sourceEffectId || check.spellId || check.sourceSpellId || check.skillId || check.sourceSkillId || check.effect || "");
  }

  function checkNumericResult(check = {}) {
    const candidates = [check.total, check.finalTotal, check.resultTotal, check.savePower, check.power, check.heads];
    for (const value of candidates) if (Number.isFinite(Number(value))) return Number(value);
    return 0;
  }

  function alliedSaveCheckEntries(unit = {}, runtime = {}) {
    const raw = runtime.alliedSaveChecks || runtime.relatedSaveChecks || runtime.saveChecks || runtime.effectSaveChecks || [];
    if (!Array.isArray(raw)) return [];
    const currentKey = effectKey(runtime.check || {});
    return raw.map((entry) => {
      const check = entry?.check || entry?.saveCheck || entry;
      const ally = entry?.unit || entry?.ally || entry?.character || entry?.self || check?.unit || null;
      return { entry, check, ally };
    }).filter(({ check, ally }) => {
      if (!check || !checkIsSave(check) || !ally || ally === unit || !sameFaction(unit, ally)) return false;
      const otherKey = effectKey(check);
      return !currentKey || !otherKey || currentKey === otherKey;
    });
  }

  function lowestSaveCheckAlly(unit = {}, runtime = {}) {
    return alliedSaveCheckEntries(unit, runtime)
      .map((candidate, index) => ({ ...candidate, index, score: checkNumericResult(candidate.check) }))
      .sort((a, b) => a.score - b.score || a.index - b.index)[0] || null;
  }

  function rerollEntireSaveCheck(check = {}, rng = Math.random) {
    if (!checkIsSave(check)) return { success: false, reason: "save_check_required", rerolled: 0, check };
    const coins = checkCoins(check);
    if (!coins.length) return { success: false, reason: "save_check_has_no_coins", rerolled: 0, check };
    const chance = Math.max(0, Math.min(100, numberOr(check.headsChance, 50)));
    coins.forEach((coin) => {
      const side = global.LuminousCoinEngine?.rollSide
        ? global.LuminousCoinEngine.rollSide(chance, rng)
        : (Number(rng()) * 100 < chance ? "head" : "tail");
      coin.side = side;
      if (Object.prototype.hasOwnProperty.call(coin, "success")) coin.success = side === "head";
      if (Object.prototype.hasOwnProperty.call(coin, "passed")) coin.passed = side === "head";
      coin.rerolledBy = "bulwark";
    });
    const heads = coins.filter((coin) => normalizeId(coin?.side) === "head").length;
    check.heads = heads;
    check.bulwarkReroll = { rerolled: coins.length };
    check.needsOutcomeRecalculation = true;
    return { success: true, rerolled: coins.length, heads, check };
  }

  function applyBulwark(unit = {}, runtime = {}) {
    if (!hasBanneretLevel(unit, 75)) return { triggered: false, reason: "bulwark_locked" };
    const target = lowestSaveCheckAlly(unit, runtime);
    if (!target) return { triggered: false, reason: "no_related_ally_save_check" };
    const reroll = rerollEntireSaveCheck(target.check, runtime.rng || Math.random);
    return { triggered: reroll.success, ally: target.ally, scoreBefore: target.score, reroll };
  }

  function resultHasOutcome(result = {}, type) {
    return Array.isArray(result.outcomes) && result.outcomes.some((outcome) => outcome?.type === type);
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || !source?.allGrants || !source?.allArchetypes) return false;
    if (source.__banneretArchetypeIntegrated) return true;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;
    global.LuminousArchetypeTraitCatalog = Object.freeze({
      ...source,
      __banneretArchetypeIntegrated: true,
      BANNERET_ID: ARCHETYPE_ID,
      BANNERET_CLASS_ID: CLASS_ID,
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
        const extra = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(character, GRANTS, definitions ? { ...definitions, ...DEFINITIONS } : DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || []
          : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        return collapseInspiringSurgeProgression(character, [...byId.values()]);
      },
    });
    return true;
  }

  function patchCoreCatalog() {
    const source = global.LuminousTraitCatalogCore;
    if (!source?.allDefinitions || !source?.allGrants || source.__banneretArchetypeIntegrated) return Boolean(source?.__banneretArchetypeIntegrated);
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __banneretArchetypeIntegrated: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS]; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__banneretArchetypeIntegrated) return Boolean(source?.__banneretArchetypeIntegrated);
    const originalResolve = source.resolveTraitGrants.bind(source);
    const originalActivate = typeof source.activateTrait === "function" ? source.activateTrait.bind(source) : null;
    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __banneretArchetypeIntegrated: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const base = originalResolve(character, grants, definitions) || [];
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(character, GRANTS, { ...definitions, ...DEFINITIONS }, { [ARCHETYPE_ID]: ARCHETYPE }, source) || []
          : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        return collapseInspiringSurgeProgression(character, [...byId.values()]);
      },
      activateTrait(traitInput, runtime = {}, state) {
        if (!originalActivate) return { available: false, reasons: ["Trait Engine activation is unavailable."], trait: traitInput, runtime, state, outcomes: [] };
        const result = originalActivate(traitInput, runtime, state);
        if (!result?.available || result?.scheduled) return result;
        const unit = runtime.self || runtime.character || null;
        if (!unit || !selectedBanneret(unit)) return result;
        const outcomes = [...(result.outcomes || [])];

        if (resultHasOutcome(result, "fighter_second_wind_used") && hasBanneretLevel(unit, 15)) {
          outcomes.push({ type: "banneret_rallying_cry", traitId: "rallying_cry", ...applyRallyingCry(unit, runtime) });
        }
        if (resultHasOutcome(result, "fighter_action_surge") && hasBanneretLevel(unit, 50)) {
          outcomes.push({ type: "banneret_inspiring_surge", traitId: hasBanneretLevel(unit, 90) ? "inspiring_surge_plus" : "inspiring_surge", ...executeInspiringSurge(unit, runtime) });
        }
        if (resultHasOutcome(result, "fighter_indomitable") && hasBanneretLevel(unit, 75)) {
          outcomes.push({ type: "banneret_bulwark", traitId: "bulwark", ...applyBulwark(unit, runtime) });
        }
        return { ...result, outcomes };
      },
    });
    return true;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__banneretArchetypeIntegrated) return Boolean(source?.__banneretArchetypeIntegrated);
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    global.LuminousArchetypeRuntime = Object.freeze({
      ...source,
      __banneretArchetypeIntegrated: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const engine = global.LuminousArchetypeEngine;
        const granted = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(unit, GRANTS, DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || []
          : [];
        const collapsed = collapseInspiringSurgeProgression(unit, granted);
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isBanneretTrait(trait)), ...collapsed].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
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
    if (!source?.armCheck || source.__banneretArchetypeIntegrated) return Boolean(source?.__banneretArchetypeIntegrated);
    const originalArmCheck = source.armCheck.bind(source);
    global.LuminousTheatreRolls = Object.freeze({
      ...source,
      __banneretArchetypeIntegrated: true,
      armCheck(check = {}) {
        return originalArmCheck(applyRoyalEnvoyCheck(check, currentCharacter()));
      },
    });
    return true;
  }

  function install() {
    patchArchetypeCatalog();
    patchCoreCatalog();
    patchTraitEngine();
    patchArchetypeRuntime();
    patchTheatreRolls();
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID,
    ARCHETYPE_NAME,
    CLASS_ID,
    CLASS_NAME,
    ARCHETYPE,
    SOURCE,
    DEFINITIONS,
    GRANTS,
    fighterLevel,
    selectedBanneret,
    hasBanneretLevel,
    traitBaseId,
    isBanneretTrait,
    collapseInspiringSurgeProgression,
    hpSnapshot,
    writeHp,
    healPercent,
    availableUnits,
    aliveAllies,
    rallyingCryTargets,
    applyRallyingCry,
    proficiencyBonus,
    persuasionProficiency,
    effectivePersuasionProficiency,
    applyRoyalEnvoyCheck,
    unitSpeed,
    isOffensiveSkill,
    offensiveSkills,
    inspiringSurgeAllyCount,
    inspiringSurgeAllies,
    randomEnemy,
    executeInspiringSurge,
    checkIsSave,
    checkCoins,
    effectKey,
    checkNumericResult,
    alliedSaveCheckEntries,
    lowestSaveCheckAlly,
    rerollEntireSaveCheck,
    applyBulwark,
    resultHasOutcome,
    patchArchetypeCatalog,
    patchCoreCatalog,
    patchTraitEngine,
    patchArchetypeRuntime,
    patchTheatreRolls,
    install,
  });

  global.LuminousBanneretArchetypeRuntime = api;
  install();
  if (global.document && global.setInterval) global.setInterval(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
