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
assert.strictEqual(Engine.VERSION,8);
assert.strictEqual(Services.VERSION,3);

const weapon={
  instanceId:"player_enchant_weapon",
  definitionId:"player_enchant_weapon",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:60,
  condition:60,
};

const exact=Services.resolvePlayerControlCheck(weapon,"flamebound",1,{roll:17,arcanaModifier:5});
assert.strictEqual(exact.resolved,true);
assert.strictEqual(exact.threshold,22);
assert.strictEqual(exact.total,22);
assert.strictEqual(exact.margin,0);
assert.strictEqual(exact.band,"controlled");

const controlled=Services.attemptPlayerEnchant(
  {...weapon,instanceId:"controlled_weapon"},
  "flamebound",
  1,
  {roll:17,arcanaModifier:5}
);
assert.strictEqual(controlled.attempted,true);
assert.strictEqual(controlled.controlled,true);
assert.strictEqual(controlled.result.applied,true);
assert.strictEqual(controlled.item.magic.enchantments[0].definitionId,"flamebound");
assert.strictEqual(controlled.item.magic.magicalDurability.max,30);

const minor=Services.attemptPlayerEnchant(
  {...weapon,instanceId:"minor_weapon"},
  "flamebound",
  1,
  {
    roll:15,
    arcanaModifier:5,
    deviationRoll:0,
    outcomePools:{
      minor_deviation:[
        {kind:"alternate_enchantment",weight:1,alternateEnchantmentId:"frostbound"},
      ],
    },
  }
);
assert.strictEqual(minor.attempted,true);
assert.strictEqual(minor.controlled,false);
assert.strictEqual(minor.band,"minor_deviation");
assert.strictEqual(minor.check.margin,-2);
assert.strictEqual(minor.resolved,true);
assert.strictEqual(minor.item.magic.enchantments[0].definitionId,"frostbound","minor deviation may produce an authored alternate Enchantment instead of a binary failure");

const baseRankOne=Engine.applyEnchantment(
  {...weapon,instanceId:"strengthen_weapon"},
  "flamebound",
  1
);
assert.strictEqual(baseRankOne.applied,true);
const major=Services.attemptPlayerStrengthen(
  baseRankOne.item,
  "flamebound",
  2,
  {
    roll:18,
    arcanaModifier:5,
    deviationRoll:0,
    outcomePools:{
      major_deviation:[
        {kind:"magical_durability_damage",weight:1,amount:5},
      ],
    },
  }
);
assert.strictEqual(major.attempted,true);
assert.strictEqual(major.controlled,false);
assert.strictEqual(major.band,"major_deviation");
assert.strictEqual(major.check.threshold,28);
assert.strictEqual(major.check.margin,-5);
assert.strictEqual(major.resolved,true);
assert.strictEqual(major.item.magic.enchantments[0].rank,1,"altered strengthening does not silently grant the intended Rank");
assert.strictEqual(major.item.magic.magicalDurability.current,25);
assert.strictEqual(major.item.condition,60,"magical deviation damage does not silently hit Physical Durability");

const cursedDeviation=Services.attemptPlayerStrengthen(
  baseRankOne.item,
  "flamebound",
  2,
  {
    roll:18,
    arcanaModifier:5,
    deviationRoll:0,
    outcomePools:{
      major_deviation:[
        {kind:"accidental_curse",weight:1},
      ],
    },
  }
);
assert.strictEqual(cursedDeviation.resolved,true);
assert.deepStrictEqual(cursedDeviation.item.magic.enchantments[0].properties,["curse"],"Curse appears only because the authored outcome requested it");

const noAuthoredBacklash=Services.attemptPlayerStrengthen(
  baseRankOne.item,
  "flamebound",
  2,
  {roll:1,arcanaModifier:0}
);
assert.strictEqual(noAuthoredBacklash.attempted,true);
assert.strictEqual(noAuthoredBacklash.band,"arcane_backlash");
assert.strictEqual(noAuthoredBacklash.resolved,false);
assert.strictEqual(noAuthoredBacklash.reason,"authored_deviation_outcome_required");
assert.deepStrictEqual(noAuthoredBacklash.item.magic.enchantments[0].properties,[],"Arcane Backlash does not automatically invent a Curse");

const gemItem=Engine.mountGemAnchor(
  {...weapon,instanceId:"gem_backlash_weapon"},
  {instanceId:"ruby_backlash",definitionId:"ruby",quality:"fine"},
  "flamebound",
  1
);
assert.strictEqual(gemItem.mounted,true);
const gemBacklash=Services.attemptPlayerStrengthen(
  gemItem.item,
  "flamebound",
  2,
  {
    roll:10,
    arcanaModifier:5,
    deviationRoll:0,
    outcomePools:{
      arcane_backlash:[
        {kind:"anchor_broken",weight:1},
      ],
    },
  }
);
assert.strictEqual(gemBacklash.attempted,true);
assert.strictEqual(gemBacklash.check.threshold,24,"Fine Ruby plus existing same-family specialization stabilizes Rank II from TH28 to TH24");
assert.strictEqual(gemBacklash.check.margin,-9);
assert.strictEqual(gemBacklash.band,"arcane_backlash");
assert.strictEqual(gemBacklash.resolved,true);
assert.strictEqual(gemBacklash.item.magic.gemAnchors[0].state,"broken");
assert.strictEqual(gemBacklash.item.magic.enchantments[0].dormant,true);
assert.deepStrictEqual(gemBacklash.item.magic.enchantments[0].properties,[],"broken Anchor backlash still does not imply Curse");

const ritualDef={
  ...globalThis.LuminousEnchantmentCatalog.get("flamebound"),
  id:"player_ritual_material_test",
  recipe:{
    requiredTags:["enchantment_material"],
    consumedRequirements:[
      {id:"powder",anyTags:["arcane_reagent"],quantity:2},
    ],
    exactItemRequirements:[],
    outcomes:{allowAccidentalBind:false,allowAccidentalCurse:false},
  },
};
const powder={instanceId:"powder_stack",definitionId:"powder",quantity:2,reagentTags:["arcane_reagent"]};
const alteredWithMaterials=Services.attemptPlayerEnchant(
  {...weapon,instanceId:"material_attempt_weapon"},
  ritualDef,
  1,
  {
    roll:15,
    arcanaModifier:5,
    materials:[powder],
    deviationRoll:0,
    outcomePools:{minor_deviation:[{kind:"abstract_only",weight:1}]},
  }
);
assert.strictEqual(alteredWithMaterials.attempted,true);
assert.strictEqual(alteredWithMaterials.controlled,false);
assert.strictEqual(alteredWithMaterials.materials.consumed,true);
assert.strictEqual(powder.quantity,0,"ritual materials are spent when the attempt begins even if the result deviates");

console.log("Player enchant control/deviation smoke: OK");
