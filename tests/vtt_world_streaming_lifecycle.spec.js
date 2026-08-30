const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const core=require('../js/vtt/world-streaming-core.js');

test('world coordinates normalize across positive and negative chunk boundaries',()=>{
  const p=core.normalizeWorldPosition({worldId:'w',regionId:'r',zoneId:'z',chunkCol:2,chunkRow:3,x:40*70+35,y:-35},{cellSize:70,chunkSizeCells:40});
  expect(p.chunkCol).toBe(3);expect(p.chunkRow).toBe(2);expect(p.x).toBe(35);expect(p.y).toBe(40*70-35);
  expect(core.worldCell(p)).toEqual({col:120,row:119,z:0});
});

test('shared actors dedupe one ACTIVE chunk and release it to WARM then DORMANT',()=>{
  const manager=core.createLifecycleManager({warmTtlMs:100,maxWarmChunks:2,maxActiveChunks:8});
  const at=(id,col)=>({id,position:{worldId:'w',regionId:'r',zoneId:'z',chunkCol:col,chunkRow:0,x:10,y:10}});
  let state=manager.reconcile([at('a',0),at('b',0)],0);
  expect(state.metrics.activeChunks).toBe(1);expect(state.metrics.actorRefs).toBe(2);
  state=manager.reconcile([],10);expect(state.metrics.activeChunks).toBe(0);expect(state.metrics.warmChunks).toBe(1);
  state=manager.tick(111);expect(state.metrics.residentChunks).toBe(0);expect(state.dormant).toHaveLength(1);
});

test('eight separated players create at most eight live simulation bubbles',()=>{
  const manager=core.createLifecycleManager({warmTtlMs:0,maxWarmChunks:0,maxActiveChunks:8});
  const actors=Array.from({length:8},(_,i)=>({id:`p${i}`,position:{worldId:'w',regionId:'r',zoneId:`z${i}`,chunkCol:i*100,chunkRow:i*100,x:1,y:1}}));
  const state=manager.reconcile(actors,0);
  expect(state.metrics.activeChunks).toBe(8);expect(state.metrics.liveCells).toBe(8*40*40);expect(state.metrics.overActiveBudget).toBe(0);expect(state.metrics.residentChunks).toBe(8);
});

test('long travel stays memory bounded instead of retaining every visited chunk',()=>{
  const manager=core.createLifecycleManager({warmTtlMs:50,maxWarmChunks:3,maxActiveChunks:8});
  for(let col=0;col<2000;col++){
    manager.reconcile([{id:'traveler',position:{worldId:'w',regionId:'r',zoneId:'z',chunkCol:col,chunkRow:0,x:1,y:1}}],col*10);
    manager.tick(col*10+60);
    expect(manager.snapshot().residentChunks).toBeLessThanOrEqual(4);
  }
  const state=manager.snapshot();expect(state.activeChunks).toBe(1);expect(state.peakResidentChunks).toBeLessThanOrEqual(4);expect(state.dormantTransitions).toBeGreaterThan(1900);
});

test('dormant persistence record stores seed and delta without live scene payload',()=>{
  const record=core.createDormantRecord({position:{worldId:'w',regionId:'r',zoneId:'z',chunkCol:9,chunkRow:-4},seed:'abc',delta:{doors:{d1:'open'},removed:['crate-2']},revision:7,updatedAt:123});
  expect(record.state).toBe('DORMANT');expect(record.seed).toBe('abc');expect(record.delta).toEqual({doors:{d1:'open'},removed:['crate-2']});expect(record).not.toHaveProperty('geometry');expect(record).not.toHaveProperty('mapData');
});

test('world streaming modules parse cleanly and runtime exposes bounded lifecycle',()=>{
  execFileSync(process.execPath,['--check',path.join(ROOT,'js/vtt/world-streaming-core.js')]);
  execFileSync(process.execPath,['--input-type=module','--check'],{input:read('js/vtt/world-streaming-runtime.js'),stdio:['pipe','pipe','pipe']});
  const runtime=read('js/vtt/world-streaming-runtime.js');expect(runtime).toContain('maxActiveChunks:8');expect(runtime).toContain('maxWarmChunks:16');expect(runtime).toContain('worldPosition');
});
