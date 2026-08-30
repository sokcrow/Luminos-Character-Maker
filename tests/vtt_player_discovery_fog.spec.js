const {test,expect}=require('@playwright/test');
const core=require('../js/vtt/player-discovery-core.js');

const identity={worldId:'w',regionId:'K',zoneId:'K:1,2'};
const vision={polygon:[{x:0,y:0},{x:2800,y:0},{x:2800,y:2800},{x:0,y:2800}],tokenPos:{x:1400,y:1400},visionRadius:2000};

test('visible cells are stored as zone-global coordinates for the active chunk',()=>{
  const cells=core.visibleCells({...vision,gridSize:70,gridCols:40,gridRows:40,chunkCol:2,chunkRow:-1});
  expect(cells.length).toBeGreaterThan(0);expect(cells.length).toBeLessThanOrEqual(1600);
  expect(Math.min(...cells.map(c=>c.worldCol))).toBeGreaterThanOrEqual(80);
  expect(Math.max(...cells.map(c=>c.worldRow))).toBeLessThan(0);
});

test('discovery is idempotent and repeated vision does not create another write-worthy revision',()=>{
  const cells=[{worldCol:1,worldRow:1},{worldCol:2,worldRow:1}];
  let result=core.capture(core.blank(identity),{identity,zLayer:0,chunkCol:0,chunkRow:0,worldNow:100,cells});
  expect(result.changed).toBe(true);expect(result.newCells).toBe(2);expect(result.record.revision).toBe(1);
  result=core.capture(result.record,{identity,zLayer:0,chunkCol:0,chunkRow:0,worldNow:200,cells});
  expect(result.changed).toBe(false);expect(result.newCells).toBe(0);expect(result.record.revision).toBe(1);
});

test('player memory keeps the last seen door state until the door is visible again',()=>{
  const closed={id:'door-1',type:'door',state:'closed',a:{col:2,row:2},b:{col:3,row:2}};
  let result=core.capture(core.blank(identity),{identity,zLayer:0,chunkCol:0,chunkRow:0,worldNow:100,cells:[{worldCol:2,worldRow:2}],topology:[closed]});
  const key=Object.keys(result.record.layers['0'].topology)[0];
  expect(result.record.layers['0'].topology[key].state).toBe('closed');
  const liveOpen={...closed,state:'open'};
  expect(result.record.layers['0'].topology[key].state).toBe('closed');
  result=core.capture(result.record,{identity,zLayer:0,chunkCol:0,chunkRow:0,worldNow:300,cells:[],topology:[liveOpen]});
  expect(result.changed).toBe(true);expect(result.record.layers['0'].topology[key].state).toBe('open');
});

test('reconnect reconstruction restores explored cells and remembered topology for current chunk only',()=>{
  let record=core.blank(identity);
  record=core.capture(record,{identity,zLayer:1,chunkCol:2,chunkRow:1,worldNow:10,cells:[{worldCol:80,worldRow:40},{worldCol:81,worldRow:40}],topology:[{id:'wall-a',type:'wall',state:'default'}]}).record;
  record=core.capture(record,{identity,zLayer:1,chunkCol:3,chunkRow:1,worldNow:20,cells:[{worldCol:120,worldRow:40}],topology:[{id:'wall-b',type:'wall',state:'default'}]}).record;
  const serialized=JSON.parse(JSON.stringify(record));
  const restored=core.normalize(serialized,identity),slice=core.slice(restored,{identity,zLayer:1,chunkCol:2,chunkRow:1});
  expect(slice.cells).toEqual(expect.arrayContaining([{col:0,row:0},{col:1,row:0}]));
  expect(slice.topology.map(x=>x.id)).toEqual(['wall-a']);
});

test('concurrent reconnect records merge knowledge instead of losing one tab progress',()=>{
  const a=core.capture(core.blank(identity),{identity,zLayer:0,chunkCol:0,chunkRow:0,worldNow:100,cells:[{worldCol:1,worldRow:1}]}).record;
  const b=core.capture(core.blank(identity),{identity,zLayer:0,chunkCol:0,chunkRow:0,worldNow:110,cells:[{worldCol:8,worldRow:8}]}).record;
  const merged=core.merge(a,b),slice=core.slice(merged,{identity,zLayer:0,chunkCol:0,chunkRow:0});
  expect(slice.cells).toEqual(expect.arrayContaining([{col:1,row:1},{col:8,row:8}]));
  expect(core.metrics(merged).exploredCells).toBe(2);
});

test('eight players can retain different knowledge of the same zone without a global fog record',()=>{
  const records=Array.from({length:8},(_,i)=>core.capture(core.blank(identity),{identity,zLayer:0,chunkCol:0,chunkRow:0,worldNow:i+1,cells:[{worldCol:i,worldRow:i}]}).record);
  records.forEach((record,i)=>{const slice=core.slice(record,{identity,zLayer:0,chunkCol:0,chunkRow:0});expect(slice.cells).toEqual([{col:i,row:i}]);});
  expect(new Set(records.map(r=>JSON.stringify(r.layers))).size).toBe(8);
});

test('one fully explored chunk remains bounded at 1600 cells and compact row ranges',()=>{
  const cells=[];for(let row=0;row<40;row++)for(let col=0;col<40;col++)cells.push({worldCol:col,worldRow:row});
  const record=core.capture(core.blank(identity),{identity,zLayer:0,chunkCol:0,chunkRow:0,worldNow:1,cells}).record;
  const metrics=core.metrics(record);expect(metrics.exploredCells).toBe(1600);expect(metrics.discoveredChunks).toBe(1);
  for(const ranges of Object.values(record.layers['0'].rows))expect(ranges).toHaveLength(2);
});
