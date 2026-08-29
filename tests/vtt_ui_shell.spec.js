const { test, expect } = require('@playwright/test');
const ui = require('../js/vtt/ui-shell.js');

test('VTT shell uses inline SVG icons instead of emoji glyphs', () => {
  const icon = ui.iconMarkup('light');
  expect(icon).toContain('<svg');
  expect(icon).toContain('aria-hidden="true"');
  expect(icon).not.toMatch(/[😀-🙏🌀-🫿]/u);
});

test('Actor library folders prioritize players and use faction metadata', () => {
  const actors = [
    { key: 'npcs:solo', name: 'Solo', category: 'npc', raw: {} },
    { key: 'npcs:w1', name: 'W Guard', category: 'enemy', raw: { factionId: 'W Corp' } },
    { key: 'players:p1', name: 'Player', category: 'player', raw: {} },
    { key: 'actors:car', name: 'Car', category: 'vehicle', raw: {} },
  ];
  expect(ui.factionFromActor(actors[1])).toBe('W Corp');
  const groups = ui.groupActors(actors);
  expect(groups.map((group) => group.id)).toEqual(['players', 'faction:w corp', 'independent', 'special']);
  expect(groups[1].actors[0].name).toBe('W Guard');
});

test('default ficha perception remains a 120 degree cone unless overridden', () => {
  expect(ui.defaultVisionConeDeg({})).toBe(120);
  expect(ui.defaultVisionConeDeg({ visionConeDeg: 90 })).toBe(90);
});

test('DM edit mode forcibly leaves token preview and returns to absolute map view', () => {
  let clears = 0;
  const mapData = { dmEditMode: { active: true }, lighting: { dmPreviewTokenId: 'guard-1' } };
  const runtime = {
    bridge: { isDm: true },
    lighting: { controller: { clearPreview() { clears += 1; } } },
  };
  expect(ui.enforceDmEditorView(runtime, mapData)).toBe(true);
  expect(mapData.lighting.dmPreviewTokenId).toBeNull();
  expect(clears).toBe(1);
});

test('vertical Z authoring guides are rendered on top of fichas while editing', () => {
  const calls = [];
  const renderer = {
    drawTokens(zLayer) { calls.push(`tokens:${zLayer}`); },
    drawVerticalPortalGuides(zLayer) { calls.push(`guides:${zLayer}`); },
  };
  const runtime = { bridge: { isDm: true }, engine: { renderer } };
  const mapData = { dmEditMode: { active: true } };
  const stop = ui.installVerticalGuideBridge(runtime, mapData);
  renderer.drawTokens(2);
  expect(calls).toEqual(['tokens:2', 'guides:2']);
  stop();
});
