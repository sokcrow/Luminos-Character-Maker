const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const movementRealtime = require('../js/vtt/movement-realtime.js');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const splitPath = (value = '') => String(value || '').split('/').filter(Boolean);

function getAt(root, pathValue) {
  let cursor = root;
  for (const key of splitPath(pathValue)) {
    if (cursor == null || typeof cursor !== 'object') return null;
    cursor = cursor[key];
  }
  return cursor == null ? null : clone(cursor);
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
  constructor() {
    this.data = {};
    this.listeners = new Map();
    this.writes = [];
  }

  listenerKey(pathValue, event) { return `${pathValue}|${event}`; }

  snapshot(pathValue, keyOverride, valueOverride) {
    const value = valueOverride === undefined ? getAt(this.data, pathValue) : clone(valueOverride);
    return {
      key: keyOverride ?? splitPath(pathValue).at(-1) ?? null,
      val: () => clone(value),
      exists: () => value != null,
    };
  }

  on(pathValue, event, handler) {
    const key = this.listenerKey(pathValue, event);
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(handler);
    if (event === 'value') handler(this.snapshot(pathValue));
    if (event === 'child_added') {
      const current = getAt(this.data, pathValue) || {};
      for (const [childKey, value] of Object.entries(current)) {
        handler(this.snapshot(`${pathValue}/${childKey}`, childKey, value));
      }
    }
  }

  off(pathValue, event, handler) {
    this.listeners.get(this.listenerKey(pathValue, event))?.delete(handler);
  }

  emit(pathValue, before) {
    const parentPath = splitPath(pathValue).slice(0, -1).join('/');
    const childKey = splitPath(pathValue).at(-1);
    const after = getAt(this.data, pathValue);
    for (const [listenerKey, handlers] of this.listeners.entries()) {
      const separator = listenerKey.lastIndexOf('|');
      const listenerPath = listenerKey.slice(0, separator);
      const event = listenerKey.slice(separator + 1);
      if (event === 'value' && listenerPath === pathValue) {
        for (const handler of [...handlers]) handler(this.snapshot(pathValue));
        continue;
      }
      if (listenerPath !== parentPath) continue;
      const added = event === 'child_added' && before == null && after != null;
      const changed = event === 'child_changed' && before != null && after != null;
      const removed = event === 'child_removed' && before != null && after == null;
      if (!added && !changed && !removed) continue;
      const payload = removed ? before : after;
      for (const handler of [...handlers]) handler(this.snapshot(pathValue, childKey, payload));
    }
  }

  async set(pathValue, value) {
    const before = getAt(this.data, pathValue);
    setAt(this.data, pathValue, value);
    this.writes.push({ path: pathValue, value: clone(value) });
    this.emit(pathValue, before);
  }

  ref(pathValue = '') {
    const db = this;
    const normalized = String(pathValue || '').replace(/^\/+|\/+$/g, '');
    return {
      child(childKey) { return db.ref(normalized ? `${normalized}/${childKey}` : childKey); },
      on(event, handler) { db.on(normalized, event, handler); },
      off(event, handler) { db.off(normalized, event, handler); },
      set(value) { return db.set(normalized, value); },
    };
  }
}

class FakeCanvas {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, handler) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(handler);
  }
  removeEventListener(name, handler) { this.listeners.get(name)?.delete(handler); }
  dispatchEvent(event) {
    for (const handler of [...(this.listeners.get(event.type) || [])]) handler(event);
    return true;
  }
}

class FakeCustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail || {}; }
}

function hostFor(db, uid, playerId) {
  const database = () => db;
  database.ServerValue = { TIMESTAMP: 777 };
  return {
    CustomEvent: FakeCustomEvent,
    datosJugador: { playerId },
    localStorage: { getItem: () => playerId },
    firebase: { auth: () => ({ currentUser: { uid } }), database },
  };
}

function fakeClock() {
  let current = 0;
  let nextId = 0;
  let timers = [];
  return {
    now: () => current,
    setTimeoutFn(fn, ms) {
      const timer = { id: ++nextId, at: current + ms, fn };
      timers.push(timer);
      return timer.id;
    },
    clearTimeoutFn(id) { timers = timers.filter((timer) => timer.id !== id); },
    async advance(ms) {
      current += ms;
      const due = timers.filter((timer) => timer.at <= current);
      timers = timers.filter((timer) => timer.at > current);
      for (const timer of due) timer.fn();
      for (let index = 0; index < 8; index += 1) await Promise.resolve();
    },
  };
}

function playerToken(id, playerId, patch = {}) {
  return {
    id,
    canonicalScope: 'player',
    canonicalPlayerKey: playerId,
    playerId,
    x: 0,
    y: 0,
    zLayer: 0,
    z: [0],
    elevationFt: 0,
    gridPosition: { col: 0, row: 0, z: 0 },
    ...patch,
  };
}

function worldToken(id, patch = {}) {
  return {
    id,
    canonicalScope: 'world',
    x: 0,
    y: 0,
    zLayer: 0,
    z: [0],
    elevationFt: 0,
    gridPosition: { col: 0, row: 0, z: 0 },
    ...patch,
  };
}

const flush = async () => { for (let index = 0; index < 8; index += 1) await Promise.resolve(); };

function controller({ db, mapData, canvas, uid, playerId, isDm, clock, sessionId, tokenDrag = null }) {
  const engine = { mapData, canvas, tokenDrag };
  return movementRealtime.createController({
    mapData,
    canvas,
    engine,
    isDm,
    root: hostFor(db, uid, playerId),
    sessionId,
    throttleMs: 90,
    previewTtlMs: 1800,
    now: clock.now,
    setTimeoutFn: clock.setTimeoutFn,
    clearTimeoutFn: clock.clearTimeoutFn,
  });
}

test('player drag streams to DM at <= ~12 Hz and final canonical commit clears preview safely', async () => {
  const db = new SharedRealtimeDb();
  const clock = fakeClock();
  const playerCanvas = new FakeCanvas();
  const dmCanvas = new FakeCanvas();
  const own = playerToken('player-template', 'alice', { viewer: true, characterLink: { mode: 'current_player' } });
  const observed = playerToken('player:alice', 'alice');
  const playerMap = { id: 'alpha', tokens: [own] };
  const dmMap = { id: 'alpha', tokens: [observed] };
  const player = controller({ db, mapData: playerMap, canvas: playerCanvas, uid: 'uid-a', playerId: 'alice', isDm: false, clock, sessionId: 'player-session', tokenDrag: { token: own } });
  const dm = controller({ db, mapData: dmMap, canvas: dmCanvas, uid: 'dm-uid', playerId: 'dm', isDm: true, clock, sessionId: 'dm-session' });
  player.start();
  dm.start();

  for (let x = 1; x <= 120; x += 1) {
    own.x = x;
    playerCanvas.dispatchEvent(new FakeCustomEvent('vtt:token-preview-moved', { detail: { tokenId: own.id, x, y: 0 } }));
  }
  await flush();
  expect(db.writes).toHaveLength(1);
  expect(observed.x).toBe(1);

  await clock.advance(90);
  expect(db.writes).toHaveLength(2);
  expect(observed.x).toBe(120);
  expect(player.snapshot().throttleMs).toBe(90);

  const canonicalSave = async () => {
    observed.x = own.x;
    dmCanvas.dispatchEvent(new FakeCustomEvent('vtt:canonical-tokens-synced', { detail: { scope: 'players' } }));
    return { valid: true, scope: 'player', key: 'alice' };
  };
  await expect(player.finalizeToken(own, canonicalSave)).resolves.toMatchObject({ valid: true, scope: 'player' });
  await flush();

  expect(getAt(db.data, 'campaña/jugadores/alice/vttMovementPreview/alpha')).toBeNull();
  expect(observed.x).toBe(120);
  expect(db.writes).toHaveLength(5);
  player.stop();
  dm.stop();
});

test('DM can stream world-token movement while players cannot publish world-token previews', async () => {
  const db = new SharedRealtimeDb();
  const clock = fakeClock();
  const dmCanvas = new FakeCanvas();
  const playerCanvas = new FakeCanvas();
  const dmNpc = worldToken('npc-1');
  const playerNpc = worldToken('npc-1');
  const dmMap = { id: 'alpha', tokens: [dmNpc] };
  const playerMap = { id: 'alpha', tokens: [playerNpc] };
  const dm = controller({ db, mapData: dmMap, canvas: dmCanvas, uid: 'dm-uid', playerId: 'dm', isDm: true, clock, sessionId: 'dm-session', tokenDrag: { token: dmNpc } });
  const player = controller({ db, mapData: playerMap, canvas: playerCanvas, uid: 'uid-a', playerId: 'alice', isDm: false, clock, sessionId: 'player-session' });
  dm.start();
  player.start();

  dmNpc.x = 350;
  dmCanvas.dispatchEvent(new FakeCustomEvent('vtt:token-preview-moved', { detail: { tokenId: 'npc-1', x: 350, y: 0 } }));
  await flush();
  expect(playerNpc.x).toBe(350);
  expect(db.writes[0].path).toBe('campaña/estado_mundo/vttMovementPreview/alpha/npc-1');

  playerNpc.x = 700;
  playerCanvas.dispatchEvent(new FakeCustomEvent('vtt:token-preview-moved', { detail: { tokenId: 'npc-1', x: 700, y: 0 } }));
  await flush();
  expect(db.writes).toHaveLength(1);
  expect(player.previewRefForToken(playerNpc)).toBeNull();
  dm.stop();
  player.stop();
});

test('abandoned previews expire back to canonical position without polling', async () => {
  const db = new SharedRealtimeDb();
  const clock = fakeClock();
  const dmCanvas = new FakeCanvas();
  const observed = playerToken('player:alice', 'alice', { x: 35, y: 35 });
  const dmMap = { id: 'alpha', tokens: [observed] };
  const dm = controller({ db, mapData: dmMap, canvas: dmCanvas, uid: 'dm-uid', playerId: 'dm', isDm: true, clock, sessionId: 'dm-session' });
  dm.start();

  await db.set('campaña/jugadores/alice/vttMovementPreview/alpha', {
    schemaVersion: 1,
    scope: 'player',
    tokenId: 'player-template',
    playerKey: 'alice',
    x: 420,
    y: 350,
    zLayer: 0,
    elevationFt: 0,
    sequence: 1,
    committed: false,
    sessionId: 'other-session',
    sentAtMs: 0,
    expiresAtMs: 1800,
  });
  expect(observed.x).toBe(420);
  await clock.advance(1800);
  expect(observed.x).toBe(35);
  expect(observed.y).toBe(35);
  dm.stop();
});

test('realtime movement stays event-driven, isolated from canonical records, and is wired into main lifecycle', () => {
  const source = read('js/vtt/movement-realtime.js');
  const main = read('js/vtt/main.js');
  expect(source).toContain("const DEFAULT_THROTTLE_MS = 90");
  expect(source).toContain("vttMovementPreview");
  expect(source).toContain("vtt:token-preview-moved");
  expect(source).toContain("vtt:canonical-tokens-synced");
  expect(source).not.toContain('setInterval(');
  expect(source).not.toContain('requestAnimationFrame(');
  expect(main).toContain("import './movement-realtime.js'");
  expect(main).toContain('movementRealtime?.start?.()');
  expect(main).toContain('movementRealtime?.finalizeToken');
  expect(main).toContain('movementRealtime?.stop?.()');
});