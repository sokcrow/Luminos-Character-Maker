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
  return Object.freeze({
    minX: Math.min(minX, maxX),
    maxX: Math.max(minX, maxX),
    minZ: Math.min(minZ, maxZ),
    maxZ: Math.max(minZ, maxZ)
  });
}

export const PROCEDURAL_MAP_SPEC_CONTRACT_ID = "luminous.procedural-map-spec.v1";

export function normalizeProceduralMapSpec(spec = {}) {
  const id = String(spec.id || "procedural-map").trim();
  if (!id) throw new Error("Procedural map requires a stable id");

  const kind = String(spec.kind || "procedural");
  const seed = String(spec.seed ?? id);
  const hydrology = Object.freeze({ type: "none", ...(spec.hydrology || {}) });
  const landform = Object.freeze({ ...(spec.landform || {}) });
  const metadata = Object.freeze({
    authority: "map-module",
    generator: "ProceduralMapGenerator",
    contract: PROCEDURAL_MAP_SPEC_CONTRACT_ID,
    ...(spec.metadata || {})
  });

  return Object.freeze({
    ...spec,
    id,
    kind,
    seed,
    bounds: normalizeBounds(spec.bounds),
    altitude: finite(spec.altitude, 0),
    moisture: finite(spec.moisture, 0.5),
    aridity: finite(spec.aridity, 0.5),
    scale: Math.max(0.001, finite(spec.scale, 1)),
    hydrology,
    landform,
    metadata
  });
}

export function proceduralMapSpecViolations(spec) {
  const violations = [];
  if (!spec || typeof spec !== "object") return ["spec_missing"];
  if (!spec.id) violations.push("id_missing");
  if (!spec.seed) violations.push("seed_missing");
  if (!spec.metadata || spec.metadata.contract !== PROCEDURAL_MAP_SPEC_CONTRACT_ID) {
    violations.push("contract_mismatch");
  }
  if (!spec.hydrology) violations.push("hydrology_missing");
  if (!spec.landform) violations.push("landform_missing");
  return violations;
}
