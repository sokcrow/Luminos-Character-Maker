(function (global) {
  "use strict";

  if (global.LuminousCulinaryAffinityCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCulinaryAffinityCatalog;
    return;
  }

  const VERSION = 1;

  function freezeDistribution(values) {
    const result = {};
    let total = 0;
    for (const [target, raw] of Object.entries(values || {})) {
      const value = Number(raw);
      if (!Number.isFinite(value) || value <= 0) continue;
      result[target] = value;
      total += value;
    }
    if (total !== 100) throw new Error(`Culinary affinity distribution must total 100, got ${total}.`);
    return Object.freeze(result);
  }

  const PROFILES = Object.freeze({
    fruit_balanced: freezeDistribution({ survival: 30, con_save: 25, nature: 25, perception: 20 }),
    fruit_citrus: freezeDistribution({ con_save: 30, perception: 30, medicine: 20, survival: 20 }),
    fruit_berry: freezeDistribution({ perception: 30, survival: 25, nature: 25, dex_save: 20 }),
    fruit_exotic: freezeDistribution({ arcana: 35, nature: 25, investigation: 20, con_save: 20 }),
    starch: freezeDistribution({ con_save: 35, survival: 30, athletics: 20, nature: 15 }),
    root: freezeDistribution({ survival: 30, con_save: 25, nature: 25, medicine: 20 }),
    leafy: freezeDistribution({ medicine: 30, nature: 30, con_save: 25, survival: 15 }),
    fresh_vegetable: freezeDistribution({ perception: 30, nature: 25, dex_save: 20, survival: 25 }),
    aromatic_vegetable: freezeDistribution({ investigation: 25, nature: 25, perception: 25, survival: 25 }),
    grain: freezeDistribution({ con_save: 35, survival: 25, nature: 20, athletics: 20 }),
    ferment_grain: freezeDistribution({ con_save: 30, history: 25, nature: 25, survival: 20 }),
    legume: freezeDistribution({ con_save: 35, athletics: 25, survival: 20, nature: 20 }),
    nut: freezeDistribution({ con_save: 30, athletics: 30, survival: 20, nature: 20 }),
    seed: freezeDistribution({ nature: 30, con_save: 25, survival: 25, perception: 20 }),
    spice_savory: freezeDistribution({ perception: 35, survival: 25, medicine: 20, con_save: 20 }),
    spice_hot: freezeDistribution({ con_save: 30, perception: 30, athletics: 20, survival: 20 }),
    spice_sweet: freezeDistribution({ perception: 30, history: 25, medicine: 20, con_save: 25 }),
    spice_medicinal: freezeDistribution({ medicine: 35, nature: 25, con_save: 20, investigation: 20 }),
    spice_rare: freezeDistribution({ arcana: 35, history: 25, investigation: 20, perception: 20 }),
    herb_fresh: freezeDistribution({ medicine: 30, nature: 30, perception: 25, survival: 15 }),
    herb_roast: freezeDistribution({ survival: 30, perception: 30, nature: 25, medicine: 15 }),
    herb_medicinal: freezeDistribution({ medicine: 40, nature: 25, wis_save: 20, survival: 15 }),
    toxic_herb: freezeDistribution({ con_save: 30, medicine: 25, nature: 25, investigation: 20 }),
    nightshade: freezeDistribution({ con_save: 30, arcana: 25, medicine: 25, nature: 20 }),
    fungus_common: freezeDistribution({ nature: 30, survival: 25, con_save: 25, investigation: 20 }),
    fungus_medicinal: freezeDistribution({ medicine: 35, nature: 30, con_save: 20, investigation: 15 }),
    fungus_toxic: freezeDistribution({ con_save: 35, nature: 25, medicine: 20, investigation: 20 }),
    fungus_ferment: freezeDistribution({ nature: 30, investigation: 30, history: 20, con_save: 20 }),
    fungus_exotic: freezeDistribution({ arcana: 35, nature: 25, investigation: 25, con_save: 15 }),
    extract_sap: freezeDistribution({ nature: 30, con_save: 25, survival: 25, medicine: 20 }),
    extract_resin: freezeDistribution({ investigation: 30, nature: 30, survival: 20, con_save: 20 }),
    extract_latex: freezeDistribution({ investigation: 30, nature: 25, con_save: 25, survival: 20 }),
    extract_exotic: freezeDistribution({ arcana: 35, investigation: 30, nature: 20, con_save: 15 }),

    humanoid_meat: freezeDistribution({ medicine: 30, investigation: 25, con_save: 25, survival: 20 }),
    predator_meat: freezeDistribution({ survival: 35, athletics: 25, perception: 20, con_save: 20 }),
    large_predator_meat: freezeDistribution({ athletics: 35, con_save: 25, survival: 25, perception: 15 }),
    game_meat: freezeDistribution({ survival: 35, perception: 25, con_save: 20, animal_handling: 20 }),
    livestock_meat: freezeDistribution({ con_save: 30, animal_handling: 25, survival: 25, athletics: 20 }),
    small_game_meat: freezeDistribution({ survival: 30, perception: 25, dex_save: 25, animal_handling: 20 }),
    feline_meat: freezeDistribution({ perception: 30, acrobatics: 25, survival: 25, stealth: 20 }),
    hyena_meat: freezeDistribution({ survival: 35, con_save: 25, perception: 20, athletics: 20 }),
    primate_meat: freezeDistribution({ investigation: 25, acrobatics: 25, survival: 25, con_save: 25 }),
    bat_meat: freezeDistribution({ perception: 35, dex_save: 25, survival: 20, stealth: 20 }),
    avian_meat: freezeDistribution({ perception: 30, dex_save: 25, acrobatics: 25, survival: 20 }),
    reptile_meat: freezeDistribution({ con_save: 30, survival: 30, stealth: 20, athletics: 20 }),
    serpentine_meat: freezeDistribution({ con_save: 30, stealth: 30, survival: 20, perception: 20 }),
    turtle_meat: freezeDistribution({ con_save: 40, survival: 25, athletics: 20, nature: 15 }),
    amphibian_meat: freezeDistribution({ con_save: 30, nature: 25, survival: 25, dex_save: 20 }),
    fish_meat: freezeDistribution({ survival: 30, perception: 25, dex_save: 25, con_save: 20 }),
    shark_meat: freezeDistribution({ athletics: 30, survival: 30, perception: 20, con_save: 20 }),
    cetacean_meat: freezeDistribution({ con_save: 30, perception: 25, survival: 25, animal_handling: 20 }),
    cephalopod_meat: freezeDistribution({ investigation: 30, dex_save: 25, stealth: 25, survival: 20 }),
    crustacean_meat: freezeDistribution({ con_save: 35, survival: 25, athletics: 20, nature: 20 }),
    arachnid_meat: freezeDistribution({ stealth: 30, con_save: 25, nature: 25, survival: 20 }),
    insect_meat: freezeDistribution({ survival: 30, nature: 30, dex_save: 20, con_save: 20 }),
    mollusk_meat: freezeDistribution({ con_save: 35, survival: 25, nature: 20, perception: 20 }),
    dinosaur_meat: freezeDistribution({ athletics: 35, survival: 30, con_save: 20, perception: 15 }),
    draconic_meat: freezeDistribution({ arcana: 30, con_save: 25, athletics: 25, int_save: 20 }),
    exotic_humanoid_meat: freezeDistribution({ arcana: 25, medicine: 25, investigation: 25, con_save: 25 }),
  });

  const PROFILE_BY_ITEM = Object.freeze({
    apple: "fruit_balanced",
    pear: "fruit_balanced",
    orange: "fruit_citrus",
    lemon: "fruit_citrus",
    blackberry: "fruit_berry",
    strawberry: "fruit_berry",
    grape: "fruit_balanced",
    peach: "fruit_balanced",
    cherry: "fruit_berry",
    melon: "fruit_balanced",
    banana: "starch",
    dragon_fruit: "fruit_exotic",
    pineapple: "fruit_citrus",
    plum: "fruit_balanced",
    juniper_berry: "fruit_berry",
    coconut: "nut",
    mango: "fruit_balanced",
    lime: "fruit_citrus",
    kiwi: "fruit_balanced",
    pomegranate: "fruit_balanced",
    watermelon: "fruit_balanced",
    blueberry: "fruit_berry",
    raspberry: "fruit_berry",
    red_berry: "fruit_berry",

    potato: "starch",
    carrot: "root",
    onion: "aromatic_vegetable",
    tomato: "fruit_citrus",
    cabbage: "leafy",
    lettuce: "fresh_vegetable",
    spinach: "leafy",
    broccoli: "leafy",
    pumpkin: "starch",
    beet: "root",
    radish: "root",
    celery: "aromatic_vegetable",
    cucumber: "fresh_vegetable",
    bamboo_shoot: "fresh_vegetable",
    sweet_potato: "starch",
    eggplant: "fresh_vegetable",

    wheat: "grain",
    rice: "grain",
    corn: "grain",
    oats: "grain",
    barley: "ferment_grain",
    rye: "grain",
    beans: "legume",
    lentils: "legume",
    peas: "legume",
    soybean: "legume",

    almond: "nut",
    walnut: "nut",
    peanut: "nut",
    sunflower_seed: "seed",
    sesame_seed: "seed",
    exotic_seed: "fruit_exotic",
    pecan: "nut",
    chestnut: "nut",
    pine_nut: "nut",
    cacao: "seed",
    coffee_bean: "seed",

    garlic: "spice_savory",
    ginger: "spice_medicinal",
    black_pepper: "spice_savory",
    chili_pepper: "spice_hot",
    paprika: "spice_savory",
    cinnamon: "spice_sweet",
    clove: "spice_medicinal",
    nutmeg: "spice_sweet",
    turmeric: "spice_medicinal",
    rare_spice: "spice_rare",

    basil: "herb_fresh",
    mint: "herb_fresh",
    rosemary: "herb_roast",
    thyme: "herb_roast",
    sage: "herb_medicinal",
    parsley: "herb_fresh",
    chives: "herb_fresh",
    tea_leaf: "herb_fresh",

    medicinal_herb: "herb_medicinal",
    bitterroot: "herb_medicinal",
    feverleaf: "herb_medicinal",
    bloodleaf: "herb_medicinal",
    calming_herb: "herb_medicinal",
    toxic_herb: "toxic_herb",
    nightshade: "nightshade",
    exotic_medicinal_herb: "spice_rare",

    common_mushroom: "fungus_common",
    forest_mushroom: "fungus_common",
    frost_mushroom: "fungus_common",
    wetland_mushroom: "fungus_common",
    desert_truffle: "fungus_exotic",
    medicinal_mushroom: "fungus_medicinal",
    toxic_mushroom: "fungus_toxic",
    truffle: "fungus_exotic",

    sap: "extract_sap",
    resin: "extract_resin",
    plant_latex: "extract_latex",
    exotic_botanical_extract: "extract_exotic",

    meat_humanoid: "humanoid_meat",
    meat_wolf: "predator_meat",
    meat_canid: "predator_meat",
    meat_lupine: "predator_meat",
    meat_bear: "large_predator_meat",
    meat_boar: "game_meat",
    meat_venison: "game_meat",
    meat_bovine: "livestock_meat",
    meat_caprine: "livestock_meat",
    meat_ovine: "livestock_meat",
    meat_equine: "livestock_meat",
    meat_camelid: "livestock_meat",
    meat_elephant: "large_predator_meat",
    meat_rabbit: "small_game_meat",
    meat_rodent: "small_game_meat",
    meat_mustelid: "predator_meat",
    meat_feline: "feline_meat",
    meat_hyena: "hyena_meat",
    meat_primate: "primate_meat",
    meat_bat: "bat_meat",
    meat_avian: "avian_meat",
    meat_crocodilian: "reptile_meat",
    meat_lizard: "reptile_meat",
    meat_reptilian: "reptile_meat",
    meat_snake: "serpentine_meat",
    meat_serpentine: "serpentine_meat",
    meat_turtle: "turtle_meat",
    meat_amphibian: "amphibian_meat",
    meat_fish: "fish_meat",
    meat_shark: "shark_meat",
    meat_cetacean: "cetacean_meat",
    meat_cephalopod: "cephalopod_meat",
    meat_crustacean: "crustacean_meat",
    meat_arachnid: "arachnid_meat",
    meat_insect: "insect_meat",
    meat_mollusk: "mollusk_meat",
    meat_dinosaur: "dinosaur_meat",
    meat_draconic: "draconic_meat",
    meat_exotic_humanoid: "exotic_humanoid_meat",
  });

  const ALIASES = Object.freeze({
    berry: "blackberry",
    exotic_fruit: "dragon_fruit",
    cave_mushroom: "wetland_mushroom",
    fermentation_fungus: "common_mushroom",
    exotic_fungus: "truffle",
  });

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function canonicalItemId(itemId) {
    const key = String(itemId || "").trim();
    return ALIASES[key] || key;
  }

  function get(itemId) {
    const profileId = PROFILE_BY_ITEM[canonicalItemId(itemId)];
    const distribution = profileId ? PROFILES[profileId] : null;
    return distribution ? clone(distribution) : null;
  }

  function profileIdFor(itemId) {
    return PROFILE_BY_ITEM[canonicalItemId(itemId)] || null;
  }

  function listItemIds() {
    return Object.keys(PROFILE_BY_ITEM);
  }

  const API = Object.freeze({
    VERSION,
    PROFILES,
    PROFILE_BY_ITEM,
    ALIASES,
    canonicalItemId,
    get,
    profileIdFor,
    listItemIds,
  });

  global.LuminousCulinaryAffinityCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
