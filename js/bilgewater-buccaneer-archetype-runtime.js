(function (global) {
  "use strict";

  if (global.LuminousBilgewaterBuccaneerArchetypeRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBilgewaterBuccaneerArchetypeRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const ARCHETYPE_ID = "bilgewater_buccaneer";
  const ARCHETYPE_NAME = "Buccaneer";
  const CLASS_ID = "ranger";
  const CLASS_NAME = "Ranger";
  const REGION_ID = "bilgewater";
  const FAMILY_ID = "marksman";
  const TARGET_MARK_STATUS_ID = "target_mark";
  const RICOCHET_SKILL_ID = "buccaneer_ricochet";
  const POWDER_RAIN_SKILL_ID = "powder_rain";
  const BROADSIDE_SKILL_ID = "broadside";
  const PATCH_INTERVAL_MS = 700;

  const archetypeEngine = () => global.LuminousArchetypeEngine || safeRequire("./archetype-engine.js");
  const statusEngine = () => global.LuminousStatusEngine || safeRequire("./status-engine.js");
  const spellcastingRuntime = () => global.LuminousSpellcastingRuntime || safeRequire("./spellcasting-runtime.js");
  const normalizeId = (value) => String(value == null ? "" : value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number.parseInt(value, 10)) ? Number.parseInt(value, 10) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  const ARCHETYPE = Object.freeze({
    id: ARCHETYPE_ID,
    name: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
    regionId: REGION_ID,
    familyId: FAMILY_ID,
    unlockLevel: 15,
    traitLevels: Object.freeze([15, 35, 50, 75, 90]),
  });

  const SOURCE = Object.freeze({
    type: "archetype",
    id: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
    regionId: REGION_ID,
    familyId: FAMILY_ID,
  });

  function skillBase(id, name, extra) {
    return Object.freeze({
      schemaVersion: 2,
      id,
      name,
      tier: 1,
      sourceType: "skill",
      sourceId: id,
      sinAffinity: "sinless",
      availability: Object.freeze({ type: "granted" }),
      deck: Object.freeze({ enabled: false }),
      effects: Object.freeze([]),
      ...extra,
    });
  }

  const RICOCHET_SKILL = skillBase(RICOCHET_SKILL_ID, "Ricochet", {
    type: "Utility",
    basePower: 0,
    coinPower: 0,
    coinAmount: 1,
    coinType: "standard",
    attackWeight: 1,
    atkWeight: 1,
    skillRange: 1,
    targetingType: "self",
    targetType: "self",
    damageType: null,
    isClashable: false,
    isUnclashable: true,
    actionCost: "quick_action",
    economy: "quick_action",
    coins: Object.freeze([{ index: 0, type: "normal", status: "active", effects: Object.freeze([]) }]),
    metadata: Object.freeze({
      archetypeId: ARCHETYPE_ID,
      grantedByTraitId: "ricochet",
      ignoreGridRange: true,
      utilityOnly: true,
    }),
  });

  const POWDER_RAIN_SKILL = skillBase(POWDER_RAIN_SKILL_ID, "Powder Rain", {
    type: "Save",
    basePower: 3,
    coinPower: 3,
    coinAmount: 1,
    coinType: "standard",
    attackWeight: 4,
    atkWeight: 4,
    skillRange: 1,
    rangeType: "ranged",
    isRanged: true,
    targetingType: "area",
    targetType: "area",
    damageType: "perforante",
    isClashable: false,
    isUnclashable: true,
    isIndiscriminate: false,
    actionCost: "quick_action",
    economy: "quick_action",
    save: Object.freeze({ abilityId: "dex", dc: 0, onSuccess: "half" }),
    coins: Object.freeze([{ index: 0, type: "normal", status: "active", effects: Object.freeze([]) }]),
    metadata: Object.freeze({
      archetypeId: ARCHETYPE_ID,
      grantedByTraitId: "powder_rain",
      ignoreGridRange: true,
      weaponRequirement: "pistol",
      failedSave: Object.freeze({ bind: 2, fragile: 2 }),
    }),
  });

  const BROADSIDE_SKILL = skillBase(BROADSIDE_SKILL_ID, "Broadside", {
    type: "Attack",
    basePower: 5,
    coinPower: 4,
    coinAmount: 5,
    coinType: "positive",
    attackWeight: 8,
    atkWeight: 8,
    skillRange: 1,
    rangeType: "ranged",
    isRanged: true,
    targetingType: "Unfocused Volley",
    targetType: "enemies",
    damageType: "perforante",
    isClashable: false,
    isUnclashable: true,
    isIndiscriminate: false,
    coins: Object.freeze(Array.from({ length: 5 }, (_, index) => Object.freeze({ index, type: "normal", status: "active", effects: Object.freeze([]) }))),
    metadata: Object.freeze({
      archetypeId: ARCHETYPE_ID,
      grantedByTraitId: "broadside",
      weaponRequirement: "pistol",
      automatic: true,
      backupDamageMultiplier: 0.25,
      deployedDamageMultiplier: 1,
    }),
  });

  const DEFINITIONS = Object.freeze({
    target_shift: Object.freeze({
      schemaVersion: 1,
      id: "target_shift",
      name: "Target Shift",
      description: "While using a Pistol, the first Hit of a Ranged Skill deals +15% Damage and inflicts Target Mark. A unit with your Target Mark cannot receive the Damage bonus. Hitting a different target moves your Target Mark. Only one unit can have your Target Mark at a time.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        firstHitDamagePercent: 15,
        statusId: TARGET_MARK_STATUS_ID,
        oneMarkPerSource: true,
        weaponChassisId: "pistol",
      },
    }),
    ricochet: Object.freeze({
      schemaVersion: 1,
      id: "ricochet",
      name: "Ricochet",
      description: "Unlock the Ricochet Quick Action. Activate it to empower your next Pistol Ranged Skill this Turn. Its first Hit ricochets to one additional enemy for 50% Damage, or 100% if that Hit defeats the main target.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        grantsSkillId: RICOCHET_SKILL_ID,
        actionCost: "quick_action",
        nextPistolSkill: true,
        ricochetDamageMultiplier: 0.5,
        killRicochetDamageMultiplier: 1,
      },
    }),
    sea_legs: Object.freeze({
      schemaVersion: 1,
      id: "sea_legs",
      name: "Sea Legs",
      description: "At Turn Start, if you did not take Damage during the previous Turn, gain 2 Haste this Turn. When Target Shift activates, gain 1 Haste next Turn. Haste gained from Sea Legs cannot exceed 3.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        noDamageHaste: 2,
        targetShiftHasteNextTurn: 1,
        maxHasteFromTrait: 3,
      },
    }),
    powder_rain: Object.freeze({
      schemaVersion: 1,
      id: "powder_rain",
      name: "Powder Rain",
      description: "Unlock the Powder Rain Quick Action. Up to 4 enemies make a DEX Save against Ranger Spell Save DC. Failed Save: full Damage and 2 Bind + 2 Fragile next Turn. Successful Save: half Damage and no statuses.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        grantsSkillId: POWDER_RAIN_SKILL_ID,
        actionCost: "quick_action",
        saveAbilityId: "dex",
        saveDcSource: "ranger_spell_save_dc",
        attackWeight: 4,
        basePower: 3,
        coinPower: 3,
        failedSave: { bind: 2, fragile: 2 },
        onSuccess: "half",
      },
    }),
    broadside: Object.freeze({
      schemaVersion: 1,
      id: "broadside",
      name: "Broadside",
      description: "Unlock Broadside and Covering Fire. Broadside is a Pistol Ranged Skill with Base Power 5, Coin Power 4, 5 Coins and ATK Weight 8. Each Coin selects and attacks a target independently. While in Backup, Covering Fire activates during the Combat Phase and each Hit deals 25% Damage. While Deployed, Broadside activates at Turn End at full Damage.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        grantsSkillId: BROADSIDE_SKILL_ID,
        automatic: true,
        backupTrigger: "combat_phase",
        backupDamageMultiplier: 0.25,
        deployedTrigger: "turn_end",
        deployedDamageMultiplier: 1,
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
    source: Object.freeze({ ...SOURCE, atLevel: level, requiredClassLevel: level }),
  });

  const GRANTS = Object.freeze([
    grant(15, "target_shift"),
    grant(35, "ricochet"),
    grant(50, "sea_legs"),
    grant(75, "powder_rain"),
    grant(90, "broadside"),
  ]);

  function normalizedCharacter(character = {}) {
    if (Array.isArray(character.classes)) return character;
    if (Array.isArray(character.characterBuild?.classes)) return { ...character, classes: character.characterBuild.classes };
    return character;
  }

  function rangerLevel(character = {}) {
    const engine = archetypeEngine();
    if (engine?.getClassLevel) return Math.max(0, intOr(engine.getClassLevel(normalizedCharacter(character), CLASS_ID), 0));
    const classes = Array.isArray(character.classes) ? character.classes : Array.isArray(character.characterBuild?.classes) ? character.characterBuild.classes : [];
    const found = classes.find((entry) => normalizeId(entry?.classId || entry?.id || entry?.name) === CLASS_ID);
    return Math.max(0, intOr(found?.levels ?? found?.level ?? found?.classLevel, 0));
  }

  function selectedBuccaneer(character = {}) {
    const engine = archetypeEngine();
    if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    const raw = character.characterBuild?.archetypes ?? character.archetypes ?? [];
    const list = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return list.some((entry) => normalizeId(entry?.classId || entry?.parentClassId) === CLASS_ID && normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id) === ARCHETYPE_ID);
  }

  function hasLevel(character = {}, level = 0) {
    return selectedBuccaneer(character) && rangerLevel(character) >= Number(level || 0);
  }

  function entityId(entity = {}) {
    return String(entity.combatId ?? entity.combat_id ?? entity.unitId ?? entity.unit_id ?? entity.id ?? entity.playerId ?? entity.characterId ?? entity.actorId ?? entity.name ?? "").trim();
  }

  function ids(value) {
    if (Array.isArray(value)) return value.map(normalizeId).filter(Boolean);
    return [normalizeId(value)].filter(Boolean);
  }

  function isPistolWeapon(weapon = {}) {
    if (!weapon || typeof weapon !== "object") return false;
    const candidates = [
      weapon.chassisId, weapon.chassis_id, weapon.weaponChassisId, weapon.weapon_chassis_id,
      weapon.profile?.chassisId, weapon.profile?.chassis_id, weapon.weaponProfile?.chassisId,
      weapon.runtimeState?.chassisId, weapon.runtime_state?.chassisId,
      weapon.definition?.chassisId, weapon.definition?.chassis_id,
    ].map(normalizeId);
    const tags = [
      ...ids(weapon.tags),
      ...ids(weapon.itemTags),
      ...ids(weapon.weaponTags),
      normalizeId(weapon.name),
      normalizeId(weapon.definitionId),
      normalizeId(weapon.id),
    ];
    return candidates.includes("pistol") || tags.includes("pistol") || tags.some((tag) => tag.includes("pistol"));
  }

  function isPistolSkill(skill = {}) {
    if (!skill || typeof skill !== "object") return false;
    const candidates = [
      skill.chassisId, skill.chassis_id, skill.weaponChassisId, skill.weapon_chassis_id,
      skill.metadata?.chassisId, skill.metadata?.chassis_id,
      skill.metadata?.weaponChassisId, skill.metadata?.weapon_chassis_id,
      skill.weapon?.chassisId, skill.weapon?.chassis_id,
      skill.weaponProfile?.chassisId, skill.weaponProfile?.chassis_id,
      skill.profile?.chassisId, skill.profile?.chassis_id,
    ].map(normalizeId);
    const tags = [
      ...ids(skill.tags),
      ...ids(skill.skillTags),
      ...ids(skill.weaponTags),
      ...ids(skill.metadata?.tags),
      normalizeId(skill.weaponType),
      normalizeId(skill.weapon_type),
    ];
    return candidates.includes("pistol") || tags.includes("pistol") || tags.some((tag) => tag.includes("pistol"));
  }

  function isRangedSkill(skill = {}) {
    const values = [
      skill.attackMode, skill.attack_mode, skill.rangeType, skill.range_type,
      skill.isRanged === true ? "ranged" : "", skill.metadata?.attackMode,
    ].map(normalizeId);
    if (values.some((value) => ["range", "ranged", "ranged_attack"].includes(value))) return true;
    if (isPistolSkill(skill)) return true;
    const range = Number(skill.skillRange ?? skill.range ?? skill.metadata?.skillRange);
    return Number.isFinite(range) ? range > 1 : false;
  }

  function isPistolRangedSkill(skill = {}) {
    return isPistolSkill(skill) && isRangedSkill(skill);
  }

  function equippedItems(unit = {}) {
    const equipment = unit.equipment && typeof unit.equipment === "object" ? unit.equipment : {};
    return [equipment.mainHand, equipment.main_hand, equipment.offHand, equipment.off_hand, unit.mainHand, unit.main_hand, unit.offHand, unit.off_hand].filter((item) => item && typeof item === "object");
  }

  function equippedPistol(unit = {}) {
    return equippedItems(unit).find(isPistolWeapon) || null;
  }

  function rangerSpellSaveDC(character = {}) {
    const runtime = spellcastingRuntime();
    const resolved = runtime?.resolveSpellcasting?.(character, CLASS_ID);
    if (Number.isFinite(Number(resolved?.spellDC))) return Number(resolved.spellDC);
    const proficiency = numberOr(character.proficiency ?? character.proficiencyBonus ?? character.proficiency_bonus, 0);
    const wisdomScore = numberOr(character.stats?.wis ?? character.stats?.wisdom ?? character.wis ?? character.wisdom, 10);
    const wisdomMod = Math.floor((wisdomScore - 10) / 2);
    return 8 + proficiency + wisdomMod;
  }

  function ricochetSkill(character = {}) {
    return clone(RICOCHET_SKILL);
  }

  function powderRainSkill(character = {}) {
    const skill = clone(POWDER_RAIN_SKILL);
    const dc = rangerSpellSaveDC(character);
    skill.save = { ...skill.save, dc };
    skill.saveDC = dc;
    return skill;
  }

  function broadsideSkill(character = {}, damageMultiplier = 1) {
    const skill = clone(BROADSIDE_SKILL);
    skill.__buccaneerBroadsideDamageMultiplier = Math.max(0, numberOr(damageMultiplier, 1));
    return skill;
  }

  function applyStatus(unit, statusId, input = {}) {
    const engine = statusEngine();
    if (engine?.applyStatus) return engine.applyStatus(unit, statusId, input);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object") unit.statusEffects = {};
    const id = normalizeId(statusId);
    const existing = unit.statusEffects[id] || { id, count: 0, potency: 0, data: {} };
    const mode = normalizeId(input.mode || "gain");
    const count = Math.max(0, numberOr(input.count, 0));
    const potency = Math.max(0, numberOr(input.potency, 0));
    unit.statusEffects[id] = {
      ...existing,
      ...input,
      id,
      count: mode === "set" ? count : numberOr(existing.count, 0) + count,
      potency: mode === "set" ? potency : numberOr(existing.potency, 0) + potency,
      data: { ...(existing.data || {}), ...(input.data || {}) },
    };
    return unit.statusEffects[id];
  }

  function getStatus(unit, statusId) {
    const engine = statusEngine();
    if (engine?.getStatus) return engine.getStatus(unit, statusId);
    return unit?.statusEffects?.[normalizeId(statusId)] || null;
  }

  function removeStatus(unit, statusId) {
    const engine = statusEngine();
    if (engine?.removeStatus) return engine.removeStatus(unit, statusId, { from: "buccaneer", ignoreProtection: true });
    const id = normalizeId(statusId);
    if (unit?.statusEffects?.[id]) { delete unit.statusEffects[id]; return true; }
    return false;
  }

  function targetMarkSources(target = {}) {
    const entry = getStatus(target, TARGET_MARK_STATUS_ID);
    const raw = entry?.data?.sourceUnitIds;
    return Array.isArray(raw) ? raw.map(String) : [];
  }

  function hasOwnTargetMark(attacker = {}, target = {}) {
    const sourceId = entityId(attacker);
    return Boolean(sourceId && targetMarkSources(target).includes(sourceId));
  }

  function removeSourceMark(target = {}, sourceId) {
    const entry = getStatus(target, TARGET_MARK_STATUS_ID);
    if (!entry) return false;
    const sources = targetMarkSources(target).filter((id) => id !== String(sourceId));
    if (!sources.length) return removeStatus(target, TARGET_MARK_STATUS_ID);
    entry.data = { ...(entry.data || {}), sourceUnitIds: sources };
    return true;
  }

  function moveTargetMark(attacker = {}, target = {}) {
    if (!hasLevel(attacker, 15) || !target) return false;
    const sourceId = entityId(attacker);
    const previous = attacker.__buccaneerTargetMarkTarget;
    if (previous && previous !== target) removeSourceMark(previous, sourceId);
    const sources = [...new Set([...targetMarkSources(target), sourceId].filter(Boolean))];
    applyStatus(target, TARGET_MARK_STATUS_ID, {
      mode: "set",
      count: 1,
      sourceUnitId: sourceId,
      sourceTraitId: "target_shift",
      data: { sourceUnitIds: sources },
    });
    attacker.__buccaneerTargetMarkTarget = target;
    attacker.__buccaneerTargetMarkTargetId = entityId(target);
    return true;
  }

  function queueSeaLegsFromTargetShift(character = {}) {
    if (!hasLevel(character, 50)) return 0;
    character.__buccaneerSeaLegsPending = Math.min(1, Math.max(0, intOr(character.__buccaneerSeaLegsPending, 0)) + 1);
    return character.__buccaneerSeaLegsPending;
  }

  function applySeaLegsAtTurnStart(character = {}) {
    if (!hasLevel(character, 50)) return 0;
    const pending = Math.min(1, Math.max(0, intOr(character.__buccaneerSeaLegsPending, 0)));
    character.__buccaneerSeaLegsPending = 0;
    const tookDamage = character.took_damage_last_turn === true || character.tookDamageLastTurn === true;
    const amount = Math.min(3, (tookDamage ? 0 : 2) + pending);
    if (amount > 0) applyStatus(character, "haste", { count: amount, mode: "gain", sourceTraitId: "sea_legs", data: { seaLegsCount: amount } });
    return amount;
  }

  function armRicochet(character = {}) {
    if (!hasLevel(character, 35)) return false;
    character.__buccaneerRicochetArmed = true;
    return true;
  }

  function clearRicochet(character = {}) {
    character.__buccaneerRicochetArmed = false;
    return true;
  }

  function queuePowderRainFailedSave(target = {}) {
    if (!target) return null;
    const pending = target.__buccaneerPowderRainPending || { bind: 0, fragile: 0 };
    pending.bind = Math.max(0, intOr(pending.bind, 0)) + 2;
    pending.fragile = Math.max(0, intOr(pending.fragile, 0)) + 2;
    target.__buccaneerPowderRainPending = pending;
    return { ...pending };
  }

  function applyPendingPowderRain(target = {}) {
    const pending = target?.__buccaneerPowderRainPending;
    if (!pending) return { bind: 0, fragile: 0 };
    delete target.__buccaneerPowderRainPending;
    if (pending.bind > 0) applyStatus(target, "bind", { count: pending.bind, mode: "gain", sourceTraitId: "powder_rain" });
    if (pending.fragile > 0) applyStatus(target, "fragile", { count: pending.fragile, mode: "gain", sourceTraitId: "powder_rain" });
    return { bind: pending.bind, fragile: pending.fragile };
  }

  function onTurnStart(character = {}) {
    return {
      powderRain: applyPendingPowderRain(character),
      seaLegs: applySeaLegsAtTurnStart(character),
    };
  }

  function onTurnEnd(character = {}) {
    clearRicochet(character);
    character.__buccaneerBroadsideTurnEndUsed = false;
    return true;
  }

  function grantedSkillIds(character = {}) {
    const out = [];
    if (hasLevel(character, 35)) out.push(RICOCHET_SKILL_ID);
    if (hasLevel(character, 75)) out.push(POWDER_RAIN_SKILL_ID);
    return out;
  }

  function skillDefinition(character = {}, skillId) {
    const id = normalizeId(skillId);
    if (id === RICOCHET_SKILL_ID && hasLevel(character, 35)) return ricochetSkill(character);
    if (id === POWDER_RAIN_SKILL_ID && hasLevel(character, 75)) return powderRainSkill(character);
    if (id === BROADSIDE_SKILL_ID && hasLevel(character, 90)) return broadsideSkill(character, 1);
    return null;
  }

  function registerTargetMarkStatus() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") return false;
    global.STATUS_REGISTRY[TARGET_MARK_STATUS_ID] = {
      ...(global.STATUS_REGISTRY[TARGET_MARK_STATUS_ID] || {}),
      name: "Target Mark",
      type: "negative",
      mode: "single",
      maxCount: 1,
      description: "Source-aware marker used by the Buccaneer Target Shift trait. It has no effect by itself.",
    };
    return true;
  }

  function patchSkillRegistry() {
    const registry = global.SKILL_REGISTRY;
    if (!registry || typeof registry !== "object") return false;
    if (!registry[RICOCHET_SKILL_ID]) registry[RICOCHET_SKILL_ID] = clone(RICOCHET_SKILL);
    if (!registry[POWDER_RAIN_SKILL_ID]) registry[POWDER_RAIN_SKILL_ID] = clone(POWDER_RAIN_SKILL);
    if (!registry[BROADSIDE_SKILL_ID]) registry[BROADSIDE_SKILL_ID] = clone(BROADSIDE_SKILL);
    return true;
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || !source?.allGrants || !source?.allArchetypes) return false;
    if (source.__bilgewaterBuccaneerArchetypeIntegrated) return true;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;
    global.LuminousArchetypeTraitCatalog = Object.freeze({
      ...source,
      __bilgewaterBuccaneerArchetypeIntegrated: true,
      BILGEWATER_BUCCANEER_ID: ARCHETYPE_ID,
      ARCHETYPES: Object.freeze({ ...(source.ARCHETYPES || {}), [ARCHETYPE_ID]: ARCHETYPE }),
      DEFINITIONS: Object.freeze({ ...(source.DEFINITIONS || {}), ...DEFINITIONS }),
      GRANTS: Object.freeze([...(source.GRANTS || []), ...GRANTS]),
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS.map((entry) => ({ ...entry, source: { ...(entry.source || {}) } }))]; },
      allArchetypes() { return { ...originalArchetypes(), [ARCHETYPE_ID]: { ...ARCHETYPE } }; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
      resolveTraitGrants(character = {}, definitions) {
        const base = originalResolve ? originalResolve(character, definitions) || [] : [];
        const engine = archetypeEngine();
        const extra = engine?.resolveTraitGrants ? engine.resolveTraitGrants(character, GRANTS, definitions ? { ...definitions, ...DEFINITIONS } : DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || [] : [];
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
    if (!source?.allDefinitions || !source?.allGrants || source.__bilgewaterBuccaneerArchetypeIntegrated) return Boolean(source?.__bilgewaterBuccaneerArchetypeIntegrated);
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __bilgewaterBuccaneerArchetypeIntegrated: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS]; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__bilgewaterBuccaneerArchetypeIntegrated) return Boolean(source?.__bilgewaterBuccaneerArchetypeIntegrated);
    const originalResolve = source.resolveTraitGrants.bind(source);
    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __bilgewaterBuccaneerArchetypeIntegrated: true,
      resolveTraitGrants(character = {}, grants = [], definitions = {}) {
        const base = originalResolve(character, grants, definitions) || [];
        const engine = archetypeEngine();
        const extra = engine?.resolveTraitGrants ? engine.resolveTraitGrants(character, GRANTS, { ...definitions, ...DEFINITIONS }, { [ARCHETYPE_ID]: ARCHETYPE }, source) || [] : [];
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

  function isBuccaneerTrait(trait = {}) {
    const source = trait.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType))
      && normalizeId(source.archetypeId || source.id) === ARCHETYPE_ID;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__bilgewaterBuccaneerArchetypeIntegrated) return Boolean(source?.__bilgewaterBuccaneerArchetypeIntegrated);
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    global.LuminousArchetypeRuntime = Object.freeze({
      ...source,
      __bilgewaterBuccaneerArchetypeIntegrated: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const engine = archetypeEngine();
        const granted = engine?.resolveTraitGrants ? engine.resolveTraitGrants(unit, GRANTS, DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || [] : [];
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isBuccaneerTrait(trait)), ...granted].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        unit.traitDefinitions = [...byId.values()];
        return [...base, ...granted];
      },
    });
    return true;
  }

  function install() {
    registerTargetMarkStatus();
    patchSkillRegistry();
    patchArchetypeCatalog();
    patchCoreCatalog();
    patchTraitEngine();
    patchArchetypeRuntime();
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID, ARCHETYPE_NAME, CLASS_ID, CLASS_NAME, REGION_ID, FAMILY_ID,
    TARGET_MARK_STATUS_ID, RICOCHET_SKILL_ID, POWDER_RAIN_SKILL_ID, BROADSIDE_SKILL_ID,
    ARCHETYPE, SOURCE, DEFINITIONS, GRANTS, RICOCHET_SKILL, POWDER_RAIN_SKILL, BROADSIDE_SKILL,
    rangerLevel, selectedBuccaneer, hasLevel, entityId,
    isPistolWeapon, isPistolSkill, isRangedSkill, isPistolRangedSkill, equippedPistol,
    rangerSpellSaveDC, ricochetSkill, powderRainSkill, broadsideSkill,
    applyStatus, getStatus, removeStatus, hasOwnTargetMark, moveTargetMark,
    queueSeaLegsFromTargetShift, applySeaLegsAtTurnStart,
    armRicochet, clearRicochet,
    queuePowderRainFailedSave, applyPendingPowderRain, onTurnStart, onTurnEnd,
    grantedSkillIds, skillDefinition,
    registerTargetMarkStatus, patchSkillRegistry, patchArchetypeCatalog, patchCoreCatalog, patchTraitEngine, patchArchetypeRuntime, install,
  });

  global.LuminousBilgewaterBuccaneerArchetypeRuntime = api;
  install();
  if (global.setInterval) { const timer = global.setInterval(install, PATCH_INTERVAL_MS); timer?.unref?.(); }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
