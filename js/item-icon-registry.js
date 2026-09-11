(function (global) {
  "use strict";
  const groups = Object.freeze({
    "healing_hp": "https://imgur.com/GcnX53v.png",
    "healing_sp": "https://imgur.com/LCpKGIH.png",
    "healing_hybrid": "https://imgur.com/DrIZie0.png",
    "status_cure": "https://imgur.com/17tJuSM.png",
    "buff_consumable": "https://imgur.com/9wGle81.png",
    "poison_consumable": "https://imgur.com/VsWisJQ.png",
    "consumable_other": "https://imgur.com/1RZqDFI.png",
    "food_meat": "https://imgur.com/uFmUpuD.png",
    "ration": "https://imgur.com/6yDrI9e.png",
    "drink": "https://imgur.com/Tf3bZPM.png",
    "scrap_mechanical": "https://imgur.com/IrtN5aS.png",
    "electronic_parts": "https://imgur.com/wTNk2Te.png",
    "precision_component": "https://imgur.com/8684d59.png",
    "circuitry": "https://imgur.com/FfDiki6.png",
    "chemical": "https://imgur.com/MvbtE4u.png",
    "textile": "https://imgur.com/4gr0EeJ.png",
    "hide_leather": "https://imgur.com/nK6vQIR.png",
    "ore_mineral": "https://imgur.com/Pwm1Idx.png",
    "organic_material": "https://imgur.com/lqQbJds.png",
    "plant_herb": "https://imgur.com/DucSfXD.png",
    "bone_horn": "https://imgur.com/fUEV5vu.png",
    "organ_gland": "https://imgur.com/rXlXbOG.png",
    "abnormality_part": "https://imgur.com/JpK4vSq.png",
    "repair_kit": "https://imgur.com/OZdAHys.png",
    "key_access": "https://imgur.com/trjsYlm.png",
    "document": "https://imgur.com/Mx8Vwn9.png",
    "valuable": "https://imgur.com/XhS73M2.png",
    "generic_item": "https://imgur.com/clIQfGj.png",
    "tool": "https://imgur.com/rGCFKQD.png",
    "ammo": "https://imgur.com/gFEZebC.png",
    "energy_cell": "https://imgur.com/32d4YwR.png",
    "fuel": "https://imgur.com/mOsNK1L.png",
    "quest_item": "https://imgur.com/eLUFiXE.png",
    "throwable": "https://imgur.com/3w2YnUX.png",
    "medical_supply": "https://imgur.com/CrWqqZh.png",
    "toxin_material": "https://imgur.com/4kqV4TO.png",
    "craft_component": "https://imgur.com/exU9uZ1.png",
    "data_storage": "https://imgur.com/9vCVQL4.png",
    "relic": "https://imgur.com/WfXrRoE.png",
    "weapon_melee": "https://imgur.com/3AEGrWu.png",
    "weapon_ranged": "https://imgur.com/PWnWMq1.png",
    "shield": "https://imgur.com/UnS3IAr.png",
    "accessory": "https://imgur.com/G6YFWYw.png",
    "armor_light": "https://imgur.com/yO2oNKD.png",
    "armor_medium": "https://imgur.com/Yq7KrcC.png",
    "armor_heavy": "https://imgur.com/Jqri9Tk.png"
  });
  const categoryFallbacks = Object.freeze({
    weapon: "weapon_melee",
    armor: "armor_light",
    shield: "shield",
    accessory: "accessory",
    consumable: "consumable_other",
    ammo: "ammo",
    tool: "tool",
    module: "precision_component",
    upgrade: "precision_component",
    material: "craft_component",
    ingredient: "craft_component",
    trade_good: "valuable",
    item: "generic_item"
  });

  function normalize(value) {
    return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function resolveGroup(group, fallback = "generic_item") {
    const key = normalize(group);
    if (groups[key]) return groups[key];
    const fb = normalize(fallback);
    return groups[fb] || groups.generic_item;
  }

  function groupOf(item = {}) {
    const explicit = normalize(item.iconGroup || item.icon_group);
    if (explicit && groups[explicit]) return explicit;
    const category = normalize(item.category || item.tipo_categoria || item.itemType || item.type);
    return categoryFallbacks[category] || "generic_item";
  }

  function resolve(item = {}, options = {}) {
    const override = String(item.iconOverride || item.icon_override || "").trim();
    if (override) return override;
    const group = groupOf(item);
    return resolveGroup(group, options.fallback || "generic_item");
  }

  function has(group) { return Boolean(groups[normalize(group)]); }
  function list() { return Object.entries(groups).map(([id, url]) => ({ id, url })); }

  const api = Object.freeze({ version: 1, groups, categoryFallbacks, normalize, resolveGroup, groupOf, resolve, has, list });
  global.LuminousItemIconRegistry = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
