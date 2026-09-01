const { test, expect } = require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const FILES=[
  'js/vtt/topology.js','js/vtt/surface-core.js','js/vtt/horizontal-plane-core.js','js/vtt/building-physics-core.js',
  'js/vtt/semantic-map-core.js','js/vtt/building-semantic-core.js','js/vtt/building-archetype-core.js','js/vtt/vertical-portal.js','js/vtt/building-navigation-core.js',
  'js/vtt/procedural-zone-core.js','js/vtt/urban-fabric-core.js','js/vtt/procedural-building-generator.js','js/vtt/procedural-generator-core.js',
];
const KEYS=['LuminousVttTopology','LuminousVttSurfaceCore','LuminousVttHorizontalPlanes','LuminousVttBuildingPhysics','LuminousVttSemanticMap','LuminousVttBuildingSemantics','LuminousVttBuildingArchetypes','LuminousVttVerticalPortal','LuminousVttBuildingNavigation','LuminousVttProceduralZone','LuminousVttUrbanFabric','LuminousVttProceduralBuildings','LuminousVttProceduralGenerator'];
const ORIGINAL=new Map(KEYS.map(k=>[k,global[k]]));
function fresh(file){const resolved=require.resolve(path.join(ROOT,file));delete require.cache[resolved];return require(resolved);}
function reset(){for(const k of KEYS)delete global[k];for(let i=0;i<FILES.length;i++)global[KEYS[i]]=fresh(FILES[i]);}
function restore(){for(const f of FILES){try{delete require.cache[require.resolve(path.join(ROOT,f))];}catch(_){}}for(const k of KEYS){const v=ORIGINAL.get(k);if(v===undefined)delete global[k];else global[k]=v;}}
test.beforeEach(reset);test.afterEach(restore);

test('zone contract is 40x40 chunks with a 3x3 / 120x120 default zone',()=>{
  const core=global.LuminousVttProceduralZone,z=core.createZone({id:'z'});
  expect(z.chunkSize).toBe(40);expect(z.chunkCols).toBe(3);expect(z.chunkRows).toBe(3);expect(z.cols).toBe(120);expect(z.rows).toBe(120);
  expect(core.chunkForCell(z,39,39).id).toBe('z:chunk:0:0');expect(core.chunkForCell(z,40,40).id).toBe('z:chunk:1:1');expect(core.chunkForCell(z,119,119).id).toBe('z:chunk:2:2');
  expect(core.internalChunkBoundaries(z)).toEqual({vertical:[40,80],horizontal:[40,80]});
});

test('buildings and semantic rectangles may cross internal chunk boundaries without transitions',()=>{
  const core=global.LuminousVttProceduralZone,z=core.createZone({id:'z'}),chunks=core.chunksForRect(z,{minCol:35,minRow:10,maxCol:45,maxRow:20});
  expect(chunks.sort()).toEqual(['z:chunk:0:0','z:chunk:1:0']);expect(z.sockets).toEqual([]);
});

test('zone boundary sockets project to the opposite edge and retain continuity identity',()=>{
  const core=global.LuminousVttProceduralZone,z=core.createZone({id:'a',sockets:[{id:'road_e',edge:'east',type:'street',span:{fromCell:44,toCell:49},semanticId:'street_main_07'}]}),projected=core.continuationRequirements(z)[0],neighbor=core.createZone({id:'b',sockets:[projected]});
  expect(projected.edge).toBe('west');expect(projected.semanticId).toBe('street_main_07');expect(core.socketsCompatible(z.sockets[0],neighbor.sockets[0],z,neighbor)).toBe(true);
});

test('urban fabric is deterministic for a seed and does not encode chunk borders as streets',()=>{
  const zc=global.LuminousVttProceduralZone,fc=global.LuminousVttUrbanFabric,z=zc.createZone({id:'zone',seed:'same-seed'}),a=fc.generateFabricPlan(z,'mixed_urban',fc.createRng('same-seed')),b=fc.generateFabricPlan(z,'mixed_urban',fc.createRng('same-seed'));
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));expect(a.streets.some(s=>s.source==='chunk'||s.id.includes('chunk'))).toBe(false);expect(fc.validateFabric(a).valid).toBe(true);
});

test('fabric creates real parcels, attachment intent and semantic alleys without overlaps',()=>{
  const zc=global.LuminousVttProceduralZone,fc=global.LuminousVttUrbanFabric,z=zc.createZone({id:'dense',seed:'alleys'}),plan=fc.generateFabricPlan(z,'dense_backstreet',fc.createRng('alleys'));
  const validation=fc.validateFabric(plan);expect(validation.valid).toBe(true);expect(plan.parcels.length).toBeGreaterThan(3);expect(plan.edgeRelations.every(r=>['attached_buildings','alley'].includes(r.relation))).toBe(true);expect(plan.alleys.every(a=>['service_alley','passage_alley'].includes(a.alleyClass))).toBe(true);
});

test('required street boundary sockets are reserved by the generated street graph',()=>{
  const gen=global.LuminousVttProceduralGenerator,plan=gen.generateZone({seed:'socket-seed',profileId:'commercial',sockets:[{id:'north_main',edge:'north',type:'street',span:{fromCell:20,toCell:24},semanticId:'district_main_street'}]});
  expect(plan.validation.valid).toBe(true);expect(plan.fabric.streets.some(s=>s.socketId==='north_main'&&s.semanticId==='district_main_street')).toBe(true);expect(plan.validation.checks.boundary.valid).toBe(true);
});

test('every generated corridor that crosses a Zone boundary publishes an explicit continuation socket',()=>{
  const gen=global.LuminousVttProceduralGenerator,plan=gen.generateZone({seed:'continuity-seed',profileId:'mixed_urban'}),zone=plan.zone;
  for(const corridor of plan.fabric.streets){for(const spec of gen.corridorBoundarySpecs(plan.fabric,corridor)){expect(zone.sockets.some(s=>s.edge===spec.edge&&s.type===spec.type&&s.semanticId===spec.semanticId&&s.span.fromCell===spec.span.fromCell&&s.span.toCell===spec.span.toCell)).toBe(true);}}
  expect(plan.validation.checks.boundary.valid).toBe(true);
});

test('service-route sockets reserve a real non-buildable corridor and propagate through the opposite Zone edge',()=>{
  const gen=global.LuminousVttProceduralGenerator,fc=global.LuminousVttUrbanFabric,plan=gen.generateZone({seed:'service-socket',profileId:'industrial',sockets:[{id:'service_w',edge:'west',type:'service_route',span:{fromCell:30,toCell:32},semanticId:'service_spine'}]}),corridor=plan.fabric.streets.find(s=>s.semanticId==='service_spine');
  expect(corridor).toBeTruthy();expect(corridor.kind).toBe('alley');expect(plan.fabric.parcels.every(p=>!fc.intersects(p.geometry,corridor.geometry))).toBe(true);expect(plan.zone.sockets.some(s=>s.edge==='east'&&s.type==='service_route'&&s.semanticId==='service_spine')).toBe(true);expect(plan.validation.valid).toBe(true);
});

test('full procedural attempt passes semantics, archetypes, navigation and physical building validation',()=>{
  const gen=global.LuminousVttProceduralGenerator,plan=gen.generateZone({seed:'city-alpha',profileId:'mixed_urban'}),checks=plan.validation.checks;
  expect(plan.validation.valid).toBe(true);expect(plan.validation.summary.buildings).toBeGreaterThanOrEqual(4);expect(checks.semantic.valid).toBe(true);expect(checks.buildings.valid).toBe(true);expect(checks.archetypes.valid).toBe(true);expect(checks.navigation.valid).toBe(true);expect(checks.physics.valid).toBe(true);expect(plan.mapData.horizontalPlanes.length).toBe(plan.mapData.semantics.buildings.length);
});

test('same seed produces the same accepted signature and different reroll seed changes it',()=>{
  const gen=global.LuminousVttProceduralGenerator,a=gen.generateZone({seed:'repeatable',profileId:'residential'}),b=gen.generateZone({seed:'repeatable',profileId:'residential'}),c=gen.generateZone({seed:'repeatable:reroll:1',profileId:'residential'});
  expect(a.signature).toBe(b.signature);expect(a.attempt).toBe(b.attempt);expect(c.signature).not.toBe(a.signature);
});

test('generated archetypes expose their required semantic rooms and every building entrance references a physical door',()=>{
  const gen=global.LuminousVttProceduralGenerator,bc=global.LuminousVttBuildingSemantics,plan=gen.generateZone({seed:'archetypes',profileId:'commercial'}),s=plan.mapData.semantics,doors=new Map(plan.mapData.topology.filter(x=>x.type==='door').map(x=>[x.id,x]));
  for(const b of s.buildings){const areas=bc.areasOfBuilding(s,b.id),entrances=bc.entrancesOfBuilding(s,b.id);expect(entrances.length).toBeGreaterThan(0);expect(entrances.every(p=>doors.has(p.physicalRefId))).toBe(true);if(b.archetypeId==='shop'||b.archetypeId==='workshop'||b.archetypeId==='warehouse')expect(areas.some(a=>a.functionalType==='storage')).toBe(true);if(b.archetypeId==='apartment_building'){expect(areas.some(a=>a.functionalType==='circulation')).toBe(true);expect(areas.some(a=>a.functionalType==='apartment')).toBe(true);}}
});

test('building navigation can structurally route from an exterior Street or Alley node into every generated building',()=>{
  const gen=global.LuminousVttProceduralGenerator,nav=global.LuminousVttBuildingNavigation,plan=gen.generateZone({seed:'routes',profileId:'dense_backstreet'}),s=plan.mapData.semantics,m=plan.mapData;
  for(const b of s.buildings){const graph=nav.buildGraph(s,b.id,m),external=graph.nodes.find(n=>n.external),internal=graph.nodes.find(n=>!n.external&&n.semanticKind==='area');expect(external).toBeTruthy();expect(internal).toBeTruthy();const route=nav.shortestRoute(graph,external.id,internal.id,{mode:'structural',ignoreAccess:true});expect(route.found).toBe(true);}
});

test('applyPlan replaces generated scene data, keeps player tokens and projects surface terrain',()=>{
  const gen=global.LuminousVttProceduralGenerator,plan=gen.generateZone({seed:'apply-me',profileId:'industrial'}),mapData={id:'existing',name:'Existing',grid:{cols:30,rows:30,size:70,distancePerCell:5},zLevels:{'0':{zLayer:0}},topology:[{id:'old'}],tokens:[{id:'player_1',characterLink:{mode:'current_player'},x:70,y:70}],surfaceLayers:{}};
  gen.applyPlan(mapData,plan,{replaceScene:true});expect(mapData.grid.cols).toBe(120);expect(mapData.grid.rows).toBe(120);expect(mapData.tokens.map(x=>x.id)).toEqual(['player_1']);expect(mapData.topology.length).toBeGreaterThan(0);expect(mapData.horizontalPlanes.length).toBe(plan.validation.summary.buildings);expect(mapData.procedural.signature).toBe(plan.signature);expect(Object.keys(mapData.surfaceLayers['0']||{}).length).toBe(14400);expect(Object.keys(mapData.movement.terrain['0']||{}).length).toBe(14400);
});

test('runtime wiring exposes preview/apply and DM authoring uses explicit PREVIEW before APPLY',()=>{
  const runtime=fs.readFileSync(path.join(ROOT,'js/vtt/procedural-generator-bootstrap.js'),'utf8'),author=fs.readFileSync(path.join(ROOT,'js/vtt/procedural-generator-authoring-bootstrap.js'),'utf8'),semantic=fs.readFileSync(path.join(ROOT,'js/vtt/semantic-map-bootstrap.js'),'utf8');
  expect(runtime).toContain('generateAndApply');expect(runtime).toContain('continuationRequirements');expect(author).toContain('PREVIEW');expect(author).toContain('APPLY');expect(author).toContain('REROLL');expect(semantic).toContain('startProceduralGenerator');expect(semantic).toContain('startProceduralGeneratorAuthoring');
});

test('procedural modules parse as JavaScript',()=>{
  for(const f of ['js/vtt/procedural-zone-core.js','js/vtt/urban-fabric-core.js','js/vtt/procedural-building-generator.js','js/vtt/procedural-generator-core.js'])execFileSync(process.execPath,['--check',path.join(ROOT,f)],{stdio:'pipe'});
  for(const f of ['js/vtt/procedural-generator-bootstrap.js','js/vtt/procedural-generator-authoring-bootstrap.js','js/vtt/semantic-map-bootstrap.js'])execFileSync(process.execPath,['--input-type=module','--check'],{input:fs.readFileSync(path.join(ROOT,f),'utf8'),stdio:['pipe','pipe','pipe']});
});
