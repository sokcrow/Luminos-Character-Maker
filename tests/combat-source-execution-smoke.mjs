import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
await import('../js/spell-catalog-core.js');
await import('../js/combat-action-schema.js');
await import('../js/battle-viewer-spell-adapter-074.js');
globalThis.LuminousSpellcastingRuntime = {
  resolveSpellcasting: () => ({ spellMod: 6, spellDC: 15 }),
  canSpendSpellSlot: actor => ({ available: actor.slots > 0 }),
  spendSpellSlot(actor) { if (!actor.slots) return { available: false, spent: 0 }; actor.slots--; return { spent: 1 }; }
};
await import('../js/combat-source-execution.js');
const execution = globalThis.LuminousCombatSourceExecution;
const catalog = globalThis.LuminousSpellCatalog;
const actor = { statusEffects: {}, id: 'caster', faction: 'enemy', hp: 100, level: 20, classes: [{ classId: 'wizard' }], slots: 1 };
const targets = ['a', 'b', 'c', 'd'].map(id => ({ id, faction: 'ally', hp: 100, statusEffects: {} }));
const units = Object.fromEntries([actor, ...targets].map(unit => [unit.id, unit]));

// AI resolves every legal element, and both paths retain exactly the same payload.
for (const element of catalog.chromatic_orb.mechanics.requiresChoice.values) {
  actor.ai = { spellChoices: { chromatic_orb: { element } } };
  const ai = execution.nativeDefinition(actor, catalog.chromatic_orb, { isAi: true });
  const player = execution.nativeDefinition(actor, catalog.chromatic_orb, { choice: { element } });
  assert.equal(ai.ok, true);
  assert.deepEqual(ai.definition, player.definition);
  assert.equal(ai.definition.element, element);
  assert.equal(ai.definition.effects[0].trigger, '[On Hit]');
  assert.equal(ai.definition.effects[0].status, catalog.chromatic_orb.mechanics.elementalStatus[element].status);
  assert.deepEqual(execution.nativeDefinition(actor, ai.definition, { isAi: true }).definition, ai.definition, 'rehydration must not duplicate effects or scaling');
}
assert.equal(execution.prepare(actor, catalog.chromatic_orb).ok, false, 'humans must choose');
assert.equal(execution.prepare(actor, catalog.chromatic_orb, { choice: { element: 'made_up' } }).ok, false);

const spray = execution.nativeDefinition(actor, catalog.poison_spray).definition;
assert.equal(spray.effects[0].potency, 3);
assert.equal(spray.effects[0].doubleIfTargetHasStatus, 'poison');
assert.equal(execution.nativeDefinition(actor, catalog.chill_touch).definition.effects[0].count, 3);
const frost = execution.nativeDefinition(actor, catalog.ray_of_frost).definition;
assert.equal(frost.effects.find(row => row.status === 'chill').count, 2);
assert.equal(frost.effects.find(row => row.status === 'bind').count, 2);
assert.equal(execution.nativeDefinition(actor, catalog.hold_person).definition.failedSaveEffects[0].durationType, 'concentration');

// Exercise the actual packed resolver's status function (not a reimplementation).
const source = readFileSync(new URL('../combat/source/combat-v073-live.html', import.meta.url), 'utf8');
const effectFunction = source.slice(source.indexOf('function applySkillStatusEffects('), source.indexOf('\n\n\nfunction setStatus', source.indexOf('function applySkillStatusEffects(')));
const context = { window: {}, combatData: units, normalizeElement: x => x, isSpellSkill: () => true,
  unitHasStatus: (unit, id) => Boolean(unit.statusEffects[id]),
  skillEffectRows: (data, trigger) => data.effects.filter(effect => effect.trigger === trigger),
  ensureEntryConcentration: () => null,
  applyCombatStatus: (id, status, input) => { const old = units[id].statusEffects[status] || { potency: 0, count: 0 }; units[id].statusEffects[status] = { potency: old.potency + input.potency, count: old.count + input.count }; },
};
vm.createContext(context); vm.runInContext(effectFunction, context);
const entry = { ownerId: actor.id, localIndex: 0, plan: { data: spray, targetId: 'a' } };
context.applySkillStatusEffects(entry, 'a', '[On Hit]');
assert.equal(units.a.statusEffects.poison.potency, 3);
context.applySkillStatusEffects(entry, 'a', '[On Hit]');
assert.equal(units.a.statusEffects.poison.potency, 9, 'second hit adds double potency');

// GOAP's generic compiler must materialize the same complete definition.
await import('../js/combat-action-adapters.js');
const adapters = globalThis.LuminousCombatActionAdapters;
actor.ai = { spellChoices: { chromatic_orb: { element: 'fire' } } };
const compiled = adapters.compileSpellToCombatAction(actor, catalog.chromatic_orb, { isAi: true, slotLevel: 2 });
assert.equal(compiled.metadata.sourceDefinition.coinPower, 11);
assert.equal(compiled.metadata.sourceDefinition.effects[0].status, 'burn');

const orb = execution.nativeDefinition(actor, catalog.chromatic_orb, { isAi: true, slotLevel: 2 }).definition;
entry.plan = { data: orb, targetId: 'a' };
assert.equal(execution.spend(actor, entry.plan, 1).consumed, true);
assert.equal(execution.spend(actor, entry.plan, 1).consumed, true);
assert.equal(actor.slots, 0, 'one slot per cast, including all jumps');
assert.equal(execution.spend(actor, { data: orb }, 1).consumed, false);
assert.equal(execution.nextOrbTarget(entry, 'a', false, units, unit => unit.hp > 0), null);
assert.equal(execution.nextOrbTarget(entry, 'a', true, units, unit => unit.hp > 0), 'b');
assert.equal(execution.nextOrbTarget(entry, 'b', true, units, unit => unit.hp > 0), 'c');
assert.equal(execution.nextOrbTarget(entry, 'c', true, units, unit => unit.hp > 0), null);

// Use the real shared hit executor: all jumps mutate HP, apply statuses, and emit events.
await import('../js/combat-v073-steps.js');
entry.plan = { data: orb, targetId: 'a' };
const engine = globalThis.LuminousCombatSteps.create({ rules: {
  unit: id => units[id], combatants: () => units, canUnitAct: unit => unit.hp > 0,
  isUnitTargetable: unit => unit.hp > 0,
  data: plan => ({ ...plan.data, finalPowerBonus: 0 }),
  statusAttackPowerModifier: () => 0, targetFinalPowerVulnerabilityBonus: () => 0,
  coinHeadsChanceForUnit: () => 50, rollSide: () => 'head', coinSrc: () => '',
  statusModifier: () => 0, consumeStatusCount() {}, triggerBleedOnCoinFlip() {}, consumeParalysisOnHead: () => false,
  damageCombatant(id, amount) { units[id].hp -= amount; return { finalDamage: amount, critical: true }; },
  resolveEvadeAgainstCoin: () => ({ evaded: false }), triggerGettingHitStatuses() {},
  applySkillStatusEffects: context.applySkillStatusEffects,
  triggerCounterAfterHit() {},
}, snapshot: () => structuredClone(units) });
await engine.hits(entry, 'a', 1);
for (const id of ['a', 'b', 'c']) {
  assert.equal(units[id].hp, 84);
  assert.equal(units[id].statusEffects.burn.potency, 1);
}
assert.equal(units.d.hp, 100);
console.log('Complete source execution: choices, native effects, resource charge and orb jumps OK');

// Skills retain all authored event phases in the same native status dispatcher.
const skillEntry = { ownerId: actor.id, plan: { type: 'auto', data: { kind: 'skill', effects: [
  { trigger: '[On Use]', target: 'self', type: 'status', status: 'protection', count: 1 },
  { trigger: '[Clash Win]', type: 'status', status: 'fragile', count: 2 },
  { trigger: '[On Hit]', type: 'status', status: 'rupture', potency: 3, count: 1 },
] } } };
context.applySkillStatusEffects(skillEntry, 'd', '[On Use]');
context.applySkillStatusEffects(skillEntry, 'd', '[Clash Win]');
context.applySkillStatusEffects(skillEntry, 'd', '[On Hit]');
assert.equal(actor.statusEffects.protection.count, 1);
assert.equal(units.d.statusEffects.fragile.count, 2);
assert.equal(units.d.statusEffects.rupture.potency, 3);
assert.equal(execution.useEffects(actor, { data: { kind: 'spell', coinAmount: 0 } }, units).ok, false,
  'missing utility runtime must cancel explicitly instead of silently doing zero damage');
