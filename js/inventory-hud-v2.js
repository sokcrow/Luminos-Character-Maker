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
    playerVitalsRef: null,
    playerVitalsHandler: null,
    vitalsReady: false,
    combatSprite: { src: "", x: 0, y: 0, scale: 1 },
    stashUnlocked: false,
    selected: null,
    selectedContainer: "active",
    ready: false,
  };

  const romanTiers = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  const slotSpecs = [
    { id: "mainHand", label: "MANO PRINCIPAL", hint: "ARMA / ESCUDO", className: "inv2-eq-main" },
    { id: "offHand", label: "MANO SECUNDARIA", hint: "ARMA / ESCUDO", className: "inv2-eq-off" },
    { id: "armor", label: "ARMADURA", hint: "CUERPO", className: "inv2-eq-armor" },
    { id: "shield", label: "ESCUDO", hint: "DEFENSA ACTIVA", className: "inv2-eq-shield" },
    { id: "accessory0", label: "ACCESORIO I", hint: "ACCESORIO", className: "inv2-eq-acc-a" },
    { id: "accessory1", label: "ACCESORIO II", hint: "ACCESORIO", className: "inv2-eq-acc-b" },
    { id: "augment0", label: "AUMENTO I", hint: "CUERPO / TÉCNICA", className: "inv2-eq-aug-a" },
    { id: "augment1", label: "AUMENTO II", hint: "CUERPO / TÉCNICA", className: "inv2-eq-aug-b" },
  ];

  const categoryLabels = Object.freeze({
    item: "OTHER", weapon: "WEAPON", armor: "ARMOR", shield: "SHIELD", accessory: "ACCESSORY",
    augmentation: "AUGMENT", augment: "AUGMENT", consumable: "CONSUMABLE", ammo: "AMMO", ammunition: "AMMO",
    tool: "TOOL", upgrade: "UPGRADE", material: "MATERIAL", component: "COMPONENT", ingredient: "INGREDIENT",
    food: "FOOD", medicine: "MEDICINE", medical: "MEDICAL", chemical: "CHEMICAL", scrap: "SCRAP",
  });

  const runtime = () => global.LuminousItemRuntime || global.LuminousItemInventoryRuntime || null;
  const iconRegistry = () => global.LuminousItemIconRegistry || null;
  const inventory = () => global.LuminousItemInventoryRuntime || runtime();
  const bridge = () => global.LuminousItemEquipmentBridge || null;
  const persistence = () => global.LuminousItemPersistenceRuntime || null;
  const realtime = () => global.LuminousItemRealtimeSync || null;
  const workshop = () => global.LuminousWorkshopRuntime || null;
  const foodRest = () => global.LuminousFoodRestRuntime || null;
  const effectIndicator = () => global.LuminousItemEffectIndicator || null;
  const enchantmentRuntime = () => global.LuminousItemEnchantmentRuntime || null;
  const magicRuntime = () => global.LuminousItemMagicRuntime || null;
  const enchantmentLabels = Object.freeze({
    offensive_level: "Nivel ofensivo", defensive_level: "Nivel defensivo",
    base_power: "Poder base", final_power: "Poder final",
    clash_power: "Poder de choque", guard_power: "Poder de guardia",
    speed: "Velocidad", min_speed: "Velocidad mínima", max_speed: "Velocidad máxima",
  });
  function enchantmentInfo(item = {}) {
    const ench = enchantmentRuntime()?.activeEnchantment?.(item) || null;
    if (!ench) return null;
    const requires = magicRuntime()?.requiresAttunement?.(item) === true;
    const attuned = requires && magicRuntime()?.isAttuned?.(state.unit, item) === true;
    return {
      tier: ench.tier,
      label: enchantmentLabels[ench.focus.channel] || "Efecto mágico",
      value: ench.focus.value,
      requiresAttunement: requires,
      attuned,
    };
  }

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
    const resolved = explicit ? item : runtime()?.resolveItem?.(item) || item;
    const base = String(explicit || resolved?.displayName || resolved?.nombre || resolved?.name || item.definitionId || item.id || "ITEM").trim();
    const ench = enchantmentInfo(item);
    return ench && !new RegExp("\\s\\+" + ench.tier + "$").test(base) ? base + " +" + ench.tier : base;
  }

  function itemCategory(item = {}) {
    return String(runtime()?.categoryOf?.(item) || item.tipo_categoria || item.category || item.itemType || item.type || "item");
  }

  function normalizeId(value) {
    return String(runtime()?.normalizeId?.(value) || value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function categoryLabel(value) {
    const id = normalizeId(value) || "item";
    return categoryLabels[id] || id.replace(/_/g, " ").toUpperCase();
  }

  function equipmentKind(item = {}) {
    const schema = bridge()?.schemaOf?.(item) || runtime()?.equipmentSchema?.(item) || item.equipment || item.equipmentSchema || {};
    return normalizeId(schema.kind || itemCategory(item)) || "item";
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

  function iconFromFamily(family) {
    const id = String(family || "").trim();
    if (!id) return "";
    return String(iconRegistry()?.resolveIcon?.(id, { fallback: false }) || "").trim();
  }

  function inferredIconFamily(item = {}) {
    const category = normalizeId(itemCategory(item));
    const kind = normalizeId(equipmentKind(item));
    const name = normalizeId(itemName(item));
    const tags = itemTags(item).map(normalizeId);
    const haystack = [kind, category, name, ...tags].filter(Boolean);
    const has = (...tokens) => tokens.some((token) => haystack.some((value) => value === token || value.includes(token)));

    if (category === "shield" || kind === "shield" || has("shield", "escudo")) {
      if (has("buckler", "broquel")) return "shield_buckler";
      if (has("tower", "torre")) return "shield_tower";
      if (has("heater")) return "shield_heater";
      if (has("round", "redondo")) return "shield_round";
      return "shield";
    }
    if (category === "weapon" || kind === "weapon" || has("weapon", "arma", "espada", "sword")) {
      if (has("dagger", "daga")) return "weapon_dagger";
      if (has("axe", "hacha")) return "weapon_axe";
      if (has("hammer", "martillo")) return "weapon_hammer";
      if (has("spear", "lanza")) return "weapon_spear";
      if (has("staff", "baston")) return "weapon_staff";
      if (has("bow", "arco")) return "weapon_bow";
      if (has("crossbow", "ballesta")) return "weapon_crossbow";
      if (has("sling", "honda")) return "weapon_sling";
      if (has("whip", "latigo")) return "weapon_whip";
      if (has("pistol", "pistola")) return "weapon_firearm_pistol";
      if (has("revolver")) return "weapon_firearm_revolver";
      if (has("rifle")) return "weapon_firearm_rifle";
      if (has("shotgun", "escopeta")) return "weapon_firearm_shotgun";
      if (has("smg", "subfusil")) return "weapon_firearm_smg";
      if (has("sword", "espada")) return "weapon_sword";
      return "weapon_melee";
    }
    if (category === "armor" || kind === "armor" || has("armor", "armadura")) return "armor_medium";
    if (category === "consumable" || has("ration", "racion")) {
      if (has("ration", "racion", "viaje", "field")) return "ration_field";
      return "consumable_other";
    }
    return "";
  }

  function localItemIconAsset(value) {
    const raw = String(value || "").trim();
    if (!raw || /^(?:https?:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) return "";
    return raw;
  }

  function itemIcon(item = {}) {
    const resolved = runtime()?.resolveItem?.(item) || item;
    const candidates = [
      item.iconFamily, item.icon_family,
      resolved.iconFamily, resolved.icon_family,
      inferredIconFamily(resolved),
      inferredIconFamily(item),
    ];
    for (const family of candidates) {
      const icon = iconFromFamily(family);
      if (icon) return icon;
    }

    const explicit = [item.icono, item.icon, item.image, item.img].map(localItemIconAsset).find(Boolean);
    if (explicit) return explicit;
    const resolvedExplicit = [resolved.icono, resolved.icon, resolved.image, resolved.img].map(localItemIconAsset).find(Boolean);
    if (resolvedExplicit) return resolvedExplicit;

    return String(iconRegistry()?.resolveIcon?.("generic_item", { fallback: false }) || "").trim();
  }

  function itemGemOverlayIcon(item = {}) {
    const explicit = item.gemOverlayIcon || item.gem_overlay_icon;
    if (explicit) return String(explicit).trim();
    const family = item.gemOverlayIconFamily || item.gem_overlay_icon_family;
    if (family) return iconFromFamily(family);
    return "";
  }

  function itemDescription(item = {}) {
    const explicit = item.descripcion || item.description || item.desc;
    if (explicit) return String(explicit);
    const resolved = runtime()?.resolveItem?.(item) || item;
    const resolvedExplicit = resolved.descripcion || resolved.description || resolved.desc;
    if (resolvedExplicit) return String(resolvedExplicit);
    const generated = global.LuminousItemDescriptionEngine?.describe?.(resolved)
      || global.LuminousItemDescriptionEngine?.describe?.(item);
    return String(generated || "Objeto sin descripción disponible.");
  }

  function itemEffectIndicators(item = {}) {
    const api = effectIndicator();
    if (!api?.indicators) return [];
    try {
      return api.indicators(item, state.unit || {}, {
        runtime: runtime(),
        statusLibrary: global.LuminousStatusLibrary || null,
        resolveItem: (entry) => runtime()?.resolveItem?.(entry) || entry,
      }) || [];
    } catch (_) {
      return [];
    }
  }

  function renderEffectIndicators(indicators = []) {
    if (!indicators.length) return "";
    const cleanses = indicators.filter((entry) => entry?.kind === "cleanse");
    const textBadges = indicators.filter((entry) => entry?.kind !== "cleanse");
    const chunks = [];

    textBadges.forEach((entry) => {
      const tone = entry.tone === "sp" ? "sp" : "hp";
      chunks.push(
        `<span class="inventory-v2-effect-badge inventory-v2-effect-${tone}" title="${escapeHtml(entry.detail || entry.label || "")}">${escapeHtml(entry.label || "")}</span>`,
      );
    });

    if (cleanses.length) {
      const shown = cleanses.slice(0, 3);
      const allDetail = cleanses.map((entry) => entry.detail || entry.label || entry.statusId).join(" · ");
      const icons = shown.map((entry) => {
        if (entry.icon) {
          return `<img class="inventory-v2-cleanse-icon" src="${escapeHtml(entry.icon)}" alt="${escapeHtml(entry.label || entry.statusId || "Cleanse")}" />`;
        }
        const fallback = String(entry.label || entry.statusId || "C").slice(0, 2).toUpperCase();
        return `<span class="inventory-v2-cleanse-fallback">${escapeHtml(fallback)}</span>`;
      }).join("");
      const overflow = cleanses.length > shown.length
        ? `<span class="inventory-v2-cleanse-more">+${cleanses.length - shown.length}</span>`
        : "";
      chunks.push(
        `<span class="inventory-v2-effect-badge inventory-v2-effect-cleanse" title="${escapeHtml(allDetail)}">${icons}${overflow}</span>`,
      );
    }

    return `<span class="inventory-v2-effect-rail" aria-hidden="true">${chunks.join("")}</span>`;
  }

  function renderDetailEffectIndicators(indicators = []) {
    if (!indicators.length) return "";
    return indicators.map((entry) => {
      if (entry?.kind === "cleanse") {
        const icon = entry.icon
          ? `<img class="inventory-v2-cleanse-icon" src="${escapeHtml(entry.icon)}" alt="" />`
          : `<span class="inventory-v2-cleanse-fallback">${escapeHtml(String(entry.label || entry.statusId || "C").slice(0, 2).toUpperCase())}</span>`;
        return `<span class="inventory-v2-effect-badge inventory-v2-effect-cleanse">${icon}<span>${escapeHtml(entry.label || entry.statusId || "Cleanse")}</span></span>`;
      }
      const tone = entry.tone === "sp" ? "sp" : "hp";
      return `<span class="inventory-v2-effect-badge inventory-v2-effect-${tone}">${escapeHtml(entry.label || "")}</span>`;
    }).join("");
  }

  function itemValue(item = {}) {
    const explicit = item.valorBase ?? item.costo ?? item.cost ?? item.price ?? item.precio ?? item.productionValueAhn ?? item.totalValueAhn ?? item.unitValueAhn;
    if (explicit != null) return Number(explicit) || 0;
    const resolved = runtime()?.resolveItem?.(item) || item;
    return Number(resolved.valorBase ?? resolved.costo ?? resolved.cost ?? resolved.price ?? resolved.precio ?? resolved.productionValueAhn ?? resolved.totalValueAhn ?? resolved.unitValueAhn ?? 0) || 0;
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

  function moduleDisplayName(entry) {
    const objectEntry = entry && typeof entry === "object" ? entry : null;
    const definitionRef = String(
      objectEntry?.definitionId
      || objectEntry?.canonicalId
      || objectEntry?.id
      || (typeof entry === "string" ? entry : "")
      || "",
    ).trim();
    const resolved = definitionRef
      ? inventory()?.resolveDefinition?.(definitionRef, { type: "module" })
      : null;
    const explicit = objectEntry?.displayName
      || objectEntry?.nombre
      || objectEntry?.name
      || resolved?.displayName
      || resolved?.nombre
      || resolved?.name;
    if (explicit) return String(explicit).trim();
    const fallback = definitionRef || objectEntry?.instanceId || objectEntry?.instance_id || "";
    return String(fallback)
      .trim()
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
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
        <div><span>ARSENAL / PERSONAJE</span><strong>EQUIPAMIENTO</strong></div>
        <span class="inventory-v2-crest" aria-hidden="true">✥</span>
      </header>
      <div class="inventory-v2-equipment-field">
        <div class="inventory-v2-body-silhouette" aria-hidden="true"></div>
        <div class="inventory-v2-combat-stage" role="img" aria-label="Sprite de combate del personaje">
          <div class="inventory-v2-combat-halo" aria-hidden="true"></div>
          <img class="inventory-v2-combat-sprite" alt="" hidden />
          <span class="inventory-v2-sprite-fallback" aria-hidden="true">✦</span>
        </div>
        ${slotSpecs.map((slot) => `
          <button type="button" class="inventory-v2-eq-slot ${slot.className}" data-equipment-slot="${slot.id}" aria-label="${slot.label}">
            <span class="inventory-v2-eq-label">${slot.label}</span>
            <span class="inventory-v2-eq-icon" aria-hidden="true"></span>
            <span class="inventory-v2-eq-name">LIBRE</span>
            <span class="inventory-v2-eq-hint">${slot.hint}</span>
          </button>`).join("")}
        <div class="inventory-v2-augment-summary" id="inventory-v2-augment-summary">
          <span>AUMENTOS</span><strong>SIN AUMENTOS</strong>
        </div>
      </div>
      <div class="inventory-v2-vitals-strip" aria-label="Estado del personaje">
        <span data-inv-vital="level"></span><span data-inv-vital="hp"></span><span data-inv-vital="sp"></span>
      </div>`;

    const carry = doc.createElement("section");
    carry.className = "inventory-v2-carry";
    carry.innerHTML = `
      <header class="inventory-v2-carry-header">
        <div><span>PERTENENCIAS / ACCESO RÁPIDO</span><strong>INVENTARIO ACTIVO</strong></div>
        <b id="inventory-v2-carry-count">00 / 24</b>
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
    const detailRight = card.querySelector(".detail-right") || card;
    const existing = card.querySelector(".inventory-v2-detail-extra");
    if (existing) {
      if (existing.parentElement !== detailRight) detailRight.appendChild(existing);
      return;
    }

    const extra = doc.createElement("div");
    extra.className = "inventory-v2-detail-extra";
    extra.innerHTML = `
      <div class="inventory-v2-player-facts" data-v2-detail="facts" hidden></div>
      <div class="inventory-v2-modules" data-v2-detail-section="modules" hidden>
        <span>MODIFICATIONS</span>
        <div data-v2-detail="modules"></div>
      </div>
      <div class="inventory-v2-actions" id="inventory-v2-actions"></div>
      <div class="inventory-v2-action-status" id="inventory-v2-action-status"></div>`;
    detailRight.appendChild(extra);
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

    const emitVisibility = (openState) => {
      global.dispatchEvent?.(new global.CustomEvent("luminous:inventory-visibility", {
        detail: { open: Boolean(openState) },
      }));
    };
    const openInventory = (event) => {
      const menu = doc.querySelector(".hud-sidebar-right");
      menu?.classList.remove("is-open");
      const menuButton = doc.getElementById("btn-toggle-hud-menu");
      menuButton?.setAttribute("aria-expanded", "false");
      menuButton?.setAttribute("aria-label", "Mostrar menú de personaje");
      if (menuButton) menuButton.title = "Mostrar menú";
      event?.preventDefault?.();
      event?.stopPropagation?.();
      modal.classList.add("active");
      bindRealtime();
      state.ready = true;
      renderAll();
      emitVisibility(true);
    };
    const closeInventory = (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      modal.classList.remove("active");
      suspendRealtime();
      emitVisibility(false);
    };

    open?.addEventListener("click", openInventory);
    close?.addEventListener("click", closeInventory);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) closeInventory();
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && modal.classList.contains("active")) closeInventory(event);
    });

    modal.querySelectorAll(".inv-tab-btn").forEach((button) => {
      button.addEventListener("click", () => {
        modal.querySelectorAll(".inv-tab-btn").forEach((entry) => entry.classList.remove("active"));
        modal.querySelectorAll(".inventory-tab-content").forEach((entry) => entry.classList.remove("active"));
        button.classList.add("active");
        const targetId = button.dataset.tab || "";
        const target = doc.getElementById(targetId);
        target?.classList.add("active");
        clearSelection();
        global.dispatchEvent?.(new global.CustomEvent("luminous:inventory-tab-changed", {
          detail: { tab: targetId },
        }));
      });
    });
  }

  function bindStashFilters() {
    const search = doc.getElementById("buscador-items-stash");
    if (search && search.dataset.v2Bound !== "true") {
      search.dataset.v2Bound = "true";
      let timer = null;
      search.addEventListener("input", () => {
        global.clearTimeout(timer);
        timer = global.setTimeout(applyStashFilter, 120);
      });
    }
    refreshStashFilters();
  }

  function refreshStashFilters() {
    const host = doc.getElementById("filtros-stash");
    if (!host) return;
    const previous = normalizeId(host.querySelector(".inv-filter-btn.active")?.dataset.filter || "all") || "all";
    const categories = [...new Set(entries(state.unit?.inventario_stash || {})
      .filter(([, item]) => item && quantityOf(item) > 0)
      .map(([, item]) => normalizeId(itemCategory(item)) || "item"))]
      .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
    const filters = ["all", ...categories];
    const active = filters.includes(previous) ? previous : "all";
    host.innerHTML = "";
    filters.forEach((filter) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = `inv-filter-btn${filter === active ? " active" : ""}`;
      button.dataset.filter = filter;
      button.textContent = filter === "all" ? "ALL / TODO" : categoryLabel(filter);
      button.addEventListener("click", () => {
        host.querySelectorAll(".inv-filter-btn").forEach((entry) => entry.classList.remove("active"));
        button.classList.add("active");
        applyStashFilter();
      });
      host.appendChild(button);
    });
  }

  function applyStashFilter() {
    const search = String(doc.getElementById("buscador-items-stash")?.value || "").trim().toLowerCase();
    const activeFilter = normalizeId(doc.querySelector("#filtros-stash .inv-filter-btn.active")?.dataset.filter || "all") || "all";
    doc.querySelectorAll("#inv-stash-grid .item-slot[data-key]").forEach((slot) => {
      const haystack = `${slot.dataset.name || ""} ${slot.dataset.tier || ""} ${slot.dataset.tags || ""} ${slot.dataset.category || ""}`;
      const matchesSearch = !search || haystack.includes(search);
      const matchesFilter = activeFilter === "all" || normalizeId(slot.dataset.category) === activeFilter;
      slot.hidden = !(matchesSearch && matchesFilter);
    });
  }

  function createItemSlot(key, item, containerType) {
    const slot = doc.createElement("button");
    slot.type = "button";
    slot.className = "item-slot inv-item-slot inventory-v2-runtime-slot";
    slot.dataset.key = key;
    slot.dataset.container = containerType;
    const category = normalizeId(itemCategory(item)) || "item";
    const kind = equipmentKind(item);
    const equipable = (bridge()?.compatibleSlots?.(item) || []).length > 0;
    slot.dataset.name = itemName(item).toLowerCase();
    slot.dataset.tier = tierRoman(item).toLowerCase();
    slot.dataset.tags = itemTags(item).join(",").toLowerCase();
    slot.dataset.category = category;
    slot.dataset.equipmentKind = kind;
    slot.classList.toggle("inventory-v2-equipable", equipable);
    slot.style.position = "relative";
    slot.draggable = containerType === "active";
    slot.title = itemName(item);
    slot.setAttribute("aria-label", `${itemName(item)}, ${categoryLabel(category)}, quantity ${quantityOf(item)}`);

    const icon = itemIcon(item);
    const gemOverlayIcon = itemGemOverlayIcon(item);
    const quantity = quantityOf(item);
    const value = itemValue(item);
    const effectIndicators = itemEffectIndicators(item);
    const effectIndicatorHtml = renderEffectIndicators(effectIndicators);
    const enchantment = enchantmentInfo(item);
    const activeCard = containerType === "active";
    slot.classList.toggle("inventory-v2-enchanted", Boolean(enchantment));
    slot.classList.toggle("inventory-v2-has-effect-indicator", effectIndicators.length > 0);
    slot.classList.toggle("inventory-v2-active-card", activeCard);
    slot.innerHTML = `
      <span class="tier">${escapeHtml(tierRoman(item))}</span>
      <div class="item-display">
        <div class="item-icon${icon ? " has-icon" : ""}"${icon ? ` style="background-image:url(&quot;${escapeHtml(icon)}&quot;)"` : ""}>
          <span class="inventory-v2-icon-fallback">${escapeHtml(categoryLabel(category).slice(0, 3))}</span>
          ${gemOverlayIcon ? `<span class="inventory-v2-gem-overlay" aria-hidden="true" style="background-image:url(&quot;${escapeHtml(gemOverlayIcon)}&quot;)"></span>` : ""}
        </div>
        <span class="item-name">${escapeHtml(itemName(item))}</span>
        ${enchantment ? `<span class="inventory-v2-enchantment-badge" title="Encantamiento mágico +${enchantment.tier}: ${escapeHtml(enchantment.label)}">✦ +${enchantment.tier}</span>` : ""}
        ${activeCard ? `<span class="inventory-v2-card-meta"><span class="inventory-v2-card-value">₳ ${escapeHtml(String(value))}</span><span class="inventory-v2-card-qty">x${escapeHtml(String(quantity))}</span></span>` : ""}
      </div>
      ${equipable ? '<span class="inventory-v2-equip-marker">EQUIP</span>' : ""}
      ${effectIndicatorHtml}
      ${activeCard ? "" : `<div class="item-quantity">x${quantity}</div>`}`;

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

  function activeInventoryLimit() {
    const configured = Number(inventory()?.activeSlotLimit?.(state.unit) ?? inventory()?.DEFAULT_ACTIVE_SLOT_LIMIT ?? 24);
    return Number.isFinite(configured) ? Math.max(0, Math.trunc(configured)) : 24;
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
      const limit = activeInventoryLimit();
      for (let index = visibleEntries.length + 1; index <= limit; index += 1) fragment.appendChild(createEmptySlot(index));
    }
    grid.appendChild(fragment);
    decorateGrid(containerType);
    if (!active) {
      refreshStashFilters();
      applyStashFilter();
    }
  }

  function renderCarryCount() {
    const count = entries(state.unit?.inventario_activo).filter(([, item]) => item && quantityOf(item) > 0).length;
    const limit = activeInventoryLimit();
    const el = doc.getElementById("inventory-v2-carry-count");
    if (el) el.textContent = `${String(count).padStart(2, "0")} / ${limit}`;
  }

  function renderStashCount() {
    const toolbar = doc.querySelector("#inv-stash .inventory-toolbar") || doc.getElementById("inv-stash");
    if (!toolbar) return;
    let el = doc.getElementById("inventory-v2-stash-count");
    if (!el) {
      el = doc.createElement("div");
      el.id = "inventory-v2-stash-count";
      el.className = "inventory-v2-stash-count";
      toolbar.appendChild(el);
    }
    const count = entries(state.unit?.inventario_stash).filter(([, item]) => item && quantityOf(item) > 0).length;
    const limit = Number(inventory()?.stashSlotLimit?.(state.unit) ?? inventory()?.DEFAULT_STASH_SLOT_LIMIT ?? 80) || 80;
    el.textContent = `STASH // ${String(count).padStart(2, "0")} / ${limit} SLOTS`;
    el.dataset.full = count >= limit ? "true" : "false";
  }

  function slotData(slotId) {
    return bridge()?.getSlotItem?.(state.unit || {}, slotId) || null;
  }

  function combatSpriteSource(player = {}) {
    // Same canonical priority as the combat field; never substitute the small HUD portrait.
    const raw = player.combatSprite || player.sprite_combate || player.combat_sprite ||
      player.tokenImage || player.sprite || player.idle_sprite ||
      player.combatVisual?.spriteUrl || player.visual?.spriteUrl || "";
    // Combat editor persists the sprite URL verbatim, including relative and data: URLs.
    // This is assigned directly to an image.src property, never interpolated as HTML.
    return String(raw || "").trim();
  }

  function hydrateCombatSprite(player = {}) {
    const visual = player.combatVisual || {};
    const bound = (value, fallback, min, max) => {
      const n = Number(value);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
    };
    state.combatSprite = {
      src: combatSpriteSource(player),
      x: bound(player.spriteX ?? player.combatSpriteX ?? visual.x, 0, -80, 80),
      y: bound(player.spriteY ?? player.combatSpriteY ?? visual.y, 0, -80, 80),
      scale: bound(player.visualScale ?? player.combatScale ?? player.scale ?? visual.scale, 1, 0.5, 2.5),
    };
  }

  function renderCombatSprite() {
    const image = doc.querySelector(".inventory-v2-combat-sprite");
    const fallback = doc.querySelector(".inventory-v2-sprite-fallback");
    if (!image || !fallback) return;
    const visual = state.combatSprite || {};
    const src = visual.src || combatSpriteSource(state.unit);
    image.style.transform = `translate(${visual.x || 0}px, ${visual.y || 0}px) scale(${visual.scale || 1})`;
    if (!src) {
      image.hidden = true;
      image.dataset.url = "";
      image.removeAttribute("src");
      fallback.hidden = false;
      return;
    }
    if (image.dataset.url === src) return;
    image.dataset.url = src;
    image.hidden = true;
    fallback.hidden = false;
    image.onload = () => { if (image.dataset.url === src) { image.hidden = false; fallback.hidden = true; } };
    image.onerror = () => { image.hidden = true; fallback.hidden = false; };
    image.src = src;
  }

  function renderEquipmentVitals() {
    const unit = state.unit || {};
    const data = unit.combatStats || {};
    const level = doc.querySelector("[data-inv-vital=level]");
    const hp = doc.querySelector("[data-inv-vital=hp]");
    const sp = doc.querySelector("[data-inv-vital=sp]");
    if (level) level.textContent = `NV. ${unit.level ?? unit.nivel ?? 1}`;
    const hpCurrent = unit.hp ?? data.hp_actual;
    const hpMax = unit.hp_max ?? data.hp_max;
    const spCurrent = unit.sp ?? data.sp_actual;
    const spMax = unit.sp_max ?? data.sp_max;
    if (hp) hp.textContent = `HP ${hpCurrent == null ? "—" : hpCurrent}${hpMax == null ? "" : ` / ${hpMax}`}`;
    if (sp) sp.textContent = `SP ${spCurrent == null ? "—" : spCurrent}${spMax == null ? "" : ` / ${spMax}`}`;
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
      const icon = button.querySelector(".inventory-v2-eq-icon");
      const url = item ? itemIcon(item) : "";
      if (icon) {
        icon.style.backgroundImage = url ? `url("${String(url).replace(/["\\]/g, "")}")` : "";
        icon.classList.toggle("has-icon", Boolean(url));
      }
      const hint = button.querySelector(".inventory-v2-eq-hint");
      button.classList.toggle("is-filled", Boolean(item));
      button.classList.toggle("is-compatible", Boolean(activeSelected) && compatible.includes(slotId));
      button.classList.toggle(
        "is-selected",
        Boolean(item) && state.selectedContainer === "equipment" && itemId(item) === itemId(selectedItem()),
      );
      if (item) {
        name.textContent = itemName(item);
        button.classList.toggle("inventory-v2-enchanted", Boolean(enchantmentInfo(item)));
        const condition = runtime()?.getCondition?.(item);
        const percent = condition?.percent ?? (item.condition != null ? Math.round(Number(item.condition)) : null);
        hint.textContent = `${item.tier ? `TIER ${tierRoman(item)}` : itemCategory(item).toUpperCase()} // ${percent != null ? `${percent}%` : "READY"}`;
        button.draggable = false;
      } else {
        name.textContent = "LIBRE";
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
    renderCombatSprite();
    renderEquipmentVitals();
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
    if (desc) {
      const magic = enchantmentInfo(item);
      const magicDescription = magic ? `Encantamiento +${magic.tier}: +${magic.value} ${magic.label.toLowerCase()}. ${magic.requiresAttunement ? (magic.attuned ? "Sintonizado." : "Requiere sintonización para estar activo.") : "Se activa al equipar el objeto compatible."}` : "";
      desc.textContent = [itemDescription(item), magicDescription].filter(Boolean).join("\n\n");
    }
    const detailEffects = doc.getElementById("inventory-v2-detail-effects");
    if (detailEffects) {
      const indicators = itemEffectIndicators(item);
      detailEffects.innerHTML = renderDetailEffectIndicators(indicators);
      detailEffects.hidden = indicators.length === 0;
    }
    const tagsHost = doc.getElementById("detail-tags-val");
    if (tagsHost) {
      tagsHost.innerHTML = "";
      tagsHost.hidden = true;
    }

    const factsHost = card.querySelector('[data-v2-detail="facts"]');
    if (factsHost) {
      const facts = [];
      if (conditionPercent < 100) {
        const stateLabel = String(
          conditionState?.id
          || conditionState?.state
          || conditionState?.label
          || (typeof conditionState === "string" ? conditionState : "DAMAGED"),
        ).replace(/_/g, " ").toUpperCase();
        facts.push(`<span class="inventory-v2-player-fact"><b>CONDITION</b> ${conditionPercent}% · ${escapeHtml(stateLabel)}</span>`);
      }
      if (charges?.current != null) {
        facts.push(`<span class="inventory-v2-player-fact"><b>CHARGES</b> ${escapeHtml(String(charges.current))} / ${escapeHtml(String(charges.max ?? "∞"))}</span>`);
      }
      const magic = enchantmentInfo(item);
      if (magic) {
        facts.push(`<span class="inventory-v2-player-fact inventory-v2-player-magic"><b>ENCANTAMIENTO +${magic.tier}</b> +${magic.value} ${escapeHtml(magic.label)}${magic.requiresAttunement ? (magic.attuned ? " · SINTONIZADO" : " · REQUIERE SINTONIZACIÓN") : ""}</span>`);
      }
      if (equippedSlot) {
        facts.push(`<span class="inventory-v2-player-fact"><b>EQUIPPED</b> ${escapeHtml(String(equippedSlot).replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase())}</span>`);
      }
      factsHost.innerHTML = facts.join("");
      factsHost.hidden = facts.length === 0;
    }

    const moduleSection = card.querySelector('[data-v2-detail-section="modules"]');
    const moduleHost = card.querySelector('[data-v2-detail="modules"]');
    if (moduleHost && moduleSection) {
      const modules = installedModules(item);
      const tech = Array.isArray(item.signatureTechnologyIds) ? item.signatureTechnologyIds : [];
      const values = [...modules, ...tech]
        .filter(Boolean)
        .map(moduleDisplayName)
        .filter(Boolean);
      moduleHost.innerHTML = values.map((entry) => `<span>${escapeHtml(entry)}</span>`).join("");
      moduleSection.hidden = values.length === 0;
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

  function hydratePlayerVitals(player = {}) {
    hydrateCombatSprite(player);
    const vitals = global.LuminousPlayerVitalsHud?.resolveVitals?.(player);
    if (!vitals) return false;
    state.unit.playerId = state.playerId;
    state.unit.hp = vitals.hpActual;
    state.unit.hp_max = vitals.hpMax;
    state.unit.sp = vitals.spActual;
    state.unit.combatStats = {
      ...(player.combatStats && typeof player.combatStats === "object" ? player.combatStats : {}),
      ...(state.unit.combatStats && typeof state.unit.combatStats === "object" ? state.unit.combatStats : {}),
      hp_actual: vitals.hpActual,
      hp_max: vitals.hpMax,
      sp_actual: vitals.spActual,
    };
    ["characterName", "character_name", "name", "level"].forEach((key) => {
      if (player[key] !== undefined) state.unit[key] = player[key];
    });
    state.vitalsReady = true;
    return true;
  }

  function bindPlayerVitalsRealtime() {
    if (state.playerVitalsRef) return true;
    if (!state.db?.ref || !state.playerId) return false;
    state.vitalsReady = false;
    const ref = state.db.ref(`campaña/jugadores/${state.playerId}`);
    const handler = (snapshot) => {
      hydratePlayerVitals(snapshot?.val?.() || {});
      renderAll();
    };
    ref.on("value", handler, (error) => {
      state.vitalsReady = false;
      console.error("[Luminous] Player vitals realtime error:", error);
    });
    state.playerVitalsRef = ref;
    state.playerVitalsHandler = handler;
    return true;
  }

  function inventoryAndVitalsPatch(unit = state.unit) {
    const persist = persistence();
    const vitals = global.LuminousPlayerVitalsHud;
    if (!persist?.serializeInventoryState || !vitals?.persistencePatch) return null;
    const inv = persist.serializeInventoryState(unit || {});
    const patch = {
      inventario_activo: inv.inventario_activo || {},
      inventario_stash: inv.inventario_stash || {},
      itemInventorySchemaVersion: persist.schemaVersion || inv.schemaVersion || 1,
      itemEquipmentRefs: inv.equipmentRefs || {},
      attunedItemInstanceIds: inv.attunedItemInstanceIds || [],
      ...vitals.persistencePatch(unit || {}),
    };
    [
      "culinarySurvival",
      "culinaryEffects",
      "culinaryMaxHpEffects",
      "culinaryAppliedMaxHpBonus",
    ].forEach((key) => {
      if (unit?.[key] !== undefined) patch[key] = JSON.parse(JSON.stringify(unit[key]));
    });
    return patch;
  }

  async function saveUnitWithVitals(successMessage) {
    if (!state.db?.ref || !state.playerId || !state.vitalsReady) return false;
    const patch = inventoryAndVitalsPatch(state.unit);
    if (!patch) return false;
    showStatus("SYNCING VITALS + INVENTORY...", "working");
    try {
      await state.db.ref(`campaña/jugadores/${state.playerId}`).update(patch);
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

    if (state.selectedContainer !== "active") {
      showStatus("RELOAD REQUIRES ACTIVE INVENTORY", "error");
      return;
    }
    const pools = [state.unit.inventario_activo || {}];
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
      if (foodRest()?.isFood?.(item)) addAction(host, "EAT / DRINK", eatDrinkSelected, "primary", !state.stashUnlocked);
      return;
    }

    const compatible = bridge()?.compatibleSlots?.(item) || [];
    if (equippedSlot) addAction(host, "UNEQUIP", unequipSelected, "primary");
    else if (compatible.length) addAction(host, "EQUIP", equipSelectedAuto, "primary");
    addAction(host, "STORE / GUARDAR", () => moveSelected("active", "stash"), "", !state.stashUnlocked);
    if (foodRest()?.isFood?.(item)) addAction(host, "EAT / DRINK", eatDrinkSelected, "primary");
    const functionalItem = runtime()?.resolveItem?.(item) || item;
    const canUse = runtime()?.hasFunction?.(functionalItem, "use") === true;
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
    if (!state.vitalsReady) {
      showStatus("SYNCING PLAYER VITALS...", "working");
      return;
    }
    const combatGate = await global.LuminousPlayerVitalsHud?.outOfCombatWriteGate?.(state.db, state.playerId);
    if (combatGate && combatGate.allowed === false) {
      showStatus("BLOCKED // USE THIS ITEM THROUGH COMBAT ENGINE", "error");
      return;
    }
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
    await saveUnitWithVitals(`USED // ${itemName(item).toUpperCase()}`);
  }

  async function eatDrinkSelected() {
    const item = selectedItem();
    if (!item || !state.unit || !foodRest()?.consumeFood) return;
    if (!state.vitalsReady) {
      showStatus("SYNCING PLAYER VITALS...", "working");
      return;
    }
    const combatGate = await global.LuminousPlayerVitalsHud?.outOfCombatWriteGate?.(state.db, state.playerId);
    if (combatGate && combatGate.allowed === false) {
      showStatus("BLOCKED // EAT / DRINK THROUGH COMBAT ENGINE", "error");
      return;
    }
    const result = foodRest().consumeFood(state.unit, item, {});
    if (!result?.consumed) {
      showStatus(`BLOCKED // ${String(result?.reason || "EAT / DRINK FAILED").toUpperCase()}`, "error");
      return;
    }
    if (quantityOf(item) <= 0) state.selected = null;
    const stateNow = foodRest().ensureState?.(state.unit);
    const suffix = stateNow ? ` // H${stateNow.hungerSlots}/${stateNow.maxHungerSlots} W${stateNow.hydrationSlots}/${stateNow.maxHydrationSlots}` : "";
    await saveUnitWithVitals(`EAT / DRINK // ${itemName(item).toUpperCase()}${suffix}`);
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
    renderStashCount();
    renderEquipment();
    if (state.selected) renderDetail();
  }

  function bindRealtime() {
    if (state.peer?.bound) return true;
    state.db = resolveDb();
    state.playerId = resolvePlayerId();
    if (!state.db || !state.playerId) return false;
    bindPlayerVitalsRealtime();

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

  function suspendRealtime() {
    state.peer?.dispose?.();
    state.peer = null;
    if (state.playerVitalsRef && state.playerVitalsHandler) {
      try { state.playerVitalsRef.off?.("value", state.playerVitalsHandler); } catch (_) {}
    }
    state.playerVitalsRef = null;
    state.playerVitalsHandler = null;
    state.vitalsReady = false;
  }

  function dispose() {
    suspendRealtime();
    state.ready = false;
  }

  function boot() {
    if (!doc.getElementById("inventory-modal")) return false;
    ensureActiveLayout();
    ensureDetailExtensions();
    rethemeTabs();
    bindModalControls();
    bindStashFilters();
    // Realtime inventory subscriptions are intentionally lazy. They are bound
    // only while the inventory modal is open and disposed on close.
    state.ready = true;
    renderAll();
    return true;
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousInventoryHudV2 = Object.freeze({
    version: 5,
    state,
    boot,
    dispose,
    renderAll,
    renderGrid,
    renderEquipment,
    renderDetail,
    itemEffectIndicators,
    renderEffectIndicators,
    renderDetailEffectIndicators,
    equipSelectedTo,
    moveSelected,
    hydratePlayerVitals,
    inventoryAndVitalsPatch,
    saveUnitWithVitals,
    useSelected,
    eatDrinkSelected,
    reloadSelected,
  });
})(window);
