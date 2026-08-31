const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const safeKey=(value)=>String(value??'').replace(/[.#$[\]\\/]/g,'_');
function isCurrentPlayerToken(token={},root=window){const playerId=root.localStorage?.getItem('playerId')||root.datosJugador?.playerId||root.datosJugador?.id||'';return token.viewer===true||token.characterLink?.mode==='current_player'||(playerId&&String(token.playerId||token.canonicalPlayerKey||'')===String(playerId));}
function maxHpFrom(data={}){return Math.max(0,finite(data.maxHp??data.hp_max??data.combatStats?.hp_max??data.hp,0));}
function currentHpFrom(data={}){return Math.max(0,finite(data.hp??data.hp_actual??data.combatStats?.hp_actual,maxHpFrom(data)));}

export function resolveDamageAdapter(root,token,runtime){
  const currentPlayer=!runtime?.bridge?.isDm&&isCurrentPlayerToken(token,root);
  if(currentPlayer){
    const data=root.datosJugador||{},maxHp=maxHpFrom(data);if(maxHp<=0)return null;
    const unit={...data,hp:currentHpFrom(data),maxHp,shield:finite(data.shield??data.combatStats?.shield,0)};
    return{unit,maxHp,async commit(){
      data.combatStats||={};data.combatStats.hp_actual=Math.max(0,Math.floor(unit.hp));data.hp_actual=data.combatStats.hp_actual;if('hp'in data)data.hp=data.combatStats.hp_actual;
      const db=root.firebase?.database?.(),key=token.canonicalPlayerKey||token.playerId||root.localStorage?.getItem('playerId')||data.playerId||data.id;
      if(db&&key)await db.ref(`campaña/jugadores/${safeKey(key)}/combatStats`).update({hp_actual:data.combatStats.hp_actual});
      root.dispatchEvent?.(new CustomEvent('vtt:fall-hp-updated',{detail:{tokenId:token.id,hp:data.combatStats.hp_actual,maxHp}}));
    }};
  }
  if(Number.isFinite(Number(token.hp))&&maxHpFrom(token)>0)return{unit:token,maxHp:maxHpFrom(token),async commit(){}};
  const ids=new Set([token.id,token.actorId,token.actorRef?.id,token.sourceActorId].filter(Boolean).map(String));
  const unit=Object.values(root.combatData||{}).find(candidate=>ids.has(String(candidate?.id||candidate?.unitId||candidate?.characterId||candidate?.actorId||'')));
  return unit&&maxHpFrom(unit)>0?{unit,maxHp:maxHpFrom(unit),async commit(){}}:null;
}

export async function applyFallDamage(root,token,runtime,resolution){
  const adapter=resolveDamageAdapter(root,token,runtime);
  if(!adapter){runtime?.engine?.canvas?.dispatchEvent(new CustomEvent('vtt:fall-damage-unresolved',{detail:{tokenId:token.id,...resolution}}));return{applied:false,reason:'FALL_DAMAGE_TARGET_UNAVAILABLE',...resolution};}
  const fixed=root.LuminousFixedDamageRuntime;
  let applied;
  if(fixed?.applyFixedDamage)applied=fixed.applyFixedDamage(adapter.unit,resolution.damage,{damageKind:'directo',skillUsed:null});
  else{const before=finite(adapter.unit.hp);adapter.unit.hp=Math.max(0,before-resolution.damage);applied={applied:true,amount:resolution.damage,hpBefore:before,hpAfter:adapter.unit.hp};}
  await adapter.commit();
  runtime?.engine?.canvas?.dispatchEvent(new CustomEvent('vtt:fall-damage',{detail:{tokenId:token.id,...resolution,applied}}));
  return{...resolution,applied};
}

export function damageMaxHp(root,token,runtime){return resolveDamageAdapter(root,token,runtime)?.maxHp||0;}
