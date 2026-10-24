// Both benchmark versions must resolve the same frozen Speed order. This is
// fixture data, never a replacement for production Speed or combat rules.
export function freezeBenchmarkSpeeds(combatants, playerId, clashTargetId, round = 1) {
  if (!combatants?.[playerId] || !combatants?.[clashTargetId]) throw new Error('Benchmark clash participants are missing');
  const entries = Object.entries(combatants).sort(([a], [b]) => a.localeCompare(b));
  entries.forEach(([id, unit], index) => {
    const speed = id === playerId ? 6 : id === clashTargetId ? 5 : 1;
    Object.assign(unit, { speed, speedBaseRoll: speed, speedRollTurn: round, speedTie: (index + 1) / (entries.length + 1) });
  });
  return combatants;
}

// Clash/defense power rolls and unilateral hit rolls are both visible Coins.
// Waiting exclusively for a Clash Coin can time out during valid earlier hits.
export function hasVisibleCombatCoin(cues = []) {
  return cues.some(row => row.cue === 'powerCoin' || row.cue === 'hitCoin');
}
