const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test('world object library seeds sixteen reusable definitions including map utilities', async () => {
  const core = require('../js/vtt/world-object-core.js');
  global.LuminousVttWorldObjectCore = core;
  delete require.cache[require.resolve('../js/vtt/world-object-catalog.js')];
  const catalog = require('../js/vtt/world-object-catalog.js');
  expect(catalog.definitions).toHaveLength(16);
  expect(catalog.get('locker_industrial').affordances.hideInside).toBe(true);
  expect(catalog.get('concrete_barrier').physical.blocksMovement).toBe(true);
  expect(catalog.get('street_light').components.lightEmitter.brightFt).toBe(30);
  expect(catalog.get('wall_switch').components.switch.circuitId).toBe('street');
  expect(catalog.get('transformer_box').components.transformer.circuits).toContain('street');
  expect(catalog.get('portable_generator').components.powerSource.circuits).toContain('street');
});

test('definition and instance remain separate and use stable canonical ids', async () => {
  const core = require('../js/vtt/world-object-core.js');
  const def = core.normalizeDefinition({ id:'custom_crate', name:'Custom Crate', physical:{ hp:20 }, affordances:{ pushable:true } });
  const inst = core.createInstance(def,{ mapId:'warehouse', position:{ x:105,y:175,zLayer:2 } });
  expect(def.id).toBe('object:custom_crate');
  expect(inst.definitionId).toBe(def.id);
  expect(inst.mapId).toBe('warehouse');
  expect(inst.position.zLayer).toBe(2);
});

test('world component defaults are normalized into persistent instance state', async () => {
  const core = require('../js/vtt/world-object-core.js');
  const def = core.normalizeDefinition({ id:'lamp', physical:{blocksMovement:false}, components:{ lightEmitter:{enabled:true,brightFt:20}, switch:{circuitId:'room',stateDefault:'off'} } });
  const inst = core.createInstance(def,{});
  expect(def.schemaVersion).toBe(2);
  expect(def.affordances.usable).toBe(true);
  expect(inst.state.components.lightEnabled).toBe(true);
  expect(inst.state.components.switchState).toBe('off');
});

test('affordance engine exposes actions instead of hard coding object types', async () => {
  const core = require('../js/vtt/world-object-core.js');
  global.LuminousVttWorldObjectCore = core;
  delete require.cache[require.resolve('../js/vtt/environment-affordance-engine.js')];
  const actions = require('../js/vtt/environment-affordance-engine.js');
  const def = core.normalizeDefinition({ id:'locker', physical:{hp:20}, affordances:{openable:true,lockable:true,breakable:true,hideInside:true} });
  const inst = core.createInstance(def,{});
  expect(actions.availableActions(inst,def,{isDm:true})).toEqual(expect.arrayContaining(['open','lock','break','hide_inside','delete','rotate']));
  const opened = actions.applyAction(inst,def,'open');
  expect(opened.ok).toBe(true);
  expect(opened.instance.state.open).toBe(true);
});

test('use toggles canonical electrical component state', async () => {
  const core = require('../js/vtt/world-object-core.js');
  global.LuminousVttWorldObjectCore = core;
  delete require.cache[require.resolve('../js/vtt/environment-affordance-engine.js')];
  const actions = require('../js/vtt/environment-affordance-engine.js');
  const def = core.normalizeDefinition({ id:'switch', physical:{blocksMovement:false}, components:{switch:{circuitId:'street',stateDefault:'on'}} });
  const inst = core.createInstance(def,{});
  const used = actions.applyAction(inst,def,'use');
  expect(used.ok).toBe(true);
  expect(used.instance.state.components.switchState).toBe('off');
});

test('world objects block token collision and A star until destroyed', async () => {
  const previousWindow = global.window;
  const previousCore = global.LuminousVttWorldObjectCore;
  const previousCatalog = global.LuminousVttWorldObjectCatalog;
  const previousInteraction = global.LuminousVttTokenInteraction;
  const previousPathfinding = global.LuminousVttPathfinding;
  try {
    delete global.window;
    delete require.cache[require.resolve('../js/vtt/world-object-core.js')];
    const core = require('../js/vtt/world-object-core.js');
    global.LuminousVttWorldObjectCore = core;
    delete require.cache[require.resolve('../js/vtt/world-object-catalog.js')];
    const catalog = require('../js/vtt/world-object-catalog.js');
    global.LuminousVttWorldObjectCatalog = catalog;
    delete require.cache[require.resolve('../js/vtt/token-interaction.js')];
    global.LuminousVttTokenInteraction = require('../js/vtt/token-interaction.js');
    delete require.cache[require.resolve('../js/vtt/world-object-movement-patch.js')];
    require('../js/vtt/world-object-movement-patch.js');
    delete require.cache[require.resolve('../js/vtt/pathfinding.js')];
    const pf = require('../js/vtt/pathfinding.js');
    const def = catalog.get('crate_wooden');
    const blocker = core.createInstance(def,{instanceId:'crate_a',position:{x:175,y:105,zLayer:0}});
    const mapData={grid:{cols:5,rows:3,size:70,distancePerCell:5},walls:[],topology:[],tokens:[],worldObjects:[blocker],worldObjectDefinitions:{}};
    const token={id:'p1',x:35,y:105,zLayer:0,radius:20};
    const gate=global.LuminousVttTokenInteraction.canOccupy(token,{x:175,y:105},mapData);
    expect(gate.valid).toBe(false);
    expect(gate.reason).toBe('BLOCKED_BY_WORLD_OBJECT');
    const route=pf.findPath({token,start:{x:35,y:105},target:{x:315,y:105},mapData,blockTokens:false});
    expect(route.valid).toBe(true);
    expect(route.cells.some(c=>c.col===2&&c.row===1)).toBe(false);
    blocker.state.destroyed=true;
    expect(global.LuminousVttTokenInteraction.canOccupy(token,{x:175,y:105},mapData).valid).toBe(true);
  } finally {
    if (previousWindow === undefined) delete global.window;
    else global.window = previousWindow;
    global.LuminousVttWorldObjectCore = previousCore;
    global.LuminousVttWorldObjectCatalog = previousCatalog;
    global.LuminousVttTokenInteraction = previousInteraction;
    global.LuminousVttPathfinding = previousPathfinding;
  }
});

test('mainline world-object patch preserves movement resolveDrop and prior path blockers', async () => {
  const core = require('../js/vtt/world-object-core.js');
  global.LuminousVttWorldObjectCore = core;
  const sentinelResolveDrop = () => ({ valid:true, marker:'movement-engine' });
  global.LuminousVttTokenInteraction = Object.freeze({
    __pathfindingMovementPatch:true,
    tokenRadius:()=>10,
    canOccupy:()=>({valid:true,reason:null}),
    isPathClear:()=>({valid:false,reason:'WALL_BLOCKED'}),
    resolveDrop:sentinelResolveDrop,
  });
  delete require.cache[require.resolve('../js/vtt/world-object-movement-patch.js')];
  require('../js/vtt/world-object-movement-patch.js');
  expect(global.LuminousVttTokenInteraction.resolveDrop).toBe(sentinelResolveDrop);
  expect(global.LuminousVttTokenInteraction.isPathClear({}, {x:0,y:0}, {x:10,y:0}, {grid:{size:70}})).toMatchObject({valid:false,reason:'WALL_BLOCKED'});
});

test('quarter-turn rotation also rotates rectangular collision footprint', async () => {
  const core = require('../js/vtt/world-object-core.js');
  const def = core.normalizeDefinition({ id:'long_table', physical:{ footprint:{widthCells:2,heightCells:1}, hp:20 } });
  const inst = core.createInstance(def,{ position:{x:140,y:140,zLayer:0}, rotationDeg:90 });
  const rect = core.footprintRect(inst,def,{size:70});
  expect(rect.width).toBe(70);
  expect(rect.height).toBe(140);
});

test('mainline integration keeps the hardened runtime and docks Objects in DM Edit', async () => {
  const main=fs.readFileSync(path.join(__dirname,'..','js','vtt','main.js'),'utf8');
  const integration=fs.readFileSync(path.join(__dirname,'..','js','vtt','world-object-mainline-integration.js'),'utf8');
  expect(main).toContain("import('./world-object-mainline-integration.js')");
  expect(main).toContain("await import('./map-hud-bootstrap.js')");
  expect(main).toContain('window.LuminousVttRuntime = Object.freeze');
  expect(integration).toContain("panel.id = 'vtt-object-library'");
  expect(integration).toContain("toggle.id = 'vtt-object-library-toggle'");
  expect(integration).toContain("document.getElementById('vtt-edit-sidebar')");
  expect(integration).toContain('attachWorldObjectRenderer');
  expect(integration).toContain('Object.freeze({ ...currentRuntime, worldObjects: publicApi })');
  expect(integration).toContain('const publicApi = Object.freeze({ ...api, stop })');
  expect(integration).toContain('HIDE INSIDE');
  expect(integration).toContain('WORLD COMPONENTS');
});
