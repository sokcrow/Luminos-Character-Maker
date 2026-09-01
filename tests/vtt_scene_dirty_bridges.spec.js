const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const sceneDirty = require('../js/vtt/scene-dirty.js');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function targetStub() {
  const listeners = new Map();
  return {
    addEventListener(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
    },
    removeEventListener(name, fn) { listeners.get(name)?.delete(fn); },
    dispatchEvent(event) {
      for (const fn of listeners.get(event?.type) || []) fn(event);
      return true;
    },
  };
}

test('topology state bridge preserves callback and emits canonical vision dirty', () => {
  const previousDocument = global.document;
  const previousBridge = global.LuminousVttStateBridge;
  const canvas = targetStub();
  const dirtyEvents = [];
  canvas.addEventListener(sceneDirty.EVENT_NAME, (event) => dirtyEvents.push(event.detail));
  global.document = { getElementById: (id) => id === 'vtt-canvas' ? canvas : null };
  global.LuminousVttStateBridge = {
    createBridge(options = {}) {
      return { trigger(payload) { options.onTopologyChanged?.(payload); } };
    },
  };

  try {
    expect(sceneDirty.wrapStateBridgeApi('LuminousVttStateBridge', 'onTopologyChanged', {
      reason: 'topology', render: true, vision: true,
    })).toBe(true);
    let originalCalls = 0;
    const bridge = global.LuminousVttStateBridge.createBridge({ onTopologyChanged() { originalCalls += 1; } });
    bridge.trigger({ id: 'door-1' });
    expect(originalCalls).toBe(1);
    expect(dirtyEvents).toHaveLength(1);
    expect(dirtyEvents[0]).toMatchObject({ reason: 'topology', render: true, vision: true, sourceEvent: 'LuminousVttStateBridge:onTopologyChanged' });
  } finally {
    if (previousDocument === undefined) delete global.document;
    else global.document = previousDocument;
    if (previousBridge === undefined) delete global.LuminousVttStateBridge;
    else global.LuminousVttStateBridge = previousBridge;
  }
});

test('lighting adapter wraps scene, environment, and POV state before Dynamic Lighting starts', () => {
  const patch = read('js/vtt/scene-dirty-lighting-patch.js');
  expect(patch).toContain("wrapBridge('LuminousVttLightingState'");
  expect(patch).toContain("wrapBridge('LuminousVttEnvironmentLightBridge'");
  expect(patch).toContain("wrapBridge('LuminousVttPovState'");
  expect(patch).toContain("reason: 'lighting', render: true, vision: true");

  const html = read('vtt.html');
  const dirty = html.indexOf('js/vtt/scene-dirty.js');
  const lightingPatch = html.indexOf('js/vtt/scene-dirty-lighting-patch.js');
  const lighting = html.indexOf('js/vtt/dynamic-lighting-bootstrap.js');
  const guard = html.indexOf('js/vtt/performance-guard.js');
  expect(lightingPatch).toBeGreaterThan(dirty);
  expect(lighting).toBeGreaterThan(lightingPatch);
  expect(guard).toBeGreaterThan(lighting);
});

test('fog memory adapter is render-only and loads before Fog Memory starts', () => {
  const patch = read('js/vtt/scene-dirty-memory-patch.js');
  expect(patch).toContain('LuminousVttMemoryState');
  expect(patch).toContain("reason: 'fog'");
  expect(patch).toContain('render: true');
  expect(patch).toContain('vision: false');

  const html = read('vtt.html');
  const dirty = html.indexOf('js/vtt/scene-dirty.js');
  const memoryPatch = html.indexOf('js/vtt/scene-dirty-memory-patch.js');
  const fog = html.indexOf('js/vtt/fog-memory-bootstrap.js');
  const guard = html.indexOf('js/vtt/performance-guard.js');
  expect(memoryPatch).toBeGreaterThan(dirty);
  expect(fog).toBeGreaterThan(memoryPatch);
  expect(guard).toBeGreaterThan(fog);
});
