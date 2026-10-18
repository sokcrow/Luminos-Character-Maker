/* Ordered, idempotent result consumption. Never executes a combat rule. */
(function (global) {
  'use strict';
  const SCHEMA = 1, ENGINE = '0.7.3-playback.1';
  const copy = value => JSON.parse(JSON.stringify(value));
  function createConsumer({ generation, checkpoint, apply, present, finish, onEvent = () => {}, onError = () => {} }) {
    let cursor = Number(checkpoint?.seq) || 0, eventCursor = Number(checkpoint?.eventCursor) || 0;
    let chain = Promise.resolve(), stopped = false;
    const pending = new Map(), seen = new Map();
    async function drain() {
      while (!stopped && pending.has(cursor + 1)) {
        const row = pending.get(cursor + 1);
        if (row.schemaVersion !== SCHEMA || row.engineVersion !== ENGINE || row.generation !== generation)
          throw new Error('PLAYBACK_INCOMPATIBLE');
        const events = Object.values(row.events || {});
        for (const event of events) {
          if (event.sequence !== eventCursor + 1) throw new Error('PLAYBACK_EVENT_GAP');
          // State is replaced with DM values. Damage, costs and status helpers
          // are never called at a presentation/impact marker.
          if (event.combatants) apply(copy(event.combatants));
          else for (const change of event.changes || []) if (change.after) apply({ [change.unitId]: copy(change.after) });
          await onEvent(copy(event));
          if (event.type === 'Presentation') await present(event.cue, copy(event.args || []), row);
          eventCursor = event.sequence;
        }
        if (Number(row.eventCursor) !== eventCursor) throw new Error('PLAYBACK_CHECKPOINT_CURSOR');
        apply(copy(row.combatants || {}));
        pending.delete(row.seq); cursor = row.seq;
        if (row.type === 'round_complete') await finish(row);
      }
    }
    return Object.freeze({
      receive(value) {
        if (stopped) return chain;
        let row;
        try {
          const envelope=copy(value), result=JSON.parse(envelope.payload);
          row={...result,schemaVersion:envelope.schemaVersion,engineVersion:envelope.engineVersion,
            generation:envelope.generation,seq:envelope.seq,updatedAt:envelope.updatedAt};
        } catch(error) { stopped=true;onError(new Error('PLAYBACK_INVALID_PAYLOAD'));return chain; }
        const seq = Number(row.seq), signature = JSON.stringify(row);
        if (!Number.isInteger(seq) || seq < 1 || row.generation !== generation) return chain;
        if (seen.has(seq) && seen.get(seq) !== signature) {
          stopped = true; onError(new Error('PLAYBACK_BATCH_CONFLICT')); return chain;
        }
        if (seq <= cursor) return chain;
        seen.set(seq, signature); pending.set(seq, row);
        chain = chain.then(drain).catch(error => { stopped = true; onError(error); });
        return chain;
      },
      cursor: () => cursor, eventCursor: () => eventCursor, idle: () => chain,
      stop() { stopped = true; pending.clear(); seen.clear(); },
    });
  }
  global.LuminousCombatPlayback = Object.freeze({ schemaVersion: SCHEMA, engineVersion: ENGINE, createConsumer });
})(typeof window === 'undefined' ? globalThis : window);
