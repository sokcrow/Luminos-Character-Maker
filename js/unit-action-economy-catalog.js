(function (global) {
  "use strict";

  if (global.LuminousUnitActionEconomyCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousUnitActionEconomyCatalog;
    return;
  }

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  // Canonical per-Unit data. Keep this separate from allocation policy: the allocator
  // reads these limits, but never infers max slots from species/rank/type.
  const PROFILES = Object.freeze({
    kobold_dagger: Object.freeze({ minSlots: 1, maxSlots: 2 }),
    kobold_sling: Object.freeze({ minSlots: 1, maxSlots: 2 }),
    winged_kobold: Object.freeze({ minSlots: 1, maxSlots: 2 }),
    dragonheart_kobold: Object.freeze({ minSlots: 1, maxSlots: 3 }),
    scale_sorcerer_kobold: Object.freeze({ minSlots: 1, maxSlots: 3 }),
    goblin: Object.freeze({ minSlots: 1, maxSlots: 2 }),
    goblin_boss: Object.freeze({ minSlots: 1, maxSlots: 3 }),
  });

  function canonicalUnitId(unitOrId) {
    if (typeof unitOrId === "string" || typeof unitOrId === "number") return normalizeId(unitOrId);
    const unit = unitOrId || {};
    return normalizeId(
      unit.canonicalUnitId
      ?? unit.definitionId
      ?? unit.catalogId
      ?? unit.baseUnitId
      ?? unit.metadata?.canonicalUnitId
      ?? unit.metadata?.definitionId
      ?? unit.metadata?.catalogId
      ?? unit.id
    );
  }

  function get(unitOrId) {
    const id = canonicalUnitId(unitOrId);
    return PROFILES[id] ? { id, ...clone(PROFILES[id]) } : null;
  }

  function list() {
    return Object.entries(PROFILES).map(([id, profile]) => ({ id, ...clone(profile) }));
  }

  const api = Object.freeze({ version: "1.0.0", PROFILES, canonicalUnitId, get, list });
  global.LuminousUnitActionEconomyCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
