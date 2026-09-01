import './memory-state.js';

const dirty = globalThis.LuminousVttSceneDirty;
const current = globalThis.LuminousVttMemoryState;

if (dirty && current?.createBridge && !current.__sceneDirtyWrapped) {
  const originalCreateBridge = current.createBridge;
  globalThis.LuminousVttMemoryState = Object.freeze({
    ...current,
    __sceneDirtyWrapped: true,
    createBridge(options = {}) {
      const originalCallback = options?.onChanged;
      return originalCreateBridge({
        ...options,
        onChanged(...args) {
          if (typeof originalCallback === 'function') originalCallback(...args);
          const canvas = globalThis.document?.getElementById?.('vtt-canvas') || globalThis.LuminousVttRuntime?.engine?.canvas;
          dirty.emit(canvas, {
            reason: 'fog',
            render: true,
            vision: false,
            sourceEvent: 'LuminousVttMemoryState:onChanged',
            meta: args[0] && typeof args[0] === 'object' ? args[0] : null,
          });
        },
      });
    },
  });
}
