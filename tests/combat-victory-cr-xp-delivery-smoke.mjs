import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
await import('../js/skill-catalog-beast-cr0.js');
await import('../js/skill-catalog-goblin-tier1.js');
await import('../js/skill-catalog-kobold-tier1.js');
await import('../js/skill-catalog-wolf.js');
await import('../js/unit-catalog-beast-cr0.js');
await import('../js/unit-catalog-goblin.js');
await import('../js/unit-catalog-kobold-tier1.js');
await import('../js/unit-catalog-wolf.js');
await import('../js/combat-xp-runtime.js');

const xp=globalThis.LuminousCombatXpRuntime;
const units=Object.fromEntries([
  globalThis.LuminousBeastCr0UnitCatalog,
  globalThis.LuminousGoblinUnitCatalog,
  globalThis.LuminousKoboldUnitCatalog,
  globalThis.LuminousWolfUnitCatalog
].flatMap(api=>api.list().map(u=>[u.id,u])));
assert.equal(Object.keys(units).length,33);
const cr={goblin:.25,goblin_boss:1,wolf:.25,dire_wolf:1,kobold_dagger:.125,kobold_sling:.125,winged_kobold:.25,dragonheart_kobold:1,scale_sorcerer_kobold:1};
for(const [id,rating]of Object.entries(cr)){
  assert.equal(units[id].challengeRating,rating,id);
  assert.equal(xp.normalizeUnitXp(units[id]).xpValue,xp.xpForThreatRating(rating),id);
}
for(const u of globalThis.LuminousBeastCr0UnitCatalog.list()){
  assert.equal(u.challengeRating,0,u.id);
  assert.equal(xp.normalizeUnitXp(u).xpValue,u.id==='seahorse'?0:10,u.id);
}
const copy=v=>v==null?v:JSON.parse(JSON.stringify(v));
const data={
  'campaña/jugadores/a':{xp:100,level:3},
  'campaña/jugadores/b':{xp:300,level:3},
  'campaña/jugadores/escaped':{xp:700,level:3},
  ...Object.fromEntries(Object.entries(units).map(([id,u])=>['campaña/base_datos_unidades/'+id,u]))
};
let failAt=0;
const db={ref:key=>({
  once:async()=>({val:()=>copy(data[key])}),
  transaction:async(fn)=>{
    if(failAt && --failAt===0)throw Error('SIMULATED_DISCONNECT');
    const next=fn(copy(data[key])),committed=next!==undefined;
    if(committed)data[key]=copy(next);
    return{committed,snapshot:{val:()=>copy(data[key])}};
  }
})};
const encounter={
  estado:{phase:'ENDING',ending:{result:'victory'},encounterId:'xp-smoke-a'},
  participants:{a:true,b:true,escaped:true},
  combatants:{
    a:{playerId:'a',isPlayer:true,faction:'ally'},
    b:{playerId:'b',isPlayer:true,faction:'ally'},
    gob:{libraryUnitId:'goblin',faction:'enemy',hp:0},
    boss:{libraryUnitId:'goblin_boss',faction:'enemy',hp:0},
    living:{libraryUnitId:'wolf',faction:'enemy',hp:20},
    summoned:{libraryUnitId:'dire_wolf',faction:'enemy',hp:0,xpPolicy:'none'}
  },
  defeated:{
    boss:{libraryUnitId:'goblin_boss',faction:'enemy',hp:0,defeated:true},
    beast:{libraryUnitId:'cat',faction:'enemy',hp:0,defeated:true}
  },
  departed:{escaped:{isPlayer:true,playerId:'escaped',escaped:true}}
};
const first=await xp.awardVictoryXp({db,encounter});
assert.equal(first.totalXp,260);
assert.equal(first.xpPerParticipant,130);
assert.deepEqual(first.participantIds,['a','b']);
assert.deepEqual(first.missingCr,[]);
assert.equal(data['campaña/jugadores/a'].xp,230);
assert.equal(data['campaña/jugadores/b'].xp,430);
assert.equal(data['campaña/jugadores/escaped'].xp,700);
assert.equal(data['campaña/jugadores/a'].level,3);
const repeated=await xp.awardVictoryXp({db,encounter});
assert.ok(repeated.awards.every(row=>!row.awarded));
assert.equal(data['campaña/jugadores/a'].xp,230);
// A changed reward after a partial payout must never be mistaken for an
// idempotent success; the encounter cannot seal with inconsistent receipts.
const inconsistent=copy(encounter);inconsistent.estado.fixedEncounterXp=100;
await assert.rejects(()=>xp.awardVictoryXp({db,encounter:inconsistent}),/ENCOUNTER_XP_RECEIPT_MISMATCH/);
assert.equal(data['campaña/jugadores/a'].xp,230);
const retry=copy(encounter);retry.estado.encounterId='xp-smoke-b';
failAt=2;
await assert.rejects(()=>xp.awardVictoryXp({db,encounter:retry}),/SIMULATED_DISCONNECT/);
assert.equal(data['campaña/jugadores/a'].xp,360);
assert.equal(data['campaña/jugadores/b'].xp,430);
const recovered=await xp.awardVictoryXp({db,encounter:retry});
assert.deepEqual(recovered.awards.map(r=>r.awarded),[false,true]);
assert.equal(data['campaña/jugadores/a'].xp,360);
assert.equal(data['campaña/jugadores/b'].xp,560);
const defeat=copy(encounter);defeat.estado.ending.result='defeat';
await assert.rejects(()=>xp.awardVictoryXp({db,encounter:defeat}),/ENCOUNTER_XP_VICTORY_REQUIRED/);
const missing=copy(encounter);missing.estado.encounterId='xp-smoke-c';missing.participants.missing=true;
await assert.rejects(()=>xp.awardVictoryXp({db,encounter:missing}),/ENCOUNTER_XP_PARTICIPANT_NOT_FOUND/);
assert.equal(data['campaña/jugadores/a'].xp,360);
const unclassified=copy(encounter);unclassified.estado.encounterId='xp-smoke-d';
unclassified.defeated.unknown={libraryUnitId:'custom_no_cr',faction:'enemy',hp:0,defeated:true};
const pending=await xp.awardVictoryXp({db,encounter:unclassified});
assert.deepEqual(pending.missingCr,['custom_no_cr']);
assert.equal(pending.totalXp,260);

const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const loader=fs.readFileSync(path.join(root,'Battle-viewer.html'),'utf8');
const dm=fs.readFileSync(path.join(root,'js/battle-viewer-dm-console-074.js'),'utf8');
const session=fs.readFileSync(path.join(root,'js/combat-session-lifecycle.js'),'utf8');
assert.match(loader,/js\/combat-xp-runtime\.js/);
assert.match(dm,/xpRuntime\.awardVictoryXp\(/);
assert.ok(dm.indexOf('xpRuntime.awardVictoryXp')<dm.indexOf('session.commitEnd('));
assert.match(session,/xpAward\.encounterId!==raw\.estado\.encounterId/);
console.log('CR (33 Units), Victory XP, Escape, retries and atomic receipts: OK');
