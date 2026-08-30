const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const repo = path.join(__dirname, '..');
const base = require('../js/vtt/lighting-engine.js');

function patchedLighting() {
  const source = fs.readFileSync(path.join(repo, 'js/vtt/lighting-defaults-patch.js'), 'utf8')
    .replace(/^import .*?;\s*/m, '');
  const context = {
    window: { LuminousVttLightingEngine: base },
    console,
  };
  vm.runInNewContext(source, context, { filename: 'lighting-defaults-patch.js' });
  return context.window.LuminousVttLightingEngine;
}

const mapData = {
  grid: { size: 70, distancePerCell: 5, cols: 40, rows: 40 },
  topology: [],
  walls: [],
  tokens: [],
};
const scene = { sources: [], interiors: [], transformers: [], switches: [], roofs: [] };
const environment = { state: { light: 'bright' } };

test('normal token vision is capped to 120 degrees even when legacy state says 360', () => {
  const lighting = patchedLighting();
  const viewer = { x: 700, y: 700, zLayer: 0, facingDeg: 0, lookDeg: 0, visionConeDeg: 360 };

  expect(lighting.visionConeDeg(viewer)).toBe(120);
  expect(lighting.perceptionAtPoint(viewer, { x: 900, y: 700, zLayer: 0 }, scene, mapData, environment).visible).toBe(true);
  expect(lighting.perceptionAtPoint(viewer, { x: 600, y: 700, zLayer: 0 }, scene, mapData, environment)).toMatchObject({
    visible: false,
    mode: 'outside_cone',
  });
});

test('120 degree cone includes the boundary at plus/minus 60 degrees and rejects points beyond it', () => {
  expect(base.pointInCone({ x: 0, y: 0 }, { x: 100, y: Math.tan(Math.PI / 3) * 100 }, 0, 120)).toBe(true);
  expect(base.pointInCone({ x: 0, y: 0 }, { x: 0, y: 100 }, 0, 120)).toBe(false);
  expect(base.pointInCone({ x: 0, y: 0 }, { x: -100, y: 0 }, 0, 120)).toBe(false);
});
