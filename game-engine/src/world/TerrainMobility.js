export const DIFFICULT_TERRAIN_MOVE_MULTIPLIER = 0.5;

export const TERRAIN_SLOPE_STANDARD = Object.freeze({
  normalDeg: 24,
  difficultDeg: 34,
  maxWalkDeg: 43,
  // Compatibility alias for Lab code that previously owned this rule locally.
  maxClimbDeg: 43,
  sampleTiles: 0.24,
  inclineMultiplier: 0.82,
  steepMultiplier: 0.68,
});

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const tagsOf = (sample) => new Set(Array.isArray(sample?.tags) ? sample.tags.map(String) : []);

export function terrainSlopeBand(slopeDeg = 0, rules = TERRAIN_SLOPE_STANDARD) {
  const angle = Math.max(0, finite(slopeDeg, 0));
  if (angle > finite(rules.maxWalkDeg, 43)) return "blocked";
  if (angle > finite(rules.difficultDeg, 34)) return "steep";
  if (angle > finite(rules.normalDeg, 24)) return "incline";
  return "normal";
}

export function resolveTerrainSlopeTraversal(sample = {}, rules = TERRAIN_SLOPE_STANDARD) {
  const tags = tagsOf(sample);
  const slopeDeg = Math.max(0, finite(sample?.slopeDeg, 0));
  const band = terrainSlopeBand(slopeDeg, rules);
  const climbable = sample?.climbable === true || tags.has("climbable");
  // Being climbable does not silently turn a wall into normal walking terrain.
  // Explicit climbing systems may opt in with allowSteepTraversal.
  const blocked = band === "blocked" && sample?.allowSteepTraversal !== true;
  let moveMultiplier = 1;
  if (band === "incline") moveMultiplier = finite(rules.inclineMultiplier, .82);
  else if (band === "steep") moveMultiplier = finite(rules.steepMultiplier, .68);
  else if (band === "blocked") moveMultiplier = sample?.allowSteepTraversal === true
    ? finite(rules.steepMultiplier, .68)
    : 0;
  return Object.freeze({ slopeDeg, band, climbable, blocked, moveMultiplier });
}

export function resolveTerrainMoveMultiplier(sample = {}) {
  if (sample?.walkable === false || sample?.blocked === true) return 0;
  const slope = resolveTerrainSlopeTraversal(sample);
  if (slope.blocked) return 0;

  let multiplier = Math.max(0.01, finite(sample?.moveMultiplier, 1));
  multiplier = Math.min(multiplier, slope.moveMultiplier || 1);

  const tags = tagsOf(sample);
  if (sample?.difficultTerrain === true || tags.has("difficult")) {
    multiplier = Math.min(multiplier, DIFFICULT_TERRAIN_MOVE_MULTIPLIER);
  }
  return multiplier;
}

export function movementCostFeet(distanceFeet, sample = {}) {
  const distance = Math.max(0, finite(distanceFeet, 0));
  const multiplier = resolveTerrainMoveMultiplier(sample);
  if (multiplier <= 0) return Infinity;
  return distance / multiplier;
}
