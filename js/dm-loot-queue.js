(function (global) {
  'use strict';
  if (global.LuminousDmLootQueue) return;
  const ROOT = 'campaña/loot_encounters';
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  function activeQueues(encounters = {}) {
    return Object.entries(encounters).filter(([, row]) => row && row.meta?.open !== false && Object.keys(row.corpses || {}).length)
      .map(([key, row]) => ({ ...clone(row), key }))
      .sort((a, b) => Number(b.meta?.finalizedAt || 0) - Number(a.meta?.finalizedAt || 0));
  }
  function closedQueue(row, { uid, now = Date.now() }) {
    if (!row || typeof row !== 'object') return;
    if (row.meta?.open === false) return row;
    return { ...row, meta: { ...(row.meta || {}), open: false, closedByDm: true, closedBy: uid, closedAt: now } };
  }
  async function closeQueue({ db, key, uid = global.firebase?.auth?.().currentUser?.uid, now }) {
    if (!db?.ref || !uid || !key || /[.#$\[\]\/]/.test(key)) throw Error('No se pudo identificar el botín.');
    const configured = (await db.ref('campaña/config/dm_uid').once('value')).val();
    if (uid !== configured && uid !== 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1') throw Error('Solo el DM puede retirar botín.');
    const ref = db.ref(`${ROOT}/${key}`);
    let hold;
    try {
      await new Promise((resolve, reject) => { hold = () => resolve(); ref.on('value', hold, reject); });
      const result = await ref.transaction(row => closedQueue(row, { uid, now }), undefined, false);
      if (!result.committed) throw Error('El botín ya no está disponible.');
      return result.snapshot.val();
    } finally { if (hold) ref.off('value', hold); }
  }
  function render(host, encounters, options) {
    const queues = activeQueues(encounters);
    host.replaceChildren();
    if (!queues.length) { host.textContent = 'No hay botines pendientes.'; return; }
    for (const queue of queues) {
      const corpses = Object.values(queue.corpses || {});
      const card = global.document.createElement('div');
      card.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px;border:1px solid #494031;background:#111;margin:8px 0;';
      const title = [...new Set(corpses.map(row => row.name || 'Restos de enemigo'))].join(', ');
      card.innerHTML = `<div style="flex:1;min-width:180px;"><strong>${esc(title)}</strong><div style="color:#aaa;margin-top:4px;">${corpses.length} cuerpo${corpses.length === 1 ? '' : 's'} · ${queue.meta?.finalizedAt ? esc(new Date(queue.meta.finalizedAt).toLocaleString('es-MX')) : 'Encuentro anterior'}</div></div>`;
      const button = global.document.createElement('button');
      button.type = 'button'; button.className = 'btn-cyber'; button.textContent = 'Retirar botín';
      button.style.cssText = 'min-height:44px;padding:10px 16px;background:#351915;color:#f6d6bd;border:1px solid #9f634b;font:inherit;font-weight:700;cursor:pointer;';
      button.setAttribute('aria-label', `Retirar botín de ${title}`);
      button.addEventListener('click', async () => {
        if (!global.confirm(`¿Retirar este botín pendiente (${title})?\n\nSe cerrará para nuevas reclamaciones. Los objetos y el dinero ya entregados se conservan.`)) return;
        button.disabled = true;
        try { await closeQueue({ ...options, key: queue.key }); }
        catch (error) { button.disabled = false; global.alert(String(error.code || '').toLowerCase().includes('permission') ? 'Tu cuenta no tiene permiso para retirar este botín.' : error.message || 'No se pudo retirar el botín.'); }
      });
      card.appendChild(button); host.appendChild(card);
    }
  }
  function boot() {
    const host = global.document?.getElementById('dm-loot-queues');
    if (!host || !global.firebase?.auth || host.dataset.bound) return;
    host.dataset.bound = 'true';
    let unsubscribe;
    global.firebase.auth().onAuthStateChanged(async user => {
      unsubscribe?.(); unsubscribe = null; host.replaceChildren();
      if (!user) return;
      const db = global.firebase.database();
      try {
        const configured = (await db.ref('campaña/config/dm_uid').once('value')).val();
        if (user.uid !== configured && user.uid !== 'e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1') return;
        const ref = db.ref(ROOT), handler = snap => render(host, snap.val() || {}, { db, uid: user.uid });
        ref.on('value', handler, () => { host.textContent = 'No se pudieron cargar los botines pendientes.'; });
        unsubscribe = () => ref.off('value', handler);
      } catch (_) { host.textContent = 'No se pudieron cargar los botines pendientes.'; }
    });
    global.addEventListener?.('beforeunload', () => unsubscribe?.(), { once: true });
  }
  global.LuminousDmLootQueue = Object.freeze({ activeQueues, closedQueue, closeQueue, render, boot });
  if (global.document?.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
