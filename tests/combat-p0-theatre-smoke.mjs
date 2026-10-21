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

const endedWithStaleAuthority=fakeDatabase({
  estado:{encounterId:'previous-round-900',phase:'ENDED',active:false,result:'victory',round:1},
  authority:{current:{phase:'sealed',id:'old-authority'}},
  combatants:{oldEnemy:{id:'oldEnemy',hp:0}},
  defeated:{oldEnemy:{id:'oldEnemy',hp:0}},
  reserves:{waiting:{id:'waiting',hp:10}},
  plannedActions:{oldPlayer:{0:{kind:'skill'}}},
  readyPlayers:{oldPlayer:{ready:true}},
  playback:{oldReplay:true},
});
await session.start({db:endedWithStaleAuthority,uid:'dm'});
assert.equal(endedWithStaleAuthority.instance,'combate');
assert.equal(endedWithStaleAuthority.combat.estado.phase,'PRE_COMBAT_PLANNING');
assert.equal(endedWithStaleAuthority.combat.estado.round,1);
assert.notEqual(endedWithStaleAuthority.combat.estado.encounterId,'previous-round-900');
for(const key of ['authority','playback','combatants','defeated','reserves','plannedActions','readyPlayers'])
  assert.equal(endedWithStaleAuthority.combat[key] || null,null,'ended authority must not block a fresh fight: '+key);

const source = name => fs.readFileSync(path.join(process.cwd(), name), 'utf8');
for (const dmPage of ['hoja_de_DM.html', 'pantalla_dm.html']) {
  assert.doesNotMatch(source(dmPage), /<a[^>]+href="combate\.html"/, 'no redundant DM Combat link: '+dmPage);
}
assert.match(source('hoja_de_DM.html'), /RESOLVER RONDA/, 'round resolution must not masquerade as entering Combat');
assert.match(source('hoja_de_DM.html'), /id="btn-start-encounter"[^>]*>INICIAR COMBATE/, 'director must have an explicit always-visible start action');
assert.match(source('pantalla_dm.html'), /id="dm-studio-start-encounter"[^>]*>INICIAR COMBATE/, 'DM Studio Combat tab must also initiate a real encounter');
assert.match(source('js/instance-control.js'), /startButton\?\.addEventListener\("click"/, 'director start button must have a canonical handler');
assert.match(source('pantalla_dm.html'), /LuminousCombatSession\.start\(\{db,uid:user\.uid\}\)/, 'studio start must use the canonical encounter session, not a local mock');
assert.match(source('js/instance-control.js'), /radio\.addEventListener\("click"/, 'already-selected Combat control must respond to another click');
assert.match(source('js/instance-control.js'), /participants\[player\.playerId\]===true/, 'defeated players must remain in Combat for the result seal');
assert.doesNotMatch(source('js/battle-viewer-dm-console-074.js'), /beginBlackout\?\.\(/, 'result must not trigger an opaque blackout');
assert.match(source('js/instance-control.js'), /transition === "result" \? 1400/, 'DM result return has a fallback');
console.log('P0 Combat/Theatre transitions: active-round resume, sealed/running preservation, confirmed closure and single DM entry passed.');
