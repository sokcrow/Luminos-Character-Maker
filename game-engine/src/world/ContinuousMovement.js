import { WORLD_SPACE_CONTRACT, worldUnitsToFeet } from "./WorldSpaceContract.js";
import { movementCostFeet, resolveTerrainMoveMultiplier } from "./TerrainMobility.js";

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const EPSILON = 1e-6;

function point(value = {}) {
  return { x: finite(value.x), y: finite(value.y), z: finite(value.z) };
}

function samePoint(a, b) {
  return Math.abs(a.x - b.x) <= EPSILON && Math.abs(a.y - b.y) <= EPSILON && Math.abs(a.z - b.z) <= EPSILON;
}

export function segmentDistanceWorld(a, b, { includeElevation = true } = {}) {
  const p0 = point(a), p1 = point(b);
  const dy = includeElevation ? p1.y - p0.y : 0;
  return Math.hypot(p1.x - p0.x, dy, p1.z - p0.z);
}

export function measureContinuousPath(path = [], {
  terrainSampler = null,
  sampleStepWorld = WORLD_SPACE_CONTRACT.scale.worldUnitsPerTile / 2,
  includeElevation = true,
  contract = WORLD_SPACE_CONTRACT
} = {}) {
  const points = Array.isArray(path) ? path.map(point) : [];
  if (points.length < 2) {
    return { ok: true, blocked: false, pathDistanceFt: 0, movementCostFt: 0, samples: [] };
  }

  let pathDistanceFt = 0;
  let movementCostFt = 0;
  const samples = [];
  const step = Math.max(0.05, finite(sampleStepWorld, contract.scale.worldUnitsPerTile / 2));

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1], to = points[index];
    const worldDistance = segmentDistanceWorld(from, to, { includeElevation });
    if (worldDistance <= EPSILON) continue;
    const slices = Math.max(1, Math.ceil(worldDistance / step));

    for (let slice = 0; slice < slices; slice += 1) {
      const t0 = slice / slices, t1 = (slice + 1) / slices, tm = (t0 + t1) / 2;
      const a = {
        x: from.x + (to.x - from.x) * t0,
        y: from.y + (to.y - from.y) * t0,
        z: from.z + (to.z - from.z) * t0
      };
      const b = {
        x: from.x + (to.x - from.x) * t1,
        y: from.y + (to.y - from.y) * t1,
        z: from.z + (to.z - from.z) * t1
      };
      const mid = {
        x: from.x + (to.x - from.x) * tm,
        y: from.y + (to.y - from.y) * tm,
        z: from.z + (to.z - from.z) * tm
      };
      const sample = terrainSampler ? (terrainSampler(mid) || {}) : {};
      const distanceFt = worldUnitsToFeet(segmentDistanceWorld(a, b, { includeElevation }), contract);
      const multiplier = resolveTerrainMoveMultiplier(sample);
      const costFt = movementCostFeet(distanceFt, sample);
      const record = { point: mid, distanceFt, costFt, moveMultiplier: multiplier, terrain: sample };
      samples.push(record);
      pathDistanceFt += distanceFt;
      movementCostFt += costFt;

      if (!Number.isFinite(costFt)) {
        return {
          ok: false,
          blocked: true,
          blockedAt: mid,
          pathDistanceFt,
          movementCostFt: Infinity,
          samples
        };
      }
    }
  }

  return { ok: true, blocked: false, pathDistanceFt, movementCostFt, samples };
}

export class CombatMovementTracker {
  constructor({ terrainSampler = null, contract = WORLD_SPACE_CONTRACT } = {}) {
    this.contract = contract;
    this.terrainSampler = terrainSampler;
    this.turn = null;
  }

  setTerrainSampler(terrainSampler = null) {
    this.terrainSampler = typeof terrainSampler === "function" ? terrainSampler : null;
    return this;
  }

  beginTurn({ unitId, start, movementFt }) {
    const origin = point(start);
    this.turn = {
      unitId: String(unitId || "unit"),
      origin,
      current: { ...origin },
      budgetFt: Math.max(0, finite(movementFt)),
      pathDistanceFt: 0,
      spentFt: 0
    };
    return this.snapshot();
  }

  evaluatePath(path = []) {
    if (!this.turn) return { ok: false, reason: "no_active_combat_turn" };
    const requested = Array.isArray(path) ? path.map(point) : [];
    if (!requested.length) requested.push({ ...this.turn.current });
    if (!samePoint(requested[0], this.turn.current)) requested.unshift({ ...this.turn.current });
    const measured = measureContinuousPath(requested, {
      terrainSampler: this.terrainSampler,
      contract: this.contract
    });
    if (!measured.ok) return { ...measured, reason: "blocked_terrain" };
    const remainingFt = Math.max(0, this.turn.budgetFt - this.turn.spentFt);
    const withinBudget = measured.movementCostFt <= remainingFt + EPSILON;
    return {
      ...measured,
      ok: withinBudget,
      reason: withinBudget ? null : "movement_budget_exceeded",
      remainingFt,
      end: requested[requested.length - 1]
    };
  }

  commitPath(path = []) {
    const result = this.evaluatePath(path);
    if (!result.ok) return result;
    this.turn.pathDistanceFt += result.pathDistanceFt;
    this.turn.spentFt += result.movementCostFt;
    this.turn.current = { ...result.end };
    return { ...result, committed: true, turn: this.snapshot() };
  }

  snapshot() {
    if (!this.turn) return null;
    return {
      ...this.turn,
      origin: { ...this.turn.origin },
      current: { ...this.turn.current },
      remainingFt: Math.max(0, this.turn.budgetFt - this.turn.spentFt)
    };
  }

  endTurn() {
    const snapshot = this.snapshot();
    this.turn = null;
    return snapshot;
  }
}
