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
  // Slopes above maxWalkDeg are not walkable uphill, but a grounded actor must
  // still be able to escape them by sliding downhill instead of deadlocking.
  slideMultiplier: 0.74,
  slideSteer: 0.32,
  slideResponse: 9,
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
  const locomotion = String(sample?.locomotion || "ground");
  const slopeExempt = sample?.ignoreSlope === true || locomotion === "swim" || locomotion === "fly";
  const band = slopeExempt ? "normal" : terrainSlopeBand(slopeDeg, rules);
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

export function resolveTerrainSlopeSlide(sample = {}, rules = TERRAIN_SLOPE_STANDARD) {
  const locomotion = String(sample?.locomotion || "ground");
  const slopeExempt = sample?.ignoreSlope === true || locomotion === "swim" || locomotion === "fly";
  const slopeDeg = Math.max(0, finite(sample?.slopeDeg, 0));
  const hx = finite(sample?.hx, 0);
  const hz = finite(sample?.hz, 0);
  const gradient = Math.hypot(hx, hz);
  const active = !slopeExempt && slopeDeg > finite(rules.maxWalkDeg, 43) && gradient > 1e-6;
  const normalizedDownhill = (value) => {
    if (!active) return 0;
    const normalized = -value / gradient;
    return Object.is(normalized, -0) ? 0 : normalized;
  };
  return Object.freeze({
    active,
    slopeDeg,
    downhillX: normalizedDownhill(hx),
    downhillZ: normalizedDownhill(hz),
    speedMultiplier: active ? Math.max(0.01, finite(rules.slideMultiplier, .74)) : 0,
    steer: active ? Math.max(0, finite(rules.slideSteer, .32)) : 0,
    response: active ? Math.max(0.01, finite(rules.slideResponse, 9)) : 0,
  });
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
