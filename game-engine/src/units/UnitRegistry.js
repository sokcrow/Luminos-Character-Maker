export const UNIT_RUNTIME_CONTRACT_ID = "luminous.unit-runtime.v1";

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTags(tags, role) {
  const values = new Set(Array.isArray(tags) ? tags.map(String) : []);
  if (role) values.add(String(role));
  return [...values];
}

export function normalizeUnitSpec(spec = {}) {
  const id = String(spec.id || "").trim();
  if (!id) throw new Error("Unit requires a stable id");

  const role = String(spec.role || spec.kind || "unit");
  const transform = spec.transform || {};
  const movement = spec.movement || {};

  return {
    id,
    role,
    tags: normalizeTags(spec.tags, role),
    runtimeContract: UNIT_RUNTIME_CONTRACT_ID,
    enabled: spec.enabled !== false,
    transform: {
      x: finite(transform.x),
      y: finite(transform.y),
      z: finite(transform.z),
      yaw: finite(transform.yaw)
    },
    movement: {
      speed: Math.max(0, finite(movement.speed, 0)),
      maxSpeed: Math.max(0, finite(movement.maxSpeed, finite(movement.speed, 0))),
      velocityX: finite(movement.velocityX),
      velocityY: finite(movement.velocityY),
      velocityZ: finite(movement.velocityZ),
      intentX: 0,
      intentZ: 0
    },
    mobility: {
      multiplier: Math.max(0, finite(spec.mobility?.multiplier, 1)),
      terrainSample: null,
      waterSample: null
    },
    controller: spec.controller || null,
    binding: spec.binding || null,
    components: { ...(spec.components || {}) },
    metadata: { ...(spec.metadata || {}) }
  };
}

export function unitContractViolations(unit) {
  const violations = [];
  if (!unit || typeof unit !== "object") return ["unit_missing"];
  if (!unit.id) violations.push("id_missing");
  if (unit.runtimeContract !== UNIT_RUNTIME_CONTRACT_ID) violations.push("runtime_contract_mismatch");
  if (!unit.transform) violations.push("transform_missing");
  if (!unit.movement) violations.push("movement_missing");
  if (!Array.isArray(unit.tags)) violations.push("tags_missing");
  return violations;
}

export class UnitRegistry {
  constructor() {
    this.units = new Map();
  }

  register(spec) {
    const unit = normalizeUnitSpec(spec);
    if (this.units.has(unit.id)) throw new Error(`Unit already registered: ${unit.id}`);
    this.units.set(unit.id, unit);
    return unit;
  }

  unregister(id) {
    return this.units.delete(String(id));
  }

  get(id) {
    return this.units.get(String(id)) || null;
  }

  has(id) {
    return this.units.has(String(id));
  }

  list({ enabledOnly = false } = {}) {
    const values = [...this.units.values()];
    return enabledOnly ? values.filter(unit => unit.enabled) : values;
  }

  clear() {
    this.units.clear();
  }
}
