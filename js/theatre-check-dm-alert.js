(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc?.body?.classList?.contains("on-game-dashboard")) return;
  if (global.LuminousTheatreCheckDmAlert) return;

  let observer = null;
  let hadPending = false;

  function ensureAlert() {
    const badge = doc.getElementById("theatre-check-request-badge");
    const front = doc.getElementById("theatre-check-front-layer");
    if (!badge || !front) return false;
    if (observer) return true;

    hadPending = badge.classList.contains("is-visible");
    observer = new MutationObserver(() => {
      const hasPending = badge.classList.contains("is-visible");
      if (hasPending && !hadPending && !front.querySelector(".theatre-check-dm-toast")) {
        const toast = doc.createElement("div");
        toast.className = "theatre-check-dm-toast";
        const title = doc.createElement("strong");
        title.textContent = "SOLICITUD DE CHECK";
        const copy = doc.createElement("span");
        copy.textContent = "Nueva solicitud pendiente · abre CHECK DIRECTOR";
        toast.append(title, copy);
        front.appendChild(toast);
        global.setTimeout(() => toast.remove(), 4200);
      }
      hadPending = hasPending;
    });
    observer.observe(badge, { attributes: true, attributeFilter: ["class"], childList: true, characterData: true, subtree: true });
    return true;
  }

  let attempts = 0;
  const timer = global.setInterval(() => {
    attempts += 1;
    if (ensureAlert() || attempts > 150) global.clearInterval(timer);
  }, 100);
  ensureAlert();

  global.LuminousTheatreCheckDmAlert = Object.freeze({
    ensure: ensureAlert,
  });
})(window);
