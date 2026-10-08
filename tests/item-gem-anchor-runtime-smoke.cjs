"use strict";

const assert = require("assert");

require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-persistence-runtime.js");

const Engine = globalThis.LuminousItemEnchantmentEngine;
const Inventory = globalThis.LuminousItemInventoryRuntime;
const Persistence = globalThis.LuminousItemPersistenceRuntime;

assert.ok(Engine && Inventory && Persistence);
assert.strictEqual(Engine.VERSION, 8);
assert.strictEqual(Engine.GEM_SOCKET_HARD_MAX, 3);

const weapon = {
  schemaVersion: Inventory.schemaVersion,
  instanceId:"gem_weapon",
  definitionId:"gem_weapon",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:100,
  condition:100,
  stackable:false,
};

function gem(instanceId, definitionId, quality) {
  return {
    schemaVersion: Inventory.schemaVersion,
    instanceId,
    definitionId,
    itemId:definitionId,
    quality,
    itemType:"material",
    category:"ingredient",
  };
}

const rubyFine = gem("ruby_fine_1","ruby","fine");
const sapphireFine = gem("sapphire_fine_1","sapphire","fine");
const topazFine = gem("topaz_fine_1","topaz","fine");
const diamondExceptional = gem("diamond_exceptional_1","diamond","exceptional");

const first = Engine.mountGemAnchor(weapon, rubyFine, "flamebound", 2);
assert.strictEqual(first.mounted, true);
assert.strictEqual(first.item.magic.enchantmentSlots.used, 0, "Gem Enchantments do not consume direct Base Enchantment Slots");
assert.deepStrictEqual(first.item.magic.gemSockets, {max:3,used:1});
assert.strictEqual(first.item.magic.gemAnchors.length, 1);
assert.strictEqual(first.item.magic.gemAnchors[0].gemDefinitionId, "ruby");
assert.strictEqual(first.item.magic.gemAnchors[0].gemInstanceId, "ruby_fine_1");
assert.strictEqual(first.item.magic.gemAnchors[0].enchantmentDefinitionId, "flamebound");
assert.strictEqual(first.item.magic.gemAnchors[0].rank, 2);
assert.strictEqual(first.item.magic.gemAnchors[0].state, "stable");
assert.strictEqual(first.item.magic.enchantments[0].source, "gem");
assert.strictEqual(first.item.magic.enchantments[0].anchorId, first.item.magic.gemAnchors[0].anchorId);

const second = Engine.mountGemAnchor(first.item, sapphireFine, "frostbound", 2);
assert.strictEqual(second.mounted, true);
const gemChannelUnresolved = Engine.resolveEffectsForAction(second.item);
assert.strictEqual(gemChannelUnresolved.resolved, false, "Gem-Anchored Fire/Frost still require per-action channel choice");
assert.deepStrictEqual(gemChannelUnresolved.unresolvedChannels, ["elemental_weapon"]);
const gemFireChosen = Engine.resolveEffectsForAction(second.item, {selectedChannels:{elemental_weapon:"flamebound"}});
assert.strictEqual(gemFireChosen.resolved, true);
assert.strictEqual(gemFireChosen.effects.length, 1);
assert.strictEqual(gemFireChosen.effects[0].sourceEnchantmentId, "flamebound");
const third = Engine.mountGemAnchor(second.item, topazFine, "stormbound", 2);
assert.strictEqual(third.mounted, true);
assert.deepStrictEqual(third.item.magic.gemSockets, {max:3,used:3});
assert.strictEqual(third.item.magic.gemAnchors.length, 3);
assert.strictEqual(third.item.magic.enchantments.filter((entry) => entry.source === "gem").length, 3);

const tripleValidation = Engine.validateGemSocketLoadout(third.item);
assert.strictEqual(tripleValidation.valid, true, "three Rank II Gem Anchors are legal");

const blockedFourth = Engine.mountGemAnchor(third.item, diamondExceptional, "flamebound", 1);
assert.strictEqual(blockedFourth.mounted, false);
assert.strictEqual(blockedFourth.reason, "gem_socket_capacity_exceeded");
assert.strictEqual(blockedFourth.catastrophicAvailable, true);
assert.strictEqual(third.item.destroyed, undefined, "normal UI-safe attempt must not destroy the Item");

const catastrophe = Engine.mountGemAnchor(third.item, diamondExceptional, "flamebound", 1, {forceFourth:true});
assert.strictEqual(catastrophe.catastrophic, true);
assert.strictEqual(catastrophe.destroyedItem, true);
assert.strictEqual(catastrophe.reason, "forced_fourth_gem_catastrophe");
assert.strictEqual(catastrophe.item.destroyed, true);
assert.strictEqual(catastrophe.item.condition, 0);
assert.strictEqual(catastrophe.item.magic.enabled, false);
assert.deepStrictEqual(catastrophe.item.magic.gemSockets, {max:3,used:0});
assert.deepStrictEqual(catastrophe.item.magic.gemAnchors, []);
assert.deepStrictEqual(catastrophe.item.magic.enchantments, []);
assert.strictEqual(catastrophe.destroyedAnchors.length, 3);
assert.strictEqual(catastrophe.survivingGem.instanceId, "diamond_exceptional_1");

const rankThreeWeapon = {
  ...weapon,
  instanceId:"rank_three_weapon",
};
const rankThree = Engine.mountGemAnchor(
  rankThreeWeapon,
  gem("ruby_exceptional_1","ruby","exceptional"),
  "flamebound",
  3
);
assert.strictEqual(rankThree.mounted, true);
assert.strictEqual(rankThree.item.magic.gemSockets.used, 1);

const lowerAfterThree = Engine.mountGemAnchor(
  rankThree.item,
  gem("sapphire_standard_1","sapphire","standard"),
  "frostbound",
  1
);
assert.strictEqual(lowerAfterThree.mounted, false);
assert.strictEqual(lowerAfterThree.reason, "rank_three_gem_anchor_exclusive", "Rank III Gem Enchantment is exclusive of other Gem Anchors");

const lowerFirst = Engine.mountGemAnchor(
  {...weapon, instanceId:"lower_then_three"},
  gem("sapphire_standard_2","sapphire","standard"),
  "frostbound",
  1
);
assert.strictEqual(lowerFirst.mounted, true);
const threeAfterLower = Engine.mountGemAnchor(
  lowerFirst.item,
  gem("ruby_exceptional_2","ruby","exceptional"),
  "flamebound",
  3
);
assert.strictEqual(threeAfterLower.mounted, false);
assert.strictEqual(threeAfterLower.reason, "rank_three_gem_anchor_exclusive");

const unstable = Engine.mountGemAnchor(
  {...weapon, instanceId:"unstable_weapon"},
  gem("ruby_poor_1","ruby","poor"),
  "flamebound",
  1
);
assert.strictEqual(unstable.mounted, true);
assert.strictEqual(unstable.anchor.state, "unstable");

const overchannelBase = Engine.mountGemAnchor(
  {...weapon, instanceId:"overchannel_weapon"},
  gem("ruby_standard_1","ruby","standard"),
  "flamebound",
  1
);
assert.strictEqual(overchannelBase.mounted, true);
const overchannelStrengthen = Engine.strengthenEnchantment(overchannelBase.item, "flamebound", 2);
assert.strictEqual(overchannelStrengthen.strengthened, true);
assert.strictEqual(overchannelStrengthen.item.magic.gemAnchors[0].rank, 2);
assert.strictEqual(overchannelStrengthen.item.magic.gemAnchors[0].overchannel, true);
assert.strictEqual(overchannelStrengthen.item.magic.gemAnchors[0].state, "unstable");

const anchorId = first.item.magic.gemAnchors[0].anchorId;
const broken = Engine.setGemAnchorState(first.item, anchorId, "broken");
assert.strictEqual(broken.changed, true);
assert.strictEqual(broken.anchor.state, "broken");
assert.strictEqual(broken.reference.dormant, true);
assert.strictEqual(Engine.resolvedEnchantments(broken.item).length, 0, "broken Anchor makes its Enchantment Dormant");
assert.strictEqual(Engine.resolvedEnchantments(broken.item, {includeDormant:true}).length, 1);

const restored = Engine.setGemAnchorState(broken.item, anchorId, "stable");
assert.strictEqual(restored.changed, true);
assert.strictEqual(restored.reference.dormant, false);
assert.strictEqual(Engine.resolvedEnchantments(restored.item).length, 1);

const depleted = Engine.setGemAnchorState(first.item, anchorId, "depleted");
assert.strictEqual(depleted.changed, true);
assert.strictEqual(depleted.reference.dormant, true);

const safeRemovalBlocked = Engine.removeEnchantment(first.item, "flamebound");
assert.strictEqual(safeRemovalBlocked.removed, false);
assert.strictEqual(safeRemovalBlocked.reason, "gem_anchored_enchantment_requires_anchor_procedure", "generic removal must not silently delete an anchored Enchantment");

const tamperedRefs = JSON.parse(JSON.stringify(first.item.magic.enchantments));
tamperedRefs.push({...tamperedRefs[0]});
const duplicateAnchorValidation = Engine.validateGemSocketLoadout(first.item, tamperedRefs, first.item.magic.gemAnchors);
assert.strictEqual(duplicateAnchorValidation.valid, false);
assert.ok(duplicateAnchorValidation.errors.includes("multiple_enchantments_same_gem_anchor"));

const twoSocketWeapon = {
  ...weapon,
  instanceId:"two_socket_weapon",
  magic:{gemSockets:{max:2,used:0},gemAnchors:[],enchantments:[]},
};
const twoA = Engine.mountGemAnchor(twoSocketWeapon, rubyFine, "flamebound", 2);
const twoB = Engine.mountGemAnchor(twoA.item, sapphireFine, "frostbound", 2);
assert.strictEqual(twoB.mounted, true);
const twoBlocked = Engine.mountGemAnchor(twoB.item, topazFine, "stormbound", 2);
assert.strictEqual(twoBlocked.mounted, false);
assert.strictEqual(twoBlocked.reason, "gem_socket_capacity_exceeded");
assert.strictEqual(twoBlocked.catastrophicAvailable, false, "a lower chassis cap blocks safely before the hard-fourth-gem catastrophe");

const jewelry = {
  instanceId:"decorative_jewelry",
  definitionId:"decorative_jewelry",
  itemType:"accessory",
  category:"accessory",
  tier:5,
  composition:[{materialId:"ruby",role:"mounted_decorative_gem"}],
};
assert.strictEqual(Engine.gemAnchors(jewelry).length, 0, "mundane/decorative composition is not an Enchantment Gem Anchor");
assert.deepStrictEqual(Engine.validateGemSocketLoadout(jewelry).sockets, {used:0,max:3});

const persistent = Inventory.serializeItemInstance({
  ...third.item,
  schemaVersion:Inventory.schemaVersion,
  instanceId:"persistent_gem_weapon",
  definitionId:"persistent_gem_weapon",
});
assert.strictEqual(persistent.magic.gemAnchors.length, 3);
assert.strictEqual(persistent.magic.enchantments.length, 3);

const state = {
  inventario_activo:{persistent_gem_weapon:persistent},
  inventario_stash:{},
  equipmentRefs:{mainHand:"persistent_gem_weapon",accessoryIds:[]},
  attunedItemInstanceIds:["persistent_gem_weapon"],
  schemaVersion:Persistence.schemaVersion,
};
const restoredState = Persistence.deserializeInventoryState(state);
assert.strictEqual(restoredState.inventario_activo.persistent_gem_weapon.magic.gemAnchors.length, 3);
assert.deepStrictEqual(
  restoredState.inventario_activo.persistent_gem_weapon.magic.gemAnchors,
  persistent.magic.gemAnchors,
  "Gem Anchor identity must survive save/load"
);

const target={inventario_activo:{},inventario_stash:{},equipment:{accessories:[]}};
Persistence.applyInventoryState(target,state);
assert.strictEqual(target.equipment.mainHand.magic.gemAnchors.length,3,"equipped Item keeps mounted Gem Anchors");
Inventory.transferOwnership(target.equipment.mainHand,"owner_b");
assert.strictEqual(target.equipment.mainHand.magic.gemAnchors.length,3,"ownership transfer keeps mounted Gem Anchors");

console.log("Gem Anchor + Gem Socket runtime smoke: OK");
