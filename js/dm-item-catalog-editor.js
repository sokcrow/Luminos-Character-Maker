(function (global) {
  "use strict";

  if (global.LuminousDmItemCatalogEditor) return;
  const doc = global.document;
  if (!doc) return;

  const state = {
    selectedId: null,
    selectedDefinition: null,
    search: "",
    category: "all",
    mounted: false,
    saving: false,
  };

  const catalog = () => global.LuminousItemCatalog || null;
  const icons = () => global.LuminousItemIconRegistry || null;
  const inventory = () => global.LuminousItemInventoryRuntime || global.LuminousItemRuntime || null;
  const instanceEditor = () => global.LuminousDmItemInstanceEditor || null;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

  function resolveDb() {
    try { if (typeof db !== "undefined" && db?.ref) return db; } catch (_) {}
    try { return global.firebase?.database?.() || null; } catch (_) { return null; }
  }

  function overlay() { return doc.getElementById("dm-item-catalog-editor"); }
  function status(message, tone = "") {
    const el = doc.getElementById("dm-item-definition-status");
    if (!el) return;
    el.textContent = String(message || "");
    el.dataset.tone = tone;
  }
  function value(id) { return String(doc.getElementById(id)?.value ?? "").trim(); }
  function numberValue(id, fallback = 0) { const n = Number(value(id)); return Number.isFinite(n) ? n : fallback; }
  function setValue(id, next) { const el = doc.getElementById(id); if (el) el.value = next == null ? "" : String(next); }
  function parseTags(text) { return [...new Set(String(text || "").split(/[|,\n]+/g).map((entry) => entry.trim()).filter(Boolean))]; }
  function parseJson(text, fallback, label) {
    const raw = String(text || "").trim();
    if (!raw) return clone(fallback);
    try { return JSON.parse(raw); } catch (error) { throw new Error(`${label}: JSON inválido (${error.message})`); }
  }

  function mountToolbar() {
    const modal = doc.getElementById("modal-inventario-dm");
    if (!modal || modal.querySelector(".dm-item-catalog-toolbar")) return;
    const host = modal.querySelector(".modal-body") || modal;
    const bar = doc.createElement("div");
    bar.className = "dm-item-catalog-toolbar";
    bar.innerHTML = `<button type="button" class="dm-item-catalog-open">ITEM CATALOG V10</button><span>ITEMDEFINITION + FUNCTIONS + RUNTIME</span><span class="dm-item-catalog-count"></span>`;
    host.prepend(bar);
    bar.querySelector(".dm-item-catalog-open")?.addEventListener("click", open);
    refreshCount();
  }

  function refreshCount() {
    const stats = catalog()?.stats?.();
    doc.querySelectorAll("#modal-inventario-dm .dm-item-catalog-count").forEach((el) => {
      el.textContent = `${stats?.total || 0} DEFINITIONS · ${stats?.overrides || 0} OVERRIDES`;
    });
  }

  function mountOverlay() {
    if (overlay()) return overlay();
    const root = doc.createElement("div");
    root.id = "dm-item-catalog-editor";
    root.className = "dm-item-catalog-overlay";
    root.innerHTML = `
      <div class="dm-item-catalog-shell" role="dialog" aria-modal="true">
        <header class="dm-item-catalog-header">
          <div><strong>LUMINOUS ITEM CATALOG // V10</strong><br><span>560 canonical definitions · grouped icons · Firebase overrides</span></div>
          <button type="button" class="dm-item-catalog-close" aria-label="Cerrar">×</button>
        </header>
        <div class="dm-item-catalog-body">
          <aside class="dm-item-catalog-browser">
            <div class="dm-item-catalog-filters">
              <input id="dm-item-catalog-search" type="search" placeholder="Search name / ID / tag...">
              <select id="dm-item-catalog-category"><option value="all">ALL CATEGORIES</option></select>
            </div>
            <div class="dm-item-catalog-list" id="dm-item-catalog-list"></div>
            <div class="dm-item-catalog-browser-footer">
              <button type="button" class="dm-item-catalog-btn" id="dm-item-catalog-new">NEW CUSTOM</button>
              <button type="button" class="dm-item-catalog-btn primary" id="dm-item-add-active">ADD ACTIVE</button>
              <button type="button" class="dm-item-catalog-btn primary" id="dm-item-add-stash">ADD STASH</button>
            </div>
          </aside>
          <main class="dm-item-definition-pane">
            <div class="dm-item-definition-title">
              <img id="dm-item-definition-icon" alt="Item icon">
              <div><strong id="dm-item-definition-heading">SELECT ITEM</strong><small id="dm-item-definition-subheading">ItemDefinition</small></div>
            </div>
            <div class="dm-item-definition-form">
              <section class="dm-item-definition-section">
                <h4>Identity / Presentation</h4>
                <div class="dm-item-definition-grid">
                  <div class="dm-item-definition-field wide"><label>Canonical ID</label><input id="dm-def-id"></div>
                  <div class="dm-item-definition-field wide"><label>Display Name</label><input id="dm-def-name"></div>
                  <div class="dm-item-definition-field"><label>Category</label><select id="dm-def-category"></select></div>
                  <div class="dm-item-definition-field"><label>Subtype</label><input id="dm-def-subtype"></div>
                  <div class="dm-item-definition-field"><label>Tier</label><input id="dm-def-tier" type="number" min="1" max="5"></div>
                  <div class="dm-item-definition-field"><label>Manufacturer</label><input id="dm-def-manufacturer"></div>
                  <div class="dm-item-definition-field wide"><label>Icon Group</label><select id="dm-def-icon-group"></select></div>
                  <div class="dm-item-definition-field wide"><label>Icon Override URL</label><input id="dm-def-icon-override" type="url" placeholder="Optional unique art"></div>
                  <div class="dm-item-definition-field full"><label>Tags</label><textarea id="dm-def-tags" placeholder="tag:a, tag:b"></textarea></div>
                  <div class="dm-item-definition-field full"><label>Description</label><textarea id="dm-def-description"></textarea></div>
                </div>
              </section>
              <section class="dm-item-definition-section">
                <h4>Inventory / Economy</h4>
                <div class="dm-item-definition-grid">
                  <div class="dm-item-definition-field"><label>Base Price Ahn</label><input id="dm-def-price" type="number" min="0"></div>
                  <div class="dm-item-definition-field"><label>Stash Stack Max</label><input id="dm-def-stash-max" type="number" min="1"></div>
                  <div class="dm-item-definition-field"><label>Active Stack Max</label><input id="dm-def-active-max" type="number" min="1"></div>
                  <div class="dm-item-definition-field"><label>Weight Kg</label><input id="dm-def-weight" type="number" step="0.01" min="0"></div>
                  <div class="dm-item-definition-field"><label>Condition Max</label><input id="dm-def-condition-max" type="number" min="0"></div>
                  <div class="dm-item-definition-field"><label>Availability</label><input id="dm-def-availability"></div>
                  <div class="dm-item-definition-field"><label>Legality</label><input id="dm-def-legality"></div>
                  <div class="dm-item-definition-field"><label>Default Quality</label><input id="dm-def-quality" type="number" min="1" max="5"></div>
                </div>
              </section>
              <section class="dm-item-definition-section">
                <h4>Runtime Profile</h4>
                <div class="dm-item-definition-grid">
                  <div class="dm-item-definition-field full"><label>Runtime JSON</label><textarea class="code" id="dm-def-runtime"></textarea></div>
                </div>
              </section>
              <section class="dm-item-definition-section">
                <h4>Authored Functions</h4>
                <div class="dm-item-definition-grid">
                  <div class="dm-item-definition-field full"><label>Functions JSON</label><textarea class="code" id="dm-def-functions"></textarea></div>
                </div>
              </section>
              <div class="dm-item-definition-actions">
                <div class="dm-item-definition-status" id="dm-item-definition-status">READY</div>
                <button type="button" class="dm-item-catalog-btn danger" id="dm-item-definition-reset">RESET OVERRIDE</button>
                <button type="button" class="dm-item-catalog-btn primary" id="dm-item-definition-save">SAVE DEFINITION</button>
              </div>
            </div>
          </main>
        </div>
      </div>`;
    doc.body.appendChild(root);

    root.querySelector(".dm-item-catalog-close")?.addEventListener("click", close);
    root.addEventListener("click", (event) => { if (event.target === root) close(); });
    doc.getElementById("dm-item-catalog-search")?.addEventListener("input", (event) => { state.search = event.target.value; renderList(); });
    doc.getElementById("dm-item-catalog-category")?.addEventListener("change", (event) => { state.category = event.target.value; renderList(); });
    doc.getElementById("dm-item-catalog-new")?.addEventListener("click", newCustom);
    doc.getElementById("dm-item-add-active")?.addEventListener("click", () => addToPlayer("active"));
    doc.getElementById("dm-item-add-stash")?.addEventListener("click", () => addToPlayer("stash"));
    doc.getElementById("dm-item-definition-save")?.addEventListener("click", saveDefinition);
    doc.getElementById("dm-item-definition-reset")?.addEventListener("click", resetOverride);
    populateStaticOptions();
    state.mounted = true;
    return root;
  }

  function populateStaticOptions() {
    const categories = Object.keys(catalog()?.categories?.() || {}).sort();
    const browser = doc.getElementById("dm-item-catalog-category");
    const editor = doc.getElementById("dm-def-category");
    if (browser) browser.innerHTML = `<option value="all">ALL CATEGORIES</option>${categories.map((entry) => `<option value="${escapeHtml(entry)}">${escapeHtml(entry.toUpperCase())}</option>`).join("")}`;
    if (editor) editor.innerHTML = categories.map((entry) => `<option value="${escapeHtml(entry)}">${escapeHtml(entry)}</option>`).join("") + `<option value="custom">custom</option>`;
    const iconSelect = doc.getElementById("dm-def-icon-group");
    if (iconSelect) iconSelect.innerHTML = (icons()?.list?.() || []).map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.id)}</option>`).join("");
  }

  function renderList() {
    const host = doc.getElementById("dm-item-catalog-list");
    if (!host) return;
    const options = { query: state.search };
    if (state.category && state.category !== "all") options.category = state.category;
    const definitions = catalog()?.list?.(options) || [];
    host.innerHTML = definitions.map((definition) => `
      <button type="button" class="dm-item-catalog-card${definition.canonicalId === state.selectedId ? " active" : ""}" data-definition-id="${escapeHtml(definition.canonicalId)}">
        <img src="${escapeHtml(definition.icon || icons()?.resolve?.(definition) || "")}" alt="">
        <span><strong>${escapeHtml(definition.displayName)}</strong><small>${escapeHtml(definition.canonicalId)} · ${escapeHtml(definition.category || "item")}/${escapeHtml(definition.subtype || "—")}</small></span>
      </button>`).join("") || `<div style="padding:20px;color:#655f54;text-align:center">NO MATCHES</div>`;
    host.querySelectorAll("[data-definition-id]").forEach((button) => button.addEventListener("click", () => selectDefinition(button.dataset.definitionId)));
  }

  function selectDefinition(id) {
    const definition = catalog()?.get?.(id);
    if (!definition) return;
    state.selectedId = definition.canonicalId;
    state.selectedDefinition = definition;
    fillForm(definition);
    renderList();
  }

  function fillForm(definition) {
    state.selectedDefinition = clone(definition);
    state.selectedId = definition.canonicalId || definition.definitionId || null;
    setValue("dm-def-id", definition.canonicalId || definition.definitionId);
    setValue("dm-def-name", definition.displayName || definition.nombre);
    setValue("dm-def-category", definition.category || "custom");
    setValue("dm-def-subtype", definition.subtype || "");
    setValue("dm-def-tier", definition.tier || 1);
    setValue("dm-def-manufacturer", definition.manufacturerId || "");
    setValue("dm-def-icon-group", definition.iconGroup || icons()?.groupOf?.(definition) || "generic_item");
    setValue("dm-def-icon-override", definition.iconOverride || definition.icon_override || "");
    setValue("dm-def-tags", (definition.tags || []).join(", "));
    setValue("dm-def-description", definition.description || definition.descripcion || "");
    setValue("dm-def-price", definition.basePriceAhn ?? definition.price ?? 0);
    setValue("dm-def-stash-max", definition.stashStackLimit ?? definition.stackMax ?? 99);
    setValue("dm-def-active-max", definition.activeStackLimit ?? definition.inventoryMax ?? 2);
    setValue("dm-def-weight", definition.weightKg ?? 0);
    setValue("dm-def-condition-max", definition.conditionMax ?? 100);
    setValue("dm-def-availability", definition.availability || "");
    setValue("dm-def-legality", definition.legality || "");
    setValue("dm-def-quality", definition.defaultQualityTier ?? 2);
    setValue("dm-def-runtime", JSON.stringify(definition.runtime || {}, null, 2));
    setValue("dm-def-functions", JSON.stringify(definition.functions || [], null, 2));
    const icon = doc.getElementById("dm-item-definition-icon");
    if (icon) icon.src = definition.icon || icons()?.resolve?.(definition) || "";
    const heading = doc.getElementById("dm-item-definition-heading");
    if (heading) heading.textContent = definition.displayName || "ITEM";
    const subheading = doc.getElementById("dm-item-definition-subheading");
    if (subheading) subheading.textContent = `${definition.canonicalId || "NEW"} · ${definition.iconGroup || "generic_item"}`;
    status("READY");
  }

  function newCustom() {
    const suffix = Date.now().toString(36);
    fillForm({
      canonicalId: `item:custom_${suffix}`,
      definitionId: `item:custom_${suffix}`,
      displayName: "New Custom Item",
      category: "custom",
      subtype: "custom",
      tier: 1,
      basePriceAhn: 0,
      stackMax: 99,
      inventoryMax: 2,
      conditionMax: 100,
      iconGroup: "generic_item",
      tags: [],
      runtime: {},
      functions: []
    });
    renderList();
  }

  function collectDefinition() {
    const original = clone(state.selectedDefinition || {});
    const id = value("dm-def-id");
    if (!id || !id.includes(":")) throw new Error("Canonical ID debe usar namespace, por ejemplo item:custom_name");
    const displayName = value("dm-def-name");
    if (!displayName) throw new Error("Display Name es obligatorio");
    const runtime = parseJson(value("dm-def-runtime"), {}, "Runtime");
    const functions = parseJson(value("dm-def-functions"), [], "Functions");
    if (!Array.isArray(functions)) throw new Error("Functions debe ser un array JSON");
    return catalog().normalizeDefinition({
      ...original,
      canonicalId: id,
      definitionId: id,
      displayName,
      category: value("dm-def-category") || original.category || "custom",
      subtype: value("dm-def-subtype") || "custom",
      tier: Math.max(1, Math.min(5, Math.trunc(numberValue("dm-def-tier", 1)))),
      manufacturerId: value("dm-def-manufacturer") || null,
      iconGroup: value("dm-def-icon-group") || "generic_item",
      iconOverride: value("dm-def-icon-override") || null,
      tags: parseTags(value("dm-def-tags")),
      description: value("dm-def-description"),
      basePriceAhn: Math.max(0, numberValue("dm-def-price", 0)),
      price: Math.max(0, numberValue("dm-def-price", 0)),
      stackMax: Math.max(1, Math.trunc(numberValue("dm-def-stash-max", 99))),
      stashStackLimit: Math.max(1, Math.trunc(numberValue("dm-def-stash-max", 99))),
      inventoryMax: Math.max(1, Math.trunc(numberValue("dm-def-active-max", 2))),
      activeStackLimit: Math.max(1, Math.trunc(numberValue("dm-def-active-max", 2))),
      weightKg: Math.max(0, numberValue("dm-def-weight", 0)),
      conditionMax: Math.max(0, numberValue("dm-def-condition-max", 100)),
      availability: value("dm-def-availability") || null,
      legality: value("dm-def-legality") || null,
      defaultQualityTier: Math.max(1, Math.min(5, Math.trunc(numberValue("dm-def-quality", 2)))),
      runtime,
      functions
    }, id);
  }

  async function saveDefinition() {
    if (state.saving) return;
    const db = resolveDb();
    if (!db || !catalog()?.saveOverride) return status("FIREBASE / CATALOG NOT READY", "error");
    state.saving = true;
    status("SAVING DEFINITION...", "working");
    try {
      const definition = collectDefinition();
      const previousId = state.selectedId;
      if (previousId && previousId !== definition.canonicalId && catalog().get(previousId)) {
        throw new Error("No se puede renombrar un canonicalId existente. Crea un custom item nuevo.");
      }
      const result = await catalog().saveOverride(db, definition);
      if (!result?.saved) throw new Error(result?.reason || "save_failed");
      selectDefinition(result.canonicalId);
      refreshCount();
      status(`SAVED // ${result.canonicalId}`, "success");
    } catch (error) {
      status(`ERROR // ${error.message || error}`, "error");
    } finally {
      state.saving = false;
    }
  }

  async function resetOverride() {
    const id = state.selectedId;
    if (!id) return;
    const db = resolveDb();
    if (!db) return status("FIREBASE NOT READY", "error");
    if (global.confirm && !global.confirm(`Reset Firebase override for ${id}?`)) return;
    try {
      status("RESETTING OVERRIDE...", "working");
      await catalog().removeOverride(db, id);
      const fallback = catalog().get(id);
      if (fallback) selectDefinition(id); else newCustom();
      refreshCount();
      renderList();
      status("OVERRIDE REMOVED", "success");
    } catch (error) {
      status(`ERROR // ${error.message || error}`, "error");
    }
  }

  async function addToPlayer(containerType) {
    const definition = state.selectedId ? catalog()?.get?.(state.selectedId) : null;
    if (!definition) return status("SELECT AN ITEM FIRST", "error");
    const editor = instanceEditor();
    await editor?.boot?.();
    const editorState = editor?.state;
    if (!editorState?.playerId || !editorState?.unit || !editorState?.peer?.bound) {
      return status("OPEN A PLAYER INVENTORY FIRST", "error");
    }
    const result = inventory()?.addItemInstance?.(editorState.unit, definition, containerType, {
      quantity: 1,
      currentOwnerId: editorState.playerId,
      qualityTier: definition.defaultQualityTier || 2,
      condition: definition.conditionMax || 100,
      conditionMax: definition.conditionMax || 100,
    });
    if (!result?.added) return status(`ADD BLOCKED // ${String(result?.reason || "UNKNOWN").toUpperCase()}`, "error");
    try {
      status(`ADDING TO ${containerType.toUpperCase()}...`, "working");
      const saved = await editorState.peer.save(editorState.unit);
      if (!saved?.saved) throw new Error(saved?.reason || "save_failed");
      status(`ADDED // ${definition.displayName} → ${containerType.toUpperCase()}`, "success");
      editor.decorateRows?.();
    } catch (error) {
      status(`ERROR // ${error.message || error}`, "error");
    }
  }

  function open() {
    mountOverlay().classList.add("active");
    populateStaticOptions();
    renderList();
    if (!state.selectedId) {
      const first = catalog()?.list?.()[0];
      if (first) selectDefinition(first.canonicalId);
    } else if (catalog()?.get?.(state.selectedId)) {
      selectDefinition(state.selectedId);
    }
  }

  function close() { overlay()?.classList.remove("active"); }

  function boot() {
    if (!doc.getElementById("modal-inventario-dm") || !catalog() || !inventory()) return false;
    mountToolbar();
    mountOverlay();
    refreshCount();
    global.addEventListener?.("luminous:item-catalog-updated", () => { refreshCount(); renderList(); });
    return true;
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousDmItemCatalogEditor = Object.freeze({ version: 1, state, boot, open, close, selectDefinition, saveDefinition, addToPlayer, renderList });
})(window);
