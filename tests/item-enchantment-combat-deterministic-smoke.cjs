"use strict";

const assert = require("assert");

require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-magic-runtime.js");

const Enchant = globalThis.LuminousItemEnchantmentEngine;
const Magic = globalThis.LuminousItemMagicRuntime;
assert.ok(Enchant && Magic);

const applied=Enchant.applyEnchantment({
  instanceId:"combat_smoke_blade",
  definitionId:"combat_smoke_blade",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:100,
  condition:100,
},"flamebound",1);
assert.strictEqual(applied.applied,true);
const blade=JSON.parse(JSON.stringify(applied.item));
const wielder={id:"combat_smoke_attacker",hp:100,equipment:{mainHand:blade,offHand:blade}};
const defender={id:"combat_smoke_defender"};
const skill={skillRange:1,attackType:"Slash",sinAffinity:"Wrath"};

globalThis.CombatEngine={calculateCoinDamage(){return 100;}};
require("../js/item-enchantment-combat-runtime.js");
const Combat=globalThis.LuminousItemEnchantmentCombatRuntime;
assert.ok(Combat && Combat.patchCombatEngine(globalThis.CombatEngine).installed);
assert.strictEqual(Combat.patchCombatEngine(globalThis.CombatEngine).alreadyInstalled,true,
  "the bridge must never double-patch one Battle Engine");

const skillContext={};
const firstCoin=globalThis.CombatEngine.calculateCoinDamage(wielder,defender,skill,10,false,0,skillContext);
assert.strictEqual(firstCoin,110,"Rank I Flamebound enhances the weapon Skill by +10%");
assert.strictEqual(Magic.magicalDurabilityState(blade).current,49);

const secondCoin=globalThis.CombatEngine.calculateCoinDamage(wielder,defender,skill,10,false,0,skillContext);
assert.strictEqual(secondCoin,110);
assert.strictEqual(Magic.magicalDurabilityState(blade).current,49,
  "a multi-Coin Skill spends wear once, not once per Coin");

const nextSkillContext={};
assert.strictEqual(globalThis.CombatEngine.calculateCoinDamage(wielder,defender,skill,10,false,0,nextSkillContext),110);
assert.strictEqual(Magic.magicalDurabilityState(blade).current,48,
  "a new Skill action has its own wear budget");

wielder.hp=0;
const invalidDead=globalThis.CombatEngine.calculateCoinDamage(wielder,defender,skill,10,false,0,{});
assert.strictEqual(invalidDead,100,"a defeated user must not emit enchanted damage");
assert.strictEqual(Magic.magicalDurabilityState(blade).current,48);
wielder.hp=100;

wielder.equipment={};
const unequipped=globalThis.CombatEngine.calculateCoinDamage(
  wielder,defender,{...skill,sourceItem:blade},10,false,0,{});
assert.strictEqual(unequipped,100,"an unequipped Item's explicit source must not emit active Enchantments");
assert.strictEqual(Magic.magicalDurabilityState(blade).current,48);
wielder.equipment={mainHand:blade};

const passiveBefore=Magic.magicalDurabilityState(blade).current;
Magic.passiveEnchantmentModifiers(wielder,blade);
assert.strictEqual(Magic.magicalDurabilityState(blade).current,passiveBefore,
  "passive inspection cannot create un-authored Magical Durability wear");

const nonMagicDefender={reduceNonMagicHits:true};
assert.strictEqual(globalThis.CombatEngine.calculateCoinDamage(
  wielder,nonMagicDefender,skill,10,false,0,{}),55,
  "non-Magic Hit defense still applies after an ordinary Damage Enchantment");

const finalPointWeapon=JSON.parse(JSON.stringify(applied.item));
finalPointWeapon.instanceId="last_point_weapon";
finalPointWeapon.magic.magicalDurability.current=1;
wielder.equipment={mainHand:finalPointWeapon};
const finalPointSkillContext={};
assert.strictEqual(globalThis.CombatEngine.calculateCoinDamage(
  wielder,defender,skill,10,false,0,finalPointSkillContext),110,
  "the first Coin of the Skill can use the final available Magical Durability point");
assert.strictEqual(Magic.magicalDurabilityState(finalPointWeapon).current,0);
assert.strictEqual(globalThis.CombatEngine.calculateCoinDamage(
  wielder,defender,skill,10,false,0,finalPointSkillContext),110,
  "the second Coin keeps the already-activated Enchantment even after MD hits zero");
assert.strictEqual(Magic.magicalDurabilityState(finalPointWeapon).current,0,
  "the final point cannot be spent a second time by the same Skill");
assert.strictEqual(globalThis.CombatEngine.calculateCoinDamage(
  wielder,defender,skill,10,false,0,{}),100,
  "a new Skill cannot activate depleted magic");
wielder.equipment={mainHand:blade};

blade.magic.magicalDurability.current=0;
blade.magic.magicalDurability.depleted=true;
assert.strictEqual(globalThis.CombatEngine.calculateCoinDamage(
  wielder,defender,skill,10,false,0,{}),100,
  "depleted Magical Durability disables the enchantment, not the weapon's physical damage");

assert.strictEqual(Combat.uninstallCombatEngine(globalThis.CombatEngine),true);
assert.strictEqual(globalThis.CombatEngine.calculateCoinDamage(wielder,defender,skill,10,false,0,{}),100);
console.log("Enchanter deterministic Skill/Multi-Coin suppression combat smoke: OK");
