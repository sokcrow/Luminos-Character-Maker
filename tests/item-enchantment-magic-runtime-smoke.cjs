"use strict";

const assert = require("assert");

require("../js/item-magic-runtime.js");

const Magic = globalThis.LuminousItemMagicRuntime;
assert.ok(Magic);
assert.strictEqual(Magic.DEFAULT_ATTUNEMENT_CAPACITY, 3);

const rankOne = {
  instanceId:"rank_one_item",
  definitionId:"rank_one_item",
  magic:{
    enabled:true,
    enchantments:[
      {definitionId:"flamebound",rank:1,source:"direct",properties:[]}
    ]
  }
};
assert.strictEqual(Magic.isMagicItem(rankOne), true, "an applied Enchantment must make the Item magical");
assert.strictEqual(Magic.requiresAttunement(rankOne), false, "Rank I normal Enchantment must not require Attunement by default");

const rankTwo = {
  instanceId:"rank_two_item",
  definitionId:"rank_two_item",
  magic:{
    enabled:true,
    enchantments:[
      {definitionId:"flamebound",rank:2,source:"direct",properties:[]},
      {definitionId:"frostbound",rank:1,source:"direct",properties:[]},
    ]
  }
};
assert.strictEqual(Magic.highestEnchantmentRank(rankTwo), 2);
assert.strictEqual(Magic.requiresAttunement(rankTwo), true, "Rank II+ Enchantment must require Attunement");

const unit = {id:"unit_1"};
const first = Magic.attuneItem(unit, rankTwo);
assert.strictEqual(first.attuned, true);
assert.strictEqual(first.current, 1, "one Item with multiple Enchantments must consume one Attunement Slot");
assert.deepStrictEqual(Magic.getAttunedItems(unit), ["rank_two_item"]);

const again = Magic.attuneItem(unit, rankTwo);
assert.strictEqual(again.attuned, true);
assert.strictEqual(again.alreadyAttuned, true);
assert.deepStrictEqual(Magic.getAttunedItems(unit), ["rank_two_item"]);

const rankThree = {
  instanceId:"rank_three_item",
  magic:{enabled:true,enchantments:[{definitionId:"flamebound",rank:3,source:"direct",properties:[]}]}
};
assert.strictEqual(Magic.requiresAttunement(rankThree), true);

const bound = {
  instanceId:"bound_item",
  definitionId:"bound_item",
  magic:{
    enabled:true,
    enchantments:[
      {definitionId:"flamebound",rank:2,source:"direct",properties:["bind"]}
    ]
  }
};
assert.strictEqual(Magic.isBoundItem(bound), true);
assert.strictEqual(Magic.isCursed(bound), true, "Bind is a Curse-family state");
assert.strictEqual(Magic.curseProfile(bound).kind, "bind");
assert.strictEqual(Magic.curseProfile(bound).attunementLocked, true);

const boundUnit = {id:"bound_unit"};
assert.strictEqual(Magic.attuneItem(boundUnit, bound).attuned, true);
const blocked = Magic.unattuneItem(boundUnit, bound);
assert.strictEqual(blocked.unattuned, false);
assert.strictEqual(blocked.reason, "bound_attunement_locked");
assert.deepStrictEqual(Magic.getAttunedItems(boundUnit), ["bound_item"]);

const forced = Magic.unattuneItem(boundUnit, bound, {force:true});
assert.strictEqual(forced.unattuned, true);
assert.deepStrictEqual(Magic.getAttunedItems(boundUnit), []);

const traitCapacity = {id:"trait_unit",attunementCapacity:4};
assert.strictEqual(Magic.getAttunementCapacity(traitCapacity), 4, "canonical Traits/effects can modify Attunement capacity through the existing capacity seam");

const explicitRankOne = {
  instanceId:"explicit_attunement_rank_one",
  requiresAttunement:true,
  magic:{enabled:true,enchantments:[{definitionId:"flamebound",rank:1,source:"direct",properties:[]}]}
};
assert.strictEqual(Magic.requiresAttunement(explicitRankOne), true, "explicit Item rules may still require Attunement at Rank I");

assert.strictEqual(Object.prototype.hasOwnProperty.call(rankTwo.magic, "magicHit"), false, "Magic Item status must not invent Magic Hit");

console.log("Enchantment Magic Item/Attunement bridge smoke: OK");
