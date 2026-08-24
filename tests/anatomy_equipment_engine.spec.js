const { test, expect } = require("@playwright/test");

const equipment = require("../js/anatomy-equipment-engine.js");

function equippedItem(id, kind, extra = {}) {
  return { id, equipped: true, equipment: { kind, ...(extra.equipment || {}) }, ...extra };
}

test("humanoid anatomy exposes two hands, ten fingers, two feet and one armor capacity", () => {
  const anatomy = equipment.createHumanoidAnatomy();
  expect(equipment.partsByType(anatomy, "hand")).toHaveLength(2);
  expect(equipment.partsByType(anatomy, "finger")).toHaveLength(10);
  expect(equipment.partsByType(anatomy, "foot")).toHaveLength(2);
  const result = equipment.validateEquipment({}, [], { anatomy });
  expect(result.capacities).toMatchObject({ hands: 2, freeHands: 2, armor: 1 });
  expect(result.capacities.accessoryByType.finger).toBe(10);
});

test("One-Handed costs one hand, Two-Handed costs two, and two shields are legal", () => {
  const twoShields = [
    equippedItem("shield_a", "shield"),
    equippedItem("shield_b", "shield"),
  ];
  expect(equipment.validateEquipment({}, twoShields).valid).toBe(true);

  const occupied = [
    equippedItem("greatsword", "weapon", { equipment: { kind: "weapon", handCost: 2 } }),
    equippedItem("shield", "shield"),
  ];
  const result = equipment.validateEquipment({}, occupied);
  expect(result.valid).toBe(false);
  expect(result.invalid[0].reason).toBe("not_enough_functional_hands");
});

test("Traits or Augments may treat a Two-Handed weapon as One-Handed", () => {
  const character = { equipmentRules: { twoHandedAsOneHanded: true } };
  const items = [
    equippedItem("greatsword", "weapon", { equipment: { kind: "weapon", handCost: 2 } }),
    equippedItem("shield", "shield"),
  ];
  const result = equipment.validateEquipment(character, items);
  expect(result.valid).toBe(true);
  expect(result.capacities.freeHands).toBe(0);
});

test("extra arms automatically add hand, arm and finger capacity", () => {
  const character = { extraBodyParts: [{ type: "arm", side: "extra_1" }] };
  const anatomy = equipment.resolveCharacterAnatomy(character);
  expect(equipment.partsByType(anatomy, "arm")).toHaveLength(3);
  expect(equipment.partsByType(anatomy, "hand")).toHaveLength(3);
  expect(equipment.partsByType(anatomy, "finger")).toHaveLength(15);

  const items = [
    equippedItem("greatsword", "weapon", { equipment: { kind: "weapon", handCost: 2 } }),
    equippedItem("shield", "shield"),
  ];
  expect(equipment.validateEquipment(character, items, { anatomy }).valid).toBe(true);
});

test("Missing Arm cascades into Hand and Fingers while Missing Hand leaves the Arm", () => {
  const missingArm = equipment.createHumanoidAnatomy();
  equipment.setPartState(missingArm, "left_arm", "missing");
  expect(missingArm.parts.left_arm.state).toBe("missing");
  expect(missingArm.parts.left_hand.state).toBe("missing");
  expect(missingArm.parts.left_finger_1.state).toBe("missing");
  expect(equipment.partsByType(missingArm, "hand")).toHaveLength(1);

  const missingHand = equipment.createHumanoidAnatomy();
  equipment.setPartState(missingHand, "left_hand", "missing");
  expect(missingHand.parts.left_arm.state).toBe("available");
  expect(missingHand.parts.left_hand.state).toBe("missing");
  expect(missingHand.parts.left_finger_5.state).toBe("missing");
});

test("Severe disabled limb invalidates held equipment and drops it to Loot Pool", () => {
  const character = {
    injuries: [{ id: "broken_right_arm", severity: "severe", affectedParts: ["right_arm"], slotEffect: "disabled", active: true }],
  };
  const sword = equippedItem("sword", "weapon");
  const shield = equippedItem("shield", "shield");
  const greatsword = equippedItem("greatsword", "weapon", { equipment: { kind: "weapon", handCost: 2 } });
  const loot = [];

  const oneHandEach = equipment.revalidateEquipment(character, [sword, shield], { lootPool: loot });
  expect(oneHandEach.valid).toBe(false);
  expect(oneHandEach.invalid).toHaveLength(1);
  expect(loot).toHaveLength(1);
  expect(loot[0].equipped).toBe(false);

  const twoHanded = equipment.revalidateEquipment(character, [greatsword], { lootPool: loot });
  expect(twoHanded.valid).toBe(false);
  expect(twoHanded.invalid[0].reason).toBe("not_enough_functional_hands");
});

test("Accessories allocate real body parts instead of a fixed generic count", () => {
  const rings = Array.from({ length: 10 }, (_, index) => equippedItem(`ring_${index}`, "accessory", {
    equipment: { kind: "accessory", accessoryType: "finger", slotCost: 1 },
  }));
  expect(equipment.validateEquipment({}, rings).valid).toBe(true);

  const eleventh = equippedItem("ring_11", "accessory", { equipment: { kind: "accessory", accessoryType: "finger", slotCost: 1 } });
  const overflow = equipment.validateEquipment({}, [...rings, eleventh]);
  expect(overflow.valid).toBe(false);
  expect(overflow.invalid[0].reason).toBe("accessory_body_slot_unavailable");
});

test("Gloves use Hand accessory space but do not block Rings unless the item says so", () => {
  const glove = equippedItem("glove", "accessory", { equipment: { kind: "accessory", accessoryType: "hand", slotCost: 1 } });
  const rings = Array.from({ length: 10 }, (_, index) => equippedItem(`ring_${index}`, "accessory", {
    equipment: { kind: "accessory", accessoryType: "finger", slotCost: 1 },
  }));
  expect(equipment.validateEquipment({}, [glove, ...rings]).valid).toBe(true);

  const sealedGlove = equippedItem("sealed_glove", "accessory", {
    equipment: { kind: "accessory", accessoryType: "hand", slotCost: 1, blocksAccessorySlots: ["finger"] },
  });
  const blocked = equipment.validateEquipment({}, [sealedGlove, ...rings]);
  expect(blocked.valid).toBe(false);
  expect(blocked.assignments.filter((entry) => entry.item.id.startsWith("ring_"))).toHaveLength(5);
});

test("Full Armor may block Hand, Arm and Foot accessories while leaving Finger slots free", () => {
  const armor = equippedItem("full_armor", "armor", {
    equipment: { kind: "armor", blocksAccessorySlots: ["hand", "arm", "foot"] },
  });
  const glove = equippedItem("glove", "accessory", { equipment: { kind: "accessory", accessoryType: "hand" } });
  const bracelet = equippedItem("bracelet", "accessory", { equipment: { kind: "accessory", accessoryType: "arm" } });
  const shoes = equippedItem("shoes", "accessory", { equipment: { kind: "accessory", accessoryType: "foot", slotCost: 2 } });
  const ring = equippedItem("ring", "accessory", { equipment: { kind: "accessory", accessoryType: "finger" } });
  const result = equipment.validateEquipment({}, [armor, glove, bracelet, shoes, ring]);
  expect(result.invalid.map((entry) => entry.item.id).sort()).toEqual(["bracelet", "glove", "shoes"]);
  expect(result.assignments.some((entry) => entry.item.id === "ring")).toBe(true);
});

test("biological regeneration does not repair a mechanical prosthesis", () => {
  const anatomy = equipment.createHumanoidAnatomy();
  equipment.replaceBranch(anatomy, "left_arm", { substrate: "mechanical" });
  equipment.setPartState(anatomy, "left_arm", "disabled");
  const biological = equipment.restoreBranch(anatomy, "left_arm", { method: "regeneration" });
  expect(biological.restored).toBe(false);
  expect(biological.reason).toBe("biological_healing_cannot_repair_mechanical");
  const mechanical = equipment.restoreBranch(anatomy, "left_arm", { method: "mechanical_repair" });
  expect(mechanical.restored).toBe(true);
});
