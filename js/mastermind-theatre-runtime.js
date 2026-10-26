(function (global) {
  "use strict";

  if (global.LuminousMastermindTheatreRuntime) return;

  const ARCHETYPE_ID = "mastermind";
  const CLASS_ID = "rogue";
  const PATCH_INTERVAL_MS = 700;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  let traitEngineSource = null;
  let playerTraitSource = null;

  function currentCharacter() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
  }

  function grantedMastermindTraits(character = {}) {
    const catalog = global.LuminousArchetypeTraitCatalog;
    const granted = catalog?.resolveTraitGrants?.(character) || [];
    return granted.filter((trait) => {
      const source = trait?.source || {};
      return normalizeId(source.archetypeId || source.id) === ARCHETYPE_ID && normalizeId(source.classId) === CLASS_ID;
    });
  }

  function hasTrait(character = {}, traitId) {
    const wanted = normalizeId(traitId);
    const granted = grantedMastermindTraits(character);
    if (granted.some((trait) => normalizeId(trait?.id || trait?.name) === wanted)) return true;
    const runtime = global.LuminousMastermindArchetypeRuntime;
    const levelByTrait = {
      master_of_intrigue: 15,
      master_of_tactics: 15,
      insightful_manipulator: 45,
      misdirection: 65,
      soul_of_deceit: 85,
    };
    return Boolean(runtime?.hasMastermindLevel?.(character, levelByTrait[wanted] || Number.POSITIVE_INFINITY));
  }

  function ensureObject(root, key) {
    if (!root[key] || typeof root[key] !== "object" || Array.isArray(root[key])) root[key] = {};
    return root[key];
  }

  function masterOfIntrigueChoices(character = {}) {
    const stored = character.traitChoices?.master_of_intrigue || {};
    const languages = [...new Set((stored.languages || []).map(normalizeId).filter(Boolean))].slice(0, 2);
    const gamingSet = normalizeId(stored.gamingSet || stored.gamingSetId || "") || null;
    return { languages, gamingSet };
  }

  function syncMasterOfIntrigue(character = {}) {
    if (!hasTrait(character, "master_of_intrigue")) return { active: false, character };
    const tools = ensureObject(character, "toolProficiencies");
    tools.disguise_kit = "proficient";
    tools.forgery_kit = "proficient";

    const choices = masterOfIntrigueChoices(character);
    if (choices.gamingSet) tools[choices.gamingSet] = "proficient";
    const languages = ensureObject(character, "languages");
    choices.languages.forEach((languageId) => {
      const existing = languages[languageId];
      languages[languageId] = typeof existing === "number"
        ? Math.max(100, existing)
        : { ...(existing && typeof existing === "object" ? existing : {}), habla: true, entiende: true, porcentaje: 100, traitGranted: true, sourceTraitId: "master_of_intrigue" };
    });

    character.mastermindTheatre = {
      ...(character.mastermindTheatre || {}),
      masterOfIntrigue: {
        fixedToolProficiencies: ["disguise_kit", "forgery_kit"],
        gamingSetChoices: 1,
        languageChoices: 2,
        selectedGamingSet: choices.gamingSet,
        selectedLanguages: [...choices.languages],
        mimicSpeechAfterMinutes: 1,
      },
    };
    return { active: true, choices, tools: clone(tools), languages: clone(languages) };
  }

  function applyMasterOfIntrigueChoices(character = {}, input = {}) {
    if (!hasTrait(character, "master_of_intrigue")) return { applied: false, reason: "master_of_intrigue_unavailable" };
    const languages = [...new Set((input.languages || []).map(normalizeId).filter(Boolean))];
    const gamingSet = normalizeId(input.gamingSet || input.gamingSetId || "") || null;
    if (languages.length > 2) return { applied: false, reason: "master_of_intrigue_language_limit", maximum: 2 };
    if (Array.isArray(input.gamingSets) && input.gamingSets.filter(Boolean).length > 1) return { applied: false, reason: "master_of_intrigue_gaming_set_limit", maximum: 1 };
    ensureObject(character, "traitChoices").master_of_intrigue = { languages, gamingSet };
    const synced = syncMasterOfIntrigue(character);
    return { applied: true, ...synced };
  }

  function canMimicSpeech(character = {}, observedMinutes = 0) {
    return hasTrait(character, "master_of_intrigue") && numberOr(observedMinutes, 0) >= 1;
  }

  function statScore(character = {}, abilityId) {
    const id = normalizeId(abilityId);
    const aliases = {
      int: ["int", "intelligence", "inteligencia"],
      wis: ["wis", "wisdom", "sabiduria"],
      cha: ["cha", "charisma", "carisma"],
    }[id] || [id];
    const stats = character.stats || {};
    for (const key of aliases) {
      const value = stats[key] ?? character[key];
      if (Number.isFinite(Number(value))) return Number(value);
    }
    return 10;
  }

  function totalLevel(character = {}) {
    if (Number.isFinite(Number(character.level))) return Number(character.level);
    const classes = Array.isArray(character.classes) ? character.classes : Array.isArray(character.characterBuild?.classes) ? character.characterBuild.classes : [];
    return classes.reduce((sum, entry) => sum + Math.max(0, numberOr(entry?.levels ?? entry?.level, 0)), 0);
  }

  function comparison(targetValue, selfValue) {
    if (targetValue > selfValue) return "superior";
    if (targetValue < selfValue) return "inferior";
    return "equal";
  }

  function assessCreature(character = {}, target = {}, options = {}) {
    if (!hasTrait(character, "insightful_manipulator")) return { available: false, reason: "insightful_manipulator_unavailable" };
    if (!target || typeof target !== "object") return { available: false, reason: "target_required" };
    if (options.inCombat === true || normalizeId(options.context) === "combat") return { available: false, reason: "outside_combat_only" };
    if (numberOr(options.observedMinutes ?? options.minutes, 0) < 1) return { available: false, reason: "observation_time_required", requiredMinutes: 1 };

    const requested = [...new Set((options.fields || ["int", "wis", "cha", "experience"]).map(normalizeId))]
      .filter((id) => ["int", "wis", "cha", "experience"].includes(id));
    const results = {};
    requested.forEach((id) => {
      const selfValue = id === "experience" ? totalLevel(character) : statScore(character, id);
      const targetValue = id === "experience" ? totalLevel(target) : statScore(target, id);
      results[id] = { relation: comparison(targetValue, selfValue), selfValue, targetValue };
    });
    return {
      available: true,
      traitId: "insightful_manipulator",
      observedMinutes: numberOr(options.observedMinutes ?? options.minutes, 0),
      results,
      dmMayRevealAdditionalDetails: true,
    };
  }

  function soulPreferences(character = {}) {
    const stored = character.traitChoices?.soul_of_deceit || character.soulOfDeceit || {};
    return {
      allowMindReading: stored.allowMindReading === true,
      presentFalseThoughts: stored.presentFalseThoughts === true,
      appearTruthful: stored.appearTruthful !== false,
    };
  }

  function setSoulOfDeceitPreferences(character = {}, input = {}) {
    if (!hasTrait(character, "soul_of_deceit")) return { applied: false, reason: "soul_of_deceit_unavailable" };
    const prefs = {
      allowMindReading: input.allowMindReading === true,
      presentFalseThoughts: input.presentFalseThoughts === true,
      appearTruthful: input.appearTruthful !== false,
    };
    ensureObject(character, "traitChoices").soul_of_deceit = prefs;
    return { applied: true, preferences: clone(prefs) };
  }

  function resolveSoulOfDeceit(character = {}, effect = {}) {
    if (!hasTrait(character, "soul_of_deceit")) return { active: false };
    const prefs = { ...soulPreferences(character), ...(effect.preferences || {}) };
    const kind = normalizeId(effect.kind || effect.type || effect.effectType || effect.intent);
    if (["mind_reading", "read_mind", "detect_thoughts", "thought_reading"].includes(kind)) {
      if (!prefs.allowMindReading) return { active: true, traitId: "soul_of_deceit", kind: "mind_reading", blocked: true, requiresConsent: true };
      return { active: true, traitId: "soul_of_deceit", kind: "mind_reading", blocked: false, requiresConsent: true, presentFalseThoughts: prefs.presentFalseThoughts };
    }
    if (["truth_detection", "detect_truth", "truthfulness", "lie_detection"].includes(kind)) {
      return { active: true, traitId: "soul_of_deceit", kind: "truth_detection", appearsTruthful: prefs.appearTruthful };
    }
    return { active: true, traitId: "soul_of_deceit", kind, handled: false };
  }

  function tagsForCheck(check = {}) {
    const values = [check.intent, check.effectType, check.actionId, check.kind, check.purpose, ...(Array.isArray(check.tags) ? check.tags : [])];
    return new Set(values.map(normalizeId).filter(Boolean));
  }

  function hasAny(tags, values) {
    return values.some((value) => tags.has(normalizeId(value)));
  }

  function applyMastermindTheatreResult(input = {}, result = {}) {
    const character = input.character || input.self || {};
    const check = { ...(result.check || input.check || {}) };
    const outcomes = [...(result.outcomes || [])];
    const tags = tagsForCheck(check);

    if (hasTrait(character, "master_of_intrigue") && hasAny(tags, ["mimic_speech", "speech_mimicry", "mimic_accent"])) {
      const minutes = numberOr(check.observedMinutes ?? check.minutesListened, 0);
      const available = canMimicSpeech(character, minutes);
      check.mastermindMimicSpeech = { available, observedMinutes: minutes, requiredMinutes: 1 };
      outcomes.push({ type: "mastermind_master_of_intrigue", traitId: "master_of_intrigue", mimicSpeech: available, observedMinutes: minutes });
    }

    if (hasTrait(character, "insightful_manipulator") && hasAny(tags, ["insightful_manipulator", "assess_creature", "observe_creature"])) {
      const target = check.target || check.targetCharacter || input.target || null;
      const assessment = assessCreature(character, target, {
        observedMinutes: check.observedMinutes ?? check.minutesObserved,
        context: check.context || input.context || "theatre",
        inCombat: check.inCombat === true,
        fields: check.assessmentFields,
      });
      check.mastermindAssessment = assessment;
      outcomes.push({ type: "mastermind_insightful_manipulator", traitId: "insightful_manipulator", assessment: clone(assessment) });
    }

    const target = check.target || check.targetCharacter || input.target || null;
    if (target && hasTrait(target, "soul_of_deceit")) {
      if (hasAny(tags, ["mind_reading", "read_mind", "detect_thoughts", "thought_reading"])) {
        const resolution = resolveSoulOfDeceit(target, { kind: "mind_reading", preferences: check.soulOfDeceitPreferences });
        check.soulOfDeceit = resolution;
        if (resolution.blocked) {
          check.blocked = true;
          check.blockedByTrait = "soul_of_deceit";
        }
        outcomes.push({ type: "mastermind_soul_of_deceit", traitId: "soul_of_deceit", ...clone(resolution) });
      } else if (hasAny(tags, ["truth_detection", "detect_truth", "truthfulness", "lie_detection"])) {
        const resolution = resolveSoulOfDeceit(target, { kind: "truth_detection", preferences: check.soulOfDeceitPreferences });
        check.soulOfDeceit = resolution;
        if (resolution.appearsTruthful) check.truthDetectionResult = "truthful";
        outcomes.push({ type: "mastermind_soul_of_deceit", traitId: "soul_of_deceit", ...clone(resolution) });
      }
    }

    return { ...result, check, outcomes };
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTheatreCheck) return false;
    if (source.__mastermindTheatreRuntimeIntegrated) {
      traitEngineSource = source;
      return true;
    }
    if (traitEngineSource === source) return true;
    const original = source.resolveTheatreCheck.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __mastermindTheatreRuntimeIntegrated: true,
      resolveTheatreCheck(input = {}) {
        return applyMastermindTheatreResult(input, original(input) || {});
      },
    });
    global.LuminousTraitEngine = wrapped;
    traitEngineSource = wrapped;
    return true;
  }

  function patchPlayerTraitRuntime() {
    const source = global.LuminousPlayerTraitRuntime;
    if (!source?.resolveTheatreCheck) return false;
    if (source.__mastermindTheatreRuntimeIntegrated) {
      playerTraitSource = source;
      return true;
    }
    if (playerTraitSource === source) return true;
    const original = source.resolveTheatreCheck.bind(source);
    const wrapped = Object.freeze({
      ...source,
      __mastermindTheatreRuntimeIntegrated: true,
      resolveTheatreCheck(check = {}, runtimeInput = {}) {
        const target = runtimeInput?.target || check?.target || null;
        const enriched = target ? { ...(check || {}), target } : { ...(check || {}) };
        return original(enriched, runtimeInput);
      },
    });
    global.LuminousPlayerTraitRuntime = wrapped;
    playerTraitSource = wrapped;
    return true;
  }

  function install() {
    const character = currentCharacter();
    if (character) syncMasterOfIntrigue(character);
    patchTraitEngine();
    patchPlayerTraitRuntime();
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID, CLASS_ID,
    grantedMastermindTraits, hasTrait,
    masterOfIntrigueChoices, syncMasterOfIntrigue, applyMasterOfIntrigueChoices, canMimicSpeech,
    statScore, totalLevel, assessCreature,
    soulPreferences, setSoulOfDeceitPreferences, resolveSoulOfDeceit,
    applyMastermindTheatreResult,
    patchTraitEngine, patchPlayerTraitRuntime, install,
  });

  global.LuminousMastermindTheatreRuntime = api;
  install();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global.document && global.setInterval) global.setInterval(install, PATCH_INTERVAL_MS);
})(typeof window !== "undefined" ? window : globalThis);
