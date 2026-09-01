const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const tokenState = require('../js/vtt/token-state.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

function fakeRoot({ uid = 'uid-player', playerId = 'player-key', actorId = 'actor-1' } = {}) {
  const writes = [];
  const makeRef = (pathValue) => ({
    path: pathValue,
    child(childKey) { return makeRef(`${pathValue}/${childKey}`); },
    async set(value) { writes.push({ type: 'set', path: pathValue, value }); },
    async update(value) { writes.push({ type: 'update', path: pathValue, value }); },
    async once() { return { exists: () => true, val: () => ({}) }; },
    on() {},
    off() {},
  });
  const database = () => ({ ref: (value) => makeRef(value) });
  database.ServerValue = { TIMESTAMP: 123456 };
  const root = {
    document: {},
    datosJugador: { id: playerId, playerId, actorId },
    localStorage: { getItem: (key) => key === 'playerId' ? playerId : null },
    firebase: {
      auth: () => ({ currentUser: { uid } }),
      database,
    },
  };
  return { root, writes };
}

function playerToken(overrides = {}) {
  return {
    id: 'player-template',
    x: 245,
    y: 315,
    draggable: true,
    characterLink: { mode: 'current_player' },
    zLayer: 0,
    elevationFt: 0,
    gridPosition: { col: 3, row: 4, z: 0 },
    z: [0],
    ...overrides,
  };
}

test('canonical position preserves Z elevation grid and partial stair progress', () => {
  const token = playerToken({
    x: 350,
    y: 420,
    zLayer: 1,
    elevationFt: 9.5,
    gridPosition: { col: 5, row: 6, z: 1 },
    z: [1],
    verticalMovement: {
      routeId: 'stairs_u_1',
      fromZ: 0,
      toZ: 1,
      progressFt: 12,
      totalFt: 24,
      costSpentFt: 12,
      layout: 'switchback',
      movementMode: 'stairs',
    },
  });

  const position = tokenState.positionFromToken(token);
  expect(position).toMatchObject({
    x: 350,
    y: 420,
    zLayer: 1,
    elevationFt: 9.5,
    gridPosition: { col: 5, row: 6, z: 1 },
    verticalMovement: { routeId: 'stairs_u_1', progressFt: 12, layout: 'switchback' },
  });

  const target = playerToken({ x: 1, y: 1 });
  tokenState.applyPosition(target, position);
  expect(target.x).toBe(350);
  expect(target.y).toBe(420);
  expect(target.zLayer).toBe(1);
  expect(target.z).toEqual([1]);
  expect(target.elevationFt).toBe(9.5);
  expect(target.gridPosition).toEqual({ col: 5, row: 6, z: 1 });
  expect(target.verticalMovement.progressFt).toBe(12);
});

test('campaign player records expose only the selected map token state', () => {
  const records = tokenState.extractPlayerRecords({
    alice: {
      uid: 'uid-a',
      vttTokenState: {
        alpha: { ownerUid: 'uid-a', position: { x: 10, y: 20 } },
        beta: { ownerUid: 'uid-a', position: { x: 30, y: 40 } },
      },
    },
    bob: { uid: 'uid-b' },
  }, 'alpha');

  expect(Object.keys(records)).toEqual(['alice']);
  expect(records.alice.playerId).toBe('alice');
  expect(records.alice.position).toEqual({ x: 10, y: 20 });
});

test('remote player records become distinct player tokens and only the owner is viewer', () => {
  const template = playerToken();
  const own = tokenState.playerTokenFromRecord(template, 'alice', {
    ownerUid: 'uid-a',
    playerId: 'alice',
    actorId: 'actor-a',
    position: { x: 100, y: 200, zLayer: 1, elevationFt: 15, gridPosition: { col: 1, row: 2, z: 1 } },
  }, { uid: 'uid-a', playerId: 'alice' });
  const other = tokenState.playerTokenFromRecord(template, 'bob', {
    ownerUid: 'uid-b',
    playerId: 'bob',
    position: { x: 300, y: 400, zLayer: 0, elevationFt: 0, gridPosition: { col: 4, row: 5, z: 0 } },
  }, { uid: 'uid-a', playerId: 'alice' });

  expect(own.id).toBe('player:alice');
  expect(own.viewer).toBe(true);
  expect(own.canonicalScope).toBe('player');
  expect(own.canonicalPlayerKey).toBe('alice');
  expect(other.id).toBe('player:bob');
  expect(other.viewer).toBe(false);
  expect(other.characterLink.uid).toBe('uid-b');
});

test('player writes only their campaign player token path and cannot persist world tokens', async () => {
  const { root, writes } = fakeRoot({ uid: 'uid-a', playerId: 'alice' });
  const mapData = { id: 'alpha', tokens: [playerToken()] };
  const bridge = tokenState.createBridge({ mapData, isDm: false, root });

  await bridge.saveToken(mapData.tokens[0]);
  expect(writes).toHaveLength(1);
  expect(writes[0].path).toBe('campaña/jugadores/alice/vttTokenState/alpha');
  expect(writes[0].value.ownerUid).toBe('uid-a');
  expect(writes[0].value.playerId).toBe('alice');

  await expect(bridge.saveToken({
    id: 'npc-1', x: 10, y: 10, zLayer: 0, elevationFt: 0,
    gridPosition: { col: 0, row: 0, z: 0 }, z: [0],
  })).rejects.toThrow('DM_REQUIRED');
});

test('player cannot persist another player canonical token', async () => {
  const { root } = fakeRoot({ uid: 'uid-a', playerId: 'alice' });
  const bridge = tokenState.createBridge({ mapData: { id: 'alpha', tokens: [playerToken()] }, isDm: false, root });
  const other = playerToken({
    id: 'player:bob',
    characterLink: { mode: 'player', uid: 'uid-b', playerId: 'bob' },
    canonicalScope: 'player',
    canonicalPlayerKey: 'bob',
    canonicalOwnerUid: 'uid-b',
    playerId: 'bob',
    ownerUid: 'uid-b',
  });
  await expect(bridge.saveToken(other)).rejects.toThrow('PLAYER_TOKEN_OWNERSHIP_REQUIRED');
});

test('DM can persist both a player token and a world token to canonical campaign roots', async () => {
  const { root, writes } = fakeRoot({ uid: tokenState.DM_UID, playerId: 'dm' });
  const bridge = tokenState.createBridge({ mapData: { id: 'alpha', tokens: [] }, isDm: true, root });

  await bridge.saveToken({
    ...playerToken(),
    id: 'player:alice',
    characterLink: { mode: 'player', uid: 'uid-a', playerId: 'alice' },
    canonicalScope: 'player',
    canonicalPlayerKey: 'alice',
    canonicalOwnerUid: 'uid-a',
    ownerUid: 'uid-a',
    playerId: 'alice',
  });
  await bridge.saveToken({
    id: 'npc-1', x: 70, y: 70, zLayer: 0, elevationFt: 0,
    gridPosition: { col: 1, row: 1, z: 0 }, z: [0], draggable: true,
  });

  expect(writes[0].path).toBe('campaña/jugadores/alice/vttTokenState/alpha');
  expect(writes[1].path).toBe('campaña/estado_mundo/vttTokens/alpha/npc-1');
});

test('VTT runtime wires canonical token state to movement events and existing Firebase authority', () => {
  const html = read('vtt.html');
  const main = read('js/vtt/main.js');
  const rules = read('database.rules.json');
  const stateSource = read('js/vtt/token-state.js');

  expect(html).toContain('js/vtt/token-state.js');
  expect(main).toContain('LuminousVttTokenState');
  expect(main).toContain("canvas.addEventListener('vtt:token-moved'");
  expect(main).toContain('tokenStateBridge.saveToken(token)');
  expect(main).toContain('tokenStateBridge.stop()');
  expect(stateSource).toContain("const PLAYER_ROOT = 'campaña/jugadores'");
  expect(stateSource).toContain("const WORLD_ROOT = 'campaña/estado_mundo/vttTokens'");

  const parsedRules = JSON.parse(rules).rules;
  expect(parsedRules['campaña']['.read']).toBe('auth != null');
  expect(parsedRules['campaña'].jugadores['$nombre_personaje']['.write']).toContain("data.child('uid').val() === auth.uid");
  expect(parsedRules['campaña'].estado_mundo['.write']).toContain(tokenState.DM_UID);
});

test('canonical token state UMD module parses as JavaScript', () => {
  execFileSync(process.execPath, ['--check', path.join(__dirname, '..', 'js/vtt/token-state.js')], { stdio: 'pipe' });
  expect(read('js/vtt/main.js')).toContain('tokenStateBridge');
});
