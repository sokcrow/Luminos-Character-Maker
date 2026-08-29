const { test, expect } = require("@playwright/test");

const equipment = require("../js/anatomy-equipment-engine.js");
global.LuminousAnatomyEquipmentEngine = equipment;
const actions = require("../js/universal-action-economy.js");
global.LuminousActionEconomy = actions;
const statuses = require("../js/status-engine.js");
global.LuminousStatusEngine = statuses;
const injuries = require("../js/injury-engine.js");
global.LuminousInjuryEngine = injuries;
const modifiers = require("../js/universal-modifier-engine.js");
global.LuminousUniversalModifiers = modifiers;
const items = require("../js/item-runtime-engine.js");

function applyProfile(item, runtimeJson) {
  item.runtime = typeof runtimeJson === "string" ? JSON.parse(runtimeJson) : runtimeJson;
  return item;
}

test("V3 weapon_chassis profile equips through the canonical anatomy engine", () => {
  const unit = { inventory: [] };
  const spear = applyProfile({
    canonicalId: "item:weapon_chassis_spear",
    category: "weapon_chassis",
    function: "equip|module_host|repairable|salvage|trade",
    tags: ["weapon:melee", "damage:pierce", "reach", "hands:2", "module:host"],
    quantity: 1,
  }, '{"equipment":{"kind":"weapon","handCost":2},"moduleCapacity":3}');
  unit.inventory.push(spear);

  const result = items.equipItem(unit, spear);
  expect(result.equipped).toBe(true);
  expect(spear.equippedPartIds).toHaveLength(2);
});

test("V3 accessory_chassis profile maps catalog face slot onto head anatomy", () => {
  const unit = { inventory: [] };
  const visor = applyProfile({
    canonicalId: "item:accessory_chassis_tactical_visor",
    category: "accessory_chassis",
    function: "equip|module_host|repairable|salvage|trade",
    tags: ["slot:face", "accessory", "module:host"],
    quantity: 1,
  }, '{"equipment":{"kind":"accessory","accessoryType":"head"},"moduleCapacity":3}');
  unit.inventory.push(visor);

  const result = items.equipItem(unit, visor);
  expect(result.equipped).toBe(true);
  expect(visor.equippedPartIds).toEqual(["head"]);
});

test("V3 module compatibility works on workbook chassis without renaming categories", () => {
  const weapon = applyProfile({
    canonicalId: "item:weapon_chassis_pistol",
    category: "weapon_chassis",
    function: "equip|module_host|repairable|salvage|trade",
    installedModules: [],
  }, '{"equipment":{"kind":"weapon","handCost":1},"moduleCapacity":3}');
  const module = applyProfile({
    canonicalId: "module:ignition_driver",
    category: "module",
    quantity: 1,
  }, '{"compatibleKinds":["weapon","accessory"]}');

  const result = items.installModule(weapon, module);
  expect(result.installed).toBe(true);
  expect(weapon.installedModules).toHaveLength(1);
  expect(module.quantity).toBe(0);
});
