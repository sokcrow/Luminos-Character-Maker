(function (root, factory) {
  "use strict";
  const Travel = typeof module !== "undefined" && module.exports
    ? require("./regional-travel-core.js")
    : root?.LuminousRegionalTravelCore;
  const api = factory(Travel);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.LuminousRegionalLocalTransitionCore = api;
})(typeof window !== "undefined" ? window : globalThis, function (Travel) {
  "use strict";

  if (!Travel) throw new Error("LUMINOUS_REGIONAL_TRAVEL_CORE_REQUIRED");

  const CONFIG = Object.freeze({
    schemaVersion: 1,
    chunkCols: 3,
    chunkRows: 3,
    chunkSizeCells: 40,
    cellSize: 70,
  });

  const SIDES = Object.freeze(["west", "southwest", "southeast", "east", "northeast", "northwest"]);
  const OPPOSITE = Object.freeze({
    west: "east",
    southwest: "northeast",
    southeast: "northwest",
    east: "west",
    northeast: "southwest",
    northwest: "southeast",
  });
  const EXIT_VECTOR = Object.freeze({
    west: Object.freeze([-1, 0]),
    southwest: Object.freeze([-1, 1]),
    southeast: Object.freeze([0, 1]),
    east: Object.freeze([1, 0]),
    northeast: Object.freeze([1, -1]),
    northwest: Object.freeze([0, -1]),
  });
  const ENTRY_ANCHOR = Object.freeze({
    west: Object.freeze({ chunkCol: 0, chunkRow: 1, cellCol: 0, cellRow: 20 }),
    southwest: Object.freeze({ chunkCol: 0, chunkRow: 2, cellCol: 10, cellRow: 39 }),
    southeast: Object.freeze({ chunkCol: 2, chunkRow: 2, cellCol: 29, cellRow: 39 }),
    east: Object.freeze({ chunkCol: 2, chunkRow: 1, cellCol: 39, cellRow: 20 }),
    northeast: Object.freeze({ chunkCol: 2, chunkRow: 0, cellCol: 29, cellRow: 0 }),
    northwest: Object.freeze({ chunkCol: 0, chunkRow: 0, cellCol: 10, cellRow: 0 }),
  });

  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integer = (value, fallback = 0) => Math.trunc(finite(value, fallback));
  const clean = (value, fallback = "") => String(value ?? fallback).trim() || fallback;
  const safeKey = (value, fallback = "") => clean(value, fallback).replace(/[.#$\[\]\/]/g, "_").replace(/\s+/g, "_").slice(0, 120) || fallback;

  function normalizeSide(value, fallback = null) {
    const side = clean(value).toLowerCase();
    return SIDES.includes(side) ? side : fallback;
  }

  function zoneIdForHex(rawHex = {}) {
    const hex = Travel.normalizeHex(rawHex);
    return `regional_${hex.q}_${hex.r}`;
  }

  function zoneSeedForHex(worldId, rawHex = {}) {
    const hex = Travel.normalizeHex(rawHex);
    return `${safeKey(worldId, "luminous")}:regional-zone:${hex.district}:${hex.q},${hex.r}`;
  }

  function anchorForSide(sideRaw, options = {}) {
    const side = normalizeSide(sideRaw);
    if (!side) throw new Error("REGIONAL_ENTRY_SIDE_REQUIRED");
    const chunkCols = Math.max(1, integer(options.chunkCols, CONFIG.chunkCols));
    const chunkRows = Math.max(1, integer(options.chunkRows, CONFIG.chunkRows));
    const chunkSizeCells = Math.max(1, integer(options.chunkSizeCells, CONFIG.chunkSizeCells));
    const midCol = Math.floor((chunkCols - 1) / 2), midRow = Math.floor((chunkRows - 1) / 2);
    const maxChunkCol = chunkCols - 1, maxChunkRow = chunkRows - 1, maxCell = chunkSizeCells - 1;
    const quarter = Math.max(0, Math.min(maxCell, Math.floor(chunkSizeCells * 0.25)));
    const threeQuarter = Math.max(0, Math.min(maxCell, Math.floor(chunkSizeCells * 0.75) - 1));
    const midCell = Math.max(0, Math.min(maxCell, Math.floor(chunkSizeCells / 2)));
    const anchors = {
      west: { chunkCol: 0, chunkRow: midRow, cellCol: 0, cellRow: midCell },
      southwest: { chunkCol: 0, chunkRow: maxChunkRow, cellCol: quarter, cellRow: maxCell },
      southeast: { chunkCol: maxChunkCol, chunkRow: maxChunkRow, cellCol: threeQuarter, cellRow: maxCell },
      east: { chunkCol: maxChunkCol, chunkRow: midRow, cellCol: maxCell, cellRow: midCell },
      northeast: { chunkCol: maxChunkCol, chunkRow: 0, cellCol: threeQuarter, cellRow: 0 },
      northwest: { chunkCol: 0, chunkRow: 0, cellCol: quarter, cellRow: 0 },
    };
    return Object.freeze({ side, ...anchors[side] });
  }

  function entryPosition(input = {}) {
    const regionalHex = Travel.normalizeHex(input.regionalHex || input.hex || input.destinationHex || {});
    const entrySide = normalizeSide(input.entrySide);
    if (!entrySide) throw new Error("REGIONAL_ENTRY_SIDE_REQUIRED");
    const cellSize = Math.max(1, finite(input.cellSize, CONFIG.cellSize));
    const chunkSizeCells = Math.max(1, integer(input.chunkSizeCells, CONFIG.chunkSizeCells));
    const anchor = anchorForSide(entrySide, {
      chunkCols: input.chunkCols,
      chunkRows: input.chunkRows,
      chunkSizeCells,
    });
    const x = (anchor.cellCol + 0.5) * cellSize;
    const y = (anchor.cellRow + 0.5) * cellSize;
    return Object.freeze({
      schemaVersion: CONFIG.schemaVersion,
      worldId: safeKey(input.worldId, "luminous"),
      regionId: regionalHex.district,
      zoneId: safeKey(input.zoneId, zoneIdForHex(regionalHex)),
      chunkCol: anchor.chunkCol,
      chunkRow: anchor.chunkRow,
      x,
      y,
      zLayer: integer(input.zLayer, 0),
      elevationFt: finite(input.elevationFt, 0),
      regionalHex: Object.freeze({ district: regionalHex.district, q: regionalHex.q, r: regionalHex.r }),
      entrySide,
      transitionMode: clean(input.transitionMode, "regional_to_local"),
      regionalGraphId: safeKey(input.regionalGraphId || input.graphId),
      regionalGraphRevision: Math.max(0, integer(input.regionalGraphRevision ?? input.graphRevision, 0)),
      regionalGraphFingerprint: safeKey(input.regionalGraphFingerprint || input.graphFingerprint),
      travelArrivalId: safeKey(input.travelArrivalId || input.arrivalId),
      arrivedAtWorldTs: Math.max(0, finite(input.arrivedAtWorldTs, 0)),
      transitionId: safeKey(input.transitionId),
    });
  }

  function targetHexForExit(rawHex = {}, sideRaw) {
    const source = Travel.normalizeHex(rawHex), side = normalizeSide(sideRaw);
    if (!side) return null;
    const vector = EXIT_VECTOR[side];
    return Object.freeze({ district: source.district, q: source.q + vector[0], r: source.r + vector[1] });
  }

  function oppositeSide(sideRaw) {
    const side = normalizeSide(sideRaw);
    return side ? OPPOSITE[side] : null;
  }

  function boundaryExitSide(input = {}) {
    const descriptor = input.descriptor || {};
    const active = descriptor.activeChunk || input.activeChunk || {};
    const chunkCols = Math.max(1, integer(descriptor.chunkCols, CONFIG.chunkCols));
    const chunkRows = Math.max(1, integer(descriptor.chunkRows, CONFIG.chunkRows));
    const col = integer(active.col ?? active.chunkCol, 0), row = integer(active.row ?? active.chunkRow, 0);
    const exit = input.exit || {};
    const dx = Math.sign(integer(exit.dx, 0)), dy = Math.sign(integer(exit.dy, 0));
    if (!dx && !dy) return null;
    const west = col <= 0 && dx < 0, east = col >= chunkCols - 1 && dx > 0;
    const north = row <= 0 && dy < 0, south = row >= chunkRows - 1 && dy > 0;
    if (north && west) return "northwest";
    if (north && east) return "northeast";
    if (south && west) return "southwest";
    if (south && east) return "southeast";
    if (west) return row <= 0 ? "northwest" : row >= chunkRows - 1 ? "southwest" : "west";
    if (east) return row <= 0 ? "northeast" : row >= chunkRows - 1 ? "southeast" : "east";
    if (north) {
      if (col < Math.floor(chunkCols / 2)) return "northwest";
      if (col > Math.floor((chunkCols - 1) / 2)) return "northeast";
      const width = Math.max(1, finite(exit.width, CONFIG.chunkSizeCells * CONFIG.cellSize));
      const x = finite(input.requestedPoint?.x, width / 2);
      return x < width / 2 ? "northwest" : "northeast";
    }
    if (south) {
      if (col < Math.floor(chunkCols / 2)) return "southwest";
      if (col > Math.floor((chunkCols - 1) / 2)) return "southeast";
      const width = Math.max(1, finite(exit.width, CONFIG.chunkSizeCells * CONFIG.cellSize));
      const x = finite(input.requestedPoint?.x, width / 2);
      return x < width / 2 ? "southwest" : "southeast";
    }
    return null;
  }

  function createLocalExitPlan(input = {}) {
    const sourcePosition = input.worldPosition || input.position || {};
    const sourceHex = Travel.normalizeHex(sourcePosition.regionalHex || input.regionalHex || {});
    const exitSide = normalizeSide(input.exitSide) || boundaryExitSide(input);
    if (!exitSide) return { valid: false, reason: "regional_exit_side_unresolved" };
    const targetHex = targetHexForExit(sourceHex, exitSide);
    if (!targetHex) return { valid: false, reason: "regional_target_unresolved" };
    const targetEntrySide = oppositeSide(exitSide);
    const transitionId = safeKey(input.transitionId || `regional_local_${sourceHex.district}_${sourceHex.q}_${sourceHex.r}_${targetHex.q}_${targetHex.r}_${exitSide}`);
    const targetPosition = entryPosition({
      worldId: sourcePosition.worldId || input.worldId,
      regionalHex: targetHex,
      entrySide: targetEntrySide,
      cellSize: input.cellSize,
      chunkCols: input.chunkCols,
      chunkRows: input.chunkRows,
      chunkSizeCells: input.chunkSizeCells,
      zLayer: sourcePosition.zLayer,
      elevationFt: sourcePosition.elevationFt,
      regionalGraphId: sourcePosition.regionalGraphId || input.regionalGraphId,
      regionalGraphRevision: sourcePosition.regionalGraphRevision ?? input.regionalGraphRevision,
      regionalGraphFingerprint: sourcePosition.regionalGraphFingerprint || input.regionalGraphFingerprint,
      transitionMode: "local_to_regional_to_local",
      transitionId,
    });
    return {
      valid: true,
      transitionId,
      sourceHex,
      targetHex,
      exitSide,
      targetEntrySide,
      targetPosition,
      targetZone: Object.freeze({
        zoneId: targetPosition.zoneId,
        seed: zoneSeedForHex(targetPosition.worldId, targetHex),
        chunkCols: Math.max(1, integer(input.chunkCols, CONFIG.chunkCols)),
        chunkRows: Math.max(1, integer(input.chunkRows, CONFIG.chunkRows)),
        activeChunk: Object.freeze({ col: targetPosition.chunkCol, row: targetPosition.chunkRow }),
      }),
    };
  }

  function sameRegionalHex(aRaw = {}, bRaw = {}) {
    const a = Travel.normalizeHex(aRaw), b = Travel.normalizeHex(bRaw);
    return a.district === b.district && a.q === b.q && a.r === b.r;
  }

  return Object.freeze({
    CONFIG,
    SIDES,
    OPPOSITE,
    EXIT_VECTOR,
    ENTRY_ANCHOR,
    normalizeSide,
    zoneIdForHex,
    zoneSeedForHex,
    anchorForSide,
    entryPosition,
    targetHexForExit,
    oppositeSide,
    boundaryExitSide,
    createLocalExitPlan,
    sameRegionalHex,
  });
});
