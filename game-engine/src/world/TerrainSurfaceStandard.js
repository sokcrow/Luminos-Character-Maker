import { TERRAIN_SLOPE_STANDARD, terrainSlopeBand } from "./TerrainMobility.js";

const surfaceProfile = (base, transition, rock, shore = "beachGround") =>
  Object.freeze({ base, transition, rock, shore });

export const TERRAIN_SURFACE_STANDARD = Object.freeze({
  thresholds: TERRAIN_SLOPE_STANDARD,
  defaultProfile: "temperate",
  elevation: Object.freeze({
    baseFadeStartTiles: 0.85,
    baseFadeEndTiles: 2.05,
    rockGateStartTiles: 1.30,
    rockStartTiles: 2.30,
    rockFullTiles: 3.70,
    slopeTransitionInfluence: 0.58,
  }),
  materials: Object.freeze({
    temperate: surfaceProfile("forestGround", "dirtGround", "stoneGround"),
    forest: surfaceProfile("forestGround", "dirtGround", "stoneGround"),
    grassland: surfaceProfile("grasslandGround", "dirtGround", "stoneGround"),
    desert: surfaceProfile("desertGround", "gravelGround", "stoneGround"),
    swamp: surfaceProfile("swampGround", "mudGround", "stoneGround", "mudGround"),
    arctic: surfaceProfile("arcticGround", "gravelGround", "stoneGround", "gravelGround"),
  }),
});

export function terrainSurfaceProfileKey(value) {
  const key = String(value || TERRAIN_SURFACE_STANDARD.defaultProfile).toLowerCase();
  return TERRAIN_SURFACE_STANDARD.materials[key] ? key : TERRAIN_SURFACE_STANDARD.defaultProfile;
}

export function terrainSurfaceProfile(biomeProfile = TERRAIN_SURFACE_STANDARD.defaultProfile) {
  return TERRAIN_SURFACE_STANDARD.materials[terrainSurfaceProfileKey(biomeProfile)];
}

export function terrainSurfaceTierForSlope(slopeDeg = 0) {
  const band = terrainSlopeBand(slopeDeg);
  if (band === "blocked" || band === "steep") return "rock";
  if (band === "incline") return "transition";
  return "base";
}

function resolvedBaseKind({ biomeProfile, baseKind, baseOverride }) {
  const profileKey = terrainSurfaceProfileKey(biomeProfile);
  const profile = TERRAIN_SURFACE_STANDARD.materials[profileKey];
  const forced = String(baseOverride || "").trim();
  if (forced) return forced;

  const requested = String(baseKind ?? "").trim();
  if (!requested || requested === "auto" || requested === "biome") return profile.base;

  // The procedural terrain historically supplied forestGround as its default even
  // for non-temperate maps. Treat that legacy placeholder as "use this biome's base"
  // so the map's biome profile is authoritative without breaking authored overrides.
  if (requested === "forestGround" && profileKey !== "temperate" && profileKey !== "forest") {
    return profile.base;
  }
  return requested;
}

export function terrainSurfaceMaterialKinds({
  biomeProfile = TERRAIN_SURFACE_STANDARD.defaultProfile,
  baseKind = "auto",
  baseOverride = null,
} = {}) {
  const profile = terrainSurfaceProfile(biomeProfile);
  return Object.freeze({
    base: resolvedBaseKind({ biomeProfile, baseKind, baseOverride }),
    transition: profile.transition,
    rock: profile.rock,
  });
}

export function terrainSurfaceMaterialKind({
  biomeProfile = TERRAIN_SURFACE_STANDARD.defaultProfile,
  baseKind = "auto",
  baseOverride = null,
  slopeDeg = 0,
} = {}) {
  const kinds = terrainSurfaceMaterialKinds({ biomeProfile, baseKind, baseOverride });
  return kinds[terrainSurfaceTierForSlope(slopeDeg)];
}

const smooth01 = (value) => {
  const t = Math.max(0, Math.min(1, Number(value) || 0));
  return t * t * (3 - 2 * t);
};

export function terrainElevationSurfaceWeights({
  heightTiles = 0,
  baseHeightTiles = 0,
  slopeDeg = 0,
  elevation = TERRAIN_SURFACE_STANDARD.elevation,
  thresholds = TERRAIN_SURFACE_STANDARD.thresholds,
} = {}) {
  const rise = Math.max(0, (Number(heightTiles) || 0) - (Number(baseHeightTiles) || 0));
  const slope = Math.max(0, Number(slopeDeg) || 0);

  const baseStart = Number(elevation?.baseFadeStartTiles) || .85;
  const baseEnd = Math.max(baseStart + .01, Number(elevation?.baseFadeEndTiles) || 2.05);
  const rockGateStart = Number(elevation?.rockGateStartTiles) || 1.30;
  const rockStart = Math.max(rockGateStart + .01, Number(elevation?.rockStartTiles) || 2.30);
  const rockFull = Math.max(rockStart + .01, Number(elevation?.rockFullTiles) || 3.70);

  const normal = Number(thresholds?.normalDeg) || 24;
  const difficult = Math.max(normal + .01, Number(thresholds?.difficultDeg) || 34);
  const maxWalk = Math.max(difficult + .01, Number(thresholds?.maxWalkDeg) || 43);

  const elevationTransition = smooth01((rise - baseStart) / (baseEnd - baseStart));
  const elevationRock = smooth01((rise - rockStart) / (rockFull - rockStart));
  const slopeTransition = smooth01((slope - normal) / (difficult - normal));
  const slopeRock = smooth01((slope - difficult) / (maxWalk - difficult));

  // A steep low hill may expose dirt/gravel, but it does not become a stone
  // "mountain" until the terrain has actually gained meaningful elevation.
  const rockHeightGate = smooth01((rise - rockGateStart) / (rockStart - rockGateStart));
  const rock = 1 - (1 - elevationRock) * (1 - slopeRock * rockHeightGate);
  const transitionPressure = Math.max(
    elevationTransition,
    slopeTransition * Math.max(0, Math.min(1, Number(elevation?.slopeTransitionInfluence) || .58)),
  );
  const transition = Math.max(0, (1 - rock) * transitionPressure);
  const base = Math.max(0, 1 - rock - transition);
  const total = base + transition + rock || 1;

  return Object.freeze({
    base: base / total,
    transition: transition / total,
    rock: rock / total,
    relativeHeightTiles: rise,
  });
}

export function terrainCoastMaterialKinds({
  biomeProfile = TERRAIN_SURFACE_STANDARD.defaultProfile,
  baseKind = "auto",
  baseOverride = null,
} = {}) {
  const profile = terrainSurfaceProfile(biomeProfile);
  const inland = terrainSurfaceMaterialKinds({ biomeProfile, baseKind, baseOverride });
  return Object.freeze({
    shore: profile.shore || "beachGround",
    base: inland.base,
    transition: inland.transition,
    rock: inland.rock,
  });
}

export function terrainCoastSurfaceWeights({
  distanceTiles = 0,
  slopeDeg = 0,
  beachWidthTiles = 3.65,
  shoreBlendTiles = 2.25,
  thresholds = TERRAIN_SURFACE_STANDARD.thresholds,
} = {}) {
  const d = Number(distanceTiles) || 0;
  const slope = Math.max(0, Number(slopeDeg) || 0);
  const beach = Math.max(.05, Number(beachWidthTiles) || 3.65);
  const blend = Math.max(.05, Number(shoreBlendTiles) || 2.25);

  // Shore stays authoritative from underwater ground through the beach, then
  // dissolves continuously into the owning biome instead of creating a tile seam.
  const shoreT = smooth01((Math.max(0, d) - beach * .72) / blend);
  const shoreFactor = 1 - shoreT;

  const normal = Number(thresholds?.normalDeg) || 24;
  const difficult = Math.max(normal + .01, Number(thresholds?.difficultDeg) || 34);
  const maxWalk = Math.max(difficult + .01, Number(thresholds?.maxWalkDeg) || 43);

  const inclineRamp = smooth01((slope - normal) / (difficult - normal));
  const rock = smooth01((slope - difficult) / (maxWalk - difficult));
  const transition = inclineRamp * (1 - rock);
  const ground = Math.max(0, 1 - transition - rock);

  const weights = {
    shore: ground * shoreFactor,
    base: ground * (1 - shoreFactor),
    transition,
    rock,
  };
  const total = weights.shore + weights.base + weights.transition + weights.rock || 1;
  return Object.freeze({
    shore: weights.shore / total,
    base: weights.base / total,
    transition: weights.transition / total,
    rock: weights.rock / total,
  });
}

export default Object.freeze({
  TERRAIN_SURFACE_STANDARD,
  terrainSurfaceProfileKey,
  terrainSurfaceProfile,
  terrainSurfaceTierForSlope,
  terrainSurfaceMaterialKinds,
  terrainSurfaceMaterialKind,
  terrainElevationSurfaceWeights,
  terrainCoastMaterialKinds,
  terrainCoastSurfaceWeights,
});
