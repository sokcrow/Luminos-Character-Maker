(function (global) {
  "use strict";

  if (global.LuminousCombatDeploymentRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCombatDeploymentRuntime;
    return;
  }

  const FIELD_CAP_PER_SIDE = 8;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value ?? "").trim();
  const finiteInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function unitId(unit = {}, fallback = "") {
    return clean(unit.id ?? unit.combatId ?? unit.instanceId ?? unit.unitId ?? unit.characterId ?? unit.actorId ?? fallback);
  }

  function sideOf(unit = {}) {
    const faction = normalizeId(unit.faction ?? unit.faccion ?? unit.side ?? unit.team);
    if (["enemy", "enemies", "hostile", "boss", "enemigo", "enemigos"].includes(faction)) return "enemy";
    if (["ally", "allies", "friendly", "player", "players", "aliado", "aliados"].includes(faction)) return "ally";
    const category = normalizeId(unit.actorCategory ?? unit.category ?? unit.type ?? unit.kind);
    if (["enemy", "enemies", "hostile", "boss", "monster", "monstruo"].includes(category)) return "enemy";
    return "ally";
  }

  function deploymentState(unit = {}) {
    if (unit.defeated === true || unit.dead === true || unit.isDead === true) return "defeated";
    if (unit.escaped === true) return "escaped";
    if (unit.isBackup === true || unit.battleActive === false) return "backup";
    const raw = normalizeId(unit.deploymentState ?? unit.deployment ?? unit.positionState ?? unit.zone ?? "field");
    if (["reserve", "reserves"].includes(raw)) return "backup";
    if (["dead", "defeat", "defeated", "neutralized", "neutralised"].includes(raw)) return "defeated";
    if (["escape", "escaped", "departed"].includes(raw)) return "escaped";
    if (["retreat", "retreated"].includes(raw)) return "backup";
    return raw || "field";
  }

  function isField(unit = {}) {
    return deploymentState(unit) === "field" && unit.battleActive !== false && unit.isBackup !== true && unit.removed !== true;
  }

  function isBackup(unit = {}) {
    return deploymentState(unit) === "backup";
  }

  function isDefeated(unit = {}) {
    return deploymentState(unit) === "defeated" || (Number.isFinite(Number(unit.hp)) && Number(unit.hp) <= 0);
  }

  function isEscaped(unit = {}) {
    return deploymentState(unit) === "escaped";
  }

  function markField(unit = {}, options = {}) {
    const next = clone(unit) || {};
    next.isBackup = false;
    next.battleActive = true;
    next.deployment = "field";
    next.deploymentState = "field";
    next.removed = false;
    next.retreated = false;
    next.escaped = false;
    next.defeated = false;
    next.dead = false;
    if (options.round != null) next.enteredFieldRound = Math.max(1, finiteInt(options.round, 1));
    if (options.reason) next.fieldEntryReason = clean(options.reason);
    return next;
  }

  function markBackup(unit = {}, options = {}) {
    const next = clone(unit) || {};
    next.isBackup = true;
    next.battleActive = false;
    next.deployment = "backup";
    next.deploymentState = "backup";
    next.removed = false;
    next.escaped = false;
    next.defeated = false;
    next.dead = false;
    next.retreated = options.reason === "retreat" || next.retreated === true;
    if (Number.isFinite(Number(options.queueOrder))) next.backupQueueOrder = Number(options.queueOrder);
    if (options.round != null) next.enteredBackupRound = Math.max(1, finiteInt(options.round, 1));
    if (options.reason) next.backupReason = clean(options.reason);
    return next;
  }

  function markDefeated(unit = {}, options = {}) {
    const next = clone(unit) || {};
    next.hp = Math.max(0, Number.isFinite(Number(next.hp)) ? Number(next.hp) : 0);
    next.isBackup = false;
    next.battleActive = false;
    next.deployment = "defeated";
    next.deploymentState = "defeated";
    next.defeated = true;
    next.dead = next.dead === true || next.isDead === true || next.hp <= 0;
    next.removed = true;
    next.retreated = false;
    next.escaped = false;
    next.resolutionState = "defeated";
    next.lootEligible = options.lootEligible !== false;
    next.formerDeployment = "field";
    if (options.round != null) next.defeatedRound = Math.max(1, finiteInt(options.round, 1));
    if (options.reason) next.defeatReason = clean(options.reason);
    return next;
  }

  function markEscaped(unit = {}, options = {}) {
    const next = clone(unit) || {};
    next.isBackup = false;
    next.battleActive = false;
    next.deployment = "escaped";
    next.deploymentState = "escaped";
    next.escaped = true;
    next.removed = true;
    next.retreated = false;
    next.lootEligible = false;
    next.xpPolicy = "none";
    next.resolutionState = "escaped";
    next.formerDeployment = "field";
    if (options.round != null) next.escapedRound = Math.max(1, finiteInt(options.round, 1));
    if (options.reason) next.escapeReason = clean(options.reason);
    return next;
  }

  function fieldEntries(combatants = {}, side = null) {
    return Object.entries(combatants || {})
      .filter(([, unit]) => unit && typeof unit === "object" && isField(unit))
      .filter(([, unit]) => !side || sideOf(unit) === normalizeId(side).replace(/ies$/, "y"))
      .map(([key, unit]) => ({ key, unit }));
  }

  function fieldCount(combatants = {}, side) {
    const wanted = normalizeId(side).startsWith("enem") ? "enemy" : "ally";
    return fieldEntries(combatants).filter((entry) => sideOf(entry.unit) === wanted).length;
  }

  function canEnterField(combatants = {}, side, cap = FIELD_CAP_PER_SIDE) {
    return fieldCount(combatants, side) < Math.max(1, finiteInt(cap, FIELD_CAP_PER_SIDE));
  }

  function queueOrder(unit = {}, fallback = 0) {
    const value = Number(unit.backupQueueOrder ?? unit.queueOrder ?? unit.reserveOrder);
    return Number.isFinite(value) ? value : fallback;
  }

  function sortedBackupEntries(reserves = {}, side = null) {
    const wanted = side ? (normalizeId(side).startsWith("enem") ? "enemy" : "ally") : null;
    return Object.entries(reserves || {})
      .filter(([, unit]) => unit && typeof unit === "object" && isBackup(unit))
      .filter(([, unit]) => !wanted || sideOf(unit) === wanted)
      .map(([key, unit], index) => ({ key, unit, order: queueOrder(unit, index + 1), index }))
      .sort((a, b) => (a.order - b.order) || (a.index - b.index) || String(a.key).localeCompare(String(b.key)));
  }

  function nextQueueOrder(reserves = {}, side, position = "back") {
    const entries = sortedBackupEntries(reserves, side);
    if (!entries.length) return 1;
    if (normalizeId(position) === "front") return entries[0].order - 1;
    return entries[entries.length - 1].order + 1;
  }

  function nextBackup(reserves = {}, side) {
    return sortedBackupEntries(reserves, side)[0] || null;
  }

  function inheritedActionSlots(outgoing = {}, incoming = {}, cap = 2) {
    const outgoingSlots = Math.max(1, finiteInt(
      outgoing.currentActionSlots ?? outgoing.activeSlots ?? outgoing.actionSlots ?? outgoing.actionSlotState?.current,
      1
    ));
    const incomingMax = Math.max(1, finiteInt(
      incoming.maxActionSlots ?? incoming.mechanics?.maxSlotsLimit ?? incoming.actionSlots ?? incoming.activeSlots,
      outgoingSlots
    ));
    return Math.max(1, Math.min(outgoingSlots, Math.max(1, finiteInt(cap, 2)), incomingMax));
  }

  function preparePromotion(unit = {}, outgoing = {}, options = {}) {
    const inherited = inheritedActionSlots(outgoing, unit, options.inheritActionSlotsCap ?? 2);
    const next = markField(unit, options);
    next.actionSlots = inherited;
    next.currentActionSlots = inherited;
    next.activeSlots = inherited;
    next.replacementActionSlots = inherited;
    next.replacementPendingPlanning = true;
    next.replacementFromUnitId = unitId(outgoing) || null;
    return next;
  }

  const api = Object.freeze({
    version: "1.0.0",
    FIELD_CAP_PER_SIDE,
    unitId,
    sideOf,
    deploymentState,
    isField,
    isBackup,
    isDefeated,
    isEscaped,
    markField,
    markBackup,
    markDefeated,
    markEscaped,
    fieldEntries,
    fieldCount,
    canEnterField,
    queueOrder,
    sortedBackupEntries,
    nextQueueOrder,
    nextBackup,
    inheritedActionSlots,
    preparePromotion,
  });

  global.LuminousCombatDeploymentRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
