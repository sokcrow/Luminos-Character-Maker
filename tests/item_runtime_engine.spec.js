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

function consumable(id, details = {}, extra = {}) {
  return {
    id,
    definitionId: id,
    nombre: id,
    tipo_categoria: "consumable",
    quantity: 2,
    consumable_details: details,
    ...extra,
  };
}

test("legacy DM Forge consumables heal HP and consume one item", () => {
  const unit = { combatStats: { hp_actual: 25, hp_max: 50 }, inventory: [] };
  const medkit = consumable("basic_medkit", { curacion_hp: 15 });
  unit.inventory.push(medkit);
  const result = items.useItem(unit, medkit, { phase: "other" });
  expect(result.used).toBe(true);
  expect(unit.combatStats.hp_actual).toBe(40);
  expect(medkit.quantity).toBe(1);
});

test("throwable consumables apply status to target instead of user", () => {
  const user = { inventory: [] };
  const target = {};
  const smoke = consumable("smoke_canister", { is_throwable: true, status_id: "blinded", status_count: 1, status_potency: 0 });
  user.inventory.push(smoke);
  const result = items.useItem(user, smoke, { phase: "other", target });
  expect(result.used).toBe(true);
  expect(statuses.hasStatus(target, "blinded")).toBe(true);
  expect(statuses.hasStatus(user, "blinded")).toBe(false);
});

test("action-cost consumable schedules in planning and only consumes on resolution", () => {
  const unit = { id: "unit_a", activeSlots: 1, combatStats: { hp_actual: 10, hp_max: 30 }, inventory: [] };
  const medkit = consumable("planned_medkit", { curacion_hp: 10 });
  unit.inventory.push(medkit);
  actions.beginPlanning(unit);
  const scheduled = items.useItem(unit, medkit, { phase: "planning" });
  expect(scheduled.scheduled).toBe(true);
  expect(medkit.quantity).toBe(2);
  expect(unit.combatStats.hp_actual).toBe(10);

  actions.beginCombat(unit);
  const entry = actions.takePlannedAction(unit, scheduled.slotIndex, { phase: "combat" });
  const resolved = items.resolveScheduledUse(unit, entry);
  expect(resolved.resolved).toBe(true);
  expect(unit.combatStats.hp_actual).toBe(20);
  expect(medkit.quantity).toBe(1);
});

test("weapons infer hand requirements from catalog tags and use anatomy validation", () => {
  const unit = { inventory: [] };
  const rifle = { id: "rifle", tipo_categoria: "weapon", tags: ["weapon:ranged", "hands:2"], quantity: 1 };
  const shield = { id: "shield", tipo_categoria: "shield", quantity: 1 };
  unit.inventory.push(rifle, shield);
  expect(items.equipItem(unit, rifle).equipped).toBe(true);
  const blocked = items.equipItem(unit, shield);
  expect(blocked.equipped).toBe(false);
  expect(blocked.reason).toBe("not_enough_functional_hands");
});

test("accessory slot tags map onto actual body parts", () => {
  const unit = { inventory: [] };
  const mask = { id: "mask", tipo_categoria: "accessory", tags: ["slot:face"], quantity: 1 };
  unit.inventory.push(mask);
  const result = items.equipItem(unit, mask);
  expect(result.equipped).toBe(true);
  expect(mask.equippedPartIds).toEqual(["head"]);
});

test("ammo items feed the same resources checked by ranged skills", () => {
  const unit = { resources: { pistol: 0 }, inventory: [] };
  const ammo = { id: "pistol_ammo", category: "ammo", subtype: "pistol", function: "AMMO|TRADE", quantity: 6 };
  unit.inventory.push(ammo);
  const result = items.reloadAmmo(unit, ammo, { amount: 4 });
  expect(result.reloaded).toBe(true);
  expect(unit.resources.pistol).toBe(4);
  expect(ammo.quantity).toBe(2);

  const skill = { type: "normal", attackMode: "ranged", ammo: { resourceId: "pistol", cost: 1 } };
  expect(global.LuminousUniversalModifiers.canUseSkill(unit, skill).usable).toBe(true);
});

test("repair effects restore item condition without exceeding conditionMax", () => {
  const target = { id: "armor", condition: 45, conditionMax: 100 };
  const result = items.repairItem(target, 70);
  expect(result.repaired).toBe(true);
  expect(target.condition).toBe(100);
  expect(result.amount).toBe(55);
});

test("item injury treatments delegate to the canonical injury engine", () => {
  const unit = { inventory: [], injuries: [] };
  const gained = injuries.gainInjury(unit, "deep_wound", { persist: false });
  expect(gained.gained).toBe(true);
  const kit = consumable("field_dressing", {}, {
    runtime: { injuryTreatment: { reduceHours: 8 } },
  });
  unit.inventory.push(kit);
  const before = unit.injuries[0].remainingRecoveryHours;
  const result = items.useItem(unit, kit, { phase: "other", injuryRef: unit.injuries[0].instanceId });
  expect(result.used).toBe(true);
  expect(unit.injuries[0].remainingRecoveryHours).toBe(before - 8);
});

test("temporary stat consumables become synthetic item traits and expire in world hours", () => {
  const unit = { inventory: [], stats: { strength: 10 } };
  const stim = consumable("strength_stim", { stat_increase: "fuerza", stat_increase_value: 2, duration_hours: 3 });
  unit.inventory.push(stim);
  expect(items.useItem(unit, stim, { phase: "other" }).used).toBe(true);
  let traits = items.collectModifierTraits(unit);
  expect(traits.some((trait) => trait.rules.some((rule) => rule.type === "stat" && rule.statId === "fuerza"))).toBe(true);
  items.advanceTime(unit, 3);
  traits = items.collectModifierTraits(unit);
  expect(traits.some((trait) => trait.id.includes("strength_stim") && trait.rules.some((rule) => rule.type === "stat"))).toBe(false);
});

test("modules respect host capacity and can be removed", () => {
  const host = { id: "sword", category: "weapon", function: "EQUIP|MODULE_HOST", installedModules: [], runtime: { moduleCapacity: 1 } };
  const a = { id: "mod_a", category: "upgrade", quantity: 1 };
  const b = { id: "mod_b", category: "upgrade", quantity: 1 };
  expect(items.installModule(host, a).installed).toBe(true);
  expect(items.installModule(host, b).installed).toBe(false);
  expect(items.removeModule(host, "mod_a").removed).toBe(true);
});

test("crafting consumes DM Forge recipe ingredients and creates the result", () => {
  const unit = {
    inventory: [
      { id: "cloth", definitionId: "cloth", quantity: 3 },
      { id: "chemical", definitionId: "chemical", quantity: 2 },
    ],
  };
  const recipe = { ingredientes: { cloth: 2, chemical: 1 }, item_resultado_id: "bandage", cantidad_resultado: 2 };
  const result = items.craft(unit, recipe, { resultDefinition: { id: "bandage", definitionId: "bandage", nombre: "Bandage" } });
  expect(result.crafted).toBe(true);
  expect(unit.inventory.find((x) => x.definitionId === "cloth").quantity).toBe(1);
  expect(unit.inventory.find((x) => x.definitionId === "chemical").quantity).toBe(1);
  expect(unit.inventory.find((x) => x.definitionId === "bandage").quantity).toBe(2);
});
