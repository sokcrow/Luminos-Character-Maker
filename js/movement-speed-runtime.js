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
    tiny: 2,
    small: 2,
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

  function rangeFromFeet(feetInput, sizeInput = BASELINE.size) {
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

    max += sizeMaxSpeedModifier(sizeInput);
    max = Math.max(BASELINE.maxSpeedFloor, Math.trunc(max));
    min = Math.trunc(min);
    if (min > max) min = max;

    return Object.freeze({
      min,
      max,
      movementFeet: feet,
      size: normalizeSize(sizeInput),
      movementDelta: feet === BASELINE.movementFeet ? 0 : feet > BASELINE.movementFeet
        ? Math.floor((feet - BASELINE.movementFeet) / 5)
        : -Math.ceil((BASELINE.movementFeet - feet) / 5),
      sizeMaxSpeedModifier: sizeMaxSpeedModifier(sizeInput),
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
    const range = rangeFromFeet(movement.feet, options.size ?? entity.size ?? entity.creatureSize ?? entity.mechanics?.size);
    if (!range) return null;
    return Object.freeze({
      ...range,
      mode: movement.mode,
      movementMap: Object.freeze({ ...movement.map }),
    });
  }

  function profilesForEntity(entity = {}, options = {}) {
    const map = movementMap(entity);
    const size = options.size ?? entity.size ?? entity.creatureSize ?? entity.mechanics?.size;
    const profiles = {};
    MODES.forEach((mode) => {
      if (map[mode] > 0) profiles[mode] = rangeFromFeet(map[mode], size);
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
    version: "1.0.0",
    BASELINE,
    SIZE_MAX_SPEED_MODIFIERS,
    MODES,
    normalizeSize,
    sizeMaxSpeedModifier,
    rangeFromFeet,
    movementMap,
    activeMovementMode,
    movementFeetFor,
    explicitMovementProfile,
    rangeForEntity,
    profilesForEntity,
    decorateEntity,
  });

  global.LuminousMovementSpeedRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
