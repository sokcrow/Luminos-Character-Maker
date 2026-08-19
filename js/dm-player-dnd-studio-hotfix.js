(function (global) {
  "use strict";

  if (!global?.Node || global.LuminousDmPlayerDndObserverHotfix) return;

  const descriptor = Object.getOwnPropertyDescriptor(global.Node.prototype, "textContent");
  if (!descriptor?.get || !descriptor?.set) return;

  Object.defineProperty(global.Node.prototype, "textContent", {
    configurable: descriptor.configurable,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(value) {
      const nextValue = value == null ? "" : String(value);
      const isDndLegacyButton =
        this?.nodeType === 1 &&
        this?.matches?.("#grid-jugadores .btn-open-modal") &&
        this?.dataset?.dndStudioProxy === "true";

      if (isDndLegacyButton && descriptor.get.call(this) === nextValue) {
        return;
      }

      descriptor.set.call(this, value);
    },
  });

  global.LuminousDmPlayerDndObserverHotfix = true;
})(window);
