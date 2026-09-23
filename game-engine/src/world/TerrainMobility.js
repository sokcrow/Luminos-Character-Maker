export const DIFFICULT_TERRAIN_MOVE_MULTIPLIER = 0.5;

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const tagsOf = (sample) => new Set(Array.isArray(sample?.tags) ? sample.tags.map(String) : []);

export function resolveTerrainMoveMultiplier(sample = {}) {
  if (sample?.walkable === false || sample?.blocked === true) return 0;
  let multiplier = Math.max(0.01, finite(sample?.moveMultiplier, 1));
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
