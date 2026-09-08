(function (global) {
  "use strict";

  if (global.LuminousDmItemInstanceEditor) return;
  const doc = global.document;
  if (!doc) return;

  const state = {
    db: null,
    playerId: null,
    unit: {},
    peer: null,
    selected: null,
    ready: false,
    dirty: false,
    saving: false,
    observer: null,
  };

  const runtime = () => global.LuminousItemRuntime || global.LuminousItemInventoryRuntime || null;
  const inventory = () => global.LuminousItemInventoryRuntime || runtime();
  const persistence = () => global.LuminousItemPersistenceRuntime || null;
  const realtime = () => global.LuminousItemRealtimeSync || null;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

  function ensureScript(id, src, globalName) {
    return new Promise((resolve, reject) => {
      if (globalName && global[globalName]) return resolve(global[globalName]);
      let script = doc.getElementById(id);
      if (!script) {
        script = doc.createElement("script");
        script.id = id;
        script.src = src;
        script.async = false;
        doc.head?.appendChild(script);
      }
      if (globalName && global[globalName]) return resolve(global[globalName]);
      script.addEventListener("load", () => resolve(globalName ? global[globalName] : script), { once: true });
      script.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)), { once: true });
    });
  }

  async function ensureRuntimeStack() {
    await ensureScript("item-runtime-engine-script", "js/item-runtime-engine.js", "LuminousItemRuntime");
    await ensureScript("item-inventory-runtime-script", "js/item-inventory-runtime.js", "LuminousItemInventoryRuntime");
    await ensureScript("item-persistence-runtime-script", "js/item-persistence-runtime.js", "LuminousItemPersistenceRuntime");
    await ensureScript("item-realtime-sync-script", "js/item-realtime-sync.js", "LuminousItemRealtimeSync");
    return Boolean(inventory() && persistence());
  }

  function resolveDb() {
    try { if (typeof db !== "undefined" && db?.ref) return db; } catch (_) {}
    try { if (global.firebase?.database) return global.firebase.database(); } catch (_) {}
    return null;
  }

  function resolvePlayerId() {
    const title = String(doc.getElementById("modal-inv-titulo")?.textContent || "").trim();
    const match = title.match(/Inventario\s+de:\s*(.+)$/i);
    const fromTitle = match?.[1]?.trim();
    if (fromTitle && fromTitle !== "???") return fromTitle;
    return state.playerId;
  }

  function normalizeListType(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "stash" || normalized === "inventario_stash" ? "stash" : "active";
  }

  function containerFor(listType) {
    return normalizeListType(listType) === "stash"
      ? (state.unit.inventario_stash || (state.unit.inventario_stash = {}))
      : (state.unit.inventario_activo || (state.unit.inventario_activo = {}));
  }

  function itemId(item = {}) {
    return String(item.instanceId || item.instance_id || runtime()?.itemId?.(item) || item.key || item.definitionId || item.id || "").trim();
  }

  function itemName(item = {}) {
    return String(item.displayName || item.nombre || item.name || runtime()?.resolveItem?.(item)?.displayName || item.definitionId || "ITEM").trim();
  }

  function quantityOf(item = {}) {
    return Math.max(0, intOr(runtime()?.quantityOf?.(item) ?? item.quantity ?? item.cantidad ?? 1, 0));
  }

  function setQuantity(item, value) {
    const next = Math.max(0, intOr(value, 0));
    runtime()?.setQuantity?.(item, next);
    item.quantity = next;
    item.cantidad = next;
    return next;
  }

  function findEntry(listType, key) {
    const container = containerFor(listType);
    const wanted = String(key || "");
    if (wanted && container[wanted]) return { key: wanted, item: container[wanted], container };
    for (const [entryKey, item] of Object.entries(container)) {
      if (!item) continue;
      if ([entryKey, itemId(item), item.instanceId, item.instance_id].map((value) => String(value || "")).includes(wanted)) {
        return { key: entryKey, item, container };
      }
    }
    return null;
  }

  function clearEquipmentReferences(unit, instanceId) {
    if (!unit?.equipment) return;
    const wanted = String(instanceId || "");
    ["mainHand", "offHand", "armor", "shield"].forEach((slot) => {
      const equipped = unit.equipment[slot];
      if (equipped && itemId(equipped) === wanted) delete unit.equipment[slot];
    });
    if (Array.isArray(unit.equipment.accessories)) {
      unit.equipment.accessories = unit.equipment.accessories.filter((item) => itemId(item) !== wanted);
    }
    [unit.inventario_activo, unit.inventario_stash].forEach((container) => {
      Object.values(container || {}).forEach((item) => {
        if (item && itemId(item) === wanted) {
          item.equipped = false;
          item.equippedPartIds = [];
        }
      });
    });
  }

  function editorElement() {
    return doc.getElementById("dm-item-instance-editor");
  }

  function announce(message, tone = "") {
    const status = doc.getElementById("dm-item-editor-status");
    if (status) {
      status.textContent = String(message || "");
      status.dataset.tone = tone;
    }
    if (tone === "error" && !editorElement()?.classList.contains("active")) {
      try { global.alert?.(String(message || "Error de Item Runtime")); } catch (_) {}
    }
  }

  function mountEditor() {
    if (editorElement()) return editorElement();
    const overlay = doc.createElement("div");
    overlay.id = "dm-item-instance-editor";
    overlay.className = "dm-item-editor-overlay";
    overlay.innerHTML = `
      <div class="dm-item-editor-shell" role="dialog" aria-modal="true" aria-labelledby="dm-item-editor-title">
        <header class="dm-item-editor-header">
          <div><span>CANONICAL ITEMINSTANCE // SCHEMA V2</span><strong id="dm-item-editor-title">ITEM INSTANCE</strong></div>
          <button type="button" class="dm-item-editor-close" id="dm-item-editor-close" aria-label="Cerrar">×</button>
        </header>
        <div class="dm-item-editor-body">
          <section class="dm-item-editor-section">
            <h4>Identity / Stack</h4>
            <div class="dm-item-editor-grid">
              <div class="dm-item-editor-field wide"><label>Instance ID</label><input id="dm-item-field-instance" readonly></div>
              <div class="dm-item-editor-field wide"><label>Definition ID</label><input id="dm-item-field-definition" readonly></div>
              <div class="dm-item-editor-field"><label>Quantity</label><input id="dm-item-field-quantity" type="number" min="1" step="1"></div>
              <div class="dm-item-editor-field"><label>Quality</label><select id="dm-item-field-quality"><option value="1">I · Low</option><option value="2">II · Standard</option><option value="3">III · Good</option><option value="4">IV · Fine</option><option value="5">V · Exceptional</option></select></div>
              <div class="dm-item-editor-field"><label>Condition</label><input id="dm-item-field-condition" type="number" min="0" step="1"></div>
              <div class="dm-item-editor-field"><label>Condition Max</label><input id="dm-item-field-condition-max" type="number" min="0" step="1"></div>
            </div>
            <div class="dm-item-editor-meta" id="dm-item-editor-condition-meta"></div>
          </section>
          <section class="dm-item-editor-section">
            <h4>Workshop / Provenance</h4>
            <div class="dm-item-editor-grid">
              <div class="dm-item-editor-field wide"><label>Manufacturer ID</label><input id="dm-item-field-manufacturer"></div>
              <div class="dm-item-editor-field wide"><label>Product Line ID</label><input id="dm-item-field-product-line"></div>
              <div class="dm-item-editor-field wide"><label>Model Name</label><input id="dm-item-field-model"></div>
              <div class="dm-item-editor-field wide"><label>Commission Name</label><input id="dm-item-field-commission"></div>
              <div class="dm-item-editor-field wide"><label>Product Serial</label><input id="dm-item-field-serial"></div>
              <div class="dm-item-editor-field wide"><label>Current Owner ID</label><input id="dm-item-field-owner"></div>
              <div class="dm-item-editor-field wide"><label>Seller ID</label><input id="dm-item-field-seller"></div>
              <div class="dm-item-editor-field wide"><label>Previous Owner IDs</label><textarea id="dm-item-field-previous-owners" placeholder="owner_a, owner_b"></textarea></div>
              <div class="dm-item-editor-field wide"><label>Ownership Flags</label><div class="dm-item-editor-check"><input id="dm-item-field-stolen" type="checkbox"><span>STOLEN</span></div></div>
            </div>
          </section>
          <section class="dm-item-editor-section">
            <h4>Charges / Technology</h4>
            <div class="dm-item-editor-grid">
              <div class="dm-item-editor-field"><label>Charges Current</label><input id="dm-item-field-charges" type="number" min="0" step="1"></div>
              <div class="dm-item-editor-field"><label>Charges Max</label><input id="dm-item-field-charges-max" type="number" min="0" step="1"></div>
              <div class="dm-item-editor-field wide"><label>Recharge Resource</label><input id="dm-item-field-recharge-resource" placeholder="definitionId"></div>
              <div class="dm-item-editor-field"><label>Resource Cost</label><input id="dm-item-field-recharge-cost" type="number" min="1" step="1"></div>
              <div class="dm-item-editor-field"><label>Recharge Amount</label><input id="dm-item-field-recharge-amount" type="number" min="1" step="1"></div>
              <div class="dm-item-editor-field full"><label>Installed Module IDs</label><textarea id="dm-item-field-modules" placeholder="module_a, module_b"></textarea></div>
              <div class="dm-item-editor-field full"><label>Signature Technology IDs</label><textarea id="dm-item-field-signature-tech" placeholder="structural_tech_a"></textarea></div>
            </div>
          </section>
        </div>
        <footer class="dm-item-editor-footer">
          <div class="dm-item-editor-status" id="dm-item-editor-status">READY</div>
          <button type="button" class="dm-item-editor-btn" id="dm-item-editor-cancel">CANCEL</button>
          <button type="button" class="dm-item-editor-btn primary" id="dm-item-editor-save">SAVE INSTANCE</button>
        </footer>
      </div>`;
    doc.body.appendChild(overlay);

    doc.getElementById("dm-item-editor-close")?.addEventListener("click", closeEditor);
    doc.getElementById("dm-item-editor-cancel")?.addEventListener("click", closeEditor);
    doc.getElementById("dm-item-editor-save")?.addEventListener("click", saveEditor);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) closeEditor(); });
    overlay.querySelectorAll("input,select,textarea").forEach((field) => field.addEventListener("input", () => {
      state.dirty = true;
      updateConditionMeta();
    }));
    return overlay;
  }

  function fieldValue(id) {
    return String(doc.getElementById(id)?.value ?? "").trim();
  }

  function setField(id, value) {
    const field = doc.getElementById(id);
    if (field) field.value = value == null ? "" : String(value);
  }

  function parseList(value) {
    return [...new Set(String(value || "").split(/[\n,]+/g).map((entry) => entry.trim()).filter(Boolean))];
  }

  function formatList(value) {
    return (Array.isArray(value) ? value : []).map((entry) => typeof entry === "string" ? entry : entry?.id || entry?.definitionId || "").filter(Boolean).join(", ");
  }

  function updateConditionMeta() {
    const max = Math.max(0, intOr(fieldValue("dm-item-field-condition-max"), 100));
    const current = Math.max(0, Math.min(max, intOr(fieldValue("dm-item-field-condition"), max)));
    const sample = { condition: current, conditionMax: max };
    const condition = inventory()?.getConditionState?.(sample);
    const id = String(condition?.id || condition?.state || "unknown").toUpperCase();
    const pct = condition?.percent != null ? Math.round(Number(condition.percent)) : (max > 0 ? Math.round(current / max * 100) : 0);
    const selected = state.selected;
    const stackLimit = selected ? inventory()?.stackLimit?.(selected.item, selected.listType) : null;
    const meta = doc.getElementById("dm-item-editor-condition-meta");
    if (meta) meta.innerHTML = `CONDITION <b>${pct}% // ${id}</b>${stackLimit ? ` · STACK LIMIT <b>${stackLimit}</b>` : ""}`;
  }

  function fillEditor(entry, listType) {
    const item = entry?.item;
    if (!item) return;
    state.selected = { key: entry.key, item, listType: normalizeListType(listType) };
    state.dirty = false;
    mountEditor().classList.add("active");
    const title = doc.getElementById("dm-item-editor-title");
    if (title) title.textContent = itemName(item);
    setField("dm-item-field-instance", item.instanceId || item.instance_id || entry.key);
    setField("dm-item-field-definition", item.definitionId || item.definition_id || item.id || entry.key);
    setField("dm-item-field-quantity", quantityOf(item));
    setField("dm-item-field-quality", Math.max(1, Math.min(5, intOr(item.qualityTier ?? item.quality, 1))));
    setField("dm-item-field-condition", item.condition ?? 100);
    setField("dm-item-field-condition-max", item.conditionMax ?? item.maxCondition ?? 100);
    setField("dm-item-field-manufacturer", item.manufacturerId || "");
    setField("dm-item-field-product-line", item.productLineId || item.product_line_id || "");
    setField("dm-item-field-model", item.modelName || item.model_name || "");
    setField("dm-item-field-commission", item.commissionName || item.commission_name || "");
    setField("dm-item-field-serial", item.productSerial || item.product_serial || "");
    setField("dm-item-field-owner", item.currentOwnerId || item.current_owner_id || state.playerId || "");
    setField("dm-item-field-seller", item.sellerId || item.seller_id || "");
    setField("dm-item-field-previous-owners", formatList(item.previousOwnerIds || item.previous_owner_ids || []));
    const stolen = doc.getElementById("dm-item-field-stolen");
    if (stolen) stolen.checked = item.stolen === true;
    const charges = inventory()?.getCharges?.(item) || {};
    setField("dm-item-field-charges", charges.current);
    setField("dm-item-field-charges-max", charges.max);
    const rule = item.rechargeRule || item.recharge_rule || {};
    setField("dm-item-field-recharge-resource", rule.resourceDefinitionId || rule.resourceId || item.vinculo_item || "");
    setField("dm-item-field-recharge-cost", rule.resourceAmount || rule.resourceCost || item.vinculo_cantidad || "");
    setField("dm-item-field-recharge-amount", rule.amount || 1);
    setField("dm-item-field-modules", formatList(item.installedModuleIds || item.installed_module_ids || []));
    setField("dm-item-field-signature-tech", formatList(item.signatureTechnologyIds || item.signature_technology_ids || []));
    announce(`EDITING // ${entry.key}`, "");
    updateConditionMeta();
  }

  function closeEditor() {
    editorElement()?.classList.remove("active");
    state.selected = null;
    state.dirty = false;
    state.saving = false;
  }

  async function loadLatestUnit() {
    if (!state.db || !state.playerId || !persistence()?.loadPlayerInventory) return false;
    const loaded = await persistence().loadPlayerInventory(state.db, state.playerId);
    if (!loaded?.loaded) return false;
    const applied = persistence().applyInventoryState(state.unit, loaded.state);
    return applied?.applied === true;
  }

  function bindPeer(playerId) {
    if (!state.db || !playerId) return false;
    if (state.playerId === playerId && state.peer?.bound) return true;
    state.peer?.dispose?.();
    state.playerId = playerId;
    state.unit = {};
    if (realtime()?.bindDmInventory) {
      state.peer = realtime().bindDmInventory({
        db: state.db,
        playerId,
        unit: state.unit,
        onInventory(detail) {
          state.unit = detail.unit;
          decorateRows();
          if (state.selected && !state.dirty) {
            const latest = findEntry(state.selected.listType, state.selected.key);
            if (latest) fillEditor(latest, state.selected.listType);
          }
        },
        onError(error) { console.error("[Luminous] DM item realtime error:", error); },
      });
      return state.peer?.bound === true;
    }
    state.peer = {
      bound: true,
      async save(unit) { return persistence().saveInventoryState(state.db, state.playerId, unit); },
      dispose() {},
    };
    loadLatestUnit().catch(() => {});
    return true;
  }

  async function ensurePeer() {
    state.db = state.db || resolveDb();
    const playerId = resolvePlayerId();
    if (!state.db || !playerId) return false;
    if (!bindPeer(playerId)) return false;
    if (!Object.keys(state.unit.inventario_activo || {}).length && !Object.keys(state.unit.inventario_stash || {}).length) {
      await loadLatestUnit();
    }
    return true;
  }

  async function saveUnit(message) {
    if (!state.peer?.bound || state.saving) return false;
    state.saving = true;
    announce("SYNCING ITEM RUNTIME...", "working");
    try {
      const result = await state.peer.save(state.unit);
      if (!result?.saved) throw new Error(result?.reason || "save_failed");
      announce(message || "SYNCED", "success");
      state.dirty = false;
      return true;
    } catch (error) {
      announce(`ERROR // ${error.message || error}`, "error");
      return false;
    } finally {
      state.saving = false;
    }
  }

  async function saveEditor() {
    if (!state.selected || !(await ensurePeer())) return;
    const latest = findEntry(state.selected.listType, state.selected.key);
    if (!latest) {
      announce("ITEM NO LONGER EXISTS", "error");
      return;
    }

    const original = clone(latest.item);
    const migrated = inventory()?.migrateLegacyItem?.(original, latest.key, { currentOwnerId: state.playerId }) || original;
    const listType = state.selected.listType;
    const quantity = Math.max(1, intOr(fieldValue("dm-item-field-quantity"), 1));
    const stackLimit = Math.max(1, intOr(inventory()?.stackLimit?.(migrated, listType), listType === "stash" ? 99 : 2));
    if (quantity > stackLimit) {
      announce(`STACK LIMIT // ${stackLimit}`, "error");
      return;
    }

    const maxCondition = Math.max(0, intOr(fieldValue("dm-item-field-condition-max"), 100));
    const condition = Math.max(0, Math.min(maxCondition, intOr(fieldValue("dm-item-field-condition"), maxCondition)));
    const chargesMaxRaw = fieldValue("dm-item-field-charges-max");
    const chargesRaw = fieldValue("dm-item-field-charges");
    const chargesMax = chargesMaxRaw === "" ? null : Math.max(0, intOr(chargesMaxRaw, 0));
    const chargesCurrent = chargesRaw === "" ? null : Math.max(0, intOr(chargesRaw, 0));
    if (chargesMax != null && chargesCurrent != null && chargesCurrent > chargesMax) {
      announce("CHARGES CURRENT CANNOT EXCEED MAX", "error");
      return;
    }

    migrated.instanceId = String(migrated.instanceId || latest.key);
    migrated.definitionId = String(migrated.definitionId || fieldValue("dm-item-field-definition") || latest.key);
    migrated.schemaVersion = inventory()?.schemaVersion || 2;
    setQuantity(migrated, quantity);
    inventory()?.setQualityTier?.(migrated, intOr(fieldValue("dm-item-field-quality"), 1));
    migrated.conditionMax = maxCondition;
    migrated.condition = condition;
    migrated.manufacturerId = fieldValue("dm-item-field-manufacturer") || null;
    migrated.productLineId = fieldValue("dm-item-field-product-line") || null;
    migrated.modelName = fieldValue("dm-item-field-model") || null;
    migrated.commissionName = fieldValue("dm-item-field-commission") || null;
    migrated.productSerial = fieldValue("dm-item-field-serial") || null;
    migrated.currentOwnerId = fieldValue("dm-item-field-owner") || state.playerId || null;
    migrated.sellerId = fieldValue("dm-item-field-seller") || null;
    migrated.previousOwnerIds = parseList(fieldValue("dm-item-field-previous-owners"));
    migrated.stolen = doc.getElementById("dm-item-field-stolen")?.checked === true;
    migrated.chargesMax = chargesMax;
    migrated.chargesCurrent = chargesCurrent == null ? chargesMax : chargesCurrent;
    migrated.installedModuleIds = parseList(fieldValue("dm-item-field-modules"));
    migrated.signatureTechnologyIds = parseList(fieldValue("dm-item-field-signature-tech"));
    if (Array.isArray(migrated.installedModules)) {
      const wanted = new Set(migrated.installedModuleIds);
      migrated.installedModules = migrated.installedModules.filter((entry) => wanted.has(String(typeof entry === "string" ? entry : entry?.definitionId || entry?.id || "")));
    }

    const rechargeResource = fieldValue("dm-item-field-recharge-resource");
    if (rechargeResource) {
      migrated.rechargeRule = {
        ...(migrated.rechargeRule && typeof migrated.rechargeRule === "object" ? migrated.rechargeRule : {}),
        trigger: migrated.rechargeRule?.trigger || "manual_resource",
        resourceDefinitionId: rechargeResource,
        resourceAmount: Math.max(1, intOr(fieldValue("dm-item-field-recharge-cost"), 1)),
        amount: Math.max(1, intOr(fieldValue("dm-item-field-recharge-amount"), 1)),
      };
    } else {
      migrated.rechargeRule = null;
    }

    latest.container[latest.key] = migrated;
    state.selected.item = migrated;
    const saved = await saveUnit(`SAVED // ${itemName(migrated).toUpperCase()}`);
    if (saved) fillEditor({ key: latest.key, item: migrated }, listType);
  }

  async function openEditor(key, listType) {
    if (!(await ensurePeer())) {
      announce("ITEM RUNTIME / FIREBASE NOT READY", "error");
      return false;
    }
    let entry = findEntry(listType, key);
    if (!entry) {
      await loadLatestUnit();
      entry = findEntry(listType, key);
    }
    if (!entry) {
      announce("ITEM NOT FOUND", "error");
      return false;
    }
    fillEditor(entry, listType);
    return true;
  }

  async function handleLegacyAction(button) {
    if (!(await ensurePeer())) {
      announce("ITEM RUNTIME / FIREBASE NOT READY", "error");
      return;
    }
    const action = String(button.dataset.action || "");
    const key = String(button.dataset.key || "");
    const listType = normalizeListType(button.dataset.list);
    let entry = findEntry(listType, key);
    if (!entry) {
      await loadLatestUnit();
      entry = findEntry(listType, key);
    }
    if (!entry) return announce("ITEM NOT FOUND", "error");

    const item = entry.item;
    if (action === "plus") {
      const limit = Math.max(1, intOr(inventory()?.stackLimit?.(item, listType), listType === "stash" ? 99 : 2));
      const current = quantityOf(item);
      if (current >= limit) return announce(`STACK LIMIT // ${limit}`, "error");
      setQuantity(item, current + 1);
      await saveUnit(`QUANTITY // ${current + 1}`);
      return;
    }

    if (action === "minus") {
      const current = quantityOf(item);
      if (current <= 1) {
        clearEquipmentReferences(state.unit, itemId(item));
        delete entry.container[entry.key];
      } else {
        setQuantity(item, current - 1);
      }
      await saveUnit(`QUANTITY // ${Math.max(0, current - 1)}`);
      return;
    }

    if (action === "delete") {
      if (global.confirm && !global.confirm(`Eliminar ${itemName(item)} del inventario de ${state.playerId}?`)) return;
      clearEquipmentReferences(state.unit, itemId(item));
      delete entry.container[entry.key];
      await saveUnit(`DELETED // ${itemName(item).toUpperCase()}`);
      return;
    }

    if (action === "to_stash" || action === "to_activo") {
      const id = itemId(item) || entry.key;
      const result = action === "to_stash"
        ? inventory()?.moveToStash?.(state.unit, id, null)
        : inventory()?.moveToActive?.(state.unit, id, null);
      if (!result?.moved) return announce(`MOVE BLOCKED // ${String(result?.reason || "UNKNOWN").toUpperCase()}`, "error");
      if (action === "to_stash") clearEquipmentReferences(state.unit, id);
      await saveUnit(`${action === "to_stash" ? "ACTIVE → STASH" : "STASH → ACTIVE"} // ${itemName(item).toUpperCase()}`);
    }
  }

  function decorateRows() {
    const configs = [
      [doc.getElementById("modal-inv-lista-activos"), "active"],
      [doc.getElementById("modal-inv-lista-stash"), "stash"],
    ];
    configs.forEach(([host, fallbackList]) => {
      if (!host) return;
      [...host.children].forEach((row) => {
        if (!(row instanceof global.HTMLElement)) return;
        const sourceButton = row.querySelector(".btn-inv-mod[data-key]");
        if (!sourceButton) return;
        row.dataset.runtimeItemRow = "true";
        if (row.querySelector(".dm-item-instance-edit")) return;
        const button = doc.createElement("button");
        button.type = "button";
        button.className = "dm-item-instance-edit";
        button.dataset.key = sourceButton.dataset.key || "";
        button.dataset.list = sourceButton.dataset.list || fallbackList;
        button.textContent = "INSTANCE";
        button.title = "Editar ItemInstance canónico";
        row.appendChild(button);
      });
    });
  }

  function installObservers() {
    const modal = doc.getElementById("modal-inventario-dm");
    if (!modal || state.observer) return;
    state.observer = new MutationObserver(() => {
      const playerId = resolvePlayerId();
      if (playerId && playerId !== state.playerId) bindPeer(playerId);
      decorateRows();
    });
    state.observer.observe(modal, { childList: true, subtree: true, characterData: true });
    decorateRows();
  }

  function installEventBridge() {
    if (doc.documentElement.dataset.dmItemRuntimeBridge === "true") return;
    doc.documentElement.dataset.dmItemRuntimeBridge = "true";

    doc.addEventListener("click", (event) => {
      const edit = event.target?.closest?.("#modal-inventario-dm .dm-item-instance-edit");
      if (!edit) return;
      event.preventDefault();
      event.stopPropagation();
      openEditor(edit.dataset.key, edit.dataset.list);
    }, true);

    doc.addEventListener("click", (event) => {
      const legacy = event.target?.closest?.("#modal-inventario-dm .btn-inv-mod");
      if (!legacy || !state.ready) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      handleLegacyAction(legacy).catch((error) => announce(`ERROR // ${error.message || error}`, "error"));
    }, true);
  }

  async function boot() {
    if (!doc.getElementById("modal-inventario-dm")) return false;
    try {
      await ensureRuntimeStack();
      state.db = resolveDb();
      mountEditor();
      installObservers();
      installEventBridge();
      state.ready = true;
      const playerId = resolvePlayerId();
      if (playerId) bindPeer(playerId);
      decorateRows();
      return true;
    } catch (error) {
      console.error("[Luminous] DM ItemInstance editor failed to boot:", error);
      return false;
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousDmItemInstanceEditor = Object.freeze({
    version: 1,
    state,
    boot,
    decorateRows,
    openEditor,
    saveEditor,
    handleLegacyAction,
    closeEditor,
  });
})(window);
