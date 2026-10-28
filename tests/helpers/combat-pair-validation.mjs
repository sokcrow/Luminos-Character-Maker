// Stable game data only: wall clocks and generated round/session identities are
// deliberately absent. Unit IDs, Coin results and status/shield contents remain.
export function canonicalUnits(units) {
  if (!units || typeof units !== 'object' || Array.isArray(units) || !Object.keys(units).length) throw Error('Missing canonical combatants');
  return Object.fromEntries(Object.entries(units).map(([id,unit])=>[id,{
    hp:unit.hp,sp:unit.sp,lifeState:unit.lifeState||null,
    statusEffects:unit.statusEffects||{},pendingStatusEffects:unit.pendingStatusEffects||[],shieldPools:unit.shieldPools||{},
  }]));
}
export function stable(value) {
  if(Array.isArray(value))return value.map(stable);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])]));
  return value;
}
export const encode=value=>JSON.stringify(stable(value));
export function cueWorkload(cues) {
  if(!Array.isArray(cues)||!cues.length)throw Error('Missing presentation cues');
  const keys=new Set();
  for(const cue of cues){
    if(!Number.isInteger(cue.sequence)||cue.sequence<1||keys.has(cue.sequence))throw Error('Invalid or duplicate presentation sequence');
    keys.add(cue.sequence);
    if(typeof cue.cue!=='string'||!Object.hasOwn(cue,'result')||!Number.isFinite(cue.paintAt))throw Error('Incomplete presentation sample');
  }
  return cues.slice().sort((a,b)=>a.sequence-b.sequence).map(cue=>({cue:cue.cue,owner:cue.owner??null,opponent:cue.opponent??null,index:cue.index??null,result:cue.result}));
}
export function roundFingerprint(round) {
  if(!round.seed&&round.seed!==0)throw Error('Missing authoritative seed');
  if(!Array.isArray(round.clients)||round.clients.length!==2)throw Error('Missing per-round DM/Player data');
  const canonical=canonicalUnits(round.canonical);
  for(const unit of Object.values(canonical))if(!Number.isFinite(unit.hp)||!Number.isFinite(unit.sp))throw Error('Invalid canonical HP/SP');
  const dm=round.clients[0],player=round.clients[1];
  const cues=cueWorkload(dm.cues),playerCues=cueWorkload(player.cues);
  if(!['clashStart','clashOutcome','clashEnd','powerCoin'].every(name=>cues.some(cue=>cue.cue===name)))throw Error('Missing required Clash phase');
  if(encode(cues)!==encode(playerCues))throw Error('DM/Player presentation workload differs');
  const identities=rows=>rows.slice().sort((a,b)=>a.sequence-b.sequence).map(cue=>[cue.roundId,cue.sequence]);
  if(encode(identities(dm.cues))!==encode(identities(player.cues)))throw Error('DM/Player presentation identities differ');
  for(const client of round.clients)if(encode(canonicalUnits(client.units))!==encode(canonical))throw Error('Client state differs from canonical round state');
  return {round:round.round,seed:round.seed,cues,canonical};
}
