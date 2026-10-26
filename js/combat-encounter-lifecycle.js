(function (global) {
  "use strict";

  const VERSION = "1.2.0";
  const STATE_PATH = "campaña/combate/estado";
  const RESULT_IMAGES = Object.freeze({
    victory: "Assets/Images/Combat/Victory_Battle_Result.png",
    defeat: "Assets/Images/Combat/Defeat_Battle_Result.png",
  });
  const STYLE_ID = "combat-encounter-lifecycle-style";
  const OVERLAY_ID = "combat-encounter-result-overlay";

  const runtime = {
    db: null,
    ref: null,
    bound: false,
    listener: null,
    lastState: null,
  };

  function normalizeResult(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (["victory", "win", "won"].includes(normalized)) return "victory";
    if (["defeat", "lose", "loss", "lost"].includes(normalized)) return "defeat";
    if (["cancelled", "canceled", "cancel", "aborted", "abort"].includes(normalized)) return "cancelled";
    return "";
  }

  function isEncounterEnded(state = {}) {
    return String(state?.phase || "").trim().toUpperCase() === "ENDED" || state?.active === false;
  }

  function ensureStyle() {
    const doc = global.document;
    if (!doc?.head || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* The Encounter result is a transparent seal over the LAST battlefield frame.
   Never obscure the sprites/arena with a fullscreen black interstitial. */
#${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483000;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,transparent 34%,rgba(0,0,0,.22) 100%);pointer-events:none;opacity:0;transition:opacity .18s ease}
#${OVERLAY_ID}.active{display:flex;opacity:1}
#${OVERLAY_ID}.blackout{display:flex;opacity:1;background:transparent}
#${OVERLAY_ID} .combat-result-frame{display:grid;place-items:center;max-width:100%;max-height:100%;opacity:1;transform:scale(1);transition:opacity .42s ease,transform .42s ease}
#${OVERLAY_ID}.blackout .combat-result-frame{opacity:1;transform:none}
#${OVERLAY_ID} img{display:block;max-width:min(94vw,1100px);max-height:70vh;object-fit:contain;mix-blend-mode:screen;filter:drop-shadow(0 6px 26px rgba(0,0,0,.65))}
#${OVERLAY_ID} .combat-result-fallback{position:absolute;font:700 clamp(42px,9vw,120px)/1 var(--font-limbus,'Bebas Neue',Impact,sans-serif);letter-spacing:.08em;color:#ead7b2;text-shadow:0 6px 18px #000;text-transform:uppercase}
#${OVERLAY_ID} img:not([src=""]) + .combat-result-fallback{opacity:.15}
#${OVERLAY_ID} .combat-result-xp{font:700 clamp(15px,2.5vw,24px)/1.4 var(--font-limbus,Arial,sans-serif);letter-spacing:.04em;color:#f6df9e;text-align:center;text-shadow:0 3px 12px #000;max-width:96vw;padding:2px 12px}
#${OVERLAY_ID} .combat-result-xp:empty{display:none}
@media(max-width:600px){#${OVERLAY_ID} img{max-width:98vw;max-height:56vh}}
`;
    doc.head.appendChild(style);
  }

  function ensureOverlay() {
    const doc = global.document;
    if (!doc?.body) return null;
    ensureStyle();
    let overlay = doc.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = doc.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = '<div class="combat-result-frame"><img alt=""><div class="combat-result-fallback"></div><div class="combat-result-xp" role="status"></div></div>';
    doc.body.appendChild(overlay);
    return overlay;
  }

  function showResult(result, state = {}) {
    const normalized = normalizeResult(result);
    if (!normalized) return false;
    const overlay = ensureOverlay();
    if (!overlay) return false;
    const image = overlay.querySelector("img");
    const fallback = overlay.querySelector(".combat-result-fallback");
    if (image) {
      const source = RESULT_IMAGES[normalized] || "";
      image.src = source;
      image.alt = normalized === "victory" ? "Victory" : normalized === "defeat" ? "Defeat" : "";
      image.style.display = source ? "block" : "none";
    }
    if (fallback) {
      fallback.textContent = normalized === "victory"
        ? "VICTORY"
        : normalized === "defeat"
          ? "DEFEAT"
          : "ENCOUNTER CANCELADO";
    }
    const xpLabel = overlay.querySelector(".combat-result-xp");
    if (xpLabel) {
      const award = state?.xpAward;
      xpLabel.textContent = normalized === "victory" && award && Number.isFinite(Number(award.totalXp))
        ? `XP TOTAL ${Number(award.totalXp).toLocaleString()} · ${Number(award.participantCount) || 0} PARTICIPANTES · +${Number(award.xpPerParticipant) || 0} XP C/U`
        : "";
    }
    overlay.dataset.result = normalized;
    overlay.dataset.endedAt = String(state?.endedAt || "");
    overlay.classList.remove("blackout");
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
    return true;
  }

  function beginBlackout() {
    const overlay = ensureOverlay();
    if (!overlay) return false;
    overlay.classList.add("active", "blackout");
    overlay.setAttribute("aria-hidden", "false");
    return true;
  }

  function hideResult() {
    const overlay = global.document?.getElementById?.(OVERLAY_ID);
    if (!overlay) return false;
    overlay.classList.remove("active", "blackout");
    overlay.setAttribute("aria-hidden", "true");
    return true;
  }

  function applyState(nextState = {}) {
    runtime.lastState = nextState && typeof nextState === "object" ? nextState : {};
    const result = normalizeResult(runtime.lastState.result || runtime.lastState.outcome);
    const transition = String(runtime.lastState.transition || "").trim().toLowerCase();
    if (isEncounterEnded(runtime.lastState) && result) {
      showResult(result, runtime.lastState);
      // Legacy blackout flags may persist in older encounters. Present the seal
      // over the arena anyway; Theatre switching is owned by the P0 lifecycle.
    } else {
      hideResult();
    }
    return { ended: isEncounterEnded(runtime.lastState), result, transition };
  }

  function bind(options = {}) {
    if (runtime.bound) return true;
    runtime.db = options.db || runtime.db || (global.firebase?.database ? global.firebase.database() : null);
    if (!runtime.db?.ref) return false;
    runtime.ref = runtime.db.ref(options.statePath || STATE_PATH);
    runtime.listener = (snapshot) => applyState(snapshot?.val?.() || {});
    runtime.ref.on("value", runtime.listener);
    runtime.bound = true;
    return true;
  }

  function unbind() {
    if (runtime.ref?.off && runtime.listener) runtime.ref.off("value", runtime.listener);
    runtime.ref = null;
    runtime.listener = null;
    runtime.bound = false;
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    STATE_PATH,
    RESULT_IMAGES,
    normalizeResult,
    isEncounterEnded,
    ensureOverlay,
    showResult,
    beginBlackout,
    hideResult,
    applyState,
    bind,
    unbind,
    _runtime: runtime,
  });

  global.LuminousCombatEncounterLifecycle = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;

  if (global.document) {
    const boot = () => {
      const auth = global.firebase?.auth?.();
      if (!auth?.onAuthStateChanged) {
        bind();
        return;
      }
      auth.onAuthStateChanged((user) => {
        if (user) bind();
      }, (error) => {
        global.console?.error?.("[Combat Encounter Lifecycle] Auth restoration failed:", error);
      });
    };
    if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", boot, { once: true });
    else boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
