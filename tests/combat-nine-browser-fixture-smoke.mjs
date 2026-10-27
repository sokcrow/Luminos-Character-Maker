import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fixture,npcBenchmarkPlan} from './helpers/combat-nine-fixture.mjs';
const campaign=fixture(Array.from({length:9},(_,i)=>({uid:'fixture-'+i}))),raw=campaign.combate;
const c=vm.createContext({console,Math,JSON,Map,Set,Promise,addEventListener(){},
  setTimeout(){return 1},clearTimeout(){},
  LuminousCombatLiveAdapter073:{state:{role:'dm',uid:'fixture-0',round:1,skills:campaign.base_datos_skills}},
  LuminousCombat073:{combatants:()=>raw.combatants,kit:id=>({actions:(raw.combatants[id]?.skillIds||[]).map(id=>campaign.base_datos_skills[id])})},
});c.window=c;
for(const name of ['deckEngine','combat-v073-deck','unit-universal-action-policy','unit-universal-action-runtime','combat-v073-plan-sync','combat-v073-authority','combat-v073-remote-intents'])
  vm.runInContext(fs.readFileSync(`js/${name}.js`,'utf8'),c);
const authority=c.LuminousCombatAuthority073,runtime=c.LuminousUnitUniversalActionRuntime;
const aiPlans={};
for(let i=1;i<=2;i++){
  const id=`kobold${i}`,option=c.LuminousCombatSlotDeck073.actionOptions(id,0).find(row=>row.id==='enemy_s1');
  assert.ok(option?.__deckCard?.drawId,'NPC Skill must come from its real slot hand');
  const plan={...npcBenchmarkPlan(i,option),type:'deck',drawId:option.__deckCard.drawId};
  aiPlans[id]={0:authority.serializeRuntimePlan(plan,id,0)};
  assert.equal(aiPlans[id][0].kind,'skill','The fixture must serialize an NPC Skill, not a Universal Action');
  assert.equal(aiPlans[id][0].skillId,'enemy_s1');
}
const plans={};
for(let i=1;i<=8;i++)plans[`p${i}`]={0:authority.serializeRuntimePlan({type:'deck',sourceSlotIndex:0,drawId:`fixture-draw-${i}`,targetId:`kobold${i===2?2:1}`,targetSlotIndex:0,clashChoice:'clash',clashConfirmed:true,data:campaign.base_datos_skills.s1},`player:p${i}`,0)};
assert.equal(c.LuminousCombatSlotDeck073.validatePlans(aiPlans),true,'The actual deck sealer accepts the NPC drawn cards');
const missingDraw=JSON.parse(JSON.stringify(aiPlans));delete missingDraw.kobold1[0].drawId;
assert.throws(()=>c.LuminousCombatSlotDeck073.validatePlans(missingDraw),/ya no está disponible/);
const payload={round:1,plans,aiPlans};
assert.equal(runtime.prepareSealed(raw,payload).ok,true,'Nine-client fixture passes the production seal policy');
const invalid=authority.serializeRuntimePlan({...npcBenchmarkPlan(1,campaign.base_datos_skills.enemy_s1),type:'global'},'kobold1',0);
const rejected=runtime.prepareSealed(raw,{...payload,aiPlans:{...aiPlans,kobold1:{0:invalid}}});
assert.equal(rejected.ok,false);assert.equal(rejected.reason,'unknown_universal_action','Reproduce the first experiment failure');
console.log('Nine-browser fixture: production serializer and seal policy accept Skills; mistaken Universal Action classification reproduces the rejected seal.');
