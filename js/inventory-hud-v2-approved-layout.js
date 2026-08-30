(function (global) {
  "use strict";

  if (global.LuminousInventoryApprovedLayout) return;
  const doc = global.document;
  if (!doc) return;

  const AUGMENT_SLOTS = [
    {
      id: "augment0",
      label: "AUGMENT / BODY",
      hint: "BODY INSTALL",
      className: "inv2-eq-augment-body",
    },
    {
      id: "augment1",
      label: "AUGMENT / NEURAL",
      hint: "NEURAL INSTALL",
      className: "inv2-eq-augment-neural",
    },
  ];

  function createSlot(spec) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `inventory-v2-eq-slot ${spec.className}`;
    button.dataset.equipmentSlot = spec.id;
    button.setAttribute("aria-label", spec.label);
    button.innerHTML = `
      <span class="inventory-v2-eq-label">${spec.label}</span>
      <span class="inventory-v2-eq-name">EMPTY</span>
      <span class="inventory-v2-eq-hint">${spec.hint}</span>
    `;
    return button;
  }

  function retireLegacyEquipment() {
    const legacy = doc.getElementById("equipment-panel");
    if (!legacy) return;
    legacy.classList.add("inventory-v2-legacy-retired");
    legacy.setAttribute("aria-hidden", "true");
  }

  function apply() {
    retireLegacyEquipment();

    const equipment = doc.querySelector(".inventory-v2-equipment");
    const field = equipment?.querySelector(".inventory-v2-equipment-field");
    if (!equipment || !field) return false;

    equipment.classList.add("inventory-v2-approved-layout");

    // Shield is not a separate approved slot. Shields occupy Off Hand.
    field.querySelector('[data-equipment-slot="shield"]')?.remove();

    // The approved design exposes real augment slots instead of a text summary.
    field.querySelector("#inventory-v2-augment-summary")?.remove();
    AUGMENT_SLOTS.forEach((spec) => {
      if (!field.querySelector(`[data-equipment-slot="${spec.id}"]`)) {
        field.appendChild(createSlot(spec));
      }
    });

    const offHand = field.querySelector('[data-equipment-slot="offHand"]');
    if (offHand) {
      const hint = offHand.querySelector(".inventory-v2-eq-hint");
      if (!offHand.classList.contains("is-filled") && hint) hint.textContent = "WEAPON / SHIELD";
    }

    global.LuminousInventoryHudV2?.renderEquipment?.();
    return true;
  }

  function boot() {
    if (apply()) return;
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (apply() || attempts >= 80) global.clearInterval(timer);
    }, 100);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousInventoryApprovedLayout = Object.freeze({
    version: 1,
    apply,
    retireLegacyEquipment,
  });
})(typeof window !== "undefined" ? window : globalThis);
