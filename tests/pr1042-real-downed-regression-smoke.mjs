import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const evaluate = (file, context) => vm.runInContext(read(file), context, { filename: file });
const makeContext = extra => {
  const c = vm.createContext({ console, Math: Object.create(Math), addEventListener() {}, ...extra });
  c.window = c;
  return c;
};
const unit = (id, rank = 'normal', hp = 100) => ({ id, name: id, rank, hp, maxHp: 100, sp: 0,
  faction: id === 'a' ? 'ally' : 'enemy', faccion: id === 'a' ? 'ally' : 'enemy',
  level: 1, battleActive: true, deploymentState: 'field', statusEffects: {} });
const skill = { id: 'strike', type: 'Attack', basePower: 4, coinPower: 0, coinAmount: 3, effects: [],
  coins: Array.from({ length: 3 }, () => ({ type: 'standard', status: 'active', effects: [] })) };

// Exercise actual status processing, Death Save wrappers, engine and resolver.
for (const coinwiseResolution of [false, true]) {
  for (const rank of ['captain', 'leader', 'normal']) {
    const c = makeContext({ STATUS_REGISTRY: { bleed: { rules: [
      { trigger: 'on_coin_flip', cond_type: 'potency', affectation: 'hp', operation: 'sub', aff_input: 1 }
    ] } } });
    evaluate('js/combatEngine.js', c);
    const tags = [];
    const original = c.CombatEngine.triggerEvent;
    c.CombatEngine.triggerEvent = function(tag, ...args) { tags.push(tag); return original.call(this, tag, ...args); };
    evaluate('js/death-save-runtime.js', c);
    for (const file of ['schema', 'adapters', 'engine-bridge', 'queue', 'resolver']) evaluate(`js/combat-action-${file}.js`, c);
    const a = unit('a', rank, 3), b = unit('b');
    a.statusEffects.bleed = { potency: 4, count: 10 };
    const action = c.LuminousCombatActionAdapters.compileSkillToCombatAction(a, skill, { targetId: 'b' });
    const resolved = c.LuminousCombatActionResolver.resolveCombatAction(action, { phase: 'combat_phase', units: [a, b],
      engine: c.CombatEngine, coinwiseResolution, combatActionQueue: c.LuminousCombatActionQueue });
    assert.equal(b.hp, 100, `fatal Bleed cannot hit: ${rank}, coinwise=${coinwiseResolution}`);
    assert.equal(a.hp, 0, JSON.stringify(resolved));
    assert.equal(a.lifeState, rank === 'normal' ? 'dead' : 'downed');
    assert.equal(tags.filter(t => t === '[Coin Start]').length, 1);
    assert.equal(tags.some(t => ['[On Hit]', '[Heads]', '[Tails]', '[Attack End]'].includes(t)), false);
    if (rank !== 'normal') assert.equal(a.deathSaves.failures, 1, 'no duplicate status failure');
  }
}

// All kill variants are withheld for a first knockdown, then fire once on death.
for (const rank of ['captain', 'leader', 'normal']) {
  const c = makeContext({ STATUS_REGISTRY: {} });
  c.Math.random = () => 0; // deterministic heads + critical
  evaluate('js/combatEngine.js', c);
  const tags = [], lifeEvents = [];
  c.LuminousArchetypeCombatEventRuntime = { dispatchForUnit: tag => lifeEvents.push(tag) };
  const original = c.CombatEngine.triggerEvent;
  c.CombatEngine.triggerEvent = function(tag, ...args) { tags.push(tag); return original.call(this, tag, ...args); };
  evaluate('js/death-save-runtime.js', c);
  const a = unit('a'), b = unit('b', rank, 3), attack = { ...skill, coinAmount: 1, coins: skill.coins.slice(0, 1) };
  c.CombatEngine.resolveUnilateralWithCounter(a, attack, b, null);
  const killTags = ['[On Kill]', '[On Crit Kill]', '[On Crit Kill Against Enemy]'];
  for (const tag of killTags) assert.equal(tags.filter(t => t === tag).length, rank === 'normal' ? 1 : 0);
  if (rank !== 'normal') {
    assert.equal(b.lifeState, 'downed');
    for (let i = 0; i < 3; i++) c.CombatEngine.resolveUnilateralWithCounter(a, { ...skill, coinAmount: 1, coins: skill.coins.slice(0, 1) }, b, null);
  }
  assert.equal(b.lifeState, 'dead');
  for (const tag of killTags) assert.equal(tags.filter(t => t === tag).length, 1, tag + ' once');
  assert.equal(lifeEvents.filter(t => t === 'on_death').length, 1);
}

// Extract complete top-level production functions; only presentation/services
// are stubbed. HP damage, healing, targeting, backup and Death Saves are real.
const source = read('combat/source/combat-v073-live.html');
function sourceFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const end = source.indexOf('\n}', start);
  assert.ok(end > start, name);
  return source.slice(start, end + 2);
}
function incrementalContext() {
  const combatData = { a: unit('a'), b: unit('b'), reserve: { ...unit('reserve'), isBackup: true, battleActive: false } };
  const c = makeContext({ combatData, round: 1, PLAYER_ID: 'a', AUTO_UNIT_IDS: [],
    $: () => null, setTimeout: () => 0, clearTimeout() {},
    combatantHpPct: (u, hp) => hp / u.maxHp * 100,
    concentrationState: () => null, syncCombatantVitalNumber() {}, syncUnitVisibility() {}, syncUnitActionState() {},
    cancelUnitActions() {}, clearIncomingTargets() {}, scheduleCrossedStaggerThresholds() {},
    isCharmedAgainst: () => false, unitHasStatus: () => false, statusModifier: () => 0,
    effectiveResistanceFor: () => ({ multiplier: 1 }), statusDamagePercent: () => 0,
    statusDamageMultiplier: () => 1, statusLevelDamageMultiplier: () => 1, statusCritChance: () => 0,
    absorbShieldDamage: (_, damage) => ({ remaining: damage, absorbed: 0 }), showFloatingDamage() {},
    normalizeDamageType: x => x, normalizeElement: x => x, statusHealingMultiplier: () => 1,
    unitSlots: () => [], transferPlayerControlToBackup: () => false,
    conditionTargetBlocked: () => false, invisibleTargetableBy: () => true,
    isStaggerEffectActive: () => false, activeGrappleForUnit: () => null, showFloatingRecovery() {}
  });
  evaluate('js/death-save-runtime.js', c);
  evaluate('js/combat-deployment-runtime.js', c);
  evaluate('js/combat-v073-steps.js', c);
  evaluate('js/unit-universal-action-policy.js', c);
  evaluate('js/unit-universal-action-runtime.js', c);
  for (const name of ['clearHpAnimation', 'setCombatantHP', 'damageCombatant', 'healCombatant', 'isUnitTargetable',
    'validTargetUnits', 'unitActionBlocked', 'backupReserveForFaction', 'vacantBattleUnits', 'prepareBackupDeployment',
    'processDeathSavesRoundEnd', 'processTurnEndExitActions', 'processBackupRecovery']) vm.runInContext(sourceFunction(name), c);
  return c;
}
function stepsFor(c, bleedOwner) {
  const rules = {
    unit: id => c.combatData[id], data: plan => plan.data,
    isUnitTargetable: c.isUnitTargetable,
    statusAttackPowerModifier: () => 0, targetFinalPowerVulnerabilityBonus: () => 0,
    clashLevelPowerBonus: () => 0, statusClashPowerModifier: () => 0,
    rollSide: () => 'tail', coinHeadsChanceForUnit: () => 50, coinSrc: () => '',
    consumeParalysisOnHead: () => false,
    triggerBleedOnCoinFlip: id => {
      if (id === bleedOwner) c.damageCombatant(id, 4, { fixed: true, sourceStatus: 'bleed' });
    },
    damageCombatant: c.damageCombatant, healCombatant: c.healCombatant,
    resolveEvadeAgainstCoin: () => ({ evaded: false }), triggerGettingHitStatuses() {},
    applySkillStatusEffects() {}, triggerCounterAfterHit() {}, processConditionRemovalTrigger() {}, markEntryStarted() {},
    healCombatantSP() {},
    unopposedTargetId: entry => Object.values(c.combatData).find(u => u.faction !== c.combatData[entry.ownerId].faction && c.isUnitTargetable(u))?.id
  };
  return c.LuminousCombatSteps.create({ rules, context: () => ({ round: c.round }),
    snapshot: () => JSON.parse(JSON.stringify(c.combatData)) });
}
const entry = (ownerId, targetId) => ({ ownerId, localIndex: 0, plan: { targetId,
  data: { ...skill, finalPowerBonus: 0 } } });

// Clash death/Downed on either side preserves every surviving coin, within the
// same consumed entry; no external requeue or phantom Clash win is required.
for (const fallenId of ['a', 'b']) {
  for (const rank of ['captain', 'leader', 'normal']) {
    const c = incrementalContext(), survivorId = fallenId === 'a' ? 'b' : 'a';
    c.combatData[fallenId] = unit(fallenId, rank, 3);
    c.combatData.alternative = { ...unit('alternative'), faction: c.combatData[fallenId].faction };
    const runtime = stepsFor(c, fallenId);
    const result = await runtime.clash(entry('a', 'b'), entry('b', 'a'));
    assert.equal(result.winner.ownerId, survivorId);
    assert.equal(result.spGain, 0);
    assert.equal(c.combatData[survivorId].hp, 100, 'incapacitated actor never damages survivor');
    const hitEvents = runtime.events().filter(e => e.type === 'HitResolved');
    assert.equal(hitEvents.length, 3, 'survivor keeps three unopposed coins');
    assert.ok(hitEvents.every(e => e.ownerId === survivorId));
    assert.ok(runtime.events().some(e => e.type === (rank === 'normal' ? 'UnitDefeated' : 'UnitDowned') && e.unitId === fallenId));
    if (rank === 'normal') {
      assert.equal(c.combatData.alternative.hp, 88, 'confirmed death retargets a legal enemy');
    } else {
      assert.equal(c.combatData[fallenId].lifeState, 'downed');
      assert.equal(c.combatData[fallenId].deathSaves.failures, 2, 'one status failure + one skill failure, not per coin');
    }
  }
}

for (const rank of ['captain', 'leader']) {
  const c = incrementalContext(); c.combatData.b = unit('b', rank, 3);
  const runtime = stepsFor(c);
  await runtime.hits(entry('a', 'b'), 'b', 1);
  assert.equal(c.combatData.b.lifeState, 'downed');
  assert.equal(c.combatData.b.deathSaves.failures, 0);
  assert.ok(runtime.events().some(e => e.type === 'UnitDowned' && e.changes === undefined));
  const stateAtHit = runtime.events().find(e => e.type === 'HitResolved').changes.find(x => x.unitId === 'b').after;
  assert.equal(stateAtHit.lifeState, 'downed', 'transition is committed before snapshot/event');
  assert.equal(c.isUnitTargetable(c.combatData.b), true);
  assert.equal(c.unitActionBlocked(c.combatData.b), true);
  assert.ok(c.validTargetUnits(c.combatData.reserve, 'ally').some(u => u.id === 'b') === false, 'off-field healer cannot act');
  c.combatData.healer = { ...unit('healer'), faction: 'enemy' };
  assert.ok(c.validTargetUnits(c.combatData.healer, 'ally').some(u => u.id === 'b'), 'healing can select Downed');
  assert.equal(c.LuminousCombatDeploymentRuntime.isDefeated(c.combatData.b), false);
  assert.equal(c.prepareBackupDeployment('enemy').length, 0);
  c.Math.random = () => 0; // guaranteed success on real Death Save check
  c.processDeathSavesRoundEnd(1);
  assert.equal(c.combatData.b.deathSaves.successes, 1);
  c.processDeathSavesRoundEnd(1);
  assert.equal(c.combatData.b.deathSaves.successes, 1, 'same round cannot roll twice');
  assert.equal(c.combatData.b.battleActive, true);
  assert.equal(c.combatData.reserve.battleActive, false);
  c.healCombatant('b', 5);
  assert.equal(c.combatData.b.lifeState, 'alive');
  assert.equal(c.combatData.b.incapacitated, false);
  assert.equal(c.combatData.b.hp, 5);

  // A death after Downed emits UnitDefeated even though HP stays at zero.
  c.setCombatantHP('b', 0);
  for (let i = 0; i < 3; i++) runtime.mutate('StatusTick', null, {}, () => c.damageCombatant('b', 1, { fixed: true, sourceStatus: 'burn' }));
  assert.equal(runtime.events().filter(e => e.type === 'UnitDefeated' && e.unitId === 'b').length, 1);
  assert.equal(c.LuminousCombatDeploymentRuntime.isDefeated(c.combatData.b), true);
  assert.equal(c.prepareBackupDeployment('enemy').length, 1, 'only confirmed death creates a vacancy');
}

// Both return paths must preserve recovery earned while waiting in BACKUP.
for (const rank of ['captain', 'leader']) {
  for (const path of ['incremental', 'bridge']) {
    const c = incrementalContext();c.combatData.b = { ...unit('b', rank, 3), sp: 20 };
    c.setCombatantHP('b', 0);c.Math.random = () => 0;
    for (const round of [1, 2, 3]) c.processDeathSavesRoundEnd(round);
    assert.equal(c.combatData.b.lifeState, 'retreated');
    assert.equal(c.combatData.b.incapacitated, false);
    assert.equal(c.combatData.b.retreatSnapshot.hp, 5);
    c.processTurnEndExitActions(3);
    assert.equal(c.prepareBackupDeployment('enemy').length, 1);
    assert.equal(c.isUnitTargetable(c.combatData.reserve), true);
    assert.equal(c.combatData.b.isBackup, true);
    c.processBackupRecovery();c.processBackupRecovery();
    assert.equal(c.combatData.b.hp, 10, "Recovery runs once per round");
    c.round++;c.processBackupRecovery();
    assert.equal(c.combatData.b.hp, 15, 'two reserve recovery ticks grant 10 HP');
    assert.equal(c.combatData.b.sp, 14, 'SP changes in reserve are current state too');
    assert.equal(c.combatData.b.retreatSnapshot.hp, 5, 'retreat snapshot remains historical');
    let returned;
    if (path === 'incremental') {
      c.setCombatantHP('reserve', 0);
      assert.equal(c.prepareBackupDeployment('enemy').length, 1);
      returned = c.combatData.b;
    } else {
      c.LuminousCombat073 = { combatants: () => c.combatData };
      const state = { role: 'dm', round: 5,
        combatants: { a: copyUnit(c.combatData.a), reserve: copyUnit(c.combatData.reserve) },
        db: { ref: () => ({ on() {}, off() {}, update: async () => {} }) } };
      c.LuminousCombatLiveAdapter073 = { state, hydrateNow() {} };
      evaluate('js/combat-v073-deployment-bridge.js', c);
      const bridge = c.LuminousCombatDeploymentBridge073;
      bridge.setReserveCache({ b: c.combatData.b });
      const result = bridge.promoteNextBackup('enemy');
      assert.equal(result.promoted, true);
      returned = result.unit;
      await bridge.state.writeChain;
    }
    assert.equal(returned.hp, 15, `${rank} ${path}: return preserves recovered HP`);
    assert.equal(returned.sp, 14, `${rank} ${path}: return preserves current SP`);
    assert.equal(returned.lifeState, 'alive');
    assert.equal(returned.isBackup, false);
    assert.equal(c.LuminousDeathSaveRuntime.canAct(returned), true);
  }
}
function copyUnit(unit) { return JSON.parse(JSON.stringify(unit)); }
// Legacy reserve records without current vitals still use the saved fallback.
{
  const c = incrementalContext(), legacy = { id: 'legacy', lifeState: 'retreated', isRetreated: true,
    retreatSnapshot: { hp: 5, sp: -8 } };
  assert.equal(c.LuminousDeathSaveRuntime.returnFromRetreat(legacy, { force: true }).returned, true);
  assert.equal(legacy.hp, 5);
  assert.equal(legacy.sp, 0);
}

// Compact/restore/persist the life state for all viewers and checkpoint recovery.
{
  const c = incrementalContext();
  c.LuminousCombat073 = { combatants: () => c.combatData, render() {} };
  evaluate('js/combat-v073-authority.js', c);
  c.damageCombatant('b', 100, { fixed: true, sourceStatus: 'bleed' }); // normal dies
  c.combatData.a.rank = 'leader'; c.setCombatantHP('a', 0);
  c.combatData.a.deathSaves.failures = 2;
  const authority = c.LuminousCombatAuthority073, snapshot = authority.snapshotRuntime();
  assert.equal(snapshot.a.isDowned, true);
  assert.equal(snapshot.a.deathSaves.failures, 2);
  const updates = authority.combatantFirebaseUpdates(snapshot);
  assert.equal(updates['campaña/combate/combatants/a/lifeState'], 'downed');
  c.combatData.a.lifeState = 'alive'; c.combatData.a.isDowned = false;
  c.combatData.a.deathSaves.failures = 0;
  authority.applySnapshot(snapshot);
  assert.equal(c.combatData.a.lifeState, 'downed');
  assert.equal(c.combatData.a.deathSaves.failures, 2);
}
// The live bridge must archive confirmed deaths even when isField already
// excludes their death flags, while leaving a Downed record in FIELD.
for (const rank of ['captain', 'leader', 'normal']) {
  const c = incrementalContext(), writes = [];
  c.combatData.b = { ...unit('b', rank, 3), inventory: { dagger: { id: 'iron_dagger' } } };
  c.LuminousCombat073 = { combatants: () => c.combatData };
  const state = { role: 'dm', round: 1, combatants: JSON.parse(JSON.stringify(c.combatData)),
    db: { ref: () => ({ on() {}, off() {}, update: async updates => writes.push(updates) }) } };
  c.LuminousCombatLiveAdapter073 = { state, hydrateNow() {} };
  evaluate('js/combat-v073-deployment-bridge.js', c);
  const bridge = c.LuminousCombatDeploymentBridge073;
  bridge.setReserveCache({ reserve: c.LuminousCombatDeploymentRuntime.markBackup(c.combatData.reserve) });
  c.setCombatantHP('b', 0);
  if (rank !== 'normal') {
    assert.equal(bridge.reconcileDefeatedRuntime().changed, false);
    assert.ok(state.combatants.b);
    c.LuminousDeathSaveRuntime.resolveDeath(c.combatData.b);
  }
  assert.equal(c.LuminousCombatDeploymentRuntime.isField(c.combatData.b), false);
  const archived = bridge.reconcileDefeatedRuntime();
  assert.equal(archived.transitions.length, 1, 'confirmed death is archived');
  assert.equal(archived.updates['campaña/combate/defeated/b'].inventory.dagger.id, 'iron_dagger');
  assert.equal(archived.updates['campaña/combate/defeated/b'].lootEligible, true);
  assert.equal(state.combatants.b, undefined);
  assert.ok(state.combatants.reserve, 'backup replaces confirmed death');
  await bridge.state.writeChain;
}
console.log('PR1042 real engine + incremental Downed/Clash/kill/deployment/checkpoint regressions: OK');
