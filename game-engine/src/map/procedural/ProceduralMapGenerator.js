import { createHydrologyField } from "./ProceduralHydrology.js";
import { normalizeProceduralMapSpec } from "./ProceduralMapSpec.js";
import { createTerrainField } from "./ProceduralTerrain.js";

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createProceduralMapData(input = {}) {
  const spec = normalizeProceduralMapSpec(input);
  const hydrology = createHydrologyField(spec);
  const terrain = createTerrainField(spec);

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
    seed: spec.seed,
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
        seed: spec.seed,
        kind: spec.kind,
        bounds: spec.bounds,
        hydrology: hydrology.type,
        metadata: { ...spec.metadata }
      };
    }
  });
}

export function createProceduralMapDefinition(input = {}) {
  const spec = normalizeProceduralMapSpec(input);
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
