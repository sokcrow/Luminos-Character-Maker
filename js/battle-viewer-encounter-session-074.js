(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousBattleViewerEncounterSession074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const COMBAT_ROOT = "campaña/combate";
  const ROOTS = Object.freeze({
    combat: COMBAT_ROOT,
    draft: `${COMBAT_ROOT}/encounterDraft`,
    draftCombatants: `${COMBAT_ROOT}/encounterDraft/combatants`,
    draftReserves: `${COMBAT_ROOT}/encounterDraft/reserves`,
    combatants: `${COMBAT_ROOT}/combatants`,
    reserves: `${COMBAT_ROOT}/reserves`,
    state: `${COMBAT_ROOT}/estado`,
    active: `${COMBAT_ROOT}/active`,
    activeEncounterId: `${COMBAT_ROOT}/activeEncounterId`,
    plannedActions: `${COMBAT_ROOT}/plannedActions`,
    slotTargets: `${COMBAT_ROOT}/slotTargets`,
  });

  const LIVE_STATES = new Set(["PRE_COMBAT_PLANNING", "COMBAT_ACTIVE"]);
  const state = {
    db: null,
    draftCombatants: {},
    draftReserves: {},
    activeEncounterId: null,
    combatState: "IDLE",
    subscriptions: [],
    started: false,
  };

  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const safeKey = (value, fallback = "combatant") => clean(value).replace(/[.#$\[\]\/]/g, "_") || fallback;

  function normalizeState(value) {
    return clean(value || "IDLE").toUpperCase() || "IDLE";
  }

  function isLiveState(value) {
    return LIVE_STATES.has(normalizeState(value));
  }

  function buildEncounterId(now = Date.now()) {
    return `enc_${Number(now).toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function combatantKey(combatant = {}) {
    return safeKey(combatant.id || combatant.combatId || combatant.playerId || combatant.actorId || `unit_${Date.now().toString(36)}`);
  }

  function prepareLiveCombatants(draft = {}, encounterId, now = Date.now()) {
    const id = clean(encounterId);
    if (!id) throw new Error("ENCOUNTER_ID_REQUIRED");
    return Object.fromEntries(Object.entries(draft || {})
      .filter(([, combatant]) => combatant && typeof combatant === "object")
      .map(([key, combatant]) => {
        const next = clone(combatant) || {};
        next.id = clean(next.id || next.combatId || key) || key;
        next.combatId = clean(next.combatId || next.id) || next.id;
        next.encounterId = id;
        next.enteredCombatAt = Number(now);
        delete next.stagedAt;
        delete next.draftEncounterId;
        return [key, next];
      }));
  }

  function filterActiveCombatants(combatants = {}, activeEncounterId = state.activeEncounterId, combatState = state.combatState) {
    const encounterId = clean(activeEncounterId);
    if (!encounterId || !isLiveState(combatState)) return {};
    return Object.fromEntries(Object.entries(combatants || {}).filter(([, combatant]) => clean(combatant?.encounterId) === encounterId));
  }

  async function stageCombatant(combatant, options = {}) {
    const db = options.db || state.db;
    if (!db?.ref) throw new Error("FIREBASE_DATABASE_REQUIRED");
    if (!combatant || typeof combatant !== "object") throw new Error("COMBATANT_REQUIRED");
    const key = clean(options.key) || combatantKey(combatant);
    const staged = clone(combatant) || {};
    staged.id = clean(staged.id || staged.combatId || key) || key;
    staged.combatId = clean(staged.combatId || staged.id) || staged.id;
    staged.stagedAt = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    delete staged.encounterId;
    delete staged.enteredCombatAt;
    await db.ref(`${ROOTS.draftCombatants}/${key}`).set(staged);
    return { key, combatant: clone(staged) };
  }

  async function removeStagedCombatant(key, options = {}) {
    const db = options.db || state.db;
    if (!db?.ref) throw new Error("FIREBASE_DATABASE_REQUIRED");
    const id = clean(key);
    if (!id) return false;
    await db.ref(`${ROOTS.draftCombatants}/${id}`).remove();
    return true;
  }

  async function clearDraft(options = {}) {
    const db = options.db || state.db;
    if (!db?.ref) throw new Error("FIREBASE_DATABASE_REQUIRED");
    await db.ref(ROOTS.draft).remove();
    return true;
  }

  async function startEncounter(options = {}) {
    const db = options.db || state.db;
    if (!db?.ref) throw new Error("FIREBASE_DATABASE_REQUIRED");
    const draft = options.draftCombatants || state.draftCombatants || {};
    const keys = Object.keys(draft || {});
    if (!keys.length) throw new Error("EMPTY_ENCOUNTER_DRAFT");

    const now = Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now();
    const encounterId = clean(options.encounterId) || buildEncounterId(now);
    const combatants = prepareLiveCombatants(draft, encounterId, now);
    const planningDurationMs = Math.max(0, Number(options.planningDurationMs ?? 60000) || 0);

    await db.ref(ROOTS.combat).update({
      active: true,
      estado: "PRE_COMBAT_PLANNING",
      activeEncounterId: encounterId,
      combatants,
      reserves: null,
      plannedActions: null,
      slotTargets: null,
      encounterDraft: null,
      encounterStartedAt: now,
      planningStartedAt: now,
      planningEndsAt: planningDurationMs ? now + planningDurationMs : null,
      roundIndex: 0,
      roundResolvedAt: null,
      roundResolveReason: null,
    });

    return { encounterId, combatants: clone(combatants), state: "PRE_COMBAT_PLANNING" };
  }

  async function resetEncounter(options = {}) {
    const db = options.db || state.db;
    if (!db?.ref) throw new Error("FIREBASE_DATABASE_REQUIRED");
    await db.ref(ROOTS.combat).update({
      active: false,
      estado: "IDLE",
      activeEncounterId: null,
      combatants: null,
      reserves: null,
      plannedActions: null,
      slotTargets: null,
      planningStartedAt: null,
      planningEndsAt: null,
      roundResolvedAt: null,
      roundResolveReason: null,
    });
    return true;
  }

  function subscribe(path, assign) {
    if (!state.db?.ref) return;
    const ref = state.db.ref(path);
    const handler = (snapshot) => assign(snapshot?.val?.());
    ref.on("value", handler);
    state.subscriptions.push(() => ref.off("value", handler));
  }

  function init(options = {}) {
    const db = options.db || state.db || (() => {
      try { return global.firebase?.database?.() || null; } catch (_) { return null; }
    })();
    if (!db?.ref) return false;
    if (state.started && state.db === db) return true;
    stop();
    state.db = db;
    state.started = true;
    subscribe(ROOTS.draftCombatants, (value) => { state.draftCombatants = value && typeof value === "object" ? value : {}; });
    subscribe(ROOTS.draftReserves, (value) => { state.draftReserves = value && typeof value === "object" ? value : {}; });
    subscribe(ROOTS.activeEncounterId, (value) => { state.activeEncounterId = clean(value) || null; });
    subscribe(ROOTS.state, (value) => { state.combatState = normalizeState(value); });
    return true;
  }

  function stop() {
    state.subscriptions.splice(0).forEach((unsubscribe) => { try { unsubscribe(); } catch (_) {} });
    state.started = false;
  }

  return Object.freeze({
    version: VERSION,
    ROOTS,
    LIVE_STATES,
    state,
    normalizeState,
    isLiveState,
    buildEncounterId,
    combatantKey,
    prepareLiveCombatants,
    filterActiveCombatants,
    stageCombatant,
    removeStagedCombatant,
    clearDraft,
    startEncounter,
    resetEncounter,
    init,
    stop,
  });
});