const { test, expect } = require('@playwright/test');

require('../js/vtt/movement-rules.js');

const canonicalWrites = [];

globalThis.LuminousVttTokenState = {
  PLAYER_ROOT: 'campaña/jugadores',
  WORLD_ROOT: 'campaña/estado_mundo/vttTokens',
  firebaseKey: (value, fallback = 'key') => String(value ?? '').replace(/[.#$\[\]\/]/g, '_') || fallback,
  hostFirebase: () => null,
  createBridge(options = {}) {
    return Object.freeze({
      mapId: options.mapData?.id || 'claim-map',
      isDm: Boolean(options.isDm),
      identity: { playerId: options.playerId || 'player', uid: options.uid || 'uid' },
      start: () => true,
      stop: () => true,
      async saveToken(token) {
        canonicalWrites.push({ bridge: options.label || 'bridge', tokenId: token.id, x: token.x, y: token.y });
        return { valid: true, scope: token.canonicalScope === 'world' ? 'world' : 'player', key: token.id };
      },
      async createWorldToken(token) {
        canonicalWrites.push({ bridge: options.label || 'bridge', tokenId: token.id, x: token.x, y: token.y });
        return { valid: true, scope: 'world', key: token.id };
      },
    });
  },
};

delete require.cache[require.resolve('../js/vtt/movement-destination-claims.js')];
const claims = require('../js/vtt/movement-destination-claims.js');
const tokenState = globalThis.LuminousVttTokenState;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function snapshot(value) {
  const copy = clone(value);
  return { val: () => clone(copy), exists: () => copy != null };
}

class FakeRef {
  constructor(store, path) {
    this.store = store;
    this.path = path;
  }

  async transaction(updater) {
    const current = this.store.has(this.path) ? clone(this.store.get(this.path)) : null;
    const next = updater(current);
    if (next === undefined) return { committed: false, snapshot: snapshot(current) };
    if (next === null) this.store.delete(this.path);
    else this.store.set(this.path, clone(next));
    return { committed: true, snapshot: snapshot(next) };
  }

  async once() {
    return snapshot(this.store.has(this.path) ? this.store.get(this.path) : null);
  }
}

class FakeDb {
  constructor() { this.store = new Map(); }
  ref(path) { return new FakeRef(this.store, path); }
}

function mapData() {
  return { id: 'claim-map', grid: { cols: 4, rows: 2, size: 70, distancePerCell: 5 }, movement: {}, tokens: [] };
}

function movingToken(id, controlSource, rttMs = null) {
  return {
    id,
    canonicalScope: 'player',
    controlSource,
    networkRttMs: rttMs,
    x: 105,
    y: 35,
    zLayer: 0,
    z: [0],
    gridPosition: { col: 1, row: 0, z: 0 },
    movementState: { roundId: 1, speedFt: 30, remainingFt: 20, dashed: false, mode: 'walk' },
    movementRemainingFt: 20,
    movementTurnHistory: [{ path: [{ x: 35, y: 35 }, { x: 105, y: 35 }], costFt: 5, movementType: 'normal' }],
    pendingMovementClaim: {
      from: { x: 35, y: 35, zLayer: 0, elevationFt: 0, gridPosition: { col: 0, row: 0, z: 0 } },
      to: { x: 105, y: 35, col: 1, row: 0, zLayer: 0 },
      movementCostFt: 5,
      movementType: 'normal',
      authority: controlSource,
      rttMs,
    },
  };
}

function bridge(db, label, isDm = false) {
  return tokenState.createBridge({
    db,
    mapData: mapData(),
    label,
    isDm,
    playerId: label,
    movementClaimArbitrationMs: 30,
    movementClaimLeaseMs: 500,
    movementClaimPostCommitHoldMs: 20,
  });
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test.beforeEach(() => { canonicalWrites.length = 0; });

test('simultaneous Player claim replaces GOAP before canonical commit and loser rolls back/refunds', async () => {
  const db = new FakeDb();
  const goapBridge = bridge(db, 'goap');
  const playerBridge = bridge(db, 'player');
  const goap = movingToken('goap-token', 'goap', 5);
  const player = movingToken('player-token', 'player', 80);

  const goapSave = goapBridge.saveToken(goap);
  await delay(5);
  const playerSave = playerBridge.saveToken(player);
  const [goapResult, playerResult] = await Promise.allSettled([goapSave, playerSave]);

  expect(goapResult.status).toBe('rejected');
  expect(goapResult.reason.message).toBe('MOVEMENT_DESTINATION_CLAIM_LOST');
  expect(playerResult.status).toBe('fulfilled');
  expect(canonicalWrites).toEqual([expect.objectContaining({ tokenId: 'player-token' })]);
  expect(goap).toMatchObject({ x: 35, y: 35, movementRemainingFt: 25, gridPosition: { col: 0, row: 0, z: 0 } });
  expect(goap.movementTurnHistory).toEqual([]);
  expect(goap.pendingMovementClaim).toBeUndefined();
});

test('simultaneous DM claim replaces Player regardless of RTT', async () => {
  const db = new FakeDb();
  const playerBridge = bridge(db, 'player');
  const dmBridge = bridge(db, 'dm', true);
  const player = movingToken('player-token', 'player', 4);
  const dm = movingToken('dm-token', 'dm', 500);
  dm.canonicalScope = 'world';

  const playerSave = playerBridge.saveToken(player);
  await delay(5);
  const dmSave = dmBridge.saveToken(dm);
  const [playerResult, dmResult] = await Promise.allSettled([playerSave, dmSave]);

  expect(playerResult.status).toBe('rejected');
  expect(dmResult.status).toBe('fulfilled');
  expect(canonicalWrites).toEqual([expect.objectContaining({ tokenId: 'dm-token' })]);
});

test('equal authority uses lower RTT as the arbitration tie-break', async () => {
  const db = new FakeDb();
  const slowBridge = bridge(db, 'slow');
  const fastBridge = bridge(db, 'fast');
  const slow = movingToken('slow-token', 'player', 90);
  const fast = movingToken('fast-token', 'player', 15);

  const slowSave = slowBridge.saveToken(slow);
  await delay(5);
  const fastSave = fastBridge.saveToken(fast);
  const [slowResult, fastResult] = await Promise.allSettled([slowSave, fastSave]);

  expect(slowResult.status).toBe('rejected');
  expect(fastResult.status).toBe('fulfilled');
  expect(canonicalWrites).toEqual([expect.objectContaining({ tokenId: 'fast-token' })]);
});

test('expired stale claim can be replaced but a locked live claim cannot be stolen', async () => {
  const db = new FakeDb();
  const map = mapData();
  const cell = claims.cellForClaim({ to: { x: 105, y: 35, col: 1, row: 0, zLayer: 0 } }, map);
  const path = `${claims.CLAIM_ROOT}/claim-map/0/${cell.col}_${cell.row}`;
  db.store.set(path, { claimId: 'stale', tokenId: 'old', authority: 'dm', locked: true, committed: true, expiresAtMs: 0 });

  const playerBridge = tokenState.createBridge({ db, mapData: map, label: 'player', movementClaimArbitrationMs: 0, movementClaimLeaseMs: 500, movementClaimPostCommitHoldMs: 100 });
  const player = movingToken('player-token', 'player', 20);
  await expect(playerBridge.saveToken(player)).resolves.toMatchObject({ destinationClaim: { valid: true } });

  const locked = clone(db.store.get(path));
  expect(locked).toMatchObject({ tokenId: 'player-token', locked: true, committed: true });
  const dmBridge = tokenState.createBridge({ db, mapData: map, label: 'dm', isDm: true, movementClaimArbitrationMs: 0, movementClaimLeaseMs: 500, movementClaimPostCommitHoldMs: 100 });
  const dm = movingToken('dm-token', 'dm', 1);
  dm.canonicalScope = 'world';
  await expect(dmBridge.saveToken(dm)).rejects.toThrow('MOVEMENT_DESTINATION_CLAIM_LOST');
  expect(canonicalWrites.filter((entry) => entry.tokenId === 'dm-token')).toHaveLength(0);
});
