import assert from "node:assert/strict";

await import("../js/combat-action-schema.js");
await import("../js/combat-action-resolver.js");

const schema = globalThis.LuminousCombatAction;
const resolver = globalThis.LuminousCombatActionResolver;
assert.ok(schema && resolver, "combat action resolver should load");

const unitA = { id: "caster", hp: 100, statusEffects: {}, faction: "allies" };
const unitB = { id: "enemy", hp: 100, statusEffects: {}, faction: "enemies" };

function action(actorId, targetId, sourceId, sourceDefinition) {
  return schema.createCombatAction({
    actorId,
    actionSlotId: `${actorId}_slot_0`,
    source: { type: "skill", id: sourceId },
    phase: { selectedAt: schema.PHASES.PLANNING_PHASE_PLAYER, executesAt: schema.PHASES.COMBAT_PHASE },
    economy: { cost: schema.ECONOMY_COSTS.ACTION },
    targeting: { allegiance: "enemy", mode: "focused", attackWeight: 1, mainTargetId: targetId, targetIds: [targetId] },
    resolution: { type: "clash" },
    resources: [],
    effects: [],
    metadata: { sourceDefinition }
  });
}

const burning = action("caster", "enemy", "burning_hands", {
  id: "burning_hands",
  basePower: 5,
  coinPower: 7,
  coinAmount: 1,
  coins: [{ type: "unbreakable", status: "active", effects: [] }],
});
const stronger = action("enemy", "caster", "strong_attack", {
  id: "strong_attack",
  basePower: 20,
  coinPower: 0,
  coinAmount: 1,
  coins: [{ type: "standard", status: "active", effects: [] }],
});

const unilateralCalls = [];
const fakeEngine = {
  resolveStandardClash(a, skillA, b, skillB) {
    skillA.coins[0].status = "latent";
    return { winner: "B", clashLogs: [{ powerA: 5, powerB: 20 }], pendingActions: [] };
  },
  resolveUnilateralWithCounter(attacker, skill, defender, counter, options) {
    unilateralCalls.push({ attacker: attacker.id, defender: defender.id, skill, options });
    return { attackLogs: [{ attackPower: skill.coins?.[0]?.status === "latent" ? 1 : 20 }], damageTaken: 1 };
  }
};

const result = resolver.resolveClashPair(burning, stronger, {
  engine: fakeEngine,
  units: [unitA, unitB],
  phase: schema.PHASES.COMBAT_PHASE,
});

assert.equal(result.resolved, true);
assert.equal(result.winner, "B");
assert.ok(result.unbreakableAttack?.resolved, "losing Unbreakable Coin should still resolve");
assert.equal(unilateralCalls.length, 2, "winner attack and losing latent Unbreakable attack should both resolve");
assert.equal(unilateralCalls[1].attacker, "caster");
assert.equal(unilateralCalls[1].defender, "enemy");
assert.equal(unilateralCalls[1].skill.coins[0].status, "latent");
assert.equal(unilateralCalls[1].options.clashResult, "Lose");

console.log("Unbreakable clash resolver smoke: OK");
