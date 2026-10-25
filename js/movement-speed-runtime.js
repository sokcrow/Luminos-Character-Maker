(function (global) {
  "use strict";

  if (global.LuminousMovementSpeedRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousMovementSpeedRuntime;
    return;
  }

  const BASELINE = Object.freeze({
    movementFeet: 30,
    minSpeed: 1,
    maxSpeed: 6,
    maxSpeedFloor: 2,
    size: "medium",
  });

  const SIZE_MAX_SPEED_MODIFIERS = Object.freeze({
    tiny: 1,
    small: 1,
    medium: 0,
    large: -1,
    huge: -2,
    gargantuan: -3,
  });

  const MODES = Object.freeze(["ground", "climb", "swim", "fly", "burrow"]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clean = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");

  function normalizeSize(value) {
    const id = clean(value || BASELINE.size);
    if (id === "minuscule" || id === "diminuto" || id === "diminuta") return "tiny";
    if (id === "pequeno" || id === "pequena" || id === "pequeño" || id === "pequeña") return "small";
    if (id === "mediano" || id === "mediana") return "medium";
    if (id === "grande") return "large";
    if (id === "enorme") return "huge";
    if (id === "gargantuesco" || id === "gargantuesca") return "gargantuan";
    return Object.prototype.hasOwnProperty.call(SIZE_MAX_SPEED_MODIFIERS, id) ? id : BASELINE.size;
  }

  function sizeMaxSpeedModifier(size) {
    return SIZE_MAX_SPEED_MODIFIERS[normalizeSize(size)] ?? 0;
  }

  function normalizeFeet(value) {
    const feet = Number(value);
    if (!Number.isFinite(feet) || feet <= 0) return 0;
    return Math.max(0, feet);
  }

  function dexteritySpeedAdjustment(modifier = 0) {
    return Math.max(-2, Math.min(2, Math.trunc(numberOr(modifier, 0) / 2))) || 0;
  }

  function statNumber(value) {
    if (value == null || value === "" || typeof value === "boolean") return null;
    const number = Number(value?.score ?? value?.value ?? value);
    return Number.isFinite(number) ? number : null;
  }

  function dexterityModifierForEntity(entity = {}, options = {}) {
    const explicit = statNumber(options.dexterityModifier);
    if (explicit != null) return explicit;
    let score = statNumber(options.dexterityScore);
    const base = entity.characterBuild?.baseStats || entity.baseStats;
    if (score == null && base) {
      const persistent = global.LuminousDerivedStats?.persistentEffectiveStats?.(entity);
      score = statNumber(persistent?.stats?.destreza ?? base.destreza ?? base.dex ?? base.dexterity);
      if (!persistent && score != null) {
        const breakdown = entity.characterBuild?.breakdown || {};
        const bonuses = [breakdown.racialStatBonuses ?? entity.racialStatBonuses,
          breakdown.backgroundStatBonuses ?? entity.backgroundStatBonuses,
          breakdown.traitStatBonuses ?? breakdown.traitsStatBonuses ?? entity.traitStatBonuses ?? entity.traitsStatBonuses];
        for (const bonus of bonuses) score += numberOr(bonus?.destreza ?? bonus?.dex, 0);
      }
    }
    // NPC catalogs store canonical scores; Player sheets use Spanish stats.
    const player = entity.isPlayer === true || entity.category === "player" || entity.actorCategory === "player" || Boolean(entity.characterBuild);
    const pools = player
      ? [entity.stats, entity.dndStats, entity.scores, entity.abilityScores, entity.abilities]
      : [entity.scores, entity.stats, entity.dndStats, entity.abilityScores, entity.abilities];
    if (score == null) {
      for (const pool of pools) {
        score = statNumber(pool?.destreza ?? pool?.dex ?? pool?.dexterity);
        if (score != null) break;
      }
    }
    return Math.floor(((score ?? 10) - 10) / 2);
  }

  function rangeFromFeet(feetInput, sizeInput = BASELINE.size, dexterityModifier = 0) {
    const feet = normalizeFeet(feetInput);
    if (!feet) return null;

    let min = BASELINE.minSpeed;
    let max = BASELINE.maxSpeed;

    if (feet > BASELINE.movementFeet) {
      max += Math.floor((feet - BASELINE.movementFeet) / 5);
    } else if (feet < BASELINE.movementFeet) {
      min -= 1;
      max -= Math.ceil((BASELINE.movementFeet - feet) / 5);
    }

    min = Math.max(BASELINE.minSpeed, Math.trunc(min));
    max = Math.max(BASELINE.maxSpeedFloor, Math.trunc(max));

    const dexterityAdjustment = dexteritySpeedAdjustment(dexterityModifier);
    min = Math.max(BASELINE.minSpeed, min + dexterityAdjustment);
    max = Math.max(BASELINE.maxSpeedFloor, min, max + dexterityAdjustment + sizeMaxSpeedModifier(sizeInput));

    return Object.freeze({
      min,
      max,
      movementFeet: feet,
      size: normalizeSize(sizeInput),
      movementDelta: feet === BASELINE.movementFeet ? 0 : feet > BASELINE.movementFeet
        ? Math.floor((feet - BASELINE.movementFeet) / 5)
        : -Math.ceil((BASELINE.movementFeet - feet) / 5),
      sizeMaxSpeedModifier: sizeMaxSpeedModifier(sizeInput),
      dexterityModifier,
      dexterityAdjustment,
      baseline: BASELINE,
    });
  }

  function movementMap(entity = {}) {
    const direct = entity.movementFeet || entity.movement || entity.movementSpeeds || null;
    const mechanics = entity.mechanics?.movementFeet || entity.mechanics?.movement || null;
    const source = direct && typeof direct === "object" ? direct : mechanics && typeof mechanics === "object" ? mechanics : {};
    return Object.fromEntries(MODES.map((mode) => [mode, normalizeFeet(source?.[mode] ?? source?.[mode === "ground" ? "walk" : mode])]));
  }

  function hasTag(entity = {}, tag) {
    const wanted = clean(tag);
    const pools = [entity.encounterTags, entity.environmentTags, entity.tags, entity.mechanics?.encounterTags, entity.mechanics?.environmentTags];
    return pools.some((pool) => Array.isArray(pool) && pool.some((value) => clean(value) === wanted));
  }

  function statusActive(entity = {}, statusId) {
    const value = entity.statusEffects?.[statusId] ?? entity.statuses?.[statusId];
    if (value == null) return false;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "object") return Number(value.count ?? value.potency ?? 1) > 0;
    return Boolean(value);
  }

  function activeMovementMode(entity = {}, options = {}) {
    const map = movementMap(entity);
    const explicit = clean(options.movementMode ?? entity.activeMovementMode ?? entity.movementMode ?? "");
    if (MODES.includes(explicit) && map[explicit] > 0) return explicit;

    const flying = options.flying ?? entity.flying ?? statusActive(entity, "flying");
    if (flying === true && map.fly > 0) return "fly";

    const climbing = options.climbing ?? entity.climbing ?? statusActive(entity, "climbing");
    if (climbing === true && map.climb > 0) return "climb";

    const underwater = options.underwater ?? hasTag(entity, "underwater");
    if (underwater && map.swim > 0) return "swim";

    if (entity.flying === false && map.ground > 0) return "ground";
    const waterOnly = entity?.mechanics?.waterBreathing?.onlyUnderwater === true || entity?.waterBreathingOnly === true;
    if (waterOnly && !underwater && map.ground > 0) return "ground";

    const preferred = clean(options.preferredMovementMode ?? entity.preferredMovementMode ?? entity.mechanics?.preferredMovementMode ?? "");
    if (MODES.includes(preferred) && map[preferred] > 0) return preferred;

    if (map.ground > 0) return "ground";
    return MODES.find((mode) => map[mode] > 0) || "ground";
  }

  function movementFeetFor(entity = {}, options = {}) {
    const map = movementMap(entity);
    const mode = activeMovementMode(entity, options);
    return { mode, feet: map[mode] || 0, map };
  }

  function explicitMovementProfile(entity = {}) {
    const map = movementMap(entity);
    return MODES.some((mode) => map[mode] > 0);
  }

  function rangeForEntity(entity = {}, options = {}) {
    const movement = movementFeetFor(entity, options);
    if (!movement.feet) return null;
    const range = rangeFromFeet(movement.feet, options.size ?? entity.size ?? entity.creatureSize ?? entity.unitSize ?? entity.mechanics?.size,
      dexterityModifierForEntity(entity, options));
    if (!range) return null;
    return Object.freeze({
      ...range,
      mode: movement.mode,
      movementMap: Object.freeze({ ...movement.map }),
    });
  }

  function usableRange(range) {
    return Array.isArray(range) && range.length >= 2 &&
      statNumber(range[0]) != null && statNumber(range[1]) != null &&
      Number(range[0]) >= 1 && Number(range[1]) >= Math.max(2, Number(range[0]));
  }

  function combatRangeForEntity(entity = {}, options = {}) {
    let range = rangeForEntity(entity, options);
    if (!range) {
      // Explicit DM-authored ranges without a movement profile are overrides.
      // Automatically persisted ranges must be recomputed, never shifted twice.
      const player = entity.isPlayer === true || entity.category === "player" || entity.actorCategory === "player" || Boolean(entity.characterBuild);
      const authored = entity.speedRangeSource !== "movement-dex-size" &&
        (!player || entity.speedRangeSource === "authored-range") &&
        [entity.speedRange, entity.mechanics?.speedRange,
          [entity.speedMin ?? entity.minSpeed ?? entity.combatStats?.minSpeed ?? entity.combatStats?.min_speed,
            entity.speedMax ?? entity.maxSpeed ?? entity.combatStats?.maxSpeed ?? entity.combatStats?.max_speed]]
          .find(usableRange);
      if (authored) return Object.freeze({ min: Math.trunc(Number(authored[0])), max: Math.trunc(Number(authored[1])), source: "authored-range" });
      range = rangeFromFeet(BASELINE.movementFeet, options.size ?? entity.size ?? entity.creatureSize ?? entity.unitSize ?? entity.mechanics?.size,
        dexterityModifierForEntity(entity, options));
    }
    // Catalog resolvers already use these same bonuses after the base profile.
    // Rebuild from base data so rank bonuses survive an active-mode change.
    const bonuses = entity.rankBonuses || {};
    const extra = entity.mechanics?.speedBonus || {};
    const min = Math.max(1, range.min + numberOr(bonuses.minSpeedBonus, 0) + numberOr(extra.min, 0));
    const max = Math.max(2, min, range.max + numberOr(bonuses.maxSpeedBonus, 0) + numberOr(extra.max, 0));
    return Object.freeze({ ...range, min, max, source: "movement-dex-size" });
  }

  function profilesForEntity(entity = {}, options = {}) {
    const map = movementMap(entity);
    const size = options.size ?? entity.size ?? entity.creatureSize ?? entity.unitSize ?? entity.mechanics?.size;
    const dexterityModifier = dexterityModifierForEntity(entity, options);
    const profiles = {};
    MODES.forEach((mode) => {
      if (map[mode] > 0) profiles[mode] = rangeFromFeet(map[mode], size, dexterityModifier);
    });
    return Object.freeze(profiles);
  }

  function decorateEntity(entity = {}, options = {}) {
    if (!entity || typeof entity !== "object") return entity;
    const profiles = profilesForEntity(entity, options);
    const active = rangeForEntity(entity, options);
    entity.speedProfiles = Object.fromEntries(Object.entries(profiles).map(([mode, range]) => [mode, { min: range.min, max: range.max, movementFeet: range.movementFeet }]));
    if (active) {
      entity.speedRange = [active.min, active.max];
      entity.speedMin = active.min;
      entity.speedMax = active.max;
      entity.speedProfileMode = active.mode;
      entity.speedRangeSource = "movement-dex-size";
      entity.mechanics = {
        ...(entity.mechanics || {}),
        speedRange: [active.min, active.max],
        minSpeed: active.min,
        maxSpeed: active.max,
        speedProfileMode: active.mode,
        speedProfiles: entity.speedProfiles,
      };
    }
    return entity;
  }

  const api = Object.freeze({
    version: "2.0.0",
    BASELINE,
    SIZE_MAX_SPEED_MODIFIERS,
    MODES,
    normalizeSize,
    sizeMaxSpeedModifier,
    dexteritySpeedAdjustment,
    dexterityModifierForEntity,
    rangeFromFeet,
    movementMap,
    activeMovementMode,
    movementFeetFor,
    explicitMovementProfile,
    rangeForEntity,
    combatRangeForEntity,
    profilesForEntity,
    decorateEntity,
  });

  global.LuminousMovementSpeedRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);

