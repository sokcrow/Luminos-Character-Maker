const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const sceneDirty = require('../js/vtt/scene-dirty.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('movement and chunk semantic events are removed from the legacy translation map', () => {
  const names = sceneDirty.LEGACY_EVENT_MAP.map(([name]) => name);
  const migrated = [
    'vtt:token-preview-moved',
    'vtt:movement-destination-preview',
    'vtt:token-moved',
    'vtt:token-z-transition',
    'vtt:canonical-tokens-synced',
    'vtt:movement-interaction',
    'vtt:procedural-chunk-loaded',
    'vtt:procedural-chunk-transition',
  ];
  migrated.forEach((name) => expect(names).not.toContain(name));
  expect(names).toContain('vtt:camera-follow-changed');
  expect(names).toContain('vtt:dm-observer-changed');
  expect(names).toContain('vtt:dm-edit-changed');
  expect(names).toHaveLength(7);
});

test('movement engine preserves semantic events and emits direct dirty semantics', () => {
  const source = read('js/vtt/engine.js');
  expect(source).toContain('emitSemanticEvent(type, detail = {}, dirty = null)');
  expect(source).toContain("this.emitSemanticEvent('vtt:movement-destination-preview'");
  expect(source).toContain("reason: 'token', render: true, vision: false, active: true");
  expect(source).toContain("this.emitSemanticEvent('vtt:token-preview-moved'");
  expect(source).toContain("reason: 'token', render: true, vision: true, active: true");
  expect(source).toContain("this.emitSemanticEvent('vtt:movement-interaction'");
  expect(source).toContain("reason: 'topology', render: true, vision: true, active: false");
  expect(source).toContain("this.emitSemanticEvent('vtt:token-moved'");
  expect(source).toContain("this.emitSemanticEvent('vtt:token-z-transition'");
  expect(source).toContain('LuminousVttSceneDirty?.emit');
});

test('procedural chunk streaming keeps domain events and emits one chunk dirty per loaded/transition action', () => {
  const source = read('js/vtt/procedural-chunk-streaming-runtime.js');
  expect(source).toContain("emitSemantic('vtt:token-moved',moveDetail)");
  expect(source).toContain("emitSemantic('vtt:procedural-chunk-transition',transitionDetail)");
  expect(source).toContain("emitDirty('vtt:procedural-chunk-transition',transitionDetail)");
  expect(source).toContain("emitSemantic('vtt:procedural-chunk-loaded',loadedDetail)");
  expect(source).toContain("emitDirty('vtt:procedural-chunk-loaded',loadedDetail)");
  expect(source).toContain("reason:'chunk',render:true,vision:true");
});

test('token state dirty patch wraps the final dynamic token bridge before main creates it', () => {
  const patch = read('js/vtt/scene-dirty-token-state-patch.js');
  const html = read('vtt.html');
  expect(patch).toContain("import './token-state-dynamic-patch.js'");
  expect(patch).toContain("sourceEvent: 'LuminousVttTokenState:onTokensChanged'");
  expect(patch).toContain("reason: 'token'");
  expect(patch).toContain('vision: true');

  const dirty = html.indexOf('js/vtt/scene-dirty.js');
  const tokenPatch = html.indexOf('js/vtt/scene-dirty-token-state-patch.js');
  const main = html.indexOf('js/vtt/main.js');
  expect(tokenPatch).toBeGreaterThan(dirty);
  expect(main).toBeGreaterThan(tokenPatch);
});
