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
assert.strictEqual(Engine.VERSION,9);
assert.strictEqual(Services.VERSION,5);

const provider=Services.normalizeProviderProfile({
  id:"gemwright",
  name:"Gemwright",
  maxRank:3,
  services:["remove_rewrite","extract_gem"],
  servicePriceAhn:{
    remove_rewrite:250000,
    extract_gem:180000,
  },
});

const weapon={
  instanceId:"gem_service_weapon",
  definitionId:"gem_service_weapon",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:60,
  condition:60,
};

const gem={instanceId:"ruby_service_1",definitionId:"ruby",quality:"fine"};
const mounted=Engine.mountGemAnchor(weapon,gem,"flamebound",2);
assert.strictEqual(mounted.mounted,true);
assert.strictEqual(mounted.item.magic.magicalDurability.max,45);
const anchorId=mounted.anchor.anchorId;

const unresolved=Services.quoteGemProcedure(provider,mounted.item,anchorId,"safe_extract");
assert.strictEqual(unresolved.quoted,false);
assert.strictEqual(unresolved.reason,"gem_quality_downgrade_unresolved","safe extraction cannot invent the gem's post-writing quality");

const safeQuote=Services.quoteGemProcedure(provider,mounted.item,anchorId,"safe_extract",{
  gemQualityAfter:"standard",
});
assert.strictEqual(safeQuote.quoted,true);
assert.strictEqual(safeQuote.service,"extract_gem");
assert.strictEqual(safeQuote.destructive,false);
assert.strictEqual(safeQuote.gemQualityAfter,"standard");
assert.strictEqual(safeQuote.totalAhn,180000);

const safe=Services.executeControlledResult(mounted.item,safeQuote);
assert.strictEqual(safe.executed,true);
assert.strictEqual(safe.result.removed,true);
assert.strictEqual(safe.result.itemDestroyed,false);
assert.strictEqual(safe.result.gemDestroyed,false);
assert.strictEqual(safe.result.item.condition,60);
assert.strictEqual(safe.result.item.magic.gemAnchors.length,0);
assert.strictEqual(safe.result.item.magic.enchantments.length,0);
assert.strictEqual(safe.result.recoveredGem.definitionId,"ruby");
assert.strictEqual(safe.result.recoveredGem.instanceId,"ruby_service_1");
assert.strictEqual(safe.result.recoveredGem.quality,"standard");
assert.strictEqual(safe.result.recoveredGem.magicallyWritten,true);

const mounted2=Engine.mountGemAnchor(
  {...weapon,instanceId:"anchor_side_weapon"},
  {instanceId:"sapphire_service_1",definitionId:"sapphire",quality:"fine"},
  "frostbound",
  2
);
assert.strictEqual(mounted2.mounted,true);
const destroyQuote=Services.quoteGemProcedure(provider,mounted2.item,mounted2.anchor.anchorId,"destroy_anchor");
assert.strictEqual(destroyQuote.quoted,true);
assert.strictEqual(destroyQuote.destructive,true);
assert.strictEqual(destroyQuote.destroysGem,true);
assert.strictEqual(destroyQuote.destroysItem,false);

const destroyedGem=Services.executeControlledResult(mounted2.item,destroyQuote);
assert.strictEqual(destroyedGem.executed,true);
assert.strictEqual(destroyedGem.result.removed,true);
assert.strictEqual(destroyedGem.result.gemDestroyed,true);
assert.strictEqual(destroyedGem.result.itemDestroyed,false);
assert.strictEqual(destroyedGem.result.item.condition,60,"Anchor-side removal destroys the gem, not the Item");
assert.strictEqual(destroyedGem.result.item.magic.gemAnchors.length,0);

const boundMounted=Engine.mountGemAnchor(
  {...weapon,instanceId:"bound_anchor_weapon"},
  {instanceId:"ruby_bound_1",definitionId:"ruby",quality:"fine"},
  "flamebound",
  1,
  {properties:["bind"]}
);
assert.strictEqual(boundMounted.mounted,true);
const boundQuote=Services.quoteGemProcedure(provider,boundMounted.item,boundMounted.anchor.anchorId,"destroy_anchor");
assert.strictEqual(boundQuote.quoted,true);
assert.strictEqual(boundQuote.bound,true);
assert.strictEqual(boundQuote.destroysItem,true);

const blocked=Services.executeControlledResult(boundMounted.item,boundQuote);
assert.strictEqual(blocked.executed,false);
assert.strictEqual(blocked.result.reason,"bound_gem_removal_destroys_item");
assert.strictEqual(blocked.result.requiresDestructionConfirmation,true);

const confirmed=Services.executeControlledResult(boundMounted.item,boundQuote,{confirmDestruction:true});
assert.strictEqual(confirmed.executed,true);
assert.strictEqual(confirmed.result.catastrophic,true);
assert.strictEqual(confirmed.result.destroyedItem,true);
assert.strictEqual(confirmed.result.item.destroyed,true);
assert.strictEqual(confirmed.result.item.condition,0);
assert.strictEqual(confirmed.result.item.magic.gemAnchors.length,0);
assert.strictEqual(confirmed.result.gemOutcome,"not_recovered_by_default");

const direct=Engine.applyEnchantment(
  {...weapon,instanceId:"direct_remove_weapon"},
  "flamebound",
  1
);
assert.strictEqual(direct.applied,true);
const directQuote={
  quoted:true,
  service:"remove_rewrite",
  procedure:"direct_remove",
  definitionId:"flamebound",
  totalAhn:250000,
};
const directRemoved=Services.executeControlledResult(direct.item,directQuote);
assert.strictEqual(directRemoved.executed,true);
assert.strictEqual(directRemoved.result.removed,true);
assert.strictEqual(directRemoved.result.item.condition,60);
assert.strictEqual(directRemoved.result.item.magic.enchantments.length,0);

console.log("Enchanter gem removal/rewrite procedure smoke: OK");
