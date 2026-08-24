(function (global) {
  "use strict";

  const ROOT = "campaña/efectos_dm";
  const PANEL_ID = "dm-managed-effects-panel";
  const state = { db: null, effects: {}, timer: null };

  function remainingMs(effect, now = Date.now()) {
    return Math.max(0, Number(effect?.expiresAt || 0) - Number(now || 0));
  }

  function isActive(effect, now = Date.now()) {
    return Boolean(effect && effect.active !== false && remainingMs(effect, now) > 0);
  }

  function formatRemaining(effect, now = Date.now()) {
    const totalMinutes = Math.ceil(remainingMs(effect, now) / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  function ensurePanel() {
    const doc = global.document;
    if (!doc?.body) return null;
    let panel = doc.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = doc.createElement("section");
    panel.id = PANEL_ID;
    panel.setAttribute("aria-label", "Efectos activos administrados por DM");
    panel.style.cssText = "margin:10px 0;padding:10px;border:1px solid #a37c35;background:#080b10;color:#ddd;font-family:'Share Tech Mono',monospace;";
    (doc.getElementById("theatre-director-panel") || doc.body).prepend(panel);
    return panel;
  }

  function updateEffect(id, patch) {
    if (!state.db || !id) return Promise.resolve(false);
    return state.db.ref(`${ROOT}/${id}`).update(patch).then(() => true);
  }

  function appendTextLine(parent, text, style = "") {
    const line = global.document.createElement("div");
    if (style) line.style.cssText = style;
    line.textContent = String(text ?? "");
    parent.appendChild(line);
    return line;
  }

  function render() {
    const panel = ensurePanel();
    if (!panel) return;
    const now = Date.now();
    const active = Object.values(state.effects || {}).filter((effect) => isActive(effect, now));
    panel.replaceChildren();
    const heading = global.document.createElement("h4");
    heading.style.cssText = "margin:0 0 8px;color:#d4ad58;";
    heading.textContent = `EFECTOS ACTIVOS PARA DM (${active.length})`;
    panel.appendChild(heading);
    if (!active.length) {
      appendTextLine(panel, "Sin efectos temporales activos.", "opacity:.65;");
      return;
    }
    active.sort((a, b) => Number(a.expiresAt || 0) - Number(b.expiresAt || 0));
    active.forEach((effect) => {
      const card = global.document.createElement("div");
      card.style.cssText = "border-top:1px solid #29313a;padding:8px 0;";
      const modifier = Number(effect.modifier?.value || 0) || 0;
      const isRequest = String(effect.kind || "").toLowerCase() === "request";
      appendTextLine(card, effect.name || effect.effectId || "Effect", "color:#fff;font-weight:700;");
      appendTextLine(card, `${effect.subjectName || effect.subjectPlayerId || "Player"} → ${effect.targetName || effect.targetId || "Target"}`);
      appendTextLine(card, `Tiempo restante: ${formatRemaining(effect, now)}`, "color:#e6c56c;");
      appendTextLine(card, effect.note || "", "font-size:11px;opacity:.8;margin-top:4px;");
      if (!isRequest) appendTextLine(card, `CHA Check · bono configurado: +${modifier} Check Power`, "font-size:11px;margin-top:4px;");
      const controls = global.document.createElement("div");
      controls.style.cssText = "display:flex;gap:6px;margin-top:6px;";
      const apply = global.document.createElement("button");
      apply.type = "button";
      if (isRequest) {
        apply.textContent = effect.response ? "RESPONDIDO" : "RESPONDER";
        apply.disabled = Boolean(effect.response);
        apply.onclick = () => {
          const response = global.prompt?.(effect.prompt || "Describe el resultado para el jugador:", effect.response || "");
          if (response == null || !String(response).trim()) return;
          updateEffect(effect.id, { response: String(response).trim(), respondedAt: Date.now(), active: false });
        };
      } else {
        apply.textContent = effect.approved ? "BONO LISTO" : "APLICAR AL PRÓXIMO CHA CHECK";
        apply.disabled = Boolean(effect.approved);
        apply.onclick = () => updateEffect(effect.id, { approved: true, approvedAt: Date.now() });
      }
      const disable = global.document.createElement("button");
      disable.type = "button";
      disable.textContent = "DESACTIVAR";
      disable.onclick = () => updateEffect(effect.id, { active: false, disabledAt: Date.now() });
      controls.append(apply, disable);
      card.appendChild(controls);
      panel.appendChild(card);
    });
  }

  function init({ db } = {}) {
    if (state.db) return true;
    state.db = db || (global.firebase?.database && global.firebase.apps?.length ? global.firebase.database() : null);
    if (!state.db) return false;
    state.db.ref(ROOT).on("value", (snapshot) => {
      state.effects = snapshot.val() || {};
      render();
    });
    state.timer = global.setInterval?.(render, 30000) || null;
    render();
    return true;
  }

  const api = Object.freeze({ ROOT, remainingMs, isActive, formatRemaining, init, render });
  global.LuminousDmManagedEffects = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (global.document) {
    const boot = () => init();
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
