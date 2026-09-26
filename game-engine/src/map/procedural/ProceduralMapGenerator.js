import { createHydrologyField } from "./ProceduralHydrology.js";
import { createTerrainField } from "./ProceduralTerrain.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeBounds(bounds = null) {
  if (!bounds) return null;
  const minX = finite(bounds.minX, -160);
  const maxX = finite(bounds.maxX, 160);
  const minZ = finite(bounds.minZ, -160);
  const maxZ = finite(bounds.maxZ, 160);
  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minZ: Math.min(minZ, maxZ),
    maxZ: Math.max(minZ, maxZ)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSpec(spec = {}) {
  const id = String(spec.id || "procedural-map").trim();
  if (!id) throw new Error("Procedural map requires a stable id");
  return {
    ...spec,
    id,
    kind: String(spec.kind || "procedural"),
    seed: spec.seed ?? id,
    bounds: normalizeBounds(spec.bounds),
    metadata: {
      authority: "map-module",
      generator: "ProceduralMapGenerator",
      ...(spec.metadata || {})
    }
  };
}

export function createProceduralMapData(input = {}) {
  const spec = normalizeSpec(input);
  const context = {
    ...spec,
    landform: spec.landform || {},
    hydrology: spec.hydrology || { type: "none" },
    moisture: finite(spec.moisture, 0.5),
    aridity: finite(spec.aridity, 0.5),
    altitude: finite(spec.altitude, 0),
    scale: Math.max(0.001, finite(spec.scale, 1))
  };
  const hydrology = createHydrologyField(context);
  const terrain = createTerrainField(context);

  function hydrologySample(point = {}) {
    return hydrology.sample(finite(point.x), finite(point.z));
  }

  function sampleWater(point = {}) {
    const sample = hydrologySample(point);
    if (!sample?.water) return null;
    return {
      bodyId: `${spec.id}:${hydrology.type}`,
      type: hydrology.type,
      class: sample.class,
      depth: sample.waterDepth,
      surface: sample.waterSurface,
      wetness: sample.wetness,
      current: sample.current,
      source: "procedural-map-module"
    };
  }

  function sampleTerrain(point = {}) {
    const waterField = hydrologySample(point);
    const sample = terrain.sample(point, waterField);
    return {
      ...sample,
      water: sampleWater(point)
    };
  }

  function resolveMovement({ proposed } = {}) {
    const next = {
      x: finite(proposed?.x),
      y: finite(proposed?.y),
      z: finite(proposed?.z)
    };
    if (spec.bounds) {
      next.x = clamp(next.x, spec.bounds.minX, spec.bounds.maxX);
      next.z = clamp(next.z, spec.bounds.minZ, spec.bounds.maxZ);
    }
    if (spec.snapToTerrain !== false) next.y = sampleTerrain(next).height;
    return next;
  }

  return Object.freeze({
    id: spec.id,
    seed: String(spec.seed),
    bounds: spec.bounds,
    metadata: { ...spec.metadata },
    terrain,
    hydrology,
    sampleTerrain,
    sampleWater,
    resolveMovement,
    update() {},
    snapshot() {
      return {
        id: spec.id,
        seed: String(spec.seed),
        kind: spec.kind,
        bounds: spec.bounds,
        hydrology: hydrology.type,
        metadata: { ...spec.metadata }
      };
    }
  });
}

export function createProceduralMapDefinition(input = {}) {
  const spec = normalizeSpec(input);
  return {
    id: spec.id,
    kind: spec.kind,
    seed: spec.seed,
    bounds: spec.bounds,
    metadata: { ...spec.metadata },
    async generate(context = {}) {
      return createProceduralMapData({
        ...spec,
        runtimeContext: {
          worldSpace: context.worldSpace?.id || context.worldSpace || null
        }
      });
    }
  };
}
