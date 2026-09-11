import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

globalThis.window = globalThis;
globalThis.STATUS_REGISTRY = globalThis.STATUS_REGISTRY || {};

const engineSource = readFileSync(new URL('../js/combatEngine.js', import.meta.url), 'utf8');
vm.runInThisContext(engineSource, { filename: 'js/combatEngine.js' });
const engine = globalThis.CombatEngine;

await import('../js/status-library.js');
await import('../js/status-engine.js');
await import('../js/combat-skill-schema.js');
await import('../js/universal-ranged-ammo-runtime.js');
await import('../js/goblin-unit-runtime.js');
await import('../js/skill-catalog-goblin-tier1.js');
await import('../js/unit-rank-runtime.js');
await import('../js/unit-catalog-goblin.js');
await import('../js/unit-action-economy-catalog.js');
await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/combat-action-engine-bridge.js');
await import('../js/combat-action-queue.js');
await import('../js/combat-action-resolver.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-universal-actions.js');
await import('../js/unit-ai-kit-adapter.js');

const ammo = globalThis.LuminousUniversalRangedAmmoRuntime;
const goblinRuntime = globalThis.LuminousGoblinUnitRuntime;
const skills = globalThis.LuminousGoblinTier1SkillCatalog;
const units = globalThis.LuminousGoblinUnitCatalog;
const profiles = globalThis.LuminousUnitActionEconomyCatalog;
const adapters = globalThis.LuminousCombatActionAdapters;
const resolver = globalThis.LuminousCombatActionResolver;
const kitAdapter = globalThis.LuminousUnitAiKitAdapter;

if (!engine || !ammo || !goblinRuntime || !skills || !units || !profiles || !adapters || !resolver || !kitAdapter) {
  throw new Error('Goblin Player-vs-AI smoke dependencies were not initialized.');
}

engine.currentState = 'COMBAT_ACTIVE';

function hydrateEnemy(unit, runtimeId, name) {
  unit.id = runtimeId;
  unit.name = name;
  unit.canonicalUnitId = unit.metadata?.canonicalUnitId || unit.actionSlotProfileId || unit.species || 'goblin';
  unit.faction = 'enemy';
  unit.faccion = 'enemy';
  unit.level = unit.effectiveLevel || unit.mechanics?.level || 1;
  unit.sp = 0;
  unit.maxSp = 45;
  unit.statusEffects = unit.statusEffects || {};
  unit.stats = unit.stats || {};
  unit.physRes = 1;
  unit.sinRes = 1;
  unit.grid_pos = { x: 2, y: 0 };
  unit.staggerThresholds = [];
  return unit;
}

function playerTarget(id = 'goblin_test_player') {
  return {
    id,
    name: 'Player Combatant',
    isPlayer: true,
    faction: 'allies',
    faccion: 'allies',
    hp: 2000,
    maxHp: 2000,
    sp: 0,
    maxSp: 45,
    level: 5,
    statusEffects: {},
    stats: {},
    physRes: 1,
    sinRes: 1,
    shield: 0,
    grid_pos: { x: 0, y: 0 },
    staggerThresholds: [],
  };
}

const goblin = hydrateEnemy(
  units.resolve('goblin', { level: 2, rank: 'normal', initializeEncounter: true }),
  'ai_goblin',
  'AI Goblin',
);
goblin.canonicalUnitId = 'goblin';
profiles.applyToUnit(goblin, 'goblin');
const player = playerTarget();

assert.deepStrictEqual(goblin.resolvedSkills.map((skill) => skill.id), ['goblin_scimitar_slash', 'goblin_shortbow_shot']);
assert.equal(goblin.metadata.weaponSkillsPendingCanonicalCatalog, false);
assert.equal(goblin.actionEconomy.minSlots, 1);
assert.equal(goblin.actionEconomy.maxSlots, 2);

const plan = kitAdapter.planUnitTurn({
  actor: goblin,
  targets: [{ id: player.id }],
  availableSlots: 1,
  slotIds: ['ai_goblin_slot_0'],
  allowEscape: false,
  allowGrapple: false,
});
assert.equal(plan.planned, true, plan.reason || 'Goblin should produce a GOAP plan');
assert.equal(plan.actions.length, 1);
assert.ok(
  ['goblin_scimitar_slash', 'goblin_shortbow_shot'].includes(plan.sequence[0].sourceId),
  `Goblin GOAP should choose a canonical weapon Skill, got ${plan.sequence[0].sourceId}`,
);
assert.equal(plan.kit.unresolved.filter((entry) => entry.reason === 'canonical_weapon_skill_pending').length, 0);

// Force the ranged build for deterministic content validation. GOAP is tested above;
// this section verifies that the selected canonical Shortbow CombatAction consumes Ammo,
// damages the real Player combatant and applies Pierced through the real CombatEngine hook.
const hpBefore = player.hp;
const arrowsBefore = ammo.ammoCount(goblin, 'arrows');
for (let index = 0; index < 4; index += 1) {
  const shortbow = skills.get('goblin_shortbow_shot');
  const action = adapters.compileSkillToCombatAction(goblin, shortbow, {
    isAi: true,
    actionSlotId: `ai_goblin_direct_${index}`,
    targetId: player.id,
  });
  const result = resolver.resolveCombatAction(action, {
    phase: action.phase.executesAt,
    units: [goblin, player],
    engine,
    resourceHandlers: { ammunition: ammo.ammunitionHandler() },
  });
  assert.equal(result.resolved, true, result.reason || `Shortbow shot ${index + 1} should resolve`);
  assert.equal(ammo.statusCount(player, 'pierced'), index + 1, 'each Shortbow hit must add exactly 1 Pierced');
}
assert.equal(ammo.ammoCount(goblin, 'arrows'), arrowsBefore - 4, 'four Shortbow CombatActions consume four Arrows');
assert.ok(player.hp < hpBefore, `real CombatEngine should damage Player (${hpBefore} -> ${player.hp})`);
assert.equal(ammo.statusCount(player, 'bind'), 1, 'Pierced 3 threshold should generate Bind');
assert.equal(ammo.statusCount(player, 'bleed'), 1, 'Pierced 4 threshold should generate Bleed Count');

// Boss keeps the same Scimitar definition, but its passive runtime reuses the last
// Coin because the canonical Skill has 2 Coins. Rank still does not manufacture slots:
// the 3-slot ceiling comes from the goblin_boss Unit action-economy profile.
const boss = hydrateEnemy(
  units.resolve('goblin_boss', { level: 5, rank: 'captain', initializeEncounter: true }),
  'ai_goblin_boss',
  'AI Goblin Boss',
);
boss.canonicalUnitId = 'goblin_boss';
profiles.applyToUnit(boss, 'goblin_boss');
assert.equal(boss.actionEconomy.maxSlots, 3);
assert.equal(goblinRuntime.reuseTimes(boss), 1);

const bossTarget = playerTarget('goblin_boss_target');
const scimitarAction = adapters.compileSkillToCombatAction(boss, skills.get('goblin_scimitar_slash'), {
  isAi: true,
  actionSlotId: 'ai_goblin_boss_slot_0',
  targetId: bossTarget.id,
});
const bossResult = resolver.resolveCombatAction(scimitarAction, {
  phase: scimitarAction.phase.executesAt,
  units: [boss, bossTarget],
  engine,
});
assert.equal(bossResult.resolved, true, bossResult.reason || 'Goblin Boss Scimitar should resolve');
const bossEngineResult = bossResult.resolution?.results?.[0]?.result;
assert.equal(bossEngineResult?.multiAttackReuse?.traitId, 'goblin_multi_attack');
assert.equal(bossEngineResult?.multiAttackReuse?.timesRequested, 1);
assert.equal(bossEngineResult?.multiAttackReuse?.timesResolved, 1);
assert.ok(bossTarget.hp < bossTarget.maxHp, 'Goblin Boss Scimitar + Multi Attack should damage Player');

console.log(`goblin AI vs Player smoke: ok (Player ${hpBefore} -> ${player.hp} HP, Pierced ${ammo.statusCount(player, 'pierced')}, Bind ${ammo.statusCount(player, 'bind')}, Bleed ${ammo.statusCount(player, 'bleed')})`);