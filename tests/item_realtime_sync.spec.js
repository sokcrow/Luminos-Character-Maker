const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

global.LuminousItemRuntime = require("../js/item-runtime-engine.js");
global.LuminousItemInventoryRuntime = require("../js/item-inventory-runtime.js");
global.LuminousItemPersistenceRuntime = require("../js/item-persistence-runtime.js");
const realtime = require("../js/item-realtime-sync.js");
const inventory = global.LuminousItemInventoryRuntime;

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function parts(pathValue) {
  return String(pathValue || "").split("/").filter(Boolean);
}

function readAt(root, pathValue) {
  let current = root;
  for (const key of parts(pathValue)) {
    if (current == null || typeof current !== "object") return null;
    current = current[key];
  }
  return current === undefined ? null : clone(current);
}

function writeAt(root, pathValue, value) {
  const keys = parts(pathValue);
  if (!keys.length) throw new Error("root writes are not supported by this fake");
  let current = root;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!current[key] || typeof current[key] !== "object") current[key] = {};
    current = current[key];
  }
  const finalKey = keys[keys.length - 1];
  if (value === null || value === undefined) delete current[finalKey];
  else current[finalKey] = clone(value);
}

function snapshot(value) {
  const stored = clone(value);
  return {
    val() { return clone(stored); },
    exists() { return stored !== null && stored !== undefined; },
    forEach(callback) {
      if (!stored || typeof stored !== "object") return false;
      for (const [key, childValue] of Object.entries(stored)) {
        const child = { key, val: () => clone(childValue) };
        if (callback(child) === true) return true;
      }
      return false;
    },
  };
}

class FakeRealtimeDatabase {
  constructor(initial = {}) {
    this.data = clone(initial);
    this.listeners = new Map();
    this.pushCounter = 0;
  }

  ref(pathValue) {
    const db = this;
    const refPath = String(pathValue || "").replace(/^\/+|\/+$/g, "");
    return {
      key: parts(refPath).at(-1) || null,
      once(event, callback) {
        if (event !== "value") throw new Error(`Unsupported once event: ${event}`);
        const snap = snapshot(readAt(db.data, refPath));
        if (typeof callback === "function") callback(snap);
        return Promise.resolve(snap);
      },
      on(event, callback) {
        if (event !== "value") throw new Error(`Unsupported on event: ${event}`);
        if (!db.listeners.has(refPath)) db.listeners.set(refPath, new Set());
        db.listeners.get(refPath).add(callback);
        callback(snapshot(readAt(db.data, refPath)));
        return callback;
      },
      off(event, callback) {
        if (event !== "value") return;
        const set = db.listeners.get(refPath);
        if (!set) return;
        if (callback) set.delete(callback);
        else set.clear();
      },
      async set(value) {
        writeAt(db.data, refPath, value);
        db.notify([refPath]);
      },
      async update(updates = {}) {
        const changed = [];
        for (const [relative, value] of Object.entries(updates)) {
          const childPath = relative ? `${refPath}/${relative}` : refPath;
          writeAt(db.data, childPath, value);
          changed.push(childPath);
        }
        db.notify(changed);
      },
      async remove() {
        writeAt(db.data, refPath, null);
        db.notify([refPath]);
      },
      push(value) {
        db.pushCounter += 1;
        const key = `push_${db.pushCounter}`;
        const childPath = `${refPath}/${key}`;
        const childRef = db.ref(childPath);
        if (arguments.length) childRef.set(value);
        return { ...childRef, key };
      },
    };
  }

  notify(changedPaths) {
    const callbacks = [];
    for (const [listenerPath, handlers] of this.listeners.entries()) {
      const affected = changedPaths.some((changedPath) =>
        changedPath === listenerPath ||
        changedPath.startsWith(`${listenerPath}/`) ||
        listenerPath.startsWith(`${changedPath}/`),
      );
      if (!affected) continue;
      for (const handler of handlers) callbacks.push([listenerPath, handler]);
    }
    for (const [listenerPath, handler] of callbacks) {
      handler(snapshot(readAt(this.data, listenerPath)));
    }
  }
}

async function settle() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function makeItem(id, name = id) {
  return inventory.createItemInstance({ id, name, category: "tool" }, {
    instanceId: `${id}:instance`,
    quantity: 1,
  });
}

function createPeers() {
  const db = new FakeRealtimeDatabase({
    campaña: {
      jugadores: { Alice: { inventario_activo: {}, inventario_stash: {} } },
      ajustes_globales: { alijo_desbloqueado: false },
    },
  });
  const playerUnit = { inventario_activo: {}, inventario_stash: {} };
  const dmUnit = { inventario_activo: {}, inventario_stash: {} };
  const playerEvents = [];
  const dmEvents = [];
  const playerAccess = [];
  const dmAccess = [];
  const player = realtime.bindPlayerInventory({
    db, playerId: "Alice", unit: playerUnit,
    onInventory: (event) => playerEvents.push(event),
    onStashAccess: (event) => playerAccess.push(event.unlocked),
  });
  const dm = realtime.bindDmInventory({
    db, playerId: "Alice", unit: dmUnit,
    onInventory: (event) => dmEvents.push(event),
    onStashAccess: (event) => dmAccess.push(event.unlocked),
  });
  return { db, player, dm, playerUnit, dmUnit, playerEvents, dmEvents, playerAccess, dmAccess };
}

test("player and DM bind to the exact same Firebase inventory paths", () => {
  const { player, dm } = createPeers();
  expect(player.bound).toBe(true);
  expect(dm.bound).toBe(true);
  expect(player.paths.active).toBe("campaña/jugadores/Alice/inventario_activo");
  expect(player.paths.stash).toBe("campaña/jugadores/Alice/inventario_stash");
  expect(dm.paths).toEqual(player.paths);
  player.dispose();
  dm.dispose();
});

test("Player -> DM: saving active inventory reaches the DM without reload", async () => {
  const peers = createPeers();
  await settle();
  const item = makeItem("item:player_medkit", "Medkit");
  peers.playerUnit.inventario_activo[item.instanceId] = item;

  const saved = await peers.player.save();
  expect(saved.saved).toBe(true);
  await settle();

  expect(peers.dmUnit.inventario_activo[item.instanceId]).toBeTruthy();
  expect(peers.dmUnit.inventario_activo[item.instanceId].definitionId).toBe("item:player_medkit");
  expect(peers.dmEvents.at(-1).source).toBe("firebase");
  peers.player.dispose();
  peers.dm.dispose();
});

test("DM -> Player: saving stash reaches the player without reload", async () => {
  const peers = createPeers();
  await settle();
  const item = makeItem("item:dm_reward", "Reward");
  peers.dmUnit.inventario_stash[item.instanceId] = item;

  const saved = await peers.dm.save();
  expect(saved.saved).toBe(true);
  await settle();

  expect(peers.playerUnit.inventario_stash[item.instanceId]).toBeTruthy();
  expect(peers.playerUnit.inventario_stash[item.instanceId].definitionId).toBe("item:dm_reward");
  expect(peers.playerEvents.at(-1).source).toBe("firebase");
  peers.player.dispose();
  peers.dm.dispose();
});

test("Active -> Stash move persists once and converges on both peers", async () => {
  const peers = createPeers();
  await settle();
  const item = makeItem("item:scythe", "Scythe");
  peers.playerUnit.inventario_activo[item.instanceId] = item;
  await peers.player.save();
  await settle();

  const moved = await peers.player.move(item.instanceId, "to_stash");
  expect(moved.moved).toBe(true);
  expect(moved.saved).toBe(true);
  await settle();

  expect(peers.playerUnit.inventario_activo[item.instanceId]).toBeFalsy();
  expect(peers.dmUnit.inventario_activo[item.instanceId]).toBeFalsy();
  expect(peers.playerUnit.inventario_stash[item.instanceId]).toBeTruthy();
  expect(peers.dmUnit.inventario_stash[item.instanceId]).toBeTruthy();
  peers.player.dispose();
  peers.dm.dispose();
});

test("DM stash unlock propagates to the player in realtime", async () => {
  const peers = createPeers();
  await settle();
  expect(peers.player.stashUnlocked).toBe(false);
  expect(peers.dm.stashUnlocked).toBe(false);

  const result = await peers.dm.setStashUnlocked(true);
  expect(result.saved).toBe(true);
  await settle();

  expect(peers.player.stashUnlocked).toBe(true);
  expect(peers.playerUnit.stashUnlocked).toBe(true);
  expect(peers.playerAccess.at(-1)).toBe(true);
  expect(peers.dmAccess.at(-1)).toBe(true);
  peers.player.dispose();
  peers.dm.dispose();
});

test("player role cannot change global stash access by default", async () => {
  const peers = createPeers();
  await settle();
  const result = await peers.player.setStashUnlocked(true);
  expect(result.saved).toBe(false);
  expect(result.reason).toBe("dm_role_required");
  expect(peers.player.stashUnlocked).toBe(false);
  peers.player.dispose();
  peers.dm.dispose();
});

test("disposed peers stop receiving realtime inventory updates", async () => {
  const peers = createPeers();
  await settle();
  const before = peers.dm.revision;
  peers.dm.dispose();

  const item = makeItem("item:after_dispose", "After Dispose");
  peers.playerUnit.inventario_activo[item.instanceId] = item;
  await peers.player.save();
  await settle();

  expect(peers.dm.revision).toBe(before);
  expect(peers.dmUnit.inventario_activo[item.instanceId]).toBeFalsy();
  peers.player.dispose();
});

test("existing Player and DM UIs already target the same active/stash realtime contract", () => {
  const root = path.resolve(__dirname, "..");
  const playerSource = fs.readFileSync(path.join(root, "hoja_personaje.js"), "utf8");
  const dmSource = fs.readFileSync(path.join(root, "pantalla_dm.html"), "utf8");

  expect(playerSource).toContain("inventario_activo");
  expect(playerSource).toContain("inventario_stash");
  expect(playerSource).toMatch(/inventario_activo[\s\S]{0,300}\.on\([\s\n]*["']value["']/);
  expect(playerSource).toMatch(/inventario_stash[\s\S]{0,300}\.on\([\s\n]*["']value["']/);
  expect(dmSource).toContain("inventario_activo");
  expect(dmSource).toContain("inventario_stash");
  expect(dmSource).toMatch(/inventario_activo[\s\S]{0,300}\.on\([\s\n]*["']value["']/);
  expect(dmSource).toMatch(/inventario_stash[\s\S]{0,300}\.on\([\s\n]*["']value["']/);
});
