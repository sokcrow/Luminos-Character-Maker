(function(global){
  'use strict';
  if(global.LuminousCombatLibraryClient073)return;

  const state={started:false,loading:false,bulkDetached:false,lastIds:'',retryTimer:null};
  const clean=v=>String(v??'').trim();
  function adapter(){return global.LuminousCombatLiveAdapter073||null;}
  function adapterState(){return adapter()?.state||null;}
  function library(){return global.LuminousUniversalLibrary||null;}
  function skillIdsFor(unit={}){
    if(Array.isArray(unit.skillIds))return unit.skillIds.map(clean).filter(Boolean);
    if(Array.isArray(unit.skillSlotIds))return unit.skillSlotIds.map(clean).filter(Boolean);
    if(Array.isArray(unit.action_slots))return unit.action_slots.map(row=>clean(row?.id||row?.skillId||row)).filter(Boolean);
    if(unit.equippedSkillIndex&&typeof unit.equippedSkillIndex==='object')return Object.keys(unit.equippedSkillIndex).filter(id=>unit.equippedSkillIndex[id]===true);
    return[];
  }
  function requiredIds(){
    const s=adapterState(),ids=new Set();
    Object.values(s?.combatants||{}).forEach(unit=>skillIdsFor(unit||{}).forEach(id=>ids.add(id)));
    return [...ids].sort();
  }
  function detachBulkSkills(){
    const s=adapterState();
    if(state.bulkDetached||!s||adapter()?.version!=='0.7.3-live.2')return state.bulkDetached;
    // v0.7.3-live.2 registers realtime subscriptions in this fixed order:
    // players, combatants, full skill library, combat state. Detach only the
    // legacy full-library listener and leave all combat authority listeners intact.
    if(Array.isArray(s.unsubscribers)&&s.unsubscribers.length>=4&&typeof s.unsubscribers[2]==='function'){
      try{s.unsubscribers[2]();state.bulkDetached=true;s.unsubscribers[2]=()=>{};}catch(error){console.warn('[Combat073 LibraryClient] bulk skill detach failed',error);}
    }
    return state.bulkDetached;
  }
  async function ensureSkills({force=false}={}){
    const s=adapterState(),lib=library();
    if(!s?.db?.ref||!lib?.getSkill||state.loading)return false;
    detachBulkSkills();
    const ids=requiredIds(),signature=ids.join('|');
    if(!force&&signature===state.lastIds&&ids.every(id=>s.skills?.[id]))return true;
    state.loading=true;
    try{
      const next={...(s.skills||{})};
      await Promise.all(ids.map(async id=>{
        if(!force&&next[id])return;
        const row=await lib.getSkill(s.db,id,{campaignFallback:true}).catch(()=>null);
        if(row?.record)next[id]=row.record;
      }));
      Object.keys(next).forEach(id=>{if(!ids.includes(id))delete next[id];});
      s.skills=next;state.lastIds=signature;
      s.lastSignature='';
      adapter()?.hydrateNow?.();
      return true;
    }finally{state.loading=false;}
  }
  function start(){
    if(state.started)return true;state.started=true;
    const attempt=()=>{
      const s=adapterState(),lib=library();
      if(s?.db?.ref&&lib?.getSkill){lib.setDb?.(s.db);detachBulkSkills();ensureSkills({force:true}).catch(error=>console.error('[Combat073 LibraryClient]',error));return;}
      state.retryTimer=global.setTimeout(attempt,100);
    };
    attempt();return true;
  }
  function stop(){if(state.retryTimer)global.clearTimeout(state.retryTimer);state.retryTimer=null;state.started=false;}
  global.addEventListener('luminous:combat073-hydrated',()=>ensureSkills().catch(error=>console.error('[Combat073 LibraryClient hydrate]',error)));
  global.addEventListener('luminous:combat-unit-library-local-ready',()=>ensureSkills({force:true}).catch(error=>console.error('[Combat073 LibraryClient library]',error)));
  global.addEventListener('beforeunload',stop,{once:true});
  global.LuminousCombatLibraryClient073=Object.freeze({version:'0.7.3-library-client.1',state,start,stop,requiredIds,ensureSkills,detachBulkSkills});
  start();
})(window);
