import assert from 'node:assert/strict';
await import('../js/combat-action-queue.js');
const queue = globalThis.LuminousCombatActionQueue;
if (!queue) throw new Error('LuminousCombatActionQueue was not initialized.');

const p1 = { id:'p1', faction:'allies', speed:8, hp:20 };
const p2 = { id:'p2', faction:'allies', speed:8, hp:20 };
const p3 = { id:'p3', faction:'allies', speed:5, hp:20 };
const e1 = { id:'e1', faction:'enemies', speed:7, hp:20 };
const e2 = { id:'e2', faction:'enemies', speed:7, hp:20 };
const abnormality = { id:'abno', faction:'enemies', speed:2, hp:100, parts:[{id:'head',speed:9},{id:'arm',speed:4}] };
const units = [p1,p2,p3,e1,e2,abnormality];
const actions = [
  {id:'p1s1',actorId:'p1',actionSlotId:'p1_slot_0',state:'planned',phase:{executesAt:'combat_phase'},targeting:{mainTargetId:'e1',targetIds:['e1']}},
  {id:'p1s2',actorId:'p1',actionSlotId:'p1_slot_1',state:'planned',phase:{executesAt:'combat_phase'},targeting:{mainTargetId:'e1',targetIds:['e1']}},
  {id:'p2s1',actorId:'p2',actionSlotId:'p2_slot_0',state:'planned',phase:{executesAt:'combat_phase'},targeting:{mainTargetId:'e1',targetIds:['e1']}},
  {id:'p3s1',actorId:'p3',state:'planned',phase:{executesAt:'combat_phase'},targeting:{mainTargetId:'e1',targetIds:['e1']}},
  {id:'e1s1',actorId:'e1',state:'planned',phase:{executesAt:'combat_phase'},targeting:{mainTargetId:'p3',targetIds:['p3']}},
  {id:'e2s1',actorId:'e2',state:'planned',phase:{executesAt:'combat_phase'},targeting:{mainTargetId:'p1',targetIds:['p1']}},
  {id:'head1',actorId:'abno',metadata:{partId:'head'},state:'planned',phase:{executesAt:'combat_phase'},targeting:{mainTargetId:'p1',targetIds:['p1']}},
  {id:'arm1',actorId:'abno',metadata:{partId:'arm'},state:'planned',phase:{executesAt:'combat_phase'},targeting:{mainTargetId:'p1',targetIds:['p1']}},
];
const rolls = [0.8,0.2,0.5,0.7,0.1,0.9,0.4];
let ri = 0;
const speedSnapshot = queue.snapshotSpeedSources(units,{random:()=>rolls[ri++] ?? 0.5});
p1.speed = 1;
const round = queue.buildRoundOrder({actions,units,speedSnapshot,random:()=>0.99});
assert.equal(round.entries[0].actionId,'head1');
assert.equal(round.getSpeed('p1'),8);
assert.equal(round.getSpeed('abno','head'),9);
assert.equal(round.getSpeed('abno','arm'),4);
assert.deepEqual(round.entries.filter(x=>x.actorId==='p1').map(x=>x.speed),[8,8]);
assert.deepEqual(round.entries.filter(x=>x.actorId==='p1').map(x=>x.actionId),['p1s1','p1s2']);
assert.deepEqual(round.layout.allies.map(x=>x.actorId),['p2','p1','p3']);
assert.equal(round.layout.enemies.at(-1).actorId,'abno');
assert.equal(round.layout.enemies.at(-1).partId,'head');

const p1Entry = round.getEntry('p1s1');
const e1Entry = round.getEntry('e1s1');
const e2Entry = round.getEntry('e2s1');
assert.equal(queue.canForceClash({interceptorEntry:p1Entry,targetEntry:e1Entry}),true);
assert.equal(queue.canForceClash({interceptorEntry:e1Entry,targetEntry:p1Entry}),true);
const neutralTarget = {...p1Entry, action:{...p1Entry.action,targeting:{mainTargetId:'e2',targetIds:['e2']}}};
assert.equal(queue.canForceClash({interceptorEntry:e1Entry,targetEntry:neutralTarget}),false);
assert.equal(queue.canForceClash({interceptorEntry:e2Entry,targetEntry:p1Entry}),false);
assert.equal(queue.canForceClash({interceptorEntry:p1Entry,targetEntry:e2Entry}),true);

const sameA = {actorId:'p1',speed:7,action:{targeting:{targetIds:['x']}}};
const sameB = {actorId:'e1',speed:7,action:{targeting:{targetIds:['p3']}}};
assert.equal(queue.canForceClash({interceptorEntry:sameA,targetEntry:sameB}),false);

actions[0].state = 'resolving';
actions[1].state = 'planned';
const resolved = {id:'done',actorId:'p1',state:'resolved',phase:{executesAt:'combat_phase'},targeting:{}};
round.entries.push({action:resolved,actionId:'done',actorId:'p1',partId:null,speed:8});
const cancelled = queue.cancelActorActions(round,'p1',{type:'stagger'});
assert.ok(cancelled.includes('p1s1'));
assert.ok(cancelled.includes('p1s2'));
assert.equal(resolved.state,'resolved');
assert.equal(round.getSpeed('p1'),8);

const actor = {id:'a',faction:'allies',hp:20};
const A = {id:'A',faction:'enemies',hp:10};
const B = {id:'B',faction:'enemies',hp:10};
const C = {id:'C',faction:'enemies',hp:10};
const ally = {id:'ally',faction:'allies',hp:10};
let skill = {actorId:'a',targeting:{mainTargetId:'A',targetIds:['A'],attackWeight:1,allegiance:'enemy'},metadata:{sourceDefinition:{targetingType:'Focused Attack'}}};
let coin = queue.selectCoinTarget(skill,[actor,A,B,C]);
assert.equal(coin.targetId,'A');
A.hp = 0;
coin = queue.selectCoinTarget(skill,[actor,A,B,C],coin.state);
assert.equal(coin.cancelled,true);

A.hp = 10;
skill = {actorId:'a',targeting:{mainTargetId:'A',targetIds:['A'],attackWeight:1,allegiance:'enemy'},metadata:{sourceDefinition:{targetingType:'Unfocused Volley'}}};
let state = {};
coin = queue.selectCoinTarget(skill,[actor,A,B,C],state,{random:()=>0});
assert.equal(coin.targetId,'A'); state=coin.state;
coin = queue.selectCoinTarget(skill,[actor,A,B,C],state,{random:()=>0});
assert.equal(coin.targetId,'B'); state=coin.state;
coin = queue.selectCoinTarget(skill,[actor,A,B,C],state,{random:()=>0});
assert.equal(coin.targetId,'A');
B.hp=0; C.hp=0;
coin = queue.selectCoinTarget(skill,[actor,A,B,C],coin.state,{random:()=>0.9});
assert.equal(coin.targetId,'A');

B.hp=10; C.hp=10;
const indis = {actorId:'a',targeting:{mainTargetId:'A',targetIds:['A'],attackWeight:1,mode:'indiscriminate',indiscriminate:true},metadata:{sourceDefinition:{targetingType:'Unfocused Volley'}}};
const poolIds = queue.targetPool(indis,[actor,ally,A,B]).map(queue.entityId);
assert.ok(poolIds.includes('ally'));
assert.ok(poolIds.includes('A'));
assert.ok(!poolIds.includes('a'));

const weighted = {actorId:'a',targeting:{mainTargetId:'A',targetIds:['A','B'],attackWeight:2,allegiance:'enemy'},metadata:{sourceDefinition:{targetingType:'Unfocused Volley'}}};
assert.deepEqual(queue.targetPool(weighted,[actor,A,B,C]).map(queue.entityId),['A','B']);
A.hp=0; B.hp=0;
assert.equal(queue.selectCoinTarget(weighted,[actor,A,B,C],{}, {random:()=>0}).cancelled,true);

console.log('combat-action-queue smoke: ok');
