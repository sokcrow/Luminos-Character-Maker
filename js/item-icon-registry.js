(function (global) {
  "use strict";

  const GROUPS = Object.freeze({
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
    armor_heavy: "https://imgur.com/Jqri9Tk.png",
  });

  const normalize = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  function inferGroup(item = {}) {
    const explicit = normalize(item.iconGroup || item.icon_group);
    if (explicit && GROUPS[explicit]) return explicit;

    const category = normalize(item.category || item.tipo_categoria || item.itemType || item.type);
    const subtype = normalize(item.subtype || item.subType || item.armorType || item.weaponType);
    const rawTags = Array.isArray(item.tags) ? item.tags.join(" ") : String(item.tags || item.tag || "");
    const haystack = `${category} ${subtype} ${rawTags}`.toLowerCase();

    if (category === "weapon") {
      if (/ranged|firearm|pistol|revolver|rifle|shotgun|smg|machinegun|bow|crossbow|launcher/.test(haystack)) return "weapon_ranged";
      return "weapon_melee";
    }
    if (category === "armor") {
      if (/heavy/.test(haystack)) return "armor_heavy";
      if (/light/.test(haystack)) return "armor_light";
      return "armor_medium";
    }
    if (category === "shield") return "shield";
    if (category === "accessory") return "accessory";
    if (category === "ammo" || category === "ammunition") return "ammo";
    if (category === "tool") return "tool";
    if (category === "consumable") return "consumable_other";
    return "generic_item";
  }

  function resolveGroup(item = {}) {
    return inferGroup(item);
  }

  function resolveIcon(item = {}) {
    const override = String(item.iconOverride || item.icon_override || item.icono || item.icon || "").trim();
    if (override) return override;
    return GROUPS[resolveGroup(item)] || GROUPS.generic_item;
  }

  const api = Object.freeze({
    version: 1,
    groups: GROUPS,
    has(groupId) {
      return Boolean(GROUPS[normalize(groupId)]);
    },
    get(groupId) {
      return GROUPS[normalize(groupId)] || null;
    },
    resolveGroup,
    resolveIcon,
    list() {
      return Object.entries(GROUPS).map(([id, url]) => ({ id, url }));
    },
  });

  global.LuminousItemIconRegistry = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
