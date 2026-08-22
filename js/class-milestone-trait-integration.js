(function (global) {
  "use strict";

  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");

  function mergeTraitLists(granted = [], selected = [], traitEngine = global.LuminousTraitEngine) {
    const byId = new Map();
    [...(granted || []), ...(selected || [])].forEach((definition) => {
      if (!definition) return;
      const trait = traitEngine?.normalizeTrait ? traitEngine.normalizeTrait(definition) : definition;
      const id = normalizeId(trait?.id || trait?.name);
      if (!id || byId.has(id)) return;
      byId.set(id, trait);
    });
    return [...byId.values()];
  }

  function wrapLibrary(library, milestones = global.LuminousClassMilestones, traitEngine = global.LuminousTraitEngine) {
    if (!library?.resolveForCharacter || !milestones?.resolveSelectedGeneralTraits) return null;
    if (library.__classMilestoneTraitsIntegrated) return library;

    const originalResolve = library.resolveForCharacter.bind(library);
    const wrapped = {
      ...library,
      __classMilestoneTraitsIntegrated: true,
      resolveForCharacter(character) {
        const granted = originalResolve(character) || [];
        const definitions = library.getDefinitions?.() || {};
        const selected = milestones.resolveSelectedGeneralTraits(character || {}, definitions);
        return mergeTraitLists(granted, selected, traitEngine);
      },
    };
    return Object.freeze(wrapped);
  }

  function patchRuntimeLibrary() {
    const library = global.LuminousDmTraitLibrary;
    const wrapped = wrapLibrary(library);
    if (!wrapped) return false;
    if (wrapped !== library) global.LuminousDmTraitLibrary = wrapped;
    return true;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { mergeTraitLists, wrapLibrary };
  }

  if (!global?.document) return;
  if (patchRuntimeLibrary()) return;

  const retry = global.setInterval(() => {
    if (patchRuntimeLibrary()) global.clearInterval(retry);
  }, 250);
})(typeof window !== "undefined" ? window : globalThis);
