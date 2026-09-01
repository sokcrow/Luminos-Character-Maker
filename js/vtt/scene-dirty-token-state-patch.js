import './token-state-dynamic-patch.js';

const dirty = globalThis.LuminousVttSceneDirty;
const current = globalThis.LuminousVttTokenState;

if (dirty && current?.createBridge && !current.__sceneDirtyWrapped) {
  const originalCreateBridge = current.createBridge;
  globalThis.LuminousVttTokenState = Object.freeze({
    ...current,
    __sceneDirtyWrapped: true,
    createBridge(options = {}) {
      const originalCallback = options?.onTokensChanged;
      return originalCreateBridge({
        ...options,
        onTokensChanged(change = {}) {
          if (typeof originalCallback === 'function') originalCallback(change);
          const canvas = globalThis.document?.getElementById?.('vtt-canvas') || globalThis.LuminousVttRuntime?.engine?.canvas;
          dirty.emit(canvas, {
            reason: 'token',
            render: true,
            vision: true,
            active: false,
            tokenId: change?.tokenId ?? null,
            sourceEvent: 'LuminousVttTokenState:onTokensChanged',
            meta: change && typeof change === 'object' ? change : null,
          });
        },
      });
    },
  });
}
