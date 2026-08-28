(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMemoryState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
  const PLAYER_ROOT = 'campaña/jugadores';
  const OVERRIDE_ROOT = 'campaña/estado_mundo/vttMemoryOverrides';
  const clean = (value) => String(value ?? '').trim();

  function hostWindow(root = browserRoot) {
    if (!root) return null;
    try { if (root.parent && root.parent !== root && root.parent.document) return root.parent; } catch (_) {}
    return root;
  }

  function hostFirebase(root = browserRoot) {
    const host = hostWindow(root);
    return host?.firebase || root?.firebase || null;
  }

  function identity(root = browserRoot) {
    const host = hostWindow(root);
    const data = host?.datosJugador || {};
    let uid = '';
    try { uid = clean(hostFirebase(root)?.auth?.().currentUser?.uid); } catch (_) {}
    return {
      uid,
      playerId: clean(host?.localStorage?.getItem?.('playerId') || data.playerId || data.id),
      actorId: clean(data.actorId || data.vinculo_jugador),
    };
  }

  function firebaseKey(value, fallback = 'default') {
    return clean(value).replace(/[.#$\[\]\/]/g, '_') || fallback;
  }

  function memoryRuntime(root = browserRoot) {
    if (root?.LuminousVttMemoryEngine) return root.LuminousVttMemoryEngine;
    if (typeof require !== 'undefined') {
      try { return require('./memory-engine.js'); } catch (_) {}
    }
    return null;
  }

  function createBridge({ mapData, isDm = false, onChanged, root = browserRoot } = {}) {
    if (!mapData) throw new Error('MAP_DATA_REQUIRED');
    const memory = memoryRuntime(root);
    if (!memory) throw new Error('MEMORY_ENGINE_REQUIRED');
    const firebase = hostFirebase(root);
    const db = firebase?.database?.() || null;
    const current = identity(root);
    const mapId = firebaseKey(mapData.id || mapData.mapId || 'default');
    const subscriptions = [];
    const records = {};
    const players = {};
    const overrides = {};
    let started = false;

    const playersRootRef = () => db?.ref(PLAYER_ROOT);
    const playerMemoryRef = (playerId) => db?.ref(`${PLAYER_ROOT}/${firebaseKey(playerId, 'player')}/vttMemory/${mapId}`);
    const overrideRootRef = () => db?.ref(`${OVERRIDE_ROOT}/${mapId}`);

    function subscribe(ref, handler) {
      if (!ref?.on) return;
      ref.on('value', handler);
      subscriptions.push(() => ref.off('value', handler));
    }

    function playerData(playerId = current.playerId) {
      const id = clean(playerId);
      if (id && players[id]) return players[id];
      const host = hostWindow(root);
      return id === current.playerId ? (host?.datosJugador || {}) : {};
    }

    function memoryFor(playerId = current.playerId) {
      const id = clean(playerId);
      return memory.normalizeMemory(records[id] || playerData(id)?.vttMemory?.[mapId] || {});
    }

    function overrideFor(playerId = current.playerId) {
      return { ...(overrides[clean(playerId)] || {}) };
    }

    function applyPlayers(raw = {}) {
      Object.keys(players).forEach((key) => delete players[key]);
      Object.entries(raw || {}).forEach(([playerId, data]) => {
        players[playerId] = data || {};
        records[playerId] = memory.normalizeMemory(data?.vttMemory?.[mapId] || records[playerId] || {});
      });
      if (typeof onChanged === 'function') onChanged({ type: 'players' });
    }

    function applyCurrent(raw) {
      if (!current.playerId) return;
      records[current.playerId] = memory.normalizeMemory(raw || {});
      if (typeof onChanged === 'function') onChanged({ type: 'memory', playerId: current.playerId });
    }

    function applyOverrides(raw = {}) {
      Object.keys(overrides).forEach((key) => delete overrides[key]);
      Object.entries(raw || {}).forEach(([playerId, value]) => { overrides[playerId] = value || {}; });
      if (typeof onChanged === 'function') onChanged({ type: 'override' });
    }

    async function saveMemory(playerId, rawMemory) {
      const id = clean(playerId || current.playerId);
      if (!id) throw new Error('PLAYER_ID_REQUIRED');
      if (!isDm && id !== current.playerId) throw new Error('PLAYER_MEMORY_OWNERSHIP_REQUIRED');
      const normalized = memory.normalizeMemory(rawMemory);
      records[id] = normalized;
      if (players[id]) players[id].vttMemory = { ...(players[id].vttMemory || {}), [mapId]: normalized };
      if (db) await playerMemoryRef(id).set(normalized);
      if (typeof onChanged === 'function') onChanged({ type: 'memory', playerId: id });
      return normalized;
    }

    async function clearMemory(playerId = current.playerId) {
      const id = clean(playerId);
      if (!id) throw new Error('PLAYER_ID_REQUIRED');
      return saveMemory(id, memory.emptyMemory());
    }

    async function saveOverride(playerId, override = null) {
      const id = clean(playerId);
      if (!id) throw new Error('PLAYER_ID_REQUIRED');
      if (!isDm) throw new Error('DM_REQUIRED');
      if (override == null || (typeof override === 'object' && !Object.keys(override).length)) delete overrides[id];
      else overrides[id] = { ...override };
      if (db) {
        const ref = overrideRootRef().child(firebaseKey(id, 'player'));
        if (override == null || (typeof override === 'object' && !Object.keys(override).length)) await ref.remove();
        else await ref.set({ ...override, updatedByUid: current.uid || DM_UID, updatedAt: firebase.database.ServerValue.TIMESTAMP });
      }
      if (typeof onChanged === 'function') onChanged({ type: 'override', playerId: id });
      return overrideFor(id);
    }

    function start() {
      if (started) return true;
      started = true;
      if (!db) return false;
      if (isDm) subscribe(playersRootRef(), (snapshot) => applyPlayers(snapshot.val() || {}));
      else if (current.playerId) subscribe(playerMemoryRef(current.playerId), (snapshot) => applyCurrent(snapshot.val() || {}));
      subscribe(overrideRootRef(), (snapshot) => applyOverrides(snapshot.val() || {}));
      return true;
    }

    function stop() {
      subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
      started = false;
    }

    return Object.freeze({
      mapId,
      isDm: Boolean(isDm),
      identity: current,
      start,
      stop,
      memoryFor,
      overrideFor,
      playerData,
      saveMemory,
      clearMemory,
      saveOverride,
      applyPlayers,
      applyOverrides,
    });
  }

  return Object.freeze({
    DM_UID,
    PLAYER_ROOT,
    OVERRIDE_ROOT,
    hostWindow,
    hostFirebase,
    identity,
    firebaseKey,
    createBridge,
  });
});
