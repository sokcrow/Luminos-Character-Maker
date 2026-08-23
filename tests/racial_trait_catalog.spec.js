const { test, expect } = require("@playwright/test");
const engine = require("../js/trait-engine.js");
const modifiers = require("../js/universal-modifier-engine.js");
const catalog = require("../js/racial-trait-catalog.js");
const damageBridge = require("../js/racial-trait-runtime-bridge.js");
const runtimeEngine = global.LuminousTraitEngine;

test("racial Trait catalog validates every declarative definition and complete manifest", () => {
  const result = catalog.validateAll(engine);
  expect(result.valid).toBe(true);
  expect(result.errors).toEqual([]);
  expect(Object.keys(catalog.DEFINITIONS).length).toBeGreaterThan(45);
  expect(catalog.CATALOG_VERSION).toBeGreaterThanOrEqual(2);

  for (const [raceId, manifest] of Object.entries(catalog.RACE_TRAIT_MANIFEST)) {
    for (const [subtypeId, traitIds] of Object.entries(manifest)) {
      for (const traitId of traitIds) {
        expect(catalog.DEFINITIONS[traitId], `${raceId}/${subtypeId}/${traitId}`).toBeTruthy();
      }
    }
  }
});

test("race and subtype grants resolve automatically without leaking other subtypes", () => {
  const juggernaut = catalog.resolveTraitGrants({ level: 30, raceId: "warforged", raceSubtypeId: "juggernaut" });
  const skirmisher = catalog.resolveTraitGrants({ level: 30, raceId: "warforged", raceSubtypeId: "skirmisher" });

  expect(juggernaut.map((trait) => trait.id)).toEqual(["warforged_sentry_rest", "warforged_reinforced_body"]);
  expect(skirmisher.map((trait) => trait.id)).toEqual(["warforged_sentry_rest", "warforged_lone_reconnaissance"]);
  expect(juggernaut[0].source).toMatchObject({ type: "race", id: "warforged" });
  expect(juggernaut[1].source).toMatchObject({ type: "race", id: "warforged", subtypeId: "juggernaut" });
});

test("Lupae automatically receives shared Pack Tactics instead of a race-only duplicate", () => {
  const granted = catalog.resolveTraitGrants({ level: 20, raceId: "lupae" });
  expect(granted.map((trait) => trait.id)).toEqual([
    "keen_hearing_and_smell",
    "pack_tactics",
    "lupae_canis_toughness",
  ]);
  expect(catalog.getDefinition("pack_tactics").source).toMatchObject({ type: "special", id: "shared" });
});

test("Moonfae all five cycles resolve their complete Trait packages", () => {
  const expected = {
    full_moon: ["keen_hearing", "moonfae_lunar_transformation", "moonfae_rabbit_perception", "moonfae_rabbit_strength_penalty", "moonfae_intimidating_presence", "moonfae_lunge"],
    crescent_moon: ["keen_hearing", "moonfae_lunar_transformation", "moonfae_rabbit_perception", "moonfae_rabbit_strength_penalty", "moonfae_crescent_speed", "moonfae_agile_escape", "moonfae_natural_talent"],
    new_moon: ["keen_hearing", "moonfae_lunar_transformation", "moonfae_rabbit_perception", "moonfae_rabbit_strength_penalty", "moonfae_cautious_senses", "moonfae_empathy"],
    crimson_moon: ["keen_hearing", "moonfae_lunar_transformation", "moonfae_rabbit_perception", "moonfae_rabbit_strength_penalty", "moonfae_unsettling_knowledge"],
    blue_moon: ["keen_hearing", "moonfae_lunar_transformation", "moonfae_rabbit_perception", "moonfae_rabbit_strength_penalty", "moonfae_rabbits_luck", "moonfae_favorable_action"],
  };

  for (const [cycle, ids] of Object.entries(expected)) {
    const traits = catalog.resolveTraitGrants({ characterBuild: { raceId: "moonfae", raceSubtypeId: cycle, calculatedAtLevel: 30 } });
    expect(traits.map((trait) => trait.id)).toEqual(ids);
  }
});

test("Yuan-ti eye colors grant the complete Trait packages and Pale Eyes get no Sin bonus", () => {
  const red = catalog.resolveTraitGrants({ level: 80, raceId: "yuan_ti_pureblood", raceSubtypeId: "red_eyes" });
  const cyan = catalog.resolveTraitGrants({ level: 80, raceId: "yuan_ti_pureblood", raceSubtypeId: "cyan_eyes" });
  const green = catalog.resolveTraitGrants({ level: 80, raceId: "yuan_ti_pureblood", raceSubtypeId: "green_eyes" });
  const pale = catalog.resolveTraitGrants({ level: 80, raceId: "yuan_ti_pureblood", raceSubtypeId: "pale_eyes" });

  expect(red.map((trait) => trait.id)).toEqual(["yuan_ti_magic_resistance", "yuan_ti_wrath_affinity", "yuan_ti_cold_fury"]);
  expect(cyan.map((trait) => trait.id)).toEqual(["yuan_ti_magic_resistance", "yuan_ti_gloom_affinity", "yuan_ti_subtle_influence"]);
  expect(green.map((trait) => trait.id)).toEqual(["yuan_ti_magic_resistance", "yuan_ti_gluttony_affinity", "yuan_ti_voracious_impulse"]);
  expect(pale.map((trait) => trait.id)).toEqual(["yuan_ti_magic_resistance"]);
  expect(pale.some((trait) => trait.id.includes("affinity"))).toBe(false);
});

test("Aasimar subtypes receive Healing Hands plus only their own transformation", () => {
  expect(catalog.resolveTraitGrants({ raceId: "aasimar", raceSubtypeId: "protector" }).map((t) => t.id)).toEqual([
    "aasimar_healing_hands", "aasimar_protector_transformation",
  ]);
  expect(catalog.resolveTraitGrants({ raceId: "aasimar", raceSubtypeId: "scourge" }).map((t) => t.id)).toEqual([
    "aasimar_healing_hands", "aasimar_scourge_transformation",
  ]);
  expect(catalog.resolveTraitGrants({ raceId: "aasimar", raceSubtypeId: "fallen" }).map((t) => t.id)).toEqual([
    "aasimar_healing_hands", "aasimar_fallen_transformation",
  ]);
});

test("Semi Dragon ancestry Traits are isolated by ancestry", () => {
  const expected = {
    red: ["half_dragon_indomitable"],
    black: ["half_dragon_relentless_strength"],
    white: ["half_dragon_skilled_hunter"],
    blue: ["half_dragon_desert_predator"],
    gold: ["half_dragon_gold_breath_conversion"],
    brass: ["half_dragon_bold_speaker"],
    bronze: [],
    silver: [],
  };
  for (const [subtype, ids] of Object.entries(expected)) {
    expect(catalog.resolveTraitGrants({ raceId: "half_dragon", raceSubtypeId: subtype }).map((t) => t.id)).toEqual(ids);
  }
});

test("Undae subtype Trait packages include war, rock, mystic and wild features", () => {
  expect(catalog.resolveTraitGrants({ raceId: "undae", raceSubtypeId: "war" }).map((t) => t.id)).toEqual(["undae_regeneration", "undae_aquatic_tenacity"]);
  expect(catalog.resolveTraitGrants({ raceId: "undae", raceSubtypeId: "rock" }).map((t) => t.id)).toEqual(["undae_regeneration", "undae_thick_skin", "undae_stable_step"]);
  expect(catalog.resolveTraitGrants({ raceId: "undae", raceSubtypeId: "mystic" }).map((t) => t.id)).toEqual(["undae_regeneration", "undae_calming_presence"]);
  expect(catalog.resolveTraitGrants({ raceId: "undae", raceSubtypeId: "wild" }).map((t) => t.id)).toEqual(["undae_regeneration", "undae_silent_step", "undae_friend_of_life"]);
});

test("Voracious Impulse heals (5 + CHA Mod)% Max HP on kill", () => {
  const trait = catalog.getDefinition("yuan_ti_voracious_impulse");
  const character = { level: 40, stats: { carisma: 16 } };
  const self = { hp: 40, maxHp: 100 };
  const result = engine.dispatchCombatEvent("on_kill", { character, self, traits: [trait] });

  expect(self.hp).toBe(48);
  expect(result.outcomes[0]).toMatchObject({ type: "heal_hp", amount: 8, after: 48 });
});

test("Hungry Jaws gains the configured percent of Bite damage as Shield", () => {
  const trait = catalog.getDefinition("lizalin_hungry_jaws");
  const character = { level: 40, stats: { constitucion: 16 } };
  const self = { hp: 100, maxHp: 100, shield: 0 };
  const result = engine.dispatchCombatEvent("damage_dealt", {
    character,
    self,
    traits: [trait],
    skill: { id: "bite", tags: ["bite"] },
    variables: { DamageDealt: 100 },
  });

  expect(self.shield).toBe(13);
  expect(result.outcomes[0]).toMatchObject({ type: "gain_shield", amount: 13 });
});

test("Fury of the Small adds fixed damage once per Turn against a larger target", () => {
  const trait = catalog.getDefinition("goblin_fury_of_small");
  const character = { level: 20, stats: { constitucion: 16 } };
  const self = { size: "small" };
  const target = { size: "medium" };
  const state = runtimeEngine.createState();
  const firstDamage = { amount: 10 };
  const secondDamage = { amount: 10 };

  runtimeEngine.dispatchCombatEvent("damage_dealt", { character, self, target, traits: [trait], state, damage: firstDamage });
  runtimeEngine.dispatchCombatEvent("damage_dealt", { character, self, target, traits: [trait], state, damage: secondDamage });
  expect(firstDamage.amount).toBe(13);
  expect(secondDamage.amount).toBe(10);

  runtimeEngine.dispatchCombatEvent("turn_start", { character, self, target, traits: [trait], state });
  const nextTurnDamage = { amount: 10 };
  runtimeEngine.dispatchCombatEvent("damage_dealt", { character, self, target, traits: [trait], state, damage: nextTurnDamage });
  expect(nextTurnDamage.amount).toBe(13);
});

test("racial damage bridge returns Trait-adjusted damage to the production CombatEngine path", () => {
  const trait = catalog.getDefinition("goblin_fury_of_small");
  const attacker = { size: "small", stats: { constitucion: 16 }, level: 20 };
  const defender = { size: "medium" };
  const skill = { id: "test_attack" };

  global.CombatEngine = {
    __universalModifierBridge: true,
    calculateCoinDamage(currentAttacker, currentDefender, currentSkill) {
      global.LuminousTraitEngine.dispatchCombatEvent("damage_dealt", {
        character: currentAttacker,
        self: currentAttacker,
        attacker: currentAttacker,
        target: currentDefender,
        defender: currentDefender,
        skill: currentSkill,
        traits: [trait],
        damageDealt: 10,
      });
      return 10;
    },
  };
  damageBridge.installAll();

  expect(global.CombatEngine.calculateCoinDamage(attacker, defender, skill)).toBe(13);
  delete global.CombatEngine;
});

test("Centaur Charge and White Semi Dragon compare target Speed against user Max Speed", () => {
  const centaur = catalog.getDefinition("centaur_charge");
  const whiteDragon = catalog.getDefinition("half_dragon_skilled_hunter");
  const character = { level: 30, combatStats: { maxSpeed: 6 } };

  const chargeSkill = { finalPower: 4 };
  engine.dispatchCombatEvent("before_attack", { character, self: character, target: { speed: 4 }, skill: chargeSkill, traits: [centaur] });
  expect(chargeSkill.finalPower).toBe(5);

  const hunterSkill = { clashPower: 2 };
  engine.dispatchCombatEvent("before_attack", { character, self: character, target: { speed: 4 }, skill: hunterSkill, traits: [whiteDragon] });
  expect(hunterSkill.clashPower).toBe(4);
});

test("Warforged Integrated Tool multiplies Threshold by 0.75", () => {
  const trait = catalog.getDefinition("warforged_integrated_tool");
  const result = engine.resolveTheatreCheck({
    character: { level: 20 },
    traits: [trait],
    check: { skillId: "smith_tools", usesIntegratedTool: true, difficulty: 20 },
  });
  expect(result.check.difficulty).toBe(15);
});

test("Feline Reflexes resolves Max Speed and Evade Final Power from Proficiency", () => {
  const trait = catalog.getDefinition("feline_reflexes");
  const character = { level: 60, proficiency: 4, combatStats: { minSpeed: 3, maxSpeed: 6 } };
  const snapshot = modifiers.resolveCharacterSnapshot({
    character,
    unit: character,
    traits: [trait],
    skill: { type: "evade", isDefense: true },
    context: "combat",
  });
  expect(snapshot.maxSpeed).toBe(8);
  expect(snapshot.modifiers.final_power).toBe(4);
});

test("Fairy Form contributes the confirmed speed, evasion and fragility modifiers while active", () => {
  const trait = catalog.getDefinition("fairy_form");
  const unit = { level: 20, combatStats: { minSpeed: 2, maxSpeed: 5 }, statusEffects: { fairy_form: { count: 1 } } };
  const snapshot = modifiers.resolveCharacterSnapshot({
    character: unit,
    unit,
    traits: [trait],
    skill: { type: "evade", isDefense: true },
    context: "combat",
  });
  expect(snapshot.minSpeed).toBe(4);
  expect(snapshot.maxSpeed).toBe(7);
  expect(snapshot.modifiers.final_power).toBe(2);
  expect(snapshot.modifiers.damage_taken_multiplier).toBe(-5);
});

test("Keen Hearing uses the global Advantage conversion of Threshold -4", () => {
  const trait = catalog.getDefinition("keen_hearing");
  const result = engine.resolveTheatreCheck({
    character: { level: 20 },
    traits: [trait],
    check: { skillId: "perception", senses: ["hearing"], difficulty: 16 },
  });
  expect(result.check.difficulty).toBe(12);
});

test("Desert Predator checks each burrowable environment tag with contains", () => {
  const trait = catalog.getDefinition("half_dragon_desert_predator");
  for (const tag of ["sand", "loose_earth", "burrowable_ground"]) {
    const result = engine.resolveTheatreCheck({
      character: { level: 20 },
      traits: [trait],
      check: { skillId: "stealth", environmentTags: [tag], difficulty: 16 },
    });
    expect(result.check.difficulty).toBe(12);
  }
});

test("mobility capabilities unlock the shared Retreat families and Retreat bonuses remain non-stackable", () => {
  const undaeWar = catalog.resolveCapabilities({ raceId: "undae", raceSubtypeId: "war" });
  const elnae = catalog.resolveCapabilities({ raceId: "elnae" });
  const blueDragon = catalog.resolveCapabilities({ raceId: "half_dragon", raceSubtypeId: "blue" });
  const protector = catalog.resolveCapabilities({ raceId: "aasimar", raceSubtypeId: "protector" });

  expect(undaeWar.map((entry) => entry.capabilityId)).toEqual(["amphibious", "swim_speed"]);
  expect(elnae.map((entry) => entry.capabilityId)).toEqual(["flight"]);
  expect(blueDragon.map((entry) => entry.capabilityId)).toEqual(["burrow"]);
  expect(protector.map((entry) => entry.capabilityId)).toEqual(["flight"]);

  expect(catalog.RETREATS.burrowed).toMatchObject({ capabilityId: "burrow", nonStackableGroup: "retreat_bonus", comebackStatus: { statusId: "protection", count: 3 }, encounterBonus: { channel: "defensive_level", value: 1 } });
  expect(catalog.RETREATS.sink).toMatchObject({ capabilityId: "swim_speed", nonStackableGroup: "retreat_bonus", comebackStatus: { statusId: "defense_power_up", count: 3 } });
  expect(catalog.RETREATS.fly).toMatchObject({ capabilityId: "flight", nonStackableGroup: "retreat_bonus", comebackStatus: { statusId: "haste", count: 3 } });
  expect(catalog.RETREATS.fly.encounterBonus).toEqual([{ channel: "min_speed", value: 2 }, { channel: "max_speed", value: 2 }]);
});

test("non-Trait race features are explicitly classified instead of silently omitted", () => {
  expect(catalog.NON_TRAIT_FEATURES.tiefling).toContain("heritage_spell_grants");
  expect(catalog.NON_TRAIT_FEATURES.half_dragon).toContain("dragon_breath_dynamic_skill");
  expect(catalog.NON_TRAIT_FEATURES.elnae).toContain("flight_capability");
  expect(catalog.NON_TRAIT_FEATURES.undae).toContain("poison_immunity");
});
