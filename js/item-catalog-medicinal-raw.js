(function (global) {
  "use strict";
  if (global.LuminousMedicinalRawCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousMedicinalRawCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "medicinal_raw";
  const DEFAULT_QUALITY = "standard";

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function freezeTags(values) {
    return Object.freeze([...new Set((values || []).map(normalizeId).filter(Boolean))]);
  }
  function item(id, name, iconFamily, standardUnitValueAhn, tags = [], roles = []) {
    return Object.freeze({
      id, name, family: FAMILY, iconFamily,
      category: "material", itemType: "ingredient",
      baseQuality: DEFAULT_QUALITY, qualitySystem: "universal",
      stackable: true, rawCraftingReagent: true,
      standardUnitValueAhn: Math.max(0, Math.round(Number(standardUnitValueAhn) || 0)),
      productionValueAhn: Math.max(0, Math.round(Number(standardUnitValueAhn) || 0)),
      tags: freezeTags(["ingredient","medicinal_raw",...tags]),
      reagentTags: freezeTags(roles),
    });
  }

  const ITEMS = Object.freeze([
    item("purified_water","Purified Water","sterile_solution",800,["carrier"],["liquid_carrier"]),
    item("sterile_water","Sterile Water","sterile_solution",1400,["sterile","carrier"],["sterile_carrier","liquid_carrier"]),
    item("medical_saline","Medical Saline","sterile_solution",2200,["sterile","electrolyte"],["sterile_carrier","electrolyte_carrier"]),
    item("glucose_powder","Glucose / Dextrose","pharma_reagent",1300,["pharmaceutical"],["nutrient_reagent","pharma_reagent"]),
    item("electrolyte_salts","Electrolyte Salts","electrolyte_reagent",1800,["mineral"],["electrolyte_reagent"]),
    item("calcium_salts","Calcium Salts","electrolyte_reagent",1800,["mineral"],["electrolyte_reagent"]),
    item("magnesium_salts","Magnesium Salts","electrolyte_reagent",1900,["mineral"],["electrolyte_reagent"]),
    item("potassium_salts","Potassium Salts","electrolyte_reagent",2000,["mineral"],["electrolyte_reagent"]),
    item("bicarbonate_salt","Bicarbonate Salt","medical_buffer",1500,["buffer"],["medical_buffer"]),
    item("activated_charcoal","Activated Charcoal","pharma_reagent",1800,["absorbent"],["absorbent_reagent","detox_reagent"]),
    item("medical_alcohol","Medical Alcohol","medical_solvent",1800,["solvent","antiseptic"],["medical_solvent","antiseptic_reagent"]),
    item("glycerin","Glycerin","medical_solvent",1700,["carrier"],["medical_solvent","liquid_carrier","humectant"]),
    item("pharmaceutical_glycol","Pharmaceutical Glycol","medical_solvent",2200,["carrier"],["medical_solvent","liquid_carrier"]),
    item("medical_mineral_oil","Medical Mineral Oil","medical_solvent",1700,["topical"],["topical_carrier","oil_carrier"]),
    item("petrolatum","Medical Petrolatum","medical_polymer",1800,["topical"],["topical_carrier","ointment_carrier"]),
    item("citric_acid","Citric Acid","medical_buffer",1300,["acidifier"],["medical_buffer","acidifier"]),
    item("phosphate_buffer","Phosphate Buffer","medical_buffer",2400,["buffer"],["medical_buffer"]),
    item("iodine_reagent","Iodine Reagent","antiseptic_reagent",2500,["antiseptic"],["antiseptic_reagent"]),
    item("oxidizing_antiseptic","Oxidizing Antiseptic Reagent","antiseptic_reagent",2600,["antiseptic"],["antiseptic_reagent"]),
    item("sterilizing_agent","Sterilizing Agent","antiseptic_reagent",2800,["sterilization"],["antiseptic_reagent","sterilizing_reagent"]),
    item("pharmaceutical_starch","Pharmaceutical Starch","pharma_reagent",1300,["excipient"],["pharma_reagent","tablet_excipient"]),
    item("medical_cellulose","Medical Cellulose","medical_polymer",1700,["excipient"],["medical_polymer","tablet_excipient"]),
    item("capsule_shell_material","Capsule Shell Material","medical_polymer",1600,["excipient"],["medical_polymer","capsule_material"]),
    item("tablet_binder","Tablet Binder","medical_polymer",1600,["excipient"],["medical_polymer","tablet_binder"]),
    item("disintegrant","Disintegrant","pharma_reagent",1700,["excipient"],["pharma_reagent","tablet_excipient"]),
    item("pharmaceutical_emulsifier","Pharmaceutical Emulsifier","pharma_reagent",2100,["excipient"],["pharma_reagent","emulsifier"]),
    item("suspending_agent","Suspending Agent","pharma_reagent",2100,["excipient"],["pharma_reagent","suspending_agent"]),
    item("preservative_reagent","Pharmaceutical Preservative","pharma_reagent",2300,["preservative"],["pharma_reagent","preservative_reagent"]),
    item("stabilizer_reagent","Pharmaceutical Stabilizer","medical_buffer",2600,["stabilizer"],["medical_buffer","stabilizer_reagent"]),
    item("chemical_toxin_reagent","Chemical Toxin Reagent","chemical_toxin",3200,["chemical","toxic"],["chemical_toxin","toxin_source","toxin_reagent"]),
    item("absorbent_cotton","Absorbent Cotton","textile",1200,["medical_textile"],["medical_dressing_material"]),
    item("medical_gauze","Medical Gauze","textile",1600,["medical_textile"],["medical_dressing_material"]),
    item("sterile_cloth","Sterile Cloth","textile",1800,["medical_textile","sterile"],["medical_dressing_material","sterile_material"]),
    item("medical_fiber","Medical Fiber","textile",1700,["medical_textile"],["medical_dressing_material","suture_material"]),
    item("suture_material","Suture Material","textile",2200,["medical_textile"],["suture_material"]),
    item("medical_mesh","Medical Mesh","textile",3200,["medical_textile"],["medical_mesh","medical_dressing_material"]),
    item("splint_stock","Splint Stock","structural_stock",2400,["orthopedic"],["orthopedic_material"]),
    item("absorbent_pad","Absorbent Pad","textile",1700,["medical_textile"],["medical_dressing_material"]),
    item("medical_thread","Medical Thread","textile",1900,["medical_textile"],["suture_material"]),
    item("sterile_container","Sterile Container","container",2200,["container","sterile"],["sterile_container"]),
    item("medical_vial_blank","Medical Vial","container",1800,["container"],["medical_vial","medicine_container"]),
    item("ampoule_blank","Ampoule Blank","container",2100,["container"],["ampoule_blank","medicine_container"]),
    item("inhaler_canister","Inhaler Canister","container",4200,["delivery_component"],["inhaler_canister","medicine_container"]),
    item("spray_canister","Medical Spray Canister","container",3600,["delivery_component"],["spray_canister","medicine_container"]),
    item("injector_body","Medical Injector Body","precision_component",7600,["delivery_component"],["injector_body","medicine_delivery_component"]),
    item("toxic_canister_blank","Chemical Canister Blank","container",4200,["delivery_component","chemical"],["toxic_canister_blank","chemical_container"]),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(ITEMS.map((entry) => [entry.id, entry])));
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function get(id) { const entry = BY_ID[normalizeId(id)]; return entry ? clone(entry) : null; }
  function list(options = {}) {
    const tag = normalizeId(options.tag || options.reagentTag);
    const iconFamily = normalizeId(options.iconFamily);
    return ITEMS
      .filter((entry) => !tag || entry.tags.includes(tag) || entry.reagentTags.includes(tag))
      .filter((entry) => !iconFamily || entry.iconFamily === iconFamily)
      .map(clone);
  }
  function validateCatalog() {
    const errors = [];
    const ids = new Set();
    for (const entry of ITEMS) {
      if (!entry.id || ids.has(entry.id)) errors.push({ id: entry.id, error: "duplicate_or_missing_id" });
      if (!(entry.standardUnitValueAhn > 0)) errors.push({ id: entry.id, error: "invalid_value" });
      ids.add(entry.id);
    }
    return { valid: errors.length === 0, errors, count: ITEMS.length };
  }

  const API = Object.freeze({ VERSION, FAMILY, DEFAULT_QUALITY, ITEMS, get, list, validateCatalog });
  global.LuminousMedicinalRawCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
