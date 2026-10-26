(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousBattleViewerEncounterPlacement074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const ROOT = "campaña/combate/combatants";
  const state = { db: null, bound: false, repairing: false };

  const clean = (value) => String(value ?? "").trim();

  function staggerThresholds(armorType) {
    const armor = clean(armorType || "light").toLowerCase();
    if (armor === "heavy") return [50];
    if (armor === "medium") return [66, 33];
    return [75, 50, 25];
  }

  function placementFor(faction, index) {
    const side = faction === "ally" ? "ally" : "enemy";
    return {
      x: side === "enemy" ? Math.max(58, 90 - index * 6) : Math.min(42, 10 + index * 6),
      y: 45 + (index % 2 === 0 ? 10 : -10),
    };
  }

  async function repair(combatants = {}, options = {}) {
    const db = options.db || state.db;
    if (!db?.ref || state.repairing) return 0;
    const updates = {};
    const sideCounts = { ally: 0, enemy: 0 };

    Object.entries(combatants || {}).forEach(([key, combatant]) => {
      const faction = combatant?.faction === "ally" ? "ally" : "enemy";
      const index = sideCounts[faction]++;
      if (combatant?.entrySource !== "dm_unit_library_074") return;
      const placement = placementFor(faction, index);
      if (!Number.isFinite(Number(combatant.x))) updates[`${key}/x`] = placement.x;
      if (!Number.isFinite(Number(combatant.y))) updates[`${key}/y`] = placement.y;
      if (!Array.isArray(combatant.staggerThresholds) || !combatant.staggerThresholds.length) {
        updates[`${key}/staggerThresholds`] = staggerThresholds(combatant.armorType || combatant.armorCategory || combatant.armor);
      }
    });

    const count = Object.keys(updates).length;
    if (!count) return 0;
    state.repairing = true;
    try { await db.ref(ROOT).update(updates); }
    finally { state.repairing = false; }
    return count;
  }

  function init(options = {}) {
    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);
    if (!state.db?.ref) return false;
    if (state.bound) return true;
    state.bound = true;
    state.db.ref(ROOT).on("value", (snapshot) => {
      repair(snapshot.val() || {}).catch(() => {});
    });
    return true;
  }

  return Object.freeze({ version: "0.7.4", staggerThresholds, placementFor, repair, init });
});
