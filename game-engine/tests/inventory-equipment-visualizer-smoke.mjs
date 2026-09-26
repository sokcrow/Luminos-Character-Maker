import assert from "node:assert/strict";
import fs from "node:fs";
import { createInventoryEquipmentViewModel, INVENTORY_EQUIPMENT_VIEW_CONTRACT } from "../src/ui/InventoryEquipmentViewModel.js";

const unit = { id: "player-test" };
const sword = {
  instanceId: "sword-1",
  definitionId: "weapon_sword",
  name: "Espada",
  category: "weapon",
  quantity: 1,
  equipped: true
};
const ration = {
  instanceId: "ration-1",
  definitionId: "ration",
  name: "Ración",
  category: "consumable",
  quantity: 3
};

const inventoryRuntime = {
  inventorySnapshot() {
    return {
      activeSlotLimit: 20,
      stashSlotLimit: 80,
      active: [{ key: "sword-1", item: sword }],
      stash: [{ key: "ration-1", item: ration }]
    };
  },
  describeInventory() {
    return { activeSlots: 1, activeSlotLimit: 20, stashSlots: 1, stashSlotLimit: 80 };
  }
};

const equipmentBridge = {
  schemaOf(item) { return { kind: item.category }; },
  itemEquippedSlot(_unit, item) { return item === sword ? "mainHand" : null; },
  compatibleSlots(item) { return item.category === "weapon" ? ["mainHand", "offHand"] : []; },
  getSlotItem(_unit, slot) { return slot === "mainHand" ? sword : null; }
};

const iconRegistry = {
  resolveIcon(id) { return id === "weapon_sword" ? "Assets/Icons/items/equipment/weapon_melee.png" : ""; }
};

const model = createInventoryEquipmentViewModel({ unit, inventoryRuntime, equipmentBridge, iconRegistry });
assert.equal(model.contract, INVENTORY_EQUIPMENT_VIEW_CONTRACT);
assert.equal(model.unitId, "player-test");
assert.equal(model.activeSlots, 1);
assert.equal(model.stashSlots, 1);
assert.equal(model.active[0].name, "Espada");
assert.equal(model.active[0].equippedSlot, "mainHand");
assert.deepEqual(model.active[0].compatibleSlots, ["mainHand", "offHand"]);
assert.equal(model.active[0].icon, "../../Assets/Icons/items/equipment/weapon_melee.png");
assert.equal(model.equipment.find(entry => entry.slot === "mainHand")?.item?.name, "Espada");

const html = fs.readFileSync(new URL("../visualizer/index.html", import.meta.url), "utf8");
const main = fs.readFileSync(new URL("../visualizer/main.js", import.meta.url), "utf8");
assert.match(html, /data-inventory-panel/);
assert.match(html, /data-equipment-slots/);
assert.match(html, /item-inventory-runtime\.js/);
assert.match(html, /item-equipment-bridge\.js/);
assert.match(html, /data-touch-move="up"/);
assert.match(html, /data-touch-move="left"/);
assert.match(html, /orientation:\s*landscape/);
assert.match(html, /Gira el teléfono a horizontal/);
assert.match(html, /data-inventory-panel[^>]*hidden/);
assert.match(main, /InventoryEquipmentDomAdapter/);
assert.match(main, /TouchMovementAdapter/);
assert.match(main, /touchIntent\.moveX/);
assert.match(main, /touchIntent\.moveZ/);
assert.match(main, /equipmentBridge\.equipTo/);
assert.match(main, /equipmentBridge\.unequipSlot/);
assert.match(main, /equipmentBridge\.moveItem/);
assert.match(main, /setInventoryOpen\(false\)/);
assert.match(main, /KeyI/);

console.log("Inventory/equipment visualizer smoke: ok");
