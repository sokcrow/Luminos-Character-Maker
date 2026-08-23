const { test, expect } = require("@playwright/test");
const traitEngine = require("../js/trait-engine.js");
const statusEngine = require("../js/status-engine.js");
const modifiers = require("../js/universal-modifier-engine.js");
const catalog = require("../js/trait-catalog-core.js");

function barbarian(level = 100) {
  return {
    id: "universal_barbarian",
    level,
    classes: [{ classId: "barbarian", levels: level }],
    stats: {
      fuerza: 20,
      constitucion: 18,
      destreza: 14,
      inteligencia: 10,
      sabiduria: 12,
      carisma: 10,
    },
    combatStats: {
      offensiveLevel: 90,
      defensiveLevel: 60,
      minSpeed: 2,
      maxSpeed: 6,
    },
  };
}

test("equipment contract recognizes legacy armorType and future equipment armor slots", () => {
  expect(modifiers.resolveEquipment({ armorType: "medium" })).toMatchObject({
    armorEquipped: true,
    armorCategory: "medium",
    armor: { category: "medium" },
  });
  expect(modifiers.resolveEquipment({ equipment: { armor: { itemId: "plate_01", category: "heavy" } } })).toMatchObject({
    armorEquipped: true,
    armorCategory: "heavy",
  });
  expect(modifiers.resolveEquipment({ equipment: { armor: { itemId: null, category: "none" } } })).toMatchObject({
    armorEquipped: false,
    armorCategory: "none",
  });
  expect(modifiers.resolveEquipment({})).toMatchObject({ armorEquipped: false, armorCategory: "none" });
});

test("Armorless Defense contributes to the universal defensive level only while unarmored", () => {
  const trait = catalog.getDefinition("armorless_defense");
  const unarmored = barbarian(100);
  const armored = { ...barbarian(100), armorType: "medium" };

  const freeMods = modifiers.resolveTraitModifiers({
    unit: unarmored,
    character: unarmored,
    traits: [trait],
    context: "combat",
  });
  const armoredMods = modifiers.resolveTraitModifiers({
    unit: armored,
    character: armored,
    traits: [trait],
    context: "combat",
  });

  expect(freeMods.defensive_level).toBe(4);
  expect(armoredMods.defensive_level).toBe(0);
});

test("skill taxonomy keeps Attack Melee and Ranged on one family while Spell stays separate", () => {
  const melee = modifiers.normalizeSkill({ type: "Normal", skillRange: 1, coinAmount: 3 });
  const ranged = modifiers.normalizeSkill({ type: "Normal", skillRange: 5, coinAmount: 3, ammo: { resourceId: "bullet", cost: 2 } });
  const spell = modifiers.normalizeSkill({ type: "Spell", skillRange: 5, coinAmount: 2 });
  const guard = modifiers.normalizeSkill({ type: "Guard", isDefense: true, coinAmount: 1 });

  expect(melee).toMatchObject({ skillFamily: "attack", attackMode: "melee", isMelee: true, isRanged: false });
  expect(ranged).toMatchObject({ skillFamily: "attack", attackMode: "ranged", isMelee: false, isRanged: true, ammo: { resourceId: "bullet", cost: 2 } });
  expect(spell.skillFamily).toBe("spell");
  expect(guard.skillFamily).toBe("defense");
});

test("ranged Attack Skills use the generic ammo contract", () => {
  const skill = modifiers.normalizeSkill({
    type: "Normal",
    skillRange: 6,
    ammo: { resourceId: "arrow", cost: 1 },
  });
  expect(modifiers.canUseSkill({ resources: { arrow: { value: 1 } } }, skill)).toMatchObject({ usable: true });
  expect(modifiers.canUseSkill({ resources: { arrow: { value: 0 } } }, skill)).toMatchObject({ usable: false, reason: "insufficient_ammo" });
});

test("Status Engine accepts statuses without icons and keeps unit.statusEffects as the source of truth", () => {
  const unit = {};
  const definition = statusEngine.getDefinition("future_class_status");
  expect(definition).toMatchObject({ id: "future_class_status", icon: null, unregistered: true });

  statusEngine.applyStatus(unit, "future_class_status", { count: 2, potency: 3 });
  expect(unit.statusEffects.future_class_status).toMatchObject({ id: "future_class_status", count: 2, potency: 3 });
  expect(statusEngine.hasStatus(unit, "future_class_status")).toBe(true);
});

test("status protection blocks effect-driven Rage removal but permits explicit self removal", () => {
  const unit = {};
  statusEngine.applyStatus(unit, "rage", { count: 1 });
  statusEngine.protectStatus(unit, "rage", { from: "effects", sourceTraitId: "persistent_rage" });

  expect(statusEngine.removeStatus(unit, "rage", { from: "effects" })).toMatchObject({ removed: false, protected: true });
  expect(statusEngine.hasStatus(unit, "rage")).toBe(true);
  expect(statusEngine.removeStatus(unit, "rage", { from: "self" })).toMatchObject({ removed: true, protected: false });
  expect(statusEngine.hasStatus(unit, "rage")).toBe(false);
});

test("Rage, Brutal Critical and Fast Movement feed canonical modifier channels", () => {
  const character = barbarian(100);
  statusEngine.applyStatus(character, "rage", { count: 1 });
  const traits = [
    catalog.getDefinition("rage"),
    catalog.getDefinition("brutal_critical"),
    catalog.getDefinition("fast_movement"),
  ];
  const skill = modifiers.normalizeSkill({ type: "Normal", skillRange: 1, attackType: "Slash", affinity: "Wrath", coinAmount: 3 });
  const resolved = modifiers.resolveTraitModifiers({ unit: character, character, traits, skill, context: "combat" });

  expect(resolved.damage_taken_multiplier).toBe(5); // +5 means 50% reduction in CombatEngine's 10%-step channel.
  expect(resolved.damage_dealt_multiplier).toBe(9); // Offensive Level 90 => +90% damage.
  expect(resolved.final_power).toBe(3); // floor(90 / 30)
  expect(resolved.crit_damage_multiplier).toBe(4.5); // floor(90 / 2)=45% => 4.5 x 10% steps.
  expect(resolved.min_speed).toBe(1);
});

test("universal snapshot preserves pre-combat Off/Def levels and layers trait modifiers on top", () => {
  const character = barbarian(100);
  const snapshot = modifiers.resolveCharacterSnapshot({
    unit: character,
    character,
    traits: [catalog.getDefinition("armorless_defense"), catalog.getDefinition("fast_movement")],
    context: "combat",
  });

  expect(snapshot.offensiveLevel).toBe(90);
  expect(snapshot.defensiveLevel).toBe(64);
  expect(snapshot.minSpeed).toBe(3);
  expect(snapshot.maxSpeed).toBe(6);
});

test("Primordial Champion resolves +4 STR/CON with caps without mutating the stored base character", () => {
  const character = barbarian(100);
  const before = JSON.parse(JSON.stringify(character.stats));
  const snapshot = modifiers.resolveCharacterSnapshot({
    unit: character,
    character,
    traits: [catalog.getDefinition("primordial_champion")],
    context: "any",
  });

  expect(snapshot.stats.fuerza).toBe(24);
  expect(snapshot.stats.constitucion).toBe(22);
  expect(snapshot.statCaps).toMatchObject({ strength: 24, constitution: 24 });
  expect(character.stats).toEqual(before);
});

test("Unstoppable Strength check_coin_fail is limited to Strength ability/skill Checks", () => {
  const trait = catalog.getDefinition("unstoppable_strength");
  const character = barbarian(100);

  const abilityRuntime = { context: "theatre", character, self: character, check: { abilityId: "str", kind: "ability" } };
  const athleticsRuntime = { context: "theatre", character, self: character, check: { abilityId: "str", kind: "skill", skillId: "athletics" } };
  const saveRuntime = { context: "theatre", character, self: character, check: { abilityId: "str", kind: "save" } };
  const combatRuntime = { context: "combat", character, self: character, skill: { skillFamily: "attack", attackMode: "melee" } };

  expect(traitEngine.dispatchTrait(trait, "check_coin_fail", abilityRuntime, traitEngine.createState()).outcomes).toHaveLength(1);
  expect(traitEngine.dispatchTrait(trait, "check_coin_fail", athleticsRuntime, traitEngine.createState()).outcomes).toHaveLength(1);
  expect(traitEngine.dispatchTrait(trait, "check_coin_fail", saveRuntime, traitEngine.createState()).outcomes).toHaveLength(0);
  expect(traitEngine.dispatchTrait(trait, "check_coin_fail", combatRuntime, traitEngine.createState()).outcomes).toHaveLength(0);
});
