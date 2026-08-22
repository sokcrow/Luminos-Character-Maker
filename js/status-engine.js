(function (global) {
  "use strict";

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function registry() {
    return global.STATUS_REGISTRY && typeof global.STATUS_REGISTRY === "object" ? global.STATUS_REGISTRY : {};
  }

  function getDefinition(statusId) {
    const id = normalizeId(statusId);
    const found = registry()[id];
    if (found) return { id, icon: null, rules: [], ...clone(found) };
    return {
      id,
      name: String(statusId || id || "Unknown Status"),
      type: "neutral",
      mode: "single",
      icon: null,
      rules: [],
      description: "Unregistered status. Mechanics may be supplied by its source effect.",
      unregistered: true,
    };
  }

  function ensureStore(unit) {
    if (!unit || typeof unit !== "object") return null;
    if (!unit.statusEffects || Array.isArray(unit.statusEffects) || typeof unit.statusEffects !== "object") {
      const next = {};
      if (Array.isArray(unit.statusEffects)) {
        unit.statusEffects.forEach((entry) => {
          const id = normalizeId(entry?.id || entry?.name || entry);
          if (id) next[id] = typeof entry === "object" ? clone(entry) : { id, count: 1, potency: 0 };
        });
      }
      unit.statusEffects = next;
    }
    return unit.statusEffects;
  }

  function normalizeInstance(statusId, input = {}, existing = null) {
    const id = normalizeId(statusId);
    const definition = getDefinition(id);
    const count = Math.max(0, numberOr(input.count, existing?.count ?? 1));
    const potency = numberOr(input.potency, existing?.potency ?? 0);
    return {
      id,
      name: input.name || existing?.name || definition.name || id,
      count,
      potency,
      duration: normalizeId(input.duration || existing?.duration || "until_removed"),
      sourceTraitId: input.sourceTraitId || existing?.sourceTraitId || null,
      sourceUnitId: input.sourceUnitId || existing?.sourceUnitId || null,
      data: { ...(existing?.data || {}), ...(input.data || {}) },
    };
  }

  function applyStatus(unit, statusId, input = {}) {
    const id = normalizeId(statusId);
    if (!id) return null;
    const store = ensureStore(unit);
    if (!store) return null;
    const existing = store[id] && typeof store[id] === "object" ? store[id] : null;
    const mode = normalizeId(input.mode || input.action || "gain");
    const definition = getDefinition(id);
    let next = normalizeInstance(id, input, existing);

    if (existing && ["gain", "add", "inflict", "apply"].includes(mode)) {
      next.count = numberOr(existing.count, 0) + Math.max(0, numberOr(input.count, 1));
      next.potency = numberOr(existing.potency, 0) + numberOr(input.potency, 0);
    }
    if (Number.isFinite(Number(definition.maxCount))) {
      next.count = Math.min(Number(definition.maxCount), next.count);
    }
    store[id] = next;
    return next;
  }

  function protectionFor(unit, statusId, options = {}) {
    const id = normalizeId(statusId);
    return options.protectedStatuses?.[id]
      || unit?.statusProtections?.[id]
      || unit?.protectedStatuses?.[id]
      || null;
  }

  function removeStatus(unit, statusId, options = {}) {
    const id = normalizeId(statusId);
    const store = ensureStore(unit);
    if (!store || !id) return { removed: false, protected: false, statusId: id };
    const protection = protectionFor(unit, id, options);
    const source = normalizeId(options.from || "effects");
    const protectionSource = normalizeId(protection?.from || protection?.source || "effects");
    const blocked = Boolean(protection) && !options.ignoreProtection && (protectionSource === "all" || protectionSource === source || (protectionSource === "effects" && source !== "self"));
    if (blocked) return { removed: false, protected: true, statusId: id, protection: clone(protection) };
    const removed = Object.prototype.hasOwnProperty.call(store, id);
    if (removed) delete store[id];
    return { removed, protected: false, statusId: id };
  }

  function hasStatus(unit, statusId) {
    const store = ensureStore(unit);
    return Boolean(store && store[normalizeId(statusId)]);
  }

  function getStatus(unit, statusId) {
    const store = ensureStore(unit);
    const entry = store?.[normalizeId(statusId)];
    return entry ? clone(entry) : null;
  }

  function protectStatus(unit, statusId, protection = {}) {
    if (!unit || typeof unit !== "object") return null;
    if (!unit.statusProtections || typeof unit.statusProtections !== "object") unit.statusProtections = {};
    const id = normalizeId(statusId);
    unit.statusProtections[id] = {
      from: normalizeId(protection.from || "effects"),
      sourceTraitId: protection.sourceTraitId || null,
    };
    return clone(unit.statusProtections[id]);
  }

  function syncTraitState(unit, traitState = {}) {
    if (!unit) return unit;
    Object.entries(traitState.statuses || {}).forEach(([statusId, status]) => {
      applyStatus(unit, statusId, { ...status, mode: "set" });
    });
    Object.entries(traitState.protectedStatuses || {}).forEach(([statusId, protection]) => {
      protectStatus(unit, statusId, protection);
    });
    return unit;
  }

  function listStatuses(unit) {
    const store = ensureStore(unit) || {};
    return Object.entries(store).map(([id, instance]) => ({
      ...getDefinition(id),
      instance: typeof instance === "object" ? clone(instance) : { id, count: numberOr(instance, 1), potency: 0 },
    }));
  }

  const api = Object.freeze({
    normalizeId,
    getDefinition,
    ensureStore,
    applyStatus,
    removeStatus,
    hasStatus,
    getStatus,
    protectStatus,
    syncTraitState,
    listStatuses,
  });

  global.LuminousStatusEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
