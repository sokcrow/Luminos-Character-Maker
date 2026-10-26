import { seededUnit } from "./SeededRandom.js";

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function smooth(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function lattice(seed, x, z) {
  return seededUnit(seed, x, z) * 2 - 1;
}

export function valueNoise2D(seed, x, z) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;
  const tx = smooth(x - x0);
  const tz = smooth(z - z0);
  const a = lerp(lattice(seed, x0, z0), lattice(seed, x1, z0), tx);
  const b = lerp(lattice(seed, x0, z1), lattice(seed, x1, z1), tx);
  return lerp(a, b, tz);
}

export function fractalNoise2D(seed, x, z, { octaves = 4, lacunarity = 2, gain = 0.5 } = {}) {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let weight = 0;
  for (let octave = 0; octave < Math.max(1, Math.floor(octaves)); octave += 1) {
    sum += valueNoise2D(`${seed}:octave:${octave}`, x * frequency, z * frequency) * amplitude;
    weight += amplitude;
    amplitude *= gain;
    frequency *= lacunarity;
  }
  return weight > 0 ? sum / weight : 0;
}

function weights(context = {}) {
  return context.landform?.weights || context.landform || {};
}

function terrainSignal(context, x, z) {
  const landform = weights(context);
  const seed = context.seed ?? "procedural-terrain";
  const scale = Math.max(0.001, finite(context.scale, 1));
  const nx = x / (48 * scale);
  const nz = z / (48 * scale);
  const rolling = fractalNoise2D(`${seed}:rolling`, nx, nz, { octaves: 3, gain: 0.58 });
  const hills = fractalNoise2D(`${seed}:hills`, nx * 1.75, nz * 1.75, { octaves: 4, gain: 0.52 });
  const ridgeBase = Math.abs(fractalNoise2D(`${seed}:ridges`, nx * 2.2, nz * 2.2, { octaves: 4, gain: 0.48 }));
  const ridges = 1 - ridgeBase;
  const mountainBase = fractalNoise2D(`${seed}:mountain`, nx * 0.95, nz * 0.95, { octaves: 5, gain: 0.55 });
  const mountain = Math.sign(mountainBase) * Math.pow(Math.abs(mountainBase), 0.72);
  const mesas = Math.tanh(fractalNoise2D(`${seed}:mesas`, nx * 1.25, nz * 1.25, { octaves: 3, gain: 0.42 }) * 2.4);

  const components = [
    [rolling, finite(landform.rolling)],
    [hills, finite(landform.hills)],
    [ridges, finite(landform.ridges)],
    [mountain, finite(landform.mountain)],
    [mountain, finite(landform.cliffs) * 0.8],
    [mesas, finite(landform.mesas)],
    [rolling, finite(landform.dunes) * 0.55]
  ];
  let sum = 0;
  let total = 0;
  for (const [value, amount] of components) {
    if (amount <= 0) continue;
    sum += value * amount;
    total += amount;
  }
  return total > 0 ? sum / total : rolling * 0.35;
}

function classifySlope(slope) {
  if (slope < 0.18) return "flat";
  if (slope < 0.42) return "gentle";
  if (slope < 0.78) return "steep";
  return "cliff";
}

function movementMultiplier(slopeBand, hydrologySample) {
  if (hydrologySample?.water) {
    return hydrologySample.class === "deepWater" ? 0.45 : 0.72;
  }
  if (hydrologySample?.class === "riverbank" || hydrologySample?.class === "lakebank") return 0.86;
  if (slopeBand === "cliff") return 0.42;
  if (slopeBand === "steep") return 0.68;
  if (slopeBand === "gentle") return 0.88;
  return 1;
}

export function createTerrainField(context = {}) {
  const seed = context.seed ?? "procedural-terrain";
  const altitude = finite(context.altitude, 0);
  const scale = Math.max(0.001, finite(context.scale, 1));
  const verticalScale = Math.max(0.01, finite(context.verticalScale, 2.4 * scale));
  const sampleStep = Math.max(0.1, finite(context.sampleStep, 0.75 * scale));
  const biome = String(context.biome || context.biomeProfile || "temperate");
  const surface = String(context.surface || context.biomeProfile || "ground");

  function rawHeight(x, z) {
    return altitude + terrainSignal({ ...context, seed, scale }, x, z) * verticalScale;
  }

  function sample(point = {}, hydrologySample = null) {
    const x = finite(point.x);
    const z = finite(point.z);
    let height = rawHeight(x, z);
    if (hydrologySample?.water && Number.isFinite(hydrologySample.waterSurface)) {
      const bed = hydrologySample.waterSurface - hydrologySample.waterDepth;
      height = Math.min(height, bed);
    }

    const dx = (rawHeight(x + sampleStep, z) - rawHeight(x - sampleStep, z)) / (sampleStep * 2);
    const dz = (rawHeight(x, z + sampleStep) - rawHeight(x, z - sampleStep)) / (sampleStep * 2);
    const slope = Math.hypot(dx, dz);
    const slopeBand = classifySlope(slope);

    return {
      height,
      slope,
      slopeBand,
      moveMultiplier: movementMultiplier(slopeBand, hydrologySample),
      biome,
      surface,
      hydrology: hydrologySample,
      source: "procedural-map-module"
    };
  }

  return Object.freeze({ seed: String(seed), altitude, scale, verticalScale, rawHeight, sample });
}
