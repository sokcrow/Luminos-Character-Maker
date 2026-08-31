const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clean=(value)=>String(value??'').trim();

export function skillSpec(skill){return String(skill).toLowerCase()==='acrobatics'?{skillId:'acrobatics',abilityId:'dex',label:'Acrobatics'}:{skillId:'athletics',abilityId:'str',label:'Athletics'};}
function proficiencyBonus(level){return Math.ceil(Math.max(0,finite(level,1))/20);}
function abilityScore(data={},abilityId='str'){const key=abilityId==='dex'?'destreza':'fuerza';return finite(data?.stats?.[key]??data?.[key],10);}
function playerSkillBase(data={},skill='athletics'){
  const spec=skillSpec(skill),stored=data?.dndSkills?.[spec.skillId]?.value;
  if(Number.isFinite(Number(stored)))return Number(stored);
  const mod=Math.floor((abilityScore(data,spec.abilityId)-10)/2);
  const state=String(data?.skillProficiency?.[spec.skillId]??data?.skillProficiencies?.[spec.skillId]??data?.dndSkillProficiency?.[spec.skillId]??data?.dndSkills?.[spec.skillId]?.proficiency??'none').toLowerCase();
  const multiplier=state==='expertise'?2:state==='proficient'?1:state==='half'?0.5:0;
  return mod+Math.floor(proficiencyBonus(data?.level||1)*multiplier);
}
function roomKey(root){return String(root.document?.body?.dataset?.theatreRoomId||'default').replace(/[.#$[\]\\/]/g,'_')||'default';}

async function requestPlayerCheckPower(root,token,skill,options={}){
  const firebase=root.firebase,db=firebase?.database?.(),uid=firebase?.auth?.().currentUser?.uid;
  if(!db||!uid)throw new Error('CHECK_AUTH_NOT_READY');
  const spec=skillSpec(skill),data=root.datosJugador||{};
  const playerId=root.localStorage?.getItem('playerId')||data.playerId||data.id||token.playerId||token.canonicalPlayerKey||'';
  const requestRef=db.ref('theatre_check_requests').push();
  await requestRef.set({schemaVersion:1,requesterUid:uid,playerId:playerId||null,actorId:data.actorId||data.vinculo_jugador||token.actorId||token.actorRef?.id||null,playerName:clean(data.characterName||data.character_name||data.nombre||data.name||token.name||'PLAYER')||'PLAYER',roomKey:roomKey(root),status:'pending',rollSpec:{kind:'skill',abilityId:spec.abilityId,skillId:spec.skillId,label:spec.label,basePreview:playerSkillBase(data,spec.skillId)},source:'vtt_jump_fall',createdAt:firebase.database.ServerValue.TIMESTAMP,clientCreatedAt:Date.now()});
  return new Promise((resolve,reject)=>{
    let liveRef=null,liveHandler=null,finished=false;
    const finish=(error,value)=>{if(finished)return;finished=true;root.clearTimeout(timeoutId);requestRef.off('value',requestHandler);if(liveRef&&liveHandler)liveRef.off('value',liveHandler);if(error)reject(error);else resolve(Number(value)||0);};
    const timeoutId=root.setTimeout(()=>finish(new Error('CHECK_TIMEOUT')),Math.max(30000,finite(options.checkTimeoutMs,180000)));
    const attachLive=(commandId)=>{if(!commandId||liveRef)return;liveRef=db.ref(`theatre_check_live/${uid}/${commandId}`);liveHandler=(snapshot)=>{const live=snapshot.val()||{};if(live.status==='complete')finish(null,live.total);};liveRef.on('value',liveHandler,(error)=>finish(error));};
    const requestHandler=(snapshot)=>{const value=snapshot.val()||{};if(value.status==='denied')return finish(new Error('CHECK_DENIED'));if(value.status==='approved')attachLive(value.commandId);};
    requestRef.on('value',requestHandler,(error)=>finish(error));
  });
}

async function requestDmNpcCheckPower(root,token,skill){
  const npc=root.LuminousNpcStats,coin=root.LuminousCoinEngine;
  if(!npc?.rollDefinition||!coin?.runAnimatedRoll)throw new Error('NPC_CHECK_RUNTIME_UNAVAILABLE');
  const actorId=token.actorRef?.id||token.actorId||token.sourceActorId||token.id,spec=skillSpec(skill);
  const definition=npc.rollDefinition(String(actorId),{kind:'skill',abilityId:spec.abilityId,skillId:spec.skillId});
  if(!definition)throw new Error('NPC_CHECK_DEFINITION_UNAVAILABLE');
  const doc=root.document,wrap=doc.createElement('div');wrap.id='vtt-jump-fall-modal';wrap.className='vtt-jump-fall-modal';
  const card=doc.createElement('section');card.className='vtt-jump-fall-card';const heading=doc.createElement('strong');heading.textContent=`${spec.label.toUpperCase()} · ${clean(definition.actor?.nombre||actorId).toUpperCase()}`;
  const coins=doc.createElement('div');coins.className='vtt-jump-fall-coins';const total=doc.createElement('strong');total.className='vtt-jump-fall-total';total.textContent=String(definition.base||0);card.append(heading,coins,total);wrap.appendChild(card);doc.body.appendChild(wrap);
  try{
    const result=await coin.runAnimatedRoll({document:doc,container:coins,totalNode:total,base:definition.base,headsChance:definition.headsChance,coinCount:5,intervalMs:300,auto:true});
    await root.LuminousTheatreRolls?.publishRoll?.({roller:{uid:root.firebase?.auth?.().currentUser?.uid||null,actorId:definition.actorId,name:definition.actor?.nombre||definition.actorId},label:`${definition.label} · JUMP/FALL`,base:result.base,total:result.total,coins:result.coins,check:{}});
    return Number(result.total)||0;
  }finally{wrap.remove();}
}

export async function requestCheckPower(root,token,skill,{isDm=false,checkProvider=null,checkTimeoutMs=180000}={}){
  if(typeof checkProvider==='function')return Number(await checkProvider({token,skill,role:isDm?'dm':'player'}))||0;
  return isDm?requestDmNpcCheckPower(root,token,skill):requestPlayerCheckPower(root,token,skill,{checkTimeoutMs});
}
