/* Encounter membership is shared by routing, the field and READY authority. */
(function(global){
  'use strict';
  if(global.LuminousCombatParticipants)return;
  const clean=value=>String(value??'').trim();
  const norm=value=>clean(value).toLowerCase().replace(/[\s-]+/g,'_');
  const outside=new Set(['backup','reserve','reserves','retreat','retreated','defeated','dead','escaped','departed','theatre','theater','teatro']);
  function playerId(unit={}){return clean(unit.canonicalPlayerKey||unit.ownerPlayerId||unit.playerId||unit.characterLink?.playerId);}
  function ownerUid(unit={}){return clean(unit.canonicalOwnerUid||unit.ownerUid||unit.characterLink?.uid);}
  function isPlayer(unit={}){return unit.isPlayer===true||norm(unit.actorCategory||unit.category||unit.type)==='player'||norm(unit.canonicalScope)==='player';}
  function isField(unit={}){
    if(!unit||typeof unit!=='object'||unit.isBackup===true||unit.battleActive===false||unit.removed===true||unit.escaped===true||unit.defeated===true||unit.dead===true||unit.isDead===true)return false;
    const positions=[unit.deploymentState,unit.deployment,unit.positionState,unit.zone].filter(value=>value!=null&&clean(value)).map(norm);
    if(positions.some(value=>outside.has(value)))return false;
    // Missing state is not an invitation to combat. DM deployment and reserve
    // promotion explicitly set battleActive or a field deployment state.
    return unit.battleActive===true||positions.includes('field');
  }
  function players(combatants={}){
    const found=new Map();
    for(const [key,unit]of Object.entries(combatants||{})){
      if(!isField(unit)||!isPlayer(unit))continue;
      const id=playerId(unit);if(!id||found.has(id))continue;
      found.set(id,{playerId:id,unitId:clean(unit.id||unit.combatId||key),uid:ownerUid(unit),name:clean(unit.name||unit.characterName||unit.nombre)||'Personaje'});
    }
    return [...found.values()];
  }
  function playerIds(combatants){return players(combatants).map(row=>row.playerId);}
  function includes(combatants,identity={}){return players(combatants).some(row=>identity.uid&&row.uid?row.uid===identity.uid:Boolean(identity.playerId)&&row.playerId===identity.playerId);}
  function progress(combatants,ready={},round=1){
    const rows=players(combatants).map(row=>({...row,ready:ready?.[row.playerId]?.ready===true&&Number(ready[row.playerId].round)===Number(round)}));
    return{rows,total:rows.length,ready:rows.filter(row=>row.ready).length,waiting:rows.filter(row=>!row.ready).map(row=>row.name)};
  }
  function playerInstance(instance,combatants,identity={}){
    return ['combate','combat_theatre'].includes(instance)&&!includes(combatants,identity)?'teatro':instance;
  }
  global.LuminousCombatParticipants=Object.freeze({isField,isPlayer,playerId,ownerUid,players,playerIds,includes,progress,playerInstance});
})(typeof window!=='undefined'?window:globalThis);
