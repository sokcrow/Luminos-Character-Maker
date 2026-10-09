"use strict";
const assert = require("node:assert/strict");
require("../js/trait-engine.js");
require("../js/universal-modifier-engine.js");
require("../js/general-trait-catalog.js");
require("../js/weapon-property-runtime.js");
require("../js/character-build-rules.js");
require("../js/rest-engine.js");

const engine = globalThis.LuminousTraitEngine;
const catalog = globalThis.LuminousGeneralTraitCatalog;
const modifiers = globalThis.LuminousUniversalModifiers;
const weapons = globalThis.LuminousWeaponPropertyRuntime;
const rest = globalThis.LuminousRestEngine;

assert.equal(catalog.FEAT_IDS.length, 14);
assert.equal(Object.keys(catalog.DEFINITIONS).length, 21);
assert.deepEqual(catalog.allGrants(), []);
for (const trait of Object.values(catalog.DEFINITIONS)) {
  const result = engine.validateTrait(trait);
  assert.equal(result.valid, true, trait.id + ": " + result.errors.join("; "));
  assert.equal(trait.category, "general");
  assert.equal(trait.source.type, "general");
}
const actor = catalog.getDefinition("actor");
assert.notStrictEqual(actor, catalog.getDefinition("actor"));
const imp = engine.resolveTheatreCheck({
  character: { stats: { carisma: 12 } }, traits: [actor],
  check: { kind: "skill", skillId: "deception", tags: ["impersonation"], difficulty: 18 },
}).check;
assert.equal(imp.difficulty, 14);
assert.equal(engine.resolveTheatreCheck({
  character: {}, traits: [actor],
  check: { skillId: "deception", tags: [], difficulty: 18 },
}).check.difficulty, 18);

for (const [skillId, tag] of [["perception", "trap"], ["investigation", "secret_door"]]) {
  const result = engine.resolveTheatreCheck({ character: {}, traits: [catalog.getDefinition("dungeon_delver")], check: { skillId, tags: [tag], difficulty: 17 }});
  assert.equal(result.check.difficulty, 13);
}
const noTrap = engine.resolveTheatreCheck({
  character: {}, traits: [catalog.getDefinition("dungeon_delver")],
  check: { skillId: "survival", tags: [], difficulty: 17 },
});
assert.equal(noTrap.check.difficulty, 17);

const stats = modifiers.resolveStats({ character: { stats: { carisma: 14, constitucion: 13 } }, traits: [actor, catalog.getDefinition("durable")] });
assert.equal(stats.stats.carisma, 15);
assert.equal(stats.stats.constitucion, 14);
assert.equal(Object.hasOwn(stats.stats, "charisma"), false);

const fast = { level: 10, speed: 6 };
const slower = { level: 10, speed: 4 };
function chargerAgainst(target, attackMode) {
  return modifiers.resolveTraitModifiers({ unit: fast, character: fast, target, skill: { type: "Normal", attackMode }, traits: [catalog.getDefinition("charger")] }).damage_dealt_multiplier;
}
assert.equal(chargerAgainst(slower, "melee"), 0.5);
assert.equal(chargerAgainst({ speed: 6 }, "melee"), 0);
assert.equal(chargerAgainst(slower, "ranged"), 0);

const blade = { category: "weapon", classification: "martial_melee", equipment: { handCost: 1 } };
const hand = { mainHand: blade, offHand: blade };
const wielding = { equipment: hand };
assert.equal(modifiers.resolveTraitModifiers({
  unit: wielding, character: wielding, traits: [catalog.getDefinition("dual_wielder")],
}).defensive_level, 1);
assert.equal(modifiers.resolveTraitModifiers({
  unit: { equipment: { mainHand: blade } }, traits: [catalog.getDefinition("dual_wielder")],
}).defensive_level, 0);
assert.equal(weapons.lightCoinDamagePercent({ mainHand: blade, offHand: blade, coinIndex: 2, traits: [catalog.getDefinition("dual_wielder")] }), 5);
assert.equal(weapons.lightCoinDamagePercent({ mainHand: blade, offHand: blade, coinIndex: 1, traits: [catalog.getDefinition("dual_wielder")] }), 0);
assert.equal(weapons.lightCoinDamagePercent({ mainHand: blade, offHand: blade, coinIndex: 2 }), 0);
assert.equal(weapons.lightCoinDamagePercent({ mainHand: { ...blade, properties: ["light"] }, offHand: { ...blade, properties: ["light"] }, coinIndex: 2, traits: [catalog.getDefinition("dual_wielder")] }), 5);

const wrath = catalog.getDefinition("elemental_adept_wrath");
assert.equal(modifiers.resolveTraitModifiers({ unit: {}, traits: [wrath], skill: { type: "Spell", sinAffinity: "wrath" } }).damage_dealt_multiplier, 0.5);
assert.equal(modifiers.resolveTraitModifiers({ unit: {}, traits: [wrath], skill: { type: "Spell", sinAffinity: "gloom" } }).damage_dealt_multiplier, 0);

for (const id of ["defensive_duelist", "grappler"]) {
  const state = engine.createState();
  assert.equal(engine.canActivateTrait(catalog.getDefinition(id), { context: "combat", character: {}, self: {} }, state).available, false,
    id + " must not consume combat actions until its specialized action resolver is installed");
}

const character = { level: 5, characterBuild: { classes: [{ classId: "fighter", levels: 5 }] }, stats: { constitucion: 14 }, hp: 1, maxHp: 100 };
const recovered = rest.performRecover(character, "fighter", 1, { traits: [catalog.getDefinition("durable")] });
assert.equal(recovered.success, true);
assert.equal(recovered.recoverTraitBonusHp, 4);
assert.equal(recovered.flatHp, 5 + recovered.classBaseHp + 4);
assert.equal(rest.performRecover({level:5, characterBuild: {classes:[{classId:"fighter",levels:5}]},stats:{constitucion:14},hp:1,maxHp:100}, "fighter", 1, { traits: [] }).recoverTraitBonusHp, 0);
console.log("General Traits 1-14: catalog, checks, modifiers and Recover smoke OK");
