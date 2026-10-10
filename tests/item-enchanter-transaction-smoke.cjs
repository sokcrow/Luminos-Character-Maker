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
assert.strictEqual(Engine.VERSION, 11);
assert.strictEqual(Services.VERSION, 7);

const provider=Services.normalizeProviderProfile({
  id:"atomic_enchanter",
  maxRank:3,
  services:["curse","enchant"],
  knownEnchantments:["flamebound"],
  reliability:1,
  priceModifier:1,
  materialPriceModifier:1,
});

const item={
  instanceId:"atomic_weapon",
  definitionId:"atomic_weapon",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:60,
  condition:60,
  enchantmentBaseValueAhn:500000,
};

const profane={
  instanceId:"profane_blood_stack",
  definitionId:"profane_blood",
  name:"Profane Blood",
  quantity:1,
  unitValueAhn:50000,
  tags:["ingredient","blood","profane"],
};

const quote=Services.quoteEnchantService(provider,item,"flamebound",1,{
  serviceId:"curse",
  providerMaterials:[profane],
});
assert.strictEqual(quote.quoted,true);
assert.deepStrictEqual(quote.properties,["curse"]);

const preview=Services.previewServiceResult(item,quote,{appliedBy:"previewer"});
assert.strictEqual(preview.previewed,true);
assert.strictEqual(item.magic,undefined,"preview must not mutate the real Item");
assert.strictEqual(preview.item.magic.enchantments[0].properties[0],"curse");

const poorOwner={id:"poor_player",ahn:100};
const poorMaterial={...profane};
const poorItem=JSON.parse(JSON.stringify(item));
const failed=Services.commitServiceTransaction(poorOwner,poorItem,quote,{
  transactionId:"tx_atomic_fail",
  providerMaterials:[poorMaterial],
  appliedBy:"atomic_enchanter",
  providerId:"atomic_enchanter",
});
assert.strictEqual(failed.committed,false);
assert.strictEqual(failed.reason,"insufficient_ahn");
assert.strictEqual(poorOwner.ahn,100);
assert.strictEqual(poorMaterial.quantity,1,"failed payment must not consume materials");
assert.strictEqual(poorItem.magic,undefined,"failed payment must not alter Item");

const owner={id:"rich_player",ahn:2000000};
const material={...profane};
const mutableItem=JSON.parse(JSON.stringify(item));
const committed=Services.commitServiceTransaction(owner,mutableItem,quote,{
  transactionId:"tx_atomic_success",
  providerMaterials:[material],
  appliedBy:"atomic_enchanter",
  providerId:"atomic_enchanter",
  encounterId:"enc_42",
  locationId:"loc_backstreet",
  startedAt:123456,
});
assert.strictEqual(committed.committed,true);
assert.strictEqual(committed.transactionId,"tx_atomic_success");
assert.strictEqual(owner.ahn,2000000-quote.totalAhn);
assert.strictEqual(material.quantity,0,"successful transaction consumes allocated ritual material");
assert.strictEqual(mutableItem.magic.enchantments.length,1);
assert.deepStrictEqual(mutableItem.magic.enchantments[0].properties,["curse"]);
assert.strictEqual(mutableItem.magic.enchantments[0].applicationId,"tx_atomic_success");
assert.strictEqual(mutableItem.magic.enchantments[0].appliedBy,"atomic_enchanter");
assert.strictEqual(mutableItem.magic.enchantments[0].appliedAt,123456);
assert.strictEqual(mutableItem.magic.enchantments[0].provenance.transactionId,"tx_atomic_success");
assert.strictEqual(mutableItem.magic.enchantments[0].provenance.encounterId,"enc_42");
assert.strictEqual(mutableItem.magic.enchantments[0].provenance.locationId,"loc_backstreet");
assert.strictEqual(mutableItem.magic.enchantmentHistory.at(-1).kind,"apply");
assert.strictEqual(mutableItem.magic.enchantmentHistory.at(-1).applicationId,"tx_atomic_success");
assert.strictEqual(owner.enchanterTransactions.tx_atomic_success.transactionId,"tx_atomic_success");

const duplicate=Services.commitServiceTransaction(owner,mutableItem,quote,{
  transactionId:"tx_atomic_success",
  providerMaterials:[material],
});
assert.strictEqual(duplicate.committed,false);
assert.strictEqual(duplicate.reason,"duplicate_transaction");

const dmOwner={id:"dm"};
const dmItem={...item,instanceId:"dm_free_weapon"};
const freeQuote=Services.quoteEnchantService(provider,dmItem,"flamebound",1,{});
assert.strictEqual(freeQuote.quoted,true);
const free=Services.commitServiceTransaction(dmOwner,dmItem,freeQuote,{
  transactionId:"tx_dm_free",
  dmFreeService:true,
  appliedBy:"dm",
});
assert.strictEqual(free.committed,true);
assert.strictEqual(free.chargedAhn,0);
assert.strictEqual(dmItem.magic.enchantments[0].provenance.freeService,true);

const adjusted=Services.adjustedQuoteTotal(1000000,{discountPercent:10,surchargePercent:20});
assert.strictEqual(adjusted.totalAhn,1080000);

// A removal must obey the same transaction preflight and preview isolation
// as the initial application; it must not strip magic on an unpaid service.
const removable=JSON.parse(JSON.stringify(committed.item));
const paidRemoveQuote={
  quoted:true,service:"remove_rewrite",procedure:"direct_remove",
  definitionId:"flamebound",totalAhn:1000,
  materials:{plan:{valid:true}},
};
const removalPreview=Services.previewServiceResult(removable,paidRemoveQuote);
assert.strictEqual(removalPreview.previewed,true);
assert.strictEqual(removalPreview.item.magic.enchantments.length,0);
assert.strictEqual(removable.magic.enchantments.length,1,
  "re-enchant/removal preview must not mutate its Item Instance");
const unpaidRemovalOwner={ahn:0};
const removalDenied=Services.commitServiceTransaction(unpaidRemovalOwner,removable,paidRemoveQuote,{
  transactionId:"unpaid_remove",
});
assert.strictEqual(removalDenied.committed,false);
assert.strictEqual(removalDenied.reason,"insufficient_ahn");
assert.strictEqual(removable.magic.enchantments.length,1,
  "failed removal must preserve the installed enchantment");
const removalOwner={ahn:5000};
const removalDone=Services.commitServiceTransaction(removalOwner,removable,paidRemoveQuote,{
  transactionId:"paid_remove",appliedBy:"enchanter",
});
assert.strictEqual(removalDone.committed,true);
assert.strictEqual(removalOwner.ahn,4000);
assert.strictEqual(removable.magic.enchantments.length,0);
assert.strictEqual(removable.magic.enchantmentHistory.at(-1).kind,"remove");
const removeTwice=Services.commitServiceTransaction(removalOwner,removable,paidRemoveQuote,{
  transactionId:"paid_remove",
});
assert.strictEqual(removeTwice.reason,"duplicate_transaction");
assert.strictEqual(removalOwner.ahn,4000,"duplicated removal must not charge twice");

console.log("Enchanter atomic transaction/provenance smoke: OK");
