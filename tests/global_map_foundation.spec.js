const { test, expect } = require('@playwright/test');
const Core = require('../js/global-map-core.js');

const district = (extra = {}) => ({
  id: 'district_k',
  name: 'District K',
  layer: 'district',
  districtId: 'K',
  source: 'campaign',
  polygon: [
    { xKm: 1000, yKm: 800 },
    { xKm: 2200, yKm: 800 },
    { xKm: 2200, yKm: 1800 },
    { xKm: 1000, yKm: 1800 },
  ],
  regionalOrigin: { xKm: 1600, yKm: 1300, q: 0, r: 0, hexDistanceKm: 20 },
  ...extra,
});

function baseDocument() {
  return Core.normalizeDocument({
    worldId: 'limbus_world',
    seed: '1234',
    generatorVersion: 'worldgen_1.4',
    bounds: { widthKm: 5500, heightKm: 4000 },
    regions: [
      district(),
      {
        id: 'k_nest', name: 'K Nest', layer: 'jurisdiction', districtId: 'K', jurisdiction: 'nest', terrain: 'urban', source: 'dm',
        polygon: [{ xKm: 1450, yKm: 1150 }, { xKm: 1750, yKm: 1150 }, { xKm: 1750, yKm: 1450 }, { xKm: 1450, yKm: 1450 }],
      },
    ],
    markers: [{ id: 'k_capital', name: 'K Corp Nest', type: 'nest', districtId: 'K', xKm: 1600, yKm: 1300 }],
    routes: [{ id: 'k_rail', name: 'K Rail', type: 'rail', districtId: 'K', points: [{ xKm: 1200, yKm: 1300 }, { xKm: 2000, yKm: 1300 }] }],
  });
}

test.describe('Global Map Foundation', () => {
  test('defaults to the agreed 22M km² world canvas when blank', () => {
    const doc = Core.blankDocument();
    expect(doc.bounds.widthKm).toBe(5500);
    expect(doc.bounds.heightKm).toBe(4000);
    expect(doc.bounds.widthKm * doc.bounds.heightKm).toBe(22_000_000);
  });

  test('keeps legal jurisdiction independent from physical terrain', () => {
    const doc = baseDocument();
    const nest = doc.regions.find((region) => region.id === 'k_nest');
    expect(nest.jurisdiction).toBe('nest');
    expect(nest.terrain).toBe('urban');
  });

  test('resolves Canon > DM > Campaign > Procedural at overlapping geometry', () => {
    const polygon = [{ xKm: 100, yKm: 100 }, { xKm: 400, yKm: 100 }, { xKm: 400, yKm: 400 }, { xKm: 100, yKm: 400 }];
    const doc = Core.normalizeDocument({
      bounds: { widthKm: 5500, heightKm: 4000 },
      regions: [
        { id: 'proc', layer: 'terrain', terrain: 'plains', source: 'procedural', polygon },
        { id: 'campaign', layer: 'terrain', terrain: 'forest', source: 'campaign', polygon },
        { id: 'dm', layer: 'terrain', terrain: 'urban', source: 'dm', polygon },
        { id: 'canon', layer: 'terrain', terrain: 'lake', source: 'canon', polygon },
      ],
    });
    expect(Core.effectiveRegionAt(doc, { xKm: 200, yKm: 200 }, 'terrain', true).id).toBe('canon');
  });

  test('player view hides DM-only global geometry while DM keeps it', () => {
    let doc = baseDocument();
    doc = Core.upsertMarker(doc, { id: 'secret', name: 'Secret Lab', type: 'poi', xKm: 1700, yKm: 1350, visibleToPlayers: false });
    expect(Core.visibleDocument(doc, false).markers.some((marker) => marker.id === 'secret')).toBe(false);
    expect(Core.visibleDocument(doc, true).markers.some((marker) => marker.id === 'secret')).toBe(true);
  });

  test('global map remains compact vector data instead of local tile/chunk payloads', () => {
    const serialized = JSON.stringify(Core.serialize(baseDocument()));
    expect(serialized).not.toContain('chunkCol');
    expect(serialized).not.toContain('chunkRow');
    expect(serialized).not.toContain('tiles');
    expect(serialized).not.toContain('topology');
    expect(serialized.length).toBeLessThan(10_000);
  });

  test('viewport culling returns only geometry intersecting the camera', () => {
    let doc = baseDocument();
    doc = Core.upsertMarker(doc, { id: 'far', name: 'Far', type: 'poi', xKm: 5000, yKm: 3500 });
    const visible = Core.cull(doc, { xKm: 900, yKm: 700, zoom: 1 }, { width: 1500, height: 1300 }, true);
    expect(visible.markers.some((marker) => marker.id === 'k_capital')).toBe(true);
    expect(visible.markers.some((marker) => marker.id === 'far')).toBe(false);
  });

  test('district regional origin projects axial hex positions into the global map', () => {
    const doc = baseDocument();
    const origin = Core.playerGlobalPosition(doc, { regionalHex: { district: 'K', q: 0, r: 0 } }, true);
    const east = Core.playerGlobalPosition(doc, { regionalHex: { district: 'K', q: 1, r: 0 } }, true);
    expect(origin).toMatchObject({ xKm: 1600, yKm: 1300, districtId: 'K' });
    expect(east.xKm - origin.xKm).toBeCloseTo(20, 6);
    expect(east.yKm).toBeCloseTo(origin.yKm, 6);
  });

  test('locked canon geometry cannot be silently edited or deleted', () => {
    const polygon = [{ xKm: 10, yKm: 10 }, { xKm: 100, yKm: 10 }, { xKm: 100, yKm: 100 }];
    let doc = Core.blankDocument();
    doc = Core.upsertRegion(doc, { id: 'great_lake', name: 'Great Lake', layer: 'water', terrain: 'water', source: 'canon', polygon });
    expect(() => Core.upsertRegion(doc, { ...doc.regions[0], name: 'Moved Lake', polygon })).toThrow('GLOBAL_MAP_ITEM_LOCKED');
    expect(() => Core.removeRegion(doc, 'great_lake')).toThrow('GLOBAL_MAP_ITEM_LOCKED');
  });

  test('region and route point caps reject unbounded authoring payloads', () => {
    const tooManyRegionPoints = Array.from({ length: Core.CONFIG.maxRegionVertices + 1 }, (_, index) => ({ xKm: index % 5500, yKm: index % 4000 }));
    expect(() => Core.normalizeRegion({ id: 'too_big', polygon: tooManyRegionPoints }, Core.blankDocument().bounds)).toThrow('GLOBAL_MAP_POINT_LIMIT');
    const tooManyRoutePoints = Array.from({ length: Core.CONFIG.maxRoutePoints + 1 }, (_, index) => ({ xKm: index % 5500, yKm: index % 4000 }));
    expect(() => Core.normalizeRoute({ id: 'too_long', points: tooManyRoutePoints }, Core.blankDocument().bounds)).toThrow('GLOBAL_MAP_POINT_LIMIT');
  });
});
