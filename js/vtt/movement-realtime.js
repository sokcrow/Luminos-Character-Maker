(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttMovementRealtime = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const PLAYER_ROOT = 'campaña/jugadores';
  const WORLD_PREVIEW_ROOT = 'campaña/estado_mundo/vttMovementPreview';
  const DEFAULT_THROTTLE_MS = 90;
  const DEFAULT_PREVIEW_TTL_MS = 1800;

  const clean = (value) => String(value ?? '').trim();
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function firebaseKey(value, fallback = 'token') {
    return clean(value).replace(/[.#$\[\]\/]/g, '_') || fallback;
  }

  function hostWindow(host = root) {
    if (!host) return null;
    try {
      if (host.parent && host.parent !== host && host.parent.document) return host.parent;
    } catch (_) {}
    return host;
  }

  function hostFirebase(host = root) {
    const resolved = hostWindow(host);
    return resolved?.firebase || host?.firebase || null;
  }

  function identity(host = root) {
    const resolved = hostWindow(host);
    const data = resolved?.datosJugador || {};
    let uid = '';
    try { uid = clean(hostFirebase(host)?.auth?.().currentUser?.uid); } catch (_) {}
    let playerId = '';
    try { playerId = clean(resolved?.localStorage?.getItem?.('playerId') || data.playerId || data.id); } catch (_) {
      playerId = clean(data.playerId || data.id);
    }
    return { uid, playerId };
  }

  function tokenLayer(token = {}) {
    if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
    if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
    if (Array.isArray(token.z) && token.z.length) return Number(token.z[0]) || 0;
    return 0;
  }

  function playerKeyForToken(token = {}, current = {}) {
    return clean(token.canonicalPlayerKey || token.playerId || (token.characterLink?.mode === 'current_player' ? current.playerId : ''));
  }

  function isPlayerToken(token = {}, current = {}) {
    if (token.canonicalScope === 'world') return false;
    return token.canonicalScope === 'player'
      || Boolean(playerKeyForToken(token, current))
      || token.characterLink?.mode === 'current_player'
      || token.characterLink?.mode === 'player';
  }

  function logicalTokenKey(token = {}, current = {}) {
    if (isPlayerToken(token, current)) {
      const playerKey = playerKeyForToken(token, current);
      return playerKey ? `player:${firebaseKey(playerKey, 'player')}` : '';
    }
    const tokenId = clean(token.id);
    return tokenId ? `world:${firebaseKey(tokenId)}` : '';
  }

  function snapshotPosition(token = {}) {
    return {
      x: finite(token.x),
      y: finite(token.y),
      zLayer: tokenLayer(token),
      elevationFt: finite(token.elevationFt),
      gridPosition: clone(token.gridPosition || null),
      z: Array.isArray(token.z) ? clone(token.z) : [tokenLayer(token)],
    };
  }

  function restorePosition(token, position = {}) {
    if (!token || !position) return token;
    if (Number.isFinite(Number(position.x))) token.x = Number(position.x);
    if (Number.isFinite(Number(position.y))) token.y = Number(position.y);
    const zLayer = Number.isFinite(Number(position.zLayer)) ? Number(position.zLayer) : tokenLayer(token);
    token.zLayer = zLayer;
    token.z = Array.isArray(position.z) ? clone(position.z) : [zLayer];
    if (Number.isFinite(Number(position.elevationFt))) token.elevationFt = Number(position.elevationFt);
    if (position.gridPosition) token.gridPosition = clone(position.gridPosition);
    return token;
  }

  function previewFromToken(token = {}, meta = {}) {
    const current = meta.current || {};
    const playerKey = playerKeyForToken(token, current);
    return {
      schemaVersion: 1,
      scope: isPlayerToken(token, current) ? 'player' : 'world',
      tokenId: clean(token.id) || null,
      playerKey: playerKey || null,
      x: finite(token.x),
      y: finite(token.y),
      zLayer: tokenLayer(token),
      elevationFt: finite(token.elevationFt),
      sequence: Math.max(0, Math.trunc(finite(meta.sequence))),
      committed: Boolean(meta.committed),
      sessionId: clean(meta.sessionId) || null,
      updatedByUid: clean(current.uid) || null,
      sentAtMs: Math.max(0, Math.trunc(finite(meta.sentAtMs))),
      expiresAtMs: Math.max(0, Math.trunc(finite(meta.expiresAtMs))),
      updatedAt: meta.updatedAt ?? null,
    };
  }

  function applyPreview(token, preview = {}) {
    if (!token || !preview || preview.committed === false && preview.cancelled === true) return token;
    if (Number.isFinite(Number(preview.x))) token.x = Number(preview.x);
    if (Number.isFinite(Number(preview.y))) token.y = Number(preview.y);
    if (Number.isFinite(Number(preview.zLayer))) {
      token.zLayer = Number(preview.zLayer);
      token.z = [Number(preview.zLayer)];
    }
    if (Number.isFinite(Number(preview.elevationFt))) token.elevationFt = Number(preview.elevationFt);
    return token;
  }

  function createController(options = {}) {
    const host = options.root || root;
    const mapData = options.mapData || options.engine?.mapData || {};
    const canvas = options.canvas || options.engine?.canvas || null;
    const engine = options.engine || null;
    const firebase = options.firebase || hostFirebase(host);
    const db = options.db || firebase?.database?.() || null;
    const current = options.identity || identity(host);
    const isDm = Boolean(options.isDm);
    const mapId = firebaseKey(mapData.id || mapData.mapId || 'default', 'default');
    const throttleMs = Math.max(40, finite(options.throttleMs, DEFAULT_THROTTLE_MS));
    const previewTtlMs = Math.max(throttleMs * 3, finite(options.previewTtlMs, DEFAULT_PREVIEW_TTL_MS));
    const now = typeof options.now === 'function' ? options.now : () => Date.now();
    const setTimeoutFn = typeof options.setTimeoutFn === 'function' ? options.setTimeoutFn : (fn, ms) => setTimeout(fn, ms);
    const clearTimeoutFn = typeof options.clearTimeoutFn === 'function' ? options.clearTimeoutFn : (id) => clearTimeout(id);
    const sessionId = clean(options.sessionId) || `${clean(current.uid) || 'anon'}:${Math.trunc(now()).toString(36)}:${Math.random().toString(36).slice(2, 8)}`;

    const pending = new Map();
    const queues = new Map();
    const playerSubscriptions = new Map();
    const rootSubscriptions = [];
    const canonicalPositions = new Map();
    const activeRemotePreviews = new Map();
    const expiryTimers = new Map();
    let sequence = 0;
    let started = false;
    let stopped = false;
    let writes = 0;
    let received = 0;
    let droppedStale = 0;

    const worldPreviewRoot = () => db?.ref(`${WORLD_PREVIEW_ROOT}/${mapId}`);
    const playerPreviewRef = (playerKey) => db?.ref(`${PLAYER_ROOT}/${firebaseKey(playerKey, 'player')}/vttMovementPreview/${mapId}`);
    const worldPreviewRef = (tokenId) => worldPreviewRoot()?.child?.(firebaseKey(tokenId));

    function tokenForPreview(preview = {}, explicitPlayerKey = '') {
      const tokens = Array.isArray(mapData.tokens) ? mapData.tokens : [];
      const playerKey = clean(preview.playerKey || explicitPlayerKey);
      if (playerKey) {
        const byPlayer = tokens.find((token) => clean(token.canonicalPlayerKey || token.playerId) === playerKey);
        if (byPlayer) return byPlayer;
        if (playerKey === clean(current.playerId)) {
          const own = tokens.find((token) => token.characterLink?.mode === 'current_player' || token.viewer === true);
          if (own) return own;
        }
      }
      const tokenId = clean(preview.tokenId);
      if (tokenId) return tokens.find((token) => clean(token.id) === tokenId) || null;
      return null;
    }

    function cacheCanonical(token) {
      const key = logicalTokenKey(token, current);
      if (!key) return;
      canonicalPositions.set(key, snapshotPosition(token));
    }

    function restoreCanonical(token) {
      const key = logicalTokenKey(token, current);
      const position = key ? canonicalPositions.get(key) : null;
      if (position) restorePosition(token, position);
    }

    function dispatchPreview(token, preview, detail = {}) {
      const EventCtor = host?.CustomEvent || root?.CustomEvent || globalThis.CustomEvent;
      if (!canvas || typeof canvas.dispatchEvent !== 'function' || typeof EventCtor !== 'function' || !token) return;
      canvas.dispatchEvent(new EventCtor('vtt:token-preview-moved', {
        detail: {
          tokenId: token.id,
          x: token.x,
          y: token.y,
          z: tokenLayer(token),
          remote: true,
          scope: preview?.scope || null,
          playerKey: preview?.playerKey || null,
          sequence: preview?.sequence ?? null,
          ...detail,
        },
      }));
    }

    function clearExpiry(key) {
      const timer = expiryTimers.get(key);
      if (timer != null) clearTimeoutFn(timer);
      expiryTimers.delete(key);
    }

    function expirePreview(key) {
      const active = activeRemotePreviews.get(key);
      if (!active) return;
      if (active.preview?.committed) {
        activeRemotePreviews.delete(key);
        clearExpiry(key);
        return;
      }
      restoreCanonical(active.token);
      activeRemotePreviews.delete(key);
      clearExpiry(key);
      dispatchPreview(active.token, active.preview, { expired: true, reverted: true });
    }

    function armExpiry(key, preview, token) {
      clearExpiry(key);
      if (preview.committed) return;
      const expiresAt = Math.max(now() + throttleMs, finite(preview.expiresAtMs, now() + previewTtlMs));
      const delay = Math.max(throttleMs, expiresAt - now());
      expiryTimers.set(key, setTimeoutFn(() => expirePreview(key), delay));
    }

    function clearIncoming(previousPreview = {}, explicitPlayerKey = '') {
      const playerKey = clean(explicitPlayerKey || previousPreview?.playerKey);
      const key = playerKey
        ? `player:${firebaseKey(playerKey, 'player')}`
        : `world:${firebaseKey(previousPreview?.tokenId || 'token')}`;
      const active = activeRemotePreviews.get(key);
      if (!active) return;
      clearExpiry(key);
      activeRemotePreviews.delete(key);
      if (!active.preview?.committed) {
        restoreCanonical(active.token);
        dispatchPreview(active.token, active.preview, { reverted: true, cleared: true });
      }
    }

    function handleIncoming(preview, explicitPlayerKey = '') {
      if (!preview || typeof preview !== 'object') {
        clearIncoming({}, explicitPlayerKey);
        return;
      }
      const playerKey = clean(explicitPlayerKey || preview.playerKey);
      const scope = playerKey ? 'player' : clean(preview.scope) || 'world';
      const key = playerKey ? `player:${firebaseKey(playerKey, 'player')}` : `world:${firebaseKey(preview.tokenId || 'token')}`;

      const expiresAt = finite(preview.expiresAtMs, 0);
      if (!preview.committed && expiresAt > 0 && expiresAt <= now()) {
        droppedStale += 1;
        return;
      }
      const normalized = { ...preview, scope, playerKey: playerKey || preview.playerKey || null };
      const token = tokenForPreview(normalized, playerKey);
      if (!token) {
        activeRemotePreviews.set(key, { token: null, preview: normalized });
        return;
      }

      received += 1;
      if (normalized.sessionId === sessionId && engine?.tokenDrag?.token === token) return;
      if (!canonicalPositions.has(key)) cacheCanonical(token);
      applyPreview(token, normalized);
      activeRemotePreviews.set(key, { token, preview: normalized });
      armExpiry(key, normalized, token);
      dispatchPreview(token, normalized, { committed: Boolean(normalized.committed) });
    }

    function subscribe(ref, event, handler) {
      if (!ref?.on) return () => {};
      ref.on(event, handler);
      const off = () => ref.off?.(event, handler);
      rootSubscriptions.push(off);
      return off;
    }

    function subscribePlayer(playerKey) {
      const key = clean(playerKey);
      if (!db || !key || playerSubscriptions.has(key)) return false;
      const ref = playerPreviewRef(key);
      if (!ref?.on) return false;
      const handler = (snapshot) => handleIncoming(snapshot?.val?.() || null, key);
      ref.on('value', handler);
      playerSubscriptions.set(key, () => ref.off?.('value', handler));
      return true;
    }

    function reconcilePlayerSubscriptions() {
      const wanted = new Set();
      for (const token of (mapData.tokens || [])) {
        if (!isPlayerToken(token, current)) continue;
        const key = playerKeyForToken(token, current);
        if (key) wanted.add(key);
      }
      if (current.playerId) wanted.add(clean(current.playerId));
      for (const key of wanted) subscribePlayer(key);
      for (const [key, off] of [...playerSubscriptions.entries()]) {
        if (wanted.has(key)) continue;
        off();
        playerSubscriptions.delete(key);
      }
    }

    function cacheCanonicalPositions() {
      for (const token of (mapData.tokens || [])) {
        const key = logicalTokenKey(token, current);
        if (!key) continue;
        canonicalPositions.set(key, snapshotPosition(token));
      }
      for (const [key, active] of activeRemotePreviews.entries()) {
        const token = active.token || tokenForPreview(active.preview, active.preview?.playerKey || '');
        if (!token) continue;
        active.token = token;
        applyPreview(token, active.preview);
        dispatchPreview(token, active.preview, { canonicalRefresh: true });
        activeRemotePreviews.set(key, active);
      }
    }

    function previewRefForToken(token) {
      if (!db || !token) return null;
      if (isPlayerToken(token, current)) {
        const playerKey = playerKeyForToken(token, current);
        if (!playerKey) return null;
        const ownerUid = clean(token.canonicalOwnerUid || token.ownerUid);
        if (!isDm && playerKey !== clean(current.playerId) && (!ownerUid || ownerUid !== clean(current.uid))) return null;
        return { ref: playerPreviewRef(playerKey), scope: 'player', playerKey };
      }
      if (!isDm) return null;
      const tokenId = clean(token.id);
      if (!tokenId) return null;
      return { ref: worldPreviewRef(tokenId), scope: 'world', playerKey: '' };
    }

    function enqueue(pathKey, action) {
      const prior = queues.get(pathKey) || Promise.resolve();
      const next = prior.catch(() => {}).then(action);
      let tracked = null;
      tracked = next.finally(() => {
        if (queues.get(pathKey) === tracked) queues.delete(pathKey);
      });
      queues.set(pathKey, tracked);
      return tracked;
    }

    function writePayload(token, { committed = false } = {}) {
      const target = previewRefForToken(token);
      if (!target?.ref?.set) return Promise.resolve({ valid: false, reason: 'PREVIEW_WRITE_UNAVAILABLE' });
      const sentAtMs = Math.max(0, Math.trunc(now()));
      const serverTimestamp = firebase?.database?.ServerValue?.TIMESTAMP ?? null;
      const payload = previewFromToken(token, {
        current,
        sequence: ++sequence,
        committed,
        sessionId,
        sentAtMs,
        expiresAtMs: committed ? 0 : sentAtMs + previewTtlMs,
        updatedAt: serverTimestamp,
      });
      const pathKey = `${target.scope}:${target.playerKey || clean(token.id)}`;
      return enqueue(pathKey, async () => {
        await target.ref.set(payload);
        writes += 1;
        return { valid: true, payload };
      });
    }

    function clearPayload(token) {
      const target = previewRefForToken(token);
      if (!target?.ref?.set) return Promise.resolve({ valid: false, reason: 'PREVIEW_WRITE_UNAVAILABLE' });
      const pathKey = `${target.scope}:${target.playerKey || clean(token.id)}`;
      return enqueue(pathKey, async () => {
        await target.ref.set(null);
        writes += 1;
        return { valid: true };
      });
    }

    function cancelPending(token) {
      const key = logicalTokenKey(token, current);
      if (!key) return;
      const state = pending.get(key);
      if (state?.timer != null) clearTimeoutFn(state.timer);
      pending.delete(key);
    }

    function sendNow(token) {
      const key = logicalTokenKey(token, current);
      if (!key) return Promise.resolve({ valid: false, reason: 'TOKEN_KEY_REQUIRED' });
      const state = pending.get(key) || { lastSentAt: -Infinity, timer: null, token };
      if (state.timer != null) clearTimeoutFn(state.timer);
      state.timer = null;
      state.lastSentAt = now();
      state.token = token;
      pending.set(key, state);
      return writePayload(token);
    }

    function schedulePreview(token) {
      const key = logicalTokenKey(token, current);
      if (!key || !previewRefForToken(token)) return;
      const state = pending.get(key) || { lastSentAt: -Infinity, timer: null, token };
      state.token = token;
      const elapsed = now() - finite(state.lastSentAt, -Infinity);
      if (elapsed >= throttleMs && state.timer == null) {
        pending.set(key, state);
        void sendNow(token).catch((error) => console.error('VTT realtime movement preview failed:', error));
        return;
      }
      if (state.timer == null) {
        const delay = Math.max(0, throttleMs - Math.max(0, elapsed));
        state.timer = setTimeoutFn(() => {
          const latest = pending.get(key);
          if (!latest) return;
          latest.timer = null;
          void sendNow(latest.token).catch((error) => console.error('VTT realtime movement preview failed:', error));
        }, delay);
      }
      pending.set(key, state);
    }

    function handleLocalPreview(event) {
      if (stopped || event?.detail?.remote) return;
      const tokenId = clean(event?.detail?.tokenId);
      const token = (mapData.tokens || []).find((entry) => clean(entry.id) === tokenId);
      if (!token) return;
      if (event?.detail?.reverted) {
        cancelPending(token);
        void clearPayload(token).catch((error) => console.error('VTT realtime movement rollback failed:', error));
        return;
      }
      schedulePreview(token);
    }

    function handleCanonicalSync() {
      if (stopped) return;
      reconcilePlayerSubscriptions();
      cacheCanonicalPositions();
    }

    async function finalizeToken(token, saveCanonical) {
      if (!token || typeof saveCanonical !== 'function') throw new Error('MOVEMENT_FINALIZER_REQUIRED');
      cancelPending(token);
      const previewTarget = previewRefForToken(token);
      if (!previewTarget) return saveCanonical();
      await writePayload(token);
      try {
        const result = await saveCanonical();
        cacheCanonical(token);
        await writePayload(token, { committed: true });
        await clearPayload(token);
        return result;
      } catch (error) {
        await clearPayload(token).catch(() => {});
        throw error;
      }
    }

    function start() {
      if (started || stopped) return snapshot();
      started = true;
      cacheCanonicalPositions();
      reconcilePlayerSubscriptions();
      if (worldPreviewRoot()?.on) {
        subscribe(worldPreviewRoot(), 'child_added', (snapshot) => handleIncoming(snapshot?.val?.() || null));
        subscribe(worldPreviewRoot(), 'child_changed', (snapshot) => handleIncoming(snapshot?.val?.() || null));
        subscribe(worldPreviewRoot(), 'child_removed', (snapshot) => clearIncoming(snapshot?.val?.() || { tokenId: snapshot?.key || null }));
      }
      canvas?.addEventListener?.('vtt:token-preview-moved', handleLocalPreview);
      canvas?.addEventListener?.('vtt:canonical-tokens-synced', handleCanonicalSync);
      Promise.resolve().then(reconcilePlayerSubscriptions);
      return snapshot();
    }

    function stop() {
      if (stopped) return;
      stopped = true;
      for (const state of pending.values()) if (state?.timer != null) clearTimeoutFn(state.timer);
      pending.clear();
      for (const timer of expiryTimers.values()) clearTimeoutFn(timer);
      expiryTimers.clear();
      for (const off of rootSubscriptions.splice(0)) off();
      for (const off of playerSubscriptions.values()) off();
      playerSubscriptions.clear();
      canvas?.removeEventListener?.('vtt:token-preview-moved', handleLocalPreview);
      canvas?.removeEventListener?.('vtt:canonical-tokens-synced', handleCanonicalSync);
    }

    function snapshot() {
      return Object.freeze({
        started,
        stopped,
        mapId,
        isDm,
        throttleMs,
        previewTtlMs,
        sessionId,
        writes,
        received,
        droppedStale,
        pending: pending.size,
        playerSubscriptions: playerSubscriptions.size,
        activeRemotePreviews: activeRemotePreviews.size,
      });
    }

    return Object.freeze({
      start,
      stop,
      snapshot,
      finalizeToken,
      schedulePreview,
      handleIncoming,
      clearIncoming,
      handleCanonicalSync,
      reconcilePlayerSubscriptions,
      previewRefForToken,
    });
  }

  return Object.freeze({
    PLAYER_ROOT,
    WORLD_PREVIEW_ROOT,
    DEFAULT_THROTTLE_MS,
    DEFAULT_PREVIEW_TTL_MS,
    firebaseKey,
    identity,
    tokenLayer,
    playerKeyForToken,
    isPlayerToken,
    logicalTokenKey,
    snapshotPosition,
    restorePosition,
    previewFromToken,
    applyPreview,
    createController,
  });
});