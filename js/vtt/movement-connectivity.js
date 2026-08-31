(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.LuminousVttMovementConnectivity = api;
    api.installTokenState(root);
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value ?? '').trim();

  function connectionRefFor(base, host, options = {}) {
    if (options.connectionRef) return options.connectionRef;
    const firebase = options.firebase || base?.hostFirebase?.(host) || host?.firebase;
    const db = options.db || firebase?.database?.() || null;
    return { ref: db?.ref?.('.info/connected') || null, db, firebase };
  }

  function turnExtras(token = {}) {
    return {
      movementTurnStart: token.movementTurnStart ? clone(token.movementTurnStart) : null,
      dashActionType: clean(token.dashActionType) || null,
    };
  }

  function applyTurnExtras(token, position = {}) {
    if (!token || !position || typeof position !== 'object') return token;
    if (position.movementTurnStart && typeof position.movementTurnStart === 'object') token.movementTurnStart = clone(position.movementTurnStart);
    else delete token.movementTurnStart;
    const actionType = clean(position.dashActionType);
    if (actionType) token.dashActionType = actionType;
    else delete token.dashActionType;
    return token;
  }

  function installTokenState(host) {
    const base = host?.LuminousVttTokenState;
    if (!base || base.__onlineOnlyMovementPatch) return base || null;
    const createBridgeBase = base.createBridge;

    function createBridge(options = {}) {
      const bridge = createBridgeBase(options);
      const mapData = options.mapData || {};
      const { ref: connectedRef, db, firebase } = connectionRefFor(base, host, options);
      const mapId = String(bridge.mapId || mapData.id || mapData.mapId || 'default');
      const playerRoot = base.PLAYER_ROOT || 'campaña/jugadores';
      const worldRoot = `${base.WORLD_ROOT || 'campaña/estado_mundo/vttTokens'}/${mapId}`;
      let requestedStart = false;
      let connected = false;
      let innerStarted = false;
      let connectionHandler = null;
      let playerExtrasHandler = null;
      let worldExtrasHandler = null;

      function playerTokenFor(playerKey, record = {}) {
        const normalizedKey = clean(playerKey);
        const recordPlayerId = clean(record.playerId || playerKey);
        return (mapData.tokens || []).find((entry) => {
          if (entry.canonicalScope === 'player') return clean(entry.canonicalPlayerKey || entry.playerId) === normalizedKey || clean(entry.playerId) === recordPlayerId;
          return recordPlayerId && recordPlayerId === clean(bridge.identity?.playerId) && (entry.viewer === true || entry.characterLink?.mode === 'current_player');
        }) || null;
      }

      function applyPlayerExtras(rawPlayers = {}) {
        Object.entries(rawPlayers || {}).forEach(([playerKey, playerData]) => {
          const record = playerData?.vttTokenState?.[mapId];
          if (!record?.position) return;
          const token = playerTokenFor(playerKey, record);
          if (token) applyTurnExtras(token, record.position);
        });
      }

      function applyWorldExtras(rawWorld = {}) {
        Object.entries(rawWorld || {}).forEach(([key, record]) => {
          if (!record?.position) return;
          const tokenId = clean(record.tokenId || key);
          const token = (mapData.tokens || []).find((entry) => clean(entry.id) === tokenId);
          if (token) applyTurnExtras(token, record.position);
        });
      }

      function attachExtraListeners() {
        if (!db || playerExtrasHandler || worldExtrasHandler) return;
        playerExtrasHandler = (snapshot) => applyPlayerExtras(snapshot?.val?.() || {});
        worldExtrasHandler = (snapshot) => applyWorldExtras(snapshot?.val?.() || {});
        db.ref(playerRoot).on('value', playerExtrasHandler);
        db.ref(worldRoot).on('value', worldExtrasHandler);
      }

      function detachExtraListeners() {
        if (db && playerExtrasHandler) db.ref(playerRoot).off('value', playerExtrasHandler);
        if (db && worldExtrasHandler) db.ref(worldRoot).off('value', worldExtrasHandler);
        playerExtrasHandler = null;
        worldExtrasHandler = null;
      }

      function startInner() {
        if (innerStarted || !connected) return false;
        innerStarted = Boolean(bridge.start?.() !== false);
        attachExtraListeners();
        return innerStarted;
      }

      function stopInner() {
        detachExtraListeners();
        if (innerStarted) bridge.stop?.();
        innerStarted = false;
      }

      function setConnected(value) {
        const next = Boolean(value);
        if (connected === next) return connected;
        connected = next;
        if (!connected) stopInner();
        else if (requestedStart) startInner();
        return connected;
      }

      function start() {
        if (requestedStart) return connected;
        requestedStart = true;
        if (!connectedRef?.on) return false;
        connectionHandler = (snapshot) => setConnected(snapshot?.val?.() === true);
        connectedRef.on('value', connectionHandler);
        return connected;
      }

      function stop() {
        requestedStart = false;
        stopInner();
        if (connectedRef && connectionHandler) connectedRef.off?.('value', connectionHandler);
        connectionHandler = null;
        connected = false;
      }

      function assertConnected() {
        if (!connected || !db) throw new Error('VTT_OFFLINE_NO_UPDATE');
      }

      async function persistExtras(token, result = {}) {
        if (!token || !result?.scope || !result?.key) return turnExtras(token);
        assertConnected();
        const extras = turnExtras(token);
        const updates = {
          'position/movementTurnStart': extras.movementTurnStart,
          'position/dashActionType': extras.dashActionType,
        };
        if (result.scope === 'player') {
          const key = base.firebaseKey?.(result.key, 'player') || clean(result.key);
          await db.ref(`${playerRoot}/${key}/vttTokenState/${mapId}`).update(updates);
        } else if (result.scope === 'world') {
          const key = base.firebaseKey?.(result.key, 'token') || clean(result.key);
          await db.ref(worldRoot).child(key).update(updates);
        }
        return extras;
      }

      async function saveToken(token) {
        assertConnected();
        const result = await bridge.saveToken(token);
        await persistExtras(token, result);
        return { ...result, turn: turnExtras(token), connected: true };
      }

      async function createWorldToken(token) {
        assertConnected();
        const result = typeof bridge.createWorldToken === 'function' ? await bridge.createWorldToken(token) : await bridge.saveToken(token);
        await persistExtras(token, result);
        return { ...result, turn: turnExtras(token), connected: true };
      }

      return Object.freeze({
        ...bridge,
        start,
        stop,
        saveToken,
        createWorldToken,
        isConnected: () => connected,
        applyPlayerTurnExtras: applyPlayerExtras,
        applyWorldTurnExtras: applyWorldExtras,
      });
    }

    const patched = Object.freeze({
      ...base,
      __onlineOnlyMovementPatch: true,
      turnExtras,
      applyTurnExtras,
      createBridge,
    });
    host.LuminousVttTokenState = patched;
    return patched;
  }

  function installRealtime(host) {
    const base = host?.LuminousVttMovementRealtime;
    if (!base || base.__onlineOnlyMovementPatch) return base || null;
    const createControllerBase = base.createController;

    function createController(options = {}) {
      const firebase = options.firebase || base.hostFirebase?.(options.root || host) || host?.firebase;
      const db = options.db || firebase?.database?.() || null;
      const connectedRef = options.connectionRef || db?.ref?.('.info/connected') || null;
      let requestedStart = false;
      let stopped = false;
      let connected = false;
      let connectionHandler = null;
      let inner = null;

      function createInner() {
        if (!connected || stopped || inner) return inner;
        inner = createControllerBase(options);
        if (requestedStart) inner.start?.();
        return inner;
      }

      function dropInner() {
        inner?.stop?.();
        inner = null;
      }

      function setConnected(value) {
        const next = Boolean(value);
        if (connected === next) return connected;
        connected = next;
        if (!connected) dropInner();
        else if (requestedStart) createInner();
        return connected;
      }

      function start() {
        if (requestedStart || stopped) return snapshot();
        requestedStart = true;
        if (!connectedRef?.on) return snapshot();
        connectionHandler = (snapshotValue) => setConnected(snapshotValue?.val?.() === true);
        connectedRef.on('value', connectionHandler);
        return snapshot();
      }

      function stop() {
        if (stopped) return;
        stopped = true;
        requestedStart = false;
        dropInner();
        if (connectedRef && connectionHandler) connectedRef.off?.('value', connectionHandler);
        connectionHandler = null;
        connected = false;
      }

      function requireOnline() {
        if (!connected || !inner) throw new Error('VTT_OFFLINE_NO_UPDATE');
        return inner;
      }

      function snapshot() {
        const value = inner?.snapshot?.() || {};
        return Object.freeze({ ...value, started: requestedStart, stopped, connected, onlineOnly: true });
      }

      return Object.freeze({
        start,
        stop,
        snapshot,
        finalizeToken: (token, saveCanonical) => requireOnline().finalizeToken(token, saveCanonical),
        schedulePreview: (token) => connected && inner ? inner.schedulePreview(token) : false,
        handleIncoming: (...args) => connected && inner ? inner.handleIncoming(...args) : false,
        clearIncoming: (...args) => connected && inner ? inner.clearIncoming(...args) : false,
        handleCanonicalSync: (...args) => connected && inner ? inner.handleCanonicalSync(...args) : false,
        reconcilePlayerSubscriptions: (...args) => connected && inner ? inner.reconcilePlayerSubscriptions(...args) : false,
        previewRefForToken: (token) => connected && inner ? inner.previewRefForToken(token) : null,
        isConnected: () => connected,
      });
    }

    const patched = Object.freeze({ ...base, __onlineOnlyMovementPatch: true, createController });
    host.LuminousVttMovementRealtime = patched;
    return patched;
  }

  return Object.freeze({ turnExtras, applyTurnExtras, installTokenState, installRealtime });
});
