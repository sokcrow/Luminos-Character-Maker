"use strict";

const assert=require("assert");

require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-magic-runtime.js");
require("../js/item-enchanter-service-runtime.js");

const Engine=globalThis.LuminousItemEnchantmentEngine;
const Services=globalThis.LuminousItemEnchanterServiceRuntime;

assert.ok(Engine && Services);
assert.strictEqual(Services.VERSION,4);
assert.strictEqual(Services.MAX_REPRODUCIBLE_RANK,3);

const provider=Services.normalizeProviderProfile({
  id:"ember_smith",
  name:"Ember Smith",
  maxRank:3,
  services:["enchant","strengthen","magical_repair","bind","curse"],
  knownEnchantments:["flamebound"],
  resonanceSpecialties:["fire"],
  equipmentSpecialties:["weapon"],
  reliability:0.60,
  specialtyReliability:{fire:0.90,weapon:0.80},
  unknownRecipeReliability:0.35,
  outcomeTable:[
    {kind:"altered",weight:3},
    {kind:"accidental_bind",weight:1},
    {kind:"accidental_curse",weight:1},
  ],
  durationHoursByRank:{1:8,2:48,3:192},
  priceModifier:1,
  materialPriceModifier:1,
  magicalRepairAhnPerPoint:1000,
});
assert.strictEqual(provider.maxRank,3);
assert.deepStrictEqual(provider.services,["enchant","strengthen","magical_repair","bind","curse"]);

const weapon={
  instanceId:"service_weapon",
  definitionId:"service_weapon",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:60,
  condition:60,
  enchantmentBaseValueAhn:500000,
};

const fireReliability=Services.effectiveReliability(provider,"flamebound",weapon);
assert.strictEqual(fireReliability.resolved,true);
assert.strictEqual(fireReliability.probability,0.90);
assert.strictEqual(fireReliability.source,"specialty:fire");

const unknownNoRecipe=Services.providerCanService(provider,"enchant",{
  rank:1,
  definition:globalThis.LuminousEnchantmentCatalog.get("frostbound"),
  enchantmentId:"frostbound",
});
assert.strictEqual(unknownNoRecipe.allowed,false);
assert.strictEqual(unknownNoRecipe.reason,"provider_does_not_know_recipe");

const unknownWithRecipe=Services.providerCanService(provider,"enchant",{
  rank:1,
  definition:globalThis.LuminousEnchantmentCatalog.get("frostbound"),
  enchantmentId:"frostbound",
  recipeProvided:true,
});
assert.strictEqual(unknownWithRecipe.allowed,true);
const unknownReliability=Services.effectiveReliability(provider,"frostbound",weapon,{recipeProvided:true});
assert.strictEqual(unknownReliability.probability,0.35,"provided instructions do not grant the provider their Fire specialty success rate");

const relicBlocked=Services.providerCanService(provider,"enchant",{
  rank:4,
  definition:globalThis.LuminousEnchantmentCatalog.get("flamebound"),
  enchantmentId:"flamebound",
});
assert.strictEqual(relicBlocked.allowed,false);
assert.strictEqual(relicBlocked.reason,"relic_rank_not_reproducible");

const quote=Services.quoteEnchantService(provider,weapon,"flamebound",1,{});
assert.strictEqual(quote.quoted,true);
assert.strictEqual(quote.labor.floorAhn,750000);
assert.strictEqual(quote.labor.rawLaborAhn,750000);
assert.strictEqual(quote.labor.laborAhn,750000);
assert.strictEqual(quote.materials.providerMaterialsAhn,0);
assert.strictEqual(quote.totalAhn,750000);
assert.strictEqual(quote.normalShopRetailMarkupApplied,false);
assert.strictEqual(quote.duration.resolved,true);
assert.strictEqual(quote.duration.hours,8);
assert.strictEqual(quote.reliability.probability,0.90);

const job=Services.beginService(provider,weapon,quote,{startedAt:1000});
assert.strictEqual(job.started,true);
assert.strictEqual(job.job.status,"in_service");
assert.strictEqual(job.job.readyAt,1000+(8*60*60*1000));
assert.strictEqual(Services.serviceReady(job.job,job.job.readyAt-1),false);
assert.strictEqual(Services.serviceReady(job.job,job.job.readyAt),true);

const controlledOutcome=Services.resolveNpcOutcome(provider,"flamebound",weapon,{roll:0.50});
assert.strictEqual(controlledOutcome.resolved,true);
assert.strictEqual(controlledOutcome.kind,"controlled");
const alteredOutcome=Services.resolveNpcOutcome(provider,"flamebound",weapon,{roll:0.95});
assert.strictEqual(alteredOutcome.resolved,true);
assert.notStrictEqual(alteredOutcome.kind,"controlled");

const applied=Services.executeControlledResult(weapon,quote);
assert.strictEqual(applied.executed,true);
assert.strictEqual(applied.result.applied,true);
assert.strictEqual(applied.result.item.magic.magicalDurability.max,30,"service application uses 50% proportional Magical Durability");

const rankOneItem=applied.result.item;
const strengthen=Services.quoteStrengthenService(provider,rankOneItem,"flamebound",2,{});
assert.strictEqual(strengthen.quoted,true);
assert.strictEqual(strengthen.currentRank,1);
assert.strictEqual(strengthen.targetRank,2);
assert.strictEqual(strengthen.labor.floorAhn,2500000);
assert.strictEqual(strengthen.totalAhn,2500000);
assert.strictEqual(strengthen.duration.hours,48);
const strengthened=Services.executeControlledResult(rankOneItem,strengthen);
assert.strictEqual(strengthened.executed,true);
assert.strictEqual(strengthened.result.reference.rank,2);

const customRecipe={
  ...globalThis.LuminousEnchantmentCatalog.get("flamebound"),
  recipe:{
    requiredTags:["enchantment_material"],
    consumedRequirements:[
      {id:"arcane_powder",anyTags:["arcane_reagent"],quantity:2},
      {id:"fire_essence",anyTags:["fire_reagent"],quantity:1},
    ],
    exactItemRequirements:[],
    outcomes:{allowAccidentalBind:false,allowAccidentalCurse:false},
  },
};
const playerPowder={
  instanceId:"player_powder",
  definitionId:"arcane_powder",
  quantity:2,
  unitValueAhn:10000,
  reagentTags:["arcane_reagent"],
};
const providerEssence={
  instanceId:"provider_essence",
  definitionId:"fire_essence",
  quantity:1,
  unitValueAhn:50000,
  reagentTags:["fire_reagent"],
};
const mixed=Services.materialQuote(customRecipe,provider,{
  playerMaterials:[playerPowder],
  providerMaterials:[providerEssence],
});
assert.strictEqual(mixed.resolved,true);
assert.strictEqual(mixed.providerMaterialsAhn,50000);
assert.strictEqual(mixed.playerMaterialsDiscountAhn,20000);
assert.strictEqual(mixed.allocations.filter((entry)=>entry.suppliedBy==="player").length,1);
assert.strictEqual(mixed.allocations.filter((entry)=>entry.suppliedBy==="provider").length,1);

const repairItem=JSON.parse(JSON.stringify(rankOneItem));
repairItem.magic.magicalDurability.current=10;
repairItem.magic.magicalDurability.depleted=false;
const repair=Services.quoteMagicalRepair(provider,repairItem);
assert.strictEqual(repair.quoted,true);
assert.strictEqual(repair.restorePoints,20);
assert.strictEqual(repair.perPointAhn,1000);
assert.strictEqual(repair.totalAhn,20000);
assert.strictEqual(repair.normalShopRetailMarkupApplied,false);

const repairExecution=Services.executeControlledResult(repairItem,repair);
assert.strictEqual(repairExecution.executed,true);
assert.strictEqual(repairExecution.item.magic.magicalDurability.current,30);
assert.strictEqual(repairExecution.item.condition,60,"Magical Repair does not restore or alter Physical Durability");

const unresolvedRepairProvider=Services.normalizeProviderProfile({
  id:"no_rate",
  maxRank:1,
  services:["magical_repair"],
});
const unresolvedRepair=Services.quoteMagicalRepair(unresolvedRepairProvider,repairItem);
assert.strictEqual(unresolvedRepair.quoted,false);
assert.strictEqual(unresolvedRepair.reason,"magical_repair_price_unresolved");

const durationRank2=Services.durationBand(2);
assert.deepStrictEqual(durationRank2,{unit:"days",minHours:24,maxHours:72,label:"1–3 days"});
const durationRank3=Services.durationBand(3);
assert.strictEqual(durationRank3.minHours,168);
assert.strictEqual(durationRank3.maxHours,null);

console.log("Enchanter service provider/quote runtime smoke: OK");
