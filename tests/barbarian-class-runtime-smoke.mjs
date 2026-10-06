import assert from "node:assert/strict";

for (const key of [
  "LuminousStatusEngine",
  "LuminousStatusLibrary",
  "LuminousTraitEngine",
  "LuminousTraitCatalogCore",
  "LuminousUniversalModifiers",
  "LuminousClassStatusSemantics",
  "LuminousBarbarianClassRuntime",
  "STATUS_REGISTRY",
]) delete globalThis[key];

await import("../js/status-engine.js");
await import("../js/status-library.js");
await import("../js/trait-engine.js");
await import("../js/trait-catalog-core.js");
await import("../js/universal-modifier-engine.js");
await import("../js/class-status-semantics.js");
await import("../js/barbarian-class-runtime.js");

const engine = globalThis.LuminousTraitEngine;
const catalog = globalThis.LuminousTraitCatalogCore;
const modifiers = globalThis.LuminousUniversalModifiers;
const statusLibrary = globalThis.LuminousStatusLibrary;
const runtime = globalThis.LuminousBarbarianClassRuntime;

assert.ok(engine, "Trait Engine should install");
assert.ok(catalog, "Trait catalog should install");
assert.ok(modifiers, "Universal modifier engine should install");
assert.ok(runtime, "Barbarian runtime should install");
assert.equal(statusLibrary.has("rage"), true, "Rage remains a canonical visible Status for Barbarian and Zealot hooks");

const makeBarbarian = (level, strength = 18, constitution = 18) => ({
  id: `barbarian_${level}_${strength}_${constitution}`,
  level,
  classes: [{ id: "barbarian", level }],
  stats: { fuerza: strength, constitucion: constitution, destreza: 14 },
  hp: 200,
  maxHp: 200,
  sp: 0,
  shield: 0,
  staggerThresholds: [75, 50, 25],
  statusEffects: {},
});

const traitsAt = (character) =>
  engine.resolveTraitGrants(character, catalog.allGrants(), catalog.allDefinitions());

const expectedGrants = [
  [1, "armorless_defense"],
  [1, "rage"],
  [10, "reckless_attack"],
  [10, "danger_senses"],
  [25, "additional_attack"],
  [25, "fast_movement"],
  [35, "wild_instincts"],
  [45, "brutal_critical"],
  [55, "unstoppable_rage"],
  [75, "persistent_rage"],
  [90, "unstoppable_strength"],
  [100, "primordial_champion"],
];

for (const [level, traitId] of expectedGrants) {
  const granted = traitsAt(makeBarbarian(level));
  assert.ok(granted.some((trait) => trait.id === traitId), `Barbarian Lv${level} should receive ${traitId}`);
  if (level > 1) {
    const before = traitsAt(makeBarbarian(level - 1));
    assert.equal(before.some((trait) => trait.id === traitId), false, `${traitId} must not exist before Lv${level}`);
  }
}

// Armorless Defense starts at Lv1 and uses the rewritten defensive formula.
let character = makeBarbarian(1, 18, 18);
let traits = traitsAt(character);
let resolved = modifiers.resolveTraitModifiers({
  unit: character,
  character,
  traits,
  equipment: { armorEquipped: false, armorCategory: "none" },
  context: "combat",
});
assert.equal(resolved.defensive_level, 2, "CON 18 gives +2 Defensive Level from max(1, CON Mod / 2)");

const lowCon = makeBarbarian(1, 18, 10);
resolved = modifiers.resolveTraitModifiers({
  unit: lowCon,
  character: lowCon,
  traits: traitsAt(lowCon),
  equipment: { armorEquipped: false, armorCategory: "none" },
  context: "combat",
});
assert.equal(resolved.defensive_level, 1, "Armorless Defense has a minimum +1 Defensive Level");

// Rage keeps the existing Class-Level use pool, uses the new continuous damage curve,
// and Armorless Defense grants its Shield only the first time Rage is entered in an Encounter.
character = makeBarbarian(50);
traits = traitsAt(character);
let state = engine.createState();
const equipment = { armorEquipped: false, armorCategory: "none" };
state = engine.dispatchCombatEvent("encounter_start", {
  character,
  self: character,
  traits,
  state,
  equipment,
}).state;

const rage = traits.find((trait) => trait.id === "rage");
assert.ok(rage);
let economy = { quick_action: 1 };
let activation = engine.activateTrait(rage, {
  context: "combat",
  character,
  self: character,
  traits,
  equipment,
  actionEconomy: economy,
}, state);
state = activation.state;
assert.equal(activation.available, true);
assert.equal(activation.maximum, 7, "Lv50 Rage keeps max(1, floor(ClassLevel / 7)) uses");
assert.equal(character.shield, 60, "Lv50 Armorless Defense grants ClassLevel * 1.2 = 60 Shield on first Rage");
assert.equal(state.flags.armorless_defense_shield_used, true);

resolved = modifiers.resolveTraitModifiers({
  unit: character,
  character,
  traits,
  traitState: state,
  equipment,
  skill: { type: "Normal", skillFamily: "attack", attackMode: "melee", damageType: "Slash" },
  context: "combat",
});
assert.equal(resolved.damage_dealt_multiplier, 3, "Lv50 Rage adds +30% Damage");
assert.equal(resolved.damage_taken_multiplier, 5, "Rage reduces Slash/Pierce/Blunt Damage by 50%");

// Re-entering Rage in the same Encounter must not duplicate the Armorless Shield.
delete state.statuses.rage;
economy = { quick_action: 1 };
activation = engine.activateTrait(rage, {
  context: "combat",
  character,
  self: character,
  traits,
  equipment,
  actionEconomy: economy,
}, state);
state = activation.state;
assert.equal(activation.available, true);
assert.equal(character.shield, 60, "Armorless Rage Shield is once per Encounter");

// Rage no longer grants the removed Wrath-specific Final Power bonus.
resolved = modifiers.resolveTraitModifiers({
  unit: character,
  character,
  traits,
  traitState: state,
  equipment,
  skill: { type: "Normal", skillFamily: "attack", attackMode: "melee", affinity: "Wrath" },
  context: "combat",
});
assert.equal(resolved.final_power, 0, "Rage must not add the removed Wrath Final Power");

// Reckless Attack uses internal flags: +3 Final Power, +10% Damage only when Unopposed,
// one Fragile on hit, and +20% Unopposed incoming Damage until Turn End.
character = makeBarbarian(10);
traits = traitsAt(character);
state = engine.createState();
const reckless = traits.find((trait) => trait.id === "reckless_attack");
assert.ok(reckless);
activation = engine.activateTrait(reckless, {
  context: "combat",
  character,
  self: character,
  actionEconomy: { quick_action: 1 },
}, state);
state = activation.state;
assert.equal(state.flags.reckless_attack_armed, true);
assert.equal(state.flags.reckless_attack_vulnerable, true);

const meleeSkill = { type: "Normal", skillFamily: "attack", attackMode: "melee", isMelee: true, coins: [{}, {}] };
resolved = modifiers.resolveTraitModifiers({
  unit: character,
  character,
  traits,
  traitState: state,
  skill: meleeSkill,
  context: "combat",
});
assert.equal(resolved.final_power, 3);
assert.equal(resolved.damage_dealt_multiplier, 0, "Reckless +10% Damage requires an Unopposed resolution");

meleeSkill.__luminousUnopposed = true;
resolved = modifiers.resolveTraitModifiers({
  unit: character,
  character,
  traits,
  traitState: state,
  skill: meleeSkill,
  context: "combat",
});
assert.equal(resolved.final_power, 3);
assert.equal(resolved.damage_dealt_multiplier, 1, "Reckless Unopposed attack adds +10% Damage");
assert.equal(resolved.damage_taken_multiplier, -2, "Reckless vulnerability makes Unopposed incoming Damage +20%");

state = engine.dispatchCombatEvent("on_hit", {
  character,
  self: character,
  traits,
  state,
  skill: meleeSkill,
}).state;
assert.equal(state.statuses.fragile?.count, 1);
state = engine.dispatchCombatEvent("on_hit", {
  character,
  self: character,
  traits,
  state,
  skill: meleeSkill,
}).state;
assert.equal(state.statuses.fragile?.count, 1, "Reckless grants Fragile only once for the enhanced Skill");

state = engine.dispatchCombatEvent("attack_end", {
  character,
  self: character,
  traits,
  state,
  skill: meleeSkill,
}).state;
assert.equal(Boolean(state.flags.reckless_attack_armed), false);
assert.equal(state.flags.reckless_attack_vulnerable, true, "Reckless vulnerability remains until Turn End");

state = engine.dispatchCombatEvent("turn_end", {
  character,
  self: character,
  traits,
  state,
  skill: meleeSkill,
}).state;
assert.equal(Boolean(state.flags.reckless_attack_vulnerable), false);
assert.equal(state.statuses.fragile, undefined, "Reckless Fragile must expire from Trait state at Turn End");

// Danger Sense is Save-specific: +4 Dexterity Save Power, not all Dexterity Checks.
character = makeBarbarian(10);
traits = traitsAt(character);
let theatre = engine.resolveTheatreCheck({
  character,
  traits,
  check: { abilityId: "dex", kind: "save", finalPower: 0 },
});
assert.equal(theatre.check.finalPower, 4);
theatre = engine.resolveTheatreCheck({
  character,
  traits,
  check: { abilityId: "dex", kind: "ability", finalPower: 0 },
});
assert.equal(theatre.check.finalPower, 0);

resolved = modifiers.resolveTraitModifiers({
  unit: character,
  character,
  traits,
  skill: { type: "Save", statUsed: "DEX" },
  context: "combat",
});
assert.equal(resolved.final_power, 4, "Combat Dexterity Saves gain +4 Final Power");

// Additional Attack remains the shared 2-3 Coin Melee reuse mechanic.
character = makeBarbarian(25);
traits = traitsAt(character);
let skill = {
  type: "Normal",
  skillFamily: "attack",
  attackMode: "melee",
  isMelee: true,
  coinAmount: 3,
  coins: [{ id: "c1" }, { id: "c2" }, { id: "c3" }],
};
engine.dispatchCombatEvent("before_skill", {
  character,
  self: character,
  traits,
  state: engine.createState(),
  skill,
});
assert.equal(skill.coins.length, 4);
assert.equal(skill.coins.at(-1).id, "c3");

// Fast Movement is disabled only by Heavy Armor.
resolved = modifiers.resolveTraitModifiers({
  unit: character,
  character,
  traits,
  equipment: { armorEquipped: false, armorCategory: "none" },
  context: "combat",
});
assert.equal(resolved.min_speed, 1);
resolved = modifiers.resolveTraitModifiers({
  unit: character,
  character,
  traits,
  equipment: { armorEquipped: true, armorCategory: "heavy" },
  context: "combat",
});
assert.equal(resolved.min_speed, 0);

// Wild Instincts is an Encounter Start trigger, but Haste itself lasts only this Turn.
character = makeBarbarian(35, 18, 18);
traits = traitsAt(character);
state = engine.dispatchCombatEvent("encounter_start", {
  character,
  self: character,
  traits,
  state: engine.createState(),
}).state;
assert.equal(state.statuses.haste?.count, 4);
assert.equal(state.statuses.haste?.duration, "this_turn");
state = engine.dispatchCombatEvent("turn_end", {
  character,
  self: character,
  traits,
  state,
}).state;
assert.equal(state.statuses.haste, undefined, "Wild Instincts Haste must expire from Trait state at Turn End");

const weakBarbarian = makeBarbarian(35, 8, 18);
state = engine.dispatchCombatEvent("encounter_start", {
  character: weakBarbarian,
  self: weakBarbarian,
  traits: traitsAt(weakBarbarian),
  state: engine.createState(),
}).state;
assert.equal(state.statuses.haste?.count, 1, "Wild Instincts always grants at least 1 Haste");

// Late-game traits are evaluated at the level they are actually granted.
character = makeBarbarian(45);
traits = traitsAt(character);
const brutalSnapshot = modifiers.resolveCharacterSnapshot({
  unit: character,
  character,
  traits,
  context: "combat",
});
assert.equal(brutalSnapshot.critDamagePercent, 22, "Brutal Critical enters at +22% Crit Damage on Lv45");

const unstoppable = catalog.getDefinition("unstoppable_rage");
let variables = engine.buildVariables(makeBarbarian(55), {}, unstoppable);
assert.equal(engine.evaluateFormula("floor(ClassLevel / 3)", variables), 18, "Unstoppable Rage enters at 18% HP recovery on Lv55");

character = makeBarbarian(100, 20, 20);
traits = traitsAt(character);
const stats = modifiers.resolveStats({ unit: character, character, traits, context: "any" });
assert.equal(stats.stats.fuerza, 24);
assert.equal(stats.stats.constitucion, 24);
assert.equal(stats.statCaps.strength, 24);
assert.equal(stats.statCaps.constitution, 24);

assert.equal(catalog.validateAll(engine).valid, true, "Barbarian rewrites must keep the canonical Trait catalog valid");

console.log("Barbarian class runtime smoke passed: real Lv1-Lv100 grants, Rage, Armorless Defense, Reckless Attack, Danger Sense, Additional Attack, Fast Movement, Wild Instincts, and late-game scaling verified.");
