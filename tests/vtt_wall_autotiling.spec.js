const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

require('../js/vtt/topology.js');
const topology = globalThis.LuminousVttTopology;
const builder = require('../js/vtt/wall-builder.js');
const autoTile = require('../js/vtt/wall-auto-tile.js');
const autoRenderer = require('../js/vtt/wall-auto-tile-renderer.js');

function wall(from, to, zLayer = 0, profileId = 'brick') {
  return builder.createWallRun({ from, to, zLayer, profileId })[0];
}

function map(topologyElements = []) {
  return { grid:{ size:70, cols:20, rows:20, distancePerCell:5 }, topology:topologyElements };
}

test('junction classifier covers end, straight, corner, T and cross orientations', () => {
  expect(autoTile.classifyDirections(['E'])).toMatchObject({ shape:'end', orientationDeg:0, degree:1 });
  expect(autoTile.classifyDirections(['W','E'])).toMatchObject({ shape:'straight', orientationDeg:0, degree:2 });
  expect(autoTile.classifyDirections(['N','S'])).toMatchObject({ shape:'straight', orientationDeg:90, degree:2 });
  expect(autoTile.classifyDirections(['E','S'])).toMatchObject({ shape:'corner', orientationDeg:0, degree:2 });
  expect(autoTile.classifyDirections(['N','E','S'])).toMatchObject({ shape:'t', missingDirection:'W', orientationDeg:180, degree:3 });
  expect(autoTile.classifyDirections(['N','E','S','W'])).toMatchObject({ shape:'cross', orientationDeg:0, degree:4 });
});

test('neighbor resolver derives a corner from canonical wall edges', () => {
  const center = { col:2, row:2 };
  const east = wall(center, { col:3, row:2 });
  const south = wall(center, { col:2, row:3 });
  const data = map([east, south]);
  const junction = autoTile.junctionAt(data, 0, center);
  expect(junction.shape).toBe('corner');
  expect(junction.directions).toEqual(['E','S']);
  expect(junction.wallIds).toEqual([east.id, south.id].sort());
});

test('single wall edge resolves as isolated while retaining endpoint metadata', () => {
  const edge = wall({ col:1, row:1 }, { col:2, row:1 });
  const data = map([edge]);
  const tile = autoTile.tileForEdge(edge, data, 0);
  expect(tile.shape).toBe('isolated');
  expect(tile.variantKey).toBe('wall.isolated');
  expect(tile.orientationDeg).toBe(0);
  expect(tile.from.shape).toBe('end');
  expect(tile.to.shape).toBe('end');
  expect(edge.autoTile).toBeUndefined();
});

test('doors and windows are openings, not visual wall neighbors', () => {
  const center = { col:5, row:5 };
  const east = wall(center, { col:6, row:5 });
  const door = topology.createElement({ id:'door_south', type:'door', from:center, to:{ col:5, row:6 }, zLayer:0 });
  const data = map([east, door]);
  const junction = autoTile.junctionAt(data, 0, center);
  expect(junction.shape).toBe('end');
  expect(junction.directions).toEqual(['E']);
});

test('wall connections are isolated by Z layer', () => {
  const center = { col:7, row:7 };
  const z0East = wall(center, { col:8, row:7 }, 0);
  const z1South = wall(center, { col:7, row:8 }, 1);
  const data = map([z0East, z1South]);
  expect(autoTile.junctionAt(data, 0, center).directions).toEqual(['E']);
  expect(autoTile.junctionAt(data, 1, center).directions).toEqual(['S']);
});

test('mixed wall profiles connect physically while reporting a mixed visual junction', () => {
  const center = { col:4, row:4 };
  const concrete = wall(center, { col:5, row:4 }, 0, 'concrete');
  const wood = wall(center, { col:4, row:5 }, 0, 'wood');
  const junction = autoTile.junctionAt(map([concrete, wood]), 0, center);
  expect(junction.shape).toBe('corner');
  expect(junction.mixedProfiles).toBe(true);
  expect(junction.profileIds).toEqual(['concrete','wood']);
});

test('dirty-neighbor invalidation touches only walls incident to changed vertices', () => {
  const west = wall({ col:1, row:2 }, { col:2, row:2 });
  const east = wall({ col:2, row:2 }, { col:3, row:2 });
  const far = wall({ col:8, row:8 }, { col:9, row:8 });
  const previous = [west, far];
  const next = [west, east, far];
  const changed = autoTile.changedElements(previous, next);
  expect(changed.map((entry) => entry.id)).toContain(east.id);
  const affected = autoTile.affectedWallIds(map(next), 0, changed);
  expect(affected).toContain(west.id);
  expect(affected).toContain(east.id);
  expect(affected).not.toContain(far.id);
});

test('vector renderer draws derived wall tile without changing physical topology', () => {
  const edge = wall({ col:1, row:1 }, { col:2, row:1 });
  const data = map([edge]);
  const calls = [];
  const ctx = {
    globalAlpha:1,
    save(){ calls.push('save'); }, restore(){ calls.push('restore'); },
    beginPath(){}, moveTo(){}, lineTo(){}, stroke(){ calls.push('stroke'); },
    arc(){}, fill(){ calls.push('fill'); }, fillRect(){ calls.push('fillRect'); }, setLineDash(){},
    set fillStyle(value){ this._fillStyle = value; }, set strokeStyle(value){ this._strokeStyle = value; },
    set lineWidth(value){ this._lineWidth = value; }, set lineCap(value){ this._lineCap = value; }, set lineJoin(value){ this._lineJoin = value; },
  };
  const before = JSON.stringify(data.topology);
  expect(autoRenderer.drawWallTile(ctx, data, edge, autoTile.tileForEdge(edge, data))).toBe(true);
  expect(calls.filter((entry) => entry === 'stroke').length).toBeGreaterThanOrEqual(2);
  expect(JSON.stringify(data.topology)).toBe(before);
});

test('bootstrap composes renderer/controller and restores both on teardown', () => {
  const source = fs.readFileSync(path.join(__dirname, '../js/vtt/wall-auto-tile-bootstrap.js'), 'utf8');
  const builderBootstrap = fs.readFileSync(path.join(__dirname, '../js/vtt/wall-builder-bootstrap.js'), 'utf8');
  expect(source).toContain('renderer.drawTopologyElement = function wallAutoTileDrawTopologyElement');
  expect(source).toContain('controller.handleTopologyChanged = function wallAutoTileTopologyChanged');
  expect(source).toContain('invalidateChanges(topologySnapshot, next)');
  expect(source).toContain('renderer.drawTopologyElement = originalDrawTopologyElement');
  expect(source).toContain('controller.handleTopologyChanged = originalHandleTopologyChanged');
  expect(builderBootstrap).toContain("startWallAutoTile({ runtime:window.LuminousVttRuntime, mapData })");
  expect(builderBootstrap).toContain('autoTileApi?.stop?.()');
});
