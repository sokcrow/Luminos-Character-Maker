(function (global) {
  "use strict";

  const STATUS_ORDER = Object.freeze(["burn", "rupture", "sinking", "tremor", "poise", "bleed"]);
  const STATUS_CONFIG = Object.freeze({
    burn: Object.freeze({ target: "target", names: Object.freeze([
      "Ember Cut", "Cinder Point", "Ash Knuckle", "Kindling Edge",
      "Searing Step", "Coal Press", "Brand Needle", "Smolder Chain",
      "Spark Rend", "Flame Trace", "Scorch Line", "Ignition Pattern",
    ]) }),
    rupture: Object.freeze({ target: "target", names: Object.freeze([
      "Faultline Cut", "Fracture Point", "Split Guard", "Hairline Break",
      "Breach Step", "Crack Press", "Open Seam", "Shear Chain",
      "Stress Mark", "Break Line", "Fracture Rhythm", "Deep Fissure",
    ]) }),
    sinking: Object.freeze({ target: "target", names: Object.freeze([
      "Gloom Cut", "Undertow Point", "Hollow Weight", "Drowning Touch",
      "Low Tide Step", "Depth Press", "Quiet Descent", "Heavy Current",
      "Blackwater Line", "Sunken Rhythm", "Abyssal Trace", "Deep Silence",
    ]) }),
    tremor: Object.freeze({ target: "target", names: Object.freeze([
      "Rattle Cut", "Pulse Point", "Hammer Echo", "Fault Beat",
      "Shaking Step", "Resonant Press", "Quake Needle", "Rumble Chain",
      "Vibrating Line", "Aftershock Rhythm", "Ground Trace", "Seismic Pattern",
    ]) }),
    poise: Object.freeze({ target: "self", names: Object.freeze([
      "Centered Cut", "Measured Point", "Quiet Strike", "Calm Breath",
      "Balanced Step", "Steady Press", "Focused Needle", "Patient Chain",
      "True Line", "Measured Rhythm", "Composed Trace", "Perfect Form",
    ]) }),
    bleed: Object.freeze({ target: "target", names: Object.freeze([
      "Red Cut", "Needle Point", "Open Vein", "Crimson Mark",
      "Drawing Step", "Scarlet Press", "Fine Nick", "Red Thread",
      "Cutting Line", "Blood Rhythm", "Crimson Trace", "Deep Laceration",
    ]) }),
  });

  // Tier 1 budget: 1 Coin = 4/+4, 2 Coins = 3/+3, 3 Coins = 2/+2.
  // Stronger status packages trade 1-2 Base Power instead of adding extra mechanics.
  const PROFILES = Object.freeze([
    Object.freeze({ slug: "steady", coins: 1, basePower: 4, coinPower: 4, apps: Object.freeze([[0, 1, 1]]), damageType: "cortante", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "lasting", coins: 1, basePower: 3, coinPower: 4, apps: Object.freeze([[0, 1, 2]]), damageType: "perforante", scalingStat: "Destreza", skillRange: 2 }),
    Object.freeze({ slug: "intense", coins: 1, basePower: 3, coinPower: 4, apps: Object.freeze([[0, 2, 1]]), damageType: "contundente", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "loaded", coins: 1, basePower: 2, coinPower: 4, apps: Object.freeze([[0, 2, 2]]), damageType: "cortante", scalingStat: "Destreza", skillRange: 1 }),

    Object.freeze({ slug: "double_step", coins: 2, basePower: 3, coinPower: 3, apps: Object.freeze([[1, 1, 1]]), damageType: "perforante", scalingStat: "Destreza", skillRange: 2 }),
    Object.freeze({ slug: "double_lasting", coins: 2, basePower: 2, coinPower: 3, apps: Object.freeze([[1, 1, 2]]), damageType: "contundente", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "double_intense", coins: 2, basePower: 2, coinPower: 3, apps: Object.freeze([[1, 2, 1]]), damageType: "cortante", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "double_split", coins: 2, basePower: 1, coinPower: 3, apps: Object.freeze([[0, 1, 1], [1, 1, 1]]), damageType: "perforante", scalingStat: "Destreza", skillRange: 2 }),

    Object.freeze({ slug: "triple_step", coins: 3, basePower: 2, coinPower: 2, apps: Object.freeze([[2, 1, 1]]), damageType: "contundente", scalingStat: "Fuerza", skillRange: 1 }),
    Object.freeze({ slug: "triple_lasting", coins: 3, basePower: 1, coinPower: 2, apps: Object.freeze([[2, 1, 2]]), damageType: "cortante", scalingStat: "Destreza", skillRange: 1 }),
    Object.freeze({ slug: "triple_intense", coins: 3, basePower: 1, coinPower: 2, apps: Object.freeze([[2, 2, 1]]), damageType: "perforante", scalingStat: "Destreza", skillRange: 2 }),
    Object.freeze({ slug: "triple_split", coins: 3, basePower: 1, coinPower: 2, apps: Object.freeze([[0, 1, 1], [2, 1, 1]]), damageType: "contundente", scalingStat: "Fuerza", skillRange: 1 }),
  ]);

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const slugify = (value) => String(value || "skill")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function statusEffect(statusId, target, potency, count, trigger) {
    return {
      trigger: trigger || "[On Hit]",
      target,
      type: "status",
      status: statusId,
      potency,
      count,
      maxCap: 0,
      scaleTarget: null,
      scaleCondition: null,
      is_reuse: false,
      target_ally: false,
      timing: "immediate",
      condition: null,
    };
  }

  function buildSkill(statusId, profileIndex) {
    const config = STATUS_CONFIG[statusId];
    const profile = PROFILES[profileIndex];
    const ordinal = String(profileIndex + 1).padStart(2, "0");
    const name = config.names[profileIndex];
    const id = `t1_${statusId}_${ordinal}_${slugify(name)}`;
    const coins = Array.from({ length: profile.coins }, (_, index) => ({
      index,
      type: "normal",
      status: "active",
      effects: [],
    }));
    const globalEffects = [];

    if (statusId === "poise") {
      const totals = profile.apps.reduce((sum, app) => ({ potency: sum.potency + app[1], count: sum.count + app[2] }), { potency: 0, count: 0 });
      globalEffects.push(statusEffect(statusId, "self", totals.potency, totals.count, "[On Use]"));
    } else {
      profile.apps.forEach(([coinIndex, potency, count]) => {
        coins[coinIndex].effects.push(statusEffect(statusId, "target", potency, count, "[On Hit]"));
      });
    }

    return {
      id,
      name,
      type: "Attack",
      tier: 1,
      basePower: profile.basePower,
      coinPower: profile.coinPower,
      coinAmount: profile.coins,
      coinType: "positive",
      attackWeight: 1,
      skillRange: profile.skillRange,
      damageType: profile.damageType,
      sinAffinity: "sinless",
      scalingStat: profile.scalingStat,
      statUsed: "",
      skillUsed: "",
      targetingType: "Focused Attack",
      aoePattern: "Self",
      skillAmount: 1,
      sourceType: "skill",
      sourceId: id,
      isItemSkill: false,
      isDefense: false,
      defenseSubtype: "",
      isClashable: true,
      isUnclashable: false,
      isIndiscriminate: false,
      isTargetFixed: false,
      requiresUnlock: false,
      effects: globalEffects,
      coins,
      evolutionChain: null,
      schemaVersion: 2,
      metadata: {
        starter: true,
        buildEntry: true,
        tier: 1,
        statusFamily: statusId,
        rulesPolicy: "apply_only",
        balanceProfile: profile.slug,
      },
    };
  }

  const DEFINITIONS = {};
  STATUS_ORDER.forEach((statusId) => {
    PROFILES.forEach((_, profileIndex) => {
      const skill = buildSkill(statusId, profileIndex);
      DEFINITIONS[skill.id] = Object.freeze(skill);
    });
  });
  Object.freeze(DEFINITIONS);

  function list() { return Object.values(DEFINITIONS).map(clone); }
  function get(id) { return DEFINITIONS[String(id || "")] ? clone(DEFINITIONS[String(id || "")]) : null; }
  function byStatus(statusId) {
    const wanted = String(statusId || "").trim().toLowerCase();
    return list().filter((skill) => skill.metadata?.statusFamily === wanted);
  }
  function firebasePayload(schema = global.CombatSkillSchema) {
    const payload = {};
    list().forEach((skill) => {
      if (schema?.validateCombatSkill && schema?.serializeCombatSkill) {
        const validation = schema.validateCombatSkill(skill);
        if (!validation.valid) throw new Error(`${skill.id}: ${validation.errors.join(" · ")}`);
        payload[skill.id] = schema.serializeCombatSkill({ ...validation.skill, id: skill.id }, { includeLegacyAliases: true });
      } else {
        payload[skill.id] = skill;
      }
    });
    return payload;
  }

  const api = Object.freeze({
    version: "1.0.0",
    STATUS_ORDER,
    STATUS_CONFIG,
    PROFILES,
    DEFINITIONS,
    list,
    get,
    byStatus,
    firebasePayload,
  });

  global.LuminousStarterStatusSkillCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
