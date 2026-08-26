(function (global) {
  "use strict";

  const doc = global.document;
  global.LuminousDmPlayerDndStudioOwnsRacialStats = true;

  function ensureRacialIntegrationAssets() {
    if (!doc?.head) return;
    const assets = [
      ["canonical-race-integration-script", "js/canonical-race-integration.js", "racial-stats"],
      ["existing-racial-stat-integration-script", "js/existing-racial-stat-integration.js", "racial-stats"],
      ["trait-engine-script", "js/trait-engine.js", "trait-engine"],
      ["racial-trait-catalog-script", "js/racial-trait-catalog.js", "racial-traits"],
      ["canonical-racial-traits-script", "js/canonical-racial-traits.js", "racial-traits"],
    ];

    assets.forEach(([id, src, engine]) => {
      if (doc.getElementById(id)) return;
      const script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.dataset.engine = engine;
      doc.head.appendChild(script);
    });
  }

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

  function installPlayerProxyMilestoneSync() {
    const EventCtor = global.Event;
    if (!doc || typeof doc.addEventListener !== "function" || typeof EventCtor !== "function") return;
    if (global.LuminousDmPlayerProxyMilestoneSync) return;

    doc.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#grid-jugadores .btn-open-modal");
      if (!button) return;

      const playerId = String(button.getAttribute?.("data-id") || "").trim();
      const select = doc.getElementById("dm-player-dnd-select");
      if (!playerId || !select || select.value === playerId) return;

      select.value = playerId;
      select.dispatchEvent(new EventCtor("change", { bubbles: true }));
    }, true);

    global.LuminousDmPlayerProxyMilestoneSync = true;
  }

  ensureRacialIntegrationAssets();
  ensureClassMilestoneAssets();
  installPlayerProxyMilestoneSync();

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