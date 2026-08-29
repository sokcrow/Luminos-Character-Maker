const { test, expect } = require("@playwright/test");

global.LuminousItemRuntime = require("../js/item-runtime-engine.js");
global.LuminousItemInventoryRuntime = require("../js/item-inventory-runtime.js");
global.LuminousWorkshopRuntime = require("../js/workshop-runtime.js");
const persistence = require("../js/item-persistence-runtime.js");

function makeDb(initial = {}) {
  const data = JSON.parse(JSON.stringify(initial));
  const listeners = new Map();
  const parts = (path) => String(path).split("/").filter(Boolean);
  const get = (path) => parts(path).reduce((node, key) => node && node[key], data);
  const set = (path, value) => {
    const keys = parts(path);
    let node = data;
    keys.slice(0, -1).forEach((key) => { if (!node[key] || typeof node[key] !== "object") node[key] = {}; node = node[key]; });
    node[keys[keys.length - 1]] = JSON.parse(JSON.stringify(value));
    const handler = listeners.get(path);
    if (handler) handler({ val: () => get(path) });
  };
  return {
    data,
    ref(path) {
      return {
        once: async () => ({ val: () => get(path) }),
        set: async (value) => set(path, value),
        update: async (updates) => {
          Object.entries(updates).forEach(([key, value]) => set(`${path}/${key}`, value));
        },
        on: (_event, handler) => { listeners.set(path, handler); handler({ val: () => get(path) }); },
        off: (_event, handler) => { if (listeners.get(path) === handler) listeners.delete(path); },
      };
    },
  };
}

test("loads legacy Firebase active/stash paths into canonical ItemInstances", async () => {
  const db = makeDb({
    campaña: { jugadores: { player_1: {
      inventario_activo: { legacy_scythe: { id: "item:scythe", nombre: "Scythe", cantidad: 1, tier: 4, limite_activo: 2 } },
      inventario_stash: { legacy_ration: { id: "item:ration", nombre: "Ration", cantidad: 6, limite_alijo: 99 } },
    } } },
  });
  const loaded = await persistence.loadPlayerInventory(db, "player_1");
  expect(loaded.loaded).toBe(true);
  expect(loaded.migrated).toBe(true);
  const active = Object.values(loaded.state.inventario_activo)[0];
  const stash = Object.values(loaded.state.inventario_stash)[0];
  expect(active.schemaVersion).toBe(2);
  expect(active.definitionId).toBe("item:scythe");
  expect(active.nombre).toBe("Scythe");
  expect(stash.quantity).toBe(6);
});

test("save updates inventory branches without replacing unrelated player data", async () => {
  const db = makeDb({ campaña: { jugadores: { player_1: { hp: 77, inventario_activo: {}, inventario_stash: {} } } } });
  const unit = {
    inventario_activo: {
      a1: { schemaVersion: 2, instanceId: "a1", definitionId: "item:scythe", quantity: 1, qualityTier: 4, condition: 90, conditionMax: 100, nombre: "Scythe" },
    },
    inventario_stash: {},
    attunedItemInstanceIds: ["a1"],
  };
  const result = await persistence.saveInventoryState(db, "player_1", unit);
  expect(result.saved).toBe(true);
  expect(db.data.campaña.jugadores.player_1.hp).toBe(77);
  expect(db.data.campaña.jugadores.player_1.itemInventorySchemaVersion).toBe(2);
  expect(db.data.campaña.jugadores.player_1.inventario_activo.a1.definitionId).toBe("item:scythe");
});

test("legacy HUD compatibility fields survive save and reload", async () => {
  const db = makeDb();
  const unit = {
    inventario_activo: {
      legacy: {
        schemaVersion: 2,
        instanceId: "legacy",
        definitionId: "item:toolkit",
        quantity: 1,
        qualityTier: 2,
        condition: 100,
        conditionMax: 100,
        nombre: "Toolkit",
        tags: ["toolkit"],
        keywords: ["synth_bonus_2"],
        limite_activo: 2,
      },
    },
    inventario_stash: {},
  };
  await persistence.saveInventoryState(db, "player_1", unit);
  const loaded = await persistence.loadPlayerInventory(db, "player_1");
  const item = Object.values(loaded.state.inventario_activo)[0];
  expect(item.nombre).toBe("Toolkit");
  expect(item.tags).toContain("toolkit");
  expect(item.keywords).toContain("synth_bonus_2");
  expect(item.limite_activo).toBe(2);
});

test("equipment refs are restored to canonical inventory instances", () => {
  const unit = {};
  const snapshot = {
    schemaVersion: 2,
    inventario_activo: {
      weapon_1: { schemaVersion: 2, instanceId: "weapon_1", definitionId: "item:weapon", quantity: 1, qualityTier: 2, condition: 100, conditionMax: 100 },
    },
    inventario_stash: {},
    equipmentRefs: { mainHand: "weapon_1" },
  };
  const applied = persistence.applyInventoryState(unit, snapshot);
  expect(applied.applied).toBe(true);
  expect(unit.equipment.mainHand).toBe(unit.inventario_activo.weapon_1);
});

test("Workshop persistence requires explicit world path and hydrates the same identity", async () => {
  global.LuminousWorkshopRuntime.clearWorkshops();
  const created = global.LuminousWorkshopRuntime.createWorkshopInstance({
    workshopId: "workshop:vesper",
    workshopName: "Vesper",
    workshopTier: 5,
    primarySpecialization: "weapon_blades",
    knownItemFamilies: ["family:weapon_blades"],
  });
  expect(created.created).toBe(true);
  const db = makeDb();
  expect((await persistence.saveWorkshopState(db, null)).reason).toBe("workshop_path_required");
  const saved = await persistence.saveWorkshopState(db, "campaña/worldState/workshops");
  expect(saved.saved).toBe(true);

  global.LuminousWorkshopRuntime.clearWorkshops();
  expect(global.LuminousWorkshopRuntime.getWorkshop("workshop:vesper")).toBeNull();
  const loaded = await persistence.loadWorkshopState(db, "campaña/worldState/workshops");
  expect(loaded.loaded).toBe(true);
  expect(global.LuminousWorkshopRuntime.getWorkshop("workshop:vesper").workshopName).toBe("Vesper");
});
