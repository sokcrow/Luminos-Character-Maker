import assert from 'node:assert/strict';

await import('../js/combat-action-schema.js');
await import('../js/combat-action-adapters.js');
await import('../js/individual-goap-combat-ai.js');
await import('../js/unit-ai-kit-adapter.js');
await import('../js/unit-ai-universal-actions.js');

const api = globalThis.LuminousUnitAiUniversalActions;
assert.ok(api, 'Universal Action AI runtime must initialize');

const actor = {
  id: 'retreat_phase_smoke',
  hp: 2,
  maxHp: 20,
  scores: { wis: 12 },
};

const currentViewer = api.universalDescriptors(actor, {
  allowRetreat: true,
  universalActions: ['retreat'],
});
assert.equal(
  currentViewer.some((entry) => entry.definition?.id === 'retreat'),
  false,
  'Retreat must not be offered when the caller cannot execute on_turn_end actions',
);

const turnEndCapable = api.universalDescriptors(actor, {
  allowRetreat: true,
  universalActions: ['retreat'],
  supportedExecutionPhases: ['combat_phase', 'on_turn_end'],
});
assert.equal(
  turnEndCapable.some((entry) => entry.definition?.id === 'retreat'),
  true,
  'Retreat may be offered only when on_turn_end execution is explicitly supported',
);

assert.equal(api.supportsTurnEndActions({ supportsTurnEndActions: true }), true);
assert.equal(api.supportsTurnEndActions({ supportedExecutionPhases: ['combat_phase'] }), false);

console.log('unit AI universal retreat phase smoke: ok');
