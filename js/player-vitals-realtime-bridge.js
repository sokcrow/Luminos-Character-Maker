(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousPlayerVitalsRealtimeBridge = api;
  if (global?.document) api.start();
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "1.0.1";
  const ROOTS = Object.freeze({
    players: "campaña/jugadores",
    combatants: "campaña/combate/combatants",
    state: "campaña/combate/estado",
  });

  const state = {
    started: false,
    db: null,
    combatantsRef: null,
    combatantsHandler: null,
    stateRef: null,
    stateHandler: null,
    combatPhase: "",
    retryTimer: null,
    lastDigest: "",
  };

  const clean = (value) => String(value ?? "").trim();
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;

  function adapterState() {
    return global.LuminousCombatLiveAdapter073?.state || null;
  }

  function canonicalPlayerId(unit = {}) {
    return clean(
      unit.canonicalPlayerKey
      || unit.ownerPlayerId
      || unit.playerId
      || unit.characterLink?.playerId
      || unit.actorRef?.scope === "players" && unit.actorRef?.id
      || ""
    );
  }

  function isPlayerCombatant(unit = {}) {
    return Boolean(
      canonicalPlayerId(unit)
      && (
        unit.isPlayer === true
        || clean(unit.actorCategory).toLowerCase() === "player"
        || clean(unit.category).toLowerCase() === "player"
        || clean(unit.canonicalScope).toLowerCase() === "player"
        || clean(unit.characterLink?.mode).toLowerCase() === "player"
      )
    );
  }

  function vitalSnapshot(unit = {}) {
    if (!isPlayerCombatant(unit)) return null;
    const playerId = canonicalPlayerId(unit);
    const rawMax = [
      unit.maxHp,
      unit.maxHP,
      unit.hp_max,
      unit.combatStats?.hp_max,
    ].map(finite).find((value) => value != null);
    const rawHp = [
      unit.hp,
      unit.currentHp,
      unit.currentHP,
      unit.hp_actual,
      unit.combatStats?.hp_actual,
    ].map(finite).find((value) => value != null);
    const rawSp = [
      unit.sp,
      unit.currentSp,
      unit.currentSP,
      unit.sp_actual,
      unit.combatStats?.sp_actual,
    ].map(finite).find((value) => value != null);

    const maxHp = rawMax != null ? Math.max(1, rawMax) : null;
    const hp = rawHp != null
      ? Math.max(0, maxHp != null ? Math.min(rawHp, maxHp) : rawHp)
      : null;
    const sp = rawSp != null ? rawSp : null;

    if (hp == null && maxHp == null && sp == null) return null;
    return { playerId, hp, maxHp, sp };
  }

  function updatesForVital(vital = {}) {
    const playerId = clean(vital.playerId);
    if (!playerId) return {};
    const base = `${ROOTS.players}/${playerId}`;
    const updates = {};

    if (vital.hp != null) {
      updates[`${base}/hp`] = vital.hp;
      updates[`${base}/combatStats/hp_actual`] = vital.hp;
    }
    if (vital.maxHp != null) {
      updates[`${base}/hp_max`] = vital.maxHp;
      updates[`${base}/combatStats/hp_max`] = vital.maxHp;
    }
    if (vital.sp != null) {
      updates[`${base}/sp`] = vital.sp;
      updates[`${base}/combatStats/sp_actual`] = vital.sp;
    }
    return updates;
  }

  function firebaseUpdatesForSnapshot(combatants = {}) {
    const updates = {};
    Object.values(combatants || {}).forEach((unit) => {
      const vital = vitalSnapshot(unit);
      if (!vital) return;
      Object.assign(updates, updatesForVital(vital));
    });
    return updates;
  }

  function digestUpdates(updates = {}) {
    return JSON.stringify(Object.entries(updates).sort(([a], [b]) => a.localeCompare(b)));
  }

  function normalizePhase(value) {
    const raw = value && typeof value === "object"
      ? value.phase ?? value.state ?? value.status ?? ""
      : value;
    return clean(raw).toLowerCase().replace(/[\s-]+/g, "_");
  }

  function isActiveCombatPhase(value) {
    const phase = normalizePhase(value);
    return phase === "combat"
      || phase === "combat_sealed"
      || phase === "running"
      || phase === "sealed"
      || phase === "combat_running"
      || phase === "combat_resolution";
  }

  async function syncSnapshot(db, combatants = {}, options = {}) {
    if (!db?.ref) return { synced: false, reason: "DATABASE_REQUIRED", updates: {} };
    const updates = firebaseUpdatesForSnapshot(combatants);
    if (!Object.keys(updates).length) return { synced: false, reason: "NO_PLAYER_VITALS", updates };

    const digest = digestUpdates(updates);
    if (!options.force && digest === state.lastDigest) {
      return { synced: false, reason: "UNCHANGED", updates };
    }

    await db.ref().update(updates);
    state.lastDigest = digest;
    return { synced: true, reason: null, updates };
  }

  async function syncActiveSnapshot(db, combatants = {}, phase = state.combatPhase, options = {}) {
    if (!isActiveCombatPhase(phase)) {
      return { synced: false, reason: "INACTIVE_COMBAT_PHASE", updates: {} };
    }
    return syncSnapshot(db, combatants, options);
  }

  function currentDatabase() {
    const adapterDb = adapterState()?.db;
    if (adapterDb?.ref) return adapterDb;
    try {
      const db = global.firebase?.database?.();
      if (db?.ref) return db;
    } catch (_) {}
    return null;
  }

  function isDmAuthority() {
    const role = clean(adapterState()?.role).toLowerCase();
    return role === "dm";
  }

  function bind() {
    if (state.combatantsRef && state.stateRef) return true;
    const role = clean(adapterState()?.role).toLowerCase();
    if (role && role !== "dm") return true;
    if (!isDmAuthority()) return false;
    const db = currentDatabase();
    if (!db?.ref) return false;

    state.db = db;

    if (!state.stateRef) {
      const stateRef = db.ref(ROOTS.state);
      const stateHandler = (snapshot) => {
        state.combatPhase = normalizePhase(snapshot.val());
      };
      stateRef.on("value", stateHandler, (error) => global.console?.error?.("[Player Vitals Bridge state]", error));
      state.stateRef = stateRef;
      state.stateHandler = stateHandler;
    }

    if (!state.combatantsRef) {
      const ref = db.ref(ROOTS.combatants);
      const handler = (snapshot) => {
        const phase = state.combatPhase || normalizePhase(adapterState()?.combatState);
        syncActiveSnapshot(db, snapshot.val() || {}, phase).catch((error) => {
          global.console?.error?.("[Player Vitals Bridge]", error);
        });
      };
      ref.on("value", handler, (error) => global.console?.error?.("[Player Vitals Bridge subscribe]", error));
      state.combatantsRef = ref;
      state.combatantsHandler = handler;
    }
    return true;
  }

  function start() {
    if (state.started) return true;
    state.started = true;
    const attempt = () => {
      if (!state.started) return;
      if (bind()) return;
      state.retryTimer = global.setTimeout?.(attempt, 200) || null;
    };
    attempt();
    global.addEventListener?.("luminous:combat073-hydrated", bind);
    global.addEventListener?.("luminous:combat073-runtime-ready", bind);
    global.addEventListener?.("beforeunload", stop, { once: true });
    return true;
  }

  function stop() {
    state.started = false;
    if (state.retryTimer) global.clearTimeout?.(state.retryTimer);
    state.retryTimer = null;
    if (state.combatantsRef && state.combatantsHandler) {
      try { state.combatantsRef.off("value", state.combatantsHandler); } catch (_) {}
    }
    if (state.stateRef && state.stateHandler) {
      try { state.stateRef.off("value", state.stateHandler); } catch (_) {}
    }
    state.combatantsRef = null;
    state.combatantsHandler = null;
    state.stateRef = null;
    state.stateHandler = null;
    state.combatPhase = "";
    state.db = null;
    state.lastDigest = "";
    return true;
  }

  return Object.freeze({
    VERSION,
    ROOTS,
    state,
    canonicalPlayerId,
    isPlayerCombatant,
    vitalSnapshot,
    updatesForVital,
    firebaseUpdatesForSnapshot,
    digestUpdates,
    normalizePhase,
    isActiveCombatPhase,
    syncSnapshot,
    syncActiveSnapshot,
    bind,
    start,
    stop,
  });
});
