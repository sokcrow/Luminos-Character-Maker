import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function fixture(critical,reverse=false){
 const units={},kits={},writes=[];
 const c=vm.createContext({console,Map,Set,Promise,addEventListener(){},setTimeout(){return 1},clearTimeout(){},
   LuminousCombatLiveAdapter073:{state:{role:'dm',isAuthority:true,hydratedOnce:true,combatState:'planning',round:1,encounterId:'ai-help',db:{ref:()=>({async set(row){writes.push(row)}})}}},
   LuminousCombat073:{combatants:()=>units,kit:id=>kits[id],render(){}}});c.window=c;
 for(const name of ['combat-action-schema','combat-action-adapters','individual-goap-combat-ai','unit-ai-kit-adapter','unit-ai-universal-actions','unit-independent-actions','unit-universal-action-policy','unit-universal-action-runtime','combat-v073-plan-sync','combat-v073-authority','combat-v073-remote-intents'])vm.runInContext(read('js/'+name+'.js'),c);
 vm.runInContext('Math.random=()=>0.5',c);
 const weak={id:'weak',kind:'skill',basePower:0,coinAmount:1},strong={id:'strong',kind:'skill',basePower:30,coinPower:4,coinAmount:3};
 const skill=data=>({type:'auto',data,targetId:'enemy',targetSlotIndex:0});
 const helper={id:'helper',controlled:'ai',faction:'ally',hp:40,maxHp:40,battleActive:true,actionSlots:1,aiUniversalActions:['help'],autoPlans:[skill(weak)]};
 const beneficiary={id:'beneficiary',controlled:'ai',faction:'ally',hp:critical?1:40,maxHp:40,battleActive:true,actionSlots:1,aiUniversalActions:['help','escape'],autoPlans:[skill(strong)]};
 for(const unit of reverse?[beneficiary,helper]:[helper,beneficiary])units[unit.id]=unit;
 units.enemy={id:'enemy',controlled:'player',faction:'enemy',hp:100,maxHp:100,battleActive:true};kits.helper={actions:[weak]};kits.beneficiary={actions:[strong]};kits.enemy={actions:[]};
 return {c,units,writes};
}
for(const critical of [true,false])for(const reverse of [false,true]){
 const {c,units,writes}=fixture(critical,reverse),r=c.LuminousUnitUniversalActionRuntime;
 assert.equal(r.planAiRoster(units,{round:1}),true);
 const groups=Object.fromEntries(Object.values(units).map(u=>[u.id,u.autoPlans||[]]));
 assert.equal(r.prepare(units,groups,{round:1}).ok,true,'Final roster must remain valid after all AI choices; critical='+critical+' reverse='+reverse);
 if(critical){assert.equal(r.actionKey(units.beneficiary.autoPlans[0]),'escape');assert.notEqual(r.actionKey(units.helper.autoPlans[0]),'help');}
 else assert.equal(r.actionKey(units.helper.autoPlans[0]),'help','Valid Help remains available');
 assert.equal(await c.LuminousCombatRemoteIntents073.publishPlanningAi(),true);
 assert.equal(writes.length,1);
 assert.equal(r.prepareSealed({estado:{round:1},combatants:units},{round:1,aiPlans:writes[0].plans}).ok,true,'Published roster passes real seal policy');
}
// A failed final roster must never be published, even if an existing plan remains
// invalid after a source/catalog gap prevents replanning it.
{
 const {c,units,writes}=fixture(true);
 units.helper.autoPlans=[{type:'global',data:{actionKey:'help'},targetId:'missing',targetSlotIndex:0}];
 c.LuminousUnitAiKitAdapter={planUnitTurn:()=>({planned:false})};
 assert.equal(await c.LuminousCombatRemoteIntents073.publishPlanningAi(),false);
 assert.equal(writes.length,0);
}
console.log('AI Help roster: later withdrawal, stable healthy Help, iteration order and final publication/seal validation passed.');
