import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../js/combat-session-lifecycle.js');
const session = globalThis.LuminousCombatSession;
const clone = value => value == null ? value : structuredClone(value);

function fakeDatabase(initial) {
  const db = { combat: clone(initial), instance: 'combat_theatre', transactions: 0 };
  const snapshot = value => ({ val: () => clone(value) });
  db.ref = path => {
    if (path === 'campaña/combate/estado') {
      return { once: async () => snapshot(db.combat?.estado) };
    }
    if (path === 'campaña/estado_mundo/instancia_activa') {
      return { set: async value => { db.instance = value; } };
    }
    if (path === 'campaña/combate') {
      return {
        on(_event, listener) { listener(snapshot(db.combat)); },
        off() {},
        async transaction(updater) {
          db.transactions += 1;
          const next = updater(clone(db.combat));
          if (next === undefined) return { committed: false, snapshot: snapshot(db.combat) };
          db.combat = next;
          return { committed: true, snapshot: snapshot(db.combat) };
        },
      };
    }
    throw new Error('Unexpected path: ' + path);
  };
  return db;
}

for (const authorityPhase of ['sealed', 'running']) {
  const encounter = {
    estado: { encounterId: 'campaign-42', phase: 'PLANNING', round: 9, active: true },
    authority: { current: { phase: authorityPhase } },
    combatants: { player: { id: 'player', hp: 13, sp: -12 }, enemy: { id: 'enemy', hp: 8 } },
    reserves: { reinforcement: { hp: 25 } },
    plannedActions: { player: { 0: { kind: 'skill' } } },
    readyPlayers: { player: { ready: true } },
    defeated: { defeatedEnemy: { hp: 0 } },
  };
  const db = fakeDatabase(encounter);
  assert.equal(session.blocked(db.combat), true);
  const resumed = await session.start({ db, uid: 'dm' });
  assert.equal(db.instance, 'combate', 'returning from Theatre must restore Combat');
  assert.equal(db.transactions, 0, 'resuming must not transact an executing or sealed round');
  assert.deepEqual(db.combat, encounter, 'resume must preserve round, units, plans, reserves and casualties');
  assert.equal(resumed.round, 9);
}

const db = fakeDatabase({
  estado: { encounterId: 'campaign-43', phase: 'ENDING', round: 12, active: true },
  combatants: {},
});
await assert.rejects(() => session.start({ db, uid: 'dm' }), /finalizando/);
assert.equal(db.instance, 'combat_theatre', 'cannot resume a closing encounter');

db.combat = {
  estado: { encounterId: 'campaign-43', phase: 'ENDING', round: 12, active: true, ending: { token: 'token', uid: 'dm', result: 'victory' } },
  combatants: { player: { hp: 9 } },
};
const ended = await session.commitEnd({ db, uid: 'dm', result: 'victory', token: 'token' });
assert.equal(ended.phase, 'ENDED');
assert.equal(ended.result, 'victory');
assert.equal(ended.round, 1);
assert.equal(ended.completedRound, 12);
assert.equal(ended.transition, 'result');
await session.start({ db, uid: 'dm' });
assert.equal(db.combat.estado.phase, 'PRE_COMBAT_PLANNING');
assert.equal(db.combat.estado.round, 1);
assert.notEqual(db.combat.estado.encounterId, 'campaign-43');
assert.equal(db.instance, 'combate');

const source = name => fs.readFileSync(path.join(process.cwd(), name), 'utf8');
for (const dmPage of ['hoja_de_DM.html', 'pantalla_dm.html']) {
  assert.doesNotMatch(source(dmPage), /<a[^>]+href="combate\.html"/, 'no redundant DM Combat link: '+dmPage);
}
assert.match(source('hoja_de_DM.html'), /RESOLVER RONDA/, 'round resolution must not masquerade as entering Combat');
assert.match(source('js/instance-control.js'), /radio\.addEventListener\("click"/, 'already-selected Combat control must respond to another click');
assert.match(source('js/instance-control.js'), /participants\[player\.playerId\]===true/, 'defeated players must remain in Combat for the result seal');
assert.doesNotMatch(source('js/battle-viewer-dm-console-074.js'), /beginBlackout\?\.\(/, 'result must not trigger an opaque blackout');
assert.match(source('js/instance-control.js'), /transition === "result" \? 1400/, 'DM result return has a fallback');
console.log('P0 Combat/Theatre transitions: active-round resume, sealed/running preservation, confirmed closure and single DM entry passed.');
