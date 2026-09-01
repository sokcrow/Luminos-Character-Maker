const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const topology = require('../js/vtt/topology.js');
const builder = require('../js/vtt/wall-builder.js');
const openingEdges = require('../js/vtt/topology-opening-edge.js');
const autoTile = require('../js/vtt/wall-auto-tile.js');
const tokenInteraction = require('../js/vtt/token-interaction.js');
const lighting = require('../js/vtt/lighting-engine.js');

test('wall edge -> opening -> wall round trip preserves canonical wall profile and geometry', () => {
  const [wall] = builder.createWallRun({
    from:{ col:1, row:1 }, to:{ col:2, row:1 }, zLayer:1, profileId:'brick',
  });
  const door = openingEdges.createOpeningFromWall(wall, 'door');

  expect(door.id).toBe('opening_z1_c1r1_c2r1');
  expect(door.type).toBe('door');
  expect(door.from).toEqual(wall.from);
  expect(door.to).toEqual(wall.to);
  expect(door.z).toEqual([1]);
  expect(door.openingEdge.sourceWall.id).toBe(wall.id);
  expect(door.openingEdge.sourceWall.wallProfileId).toBe('brick');

  const restored = openingEdges.restoreWall(door);
  expect(restored.id).toBe(wall.id);
  expect(restored.type).toBe('wall');
  expect(restored.from).toEqual(wall.from);
  expect(restored.to).toEqual(wall.to);
  expect(restored.z).toEqual([1]);
  expect(restored.wallProfileId).toBe('brick');
  expect(restored.wall.materialId).toBe('brick');
  expect(restored.thicknessFt).toBe(wall.thicknessFt);
  expect(restored.heightFt).toBe(wall.heightFt);
});

test('retyping an opening keeps one stable edge identity and its source wall snapshot', () => {
  const [wall] = builder.createWallRun({
    from:{ col:0, row:0 }, to:{ col:1, row:0 }, zLayer:0, profileId:'metal',
  });
  const door = openingEdges.createOpeningFromWall(wall, 'door');
  const window = openingEdges.retypeOpening(door, 'window');
  const curtain = openingEdges.retypeOpening(window, 'curtain_window');

  expect(window.id).toBe(door.id);
  expect(curtain.id).toBe(door.id);
  expect(window.openingEdge.sourceWall.wallProfileId).toBe('metal');
  expect(curtain.openingEdge.sourceWall.id).toBe(wall.id);
  expect(openingEdges.restoreWall(curtain).id).toBe(wall.id);
});

test('door and window replacements inherit existing topology physics without a parallel collision system', () => {
  const [wall] = builder.createWallRun({
    from:{ col:1, row:0 }, to:{ col:1, row:1 }, zLayer:0, profileId:'concrete',
  });
  const door = openingEdges.createOpeningFromWall(wall, 'door');
  const window = openingEdges.createOpeningFromWall(wall, 'window');
  const grid = { size:70, cols:4, rows:3, distancePerCell:5 };
  const token = { id:'t1', x:35, y:35, zLayer:0, radius:20 };
  const destination = { x:105, y:35 };

  const doorMap = { grid, topology:[door] };
  expect(tokenInteraction.isPathClear(token, { x:35, y:35 }, destination, doorMap).valid).toBe(false);
  expect(lighting.lineBlocked2d({ x:35, y:35 }, destination, doorMap, 0)).toBe(true);

  const openDoor = topology.applyAction(door, 'open').element;
  const openDoorMap = { grid, topology:[openDoor] };
  expect(tokenInteraction.isPathClear(token, { x:35, y:35 }, destination, openDoorMap).valid).toBe(true);
  expect(lighting.lineBlocked2d({ x:35, y:35 }, destination, openDoorMap, 0)).toBe(false);

  const windowMap = { grid, topology:[window] };
  expect(tokenInteraction.isPathClear(token, { x:35, y:35 }, destination, windowMap).valid).toBe(false);
  expect(lighting.lineBlocked2d({ x:35, y:35 }, destination, windowMap, 0)).toBe(false);
});

test('replacing a middle wall edge with an opening auto-caps its adjacent walls', () => {
  const walls = builder.createWallRun({
    from:{ col:0, row:1 }, to:{ col:3, row:1 }, zLayer:0, profileId:'wood',
  });
  const before = { topology:walls };
  expect(autoTile.junctionAt(before, 0, { col:1, row:1 }).shape).toBe('straight');
  expect(autoTile.junctionAt(before, 0, { col:2, row:1 }).shape).toBe('straight');

  const door = openingEdges.createOpeningFromWall(walls[1], 'door');
  const after = { topology:[walls[0], door, walls[2]] };
  expect(autoTile.junctionAt(after, 0, { col:1, row:1 }).shape).toBe('end');
  expect(autoTile.junctionAt(after, 0, { col:2, row:1 }).shape).toBe('end');
  expect(autoTile.tileForEdge(walls[0], after, 0).shape).toBe('isolated');
  expect(autoTile.tileForEdge(walls[2], after, 0).shape).toBe('isolated');
});

test('opening replacement remains isolated by Z layer', () => {
  const [wallZ0] = builder.createWallRun({ from:{ col:0, row:0 }, to:{ col:1, row:0 }, zLayer:0 });
  const [wallZ1] = builder.createWallRun({ from:{ col:0, row:0 }, to:{ col:1, row:0 }, zLayer:1 });
  const doorZ0 = openingEdges.createOpeningFromWall(wallZ0, 'door');
  const mapData = { topology:[doorZ0, wallZ1] };

  expect(openingEdges.exactElementAtEdge(mapData.topology, wallZ0.from, wallZ0.to, 0).id).toBe(doorZ0.id);
  expect(openingEdges.exactElementAtEdge(mapData.topology, wallZ1.from, wallZ1.to, 1).id).toBe(wallZ1.id);
  expect(autoTile.wallsOnLayer(mapData, 0)).toHaveLength(0);
  expect(autoTile.wallsOnLayer(mapData, 1)).toHaveLength(1);
});

test('atomic topology replacement bridge emits one Firebase multipath update', async () => {
  const statePath = require.resolve('../js/vtt/state-bridge.js');
  const patchPath = require.resolve('../js/vtt/topology-replace-state-patch.js');
  delete require.cache[statePath];
  delete require.cache[patchPath];
  require(statePath);
  require(patchPath);

  const [wall] = builder.createWallRun({ from:{ col:0, row:0 }, to:{ col:1, row:0 }, zLayer:0 });
  const door = openingEdges.createOpeningFromWall(wall, 'door');
  const writes = [];
  const db = {
    ref(refPath) {
      return {
        update: async (payload) => writes.push({ refPath, payload }),
      };
    },
  };
  const fakeRoot = {
    document: { body: { classList:{ contains:(name) => name === 'on-game-dashboard' }, dataset:{} } },
    firebase: { database:() => db },
  };
  const mapData = { id:'atomic-map', topology:[wall] };
  const bridge = global.LuminousVttStateBridge.createBridge({ mapData, root:fakeRoot });

  await bridge.replaceElement(wall.id, door);
  expect(writes).toHaveLength(1);
  expect(writes[0].refPath).toBe('vtt_topology/atomic-map/elements');
  expect(writes[0].payload[wall.id]).toBeNull();
  expect(writes[0].payload[door.id].type).toBe('door');
  expect(writes[0].payload[door.id].openingEdge.sourceWall.id).toBe(wall.id);
});

test('opening authoring contracts enforce edge replacement UX and inspector restore', () => {
  const main = fs.readFileSync(path.join(__dirname, '../js/vtt/main.js'), 'utf8');
  const wallBootstrap = fs.readFileSync(path.join(__dirname, '../js/vtt/wall-builder-bootstrap.js'), 'utf8');
  const openingBootstrap = fs.readFileSync(path.join(__dirname, '../js/vtt/topology-opening-edge-bootstrap.js'), 'utf8');
  const replacePatch = fs.readFileSync(path.join(__dirname, '../js/vtt/topology-replace-state-patch.js'), 'utf8');

  expect(main).toContain("import './topology-replace-state-patch.js'");
  expect(wallBootstrap).toContain("OPENING_TOOLS.includes(controller.tool)");
  expect(wallBootstrap).toContain('openingApi.placeOnElement(hit, controller.tool)');
  expect(openingBootstrap).toContain('data-opening-restore');
  expect(openingBootstrap).toContain('bridge.replaceElement(plan.oldId, plan.next)');
  expect(openingBootstrap).toContain('bridge.replaceElement(String(element.id), wall)');
  expect(replacePatch).toContain("updates[oldId] = null");
  expect(replacePatch).toContain('.update(updates)');
});
