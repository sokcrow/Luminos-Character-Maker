import assert from "node:assert/strict";

globalThis.window = globalThis;
globalThis.document = undefined;
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => true;
if (typeof globalThis.CustomEvent !== "function") {
  globalThis.CustomEvent = class CustomEvent {
    constructor(type, init = {}) {
      this.type = type;
      this.detail = init.detail;
    }
  };
}

const fakeDb = { ref() { return {}; } };
const fakeAuth = { onAuthStateChanged() {} };
globalThis.firebase = {
  apps: [{}],
  initializeApp() {},
  auth() { return fakeAuth; },
  database() { return fakeDb; },
};

let hydrated = null;
globalThis.LuminousCombat073 = {
  hydrate(payload) { hydrated = payload; },
  camera() {},
  reset() {},
};

await import("../js/combat-v073-live-adapter.js");

const adapter = globalThis.LuminousCombatLiveAdapter073;
assert.ok(adapter, "Combat Live Adapter must initialize");

Object.assign(adapter.state, {
  runtimeReady: true,
  firebaseReady: true,
  uid: "dm-test-uid",
  dmUid: "dm-test-uid",
  role: "dm",
  playerId: null,
  combatState: "PLANNING",
  round: 1,
  lastSignature: "",
  players: {
    p1: {
      uid: "player-test-uid",
      inventario_activo: {
        live_patch: {
          instanceId: "live_patch",
          definitionId: "hp_generic_pocket_recovery_patch",
          name: "Live Patch",
          category: "consumable",
          quantity: 3,
        },
      },
    },
  },
  combatants: {
    "player:p1": {
      id: "player:p1",
      isPlayer: true,
      canonicalScope: "player",
      canonicalPlayerKey: "p1",
      canonicalOwnerUid: "player-test-uid",
      battleActive: true,
      inventario_activo: {
        stale_patch: {
          instanceId: "stale_patch",
          definitionId: "hp_generic_old_snapshot",
          name: "Stale Combat Copy",
          category: "consumable",
          quantity: 99,
        },
      },
    },
    enemy_1: {
      id: "enemy_1",
      actorCategory: "enemy",
      faction: "enemy",
      battleActive: true,
      inventario_activo: {
        enemy_item: {
          instanceId: "enemy_item",
          definitionId: "enemy_item",
          category: "consumable",
          quantity: 2,
        },
      },
    },
  },
});

assert.equal(adapter.hydrateNow(), true);
assert.ok(hydrated, "Combat Master must receive a hydration payload");

const player = hydrated.combatants.find((unit) => unit.id === "player:p1");
assert.ok(player, "deployed Player must exist in Combat hydration");
assert.deepEqual(
  Object.keys(player.inventario_activo || {}),
  ["live_patch"],
  "Combat Player inventory must come from campaña/jugadores active inventory, not the deployed combatant snapshot",
);
assert.equal(player.inventario_activo.live_patch.quantity, 3);
assert.equal(player.inventario_activo.stale_patch, undefined);

assert.deepEqual(
  hydrated.kits["player:p1"].items.map((item) => item.instanceId),
  ["live_patch"],
  "Combat Item menu kit must use the authoritative Player Active Inventory",
);
assert.deepEqual(
  hydrated.kits.enemy_1.items.map((item) => item.instanceId),
  ["enemy_item"],
  "non-Player combatants must keep their own inventory authority",
);

const directRows = adapter.activeInventoryItems(adapter.state.combatants["player:p1"]);
assert.deepEqual(
  directRows.map((item) => item.instanceId),
  ["live_patch"],
  "raw Player combatant reads must also resolve through Player Active Inventory authority",
);

const beforeSignature = JSON.stringify(adapter.inventoryHydrationSignature(adapter.state.combatants["player:p1"]));
adapter.state.players.p1.inventario_activo.live_patch.quantity = 1;
const afterSignature = JSON.stringify(adapter.inventoryHydrationSignature(adapter.state.combatants["player:p1"]));
assert.notEqual(
  beforeSignature,
  afterSignature,
  "Player Active Inventory quantity changes must invalidate Combat hydration",
);

hydrated = null;
assert.equal(adapter.hydrateNow(), true);
assert.ok(hydrated, "changed Player Active Inventory must trigger a new Combat hydration");
assert.equal(
  hydrated.combatants.find((unit) => unit.id === "player:p1").inventario_activo.live_patch.quantity,
  1,
  "Combat must receive the updated live quantity",
);

adapter.state.players.p1.inventario_activo = {};
hydrated = null;
assert.equal(adapter.hydrateNow(), true);
assert.ok(hydrated);
assert.deepEqual(
  Object.keys(hydrated.combatants.find((unit) => unit.id === "player:p1").inventario_activo || {}),
  [],
  "an empty Player Active Inventory must stay empty instead of reviving stale combatant Items",
);
assert.deepEqual(
  hydrated.kits["player:p1"].items,
  [],
  "Combat Item menu must empty when the Player Active Inventory is empty",
);

delete adapter.state.players.p1;
assert.deepEqual(
  adapter.activeInventoryItems(adapter.state.combatants["player:p1"]).map((item) => item.instanceId),
  ["stale_patch"],
  "legacy fallback may use the combatant snapshot only when the canonical Player record is unavailable",
);

console.log("combat Player Active Inventory authority smoke: ok");
