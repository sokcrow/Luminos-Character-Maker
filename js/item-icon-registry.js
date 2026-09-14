(function (global) {
  "use strict";

  if (global.LuminousItemIconRegistry) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemIconRegistry;
    return;
  }

  const VERSION = 10;
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
    food: family("food", "Prepared Food", "Comida preparada", "consumable", "https://imgur.com/uFmUpuD.png"),
    ration: family("ration", "Ration", "Ración", "consumable", "https://imgur.com/6yDrI9e.png"),
    drink: family("drink", "Drink", "Bebida", "consumable", "https://imgur.com/Tf3bZPM.png"),
    throwable: family("throwable", "Throwable", "Arrojable", "consumable", "https://imgur.com/3w2YnUX.png"),
    medical_supply: family("medical_supply", "Medical Supply", "Suministro médico", "consumable", "https://imgur.com/CrWqqZh.png"),
    repair_kit: family("repair_kit", "Repair Kit", "Kit de reparación", "utility", "https://imgur.com/OZdAHys.png"),

    meat_mammal: family("meat_mammal", "Mammal Meat", "Carne de mamífero", "material", "https://imgur.com/GQAGWzK.png"),
    meat_bird: family("meat_bird", "Bird Meat", "Carne de ave", "material", "https://imgur.com/4Y6KfFh.png"),
    meat_fish: family("meat_fish", "Fish / Soft Aquatic Meat", "Carne de pescado / acuática blanda", "material", "https://imgur.com/KZ6Y7LQ.png"),
    meat_shellfish: family("meat_shellfish", "Shellfish / Hard Aquatic Meat", "Carne de marisco / acuática dura", "material", "https://imgur.com/cUkw6rB.png"),
    meat_reptile: family("meat_reptile", "Reptile Meat", "Carne de reptil", "material", "https://imgur.com/LZ3maix.png"),
    meat_draconic: family("meat_draconic", "Draconic Meat", "Carne dracónica", "material", "https://imgur.com/QJZhEJC.png"),
    meat_insectoid: family("meat_insectoid", "Insectoid Meat", "Carne insectoide", "material", "https://imgur.com/bZoLZeb.png"),

    scrap_mechanical: family("scrap_mechanical", "Scrap / Mechanical Parts", "Chatarra / Partes mecánicas", "material", "https://imgur.com/IrtN5aS.png"),
    electronic_parts: family("electronic_parts", "Electronic Parts", "Partes electrónicas", "material", "https://imgur.com/wTNk2Te.png"),
    precision_component: family("precision_component", "Precision Components / Modules", "Componentes de precisión / Módulos", "material", "https://imgur.com/8684d59.png"),
    circuitry: family("circuitry", "Circuit / Electronics", "Circuitos / Electrónica", "material", "https://imgur.com/FfDiki6.png"),
    chemical: family("chemical", "Chemical", "Químico", "material", "https://imgur.com/MvbtE4u.png"),
    textile: family("textile", "Textile", "Textil", "material", "https://imgur.com/4gr0EeJ.png"),
    hide_mammal: family("hide_mammal", "Mammal / Humanoid Hide", "Piel de mamífero / humanoide", "material", "https://imgur.com/nK6vQIR.png"),
    pelt_fur: family("pelt_fur", "Fur Pelt", "Pelaje / Piel con pelo", "material", "https://imgur.com/12IQYXa.png"),
    hide_reptile: family("hide_reptile", "Reptile / Skin Hide", "Piel reptiliana / piel", "material", "https://imgur.com/llKa6G5.png"),
    hide_draconic: family("hide_draconic", "Draconic Hide", "Piel dracónica", "material", "https://imgur.com/F1YNegu.png"),
    hard_bone: family("hard_bone", "Bone / Beak", "Hueso / Pico", "material", "https://imgur.com/HrqeZ0a.png"),
    hard_claw: family("hard_claw", "Claw / Fang / Talon", "Garra / Colmillo / Talón", "material", "https://imgur.com/gjLEUIT.png"),
    hard_horn: family("hard_horn", "Horn / Antler / Tusk / Ivory", "Cuerno / Asta / Colmillo / Marfil", "material", "https://imgur.com/H1kn8fD.png"),
    scale_reptile: family("scale_reptile", "Scale / Scute", "Escama / Escudo dérmico", "material", "https://imgur.com/cJz55WQ.png"),
    shell_carapace: family("shell_carapace", "Shell / Carapace", "Concha / Caparazón", "material", "https://imgur.com/TgCPNLU.png"),
    chitin_plate: family("chitin_plate", "Chitin / Exoskeleton Plate", "Quitina / Placa de exoesqueleto", "material", "https://imgur.com/0785C1C.png"),
    feather_raw: family("feather_raw", "Feather / Down", "Pluma / Plumón", "material", "https://imgur.com/EPkBtW0.png"),
    animal_fiber_raw: family("animal_fiber_raw", "Raw Animal Fiber", "Fibra animal cruda", "material", "https://imgur.com/A3FpNXr.png"),
    silk_raw: family("silk_raw", "Raw Silk / Exotic Fiber", "Seda cruda / Fibra exótica", "material", "https://imgur.com/NYnkd17.png"),
    ore_mineral: family("ore_mineral", "Ore / Mineral", "Mena / Mineral", "material", "https://imgur.com/Pwm1Idx.png"),
    organic_material: family("organic_material", "Organic Material", "Material orgánico", "material", "https://imgur.com/lqQbJds.png"),
    plant_herb: family("plant_herb", "Plant / Herb", "Planta / Hierba", "material", "https://imgur.com/DucSfXD.png"),
    organ_internal: family("organ_internal", "Internal Organ", "Órgano interno", "material", "https://imgur.com/rXlXbOG.png"),
    organ_sensory: family("organ_sensory", "Sensory Organ", "Órgano sensorial", "material", "https://imgur.com/tPLOEZe.png"),
    organ_brain: family("organ_brain", "Brain", "Cerebro", "material", "https://imgur.com/9MdgTfI.png"),
    organ_gland: family("organ_gland", "Gland / Sac", "Glándula / Saco", "material", "https://imgur.com/4kqV4TO.png"),
    blood: family("blood", "Blood", "Sangre", "material", "https://imgur.com/7a75QU2.png"),
    hemolymph: family("hemolymph", "Hemolymph", "Hemolinfa", "material", "https://imgur.com/Kwwd6A7.png"),
    ichor: family("ichor", "Ichor / Exotic Fluid", "Icor / Fluido exótico", "material", "https://imgur.com/KHKQKjb.png"),
    venom_raw: family("venom_raw", "Venom / Toxic Secretion", "Veneno / Secreción tóxica", "material", "https://imgur.com/8dBvLD5.png"),
    acid_secretion: family("acid_secretion", "Acid Secretion", "Secreción ácida", "material", "https://imgur.com/akDUWvj.png"),
    ink_secretion: family("ink_secretion", "Ink Secretion", "Secreción de tinta", "material", "https://imgur.com/pcc7tsi.png"),
    bio_secretion: family("bio_secretion", "Biological Secretion", "Secreción biológica", "material", "https://imgur.com/YzrMRpI.png"),
    ooze_gel: family("ooze_gel", "Ooze / Gel / Slime", "Baba / Gel / Slime", "material", "https://imgur.com/91cMoMg.png"),
    essence_raw: family("essence_raw", "Raw Essence", "Esencia cruda", "material", "https://imgur.com/Yay5U5o.png"),
    energy_core: family("energy_core", "Mana / Energy Core", "Núcleo de maná / energía", "material", "https://imgur.com/KBSJN7y.png"),
    toxin_material: family("toxin_material", "Creature Toxin Material", "Material tóxico de criatura", "material", "https://imgur.com/8dBvLD5.png"),
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
    food_meat: "food",
    prepared_food: "food",
    meat: "meat_mammal",
    mammal_meat: "meat_mammal",
    bird_meat: "meat_bird",
    fish_meat: "meat_fish",
    shellfish_meat: "meat_shellfish",
    reptile_meat: "meat_reptile",
    draconic_meat: "meat_draconic",
    insectoid_meat: "meat_insectoid",
    scrap: "scrap_mechanical",
    mechanical_parts: "scrap_mechanical",
    electronics: "electronic_parts",
    precision_components: "precision_component",
    circuit_electronics: "circuitry",
    hide_leather: "hide_mammal",
    hide: "hide_mammal",
    leather: "hide_mammal",
    mammal_hide: "hide_mammal",
    fur_pelt: "pelt_fur",
    pelt: "pelt_fur",
    reptile_hide: "hide_reptile",
    draconic_hide: "hide_draconic",
    bone_horn: "hard_bone",
    bone: "hard_bone",
    beak: "hard_bone",
    claw: "hard_claw",
    talon: "hard_claw",
    fang: "hard_claw",
    horn: "hard_horn",
    antler: "hard_horn",
    tusk: "hard_horn",
    ivory: "hard_horn",
    scale: "scale_reptile",
    scales: "scale_reptile",
    scute: "scale_reptile",
    shell: "shell_carapace",
    carapace: "shell_carapace",
    chitin: "chitin_plate",
    exoskeleton_plate: "chitin_plate",
    feather: "feather_raw",
    feathers: "feather_raw",
    flight_feather: "feather_raw",
    down: "feather_raw",
    wool: "animal_fiber_raw",
    animal_hair: "animal_fiber_raw",
    raw_fiber: "animal_fiber_raw",
    silk: "silk_raw",
    raw_silk: "silk_raw",
    exotic_raw_fiber: "silk_raw",
    ore: "ore_mineral",
    mineral: "ore_mineral",
    plant: "plant_herb",
    herb: "plant_herb",
    organ: "organ_internal",
    internal_organ: "organ_internal",
    heart: "organ_internal",
    liver: "organ_internal",
    kidney: "organ_internal",
    lung: "organ_internal",
    stomach: "organ_internal",
    digestive_organ: "organ_internal",
    sensory_organ: "organ_sensory",
    eye: "organ_sensory",
    brain: "organ_brain",
    gland: "organ_gland",
    sac: "organ_gland",
    bladder: "organ_gland",
    blood: "blood",
    humanoid_blood: "blood",
    draconic_blood: "blood",
    hemolymph: "hemolymph",
    ichor: "ichor",
    exotic_blood: "ichor",
    exotic_fluid: "ichor",
    exotic_blood_fluid: "ichor",
    venom: "venom_raw",
    raw_venom: "venom_raw",
    toxic_secretion: "venom_raw",
    acid: "acid_secretion",
    ink: "ink_secretion",
    pheromone: "bio_secretion",
    scent: "bio_secretion",
    pheromone_scent: "bio_secretion",
    defensive_secretion: "bio_secretion",
    exotic_secretion: "bio_secretion",
    ooze: "ooze_gel",
    slime: "ooze_gel",
    mucus: "ooze_gel",
    gel: "ooze_gel",
    adhesive_ooze: "ooze_gel",
    regenerative_gel: "ooze_gel",
    conductive_gel: "ooze_gel",
    exotic_ooze: "ooze_gel",
    essence: "essence_raw",
    arcane_essence: "essence_raw",
    elemental_essence: "essence_raw",
    spirit_essence: "essence_raw",
    psionic_essence: "essence_raw",
    necrotic_essence: "essence_raw",
    radiant_essence: "essence_raw",
    mana_core: "energy_core",
    mana_energy_core: "energy_core",
    core: "energy_core",
    exotic_core: "energy_core",
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
