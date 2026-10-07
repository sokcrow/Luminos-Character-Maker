(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerHudNavigation) return;

  function syncHudModalState(value) {
    doc.querySelectorAll(".sheet-state-hud-modal").forEach((input) => {
      const next = value || "";
      input.value = next;
      input.setAttribute("value", next);
    });
  }

  function closeHudModals() {
    doc.querySelectorAll(".hud-modal").forEach((modal) => {
      modal.classList.remove("active");
      modal.style.removeProperty("display");
      modal.setAttribute("aria-hidden", "true");
    });
    syncHudModalState("");
  }

  function openHudModal(modalName) {
    const target =
      doc.getElementById(`${modalName}-modal`) ||
      doc.getElementById(`modal-${modalName}`) ||
      doc.querySelector(`.modal-${modalName}`);

    if (!target) return false;

    closeHudModals();
    syncHudModalState(modalName);
    target.classList.add("active");
    target.style.display = "flex";
    target.setAttribute("aria-hidden", "false");

    const rail = doc.querySelector(".hud-sidebar-right");
    rail?.classList.remove("is-open");
    doc.getElementById("btn-toggle-hud-menu")?.setAttribute("aria-expanded", "false");
    return true;
  }

  function onClick(event) {
    const button = event.target?.closest?.("button[name]");
    if (!button) return;

    const action = button.getAttribute("name") || "";
    if (!action.startsWith("act_hud_")) return;

    event.preventDefault();
    event.stopPropagation();

    if (action === "act_hud_close") {
      closeHudModals();
      return;
    }

    openHudModal(action.replace("act_hud_", ""));
  }

  doc.addEventListener("click", onClick, true);

  global.LuminousPlayerHudNavigation = Object.freeze({
    version: 1,
    open: openHudModal,
    closeAll: closeHudModals,
  });
})(window);
