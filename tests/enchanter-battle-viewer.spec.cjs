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


test("Battle Viewer real CombatEngine dispatches authored Status triggers and one selected Reaction",async({page})=>{
  await page.setContent("<!doctype html><html><body></body></html>");
  for(const file of SCRIPTS) await page.addScriptTag({path:path.join(ROOT,file)});
  await page.addScriptTag({path:path.join(ROOT,"js/universal-action-economy.js")});
  const result=await page.evaluate(()=>{
    const core=window.CombatEngine;
    const bridge=window.LuminousItemEnchantmentCombatRuntime;
    const magic=window.LuminousItemMagicRuntime;
    const originalEnchantmentEngine=window.LuminousItemEnchantmentEngine;
    const oldStatus=window.LuminousStatusEngine;
    const oldPhase=core.currentState;
    const status=(target,id,data)=>{
      target.statusEffects ||= {};
      target.statusEffects[id]=(target.statusEffects[id]||0)+(Number(data.count)||1);
      return {count:target.statusEffects[id]};
    };
    const blade={instanceId:"real_trig_blade",itemType:"weapon",category:"weapon",
      magic:{enabled:true,enchantments:[{definitionId:"flamebound",rank:1}],
        magicalDurability:{current:12,max:12}}};
    const armor={instanceId:"real_trig_armor",itemType:"armor",category:"armor",
      magic:{enabled:true,enchantments:[{definitionId:"flamebound",rank:1}],
        magicalDurability:{current:12,max:12}}};
    const attacker={id:"real_attacker",hp:40,sp:8,
      equipment:{mainHand:JSON.parse(JSON.stringify(blade))},
      inventario_activo:{real_trig_blade:blade}};
    const defender={id:"real_defender",hp:40,sp:8,
      equipment:{armor:JSON.parse(JSON.stringify(armor))},
      inventario_activo:{real_trig_armor:armor}};
    const effects={
      real_trig_blade:[{type:"status_apply",trigger:"on_hit",statusId:"burn",
        stacks:2,sourceEnchantmentId:"flamebound",sourceMagicalWear:1}],
      real_trig_armor:[
        {type:"status_apply",trigger:"on_damage_received",statusId:"guarded",
          stacks:1,sourceEnchantmentId:"flamebound",sourceMagicalWear:1},
        {type:"status_apply",trigger:"before_getting_hit",statusId:"warded",
          stacks:1,sourceEnchantmentId:"flamebound",sourceMagicalWear:1},
      ],
    };
    try{
      window.LuminousStatusEngine={applyStatus:status};
      window.LuminousItemEnchantmentEngine={...originalEnchantmentEngine,
        resolveEffectsForAction(item,ctx){
          return {resolved:true,effects:(effects[item.instanceId]||[])
            .filter(effect=>effect.trigger===ctx.trigger)};
        },
      };
      core.currentState="COMBAT_ACTIVE";
      const ctx={attacker,defender,
        skill:{sourceType:"weapon",sourceItemInstanceId:"real_trig_blade"},
        damageDealt:9};
      core.triggerEvent("[On Hit]",ctx,[defender]);
      const first={burn:defender.statusEffects?.burn||0,
        guarded:defender.statusEffects?.guarded||0,
        attackerWear:magic.magicalDurabilityState(blade).current,
        defenderWear:magic.magicalDurabilityState(armor).current};
      const queued=bridge.queueDefensiveReaction(defender,"real_trig_armor");
      const before={attackerHp:attacker.hp,defenderHp:defender.hp,
        reaction:window.LuminousActionEconomy.snapshot(defender,{phase:"combat"}).reaction,
        md:magic.magicalDurabilityState(armor).current};
      const preHit={...ctx,enchantmentPreDamageWindow:true,incomingDamage:11};
      core.triggerEvent("[Before Getting Hit]",preHit,[defender]);
      const activated={warded:defender.statusEffects?.warded||0,
        attackerWard:attacker.statusEffects?.warded||0,
        reaction:window.LuminousActionEconomy.snapshot(defender,{phase:"combat"}).reaction,
        md:magic.magicalDurabilityState(armor).current};
      core.triggerEvent("[Before Getting Hit]",preHit,[defender]);
      const repeated={warded:defender.statusEffects?.warded||0,
        reaction:window.LuminousActionEconomy.snapshot(defender,{phase:"combat"}).reaction,
        md:magic.magicalDurabilityState(armor).current};
      return {first,queued,before,activated,repeated,
        unchangedHp:attacker.hp===before.attackerHp&&defender.hp===before.defenderHp,
        inventoryDirty:attacker.__luminousEnchantmentInventoryDirty===true&&
          defender.__luminousEnchantmentInventoryDirty===true};
    }finally{
      window.LuminousItemEnchantmentEngine=originalEnchantmentEngine;
      window.LuminousStatusEngine=oldStatus;
      core.currentState=oldPhase;
    }
  });
  expect(result.first).toEqual({burn:2,guarded:1,attackerWear:11,defenderWear:11});
  expect(result.queued.queued).toBe(true);
  expect(result.before).toEqual({attackerHp:40,defenderHp:40,reaction:1,md:11});
  expect(result.activated).toEqual({warded:1,attackerWard:0,reaction:0,md:10});
  expect(result.repeated).toEqual(result.activated);
  expect(result.unchangedHp).toBe(true);
  expect(result.inventoryDirty).toBe(true);
});
