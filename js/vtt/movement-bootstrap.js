import './movement-realtime.js';
import './movement-rules.js';
import './movement-rules-runtime.js';

export function start({ runtime = window.LuminousVttRuntime, mapData = runtime?.engine?.mapData } = {}) {
  if (!runtime?.engine || !mapData) return null;
  const movement = window.LuminousVttMovementEngine;
  const pathfinding = window.LuminousVttPathfinding;
  const stateApi = window.LuminousVttMovementState;
  if (!movement || !pathfinding || !stateApi) return null;

  const engine = runtime.engine;
  const renderer = engine.renderer;
  const camera = engine.camera;
  const canvas = engine.canvas;
  const isDm = Boolean(runtime.bridge?.isDm);
  const movementRealtimeApi = window.LuminousVttMovementRealtime;
  const movementRealtimeIdentity = movementRealtimeApi?.identity?.(window) || {};
  const movementRealtime = movementRealtimeApi?.createController?.({ mapData, canvas, engine, isDm, root: window }) || null;
  const realtimeCommits = new Map();
  mapData.movement ||= {};
  if (!mapData.movement.diagonalRule) mapData.movement.diagonalRule = '5e';
  if (mapData.movement.blockTokens == null) mapData.movement.blockTokens = true;

  let preview = null;
  let previewAt = 0;
  let lastRoundId = null;
  let lastMode = null;
  let noticeTimer = null;

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
      .vtt-world-time{position:fixed;left:50%;top:18px;transform:translateX(-50%);z-index:33020;display:flex;align-items:center;gap:6px;background:#0b0b0b;border:1px solid #aaa;padding:5px 7px;color:#fff;font:700 11px monospace;box-shadow:3px 3px 0 #000}.vtt-world-time[data-mode="round"]{border-color:#fff}.vtt-world-time button{font-size:10px}.vtt-move-toast{position:fixed;left:50%;top:58px;transform:translateX(-50%);z-index:33021;background:#111;color:#fff;border:1px solid #ff6b6b;padding:5px 8px;font:11px monospace}.vtt-move-toast[hidden]{display:none}
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
      bar.querySelector('[data-world-free]')?.addEventListener('click', () => stateBridge.setMode('free').catch(showError));
      bar.querySelector('[data-world-round]')?.addEventListener('click', () => stateBridge.setMode('round').catch(showError));
      bar.querySelector('[data-world-next]')?.addEventListener('click', () => stateBridge.nextRound().catch(showError));
    }
  }

  function updateUi() {
    const bar = document.getElementById('vtt-world-time-status');
    const label = bar?.querySelector('[data-world-time-label]');
    const state = stateBridge.current();
    if (bar) bar.dataset.mode = state.mode;
    if (label) label.textContent = statusText();
    const next = bar?.querySelector('[data-world-next]');
    if (next) next.disabled = state.mode !== 'round';
    const reset = bar?.querySelector('[data-move-reset]');
    if (reset) reset.disabled = state.mode !== 'round' || !controlledToken()?.movementTurnStart;
    const free = bar?.querySelector('[data-world-free]');
    const round = bar?.querySelector('[data-world-round]');
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
    preview = { tokenId: drag.token.id, valid: Boolean(plan.valid), reason: plan.reason || null, path: plan.path || [], costFt: plan.movementCostFt ?? plan.costFt ?? 0 };
  }

  function clearPreview() { preview = null; }

  function drawPreview(ctx) {
    if (!preview?.path?.length || !engine.tokenDrag) return;
    const token = engine.tokenDrag.token;
    const showRuler = worldState().mode === 'round' && isActiveCombatTurn(token);
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

  async function resolveMovementOrder({ token, from, requestedPoint }) {
    const plan = planFor(token, from, requestedPoint);
    if (!plan.valid) return plan;
    const committed = movement.commitMove(token, plan, worldState());
    if (!committed.valid) return committed;
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
    };
  }

  function resetControlledMovement() {
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
    if (!token || !movementRealtime?.previewRefForToken?.(token)) return;
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
  applyWorldState(stateBridge.current());

  const api = Object.freeze({
    engine: movement,
    pathfinding,
    stateBridge,
    realtime: movementRealtime,
    worldState,
    nextRound: () => stateBridge.nextRound(),
    setMode: (mode) => stateBridge.setMode(mode),
    dash: (token, options) => { const result = movement.dash(token, worldState(), options); updateUi(); return result; },
    resetMovement: resetControlledMovement,
    prone: (token) => { const result = movement.setProne(token, true); updateUi(); return result; },
    stand: (token) => { const result = movement.standUp(token, worldState()); updateUi(); return result; },
    setMovementMode: (token, mode) => movement.setMovementMode(token, mode, worldState()),
    plan: (options) => movement.planMove({ ...options, mapData, worldState: worldState() }),
    stop() {
      clearTimeout(noticeTimer);
      engine.cancelTokenMotion?.();
      engine.setTokenMoveResolver?.(null);
      for (const key of [...realtimeCommits.keys()]) settleRealtimeCommit(key, new Error('REALTIME_RUNTIME_STOPPED'));
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
