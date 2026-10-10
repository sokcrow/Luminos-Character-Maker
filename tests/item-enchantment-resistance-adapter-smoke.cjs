"use strict";
const assert=require("assert");
require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-magic-runtime.js");
const Catalog=globalThis.LuminousEnchantmentCatalog;
const Magic=globalThis.LuminousItemMagicRuntime;
const engine=globalThis.LuminousItemEnchantmentEngine;
assert.strictEqual(Catalog.validateEffect({type:"resistance_multiplier_reduction",trigger:"passive",
  axis:"physical",damageType:"slash",value:0.15}).valid,true);
assert.strictEqual(Catalog.validateEffect({type:"resistance_multiplier_reduction",trigger:"passive",
  damageType:"slash",value:0.15}).valid,false);

const a={instanceId:"a",magic:{enabled:true,magicalDurability:{current:10,max:10}}};
const b={instanceId:"b",magic:{enabled:true,magicalDurability:{current:10,max:10}}};
a.mockEffects=[
  {type:"resistance_multiplier_reduction",axis:"physical",damageType:"slash",value:0.06},
  {type:"resistance_multiplier_reduction",axis:"sin",damageType:"wrath",value:0.09},
];
b.mockEffects=[
  {type:"resistance_multiplier_reduction",axis:"physical",damageType:"slash",value:0.15},
];
const original=globalThis.LuminousItemEnchantmentEngine;
globalThis.LuminousItemEnchantmentEngine={
  ...engine,
  resolveEffectsForAction(item,options){
    return {resolved:true,effects:options.trigger==="passive" ? item.mockEffects||[] : []};
  },
};
let observed=null;
globalThis.CombatEngine={
  calculateCoinDamage(attacker,defender){
    observed={phys: defender.physRes,sin:defender.sinRes};
    return Math.floor(100*defender.physRes);
  },
};
require("../js/item-enchantment-combat-runtime.js");
const bridge=globalThis.LuminousItemEnchantmentCombatRuntime;
assert.strictEqual(bridge.patchCombatEngine(globalThis.CombatEngine).installed,true);
try {
  const defender={hp:100,physRes:1,sinRes:1,equipment:{armor:a,shield:b}};
  const skill={attackType:"Slash",sinAffinity:"Wrath",skillRange:1};
  const result=globalThis.CombatEngine.calculateCoinDamage({hp:100},defender,skill,10,false,0,{});
  assert.strictEqual(result,85,"the 0.15 slash reduction overrides 0.06; do not sum");
  assert.ok(Math.abs(observed.phys-0.85)<1e-10);
  assert.ok(Math.abs(observed.sin-0.91)<1e-10,"SIN has an independent limit and matching affinity");
  assert.strictEqual(defender.physRes,1,"combat adapter cannot persist a temporary defensive state");
  assert.strictEqual(defender.sinRes,1);
  const before=[a.magic.magicalDurability.current,b.magic.magicalDurability.current];
  assert.deepStrictEqual(before,[10,10],"continuous passive inspection does not generate wear");
  defender.physRes=0.35;
  globalThis.CombatEngine.calculateCoinDamage({hp:100},defender,skill,10,false,0,{});
  assert.strictEqual(observed.phys,0.30,"the approved physical multiplier floor is 0.30");
  defender.isStaggered=true;
  globalThis.CombatEngine.calculateCoinDamage({hp:100},defender,skill,10,false,0,{});
  assert.strictEqual(observed.phys,0.35,"Stagger's physical override remains canonical");
} finally {
  globalThis.LuminousItemEnchantmentEngine=original;
  bridge.uninstallCombatEngine(globalThis.CombatEngine);
}
console.log("Enchanter physical/SIN resistance adapter: OK");
