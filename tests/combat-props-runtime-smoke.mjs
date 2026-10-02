import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

globalThis.STATUS_REGISTRY = {};

await import("../js/combat-props-runtime.js");
const combatEngineSource = fs.readFileSync(new URL("../js/combatEngine.js", import.meta.url), "utf8");
vm.runInThisContext(`${combatEngineSource}\n;globalThis.CombatEngine = CombatEngine;`, { filename: "combatEngine.js" });

const props = globalThis.LuminousCombatPropsRuntime;
const engine = globalThis.CombatEngine;
props.install(engine);

assert.ok(props && engine, "combat props runtime and combat engine should load");

const chair = { id: "chair", name: "Chair", weight: 4, hiddenHP: 3, throwable: true };
const boulder = { id: "boulder", name: "Boulder", weight: 11, hiddenHP: 2, throwable: true };
props.registerEncounterProps([chair, boulder]);

const thrownPower = props.improvisedThrownPower({ dndStats: { str: 16 } });
assert.deepEqual(thrownPower, { basePower: 3, coinPower: 5, strengthScore: 16 });

const thrown = props.improvisedThrownSkill({ dndStats: { str: 16 } }, "chair");
assert.equal(thrown.ok, true);
assert.equal(thrown.skill.basePower, 3);
assert.equal(thrown.skill.coinPower, 5);
assert.deepEqual(thrown.skill.effects, []);
assert.equal(thrown.skill.__luminousPropUse.cause, "thrown");

const baseSkill = {
  id: "sword_skill",
  name: "Sword Skill",
  effects: [
    { type: "status", status: "bleed", potency: 3 },
    { type: "percentage_damage", potency: 10 }
  ],
  coins: [{
    type: "standard",
    effects: [
      { type: "inflict_status", status: "burn", potency: 2 },
      { type: "raw_damage", potency: 2 }
    ]
  }]
};
const improvised = props.improvisedWeaponSkill(baseSkill, "chair");
assert.equal(improvised.ok, true);
assert.equal(improvised.skill.damageMultiplier, 0.6);
assert.equal(improvised.skill.improvisedWeapon, true);
assert.equal(improvised.skill.effects.some((effect) => effect.status), false);
assert.equal(improvised.skill.effects.some((effect) => effect.type === "percentage_damage"), true);
assert.equal(improvised.skill.coins[0].effects.some((effect) => effect.status), false);
assert.equal(improvised.skill.coins[0].effects.some((effect) => effect.type === "raw_damage"), true);

const actor = { id: "actor", level: 1, hp: 100, maxHp: 100, statusEffects: {}, physRes: 1, sinRes: 1 };
const defender = { id: "defender", level: 1, hp: 100, maxHp: 100, statusEffects: {}, physRes: 1, sinRes: 1 };
const normalDamage = engine.calculateCoinDamage(actor, defender, { id: "normal" }, 10, false, 0, {});
const reducedDamage = engine.calculateCoinDamage(actor, defender, { id: "improvised", damageMultiplier: 0.6 }, 10, false, 0, {});
assert.equal(reducedDamage, Math.floor(normalDamage * 0.6), "improvised weapon damage must be reduced by 40%");

assert.equal(props.catapultMaxWeight(1), 5);
assert.equal(props.catapultMaxWeight(3), 15);
assert.equal(props.validateCatapultProp("boulder", 2).reason, "prop_too_heavy");
assert.equal(props.validateCatapultProp("boulder", 3).ok, true);

assert.deepEqual(
  props.applyPropWear("chair", 1, "thrown"),
  { applied: true, propId: "chair", before: 3, after: 2, broken: false, cause: "thrown" }
);
props.applyPropWear("chair", 1, "hit");
const finalWear = props.applyPropWear("chair", 1, "improvised_weapon");
assert.equal(finalWear.after, 0);
assert.equal(finalWear.broken, true);
assert.equal(props.validateCatapultProp("chair", 1).reason, "prop_broken");

console.log("Combat props runtime smoke: OK");
