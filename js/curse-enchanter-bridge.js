(function (global) {
  "use strict";
  if (global.LuminousCurseEnchanterBridge) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCurseEnchanterBridge;
    return;
  }

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const norm = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  const engine = () => global.LuminousItemEnchantmentEngine ||
    (typeof require === "function" ? require("./item-enchantment-engine.js") : null);
  const catalog = () => global.LuminousEnchantmentCatalog ||
    (typeof require === "function" ? require("./item-catalog-enchantments.js") : null);
  const curses = () => global.LuminousCurseRuntime ||
    (typeof require === "function" ? require("./curse-runtime.js") : null);
  const properties = (ref) => Array.isArray(ref?.properties) ? ref.properties.map(norm) : [];
  function inseparableRelic(item) {
    return item?.magic?.relic?.inseparableDrawback === true || item?.relic?.inseparableDrawback === true;
  }
  function listItemCurses(item = {}) {
    const output = [];
    const refs = engine()?.appliedEnchantments?.(item) || [];
    refs.forEach((ref) => {
      const props = properties(ref);
      const kind = props.includes("bind") ? "item_magic_bind" : props.includes("curse") ? "enchantment_curse" : null;
      if (!kind) return;
      const definitionId = norm(ref.definitionId || ref.enchantmentId || ref.id);
      const source = norm(ref.source || "direct");
      const definition = catalog()?.get?.(definitionId) || null;
      const validation = engine()?.validateAppliedReference?.(ref);
      const distinct = source === "gem" && ref.anchorId ? String(ref.anchorId) : null;
      const removable = kind === "enchantment_curse" && props.length === 1 &&
        definition?.removable === true && validation?.valid === true &&
        source === "direct" && !inseparableRelic(item);
      output.push(Object.freeze({
        kind, source:"enchantment", sourceKind:source,
        definitionId, anchorId:distinct,
        applicationId:ref.applicationId == null ? null : String(ref.applicationId),
        removable:removable === true,
        reason:inseparableRelic(item) ? "relic_drawback_inseparable"
          : kind === "item_magic_bind" ? "bound_curse_not_removable"
            : props.length !== 1 || !validation?.valid ? "invalid_curse_enchantment"
              : source !== "direct" ? "gem_anchored_curse_requires_anchor_procedure"
                : definition?.removable !== true ? "enchantment_not_removable"
                  : null,
      }));
    });
    (curses()?.instances?.(item) || []).forEach((instance) => {
      output.push(Object.freeze({
        kind:"autonomous",source:"curse_runtime",sourceKind:"autonomous",
        instanceId:String(instance.instanceId),definitionId:String(instance.definitionId),
        state:String(instance.state),removable:false,
        reason:"autonomous_curse_requires_specific_resolution",
      }));
    });
    return Object.freeze(output.map(clone));
  }
  function selectRemoveCurseTarget(item = {}, quote = {}) {
    if (inseparableRelic(item)) return {allowed:false,reason:"relic_drawback_inseparable"};
    const refs = listItemCurses(item);
    // Never silently select a different spell/Curse from the one quoted.
    const raw = quote.curseTarget == null ? null : quote.curseTarget;
    if (raw != null && (!raw || typeof raw !== "object" || Array.isArray(raw))) {
      return {allowed:false,reason:"invalid_curse_target"};
    }
    if (raw && raw.kind != null && raw.kind !== "enchantment_curse") {
      return {allowed:false,reason:"autonomous_curse_requires_specific_resolution"};
    }
    const id = norm(raw?.definitionId || quote.definitionId || "");
    const applicationId = raw?.applicationId == null ? null : String(raw.applicationId);
    const anchorId = raw?.anchorId == null ? null : String(raw.anchorId);
    if ((raw || quote.definitionId) && !id) return {allowed:false,reason:"invalid_curse_target"};
    if (raw && raw.instanceId != null) {
      return {allowed:false,reason:"autonomous_curse_requires_specific_resolution"};
    }
    const normal = refs.filter(ref => ref.kind === "enchantment_curse");
    if (!normal.length) return {allowed:false,reason:"removable_curse_not_found"};
    const selected = normal.filter(ref => (!id || ref.definitionId === id) &&
      (applicationId == null || ref.applicationId === applicationId) &&
      (anchorId == null || ref.anchorId === anchorId));
    if (selected.length === 0) return {allowed:false,reason:"curse_target_not_found"};
    if (selected.length !== 1) return {allowed:false,reason:"curse_target_required"};
    const entry = selected[0];
    if (!entry.removable) return {allowed:false,reason:entry.reason || "curse_not_removable",target:entry};
    const duplicates = normal.filter(ref => ref.definitionId === entry.definitionId &&
      ref.sourceKind === entry.sourceKind && ref.anchorId === entry.anchorId);
    if (duplicates.length > 1 && (!entry.applicationId ||
        duplicates.filter(ref=>ref.applicationId === entry.applicationId).length !== 1)) {
      return {allowed:false,reason:"curse_target_ambiguous",target:entry};
    }
    return {allowed:true,target:entry};
  }
  const api = Object.freeze({VERSION:1,listItemCurses,selectRemoveCurseTarget});
  global.LuminousCurseEnchanterBridge = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
