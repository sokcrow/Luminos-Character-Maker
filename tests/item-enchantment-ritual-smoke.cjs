"use strict";

const assert = require("assert");

require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");

const Catalog = globalThis.LuminousEnchantmentCatalog;
const Engine = globalThis.LuminousItemEnchantmentEngine;

assert.ok(Catalog && Engine);
assert.strictEqual(Catalog.VERSION, 4);
assert.strictEqual(Engine.VERSION, 7);

const ritualDefinition = {
  ...Catalog.get("flamebound"),
  id:"ritual_material_test",
  recipe:{
    requiredTags:["enchantment_material"],
    consumedRequirements:[
      {id:"arcane_catalyst",anyTags:["arcane_reagent","enchantment_reagent"],quantity:2},
    ],
    exactItemRequirements:[
      {id:"dragon_blood_exact",exactItemId:"draconic_blood",quantity:1},
    ],
    outcomes:{
      allowAccidentalBind:true,
      allowAccidentalCurse:true,
    },
  },
};

const arcaneEssence = {
  instanceId:"arcane_essence_stack",
  definitionId:"arcane_essence",
  quantity:3,
  tags:["ingredient","magical","essence","arcane"],
  reagentTags:["arcane_reagent","enchantment_reagent","arcane_catalyst"],
};
const dragonBlood = {
  instanceId:"dragon_blood_stack",
  definitionId:"draconic_blood",
  quantity:1,
  tags:["ingredient","organic","blood","draconic","rare"],
};
const protectedRuby = {
  instanceId:"mounted_ruby",
  definitionId:"ruby",
  quantity:1,
  quality:"fine",
  tags:["ingredient","gemstone","cut_gem","enchantment"],
  useTags:["enchantment_material","weapon_socket"],
};

const materialPlan = Engine.planRecipeMaterials(
  ritualDefinition,
  [arcaneEssence,dragonBlood,protectedRuby],
  {anchorGemInstanceId:"mounted_ruby"}
);
assert.strictEqual(materialPlan.valid,true);
assert.strictEqual(materialPlan.allocations.length,2);
assert.strictEqual(materialPlan.allocations.some((entry)=>entry.instanceId==="mounted_ruby"),false,"mounted Gem Anchor is protected from ritual consumption");

const consumed = Engine.consumeRecipeMaterials(
  ritualDefinition,
  [arcaneEssence,dragonBlood,protectedRuby],
  {anchorGemInstanceId:"mounted_ruby",outcome:"failure"}
);
assert.strictEqual(consumed.consumed,true);
assert.strictEqual(consumed.begun,true);
assert.strictEqual(consumed.outcomeIndependent,true,"materials are spent when ritual begins, before success/failure is known");
assert.strictEqual(arcaneEssence.quantity,1);
assert.strictEqual(dragonBlood.quantity,0);
assert.strictEqual(protectedRuby.quantity,1,"mounted Gem Anchor survives material consumption");

const missingExact = Engine.planRecipeMaterials(
  ritualDefinition,
  [{...arcaneEssence,quantity:3}],
  {}
);
assert.strictEqual(missingExact.valid,false);
assert.ok(missingExact.missing.some((entry)=>entry.requirementId==="dragon_blood_exact"));

const curseOnlyDefinition = {
  ...Catalog.get("frostbound"),
  id:"curse_material_test",
  recipe:{
    requiredTags:["enchantment_material"],
    consumedRequirements:[
      {id:"arcane_catalyst",anyTags:["arcane_reagent"],quantity:1},
    ],
    exactItemRequirements:[],
    outcomes:{allowAccidentalBind:false,allowAccidentalCurse:true},
  },
};

const curseWithoutProfane = Engine.planRecipeMaterials(
  curseOnlyDefinition,
  [{instanceId:"arcane_1",definitionId:"arcane_essence",quantity:1,reagentTags:["arcane_reagent"]}],
  {properties:["curse"]}
);
assert.strictEqual(curseWithoutProfane.valid,false,"intentional Curse requires a profane/corrupt/macabre reagent");
assert.ok(curseWithoutProfane.missing.some((entry)=>entry.requirementId==="intentional_curse_reagent"));

const curseArcane = {instanceId:"arcane_2",definitionId:"arcane_essence",quantity:1,reagentTags:["arcane_reagent"]};
const curseBlood = {instanceId:"blood_2",definitionId:"blood",quantity:1,tags:["ingredient","blood"]};
const curseWithBlood = Engine.consumeRecipeMaterials(
  curseOnlyDefinition,
  [curseArcane,curseBlood],
  {properties:["curse"]}
);
assert.strictEqual(curseWithBlood.consumed,true);
assert.strictEqual(curseArcane.quantity,0);
assert.strictEqual(curseBlood.quantity,0);

const bindThreshold = Engine.ritualThresholdPreview({}, "flamebound", 1, {properties:["bind"]});
assert.strictEqual(bindThreshold.valid,true);
assert.strictEqual(bindThreshold.baseThreshold,22);
assert.strictEqual(bindThreshold.propertyAdjustment,4);
assert.strictEqual(bindThreshold.finalThreshold,26);

const curseThreshold = Engine.ritualThresholdPreview({}, "flamebound", 1, {properties:["curse"]});
assert.strictEqual(curseThreshold.propertyAdjustment,6);
assert.strictEqual(curseThreshold.finalThreshold,28);

const gemBindThreshold = Engine.ritualThresholdPreview(
  {itemType:"weapon",tier:5},
  "flamebound",
  1,
  {gem:{definitionId:"ruby",quality:"exceptional"},properties:["bind"]}
);
assert.strictEqual(gemBindThreshold.itemGemAdjustment,-4);
assert.strictEqual(gemBindThreshold.propertyAdjustment,4);
assert.strictEqual(gemBindThreshold.finalThreshold,22,"ideal Rank I gem stabilization and intentional Bind cancel to base TH22");

const stableRisk = Engine.gemAttemptRiskProfile({definitionId:"ruby",quality:"fine"},2);
assert.deepStrictEqual(stableRisk,{
  valid:true,
  riskTier:"normal",
  overchannel:false,
  unstable:false,
  anchorDamageEligible:false,
  accidentalCurseEligible:false,
});
const poorRisk = Engine.gemAttemptRiskProfile({definitionId:"ruby",quality:"poor"},1);
assert.strictEqual(poorRisk.riskTier,"unstable");
assert.strictEqual(poorRisk.anchorDamageEligible,true);
const overchannelRisk = Engine.gemAttemptRiskProfile({definitionId:"ruby",quality:"standard"},2);
assert.strictEqual(overchannelRisk.riskTier,"overchannel");
assert.strictEqual(overchannelRisk.overchannel,true);
assert.strictEqual(overchannelRisk.anchorDamageEligible,true);
assert.strictEqual(overchannelRisk.accidentalCurseEligible,true);

const weapon = {
  instanceId:"outcome_weapon",
  definitionId:"outcome_weapon",
  itemType:"weapon",
  category:"weapon",
  tier:5,
};
const mounted = Engine.mountGemAnchor(
  weapon,
  {instanceId:"ruby_outcome",definitionId:"ruby",quality:"fine"},
  "flamebound",
  1
);
assert.strictEqual(mounted.mounted,true);
const anchorId = mounted.anchor.anchorId;

const deniedBind = Engine.applyGemArcaneOutcome(mounted.item,anchorId,"accidental_bind");
assert.strictEqual(deniedBind.changed,false);
assert.strictEqual(deniedBind.reason,"arcane_outcome_not_permitted");

const accidentalBind = Engine.applyGemArcaneOutcome(
  mounted.item,
  anchorId,
  "accidental_bind",
  {allowAccidentalBind:true}
);
assert.strictEqual(accidentalBind.changed,true);
assert.deepStrictEqual(accidentalBind.reference.properties,["bind"]);

const brokenOutcome = Engine.applyGemArcaneOutcome(mounted.item,anchorId,"anchor_broken");
assert.strictEqual(brokenOutcome.changed,true);
assert.strictEqual(brokenOutcome.reference.dormant,true);
assert.strictEqual(brokenOutcome.anchor.state,"broken");

const frostMounted = Engine.mountGemAnchor(
  {...weapon,instanceId:"curse_outcome_weapon"},
  {instanceId:"sapphire_outcome",definitionId:"sapphire",quality:"fine"},
  "frostbound",
  1
);
assert.strictEqual(frostMounted.mounted,true);
const accidentalCurse = Engine.applyGemArcaneOutcome(
  frostMounted.item,
  frostMounted.anchor.anchorId,
  "accidental_curse",
  {allowAccidentalCurse:true}
);
assert.strictEqual(accidentalCurse.changed,true);
assert.deepStrictEqual(accidentalCurse.reference.properties,["curse"]);

const forbiddenDoubleState = Engine.applyGemArcaneOutcome(
  accidentalBind.item,
  anchorId,
  "accidental_curse",
  {allowAccidentalCurse:true}
);
assert.strictEqual(forbiddenDoubleState.changed,false);
assert.strictEqual(forbiddenDoubleState.reason,"invalid_arcane_outcome_properties");

console.log("Enchantment ritual materials + Bind/Curse flow smoke: OK");
