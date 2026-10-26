import { SeededRandom } from "./SeededRandom.js";

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizedBounds(bounds = null) {
  const source = bounds || {};
  const minX = finite(source.minX, -160);
  const maxX = finite(source.maxX, 160);
  const minZ = finite(source.minZ, -160);
  const maxZ = finite(source.maxZ, 160);
  return {
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minZ: Math.min(minZ, maxZ),
    maxZ: Math.max(minZ, maxZ)
  };
}

function landformWeights(context = {}) {
  return context.landform?.weights || context.landform || {};
}

export function hydrologyReliefScore(context = {}) {
  const weights = landformWeights(context);
  return Math.max(
    finite(weights.rolling),
    finite(weights.hills),
    finite(weights.ridges),
    finite(weights.mountain),
    finite(weights.cliffs),
    finite(weights.mesas)
  );
}

export function hydrologyCurvePoint(curve, t) {
  const [p0, p1, p2] = curve.points;
  const amount = clamp(t);
  const inverse = 1 - amount;
  return {
    x: inverse * inverse * p0.x + 2 * inverse * amount * p1.x + amount * amount * p2.x,
    z: inverse * inverse * p0.z + 2 * inverse * amount * p1.z + amount * amount * p2.z
  };
}

export function hydrologyCurveNearest(curve, x, z) {
  let best = { distance: Infinity, t: 0, x: 0, z: 0 };
  const steps = Math.max(48, Math.floor(curve.samples || 96));
  let previous = hydrologyCurvePoint(curve, 0);
  let previousT = 0;

  for (let index = 1; index <= steps; index += 1) {
    const t = index / steps;
    const next = hydrologyCurvePoint(curve, t);
    const vx = next.x - previous.x;
    const vz = next.z - previous.z;
    const lengthSquared = vx * vx + vz * vz;
    const amount = lengthSquared > 1e-8
      ? clamp(((x - previous.x) * vx + (z - previous.z) * vz) / lengthSquared)
      : 0;
    const px = previous.x + vx * amount;
    const pz = previous.z + vz * amount;
    const distance = Math.hypot(x - px, z - pz);
    const curveT = previousT + (t - previousT) * amount;
    if (distance < best.distance) best = { distance, t: curveT, x: px, z: pz };
    previous = next;
    previousT = t;
  }

  return best;
}

export function hydrologyRiverTangent(curve, t) {
  const [p0, p1, p2] = curve.points;
  const amount = clamp(t);
  const inverse = 1 - amount;
  let x = 2 * inverse * (p1.x - p0.x) + 2 * amount * (p2.x - p1.x);
  let z = 2 * inverse * (p1.z - p0.z) + 2 * amount * (p2.z - p1.z);
  const length = Math.hypot(x, z) || 1;
  x /= length;
  z /= length;
  return { x, z };
}

export function createRiverField(context = {}) {
  const seed = context.seed ?? "procedural-river";
  const rng = new SeededRandom(`${seed}:river-v1`);
  const bounds = normalizedBounds(context.bounds);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
  const scale = Math.max(0.01, finite(context.scale, 1));
  const extent = Math.hypot(width, depth) * 0.62;
  const relief = hydrologyReliefScore(context);
  const moisture = clamp(context.moisture);
  const altitude = finite(context.altitude);
  const angle = rng.range(-Math.PI, Math.PI);
  const dx = Math.cos(angle);
  const dz = Math.sin(angle);
  const nx = -dz;
  const nz = dx;
  const offsetLimit = Math.max(width, depth) * 0.08;
  const bendLimit = Math.max(width, depth) * 0.14;
  const startOffset = rng.range(-offsetLimit, offsetLimit);
  const endOffset = rng.range(-offsetLimit, offsetLimit);
  const bend = rng.range(-bendLimit, bendLimit);

  return Object.freeze({
    kind: "river",
    points: Object.freeze([
      Object.freeze({ x: centerX - dx * extent + nx * startOffset, z: centerZ - dz * extent + nz * startOffset }),
      Object.freeze({ x: centerX + nx * bend, z: centerZ + nz * bend }),
      Object.freeze({ x: centerX + dx * extent + nx * endOffset, z: centerZ + dz * extent + nz * endOffset })
    ]),
    samples: 128,
    halfWidth: (1.1 + moisture * 1.45 + relief * 0.55) * scale,
    bankWidth: (1.15 + moisture * 0.85) * scale,
    depth: (0.26 + moisture * 0.64 + relief * 0.32) * scale,
    waterSurface: altitude - (0.34 + relief * 0.18) * scale,
    currentStrength: 1 + relief * 0.9 + moisture * 0.4,
    phase: rng.range(0, Math.PI * 2)
  });
}

export function sampleRiverField(river, x, z) {
  const nearest = hydrologyCurveNearest(river, finite(x), finite(z));
  const wave = 0.91 + 0.09 * Math.sin(nearest.t * Math.PI * 5 + river.phase);
  const halfWidth = Math.max(0.35, river.halfWidth * wave);
  const signedDistance = nearest.distance - halfWidth;
  const water = signedDistance < 0;
  const center = clamp(1 - nearest.distance / halfWidth);
  const waterDepth = water ? Math.max(0.06, river.depth * Math.pow(center, 0.62)) : 0;
  const tangent = hydrologyRiverTangent(river, nearest.t);
  const wetness = clamp(1 - Math.max(0, signedDistance) / Math.max(0.1, river.bankWidth * 2.4));

  return {
    type: "river",
    class: water
      ? (waterDepth > river.depth * 0.56 ? "deepWater" : "shallowWater")
      : (signedDistance < river.bankWidth ? "riverbank" : "land"),
    distanceToWater: Math.max(0, signedDistance),
    signedDistanceToWater: signedDistance,
    wetness,
    water,
    waterDepth,
    waterSurface: river.waterSurface,
    bankWidth: river.bankWidth,
    current: {
      x: tangent.x,
      z: tangent.z,
      strength: river.currentStrength,
      label: "Corriente"
    }
  };
}

export function createLakeField(context = {}) {
  const seed = context.seed ?? "procedural-lake";
  const rng = new SeededRandom(`${seed}:lake-v1`);
  const bounds = normalizedBounds(context.bounds);
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const centerX = (bounds.minX + bounds.maxX) * 0.5;
  const centerZ = (bounds.minZ + bounds.maxZ) * 0.5;
  const scale = Math.max(0.01, finite(context.scale, 1));
  const moisture = clamp(context.moisture);
  const altitude = finite(context.altitude);
  const maxOffsetX = width * 0.18;
  const maxOffsetZ = depth * 0.18;
  const baseRadius = Math.max(scale * 3, Math.min(width, depth) * 0.12);

  return Object.freeze({
    kind: "lake",
    center: Object.freeze({
      x: centerX + rng.range(-maxOffsetX, maxOffsetX),
      z: centerZ + rng.range(-maxOffsetZ, maxOffsetZ)
    }),
    radiusX: baseRadius * (0.78 + moisture * 0.72),
    radiusZ: baseRadius * (0.66 + moisture * 0.62),
    rotation: rng.range(-Math.PI, Math.PI),
    depth: (0.55 + moisture * 1.15) * scale,
    bankWidth: (1.35 + moisture * 0.95) * scale,
    waterSurface: altitude - 0.2 * scale,
    phase: rng.range(0, Math.PI * 2)
  });
}

export function sampleLakeField(lake, x, z) {
  const cosine = Math.cos(lake.rotation);
  const sine = Math.sin(lake.rotation);
  const dx = finite(x) - lake.center.x;
  const dz = finite(z) - lake.center.z;
  const localX = dx * cosine - dz * sine;
  const localZ = dx * sine + dz * cosine;
  const q = Math.hypot(
    localX / Math.max(0.1, lake.radiusX),
    localZ / Math.max(0.1, lake.radiusZ)
  );
  const edgeScale = Math.min(lake.radiusX, lake.radiusZ);
  const signedDistance = (q - 1) * edgeScale;
  const water = q < 1;
  const center = clamp(1 - q);
  const waterDepth = water ? Math.max(0.07, lake.depth * Math.pow(center, 0.56)) : 0;
  const wetness = clamp(1 - Math.max(0, signedDistance) / Math.max(0.1, lake.bankWidth * 2.2));

  return {
    type: "lake",
    class: water
      ? (waterDepth > lake.depth * 0.52 ? "deepWater" : "shallowWater")
      : (signedDistance < lake.bankWidth ? "lakebank" : "land"),
    distanceToWater: Math.max(0, signedDistance),
    signedDistanceToWater: signedDistance,
    wetness,
    water,
    waterDepth,
    waterSurface: lake.waterSurface,
    bankWidth: lake.bankWidth,
    current: null
  };
}

export function autoHydrologyType(context = {}) {
  const relief = hydrologyReliefScore(context);
  const altitude = finite(context.altitude);
  const altitude01 = clamp(altitude / 8);
  const moisture = clamp(context.moisture);
  const aridity = clamp(context.aridity);
  if (moisture >= 0.7 && altitude <= 1.8 && relief < 0.72) return "lake";
  const riverScore = moisture * 0.58 + relief * 0.52 + altitude01 * 0.18 - aridity * 0.34;
  return riverScore >= 0.5 ? "river" : "none";
}

export function createHydrologyField(context = {}) {
  const requestedType = String(context.hydrology?.type || context.hydrologyType || "none");
  const type = requestedType === "auto" ? autoHydrologyType(context) : requestedType;
  if (type === "river") {
    const field = createRiverField(context);
    return Object.freeze({ type, requestedType, field, sample: (x, z) => sampleRiverField(field, x, z) });
  }
  if (type === "lake" || type === "pond") {
    const field = createLakeField(context);
    return Object.freeze({ type: "lake", requestedType, field, sample: (x, z) => sampleLakeField(field, x, z) });
  }
  return Object.freeze({
    type: type || "none",
    requestedType,
    field: null,
    sample: () => ({
      type: type || "none",
      class: "land",
      distanceToWater: Infinity,
      signedDistanceToWater: Infinity,
      wetness: 0,
      water: false,
      waterDepth: 0,
      waterSurface: null,
      bankWidth: 0,
      current: null
    })
  });
}
