const { test, expect } = require("@playwright/test");

global.LuminousItemRuntime = require("../js/item-runtime-engine.js");
global.LuminousItemInventoryRuntime = require("../js/item-inventory-runtime.js");
const workshops = require("../js/workshop-runtime.js");

const namePools = [
  { tokenRole: "single", token: "Vesper", weight: 1, specializationAffinity: "weapon" },
  { tokenRole: "adjective", token: "Black", weight: 1, specializationAffinity: "weapon" },
  { tokenRole: "noun", token: "Needle", weight: 1, specializationAffinity: "weapon" },
];
const specializations = [{ id: "weapon_blades", familyIds: ["family:weapon_blades"] }];
const modules = [
  { id: "module:edge", specializations: ["weapon_blades"] },
  { id: "module:balance", specializations: ["weapon_blades"] },
];
const itemCatalog = [{
  id: "item:scythe",
  name: "Scythe",
  tier: 4,
  familyIds: ["family:weapon_blades"],
  moduleCapacity: 2,
  price: 100,
}];

test.beforeEach(() => workshops.clearWorkshops());

test("Workshop names store raw manufacturer name and never the Workshop suffix", () => {
  const created = workshops.createWorkshopInstance({
    worldSeed: "world-a",
    regionId: "district-1",
    workshopId: "workshop:vesper",
    workshopTier: 5,
    namePools,
    specializations,
    primarySpecialization: "weapon_blades",
    modules,
    technologies: ["tech:precision"],
  });
  expect(created.created).toBe(true);
  expect(created.workshop.workshopName).not.toContain("Workshop");
  expect(workshops.validateWorkshopName("Vesper Workshop").reason).toBe("raw_name_contains_workshop");
});

test("same workshop seed produces the same persistent identity fields", () => {
  const options = {
    worldSeed: "world-a",
    regionId: "district-1",
    workshopId: "workshop:one",
    workshopTier: 5,
    namePools,
    specializations,
    primarySpecialization: "weapon_blades",
    modules,
    technologies: ["tech:precision"],
  };
  const first = workshops.createWorkshopInstance(options).workshop;
  workshops.clearWorkshops();
  const second = workshops.createWorkshopInstance(options).workshop;
  expect(second.workshopName).toBe(first.workshopName);
  expect(second.knownModuleIds).toEqual(first.knownModuleIds);
  expect(second.signatureModuleIds).toEqual(first.signatureModuleIds);
  expect(second.signatureTechnologyIds).toEqual(first.signatureTechnologyIds);
});

test("Workshop products keep generic definitions and receive manufacturer provenance", () => {
  const created = workshops.createWorkshopInstance({
    worldSeed: "world-a",
    regionId: "district-1",
    workshopId: "workshop:blade",
    workshopName: "Vesper",
    workshopTier: 5,
    specializations,
    primarySpecialization: "weapon_blades",
    modules,
    technologies: ["tech:precision"],
  });
  const result = workshops.generateProduct(created.workshop, { itemCatalog, restockCycleId: "cycle-1", index: 0 });
  expect(result.generated).toBe(true);
  expect(result.instance.definitionId).toBe("item:scythe");
  expect(result.instance.manufacturerId).toBe("workshop:blade");
  expect(result.resolved.displayName).toBe("Vesper Workshop Scythe");
  expect(result.instance.installedModuleIds.every((id) => created.workshop.knownModuleIds.includes(id))).toBe(true);
});

test("restock is deterministic for the same cycle but produces unique product serials", () => {
  const created = workshops.createWorkshopInstance({
    worldSeed: "world-a",
    regionId: "district-1",
    workshopId: "workshop:restock",
    workshopName: "Black Needle",
    workshopTier: 5,
    specializations,
    primarySpecialization: "weapon_blades",
    modules,
  });
  const first = workshops.restockWorkshop(created.workshop, { itemCatalog, restockCycleId: "cycle-2", count: 3 });
  const second = workshops.restockWorkshop(created.workshop, { itemCatalog, restockCycleId: "cycle-2", count: 3 });
  expect(first.products.map((entry) => entry.instance.instanceId)).toEqual(second.products.map((entry) => entry.instance.instanceId));
  expect(new Set(first.products.map((entry) => entry.instance.productSerial)).size).toBe(3);
});

test("Product Lines append after the mandatory Workshop product name", () => {
  const created = workshops.createWorkshopInstance({
    workshopId: "workshop:vesper",
    workshopName: "Vesper",
    workshopTier: 7,
    primarySpecialization: "weapon_blades",
    knownItemFamilies: ["family:weapon_blades"],
  });
  const line = workshops.createProductLine(created.workshop, {
    force: true,
    productLineName: "Pale Harvest",
    compatibleItemFamilies: ["family:weapon_blades"],
    qualityBias: 1,
  });
  expect(line.created).toBe(true);
  const product = workshops.generateProduct(created.workshop, {
    itemCatalog,
    productLine: line.productLine,
    restockCycleId: "cycle-3",
    index: 0,
  });
  expect(product.resolved.displayName).toBe("Vesper Workshop Scythe — Pale Harvest");
});
