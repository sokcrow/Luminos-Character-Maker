import { WORLD_SPACE_CONTRACT, worldUnitsToFeet } from "./WorldSpaceContract.js";

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const pos = (entity = {}) => entity.position || entity;

export function centerDistanceWorld(a, b) {
  const pa = pos(a), pb = pos(b);
  return Math.hypot(finite(pb.x) - finite(pa.x), finite(pb.z) - finite(pa.z));
}

export function footprintDistanceFeet(a, b, { contract = WORLD_SPACE_CONTRACT } = {}) {
  const center = centerDistanceWorld(a, b);
  const radii = Math.max(0, finite(a?.radiusWorld)) + Math.max(0, finite(b?.radiusWorld));
  return worldUnitsToFeet(Math.max(0, center - radii), contract);
}

export function oppositionAngleDegrees(target, attackerA, attackerB) {
  const t = pos(target), a = pos(attackerA), b = pos(attackerB);
  const ax = finite(a.x) - finite(t.x), az = finite(a.z) - finite(t.z);
  const bx = finite(b.x) - finite(t.x), bz = finite(b.z) - finite(t.z);
  const al = Math.hypot(ax, az), bl = Math.hypot(bx, bz);
  if (al <= 1e-6 || bl <= 1e-6) return 0;
  const dot = Math.max(-1, Math.min(1, (ax * bx + az * bz) / (al * bl)));
  return Math.acos(dot) * 180 / Math.PI;
}

export function evaluateFlankingGeometry(target, attackerA, attackerB, { minOppositionAngleDeg = null } = {}) {
  const oppositionAngleDeg = oppositionAngleDegrees(target, attackerA, attackerB);
  const result = { oppositionAngleDeg };
  if (Number.isFinite(Number(minOppositionAngleDeg))) {
    result.meetsOppositionThreshold = oppositionAngleDeg >= Number(minOppositionAngleDeg);
  }
  return result;
}
