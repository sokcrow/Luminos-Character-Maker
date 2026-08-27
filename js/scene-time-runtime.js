(function (global) {
  'use strict';
  if (global.LuminousSceneTime || !global.LuminousSceneTimeCore) return;
  const C = global.LuminousSceneTimeCore;
  const doc = global.document, firebase = global.firebase;
  if (!doc || !firebase?.database) return;
  const db = firebase.database();
  const DM_UID = 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1';
  const CALENDAR_ROOT = 'campaña/calendario';
  const REQUEST_ROOT = 'campaña/teatro/scene_time_requests';
  const PLAYER_ROOT = 'campaña/jugadores';
  const KNOWLEDGE_ROOT = 'campaña/teatro/conocimiento_identidad';
  const state = { calendar:{}, room:{mode:'scene',actions:{}}, players:{}, knowledge:{}, scene:{}, pending:new Set(), linked:{}, log:[] };
  const uid = () => firebase.auth?.().currentUser?.uid || null;
  const isDm = () => uid() === DM_UID || doc.body?.classList?.contains('on-game-dashboard');
  const theatre = () => global.LuminousTheatreState || null;
  const roomKey = () => C.roomKeyFrom(doc.body?.dataset?.theatreRoomId || theatre()?.getPaths?.().roomKey || 'default');
  const playerData = () => global.datosJugador || global.currentCharacterData || {};
  const assignedActor = () => C.clean(global.getAssignedTheatreActor?.()?.actorId || playerData().actorId || playerData().vinculo_jugador || '');
  const eventId = (prefix='event') => `${prefix}_${roomKey()}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  const requestPath = () => `${REQUEST_ROOT}/${roomKey()}/events`;

  function blocking(actorId) {
    const id = C.clean(actorId);
    if (!id) return null;
    if (state.pending.has(id)) return { status:'pending_local', actorId:id };
    const action = state.room.actions?.[id];
    return C.isActionBlocking(action) ? action : null;
  }
  function actorName(actorId, fallback='') {
    const live = state.scene?.actores?.[actorId] || {};
    return C.clean(live.nombre || fallback || actorId) || '???';
  }
  function knownIdentity(actorId) {
    if (isDm() || assignedActor() === actorId) return true;
    const viewer = uid();
    const buckets = [state.knowledge?.[viewer], state.knowledge?.[assignedActor()], state.knowledge];
    return buckets.some((bucket) => {
      const value = bucket?.[actorId];
      return value === true || value?.known === true || value?.revelado === true || value?.descubierto === true;
    });
  }
  function visibleName(actorId, fallback) {
    return C.visibleActionIdentity({ actorId, viewerId:uid(), selfActorId:assignedActor(), isDm:isDm(), known:knownIdentity(actorId), canonicalName:actorName(actorId,fallback) });
  }

  function ownsActor(requesterUid, actorId) {
    if (!requesterUid || !actorId) return false;
    if (requesterUid === DM_UID) return true;
    return Object.entries(state.players || {}).some(([playerId,p]) => {
      if (!p || typeof p !== 'object') return false;
      const puid = C.clean(p.uid || p.userUid || p.authUid || playerId);
      const aid = C.clean(p.actorId || p.vinculo_jugador || p.vinculoJugador || p.characterActorId);
      return puid === requesterUid && aid === actorId;
    });
  }
  function authorized(event, requesterUid) {
    if (requesterUid === DM_UID) return true;
    const type = C.clean(event?.type).toLowerCase();
    if (type === 'intervention') {
      const message = event.message || {}, actorId = C.clean(message.actorId), mt = C.normalizeType(message);
      return actorId && !['narracion','sistema'].includes(mt) && ownsActor(requesterUid, actorId);
    }
    if (type === 'action_control') return ownsActor(requesterUid, C.clean(event.actorId)) && ['resolve_check','cancel'].includes(C.clean(event.command).toLowerCase());
    return false;
  }

  async function submitEvent(event) {
    const requesterUid = uid();
    if (!requesterUid) throw new Error('AUTH_REQUIRED');
    const id = C.safeKey(event.eventId || eventId(event.type || 'event'));
    await db.ref(`${requestPath()}/${id}`).set({ schemaVersion:1, ...event, eventId:id, requesterUid, createdAt:firebase.database.ServerValue.TIMESTAMP });
    return id;
  }
  async function consumeRequest(id, request) {
    if (!isDm()) return;
    if (!authorized(request, request.requesterUid)) { await db.ref(`${requestPath()}/${id}`).remove(); return; }
    await db.ref(CALENDAR_ROOT).transaction((calendar) => C.applyEventToCalendar(calendar || {}, request, roomKey()).calendar);
    await db.ref(`${requestPath()}/${id}`).remove();
  }

  function bindData() {
    db.ref(CALENDAR_ROOT).on('value', (snap) => {
      state.calendar = snap.val() || {};
      state.room = C.roomStateFrom(state.calendar, roomKey());
      Object.keys(state.room.actions || {}).forEach((id) => state.pending.delete(id));
      render();
    });
    db.ref(PLAYER_ROOT).on('value', (snap) => { state.players = snap.val() || {}; });
    db.ref(KNOWLEDGE_ROOT).on('value', (snap) => { state.knowledge = snap.val() || {}; decorateLog(); });
    const scenePath = theatre()?.getPaths?.().scene || 'campaña/estado_mundo/escena_actual';
    db.ref(scenePath).on('value', (snap) => { state.scene = snap.val() || {}; decorateLog(); });
    if (isDm()) db.ref(requestPath()).on('child_added', (snap) => consumeRequest(snap.key, snap.val() || {}).catch(console.error));
    const logPath = theatre()?.getPaths?.().log || 'campaña/teatro/log';
    db.ref(logPath).on('value', (snap) => { state.log = Object.entries(snap.val() || {}); decorateLog(); });
  }

  function preflight(message) {
    const length = C.validateMessageLength(message, state.room.mode || 'scene');
    if (!length.valid) return `Límite de ${length.limit} caracteres para ${length.type}.`;
    const actorId = C.clean(message?.actorId);
    if (C.normalizeType(message) === 'actuar' && actorId && blocking(actorId)) return 'El actor ya está realizando una acción.';
    return null;
  }
  function patchTheatre() {
    const t = theatre();
    if (!t?.enqueueIntervention || t.__luminousSceneTimePatched) return false;
    const original = t.enqueueIntervention.bind(t);
    t.enqueueIntervention = async function(message) {
      const error = preflight(message || {});
      if (error) { global.alert?.(error); return {queued:false,reason:'scene_time_blocked'}; }
      const type = C.normalizeType(message || {}), actorId = C.clean(message?.actorId);
      if (type === 'actuar' && actorId) state.pending.add(actorId);
      try {
        const result = await original(message);
        if (!result?.queued || !result.key) { state.pending.delete(actorId); return result; }
        submitEvent({ type:'intervention', source:'theatre', eventId:`theatre_${roomKey()}_${result.key}`, message:C.clone(message || {}) })
          .catch((e) => { state.pending.delete(actorId); console.error(e); });
        return result;
      } catch (e) { state.pending.delete(actorId); throw e; }
    };
    t.__luminousSceneTimePatched = true;
    return true;
  }
  function patchCombat() {
    const engine = global.CombatEngine;
    if (!isDm() || !engine?.triggerPhase || engine.__luminousSceneTimePatched) return false;
    const original = engine.triggerPhase;
    engine.triggerPhase = function(phaseTag) {
      const tag = C.clean(phaseTag);
      if (tag === '[Round Start]' && state.room.mode !== 'combat') submitEvent({type:'set_mode',mode:'combat',source:'combat'}).catch(console.error);
      const result = original.apply(this, arguments);
      if (tag === '[Round End]') submitEvent({type:'combat_round',source:'combat'}).catch(console.error);
      return result;
    };
    engine.__luminousSceneTimePatched = true;
    return true;
  }

  function ensureStyles() {
    if (doc.getElementById('scene-time-v1-styles')) return;
    const style = doc.createElement('style'); style.id = 'scene-time-v1-styles';
    style.textContent = `.scene-time-panel{background:#111;border:1px solid #777;padding:8px;margin:8px;color:#ddd;font:12px Arial}.scene-time-row{display:flex;gap:6px;align-items:center;margin:4px 0}.scene-time-row strong{min-width:90px}.scene-time-row button{font-size:11px}.scene-time-player{position:absolute;right:18px;bottom:18px;z-index:120;background:#111d;border:1px solid #777;padding:8px;color:#eee}.scene-time-blocked{opacity:.55}`;
    doc.head?.appendChild(style);
  }
  function actionRows() { return Object.entries(state.room.actions || {}).filter(([,a]) => C.isActionBlocking(a)); }
  function renderDm() {
    if (!isDm()) return;
    const host = doc.getElementById('theatre-director-panel') || doc.getElementById('modulo-teatro'); if (!host) return;
    let panel = doc.getElementById('scene-time-director'); if (!panel) { panel = doc.createElement('section'); panel.id='scene-time-director'; panel.className='scene-time-panel'; host.appendChild(panel); }
    panel.replaceChildren(); const head = doc.createElement('strong'); head.textContent=`SCENE TIME · ${String(state.room.mode || 'scene').toUpperCase()}`; panel.appendChild(head);
    actionRows().forEach(([actorId,a]) => {
      const row=doc.createElement('div'); row.className='scene-time-row';
      const label=doc.createElement('strong'); label.textContent=`${actorName(actorId)} · ${Math.ceil(Number(a.remainingSeconds)||0)}s`; row.append(label);
      const add=(txt,fn)=>{const b=doc.createElement('button');b.type='button';b.textContent=txt;b.onclick=fn;row.appendChild(b);};
      add('-1',()=>controlAction(actorId,'set_duration',{durationSeconds:Math.max(1,(a.durationSeconds||1)-1)}));
      add('+1',()=>controlAction(actorId,'set_duration',{durationSeconds:(a.durationSeconds||1)+1}));
      add('Completar',()=>controlAction(actorId,'complete'));
      add('Interrumpir',()=>controlAction(actorId,'interrupt'));
      add('Imposible',()=>controlAction(actorId,'impossible'));
      if (!a.check?.required) add('Asignar Check',()=>{
        const dc=Math.max(0,Number(global.prompt?.('DC del Check','14'))||14); const before=global.confirm?.('¿Resolver el Check ANTES de consumir la acción?') || false;
        controlAction(actorId,'attach_check',{check:{required:true,timing:before?'before':'after',dc,allowed:['str','athletics']}});
      });
      if (a.status === 'resolution_pending' || a.status === 'check_before_pending') { add('✓ Éxito',()=>controlAction(actorId,'resolve_check',{success:true})); add('✕ Fallo',()=>controlAction(actorId,'resolve_check',{success:false})); }
      panel.appendChild(row);
    });
    const next=doc.createElement('button'); next.type='button'; next.textContent='AVANZAR AL PRÓXIMO EVENTO'; next.onclick=()=>submitEvent({type:'next_event',source:'dm'}); panel.appendChild(next);
    if (state.room.mode === 'combat') { const round=doc.createElement('button'); round.type='button'; round.textContent='CERRAR RONDA +6s'; round.onclick=()=>submitEvent({type:'combat_round',source:'dm'}); panel.appendChild(round); }
  }
  function linkedCheck(action, option) {
    if (!action || state.linked[action.actionId]) return;
    const requesterUid=uid(); if (!requesterUid) return;
    const req=db.ref('theatre_check_requests').push();
    const rollSpec={...option,label:option.kind==='skill'?'Athletics':String(option.abilityId||'str').toUpperCase()};
    state.linked[action.actionId]={ref:req};
    const listener=(snap)=>{
      const value=snap.val()||{}; if (value.status==='denied') { cleanup(); return; }
      if (value.status!=='approved'||!value.commandId) return;
      const live=db.ref(`theatre_check_live/${requesterUid}/${value.commandId}`);
      const liveListener=(ls)=>{const r=ls.val()||{};if(r.status!=='complete')return;const success=r.outcome==='passed'||(r.outcome==null&&Number(r.total)>=Number(action.check?.dc));submitEvent({type:'action_control',actorId:action.actorId,command:'resolve_check',success,total:Number(r.total),eventId:`check_${action.actionId}_${value.commandId}`,source:'theatre-check'}).finally(cleanup);};
      state.linked[action.actionId].live=live; state.linked[action.actionId].liveListener=liveListener; live.on('value',liveListener);
    };
    function cleanup(){const item=state.linked[action.actionId];item?.ref?.off('value',listener);item?.live?.off('value',item.liveListener);delete state.linked[action.actionId];render();}
    req.on('value',listener);
    req.set({schemaVersion:1,requesterUid,playerId:global.localStorage?.getItem('playerId')||null,actorId:action.actorId,playerName:C.clean(playerData().nombre||playerData().name)||'PLAYER',roomKey:roomKey(),status:'pending',rollSpec,sceneTimeActionId:action.actionId,sceneTimeCheck:{dc:action.check?.dc,timing:action.check?.timing},createdAt:firebase.database.ServerValue.TIMESTAMP,clientCreatedAt:Date.now()});
    render();
  }
  function renderPlayer() {
    if (isDm()) return;
    const actorId=assignedActor(), action=actorId?state.room.actions?.[actorId]:null;
    let panel=doc.getElementById('scene-time-player');
    if (!action || (!C.isActionBlocking(action) && !state.linked[action.actionId])) { panel?.remove(); updateLock(); return; }
    if (!panel) { panel=doc.createElement('aside');panel.id='scene-time-player';panel.className='scene-time-player';doc.body.appendChild(panel); }
    panel.replaceChildren(); const title=doc.createElement('strong');title.textContent=`${action.description||'Acción'} · ${Math.ceil(Number(action.remainingSeconds)||0)}s`;panel.appendChild(title);
    if (action.status==='resolution_pending'||action.status==='check_before_pending') {
      const note=doc.createElement('div');note.textContent=state.linked[action.actionId]?'CHECK EN CURSO…':`CHECK DC ${action.check?.dc ?? '—'}`;panel.appendChild(note);
      if (!state.linked[action.actionId]) (action.check?.allowed||[]).forEach((opt)=>{const b=doc.createElement('button');b.type='button';b.textContent=opt.kind==='skill'?'ATHLETICS':String(opt.abilityId).toUpperCase();b.onclick=()=>linkedCheck(action,opt);panel.appendChild(b);});
    }
    updateLock();
  }
  function updateLock() {
    const pb=doc.getElementById('btn-enviar-teatro-modal'), pt=doc.getElementById('player-tipo-dialogo-select'), pa=assignedActor();
    const block=Boolean(pa&&blocking(pa)&&pt?.value==='actuar'); if(pb){pb.disabled=block;pb.classList.toggle('scene-time-blocked',block);}
    const dbtn=doc.getElementById('btn-send-dialogue'),dt=doc.getElementById('dm-tipo-dialogo-select'),da=C.clean(doc.getElementById('theatre-speaker-select')?.value);
    const dblock=Boolean(da&&da!=='narrador'&&blocking(da)&&dt?.value==='actuar');if(dbtn){dbtn.disabled=dblock;dbtn.classList.toggle('scene-time-blocked',dblock);}
  }
  function decorateLog() {
    const rows=Array.from(doc.querySelectorAll?.('#theatre-log-container .dialogue-row')||[]);
    state.log.forEach(([messageId,msg],i)=>{
      if(C.normalizeType(msg)!=='actuar')return;const row=rows[i];if(!row)return;const actorId=C.clean(msg.actorId);if(!actorId)return;
      row.dataset.messageId=messageId;row.dataset.actorId=actorId;const text=row.querySelector('p,.dialogue-text,.dialogue-content');if(!text)return;
      text.textContent=C.replaceActionIdentity(text.textContent,visibleName(actorId,msg.nombre),C.clean(msg.nombre)||actorName(actorId));
    });
  }
  function render(){ensureStyles();renderDm();renderPlayer();updateLock();decorateLog();}
  function controlAction(actorId,command,extra={}){return submitEvent({type:'action_control',actorId,command,source:'dm',...extra});}
  function boot(){bindData();patchTheatre();patchCombat();render();doc.addEventListener('change',updateLock);new MutationObserver(decorateLog).observe(doc.body,{childList:true,subtree:true});global.setInterval(()=>{patchTheatre();patchCombat();updateLock();},1000);}

  global.LuminousSceneTime=Object.freeze({submitEvent,controlAction,blockingActionFor:blocking,setMode:(mode)=>submitEvent({type:'set_mode',mode:mode==='combat'?'combat':'scene',source:'dm'}),advanceToNextEvent:()=>submitEvent({type:'next_event',source:'dm'}),recordCombatRound:()=>submitEvent({type:'combat_round',source:'combat'}),getRuntimeState:()=>({calendar:C.clone(state.calendar),roomState:C.clone(state.room),roomKey:roomKey()}),refresh:render});
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
