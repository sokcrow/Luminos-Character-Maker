import assert from "node:assert/strict";

const g = globalThis;
const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
function fighterLevel(character = {}) {
  const classes = Array.isArray(character.classes) ? character.classes : character.characterBuild?.classes || [];
  const found = classes.find((entry) => normalizeId(entry.id || entry.classId || entry.name) === "fighter");
  return Number(found?.level ?? found?.levels ?? 0);
}
function isBattleMaster(character = {}) {
  const raw = character.characterBuild?.archetypes || character.archetypes || [];
  return raw.some((entry) => normalizeId(entry.classId) === "fighter" && normalizeId(entry.archetypeId || entry.id) === "battle_master");
}

g.LuminousArchetypeEngine = {
  getClassLevel(character, classId) { return normalizeId(classId) === "fighter" ? fighterLevel(character) : 0; },
  isSelected(character, archetypeId, classId) { return normalizeId(archetypeId) === "battle_master" && normalizeId(classId) === "fighter" && isBattleMaster(character); },
  resolveTraitGrants(character, grants = [], definitions = {}) {
    if (!isBattleMaster(character)) return [];
    const level = fighterLevel(character);
    return grants.filter((grant) => level >= Number(grant.atLevel || 0)).map((grant) => ({ ...clone(definitions[grant.traitId]), source: { ...(definitions[grant.traitId]?.source || {}), ...(grant.source || {}) } })).filter((trait) => trait.id);
  },
};
g.LuminousArchetypeTraitCatalog = { ARCHETYPES: {}, DEFINITIONS: {}, GRANTS: [], allArchetypes() { return {}; }, allDefinitions() { return {}; }, allGrants() { return []; }, getDefinition() { return null; }, resolveTraitGrants() { return []; } };
g.LuminousTraitCatalogCore = { allDefinitions() { return {}; }, allGrants() { return []; }, getDefinition() { return null; } };
g.LuminousTraitEngine = { resolveTraitGrants() { return []; }, normalizeTrait(trait) { return clone(trait); } };
g.LuminousArchetypeRuntime = { syncArchetypeTraitsForUnit() { return []; } };

await import("../js/fighter-maneuver-catalog.js");
await import("../js/battle-master-archetype-runtime.js");
await import("../js/combat-analyze-check-contract.js");
const runtime = g.LuminousBattleMasterArchetypeRuntime;
assert.ok(runtime, "Battle Master archetype runtime should install");
assert.equal(runtime.ARCHETYPE_ID, "battle_master");
assert.equal(runtime.CLASS_ID, "fighter");
assert.equal(g.LuminousArchetypeTraitCatalog.allArchetypes().battle_master.name, "Battle Master");
assert.equal(g.LuminousFighterManeuverCatalog.list().length, 23, "Fighter Maneuver list contains all 23 Maneuvers");
assert.equal(g.LuminousFighterManeuverCatalog.get("Brace").mechanics.unopposed, false, "Brace is not Unopposed");
assert.equal(g.LuminousFighterManeuverCatalog.get("Quick Toss").mechanics.unopposed, true, "Quick Toss is Unopposed");

const makeCharacter = (level, extra = {}) => ({ id: `fighter_${level}`, hp: 100, maxHp: 100, classes: [{ id: "fighter", level }], characterBuild: { archetypes: [{ classId: "fighter", archetypeId: "battle_master" }] }, ...extra });
const traits15 = g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(15));
assert.deepEqual(traits15.map((trait) => trait.id).sort(), ["combat_superiority", "student_of_war"].sort());
assert.ok(g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(35)).some((trait) => trait.id === "know_your_enemy"));
const traits90 = g.LuminousArchetypeTraitCatalog.resolveTraitGrants(makeCharacter(90));
assert.deepEqual(traits90.map((trait) => trait.id).sort(), ["combat_superiority", "student_of_war", "know_your_enemy", "combat_superiority_plus", "relentless", "combat_superiority_plus_plus"].sort());

assert.deepEqual(runtime.combatSuperiorityProfile(makeCharacter(15)), { tier: 0, name: "Combat Superiority", clashWinGain: 3, onHitGain: 1, damageCap: 0.10, battleMasterManeuvers: 3 });
assert.deepEqual(runtime.combatSuperiorityProfile(makeCharacter(50)), { tier: 1, name: "Combat Superiority+", clashWinGain: 4, onHitGain: 2, damageCap: 0.15, battleMasterManeuvers: 4 });
assert.deepEqual(runtime.combatSuperiorityProfile(makeCharacter(90)), { tier: 2, name: "Combat Superiority++", clashWinGain: 5, onHitGain: 3, damageCap: 0.20, battleMasterManeuvers: 5 });
assert.equal(runtime.superiorityGain(makeCharacter(90), "clash_win"), 5);
assert.equal(runtime.superiorityGain(makeCharacter(90), "on_hit"), 3);
assert.equal(runtime.maneuverCapacity(makeCharacter(50)), 4);
assert.equal(runtime.maneuverCapacity(makeCharacter(50, { traits: [{ id: "superior_technique" }] })), 5, "Superior Technique remains an extra Maneuver");

const relentless = makeCharacter(90, { hp: 25, maxHp: 100 });
assert.equal(runtime.relentlessActive(relentless), true);
assert.equal(runtime.maneuverEffectMultiplier(relentless), 2);
assert.equal(runtime.maneuverDamageCap(relentless), 0.40, "Relentless doubles the 20% cap to 40%");
assert.equal(runtime.maneuverDamageCap(makeCharacter(90, { hp: 26, maxHp: 100 })), 0.20);

assert.equal(runtime.knowYourEnemyUnlockDue(makeCharacter(35), 9), false);
assert.equal(runtime.knowYourEnemyUnlockDue(makeCharacter(35), 10), true);
assert.deepEqual(runtime.knowYourEnemyRequest(makeCharacter(35), 10, "kobold"), { type: "analyse_feature_unlock", sourceTraitId: "know_your_enemy", enemyType: "kobold", unlockFeatures: 1, bypassAnalyseCheck: true, advanceObservationLevel: true, useExistingObservationTarget: true });
const analyzeContract = g.LuminousCombatAnalyzeCheckContract;
const knowEnemyAnalyze = analyzeContract.resolveAnalyzeContract(makeCharacter(35), { species: "kobold" }, { turnNumber: 10, observedEnemyType: "kobold", threshold: 15 });
assert.equal(knowEnemyAnalyze.type, "automatic");
assert.equal(knowEnemyAnalyze.bypassCheck, true);
assert.equal(knowEnemyAnalyze.sourceTraitId, "know_your_enemy");
const normalAnalyze = analyzeContract.resolveAnalyzeContract(makeCharacter(35), { species: "kobold" }, { turnNumber: 9, observedEnemyType: "kobold", threshold: 15 });
assert.equal(normalAnalyze.type, "check");
assert.deepEqual(normalAnalyze.check, { stat: "wis", skill: "perception", threshold: 15 });
assert.match(g.LuminousArchetypeTraitCatalog.getDefinition("know_your_enemy").description, /Analyse Check/);


// Integration: percentage Damage bonuses from every learned Maneuver stack per
// Superiority Count but stop at the single Combat Superiority damage cap.
const engine = {
  currentClashWinner: "A",
  calculateCoinDamage(attacker, defender, skill, power, critical, count, context) {
    const pct = (context?.currentCoin?.effects || [])
      .filter((effect) => effect.type === "percentage_damage")
      .reduce((sum, effect) => sum + Number(effect.potency || 0), 0);
    return Math.floor(power * (1 + pct / 100) + 1e-9);
  },
  resolveStandardClash(unitA, skillA, unitB, skillB) {
    const winner = this.currentClashWinner;
    // The standard Clash emits the event; the winning attack also emits it
    // for every Coin. The Count grant must not be duplicated.
    this.triggerEvent("[On Clash Win]", { attacker: winner === "A" ? unitA : unitB, skill: winner === "A" ? skillA : skillB });
    return { winner };
  },
  triggerEvent() { return null; },
  triggerEncounterStart(units) { return units; },
};
g.CombatEngine = engine;
assert.equal(runtime.patchCombatEngine(), true);
assert.equal(runtime.patchCombatEngine(), true, "Installation is idempotent");

const three = makeCharacter(15);
three.characterBuild.maneuvers = { battle_master: ["disarming_attack", "distracting_attack", "feinting_attack"] };
runtime.setSuperiorityCount(three, 1);
assert.equal(runtime.maneuverDamageBonus(three), 0.03, "Three +1% Maneuvers provide +3% per Count");
assert.equal(engine.calculateCoinDamage(three, {}, {}, 100, false, 0), 103);
runtime.setSuperiorityCount(three, 3);
assert.equal(engine.calculateCoinDamage(three, {}, {}, 100, false, 0), 109, "Three Count produce +9%");
runtime.setSuperiorityCount(three, 4);
assert.equal(engine.calculateCoinDamage(three, {}, {}, 100, false, 0), 110, "Fighter 15 caps combined bonus at +10%");

// Existing Coin percentage effects must survive, without mutating the source
// context or accidentally accumulating additional synthetic Coin effects.
const baseContext = { currentCoin: { effects: [{ type: "percentage_damage", potency: 5 }] } };
assert.equal(engine.calculateCoinDamage(three, {}, {}, 100, false, 0, baseContext), 115);
assert.equal(engine.calculateCoinDamage(three, {}, {}, 100, false, 0, baseContext), 115);
assert.equal(baseContext.currentCoin.effects.length, 1);

const four = makeCharacter(50);
four.characterBuild.maneuvers = { battle_master: ["disarming_attack", "distracting_attack", "feinting_attack"] };
runtime.setSuperiorityCount(four, 5);
assert.equal(engine.calculateCoinDamage(four, {}, {}, 100, false, 0), 115, "Fighter 50 has a +15% shared cap");
const five = makeCharacter(90);
five.characterBuild.maneuvers = { battle_master: ["disarming_attack", "distracting_attack", "feinting_attack"] };
runtime.setSuperiorityCount(five, 7);
assert.equal(engine.calculateCoinDamage(five, {}, {}, 100, false, 0), 120, "Fighter 90 has a +20% shared cap");
five.hp = 25;
assert.equal(engine.calculateCoinDamage(five, {}, {}, 100, false, 0), 140, "Relentless doubles the bonuses and cap");
five.hp = 26;
assert.equal(engine.calculateCoinDamage(five, {}, {}, 100, false, 0), 120, "Relentless ends above 25% Max HP");

// A +2%-per-Count Maneuver adds its own rate; duplicates don't count twice.
const precision = makeCharacter(15);
precision.characterBuild.maneuvers = { battle_master: ["precision_attack", "disarming_attack", "disarming_attack"] };
runtime.setSuperiorityCount(precision, 2);
assert.equal(engine.calculateCoinDamage(precision, {}, {}, 100, false, 0), 106);
const empty = makeCharacter(15);
runtime.setSuperiorityCount(empty, 10);
assert.equal(engine.calculateCoinDamage(empty, {}, {}, 100, false, 0), 100, "Unlearned Maneuvers give no damage");
const foreign = { ...three, characterBuild: { ...three.characterBuild, archetypes: [] } };
assert.equal(engine.calculateCoinDamage(foreign, {}, {}, 100, false, 0), 100, "Other archetypes gain no bonus");

engine.triggerEncounterStart([three]);
assert.equal(runtime.superiorityCount(three), 0, "Superiority resets at encounter start");
engine.resolveStandardClash(three, {}, {}, {});
assert.equal(runtime.superiorityCount(three), 3, "Clash Win awards one +3 grant");
engine.triggerEvent("[On Clash Win]", { attacker: three });
engine.triggerEvent("[On Clash Win]", { attacker: three });
assert.equal(runtime.superiorityCount(three), 3, "Repeated per-Coin Clash Win hooks never duplicate the grant");
engine.triggerEvent("[On Hit]", { attacker: three });
assert.equal(runtime.superiorityCount(three), 4, "On Hit awards +1 after damage");
assert.equal(engine.calculateCoinDamage(three, {}, {}, 100, false, 0), 110);
runtime.setSuperiorityCount(four, 0);
engine.triggerEvent("[On Hit]", { attacker: four });
assert.equal(runtime.superiorityCount(four), 2, "Combat Superiority+ gains +2 On Hit");

console.log("Battle Master archetype smoke passed.");
