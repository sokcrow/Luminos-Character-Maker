"use strict";
const assert=require("node:assert/strict");
require("../js/item-quality-engine.js");
require("../js/item-catalog-ore-ingot-gem.js");
require("../js/item-catalog-enchantments.js");
require("../js/item-enchantment-engine.js");
require("../js/item-runtime-engine.js");
require("../js/item-inventory-runtime.js");
require("../js/item-magic-runtime.js");
const Catalog=globalThis.LuminousEnchantmentCatalog;
// Release contract: no Enchanter recipe may ship with an accepted-but-silent
// trigger. The catalog may recognize future trigger names for authoring,
// but a live recipe must have an explicitly executable combat bridge.
const executableOnSkill=new Set([
  "damage_percent","secondary_damage_percent","specialized_damage_percent",
  "damage_flat","magic_hit",
]);
const executableStatus=new Set(["on_hit","on_damage_received","before_getting_hit"]);
let authoredTriggers=0;
for(const definition of Catalog.DEFINITIONS){
  assert.equal(Catalog.validateDefinition(definition).valid,true,
    `Invalid canonical recipe ${definition.id}`);
  for(const rank of Object.values(definition.rankData||{})){
    for(const effect of rank.effects||[]){
      const trigger=Catalog.normalizeId(effect.trigger||"passive");
      const type=Catalog.normalizeId(effect.type);
      const executable=trigger==="passive" ||
        (trigger==="on_skill" && executableOnSkill.has(type)) ||
        (executableStatus.has(trigger) && type==="status_apply");
      assert.equal(executable,true,
        `Recipe ${definition.id}: ${type}/${trigger} has no live Enchanter combat adapter`);
      if(trigger!=="passive")authoredTriggers++;
    }
  }
}
assert.ok(authoredTriggers>0,"At least one canonical on-Skill Enchanter definition must be exercised");
const Magic=globalThis.LuminousItemMagicRuntime;
const engine=globalThis.LuminousItemEnchantmentEngine;
const originalStatus=globalThis.LuminousStatusEngine;
const originalCombat=globalThis.CombatEngine;
const clone=o=>JSON.parse(JSON.stringify(o));

const blade={instanceId:"trig_blade",itemType:"weapon",category:"weapon",
  magic:{enabled:true,enchantments:[{definitionId:"flamebound",rank:1}],
    magicalDurability:{current:12,max:12}}};
const armor={instanceId:"trig_armor",itemType:"armor",category:"armor",
  magic:{enabled:true,enchantments:[{definitionId:"flamebound",rank:1}],
    magicalDurability:{current:12,max:12}}};
const onHit={type:"status_apply",trigger:"on_hit",statusId:"burn",
  stacks:2,sourceEnchantmentId:"flamebound",sourceMagicalWear:1,materialWearMultiplier:1};
const onReceived={type:"status_apply",trigger:"on_damage_received",statusId:"guarded",
  target:"self",stacks:1,sourceEnchantmentId:"flamebound",sourceMagicalWear:1,materialWearMultiplier:1};
blade.mockEffects=[onHit];
armor.mockEffects=[onReceived];
globalThis.LuminousItemEnchantmentEngine={...engine,
  resolveEffectsForAction(item,context){
    return {resolved:true,effects:(item.mockEffects || []).filter(effect=>effect.trigger===context.trigger)};
  },
};
globalThis.LuminousStatusEngine={
  applyStatus(target,id,data){
    if(target.blockStatus)return null;
    target.statusEffects ||= {};
    const current=target.statusEffects[id] || {count:0};
    target.statusEffects[id]={count:current.count+Number(data.count || 1),
      sourceTraitId:data.sourceTraitId};
    return target.statusEffects[id];
  },
};
let originalEvents=0;
const initialEvent=(tag)=>{originalEvents++;return "base-event:"+tag;};
globalThis.CombatEngine={
  calculateCoinDamage(){return 100;},
  triggerEvent:initialEvent,
};
require("../js/item-enchantment-combat-runtime.js");
const Combat=globalThis.LuminousItemEnchantmentCombatRuntime;
const fighter={id:"fighter",hp:20,sp:10,
  equipment:{mainHand:clone(blade)},
  inventario_activo:{trig_blade:blade}};
const enemy={id:"enemy",hp:20,sp:10,equipment:{armor:clone(armor)},
  inventario_activo:{trig_armor:armor}};
const skill={sourceType:"weapon",sourceItemInstanceId:"trig_blade"};
const ctx=()=>({attacker:fighter,defender:enemy,skill,damageDealt:10});
const md=item=>Magic.magicalDurabilityState(item).current;
try {
  assert.equal(Combat.patchCombatEngine(globalThis.CombatEngine).alreadyInstalled,true);
  const first=globalThis.CombatEngine.triggerEvent("[On Hit]",ctx(),[enemy]);
  assert.equal(first,"base-event:[On Hit]");
  assert.equal(originalEvents,1);
  assert.equal(enemy.statusEffects.burn.count,2,"weapon On Hit must apply authored Status to defender");
  assert.equal(enemy.statusEffects.guarded.count,1,"On Damage Received must apply to equipped defender");
  assert.equal(md(blade),11,"attacker canonical inventory Item spends 1 MD");
  assert.equal(md(armor),11,"defender canonical inventory Item spends 1 MD");
  assert.equal(fighter.equipment.mainHand.magic.magicalDurability.current,12,
    "decorative equipment clone cannot be the only persistence target");
  assert.equal(fighter.__luminousEnchantmentInventoryDirty,true);
  assert.equal(enemy.__luminousEnchantmentInventoryDirty,true);

  const classContext={attacker:fighter,defender:enemy,skill:{type:"Class"},
    damageDealt:10};
  const beforeClass=md(blade);
  globalThis.CombatEngine.triggerEvent("[On Hit]",classContext,[enemy]);
  assert.equal(md(blade),beforeClass,"unrelated Class Skills may not invoke weapon On Hit");
  assert.equal(enemy.statusEffects.burn.count,2);

  const noDamage=ctx();noDamage.damageDealt=0;
  const beforeZero=[md(blade),md(armor)];
  globalThis.CombatEngine.triggerEvent("[On Hit]",noDamage,[enemy]);
  assert.deepEqual([md(blade),md(armor)],beforeZero,"no positive hit means no trigger");

  armor.mockEffects=[{...onReceived,spCost:2}];
  enemy.blockStatus=true;
  const spBefore=enemy.sp,armorBefore=md(armor);
  const failed=Combat.triggerCombatEffects(enemy,armor,fighter,"on_damage_received",{});
  assert.equal(failed.activated,false);
  assert.equal(failed.rolledBack,true);
  assert.equal(enemy.sp,spBefore,"Status application failure restores SP");
  assert.equal(md(armor),armorBefore,"Status failure restores item MD");
  enemy.blockStatus=false;

  const denied={...armor,instanceId:"rank2_armor",magic:clone(armor.magic)};
  denied.magic.enchantments=[{definitionId:"flamebound",rank:2}];
  denied.mockEffects=[onReceived];
  enemy.equipment.armor=denied;
  assert.equal(Combat.triggerCombatEffects(enemy,denied,fighter,"on_damage_received",{}).activated,false,
    "Rank II equipment without Attunement has no active triggered effects");
  enemy.equipment.armor=clone(armor);

  fighter.hp=0;
  assert.equal(Combat.triggerCombatEffects(fighter,blade,enemy,"on_hit",{}).activated,false);
  fighter.hp=20;
  fighter.equipment={};
  assert.equal(Combat.triggerCombatEffects(fighter,blade,enemy,"on_hit",{}).activated,false,
    "unequipped Item cannot trigger");
  fighter.equipment.mainHand=clone(blade);

  armor.mockEffects=[{...onReceived,resource:"charges",chargeCost:1}];
  const beforeUnmapped=md(armor);
  const noMapping=Combat.triggerCombatEffects(enemy,armor,fighter,"on_damage_received",{});
  assert.equal(noMapping.activated,false);
  assert.equal(md(armor),beforeUnmapped,"unmapped charge effects must not pay a hidden second battery");
  armor.mockEffects=[onReceived];

  const beforeHit={type:"status_apply",trigger:"before_getting_hit",
    statusId:"warded",stacks:1,
    sourceEnchantmentId:"flamebound",sourceMagicalWear:1};
  armor.mockEffects=[beforeHit];
  const economyBefore=globalThis.LuminousActionEconomy;
  globalThis.LuminousActionEconomy={
    availability(unit,cost){
      assert.equal(cost,"reaction");
      return {available:unit.__luminousActionEconomyState?.reactionRemaining>0,
        reason:"reaction_spent"};
    },
    consume(unit,cost){
      if(unit.__luminousActionEconomyState?.reactionRemaining<=0)return false;
      unit.__luminousActionEconomyState.reactionRemaining-=1;return true;
    },
  };
  try{
    enemy.__luminousActionEconomyState={reactionRemaining:1,quickActionRemaining:1};
    const mdPre=md(armor),spPre=enemy.sp;
    const ready=Combat.queueDefensiveReaction(enemy,"trig_armor");
    assert.equal(ready.queued,true,"Player must explicitly select an equipped authored reaction");
    assert.equal(Combat.queueDefensiveReaction(enemy,"missing").queued,false);
    assert.equal(enemy.__luminousActionEconomyState.reactionRemaining,1,
      "arming a Reaction cannot spend it early");

    const incoming=ctx();
    incoming.enchantmentPreDamageWindow=true;
    incoming.incomingDamage=13;
    globalThis.CombatEngine.triggerEvent("[Before Getting Hit]",incoming,[enemy]);
    assert.equal(enemy.statusEffects.warded.count,1,
      "defensive trigger defaults to wearer even without an explicit target");
    assert.equal(fighter.statusEffects?.warded,undefined,
      "a defensive enchantment cannot accidentally buff the incoming attacker");
    assert.equal(enemy.__luminousActionEconomyState.reactionRemaining,0);
    assert.equal(md(armor),mdPre-1,"an authored pre-damage effect spends MD exactly once");
    assert.equal(enemy.sp,spPre);
    globalThis.CombatEngine.triggerEvent("[Before Getting Hit]",incoming,[enemy]);
    assert.equal(enemy.statusEffects.warded.count,1,
      "same selection cannot fire twice during a Multi-Coin action");
    assert.equal(md(armor),mdPre-1);

    const selectAfterSpend=Combat.queueDefensiveReaction(enemy,"trig_armor");
    assert.equal(selectAfterSpend.queued,true);
    const priorMd=md(armor);
    globalThis.CombatEngine.triggerEvent("[Before Getting Hit]",incoming,[enemy]);
    assert.equal(md(armor),priorMd,"spent Reaction cannot pay an Item resource");

    enemy.__luminousActionEconomyState.reactionRemaining=1;
    enemy.blockStatus=true;
    assert.equal(Combat.queueDefensiveReaction(enemy,"trig_armor").queued,true);
    const failedPredamage=Combat.dispatchSelectedDefensiveReaction(incoming,globalThis.CombatEngine);
    assert.equal(failedPredamage.activated,false);
    assert.equal(failedPredamage.rolledBack,true);
    assert.equal(enemy.__luminousActionEconomyState.reactionRemaining,1,
      "failed Status application refunds the Reaction action");
    assert.equal(md(armor),priorMd,"failed predamage Status refunds MD");
    enemy.blockStatus=false;
    assert.equal(Combat.dispatchSelectedDefensiveReaction(incoming).activated,false,
      "failed reaction selection must not auto-repeat");
  }finally{
    globalThis.LuminousActionEconomy=economyBefore;
    armor.mockEffects=[onReceived];
  }

  const oldEvent=globalThis.CombatEngine.triggerEvent;
  assert.notEqual(oldEvent,initialEvent);
  assert.equal(Combat.uninstallCombatEngine(globalThis.CombatEngine),true);
  assert.equal(globalThis.CombatEngine.triggerEvent,initialEvent);
  assert.equal(Combat.patchCombatEngine(globalThis.CombatEngine).installed,true);
  assert.equal(Combat.uninstallCombatEngine(globalThis.CombatEngine),true);
  // Isolate the adapter to simulate a payment implementation that has
  // already modified SP and MD before returning a rejection or throwing.
  // This guards against cross-runtime partial costs during a failed Reaction.
  const vm=require("node:vm");
  const fs=require("node:fs");
  const mockActor={id:"mock",hp:20,sp:9};
  const mockItem={instanceId:"payment_item",magic:{magicalDurability:{current:12,max:12}}};
  const paymentMagic={
    actorCanEmitMagic:()=>true,
    enchantmentEffectResolution:()=>({resolved:true,effects:[{
      type:"status_apply",statusId:"warded",target:"self",
    }]}),
    activationResourcePlan:()=>({sp:1,magicalDurability:2}),
    canPayActivationResources:()=>({allowed:true}),
    payActivationResourcePlan(actor,item){
      actor.sp-=1;
      item.magic.magicalDurability.current-=2;
      return {paid:false,reason:"simulated_partial_payment"};
    },
  };
  const isolated={LuminousItemMagicRuntime:paymentMagic,
    LuminousStatusEngine:{applyStatus(){throw Error("status_not_expected")}},
    console,
  };
  vm.runInNewContext(fs.readFileSync("js/item-enchantment-combat-runtime.js","utf8"),isolated);
  const testBridge=isolated.LuminousItemEnchantmentCombatRuntime;
  const deniedPayment=testBridge.triggerCombatEffects(mockActor,mockItem,{},"before_getting_hit",{});
  assert.equal(deniedPayment.activated,false);
  assert.equal(deniedPayment.rolledBack,true);
  assert.equal(deniedPayment.reason,"simulated_partial_payment");
  assert.equal(mockActor.sp,9,"declined payment refunds provisional SP");
  assert.equal(mockItem.magic.magicalDurability.current,12,
    "declined payment refunds provisional MD");
  paymentMagic.payActivationResourcePlan=(actor,item)=>{
    actor.sp-=1;
    item.magic.magicalDurability.current-=2;
    throw Error("simulated_payment_exception");
  };
  const thrownPayment=testBridge.triggerCombatEffects(mockActor,mockItem,{},"before_getting_hit",{});
  assert.equal(thrownPayment.activated,false);
  assert.equal(thrownPayment.rolledBack,true);
  assert.equal(thrownPayment.reason,"simulated_payment_exception");
  assert.equal(mockActor.sp,9,"thrown payment refunds provisional SP");
  assert.equal(mockItem.magic.magicalDurability.current,12,
    "thrown payment refunds provisional MD");
  console.log("Enchanter CombatEngine hit/received triggers, Status, MD and resource-payment rollback: OK");
}finally {
  globalThis.LuminousItemEnchantmentEngine=engine;
  globalThis.LuminousStatusEngine=originalStatus;
  globalThis.CombatEngine=originalCombat;
}
