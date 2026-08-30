(function (global) {
  "use strict";

  if (global.LuminousInventoryApprovedLayout) return;
  const doc = global.document;
  if (!doc) return;

  const augmentSlots = [
    { id: "augment0", label: "AUGMENT / BODY", hint: "INSTALLED", className: "inv2-eq-augment-a" },
    { id: "augment1", label: "AUGMENT / NEURAL", hint: "INSTALLED", className: "inv2-eq-augment-b" },
  ];

  function suppressLegacyEquipment() {
    const modal = doc.getElementById("inventory-modal");
    if (!modal) return 0;

    let hidden = 0;
    modal.querySelectorAll("#equipment-panel").forEach((panel) => {
      panel.classList.add("inventory-v2-legacy-equipment");
      panel.setAttribute("aria-hidden", "true");
      try { panel.inert = true; } catch (_) {}
      hidden += 1;
    });

    modal.querySelectorAll(".cyber-panel").forEach((panel) => {
      const title = String(panel.querySelector(".cyber-panel-title")?.textContent || "").trim();
      if (!/EQUIPAMIENTO\s+TÁCTICO/i.test(title)) return;
      panel.classList.add("inventory-v2-legacy-equipment");
      panel.setAttribute("aria-hidden", "true");
      try { panel.inert = true; } catch (_) {}
      hidden += 1;
    });

    return hidden;
  }

  function createEquipmentSlot(spec) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `inventory-v2-eq-slot ${spec.className}`;
    button.dataset.equipmentSlot = spec.id;
    button.setAttribute("aria-label", spec.label);
    button.innerHTML = `<span class="inventory-v2-eq-label">${spec.label}</span><span class="inventory-v2-eq-name">EMPTY</span><span class="inventory-v2-eq-hint">${spec.hint}</span>`;
    return button;
  }

  function patchApprovedEquipmentField() {
    const field = doc.querySelector(".inventory-v2-equipment-field");
    if (!field) return false;

    /* Shield is represented by Off Hand. Showing both duplicated the same equipped shield. */
    field.querySelector('[data-equipment-slot="shield"]')?.remove();
    field.querySelector("#inventory-v2-augment-summary")?.remove();

    augmentSlots.forEach((spec) => {
      if (field.querySelector(`[data-equipment-slot="${spec.id}"]`)) return;
      field.appendChild(createEquipmentSlot(spec));
    });

    doc.getElementById("inventory-modal")?.classList.add("inventory-v2-approved-layout");
    global.LuminousInventoryHudV2?.renderEquipment?.();
    return true;
  }

  function patch() {
    suppressLegacyEquipment();
    return patchApprovedEquipmentField();
  }

  function boot() {
    patch();

    /* The modal is static, but the V2 shell is mounted at DOM ready. Retry briefly if load order shifts. */
    if (!doc.querySelector(".inventory-v2-equipment-field")) {
      let attempts = 0;
      const timer = global.setInterval(() => {
        attempts += 1;
        if (patch() || attempts >= 40) global.clearInterval(timer);
      }, 100);
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousInventoryApprovedLayout = Object.freeze({
    version: 1,
    patch,
    suppressLegacyEquipment,
    patchApprovedEquipmentField,
  });
})(typeof window !== "undefined" ? window : globalThis);
