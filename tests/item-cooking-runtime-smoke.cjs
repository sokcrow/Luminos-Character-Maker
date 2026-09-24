const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  for(const key of [
    "LuminousItemEconomyStandard","LuminousCookingEngine","LuminousCookingRecipeCatalog",
    "LuminousCookingRecipeResolver","LuminousCookingEquipmentEngine","LuminousCookingRuntime"
  ]) delete globalThis[key];

  for(const file of [
    "../js/item-economy-standard.js",
    "../js/item-cooking-engine.js",
    "../js/item-cooking-recipe-catalog.js",
    "../js/item-cooking-v2-engine.js",
    "../js/item-cooking-recipe-resolver.js",
    "../js/item-cooking-equipment-engine.js",
    "../js/item-cooking-runtime.js",
  ]) await import(pathToFileURL(path.resolve(__dirname,file)).href);

  const rt=globalThis.LuminousCookingRuntime;
  const recipeCatalog=globalThis.LuminousCookingRecipeCatalog;
  assert.ok(rt);
  const unit={
    hp:50,hp_max:100,sp:0,sp_max:45,proficiencyBonus:3,
    inventario_activo:{
      cooks:{definitionId:"cooks_utensils",itemId:"cooks_utensils",quantity:1,category:"tool"},
      bread:{
        instanceId:"bread-a",itemId:"finished_flatbread_a",recipeId:"flatbread",family:"food",category:"food",quantity:1,
        unitProductionValueAhn:3500,culinaryProperties:[{target:"survival",sourceInstanceId:"bread-source"}],
      },
      meat:{
        instanceId:"meat-a",itemId:"meat_wolf",quantity:1,tags:["ingredient","meat","wolf"],unitValueAhn:18000,
        flavorTags:["savory"],culinaryProperties:[{target:"survival",sourceInstanceId:"meat-source"}],
      },
      veg:{
        instanceId:"veg-a",itemId:"carrot",quantity:1,recipeRoles:["vegetable"],itemTags:["ingredient","vegetable"],unitValueAhn:1200,
        flavorTags:["fresh"],culinaryProperties:[{target:"nature",sourceInstanceId:"veg-source"}],
      },
      sauce:{
        instanceId:"sauce-a",itemId:"processed_sauce_base",quantity:1,family:"processed_food",processed:true,
        processedForm:"sauce_base",tags:["sauce_base","liquid","base"],unitProductionValueAhn:4500,taste:3,
      },
    },
    inventario_stash:{},
  };

  const preview=rt.previewCook(unit,"burger",{includeStash:true,equipment:{stationId:"grill"}});
  assert.equal(preview.valid,true);
  assert.equal(preview.recipeTh,13);
  assert.equal(preview.effectiveTh,12);
  assert.equal(preview.equipment.improperEquipmentCount,0);
  assert.equal(preview.concreteRecipe.ingredients.length,4);

  const badStation=rt.previewCook(unit,"burger",{includeStash:true,equipment:{stationId:"oven"}});
  assert.equal(badStation.valid,true);
  assert.equal(badStation.effectiveTh,15);
  assert.equal(badStation.equipment.improperEquipmentCount,1);

  const result=rt.executeCook(unit,"burger",15,{includeStash:true,equipment:{stationId:"grill"},createdAt:1000,instanceId:"burger-made"});
  assert.equal(result.cooked,true);
  assert.equal(result.item.recipeId,"burger");
  assert.equal(result.item.stars,3);
  assert.equal(result.item.taste,3);
  assert.equal(result.item.hungerSlotsRestored,1);
  assert.equal(result.item.category,"food");
  assert.equal(result.item.iconFamily,"food");
  assert.ok(result.item.productionValueAhn>0);
  assert.equal(result.item.sourceLine,"cooking_v2");
  assert.equal(result.item.durationHours,14);
  assert.equal(result.item.culinaryEffects.length,2,"3-star V2 food unlocks two fixed recipe effects");
  assert.equal(result.item.culinaryEffects.every((effect)=>globalThis.LuminousCookingV2Engine.VALID_TARGETS.has(effect.target)),true);
  assert.equal(globalThis.LuminousCookingV2Engine.MAX_HP_STEPS.includes(result.item.maxHpBonus),true);
  assert.ok(result.item.mealFocus);
  assert.ok(result.preparedV2);
  assert.ok(unit.inventario_activo["burger-made"]);
  assert.equal(unit.inventario_activo.meat,undefined);
  assert.equal(unit.inventario_activo.veg,undefined);
  assert.equal(unit.inventario_activo.sauce,undefined);
  assert.equal(unit.inventario_activo.bread,undefined);
  assert.ok(unit.inventario_activo.cooks);

  const piePreviewItem=rt.finishedFoodItem(recipeCatalog.get("apple_pie"),{
    stars:3,taste:3,sp:5,recipeTh:12,effectiveTh:12,margin:0,ability:"dex",
    provenance:[],effects:[],activeEffectCount:0,durationHours:0
  },null,{createdAt:1000,instanceId:"apple-pie-made"});
  assert.equal(piePreviewItem.iconFamily,"apple_pie");

  const second=rt.previewCook(unit,"burger",{equipment:{stationId:"grill"}});
  assert.equal(second.valid,false);
  assert.equal(second.reason,"missing_recipe_requirements");

  console.log("Cooking Runtime V2 smoke: OK (inventory recipe -> TH/equipment -> stars -> balanced recipe functions -> finished food)");
})().catch((error)=>{ console.error(error); process.exitCode=1; });
