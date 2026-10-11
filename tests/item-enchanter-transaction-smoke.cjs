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
const reagent=(id,quantity=1)=>({
  instanceId:id,definitionId:"enchanted_dust",quantity,
  unitValueAhn:5000,useTags:["enchantment_material"],
});
const ritualMaterial=reagent("ritual_catalyst");


const quote=Services.quoteEnchantService(provider,item,"flamebound",1,{
  serviceId:"curse",
  providerMaterials:[ritualMaterial,profane],
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
  providerMaterials:[{...ritualMaterial},poorMaterial],
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
  providerMaterials:[{...ritualMaterial},material],
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
  providerMaterials:[{...ritualMaterial},material],
});
assert.strictEqual(duplicate.committed,false);
assert.strictEqual(duplicate.reason,"duplicate_transaction");

const dmOwner={id:"dm"};
const dmItem={...item,instanceId:"dm_free_weapon"};
const freeReagent=reagent("free_ritual");
const freeQuote=Services.quoteEnchantService(provider,dmItem,"flamebound",1,{playerMaterials:[freeReagent]});
assert.strictEqual(freeQuote.quoted,true);
const free=Services.commitServiceTransaction(dmOwner,dmItem,freeQuote,{
  transactionId:"tx_dm_free",
  dmFreeService:true,
  appliedBy:"dm",
  playerMaterials:[freeReagent],
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


// Codex P1: the committed NPC roll must not bypass authored reliability.
const unreliableProvider=Services.normalizeProviderProfile({
  id:"unreliable",services:["enchant"],maxRank:3,
  knownEnchantments:["flamebound"],reliability:0,
});
const npcItem={...item,instanceId:"unreliable_sword"};
const npcCatalyst=reagent("npc_ritual");
const npcQuote=Services.quoteEnchantService(unreliableProvider,npcItem,"flamebound",1,
  {playerMaterials:[npcCatalyst]});
assert.equal(npcQuote.quoted,true);
const npcOwner={ahn:2000000,inventario_activo:{unreliable_sword:npcItem,npc_ritual:npcCatalyst}};
const npcDenied=Services.commitServiceTransaction(npcOwner,npcItem,npcQuote,{
  provider:unreliableProvider,npcRoll:0.5,transactionId:"npc_no_outcome",
  playerMaterials:[npcCatalyst],
});
assert.equal(npcDenied.committed,false,"reliability zero must not produce a controlled Enchantment");
assert.equal(npcItem.magic,undefined,"an unresolved NPC outcome cannot install magic");
assert.equal(npcOwner.ahn,2000000,"unresolved NPC outcomes cannot charge the player");
const authoredFailureProvider=Services.normalizeProviderProfile({
  id:"authored_failure",services:["enchant"],maxRank:3,
  knownEnchantments:["flamebound"],reliability:0,
  outcomeTable:[{kind:"unchanged_existing",weight:1}],
});
const authoredItem={...item,instanceId:"authored_failure_sword"};
const authoredCatalyst=reagent("authored_ritual");
const authoredOwner={ahn:2000000,inventario_activo:{
  authored_failure_sword:authoredItem,authored_ritual:authoredCatalyst,
}};
const authoredQuote=Services.quoteEnchantService(authoredFailureProvider,authoredItem,"flamebound",1,
  {playerMaterials:[authoredCatalyst]});
const altered=Services.commitServiceTransaction(authoredOwner,authoredItem,authoredQuote,{
  provider:authoredFailureProvider,npcRoll:0.5,transactionId:"npc_authored_failure",
  playerMaterials:[authoredCatalyst],
});
assert.equal(altered.committed,true,"an explicit NPC outcome can be committed");
assert.equal(altered.npcOutcome.kind,"unchanged_existing");
assert.equal(authoredItem.magic,undefined,"authored failure must not install requested magic");
assert.equal(altered.npcOutcomeKind,"unchanged_existing");

// Codex P1: a socketed Gem Anchor consumes the loose gem; stacked gems yield
// a unique mounted Item identity without destroying the rest of the stack.
const mountProvider=Services.normalizeProviderProfile({
  id:"mount_smith",services:["mount_gem"],maxRank:3,
  knownEnchantments:["flamebound"],reliability:1,
});
const mountItem={...item,instanceId:"mount_weapon"};
const gemStack={instanceId:"ruby_stack",definitionId:"ruby",quality:"fine",quantity:2};
const mountCatalyst=reagent("mount_ritual");
const mountOwner={ahn:2000000,inventario_activo:{mount_weapon:mountItem,ruby_stack:gemStack,
  mount_ritual:mountCatalyst}};
const mountQuote=Services.quoteEnchantService(mountProvider,mountItem,"flamebound",1,{
  serviceId:"mount_gem",gem:gemStack,playerMaterials:[mountCatalyst],
});
assert.equal(mountQuote.quoted,true);
const mountDone=Services.commitServiceTransaction(mountOwner,mountItem,mountQuote,{
  provider:mountProvider,npcRoll:0,transactionId:"mount_once",
  playerMaterials:[mountCatalyst],
});
assert.equal(mountDone.committed,true,"valid loose gem should mount successfully");
assert.equal(mountOwner.inventario_activo.ruby_stack.quantity,1);
const anchor=Engine.gemAnchors(mountItem)[0];
assert.ok(anchor);
assert.notEqual(anchor.gemInstanceId,"ruby_stack","stack remainder and mounted gem cannot share a unique instance ID");

const singleItem={...item,instanceId:"single_mount_weapon"};
const singleGem={instanceId:"ruby_single",definitionId:"ruby",quality:"fine",quantity:1};
const singleCatalyst=reagent("single_ritual");
const singleOwner={ahn:2000000,inventario_activo:{single_mount_weapon:singleItem,
  ruby_single:singleGem,single_ritual:singleCatalyst}};
const singleQuote=Services.quoteEnchantService(mountProvider,singleItem,"flamebound",1,{
  serviceId:"mount_gem",gem:singleGem,playerMaterials:[singleCatalyst],
});
assert.equal(singleQuote.quoted,true);
const singleDone=Services.commitServiceTransaction(singleOwner,singleItem,singleQuote,{
  provider:mountProvider,npcRoll:0,transactionId:"mount_single",
  playerMaterials:[singleCatalyst],
});
assert.equal(singleDone.committed,true);
assert.equal(singleOwner.inventario_activo.ruby_single,undefined,"mounted singleton gem must leave loose inventory");

// Codex P1/P2: successful non-destructive extraction returns the Gem to
// the player and preserves the provider's explicit post-extraction quality.
const extractProvider=Services.normalizeProviderProfile({
  id:"gem_recovery",services:["extract_gem"],maxRank:3,
  servicePriceAhn:{extract_gem:1000},safeExtractionGemQuality:"standard",
});
assert.equal(extractProvider.gemQualityAfter,"standard");
const extractItem={...item,instanceId:"extract_sword"};
const embedded=Engine.mountGemAnchor(extractItem,
  {instanceId:"ruby_recovered",definitionId:"ruby",quality:"fine"},"flamebound",1);
assert.equal(embedded.mounted,true);
const extracting=JSON.parse(JSON.stringify(embedded.item));
const extractOwner={ahn:10000,inventario_activo:{extract_sword:extracting}};
const extractQuote=Services.quoteGemProcedure(extractProvider,extracting,
  embedded.anchor.anchorId,"safe_extract",{gemQualityAfter:extractProvider.safeExtractionGemQuality});
assert.equal(extractQuote.quoted,true);
const extractDone=Services.commitServiceTransaction(extractOwner,extracting,extractQuote,{
  transactionId:"safe_extract_once",
});
assert.equal(extractDone.committed,true);
assert.equal(extractOwner.inventario_activo.ruby_recovered.quality,"standard");
assert.equal(extractOwner.inventario_activo.ruby_recovered.magicallyWritten,true);
assert.equal(extractOwner.inventario_activo.ruby_recovered.quantity,1);
assert.equal(Engine.gemAnchors(extracting).length,0);
assert.equal(extractOwner.ahn,9000);

// A recovered Gem must respect Active 24 / Stash 80 capacities, even
// when its Item was already occupying one of the Active slots.
const filledActive=Object.fromEntries(Array.from({length:23},(_,i)=>[
  "other_"+i,{instanceId:"other_"+i,definitionId:"other"},
]));
const fullActiveOwner={ahn:10000,inventario_activo:{
  extract_sword:JSON.parse(JSON.stringify(embedded.item)),...filledActive,
},inventario_stash:{}};
const extractWithFullActive=Services.commitServiceTransaction(fullActiveOwner,
  fullActiveOwner.inventario_activo.extract_sword,extractQuote,{transactionId:"extract_full_active"});
assert.equal(extractWithFullActive.committed,true,"full Active should spill recovered gem into Stash");
assert.equal(Object.keys(fullActiveOwner.inventario_activo).length,24);
assert.equal(fullActiveOwner.inventario_stash.ruby_recovered.quality,"standard");
const fullStashOwner={ahn:10000,inventario_activo:{
  extract_sword:JSON.parse(JSON.stringify(embedded.item)),...filledActive,
},inventario_stash:Object.fromEntries(Array.from({length:80},(_,i)=>[
  "stored_"+i,{instanceId:"stored_"+i,definitionId:"stored"},
]))};
const blockedGemRecovery=Services.commitServiceTransaction(fullStashOwner,
  fullStashOwner.inventario_activo.extract_sword,extractQuote,{transactionId:"extract_full_both"});
assert.equal(blockedGemRecovery.committed,false);
assert.equal(blockedGemRecovery.reason,"recovered_gem_inventory_full");
assert.equal(fullStashOwner.ahn,10000,"full recovery cannot charge the Player");
assert.equal(Engine.gemAnchors(fullStashOwner.inventario_activo.extract_sword).length,1);

// A pre-existing loose Item with this same instance ID cannot be overwritten.
const conflictItem=JSON.parse(JSON.stringify(embedded.item));
const conflictOwner={ahn:10000,inventario_activo:{
  extract_sword:conflictItem,ruby_recovered:{instanceId:"ruby_recovered",definitionId:"ruby",quantity:1},
}};
const conflict=Services.commitServiceTransaction(conflictOwner,conflictItem,extractQuote,{
  transactionId:"safe_extract_conflict",
});
assert.equal(conflict.committed,false);
assert.equal(conflict.reason,"recovered_gem_inventory_collision");
assert.equal(conflictOwner.ahn,10000);
assert.equal(Engine.gemAnchors(conflictItem).length,1);
assert.equal(conflictOwner.inventario_activo.ruby_recovered.quantity,1);

// A timed Enchanter order charges/material-reserves at intake but must not
// reveal or mutate its magical result until the persisted readyAt is reached.
const timedItem={...item,instanceId:"timed_weapon"};
const timedCatalyst=reagent("timed_ritual");
const timedOwner={ahn:2000000,inventario_activo:{timed_weapon:timedItem,timed_ritual:timedCatalyst},
  enchanterTransactions:{},enchanterJobs:{}};
const timedQuote=Services.quoteEnchantService(provider,timedItem,"flamebound",1,{
  serviceId:"enchant",playerMaterials:[timedCatalyst],
});
assert.equal(timedQuote.quoted,true);
const timedWithDuration={...timedQuote,duration:{resolved:true,hours:8}};
const startedAt=1710000000000;
const delayed=Services.startDeferredServiceTransaction(timedOwner,timedItem,timedWithDuration,{
  transactionId:"timed_enchant_once",worldTimestamp:startedAt,provider,
  playerMaterials:[timedCatalyst],
});
assert.equal(delayed.committed,true,"valid order must reserve and persist a job");
assert.equal(delayed.started,true);
assert.equal(delayed.job.readyAt,startedAt+8*60*60*1000);
assert.equal(delayed.job.clockSource,"campaign");
assert.equal(Services.serviceReady(delayed.job),false,
  "no calendar timestamp must never unlock the Item based on wall clock");
assert.equal(timedOwner.ahn,2000000,"simulation must not mutate the source Player");
assert.equal(timedItem.magic,undefined,"source Item cannot be enchanted at intake");
assert.equal(delayed.player.inventario_activo.timed_weapon,undefined,
  "an escrowed Item cannot be used, equipped, moved, stashed or sold");
assert.equal(delayed.job.itemAfter.magic.enchantments.length,1,
  "the completed magical result must be sealed in the job");
assert.equal(delayed.player.ahn,2000000-timedWithDuration.totalAhn);
assert.equal(delayed.player.enchanterTransactions.timed_enchant_once.status,"in_service");
assert.equal(delayed.player.inventario_activo.timed_ritual,undefined,
  "a fully consumed reagent cannot occupy an inventory slot");
assert.equal(timedOwner.inventario_activo.timed_ritual.quantity,1,
  "simulation does not spend the original Player reagent");
assert.equal(Services.serviceReady(delayed.job,startedAt),false);
const withoutCalendar=Services.startDeferredServiceTransaction(timedOwner,timedItem,timedWithDuration,{
  transactionId:"timed_clock_missing",provider,playerMaterials:[timedCatalyst],
});
assert.equal(withoutCalendar.committed,false);
assert.equal(withoutCalendar.reason,"service_world_time_unavailable");
const pendingPlayer=JSON.parse(JSON.stringify(delayed.player));
const early=Services.completeDeferredServiceTransaction(pendingPlayer,"timed_enchant_once",{
  worldTimestamp:startedAt+7*60*60*1000,
});
assert.equal(early.committed,false);
assert.equal(early.reason,"service_not_ready");
assert.equal(pendingPlayer.ahn,delayed.player.ahn);
assert.equal(pendingPlayer.inventario_activo.timed_weapon,undefined);
const delivered=Services.completeDeferredServiceTransaction(pendingPlayer,"timed_enchant_once",{
  worldTimestamp:delayed.job.readyAt,
});
assert.equal(delivered.committed,true);
assert.equal(delivered.chargedAhn,0,"collection cannot double-charge");
assert.equal(delivered.player.ahn,delayed.player.ahn);
assert.equal(delivered.player.inventario_activo.timed_weapon.magic.enchantments.length,1);
assert.equal(delivered.player.enchanterJobs.timed_enchant_once.status,"completed");
assert.equal(delivered.player.enchanterTransactions["timed_enchant_once:delivery"].chargedAhn,0);
// Firebase serializers add schema defaults, which must not invalidate a
// legitimate job or erase the normalized Item at collection time.
require("../js/item-persistence-runtime.js");
const Persistence=globalThis.LuminousItemPersistenceRuntime;
const savedPending=Persistence.serializeInventoryState(delayed.player);
const restoredState=Persistence.deserializeInventoryState(savedPending);
const restoredOwner={...delayed.player,...restoredState};
assert.equal(restoredOwner.inventario_activo.timed_weapon,undefined,
  "Item must still be in escrow after serialization and hydration");
const deliveredAfterReload=Services.completeDeferredServiceTransaction(
  restoredOwner,"timed_enchant_once",{worldTimestamp:delayed.job.readyAt});
assert.equal(deliveredAfterReload.committed,true,"loaded orders must still be deliverable");
assert.equal(Persistence.serializeInventoryState(deliveredAfterReload.player)
  .inventario_activo.timed_weapon.schemaVersion,3,
  "delivered Item must survive a subsequent save/hydration");
assert.equal(deliveredAfterReload.player.inventario_activo.timed_weapon.magic.enchantments.length,1);
assert.equal(Services.completeDeferredServiceTransaction(delivered.player,"timed_enchant_once",{
  worldTimestamp:delayed.job.readyAt,
}).committed,false,"a finished job cannot be collected twice");
const alteredDuringService=JSON.parse(JSON.stringify(delayed.player));
alteredDuringService.inventario_activo.timed_weapon={
  ...timedItem,condition:45,
};
const alteredDelivery=Services.completeDeferredServiceTransaction(alteredDuringService,
  "timed_enchant_once",{worldTimestamp:delayed.job.readyAt});
assert.equal(alteredDelivery.committed,false);
assert.equal(alteredDelivery.reason,"service_item_identity_collision");
assert.equal(alteredDuringService.ahn,delayed.player.ahn,"rejected delivery cannot charge");
// Equipped Items cannot leave the Player's inventory without unequipping.
const equippedOwner={...timedOwner,itemEquipmentRefs:{
  mainHand:"timed_weapon",offHand:null,armor:null,shield:null,accessoryIds:[],
}};
const blockedEquipped=Services.startDeferredServiceTransaction(
  equippedOwner,timedItem,timedWithDuration,{transactionId:"equipped_job",provider});
assert.equal(blockedEquipped.committed,false);
assert.equal(blockedEquipped.reason,"service_item_must_be_unequipped");
assert.equal(equippedOwner.ahn,2000000);
assert.ok(equippedOwner.inventario_activo.timed_weapon);
// If the original inventory is full when collecting, the Item is returned
// to the alternate container, without creating a duplicate.
const filled=JSON.parse(JSON.stringify(delayed.player));
filled.inventario_activo=Object.fromEntries(Array.from({length:24},(_,i)=>[
  "filler_"+i,{instanceId:"filler_"+i,definitionId:"filler"},
]));
filled.inventario_stash={};
const overflowPickup=Services.completeDeferredServiceTransaction(filled,
  "timed_enchant_once",{worldTimestamp:delayed.job.readyAt});
assert.equal(overflowPickup.committed,true);
assert.equal(overflowPickup.player.inventario_activo.timed_weapon,undefined);
assert.equal(overflowPickup.player.inventario_stash.timed_weapon.magic.enchantments.length,1);
const full=JSON.parse(JSON.stringify(filled));
full.inventario_stash=Object.fromEntries(Array.from({length:80},(_,i)=>[
  "stash_"+i,{instanceId:"stash_"+i,definitionId:"stash"},
]));
const blockedFull=Services.completeDeferredServiceTransaction(full,
  "timed_enchant_once",{worldTimestamp:delayed.job.readyAt});
assert.equal(blockedFull.committed,false);
assert.equal(blockedFull.reason,"service_inventory_full");
assert.equal(full.enchanterJobs.timed_enchant_once.status,"in_service");

// A non-cursed magical Item still receives a conclusive, billable Curse Analysis.
require("../js/item-magic-knowledge-runtime.js");
const analysisProvider=Services.normalizeProviderProfile({
  id:"curse_reader",maxRank:3,services:["curse_analysis"],
  servicePriceAhn:{curse_analysis:350},
});
const analysisItem=JSON.parse(JSON.stringify(dmItem));
analysisItem.instanceId="clean_magic_item";
const analysisOwner={ahn:900,itemMagicKnowledge:{},inventario_activo:{clean_magic_item:analysisItem}};
const analysisQuote=Services.quoteFixedService(analysisProvider,"curse_analysis");
assert.equal(analysisQuote.quoted,true);
const analysis=Services.commitServiceTransaction(analysisOwner,analysisItem,analysisQuote,{
  transactionId:"negative_curse_analysis",viewer:analysisOwner,
});
assert.equal(analysis.committed,true,"conclusive negative Curse Analysis must be chargeable");
assert.equal(analysisOwner.ahn,550);
assert.equal(analysisOwner.itemMagicKnowledge.clean_magic_item.curseChecked,true);
assert.equal(analysisOwner.itemMagicKnowledge.clean_magic_item.curseFlagKnown,false);
assert.equal(analysisOwner.enchanterTransactions.negative_curse_analysis.chargedAhn,350);

// Strengthening must consume *both* the normal ingredient and the curse
// reagent already installed on the enchantment, not merely quote that reagent.
const repairSmith=Services.normalizeProviderProfile({
  id:"properties_smith",maxRank:3,services:["strengthen","remove_rewrite","enchant","mount_gem"],
  knownEnchantments:["flamebound","frostbound"],reliability:1,
  servicePriceAhn:{remove_rewrite:500},
});
const cursedBase={...item,instanceId:"cursed_strengthen"};
const cursedApplied=Engine.applyEnchantment(cursedBase,"flamebound",1,{properties:["curse"]});
assert.equal(cursedApplied.applied,true);
const cursedItem=JSON.parse(JSON.stringify(cursedApplied.item));
const strengthDust=reagent("cursed_strength_dust");
const strengthBlood={...profane,instanceId:"cursed_strength_blood"};
const strengtheningOwner={ahn:5000000,inventario_activo:{
  cursed_strengthen:cursedItem,cursed_strength_dust:strengthDust,cursed_strength_blood:strengthBlood,
}};
const strengtheningQuote=Services.quoteStrengthenService(repairSmith,cursedItem,"flamebound",2,{
  playerMaterials:[strengthDust,strengthBlood],
});
assert.equal(strengtheningQuote.quoted,true);
assert.deepStrictEqual(strengtheningQuote.properties,["curse"]);
assert.ok(strengtheningQuote.materials.plan.requirements.some(row=>
  row.id==="intentional_curse_reagent"));
const strengtheningDone=Services.commitServiceTransaction(strengtheningOwner,cursedItem,
  strengtheningQuote,{transactionId:"cursetest",playerMaterials:[strengthDust,strengthBlood]});
assert.equal(strengtheningDone.committed,true);
assert.equal(strengtheningOwner.inventario_activo.cursed_strength_dust,undefined);
assert.equal(strengtheningOwner.inventario_activo.cursed_strength_blood,undefined);
assert.equal(cursedItem.magic.enchantments[0].rank,2);
assert.deepStrictEqual(cursedItem.magic.enchantments[0].properties,["curse"]);

// New NPC altered Enchant and Mount Gem outcomes must create a candidate
// inscription already carrying accidental Curse/Bind, not try to edit nothing.
for(const kind of ["accidental_bind","accidental_curse"]){
  const failureProvider=Services.normalizeProviderProfile({
    id:"accidental_"+kind,maxRank:3,
    services:["enchant","mount_gem"],knownEnchantments:["flamebound"],
    reliability:0,outcomeTable:[{kind,weight:1}],
  });
  const target={...item,instanceId:"new_"+kind};
  const powder=reagent("new_dust_"+kind);
  const owner={ahn:3000000,inventario_activo:{
    [target.instanceId]:target,[powder.instanceId]:powder,
  }};
  const quote=Services.quoteEnchantService(failureProvider,target,"flamebound",1,{
    playerMaterials:[powder],
  });
  assert.equal(quote.quoted,true);
  const done=Services.commitServiceTransaction(owner,target,quote,{
    provider:failureProvider,npcRoll:0.8,transactionId:"new_"+kind,
    playerMaterials:[powder],
  });
  assert.equal(done.committed,true,`new Enchant outcome ${kind}: ${done.reason}`);
  assert.equal(done.npcOutcomeKind,kind);
  assert.ok(target.magic.enchantments[0].properties.includes(kind==="accidental_bind"?"bind":"curse"));
  assert.equal(owner.inventario_activo[powder.instanceId],undefined);
}
const gemProvider=Services.normalizeProviderProfile({
  id:"accidental_gem",maxRank:3,services:["mount_gem"],knownEnchantments:["flamebound"],
  reliability:0,outcomeTable:[{kind:"accidental_curse",weight:1}],
});
const gemWeapon={...item,instanceId:"npc_gem_weapon"};
const looseGem={instanceId:"npc_gem",definitionId:"ruby",quality:"fine",quantity:1};
const gemDust=reagent("npc_gem_dust");
const npcGemOwner={ahn:3000000,inventario_activo:{
  npc_gem_weapon:gemWeapon,npc_gem:looseGem,npc_gem_dust:gemDust,
}};
const gemQuote=Services.quoteEnchantService(gemProvider,gemWeapon,"flamebound",2,{
  serviceId:"mount_gem",gem:looseGem,playerMaterials:[gemDust],
});
assert.equal(gemQuote.quoted,true);
const gemDone=Services.commitServiceTransaction(npcGemOwner,gemWeapon,gemQuote,{
  provider:gemProvider,npcRoll:0.8,transactionId:"npc_gem_curse",playerMaterials:[gemDust],
});
assert.equal(gemDone.committed,true,`new gem candidate: ${gemDone.reason}`);
assert.ok(gemWeapon.magic.enchantments[0].properties.includes("curse"));

// Direct replacement is one atomic transaction (removal + validated install)
// and costs the replacement recipe materials.
const originalDirect=Engine.applyEnchantment({...item,instanceId:"direct_rewrite_item"},"flamebound",1);
assert.equal(originalDirect.applied,true);
const directItem=JSON.parse(JSON.stringify(originalDirect.item));
const directDust=reagent("direct_rewrite_dust");
const directOwner={ahn:3000000,inventario_activo:{
  direct_rewrite_item:directItem,direct_rewrite_dust:directDust,
}};
const directQuote=Services.quoteDirectRewriteService(repairSmith,directItem,
  "flamebound","frostbound",{rank:1,playerMaterials:[directDust]});
assert.equal(directQuote.quoted,true,`direct replacement quote: ${directQuote.reason}`);
const directDone=Services.commitServiceTransaction(directOwner,directItem,directQuote,{
  transactionId:"direct_rewrite",playerMaterials:[directDust],
});
assert.equal(directDone.committed,true,`direct replacement: ${directDone.reason}`);
assert.equal(directItem.magic.enchantments.length,1);
assert.equal(directItem.magic.enchantments[0].definitionId,"frostbound");
assert.equal(directOwner.inventario_activo.direct_rewrite_dust,undefined);
assert.equal(directOwner.enchanterTransactions.direct_rewrite.chargedAhn,directQuote.totalAhn);

// Gem rewrite follows the same supported service procedure, preserving the
// physical anchor while switching inscription rank and written gem quality.
const gemWork=Engine.mountGemAnchor({...item,instanceId:"gem_rewrite_item"},
  {instanceId:"gem_rewrite_ruby",definitionId:"ruby",quality:"fine"},"flamebound",2);
assert.equal(gemWork.mounted,true);
const gemWriteItem=JSON.parse(JSON.stringify(gemWork.item));
const rewriteDust=reagent("gem_rewrite_dust");
const rewriteOwner={ahn:3000000,inventario_activo:{
  gem_rewrite_item:gemWriteItem,gem_rewrite_dust:rewriteDust,
}};
const rewriteQuote=Services.quoteGemProcedure(repairSmith,gemWriteItem,
  gemWork.anchor.anchorId,"rewrite",{
    nextDefinitionId:"flamebound",rank:1,gemQualityAfter:"standard",
    playerMaterials:[rewriteDust],
  });
assert.equal(rewriteQuote.quoted,true,`gem rewrite quote: ${rewriteQuote.reason}`);
const rewriteDone=Services.commitServiceTransaction(rewriteOwner,gemWriteItem,rewriteQuote,{
  transactionId:"gem_rewrite",playerMaterials:[rewriteDust],
});
assert.equal(rewriteDone.committed,true,`gem rewrite: ${rewriteDone.reason}`);
assert.equal(gemWriteItem.magic.enchantments[0].rank,1);
assert.equal(gemWriteItem.magic.gemAnchors[0].gemQuality,"standard");
assert.equal(rewriteOwner.inventario_activo.gem_rewrite_dust,undefined);

console.log("Enchanter atomic transaction/provenance smoke: OK");
