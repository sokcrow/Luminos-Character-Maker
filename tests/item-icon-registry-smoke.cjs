const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  delete globalThis.LuminousItemIconRegistry;
  await import(pathToFileURL(path.resolve(__dirname, '../js/item-icon-registry.js')).href);
  const registry = globalThis.LuminousItemIconRegistry;

  assert.ok(registry);
  assert.equal(registry.VERSION, 35);
  assert.equal(registry.DEFAULT_GROUP, 'generic_item');
  assert.equal(Object.keys(registry.GROUPS).length, 589);

  const groups = registry.list();
  assert.equal(new Set(groups.map((entry) => entry.id)).size, groups.length);
  for (const entry of groups) {
    assert.equal(typeof entry.label, 'string');
    assert.equal(typeof entry.labelEs, 'string');
    assert.match(entry.icon, /^Assets\/Icons\/items\/[a-z0-9_-]+\/[a-z0-9_-]+\.png$/);
  }

  const legacyCritical = [
    'healing_hp', 'food', 'meat_mammal', 'hide_mammal', 'hard_bone', 'scale_reptile',
    'feather_raw', 'organ_internal', 'blood', 'venom_raw', 'ooze_gel', 'essence_raw',
    'energy_core', 'fruit_raw', 'vegetable_raw', 'grain_seed_raw', 'spice_herb_raw',
    'medicinal_herb_raw', 'fungus_raw', 'botanical_extract_raw', 'ore_raw', 'metal_ingot',
    'gem_rough', 'gem_cut', 'structural_stock', 'fasteners_hardware', 'wire_cable',
    'glass_component', 'container', 'tool', 'repair_kit', 'weapon_melee', 'weapon_ranged'
  ];
  for (const id of legacyCritical) assert.equal(registry.has(id), true, id);

  const culinaryIcons = {
    animal_milk: 'Assets/Icons/items/material/animal_milk.png',
    animal_egg: 'Assets/Icons/items/material/animal_egg.png',
    animal_honey: 'Assets/Icons/items/material/animal_honey.png',
    culinary_water: 'Assets/Icons/items/material/culinary_water.png',
    culinary_seasoning: 'Assets/Icons/items/material/culinary_seasoning.png',
    culinary_sweetener: 'Assets/Icons/items/material/culinary_sweetener.png',
    culinary_flour: 'Assets/Icons/items/material/culinary_flour.png',
    culinary_dough: 'Assets/Icons/items/material/culinary_dough.png',
    culinary_dairy: 'Assets/Icons/items/material/culinary_dairy.png',
    culinary_oil: 'Assets/Icons/items/material/culinary_oil.png',
    culinary_stock: 'Assets/Icons/items/material/culinary_stock.png',
    culinary_sauce: 'Assets/Icons/items/material/culinary_sauce.png',
    culinary_culture: 'Assets/Icons/items/material/culinary_culture.png',
    food_bread: 'Assets/Icons/items/consumable/food_bread.png',
    food_meal: 'Assets/Icons/items/consumable/food_meal.png',
    food_soup: 'Assets/Icons/items/consumable/food_soup.png',
    food_stew: 'Assets/Icons/items/consumable/food_stew.png',
    food_fried: 'Assets/Icons/items/consumable/food_fried.png',
    food_baked: 'Assets/Icons/items/consumable/food_baked.png',
    food_dessert: 'Assets/Icons/items/consumable/food_dessert.png',
    food_snack: 'Assets/Icons/items/consumable/food_snack.png',
    ration_field: 'Assets/Icons/items/consumable/ration_field.png',
    ration_preserved: 'Assets/Icons/items/consumable/ration_preserved.png',
    ration_canned: 'Assets/Icons/items/consumable/ration_canned.png',
    ration_emergency: 'Assets/Icons/items/consumable/ration_emergency.png',
    drink_water: 'Assets/Icons/items/consumable/drink_water.png',
    drink_juice: 'Assets/Icons/items/consumable/drink_juice.png',
    drink_hot: 'Assets/Icons/items/consumable/drink_hot.png',
    drink_can: 'Assets/Icons/items/consumable/drink_can.png',
    drink_beer: 'Assets/Icons/items/consumable/drink_beer.png',
    drink_wine: 'Assets/Icons/items/consumable/drink_wine.png',
    drink_spirit: 'Assets/Icons/items/consumable/drink_spirit.png',
    drink_cocktail: 'Assets/Icons/items/consumable/drink_cocktail.png'
  };
  for (const [id, icon] of Object.entries(culinaryIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }

  const preparedBakeryIcons = {
    white_bread:'Assets/Icons/items/consumable/white_bread.png',
    rustic_bread:'Assets/Icons/items/consumable/rustic_bread.png',
    flatbread:'Assets/Icons/items/consumable/flatbread.png',
    focaccia:'Assets/Icons/items/consumable/focaccia.png',
    dinner_rolls:'Assets/Icons/items/consumable/dinner_rolls.png',
    baguette:'Assets/Icons/items/consumable/baguette.png',
    pretzel:'Assets/Icons/items/consumable/pretzel.png',
    pancakes:'Assets/Icons/items/consumable/pancakes.png',
    waffles:'Assets/Icons/items/consumable/waffles.png',
    crepes:'Assets/Icons/items/consumable/crepes.png',
    apple_pie:'Assets/Icons/items/consumable/apple_pie.png',
    pear_pie:'Assets/Icons/items/consumable/pear_pie.png',
    blackberry_pie:'Assets/Icons/items/consumable/blackberry_pie.png',
    strawberry_pie:'Assets/Icons/items/consumable/strawberry_pie.png',
    blueberry_pie:'Assets/Icons/items/consumable/blueberry_pie.png',
    raspberry_pie:'Assets/Icons/items/consumable/raspberry_pie.png',
    red_berry_pie:'Assets/Icons/items/consumable/red_berry_pie.png',
    peach_pie:'Assets/Icons/items/consumable/peach_pie.png',
    cherry_pie:'Assets/Icons/items/consumable/cherry_pie.png',
    plum_pie:'Assets/Icons/items/consumable/plum_pie.png',
    banana_cream_pie:'Assets/Icons/items/consumable/banana_cream_pie.png',
    pineapple_pie:'Assets/Icons/items/consumable/pineapple_pie.png',
    coconut_cream_pie:'Assets/Icons/items/consumable/coconut_cream_pie.png',
    mango_pie:'Assets/Icons/items/consumable/mango_pie.png',
    lemon_pie:'Assets/Icons/items/consumable/lemon_pie.png',
    lime_pie:'Assets/Icons/items/consumable/lime_pie.png',
    orange_tart:'Assets/Icons/items/consumable/orange_tart.png',
    kiwi_tart:'Assets/Icons/items/consumable/kiwi_tart.png',
    dragon_fruit_tart:'Assets/Icons/items/consumable/dragon_fruit_tart.png',
    pomegranate_tart:'Assets/Icons/items/consumable/pomegranate_tart.png',
    cake:'Assets/Icons/items/consumable/cake.png',
    fruit_cake:'Assets/Icons/items/consumable/fruit_cake.png',
    apple_cake:'Assets/Icons/items/consumable/apple_cake.png',
    strawberry_cake:'Assets/Icons/items/consumable/strawberry_cake.png',
    blueberry_cake:'Assets/Icons/items/consumable/blueberry_cake.png',
    raspberry_cake:'Assets/Icons/items/consumable/raspberry_cake.png',
    banana_cake:'Assets/Icons/items/consumable/banana_cake.png',
    peach_cake:'Assets/Icons/items/consumable/peach_cake.png',
    pineapple_cake:'Assets/Icons/items/consumable/pineapple_cake.png',
    blackberry_cake:'Assets/Icons/items/consumable/blackberry_cake.png',
    cherry_cake:'Assets/Icons/items/consumable/cherry_cake.png',
    coconut_cake:'Assets/Icons/items/consumable/coconut_cake.png',
    mango_cake:'Assets/Icons/items/consumable/mango_cake.png',
    lemon_cake:'Assets/Icons/items/consumable/lemon_cake.png',
    orange_cake:'Assets/Icons/items/consumable/orange_cake.png',
    chocolate_cake:'Assets/Icons/items/consumable/chocolate_cake.png',
    coffee_cake:'Assets/Icons/items/consumable/coffee_cake.png',
    carrot_cake:'Assets/Icons/items/consumable/carrot_cake.png',
    pumpkin_cake:'Assets/Icons/items/consumable/pumpkin_cake.png',
    honey_cake:'Assets/Icons/items/consumable/honey_cake.png',
    chestnut_cake:'Assets/Icons/items/consumable/chestnut_cake.png'
  };
  for (const [id, icon] of Object.entries(preparedBakeryIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'consumable');
  }

  const cookieIcons = {
    butter_cookie:'Assets/Icons/items/consumable/butter_cookie.png',
    sugar_cookie:'Assets/Icons/items/consumable/sugar_cookie.png',
    chocolate_chip_cookie:'Assets/Icons/items/consumable/chocolate_chip_cookie.png',
    chocolate_cookie:'Assets/Icons/items/consumable/chocolate_cookie.png',
    oatmeal_cookie:'Assets/Icons/items/consumable/oatmeal_cookie.png',
    ginger_cookie:'Assets/Icons/items/consumable/ginger_cookie.png',
    shortbread_cookie:'Assets/Icons/items/consumable/shortbread_cookie.png',
    almond_cookie:'Assets/Icons/items/consumable/almond_cookie.png',
    coconut_cookie:'Assets/Icons/items/consumable/coconut_cookie.png',
    jam_cookie:'Assets/Icons/items/consumable/jam_cookie.png',
    honey_cookie:'Assets/Icons/items/consumable/honey_cookie.png',
    coffee_cookie:'Assets/Icons/items/consumable/coffee_cookie.png',
    butter_cookie_retail_pack:'Assets/Icons/items/consumable/butter_cookie_retail_pack.png',
    sugar_cookie_retail_pack:'Assets/Icons/items/consumable/sugar_cookie_retail_pack.png',
    chocolate_chip_cookie_retail_pack:'Assets/Icons/items/consumable/chocolate_chip_cookie_retail_pack.png',
    chocolate_cookie_retail_pack:'Assets/Icons/items/consumable/chocolate_cookie_retail_pack.png',
    oatmeal_cookie_retail_pack:'Assets/Icons/items/consumable/oatmeal_cookie_retail_pack.png',
    ginger_cookie_retail_pack:'Assets/Icons/items/consumable/ginger_cookie_retail_pack.png',
    shortbread_cookie_retail_pack:'Assets/Icons/items/consumable/shortbread_cookie_retail_pack.png',
    almond_cookie_retail_pack:'Assets/Icons/items/consumable/almond_cookie_retail_pack.png',
    coconut_cookie_retail_pack:'Assets/Icons/items/consumable/coconut_cookie_retail_pack.png',
    jam_cookie_retail_pack:'Assets/Icons/items/consumable/jam_cookie_retail_pack.png',
    honey_cookie_retail_pack:'Assets/Icons/items/consumable/honey_cookie_retail_pack.png',
    coffee_cookie_retail_pack:'Assets/Icons/items/consumable/coffee_cookie_retail_pack.png'
  };
  for (const [id, icon] of Object.entries(cookieIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'consumable');
  }

  const muffinIcons = {
    muffin:'Assets/Icons/items/consumable/muffin.png',
    blueberry_muffin:'Assets/Icons/items/consumable/blueberry_muffin.png',
    chocolate_muffin:'Assets/Icons/items/consumable/chocolate_muffin.png',
    banana_muffin:'Assets/Icons/items/consumable/banana_muffin.png',
    apple_muffin:'Assets/Icons/items/consumable/apple_muffin.png',
    strawberry_muffin:'Assets/Icons/items/consumable/strawberry_muffin.png',
    lemon_muffin:'Assets/Icons/items/consumable/lemon_muffin.png',
    coconut_muffin:'Assets/Icons/items/consumable/coconut_muffin.png'
  };
  for (const [id, icon] of Object.entries(muffinIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'consumable');
  }

  const fruitIcons = {
    apple:'Assets/Icons/items/material/apple.png',
    pear:'Assets/Icons/items/material/pear.png',
    orange:'Assets/Icons/items/material/orange.png',
    lemon:'Assets/Icons/items/material/lemon.png',
    blackberry:'Assets/Icons/items/material/blackberry.png',
    strawberry:'Assets/Icons/items/material/strawberry.png',
    grape:'Assets/Icons/items/material/grape.png',
    peach:'Assets/Icons/items/material/peach.png',
    cherry:'Assets/Icons/items/material/cherry.png',
    melon:'Assets/Icons/items/material/melon.png',
    banana:'Assets/Icons/items/material/banana.png',
    dragon_fruit:'Assets/Icons/items/material/dragon_fruit.png',
    pineapple:'Assets/Icons/items/material/pineapple.png',
    plum:'Assets/Icons/items/material/plum.png',
    juniper_berry:'Assets/Icons/items/material/juniper_berry.png',
    coconut:'Assets/Icons/items/material/coconut.png',
    mango:'Assets/Icons/items/material/mango.png',
    lime:'Assets/Icons/items/material/lime.png',
    kiwi:'Assets/Icons/items/material/kiwi.png',
    pomegranate:'Assets/Icons/items/material/pomegranate.png',
    watermelon:'Assets/Icons/items/material/watermelon.png',
    blueberry:'Assets/Icons/items/material/blueberry.png',
    raspberry:'Assets/Icons/items/material/raspberry.png',
    red_berry:'Assets/Icons/items/material/red_berry.png'
  };
  for (const [id, icon] of Object.entries(fruitIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'material');
  }

  const rawProduceIcons = {
    potato:'Assets/Icons/items/material/potato.png',
    carrot:'Assets/Icons/items/material/carrot.png',
    onion:'Assets/Icons/items/material/onion.png',
    tomato:'Assets/Icons/items/material/tomato.png',
    cabbage:'Assets/Icons/items/material/cabbage.png',
    lettuce:'Assets/Icons/items/material/lettuce.png',
    spinach:'Assets/Icons/items/material/spinach.png',
    broccoli:'Assets/Icons/items/material/broccoli.png',
    pumpkin:'Assets/Icons/items/material/pumpkin.png',
    beet:'Assets/Icons/items/material/beet.png',
    radish:'Assets/Icons/items/material/radish.png',
    celery:'Assets/Icons/items/material/celery.png',
    cucumber:'Assets/Icons/items/material/cucumber.png',
    bamboo_shoot:'Assets/Icons/items/material/bamboo_shoot.png',
    sweet_potato:'Assets/Icons/items/material/sweet_potato.png',
    eggplant:'Assets/Icons/items/material/eggplant.png',
    wheat:'Assets/Icons/items/material/wheat.png',
    rice:'Assets/Icons/items/material/rice.png',
    corn:'Assets/Icons/items/material/corn.png',
    oats:'Assets/Icons/items/material/wheat.png',
    barley:'Assets/Icons/items/material/barley.png',
    rye:'Assets/Icons/items/material/rye.png',
    beans:'Assets/Icons/items/material/beans.png',
    lentils:'Assets/Icons/items/material/lentils.png',
    peas:'Assets/Icons/items/material/peas.png',
    soybean:'Assets/Icons/items/material/soybean.png',
    almond:'Assets/Icons/items/material/almond.png',
    walnut:'Assets/Icons/items/material/walnut.png',
    peanut:'Assets/Icons/items/material/peanut.png',
    sunflower_seed:'Assets/Icons/items/material/sunflower_seed.png',
    sesame_seed:'Assets/Icons/items/material/sesame_seed.png',
    exotic_seed:'Assets/Icons/items/material/exotic_seed.png',
    pecan:'Assets/Icons/items/material/pecan.png',
    chestnut:'Assets/Icons/items/material/chestnut.png',
    pine_nut:'Assets/Icons/items/material/pine_nut.png',
    cacao:'Assets/Icons/items/material/cacao.png',
    coffee_bean:'Assets/Icons/items/material/coffee_bean.png',
    garlic:'Assets/Icons/items/material/garlic.png',
    ginger:'Assets/Icons/items/material/ginger.png',
    black_pepper:'Assets/Icons/items/material/black_pepper.png',
    chili_pepper:'Assets/Icons/items/material/chili_pepper.png',
    paprika:'Assets/Icons/items/material/paprika.png',
    cinnamon:'Assets/Icons/items/material/cinnamon.png',
    clove:'Assets/Icons/items/material/clove.png',
    nutmeg:'Assets/Icons/items/material/nutmeg.png',
    turmeric:'Assets/Icons/items/material/turmeric.png',
    rare_spice:'Assets/Icons/items/material/rare_spice.png',
    basil:'Assets/Icons/items/material/basil.png',
    mint:'Assets/Icons/items/material/mint.png',
    rosemary:'Assets/Icons/items/material/rosemary.png',
    thyme:'Assets/Icons/items/material/thyme.png',
    sage:'Assets/Icons/items/material/sage.png',
    parsley:'Assets/Icons/items/material/parsley.png',
    chives:'Assets/Icons/items/material/chives.png',
    tea_leaf:'Assets/Icons/items/material/tea_leaf.png',
    medicinal_herb:'Assets/Icons/items/material/medicinal_herb.png',
    bitterroot:'Assets/Icons/items/material/bitterroot.png',
    feverleaf:'Assets/Icons/items/material/feverleaf.png',
    bloodleaf:'Assets/Icons/items/material/bloodleaf.png',
    calming_herb:'Assets/Icons/items/material/calming_herb.png',
    toxic_herb:'Assets/Icons/items/material/toxic_herb.png',
    nightshade:'Assets/Icons/items/material/nightshade.png',
    exotic_medicinal_herb:'Assets/Icons/items/material/exotic_medicinal_herb.png'
  };
  for (const [id, icon] of Object.entries(rawProduceIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'material');
  }

  const currentRawFoodIcons = {
    common_mushroom:'Assets/Icons/items/material/common_mushroom.png',
    forest_mushroom:'Assets/Icons/items/material/forest_mushroom.png',
    frost_mushroom:'Assets/Icons/items/material/frost_mushroom.png',
    wetland_mushroom:'Assets/Icons/items/material/wetland_mushroom.png',
    desert_truffle:'Assets/Icons/items/material/desert_truffle.png',
    medicinal_mushroom:'Assets/Icons/items/material/medicinal_mushroom.png',
    toxic_mushroom:'Assets/Icons/items/material/toxic_mushroom.png',
    truffle:'Assets/Icons/items/material/truffle.png',
    sap:'Assets/Icons/items/material/sap.png',
    resin:'Assets/Icons/items/material/resin.png',
    plant_latex:'Assets/Icons/items/material/plant_latex.png',
    exotic_botanical_extract:'Assets/Icons/items/material/exotic_botanical_extract.png',
    egg:'Assets/Icons/items/material/egg.png',
    milk:'Assets/Icons/items/material/milk.png',
    seaweed:'Assets/Icons/items/material/seaweed.png',
    avocado:'Assets/Icons/items/material/avocado.png',
    honey:'Assets/Icons/items/material/honey.png',
    sugar_cane:'Assets/Icons/items/material/sugar_cane.png',
    water:'Assets/Icons/items/material/water.png',
    salt:'Assets/Icons/items/material/salt.png',
    yeast:'Assets/Icons/items/material/yeast.png',
    beeswax:'Assets/Icons/items/material/beeswax.png',
    gelatin:'Assets/Icons/items/material/gelatin.png',
    jellyfish:'Assets/Icons/items/material/jellyfish.png',
    recycled_protein:'Assets/Icons/items/material/recycled_protein.png'
  };
  for (const [id, icon] of Object.entries(currentRawFoodIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'material');
  }
  assert.equal(registry.canonicalGroupId('cave_mushroom'), 'wetland_mushroom');
  assert.equal(registry.canonicalGroupId('fermentation_fungus'), 'yeast');
  assert.equal(registry.canonicalGroupId('exotic_fungus'), 'truffle');



  const throwableIcons = {
    fragmentation_throwable:'Assets/Icons/items/consumable/fragmentation_throwable.png',
    incendiary_throwable:'Assets/Icons/items/consumable/incendiary_throwable.png',
    cryogenic_throwable:'Assets/Icons/items/consumable/cryogenic_throwable.png',
    shock_throwable:'Assets/Icons/items/consumable/shock_throwable.png',
    concussive_throwable:'Assets/Icons/items/consumable/concussive_throwable.png',
    smoke_throwable:'Assets/Icons/items/consumable/smoke_throwable.png',
    flash_throwable:'Assets/Icons/items/consumable/flash_throwable.png',
    marking_throwable:'Assets/Icons/items/consumable/marking_throwable.png',
    corrosive_throwable:'Assets/Icons/items/consumable/corrosive_throwable.png',
    toxic_throwable:'Assets/Icons/items/consumable/toxic_throwable.png',
    grenade_shell:'Assets/Icons/items/material/grenade_shell.png',
    fragmentation_filler:'Assets/Icons/items/material/fragmentation_filler.png',
    concussive_charge:'Assets/Icons/items/material/concussive_charge.png',
    cryogenic_reagent:'Assets/Icons/items/material/cryogenic_reagent.png',
    cryogenic_solution:'Assets/Icons/items/material/cryogenic_reagent.png',
    shock_charge:'Assets/Icons/items/material/shock_charge.png'
  };
  for (const [id, icon] of Object.entries(throwableIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }


  const rawMineralIcons = {
    mineral_industrial_stone:'Assets/Icons/items/material/mineral_industrial_stone.png',
    mineral_clay:'Assets/Icons/items/material/mineral_clay.png',
    mineral_coal:'Assets/Icons/items/material/mineral_coal.png',
    ore_lead:'Assets/Icons/items/material/ore_lead.png',
    ore_iron:'Assets/Icons/items/material/ore_iron.png',
    ore_bauxite:'Assets/Icons/items/material/ore_bauxite.png',
    ore_zinc:'Assets/Icons/items/material/ore_zinc.png',
    ore_tin:'Assets/Icons/items/material/ore_tin.png',
    ore_copper:'Assets/Icons/items/material/ore_copper.png',
    mineral_graphite:'Assets/Icons/items/material/mineral_graphite.png',
    ore_manganese:'Assets/Icons/items/material/ore_manganese.png',
    mineral_obsidian:'Assets/Icons/items/material/mineral_obsidian.png',
    mineral_quartz:'Assets/Icons/items/material/mineral_quartz.png',
    ore_nickel:'Assets/Icons/items/material/ore_nickel.png',
    ore_chromium:'Assets/Icons/items/material/ore_chromium.png',
    ore_lithium:'Assets/Icons/items/material/ore_lithium.png',
    ore_molybdenum:'Assets/Icons/items/material/ore_lithium.png',
    ore_vanadium:'Assets/Icons/items/material/ore_vanadium.png',
    ore_cobalt:'Assets/Icons/items/material/ore_cobalt.png',
    ore_silver:'Assets/Icons/items/material/ore_silver.png',
    ore_tungsten:'Assets/Icons/items/material/ore_tungsten.png',
    ore_titanium:'Assets/Icons/items/material/ore_titanium.png',
    ore_gold:'Assets/Icons/items/material/ore_gold.png',
    ore_niobium:'Assets/Icons/items/material/ore_niobium.png',
    ore_tantalum:'Assets/Icons/items/material/ore_tantalum.png',
    mineral_rare_earth:'Assets/Icons/items/material/mineral_rare_earth.png',
    ore_uranium:'Assets/Icons/items/material/ore_uranium.png',
    mineral_superconductive:'Assets/Icons/items/material/mineral_superconductive.png',
    ore_metamaterial:'Assets/Icons/items/material/ore_metamaterial.png',
    mineral_null_dampening:'Assets/Icons/items/material/mineral_null_dampening.png',
    mineral_exotic_industrial:'Assets/Icons/items/material/mineral_exotic_industrial.png',
    ore_platinum:'Assets/Icons/items/material/ore_platinum.png'
  };
  for (const [id, icon] of Object.entries(rawMineralIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'material');
  }


  const refinedMetalIcons = {
    ingot_lead:'Assets/Icons/items/material/ingot_lead.png',
    ingot_iron:'Assets/Icons/items/material/ingot_iron.png',
    ingot_aluminum:'Assets/Icons/items/material/ingot_aluminum.png',
    ingot_zinc:'Assets/Icons/items/material/ingot_zinc.png',
    ingot_tin:'Assets/Icons/items/material/ingot_tin.png',
    ingot_copper:'Assets/Icons/items/material/ingot_copper.png',
    ingot_manganese:'Assets/Icons/items/material/ingot_manganese.png',
    ingot_nickel:'Assets/Icons/items/material/ingot_nickel.png',
    ingot_chromium:'Assets/Icons/items/material/ingot_chromium.png',
    ingot_lithium:'Assets/Icons/items/material/ingot_lithium.png',
    ingot_molybdenum:'Assets/Icons/items/material/ingot_molybdenum.png',
    ingot_vanadium:'Assets/Icons/items/material/ingot_vanadium.png',
    ingot_cobalt:'Assets/Icons/items/material/ingot_cobalt.png',
    ingot_silver:'Assets/Icons/items/material/ingot_silver.png',
    ingot_tungsten:'Assets/Icons/items/material/ingot_tungsten.png',
    ingot_titanium:'Assets/Icons/items/material/ingot_titanium.png',
    ingot_gold:'Assets/Icons/items/material/ingot_gold.png',
    ingot_niobium:'Assets/Icons/items/material/ingot_niobium.png',
    ingot_tantalum:'Assets/Icons/items/material/ingot_tantalum.png',
    ingot_platinum:'Assets/Icons/items/material/ingot_silver.png',
    material_rare_earth_refined:'Assets/Icons/items/material/material_rare_earth_refined.png',
    material_uranium_refined:'Assets/Icons/items/material/material_uranium_refined.png',
    material_superconductive:'Assets/Icons/items/material/material_superconductive.png',
    material_metamaterial_refined:'Assets/Icons/items/material/material_metamaterial_refined.png',
    material_null_dampening:'Assets/Icons/items/material/material_null_dampening.png',
    material_exotic_refined:'Assets/Icons/items/material/material_exotic_refined.png'
  };
  for (const [id, icon] of Object.entries(refinedMetalIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'material');
  }


  const gemstoneIcons = {
    gem_ruby_rough:'Assets/Icons/items/material/gem_ruby_rough.png',
    gem_sapphire_rough:'Assets/Icons/items/material/gem_sapphire_rough.png',
    gem_aquamarine_rough:'Assets/Icons/items/material/gem_aquamarine_rough.png',
    gem_topaz_rough:'Assets/Icons/items/material/gem_topaz_rough.png',
    gem_garnet_rough:'Assets/Icons/items/material/gem_garnet_rough.png',
    gem_emerald_rough:'Assets/Icons/items/material/gem_emerald_rough.png',
    gem_amethyst_rough:'Assets/Icons/items/material/gem_amethyst_rough.png',
    gem_onyx_rough:'Assets/Icons/items/material/gem_onyx_rough.png',
    gem_moonstone_rough:'Assets/Icons/items/material/gem_moonstone_rough.png',
    gem_opal_rough:'Assets/Icons/items/material/gem_opal_rough.png',
    gem_diamond_rough:'Assets/Icons/items/material/gem_diamond_rough.png',
    gem_starstone_rough:'Assets/Icons/items/material/gem_starstone_rough.png',
    gem_ruby_cut:'Assets/Icons/items/material/gem_ruby_cut.png',
    gem_sapphire_cut:'Assets/Icons/items/material/gem_sapphire_cut.png',
    gem_aquamarine_cut:'Assets/Icons/items/material/gem_aquamarine_cut.png',
    gem_topaz_cut:'Assets/Icons/items/material/gem_topaz_cut.png',
    gem_garnet_cut:'Assets/Icons/items/material/gem_garnet_cut.png',
    gem_emerald_cut:'Assets/Icons/items/material/gem_emerald_cut.png',
    gem_amethyst_cut:'Assets/Icons/items/material/gem_amethyst_cut.png',
    gem_onyx_cut:'Assets/Icons/items/material/gem_onyx_cut.png',
    gem_moonstone_cut:'Assets/Icons/items/material/gem_moonstone_cut.png',
    gem_opal_cut:'Assets/Icons/items/material/gem_opal_cut.png',
    gem_diamond_cut:'Assets/Icons/items/material/gem_diamond_cut.png',
    gem_starstone_cut:'Assets/Icons/items/material/gem_starstone_cut.png'
  };
  for (const [id, icon] of Object.entries(gemstoneIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'material');
  }


  const jewelryValuableIcons = {
    jewelry_ring_gold:'Assets/Icons/items/equipment/jewelry_ring_gold.png',
    jewelry_ring_silver:'Assets/Icons/items/equipment/jewelry_ring_silver.png',
    jewelry_ring_copper:'Assets/Icons/items/equipment/jewelry_ring_copper.png',
    jewelry_ring_metal:'Assets/Icons/items/equipment/jewelry_ring_metal.png',
    jewelry_earrings_gold:'Assets/Icons/items/equipment/jewelry_earrings_gold.png',
    jewelry_earrings_silver:'Assets/Icons/items/equipment/jewelry_earrings_silver.png',
    jewelry_earrings_copper:'Assets/Icons/items/equipment/jewelry_earrings_copper.png',
    jewelry_earrings_metal:'Assets/Icons/items/equipment/jewelry_earrings_metal.png',
    jewelry_pendant_gold:'Assets/Icons/items/equipment/jewelry_pendant_gold.png',
    jewelry_pendant_silver:'Assets/Icons/items/equipment/jewelry_pendant_silver.png',
    jewelry_pendant_copper:'Assets/Icons/items/equipment/jewelry_pendant_copper.png',
    jewelry_pendant_metal:'Assets/Icons/items/equipment/jewelry_pendant_metal.png',
    jewelry_necklace_gold:'Assets/Icons/items/equipment/jewelry_necklace_gold.png',
    jewelry_necklace_silver:'Assets/Icons/items/equipment/jewelry_necklace_silver.png',
    jewelry_necklace_copper:'Assets/Icons/items/equipment/jewelry_necklace_copper.png',
    jewelry_necklace_metal:'Assets/Icons/items/equipment/jewelry_necklace_metal.png',
    jewelry_bracelet_gold:'Assets/Icons/items/equipment/jewelry_bracelet_gold.png',
    jewelry_bracelet_silver:'Assets/Icons/items/equipment/jewelry_bracelet_silver.png',
    jewelry_bracelet_copper:'Assets/Icons/items/equipment/jewelry_bracelet_copper.png',
    jewelry_bracelet_metal:'Assets/Icons/items/equipment/jewelry_bracelet_metal.png',
    jewelry_anklet_gold:'Assets/Icons/items/equipment/jewelry_anklet_gold.png',
    jewelry_anklet_silver:'Assets/Icons/items/equipment/jewelry_anklet_silver.png',
    jewelry_anklet_copper:'Assets/Icons/items/equipment/jewelry_anklet_copper.png',
    jewelry_anklet_metal:'Assets/Icons/items/equipment/jewelry_anklet_metal.png',
    jewelry_brooch_gold:'Assets/Icons/items/equipment/jewelry_brooch_gold.png',
    jewelry_brooch_silver:'Assets/Icons/items/equipment/jewelry_brooch_silver.png',
    jewelry_brooch_copper:'Assets/Icons/items/equipment/jewelry_brooch_copper.png',
    jewelry_brooch_metal:'Assets/Icons/items/equipment/jewelry_brooch_metal.png',
    jewelry_hairpin_gold:'Assets/Icons/items/equipment/jewelry_hairpin_gold.png',
    jewelry_hairpin_silver:'Assets/Icons/items/equipment/jewelry_hairpin_silver.png',
    jewelry_hairpin_copper:'Assets/Icons/items/equipment/jewelry_hairpin_copper.png',
    jewelry_hairpin_metal:'Assets/Icons/items/equipment/jewelry_hairpin_metal.png',
    valuable_goblet_gold:'Assets/Icons/items/utility/valuable_goblet_gold.png',
    valuable_goblet_gems:'Assets/Icons/items/utility/valuable_goblet_gems.png',
    valuable_chalice_gold:'Assets/Icons/items/utility/valuable_chalice_gold.png',
    valuable_chalice_gems:'Assets/Icons/items/utility/valuable_chalice_gems.png',
    valuable_box_gold:'Assets/Icons/items/utility/valuable_box_gold.png',
    valuable_box_gems:'Assets/Icons/items/utility/valuable_box_gems.png',
    valuable_statuette_gold:'Assets/Icons/items/utility/valuable_statuette_gold.png',
    valuable_statuette_gems:'Assets/Icons/items/utility/valuable_statuette_gems.png',
    valuable_mask_gold:'Assets/Icons/items/utility/valuable_mask_gold.png',
    valuable_mask_gems:'Assets/Icons/items/utility/valuable_mask_gems.png',
    valuable_plate_gold:'Assets/Icons/items/utility/valuable_plate_gold.png',
    valuable_plate_gems:'Assets/Icons/items/utility/valuable_plate_gems.png',
    valuable_reliquary_gold:'Assets/Icons/items/utility/valuable_reliquary_gold.png',
    valuable_reliquary_gems:'Assets/Icons/items/utility/valuable_reliquary_gems.png',
    valuable_scepter_gold:'Assets/Icons/items/utility/valuable_scepter_gold.png',
    valuable_scepter_gems:'Assets/Icons/items/utility/valuable_scepter_gems.png',
  };
  for (const [id, icon] of Object.entries(jewelryValuableIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }

  const medicalIcons = {
    herb_healing: 'Assets/Icons/items/material/herb_healing.png',
    herb_calming: 'Assets/Icons/items/material/herb_calming.png',
    herb_antidote: 'Assets/Icons/items/material/herb_antidote.png',
    herb_stimulant: 'Assets/Icons/items/material/herb_stimulant.png',
    herb_toxic: 'Assets/Icons/items/material/herb_toxic.png',
    fungus_medicinal: 'Assets/Icons/items/material/fungus_medicinal.png',
    fungus_toxic: 'Assets/Icons/items/material/fungus_toxic.png',
    pharma_reagent: 'Assets/Icons/items/material/pharma_reagent.png',
    antiseptic_reagent: 'Assets/Icons/items/material/antiseptic_reagent.png',
    electrolyte_reagent: 'Assets/Icons/items/material/electrolyte_reagent.png',
    medical_solvent: 'Assets/Icons/items/material/medical_solvent.png',
    medical_buffer: 'Assets/Icons/items/material/medical_buffer.png',
    medical_polymer: 'Assets/Icons/items/material/medical_polymer.png',
    chemical_toxin: 'Assets/Icons/items/material/chemical_toxin.png',
    bio_reagent: 'Assets/Icons/items/material/bio_reagent.png',
    regenerative_reagent: 'Assets/Icons/items/material/regenerative_reagent.png',
    medicinal_extract: 'Assets/Icons/items/material/medicinal_extract.png',
    medicinal_concentrate: 'Assets/Icons/items/material/medicinal_concentrate.png',
    sterile_solution: 'Assets/Icons/items/material/sterile_solution.png',
    antiseptic_solution: 'Assets/Icons/items/material/antiseptic_solution.png',
    antitoxin_base: 'Assets/Icons/items/material/antitoxin_base.png',
    pharmaceutical_powder: 'Assets/Icons/items/material/pharmaceutical_powder.png',
    medical_gel_base: 'Assets/Icons/items/material/medical_gel_base.png',
    ointment_base: 'Assets/Icons/items/material/ointment_base.png',
    stabilized_reagent: 'Assets/Icons/items/material/stabilized_reagent.png',
    toxin_extract: 'Assets/Icons/items/material/toxin_extract.png',
    medicine_tablet: 'Assets/Icons/items/consumable/medicine_tablet.png',
    medicine_capsule: 'Assets/Icons/items/consumable/medicine_capsule.png',
    medicine_ampoule: 'Assets/Icons/items/consumable/medicine_ampoule.png',
    medicine_vial: 'Assets/Icons/items/consumable/medicine_vial.png',
    medicine_inhaler: 'Assets/Icons/items/consumable/medicine_inhaler.png',
    medicine_patch: 'Assets/Icons/items/consumable/medicine_patch.png',
    medicine_topical: 'Assets/Icons/items/consumable/medicine_topical.png',
    medicine_dressing: 'Assets/Icons/items/consumable/medicine_dressing.png',
    medicine_kit: 'Assets/Icons/items/consumable/medicine_kit.png',
    antidote_ampoule: 'Assets/Icons/items/consumable/antidote_ampoule.png',
    antidote_tablet: 'Assets/Icons/items/consumable/antidote_tablet.png',
    antidote_vial: 'Assets/Icons/items/consumable/antidote_vial.png',
    antidote_inhaler: 'Assets/Icons/items/consumable/antidote_inhaler.png',
    poison_vial: 'Assets/Icons/items/consumable/poison_vial.png',
    poison_capsule: 'Assets/Icons/items/consumable/poison_capsule.png',
    poison_coating: 'Assets/Icons/items/consumable/poison_coating.png',
    toxic_aerosol: 'Assets/Icons/items/consumable/toxic_aerosol.png',
    toxic_ampoule: 'Assets/Icons/items/consumable/toxic_ampoule.png'
  };
  for (const [id, icon] of Object.entries(medicalIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }


  const chemistryIcons = {
    industrial_solvent:'Assets/Icons/items/material/industrial_solvent.png',
    industrial_lubricant:'Assets/Icons/items/material/industrial_lubricant.png',
    industrial_resin:'Assets/Icons/items/material/industrial_resin.png',
    industrial_polymer:'Assets/Icons/items/material/industrial_polymer.png',
    industrial_adhesive:'Assets/Icons/items/material/industrial_adhesive.png',
    industrial_pigment:'Assets/Icons/items/material/industrial_pigment.png',
    chemical_catalyst:'Assets/Icons/items/material/chemical_catalyst.png',
    chemical_stabilizer:'Assets/Icons/items/material/chemical_stabilizer.png',
    chemical_reactive:'Assets/Icons/items/material/chemical_reactive.png',
    chemical_corrosive:'Assets/Icons/items/material/chemical_corrosive.png',
    chemical_conductive:'Assets/Icons/items/material/chemical_conductive.png',
    chemical_insulator:'Assets/Icons/items/material/chemical_insulator.png',
    environmental_absorbent:'Assets/Icons/items/material/environmental_absorbent.png',
    environmental_neutralizer:'Assets/Icons/items/material/environmental_neutralizer.png',
    environmental_filter_media:'Assets/Icons/items/material/environmental_filter_media.png',
    water_treatment_reagent:'Assets/Icons/items/material/water_treatment_reagent.png',
    cleaning_compound:'Assets/Icons/items/material/cleaning_compound.png',
    sealant_compound:'Assets/Icons/items/material/sealant_compound.png',
    lubricant_compound:'Assets/Icons/items/material/lubricant_compound.png',
    polymer_compound:'Assets/Icons/items/material/polymer_compound.png',
    adhesive_compound:'Assets/Icons/items/material/adhesive_compound.png',
    pigment_compound:'Assets/Icons/items/material/pigment_compound.png',
    reactive_compound:'Assets/Icons/items/material/reactive_compound.png',
    corrosive_solution:'Assets/Icons/items/material/corrosive_solution.png',
    neutralizing_solution:'Assets/Icons/items/material/neutralizing_solution.png',
    decontamination_solution:'Assets/Icons/items/material/decontamination_solution.png',
    stabilized_compound:'Assets/Icons/items/material/stabilized_compound.png',
    treatment_solution:'Assets/Icons/items/material/treatment_solution.png',
    industrial_cleaner:'Assets/Icons/items/utility/industrial_cleaner.png',
    industrial_sealant:'Assets/Icons/items/utility/industrial_sealant.png',
    industrial_lubricant_pack:'Assets/Icons/items/utility/industrial_lubricant_pack.png',
    industrial_coating:'Assets/Icons/items/utility/industrial_coating.png',
    repair_adhesive:'Assets/Icons/items/utility/repair_adhesive.png',
    chemical_cartridge:'Assets/Icons/items/utility/chemical_cartridge.png',
    chemical_canister:'Assets/Icons/items/utility/chemical_canister.png',
    reactive_canister:'Assets/Icons/items/utility/reactive_canister.png',
    corrosive_canister:'Assets/Icons/items/utility/corrosive_canister.png',
    maintenance_kit:'Assets/Icons/items/utility/maintenance_kit.png',
    water_purifier:'Assets/Icons/items/utility/water_purifier.png',
    filter_cartridge:'Assets/Icons/items/utility/filter_cartridge.png',
    spill_absorbent_kit:'Assets/Icons/items/utility/spill_absorbent_kit.png',
    decontamination_spray:'Assets/Icons/items/utility/decontamination_spray.png',
    neutralizer_spray:'Assets/Icons/items/utility/neutralizer_spray.png',
    containment_foam:'Assets/Icons/items/utility/containment_foam.png',
    hazard_bag:'Assets/Icons/items/utility/hazard_bag.png',
    environmental_kit:'Assets/Icons/items/utility/environmental_kit.png'
  };
  for (const [id, icon] of Object.entries(chemistryIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
  }

  const weaponIcons = {
    weapon_sword: 'Assets/Icons/items/equipment/weapon_melee.png',
    weapon_dagger: 'Assets/Icons/items/equipment/weapon_dagger.png',
    weapon_polearm: 'Assets/Icons/items/equipment/weapon_polearm.png',
    weapon_hammer: 'Assets/Icons/items/equipment/weapon_hammer.png',
    weapon_firearm_shotgun: 'Assets/Icons/items/equipment/weapon_firearm_shotgun.png',
    weapon_sling: 'Assets/Icons/items/equipment/weapon_sling.png',
    weapon_firearm_pistol: 'Assets/Icons/items/equipment/weapon_firearm_pistol.png',
    weapon_net: 'Assets/Icons/items/equipment/weapon_net.png',
    weapon_firearm_revolver: 'Assets/Icons/items/equipment/weapon_firearm_revolver.png',
    weapon_firearm_smg: 'Assets/Icons/items/equipment/weapon_firearm_smg.png',
    weapon_spear: 'Assets/Icons/items/equipment/weapon_spear.png',
    weapon_crossbow: 'Assets/Icons/items/equipment/weapon_crossbow.png',
    weapon_pick: 'Assets/Icons/items/equipment/weapon_pick.png',
    weapon_whip: 'Assets/Icons/items/equipment/weapon_whip.png',
    weapon_blunt: 'Assets/Icons/items/equipment/weapon_blunt.png',
    weapon_blowgun: 'Assets/Icons/items/equipment/weapon_blowgun.png',
    weapon_firearm_rifle: 'Assets/Icons/items/equipment/weapon_firearm_rifle.png',
    weapon_staff: 'Assets/Icons/items/equipment/weapon_staff.png',
    weapon_axe: 'Assets/Icons/items/equipment/weapon_axe.png',
    weapon_bow: 'Assets/Icons/items/equipment/weapon_ranged.png'
  };
  for (const [id, icon] of Object.entries(weaponIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'equipment');
  }

  const equipmentIds = registry.list({ domain: 'equipment' }).map((entry) => entry.id);
  assert.equal(equipmentIds.length, 63);
  assert.deepEqual(equipmentIds.slice(0, 22), [
    'weapon_melee', 'weapon_ranged',
    'weapon_sword', 'weapon_dagger', 'weapon_polearm', 'weapon_hammer',
    'weapon_firearm_shotgun', 'weapon_sling', 'weapon_firearm_pistol', 'weapon_net',
    'weapon_firearm_revolver', 'weapon_firearm_smg', 'weapon_spear', 'weapon_crossbow',
    'weapon_pick', 'weapon_whip', 'weapon_blunt', 'weapon_blowgun', 'weapon_firearm_rifle',
    'weapon_staff', 'weapon_axe', 'weapon_bow'
  ]);
  for (const id of [
    'shield','shield_buckler','shield_round','shield_heater','shield_tower','accessory',
    'jewelry_ring_gold','jewelry_ring_silver','jewelry_ring_copper','jewelry_ring_metal',
    'jewelry_earrings_gold','jewelry_pendant_gold','jewelry_necklace_gold','jewelry_bracelet_gold',
    'jewelry_anklet_gold','jewelry_brooch_gold','jewelry_hairpin_gold',
    'armor_light','armor_medium','armor_heavy'
  ]) assert.equal(equipmentIds.includes(id), true, id);

  const shieldIcons = {
    shield_buckler: 'Assets/Icons/items/equipment/shield_buckler.png',
    shield_round: 'Assets/Icons/items/equipment/shield_round.png',
    shield_heater: 'Assets/Icons/items/equipment/shield_heater.png',
    shield_tower: 'Assets/Icons/items/equipment/shield_tower.png'
  };
  for (const [id, icon] of Object.entries(shieldIcons)) {
    assert.equal(registry.has(id), true, id);
    assert.equal(registry.resolveIcon(id), icon, id);
    assert.equal(registry.get(id).domain, 'equipment');
  }
  assert.equal(registry.canonicalGroupId('buckler'), 'shield_buckler');
  assert.equal(registry.canonicalGroupId('round_shield'), 'shield_round');
  assert.equal(registry.canonicalGroupId('heater_shield'), 'shield_heater');
  assert.equal(registry.canonicalGroupId('tower_shield'), 'shield_tower');

  const weaponAliasExpectations = {
    sword: 'weapon_sword', dagger: 'weapon_dagger', polearm: 'weapon_polearm', pole_arm: 'weapon_polearm',
    hammer: 'weapon_hammer', shotgun: 'weapon_firearm_shotgun', sling: 'weapon_sling',
    pistol: 'weapon_firearm_pistol', net: 'weapon_net', revolver: 'weapon_firearm_revolver',
    smg: 'weapon_firearm_smg', spear: 'weapon_spear', crossbow: 'weapon_crossbow',
    pick: 'weapon_pick', pickaxe: 'weapon_pick', whip: 'weapon_whip', blunt_weapon: 'weapon_blunt',
    blowgun: 'weapon_blowgun', rifle: 'weapon_firearm_rifle', staff: 'weapon_staff', axe: 'weapon_axe', bow: 'weapon_bow'
  };
  for (const [alias, expected] of Object.entries(weaponAliasExpectations)) assert.equal(registry.canonicalGroupId(alias), expected);

  const legacyAliasExpectations = {
    'Light Armor': 'armor_light', 'Melee Weapon': 'weapon_melee', food_meat: 'food', meat: 'meat_mammal',
    hide_leather: 'hide_mammal', bone_horn: 'hard_bone', fang: 'hard_claw', tusk: 'hard_horn',
    scale: 'scale_reptile', shell: 'shell_carapace', chitin: 'chitin_plate', feather: 'feather_raw',
    wool: 'animal_fiber_raw', raw_silk: 'silk_raw', ore: 'ore_raw', ore_mineral: 'ore_raw',
    ingot: 'metal_ingot', rough_gem: 'gem_rough', cut_gem: 'gem_cut', heart: 'organ_internal',
    eye: 'organ_sensory', brain: 'organ_brain', gland: 'organ_gland', humanoid_blood: 'blood',
    exotic_fluid: 'ichor', venom: 'venom_raw', acid: 'acid_secretion', ink: 'ink_secretion',
    slime: 'ooze_gel', arcane_essence: 'essence_raw', mana_core: 'energy_core', fruit: 'fruit_raw',
    vegetables: 'vegetable_raw', grain: 'grain_seed_raw', spice: 'spice_herb_raw', mushroom: 'fungus_raw',
    resin: 'resin', processed_stock: 'structural_stock', fasteners: 'fasteners_hardware',
    wire: 'wire_cable', vessel: 'container', harvesting_tool: 'harvest_kit', smithing_tool: 'smithing_tools',
    technical_tool: 'technical_tools', chemical_tool: 'chemical_tools'
  };
  for (const [alias, expected] of Object.entries(legacyAliasExpectations)) assert.equal(registry.canonicalGroupId(alias), expected);

  assert.equal(registry.resolveIcon('ore_mineral'), 'Assets/Icons/items/material/ore_raw.png');
  assert.equal(registry.resolveIcon('harvesting_tool'), 'Assets/Icons/items/utility/harvest_kit.png');
  assert.equal(registry.resolveIcon('wire'), 'Assets/Icons/items/material/wire_cable.png');
  assert.equal(registry.resolveIcon('bow'), 'Assets/Icons/items/equipment/weapon_ranged.png');

  assert.equal(registry.canonicalGroupId('constructor'), 'constructor');
  assert.equal(registry.has('constructor'), false);
  assert.equal(registry.get('constructor', { fallback: false }), null);
  assert.equal(registry.get('constructor').id, 'generic_item');
  assert.equal(registry.resolveIcon('nightshade'), 'Assets/Icons/items/material/nightshade.png');
  assert.equal(registry.get('missing-family').id, 'generic_item');
  assert.equal(registry.get('missing-family', { fallback: false }), null);
  assert.equal(registry.resolveIcon('healing_hp', { iconOverride: 'https://example.test/custom.png' }), 'https://example.test/custom.png');

  console.log(`Item icon registry smoke: OK (${groups.length} families, culinary + medical + weapon-specific families)`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
