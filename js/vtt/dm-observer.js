(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttDmObserver = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const MODES = Object.freeze({ FREE: 'free', FOLLOW: 'follow', VIEW_AS: 'view_as' });
  const clean = (value) => String(value ?? '').trim();

  function layerOf(token = {}) {
    if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
    if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
    if (Array.isArray(token.z) && token.z.length) return Number(token.z[0]) || 0;
    return 0;
  }

  function playerIdForToken(token = {}) {
    return clean(token.canonicalPlayerKey || token.playerId || token.characterLink?.playerId || token.characterLink?.uid) || null;
  }

  function isPlayerToken(token = {}) {
    return token.canonicalScope === 'player'
      || Boolean(playerIdForToken(token))
      || ['current_player', 'player'].includes(token.characterLink?.mode)
      || token.viewer === true;
  }

  function createController({ runtime, mapData = runtime?.engine?.mapData, cameraFollow, root: host = root } = {}) {
    const engine = runtime?.engine;
    const canvas = engine?.canvas;
    if (!engine || !canvas || !mapData || !cameraFollow) throw new Error('DM_OBSERVER_RUNTIME_REQUIRED');
    if (!Boolean(runtime?.bridge?.isDm || runtime?.tokenState?.isDm)) return null;

    mapData.lighting ||= {};
    engine.isDm = true;

    let mode = MODES.FREE;
    let targetId = null;
    let selectingMode = null;
    let stopped = false;
    let panel = null;
    let statusNode = null;
    let restoreRenderer = null;

    const tokens = () => Array.isArray(mapData.tokens) ? mapData.tokens : [];
    const tokenById = (id = targetId) => tokens().find((token) => clean(token.id) === clean(id)) || null;
    const target = () => tokenById(targetId);

    // Engine.viewerToken used to fall back to the first draggable token. On a DM surface that
    // made the first Actor (commonly Agatha) the accidental POV owner. DM FREE/FOLLOW has no
    // player viewer at all; only explicit VIEW AS exposes one exact Player token.
    const originalViewerToken = engine.viewerToken;
    if (typeof originalViewerToken === 'function') {
      engine.viewerToken = function dmAwareViewerToken() {
        const previewId = clean(mapData.lighting?.dmPreviewTokenId);
        return previewId ? tokenById(previewId) : null;
      };
    }

    function syncLayer(token) {
      if (!token) return false;
      const z = layerOf(token);
      if (typeof runtime?.setLayer === 'function') runtime.setLayer(z);
      else engine.setZLayer?.(z);
      return true;
    }

    function snapshot() {
      const token = target();
      return {
        mode,
        targetTokenId: token ? clean(token.id) : targetId,
        targetPlayerId: token ? playerIdForToken(token) : null,
        targetLayer: token ? layerOf(token) : null,
        selectingMode,
        isDm: true,
      };
    }

    function emit(reason = 'observer') {
      const detail = { ...snapshot(), reason };
      const EventCtor = host?.CustomEvent || root?.CustomEvent || globalThis.CustomEvent;
      if (typeof EventCtor === 'function') {
        canvas.dispatchEvent(new EventCtor('vtt:dm-observer-changed', { detail }));
        if (host && host !== canvas && typeof host.dispatchEvent === 'function') {
          host.dispatchEvent(new EventCtor('vtt:dm-observer-changed', { detail }));
        }
      }
      renderStatus();
      return detail;
    }

    function free(reason = 'free') {
      mode = MODES.FREE;
      targetId = null;
      selectingMode = null;
      mapData.lighting.dmPreviewTokenId = null;
      cameraFollow.setEnabled(false, { reason: 'dm-observer-free', centerNow: false });
      cameraFollow.clearTarget();
      return emit(reason);
    }

    function follow(id, reason = 'follow') {
      const token = tokenById(id);
      if (!token) return free('target-missing');
      mode = MODES.FOLLOW;
      targetId = clean(token.id);
      selectingMode = null;
      mapData.lighting.dmPreviewTokenId = null;
      cameraFollow.setTarget(targetId, { follow: true });
      cameraFollow.setEnabled(true, { reason: 'dm-observer-follow', centerNow: true });
      syncLayer(token);
      return emit(reason);
    }

    function viewAs(id, reason = 'view-as') {
      const token = tokenById(id);
      if (!token || !isPlayerToken(token)) return free('target-missing');
      mode = MODES.VIEW_AS;
      targetId = clean(token.id);
      selectingMode = null;
      mapData.lighting.dmPreviewTokenId = targetId;
      cameraFollow.setTarget(targetId, { follow: true });
      cameraFollow.setEnabled(true, { reason: 'dm-observer-view-as', centerNow: true });
      syncLayer(token);
      return emit(reason);
    }

    function select(nextMode) {
      if (![MODES.FOLLOW, MODES.VIEW_AS].includes(nextMode)) return free('select-free');
      selectingMode = nextMode;
      renderStatus();
      return snapshot();
    }

    function applySelected(id) {
      if (selectingMode === MODES.FOLLOW) return follow(id, 'selected-follow');
      if (selectingMode === MODES.VIEW_AS) return viewAs(id, 'selected-view-as');
      return snapshot();
    }

    function resync(reason = 'canonical-sync') {
      if (mode === MODES.FREE) return snapshot();
      const token = target();
      if (!token) return free('target-missing');
      mapData.lighting.dmPreviewTokenId = mode === MODES.VIEW_AS ? clean(token.id) : null;
      cameraFollow.setTarget(clean(token.id), { follow: true });
      syncLayer(token);
      emit(reason);
      return snapshot();
    }

    function onTokenState(event) {
      if (mode === MODES.FREE) return;
      const id = clean(event?.detail?.tokenId);
      if (id && id !== clean(targetId)) return;
      const token = target();
      if (!token) return free('target-missing');
      syncLayer(token);
      emit('target-state');
    }

    const onCanonicalSync = () => resync('canonical-sync');
    const onWorldTransition = () => resync('world-transition');

    function tokenAtEvent(event) {
      return typeof engine.tokenAtEvent === 'function' ? engine.tokenAtEvent(event) : null;
    }

    function onCanvasSelect(event) {
      // Normal DM clicks are gameplay/control clicks. Observer selection only owns the click
      // after FOLLOW or VIEW AS has explicitly armed selection mode.
      if (!selectingMode || event.button !== 0 || mapData.dmEditMode?.active) return;
      const token = tokenAtEvent(event);
      if (!token) return;
      if (selectingMode === MODES.VIEW_AS && !isPlayerToken(token)) return;
      event.preventDefault?.();
      event.stopPropagation?.();
      event.stopImmediatePropagation?.();
      applySelected(token.id);
    }

    function ensurePanel() {
      const doc = host?.document;
      if (!doc?.body || panel) return panel;
      const legacy = doc.getElementById('vtt-view-as-token');
      if (legacy) legacy.hidden = true;
      panel = doc.createElement('section');
      panel.id = 'vtt-dm-observer';
      panel.setAttribute('aria-label', 'DM observer controls');
      panel.style.cssText = 'position:fixed;right:12px;bottom:84px;z-index:36600;background:rgba(7,9,11,.96);border:1px solid #59636c;padding:7px;font:700 9px monospace;color:#dce3e8;display:grid;gap:5px;min-width:220px';
      panel.innerHTML = '<strong>DM OBSERVER</strong><small id="vtt-dm-observer-status">FREE</small><div style="display:flex;gap:4px"><button type="button" data-dm-observer="free">FREE</button><button type="button" data-dm-observer="follow">FOLLOW</button><button type="button" data-dm-observer="view_as">VIEW AS</button></div><small>Normal click = select/move token · VIEW AS is explicit</small>';
      for (const button of panel.querySelectorAll('button')) {
        button.style.cssText = 'border:1px solid #59636c;background:#11161a;color:#dce3e8;font:700 9px monospace;padding:5px 7px;cursor:pointer';
      }
      statusNode = panel.querySelector('#vtt-dm-observer-status');
      panel.addEventListener('click', onPanelClick);
      doc.body.appendChild(panel);
      renderStatus();
      return panel;
    }

    function renderStatus() {
      if (!statusNode) return;
      const token = target();
      const name = clean(token?.name || token?.label || token?.id || targetId || '').toUpperCase();
      if (selectingMode === MODES.FOLLOW) statusNode.textContent = 'SELECT TOKEN · FOLLOW';
      else if (selectingMode === MODES.VIEW_AS) statusNode.textContent = 'SELECT PLAYER · VIEW AS 120°';
      else if (mode === MODES.FREE) statusNode.textContent = 'FREE CAMERA · OMNISCIENT DM';
      else statusNode.textContent = `${mode === MODES.VIEW_AS ? 'VIEW AS 120°' : 'FOLLOW'} · ${name || '—'}`;
    }

    function onPanelClick(event) {
      const action = event.target?.closest?.('[data-dm-observer]')?.dataset?.dmObserver;
      if (action === MODES.FREE) free('panel-free');
      else if (action === MODES.FOLLOW) select(MODES.FOLLOW);
      else if (action === MODES.VIEW_AS) select(MODES.VIEW_AS);
    }

    function playerTokensOnLayer() {
      const z = Number(engine.activeZ) || 0;
      return tokens().filter((token) => isPlayerToken(token) && layerOf(token) === z);
    }

    function outlineRadius(token) {
      const profile = engine.visionProfile?.(token);
      return Math.max(Number(mapData.grid?.size) || 70, Number(profile?.radiusPx) || 0);
    }

    function drawOutlines() {
      if (mode === MODES.VIEW_AS || stopped) return;
      const renderer = engine.renderer;
      const ctx = renderer?.ctx;
      const camera = engine.camera;
      if (!ctx || !camera) return;
      const lighting = host?.LuminousVttLightingEngine || root?.LuminousVttLightingEngine;
      ctx.save();
      camera.applyTransformSimple?.(ctx);
      for (const token of playerTokensOnLayer()) {
        const cone = Number(lighting?.visionConeDeg?.(token)) || 120;
        const facing = Number(token.lookState?.yawDeg ?? lighting?.facingDeg?.(token) ?? token.facingDeg) || 0;
        const radius = outlineRadius(token);
        const half = Math.min(180, cone / 2) * Math.PI / 180;
        const center = facing * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(Number(token.x) || 0, Number(token.y) || 0);
        ctx.arc(Number(token.x) || 0, Number(token.y) || 0, radius, center - half, center + half);
        ctx.closePath();
        ctx.globalAlpha = clean(token.id) === clean(targetId) ? 0.85 : 0.45;
        ctx.strokeStyle = token.color || '#d7b151';
        ctx.lineWidth = clean(token.id) === clean(targetId) ? 3 : 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    function installOutlineRenderer() {
      const renderer = engine.renderer;
      if (!renderer || typeof renderer.render !== 'function' || restoreRenderer) return;
      const original = renderer.render;
      renderer.render = function (...args) {
        const result = original.apply(this, args);
        drawOutlines();
        return result;
      };
      restoreRenderer = () => { renderer.render = original; };
    }

    canvas.addEventListener('click', onCanvasSelect, true);
    canvas.addEventListener('vtt:token-moved', onTokenState);
    canvas.addEventListener('vtt:token-z-transition', onTokenState);
    canvas.addEventListener('vtt:canonical-tokens-synced', onCanonicalSync);
    canvas.addEventListener('vtt:regional-local-transition-applied', onWorldTransition);
    canvas.addEventListener('vtt:procedural-chunk-loaded', onWorldTransition);
    ensurePanel();
    installOutlineRenderer();
    free('initial');

    function stop() {
      if (stopped) return;
      stopped = true;
      mapData.lighting.dmPreviewTokenId = null;
      selectingMode = null;
      canvas.removeEventListener('click', onCanvasSelect, true);
      canvas.removeEventListener('vtt:token-moved', onTokenState);
      canvas.removeEventListener('vtt:token-z-transition', onTokenState);
      canvas.removeEventListener('vtt:canonical-tokens-synced', onCanonicalSync);
      canvas.removeEventListener('vtt:regional-local-transition-applied', onWorldTransition);
      canvas.removeEventListener('vtt:procedural-chunk-loaded', onWorldTransition);
      restoreRenderer?.();
      restoreRenderer = null;
      if (typeof originalViewerToken === 'function') engine.viewerToken = originalViewerToken;
      delete engine.isDm;
      if (panel) panel.removeEventListener('click', onPanelClick);
      panel?.remove?.();
      panel = null;
      statusNode = null;
      const legacy = host?.document?.getElementById?.('vtt-view-as-token');
      if (legacy) legacy.hidden = false;
    }

    return Object.freeze({
      MODES,
      state: snapshot,
      target,
      free,
      follow,
      viewAs,
      select,
      applySelected,
      resync,
      drawOutlines,
      outlineRadius,
      stop,
    });
  }

  return Object.freeze({ MODES, layerOf, playerIdForToken, isPlayerToken, createController });
});
