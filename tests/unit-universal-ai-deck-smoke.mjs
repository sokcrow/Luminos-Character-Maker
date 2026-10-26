import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
for(const faction of ['ally','enemy']){
 const units={},kits={},c=vm.createContext({console,addEventListener(){},setTimeout(){},clearTimeout(){},Map,Set,
   LuminousCombatLiveAdapter073:{state:{encounterId:'ai-deck-test',round:1}},
   LuminousCombat073:{combatants:()=>units,kit:id=>kits[id],uiState:()=>({round:c.LuminousCombatLiveAdapter073.state.round})}});c.window=c;
 for(const name of ['deckEngine','combat-v073-deck','combat-action-schema','combat-action-adapters','individual-goap-combat-ai','unit-ai-kit-adapter','unit-ai-universal-actions','unit-independent-actions','unit-universal-action-policy','unit-universal-action-runtime','combat-v073-plan-sync','combat-v073-authority'])vm.runInContext(read('js/'+name+'.js'),c,{filename:name});
 vm.runInContext('Math.random=()=>0.5',c);
 const skills=[{id:'first',name:'First',kind:'skill',tier:1,basePower:40,coinPower:2,coinAmount:2},
 {id:'second',name:'Second',kind:'skill',tier:2,basePower:50,coinPower:3,coinAmount:2},
 {id:'third',name:'Third',kind:'skill',tier:3,basePower:60,coinPower:4,coinAmount:3},
 {id:'unselected',name:'Unselected',kind:'skill',tier:3,basePower:9999,coinPower:50,coinAmount:10}];
 units.ai={id:'ai',name:'AI',controlled:'ai',faction,hp:100,maxHp:100,battleActive:true,actionSlots:3,skills:copy(skills),aiUniversalActions:[],
 skillDeck:{schemaVersion:2,entries:[...Array.from({length:3},(_,i)=>({entryId:'f'+i,skillId:'first',tier:1})),...Array.from({length:2},(_,i)=>({entryId:'s'+i,skillId:'second',tier:2})),{entryId:'t',skillId:'third',tier:3}]}};
 units.target={id:'target',controlled:'player',faction:faction==='ally'?'enemy':'ally',hp:100,maxHp:100,battleActive:true};
 kits.ai={actions:skills};kits.target={actions:[]};
 const deck=c.LuminousCombatSlotDeck073,r=c.LuminousUnitUniversalActionRuntime;
 deck.ensure(units.ai);
 // Narrow each actual Slot hand to one of its real cards, preserving drawIds.
 const legal=Array.from({length:3},(_,index)=>{
   const cards=deck.hand('ai',index),card=cards[index%cards.length];
   units.ai.combatDeck.slots['ai_slot_'+index].hand=[card];
   return {skillId:card.skillId,drawId:card.drawId};
 });
 units.ai.autoPlans=legal.map((card,index)=>({type:'deck',drawId:card.drawId,sourceSlotIndex:index,data:skills.find(s=>s.id===card.skillId),targetId:'target',targetSlotIndex:0}));
 assert.equal(r.planAiRoster(units,{round:1}),true);
 const serialized={ai:{}};
 for(let index=0;index<3;index++){
   const plan=units.ai.autoPlans[index];
   assert.equal(plan.type,'deck','AI '+faction+' keeps deck plan type');
   assert.equal(plan.drawId,legal[index].drawId,'AI retains the exact Slot card');
   assert.equal(plan.sourceSlotIndex,index);
   assert.equal(plan.data.id,legal[index].skillId,'AI cannot choose the full-kit unselected Skill');
   serialized.ai[index]=c.LuminousCombatAuthority073.serializeRuntimePlan(plan,'ai',index);
 }
 assert.equal(deck.validatePlans(serialized),true,'Serialized AI passes the actual seal deck validator');
 for(let index=0;index<3;index++)assert.equal(deck.mark({ownerId:'ai',localIndex:index,plan:units.ai.autoPlans[index]}),true);
 c.LuminousCombatLiveAdapter073.state.round=2;deck.syncAll(2);
 for(let index=0;index<3;index++)assert.ok(deck.hand('ai',index).every(card=>card.drawId!==legal[index].drawId),'Used card rotates on next turn');
 // Low-INT global pruning must not discard the only legal source of a later Slot.
 const sources=Array.from({length:12},(_,i)=>({sourceType:'skill',definition:{id:'skill'+i,basePower:100-i,coinAmount:1}}));
 const result=c.LuminousIndividualGoapCombatAI.planTurn({actor:{id:'probe',hp:100,maxHp:100,intelligence:1},sources,slotIds:['probe_slot_0','probe_slot_1'],allowEscape:false,
   isSourceAllowedInSlot:(candidate,_slot,index)=>index===0?candidate.sourceId!=='skill11':candidate.sourceId==='skill11',targetIds:['target'],random:()=>0.5});
 assert.equal(result.actions[1].source.id,'skill11');
 assert.equal(result.actions[1].actionSlotId,'probe_slot_1');
 const gap=c.LuminousIndividualGoapCombatAI.planTurn({actor:{id:'gap',hp:100,maxHp:100},sources:[sources[0]],slotIds:['gap_slot_0','gap_slot_1'],allowEscape:false,
   isSourceAllowedInSlot:(_candidate,_slot,index)=>index===1,targetIds:['target'],random:()=>0.5});
 assert.equal(gap.actions.length,1);
 assert.equal(gap.actions[0].actionSlotId,'gap_slot_1','An empty earlier Slot must not move a later card into the wrong hand');
}
console.log('Universal AI deck: allied/hostile AI keep legal per-Slot cards, drawIds, seal validation and card rotation.');
