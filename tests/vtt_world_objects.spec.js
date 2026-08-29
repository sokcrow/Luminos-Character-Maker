const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test('world object library seeds twelve reusable definitions', async () => {
  const core = require('../js/vtt/world-object-core.js');
  global.LuminousVttWorldObjectCore = core;
  const catalog = require('../js/vtt/world-object-catalog.js');
  expect(catalog.definitions).toHaveLength(12);
  expect(catalog.get('locker_industrial').affordances.hideInside).toBe(true);
  expect(catalog.get('concrete_barrier').physical.blocksMovement).toBe(true);
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

test('world objects block token collision and A star until destroyed', async () => {
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
  expect(gate.valid).toBe(false);expect(gate.reason).toBe('BLOCKED_BY_WORLD_OBJECT');
  const route=pf.findPath({token,start:{x:35,y:105},target:{x:315,y:105},mapData,blockTokens:false});
  expect(route.valid).toBe(true);
  expect(route.cells.some(c=>c.col===2&&c.row===1)).toBe(false);
  blocker.state.destroyed=true;
  const openGate=global.LuminousVttTokenInteraction.canOccupy(token,{x:175,y:105},mapData);
  expect(openGate.valid).toBe(true);
});

test('VTT HUD exposes object library and custom object definition form', async () => {
  const html=fs.readFileSync(path.join(__dirname,'..','vtt.html'),'utf8');
  const main=fs.readFileSync(path.join(__dirname,'..','js','vtt','main.js'),'utf8');
  expect(html).toContain('id="vtt-object-library-toggle"');
  expect(html).toContain('id="vtt-object-definition-form"');
  expect(html).toContain('HIDE INSIDE');
  expect(main).toContain("import('./world-object-bootstrap.js')");
  expect(main).toContain('attachWorldObjectRenderer');
});