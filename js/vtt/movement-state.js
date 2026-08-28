(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMovementState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
  const ROOT = 'campaña/estado_mundo/vttMovement';
  const clean = (value) => String(value ?? '').trim();

  function hostWindow(root = browserRoot) {
    if (!root) return null;
    try { if (root.parent && root.parent !== root && root.parent.document) return root.parent; } catch (_) {}
    return root;
  }
  function hostFirebase(root = browserRoot) { const host = hostWindow(root); return host?.firebase || root?.firebase || null; }
  function currentUid(root = browserRoot) { try { return clean(hostFirebase(root)?.auth?.().currentUser?.uid); } catch (_) { return ''; } }
  function isDmSurface(root = browserRoot) { return currentUid(root) === DM_UID || Boolean(hostWindow(root)?.document?.body?.classList?.contains('on-game-dashboard')); }
  function runtime(root = browserRoot) {
    if (root?.LuminousVttMovementEngine) return root.LuminousVttMovementEngine;
    if (typeof require !== 'undefined') { try { return require('./movement-engine.js'); } catch (_) {} }
    return null;
  }
  function safeKey(value) { return clean(value).replace(/[.#$\[\]\/]/g, '_') || 'default'; }

  function createBridge({ mapData, isDm = null, onChanged, root = browserRoot } = {}) {
    if (!mapData) throw new Error('MAP_DATA_REQUIRED');
    const movement = runtime(root);
    if (!movement) throw new Error('MOVEMENT_ENGINE_REQUIRED');
    const firebase = hostFirebase(root);
    const db = firebase?.database?.() || null;
    const dm = isDm == null ? isDmSurface(root) : Boolean(isDm);
    const mapId = safeKey(mapData.id || mapData.mapId || 'default');
    const ref = () => db?.ref(`${ROOT}/${mapId}`);
    let state = movement.normalizeWorldState(mapData.movement?.worldState || {});
    let handler = null;
    let started = false;

    mapData.movement ||= {};
    mapData.movement.worldState = state;

    function apply(raw = {}) {
      state = movement.normalizeWorldState(raw);
      mapData.movement ||= {};
      mapData.movement.worldState = state;
      if (typeof onChanged === 'function') onChanged(state);
      return state;
    }

    function current() { return movement.normalizeWorldState(state); }

    async function save(next) {
      if (!dm) throw new Error('DM_REQUIRED');
      const normalized = movement.normalizeWorldState(next);
      const payload = {
        ...normalized,
        updatedByUid: currentUid(root) || DM_UID,
        updatedAt: firebase?.database?.ServerValue?.TIMESTAMP || Date.now(),
      };
      apply(payload);
      if (db) await ref().set(payload);
      return current();
    }

    async function setMode(mode) {
      const currentState = current();
      const normalizedMode = String(mode || '').toLowerCase() === 'round' ? 'round' : 'free';
      const next = { ...currentState, mode: normalizedMode };
      if (normalizedMode === 'round' && currentState.mode !== 'round') next.roundId = Math.max(1, currentState.roundId + 1);
      return save(next);
    }

    async function nextRound() {
      const currentState = current();
      if (currentState.mode !== 'round') throw new Error('ROUND_MODE_REQUIRED');
      return save({
        ...currentState,
        roundId: currentState.roundId + 1,
        worldSeconds: currentState.worldSeconds + currentState.roundSeconds,
      });
    }

    function start() {
      if (started) return true;
      started = true;
      if (!db) { if (typeof onChanged === 'function') onChanged(current()); return false; }
      handler = (snapshot) => apply(snapshot.val() || {});
      ref().on('value', handler);
      return true;
    }

    function stop() {
      if (db && handler) ref().off('value', handler);
      handler = null;
      started = false;
    }

    return Object.freeze({ mapId, isDm: dm, start, stop, apply, current, save, setMode, nextRound });
  }

  return Object.freeze({ DM_UID, ROOT, hostWindow, hostFirebase, currentUid, isDmSurface, safeKey, createBridge });
});