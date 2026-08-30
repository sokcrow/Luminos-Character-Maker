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

  function ensureScript(id, src, globalName) {
    return new Promise((resolve, reject) => {
      if (globalName && global[globalName]) return resolve(doc.getElementById(id) || null);

      let script = doc.getElementById(id);
      if (script) {
        if (script.dataset.loaded === "true" || (globalName && global[globalName])) return resolve(script);
        script.addEventListener("load", () => {
          script.dataset.loaded = "true";
          resolve(script);
        }, { once: true });
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
      await ensureScript("player-ux-polish-core-script", "js/player-ux-polish-core.js", "LuminousPlayerUxPolish");

      if (!doc.getElementById("inventory-modal")) return;

      ensureStyle("inventory-hud-v2-stylesheet", "css/inventory-hud-v2.css");
      ensureStyle("inventory-hud-v2-approved-layout-stylesheet", "css/inventory-hud-v2-approved-layout.css");

      await ensureScript("anatomy-equipment-engine-script", "js/anatomy-equipment-engine.js", "LuminousAnatomyEquipmentEngine");
      await ensureScript("item-runtime-engine-script", "js/item-runtime-engine.js", "LuminousItemRuntime");
      await ensureScript("item-inventory-runtime-script", "js/item-inventory-runtime.js", "LuminousItemInventoryRuntime");
      await ensureScript("item-persistence-runtime-script", "js/item-persistence-runtime.js", "LuminousItemPersistenceRuntime");
      await ensureScript("item-realtime-sync-script", "js/item-realtime-sync.js", "LuminousItemRealtimeSync");
      await ensureScript("item-augmentation-runtime-script", "js/item-augmentation-runtime.js", "LuminousItemAugmentationRuntime");
      await ensureScript("item-equipment-bridge-script", "js/item-equipment-bridge.js", "LuminousItemEquipmentBridge");
      await ensureScript("inventory-hud-v2-script", "js/inventory-hud-v2.js", "LuminousInventoryHudV2");
      await ensureScript("inventory-hud-v2-approved-layout-script", "js/inventory-hud-v2-approved-layout.js", "LuminousInventoryApprovedLayout");
    } catch (error) {
      console.error("[Luminous] Inventory HUD V2 bootstrap failed:", error);
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);
