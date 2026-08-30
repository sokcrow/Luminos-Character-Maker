const {test,expect}=require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const streaming=require('../js/vtt/procedural-chunk-streaming-core.js');

const GEN_FILES=[
  'topology.js','surface-core.js','horizontal-plane-core.js','building-physics-core.js',
  'semantic-map-core.js','building-semantic-core.js','building-archetype-core.js','vertical-portal.js',
  'building-navigation-core.js','procedural-zone-core.js','urban-fabric-core.js',
  'procedural-building-generator.js','procedural-building-mix-patch.js','procedural-generator-core.js',
];
const GEN_KEYS=[
  'LuminousVttTopology','LuminousVttSurfaceCore','LuminousVttHorizontalPlanes','LuminousVttBuildingPhysics',
  'LuminousVttSemanticMap','LuminousVttBuildingSemantics','LuminousVttBuildingArchetypes','LuminousVttVerticalPortal',
  'LuminousVttBuildingNavigation','LuminousVttProceduralZone','LuminousVttUrbanFabric',
  'LuminousVttProceduralBuildings',null,'LuminousVttProceduralGenerator',
];
function withGenerator(run){
  const original=new Map(GEN_KEYS.filter(Boolean).map(key=>[key,global[key]]));
  try{
    for(let i=0;i<GEN_FILES.length;i++){
      const resolved=require.resolve(path.join(ROOT,'js/vtt',GEN_FILES[i]));delete require.cache[resolved];const loaded=require(resolved),key=GEN_KEYS[i];if(key&&loaded)global[key]=loaded;
    }
    return run(global.LuminousVttProceduralGenerator,global.LuminousVttUrbanFabric);
  }finally{
    for(const file of GEN_FILES){try{delete require.cache[require.resolve(path.join(ROOT,'js/vtt',file))];}catch(_){}}
    for(const key of GEN_KEYS.filter(Boolean)){const value=original.get(key);if(value===undefined)delete global[key];else global[key]=value;}
  }
}

function descriptor(){return streaming.createDescriptor({zoneId:'perf-zone',seed:'perf-seed',profileId:'mixed_urban',chunkCols:3,chunkRows:3});}

test('3x3 logical zone has a hard one-chunk 40x40 live performance budget',()=>{
  const d=descriptor(),budget=streaming.performanceBudget(d),grid=streaming.liveGrid({cols:120,rows:120,size:70,distancePerCell:5});
  expect(d).toMatchObject({chunkSize:40,chunkCols:3,chunkRows:3,logicalCols:120,logicalRows:120,activeChunk:{col:0,row:0}});
  expect(grid).toMatchObject({cols:40,rows:40,size:70});
  expect(budget).toEqual({liveCells:1600,logicalCells:14400,loadedChunks:1,logicalChunks:9,liveFraction:1/9});
});

test('every lazy chunk generation request is exactly 1x1 regardless of logical zone size',()=>{
  const d=descriptor();
  for(let row=0;row<3;row++)for(let col=0;col<3;col++){
    const options=streaming.chunkGenerationOptions(d,{col,row},{gridSize:70,maxAttempts:8});
    expect(options.chunkCols).toBe(1);expect(options.chunkRows).toBe(1);expect(options.minBuildings).toBe(1);
    expect(options.seed).toBe(`perf-seed:chunk:${col},${row}`);
  }
});

test('chunk seeds are deterministic without caching nine generated plans',()=>{
  const d=descriptor();
  expect(streaming.deriveChunkSeed(d.seed,{col:2,row:1})).toBe(streaming.deriveChunkSeed(d.seed,{col:2,row:1}));
  expect(streaming.deriveChunkSeed(d.seed,{col:2,row:1})).not.toBe(streaming.deriveChunkSeed(d.seed,{col:1,row:2}));
  expect(Object.keys(d)).not.toContain('plans');expect(Object.keys(d)).not.toContain('chunks');expect(JSON.stringify(d).length).toBeLessThan(4000);
});

test('edge and corner exits resolve to adjacent chunks and opposite entry cells',()=>{
  let d=descriptor();const grid={cols:40,rows:40,size:70};
  let t=streaming.resolveTransition(d,{x:2801,y:1400},grid);expect(t).toMatchObject({valid:true,target:{col:1,row:0},exit:{dx:1,dy:0}});
  expect(streaming.entryCell({x:2801,y:1400},grid,t.exit)).toMatchObject({col:0,row:20});
  d=streaming.withActiveChunk(d,{col:1,row:1});
  t=streaming.resolveTransition(d,{x:2801,y:2801},grid);expect(t).toMatchObject({valid:true,target:{col:2,row:2},exit:{dx:1,dy:1}});
  expect(streaming.entryCell({x:2801,y:2801},grid,t.exit)).toMatchObject({col:0,row:0});
  t=streaming.resolveTransition(d,{x:-1,y:-1},grid);expect(t).toMatchObject({valid:true,target:{col:0,row:0},exit:{dx:-1,dy:-1}});
  expect(streaming.entryCell({x:-1,y:-1},grid,t.exit)).toMatchObject({col:39,row:39});
});

test('outer logical-zone boundary is rejected instead of allocating another chunk',()=>{
  const d=descriptor(),grid={cols:40,rows:40,size:70};
  expect(streaming.resolveTransition(d,{x:-1,y:100},grid)).toMatchObject({valid:false,reason:'PROCEDURAL_ZONE_BOUNDARY',target:{col:-1,row:0}});
  const last=streaming.withActiveChunk(d,{col:2,row:2});
  expect(streaming.resolveTransition(last,{x:2801,y:2801},grid)).toMatchObject({valid:false,reason:'PROCEDURAL_ZONE_BOUNDARY',target:{col:3,row:3}});
});

test('a real streamed chunk generates and applies as 40x40 while preserving tokens',()=>withGenerator((generator,fabric)=>{
  const d=streaming.createDescriptor({...descriptor(),profile:fabric.normalizeProfile('mixed_urban')});
  const plan=generator.generateZone(streaming.chunkGenerationOptions(d,{col:1,row:2},{gridSize:70,maxAttempts:8,minBuildings:1}));
  expect(plan.validation.valid).toBe(true);expect(plan.mapData.grid).toMatchObject({cols:40,rows:40});expect(plan.surfaceCells).toHaveLength(1600);
  const token={id:'player-1',x:100,y:100},mapData={id:'perf-map',name:'Perf',grid:{cols:120,rows:120,size:70},tokens:[token],topology:[{id:'old'}],worldObjects:[{id:'old'}]};
  generator.applyPlan(mapData,plan,{replaceScene:true});
  expect(mapData.grid).toMatchObject({cols:40,rows:40});expect(mapData.tokens).toHaveLength(1);expect(mapData.tokens[0].id).toBe('player-1');expect(mapData.topology).not.toContainEqual({id:'old'});
}));

test('runtime intercepts create and mouseup so a multi-chunk zone never applies the 120x120 preview',()=>{
  const runtime=read('js/vtt/procedural-chunk-streaming-runtime.js'),bootstrap=read('js/vtt/semantic-map-bootstrap.js');
  expect(runtime).toContain("doc.addEventListener('click',captureCreate,true)");
  expect(runtime).toContain("window.addEventListener('mouseup',captureBoundaryTransition,true)");
  expect(runtime).toContain('procedural.apply(plan,{replaceScene:true,persist:false})');
  expect(runtime).toContain('core.chunkGenerationOptions(desc,coord');
  expect(runtime).toContain("mapData.proceduralEditor&&(mapData.proceduralEditor.previewPlan=null)");
  expect(bootstrap).toContain("from './procedural-chunk-streaming-runtime.js'");
  expect(bootstrap.indexOf('startProceduralChunkStreaming')).toBeLessThan(bootstrap.indexOf('startProceduralGeneratorAuthoring({runtime:window.LuminousVttRuntime,mapData})'));
});

test('streaming modules parse cleanly',()=>{
  execFileSync(process.execPath,['--check',path.join(ROOT,'js/vtt/procedural-chunk-streaming-core.js')],{stdio:'pipe'});
  execFileSync(process.execPath,['--input-type=module','--check'],{input:read('js/vtt/procedural-chunk-streaming-runtime.js'),stdio:['pipe','pipe','pipe']});
  execFileSync(process.execPath,['--input-type=module','--check'],{input:read('js/vtt/semantic-map-bootstrap.js'),stdio:['pipe','pipe','pipe']});
});
