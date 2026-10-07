(function (global) {
  "use strict";

  if (global.LuminousLevel1SpellBatchRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLevel1SpellBatchRuntime;
    return;
  }

  const VERSION = "0.3.0";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const unitId = (unit = {}) => String(unit.id || unit.unitId || unit.combatId || unit.playerId || "").trim();

  const STATUS_DEFINITIONS = Object.freeze({
    bane: Object.freeze({
      name: "Bane",
      type: "negative",
      mode: "single",
      maxCount: 10,
      rules: [{ trigger: "passive", cond_type: "potency", cond_input: 1, affectation: "final_power", operation: "sub", aff_input: 2 }],
      description: "-2 Final Power while the source maintains Bane Concentration."
    }),
    bless: Object.freeze({
      name: "Bless",
      type: "positive",
      mode: "single",
      maxCount: 10,
      rules: [{ trigger: "passive", cond_type: "potency", cond_input: 1, affectation: "final_power", operation: "add", aff_input: 2 }],
      description: "+2 Final Power while the source maintains Bless Concentration."
    }),
    reaction_suppressed: Object.freeze({
      name: "Reaction Suppressed",
      type: "negative",
      mode: "single",
      maxCount: 1,
      rules: [],
      description: "Cannot spend a Reaction until this status expires."
    }),
    armor_of_agathys: Object.freeze({
      name: "Armor of Agathys",
      type: "positive",
      mode: "single",
      maxCount: 1,
      rules: [],
      description: "Tracks the active Armor of Agathys retaliation."
    }),
    disguise_self: Object.freeze({
      name: "Disguise Self",
      type: "positive",
      mode: "single",
      maxCount: 1,
      rules: [],
      description: "+4 Final Power on Deception Checks while the disguise remains active."
    }),
    divine_favor: Object.freeze({
      name: "Divine Favor",
      type: "positive",
      mode: "single",
      maxCount: 10,
      rules: [],
      description: "Weapon Attack Skills trigger Divine Favor once per Skill."
    }),
    guided_light: Object.freeze({
      name: "Guided Light",
      type: "negative",
      mode: "single",
      icon: "https://imgur.com/9OdpgRZ",
      maxCount: 1,
      rules: [],
      description: "The next Attack Skill targeting this Unit gains +2 Final Power. Guided Light is then removed."
    }),
    heroism: Object.freeze({
      name: "Heroism",
      type: "positive",
      mode: "single",
      maxCount: 10,
      rules: [],
      description: "Tracks Heroism Shield and Frightened immunity while Concentration remains."
    }),
    hexed: Object.freeze({
      name: "Hexed",
      type: "negative",
      mode: "single",
      icon: "https://imgur.com/M89vPkr",
      maxCount: 1,
      rules: [],
      description: "Chosen Ability Checks gain +3 Threshold. The caster's Attack Skills trigger Hex once per Skill."
    }),
    marked_quarry: Object.freeze({
      name: "Marked Quarry",
      type: "negative",
      mode: "single",
      icon: "https://imgur.com/bwjqA28",
      maxCount: 1,
      rules: [],
      description: "The caster gains Analyse Threshold -2 and improved Perception/Survival tracking against this Unit."
    })
  });

  function statusEngine() {
    if (global.LuminousStatusEngine) return global.LuminousStatusEngine;
    if (typeof require === "function") {
      try { return require("./status-engine.js"); } catch (_) {}
    }
    return null;
  }

  function shieldRuntime() {
    if (global.LuminousShieldDurationRuntime) return global.LuminousShieldDurationRuntime;
    if (typeof require === "function") {
      try { return require("./shield-duration-runtime.js"); } catch (_) {}
    }
    return null;
  }

  function inventoryRuntime() {
    if (global.LuminousItemInventoryRuntime) return global.LuminousItemInventoryRuntime;
    if (typeof require === "function") {
      try { return require("./item-inventory-runtime.js"); } catch (_) {}
    }
    return null;
  }

  function registerStatuses() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    Object.entries(STATUS_DEFINITIONS).forEach(([id, definition]) => {
      global.STATUS_REGISTRY[id] = { id, ...definition };
    });
    return true;
  }

  function getStatus(unit, id) {
    return statusEngine()?.getStatus?.(unit, id) || unit?.statusEffects?.[normalizeId(id)] || null;
  }

  function applyStatus(unit, id, input = {}) {
    const engine = statusEngine();
    if (!unit || typeof unit !== "object") return null;
    if (engine?.applyStatus) {
      const resolved = engine.applyStatus(unit, id, input);
      if (resolved) return resolved;
    }
    if (!unit.statusEffects || typeof unit.statusEffects !== "object" || Array.isArray(unit.statusEffects)) unit.statusEffects = {};
    const key = normalizeId(id);
    unit.statusEffects[key] = { id: key, count: numberOr(input.count, 1), potency: numberOr(input.potency, 0), duration: input.duration || "until_removed", sourceUnitId: input.sourceUnitId || null, data: { ...(input.data || {}) } };
    return unit.statusEffects[key];
  }

  function removeStatus(unit, id) {
    const engine = statusEngine();
    if (engine?.removeStatus) return engine.removeStatus(unit, id, { from: "spell", ignoreProtection: true });
    const key = normalizeId(id);
    if (unit?.statusEffects?.[key]) delete unit.statusEffects[key];
    return { removed: true, statusId: key };
  }

  function sourceStillConcentrating(source, spellId) {
    const active = normalizeId(source?.spellcastingState?.concentration?.active?.spellId || source?.spellcastingState?.concentration?.spellId);
    return active === normalizeId(spellId);
  }

  function findSource(units, sourceUnitId) {
    const wanted = String(sourceUnitId || "");
    return (units || []).find((unit) => unitId(unit) === wanted) || null;
  }

  function applyBane(target, sourceUnitId = null) {
    return applyStatus(target, "bane", {
      mode: "set",
      count: 10,
      potency: 1,
      sourceUnitId,
      data: { sourceUnitId, concentrationSpellId: "bane" }
    });
  }

  function applyBless(target, sourceUnitId = null) {
    return applyStatus(target, "bless", {
      mode: "set",
      count: 10,
      potency: 1,
      sourceUnitId,
      data: { sourceUnitId, concentrationSpellId: "bless" }
    });
  }

  function suppressReaction(target) {
    return applyStatus(target, "reaction_suppressed", {
      mode: "set",
      count: 1,
      duration: "next_turn_end",
      data: { sourceSpellId: "arms_of_hadar" }
    });
  }

  function grantArmorOfAgathys(unit, slotLevel = 1, options = {}) {
    const level = Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    const amount = 10 * level;
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const shields = shieldRuntime();
    const gained = shields?.gainShield
      ? shields.gainShield(unit, amount, shields.SHIELD_TYPES?.PERSISTENT || "persistent")
      : (() => { unit.shield = Math.max(0, numberOr(unit.shield, 0)) + amount; return amount; })();

    unit.__luminousArmorOfAgathys = {
      active: true,
      slotLevel: level,
      retaliationDamage: 3 * level,
      chill: 1,
      grantedShield: gained,
      sourceSpellId: "armor_of_agathys",
      createdAt: now,
      expiresAt: now + 60 * 60 * 1000
    };
    applyStatus(unit, "armor_of_agathys", {
      mode: "set",
      count: 1,
      data: { slotLevel: level, expiresAt: unit.__luminousArmorOfAgathys.expiresAt }
    });
    return { resolved: gained > 0, shieldGranted: gained, retaliationDamage: 3 * level, chill: 1, slotLevel: level, expiresAt: unit.__luminousArmorOfAgathys.expiresAt };
  }

  function clearArmorOfAgathys(unit) {
    if (unit && typeof unit === "object") delete unit.__luminousArmorOfAgathys;
    removeStatus(unit, "armor_of_agathys");
    return true;
  }

  function armorOfAgathysState(unit, options = {}) {
    const state = unit?.__luminousArmorOfAgathys;
    if (!state?.active) return null;
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    if (numberOr(state.expiresAt, 0) > 0 && now >= numberOr(state.expiresAt, 0)) {
      clearArmorOfAgathys(unit);
      return null;
    }
    if (numberOr(unit?.shield, 0) <= 0) {
      clearArmorOfAgathys(unit);
      return null;
    }
    return state;
  }

  function isMeleeSkill(skill = {}) {
    const range = numberOr(skill.range ?? skill.skillRange ?? skill.rangeTiles ?? skill.range_tiles, NaN);
    if (Number.isFinite(range)) return range <= 1;
    const id = normalizeId(skill.rangeType || skill.range_type || skill.attackRange || skill.attack_range || skill.targetingType || skill.targeting_type || "");
    if (skill.isRanged === true || id.includes("ranged")) return false;
    if (id) return id === "melee" || id === "close" || id === "focused_attack";
    return true;
  }

  function retaliateArmorOfAgathys(engine, attacker, defender, attackSkill, result, snapshot = {}) {
    const state = snapshot.state || armorOfAgathysState(defender);
    const shieldBefore = numberOr(snapshot.shieldBefore, numberOr(defender?.shield, 0));
    const attackResolved = Boolean(result && (Array.isArray(result.attackLogs) ? result.attackLogs.length > 0 : result.damageTaken !== undefined));
    if (!state || !attacker || shieldBefore <= 0 || !attackResolved || !isMeleeSkill(attackSkill)) return null;
    const damage = Math.max(0, Math.trunc(numberOr(state.retaliationDamage, 0)));
    if (damage <= 0) return null;
    const applied = applyFixedDamage(attacker, damage, {
      engine,
      damageKind: "directo",
      sourceSpellId: "armor_of_agathys",
      sourceUnitId: unitId(defender)
    });
    const chill = applyStatus(attacker, "chill", {
      mode: "add",
      count: 1,
      potency: 1,
      sourceUnitId: unitId(defender),
      data: { sourceSpellId: "armor_of_agathys" }
    });
    if (numberOr(defender?.shield, 0) <= 0) clearArmorOfAgathys(defender);
    return { damage, chill: 1, applied, status: chill };
  }

  const ALARM_EFFECT_ROOT = "campaña/efectos_dm";

  function alarmSubjectPlayerId(caster = {}, options = {}) {
    return String(
      options.subjectPlayerId
      || options.casterPlayerId
      || caster.ownerPlayerId
      || caster.playerId
      || caster.canonicalPlayerKey
      || caster.vinculo_jugador
      || unitId(caster)
      || ""
    ).trim();
  }

  function alarmManagedEffect(ward, caster = {}, options = {}) {
    const createdAt = numberOr(ward?.createdAt, Date.now());
    return {
      id: ward.id,
      kind: "alarm",
      name: "Alarm",
      effectId: "alarm",
      sourceSpellId: "alarm",
      sourceUnitId: ward.sourceUnitId,
      subjectPlayerId: alarmSubjectPlayerId(caster, options),
      subjectName: caster.name || caster.nombre || options.subjectName || "Player",
      mode: ward.mode,
      areaId: ward.areaId,
      excludedUnitIds: ward.excludedUnitIds,
      note: ward.mode === "audible" ? "Audible Alarm" : "Mental Alarm",
      active: true,
      createdAt,
      expiresAt: createdAt + 8 * 60 * 60 * 1000
    };
  }

  function persistAlarmWard(ward, caster = {}, options = {}) {
    if (options.persist === false) return { persisted: false, reason: "persistence_disabled", effect: alarmManagedEffect(ward, caster, options) };
    const db = options.db || (global.firebase?.database && global.firebase.apps?.length ? global.firebase.database() : null);
    if (!db?.ref) return { persisted: false, reason: "firebase_database_unavailable", effect: alarmManagedEffect(ward, caster, options) };
    const effect = alarmManagedEffect(ward, caster, options);
    const promise = db.ref(`${ALARM_EFFECT_ROOT}/${ward.id}`).set(effect);
    promise?.catch?.(() => {});
    return { persisted: true, effect, promise };
  }

  function createAlarmWard(caster, options = {}) {
    if (!caster || typeof caster !== "object") return { resolved: false, reason: "caster_required" };
    const mode = normalizeId(options.mode || "mental");
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const ward = {
      id: String(options.id || `alarm_${now}_${Math.random().toString(36).slice(2, 7)}`),
      sourceSpellId: "alarm",
      sourceUnitId: unitId(caster),
      mode: ["audible", "mental"].includes(mode) ? mode : "mental",
      areaId: options.areaId || options.targetId || null,
      excludedUnitIds: Array.isArray(options.excludedUnitIds) ? [...new Set(options.excludedUnitIds.map(String))] : [],
      durationHours: 8,
      dmManagedTrigger: true,
      consumeToTrigger: true,
      createdAt: now,
      expiresAt: now + 8 * 60 * 60 * 1000
    };
    if (!Array.isArray(caster.__luminousAlarmWards)) caster.__luminousAlarmWards = [];
    caster.__luminousAlarmWards.push(ward);
    const persistence = persistAlarmWard(ward, caster, options);
    return { resolved: true, ward, persistence };
  }

  function maxHpOf(unit = {}) {
    return Math.max(0, numberOr(unit.maxHp ?? unit.maxHP ?? unit.hpMax ?? unit.max_hp, 0));
  }

  function currentHpOf(unit = {}) {
    return Math.max(0, numberOr(unit.hp ?? unit.currentHp ?? unit.currentHP ?? unit.current_hp, 0));
  }

  function setCurrentHp(unit, value) {
    const next = Math.max(0, numberOr(value, 0));
    if ("hp" in unit || (!("currentHp" in unit) && !("currentHP" in unit) && !("current_hp" in unit))) unit.hp = next;
    else if ("currentHp" in unit) unit.currentHp = next;
    else if ("currentHP" in unit) unit.currentHP = next;
    else unit.current_hp = next;
    return next;
  }

  function calculateCureWoundsHealing(slotLevel = 1, spellMod = 0, maxHp = 0) {
    const slot = Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    const mod = numberOr(spellMod, 0);
    const hp = Math.max(0, numberOr(maxHp, 0));
    const flat = 2 * slot;
    const maxHpPercent = Math.max(2, 2 * mod);
    const percentHealing = hp * (maxHpPercent / 100);
    return { slotLevel: slot, spellMod: mod, flat, maxHpPercent, percentHealing, total: flat + percentHealing };
  }

  function applyCureWounds(target, slotLevel = 1, spellMod = 0) {
    if (!target || typeof target !== "object") return { resolved: false, reason: "target_required" };
    const maxHp = maxHpOf(target);
    if (maxHp <= 0) return { resolved: false, reason: "max_hp_required" };
    const hpBefore = Math.min(maxHp, currentHpOf(target));
    const healing = calculateCureWoundsHealing(slotLevel, spellMod, maxHp);
    const hpAfter = Math.min(maxHp, hpBefore + healing.total);
    setCurrentHp(target, hpAfter);
    return {
      resolved: true,
      targetId: unitId(target),
      hpBefore,
      hpAfter,
      healed: Math.max(0, hpAfter - hpBefore),
      ...healing
    };
  }

  function resolveCureWoundsSpellMod(actor, action = {}, effect = {}) {
    const explicit = effect.spellMod
      ?? action?.metadata?.spellMod
      ?? action?.metadata?.viewerPlan?.spellMod
      ?? actor?.SpellMod
      ?? actor?.spellMod;
    if (Number.isFinite(Number(explicit))) return Number(explicit);
    const classId = action?.metadata?.sourceClassId || effect.classId || "";
    const runtime = global.LuminousSpellcastingRuntime;
    const resolved = runtime?.resolveSpellcasting?.(actor || {}, classId, action?.metadata?.viewerPlan || {}, action?.metadata?.variables || {});
    return numberOr(resolved?.spellMod, 0);
  }


  const DETECTION_CONFIGS = Object.freeze({
    detect_evil_and_good: Object.freeze({
      name: "Detect Evil and Good",
      type: "presence_checklist",
      choices: ["aberration", "celestial", "elemental", "fey", "fiend", "undead", "hallow"]
    }),
    detect_magic: Object.freeze({
      name: "Detect Magic",
      type: "magic_sources",
      sources: ["nearby_magical_effect", "objects", "creatures", "phenomena"],
      schools: ["abjuration", "conjuration", "divination", "enchantment", "evocation", "illusion", "necromancy", "transmutation"]
    }),
    detect_poison_and_disease: Object.freeze({
      name: "Detect Poison and Disease",
      type: "presence_details",
      choices: ["poison", "poisonous_or_venomous_creature", "magical_contagion"]
    })
  });
  const detectionNotified = new Set();
  let detectionBridgeInstalled = false;
  let detectionDmUnsubscribe = null;
  let detectionPlayerUnsubscribe = null;
  const activePowerTargets = new Map();

  function fixedDamageRuntime() {
    if (global.LuminousFixedDamageRuntime) return global.LuminousFixedDamageRuntime;
    if (typeof require === "function") {
      try { return require("./fixed-damage-runtime.js"); } catch (_) {}
    }
    return null;
  }

  function allCombatUnits(context = {}) {
    if (Array.isArray(context.units)) return context.units.filter(Boolean);
    if (Array.isArray(context.combatants)) return context.combatants.filter(Boolean);
    if (context.combatants && typeof context.combatants === "object") return Object.values(context.combatants).filter(Boolean);
    if (context.combatData && typeof context.combatData === "object") return Object.values(context.combatData).filter(Boolean);
    return Object.values(global.combatData || {}).filter(Boolean);
  }

  function reduceStatusCount(unit, id, amount = 1) {
    const entry = getStatus(unit, id);
    if (!entry) return 0;
    const next = Math.max(0, Math.trunc(numberOr(entry.count, 0) - Math.max(0, numberOr(amount, 0))));
    if (next <= 0) { removeStatus(unit, id); return 0; }
    entry.count = next;
    return next;
  }

  function statusActive(unit, id) {
    return Boolean(getStatus(unit, id));
  }

  function applyFixedDamage(target, amount, options = {}) {
    const value = Math.max(0, Math.floor(numberOr(amount, 0)));
    const fixed = fixedDamageRuntime();
    if (typeof fixed?.applyFixedDamage === "function") return fixed.applyFixedDamage(target, value, options);
    const engine = options.engine || global.CombatEngine;
    if (target && typeof engine?.applyDamage === "function") {
      const before = numberOr(target.hp, 0);
      const result = engine.applyDamage(target, value, options.damageKind || "directo", false, options.skillUsed || null);
      return { applied: true, amount: value, hpBefore: before, hpAfter: numberOr(target.hp, before), result };
    }
    return { applied: false, amount: value, result: null };
  }

  function isSpellSkill(skill = {}) {
    return skill.cantrip === true || Number(skill.level ?? skill.spellLevel ?? 0) > 0 || Boolean(skill.sourceSpellId || skill.spellId);
  }

  function isWeaponAttackSkill(skill = {}) {
    if (!skill || isSpellSkill(skill)) return false;
    if (skill.isWeaponAttack === true || skill.weaponId || skill.weapon_id || skill.sourceItemId || skill.source_item_id) return true;
    const kind = normalizeId(skill.kind || skill.type || skill.sourceType || skill.source_type || skill.category || "");
    return kind.includes("weapon") || kind === "attack" || kind === "attack_skill";
  }

  function isMeleeOrUnarmedAttackSkill(skill = {}) {
    if (!skill || isSpellSkill(skill)) return false;
    if (skill.isUnarmed === true || normalizeId(skill.weaponType || skill.weapon_type).includes("unarmed")) return true;
    const range = Number(skill.skillRange ?? skill.range ?? skill.rangeTiles ?? skill.range_tiles);
    if (Number.isFinite(range)) return range <= 1;
    if (skill.isRanged === true) return false;
    return isWeaponAttackSkill(skill);
  }

  function creatureTypeOf(unit = {}) {
    return normalizeId(unit.creatureType || unit.creature_type || unit.typeCreature || unit.type_creature || unit.monsterType || unit.monster_type || unit.raceType || "");
  }

  function applyDisguiseSelf(unit, options = {}) {
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const expiresAt = now + 60 * 60 * 1000;
    const status = applyStatus(unit, "disguise_self", {
      mode: "set", count: 1,
      data: { sourceSpellId: "disguise_self", deceptionFinalPowerBonus: 4, expiresAt }
    });
    return { resolved: Boolean(status), status, expiresAt, deceptionFinalPowerBonus: 4 };
  }

  function disguiseSelfActive(unit, now = Date.now()) {
    const entry = getStatus(unit, "disguise_self");
    if (!entry) return false;
    const expiresAt = Number(entry.data?.expiresAt);
    if (Number.isFinite(expiresAt) && Number(now) >= expiresAt) {
      removeStatus(unit, "disguise_self");
      return false;
    }
    return true;
  }

  function applyDivineFavor(unit) {
    const status = applyStatus(unit, "divine_favor", {
      mode: "set", count: 10,
      data: { sourceSpellId: "divine_favor", oncePerSkill: true }
    });
    return { resolved: Boolean(status), status };
  }

  function divineFavorFixedDamage(target) {
    return statusActive(target, "radiance") ? 2 : 1;
  }

  function resolveDivineFavorHit(attacker, target, skill = {}, context = {}) {
    if (!attacker || !target || !statusActive(attacker, "divine_favor") || !isWeaponAttackSkill(skill)) return null;
    if (context.__luminousDivineFavorApplied) return null;
    context.__luminousDivineFavorApplied = true;
    const fixedDamage = divineFavorFixedDamage(target);
    const damage = applyFixedDamage(target, fixedDamage, { engine: context.engine || global.CombatEngine, damageKind: "directo", skillUsed: null });
    const radiance = applyStatus(target, "radiance", { mode: "gain", count: 1 });
    return { resolved: true, fixedDamage, damage, radiance };
  }

  function prepareDivineSmite(actor, slotLevel = 1) {
    const slot = Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    actor.__luminousDivineSmite = { active: true, slotLevel: slot, sourceSpellId: "divine_smite" };
    return { resolved: true, slotLevel: slot };
  }

  function divineSmiteFixedDamage(slotLevel = 1, target = {}) {
    const slot = Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    const base = 4 + 4 * slot;
    const type = creatureTypeOf(target);
    const multiplier = ["fiend", "undead"].includes(type) ? 1.5 : 1;
    return { slotLevel: slot, base, multiplier, total: Math.floor(base * multiplier), creatureType: type || null };
  }

  function divineSmiteEnchantment(skill = {}) {
    const rows = Array.isArray(skill.__luminousSlotEnchantments) ? skill.__luminousSlotEnchantments : [];
    return rows.find((row) => normalizeId(row?.id || row?.spellId) === "divine_smite") || null;
  }

  function divineSmiteEnchantmentKey(skill = {}, enchantment = {}) {
    return String(enchantment.targetDrawId || skill?.__deckCard?.drawId || skill?.deckCard?.drawId || "").trim();
  }

  function divineSmitePowerBonus(actor, target, skill = {}) {
    const enchanted = divineSmiteEnchantment(skill);
    const prepared = actor?.__luminousDivineSmite?.active === true;
    if (!enchanted && !prepared) return 0;
    if (!target || !statusActive(target, "radiance") || !isMeleeOrUnarmedAttackSkill(skill)) return 0;
    const key = enchanted ? divineSmiteEnchantmentKey(skill, enchanted) : "";
    if (key && actor?.__luminousResolvedDivineSmiteKeys?.[key]) return 0;
    return numberOr(enchanted?.finalPowerIfTargetHasRadiance, 1);
  }

  function resolveDivineSmiteHit(attacker, target, skill = {}, context = {}) {
    const enchanted = divineSmiteEnchantment(skill);
    const pending = attacker?.__luminousDivineSmite;
    if ((!enchanted && !pending?.active) || !target || !isMeleeOrUnarmedAttackSkill(skill)) return null;

    const key = enchanted ? divineSmiteEnchantmentKey(skill, enchanted) : "";
    if (key) {
      if (!attacker.__luminousResolvedDivineSmiteKeys || typeof attacker.__luminousResolvedDivineSmiteKeys !== "object") attacker.__luminousResolvedDivineSmiteKeys = {};
      if (attacker.__luminousResolvedDivineSmiteKeys[key]) return null;
      attacker.__luminousResolvedDivineSmiteKeys[key] = true;
    } else if (pending?.active) {
      delete attacker.__luminousDivineSmite;
    }

    const slotLevel = enchanted?.slotLevel ?? pending?.slotLevel ?? 1;
    const fixed = divineSmiteFixedDamage(slotLevel, target);
    const damage = applyFixedDamage(target, fixed.total, { engine: context.engine || global.CombatEngine, damageKind: "directo", skillUsed: null });
    const radiance = applyStatus(target, "radiance", { mode: "gain", count: numberOr(enchanted?.radiance, 2) });
    return { resolved: true, source: enchanted ? "slot_enchantment" : "prepared", ...fixed, damage, radiance, targetDrawId: key || null };
  }

  function rollSaveHeads(engine, target, context = {}) {
    const probability = typeof engine?.getCoinProbability === "function" ? numberOr(engine.getCoinProbability(target?.sp || 0), 50) : 50;
    const random = typeof context.random === "function" ? context.random : Math.random;
    return Array.from({ length: 5 }, () => random() * 100 < probability);
  }

  function applySpellRestrained(target, options = {}) {
    const sourceSpellId = normalizeId(options.sourceSpellId);
    const spellDC = numberOr(options.spellDC, 0);
    const slotLevel = Math.max(1, Math.trunc(numberOr(options.slotLevel, 1)));
    return applyStatus(target, "restrained", {
      mode: "set", count: 1, sourceUnitId: options.sourceUnitId || null,
      data: {
        sourceSpellId,
        sourceUnitId: options.sourceUnitId || null,
        concentrationSpellId: sourceSpellId,
        escapeAbilityId: "str",
        escapeDC: spellDC,
        slotLevel,
        remainingTurns: Math.max(1, Math.trunc(numberOr(options.remainingTurns, 10))),
        turnStartFixedDamage: sourceSpellId === "ensnaring_strike" ? 2 * slotLevel : 0
      }
    });
  }

  function prepareEnsnaringStrike(actor, action = {}, effect = {}) {
    const slotLevel = Math.max(1, Math.trunc(numberOr(action?.metadata?.slotLevel ?? effect.slotLevel, 1)));
    const spellDC = numberOr(action?.metadata?.spellDC ?? action?.metadata?.sourceDefinition?.spellDC ?? effect.spellDC, 0);
    actor.__luminousEnsnaringStrike = { active: true, slotLevel, spellDC, sourceSpellId: "ensnaring_strike", sourceUnitId: unitId(actor) };
    return { resolved: true, slotLevel, spellDC };
  }

  function resolveEnsnaringStrikeHit(attacker, target, skill = {}, context = {}) {
    const pending = attacker?.__luminousEnsnaringStrike;
    if (!pending?.active || !target || !isWeaponAttackSkill(skill)) return null;
    delete attacker.__luminousEnsnaringStrike;
    const engine = context.engine || global.CombatEngine;
    if (typeof engine?.resolveSpell !== "function") return { resolved: false, reason: "save_resolver_unavailable" };
    const saveSpell = {
      id: "ensnaring_strike", spellId: "ensnaring_strike",
      statUsed: "str", saveDC: pending.spellDC,
      sourceUnitId: pending.sourceUnitId, casterId: pending.sourceUnitId,
      slotLevel: pending.slotLevel,
      __luminousRestrainedData: pending
    };
    const save = engine.resolveSpell(saveSpell, target, rollSaveHeads(engine, target, context));
    return { resolved: true, save };
  }

  function attemptSpellRestrainedEscape(target, total) {
    const entry = getStatus(target, "restrained");
    const sourceSpellId = normalizeId(entry?.data?.sourceSpellId);
    if (!["ensnaring_strike", "entangle"].includes(sourceSpellId)) return { resolved: false, reason: "spell_restrained_required" };
    const dc = numberOr(entry?.data?.escapeDC, 0);
    const passed = numberOr(total, -Infinity) >= dc;
    if (passed) removeStatus(target, "restrained");
    return { resolved: true, passed, dc, sourceSpellId };
  }

  function applyEnsnaringTurnStart(units = []) {
    const results = [];
    for (const target of units || []) {
      const entry = getStatus(target, "restrained");
      if (normalizeId(entry?.data?.sourceSpellId) !== "ensnaring_strike") continue;
      const source = findSource(units, entry.sourceUnitId || entry.data?.sourceUnitId);
      if (source && !sourceStillConcentrating(source, "ensnaring_strike")) {
        removeStatus(target, "restrained");
        continue;
      }
      const amount = Math.max(0, Math.trunc(numberOr(entry.data?.turnStartFixedDamage, 0)));
      if (amount > 0) results.push({ targetId: unitId(target), damage: applyFixedDamage(target, amount, { engine: global.CombatEngine, damageKind: "directo", skillUsed: null }) });
    }
    return results;
  }

  function createEntangleArea(actor, targets = [], options = {}) {
    const area = {
      id: String(options.id || `entangle_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      sourceSpellId: "entangle",
      sourceUnitId: unitId(actor),
      difficultTerrain: true,
      attackWeight: 4,
      remainingTurns: 10,
      targetIds: (targets || []).filter(Boolean).map(unitId).filter(Boolean)
    };
    if (!Array.isArray(actor.__luminousEntangleAreas)) actor.__luminousEntangleAreas = [];
    actor.__luminousEntangleAreas.push(area);
    return { resolved: true, area };
  }

  function entangleAreaForUnit(unit, casters = []) {
    const id = unitId(unit);
    for (const caster of casters || []) {
      for (const area of caster?.__luminousEntangleAreas || []) {
        if (area.remainingTurns > 0 && area.targetIds.includes(id)) return area;
      }
    }
    return null;
  }

  function tickSpellDurations(units = []) {
    for (const unit of units || []) {
      if (statusActive(unit, "divine_favor")) reduceStatusCount(unit, "divine_favor", 1);
      if (statusActive(unit, "guided_light")) removeStatus(unit, "guided_light");
      expireGoodMagicFood(unit);
      const restrained = getStatus(unit, "restrained");
      if (["ensnaring_strike", "entangle"].includes(normalizeId(restrained?.data?.sourceSpellId))) {
        restrained.data.remainingTurns = Math.max(0, Math.trunc(numberOr(restrained.data.remainingTurns, 10) - 1));
        if (restrained.data.remainingTurns <= 0) removeStatus(unit, "restrained");
      }
      if (Array.isArray(unit.__luminousEntangleAreas)) {
        unit.__luminousEntangleAreas = unit.__luminousEntangleAreas
          .map((area) => ({ ...area, remainingTurns: Math.max(0, Math.trunc(numberOr(area.remainingTurns, 10) - 1)) }))
          .filter((area) => area.remainingTurns > 0);
      }
      if (Array.isArray(unit.__luminousGreaseAreas)) {
        unit.__luminousGreaseAreas = unit.__luminousGreaseAreas
          .map((area) => {
            area.remainingTurns = Math.max(0, Math.trunc(numberOr(area.remainingTurns, 10) - 1));
            if (area.remainingTurns <= 0) {
              area.active = false;
              activeGreaseAreas.delete(area.id);
            }
            return area;
          })
          .filter((area) => area.remainingTurns > 0);
      }
      recomputeGreaseSpeedModifier(unit);
    }
  }

  function chromaticJumpLimit(skill = {}) {
    return Math.max(1, Math.trunc(numberOr(skill.slotLevel ?? skill.spellLevel ?? skill.level, 1)));
  }

  function nextChromaticOrbTarget(attacker, currentTarget, skill = {}, context = {}) {
    const visited = new Set((skill.__luminousChromaticVisitedIds || []).map(String));
    if (currentTarget) visited.add(unitId(currentTarget));
    const faction = normalizeId(attacker?.faction || attacker?.faccion || attacker?.team || attacker?.side);
    const candidates = allCombatUnits(context).filter((unit) => {
      if (!unit || numberOr(unit.hp, 1) <= 0) return false;
      const id = unitId(unit);
      if (!id || visited.has(id) || id === unitId(attacker)) return false;
      const otherFaction = normalizeId(unit.faction || unit.faccion || unit.team || unit.side);
      return !faction || !otherFaction || otherFaction !== faction;
    });
    const planned = Array.isArray(skill.__luminousChromaticJumpTargetIds) ? skill.__luminousChromaticJumpTargetIds.map(String) : [];
    return candidates.find((unit) => planned.includes(unitId(unit))) || candidates[0] || null;
  }

  function resolveChromaticOrbCrit(context = {}) {
    const skill = context.skill || {};
    if (normalizeId(skill.id || skill.spellId || skill.sourceSpellId) !== "chromatic_orb") return null;
    const attacker = context.attacker || context.unitAttacker || null;
    const currentTarget = context.defender || context.currentTarget || context.target || null;
    const engine = context.engine || global.CombatEngine;
    if (!attacker || !currentTarget || typeof engine?.resolveUnilateralWithCounter !== "function") return null;
    const jumpsUsed = Math.max(0, Math.trunc(numberOr(skill.__luminousChromaticJumpCount, 0)));
    const maxJumps = chromaticJumpLimit(skill);
    if (jumpsUsed >= maxJumps) return { resolved: false, reason: "jump_limit", jumpsUsed, maxJumps };
    const next = nextChromaticOrbTarget(attacker, currentTarget, skill, context);
    if (!next) return { resolved: false, reason: "no_new_target", jumpsUsed, maxJumps };
    const clone = JSON.parse(JSON.stringify(skill));
    const visited = new Set((skill.__luminousChromaticVisitedIds || []).map(String));
    visited.add(unitId(currentTarget));
    visited.add(unitId(next));
    clone.__luminousChromaticVisitedIds = [...visited];
    clone.__luminousChromaticJumpCount = jumpsUsed + 1;
    clone.__luminousChromaticMaxJumps = maxJumps;
    const result = engine.resolveUnilateralWithCounter(attacker, clone, next, null, {
      skipUseHooks: false,
      clashResult: null,
      combatants: allCombatUnits(context)
    });
    return { resolved: true, targetId: unitId(next), jumpsUsed: jumpsUsed + 1, maxJumps, result };
  }

  function detectionRoomKey() {
    const fromCoordinator = global.LuminousTheatreCheckCoordinator?.roomKey?.();
    if (fromCoordinator) return String(fromCoordinator);
    return String(global.document?.body?.dataset?.theatreRoomId || "default").replace(/[.#$\[\]\/]/g, "_") || "default";
  }

  function detectionCasterUid(caster = {}, options = {}) {
    return String(options.casterUid || caster.uid || caster.authUid || caster.ownerUid || caster.playerUid || global.firebase?.auth?.().currentUser?.uid || "").trim() || null;
  }

  function detectionConfig(spellId) {
    return DETECTION_CONFIGS[normalizeId(spellId)] || null;
  }

  function buildDetectionRequest(caster, spellId, options = {}) {
    const id = normalizeId(spellId);
    const config = detectionConfig(id);
    if (!config) return { resolved: false, reason: "unsupported_detection_spell" };
    const request = {
      id: String(options.id || `detect_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
      spellId: id,
      spellName: config.name,
      casterUnitId: unitId(caster),
      casterUid: detectionCasterUid(caster, options),
      casterLabel: String(caster?.characterName || caster?.nombre || caster?.name || unitId(caster) || "Caster"),
      status: "pending",
      schema: JSON.parse(JSON.stringify(config)),
      createdAt: Date.now()
    };
    if (!Array.isArray(caster.__luminousDetectionRequests)) caster.__luminousDetectionRequests = [];
    caster.__luminousDetectionRequests.push(request);
    try { global.dispatchEvent?.(new global.CustomEvent("luminous:spell-detection-request", { detail: request })); } catch (_) {}
    const db = global.firebase?.database?.();
    if (db?.ref) {
      Promise.resolve(db.ref(`spell_detection_requests/${detectionRoomKey()}/${request.id}`).set(request)).catch(() => {});
    }
    return { resolved: true, request };
  }

  function detectionPlayerMessage(request = {}, response = {}) {
    const id = normalizeId(request.spellId);
    if (id === "detect_magic") {
      const rows = Array.isArray(response.sources) ? response.sources.filter((row) => row?.detected) : [];
      if (!rows.length) return "No nearby magical presence is detected.";
      return rows.map((row) => {
        const source = String(row.source || "").replace(/_/g, " ");
        const school = normalizeId(row.school);
        return school ? `${source}: ${school}` : source;
      }).join(" · ");
    }
    if (id === "detect_poison_and_disease") {
      const rows = Array.isArray(response.presences) ? response.presences.filter((row) => row?.detected) : [];
      if (!rows.length) return "No applicable poison, creature, or magical contagion is detected nearby.";
      return rows.map((row) => [String(row.presence || "").replace(/_/g, " "), row.type, row.location].filter(Boolean).join(" — ")).join(" · ");
    }
    const selected = Array.isArray(response.selected) ? response.selected.filter(Boolean) : [];
    if (!selected.length) return "No applicable presence is detected nearby.";
    return `Detected: ${selected.map((value) => String(value).replace(/_/g, " ")).join(", ")}.`;
  }

  function resolveDetectionRequest(request = {}, response = {}) {
    const next = { ...request, status: "resolved", response: JSON.parse(JSON.stringify(response || {})), resolvedAt: Date.now() };
    next.playerMessage = detectionPlayerMessage(next, next.response);
    try { global.dispatchEvent?.(new global.CustomEvent("luminous:spell-detection-result", { detail: next })); } catch (_) {}
    return next;
  }

  function detectionMatchesCurrentPlayer(request = {}) {
    const uid = global.firebase?.auth?.().currentUser?.uid || null;
    if (request.casterUid && uid && String(request.casterUid) === String(uid)) return true;
    const data = global.datosJugador || {};
    const ids = [data.id, data.playerId, data.actorId, data.characterId, data.vinculo_jugador].filter(Boolean).map(String);
    return request.casterUnitId && ids.includes(String(request.casterUnitId));
  }

  function showDetectionPlayerResult(request) {
    if (!global.document?.body || detectionNotified.has(request.id)) return;
    detectionNotified.add(request.id);
    const toast = global.document.createElement("div");
    toast.className = "luminous-detection-result";
    Object.assign(toast.style, { position: "fixed", right: "24px", bottom: "24px", zIndex: "100000", maxWidth: "420px", padding: "14px 16px", background: "#111", color: "#fff", border: "1px solid #666", borderRadius: "8px", boxShadow: "0 8px 30px rgba(0,0,0,.45)" });
    const title = global.document.createElement("strong");
    title.textContent = request.spellName || "Detection";
    const body = global.document.createElement("div");
    body.style.marginTop = "8px";
    body.textContent = request.playerMessage || detectionPlayerMessage(request, request.response || {});
    toast.append(title, body);
    global.document.body.appendChild(toast);
    global.setTimeout?.(() => toast.remove(), 9000);
  }

  function renderDetectionDmPrompt(request, ref) {
    const doc = global.document;
    if (!doc?.body || doc.getElementById("luminous-detection-dm-prompt")) return;
    const panel = doc.createElement("section");
    panel.id = "luminous-detection-dm-prompt";
    Object.assign(panel.style, { position: "fixed", right: "20px", top: "90px", zIndex: "100000", width: "390px", maxHeight: "75vh", overflow: "auto", padding: "16px", background: "#101010", color: "#fff", border: "1px solid #777", borderRadius: "8px", boxShadow: "0 10px 34px rgba(0,0,0,.55)" });
    const title = doc.createElement("strong");
    title.textContent = `${request.spellName || "Detection"} · ${request.casterLabel || "Caster"}`;
    panel.appendChild(title);
    const form = doc.createElement("div");
    form.style.marginTop = "12px";
    panel.appendChild(form);
    const response = {};
    const addRow = (labelText, withSchool = false, withDetails = false) => {
      const row = doc.createElement("div");
      row.style.cssText = "display:grid;grid-template-columns:auto 1fr;gap:8px;margin:8px 0;align-items:center";
      const check = doc.createElement("input"); check.type = "checkbox";
      const label = doc.createElement("span"); label.textContent = labelText.replace(/_/g, " ");
      row.append(check, label);
      let school = null, type = null, location = null;
      if (withSchool) {
        school = doc.createElement("select");
        school.style.gridColumn = "2";
        const blank = doc.createElement("option"); blank.value = ""; blank.textContent = "School (if applicable)"; school.appendChild(blank);
        (request.schema?.schools || []).forEach((id) => { const option = doc.createElement("option"); option.value = id; option.textContent = id; school.appendChild(option); });
        row.appendChild(school);
      }
      if (withDetails) {
        type = doc.createElement("input"); type.placeholder = "Type"; type.style.gridColumn = "2";
        location = doc.createElement("input"); location.placeholder = "Location"; location.style.gridColumn = "2";
        row.append(type, location);
      }
      form.appendChild(row);
      return { id: labelText, check, school, type, location };
    };
    let rows = [];
    if (request.schema?.type === "magic_sources") rows = (request.schema.sources || []).map((id) => addRow(id, true, false));
    else rows = (request.schema?.choices || []).map((id) => addRow(id, false, request.schema?.type === "presence_details"));
    const submit = doc.createElement("button");
    submit.type = "button"; submit.textContent = "SEND RESULT"; submit.style.marginTop = "12px";
    submit.onclick = () => {
      if (request.schema?.type === "magic_sources") {
        response.sources = rows.map((row) => ({ source: row.id, detected: row.check.checked, school: row.school?.value || null }));
      } else if (request.schema?.type === "presence_details") {
        response.presences = rows.map((row) => ({ presence: row.id, detected: row.check.checked, type: row.type?.value?.trim() || null, location: row.location?.value?.trim() || null }));
      } else {
        response.selected = rows.filter((row) => row.check.checked).map((row) => row.id);
      }
      const resolved = resolveDetectionRequest(request, response);
      Promise.resolve(ref.update({ status: "resolved", response: resolved.response, resolvedAt: resolved.resolvedAt, playerMessage: resolved.playerMessage })).catch(() => {});
      panel.remove();
    };
    panel.appendChild(submit);
    doc.body.appendChild(panel);
  }

  function installDetectionWorkflow() {
    if (detectionBridgeInstalled) return true;
    const firebase = global.firebase;
    const doc = global.document;
    if (!doc || !firebase?.database) return false;
    const ref = firebase.database().ref(`spell_detection_requests/${detectionRoomKey()}`);
    if (doc.body?.classList?.contains("on-game-dashboard")) {
      const cb = (snapshot) => {
        const value = snapshot.val?.() || {};
        const pending = Object.values(value).filter((entry) => entry?.status === "pending").sort((a, b) => numberOr(a.createdAt, 0) - numberOr(b.createdAt, 0));
        if (pending[0]) renderDetectionDmPrompt(pending[0], ref.child(pending[0].id));
      };
      ref.on("value", cb);
      detectionDmUnsubscribe = () => ref.off("value", cb);
    } else {
      const cb = (snapshot) => {
        const value = snapshot.val?.() || {};
        Object.values(value).filter((entry) => entry?.status === "resolved" && detectionMatchesCurrentPlayer(entry)).forEach(showDetectionPlayerResult);
      };
      ref.on("value", cb);
      detectionPlayerUnsubscribe = () => ref.off("value", cb);
    }
    detectionBridgeInstalled = true;
    return true;
  }

  function cleanupConcentrationStatuses(units = []) {
    for (const unit of units || []) {
      for (const statusId of ["bane", "bless", "heroism", "hexed", "marked_quarry"]) {
        const entry = getStatus(unit, statusId);
        if (!entry) continue;
        const sourceUnitId = entry.sourceUnitId || entry.data?.sourceUnitId;
        const required = entry.data?.concentrationSpellId || statusId;
        const source = findSource(units, sourceUnitId);
        if (source && !sourceStillConcentrating(source, required)) removeStatus(unit, statusId);
      }
      const restrained = getStatus(unit, "restrained");
      const restrainedSpell = normalizeId(restrained?.data?.sourceSpellId);
      if (["ensnaring_strike", "entangle"].includes(restrainedSpell)) {
        const sourceUnitId = restrained.sourceUnitId || restrained.data?.sourceUnitId;
        const source = findSource(units, sourceUnitId);
        if (source && !sourceStillConcentrating(source, restrainedSpell)) removeStatus(unit, "restrained");
      }
      if (Array.isArray(unit.__luminousEntangleAreas)) {
        unit.__luminousEntangleAreas = unit.__luminousEntangleAreas.filter((area) => sourceStillConcentrating(unit, "entangle") && numberOr(area.remainingTurns, 0) > 0);
      }
      const heroismState = unit?.__luminousHeroism;
      if (heroismState) {
        const source = findSource(units, heroismState.sourceUnitId);
        if (source && !sourceStillConcentrating(source, "heroism")) clearHeroism(unit);
        else if (heroismHasShield(unit)) removeStatus(unit, "frightened");
      }
      for (const area of [...activeFogCloudAreas.values()]) {
        const source = findSource(units, area.sourceUnitId);
        if (source && !sourceStillConcentrating(source, "fog_cloud")) disperseFogCloud(area, units, "concentration_end");
      }
      if (getStatus(unit, "reaction_suppressed")) removeStatus(unit, "reaction_suppressed");
      if (unit?.__luminousArmorOfAgathys && numberOr(unit.shield, 0) <= 0) clearArmorOfAgathys(unit);
    }
  }

  function patchActionEconomy() {
    const current = global.LuminousActionEconomy;
    if (!current || current.__level1SpellBatchRuntime) return Boolean(current);
    const baseAvailability = current.availability;
    const baseConsume = current.consume;
    const blocked = (unit, cost) => normalizeId(cost) === "reaction" && Boolean(getStatus(unit, "reaction_suppressed"));
    global.LuminousActionEconomy = Object.freeze({
      ...current,
      __level1SpellBatchRuntime: true,
      availability(unit, cost, options = {}) {
        if (blocked(unit, cost)) return { available: false, reason: "reaction_suppressed", remaining: 0 };
        return baseAvailability?.(unit, cost, options) || { available: true, reason: null };
      },
      consume(unit, cost, options = {}) {
        if (blocked(unit, cost)) return false;
        return baseConsume?.(unit, cost, options);
      },
      consumeCounterReaction(unit, skill, options = {}) {
        if (blocked(unit, "reaction")) return false;
        return current.consumeCounterReaction?.(unit, skill, options) ?? baseConsume?.(unit, "reaction", options);
      }
    });
    return true;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__level1SpellBatchRuntime) return Boolean(engine);
    const originalResolveSpell = typeof engine.resolveSpell === "function" ? engine.resolveSpell : null;
    const originalUnilateral = typeof engine.resolveUnilateralWithCounter === "function" ? engine.resolveUnilateralWithCounter : null;
    const originalResolveStandardClash = typeof engine.resolveStandardClash === "function" ? engine.resolveStandardClash : null;
    const originalCalculateFinalPower = typeof engine.calculateFinalPower === "function" ? engine.calculateFinalPower : null;
    const originalTriggerEvent = typeof engine.triggerEvent === "function" ? engine.triggerEvent : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;
    const originalApplyDamage = typeof engine.applyDamage === "function" ? engine.applyDamage : null;

    if (originalCalculateFinalPower) {
      engine.calculateFinalPower = function (skill, headsFlipped, unit = null) {
        const value = originalCalculateFinalPower.call(this, skill, headsFlipped, unit);
        const target = activePowerTargets.get(unitId(unit));
        return value
          + divineSmitePowerBonus(unit, target, skill)
          + guidedLightPowerBonus(unit, target)
          + fogCloudPowerModifier(unit, target, skill?.__luminousResolutionType || "clash");
      };
    }

    if (originalApplyDamage) {
      engine.applyDamage = function (unitDefender, amount, ...rest) {
        const shieldBefore = Math.max(0, numberOr(unitDefender?.shield, 0));
        const result = originalApplyDamage.call(this, unitDefender, amount, ...rest);
        const shieldAfter = Math.max(0, numberOr(unitDefender?.shield, 0));
        if (shieldBefore > shieldAfter) consumeHeroismShield(unitDefender, shieldBefore - shieldAfter);
        return result;
      };
    }

    if (originalResolveSpell) {
      engine.resolveSpell = function (spellSkill, target, targetHeadsFlipped) {
        const result = originalResolveSpell.call(this, spellSkill, target, targetHeadsFlipped) || {};
        if (result.isSuccess === false) {
          const id = normalizeId(spellSkill?.id || spellSkill?.spellId || spellSkill?.name);
          const sourceUnitId = spellSkill?.sourceUnitId || spellSkill?.casterId || null;
          if (id === "bane") applyBane(target, sourceUnitId);
          if (id === "arms_of_hadar") suppressReaction(target);
          if (id === "grease") resolveGreaseSave(target, false, spellSkill?.__luminousGreaseAreaId || null);
          if (id === "entangle" || id === "ensnaring_strike") {
            const data = spellSkill?.__luminousRestrainedData || {};
            applySpellRestrained(target, {
              sourceSpellId: id,
              sourceUnitId,
              spellDC: spellSkill?.saveDC,
              slotLevel: data.slotLevel ?? spellSkill?.slotLevel,
              remainingTurns: 10
            });
          }
        }
        return result;
      };
    }

    if (originalResolveStandardClash) {
      engine.resolveStandardClash = function (unitA, skillA, unitB, skillB, ...rest) {
        activePowerTargets.set(unitId(unitA), unitB);
        activePowerTargets.set(unitId(unitB), unitA);
        let result;
        try { result = originalResolveStandardClash.call(this, unitA, skillA, unitB, skillB, ...rest); }
        finally {
          activePowerTargets.delete(unitId(unitA));
          activePowerTargets.delete(unitId(unitB));
        }
        if (getStatus(unitB, "guided_light")) consumeGuidedLight(unitB);
        if (getStatus(unitA, "guided_light")) consumeGuidedLight(unitA);
        return result;
      };
    }

    if (originalUnilateral) {
      engine.resolveUnilateralWithCounter = function (unitAttacker, attackSkill, unitDefender, counterSkill, options = {}) {
        activePowerTargets.set(unitId(unitAttacker), unitDefender);
        const agathysStateBefore = armorOfAgathysState(unitDefender);
        const agathysShieldBefore = numberOr(unitDefender?.shield, 0);
        const previousResolutionType = attackSkill?.__luminousResolutionType;
        if (attackSkill && typeof attackSkill === "object") attackSkill.__luminousResolutionType = "unopposed";
        let result;
        try { result = originalUnilateral.call(this, unitAttacker, attackSkill, unitDefender, counterSkill, options); }
        finally {
          activePowerTargets.delete(unitId(unitAttacker));
          if (attackSkill && typeof attackSkill === "object") {
            if (previousResolutionType === undefined) delete attackSkill.__luminousResolutionType;
            else attackSkill.__luminousResolutionType = previousResolutionType;
          }
        }
        const retaliation = retaliateArmorOfAgathys(this, unitAttacker, unitDefender, attackSkill, result, {
          state: agathysStateBefore,
          shieldBefore: agathysShieldBefore
        });
        if (retaliation && result && typeof result === "object") result.armorOfAgathysRetaliation = retaliation;
        if (getStatus(unitDefender, "guided_light")) consumeGuidedLight(unitDefender);
        return result;
      };
    }

    if (originalTriggerEvent) {
      engine.triggerEvent = function (tag, context, targetsHit = []) {
        const result = originalTriggerEvent.call(this, tag, context, targetsHit);
        const key = normalizeId(tag);
        if (key === "on_hit") {
          const attacker = context?.attacker || context?.unitAttacker || null;
          const target = context?.defender || context?.currentTarget || context?.target || targetsHit?.[0] || null;
          const skill = context?.skill || {};
          resolveDivineFavorHit(attacker, target, skill, { ...(context || {}), engine: this });
          resolveDivineSmiteHit(attacker, target, skill, { ...(context || {}), engine: this });
          resolveEnsnaringStrikeHit(attacker, target, skill, { ...(context || {}), engine: this });
          resolveGuidingBoltHit(attacker, target, skill);
          resolveHexHit(attacker, target, skill, { ...(context || {}), engine: this });
          resolveHuntersMarkHit(attacker, target, skill, { ...(context || {}), engine: this });
          if (normalizeId(skill?.id || skill?.spellId || skill?.sourceSpellId || skill?.name) === "arms_of_hadar") suppressReaction(target);
        }
        if (key === "on_crit") resolveChromaticOrbCrit({ ...(context || {}), engine: this });
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
        const phase = normalizeId(phaseTag).replace(/^_+|_+$/g, "");
        if (phase === "turn_start") { applyEnsnaringTurnStart(allUnits || []); refreshHeroismAtTurnStart(allUnits || []); }
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (phase === "round_end") tickSpellDurations(allUnits || []);
        if (["turn_end", "round_end"].includes(phase)) cleanupConcentrationStatuses(allUnits || []);
        return result;
      };
    }

    Object.defineProperty(engine, "__level1SpellBatchRuntime", { value: true, configurable: true });
    return true;
  }

  const FIND_FAMILIAR_FORMS = Object.freeze(["bat", "cat", "frog", "hawk", "lizard", "octopus", "owl", "rat", "raven", "spider", "weasel"]);

  function familiarLibraryUnits(context = {}) {
    const candidates = [
      context.unitLibrary,
      context.libraryUnits,
      global.LuminousBattleViewerPlayerSpellPlanner074?.state?.unitLibrary,
      global.LuminousCombatUnitLibrarySync?.state?.remoteCampaignUnits,
      global.LuminousDmCombatTabManager?.state?.units,
      global.LuminousCombatDmSetup073?.state?.units
    ];
    return candidates.find((value) => value && typeof value === "object" && !Array.isArray(value)) || {};
  }

  function familiarChallengeRating(unit = {}) {
    const value = unit.challengeRating ?? unit.challenge_rating ?? unit.cr ?? unit.CR ?? unit.metadata?.challengeRating ?? unit.mechanics?.challengeRating;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function familiarCreatureType(unit = {}) {
    return normalizeId(unit.creatureType || unit.creature_type || unit.typeCreature || unit.metadata?.creatureType || unit.familyType || "");
  }

  function familiarForm(unitIdValue, unit = {}) {
    const explicit = normalizeId(unit.familiarForm || unit.familiar_form || unit.metadata?.familiarForm || unit.mechanics?.familiarForm);
    if (explicit) return explicit;
    const tokens = [
      unit.species, unit.family, unit.variantFamily, unit.animalType, unit.name, unit.nombre, unit.displayName, unitIdValue
    ].map(normalizeId).filter(Boolean);
    for (const form of FIND_FAMILIAR_FORMS) {
      if (tokens.some((token) => token === form || token.startsWith(form + "_") || token.endsWith("_" + form) || token.includes("_" + form + "_"))) return form;
    }
    const cr = familiarChallengeRating(unit);
    const type = familiarCreatureType(unit);
    if (cr === 0 && (type === "beast" || normalizeId(unit.actorCategory) === "beast")) {
      return normalizeId(unit.species || unit.family || unit.name || unitIdValue) || "beast";
    }
    return null;
  }

  function listFindFamiliarOptions(units = null) {
    const library = units && typeof units === "object" ? units : familiarLibraryUnits({});
    return Object.entries(library || {}).map(([id, raw]) => {
      const unit = raw || {};
      const form = familiarForm(id, unit);
      if (!form) return null;
      const allowed = FIND_FAMILIAR_FORMS.includes(form) || (familiarChallengeRating(unit) === 0 && familiarCreatureType(unit) === "beast");
      if (!allowed) return null;
      return {
        id: String(id),
        name: String(unit.characterName || unit.nombre || unit.name || unit.displayName || id),
        form,
        variant: normalizeId(unit.variant || unit.subtype || unit.metadata?.variant || "") || null
      };
    }).filter(Boolean).sort((a, b) => a.form.localeCompare(b.form) || a.name.localeCompare(b.name));
  }

  function resolveFindFamiliarChoice(familiarUnitId, context = {}) {
    const id = String(familiarUnitId || "").trim();
    if (!id) return { ok: false, reason: "familiar_unit_required", unitId: null, definition: null };
    const library = familiarLibraryUnits(context);
    const definition = library[id];
    if (!definition) return { ok: false, reason: "familiar_unit_not_found", unitId: id, definition: null };
    const option = listFindFamiliarOptions({ [id]: definition })[0] || null;
    if (!option) return { ok: false, reason: "unit_not_valid_familiar", unitId: id, definition: null };
    return { ok: true, reason: null, unitId: id, definition: clone(definition), option };
  }

  function familiarPool(context = {}) {
    if (context.combatData && typeof context.combatData === "object") return context.combatData;
    if (global.combatData && typeof global.combatData === "object") return global.combatData;
    if (context.entities && typeof context.entities === "object") return context.entities;
    return {};
  }

  function removeExistingFamiliar(caster, context = {}) {
    const previousId = String(caster?.__luminousFindFamiliar?.combatId || caster?.__luminousFindFamiliar?.id || "");
    if (!previousId) return false;
    const pool = familiarPool(context);
    if (pool?.[previousId]) delete pool[previousId];
    if (Array.isArray(context.units)) {
      const index = context.units.findIndex((unit) => unitId(unit) === previousId);
      if (index >= 0) context.units.splice(index, 1);
    }
    delete caster.__luminousFindFamiliar;
    return true;
  }

  function restrictFamiliarCombat(unit = {}) {
    const originalSkillIds = [
      ...(Array.isArray(unit.skillIds) ? unit.skillIds : []),
      ...(Array.isArray(unit.skillSlotIds) ? unit.skillSlotIds : []),
      ...(Array.isArray(unit.action_slots) ? unit.action_slots : [])
    ].map(String);
    unit.familiarOriginalSkillIds = [...new Set(originalSkillIds)];
    unit.familiarCannotAttack = false;
    const inferredSlots = Math.max(1, originalSkillIds.length || 1);
    if (!Number.isFinite(Number(unit.actionSlots))) unit.actionSlots = inferredSlots;
    if (!Number.isFinite(Number(unit.activeSlots))) unit.activeSlots = unit.actionSlots;
    if (!Number.isFinite(Number(unit.maxSlotsLimit))) unit.maxSlotsLimit = unit.actionSlots;
    return unit;
  }

  function summonFindFamiliar(caster, options = {}) {
    if (!caster || typeof caster !== "object") return { resolved: false, reason: "caster_required" };
    const context = options.context || {};
    const choice = resolveFindFamiliarChoice(options.familiarUnitId, context);
    if (!choice.ok) return { resolved: false, reason: choice.reason, choices: listFindFamiliarOptions(familiarLibraryUnits(context)) };

    removeExistingFamiliar(caster, context);
    const instantiator = global.LuminousUnitCombatInstantiator || null;
    const serial = `familiar_${normalizeId(unitId(caster) || "caster")}`;
    let familiar = instantiator?.instantiate
      ? instantiator.instantiate(choice.unitId, choice.definition, { faction: "ally", serial, initializeEncounter: true })
      : { ...clone(choice.definition), id: `ally:unit:${normalizeId(choice.unitId)}:${serial}`, combatId: `ally:unit:${normalizeId(choice.unitId)}:${serial}` };

    familiar = restrictFamiliarCombat(familiar);
    const spiritType = ["celestial", "fey", "fiend"].includes(normalizeId(options.spiritType)) ? normalizeId(options.spiritType) : "fey";
    familiar.sourceSpellId = "find_familiar";
    familiar.summonerId = unitId(caster);
    familiar.isSummon = true;
    familiar.isFamiliar = true;
    familiar.familiarForm = choice.option.form;
    familiar.familiarUnitId = choice.unitId;
    familiar.familiarSpiritType = spiritType;
    familiar.originalCreatureType = familiar.creatureType || familiar.creature_type || null;
    familiar.creatureType = spiritType;
    familiar.targetable = true;
    familiar.obeysSummoner = true;
    familiar.telepathyFeet = 100;
    familiar.deliverTouchSpell = true;
    familiar.familiarSensesQuickAction = true;
    familiar.dismissed = false;

    const pool = familiarPool(context);
    pool[familiar.id] = familiar;
    if (Array.isArray(context.units) && !context.units.some((unit) => unitId(unit) === familiar.id)) context.units.push(familiar);
    caster.__luminousFindFamiliar = {
      id: familiar.id,
      combatId: familiar.id,
      unitLibraryId: choice.unitId,
      form: choice.option.form,
      spiritType
    };
    return { resolved: true, familiar, option: choice.option, spiritType };
  }

  function dismissFindFamiliar(caster, context = {}, permanent = false) {
    const state = caster?.__luminousFindFamiliar;
    if (!state) return { resolved: false, reason: "familiar_missing" };
    const pool = familiarPool(context);
    const familiar = pool?.[state.combatId] || (Array.isArray(context.units) ? context.units.find((unit) => unitId(unit) === state.combatId) : null);
    if (permanent) {
      removeExistingFamiliar(caster, context);
      return { resolved: true, permanent: true };
    }
    if (familiar) {
      familiar.dismissed = true;
      familiar.battleActive = false;
      familiar.targetable = false;
    }
    return { resolved: true, permanent: false, familiarId: state.combatId };
  }

  function restoreFindFamiliar(caster, context = {}) {
    const state = caster?.__luminousFindFamiliar;
    if (!state) return { resolved: false, reason: "familiar_missing" };
    const pool = familiarPool(context);
    const familiar = pool?.[state.combatId] || (Array.isArray(context.units) ? context.units.find((unit) => unitId(unit) === state.combatId) : null);
    if (!familiar) return { resolved: false, reason: "familiar_entity_missing" };
    familiar.dismissed = false;
    familiar.battleActive = true;
    familiar.targetable = true;
    return { resolved: true, familiar };
  }

  function cleanupDefeatedFamiliars(units = [], context = {}) {
    let removed = 0;
    for (const familiar of (Array.isArray(units) ? [...units] : Object.values(units || {}))) {
      if (!familiar?.isFamiliar || numberOr(familiar.hp, 1) > 0) continue;
      const caster = (Array.isArray(units) ? units : Object.values(units || {})).find((unit) => unitId(unit) === familiar.summonerId);
      if (caster?.__luminousFindFamiliar?.combatId === unitId(familiar)) delete caster.__luminousFindFamiliar;
      const pool = familiarPool(context);
      if (pool?.[unitId(familiar)]) delete pool[unitId(familiar)];
      if (Array.isArray(units)) {
        const index = units.findIndex((unit) => unitId(unit) === unitId(familiar));
        if (index >= 0) units.splice(index, 1);
      }
      removed += 1;
    }
    return removed;
  }

  function deliverTouchSpellThroughFamiliar(caster, familiar, spellAction = {}) {
    if (!caster || !familiar?.isFamiliar || familiar.summonerId !== unitId(caster) || familiar.dismissed) {
      return { resolved: false, reason: "active_familiar_required", action: spellAction };
    }
    const action = clone(spellAction) || {};
    action.metadata = {
      ...(action.metadata || {}),
      spellOriginUnitId: unitId(familiar),
      deliveredByFamiliar: true,
      familiarReactionRequired: true,
      familiarRangeFeet: 100
    };
    return { resolved: true, action };
  }


  const activeFogCloudAreas = new Map();
  const activeGreaseAreas = new Map();

  function arrayIds(value) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  }

  function addAreaMembership(unit, key, areaId) {
    if (!unit || !areaId) return [];
    const current = new Set(arrayIds(unit[key]));
    current.add(String(areaId));
    unit[key] = [...current];
    return unit[key];
  }

  function removeAreaMembership(unit, key, areaId) {
    if (!unit) return [];
    unit[key] = arrayIds(unit[key]).filter((id) => id !== String(areaId));
    return unit[key];
  }

  function senseTokens(unit = {}) {
    const rows = [
      unit.senses, unit.sense, unit.traits, unit.traitIds, unit.trait_ids,
      unit.features, unit.passives, unit.specialSenses, unit.special_senses
    ].flatMap((value) => {
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object") return [...Object.keys(value), ...Object.values(value)];
      return value == null ? [] : [value];
    });
    return rows.map((value) => normalizeId(typeof value === "object" ? (value.id || value.name || value.type || "") : value)).filter(Boolean);
  }

  function hasFogBypass(unit = {}) {
    const tokens = senseTokens(unit);
    return tokens.some((id) => ["truesight", "true_sight", "blindsight", "blind_sight"].includes(id));
  }

  function createFogCloudArea(caster, targets = [], options = {}) {
    if (!caster) return { resolved: false, reason: "caster_required" };
    const slotLevel = Math.max(1, Math.trunc(numberOr(options.slotLevel, 1)));
    const id = String(options.id || `fog_cloud_${unitId(caster) || "caster"}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const members = (targets || []).filter(Boolean);
    const area = {
      id,
      kind: "spell_area",
      sourceSpellId: "fog_cloud",
      sourceUnitId: unitId(caster),
      encounterModifierId: "heavy_fog",
      visibility: "heavily_obscured",
      slotLevel,
      additionalAreaRings: Math.max(0, slotLevel - 1),
      clashPowerModifier: -3,
      unopposedFinalPowerModifier: -4,
      sightPerceptionCheckModifier: -3,
      analyseThresholdModifier: 5,
      bypassSenses: ["blindsight", "truesight"],
      suppressed: false,
      active: true,
      targetIds: members.map(unitId).filter(Boolean)
    };
    activeFogCloudAreas.set(id, area);
    caster.__luminousFogCloudAreas = [...(caster.__luminousFogCloudAreas || []).filter((row) => row?.active !== false), area];
    members.forEach((unit) => addAreaMembership(unit, "__luminousFogCloudAreaIds", id));
    return { resolved: true, area };
  }

  function fogCloudAreasForUnit(unit) {
    return arrayIds(unit?.__luminousFogCloudAreaIds)
      .map((id) => activeFogCloudAreas.get(id))
      .filter((area) => area?.active !== false && area?.suppressed !== true);
  }

  function setFogCloudMembership(areaOrId, unit, inside = true) {
    const area = typeof areaOrId === "string" ? activeFogCloudAreas.get(areaOrId) : areaOrId;
    if (!area || !unit) return false;
    const id = unitId(unit);
    area.targetIds = arrayIds(area.targetIds).filter((row) => row !== id);
    if (inside && id) area.targetIds.push(id);
    if (inside) addAreaMembership(unit, "__luminousFogCloudAreaIds", area.id);
    else removeAreaMembership(unit, "__luminousFogCloudAreaIds", area.id);
    return true;
  }

  function disperseFogCloud(areaOrId, units = [], reason = "strong_wind") {
    const area = typeof areaOrId === "string" ? activeFogCloudAreas.get(areaOrId) : areaOrId;
    if (!area) return { resolved: false, reason: "fog_area_missing" };
    area.active = false;
    area.dispersedBy = reason;
    (units || []).forEach((unit) => removeAreaMembership(unit, "__luminousFogCloudAreaIds", area.id));
    activeFogCloudAreas.delete(area.id);
    return { resolved: true, areaId: area.id, reason };
  }

  function suppressFogCloud(areaOrId, suppressed = true) {
    const area = typeof areaOrId === "string" ? activeFogCloudAreas.get(areaOrId) : areaOrId;
    if (!area) return false;
    area.suppressed = suppressed === true;
    return true;
  }

  function fogCloudPowerModifier(attacker, target, resolutionType = "clash") {
    if (!attacker || hasFogBypass(attacker)) return 0;
    if (!fogCloudAreasForUnit(attacker).length && !fogCloudAreasForUnit(target).length) return 0;
    return normalizeId(resolutionType) === "unopposed" ? -4 : -3;
  }

  function fogCloudAnalyseThresholdModifier(analyser, target) {
    if (!target || hasFogBypass(analyser)) return 0;
    return fogCloudAreasForUnit(target).length ? 5 : 0;
  }

  function fogCloudSightPerceptionModifier(unit) {
    if (!unit || hasFogBypass(unit)) return 0;
    return fogCloudAreasForUnit(unit).length ? -3 : 0;
  }

  function isGrounded(unit = {}) {
    if (unit.isFlying === true || unit.flying === true || normalizeId(unit.activeMovementMode || unit.movementMode) === "fly") return false;
    if (numberOr(unit.altitude, 0) > 0) return false;
    return true;
  }

  function recomputeGreaseSpeedModifier(unit) {
    if (!unit) return 0;
    const active = arrayIds(unit.__luminousGreaseAreaIds)
      .map((id) => activeGreaseAreas.get(id))
      .some((area) => area?.active !== false && numberOr(area.remainingTurns, 0) > 0);
    unit.__luminousAreaSpeedModifier = active && isGrounded(unit) ? -1 : 0;
    return unit.__luminousAreaSpeedModifier;
  }

  function createGreaseArea(caster, targets = [], options = {}) {
    if (!caster) return { resolved: false, reason: "caster_required" };
    const id = String(options.id || `grease_${unitId(caster) || "caster"}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const members = (targets || []).filter(Boolean);
    const area = {
      id,
      kind: "spell_area",
      sourceSpellId: "grease",
      sourceUnitId: unitId(caster),
      spellDC: numberOr(options.spellDC, 0),
      remainingTurns: 10,
      speedModifier: -1,
      groundedOnly: true,
      active: true,
      targetIds: members.map(unitId).filter(Boolean)
    };
    activeGreaseAreas.set(id, area);
    caster.__luminousGreaseAreas = [...(caster.__luminousGreaseAreas || []), area];
    members.forEach((unit) => {
      addAreaMembership(unit, "__luminousGreaseAreaIds", id);
      recomputeGreaseSpeedModifier(unit);
    });
    return { resolved: true, area };
  }

  function setGreaseMembership(areaOrId, unit, inside = true) {
    const area = typeof areaOrId === "string" ? activeGreaseAreas.get(areaOrId) : areaOrId;
    if (!area || !unit) return false;
    const id = unitId(unit);
    area.targetIds = arrayIds(area.targetIds).filter((row) => row !== id);
    if (inside && id) area.targetIds.push(id);
    if (inside) addAreaMembership(unit, "__luminousGreaseAreaIds", area.id);
    else removeAreaMembership(unit, "__luminousGreaseAreaIds", area.id);
    recomputeGreaseSpeedModifier(unit);
    return true;
  }

  function greaseSpeedModifier(unit) {
    return recomputeGreaseSpeedModifier(unit);
  }

  function resolveGreaseSave(target, saveSucceeded, areaOrId = null) {
    if (!target || !isGrounded(target)) return { resolved: false, ignored: true, reason: "not_grounded" };
    const area = typeof areaOrId === "string" ? activeGreaseAreas.get(areaOrId) : areaOrId;
    if (saveSucceeded === true) return { resolved: true, success: true, areaId: area?.id || null };
    const status = applyStatus(target, "prone", {
      mode: "set",
      count: 1,
      sourceUnitId: area?.sourceUnitId || null,
      data: { sourceSpellId: "grease", areaId: area?.id || null }
    });
    return { resolved: true, success: false, status, areaId: area?.id || null };
  }

  function saveSucceededFor(target, action = {}, effect = {}) {
    const id = unitId(target);
    const map = action?.metadata?.saveResults || action?.metadata?.viewerPlan?.saveResults || effect?.saveResults || {};
    const raw = map?.[id] ?? map?.[target?.id] ?? effect?.saveSucceeded ?? action?.metadata?.saveSucceeded;
    if (typeof raw === "boolean") return raw;
    if (raw && typeof raw === "object" && typeof raw.success === "boolean") return raw.success;
    return false;
  }

  function goodMagicFoodSpec(variant = "goodberry") {
    const id = normalizeId(variant);
    if (id === "goodshrooms" || id === "goodshroom") {
      return { variant: "goodshrooms", definitionId: "common_mushroom", magicalName: "Goodshrooms", baseName: "Common Mushroom", compatibleTags: ["fungus", "mushroom"] };
    }
    return { variant: "goodberry", definitionId: "blueberry", magicalName: "Goodberry", baseName: "Blueberry", compatibleTags: ["berry", "blueberry", "fruit"] };
  }

  function createGoodMagicFood(caster, variant = "goodberry", options = {}) {
    if (!caster) return { resolved: false, reason: "caster_required" };
    const spec = goodMagicFoodSpec(variant);
    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000;
    const inv = inventoryRuntime();
    const instanceId = inv?.createInstanceId?.(spec.definitionId) || `${spec.definitionId}_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const secretCooking = {
      hidden: true,
      requiredQuantity: 10,
      compatibleTags: spec.compatibleTags,
      healFlat: 15,
      healMaxHpPercent: 10,
      inheritIngredientExpiration: true,
      removeHealingOnExpiration: true
    };
    const item = {
      instanceId,
      definitionId: spec.definitionId,
      itemId: spec.definitionId,
      quantity: 10,
      displayName: spec.magicalName,
      name: spec.magicalName,
      edible: true,
      hungerSlotsRestored: 3,
      hydrationSlotsRestored: 3,
      temporary: true,
      expiresAt,
      tags: ["food", "ingredient", "temporary_magical_food", ...spec.compatibleTags],
      runtimeState: {
        goodMagicFood: { sourceSpellId: "goodberry", variant: spec.variant, expiresAt, hungerSlotsRestored: 3, hydrationSlotsRestored: 3 }
      },
      customData: {
        goodMagicFood: {
          sourceSpellId: "goodberry",
          variant: spec.variant,
          baseDefinitionId: spec.definitionId,
          baseName: spec.baseName,
          expiresAt,
          hungerSlotsRestored: 3,
          hydrationSlotsRestored: 3,
          ingredient: true,
          secretCooking
        }
      }
    };
    const insertion = inv?.insertItem?.(caster, item, options.destination || "active") || (() => {
      caster.inventory ||= {};
      caster.inventory[instanceId] = item;
      return { inserted: true, quantity: 10, instanceId };
    })();
    return { resolved: insertion.inserted === true, item, insertion, variant: spec.variant, expiresAt };
  }

  function expireGoodMagicFoodItem(item, now = Date.now()) {
    const data = item?.customData?.goodMagicFood || item?.runtimeState?.goodMagicFood;
    if (!data || numberOr(data.expiresAt, Infinity) > now) return false;
    const spec = goodMagicFoodSpec(data.variant);
    item.displayName = spec.baseName;
    item.name = spec.baseName;
    item.temporary = false;
    delete item.expiresAt;
    delete item.hungerSlotsRestored;
    delete item.hydrationSlotsRestored;
    if (item.customData) delete item.customData.goodMagicFood;
    if (item.runtimeState) delete item.runtimeState.goodMagicFood;
    item.tags = arrayIds(item.tags).filter((tag) => !["temporary_magical_food"].includes(normalizeId(tag)));
    return true;
  }

  function expireGoodMagicFood(unit, now = Date.now()) {
    const inv = inventoryRuntime();
    const containers = [
      inv?.activeContainer?.(unit, false)?.value,
      inv?.stashContainer?.(unit, false)?.value,
      unit?.inventory,
      unit?.inventario
    ].filter(Boolean);
    let expired = 0;
    const seen = new Set();
    for (const container of containers) {
      for (const item of Object.values(container || {})) {
        if (!item || seen.has(item)) continue;
        seen.add(item);
        if (expireGoodMagicFoodItem(item, now)) expired += 1;
      }
    }
    return expired;
  }

  function resolveGoodMagicCookingEnhancement(ingredients = [], now = Date.now()) {
    const groups = new Map();
    for (const raw of ingredients || []) {
      const item = raw?.item || raw;
      const data = item?.customData?.goodMagicFood || item?.runtimeState?.goodMagicFood;
      if (!data || numberOr(data.expiresAt, 0) <= now) continue;
      const key = normalizeId(data.variant || "goodberry");
      const qty = Math.max(0, Math.trunc(numberOr(raw?.units ?? raw?.quantity ?? item?.quantity, 1)));
      const row = groups.get(key) || { quantity: 0, expiresAt: Infinity, data };
      row.quantity += qty;
      row.expiresAt = Math.min(row.expiresAt, numberOr(data.expiresAt, Infinity));
      groups.set(key, row);
    }
    for (const [variant, row] of groups) {
      if (row.quantity >= 10) {
        return {
          active: true,
          secret: true,
          variant,
          requiredQuantity: 10,
          healing: { flat: 15, maxHpPercent: 10 },
          expiresAt: row.expiresAt,
          inheritIngredientExpiration: true
        };
      }
    }
    return { active: false };
  }

  function calculateHealingWordHealing(slotLevel = 1, spellMod = 0, maxHp = 0) {
    const slot = Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    const mod = numberOr(spellMod, 0);
    const hp = Math.max(0, numberOr(maxHp, 0));
    const flat = slot;
    const maxHpPercent = Math.max(2, 2 * mod);
    const percentHealing = hp * (maxHpPercent / 100);
    return { slotLevel: slot, spellMod: mod, flat, maxHpPercent, percentHealing, total: flat + percentHealing };
  }

  function applyHealingWord(target, slotLevel = 1, spellMod = 0) {
    if (!target) return { resolved: false, reason: "target_required" };
    const maxHp = maxHpOf(target);
    if (maxHp <= 0) return { resolved: false, reason: "max_hp_required" };
    const hpBefore = Math.min(maxHp, currentHpOf(target));
    const healing = calculateHealingWordHealing(slotLevel, spellMod, maxHp);
    const hpAfter = Math.min(maxHp, hpBefore + healing.total);
    setCurrentHp(target, hpAfter);
    return { resolved: true, targetId: unitId(target), hpBefore, hpAfter, healed: Math.max(0, hpAfter - hpBefore), ...healing };
  }

  function guidedLightPowerBonus(attacker, target) {
    if (!attacker || !target || !getStatus(target, "guided_light")) return 0;
    return 2;
  }

  function applyGuidedLight(target, caster = null) {
    return applyStatus(target, "guided_light", {
      mode: "set", count: 1, sourceUnitId: unitId(caster),
      duration: "caster_next_turn_end",
      data: { sourceSpellId: "guiding_bolt", sourceUnitId: unitId(caster), finalPowerBonus: 2 }
    });
  }

  function consumeGuidedLight(target) {
    if (!getStatus(target, "guided_light")) return false;
    removeStatus(target, "guided_light");
    return true;
  }

  function markSkillProc(skill, key, target) {
    if (!skill || typeof skill !== "object") return true;
    const procKey = `${normalizeId(key)}:${unitId(target)}`;
    const used = new Set(arrayIds(skill.__luminousSpellProcKeys));
    if (used.has(procKey)) return false;
    used.add(procKey);
    skill.__luminousSpellProcKeys = [...used];
    return true;
  }

  function resolveGuidingBoltHit(caster, target, skill = {}) {
    if (normalizeId(skill.id || skill.spellId || skill.sourceSpellId || skill.name) !== "guiding_bolt" || !target) return null;
    applyStatus(target, "radiance", { mode: "add", count: 2, sourceUnitId: unitId(caster), data: { sourceSpellId: "guiding_bolt" } });
    const guided = applyGuidedLight(target, caster);
    return { resolved: true, radianceCount: 2, guidedLight: guided };
  }

  function heroismDesiredShield(spellMod = 0) {
    return Math.max(0, 3 * numberOr(spellMod, 0));
  }

  function addRawShield(unit, amount) {
    const value = Math.max(0, numberOr(amount, 0));
    if (value <= 0) return 0;
    const shields = shieldRuntime();
    if (shields?.gainShield) return shields.gainShield(unit, value, shields.SHIELD_TYPES?.PERSISTENT || "persistent");
    unit.shield = Math.max(0, numberOr(unit.shield, 0)) + value;
    return value;
  }

  function removeRawShield(unit, amount) {
    let value = Math.max(0, numberOr(amount, 0));
    if (value <= 0 || !unit) return 0;
    const pools = unit.shieldPools;
    if (pools && typeof pools === "object") {
      const fromPersistent = Math.min(value, Math.max(0, numberOr(pools.persistent, 0)));
      pools.persistent = Math.max(0, numberOr(pools.persistent, 0) - fromPersistent);
      value -= fromPersistent;
      unit.shield = Math.max(0, numberOr(pools.ephemeral, 0) + numberOr(pools.encounter, 0) + numberOr(pools.persistent, 0));
      return fromPersistent;
    }
    const before = Math.max(0, numberOr(unit.shield, 0));
    const removed = Math.min(before, value);
    unit.shield = before - removed;
    return removed;
  }

  function grantHeroism(target, caster, spellMod = 0) {
    if (!target || !caster) return { resolved: false, reason: "target_and_caster_required" };
    clearHeroism(target, false);
    const desired = heroismDesiredShield(spellMod);
    const gained = addRawShield(target, desired);
    target.__luminousHeroism = { sourceUnitId: unitId(caster), desiredShield: desired, remainingShield: gained, sourceSpellId: "heroism" };
    removeStatus(target, "frightened");
    const status = applyStatus(target, "heroism", {
      mode: "set", count: 10, sourceUnitId: unitId(caster),
      data: { sourceUnitId: unitId(caster), concentrationSpellId: "heroism", desiredShield: desired }
    });
    return { resolved: true, desiredShield: desired, shieldGranted: gained, status };
  }

  function heroismHasShield(unit) {
    return numberOr(unit?.__luminousHeroism?.remainingShield, 0) > 0;
  }

  function clearHeroism(unit, removeStatusToo = true) {
    const state = unit?.__luminousHeroism;
    if (!state) return false;
    removeRawShield(unit, state.remainingShield);
    delete unit.__luminousHeroism;
    if (removeStatusToo) removeStatus(unit, "heroism");
    return true;
  }

  function consumeHeroismShield(unit, shieldConsumed = 0) {
    const state = unit?.__luminousHeroism;
    if (!state) return 0;
    state.remainingShield = Math.max(0, numberOr(state.remainingShield, 0) - Math.max(0, numberOr(shieldConsumed, 0)));
    return state.remainingShield;
  }

  function refreshHeroismAtTurnStart(units = []) {
    const refreshed = [];
    for (const unit of units || []) {
      const state = unit?.__luminousHeroism;
      if (!state) continue;
      const source = findSource(units, state.sourceUnitId);
      if (source && !sourceStillConcentrating(source, "heroism")) {
        clearHeroism(unit);
        continue;
      }
      const missing = Math.max(0, numberOr(state.desiredShield, 0) - numberOr(state.remainingShield, 0));
      if (missing > 0) {
        const gained = addRawShield(unit, missing);
        state.remainingShield += gained;
      }
      if (heroismHasShield(unit)) removeStatus(unit, "frightened");
      refreshed.push({ targetId: unitId(unit), shield: state.remainingShield });
    }
    return refreshed;
  }

  function applyHex(caster, target, abilityId, slotLevel = 1, now = Date.now()) {
    if (!caster || !target) return { resolved: false, reason: "target_and_caster_required" };
    const ability = normalizeId(abilityId);
    if (!["str", "dex", "con", "int", "wis", "cha"].includes(ability)) return { resolved: false, reason: "hex_ability_required" };
    const oldTargetId = caster.__luminousHex?.targetId;
    if (oldTargetId && oldTargetId !== unitId(target)) {
      const old = allCombatUnits({}).find((unit) => unitId(unit) === oldTargetId);
      if (old) removeStatus(old, "hexed");
    }
    const hours = slotLevel >= 5 ? 24 : slotLevel >= 3 ? 8 : slotLevel >= 2 ? 4 : 1;
    const state = { sourceSpellId: "hex", sourceUnitId: unitId(caster), targetId: unitId(target), ability, slotLevel, expiresAt: now + hours * 60 * 60 * 1000 };
    caster.__luminousHex = state;
    const status = applyStatus(target, "hexed", { mode: "set", count: 1, sourceUnitId: unitId(caster), data: { ...state, concentrationSpellId: "hex" } });
    return { resolved: true, state, status };
  }

  function hexCheckThresholdModifier(unit, abilityId) {
    const status = getStatus(unit, "hexed");
    if (!status) return 0;
    return normalizeId(status.data?.ability) === normalizeId(abilityId) ? 3 : 0;
  }

  function resolveHexHit(caster, target, skill = {}, context = {}) {
    const state = caster?.__luminousHex;
    if (!state || unitId(target) !== state.targetId || !getStatus(target, "hexed") || !markSkillProc(skill, "hex", target)) return null;
    const applied = applyFixedDamage(target, 3, { engine: context.engine, damageKind: "directo", sourceSpellId: "hex", sourceUnitId: unitId(caster) });
    const decay = applyStatus(target, "decay", { mode: "add", count: 1, sourceUnitId: unitId(caster), data: { sourceSpellId: "hex" } });
    return { resolved: true, fixedDamage: 3, decayCount: 1, applied, status: decay };
  }

  function transferHex(caster, target) {
    const state = caster?.__luminousHex;
    if (!state || !target) return { resolved: false, reason: "active_hex_required" };
    const previous = allCombatUnits({}).find((unit) => unitId(unit) === state.targetId);
    if (previous) removeStatus(previous, "hexed");
    return applyHex(caster, target, state.ability, state.slotLevel, Date.now());
  }

  function applyHuntersMark(caster, target, slotLevel = 1, now = Date.now()) {
    if (!caster || !target) return { resolved: false, reason: "target_and_caster_required" };
    const hours = slotLevel >= 5 ? 24 : slotLevel >= 3 ? 8 : 1;
    const state = { sourceSpellId: "hunters_mark", sourceUnitId: unitId(caster), targetId: unitId(target), slotLevel, expiresAt: now + hours * 60 * 60 * 1000 };
    caster.__luminousHuntersMark = state;
    const status = applyStatus(target, "marked_quarry", { mode: "set", count: 1, sourceUnitId: unitId(caster), data: { ...state, concentrationSpellId: "hunters_mark" } });
    return { resolved: true, state, status };
  }

  function markedQuarryAnalyseThresholdModifier(analyser, target) {
    const status = getStatus(target, "marked_quarry");
    return status && String(status.sourceUnitId || status.data?.sourceUnitId) === unitId(analyser) ? -2 : 0;
  }

  function markedQuarryTrackingThresholdModifier(analyser, target, skillId) {
    const status = getStatus(target, "marked_quarry");
    if (!status || String(status.sourceUnitId || status.data?.sourceUnitId) !== unitId(analyser)) return 0;
    const id = normalizeId(skillId);
    return ["perception", "survival"].includes(id) ? -3 : 0;
  }

  function resolveHuntersMarkHit(caster, target, skill = {}, context = {}) {
    const state = caster?.__luminousHuntersMark;
    if (!state || unitId(target) !== state.targetId || !getStatus(target, "marked_quarry") || !markSkillProc(skill, "hunters_mark", target)) return null;
    const applied = applyFixedDamage(target, 4, { engine: context.engine, damageKind: "directo", sourceSpellId: "hunters_mark", sourceUnitId: unitId(caster) });
    return { resolved: true, fixedDamage: 4, applied };
  }

  function transferHuntersMark(caster, target) {
    const state = caster?.__luminousHuntersMark;
    if (!state || !target) return { resolved: false, reason: "active_hunters_mark_required" };
    const previous = allCombatUnits({}).find((unit) => unitId(unit) === state.targetId);
    if (previous) removeStatus(previous, "marked_quarry");
    return applyHuntersMark(caster, target, state.slotLevel, Date.now());
  }

  function resolveAreaSaveDamage(targets = [], damage = 0, action = {}, effect = {}, options = {}) {
    const results = [];
    for (const target of (targets || []).filter(Boolean)) {
      const success = saveSucceededFor(target, action, effect);
      const amount = success ? Math.floor(damage * numberOr(options.successMultiplier, 0)) : damage;
      const applied = amount > 0 ? applyFixedDamage(target, amount, { engine: options.engine || action?.metadata?.engine, damageKind: "directo", sourceSpellId: options.sourceSpellId }) : null;
      if (!success && options.failedStatus) {
        applyStatus(target, options.failedStatus.status, {
          mode: "add",
          count: numberOr(options.failedStatus.count, 1),
          potency: numberOr(options.failedStatus.potency, 0),
          data: { sourceSpellId: options.sourceSpellId }
        });
      }
      results.push({ targetId: unitId(target), success, damage: amount, applied });
    }
    return { resolved: results.length > 0, results };
  }

  function resolveHailOfThorns(targets = [], slotLevel = 1, action = {}, effect = {}) {
    const damage = 5 * Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    return { damage, ...resolveAreaSaveDamage(targets, damage, action, effect, { sourceSpellId: "hail_of_thorns", successMultiplier: 0.5 }) };
  }

  function resolveHellishRebuke(target, slotLevel = 1, action = {}, effect = {}) {
    if (!target) return { resolved: false, reason: "target_required" };
    const damage = 5 + 5 * Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    return {
      damage,
      ...resolveAreaSaveDamage([target], damage, action, effect, {
        sourceSpellId: "hellish_rebuke",
        successMultiplier: 0.5,
        failedStatus: { status: "burn", count: 3 }
      })
    };
  }

  function resolveIceKnifeExplosion(targets = [], slotLevel = 1, action = {}, effect = {}) {
    const damage = 3 + 3 * Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    return { damage, attackWeight: 3, ...resolveAreaSaveDamage(targets, damage, action, effect, { sourceSpellId: "ice_knife", successMultiplier: 0, failedStatus: { status: "chill", count: 2 } }) };
  }

  function effectHandlers() {
    return {
      level1_alarm({ actor, effect, action } = {}) {
        const options = action?.metadata?.viewerPlan?.alarm || effect?.alarm || {};
        return createAlarmWard(actor, options);
      },
      level1_armor_of_agathys({ actor, action, effect } = {}) {
        const slotLevel = action?.metadata?.slotLevel ?? effect?.slotLevel ?? 1;
        return grantArmorOfAgathys(actor, slotLevel);
      },
      level1_bless({ actor, targets = [] } = {}) {
        const sourceUnitId = unitId(actor);
        const applied = (targets || []).filter(Boolean).map((target) => ({ targetId: unitId(target), status: applyBless(target, sourceUnitId) }));
        return { resolved: applied.length > 0, applied };
      },
      level1_cure_wounds({ actor, targets = [], action = {}, effect = {} } = {}) {
        const target = (targets || []).filter(Boolean)[0] || actor;
        const slotLevel = action?.metadata?.slotLevel ?? effect.slotLevel ?? 1;
        const spellMod = resolveCureWoundsSpellMod(actor, action, effect);
        return applyCureWounds(target, slotLevel, spellMod);
      },
      level1_detection_request({ actor, action = {}, effect = {} } = {}) {
        return buildDetectionRequest(actor, effect.spellId || action?.source?.id, { casterUid: action?.metadata?.viewerPlan?.casterUid });
      },
      level1_disguise_self({ actor } = {}) {
        return applyDisguiseSelf(actor);
      },
      level1_divine_favor({ actor } = {}) {
        return applyDivineFavor(actor);
      },
      level1_divine_smite({ actor, action = {}, effect = {} } = {}) {
        return prepareDivineSmite(actor, action?.metadata?.slotLevel ?? effect.slotLevel ?? 1);
      },
      level1_ensnaring_strike({ actor, action = {}, effect = {} } = {}) {
        return prepareEnsnaringStrike(actor, action, effect);
      },
      level1_entangle_area({ actor, targets = [] } = {}) {
        return createEntangleArea(actor, targets);
      },
      level1_find_familiar({ actor, action = {}, effect = {}, context = {} } = {}) {
        const plan = action?.metadata?.viewerPlan || {};
        const familiarUnitId = plan.familiarUnitId || effect.familiarUnitId || action?.metadata?.familiarUnitId;
        const spiritType = plan.spellChoice?.value || plan.spiritType || effect.spiritType || "fey";
        return summonFindFamiliar(actor, { familiarUnitId, spiritType, context });
      },
      level1_fog_cloud_area({ actor, targets = [], action = {}, effect = {} } = {}) {
        return createFogCloudArea(actor, targets, { slotLevel: action?.metadata?.slotLevel ?? effect.slotLevel ?? 1 });
      },
      level1_goodberry({ actor, action = {}, effect = {} } = {}) {
        const plan = action?.metadata?.viewerPlan || {};
        const variant = plan.spellChoice?.value || plan.goodberryVariant || effect.variant || "goodberry";
        return createGoodMagicFood(actor, variant);
      },
      level1_grease_area({ actor, targets = [], action = {}, effect = {} } = {}) {
        const areaResult = createGreaseArea(actor, targets, { spellDC: action?.metadata?.spellDC ?? effect.spellDC ?? 0 });
        if (areaResult.resolved) {
          for (const target of (targets || []).filter(Boolean)) resolveGreaseSave(target, saveSucceededFor(target, action, effect), areaResult.area);
        }
        return areaResult;
      },
      level1_healing_word({ actor, targets = [], action = {}, effect = {} } = {}) {
        const target = (targets || []).filter(Boolean)[0] || actor;
        const slotLevel = action?.metadata?.slotLevel ?? effect.slotLevel ?? 1;
        const spellMod = resolveCureWoundsSpellMod(actor, action, effect);
        return applyHealingWord(target, slotLevel, spellMod);
      },
      level1_hail_of_thorns({ targets = [], action = {}, effect = {} } = {}) {
        return resolveHailOfThorns(targets, action?.metadata?.slotLevel ?? effect.slotLevel ?? 1, action, effect);
      },
      level1_hellish_rebuke({ targets = [], action = {}, effect = {} } = {}) {
        return resolveHellishRebuke((targets || []).filter(Boolean)[0], action?.metadata?.slotLevel ?? effect.slotLevel ?? 1, action, effect);
      },
      level1_heroism({ actor, targets = [], action = {}, effect = {} } = {}) {
        const spellMod = resolveCureWoundsSpellMod(actor, action, effect);
        const applied = (targets || []).filter(Boolean).map((target) => grantHeroism(target, actor, spellMod));
        return { resolved: applied.length > 0, applied };
      },
      level1_hex({ actor, targets = [], action = {}, effect = {} } = {}) {
        const plan = action?.metadata?.viewerPlan || {};
        const ability = plan.spellChoice?.value || plan.hexAbility || effect.ability;
        const target = (targets || []).filter(Boolean)[0];
        return applyHex(actor, target, ability, action?.metadata?.slotLevel ?? effect.slotLevel ?? 1);
      },
      level1_hunters_mark({ actor, targets = [], action = {}, effect = {} } = {}) {
        const target = (targets || []).filter(Boolean)[0];
        return applyHuntersMark(actor, target, action?.metadata?.slotLevel ?? effect.slotLevel ?? 1);
      },
      level1_ice_knife_explosion({ targets = [], action = {}, effect = {} } = {}) {
        return resolveIceKnifeExplosion(targets, action?.metadata?.slotLevel ?? effect.slotLevel ?? 1, action, effect);
      }
    };
  }

  function install() {
    registerStatuses();
    patchActionEconomy();
    patchCombatEngine();
    installDetectionWorkflow();
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    STATUS_DEFINITIONS,
    registerStatuses,
    getStatus,
    applyStatus,
    removeStatus,
    applyBane,
    applyBless,
    suppressReaction,
    grantArmorOfAgathys,
    clearArmorOfAgathys,
    armorOfAgathysState,
    retaliateArmorOfAgathys,
    ALARM_EFFECT_ROOT,
    alarmManagedEffect,
    persistAlarmWard,
    createAlarmWard,
    calculateCureWoundsHealing,
    applyCureWounds,
    resolveCureWoundsSpellMod,
    DETECTION_CONFIGS,
    buildDetectionRequest,
    detectionPlayerMessage,
    resolveDetectionRequest,
    installDetectionWorkflow,
    applyDisguiseSelf,
    disguiseSelfActive,
    applyDivineFavor,
    divineFavorFixedDamage,
    resolveDivineFavorHit,
    prepareDivineSmite,
    divineSmiteFixedDamage,
    divineSmiteEnchantment,
    divineSmiteEnchantmentKey,
    divineSmitePowerBonus,
    resolveDivineSmiteHit,
    prepareEnsnaringStrike,
    applySpellRestrained,
    attemptSpellRestrainedEscape,
    applyEnsnaringTurnStart,
    createEntangleArea,
    entangleAreaForUnit,
    FIND_FAMILIAR_FORMS,
    familiarForm,
    listFindFamiliarOptions,
    resolveFindFamiliarChoice,
    summonFindFamiliar,
    dismissFindFamiliar,
    restoreFindFamiliar,
    cleanupDefeatedFamiliars,
    deliverTouchSpellThroughFamiliar,
    activeFogCloudAreas,
    createFogCloudArea,
    fogCloudAreasForUnit,
    setFogCloudMembership,
    disperseFogCloud,
    suppressFogCloud,
    hasFogBypass,
    fogCloudPowerModifier,
    fogCloudAnalyseThresholdModifier,
    fogCloudSightPerceptionModifier,
    activeGreaseAreas,
    createGreaseArea,
    setGreaseMembership,
    greaseSpeedModifier,
    resolveGreaseSave,
    goodMagicFoodSpec,
    createGoodMagicFood,
    expireGoodMagicFoodItem,
    expireGoodMagicFood,
    resolveGoodMagicCookingEnhancement,
    calculateHealingWordHealing,
    applyHealingWord,
    applyGuidedLight,
    guidedLightPowerBonus,
    consumeGuidedLight,
    resolveGuidingBoltHit,
    heroismDesiredShield,
    grantHeroism,
    heroismHasShield,
    clearHeroism,
    consumeHeroismShield,
    refreshHeroismAtTurnStart,
    applyHex,
    transferHex,
    hexCheckThresholdModifier,
    resolveHexHit,
    applyHuntersMark,
    transferHuntersMark,
    markedQuarryAnalyseThresholdModifier,
    markedQuarryTrackingThresholdModifier,
    resolveHuntersMarkHit,
    resolveHailOfThorns,
    resolveHellishRebuke,
    resolveIceKnifeExplosion,
    tickSpellDurations,
    chromaticJumpLimit,
    nextChromaticOrbTarget,
    resolveChromaticOrbCrit,
    cleanupConcentrationStatuses,
    effectHandlers,
    patchActionEconomy,
    patchCombatEngine,
    install
  });

  global.LuminousLevel1SpellBatchRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  install();
})(typeof window !== "undefined" ? window : globalThis);
