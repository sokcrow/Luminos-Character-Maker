(function (global) {
  "use strict";

  if (global.LuminousBilgewaterDemolisherArchetypeRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBilgewaterDemolisherArchetypeRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const ARCHETYPE_ID = "bilgewater_demolisher";
  const ARCHETYPE_NAME = "Demolisher";
  const FAMILY_ID = "marksman";
  const CLASS_ID = "ranger";
  const CLASS_NAME = "Ranger";
  const REGION_ID = "bilgewater";
  const DOCTRINE_ID = "demolisher";
  const DOCTRINE_NAME = "Demolisher";
  const SMOKE_SCREEN_SKILL_ID = "smoke_screen";
  const SMOKE_SCREEN_STATUS_ID = "smoke_screened";
  const PATCH_INTERVAL_MS = 700;

  const archetypeEngine = () => global.LuminousArchetypeEngine || safeRequire("./archetype-engine.js");
  const statusEngine = () => global.LuminousStatusEngine || safeRequire("./status-engine.js");
  const spellcastingRuntime = () => global.LuminousSpellcastingRuntime || safeRequire("./spellcasting-runtime.js");
  const fixedDamageRuntime = () => global.LuminousFixedDamageRuntime || safeRequire("./fixed-damage-runtime.js");
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
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
    doctrines: Object.freeze([{ id: DOCTRINE_ID, name: DOCTRINE_NAME, default: true }]),
  });

  const SOURCE = Object.freeze({
    type: "archetype",
    id: ARCHETYPE_ID,
    archetypeId: ARCHETYPE_ID,
    archetypeName: ARCHETYPE_NAME,
    classId: CLASS_ID,
    className: CLASS_NAME,
    regionId: REGION_ID,
    doctrineId: DOCTRINE_ID,
    doctrineName: DOCTRINE_NAME,
  });

  const SMOKE_SCREEN_SKILL = Object.freeze({
    schemaVersion: 2,
    id: SMOKE_SCREEN_SKILL_ID,
    name: "Smoke Screen",
    type: "Save",
    tier: 1,
    basePower: 0,
    coinPower: 0,
    coinAmount: 1,
    coinType: "standard",
    attackWeight: 3,
    atkWeight: 3,
    skillRange: 1,
    rangeType: "ranged",
    isRanged: true,
    targetingType: "area",
    targetType: "area",
    damageType: null,
    sinAffinity: "sinless",
    isClashable: false,
    isUnclashable: true,
    isIndiscriminate: false,
    availability: Object.freeze({ type: "granted" }),
    deck: Object.freeze({ enabled: false }),
    save: Object.freeze({ abilityId: "dex", dc: 0, onSuccess: "negates" }),
    actionCost: "action",
    effects: Object.freeze([]),
    coins: Object.freeze([{ index: 0, type: "normal", status: "active", effects: Object.freeze([]) }]),
    sourceType: "skill",
    sourceId: SMOKE_SCREEN_SKILL_ID,
    metadata: Object.freeze({
      archetypeId: ARCHETYPE_ID,
      doctrineId: DOCTRINE_ID,
      grantedByTraitId: "smoke_screen",
      ignoreGridRange: true,
      damage: "none",
    }),
  });

  const DEFINITIONS = Object.freeze({
    new_destiny: Object.freeze({
      schemaVersion: 1,
      id: "new_destiny",
      name: "New Destiny",
      description: "Shotgun Ranged Skills deal +20% Damage. Shotgun Ranged Skills gain +1 ATK Weight. Secondary targets take only 60% of the Damage dealt to the main target. Shotguns deal +10% Critical Damage.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        doctrineId: DOCTRINE_ID,
        weaponChassisId: "shotgun",
        damagePercent: 20,
        attackWeightBonus: 1,
        secondaryTargetDamageMultiplier: 0.60,
        criticalDamagePercent: 10,
      },
    }),
    smoke_screen: Object.freeze({
      schemaVersion: 1,
      id: "smoke_screen",
      name: "Smoke Screen",
      description: "Unlock the Smoke Screen Skill. It is an Action, DEX Save Skill with ATK Weight 3. Each target that fails gains 3 Bind and 3 Clash Power Down next Turn. While an enemy is affected by Smoke Screen, you deal +10% Damage to that enemy. A successful Save negates all effects.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: {
        doctrineId: DOCTRINE_ID,
        grantsSkillId: SMOKE_SCREEN_SKILL_ID,
        actionCost: "action",
        resolution: "save",
        saveAbilityId: "dex",
        saveDcSource: "ranger_spell_save_dc",
        attackWeight: 3,
        failedSave: { bind: 3, clashPowerDown: 3 },
        sourceDamagePercent: 10,
        onSuccess: "negates",
      },
    }),
    quickdraw: Object.freeze({
      schemaVersion: 1,
      id: "quickdraw",
      name: "Quickdraw",
      description: "At Turn Start, if you have Haste, reload 1 Shotgun Ammunition for free.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { doctrineId: DOCTRINE_ID, trigger: "turn_start", requiresStatus: "haste", reloadShotgunAmmo: 1, actionCost: "none" },
    }),
    true_grit: Object.freeze({
      schemaVersion: 1,
      id: "true_grit",
      name: "True Grit",
      description: "When a Shotgun Ranged Skill Hits, gain 1 Protection next Turn. Max 1 activation per Skill. True Grit can grant up to 3 Protection at a time.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { doctrineId: DOCTRINE_ID, trigger: "shotgun_skill_hit", protectionNextTurn: 1, maxPerSkill: 1, maxProtection: 3 },
    }),
    collateral_damage: Object.freeze({
      schemaVersion: 1,
      id: "collateral_damage",
      name: "Collateral Damage",
      description: "When a Shotgun Ranged Skill Hits, its main target takes additional Fixed Damage equal to your Ranger Level ÷ 5. Secondary targets take Fixed Damage equal to half that amount. Triggers once per Skill.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { doctrineId: DOCTRINE_ID, fixedDamageFormula: "floor(RangerLevel / 5)", secondaryMultiplier: 0.5, oncePerSkill: true },
    }),
    end_of_the_line: Object.freeze({
      schemaVersion: 1,
      id: "end_of_the_line",
      name: "End of the Line",
      description: "When a Shotgun Ranged Skill Hits its main target, mark that target until Attack End. At Attack End, the marked target takes an additional Hit equal to 30% of the Damage dealt by that Skill. Triggers once per Turn.",
      source: SOURCE,
      contexts: ["combat"],
      activation: { type: "passive", actionCost: "none" },
      effects: [],
      rules: [],
      mechanics: { doctrineId: DOCTRINE_ID, mainTargetOnly: true, attackEndDamageMultiplier: 0.30, oncePerTurn: true },
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
    grant(15, "new_destiny"),
    grant(35, "smoke_screen"),
    grant(50, "quickdraw"),
    grant(50, "true_grit"),
    grant(75, "collateral_damage"),
    grant(90, "end_of_the_line"),
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

  function selectedBilgewaterDemolisher(character = {}) {
    const engine = archetypeEngine();
    if (engine?.isSelected) return Boolean(engine.isSelected(character, ARCHETYPE_ID, CLASS_ID));
    const raw = character.characterBuild?.archetypes ?? character.archetypes ?? [];
    const list = Array.isArray(raw) ? raw : Object.entries(raw || {}).map(([classId, value]) => typeof value === "string" ? { classId, archetypeId: value } : { classId, ...(value || {}) });
    return list.some((entry) => normalizeId(entry?.classId || entry?.parentClassId) === CLASS_ID && normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id) === ARCHETYPE_ID);
  }

  function hasLevel(character, level) {
    return selectedBilgewaterDemolisher(character) && rangerLevel(character) >= Number(level || 0);
  }

  function entityId(entity = {}) {
    return String(entity.combatId ?? entity.combat_id ?? entity.unitId ?? entity.unit_id ?? entity.id ?? entity.playerId ?? entity.characterId ?? entity.actorId ?? entity.name ?? "").trim();
  }

  function ids(value) {
    if (Array.isArray(value)) return value.map(normalizeId).filter(Boolean);
    return [normalizeId(value)].filter(Boolean);
  }

  function isShotgunWeapon(weapon = {}) {
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
    return candidates.includes("shotgun") || tags.includes("shotgun") || tags.some((tag) => tag.includes("shotgun"));
  }

  function isShotgunSkill(skill = {}) {
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
    return candidates.includes("shotgun") || tags.includes("shotgun") || tags.some((tag) => tag.includes("shotgun"));
  }

  function isRangedSkill(skill = {}) {
    const values = [
      skill.attackMode, skill.attack_mode, skill.rangeType, skill.range_type,
      skill.isRanged === true ? "ranged" : "", skill.metadata?.attackMode,
    ].map(normalizeId);
    if (values.some((value) => ["range", "ranged", "ranged_attack"].includes(value))) return true;
    if (isShotgunSkill(skill)) return true;
    const range = Number(skill.skillRange ?? skill.range ?? skill.metadata?.skillRange);
    return Number.isFinite(range) ? range > 1 : false;
  }

  function isShotgunRangedSkill(skill = {}) {
    return isShotgunSkill(skill) && isRangedSkill(skill);
  }

  function decorateShotgunSkill(character = {}, skillInput = {}) {
    const skill = clone(skillInput || {});
    if (!hasLevel(character, 15) || !isShotgunRangedSkill(skill)) return skill;
    if (skill.metadata?.bilgewaterDemolisher?.newDestiny === true) return skill;
    const baseWeight = Math.max(1, intOr(skill.attackWeight ?? skill.atkWeight ?? skill.weight, 1));
    const weight = baseWeight + 1;
    skill.attackWeight = weight;
    skill.atkWeight = weight;
    skill.metadata = {
      ...(skill.metadata || {}),
      bilgewaterDemolisher: {
        doctrineId: DOCTRINE_ID,
        newDestiny: true,
        baseAttackWeight: baseWeight,
        attackWeight: weight,
        secondaryTargetDamageMultiplier: 0.60,
        damageMultiplier: 1.20,
        criticalDamageMultiplier: 1.10,
      },
    };
    return skill;
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

  function smokeScreenSkill(character = {}) {
    const skill = clone(SMOKE_SCREEN_SKILL);
    skill.save = { ...skill.save, dc: rangerSpellSaveDC(character) };
    skill.saveDC = skill.save.dc;
    return skill;
  }

  function smokeScreenUnlocked(character = {}) { return hasLevel(character, 35); }

  function grantSmokeScreenToUnit(unit = {}) {
    if (!smokeScreenUnlocked(unit)) return false;
    const skill = smokeScreenSkill(unit);
    if (!Array.isArray(unit.grantedSkillDefinitions)) unit.grantedSkillDefinitions = [];
    if (!unit.grantedSkillDefinitions.some((entry) => normalizeId(entry?.id) === SMOKE_SCREEN_SKILL_ID)) unit.grantedSkillDefinitions.push(skill);
    if (!Array.isArray(unit.grantedSkillIds)) unit.grantedSkillIds = [];
    if (!unit.grantedSkillIds.includes(SMOKE_SCREEN_SKILL_ID)) unit.grantedSkillIds.push(SMOKE_SCREEN_SKILL_ID);
    return true;
  }

  function hasStatus(unit = {}, statusId) {
    const engine = statusEngine();
    if (engine?.hasStatus) return engine.hasStatus(unit, statusId);
    return Boolean(unit.statusEffects?.[normalizeId(statusId)] || unit.statuses?.[normalizeId(statusId)]);
  }

  function getStatus(unit = {}, statusId) {
    const engine = statusEngine();
    if (engine?.getStatus) return engine.getStatus(unit, statusId);
    return unit.statusEffects?.[normalizeId(statusId)] || unit.statuses?.[normalizeId(statusId)] || null;
  }

  function applyStatus(unit, statusId, input = {}) {
    const engine = statusEngine();
    if (engine?.applyStatus) return engine.applyStatus(unit, statusId, input);
    if (!unit.statusEffects || typeof unit.statusEffects !== "object") unit.statusEffects = {};
    const id = normalizeId(statusId);
    const existing = unit.statusEffects[id] || { id, count: 0, potency: 0 };
    const mode = normalizeId(input.mode || "gain");
    const count = Math.max(0, numberOr(input.count, 1));
    unit.statusEffects[id] = {
      ...existing,
      ...input,
      id,
      count: mode === "set" ? count : numberOr(existing.count, 0) + count,
      potency: mode === "set" ? numberOr(input.potency, 0) : numberOr(existing.potency, 0) + numberOr(input.potency, 0),
    };
    return unit.statusEffects[id];
  }

  function applySmokeScreenFailedSave(caster = {}, target = {}) {
    if (!smokeScreenUnlocked(caster) || !target) return null;
    const sourceUnitId = entityId(caster);
    const pending = {
      bind: 3,
      clashPowerDown: 3,
      sourceUnitId,
      sourceTraitId: "smoke_screen",
    };
    target.__bilgewaterSmokeScreenPending = pending;
    applyStatus(target, SMOKE_SCREEN_STATUS_ID, {
      mode: "set",
      count: 1,
      sourceUnitId,
      sourceTraitId: "smoke_screen",
      duration: "next_turn_end",
      data: { durationTurnsRemaining: 2, damageTakenFromSourcePercent: 10 },
    });
    return pending;
  }

  function applyPendingSmokeScreen(unit = {}) {
    const pending = unit.__bilgewaterSmokeScreenPending;
    if (!pending) return null;
    applyStatus(unit, "bind", { mode: "gain", count: pending.bind, sourceUnitId: pending.sourceUnitId, sourceTraitId: pending.sourceTraitId });
    applyStatus(unit, "clash_power_down", { mode: "gain", count: pending.clashPowerDown, sourceUnitId: pending.sourceUnitId, sourceTraitId: pending.sourceTraitId });
    delete unit.__bilgewaterSmokeScreenPending;
    return pending;
  }

  function smokeScreenDamageMultiplier(attacker = {}, defender = {}) {
    const marker = getStatus(defender, SMOKE_SCREEN_STATUS_ID);
    if (!marker) return 1;
    return marker.sourceUnitId && marker.sourceUnitId === entityId(attacker) ? 1.10 : 1;
  }

  function shotgunDamageMultiplier(attacker = {}, defender = {}, skill = {}, options = {}) {
    if (!hasLevel(attacker, 15) || !isShotgunRangedSkill(skill)) return 1;
    let multiplier = 1.20;
    if (options.isCritical === true) multiplier *= 1.10;
    if (options.isSecondaryTarget === true) multiplier *= 0.60;
    multiplier *= smokeScreenDamageMultiplier(attacker, defender);
    return multiplier;
  }

  function collateralFixedDamage(character = {}, isSecondaryTarget = false) {
    if (!hasLevel(character, 75)) return 0;
    const base = Math.floor(rangerLevel(character) / 5);
    return Math.max(0, isSecondaryTarget ? Math.floor(base * 0.5) : base);
  }

  function applyCollateralDamage(attacker = {}, target = {}, options = {}) {
    const amount = collateralFixedDamage(attacker, options.isSecondaryTarget === true);
    if (!amount || !target) return { applied: false, damage: 0 };
    const runtime = fixedDamageRuntime();
    if (runtime?.applyFixedDamage) {
      const result = runtime.applyFixedDamage(target, amount, { engine: options.engine || global.CombatEngine, damageKind: "directo", skillUsed: options.skill || null });
      return { applied: true, damage: amount, result };
    }
    if (options.engine?.applyDamage) {
      const result = options.engine.applyDamage(target, amount, "directo", false, options.skill || null);
      return { applied: true, damage: amount, result, fallback: true };
    }
    return { applied: false, damage: amount, reason: "fixed_damage_runtime_unavailable" };
  }

  function queueTrueGrit(character = {}) {
    if (!hasLevel(character, 50)) return 0;
    character.__bilgewaterTrueGritPending = Math.min(3, Math.max(0, intOr(character.__bilgewaterTrueGritPending, 0)) + 1);
    return character.__bilgewaterTrueGritPending;
  }

  function applyTrueGritAtTurnStart(character = {}) {
    if (!hasLevel(character, 50)) return 0;
    const pending = Math.min(3, Math.max(0, intOr(character.__bilgewaterTrueGritPending, 0)));
    character.__bilgewaterTrueGritPending = 0;
    if (!pending) return 0;
    const existing = getStatus(character, "protection");
    const priorTrueGrit = Math.max(0, intOr(existing?.data?.trueGritCount, 0));
    const baseCount = Math.max(0, intOr(existing?.count, 0) - priorTrueGrit);
    applyStatus(character, "protection", {
      mode: "set",
      count: baseCount + pending,
      sourceUnitId: entityId(character),
      sourceTraitId: "true_grit",
      data: { ...(existing?.data || {}), trueGritCount: pending },
    });
    return pending;
  }

  function equippedItems(unit = {}) {
    const equipment = unit.equipment && typeof unit.equipment === "object" ? unit.equipment : {};
    return [equipment.mainHand, equipment.main_hand, equipment.offHand, equipment.off_hand, unit.mainHand, unit.main_hand, unit.offHand, unit.off_hand].filter((item) => item && typeof item === "object");
  }

  function equippedShotgun(unit = {}) {
    return equippedItems(unit).find(isShotgunWeapon) || null;
  }

  function firearmState(weapon = {}) {
    const candidates = [
      weapon.runtimeState?.firearm,
      weapon.runtime_state?.firearm,
      weapon.firearmState,
      weapon.firearm_state,
      weapon.weaponState,
      weapon.weapon_state,
      weapon.runtimeState,
      weapon.runtime_state,
      weapon,
    ];
    return candidates.find((state) => state && typeof state === "object" && (Number.isFinite(Number(state.loadedAmmo)) || Number.isFinite(Number(state.loaded_ammo)))) || null;
  }

  function weaponCapacity(weapon = {}, state = {}) {
    const candidates = [state.capacity, state.maxAmmo, state.max_ammo, weapon.capacity, weapon.profile?.capacity, weapon.weaponProfile?.capacity];
    const found = candidates.map(Number).find(Number.isFinite);
    return Math.max(0, intOr(found, 0));
  }

  function activeInventory(unit = {}) {
    const keys = ["inventario_activo", "activeInventory", "inventory", "inventario"];
    for (const key of keys) {
      const value = unit[key];
      if (value && typeof value === "object") return { key, value };
    }
    return null;
  }

  function itemQuantity(item = {}) {
    return Math.max(0, intOr(item.quantity ?? item.qty ?? item.cantidad ?? item.stack ?? item.count, 1));
  }

  function setItemQuantity(item = {}, value) {
    const next = Math.max(0, intOr(value, 0));
    if (Object.prototype.hasOwnProperty.call(item, "qty")) item.qty = next;
    else if (Object.prototype.hasOwnProperty.call(item, "cantidad")) item.cantidad = next;
    else if (Object.prototype.hasOwnProperty.call(item, "stack")) item.stack = next;
    else if (Object.prototype.hasOwnProperty.call(item, "count") && !Object.prototype.hasOwnProperty.call(item, "quantity")) item.count = next;
    else item.quantity = next;
    return next;
  }

  function isFirearmAmmo(item = {}, weapon = {}) {
    const fields = [
      item.family, item.category, item.itemType, item.item_type, item.ammoFamily, item.ammo_family,
      ...(Array.isArray(item.tags) ? item.tags : []),
      ...(Array.isArray(item.itemTags) ? item.itemTags : []),
    ].map(normalizeId);
    const compatible = fields.some((id) => ["firearm_ammunition", "firearm_ammo", "ammo", "ammunition", "munition"].includes(id) || id.includes("firearm_ammo"));
    if (!compatible) return false;
    const weaponCaliber = intOr(weapon.caliberTier ?? weapon.caliber_tier ?? weapon.profile?.caliberTier ?? weapon.runtimeState?.caliberTier, 0);
    const ammoCaliber = intOr(item.caliberTier ?? item.caliber_tier ?? item.ammoProfile?.caliberTier ?? item.variantData?.caliberTier, 0);
    return !weaponCaliber || !ammoCaliber || weaponCaliber === ammoCaliber;
  }

  function consumeActiveAmmo(unit = {}, weapon = {}) {
    const container = activeInventory(unit);
    if (!container) return { consumed: false, reason: "active_inventory_missing" };
    const entries = Array.isArray(container.value) ? container.value.map((item, index) => [String(index), item]) : Object.entries(container.value);
    for (const [key, item] of entries) {
      if (!item || !isFirearmAmmo(item, weapon) || itemQuantity(item) <= 0) continue;
      const after = setItemQuantity(item, itemQuantity(item) - 1);
      if (after <= 0) {
        if (Array.isArray(container.value)) container.value.splice(Number(key), 1);
        else delete container.value[key];
      }
      return { consumed: true, item, container: container.key };
    }
    return { consumed: false, reason: "compatible_active_ammo_missing" };
  }

  function quickdrawReload(character = {}) {
    if (!hasLevel(character, 50) || !hasStatus(character, "haste")) return { reloaded: 0, reason: "quickdraw_inactive" };
    const weapon = equippedShotgun(character);
    if (!weapon) return { reloaded: 0, reason: "shotgun_not_equipped" };
    const state = firearmState(weapon);
    if (!state) return { reloaded: 0, reason: "shotgun_ammo_state_missing" };
    const loadedKey = Object.prototype.hasOwnProperty.call(state, "loaded_ammo") ? "loaded_ammo" : "loadedAmmo";
    const loaded = Math.max(0, intOr(state[loadedKey], 0));
    const capacity = weaponCapacity(weapon, state);
    if (capacity > 0 && loaded >= capacity) return { reloaded: 0, reason: "shotgun_full" };
    const ammo = consumeActiveAmmo(character, weapon);
    if (!ammo.consumed) return { reloaded: 0, reason: ammo.reason };
    state[loadedKey] = loaded + 1;
    return { reloaded: 1, loadedAmmo: state[loadedKey], capacity, weapon, ammo };
  }

  function endOfLineDamage(character = {}, damageDealt = 0) {
    if (!hasLevel(character, 90) || character.__bilgewaterEndOfLineUsed === true) return 0;
    return Math.max(0, Math.floor(numberOr(damageDealt, 0) * 0.30));
  }

  function consumeEndOfLine(character = {}) {
    if (!hasLevel(character, 90) || character.__bilgewaterEndOfLineUsed === true) return false;
    character.__bilgewaterEndOfLineUsed = true;
    return true;
  }

  function resetEndOfLine(character = {}) {
    character.__bilgewaterEndOfLineUsed = false;
    return true;
  }

  function onTurnStart(character = {}) {
    const smoke = applyPendingSmokeScreen(character);
    const protection = applyTrueGritAtTurnStart(character);
    const reload = quickdrawReload(character);
    resetEndOfLine(character);
    return { smoke, protection, reload };
  }

  function patchSkillRegistry() {
    const registry = global.SKILL_REGISTRY;
    if (!registry || typeof registry !== "object" || registry[SMOKE_SCREEN_SKILL_ID]) return Boolean(registry?.[SMOKE_SCREEN_SKILL_ID]);
    try { registry[SMOKE_SCREEN_SKILL_ID] = clone(SMOKE_SCREEN_SKILL); return true; }
    catch (_) { return false; }
  }

  function patchArchetypeCatalog() {
    const source = global.LuminousArchetypeTraitCatalog;
    if (!source?.allDefinitions || !source?.allGrants || !source?.allArchetypes) return false;
    if (source.__bilgewaterDemolisherArchetypeIntegrated) return true;
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalArchetypes = source.allArchetypes.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    const originalResolve = typeof source.resolveTraitGrants === "function" ? source.resolveTraitGrants.bind(source) : null;
    global.LuminousArchetypeTraitCatalog = Object.freeze({
      ...source,
      __bilgewaterDemolisherArchetypeIntegrated: true,
      BILGEWATER_DEMOLISHER_ID: ARCHETYPE_ID,
      BILGEWATER_DEMOLISHER_CLASS_ID: CLASS_ID,
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
    if (!source?.allDefinitions || !source?.allGrants || source.__bilgewaterDemolisherArchetypeIntegrated) return Boolean(source?.__bilgewaterDemolisherArchetypeIntegrated);
    const originalDefinitions = source.allDefinitions.bind(source);
    const originalGrants = source.allGrants.bind(source);
    const originalGet = typeof source.getDefinition === "function" ? source.getDefinition.bind(source) : null;
    global.LuminousTraitCatalogCore = Object.freeze({
      ...source,
      __bilgewaterDemolisherArchetypeIntegrated: true,
      allDefinitions() { return { ...originalDefinitions(), ...DEFINITIONS }; },
      allGrants() { return [...originalGrants(), ...GRANTS]; },
      getDefinition(id) { return DEFINITIONS[normalizeId(id)] || originalGet?.(id) || null; },
    });
    return true;
  }

  function patchTraitEngine() {
    const source = global.LuminousTraitEngine;
    if (!source?.resolveTraitGrants || source.__bilgewaterDemolisherArchetypeIntegrated) return Boolean(source?.__bilgewaterDemolisherArchetypeIntegrated);
    const originalResolve = source.resolveTraitGrants.bind(source);
    global.LuminousTraitEngine = Object.freeze({
      ...source,
      __bilgewaterDemolisherArchetypeIntegrated: true,
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

  function isBilgewaterMarksmanTrait(trait = {}) {
    const source = trait.source || {};
    return ["archetype", "subclass", "class_archetype"].includes(normalizeId(source.type || trait.sourceType))
      && normalizeId(source.archetypeId || source.id) === ARCHETYPE_ID;
  }

  function patchArchetypeRuntime() {
    const source = global.LuminousArchetypeRuntime;
    if (!source?.syncArchetypeTraitsForUnit || source.__bilgewaterDemolisherArchetypeIntegrated) return Boolean(source?.__bilgewaterDemolisherArchetypeIntegrated);
    const originalSync = source.syncArchetypeTraitsForUnit.bind(source);
    global.LuminousArchetypeRuntime = Object.freeze({
      ...source,
      __bilgewaterDemolisherArchetypeIntegrated: true,
      syncArchetypeTraitsForUnit(unit = {}) {
        const base = originalSync(unit) || [];
        const engine = archetypeEngine();
        const granted = engine?.resolveTraitGrants ? engine.resolveTraitGrants(unit, GRANTS, DEFINITIONS, { [ARCHETYPE_ID]: ARCHETYPE }, global.LuminousTraitEngine) || [] : [];
        const existing = Array.isArray(unit.traitDefinitions) ? unit.traitDefinitions : [];
        const byId = new Map();
        [...existing.filter((trait) => !isBilgewaterMarksmanTrait(trait)), ...granted].forEach((trait) => {
          const id = normalizeId(trait?.id || trait?.name);
          if (id && !byId.has(id)) byId.set(id, trait);
        });
        unit.traitDefinitions = [...byId.values()];
        grantSmokeScreenToUnit(unit);
        return [...base, ...granted];
      },
    });
    return true;
  }

  function install() {
    patchSkillRegistry();
    patchArchetypeCatalog();
    patchCoreCatalog();
    patchTraitEngine();
    patchArchetypeRuntime();
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID, ARCHETYPE_NAME, CLASS_ID, CLASS_NAME, REGION_ID, FAMILY_ID, DOCTRINE_ID, DOCTRINE_NAME,
    SMOKE_SCREEN_SKILL_ID, SMOKE_SCREEN_STATUS_ID, ARCHETYPE, SOURCE, DEFINITIONS, GRANTS, SMOKE_SCREEN_SKILL,
    rangerLevel, selectedBilgewaterDemolisher, hasLevel, entityId,
    isShotgunWeapon, isShotgunSkill, isRangedSkill, isShotgunRangedSkill, decorateShotgunSkill,
    rangerSpellSaveDC, smokeScreenSkill, smokeScreenUnlocked, grantSmokeScreenToUnit,
    hasStatus, getStatus, applyStatus, applySmokeScreenFailedSave, applyPendingSmokeScreen, smokeScreenDamageMultiplier,
    shotgunDamageMultiplier, collateralFixedDamage, applyCollateralDamage,
    queueTrueGrit, applyTrueGritAtTurnStart, equippedShotgun, firearmState, quickdrawReload,
    endOfLineDamage, consumeEndOfLine, resetEndOfLine, onTurnStart,
    patchSkillRegistry, patchArchetypeCatalog, patchCoreCatalog, patchTraitEngine, patchArchetypeRuntime, install,
  });

  global.LuminousBilgewaterDemolisherArchetypeRuntime = api;
  install();
  if (global.setInterval) { const timer = global.setInterval(install, PATCH_INTERVAL_MS); timer?.unref?.(); }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
