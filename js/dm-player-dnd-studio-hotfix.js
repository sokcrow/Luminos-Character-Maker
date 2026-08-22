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

    if (!doc.getElementById("class-milestone-trait-integration-script")) {
      const integration = doc.createElement("script");
      integration.id = "class-milestone-trait-integration-script";
      integration.src = "js/class-milestone-trait-integration.js";
      integration.async = false;
      doc.head?.appendChild(integration);
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

  function installPlayerSelectValueSync() {
    const Select = global.HTMLSelectElement;
    const EventCtor = global.Event;
    if (!Select?.prototype || typeof EventCtor !== "function") return;
    if (Select.prototype.__luminousMilestoneValueSync) return;

    const descriptor = Object.getOwnPropertyDescriptor(Select.prototype, "value");
    if (!descriptor?.get || !descriptor?.set || descriptor.configurable === false) return;

    Object.defineProperty(Select.prototype, "value", {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        const before = descriptor.get.call(this);
        descriptor.set.call(this, value);
        const after = descriptor.get.call(this);
        if (this?.id === "dm-player-dnd-select" && before !== after) {
          this.dispatchEvent(new EventCtor("change", { bubbles: true }));
        }
      },
    });

    Object.defineProperty(Select.prototype, "__luminousMilestoneValueSync", {
      configurable: true,
      value: true,
    });
  }

  ensureClassMilestoneAssets();
  installPlayerSelectValueSync();

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
