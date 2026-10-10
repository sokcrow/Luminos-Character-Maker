"use strict";

const assert = require("assert");

require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");

const Catalog = globalThis.LuminousEnchantmentCatalog;
const Engine = globalThis.LuminousItemEnchantmentEngine;

assert.ok(Catalog && Engine);
assert.strictEqual(Catalog.VERSION,5);
assert.strictEqual(Engine.VERSION, 11);

assert.deepStrictEqual(Catalog.SUPPORTED_RANKS, [1,2,3]);
assert.deepStrictEqual(Catalog.BASE_SLOT_COST_BY_RANK, {1:1,2:2,3:3});
assert.deepStrictEqual(Catalog.TH_BY_RANK, {1:22,2:28,3:34});
assert.deepStrictEqual(Catalog.DAMAGE_PERCENT_BY_RANK, {1:10,2:15,3:25});
assert.deepStrictEqual(Catalog.SECONDARY_DAMAGE_PERCENT_BY_RANK, {1:4,2:8,3:18});

const flame = Catalog.get("flamebound");
const frost = Catalog.get("frostbound");
assert.ok(flame && frost);
assert.strictEqual(Catalog.validateDefinition(flame).valid, true);
assert.strictEqual(Catalog.validateDefinition(frost).valid, true);
assert.strictEqual(Catalog.resolveRank("flamebound", 3).effects[0].value, 25);
assert.strictEqual(flame.interaction.exclusiveChannel, "elemental_weapon");
assert.strictEqual(flame.interaction.exclusivePerAction, true);

const invalidEval = {
  id:"bad_enchantment",
  name:"Bad",
  eligibleItemKinds:["weapon"],
  allowedProperties:["curse"],
  interaction:{hardConflicts:[],exclusiveChannel:"",exclusivePerAction:false},
  rankData:{
    1:{
      slotCost:1,
      effects:[{type:"damage_percent",trigger:"on_hit",value:10,script:"doBadThings()"}]
    }
  }
};
const invalidEvalResult = Catalog.validateDefinition(invalidEval);
assert.strictEqual(invalidEvalResult.valid, false);
assert.ok(invalidEvalResult.errors.includes("executable_definition_payload_forbidden"));

const invalidType = {
  id:"bad_type",
  name:"Bad Type",
  eligibleItemKinds:["weapon"],
  allowedProperties:[],
  interaction:{hardConflicts:[],exclusiveChannel:"",exclusivePerAction:false},
  rankData:{1:{slotCost:1,effects:[{type:"arbitrary_eval",trigger:"passive"}]}}
};
assert.strictEqual(Catalog.validateDefinition(invalidType).valid, false);

assert.strictEqual(Engine.baseSlotCapacity({tier:1}), 0);
assert.strictEqual(Engine.baseSlotCapacity({tier:"II"}), 1);
assert.strictEqual(Engine.baseSlotCapacity({tier:3}), 1);
assert.strictEqual(Engine.baseSlotCapacity({tier:"IV"}), 2);
assert.strictEqual(Engine.baseSlotCapacity({tier:5}), 3);
assert.strictEqual(Engine.baseSlotCapacity({tier:6}), null);

const tierThreeWeapon = {
  definitionId:"test_blade",
  name:"Test Blade",
  itemType:"weapon",
  tier:3,
};
const flameI = Engine.applyEnchantment(tierThreeWeapon, "flamebound", 1);
assert.strictEqual(flameI.applied, true);
assert.strictEqual(flameI.item.magic.enabled, true);
assert.deepStrictEqual(flameI.item.magic.enchantmentSlots, {max:1,used:1});
assert.deepStrictEqual(flameI.item.magic.enchantments[0], {
  definitionId:"flamebound",
  rank:1,
  source:"direct",
  properties:[],
  anchorId:null,
  dormant:false,
  disabled:false,
});

const overCapacity = Engine.applyEnchantment(flameI.item, "frostbound", 1);
assert.strictEqual(overCapacity.applied, false);
assert.strictEqual(overCapacity.reason, "base_enchantment_slots_exceeded");

const tierFourWeapon = {
  definitionId:"test_blade_iv",
  name:"Test Blade IV",
  itemType:"weapon",
  tier:4,
};
const hybridA = Engine.applyEnchantment(tierFourWeapon, "flamebound", 1);
const hybridB = Engine.applyEnchantment(hybridA.item, "frostbound", 1);
assert.strictEqual(hybridB.applied, true);
assert.deepStrictEqual(hybridB.item.magic.enchantmentSlots, {max:2,used:2});

const channels = Engine.actionChannels(hybridB.item);
assert.strictEqual(channels.length, 1);
assert.strictEqual(channels[0].channel, "elemental_weapon");
assert.strictEqual(channels[0].requiresChoice, true);
assert.deepStrictEqual(channels[0].definitionIds, ["flamebound","frostbound"]);

const unresolved = Engine.resolveEffectsForAction(hybridB.item);
assert.strictEqual(unresolved.resolved, false);
assert.deepStrictEqual(unresolved.unresolvedChannels, ["elemental_weapon"]);
assert.strictEqual(unresolved.effects.length, 0);

const fireAction = Engine.resolveEffectsForAction(hybridB.item, {
  selectedChannels:{elemental_weapon:"flamebound"}
});
assert.strictEqual(fireAction.resolved, true);
assert.strictEqual(fireAction.effects.length, 1);
assert.strictEqual(fireAction.effects[0].sourceEnchantmentId, "flamebound");
assert.strictEqual(fireAction.effects[0].value, 10);
assert.strictEqual(fireAction.effects[0].damageType, "fire");

const duplicate = Engine.applyEnchantment(hybridB.item, "flamebound", 1);
assert.strictEqual(duplicate.applied, false);
assert.strictEqual(duplicate.reason, "enchantment_already_installed");

const tierFiveWeapon = {
  definitionId:"test_blade_v",
  name:"Test Blade V",
  itemType:"weapon",
  tier:5,
};
const rankOne = Engine.applyEnchantment(tierFiveWeapon, "flamebound", 1);
const skipRank = Engine.strengthenEnchantment(rankOne.item, "flamebound", 3);
assert.strictEqual(skipRank.strengthened, false);
assert.strictEqual(skipRank.reason, "strengthening_must_advance_one_rank");

const rankTwo = Engine.strengthenEnchantment(rankOne.item, "flamebound", 2);
assert.strictEqual(rankTwo.strengthened, true);
assert.deepStrictEqual(rankTwo.item.magic.enchantmentSlots, {max:3,used:2});

const cannotAddRankTwoPartner = Engine.applyEnchantment(rankTwo.item, "frostbound", 2);
assert.strictEqual(cannotAddRankTwoPartner.applied, false);
assert.strictEqual(cannotAddRankTwoPartner.reason, "base_enchantment_slots_exceeded");

const rankThree = Engine.strengthenEnchantment(rankTwo.item, "flamebound", 3);
assert.strictEqual(rankThree.strengthened, true);
assert.deepStrictEqual(rankThree.item.magic.enchantmentSlots, {max:3,used:3});

const bound = Engine.applyEnchantment(tierThreeWeapon, "flamebound", 1, {properties:["bind"]});
assert.strictEqual(bound.applied, true);
assert.strictEqual(Engine.canRemoveEnchantment(bound.item, "flamebound").allowed, false);
assert.strictEqual(Engine.canRemoveEnchantment(bound.item, "flamebound").reason, "bound_enchantment_not_removable");
const boundEffects = Engine.resolveEffectsForAction(bound.item, {selectedChannels:{elemental_weapon:"flamebound"}});
assert.strictEqual(boundEffects.effects[0].baseValue, 10);
assert.strictEqual(boundEffects.effects[0].value, 12.5);
assert.strictEqual(boundEffects.effects[0].propertyMultiplier, 1.25);

const cursed = Engine.applyEnchantment(tierThreeWeapon, "flamebound", 1, {properties:["curse"]});
assert.strictEqual(cursed.applied, true);
const cursedEffects = Engine.resolveEffectsForAction(cursed.item, {selectedChannels:{elemental_weapon:"flamebound"}});
assert.strictEqual(cursedEffects.effects[0].value, 15);
assert.strictEqual(cursedEffects.effects[0].propertyMultiplier, 1.5);

const invalidDualCurseState = Engine.applyEnchantment(tierThreeWeapon, "flamebound", 1, {properties:["bind","curse"]});
assert.strictEqual(invalidDualCurseState.applied, false);
assert.strictEqual(invalidDualCurseState.reason, "invalid_enchantment_properties");

const removed = Engine.removeEnchantment(flameI.item, "flamebound");
assert.strictEqual(removed.removed, true);
assert.strictEqual(removed.item.magic.enabled, false);
assert.deepStrictEqual(removed.item.magic.enchantmentSlots, {max:1,used:0});

const wrongKind = Engine.applyEnchantment({itemType:"armor",tier:5}, "flamebound", 1);
assert.strictEqual(wrongKind.applied, false);
assert.strictEqual(wrongKind.reason, "enchantment_item_kind_incompatible");

const missingTier = Engine.applyEnchantment({itemType:"weapon"}, "flamebound", 1);
assert.strictEqual(missingTier.applied, false);
assert.strictEqual(missingTier.reason, "missing_or_invalid_item_tier");

const hardConflictA = {id:"a",interaction:{hardConflicts:["b"]}};
const hardConflictB = {id:"b",interaction:{hardConflicts:[]}};
assert.strictEqual(Engine.definitionsConflict(hardConflictA, hardConflictB), true);
assert.strictEqual(Engine.definitionsConflict(hardConflictB, hardConflictA), true);

const magicHitEffect = Catalog.validateEffect({type:"magic_hit",trigger:"on_hit",value:true});
assert.strictEqual(magicHitEffect.valid, true);
const malformedMagicHit = Catalog.validateEffect({type:"magic_hit",trigger:"on_hit",value:25});
assert.strictEqual(malformedMagicHit.valid, false);

console.log("Enchantment catalog + core engine smoke: OK");
