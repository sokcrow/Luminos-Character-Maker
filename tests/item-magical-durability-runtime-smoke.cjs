"use strict";

const assert = require("assert");

require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-magic-runtime.js");

const Catalog = globalThis.LuminousEnchantmentCatalog;
const Engine = globalThis.LuminousItemEnchantmentEngine;
const Inventory = globalThis.LuminousItemInventoryRuntime;
const Magic = globalThis.LuminousItemMagicRuntime;

assert.ok(Catalog && Engine && Inventory && Magic);
assert.strictEqual(Catalog.VERSION, 4);
assert.strictEqual(Engine.VERSION,9);
assert.strictEqual(Magic.VERSION, 3);

const baseWeapon = {
  instanceId:"md_weapon",
  definitionId:"md_weapon",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:100,
  condition:73,
  stackable:false,
};

const direct = Engine.applyEnchantment(baseWeapon, "flamebound", 1);
assert.strictEqual(direct.applied, true);
assert.deepStrictEqual(direct.item.magic.magicalDurability, {
  max:50,
  current:50,
  depleted:false,
  autoManaged:true,
  profile:"direct",
  physicalDurabilityMax:100,
  physicalRatio:0.5,
});
assert.strictEqual(direct.item.condition, 73, "Enchanting does not divide or reduce Physical Durability");

const gemmed = Engine.mountGemAnchor(
  {...baseWeapon,instanceId:"md_gem_weapon"},
  {instanceId:"ruby_md",definitionId:"ruby",quality:"fine"},
  "flamebound",
  1
);
assert.strictEqual(gemmed.mounted, true);
assert.deepStrictEqual(gemmed.item.magic.magicalDurability, {
  max:75,
  current:75,
  depleted:false,
  autoManaged:true,
  profile:"gem_anchored",
  physicalDurabilityMax:100,
  physicalRatio:0.75,
});
assert.strictEqual(gemmed.item.condition, 73);

const sixtyPhysical = {
  ...baseWeapon,
  instanceId:"sixty_physical",
  conditionMax:60,
  condition:60,
};
const sixtyDirect = Engine.applyEnchantment(sixtyPhysical,"flamebound",1);
assert.strictEqual(sixtyDirect.item.magic.magicalDurability.max,30,"direct magic scales to 50% of Physical Durability Max");
const sixtyGem = Engine.mountGemAnchor(
  {...sixtyPhysical,instanceId:"sixty_gem"},
  {instanceId:"ruby_sixty",definitionId:"ruby",quality:"fine"},
  "flamebound",
  1
);
assert.strictEqual(sixtyGem.item.magic.magicalDurability.max,45,"Gem-Anchored magic scales to 75% of Physical Durability Max");
const oddPhysical = Engine.applyEnchantment({...baseWeapon,instanceId:"odd_physical",conditionMax:37,condition:37},"flamebound",1);
assert.strictEqual(oddPhysical.item.magic.magicalDurability.max,19,"proportional Magical Durability rounds to the nearest whole point");

const authoredDurabilityItem = {
  ...baseWeapon,
  instanceId:"authored_md",
  magic:{
    magicalDurability:{max:80,current:61,authored:true,profile:"relic_authored"},
  },
};
const authored = Engine.applyEnchantment(authoredDurabilityItem, "flamebound", 1);
assert.strictEqual(authored.applied, true);
assert.strictEqual(authored.item.magic.magicalDurability.max, 80);
assert.strictEqual(authored.item.magic.magicalDurability.current, 61);
assert.strictEqual(authored.item.magic.magicalDurability.autoManaged, false);

const silverOnly = {
  ...Catalog.get("flamebound"),
  id:"silver_test",
  compatibility:{
    ...Catalog.get("flamebound").compatibility,
    materialTags:["silver"],
  },
};
const compatibleMaterial = Engine.materialCompatibility({materialId:"silver"}, silverOnly);
assert.strictEqual(compatibleMaterial.compatible, true);
assert.strictEqual(compatibleMaterial.wearMultiplier, 1);
const incompatibleMaterial = Engine.materialCompatibility({materialId:"iron"}, silverOnly);
assert.strictEqual(incompatibleMaterial.compatible, false);
assert.strictEqual(incompatibleMaterial.wearMultiplier, 2);

const rankOneUser = {id:"rank_one_user"};
const onSkill = Magic.enchantmentEffectResolution(rankOneUser, direct.item, {trigger:"on_skill"});
assert.strictEqual(onSkill.resolved, true);
assert.strictEqual(onSkill.effects.length, 1);
assert.strictEqual(onSkill.effects[0].type, "damage_percent");
assert.strictEqual(onSkill.effects[0].value, 10);
assert.strictEqual(onSkill.effects[0].sourceMagicalWear, 1);

const wrongTrigger = Magic.enchantmentEffectResolution(rankOneUser, direct.item, {trigger:"passive"});
assert.strictEqual(wrongTrigger.resolved, true);
assert.strictEqual(wrongTrigger.effects.length, 0);

const rankTwo = Engine.applyEnchantment(
  {...baseWeapon,instanceId:"rank_two_md"},
  "flamebound",
  2
);
assert.strictEqual(rankTwo.applied, true);
const attuneUser = {id:"attune_user"};
const mutableRankTwo = JSON.parse(JSON.stringify(rankTwo.item));
const suppressed = Magic.enchantmentEffectResolution(attuneUser, mutableRankTwo, {trigger:"on_skill"});
assert.strictEqual(suppressed.resolved, false);
assert.strictEqual(suppressed.suppressed, true);
assert.strictEqual(suppressed.reason, "item_not_attuned");
assert.strictEqual(Magic.attuneItem(attuneUser, mutableRankTwo).attuned, true);
const activeRankTwo = Magic.enchantmentEffectResolution(attuneUser, mutableRankTwo, {trigger:"on_skill"});
assert.strictEqual(activeRankTwo.resolved, true);
assert.strictEqual(activeRankTwo.effects[0].value, 15);

const wearItem = JSON.parse(JSON.stringify(direct.item));
const wearResolution = Magic.enchantmentEffectResolution(rankOneUser, wearItem, {trigger:"on_skill"});
const wear = Magic.spendResolvedEnchantmentWear(wearItem, wearResolution);
assert.strictEqual(wear.spent, true);
assert.strictEqual(wear.amount, 1);
assert.strictEqual(Magic.magicalDurabilityState(wearItem).current, 49);
assert.strictEqual(wearItem.condition, 73, "Magical wear does not silently damage Physical Durability");

const doubled = Magic.spendMagicalDurability(wearItem, 2, {wearMultiplier:2});
assert.strictEqual(doubled.spent, true);
assert.strictEqual(doubled.amount, 4);
assert.strictEqual(Magic.magicalDurabilityState(wearItem).current, 45);

Magic.setMagicalDurability(wearItem, 0, 100, {autoManaged:true,profile:"direct"});
const depletedEffects = Magic.enchantmentEffectResolution(rankOneUser, wearItem, {trigger:"on_skill"});
assert.strictEqual(depletedEffects.resolved, false);
assert.strictEqual(depletedEffects.reason, "magical_durability_depleted");
assert.strictEqual(wearItem.condition, 73);

const bound = Engine.applyEnchantment(
  {...baseWeapon,instanceId:"bound_md"},
  "flamebound",
  1,
  {properties:["bind"]}
);
assert.strictEqual(bound.applied, true);
const boundItem = JSON.parse(JSON.stringify(bound.item));
const boundWear = Magic.spendMagicalDurability(boundItem, 10, {normalWear:true});
assert.strictEqual(boundWear.spent, true);
assert.strictEqual(boundWear.skipped, true);
assert.strictEqual(Magic.magicalDurabilityState(boundItem).current, 50);
Magic.setMagicalDurability(boundItem, 0, 100, {autoManaged:true,profile:"direct"});
assert.strictEqual(Magic.magicalPowerActive(boundItem), true, "Bound baseline magic persists at zero");
assert.strictEqual(Magic.magicalPowerActive(boundItem, {specialUse:true}), false, "Bound special powers still need authored resource");

const rechargeItem = JSON.parse(JSON.stringify(direct.item));
Magic.setMagicalDurability(rechargeItem, 40, 100, {autoManaged:true,profile:"direct"});
rechargeItem.magic.magicalRecharge = {trigger:"dawn",amount:15};
const rechargeMiss = Magic.processMagicalRecharge(rechargeItem, "short_rest");
assert.strictEqual(rechargeMiss.recharged, false);
assert.strictEqual(rechargeMiss.reason, "trigger_mismatch");
const recharge = Magic.processMagicalRecharge(rechargeItem, "dawn");
assert.strictEqual(recharge.recharged, true);
assert.strictEqual(Magic.magicalDurabilityState(rechargeItem).current, 55);

const boundRechargeItem = JSON.parse(JSON.stringify(bound.item));
boundRechargeItem.magic.boundRecharge = {hpCostPercent:10};
Magic.setMagicalDurability(boundRechargeItem, 0, 100, {autoManaged:true,profile:"direct"});
const lifeUser = {hp:50,maxHp:100};
const emergency = Magic.boundEmergencyRecharge(lifeUser, boundRechargeItem);
assert.strictEqual(emergency.recharged, true);
assert.strictEqual(emergency.hpCost, 10);
assert.strictEqual(lifeUser.hp, 40);
assert.strictEqual(Magic.magicalDurabilityState(boundRechargeItem).current, 100);

const persistentCurse = {
  instanceId:"persistent_curse",
  magic:{
    enabled:true,
    magicalDurability:{max:20,current:0,authored:true},
    curse:{kind:"curse",persistentAtZero:true},
  },
};
assert.strictEqual(Magic.isCursed(persistentCurse), true);
assert.strictEqual(Magic.cursePersistsAtZero(persistentCurse), true);
assert.strictEqual(Magic.magicalPowerActive(persistentCurse), true);

const native = {
  instanceId:"native_wondrous",
  itemType:"accessory",
  magic:{
    enabled:true,
    nativeMagic:true,
    origin:"native",
    spells:[],
  },
};
assert.strictEqual(Magic.isMagicItem(native), true);
assert.strictEqual(Magic.isNativeMagicItem(native), true);
assert.strictEqual(Magic.magicOrigin(native), "native");
assert.strictEqual(native.magic.enchantmentSlots, undefined, "Native Magic Items do not require Enchantment Slot semantics");

const mdSpellItem = {
  instanceId:"spell_staff",
  magic:{
    enabled:true,
    nativeMagic:true,
    magicalDurability:{max:10,current:10,authored:true},
    spells:[
      {spellId:"test_bolt",resource:"magical_durability",magicalDurabilityCost:3,chargeCost:0},
    ],
  },
};
const spellUser = {id:"spell_user",sp:5};
const mdCast = Magic.castSpellFromItem(spellUser, mdSpellItem, "test_bolt", {
  executeSpell:()=>({executed:true}),
});
assert.strictEqual(mdCast.cast, true);
assert.strictEqual(mdCast.resource, "magical_durability");
assert.strictEqual(Magic.magicalDurabilityState(mdSpellItem).current, 7);
assert.strictEqual(spellUser.sp, 5, "Item-paid Spell does not spend SP without an authored SP cost");

const spSpellItem = {
  instanceId:"sp_staff",
  magic:{
    enabled:true,
    nativeMagic:true,
    magicalDurability:{max:10,current:10,authored:true},
    spells:[
      {spellId:"costly_bolt",resource:"magical_durability",magicalDurabilityCost:2,spCost:2,chargeCost:0},
    ],
  },
};
const spUser = {id:"sp_user",sp:5};
assert.strictEqual(Magic.castSpellFromItem(spUser, spSpellItem, "costly_bolt", {executeSpell:()=>({executed:true})}).cast, true);
assert.strictEqual(spUser.sp, 3);

const conduit = {
  instanceId:"conduit_item",
  magic:{
    enabled:true,
    nativeMagic:true,
    magicalDurability:{max:10,current:10,authored:true},
    spells:[
      {spellId:"conduit_spell",usesWielderSpellSlot:true,chargeCost:5},
    ],
  },
};
const conduitUser = {id:"conduit_user",sp:5};
const conduitCast = Magic.castSpellFromItem(conduitUser, conduit, "conduit_spell", {executeSpell:(payload)=>{
  assert.strictEqual(payload.useWielderSpellSlot, true);
  return {executed:true};
}});
assert.strictEqual(conduitCast.cast, true);
assert.strictEqual(conduitCast.resource, "wielder_spell_slot");
assert.strictEqual(Magic.magicalDurabilityState(conduit).current, 10);

const mundaneDefense = Magic.applyNonMagicHitDefense(100, {reduceNonMagicHits:true}, {magicHit:false,delivery:"melee"});
assert.strictEqual(mundaneDefense.damage, 50);
assert.strictEqual(mundaneDefense.reason, "non_magic_hit_reduction");
const magicDefenseBypass = Magic.applyNonMagicHitDefense(100, {reduceNonMagicHits:true}, {magicHit:true,delivery:"melee"});
assert.strictEqual(magicDefenseBypass.damage, 100);
assert.strictEqual(magicDefenseBypass.bypassed, true);

const brokenPhysical = {conditionMax:100,condition:0};
assert.strictEqual(Inventory.getConditionState(brokenPhysical).id, "broken");
assert.strictEqual(brokenPhysical.destroyed, undefined, "0 Physical Durability means broken, not automatic annihilation");

globalThis.CombatEngine = {
  calculateCoinDamage(){ return 100; },
};
delete globalThis.LuminousItemEnchantmentCombatRuntime;
require("../js/item-enchantment-combat-runtime.js");
const CombatMagic = globalThis.LuminousItemEnchantmentCombatRuntime;
assert.ok(CombatMagic);
assert.strictEqual(CombatMagic.VERSION, 1);

const combatItem = JSON.parse(JSON.stringify(direct.item));
const attacker = {id:"combat_attacker",equipment:{mainHand:combatItem}};
const defender = {id:"combat_defender",reduceNonMagicHits:true};
const skill = {skillRange:1};
const context = {};
const firstDamage = globalThis.CombatEngine.calculateCoinDamage(attacker,defender,skill,10,false,0,context);
assert.strictEqual(firstDamage,55,"+10% Flamebound damage is then reduced by the authored Non-Magic Hit defense");
assert.strictEqual(Magic.magicalDurabilityState(combatItem).current,49);
const secondCoin = globalThis.CombatEngine.calculateCoinDamage(attacker,defender,skill,10,false,0,context);
assert.strictEqual(secondCoin,55);
assert.strictEqual(Magic.magicalDurabilityState(combatItem).current,49,"Magical wear is charged once per action context, not once per coin");

console.log("Magical Durability + activation/combat bridge smoke: OK");
