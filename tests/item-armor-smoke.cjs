"use strict";
const assert=require("assert");
const Armor=require("../js/item-armor-composition-engine.js");
const Materials=require("../js/item-armor-material-profile.js");
const Components=require("../js/item-catalog-armor-components.js");
const Upgrades=require("../js/item-catalog-armor-upgrades.js");
const UpgradeEngine=require("../js/item-armor-upgrade-engine.js");
const Runtime=require("../js/item-armor-runtime.js");

assert.strictEqual(Armor.CHASSIS.length,12);
assert.strictEqual(Armor.getChassis("studded_leather"),null);
assert.strictEqual(Components.COMPONENTS.length,7);
assert.strictEqual(Materials.canonicalId("armor_steel"),"hardened_steel");
assert.strictEqual(Materials.canonicalId("hardened_weapon_steel"),"hardened_steel");
assert.strictEqual(Materials.resolve("hardened_steel").durability,42);
assert.strictEqual(Materials.upgradeSlotsForDurability(19),1);
assert.strictEqual(Materials.upgradeSlotsForDurability(20),2);
assert.strictEqual(Materials.upgradeSlotsForDurability(35),3);

const steelPlate=Armor.resolvePreset("plate_armor",{
  armor_plate:{body:{materialId:"hardened_steel",name:"Hardened Steel"}},
  armor_reinforcement:{body:{materialId:"hardened_steel",name:"Hardened Steel"}},
},{armorGrade:0,craftResult:24});
assert.strictEqual(steelPlate.valid,true);
assert.strictEqual(steelPlate.orientation.strong,"slash");
assert.strictEqual(steelPlate.orientation.secondary,"pierce");
assert.strictEqual(steelPlate.orientation.sacrifice,"blunt");
assert.deepStrictEqual(steelPlate.physicalResistanceProfile,{slash:0.65,pierce:0.85,blunt:1.35});
assert.strictEqual(steelPlate.strengthTarget<=13,true);

const chitinPlate=Armor.resolvePreset("plate_armor",{
  armor_plate:{body:{materialId:"chitin",name:"Chitin"}},
  armor_reinforcement:{body:{materialId:"chitin",name:"Chitin"}},
},{armorGrade:0,craftResult:24});
assert.strictEqual(chitinPlate.valid,true);
assert.strictEqual(chitinPlate.orientation.strong,"slash");
assert.strictEqual(chitinPlate.orientation.sacrifice,"pierce");

const titaniumPlate=Armor.resolvePreset("plate_armor",{
  armor_plate:{body:{materialId:"titanium_alloy",name:"Titanium Alloy"}},
  armor_reinforcement:{body:{materialId:"titanium_alloy",name:"Titanium Alloy"}},
},{armorGrade:0,craftResult:24});
assert.strictEqual(titaniumPlate.valid,true);
assert.ok(titaniumPlate.weightEffect.max>steelPlate.weightEffect.max,"lighter plate should preserve more Max Speed");
assert.ok(titaniumPlate.strengthTarget<=steelPlate.strengthTarget);

const plateComponent=Components.resolveComponent("armor_plate",{body:"hardened_steel"});
assert.strictEqual(plateComponent.upgradeCapacity,3);
const angled=UpgradeEngine.apply(plateComponent,["angled_plating","segmented_plate","anti_corrosion_coating"]);
assert.strictEqual(angled.valid,true);
assert.ok(angled.physicalAffinity.pierce>plateComponent.physicalAffinity.pierce);
assert.ok(angled.elementalWear.acid<plateComponent.elementalWear.acid);
assert.strictEqual(UpgradeEngine.apply(plateComponent,["angled_plating","rounded_plating","impact_channels","segmented_plate"]).valid,false);
assert.ok(Upgrades.list({componentId:"armor_fittings"}).some((u)=>u.id==="balanced_harness"));

assert.deepStrictEqual(Runtime.baseSpeed(6),{min:2,max:8});
const speedNoRelief=Runtime.resolveSpeed({dexMod:6,armor:{strengthTarget:13,weightEffect:{min:-1,max:-4}},strengthScore:15});
assert.strictEqual(speedNoRelief.strengthRelief,false);
assert.deepStrictEqual({min:speedNoRelief.min,max:speedNoRelief.max},{min:1,max:4});
const speedRelief=Runtime.resolveSpeed({dexMod:6,armor:{strengthTarget:13,weightEffect:{min:-1,max:-4}},strengthScore:16});
assert.strictEqual(speedRelief.strengthRelief,true);
assert.deepStrictEqual(speedRelief.effectiveWeightEffect,{min:0,max:-2});
assert.deepStrictEqual({min:speedRelief.min,max:speedRelief.max},{min:2,max:6});

const normalUnarmored=Runtime.resolvePhysicalResistance({constitutionMod:5});
assert.strictEqual(normalUnarmored.final.slash,1.20);
const armorless=Runtime.resolvePhysicalResistance({constitutionMod:5,armorlessDefense:true});
assert.strictEqual(armorless.final.slash,1.10);
const proficientPlate=Runtime.resolvePhysicalResistance({armor:steelPlate,constitutionMod:3,proficient:true});
assert.strictEqual(Number(proficientPlate.final.slash.toFixed(2)),0.54);
assert.strictEqual(Number(proficientPlate.final.pierce.toFixed(2)),0.74);
assert.strictEqual(Number(proficientPlate.final.blunt.toFixed(2)),1.24);

const grade3=Armor.resolvePreset("plate_armor",{
  armor_plate:{body:"hardened_steel"},armor_reinforcement:{body:"hardened_steel"}
},{armorGrade:3,craftResult:24});
assert.strictEqual(Number(grade3.physicalResistanceProfile.slash.toFixed(2)),0.50);
assert.strictEqual(Number(grade3.physicalResistanceProfile.blunt.toFixed(2)),1.20);

console.log("Armor V1 smoke: OK");
