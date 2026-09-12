(function (global) {
  "use strict";

  if (global.LuminousItemIconRegistry) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemIconRegistry;
    return;
  }

  const VERSION = 1;
  const DEFAULT_GROUP = "generic_item";

  function family(id, label, labelEs, domain, icon) {
    return Object.freeze({ id, label, labelEs, domain, icon });
  }

  const GROUPS = Object.freeze({
    healing_hp: family("healing_hp", "HP Healing", "Curación HP", "consumable", "https://imgur.com/GcnX53v.png"),
    healing_sp: family("healing_sp", "SP Healing", "Curación SP", "consumable", "https://imgur.com/LCpKGIH.png"),
    healing_hybrid: family("healing_hybrid", "Hybrid Healing", "Curación híbrida", "consumable", "https://imgur.com/DrIZie0.png"),
    status_cure: family("status_cure", "Cure / Antidote", "Cura / Antídoto", "consumable", "https://imgur.com/17tJuSM.png"),
    buff_consumable: family("buff_consumable", "Buff Consumable", "Consumible de mejora", "consumable", "https://imgur.com/9wGle81.png"),
    poison_consumable: family("poison_consumable", "Poison / Venom / Toxic", "Veneno / Tóxico", "consumable", "https://imgur.com/VsWisJQ.png"),
    consumable_other: family("consumable_other", "Other Consumable", "Otro consumible", "consumable", "https://imgur.com/1RZqDFI.png"),
    food_meat: family("food_meat", "Food / Meat", "Comida / Carne", "consumable", "https://imgur.com/uFmUpuD.png"),
    ration: family("ration", "Ration", "Ración", "consumable", "https://imgur.com/6yDrI9e.png"),
    drink: family("drink", "Drink", "Bebida", "consumable", "https://imgur.com/Tf3bZPM.png"),
    throwable: family("throwable", "Throwable", "Arrojable", "consumable", "https://imgur.com/3w2YnUX.png"),
    medical_supply: family("medical_supply", "Medical Supply", "Suministro médico", "consumable", "https://imgur.com/CrWqqZh.png"),
    repair_kit: family("repair_kit", "Repair Kit", "Kit de reparación", "utility", "https://imgur.com/OZdAHys.png"),

    scrap_mechanical: family("scrap_mechanical", "Scrap / Mechanical Parts", "Chatarra / Partes mecánicas", "material", "https://imgur.com/IrtN5aS.png"),
    electronic_parts: family("electronic_parts", "Electronic Parts", "Partes electrónicas", "material", "https://imgur.com/wTNk2Te.png"),
    precision_component: family("precision_component", "Precision Components / Modules", "Componentes de precisión / Módulos", "material", "https://imgur.com/8684d59.png"),
    circuitry: family("circuitry", "Circuit / Electronics", "Circuitos / Electrónica", "material", "https://imgur.com/FfDiki6.png"),
    chemical: family("chemical", "Chemical", "Químico", "material", "https://imgur.com/MvbtE4u.png"),
    textile: family("textile", "Textile", "Textil", "material", "https://imgur.com/4gr0EeJ.png"),
    hide_leather: family("hide_leather", "Hide / Leather", "Piel / Cuero", "material", "https://imgur.com/nK6vQIR.png"),
    ore_mineral: family("ore_mineral", "Ore / Mineral", "Mena / Mineral", "material", "https://imgur.com/Pwm1Idx.png"),
    organic_material: family("organic_material", "Organic Material", "Material orgánico", "material", "https://imgur.com/lqQbJds.png"),
    plant_herb: family("plant_herb", "Plant / Herb", "Planta / Hierba", "material", "https://imgur.com/DucSfXD.png"),
    bone_horn: family("bone_horn", "Bone / Horn", "Hueso / Cuerno", "material", "https://imgur.com/fUEV5vu.png"),
    organ_gland: family("organ_gland", "Organ / Gland", "Órgano / Glándula", "material", "https://imgur.com/rXlXbOG.png"),
    toxin_material: family("toxin_material", "Creature Toxin Material", "Material tóxico de criatura", "material", "https://imgur.com/4kqV4TO.png"),
    abnormality_part: family("abnormality_part", "Abnormality Part", "Parte de anormalidad", "material", "https://imgur.com/JpK4vSq.png"),
    craft_component: family("craft_component", "Generic Crafting Component", "Componente genérico de fabricación", "material", "https://imgur.com/exU9uZ1.png"),

    ammo: family("ammo", "Ammo", "Munición", "resource", "https://imgur.com/gFEZebC.png"),
    energy_cell: family("energy_cell", "Energy Cell", "Celda de energía", "resource", "https://imgur.com/32d4YwR.png"),
    fuel: family("fuel", "Fuel", "Combustible", "resource", "https://imgur.com/mOsNK1L.png"),

    tool: family("tool", "Tool", "Herramienta", "utility", "https://imgur.com/rGCFKQD.png"),
    key_access: family("key_access", "Key / Access", "Llave / Acceso", "utility", "https://imgur.com/trjsYlm.png"),
    document: family("document", "Document", "Documento", "utility", "https://imgur.com/Mx8Vwn9.png"),
    data_storage: family("data_storage", "Data / Digital Storage", "Datos / Almacenamiento digital", "utility", "https://imgur.com/9vCVQL4.png"),
    valuable: family("valuable", "Valuable", "Objeto de valor", "utility", "https://imgur.com/XhS73M2.png"),
    relic: family("relic", "Relic", "Reliquia", "utility", "https://imgur.com/WfXrRoE.png"),
    quest_item: family("quest_item", "Quest Item", "Objeto de misión", "utility", "https://imgur.com/eLUFiXE.png"),
    generic_item: family("generic_item", "Container / Generic Item", "Contenedor / Objeto genérico", "fallback", "https://imgur.com/clIQfGj.png"),

    weapon_melee: family("weapon_melee", "Melee Weapon", "Arma cuerpo a cuerpo", "equipment", "https://imgur.com/3AEGrWu.png"),
    weapon_ranged: family("weapon_ranged", "Ranged Weapon", "Arma a distancia", "equipment", "https://imgur.com/PWnWMq1.png"),
    shield: family("shield", "Shield", "Escudo", "equipment", "https://imgur.com/UnS3IAr.png"),
    accessory: family("accessory", "Accessory", "Accesorio", "equipment", "https://imgur.com/G6YFWYw.png"),
    armor_light: family("armor_light", "Light Armor", "Armadura ligera", "equipment", "https://imgur.com/yO2oNKD.png"),
    armor_medium: family("armor_medium", "Medium Armor", "Armadura media", "equipment", "https://imgur.com/Yq7KrcC.png"),
    armor_heavy: family("armor_heavy", "Heavy Armor", "Armadura pesada", "equipment", "https://imgur.com/Jqri9Tk.png"),
  });

  const ALIASES = Object.freeze({
    hp_healing: "healing_hp",
    sp_healing: "healing_sp",
    hybrid_healing: "healing_hybrid",
    cure_antidote: "status_cure",
    poison_venom_toxic: "poison_consumable",
    food: "food_meat",
    meat: "food_meat",
    scrap: "scrap_mechanical",
    mechanical_parts: "scrap_mechanical",
    electronics: "electronic_parts",
    precision_components: "precision_component",
    circuit_electronics: "circuitry",
    hide: "hide_leather",
    leather: "hide_leather",
    ore: "ore_mineral",
    mineral: "ore_mineral",
    plant: "plant_herb",
    herb: "plant_herb",
    bone: "bone_horn",
    horn: "bone_horn",
    organ: "organ_gland",
    gland: "organ_gland",
    generic_crafting: "craft_component",
    data: "data_storage",
    container: "generic_item",
    melee_weapon: "weapon_melee",
    ranged_weapon: "weapon_ranged",
    light_armor: "armor_light",
    medium_armor: "armor_medium",
    heavy_armor: "armor_heavy",
  });

  function normalizeGroupId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function canonicalGroupId(value) {
    const normalized = normalizeGroupId(value);
    return ALIASES[normalized] || normalized;
  }

  function has(groupId) {
    return Object.prototype.hasOwnProperty.call(GROUPS, canonicalGroupId(groupId));
  }

  function get(groupId, options = {}) {
    const id = canonicalGroupId(groupId);
    if (GROUPS[id]) return GROUPS[id];
    return options.fallback === false ? null : GROUPS[DEFAULT_GROUP];
  }

  function resolveIcon(groupId, options = {}) {
    const override = String(options.iconOverride ?? "").trim();
    if (override) return override;
    return get(groupId, options)?.icon || null;
  }

  function list(options = {}) {
    const domain = normalizeGroupId(options.domain);
    const groups = Object.values(GROUPS);
    return domain ? groups.filter((entry) => entry.domain === domain) : groups.slice();
  }

  const API = Object.freeze({
    VERSION,
    DEFAULT_GROUP,
    GROUPS,
    ALIASES,
    normalizeGroupId,
    canonicalGroupId,
    has,
    get,
    list,
    resolveIcon,
  });

  global.LuminousItemIconRegistry = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
