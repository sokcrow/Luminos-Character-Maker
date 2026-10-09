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
    grantDefinitionId: null,
    catalogPoll: null,
    enchantmentDraft: null,
  };

  const runtime = () => global.LuminousItemRuntime || global.LuminousItemInventoryRuntime || null;
  const inventory = () => global.LuminousItemInventoryRuntime || runtime();
  const persistence = () => global.LuminousItemPersistenceRuntime || null;
  const realtime = () => global.LuminousItemRealtimeSync || null;
  const iconRegistry = () => global.LuminousItemIconRegistry || null;
  const enchantmentRuntime = () => global.LuminousItemEnchantmentRuntime || null;
  const enchanterStudio = () => global.LuminousDmEnchanterStudioModel || null;
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
    await ensureScript("item-icon-registry-script", "js/item-icon-registry.js", "LuminousItemIconRegistry");
    await ensureScript("item-runtime-engine-script", "js/item-runtime-engine.js", "LuminousItemRuntime");
    await ensureScript("item-inventory-runtime-script", "js/item-inventory-runtime.js", "LuminousItemInventoryRuntime");
    await ensureScript("item-enchantment-runtime-script", "js/item-enchantment-runtime.js", "LuminousItemEnchantmentRuntime");
    await ensureScript("dm-enchanter-studio-model-script", "js/dm-enchanter-studio-model.js", "LuminousDmEnchanterStudioModel");
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
    const base = String(item.displayName || item.nombre || item.name || runtime()?.resolveItem?.(item)?.displayName || item.definitionId || "ITEM").trim();
    const tier = enchantmentRuntime()?.activeEnchantment?.(item)?.tier;
    return tier && !new RegExp(`\\s\\+${tier}$`).test(base) ? `${base} +${tier}` : base;
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


  function localAssetPath(value) {
    const raw = String(value || "").trim();
    if (!raw || /^(?:https?:)?\/\//i.test(raw) || /^(?:data|blob):/i.test(raw)) return "";
    return raw;
  }

  function definitionIdOf(item = {}, fallback = "") {
    return String(item.definitionId || item.definition_id || item.canonicalId || item.itemId || item.id || item.key || fallback || "").trim();
  }

  function definitionName(item = {}, fallback = "") {
    return String(item.displayName || item.nombre || item.name || fallback || definitionIdOf(item) || "ITEM").trim();
  }

  function definitionCategory(item = {}) {
    return String(item.category || item.tipo_categoria || item.itemType || item.item_type || item.family || item.group || "item").trim();
  }

  function localIconInfo(item = {}, fallbackId = "") {
    const registry = iconRegistry();
    const explicit = [item.icono, item.icon, item.image, item.img].map(localAssetPath).find(Boolean);
    const candidates = [
      item.iconFamily, item.icon_family, item.family, item.group,
      definitionIdOf(item, fallbackId), definitionCategory(item)
    ].map((value) => String(value || "").trim()).filter(Boolean);

    if (registry?.get && registry?.resolveIcon) {
      for (const candidate of candidates) {
        const entry = registry.get(candidate, { fallback: false });
        if (!entry) continue;
        const icon = localAssetPath(registry.resolveIcon(entry.id, { fallback: false }));
        if (icon) return { family: entry.id, icon };
      }
    }
    if (explicit) return { family: String(item.iconFamily || item.icon_family || "").trim() || null, icon: explicit };
    const generic = localAssetPath(registry?.resolveIcon?.("generic_item", { fallback: false }))
      || "Assets/Icons/items/fallback/generic_item.png";
    return { family: registry?.get?.("generic_item", { fallback: false })?.id || "generic_item", icon: generic };
  }

  function catalogEntries() {
    const source = global.dbItemsCache && typeof global.dbItemsCache === "object" ? global.dbItemsCache : {};
    return Object.entries(source).map(([key, raw]) => {
      const definition = raw && typeof raw === "object" ? raw : {};
      const id = definitionIdOf(definition, key) || key;
      const icon = localIconInfo(definition, id);
      return {
        id,
        key,
        definition,
        name: definitionName(definition, key),
        category: definitionCategory(definition),
        tier: String(definition.tier || definition.itemTier || definition.tierRoman || "I"),
        tags: Array.isArray(definition.tags) ? definition.tags.map(String) : String(definition.tags || definition.tag || "").split(/[,|]/g).map((value) => value.trim()).filter(Boolean),
        iconFamily: icon.family,
        icon: icon.icon,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }

  function findCatalogEntry(id) {
    const wanted = String(id || "").trim();
    return catalogEntries().find((entry) => entry.id === wanted || entry.key === wanted) || null;
  }

  function grantStatus(message, tone = "") {
    const node = doc.getElementById("dm-item-grant-status");
    if (!node) return;
    node.textContent = String(message || "");
    node.dataset.tone = tone;
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

  // The saved ItemInstance replaces the inventory object. Keep equipped
  // pointers bound to that same live instance instead of an obsolete clone.
  function relinkEquippedInstance(unit, previous, next) {
    const equipment = unit?.equipment;
    const instanceId = itemId(previous);
    if (!equipment || !instanceId || itemId(next) !== instanceId) return 0;
    let linked = 0;
    const replace = (value) => {
      if (!value || typeof value !== "object" || itemId(value) !== instanceId) return value;
      linked += 1;
      return next;
    };
    for (const slot of ["mainHand", "offHand", "main_hand", "off_hand", "armor", "shield"]) {
      if (equipment[slot] != null) equipment[slot] = replace(equipment[slot]);
    }
    for (const slot of ["accessories", "augments", "augmentations"]) {
      if (Array.isArray(equipment[slot])) equipment[slot] = equipment[slot].map(replace);
    }
    return linked;
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
          <div><span>TALLER DEL DIRECTOR</span><strong id="dm-item-editor-title">Objeto</strong></div>
          <button type="button" class="dm-item-editor-close" id="dm-item-editor-close" aria-label="Cerrar">×</button>
        </header>
        <div class="dm-item-editor-body">
          <section class="dm-item-editor-section">
            <h4>Estado del objeto</h4>
            <div class="dm-item-editor-grid">
              <input id="dm-item-field-instance" type="hidden">
              <input id="dm-item-field-definition" type="hidden">
              <div class="dm-item-editor-field"><label>Cantidad</label><input id="dm-item-field-quantity" type="number" min="1" step="1"></div>
              <div class="dm-item-editor-field"><label>Calidad</label><select id="dm-item-field-quality"><option value="1">I · Low</option><option value="2">II · Standard</option><option value="3">III · Good</option><option value="4">IV · Fine</option><option value="5">V · Exceptional</option></select></div>
              <div class="dm-item-editor-field"><label>Estado actual</label><input id="dm-item-field-condition" type="number" min="0" step="1"></div>
              <div class="dm-item-editor-field"><label>Estado máximo</label><input id="dm-item-field-condition-max" type="number" min="0" step="1"></div>
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
          <section class="dm-item-editor-section dm-enchanter-studio" id="dm-item-enchanter-section" aria-labelledby="dm-item-enchanter-title">
            <h4 id="dm-item-enchanter-title">Enchanter Studio</h4>
            <p class="dm-enchanter-intro">Otorga un efecto mágico a este objeto individual sin modificar su calidad o mejoras físicas.</p>
            <div id="dm-enchanter-current" class="dm-enchanter-current" aria-live="polite"></div>
            <div class="dm-item-editor-grid dm-enchanter-controls">
              <div class="dm-item-editor-field">
                <label for="dm-enchanter-level">Nivel mágico</label>
                <select id="dm-enchanter-level"><option value="1">+1</option><option value="2">+2</option><option value="3">+3</option></select>
              </div>
              <div class="dm-item-editor-field wide">
                <label for="dm-enchanter-channel">Efecto</label>
                <select id="dm-enchanter-channel"></select>
              </div>
            </div>
            <div id="dm-enchanter-preview" class="dm-enchanter-preview" role="status" aria-live="polite"></div>
            <div class="dm-enchanter-actions">
              <button id="dm-enchanter-prepare" class="dm-item-editor-btn primary" type="button">Preparar encantamiento</button>
              <button id="dm-enchanter-remove" class="dm-item-editor-btn" type="button">Retirar encantamiento</button>
              <button id="dm-enchanter-discard" class="dm-item-editor-btn" type="button" hidden>Descartar cambio</button>
            </div>
            <p class="dm-enchanter-save-hint">Los cambios solo se aplican al pulsar <b>Guardar objeto</b>.</p>
          </section>
        </div>
        <footer class="dm-item-editor-footer">
          <div class="dm-item-editor-status" id="dm-item-editor-status">READY</div>
          <button type="button" class="dm-item-editor-btn" id="dm-item-editor-cancel">CANCEL</button>
          <button type="button" class="dm-item-editor-btn primary" id="dm-item-editor-save">Guardar objeto</button>
        </footer>
      </div>`;
    doc.body.appendChild(overlay);

    doc.getElementById("dm-item-editor-close")?.addEventListener("click", closeEditor);
    doc.getElementById("dm-item-editor-cancel")?.addEventListener("click", closeEditor);
    doc.getElementById("dm-item-editor-save")?.addEventListener("click", saveEditor);
    doc.getElementById("dm-enchanter-prepare")?.addEventListener("click", prepareEnchantment);
    doc.getElementById("dm-enchanter-remove")?.addEventListener("click", prepareEnchantmentRemoval);
    doc.getElementById("dm-enchanter-discard")?.addEventListener("click", discardEnchantmentDraft);
    ["dm-enchanter-level", "dm-enchanter-channel"].forEach((id) => {
      doc.getElementById(id)?.addEventListener("change", () => {
        state.enchantmentDraft = null;
        state.dirty = true;
        refreshEnchanterPreview();
      });
    });
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


  function renderEnchanter(item) {
    const studio = enchanterStudio();
    const section = doc.getElementById("dm-item-enchanter-section");
    if (!section || !studio) return;
    const options = studio.available(item);
    const status = studio.current(item);
    const level = doc.getElementById("dm-enchanter-level");
    const channel = doc.getElementById("dm-enchanter-channel");
    if (level) level.value = String(status.enchanted ? status.tier : 1);
    if (channel) {
      channel.replaceChildren();
      if (!options.defaultChannel && !status.channel) {
        const placeholder = doc.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Selecciona un efecto";
        channel.appendChild(placeholder);
      }
      options.choices.forEach(({ value, label }) => {
        const option = doc.createElement("option");
        option.value = value;
        option.textContent = label;
        channel.appendChild(option);
      });
      channel.value = status.channel || options.defaultChannel || "";
    }
    refreshEnchanterPreview();
  }

  function refreshEnchanterPreview() {
    const studio = enchanterStudio();
    const item = state.selected?.item;
    if (!studio || !item) return;
    const available = studio.available(item);
    const status = studio.current(item);
    const current = doc.getElementById("dm-enchanter-current");
    if (current) {
      current.textContent = status.enchanted
        ? `Encantamiento actual · +${status.tier} en ${status.label}`
        : "Este objeto todavía no está encantado.";
      current.dataset.enchanted = String(status.enchanted);
    }
    const level = doc.getElementById("dm-enchanter-level");
    const channel = doc.getElementById("dm-enchanter-channel");
    const request = { level: Number(level?.value), channel: channel?.value || "" };
    const preview = studio.preview(item, request, { allowReplace: true });
    const target = doc.getElementById("dm-enchanter-preview");
    if (target) {
      const staged = state.enchantmentDraft;
      target.textContent = staged
        ? staged.action === "remove"
          ? "Se retirará el encantamiento actual al guardar. El objeto conservará su calidad y mejoras físicas."
          : `Preparado: +${staged.level} en ${studio.CHANNEL_LABELS[staged.channel] || staged.channel}. Pulsa Guardar objeto para aplicar.`
        : available.eligible ? preview.message : studio.errorMessage(available.reason);
      if (global.LuminousItemMagicRuntime?.requiresAttunement?.(item)) {
        target.textContent += " El efecto solo estará activo cuando el objeto esté sintonizado.";
      }
      target.dataset.tone = staged ? "ready" : preview.valid && available.eligible ? "normal" : "warning";
    }
    if (level) level.disabled = !available.eligible;
    if (channel) channel.disabled = !available.eligible;
    const prepare = doc.getElementById("dm-enchanter-prepare");
    if (prepare) {
      prepare.disabled = !available.eligible || !preview.valid;
      prepare.textContent = status.enchanted ? "Preparar reemplazo" : "Preparar encantamiento";
    }
    const remove = doc.getElementById("dm-enchanter-remove");
    if (remove) remove.disabled = !status.enchanted;
    const discard = doc.getElementById("dm-enchanter-discard");
    if (discard) discard.hidden = !state.enchantmentDraft;
  }

  function prepareEnchantment() {
    const studio = enchanterStudio();
    const item = state.selected?.item;
    if (!studio || !item) return;
    const original = studio.current(item);
    let replaceConfirmed = false;
    if (original.enchanted) {
      const message = `Este objeto tiene +${original.tier} en ${original.label}. ¿Reemplazar el encantamiento anterior?`;
      if (typeof global.confirm !== "function" || !global.confirm(message)) return;
      replaceConfirmed = true;
    }
    const result = studio.prepare(item, {
      action: "apply",
      level: Number(fieldValue("dm-enchanter-level")),
      channel: fieldValue("dm-enchanter-channel"),
    }, { replaceConfirmed });
    if (!result.prepared) return announce(studio.errorMessage(result.reason), "error");
    state.enchantmentDraft = result.draft;
    state.dirty = true;
    refreshEnchanterPreview();
    announce("Encantamiento preparado. Guarda el objeto para aplicar.", "");
  }

  function prepareEnchantmentRemoval() {
    const studio = enchanterStudio();
    const item = state.selected?.item;
    if (!studio || !item) return;
    const existing = studio.current(item);
    if (!existing.enchanted) return announce(studio.errorMessage("item_not_enchanted"), "error");
    if (typeof global.confirm !== "function" || !global.confirm(`¿Retirar el encantamiento +${existing.tier}? La calidad física se conservará.`)) return;
    const result = studio.prepare(item, { action: "remove" });
    if (!result.prepared) return announce(studio.errorMessage(result.reason), "error");
    state.enchantmentDraft = result.draft;
    state.dirty = true;
    refreshEnchanterPreview();
    announce("Retiro preparado. Guarda el objeto para confirmar.", "");
  }

  function discardEnchantmentDraft() {
    state.enchantmentDraft = null;
    refreshEnchanterPreview();
    announce("Cambio de encantamiento descartado.", "");
  }

  function fillEditor(entry, listType) {
    const item = entry?.item;
    if (!item) return;
    state.selected = { key: entry.key, item, listType: normalizeListType(listType), playerId: state.playerId, enchantmentSnapshot: enchanterStudio()?.snapshot?.(item) };
    state.enchantmentDraft = null;
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
    renderEnchanter(item);
    announce("Editando objeto", "");
    updateConditionMeta();
  }

  function closeEditor() {
    editorElement()?.classList.remove("active");
    state.selected = null;
    state.enchantmentDraft = null;
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
    announce("Guardando los cambios...", "working");
    try {
      const result = await state.peer.save(state.unit);
      if (!result?.saved) throw new Error(result?.reason || "save_failed");
      announce(message || "SYNCED", "success");
      state.dirty = false;
      return true;
    } catch (error) {
      announce("No se pudieron guardar los cambios. Comprueba la conexión y vuelve a intentarlo.", "error");
      return false;
    } finally {
      state.saving = false;
    }
  }

  async function saveEditor() {
    const session = state.selected;
    if (!session || !(await ensurePeer())) return;
    if (session !== state.selected || session.playerId !== state.playerId) {
      return announce("El inventario cambió. Abre nuevamente el objeto.", "error");
    }
    const latest = findEntry(state.selected.listType, state.selected.key);
    if (!latest) {
      announce("El objeto ya no está en este inventario.", "error");
      return;
    }
    if (enchanterStudio()?.snapshot?.(latest.item) !== session.enchantmentSnapshot) {
      return announce("El encantamiento de este objeto cambió. Abre el objeto nuevamente.", "error");
    }

    const original = clone(latest.item);
    // The modern migrateLegacyItem returns its input unchanged. Keep a distinct
    // untouched rollback copy so a failed save never leaves staged magic live.
    const working = clone(original);
    const migrated = inventory()?.migrateLegacyItem?.(working, latest.key, { currentOwnerId: state.playerId }) || working;
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

    const enchantmentAction = state.enchantmentDraft?.action || null;
    if (enchantmentAction) {
      const result = enchanterStudio()?.applyDraft?.(migrated, state.enchantmentDraft);
      if (!result?.changed) {
        return announce(enchanterStudio()?.errorMessage?.(result?.reason) || "No fue posible encantar el objeto.", "error");
      }
      Object.assign(migrated, result.item);
    }

    latest.container[latest.key] = migrated;
    relinkEquippedInstance(state.unit, original, migrated);
    state.selected.item = migrated;
    const saved = await saveUnit("Guardando objeto...");
    if (!saved) {
      if (latest.container[latest.key] === migrated) {
        latest.container[latest.key] = original;
        relinkEquippedInstance(state.unit, migrated, original);
      }
      if (state.selected === session) state.selected.item = original;
      return;
    }
    if (state.selected === session) {
      fillEditor({ key: latest.key, item: migrated }, listType);
      announce(enchantmentAction ? "Objeto y encantamiento guardados correctamente." : "Objeto guardado correctamente.", "success");
    }
    decorateRows();
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


  function hideLegacyGrantControls() {
    const legacyButton = doc.getElementById("btn-dm-inv-add");
    const legacyRow = legacyButton?.parentElement;
    const legacySection = legacyRow?.parentElement;
    ["dm-inv-add-select", "dm-inv-add-target", "dm-inv-add-cant", "btn-dm-inv-add"].forEach((id) => {
      const node = doc.getElementById(id);
      if (node) {
        node.hidden = true;
        node.setAttribute("aria-hidden", "true");
      }
    });
    const modalBody = doc.querySelector("#modal-inventario-dm .modal-body");
    if (legacySection && legacySection !== modalBody && legacySection.closest?.("#modal-inventario-dm")) {
      legacySection.dataset.legacyInventoryGrant = "replaced";
      legacySection.hidden = true;
    }
  }

  function mountGrantConsole() {
    const modalBody = doc.querySelector("#modal-inventario-dm .modal-body");
    if (!modalBody) return null;
    let host = doc.getElementById("dm-item-grant-console");
    if (host) return host;

    hideLegacyGrantControls();
    host = doc.createElement("section");
    host.id = "dm-item-grant-console";
    host.className = "dm-item-grant-console";
    host.innerHTML = `
      <header class="dm-item-grant-header">
        <div><span>CANONICAL INVENTORY TOOL</span><strong>ADD ITEM TO PLAYER</strong></div>
        <div id="dm-item-grant-player" class="dm-item-grant-player">PLAYER // --</div>
      </header>
      <div class="dm-item-grant-toolbar">
        <input id="dm-item-grant-search" type="search" autocomplete="off" placeholder="Buscar ítem por nombre, ID o tag...">
        <select id="dm-item-grant-category"><option value="">TODAS LAS CATEGORÍAS</option></select>
      </div>
      <div class="dm-item-grant-layout">
        <div id="dm-item-grant-results" class="dm-item-grant-results" role="listbox" aria-label="Catálogo de ítems"></div>
        <aside class="dm-item-grant-preview">
          <img id="dm-item-grant-icon" src="Assets/Icons/items/fallback/generic_item.png" alt="">
          <div class="dm-item-grant-preview-copy">
            <strong id="dm-item-grant-name">Selecciona un ítem</strong>
            <span id="dm-item-grant-meta">CATÁLOGO LOCAL</span>
          </div>
          <div class="dm-item-grant-fields">
            <label>Destino<select id="dm-item-grant-target"><option value="stash">Stash / Alijo</option><option value="active">Inventario Activo</option></select></label>
            <label>Cantidad<input id="dm-item-grant-quantity" type="number" min="1" step="1" value="1"></label>
            <label>Calidad<select id="dm-item-grant-quality"><option value="1">I · Low</option><option value="2" selected>II · Standard</option><option value="3">III · Good</option><option value="4">IV · Fine</option><option value="5">V · Exceptional</option></select></label>
          </div>
          <button type="button" id="dm-item-grant-add" class="dm-item-grant-add" disabled>ADD ITEM</button>
          <div id="dm-item-grant-status" class="dm-item-grant-status">Selecciona una definición del catálogo.</div>
        </aside>
      </div>`;
    modalBody.appendChild(host);

    doc.getElementById("dm-item-grant-search")?.addEventListener("input", renderGrantCatalog);
    doc.getElementById("dm-item-grant-category")?.addEventListener("change", renderGrantCatalog);
    doc.getElementById("dm-item-grant-add")?.addEventListener("click", () => {
      grantSelectedItem().catch((error) => grantStatus(`ERROR // ${error?.message || error}`, "error"));
    });
    renderGrantCatalog();
    return host;
  }

  function renderGrantCatalog() {
    const host = doc.getElementById("dm-item-grant-results");
    const categorySelect = doc.getElementById("dm-item-grant-category");
    if (!host || !categorySelect) return false;

    const all = catalogEntries();
    const currentCategory = categorySelect.value;
    const categories = [...new Set(all.map((entry) => entry.category).filter(Boolean))].sort();
    const optionsSignature = categories.join("|");
    if (categorySelect.dataset.signature !== optionsSignature) {
      categorySelect.dataset.signature = optionsSignature;
      categorySelect.innerHTML = '<option value="">TODAS LAS CATEGORÍAS</option>';
      categories.forEach((category) => {
        const option = doc.createElement("option");
        option.value = category;
        option.textContent = category.replace(/_/g, " ").toUpperCase();
        categorySelect.appendChild(option);
      });
      if (currentCategory && categories.includes(currentCategory)) categorySelect.value = currentCategory;
    }

    const query = String(doc.getElementById("dm-item-grant-search")?.value || "").trim().toLowerCase();
    const category = categorySelect.value;
    const rows = all.filter((entry) => {
      if (category && entry.category !== category) return false;
      if (!query) return true;
      return [entry.name, entry.id, entry.category, entry.tier, ...entry.tags].join(" ").toLowerCase().includes(query);
    }).slice(0, 160);

    host.replaceChildren();
    if (!rows.length) {
      const empty = doc.createElement("div");
      empty.className = "dm-item-grant-empty";
      empty.textContent = all.length ? "SIN RESULTADOS" : "CATÁLOGO DE ÍTEMS AÚN NO DISPONIBLE";
      host.appendChild(empty);
      return true;
    }

    rows.forEach((entry) => {
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "dm-item-grant-result";
      button.dataset.definitionId = entry.id;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", state.grantDefinitionId === entry.id ? "true" : "false");

      const img = doc.createElement("img");
      img.src = entry.icon;
      img.alt = "";
      img.loading = "lazy";
      const copy = doc.createElement("span");
      copy.className = "dm-item-grant-result-copy";
      const name = doc.createElement("strong");
      name.textContent = entry.name;
      const meta = doc.createElement("small");
      meta.textContent = `${entry.category.toUpperCase()} · TIER ${entry.tier} · ${entry.id}`;
      copy.append(name, meta);
      button.append(img, copy);
      button.addEventListener("click", () => selectGrantDefinition(entry.id));
      host.appendChild(button);
    });
    return true;
  }

  function selectGrantDefinition(id) {
    const entry = findCatalogEntry(id);
    if (!entry) {
      state.grantDefinitionId = null;
      grantStatus("ITEM DEFINITION NOT FOUND", "error");
      return false;
    }
    state.grantDefinitionId = entry.id;
    doc.querySelectorAll("#dm-item-grant-results .dm-item-grant-result").forEach((row) => {
      row.setAttribute("aria-selected", row.dataset.definitionId === entry.id ? "true" : "false");
    });
    const icon = doc.getElementById("dm-item-grant-icon");
    if (icon) {
      icon.src = entry.icon;
      icon.alt = entry.name;
    }
    const name = doc.getElementById("dm-item-grant-name");
    if (name) name.textContent = entry.name;
    const meta = doc.getElementById("dm-item-grant-meta");
    if (meta) meta.textContent = `${entry.category.toUpperCase()} · TIER ${entry.tier} · ${entry.id}`;
    const add = doc.getElementById("dm-item-grant-add");
    if (add) add.disabled = false;
    grantStatus(`READY // ${entry.iconFamily || "generic_item"} // LOCAL ASSET`, "");
    return true;
  }

  async function grantSelectedItem() {
    const entry = findCatalogEntry(state.grantDefinitionId);
    if (!entry) return grantStatus("SELECCIONA UN ÍTEM", "error");
    if (!(await ensurePeer())) return grantStatus("PLAYER INVENTORY NOT READY", "error");

    const quantity = Math.max(1, intOr(doc.getElementById("dm-item-grant-quantity")?.value, 1));
    const qualityTier = Math.max(1, Math.min(5, intOr(doc.getElementById("dm-item-grant-quality")?.value, 2)));
    const target = normalizeListType(doc.getElementById("dm-item-grant-target")?.value);
    const source = clone(entry.definition) || {};
    source.id = definitionIdOf(source, entry.id) || entry.id;
    source.definitionId = entry.id;
    source.iconFamily = entry.iconFamily || source.iconFamily || source.icon_family || "generic_item";

    const instance = inventory()?.createItemInstance?.(source, {
      quantity,
      qualityTier,
      currentOwnerId: state.playerId,
    });
    if (!instance) return grantStatus("NO SE PUDO CREAR ITEMINSTANCE", "error");

    const name = entry.name;
    const category = entry.category;
    instance.definitionId = entry.id;
    instance.currentOwnerId = state.playerId;
    instance.iconFamily = source.iconFamily;
    instance.icono = entry.icon;
    instance.nombre = name;
    instance.name = name;
    instance.displayName = name;
    instance.category = category;
    instance.tipo_categoria = source.tipo_categoria || category;
    instance.itemType = source.itemType || source.item_type || category;
    instance.tags = Array.isArray(source.tags) ? clone(source.tags) : entry.tags;
    instance.tier = source.tier || entry.tier;
    if (source.descripcion != null) instance.descripcion = source.descripcion;
    if (source.description != null) instance.description = source.description;
    if (source.costo != null) instance.costo = source.costo;
    if (source.price != null) instance.price = source.price;
    setQuantity(instance, quantity);
    inventory()?.setQualityTier?.(instance, qualityTier);

    const result = inventory()?.insertItem?.(state.unit, instance, target, { currentOwnerId: state.playerId });
    if (!result?.inserted) {
      return grantStatus(`ADD BLOCKED // ${String(result?.reason || "UNKNOWN").toUpperCase()}`, "error");
    }

    const saved = await saveUnit(`ADDED // ${name.toUpperCase()} ×${result.quantity}`);
    if (!saved) {
      await loadLatestUnit();
      return grantStatus("SAVE FAILED // INVENTORY RELOADED", "error");
    }
    decorateRows();
    const remaining = Math.max(0, Number(result.remaining) || 0);
    grantStatus(remaining > 0
      ? `ADDED ×${result.quantity} // ${remaining} NOT INSERTED (LIMIT)`
      : `ADDED ×${result.quantity} TO ${target.toUpperCase()} // ${name.toUpperCase()}`, remaining > 0 ? "warning" : "success");
    return result;
  }

  function scheduleCatalogRefresh() {
    if (state.catalogPoll || catalogEntries().length) return;
    let attempts = 0;
    state.catalogPoll = global.setInterval?.(() => {
      attempts += 1;
      if (catalogEntries().length || attempts >= 40) {
        global.clearInterval?.(state.catalogPoll);
        state.catalogPoll = null;
        renderGrantCatalog();
      }
    }, 250) || null;
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
        const key = sourceButton.dataset.key || "";
        const listType = sourceButton.dataset.list || fallbackList;
        row.dataset.runtimeItemRow = "true";

        const entry = findEntry(listType, key);
        const img = row.querySelector("img");
        if (img && entry?.item) {
          const info = localIconInfo(entry.item, definitionIdOf(entry.item, key));
          img.src = info.icon;
          img.removeAttribute("onerror");
          img.loading = "lazy";
          img.dataset.localItemIcon = "true";
        }

        const eligibility = enchanterStudio()?.available?.(entry?.item || {});
        const enchanted = enchanterStudio()?.current?.(entry?.item || {});
        const enchanterButton = row.querySelector(".dm-item-enchanter-open");
        if (eligibility?.eligible || enchanted?.enchanted) {
          if (!enchanterButton) {
            const button = doc.createElement("button");
            button.type = "button";
            button.className = "dm-item-enchanter-open";
            button.dataset.key = key;
            button.dataset.list = listType;
            button.textContent = "Encantar";
            button.title = "Abrir Enchanter Studio";
            row.appendChild(button);
          }
        } else enchanterButton?.remove();
        const existingBadge = row.querySelector(".dm-item-enchanted-badge");
        if (enchanted?.enchanted) {
          if (!existingBadge) {
            const badge = doc.createElement("span");
            badge.className = "dm-item-enchanted-badge";
            badge.textContent = `+${enchanted.tier}`;
            badge.title = "Encantamiento mágico";
            row.appendChild(badge);
          } else if (existingBadge.textContent !== `+${enchanted.tier}`) existingBadge.textContent = `+${enchanted.tier}`;
        } else existingBadge?.remove();

        if (!row.querySelector(".dm-item-instance-edit")) {
          const button = doc.createElement("button");
          button.type = "button";
          button.className = "dm-item-instance-edit";
          button.dataset.key = key;
          button.dataset.list = listType;
          button.textContent = "Editar";
          button.title = "Editar estado y propiedades del objeto";
          row.appendChild(button);
        }
      });
    });
    const player = doc.getElementById("dm-item-grant-player");
    const playerLabel = `PLAYER // ${resolvePlayerId() || "--"}`;
    if (player && player.textContent !== playerLabel) player.textContent = playerLabel;
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
      if (!event.target?.closest?.(".btn-ver-inventario")) return;
      global.setTimeout?.(() => {
        mountGrantConsole();
        renderGrantCatalog();
        decorateRows();
      }, 0);
    }, true);

    doc.addEventListener("click", (event) => {
      const edit = event.target?.closest?.("#modal-inventario-dm .dm-item-instance-edit");
      if (!edit) return;
      event.preventDefault();
      event.stopPropagation();
      openEditor(edit.dataset.key, edit.dataset.list);
    }, true);

    doc.addEventListener("click", (event) => {
      const enchant = event.target?.closest?.("#modal-inventario-dm .dm-item-enchanter-open");
      if (!enchant) return;
      event.preventDefault();
      event.stopPropagation();
      openEditor(enchant.dataset.key, enchant.dataset.list).then((opened) => {
        if (opened) {
          doc.getElementById("dm-item-enchanter-section")?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
          doc.getElementById("dm-enchanter-level")?.focus?.();
        }
      }).catch(() => announce("No fue posible abrir Enchanter Studio.", "error"));
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
      mountGrantConsole();
      installObservers();
      installEventBridge();
      scheduleCatalogRefresh();
      state.ready = true;
      const playerId = resolvePlayerId();
      if (playerId) bindPeer(playerId);
      decorateRows();
      renderGrantCatalog();
      return true;
    } catch (error) {
      console.error("[Luminous] DM ItemInstance editor failed to boot:", error);
      return false;
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousDmItemInstanceEditor = Object.freeze({
    version: 3,
    state,
    boot,
    decorateRows,
    mountGrantConsole,
    renderGrantCatalog,
    selectGrantDefinition,
    grantSelectedItem,
    localIconInfo,
    catalogEntries,
    openEditor,
    saveEditor,
    prepareEnchantment,
    prepareEnchantmentRemoval,
    discardEnchantmentDraft,
    refreshEnchanterPreview,
    handleLegacyAction,
    closeEditor,
  });
})(window);
