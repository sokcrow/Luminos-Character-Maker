import assert from 'node:assert/strict';
await import('../js/combat-mvp-runtime.js');
await import('../js/combat-xp-runtime.js');
await import('../js/session-mvp-runtime.js');
const mvp=globalThis.LuminousCombatMvpRuntime,xp=globalThis.LuminousCombatXpRuntime,session=globalThis.LuminousSessionMvpRuntime;
assert.equal(session.xpForLevel(1),100);
assert.equal(session.xpForLevel(5),100);
assert.equal(session.xpForLevel(9),100);
assert.equal(session.xpForLevel(10),200);
assert.equal(session.xpForLevel(15),300);
assert.equal(session.xpForLevel(20),400);
assert.equal(mvp.bonus(100,true),115);
assert.equal(mvp.bonus(200,true),230);
assert.equal(mvp.bonus(200,false),200);
assert.equal(mvp.bonus(200,true,false),200);
const encounter={
  estado:{phase:'ENDING',encounterId:'mvp-test',ending:{result:'victory'},fixedEncounterXp:200},
  combatants:{
    pierre:{isPlayer:true,playerId:'pierre',faction:'ally',hp:8,name:'Pierre'},
    healer:{npcId:'agatha',faction:'ally',hp:8,name:'Agatha'},
    enemy:{libraryUnitId:'unknown',faction:'enemy',hp:0,xpPolicy:'none'}
  },
  combatMetrics:{
    pierre:{damage:18},
    healer:{healing:15,protection:10}
  }
};
const best=mvp.selectMvp(encounter);
assert.equal(best.id,'npc:agatha');
assert.deepEqual(xp.eligibleVictoryPlayers(encounter),['pierre']);
assert.deepEqual(xp.eligibleVictoryNpcs(encounter),['agatha']);
const players={'campaña/jugadores/pierre':{uid:'p',xp:100,level:3},'campaña/base_datos_npcs/agatha':{xp:20,level:5}};
const deep=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const db={ref:path=>({
  once:async()=>({val:()=>deep(players[path])}),
  transaction:async fn=>{const next=fn(deep(players[path])),committed=next!==undefined;if(committed)players[path]=deep(next);return {committed,snapshot:{val:()=>deep(players[path])}}}
})};
const award=await xp.awardVictoryXp({db,encounter});
assert.equal(award.xpPerParticipant,100);
assert.equal(award.mvp.id,'npc:agatha');
assert.equal(players['campaña/jugadores/pierre'].xp,200);
assert.equal(players['campaña/base_datos_npcs/agatha'].xp,135);
assert.equal(award.awards.find(row=>row.kind==='npc').bonusXp,15);
const again=await xp.awardVictoryXp({db,encounter});
assert.ok(again.awards.every(row=>!row.awarded));
assert.equal(players['campaña/base_datos_npcs/agatha'].xp,135);
const defeat=deep(encounter);defeat.estado.ending.result='defeat';
assert.equal(mvp.selectMvp(defeat).id,'npc:agatha');
await assert.rejects(()=>xp.awardVictoryXp({db,encounter:defeat}),/VICTORY_REQUIRED/);
assert.equal(players['campaña/base_datos_npcs/agatha'].xp,135);
assert.deepEqual(session.tally({candidates:{pierre:{},agatha:{},lucien:{}},votes:{pierre:'agatha',agatha:'lucien',lucien:'agatha'}}).leaders,['agatha']);
assert.deepEqual(session.tally({candidates:{pierre:{},agatha:{}},votes:{pierre:'pierre',agatha:'pierre'}}).counts,{pierre:1,agatha:0});
console.log('Combat MVP / NPC receipts / defeat zero XP / session XP / voting: OK');

