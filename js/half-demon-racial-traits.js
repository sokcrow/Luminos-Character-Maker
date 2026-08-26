(function (global) {
  "use strict";

  if (global.LuminousHalfDemonRacialTraits) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousRacialTraitCatalog || global.LuminousHalfDemonRacialTraits;
    return;
  }

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const RACE_ID = "half_demon";

  const DEFINITIONS = Object.freeze({
    half_demon_devil_gauge: Object.freeze({
      schemaVersion: 1,
      id: "half_demon_devil_gauge",
      name: "Devil Gauge",
      description: "[On Hit] Gain 2 Devil Gauge.\n\n[On Evade] Gain 5 Devil Gauge.\n\n[On Clash Win] Gain 10 Devil Gauge.\n\n[On Clash Lose] Lose 10 Devil Gauge.\n\n[Getting Hit] lose 5 Devil Gauge.\n\nIf this unit not deal damage last turn lose 20 Devil Gauge.\n\nMax 100 Devil Gauge.",
      source: Object.freeze({ type: "race", id: RACE_ID }),
      contexts: Object.freeze(["combat"]),
      activation: Object.freeze({ type: "passive", actionCost: "none" }),
      effects: Object.freeze([]),
      rules: Object.freeze([
        Object.freeze({ runtime: "half_demon_combat_runtime", statusId: "devil_gauge", max: 100 }),
      ]),
    }),
    half_demon_devil_trigger: Object.freeze({
      schemaVersion: 1,
      id: "half_demon_devil_trigger",
      name: "Devil Trigger",
      description: "At 40+ Devil Gauge Gain 10% Max HP as Shield on Turn start\n\nAt 50+ Devil Gauge +1 Defense Power\n\nAt 60+ Devil Gauge +1 Final Speed\n\nAt 70+ Devil Gauge deal +10% Damage\n\nAt 80+ Devil Gauge +1 Clash Power\n\nAt 90+ Devil Gauge +1 Final Power.\n\nAt 100 Devil Gauge [On Hit] Heal HP equal to 5% of Damage dealt.",
      source: Object.freeze({ type: "race", id: RACE_ID }),
      contexts: Object.freeze(["combat"]),
      activation: Object.freeze({ type: "passive", actionCost: "none" }),
      effects: Object.freeze([]),
      rules: Object.freeze([
        Object.freeze({ runtime: "half_demon_combat_runtime", statusId: "devil_gauge" }),
      ]),
    }),
  });

  const MANIFEST = Object.freeze({
    half_demon: Object.freeze({
      base: Object.freeze(["half_demon_devil_gauge", "half_demon_devil_trigger"]),
    }),
  });

  const OWN_GRANTS = Object.freeze([
    Object.freeze({
      id: "race_half_demon_half_demon_devil_gauge",
      sourceType: "race",
      sourceId: RACE_ID,
      traitId: "half_demon_devil_gauge",
    }),
    Object.freeze({
      id: "race_half_demon_half_demon_devil_trigger",
      sourceType: "race",
      sourceId: RACE_ID,
      traitId: "half_demon_devil_trigger",
    }),
  ]);

  let baseCatalog = null;
  let traitEngine = null;
  let installedCatalog = null;

  function loadBase() {
    if (global.LuminousRacialTraitCatalog && !global.LuminousRacialTraitCatalog.__halfDemonRacialTraits) {
      baseCatalog = global.LuminousRacialTraitCatalog;
    }
    if (!baseCatalog && typeof require === "function") {
      try { baseCatalog = require("./canonical-racial-traits.js"); } catch (_) {
        try { baseCatalog = require("./racial-trait-catalog.js"); } catch (_) {}
      }
    }
    return baseCatalog;
  }

  function loadEngine() {
    traitEngine = global.LuminousTraitEngine || traitEngine;
    if (!traitEngine && typeof require === "function") {
      try { traitEngine = require("./trait-engine.js"); } catch (_) {}
    }
    return traitEngine;
  }

  function normalizeCharacter(character = {}) {
    const build = character?.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    return {
      ...character,
      raceId: normalizeId(build.raceId ?? character.raceId ?? character.race?.id),
      raceSubtypeId: normalizeId(build.raceSubtypeId ?? character.raceSubtypeId ?? character.race?.subtypeId),
    };
  }

  function ownGrantMatches(character, grant) {
    const normalized = normalizeCharacter(character);
    return normalizeId(grant?.sourceType) === "race" && normalizeId(grant?.sourceId) === RACE_ID && normalized.raceId === RACE_ID;
  }

  function install(base = loadBase(), engine = loadEngine()) {
    if (!base || !engine) return null;
    if (base.__halfDemonRacialTraits) {
      installedCatalog = base;
      global.LuminousRacialTraitCatalog = base;
      return base;
    }

    const definitions = Object.freeze({ ...(base.allDefinitions?.() || base.DEFINITIONS || {}), ...DEFINITIONS });
    const baseManifest = base.RACE_TRAIT_MANIFEST || {};
    const manifest = Object.freeze({ ...baseManifest, ...MANIFEST });
    const baseGrants = base.allGrants?.() || base.GRANTS || [];
    const grantsById = new Map();
    [...baseGrants, ...OWN_GRANTS].forEach((grant) => {
      const id = normalizeId(grant?.id || `${grant?.sourceType}_${grant?.sourceId}_${grant?.traitId}`);
      if (id && !grantsById.has(id)) grantsById.set(id, clone(grant));
    });
    const grants = Object.freeze([...grantsById.values()]);

    function resolveTraitGrants(character, catalog = definitions) {
      const resolved = base.resolveTraitGrants?.(character, catalog) || [];
      const normalized = normalizeCharacter(character);
      if (normalized.raceId !== RACE_ID) return resolved;
      const byId = catalog instanceof Map
        ? catalog
        : new Map(Object.entries(catalog || {}).map(([id, definition]) => [normalizeId(id), definition]));
      const seen = new Set(resolved.map((trait) => normalizeId(trait?.id || trait?.name)));
      OWN_GRANTS.forEach((grant) => {
        if (!ownGrantMatches(normalized, grant) || seen.has(normalizeId(grant.traitId))) return;
        const definition = byId.get(normalizeId(grant.traitId)) || DEFINITIONS[normalizeId(grant.traitId)];
        if (!definition) return;
        const trait = engine.normalizeTrait ? engine.normalizeTrait(definition) : clone(definition);
        trait.source = { ...(trait.source || {}), type: "race", id: RACE_ID };
        resolved.push(trait);
        seen.add(normalizeId(grant.traitId));
      });
      return resolved;
    }

    function validateAll(customEngine = engine) {
      const inherited = base.validateAll?.(customEngine) || { valid: true, errors: [], warnings: [] };
      const errors = [...(inherited.errors || [])];
      const warnings = [...(inherited.warnings || [])];
      Object.entries(DEFINITIONS).forEach(([id, definition]) => {
        const result = customEngine?.validateTrait?.(definition);
        if (!result) return;
        (result.errors || []).forEach((error) => errors.push(`${id}: ${error}`));
        (result.warnings || []).forEach((warning) => warnings.push(`${id}: ${warning}`));
      });
      return { valid: errors.length === 0, errors, warnings };
    }

    const api = Object.freeze({
      ...base,
      __halfDemonRacialTraits: true,
      DEFINITIONS: definitions,
      GRANTS: grants,
      RACE_TRAIT_MANIFEST: manifest,
      allDefinitions: () => clone(definitions),
      allGrants: () => clone(grants),
      getDefinition: (id) => clone(definitions[normalizeId(id)] || null),
      resolveTraitGrants,
      validateAll,
    });

    installedCatalog = api;
    global.LuminousRacialTraitCatalog = api;
    return api;
  }

  const api = Object.freeze({
    DEFINITIONS,
    MANIFEST,
    OWN_GRANTS,
    install,
    get catalog() { return installedCatalog; },
  });

  global.LuminousHalfDemonRacialTraits = api;
  install();
  if (global.document && typeof global.setInterval === "function") {
    const retry = global.setInterval(() => {
      if (install()) global.clearInterval(retry);
    }, 100);
    global.setTimeout(() => global.clearInterval(retry), 10000);
  }

  if (typeof module !== "undefined" && module.exports) {
    install();
    module.exports = global.LuminousRacialTraitCatalog || api;
  }
})(typeof window !== "undefined" ? window : globalThis);
