(function (global) {
  "use strict";

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

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

  function effectiveSpeed(unit, options = {}) {
    const modifiers = options.modifierEngine || global.LuminousUniversalModifiers;
    const character = options.character || (isCurrentPlayerUnit(unit) ? currentPlayerCharacter() : unit) || unit || {};
    const traits = options.traits || traitsForUnit(unit);
    if (!modifiers?.resolveCharacterSnapshot || !unit) return numberOr(unit?.speed, 0);

    const snapshot = modifiers.resolveCharacterSnapshot({
      unit,
      character,
      traits,
      context: "combat",
    });
    const baseSpeed = numberOr(unit.speed, numberOr(snapshot.minSpeed, 0));
    const passiveSpeed = numberOr(snapshot.modifiers?.speed, 0);
    const minSpeed = numberOr(snapshot.minSpeed, baseSpeed + passiveSpeed);
    const maxSpeed = Math.max(minSpeed, numberOr(snapshot.maxSpeed, minSpeed));
    return clamp(baseSpeed + passiveSpeed, minSpeed, maxSpeed);
  }

  function withResolvedSpeeds(units, callback) {
    const list = (units || []).filter(Boolean);
    const originals = list.map((unit) => ({ unit, speed: unit.speed }));
    try {
      list.forEach((unit) => { unit.speed = effectiveSpeed(unit); });
      return callback();
    } finally {
      originals.forEach(({ unit, speed }) => {
        if (speed === undefined) delete unit.speed;
        else unit.speed = speed;
      });
    }
  }

  function install() {
    const engine = global.CombatEngine;
    const modifiers = global.LuminousUniversalModifiers;
    if (!engine || !modifiers) return false;
    if (engine.__universalSpeedBridge) return true;

    const originalSlots = typeof engine.calculateActionSlots === "function" ? engine.calculateActionSlots : null;
    const originalTarget = typeof engine.autoTarget === "function" ? engine.autoTarget : null;

    if (originalSlots) {
      engine.calculateActionSlots = function (combatants, ...rest) {
        return withResolvedSpeeds(combatants, () => originalSlots.call(this, combatants, ...rest));
      };
    }

    if (originalTarget) {
      engine.autoTarget = function (attacker, skill, enemies, ...rest) {
        return withResolvedSpeeds(enemies, () => originalTarget.call(this, attacker, skill, enemies, ...rest));
      };
    }

    Object.defineProperty(engine, "__universalSpeedBridge", { value: true, configurable: true });
    return true;
  }

  const api = Object.freeze({ effectiveSpeed, withResolvedSpeeds, install });
  global.LuminousUniversalSpeedRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (global.document) {
    install();
    global.setInterval?.(install, 800);
  }
})(typeof window !== "undefined" ? window : globalThis);
