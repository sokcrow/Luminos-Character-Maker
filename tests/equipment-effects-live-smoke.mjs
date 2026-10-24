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
