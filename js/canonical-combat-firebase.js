(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousCanonicalCombatFirebase = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.3-canonical-firebase-v1";
  const ROOT = "campaña/combate/canonical_v073";
  const ROOTS = Object.freeze({
    session: `${ROOT}/session`,
    combatants: `${ROOT}/combatants`,
    views: `${ROOT}/views`,
    plans: `${ROOT}/plans`,
  });
  const state = { db:null, auth:null, uid:null, session:null, combatants:{}, view:null, activeUnsubs:[], sessionUnsub:null, started:false };
  const clean = (v) => String(v ?? "").trim();
  const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
  const runtime = () => global.LuminousCanonicalCombatRuntime || null;

  function detachActive() {
    state.activeUnsubs.splice(0).forEach((fn) => { try { fn(); } catch (_) {} });
  }

  function subscribe(path, handler) {
    const ref = state.db.ref(path);
    const fn = (snap) => handler(snap.val());
    ref.on("value", fn);
    return () => ref.off("value", fn);
  }

  function visibleCombatants() {
    if (!state.view || !Array.isArray(state.view.visibleCombatantIds)) return clone(state.combatants) || {};
    const ids = new Set(state.view.visibleCombatantIds.map(clean).filter(Boolean));
    const own = clean(state.view.playerCombatantId);
    if (own) ids.add(own);
    return Object.fromEntries(Object.entries(state.combatants || {}).filter(([id]) => ids.has(String(id))));
  }

  function syncRuntime() {
    const rt = runtime();
    if (!rt) return false;
    const active = Boolean(state.session?.active);
    rt.setActive?.(active);
    if (!active) return true;
    rt.replaceEncounter?.(visibleCombatants(), {
      playerId: clean(state.view?.playerCombatantId) || null,
      round: Math.max(1, Number(state.session?.round) || 1),
      phase: state.session?.phase || "planning",
      encounterId: state.session?.encounterId || null,
      background: state.session?.background || null,
    });
    rt.applyView?.(state.view || { camera:{ mode:"full" }, ui:{ showRootMenu:false, readOnly:true } });
    return true;
  }

  function attachActive() {
    detachActive();
    if (!state.session?.active || !state.db) return;
    state.activeUnsubs.push(subscribe(ROOTS.combatants, (v) => { state.combatants = v || {}; syncRuntime(); }));
    if (state.uid) state.activeUnsubs.push(subscribe(`${ROOTS.views}/${state.uid}`, (v) => { state.view = v || null; syncRuntime(); }));
  }

  function onSession(v) {
    const before = Boolean(state.session?.active);
    state.session = v || { active:false };
    const active = Boolean(state.session.active);
    if (active && !before) attachActive();
    if (!active && before) { detachActive(); state.combatants = {}; state.view = null; }
    syncRuntime();
  }

  async function start(options = {}) {
    if (state.started) return { ok:true, uid:state.uid, roots:ROOTS };
    state.auth = options.auth || (global.firebase?.auth ? global.firebase.auth() : null);
    state.db = options.db || (global.firebase?.database ? global.firebase.database() : null);
    if (!state.auth || !state.db?.ref) return { ok:false, reason:"FIREBASE_REQUIRED" };
    const user = state.auth.currentUser;
    if (!user?.uid) return { ok:false, reason:"AUTH_REQUIRED" };
    state.uid = user.uid;
    state.started = true;
    const ref = state.db.ref(ROOTS.session);
    const handler = (snap) => onSession(snap.val());
    ref.on("value", handler);
    state.sessionUnsub = () => ref.off("value", handler);
    return { ok:true, uid:state.uid, roots:ROOTS };
  }

  function stop() {
    detachActive();
    try { state.sessionUnsub?.(); } catch (_) {}
    state.sessionUnsub = null;
    state.started = false;
    state.session = null;
    state.combatants = {};
    state.view = null;
    runtime()?.setActive?.(false);
  }

  return Object.freeze({
    version:VERSION, ROOT, ROOTS, start, stop, syncRuntime,
    snapshot:() => clone({ uid:state.uid, session:state.session, combatants:state.combatants, view:state.view }),
  });
});
