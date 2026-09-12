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
const statusEngine = globalThis.LuminousStatusEngine;
const goblinRuntime = globalThis.LuminousGoblinUnitRuntime;
const skills = globalThis.LuminousGoblinTier1SkillCatalog;
const units = globalThis.LuminousGoblinUnitCatalog;
const profiles = globalThis.LuminousUnitActionEconomyCatalog;
const adapters = globalThis.LuminousCombatActionAdapters;
const resolver = globalThis.LuminousCombatActionResolver;
const kitAdapter = globalThis.LuminousUnitAiKitAdapter;

if (!engine || !ammo || !statusEngine || !goblinRuntime || !skills || !units || !profiles || !adapters || !resolver || !kitAdapter) {
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

function gainStatus(target, statusId, count = 1) {
  statusEngine.applyStatus(target, statusId, { mode: 'gain', count, potency: 0 });
}

function resolveSkill(actor, target, skillId, actionSlotId, options = {}) {
  const skill = skills.get(skillId);
  assert.ok(skill, `missing Goblin Skill ${skillId}`);
  const action = adapters.compileSkillToCombatAction(actor, skill, {
    isAi: true,
    actionSlotId,
    targetId: target.id,
  });
  return resolver.resolveCombatAction(action, {
    phase: action.phase.executesAt,
    units: [actor, target],
    engine,
    ...(options.ammunition === false ? {} : { resourceHandlers: { ammunition: ammo.ammunitionHandler() } }),
  });
}

function countRange(skillList, rangeKind) {
  return skillList.filter((skill) => rangeKind === 'melee' ? Number(skill.skillRange) <= 1 : Number(skill.skillRange) > 1).length;
}

// ── Catalog contract: exact Tier 1 / Tier 2 numbers and minimum loadouts ────
const normalT1 = skills.byTier('goblin', 1);
const normalT2 = skills.byTier('goblin', 2);
const bossT1 = skills.byTier('goblin_boss', 1);
const bossT2 = skills.byTier('goblin_boss', 2);
assert.equal(countRange(normalT1, 'melee'), 2, 'Goblin Tier 1 must have exactly 2 melee Skills');
assert.equal(countRange(normalT1, 'ranged'), 1, 'Goblin Tier 1 must have exactly 1 ranged Skill');
assert.equal(countRange(normalT2, 'melee'), 2, 'Goblin Tier 2 must have exactly 2 melee Skills');
assert.equal(countRange(normalT2, 'ranged'), 1, 'Goblin Tier 2 must have exactly 1 ranged Skill');
assert.equal(countRange(bossT1, 'melee'), 3, 'Goblin Boss Tier 1 must have 3 melee Skills');
assert.equal(countRange(bossT1, 'ranged'), 1, 'Goblin Boss Javelin is additional ranged utility');
assert.equal(countRange(bossT2, 'melee'), 3, 'Goblin Boss Tier 2 must have 3 melee Skills');
assert.equal(countRange(bossT2, 'ranged'), 1, 'Goblin Boss Tier 2 keeps one additional ranged option');

const expectedNumbers = {
  goblin_scimitar_slash: [1, 5, 4, 2],
  goblin_hamstring_cut: [1, 4, 3, 2],
  goblin_shortbow_shot: [1, 6, 4, 1],
  goblin_serrated_slash: [2, 5, 4, 3],
  goblin_crippling_stab: [2, 6, 3, 2],
  goblin_barbed_arrow: [2, 5, 5, 2],
  goblin_butchers_cut: [1, 6, 3, 3],
  goblin_kneecapper: [1, 4, 4, 2],
  goblin_javelin_throw: [1, 6, 5, 1],
  goblin_relentless_cleave: [2, 6, 4, 3],
  goblin_bloodletter: [2, 5, 4, 4],
  goblin_tyrants_assault: [2, 7, 3, 3],
  goblin_barbed_javelin: [2, 6, 5, 2],
};
for (const [skillId, expected] of Object.entries(expectedNumbers)) {
  const skill = skills.get(skillId);
  assert.ok(skill, `${skillId} must exist`);
  assert.deepStrictEqual(
    [skill.tier, skill.basePower, skill.coinPower, skill.coinAmount],
    expected,
    `${skillId} Tier/Base/Coin/Coins contract changed`,
  );
}

const goblin = hydrateEnemy(
  units.resolve('goblin', { level: 2, rank: 'normal', initializeEncounter: true }),
  'ai_goblin',
  'AI Goblin',
);
goblin.canonicalUnitId = 'goblin';
profiles.applyToUnit(goblin, 'goblin');
const player = playerTarget();

assert.deepStrictEqual(goblin.resolvedSkills.map((skill) => skill.id), skills.loadout('goblin'));
assert.equal(goblin.resolvedSkills.length, 6);
assert.equal(goblin.metadata.weaponSkillsPendingCanonicalCatalog, false);
assert.equal(goblin.actionEconomy.minSlots, 1);
assert.equal(goblin.actionEconomy.maxSlots, 2);

const scimitarDefinition = skills.get('goblin_scimitar_slash');
const shortbowDefinition = skills.get('goblin_shortbow_shot');
assert.deepStrictEqual(shortbowDefinition.aiEstimate.producesTags, ['pierced', 'goblin_bind_setup', 'goblin_bleed_setup']);
assert.deepStrictEqual(scimitarDefinition.aiEstimate.consumesTags, ['goblin_bind_setup', 'goblin_bleed_setup', 'bind', 'bleed']);

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
assert.ok(skills.loadout('goblin').includes(plan.sequence[0].sourceId), `Goblin GOAP chose non-canonical source ${plan.sequence[0].sourceId}`);
assert.equal(plan.kit.unresolved.filter((entry) => entry.reason === 'canonical_weapon_skill_pending').length, 0);

const comboPlan = kitAdapter.planUnitTurn({
  actor: goblin,
  targets: [{ id: player.id }],
  availableSlots: 2,
  slotIds: ['ai_goblin_combo_0', 'ai_goblin_combo_1'],
  allowEscape: false,
  allowGrapple: false,
});
assert.equal(comboPlan.planned, true, comboPlan.reason || 'Goblin should plan its two-slot build');
assert.equal(comboPlan.sequence.length, 2);
const comboFirst = skills.get(comboPlan.sequence[0].sourceId);
const comboSecond = skills.get(comboPlan.sequence[1].sourceId);
const setupTags = new Set(comboFirst?.aiEstimate?.producesTags || []);
const payoffTags = comboSecond?.aiEstimate?.consumesTags || [];
assert.ok(payoffTags.some((tag) => setupTags.has(tag)), `GOAP should chain Goblin setup -> payoff, got ${comboPlan.sequence.map((row) => row.sourceId).join(' -> ')}`);

// ── Existing Pierced -> Bind/Bleed build through real CombatAction runtime ─
const hpBefore = player.hp;
const arrowsBefore = ammo.ammoCount(goblin, 'arrows');
for (let index = 0; index < 4; index += 1) {
  const result = resolveSkill(goblin, player, 'goblin_shortbow_shot', `ai_goblin_direct_${index}`);
  assert.equal(result.resolved, true, result.reason || `Shortbow shot ${index + 1} should resolve`);
  assert.equal(ammo.statusCount(player, 'pierced'), index + 1, 'each Shortbow hit must add exactly 1 Pierced');
}
assert.equal(ammo.ammoCount(goblin, 'arrows'), arrowsBefore - 4, 'four Shortbow CombatActions consume four Arrows');
assert.ok(player.hp < hpBefore, `real CombatEngine should damage Player (${hpBefore} -> ${player.hp})`);
assert.equal(ammo.statusCount(player, 'bind'), 1, 'Pierced 3 threshold should generate Bind');
assert.equal(ammo.statusCount(player, 'bleed'), 1, 'Pierced 4 threshold should generate Bleed Count');

const cleanTarget = playerTarget('goblin_clean_target');
const cleanPayoff = goblinRuntime.prepareBindBleedPayoffSkill(goblin, scimitarDefinition, cleanTarget);
assert.equal(Number(cleanPayoff.__combatActionFinalPowerBonus || 0), 0, 'Scimitar gets no payoff against an unprepared target');

const preparedPayoff = goblinRuntime.prepareBindBleedPayoffSkill(goblin, scimitarDefinition, player);
assert.equal(preparedPayoff.__combatActionFinalPowerBonus, 2, 'Bind + Bleed should grant +2 Final Power total');
assert.equal(preparedPayoff.metadata.goblinBindBleedPayoffApplied.bindActive, true);
assert.equal(preparedPayoff.metadata.goblinBindBleedPayoffApplied.bleedActive, true);

const payoffResult = resolveSkill(goblin, player, 'goblin_scimitar_slash', 'ai_goblin_payoff', { ammunition: false });
assert.equal(payoffResult.resolved, true, payoffResult.reason || 'Goblin Scimitar payoff should resolve');
const payoffEngineResult = payoffResult.resolution?.results?.[0]?.result;
assert.equal(payoffEngineResult?.goblinBindBleedPayoff?.finalPowerBonus, 2, 'real CombatEngine path must receive the Bind/Bleed payoff');

// ── New Tier 1 melee: Hamstring Cut = Bind 1, or Bind 2 vs existing Bleed ──
const hamstringClean = playerTarget('hamstring_clean');
const hamstringCleanResult = resolveSkill(goblin, hamstringClean, 'goblin_hamstring_cut', 'hamstring_clean_slot', { ammunition: false });
assert.equal(hamstringCleanResult.resolved, true);
assert.equal(ammo.statusCount(hamstringClean, 'bind'), 1, 'Hamstring Cut must apply 1 Bind');

const hamstringBleeding = playerTarget('hamstring_bleeding');
gainStatus(hamstringBleeding, 'bleed', 1);
const hamstringBleedResult = resolveSkill(goblin, hamstringBleeding, 'goblin_hamstring_cut', 'hamstring_bleed_slot', { ammunition: false });
assert.equal(hamstringBleedResult.resolved, true);
assert.equal(ammo.statusCount(hamstringBleeding, 'bind'), 2, 'Hamstring Cut must apply +1 extra Bind when target already has Bleed');

// ── Tier 2 conditional Power: indexed Coin bonuses are exact, not metadata ──
const serratedTarget = playerTarget('serrated_bind_target');
gainStatus(serratedTarget, 'bind', 1);
const serratedPrepared = goblinRuntime.prepareConditionalPowerSkill(goblin, skills.get('goblin_serrated_slash'), serratedTarget);
assert.deepStrictEqual(serratedPrepared.__combatActionIndexedCoinPowerBonuses, [{ coinIndex: 3, amount: 2 }]);
assert.equal(engine.calculateFinalPower(serratedPrepared, [true, true, true], goblin), 19, 'Serrated Slash Coin 3 heads must contribute its extra +2 Coin Power');
assert.equal(engine.calculateFinalPower(serratedPrepared, [true, true, false], goblin), 13, 'Serrated Slash Coin 3 bonus must not apply when Coin 3 is tails');

const cripplingTarget = playerTarget('crippling_bleed_target');
gainStatus(cripplingTarget, 'bleed', 1);
const cripplingPrepared = goblinRuntime.prepareConditionalPowerSkill(goblin, skills.get('goblin_crippling_stab'), cripplingTarget);
assert.equal(cripplingPrepared.__combatActionFinalPowerBonus, 1, 'Crippling Stab gets +1 Final Power vs Bleed');

const barbedTarget = playerTarget('barbed_arrow_target');
ammo.applyPierced(barbedTarget, 1, { sourceUnitId: goblin.id });
const barbedArrowsBefore = ammo.ammoCount(goblin, 'arrows');
const barbedResult = resolveSkill(goblin, barbedTarget, 'goblin_barbed_arrow', 'barbed_arrow_slot');
assert.equal(barbedResult.resolved, true);
assert.equal(ammo.ammoCount(goblin, 'arrows'), barbedArrowsBefore - 1, 'Barbed Arrow consumes exactly 1 Arrow');
assert.equal(ammo.statusCount(barbedTarget, 'pierced'), 3, 'Barbed Arrow adds exactly 2 Pierced');
assert.equal(ammo.statusCount(barbedTarget, 'bleed'), 1, 'Barbed Arrow adds 1 Bleed Count only because target already had Pierced');

// ── Boss: 3 melee minimum at each tier + conditional Power + Multi Attack ──
const boss = hydrateEnemy(
  units.resolve('goblin_boss', { level: 5, rank: 'captain', initializeEncounter: true }),
  'ai_goblin_boss',
  'AI Goblin Boss',
);
boss.canonicalUnitId = 'goblin_boss';
profiles.applyToUnit(boss, 'goblin_boss');
assert.deepStrictEqual(boss.resolvedSkills.map((skill) => skill.id), skills.loadout('goblin_boss'));
assert.equal(boss.resolvedSkills.length, 8);
assert.equal(boss.actionEconomy.maxSlots, 3);
assert.equal(goblinRuntime.reuseTimes(boss), 1);

const bossBindTarget = playerTarget('boss_bind_target');
gainStatus(bossBindTarget, 'bind', 1);
const kneecapperPrepared = goblinRuntime.prepareConditionalPowerSkill(boss, skills.get('goblin_kneecapper'), bossBindTarget);
assert.equal(kneecapperPrepared.coinPower, 5, 'Kneecapper gains +1 Coin Power when target already has Bind');
const relentlessPrepared = goblinRuntime.prepareConditionalPowerSkill(boss, skills.get('goblin_relentless_cleave'), bossBindTarget);
assert.deepStrictEqual(relentlessPrepared.__combatActionIndexedCoinPowerBonuses, [{ coinIndex: 2, amount: 1 }, { coinIndex: 3, amount: 1 }]);
assert.equal(engine.calculateFinalPower(relentlessPrepared, [true, true, true], boss), 20, 'Relentless Cleave must apply +1 only to Coins 2 and 3');

const tyrantTarget = playerTarget('tyrant_target');
gainStatus(tyrantTarget, 'bind', 1);
gainStatus(tyrantTarget, 'bleed', 1);
const tyrantPrepared = goblinRuntime.prepareConditionalPowerSkill(boss, skills.get('goblin_tyrants_assault'), tyrantTarget);
assert.equal(tyrantPrepared.__combatActionFinalPowerBonus, 2, "Tyrant's Assault gets +2 Final Power only with Bind + Bleed");

const bossTarget = playerTarget('goblin_boss_target');
const bossResult = resolveSkill(boss, bossTarget, 'goblin_scimitar_slash', 'ai_goblin_boss_slot_0', { ammunition: false });
assert.equal(bossResult.resolved, true, bossResult.reason || 'Goblin Boss Scimitar should resolve');
const bossEngineResult = bossResult.resolution?.results?.[0]?.result;
assert.equal(bossEngineResult?.multiAttackReuse?.traitId, 'goblin_multi_attack');
assert.equal(bossEngineResult?.multiAttackReuse?.timesRequested, 1);
assert.equal(bossEngineResult?.multiAttackReuse?.timesResolved, 1);
assert.ok(bossTarget.hp < bossTarget.maxHp, 'Goblin Boss Scimitar + Multi Attack should damage Player');

console.log(`goblin AI vs Player smoke: ok (13 Skills, normal T1/T2 2 melee + 1 ranged, boss T1/T2 3 melee + 1 ranged, Player ${hpBefore} -> ${player.hp} HP, Pierced ${ammo.statusCount(player, 'pierced')}, Bind ${ammo.statusCount(player, 'bind')}, Bleed ${ammo.statusCount(player, 'bleed')}, Scimitar payoff +${payoffEngineResult?.goblinBindBleedPayoff?.finalPowerBonus || 0})`);