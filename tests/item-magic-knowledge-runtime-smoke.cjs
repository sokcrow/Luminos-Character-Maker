"use strict";

const assert = require("assert");

require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-persistence-runtime.js");
require("../js/item-magic-runtime.js");
require("../js/item-magic-knowledge-runtime.js");

const Engine = globalThis.LuminousItemEnchantmentEngine;
const Magic = globalThis.LuminousItemMagicRuntime;
const Persistence = globalThis.LuminousItemPersistenceRuntime;
const Knowledge = globalThis.LuminousItemMagicKnowledgeRuntime;

assert.ok(Engine && Magic && Persistence && Knowledge);
assert.strictEqual(Magic.VERSION, 5);
assert.strictEqual(Knowledge.VERSION, 1);
assert.deepStrictEqual(Knowledge.ARCANA_IDENTIFY_TH, {1:22,2:28,3:34});

const base = {
  instanceId:"knowledge_blade",
  definitionId:"knowledge_blade",
  name:"Longsword",
  itemType:"weapon",
  category:"weapon",
  tier:5,
  conditionMax:100,
  condition:100,
};

const enchanted = Engine.applyEnchantment(base,"flamebound",1).item;
assert.strictEqual(Magic.isMagicItem(enchanted),true);

const lowArcana = {id:"low_arcana",arcanaMod:-1,sp:3};
assert.strictEqual(Knowledge.passiveArcana(lowArcana),9);
const lowPresentation = Knowledge.presentation(lowArcana,enchanted);
assert.strictEqual(lowPresentation.displayName,"Longsword","Passive Arcana 9 does not automatically label unknown magic");
assert.strictEqual(lowPresentation.magicDetected,false);
assert.strictEqual(lowPresentation.difficulty,null);
assert.strictEqual(lowPresentation.enchantmentLines.length,1);
assert.strictEqual(lowPresentation.enchantmentLines[0].known,false);
assert.ok(lowPresentation.enchantmentLines[0].text.includes("ᚠ") || lowPresentation.enchantmentLines[0].text.length > 5);
assert.ok(!lowPresentation.enchantmentLines[0].text.includes("Flamebound"),"unknown rune text must not leak canonical Enchantment name");

const baselineArcana = {id:"baseline_arcana",arcanaMod:0,sp:3};
const baselinePresentation = Knowledge.presentation(baselineArcana,enchanted);
assert.strictEqual(baselinePresentation.displayName,"Enchanted Longsword");
assert.strictEqual(baselinePresentation.magicDetected,true);
assert.strictEqual(baselinePresentation.difficulty.threshold,22);
assert.strictEqual(baselinePresentation.identified,false);

const expertPassive = {id:"expert_passive",arcanaMod:12,sp:2};
const expertPresentation = Knowledge.presentation(expertPassive,enchanted);
assert.strictEqual(expertPresentation.displayName,"Flamebound Longsword");
assert.strictEqual(expertPresentation.identified,true);
assert.ok(expertPresentation.enchantmentLines[0].text.startsWith("Flamebound I"));
assert.ok(expertPresentation.enchantmentLines[0].text.includes("Damage +10%"));
assert.ok(!expertPresentation.displayName.includes("+1"));
assert.strictEqual(expertPresentation.magicalDurability,null,"Magical Durability requires a substantially better read than basic identification");

const studyUser = {id:"study_user",arcanaMod:5,sp:3};
const failedStudy = Knowledge.studyArcana(studyUser,enchanted,{roll:10});
assert.strictEqual(failedStudy.studied,true);
assert.strictEqual(failedStudy.success,false);
assert.strictEqual(failedStudy.total,15);
assert.strictEqual(studyUser.sp,2);
const successfulStudy = Knowledge.studyArcana(studyUser,enchanted,{roll:17});
assert.strictEqual(successfulStudy.success,true);
assert.strictEqual(successfulStudy.total,22);
assert.strictEqual(studyUser.sp,1);
assert.strictEqual(Knowledge.presentation(studyUser,enchanted,{syncPassive:false}).displayName,"Flamebound Longsword");

const noSp = {id:"no_sp",arcanaMod:20,sp:0};
assert.strictEqual(Knowledge.studyArcana(noSp,enchanted,{roll:20}).reason,"insufficient_sp");

const durabilityReader = {id:"durability_reader",arcanaMod:10,sp:2};
const deepStudy = Knowledge.studyArcana(durabilityReader,enchanted,{roll:20});
assert.strictEqual(deepStudy.total,30);
assert.strictEqual(deepStudy.margin,8);
const deepPresentation = Knowledge.presentation(durabilityReader,enchanted,{syncPassive:false});
assert.strictEqual(deepPresentation.magicalDurability.max,50);
assert.strictEqual(deepPresentation.magicalDurability.current,50);

const identifyUser = {id:"identify_user",arcanaMod:-2,sp:1};
const identify = Knowledge.identifyItem(identifyUser,enchanted);
assert.strictEqual(identify.identified,true);
assert.strictEqual(identify.cursedFlagged,false);
assert.strictEqual(Knowledge.presentation(identifyUser,enchanted,{syncPassive:false}).displayName,"Flamebound Longsword");

const cursed = Engine.applyEnchantment(
  {...base,instanceId:"cursed_blade"},
  "flamebound",
  1,
  {properties:["curse"]}
).item;
assert.strictEqual(Magic.isCursed(cursed),true,"Curse property inside canonical Enchantment refs is authoritative");

const cursedUser = {id:"cursed_user",arcanaMod:0,sp:2};
const beforeIdentify = Knowledge.presentation(cursedUser,cursed);
assert.strictEqual(beforeIdentify.displayName,"Enchanted Longsword");
assert.strictEqual(beforeIdentify.cursed,false);
assert.strictEqual(beforeIdentify.curseLines.length,0,"undetected Curse must not leak a separate inscription or UI line");

const identifiedCursed = Knowledge.identifyItem(cursedUser,cursed);
assert.strictEqual(identifiedCursed.identified,true);
assert.strictEqual(identifiedCursed.cursedFlagged,true);
assert.strictEqual(identifiedCursed.curseDetailsRevealed,false);
const flagged = Knowledge.presentation(cursedUser,cursed,{syncPassive:false});
assert.strictEqual(flagged.displayName,"Cursed Flamebound Longsword");
assert.strictEqual(flagged.cursed,true);
assert.strictEqual(flagged.curseDetailsKnown,false);
assert.ok(flagged.curseLines[0].text.startsWith("Cursed — "));
assert.ok(!flagged.curseLines[0].text.includes("hiddenDrawback"),"player presentation must not leak raw Curse schema");

const curseRead = Knowledge.identifyCurse(cursedUser,cursed);
assert.strictEqual(curseRead.identified,true);
const curseKnown = Knowledge.presentation(cursedUser,cursed,{syncPassive:false});
assert.strictEqual(curseKnown.curseDetailsKnown,true);
assert.ok(!curseKnown.curseLines[0].text.includes("definitionId"));
assert.ok(!curseKnown.curseLines[0].text.includes("source:"));

const detector = {id:"detector"};
const detected = Knowledge.detectCurse(detector,cursed);
assert.strictEqual(detected.detected,true);
assert.strictEqual(detected.curseDetailsRevealed,false);

const cleanDetector = {id:"clean_detector"};
assert.strictEqual(Knowledge.detectCurse(cleanDetector,enchanted).detected,false);

const depleted = JSON.parse(JSON.stringify(enchanted));
depleted.magic.magicalDurability.current=0;
depleted.magic.magicalDurability.depleted=true;
const depletedPresentation=Knowledge.presentation(baselineArcana,depleted,{syncPassive:false});
assert.strictEqual(depletedPresentation.inscriptionGlowing,false,"depleted magical runes stop glowing");

const knowledgeSnapshot = Persistence.serializeInventoryState({
  inventario_activo:{knowledge_blade:JSON.parse(JSON.stringify(enchanted))},
  inventario_stash:{},
  itemMagicKnowledge:JSON.parse(JSON.stringify(studyUser.itemMagicKnowledge)),
});
assert.deepStrictEqual(knowledgeSnapshot.itemMagicKnowledge,studyUser.itemMagicKnowledge);
const knowledgeTarget={inventario_activo:{},inventario_stash:{},equipment:{accessories:[]}};
Persistence.applyInventoryState(knowledgeTarget,knowledgeSnapshot);
assert.deepStrictEqual(knowledgeTarget.itemMagicKnowledge,studyUser.itemMagicKnowledge,"per-player Magic Item knowledge survives persistence hydration");

const rankTwo = Engine.applyEnchantment({...base,instanceId:"rank_two_knowledge"},"flamebound",2).item;
assert.strictEqual(Knowledge.identifyThreshold(rankTwo),28);
const rankThree = Engine.applyEnchantment({...base,instanceId:"rank_three_knowledge"},"flamebound",3).item;
assert.strictEqual(Knowledge.identifyThreshold(rankThree),34);

const stableRunesA=Knowledge.arcaneRunes("Flamebound I","item-a");
const stableRunesB=Knowledge.arcaneRunes("Flamebound I","item-a");
const differentRunes=Knowledge.arcaneRunes("Flamebound I","item-b");
assert.strictEqual(stableRunesA,stableRunesB);
assert.notStrictEqual(stableRunesA,differentRunes);

console.log("Magic Item Arcana/Identify knowledge smoke: OK");
