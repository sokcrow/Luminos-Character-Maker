(function (global) {
  "use strict";

  const STATUS_ORDER = Object.freeze(["burn", "rupture", "sinking", "tremor", "poise", "bleed"]);
  const DAMAGE_ORDER = Object.freeze(["slash", "pierce", "blunt"]);
  const DAMAGE_CONFIG = Object.freeze({
    slash: Object.freeze({ damageType: "cortante", label: "Slash" }),
    pierce: Object.freeze({ damageType: "perforante", label: "Pierce" }),
    blunt: Object.freeze({ damageType: "contundente", label: "Blunt" }),
  });
  const DAMAGE_ID_BY_TYPE = Object.freeze({ cortante: "slash", perforante: "pierce", contundente: "blunt" });

  const STATUS_CONFIG = Object.freeze({
    burn: Object.freeze({ target: "target", sins: Object.freeze(["wrath", "lust", "pride"]), names: Object.freeze(["Ember Cut", "Cinder Point", "Ash Knuckle", "Kindling Edge", "Searing Step", "Coal Press", "Brand Needle", "Smolder Chain", "Spark Rend", "Flame Trace", "Scorch Line", "Ignition Pattern"]) }),
    rupture: Object.freeze({ target: "target", sins: Object.freeze(["gluttony", "envy", "pride"]), names: Object.freeze(["Faultline Cut", "Fracture Point", "Split Guard", "Hairline Break", "Breach Step", "Crack Press", "Open Seam", "Shear Chain", "Stress Mark", "Break Line", "Fracture Rhythm", "Deep Fissure"]) }),
    sinking: Object.freeze({ target: "target", sins: Object.freeze(["gloom", "sloth", "envy"]), names: Object.freeze(["Gloom Cut", "Undertow Point", "Hollow Weight", "Drowning Touch", "Low Tide Step", "Depth Press", "Quiet Descent", "Heavy Current", "Blackwater Line", "Sunken Rhythm", "Abyssal Trace", "Deep Silence"]) }),
    tremor: Object.freeze({ target: "target", sins: Object.freeze(["sloth", "pride", "gluttony"]), names: Object.freeze(["Rattle Cut", "Pulse Point", "Hammer Echo", "Fault Beat", "Shaking Step", "Resonant Press", "Quake Needle", "Rumble Chain", "Vibrating Line", "Aftershock Rhythm", "Ground Trace", "Seismic Pattern"]) }),
    poise: Object.freeze({ target: "self", sins: Object.freeze(["pride", "lust", "gluttony"]), names: Object.freeze(["Centered Cut", "Measured Point", "Quiet Strike", "Calm Breath", "Balanced Step", "Steady Press", "Focused Needle", "Patient Chain", "True Line", "Measured Rhythm", "Composed Trace", "Perfect Form"]) }),
    bleed: Object.freeze({ target: "target", sins: Object.freeze(["lust", "wrath", "envy"]), names: Object.freeze(["Red Cut", "Needle Point", "Open Vein", "Crimson Mark", "Drawing Step", "Scarlet Press", "Fine Nick", "Red Thread", "Cutting Line", "Blood Rhythm", "Crimson Trace", "Deep Laceration"]) }),
  });

  const PROFILES = Object.freeze([
    Object.freeze({ slug: "steady", coins: 1, basePower: 7, coinPower: 6, apps: Object.freeze([[0, 1, 1]]), damageType: "cortante", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "lasting", coins: 1, basePower: 6, coinPower: 6, apps: Object.freeze([[0, 1, 2]]), damageType: "perforante", scalingStat: "Destreza", skillRange: 1 }),
    Object.freeze({ slug: "intense", coins: 1, basePower: 6, coinPower: 6, apps: Object.freeze([[0, 2, 1]]), damageType: "contundente", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "loaded", coins: 1, basePower: 4, coinPower: 6, apps: Object.freeze([[0, 2, 2]]), damageType: "cortante", scalingStat: "Destreza", skillRange: 1 }),
    Object.freeze({ slug: "double_step", coins: 2, basePower: 5, coinPower: 4, apps: Object.freeze([[1, 1, 1]]), damageType: "perforante", scalingStat: "Destreza", skillRange: 1 }),
    Object.freeze({ slug: "double_lasting", coins: 2, basePower: 4, coinPower: 4, apps: Object.freeze([[1, 1, 2]]), damageType: "contundente", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "double_intense", coins: 2, basePower: 4, coinPower: 4, apps: Object.freeze([[1, 2, 1]]), damageType: "cortante", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "double_split", coins: 2, basePower: 2, coinPower: 4, apps: Object.freeze([[0, 1, 1], [1, 1, 1]]), damageType: "perforante", scalingStat: "Destreza", skillRange: 1 }),
    Object.freeze({ slug: "triple_step", coins: 3, basePower: 4, coinPower: 3, apps: Object.freeze([[2, 1, 1]]), damageType: "contundente", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "triple_lasting", coins: 3, basePower: 3, coinPower: 3, apps: Object.freeze([[2, 1, 2]]), damageType: "cortante", scalingStat: "Destreza", skillRange: 1 }),
    Object.freeze({ slug: "triple_intense", coins: 3, basePower: 3, coinPower: 3, apps: Object.freeze([[2, 2, 1]]), damageType: "perforante", scalingStat: "Destreza", skillRange: 1 }),
    Object.freeze({ slug: "triple_split", coins: 3, basePower: 1, coinPower: 3, apps: Object.freeze([[0, 1, 1], [2, 1, 1]]), damageType: "contundente", scalingStat: "Fuerza", skillRange: 1 }),
  ]);

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const slugify = (value) => String(value || "skill").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function statusEffect(statusId, target, potency, count, trigger) {
    return { trigger: trigger || "[On Hit]", target, type: "status", status: statusId, potency, count, maxCap: 0, scaleTarget: null, scaleCondition: null, is_reuse: false, target_ally: false, timing: "immediate", condition: null };
  }

  function buildSkill(statusId, profileIndex, damageId) {
    const config = STATUS_CONFIG[statusId], profile = PROFILES[profileIndex], damage = DAMAGE_CONFIG[damageId], ordinal = String(profileIndex + 1).padStart(2, "0"), baseName = config.names[profileIndex], legacyDamageId = DAMAGE_ID_BY_TYPE[profile.damageType], isLegacyVariant = damageId === legacyDamageId;
    const name = isLegacyVariant ? baseName : `${baseName} · ${damage.label}`, legacyId = `t1_${statusId}_${ordinal}_${slugify(baseName)}`, id = isLegacyVariant ? legacyId : `${legacyId}_${damageId}`, sinAffinity = config.sins[profileIndex % config.sins.length];
    const coins = Array.from({ length: profile.coins }, (_, index) => ({ index, type: "normal", status: "active", effects: [] }));

    profile.apps.forEach(([coinIndex, potency, count]) => {
      coins[coinIndex].effects.push(statusEffect(statusId, config.target, potency, count, "[On Hit]"));
    });

    return {
      id, name, type: "Attack", tier: 1, basePower: profile.basePower, coinPower: profile.coinPower, coinAmount: profile.coins, coinType: "positive", attackWeight: 1, skillRange: 1, damageType: damage.damageType, sinAffinity, scalingStat: profile.scalingStat, statUsed: "", skillUsed: "", targetingType: "Focused Attack", aoePattern: "Self", skillAmount: 1, sourceType: "skill", sourceId: id, isItemSkill: false, isDefense: false, defenseSubtype: "", isClashable: true, isUnclashable: false, isIndiscriminate: false, isTargetFixed: false, requiresUnlock: false, effects: [], coins, evolutionChain: null, schemaVersion: 2,
      metadata: { starter: true, buildEntry: true, tier: 1, statusFamily: statusId, rulesPolicy: "apply_only", balanceProfile: profile.slug, combatRange: "melee", damageFamily: damageId, legacyStarterId: isLegacyVariant },
    };
  }

  const DEFINITIONS = {};
  STATUS_ORDER.forEach((statusId) => PROFILES.forEach((_, profileIndex) => DAMAGE_ORDER.forEach((damageId) => { const skill = buildSkill(statusId, profileIndex, damageId); DEFINITIONS[skill.id] = Object.freeze(skill); })));
  Object.freeze(DEFINITIONS);

  function list() { return Object.values(DEFINITIONS).map(clone); }
  function get(id) { return DEFINITIONS[String(id || "")] ? clone(DEFINITIONS[String(id || "")]) : null; }
  function byStatus(statusId) { const wanted = String(statusId || "").trim().toLowerCase(); return list().filter((skill) => skill.metadata?.statusFamily === wanted); }
  function byDamage(damageId) { const wanted = String(damageId || "").trim().toLowerCase(); return list().filter((skill) => skill.metadata?.damageFamily === wanted); }
  function firebasePayload(schema = global.CombatSkillSchema) {
    const payload = {};
    list().forEach((skill) => {
      if (schema?.validateCombatSkill && schema?.serializeCombatSkill) {
        const validation = schema.validateCombatSkill(skill);
        if (!validation.valid) throw new Error(`${skill.id}: ${validation.errors.join(" · ")}`);
        payload[skill.id] = schema.serializeCombatSkill({ ...validation.skill, id: skill.id }, { includeLegacyAliases: true });
      } else payload[skill.id] = skill;
    });
    return payload;
  }

  const api = Object.freeze({ version: "1.3.1", STATUS_ORDER, DAMAGE_ORDER, DAMAGE_CONFIG, STATUS_CONFIG, PROFILES, DEFINITIONS, list, get, byStatus, byDamage, firebasePayload });
  global.LuminousStarterStatusSkillCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);