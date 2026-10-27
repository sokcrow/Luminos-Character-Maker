(function(global){
  'use strict';
  // The scoring model is intentionally not exposed in the player UI.
  const WEIGHTS=Object.freeze({damage:25,healing:20,protection:20,control:15,support:15,objective:5});
  const METRIC_KEYS=Object.keys(WEIGHTS);
  const clean=v=>String(v??'').trim();
  const validKey=v=>v&&!/[.#$\/\[\]]/.test(v);
  const finite=v=>Number.isFinite(Number(v))?Math.max(0,Number(v)):0;
  const side=u=>clean(u?.faction||u?.side||u?.team).toLowerCase();
  const escaped=u=>u?.escaped===true||u?.departed===true||['escape','escaped'].includes(clean(u?.departureReason||u?.exitReason).toLowerCase());
  const isPlayer=u=>u?.isPlayer===true||['player','jugador'].includes(clean(u?.actorCategory||u?.category||u?.canonicalScope).toLowerCase());
  const playerId=u=>clean(u?.canonicalPlayerKey||u?.ownerPlayerId||u?.playerId||u?.characterLink?.playerId);
  const npcId=u=>clean(u?.persistentNpcId||u?.npcId||u?.characterLink?.npcId||u?.actorId);
  const actorName=(u,id)=>clean(u?.displayName||u?.characterName||u?.nombre||u?.name||id);
  const portrait=u=>clean(u?.splashArt||u?.splashImage||u?.portrait||u?.avatar||u?.imageUrl||u?.image);
  function eligibleActors(encounter={}){
    const actors=new Map();
    for(const [key,u] of Object.entries({...encounter.reserves,...encounter.departed,...encounter.defeated,...encounter.combatants})){
      if(!u||typeof u!=='object'||escaped(u)||u.xpEligible===false||u.eligibleForXp===false||u.isSummon===true||u.summoned===true)continue;
      const hostile=['enemy','hostile','enemigo'].includes(side(u));
      const player=isPlayer(u),pid=playerId(u),nid=npcId(u);
      const id=player&&validKey(pid)?'player:'+pid:!player&&validKey(nid)?'npc:'+nid:'unit:'+key;
      const actor={id,unitId:key,kind:player?'player':'npc',recordId:player?pid:nid,
        persistent:Boolean((player&&validKey(pid))||(!player&&validKey(nid))),
        name:actorName(u,key),portrait:portrait(u),level:Math.max(1,Math.floor(finite(u.level)||1)),
        hostile};
      // A stable canonical ID beats duplicate deployed/defeated copies.
      actors.set(id,actor);
    }
    const result=[...actors.values()];
    const allied=result.filter(a=>!a.hostile);
    return (allied.length?allied:result).sort((a,b)=>a.id.localeCompare(b.id));
  }
  // Metrics may be published by the authoritative combat resolver. Never infer
  // invented damage or healing from final HP; missing metrics count as zero.
  let metrics={},seenEvents=new Set(),roundOneStarted=false;
  function resetMetrics(){metrics={};seenEvents=new Set();roundOneStarted=false;}
  function recordEvent(event={}){
    if(!global.LuminousCombatAuthority073?.isDm?.())return;
    const round=Math.max(0,Math.floor(Number(event.round)||0));
    if(event.type==='RoundSealed'&&round===1&&!roundOneStarted){resetMetrics();roundOneStarted=true;}
    const key=round+':'+event.sequence+':'+event.type;
    if(seenEvents.has(key))return;
    seenEvents.add(key);
    const owner=clean(event.ownerId),target=clean(event.unitId);
    if(!owner)return;
    const row=metrics[owner]||(metrics[owner]={damage:0,healing:0,protection:0,control:0,support:0,objective:0});
    const amount=Math.abs((Number(event.after)||0)-(Number(event.before)||0));
    if(event.type==='DamageApplied'&&owner!==target&&Number(event.before)>Number(event.after))row.damage+=amount;
    if(event.type==='HealingApplied'&&owner!==target&&Number(event.after)>Number(event.before))row.healing+=amount;
    if(event.type==='ShieldApplied')row.protection+=Math.max(0,Number(event.power||event.shield||event.result?.shield)||0);
    if(event.type==='UnitStaggered')row.control+=1;
    if(event.type==='StatusChanged'&&owner!==target)row.control+=0.25;
    if(event.type==='UnitDefeated'&&owner!==target)row.objective+=1;
    if(event.type==='HitEvaded'||event.type==='EvadeResolved'&&event.evaded)row.protection+=1;
    if(event.type==='ActionFinished'&&event.result?.support)row.support+=1;
  }
  function snapshotMetrics(){return JSON.parse(JSON.stringify(metrics));}
  function selectMvp(encounter={}){
    const actors=eligibleActors(encounter);
    if(!actors.length)return null;
    const stored=encounter.combatMetrics||encounter.metrics||{};
    const maxima=Object.fromEntries(METRIC_KEYS.map(k=>[k,Math.max(1,...actors.map(a=>finite((stored[a.unitId]||stored[a.id]||stored[a.recordId]||{})[k])))]));
    const ranked=actors.map(actor=>{
      const metrics=stored[actor.unitId]||stored[actor.id]||stored[actor.recordId]||{};
      const score=METRIC_KEYS.reduce((sum,k)=>sum+WEIGHTS[k]*Math.min(1,finite(metrics[k])/maxima[k]),0);
      return {actor,score};
    }).sort((a,b)=>b.score-a.score||a.actor.id.localeCompare(b.actor.id));
    return {...ranked[0].actor,metricScore:ranked[0].score};
  }
  function bonus(base,isWinner,victory=true){
    const xp=Math.max(0,Math.floor(finite(base)));
    return victory&&isWinner?Math.floor(xp*115/100):xp;
  }
  function sessionXp(level){return Math.max(100,100*Math.floor(Math.max(1,Math.floor(finite(level)||1))/5));}
  const api=Object.freeze({WEIGHTS,eligibleActors,selectMvp,bonus,sessionXp,recordEvent,snapshotMetrics,resetMetrics});
  global.LuminousCombatMvpRuntime=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
