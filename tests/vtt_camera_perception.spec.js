const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

function loadFollow() {
  delete require.cache[require.resolve('../js/vtt/camera-follow.js')];
  return require('../js/vtt/camera-follow.js');
}

test('Perception modifier resolves English and Spanish skill carriers without using passive Perception', async () => {
  const api = loadFollow();
  expect(api.perceptionModifier({ perceptionModifier: 4 })).toBe(4);
  expect(api.perceptionModifier({ skills:{ Perception:{ modifier:3 } } })).toBe(3);
  expect(api.perceptionModifier({ habilidades:{ 'Percepción':{ bonus:5 } } })).toBe(5);
  expect(api.perceptionModifier({ passivePerception:18 })).toBe(0);
});

test('Perception camera policy uses the agreed zoom-out tiers and 40-140 ft look leash', async () => {
  const api = loadFollow();
  expect(api.cameraPolicyForModifier(-3)).toMatchObject({ minZoom:0.90, maxLookFt:40 });
  expect(api.cameraPolicyForModifier(0)).toMatchObject({ minZoom:0.85, maxLookFt:60 });
  expect(api.cameraPolicyForModifier(2)).toMatchObject({ minZoom:0.75, maxLookFt:80 });
  expect(api.cameraPolicyForModifier(4)).toMatchObject({ minZoom:0.65, maxLookFt:100 });
  expect(api.cameraPolicyForModifier(6)).toMatchObject({ minZoom:0.55, maxLookFt:120 });
  expect(api.cameraPolicyForModifier(9)).toMatchObject({ minZoom:0.50, maxLookFt:140 });
});

test('look-around leash clamps the camera center around the controlled token', async () => {
  const api = loadFollow();
  expect(api.clampPointAround({x:30,y:40},{x:0,y:0},100)).toMatchObject({x:30,y:40,clamped:false});
  const clamped=api.clampPointAround({x:300,y:400},{x:0,y:0},100);
  expect(clamped.clamped).toBe(true);
  expect(clamped.x).toBeCloseTo(60,6);
  expect(clamped.y).toBeCloseTo(80,6);
});

test('player starts in Follow, manual pan becomes constrained Look Around, resync keeps leash live, and recenter restores Follow', async () => {
  const previousCustomEvent = global.CustomEvent;
  if (typeof global.CustomEvent !== 'function') global.CustomEvent = class CustomEvent { constructor(type, init={}) { this.type=type; this.detail=init.detail; } };
  const api = loadFollow();
  let manualPan=null, constraint=null, zoomBounds=null;
  const camera={
    zoom:1,
    centerOnWorldPoint:()=>true,
    setManualPanListener(fn){manualPan=fn;},
    setCenterConstraint(fn){constraint=fn;},
    setZoomBounds(min,max){zoomBounds={min,max};},
    enforceCenterConstraint:()=>false,
  };
  const canvas={addEventListener:()=>{},removeEventListener:()=>{},dispatchEvent:()=>{}};
  const token={id:'p1',x:100,y:100,zLayer:0,viewer:true,skills:{Perception:{modifier:3}}};
  const mapData={grid:{size:70,distancePerCell:5},tokens:[token]};
  const runtime={bridge:{isDm:false},engine:{camera,canvas},lighting:{controlledViewers:()=>mapData.tokens}};
  const host={LuminousVttRuntime:runtime,setInterval:()=>1,clearInterval:()=>{},setTimeout:(fn)=>fn(),addEventListener:()=>{},removeEventListener:()=>{}};
  const controller=api.createController({runtime,mapData,root:host});
  expect(controller.state()).toMatchObject({mode:'follow',tokenRules:true,perceptionModifier:3,minZoom:0.65,maxLookFt:90});
  expect(zoomBounds).toEqual({min:0.65,max:5});
  expect(typeof constraint).toBe('function');
  manualPan?.({dx:10,dy:0});
  expect(controller.state().mode).toBe('look');

  mapData.tokens=[{...token,x:500,y:100}];
  const leashPx=api.feetToPixels(90,mapData);
  const afterResync=constraint({x:500+leashPx+500,y:100});
  expect(afterResync.clamped).toBe(true);
  expect(afterResync.x).toBeCloseTo(500+leashPx,6);

  controller.recenter();
  expect(controller.state().mode).toBe('follow');
  controller.stop();
  if (previousCustomEvent === undefined) delete global.CustomEvent; else global.CustomEvent=previousCustomEvent;
});

test('DM camera is unrestricted until View As Token activates token camera rules', async () => {
  const api = loadFollow();
  let constraint='unset', zoomBounds=null;
  const camera={
    zoom:1,centerOnWorldPoint:()=>true,setManualPanListener:()=>{},
    setCenterConstraint(fn){constraint=fn;},setZoomBounds(min,max){zoomBounds={min,max};},enforceCenterConstraint:()=>false,
  };
  const canvas={addEventListener:()=>{},removeEventListener:()=>{},dispatchEvent:()=>{}};
  const npc={id:'npc',x:10,y:10,perceptionModifier:5};
  const mapData={grid:{size:70,distancePerCell:5},lighting:{dmPreviewTokenId:null},tokens:[npc]};
  const runtime={bridge:{isDm:true},engine:{camera,canvas}};
  const host={LuminousVttRuntime:runtime,setInterval:()=>1,clearInterval:()=>{},setTimeout:()=>{},addEventListener:()=>{},removeEventListener:()=>{}};
  const controller=api.createController({runtime,mapData,root:host});
  expect(controller.state()).toMatchObject({mode:'free',tokenRules:false,minZoom:0.1});
  expect(zoomBounds).toEqual({min:0.1,max:5});
  expect(constraint).toBe(null);
  mapData.lighting.dmPreviewTokenId='npc';
  controller.applyPolicy(true);
  expect(controller.state()).toMatchObject({mode:'look',tokenRules:true,perceptionModifier:5,minZoom:0.55,maxLookFt:110});
  expect(zoomBounds).toEqual({min:0.55,max:5});
  expect(typeof constraint).toBe('function');
  controller.stop();
});

test('camera input reserves left click for map interaction and uses middle or Space plus left for pan', async () => {
  const source=fs.readFileSync(path.join(__dirname,'..','js','vtt','camera.js'),'utf8');
  expect(source).toContain('const middlePan = e.button === 1');
  expect(source).toContain('const spaceLeftPan = e.button === 0 && this.spacePanActive');
  expect(source).toContain('if (!middlePan && !spaceLeftPan) return');
  expect(source).toContain("e.code !== 'Space'");
});

test('camera freedom never replaces canonical PoV visibility in the HUD', async () => {
  const hud=fs.readFileSync(path.join(__dirname,'..','js','vtt','map-hud-bootstrap.js'),'utf8');
  expect(hud).toContain("if (typeof perception !== 'function') return false");
  expect(hud).toContain('perception(actor, point)?.visible === true');
  expect(hud).toContain('LOOK AROUND');
  expect(hud).toContain('state.maxLookFt');
  expect(hud).toContain('state.minZoom');
});
