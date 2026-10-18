(function (global) {
  'use strict';
  const ROOT = 'campaña/combate/playback/current';
  const copy = value => JSON.parse(JSON.stringify(value ?? null));
  const session = global.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const state = { generation: null, consumer: null, ref: null, handler: null, eventCursor: 0,
    connected: true, connectionRef: null, connectionHandler: null, authority: null, starting: false, transmittedSnapshot: {} };
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
    payload.id = `${payload.round}-${payload.seed}-${session}`;
    payload.initialStateJson=JSON.stringify(state.authority.snapshotRuntime());
    payload.playback = { schemaVersion: 1, engineVersion: protocol().engineVersion, session, generation: payload.id };
    const result = await s.db.ref(a.ROOT.current).transaction(current => {
      if (Number(current?.round) >= payload.round && ['sealed', 'running', 'complete'].includes(current?.phase)) return;
      return payload;
    }, undefined, false);
    if (!result.committed) throw new Error('Este turno ya está en resolución en otra pestaña del DM.');
    return result.snapshot.val();
  }
  function assertOwner(data) {
    if (enabled(data) && data.playback.session !== session)
      throw new Error('El turno pertenece a otra pestaña del DM. Reabre la pestaña que lo inició para continuar.');
  }
  function beginUpdates(data) {
    assertOwner(data); state.eventCursor = 0;
    state.transmittedSnapshot=JSON.parse(data.initialStateJson);
    surface().capturePresentation(true);
    return { [ROOT]: { generation: data.id, schemaVersion: 1, engineVersion: protocol().engineVersion } };
  }
  function batchUpdates(row) {
    const a = state.authority, current = a.state.current;
    if (!enabled(current)) return {};
    assertOwner(current);
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
    // RTDB removes empty maps/arrays and null properties. Encode the complete
    // domain payload so removing a Status or spending the last charge survives
    // transport exactly; the envelope stays queryable and permission-checked.
    const {updatedAt,...result}=row;
    const batch = { seq:row.seq, schemaVersion:1,engineVersion:protocol().engineVersion,generation:current.id,updatedAt,
      payload:JSON.stringify({...copy(result),events,nextRound:row.type==='round_complete'?Number(current.round)+1:null}) };
    row.stateJson=JSON.stringify(row.combatants);
    return { [`${ROOT}/batches/${String(row.seq).padStart(6, '0')}`]: batch };
  }
  function disconnectConsumer() {
    state.consumer?.stop(); state.consumer = null;
    if (state.ref && state.handler) state.ref.off('child_added', state.handler);
    state.ref = state.handler = null; state.generation = null;
  }
  async function observe(data) {
    const a = state.authority, s = adapter();
    if (!enabled(data) || s?.role !== 'player' || !surface() || !global.LuminousCombat073?.combatants?.() || !s.hydratedOnce) return;
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
      surface().beginPlayback(data.round);
      if(data.initialStateJson&&!checkpoint)a.applySnapshot(JSON.parse(data.initialStateJson));
      if (checkpoint?.combatants) { a.applySnapshot(checkpoint.stateJson?JSON.parse(checkpoint.stateJson):checkpoint.combatants); a.state.cursor = Number(checkpoint.rngCursor) || 0; }
      state.consumer = protocol().createConsumer({ generation: data.id, checkpoint,
        apply: snapshot => { a.applySnapshot(snapshot); surface().refreshPlayback(); },
        onEvent: event => { surface().acceptEvent(event); a.state.cursor = Number(event.rngCursor) || 0; },
        present: async (cue, args, row) => {
          // Slow/reconnected viewers catch up by applying states, without waiting
          // through old animation holds. Visual mode never changes the result.
          if (Date.now() - Number(row.updatedAt) < 8000) await surface().present(cue, args);
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
  }
  function stop() {
    disconnectConsumer();
    if (state.connectionRef) state.connectionRef.off('value', state.connectionHandler);
    state.connectionRef = state.connectionHandler = null;
  }
  global.LuminousCombatPlaybackSync = Object.freeze({ ROOT, state, session, enabled, negotiate, seal, assertOwner,
    beginUpdates, batchUpdates, observe, start, stop });
  global.addEventListener('luminous:combat073-hydrated', () => {
    const a = state.authority, data = a?.state.current;
    if (enabled(data) && data.phase === 'complete' && data.checkpoint?.combatants) {
      a.applySnapshot(data.checkpoint.stateJson?JSON.parse(data.checkpoint.stateJson):data.checkpoint.combatants); surface()?.refreshPlayback();
    }
    if (a) observe(data).catch(console.error);
  });
})(window);
