/* Paint the Stats panel when it is visible. Character/rules updates stay live. */
(function (global) {
  'use strict';
  if (global.LuminousPlayerStatsPaint || !global.document) return;
  const doc = global.document, pending = new Map();
  let queued = false, modal = null, observer = null;
  function visible() {
    if (!modal || modal.hidden || modal.style.display === 'none') return false;
    return modal.classList.contains('active') || modal.style.display === 'flex' ||
      modal.style.display === 'block' || Boolean(doc.querySelector('input.sheet-state-hud-modal[value="stats"]'));
  }
  function flush() {
    queued = false;
    if (!visible()) return;
    const work = [...pending.values()];
    pending.clear();
    for (const paint of work) {
      try { paint(); } catch (error) { global.console?.error?.('[Stats paint]', error); }
    }
  }
  function schedule() {
    if (queued) return;
    queued = true;
    global.queueMicrotask(flush);
  }
  function mount() {
    const next = doc.getElementById('stats-modal');
    if (next === modal) return;
    observer?.disconnect(); modal = next;
    if (modal && typeof global.MutationObserver === 'function') {
      observer = new global.MutationObserver(schedule);
      observer.observe(modal, { attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'] });
    }
  }
  function request(key, paint) {
    mount(); pending.set(key, paint); schedule();
  }
  function reopen() { mount(); schedule(); }
  doc.addEventListener('change', event => {
    if (event.target?.matches?.('.sheet-state-hud-modal')) reopen();
  });
  global.addEventListener('luminous:player-instance-changed', reopen);
  global.addEventListener('beforeunload', () => { observer?.disconnect(); pending.clear(); }, { once: true });
  global.LuminousPlayerStatsPaint = Object.freeze({ request });
})(window);
