(function (global) {
  "use strict";

  if (global.LuminousShieldComponentCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShieldComponentCatalog;
    return;
  }

  function safeRequire(path) { if (typeof require !== "function") return null; try { return require(path); } catch (_) { return null; } }
  const Materials = global.LuminousArmorMaterialProfile || safeRequire("./item-armor-material-profile.js");
  if (!Materials) throw new Error("LuminousArmorMaterialProfile is required before LuminousShieldComponentCatalog.");

  const VERSION = 1;
  const FAMILY = "shield_components";
  const CURRENCY = "AHN";
  const DEFAULT_QUALITY = "standard";
  const VALUE_ROUNDING_AHN = 1000;

  const ICONS = Object.freeze({
    shield_component_body: "Assets/Icons/items/equipment/shield.png",
    shield_component_rim: "Assets/Icons/items/equipment/shield_component_rim.png",
    shield_component_grip: "Assets/Icons/items/equipment/shield_component_grip.png",
  });

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function normalizeId(value) { return Materials.normalizeId(value); }
  function roundAhn(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.round(n / VALUE_ROUNDING_AHN) * VALUE_ROUNDING_AHN);
  }
  function materialInput(slot, quantity, requirements, referenceMaterialId, primaryMaterial = false) {
    return Object.freeze({
      slot: normalizeId(slot),
      quantity: Math.max(1, Math.trunc(quantity || 1)),
      requirements: Object.freeze((requirements || []).map(normalizeId)),
      referenceMaterialId: normalizeId(referenceMaterialId),
      primaryMaterial: !!primaryMaterial,
    });
  }
  function component(def) {
    return Object.freeze({
      id: normalizeId(def.id),
      name: def.name,
      family: FAMILY,
      category: "component",
      itemType: "shield_component",
      stackable: true,
      currency: CURRENCY,
      iconFamily: normalizeId(def.iconFamily),
      icon: ICONS[normalizeId(def.iconFamily)] || null,
      role: normalizeId(def.role),
      materialInputs: Object.freeze(def.materialInputs.slice()),
      processMultiplier: Number(def.processMultiplier || 1),
      impactDurabilityMultiplier: Number(def.impactDurabilityMultiplier || 1),
      baseSurfaces: Object.freeze((def.baseSurfaces || []).map(normalizeId)),
      tags: Object.freeze(["shield_component", normalizeId(def.role)].filter(Boolean)),
      notes: def.notes || "",
    });
  }

  const COMPONENTS = Object.freeze([
    component({
      id: "shield_component_body",
      name: "Shield Body",
      iconFamily: "shield_component_body",
      role: "body",
      materialInputs: [materialInput("body", 2, ["structural"], "wood", true)],
      processMultiplier: 1.25,
      impactDurabilityMultiplier: 2.00,
      baseSurfaces: ["impact"],
      notes: "Primary naming/lineage source and main Guard, Weight and impact-Durability contributor.",
    }),
    component({
      id: "shield_component_rim",
      name: "Shield Rim",
      iconFamily: "shield_component_rim",
      role: "rim",
      materialInputs: [materialInput("rim", 1, ["solid", "structural"], "wood", true)],
      processMultiplier: 1.30,
      impactDurabilityMultiplier: 1.50,
      baseSurfaces: ["rim"],
      notes: "Rigid border/reinforcement. Does not override the finished Shield name.",
    }),
    component({
      id: "shield_component_grip",
      name: "Shield Grip",
      iconFamily: "shield_component_grip",
      role: "grip",
      materialInputs: [
        materialInput("core", 1, ["solid", "structural"], "wood", true),
        materialInput("wrap", 1, ["flexible"], "leather", false),
      ],
      processMultiplier: 1.25,
      impactDurabilityMultiplier: 1.00,
      baseSurfaces: ["grip"],
      notes: "Rigid core plus flexible wrap; intentionally mirrors the reinforced-handle material pattern.",
    }),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(COMPONENTS.map((entry) => [entry.id, entry])));

  function get(id) { const row = BY_ID[normalizeId(id)]; return row ? clone(row) : null; }
  function list(options = {}) {
    const role = normalizeId(options.role);
    return COMPONENTS.filter((row) => !role || row.role === role).map(clone);
  }
  function validateMaterial(requirements, material) {
    const tags = new Set(material.tags || []);
    const missing = (requirements || []).filter((tag) => !tags.has(normalizeId(tag)));
    return Object.freeze({ valid: missing.length === 0, missing: Object.freeze(missing) });
  }
  function weightedElemental(rows) {
    const totals = { fire:0, cold:0, lightning:0, acid:0 };
    let units = 0;
    for (const row of rows) {
      const q = Number(row.quantity || 1);
      units += q;
      for (const key of Object.keys(totals)) totals[key] += Number(row.material.elementalWear?.[key] || 1) * q;
    }
    if (!units) return Object.freeze({ fire:1, cold:1, lightning:1, acid:1 });
    return Object.freeze(Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value / units])));
  }

  function resolveComponent(componentId, materialChoices = {}, craft = {}) {
    const def = BY_ID[normalizeId(componentId)];
    if (!def) return null;
    const composition = [];
    let rawDurability = 0;
    let weightScore = 0;
    let inputValue = 0;
    let primaryMaterial = null;

    for (const input of def.materialInputs) {
      const choice = materialChoices[input.slot] ?? materialChoices[input.referenceMaterialId] ?? input.referenceMaterialId;
      const material = Materials.resolve(choice, typeof choice === "object" ? choice : {});
      const validation = validateMaterial(input.requirements, material);
      if (!validation.valid) {
        return Object.freeze({
          valid:false,
          componentId:def.id,
          reason:"incompatible_material",
          slot:input.slot,
          missing:validation.missing,
          materialId:material.id,
        });
      }
      const q = input.quantity;
      rawDurability += q * Number(material.durability || 0);
      weightScore += q * Number(material.weight || 0);
      inputValue += q * Number(material.unitValueAhn || 0);
      composition.push(Object.freeze({ slot:input.slot, quantity:q, primaryMaterial:input.primaryMaterial, material:clone(material) }));
      if (input.primaryMaterial) primaryMaterial = material;
    }

    const baseMaterialDurability = Number(primaryMaterial?.durability || 0);
    const durability = rawDurability * def.impactDurabilityMultiplier;
    return Object.freeze({
      valid:true,
      componentId:def.id,
      name:def.name,
      role:def.role,
      iconFamily:def.iconFamily,
      icon:def.icon,
      composition:Object.freeze(composition),
      primaryMaterial:primaryMaterial ? clone(primaryMaterial) : null,
      materialUnits:composition.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
      rawDurability,
      durability,
      impactDurabilityMultiplier:def.impactDurabilityMultiplier,
      baseMaterialDurability,
      upgradeCapacity:Materials.upgradeSlotsForDurability(baseMaterialDurability),
      weightScore,
      elementalWear:weightedElemental(composition),
      productionValueAhn:roundAhn(inputValue * def.processMultiplier),
      quality:normalizeId(craft.quality || DEFAULT_QUALITY),
      processMultiplier:def.processMultiplier,
      baseSurfaces:Object.freeze(def.baseSurfaces.slice()),
      installedUpgrades:Object.freeze([]),
      upgradeProductionValueAhn:0,
      shieldUpgradeEffects:Object.freeze({}),
    });
  }

  function resolveReferenceComponent(componentId) { return resolveComponent(componentId, {}, { quality:DEFAULT_QUALITY }); }

  const API = Object.freeze({
    VERSION, FAMILY, CURRENCY, DEFAULT_QUALITY, VALUE_ROUNDING_AHN, ICONS, COMPONENTS,
    normalizeId, get, list, validateMaterial, resolveComponent, resolveReferenceComponent, roundAhn,
  });
  global.LuminousShieldComponentCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
