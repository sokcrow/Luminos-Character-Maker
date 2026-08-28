const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Look Up hardening lifts the lighting observer to eye elevation exactly once', () => {
  const patch = read('js/vtt/pov-eye-height-patch.js');
  expect(patch).toContain("import './pov-engine.js'");
  expect(patch).toContain('const eye = base.eyePoint(viewer, mapData)');
  expect(patch).toContain('elevationFt: eye.elevationFt');
  expect(patch).toContain('eyeHeightFt: 0');
  expect(patch).toContain('base.perceptionAtPoint(eyeViewer');
});

test('eye-point hardening loads before dynamic lighting captures the PoV runtime', () => {
  const html = read('vtt.html');
  const patch = html.indexOf('pov-eye-height-patch.js');
  const lighting = html.indexOf('dynamic-lighting-bootstrap.js');
  expect(patch).toBeGreaterThan(-1);
  expect(lighting).toBeGreaterThan(patch);
});
