const { test, expect } = require("@playwright/test");

global.LuminousAnatomyEquipmentEngine = require("../js/anatomy-equipment-engine.js");
global.LuminousItemRuntime = require("../js/item-runtime-engine.js");
global.LuminousItemInventoryRuntime = require("../js/item-inventory-runtime.js");
const augments = require("../js/item-augmentation-runtime.js");

test("installs an augmentation separately from normal equipment", () => {
  const unit = { id: "player_1", inventario_activo: {}, augmentations: [] };
  const item = global.LuminousItemInventoryRuntime.createItemInstance({
    id: "augment:arm",
    name: "Arm Prosthetic",
    category: "augmentation",
    runtime: { augmentation: { replaceBodyPart: "left_arm", removable: true } },
  }, { instanceId: "augment_arm_1" });
  // The compact instance normally resolves its definition from the catalog. For
  // this focused test keep the authoring profile on the instance as legacy data.
  item.category = "augmentation";
  item.runtime = { augmentation: { replaceBodyPart: "left_arm", removable: true } };

  const installed = augments.installAugment(unit, item);
  expect(installed.installed).toBe(true);
  expect(unit.augmentations).toHaveLength(1);
  expect(item.equipped).toBe(true);
  expect(augments.isAugmentation(item)).toBe(true);
});

test("augmentation body requirements reject missing target parts", () => {
  const unit = { augmentations: [] };
  const item = {
    instanceId: "augment_wing_1",
    category: "augmentation",
    runtime: { augmentation: { targetPartIds: ["third_wing"] } },
  };
  const gate = augments.canInstallAugment(unit, item);
  expect(gate.allowed).toBe(false);
  expect(gate.reason).toBe("required_body_part_unavailable");
});

test("non-removable augmentations require an explicit force removal", () => {
  const item = {
    instanceId: "tattoo_1",
    category: "augmentation",
    runtime: { augmentation: { removable: false } },
  };
  const unit = { augmentations: [item] };
  const blocked = augments.removeAugment(unit, item);
  expect(blocked.removed).toBe(false);
  expect(blocked.reason).toBe("augmentation_not_removable");
  const forced = augments.removeAugment(unit, item, { force: true });
  expect(forced.removed).toBe(true);
  expect(unit.augmentations).toHaveLength(0);
});

test("installed augment modifiers are exposed as synthetic modifier traits", () => {
  const unit = {
    augmentations: [{
      instanceId: "tattoo_2",
      category: "augmentation",
      modifiers: [{ channel: "final_power", value: 1 }],
    }],
  };
  const traits = augments.collectAugmentModifierTraits(unit);
  expect(traits).toHaveLength(1);
  expect(traits[0].mechanics.modifiers[0].channel).toBe("final_power");
});
