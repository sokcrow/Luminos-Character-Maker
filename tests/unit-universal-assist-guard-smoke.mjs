import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const live=read('combat/source/combat-v073-live.html');
for(const controlled of ['player','ai'])for(const mastermind of [false,true]){
 const c=vm.createContext({console,JSON,Map,Set,Promise});c.window=c;
 for(const name of ['unit-universal-action-policy','unit-universal-action-runtime','mastermind-archetype-runtime'])vm.runInContext(read('js/'+name+'.js'),c);
 const unit=(id,faction)=>({id,name:id,hp:40,maxHp:40,speed:1,battleActive:true,actionSlots:3,faction,statusEffects:{},autoPlans:[]});
 const actor={...unit('actor','enemy'),controlled},helper={...unit('helper','enemy'),speed:6},protectedUnit=unit('protected','ally'),guard=unit('guard','ally');
 if(mastermind){helper.classes=[{id:'rogue',level:65}];helper.characterBuild={archetypes:[{classId:'rogue',archetypeId:'mastermind'}]};}
 const plan={type:'granted',data:{id:'attack',kind:'skill',basePower:4,coinPower:4,coinAmount:3},targetId:protectedUnit.id,targetSlotIndex:0};
 const plans=[structuredClone(plan),structuredClone(plan),plan];
 Object.assign(c,{round:1,PLAYER_ID:'actor',plannedActions:controlled==='player'?plans:[],combatData:{actor,helper,protected:protectedUnit,guard},UNIT_KITS:{guard:{actions:[{id:'intercept',kind:'skill',basePower:4,coinPower:4,coinAmount:3}]}},
   unitSlots:()=>[{}],isSkillOrSpellPlan:()=>true,sinInfo:()=>({color:'#fff'}),damageTypeLabel:()=> 'NORMAL'});
 if(controlled==='ai')actor.autoPlans=plans;
 for(const name of ['plansForUnit','universalHelpBonusForPlan','clashData','resolveNativeAssistGuard']){
   const match=live.match(new RegExp('(?:async )?function '+name+'\\([\\s\\S]*?\\n}'));assert.ok(match,name);vm.runInContext(match[0],c);
 }
 const r=c.LuminousUnitUniversalActionRuntime,m=c.LuminousMastermindArchetypeRuntime;
 const amount=r.applyHelp(helper,actor,plan,2,1,c.combatData);assert.equal(amount,mastermind?4:1);
 m.applyAssistGuard(guard,protectedUnit,1);
 assert.equal(c.universalHelpBonusForPlan(plan),amount);
 let clashes=0,redirected;
 c.resolveSkillClash=async incoming=>{
   clashes++;redirected=incoming.plan;
   assert.equal(incoming.plan.targetId,'guard');
   assert.equal(c.clashData(incoming.plan).finalPowerBonus,amount,'Redirected Clash retains the exact action Help for '+controlled+' mastermind='+mastermind);
   assert.equal(c.universalHelpBonusForPlan(c.plansForUnit('actor')[0]),0,'Identical action in another Slot never receives Help');
 };
 assert.equal(await c.resolveNativeAssistGuard({ownerId:'actor',localIndex:2,plan}),true);
 assert.equal(clashes,1);assert.equal(plan.targetId,'protected','Redirection must preserve the authored plan');
 // Origin identity must remain useful after JSON, and cannot outlive a replan.
 assert.equal(c.clashData(JSON.parse(JSON.stringify(redirected))).finalPowerBonus,amount);
 assert.equal(c.universalHelpBonusForPlan({...redirected,data:{...redirected.data,id:'unrelated'}}),0,'A copied identity cannot transfer Help to another Skill');
 helper.hp=0;assert.equal(c.universalHelpBonusForPlan(redirected),0,'Helper eligibility remains live during the Clash');helper.hp=40;
 c.round=2;assert.equal(c.universalHelpBonusForPlan(redirected),0,'A redirected identity cannot cross rounds');c.round=1;
 c.plansForUnit('actor')[2]={...plan,data:{...plan.data,id:'replacement'}};
 assert.equal(c.universalHelpBonusForPlan(redirected),0);
}
console.log('Assist Guard: real Help/Mastermind → native interception → Clash retains bonus for Player/IA and isolates the original action.');
