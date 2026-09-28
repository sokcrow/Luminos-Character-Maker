(function (global) {
  "use strict";

  if (global.LuminousEquipmentEnhancementContract) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEquipmentEnhancementContract;
    return;
  }

  const VERSION = 2;
  const ELIGIBLE_KINDS = Object.freeze(["weapon","armor","shield","accessory","valuable"]);
  const ENCHANTMENT_LEVELS = Object.freeze([1,2,3]);
  const MUNDANE_LEVEL = 0;

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,"");
  }
  function kindOf(item = {}) {
    return normalizeId(item.itemType || item.category || item.equipment?.kind || item.kind || item.type);
  }
  function levelOf(input = {}) {
    const raw = input.enhancementLevel ?? input.enchantmentLevel ?? input.enhancement?.level ?? input.enchantment?.level ?? 0;
    const n = Number(raw);
    return Number.isInteger(n) ? n : NaN;
  }
  function sourceOf(input = {}) {
    return normalizeId(input.enhancementSource || input.enchantmentSource || input.enhancement?.source || input.enchantment?.source || (levelOf(input) > 0 ? "enchantment" : "mundane"));
  }
  function validate(input = {}) {
    const kind = kindOf(input);
    const level = levelOf(input);
    const source = sourceOf(input);
    if (!ELIGIBLE_KINDS.includes(kind)) return Object.freeze({valid:false,reason:"ineligible_equipment_kind",kind,level,source});
    if (!Number.isInteger(level)) return Object.freeze({valid:false,reason:"enhancement_level_must_be_integer",kind,level:null,source});
    if (level < 0) return Object.freeze({valid:false,reason:"negative_enhancement_forbidden",kind,level,source});
    if (level === 0) return Object.freeze({valid:true,kind,level:MUNDANE_LEVEL,source:"mundane",suffix:""});
    if (!ENCHANTMENT_LEVELS.includes(level)) return Object.freeze({valid:false,reason:"unsupported_enchantment_level",kind,level,source});
    if (source !== "enchantment") return Object.freeze({valid:false,reason:"positive_enhancement_requires_enchantment_source",kind,level,source});
    return Object.freeze({valid:true,kind,level,source:"enchantment",suffix:` +${level}`});
  }
  function displayName(item = {}, baseName = null) {
    const base = String(baseName || item.name || item.displayName || "").trim();
    const state = validate(item);
    if (!state.valid || state.level === 0) return base;
    return `${base}${state.suffix}`.trim();
  }
  function mundane(item = {}) {
    const kind = kindOf(item);
    if (!ELIGIBLE_KINDS.includes(kind)) return Object.freeze({valid:false,reason:"ineligible_equipment_kind",kind});
    return Object.freeze({valid:true,kind,level:0,source:"mundane",suffix:""});
  }

  const API = Object.freeze({
    VERSION, ELIGIBLE_KINDS, ENCHANTMENT_LEVELS, MUNDANE_LEVEL,
    normalizeId, kindOf, levelOf, sourceOf, validate, displayName, mundane,
  });

  global.LuminousEquipmentEnhancementContract = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
