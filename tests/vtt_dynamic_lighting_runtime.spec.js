const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const lighting = require('../js/vtt/lighting-engine.js');
const environmentEngine = require('../js/environment-engine.js');
const environmentBridgeApi = require('../js/vtt/environment-light-bridge.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('weather bridge defers immediate WeatherEngine callbacks until bootstrap initialization completes', async () => {
  let changes = 0;
  const fakeRoot = {
    document: {},
    LuminousVttLightingEngine: lighting,
    LuminousEnvironmentEngine: environmentEngine,
    LuminousWeatherEngine: {
      getState: () => ({ actual: { tipo: 'nublado' } }),
      getCalendar: () => ({ hora: 12 }),
      onChange(listener) { listener({}); return () => {}; },
    },
  };
  const mapData = { ambientLight: { level: 'darkness' }, lighting: { daylightHours: { start: 6, end: 18 } } };
  const bridge = environmentBridgeApi.createBridge({ mapData, root: fakeRoot, onChanged: () => { changes += 1; } });
  bridge.start();
  expect(changes).toBe(0);
  await Promise.resolve();
  expect(changes).toBe(1);
  expect(mapData.ambientLight.level).toBe('bright');
  bridge.stop();
});

test('browser defaults patch runs before dynamic bootstrap and preserves 120 degree fallback', () => {
  const html = read('vtt.html');
  const patchIndex = html.indexOf('js/vtt/lighting-defaults-patch.js');
  const bootstrapIndex = html.indexOf('js/vtt/dynamic-lighting-bootstrap.js');
  expect(patchIndex).toBeGreaterThan(0);
  expect(bootstrapIndex).toBeGreaterThan(patchIndex);
  const patch = read('js/vtt/lighting-defaults-patch.js');
  expect(patch).toContain('base.DEFAULT_VISION_CONE_DEG');
  expect(patch).toContain('coneDeg: finite(source.coneDeg) ? Number(source.coneDeg) : 90');
});

test('dynamic multiplayer player tokens refresh their own racial senses and cone defaults', () => {
  const source = read('js/vtt/multiplayer-senses-bridge.js');
  expect(source).toContain('racial.resolveCharacterSenses(records[playerId])');
  expect(source).toContain('token.visionConeDeg = lighting?.DEFAULT_VISION_CONE_DEG || 120');
  expect(source).toContain('token.facingDeg = 0');
});

test('lighting defaults patch parses as an ES module', () => {
  const tmp = path.join(os.tmpdir(), `luminous-lighting-defaults-${process.pid}.mjs`);
  fs.writeFileSync(tmp, read('js/vtt/lighting-defaults-patch.js'));
  try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); }
  finally { fs.unlinkSync(tmp); }
});