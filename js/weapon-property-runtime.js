(function (global) {
  "use strict";

  if (global.LuminousWeaponPropertyRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousWeaponPropertyRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const upgradeCatalog = global.LuminousWeaponUpgradeCatalog || safeRequire("./item-catalog-weapon-upgrades.js");
  const unitRankRuntime = global.LuminousUnitRankRuntime || safeRequire("./unit-rank-runtime.js");

  const VERSION = 1;
  const PROPERTY_IDS = Object.freeze([
    "light",
    "finesse",
    "heavy",
    "two_handed",
    "versatile",
    "reach",
    "thrown",
    "ammunition",
    "loading",
  ]);

  const PROPERTY_RULES = Object.freeze({
    light: Object.freeze({
      id: "light",
      name: "Light",
      description: "While wielding a Light Weapon in each hand, every 2nd Coin deals +5% Damage.",
    }),
    finesse: Object.freeze({
      id: "finesse",
      name: "Finesse",
      description: "Attack Skills with 1 Coin that use STR can use DEX instead.",
    }),
    heavy: Object.freeze({
      id: "heavy",
      name: "Heavy",
      description: "Gain +1 Clash Power against Weaker Units. Tiny and Small creatures suffer -2 Power unless a Trait or Feature ignores Heavy.",
    }),
    two_handed: Object.freeze({
      id: "two_handed",
      name: "Two-Handed",
      description: "This Weapon requires two hands to use. While using it, you cannot use a Shield or another Weapon.",
    }),
    versatile: Object.freeze({
      id: "versatile",
      name: "Versatile",
      description: "This Weapon can be used with one or two hands. When used with two hands, gain +1 Final Power.",
    }),
    reach: Object.freeze({
      id: "reach",
      name: "Reach",
      description: "Melee Attack Skills used with this Weapon gain +1 Clash Power against Slower Units.",
    }),
    thrown: Object.freeze({
      id: "thrown",
      name: "Thrown",
      description: "This Weapon can be used as a Ranged Attack. After being thrown, it must be recovered before it can be used again.",
    }),
    ammunition: Object.freeze({
      id: "ammunition",
      name: "Ammunition",
      description: "Attack Skills used with this Weapon require compatible Ammunition from the user's Active Inventory.",
    }),
    loading: Object.freeze({
      id: "loading",
      name: "Loading",
      description: "This Weapon must be reloaded after being used and cannot benefit from Additional Attack unless a Trait or Feature ignores Loading.",
    }),
  });

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function normalizeProperties(values = []) {
    const source = Array.isArray(values) ? values : [values];
    return [...new Set(source.map(normalizeId).filter((id) => PROPERTY_IDS.includes(id)))];
  }

  function handModeProperties(handMode) {
    const mode = normalizeId(handMode);
    if (mode === "two_handed") return ["two_handed"];
    if (mode === "versatile") return ["versatile"];
    return [];
  }

  function upgradeProperties(weapon = {}) {
    const out = [];
    const componentRows = [
      ...(Array.isArray(weapon.components) ? weapon.components : []),
      ...(Array.isArray(weapon.installedComponents) ? weapon.installedComponents : []),
    ];
    componentRows.forEach((component) => {
      const ids = component?.upgradeIds || component?.upgrades || [];
      (Array.isArray(ids) ? ids : []).forEach((entry) => {
        const id = normalizeId(typeof entry === "string" ? entry : entry?.id);
        const def = upgradeCatalog?.get?.(id) || (typeof entry === "object" ? entry : null);
        if (def?.addProperties) out.push(...def.addProperties);
      });
    });
    return normalizeProperties(out);
  }

  function resolveWeaponProperties(weapon = {}) {
    return normalizeProperties([
      ...(Array.isArray(weapon.properties) ? weapon.properties : []),
      ...handModeProperties(weapon.handMode || weapon.hand_mode),
      ...upgradeProperties(weapon),
    ]);
  }

  function hasProperty(weapon, propertyId) {
    return resolveWeaponProperties(weapon).includes(normalizeId(propertyId));
  }

  function statId(value) {
    const id = normalizeId(value);
    if (["str", "strength", "fuerza"].includes(id)) return "str";
    if (["dex", "dexterity", "destreza"].includes(id)) return "dex";
    return id;
  }

  function applyFinesse(skillInput = {}, weapon = {}) {
    const skill = clone(skillInput) || {};
    const coins = Math.max(1, Math.trunc(finite(skill.coinAmount ?? skill.coin_count ?? skill.coinCount, Array.isArray(skill.coins) ? skill.coins.length : 1)));
    const scaling = statId(skill.scalingStat || skill.scaling_stat || skill.statUsed || skill.stat_used);
    if (!hasProperty(weapon, "finesse") || coins !== 1 || scaling !== "str") return skill;
    if (Object.prototype.hasOwnProperty.call(skill, "scaling_stat")) skill.scaling_stat = "Destreza";
    if (Object.prototype.hasOwnProperty.call(skill, "statUsed")) skill.statUsed = "Destreza";
    if (Object.prototype.hasOwnProperty.call(skill, "stat_used")) skill.stat_used = "Destreza";
    skill.scalingStat = "Destreza";
    skill.weaponPropertyScalingOverride = "dex";
    return skill;
  }

  function unitSize(unit = {}) {
    return normalizeId(unit.size || unit.sizeId || unit.size_id || unit.mechanics?.size || unit.metadata?.size || "medium");
  }

  function baseLevel(unit = {}) {
    return Math.max(0, Math.trunc(finite(
      unit.level ?? unit.Level ?? unit.classLevel ?? unit.class_level ?? unit.combatStats?.level ?? unit.mechanics?.level,
      0
    )));
  }

  function effectiveLevel(unit = {}) {
    const level = baseLevel(unit);
    if (unitRankRuntime?.effectiveLevel && level > 0) {
      const rank = unitRankRuntime.rankForUnit?.(unit) || unit.rank || "normal";
      return finite(unitRankRuntime.effectiveLevel(level, rank), level);
    }
    return level;
  }

  function speed(unit = {}) {
    return finite(
      unit.resolvedSpeed ?? unit.currentSpeed ?? unit.speedRoll ?? unit.speedValue ?? unit.speed ?? unit.combatStats?.speed,
      0
    );
  }

  function isWeakerUnit(user = {}, target = {}) {
    return effectiveLevel(target) < effectiveLevel(user);
  }

  function isSlowerUnit(user = {}, target = {}) {
    return speed(target) < speed(user);
  }

  function resolvePowerModifiers(options = {}) {
    const weapon = options.weapon || {};
    const wielder = options.wielder || options.user || {};
    const target = options.target || {};
    const properties = new Set(resolveWeaponProperties(weapon));
    let clashPower = 0;
    let finalPower = 0;
    let power = 0;

    if (properties.has("heavy")) {
      if (isWeakerUnit(wielder, target)) clashPower += 1;
      if (!options.ignoreHeavyPenalty && ["tiny", "small"].includes(unitSize(wielder))) power -= 2;
    }
    if (properties.has("reach") && options.melee !== false && isSlowerUnit(wielder, target)) clashPower += 1;
    const handsUsed = Math.max(0, Math.trunc(finite(options.handsUsed, properties.has("two_handed") ? 2 : 1)));
    if (properties.has("versatile") && handsUsed >= 2) finalPower += 1;

    return Object.freeze({ clashPower, finalPower, power });
  }

  function lightCoinDamagePercent(options = {}) {
    const coinIndex = Math.max(1, Math.trunc(finite(options.coinIndex, 1)));
    if (coinIndex % 2 !== 0) return 0;
    const main = options.mainHand || options.weapon || null;
    const off = options.offHand || null;
    return main && off && hasProperty(main, "light") && hasProperty(off, "light") ? 5 : 0;
  }

  function requiresAmmunition(weapon = {}) {
    return hasProperty(weapon, "ammunition");
  }

  function isThrown(weapon = {}) {
    return hasProperty(weapon, "thrown");
  }

  function hasLoadingCycle(weapon = {}) {
    return hasProperty(weapon, "loading");
  }

  function canBenefitFromAdditionalAttack(weapon = {}, options = {}) {
    return options.ignoreLoading === true || !hasLoadingCycle(weapon);
  }

  function equipmentCompatibility(weapon = {}, equipment = {}) {
    const properties = new Set(resolveWeaponProperties(weapon));
    const shield = equipment.shield || null;
    const otherWeapon = equipment.otherWeapon || equipment.offHand || null;
    if (properties.has("two_handed") && (shield || otherWeapon)) {
      return Object.freeze({ valid: false, reason: shield ? "two_handed_blocks_shield" : "two_handed_blocks_other_weapon" });
    }
    return Object.freeze({ valid: true, reason: null });
  }

  const API = Object.freeze({
    VERSION,
    PROPERTY_IDS,
    PROPERTY_RULES,
    normalizeId,
    normalizeProperties,
    handModeProperties,
    upgradeProperties,
    resolveWeaponProperties,
    hasProperty,
    applyFinesse,
    unitSize,
    effectiveLevel,
    speed,
    isWeakerUnit,
    isSlowerUnit,
    resolvePowerModifiers,
    lightCoinDamagePercent,
    requiresAmmunition,
    isThrown,
    hasLoadingCycle,
    canBenefitFromAdditionalAttack,
    equipmentCompatibility,
  });

  global.LuminousWeaponPropertyRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
