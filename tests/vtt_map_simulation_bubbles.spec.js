const {test,expect}=require('@playwright/test');
const core=require('../js/vtt/map-simulation-core.js');

const position=(zone,chunk=0)=>({worldId:'luminous',regionId:'K',zoneId:zone,chunkCol:chunk,chunkRow:0,x:35,y:35});
const actor=(id,zone)=>({id,position:position(zone)});

function releaseDormant(store,lifecycle){
  for(const entry of lifecycle.dormant)store.forget(entry.identity,{onlyPristine:false});
}

test('actors sharing a Zone share one ACTIVE simulation bubble',()=>{
  const manager=core.createSimulationBubbleManager({warmTtlMs:100,maxWarmZones:2,maxActiveZones:8});
  let state=manager.reconcile([actor('p1','villa'),actor('p2','villa')],0);
  expect(state.metrics.activeZones).toBe(1);
  expect(state.metrics.actorRefs).toBe(2);
  expect(state.metrics.uniqueActors).toBe(2);
  expect(manager.entryOf(position('villa')).actorIds.sort()).toEqual(['p1','p2']);

  state=manager.reconcile([actor('p1','villa')],10);
  expect(state.metrics.activeZones).toBe(1);
  expect(state.metrics.actorRefs).toBe(1);
  state=manager.reconcile([],20);
  expect(state.metrics.activeZones).toBe(0);
  expect(state.metrics.warmZones).toBe(1);
  state=manager.tick(121);
  expect(state.metrics.residentZones).toBe(0);
  expect(state.dormant).toHaveLength(1);
});

test('eight separated players create exactly eight ACTIVE Zone bubbles',()=>{
  const manager=core.createSimulationBubbleManager({warmTtlMs:0,maxWarmZones:0,maxActiveZones:8});
  const players=Array.from({length:8},(_,i)=>actor(`p${i+1}`,`zone_${i+1}`));
  const state=manager.reconcile(players,0);
  expect(state.metrics.activeZones).toBe(8);
  expect(state.metrics.residentZones).toBe(8);
  expect(state.metrics.actorRefs).toBe(8);
  expect(state.metrics.overActiveBudget).toBe(0);
  expect(state.metrics.peakActiveZones).toBe(8);
});

test('two thousand visited Zones keep resident lifecycle and local persistence memory bounded',()=>{
  const manager=core.createSimulationBubbleManager({warmTtlMs:25,maxWarmZones:3,maxActiveZones:8});
  const store=core.createDeltaStore();
  let peakRecords=0;
  for(let i=0;i<2000;i++){
    const identity=position(`travel_${i}`);
    const state=manager.reconcile([actor('traveler',`travel_${i}`)],i*10);
    for(const active of state.activated)store.ensure(active.identity,{seed:`seed_${i}`});
    releaseDormant(store,state);
    const tick=manager.tick(i*10+30);
    releaseDormant(store,tick);
    peakRecords=Math.max(peakRecords,store.metrics().records);
    expect(manager.snapshot().residentZones).toBeLessThanOrEqual(4);
    expect(store.metrics().records).toBeLessThanOrEqual(4);
    expect(core.zoneKey(identity)).toContain(`travel_${i}`);
  }
  expect(manager.snapshot().activeZones).toBe(1);
  expect(manager.snapshot().peakResidentZones).toBeLessThanOrEqual(4);
  expect(manager.snapshot().dormantTransitions).toBeGreaterThan(1900);
  expect(peakRecords).toBeLessThanOrEqual(4);
});

test('PERSISTENT and PINNED are durable flags but do not force a Zone to stay resident',()=>{
  const manager=core.createSimulationBubbleManager({warmTtlMs:10,maxWarmZones:1,maxActiveZones:8});
  const zone=position('base');
  manager.setFlags(zone,{persistent:true,pinned:true});
  let state=manager.reconcile([actor('p1','base')],0);
  expect(state.metrics.persistentZones).toBe(1);
  expect(state.metrics.pinnedZones).toBe(1);
  expect(manager.entryOf(zone).pinned).toBe(true);
  manager.reconcile([],1);
  state=manager.tick(12);
  expect(state.metrics.residentZones).toBe(0);
  expect(manager.stateOf(zone)).toBe('DORMANT');
});

test('Seed + Delta compacts repeated entity changes by stable id and reconstructs baseline',()=>{
  const store=core.createDeltaStore();
  const zone=position('warehouse');
  store.ensure(zone,{seed:'warehouse-seed',generatorVersion:'worldgen_1'});
  store.recordEntityChange(zone,{entityId:'door_1',kind:'world_object',operation:'upsert',patch:{instanceId:'door_1',open:true},updatedAt:10});
  store.recordEntityChange(zone,{entityId:'door_1',kind:'world_object',operation:'upsert',patch:{hp:4},updatedAt:11});
  store.recordEntityChange(zone,{entityId:'crate_1',kind:'world_object',operation:'remove',updatedAt:12});
  store.recordEntityChange(zone,{entityId:'lamp_1',kind:'world_object',operation:'add',patch:{instanceId:'lamp_1',on:true},updatedAt:13});

  const record=store.get(zone,20);
  expect(record.seed).toBe('warehouse-seed');
  expect(record.generatorVersion).toBe('worldgen_1');
  expect(Object.keys(record.entities)).toHaveLength(3);
  expect(record.entities.door_1.patch).toMatchObject({instanceId:'door_1',open:true,hp:4});
  expect(record).not.toHaveProperty('mapData');
  expect(record).not.toHaveProperty('geometry');
  expect(JSON.stringify(record)).not.toContain('14000');

  const baseline=[{instanceId:'door_1',open:false,hp:10},{instanceId:'crate_1',loot:['item']},{instanceId:'bench_1'}];
  const restored=core.applyEntityDeltas(baseline,record,{kind:'world_object'});
  expect(restored.find(x=>x.instanceId==='door_1')).toMatchObject({open:true,hp:4});
  expect(restored.some(x=>x.instanceId==='crate_1')).toBe(false);
  expect(restored.find(x=>x.instanceId==='lamp_1')).toMatchObject({on:true});
  expect(restored.some(x=>x.instanceId==='bench_1')).toBe(true);
});

test('temporary state expires from WorldClock timestamps without continuous simulation',()=>{
  const store=core.createDeltaStore();
  const zone=position('street');
  store.recordTemporary(zone,{temporaryId:'blood_1',kind:'blood',payload:{size:2},createdAt:100,expiresAt:500});
  expect(store.get(zone,499).temporary.blood_1).toBeTruthy();
  expect(store.pruneExpired(zone,500)).toBe(1);
  expect(store.get(zone,500).temporary.blood_1).toBeUndefined();
});

test('imported dormant records preserve unexpired temporary state until current WorldClock is applied',()=>{
  const store=core.createDeltaStore();
  const imported=store.importRecord({identity:{worldId:'luminous',regionId:'K',zoneId:'alley'},seed:'s',generatorVersion:'worldgen_1',revision:3,updatedAt:100,lastSimulatedAt:100,temporary:{smoke_1:{temporaryId:'smoke_1',kind:'smoke',payload:{density:1},createdAt:100,expiresAt:1000}},entities:{}});
  expect(imported.temporary.smoke_1).toBeTruthy();
  expect(store.get(imported.identity,999).temporary.smoke_1).toBeTruthy();
  expect(store.get(imported.identity,1000).temporary.smoke_1).toBeUndefined();
});

test('delta caps fail loudly instead of silently growing an unbounded Zone payload',()=>{
  const store=core.createDeltaStore({maxDeltaEntities:2,maxTemporaryEntities:1});
  const zone=position('cap');
  store.recordEntityChange(zone,{entityId:'a',patch:{x:1},updatedAt:1});
  store.recordEntityChange(zone,{entityId:'b',patch:{x:2},updatedAt:2});
  expect(()=>store.recordEntityChange(zone,{entityId:'c',patch:{x:3},updatedAt:3})).toThrow('MAP_DELTA_ENTITY_CAP_EXCEEDED');
  store.recordTemporary(zone,{temporaryId:'t1',createdAt:1,expiresAt:10});
  expect(()=>store.recordTemporary(zone,{temporaryId:'t2',createdAt:1,expiresAt:10})).toThrow('MAP_TEMPORARY_ENTITY_CAP_EXCEEDED');
});
