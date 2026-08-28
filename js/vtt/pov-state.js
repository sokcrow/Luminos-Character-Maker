(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttPovState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
  const PLAYER_ROOT = 'campaña/jugadores';
  const WORLD_ROOT = 'campaña/estado_mundo/vttPov';
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

  function normalizeLookDeg(value, root = browserRoot) {
    const pov = root?.LuminousVttPovEngine;
    if (pov?.normalizeAngleDeg) return pov.normalizeAngleDeg(value);
    const angle = Number(value) || 0;
    return ((angle % 360) + 360) % 360;
  }

  function playerKeyForToken(token = {}, current = {}) {
    return clean(token.canonicalPlayerKey || token.playerId || (token.characterLink?.mode === 'current_player' ? current.playerId : ''));
  }

  function createBridge({ mapData, isDm = false, onChanged, root = browserRoot } = {}) {
    if (!mapData) throw new Error('MAP_DATA_REQUIRED');
    const firebase = hostFirebase(root);
    const db = firebase?.database?.() || null;
    const mapId = firebaseKey(mapData.id || mapData.mapId || 'default');
    const current = identity(root);
    const subscriptions = [];
    let playerRecords = {};
    let worldRecords = {};
    let timer = null;
    let started = false;

    const playersRef = () => db?.ref(PLAYER_ROOT);
    const playerPovRef = (playerId) => db?.ref(`${PLAYER_ROOT}/${firebaseKey(playerId, 'player')}/vttPov/${mapId}`);
    const worldRef = () => db?.ref(`${WORLD_ROOT}/${mapId}`);

    function subscribe(ref, handler) {
      if (!ref?.on) return;
      ref.on('value', handler);
      subscriptions.push(() => ref.off('value', handler));
    }

    function applyDefaults(token) {
      if (!token) return;
      if (!Number.isFinite(Number(token.lookDeg))) token.lookDeg = normalizeLookDeg(token.facingDeg || 0, root);
      if (!Number.isFinite(Number(token.eyeHeightFt))) token.eyeHeightFt = 5;
    }

    function applyRecords() {
      for (const token of Array.isArray(mapData.tokens) ? mapData.tokens : []) {
        applyDefaults(token);
        const playerKey = playerKeyForToken(token, current);
        if (playerKey) {
          const value = playerRecords?.[playerKey]?.vttPov?.[mapId]?.lookDeg;
          if (Number.isFinite(Number(value))) token.lookDeg = normalizeLookDeg(value, root);
          continue;
        }
        const worldValue = worldRecords?.[firebaseKey(token.id, 'token')]?.lookDeg;
        if (Number.isFinite(Number(worldValue))) token.lookDeg = normalizeLookDeg(worldValue, root);
      }
      if (typeof onChanged === 'function') onChanged({ type: 'look' });
    }

    async function saveLook(token) {
      if (!token) throw new Error('TOKEN_REQUIRED');
      applyDefaults(token);
      const lookDeg = normalizeLookDeg(token.lookDeg, root);
      token.lookDeg = lookDeg;
      const playerKey = playerKeyForToken(token, current);
      if (playerKey) {
        const ownerUid = clean(token.canonicalOwnerUid || token.ownerUid);
        if (!isDm && playerKey !== current.playerId && ownerUid !== current.uid) throw new Error('PLAYER_TOKEN_OWNERSHIP_REQUIRED');
        if (db) await playerPovRef(playerKey).child('lookDeg').set(lookDeg);
        return { valid: true, scope: 'player', key: playerKey, lookDeg };
      }
      if (!isDm) throw new Error('DM_REQUIRED');
      const key = firebaseKey(token.id, 'token');
      if (db) await worldRef().child(key).set({ lookDeg, updatedByUid: current.uid || DM_UID, updatedAt: firebase.database.ServerValue.TIMESTAMP });
      return { valid: true, scope: 'world', key, lookDeg };
    }

    function start() {
      if (started) return true;
      started = true;
      applyRecords();
      if (!db) return false;
      subscribe(playersRef(), (snapshot) => { playerRecords = snapshot.val() || {}; applyRecords(); });
      subscribe(worldRef(), (snapshot) => { worldRecords = snapshot.val() || {}; applyRecords(); });
      timer = root?.setInterval?.(applyRecords, 750) || null;
      return true;
    }

    function stop() {
      subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
      if (timer != null) root?.clearInterval?.(timer);
      timer = null;
      started = false;
    }

    return Object.freeze({
      mapId,
      isDm: Boolean(isDm),
      identity: current,
      start,
      stop,
      saveLook,
      applyRecords,
      applyDefaults,
    });
  }

  return Object.freeze({
    DM_UID,
    PLAYER_ROOT,
    WORLD_ROOT,
    hostWindow,
    hostFirebase,
    identity,
    firebaseKey,
    normalizeLookDeg,
    playerKeyForToken,
    createBridge,
  });
});
