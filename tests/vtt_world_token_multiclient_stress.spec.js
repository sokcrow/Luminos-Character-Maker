const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const baseTokenState = require('../js/vtt/token-state.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const splitPath = (value = '') => String(value || '').split('/').filter(Boolean);

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
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    cursor[parts[index]] ||= {};
    cursor = cursor[parts[index]];
  }
  const last = parts.at(-1);
  if (value == null) delete cursor[last];
  else cursor[last] = clone(value);
}

class SharedRealtimeDb {
  constructor(initial = {}) {
    this.data = clone(initial);
    this.listeners = new Map();
    this.deliveries = [];
    this.writes = [];
  }

  listenerKey(pathValue, event) { return `${pathValue}|${event}`; }

  snapshot(pathValue, keyOverride, valueOverride) {
    const value = valueOverride === undefined ? clone(getAt(this.data, pathValue)) : clone(valueOverride);
    return {
      key: keyOverride ?? splitPath(pathValue).at(-1) ?? null,
      val: () => clone(value),
      exists: () => value != null,
      ref: this.ref(pathValue),
    };
  }

  deliver(pathValue, event, handler, snapshot) {
    const value = snapshot?.val?.();
    this.deliveries.push({
      path: pathValue,
      event,
      key: snapshot?.key ?? null,
      bytes: JSON.stringify(value ?? null).length,
    });
    handler(snapshot);
  }

  on(pathValue, event, handler) {
    const key = this.listenerKey(pathValue, event);
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(handler);
    if (event === 'value') {
      this.deliver(pathValue, event, handler, this.snapshot(pathValue));
    } else if (event === 'child_added') {
      const current = getAt(this.data, pathValue) || {};
      for (const childKey of Object.keys(current)) {
        this.deliver(pathValue, event, handler, this.snapshot(`${pathValue}/${childKey}`, childKey));
      }
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
        for (const handler of [...handlers]) this.deliver(listenerPath, event, handler, this.snapshot(listenerPath));
        continue;
      }
      if (!descendantChange || !['child_added', 'child_changed', 'child_removed'].includes(event)) continue;

      const rest = splitPath(changedPath).slice(splitPath(listenerPath).length);
      const childKey = rest[0];
      if (!childKey) continue;
      const childPath = `${listenerPath}/${childKey}`;
      const previous = getAt(before, childPath);
      const next = getAt(this.data, childPath);
      const changed = JSON.stringify(previous) !== JSON.stringify(next);
      const matches = event === 'child_added'
        ? previous == null && next != null
        : event === 'child_removed'
          ? previous != null && next == null
          : previous != null && next != null && changed;
      if (!matches) continue;
      const payload = event === 'child_removed' ? previous : next;
      const snapshot = this.snapshot(childPath, childKey, payload);
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
      await this.set(pathValue ? `${pathValue}/${key}` : key, value);
    }
  }

  listenerCount() {
    let total = 0;
    for (const handlers of this.listeners.values()) total += handlers.size;
    return total;
  }

  listenersAt(pathValue) {
    const result = {};
    for (const event of ['value', 'child_added', 'child_changed', 'child_removed']) {
      result[event] = this.listeners.get(this.listenerKey(pathValue, event))?.size || 0;
    }
    return result;
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
    id: 'player-template', x: 35, y: 35, draggable: true,
    characterLink: { mode: 'current_player' },
    zLayer: 0, elevationFt: 0, gridPosition: { col: 0, row: 0, z: 0 }, z: [0],
  };
}

function baseMap(id = 'alpha') {
  return { id, grid: { size: 70, cols: 40, rows: 40 }, tokens: [templateToken()] };
}

function rootFor(shared, { uid, playerId, actorId }) {
  const database = () => shared;
  database.ServerValue = { TIMESTAMP: 999 };
  return {
    document: {},
    datosJugador: { id: playerId, playerId, actorId },
    localStorage: { getItem: (key) => key === 'playerId' ? playerId : null },
    firebase: { auth: () => ({ currentUser: { uid } }), database },
  };
}

function initialDb(playerCount = 8) {
  const jugadores = {};
  for (let index = 1; index <= playerCount; index += 1) {
    jugadores[`P${index}`] = { uid: `uid-p${index}` };
  }
  return new SharedRealtimeDb({ campaña: { jugadores } });
}

function dynamicTokens(session) {
  return (session.mapData.tokens || []).filter((token) => token.dynamicActorToken && token.canonicalScope === 'world');
}

function worldToken(session, id) {
  return (session.mapData.tokens || []).find((token) => token.id === id);
}

function npc(index) {
  const id = `npc-${String(index).padStart(3, '0')}`;
  return {
    id,
    name: `NPC ${index}`,
    actorId: `actor-npc-${index}`,
    icono: `npc-${index}.webp`,
    x: (index % 20) * 70,
    y: Math.floor(index / 20) * 70,
    zLayer: index % 3,
    elevationFt: (index % 3) * 15,
    gridPosition: { col: index % 20, row: Math.floor(index / 20), z: index % 3 },
    z: [index % 3],
    draggable: true,
  };
}

const flush = async () => { for (let index = 0; index < 8; index += 1) await Promise.resolve(); };

let tokenState;
let previousGlobalTokenState;

test.beforeAll(() => {
  previousGlobalTokenState = global.LuminousVttTokenState;
  global.LuminousVttTokenState = baseTokenState;
  delete require.cache[require.resolve('../js/vtt/token-state-dynamic-patch.js')];
  require('../js/vtt/token-state-dynamic-patch.js');
  tokenState = global.LuminousVttTokenState;
});

test.afterAll(() => {
  global.LuminousVttTokenState = previousGlobalTokenState;
});

function client(shared, { uid, playerId, isDm = false }) {
  const mapData = baseMap();
  const bridge = tokenState.createBridge({
    mapData,
    isDm,
    root: rootFor(shared, { uid, playerId, actorId: `actor-${playerId}` }),
  });
  return { uid, playerId, isDm, mapData, bridge };
}

async function startNine() {
  const shared = initialDb(8);
  const sessions = [client(shared, { uid: tokenState.DM_UID, playerId: 'dm', isDm: true })];
  for (let index = 1; index <= 8; index += 1) {
    sessions.push(client(shared, { uid: `uid-p${index}`, playerId: `P${index}` }));
  }
  sessions.forEach((session) => session.bridge.start());
  await flush();
  return { shared, sessions, dm: sessions[0], players: sessions.slice(1) };
}

async function spawnRange(dm, start, end) {
  for (let index = start; index <= end; index += 1) {
    const result = await dm.bridge.createWorldToken(npc(index));
    expect(result).toMatchObject({ valid: true, scope: 'world' });
  }
  await flush();
}

test.describe('VTT world token multiclient stress', () => {
  test('live world sync has no whole-map value listener', async () => {
    const { shared, sessions } = await startNine();
    const worldPath = `${tokenState.WORLD_ROOT}/alpha`;
    const listeners = shared.listenersAt(worldPath);
    expect(listeners.value).toBe(0);
    expect(listeners.child_added).toBe(9);
    expect(listeners.child_changed).toBe(18);
    expect(listeners.child_removed).toBe(9);

    const baseSource = read('js/vtt/token-state.js');
    const dynamicSource = read('js/vtt/token-state-dynamic-patch.js');
    expect(baseSource).not.toContain("subscribe(worldRef(), 'value'");
    expect(baseSource).not.toContain("subscribe(worldRef(), 'child_added'");
    expect(baseSource).toContain("worldRef().once('value')");
    expect(baseSource).toContain("subscribe(worldRef(), 'child_changed'");
    expect(dynamicSource).not.toContain("db.ref(worldPath).on('value'");
    expect(dynamicSource).toContain("listen('child_added'");
    expect(dynamicSource).toContain("listen('child_changed'");
    expect(dynamicSource).toContain("listen('child_removed'");
    expect(dynamicSource).not.toContain('setInterval(');
    expect(dynamicSource).not.toContain('requestAnimationFrame(');
    sessions.forEach((session) => session.bridge.stop());
    expect(shared.listenerCount()).toBe(0);
  });

  test('DM + 8 players converge on 100 NPCs with unique canonical world tokens', async () => {
    const { sessions, dm } = await startNine();
    await spawnRange(dm, 1, 100);
    for (const session of sessions) {
      expect(dynamicTokens(session)).toHaveLength(100);
      expect(new Set(dynamicTokens(session).map((token) => token.id)).size).toBe(100);
      expect(worldToken(session, 'npc-100')).toMatchObject({ actorId: 'actor-npc-100', dynamicActorToken: true });
    }
    sessions.forEach((session) => session.bridge.stop());
  });

  test('one NPC move costs the same at 20 NPCs and 100 NPCs', async () => {
    const { shared, sessions, dm } = await startNine();
    const worldPath = `${tokenState.WORLD_ROOT}/alpha`;
    await spawnRange(dm, 1, 20);

    let token = worldToken(dm, 'npc-010');
    Object.assign(token, { x: 1400, y: 1470, zLayer: 2, elevationFt: 30, gridPosition: { col: 20, row: 21, z: 2 }, z: [2] });
    let before = shared.deliveries.length;
    await dm.bridge.saveToken(token);
    await flush();
    const atTwenty = shared.deliveries.slice(before).filter((delivery) => delivery.path === worldPath);
    expect(atTwenty).toHaveLength(18);
    expect(new Set(atTwenty.map((delivery) => delivery.key))).toEqual(new Set(['npc-010']));

    await spawnRange(dm, 21, 100);
    token = worldToken(dm, 'npc-090');
    Object.assign(token, { x: 2100, y: 2170, zLayer: 1, elevationFt: 15, gridPosition: { col: 30, row: 31, z: 1 }, z: [1] });
    before = shared.deliveries.length;
    await dm.bridge.saveToken(token);
    await flush();
    const atHundred = shared.deliveries.slice(before).filter((delivery) => delivery.path === worldPath);
    expect(atHundred).toHaveLength(atTwenty.length);
    expect(new Set(atHundred.map((delivery) => delivery.key))).toEqual(new Set(['npc-090']));
    expect(Math.max(...atHundred.map((delivery) => delivery.bytes))).toBeLessThan(2000);

    for (const session of sessions) {
      expect(worldToken(session, 'npc-010')).toMatchObject({ x: 1400, y: 1470, zLayer: 2, elevationFt: 30 });
      expect(worldToken(session, 'npc-090')).toMatchObject({ x: 2100, y: 2170, zLayer: 1, elevationFt: 15 });
    }
    sessions.forEach((session) => session.bridge.stop());
  });

  test('spawn/despawn and reconnect preserve 80 NPCs without duplicates or leaked listeners', async () => {
    const { shared, sessions, dm, players } = await startNine();
    await spawnRange(dm, 1, 100);
    const baselineListeners = shared.listenerCount();

    for (let index = 1; index <= 20; index += 1) await dm.bridge.deleteWorldToken(`npc-${String(index).padStart(3, '0')}`);
    await flush();
    for (const session of sessions) {
      expect(dynamicTokens(session)).toHaveLength(80);
      expect(worldToken(session, 'npc-001')).toBeUndefined();
    }

    const disconnected = players[3];
    disconnected.bridge.stop();
    expect(shared.listenerCount()).toBeLessThan(baselineListeners);
    const reconnected = client(shared, { uid: disconnected.uid, playerId: disconnected.playerId });
    reconnected.bridge.start();
    await flush();
    expect(shared.listenerCount()).toBe(baselineListeners);
    expect(dynamicTokens(reconnected)).toHaveLength(80);
    expect(new Set(dynamicTokens(reconnected).map((token) => token.id)).size).toBe(80);

    sessions.filter((session) => session !== disconnected).forEach((session) => session.bridge.stop());
    reconnected.bridge.stop();
    expect(shared.listenerCount()).toBe(0);
  });

  test('players cannot spawn, move or delete world NPCs and player Actors cannot be duplicated as NPCs', async () => {
    const { sessions, dm, players } = await startNine();
    const p1 = players[0];
    await expect(p1.bridge.createWorldToken(npc(1))).rejects.toThrow('DM_REQUIRED');
    await expect(p1.bridge.deleteWorldToken('npc-001')).rejects.toThrow('DM_REQUIRED');

    const duplicate = npc(200);
    duplicate.actorId = 'actor-P1';
    await expect(dm.bridge.createWorldToken(duplicate)).resolves.toEqual({ valid: false, reason: 'PLAYER_ACTOR_ALREADY_PRESENT' });

    await dm.bridge.createWorldToken(npc(201));
    await flush();
    const remoteNpc = worldToken(p1, 'npc-201');
    remoteNpc.x = 9999;
    await expect(p1.bridge.saveToken(remoteNpc)).rejects.toThrow('DM_REQUIRED');
    sessions.forEach((session) => session.bridge.stop());
  });
});
