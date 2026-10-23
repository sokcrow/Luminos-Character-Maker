/* Ordered, idempotent result consumption. Never executes a combat rule. */
(function (global) {
  'use strict';
  const SCHEMA = 1, ENGINE = '0.7.3-playback.1';
  const copy = value => JSON.parse(JSON.stringify(value));
  const instantCues = new Set(['actionStart', 'powerStart', 'powerEnd', 'hitsStart', 'hitStart', 'spellResult', 'healingMotion']);
  // Only presentation uses this clock. Rule results and RNG stay authoritative.
  function createPresentationClock({ now = () => Date.now(), leadMs = 120,
    setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    let stopped = false, failure = null;
    const timers = new Map(), pending = new Set();
    async function wait(playAt) {
      while (!stopped && Number.isFinite(playAt) && playAt > now()) {
        await new Promise(resolve => {
          const id = setTimer(() => { timers.delete(id); resolve(); }, Math.min(250, playAt - now()));
          timers.set(id, resolve);
        });
      }
      return !stopped;
    }
    return Object.freeze({
      stamp() { if (failure) throw failure; return { schemaVersion: 1, playAt: now() + leadMs }; },
      wait,
      run(cue, timing, render) {
        if (failure) throw failure;
        const task = (async () => { if (await wait(timing.playAt)) await render(); })();
        pending.add(task);
        task.then(() => pending.delete(task), error => { pending.delete(task); failure = error; });
        // DOM preparation has no hold. Queue it at the same server time as the
        // next animated cue, without charging a network buffer for each label.
        return instantCues.has(cue) ? Promise.resolve() : task;
      },
      async drain() { await Promise.all([...pending]); if (failure) throw failure; },
      stop() { stopped = true; for (const [id, resolve] of timers) { clearTimer(id); resolve(); } timers.clear(); },
    });
  }
  function createConsumer({ generation, checkpoint, apply, present, finish, onEvent = () => {}, onError = () => {}, beforeEvents = async () => {} }) {
    let cursor = Number(checkpoint?.seq) || 0, eventCursor = Number(checkpoint?.eventCursor) || 0;
    let chain = Promise.resolve(), stopped = false;
    const pending = new Map(), seen = new Map();
    async function drain() {
      while (!stopped && pending.has(cursor + 1)) {
        const row = pending.get(cursor + 1);
        if (row.schemaVersion !== SCHEMA || row.engineVersion !== ENGINE || row.generation !== generation)
          throw new Error('PLAYBACK_INCOMPATIBLE');
        const events = Object.values(row.events || {});
        for (let index=0;index<events.length;) {
          if(stopped)return;
          const first=events[index],group=[first];index++;
          // The authority rolls both Clash sides together. Consume their
          // adjacent Coin cues together too, rather than playing A then B and
          // accumulating one extra animation per Coin on every viewer.
          while(first.type==='Presentation'&&first.cue==='powerCoin'&&index<events.length){
            const next=events[index];
            if(next.type!=='Presentation'||next.cue!=='powerCoin'||next.args?.[1]?.index!==first.args?.[1]?.index)break;
            group.push(next);index++;
          }
          await beforeEvents(group, row, events.slice(index));
          if (stopped) return;
          const presentations=[];
          for(const event of group){
            if (event.sequence !== eventCursor + 1) throw new Error('PLAYBACK_EVENT_GAP');
            if (event.combatants) apply(copy(event.combatants));
            else if(event.changes?.length) apply(Object.fromEntries(event.changes.filter(change=>change.after).map(change=>[change.unitId,copy(change.after)])));
            await onEvent(copy(event));
            if(stopped)return;
            if (event.type === 'Presentation') presentations.push(present(event.cue, copy(event.args || []), row, event));
            eventCursor = event.sequence;
          }
          await Promise.all(presentations);
        }
        if(stopped)return;
        if (Number(row.eventCursor) !== eventCursor) throw new Error('PLAYBACK_CHECKPOINT_CURSOR');
        if(row.combatants) apply(copy(row.combatants));
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
        const seq = Number(row.seq), signature = JSON.stringify(Object.fromEntries(Object.entries(row).filter(([key])=>key!=='updatedAt')));
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
  global.LuminousCombatPlayback = Object.freeze({ schemaVersion: SCHEMA, engineVersion: ENGINE, timelineVersion: 1,
    createConsumer, createPresentationClock, isInstantCue: cue => instantCues.has(cue) });
})(typeof window === 'undefined' ? globalThis : window);
