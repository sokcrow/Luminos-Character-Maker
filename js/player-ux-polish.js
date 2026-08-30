(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  function ensureStyle(id, href) {
    let link = doc.getElementById(id);
    if (link) return link;
    link = doc.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    doc.head.appendChild(link);
    return link;
  }

  function ensureScript(id, src) {
    return new Promise((resolve, reject) => {
      let script = doc.getElementById(id);
      if (script) {
        if (script.dataset.loaded === "true") return resolve(script);
        script.addEventListener("load", () => resolve(script), { once: true });
        script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
        return;
      }

      script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve(script);
      }, { once: true });
      script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      doc.head.appendChild(script);
    });
  }

  async function boot() {
    try {
      await ensureScript("player-ux-polish-core-script", "js/player-ux-polish-core.js");

      if (!doc.getElementById("inventory-modal")) return;

      ensureStyle("inventory-hud-v2-stylesheet", "css/inventory-hud-v2.css");

      await ensureScript("anatomy-equipment-engine-script", "js/anatomy-equipment-engine.js");
      await ensureScript("item-runtime-engine-script", "js/item-runtime-engine.js");
      await ensureScript("item-inventory-runtime-script", "js/item-inventory-runtime.js");
      await ensureScript("item-persistence-runtime-script", "js/item-persistence-runtime.js");
      await ensureScript("item-realtime-sync-script", "js/item-realtime-sync.js");
      await ensureScript("item-augmentation-runtime-script", "js/item-augmentation-runtime.js");
      await ensureScript("item-equipment-bridge-script", "js/item-equipment-bridge.js");
      await ensureScript("inventory-hud-v2-script", "js/inventory-hud-v2.js");
    } catch (error) {
      console.error("[Luminous] Inventory HUD V2 bootstrap failed:", error);
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);
