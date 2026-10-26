(function (global) {
  "use strict";

  if (global.LuminousOroshLineageRuntime) return;

  const ARCHETYPE_ID = "orosh_lineage";
  const CLASS_ID = "sorcerer";
  const PATCH_INTERVAL_MS = 250;

  const TRAITS = Object.freeze({
    TERMOSENSE: "orosh_lineage_termosense",
    EMOTIONAL_ECHO: "orosh_lineage_emotional_echo",
    FRAGMENTED_BLESSING: "orosh_lineage_fragmented_blessing",
    PRIMORDIAL_BOND: "orosh_lineage_primordial_bond",
    VOICE_OF_THE_FIRST: "orosh_lineage_voice_of_the_first",
    ASCENSION: "orosh_lineage_ascension_of_the_heiress",
  });

  const SIN_ALIASES = Object.freeze({
    wrath: "wrath", ira: "wrath",
    envy: "envy", envidia: "envy",
    gloom: "gloom", melancolia: "gloom",
    pride: "pride", orgullo: "pride",
    gluttony: "gluttony", gula: "gluttony",
    lust: "lust", lujuria: "lust",
    sloth: "sloth", pereza: "sloth",
  });

  const FRAGMENTS = Object.freeze({
    wrath: Object.freeze(["strength", "fuerza", "intimidation", "intimidacion"]),
    envy: Object.freeze(["deception", "engano", "stealth", "sigilo"]),
    gloom: Object.freeze(["insight", "perspicacia", "history", "historia"]),
    pride: Object.freeze(["charisma", "carisma", "persuasion", "persuasion"]),
    gluttony: Object.freeze(["investigation", "investigacion", "perception", "percepcion"]),
    lust: Object.freeze(["arcana", "arcanos", "religion"]),
    sloth: Object.freeze(["nature", "naturaleza", "survival", "supervivencia"]),
  });

  const TARGETING_IGNORES = Object.freeze(new Set([
    "normal_darkness",
    "magical_darkness",
    "visual_camouflage",
  ]));

  const state = {
    traitEngineSource: null,
    combatEngineSource: null,
    listenersBound: false,
    byIdentity: new Map(),
    byObject: typeof WeakMap === "function" ? new WeakMap() : null,
  };

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function numberOr(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Number(value) : fallback;
  }

  function emit(name, detail) {
    if (typeof global.CustomEvent !== "function") return;
    global.dispatchEvent?.(new global.CustomEvent(name, { detail }));
  }

  function currentCharacter() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
  }

  function identityValues(entity = {}) {
    return [
      entity.id,
      entity.playerId,
      entity.player_id,
      entity.characterId,
      entity.character_id,
      entity.combatId,
      entity.combat_id,
      entity.unitId,
      entity.unit_id,
      entity.actorId,
      entity.actor_id,
      entity.uid,
      entity.vinculo_jugador,
    ]
      .filter((value) => value != null && String(value).trim() !== "")
      .map((value) => String(value).trim());
  }

  function entityName(entity = {}) {
    return normalizeId(entity.characterName || entity.character_name || entity.nombre || entity.name || "");
  }

  function sameEntity(left, right) {
    if (!left || !right) return false;
    if (left === right) return true;

    const leftIds = new Set(identityValues(left));
    if (identityValues(right).some((id) => leftIds.has(id))) return true;

    const leftName = entityName(left);
    return Boolean(leftName && leftName === entityName(right));
  }

  function characterFor(entity = null) {
    const player = currentCharacter();
    if (player && entity && sameEntity(player, entity)) {
      // The player record is canonical for archetype/class/state identity while
      // the combat unit still contributes runtime-only fields.
      return {
        ...entity,
        ...player,
        characterBuild: player.characterBuild || entity.characterBuild || {},
      };
    }
    return entity || player || {};
  }

  function classEntries(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object"
      ? character.characterBuild
      : {};
    const source = Array.isArray(character.classes)
      ? character.classes
      : (Array.isArray(build.classes) ? build.classes : []);
    return source.filter((entry) => entry && typeof entry === "object");
  }

  function selectedByFallback(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object"
      ? character.characterBuild
      : {};

    const direct = [
      character.archetypeId,
      character.subclassId,
      character.lineageId,
      build.archetypeId,
      build.subclassId,
      build.lineageId,
    ].map(normalizeId);
    if (direct.includes(ARCHETYPE_ID)) return true;

    const lists = [character.archetypes, character.subclasses, build.archetypes, build.subclasses];
    if (lists.some((list) => Array.isArray(list) && list.some((entry) => (
      normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id || entry) === ARCHETYPE_ID
    )))) return true;

    return classEntries(character).some((entry) => {
      const classId = normalizeId(entry.classId || entry.id);
      const archetypeId = normalizeId(
        entry.archetypeId
        || entry.subclassId
        || entry.lineageId
        || entry.archetype?.id
        || entry.subclass?.id,
      );
      return classId === CLASS_ID && archetypeId === ARCHETYPE_ID;
    });
  }

  function isSelected(character = currentCharacter() || {}) {
    const resolved = characterFor(character);
    const api = global.LuminousArchetypeEngine;
    if (api?.isSelected) {
      try {
        if (api.isSelected(resolved, ARCHETYPE_ID, CLASS_ID)) return true;
      } catch (_) {}
    }
    return selectedByFallback(resolved);
  }

  function getLevel(character = currentCharacter() || {}) {
    const resolved = characterFor(character);
    if (!isSelected(resolved)) return 0;

    const api = global.LuminousArchetypeEngine;
    if (api?.getClassLevel) {
      const value = Number(api.getClassLevel(resolved, CLASS_ID));
      if (Number.isFinite(value)) return Math.max(0, value);
    }

    const entry = classEntries(resolved).find((candidate) => (
      normalizeId(candidate.classId || candidate.id) === CLASS_ID
    ));
    return Math.max(0, numberOr(entry?.levels ?? entry?.level, 0));
  }

  function defaultState() {
    return {
      selectedFragment: null,
      fragmentSelectionAvailable: true,
      fragmentCheckBonusUsed: false,
      detectEmotionsUsed: false,
      primordialBondUsedThisTurn: false,
      emotionalEchoes: {
        wrath: 0,
        envy: 0,
        gloom: 0,
        pride: 0,
        gluttony: 0,
        lust: 0,
        sloth: 0,
      },
      ascension: {
        available: true,
        active: false,
        roundsRemaining: 0,
        slotRecoveryUsedThisTurn: false,
      },
    };
  }

  function stateKeys(character = {}) {
    const keys = identityValues(character).map((id) => `id:${id}`);
    const name = entityName(character);
    if (name) keys.push(`name:${name}`);

    const player = currentCharacter();
    if (player && character && sameEntity(player, character)) {
      identityValues(player).forEach((id) => keys.push(`id:${id}`));
      const playerName = entityName(player);
      if (playerName) keys.push(`name:${playerName}`);
    }

    return [...new Set(keys)];
  }

  function getState(character = currentCharacter() || {}) {
    const resolved = characterFor(character);
    const keys = stateKeys(resolved);
    let record = null;

    for (const key of keys) {
      if (state.byIdentity.has(key)) {
        record = state.byIdentity.get(key);
        break;
      }
    }

    if (!record && state.byObject && resolved && typeof resolved === "object") {
      record = state.byObject.get(resolved) || null;
    }

    if (!record) record = defaultState();

    keys.forEach((key) => state.byIdentity.set(key, record));
    if (state.byObject && resolved && typeof resolved === "object") state.byObject.set(resolved, record);
    if (state.byObject && character && typeof character === "object") state.byObject.set(character, record);

    return record;
  }

  function canonicalSin(value) {
    const id = normalizeId(value);
    return SIN_ALIASES[id] || id;
  }

  function selectFragment(character = currentCharacter() || {}, sin, options = {}) {
    const resolved = characterFor(character);
    if (!isSelected(resolved)) return { selected: false, reason: "orosh_not_selected" };

    const fragment = canonicalSin(sin);
    if (!Object.prototype.hasOwnProperty.call(FRAGMENTS, fragment)) {
      return { selected: false, reason: "invalid_fragment" };
    }

    const record = getState(resolved);
    if (!record.fragmentSelectionAvailable && options.force !== true) {
      return {
        selected: false,
        reason: "fragment_locked_until_long_rest",
        fragment: record.selectedFragment,
        state: record,
      };
    }

    record.selectedFragment = fragment;
    record.fragmentSelectionAvailable = false;
    record.fragmentCheckBonusUsed = false;
    emit("luminous:orosh-fragment-selected", { character: resolved, fragment, state: record });
    return { selected: true, fragment, state: record };
  }

  function resetTurn(character = currentCharacter() || {}) {
    const record = getState(characterFor(character));
    record.primordialBondUsedThisTurn = false;
    record.ascension.slotRecoveryUsedThisTurn = false;
    return record;
  }

  function resetLongRest(character = currentCharacter() || {}) {
    const resolved = characterFor(character);
    const record = getState(resolved);
    record.selectedFragment = null;
    record.fragmentSelectionAvailable = true;
    record.fragmentCheckBonusUsed = false;
    record.detectEmotionsUsed = false;
    record.primordialBondUsedThisTurn = false;
    Object.keys(record.emotionalEchoes).forEach((key) => { record.emotionalEchoes[key] = 0; });
    record.ascension.available = true;
    record.ascension.active = false;
    record.ascension.roundsRemaining = 0;
    record.ascension.slotRecoveryUsedThisTurn = false;
    emit("luminous:orosh-fragment-selection-required", { character: resolved, state: record });
    return record;
  }

  function traitsContain(traits, traitId) {
    const wanted = normalizeId(traitId);
    return (Array.isArray(traits) ? traits : []).some((trait) => (
      normalizeId(trait?.id || trait?.name || trait) === wanted
    ));
  }

  function checkKeys(check = {}) {
    return [
      check.abilityId,
      check.statId,
      check.ability,
      check.stat,
      check.skillId,
      check.skill,
      check.actionId,
      check.action,
    ].filter(Boolean).map(normalizeId);
  }

  function fragmentMatchesCheck(fragment, check = {}) {
    const accepted = new Set((FRAGMENTS[fragment] || []).map(normalizeId));
    return checkKeys(check).some((key) => accepted.has(key));
  }

  function isInsightCheck(check = {}) {
    return checkKeys(check).some((key) => ["insight", "perspicacia"].includes(key));
  }

  function emotionalIntent(check = {}) {
    const values = [
      check.intent,
      check.purpose,
      check.reason,
      check.actionType,
      ...(Array.isArray(check.tags) ? check.tags : []),
    ].map(normalizeId);

    return values.some((value) => [
      "emotion",
      "emotions",
      "emocion",
      "emociones",
      "interpret_emotions",
      "interpretar_emociones",
      "detect_lie",
      "detect_lies",
      "detectar_mentira",
      "detectar_mentiras",
      "lie_detection",
    ].includes(value));
  }

  function isYuanTi(entity = {}) {
    const build = entity.characterBuild && typeof entity.characterBuild === "object"
      ? entity.characterBuild
      : {};
    const race = normalizeId(
      entity.raceId
      || entity.race_id
      || entity.race?.id
      || build.raceId
      || build.race_id
      || entity.race
      || "",
    );
    return ["yuanti_pura_sangre", "yuan_ti_pura_sangre", "yuan_ti", "yuanti"].includes(race);
  }

  function applyTheatreMechanics(result, input = {}) {
    if (!result?.check) return result;

    const character = characterFor(input.character || input.self || null);
    if (!isSelected(character)) return result;

    const check = result.check;
    if (check.__oroshAdjusted) return result;

    const traits = input.traits || [];
    const record = getState(character);
    const applied = [];

    if (
      traitsContain(traits, TRAITS.FRAGMENTED_BLESSING)
      && record.selectedFragment
      && !record.fragmentCheckBonusUsed
      && check.useOroshFragmentBonus !== false
      && fragmentMatchesCheck(record.selectedFragment, check)
    ) {
      check.finalPower = numberOr(check.finalPower, 0) + 2;
      record.fragmentCheckBonusUsed = true;
      applied.push({
        traitId: TRAITS.FRAGMENTED_BLESSING,
        finalPower: 2,
        fragment: record.selectedFragment,
      });
    }

    const target = input.target || check.target || null;
    if (
      traitsContain(traits, TRAITS.EMOTIONAL_ECHO)
      && isInsightCheck(check)
      && emotionalIntent(check)
      && target
      && !isYuanTi(target)
    ) {
      check.finalPower = numberOr(check.finalPower, 0) + 2;
      applied.push({ traitId: TRAITS.EMOTIONAL_ECHO, finalPower: 2 });
    }

    try {
      Object.defineProperty(check, "__oroshAdjusted", {
        value: true,
        configurable: true,
        enumerable: false,
      });
    } catch (_) {
      check.__oroshAdjusted = true;
    }

    if (applied.length) {
      emit("luminous:orosh-theatre-check", { character, check, applied, state: record });
    }
    return result;
  }

  function skillSin(skill = {}) {
    return canonicalSin(skill.sinAffinity ?? skill.affinity ?? skill.sin ?? skill.pecado ?? "");
  }

  function matchingFragmentSkill(character, skill = {}) {
    const record = getState(characterFor(character));
    return Boolean(record.selectedFragment && skillSin(skill) === record.selectedFragment);
  }

  function isSpell(skill = {}, runtime = {}) {
    const type = normalizeId(skill.type || skill.skillType || runtime.actionType || runtime.sourceType);
    return type === "spell"
      || normalizeId(skill.sourceType || skill.source_type) === "spell"
      || Boolean(runtime.spell || skill.spellId || skill.spell_id);
  }

  function mindOrEmotionSpell(skill = {}, runtime = {}) {
    if (!isSpell(skill, runtime)) return false;
    if (skill.affectsMind === true || skill.affectsEmotion === true || skill.affectsEmotions === true) {
      return true;
    }

    const tags = [
      ...(Array.isArray(skill.tags) ? skill.tags : []),
      ...(Array.isArray(skill.spellTags) ? skill.spellTags : []),
      ...(Array.isArray(skill.descriptors) ? skill.descriptors : []),
      ...(Array.isArray(runtime.tags) ? runtime.tags : []),
    ].map(normalizeId);

    return tags.some((tag) => [
      "mind",
      "mental",
      "emotion",
      "emotions",
      "mente",
      "emocion",
      "emociones",
      "psychic",
      "psiquico",
      "psiquica",
    ].includes(tag));
  }

  function canIgnoreTargetingObscurement(character = currentCharacter() || {}, condition) {
    const resolved = characterFor(character);
    if (!isSelected(resolved) || getLevel(resolved) < 1) return false;
    return TARGETING_IGNORES.has(normalizeId(condition));
  }

  function preDispatchTrait(trait, trigger, runtime = {}) {
    const traitId = normalizeId(trait?.id || trait?.name);
    if (!Object.values(TRAITS).includes(traitId)) return;

    const character = characterFor(runtime.character || runtime.self || null);
    if (!isSelected(character)) return;

    const normalizedTrigger = normalizeId(trigger);
    const record = getState(character);

    if (normalizedTrigger === "turn_start") resetTurn(character);
    if (normalizedTrigger === "long_rest") resetLongRest(character);

    if (
      traitId === TRAITS.PRIMORDIAL_BOND
      && normalizedTrigger === "before_skill"
      && getLevel(character) >= 30
    ) {
      const skill = runtime.skill || runtime.spell || {};
      if (!record.primordialBondUsedThisTurn && mindOrEmotionSpell(skill, runtime)) {
        runtime.orosh = {
          ...(runtime.orosh || {}),
          primordialBondEligible: true,
          attackWeightBonus: 1,
        };
      }
    }
  }

  function wrapTraitEngine(source) {
    const wrapped = { ...source, __oroshLineageIntegrated: true };

    if (typeof source.resolveTheatreCheck === "function") {
      wrapped.resolveTheatreCheck = function (input = {}) {
        const result = source.resolveTheatreCheck.call(source, input);
        return applyTheatreMechanics(result, input);
      };
    }

    if (typeof source.dispatchTrait === "function") {
      wrapped.dispatchTrait = function (trait, trigger, runtime = {}, traitState) {
        preDispatchTrait(trait, trigger, runtime);
        return source.dispatchTrait.call(source, trait, trigger, runtime, traitState);
      };
    }

    return Object.freeze(wrapped);
  }

  function installTraitEngineBridge() {
    const source = global.LuminousTraitEngine;
    if (!source) return false;

    if (source.__oroshLineageIntegrated) {
      state.traitEngineSource = source;
      return true;
    }
    if (state.traitEngineSource === source) return true;

    const wrapped = wrapTraitEngine(source);
    global.LuminousTraitEngine = wrapped;
    state.traitEngineSource = wrapped;
    return true;
  }

  function installCombatEngineBridge() {
    const engine = global.CombatEngine;
    if (!engine) return false;

    if (engine.__oroshLineageIntegrated) {
      state.combatEngineSource = engine;
      return true;
    }
    if (state.combatEngineSource === engine) return true;

    const originalFinalPower = typeof engine.calculateFinalPower === "function"
      ? engine.calculateFinalPower
      : null;
    if (originalFinalPower) {
      engine.calculateFinalPower = function (skill, headsFlipped, unit = null, ...rest) {
        let result = originalFinalPower.call(this, skill, headsFlipped, unit, ...rest);
        const character = characterFor(unit);
        const level = getLevel(character);
        if (
          unit
          && isSelected(character)
          && level >= 1
          && matchingFragmentSkill(character, skill)
        ) {
          result = numberOr(result, 0) + Math.max(1, level / 20);
        }
        return result;
      };
    }

    const originalCoinDamage = typeof engine.calculateCoinDamage === "function"
      ? engine.calculateCoinDamage
      : null;
    if (originalCoinDamage) {
      engine.calculateCoinDamage = function (attacker, defender, skill, ...rest) {
        let result = originalCoinDamage.call(this, attacker, defender, skill, ...rest);
        const character = characterFor(attacker);
        const level = getLevel(character);
        if (
          typeof result === "number"
          && attacker
          && isSelected(character)
          && level >= 1
          && matchingFragmentSkill(character, skill)
        ) {
          result = Math.max(0, result * (1 + level / 200));
        }
        return result;
      };
    }

    const originalAoE = typeof engine.calculateAoETargets === "function"
      ? engine.calculateAoETargets
      : null;
    if (originalAoE) {
      engine.calculateAoETargets = function (
        skill,
        primaryTarget,
        allPossibleTargets,
        unitAttacker,
        ...rest
      ) {
        const character = characterFor(unitAttacker);
        const record = getState(character);
        if (
          unitAttacker
          && isSelected(character)
          && getLevel(character) >= 30
          && !record.primordialBondUsedThisTurn
          && mindOrEmotionSpell(skill, { self: unitAttacker })
        ) {
          const baseWeight = numberOr(
            skill?.attackWeight ?? skill?.atkWeight ?? skill?.weight,
            1,
          );
          const augmented = {
            ...skill,
            attackWeight: baseWeight + 1,
            atkWeight: baseWeight + 1,
            weight: baseWeight + 1,
          };
          record.primordialBondUsedThisTurn = true;
          emit("luminous:orosh-combat-event", {
            character,
            traitId: TRAITS.PRIMORDIAL_BOND,
            trigger: "before_targeting",
            attackWeightBonus: 1,
            skill,
            state: record,
          });
          return originalAoE.call(
            this,
            augmented,
            primaryTarget,
            allPossibleTargets,
            unitAttacker,
            ...rest,
          );
        }
        return originalAoE.call(
          this,
          skill,
          primaryTarget,
          allPossibleTargets,
          unitAttacker,
          ...rest,
        );
      };
    }

    try {
      Object.defineProperty(engine, "__oroshLineageIntegrated", {
        value: true,
        configurable: true,
      });
    } catch (_) {
      engine.__oroshLineageIntegrated = true;
    }

    state.combatEngineSource = engine;
    return true;
  }

  function bindEvents() {
    if (state.listenersBound || !global.addEventListener) return false;
    state.listenersBound = true;

    global.addEventListener("luminous:rest-completed", (event) => {
      const detail = event?.detail || {};
      if (
        normalizeId(detail.type) !== "long_rest"
        || !detail.character
        || !isSelected(detail.character)
      ) return;
      resetLongRest(detail.character);
    });

    global.addEventListener("luminous:traits-refreshed", () => {
      installTraitEngineBridge();
      installCombatEngineBridge();
    });

    return true;
  }

  function install() {
    bindEvents();
    const trait = installTraitEngineBridge();
    const combat = installCombatEngineBridge();
    return { trait, combat };
  }

  const api = Object.freeze({
    ARCHETYPE_ID,
    CLASS_ID,
    TRAITS,
    FRAGMENTS,
    TARGETING_IGNORES,
    currentCharacter,
    sameEntity,
    characterFor,
    isSelected,
    getLevel,
    getState,
    selectFragment,
    resetTurn,
    resetLongRest,
    fragmentMatchesCheck,
    applyTheatreMechanics,
    skillSin,
    matchingFragmentSkill,
    mindOrEmotionSpell,
    canIgnoreTargetingObscurement,
    installTraitEngineBridge,
    installCombatEngineBridge,
    install,
  });

  global.LuminousOroshLineageRuntime = api;
  install();
  if (global.document && global.setInterval) {
    global.setInterval(install, PATCH_INTERVAL_MS);
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
