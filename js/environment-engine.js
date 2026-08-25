(function (global) {
  "use strict";

  if (global.LuminousEnvironmentEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEnvironmentEngine;
    return;
  }

  const VERSION = 1;

  const ENCOUNTER_TYPES = Object.freeze({
    OUTDOOR: "outdoor",
    COVERED: "covered",
    INDOOR: "indoor",
    UNDERGROUND: "underground",
    UNDERWATER: "underwater",
    SPECIAL: "special",
  });

  const LIGHT_LEVELS = Object.freeze({
    BRIGHT: "bright",
    DIM: "dim",
    DARKNESS: "darkness",
  });

  const SUNLIGHT_LEVELS = Object.freeze({
    DIRECT: "direct",
    DIFFUSE: "diffuse",
    NONE: "none",
  });

  const VISIBILITY_LEVELS = Object.freeze({
    CLEAR: "clear",
    OBSCURED: "obscured",
    HEAVILY_OBSCURED: "heavily_obscured",
  });

  const ORIGINS = Object.freeze({
    NATURAL: "natural",
    ARTIFICIAL: "artificial",
    MAGICAL: "magical",
  });

  const SCOPES = Object.freeze({
    ENCOUNTER: "encounter",
    ZONE: "zone",
    ACTOR: "actor",
  });

  const SEVERITIES = Object.freeze({
    CONTEXT: "context",
    MODERATE: "moderate",
    SEVERE: "severe",
  });

  const normalizeId = (value) => String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  function deepFreeze(value, seen = new WeakSet()) {
    if (!value || typeof value !== "object" || seen.has(value)) return value;
    seen.add(value);
    Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
    return Object.freeze(value);
  }

  const EFFECT_ALIASES = Object.freeze({
    sink: "submerged",
    retreat_sink: "submerged",
  });

  const EFFECTS = deepFreeze({
    near_water: {
      label: "Near Water",
      category: "water",
      defaultScope: SCOPES.ZONE,
      severity: SEVERITIES.CONTEXT,
      description: "Relevant, accessible water is nearby.",
      implies: [],
    },
    in_water: {
      label: "In Water",
      category: "water",
      defaultScope: SCOPES.ACTOR,
      severity: SEVERITIES.MODERATE,
      description: "The actor is physically in water; swimming rules may inspect this context.",
      implies: ["near_water"],
    },
    submerged: {
      label: "Submerged",
      category: "water",
      defaultScope: SCOPES.ACTOR,
      severity: SEVERITIES.SEVERE,
      description: "The actor is fully underwater; underwater movement, breathing, combat, and traits may inspect this context.",
      implies: ["in_water", "near_water"],
    },

    exposed: {
      label: "Exposed",
      category: "exposure",
      defaultScope: SCOPES.ACTOR,
      severity: SEVERITIES.CONTEXT,
      description: "The actor receives the zone's environmental exposure normally.",
      implies: [],
    },
    under_cover: {
      label: "Under Cover",
      category: "exposure",
      defaultScope: SCOPES.ACTOR,
      severity: SEVERITIES.CONTEXT,
      description: "Direct precipitation is blocked and direct sunlight is reduced to diffuse sunlight.",
      implies: [],
    },
    indoors: {
      label: "Indoors",
      category: "exposure",
      defaultScope: SCOPES.ACTOR,
      severity: SEVERITIES.CONTEXT,
      description: "Exterior weather and natural sunlight are normally blocked.",
      implies: [],
    },

    rain: {
      label: "Rain",
      category: "weather",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.CONTEXT,
      description: "Rain is present. It is a trigger and does not impose a generic penalty by itself.",
      implies: [],
    },
    heavy_rain: {
      label: "Heavy Rain",
      category: "weather",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.SEVERE,
      description: "Severe rain; the resolver may reduce visibility without adding a blanket combat penalty.",
      implies: ["rain"],
    },
    snow: {
      label: "Snow",
      category: "weather",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.CONTEXT,
      description: "Snow is falling. It is primarily a trigger unless another resolver creates terrain or visibility consequences.",
      implies: [],
    },
    heavy_snow: {
      label: "Heavy Snow",
      category: "weather",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.SEVERE,
      description: "Severe snowfall; visibility and accumulated terrain may be resolved separately.",
      implies: ["snow"],
    },
    fog: {
      label: "Fog",
      category: "weather",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.MODERATE,
      description: "Fog is present and can make visibility Obscured.",
      implies: [],
    },
    dense_fog: {
      label: "Dense Fog",
      category: "weather",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.SEVERE,
      description: "Dense fog can make visibility Heavily Obscured.",
      implies: ["fog"],
    },
    hail: {
      label: "Hail",
      category: "weather",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.MODERATE,
      description: "Hail is present. It remains contextual unless a specific mechanic reacts to it.",
      implies: [],
    },
    strong_wind: {
      label: "Strong Wind",
      category: "weather",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.SEVERE,
      description: "Strong wind is available to flight, projectile, object, or trait resolvers; it has no blanket penalty here.",
      implies: [],
    },
    storm: {
      label: "Storm",
      category: "weather",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.SEVERE,
      description: "Composite severe weather. Its component effects carry the mechanical context.",
      implies: ["heavy_rain", "strong_wind"],
    },

    extreme_heat: {
      label: "Extreme Heat",
      category: "temperature",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.SEVERE,
      description: "Extreme heat exposure is active. Thresholds and consequences belong to the exposure resolver.",
      implies: [],
    },
    extreme_cold: {
      label: "Extreme Cold",
      category: "temperature",
      defaultScope: SCOPES.ENCOUNTER,
      severity: SEVERITIES.SEVERE,
      description: "Extreme cold exposure is active. Thresholds and consequences belong to the exposure resolver.",
      implies: [],
    },

    difficult_terrain: {
      label: "Difficult Terrain",
      category: "terrain",
      defaultScope: SCOPES.ZONE,
      severity: SEVERITIES.MODERATE,
      description: "Movement resolvers may increase movement cost in this terrain.",
      implies: [],
    },
    hazardous_terrain: {
      label: "Hazardous Terrain",
      category: "terrain",
      defaultScope: SCOPES.ZONE,
      severity: SEVERITIES.CONTEXT,
      description: "The terrain contains a hazard whose specific rule defines the consequence.",
      implies: [],
    },
    slippery: {
      label: "Slippery",
      category: "terrain",
      defaultScope: SCOPES.ZONE,
      severity: SEVERITIES.CONTEXT,
      description: "Actions that care about footing may inspect this trigger; no permanent generic penalty is applied.",
      implies: [],
    },
  });

  const WEATHER_PRESETS = deepFreeze({
    soleado: {
      sunlight: SUNLIGHT_LEVELS.DIRECT,
      visibility: VISIBILITY_LEVELS.CLEAR,
      effects: [],
    },
    parcialmente_nublado: {
      sunlight: SUNLIGHT_LEVELS.DIRECT,
      visibility: VISIBILITY_LEVELS.CLEAR,
      effects: [],
    },
    nublado: {
      sunlight: SUNLIGHT_LEVELS.DIFFUSE,
      visibility: VISIBILITY_LEVELS.CLEAR,
      effects: [],
    },
    llovizna: {
      sunlight: SUNLIGHT_LEVELS.DIFFUSE,
      visibility: VISIBILITY_LEVELS.CLEAR,
      effects: ["rain"],
    },
    lluvia: {
      sunlight: SUNLIGHT_LEVELS.DIFFUSE,
      visibility: VISIBILITY_LEVELS.CLEAR,
      effects: ["rain"],
    },
    tormenta: {
      sunlight: SUNLIGHT_LEVELS.DIFFUSE,
      visibility: VISIBILITY_LEVELS.OBSCURED,
      effects: ["storm"],
    },
    niebla: {
      sunlight: SUNLIGHT_LEVELS.DIFFUSE,
      visibility: VISIBILITY_LEVELS.OBSCURED,
      effects: ["fog"],
    },
    nieve: {
      sunlight: SUNLIGHT_LEVELS.DIFFUSE,
      visibility: VISIBILITY_LEVELS.CLEAR,
      effects: ["snow"],
    },
    nevada: {
      sunlight: SUNLIGHT_LEVELS.DIFFUSE,
      visibility: VISIBILITY_LEVELS.OBSCURED,
      effects: ["heavy_snow"],
    },
    granizo: {
      sunlight: SUNLIGHT_LEVELS.DIFFUSE,
      visibility: VISIBILITY_LEVELS.OBSCURED,
      effects: ["hail", "strong_wind"],
    },
  });

  const PRECIPITATION_EFFECTS = new Set(["rain", "heavy_rain", "snow", "heavy_snow", "hail"]);
  const EXTERIOR_WEATHER_EFFECTS = new Set([
    "rain", "heavy_rain", "snow", "heavy_snow", "fog", "dense_fog", "hail", "strong_wind", "storm",
  ]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeEncounterType(value) {
    const id = normalizeId(value || ENCOUNTER_TYPES.OUTDOOR);
    return Object.values(ENCOUNTER_TYPES).includes(id) ? id : ENCOUNTER_TYPES.SPECIAL;
  }

  function normalizeOrigin(value) {
    const id = normalizeId(value);
    return Object.values(ORIGINS).includes(id) ? id : null;
  }

  function normalizeScope(value, fallback) {
    const id = normalizeId(value);
    return Object.values(SCOPES).includes(id) ? id : fallback;
  }

  function canonicalEffectId(value) {
    const id = normalizeId(value);
    return EFFECT_ALIASES[id] || id;
  }

  function normalizeEffect(input, defaults = {}) {
    const raw = typeof input === "string" ? { id: input } : (input && typeof input === "object" ? input : {});
    const id = canonicalEffectId(raw.id || raw.name);
    if (!id) return null;
    const definition = EFFECTS[id] || {};
    return {
      id,
      label: String(raw.label || definition.label || raw.name || id),
      category: normalizeId(raw.category || definition.category || defaults.category || "special") || "special",
      scope: normalizeScope(raw.scope || defaults.scope, definition.defaultScope || SCOPES.ZONE),
      origin: normalizeOrigin(raw.origin ?? defaults.origin),
      severity: normalizeId(raw.severity || definition.severity || defaults.severity || SEVERITIES.CONTEXT),
    };
  }

  function addEffect(store, input, defaults = {}, visited = new Set()) {
    const effect = normalizeEffect(input, defaults);
    if (!effect || visited.has(effect.id)) return;
    visited.add(effect.id);
    const existing = store.get(effect.id);
    if (!existing) store.set(effect.id, effect);
    else {
      if (!existing.origin && effect.origin) existing.origin = effect.origin;
      if (existing.scope === SCOPES.ZONE && effect.scope !== SCOPES.ZONE) existing.scope = effect.scope;
    }
    const definition = EFFECTS[effect.id];
    (definition?.implies || []).forEach((impliedId) => addEffect(store, impliedId, {
      ...defaults,
      origin: effect.origin || defaults.origin,
      scope: effect.scope || defaults.scope,
    }, visited));
  }

  function removeEffects(store, predicate) {
    [...store.entries()].forEach(([id, effect]) => {
      if (predicate(id, effect)) store.delete(id);
    });
  }

  function normalizeLight(value, fallback) {
    const id = normalizeId(value);
    return Object.values(LIGHT_LEVELS).includes(id) ? id : fallback;
  }

  function normalizeSunlight(value, fallback) {
    const id = normalizeId(value);
    return Object.values(SUNLIGHT_LEVELS).includes(id) ? id : fallback;
  }

  function normalizeVisibility(value, fallback) {
    const id = normalizeId(value);
    return Object.values(VISIBILITY_LEVELS).includes(id) ? id : fallback;
  }

  function weatherIdFrom(input) {
    return normalizeId(
      input?.weatherId
      ?? input?.weather?.actual?.tipo
      ?? input?.weather?.tipo
      ?? input?.weather
      ?? "soleado"
    ) || "soleado";
  }

  function applyExposure(exposure, state, stateOrigins, effects) {
    const id = normalizeId(exposure);
    if (!id) return;
    addEffect(effects, id, { scope: SCOPES.ACTOR });
    if (id === "under_cover") {
      if (state.sunlight === SUNLIGHT_LEVELS.DIRECT) state.sunlight = SUNLIGHT_LEVELS.DIFFUSE;
      removeEffects(effects, (effectId) => PRECIPITATION_EFFECTS.has(effectId));
    } else if (id === "indoors") {
      state.sunlight = SUNLIGHT_LEVELS.NONE;
      stateOrigins.sunlight = null;
      state.visibility = VISIBILITY_LEVELS.CLEAR;
      stateOrigins.visibility = null;
      removeEffects(effects, (effectId) => EXTERIOR_WEATHER_EFFECTS.has(effectId));
    }
  }

  function applyWater(water, effects) {
    const source = water && typeof water === "object" ? water : {};
    const immersion = normalizeId(source.immersion || source.state || "none");
    if (source.nearby || source.nearWater || ["in_water", "submerged"].includes(immersion)) {
      addEffect(effects, { id: "near_water", origin: source.origin, scope: source.scope || SCOPES.ZONE });
    }
    if (["in_water", "submerged"].includes(immersion)) {
      addEffect(effects, { id: immersion, origin: source.origin, scope: source.scope || SCOPES.ACTOR });
    }
  }

  function resolveEnvironment(input = {}) {
    const encounterType = normalizeEncounterType(input.encounterType);
    const weatherId = weatherIdFrom(input);
    const preset = WEATHER_PRESETS[weatherId] || WEATHER_PRESETS.soleado;
    const isDay = input.isDay == null ? true : Boolean(input.isDay);
    const effects = new Map();

    const state = {
      light: isDay ? LIGHT_LEVELS.BRIGHT : LIGHT_LEVELS.DARKNESS,
      sunlight: isDay ? preset.sunlight : SUNLIGHT_LEVELS.NONE,
      visibility: preset.visibility,
    };
    const stateOrigins = {
      light: ORIGINS.NATURAL,
      sunlight: isDay && state.sunlight !== SUNLIGHT_LEVELS.NONE ? ORIGINS.NATURAL : null,
      visibility: state.visibility === VISIBILITY_LEVELS.CLEAR ? null : ORIGINS.NATURAL,
    };

    preset.effects.forEach((effectId) => addEffect(effects, effectId, {
      origin: ORIGINS.NATURAL,
      scope: SCOPES.ENCOUNTER,
    }));

    if (encounterType === ENCOUNTER_TYPES.COVERED) {
      if (state.sunlight === SUNLIGHT_LEVELS.DIRECT) state.sunlight = SUNLIGHT_LEVELS.DIFFUSE;
      removeEffects(effects, (effectId) => PRECIPITATION_EFFECTS.has(effectId));
    } else if (encounterType === ENCOUNTER_TYPES.INDOOR) {
      state.light = LIGHT_LEVELS.DIM;
      state.sunlight = SUNLIGHT_LEVELS.NONE;
      state.visibility = VISIBILITY_LEVELS.CLEAR;
      stateOrigins.light = null;
      stateOrigins.sunlight = null;
      stateOrigins.visibility = null;
      removeEffects(effects, (effectId) => EXTERIOR_WEATHER_EFFECTS.has(effectId));
    } else if (encounterType === ENCOUNTER_TYPES.UNDERGROUND) {
      state.light = LIGHT_LEVELS.DARKNESS;
      state.sunlight = SUNLIGHT_LEVELS.NONE;
      state.visibility = VISIBILITY_LEVELS.CLEAR;
      stateOrigins.light = ORIGINS.NATURAL;
      stateOrigins.sunlight = null;
      stateOrigins.visibility = null;
      removeEffects(effects, (effectId) => EXTERIOR_WEATHER_EFFECTS.has(effectId));
    } else if (encounterType === ENCOUNTER_TYPES.UNDERWATER) {
      state.sunlight = isDay ? SUNLIGHT_LEVELS.DIFFUSE : SUNLIGHT_LEVELS.NONE;
      stateOrigins.sunlight = isDay ? ORIGINS.NATURAL : null;
      removeEffects(effects, (effectId) => EXTERIOR_WEATHER_EFFECTS.has(effectId));
      addEffect(effects, { id: "submerged", scope: SCOPES.ENCOUNTER });
    }

    applyExposure(input.exposure, state, stateOrigins, effects);
    applyWater(input.water, effects);

    (Array.isArray(input.effects) ? input.effects : input.effects ? [input.effects] : [])
      .forEach((effect) => addEffect(effects, effect));

    const explicitState = input.state && typeof input.state === "object" ? input.state : {};
    const explicitOrigins = input.stateOrigins && typeof input.stateOrigins === "object" ? input.stateOrigins : {};
    ["light", "sunlight", "visibility"].forEach((key) => {
      if (explicitState[key] === undefined && input[key] === undefined) return;
      const raw = explicitState[key] ?? input[key];
      if (key === "light") state.light = normalizeLight(raw, state.light);
      if (key === "sunlight") state.sunlight = normalizeSunlight(raw, state.sunlight);
      if (key === "visibility") state.visibility = normalizeVisibility(raw, state.visibility);
      stateOrigins[key] = normalizeOrigin(explicitOrigins[key]);
    });

    if (effects.has("dense_fog")) {
      state.visibility = VISIBILITY_LEVELS.HEAVILY_OBSCURED;
      stateOrigins.visibility = effects.get("dense_fog").origin;
    } else if (effects.has("heavy_rain") || effects.has("heavy_snow") || effects.has("fog") || effects.has("hail")) {
      if (state.visibility === VISIBILITY_LEVELS.CLEAR) state.visibility = VISIBILITY_LEVELS.OBSCURED;
      if (!stateOrigins.visibility) {
        const source = effects.get("heavy_rain") || effects.get("heavy_snow") || effects.get("fog") || effects.get("hail");
        stateOrigins.visibility = source?.origin || null;
      }
    }

    const effectList = [...effects.values()].sort((a, b) => a.id.localeCompare(b.id));
    const origins = [...new Set([
      ...effectList.map((effect) => effect.origin),
      ...Object.values(stateOrigins),
    ].filter(Boolean))].sort();
    const categories = [...new Set([
      "light",
      "sunlight",
      "visibility",
      ...effectList.map((effect) => effect.category),
    ])].sort();

    return {
      version: VERSION,
      encounterType,
      weatherId,
      isDay,
      state,
      stateOrigins,
      effects: effectList,
      effectIds: effectList.map((effect) => effect.id),
      origins,
      categories,
    };
  }

  function fromWeatherState(weatherState, options = {}) {
    return resolveEnvironment({
      ...options,
      weather: weatherState,
    });
  }

  function hasEffect(environment, effectId) {
    const id = canonicalEffectId(effectId);
    return Boolean(id && environment?.effectIds?.includes(id));
  }

  function hasState(environment, key, value) {
    const stateKey = normalizeId(key);
    return normalizeId(environment?.state?.[stateKey]) === normalizeId(value);
  }

  function hasOrigin(environment, origin) {
    const id = normalizeOrigin(origin);
    return Boolean(id && environment?.origins?.includes(id));
  }

  function hasCategory(environment, category) {
    const id = normalizeId(category);
    return Boolean(id && environment?.categories?.includes(id));
  }

  function withEnvironment(runtime = {}, environment) {
    return {
      ...runtime,
      environment: clone(environment || resolveEnvironment()),
    };
  }

  const api = Object.freeze({
    VERSION,
    ENCOUNTER_TYPES,
    LIGHT_LEVELS,
    SUNLIGHT_LEVELS,
    VISIBILITY_LEVELS,
    ORIGINS,
    SCOPES,
    SEVERITIES,
    EFFECTS,
    WEATHER_PRESETS,
    EFFECT_ALIASES,
    normalizeId,
    normalizeEncounterType,
    canonicalEffectId,
    normalizeEffect,
    resolveEnvironment,
    fromWeatherState,
    hasEffect,
    hasState,
    hasOrigin,
    hasCategory,
    withEnvironment,
  });

  global.LuminousEnvironmentEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
