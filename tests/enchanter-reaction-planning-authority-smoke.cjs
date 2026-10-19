"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const read=path=>fs.readFileSync(path,"utf8");
const engine=read("js/combatEngine.js");
require("../js/item-catalog-enchantments.js");
const catalog=globalThis.LuminousEnchantmentCatalog;
const menu=read("js/combat-v073-economy-menu.js");
const planSource=read("js/combat-v073-plan-sync.js");
const authority=read("js/combat-v073-authority.js");
assert.equal(catalog.validateEffect({
  type:"status_apply",trigger:"before_getting_hit",
  statusId:"warded",target:"self",stacks:1,
}).valid,true);
assert.ok(engine.indexOf("context.enchantmentPreDamageWindow = true;")>=0);
const before=engine.indexOf("this.triggerEvent('[Before Getting Hit]', context, [unitDefender]);",
  engine.indexOf("context.enchantmentPreDamageWindow = true;"));
const after=engine.indexOf("this.applyDamage(unitDefender, finalDamage",before);
assert.ok(before>0 && after>before,"per-Coin Reaction must resolve before HP/Shield reduction");
assert.ok(menu.includes('const rowKey="enchantment_reaction:"+instanceId'),
  "Items REACTION tab uses the existing combat HUD");
assert.ok(menu.includes("state.preparedReaction=null;"),
  "Enchantment reactions must bypass generic double-spend hooks");
assert.ok(authority.includes("defensiveReactions=Object.fromEntries(activePlayerIds()"));
assert.ok(authority.includes("bridge?.queueDefensiveReaction?.(unit,id)"));
assert.ok(authority.includes("unit.__luminousEnchantmentReactionArmedRound===Number(data.round)"),
  "DM authority must not re-arm an already triggered Reaction on checkpoint updates");

const listeners=new Map();
const writes=[];
const adapter={state:{
  playerId:"hero",uid:"owner_uid",round:3,role:"player",
  combatState:"PRE_COMBAT_PLANNING",firebaseReady:true,
  combatants:{"player:hero":{
    id:"player:hero",canonicalPlayerKey:"hero",canonicalOwnerUid:"owner_uid",
    isPlayer:true,actionSlots:1,
  }},
  db:{ref(){return {once(){return Promise.resolve({val:()=>null})},update(payload){writes.push(payload);return Promise.resolve()}}}},
}};
const win={
  addEventListener(name,cb){listeners.set(name,cb)},
  removeEventListener(){},
  LuminousCombatLiveAdapter073:adapter,
  firebase:{database:{ServerValue:{TIMESTAMP:{".sv":"timestamp"}}}},
  setTimeout(){return 0},
  console:{error(){}},
};
const oldWindow=global.window;
global.window=win;
try{
  delete require.cache[require.resolve("../js/combat-v073-plan-sync.js")];
  require("../js/combat-v073-plan-sync.js");
  const plan=win.LuminousCombatPlanSync073;
  assert.ok(plan);
  const data={ready:true,plans:[{type:"skill",data:{skillId:"slash"}}]};
  (async()=>{
    await plan.syncReady(data);
    assert.equal(writes.at(-1)["campaña/combate/readyPlayers/hero"].enchantmentReactionItemInstanceId,
      undefined,"unselected Item never fires automatically");
    listeners.get("luminous:combat073-reaction-prepared")({
      detail:{source:{enchantmentReaction:true,instanceId:"enchanted_shield"}},
    });
    await plan.syncReady(data);
    const row=writes.at(-1)["campaña/combate/readyPlayers/hero"];
    assert.equal(row.enchantmentReactionItemInstanceId,"enchanted_shield");
    assert.equal(row.schedulerUid,"owner_uid");
    assert.equal(row.round,3);
    adapter.state.round=4;
    await plan.syncReady(data);
    assert.equal(writes.at(-1)["campaña/combate/readyPlayers/hero"].enchantmentReactionItemInstanceId,
      undefined,"no stale defensive selection may cross combat rounds");
    console.log("Enchanter reaction plan owner/DM authority and predamage source smoke: OK");
  })().catch(error=>{console.error(error);process.exitCode=1});
}finally{
  global.window=oldWindow;
}
