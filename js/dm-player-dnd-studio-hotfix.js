(function (global) {
  "use strict";

  const doc = global.document;

  function ensureClassMilestoneAssets() {
    if (!doc) return;

    if (!doc.getElementById("dm-player-class-milestones-style")) {
      const link = doc.createElement("link");
      link.id = "dm-player-class-milestones-style";
      link.rel = "stylesheet";
      link.href = "css/dm-player-class-milestones.css";
      doc.head?.appendChild(link);
    }

    const loadUi = () => {
      if (global.LuminousDmPlayerClassMilestones || doc.getElementById("dm-player-class-milestones-script")) return;
      const script = doc.createElement("script");
      script.id = "dm-player-class-milestones-script";
      script.src = "js/dm-player-class-milestones.js";
      script.async = false;
      doc.head?.appendChild(script);
    };

    if (global.LuminousClassMilestones) {
      loadUi();
      return;
    }

    let engineScript = doc.getElementById("class-milestone-engine-script");
    if (!engineScript) {
      engineScript = doc.createElement("script");
      engineScript.id = "class-milestone-engine-script";
      engineScript.src = "js/class-milestone-engine.js";
      engineScript.async = false;
      engineScript.addEventListener("load", loadUi, { once: true });
      doc.head?.appendChild(engineScript);
    } else {
      engineScript.addEventListener("load", loadUi, { once: true });
    }
  }

  ensureClassMilestoneAssets();

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
