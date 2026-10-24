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

  // Field spaces are a side budget, independent of action slots and art tuning.
  const SIZE_PROFILES = Object.freeze(Object.fromEntries(Object.entries({
    tiny: [0.5, 0.55], small: [1, 0.8], medium: [1, 1],
    large: [1, 1.35], huge: [2, 1.85], gargantuan: [3, 2.5],
  }).map(([size, [spaces, spriteScale]]) => [size, Object.freeze({ size, spaces, spriteScale, hudScale: size === 'tiny' ? 0.75 : 1 })])));

  function sizeOf(unit = {}) {
    const raw = normalizeId(String(unit.size || unit.unitSize || unit.unit_size || unit.creatureSize ||
      unit.creature_size || unit.mechanics?.size || unit.bodyProfile?.sizeClass || 'medium').normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const aliases = { diminuto: 'tiny', minusculo: 'tiny', pequeno: 'small', mediano: 'medium',
      grande: 'large', enorme: 'huge', gigantesco: 'gargantuan', gargantuesco: 'gargantuan' };
    return SIZE_PROFILES[raw] ? raw : aliases[raw] || 'medium';
  }

  function isSummon(unit = {}) {
    return unit.isSummon === true || unit.isBackgroundUnit === true ||
      ['summon', 'background_unit'].includes(normalizeId(unit.kind)) ||
      normalizeId(unit.unitType) === 'summon';
  }

  function sizeProfile(unit = {}) { return SIZE_PROFILES[sizeOf(unit)]; }
  function fieldSpace(unit = {}) { return isSummon(unit) ? 0 : sizeProfile(unit).spaces; }

  // Pack larger bodies first. Tiny pairs share a cell, with distinct anchors.
  // Extra depth rows also keep legacy over-cap encounters visible without stacking.
  function formationPoints(units = [], side = 'ally') {
    const points = {}, rows = [], summons = [], placements = [];
    const ordered = units.map((unit, index) => ({ unit, index, spaces: fieldSpace(unit) }))
      .sort((a, b) => b.spaces - a.spaces || a.index - b.index);
    for (const { unit, spaces } of ordered) {
      if (!spaces) { summons.push(unit); continue; }
      const halves = spaces * 2;
      let chosen = null;
      if (halves === 1) {
        for (let row = 0; row < rows.length && !chosen; row++) {
          for (let cell = 0; cell < 8; cell++) {
            if (rows[row]?.[cell] === false && rows[row]?.[cell ^ 1] === true) {
              chosen = { row, cell }; break;
            }
          }
        }
      }
      // Columns first preserves the familiar two-row zigzag for normal bodies.
      for (let cell = 0; cell < 8 && !chosen; cell++) {
        for (let row = 0; row < Math.max(2, rows.length) && !chosen; row++) {
          const occupied = rows[row] || Array(8).fill(false);
          if (cell + halves <= 8 && occupied.slice(cell, cell + halves).every(value => !value)) {
            chosen = { row, cell }; rows[row] = occupied;
          }
        }
      }
      if (!chosen) { chosen = { row: rows.length, cell: 0 }; rows.push(Array(8).fill(false)); }
      const { row, cell } = chosen;
      rows[row].fill(true, cell, cell + halves);
      const x = 10 + ((cell + halves / 2) / 2 - 0.5) * 9;
      placements.push({ unit, x, row });
    }
    const rowGap = rows.length > 2 ? 30 / (rows.length - 1) : 24;
    placements.forEach(({ unit, x, row }) => {
      points[unitId(unit)] = { x: side === 'enemy' ? 100 - x : x, y: 18 + row * rowGap };
    });
    summons.forEach((unit, index) => {
      const x = 10 + (index % 6) * 5.4;
      points[unitId(unit)] = { x: side === 'enemy' ? 100 - x : x,
        y: 56 + Math.floor(index / 6) * 6 };
    });
    return points;
  }

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

  function fieldSpaceUsed(combatants = {}, side) {
    const wanted = normalizeId(side).startsWith('enem') ? 'enemy' : 'ally';
    return fieldEntries(combatants).filter(({ unit }) => sideOf(unit) === wanted)
      .reduce((total, { unit }) => total + fieldSpace(unit), 0);
  }

  function canEnterField(combatants = {}, side, cap = FIELD_CAP_PER_SIDE, incoming = {}) {
    const spaces = fieldSpace(incoming);
    return spaces === 0 || fieldSpaceUsed(combatants, side) + spaces <= Math.max(1, finiteInt(cap, FIELD_CAP_PER_SIDE));
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

  function nextBackup(reserves = {}, side, combatants = null) {
    return sortedBackupEntries(reserves, side).find(({ unit }) =>
      !combatants || canEnterField(combatants, side, FIELD_CAP_PER_SIDE, unit)) || null;
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
    SIZE_PROFILES, sizeOf, sizeProfile, isSummon, fieldSpace, fieldSpaceUsed, formationPoints,
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
