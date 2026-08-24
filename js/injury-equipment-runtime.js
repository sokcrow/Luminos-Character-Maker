(function (global) {
  "use strict";

  if (global.LuminousInjuryEquipmentRuntime) return;

  const PATCH_INTERVAL_MS = 300;
  const COMBATANTS_PATH = "campaña/combate/combatants";
  const state = {
    trackedUnits: new Set(),
    listenersBound: false,
    firebaseBound: false,
    combatantsSeen: null,
    combatBonusSource: null,
    playerSignatures: typeof WeakMap === "function" ? new WeakMap() : null,
    timer: null,
  };

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function trackUnit(unit) {
    if (unit && typeof unit === "object") state.trackedUnits.add(unit);
    return unit;
  }

  function activeInjuries(unit) {
    return Array.isArray(unit?.injuries) ? unit.injuries.filter((injury) => injury && injury.active !== false) : [];
  }

  function missingEyePerceptionCompensation(unit, skillUsed) {
    const skill = normalizeId(skillUsed);
    if (!["perception", "percepcion"].includes(skill)) return 0;
    return activeInjuries(unit)
      .filter((injury) => normalizeId(injury.catalogId || injury.id) === "missing_eye")
      .reduce((sum, injury) => sum - Math.min(0, numberOr(injury.effects?.visualCheckPenalty, 0)), 0);
  }

  function syncCombatStatsMaxHp(unit) {
    if (!unit || !unit.combatStats || typeof unit.combatStats !== "object") return null;
    const stats = unit.combatStats;
    const key = Object.prototype.hasOwnProperty.call(stats, "hp_max") ? "hp_max"
      : Object.prototype.hasOwnProperty.call(stats, "max_hp") ? "max_hp"
        : Object.prototype.hasOwnProperty.call(stats, "maxHp") ? "maxHp" : "hp_max";
    const current = Math.max(1, numberOr(stats[key], unit.effectiveMaxHp || unit.maxHp || 1));
    const penalty = Math.max(0, numberOr(unit.injuryMaxHpPenaltyPct, 0));

    if (penalty > 0) {
      if (!Number.isFinite(Number(unit.injuryHealthBaseCombatStatsMaxHp))) unit.injuryHealthBaseCombatStatsMaxHp = current;
      const base = Math.max(1, numberOr(unit.injuryHealthBaseCombatStatsMaxHp, current));
      const effective = Math.max(1, Math.floor(base * (1 - penalty)));
      stats[key] = effective;
      if (Number.isFinite(Number(stats.hp_actual))) stats.hp_actual = Math.min(Number(stats.hp_actual), effective);
      return { baseMaxHp: base, effectiveMaxHp: effective, penaltyPct: penalty, key };
    }

    if (Number.isFinite(Number(unit.injuryHealthBaseCombatStatsMaxHp))) {
      stats[key] = Math.max(1, Number(unit.injuryHealthBaseCombatStatsMaxHp));
      delete unit.injuryHealthBaseCombatStatsMaxHp;
    }
    return { baseMaxHp: Number(stats[key]), effectiveMaxHp: Number(stats[key]), penaltyPct: 0, key };
  }

  function itemIdentity(item, fallback = null) {
    return String(item?.key || item?.id || item?.itemId || item?.item_id || fallback || "").trim();
  }

  function objectValuesWithKeys(container) {
    if (!container) return [];
    if (Array.isArray(container)) return container.map((item, index) => ({ key: itemIdentity(item, index), item }));
    if (typeof container !== "object") return [];
    return Object.entries(container).map(([key, item]) => ({ key, item }));
  }

  function clearOriginalEquippedState(unit, droppedItem) {
    const wanted = itemIdentity(droppedItem);
    if (!wanted || !unit) return false;
    let changed = false;
    [unit.equipment, unit.activeInventory, unit.inventory, unit.inventario, unit.items].forEach((container) => {
      objectValuesWithKeys(container).forEach(({ key, item }) => {
        if (!item || typeof item !== "object") return;
        if (itemIdentity(item, key) !== wanted) return;
        item.equipped = false;
        item.equipped_slot = null;
        item.equippedSlot = null;
        item.equippedPartIds = [];
        item.assignedBodyParts = [];
        changed = true;
      });
    });
    return changed;
  }

  function syncLootDropsBackToSource(unit) {
    const pool = Array.isArray(global.LuminousCombatLootPool) ? global.LuminousCombatLootPool : [];
    let changed = 0;
    pool.forEach((item) => { if (clearOriginalEquippedState(unit, item)) changed += 1; });
    return changed;
  }

  function currentPlayer() {
    return global.LuminousPlayerTraitRuntime?.getCharacter?.() || global.datosJugador || null;
  }

  function playerSignature(unit) {
    if (!unit) return "";
    const injuries = activeInjuries(unit).map((injury) => [
      injury.instanceId || injury.id,
      injury.remainingRecoveryHours,
      injury.severity,
      injury.slotEffect,
      (injury.affectedParts || []).join(","),
    ]);
    return JSON.stringify([injuries, unit.injuryState?.downCount || 0]);
  }

  function syncKnownPlayer() {
    const engine = global.LuminousInjuryEngine;
    const unit = currentPlayer();
    if (!engine || !unit) return false;
    trackUnit(unit);
    const signature = playerSignature(unit);
    if (state.playerSignatures && state.playerSignatures.get(unit) === signature) return true;
    state.playerSignatures?.set(unit, signature);
    engine.ensureState?.(unit);
    engine.syncDerivedState?.(unit, { persist: false });
    syncCombatStatsMaxHp(unit);
    syncLootDropsBackToSource(unit);
    return true;
  }

  function patchCombatPerception() {
    const combat = global.CombatEngine;
    if (!combat || !combat.__luminousInjuryWrapped || typeof combat.calculateDndBonus !== "function") return false;
    if (combat.calculateDndBonus.__luminousMonocularCompensation) return true;
    const source = combat.calculateDndBonus;
    const wrapped = function (unit, statUsed, skillUsed) {
      return numberOr(source.call(this, unit, statUsed, skillUsed), 0) + missingEyePerceptionCompensation(unit, skillUsed);
    };
    wrapped.__luminousMonocularCompensation = true;
    wrapped.__luminousSource = source;
    combat.calculateDndBonus = wrapped;
    state.combatBonusSource = wrapped;
    return true;
  }

  function finalizeTrackedEncounter() {
    const engine = global.LuminousInjuryEngine;
    if (!engine?.finalizeEncounter) return [];
    const units = [...state.trackedUnits].filter((unit) => unit?.injuryState?.encounter?.active === true);
    if (!units.length) return [];
    return engine.finalizeEncounter(units);
  }

  function bindFirebaseCombatEnd() {
    if (state.firebaseBound) return true;
    const db = global.firebase?.database?.();
    if (!db) return false;
    const ref = db.ref(COMBATANTS_PATH);
    if (!ref?.on) return false;
    state.firebaseBound = true;
    ref.on("value", (snapshot) => {
      const data = snapshot?.val?.() || {};
      const count = Object.keys(data).length;
      if (state.combatantsSeen != null && state.combatantsSeen > 0 && count === 0) finalizeTrackedEncounter();
      state.combatantsSeen = count;
    });
    return true;
  }

  function bindEvents() {
    if (state.listenersBound || typeof global.addEventListener !== "function") return false;
    state.listenersBound = true;
    [
      "luminous:stagger-threshold-crossed",
      "luminous:downed",
      "luminous:unit-dead",
      "luminous:unit-revived",
    ].forEach((name) => global.addEventListener(name, (event) => trackUnit(event?.detail?.unit)));

    global.addEventListener("luminous:injury-state-changed", (event) => {
      const unit = trackUnit(event?.detail?.unit);
      if (!unit) return;
      syncCombatStatsMaxHp(unit);
      syncLootDropsBackToSource(unit);
      state.playerSignatures?.set(unit, playerSignature(unit));
    });
    return true;
  }

  function install() {
    bindEvents();
    bindFirebaseCombatEnd();
    patchCombatPerception();
    syncKnownPlayer();
    return true;
  }

  const api = Object.freeze({
    trackUnit,
    activeInjuries,
    missingEyePerceptionCompensation,
    syncCombatStatsMaxHp,
    clearOriginalEquippedState,
    syncLootDropsBackToSource,
    syncKnownPlayer,
    patchCombatPerception,
    finalizeTrackedEncounter,
    bindFirebaseCombatEnd,
    bindEvents,
    install,
  });

  global.LuminousInjuryEquipmentRuntime = api;
  install();
  if (typeof global.setInterval === "function") {
    state.timer = global.setInterval(install, PATCH_INTERVAL_MS);
    if (typeof state.timer?.unref === "function") state.timer.unref();
  }
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
