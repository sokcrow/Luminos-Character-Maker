const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function freshRequire(relativePath) {
  const file = path.join(__dirname, '..', relativePath);
  delete require.cache[require.resolve(file)];
  return require(file);
}

async function loadPolish() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'js/vtt/movement-navigation-polish.js'), 'utf8');
  const tmp = path.join(os.tmpdir(), `luminous-navigation-realtime-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, source);
  const mod = await import(`${pathToFileURL(tmp).href}?t=${Date.now()}`);
  return { mod, tmp };
}

class FakeCustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail || {};
  }
}

function eventCanvas() {
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

function installRuntimePathfinding() {
  global.LuminousVttTokenInteraction = undefined;
  global.LuminousVttPathfinding = freshRequire('js/vtt/pathfinding.js');
  global.LuminousVttMovementEngine = freshRequire('js/vtt/movement-engine.js');
  global.LuminousVttTokenState = null;
  freshRequire('js/vtt/movement-integration-patch.js');
  return global.LuminousVttPathfinding;
}

test('realtime preview carries ephemeral destination metadata without adding it to canonical token position', () => {
  const realtime = freshRequire('js/vtt/movement-realtime.js');
  const token = {
    id: 'player-token',
    canonicalScope: 'player',
    canonicalPlayerKey: 'alice',
    playerId: 'alice',
    x: 105,
    y: 175,
    zLayer: 0,
    elevationFt: 0,
  };

  const preview = realtime.previewFromToken(token, {
    current: { uid: 'alice-uid', playerId: 'alice' },
    destination: { x: 525, y: 315, zLayer: 0 },
    aiming: true,
    traversing: false,
    sequence: 7,
    sessionId: 'alice-session',
    sentAtMs: 1000,
    expiresAtMs: 2800,
  });

  expect(preview).toMatchObject({
    scope: 'player',
    playerKey: 'alice',
    destination: { x: 525, y: 315, zLayer: 0 },
    aiming: true,
    traversing: false,
  });

  const canonicalPosition = realtime.snapshotPosition(token);
  expect(canonicalPosition).not.toHaveProperty('destination');
  expect(canonicalPosition).not.toHaveProperty('aiming');
  expect(canonicalPosition).not.toHaveProperty('traversing');
});

test('DM receives player aiming/traversal destination and target marker clears with preview lifecycle', async () => {
  installRuntimePathfinding();
  const realtime = freshRequire('js/vtt/movement-realtime.js');
  const { mod, tmp } = await loadPolish();
  try {
    mod.installStraightPathfinding(global);
    const canvas = eventCanvas();
    const token = {
      id: 'player-token',
      canonicalScope: 'player',
      canonicalPlayerKey: 'alice',
      playerId: 'alice',
      x: 105,
      y: 105,
      zLayer: 0,
    };
    const mapData = {
      id: 'realtime-test',
      grid: { cols: 30, rows: 30, size: 70, distancePerCell: 5 },
      movement: { diagonalRule: '5e', blockTokens: false, terrain: {} },
      tokens: [token],
    };
    const renderer = {
      backend: 'webgl2',
      render() {},
      drawDmObserverOutlines(outlines) { this.lastOutlines = outlines; },
    };
    const engine = {
      mapData,
      canvas,
      renderer,
      camera: { zoom: 1 },
      activeZ: 0,
      tokenMotion: null,
      tokenDrag: null,
      async animateTokenPath() { return { valid: true, complete: true }; },
    };
    const host = {
      CustomEvent: FakeCustomEvent,
      LuminousVttPathfinding: global.LuminousVttPathfinding,
      LuminousVttSceneDirty: { emit() {} },
      setTimeout,
      clearTimeout,
    };

    const markerApi = mod.installRuntimeNavigationPolish({ host, runtime: { engine } });
    const controller = realtime.createController({
      root: host,
      mapData,
      canvas,
      engine,
      identity: { uid: 'dm-uid', playerId: 'dm' },
      isDm: true,
      now: () => 1000,
      setTimeoutFn: () => 1,
      clearTimeoutFn() {},
    });

    const aiming = {
      schemaVersion: 2,
      scope: 'player',
      tokenId: 'player-token',
      playerKey: 'alice',
      x: 105,
      y: 105,
      zLayer: 0,
      destination: { x: 525, y: 315, zLayer: 0 },
      aiming: true,
      traversing: false,
      sequence: 1,
      sessionId: 'alice-session',
      expiresAtMs: 2800,
      committed: false,
    };
    controller.handleIncoming(aiming, 'alice');
    expect(markerApi.markers.get('player-token')).toMatchObject({
      x: 525,
      y: 315,
      zLayer: 0,
      phase: 'preview',
    });

    const traversing = {
      ...aiming,
      x: 245,
      sequence: 2,
      aiming: false,
      traversing: true,
    };
    controller.handleIncoming(traversing, 'alice');
    expect(token.x).toBe(245);
    expect(markerApi.markers.get('player-token')).toMatchObject({
      x: 525,
      y: 315,
      phase: 'committed',
    });

    renderer.render();
    expect(renderer.lastOutlines?.length).toBe(2);

    controller.clearIncoming(traversing, 'alice');
    expect(markerApi.markers.has('player-token')).toBe(false);
    expect(token.x).toBe(105);
  } finally {
    fs.unlinkSync(tmp);
  }
});
