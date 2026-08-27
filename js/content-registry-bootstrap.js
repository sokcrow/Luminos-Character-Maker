(function (global) {
  "use strict";

  const registry = global.LuminousContentRegistry || (typeof require === "function" ? require("./content-registry.js") : null);
  if (!registry) return;

  const registeredSources = new Set();

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  function registerSourceOnce(source, callback) {
    if (registeredSources.has(source)) return [];
    const registered = callback() || [];
    registeredSources.add(source);
    return registered;
  }

  function registerBuildRules(build) {
    if (!build) return [];
    return registerSourceOnce("character-build-rules", () => {
      const out = [];
      out.push(...registry.registerCatalog("class", build.CLASSES || [], { source: "character-build-rules", nameAliases: true }));
      out.push(...registry.registerCatalog("race", build.RACES || [], { source: "character-build-rules", nameAliases: true }));
      out.push(...registry.registerCatalog("background", build.BACKGROUNDS || [], { source: "character-build-rules", nameAliases: true }));

      (build.RACES || []).forEach((race) => {
        (race.subtypes || []).forEach((subtype) => {
          const entry = registry.register({
            type: "subrace",
            id: `${race.id}:${subtype.id}`,
            name: subtype.name,
            sourceKey: "character-build-rules",
            definition: { ...subtype, parentRaceId: race.id },
            aliases: [`${race.id}_${subtype.id}`],
          }, { source: "character-build-rules" });
          out.push(entry);
        });
      });
      return out;
    });
  }

  function registerTraitCatalog(catalog, source = "trait-catalog-core") {
    if (!catalog?.DEFINITIONS) return [];
    return registerSourceOnce(source, () => registry.registerCatalog("trait", catalog.DEFINITIONS, { source }));
  }

  function registerArchetypeCatalog(catalog) {
    if (!catalog) return [];
    return registerSourceOnce("archetype-trait-catalog", () => {
      const out = [];
      out.push(...registry.registerCatalog("archetype", catalog.ARCHETYPES || {}, { source: "archetype-trait-catalog", nameAliases: true }));
      out.push(...registry.registerCatalog("trait", catalog.DEFINITIONS || {}, { source: "archetype-trait-catalog" }));
      return out;
    });
  }

  function registerLanguageCatalog(catalog) {
    const definitions = catalog?.DND_DEFAULTS;
    if (!definitions) return [];
    return registerSourceOnce("language-catalog-engine", () => {
      const adapted = Object.entries(definitions).map(([id, definition]) => ({
        id,
        name: definition?.nombre || definition?.name || id,
        definition: { ...definition, id },
      }));
      return registry.registerCatalog("language", adapted, { source: "language-catalog-engine", nameAliases: true });
    });
  }

  function registerStatusRegistry(statusRegistry) {
    if (!statusRegistry || typeof statusRegistry !== "object") return [];
    return registerSourceOnce("status-registry", () => registry.registerCatalog("status", statusRegistry, { source: "status-registry" }));
  }

  function registerGenericCatalog(type, catalog, source) {
    if (!catalog) return [];
    const definitions = catalog.DEFINITIONS || catalog.definitions || catalog;
    if (!definitions || typeof definitions !== "object") return [];
    return registerSourceOnce(source, () => registry.registerCatalog(type, definitions, { source }));
  }

  function registerAvailableCore(options = {}) {
    const modules = options.modules || {};
    const build = modules.buildRules || global.LuminousCharacterBuildRules || safeRequire("./character-build-rules.js");
    const traitCatalog = modules.traitCatalog || global.LuminousTraitCatalogCore || safeRequire("./trait-catalog-core.js");
    const archetypeCatalog = modules.archetypeCatalog || global.LuminousArchetypeTraitCatalog || safeRequire("./archetype-trait-catalog.js");
    const languageCatalog = modules.languageCatalog || global.LuminousLanguageCatalog || null;
    const statusRegistry = modules.statusRegistry || global.STATUS_REGISTRY || null;

    const registered = [];
    registered.push(...registerBuildRules(build));
    registered.push(...registerTraitCatalog(traitCatalog));
    registered.push(...registerArchetypeCatalog(archetypeCatalog));
    registered.push(...registerLanguageCatalog(languageCatalog));
    registered.push(...registerStatusRegistry(statusRegistry));

    const optionalCatalogs = [
      ["skill", modules.skillCatalog || global.LuminousSkillCatalog, "skill-catalog"],
      ["spell", modules.spellCatalog || global.LuminousSpellCatalog, "spell-catalog"],
      ["item", modules.itemCatalog || global.LuminousItemCatalog, "item-catalog"],
      ["equipment", modules.equipmentCatalog || global.LuminousEquipmentCatalog, "equipment-catalog"],
    ];
    optionalCatalogs.forEach(([type, catalog, source]) => registered.push(...registerGenericCatalog(type, catalog, source)));
    return registered;
  }

  function resetBootstrapState() {
    registeredSources.clear();
  }

  const api = Object.freeze({
    registerAvailableCore,
    registerBuildRules,
    registerTraitCatalog,
    registerArchetypeCatalog,
    registerLanguageCatalog,
    registerStatusRegistry,
    registerGenericCatalog,
    resetBootstrapState,
  });

  global.LuminousContentRegistryBootstrap = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
