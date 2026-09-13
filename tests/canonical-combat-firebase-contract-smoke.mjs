import assert from 'node:assert/strict';
import combatFirebase from '../js/canonical-combat-firebase.js';

assert.equal(combatFirebase.version, '0.7.3-canonical-firebase-v1');
assert.equal(combatFirebase.ROOT, 'campaña/combate/canonical_v073');
assert.deepEqual(combatFirebase.ROOTS, {
  session: 'campaña/combate/canonical_v073/session',
  combatants: 'campaña/combate/canonical_v073/combatants',
  views: 'campaña/combate/canonical_v073/views',
  plans: 'campaña/combate/canonical_v073/plans',
});
assert.equal(typeof combatFirebase.start, 'function');
assert.equal(typeof combatFirebase.stop, 'function');
assert.equal(typeof combatFirebase.syncRuntime, 'function');

console.log('canonical combat firebase contract smoke: ok');
