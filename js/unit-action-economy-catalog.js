(function (global) {
  "use strict";

  if (global.LuminousUnitActionEconomyCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousUnitActionEconomyCatalog;
    return;
  }

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  // Canonical per-Unit data. Allocation policy does not infer slot limits from species,
  // rank, boss flags, or names. Live combatants should preserve one of these ids explicitly.
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
      unit.actionEconomy?.profileId
      ?? unit.actionSlotProfileId
      ?? unit.canonicalUnitId
      ?? unit.definitionId
      ?? unit.catalogId
      ?? unit.baseUnitId
      ?? unit.metadata?.actionEconomyProfileId
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

  function applyToUnit(unit = {}, profileId = null) {
    if (!unit || typeof unit !== "object") return { applied: false, reason: "unit_required", unit };
    const id = canonicalUnitId(profileId || unit);
    const profile = PROFILES[id];
    if (!profile) return { applied: false, reason: "action_economy_profile_not_found", profileId: id || null, unit };

    unit.actionEconomy = {
      ...(unit.actionEconomy && typeof unit.actionEconomy === "object" ? unit.actionEconomy : {}),
      profileId: id,
      minSlots: profile.minSlots,
      maxSlots: profile.maxSlots,
    };
    unit.actionSlotProfileId = id;
    unit.metadata = {
      ...(unit.metadata && typeof unit.metadata === "object" ? unit.metadata : {}),
      actionEconomyProfileId: id,
    };
    return { applied: true, profileId: id, profile: { id, ...clone(profile) }, unit };
  }

  const api = Object.freeze({ version: "1.1.0", PROFILES, canonicalUnitId, get, list, applyToUnit });
  global.LuminousUnitActionEconomyCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
