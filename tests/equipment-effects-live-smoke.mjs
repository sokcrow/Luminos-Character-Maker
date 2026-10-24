import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const live = read('combat/source/combat-v073-live.html');
const context = () => {
  const c = vm.createContext({ console, Math, Date, JSON, Map, Set, Promise,
    addEventListener() {}, setTimeout() { return 1; }, clearTimeout() {} });
  c.window = c;
  vm.runInContext(read('js/item-equipment-effects-runtime.js'), c);
  return c;
};
function functionSource(name, async = false) {
  const start = live.indexOf(`${async ? 'async ' : ''}function ${name}(`);
  assert.ok(start >= 0, name);
  const rest = live.slice(start);
  const next = rest.slice(1).search(/\n(?:async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}
const item = (...effects) => ({ instanceId: 'armor', quantity: 1, runtime: { equipmentEffects: effects } });

// Exercise the actual adapter + equipment-reference resolver + sparse loader.
{
  const c = context();
  for (const file of ['combat-participants', 'item-enchantment-combat-link', 'combat-v073-live-adapter']) {
    vm.runInContext(read(`js/${file}.js`), c);
  }
  const adapter = c.LuminousCombatLiveAdapter073;
  const armor = item({ type: 'grant_skill', skillId: 'equipment_only' });
  Object.assign(adapter.state, {
    db: { ref() {} },
    players: { p1: { itemEquipmentRefs: { armor: 'armor' }, inventario_activo: { armor } } },
    combatants: {
      p1: { id: 'p1', isPlayer: true, canonicalPlayerKey: 'p1', battleActive: true, hp: 100, maxHp: 100, skillIds: ['ordinary'] },
      reserve: { id: 'reserve', isBackup: true, equipment: { armor: item({ type: 'grant_skill', skillId: 'reserve_only' }) } },
    }, skills: { unrelated: { name: 'Unrelated' } },
  });
  const fetched = [];
  c.LuminousUniversalLibrary = { async getSkill(db, id) {
    fetched.push(id);
    return { record: { name: id, type: 'attack', inDeck: true, tier: 1 } };
  } };
  vm.runInContext(read('js/combat-v073-library-client.js'), c);
  const loader = c.LuminousCombatLibraryClient073;
  await loader.state.pending;
  assert.deepEqual([...loader.requiredIds()], ['equipment_only', 'ordinary']);
  assert.deepEqual(fetched.sort(), ['equipment_only', 'ordinary'], 'Equipment-only definition fetched at initial load');
  assert.equal(adapter.state.skills.unrelated, undefined, 'Catalog remains sparse');
  const kit = adapter.kitsFor(adapter.normalizedCombatants()).p1;
  const granted = kit.actions.find(row => row.id === 'equipment_only');
  assert.ok(granted, 'Canonical equipment Skill survives kit hydration');
  assert.equal(granted.inDeck, false);
  assert.equal(granted.availability.type, 'granted');
  const equippedSignature = adapter.hydrationSignature(adapter.normalizedCombatants(), 'p1');
  armor.broken = true;
  assert.notEqual(adapter.hydrationSignature(adapter.normalizedCombatants(), 'p1'), equippedSignature, 'Passive changes trigger live hydration');
  await loader.ensureSkills();
  assert.equal(adapter.state.skills.equipment_only, undefined, 'Broken equipment revokes sparse grants');
  assert.equal(adapter.kitsFor(adapter.normalizedCombatants()).p1.actions.some(row => row.id === 'equipment_only'), false);

  // Legacy bodyAugmentations must survive both supported live data sources.
  for (const owner of [adapter.state.combatants.p1, adapter.state.players.p1]) {
    const eye = { ...item(
      { type: 'skill_check_bonus', skill: 'perception', value: 2 },
      { type: 'grant_skill', skillId: 'eye_only' },
    ), instanceId: 'eye', installed: true };
    owner.bodyAugmentations = [eye];
    const before = c.LuminousEquipmentEffects.skillCheckBonus(owner, 'perception');
    assert.equal(before, 2);
    const units = adapter.normalizedCombatants();
    assert.equal(c.LuminousEquipmentEffects.skillCheckBonus(units[0], 'perception'), before, 'bodyAugmentations bonuses survive normalization');
    assert.deepEqual([...c.LuminousEquipmentEffects.grantedSkillIds(units[0])], ['eye_only']);
    assert.deepEqual([...loader.requiredIds()], ['eye_only', 'ordinary'], 'Sparse loading includes the installed eye grant');
    await loader.ensureSkills();
    assert.ok(adapter.state.skills.eye_only, 'Canonical eye Skill is fetched');
    const eyeSkill = adapter.kitsFor(units).p1.actions.find(row => row.id === 'eye_only');
    assert.equal(eyeSkill.inDeck, false);
    assert.equal(eyeSkill.availability.type, 'granted');
    eye.installed = false;
    assert.equal(c.LuminousEquipmentEffects.skillCheckBonus(adapter.normalizedCombatants()[0], 'perception'), 0);
    await loader.ensureSkills();
    assert.equal(adapter.state.skills.eye_only, undefined, 'Uninstalled eye no longer grants a Skill');
    delete owner.bodyAugmentations;
  }

  const creature = { id: 'beast', battleActive: true, actions: [{ id: 'bite', name: 'Bite', type: 'attack' }],
    equipment: { shield: item({ type: 'grant_skill', skillId: 'equipment_only' }) } };
  adapter.state.combatants = { beast: creature };
  await loader.ensureSkills();
  let attacks = adapter.kitsFor(adapter.normalizedCombatants()).beast.actions;
  assert.deepEqual([...attacks].map(row => row.id), ['bite', 'equipment_only'], 'Equipment adds to embedded attacks');
  assert.equal(attacks[1].inDeck, false);
  creature.equipment = {};
  attacks = adapter.kitsFor(adapter.normalizedCombatants()).beast.actions;
  assert.deepEqual([...attacks].map(row => row.id), ['bite'], 'Unequipping preserves embedded attacks');
  creature.skillIds = ['ordinary'];
  creature.equipment = { shield: item({ type: 'grant_skill', skillId: 'ordinary' }) };
  await loader.ensureSkills();
  attacks = adapter.kitsFor(adapter.normalizedCombatants()).beast.actions;
  assert.deepEqual([...attacks].map(row => row.id), ['ordinary'], 'Normal catalog fallback and deduplication remain intact');
  assert.notEqual(attacks[0].inDeck, false, 'Equipment cannot remove an already-owned attack from its deck');
}

// Canonical wear damage disables every effect, without boolean broken flags.
{
  const c = context();
  vm.runInContext(read('js/item-inventory-runtime.js'), c);
  const inventory = c.LuminousItemInventoryRuntime, effects = c.LuminousEquipmentEffects;
  const armor = item(
    { type: 'sp_loss_reduction', value: 3 },
    { type: 'sin_resistance', sin: 'gloom', multiplier: 0.5 },
    { type: 'skill_check_bonus', skill: 'perception', value: 2 },
    { type: 'check_threshold_reduction', check: 'analyze', value: 2 },
    { type: 'heal_hp_percent', trigger: 'on_turn_start', value: 10 },
    { type: 'grant_skill', skillId: 'bash' },
  );
  const unit = { hp: 50, maxHp: 100, equipment: { armor } };
  assert.equal(effects.mitigateSpLoss(unit, 8), 5);
  assert.equal(inventory.damageCondition(armor, 100).state.id, 'broken');
  assert.equal(armor.broken, undefined);
  assert.equal(effects.mitigateSpLoss(unit, 8), 8);
  assert.equal(effects.resolveSinResistance(unit, 'gloom', 1), 1);
  assert.equal(effects.skillCheckBonus(unit, 'perception'), 0);
  assert.equal(effects.checkThresholdAdjustment(unit, 'analyze'), 0);
  assert.deepEqual([...effects.grantedSkillIds(unit)], []);
  effects.applyTurnStart(unit, { authoritative: true, round: 1 });
  assert.equal(unit.hp, 50);
  armor.condition = 100;
  assert.equal(effects.mitigateSpLoss(unit, 8), 5, 'Repair restores active effects');
  delete c.LuminousItemInventoryRuntime;
  armor.condition = 0;
  assert.equal(effects.mitigateSpLoss(unit, 8), 8, 'Early hydration without inventory runtime still excludes explicitly broken equipment');
}

// The live observation UI and animated roll share equipment-adjusted math.
{
  const c = context(), header = {}, buttons = [];
  const ring = { innerHTML: '', classList: { add() {} }, setAttribute() {}, appendChild(button) { buttons.push(button); } };
  Object.assign(header, { classList: { add() {} }, setAttribute() {} });
  const eye = { ...item({ type: 'skill_check_bonus', skill: 'perception', value: 2 },
    { type: 'check_threshold_reduction', check: 'analyze', value: 2 }), installed: true };
  const actor = { id: 'player', augmentations: [eye] };
  const enemy = { id: 'enemy', name: 'Enemy', faction: 'enemy', observationKnown: [] };
  const rolls = [];
  Object.assign(c, {
    PLAYER_ID: 'player', combatData: { player: actor, enemy }, round: 1, observationUsedTurn: 0, observationRolling: false,
    PLAYER_SCORES: { perception: { score: 12, mod: 1 }, insight: { score: 10, mod: 0 } },
    OBSERVATION_META: { hp: { stat: 'perception', label: 'CHECK HP' } }, OBSERVATION_FACTS: ['hp'],
    CHECK_COIN_COUNT: 5, CHECK_COIN_POWER: 4,
    document: { createElement() { return {}; } }, requestAnimationFrame() {},
    $(id) { return id === 'observation-ring' ? ring : id === 'observation-header' ? header : {}; },
    observationKnown(unit, fact) { return unit.observationKnown.includes(fact); }, observationFactAvailable() { return true; },
    observationLevel() { return 1; }, observationLevelMarkup() { return ''; }, observationLinkedUnits: unit => [unit],
    observationRollMarkup: last => last ? `TH${last.threshold}` : '', formatModifier: mod => `+${mod}`,
    coinHeadsChanceForUnit() { return 50; }, unitHasStatus() { return false; }, setStatus() {},
    revealObservationFact(unit) { return [unit]; },
    LuminousCoinEngine: { async runAnimatedRoll(options) { rolls.push(options); return { total: options.base + 4, heads: 1, coins: [] }; } },
  });
  for (const name of ['observationDifficulty', 'observationThreshold', 'observationModifier', 'renderObservationRing']) {
    vm.runInContext(functionSource(name), c);
  }
  vm.runInContext(functionSource('performObservation', true), c);
  c.renderObservationRing('enemy');
  assert.match(buttons.at(-1).innerHTML, /PERCEPTION \+3 · D1 · TH7/);
  assert.match(header.innerHTML, /PERCEPTION 12 \/ \+3/);
  await c.performObservation('enemy', 'hp');
  assert.equal(rolls[0].base, 3, 'Animated roll receives the equipment bonus');
  assert.equal(enemy.observationLastCheck.threshold, 7);
  assert.equal(enemy.observationLastCheck.success, true);
  assert.match(header.innerHTML, /TH7/);
  assert.equal(c.PLAYER_SCORES.perception.mod, 1, 'Base scores are not permanently modified');
  eye.installed = false;
  c.round = 2;
  await c.performObservation('enemy', 'hp');
  assert.equal(rolls[1].base, 1);
  assert.equal(enemy.observationLastCheck.threshold, 9);
  assert.equal(enemy.observationLastCheck.success, false);
}

// Execute the live Sinking and Skill damage functions, not CombatEngine doubles.
{
  const c = context();
  Object.assign(c, {
    round: 1, $() { return null; }, unitHasStatus: (unit, id) => Boolean(unit.statusEffects?.[id]),
    syncUnitVisibility() {}, getCombatStatus: (unit, id) => unit.statusEffects?.[id], statusDefinition() { return {}; },
    consumeStatusCount(id, status, count) { c.combatData[id].statusEffects[status].count -= count; }, pulseStatusIcon() {},
    DAMAGE_RESISTANCE_MULTIPLIERS: { NORMAL: 1, RESIST: 0.5, WEAK: 2 }, STAGGER_FATAL_MULTIPLIERS: { 1: 2 },
    isStaggerEffectActive: unit => unit.staggerStage > 0,
    statusDamagePercent() { return 0; }, statusDamageMultiplier() { return 1; }, statusLevelDamageMultiplier() { return 1; },
    statusCritChance() { return 0; }, statusModifier() { return 0; }, statusPotency() { return 0; },
    absorbShieldDamage(id, damage) { return { remaining: damage, absorbed: 0 }; }, showFloatingDamage() {},
    setCombatantHP(id, hp) { c.combatData[id].hp = hp; }, removeCombatStatus() {}, normalizeElement: value => value,
  });
  for (const name of ['normalizeDamageType', 'resistanceStateFor', 'resistanceMultiplierFor', 'staggerFatalMultiplierFor',
    'sinResistanceForDamage', 'effectiveResistanceFor', 'damageCombatant', 'damageCombatantSP', 'triggerSinkingOnHit', 'forecastSingleHitDamage']) {
    vm.runInContext(functionSource(name), c);
  }
  const armor = item({ type: 'sp_loss_reduction', value: 3 }, { type: 'sin_resistance', sin: 'gloom', multiplier: 0.5 });
  const unit = { id: 'target', hp: 100, maxHp: 100, sp: 20, equipment: { armor }, statusEffects: { sinking: { potency: 8, count: 2 } } };
  c.combatData = { target: unit };
  c.triggerSinkingOnHit('target');
  assert.equal(unit.sp, 15);
  assert.equal(unit.statusEffects.sinking.count, 1);
  unit.statusEffects.sleep = {};
  c.damageCombatantSP('target', 2);
  assert.equal(unit.sp, 12, 'Sleep amplifies incoming loss before flat mitigation');
  delete unit.statusEffects.sleep;
  c.damageCombatantSP('target', 5, { isCost: true });
  assert.equal(unit.sp, 7, 'Voluntary costs remain intact');
  const options = { damageType: 'SLASH', skillData: { sinAffinity: 'gloom' } };
  assert.equal(c.damageCombatant('target', 20, options).finalDamage, 10);
  assert.equal(c.forecastSingleHitDamage(20, null, unit, 'SLASH', options.skillData), 10);
  assert.equal(c.damageCombatant('target', 20, { damageType: 'GLOOM' }).finalDamage, 10, 'Direct Sin damage applies resistance once');
  assert.equal(c.damageCombatant('target', 20, { ...options, ignoreResistance: true }).finalDamage, 20);
  assert.equal(c.damageCombatant('target', 20, { ...options, fixed: true }).finalDamage, 20);
  unit.staggerStage = 1;
  assert.equal(c.damageCombatant('target', 20, options).finalDamage, 20, 'Stagger preserves the independent Sin multiplier');
  unit.staggerStage = 0;
  armor.runtime.equipmentEffects[1].multiplier = 0;
  assert.equal(c.damageCombatant('target', 20, options).finalDamage, 0, 'Explicit immunity does not inflict minimum damage');
  armor.broken = true;
  assert.equal(c.damageCombatant('target', 20, options).finalDamage, 20);
  c.damageCombatantSP('target', 5);
  assert.equal(unit.sp, 2);
  delete unit.sp;
  armor.broken = false;
  armor.runtime.equipmentEffects[1].multiplier = 0.5;
  const before = unit.hp;
  c.triggerSinkingOnHit('target');
  assert.equal(unit.hp, before - 4, 'Sinking uses Gloom resistance on units without SP');
}

// Run the real startRound restoration branch through its first timeline call.
for (const checkpoint of [false, true]) {
  const c = context();
  const armor = item({ type: 'heal_hp_percent', trigger: 'on_turn_start', value: 10 });
  const savedUnit = { id: 'target', hp: checkpoint ? 60 : 50, maxHp: 100, equipment: { armor } };
  if (checkpoint) savedUnit.equipmentEffectTurnLedger = { 'enc:1:armor:0': true };
  c.combatData = { target: { ...copy(savedUnit), hp: 99, equipmentEffectTurnLedger: { 'enc:1:armor:0': true } } };
  const recovered = { units: { target: copy(savedUnit) }, queue: [], resolvedKeys: [], eventCursor: checkpoint ? 5 : 0 };
  const stop = new Error('stop after startup');
  const restore = live.slice(live.indexOf('  restoreExecution(queue,resolvedKeys,saved){'), live.indexOf('  async present(cue,args){')).trim().replace(/,$/, '');
  Object.assign(c, {
    round: 1, roundRunning: false, planReady: true, navState: 'root', viewModeActive: false, analyseModeActive: false,
    targetingModeActive: false, activeGrapples: [], grappleSerial: 0, unitSlots() { return []; },
    hideClashForecast() {}, syncReadyControl() {}, $() { return { classList: { add() {} } }; },
    setCameraFocus() {}, async wait() {}, COMBAT_PACE: { cameraSettle: 0 }, buildExecutionQueue() { return []; }, armReactiveDefenses() {},
    setCombatantHP(id, hp) { c.combatData[id].hp = hp; },
    LuminousCombatLiveAdapter073: { state: { encounterId: 'enc' } },
    LuminousCombatAuthority073: { isDm() { return true; }, state: { resumeRuntime: recovered } },
    async executeCombatTimeline() {
      assert.equal(c.combatData.target.hp, 60, checkpoint ? 'Checkpoint regeneration is not repeated' : 'Pre-checkpoint recovery keeps regeneration');
      assert.equal(c.combatData.target.equipmentEffectTurnLedger['enc:1:armor:0'], true);
      throw stop;
    },
  });
  c.LuminousCombatStepRuntime = { restoreExecution: vm.runInContext(`({${restore}}).restoreExecution`, c), beginRound() {}, resetJournal() {} };
  c.combatStepRuntime = () => c.LuminousCombatStepRuntime;
  vm.runInContext(functionSource('applyEquipmentTurnStart'), c);
  vm.runInContext(functionSource('startRound', true), c);
  await assert.rejects(c.startRound(), error => error === stop);
  c.applyEquipmentTurnStart(1);
  assert.equal(c.combatData.target.hp, 60, 'Same-round retry is idempotent');
  c.LuminousCombatAuthority073.isDm = () => false;
  c.applyEquipmentTurnStart(2);
  assert.equal(c.combatData.target.hp, 60, 'Players cannot grant regeneration');
}
console.log('Live equipment: sparse canonical grants, Sinking/Sin mitigation and recovered turn regeneration OK');
