"use strict";
const assert=require("node:assert/strict");
require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/curse-catalog.js");
require("../js/curse-runtime.js");
require("../js/item-magic-runtime.js");
require("../js/curse-enchanter-bridge.js");
require("../js/item-enchanter-service-runtime.js");
const Engine=globalThis.LuminousItemEnchantmentEngine;
const Curse=globalThis.LuminousCurseRuntime;
const Magic=globalThis.LuminousItemMagicRuntime;
const Bridge=globalThis.LuminousCurseEnchanterBridge;
const Services=globalThis.LuminousItemEnchanterServiceRuntime;
const clone=x=>JSON.parse(JSON.stringify(x));

const clean={instanceId:"curse_c_weapon",definitionId:"sword",category:"weapon",itemType:"weapon",
  tier:5,condition:80,conditionMax:100,quantity:1};
const installed=Engine.applyEnchantment(clean,"flamebound",1,{
  properties:["curse"],applicationId:"curseA",appliedBy:"test",
});
assert.equal(installed.applied,true);
const item=clone(installed.item);
const originalMagic=clone(item.magic);
const legacy=Bridge.listItemCurses(item);
assert.equal(legacy.length,1);
assert.equal(legacy[0].kind,"enchantment_curse");
assert.equal(legacy[0].removable,true);
assert.equal(Bridge.selectRemoveCurseTarget(item,{}).allowed,true);
assert.equal(Magic.isCursed(item),true);
const first=Services.executeControlledResult(item,{quoted:true,service:"remove_curse",totalAhn:0,
  curseTarget:{kind:"enchantment_curse",definitionId:"flamebound",applicationId:"curseA"}});
assert.equal(first.executed,true);
assert.equal(Magic.isCursed(first.item),false);
assert.equal(Engine.appliedEnchantments(first.item).length,1,"Remove Curse removes property, not enchantment");
assert.deepEqual(Engine.appliedEnchantments(first.item)[0].properties,[]);
assert.equal(first.item.condition,80);
assert.deepEqual(first.item.curseInstances,undefined);
assert.equal(item.magic.enchantments[0].properties[0],"curse","preview must not mutate source");

const standalone=Curse.applyItem(item,"cursed_binding",{instanceId:"curse_standalone"});
assert.equal(standalone.applied,true);
assert.equal(Bridge.listItemCurses(standalone.item).length,2);
const coexist=Services.executeControlledResult(standalone.item,{
  quoted:true,service:"remove_curse",totalAhn:0,
  curseTarget:{kind:"enchantment_curse",definitionId:"flamebound",applicationId:"curseA"},
});
assert.equal(coexist.executed,true);
assert.equal(Curse.hasCurse(coexist.item),true,"autonomous Curse must survive Enchanter service");
assert.equal(Curse.itemUnequipLocked(coexist.item),true);
assert.equal(Engine.appliedEnchantments(coexist.item)[0].properties.length,0);
assert.equal(Magic.isCursed(coexist.item),true);

const onlyAutonomous=Curse.applyItem(clean,"cursed_binding",{instanceId:"curse_alone"}).item;
const forbidden=Services.executeControlledResult(onlyAutonomous,{quoted:true,service:"remove_curse",
  totalAhn:0,curseTarget:{kind:"autonomous",instanceId:"curse_alone"}});
assert.equal(forbidden.executed,false);
assert.equal(forbidden.reason,"autonomous_curse_requires_specific_resolution");
assert.equal(Services.executeControlledResult(onlyAutonomous,{
  quoted:true,service:"remove_curse",totalAhn:0,
}).reason,"removable_curse_not_found");

const refs=[
  Engine.applyEnchantment(clean,"flamebound",1,{properties:["curse"],applicationId:"curseA"}).reference,
  Engine.applyEnchantment(clean,"frostbound",1,{properties:["curse"],applicationId:"curseB"}).reference,
];
assert.ok(refs.every(ref=>ref && ref.properties.includes("curse")));
const mixed={...clone(clean),magic:{enabled:true,enchantments:clone(refs)}};
assert.equal(Bridge.listItemCurses(mixed).length,2);
const countBefore=JSON.stringify(mixed);
assert.equal(Bridge.selectRemoveCurseTarget(mixed,{}).reason,"curse_target_required");
assert.equal(Services.previewServiceResult(mixed,{quoted:true,service:"remove_curse",totalAhn:0}).previewed,false);
assert.equal(Services.previewServiceResult(mixed,{quoted:true,service:"remove_curse",totalAhn:0}).reason,"curse_target_required");
assert.equal(JSON.stringify(mixed),countBefore);

const targeted={quoted:true,service:"remove_curse",totalAhn:0,
  curseTarget:{kind:"enchantment_curse",definitionId:"frostbound",applicationId:"curseB"}};
const targetedPreview=Services.previewServiceResult(mixed,targeted);
assert.equal(targetedPreview.previewed,true);
assert.deepEqual(Engine.appliedEnchantments(targetedPreview.item).map(ref=>ref.properties),
  [["curse"],[]],"remove only the chosen Curse property");
assert.equal(Bridge.selectRemoveCurseTarget(mixed,{
  curseTarget:{kind:"enchantment_curse",definitionId:"does_not_exist"},
}).reason,"curse_target_not_found");

const sameDef={...clone(clean),magic:{enabled:true,enchantments:[
  clone(refs[0]),{...clone(refs[0]),applicationId:"curseCopy"},
]}};
assert.equal(Engine.removeEnchantmentProperty(sameDef,"flamebound","curse").reason,
  "enchantment_property_target_ambiguous");
const precise=Engine.removeEnchantmentProperty(sameDef,"flamebound","curse",{applicationId:"curseCopy"});
assert.equal(precise.changed,true);
assert.deepEqual(Engine.appliedEnchantments(precise.item).map(ref=>ref.properties),[["curse"],[]]);
assert.equal(Services.executeControlledResult(sameDef,{quoted:true,service:"remove_curse",totalAhn:0}).executed,false);
const gem={...clone(clean),magic:{enabled:true,enchantments:[{
  ...clone(refs[0]),source:"gem",anchorId:"gem_anchor_1",
}]}};
const gemGate=Bridge.selectRemoveCurseTarget(gem,{});
assert.equal(gemGate.allowed,false);
assert.equal(gemGate.reason,"gem_anchored_curse_requires_anchor_procedure");
assert.equal(Services.executeControlledResult(gem,{quoted:true,service:"remove_curse",totalAhn:0}).executed,false);

const bound={...clone(clean),magic:{enabled:true,enchantments:[{
  ...clone(refs[0]),properties:["bind"],
}]}};
assert.equal(Bridge.listItemCurses(bound)[0].kind,"item_magic_bind");
assert.equal(Services.executeControlledResult(bound,{quoted:true,service:"remove_curse",totalAhn:0}).executed,false);
assert.equal(Engine.validateAppliedProperties(["bind","curse"],
  globalThis.LuminousEnchantmentCatalog.get("flamebound")).valid,false);
const relic={...clone(item),relic:{inseparableDrawback:true}};
assert.equal(Services.executeControlledResult(relic,{quoted:true,service:"remove_curse",totalAhn:0}).reason,
  "relic_drawback_inseparable");

const owner={id:"test_owner",itemCurses:[{sourceItemInstanceId:item.instanceId}]};
const otherCursed=Curse.applyItem(item,"cursed_binding",{instanceId:"residualCurse"}).item;
const result=Services.commitServiceTransaction(owner,otherCursed,{
  quoted:true,service:"remove_curse",totalAhn:0,
  curseTarget:{kind:"enchantment_curse",definitionId:"flamebound",applicationId:"curseA"},
},{
  dmFreeService:true,viewer:owner,transactionId:"curse_service_targeted",appliedBy:"dm",
});
assert.equal(result.committed,true);
assert.equal(Curse.hasCurse(otherCursed),true);
assert.equal(owner.itemCurses.length,1,"wearer curse record survives when autonomous curse is still present");
assert.equal(owner.enchanterTransactions.curse_service_targeted.committed,true);

console.log("Curse Enchanter target selection, restrictions, persistence and old contract: OK");
