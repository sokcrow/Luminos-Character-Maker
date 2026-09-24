"use strict";
const assert=require("assert");

require("../js/item-equipment-enhancement-contract.js");
require("../js/item-armor-material-profile.js");
require("../js/item-catalog-armor-components.js");
require("../js/item-catalog-armor-upgrades.js");
require("../js/item-armor-upgrade-engine.js");
require("../js/item-armor-composition-engine.js");
require("../js/item-catalog-weapons.js");
require("../js/item-catalog-weapon-components.js");
require("../js/item-weapon-composition-engine.js");
require("../js/item-catalog-shield-components.js");
require("../js/item-catalog-shield-upgrades.js");
require("../js/item-shield-upgrade-engine.js");
require("../js/item-shield-composition-engine.js");

const Enhancement=globalThis.LuminousEquipmentEnhancementContract;
const Armor=globalThis.LuminousArmorCompositionEngine;
const Weapons=globalThis.LuminousWeaponCatalog;
const WeaponComposition=globalThis.LuminousWeaponCompositionEngine;
const Shields=globalThis.LuminousShieldCompositionEngine;

assert.ok(Enhancement&&Armor&&Weapons&&WeaponComposition&&Shields);
assert.strictEqual(Enhancement.VERSION,2);
assert.deepStrictEqual(Enhancement.ENCHANTMENT_LEVELS,[1,2,3]);
assert.ok(Enhancement.ELIGIBLE_KINDS.includes("accessory"));
assert.ok(Enhancement.ELIGIBLE_KINDS.includes("valuable"));
assert.strictEqual(Enhancement.validate({itemType:"accessory",enhancementLevel:1,enhancementSource:"enchantment"}).valid,true);
assert.strictEqual(Enhancement.validate({itemType:"valuable",enhancementLevel:2,enhancementSource:"enchantment"}).valid,true);
assert.strictEqual(Enhancement.validate({itemType:"weapon",enhancementLevel:-1}).valid,false);
assert.strictEqual(Enhancement.validate({itemType:"armor",enhancementLevel:-3}).reason,"negative_enhancement_forbidden");
assert.strictEqual(Enhancement.validate({itemType:"shield",enhancementLevel:4}).valid,false);
assert.deepStrictEqual(Enhancement.validate({itemType:"weapon"}),{valid:true,kind:"weapon",level:0,source:"mundane",suffix:""});
assert.strictEqual(Enhancement.validate({itemType:"armor",enhancementLevel:1,enhancementSource:"mundane"}).valid,false);
assert.strictEqual(Enhancement.validate({itemType:"armor",enhancementLevel:1,enhancementSource:"enchantment"}).valid,true);
assert.strictEqual(Enhancement.displayName({itemType:"shield",name:"Hardened Steel Tower Shield",enhancementLevel:3,enhancementSource:"enchantment"}),"Hardened Steel Tower Shield +3");

const plate=Armor.resolvePreset("plate_armor",{
  armor_plate:{body:"hardened_steel"},armor_reinforcement:{body:"hardened_steel"}
},{armorGrade:3,craftResult:24});
assert.strictEqual(Object.prototype.hasOwnProperty.call(plate,"armorGrade"),false);
assert.deepStrictEqual(plate.physicalResistanceProfile,{slash:0.65,pierce:0.85,blunt:1.35});

assert.strictEqual(typeof Weapons.damageMultiplierForQuality,"undefined");
assert.strictEqual("damageMultiplier" in Weapons.getQuality("exceptional"),false);
assert.strictEqual("durabilityMultiplier" in Weapons.getQuality("exceptional"),false);
assert.strictEqual(Weapons.maxDurability("longsword",1,"ruined"),50);
assert.strictEqual(Weapons.maxDurability("longsword",1,"exceptional"),50);

const longsword=WeaponComposition.referenceBuild("longsword");
assert.strictEqual(Object.prototype.hasOwnProperty.call(longsword,"weaponGrade"),false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(longsword,"enhancementLevel"),false);

const tower=Shields.resolveReferenceShield("shield_tower");
assert.strictEqual(Object.prototype.hasOwnProperty.call(tower,"shieldGrade"),false);
assert.strictEqual(Object.prototype.hasOwnProperty.call(tower,"enhancementLevel"),false);

console.log("Universal equipment Enhancement contract smoke: OK");
