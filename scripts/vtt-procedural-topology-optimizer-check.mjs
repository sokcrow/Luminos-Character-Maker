import assert from 'node:assert/strict';
await import('../js/vtt/topology.js');
await import('../js/vtt/procedural-topology-optimizer.js');

const optimizer=globalThis.LuminousVttProceduralTopologyOptimizer;
assert.ok(optimizer?.optimizeTopology,'optimizer API must load');
const wall=(id,from,to,extra={})=>({id,type:'wall',from,to,z:[0],thicknessFt:.5,procedural:{generated:true,zoneId:'zone',buildingId:'b1',parcelId:'p1'},...extra});
const opening=(type,id,from,to,extra={})=>({id,type,from,to,z:[0],state:'closed',thicknessFt:0,procedural:{generated:true,zoneId:'zone',buildingId:'b1',parcelId:'p1'},...extra});

let raw=[];
for(let x=0;x<20;x++){raw.push(wall(`n${x}`,{col:x,row:0},{col:x+1,row:0}));raw.push(wall(`s${x}`,{col:x,row:20},{col:x+1,row:20}));}
for(let y=0;y<20;y++){raw.push(wall(`w${y}`,{col:0,row:y},{col:0,row:y+1}));raw.push(wall(`e${y}`,{col:20,row:y},{col:20,row:y+1}));}
let result=optimizer.optimizeTopology(raw,{buildingCount:1});
assert.equal(result.metrics.rawWallSegments,80);
assert.equal(result.metrics.optimizedWallSegments,4);
assert.equal(result.topology.length,4);
assert.ok(result.metrics.reductionPercent>=95);
assert.equal(result.topology[0].sourceIds.length,20);
assert.equal(result.sourceIdMap.n19,result.topology.find(x=>x.sourceIds.includes('n19')).id);

raw=[
  wall('a',{col:0,row:0},{col:1,row:0}),wall('b',{col:1,row:0},{col:2,row:0}),
  opening('door','d',{col:2,row:0},{col:3,row:0}),
  wall('c',{col:3,row:0},{col:4,row:0}),
  opening('window','win',{col:4,row:0},{col:5,row:0}),
  wall('e',{col:5,row:0},{col:6,row:0}),
  opening('curtain_window','curtain',{col:6,row:0},{col:7,row:0}),
  wall('f',{col:7,row:0},{col:8,row:0}),wall('g',{col:8,row:0},{col:9,row:0}),
];
result=optimizer.optimizeTopology(raw);
assert.deepEqual(result.topology.map(x=>x.type),['wall','door','wall','window','wall','curtain_window','wall']);
assert.deepEqual(result.topology[0].to,{col:2,row:0});
assert.deepEqual(result.topology.at(-1).from,{col:7,row:0});
assert.deepEqual(result.topology.at(-1).to,{col:9,row:0});

assert.equal(optimizer.optimizeTopology([wall('c1',{col:0,row:0},{col:1,row:0}),wall('c2',{col:1,row:0},{col:1,row:1})]).topology.length,2);
assert.equal(optimizer.optimizeTopology([wall('z0',{col:0,row:0},{col:1,row:0},{z:[0]}),wall('z1',{col:1,row:0},{col:2,row:0},{z:[1]})]).topology.length,2);
assert.equal(optimizer.optimizeTopology([wall('stone',{col:0,row:0},{col:1,row:0},{materialId:'stone'}),wall('wood',{col:1,row:0},{col:2,row:0},{materialId:'wood'})]).topology.length,2);
assert.equal(optimizer.optimizeTopology([wall('block',{col:0,row:0},{col:1,row:0},{blocksVision:true}),wall('see',{col:1,row:0},{col:2,row:0},{blocksVision:false})]).topology.length,2);
assert.equal(optimizer.optimizeTopology([wall('b1',{col:0,row:0},{col:1,row:0}),wall('b2',{col:1,row:0},{col:2,row:0},{procedural:{generated:true,zoneId:'zone',buildingId:'b2',parcelId:'p2'}})]).topology.length,2);

raw=[];
for(let x=0;x<10;x++)raw.push(x===5?opening('door','insideDoor',{col:x,row:5},{col:x+1,row:5}):wall(`inside${x}`,{col:x,row:5},{col:x+1,row:5}));
result=optimizer.optimizeTopology(raw);
assert.deepEqual(result.topology.map(x=>x.type),['wall','door','wall']);
assert.equal(result.metrics.optimizedWallSegments,2);

console.log('vtt procedural topology optimizer: ok');
