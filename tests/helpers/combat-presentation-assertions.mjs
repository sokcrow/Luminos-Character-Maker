import assert from 'node:assert/strict';

// Render order may differ inside a simultaneous phase. Identity, per-actor
// order, phase boundaries and deadline skew must still agree exactly.
export function comparePresentations(authority, viewer, budgetMs = 400) {
  const bySequence = new Map(authority.map(cue => [cue.sequence, cue]));
  assert.equal(bySequence.size, authority.length, 'authority has unique event identities');
  assert.equal(viewer.length, authority.length, 'no lost or extra visual commands');
  const seen = new Set(); let phase = -1, maxSkewMs = 0;
  for (const actual of viewer) {
    assert.ok(!seen.has(actual.sequence), 'no duplicate visual commands'); seen.add(actual.sequence);
    const expected = bySequence.get(actual.sequence);
    assert.ok(expected, 'no invented visual commands');
    for (const key of ['cue', 'owner', 'index', 'phase']) assert.equal(actual[key], expected[key], `event ${actual.sequence}: ${key}`);
    assert.ok(actual.phase >= phase, 'presentation cannot cross a phase boundary backwards'); phase = actual.phase;
    const skew = Math.abs(actual.at - expected.at); maxSkewMs = Math.max(maxSkewMs, skew);
    assert.ok(skew <= budgetMs, `event ${actual.sequence}: ${skew}ms exceeds live budget`);
  }
  for (const owner of new Set(authority.map(cue => cue.owner))) {
    assert.deepEqual(viewer.filter(cue => cue.owner === owner).map(cue => cue.sequence),
      authority.filter(cue => cue.owner === owner).map(cue => cue.sequence), `actor ${owner}: command order`);
  }
  return maxSkewMs;
}
