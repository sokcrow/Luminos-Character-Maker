/* Ordered, idempotent result consumption. Never executes a combat rule. */
(function (global) {
  'use strict';
  const SCHEMA = 1, ENGINE = '0.7.3-playback.1';
  const copy = value => JSON.parse(JSON.stringify(value));
  const instantCues = new Set(['actionStart', 'powerStart', 'powerEnd', 'hitsStart', 'hitStart', 'spellResult', 'healingMotion']);
  // Only presentation uses this clock. Rule results and RNG stay authoritative.
  function createPresentationClock({ now = () => Date.now(), leadMs = 120,
    setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
    let stopped = false, instantTail = Promise.resolve();
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
    async function renderVisual(cue, render) {
      let deadline = null;
      const timeout = { timedOut: true };
      try {
        const outcome = await Promise.race([
          Promise.resolve(render()),
          new Promise(resolve => { deadline = setTimer(() => resolve(timeout), 8000); }),
        ]);
        if (outcome === timeout) global.console?.warn?.('[Combat visual timeout]', cue);
      } finally {
        if (deadline !== null) clearTimer(deadline);
      }
    }
    return Object.freeze({
      stamp() { return { schemaVersion: 1, playAt: now() + leadMs }; },
      wait,
      run(cue, timing, render) {
        const previous = instantTail;
        const task = (async () => {
          if (!(await wait(timing.playAt))) return;
          await previous;
          if (!stopped) await renderVisual(cue, render);
        })().catch(error => {
          // A broken sprite/HUD must never poison the authority's presentation clock.
          global.console?.warn?.('[Combat visual]', cue, error);
        });
        pending.add(task);
        task.then(() => pending.delete(task));
        // DOM preparation has no hold. Queue it at the same server time as the
        // next animated cue, without charging a network buffer for each label.
        if (instantCues.has(cue)) { instantTail = task; return Promise.resolve(); }
        return task;
      },
      async drain() { await Promise.all([...pending]); },
      stop() { stopped = true; for (const [id, resolve] of timers) { clearTimer(id); resolve(); } timers.clear(); },
    });
  }
  function createConsumer({ generation, checkpoint, apply, present, finish, onEvent = () => {}, onError = () => {}, onVisualError = () => {}, beforeEvents = async () => {}, visualTimeoutMs = 7000, batchGapTimeoutMs = 3000 }) {
    let cursor = Number(checkpoint?.seq) || 0, eventCursor = Number(checkpoint?.eventCursor) || 0;
    let chain = Promise.resolve(), stopped = false;
    const pending = new Map(), seen = new Map();
    let gapTimer = null;
    function trackBatchGap() {
      const gap = !pending.has(cursor + 1) && [...pending.keys()].some(seq => seq > cursor + 1);
      if (!gap) {
        if (gapTimer !== null) global.clearTimeout?.(gapTimer);
        gapTimer = null;
        return;
      }
      if (gapTimer !== null || typeof global.setTimeout !== 'function') return;
      // Out-of-order delivery is tolerated briefly. A truly missing batch must
      // force canonical checkpoint recovery instead of silently freezing forever.
      gapTimer = global.setTimeout(() => {
        gapTimer = null;
        if (!stopped && !pending.has(cursor + 1) && [...pending.keys()].some(seq => seq > cursor + 1)) {
          stopped = true;
          onError(new Error('PLAYBACK_BATCH_GAP'));
        }
      }, batchGapTimeoutMs);
    }
    function visualError(error) {
      try { onVisualError(error); } catch (_) {}
    }
    async function awaitVisual(callback, label) {
      let deadline = null;
      const timeout = { timedOut: true };
      try {
        const operation = Promise.resolve(callback());
        if (typeof global.setTimeout !== 'function') return await operation;
        const outcome = await Promise.race([
          operation,
          new Promise(resolve => { deadline = global.setTimeout(() => resolve(timeout), visualTimeoutMs); }),
        ]);
        if (outcome === timeout) visualError(new Error('PLAYBACK_VISUAL_TIMEOUT:' + label));
      } catch (error) {
        visualError(error);
      } finally {
        if (deadline !== null) global.clearTimeout?.(deadline);
      }
    }
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
          await awaitVisual(() => beforeEvents(group, row, events.slice(index)), 'schedule');
          if (stopped) return;
          const presentations=[];
          for(const event of group){
            if (event.sequence !== eventCursor + 1) throw new Error('PLAYBACK_EVENT_GAP');
            if (event.combatants) apply(copy(event.combatants));
            else if(event.changes?.length) apply(Object.fromEntries(event.changes.filter(change=>change.after).map(change=>[change.unitId,copy(change.after)])));
            // Journal notifications are presentation-only; canonical snapshots
            // and strict sequence validation must not depend on a HUD callback.
            try { await onEvent(copy(event)); } catch (error) { visualError(error); }
            if(stopped)return;
            if (event.type === 'Presentation')
              presentations.push(awaitVisual(() => present(event.cue, copy(event.args || []), row, event), event.cue));
            eventCursor = event.sequence;
          }
          await Promise.all(presentations);
        }
        if(stopped)return;
        if (Number(row.eventCursor) !== eventCursor) throw new Error('PLAYBACK_CHECKPOINT_CURSOR');
        if(row.combatants) apply(copy(row.combatants));
        pending.delete(row.seq); cursor = row.seq;
        trackBatchGap();
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
        trackBatchGap();
        chain = chain.then(drain).catch(error => { stopped = true; onError(error); });
        return chain;
      },
      cursor: () => cursor, eventCursor: () => eventCursor, idle: () => chain,
      stop() { stopped = true; if (gapTimer !== null) global.clearTimeout?.(gapTimer); gapTimer = null; pending.clear(); seen.clear(); },
    });
  }
  global.LuminousCombatPlayback = Object.freeze({ schemaVersion: SCHEMA, engineVersion: ENGINE, timelineVersion: 1,
    createConsumer, createPresentationClock, isInstantCue: cue => instantCues.has(cue) });
})(typeof window === 'undefined' ? globalThis : window);
