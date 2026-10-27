const clone=value=>JSON.parse(JSON.stringify(value));
export function fixture(users){
  const sprite=color=>'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="240"><circle cx="90" cy="55" r="40" fill="${color}"/><path d="M30 230V130Q90 70 150 130V230Z" fill="${color}"/></svg>`);
  const skills={};
  for(const [index,id]of ['s1','s2','s3','enemy_s1'].entries())skills[id]={id,name:id==='enemy_s1'?'Kobold Strike':`Strike ${id}`,kind:'skill',tier:Math.min(3,index+1),basePower:id==='enemy_s1'?2:12,coinPower:2,coinAmount:3,damageType:'Blunt',sinAffinity:'wrath',effects:[],coins:Array.from({length:3},()=>({effects:[]}))};
  const players={},units={};
  users.slice(1).forEach((user,index)=>{
    const id=`p${index+1}`,unitId=`player:${id}`;
    const row={uid:user.uid,characterName:`PLAYER ${index+1}`,hp:10000,maxHp:10000,sp:0,actionSlots:1,characterBuild:{skillDeck:{tier1:'s1',tier2:'s2',tier3:'s3'}},inventario_activo:{},combatSprite:sprite('#72baff')};
    players[id]=row;units[unitId]={...clone(row),id:unitId,combatId:unitId,isPlayer:true,canonicalScope:'player',canonicalPlayerKey:id,canonicalOwnerUid:user.uid,ownerPlayerId:id,ownerUid:user.uid,playerId:id,category:'player',faction:'ally',battleActive:true,isBackup:false,deploymentState:'field',skillIds:['s1','s2','s3'],skillSlotIds:['s1','s1','s1','s2','s2','s3'],equippedSkillIndex:{s1:true,s2:true,s3:true},actionSlotIndex:{0:true},speed:6,speedBaseRoll:6,speedRollTurn:1,speedTie:(index+1)/20};
  });
  for(let index=1;index<=2;index++){const id=`kobold${index}`;units[id]={id,name:`Kobold ${index}`,isPlayer:false,category:'enemy',faction:'enemy',battleActive:true,isBackup:false,deploymentState:'field',hp:10000,maxHp:10000,sp:0,actionSlots:1,skillIds:['enemy_s1'],equippedSkillIndex:{enemy_s1:true},actionSlotIndex:{0:true},level:1,combatSprite:sprite('#e27254'),speed:5,speedBaseRoll:5,speedRollTurn:1,speedTie:index/20};}
  return {config:{dm_uid:users[0].uid},estado_mundo:{instancia_activa:'combate'},jugadores:players,base_datos_skills:skills,base_datos_unidades:{},actores:{},combate:{estado:{phase:'PRE_COMBAT_PLANNING',round:1,active:true,encounterId:'nine-browser-benchmark',presentation:'full'},combatants:units}};
}

export function npcBenchmarkPlan(index,skill){
  return {type:'auto',sourceSlotIndex:0,targetId:`player:p${index}`,targetSlotIndex:0,clashChoice:'clash',clashConfirmed:true,data:skill};
}
