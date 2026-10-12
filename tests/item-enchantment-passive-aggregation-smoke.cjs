"use strict";
const assert=require("assert");
require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-magic-runtime.js");
const Magic=globalThis.LuminousItemMagicRuntime;
const original=globalThis.LuminousItemEnchantmentEngine;

const a={instanceId:"a",magic:{enabled:true,magicalDurability:{current:20,max:20}}};
const b={instanceId:"b",magic:{enabled:true,magicalDurability:{current:20,max:20}}};
const c={instanceId:"c",magic:{enabled:true,magicalDurability:{current:20,max:20}}};
a.mockEffects=[
  {type:"defense_percent",value:10,stacking:"highest"},
  {type:"resistance_percent",axis:"slash",value:0.09,stacking:"highest"},
  {type:"item_stat_flat",stat:"strength",value:1,stacking:"additive"},
];
b.mockEffects=[
  {type:"defense_percent",value:15,stacking:"highest"},
  {type:"resistance_percent",axis:"pierce",value:0.15,stacking:"highest"},
  {type:"item_stat_flat",stat:"strength",value:2,stacking:"additive"},
];
c.mockEffects=[
  {type:"resistance_percent",axis:"slash",value:0.06,stacking:"highest"},
  {type:"speed_percent",value:10,stacking:"multiplicative"},
  {type:"speed_percent",value:20,stacking:"multiplicative"},
];
globalThis.LuminousItemEnchantmentEngine={
  ...original,
  resolveEffectsForAction(item,context){
    return {resolved:true,effects:context.trigger==="passive" ? item.mockEffects || [] : []};
  },
};
try {
  const user={hp:25,equipment:{mainHand:a,offHand:b,armor:c,accessories:[a]}};
  const before=[a,b,c].map(item=>item.magic.magicalDurability.current);
  const result=Magic.aggregateEquippedPassiveModifiers(user);
  assert.strictEqual(result.items.length,3,"one Item instance can only contribute once");
  assert.strictEqual(result.modifiers.defense_percent,15,"highest-only defense must not sum across equipment");
  assert.strictEqual(result.modifiers["resistance_percent:slash"],0.09,"the largest slash reduction wins");
  assert.strictEqual(result.modifiers["resistance_percent:pierce"],0.15,"other resistance axes remain separate");
  assert.strictEqual(result.modifiers["item_stat_flat:strength"],3,"additive strength benefits sum");
  assert.strictEqual(Math.round(result.modifiers.speed_percent),32,
    "explicitly multiplicative 10% and 20% compose to 32%");
  assert.deepStrictEqual([a,b,c].map(item=>item.magic.magicalDurability.current),before,
    "inspecting passive modifiers must never consume magical durability");
} finally {
  globalThis.LuminousItemEnchantmentEngine=original;
}
console.log("Enchantment passive aggregation across equipment: OK");
