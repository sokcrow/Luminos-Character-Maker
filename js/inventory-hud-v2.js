(function (global) {
  "use strict";

  if (global.LuminousInventoryHudV2) return;

  const doc = global.document;
  if (!doc) return;

  const state = {
    playerId: null,
    db: null,
    unit: {},
    peer: null,
    stashUnlocked: false,
    selected: null,
    selectedContainer: "active",
    ready: false,
  };

  const qualityNames = { 1: "LOW", 2: "STANDARD", 3: "GOOD", 4: "FINE", 5: "EXCEPTIONAL" };
  const romanTiers = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const slotSpecs = [
    { id: "mainHand", label: "MAIN HAND", hint: "WEAPON", className: "inv2-eq-main" },
    { id: "offHand", label: "OFF HAND", hint: "WEAPON / SHIELD", className: "inv2-eq-off" },
    { id: "armor", label: "ARMOR", hint: "BODY", className: "inv2-eq-armor" },
    { id: "shield", label: "SHIELD", hint: "DEFENSE", className: "inv2-eq-shield" },
    { id: "accessory0", label: "ACCESSORY A", hint: "ACCESSORY", className: "inv2-eq-acc-a" },
    { id: "accessory1", label: "ACCESSORY B", hint: "ACCESSORY", className: "inv2-eq-acc-b" },
  ];

  const runtime = () => global.LuminousItemRuntime || global.LuminousItemInventoryRuntime || null;
  const inventory = () => global.LuminousItemInventoryRuntime || runtime();
  const bridge = () => global.LuminousItemEquipmentBridge || null;
  const persistence = () => global.LuminousItemPersistenceRuntime || null;
  const realtime = () => global.LuminousItemRealtimeSync || null;
  const workshop = () => global.LuminousWorkshopRuntime || null;

  function resolveDb() {
    try { if (typeof db !== "undefined" && db?.ref) return db; } catch (_) {}
    try { if (global.firebase?.database) return global.firebase.database(); } catch (_) {}
    return null;
  }

  function resolvePlayerId() {
    try { if (typeof playerId !== "undefined" && playerId) return String(playerId); } catch (_) {}
    try {
      const stored = global.localStorage?.getItem("playerId");
      if (stored) return String(stored);
    } catch (_) {}
    return null;
  }

  function entries(container) {
    return Object.entries(container && typeof container === "object" ? container : {});
  }

  function itemId(item = {}) {
    return String(
      item.instanceId || item.instance_id || runtime()?.itemId?.(item) || item.key || item.definitionId || item.id || "",
    ).trim();
  }

  function itemName(item = {}) {
    const explicit = item.displayName || item.nombre || item.name;
    if (explicit) return String(explicit).trim();
    const resolved = runtime()?.resolveItem?.(item) || item;
    return String(resolved?.displayName || resolved?.nombre || resolved?.name || item.definitionId || item.id || "ITEM").trim();
  }

  function itemCategory(item = {}) {
    return String(runtime()?.categoryOf?.(item) || item.tipo_categoria || item.category || item.itemType || item.type || "item");
  }

  function quantityOf(item = {}) {
    return Math.max(0, Number(runtime()?.quantityOf?.(item) ?? item.quantity ?? item.cantidad ?? 1) || 0);
  }

  function findByKey(container, key) {
    if (!container || !key) return null;
    if (container[key]) return container[key];
    const wanted = String(key);
    for (const [entryKey, item] of entries(container)) {
      if (!item) continue;
      const ids = [entryKey, itemId(item), item.instanceId, item.instance_id, item.key, item.definitionId, item.id]
        .map((value) => String(value ?? ""));
      if (ids.includes(wanted)) return item;
    }
    return null;
  }

  function selectedItem() {
    if (!state.selected) return null;
    if (state.selectedContainer === "equipment") return state.selected.item || null;
    const source = state.selectedContainer === "stash" ? state.unit?.inventario_stash : state.unit?.inventario_activo;
    return findByKey(source, state.selected.key) || state.selected.item || null;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function tierNumber(item = {}) {
    const raw = Number(item.tier ?? item.itemTier ?? item.tier_level ?? 1);
    return Number.isFinite(raw) ? Math.max(1, Math.min(10, Math.trunc(raw))) : 1;
  }

  function tierRoman(item = {}) {
    return romanTiers[tierNumber(item)] || String(item.tier || "I");
  }

  function itemTags(item = {}) {
    const raw = item.tags ?? item.tag ?? item.keywords ?? item.tipo ?? itemCategory(item);
    if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
    if (raw == null) return [];
    return String(raw).split(",").map((entry) => entry.trim()).filter(Boolean);
  }

  function itemIcon(item = {}) {
    const explicit = item.icono || item.icon || item.image || item.img;
    if (explicit) return String(explicit).trim();
    const resolved = runtime()?.resolveItem?.(item) || item;
    return String(resolved.icono || resolved.icon || resolved.image || resolved.img || "").trim();
  }

  function itemDescription(item = {}) {
    const explicit = item.descripcion || item.description || item.desc;
    if (explicit) return String(explicit);
    const resolved = runtime()?.resolveItem?.(item) || item;
    return String(resolved.descripcion || resolved.description || resolved.desc || "Sin descripción.");
  }

  function itemValue(item = {}) {
    const explicit = item.valorBase ?? item.costo ?? item.cost ?? item.price ?? item.precio;
    if (explicit != null) return Number(explicit) || 0;
    const resolved = runtime()?.resolveItem?.(item) || item;
    return Number(resolved.valorBase ?? resolved.costo ?? resolved.cost ?? resolved.price ?? resolved.precio ?? 0) || 0;
  }

  function manufacturerName(item = {}) {
    if (!item.manufacturerId) return "—";
    const ws = workshop()?.getWorkshop?.(item.manufacturerId);
    return String(ws?.workshopName || ws?.name || item.manufacturerName || item.manufacturerId || "—")
      .replace(/\s+Workshop$/i, "");
  }

  function productLineName(item = {}) {
    if (item.productLineName) return String(item.productLineName);
    const lineId = item.productLineId || item.product_line_id;
    if (!lineId) return "—";
    const ws = item.manufacturerId ? workshop()?.getWorkshop?.(item.manufacturerId) : null;
    const line = (ws?.productLines || []).find((entry) =>
      String(entry?.productLineId || entry?.id || "") === String(lineId),
    );
    return String(line?.productLineName || line?.name || lineId);
  }

  function installedModules(item = {}) {
    const raw = item.installedModules || item.installedModuleIds || item.installed_module_ids || [];
    return Array.isArray(raw) ? raw : Object.values(raw || {});
  }

  function ensureActiveLayout() {
    const activePane = doc.getElementById("inv-active");
    const grid = doc.getElementById("inv-active-grid");
    if (!activePane || !grid) return false;
    if (activePane.querySelector(".inventory-v2-active-stack")) return true;

    activePane.querySelector("#equipment-panel")?.remove();

    const stack = doc.createElement("div");
    stack.className = "inventory-v2-active-stack";

    const equipment = doc.createElement("section");
    equipment.className = "inventory-v2-equipment";
    equipment.innerHTML = `
      <header class="inventory-v2-equipment-header">
        <div><span>ANATOMY / EQUIPMENT MAP</span><strong>EQUIPPED LOADOUT</strong></div>
        <div class="inventory-v2-sync" id="inventory-v2-sync-state">SYNC // WAITING</div>
      </header>
      <div class="inventory-v2-equipment-field">
        <div class="inventory-v2-body-silhouette" aria-hidden="true"></div>
        ${slotSpecs.map((slot) => `
          <button type="button" class="inventory-v2-eq-slot ${slot.className}" data-equipment-slot="${slot.id}" aria-label="${slot.label}">
            <span class="inventory-v2-eq-label">${slot.label}</span>
            <span class="inventory-v2-eq-name">EMPTY</span>
            <span class="inventory-v2-eq-hint">${slot.hint}</span>
          </button>`).join("")}
        <div class="inventory-v2-augment-summary" id="inventory-v2-augment-summary">
          <span>AUGMENTS</span><strong>NO INSTALLED AUGMENTS</strong>
        </div>
      </div>`;

    const carry = doc.createElement("section");
    carry.className = "inventory-v2-carry";
    carry.innerHTML = `
      <header class="inventory-v2-carry-header">
        <div><span>FIELD CARRY // QUICK ACCESS</span><strong>ACTIVE INVENTORY</strong></div>
        <b id="inventory-v2-carry-count">00 / 10</b>
      </header>
      <div class="inventory-v2-grid-host"></div>`;
    carry.querySelector(".inventory-v2-grid-host").appendChild(grid);

    stack.appendChild(equipment);
    stack.appendChild(carry);
    activePane.appendChild(stack);

    equipment.addEventListener("click", onEquipmentClick);
    equipment.addEventListener("dragover", onEquipmentDragOver);
    equipment.addEventListener("dragleave", onEquipmentDragLeave);
    equipment.addEventListener("drop", onEquipmentDrop);
    return true;
  }

  function ensureDetailExtensions() {
    const card = doc.getElementById("item-detail-card");
    if (!card) return;
    card.querySelector("#detail-equip-btn-container")?.remove();
    if (card.querySelector(".inventory-v2-detail-extra")) return;

    const extra = doc.createElement("div");
    extra.className = "inventory-v2-detail-extra";
    extra.innerHTML = `
      <div class="inventory-v2-detail-grid">
        <div><span>QUALITY</span><b data-v2-detail="quality">—</b></div>
        <div><span>CONDITION</span><b data-v2-detail="condition">—</b></div>
        <div><span>MANUFACTURER</span><b data-v2-detail="manufacturer">—</b></div>
        <div><span>PRODUCT LINE</span><b data-v2-detail="product-line">—</b></div>
        <div><span>SERIAL</span><b data-v2-detail="serial">—</b></div>
        <div><span>EQUIPMENT</span><b data-v2-detail="equipment">—</b></div>
        <div><span>CHARGES</span><b data-v2-detail="charges">—</b></div>
        <div><span>INSTANCE</span><b data-v2-detail="instance">—</b></div>
      </div>
      <div class="inventory-v2-modules">
        <span>MODULES / STRUCTURAL TECH</span>
        <div data-v2-detail="modules">NO INSTALLED MODULES</div>
      </div>
      <div class="inventory-v2-actions" id="inventory-v2-actions"></div>
      <div class="inventory-v2-action-status" id="inventory-v2-action-status"></div>`;
    card.appendChild(extra);
  }

  function rethemeTabs() {
    const modal = doc.getElementById("inventory-modal");
    if (!modal) return;
    modal.classList.add("inventory-v2-ready");
    const active = modal.querySelector('.inv-tab-btn[data-tab="inv-active"]');
    const stash = modal.querySelector('.inv-tab-btn[data-tab="inv-stash"]');
    const synth = modal.querySelector('.inv-tab-btn[data-tab="inv-sintesis"]');
    if (active) active.textContent = "LOADOUT";
    if (stash) stash.textContent = "STASH / ALIJO";
    if (synth) synth.textContent = "SYNTHESIS";
  }

  function bindModalControls() {
    const modal = doc.getElementById("inventory-modal");
    const open = doc.getElementById("btn-global-inventory");
    const close = doc.getElementById("inventory-modal-close");
    if (!modal || modal.dataset.v2ControlsBound === "true") return;
    modal.dataset.v2ControlsBound = "true";

    open?.addEventListener("click", () => modal.classList.add("active"));
    close?.addEventListener("click", () => modal.classList.remove("active"));
    modal.addEventListener("click", (event) => {
      if (event.target === modal) modal.classList.remove("active");
    });

    modal.querySelectorAll(".inv-tab-btn").forEach((button) => {
      button.addEventListener("click", () => {
        modal.querySelectorAll(".inv-tab-btn").forEach((entry) => entry.classList.remove("active"));
        modal.querySelectorAll(".inventory-tab-content").forEach((entry) => entry.classList.remove("active"));
        button.classList.add("active");
        const target = doc.getElementById(button.dataset.tab || "");
        target?.classList.add("active");
        clearSelection();
      });
    });
  }

  function bindStashFilters() {
    const search = doc.getElementById("buscador-items-stash");
    const buttons = [...doc.querySelectorAll("#filtros-stash .inv-filter-btn")];
    if (search && search.dataset.v2Bound !== "true") {
      search.dataset.v2Bound = "true";
      let timer = null;
      search.addEventListener("input", () => {
        global.clearTimeout(timer);
        timer = global.setTimeout(applyStashFilter, 120);
      });
    }
    buttons.forEach((button) => {
      if (button.dataset.v2Bound === "true") return;
      button.dataset.v2Bound = "true";
      button.addEventListener("click", () => {
        buttons.forEach((entry) => entry.classList.remove("active"));
        button.classList.add("active");
        applyStashFilter();
      });
    });
  }

  function applyStashFilter() {
    const search = String(doc.getElementById("buscador-items-stash")?.value || "").trim().toLowerCase();
    const activeFilter = String(doc.querySelector("#filtros-stash .inv-filter-btn.active")?.dataset.filter || "todo").toLowerCase();
    doc.querySelectorAll("#inv-stash-grid .item-slot[data-key]").forEach((slot) => {
      const haystack = `${slot.dataset.name || ""} ${slot.dataset.tier || ""} ${slot.dataset.tags || ""}`;
      const matchesSearch = !search || haystack.includes(search);
      const matchesFilter = activeFilter === "todo" || (slot.dataset.tags || "").includes(activeFilter);
      slot.hidden = !(matchesSearch && matchesFilter);
    });
  }

  function createItemSlot(key, item, containerType) {
    const slot = doc.createElement("button");
    slot.type = "button";
    slot.className = "item-slot inv-item-slot inventory-v2-runtime-slot";
    slot.dataset.key = key;
    slot.dataset.container = containerType;
    slot.dataset.name = itemName(item).toLowerCase();
    slot.dataset.tier = tierRoman(item).toLowerCase();
    slot.dataset.tags = itemTags(item).join(",").toLowerCase();
    slot.style.position = "relative";
    slot.draggable = containerType === "active";

    const icon = itemIcon(item);
    const quantity = quantityOf(item);
    slot.innerHTML = `
      <span class="tier">${escapeHtml(tierRoman(item))}</span>
      <div class="item-display">
        <div class="item-icon"${icon ? ` style="background-image:url('${escapeHtml(icon)}')"` : ""}></div>
        <span class="item-name">${escapeHtml(itemName(item))}</span>
      </div>
      <div class="item-quantity">x${quantity}</div>`;

    if (containerType === "active") {
      slot.addEventListener("dragstart", (event) => {
        event.dataTransfer?.setData?.("text/plain", key);
        selectItem(containerType, key, item, { focus: false });
      });
    }
    slot.addEventListener("click", () => selectItem(containerType, key, item));
    return slot;
  }

  function createEmptySlot(index) {
    const slot = doc.createElement("div");
    slot.className = "item-slot inv-item-slot inventory-v2-runtime-slot inventory-v2-empty-slot";
    slot.dataset.emptyIndex = String(index);
    slot.innerHTML = `<span class="inventory-v2-empty-index">${String(index).padStart(2, "0")}</span><span>EMPTY</span>`;
    return slot;
  }

  function renderGrid(containerType) {
    const active = containerType === "active";
    const grid = doc.getElementById(active ? "inv-active-grid" : "inv-stash-grid");
    if (!grid) return;
    const source = active ? state.unit?.inventario_activo : state.unit?.inventario_stash;
    const visibleEntries = entries(source).filter(([, item]) => item && quantityOf(item) > 0);
    grid.innerHTML = "";
    const fragment = doc.createDocumentFragment();

    visibleEntries.forEach(([key, item]) => fragment.appendChild(createItemSlot(key, item, containerType)));
    if (active) {
      const limit = Math.max(0, Number(inventory()?.activeSlotLimit?.(state.unit) ?? 10) || 10);
      for (let index = visibleEntries.length + 1; index <= limit; index += 1) fragment.appendChild(createEmptySlot(index));
    }
    grid.appendChild(fragment);
    decorateGrid(containerType);
    if (!active) applyStashFilter();
  }

  function renderCarryCount() {
    const count = entries(state.unit?.inventario_activo).filter(([, item]) => item && quantityOf(item) > 0).length;
    const limit = Number(inventory()?.activeSlotLimit?.(state.unit) ?? 10) || 10;
    const el = doc.getElementById("inventory-v2-carry-count");
    if (el) el.textContent = `${String(count).padStart(2, "0")} / ${limit}`;
  }

  function slotData(slotId) {
    return bridge()?.getSlotItem?.(state.unit || {}, slotId) || null;
  }

  function renderEquipment() {
    const equipment = doc.querySelector(".inventory-v2-equipment");
    if (!equipment || !state.unit) return;
    const activeSelected = state.selectedContainer === "active" ? selectedItem() : null;
    const compatible = activeSelected ? (bridge()?.compatibleSlots?.(activeSelected) || []) : [];

    equipment.querySelectorAll("[data-equipment-slot]").forEach((button) => {
      const slotId = button.dataset.equipmentSlot;
      const item = slotData(slotId);
      const name = button.querySelector(".inventory-v2-eq-name");
      const hint = button.querySelector(".inventory-v2-eq-hint");
      button.classList.toggle("is-filled", Boolean(item));
      button.classList.toggle("is-compatible", Boolean(activeSelected) && compatible.includes(slotId));
      button.classList.toggle(
        "is-selected",
        Boolean(item) && state.selectedContainer === "equipment" && itemId(item) === itemId(selectedItem()),
      );
      if (item) {
        name.textContent = itemName(item);
        const condition = runtime()?.getCondition?.(item);
        const percent = condition?.percent ?? (item.condition != null ? Math.round(Number(item.condition)) : null);
        hint.textContent = `${item.tier ? `TIER ${tierRoman(item)}` : itemCategory(item).toUpperCase()} // ${percent != null ? `${percent}%` : "READY"}`;
        button.draggable = false;
      } else {
        name.textContent = "EMPTY";
        hint.textContent = compatible.includes(slotId) ? "CLICK / DROP TO EQUIP" : (slotSpecs.find((entry) => entry.id === slotId)?.hint || "AVAILABLE");
        button.draggable = false;
      }
    });

    const augments = bridge()?.equippedSlots?.(state.unit)?.augments || [];
    const summary = doc.getElementById("inventory-v2-augment-summary");
    if (summary) {
      const strong = summary.querySelector("strong");
      if (strong) strong.textContent = augments.length ? augments.slice(0, 2).map(itemName).join(" // ") : "NO INSTALLED AUGMENTS";
    }
    const sync = doc.getElementById("inventory-v2-sync-state");
    if (sync) sync.textContent = state.peer?.bound ? "SYNC // REALTIME" : "SYNC // WAITING";
  }

  function decorateGrid(containerType) {
    const grid = doc.getElementById(containerType === "stash" ? "inv-stash-grid" : "inv-active-grid");
    if (!grid || !state.unit) return;
    const source = containerType === "stash" ? state.unit.inventario_stash : state.unit.inventario_activo;
    grid.querySelectorAll(".item-slot[data-key]").forEach((slot) => {
      const item = findByKey(source, slot.dataset.key);
      if (!item) return;
      slot.classList.remove("inventory-v2-equipped", "inventory-v2-damaged", "inventory-v2-stolen");
      slot.querySelector(".inventory-v2-item-state")?.remove();
      const flags = [];
      if (bridge()?.itemEquippedSlot?.(state.unit, item)) {
        slot.classList.add("inventory-v2-equipped");
        flags.push("EQUIPPED");
      }
      const condition = Number(item.condition ?? 100);
      if (condition <= 50) {
        slot.classList.add("inventory-v2-damaged");
        flags.push("DAMAGED");
      }
      if (item.stolen === true) {
        slot.classList.add("inventory-v2-stolen");
        flags.push("STOLEN");
      }
      if (state.selectedContainer === containerType && state.selected?.key === slot.dataset.key) slot.classList.add("active");
      else slot.classList.remove("active");
      if (flags.length) {
        const badge = doc.createElement("span");
        badge.className = "inventory-v2-item-state";
        badge.textContent = flags.join(" / ");
        slot.appendChild(badge);
      }
    });
  }

  function selectItem(containerType, key, item, options = {}) {
    state.selectedContainer = containerType;
    state.selected = { key: String(key), item };
    decorateGrid("active");
    decorateGrid("stash");
    renderEquipment();
    renderDetail();
    if (options.focus !== false) doc.getElementById("item-detail-card")?.classList.add("active");
  }

  function clearSelection() {
    state.selected = null;
    state.selectedContainer = "active";
    doc.getElementById("item-detail-card")?.classList.remove("active");
    doc.querySelectorAll("#inv-active-grid .item-slot.active,#inv-stash-grid .item-slot.active").forEach((slot) => slot.classList.remove("active"));
    renderEquipment();
  }

  function renderDetail() {
    ensureDetailExtensions();
    const item = selectedItem();
    const card = doc.getElementById("item-detail-card");
    if (!card) return;
    if (!item) {
      card.classList.remove("active");
      return;
    }
    card.classList.add("active");

    const quality = Number(item.qualityTier ?? item.quality ?? 1);
    const condition = runtime()?.getCondition?.(item);
    const conditionPercent = condition?.percent ?? Math.max(0, Math.min(100, Math.round((Number(item.condition ?? 100) / Math.max(1, Number(item.conditionMax ?? 100))) * 100)));
    const conditionState = runtime()?.getConditionState?.(item);
    const equippedSlot = bridge()?.itemEquippedSlot?.(state.unit, item);
    const charges = inventory()?.getCharges?.(item);

    const icon = doc.getElementById("detail-icon");
    if (icon) {
      icon.src = itemIcon(item);
      icon.alt = itemName(item);
    }
    const tier = doc.getElementById("detail-tier-val");
    if (tier) tier.textContent = tierRoman(item);
    const cost = doc.getElementById("detail-cost-val");
    if (cost) cost.textContent = String(itemValue(item));
    const title = doc.getElementById("detail-title");
    if (title) title.textContent = itemName(item);
    const desc = doc.getElementById("detail-desc");
    if (desc) desc.textContent = itemDescription(item);
    const tagsHost = doc.getElementById("detail-tags-val");
    if (tagsHost) tagsHost.innerHTML = itemTags(item).map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("");

    const set = (name, value) => {
      const target = card.querySelector(`[data-v2-detail="${name}"]`);
      if (target) target.textContent = value;
    };
    set("quality", `${qualityNames[quality] || `Q${quality}`} // Q${quality}`);
    set("condition", `${conditionPercent}% // ${String(conditionState?.state || conditionState || "SERVICEABLE").toUpperCase()}`);
    set("manufacturer", manufacturerName(item));
    set("product-line", productLineName(item));
    set("serial", item.productSerial || item.product_serial || "—");
    set("equipment", equippedSlot ? String(equippedSlot).toUpperCase() : "NOT EQUIPPED");
    set("charges", charges?.current == null ? "—" : `${charges.current} / ${charges.max ?? "∞"}`);
    set("instance", item.instanceId || item.instance_id || state.selected?.key || "—");

    const moduleHost = card.querySelector('[data-v2-detail="modules"]');
    if (moduleHost) {
      const modules = installedModules(item);
      const tech = Array.isArray(item.signatureTechnologyIds) ? item.signatureTechnologyIds : [];
      const values = [...modules, ...tech]
        .filter(Boolean)
        .map((entry) => typeof entry === "string" ? entry : entry.name || entry.id || "MODULE");
      moduleHost.innerHTML = values.length ? values.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("") : "NO INSTALLED MODULES";
    }
    renderActions(item, equippedSlot);
  }

  function showStatus(message, tone = "") {
    const el = doc.getElementById("inventory-v2-action-status");
    if (!el) return;
    el.textContent = message || "";
    el.dataset.tone = tone;
  }

  async function saveUnit(successMessage) {
    if (!state.peer?.bound) return false;
    showStatus("SYNCING...", "working");
    try {
      const result = await state.peer.save(state.unit);
      if (!result?.saved) throw new Error(result?.reason || "save_failed");
      showStatus(successMessage || "SYNCED", "success");
      renderAll();
      return true;
    } catch (error) {
      showStatus(`ERROR // ${error.message || error}`, "error");
      return false;
    }
  }

  function addAction(host, label, handler, className = "", disabled = false) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `inventory-v2-action ${className}`.trim();
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", handler);
    host.appendChild(button);
  }

  function reloadProfile(item) {
    const rule = item.rechargeRule || item.recharge_rule || {};
    const resource = rule.resourceDefinitionId || rule.resourceId || item.vinculo_item || null;
    const amount = Math.max(1, Number(rule.resourceAmount || rule.amount || item.vinculo_cantidad || 1) || 1);
    return resource ? { resource: String(resource), amount } : null;
  }

  function matchesReloadResource(item, resource) {
    const wanted = String(resource || "").trim().toLowerCase();
    if (!wanted) return false;
    const candidates = [item.definitionId, item.id, item.key, item.nombre, item.name, itemName(item)]
      .map((value) => String(value || "").trim().toLowerCase());
    return candidates.includes(wanted);
  }

  async function reloadSelected() {
    const target = selectedItem();
    const profile = reloadProfile(target || {});
    if (!target || !profile) return;
    const chargeState = inventory()?.getCharges?.(target);
    if (chargeState?.max != null && chargeState.current >= chargeState.max) {
      showStatus("CHARGES ALREADY FULL", "error");
      return;
    }

    const pools = [state.unit.inventario_activo || {}];
    if (state.stashUnlocked) pools.push(state.unit.inventario_stash || {});
    let remaining = profile.amount;
    const deductions = [];
    for (const pool of pools) {
      for (const [, item] of entries(pool)) {
        if (remaining <= 0) break;
        if (!matchesReloadResource(item, profile.resource)) continue;
        const available = quantityOf(item);
        if (available <= 0) continue;
        const take = Math.min(available, remaining);
        deductions.push({ pool, item, take });
        remaining -= take;
      }
    }
    if (remaining > 0) {
      showStatus(`MISSING RESOURCE // ${profile.resource}`, "error");
      return;
    }

    deductions.forEach(({ pool, item, take }) => {
      const next = quantityOf(item) - take;
      runtime()?.setQuantity?.(item, next);
      if (item.quantity == null) item.quantity = next;
      if (next <= 0) {
        for (const [key, entry] of entries(pool)) if (entry === item) delete pool[key];
      }
    });
    const restored = inventory()?.restoreCharges?.(target, 1);
    if (!restored?.restored) {
      showStatus(`BLOCKED // ${String(restored?.reason || "RELOAD FAILED").toUpperCase()}`, "error");
      return;
    }
    await saveUnit(`RELOADED // ${itemName(target).toUpperCase()}`);
  }

  function renderActions(item, equippedSlot) {
    const host = doc.getElementById("inventory-v2-actions");
    if (!host) return;
    host.innerHTML = "";

    if (state.selectedContainer === "equipment") {
      addAction(host, "UNEQUIP", unequipSelected, "primary");
      return;
    }
    if (state.selectedContainer === "stash") {
      addAction(host, "CARRY / LLEVAR", () => moveSelected("stash", "active"), "primary", !state.stashUnlocked);
      if (reloadProfile(item)) addAction(host, "RELOAD", reloadSelected, "", !state.stashUnlocked);
      return;
    }

    const compatible = bridge()?.compatibleSlots?.(item) || [];
    if (equippedSlot) addAction(host, "UNEQUIP", unequipSelected, "primary");
    else if (compatible.length) addAction(host, "EQUIP", equipSelectedAuto, "primary");
    addAction(host, "STORE / GUARDAR", () => moveSelected("active", "stash"), "", !state.stashUnlocked);
    const canUse = runtime()?.hasFunction?.(item, "use") || itemCategory(item).toLowerCase() === "consumable";
    if (canUse) addAction(host, "USE", useSelected);
    if (reloadProfile(item)) addAction(host, "RELOAD", reloadSelected);
  }

  async function equipSelectedTo(slotId) {
    const item = selectedItem();
    if (!item || state.selectedContainer !== "active" || !state.unit) return;
    const gate = bridge()?.canEquipTo?.(state.unit, item, slotId);
    if (!gate?.allowed) {
      showStatus(`BLOCKED // ${String(gate?.reason || "INCOMPATIBLE").toUpperCase()}`, "error");
      return;
    }
    const result = bridge().equipTo(state.unit, item, slotId);
    if (!result?.equipped) {
      showStatus(`BLOCKED // ${String(result?.reason || "EQUIP FAILED").toUpperCase()}`, "error");
      return;
    }
    state.selected = { key: state.selected.key, item };
    state.selectedContainer = "equipment";
    await saveUnit(`EQUIPPED // ${String(slotId).toUpperCase()}`);
  }

  async function equipSelectedAuto() {
    const item = selectedItem();
    if (!item || !state.unit) return;
    const compatible = bridge()?.compatibleSlots?.(item) || [];
    if (!compatible.length) {
      showStatus("ITEM NOT EQUIPPABLE", "error");
      return;
    }
    const preferred = compatible.find((slotId) => !bridge().getSlotItem(state.unit, slotId)) || compatible[0];
    await equipSelectedTo(preferred);
  }

  async function unequipSelected() {
    const item = selectedItem();
    if (!item || !state.unit) return;
    const slotId = bridge()?.itemEquippedSlot?.(state.unit, item);
    if (!slotId) {
      showStatus("ITEM IS NOT EQUIPPED", "error");
      return;
    }
    const result = bridge().unequipSlot(state.unit, slotId);
    if (!result?.unequipped) {
      showStatus(`BLOCKED // ${String(result?.reason || "UNEQUIP FAILED").toUpperCase()}`, "error");
      return;
    }
    const activeEntry = entries(state.unit.inventario_activo).find(([, entry]) => itemId(entry) === itemId(item));
    state.selectedContainer = "active";
    state.selected = activeEntry ? { key: activeEntry[0], item: activeEntry[1] } : null;
    await saveUnit(`UNEQUIPPED // ${String(slotId).toUpperCase()}`);
  }

  async function moveSelected(from, to) {
    if (!state.unit) return;
    if ((from === "stash" || to === "stash") && !state.stashUnlocked) {
      showStatus("STASH LOCKED BY DM", "error");
      return;
    }
    const item = selectedItem();
    if (!item) return;
    const id = itemId(item) || state.selected?.key;
    const result = bridge()?.moveItem?.(state.unit, id, from, to);
    if (!result?.moved) {
      showStatus(`BLOCKED // ${String(result?.reason || "MOVE FAILED").toUpperCase()}`, "error");
      return;
    }
    state.selectedContainer = to;
    const target = to === "stash" ? state.unit.inventario_stash : state.unit.inventario_activo;
    const found = entries(target).find(([, entry]) => itemId(entry) === id || entry === result.item);
    state.selected = found ? { key: found[0], item: found[1] } : null;
    await saveUnit(`${from.toUpperCase()} → ${to.toUpperCase()}`);
  }

  async function useSelected() {
    const item = selectedItem();
    if (!item || !state.unit || !runtime()?.useItem) return;
    const result = runtime().useItem(state.unit, item, {});
    if (!result?.used) {
      showStatus(`BLOCKED // ${String(result?.reason || "USE FAILED").toUpperCase()}`, "error");
      return;
    }
    if (quantityOf(item) <= 0) {
      const source = state.selectedContainer === "stash" ? state.unit.inventario_stash : state.unit.inventario_activo;
      for (const [key, entry] of entries(source)) if (entry === item || itemId(entry) === itemId(item)) delete source[key];
      state.selected = null;
    }
    await saveUnit(`USED // ${itemName(item).toUpperCase()}`);
  }

  function onEquipmentClick(event) {
    const slot = event.target.closest("[data-equipment-slot]");
    if (!slot || !state.unit) return;
    const slotId = slot.dataset.equipmentSlot;
    const current = bridge()?.getSlotItem?.(state.unit, slotId);
    if (current) {
      state.selectedContainer = "equipment";
      state.selected = { key: itemId(current), item: current };
      renderEquipment();
      renderDetail();
      return;
    }
    if (state.selectedContainer === "active" && selectedItem()) equipSelectedTo(slotId);
  }

  function onEquipmentDragOver(event) {
    const slot = event.target.closest("[data-equipment-slot]");
    if (!slot || !state.unit) return;
    const key = event.dataTransfer?.getData?.("text/plain") || state.selected?.key;
    const item = findByKey(state.unit.inventario_activo, key);
    if (!item || !bridge()?.canEquipTo?.(state.unit, item, slot.dataset.equipmentSlot)?.allowed) return;
    event.preventDefault();
    slot.classList.add("is-drop-target");
  }

  function onEquipmentDragLeave(event) {
    event.target.closest("[data-equipment-slot]")?.classList.remove("is-drop-target");
  }

  function onEquipmentDrop(event) {
    const slot = event.target.closest("[data-equipment-slot]");
    if (!slot || !state.unit) return;
    event.preventDefault();
    slot.classList.remove("is-drop-target");
    const key = event.dataTransfer?.getData?.("text/plain") || state.selected?.key;
    const item = findByKey(state.unit.inventario_activo, key);
    if (!item) return;
    const found = entries(state.unit.inventario_activo).find(([entryKey, entry]) => entryKey === key || entry === item || itemId(entry) === itemId(item));
    state.selectedContainer = "active";
    state.selected = { key: found?.[0] || key, item };
    equipSelectedTo(slot.dataset.equipmentSlot);
  }

  function renderAll() {
    renderGrid("active");
    renderGrid("stash");
    renderCarryCount();
    renderEquipment();
    if (state.selected) renderDetail();
  }

  function bindRealtime() {
    if (state.peer?.bound) return true;
    state.db = resolveDb();
    state.playerId = resolvePlayerId();
    if (!state.db || !state.playerId) return false;

    if (realtime()?.bindPlayerInventory) {
      state.peer = realtime().bindPlayerInventory({
        db: state.db,
        playerId: state.playerId,
        unit: state.unit,
        onInventory(detail) {
          state.unit = detail.unit;
          renderAll();
        },
        onStashAccess(detail) {
          state.stashUnlocked = detail.unlocked === true;
          global.isStashUnlocked = state.stashUnlocked;
          doc.getElementById("inventory-modal")?.classList.toggle("inventory-v2-stash-locked", !state.stashUnlocked);
          renderAll();
        },
        onError(error) {
          console.error("[Luminous] Inventory realtime error:", error);
        },
      });
      return state.peer.bound === true;
    }

    const persist = persistence();
    if (!persist?.subscribePlayerInventory || !persist?.applyInventoryState || !persist?.saveInventoryState) return false;
    const unsubscribeInventory = persist.subscribePlayerInventory(state.db, state.playerId, (snapshot) => {
      const applied = persist.applyInventoryState(state.unit, snapshot);
      if (!applied?.applied) return;
      renderAll();
    });
    let unsubscribeAccess = () => {};
    if (realtime()?.subscribeStashAccess) {
      unsubscribeAccess = realtime().subscribeStashAccess(state.db, (unlocked) => {
        state.stashUnlocked = unlocked === true;
        global.isStashUnlocked = state.stashUnlocked;
        renderAll();
      });
    } else {
      const ref = state.db.ref?.("campaña/ajustes_globales/alijo_desbloqueado");
      if (ref?.on) {
        const handler = (snap) => {
          state.stashUnlocked = snap?.val?.() === true;
          global.isStashUnlocked = state.stashUnlocked;
          renderAll();
        };
        ref.on("value", handler);
        unsubscribeAccess = () => ref.off?.("value", handler);
      }
    }
    state.peer = {
      bound: true,
      async save(unit) { return persist.saveInventoryState(state.db, state.playerId, unit); },
      dispose() { unsubscribeInventory?.(); unsubscribeAccess?.(); },
    };
    return true;
  }

  function dispose() {
    state.peer?.dispose?.();
    state.peer = null;
    state.ready = false;
  }

  function boot() {
    if (!doc.getElementById("inventory-modal")) return false;
    ensureActiveLayout();
    ensureDetailExtensions();
    rethemeTabs();
    bindModalControls();
    bindStashFilters();
    bindRealtime();
    state.ready = true;
    renderAll();
    return true;
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousInventoryHudV2 = Object.freeze({
    version: 3,
    state,
    boot,
    dispose,
    renderAll,
    renderGrid,
    renderEquipment,
    renderDetail,
    equipSelectedTo,
    moveSelected,
    useSelected,
    reloadSelected,
  });
})(window);
