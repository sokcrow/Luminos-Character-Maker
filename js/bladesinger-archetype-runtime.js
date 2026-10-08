(function (global) {
  "use strict";

  if (global.LuminousBladesingerArchetypeRuntime) return;

  const ARCHETYPE_ID = "bladesinger";
  const ARCHETYPE_NAME = "Bladesinger";
  const CLASS_ID = "wizard";
  const CLASS_NAME = "Wizard";
  const STATUS_ID = "bladesong";
  const STATUS_ICON = "https://imgur.com/kkJI5mM.png";
  const PATCH_INTERVAL_MS = 500;
  const SONG_DEFENSE_KEY = "__luminousBladesingerSongDefense";

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const ARCHETYPE = Object.freeze({
    id: ARCHETYPE_ID,
    name: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
    unlockLevel: 10,
    traitLevels: [10, 30, 50, 70],
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
    training_in_war_and_song: Object.freeze({
      schemaVersion: 1,
      id: "training_in_war_and_song",
      name: "Training in War and Song",
      description: "Gain proficiency with Light Armor, Performance, and one One-Handed Melee Weapon type of your choice.",
      source: SOURCE,
      contexts: ["any"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        armorProficiency: ["light"],
        skillProficiency: ["performance"],
        oneHandedMeleeWeaponProficiencyChoice: 1,
      },
    }),

    bladesong: Object.freeze({
      schemaVersion: 1,
      id: "bladesong",
      name: "Bladesong",
      description: "Quick Action: Activate Bladesong. While active, gain +INT Modifier Defense Power, +1 Min & Max Speed, +4 on Acrobatics Checks, and +INT Modifier to Constitution Saves made to maintain Concentration. Bladesong ends if you become Incapacitated or use incompatible equipment.",
      source: SOURCE,
      contexts: ["combat", "theatre", "any"],
      activation: { type: "manual", actionCost: "quick_action" },
      effects: [],
      rules: [
        { type: "modifier", trigger: "passive", target: "self", channel: "defense_power", mode: "add", formula: "IntelligenceMod", whileStatus: STATUS_ID },
        { type: "modifier", trigger: "passive", target: "self", channel: "min_speed", mode: "add", value: 1, whileStatus: STATUS_ID },
        { type: "modifier", trigger: "passive", target: "self", channel: "max_speed", mode: "add", value: 1, whileStatus: STATUS_ID },
      ],
      mechanics: {
        statusId: STATUS_ID,
        statusIcon: STATUS_ICON,
        quickAction: true,
        defensePowerFormula: "IntelligenceMod",
        minSpeedBonus: 1,
        maxSpeedBonus: 1,
        acrobaticsBonus: 4,
        concentrationSaveBonusFormula: "IntelligenceMod",
        endsOnIncapacitated: true,
        incompatibleArmor: ["medium", "heavy"],
        incompatibleShield: true,
        incompatibleTwoHandedWeapon: true,
      },
    }),

    song_of_defense: Object.freeze({
      schemaVersion: 1,
      id: "song_of_defense",
      name: "Song of Defense",
      description: "While Bladesong is active, when you take Damage: spend 1 Spell Slot and reduce that Damage by 10% × Spell Slot Level.",
      source: SOURCE,
      contexts: ["combat"],
      activation: {
        type: "manual",
        actionCost: "reaction",
        trigger: "before_getting",
        inputs: [{ id: "slotLevel", name: "Spell Slot Level", type: "number", min: 1, max: 9, required: true }],
      },
      effects: [],
      rules: [],
      mechanics: {
        requiresStatus: STATUS_ID,
        spellSlotClassId: CLASS_ID,
        damageReductionPercentPerSlotLevel: 10,
        maximumReductionPercent: 90,
      },
    }),

    song_of_victory: Object.freeze({
      schemaVersion: 1,
      id: "song_of_victory",
      name: "Song of Victory",
      description: "While Bladesong is active, Melee Attack Skills deal +(5% × INT Modifier) Damage.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [{
        type: "modifier",
        trigger: "passive",
        target: "self",
        channel: "damage_dealt_multiplier",
        mode: "add",
        formula: "5 * IntelligenceMod",
        unit: "percent",
        whileStatus: STATUS_ID,
        conditions: [{ path: "skill.attackMode", operator: "eq", value: "melee" }],
      }],
      mechanics: {
        requiresStatus: STATUS_ID,
        meleeOnly: true,
        damagePercentFormula: "5 * IntelligenceMod",
      },
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
    grant(10, "training_in_war_and_song"),
    grant(10, "bladesong"),
    grant(30, "additional_attack"),
    grant(50, "song_of_defense"),
    grant(70, "song_of_victory"),
  ]);

  function normalizedCharacter(character = {}) {
    if (Array.isArray(character.classes)) return character;
    if (Array.isArray(character.characterBuild?.classes)) return { ...character, classes: character.characterBuild.classes };
    return character;
  }

  function wizardLevel(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.getClassLevel) return Math.max(0, intOr(engine.getClassLevel(normalizedCharacter(character), CLASS_ID), 0));
    const classes = Array.isArray(character.classes) ? character.classes : Array.isArray(character.characterBuild?.classes) ? character.characterBuild.classes : [];
    const found = classes.find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === CLASS_ID);
    return Math.max(0, intOr(found?.levels ?? found?.level ?? found?.classLevel, 0));
  }

  function selectedBladesinger(character = {}) {
    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    const raw = character.characterBuild?.archetypes ?? character.archetypes ?? [];
    const list = Array.isArray(raw)
      ? raw
      : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return list.some((entry) =>
      normalizeId(entry?.classId || entry?.parentClassId) === CLASS_ID
      && normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id) === ARCHETYPE_ID
    );
  }

  function hasBladesingerLevel(character = {}, level = 10) {
    return selectedBladesinger(character) && wizardLevel(character) >= Number(level || 0);
  }

  function traitBaseId(trait = {}) {
    return normalizeId(trait?.baseTraitId || String(trait?.id || trait?.name || "").split("__class__")[0]);
  }

  function isBladesingerTrait(trait = {}) {
    const source = trait?.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType))
      && normalizeId(source.archetypeId || source.id || trait.archetypeId) === ARCHETYPE_ID;
  }

  function coreDefinitions(extra = {}) {
    return { ...(global.LuminousTraitCatalogCore?.allDefinitions?.() || {}), ...(extra || {}), ...DEFINITIONS };
  }

  function hasStatus(unit = {}, statusId = STATUS_ID) {
    if (global.LuminousStatusEngine?.hasStatus) return global.LuminousStatusEngine.hasStatus(unit, statusId);
    return Boolean(unit?.statusEffects?.[normalizeId(statusId)] || unit?.traitStatuses?.[normalizeId(statusId)]);
  }

  function applyStatus(unit = {}, statusId = STATUS_ID, input = {}) {
    if (global.LuminousStatusEngine?.applyStatus) return global.LuminousStatusEngine.applyStatus(unit, statusId, input);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    unit.statusEffects[normalizeId(statusId)] = {
      id: normalizeId(statusId),
      name: input.name || "Bladesong",
      count: Math.max(0, numberOr(input.count, 1)),
      potency: Math.max(0, numberOr(input.potency, 0)),
      duration: input.duration || "until_removed",
      sourceTraitId: input.sourceTraitId || "bladesong",
    };
    return clone(unit.statusEffects[normalizeId(statusId)]);
  }

  function removeStatus(unit = {}, statusId = STATUS_ID) {
    if (global.LuminousStatusEngine?.removeStatus) return global.LuminousStatusEngine.removeStatus(unit, statusId, { from: "self", ignoreProtection: true });
    const store = unit?.statusEffects;
    const id = normalizeId(statusId);
    const removed = Boolean(store?.[id]);
    if (removed) delete store[id];
    return { removed, statusId: id };
  }

  function registerBladesongStatus() {
    const definition = {
      name: "Bladesong",
      type: "positive",
      mode: "zero",
      icon: STATUS_ICON,
      description: "Bladesinger combat stance. Its bonuses are supplied by the Bladesong Trait.",
      rules: [],
    };
    if (global.LuminousStatusLibrary?.registerExtension) {
      global.LuminousStatusLibrary.registerExtension(STATUS_ID, definition);
      global.LuminousStatusLibrary.install?.();
      return true;
    }
    if (global.STATUS_REGISTRY && typeof global.STATUS_REGISTRY === "object") {
      try { global.STATUS_REGISTRY[STATUS_ID] = { id: STATUS_ID, ...definition }; return true; } catch (_) {}
    }
    return false;
  }

  function ensureTrainingProficiencies(character = {}) {
    if (!hasBladesingerLevel(character, 10)) return { applied: false, reason: "bladesinger_training_locked" };
    if (!Array.isArray(character.armorProficiencies)) character.armorProficiencies = [];
    if (!character.armorProficiencies.map(normalizeId).includes("light")) character.armorProficiencies.push("light");

    if (!character.skillProficiency || typeof character.skillProficiency !== "object" || Array.isArray(character.skillProficiency)) character.skillProficiency = {};
    const current = normalizeId(character.skillProficiency.performance || "none");
    if (!["proficient", "expertise"].includes(current)) character.skillProficiency.performance = "proficient";

    const weapon = warAndSongWeaponChoice(character);
    if (weapon) {
      if (!Array.isArray(character.weaponProficiencies)) character.weaponProficiencies = [];
      if (!character.weaponProficiencies.map(normalizeId).includes(weapon)) character.weaponProficiencies.push(weapon);
    }
    return { applied: true, armor: "light", performance: "proficient", weapon: weapon || null };
  }

  function warAndSongWeaponChoice(character = {}) {
    const value = character?.traitChoices?.training_in_war_and_song_weapon
      ?? character?.characterBuild?.traitChoices?.training_in_war_and_song_weapon
      ?? character?.bladesingerWeaponProficiency;
    return normalizeId(value) || null;
  }

  function setWarAndSongWeaponChoice(character = {}, weaponTypeId) {
    if (!hasBladesingerLevel(character, 10)) return { success: false, reason: "bladesinger_training_locked" };
    const id = normalizeId(weaponTypeId);
    if (!id) return { success: false, reason: "weapon_type_required" };
    if (!character.traitChoices || typeof character.traitChoices !== "object" || Array.isArray(character.traitChoices)) character.traitChoices = {};
    character.traitChoices.training_in_war_and_song_weapon = id;
    ensureTrainingProficiencies(character);
    return { success: true, weaponTypeId: id };
  }

  function intelligenceModifier(character = {}) {
    const casting = global.LuminousSpellcastingRuntime?.resolveSpellcasting?.(character, CLASS_ID);
    if (Number.isFinite(Number(casting?.spellMod))) return Number(casting.spellMod);
    const stats = character.stats || character.dndStats?.stats || character.dndStats || {};
    const score = [stats.int, stats.intelligence, stats.inteligencia, character.int, character.intelligence]
      .find((value) => Number.isFinite(Number(value)));
    return Math.floor(((score == null ? 10 : Number(score)) - 10) / 2);
  }

  function itemIsTwoHanded(item) {
    if (!item || typeof item !== "object") return false;
    if (item.twoHanded === true || item.two_handed === true || Number(item.hands) >= 2) return true;
    const handed = normalizeId(item.handedness || item.handType || item.hand_type || "");
    if (["two_handed", "twohanded", "2h"].includes(handed)) return true;
    const properties = Array.isArray(item.properties) ? item.properties : Object.keys(item.properties || {}).filter((key) => item.properties[key]);
    return properties.map(normalizeId).some((id) => ["two_handed", "twohanded", "2h"].includes(id));
  }

  function equipmentProfile(unit = {}) {
    const resolved = global.LuminousUniversalModifiers?.resolveEquipment?.(unit);
    if (resolved) return resolved;
    const equipment = unit.equipment || {};
    return {
      armorCategory: normalizeId(equipment.armor?.category || equipment.armor?.type || unit.armorType || "none"),
      shield: equipment.shield || null,
      mainHand: equipment.mainHand || equipment.main_hand || null,
      offHand: equipment.offHand || equipment.off_hand || null,
    };
  }

  function bladesongEquipmentCompatible(unit = {}) {
    const equipment = equipmentProfile(unit);
    const armor = normalizeId(equipment.armorCategory || equipment.armor?.category || "none");
    if (["medium", "medium_armor", "heavy", "heavy_armor"].includes(armor)) return false;
    if (equipment.shield) return false;
    if (itemIsTwoHanded(equipment.mainHand) || itemIsTwoHanded(equipment.offHand)) return false;
    return true;
  }

  function bladesongActive(unit = {}) {
    return hasStatus(unit, STATUS_ID);
  }

  function endBladesong(unit = {}, reason = "ended") {
    const result = removeStatus(unit, STATUS_ID);
    if (unit && typeof unit === "object") delete unit[SONG_DEFENSE_KEY];
    return { ended: Boolean(result?.removed), reason: normalizeId(reason) || "ended" };
  }

  function incapacitated(unit = {}) {
    return hasStatus(unit, "incapacitated") || unit.incapacitated === true || unit.isIncapacitated === true;
  }

  function maintainBladesong(unit = {}) {
    if (!bladesongActive(unit)) return { active: false, ended: false };
    if (incapacitated(unit)) return { active: false, ...endBladesong(unit, "incapacitated") };
    if (!bladesongEquipmentCompatible(unit)) return { active: false, ...endBladesong(unit, "incompatible_equipment") };
    return { active: true, ended: false };
  }

  function consumeEconomy(unit, cost, options = {}) {
    if (options.consumeActionCost === false) return true;
    const economy = options.actionEconomy || global.LuminousActionEconomy;
    if (!economy) return true;
    if (typeof economy.consume === "function") {
      if (economy === global.LuminousActionEconomy) return economy.consume(unit, cost, { phase: options.phase || (cost === "quick_action" ? "planning" : "combat") });
      return economy.consume(cost);
    }
    if (Object.prototype.hasOwnProperty.call(economy, cost)) {
      if (numberOr(economy[cost], 0) <= 0) return false;
      economy[cost] = Math.max(0, numberOr(economy[cost], 0) - 1);
    }
    return true;
  }

  function activateBladesong(unit = {}, options = {}) {
    if (!hasBladesingerLevel(unit, 10)) return { success: false, reason: "bladesong_locked" };
    if (incapacitated(unit)) return { success: false, reason: "incapacitated" };
    if (!bladesongEquipmentCompatible(unit)) return { success: false, reason: "bladesong_incompatible_equipment" };
    if (!consumeEconomy(unit, "quick_action", options)) return { success: false, reason: "quick_action_unavailable" };
    registerBladesongStatus();
    const status = applyStatus(unit, STATUS_ID, { mode: "set", count: 1, potency: 0, duration: "until_removed", sourceTraitId: "bladesong", name: "Bladesong" });
    return { success: true, active: true, status };
  }

  function applyAcrobaticsBonus(checkInput = {}, character = {}) {
    const check = { ...(checkInput || {}) };
    const skill = normalizeId(check.skillId || check.skill || check.actionId || check.name);
    if (!bladesongActive(character) || !["acrobatics", "acrobacia", "acrobacias"].includes(skill)) return check;
    check.finalPower = numberOr(check.finalPower, 0) + 4;
    return check;
  }

  function concentrationSaveBonus(character = {}) {
    return bladesongActive(character) ? intelligenceModifier(character) : 0;
  }

  function songDefenseSlotLevel(runtime = {}) {
    const value = runtime.slotLevel ?? runtime.spellSlotLevel ?? runtime.choice?.slotLevel ?? runtime.inputs?.slotLevel;
    return Math.max(0, intOr(value, 0));
  }

  function songDefensePreflight(character = {}, slotLevel) {
    const level = Math.max(0, intOr(slotLevel, 0));
    if (!hasBladesingerLevel(character, 50)) return { available: false, reason: "song_of_defense_locked", slotLevel: level };
    if (!bladesongActive(character)) return { available: false, reason: "bladesong_required", slotLevel: level };
    if (level < 1 || level > 9) return { available: false, reason: "spell_slot_level_required", slotLevel: level };
    const slots = global.LuminousSpellcastingRuntime;
    if (!slots?.canSpendSpellSlot) return { available: false, reason: "spellcasting_runtime_unavailable", slotLevel: level };
    const check = slots.canSpendSpellSlot(character, CLASS_ID, level);
    return { available: check?.available === true, reason: check?.available ? null : check?.reason || "spell_slot_unavailable", slotLevel: level, slot: check };
  }

  function armSongOfDefense(character = {}, slotLevel, options = {}) {
    const gate = songDefensePreflight(character, slotLevel);
    if (!gate.available) return { success: false, ...gate };
    if (!consumeEconomy(character, "reaction", options)) return { success: false, reason: "reaction_unavailable", slotLevel: gate.slotLevel };
    const spend = global.LuminousSpellcastingRuntime.spendSpellSlot(character, CLASS_ID, gate.slotLevel);
    if (spend?.available === false || spend?.success === false) return { success: false, reason: spend?.reason || "spell_slot_unavailable", slotLevel: gate.slotLevel };
    const reductionPercent = Math.min(90, gate.slotLevel * 10);
    character[SONG_DEFENSE_KEY] = { slotLevel: gate.slotLevel, reductionPercent };
    return { success: true, armed: true, slotLevel: gate.slotLevel, reductionPercent, spellSlot: spend };
  }

  function consumeSongOfDefense(character = {}) {
    const state = character?.[SONG_DEFENSE_KEY];
    if (!state) return null;
    delete character[SONG_DEFENSE_KEY];
    return { ...state };
  }

  function applySongOfDefenseDamage(character = {}, damage) {
    const amount = Math.max(0, numberOr(damage, 0));
    if (amount <= 0) return { damage: amount, reduced: 0, consumed: false };
    const state = consumeSongOfDefense(character);
    if (!state) return { damage: amount, reduced: 0, consumed: false };
    const percent = Math.max(0, Math.min(90, numberOr(state.reductionPercent, state.slotLevel * 10)));
    const next = Math.max(0, Math.floor(amount * (1 - percent / 100)));
    return { damage: next, reduced: amount - next, reductionPercent: percent, slotLevel: state.slotLevel, consumed: true };
  }

  function songOfVictoryDamagePercent(character = {}) {
    if (!hasBladesingerLevel(character, 70) || !bladesongActive(character)) return 0;
    return Math.max(0, 5 * intelligenceModifier(character));
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || !source?.allGrants || !source?.allArchetypes) return false;
    if (source.__bladesingerArchetypeIntegrated) return true;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;

    global.LuminousArchetypeTraitCatalog = Object.freeze({
      ...source,
      __bladesingerArchetypeIntegrated: true,
      BLADESINGER_ID: ARCHETYPE_ID,
      BLADESINGER_CLASS_ID: CLASS_ID,
      ARCHETYPES: Object.freeze({ ...(source.ARCHETYPES || {}), [ARCHETYPE_ID]: ARCHETYPE }),
      DEFINITIONS: Object.freeze({ ...(source.DEFINITIONS || {}), ...DEFINITIONS }),
      GRANTS: Object.freeze([...(source.GRANTS || []), ...GRANTS]),
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS.map((entry) => ({ ...entry, source: { ...(entry.source || {}) } }))]; },
      allArchetypes() { return { ...originalArchetypes(), [ARCHETYPE_ID]: { ...ARCHETYPE } }; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || global.LuminousTraitCatalogCore?.getDefinition?.(id) || null; },
      resolveTraitGrants(character = {}, definitions) {
        const base = originalResolve ? originalResolve(character, definitions) || [] : [];
        const engine = global.LuminousArchetypeEngine;
        const defs = { ...coreDefinitions(definitions), ...DEFINITIONS };
        const extra = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(character, GRANTS, defs, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || []
          : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        return [...byId.values()];
      },
    });
    return true;
  }

  function patchCoreCatalog() {
    const source = global.LuminousTraitCatalogCore;
    if (!source?.allDefinitions || !source?.allGrants || source.__bladesingerArchetypeIntegrated) return Boolean(source?.__bladesingerArchetypeIntegrated);
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __bladesingerArchetypeIntegrated: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS]; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__bladesingerArchetypeIntegrated) return Boolean(source?.__bladesingerArchetypeIntegrated);
    const originalResolve = source.resolveTraitGrants.bind(source);
    const originalActivate = typeof source.activateTrait === "function" ? source.activateTrait.bind(source) : null;

    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __bladesingerArchetypeIntegrated: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const rawBase = originalResolve(character, grants, definitions) || [];
        const base = rawBase.filter((trait) => {
          if (!isBladesingerTrait(trait)) return true;
          const required = Math.max(0, intOr(trait?.source?.requiredClassLevel ?? trait?.source?.atLevel, 0));
          return selectedBladesinger(character) && wizardLevel(character) >= required;
        });
        const engine = global.LuminousArchetypeEngine;
        const extra = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(character, GRANTS, { ...definitions, ...coreDefinitions(), ...DEFINITIONS }, { [ARCHETYPE_ID]: ARCHETYPE }, source) || []
          : [];
        const byId = new Map();
        [...base, ...extra].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        ensureTrainingProficiencies(character);
        return [...byId.values()];
      },
      activateTrait(input, runtime = {}, stateInput) {
        if (!originalActivate) return { available: false, reasons: ["Trait activation runtime unavailable."], outcomes: [] };
        const id = traitBaseId(input);
        const character = runtime.self || runtime.character || {};

        if (id === "bladesong") {
          if (!bladesongEquipmentCompatible(character)) return { available: false, reasons: ["Bladesong requires compatible equipment."], outcomes: [], trait: input, state: stateInput };
          if (incapacitated(character)) return { available: false, reasons: ["Bladesong cannot be activated while Incapacitated."], outcomes: [], trait: input, state: stateInput };
          const result = originalActivate(input, runtime, stateInput);
          if (result?.available) result.bladesong = activateBladesong(character, { consumeActionCost: false });
          return result;
        }

        if (id === "song_of_defense") {
          const level = songDefenseSlotLevel(runtime);
          const gate = songDefensePreflight(character, level);
          if (!gate.available) return { available: false, reasons: [gate.reason], outcomes: [], trait: input, state: stateInput, slotLevel: level };
          const result = originalActivate(input, runtime, stateInput);
          if (!result?.available) return result;
          result.songOfDefense = armSongOfDefense(character, level, { consumeActionCost: false });
          if (!result.songOfDefense.success) return { ...result, available: false, reasons: [result.songOfDefense.reason] };
          return result;
        }

        return originalActivate(input, runtime, stateInput);
      },
    });
    return true;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__bladesingerArchetypeIntegrated) return Boolean(source?.__bladesingerArchetypeIntegrated);
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    global.LuminousArchetypeRuntime = Object.freeze({
      ...source,
      __bladesingerArchetypeIntegrated: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const engine = global.LuminousArchetypeEngine;
        const defs = coreDefinitions();
        const granted = engine?.resolveTraitGrants
          ? engine.resolveTraitGrants(unit, GRANTS, defs, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || []
          : [];
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isBladesingerTrait(trait)), ...granted].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        unit.traitDefinitions = [...byId.values()];
        ensureTrainingProficiencies(unit);
        maintainBladesong(unit);
        return [...base, ...granted];
      },
    });
    return true;
  }

  function currentCharacter() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || {};
  }

  function patchTheatreRolls() {
    const source = global.LuminousTheatreRolls;
    if (!source?.armCheck || source.__bladesingerArchetypeIntegrated) return Boolean(source?.__bladesingerArchetypeIntegrated);
    const originalArmCheck = source.armCheck.bind(source);
    global.LuminousTheatreRolls = Object.freeze({
      ...source,
      __bladesingerArchetypeIntegrated: true,
      armCheck(check = {}) {
        return originalArmCheck(global.LuminousPlayerTraitRuntime?.resolveTheatreCheck ? check : applyAcrobaticsBonus(check, currentCharacter()));
      },
    });
    return true;
  }

  function patchSpellcastingRuntime() {
    const source = global.LuminousSpellcastingRuntime;
    if (!source?.resolveConcentrationCheck || source.__bladesingerArchetypeIntegrated) return Boolean(source?.__bladesingerArchetypeIntegrated);
    const originalResolveConcentration = source.resolveConcentrationCheck.bind(source);
    global.LuminousSpellcastingRuntime = Object.freeze({
      ...source,
      __bladesingerArchetypeIntegrated: true,
      resolveConcentrationCheck(character = {}, check = {}, total) {
        const bonus = concentrationSaveBonus(character);
        const adjustedTotal = numberOr(total, 0) + bonus;
        const result = originalResolveConcentration(character, check, adjustedTotal);
        return { ...result, baseTotal: numberOr(total, 0), bladesongBonus: bonus, total: adjustedTotal };
      },
    });
    return true;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__bladesingerArchetypeIntegrated) return Boolean(engine?.__bladesingerArchetypeIntegrated);
    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;
    const originalTriggerEncounterStart = typeof engine.triggerEncounterStart === "function" ? engine.triggerEncounterStart : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;

    if (originalApplyDamage) {
      engine.applyDamage = function (unit, damage, ...rest) {
        maintainBladesong(unit);
        const defense = applySongOfDefenseDamage(unit, damage);
        return originalApplyDamage.call(this, unit, defense.damage, ...rest);
      };
    }

    if (originalTriggerEncounterStart) {
      engine.triggerEncounterStart = function (allUnits = [], ...rest) {
        (Array.isArray(allUnits) ? allUnits : []).forEach((unit) => {
          global.LuminousArchetypeRuntime?.syncArchetypeTraitsForUnit?.(unit);
          maintainBladesong(unit);
        });
        return originalTriggerEncounterStart.call(this, allUnits, ...rest);
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits, ...rest) {
        const units = Array.isArray(allUnits) ? allUnits : [];
        units.forEach((unit) => {
          global.LuminousArchetypeRuntime?.syncArchetypeTraitsForUnit?.(unit);
          maintainBladesong(unit);
        });
        return originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
      };
    }

    Object.defineProperty(engine, "__bladesingerArchetypeIntegrated", { value: true, configurable: true });
    return true;
  }

  function watchCombatEngineAssignment() {
    if (global.CombatEngine || global.__luminousBladesingerCombatAssignmentWatch) return false;
    global.__luminousBladesingerCombatAssignmentWatch = true;
    try {
      Object.defineProperty(global, "CombatEngine", {
        configurable: true,
        enumerable: true,
        get() { return undefined; },
        set(value) {
          Object.defineProperty(global, "CombatEngine", { value, writable: true, configurable: true, enumerable: true });
          patchCombatEngine();
        },
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  function install() {
    registerBladesongStatus();
    patchArchetypeCatalog();
    patchCoreCatalog();
    patchTraitEngine();
    patchArchetypeRuntime();
    patchTheatreRolls();
    patchSpellcastingRuntime();
    patchCombatEngine();
    watchCombatEngineAssignment();
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID, ARCHETYPE_NAME, CLASS_ID, CLASS_NAME, STATUS_ID, STATUS_ICON, ARCHETYPE, SOURCE, DEFINITIONS, GRANTS,
    wizardLevel, selectedBladesinger, hasBladesingerLevel, traitBaseId, isBladesingerTrait,
    registerBladesongStatus, ensureTrainingProficiencies, warAndSongWeaponChoice, setWarAndSongWeaponChoice,
    intelligenceModifier, itemIsTwoHanded, equipmentProfile, bladesongEquipmentCompatible, bladesongActive,
    activateBladesong, endBladesong, maintainBladesong, applyAcrobaticsBonus, concentrationSaveBonus,
    songDefenseSlotLevel, songDefensePreflight, armSongOfDefense, consumeSongOfDefense, applySongOfDefenseDamage,
    songOfVictoryDamagePercent,
    patchArchetypeCatalog, patchCoreCatalog, patchTraitEngine, patchArchetypeRuntime, patchTheatreRolls,
    patchSpellcastingRuntime, patchCombatEngine, watchCombatEngineAssignment, install,
  });

  global.LuminousBladesingerArchetypeRuntime = api;
  install();
  if (global.document && global.setInterval) global.setInterval(install, PATCH_INTERVAL_MS);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
