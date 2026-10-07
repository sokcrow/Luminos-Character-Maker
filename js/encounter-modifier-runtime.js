(function (global) {
  "use strict";

  if (global.LuminousEncounterModifierRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEncounterModifierRuntime;
    return;
  }

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const safeRequire = (path) => {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  };

  function statusEngine() { return global.LuminousStatusEngine || safeRequire("./status-engine.js"); }

  const WEB = Object.freeze({
    id: "web",
    name: "Web",
    kind: "encounter_modifier",
    timing: "turn_end",
    modes: Object.freeze(["single", "zone"]),
    statusId: "bind",
    bindOnClearTarget: 3,
    bindOnBoundTarget: 6,
    description: "On Turn End, affected Units gain 3 Bind. If they already have Bind, they gain 6 Bind instead.",
  });

  const state = { modifiers: [] };

  function normalizeMode(value) {
    const id = normalizeId(value || "zone");
    return id === "single" ? "single" : "zone";
  }

  function normalizeModifier(input = {}) {
    const raw = typeof input === "string" ? { id: input } : (input && typeof input === "object" ? input : {});
    const id = normalizeId(raw.id || raw.type || raw.name);
    if (id !== WEB.id) return null;
    return {
      ...clone(raw),
      id: WEB.id,
      name: WEB.name,
      kind: WEB.kind,
      timing: WEB.timing,
      mode: normalizeMode(raw.mode || raw.scopeType || raw.areaType),
      anchorUnitId: raw.anchorUnitId || raw.targetUnitId || raw.unitId || null,
      anchorSlotId: raw.anchorSlotId || raw.targetSlotId || raw.slotId || null,
      anchorSpaceId: raw.anchorSpaceId || raw.spaceId || null,
      unitIds: Array.isArray(raw.unitIds) ? raw.unitIds.map(String) : [],
      adjacentUnitIds: Array.isArray(raw.adjacentUnitIds) ? raw.adjacentUnitIds.map(String) : [],
      spaceIds: Array.isArray(raw.spaceIds) ? raw.spaceIds.map(String) : [],
      adjacentSpaceIds: Array.isArray(raw.adjacentSpaceIds) ? raw.adjacentSpaceIds.map(String) : [],
    };
  }

  function unitId(unit) {
    return String(unit?.id || unit?.unitId || unit?.actorId || "");
  }

  function unitIdFromSlot(slotId) {
    const text = String(slotId || "");
    return text.includes("_slot_") ? text.split("_slot_")[0] : text;
  }

  function unitSpaceId(unit) {
    const value = unit?.spaceId ?? unit?.fieldSpaceId ?? unit?.placementSpaceId ?? unit?.position?.spaceId ?? null;
    return value == null ? null : String(value);
  }

  function isActive(unit) {
    if (!unit || unit.dead === true || unit.defeated === true || unit.removed === true || unit.escaped === true) return false;
    return !Number.isFinite(Number(unit.hp)) || Number(unit.hp) > 0;
  }

  function hasTrait(unit, traitId) {
    const id = normalizeId(traitId);
    const ids = Array.isArray(unit?.traitIds) ? unit.traitIds.map(normalizeId) : [];
    if (ids.includes(id)) return true;
    return Array.isArray(unit?.traits) && unit.traits.some((trait) => normalizeId(trait?.id || trait?.name) === id);
  }

  function isWebWalker(unit) {
    return hasTrait(unit, "web_walker") || unit?.mechanics?.webWalker?.ignoresWebBind === true;
  }

  function adjacencyFor(anchorId, anchorSpaceId, units, modifier, context = {}) {
    const ids = new Set((modifier.adjacentUnitIds || []).map(String));
    const adjacency = context.adjacencyByUnitId || context.adjacency || {};
    const direct = adjacency?.[anchorId];
    if (Array.isArray(direct)) direct.forEach((id) => ids.add(String(id)));

    const anchor = units.find((unit) => unitId(unit) === anchorId);
    if (Array.isArray(anchor?.adjacentUnitIds)) anchor.adjacentUnitIds.forEach((id) => ids.add(String(id)));

    const spaces = new Set((modifier.adjacentSpaceIds || []).map(String));
    const spaceAdjacency = context.adjacentSpaceIds || context.spaceAdjacency || {};
    const adjacentSpaces = anchorSpaceId == null ? null : spaceAdjacency?.[String(anchorSpaceId)];
    if (Array.isArray(adjacentSpaces)) adjacentSpaces.forEach((spaceId) => spaces.add(String(spaceId)));
    units.forEach((unit) => {
      const spaceId = unitSpaceId(unit);
      if (spaceId != null && spaces.has(spaceId)) ids.add(unitId(unit));
    });
    return ids;
  }

  function affectedUnits(modifierInput, unitsInput = [], context = {}) {
    const modifier = normalizeModifier(modifierInput);
    if (!modifier) return [];
    const units = (Array.isArray(unitsInput) ? unitsInput : Object.values(unitsInput || {})).filter(isActive);
    if (modifier.mode === "zone") return units;

    const ids = new Set((modifier.unitIds || []).map(String));
    const spaces = new Set((modifier.spaceIds || []).map(String));
    const anchorId = String(modifier.anchorUnitId || unitIdFromSlot(modifier.anchorSlotId) || "");
    const anchorSpaceId = modifier.anchorSpaceId == null ? null : String(modifier.anchorSpaceId);
    if (anchorId) ids.add(anchorId);
    if (anchorSpaceId != null) spaces.add(anchorSpaceId);

    const adjacentIds = adjacencyFor(anchorId, anchorSpaceId, units, modifier, context);
    adjacentIds.forEach((id) => ids.add(id));

    return units.filter((unit) => {
      if (ids.has(unitId(unit))) return true;
      const spaceId = unitSpaceId(unit);
      return spaceId != null && spaces.has(spaceId);
    });
  }

  function hasBind(unit) {
    const statuses = statusEngine();
    const bind = statuses?.getStatus?.(unit, "bind") || unit?.statusEffects?.bind || null;
    return Boolean(bind && Number(bind.count ?? bind.potency ?? 0) > 0);
  }

  function applyWebTurnEnd(modifierInput, unitsInput = [], context = {}) {
    const modifier = normalizeModifier(modifierInput);
    if (!modifier) return { applied: false, reason: "not_web", results: [] };
    const affected = affectedUnits(modifier, unitsInput, context);
    const results = affected.map((unit) => {
      if (isWebWalker(unit)) {
        return { unitId: unitId(unit), applied: false, ignored: true, reason: "web_walker" };
      }
      const alreadyBound = hasBind(unit);
      const amount = alreadyBound ? WEB.bindOnBoundTarget : WEB.bindOnClearTarget;
      const status = statusEngine()?.applyStatus?.(unit, "bind", {
        mode: "gain",
        count: amount,
        sourceTraitId: "encounter_modifier:web",
        data: { encounterModifierId: "web", encounterModifierMode: modifier.mode },
      }) || null;
      return { unitId: unitId(unit), applied: true, alreadyBound, amount, status };
    });
    return { applied: true, modifier, results };
  }

  function applyTurnEnd(modifiersInput, unitsInput = [], context = {}) {
    const modifiers = (Array.isArray(modifiersInput) ? modifiersInput : modifiersInput ? [modifiersInput] : [])
      .map(normalizeModifier).filter(Boolean);
    return modifiers.map((modifier) => applyWebTurnEnd(modifier, unitsInput, context));
  }

  function webDetectionForUnit(unit, modifiersInput, unitsInput = [], context = {}) {
    if (!isWebWalker(unit)) return [];
    const selfId = unitId(unit);
    const modifiers = (Array.isArray(modifiersInput) ? modifiersInput : modifiersInput ? [modifiersInput] : [])
      .map(normalizeModifier).filter(Boolean);
    const detected = new Set();
    for (const modifier of modifiers) {
      const affected = affectedUnits(modifier, unitsInput, context);
      if (!affected.some((candidate) => unitId(candidate) === selfId)) continue;
      affected.forEach((candidate) => {
        const id = unitId(candidate);
        if (id && id !== selfId) detected.add(id);
      });
    }
    return [...detected];
  }

  function setModifiers(modifiers = []) {
    state.modifiers = (Array.isArray(modifiers) ? modifiers : [modifiers]).map(normalizeModifier).filter(Boolean);
    return clone(state.modifiers);
  }
  function addModifier(modifier) {
    const normalized = normalizeModifier(modifier);
    if (normalized) state.modifiers.push(normalized);
    return normalized ? clone(normalized) : null;
  }
  function clearModifiers() { state.modifiers = []; return true; }
  function getModifiers() { return clone(state.modifiers); }

  function functionChainHasMarker(fn, marker) {
    const seen = new Set();
    let current = fn;
    while (typeof current === "function" && !seen.has(current)) {
      if (current[marker] === true) return true;
      seen.add(current);
      current = current.__legacy;
    }
    return false;
  }

  function installCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || typeof engine.triggerPhase !== "function") return false;
    if (functionChainHasMarker(engine.triggerPhase, "__luminousEncounterModifierWrapped")) return true;
    const original = engine.triggerPhase;
    const wrapped = function triggerPhaseWithEncounterModifiers(phaseTag, allUnits, ...rest) {
      const result = original.call(this, phaseTag, allUnits, ...rest);
      if (normalizeId(phaseTag) === "round_end") {
        const modifiers = this.encounterModifiers || global.encounterModifiers || state.modifiers;
        this.lastEncounterModifierTurnEnd = applyTurnEnd(modifiers, Array.isArray(allUnits) ? allUnits : [], {
          adjacencyByUnitId: this.adjacencyByUnitId || global.encounterAdjacencyByUnitId || null,
          adjacentSpaceIds: this.adjacentSpaceIds || global.encounterAdjacentSpaceIds || null,
        });
      }
      return result;
    };
    Object.defineProperty(wrapped, "__luminousEncounterModifierWrapped", { value: true });
    Object.defineProperty(wrapped, "__legacy", { value: original });
    engine.triggerPhase = wrapped;
    return true;
  }

  function install() {
    installCombatEngine();
    if (!global.document) return true;
    const retry = () => installCombatEngine();
    global.addEventListener?.("luminous:combat073-runtime-ready", retry);
    global.addEventListener?.("load", retry, { once: true });
    return true;
  }

  const api = Object.freeze({
    version: "1.0.0",
    WEB,
    state,
    normalizeModifier,
    affectedUnits,
    isWebWalker,
    applyWebTurnEnd,
    applyTurnEnd,
    webDetectionForUnit,
    functionChainHasMarker,
    setModifiers,
    addModifier,
    clearModifiers,
    getModifiers,
    installCombatEngine,
    install,
  });

  global.LuminousEncounterModifierRuntime = api;
  install();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
