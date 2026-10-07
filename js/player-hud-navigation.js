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

  const touchBridgeState = {
    button: null,
    at: 0,
  };

  function isTouchBridgeTarget(button) {
    if (!button) return false;
    if (button.id === "btn-toggle-phone" || button.id === "btn-abrir-escritura") return false;
    return Boolean(
      button.matches(
        "#btn-toggle-hud-menu, #btn-toggle-hud, #btn-global-inventory, #btn-toggle-theatre-log-player, #btn-toggle-theatre-self-actor, button[name^='act_hud_']",
      ),
    );
  }

  function onPointerUp(event) {
    if (event.pointerType !== "touch") return;

    const button = event.target?.closest?.(".hud-sidebar-right button");
    if (!isTouchBridgeTarget(button)) return;

    event.preventDefault();
    event.stopPropagation();

    touchBridgeState.button = button;
    touchBridgeState.at = global.performance?.now?.() || Date.now();

    // Fire the same click path used on desktop while we are still inside the
    // trusted touch gesture task. Existing menu/inventory/HUD listeners keep
    // ownership of their behavior.
    button.click();
  }

  function suppressDuplicateNativeClick(event) {
    const button = event.target?.closest?.(".hud-sidebar-right button");
    if (!button || touchBridgeState.button !== button) return;

    const now = global.performance?.now?.() || Date.now();
    if (event.detail !== 0 && now - touchBridgeState.at < 900) {
      event.preventDefault();
      event.stopImmediatePropagation();
      touchBridgeState.button = null;
      touchBridgeState.at = 0;
    }
  }

  doc.addEventListener("pointerup", onPointerUp, true);
  doc.addEventListener("click", suppressDuplicateNativeClick, true);
  doc.addEventListener("click", onClick, true);

  global.LuminousPlayerHudNavigation = Object.freeze({
    version: 2,
    open: openHudModal,
    closeAll: closeHudModals,
  });
})(window);
