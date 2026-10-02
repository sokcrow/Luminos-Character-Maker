(function (global) {
  "use strict";

  if (global.LuminousLevel1SpellBatchRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLevel1SpellBatchRuntime;
    return;
  }

  const VERSION = "0.2.0";
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
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
    if (engine?.applyStatus) return engine.applyStatus(unit, id, input);
    if (!unit || typeof unit !== "object") return null;
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

  function grantArmorOfAgathys(unit, slotLevel = 1) {
    const level = Math.max(1, Math.trunc(numberOr(slotLevel, 1)));
    const amount = 5 * level;
    const shields = shieldRuntime();
    const gained = shields?.gainShield
      ? shields.gainShield(unit, amount, shields.SHIELD_TYPES?.ENCOUNTER || "encounter")
      : (() => { unit.shield = Math.max(0, numberOr(unit.shield, 0)) + amount; return amount; })();

    unit.__luminousArmorOfAgathys = {
      active: true,
      slotLevel: level,
      retaliationDamage: 5 * level,
      grantedShield: gained,
      sourceSpellId: "armor_of_agathys"
    };
    applyStatus(unit, "armor_of_agathys", { mode: "set", count: 1, data: { slotLevel: level } });
    return { resolved: gained > 0, shieldGranted: gained, retaliationDamage: 5 * level, slotLevel: level };
  }

  function clearArmorOfAgathys(unit) {
    if (unit && typeof unit === "object") delete unit.__luminousArmorOfAgathys;
    removeStatus(unit, "armor_of_agathys");
    return true;
  }

  function armorOfAgathysState(unit) {
    const state = unit?.__luminousArmorOfAgathys;
    if (!state?.active) return null;
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

  function retaliateArmorOfAgathys(engine, attacker, defender, attackSkill, result) {
    const state = armorOfAgathysState(defender);
    if (!state || !attacker || numberOr(result?.damageTaken, 0) <= 0 || !isMeleeSkill(attackSkill)) return null;
    const damage = Math.max(0, Math.trunc(numberOr(state.retaliationDamage, 0)));
    if (damage <= 0) return null;
    const before = numberOr(attacker.hp, 0);
    const applied = typeof engine?.applyDamage === "function"
      ? engine.applyDamage(attacker, damage, "cold", false, null, { sourceSpellId: "armor_of_agathys", sourceUnitId: unitId(defender) })
      : null;
    if (numberOr(defender?.shield, 0) <= 0) clearArmorOfAgathys(defender);
    return { damage, hpBefore: before, hpAfter: numberOr(attacker.hp, before), applied };
  }

  function createAlarmWard(caster, options = {}) {
    if (!caster || typeof caster !== "object") return { resolved: false, reason: "caster_required" };
    const mode = normalizeId(options.mode || "mental");
    const ward = {
      id: String(options.id || `alarm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      sourceSpellId: "alarm",
      sourceUnitId: unitId(caster),
      mode: ["audible", "mental"].includes(mode) ? mode : "mental",
      areaId: options.areaId || options.targetId || null,
      excludedUnitIds: Array.isArray(options.excludedUnitIds) ? [...new Set(options.excludedUnitIds.map(String))] : [],
      durationHours: 8,
      createdAt: Date.now()
    };
    if (!Array.isArray(caster.__luminousAlarmWards)) caster.__luminousAlarmWards = [];
    caster.__luminousAlarmWards.push(ward);
    return { resolved: true, ward };
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

  function divineSmitePowerBonus(actor, target, skill = {}) {
    return actor?.__luminousDivineSmite?.active && target && statusActive(target, "radiance") && isMeleeOrUnarmedAttackSkill(skill) ? 1 : 0;
  }

  function resolveDivineSmiteHit(attacker, target, skill = {}, context = {}) {
    const pending = attacker?.__luminousDivineSmite;
    if (!pending?.active || !target || !isMeleeOrUnarmedAttackSkill(skill)) return null;
    delete attacker.__luminousDivineSmite;
    const fixed = divineSmiteFixedDamage(pending.slotLevel, target);
    const damage = applyFixedDamage(target, fixed.total, { engine: context.engine || global.CombatEngine, damageKind: "directo", skillUsed: null });
    const radiance = applyStatus(target, "radiance", { mode: "gain", count: 2 });
    return { resolved: true, ...fixed, damage, radiance };
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
      for (const statusId of ["bane", "bless"]) {
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

    if (originalCalculateFinalPower) {
      engine.calculateFinalPower = function (skill, headsFlipped, unit = null) {
        const value = originalCalculateFinalPower.call(this, skill, headsFlipped, unit);
        const target = activePowerTargets.get(unitId(unit));
        return value + divineSmitePowerBonus(unit, target, skill);
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
        try { return originalResolveStandardClash.call(this, unitA, skillA, unitB, skillB, ...rest); }
        finally {
          activePowerTargets.delete(unitId(unitA));
          activePowerTargets.delete(unitId(unitB));
        }
      };
    }

    if (originalUnilateral) {
      engine.resolveUnilateralWithCounter = function (unitAttacker, attackSkill, unitDefender, counterSkill, options = {}) {
        activePowerTargets.set(unitId(unitAttacker), unitDefender);
        let result;
        try { result = originalUnilateral.call(this, unitAttacker, attackSkill, unitDefender, counterSkill, options); }
        finally { activePowerTargets.delete(unitId(unitAttacker)); }
        const retaliation = retaliateArmorOfAgathys(this, unitAttacker, unitDefender, attackSkill, result);
        if (retaliation && result && typeof result === "object") result.armorOfAgathysRetaliation = retaliation;
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
        }
        if (key === "on_crit") resolveChromaticOrbCrit({ ...(context || {}), engine: this });
        return result;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function (phaseTag, allUnits = [], ...rest) {
        const phase = normalizeId(phaseTag).replace(/^_+|_+$/g, "");
        if (phase === "turn_start") applyEnsnaringTurnStart(allUnits || []);
        const result = originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
        if (phase === "round_end") tickSpellDurations(allUnits || []);
        if (["turn_end", "round_end"].includes(phase)) cleanupConcentrationStatuses(allUnits || []);
        return result;
      };
    }

    Object.defineProperty(engine, "__level1SpellBatchRuntime", { value: true, configurable: true });
    return true;
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
    divineSmitePowerBonus,
    resolveDivineSmiteHit,
    prepareEnsnaringStrike,
    applySpellRestrained,
    attemptSpellRestrainedEscape,
    applyEnsnaringTurnStart,
    createEntangleArea,
    entangleAreaForUnit,
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
