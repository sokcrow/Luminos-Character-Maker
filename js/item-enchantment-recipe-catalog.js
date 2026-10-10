(function (global) {
  "use strict";
  if (global.LuminousEnchantmentRecipeCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEnchantmentRecipeCatalog;
    return;
  }
  const VERSION = 1;
  const TIERS = Object.freeze({
    1: Object.freeze({ tier: 1, multiplier: 1.5, laborShare: 0.10, arcaneEssence: 2, manaCores: 0, exoticCores: 0, cutGems: 1 }),
    2: Object.freeze({ tier: 2, multiplier: 2.5, laborShare: 0.25, arcaneEssence: 4, manaCores: 1, exoticCores: 0, cutGems: 2 }),
    3: Object.freeze({ tier: 3, multiplier: 4.0, laborShare: 0.60, arcaneEssence: 8, manaCores: 2, exoticCores: 1, cutGems: 3 }),
  });
  const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
  const idOf = (v) => String(v ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const enchantment = () => global.LuminousItemEnchantmentRuntime || (typeof require === "function" ? require("./item-enchantment-runtime.js") : null);
  const ore = () => global.LuminousOreIngotGemCatalog || (typeof require === "function" ? require("./item-catalog-ore-ingot-gem.js") : null);
  const essence = () => global.LuminousEssenceCoreCatalog || (typeof require === "function" ? require("./item-catalog-essence-core.js") : null);
  const economy = () => global.LuminousItemEconomyStandard || (typeof require === "function" ? require("./item-economy-standard.js") : null);
  function money(value) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? Math.round(n / 10) * 10 : 0;
  }
  function entryFor(id) { return essence()?.get?.(id) || ore()?.get?.(id) || null; }
  function cutGems() { return ore()?.list?.({ form: "cut_gem" }) || []; }
  function ingredient(id, quantity) {
    const entry = entryFor(id);
    if (!entry || !(Number(quantity) > 0)) return null;
    const unitValueAhn = entry.standardUnitValueAhn ?? entry.standardMediumValueAhn;
    if (!Number.isFinite(Number(unitValueAhn)) || Number(unitValueAhn) <= 0) return null;
    return Object.freeze({
      definitionId: entry.id,
      name: entry.name,
      quantity: Math.trunc(Number(quantity)),
      unitValueAhn: money(unitValueAhn),
      valueAhn: money(Number(unitValueAhn) * Number(quantity)),
      resonanceTags: Object.freeze([...(entry.resonanceTags || [])]),
    });
  }
  function recipe(tier, gemId = "ruby") {
    const def = TIERS[Number(tier)];
    if (!def) return { valid: false, reason: "unsupported_enchantment_level" };
    const gem = ore()?.get?.(gemId);
    if (!gem || gem.form !== "cut_gem") return { valid: false, reason: "cut_gem_required" };
    const rows = [
      ingredient("arcane_essence", def.arcaneEssence),
      def.manaCores ? ingredient("mana_energy_core", def.manaCores) : null,
      def.exoticCores ? ingredient("exotic_core", def.exoticCores) : null,
      ingredient(gem.id, def.cutGems),
    ].filter(Boolean);
    if (rows.length !== 2 + Number(def.manaCores > 0) + Number(def.exoticCores > 0)) {
      return { valid: false, reason: "material_catalog_unavailable" };
    }
    const referenceWage = Number(economy()?.REFERENCE_MONTHLY_WAGE_AHN) || 1000000;
    const laborAhn = money(referenceWage * def.laborShare);
    const materialValueAhn = rows.reduce((sum, row) => sum + row.valueAhn, 0);
    return Object.freeze({
      valid: true, tier: def.tier, multiplier: def.multiplier, gemId: gem.id,
      resonanceTags: Object.freeze([...(gem.resonanceTags || [])]),
      materials: Object.freeze(rows), materialValueAhn, laborAhn,
      estimatedCraftValueAhn: materialValueAhn + laborAhn,
      chargedAhn: laborAhn, currency: "AHN",
    });
  }
  function mundaneBaseValueAhn(item = {}) {
    const original = Number(item.enchantmentBaseValueAhn ?? item.baseMundaneValueAhn);
    if (Number.isFinite(original) && original > 0) return money(original);
    if (enchantment()?.activeEnchantment?.(item)) return null;
    for (const field of ["productionValueAhn", "unitValueAhn", "productionValue", "standardValueAhn"]) {
      const amount = Number(item[field]);
      if (Number.isFinite(amount) && amount > 0) return money(amount);
    }
    return null;
  }
  function quote(item = {}, input = {}) {
    const { tier, channel, gemId = "ruby", replace = false } = input;
    const gate = enchantment()?.validate?.(item, { level: tier, channel }, { replace: replace === true });
    if (!gate?.valid) return { valid: false, reason: gate?.reason || "enchantment_runtime_unavailable" };
    const prepared = recipe(tier, gemId);
    if (!prepared.valid) return prepared;
    const baseValueAhn = mundaneBaseValueAhn(item);
    // A missing Item price must never silently turn into a free craft.
    if (baseValueAhn == null) return { ...prepared, valid: false, reason: "unpriced_item", kind: gate.kind, channel: gate.channel };
    const enchantedValueAhn = money(Math.max(baseValueAhn * prepared.multiplier, baseValueAhn + prepared.estimatedCraftValueAhn));
    return Object.freeze({
      ...prepared, valid: true, kind: gate.kind, channel: gate.channel,
      baseValueAhn, enchantedValueAhn, enchantmentValueAhn: enchantedValueAhn - baseValueAhn,
      effectiveMultiplier: enchantedValueAhn / baseValueAhn,
      replacement: replace === true,
    });
  }
  function applyValuation(item, prepared, options = {}) {
    if (!prepared?.valid || !Number.isFinite(prepared.baseValueAhn) || !enchantment()?.activeEnchantment?.(item)) {
      return { applied: false, reason: "enchantment_or_price_missing" };
    }
    item.baseMundaneValueAhn = prepared.baseValueAhn;
    item.enchantmentBaseValueAhn = prepared.baseValueAhn;
    item.enchantmentMultiplier = prepared.effectiveMultiplier;
    item.enchantmentValueAhn = prepared.enchantmentValueAhn;
    item.enchantmentPricingStatus = "priced";
    item.productionValueAhn = prepared.enchantedValueAhn;
    item.unitValueAhn = prepared.enchantedValueAhn;
    item.totalValueAhn = prepared.enchantedValueAhn * Math.max(1, Number(item.quantity ?? item.cantidad ?? 1));
    item.enchantment.economy = {
      schemaVersion: VERSION,
      gemstoneId: prepared.gemId,
      resonanceTags: clone(prepared.resonanceTags),
      materialsValueAhn: prepared.materialValueAhn,
      laborAhn: prepared.laborAhn,
      valuationAhn: prepared.enchantedValueAhn,
      mode: options.mode === "craft" ? "craft" : "dm_authoring",
    };
    return { applied: true, item };
  }
  function restoreMundaneValue(item) {
    const base = Number(item?.enchantmentBaseValueAhn ?? item?.baseMundaneValueAhn);
    if (!Number.isFinite(base) || base <= 0) return { restored: false, reason: "missing_mundane_value" };
    item.productionValueAhn = money(base);
    item.unitValueAhn = money(base);
    item.totalValueAhn = money(base) * Math.max(1, Number(item.quantity ?? item.cantidad ?? 1));
    item.enchantmentMultiplier = 1;
    item.enchantmentValueAhn = 0;
    item.enchantmentPricingStatus = "multiplier_ready";
    return { restored: true, item };
  }
  const api = Object.freeze({
    VERSION, TIERS, recipe, quote, cutGems, mundaneBaseValueAhn, applyValuation, restoreMundaneValue,
  });
  global.LuminousEnchantmentRecipeCatalog = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
