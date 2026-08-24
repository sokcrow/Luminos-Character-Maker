(function (global) {
  "use strict";

  // Canonical runtime Status store for Traits, Skills, Items, environments and combat effects.
  // Status icons are presentation-only: unregistered statuses remain mechanically valid with icon=null.
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
    const duration = normalizeId(input.duration || existing?.duration || "until_removed");
    const data = { ...(existing?.data || {}), ...(input.data || {}) };
    if (["this_turn", "next_turn_end"].includes(duration) && !Number.isFinite(Number(data.durationTurnsRemaining))) {
      data.durationTurnsRemaining = 1;
    }
    return {
      id,
      name: input.name || existing?.name || definition.name || id,
      count,
      potency,
      duration,
      sourceTraitId: input.sourceTraitId || existing?.sourceTraitId || null,
      sourceUnitId: input.sourceUnitId || existing?.sourceUnitId || null,
      data,
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

  function advanceDurations(unit, trigger = "turn_end") {
    const phase = normalizeId(trigger);
    if (!["turn_end", "round_end", "[round_end]"].includes(phase)) return [];
    const store = ensureStore(unit) || {};
    const expired = [];
    Object.entries({ ...store }).forEach(([statusId, raw]) => {
      if (!raw || typeof raw !== "object") return;
      const duration = normalizeId(raw.duration || "until_removed");
      if (!["this_turn", "next_turn_end"].includes(duration)) return;
      if (!raw.data || typeof raw.data !== "object") raw.data = {};
      const remaining = Math.max(1, Math.trunc(numberOr(raw.data.durationTurnsRemaining, 1))) - 1;
      raw.data.durationTurnsRemaining = remaining;
      if (remaining <= 0) {
        removeStatus(unit, statusId, { from: "duration", ignoreProtection: true });
        expired.push(normalizeId(statusId));
      }
    });
    return expired;
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
    advanceDurations,
    listStatuses,
  });

  global.LuminousStatusEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  // Rest/Recover is a shared player + combat resource. Load the canonical Class table first,
  // then Rest Engine, then the bridge that connects Trait activation and persistence.
  if (global.document && !global.LuminousCharacterBuildRules && !global.document.getElementById("character-build-rules-script")) {
    const script = global.document.createElement("script");
    script.id = "character-build-rules-script";
    script.src = "js/character-build-rules.js";
    script.async = false;
    global.document.head?.appendChild(script);
  }

  if (global.document && !global.LuminousRestEngine && !global.document.getElementById("rest-engine-script")) {
    const script = global.document.createElement("script");
    script.id = "rest-engine-script";
    script.src = "js/rest-engine.js";
    script.async = false;
    global.document.head?.appendChild(script);
  }

  if (global.document && !global.LuminousRestRuntime && !global.document.getElementById("rest-runtime-integration-script")) {
    const script = global.document.createElement("script");
    script.id = "rest-runtime-integration-script";
    script.src = "js/rest-runtime-integration.js";
    script.async = false;
    global.document.head?.appendChild(script);
  }

  if (global.document && !global.LuminousUniversalSpeedRuntime && !global.document.getElementById("universal-speed-runtime-script")) {
    const script = global.document.createElement("script");
    script.id = "universal-speed-runtime-script";
    script.src = "js/universal-speed-runtime.js";
    script.async = false;
    global.document.head?.appendChild(script);
  }

  if (global.document && !global.LuminousRacialTraitRuntimeBridge && !global.document.getElementById("racial-trait-runtime-bridge-script")) {
    const script = global.document.createElement("script");
    script.id = "racial-trait-runtime-bridge-script";
    script.src = "js/racial-trait-runtime-bridge.js";
    script.async = false;
    global.document.head?.appendChild(script);
  }

  // Status Engine is loaded by the real Battle Viewer before CombatEngine. Bootstrap the
  // Archetype runtimes here so combat mechanics do not depend on player-sheet-only loaders.
  if (global.document && !global.LuminousArchetypeRuntime && !global.document.getElementById("player-archetype-runtime-script")) {
    const script = global.document.createElement("script");
    script.id = "player-archetype-runtime-script";
    script.src = "js/player-archetype-runtime.js";
    script.async = false;
    global.document.head?.appendChild(script);
  }

  if (global.document && !global.LuminousArchetypeCombatEventRuntime && !global.document.getElementById("archetype-combat-event-runtime-script")) {
    const script = global.document.createElement("script");
    script.id = "archetype-combat-event-runtime-script";
    script.src = "js/archetype-combat-event-runtime.js";
    script.async = false;
    global.document.head?.appendChild(script);
  }

  // Death/Downed is a combat-wide rule, not a player-sheet feature. Load it from the same
  // Battle Viewer bootstrap and let it patch CombatEngine when that script becomes available.
  if (global.document && !global.LuminousDeathSaveRuntime && !global.document.getElementById("death-save-runtime-script")) {
    const script = global.document.createElement("script");
    script.id = "death-save-runtime-script";
    script.src = "js/death-save-runtime.js";
    script.async = false;
    global.document.head?.appendChild(script);
  }
})(typeof window !== "undefined" ? window : globalThis);