const { test, expect } = require("@playwright/test");

global.LuminousItemRuntime = require("../js/item-runtime-engine.js");
global.LuminousItemInventoryRuntime = require("../js/item-inventory-runtime.js");
global.LuminousWorkshopRuntime = require("../js/workshop-runtime.js");

test("missing item lookup returns null instead of delegating recursively", () => {
  const unit = { inventario_activo: {}, inventario_stash: {}, equipment: {} };
  expect(global.LuminousItemInventoryRuntime.findItem(unit, "does_not_exist")).toBeNull();
});

test("product line display resolves from persistent workshop state by id", () => {
  global.LuminousWorkshopRuntime.clearWorkshops();
  const workshop = global.LuminousWorkshopRuntime.createWorkshopInstance({
    workshopId: "workshop:vesper",
    workshopName: "Vesper",
    workshopTier: 7,
    primarySpecialization: "weapon_blades",
    knownItemFamilies: ["family:weapon_blades"],
  }).workshop;
  const line = global.LuminousWorkshopRuntime.createProductLine(workshop, {
    force: true,
    productLineName: "Pale Harvest",
    compatibleItemFamilies: ["family:weapon_blades"],
  }).productLine;
  const instance = global.LuminousItemInventoryRuntime.createItemInstance({ id: "item:scythe", name: "Scythe" }, {
    instanceId: "scythe_1",
    manufacturerId: workshop.workshopId,
    productLineId: line.productLineId,
  });
  const resolved = global.LuminousItemInventoryRuntime.resolveItem(instance, {
    catalog: [{ id: "item:scythe", name: "Scythe" }],
    workshops: global.LuminousWorkshopRuntime,
  });
  expect(resolved.displayName).toBe("Vesper Workshop Scythe — Pale Harvest");
});
