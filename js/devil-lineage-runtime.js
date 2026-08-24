(function (global) {
  "use strict";

  if (global.LuminousDevilLineageRuntime) return;

  const ARCHETYPE_ID = "path_of_the_devil_lineage";
  const CLASS_ID = "barbarian";
  const REGEN_HOURS_REQUIRED = 72;
  const PATCH_INTERVAL_MS = 500;
  const state = {
    trackedUnits: new Set(),
    listenersBound: false,
    timer: null,
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function classEntries(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const source = Array.isArray(build.classes) ? build.classes : (Array.isArray(character.classes) ? character.classes : []);
    return source.map((entry) => ({
      classId: normalizeId(entry?.classId || entry?.id || entry?.className || entry?.name),
      level: Math.max(0, Number.parseInt(entry?.level ?? entry?.levels ?? entry?.classLevel, 10) || 0),
    })).filter((entry) => entry.classId);
  }

  function selections(character = {}) {
    const build = character.characterBuild && typeof character.characterBuild === "object" ? character.characterBuild : {};
    const source = Array.isArray(build.archetypes) ? build.archetypes : (Array.isArray(character.archetypes) ? character.archetypes : []);
    return source.map((entry) => ({
      classId: normalizeId(entry?.classId || entry?.parentClassId),
      archetypeId: normalizeId(entry?.archetypeId || entry?.subclassId || entry?.id),
    }));
  }

  function devilLineageLevel(character = {}) {
    const runtime = global.LuminousArchetypeRuntime;
    if (runtime?.devilLineageLevel) {
      try {
        const value = numberOr(runtime.devilLineageLevel(character), 0);
        if (value > 0) return value;
      } catch (_) {}
    }

    const engine = global.LuminousArchetypeEngine;
    if (engine?.isSelected && engine?.getClassLevel) {
      try {
        if (engine.isSelected(character, ARCHETYPE_ID, CLASS_ID)) return Math.max(0, numberOr(engine.getClassLevel(character, CLASS_ID), 0));
      } catch (_) {}
    }

    const selected = selections(character).some((entry) => entry.classId === CLASS_ID && entry.archetypeId === ARCHETYPE_ID);
    if (!selected) return 0;
    return classEntries(character).find((entry) => entry.classId === CLASS_ID)?.level || 0;
  }

  function identityValues(entity = {}) {
    return [
      entity.combatId, entity.combat_id, entity.unitId, entity.unit_id,
      entity.id, entity.playerId, entity.player_id, entity.characterId, entity.character_id,
      entity.actorId, entity.actor_id, entity.uid, entity.vinculo_jugador,
    ].filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function currentCharacter() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
  }

  function currentHp(unit = {}) {
    return numberOr(unit.hp ?? unit.currentHp ?? unit.hp_actual ?? unit.combatStats?.hp_actual, 0);
  }

  function markDerivedTwoHandedRule(character, active) {
    if (!character || typeof character !== "object") return false;
    if (active) {
      try {
        if (character.twoHandedAsOneHanded !== true) {
          Object.defineProperty(character, "twoHandedAsOneHanded", {
            value: true,
            writable: true,
            configurable: true,
            enumerable: false,
          });
        }
        if (character.__devilLineageTwoHandedRule !== true) {
          Object.defineProperty(character, "__devilLineageTwoHandedRule", {
            value: true,
            writable: true,
            configurable: true,
            enumerable: false,
          });
        }
      } catch (_) {
        character.twoHandedAsOneHanded = true;
        character.__devilLineageTwoHandedRule = true;
      }
      return true;
    }

    if (character.__devilLineageTwoHandedRule === true) {
      try { delete character.twoHandedAsOneHanded; } catch (_) { character.twoHandedAsOneHanded = false; }
      try { delete character.__devilLineageTwoHandedRule; } catch (_) { character.__devilLineageTwoHandedRule = false; }
    }
    return false;
  }

  function syncEquipmentRules(character = currentCharacter()) {
    if (!character) return false;
    const active = devilLineageLevel(character) >= 15;
    return markDerivedTwoHandedRule(character, active);
  }

  function trackUnit(unit) {
    if (!unit || typeof unit !== "object") return unit;
    state.trackedUnits.add(unit);
    syncEquipmentRules(unit);
    return unit;
  }

  function structuralInjuries(unit = {}) {
    return (Array.isArray(unit.injuries) ? unit.injuries : []).filter((injury) =>
      injury && injury.active !== false && injury.structural === true &&
      (Array.isArray(injury.affectedParts) ? injury.affectedParts.length > 0 : Boolean(injury.bodyPart || injury.partId))
    );
  }

  function regenerationHours(injury = {}) {
    return Math.max(0, numberOr(injury.metadata?.devilLineageRegenerationHours, 0));
  }

  function setRegenerationHours(injury, hours) {
    if (!injury || typeof injury !== "object") return 0;
    if (!injury.metadata || typeof injury.metadata !== "object") injury.metadata = {};
    const next = Math.max(0, Math.min(REGEN_HOURS_REQUIRED, numberOr(hours, 0)));
    injury.metadata.devilLineageRegenerationHours = next;
    return next;
  }

  function persistRegenerationState(unit) {
    const engine = global.LuminousInjuryEngine;
    if (engine?.syncDerivedState) {
      try { engine.syncDerivedState(unit); return true; } catch (_) {}
    }
    return false;
  }

  function resetRegeneration(unit, options = {}) {
    if (!unit || devilLineageLevel(unit) < 70) return { reset: false, unit, reason: "not_eligible" };
    let changed = false;
    structuralInjuries(unit).forEach((injury) => {
      if (regenerationHours(injury) > 0) {
        setRegenerationHours(injury, 0);
        changed = true;
      }
    });
    if (changed && options.persist !== false) persistRegenerationState(unit);
    return { reset: changed, unit, reason: options.reason || "hp_below_one" };
  }

  function advanceRegeneration(unit, hours, options = {}) {
    if (!unit) return { eligible: false, unit, reason: "missing_unit", progressed: [], completed: [] };
    trackUnit(unit);
    if (devilLineageLevel(unit) < 70) return { eligible: false, unit, reason: "not_eligible", progressed: [], completed: [] };
    const elapsed = Math.max(0, numberOr(hours, 0));
    if (!elapsed) return { eligible: true, unit, reason: "no_time", progressed: [], completed: [] };

    const injuries = structuralInjuries(unit);
    if (!injuries.length) return { eligible: true, unit, reason: "no_structural_injuries", progressed: [], completed: [] };
    if (currentHp(unit) < 1) {
      const reset = resetRegeneration(unit, { reason: "hp_below_one", persist: options.persist });
      return { eligible: true, unit, reason: "hp_below_one", reset: reset.reset, progressed: [], completed: [] };
    }

    const progressed = [];
    const completed = [];
    injuries.forEach((injury) => {
      const before = regenerationHours(injury);
      const after = setRegenerationHours(injury, before + elapsed);
      progressed.push({ instanceId: injury.instanceId || injury.id, before, after });
      if (after >= REGEN_HOURS_REQUIRED) completed.push(injury.instanceId || injury.id);
    });

    const engine = global.LuminousInjuryEngine;
    const cured = [];
    completed.forEach((injuryRef) => {
      if (!engine?.treatInjury) return;
      try {
        const result = engine.treatInjury(unit, injuryRef, { cure: true, method: "regeneration" });
        if (result?.cured) cured.push(injuryRef);
      } catch (_) {}
    });

    if (progressed.length && !cured.length && options.persist !== false) persistRegenerationState(unit);
    return { eligible: true, unit, hours: elapsed, progressed, completed, cured };
  }

  function matchingTrackedUnits(characterId) {
    const wanted = String(characterId || "").trim();
    const candidates = new Set(state.trackedUnits);
    const current = currentCharacter();
    if (current) candidates.add(current);
    const combatData = global.combatData && typeof global.combatData === "object" ? Object.values(global.combatData) : [];
    combatData.forEach((unit) => candidates.add(unit));
    if (!wanted) return [...candidates];
    return [...candidates].filter((unit) => identityValues(unit).includes(wanted));
  }

  function advanceWorldTime(detail = {}) {
    const hours = Math.max(0, numberOr(detail.hours ?? detail.worldHoursAdvanced, 0));
    if (!hours) return [];
    const direct = detail.character && typeof detail.character === "object" ? [trackUnit(detail.character)] : [];
    const units = direct.length ? direct : matchingTrackedUnits(detail.characterId);
    return units.map((unit) => advanceRegeneration(unit, hours)).filter(Boolean);
  }

  function bindEvents() {
    if (state.listenersBound || typeof global.addEventListener !== "function") return false;
    state.listenersBound = true;

    ["luminous:injury-gained", "luminous:injury-state-changed", "luminous:rest-completed", "luminous:unit-revived"].forEach((name) => {
      global.addEventListener(name, (event) => {
        const detail = event?.detail || {};
        trackUnit(detail.unit || detail.character);
      });
    });

    ["luminous:downed", "luminous:unit-dead"].forEach((name) => {
      global.addEventListener(name, (event) => {
        const unit = trackUnit(event?.detail?.unit);
        if (unit) resetRegeneration(unit, { reason: name });
      });
    });

    global.addEventListener("luminous:world-time-advance-requested", (event) => advanceWorldTime(event?.detail || {}));
    global.addEventListener("luminous:traits-refreshed", () => trackUnit(currentCharacter()));
    return true;
  }

  function syncKnownUnits() {
    trackUnit(currentCharacter());
    const combatData = global.combatData && typeof global.combatData === "object" ? Object.values(global.combatData) : [];
    combatData.forEach(trackUnit);
    return true;
  }

  function install() {
    bindEvents();
    syncKnownUnits();
    return true;
  }

  const api = Object.freeze({
    ARCHETYPE_ID,
    CLASS_ID,
    REGEN_HOURS_REQUIRED,
    devilLineageLevel,
    identityValues,
    currentCharacter,
    syncEquipmentRules,
    trackUnit,
    structuralInjuries,
    regenerationHours,
    resetRegeneration,
    advanceRegeneration,
    advanceWorldTime,
    matchingTrackedUnits,
    bindEvents,
    syncKnownUnits,
    install,
  });

  global.LuminousDevilLineageRuntime = api;
  install();
  if (typeof global.setInterval === "function") {
    state.timer = global.setInterval(install, PATCH_INTERVAL_MS);
    if (typeof state.timer?.unref === "function") state.timer.unref();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
