const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', 'js', 'vtt', name), 'utf8');

test('camera follow and HUD use event-driven sync with no polling timers', async () => {
  const follow = read('camera-follow.js');
  const hud = read('map-hud-bootstrap.js');
  expect(follow).not.toContain('setInterval');
  expect(hud).not.toContain('setInterval');
  expect(follow).toContain("'vtt:canonical-tokens-synced'");
  expect(follow).toContain("'vtt:regional-local-transition-applied'");
  expect(follow).toContain("'vtt:procedural-chunk-loaded'");
  expect(hud).toContain("'vtt:dm-observer-changed'");
  expect(hud).toContain("'vtt:canonical-tokens-synced'");
});

test('DM observer is read-only local camera/POV state and never writes Realtime', async () => {
  const observer = read('dm-observer.js');
  expect(observer).not.toMatch(/firebase/i);
  expect(observer).not.toContain('.database(');
  expect(observer).not.toContain('.ref(');
  expect(observer).not.toContain('.transaction(');
  expect(observer).not.toContain('.update(');
  expect(observer).not.toContain('.set(');
  expect(observer).not.toMatch(/\.viewer\s*=/);
  expect(observer).not.toContain('requestAnimationFrame');
  expect(observer).not.toContain('setInterval');
  expect(observer).toContain('mapData.lighting.dmPreviewTokenId = targetId');
  expect(observer).toContain('mapData.lighting.dmPreviewTokenId = null');
});

test('canonical token reconnect emits a local sync event from the existing token-state callback', async () => {
  const main = read('main.js');
  expect(main).toContain('onTokensChanged: (change = {}) =>');
  expect(main).toContain("new EventCtor('vtt:canonical-tokens-synced'");
  expect(main).toContain('viewerTokenId');
  expect(main).not.toContain('vtt_camera_observer_requests');
});

test('DM observer modes preserve full DM vision for Follow and activate player POV only for View As', async () => {
  const observer = read('dm-observer.js');
  expect(observer).toContain("FOLLOW: 'follow'");
  expect(observer).toContain("VIEW_AS: 'view_as'");
  expect(observer).toContain("mode = MODES.FOLLOW");
  expect(observer).toContain("mode = MODES.VIEW_AS");
  expect(observer).toContain('mapData.lighting.dmPreviewTokenId = targetId');
  expect(observer).toContain('cameraFollow.setTarget(targetId, { follow: true })');
  expect(observer).toContain('syncLayer(token)');
});

test('DM free view draws only lightweight local player-cone outlines while exact View As uses existing lighting POV', async () => {
  const observer = read('dm-observer.js');
  const lighting = read('lighting-engine.js');
  expect(observer).toContain('function drawOutlines()');
  expect(observer).toContain("if (mode === MODES.VIEW_AS || stopped) return");
  expect(observer).toContain('lighting?.visionConeDeg?.(token)');
  expect(observer).toContain('|| 120');
  expect(lighting).toContain('const DEFAULT_VISION_CONE_DEG = 120');
  expect(lighting).toContain('pointInCone(viewer, point, facingDeg(viewer), visionConeDeg(viewer))');
});

test('observer does not create scheduler/calendar/world-state write surfaces', async () => {
  const combined = `${read('camera-follow.js')}\n${read('dm-observer.js')}\n${read('map-hud-bootstrap.js')}`;
  expect(combined).not.toContain('campaña/calendario');
  expect(combined).not.toContain('world_scheduler_requests');
  expect(combined).not.toContain('mapSimulationZones');
  expect(combined).not.toContain('playerDiscovery');
});
