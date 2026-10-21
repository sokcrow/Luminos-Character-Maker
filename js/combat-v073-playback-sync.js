(function (global) {
  'use strict';
  const ROOT = 'campaña/combate/playback/current';
  const copy = value => JSON.parse(JSON.stringify(value ?? null));
  const session = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const state = { generation: null, consumer: null, ref: null, handler: null, eventCursor: 0, batchSeq: 0,
    connected: true, connectionRef: null, connectionHandler: null, offsetRef:null,offsetHandler:null,serverOffset:0,
    authority: null, starting: false, transmittedSnapshot: {}, recoveryButton:null, stagedUpdates:{} };
  const adapter = () => global.LuminousCombatLiveAdapter073?.state;
  const surface = () => global.LuminousCombatStepRuntime;
  const status = text => { const node = global.document?.getElementById?.('status'); if (node) node.textContent = text; };
  const protocol = () => global.LuminousCombatPlayback;
  function enabled(data) { return data?.playback != null; }
  function negotiate(ready, playerIds) {
    return playerIds.length > 0 && playerIds.every(id => ready?.[id]?.playback?.schemaVersion === 1 &&
      ready[id].playback.engineVersion === protocol()?.engineVersion);
  }
  async function seal(payload) {
    const a = state.authority, s = adapter();
    const encounterCandidate=`encounter-${global.crypto?.randomUUID?.()||`${session}-${Date.now()}`}`;
    // Share the encounter identity already used by loot/setup. Claim a missing
    // identity atomically so competing DM tabs cannot invent different scopes.
    payload.initialStateJson=JSON.stringify(state.authority.snapshotRuntime());
    payload.initialExecutionJson=JSON.stringify(surface()?.captureExecution?.([],new Set())||{units:state.authority.snapshotRuntime(),queue:[],resolvedKeys:[]});
    const result = await global.LuminousCombatSession.updateRoot(s.db,raw => {
      if(!global.LuminousCombatSession.canSeal(raw,payload))return;
      const current=raw.authority?.current;
      payload.encounterId=raw.estado?.encounterId||encounterCandidate;
      payload.id = `${payload.encounterId}-${payload.round}-${payload.seed}-${session}`;
      payload.playback = { schemaVersion: 1, engineVersion: protocol().engineVersion, session, generation: payload.id };
      if (current?.encounterId===payload.encounterId&&Number(current?.round) >= payload.round && ['sealed', 'running', 'complete'].includes(current?.phase)) return;
      return {...raw,authority:{...(raw.authority||{}),current:payload},estado:{...(typeof raw.estado==='object'?raw.estado:{}),encounterId:payload.encounterId,phase:'COMBAT_SEALED',active:true,round:payload.round}};
    });
    if (!result.committed) throw new Error('Este turno ya está en resolución en otra pestaña del DM.');
    return result.snapshot.val().authority.current;
  }
  function assertOwner(data) {
    const executing=state.authority?.state?.executingGeneration;
    if ((enabled(data)||executing) && (data?.playback?.session !== session||(executing&&data.id!==executing)))
      throw new Error('El turno pertenece a otra pestaña del DM. Reabre la pestaña que lo inició para continuar.');
  }
  function beginUpdates(data) {
    assertOwner(data); state.eventCursor = 0; state.batchSeq = 0;
    state.stagedUpdates={};
    state.transmittedSnapshot=JSON.parse(data.initialStateJson);
    surface().capturePresentation(true);
    return { [ROOT]: { generation: data.id, schemaVersion: 1, engineVersion: protocol().engineVersion } };
  }
  function batchUpdates(row) {
    const a = state.authority, current = a.state.current;
    if (!enabled(current)) return {};
    assertOwner(current);
    // Presentation batches and completed-action recovery checkpoints share
    // one transport sequence. Only completed actions advance the checkpoint.
    row.seq = ++state.batchSeq;
    a.state.lastCheckpointSeq = row.seq;
    const events = surface().events().filter(event => event.sequence > state.eventCursor).map(event=>{
      if(event.combatants){
        event.changes=Object.entries(event.combatants).filter(([id,value])=>JSON.stringify(state.transmittedSnapshot[id])!==JSON.stringify(value))
          .map(([unitId,after])=>({unitId,after}));
        state.transmittedSnapshot=copy(event.combatants);delete event.combatants;
      }else if(event.changes){
        event.changes=event.changes.map(({unitId,after})=>({unitId,after}));
        for(const change of event.changes)state.transmittedSnapshot[change.unitId]=copy(change.after);
      }
      return event;
    });
    state.eventCursor = events.at(-1)?.sequence || state.eventCursor;
    row.eventCursor = state.eventCursor;
    row.generation = current.id;
    row.session=session;
    // RTDB removes empty maps/arrays and null properties. Encode the complete
    // domain payload so removing a Status or spending the last charge survives
    // transport exactly; the envelope stays queryable and permission-checked.
    const {updatedAt,...result}=row;
    const batch = { seq:row.seq, session, schemaVersion:1,engineVersion:protocol().engineVersion,generation:current.id,updatedAt,
      payload:JSON.stringify({...copy(result),events,nextRound:row.type==='round_complete'?Number(current.round)+1:null}) };
    row.stateJson=JSON.stringify(row.combatants);
    return { [`${ROOT}/batches/${String(row.seq).padStart(6, '0')}`]: batch };
  }
  function disconnectConsumer() {
    global.LuminousCombatAudiovisual073?.clear();
    state.consumer?.stop(); state.consumer = null;
    if (state.ref && state.handler) state.ref.off('child_added', state.handler);
    state.ref = state.handler = null; state.generation = null;
  }
  function stageUpdates(updates){
    const a=state.authority;
    if((adapter()?.role!=='dm'&&!adapter()?.isAuthority)||!a?.state.runningLocal||!enabled(a.state.current))return false;
    assertOwner(a.state.current);Object.assign(state.stagedUpdates,copy(updates));return true;
  }
  function commitUpdates(updates){
    const result={...updates};
    for(const [path,raw]of Object.entries(state.stagedUpdates)){
      let value=copy(raw);
      for(const key of Object.keys(result))if(key.startsWith(path+'/')){
        if(value&&typeof value==='object'){
          const parts=key.slice(path.length+1).split('/');let node=value;
          for(const part of parts.slice(0,-1))node=node[part]??={};
          node[parts.at(-1)]=result[key];
        }
        delete result[key];
      }
      result[path]=value;
    }
    state.stagedUpdates={};return result;
  }
  function refreshRecoveryControl(data=state.authority?.state.current){
    const s=adapter(),visible=(s?.role==='dm'||s?.isAuthority)&&enabled(data)&&['sealed','running'].includes(data.phase)&&data.playback.session!==session;
    if(!state.recoveryButton&&visible&&global.document?.createElement){
      const button=global.document.createElement('button');button.type='button';button.id='resume-combat-round';
      button.textContent='Reanudar turno aquí';
      button.title='Continúa desde el último resultado confirmado y detiene la resolución en la otra pestaña.';
      button.style.cssText='box-sizing:border-box;min-height:44px;padding:10px 16px;background:#231d11;color:#f3dfaa;border:1px solid #c4a86b;border-radius:4px;cursor:pointer';
      button.onclick=async()=>{button.disabled=true;try{await recover();}catch(error){console.error('[Combat recovery]',error);status(error.message);}finally{button.disabled=false;refreshRecoveryControl();}};
      const panel=global.document.getElementById('c073-dm-setup');
      if(panel){
        button.style.cssText+=';display:block;width:100%;margin-top:8px';
        panel.querySelector('summary')?.after(button);panel.open=true;
      }else{
        button.style.cssText+=';position:fixed;left:16px;top:84px;z-index:2147483001';
        global.document.body?.appendChild(button);
      }
      state.recoveryButton=button;
    }
    if(state.recoveryButton){state.recoveryButton.hidden=!visible;state.recoveryButton.style.display=visible?'block':'none';}
  }
  async function recover(){
    const a=state.authority,s=adapter(),expected=copy(a?.state.current);
    if((s?.role!=='dm'&&!s?.isAuthority)||a.state.runningLocal||!enabled(expected)||!['sealed','running'].includes(expected.phase))return false;
    if(!expected.initialExecutionJson||(expected.checkpoint&&!expected.checkpoint.executionJson))
      throw new Error('Este turno se inició con un visor anterior. Continúa desde la pestaña que lo inició.');
    const claimed=await s.db.ref(a.ROOT.current).transaction(current=>{
      if(current?.id!==expected.id||!['sealed','running'].includes(current.phase)||
        current.playback.session!==expected.playback.session||Number(current.checkpoint?.seq||0)!==Number(expected.checkpoint?.seq||0))return;
      const id=`${current.encounterId}-${current.round}-${current.seed}-${global.crypto?.randomUUID?.()||`${session}-${Date.now()}`}`;
      return {...current,id,playback:{...current.playback,session,generation:id}};
    },undefined,false);
    if(!claimed.committed)throw new Error('Se confirmaron nuevos resultados. Vuelve a pulsar Reanudar turno.');
    const current=claimed.snapshot.val(),checkpoint=current.checkpoint;
    a.state.current=current;
    const saved=JSON.parse(checkpoint?.executionJson||current.initialExecutionJson);
    saved.eventCursor=Number(checkpoint?.eventCursor)||0;
    a.state.resumeRuntime=saved;
    if(current.phase==='running'){
      a.state.lastCheckpointSeq=Number(checkpoint?.seq)||0;
      a.state.localActionSeq=Number(checkpoint?.actionSeq??checkpoint?.seq)||0;
      a.state.localDigests.clear();a.state.pendingRemoteCheckpoints.clear();a.state.inFlightActions=0;
      a.state.executionChain=Promise.resolve();a.state.writeChain=Promise.resolve();a.state.writeFailure=null;
      state.stagedUpdates={};
      a.resetRandom(current.seed,Number(checkpoint?.rngCursor)||0);
      a.applySnapshot(JSON.parse(checkpoint?.stateJson||current.initialStateJson));
      state.eventCursor=saved.eventCursor;state.batchSeq=Number(checkpoint?.seq)||0;state.transmittedSnapshot=a.snapshotRuntime();
      surface().capturePresentation(true);
      // Discard uncommitted presentation from the abandoned attempt. A new
      // generation makes consumers roll back to the last completed action.
      await s.db.ref(ROOT).set({generation:current.id,schemaVersion:1,engineVersion:protocol().engineVersion});
    }
    status('Reanudando el turno…');refreshRecoveryControl(current);
    return a.requestStartRound();
  }
  async function observe(data) {
    const a = state.authority, s = adapter();
    refreshRecoveryControl(data);
    if (!enabled(data) || s?.role !== 'player' || s?.isAuthority || !surface() || !global.LuminousCombat073?.combatants?.() || !s.hydratedOnce) return;
    if (data.playback.schemaVersion !== 1 || data.playback.engineVersion !== protocol()?.engineVersion) {
      surface().lockPlanning(true); status('Actualiza el visor para continuar este combate.'); return;
    }
    if (state.generation === data.id || state.starting) return;
    state.starting = true;
    try {
      disconnectConsumer(); state.generation = data.id;
      const checkpoint = data.checkpoint;
      if (data.phase === 'complete') {
        if (checkpoint?.combatants) a.applySnapshot(checkpoint.stateJson?JSON.parse(checkpoint.stateJson):checkpoint.combatants);
        a.state.cursor = Number(checkpoint?.rngCursor) || 0;
        surface().finishPlayback(Number(data.round) + 1);
        a.state.runningLocal = false; return;
      }
      if (!['running', 'sealed'].includes(data.phase)) return;
      a.state.runningLocal = true;
      const freshSince=Date.now()+state.serverOffset-8000;
      surface().beginPlayback(data.round);
      if(data.initialStateJson&&!checkpoint)a.applySnapshot(JSON.parse(data.initialStateJson));
      if (checkpoint?.combatants) { a.applySnapshot(checkpoint.stateJson?JSON.parse(checkpoint.stateJson):checkpoint.combatants); a.state.cursor = Number(checkpoint.rngCursor) || 0; }
      state.consumer = protocol().createConsumer({ generation: data.id, checkpoint,
        apply: snapshot => { a.applySnapshot(snapshot); surface().refreshPlayback(); },
        onEvent: event => {
          surface().acceptEvent(event); a.state.cursor = Number(event.rngCursor) || 0;
          if(event.type==='QueueEntryStarted'||event.type==='CoinRolled')status('Resolviendo turno…');
          else if(event.type==='ClashStarted')status('Choque de habilidades…');
          else if(event.type==='RoundFinished')status('Preparando el próximo turno…');
        },
        present: async (cue, args, row) => {
          // Slow/reconnected viewers catch up by applying states, without waiting
          // through old animation holds. Visual mode never changes the result.
          // A fresh batch stays fresh throughout its own animation. Checking
          // the clock on every cue used to cut off long Clashes mid-playback.
          if (Number(row.updatedAt) >= freshSince) await surface().present(cue, args);
        },
        finish: row => {
          a.state.cursor = Number(row.rngCursor) || 0;
          surface().finishPlayback(row.nextRound);
          a.state.runningLocal = false;
          global.LuminousCombatLiveAdapter073?.scheduleHydrate?.();
        },
        onError: error => { console.error('[Combat playback]', error); status('No se pudo sincronizar el combate. Vuelve a abrir el visor.'); },
      });
      state.ref = s.db.ref(`${ROOT}/batches`).orderByKey().startAt(String((Number(checkpoint?.seq) || 0) + 1).padStart(6, '0'));
      state.handler = snapshot => { state.consumer?.receive(snapshot.val()); };
      state.ref.on('child_added', state.handler, error => {
        console.error('[Combat playback subscription]', error); status('No se pudo conectar al combate. Vuelve a abrir el visor.');
      });
      status(state.connected ? 'Esperando los resultados del DM…' : 'Reconectando…');
    } finally { state.starting = false; }
  }
  function start(authority) {
    state.authority = authority;
    if (state.connectionRef || !adapter()?.db?.ref) return;
    state.connectionRef = adapter().db.ref('.info/connected');
    state.connectionHandler = snap => {
      state.connected = snap.val() === true;
      if (enabled(authority.state.current) && authority.state.current.phase !== 'complete') {
        if (!state.connected) status('Reconectando…');
        else if (adapter()?.role === 'player') status('Esperando los resultados del DM…');
      }
    };
    state.connectionRef.on('value', state.connectionHandler);
    state.offsetRef=adapter().db.ref('.info/serverTimeOffset');
    state.offsetHandler=snap=>{state.serverOffset=Number(snap.val())||0;};
    state.offsetRef.on('value',state.offsetHandler);
  }
  function stop() {
    disconnectConsumer();
    if (state.connectionRef) state.connectionRef.off('value', state.connectionHandler);
    state.connectionRef = state.connectionHandler = null;
    if(state.offsetRef)state.offsetRef.off('value',state.offsetHandler);
    state.offsetRef=state.offsetHandler=null;
  }
  global.LuminousCombatPlaybackSync = Object.freeze({ ROOT, state, session, enabled, negotiate, seal, assertOwner,
    beginUpdates, batchUpdates, observe, start, stop, recover, refreshRecoveryControl,stageUpdates,commitUpdates,disconnectConsumer });
  global.addEventListener('luminous:combat073-hydrated', () => {
    const a = state.authority, data = a?.state.current;
    if (enabled(data) && data.phase === 'complete' && data.checkpoint?.combatants && !a.state.runningLocal) {
      a.applySnapshot(data.checkpoint.stateJson?JSON.parse(data.checkpoint.stateJson):data.checkpoint.combatants); surface()?.refreshPlayback();
    }
    if (a) observe(data).catch(console.error);
  });
})(window);
