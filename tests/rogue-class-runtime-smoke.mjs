import assert from "node:assert/strict";

const realSetInterval = globalThis.setInterval;
globalThis.setInterval = () => 0;

globalThis.LuminousTraitCatalogCore = {
  CATALOG_VERSION: 4,
  DEFINITIONS: {},
  GRANTS: [],
  allDefinitions() { return {}; },
  allGrants() { return []; },
  getDefinition() { return null; },
};

globalThis.LuminousTraitEngine = {
  getClassLevel(character, classId) {
    return Number((character.classes || []).find((entry) => (entry.classId || entry.id) === classId)?.levels ?? (character.classes || []).find((entry) => (entry.classId || entry.id) === classId)?.level ?? 0);
  },
  resolveTheatreCheck(input = {}) { return { check: { ...(input.check || {}) }, state: input.state || {}, outcomes: [] }; },
  activateTrait(trait, runtime = {}) { return { available: true, trait, runtime, outcomes: [] }; },
};

globalThis.LuminousActionEconomy = {
  consume(unit, cost) {
    if (cost === "reaction") {
      if (unit.reactionSpent) return false;
      unit.reactionSpent = true;
      return true;
    }
    if (cost === "quick_action") {
      if (unit.quickSpent) return false;
      unit.quickSpent = true;
      return true;
    }
    return true;
  },
};

globalThis.LuminousLanguageCatalog = {
  list() { return [{ languageId: "common", definition: { nombre: "Común", universal: true } }]; },
  get(id) { return id === "common" ? { nombre: "Común", universal: true } : null; },
};

globalThis.LuminousCharacterManager = {
  listLanguages() { return [{ languageId: "common", language: { nombre: "Común", universal: true } }]; },
};

let armedCheck = null;
globalThis.LuminousTheatreRolls = {
  armCheck(check) { armedCheck = { ...check }; return armedCheck; },
  async publishRoll(payload) { return { published: true, outcome: payload.outcome }; },
};

function rogue(level, extra = {}) {
  return { id: `rogue-${level}`, classes: [{ classId: "rogue", levels: level }], hp: 500, maxHp: 500, sp: 0, maxSp: 45, statusEffects: {}, abilityProficiency: { dex: "proficient" }, ...extra };
}

globalThis.datosJugador = rogue(100);

globalThis.CombatEngine = {
  currentState: "COMBAT_ACTIVE",
  initializeUnitData() {},
  getCoinProbability(sp) { return Math.max(5, Math.min(95, 50 + Number(sp || 0))); },
  applyPassiveModifiers(unit) {
    const result = { damage_dealt_multiplier: 0, damage_taken_multiplier: 0, defense_power: 0, clash_power: 0 };
    if (unit.statusEffects?.invisible) result.clash_power += 9;
    return result;
  },
  calculateFinalPower(skill) { return Number(skill.basePower || 0); },
  calculateCoinDamage(attacker, defender, skill, coinPower) { return Number(coinPower || 0); },
  resolveUnilateralWithCounter(attacker, skill, defender, counter, options = {}) {
    const damage = this.calculateCoinDamage(attacker, defender, skill, 100, false, 0, { attacker, defender, skill });
    defender.hp -= damage;
    return { damageTaken: damage, options };
  },
  resolveStandardClash(a, sa, b, sb) {
    const ma = this.applyPassiveModifiers(a, { skill: sa });
    const mb = this.applyPassiveModifiers(b, { skill: sb });
    return { powerA: this.calculateFinalPower(sa, [], a) + ma.clash_power, powerB: this.calculateFinalPower(sb, [], b) + mb.clash_power };
  },
  resolveEvade(defender, evadeSkill, attacker, attackSkill) {
    return { evadePower: this.calculateFinalPower(evadeSkill, [], defender), attackPower: this.calculateFinalPower(attackSkill, [], attacker) };
  },
  resolveGuard(defender) { return { probability: this.getCoinProbability(defender.sp || 0) }; },
  resolveSpell(spellSkill) { return { dc: spellSkill.saveDC || 10, savePower: 5, isSuccess: false, winner: "Caster" }; },
  processStatusEffects(unit, trigger) { if (trigger === "lose_sp") unit.sp -= 8; return unit; },
  triggerEvent() {},
};

globalThis.LuminousCombatActionResolver = {
  resolveCombatAction(input, context = {}) {
    const actor = context.actor;
    const targets = context.targets || [];
    const skill = { type: "Normal", attackKind: "melee", attackWeight: input.targeting?.attackWeight || 1 };
    return { resolved: true, results: targets.map((target) => globalThis.CombatEngine.resolveUnilateralWithCounter(actor, { ...skill }, target, null, { clashResult: null })) };
  },
  resolvePreparedUnopposed(action, actor, targets) {
    return { resolved: true, results: targets.map((target) => globalThis.CombatEngine.resolveUnilateralWithCounter(actor, { type: "Normal", attackKind: "melee", attackWeight: action.targeting?.attackWeight || 1 }, target, null, { clashResult: null })) };
  },
};

await import("../js/rogue-class-runtime.js");
const rogueRuntime = globalThis.LuminousRogueClassRuntime;
assert.ok(rogueRuntime, "Rogue class runtime should install");
assert.equal(rogueRuntime.expertiseChoiceCount(rogue(1)), 2);
assert.equal(rogueRuntime.expertiseChoiceCount(rogue(30)), 4);
const expertiseCharacter = rogue(30);
assert.equal(rogueRuntime.applyExpertiseChoices(expertiseCharacter, ["dex", "stealth", "perception", "int"]).success, true);
assert.equal(expertiseCharacter.skillProficiency.stealth, "expertise");
assert.equal(rogueRuntime.sneakAttackPercent(rogue(1)), 1);
assert.equal(rogueRuntime.sneakAttackPercent(rogue(100)), 50);
assert.equal(rogueRuntime.applySneakAttackDamage(100, { character: rogue(100), skill: { type: "Normal", attackKind: "range" }, unopposed: true }), 150);
assert.equal(rogueRuntime.applySneakAttackDamage(100, { character: rogue(100), skill: { type: "Spell", attackKind: "range" }, unopposed: true }), 100);
assert.equal(rogueRuntime.cunningActionBonuses(rogue(40)).maxSpeed, 2);
assert.equal(rogueRuntime.cunningActionBonuses(rogue(40)).defensePower, 4);
const retreater = rogue(10);
assert.equal(rogueRuntime.useQuickRetreat(retreater).success, true);
assert.equal(retreater.quickSpent, true);
const uncanny = rogue(25);
assert.equal(rogueRuntime.armUncannyDodge(uncanny).success, true);
assert.equal(rogueRuntime.applyIncomingSkillDamage(uncanny, 100).damage, 50);
assert.equal(rogueRuntime.applyIncomingSkillDamage(uncanny, 100).damage, 100, "Uncanny Dodge must only affect the next Skill");
const nimble = rogue(35);
assert.equal(rogueRuntime.applyIncomingSkillDamage(nimble, 100, { attackWeight: 2, isSecondaryTarget: true }).damage, 75);
assert.equal(rogueRuntime.applyIncomingSkillDamage(nimble, 100, { attackWeight: 2, isSecondaryTarget: false }).damage, 100);
nimble.sp = 10;
assert.equal(rogueRuntime.onEvaded(nimble).after, 12);
assert.equal(rogueRuntime.reliableTalentFinalPower(rogue(55), { abilityId: "dex" }), 3);
assert.equal(rogueRuntime.blindsenseSuppressesInvisibleBuffs(rogue(70), { statusEffects: { invisible: {} } }), true);
assert.equal(rogueRuntime.finalSavePowerBonus(rogue(75), { statuses: ["frightened"] }), 6);
assert.equal(rogueRuntime.applyIncomingSkillDamage(rogue(75), 100, { damageType: "sinking" }).damage, 70);
assert.equal(rogueRuntime.reduceSpLoss(rogue(75), 8), 5);
assert.equal(rogueRuntime.elusiveEvadePower(rogue(90), { hasPositiveStatus: true }), 15);
assert.equal(rogueRuntime.elusiveClashPower(rogue(90), { powerBuff: 4 }), 4);
assert.equal(rogueRuntime.headsProbabilityBonus(rogue(100)), 0.05);
let attempts = 0;
const retried = rogueRuntime.resolveTheatreCheck(rogue(100), { abilityId: "dex" }, () => ({ success: ++attempts > 1 }));
assert.equal(retried.attempts, 2);
assert.equal(retried.retried, true);
assert.equal(rogueRuntime.hasThievesCant(rogue(1)), true);
assert.equal(rogueRuntime.hasThievesCant({ classes: [] }), false);

await import("../js/rogue-combat-runtime.js");
const combatRuntime = globalThis.LuminousRogueCombatRuntime;
assert.ok(combatRuntime, "Rogue combat runtime should install");
const attacker = rogue(100);
const targetA = { hp: 500, sp: 0, statusEffects: {} };
const targetB = rogue(35);
targetB.__luminousRogueUncannyDodge = true;
const multi = globalThis.LuminousCombatActionResolver.resolveCombatAction(
  { resolution: { type: "unopposed" }, targeting: { attackWeight: 2 } },
  { actor: attacker, targets: [targetA, targetB] },
);
assert.equal(multi.results[0].damageTaken, 150, "Sneak Attack should apply through CombatEngine");
assert.equal(multi.results[1].damageTaken, 56.25, "Secondary target should combine Uncanny Dodge and Nimble Reflexes");
const cunning = rogue(40, { maxSpeed: 5 });
globalThis.CombatEngine.initializeUnitData(cunning);
assert.equal(cunning.maxSpeed, 7, "Cunning Action should increase Max Speed");
assert.equal(globalThis.CombatEngine.applyPassiveModifiers(cunning).defense_power, 4, "Cunning Action should increase Defense Power");
const mental = rogue(75, { sp: 0 });
globalThis.CombatEngine.processStatusEffects(mental, "lose_sp");
assert.equal(mental.sp, -5, "Slippery Mind should reduce SP loss by 3");
const save = globalThis.CombatEngine.resolveSpell({ saveDC: 10, statuses: ["charmed"] }, rogue(75), []);
assert.equal(save.savePower, 11);
assert.equal(save.isSuccess, true);
const lucky = rogue(100, { sp: 45 });
assert.equal(globalThis.CombatEngine.resolveGuard(lucky, { type: "Guard" }).probability, 100, "Stroke of Luck should add 5 percentage points Heads Probability");
const elusive = rogue(90);
const buffedEnemy = { hp: 100, sp: 0, powerBuff: 6, hasPositiveStatus: true, statusEffects: {} };
const evade = globalThis.CombatEngine.resolveEvade(elusive, { type: "Evade", basePower: 10 }, buffedEnemy, { type: "Normal", basePower: 10 });
assert.equal(evade.evadePower, 25, "Elusive should add +15 Evade Power against a buffed unit");
const invisibleEnemy = { hp: 100, sp: 0, statusEffects: { invisible: { count: 1 } } };
const blindRogue = rogue(70);
const clash = globalThis.CombatEngine.resolveStandardClash(invisibleEnemy, { basePower: 10 }, blindRogue, { basePower: 10 });
assert.equal(clash.powerA, 10, "Blindsense should suppress Invisible-derived clash buffs against the Rogue");

await import("../js/rogue-theatre-runtime.js");
const theatreRuntime = globalThis.LuminousRogueTheatreRuntime;
assert.ok(theatreRuntime, "Rogue Theatre runtime should install");
globalThis.datosJugador = rogue(55);
globalThis.LuminousTheatreRolls.armCheck({ thresholdRaw: 20, abilityId: "dex" });
assert.equal(armedCheck.thresholdRaw, 17, "Reliable Talent +3 Final Power should apply to Theatre checks");
const languages = globalThis.LuminousLanguageCatalog.list();
assert.ok(languages.some((entry) => entry.languageId === "thieves_cant"), "Thieves' Cant should be registered in the language catalog");
globalThis.datosJugador = rogue(1);
theatreRuntime.enforceThievesCant(globalThis.datosJugador);
assert.equal(globalThis.datosJugador.languages.thieves_cant.porcentaje, 100, "Rogues should automatically unlock Thieves' Cant");
const nonRogue = { classes: [], languages: { thieves_cant: { porcentaje: 100 } } };
theatreRuntime.enforceThievesCant(nonRogue);
assert.equal(nonRogue.languages.thieves_cant, undefined, "Non-Rogues should not retain Thieves' Cant");

globalThis.setInterval = realSetInterval;
console.log("Rogue class Theatre/Combat smoke passed.");
