import './lighting-state.js';
import './environment-light-bridge.js';
import './pov-state.js';

const dirty = globalThis.LuminousVttSceneDirty;

function wrapBridge(apiName, callbackName = 'onChanged', detail = {}) {
  const current = globalThis[apiName];
  if (!dirty || !current?.createBridge || current.__sceneDirtyWrapped) return false;
  const originalCreateBridge = current.createBridge;
  globalThis[apiName] = Object.freeze({
    ...current,
    __sceneDirtyWrapped: true,
    createBridge(options = {}) {
      const originalCallback = options?.[callbackName];
      return originalCreateBridge({
        ...options,
        [callbackName](...args) {
          if (typeof originalCallback === 'function') originalCallback(...args);
          const canvas = globalThis.document?.getElementById?.('vtt-canvas') || globalThis.LuminousVttRuntime?.engine?.canvas;
          dirty.emit(canvas, {
            ...detail,
            sourceEvent: `${apiName}:${callbackName}`,
            meta: args[0] && typeof args[0] === 'object' ? args[0] : null,
          });
        },
      });
    },
  });
  return true;
}

wrapBridge('LuminousVttLightingState', 'onChanged', {
  reason: 'lighting', render: true, vision: true,
});
wrapBridge('LuminousVttEnvironmentLightBridge', 'onChanged', {
  reason: 'lighting', render: true, vision: true,
});
wrapBridge('LuminousVttPovState', 'onChanged', {
  reason: 'lighting', render: true, vision: true,
});
