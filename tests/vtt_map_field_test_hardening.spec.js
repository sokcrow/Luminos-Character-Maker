const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

class MockCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail || null;
    this.button = init.button ?? 0;
    this.clientX = init.clientX ?? init.detail?.clientX ?? 0;
    this.clientY = init.clientY ?? init.detail?.clientY ?? 0;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this.propagationStopped = true; }
}

class MockTarget {
  constructor() { this.listeners = new Map(); this.CustomEvent = MockCustomEvent; }
  addEventListener(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
  }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatchEvent(event) {
    for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event);
    return true;
  }
}

function playerToken(id, actorId = id) {
  return {
    id,
    actorId,
    x: 140,
    y: 140,
    zLayer: 0,
    gridPosition: { col: 2, row: 2, z: 0 },
    canonicalScope: 'player',
    canonicalPlayerKey: id,
    playerId: id,
    viewer: false,
  };
}

test('hardening: actor icon is authoritative for tokens and Theatre sprite is never a fallback', () => {
  delete require.cache[require.resolve('../js/vtt/actor-library.js')];
  const actors = require('../js/vtt/actor-library.js');
  expect(actors.imageFor({ icono: 'actor-icon.webp', sprite: 'scene-sprite.webp' })).toBe('actor-icon.webp');
  expect(actors.imageFor({ sprite: 'scene-sprite.webp' })).toBe('');

  const normalized = actors.normalizeActor('actors', 'agatha', { nombre: 'Agatha', icono: 'agatha-icon.webp', sprite: 'agatha-scene.webp' });
  expect(normalized.tokenImage).toBe('agatha-icon.webp');
  const token = actors.tokenFromActor(normalized, { x: 70, y: 70 }, { grid: { size: 70, cols: 40, rows: 40 } });
  expect(token.icono).toBe('agatha-icon.webp');
  expect(token.tokenImage).toBe('agatha-icon.webp');

  const appearanceSource = read('js/vtt/token-appearance.js');
  expect(appearanceSource).not.toMatch(/\bsprite\b/);
});

test('hardening: a player-linked actor exists once even across actors, NPC migration data, and stale world token state', () => {
  delete require.cache[require.resolve('../js/vtt/actor-library.js')];
  const actors = require('../js/vtt/actor-library.js');
  const merged = actors.mergeCollections({
    players: { p1: { nombre: 'Agatha', actorId: 'actor_agatha', uid: 'u1' } },
    actors: { actor_agatha: { id: 'actor_agatha', nombre: 'Agatha' } },
    npcs: { legacy_agatha: { actorId: 'actor_agatha', nombre: 'Agatha Legacy' } },
  });
  expect(merged.filter((entry) => entry.actorId === 'actor_agatha')).toHaveLength(1);
  expect(merged.find((entry) => entry.actorId === 'actor_agatha')?.category).toBe('player');

  const previousBase = global.LuminousVttTokenState;
  try {
    delete require.cache[require.resolve('../js/vtt/token-state.js')];
    global.LuminousVttTokenState = require('../js/vtt/token-state.js');
    delete require.cache[require.resolve('../js/vtt/token-state-dynamic-patch.js')];
    require('../js/vtt/token-state-dynamic-patch.js');
    const mapData = { tokens: [playerToken('player:p1', 'actor_agatha')] };
    const bridge = global.LuminousVttTokenState.createBridge({ mapData, isDm: true });
    bridge.applyDynamicRecords({
      stale: {
        tokenId: 'npc:agatha',
        token: { id: 'npc:agatha', actorId: 'actor_agatha', dynamicActorToken: true },
        position: { x: 280, y: 280, zLayer: 0, gridPosition: { col: 4, row: 4, z: 0 } },
      },
      clerk: {
        tokenId: 'npc:clerk',
        token: { id: 'npc:clerk', actorId: 'actor_clerk', dynamicActorToken: true },
        position: { x: 350, y: 280, zLayer: 0, gridPosition: { col: 5, row: 4, z: 0 } },
      },
    });
    expect(mapData.tokens.some((token) => token.id === 'npc:agatha')).toBe(false);
    expect(mapData.tokens.some((token) => token.id === 'npc:clerk')).toBe(true);
  } finally {
    global.LuminousVttTokenState = previousBase;
  }
});

test('hardening: DM drag cannot accidentally enter View As, while a real click enters 120 degree POV', () => {
  delete require.cache[require.resolve('../js/vtt/dm-observer.js')];
  const observerApi = require('../js/vtt/dm-observer.js');
  const canvas = new MockTarget();
  const p4 = playerToken('p4');
  p4.facingDeg = 90;
  const mapData = { grid: { size: 70 }, lighting: {}, tokens: [p4] };
  const cameraFollow = {
    setTarget() {},
    clearTarget() {},
    setEnabled() {},
  };
  const runtime = {
    bridge: { isDm: true },
    engine: {
      canvas,
      activeZ: 0,
      tokenAtEvent: () => p4,
      setZLayer(z) { this.activeZ = z; },
    },
  };
  const host = new MockTarget();
  const observer = observerApi.createController({ runtime, mapData, cameraFollow, root: host });

  canvas.dispatchEvent(new MockCustomEvent('mousedown', { clientX: 100, clientY: 100, button: 0 }));
  canvas.dispatchEvent(new MockCustomEvent('mouseup', { clientX: 132, clientY: 100, button: 0 }));
  const syntheticClick = new MockCustomEvent('click', { clientX: 132, clientY: 100, button: 0 });
  canvas.dispatchEvent(syntheticClick);
  expect(observer.state().mode).toBe('free');
  expect(mapData.lighting.dmPreviewTokenId).toBe(null);
  expect(syntheticClick.defaultPrevented).toBe(true);

  canvas.dispatchEvent(new MockCustomEvent('mousedown', { clientX: 132, clientY: 100, button: 0 }));
  canvas.dispatchEvent(new MockCustomEvent('mouseup', { clientX: 132, clientY: 100, button: 0 }));
  canvas.dispatchEvent(new MockCustomEvent('click', { clientX: 132, clientY: 100, button: 0 }));
  expect(observer.state().mode).toBe('view_as');
  expect(mapData.lighting.dmPreviewTokenId).toBe('p4');
  observer.stop();
});

test('hardening: drag preview is local-only and persistence commit exists only in mouseup', () => {
  const engine = read('js/vtt/engine.js');
  const moveStart = engine.indexOf('handleTokenMouseMove(event)');
  const upStart = engine.indexOf('handleTokenMouseUp(event)');
  const centerStart = engine.indexOf('centerCamera()');
  expect(moveStart).toBeGreaterThan(-1);
  expect(upStart).toBeGreaterThan(moveStart);
  const moveSection = engine.slice(moveStart, upStart);
  const upSection = engine.slice(upStart, centerStart);
  expect(moveSection).toContain("'vtt:token-preview-moved'");
  expect(moveSection).not.toContain("'vtt:token-moved'");
  expect((upSection.match(/'vtt:token-moved'/g) || [])).toHaveLength(1);

  const observer = read('js/vtt/dm-observer.js');
  expect(observer).not.toContain('setInterval(');
  expect(observer).not.toMatch(/firebase\s*\.|\.ref\s*\(/);
});

test('hardening: live procedural runtime is physically capped to one 40x40 chunk', () => {
  const source = read('js/vtt/procedural-generator-bootstrap.js');
  expect(source).toMatch(/chunkCols:\s*1/);
  expect(source).toMatch(/chunkRows:\s*1/);
  expect(source).toContain("throw new Error('LIVE_PLAN_MUST_BE_SINGLE_CHUNK')");

  const zoneCore = read('js/vtt/procedural-zone-core.js');
  expect(zoneCore).toMatch(/40/);
});

test('hardening: renderer culls world geometry and tokens by viewport but export disables culling', () => {
  const source = read('js/vtt/renderer.js');
  expect(source).toContain('viewportBounds(camera');
  expect(source).toContain('this.visibleBounds = isExporting ? null');
  expect(source).toContain('if (!this.segmentVisible(wall.x1, wall.y1, wall.x2, wall.y2');
  expect(source).toContain('if (!this.pointVisible(token.x, token.y');
  expect(source).toContain('const minCol = bounds ?');
  expect(source).toContain('const maxRow = bounds ?');
});

test('hardening: world object persistence accepts the authenticated DM dashboard surface without widening player authority', () => {
  const previousFirebase = global.firebase;
  const previousDocument = global.document;
  try {
    global.firebase = {
      auth: () => ({ currentUser: { uid: 'configured-dm-not-legacy' } }),
      database: () => null,
    };
    global.document = { body: { classList: { contains: (name) => name === 'on-game-dashboard' } } };
    delete require.cache[require.resolve('../js/vtt/world-object-state.js')];
    const state = require('../js/vtt/world-object-state.js');
    expect(state.isDmSurface()).toBe(true);
  } finally {
    global.firebase = previousFirebase;
    global.document = previousDocument;
  }
});

test('hardening: Firebase rules remain restrictive while VTT DM roots are explicitly identifiable', () => {
  const rules = JSON.parse(read('database.rules.json')).rules;
  expect(rules['vtt_topology']?.$mapId?.['.write']).toContain('auth.uid');
  expect(rules['vtt_topology']?.$mapId?.['.write']).not.toBe('auth != null');
  expect(rules.campaña?.estado_mundo?.['.write']).toContain('auth.uid');
  expect(rules.campaña?.jugadores?.$nombre_personaje?.['.write']).toContain("data.child('uid').val() === auth.uid");
  expect(rules['vtt_world_object_action_requests']).toBeTruthy();
  expect(rules['vtt_regional_local_transition_requests']).toBeTruthy();
});
