import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8');
const clone=value=>JSON.parse(JSON.stringify(value));
const skills=[
  {id:'first',kind:'skill',tier:1,basePower:4,coinPower:2,coinAmount:2},
  {id:'second',kind:'skill',tier:2,basePower:6,coinPower:3,coinAmount:2},
  {id:'third',kind:'skill',tier:3,basePower:9,coinPower:4,coinAmount:3},
  {id:'grant',kind:'skill',tier:1,inDeck:false,availability:{type:'granted'}},
  {id:'guard',kind:'defense',tier:1,defenseType:'guard'},
  {id:'spell',kind:'spell',tier:1}
];
const selection={schemaVersion:2,entries:[
  ...Array.from({length:3},(_,i)=>({entryId:'first_'+i,skillId:'first',tier:1})),
  ...Array.from({length:2},(_,i)=>({entryId:'second_'+i,skillId:'second',tier:2})),
  {entryId:'third_0',skillId:'third',tier:3}
]};

function client(){
  const units={},kits={};
  const context=vm.createContext({console,addEventListener(){},setTimeout(){},clearTimeout(){},
    LuminousCombatLiveAdapter073:{state:{encounterId:'universal_test',round:1}},
    LuminousCombat073:{combatants:()=>units,kit:id=>kits[id],uiState:()=>({round:context.LuminousCombatLiveAdapter073.state.round})}});
  context.window=context;
  vm.runInContext(read('js/deckEngine.js'),context);
  vm.runInContext(read('js/combat-v073-deck.js'),context);
  vm.runInContext('Math.random=()=>{throw new Error("Drawing consumed combat RNG")}',context);
  return {context,units,kits,deck:context.LuminousCombatSlotDeck073};
}
const a=client(),b=client();
for(const [id,controlled,faction] of [
  ['player','player','ally'],['remote','remote','ally'],['friend','ai','ally'],['hostile','ai','enemy']
]){
  a.context.LuminousCombatLiveAdapter073.state.round=1;
  b.context.LuminousCombatLiveAdapter073.state.round=1;
  a.units[id]={id,controlled,faction,actionSlots:2,skillDeck:clone(selection)};
  a.kits[id]={actions:clone(skills)};
  const unit=a.units[id],deck=a.deck.ensure(unit);
  assert.equal(deck.definition.pointsUsed,10,id);
  assert.equal(deck.definition.cardCount,6,id);
  assert.equal(Object.keys(deck.slots).length,2,id);
  const originalHand=clone(a.deck.hand(id,0).map(card=>card.drawId));
  a.kits[id].actions[0].description='Refreshed catalog text';
  a.kits[id].actions[0].economyCost='action';
  a.deck.ensure(unit);
  assert.deepEqual(clone(a.deck.hand(id,0).map(card=>card.drawId)),originalHand,'UI/catalog annotations must not reset hands');
  assert.equal(a.deck.hand(id,0).length,2,id);
  const options=a.deck.actionOptions(id,1);
  assert.equal(options.filter(row=>row.__deckCard).length,2);
  assert.deepEqual(clone(options.filter(row=>!row.__deckCard).map(row=>row.id)),['grant','guard','spell']);
  assert.ok(options.filter(row=>row.__deckCard).every(row=>a.deck.hand(id,1)
    .some(card=>card.skillId===row.id&&card.drawId===row.__deckCard.drawId)));

  // Reloading the compact RTDB checkpoint recreates exactly the same hands/RNG.
  b.units[id]={...clone(unit),controlled:'remote',combatDeck:a.deck.compact(deck),combatDeckModes:{}};
  b.kits[id]=clone(a.kits[id]);
  b.deck.ensure(b.units[id]);
  assert.deepEqual(clone(b.deck.compact(b.units[id].combatDeck)),clone(a.deck.compact(deck)));
  const first=a.deck.hand(id,0),second=a.deck.hand(id,1);
  const plans={[id]:{1:{unitId:id,kind:'skill',skillId:second[1].skillId,
    drawId:second[1].drawId,sourceSlotIndex:1,actionData:{basePower:999}}}};
  a.deck.validatePlans(plans);
  assert.notEqual(plans[id][1].actionData.basePower,999,'Authority replaces forged card data');
  assert.equal(plans[id][1].planType,'deck');
  assert.throws(()=>a.deck.validatePlans({[id]:{0:{...plans[id][1],sourceSlotIndex:0}}}),/disponible/,
    'A card from a different slot cannot be used');
  assert.throws(()=>a.deck.validatePlans({[id]:{0:{unitId:id,kind:'skill',skillId:'missing'}}}),/equipada/);
  // Planning/cancelling never consumes the newest card. Execution alone marks it.
  assert.equal(a.deck.mark({ownerId:id,localIndex:0,plan:{drawId:'missing'}}),false);
  assert.equal(a.deck.mark({ownerId:id,localIndex:1,plan:{drawId:second[1].drawId}}),true);
  assert.equal(b.deck.mark({ownerId:id,localIndex:1,plan:{drawId:second[1].drawId}}),true);
  a.deck.ensure(unit,2);b.deck.ensure(b.units[id],2);
  assert.equal(unit.combatDeck.slots[id+'_slot_0'].hand[0].drawId,first[1].drawId);
  assert.ok(a.deck.hand(id,1).every(card=>card.drawId!==second[1].drawId));
  // hand() uses the runtime round, as the real planning UI does.
  a.context.LuminousCombatLiveAdapter073.state.round=2;
  b.context.LuminousCombatLiveAdapter073.state.round=2;
  a.deck.ensure(unit,2);b.deck.ensure(b.units[id],2);
  assert.deepEqual(clone(a.deck.compact(unit.combatDeck)),clone(b.deck.compact(b.units[id].combatDeck)));
  const repeated=clone(unit.combatDeck);
  a.deck.ensure(unit,2);
  assert.deepEqual(clone(unit.combatDeck),repeated,'Same-round synchronization is idempotent');
  unit.actionSlots=1;a.deck.ensure(unit,2);
  assert.equal(unit.combatDeck.slots[id+'_slot_1'],undefined);
  unit.actionSlots=2;a.deck.ensure(unit,2);
  assert.equal(unit.combatDeck.slots[id+'_slot_1'].hand.length,2);
  unit.isBackup=true;
  const reserve=clone(unit.combatDeck);
  assert.equal(a.deck.ensure(unit,3),null);
  assert.deepEqual(clone(unit.combatDeck),reserve,'Reserves do not draw or rotate');
  unit.isBackup=false;
  a.context.LuminousCombatLiveAdapter073.state.round=3;
  a.deck.ensure(unit,3);
}

// NPC legacy loadouts can contain more than twelve cards without losing attacks.
a.units.legacy={id:'legacy',controlled:'ai',faction:'ally',actionSlots:1};
a.kits.legacy={actions:Array.from({length:6},(_,i)=>({id:'legacy_'+i,kind:'skill',tier:1}))};
assert.equal(a.deck.ensure(a.units.legacy).definition.cardCount,18);
assert.equal(a.deck.actionOptions('legacy',0).length,2,'Legacy AI also chooses only drawn cards');

// Explicit invalid/empty V2 never unlocks the legacy or embedded attack pool.
a.units.bad={id:'bad',controlled:'ai',skillDeck:{schemaVersion:2,entries:[selection.entries[0]]}};
a.kits.bad={actions:skills};
assert.equal(a.deck.ensure(a.units.bad),null);
assert.deepEqual(clone(a.deck.actionOptions('bad',0).map(row=>row.id)),['grant','guard','spell']);
a.units.bad.skillDeck={schemaVersion:2};
assert.equal(a.deck.ensure(a.units.bad),null);
assert.deepEqual(clone(a.deck.actionOptions('bad',0).map(row=>row.id)),['grant','guard','spell']);

// RTDB omits an exhausted empty pile; recovery must reshuffle deterministically.
const exhausted=a.units.friend;
const slot=exhausted.combatDeck.slots.friend_slot_0;
delete slot.drawPile;
slot.usedDrawId=slot.hand[1].drawId;
a.deck.ensure(exhausted,4);
assert.equal(slot.hand.length,2);
assert.ok(slot.drawPile.length>0);

// Run the actual live AI selector against the universal source, for both factions.
const html=read('combat/source/combat-v073-live.html');
for(const page of [html,read('Battle-viewer.html')])for(const match of page.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi))
  new vm.Script(match[1]);
function functionSource(name){
  const start=html.indexOf('function '+name+'(');
  assert.ok(start>=0,name);
  const end=html.indexOf('\n}',start)+2;
  return html.slice(start,end);
}
Object.assign(a.context,{combatData:a.units,UNIT_KITS:a.kits,LuminousCombatLiveMode:true,
  getAutoActionLibrary:()=>({}),autoActionScore:(_id,row)=>Number(row.basePower)||0});
vm.runInContext(functionSource('getUnitAutoActionPool')+'\n'+functionSource('smartAutoPlanFor'),a.context);
a.context.LuminousCombatLiveAdapter073.state.round=4;
for(const id of ['friend','hostile'])for(let index=0;index<2;index++){
  // For this check only offensive skills compete; no fabricated fallback actions.
  a.kits[id].actions=a.kits[id].actions.filter(row=>row.kind==='skill'&&row.inDeck!==false);
  const planned=a.context.smartAutoPlanFor(id,null,index);
  assert.equal(planned.type,'deck');
  assert.equal(planned.sourceSlotIndex,index);
  assert.ok(a.deck.hand(id,index).some(card=>card.drawId===planned.drawId&&card.skillId===planned.data.id));
  a.deck.validatePlans({[id]:{[index]:{kind:'skill',unitId:id,sourceSlotIndex:index,
    drawId:planned.drawId,skillId:planned.data.id}}});
}

// The actual player menu uses the same option resolver as automatic units.
a.context.PLAYER_ID='player';
a.context.selectedSlotIndex=1;
vm.runInContext(read('js/combat-v073-economy-menu.js'),a.context);
const menuRows=a.context.LuminousCombatEconomyMenu073.rowsFor('skills','action');
const sharedRows=a.deck.actionOptions('player',1,a.kits.player.actions.filter(row=>row.kind==='skill'));
assert.deepEqual(clone(menuRows),clone(sharedRows));

// The canonical deployment and kit adapter preserve V2 for any Unit category.
const context=vm.createContext({console,addEventListener(){},setTimeout(){},clearTimeout(){}});
context.window=context;
for(const file of ['js/combat-skill-loadout-074.js','js/unit-combat-instantiator.js','js/combat-v073-live-adapter.js'])
  vm.runInContext(read(file),context);
const loadout=context.LuminousCombatSkillLoadout074,adapter=context.LuminousCombatLiveAdapter073;
const instantiate=context.LuminousUnitCombatInstantiator;
for(const faction of ['ally','enemy']){
  const source={id:faction,name:faction,hp:10,maxHp:10,faction,
    skillDeck:clone(selection),skillIds:['stale'],action_slots:['stale'],
    equippedSkillIndex:{stale:true},resolvedSkills:clone(skills.slice(0,3))};
  const unit=instantiate.normalizeDefinition(faction,source);
  assert.deepEqual(clone(unit.skillIds),['first','second','third']);
  assert.deepEqual(clone(unit.skillSlotIds),selection.entries.map(row=>row.skillId));
  assert.deepEqual(clone(adapter.kitsFor([unit])[unit.id].actions.map(row=>row.id)),['first','second','third']);
  assert.equal(loadout.ownsSkill(source,'stale'),false);
  const empty={...unit,skillDeck:{schemaVersion:2},actions:skills.slice(0,3)};
  assert.deepEqual(clone(adapter.kitsFor([empty])[unit.id].actions),[]);
  assert.deepEqual(clone(loadout.skillIdsFor(empty)),[]);
  const granted={...unit,grantedSkillIds:['grant'],resolvedSkills:clone(skills)};
  assert.equal(adapter.kitsFor([granted])[unit.id].actions.find(row=>row.id==='grant').inDeck,false);
}
assert.equal(a.context.LuminousDeckEngine.isDeckEligible({id:'guard',type:'Defense',tier:1}),false);
assert.equal(a.context.LuminousDeckEngine.isDeckEligible({id:'guard',isDefense:true,tier:1}),false);
console.log('Universal Unit decks: players, remote, allied/hostile AI, real selector, authority, deployment, RTDB and slot lifecycle: OK');
