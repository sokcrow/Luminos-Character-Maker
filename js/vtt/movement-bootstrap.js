import './movement-realtime.js';
import './movement-connectivity.js';
import './movement-destination-claims.js';
import './movement-rules.js';
import './movement-rules-runtime.js';
import './movement-door-runtime.js';

window.LuminousVttMovementConnectivity?.installRealtime?.(window);

export function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.engine || !mapData) return null;
  const movement = window.LuminousVttMovementEngine;
  const movementRules = window.LuminousVttMovementRules;
  const pathfinding = window.LuminousVttPathfinding;
  const stateApi = window.LuminousVttMovementState;
  if (!movement || !movementRules || !pathfinding || !stateApi) return null;

  const engine = runtime.engine;
  const renderer = engine.renderer;
  const camera = engine.camera;
  const canvas = engine.canvas;
  const isDm = Boolean(runtime.bridge?.isDm);
  const movementConnectivity = window.LuminousVttMovementConnectivity;
  const movementRealtimeApi = window.LuminousVttMovementRealtime;
  const movementRealtimeIdentity = movementRealtimeApi?.identity?.(window) || {};
  const movementRealtime = movementRealtimeApi?.createController?.({ mapData, canvas, engine, isDm, root: window }) || null;
  const tokenStateApi = window.LuminousVttTokenState;
  const firebase = tokenStateApi?.hostFirebase?.(window) || window.firebase || null;
  const db = firebase?.database?.() || null;
  const mapId = tokenStateApi?.firebaseKey?.(mapData.id || mapData.mapId || 'default', 'default') || String(mapData.id || mapData.mapId || 'default');
  const playerRoot = tokenStateApi?.PLAYER_ROOT || 'campaña/jugadores';
  const worldTokenRoot = `${tokenStateApi?.WORLD_ROOT || 'campaña/estado_mundo/vttTokens'}/${mapId}`;
  const realtimeCommits = new Map();
  mapData.movement ||= {};
  if (!mapData.movement.diagonalRule) mapData.movement.diagonalRule = '5e';
  if (mapData.movement.blockTokens == null) mapData.movement.blockTokens = true;

  let preview = null;
  let previewAt = 0;
  let lastRoundId = null;
  let lastMode = null;
  let noticeTimer = null;
  let turnPlayerHandler = null;
  let turnWorldHandler = null;

  function movementOnline() {
    return movementRealtime ? movementRealtime.isConnected?.() === true : false;
  }

  function offlineResult() {
    return { valid: false, reason: 'VTT_OFFLINE_NO_UPDATE', path: [], costFt: Infinity, movementCostFt: Infinity };
  }

  function assertMovementOnline() {
    if (!movementOnline()) throw new Error('VTT_OFFLINE_NO_UPDATE');
  }

  function worldState() { return stateBridge.current(); }

  function applyWorldState(state) {
    const current = movement.normalizeWorldState(state);
    for (const token of (mapData.tokens || [])) {
      if (current.mode === 'round') movement.ensureRound(token, current);
      else movement.setFreeMode(token);
    }
    const newRound = current.mode === 'round' && (lastMode !== 'round' || lastRoundId !== current.roundId);
    lastMode = current.mode;
    lastRoundId = current.roundId;
    if (newRound) {
      window.dispatchEvent(new CustomEvent('vtt:world-round', { detail: { mapId: String(mapData.id || mapData.mapId || 'default'), roundId: current.roundId, roundSeconds: current.roundSeconds, worldSeconds: current.worldSeconds } }));
    }
    updateUi();
  }

  const stateBridge = stateApi.createBridge({ mapData, isDm, onChanged: applyWorldState });

  function controlledToken() {
    if (engine.tokenDrag?.token) return engine.tokenDrag.token;
    if (!isDm) {
      return (mapData.tokens || []).find((token) => token.viewer === true)
        || (mapData.tokens || []).find((token) => token.characterLink?.mode === 'current_player')
        || null;
    }
    const previewId = mapData.lighting?.dmPreviewTokenId;
    return (mapData.tokens || []).find((token) => String(token.id) === String(previewId)) || null;
  }

  function combatActiveTokenId() {
    return String(mapData.combat?.activeTokenId || mapData.combat?.currentTokenId || mapData.initiative?.activeTokenId || mapData.initiative?.currentTokenId || '');
  }

  function isActiveCombatTurn(token) {
    const activeId = combatActiveTokenId();
    return Boolean(activeId && token && String(token.id) === activeId);
  }

  function statusText() {
    if (!movementOnline()) return 'WORLD · OFFLINE · MOVEMENT LOCKED';
    const state = worldState();
    if (state.mode !== 'round') return 'WORLD · FREE EXPLORATION';
    const token = controlledToken();
    const remaining = token && Number.isFinite(Number(token.movementRemainingFt)) ? ` · MOVE ${Number(token.movementRemainingFt).toFixed(0)}ft` : '';
    return `WORLD · ROUND ${state.roundId} · ${state.roundSeconds}s${remaining}`;
  }

  function injectUi() {
    if (document.getElementById('vtt-world-time-status')) return;
    const style = document.createElement('style');
    style.id = 'vtt-movement-style';
    style.textContent = `
      .vtt-world-time{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:33020;display:flex;align-items:center;gap:6px;background:#0b0b0b;border:1px solid #aaa;padding:5px 7px;color:#fff;font:700 11px monospace;box-shadow:3px 3px 0 #000}.vtt-world-time[data-mode="round"]{border-color:#fff}.vtt-world-time[data-online="false"]{border-color:#ff6b6b}.vtt-world-time button{font-size:10px}.vtt-move-toast{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:33021;background:#111;color:#fff;border:1px solid #ff6b6b;padding:5px 8px;font:11px monospace}.vtt-move-toast[hidden]{display:none}
    `;
    document.head.appendChild(style);
    const bar = document.createElement('div');
    bar.id = 'vtt-world-time-status';
    bar.className = 'vtt-world-time';
    bar.innerHTML = `<span data-world-time-label></span><button type="button" class="brutalist-button" data-move-reset>RESET MOVE</button>${isDm ? '<button type="button" class="brutalist-button" data-world-free>FREE</button><button type="button" class="brutalist-button" data-world-round>ROUND TIME</button><button type="button" class="brutalist-button" data-world-next>NEXT ROUND</button>' : ''}`;
    document.body.appendChild(bar);
    const toast = document.createElement('div');
    toast.id = 'vtt-move-toast';
    toast.className = 'vtt-move-toast';
    toast.hidden = true;
    document.body.appendChild(toast);
    bar.querySelector('[data-move-reset]')?.addEventListener('click', resetControlledMovement);
    if (isDm) {
      bar.querySelector('[data-world-free]')?.addEventListener('click', () => setWorldMode('free'));
      bar.querySelector('[data-world-round]')?.addEventListener('click', () => setWorldMode('round'));
      bar.querySelector('[data-world-next]')?.addEventListener('click', nextWorldRound);
    }
  }

  function updateUi() {
    const bar = document.getElementById('vtt-world-time-status');
    const label = bar?.querySelector('[data-world-time-label]');
    const state = stateBridge.current();
    const online = movementOnline();
    if (bar) {
      bar.dataset.mode = state.mode;
      bar.dataset.online = String(online);
    }
    if (label) label.textContent = statusText();
    const next = bar?.querySelector('[data-world-next]');
    if (next) next.disabled = !online || state.mode !== 'round';
    const reset = bar?.querySelector('[data-move-reset]');
    if (reset) reset.disabled = !online || state.mode !== 'round' || !controlledToken()?.movementTurnStart;
    const free = bar?.querySelector('[data-world-free]');
    const round = bar?.querySelector('[data-world-round]');
    if (free) free.disabled = !online;
    if (round) round.disabled = !online;
    free?.classList.toggle('is-active', state.mode === 'free');
    round?.classList.toggle('is-active', state.mode === 'round');
  }

  function showError(error) {
    const message = String(error?.message || error || 'Movement unavailable');
    runtime.controller?.notify?.(message, 'error');
    const toast = document.getElementById('vtt-move-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  function requestedPoint(event, drag) {
    const world = engine.eventWorldPoint(event);
    return { x: world.x - drag.grabOffsetX, y: world.y - drag.grabOffsetY };
  }

  function planFor(token, start, target) {
    if (!movementOnline()) return offlineResult();
    return movement.planMove({
      token,
      start,
      target,
      mapData,
      worldState: worldState(),
      movementMode: token.movementState?.mode || 'walk',
      movementType: token.pendingMovementType || 'normal',
      blockTokens: mapData.movement.blockTokens,
      diagonalRule: mapData.movement.diagonalRule,
    });
  }

  function updatePreview(event) {
    const drag = engine.tokenDrag;
    if (!drag || !event || Date.now() - previewAt < 45) return;
    previewAt = Date.now();
    const target = requestedPoint(event, drag);
    const plan = planFor(drag.token, { x: drag.originX, y: drag.originY }, target);
    preview = { tokenId: drag.token.id, valid: Boolean(plan.valid), reason: plan.reason || plan.stopAtDoor?.reason || null, path: plan.path || [], costFt: plan.movementCostFt ?? plan.costFt ?? 0 };
  }

  function clearPreview() { preview = null; }

  function drawPreview(ctx) {
    if (!preview?.path?.length || !engine.tokenDrag) return;
    const token = engine.tokenDrag.token;
    const showRuler = movementOnline() && worldState().mode === 'round' && isActiveCombatTurn(token);
    ctx.save();
    camera.applyTransformSimple(ctx);
    ctx.lineWidth = 3 / Math.max(0.01, camera.zoom || 1);
    ctx.setLineDash([10 / Math.max(0.01, camera.zoom || 1), 6 / Math.max(0.01, camera.zoom || 1)]);
    ctx.strokeStyle = showRuler ? (preview.valid ? '#55ff80' : '#ff5f5f') : '#ffffff';
    ctx.beginPath();
    preview.path.forEach((point, index) => { if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); });
    ctx.stroke();
    if (showRuler) {
      const last = preview.path[preview.path.length - 1];
      ctx.setLineDash([]);
      ctx.fillStyle = '#000000';
      ctx.strokeStyle = preview.valid ? '#55ff80' : '#ff5f5f';
      const text = preview.valid ? `${Math.round(preview.costFt)} ft` : String(preview.reason || 'NO PATH');
      ctx.font = `${12 / Math.max(0.01, camera.zoom || 1)}px monospace`;
      const width = ctx.measureText(text).width + 10 / Math.max(0.01, camera.zoom || 1);
      const height = 18 / Math.max(0.01, camera.zoom || 1);
      ctx.fillRect(last.x - width / 2, last.y - height - 12 / Math.max(0.01, camera.zoom || 1), width, height);
      ctx.strokeRect(last.x - width / 2, last.y - height - 12 / Math.max(0.01, camera.zoom || 1), width, height);
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, last.x, last.y - height / 2 - 12 / Math.max(0.01, camera.zoom || 1));
    }
    const start = movement.movementStart?.(token);
    if (showRuler && start) {
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(start.x, start.y, 7 / Math.max(0.01, camera.zoom || 1), 0, Math.PI * 2);
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
    }
    ctx.restore();
  }

  async function prepareDoorInteractions(token, plan = {}) {
    const interactions = Array.isArray(plan.doorInteractions) ? plan.doorInteractions : [];
    if (!interactions.length) return { valid: true, interactions: [] };
    if (typeof runtime.bridge?.requestDirectAction !== 'function') return { valid: false, reason: 'DOOR_ACTION_BRIDGE_UNAVAILABLE' };
    const prepared = [];
    for (const interaction of interactions) {
      const door = (mapData.topology || []).find((element) => String(element.id || '') === String(interaction.doorId || ''));
      if (!door) return { valid: false, reason: 'DOOR_NOT_FOUND', doorId: interaction.doorId || null };
      const traversal = movementRules.doorTraversal({ mode: 'dash', dashActive: true, door, remainingFt: plan.remainingFt });
      if (!traversal.valid) return { valid: false, reason: traversal.reason || 'DOOR_BLOCKED', doorId: door.id };
      const state = String(door.state || 'closed').toLowerCase();
      if (state !== 'open' && state !== 'broken') {
        const result = await runtime.bridge.requestDirectAction(door.id, 'open');
        if (result === false || result?.valid === false) return { valid: false, reason: result?.reason || 'DOOR_OPEN_FAILED', doorId: door.id };
      }
      prepared.push({ ...interaction, doorId: door.id, soundEvent: traversal.soundEvent || interaction.soundEvent, noise: traversal.noise || interaction.noise });
    }
    return { valid: true, interactions: prepared };
  }

  async function reserveDestination(token) {
    if (!token?.pendingMovementClaim) return { valid: true, skipped: true };
    const bridge = runtime.tokenStateBridge;
    if (typeof bridge?.reserveMovementDestinationClaim !== 'function') return { valid: false, reason: 'MOVEMENT_CLAIM_BRIDGE_UNAVAILABLE' };
    try {
      return await bridge.reserveMovementDestinationClaim(token, token.pendingMovementClaim);
    } catch (error) {
      return { valid: false, reason: error?.message || 'MOVEMENT_DESTINATION_CLAIM_FAILED' };
    }
  }

  async function cancelDestination(token, reason, rollback = true) {
    const bridge = runtime.tokenStateBridge;
    if (typeof bridge?.cancelMovementDestinationClaim !== 'function') {
      if (rollback && token?.pendingMovementClaim) window.LuminousVttMovementDestinationClaims?.restoreFromClaim?.(token, token.pendingMovementClaim);
      else if (token) delete token.pendingMovementClaim;
      return { valid: false, reason: 'MOVEMENT_CLAIM_BRIDGE_UNAVAILABLE' };
    }
    try {
      return await bridge.cancelMovementDestinationClaim(token, { rollback, reason });
    } catch (_) {
      return { valid: false, reason: reason || 'MOVEMENT_DESTINATION_CLAIM_CANCEL_FAILED' };
    }
  }

  async function resolveMovementOrder({ token, from, requestedPoint }) {
    if (!movementOnline()) return offlineResult();
    const plan = planFor(token, from, requestedPoint);
    if (!plan.valid) return plan;

    const committed = movement.commitMove(token, plan, worldState());
    if (!committed.valid) return committed;

    const reserved = await reserveDestination(token);
    if (!reserved.valid) {
      await cancelDestination(token, reserved.reason || 'MOVEMENT_DESTINATION_CLAIM_LOST', true);
      return { ...plan, valid: false, reason: reserved.reason || 'MOVEMENT_DESTINATION_CLAIM_LOST' };
    }

    const doors = await prepareDoorInteractions(token, plan);
    if (!doors.valid) {
      await cancelDestination(token, doors.reason || 'DOOR_INTERACTION_FAILED', true);
      return { ...plan, valid: false, reason: doors.reason || 'DOOR_INTERACTION_FAILED' };
    }

    const endpoint = plan.path?.[plan.path.length - 1] || pathfinding.pointForCell(pathfinding.cellFromPoint(requestedPoint, mapData), mapData, pathfinding.tokenLayer(token));
    return {
      ...plan,
      ...endpoint,
      valid: true,
      path: plan.path || [],
      routeCostFt: plan.routeCostFt ?? plan.costFt ?? 0,
      movementCostFt: plan.movementCostFt ?? 0,
      remainingFt: committed.remainingFt,
      actionMode: token.activeActionMovementMode || 'walk',
      doorInteractions: doors.interactions,
      stopAtDoor: plan.stopAtDoor || null,
      destinationReserved: Boolean(reserved.reservation),
    };
  }

  function resetControlledMovement() {
    try { assertMovementOnline(); } catch (error) { showError(error); return; }
    const token = controlledToken();
    if (!token) return;
    const from = { x: token.x, y: token.y, z: token.zLayer ?? token.z?.[0] ?? 0, elevationFt: token.elevationFt ?? 0 };
    const result = movement.resetMovement?.(token, worldState());
    if (!result?.valid) return showError(result?.reason || 'RESET_MOVEMENT_UNAVAILABLE');
    canvas.dispatchEvent(new CustomEvent('vtt:token-preview-moved', { detail: { tokenId: token.id, x: token.x, y: token.y, z: token.zLayer, reset: true } }));
    canvas.dispatchEvent(new CustomEvent('vtt:token-moved', { detail: { tokenId: token.id, from, to: { x: token.x, y: token.y, z: token.zLayer, ...token.gridPosition, elevationFt: token.elevationFt ?? 0 }, reset: true } }));
    canvas.dispatchEvent(new CustomEvent('vtt:movement-reset', { detail: { tokenId: token.id, refundActionType: result.refundActionType || null } }));
    updateUi();
  }

  function turnExtraRef(token) {
    if (!db || !token) return null;
    const playerKey = movementRealtimeApi?.playerKeyForToken?.(token, movementRealtimeIdentity) || '';
    if (playerKey) {
      const key = tokenStateApi?.firebaseKey?.(playerKey, 'player') || playerKey;
      return db.ref(`${playerRoot}/${key}/vttTokenState/${mapId}`);
    }
    if (!isDm) return null;
    const tokenId = String(token.id || '');
    if (!tokenId) return null;
    const key = tokenStateApi?.firebaseKey?.(tokenId, 'token') || tokenId;
    return db.ref(worldTokenRoot).child(key);
  }

  async function persistTurnExtras(token) {
    if (!movementOnline()) throw new Error('VTT_OFFLINE_NO_UPDATE');
    const ref = turnExtraRef(token);
    if (!ref?.update) return { valid: false, reason: 'TURN_PERSISTENCE_UNAVAILABLE' };
    const extras = movementConnectivity?.turnExtras?.(token) || { movementTurnStart: token.movementTurnStart || null, dashActionType: token.dashActionType || null };
    await ref.update({
      'position/movementTurnStart': extras.movementTurnStart,
      'position/dashActionType': extras.dashActionType,
    });
    return { valid: true, extras };
  }

  function applyPlayerTurnExtras(rawPlayers = {}) {
    if (!movementOnline()) return;
    Object.entries(rawPlayers || {}).forEach(([playerKey, playerData]) => {
      const record = playerData?.vttTokenState?.[mapId];
      if (!record?.position) return;
      const recordPlayerId = String(record.playerId || playerKey);
      const token = (mapData.tokens || []).find((entry) => String(entry.canonicalPlayerKey || entry.playerId || '') === String(playerKey)
        || (recordPlayerId === String(movementRealtimeIdentity.playerId || '') && (entry.viewer === true || entry.characterLink?.mode === 'current_player')));
      if (token) movementConnectivity?.applyTurnExtras?.(token, record.position);
    });
    updateUi();
  }

  function applyWorldTurnExtras(rawWorld = {}) {
    if (!movementOnline()) return;
    Object.entries(rawWorld || {}).forEach(([key, record]) => {
      if (!record?.position) return;
      const tokenId = String(record.tokenId || key);
      const token = (mapData.tokens || []).find((entry) => String(entry.id || '') === tokenId);
      if (token) movementConnectivity?.applyTurnExtras?.(token, record.position);
    });
    updateUi();
  }

  function startTurnPersistence() {
    if (!db) return;
    turnPlayerHandler = (snapshot) => applyPlayerTurnExtras(snapshot?.val?.() || {});
    turnWorldHandler = (snapshot) => applyWorldTurnExtras(snapshot?.val?.() || {});
    db.ref(playerRoot).on('value', turnPlayerHandler);
    db.ref(worldTokenRoot).on('value', turnWorldHandler);
  }

  function stopTurnPersistence() {
    if (db && turnPlayerHandler) db.ref(playerRoot).off('value', turnPlayerHandler);
    if (db && turnWorldHandler) db.ref(worldTokenRoot).off('value', turnWorldHandler);
    turnPlayerHandler = null;
    turnWorldHandler = null;
  }

  function realtimeKey(token) { return movementRealtimeApi?.logicalTokenKey?.(token, movementRealtimeIdentity) || String(token?.id || ''); }
  function realtimePosition(token) { return movementRealtimeApi?.snapshotPosition?.(token) || { x: Number(token?.x) || 0, y: Number(token?.y) || 0, zLayer: Number(token?.zLayer ?? token?.gridPosition?.z ?? token?.z?.[0]) || 0 }; }
  function sameRealtimePosition(a = {}, b = {}) { return Math.abs((Number(a.x) || 0) - (Number(b.x) || 0)) < 0.01 && Math.abs((Number(a.y) || 0) - (Number(b.y) || 0)) < 0.01 && Number(a.zLayer ?? a.z?.[0] ?? 0) === Number(b.zLayer ?? b.z?.[0] ?? 0); }

  function settleRealtimeCommit(key, error = null) {
    const pendingCommit = realtimeCommits.get(key);
    if (!pendingCommit) return false;
    realtimeCommits.delete(key);
    clearTimeout(pendingCommit.timeoutId);
    if (error) pendingCommit.reject(error); else pendingCommit.resolve({ valid: true, source: 'canonical-sync' });
    return true;
  }

  function onRealtimeTokenMoved(event) {
    const token = (mapData.tokens || []).find((entry) => String(entry.id) === String(event.detail?.tokenId));
    if (!token || !movementOnline() || !movementRealtime?.previewRefForToken?.(token)) return;
    void persistTurnExtras(token).catch((error) => console.warn('VTT movement turn persistence failed:', error));
    const key = realtimeKey(token);
    if (!key) return;
    settleRealtimeCommit(key, new Error('REALTIME_MOVEMENT_SUPERSEDED'));
    let resolveCanonical;
    let rejectCanonical;
    const canonicalPromise = new Promise((resolve, reject) => { resolveCanonical = resolve; rejectCanonical = reject; });
    const pendingCommit = {
      token,
      expected: realtimePosition(token),
      resolve: resolveCanonical,
      reject: rejectCanonical,
      timeoutId: setTimeout(() => {
        if (realtimeCommits.get(key) !== pendingCommit) return;
        realtimeCommits.delete(key);
        rejectCanonical(new Error('REALTIME_CANONICAL_TIMEOUT'));
      }, 2500),
    };
    realtimeCommits.set(key, pendingCommit);
    void movementRealtime.finalizeToken(token, () => canonicalPromise).catch((error) => { settleRealtimeCommit(key); console.warn('VTT realtime movement finalization failed:', error); });
  }

  function onRealtimeCanonicalSync() {
    for (const [key, pendingCommit] of [...realtimeCommits.entries()]) {
      const token = (mapData.tokens || []).find((entry) => realtimeKey(entry) === key);
      if (!token || !sameRealtimePosition(realtimePosition(token), pendingCommit.expected)) continue;
      settleRealtimeCommit(key);
    }
  }

  const previousRender = renderer.render.bind(renderer);
  renderer.render = function movementRender(...args) { previousRender(...args); drawPreview(renderer.ctx); };

  function onMouseMove(event) { updatePreview(event); }
  function onMouseUp() { clearPreview(); setTimeout(updateUi, 0); }
  function onTokenMoved(event) {
    const token = (mapData.tokens || []).find((entry) => String(entry.id) === String(event.detail?.tokenId));
    if (token) movement.reconcileVertical(token, worldState());
    updateUi();
  }
  function onRejected(event) { showError(event.detail?.reason || 'MOVEMENT_REJECTED'); clearPreview(); }

  async function setWorldMode(mode) {
    try { assertMovementOnline(); await stateBridge.setMode(mode); } catch (error) { showError(error); }
  }

  async function nextWorldRound() {
    try { assertMovementOnline(); await stateBridge.nextRound(); } catch (error) { showError(error); }
  }

  engine.setTokenMoveResolver?.(resolveMovementOrder);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('vtt:token-moved', onRealtimeTokenMoved, true);
  canvas.addEventListener('vtt:canonical-tokens-synced', onRealtimeCanonicalSync);
  canvas.addEventListener('vtt:token-moved', onTokenMoved);
  canvas.addEventListener('vtt:movement-order-rejected', onRejected);

  injectUi();
  stateBridge.start();
  movementRealtime?.start?.();
  startTurnPersistence();
  applyWorldState(stateBridge.current());

  const api = Object.freeze({
    engine: movement,
    pathfinding,
    stateBridge,
    realtime: movementRealtime,
    worldState,
    isConnected: movementOnline,
    nextRound: nextWorldRound,
    setMode: setWorldMode,
    dash: (token, options) => {
      try { assertMovementOnline(); } catch (error) { return { valid: false, reason: error.message }; }
      const result = movement.dash(token, worldState(), options);
      if (result.valid) void persistTurnExtras(token).catch((error) => console.warn('VTT Dash turn persistence failed:', error));
      updateUi();
      return result;
    },
    resetMovement: resetControlledMovement,
    prone: (token) => { if (!movementOnline()) return { valid: false, reason: 'VTT_OFFLINE_NO_UPDATE' }; const result = movement.setProne(token, true); updateUi(); return result; },
    stand: (token) => { if (!movementOnline()) return { valid: false, reason: 'VTT_OFFLINE_NO_UPDATE' }; const result = movement.standUp(token, worldState()); updateUi(); return result; },
    setMovementMode: (token, mode) => { if (!movementOnline()) throw new Error('VTT_OFFLINE_NO_UPDATE'); return movement.setMovementMode(token, mode, worldState()); },
    plan: (options) => movementOnline() ? movement.planMove({ ...options, mapData, worldState: worldState() }) : offlineResult(),
    stop() {
      clearTimeout(noticeTimer);
      engine.cancelTokenMotion?.();
      engine.setTokenMoveResolver?.(null);
      for (const key of [...realtimeCommits.keys()]) settleRealtimeCommit(key, new Error('REALTIME_RUNTIME_STOPPED'));
      stopTurnPersistence();
      movementRealtime?.stop?.();
      stateBridge.stop();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('vtt:token-moved', onRealtimeTokenMoved, true);
      canvas.removeEventListener('vtt:canonical-tokens-synced', onRealtimeCanonicalSync);
      canvas.removeEventListener('vtt:token-moved', onTokenMoved);
      canvas.removeEventListener('vtt:movement-order-rejected', onRejected);
      renderer.render = previousRender;
      document.getElementById('vtt-world-time-status')?.remove();
      document.getElementById('vtt-move-toast')?.remove();
      document.getElementById('vtt-movement-style')?.remove();
    },
  });
  window.LuminousVttRuntime = Object.freeze({ ...window.LuminousVttRuntime, movement: api });
  return api;
}
