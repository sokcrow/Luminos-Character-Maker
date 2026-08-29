(function (root, factory) {
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttCameraFollow = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const clean = (value) => String(value ?? '').trim();

  function layerOf(token = {}) {
    if (Number.isFinite(Number(token.zLayer))) return Number(token.zLayer);
    if (Number.isFinite(Number(token.gridPosition?.z))) return Number(token.gridPosition.z);
    if (Array.isArray(token.z) && token.z.length) return Number(token.z[0]) || 0;
    return 0;
  }

  function controlledToken({ runtime, mapData, targetId = null } = {}) {
    const tokens = Array.isArray(mapData?.tokens) ? mapData.tokens : [];
    if (targetId) {
      const explicit = tokens.find((token) => clean(token.id) === clean(targetId));
      if (explicit) return explicit;
    }

    const isDm = Boolean(runtime?.bridge?.isDm);
    if (isDm) {
      const previewId = mapData?.lighting?.dmPreviewTokenId;
      if (!previewId) return null;
      return tokens.find((token) => clean(token.id) === clean(previewId)) || null;
    }

    const viaPov = runtime?.pov?.controlledViewers?.()?.[0]
      || runtime?.lighting?.controlledViewers?.()?.[0];
    if (viaPov) return viaPov;
    return tokens.find((token) => token.viewer === true)
      || tokens.find((token) => token.characterLink?.mode === 'current_player')
      || null;
  }

  function createController({ runtime, mapData = runtime?.engine?.mapData, root: host = root, intervalMs = 120 } = {}) {
    const engine = runtime?.engine;
    const camera = engine?.camera;
    const canvas = engine?.canvas;
    if (!engine || !camera || !canvas || !mapData) throw new Error('CAMERA_FOLLOW_RUNTIME_REQUIRED');

    const isDm = Boolean(runtime?.bridge?.isDm);
    let enabled = !isDm;
    let targetId = null;
    let timer = null;
    let stopped = false;
    let lastSignature = '';

    const emit = (reason = 'sync') => {
      const detail = state();
      detail.reason = reason;
      canvas.dispatchEvent(new CustomEvent('vtt:camera-follow-changed', { detail }));
      return detail;
    };

    const target = () => controlledToken({ runtime: host?.LuminousVttRuntime || runtime, mapData, targetId });

    function signature(token) {
      if (!token) return '';
      return [clean(token.id), Number(token.x) || 0, Number(token.y) || 0, layerOf(token), camera.zoom].join('|');
    }

    function center(reason = 'follow') {
      if (!enabled || stopped) return false;
      const token = target();
      if (!token) return false;
      const ok = camera.centerOnWorldPoint?.({ x: token.x, y: token.y }) === true;
      if (ok) {
        lastSignature = signature(token);
        emit(reason);
      }
      return ok;
    }

    function setEnabled(value, { reason = 'user', centerNow = true } = {}) {
      const next = Boolean(value);
      if (enabled === next) {
        if (next && centerNow) center(reason);
        return state();
      }
      enabled = next;
      if (enabled && centerNow) center(reason);
      else emit(reason);
      return state();
    }

    function toggle() { return setEnabled(!enabled, { reason: 'toggle' }); }

    function setTarget(id, { follow = true } = {}) {
      targetId = clean(id) || null;
      if (follow) enabled = true;
      if (enabled) center('target');
      else emit('target');
      return state();
    }

    function clearTarget() {
      targetId = null;
      if (enabled) center('target-clear');
      else emit('target-clear');
      return state();
    }

    function recenter() {
      enabled = true;
      return center('recenter');
    }

    function state() {
      const token = target();
      return {
        enabled,
        targetId: token ? clean(token.id) : targetId,
        hasTarget: Boolean(token),
        targetLayer: token ? layerOf(token) : null,
        mode: enabled ? 'follow' : 'free',
        isDm,
      };
    }

    const onManualPan = () => {
      if (!enabled) return;
      enabled = false;
      emit('manual-pan');
    };

    const onTokenMoved = (event) => {
      if (!enabled) return;
      const token = target();
      if (!token) return;
      if (event?.detail?.tokenId != null && clean(event.detail.tokenId) !== clean(token.id)) return;
      center('token-moved');
    };

    const tick = () => {
      if (!enabled || stopped) return;
      const token = target();
      if (!token) return;
      const next = signature(token);
      if (next !== lastSignature) center('state-sync');
    };

    camera.setManualPanListener?.(onManualPan);
    canvas.addEventListener('vtt:token-moved', onTokenMoved);
    canvas.addEventListener('vtt:token-z-transition', onTokenMoved);
    timer = host?.setInterval?.(tick, Math.max(60, Number(intervalMs) || 120)) || null;
    if (enabled) host?.setTimeout?.(() => center('initial'), 0);

    function stop() {
      if (stopped) return;
      stopped = true;
      if (timer != null) host?.clearInterval?.(timer);
      camera.setManualPanListener?.(null);
      canvas.removeEventListener('vtt:token-moved', onTokenMoved);
      canvas.removeEventListener('vtt:token-z-transition', onTokenMoved);
    }

    return Object.freeze({ state, target, center, recenter, setEnabled, toggle, setTarget, clearTarget, stop });
  }

  return Object.freeze({ layerOf, controlledToken, createController });
});
