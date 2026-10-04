(function (global) {
  "use strict";

  if (global.LuminousPlayerItemContentBootstrap) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousPlayerItemContentBootstrap;
    return;
  }

  const CATALOGS = Object.freeze([
    ["LuminousHpHealingCatalog", "player_hp_healing"],
    ["LuminousHybridHealingCatalog", "player_hybrid_healing"],
    ["LuminousSpHealingCatalog", "player_sp_healing"],
    ["LuminousStatusCureCatalog", "player_status_cure"],
    ["LuminousMedicalSupplyCatalog", "player_medical_supply"],
  ]);

  function registerLoadedCatalogs(options = {}) {
    const registry = options.registry || global.LuminousContentRegistry;
    if (!registry?.registerCatalog) {
      return { registered: 0, skipped: CATALOGS.map(([globalName]) => globalName), errors: ["content_registry_unavailable"] };
    }

    let registered = 0;
    const skipped = [];
    const errors = [];

    CATALOGS.forEach(([globalName, source]) => {
      const catalog = global[globalName];
      if (!catalog) {
        skipped.push(globalName);
        return;
      }
      try {
        if (typeof catalog.registerIntoContentRegistry === "function") {
          const result = catalog.registerIntoContentRegistry({
            registry,
            source,
            nameAliases: true,
            allowSameDefinition: true,
          }) || [];
          registered += Array.isArray(result) ? result.length : 0;
          return;
        }
        if (Array.isArray(catalog.ITEMS)) {
          const result = registry.registerCatalog("item", catalog.ITEMS, {
            source,
            nameAliases: true,
            allowSameDefinition: true,
          }) || [];
          registered += Array.isArray(result) ? result.length : 0;
          return;
        }
        skipped.push(globalName);
      } catch (error) {
        errors.push(globalName + ":" + String(error?.message || error));
      }
    });

    return { registered, skipped, errors };
  }

  const API = Object.freeze({
    version: 1,
    CATALOGS,
    registerLoadedCatalogs,
  });

  global.LuminousPlayerItemContentBootstrap = API;
  registerLoadedCatalogs();

  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
