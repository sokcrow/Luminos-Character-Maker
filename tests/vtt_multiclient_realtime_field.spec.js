const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const tokenState = require('../js/vtt/token-state.js');
const Discovery = require('../js/vtt/player-discovery-core.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

function splitPath(value = '') {
  return String(value || '').split('/').filter(Boolean);
}

function getAt(root, pathValue) {
  let cursor = root;
  for (const key of splitPath(pathValue)) {
    if (cursor == null || typeof cursor !== 'object') return null;
    cursor = cursor[key];
  }
  return cursor == null ? null : cursor;
}

function setAt(root, pathValue, value) {
  const parts = splitPath(pathValue);
  if (!parts.length) {
    Object.keys(root).forEach((key) => delete root[key]);
    if (value && typeof value === 'object') Object.assign(root, clone(value));
    return;
  }
  let cursor = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    cursor[parts[i]] ||= {};
    cursor = cursor[parts[i]];
  }
  const last = parts.at(-1);
  if (value == null) delete cursor[last];
  else cursor[last] = clone(value);
}

class SharedRealtimeDb {
  constructor(initial = {}) {
    this.data = clone(initial);
    this.listeners = new Map();
    this.registrations = [];
    this.deliveries = [];
    this.writes = [];
  }

  listenerKey(pathValue, event) { return `${pathValue}|${event}`; }

  snapshot(pathValue, keyOverride) {
    const value = clone(getAt(this.data, pathValue));
    return {
      key: keyOverride ?? splitPath(pathValue).at(-1) ?? null,
      val: () => value,
      exists: () => value != null,
      ref: this.ref(pathValue),
    };
  }

  deliver(pathValue, event, handler, snapshot) {
    this.deliveries.push({ path: pathValue, event, key: snapshot?.key ?? null });
    handler(snapshot);
  }

  on(pathValue, event, handler) {
    const key = this.listenerKey(pathValue, event);
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(handler);
    this.registrations.push({ type: 'on', path: pathValue, event });
    if (event === 'value') {
      this.deliver(pathValue, event, handler, this.snapshot(pathValue));
    } else if (event === 'child_added') {
      const current = getAt(this.data, pathValue) || {};
      Object.keys(current).forEach((childKey) => this.deliver(pathValue, event, handler, this.snapshot(`${pathValue}/${childKey}`, childKey)));
    }
  }

  off(pathValue, event, handler) {
    this.listeners.get(this.listenerKey(pathValue, event))?.delete(handler);
    this.registrations.push({ type: 'off', path: pathValue, event });
  }

  emitMutation(changedPath, before) {
    for (const [listenerKey, handlers] of this.listeners.entries()) {
      const separator = listenerKey.lastIndexOf('|');
      const listenerPath = listenerKey.slice(0, separator);
      const event = listenerKey.slice(separator + 1);
      const descendantChange = changedPath === listenerPath || changedPath.startsWith(`${listenerPath}/`);
      const ancestorReplace = listenerPath.startsWith(`${changedPath}/`);
      if (event === 'value' && (descendantChange || ancestorReplace)) {
        for (const handler of [...handlers]) this.deliver(listenerPath, event, handler, this.snapshot(listenerPath));
        continue;
      }
      if (!descendantChange || !['child_added', 'child_removed'].includes(event)) continue;
      const rest = splitPath(changedPath).slice(splitPath(listenerPath).length);
      const childKey = rest[0];
      if (!childKey) continue;
      const childPath = `${listenerPath}/${childKey}`;
      const previous = getAt(before, childPath);
      const next = getAt(this.data, childPath);
      const shouldDeliver = event === 'child_added' ? previous == null && next != null : previous != null && next == null;
      if (!shouldDeliver) continue;
      const snapshotData = event === 'child_removed' ? previous : next;
      const snapshot = {
        key: childKey,
        val: () => clone(snapshotData),
        exists: () => snapshotData != null,
        ref: this.ref(childPath),
      };
      for (const handler of [...handlers]) this.deliver(listenerPath, event, handler, snapshot);
    }
  }

  async set(pathValue, value) {
    const before = clone(this.data);
    setAt(this.data, pathValue, value);
    this.writes.push({ type: 'set', path: pathValue, value: clone(value) });
    this.emitMutation(pathValue, before);
  }

  async update(pathValue, updates = {}) {
    for (const [key, value] of Object.entries(updates)) {
      const target = pathValue ? `${pathValue}/${key}` : key;
      await this.set(target, value);
    }
  }

  listenerCount() {
    let total = 0;
    for (const handlers of this.listeners.values()) total += handlers.size;
    return total;
  }

  ref(pathValue = '') {
    const db = this;
    const normalized = String(pathValue || '').replace(/^\/+|\/+$/g, '');
    return {
      path: normalized,
      child(childKey) { return db.ref(normalized ? `${normalized}/${childKey}` : childKey); },
      on(event, handler) { db.on(normalized, event, handler); },
      off(event, handler) { db.off(normalized, event, handler); },
      once: async () => db.snapshot(normalized),
      set: async (value) => db.set(normalized, value),
      update: async (updates) => db.update(normalized, updates),
      remove: async () => db.set(normalized, null),
    };
  }
}

function templateToken() {
  return {
    id: 'player-template',
    x: 35,
    y: 35,
    draggable: true,
    characterLink: { mode: 'current_player' },
    zLayer: 0,
    elevationFt: 0,
    gridPosition: { col: 0, row: 0, z: 0 },
    z: [0],
  };
}

function baseMap(id = 'alpha') {
  return {
    id,
    grid: { size: 70, cols: 40, rows: 40 },
    tokens: [
      templateToken(),
      { id: 'npc-1', x: 700, y: 700, draggable: true, zLayer: 0, elevationFt: 0, gridPosition: { col: 10, row: 10, z: 0 }, z: [0] },
    ],
  };
}

function rootFor(shared, { uid, playerId, actorId }) {
  const database = () => shared;
  database.ServerValue = { TIMESTAMP: 777 };
  shared.ref = shared.ref.bind(shared);
  return {
    document: {},
    datosJugador: { id: playerId, playerId, actorId },
    localStorage: { getItem: (key) => key === 'playerId' ? playerId : null },
    firebase: { auth: () => ({ currentUser: { uid } }), database },
  };
}

function client(shared, { uid, playerId, actorId = `actor-${playerId}`, isDm = false, mapId = 'alpha' }) {
  const mapData = baseMap(mapId);
  const changes = [];
  const bridge = tokenState.createBridge({
    mapData,
    isDm,
    root: rootFor(shared, { uid, playerId, actorId }),
    onTokensChanged: (change) => changes.push({ scope: change.scope, count: change.tokens.length }),
  });
  return { uid, playerId, isDm, mapData, bridge, changes };
}

const playerToken = (session, playerId) => (session.mapData.tokens || []).find((token) => String(token.canonicalPlayerKey || token.playerId || '') === playerId);
const playerKeys = (session) => (session.mapData.tokens || []).filter((token) => token.canonicalScope === 'player').map((token) => token.canonicalPlayerKey).sort();
const flush = async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); };

function initialDb() {
  return new SharedRealtimeDb({
    campaña: {
      jugadores: {
        alice: { uid: 'uid-a' },
        bob: { uid: 'uid-b' },
        carol: { uid: 'uid-c' },
      },
    },
  });
}

async function startFour() {
  const shared = initialDb();
  const sessions = [
    client(shared, { uid: tokenState.DM_UID, playerId: 'dm', isDm: true }),
    client(shared, { uid: 'uid-a', playerId: 'alice' }),
    client(shared, { uid: 'uid-b', playerId: 'bob' }),
    client(shared, { uid: 'uid-c', playerId: 'carol' }),
  ];
  sessions.forEach((session) => session.bridge.start());
  await flush();
  return { shared, sessions, dm: sessions[0], alice: sessions[1], bob: sessions[2], carol: sessions[3] };
}

test.describe('VTT shared multiclient Realtime field', () => {
  test('DM + 3 players converge to exactly one canonical token per player', async () => {
    const { sessions } = await startFour();
    for (const session of sessions) {
      expect(playerKeys(session)).toEqual(['alice', 'bob', 'carol']);
      expect(new Set(playerKeys(session)).size).toBe(3);
      expect(session.mapData.tokens.filter((token) => token.id === 'npc-1')).toHaveLength(1);
    }
    expect(sessions[0].mapData.tokens.some((token) => token.characterLink?.mode === 'current_player')).toBe(false);
    for (const session of sessions.slice(1)) {
      expect(session.mapData.tokens.filter((token) => token.viewer === true)).toHaveLength(1);
      expect(playerToken(session, session.playerId)?.characterLink?.mode).toBe('current_player');
    }
    sessions.forEach((session) => session.bridge.stop());
  });

  test('three simultaneous player moves converge without cross-player overwrite', async () => {
    const { sessions, dm, alice, bob, carol, shared } = await startFour();
    const targets = {
      alice: { x: 140, y: 210, zLayer: 0, elevationFt: 0, gridPosition: { col: 2, row: 3, z: 0 } },
      bob: { x: 420, y: 350, zLayer: 1, elevationFt: 15, gridPosition: { col: 6, row: 5, z: 1 } },
      carol: { x: 630, y: 560, zLayer: 2, elevationFt: 30, gridPosition: { col: 9, row: 8, z: 2 } },
    };
    for (const session of [alice, bob, carol]) Object.assign(playerToken(session, session.playerId), targets[session.playerId]);
    const beforeWrites = shared.writes.length;
    await Promise.all([alice, bob, carol].map((session) => session.bridge.saveToken(playerToken(session, session.playerId))));
    await flush();

    expect(shared.writes.length - beforeWrites).toBe(3);
    for (const observer of sessions) {
      for (const [id, target] of Object.entries(targets)) {
        expect(playerToken(observer, id)).toMatchObject({ x: target.x, y: target.y, zLayer: target.zLayer, elevationFt: target.elevationFt, gridPosition: target.gridPosition });
      }
    }
    expect(playerToken(dm, 'bob').zLayer).toBe(1);
    sessions.forEach((session) => session.bridge.stop());
  });

  test('ownership still rejects moving another player while DM authority remains valid', async () => {
    const { sessions, dm, alice } = await startFour();
    await expect(alice.bridge.saveToken(playerToken(alice, 'bob'))).rejects.toThrow('PLAYER_TOKEN_OWNERSHIP_REQUIRED');
    const bobFromDm = playerToken(dm, 'bob');
    bobFromDm.x = 777;
    await expect(dm.bridge.saveToken(bobFromDm)).resolves.toMatchObject({ valid: true, scope: 'player', key: 'bob' });
    await flush();
    expect(playerToken(alice, 'bob').x).toBe(777);
    sessions.forEach((session) => session.bridge.stop());
  });

  test('disconnect removes listeners; reconnect restores latest X/Y/Z once without duplicate tokens', async () => {
    const { sessions, shared, alice, bob, carol } = await startFour();
    expect(shared.listenerCount()).toBe(24);
    bob.bridge.stop();
    expect(shared.listenerCount()).toBe(18);

    const aliceToken = playerToken(alice, 'alice');
    Object.assign(aliceToken, { x: 980, y: 1050, zLayer: 2, elevationFt: 30, gridPosition: { col: 14, row: 15, z: 2 } });
    await alice.bridge.saveToken(aliceToken);
    const carolToken = playerToken(carol, 'carol');
    Object.assign(carolToken, { x: 350, y: 490, zLayer: 1, elevationFt: 15, gridPosition: { col: 5, row: 7, z: 1 } });
    await carol.bridge.saveToken(carolToken);
    await flush();

    const reconnectedBob = client(shared, { uid: 'uid-b', playerId: 'bob' });
    reconnectedBob.bridge.start();
    await flush();
    expect(shared.listenerCount()).toBe(24);
    expect(playerKeys(reconnectedBob)).toEqual(['alice', 'bob', 'carol']);
    expect(new Set(playerKeys(reconnectedBob)).size).toBe(3);
    expect(playerToken(reconnectedBob, 'alice')).toMatchObject({ x: 980, y: 1050, zLayer: 2, elevationFt: 30 });
    expect(playerToken(reconnectedBob, 'carol')).toMatchObject({ x: 350, y: 490, zLayer: 1, elevationFt: 15 });
    expect(reconnectedBob.mapData.tokens.filter((token) => token.viewer === true)).toHaveLength(1);

    sessions.filter((session) => session !== bob).forEach((session) => session.bridge.stop());
    reconnectedBob.bridge.stop();
    expect(shared.listenerCount()).toBe(0);
  });

  test('map token state is isolated by mapId and alpha movement cannot leak into beta', async () => {
    const { sessions, shared, alice } = await startFour();
    const betaAlice = client(shared, { uid: 'uid-a', playerId: 'alice', mapId: 'beta' });
    betaAlice.bridge.start();
    await flush();
    expect(playerKeys(betaAlice)).toEqual(['alice']);
    const betaBefore = clone(playerToken(betaAlice, 'alice'));

    const alphaAlice = playerToken(alice, 'alice');
    Object.assign(alphaAlice, { x: 1330, y: 1260, zLayer: 1, elevationFt: 15, gridPosition: { col: 19, row: 18, z: 1 } });
    await alice.bridge.saveToken(alphaAlice);
    await flush();

    expect(playerToken(betaAlice, 'alice')).toMatchObject({ x: betaBefore.x, y: betaBefore.y, zLayer: betaBefore.zLayer });
    expect(getAt(shared.data, 'campaña/jugadores/alice/vttTokenState/alpha/position/x')).toBe(1330);
    expect(getAt(shared.data, 'campaña/jugadores/alice/vttTokenState/beta/position/x')).toBe(betaBefore.x);
    sessions.forEach((session) => session.bridge.stop());
    betaAlice.bridge.stop();
  });

  test('Fog memory remains player-private through independent capture and reconnect normalization', () => {
    const aliceIdentity = { worldId: 'limbus', regionId: 'D', zoneId: 'market' };
    const bobIdentity = { worldId: 'limbus', regionId: 'D', zoneId: 'market' };
    let aliceFog = Discovery.blank(aliceIdentity, 100);
    let bobFog = Discovery.blank(bobIdentity, 100);
    aliceFog = Discovery.capture(aliceFog, { identity: aliceIdentity, zLayer: 0, chunkCol: 0, chunkRow: 0, worldNow: 110, cells: [{ worldCol: 2, worldRow: 3 }] }).record;
    bobFog = Discovery.capture(bobFog, { identity: bobIdentity, zLayer: 0, chunkCol: 1, chunkRow: 0, worldNow: 120, cells: [{ worldCol: 45, worldRow: 6 }] }).record;

    const restoredAlice = Discovery.normalize(clone(aliceFog), aliceIdentity);
    const restoredBob = Discovery.normalize(clone(bobFog), bobIdentity);
    expect(Discovery.slice(restoredAlice, { zLayer: 0, chunkCol: 0, chunkRow: 0 }).cells).toEqual([{ col: 2, row: 3 }]);
    expect(Discovery.slice(restoredAlice, { zLayer: 0, chunkCol: 1, chunkRow: 0 }).cells).toEqual([]);
    expect(Discovery.slice(restoredBob, { zLayer: 0, chunkCol: 1, chunkRow: 0 }).cells).toEqual([{ col: 5, row: 6 }]);
  });

  test('player movement Realtime is incremental and never subscribes to the whole players tree as value', () => {
    const source = read('js/vtt/token-state.js');
    expect(source).not.toContain("subscribe(playersRootRef(), 'value'");
    expect(source).toContain("subscribe(playersRootRef(), 'child_added'");
    expect(source).toContain("subscribe(playersRootRef(), 'child_removed'");
    expect(source).toContain("ref.on('value', handler)");
    expect(source).toContain('playerStateSubscriptions');

    const engine = read('js/vtt/engine.js');
    const moveStart = engine.indexOf('handleTokenMouseMove(event)');
    const animateStart = engine.indexOf('async animateTokenPath', moveStart);
    const upStart = engine.indexOf('async handleTokenMouseUp(event)', animateStart);
    const finalizeStart = engine.indexOf('finalizeTokenMove(token, drag, result = {})', upStart);
    const centerStart = engine.indexOf('    centerCamera() {', finalizeStart);
    expect(moveStart).toBeGreaterThan(-1);
    expect(animateStart).toBeGreaterThan(moveStart);
    expect(upStart).toBeGreaterThan(animateStart);
    expect(finalizeStart).toBeGreaterThan(upStart);
    expect(centerStart).toBeGreaterThan(finalizeStart);
    expect(engine.slice(moveStart, animateStart)).not.toContain("'vtt:token-moved'");
    expect(engine.slice(upStart, finalizeStart)).toContain('this.finalizeTokenMove(token, drag, result)');
    expect(engine.slice(upStart, finalizeStart)).not.toContain("new CustomEvent('vtt:token-moved'");
    expect((engine.slice(finalizeStart, centerStart).match(/'vtt:token-moved'/g) || [])).toHaveLength(1);
  });
});