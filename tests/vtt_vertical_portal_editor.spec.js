const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const portals = require('../js/vtt/vertical-portal.js');
const portalState = require('../js/vtt/vertical-portal-state.js');
const spatial = require('../js/vtt/spatial-vision.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const map = {
  id: 'test_map',
  grid: { cols: 20, rows: 20, size: 70, distancePerCell: 5, distanceUnit: 'ft' },
  zLevels: {
    0: { zLayer: 0, elevationFt: 0, label: 'Street' },
    1: { zLayer: 1, elevationFt: 15, label: 'Upper Floor' },
    2: { zLayer: 2, elevationFt: 30, label: 'Roof' },
  },
  verticalPortals: [],
};

test('vertical portal runtime creates hole, balcony and stairs contracts', () => {
  const from = { col: 2, row: 4 };
  const to = { col: 7, row: 4 };

  const opening = portals.createPortal({ type: 'opening', from, to, fromZ: 0, toZ: 1, mapData: map });
  expect(opening).toMatchObject({
    type: 'opening',
    between: [0, 1],
    from,
    to,
    state: 'open',
    blocksVision: false,
    blocksLight: false,
    allowsMovement: false,
  });
  expect(portals.labelFor(opening)).toBe('HUECO');

  const balcony = portals.createPortal({ type: 'balcony_edge', from, to, fromZ: 1, toZ: 0, mapData: map });
  expect(balcony.allowsMovement).toBe(false);
  expect(portals.labelFor(balcony)).toBe('BALCÓN');

  const stairs = portals.createPortal({ type: 'stairs', from, to, fromZ: 0, toZ: 1, mapData: map });
  expect(stairs).toMatchObject({ allowsMovement: true, movementMode: 'stairs', layout: 'straight', widthFt: 5 });
  expect(portals.labelFor(stairs)).toBe('ESCALERA');
});

test('vertical portal hit testing is restricted to connected Z levels', () => {
  const portal = portals.createPortal({
    type: 'balcony_edge',
    from: { col: 2, row: 5 },
    to: { col: 8, row: 5 },
    fromZ: 0,
    toZ: 1,
    mapData: map,
  });
  const pointOnSegment = { x: 5 * 70, y: 5 * 70 };
  expect(portals.hitTest([portal], pointOnSegment, map, 0)?.id).toBe(portal.id);
  expect(portals.hitTest([portal], pointOnSegment, map, 1)?.id).toBe(portal.id);
  expect(portals.hitTest([portal], pointOnSegment, map, 2)).toBeNull();
  expect(portals.otherLayer(portal, 0)).toBe(1);
});

test('editor-created vertical portals are consumed by cross-level sight', () => {
  const portal = portals.createPortal({
    type: 'opening',
    from: { col: 0, row: 5 },
    to: { col: 6, row: 5 },
    fromZ: 0,
    toZ: 1,
    mapData: map,
  });
  const withPortal = { ...map, verticalPortals: [portal] };
  const viewer = { x: 140, y: 140, zLayer: 1, elevationFt: 15 };
  const target = { x: 280, y: 560 };
  expect(spatial.canTraverseLayers(viewer, target, 0, withPortal, 'vision')).toBe(true);
  expect(spatial.canTraverseLayers(viewer, target, 0, { ...map, verticalPortals: [] }, 'vision')).toBe(false);
});

test('local vertical portal state bridge allows DM persistence and denies player mutation', async () => {
  const dmMap = { ...map, verticalPortals: [] };
  const dmBridge = portalState.createBridge({ mapData: dmMap, isDm: true, root: {} });
  dmBridge.start();
  const portal = portals.createPortal({
    type: 'stairs',
    from: { col: 3, row: 3 },
    to: { col: 3, row: 7 },
    fromZ: 0,
    toZ: 1,
    mapData: dmMap,
  });
  await dmBridge.savePortal(portal);
  expect(dmMap.verticalPortals).toHaveLength(1);
  expect(dmMap.verticalPortals[0]).toMatchObject({ type: 'stairs', allowsMovement: true });
  await dmBridge.deletePortal(portal.id);
  expect(dmMap.verticalPortals).toEqual([]);

  const playerBridge = portalState.createBridge({ mapData: { ...map, verticalPortals: [] }, isDm: false, root: {} });
  await expect(playerBridge.savePortal(portal)).rejects.toThrow('DM_REQUIRED');
});

test('DM vertical editor UI exposes tools, Z target, persistence and edit-mode-only guides', () => {
  const html = read('vtt.html');
  const main = read('js/vtt/main.js');
  const controller = read('js/vtt/vertical-portal-controller.js');
  const renderer = read('js/vtt/renderer.js');
  const state = read('js/vtt/vertical-portal-state.js');

  expect(html).toContain('id="vtt-dm-edit-toggle"');
  expect(html).toContain('id="vtt-vertical-toolbar"');
  expect(html).toContain('data-vtt-vertical-tool="opening"');
  expect(html).toContain('data-vtt-vertical-tool="balcony_edge"');
  expect(html).toContain('data-vtt-vertical-tool="stairs"');
  expect(html).toContain('id="vtt-vertical-target-z"');
  expect(html).toContain('id="vtt-vertical-editor"');
  expect(html).toContain('js/vtt/vertical-portal.js');
  expect(html).toContain('js/vtt/vertical-portal-state.js');

  expect(main).toContain("import { VerticalPortalController } from './vertical-portal-controller.js'");
  expect(main).toContain('isDm: bridge.isDm');
  expect(main).toContain('verticalBridge.start()');
  expect(main).toContain('verticalController.handleLayerChanged()');
  expect(main).toContain('LuminousVttDmEditMode');

  expect(controller).toContain("const valid = ['select', 'opening', 'balcony_edge', 'stairs', 'erase']");
  expect(controller).toContain('snapPointToVertex');
  expect(controller).toContain('axisAlignedVertex');
  expect(controller).toContain('this.stateBridge.savePortal(portal)');
  expect(controller).toContain('toolbar.hidden = !active');
  expect(controller).toContain('this.mapData.verticalPortalEditor.visible = active');
  expect(controller).toContain('this.editActive()');

  expect(renderer).toContain('drawVerticalPortalGuides');
  expect(renderer).toContain('this.mapData.verticalPortalEditor?.visible');
  expect(renderer).toContain("opening: { stroke:");
  expect(renderer).toContain("stairs: { stroke:");

  expect(state).toContain('vtt_topology');
  expect(state).toContain('/verticalPortals`');
  expect(state).toContain("if (!isDm) throw new Error('DM_REQUIRED')");
});

test('new vertical portal UMD modules parse as JavaScript', () => {
  const root = path.join(__dirname, '..');
  for (const file of ['js/vtt/vertical-portal.js', 'js/vtt/vertical-portal-state.js']) {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
  }
  expect(read('js/vtt/vertical-portal-controller.js')).toContain('export class VerticalPortalController');
});
