(function (global) {
  "use strict";
  if (global.LuminousItemCatalogHudSync) return;
  const refresh = () => global.LuminousInventoryHudV2?.renderAll?.();
  global.addEventListener?.("luminous:item-catalog-updated", refresh);
  global.LuminousItemCatalogHudSync = Object.freeze({ version: 1, refresh });
})(typeof window !== "undefined" ? window : globalThis);
