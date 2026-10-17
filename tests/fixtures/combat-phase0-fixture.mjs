import { randomUUID } from 'node:crypto';

export const PROJECT = 'demo-luminos-combat-phase0';
export const NAMESPACE = PROJECT + '-default-rtdb';
export const PASSWORD = 'local-emulator-only-password';
export function emulatorHosts() {
  const auth = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const database = process.env.FIREBASE_DATABASE_EMULATOR_HOST;
  if (![auth, database].every((host) => /^(127\.0\.0\.1|localhost):\d+$/.test(host || ''))) {
    throw new Error('Combat Phase 0 requires explicit loopback Auth and Database emulators');
  }
  return { auth, database };
}
export async function readEmulator(path = '') {
  const { database } = emulatorHosts();
  const response = await fetch(`http://${database}/${encodeURI(path)}.json?ns=${NAMESPACE}`, { headers: { Authorization: 'Bearer owner' } });
  if (!response.ok) throw new Error(`Emulator read failed (${response.status})`);
  return response.json();
}
export async function writeEmulator(path, value) {
  const { database } = emulatorHosts();
  const response = await fetch(`http://${database}/${encodeURI(path)}.json?ns=${NAMESPACE}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' }, body: JSON.stringify(value),
  });
  if (!response.ok) throw new Error(`Emulator seed failed (${response.status}): ${await response.text()}`);
}
export const sprite = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="240"><circle cx="80" cy="48" r="30" fill="#d6b995"/><path d="M38 230L48 100Q80 75 112 100L122 230Z" fill="#73505e"/></svg>');

export async function seedPhase0() {
  const { auth } = emulatorHosts();
  const users = {};
  const suffix = randomUUID();
  for (const role of ['dm', 'a', 'b']) {
    const email = `${role}-${suffix}@example.test`;
    const response = await fetch(`http://${auth}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD, returnSecureToken: true }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(`Emulator registration failed: ${JSON.stringify(data)}`);
    users[role] = { uid: data.localId, email, token: data.idToken };
  }
  const skill = (id, name, tier, basePower = 5) => ({ id, skillId: id, kind: 'skill', name, tier, basePower, coinPower: 2, coinAmount: 1, attackWeight: 1, damageType: 'Slash', sinAffinity: 'wrath', actionCost: 'action', economyCost: 'action' });
  const skills = {
    old_strike: skill('old_strike', 'Golpe sencillo', 1),
    phase0_cut: skill('phase0_cut', 'Corte preciso', 1),
    phase0_thrust: skill('phase0_thrust', 'Estocada', 2, 7),
    phase0_finish: skill('phase0_finish', 'Remate', 3, 9),
  };
  const players = Object.fromEntries(['a', 'b'].map((id) => [id, {
    uid: users[id].uid, vinculado_a: users[id].uid, characterName: id === 'a' ? 'Agatha' : 'Belle', unitId: `unit-${id}`,
    skillIds: ['old_strike'], skillSlotIds: ['old_strike'], equippedSkillIndex: { old_strike: true },
    characterBuild: { classes: [{ classId: 'fighter', levels: 1 }] },
  }]));
  const combatants = Object.fromEntries(['a', 'b'].map((id, index) => [`player:${id}`, {
    ...players[id], id: `player:${id}`, combatId: `player:${id}`, name: players[id].characterName,
    isPlayer: true, actorCategory: 'player', category: 'player', canonicalScope: 'player', canonicalPlayerKey: id,
    ownerPlayerId: id, playerId: id, canonicalOwnerUid: users[id].uid, ownerUid: users[id].uid,
    faction: 'ally', battleActive: true, positionPinned: true, x: 18 + index * 16, y: 42 + index * 10,
    hp: 100, maxHp: 100, sp: 0, actionSlots: 1, activeSlots: 1, actionSlotIndex: { 0: true },
    speedRange: [3, 5], speed: 4, speedRollTurn: 1, speedBaseRoll: 4, speedTie: 0.1 + index * 0.1,
    combatSprite: sprite,
  }]));
  combatants['enemy:dummy'] = {
    id: 'enemy:dummy', combatId: 'enemy:dummy', name: 'Constructo', actorCategory: 'enemy', category: 'enemy',
    faction: 'enemy', battleActive: true, positionPinned: true, x: 76, y: 42, hp: 150, maxHp: 150, sp: 0,
    actionSlots: 1, activeSlots: 1, skillIds: ['old_strike'], skillSlotIds: ['old_strike'],
    speedRange: [1, 2], speed: 1, speedBaseRoll: 1, speedRollTurn: 1, speedTie: 0.5, combatSprite: sprite,
  };
  const units = Object.fromEntries(['a', 'b'].map((id) => [`unit-${id}`, { ...combatants[`player:${id}`], id: `unit-${id}`, ownerPlayerId: id }]));
  const campaign = { config: { dm_uid: users.dm.uid }, jugadores: players, base_datos_unidades: units, base_datos_skills: skills,
    combate: { estado: { phase: 'PRE_COMBAT_PLANNING', round: 1 }, combatants } };
  await writeEmulator('campaña', campaign);
  return { users, campaign, skills, units };
}
