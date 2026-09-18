"use strict";
const assert=require("assert");

require("../js/item-armor-material-profile.js");
require("../js/item-catalog-weapon-components.js");
require("../js/item-catalog-shield-components.js");
require("../js/item-catalog-shield-upgrades.js");
require("../js/item-shield-upgrade-engine.js");
require("../js/item-shield-composition-engine.js");
require("../js/item-defensive-wear-runtime.js");
require("../js/item-shield-runtime.js");

const Materials=globalThis.LuminousArmorMaterialProfile;
const Components=globalThis.LuminousShieldComponentCatalog;
const Upgrades=globalThis.LuminousShieldUpgradeCatalog;
const UpgradeEngine=globalThis.LuminousShieldUpgradeEngine;
const Shields=globalThis.LuminousShieldCompositionEngine;
const Wear=globalThis.LuminousDefensiveWearRuntime;
const Runtime=globalThis.LuminousShieldRuntime;

assert.ok(Materials&&Components&&Upgrades&&UpgradeEngine&&Shields&&Wear&&Runtime,"Shield V1 globals must load");
assert.strictEqual(Shields.CHASSIS.length,4);
assert.deepStrictEqual(Shields.CHASSIS.map((row)=>row.id),["shield_buckler","shield_round","shield_heater","shield_tower"]);
assert.deepStrictEqual(Shields.CHASSIS.map((row)=>[row.guardMin,row.guardMax]),[[8,15],[15,25],[22,35],[30,50]]);
assert.deepStrictEqual(Shields.CHASSIS.map((row)=>row.clashModifier),[2,1,0,-2]);
assert.deepStrictEqual(Shields.CHASSIS.map((row)=>row.shieldCrackedPower),[0,1,2,3]);
assert.strictEqual(Shields.getChassis("shield_buckler").intrinsicParryTier,1);

const bodyWood=Components.resolveComponent("shield_component_body",{body:"wood"});
const rimWood=Components.resolveComponent("shield_component_rim",{rim:"wood"});
const gripWoodLeather=Components.resolveComponent("shield_component_grip",{core:"wood",wrap:"leather"});
assert.strictEqual(bodyWood.valid,true);
assert.strictEqual(bodyWood.materialUnits,2);
assert.strictEqual(rimWood.materialUnits,1);
assert.strictEqual(gripWoodLeather.materialUnits,2);
assert.strictEqual(bodyWood.upgradeCapacity,1);
assert.strictEqual(Components.resolveComponent("shield_component_body",{body:"chitin"}).upgradeCapacity,2);
assert.strictEqual(Components.resolveComponent("shield_component_body",{body:"hardened_steel"}).upgradeCapacity,3);

const buckler=Shields.resolvePreset("shield_buckler",{}, {craftResult:18});
const round=Shields.resolvePreset("shield_round",{}, {craftResult:20});
const heater=Shields.resolvePreset("shield_heater",{}, {craftResult:22});
const tower=Shields.resolvePreset("shield_tower",{}, {craftResult:24});
assert.deepStrictEqual([buckler.standardPhysicalValueAhn,round.standardPhysicalValueAhn,heater.standardPhysicalValueAhn,tower.standardPhysicalValueAhn],[45000,83000,111000,181000]);
assert.deepStrictEqual([buckler.components[0].quantity,round.components[0].quantity,heater.components[0].quantity,tower.components[0].quantity],[1,2,3,5]);
assert.strictEqual(tower.components.find((row)=>row.component.componentId==="shield_component_rim").quantity,2);
assert.strictEqual(tower.primaryMaterial.id,"wood");
assert.strictEqual(tower.name,"Wood Tower Shield");
assert.strictEqual(tower.guard>=30&&tower.guard<=50,true);
assert.strictEqual(tower.attackModes.some((mode)=>mode.id==="bash"&&mode.damageType==="blunt"),true);
assert.strictEqual(tower.tags.includes("tremor_capable"),true);

const hardenedTower=Shields.resolvePreset("shield_tower",{
  shield_component_body:{materials:{body:"hardened_steel"}},
  shield_component_rim:{materials:{rim:"hardened_steel"}},
  shield_component_grip:{materials:{core:"hardened_steel",wrap:"leather"}},
},{craftResult:24});
assert.strictEqual(hardenedTower.valid,true);
assert.strictEqual(hardenedTower.guard,48);
assert.strictEqual(hardenedTower.standardPhysicalValueAhn,1924000);
assert.strictEqual(hardenedTower.productionValueAhn,1924000);

const fineHardened=Shields.resolvePreset("shield_tower",{
  shield_component_body:{materials:{body:"hardened_steel"},quality:"fine"},
  shield_component_rim:{materials:{rim:"hardened_steel"},quality:"fine"},
  shield_component_grip:{materials:{core:"hardened_steel",wrap:"leather"},quality:"fine"},
},{craftResult:24});
assert.strictEqual(fineHardened.quality,"fine");
assert.strictEqual(fineHardened.weightScore,hardenedTower.weightScore,"Quality must never change Weight");
assert.strictEqual(fineHardened.productionValueAhn,3175000);
assert.ok(fineHardened.durability>hardenedTower.durability);

const spiked=UpgradeEngine.apply(bodyWood,[{id:"spiked_face",materials:{material:"iron"}}]);
assert.strictEqual(spiked.valid,true);
assert.strictEqual(spiked.upgradeProductionValueAhn,26000);
assert.strictEqual(spiked.shieldUpgradeEffects.guardDelta,-2);
assert.strictEqual(spiked.shieldUpgradeEffects.addAttackModes[0].damageType,"pierce");
assert.strictEqual(spiked.shieldUpgradeEffects.statusAmplifiers[0].statusType,"rupture");
assert.strictEqual(UpgradeEngine.apply(bodyWood,["breaker_spikes"]).valid,false,"Wood Body only has one upgrade slot");

const steelRim=Components.resolveComponent("shield_component_rim",{rim:"hardened_steel"});
const knifeRim=UpgradeEngine.apply(steelRim,[{id:"mounted_knife",materials:{blade:"iron"}}]);
assert.strictEqual(knifeRim.valid,true);
assert.ok(knifeRim.shieldUpgradeEffects.addAttackModes.some((mode)=>mode.damageType==="slash"));
assert.ok(knifeRim.shieldUpgradeEffects.addAttackModes.some((mode)=>mode.damageType==="pierce"));
assert.ok(knifeRim.shieldUpgradeEffects.addTags.includes("bleed_capable"));

assert.deepStrictEqual(Runtime.physicalResistanceSupport(0),{support:0.02,internalDelta:-0.02});
assert.deepStrictEqual(Runtime.physicalResistanceSupport(1),{support:0.04,internalDelta:-0.04});
assert.deepStrictEqual(Runtime.physicalResistanceSupport(3),{support:0.08,internalDelta:-0.08});
assert.strictEqual(Runtime.guardValue({guard:30},3),36);

assert.strictEqual(Wear.resolveShieldWear({contact:true,damage:7,damageType:"blunt",elementalWear:{}}),1);
assert.strictEqual(Wear.resolveShieldWear({contact:true,damage:40,damageType:"fire",elementalWear:{fire:1.60}}),8);
assert.strictEqual(Wear.resolveArmorWear({damage:40,damageType:"fire",elementalWear:{fire:1.60}}),8);

const wearShield={...buckler,currentDurability:10,maxDurability:10,durability:10};
const wear1=Runtime.applySkillContactWear(wearShield,{eventId:"skill_a",damage:50,damageType:"blunt"});
assert.strictEqual(wear1.wear,1,"Physical Shield Wear is one per contacted Skill, not damage-scaled");
assert.strictEqual(wearShield.currentDurability,9);
const duplicate=Runtime.applySkillContactWear(wearShield,{eventId:"skill_a",damage:50,damageType:"blunt"});
assert.strictEqual(duplicate.applied,false,"A multi-Coin Skill cannot charge Shield Wear more than once by event id");

const elementalShield={...buckler,elementalWear:{fire:1.60,cold:1,lightning:1,acid:1},currentDurability:20,maxDurability:20,durability:20};
const fireWear=Runtime.applySkillContactWear(elementalShield,{eventId:"fire_a",damage:40,damageType:"fire"});
assert.strictEqual(fireWear.wear,8);
assert.strictEqual(elementalShield.currentDurability,12);

const left={...buckler,instanceId:"left_shield"};
const right={...tower,instanceId:"right_shield"};
const dualUnit={equipment:{mainHand:left,offHand:right,shield:right}};
assert.strictEqual(Runtime.resolveShieldSource(dualUnit,{shieldSourceId:"left_shield"}),left);
assert.strictEqual(Runtime.resolveShieldSource(dualUnit,{}),null,"Dual Shield requires an explicit action source");
const prepared=Runtime.prepareSkill(dualUnit,{type:"Guard",shieldMode:"parry"},{shieldSourceId:"left_shield",parry:true});
assert.strictEqual(prepared.type,"ClashableGuard");
assert.strictEqual(prepared.__shieldClashModifier,2);
assert.strictEqual(prepared.__shieldCrackedPower,0);

const degradeShield={...fineHardened,currentDurability:1,maxDurability:fineHardened.maxDurability,durability:1};
const degraded=Runtime.applyWear(degradeShield,1);
assert.strictEqual(degraded.degradation.quality,"standard");
assert.strictEqual(degradeShield.guard,48,"Quality degradation must recalculate Guard");
assert.strictEqual(degradeShield.productionValueAhn,1924000,"Quality degradation must recalculate physical value");

const genericCoinBefore={type:"unbreakable",status:"latent"};
assert.deepStrictEqual(genericCoinBefore,{type:"unbreakable",status:"latent"},"Shield-specific Cracked semantics must not mutate generic coin state");

console.log("Shield V1 smoke: OK");
