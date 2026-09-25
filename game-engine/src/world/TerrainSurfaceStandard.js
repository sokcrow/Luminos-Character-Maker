import { TERRAIN_SLOPE_STANDARD, terrainSlopeBand } from "./TerrainMobility.js";

export const TERRAIN_SURFACE_STANDARD = Object.freeze({
  thresholds: TERRAIN_SLOPE_STANDARD,
  materials: Object.freeze({
    temperate: Object.freeze({ transition: "dirtGround", rock: "stoneGround" }),
    forest: Object.freeze({ transition: "dirtGround", rock: "stoneGround" }),
    grassland: Object.freeze({ transition: "dirtGround", rock: "stoneGround" }),
    desert: Object.freeze({ transition: "gravelGround", rock: "stoneGround" }),
    swamp: Object.freeze({ transition: "mudGround", rock: "stoneGround" }),
    arctic: Object.freeze({ transition: "gravelGround", rock: "stoneGround" }),
  }),
});

const profileKey = (value) => {
  const key = String(value || "temperate").toLowerCase();
  return TERRAIN_SURFACE_STANDARD.materials[key] ? key : "temperate";
};

export function terrainSurfaceTierForSlope(slopeDeg = 0) {
  const band = terrainSlopeBand(slopeDeg);
  if (band === "blocked" || band === "steep") return "rock";
  if (band === "incline") return "transition";
  return "base";
}

export function terrainSurfaceMaterialKinds({
  biomeProfile = "temperate",
  baseKind = "forestGround",
} = {}) {
  const profile = TERRAIN_SURFACE_STANDARD.materials[profileKey(biomeProfile)];
  return Object.freeze({
    base: String(baseKind || "forestGround"),
    transition: profile.transition,
    rock: profile.rock,
  });
}

export function terrainSurfaceMaterialKind({
  biomeProfile = "temperate",
  baseKind = "forestGround",
  slopeDeg = 0,
} = {}) {
  const kinds = terrainSurfaceMaterialKinds({ biomeProfile, baseKind });
  return kinds[terrainSurfaceTierForSlope(slopeDeg)];
}

export default Object.freeze({
  TERRAIN_SURFACE_STANDARD,
  terrainSurfaceTierForSlope,
  terrainSurfaceMaterialKinds,
  terrainSurfaceMaterialKind,
});
