"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function resistanceModifier(value) {
  const v = Number(value);
  if (v <= 0) return -0.5;
  if (v < 1) return (v - 1) / 2;
  return v - 1;
}

function makeCombatEngine() {
  return {
    createSkill(config = {}) {
      return { name: config.name || "Skill", tipo_dano: config.tipo_dano || "cortante" };
    },
    calculateResistanceModifier: resistanceModifier,
    applyPassiveModifiers(unit) {
      return { damage_taken_multiplier: Number(unit.damageTakenModifier || 0) };
    },
    getOffensiveLevel(unit) {
      return Number(unit.offensiveLevel || 0);
    },
    getDefensiveLevel(unit) {
      return Number(unit.defensiveLevel || 0);
    },
    calculateCoinDamage(attacker, defender, skill, coinFinalPower) {
      const defenderMods = this.applyPassiveModifiers(defender, { skill });
      const physMod = this.calculateResistanceModifier(defender.physRes || 1);
      const sinMod = this.calculateResistanceModifier(defender.sinRes || 1);
      const offLevel = this.getOffensiveLevel(attacker, skill);
      const defLevel = this.getDefensiveLevel(defender, defender);
      const levelMod = (offLevel - defLevel) / (Math.abs(offLevel - defLevel) + 25);
      const rawDamage = coinFinalPower * (1 + physMod + sinMod + levelMod);
      const defMult = Math.max(0, 1 - (defenderMods.damage_taken_multiplier || 0) * 0.1);
      return Math.max(0, Math.floor(rawDamage * defMult));
    },
    applyDamage(unit, damage, tipoDano = "directo") {
      let remainingDamage = Number(damage || 0);
      if (unit.shield > 0) {
        const absorbed = Math.min(unit.shield, remainingDamage);
        unit.shield -= absorbed;
        remainingDamage -= absorbed;
      }
      unit.hp = Math.max(0, unit.hp - remainingDamage);
      if (tipoDano === "directo") unit.staggerChecks = Number(unit.staggerChecks || 0) + 1;
      return { hp: unit.hp, shield: unit.shield };
    },
  };
}

globalThis.CombatEngine = makeCombatEngine();
globalThis.LuminousTraitStandardizationRuntime = Object.freeze({
  resolveTraitRuntimeResolutions() {
    return { originalResolution: true };
  },
});

const runtime = require(path.resolve(__dirname, "../js/fixed-damage-runtime.js"));
runtime.patchAll();

assert.equal(runtime.normalizeDamageMode(undefined), "normal");
assert.equal(runtime.normalizeDamageMode("Fixed"), "fixed");
assert.equal(runtime.damageModeForSkill({ damageMode: "fixed" }), "fixed");
assert.equal(runtime.damageModeForSkill({ tipo_dano: "cortante" }), "normal", "kinetic damage type must stay independent from damage mode");
const createdFixedSkill = globalThis.CombatEngine.createSkill({ name: "Fixed Test", tipo_dano: "cortante", damageMode: "fixed" });
assert.equal(createdFixedSkill.damageMode, "fixed", "CombatEngine.createSkill must preserve the canonical damageMode field");
const createdNormalSkill = globalThis.CombatEngine.createSkill({ name: "Normal Test", tipo_dano: "perforante" });
assert.equal(createdNormalSkill.damageMode, "normal", "skills without a mode must stay backward-compatible Normal Damage");

const attacker = { offensiveLevel: 10 };
const defendedTarget = {
  physRes: 0.5,
  sinRes: 0.5,
  defensiveLevel: 30,
  damageTakenModifier: 2,
};

const normalDamage = globalThis.CombatEngine.calculateCoinDamage(attacker, defendedTarget, { damageMode: "normal" }, 100, false, 0);
const fixedDamage = globalThis.CombatEngine.calculateCoinDamage(attacker, defendedTarget, { damageMode: "fixed" }, 100, false, 0);
assert.ok(normalDamage < 100, "normal damage should still be reduced by defenses");
assert.equal(fixedDamage, 100, "fixed damage must ignore resistance, Defensive Level and Damage Taken reductions");

const vulnerableTarget = {
  physRes: 1.5,
  sinRes: 1,
  defensiveLevel: 0,
  damageTakenModifier: -2,
};
const vulnerableFixed = globalThis.CombatEngine.calculateCoinDamage(attacker, vulnerableTarget, { damageMode: "fixed" }, 100, false, 0);
assert.ok(vulnerableFixed > 100, "fixed damage may still benefit from vulnerabilities and other increases");

const shielded = { hp: 100, shield: 30, staggerChecks: 0 };
const applied = runtime.applyFixedDamage(shielded, 50);
assert.equal(applied.amount, 50);
assert.equal(shielded.shield, 0, "fixed damage does not bypass Shield");
assert.equal(shielded.hp, 80, "only damage left after Shield reaches HP");
assert.equal(shielded.staggerChecks, 1, "fixed damage keeps the normal direct-damage/Stagger path");

const traitTarget = { hp: 100, shield: 2, staggerChecks: 0 };
const traitRuntime = {
  character: { stats: { fuerza: 18 } },
  attacker: { stats: { fuerza: 18 } },
  target: traitTarget,
  defender: traitTarget,
  skill: { scaling_stat: "Fuerza", tipo_dano: "cortante", damageMode: "normal" },
  damageDealt: 50,
};
const trait = {
  id: "devil_lineage_power_of_the_nine_hells",
  mechanics: { onHitStrengthFixedDamagePercentFormula: "StrengthMod * 2" },
};
const standardResult = globalThis.LuminousTraitStandardizationRuntime.resolveTraitRuntimeResolutions([trait], "on_hit", traitRuntime, {});
assert.equal(standardResult.originalResolution, true, "existing Trait standardization resolution must remain intact");
assert.equal(traitRuntime.fixedDamageDealt, 4, "STR Mod 4 × 2% of 50 damage produces 4 Fixed Damage");
assert.equal(traitTarget.shield, 0, "Power of the Nine Hells Fixed Damage is absorbed by Shield first");
assert.equal(traitTarget.hp, 98, "remaining Fixed Damage reaches HP normally");

const nonStrengthTarget = { hp: 100, shield: 0 };
globalThis.LuminousTraitStandardizationRuntime.resolveTraitRuntimeResolutions([trait], "on_hit", {
  character: { stats: { fuerza: 18 } },
  target: nonStrengthTarget,
  skill: { scaling_stat: "Destreza" },
  damageDealt: 50,
}, {});
assert.equal(nonStrengthTarget.hp, 100, "Power of the Nine Hells must only add Fixed Damage to STR Skills");

const statusPath = path.resolve(__dirname, "../js/status-engine.js");
if (fs.existsSync(statusPath)) {
  const statusSource = fs.readFileSync(statusPath, "utf8");
  assert.ok(statusSource.includes('loadScript("fixed-damage-runtime-script", "js/fixed-damage-runtime.js")'), "Status Engine must bootstrap the Fixed Damage runtime");
}

console.log("Fixed Damage runtime contract: OK");
