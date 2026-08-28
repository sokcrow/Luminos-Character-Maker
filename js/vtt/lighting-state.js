(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttLightingState = api;
})(typeof window !== 'undefined' ? window : globalThis, function (browserRoot) {
  'use strict';

  const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
  const WORLD_ROOT = 'campaña/estado_mundo/vttLighting';
  const PLAYER_ROOT = 'campaña/jugadores';
  const CHECK_COMMAND_ROOT = 'theatre_check_commands';
  const CHECK_LIVE_ROOT = 'theatre_check_live';
  const clean = (value) => String(value ?? '').trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

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
      name: clean(data.characterName || data.nombre || data.name || 'PLAYER') || 'PLAYER',
    };
  }

  function firebaseKey(value, fallback = 'default') {
    return clean(value).replace(/[.#$\[\]\/]/g, '_') || fallback;
  }

  function emptyScene() {
    return { schemaVersion: 1, sources: [], interiors: [], transformers: [], switches: [] };
  }

  function normalizeScene(raw = {}) {
    const input = raw && typeof raw === 'object' ? raw : {};
    return {
      ...emptyScene(),
      ...clone(input),
      schemaVersion: 1,
      sources: Array.isArray(input.sources) ? clone(input.sources) : [],
      interiors: Array.isArray(input.interiors) ? clone(input.interiors) : [],
      transformers: Array.isArray(input.transformers) ? clone(input.transformers) : [],
      switches: Array.isArray(input.switches) ? clone(input.switches) : [],
    };
  }

  function createBridge({ mapData, isDm = false, onChanged, notify, root = browserRoot } = {}) {
    if (!mapData) throw new Error('MAP_DATA_REQUIRED');
    const host = hostWindow(root);
    const firebase = hostFirebase(root);
    const db = firebase?.database?.() || null;
    const mapId = firebaseKey(mapData.id || mapData.mapId || 'default');
    const current = identity(root);
    const subscriptions = [];
    const liveWatchers = new Map();
    let started = false;
    let seeded = false;

    mapData.lighting ||= {};
    mapData.lighting.scene = normalizeScene(mapData.lighting.scene || mapData.lightingScene || {});

    const sceneRef = () => db?.ref(`${WORLD_ROOT}/${mapId}/scene`);
    const worldFacingRef = () => db?.ref(`${WORLD_ROOT}/${mapId}/tokenFacing`);
    const playersRef = () => db?.ref(PLAYER_ROOT);
    const playerLightingRef = (playerId) => db?.ref(`${PLAYER_ROOT}/${firebaseKey(playerId, 'player')}/vttLighting/${mapId}`);
    const playerRequestsRef = (playerId) => db?.ref(`${PLAYER_ROOT}/${firebaseKey(playerId, 'player')}/vttLightingRequests/${mapId}`);

    function emit(message, mode = 'info') { if (typeof notify === 'function') notify(message, mode); }
    function subscribe(ref, event, handler) {
      if (!ref?.on) return;
      ref.on(event, handler);
      subscriptions.push(() => ref.off(event, handler));
    }

    function replaceScene(raw) {
      mapData.lighting.scene = normalizeScene(raw || {});
      if (typeof onChanged === 'function') onChanged({ type: 'scene', scene: mapData.lighting.scene });
    }

    function applyFacingRecord(rawPlayers = {}, worldFacing = null) {
      const byPlayer = {};
      Object.entries(rawPlayers || {}).forEach(([playerKey, data]) => {
        const value = data?.vttLighting?.[mapId]?.facingDeg;
        if (Number.isFinite(Number(value))) byPlayer[playerKey] = Number(value);
      });
      for (const token of Array.isArray(mapData.tokens) ? mapData.tokens : []) {
        const playerKey = clean(token.canonicalPlayerKey || token.playerId);
        if (playerKey && Number.isFinite(Number(byPlayer[playerKey]))) token.facingDeg = Number(byPlayer[playerKey]);
      }
      const world = worldFacing || mapData.lighting.worldFacing || {};
      mapData.lighting.worldFacing = world;
      for (const token of Array.isArray(mapData.tokens) ? mapData.tokens : []) {
        if (token.canonicalScope === 'player' || token.characterLink?.mode === 'current_player') continue;
        const key = firebaseKey(token.id, 'token');
        if (Number.isFinite(Number(world[key]))) token.facingDeg = Number(world[key]);
      }
      if (typeof onChanged === 'function') onChanged({ type: 'facing' });
    }

    async function seedIfNeeded(snapshot) {
      if (seeded) return;
      seeded = true;
      const exists = typeof snapshot?.exists === 'function' ? snapshot.exists() : snapshot?.val?.() != null;
      if (!isDm || exists || !db) return;
      await sceneRef().set(normalizeScene(mapData.lighting.scene));
    }

    async function saveScene(scene = mapData.lighting.scene) {
      const normalized = normalizeScene(scene);
      replaceScene(normalized);
      if (!db) return { valid: true, offline: true, scene: normalized };
      if (!isDm) throw new Error('DM_REQUIRED');
      await sceneRef().set(normalized);
      return { valid: true, scene: normalized };
    }

    function playerToken(playerId) {
      return (mapData.tokens || []).find((token) => clean(token.canonicalPlayerKey || token.playerId) === clean(playerId))
        || (mapData.tokens || []).find((token) => token.characterLink?.mode === 'current_player' && clean(playerId) === clean(current.playerId))
        || null;
    }

    async function saveFacing(token) {
      if (!token) throw new Error('TOKEN_REQUIRED');
      const facing = Number(token.facingDeg) || 0;
      const playerKey = clean(token.canonicalPlayerKey || token.playerId || (token.characterLink?.mode === 'current_player' ? current.playerId : ''));
      if (playerKey) {
        const ownerUid = clean(token.canonicalOwnerUid || token.ownerUid);
        if (!isDm && playerKey !== current.playerId && ownerUid !== current.uid) throw new Error('PLAYER_TOKEN_OWNERSHIP_REQUIRED');
        if (db) await playerLightingRef(playerKey).child('facingDeg').set(facing);
        return { valid: true, scope: 'player', key: playerKey, facingDeg: facing };
      }
      if (!isDm) throw new Error('DM_REQUIRED');
      const key = firebaseKey(token.id, 'token');
      if (db) await worldFacingRef().child(key).set(facing);
      return { valid: true, scope: 'world', key, facingDeg: facing };
    }

    function sourceById(id) { return (mapData.lighting.scene.sources || []).find((entry) => clean(entry.id) === clean(id)) || null; }
    function switchById(id) { return (mapData.lighting.scene.switches || []).find((entry) => clean(entry.id) === clean(id)) || null; }
    function transformerById(id) { return (mapData.lighting.scene.transformers || []).find((entry) => clean(entry.id) === clean(id)) || null; }

    function requesterCanUseSource(source, playerId) {
      if (!source) return false;
      if (clean(source.ownerPlayerId) && clean(source.ownerPlayerId) === clean(playerId)) return true;
      const token = playerToken(playerId);
      return Boolean(token && clean(source.attachedToTokenId) === clean(token.id));
    }

    function playerHasConfiguredItem(playerData, itemId) {
      if (!itemId) return true;
      return Boolean(root?.LuminousVttStateBridge?.inventoryHasItem?.(playerData || {}, itemId));
    }

    async function persistRequestResult(ref, patch) {
      if (!ref?.update) return;
      await ref.update({ ...patch, decidedAt: firebase.database.ServerValue.TIMESTAMP });
    }

    async function applySwitchRequest(request, requestRef) {
      const light = root?.LuminousVttLightingEngine;
      const item = switchById(request.switchId);
      const token = playerToken(request.playerId);
      if (!item || item.interactable === false || !token) return persistRequestResult(requestRef, { status: 'denied', reason: 'SWITCH_UNAVAILABLE' });
      const distance = light?.distance3dFt?.(token, item, mapData) ?? Infinity;
      if (distance > Number(item.interactionFt || 5) + 1e-9) return persistRequestResult(requestRef, { status: 'denied', reason: 'OUT_OF_REACH' });
      item.state = item.state === 'off' ? 'on' : 'off';
      await saveScene(mapData.lighting.scene);
      return persistRequestResult(requestRef, { status: 'applied', resultState: item.state });
    }

    async function applySourceRequest(request, requestRef) {
      const light = root?.LuminousVttLightingEngine;
      const source = sourceById(request.sourceId);
      const token = playerToken(request.playerId);
      if (!source || !token || !requesterCanUseSource(source, request.playerId)) return persistRequestResult(requestRef, { status: 'denied', reason: 'SOURCE_OWNERSHIP_REQUIRED' });
      if (request.action === 'source_drop') {
        source.attachedToTokenId = null;
        source.motion = null;
        source.x = Number(token.x) || 0;
        source.y = Number(token.y) || 0;
        source.zLayer = light?.layerOf?.(token) ?? 0;
        source.elevationFt = light?.elevationFt?.(token, mapData) ?? 0;
      } else if (request.action === 'source_attach') {
        source.attachedToTokenId = token.id;
        source.motion = null;
      } else if (request.action === 'source_throw') {
        if (!Number.isFinite(Number(source.throwRangeFt))) return persistRequestResult(requestRef, { status: 'denied', reason: 'THROW_RANGE_UNCONFIGURED' });
        const target = request.target || {};
        const from = light?.sourcePosition?.(source, mapData) || token;
        const distance = light?.distance3dFt?.(from, target, mapData) ?? Infinity;
        if (distance > Number(source.throwRangeFt) + 1e-9) return persistRequestResult(requestRef, { status: 'denied', reason: 'THROW_OUT_OF_RANGE' });
        source.attachedToTokenId = null;
        source.motion = light.createThrowMotion(source, target, mapData, { startedAt: Date.now(), speedFtPerSecond: Number(request.speedFtPerSecond) || 30 });
        source.x = Number(target.x) || source.x || 0;
        source.y = Number(target.y) || source.y || 0;
        source.zLayer = Number.isFinite(Number(target.zLayer)) ? Number(target.zLayer) : source.zLayer;
        source.elevationFt = Number.isFinite(Number(target.elevationFt)) ? Number(target.elevationFt) : light.elevationForLayer(mapData, source.zLayer);
      } else return persistRequestResult(requestRef, { status: 'denied', reason: 'ACTION_NOT_ALLOWED' });
      await saveScene(mapData.lighting.scene);
      return persistRequestResult(requestRef, { status: 'applied' });
    }

    async function watchRepair(commandRef, requestRef, transformerId, uid) {
      const key = `${uid}/${commandRef.key}`;
      if (liveWatchers.has(key)) return;
      const liveRef = db.ref(`${CHECK_LIVE_ROOT}/${uid}/${commandRef.key}`);
      const handler = async (snapshot) => {
        const live = snapshot.val() || {};
        if (live.status !== 'complete') return;
        liveRef.off('value', handler);
        liveWatchers.delete(key);
        const transformer = transformerById(transformerId);
        const passed = live.outcome === 'passed';
        if (passed && transformer) {
          transformer.damaged = false;
          transformer.powered = true;
          await saveScene(mapData.lighting.scene);
        }
        await persistRequestResult(requestRef, { status: passed ? 'applied' : 'failed', checkOutcome: live.outcome || null });
      };
      liveWatchers.set(key, { ref: liveRef, handler });
      liveRef.on('value', handler);
    }

    async function applyRepairRequest(request, requestRef, playerData) {
      const transformer = transformerById(request.transformerId);
      const repair = transformer?.repair;
      if (!transformer || !repair?.rollSpec || !Number.isFinite(Number(repair.threshold))) return persistRequestResult(requestRef, { status: 'denied', reason: 'REPAIR_UNCONFIGURED' });
      if (!transformer.damaged) return persistRequestResult(requestRef, { status: 'denied', reason: 'NOT_DAMAGED' });
      if (repair.requiredItem && !playerHasConfiguredItem(playerData, repair.requiredItem)) return persistRequestResult(requestRef, { status: 'denied', reason: 'REQUIRED_ITEM_MISSING' });
      const uid = clean(request.requesterUid);
      if (!uid) return persistRequestResult(requestRef, { status: 'denied', reason: 'AUTH_REQUIRED' });
      const commandRef = db.ref(`${CHECK_COMMAND_ROOT}/${uid}`).push();
      await commandRef.set({
        schemaVersion: 1,
        targetUid: uid,
        targetPlayerId: request.playerId || null,
        targetName: request.playerName || 'PLAYER',
        roomKey: request.roomKey || 'default',
        requestedBy: 'player',
        rollSpec: clone(repair.rollSpec),
        check: { thresholdRaw: Number(repair.threshold), hiddenThreshold: repair.hiddenThreshold !== false, modifierType: 'neutral', modifierValue: 0, tipText: clean(repair.tipText) },
        status: 'issued',
        issuedAt: firebase.database.ServerValue.TIMESTAMP,
        clientIssuedAt: Date.now(),
      });
      await requestRef.update({ status: 'check_issued', commandId: commandRef.key, decidedAt: firebase.database.ServerValue.TIMESTAMP });
      await watchRepair(commandRef, requestRef, transformer.id, uid);
    }

    async function processRequest(playerId, playerData, requestId, request) {
      if (!isDm || !db || !request || request.status !== 'pending' || clean(request.mapId) !== mapId) return;
      const requestRef = playerRequestsRef(playerId).child(requestId);
      const normalized = { ...request, playerId: clean(request.playerId || playerId) };
      if (normalized.action === 'switch_toggle') return applySwitchRequest(normalized, requestRef);
      if (['source_drop', 'source_attach', 'source_throw'].includes(normalized.action)) return applySourceRequest(normalized, requestRef);
      if (normalized.action === 'transformer_repair') return applyRepairRequest(normalized, requestRef, playerData);
      return persistRequestResult(requestRef, { status: 'denied', reason: 'ACTION_NOT_ALLOWED' });
    }

    function processPlayerRequests(snapshot) {
      if (!isDm || !db) return;
      const players = snapshot.val() || {};
      Object.entries(players).forEach(([playerId, data]) => {
        const requests = data?.vttLightingRequests?.[mapId] || {};
        Object.entries(requests).forEach(([requestId, request]) => {
          processRequest(playerId, data, requestId, request).catch((error) => console.error('VTT lighting request failed:', error));
        });
      });
    }

    async function requestAction(action, payload = {}) {
      if (!db) return { valid: false, reason: 'FIREBASE_UNAVAILABLE' };
      if (isDm) throw new Error('PLAYER_REQUEST_ONLY');
      if (!current.playerId || !current.uid) throw new Error('AUTH_NOT_READY');
      const ref = playerRequestsRef(current.playerId).push();
      await ref.set({
        schemaVersion: 1,
        mapId,
        action,
        requesterUid: current.uid,
        playerId: current.playerId,
        actorId: current.actorId || null,
        playerName: current.name,
        roomKey: clean(host?.document?.body?.dataset?.theatreRoomId || 'default') || 'default',
        ...clone(payload),
        status: 'pending',
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        clientCreatedAt: Date.now(),
      });
      emit('Interacción enviada.', 'pending');
      return { valid: true, pending: true, requestId: ref.key };
    }

    function start() {
      if (started) return true;
      started = true;
      if (!db) return false;
      subscribe(sceneRef(), 'value', (snapshot) => {
        seedIfNeeded(snapshot).catch((error) => console.error('VTT lighting seed failed:', error));
        replaceScene(snapshot.val() || {});
      });
      subscribe(worldFacingRef(), 'value', (snapshot) => {
        mapData.lighting.worldFacing = snapshot.val() || {};
        playersRef().once('value').then((players) => applyFacingRecord(players.val() || {}, mapData.lighting.worldFacing));
      });
      subscribe(playersRef(), 'value', (snapshot) => {
        applyFacingRecord(snapshot.val() || {}, mapData.lighting.worldFacing || {});
        if (isDm) processPlayerRequests(snapshot);
      });
      return true;
    }

    function stop() {
      subscriptions.splice(0).forEach((fn) => fn());
      liveWatchers.forEach(({ ref, handler }) => ref.off('value', handler));
      liveWatchers.clear();
      started = false;
    }

    return Object.freeze({
      mapId,
      isDm: Boolean(isDm),
      identity: current,
      start,
      stop,
      saveScene,
      saveFacing,
      requestAction,
      requestSwitchToggle: (switchId) => requestAction('switch_toggle', { switchId }),
      requestSourceDrop: (sourceId) => requestAction('source_drop', { sourceId }),
      requestSourceAttach: (sourceId) => requestAction('source_attach', { sourceId }),
      requestSourceThrow: (sourceId, target, options = {}) => requestAction('source_throw', { sourceId, target, speedFtPerSecond: options.speedFtPerSecond }),
      requestTransformerRepair: (transformerId) => requestAction('transformer_repair', { transformerId }),
      getScene: () => mapData.lighting.scene,
    });
  }

  return Object.freeze({
    DM_UID,
    WORLD_ROOT,
    PLAYER_ROOT,
    CHECK_COMMAND_ROOT,
    CHECK_LIVE_ROOT,
    hostWindow,
    hostFirebase,
    identity,
    firebaseKey,
    emptyScene,
    normalizeScene,
    createBridge,
  });
});