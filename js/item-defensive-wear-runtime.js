(function (global) {
  "use strict";

  if (global.LuminousDefensiveWearRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDefensiveWearRuntime;
    return;
  }

  const VERSION = 1;
  const ELEMENTS = Object.freeze(["fire","cold","lightning","acid"]);
  const ELEMENTAL_PRESSURE_MULTIPLIER = 1.25;
  const DAMAGE_PER_WEAR = 10;

  function normalizeId(value) { return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_+|_+$/g,""); }
  function isElemental(type) { return ELEMENTS.includes(normalizeId(type)); }
  function baseWearFromDamage(damage) {
    const n = Math.max(0, Number(damage) || 0);
    if (n <= 0) return 0;
    return Math.max(1, Math.floor(n / DAMAGE_PER_WEAR));
  }
  function materialElementFactor(profile, element) {
    const key = normalizeId(element);
    const direct = Number(profile?.[key]);
    return Number.isFinite(direct) && direct > 0 ? direct : 1;
  }
  function resolveElementalWear({damage=0,element="",elementalWear=null,flatReduction=0}={}) {
    const base = baseWearFromDamage(damage);
    if (!base) return 0;
    const factor = materialElementFactor(elementalWear, element);
    const raw = Math.floor(base * ELEMENTAL_PRESSURE_MULTIPLIER * factor);
    const reduced = raw - Math.max(0, Math.trunc(Number(flatReduction) || 0));
    return Math.max(1, reduced);
  }
  function resolveArmorWear({damage=0,damageType="",elementalWear=null,flatReduction=0}={}) {
    if (isElemental(damageType)) return resolveElementalWear({damage,element:damageType,elementalWear,flatReduction});
    return baseWearFromDamage(damage);
  }
  function resolveShieldWear({contact=false,damage=0,damageType="",elementalWear=null,flatReduction=0,extraContactWear=0}={}) {
    if (!contact) return 0;
    if (isElemental(damageType) && Number(damage) > 0) {
      return Math.max(1, resolveElementalWear({damage,element:damageType,elementalWear,flatReduction}) + Math.max(0,Math.trunc(Number(extraContactWear)||0)));
    }
    return Math.max(1, 1 + Math.max(0,Math.trunc(Number(extraContactWear)||0)));
  }

  const API = Object.freeze({ VERSION, ELEMENTS, ELEMENTAL_PRESSURE_MULTIPLIER, DAMAGE_PER_WEAR, normalizeId, isElemental, baseWearFromDamage, resolveElementalWear, resolveArmorWear, resolveShieldWear });
  global.LuminousDefensiveWearRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
