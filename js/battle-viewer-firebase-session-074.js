(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousBattleViewerFirebaseSession074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const FALLBACK_DM_UID = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
  const ROOTS = Object.freeze({
    configDmUid: "campaña/config/dm_uid",
    players: "campaña/jugadores",
    combatState: "campaña/combate/estado",
    combatants: "campaña/combate/combatants",
    plannedActions: "campaña/combate/plannedActions",
    units: "campaña/base_datos_unidades",
    skills: "campaña/base_datos_skills",
    connected: ".info/connected",
  });

  const state = {
    status: "idle",
    started: false,
    readyPromise: null,
    app: null,
    auth: null,
    db: null,
    user: null,
    uid: null,
    role: null,
    playerId: null,
    dmUid: FALLBACK_DM_UID,
    connected: null,
    error: null,
    diagnostics: [],
  };

  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function publicState() {
    return {
      version: VERSION,
      status: state.status,
      started: state.started,
      uid: state.uid,
      role: state.role,
      playerId: state.playerId,
      dmUid: state.dmUid,
      connected: state.connected,
      error: state.error ? { code: state.error.code || "FIREBASE_SESSION_FAILED", message: state.error.message || String(state.error) } : null,
      diagnostics: clone(state.diagnostics),
    };
  }

  function firebaseSdk(options = {}) { return options.firebase || global?.firebase || null; }

  function resolveServices(options = {}) {
    const sdk = firebaseSdk(options);
    if (!sdk) return { ok: false, reason: "FIREBASE_SDK_REQUIRED", app: null, auth: null, db: null };

    let app = options.app || null;
    try {
      if (!app && Array.isArray(sdk.apps) && sdk.apps.length && typeof sdk.app === "function") app = sdk.app();
      if (!app && Array.isArray(sdk.apps) && sdk.apps.length) app = sdk.apps[0];
      if (!app && options.config && typeof sdk.initializeApp === "function") app = sdk.initializeApp(options.config);
    } catch (error) {
      return { ok: false, reason: "FIREBASE_APP_INIT_FAILED", error, app: null, auth: null, db: null };
    }

    let auth = options.auth || null;
    let db = options.db || null;
    try {
      if (!auth && typeof sdk.auth === "function") auth = sdk.auth();
      if (!db && typeof sdk.database === "function") db = sdk.database();
    } catch (error) {
      return { ok: false, reason: "FIREBASE_SERVICE_INIT_FAILED", error, app, auth: null, db: null };
    }
    if (!auth?.onAuthStateChanged) return { ok: false, reason: "FIREBASE_AUTH_REQUIRED", app, auth, db };
    if (!db?.ref) return { ok: false, reason: "FIREBASE_DATABASE_REQUIRED", app, auth, db };
    return { ok: true, reason: null, app, auth, db };
  }

  function waitForInitialAuth(auth, timeoutMs = 10000) {
    if (auth?.currentUser) return Promise.resolve({ ok: true, user: auth.currentUser });
    if (!auth?.onAuthStateChanged) return Promise.resolve({ ok: false, reason: "FIREBASE_AUTH_REQUIRED", user: null });
    return new Promise((resolve) => {
      let settled = false;
      let unsubscribe = null;
      let timer = null;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        if (timer) global.clearTimeout?.(timer);
        try { unsubscribe?.(); } catch (_) {}
        resolve(result);
      };
      try {
        unsubscribe = auth.onAuthStateChanged(
          (user) => finish(user ? { ok: true, user } : { ok: false, reason: "AUTH_REQUIRED", user: null }),
          (error) => finish({ ok: false, reason: "AUTH_STATE_FAILED", error, user: null }),
        );
      } catch (error) {
        finish({ ok: false, reason: "AUTH_STATE_FAILED", error, user: null });
        return;
      }
      timer = global.setTimeout?.(() => finish({ ok: false, reason: "AUTH_TIMEOUT", user: null }), Math.max(250, Number(timeoutMs) || 10000)) || null;
      timer?.unref?.();
    });
  }

  async function readValue(db, path) {
    const snapshot = await db.ref(path).once("value");
    return typeof snapshot?.val === "function" ? snapshot.val() : null;
  }

  function playerUid(player = {}) { return clean(player.uid || player.vinculado_a || player.vinculo_jugador); }

  function resolveIdentity(uid, players = {}, dmUid = FALLBACK_DM_UID) {
    const id = clean(uid);
    const configuredDm = clean(dmUid) || FALLBACK_DM_UID;
    if (!id) return { ok: false, reason: "AUTH_REQUIRED", role: null, playerId: null };
    if (id === configuredDm || id === FALLBACK_DM_UID) return { ok: true, reason: null, role: "dm", playerId: null };

    const matches = Object.entries(players || {}).filter(([, player]) => playerUid(player || {}) === id);
    if (!matches.length) return { ok: false, reason: "PLAYER_NOT_LINKED", role: null, playerId: null };
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_PLAYER_AUTH", role: null, playerId: null, matches: matches.map(([key]) => key) };
    const [playerId, player] = matches[0];
    const approval = clean(player?.status).toLowerCase();
    if (approval && approval !== "approved") return { ok: false, reason: "PLAYER_NOT_APPROVED", role: null, playerId, status: approval };
    return { ok: true, reason: null, role: "player", playerId, player };
  }

  async function preflight(options = {}) {
    const services = resolveServices(options);
    if (!services.ok) return { ...services, ok: false, diagnostics: [] };

    const authResult = await waitForInitialAuth(services.auth, options.authTimeoutMs);
    if (!authResult.ok) return { ...services, ...authResult, ok: false, diagnostics: [] };
    const uid = clean(authResult.user?.uid);
    const diagnostics = [];

    let dmUid = FALLBACK_DM_UID;
    let players = {};
    try {
      const [configuredDmUid, playerRecords, combatState, combatants, plannedActions, units, skills] = await Promise.all([
        readValue(services.db, ROOTS.configDmUid),
        readValue(services.db, ROOTS.players),
        readValue(services.db, ROOTS.combatState),
        readValue(services.db, ROOTS.combatants),
        readValue(services.db, ROOTS.plannedActions),
        readValue(services.db, ROOTS.units),
        readValue(services.db, ROOTS.skills),
      ]);
      dmUid = clean(configuredDmUid) || FALLBACK_DM_UID;
      players = playerRecords && typeof playerRecords === "object" ? playerRecords : {};
      diagnostics.push(
        { path: ROOTS.combatState, readable: true, present: combatState != null },
        { path: ROOTS.combatants, readable: true, present: combatants != null },
        { path: ROOTS.plannedActions, readable: true, present: plannedActions != null },
        { path: ROOTS.units, readable: true, present: units != null },
        { path: ROOTS.skills, readable: true, present: skills != null },
      );
    } catch (error) {
      return { ok: false, reason: "FIREBASE_READ_PREFLIGHT_FAILED", error, app: services.app, auth: services.auth, db: services.db, user: authResult.user, uid, diagnostics };
    }

    const identity = resolveIdentity(uid, players, dmUid);
    if (!identity.ok) return { ...services, ...identity, ok: false, user: authResult.user, uid, dmUid, diagnostics };

    let connected = null;
    try { connected = Boolean(await readValue(services.db, ROOTS.connected)); }
    catch (_) { connected = null; }

    return {
      ok: true,
      reason: null,
      app: services.app,
      auth: services.auth,
      db: services.db,
      user: authResult.user,
      uid,
      role: identity.role,
      playerId: identity.playerId || null,
      dmUid,
      connected,
      diagnostics,
    };
  }

  function emit(name, detail) {
    try { global.dispatchEvent?.(new global.CustomEvent(name, { detail })); } catch (_) {}
  }

  function applyResult(result) {
    state.started = true;
    state.app = result.app || null;
    state.auth = result.auth || null;
    state.db = result.db || null;
    state.user = result.user || null;
    state.uid = clean(result.uid) || null;
    state.role = result.role || null;
    state.playerId = result.playerId || null;
    state.dmUid = clean(result.dmUid) || FALLBACK_DM_UID;
    state.connected = result.connected ?? null;
    state.diagnostics = clone(result.diagnostics || []);
    state.error = result.ok ? null : Object.assign(new Error(result.reason || "Firebase session failed."), { code: result.reason || "FIREBASE_SESSION_FAILED" });
    state.status = result.ok ? "ready" : "error";
    emit(result.ok ? "luminous:firebase-session-ready" : "luminous:firebase-session-error", publicState());
    return result;
  }

  function start(options = {}) {
    if (state.readyPromise && options.force !== true) return state.readyPromise;
    state.status = "starting";
    state.error = null;
    state.readyPromise = preflight(options).then(applyResult).catch((error) => applyResult({ ok: false, reason: "FIREBASE_SESSION_FAILED", error, diagnostics: [] }));
    return state.readyPromise;
  }

  function services() { return { app: state.app, auth: state.auth, db: state.db }; }
  function isReady() { return state.status === "ready" && Boolean(state.uid && state.db && state.auth); }
  function isDm() { return isReady() && state.role === "dm"; }
  function isPlayer() { return isReady() && state.role === "player"; }

  function resetForTests() {
    Object.assign(state, {
      status: "idle", started: false, readyPromise: null, app: null, auth: null, db: null, user: null,
      uid: null, role: null, playerId: null, dmUid: FALLBACK_DM_UID, connected: null, error: null, diagnostics: [],
    });
  }

  return Object.freeze({
    version: VERSION,
    FALLBACK_DM_UID,
    ROOTS,
    state,
    publicState,
    resolveServices,
    waitForInitialAuth,
    readValue,
    playerUid,
    resolveIdentity,
    preflight,
    start,
    services,
    isReady,
    isDm,
    isPlayer,
    resetForTests,
  });
});
