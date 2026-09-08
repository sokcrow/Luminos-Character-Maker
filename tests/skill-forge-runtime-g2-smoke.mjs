import assert from 'node:assert/strict';

const engine = {
  limitSP(value) { return Math.max(-45, Math.min(45, Number(value) || 0)); },
  checkSanityStates() {},
  triggerEvent() {},
  calculateFinalPower(skill, heads) {
    return Number(skill.basePower || 0) + Number(skill.coinPower || 0) * (Array.isArray(heads) ? heads.filter(Boolean).length : 0);
  },
  calculateCoinDamage(attacker, defender, skill, power) { return power; },
  resolveStandardClash(unitA, skillA, unitB) {
    this.triggerEvent('[On Clash Win]', { engine: this, attacker: unitA, defender: unitB, skill: skillA }, [unitB]);
    return { winner: 'A' };
  },
};

globalThis.CombatEngine = engine;
await import('../js/skill-forge-runtime-g2.js');
const runtime = globalThis.LuminousSkillForgeRuntimeG2;
assert.ok(runtime, 'Skill Forge runtime must initialize');

const actor = { id: 'actor', hp: 100, maxHp: 100, sp: 0, statusEffects: { burn: { potency: 4, count: 2 } } };
const target = { id: 'target', hp: 40, maxHp: 100, sp: -10, statusEffects: { rupture: { potency: 3, count: 2 } } };

assert.equal(runtime.evaluateCondition({ target: 'target', stat: 'hp_percent', operator: '<=', value: 50 }, { attacker: actor, defender: target }), true);
assert.equal(runtime.evaluateCondition({ target: 'target', stat: 'sp_current', operator: '<', value: 0 }, { attacker: actor, defender: target }), true);
assert.equal(runtime.evaluateCondition({ target: 'target', stat: 'status_potency', status: 'rupture', operator: '>=', value: 3 }, { attacker: actor, defender: target }), true);
assert.equal(runtime.evaluateCondition({ target: 'target', stat: 'status_count', status: 'rupture', operator: '>=', value: 2 }, { attacker: actor, defender: target }), true);

const clashSkill = {
  id: 'forge_clash', basePower: 5, coinPower: 3, coinType: 'positive', metadata: { forge: true },
  effects: [{ type: 'forge_reward', trigger: '[On Clash Win]', timing: 'next_clash', forgeReward: { kind: 'clash_power', amount: 2 } }],
  coins: [{ effects: [] }],
};
const enemySkill = { id: 'enemy', basePower: 5, coinPower: 3, coinType: 'positive', metadata: { forge: true }, effects: [], coins: [] };
engine.resolveStandardClash(actor, clashSkill, target, enemySkill);
assert.equal(runtime.inspectUnitState(actor).nextClashPower, 2, 'Clash Win reward must be saved for the next Clash instead of feeding the Clash already won');
assert.equal(engine.calculateFinalPower(clashSkill, [true], actor), 8, 'next Clash Power must not affect a normal attack Coin');

const attackSkill = { id: 'forge_attack', basePower: 5, coinPower: 3, coinType: 'positive', metadata: { forge: true }, effects: [], coins: [{ effects: [] }] };
runtime.applyReward({ forgeReward: { kind: 'final_power', amount: 1 }, timing: 'next_coin' }, { engine, attacker: actor, defender: target, skill: attackSkill });
runtime.applyReward({ forgeReward: { kind: 'coin_power', amount: 1 }, timing: 'next_coin' }, { engine, attacker: actor, defender: target, skill: attackSkill });
runtime.applyReward({ forgeReward: { kind: 'damage_percent', amount: 10 }, timing: 'next_coin' }, { engine, attacker: actor, defender: target, skill: attackSkill });
const power = engine.calculateFinalPower(attackSkill, [true], actor);
assert.equal(power, 10, '5 base + 3 Coin + 1 Final + 1 Coin Power');
assert.equal(engine.calculateCoinDamage(actor, target, attackSkill, power, false, 0, {}), 11, 'next-Coin Damage reward must be consumed on the same activated Coin');
assert.equal(runtime.inspectUnitState(actor).activeCoin, null, 'next-Coin modifiers must clear after damage resolution');

runtime.applyReward({ forgeReward: { kind: 'sp', amount: 10 }, condition: { target: 'target', stat: 'hp_percent', operator: '<=', value: 50 } }, { engine, attacker: actor, defender: target, skill: attackSkill });
assert.equal(actor.sp, 10, 'conditional immediate SP reward should resolve');
const failed = runtime.applyReward({ forgeReward: { kind: 'sp', amount: 10 }, condition: { target: 'target', stat: 'hp_percent', operator: '<=', value: 25 } }, { engine, attacker: actor, defender: target, skill: attackSkill });
assert.equal(failed.applied, false);
assert.equal(actor.sp, 10, 'failed condition must not grant the reward');

console.log('skill forge runtime G1-G2 smoke: ok');
