const { test, expect } = require("@playwright/test");

global.LuminousItemRuntime = require("../js/item-runtime-engine.js");
global.LuminousItemInventoryRuntime = require("../js/item-inventory-runtime.js");
global.LuminousWorkshopRuntime = require("../js/workshop-runtime.js");
const salvage = require("../js/item-salvage-runtime.js");

test("healthy items recover materials and removable modules using V11 bands", () => {
  const item = {
    instanceId: "scythe_1",
    definitionId: "item:scythe",
    quantity: 1,
    condition: 80,
    conditionMax: 100,
    installedModuleIds: ["module:edge", "tech:frame"],
    signatureComponents: [{ id: "component:vesper" }],
    salvageMaterials: { steel: 10, parts: 5 },
  };
  const result = salvage.salvageItem(item, {
    random: () => 0,
    moduleCatalog: {
      "module:edge": { id: "module:edge", technologyClass: "MODULE", removable: true },
      "tech:frame": { id: "tech:frame", technologyClass: "STRUCTURAL_TECH", removable: false },
    },
  });
  expect(result.salvaged).toBe(true);
  expect(result.band.id).toBe("condition:76_100");
  expect(result.materials.find((entry) => entry.id === "steel").quantity).toBe(8);
  expect(result.materials.find((entry) => entry.id === "parts").quantity).toBe(4);
  expect(result.recoveredModules).toContain("module:edge");
  expect(result.recoveredModules).not.toContain("tech:frame");
  expect(result.destroyedModules.find((entry) => entry.id === "tech:frame").reason).toBe("structural_or_non_removable");
  expect(result.recoveredSignatureComponents).toHaveLength(1);
  expect(result.structuralTechnologyRecoveredAsModule).toBe(false);
});

test("destroyed items use the 10 percent scrap band", () => {
  const item = { instanceId: "broken_1", definitionId: "item:armor", condition: 0, conditionMax: 100, salvageMaterials: { steel: 20 } };
  const result = salvage.salvageItem(item, { random: () => 1 });
  expect(result.band.id).toBe("condition:0");
  expect(result.materials[0].quantity).toBe(2);
});

test("equipped items are not salvageable by default", () => {
  const result = salvage.salvageItem({ instanceId: "equipped_1", equipped: true, condition: 100, conditionMax: 100 });
  expect(result.salvaged).toBe(false);
  expect(result.reason).toBe("item_equipped");
});

test("optional source consumption removes one quantity only after salvage resolves", () => {
  const item = { instanceId: "stack_1", definitionId: "item:scrap", quantity: 3, condition: 100, conditionMax: 100, salvageMaterials: { metal: 2 } };
  const result = salvage.salvageItem(item, { consumeSource: true, random: () => 0 });
  expect(result.salvaged).toBe(true);
  expect(result.sourceConsumed).toBe(true);
  expect(item.quantity).toBe(2);
});
