(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttActorLibraryState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';
  const PLAYERS_ROOT = 'campaña/jugadores';
  const ACTORS_ROOT = 'campaña/actores';
  const NPCS_ROOT = 'campaña/base_datos_npcs';

  function hostWindow(root = browserRoot) {
    if (!root) return null;
    try { if (root.parent && root.parent !== root && root.parent.document) return root.parent; } catch (_) {}
    return root;
  }
  function hostFirebase(root = browserRoot) { const host = hostWindow(root); return host?.firebase || root?.firebase || null; }
  function runtime(root = browserRoot) {
    if (root?.LuminousVttActorLibrary) return root.LuminousVttActorLibrary;
    if (typeof require !== 'undefined') { try { return require('./actor-library.js'); } catch (_) {} }
    return null;
  }

  function createBridge({ onChanged, root = browserRoot } = {}) {
    const actorRuntime = runtime(root);
    if (!actorRuntime) throw new Error('ACTOR_LIBRARY_RUNTIME_REQUIRED');
    const db = hostFirebase(root)?.database?.() || null;
    const subscriptions = [];
    let players = {}, actors = {}, npcs = {}, started = false;

    function subscribe(path, assign) {
      if (!db) return;
      const ref = db.ref(path);
      const handler = (snapshot) => { assign(snapshot.val() || {}); if (typeof onChanged === 'function') onChanged(list()); };
      ref.on('value', handler);
      subscriptions.push(() => ref.off('value', handler));
    }

    function list() { return actorRuntime.mergeCollections({ players, actors, npcs }); }
    function get(key) { return list().find((actor) => actor.key === key) || null; }

    function start() {
      if (started) return true;
      started = true;
      if (!db) return false;
      subscribe(PLAYERS_ROOT, (value) => { players = value; });
      subscribe(ACTORS_ROOT, (value) => { actors = value; });
      subscribe(NPCS_ROOT, (value) => { npcs = value; });
      return true;
    }
    function stop() { subscriptions.splice(0).forEach((unsubscribe) => unsubscribe()); started = false; }

    return Object.freeze({ start, stop, list, get, applyPlayers: (value) => { players = value || {}; }, applyActors: (value) => { actors = value || {}; }, applyNpcs: (value) => { npcs = value || {}; } });
  }

  return Object.freeze({ PLAYERS_ROOT, ACTORS_ROOT, NPCS_ROOT, hostWindow, hostFirebase, createBridge });
});