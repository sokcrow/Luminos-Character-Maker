function stableId(value) {
  const id = String(value || "").trim();
  if (!id) throw new Error("Map definition requires a stable id");
  return id;
}

function normalizeBounds(bounds) {
  if (!bounds) return null;
  const minX = Number(bounds.minX);
  const maxX = Number(bounds.maxX);
  const minZ = Number(bounds.minZ);
  const maxZ = Number(bounds.maxZ);
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return null;
  return { minX, maxX, minZ, maxZ };
}

export function normalizeMapDefinition(definition = {}) {
  const id = stableId(definition.id);
  return {
    id,
    kind: String(definition.kind || "world"),
    seed: definition.seed ?? null,
    bounds: normalizeBounds(definition.bounds),
    metadata: { ...(definition.metadata || {}) },
    generate: typeof definition.generate === "function" ? definition.generate : null,
    sampleTerrain: typeof definition.sampleTerrain === "function" ? definition.sampleTerrain : null,
    sampleWater: typeof definition.sampleWater === "function" ? definition.sampleWater : null,
    resolveMovement: typeof definition.resolveMovement === "function" ? definition.resolveMovement : null,
    update: typeof definition.update === "function" ? definition.update : null,
    dispose: typeof definition.dispose === "function" ? definition.dispose : null
  };
}

export class MapRegistry {
  constructor() {
    this.maps = new Map();
  }

  register(definition) {
    const normalized = normalizeMapDefinition(definition);
    if (this.maps.has(normalized.id)) throw new Error(`Map already registered: ${normalized.id}`);
    this.maps.set(normalized.id, normalized);
    return normalized;
  }

  upsert(definition) {
    const normalized = normalizeMapDefinition(definition);
    this.maps.set(normalized.id, normalized);
    return normalized;
  }

  get(id) {
    return this.maps.get(String(id)) || null;
  }

  has(id) {
    return this.maps.has(String(id));
  }

  unregister(id) {
    return this.maps.delete(String(id));
  }

  list() {
    return [...this.maps.values()];
  }

  clear() {
    this.maps.clear();
  }
}
