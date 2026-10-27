/* Player-facing acknowledgement of a target accepted by the real Combat planner.
   This module is presentation-only: it never assigns targets or writes Firebase. */
(function (global) {
  'use strict';
  const EVENT = 'luminous:combat073-target-selected';
  const ID = 'combat-target-feedback';
  const VISIBLE_MS = 2600;
  let hideTimer = null;

  function ensureBanner() {
    const doc = global.document;
    if (!doc?.body) return null;
    let banner = doc.getElementById(ID);
    if (banner) return banner;
    banner = doc.createElement('aside');
    banner.id = ID;
    banner.className = 'combat-target-feedback';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-atomic', 'true');
    banner.innerHTML = `
      <div class="combat-target-feedback__portrait" aria-hidden="true">
        <img class="combat-target-feedback__sprite" alt="" hidden>
      </div>
      <div class="combat-target-feedback__copy">
        <span class="combat-target-feedback__eyebrow">OBJETIVO FIJADO</span>
        <strong class="combat-target-feedback__title"></strong>
        <span class="combat-target-feedback__name"></span>
        <span class="combat-target-feedback__detail"></span>
      </div>
      <span class="combat-target-feedback__check" aria-hidden="true">✓</span>`;
    doc.body.appendChild(banner);
    return banner;
  }

  function showTargetFeedback(event) {
    const detail = event?.detail;
    const doc = global.document;
    const host = doc?.getElementById('game-container');
    // The DM's observation display and an executing round are not a player's
    // targeting confirmation. Ignore events without an accepted plan slot.
    if (!detail || typeof detail.enemy !== 'boolean' || !Number.isInteger(detail.slotIndex)
        || detail.slotIndex < 0 || host?.dataset?.viewerRole === 'dm'
        || host?.classList?.contains('round-running')) return;
    const banner = ensureBanner();
    if (!banner) return;
    const title = banner.querySelector('.combat-target-feedback__title');
    const name = banner.querySelector('.combat-target-feedback__name');
    const extra = banner.querySelector('.combat-target-feedback__detail');
    const portrait = banner.querySelector('.combat-target-feedback__sprite');
    const unitName = String(detail.targetName || 'Objetivo');
    title.textContent = detail.enemy ? 'ENEMIGO SELECCIONADO' : 'ALIADO SELECCIONADO';
    name.textContent = unitName;
    extra.textContent = detail.clashPending
      ? 'Objetivo elegido · Confirma el Clash'
      : `${String(detail.actionName || 'Acción')} · Slot ${detail.slotIndex + 1}`;
    banner.classList.toggle('is-ally', !detail.enemy);

    // The portrait comes exclusively from the combatant already rendered in
    // the canonical battlefield, not a fabricated/sample enemy illustration.
    const unitId = String(detail.targetId || '');
    const sprite = unitId ? doc.getElementById(`sprite-${unitId}`) : null;
    const spriteSrc = sprite?.currentSrc || sprite?.getAttribute?.('src') || '';
    if (spriteSrc) {
      portrait.src = spriteSrc;
      portrait.hidden = false;
    } else {
      portrait.removeAttribute('src');
      portrait.hidden = true;
    }

    if (hideTimer !== null) global.clearTimeout(hideTimer);
    banner.classList.remove('is-visible');
    // Restart the animation when a different valid target is confirmed.
    void banner.offsetWidth;
    banner.classList.add('is-visible');
    hideTimer = global.setTimeout(() => {
      banner.classList.remove('is-visible');
      hideTimer = null;
    }, VISIBLE_MS);
  }

  global.addEventListener(EVENT, showTargetFeedback);
})(window);
