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

const Catalog=globalThis.LuminousEnchantmentCatalog;
const Engine=globalThis.LuminousItemEnchantmentEngine;
const Inventory=globalThis.LuminousItemInventoryRuntime;
const Persistence=globalThis.LuminousItemPersistenceRuntime;
const Magic=globalThis.LuminousItemMagicRuntime;

assert.strictEqual(Catalog.VERSION,5);
assert.strictEqual(Engine.VERSION,11);
assert.strictEqual(Magic.VERSION,5);

const schema={
  id:"schema_fixture",
  name:"Schema Fixture",
  description:"Fixture",
  eligibleItemKinds:["weapon"],
  rankData:{
    1:{
      slotCost:1,
      threshold:22,
      laborFloorAhn:750000,
      rankFactor:0.75,
      valueContributionAhn:1000,
      valueMultiplier:1.1,
      effects:[
        {type:"item_stat_flat",trigger:"passive",stat:"strength",value:2,stacking:"highest",order:2},
        {type:"damage_flat",trigger:"on_skill",damageType:"fire",value:3,stacking:"additive",order:1},
        {type:"defense_percent",trigger:"passive",value:5,stacking:"multiplicative"},
      ],
    },
  },
};
assert.strictEqual(Catalog.validateDefinition(schema).valid,true);
assert.strictEqual(Catalog.validateEffect({type:"item_stat_flat",trigger:"passive",value:2}).valid,false);
assert.ok(Catalog.EFFECT_TYPES.includes("damage_flat"));
assert.ok(Catalog.EFFECT_TYPES.includes("item_stat_percent"));

assert.strictEqual(Engine.baseSlotCapacity({itemType:"weapon",tier:5}),3);
assert.strictEqual(Engine.baseSlotCapacity({itemType:"weapon",tier:5,enchantmentSlotCapacity:2}),2);
assert.strictEqual(Engine.baseSlotCapacity({itemType:"weapon",tier:2,enchantmentSlotCapacity:3}),1,"Item override cannot bypass Tier capacity");
assert.strictEqual(Engine.baseSlotCapacity({itemType:"consumable",tier:5,enchantmentSlotCapacity:3}),0,"ineligible Item family stays zero-capacity");

const weapon={
  instanceId:"legacy_killer_weapon",
  definitionId:"legacy_killer_weapon",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:60,
  condition:60,
};
const applied=Engine.applyEnchantment(weapon,"flamebound",1,{
  applicationId:"application_1",
  appliedBy:"enchanter_npc",
  appliedAt:111,
  provenance:{service:"enchant",locationId:"loc_1",encounterId:"enc_1"},
});
assert.strictEqual(applied.applied,true);
assert.strictEqual(applied.reference.applicationId,"application_1");
assert.strictEqual(applied.item.magic.enchantmentHistory.length,1);
assert.strictEqual(applied.item.magic.enchantmentHistory[0].kind,"apply");

const replaced=Engine.replaceEnchantment(applied.item,"flamebound","frostbound",1,{
  applicationId:"application_2",
  appliedBy:"enchanter_npc",
  appliedAt:222,
  provenance:{service:"remove_rewrite"},
});
assert.strictEqual(replaced.replaced,true);
assert.strictEqual(replaced.item.magic.enchantments[0].definitionId,"frostbound");
assert.strictEqual(replaced.recoveredMaterials.length,0,"normal replacement does not refund ritual reagents");
assert.strictEqual(replaced.item.magic.enchantmentHistory.at(-1).kind,"replace");
assert.strictEqual(replaced.item.magic.enchantmentHistory.at(-1).context.replacedDefinitionId,"flamebound");

assert.strictEqual(Magic.stackedNumericValue([
  {value:10,stacking:"additive"},
  {value:5,stacking:"highest"},
  {value:20,stacking:"highest"},
]),30);
assert.strictEqual(Math.round(Magic.stackedNumericValue([
  {value:10,stacking:"multiplicative"},
  {value:20,stacking:"multiplicative"},
])),32);

assert.deepStrictEqual(Catalog.SPECIALIZED_DAMAGE_PERCENT_BY_RANK,{1:5,2:8,3:13},
  "specialized bonuses use the owner-approved Rank I/II/III values");
const specialist={
  instanceId:"specialist_weapon",itemType:"weapon",category:"weapon",
};
const specialistEffects=[
  {type:"specialized_damage_percent",axis:"physical",damageType:"slash",value:13},
  {type:"specialized_damage_percent",axis:"sin",damageType:"wrath",value:8},
];
assert.strictEqual(Catalog.validateEffect(specialistEffects[0]).valid,true,
  "an explicit physical specialist is a valid authored effect");
assert.strictEqual(Catalog.validateEffect(specialistEffects[1]).valid,true,
  "SIN specialist effects require an explicit SIN axis and affinity");
assert.strictEqual(Catalog.validateEffect({
  type:"specialized_damage_percent",value:13,damageType:"slash",
}).valid,false,"untyped specialist effects cannot enter the live catalog");
const weaponSkill={sourceItemInstanceId:"specialist_weapon",attackType:"Slash",sinAffinity:"Wrath"};
assert.strictEqual(Magic.specializedDamageForSkill(specialistEffects,specialist,weaponSkill).requiresChoice,true,
  "matching physical and SIN specialist bonuses require a chosen channel");
const physical=Magic.specializedDamageForSkill(specialistEffects,specialist,weaponSkill,{selectedDamageChannel:"physical"});
assert.strictEqual(physical.value,13);
assert.strictEqual(physical.channel,"physical");
const affinity=Magic.specializedDamageForSkill(specialistEffects,specialist,weaponSkill,{selectedDamageChannel:"sin"});
assert.strictEqual(affinity.value,8);
assert.strictEqual(Magic.specializedDamageForSkill(specialistEffects,specialist,{
  attackType:"Slash",sinAffinity:"Wrath",
},{selectedDamageChannel:"physical"}).value,0,
  "an unrelated Skill must not inherit the main-hand Item's specialist bonus");

const backedChargeItem=JSON.parse(JSON.stringify(applied.item));
const backedPlan=Magic.activationResourcePlan({effects:[{
  sourceEnchantmentId:"flamebound",resource:"charges",chargeCost:2,
  magicalDurabilityCost:4,
}]},backedChargeItem);
assert.strictEqual(backedPlan.charges,0,"Enchanter Charges must not create an independent Item battery");
assert.strictEqual(backedPlan.magicalDurability,4,"explicit Charge cost maps to canonical MD");
assert.strictEqual(backedPlan.unmappedEnchantmentCharges,false);
const backedUser={sp:10};
const beforeBackedCharges=Magic.magicalDurabilityState(backedChargeItem).current;
const backedSpend=Magic.payActivationResourcePlan(backedUser,backedChargeItem,backedPlan);
assert.strictEqual(backedSpend.paid,true);
assert.strictEqual(Magic.magicalDurabilityState(backedChargeItem).current,beforeBackedCharges-4,
  "two presented Charges consume the one authored 4-MD cost");
const invalidPlan=Magic.activationResourcePlan({effects:[{
  sourceEnchantmentId:"flamebound",resource:"charges",chargeCost:2,
}]},backedChargeItem);
assert.strictEqual(invalidPlan.unmappedEnchantmentCharges,true);
assert.strictEqual(Magic.canPayActivationResources(backedUser,backedChargeItem,invalidPlan).reason,
  "enchantment_charge_md_mapping_required",
  "unmapped Enchanter charges are rejected rather than debited from unrelated legacy Charges");

const equippedItem=JSON.parse(JSON.stringify(applied.item));
const actor={id:"actor",hp:10,equipment:{mainHand:equippedItem,offHand:equippedItem,accessories:[]}};
assert.strictEqual(Magic.itemEquippedBy(actor,equippedItem),true);
assert.strictEqual(Magic.equippedMagicItems(actor).length,1,"duplicate equipment references must not double-count the same Item");
const live=Magic.enchantmentEffectResolution(actor,equippedItem,{trigger:"on_skill",requireEquipped:true,requireLivingActor:true});
assert.strictEqual(live.resolved,true);
actor.hp=0;
const dead=Magic.enchantmentEffectResolution(actor,equippedItem,{trigger:"on_skill",requireEquipped:true,requireLivingActor:true});
assert.strictEqual(dead.resolved,false);
assert.strictEqual(dead.reason,"actor_cannot_emit_magic");
actor.hp=10;
const loose=JSON.parse(JSON.stringify(equippedItem));
loose.instanceId="not_equipped";
const notEquipped=Magic.enchantmentEffectResolution(actor,loose,{trigger:"on_skill",requireEquipped:true});
assert.strictEqual(notEquipped.reason,"item_not_equipped");

const resourceItem={
  instanceId:"resource_item",
  definitionId:"resource_item",
  chargesCurrent:5,
  chargesMax:5,
  magic:{enabled:true,nativeMagic:true,magicalDurability:{max:10,current:10,authored:true}},
};
const resourceUser={sp:5};
const plan={charges:2,magicalDurability:3,sp:1};
assert.strictEqual(Magic.canPayActivationResources(resourceUser,resourceItem,plan).allowed,true);
const paid=Magic.payActivationResourcePlan(resourceUser,resourceItem,plan);
assert.strictEqual(paid.paid,true);
assert.strictEqual(resourceItem.chargesCurrent,3);
assert.strictEqual(resourceItem.magic.magicalDurability.current,7);
assert.strictEqual(resourceUser.sp,4);
const impossible={charges:99,magicalDurability:0,sp:0};
const beforeCharges=resourceItem.chargesCurrent;
assert.strictEqual(Magic.payActivationResourcePlan(resourceUser,resourceItem,impossible).paid,false);
assert.strictEqual(resourceItem.chargesCurrent,beforeCharges,"failed activation preflight cannot create negative/reset charges");

const stacked={
  instanceId:"stack_magic",
  definitionId:"stack_magic",
  itemType:"valuable",
  category:"valuable",
  tier:2,
  stackable:true,
  quantity:2,
  chargesCurrent:3,
  chargesMax:5,
  magic:JSON.parse(JSON.stringify(applied.item.magic)),
};
const unit={inventario_activo:{stack_magic:stacked},inventario_stash:{},equipment:{accessories:[]}};
const split=Inventory.splitStack(unit,"stack_magic",1,{container:"active"});
assert.strictEqual(split.split,true);
assert.deepStrictEqual(split.created.magic,split.source.magic);
assert.strictEqual(split.created.chargesCurrent,3);
const snapshot=Persistence.serializeInventoryState(unit);
const target={inventario_activo:{},inventario_stash:{},equipment:{accessories:[]}};
Persistence.applyInventoryState(target,snapshot);
const hydrated=Object.values(target.inventario_activo);
assert.strictEqual(hydrated.length,2);
assert.ok(hydrated.every((entry)=>entry.chargesCurrent===3));
assert.ok(hydrated.every((entry)=>entry.magic.enchantments[0].applicationId==="application_1"));

const receiptOwner={
  inventario_activo:{},
  inventario_stash:{},
  enchanterTransactions:{tx_1:{transactionId:"tx_1",committed:true}},
};
const receiptSnapshot=Persistence.serializeInventoryState(receiptOwner);
assert.strictEqual(receiptSnapshot.enchanterTransactions.tx_1.committed,true);
const receiptTarget={inventario_activo:{},inventario_stash:{},equipment:{accessories:[]}};
Persistence.applyInventoryState(receiptTarget,receiptSnapshot);
assert.strictEqual(receiptTarget.enchanterTransactions.tx_1.transactionId,"tx_1");

console.log("Enchantment legacy backend coverage smoke: OK");
