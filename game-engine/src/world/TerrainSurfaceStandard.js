import { TERRAIN_SLOPE_STANDARD, terrainSlopeBand } from "./TerrainMobility.js";

const surfaceProfile = (base, transition, rock) => Object.freeze({ base, transition, rock });

export const TERRAIN_SURFACE_STANDARD = Object.freeze({
  thresholds: TERRAIN_SLOPE_STANDARD,
  defaultProfile: "temperate",
  materials: Object.freeze({
    temperate: surfaceProfile("forestGround", "dirtGround", "stoneGround"),
    forest: surfaceProfile("forestGround", "dirtGround", "stoneGround"),
    grassland: surfaceProfile("grasslandGround", "dirtGround", "stoneGround"),
    desert: surfaceProfile("desertGround", "gravelGround", "stoneGround"),
    swamp: surfaceProfile("swampGround", "mudGround", "stoneGround"),
    arctic: surfaceProfile("arcticGround", "gravelGround", "stoneGround"),
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

export default Object.freeze({
  TERRAIN_SURFACE_STANDARD,
  terrainSurfaceProfileKey,
  terrainSurfaceProfile,
  terrainSurfaceTierForSlope,
  terrainSurfaceMaterialKinds,
  terrainSurfaceMaterialKind,
});
