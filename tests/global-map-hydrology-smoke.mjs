import assert from 'node:assert/strict';
await import('../js/global-map-core.js');
import Hydrology, {
  GENERATOR_VERSION,
  moistureScore,
  sourceScore,
  planHydrology,
  applyHydrology,
} from '../js/global-map-hydrology.js';

const Core = globalThis.LuminousGlobalMapCore;
assert.ok(Core, 'global map core must load');

const rect = (x, y, w = 700, h = 500) => ([
  { xKm:x, yKm:y },
  { xKm:x + w, yKm:y },
  { xKm:x + w, yKm:y + h },
  { xKm:x, yKm:y + h },
]);

const regions = [
  { id:'gNW', name:'Costa Boscosa', layer:'terrain', terrain:'forest', source:'procedural', polygon:rect(0,0) },
  { id:'gN', name:'Paso Frío', layer:'terrain', terrain:'arctic', source:'procedural', polygon:rect(800,0) },
  { id:'gNE', name:'Crestas Nevadas', layer:'terrain', terrain:'arctic', source:'procedural', polygon:rect(1600,0) },
  { id:'gC', name:'Colinas Templadas', layer:'terrain', terrain:'temperate', source:'procedural', polygon:rect(800,700) },
  { id:'gSW', name:'Bosque Bajo', layer:'terrain', terrain:'forest', source:'procedural', polygon:rect(0,1400) },
  { id:'gS', name:'Pradera de Robles', layer:'terrain', terrain:'grassland', source:'procedural', polygon:rect(800,1400) },
  { id:'gSE', name:'Costa Árida', layer:'terrain', terrain:'desert', source:'procedural', polygon:rect(1600,1400) },
];

const doc = Core.normalizeDocument({
  worldId:'hydrology_test',
  seed:'world-hydro-777',
  bounds:{ widthKm:3000, heightKm:2400 },
  regions,
  markers:[],
  routes:[],
});

assert.ok(moistureScore(regions[0]) > moistureScore(regions[6]), 'forest must score wetter than desert');
assert.ok(sourceScore(regions[2]) >= sourceScore(regions[6]), 'snowy crest must be at least as valid a river source as desert');

const a = planHydrology(doc);
const b = planHydrology(doc);
assert.equal(a.version, GENERATOR_VERSION);
assert.deepEqual(a, b, 'hydrology plan must be deterministic');
assert.equal(a.lakes.length, 1, 'seven-region fixture should produce one lake');
assert.equal(a.rivers.length, 1, 'seven-region fixture should produce one river');

const lake = a.lakes[0];
assert.equal(lake.layer, 'water');
assert.equal(lake.terrain, 'lake');
assert.equal(lake.metadata.waterType, 'lake');
assert.equal(lake.metadata.generatedBy, GENERATOR_VERSION);
assert.ok(lake.polygon.length >= 8);

const river = a.rivers[0];
assert.equal(river.type, 'waterway');
assert.equal(river.metadata.waterType, 'river');
assert.equal(river.metadata.generatedBy, GENERATOR_VERSION);
assert.ok(river.points.length >= 6);
assert.ok(river.metadata.riverWidthKm >= 2);
assert.ok(river.metadata.flow >= 0 && river.metadata.flow <= 1);

const applied = applyHydrology(doc, Core);
assert.equal(applied.changed, true);
assert.equal(applied.addedLakes, 1);
assert.equal(applied.addedRivers, 1);
assert.ok(applied.document.regions.some(region => region.id === lake.id && region.layer === 'water'));
assert.ok(applied.document.routes.some(route => route.id === river.id && route.type === 'waterway'));

const rerun = applyHydrology(applied.document, Core);
assert.equal(rerun.changed, false, 'rerunning hydrology must not duplicate generated water');
assert.equal(rerun.addedLakes, 0);
assert.equal(rerun.addedRivers, 0);

const existingWaterDoc = Core.upsertRegion(doc, {
  id:'existing_lake',
  name:'Existing Lake',
  layer:'water',
  terrain:'lake',
  source:'campaign',
  polygon:rect(2400,400,300,300),
  metadata:null,
});
const existingPlan = planHydrology(existingWaterDoc);
assert.equal(existingPlan.lakes.length, 0, 'existing water bodies suppress auto-adding a new lake');
assert.equal(existingPlan.rivers.length, 1, 'existing water can still serve as a river target');

console.log('global map hydrology smoke: ok');
