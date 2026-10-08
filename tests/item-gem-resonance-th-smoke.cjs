"use strict";

const assert = require("assert");

require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");

const Catalog = globalThis.LuminousEnchantmentCatalog;
const Engine = globalThis.LuminousItemEnchantmentEngine;

assert.ok(Catalog && Engine);
assert.strictEqual(Catalog.VERSION,5);
assert.strictEqual(Engine.VERSION,10);

const rubyStandard = {definitionId:"ruby",itemId:"ruby",quality:"standard"};
const rubyFine = {definitionId:"ruby",itemId:"ruby",quality:"fine"};
const rubyExceptional = {definitionId:"ruby",itemId:"ruby",quality:"exceptional"};
const sapphireStandard = {definitionId:"sapphire",itemId:"sapphire",quality:"standard"};
const opalExceptional = {definitionId:"opal",itemId:"opal",quality:"exceptional"};
const starstoneExceptional = {definitionId:"starstone_exotic_gem",itemId:"starstone_exotic_gem",quality:"exceptional"};

const primary = Engine.gemCompatibility("flamebound", rubyStandard);
assert.strictEqual(primary.compatible, true);
assert.strictEqual(primary.level, "primary");
assert.deepStrictEqual(primary.matched, ["fire"]);

const acceptedResonanceDefinition = {
  ...Catalog.get("flamebound"),
  id:"accepted_heat_test",
  compatibility:{
    primaryResonances:[],
    acceptedResonances:["heat"],
    acceptedAffinities:[],
    incompatibleResonances:[],
    incompatibleAffinities:[],
  },
};
const acceptedResonance = Engine.gemCompatibility(acceptedResonanceDefinition, rubyStandard);
assert.strictEqual(acceptedResonance.compatible, true);
assert.strictEqual(acceptedResonance.level, "accepted");
assert.deepStrictEqual(acceptedResonance.matched, ["heat"]);

const acceptedAffinityDefinition = {
  ...Catalog.get("flamebound"),
  id:"accepted_regeneration_test",
  compatibility:{
    primaryResonances:[],
    acceptedResonances:[],
    acceptedAffinities:["regeneration"],
    incompatibleResonances:[],
    incompatibleAffinities:[],
  },
};
const acceptedAffinity = Engine.gemCompatibility(acceptedAffinityDefinition, rubyStandard);
assert.strictEqual(acceptedAffinity.compatible, true);
assert.strictEqual(acceptedAffinity.level, "accepted");
assert.deepStrictEqual(acceptedAffinity.matched, ["regeneration"]);

const wrongAffinity = Engine.gemCompatibility(acceptedAffinityDefinition, sapphireStandard);
assert.strictEqual(wrongAffinity.compatible, false);
assert.strictEqual(wrongAffinity.level, "incompatible");

const explicitIncompatibleDefinition = {
  ...acceptedAffinityDefinition,
  id:"explicit_incompatible_test",
  compatibility:{
    ...acceptedAffinityDefinition.compatibility,
    incompatibleResonances:["fire"],
  },
};
const explicitIncompatible = Engine.gemCompatibility(explicitIncompatibleDefinition, rubyStandard);
assert.strictEqual(explicitIncompatible.compatible, false);
assert.strictEqual(explicitIncompatible.reason, "explicitly_incompatible");

assert.strictEqual(Engine.gemCompatibility("flamebound", opalExceptional).compatible, false, "Opal is not a universal substitute");
assert.strictEqual(Engine.gemCompatibility("flamebound", starstoneExceptional).compatible, false, "Starstone is not a universal substitute");

const weapon = {
  instanceId:"compat_weapon",
  definitionId:"compat_weapon",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:100,
  condition:100,
};

const incompatibleMount = Engine.mountGemAnchor(weapon, sapphireStandard, "flamebound", 1);
assert.strictEqual(incompatibleMount.mounted, false);
assert.strictEqual(incompatibleMount.reason, "incompatible_gem");

const standardPreview = Engine.gemThresholdPreview(weapon, "flamebound", rubyStandard, 1);
assert.strictEqual(standardPreview.valid, true);
assert.strictEqual(standardPreview.baseThreshold, 22);
assert.strictEqual(standardPreview.itemGemAdjustment, -2);
assert.strictEqual(standardPreview.qualityAdjustment, 0);
assert.strictEqual(standardPreview.specializationApplied, false);
assert.strictEqual(standardPreview.finalThreshold, 20);

const standardOverchannel = Engine.gemThresholdPreview(weapon, "flamebound", rubyStandard, 2);
assert.strictEqual(standardOverchannel.overchannel,true);
assert.strictEqual(standardOverchannel.overchannelSteps,1);
assert.strictEqual(standardOverchannel.overchannelAdjustment,2);
assert.strictEqual(standardOverchannel.baseThreshold,28);
assert.strictEqual(standardOverchannel.itemGemAdjustment,-2);
assert.strictEqual(standardOverchannel.finalThreshold,28,"Rank II on Standard gem pays +2 TH Overchannel pressure");

const finePreview = Engine.gemThresholdPreview(weapon, "flamebound", rubyFine, 1);
assert.strictEqual(finePreview.itemGemAdjustment, -3);
assert.strictEqual(finePreview.finalThreshold, 19);

const exceptionalPreview = Engine.gemThresholdPreview(weapon, "flamebound", rubyExceptional, 1);
assert.strictEqual(exceptionalPreview.itemGemAdjustment, -4);
assert.strictEqual(exceptionalPreview.finalThreshold, 18, "Item/Gem stabilization can reduce Rank I 22 to 18");

const firstRuby = Engine.mountGemAnchor(weapon, {...rubyStandard,instanceId:"ruby_anchor_source_1"}, "flamebound", 1);
assert.strictEqual(firstRuby.mounted, true);

const customFire = {
  ...Catalog.get("stormbound"),
  id:"custom_fire_test",
  compatibility:{
    primaryResonances:["fire"],
    acceptedResonances:["heat"],
    acceptedAffinities:[],
    incompatibleResonances:[],
    incompatibleAffinities:[],
  },
};
const specializedPreview = Engine.gemThresholdPreview(
  firstRuby.item,
  customFire,
  {...rubyStandard,instanceId:"ruby_anchor_source_2"},
  1
);
assert.strictEqual(specializedPreview.specializationApplied, true);
assert.strictEqual(specializedPreview.architectureAfter.specialized, true);
assert.strictEqual(specializedPreview.architectureAfter.hybrid, false);
assert.strictEqual(specializedPreview.itemGemAdjustment, -3);
assert.strictEqual(specializedPreview.finalThreshold, 19);

const specializedExceptional = Engine.gemThresholdPreview(
  firstRuby.item,
  customFire,
  {...rubyExceptional,instanceId:"ruby_anchor_source_3"},
  1
);
assert.strictEqual(specializedExceptional.specializationApplied, true);
assert.strictEqual(specializedExceptional.itemGemAdjustment, -4, "Item/Gem reduction is capped at -4 even if raw bonuses exceed it");
assert.strictEqual(specializedExceptional.finalThreshold, 18);

const firstSapphire = Engine.mountGemAnchor(weapon, {...sapphireStandard,instanceId:"sapphire_anchor_source_1"}, "frostbound", 1);
assert.strictEqual(firstSapphire.mounted, true);
const hybridPreview = Engine.gemThresholdPreview(
  firstSapphire.item,
  customFire,
  {...rubyStandard,instanceId:"ruby_anchor_source_4"},
  1
);
assert.strictEqual(hybridPreview.architectureAfter.hybrid, true);
assert.strictEqual(hybridPreview.specializationApplied, false, "Hybrid builds do not receive the same-family specialization bonus");
assert.strictEqual(hybridPreview.itemGemAdjustment, -2);
assert.strictEqual(hybridPreview.finalThreshold, 20);

const externalPreview = Engine.gemThresholdPreview(
  weapon,
  "flamebound",
  rubyExceptional,
  1,
  {
    externalModifiers:[
      {sourceType:"enchantment_table",adjustment:-1},
      {sourceType:"specialist_tools",adjustment:-1},
      {sourceType:"unknown_debug_source",adjustment:-99},
    ],
  }
);
assert.strictEqual(externalPreview.itemGemAdjustment, -4);
assert.strictEqual(externalPreview.externalAdjustment, -2);
assert.strictEqual(externalPreview.finalThreshold, 16, "External setup can reduce below the Item/Gem TH18 floor");
assert.strictEqual(externalPreview.externalModifiers.length, 2, "Unknown modifier sources are ignored");

const rankTwoExternal = Engine.gemThresholdPreview(
  weapon,
  "flamebound",
  rubyExceptional,
  2,
  {externalThresholdAdjustment:-1}
);
assert.strictEqual(rankTwoExternal.baseThreshold, 28);
assert.strictEqual(rankTwoExternal.itemGemAdjustment, -4);
assert.strictEqual(rankTwoExternal.finalThreshold, 23);

const architectureNone = Engine.resonanceArchitecture(weapon);
assert.strictEqual(architectureNone.mode, "none");
const architectureSpecialized = Engine.resonanceArchitecture(firstRuby.item, rubyStandard);
assert.strictEqual(architectureSpecialized.mode, "specialized");
const architectureHybrid = Engine.resonanceArchitecture(firstRuby.item, sapphireStandard);
assert.strictEqual(architectureHybrid.mode, "hybrid");

console.log("Gem compatibility + specialization/TH smoke: OK");
