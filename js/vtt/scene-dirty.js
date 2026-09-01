(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.LuminousVttSceneDirty = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  const EVENT_NAME = 'vtt:scene-dirty';
  const REASONS = Object.freeze({
    TOKEN: 'token',
    CAMERA: 'camera',
    TOPOLOGY: 'topology',
    LIGHTING: 'lighting',
    FOG: 'fog',
    CHUNK: 'chunk',
    EDIT: 'edit',
    RESIZE: 'resize',
    MEMORY: 'memory',
    UNKNOWN: 'unknown',
  });

  function normalize(detail = {}) {
    const source = detail && typeof detail === 'object' ? detail : {};
    return Object.freeze({
      reason: String(source.reason || REASONS.UNKNOWN),
      render: source.render !== false,
      vision: source.vision === true,
      active: source.active === true,
      sourceEvent: source.sourceEvent ? String(source.sourceEvent) : null,
      tokenId: source.tokenId == null ? null : String(source.tokenId),
      meta: source.meta && typeof source.meta === 'object' ? source.meta : null,
    });
  }

  function eventCtorFor(target) {
    return target?.ownerDocument?.defaultView?.CustomEvent || root?.CustomEvent || globalThis.CustomEvent;
  }

  function emit(target, detail = {}) {
    if (!target?.dispatchEvent) return false;
    const normalized = normalize(detail);
    const EventCtor = eventCtorFor(target);
    const event = typeof EventCtor === 'function'
      ? new EventCtor(EVENT_NAME, { detail: normalized })
      : { type: EVENT_NAME, detail: normalized };
    target.dispatchEvent(event);
    return true;
  }

  function bridge(target, sourceEvent, detail = {}) {
    const eventName = String(sourceEvent || '').trim();
    if (!eventName || !target?.addEventListener) return () => {};
    const handler = (event) => emit(target, {
      ...detail,
      sourceEvent: eventName,
      tokenId: event?.detail?.tokenId ?? detail.tokenId,
      meta: event?.detail || detail.meta || null,
    });
    target.addEventListener(eventName, handler);
    return () => target.removeEventListener?.(eventName, handler);
  }

  function canvasFor(host = root) {
    return host?.document?.getElementById?.('vtt-canvas') || null;
  }

  function wrapStateBridgeApi(apiName, callbackName, detail = {}) {
    const current = root?.[apiName];
    if (!current?.createBridge || current.__sceneDirtyWrapped) return false;
    const originalCreateBridge = current.createBridge;
    const wrapped = {
      ...current,
      __sceneDirtyWrapped: true,
      createBridge(options = {}) {
        const originalCallback = options?.[callbackName];
        return originalCreateBridge({
          ...options,
          [callbackName](...args) {
            if (typeof originalCallback === 'function') originalCallback(...args);
            emit(canvasFor(root), {
              ...detail,
              sourceEvent: `${apiName}:${callbackName}`,
              meta: args[0] && typeof args[0] === 'object' ? args[0] : null,
            });
          },
        });
      },
    };
    root[apiName] = Object.freeze(wrapped);
    return true;
  }

  const LEGACY_EVENT_MAP = Object.freeze([
    ['vtt:token-preview-moved', REASONS.TOKEN, true, true],
    ['vtt:movement-destination-preview', REASONS.TOKEN, false, true],
    ['vtt:token-moved', REASONS.TOKEN, true, false],
    ['vtt:token-z-transition', REASONS.TOKEN, true, false],
    ['vtt:canonical-tokens-synced', REASONS.TOKEN, true, false],
    ['vtt:movement-interaction', REASONS.TOPOLOGY, true, false],
    ['vtt:camera-follow-changed', REASONS.CAMERA, false, false],
    ['vtt:dm-observer-changed', REASONS.CAMERA, true, false],
    ['vtt:procedural-chunk-loaded', REASONS.CHUNK, true, false],
    ['vtt:procedural-chunk-transition', REASONS.CHUNK, true, false],
    ['vtt:memory-learn', REASONS.MEMORY, false, false],
    ['vtt:lighting-changed', REASONS.LIGHTING, true, false],
    ['vtt:fog-changed', REASONS.FOG, false, false],
    ['vtt:pov-changed', REASONS.LIGHTING, true, false],
    ['vtt:dm-edit-changed', REASONS.EDIT, true, false],
  ]);

  function installLegacyBridge({ canvas, mapData, host = root } = {}) {
    if (!canvas?.addEventListener) return Object.freeze({ stop() {}, snapshot: () => ({ bridgedEvents: 0 }) });
    const stops = [];
    const metrics = { bridgedEvents: 0, resizeInvalidations: 0, editPointerInvalidations: 0 };

    LEGACY_EVENT_MAP.forEach(([eventName, reason, vision, active]) => {
      const handler = (event) => {
        metrics.bridgedEvents += 1;
        emit(canvas, {
          reason,
          render: true,
          vision,
          active,
          sourceEvent: eventName,
          tokenId: event?.detail?.tokenId,
          meta: event?.detail || null,
        });
      };
      canvas.addEventListener(eventName, handler);
      stops.push(() => canvas.removeEventListener?.(eventName, handler));
    });

    const onResize = () => {
      metrics.resizeInvalidations += 1;
      emit(canvas, { reason: REASONS.RESIZE, render: true, vision: false, sourceEvent: 'resize' });
    };
    host?.addEventListener?.('resize', onResize);
    stops.push(() => host?.removeEventListener?.('resize', onResize));

    // Temporary authoring bridge. The guard no longer observes raw pointer input.
    // Remove this when every DM editor emits vtt:scene-dirty directly.
    const onEditPointerMove = () => {
      if (!mapData?.dmEditMode?.active) return;
      metrics.editPointerInvalidations += 1;
      emit(canvas, { reason: REASONS.EDIT, render: true, vision: false, active: true, sourceEvent: 'mousemove' });
    };
    const onEditPointerUp = () => {
      if (!mapData?.dmEditMode?.active) return;
      metrics.editPointerInvalidations += 1;
      emit(canvas, { reason: REASONS.EDIT, render: true, vision: true, sourceEvent: 'mouseup' });
    };
    host?.addEventListener?.('mousemove', onEditPointerMove, { passive: true });
    host?.addEventListener?.('mouseup', onEditPointerUp, { passive: true });
    stops.push(() => host?.removeEventListener?.('mousemove', onEditPointerMove));
    stops.push(() => host?.removeEventListener?.('mouseup', onEditPointerUp));

    let stopped = false;
    return Object.freeze({
      stop() {
        if (stopped) return false;
        stopped = true;
        while (stops.length) {
          try { stops.pop()?.(); } catch (_) {}
        }
        return true;
      },
      snapshot: () => Object.freeze({ ...metrics }),
    });
  }

  wrapStateBridgeApi('LuminousVttStateBridge', 'onTopologyChanged', {
    reason: REASONS.TOPOLOGY, render: true, vision: true,
  });
  wrapStateBridgeApi('LuminousVttVerticalPortalState', 'onChanged', {
    reason: REASONS.TOPOLOGY, render: true, vision: true,
  });

  return Object.freeze({
    EVENT_NAME,
    REASONS,
    LEGACY_EVENT_MAP,
    normalize,
    emit,
    bridge,
    canvasFor,
    wrapStateBridgeApi,
    installLegacyBridge,
  });
});
