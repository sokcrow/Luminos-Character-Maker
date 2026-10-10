"use strict";
const {test,expect}=require("@playwright/test");
const fs=require("fs");
const path=require("path");
const ROOT=path.resolve(__dirname,"..");
const SCRIPTS=[
  "js/item-quality-engine.js",
  "js/item-catalog-ore-ingot-gem.js",
  "js/item-catalog-enchantments.js",
  "js/item-enchantment-engine.js",
  "js/item-runtime-engine.js",
  "js/item-inventory-runtime.js",
  "js/item-magic-runtime.js",
  "js/combatEngine.js",
  "js/item-enchantment-combat-runtime.js",
];

test("Battle Viewer boots canonical Enchanter bridge and uses equipped Item for multi-Coin Skill",async({page})=>{
  const html=fs.readFileSync(path.join(ROOT,"Battle-viewer.html"),"utf8");
  expect(html).toContain('js/item-enchantment-combat-runtime.js');
  expect(html.indexOf('js/item-enchantment-engine.js')).toBeLessThan(html.lastIndexOf('js/item-enchantment-combat-runtime.js'));
  await page.setContent("<!doctype html><html><body></body></html>");
  for(const file of SCRIPTS) await page.addScriptTag({path:path.join(ROOT,file)});
  const result=await page.evaluate(()=>{
    const core=window.CombatEngine;
    const enchant=window.LuminousItemEnchantmentEngine;
    const magic=window.LuminousItemMagicRuntime;
    const bridge=window.LuminousItemEnchantmentCombatRuntime;
    if(!core||!enchant||!magic||!bridge) throw Error("Battle Enchanter core runtime missing");
    const patch=bridge.patchCombatEngine(core);
    const base={instanceId:"viewer_blade",definitionId:"viewer_blade",
      itemType:"weapon",category:"weapon",tier:5,condition:100,conditionMax:100};
    const applied=enchant.applyEnchantment(base,"flamebound",1);
    if(!applied.applied) throw Error("Fixture Enchantment failed");
    const sword=JSON.parse(JSON.stringify(applied.item));
    const actor={id:"viewer_attacker",hp:50,equipment:{mainHand:sword}};
    const defender={id:"viewer_target",hp:50,reduceNonMagicHits:true};
    const skill={attackType:"Slash",skillRange:1,sourceItem:sword};
    const originalBridge=bridge.uninstallCombatEngine(core);
    if(!originalBridge) throw Error("Failed to access Battle Engine patch boundary");
    const actual=core.calculateCoinDamage;
    // Deterministic starting power makes the browser assertion independent
    // of other game-wide crit/level RNG while exercising the real bridge.
    core.calculateCoinDamage=()=>100;
    bridge.patchCombatEngine(core);
    const ctx={};
    const one=core.calculateCoinDamage(actor,defender,skill,10,false,0,ctx);
    const two=core.calculateCoinDamage(actor,defender,skill,10,false,0,ctx);
    const wear=magic.magicalDurabilityState(sword).current;
    const separate=core.calculateCoinDamage(actor,defender,skill,10,false,0,{});
    const after=magic.magicalDurabilityState(sword).current;
    const noMagic=core.calculateCoinDamage(actor,defender,{...skill,sourceItem:{instanceId:"not_weapon"}},10,false,0,{});
    bridge.uninstallCombatEngine(core);
    core.calculateCoinDamage=actual;
    bridge.patchCombatEngine(core);
    return {one,two,wear,separate,after,noMagic,patchAlreadyInstalled:patch.alreadyInstalled===true};
  });
  expect(result.one).toBe(55);
  expect(result.two).toBe(55);
  expect(result.wear).toBe(49);
  expect(result.separate).toBe(55);
  expect(result.after).toBe(48);
  // The unknown Item is unequipped; no magical damage may come from it,
  // although the defender's ordinary non-Magic Hit mitigation still applies.
  expect(result.noMagic).toBe(50);
});
