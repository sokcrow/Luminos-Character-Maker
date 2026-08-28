const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('missing DM memory override stays null so Trait capabilities survive AUTO', () => {
  const patch = read('js/vtt/memory-review-hardening-patch.js');
  expect(patch).toContain('return value && Object.keys(value).length ? { ...value } : null');
});

test('explicit lower DM memory rank does not inherit higher snapshot capabilities', () => {
  const patch = read('js/vtt/memory-review-hardening-patch.js');
  expect(patch).toContain('const rankOverridden = Number.isFinite(Number(override?.rank))');
  expect(patch).toContain('capabilities: {}');
});

test('player memory writes flush observations learned while Firebase save is pending', () => {
  const patch = read('js/vtt/memory-review-hardening-patch.js');
  expect(patch).toContain('latestMemoryVersion');
  expect(patch).toContain('const versionAtWrite = latestMemoryVersion');
  expect(patch).toContain('await rawSaveMemory(playerId, candidate)');
  expect(patch).toContain('latestMemoryVersion === versionAtWrite');
  expect(patch).toContain("throw new Error('MEMORY_SAVE_DID_NOT_STABILIZE')");
});

test('review hardening loads after memory defaults and before Fog bootstrap', () => {
  const html = read('vtt.html');
  const defaults = html.indexOf('memory-defaults-patch.js');
  const hardening = html.indexOf('memory-review-hardening-patch.js');
  const fog = html.indexOf('fog-memory-bootstrap.js');
  expect(defaults).toBeGreaterThan(-1);
  expect(hardening).toBeGreaterThan(defaults);
  expect(fog).toBeGreaterThan(hardening);
});

test('Look Up eye-point fix is carried into Fog stack before dynamic lighting starts', () => {
  const html = read('vtt.html');
  const eyePatch = html.indexOf('pov-eye-height-patch.js');
  const lighting = html.indexOf('dynamic-lighting-bootstrap.js');
  expect(eyePatch).toBeGreaterThan(-1);
  expect(lighting).toBeGreaterThan(eyePatch);
});
