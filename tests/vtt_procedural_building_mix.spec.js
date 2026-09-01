const { test, expect } = require('@playwright/test');
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'..');
const FILES=[
  'js/vtt/topology.js','js/vtt/surface-core.js','js/vtt/horizontal-plane-core.js','js/vtt/building-physics-core.js',
  'js/vtt/semantic-map-core.js','js/vtt/building-semantic-core.js','js/vtt/building-archetype-core.js','js/vtt/vertical-portal.js','js/vtt/building-navigation-core.js',
  'js/vtt/procedural-zone-core.js','js/vtt/urban-fabric-core.js','js/vtt/procedural-building-generator.js','js/vtt/procedural-building-mix-patch.js','js/vtt/procedural-generator-core.js',
];
const KEYS=['LuminousVttTopology','LuminousVttSurfaceCore','LuminousVttHorizontalPlanes','LuminousVttBuildingPhysics','LuminousVttSemanticMap','LuminousVttBuildingSemantics','LuminousVttBuildingArchetypes','LuminousVttVerticalPortal','LuminousVttBuildingNavigation','LuminousVttProceduralZone','LuminousVttUrbanFabric','LuminousVttProceduralBuildings','LuminousVttProceduralGenerator'];
const ORIGINAL=new Map(KEYS.map(k=>[k,global[k]]));
const fresh=file=>{const resolved=require.resolve(path.join(ROOT,file));delete require.cache[resolved];return require(resolved);};
function reset(){for(const k of KEYS)delete global[k];for(const file of FILES)fresh(file);}
function restore(){for(const file of FILES){try{delete require.cache[require.resolve(path.join(ROOT,file))];}catch(_){}}for(const k of KEYS){const value=ORIGINAL.get(k);if(value===undefined)delete global[k];else global[k]=value;}}
test.beforeEach(reset);test.afterEach(restore);

function profileWithMix(profileId,buildingMix){return{...global.LuminousVttUrbanFabric.normalizeProfile(profileId),buildingMix};}
function archetypes(plan){return(plan.mapData?.semantics?.buildings||[]).map(building=>building.archetypeId);}

test('building mix patch normalizes the four canonical archetype weights',()=>{
  const buildings=global.LuminousVttProceduralBuildings;
  expect(buildings.__buildingMixAware).toBe(true);
  const mix=buildings.normalizeBuildingMix({shop:30,apartment_building:40,workshop:15,warehouse:15},'mixed_urban');
  expect(mix.shop).toBeCloseTo(.3,6);expect(mix.apartment_building).toBeCloseTo(.4,6);expect(mix.workshop).toBeCloseTo(.15,6);expect(mix.warehouse).toBeCloseTo(.15,6);
  expect(Object.values(mix).reduce((sum,value)=>sum+value,0)).toBeCloseTo(1,8);
});

test('custom all-shop mix drives real building archetype generation and still validates',()=>{
  const gen=global.LuminousVttProceduralGenerator,profile=profileWithMix('mixed_urban',{shop:1,apartment_building:0,workshop:0,warehouse:0});
  const plan=gen.generateZone({seed:'building-mix-all-shop',profileId:profile,maxAttempts:12});
  expect(plan.validation.valid).toBe(true);expect(plan.validation.summary.buildings).toBeGreaterThanOrEqual(4);
  expect(new Set(archetypes(plan))).toEqual(new Set(['shop']));expect(plan.fabric.profile.buildingMix.shop).toBe(1);
});

test('building mix remains deterministic and is part of the generated signature',()=>{
  const gen=global.LuminousVttProceduralGenerator;
  const shops=profileWithMix('mixed_urban',{shop:1,apartment_building:0,workshop:0,warehouse:0});
  const apartments=profileWithMix('mixed_urban',{shop:0,apartment_building:1,workshop:0,warehouse:0});
  const a=gen.generateZone({seed:'building-mix-repeatable',profileId:shops,maxAttempts:12});
  const b=gen.generateZone({seed:'building-mix-repeatable',profileId:shops,maxAttempts:12});
  const c=gen.generateZone({seed:'building-mix-repeatable',profileId:apartments,maxAttempts:12});
  expect(a.signature).toBe(b.signature);expect(archetypes(a)).toEqual(archetypes(b));
  expect(new Set(archetypes(a))).toEqual(new Set(['shop']));expect(new Set(archetypes(c))).toEqual(new Set(['apartment_building']));expect(c.signature).not.toBe(a.signature);
});

test('parcel size restrictions remain authoritative over a requested building mix',()=>{
  const buildings=global.LuminousVttProceduralBuildings,small={buildable:{minCol:0,minRow:0,maxCol:7,maxRow:7}};
  const eligible=buildings.eligibleWeights({shop:0,apartment_building:0,workshop:0,warehouse:1},small,'mixed_urban');
  expect(eligible.warehouse).toBe(0);expect(Object.values(eligible).reduce((sum,value)=>sum+value,0)).toBeCloseTo(1,8);
});

test('Zone Creator exposes and forwards editable Shops/Apartments/Workshops/Warehouses mix',()=>{
  const authoring=fs.readFileSync(path.join(ROOT,'js/vtt/procedural-generator-authoring-bootstrap.js'),'utf8'),runtime=fs.readFileSync(path.join(ROOT,'js/vtt/procedural-generator-bootstrap.js'),'utf8');
  expect(authoring).toContain('03 · BUILDING MIX');for(const name of ['shop','apartment','workshop','warehouse'])expect(authoring).toContain(`data-proc-mix=\"${name}\"`);
  expect(authoring).toContain('buildingMix:customBuildingMix()');expect(authoring).toContain('function rebalanceBuildingMix');expect(authoring).toContain('data-proc-mix-total');
  expect(runtime).toContain("import './procedural-building-mix-patch.js'");expect(runtime).toContain('buildingMix:');
});

test('building mix modules parse as JavaScript',()=>{
  execFileSync(process.execPath,['--check',path.join(ROOT,'js/vtt/procedural-building-mix-patch.js')],{stdio:'pipe'});
  for(const file of ['js/vtt/procedural-generator-bootstrap.js','js/vtt/procedural-generator-authoring-bootstrap.js'])execFileSync(process.execPath,['--input-type=module','--check'],{input:fs.readFileSync(path.join(ROOT,file),'utf8'),stdio:['pipe','pipe','pipe']});
});
