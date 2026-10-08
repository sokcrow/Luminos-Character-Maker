"use strict";

const assert=require("assert");

require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-persistence-runtime.js");
require("../js/item-magic-runtime.js");
require("../js/item-magic-knowledge-runtime.js");
require("../js/item-enchantment-compendium-runtime.js");
require("../js/item-enchanter-service-runtime.js");

const Persistence=globalThis.LuminousItemPersistenceRuntime;
const Compendium=globalThis.LuminousEnchantmentCompendiumRuntime;
const Services=globalThis.LuminousItemEnchanterServiceRuntime;

assert.ok(Persistence && Compendium && Services);
assert.strictEqual(Services.VERSION,4);

const provider=Services.normalizeProviderProfile({
  id:"preview_enchanter",
  maxRank:3,
  services:["enchant"],
  knownEnchantments:["flamebound"],
  reliability:0.80,
  specialtyReliability:{fire:0.90},
  durationHoursByRank:{1:8},
});

const item={
  instanceId:"preview_blade",
  definitionId:"preview_blade",
  name:"Longsword",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:60,
  condition:60,
};

const quote=Services.quoteEnchantService(provider,item,"flamebound",1,{});
assert.strictEqual(quote.quoted,true);
assert.strictEqual(quote.threshold.finalThreshold,22);

const low={id:"low",arcanaMod:-1};
const lowPreview=Services.playerServicePreview(low,provider,item,quote);
assert.strictEqual(lowPreview.available,true);
assert.strictEqual(lowPreview.enchantmentName,"Flamebound","shop/service label may name the offered Enchantment");
assert.strictEqual(lowPreview.rank,null);
assert.strictEqual(lowPreview.difficulty.known,false);
assert.ok(!String(lowPreview.difficulty.text).includes("22"));
assert.strictEqual(lowPreview.controlledResult.known,false);
assert.ok(!String(lowPreview.controlledResult.text).includes("90"));
assert.strictEqual(lowPreview.projectedMagicalDurability,null);
assert.strictEqual(lowPreview.internalIdsExposed,false);
assert.ok(!JSON.stringify(lowPreview).includes("definitionId"));

const baseline={id:"baseline",arcanaMod:0};
const baselinePreview=Services.playerServicePreview(baseline,provider,item,quote);
assert.strictEqual(baselinePreview.difficulty.known,false);
assert.strictEqual(baselinePreview.difficulty.label,"Difficult");
assert.strictEqual(baselinePreview.difficulty.threshold,null);
assert.strictEqual(baselinePreview.controlledResult.known,false);

const expert={id:"expert",arcanaMod:12};
const expertPreview=Services.playerServicePreview(expert,provider,item,quote);
assert.strictEqual(expertPreview.arcanaPassive,22);
assert.strictEqual(expertPreview.arcanaDeepVisible,true);
assert.strictEqual(expertPreview.rank,1);
assert.strictEqual(expertPreview.difficulty.known,true);
assert.strictEqual(expertPreview.difficulty.threshold,22);
assert.strictEqual(expertPreview.controlledResult.known,true);
assert.strictEqual(expertPreview.controlledResult.percent,90);
assert.deepStrictEqual(expertPreview.effects,["Damage +10% (fire)"]);
assert.strictEqual(expertPreview.projectedMagicalDurability,30);

const reader={id:"reader",arcanaMod:-1,languages:{draconic:{percent:100}}};
const source={
  sourceId:"preview_tome",
  definitionId:"flamebound",
  languageId:"draconic",
  knownRanks:[1],
  text:"A Ruby path for Flamebound.",
};
assert.strictEqual(Compendium.learnFromSource(reader,source).learned,true);
const recipePreview=Services.playerServicePreview(reader,provider,item,quote);
assert.strictEqual(recipePreview.recipeKnown,true);
assert.strictEqual(recipePreview.rank,1);
assert.strictEqual(recipePreview.difficulty.known,true,"known recipe exposes the exact recipe difficulty");
assert.strictEqual(recipePreview.difficulty.threshold,22);
assert.deepStrictEqual(recipePreview.effects,["Damage +10% (fire)"]);
assert.strictEqual(recipePreview.controlledResult.known,false,"knowing the recipe does not reveal the provider's exact reliability");
assert.strictEqual(recipePreview.projectedMagicalDurability,null,"provider/Item deep analysis remains Arcana-gated");

const snapshot=Persistence.serializeInventoryState({
  inventario_activo:{},
  inventario_stash:{},
  enchantmentCompendium:reader.enchantmentCompendium,
});
assert.deepStrictEqual(snapshot.enchantmentCompendium,reader.enchantmentCompendium);
const target={inventario_activo:{},inventario_stash:{},equipment:{accessories:[]}};
Persistence.applyInventoryState(target,snapshot);
assert.deepStrictEqual(target.enchantmentCompendium,reader.enchantmentCompendium);

console.log("Enchanter knowledge-gated service preview smoke: OK");
