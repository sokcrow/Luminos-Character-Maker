const { test, expect } = require("@playwright/test");
const path = require("path");

const APPROVED_BRIDGE = path.resolve(__dirname, "../js/item-equipment-approved-bridge.js");

test("approved equipment bridge exposes Shield only through Off Hand", async ({ page }) => {
  await page.setContent("<html><body></body></html>");
  await page.evaluate(() => {
    const shield = { instanceId: "shield_1", category: "shield" };
    window.__shield = shield;
    window.__slots = { shield: shield, offHand: null };
    window.__calls = [];
    window.LuminousItemEquipmentBridge = Object.freeze({
      version: 1,
      normalizeSlot(slot) {
        const value = String(slot || "");
        if (value === "off" || value === "off_hand") return "offHand";
        return value;
      },
      categoryOf(item) { return item?.category || "item"; },
      compatibleSlots(item) { return item?.category === "shield" ? ["offHand", "shield"] : []; },
      getSlotItem(unit, slot) { return window.__slots[slot] || null; },
      canEquipTo(unit, item, slot) { window.__calls.push(["can", slot]); return { allowed: true, item, slot }; },
      equipTo(unit, item, slot) { window.__calls.push(["equip", slot]); return { equipped: true, item, slot }; },
      unequipSlot(unit, slot) { window.__calls.push(["unequip", slot]); return { unequipped: true, slot }; },
      itemEquippedSlot(unit, item) { return item === window.__shield ? "shield" : null; },
    });
  });

  await page.addScriptTag({ path: APPROVED_BRIDGE });

  const result = await page.evaluate(() => {
    const bridge = window.LuminousItemEquipmentBridge;
    return {
      compatible: bridge.compatibleSlots(window.__shield),
      offHandItem: bridge.getSlotItem({}, "offHand")?.instanceId || null,
      gate: bridge.canEquipTo({}, window.__shield, "shield"),
      equipped: bridge.equipTo({}, window.__shield, "shield"),
      visibleSlot: bridge.itemEquippedSlot({}, window.__shield),
      calls: window.__calls,
    };
  });

  expect(result.compatible).toEqual(["offHand"]);
  expect(result.offHandItem).toBe("shield_1");
  expect(result.gate.slot).toBe("offHand");
  expect(result.equipped.slot).toBe("offHand");
  expect(result.visibleSlot).toBe("offHand");
  expect(result.calls).toContainEqual(["can", "offHand"]);
  expect(result.calls).toContainEqual(["equip", "offHand"]);
});
