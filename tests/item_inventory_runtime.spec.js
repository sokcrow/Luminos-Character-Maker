const { test, expect } = require("@playwright/test");

const itemBase = require("../js/item-runtime-engine.js");
global.LuminousItemRuntime = itemBase;
const inventory = require("../js/item-inventory-runtime.js");
global.LuminousItemInventoryRuntime = inventory;
const workshops = require("../js/workshop-runtime.js");

test.describe("canonical item inventory runtime", () => {
  test.beforeEach(() => workshops.clearWorkshops());

  test("creates compact ItemInstances and hydrates definitions without persisting definition copies", () => {
    const catalog = {
      "item:scythe": { canonicalId: "item:scythe", name: "Scythe", category: "weapon", tier: 4 },
    };
    const workshop = workshops.createWorkshopInstance({
      workshopId: "workshop:vesper",
      workshopName: "Vesper",
      workshopTier: 4,
      primarySpecialization: "weapon_blades",
      knownItemFamilies: ["family:weapon_blades"],
    }).workshop;
    const instance = inventory.createItemInstance("item:scythe", {
      catalog,
      instanceId: "instance:scythe:1",
      qualityTier: 4,
      manufacturerId: workshop.workshopId,
      condition: 87,
    });

    expect(instance.definitionId).toBe("item:scythe");
    expect(instance.instanceId).toBe("instance:scythe:1");
    expect(instance.qualityTier).toBe(4);
    expect(instance.manufacturerId).toBe("workshop:vesper");
    expect(instance.condition).toBe(87);
    expect(instance.name).toBeUndefined();

    const resolved = inventory.resolveItem(instance, { catalog, workshops });
    expect(resolved.name).toBe("Scythe");
    expect(resolved.displayName).toBe("Vesper Workshop Scythe");
  });

  test("moves items between stash and active inventory while enforcing 10 active slots", () => {
    const unit = { inventario_activo: {}, inventario_stash: {}, activeSlotLimit: 10 };
    for (let index = 0; index < 10; index += 1) {
      const item = inventory.createItemInstance({ id: `active_${index}`, name: `Active ${index}` }, { instanceId: `active_${index}` });
      unit.inventario_activo[item.instanceId] = item;
    }
    const stashItem = inventory.createItemInstance({ id: "reserve", name: "Reserve" }, { instanceId: "reserve_1" });
    unit.inventario_stash[stashItem.instanceId] = stashItem;

    const blocked = inventory.moveToActive(unit, "reserve_1", 1);
    expect(blocked.moved).toBe(false);
    expect(blocked.reason).toBe("active_inventory_full");

    delete unit.inventario_activo.active_0;
    const moved = inventory.moveToActive(unit, "reserve_1", 1);
    expect(moved.moved).toBe(true);
    expect(inventory.describeInventory(unit).activeSlots).toBe(10);
  });

  test("does not stack items with different quality, condition or manufacturer", () => {
    const base = { definitionId: "item:ammo", quantity: 1, condition: 100, conditionMax: 100, qualityTier: 2 };
    expect(inventory.canStack(base, { ...base, quantity: 2 })).toBe(true);
    expect(inventory.canStack(base, { ...base, qualityTier: 3 })).toBe(false);
    expect(inventory.canStack(base, { ...base, condition: 80 })).toBe(false);
    expect(inventory.canStack(base, { ...base, manufacturerId: "workshop:vector" })).toBe(false);
  });

  test("preserves manufacturer identity when ownership changes", () => {
    const item = inventory.createItemInstance({ id: "scythe", name: "Scythe" }, {
      instanceId: "scythe_1",
      manufacturerId: "workshop:vesper",
      currentOwnerId: "fixer_a",
    });

    const result = inventory.transferOwnership(item, "player_1", { sellerId: "pawn_shop" });
    expect(result.transferred).toBe(true);
    expect(item.manufacturerId).toBe("workshop:vesper");
    expect(item.currentOwnerId).toBe("player_1");
    expect(item.previousOwnerIds).toContain("fixer_a");
    expect(item.sellerId).toBe("pawn_shop");
  });

  test("tracks quality, condition states and charges canonically", () => {
    const item = inventory.createItemInstance({ id: "device", name: "Device", chargesMax: 5 }, {
      instanceId: "device_1",
      qualityTier: 5,
      condition: 100,
      charges: 5,
    });

    inventory.damageCondition(item, 51);
    expect(inventory.getConditionState(item).id).toBe("damaged");
    expect(inventory.getQualityTier(item)).toBe(5);

    expect(inventory.spendCharges(item, 2).spent).toBe(true);
    expect(inventory.getCharges(item).current).toBe(3);
    expect(inventory.restoreCharges(item, 1).after).toBe(4);
  });

  test("prevents structural technologies from being removed as normal modules", () => {
    const host = { installedModuleIds: ["module:edge"], installedModules: [] };
    const structural = { id: "module:edge", technologyClass: "STRUCTURAL_TECH", removable: false };
    const result = inventory.removeInstalledModule(host, structural, { moduleDefinition: structural });
    expect(result.removed).toBe(false);
    expect(result.reason).toBe("structural_technology_not_removable");
    expect(host.installedModuleIds).toContain("module:edge");
  });

  test("migrates legacy active and stash entries without changing container roles", () => {
    const unit = {
      inventario_activo: {
        legacy_weapon: { id: "weapon_scythe", nombre: "Scythe", cantidad: 1, tier: 4, limite_activo: 2 },
      },
      inventario_stash: {
        legacy_food: { id: "ration", nombre: "Ration", cantidad: 6, limite_alijo: 99 },
      },
    };

    const result = inventory.migrateLegacyInventory(unit);
    expect(result.migrated).toBe(true);
    expect(result.activeContainer).toBe("inventario_activo");
    expect(result.stashContainer).toBe("inventario_stash");
    expect(Object.values(unit.inventario_activo)[0].schemaVersion).toBe(2);
    expect(Object.values(unit.inventario_stash)[0].quantity).toBe(6);
  });
});
