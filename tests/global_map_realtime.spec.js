const { test, expect } = require('@playwright/test');
const fs = require('fs');

const runtime = fs.readFileSync('js/vtt/global-map-runtime.js', 'utf8');
const html = fs.readFileSync('vtt.html', 'utf8');

test.describe('Global Map realtime / performance architecture', () => {
  test('persists under the existing DM-authoritative campaign world state root', () => {
    expect(runtime).toContain("const ROOT = 'campaña/estado_mundo/mapa_global'");
    expect(runtime).not.toContain("const ROOT = 'global_map'");
  });

  test('does not add polling, timers, or a render loop', () => {
    expect(runtime).not.toContain('setInterval(');
    expect(runtime).not.toContain('setTimeout(');
    expect(runtime).not.toContain('requestAnimationFrame(');
  });

  test('initial load is one-shot and realtime watchers only attach while the HUD is open', () => {
    expect(runtime).toContain("db.ref(ROOT).once('value')");
    expect(runtime).toContain("mapRef.on('value', mapListener)");
    expect(runtime).toContain("playersRef.on('value', playersListener)");
    expect(runtime).toContain("mapRef.off('value', mapListener)");
    expect(runtime).toContain("playersRef.off('value', playersListener)");
    expect(runtime).toMatch(/function closeMap\(\)[\s\S]*?unwatch\(\)/);
  });

  test('DM authoring writes only through explicit save and not canvas movement', () => {
    const writeCalls = [...runtime.matchAll(/\.set\(/g)];
    expect(writeCalls).toHaveLength(1);
    expect(runtime).toMatch(/async function save\(\)[\s\S]*?db\.ref\(ROOT\)\.set\(payload\)/);
    const moveBlock = runtime.match(/function onPointerMove\(event\) \{[\s\S]*?\n  \}/)?.[0] || '';
    expect(moveBlock).not.toContain('.set(');
    expect(moveBlock).not.toContain('.update(');
    expect(moveBlock).not.toContain('.transaction(');
  });

  test('opening the world HUD stops local rendering and closing restores it', () => {
    expect(runtime).toMatch(/function openMap\(\)[\s\S]*?engine\?\.stop\?\.\(\)/);
    expect(runtime).toMatch(/function closeMap\(\)[\s\S]*?engine\?\.start\?\.\(\)/);
    expect(runtime).toContain('localCanvas.hidden = true');
    expect(runtime).toContain('localCanvas.hidden = false');
  });

  test('global HUD never imports or requests local procedural chunks', () => {
    expect(runtime).not.toContain('procedural-chunk-streaming');
    expect(runtime).not.toContain('loadChunk');
    expect(runtime).not.toContain('activateChunk');
    expect(runtime).not.toContain('mapData.topology');
  });

  test('party positions are read only while the global HUD is open', () => {
    expect(runtime).toContain("const PLAYERS_ROOT = 'campaña/jugadores'");
    expect(runtime).toContain('playersRef = db.ref(PLAYERS_ROOT)');
    expect(runtime).not.toMatch(/db\.ref\(PLAYERS_ROOT\)\.(set|update|transaction)/);
  });

  test('player mode has no authoring controls in the generated HUD', () => {
    expect(runtime).toContain("${isDm ? `");
    expect(runtime).toContain('WORLD AUTHORING');
    expect(runtime).toContain("if (!isDm) return false;");
  });

  test('VTT loads the isolated global stylesheet and runtime', () => {
    expect(html).toContain('css/global-map.css');
    expect(html).toContain('js/vtt/global-map-runtime.js');
  });
});
