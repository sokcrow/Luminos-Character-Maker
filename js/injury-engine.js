(function (global) {
  "use strict";

  if (global.LuminousInjuryEngine) return;

  const anatomyEngine = global.LuminousAnatomyEquipmentEngine || (typeof require === "function" ? require("./anatomy-equipment-engine.js") : null);
  const PATCH_INTERVAL_MS = 250;
  const DOWNS_PER_MODERATE = 3;
  const SEVERE_MAX_HP_PENALTY = 0.05;
  const MAX_SEVERE_HP_PENALTY = 0.20;
  const PLAYER_ROOT = "campaña/jugadores";
  const SEVERITY_RANK = Object.freeze({ light: 1, moderate: 2, severe: 3 });

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const CATALOG = Object.freeze({
    combat_bruising: Object.freeze({
      id: "combat_bruising", name: "Combat Bruising", severity: "light", recoveryHours: 4,
      effects: Object.freeze({ physicalCheckPenalty: -1 }),
    }),
    cut_hand: Object.freeze({
      id: "cut_hand", name: "Cut Hand", severity: "light", recoveryHours: 3,
      effects: Object.freeze({ physicalCheckPenalty: -1 }),
    }),
    sprained_wrist: Object.freeze({
      id: "sprained_wrist", name: "Sprained Wrist", severity: "light", recoveryHours: 4,
      effects: Object.freeze({ physicalCheckPenalty: -1 }),
    }),
    sprained_ankle: Object.freeze({
      id: "sprained_ankle", name: "Sprained Ankle", severity: "light", recoveryHours: 6,
      effects: Object.freeze({ speed: -1, physicalCheckPenalty: -1 }),
    }),
    minor_concussion: Object.freeze({
      id: "minor_concussion", name: "Minor Concussion", severity: "light", recoveryHours: 8,
      effects: Object.freeze({ mentalCheckPenalty: -1 }),
    }),

    accumulated_trauma: Object.freeze({
      id: "accumulated_trauma", name: "Accumulated Trauma", severity: "moderate", recoveryHours: 24,
      effects: Object.freeze({ physicalCheckPenalty: -2 }),
    }),
    deep_wound: Object.freeze({
      id: "deep_wound", name: "Deep Wound", severity: "moderate", recoveryHours: 18,
      effects: Object.freeze({ physicalCheckPenalty: -2 }),
    }),
    dislocated_shoulder: Object.freeze({
      id: "dislocated_shoulder", name: "Dislocated Shoulder", severity: "moderate", recoveryHours: 24,
      effects: Object.freeze({ physicalCheckPenalty: -2 }),
    }),
    cracked_ribs: Object.freeze({
      id: "cracked_ribs", name: "Cracked Ribs", severity: "moderate", recoveryHours: 48,
      effects: Object.freeze({ physicalCheckPenalty: -2 }),
    }),
    damaged_knee: Object.freeze({
      id: "damaged_knee", name: "Damaged Knee", severity: "moderate", recoveryHours: 36,
      effects: Object.freeze({ speed: -1, evade_power: -2, physicalCheckPenalty: -2 }),
    }),
    moderate_concussion: Object.freeze({
      id: "moderate_concussion", name: "Moderate Concussion", severity: "moderate", recoveryHours: 24,
      effects: Object.freeze({ mentalCheckPenalty: -2 }),
    }),

    severe_trauma: Object.freeze({
      id: "severe_trauma", name: "Severe Body Trauma", severity: "severe", recoveryHours: 120,
      effects: Object.freeze({ physicalCheckPenalty: -3 }),
    }),
    broken_arm: Object.freeze({
      id: "broken_arm", name: "Broken Arm", severity: "severe", recoveryHours: 168, slotEffect: "disabled",
      effects: Object.freeze({ physicalCheckPenalty: -3 }),
    }),
    broken_leg: Object.freeze({
      id: "broken_leg", name: "Broken Leg", severity: "severe", recoveryHours: 240, slotEffect: "disabled",
      effects: Object.freeze({ speed: -3, evade_power: -6, physicalCheckPenalty: -3 }),
    }),
    damaged_lung: Object.freeze({
      id: "damaged_lung", name: "Damaged Lung", severity: "severe", recoveryHours: 168,
      effects: Object.freeze({ physicalCheckPenalty: -3 }),
    }),
    damaged_eye: Object.freeze({
      id: "damaged_eye", name: "Damaged Eye", severity: "severe", recoveryHours: 96, slotEffect: "disabled",
      effects: Object.freeze({ visualCheckPenalty: -3 }),
    }),
    missing_eye: Object.freeze({
      id: "missing_eye", name: "Missing Eye", severity: "severe", recoveryHours: null, structural: true, slotEffect: "missing",
      effects: Object.freeze({ visualCheckPenalty: -2 }),
    }),
    missing_hand: Object.freeze({
      id: "missing_hand", name: "Missing Hand", severity: "severe", recoveryHours: null, structural: true, slotEffect: "missing",
      effects: Object.freeze({ physicalCheckPenalty: -3 }),
    }),
    missing_arm: Object.freeze({
      id: "missing_arm", name: "Missing Arm", severity: "severe", recoveryHours: null, structural: true, slotEffect: "missing",
      effects: Object.freeze({ physicalCheckPenalty: -3 }),
    }),
    missing_foot: Object.freeze({
      id: "missing_foot", name: "Missing Foot", severity: "severe", recoveryHours: null, structural: true, slotEffect: "missing",
      effects: Object.freeze({ speed: -1, evade_power: -2, physicalCheckPenalty: -3 }),
    }),
    missing_leg: Object.freeze({
      id: "missing_leg", name: "Missing Leg", severity: "severe", recoveryHours: null, structural: true, slotEffect: "missing",
      effects: Object.freeze({ speed: -3, evade_power: -6, physicalCheckPenalty: -3 }),
    }),
    missing_organ: Object.freeze({
      id: "missing_organ", name: "Missing Organ", severity: "severe", recoveryHours: null, structural: true,
      effects: Object.freeze({ physicalCheckPenalty: -3 }),
    }),
  });

  const state = {
    trackedUnits: new Set(),
    nextInstanceId: 1,
    listenersBound: false,
    combatSource: null,
    patchTimer: null,
  };

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function unitIds(unit = {}) {
    return [unit.id, unit.unitId, unit.unit_id, unit.characterId, unit.character_id, unit.playerId, unit.player_id, unit.uid]
      .filter((value) => value != null && String(value).trim() !== "").map((value) => String(value).trim());
  }

  function sameUnitId(unit, wanted) {
    if (!wanted) return true;
    return unitIds(unit).includes(String(wanted).trim());
  }

  function ensureEncounterState(unit) {
    const injuryState = ensureState(unit);
    if (!injuryState.encounter || typeof injuryState.encounter !== "object") {
      injuryState.encounter = { active: false, naturalStaggerCrossed: false, highestAutoRank: 0, autoInjuryIds: [] };
    }
    if (!Array.isArray(injuryState.encounter.autoInjuryIds)) injuryState.encounter.autoInjuryIds = [];
    return injuryState.encounter;
  }

  function ensureState(unit) {
    if (!unit || typeof unit !== "object") return null;
    if (!Array.isArray(unit.injuries)) unit.injuries = [];
    if (!unit.injuryState || typeof unit.injuryState !== "object") unit.injuryState = {};
    unit.injuryState.downCount = Math.max(0, Math.trunc(numberOr(unit.injuryState.downCount, 0)));
    unit.injuryState.currentlyDownedCounted = unit.injuryState.currentlyDownedCounted === true;
    state.trackedUnits.add(unit);
    return unit.injuryState;
  }

  function definition(injuryId) {
    const id = normalizeId(injuryId);
    return CATALOG[id] ? clone(CATALOG[id]) : null;
  }

  function activeInjuries(unit) {
    ensureState(unit);
    return unit.injuries.filter((injury) => injury && injury.active !== false);
  }

  function severityRank(value) {
    return SEVERITY_RANK[normalizeId(value)] || 0;
  }

  function normalizeInjury(input, options = {}) {
    const raw = typeof input === "string" ? (definition(input) || { id: normalizeId(input), name: String(input) }) : clone(input || {});
    const base = definition(raw.catalogId || raw.id) || {};
    const merged = { ...base, ...raw, ...clone(options.overrides || {}) };
    const severity = normalizeId(merged.severity || "light");
    const catalogId = normalizeId(base.id || merged.catalogId || merged.id || "custom_injury");
    const recovery = merged.recoveryHours == null ? null : Math.max(0, numberOr(merged.recoveryHours, 0));
    const instanceId = merged.instanceId || `injury_${Date.now()}_${state.nextInstanceId++}`;
    const affectedParts = asArray(merged.affectedParts || merged.bodyPart || merged.partId).map(normalizeId).filter(Boolean);
    return {
      instanceId,
      catalogId,
      id: catalogId,
      name: merged.name || base.name || catalogId,
      severity: SEVERITY_RANK[severity] ? severity : "light",
      structural: merged.structural === true,
      slotEffect: normalizeId(merged.slotEffect || merged.anatomyState || "") || null,
      affectedParts,
      bodyPart: affectedParts[0] || null,
      recoveryHours: recovery,
      remainingRecoveryHours: recovery,
      effects: { ...(base.effects || {}), ...(merged.effects || {}) },
      source: normalizeId(options.source || merged.source || "system"),
      auto: options.auto === true || merged.auto === true,
      encounterGenerated: options.encounterGenerated === true || merged.encounterGenerated === true,
      createdAt: options.createdAt || Date.now(),
      active: true,
      metadata: clone(merged.metadata || {}),
    };
  }

  function severePenaltyPct(unit) {
    const severeCount = activeInjuries(unit).filter((injury) => normalizeId(injury.severity) === "severe").length;
    return Math.min(MAX_SEVERE_HP_PENALTY, severeCount * SEVERE_MAX_HP_PENALTY);
  }

  function syncMaxHp(unit) {
    if (!unit) return { penaltyPct: 0, baseMaxHp: 0, effectiveMaxHp: 0 };
    const penaltyPct = severePenaltyPct(unit);
    const currentMax = Math.max(1, numberOr(unit.maxHp ?? unit.max_hp ?? unit.combatStats?.maxHp ?? unit.combatStats?.max_hp, 1));

    if (penaltyPct > 0) {
      if (!Number.isFinite(Number(unit.injuryHealthBaseMaxHp))) unit.injuryHealthBaseMaxHp = currentMax;
      const baseMaxHp = Math.max(1, numberOr(unit.injuryHealthBaseMaxHp, currentMax));
      const effectiveMaxHp = Math.max(1, Math.floor(baseMaxHp * (1 - penaltyPct)));
      unit.injuryMaxHpPenaltyPct = penaltyPct;
      unit.effectiveMaxHp = effectiveMaxHp;
      if (Object.prototype.hasOwnProperty.call(unit, "maxHp")) unit.maxHp = effectiveMaxHp;
      else if (Object.prototype.hasOwnProperty.call(unit, "max_hp")) unit.max_hp = effectiveMaxHp;
      if (Number.isFinite(Number(unit.hp))) unit.hp = Math.min(Number(unit.hp), effectiveMaxHp);
      return { penaltyPct, baseMaxHp, effectiveMaxHp };
    }

    const baseMaxHp = Math.max(1, numberOr(unit.injuryHealthBaseMaxHp, currentMax));
    if (Number.isFinite(Number(unit.injuryHealthBaseMaxHp))) {
      if (Object.prototype.hasOwnProperty.call(unit, "maxHp")) unit.maxHp = baseMaxHp;
      else if (Object.prototype.hasOwnProperty.call(unit, "max_hp")) unit.max_hp = baseMaxHp;
    }
    unit.injuryMaxHpPenaltyPct = 0;
    unit.effectiveMaxHp = baseMaxHp;
    delete unit.injuryHealthBaseMaxHp;
    return { penaltyPct: 0, baseMaxHp, effectiveMaxHp: baseMaxHp };
  }

  function defaultLootPool() {
    if (!Array.isArray(global.LuminousCombatLootPool)) global.LuminousCombatLootPool = [];
    return global.LuminousCombatLootPool;
  }

  function syncAnatomyAndEquipment(unit, options = {}) {
    if (!unit || !anatomyEngine) return null;
    const anatomy = anatomyEngine.resolveCharacterAnatomy(unit);
    unit.anatomyRuntime = anatomy;
    const items = options.items || anatomyEngine.collectEquippedItems(unit);
    const validation = anatomyEngine.revalidateEquipment(unit, items, {
      anatomy,
      lootPool: options.lootPool || defaultLootPool(),
      onDropToLoot: options.onDropToLoot,
    });
    validation.assignments.forEach((assignment) => {
      if (assignment.item && typeof assignment.item === "object") assignment.item.equippedPartIds = [...assignment.partIds];
    });
    return { anatomy, validation };
  }

  function persistPlayerState(unit) {
    try {
      const db = global.firebase?.database?.();
      if (!db) return null;
      const id = String(unit?.playerId || unit?.player_id || global.localStorage?.getItem?.("playerId") || "").trim();
      if (!id) return null;
      const updates = {
        injuries: clone(unit.injuries || []),
        injuryState: clone(unit.injuryState || {}),
        injuryMaxHpPenaltyPct: numberOr(unit.injuryMaxHpPenaltyPct, 0),
      };
      const promise = db.ref(`${PLAYER_ROOT}/${id}`).update(updates);
      promise?.catch?.((error) => console.warn("Injury persistence:", error));
      return promise;
    } catch (_) {
      return null;
    }
  }

  function syncDerivedState(unit, options = {}) {
    const health = syncMaxHp(unit);
    const equipment = syncAnatomyAndEquipment(unit, options);
    emit("luminous:injury-state-changed", { unit, injuries: clone(activeInjuries(unit)), health, equipment });
    if (options.persist !== false) persistPlayerState(unit);
    return { health, equipment };
  }

  function gainInjury(unit, input, options = {}) {
    if (!unit) return { gained: false, reason: "missing_unit" };
    ensureState(unit);
    const injury = normalizeInjury(input, options);
    unit.injuries.push(injury);
    const derived = syncDerivedState(unit, options);
    const result = { gained: true, unit, injury: clone(injury), derived };
    emit("luminous:injury-gained", result);
    return result;
  }

  function findInjuryIndex(unit, injuryRef) {
    ensureState(unit);
    const wanted = normalizeId(typeof injuryRef === "object" ? (injuryRef.instanceId || injuryRef.id || injuryRef.catalogId) : injuryRef);
    return unit.injuries.findIndex((injury) => normalizeId(injury.instanceId) === wanted || normalizeId(injury.catalogId || injury.id) === wanted);
  }

  function removeInjury(unit, injuryRef, options = {}) {
    const index = findInjuryIndex(unit, injuryRef);
    if (index < 0) return { removed: false, reason: "not_found", unit };
    const [removed] = unit.injuries.splice(index, 1);
    const encounter = ensureEncounterState(unit);
    encounter.autoInjuryIds = encounter.autoInjuryIds.filter((id) => id !== removed.instanceId);
    const derived = syncDerivedState(unit, options);
    const result = { removed: true, unit, injury: removed, derived, reason: options.reason || "removed" };
    emit("luminous:injury-removed", result);
    return result;
  }

  function replaceInjury(unit, injuryRef, replacement, options = {}) {
    const index = findInjuryIndex(unit, injuryRef);
    if (index < 0) return { replaced: false, reason: "not_found", unit };
    const previous = unit.injuries[index];
    const next = normalizeInjury(replacement, {
      ...options,
      source: options.source || previous.source,
      overrides: { ...(options.overrides || {}), createdAt: previous.createdAt },
    });
    next.createdAt = previous.createdAt;
    next.auto = previous.auto;
    next.encounterGenerated = previous.encounterGenerated;
    unit.injuries[index] = next;
    syncDerivedState(unit, options);
    emit("luminous:injury-replaced", { unit, previous: clone(previous), injury: clone(next) });
    return { replaced: true, unit, previous, injury: next };
  }

  function gainAutomaticInjury(unit, severity, detail = {}) {
    const encounter = ensureEncounterState(unit);
    const rank = severityRank(severity);
    if (rank <= 0) return { gained: false, reason: "invalid_severity" };
    if (encounter.highestAutoRank >= rank) return { gained: false, reason: "equal_or_higher_auto_injury_already_generated", unit };

    const lowerAuto = new Set(encounter.autoInjuryIds);
    unit.injuries = unit.injuries.filter((injury) => !(lowerAuto.has(injury.instanceId) && severityRank(injury.severity) < rank));
    encounter.autoInjuryIds = encounter.autoInjuryIds.filter((id) => unit.injuries.some((injury) => injury.instanceId === id));

    const fallbackId = severity === "light" ? "combat_bruising" : severity === "moderate" ? "accumulated_trauma" : "severe_trauma";
    const injuryInput = detail.injury || detail.injuryId || fallbackId;
    const overrides = {
      ...(typeof injuryInput === "object" ? injuryInput : {}),
      severity,
      affectedParts: detail.affectedParts || detail.bodyPart || (typeof injuryInput === "object" ? injuryInput.affectedParts : undefined),
      slotEffect: detail.slotEffect || (typeof injuryInput === "object" ? injuryInput.slotEffect : undefined),
      structural: detail.structural ?? (typeof injuryInput === "object" ? injuryInput.structural : undefined),
      metadata: { ...(typeof injuryInput === "object" ? injuryInput.metadata : {}), trigger: detail.trigger || null },
    };
    const baseInput = typeof injuryInput === "string" ? { ...(definition(injuryInput) || { id: injuryInput }), ...overrides } : overrides;
    const result = gainInjury(unit, baseInput, { source: detail.source || "automatic", auto: true, encounterGenerated: true });
    if (result.gained) {
      encounter.highestAutoRank = rank;
      encounter.autoInjuryIds.push(result.injury.instanceId);
    }
    return result;
  }

  function beginEncounter(units = []) {
    asArray(units).forEach((unit) => {
      if (!unit) return;
      const encounter = ensureEncounterState(unit);
      encounter.active = true;
      encounter.naturalStaggerCrossed = false;
      encounter.highestAutoRank = 0;
      encounter.autoInjuryIds = [];
    });
    return units;
  }

  function markNaturalStagger(unit, detail = {}) {
    if (!unit) return null;
    const encounter = ensureEncounterState(unit);
    encounter.active = true;
    encounter.naturalStaggerCrossed = true;
    emit("luminous:stagger-threshold-crossed", { unit, natural: true, ...detail });
    return encounter;
  }

  function finalizeEncounter(units = []) {
    const results = [];
    asArray(units).forEach((unit) => {
      if (!unit) return;
      const encounter = ensureEncounterState(unit);
      let light = null;
      if (encounter.naturalStaggerCrossed && encounter.highestAutoRank < SEVERITY_RANK.light) {
        light = gainAutomaticInjury(unit, "light", { trigger: "stagger_threshold", source: "encounter_end" });
      }
      results.push({ unit, light, highestAutoRank: encounter.highestAutoRank });
      encounter.active = false;
      encounter.naturalStaggerCrossed = false;
      encounter.highestAutoRank = 0;
      encounter.autoInjuryIds = [];
    });
    emit("luminous:injury-encounter-finalized", { results });
    return results;
  }

  function handleDown(unit, detail = {}) {
    if (!unit) return { counted: false, reason: "missing_unit" };
    const injuryState = ensureState(unit);
    if (injuryState.currentlyDownedCounted) return { counted: false, reason: "same_down_already_counted", unit };
    injuryState.currentlyDownedCounted = true;
    injuryState.downCount += 1;
    let moderate = null;
    if (injuryState.downCount >= DOWNS_PER_MODERATE) {
      injuryState.downCount -= DOWNS_PER_MODERATE;
      moderate = gainAutomaticInjury(unit, "moderate", {
        trigger: "down_count",
        source: "downs",
        injuryId: detail.injuryId,
        bodyPart: detail.bodyPart,
      });
    }
    persistPlayerState(unit);
    emit("luminous:injury-down-count-changed", { unit, downCount: injuryState.downCount, moderate });
    return { counted: true, unit, downCount: injuryState.downCount, moderate };
  }

  function clearCurrentDown(unit) {
    const injuryState = ensureState(unit);
    if (!injuryState) return null;
    injuryState.currentlyDownedCounted = false;
    return injuryState;
  }

  function handleDeath(unit, detail = {}) {
    if (!unit) return { gained: false, reason: "missing_unit" };
    return gainAutomaticInjury(unit, "severe", {
      trigger: "death",
      source: detail.reason || "death",
      injury: detail.injury,
      injuryId: detail.injuryId,
      bodyPart: detail.bodyPart,
      affectedParts: detail.affectedParts,
      slotEffect: detail.slotEffect,
      structural: detail.structural,
    });
  }

  function resetDownCount(unit, options = {}) {
    const injuryState = ensureState(unit);
    if (!injuryState) return null;
    injuryState.downCount = 0;
    injuryState.currentlyDownedCounted = false;
    if (options.persist !== false) persistPlayerState(unit);
    emit("luminous:injury-down-count-reset", { unit, reason: options.reason || "long_rest" });
    return injuryState;
  }

  function advanceRecovery(unit, hours, options = {}) {
    if (!unit) return [];
    ensureState(unit);
    const elapsed = Math.max(0, numberOr(hours, 0));
    if (!elapsed) return [];
    const progressed = [];
    const completed = [];

    unit.injuries.forEach((injury) => {
      if (!injury || injury.active === false || injury.structural === true || injury.remainingRecoveryHours == null) return;
      const before = Math.max(0, numberOr(injury.remainingRecoveryHours, 0));
      injury.remainingRecoveryHours = Math.max(0, before - elapsed);
      progressed.push({ instanceId: injury.instanceId, before, after: injury.remainingRecoveryHours });
      if (injury.remainingRecoveryHours <= 0) completed.push(injury.instanceId);
    });
    completed.forEach((instanceId) => removeInjury(unit, instanceId, { reason: "natural_recovery", persist: false }));
    if (progressed.length) {
      syncDerivedState(unit, { ...options, persist: false });
      if (options.persist !== false) persistPlayerState(unit);
      emit("luminous:injury-recovery-progress", { unit, hours: elapsed, progressed, completed });
    }
    return progressed;
  }

  function treatInjury(unit, injuryRef, treatment = {}) {
    const index = findInjuryIndex(unit, injuryRef);
    if (index < 0) return { treated: false, reason: "not_found", unit };
    const injury = unit.injuries[index];
    const method = normalizeId(treatment.method || "treatment");
    const canCureStructural = treatment.allowStructural === true || ["regeneration", "replacement", "body_replacement", "dante_clock"].includes(method);

    if (treatment.cure === true || treatment.remove === true) {
      if (injury.structural && !canCureStructural) return { treated: false, reason: "structural_requires_regeneration_or_replacement", unit, injury };
      const removed = removeInjury(unit, injury.instanceId, { reason: method });
      return { treated: removed.removed, cured: removed.removed, unit, injury: removed.injury };
    }
    if (injury.structural) return { treated: false, reason: "structural_has_no_natural_recovery_timer", unit, injury };

    const before = Math.max(0, numberOr(injury.remainingRecoveryHours, 0));
    let after = before;
    if (Number.isFinite(Number(treatment.reduceHours))) after -= Math.max(0, Number(treatment.reduceHours));
    if (Number.isFinite(Number(treatment.reducePercent))) after *= Math.max(0, 1 - Number(treatment.reducePercent) / 100);
    if (Number.isFinite(Number(treatment.multiplier))) after *= Math.max(0, Number(treatment.multiplier));
    injury.remainingRecoveryHours = Math.max(0, after);
    if (injury.remainingRecoveryHours <= 0) {
      const removed = removeInjury(unit, injury.instanceId, { reason: method });
      return { treated: true, cured: true, unit, injury: removed.injury, before, after: 0 };
    }
    syncDerivedState(unit);
    const result = { treated: true, cured: false, unit, injury: clone(injury), before, after: injury.remainingRecoveryHours };
    emit("luminous:injury-treated", result);
    return result;
  }

  function clearForDanteClock(unit) {
    if (!unit) return { cleared: false, reason: "missing_unit" };
    ensureState(unit);
    const removed = unit.injuries.splice(0, unit.injuries.length);
    resetDownCount(unit, { persist: false, reason: "dante_clock" });
    const encounter = ensureEncounterState(unit);
    encounter.active = false;
    encounter.naturalStaggerCrossed = false;
    encounter.highestAutoRank = 0;
    encounter.autoInjuryIds = [];
    const derived = syncDerivedState(unit);
    const result = { cleared: true, unit, removed, derived };
    emit("luminous:dante-clock-injuries-cleared", result);
    return result;
  }

  const MODIFIER_CHANNELS = Object.freeze([
    "damage_dealt_multiplier", "damage_taken_multiplier", "healing_multiplier", "final_power", "base_power",
    "defense_power", "counter_power", "evade_power", "guard_power", "clash_power", "offensive_level",
    "defensive_level", "speed", "min_speed", "max_speed", "resource", "coin_power", "crit_damage_multiplier",
  ]);

  function collectModifiers(unit) {
    const modifiers = Object.fromEntries(MODIFIER_CHANNELS.map((channel) => [channel, 0]));
    activeInjuries(unit).forEach((injury) => {
      MODIFIER_CHANNELS.forEach((channel) => {
        modifiers[channel] += numberOr(injury.effects?.[channel], 0);
      });
    });
    return modifiers;
  }

  function checkPenalty(unit, statUsed, skillUsed) {
    const stat = normalizeId(statUsed);
    const skill = normalizeId(skillUsed);
    const physicalStats = new Set(["str", "strength", "fuerza", "dex", "dexterity", "destreza", "con", "constitution", "constitucion"]);
    const mentalStats = new Set(["int", "intelligence", "inteligencia", "wis", "wisdom", "sabiduria", "cha", "charisma", "carisma"]);
    let penalty = 0;
    activeInjuries(unit).forEach((injury) => {
      if (physicalStats.has(stat)) penalty += numberOr(injury.effects?.physicalCheckPenalty, 0);
      if (mentalStats.has(stat)) penalty += numberOr(injury.effects?.mentalCheckPenalty, 0);
      if (["perception", "percepcion"].includes(skill)) penalty += numberOr(injury.effects?.visualCheckPenalty, 0);
    });
    return penalty;
  }

  function wrapCombatEngine(source) {
    if (!source || source.__luminousInjuryWrapped) return source;
    if (typeof source.checkStagger === "function") {
      const original = source.checkStagger;
      source.checkStagger = function (unit, ...args) {
        const before = Array.isArray(unit?.crossedThresholds) ? [...unit.crossedThresholds] : [];
        const forced = unit?.isForcedStagger === true || unit?.forcedStagger === true || unit?.staggerForced === true;
        const result = original.call(this, unit, ...args);
        const after = Array.isArray(unit?.crossedThresholds) ? unit.crossedThresholds : [];
        const crossed = after.map((value, index) => Boolean(value) && !Boolean(before[index])).filter(Boolean).length;
        if (crossed > 0 && !forced) markNaturalStagger(unit, { crossed });
        return result;
      };
    }
    if (typeof source.triggerEncounterStart === "function") {
      const original = source.triggerEncounterStart;
      source.triggerEncounterStart = function (units = [], ...args) {
        beginEncounter(units);
        return original.call(this, units, ...args);
      };
    }
    if (typeof source.initializeUnitData === "function") {
      const original = source.initializeUnitData;
      source.initializeUnitData = function (unit, ...args) {
        const result = original.call(this, unit, ...args);
        ensureState(unit);
        syncDerivedState(unit, { persist: false });
        return result;
      };
    }
    if (typeof source.applyPassiveModifiers === "function") {
      const original = source.applyPassiveModifiers;
      source.applyPassiveModifiers = function (unit, contextOptions = null) {
        const base = original.call(this, unit, contextOptions) || {};
        const injury = collectModifiers(unit);
        const merged = { ...base };
        MODIFIER_CHANNELS.forEach((channel) => { merged[channel] = numberOr(base[channel], 0) + numberOr(injury[channel], 0); });
        return merged;
      };
    }
    if (typeof source.calculateDndBonus === "function") {
      const original = source.calculateDndBonus;
      source.calculateDndBonus = function (unit, statUsed, skillUsed) {
        return numberOr(original.call(this, unit, statUsed, skillUsed), 0) + checkPenalty(unit, statUsed, skillUsed);
      };
    }
    if (typeof source.endEncounter === "function") {
      const original = source.endEncounter;
      source.endEncounter = function (units = [], ...args) {
        const result = original.call(this, units, ...args);
        finalizeEncounter(units);
        return result;
      };
    }
    source.__luminousInjuryWrapped = true;
    return source;
  }

  function installCombatBridge() {
    const source = global.CombatEngine;
    if (!source) return false;
    if (state.combatSource === source && source.__luminousInjuryWrapped) return true;
    state.combatSource = wrapCombatEngine(source);
    return true;
  }

  function eventUnits(detail = {}) {
    if (Array.isArray(detail.units)) return detail.units;
    if (detail.combatData && typeof detail.combatData === "object") return Object.values(detail.combatData);
    if (detail.unit) return [detail.unit];
    return [];
  }

  function bindEvents() {
    if (state.listenersBound || typeof global.addEventListener !== "function") return false;
    state.listenersBound = true;
    global.addEventListener("luminous:downed", (event) => handleDown(event?.detail?.unit, event?.detail || {}));
    ["luminous:unit-revived", "luminous:downed-stabilized-by-heal", "luminous:death-save-stabilized"].forEach((name) => {
      global.addEventListener(name, (event) => clearCurrentDown(event?.detail?.unit));
    });
    global.addEventListener("luminous:unit-dead", (event) => handleDeath(event?.detail?.unit, event?.detail || {}));
    global.addEventListener("luminous:rest-completed", (event) => {
      const detail = event?.detail || {};
      if (normalizeId(detail.type || detail.restType) === "long_rest") resetDownCount(detail.character, { reason: "long_rest" });
    });
    global.addEventListener("luminous:world-time-advance-requested", (event) => {
      const detail = event?.detail || {};
      const hours = Math.max(0, numberOr(detail.hours, 0));
      if (!hours) return;
      if (detail.character) advanceRecovery(detail.character, hours);
      else [...state.trackedUnits].filter((unit) => sameUnitId(unit, detail.characterId)).forEach((unit) => advanceRecovery(unit, hours));
    });
    ["luminous:encounter-end", "luminous:encounter-ended"].forEach((name) => {
      global.addEventListener(name, (event) => finalizeEncounter(eventUnits(event?.detail || {})));
    });
    global.addEventListener("luminous:dante-clock-windup", (event) => {
      eventUnits(event?.detail || {}).forEach((unit) => clearForDanteClock(unit));
    });
    return true;
  }

  function install() {
    bindEvents();
    installCombatBridge();
    if (typeof global.setInterval === "function" && !state.patchTimer) {
      state.patchTimer = global.setInterval(() => installCombatBridge(), PATCH_INTERVAL_MS);
      if (typeof state.patchTimer?.unref === "function") state.patchTimer.unref();
    }
    return true;
  }

  const api = Object.freeze({
    CATALOG,
    DOWNS_PER_MODERATE,
    SEVERE_MAX_HP_PENALTY,
    MAX_SEVERE_HP_PENALTY,
    normalizeId,
    definition,
    ensureState,
    activeInjuries,
    severePenaltyPct,
    syncMaxHp,
    syncAnatomyAndEquipment,
    syncDerivedState,
    gainInjury,
    removeInjury,
    replaceInjury,
    gainAutomaticInjury,
    beginEncounter,
    markNaturalStagger,
    finalizeEncounter,
    handleDown,
    clearCurrentDown,
    handleDeath,
    resetDownCount,
    advanceRecovery,
    treatInjury,
    clearForDanteClock,
    collectModifiers,
    checkPenalty,
    wrapCombatEngine,
    installCombatBridge,
    install,
  });

  global.LuminousInjuryEngine = api;
  install();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
