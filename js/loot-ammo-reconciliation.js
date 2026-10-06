(function (global) {
  "use strict";

  if (global.LuminousLootAmmoReconciliation) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootAmmoReconciliation;
    return;
  }

  const VERSION = 1;

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function intOr(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.trunc(numeric)) : fallback;
  }
  function sumBuckets(source = {}) {
    return Object.values(source || {}).reduce((sum, value) => sum + intOr(value, 0), 0);
  }
  function ammoIdForEntry(entry = {}) {
    const direct = normalizeId(entry.ammoId ?? entry.ammunitionId ?? entry.resourceId);
    if (direct) return direct;
    const definition = normalizeId(entry.definitionId ?? entry.itemId ?? entry.id);
    return definition.startsWith("ammo_") ? definition.slice(5) : definition;
  }
  function isAmmoEntry(entry = {}) {
    return normalizeId(entry.category) === "ammunition" || Boolean(entry.ammoId || entry.ammunitionId || normalizeId(entry.definitionId).startsWith("ammo_"));
  }
  function stackCandidates(unit = {}, options = {}) {
    return [
      options.ammoStacks,
      options.combatAmmoStacks,
      unit.combatAmmoStacks,
      unit.ammoStacks,
      unit.ammunitionStacks,
      unit.runtimeState?.ammoStacks,
      unit.combatState?.ammoStacks,
    ].filter((value) => value && typeof value === "object");
  }
  function detailedStackFor(unit = {}, ammoId, options = {}) {
    const id = normalizeId(ammoId);
    for (const source of stackCandidates(unit, options)) {
      if (source[id]) return source[id];
      for (const [key, value] of Object.entries(source)) {
        if (normalizeId(key) === id || normalizeId(value?.ammoId) === id) return value;
      }
    }
    return null;
  }
  function recoverDetailedStack(stack = {}) {
    const runtime = global.LuminousAmmoRuntime;
    if (runtime?.resolveEndOfCombatRecovery) return runtime.resolveEndOfCombatRecovery(stack);
    const next = clone(stack) || {};
    next.available = { ...(next.available || {}) };
    for (const [durability, quantity] of Object.entries(next.spent || {})) {
      next.available[durability] = intOr(next.available[durability], 0) + intOr(quantity, 0);
    }
    next.spent = {};
    return next;
  }
  function liveAmmoCount(unit = {}, ammoId, options = {}) {
    const id = normalizeId(ammoId);
    const explicit = options.liveAmmoCounts?.[id] ?? options.liveAmmoCounts?.[ammoId];
    if (Number.isFinite(Number(explicit))) return intOr(explicit, 0);
    const runtime = global.LuminousUniversalRangedAmmoRuntime;
    if (runtime?.ammoCount) {
      const value = runtime.ammoCount(unit, id);
      if (Number.isFinite(Number(value))) return intOr(value, 0);
    }
    const direct = unit.ammunition?.[id]?.count ?? unit.ammo?.[id]?.count ?? unit.ammoCounts?.[id];
    return Number.isFinite(Number(direct)) ? intOr(direct, 0) : null;
  }
  function explicitRecoveredCount(ammoId, options = {}) {
    const id = normalizeId(ammoId);
    const value = options.recoveredProjectiles?.[id] ?? options.recoveredProjectiles?.[ammoId];
    return Number.isFinite(Number(value)) ? intOr(value, 0) : 0;
  }

  function reconcileAmmoEntry(unit = {}, entry = {}, options = {}) {
    if (!isAmmoEntry(entry)) return Object.freeze({ entry: clone(entry), reconciled: true, skipped: true, reason: "not_ammunition" });
    const ammoId = ammoIdForEntry(entry);
    if (!ammoId) return Object.freeze({ entry: clone(entry), reconciled: false, skipped: false, reason: "ammo_id_missing" });

    const generatedQuantity = intOr(entry.quantity ?? entry.amount ?? entry.cantidad, 0);
    const detailed = detailedStackFor(unit, ammoId, options);
    let authoritativeQuantity = null;
    let source = null;
    let remaining = null;
    let recovered = 0;
    let recoveredStack = null;

    if (detailed) {
      remaining = sumBuckets(detailed.available);
      recovered = sumBuckets(detailed.spent);
      recoveredStack = recoverDetailedStack(detailed);
      authoritativeQuantity = sumBuckets(recoveredStack.available);
      source = "detailed_ammo_stack";
    } else {
      remaining = liveAmmoCount(unit, ammoId, options);
      if (remaining != null) {
        recovered = explicitRecoveredCount(ammoId, options);
        authoritativeQuantity = remaining + recovered;
        source = recovered > 0 ? "live_combat_state_plus_recovery" : "live_combat_state";
      }
    }

    if (authoritativeQuantity == null) {
      return Object.freeze({
        entry: clone(entry),
        reconciled: false,
        skipped: false,
        reason: "authoritative_post_combat_ammo_state_missing",
        ammoId,
        generatedQuantity,
      });
    }

    const next = {
      ...clone(entry),
      ammoId,
      quantity: authoritativeQuantity,
      amount: authoritativeQuantity,
      lootReconciliation: {
        type: "post_combat_ammunition",
        source,
        generatedQuantity,
        remaining: intOr(remaining, 0),
        recovered,
        authoritativeQuantity,
        regenerated: false,
      },
    };
    return Object.freeze({
      entry: Object.freeze(next),
      reconciled: true,
      skipped: false,
      ammoId,
      source,
      generatedQuantity,
      authoritativeQuantity,
      remaining: intOr(remaining, 0),
      recovered,
      recoveredStack: recoveredStack ? Object.freeze(clone(recoveredStack)) : null,
    });
  }

  function reconcileCarriedAmmo(unit = {}, carriedEntries = [], options = {}) {
    const results = (Array.isArray(carriedEntries) ? carriedEntries : []).map((entry) => reconcileAmmoEntry(unit, entry, options));
    const errors = results.filter((result) => !result.reconciled).map((result) => ({
      ammoId: result.ammoId || null,
      reason: result.reason,
    }));
    return Object.freeze({
      reconciled: errors.length === 0,
      entries: Object.freeze(results.map((result) => result.entry)),
      results: Object.freeze(results),
      errors: Object.freeze(errors),
    });
  }

  function assertAmmoReconciledBeforeLock(unit = {}, carriedEntries = [], options = {}) {
    const result = reconcileCarriedAmmo(unit, carriedEntries, options);
    if (!result.reconciled) {
      const reasons = result.errors.map((error) => `${error.ammoId || "unknown"}:${error.reason}`).join("|");
      throw new Error(`LOOT_AMMO_RECONCILIATION_REQUIRED:${reasons}`);
    }
    return result;
  }

  const API = Object.freeze({
    VERSION,
    normalizeId,
    sumBuckets,
    ammoIdForEntry,
    isAmmoEntry,
    detailedStackFor,
    recoverDetailedStack,
    liveAmmoCount,
    reconcileAmmoEntry,
    reconcileCarriedAmmo,
    assertAmmoReconciledBeforeLock,
  });

  global.LuminousLootAmmoReconciliation = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
