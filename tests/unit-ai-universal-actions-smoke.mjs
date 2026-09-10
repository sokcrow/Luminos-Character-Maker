import assert from 'node:assert/strict';

await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');
await import('../js/unit-ai-universal-actions.js');

const schema = globalThis.LuminousCombatAction;
const goap = globalThis.LuminousIndividualGoapCombatAI;
const universal = globalThis.LuminousUnitAiUniversalActions;
const adapter = globalThis.LuminousUnitAiKitAdapter;

if (!schema || !goap || !universal || !adapter) throw new Error('Universal AI dependencies were not initialized.');
assert.equal(adapter.version, '0.3.0');
assert.equal(goap.INTEL_SCHEMA_VERSION, 2);

function weakStrike(id = 'weak_strike') {
  return {
    id,
    name: 'Weak Strike',
    type: 'Attack',
    sourceType: 'skill',
    basePower: 1,
    coinPower: 1,
    coinAmount: 1,
    coinType: 'positive',
    attackWeight: 1,
    damageType: 'slash',
    sinAffinity: 'sinless',
    targetingType: 'Focused Attack',
    isDefense: false,
    isClashable: false,
    isUnclashable: true,
    resourceCosts: [],
    effects: [],
    coins: [{ index: 0, type: 'normal', status: 'active', effects: [] }],
  };
}

function enemy(id, overrides = {}) {
  return {
    id,
    faction: 'enemy',
    faccion: 'enemy',
    hp: 30,
    maxHp: 30,
    scores: { str: 18, int: 14, wis: 12 },
    skillBonuses: { athletics: 4 },
    resolvedSkills: [weakStrike()],
    ...overrides,
  };
}

// Fairness: Grapple valuation may use the AI's own STR/Athletics and Personal Intel,
// but changing hidden target-sheet stats must not change the candidate before observation.
{
  const actor = enemy('grappler');
  const hiddenWeak = { id: 'player', dex: 2, skillBonuses: { acrobatics: -5 } };
  const hiddenStrong = { id: 'player', dex: 30, skillBonuses: { acrobatics: 20 } };
  const a = universal.universalDescriptors(actor, { targets: [hiddenWeak], allowHelp: false, allowRetreat: false });
  const b = universal.universalDescriptors(actor, { targets: [hiddenStrong], allowHelp: false, allowRetreat: false });
  const grappleA = a.find((entry) => entry.definition.id === 'grapple');
  const grappleB = b.find((entry) => entry.definition.id === 'grapple');
  assert.ok(grappleA && grappleB);
  assert.equal(grappleA.aiEstimate.control, grappleB.aiEstimate.control);
  assert.equal(grappleA.metadata.universalPolicy, 'self_capability_plus_personal_intel');
  assert.equal(a.some((entry) => entry.definition.id === 'help'), false, '1v1 must not fabricate a Help target');
}

// Grapple is a real GOAP control action, not just an exposed button. It can beat a weak
// attack under GAIN_ADVANTAGE, but maxUsesPerTurn prevents spamming the same Grapple.
{
  const actor = enemy('control_ai');
  const plan = adapter.planUnitTurn({
    actor,
    targetIds: ['player'],
    availableSlots: 2,
    slotIds: ['control_ai_slot_0', 'control_ai_slot_1'],
    goal: goap.GOALS.GAIN_ADVANTAGE,
    allowEscape: false,
    allowHelp: false,
    allowRetreat: false,
  });
  assert.equal(plan.planned, true);
  const grapples = plan.actions.filter((action) => action.source?.id === 'grapple');
  assert.equal(grapples.length, 1, 'Grapple should be limited to one use in the planned turn');
  assert.equal(grapples[0].resolution.type, 'contest');
  assert.equal(grapples[0].targeting.mainTargetId, 'player');
  assert.equal(schema.validateCombatAction(grapples[0]).valid, true);
}

// Personal Intel learns from observed contests instead of reading the player's private sheet.
{
  let losses = {};
  let wins = {};
  for (let i = 0; i < 4; i += 1) {
    losses = goap.observeContestResult(losses, { targetId: 'player', contestId: 'grapple', won: false });
    wins = goap.observeContestResult(wins, { targetId: 'player', contestId: 'grapple', won: true });
  }
  const actor = enemy('learning_grappler');
  const losingEstimate = universal.grappleEstimate(actor, { intel: losses }, 'player');
  const winningEstimate = universal.grappleEstimate(actor, { intel: wins }, 'player');
  assert.ok(losingEstimate.control < winningEstimate.control, `${losingEstimate.control} should be lower than ${winningEstimate.control}`);
  assert.ok(losses.targets.player.contests.grapple.confidence > 0);
  assert.equal(losses.targets.player.contests.grapple.losses, 4);
}

// Help exists only when a visible allied CombatAction has already been committed. The
// compiled action must point at that exact action/slot, never at a future allied decision.
{
  const actor = enemy('helper_ai', { scores: { str: 7, int: 16, wis: 12 }, skillBonuses: { athletics: 0 } });
  const committed = {
    id: 'ally_attack_action',
    actorId: 'ally_kobold',
    actionSlotId: 'ally_kobold_slot_0',
    phase: { executesAt: 'combat_phase' },
    resolution: { type: 'clash' },
    metadata: { basePower: 12, coinPower: 6, coinAmount: 3 },
  };
  const plan = adapter.planUnitTurn({
    actor,
    targetIds: ['player'],
    availableSlots: 1,
    slotIds: ['helper_ai_slot_0'],
    goal: goap.GOALS.GAIN_ADVANTAGE,
    allowEscape: false,
    allowGrapple: false,
    allowRetreat: false,
    alliedCommittedActions: [committed],
  });
  assert.equal(plan.planned, true);
  assert.equal(plan.actions[0].source.id, 'help');
  assert.equal(plan.actions[0].targeting.mainTargetId, 'ally_kobold');
  assert.equal(plan.actions[0].effects[0].targetActionId, 'ally_attack_action');
  assert.equal(plan.actions[0].metadata.targetActionSlotId, 'ally_kobold_slot_0');
  assert.equal(schema.validateCombatAction(plan.actions[0]).valid, true);

  const alreadyCommittedHelp = {
    id: 'prior_help_action',
    actorId: 'prior_helper',
    actionSlotId: 'prior_helper_slot_0',
    source: { type: 'universal', id: 'help' },
    phase: { executesAt: 'combat_phase' },
  };
  const secondHelperSources = universal.universalDescriptors(actor, {
    targetIds: ['player'],
    allowGrapple: false,
    allowRetreat: false,
    alliedCommittedActions: [committed, alreadyCommittedHelp],
  });
  assert.equal(secondHelperSources.some((entry) => entry.definition.id === 'help'), false, 'canonical Help is once per team, so later planners must not spend another slot on it');
}

// At critical HP, Retreat becomes an immediate withdrawal option. The Unit must not attack
// first and then retreat just because it has a second Action Slot.
{
  const actor = enemy('retreat_ai', { hp: 6, maxHp: 30, scores: { str: 8, int: 10, wis: 16 }, skillBonuses: { athletics: 0 } });
  const plan = adapter.planUnitTurn({
    actor,
    targetIds: ['player'],
    availableSlots: 2,
    slotIds: ['retreat_ai_slot_0', 'retreat_ai_slot_1'],
    allowEscape: false,
    allowGrapple: false,
    allowHelp: false,
  });
  assert.equal(plan.goal, goap.GOALS.ESCAPE);
  assert.equal(plan.actions[0].source.id, 'retreat');
  assert.equal(plan.actions[0].phase.executesAt, schema.PHASES.ON_TURN_END);
  assert.equal(plan.actions.length, 1, 'critical Retreat is terminal and immediate for that Unit turn');
}

// Improvise fails closed unless the encounter/Unit supplies a concrete resolution or effect.
{
  const actor = enemy('improvise_ai');
  const bare = universal.universalDescriptors(actor, { targetIds: ['player'], allowGrapple: false, allowHelp: false, allowRetreat: false });
  assert.equal(bare.some((entry) => entry.definition.id === 'improvise'), false);

  const plan = adapter.planUnitTurn({
    actor,
    targetIds: ['player'],
    availableSlots: 1,
    slotIds: ['improvise_ai_slot_0'],
    goal: goap.GOALS.GAIN_ADVANTAGE,
    allowEscape: false,
    allowGrapple: false,
    allowHelp: false,
    allowRetreat: false,
    improviseAction: {
      effects: [{ type: 'status', status: 'off_balance', target: 'target', potency: 1, count: 1 }],
      aiEstimate: { advantage: 10, risk: 1 },
    },
  });
  assert.equal(plan.actions[0].source.id, 'improvise');
  assert.equal(plan.actions[0].effects[0].status, 'off_balance');
}

console.log('Unit AI Universal Actions smoke: ok');
