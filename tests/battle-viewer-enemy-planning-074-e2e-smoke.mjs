import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the browser/CommonJS CombatEngine directly. This test intentionally crosses
// the real Battle Viewer Planning -> Timeline -> CombatActionResolver -> CombatEngine path.
globalThis.window = globalThis;
globalThis.STATUS_REGISTRY = globalThis.STATUS_REGISTRY || {};
const engineSource = readFileSync(new URL('../js/combatEngine.js', import.meta.url), 'utf8');
vm.runInThisContext(engineSource, { filename: 'js/combatEngine.js' });
if (!globalThis.CombatEngine) throw new Error('CombatEngine did not initialize.');

await import('../js/universal-action-economy.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/combat-action-engine-bridge.js');
await import('../js/combat-action-queue.js');
await import('../js/combat-action-resolver.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');
await import('../js/unit-action-economy-catalog.js');
await import('../js/enemy-action-slot-allocator.js');
await import('../js/unit-rank-runtime.js');
await import('../js/skill-catalog-kobold-tier1.js');
await import('../js/battle-viewer-action-adapter-073.js');
await import('../js/battle-viewer-runtime-073-timeline.js');
await import('../js/battle-viewer-enemy-planning-074.js');

const economy = globalThis.LuminousActionEconomy;
const schema = globalThis.LuminousCombatAction;
const skills = globalThis.LuminousKoboldTier1SkillCatalog;
const rankRuntime = globalThis.LuminousUnitRankRuntime;
const timeline = globalThis.LuminousBattleViewerTimeline073;
const bridge = globalThis.LuminousBattleViewerEnemyPlanning074;

if (!economy || !schema || !skills || !rankRuntime || !timeline || !bridge) {
  throw new Error('Battle Viewer E2E dependencies were not initialized.');
}

function player(id, hp = 200) {
  return {
    id,
    name: id,
    faction: 'ally',
    faccion: 'ally',
    isPlayer: true,
    hp,
    maxHp: hp,
    sp: 0,
    level: 3,
    speed: 5,
    actionSlots: 4,
    stats: {},
    statusEffects: {},
    shield: 0,
    physRes: 1,
    sinRes: 1,
  };
}

function enemy({ id, canonicalUnitId, rank = 'normal', speed = 6, skill }) {
  return {
    id,
    name: id,
    canonicalUnitId,
    rank,
    faction: 'enemy',
    faccion: 'enemy',
    hp: 30,
    maxHp: 30,
    sp: 0,
    maxSp: 45,
    level: 3,
    speed,
    scores: { int: 10, wis: 9 },
    stats: {},
    statusEffects: {},
    shield: 0,
    resolvedSkills: [skill],
  };
}

function beginViewerPlanning(units) {
  units.forEach((unit) => economy.beginPlanning(unit));
}

function installViewerState(units) {
  globalThis.combatData = Object.fromEntries(units.map((unit) => [unit.id, unit]));
  globalThis.attackVectors = {};
  globalThis.slotTargets = {};
}

// A clashable enemy Skill without a reciprocal player action is NOT a Clash event.
// The Viewer must emit an ordinary action event and CombatActionResolver must fall back
// to a unilateral attack in the real CombatEngine.
{
  const target = player('timeline_player', 200);
  const dagger = skills.get('kobold_dagger_jab');
  assert.equal(dagger.isClashable, true);
  assert.equal(dagger.isUnclashable, false);
  const kobold = enemy({
    id: 'timeline_kobold',
    canonicalUnitId: 'kobold_dagger',
    speed: 8,
    skill: dagger,
  });
  const units = [target, kobold];
  installViewerState(units);
  beginViewerPlanning(units);

  const planning = bridge.runViewerPlanning({
    units,
    attackVectors: globalThis.attackVectors,
    slotTargets: globalThis.slotTargets,
    renderSlots: () => {},
    allocationOptions: { teamSlotCap: 1 },
  });
  assert.equal(planning.applied, true);
  assert.equal(planning.result.allocation.totalSlots, 1, 'single-slot fixture must isolate one timeline action');
  const vector = globalThis.attackVectors.timeline_kobold_slot_0;
  assert.ok(vector?.combatAction, 'GOAP should inject a canonical CombatAction into the enemy slot');
  assert.equal(vector.combatAction.source.id, 'kobold_dagger_jab');
  assert.equal(vector.combatAction.resolution.type, 'clash', 'canonical Skill semantics must remain clashable');
  assert.equal(vector.target, 'timeline_player_slot_0');
  assert.equal(globalThis.slotTargets.timeline_player_slot_0, undefined, 'player has no reciprocal target/action');

  const events = timeline.buildEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'action', 'non-reciprocal clashable Skill must become a normal timeline action');
  assert.equal(events[0].opposingAction, undefined);
  assert.equal(events[0].action.resolution.type, 'clash', 'timeline must not rewrite the canonical resolution contract');

  const hpBefore = target.hp;
  const resolved = await timeline.resolveEvent(events[0]);
  assert.equal(resolved.resolved, true, resolved.reason || 'timeline action should resolve');
  assert.ok(target.hp < hpBefore, `real CombatEngine should apply unilateral damage (${hpBefore} -> ${target.hp})`);
}

// Test boundary for this milestone: Normal + Captain only. Rank does not manufacture
// Action Slots; the Captain uses its canonical Unit profile. A 3-slot Unit therefore gets
// all three slots while still using the same Individual GOAP/CombatAction pipeline.
{
  const target = player('captain_player', 1000);
  const captainSkill = skills.get('dragonheart_spear_thrust');
  const normalSkill = skills.get('kobold_dagger_jab');
  const captain = enemy({
    id: 'captain_dragonheart',
    canonicalUnitId: 'dragonheart_kobold',
    rank: 'captain',
    speed: 10,
    skill: captainSkill,
  });
  const normal = enemy({
    id: 'normal_kobold',
    canonicalUnitId: 'kobold_dagger',
    rank: 'normal',
    speed: 7,
    skill: normalSkill,
  });
  const units = [target, captain, normal];
  installViewerState(units);
  beginViewerPlanning(units);

  assert.equal(rankRuntime.rankForUnit(captain), 'captain');
  const captainRank = rankRuntime.profileForUnit(captain);
  assert.equal(captainRank.commandLevel, 1);
  assert.equal(rankRuntime.rankForUnit(normal), 'normal');
  assert.equal(rankRuntime.profileForUnit(normal).commandLevel, 0);

  const planning = bridge.runViewerPlanning({ units, attackVectors: globalThis.attackVectors, slotTargets: globalThis.slotTargets, renderSlots: () => {} });
  assert.equal(planning.applied, true);
  const rows = Object.fromEntries(planning.result.allocation.rows.map((row) => [row.unitId, row]));
  assert.equal(rows.captain_dragonheart.maxSlots, 3);
  assert.equal(rows.captain_dragonheart.slots, 3, '3-slot Captain profile should receive its full allocation when eligible');
  assert.equal(rows.normal_kobold.maxSlots, 2);
  assert.equal(rows.normal_kobold.slots, 2);
  assert.deepEqual(planning.result.allocation.bonusRecipients, ['captain_dragonheart', 'normal_kobold']);
  assert.equal(planning.result.allocation.totalSlots, 5);
  assert.equal(planning.result.allocation.unusedSlots, 7, 'team cap is a ceiling, not a quota');

  const captainVectors = Object.entries(globalThis.attackVectors).filter(([slotId]) => slotId.startsWith('captain_dragonheart_slot_'));
  assert.equal(captainVectors.length, 3);
  for (const [slotId, vector] of captainVectors) {
    assert.equal(vector.__luminousEnemyGoap074, true);
    assert.equal(vector.combatAction.actorId, captain.id);
    assert.equal(vector.combatAction.actionSlotId, slotId);
    assert.equal(vector.combatAction.source.id, 'dragonheart_spear_thrust');
    assert.equal(vector.combatAction.phase.selectedAt, schema.PHASES.PLANNING_PHASE_AI);
    assert.equal(schema.validateCombatAction(vector.combatAction).valid, true);
  }

  const events = timeline.buildEvents();
  const captainEvents = events.filter((event) => event.actorSlotId.startsWith('captain_dragonheart_slot_'));
  assert.equal(captainEvents.length, 3);
  assert.ok(captainEvents.every((event) => event.type === 'action'), 'unanswered Captain attacks must remain unilateral timeline actions');

  const hpBefore = target.hp;
  for (const event of captainEvents) {
    const resolved = await timeline.resolveEvent(event);
    assert.equal(resolved.resolved, true, resolved.reason || 'Captain GOAP action should resolve');
  }
  assert.ok(target.hp < hpBefore, `Captain CombatActions should reach the real CombatEngine (${hpBefore} -> ${target.hp})`);

  assert.equal(rankRuntime.RANKS.leader.commandLevel, 2, 'Leader definition remains available for a later milestone');
  assert.equal(planning.result.plans.some((entry) => entry.plan?.metadata?.rank === 'leader'), false, 'this milestone must not inject Leader planning');
}

console.log('Battle Viewer enemy Planning 0.7.4 E2E (Normal + Captain): ok');
