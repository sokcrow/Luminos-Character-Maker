const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function loadWorld() {
  const core = require('../js/vtt/world-object-core.js');
  global.LuminousVttWorldObjectCore = core;
  delete require.cache[require.resolve('../js/vtt/world-object-catalog.js')];
  const catalog = require('../js/vtt/world-object-catalog.js');
  global.LuminousVttWorldObjectCatalog = catalog;
  delete global.LuminousVttLightingEngine;
  delete require.cache[require.resolve('../js/vtt/physical-resolver.js')];
  const physical = require('../js/vtt/physical-resolver.js');
  global.LuminousVttPhysicalResolver = physical;
  delete require.cache[require.resolve('../js/vtt/environment-affordance-engine.js')];
  const afford = require('../js/vtt/environment-affordance-engine.js');
  global.LuminousVttEnvironmentAffordances = afford;
  return { core, catalog, physical, afford };
}

test('camera follow defaults to player token, preserves zoom and releases on manual pan', async () => {
  const previousCustomEvent = global.CustomEvent;
  if (typeof global.CustomEvent !== 'function') global.CustomEvent = class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } };
  delete require.cache[require.resolve('../js/vtt/camera-follow.js')];
  const followApi = require('../js/vtt/camera-follow.js');
  const listeners = new Map();
  let manualPan = null;
  const camera = {
    x: 0, y: 0, zoom: 2,
    centerOnWorldPoint(point) { this.x = 200 - point.x; this.y = 150 - point.y; return true; },
    setManualPanListener(listener) { manualPan = listener; },
  };
  const canvas = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
    dispatchEvent() {},
  };
  const mapData = { tokens: [{ id:'p1', x:100, y:50, viewer:true, zLayer:0 }] };
  const runtime = { bridge:{isDm:false}, engine:{camera,canvas}, lighting:{controlledViewers:()=>mapData.tokens} };
  const host = { LuminousVttRuntime:runtime, setInterval:()=>1, clearInterval:()=>{}, setTimeout:(fn)=>fn() };
  const controller = followApi.createController({ runtime, mapData, root:host });
  expect(controller.state().enabled).toBe(true);
  expect(controller.state().targetId).toBe('p1');
  expect(camera.zoom).toBe(2);
  expect(camera.x).toBe(100);
  expect(camera.y).toBe(100);
  manualPan?.({dx:10,dy:0});
  expect(controller.state().enabled).toBe(false);
  controller.recenter();
  expect(controller.state().enabled).toBe(true);
  controller.stop();
  if (previousCustomEvent === undefined) delete global.CustomEvent; else global.CustomEvent = previousCustomEvent;
});

test('DM camera remains free until an explicit token preview exists', async () => {
  delete require.cache[require.resolve('../js/vtt/camera-follow.js')];
  const followApi = require('../js/vtt/camera-follow.js');
  const camera = { zoom:1, centerOnWorldPoint:()=>true, setManualPanListener:()=>{} };
  const canvas = { addEventListener:()=>{}, removeEventListener:()=>{}, dispatchEvent:()=>{} };
  const mapData = { lighting:{dmPreviewTokenId:null}, tokens:[{id:'npc',x:10,y:10}] };
  const runtime = { bridge:{isDm:true}, engine:{camera,canvas} };
  const host = { LuminousVttRuntime:runtime, setInterval:()=>1, clearInterval:()=>{}, setTimeout:()=>{} };
  const controller = followApi.createController({runtime,mapData,root:host});
  expect(controller.state()).toMatchObject({enabled:false,hasTarget:false,isDm:true});
  mapData.lighting.dmPreviewTokenId='npc';
  expect(controller.state().hasTarget).toBe(true);
  controller.stop();
});

test('upper-floor token elevation stays absolute while object offsets stay floor-relative', async () => {
  const { core, catalog, physical } = loadWorld();
  const mapData = { grid:{size:70,distancePerCell:5}, zLevels:{'1':{elevationFt:15}}, defaultZStepFt:15, worldObjects:[], worldObjectDefinitions:{} };
  const token = { id:'p',x:35,y:35,zLayer:1,elevationFt:15,eyeHeightFt:5 };
  const locker = core.createInstance(catalog.get('locker_industrial'), {instanceId:'locker',position:{x:140,y:35,zLayer:1,elevationFt:2}});
  expect(physical.entityBaseElevationFt(token,mapData)).toBe(15);
  expect(physical.eyeHeightFt(token,mapData)).toBe(20);
  expect(physical.objectBaseFt(locker,mapData)).toBe(17);
  expect(physical.objectTopFt(locker,catalog.get('locker_industrial'),mapData)).toBe(23);
});

test('height-aware object occlusion blocks tall objects but lets a ray pass above low cover', async () => {
  const { core, catalog, physical } = loadWorld();
  const mapData = { grid:{size:70,distancePerCell:5}, zLevels:{'1':{elevationFt:15}}, worldObjectDefinitions:{}, worldObjects:[] };
  const viewer = {id:'viewer',x:35,y:35,zLayer:1,elevationFt:15,eyeHeightFt:5};
  const target = {x:245,y:35,zLayer:1,elevationFt:20};
  const locker = core.createInstance(catalog.get('locker_industrial'),{instanceId:'locker',position:{x:140,y:35,zLayer:1,elevationFt:0},state:{open:true}});
  mapData.worldObjects=[locker];
  expect(physical.blocksLineOfEffect(viewer,target,mapData,'vision')).toBe(true);
  const barrier = core.createInstance(catalog.get('concrete_barrier'),{instanceId:'barrier',position:{x:140,y:35,zLayer:1,elevationFt:0}});
  mapData.worldObjects=[barrier];
  expect(physical.blocksLineOfEffect(viewer,target,mapData,'vision')).toBe(false);
});

test('cover is derived from world geometry and hiding validates open state and capacity', async () => {
  const { core, catalog, physical } = loadWorld();
  const barrier = core.createInstance(catalog.get('concrete_barrier'),{instanceId:'barrier',position:{x:140,y:35,zLayer:0}});
  const attacker={id:'a',x:35,y:35,zLayer:0}, target={id:'t',x:245,y:35,zLayer:0,heightFt:6};
  const mapData={grid:{size:70,distancePerCell:5},worldObjectDefinitions:{},worldObjects:[barrier],tokens:[attacker,target]};
  expect(physical.coverBetween(attacker,target,mapData).level).toBe('partial');

  const locker = core.createInstance(catalog.get('locker_industrial'),{instanceId:'locker',position:{x:105,y:35,zLayer:0}});
  mapData.worldObjects=[locker];
  expect(physical.canEnterHide(target,locker,catalog.get('locker_industrial'),mapData,20).reason).toBe('HIDING_SPOT_CLOSED');
  locker.state.open=true;
  expect(physical.canEnterHide(target,locker,catalog.get('locker_industrial'),mapData,20).valid).toBe(true);
  mapData.tokens.push({id:'other',zLayer:0,stealthState:{hidden:true,hiddenInObjectId:'locker'}});
  expect(physical.canEnterHide(target,locker,catalog.get('locker_industrial'),mapData,20).reason).toBe('HIDING_SPOT_FULL');
  physical.applyHideState(target,locker,catalog.get('locker_industrial'));
  expect(target.stealthState.hidden).toBe(true);
  physical.exitHideState(target);
  expect(target.stealthState.hidden).toBe(false);
});

test('world components derive lights, switches and power records without replacing manual scene entries', async () => {
  const { core, catalog } = loadWorld();
  delete require.cache[require.resolve('../js/vtt/world-object-components.js')];
  const components = require('../js/vtt/world-object-components.js');
  const lamp=core.createInstance(catalog.get('street_light'),{instanceId:'lamp',position:{x:70,y:70,zLayer:0}});
  const sw=core.createInstance(catalog.get('wall_switch'),{instanceId:'sw',position:{x:35,y:35,zLayer:0}});
  const transformer=core.createInstance(catalog.get('transformer_box'),{instanceId:'tr',position:{x:140,y:70,zLayer:0}});
  const mapData={grid:{size:70,distancePerCell:5},worldObjects:[lamp,sw,transformer],worldObjectDefinitions:{},lighting:{scene:{sources:[{id:'manual'}],switches:[],transformers:[]}}};
  const result=components.syncScene(mapData);
  expect(result.changed).toBe(true);
  expect(mapData.lighting.scene.sources.map(x=>x.id)).toEqual(expect.arrayContaining(['manual','wo:lamp:light']));
  expect(mapData.lighting.scene.switches[0]).toMatchObject({id:'wo:sw:switch',circuitId:'street'});
  expect(mapData.lighting.scene.transformers[0]).toMatchObject({id:'wo:tr:transformer'});
});

test('player interaction list is range-gated and excludes DM-only destructive/edit actions', async () => {
  const { core, catalog, physical, afford } = loadWorld();
  global.LuminousVttPhysicalResolver=physical;
  global.LuminousVttEnvironmentAffordances=afford;
  delete require.cache[require.resolve('../js/vtt/interaction-intent.js')];
  const intents=require('../js/vtt/interaction-intent.js');
  const locker=core.createInstance(catalog.get('locker_industrial'),{instanceId:'locker',position:{x:70,y:35,zLayer:0},state:{open:true}});
  const actor={id:'p',x:35,y:35,zLayer:0};
  const mapData={grid:{size:70,distancePerCell:5},worldObjects:[locker],worldObjectDefinitions:{},tokens:[actor]};
  const actions=intents.playerActions(actor,locker,catalog.get('locker_industrial'),mapData,{isDm:false});
  expect(actions).toEqual(expect.arrayContaining(['close','hide_inside']));
  expect(actions).not.toEqual(expect.arrayContaining(['break','delete','rotate','lock']));
  actor.x=700;
  expect(intents.playerActions(actor,locker,catalog.get('locker_industrial'),mapData,{isDm:false})).toEqual([]);
});

test('actor hiding and cover use the shared interaction contract instead of HUD-only state', async () => {
  const { core, catalog, physical } = loadWorld();
  delete require.cache[require.resolve('../js/vtt/interaction-intent.js')];
  const intents=require('../js/vtt/interaction-intent.js');
  const locker=core.createInstance(catalog.get('locker_industrial'),{instanceId:'locker',position:{x:70,y:35,zLayer:0},state:{open:true}});
  const actor={id:'p',x:35,y:35,zLayer:0};
  const mapData={grid:{size:70,distancePerCell:5},worldObjects:[locker],worldObjectDefinitions:{},tokens:[actor]};
  expect(intents.applyActorAction(actor,locker,catalog.get('locker_industrial'),'hide_inside',mapData).valid).toBe(true);
  expect(actor.stealthState.hiddenInObjectId).toBe('locker');
  expect(intents.applyActorAction(actor,locker,catalog.get('locker_industrial'),'exit_hide',mapData).valid).toBe(true);
  expect(actor.stealthState.hidden).toBe(false);
});

test('map HUD is perception-gated and exposes camera, movement, physical and interaction surfaces', async () => {
  const source=fs.readFileSync(path.join(__dirname,'..','js','vtt','map-hud-bootstrap.js'),'utf8');
  expect(source).toContain("if (typeof perception !== 'function') return false");
  expect(source).toContain('vtt-hud-camera-state');
  expect(source).toContain('vtt-hud-movement-state');
  expect(source).toContain('vtt-hud-physical-state');
  expect(source).toContain('data-hud-action');
  expect(source).toContain('perception(actor, point)?.visible === true');
});

test('Firebase rules allow players to create only pending world-object requests while DM remains authoritative', async () => {
  const rules=JSON.parse(fs.readFileSync(path.join(__dirname,'..','database.rules.json'),'utf8')).rules;
  const requestRoot=rules.vtt_world_object_action_requests;
  expect(requestRoot).toBeTruthy();
  const write=requestRoot.$mapId.$requestId['.write'];
  expect(write).toContain("newData.child('status').val() === 'pending'");
  expect(write).toContain("newData.child('requesterUid').val() === auth.uid");
  expect(write).toContain("newData.child('mapId').val() === $mapId");
  expect(write).toContain("!data.exists()");
});
