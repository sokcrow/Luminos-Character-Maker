(function (global) {
  "use strict";

  const CLASS_ID = "bard";
  const CATALOG_VERSION = 4;
  const ABILITY_IDS = Object.freeze(["str", "dex", "con", "int", "wis", "cha"]);
  const JACK_STATUSES = Object.freeze(["burn", "tremor", "sinking", "rupture", "bleed"]);
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const BARD_SOURCE = Object.freeze({ type: "class", id: CLASS_ID, classId: CLASS_ID, className: "Bard" });
  const REUSABLE_CLASS_SOURCE = Object.freeze({ type: "class", id: "", classId: "" });

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const BARD_DEFINITIONS = deepFreeze({
    bardic_inspiration: {
      schemaVersion: 1,
      id: "bardic_inspiration",
      name: "Bardic Inspiration",
      description: "Quick Action. Apply Bardic Inspiration to an Ally. The Ally may consume it before a Check or Skill to gain ceil(max(1, CHA Mod / 2) + Bard Class Level / 25) Power. Uses are max(1, CHA Mod), reset on Long Rest, and Font of Inspiration adds +1 Max Use from Bard Class Level 25.",
      source: BARD_SOURCE,
      contexts: ["combat"],
      activation: {
        type: "manual",
        actionCost: "quick_action",
        target: "ally",
        uses: {
          formula: "max(1, CharismaMod) + min(1, floor(ClassLevel / 25))",
          reset: "long_rest",
        },
      },
      effects: [],
      rules: [{
        type: "status",
        trigger: "on_use",
        action: "inflict",
        target: "target",
        statusId: "bardic_inspiration",
        formula: "ceil(max(1, CharismaMod / 2) + ClassLevel / 25)",
        count: 1,
        duration: "until_removed",
        data: { consumeBefore: ["check", "skill"], chosenConsumption: true },
      }],
    },

    spellcasting: {
      schemaVersion: 1,
      id: "spellcasting",
      name: "Spellcasting",
      description: "Gain Bard Spellcasting. Charisma is the Bard Spellcasting Ability.",
      source: BARD_SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { spellcasting: true, abilityId: "cha" },
    },

    jack_of_all_trades: {
      schemaVersion: 1,
      id: "jack_of_all_trades",
      name: "Jack of All Trades",
      description: "Gain +(Half Proficiency Rounded down) Ability Power on Abilities you don't have Proficiency. [On Hit] Randomly Apply 1 Burn, Tremor, Sinking, Rupture or Bleed.",
      source: BARD_SOURCE,
      contexts: ["combat", "theatre"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        halfProficiencyAbilityPower: true,
        randomStatusOnHit: JACK_STATUSES,
      },
    },

    resting_song: {
      schemaVersion: 1,
      id: "resting_song",
      name: "Resting Song",
      description: "[On Short Rest] Heal (5+(Class Level/8))% all present Allies HP.",
      source: BARD_SOURCE,
      contexts: ["any"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { shortRestAllyHealPercentFormula: "5 + ClassLevel / 8" },
    },

    expertise: {
      schemaVersion: 1,
      id: "expertise",
      name: "Expertise",
      description: "Choose 2 additional Abilities to Gain Expertise. When [Class] gets to lvl 50 Choose 2 additional Abilities to Gain Expertise.",
      source: REUSABLE_CLASS_SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        instancePerSource: true,
        expertise: {
          abilityChoices: 2,
          additionalAtSourceClassLevel: { level: 50, abilityChoices: 2 },
        },
      },
    },

    font_of_inspiration: {
      schemaVersion: 1,
      id: "font_of_inspiration",
      name: "Font of Inspiration",
      description: "[On Short Rest] Recover Max Bardic Inspiration Uses. Bardic Inspiration Max Uses +1.",
      source: BARD_SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        refillTraitOnShortRest: "bardic_inspiration",
        bardicInspirationMaxUsesBonus: 1,
      },
    },

    countercharm: {
      schemaVersion: 1,
      id: "countercharm",
      name: "Countercharm",
      description: "[On Use] Apply 2 Countercharm to all Ally Units deployed. Countercharm reduces Frightened & Charmed Threshold saves by 4. [On Turn End] Lose 1 Count.",
      source: BARD_SOURCE,
      contexts: ["combat"],
      activation: { type: "manual", actionCost: "action" },
      effects: [],
      rules: [],
      mechanics: {
        allyStatus: {
          statusId: "countercharm",
          count: 2,
          thresholdSaveReduction: 4,
          appliesTo: ["frightened", "charmed"],
          loseCountOnTurnEnd: 1,
        },
      },
    },

    superior_inspiration: {
      schemaVersion: 1,
      id: "superior_inspiration",
      name: "Superior Inspiration",
      description: "[On Encounter Start] If Bardic Inspiration Uses = 0, recover Half Bardic Inspiration Max Uses, rounded up.",
      source: BARD_SOURCE,
      contexts: ["combat"],
      activation: { type: "automatic", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        encounterStartRecoverIfEmpty: {
          traitId: "bardic_inspiration",
          fraction: 0.5,
          rounding: "ceil",
        },
      },
    },
  });

  const bardGrant = (level, traitId) => ({
    id: `core_class_bard_l${level}_${traitId}`,
    sourceType: "class",
    sourceId: CLASS_ID,
    source: {
      className: "Bard",
      atLevel: level,
      requiredClassLevel: level,
    },
    atLevel: level,
    traitId,
    grantType: "trait",
    multiclassPolicy: "allowed",
  });

  const BARD_GRANTS = deepFreeze([
    bardGrant(1, "bardic_inspiration"),
    bardGrant(1, "spellcasting"),
    bardGrant(10, "jack_of_all_trades"),
    bardGrant(10, "resting_song"),
    bardGrant(15, "expertise"),
    bardGrant(25, "font_of_inspiration"),
    bardGrant(30, "countercharm"),
    bardGrant(100, "superior_inspiration"),
  ]);

  function traitBaseId(trait = {}) {
    return normalizeId(trait.baseTraitId || String(trait.id || trait.name || "").split("__class__")[0]);
  }

  function sourceClassId(trait = {}) {
    const source = trait.source || {};
    return normalizeId(source.classId || (normalizeId(source.type) === "class" ? source.id : ""));
  }

  function sourceClassName(trait = {}) {
    const source = trait.source || {};
    const raw = String(source.className || source.name || source.classId || source.id || "Class").trim();
    return raw.replace(/[_-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getClassLevel(engine, character = {}, classId) {
    if (engine?.getClassLevel) return Math.max(0, intOr(engine.getClassLevel(character, classId), 0));
    const id = normalizeId(classId);
    const classes = Array.isArray(character.classes) ? character.classes : character.characterBuild?.classes || [];
    const found = classes.find((entry) => normalizeId(entry?.classId || entry?.id) === id);
    return Math.max(0, intOr(found?.levels ?? found?.level, 0));
  }

  function wrapCatalog() {
    const source = global.LuminousTraitCatalogCore || (typeof require === "function" ? require("./trait-catalog-core.js") : null);
    if (!source) return false;
    if (source.__bardClassCatalogExtended) return true;

    const baseDefinitions = source.allDefinitions?.bind(source) || (() => clone(source.DEFINITIONS || {}));
    const baseGrants = source.allGrants?.bind(source) || (() => clone(source.GRANTS || []));
    const baseGet = source.getDefinition?.bind(source) || (() => null);
    const baseValidate = source.validateAll?.bind(source) || (() => ({ valid: true, errors: [], warnings: [] }));

    const allDefinitions = () => ({ ...baseDefinitions(), ...clone(BARD_DEFINITIONS) });
    const allGrants = () => [...baseGrants(), ...clone(BARD_GRANTS)];
    const getDefinition = (id) => clone(BARD_DEFINITIONS[normalizeId(id)] || baseGet(id));
    const validateAll = (engine = global.LuminousTraitEngine) => {
      const base = baseValidate(engine);
      const errors = [...(base.errors || [])];
      const warnings = [...(base.warnings || [])];
      Object.entries(BARD_DEFINITIONS).forEach(([key, definition]) => {
        if (!engine?.validateTrait) {
          errors.push(`${key}: Trait Engine is not available.`);
          return;
        }
        const validation = engine.validateTrait(definition);
        validation.errors.forEach((message) => errors.push(`${key}: ${message}`));
        validation.warnings.forEach((message) => warnings.push(`${key}: ${message}`));
      });
      const identities = new Set();
      BARD_GRANTS.forEach((grant) => {
        const identity = `${grant.sourceType}:${grant.sourceId}:${grant.traitId}:${grant.atLevel}`;
        if (identities.has(identity)) errors.push(`Duplicate Bard grant identity: ${identity}`);
        identities.add(identity);
        if (!BARD_DEFINITIONS[grant.traitId]) errors.push(`${grant.id}: missing Bard Trait definition ${grant.traitId}.`);
      });
      return { valid: base.valid !== false && !errors.length, errors, warnings };
    };

    const definitions = deepFreeze({ ...(source.DEFINITIONS || baseDefinitions()), ...clone(BARD_DEFINITIONS) });
    const grants = deepFreeze([...(source.GRANTS || baseGrants()), ...clone(BARD_GRANTS)]);
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __bardClassCatalogExtended: true,
      CATALOG_VERSION: Math.max(CATALOG_VERSION, Number(source.CATALOG_VERSION || 0)),
      DEFINITIONS: definitions,
      GRANTS: grants,
      allDefinitions,
      allGrants,
      getDefinition,
      validateAll,
    });
    return true;
  }

  function instanceTraitBySource(trait = {}) {
    if (trait?.mechanics?.instancePerSource !== true) return trait;
    const source = trait.source || {};
    const type = normalizeId(source.type || "class") || "class";
    const sourceId = normalizeId(source.classId || source.id);
    if (!sourceId) return trait;
    const baseId = normalizeId(trait.baseTraitId || trait.id || trait.name);
    return {
      ...trait,
      baseTraitId: baseId,
      id: `${baseId}__${type}__${sourceId}`,
      name: trait.name || "Expertise",
      description: String(trait.description || "").replaceAll("[Class]", sourceClassName(trait)),
    };
  }

  function statusStore(unit) {
    if (!unit || typeof unit !== "object") return null;
    const statusEngine = global.LuminousStatusEngine;
    if (statusEngine?.ensureStore) return statusEngine.ensureStore(unit);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    return unit.statusEffects;
  }

  function getStatus(unit, statusId) {
    const id = normalizeId(statusId);
    const statusEngine = global.LuminousStatusEngine;
    const fromEngine = statusEngine?.getStatus?.(unit, id);
    if (fromEngine) return fromEngine;
    return clone(unit?.statusEffects?.[id] || unit?.traitStatuses?.[id] || null);
  }

  function applyStatus(unit, statusId, input = {}) {
    if (!unit) return null;
    const id = normalizeId(statusId);
    const statusEngine = global.LuminousStatusEngine;
    if (statusEngine?.applyStatus) return statusEngine.applyStatus(unit, id, input);
    const store = statusStore(unit);
    const next = {
      id,
      name: input.name || id,
      count: Math.max(0, numberOr(input.count, 1)),
      potency: numberOr(input.potency, 0),
      duration: normalizeId(input.duration || "until_removed"),
      sourceTraitId: input.sourceTraitId || null,
      sourceUnitId: input.sourceUnitId || null,
      data: clone(input.data || {}),
    };
    store[id] = next;
    return clone(next);
  }

  function removeStatus(unit, statusId) {
    const id = normalizeId(statusId);
    const statusEngine = global.LuminousStatusEngine;
    let removed = false;
    if (statusEngine?.removeStatus) {
      const result = statusEngine.removeStatus(unit, id, { from: "self", ignoreProtection: true });
      removed = result?.removed === true;
    }
    [unit?.statusEffects, unit?.traitStatuses].forEach((store) => {
      if (store && Object.prototype.hasOwnProperty.call(store, id)) {
        delete store[id];
        removed = true;
      }
    });
    return { removed, statusId: id };
  }

  function identityValues(unit = {}) {
    return [unit?.id, unit?.playerId, unit?.player_id, unit?.characterId, unit?.character_id, unit?.actorId, unit?.actor_id, unit?.uid]
      .filter((value) => value != null && String(value).trim() !== "")
      .map((value) => String(value).trim());
  }

  function uniqueUnits(units = []) {
    const seenObjects = new Set();
    const seenIds = new Set();
    return (units || []).filter((unit) => {
      if (!unit || typeof unit !== "object" || seenObjects.has(unit)) return false;
      const ids = identityValues(unit);
      if (ids.some((id) => seenIds.has(id))) return false;
      seenObjects.add(unit);
      ids.forEach((id) => seenIds.add(id));
      return true;
    });
  }

  function factionId(unit = {}) {
    const explicit = unit.faction ?? unit.faccion;
    if (explicit != null && String(explicit).trim() !== "") return normalizeId(explicit);
    if (unit.isPlayer != null) return unit.isPlayer ? "player" : "enemy";
    return null;
  }

  function isAlive(unit) {
    const hp = unit?.hp ?? unit?.currentHp ?? unit?.hp_actual ?? unit?.combatStats?.hp_actual;
    return !Number.isFinite(Number(hp)) || Number(hp) > 0;
  }

  function presentAllies(runtime = {}, includeSelf = false) {
    const actor = runtime.self || runtime.character || null;
    const standard = global.LuminousTraitStandardizationRuntime;
    const candidates = [
      ...(Array.isArray(runtime.allies) ? runtime.allies : []),
      ...(Array.isArray(runtime.units) ? runtime.units : []),
      ...(Array.isArray(runtime.presentAllies) ? runtime.presentAllies : []),
      ...(Array.isArray(runtime.character?.presentAllies) ? runtime.character.presentAllies : []),
      ...(standard?.liveCombatUnits ? standard.liveCombatUnits(runtime) : []),
    ];
    const actorFaction = factionId(actor || {});
    return uniqueUnits(candidates).filter((unit) => {
      if (!isAlive(unit)) return false;
      if (!includeSelf && actor && unit === actor) return false;
      if (actor && identityValues(actor).some((id) => identityValues(unit).includes(id))) return includeSelf;
      const faction = factionId(unit);
      if (actorFaction && faction) return actorFaction === faction;
      if (Array.isArray(runtime.allies) && runtime.allies.includes(unit)) return true;
      if (Array.isArray(runtime.presentAllies) && runtime.presentAllies.includes(unit)) return true;
      if (Array.isArray(runtime.character?.presentAllies) && runtime.character.presentAllies.includes(unit)) return true;
      return false;
    });
  }

  function readHp(unit) {
    const max = unit?.maxHp ?? unit?.hp_max ?? unit?.combatStats?.hp_max;
    const current = unit?.hp ?? unit?.currentHp ?? unit?.hp_actual ?? unit?.combatStats?.hp_actual;
    return { current: Number.isFinite(Number(current)) ? Number(current) : null, max: Number.isFinite(Number(max)) ? Number(max) : null };
  }

  function writeHp(unit, value) {
    const next = Math.max(0, Math.floor(numberOr(value, 0)));
    if (Object.prototype.hasOwnProperty.call(unit || {}, "hp")) unit.hp = next;
    else if (Object.prototype.hasOwnProperty.call(unit || {}, "currentHp")) unit.currentHp = next;
    else if (Object.prototype.hasOwnProperty.call(unit || {}, "hp_actual")) unit.hp_actual = next;
    else if (unit?.combatStats && Object.prototype.hasOwnProperty.call(unit.combatStats, "hp_actual")) unit.combatStats.hp_actual = next;
    else if (unit) unit.currentHp = next;
    return next;
  }

  function healPercent(unit, percent) {
    const hp = readHp(unit);
    if (hp.current == null || hp.max == null) return { amount: 0, before: hp.current, after: hp.current, max: hp.max };
    const requested = Math.max(0, Math.floor(hp.max * Math.max(0, numberOr(percent, 0)) / 100));
    const after = Math.min(hp.max, hp.current + requested);
    writeHp(unit, after);
    return { amount: Math.max(0, after - hp.current), before: hp.current, after, max: hp.max, requested };
  }

  function proficiencyState(character = {}, check = {}) {
    const explicit = normalizeId(check.proficiencyState || check.profState || check.proficiency || "");
    if (["none", "half", "proficient", "expertise"].includes(explicit)) return explicit;
    const skillId = normalizeId(check.skillId);
    const abilityId = normalizeId(check.abilityId || check.statId);
    if (skillId) {
      const map = character.skillProficiency || character.skillProficiencies || character.dndSkillProficiency || {};
      const nested = character.dndSkills?.[skillId];
      return normalizeId(map?.[skillId] ?? nested?.proficiency ?? nested?.proficiencyState ?? "none") || "none";
    }
    if (abilityId) {
      const map = character.abilityProficiency || character.abilityProficiencies || {};
      return normalizeId(map?.[abilityId] ?? "none") || "none";
    }
    return "none";
  }

  function hasTrait(traits = [], id) {
    const wanted = normalizeId(id);
    return (traits || []).some((trait) => traitBaseId(trait) === wanted || normalizeId(trait?.id) === wanted);
  }

  function findTrait(traits = [], id) {
    const wanted = normalizeId(id);
    return (traits || []).find((trait) => traitBaseId(trait) === wanted || normalizeId(trait?.id) === wanted) || null;
  }

  function evaluateTraitFormula(engine, trait, runtime, formula) {
    if (!engine?.evaluateFormula || !engine?.buildVariables) return numberOr(formula, 0);
    const character = runtime.character || runtime.self || {};
    return engine.evaluateFormula(formula, engine.buildVariables(character, runtime, trait));
  }

  function applyJackBeforeCheck(engine, traits, runtime, outcomes) {
    if (!hasTrait(traits, "jack_of_all_trades") || !runtime?.check || runtime.check.__jackOfAllTradesApplied) return;
    const state = proficiencyState(runtime.character || runtime.self || {}, runtime.check);
    if (state !== "none") return;
    const trait = findTrait(traits, "jack_of_all_trades");
    const variables = engine.buildVariables(runtime.character || runtime.self || {}, runtime, trait || {});
    const bonus = Math.max(0, Math.floor(numberOr(variables.Proficiency, 0) / 2));
    if (!bonus) return;
    runtime.check.finalPower = numberOr(runtime.check.finalPower, 0) + bonus;
    runtime.check.__jackOfAllTradesApplied = true;
    runtime.check.jackOfAllTradesAbilityPower = bonus;
    outcomes?.push({ type: "bard_jack_of_all_trades", traitId: trait?.id || "jack_of_all_trades", bonus, proficiencyState: state });
  }

  function randomValue(runtime = {}) {
    if (typeof runtime.random === "function") return Math.max(0, Math.min(0.999999999, numberOr(runtime.random(), 0)));
    return Math.random();
  }

  function applyJackOnHit(traits, runtime, outcomes) {
    if (!hasTrait(traits, "jack_of_all_trades")) return;
    const target = runtime.target || runtime.defender || runtime.targetsHit?.[0] || null;
    if (!target) return;
    const trait = findTrait(traits, "jack_of_all_trades");
    const statuses = trait?.mechanics?.randomStatusOnHit || JACK_STATUSES;
    if (!statuses.length) return;
    const statusId = normalizeId(statuses[Math.floor(randomValue(runtime) * statuses.length)] || statuses[0]);
    const status = applyStatus(target, statusId, {
      count: 1,
      potency: 1,
      duration: "until_removed",
      sourceTraitId: trait?.id || "jack_of_all_trades",
      sourceUnitId: runtime.self?.id || runtime.character?.id || null,
      mode: "gain",
    });
    outcomes?.push({ type: "bard_jack_random_status", traitId: trait?.id || "jack_of_all_trades", target, statusId, status });
  }

  function applyCountercharmBeforeCheck(traits, runtime, outcomes) {
    if (!runtime?.check || runtime.check.__countercharmApplied) return;
    const self = runtime.self || runtime.character || null;
    const status = getStatus(self, "countercharm");
    if (!status || numberOr(status.count, 0) <= 0) return;
    const data = status.data || {};
    const applies = (data.appliesTo || ["frightened", "charmed"]).map(normalizeId);
    const haystack = [
      runtime.check.statusId, runtime.check.conditionId, runtime.check.effectId, runtime.check.saveAgainst,
      runtime.check.condition, runtime.check.label, ...(Array.isArray(runtime.check.tags) ? runtime.check.tags : []),
    ].filter(Boolean).map(normalizeId).join(" ");
    if (!applies.some((id) => haystack.includes(id))) return;
    const reduction = Math.max(0, numberOr(data.thresholdSaveReduction, 4));
    ["difficulty", "thresholdRaw", "threshold"].forEach((key) => {
      if (Number.isFinite(Number(runtime.check[key]))) runtime.check[key] = Number(runtime.check[key]) - reduction;
    });
    runtime.check.__countercharmApplied = true;
    outcomes?.push({ type: "bard_countercharm_save", statusId: "countercharm", reduction });
  }

  function consumeBardicInspiration(unit, runtime = {}, outcomes = []) {
    if (!unit) return { consumed: false, reason: "No Bardic Inspiration target." };
    const status = getStatus(unit, "bardic_inspiration");
    if (!status) return { consumed: false, reason: "No Bardic Inspiration status." };
    const useRequested = runtime.useBardicInspiration === true
      || runtime.check?.useBardicInspiration === true
      || runtime.skill?.useBardicInspiration === true;
    if (!useRequested) return { consumed: false, reason: "Bardic Inspiration was not chosen for this Check or Skill." };
    const power = Math.max(0, numberOr(status.potency, 0));
    const kind = runtime.check ? "check" : runtime.skill ? "skill" : null;
    if (!kind) return { consumed: false, reason: "Bardic Inspiration may only be consumed before a Check or Skill." };
    if (kind === "check") runtime.check.finalPower = numberOr(runtime.check.finalPower, 0) + power;
    else runtime.skill.finalPower = numberOr(runtime.skill.finalPower ?? runtime.skill.final_power, 0) + power;
    removeStatus(unit, "bardic_inspiration");
    const outcome = { type: "bardic_inspiration_consumed", statusId: "bardic_inspiration", power, kind };
    outcomes.push(outcome);
    return { consumed: true, power, kind, outcome };
  }

  function applyBeforeTrigger(engine, traits, trigger, runtime, outcomes) {
    const normalized = normalizeId(trigger);
    if (normalized === "before_check") {
      applyJackBeforeCheck(engine, traits, runtime, outcomes);
      applyCountercharmBeforeCheck(traits, runtime, outcomes);
      consumeBardicInspiration(runtime.self || runtime.character, runtime, outcomes);
    } else if (normalized === "before_skill") {
      consumeBardicInspiration(runtime.self || runtime.character, runtime, outcomes);
    }
  }

  function applyRestingSong(engine, traits, runtime, outcomes) {
    const trait = findTrait(traits, "resting_song");
    if (!trait) return;
    const formula = trait.mechanics?.shortRestAllyHealPercentFormula || "5 + ClassLevel / 8";
    const percent = evaluateTraitFormula(engine, trait, runtime, formula);
    const healed = presentAllies(runtime).map((ally) => ({ ally, ...healPercent(ally, percent) }));
    outcomes.push({ type: "bard_resting_song", traitId: trait.id, percent, healed });
  }

  function refillBardicInspiration(traits, state, outcomes) {
    if (!hasTrait(traits, "font_of_inspiration") || !state?.usages) return;
    const record = state.usages.bardic_inspiration;
    if (!record) return;
    const before = Math.max(0, intOr(record.used, 0));
    record.used = 0;
    outcomes.push({ type: "bard_font_of_inspiration", traitId: "font_of_inspiration", recovered: before, before, after: 0 });
  }

  function maximumUses(engine, trait, runtime) {
    const uses = trait?.activation?.uses;
    if (!uses) return null;
    const raw = uses.formula != null
      ? evaluateTraitFormula(engine, trait, runtime, uses.formula)
      : numberOr(uses.max ?? uses.value, 0);
    return Math.max(0, Math.floor(raw));
  }

  function applySuperiorInspiration(engine, traits, runtime, state, outcomes) {
    if (!hasTrait(traits, "superior_inspiration") || !state?.usages) return;
    const inspiration = findTrait(traits, "bardic_inspiration");
    if (!inspiration) return;
    const maximum = maximumUses(engine, inspiration, runtime);
    if (!maximum) return;
    const record = state.usages.bardic_inspiration;
    if (!record || Math.max(0, intOr(record.used, 0)) < maximum) return;
    const recover = Math.ceil(maximum / 2);
    const before = Math.max(0, intOr(record.used, 0));
    record.used = Math.max(0, before - recover);
    outcomes.push({ type: "bard_superior_inspiration", traitId: "superior_inspiration", maximum, recovered: before - record.used, before, after: record.used });
  }

  function decayCountercharm(runtime, outcomes) {
    const units = uniqueUnits([
      ...(Array.isArray(runtime.units) ? runtime.units : []),
      ...(global.LuminousTraitStandardizationRuntime?.liveCombatUnits ? global.LuminousTraitStandardizationRuntime.liveCombatUnits(runtime) : []),
      runtime.self,
    ]);
    units.forEach((unit) => {
      const store = statusStore(unit);
      const status = store?.countercharm || unit?.traitStatuses?.countercharm;
      if (!status) return;
      const loss = Math.max(1, intOr(status.data?.loseCountOnTurnEnd, 1));
      const before = Math.max(0, intOr(status.count, 0));
      const after = Math.max(0, before - loss);
      if (after <= 0) removeStatus(unit, "countercharm");
      else {
        if (store?.countercharm) store.countercharm.count = after;
        if (unit?.traitStatuses?.countercharm) unit.traitStatuses.countercharm.count = after;
      }
      outcomes.push({ type: "bard_countercharm_decay", statusId: "countercharm", unit, before, after });
    });
  }

  function applyAfterTrigger(engine, traits, trigger, runtime, state, outcomes) {
    const normalized = normalizeId(trigger);
    if (normalized === "on_hit") applyJackOnHit(traits, runtime, outcomes);
    if (normalized === "short_rest") {
      applyRestingSong(engine, traits, runtime, outcomes);
      refillBardicInspiration(traits, state, outcomes);
    }
    if (normalized === "encounter_start") applySuperiorInspiration(engine, traits, runtime, state, outcomes);
    if (normalized === "turn_end") decayCountercharm(runtime, outcomes);
  }

  function applyCountercharmOnUse(trait, runtime, result) {
    if (traitBaseId(trait) !== "countercharm" || !result?.available || result?.scheduled) return result;
    const spec = trait.mechanics?.allyStatus || {};
    const statusId = normalizeId(spec.statusId || "countercharm");
    const allies = presentAllies(runtime);
    const applied = allies.map((ally) => ({
      ally,
      status: applyStatus(ally, statusId, {
        count: Math.max(1, intOr(spec.count, 2)),
        potency: 0,
        duration: "until_removed",
        sourceTraitId: trait.id,
        sourceUnitId: runtime.self?.id || runtime.character?.id || null,
        data: {
          thresholdSaveReduction: Math.max(0, numberOr(spec.thresholdSaveReduction, 4)),
          appliesTo: clone(spec.appliesTo || ["frightened", "charmed"]),
          loseCountOnTurnEnd: Math.max(1, intOr(spec.loseCountOnTurnEnd, 1)),
        },
        mode: "set",
      }),
    }));
    result.outcomes = [...(result.outcomes || []), { type: "bard_countercharm_applied", traitId: trait.id, statusId, applied }];
    return result;
  }

  function expertiseChoiceCount(trait = {}, character = {}, engine = global.LuminousTraitEngine) {
    const spec = trait.mechanics?.expertise || {};
    let count = Math.max(0, intOr(spec.abilityChoices, 2));
    const progression = spec.additionalAtSourceClassLevel || {};
    const classId = sourceClassId(trait);
    if (classId && getClassLevel(engine, character, classId) >= Math.max(0, intOr(progression.level, 50))) {
      count += Math.max(0, intOr(progression.abilityChoices, 2));
    }
    return count;
  }

  function applyExpertiseChoices(character = {}, trait = {}, abilityIds = [], engine = global.LuminousTraitEngine) {
    const allowedCount = expertiseChoiceCount(trait, character, engine);
    const choices = [...new Set((abilityIds || []).map(normalizeId).filter((id) => ABILITY_IDS.includes(id)))];
    if (choices.length > allowedCount) return { success: false, reason: `Expertise allows ${allowedCount} Ability choices for this source Class.`, allowedCount, choices };
    if (!character.abilityProficiency || typeof character.abilityProficiency !== "object" || Array.isArray(character.abilityProficiency)) character.abilityProficiency = {};
    choices.forEach((id) => { character.abilityProficiency[id] = "expertise"; });
    if (!character.traitChoices || typeof character.traitChoices !== "object" || Array.isArray(character.traitChoices)) character.traitChoices = {};
    character.traitChoices[normalizeId(trait.id || trait.name)] = { abilities: choices, sourceClassId: sourceClassId(trait) || null };
    return { success: true, allowedCount, choices, remainingChoices: Math.max(0, allowedCount - choices.length) };
  }

  function wrapEngine() {
    const source = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
    if (!source) return false;
    if (source.__bardClassRuntimeWrapped) return true;

    const originalResolve = source.resolveTraitGrants?.bind(source);
    const originalDispatchTraits = source.dispatchTraits?.bind(source);
    const originalDispatchCombatEvent = source.dispatchCombatEvent?.bind(source);
    const originalResolveTheatreCheck = source.resolveTheatreCheck?.bind(source);
    const originalActivateTrait = source.activateTrait?.bind(source);

    const wrapped = Object.freeze({
      ...source,
      __bardClassRuntimeWrapped: true,
      resolveTraitGrants(character = {}, grants = [], catalog = {}) {
        const resolved = originalResolve ? originalResolve(character, grants, catalog) : [];
        return resolved.map(instanceTraitBySource);
      },
      dispatchTraits(traits = [], trigger, runtime = {}, state) {
        const preOutcomes = [];
        applyBeforeTrigger(source, traits, trigger, runtime, preOutcomes);
        const result = originalDispatchTraits ? originalDispatchTraits(traits, trigger, runtime, state) : { state, runtime, outcomes: [] };
        const postOutcomes = [];
        applyAfterTrigger(source, traits, trigger, result.runtime || runtime, result.state || state, postOutcomes);
        result.outcomes = [...preOutcomes, ...(result.outcomes || []), ...postOutcomes];
        return result;
      },
      dispatchCombatEvent(trigger, input = {}) {
        const traits = input.traits || [];
        const runtime = input;
        const preOutcomes = [];
        applyBeforeTrigger(source, traits, trigger, runtime, preOutcomes);
        const result = originalDispatchCombatEvent ? originalDispatchCombatEvent(trigger, input) : { state: input.state, runtime, outcomes: [] };
        const postOutcomes = [];
        applyAfterTrigger(source, traits, trigger, result.runtime || runtime, result.state || input.state, postOutcomes);
        result.outcomes = [...preOutcomes, ...(result.outcomes || []), ...postOutcomes];
        return result;
      },
      resolveTheatreCheck(input = {}) {
        const result = originalResolveTheatreCheck ? originalResolveTheatreCheck(input) : { check: input.check || {}, state: input.state, outcomes: [] };
        const runtime = { context: "theatre", character: input.character || {}, self: input.character || {}, check: result.check };
        const extras = [];
        applyBeforeTrigger(source, input.traits || [], "before_check", runtime, extras);
        result.check = runtime.check;
        result.outcomes = [...(result.outcomes || []), ...extras];
        return result;
      },
      activateTrait(trait, runtime = {}, state) {
        const result = originalActivateTrait ? originalActivateTrait(trait, runtime, state) : { available: false, outcomes: [] };
        return applyCountercharmOnUse(result.trait || trait, result.runtime || runtime, result);
      },
    });

    global.LuminousTraitEngine = wrapped;
    return true;
  }

  function install() {
    const catalogReady = wrapCatalog();
    const engineReady = wrapEngine();
    return catalogReady && engineReady;
  }

  const api = Object.freeze({
    CLASS_ID,
    CATALOG_VERSION,
    ABILITY_IDS,
    JACK_STATUSES,
    BARD_DEFINITIONS,
    BARD_GRANTS,
    install,
    wrapCatalog,
    wrapEngine,
    traitBaseId,
    sourceClassId,
    sourceClassName,
    expertiseChoiceCount,
    applyExpertiseChoices,
    presentAllies,
    consumeBardicInspiration,
  });

  global.LuminousBardClassRuntime = api;
  install();
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (global.document && global.setInterval) global.setInterval(install, 800);
})(typeof window !== "undefined" ? window : globalThis);
