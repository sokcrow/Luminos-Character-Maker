(function (global) {
  "use strict";

  if (global.LuminousItemIconRegistry) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemIconRegistry;
    return;
  }

  const ICONS = Object.freeze({
    healing_hp: "https://imgur.com/GcnX53v.png",
    healing_sp: "https://imgur.com/LCpKGIH.png",
    healing_hybrid: "https://imgur.com/DrIZie0.png",
    status_cure: "https://imgur.com/17tJuSM.png",
    buff_consumable: "https://imgur.com/9wGle81.png",
    poison_consumable: "https://imgur.com/VsWisJQ.png",
    consumable_other: "https://imgur.com/1RZqDFI.png",
    food_meat: "https://imgur.com/uFmUpuD.png",
    ration: "https://imgur.com/6yDrI9e.png",
    drink: "https://imgur.com/Tf3bZPM.png",
    scrap_mechanical: "https://imgur.com/IrtN5aS.png",
    electronic_parts: "https://imgur.com/wTNk2Te.png",
    precision_component: "https://imgur.com/8684d59.png",
    circuitry: "https://imgur.com/FfDiki6.png",
    chemical: "https://imgur.com/MvbtE4u.png",
    textile: "https://imgur.com/4gr0EeJ.png",
    hide_leather: "https://imgur.com/nK6vQIR.png",
    ore_mineral: "https://imgur.com/Pwm1Idx.png",
    organic_material: "https://imgur.com/lqQbJds.png",
    plant_herb: "https://imgur.com/DucSfXD.png",
    bone_horn: "https://imgur.com/fUEV5vu.png",
    organ_gland: "https://imgur.com/rXlXbOG.png",
    toxin_material: "https://imgur.com/4kqV4TO.png",
    abnormality_part: "https://imgur.com/JpK4vSq.png",
    ammo: "https://imgur.com/gFEZebC.png",
    energy_cell: "https://imgur.com/32d4YwR.png",
    fuel: "https://imgur.com/mOsNK1L.png",
    repair_kit: "https://imgur.com/OZdAHys.png",
    medical_supply: "https://imgur.com/CrWqqZh.png",
    throwable: "https://imgur.com/3w2YnUX.png",
    tool: "https://imgur.com/rGCFKQD.png",
    craft_component: "https://imgur.com/exU9uZ1.png",
    key_access: "https://imgur.com/trjsYlm.png",
    document: "https://imgur.com/Mx8Vwn9.png",
    data_storage: "https://imgur.com/9vCVQL4.png",
    valuable: "https://imgur.com/XhS73M2.png",
    relic: "https://imgur.com/WfXrRoE.png",
    quest_item: "https://imgur.com/eLUFiXE.png",
    generic_item: "https://imgur.com/clIQfGj.png",
    weapon_melee: "https://imgur.com/3AEGrWu.png",
    weapon_ranged: "https://imgur.com/PWnWMq1.png",
    shield: "https://imgur.com/UnS3IAr.png",
    accessory: "https://imgur.com/G6YFWYw.png",
    armor_light: "https://imgur.com/yO2oNKD.png",
    armor_medium: "https://imgur.com/Yq7KrcC.png",
    armor_heavy: "https://imgur.com/Jqri9Tk.png"
  });

  const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function fallbackGroup(item = {}) {
    const category = normalize(item.category || item.tipo_categoria || item.itemType || item.type);
    const subtype = normalize(item.subtype || item.armorType || item.armor_type);
    if (["weapon", "weapon_chassis"].includes(category)) return normalize(item.rangeMode || item.range_mode) === "ranged" ? "weapon_ranged" : "weapon_melee";
    if (category === "shield") return "shield";
    if (["accessory", "accessory_chassis"].includes(category)) return "accessory";
    if (["armor", "armor_chassis"].includes(category)) {
      if (["heavy", "powered"].includes(subtype)) return "armor_heavy";
      if (["medium", "security", "hazard"].includes(subtype)) return "armor_medium";
      return "armor_light";
    }
    if (category === "ammo") return "ammo";
    if (["tool"].includes(category)) return "tool";
    if (["module", "upgrade"].includes(category)) return "precision_component";
    if (["food_drink"].includes(category)) return subtype === "drink" ? "drink" : "food_meat";
    return "generic_item";
  }

  function groupOf(item = {}) {
    const explicit = normalize(item.iconGroup || item.icon_group);
    return ICONS[explicit] ? explicit : fallbackGroup(item);
  }

  function resolve(item = {}) {
    const override = String(item.iconOverride || item.icon_override || item.icono || item.icon || item.image || item.img || "").trim();
    if (override) return override;
    return ICONS[groupOf(item)] || ICONS.generic_item;
  }

  function get(group) {
    return ICONS[normalize(group)] || null;
  }

  function has(group) {
    return Boolean(get(group));
  }

  function list() {
    return Object.entries(ICONS).map(([id, url]) => ({ id, url }));
  }

  const api = Object.freeze({ version: 1, icons: ICONS, get, has, list, groupOf, resolve, fallbackGroup });
  global.LuminousItemIconRegistry = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
