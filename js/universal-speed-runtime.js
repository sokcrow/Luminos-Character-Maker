(function (global) {
  "use strict";

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const BASE_SPEED = typeof Symbol === "function" ? Symbol.for("luminous.baseSpeed") : "__luminousBaseSpeed";
  const decoratedUnits = typeof WeakSet === "function" ? new WeakSet() : null;
  const resolvingUnits = typeof WeakSet === "function" ? new WeakSet() : null;
  let derivedLoaderStarted = false;

  function ensureDerivedStatsRuntime() {
    if (global.LuminousDerivedStatsRuntime) {
      global.LuminousDerivedStatsRuntime.install?.();
      return true;
    }
    if (typeof require === "function") {
      try {
        const runtime = require("./derived-stats-runtime.js");
        runtime?.install?.();
        if (runtime) return true;
      } catch (_) {}
    }
    const doc = global.document;
    if (!doc || derivedLoaderStarted) return false;
    derivedLoaderStarted = true;
    let script = doc.getElementById("derived-stats-runtime-script");
    if (!script) {
      script = doc.createElement("script");
      script.id = "derived-stats-runtime-script";
      script.src = "js/derived-stats-runtime.js";
      script.async = false;
      script.dataset.engine = "derived-stats-v1";
      doc.head?.appendChild(script);
    }
    script.addEventListener?.("load", () => global.LuminousDerivedStatsRuntime?.install?.(), { once: true });
    return false;
  }

  function identityValues(entity = {}) {
    return [entity?.id, entity?.playerId, entity?.player_id, entity?.characterId, entity?.character_id, entity?.uid, entity?.vinculo_jugador]
      .filter((value) => value != null && String(value).trim() !== "")
      .map((value) => String(value).trim());
  }

  function entityName(entity = {}) {
    return normalizeId(entity?.characterName || entity?.character_name || entity?.nombre || entity?.name || "");
  }

  function currentPlayerCharacter() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
  }

  function isCurrentPlayerUnit(unit) {
    const character = currentPlayerCharacter();
    if (!unit || !character) return false;
    if (unit === character) return true;
    const ids = new Set(identityValues(character));
    if (identityValues(unit).some((id) => ids.has(id))) return true;
    const name = entityName(character);
    return Boolean(name && name === entityName(unit));
  }

  function traitsForUnit(unit) {
    if (Array.isArray(unit?.traitDefinitions)) return unit.traitDefinitions;
    if (Array.isArray(unit?.traits) && unit.traits.every((entry) => entry && typeof entry === "object")) return unit.traits;
    if (isCurrentPlayerUnit(unit)) return global.LuminousPlayerTraitRuntime?.getTraits?.() || [];
    return [];
  }

  function firstFinite(root, paths) {
    for (const path of paths) {
      let current = root;
      for (const key of path.split(".")) current = current?.[key];
      if (Number.isFinite(Number(current))) return Number(current);
    }
    return null;
  }

  function rawSpeed(unit, fallback = 0) {
    if (!unit) return fallback;
    if (unit[BASE_SPEED] !== undefined) return numberOr(unit[BASE_SPEED], fallback);
    return numberOr(unit.speed, fallback);
  }

  function baseSpeedRange(character, unit, baseSpeed) {
    const min = firstFinite(character, ["combatStats.minSpeed", "combatStats.min_speed", "minSpeed", "min_speed"])
      ?? firstFinite(unit, ["combatStats.minSpeed", "combatStats.min_speed", "minSpeed", "min_speed"])
      ?? baseSpeed;
    const max = firstFinite(character, ["combatStats.maxSpeed", "combatStats.max_speed", "maxSpeed", "max_speed"])
      ?? firstFinite(unit, ["combatStats.maxSpeed", "combatStats.max_speed", "maxSpeed", "max_speed"])
      ?? Math.max(min, baseSpeed);
    return { min, max: Math.max(min, max) };
  }

  function effectiveSpeed(unit, options = {}) {
    const fixed = global.LuminousConditionRuntime?.fixedSpeedFor?.(unit);
    if (fixed != null && Number.isFinite(Number(fixed))) return Number(fixed);
    const derived = global.LuminousDerivedStatsRuntime?.snapshot?.(
      options.character || (isCurrentPlayerUnit(unit) ? currentPlayerCharacter() : unit) || unit || {},
      { unit, traits: options.traits || traitsForUnit(unit), context: "combat", baseSpeed: options.baseSpeed },
    );
    if (derived?.speed && Number.isFinite(Number(derived.speed.current))) return Number(derived.speed.current);

    const modifiers = options.modifierEngine || global.LuminousUniversalModifiers;
    const character = options.character || (isCurrentPlayerUnit(unit) ? currentPlayerCharacter() : unit) || unit || {};
    const traits = options.traits || traitsForUnit(unit);
    const explicitBase = Number.isFinite(Number(options.baseSpeed)) ? Number(options.baseSpeed) : null;
    const baseSpeed = explicitBase ?? rawSpeed(unit, 0);
    if (!modifiers?.resolveCharacterSnapshot || !unit) return baseSpeed;

    const snapshot = modifiers.resolveCharacterSnapshot({
      unit,
      character,
      traits,
      context: "combat",
    });
    const range = baseSpeedRange(character, unit, baseSpeed);
    const passiveSpeed = numberOr(snapshot.modifiers?.speed, 0);
    const minSpeed = range.min + numberOr(snapshot.modifiers?.min_speed, 0) + passiveSpeed;
    const maxSpeed = Math.max(minSpeed, range.max + numberOr(snapshot.modifiers?.max_speed, 0) + passiveSpeed);
    return clamp(baseSpeed + passiveSpeed, minSpeed, maxSpeed);
  }

  function decorateSpeed(unit) {
    if (!unit || typeof unit !== "object") return unit;
    if (decoratedUnits?.has(unit)) return unit;
    const base = rawSpeed(unit, 0);
    try {
      Object.defineProperty(unit, BASE_SPEED, { value: base, writable: true, configurable: true });
      Object.defineProperty(unit, "speed", {
        configurable: true,
        enumerable: true,
        get() {
          if (resolvingUnits?.has(unit)) return numberOr(unit[BASE_SPEED], 0);
          resolvingUnits?.add(unit);
          try {
            return effectiveSpeed(unit, { baseSpeed: unit[BASE_SPEED] });
          } finally {
            resolvingUnits?.delete(unit);
          }
        },
        set(value) {
          unit[BASE_SPEED] = numberOr(value, unit[BASE_SPEED]);
        },
      });
      decoratedUnits?.add(unit);
    } catch (_) {
      return unit;
    }
    return unit;
  }

  function viewerCombatData() {
    if (global.combatData && typeof global.combatData === "object") return global.combatData;
    try {
      if (typeof global.eval === "function") {
        const value = global.eval("typeof combatData !== 'undefined' ? combatData : null");
        if (value && typeof value === "object") return value;
      }
    } catch (_) {}
    return null;
  }

  function decorateKnownCombatants() {
    const data = viewerCombatData();
    if (!data) return 0;
    const units = Object.values(data).filter(Boolean);
    const traitRuntime = global.LuminousTraitStandardizationRuntime;
    units.forEach((unit) => {
      decorateSpeed(unit);
      traitRuntime?.registerCombatUnit?.(unit);
    });
    traitRuntime?.installViewerEncounterBridge?.();
    return units.length;
  }

  function withResolvedSpeeds(units, callback) {
    const list = (units || []).filter(Boolean);
    const temporary = list.filter((unit) => !decoratedUnits?.has(unit)).map((unit) => ({ unit, speed: unit.speed }));
    try {
      temporary.forEach(({ unit }) => { unit.speed = effectiveSpeed(unit); });
      return callback();
    } finally {
      temporary.forEach(({ unit, speed }) => {
        if (speed === undefined) delete unit.speed;
        else unit.speed = speed;
      });
    }
  }

  function install() {
    ensureDerivedStatsRuntime();
    const engine = global.CombatEngine;
    const modifiers = global.LuminousUniversalModifiers;
    if (!engine || !modifiers) return false;
    if (engine.__universalSpeedBridge) {
      decorateKnownCombatants();
      return true;
    }

    const originalInitialize = typeof engine.initializeUnitData === "function" ? engine.initializeUnitData : null;
    const originalSlots = typeof engine.calculateActionSlots === "function" ? engine.calculateActionSlots : null;
    const originalTarget = typeof engine.autoTarget === "function" ? engine.autoTarget : null;

    if (originalInitialize) {
      engine.initializeUnitData = function (unit, ...rest) {
        const result = originalInitialize.call(this, unit, ...rest);
        decorateSpeed(unit);
        return result;
      };
    }

    if (originalSlots) {
      engine.calculateActionSlots = function (combatants, ...rest) {
        return withResolvedSpeeds(combatants, () => originalSlots.call(this, combatants, ...rest));
      };
    }

    if (originalTarget) {
      engine.autoTarget = function (attacker, skill, enemies, ...rest) {
        decorateSpeed(attacker);
        (enemies || []).forEach(decorateSpeed);
        return withResolvedSpeeds(enemies, () => originalTarget.call(this, attacker, skill, enemies, ...rest));
      };
    }

    Object.defineProperty(engine, "__universalSpeedBridge", { value: true, configurable: true });
    decorateKnownCombatants();
    return true;
  }

  const api = Object.freeze({ effectiveSpeed, decorateSpeed, decorateKnownCombatants, rawSpeed, withResolvedSpeeds, ensureDerivedStatsRuntime, install });
  global.LuminousUniversalSpeedRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (global.document) {
    install();
    global.setInterval?.(install, 800);
  }
})(typeof window !== "undefined" ? window : globalThis);
