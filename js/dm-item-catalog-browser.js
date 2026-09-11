(function (global) {
  "use strict";
  if (global.LuminousDmItemCatalogBrowser) return;
  const doc = global.document;
  if (!doc) return;

  const state = { ready: false, definitions: [], filtered: [], selectedId: null };
  const editor = () => global.LuminousDmItemInstanceEditor || null;
  const catalog = () => global.LuminousItemCatalogV10 || null;
  const inventory = () => global.LuminousItemInventoryRuntime || global.LuminousItemRuntime || null;
  const icons = () => global.LuminousItemIconRegistry || null;

  function ensureScript(id, src, globalName) {
    return new Promise((resolve, reject) => {
      if (globalName && global[globalName]) return resolve(global[globalName]);
      let script = doc.getElementById(id);
      if (!script) {
        script = doc.createElement("script");
        script.id = id;
        script.src = src;
        script.async = false;
        doc.head.appendChild(script);
      }
      if (globalName && global[globalName]) return resolve(global[globalName]);
      script.addEventListener("load", () => resolve(globalName ? global[globalName] : script), { once: true });
      script.addEventListener("error", () => reject(new Error(`No se pudo cargar ${src}`)), { once: true });
    });
  }

  function ensureStyle() {
    if (doc.getElementById("dm-item-catalog-browser-stylesheet")) return;
    const link = doc.createElement("link");
    link.id = "dm-item-catalog-browser-stylesheet";
    link.rel = "stylesheet";
    link.href = "css/dm-item-catalog-browser.css";
    doc.head.appendChild(link);
  }

  async function ensureStack() {
    await ensureScript("content-registry-script", "js/content-registry.js", "LuminousContentRegistry");
    await ensureScript("item-icon-registry-script", "js/item-icon-registry.js", "LuminousItemIconRegistry");
    await ensureScript("item-catalog-v10-script", "js/item-catalog-v10.js", "LuminousItemCatalogV10");
    global.LuminousItemCatalogV10?.registerAll?.();
    await ensureScript("item-runtime-engine-script", "js/item-runtime-engine.js", "LuminousItemRuntime");
    await ensureScript("item-inventory-runtime-script", "js/item-inventory-runtime.js", "LuminousItemInventoryRuntime");
    return Boolean(catalog() && inventory());
  }

  function overlay() { return doc.getElementById("dm-item-catalog-browser"); }
  function status(message, tone = "") {
    const el = doc.getElementById("dm-item-catalog-status");
    if (el) { el.textContent = String(message || ""); el.dataset.tone = tone; }
  }
  function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function mountButton() {
    const modal = doc.getElementById("modal-inventario-dm");
    if (!modal || doc.getElementById("dm-item-catalog-open")) return false;
    const button = doc.createElement("button");
    button.id = "dm-item-catalog-open";
    button.type = "button";
    button.className = "dm-item-catalog-open";
    button.textContent = "CATALOG V10";
    button.title = "Abrir catálogo canónico de 560 ItemDefinitions";
    const header = modal.querySelector(".modal-header") || modal.querySelector(".modal-body") || modal;
    header.appendChild(button);
    button.addEventListener("click", open);
    return true;
  }

  function mountOverlay() {
    if (overlay()) return overlay();
    const el = doc.createElement("div");
    el.id = "dm-item-catalog-browser";
    el.className = "dm-item-catalog-overlay";
    el.innerHTML = `
      <section class="dm-item-catalog-shell" role="dialog" aria-modal="true" aria-labelledby="dm-item-catalog-title">
        <header class="dm-item-catalog-header">
          <div><span>ITEM DATABASE // RUNTIME V10</span><strong id="dm-item-catalog-title">CANONICAL ITEM CATALOG</strong></div>
          <button type="button" id="dm-item-catalog-close" class="dm-item-catalog-close">×</button>
        </header>
        <div class="dm-item-catalog-toolbar">
          <input id="dm-item-catalog-search" type="search" placeholder="Search name, ID, subtype, tag...">
          <select id="dm-item-catalog-category"><option value="">ALL CATEGORIES</option></select>
          <label>QTY <input id="dm-item-catalog-quantity" type="number" min="1" value="1"></label>
          <label>QUALITY <select id="dm-item-catalog-quality"><option value="1">I</option><option value="2">II</option><option value="3">III</option><option value="4">IV</option><option value="5">V</option></select></label>
          <b id="dm-item-catalog-count">0 / 560</b>
        </div>
        <div id="dm-item-catalog-list" class="dm-item-catalog-list"></div>
        <footer class="dm-item-catalog-footer">
          <span id="dm-item-catalog-status">READY</span>
          <span>Grant creates canonical ItemInstances; definitions stay immutable.</span>
        </footer>
      </section>`;
    doc.body.appendChild(el);
    doc.getElementById("dm-item-catalog-close")?.addEventListener("click", close);
    el.addEventListener("click", (event) => { if (event.target === el) close(); });
    doc.getElementById("dm-item-catalog-search")?.addEventListener("input", render);
    doc.getElementById("dm-item-catalog-category")?.addEventListener("change", render);
    doc.getElementById("dm-item-catalog-list")?.addEventListener("click", (event) => {
      const button = event.target?.closest?.("button[data-grant]");
      if (!button) return;
      grant(button.dataset.definitionId, button.dataset.grant).catch((error) => status(`ERROR // ${error.message || error}`, "error"));
    });
    return el;
  }

  function populateCategories() {
    const select = doc.getElementById("dm-item-catalog-category");
    if (!select || select.options.length > 1) return;
    const categories = [...new Set(state.definitions.map((entry) => entry.databaseCategory || entry.category).filter(Boolean))].sort();
    categories.forEach((category) => {
      const option = doc.createElement("option");
      option.value = category;
      option.textContent = String(category).replace(/_/g, " ").toUpperCase();
      select.appendChild(option);
    });
  }

  function render() {
    const host = doc.getElementById("dm-item-catalog-list");
    if (!host) return;
    const query = String(doc.getElementById("dm-item-catalog-search")?.value || "").trim().toLowerCase();
    const category = String(doc.getElementById("dm-item-catalog-category")?.value || "").trim();
    state.filtered = state.definitions.filter((item) => {
      if (category && (item.databaseCategory || item.category) !== category) return false;
      if (!query) return true;
      return [item.canonicalId, item.displayName, item.category, item.databaseCategory, item.subtype, ...(item.tags || [])].join(" ").toLowerCase().includes(query);
    });
    const visible = state.filtered.slice(0, 120);
    host.innerHTML = visible.map((item) => {
      const icon = item.icono || icons()?.resolve?.(item) || "";
      const stateText = item.runtimeState || item.runtime?.authoredState || "READY";
      return `<article class="dm-item-catalog-row" data-definition-id="${escapeHtml(item.canonicalId)}">
        <img src="${escapeHtml(icon)}" alt="" loading="lazy">
        <div class="dm-item-catalog-info"><strong>${escapeHtml(item.displayName)}</strong><code>${escapeHtml(item.canonicalId)}</code><span>${escapeHtml(item.databaseCategory || item.category)} / ${escapeHtml(item.subtype || "—")} · T${escapeHtml(item.tier || 1)} · ${escapeHtml(item.iconGroup || "generic_item")}</span><small>${escapeHtml(item.gameplayFunction || item.description || "")}</small></div>
        <div class="dm-item-catalog-state">${escapeHtml(stateText)}</div>
        <div class="dm-item-catalog-actions"><button type="button" data-grant="active" data-definition-id="${escapeHtml(item.canonicalId)}">ACTIVE</button><button type="button" data-grant="stash" data-definition-id="${escapeHtml(item.canonicalId)}">STASH</button></div>
      </article>`;
    }).join("") || `<div class="dm-item-catalog-empty">NO MATCHING ITEMDEFINITIONS</div>`;
    const count = doc.getElementById("dm-item-catalog-count");
    if (count) count.textContent = `${state.filtered.length} / ${state.definitions.length}`;
    status(state.filtered.length > visible.length ? `SHOWING FIRST ${visible.length} RESULTS` : `READY // ${visible.length} RESULTS`);
  }

  function selectedPlayerReady() {
    const e = editor();
    return Boolean(e?.state?.playerId && e?.state?.peer?.bound && e?.state?.unit);
  }

  function addStacksToStash(definition, quantity, qualityTier) {
    const inv = inventory();
    const e = editor();
    const unit = e.state.unit;
    const stash = inv.stashContainer(unit, true).value;
    let remaining = Math.max(1, Number(quantity) || 1);
    const created = [];
    const sample = inv.createItemInstance(definition, { quantity: 1, qualityTier, currentOwnerId: e.state.playerId });
    const limit = Math.max(1, Number(inv.stackLimit(sample, "stash") || 99));
    while (remaining > 0) {
      const moved = Math.min(limit, remaining);
      const instance = inv.createItemInstance(definition, { quantity: moved, qualityTier, currentOwnerId: e.state.playerId });
      stash[instance.instanceId] = instance;
      created.push(instance.instanceId);
      remaining -= moved;
    }
    return created;
  }

  async function grant(definitionId, target) {
    if (!selectedPlayerReady()) {
      status("SELECT A PLAYER INVENTORY FIRST", "error");
      return false;
    }
    const definition = catalog()?.get?.(definitionId);
    if (!definition) return status("ITEMDEFINITION NOT FOUND", "error");
    const quantity = Math.max(1, Number(doc.getElementById("dm-item-catalog-quantity")?.value || 1));
    const qualityTier = Math.max(1, Math.min(5, Number(doc.getElementById("dm-item-catalog-quality")?.value || 1)));
    const created = addStacksToStash(definition, quantity, qualityTier);
    let moved = 0;
    let fallbackToStash = false;
    if (target === "active") {
      for (const id of created) {
        const result = inventory().moveToActive(editor().state.unit, id, null);
        if (result?.moved) moved += Number(result.amount || 0);
        else fallbackToStash = true;
      }
    }
    status("SYNCING ITEMINSTANCE...", "working");
    const result = await editor().state.peer.save(editor().state.unit);
    if (!result?.saved) {
      status(`SAVE FAILED // ${String(result?.reason || "UNKNOWN").toUpperCase()}`, "error");
      return false;
    }
    editor().decorateRows?.();
    const destination = target === "active" && !fallbackToStash ? "ACTIVE" : target === "active" ? "ACTIVE + STASH FALLBACK" : "STASH";
    status(`GRANTED // ${definition.displayName.toUpperCase()} ×${quantity} → ${destination}`, "success");
    return { granted: true, definitionId, quantity, target, moved, fallbackToStash };
  }

  async function open() {
    if (!state.ready) await boot();
    mountOverlay().classList.add("active");
    render();
  }
  function close() { overlay()?.classList.remove("active"); }

  async function boot() {
    if (!doc.getElementById("modal-inventario-dm")) return false;
    try {
      ensureStyle();
      await ensureStack();
      state.definitions = catalog().list();
      if (state.definitions.length !== 560) throw new Error(`Catalog expected 560 definitions, got ${state.definitions.length}`);
      mountButton();
      mountOverlay();
      populateCategories();
      render();
      state.ready = true;
      return true;
    } catch (error) {
      console.error("[Luminous] DM Item Catalog failed to boot:", error);
      return false;
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousDmItemCatalogBrowser = Object.freeze({ version: 1, state, boot, open, close, render, grant });
})(window);
