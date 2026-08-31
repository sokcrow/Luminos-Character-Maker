const { test, expect } = require('@playwright/test');

const tokenState = require('../js/vtt/token-state.js');
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

  on(pathValue, event, handler) {
    const key = this.listenerKey(pathValue, event);
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(handler);
    if (event === 'value') {
      handler(this.snapshot(pathValue));
    } else if (event === 'child_added') {
      const current = getAt(this.data, pathValue) || {};
      Object.keys(current).forEach((childKey) => handler(this.snapshot(`${pathValue}/${childKey}`, childKey)));
    }
  }

  off(pathValue, event, handler) {
    this.listeners.get(this.listenerKey(pathValue, event))?.delete(handler);
  }

  emitMutation(changedPath, before) {
    for (const [listenerKey, handlers] of this.listeners.entries()) {
      const separator = listenerKey.lastIndexOf('|');
      const listenerPath = listenerKey.slice(0, separator);
      const event = listenerKey.slice(separator + 1);
      const descendantChange = changedPath === listenerPath || changedPath.startsWith(`${listenerPath}/`);
      const ancestorReplace = listenerPath.startsWith(`${changedPath}/`);
      if (event === 'value' && (descendantChange || ancestorReplace)) {
        for (const handler of [...handlers]) handler(this.snapshot(listenerPath));
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
      for (const handler of [...handlers]) handler(snapshot);
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

function baseMap(id = 'field-eight') {
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

function client(shared, { uid, playerId, actorId = `actor-${playerId}`, isDm = false }) {
  const mapData = baseMap();
  const bridge = tokenState.createBridge({
    mapData,
    isDm,
    root: rootFor(shared, { uid, playerId, actorId }),
  });
  return { uid, playerId, isDm, mapData, bridge };
}

const PLAYER_IDS = Object.freeze(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8']);
const uidFor = (playerId) => `uid-${playerId.toLowerCase()}`;
const playerToken = (session, playerId) => (session.mapData.tokens || []).find((token) => String(token.canonicalPlayerKey || token.playerId || '') === playerId);
const playerKeys = (session) => (session.mapData.tokens || []).filter((token) => token.canonicalScope === 'player').map((token) => token.canonicalPlayerKey).sort();
const flush = async () => { for (let i = 0; i < 10; i += 1) await Promise.resolve(); };

function initialDb() {
  return new SharedRealtimeDb({
    campaña: {
      jugadores: Object.fromEntries(PLAYER_IDS.map((playerId) => [playerId, { uid: uidFor(playerId) }])),
    },
  });
}

async function startNine() {
  const shared = initialDb();
  const dm = client(shared, { uid: tokenState.DM_UID, playerId: 'dm', isDm: true });
  const players = PLAYER_IDS.map((playerId) => client(shared, { uid: uidFor(playerId), playerId }));
  const sessions = [dm, ...players];
  sessions.forEach((session) => session.bridge.start());
  await flush();
  return { shared, dm, players, sessions };
}

function targetFor(index) {
  const col = 2 + index * 3;
  const row = 3 + index * 2;
  const zLayer = index % 3;
  return {
    x: col * 70,
    y: row * 70,
    zLayer,
    elevationFt: zLayer * 15,
    gridPosition: { col, row, z: zLayer },
  };
}

test.describe('VTT eight-player Realtime field stress', () => {
  test('DM + 8 players converge to one canonical token per player with bounded listeners', async () => {
    const { shared, dm, players, sessions } = await startNine();

    for (const session of sessions) {
      expect(playerKeys(session)).toEqual(PLAYER_IDS);
      expect(new Set(playerKeys(session)).size).toBe(8);
      expect(session.mapData.tokens.filter((token) => token.id === 'npc-1')).toHaveLength(1);
    }
    expect(dm.mapData.tokens.some((token) => token.characterLink?.mode === 'current_player')).toBe(false);
    for (const player of players) {
      expect(player.mapData.tokens.filter((token) => token.viewer === true)).toHaveLength(1);
      expect(playerToken(player, player.playerId)?.characterLink?.mode).toBe('current_player');
    }

    expect(shared.listenerCount()).toBe(54);
    sessions.forEach((session) => session.bridge.stop());
    expect(shared.listenerCount()).toBe(0);
  });

  test('8 simultaneous player drops produce exactly 8 writes and converge without cross-player overwrite', async () => {
    const { shared, players, sessions } = await startNine();
    const targets = Object.fromEntries(PLAYER_IDS.map((playerId, index) => [playerId, targetFor(index)]));

    players.forEach((player) => Object.assign(playerToken(player, player.playerId), targets[player.playerId]));
    const beforeWrites = shared.writes.length;
    await Promise.all(players.map((player) => player.bridge.saveToken(playerToken(player, player.playerId))));
    await flush();

    expect(shared.writes.length - beforeWrites).toBe(8);
    for (const observer of sessions) {
      for (const playerId of PLAYER_IDS) {
        const target = targets[playerId];
        expect(playerToken(observer, playerId)).toMatchObject({
          x: target.x,
          y: target.y,
          zLayer: target.zLayer,
          elevationFt: target.elevationFt,
          gridPosition: target.gridPosition,
        });
      }
      expect(new Set(playerKeys(observer)).size).toBe(8);
    }

    sessions.forEach((session) => session.bridge.stop());
  });

  test('player ownership remains isolated while DM can authoritatively move any player', async () => {
    const { dm, players, sessions } = await startNine();
    const p1 = players[0];
    await expect(p1.bridge.saveToken(playerToken(p1, 'P2'))).rejects.toThrow('PLAYER_TOKEN_OWNERSHIP_REQUIRED');

    const p8FromDm = playerToken(dm, 'P8');
    Object.assign(p8FromDm, { x: 1750, y: 1610, zLayer: 2, elevationFt: 30, gridPosition: { col: 25, row: 23, z: 2 } });
    await expect(dm.bridge.saveToken(p8FromDm)).resolves.toMatchObject({ valid: true, scope: 'player', key: 'P8' });
    await flush();

    for (const session of sessions) expect(playerToken(session, 'P8').x).toBe(1750);
    sessions.forEach((session) => session.bridge.stop());
  });

  test('P8 disconnect/reconnect restores the latest eight-player state without duplicate listeners or tokens', async () => {
    const { shared, players, sessions } = await startNine();
    const p8 = players[7];
    const listenersWithNine = shared.listenerCount();
    p8.bridge.stop();
    expect(shared.listenerCount()).toBe(listenersWithNine - 6);

    const movers = players.slice(0, 7);
    movers.forEach((player, index) => Object.assign(playerToken(player, player.playerId), targetFor(index + 1)));
    await Promise.all(movers.map((player) => player.bridge.saveToken(playerToken(player, player.playerId))));
    await flush();

    const reconnectedP8 = client(shared, { uid: uidFor('P8'), playerId: 'P8' });
    reconnectedP8.bridge.start();
    await flush();

    expect(shared.listenerCount()).toBe(listenersWithNine);
    expect(playerKeys(reconnectedP8)).toEqual(PLAYER_IDS);
    expect(new Set(playerKeys(reconnectedP8)).size).toBe(8);
    expect(reconnectedP8.mapData.tokens.filter((token) => token.viewer === true)).toHaveLength(1);
    for (const player of movers) {
      const expected = targetFor(PLAYER_IDS.indexOf(player.playerId) + 1);
      expect(playerToken(reconnectedP8, player.playerId)).toMatchObject({
        x: expected.x,
        y: expected.y,
        zLayer: expected.zLayer,
      });
    }

    sessions.filter((session) => session !== p8).forEach((session) => session.bridge.stop());
    reconnectedP8.bridge.stop();
    expect(shared.listenerCount()).toBe(0);
  });
});
