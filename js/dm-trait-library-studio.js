(function (global) {
  "use strict";

  const doc = global.document || null;
  const engine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  const TRAITS_ROOT = "campaña/traits";
  const DEFINITIONS_ROOT = `${TRAITS_ROOT}/definitions`;
  const GRANTS_ROOT = `${TRAITS_ROOT}/grants`;
  const SOURCE_TYPES = Object.freeze(["class", "race", "background", "lineage"]);

  const normalizeId = (value) => engine?.normalizeId
    ? engine.normalizeId(value)
    : String(value ?? "").trim().toLowerCase().replace(/\s+/g, "_");

  function normalizeGrant(input = {}) {
    const sourceType = normalizeId(input.sourceType || input.source?.type);
    const sourceId = normalizeId(input.sourceId || input.source?.id || input.source?.classId);
    const traitId = normalizeId(input.traitId || input.id);
    const grant = { sourceType, sourceId, traitId };
    if (sourceType === "class") grant.atLevel = Math.max(1, Math.min(100, Number.parseInt(input.atLevel ?? input.level ?? 1, 10) || 1));
    return grant;
  }

  function validateGrant(input = {}) {
    const grant = normalizeGrant(input);
    const errors = [];
    if (!SOURCE_TYPES.includes(grant.sourceType)) errors.push(`Unsupported grant source: ${grant.sourceType || "empty"}`);
    if (!grant.sourceId) errors.push("Grant requires sourceId.");
    if (!grant.traitId) errors.push("Grant requires traitId.");
    if (grant.sourceType === "class" && (!Number.isInteger(grant.atLevel) || grant.atLevel < 1 || grant.atLevel > 100)) errors.push("Class grant requires atLevel from 1 to 100.");
    return { valid: !errors.length, errors, grant };
  }

  function grantIdentity(input = {}) {
    const grant = normalizeGrant(input);
    return `${grant.sourceType}:${grant.sourceId}:${grant.traitId}:${grant.sourceType === "class" ? grant.atLevel : 0}`;
  }

  function grantsArray(value) {
    return Object.entries(value || {}).map(([id, grant]) => ({ id, ...normalizeGrant(grant), createdAt: grant?.createdAt || null, updatedAt: grant?.updatedAt || null }));
  }

  const exported = { TRAITS_ROOT, DEFINITIONS_ROOT, GRANTS_ROOT, SOURCE_TYPES, normalizeGrant, validateGrant, grantIdentity, grantsArray };
  if (typeof module !== "undefined" && module.exports) module.exports = exported;
  if (!doc || !engine) return;

  if (global.LuminousDmTraitLibrary) return;

  const state = {
    db: null,
    definitions: {},
    grants: {},
    mounted: false,
    activeView: "library",
    rulesReady: false,
  };

  const field = (id) => doc.getElementById(id);
  const text = (value) => String(value ?? "");
  const timestamp = () => global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now();

  function rules() {
    return global.LuminousCharacterBuildRules || null;
  }

  function ensureScript(id, src, onReady) {
    if (doc.getElementById(id)) {
      if (onReady) onReady();
      return;
    }
    const script = doc.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    if (onReady) script.addEventListener("load", onReady, { once: true });
    doc.head?.appendChild(script);
  }

  function ensureRules() {
    if (rules()) {
      state.rulesReady = true;
      refreshSourceInputs();
      return;
    }
    ensureScript("character-build-rules-script", "js/character-build-rules.js", () => {
      state.rulesReady = Boolean(rules());
      refreshSourceInputs();
    });
  }

  function switchDashboardTab() {
    doc.querySelectorAll(".dm-tab-btn").forEach((button) => button.classList.remove("active"));
    doc.querySelectorAll(".dm-tab-pane").forEach((pane) => pane.classList.remove("active"));
    field("dm-tab-traits")?.classList.add("active");
    field("dashboard-traits")?.classList.add("active");
    field("dashboard-traits")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }

  function switchView(view) {
    state.activeView = view === "grants" ? "grants" : "library";
    field("dm-trait-view-library")?.classList.toggle("active", state.activeView === "library");
    field("dm-trait-view-grants")?.classList.toggle("active", state.activeView === "grants");
    field("dm-trait-library-view")?.toggleAttribute("hidden", state.activeView !== "library");
    field("dm-trait-grants-view")?.toggleAttribute("hidden", state.activeView !== "grants");
  }

  function staticMarkup() {
    return `
      <div class="panel-cyber dm-trait-studio-panel">
        <header class="dm-trait-studio-header">
          <div><span>RULESET / TRAITS</span><h3>TRAIT LIBRARY · GRANTS</h3></div>
          <div class="dm-trait-header-actions">
            <button id="dm-trait-create" class="btn-cyber" type="button">+ CREAR TRAIT</button>
          </div>
        </header>
        <nav class="dm-trait-subnav" aria-label="Trait Studio">
          <button id="dm-trait-view-library" class="active" type="button">BIBLIOTECA</button>
          <button id="dm-trait-view-grants" type="button">ASIGNACIONES / GRANTS</button>
        </nav>
        <div id="dm-trait-feedback" class="dm-trait-feedback" aria-live="polite"></div>

        <section id="dm-trait-library-view">
          <div class="dm-trait-toolbar">
            <input id="dm-trait-search" type="search" placeholder="Buscar Trait por nombre, ID o fuente..." />
            <span id="dm-trait-library-count">0 Traits</span>
          </div>
          <div id="dm-trait-library-grid" class="dm-trait-library-grid"></div>
        </section>

        <section id="dm-trait-grants-view" hidden>
          <div class="dm-trait-grant-editor">
            <h4>NUEVA ASIGNACIÓN</h4>
            <label><span>TRAIT</span><select id="dm-trait-grant-trait"><option value="">— Selecciona Trait —</option></select></label>
            <label><span>FUENTE</span><select id="dm-trait-grant-source-type">
              <option value="class">Class</option>
              <option value="race">Race</option>
              <option value="background">Background</option>
              <option value="lineage">Lineage</option>
            </select></label>
            <label id="dm-trait-grant-source-select-field"><span>CLASE / RAZA / TRASFONDO</span><select id="dm-trait-grant-source-id"></select></label>
            <label id="dm-trait-grant-lineage-field" hidden><span>LINEAGE ID</span><input id="dm-trait-grant-lineage-id" type="text" placeholder="devil_lineage" /></label>
            <label id="dm-trait-grant-level-field"><span>CLASS LEVEL</span><input id="dm-trait-grant-level" type="number" min="1" max="100" step="1" value="1" /></label>
            <button id="dm-trait-grant-save" class="btn-cyber" type="button">ASIGNAR TRAIT</button>
          </div>
          <div class="dm-trait-grants-column">
            <div class="dm-trait-toolbar"><strong>GRANTS ACTIVOS</strong><span id="dm-trait-grant-count">0</span></div>
            <div id="dm-trait-grant-list" class="dm-trait-grant-list"></div>
          </div>
        </section>
      </div>

      <div id="dm-trait-builder-modal" class="dm-trait-builder-modal" hidden>
        <div class="dm-trait-builder-shell">
          <header><div><span>TRAIT BUILDER</span><strong>NUEVA DEFINICIÓN</strong></div><button id="dm-trait-builder-close" type="button" aria-label="Cerrar">×</button></header>
          <iframe id="dm-trait-builder-frame" title="Trait Builder" src="about:blank"></iframe>
          <footer>
            <span id="dm-trait-builder-feedback"></span>
            <button id="dm-trait-builder-save" type="button">GUARDAR EN BIBLIOTECA</button>
          </footer>
        </div>
      </div>`;
  }

  function mount() {
    if (state.mounted || field("dashboard-traits")) return true;
    const nav = doc.querySelector(".dm-tabs-nav");
    const playersPane = field("dashboard-jugadores");
    if (!nav || !playersPane?.parentElement) return false;

    const button = doc.createElement("button");
    button.id = "dm-tab-traits";
    button.className = "dm-tab-btn";
    button.dataset.tab = "dashboard-traits";
    button.type = "button";
    button.textContent = "Traits";
    const keywordButton = nav.querySelector('[data-tab="tab-keywords"]');
    nav.insertBefore(button, keywordButton || nav.lastElementChild);

    const pane = doc.createElement("div");
    pane.id = "dashboard-traits";
    pane.className = "dm-tab-pane";
    pane.innerHTML = staticMarkup();
    playersPane.parentElement.insertBefore(pane, playersPane.nextSibling);

    button.addEventListener("click", switchDashboardTab);
    field("dm-trait-view-library")?.addEventListener("click", () => switchView("library"));
    field("dm-trait-view-grants")?.addEventListener("click", () => switchView("grants"));
    field("dm-trait-create")?.addEventListener("click", openBuilder);
    field("dm-trait-builder-close")?.addEventListener("click", closeBuilder);
    field("dm-trait-builder-save")?.addEventListener("click", saveFromBuilder);
    field("dm-trait-search")?.addEventListener("input", renderDefinitions);
    field("dm-trait-grant-source-type")?.addEventListener("change", refreshSourceInputs);
    field("dm-trait-grant-save")?.addEventListener("click", saveGrantFromForm);
    field("dm-trait-builder-modal")?.addEventListener("click", (event) => { if (event.target === field("dm-trait-builder-modal")) closeBuilder(); });

    state.mounted = true;
    ensureRules();
    switchView("library");
    renderDefinitions();
    renderGrants();
    return true;
  }

  function feedback(message, kind = "") {
    const node = field("dm-trait-feedback");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.kind = kind;
  }

  function sourceCatalog(type) {
    const api = rules();
    if (!api) return [];
    if (type === "class") return (api.CLASSES || []).map((entry) => ({ id: entry.id, label: `${entry.name} · ${entry.code || entry.id}` }));
    if (type === "race") return (api.RACES || []).map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
    if (type === "background") {
      const groups = typeof api.backgroundGroups === "function" ? api.backgroundGroups() : [];
      return groups.flatMap((group) => (group.entries || []).map((entry) => ({ id: entry.id, label: `${entry.name} · ${group.label}` })));
    }
    return [];
  }

  function sourceLabel(type, id) {
    if (type === "lineage") return id || "Lineage";
    return sourceCatalog(type).find((entry) => entry.id === id)?.label || id || "—";
  }

  function refreshSourceInputs() {
    const type = normalizeId(field("dm-trait-grant-source-type")?.value || "class");
    const selectField = field("dm-trait-grant-source-select-field");
    const lineageField = field("dm-trait-grant-lineage-field");
    const levelField = field("dm-trait-grant-level-field");
    const select = field("dm-trait-grant-source-id");
    if (selectField) selectField.hidden = type === "lineage";
    if (lineageField) lineageField.hidden = type !== "lineage";
    if (levelField) levelField.hidden = type !== "class";
    if (!select || type === "lineage") return;
    const previous = select.value;
    select.innerHTML = "";
    const entries = sourceCatalog(type);
    if (!entries.length) {
      const option = doc.createElement("option");
      option.value = "";
      option.textContent = "— Catálogo no disponible —";
      select.appendChild(option);
      return;
    }
    entries.forEach((entry) => {
      const option = doc.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      select.appendChild(option);
    });
    if (entries.some((entry) => entry.id === previous)) select.value = previous;
  }

  function traitGrantCount(traitId) {
    return grantsArray(state.grants).filter((grant) => grant.traitId === traitId).length;
  }

  function traitCard(id, definition) {
    const validation = engine.validateTrait(definition);
    const trait = validation.trait;
    const card = doc.createElement("article");
    card.className = "dm-trait-card";

    const heading = doc.createElement("header");
    const title = doc.createElement("div");
    const name = doc.createElement("strong");
    name.textContent = trait.name || id;
    const code = doc.createElement("small");
    code.textContent = trait.id;
    title.append(name, code);
    const badge = doc.createElement("span");
    badge.className = `dm-trait-validity ${validation.valid ? "is-valid" : "is-invalid"}`;
    badge.textContent = validation.valid ? "VALID" : "INVALID";
    heading.append(title, badge);

    const description = doc.createElement("p");
    description.textContent = trait.description || "Sin descripción.";

    const meta = doc.createElement("div");
    meta.className = "dm-trait-card-meta";
    const source = trait.source || {};
    [
      `Source: ${source.type || "special"}${source.id ? ` · ${source.id}` : ""}`,
      `Context: ${(trait.contexts || ["any"]).join(", ")}`,
      `Activation: ${trait.activation?.type || "passive"}`,
      `Grants: ${traitGrantCount(trait.id)}`,
    ].forEach((value) => {
      const span = doc.createElement("span");
      span.textContent = value;
      meta.appendChild(span);
    });

    const actions = doc.createElement("footer");
    const assign = doc.createElement("button");
    assign.type = "button";
    assign.textContent = "ASIGNAR";
    assign.addEventListener("click", () => {
      switchView("grants");
      const select = field("dm-trait-grant-trait");
      if (select) select.value = trait.id;
    });
    const remove = doc.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "ELIMINAR";
    remove.addEventListener("click", () => deleteDefinition(trait.id, trait.name));
    actions.append(assign, remove);

    card.append(heading, description, meta, actions);
    return card;
  }

  function renderDefinitions() {
    const grid = field("dm-trait-library-grid");
    const count = field("dm-trait-library-count");
    const traitSelect = field("dm-trait-grant-trait");
    if (!grid) return;
    const query = normalizeId(field("dm-trait-search")?.value || "");
    const entries = Object.entries(state.definitions || {})
      .map(([id, value]) => [id, value])
      .filter(([, value]) => {
        if (!query) return true;
        const searchable = normalizeId(`${value?.name || ""} ${value?.id || ""} ${value?.source?.type || ""} ${value?.source?.id || ""}`);
        return searchable.includes(query);
      })
      .sort((a, b) => text(a[1]?.name || a[0]).localeCompare(text(b[1]?.name || b[0])));

    grid.innerHTML = "";
    if (!entries.length) {
      const empty = doc.createElement("p");
      empty.className = "dm-trait-empty";
      empty.textContent = Object.keys(state.definitions || {}).length ? "No hay Traits que coincidan con la búsqueda." : "La biblioteca está vacía. Usa + CREAR TRAIT.";
      grid.appendChild(empty);
    } else entries.forEach(([id, definition]) => grid.appendChild(traitCard(id, definition)));
    if (count) count.textContent = `${Object.keys(state.definitions || {}).length} Traits`;

    if (traitSelect) {
      const previous = traitSelect.value;
      traitSelect.innerHTML = '<option value="">— Selecciona Trait —</option>';
      Object.entries(state.definitions || {})
        .sort((a, b) => text(a[1]?.name || a[0]).localeCompare(text(b[1]?.name || b[0])))
        .forEach(([id, definition]) => {
          const option = doc.createElement("option");
          option.value = normalizeId(definition?.id || id);
          option.textContent = definition?.name || id;
          traitSelect.appendChild(option);
        });
      if ([...traitSelect.options].some((option) => option.value === previous)) traitSelect.value = previous;
    }
  }

  function renderGrants() {
    const list = field("dm-trait-grant-list");
    const count = field("dm-trait-grant-count");
    if (!list) return;
    const grants = grantsArray(state.grants).sort((a, b) => {
      const sourceCompare = `${a.sourceType}:${sourceLabel(a.sourceType, a.sourceId)}`.localeCompare(`${b.sourceType}:${sourceLabel(b.sourceType, b.sourceId)}`);
      if (sourceCompare) return sourceCompare;
      return (a.atLevel || 0) - (b.atLevel || 0);
    });
    list.innerHTML = "";
    if (!grants.length) {
      const empty = doc.createElement("p");
      empty.className = "dm-trait-empty";
      empty.textContent = "No hay asignaciones todavía.";
      list.appendChild(empty);
    }
    grants.forEach((grant) => {
      const row = doc.createElement("article");
      row.className = "dm-trait-grant-row";
      const copy = doc.createElement("div");
      const traitName = state.definitions[grant.traitId]?.name || grant.traitId;
      const title = doc.createElement("strong");
      title.textContent = traitName;
      const detail = doc.createElement("span");
      detail.textContent = `${grant.sourceType.toUpperCase()} · ${sourceLabel(grant.sourceType, grant.sourceId)}${grant.sourceType === "class" ? ` · Level ${grant.atLevel}` : ""}`;
      copy.append(title, detail);
      const remove = doc.createElement("button");
      remove.type = "button";
      remove.textContent = "QUITAR";
      remove.addEventListener("click", () => deleteGrant(grant.id));
      row.append(copy, remove);
      list.appendChild(row);
    });
    if (count) count.textContent = String(grants.length);
    renderDefinitions();
  }

  async function saveDefinition(input) {
    if (!state.db) throw new Error("Trait Library is not connected to Firebase.");
    const validation = engine.validateTrait(input);
    if (!validation.valid) throw new Error(validation.errors.join(" · "));
    const trait = validation.trait;
    const payload = { ...trait, updatedAt: timestamp() };
    const existing = state.definitions[trait.id];
    if (!existing) payload.createdAt = timestamp();
    await state.db.ref(`${DEFINITIONS_ROOT}/${trait.id}`).set(payload);
    feedback(`Trait ${trait.name} guardado en la biblioteca.`, "success");
    return trait;
  }

  async function deleteDefinition(traitId, name) {
    if (!state.db || !traitId) return false;
    const related = Object.entries(state.grants || {}).filter(([, grant]) => normalizeId(grant?.traitId) === normalizeId(traitId));
    const warning = related.length ? ` También se eliminarán ${related.length} grant(s) asociados.` : "";
    if (!global.confirm?.(`¿Eliminar ${name || traitId} de la biblioteca?${warning}`)) return false;
    const updates = { [`definitions/${traitId}`]: null };
    related.forEach(([grantId]) => { updates[`grants/${grantId}`] = null; });
    await state.db.ref(TRAITS_ROOT).update(updates);
    feedback(`Trait ${name || traitId} eliminado.`, "success");
    return true;
  }

  function readGrantForm() {
    const sourceType = normalizeId(field("dm-trait-grant-source-type")?.value || "class");
    const sourceId = sourceType === "lineage"
      ? field("dm-trait-grant-lineage-id")?.value
      : field("dm-trait-grant-source-id")?.value;
    return normalizeGrant({
      traitId: field("dm-trait-grant-trait")?.value,
      sourceType,
      sourceId,
      atLevel: field("dm-trait-grant-level")?.value,
    });
  }

  async function saveGrantFromForm() {
    try {
      if (!state.db) throw new Error("Trait Library is not connected to Firebase.");
      const validation = validateGrant(readGrantForm());
      if (!validation.valid) throw new Error(validation.errors.join(" · "));
      const grant = validation.grant;
      if (!state.definitions[grant.traitId]) throw new Error("Selecciona un Trait existente de la biblioteca.");
      const duplicate = grantsArray(state.grants).find((entry) => grantIdentity(entry) === grantIdentity(grant));
      if (duplicate) throw new Error("Ese Trait ya está asignado a esa fuente con el mismo nivel.");
      const ref = state.db.ref(GRANTS_ROOT).push();
      await ref.set({ ...grant, createdAt: timestamp(), updatedAt: timestamp() });
      feedback(`Grant creado: ${state.definitions[grant.traitId]?.name || grant.traitId} → ${sourceLabel(grant.sourceType, grant.sourceId)}.`, "success");
    } catch (error) {
      console.error("No se pudo crear el Trait Grant:", error);
      feedback(error.message || "No se pudo crear el Grant.", "error");
    }
  }

  async function deleteGrant(grantId) {
    if (!state.db || !grantId) return false;
    if (!global.confirm?.("¿Quitar esta asignación de Trait?")) return false;
    await state.db.ref(`${GRANTS_ROOT}/${grantId}`).remove();
    feedback("Grant eliminado.", "success");
    return true;
  }

  function openBuilder() {
    const modal = field("dm-trait-builder-modal");
    const frame = field("dm-trait-builder-frame");
    const builderFeedback = field("dm-trait-builder-feedback");
    if (!modal || !frame) return;
    if (builderFeedback) builderFeedback.textContent = "";
    frame.src = `dm-trait-creator.html?embed=1&v=${Date.now()}`;
    modal.hidden = false;
  }

  function closeBuilder() {
    const modal = field("dm-trait-builder-modal");
    const frame = field("dm-trait-builder-frame");
    if (modal) modal.hidden = true;
    if (frame) frame.src = "about:blank";
  }

  async function saveFromBuilder() {
    const frame = field("dm-trait-builder-frame");
    const node = field("dm-trait-builder-feedback");
    try {
      const builder = frame?.contentWindow?.LuminousTraitBuilder;
      if (!builder?.readTrait) throw new Error("El Trait Builder todavía no está listo.");
      const trait = builder.readTrait();
      const validation = engine.validateTrait(trait);
      if (!validation.valid) throw new Error(validation.errors.join(" · "));
      if (node) node.textContent = "GUARDANDO...";
      await saveDefinition(validation.trait);
      if (node) node.textContent = "GUARDADO";
      closeBuilder();
      switchView("library");
    } catch (error) {
      console.error("No se pudo guardar el Trait desde el Builder:", error);
      if (node) node.textContent = error.message || "ERROR";
    }
  }

  function connectFirebase() {
    if (state.db) return true;
    if (!global.firebase?.database || !global.firebase?.apps?.length) return false;
    try {
      state.db = global.firebase.database();
      state.db.ref(DEFINITIONS_ROOT).on("value", (snapshot) => {
        state.definitions = snapshot.val() || {};
        renderDefinitions();
        renderGrants();
      });
      state.db.ref(GRANTS_ROOT).on("value", (snapshot) => {
        state.grants = snapshot.val() || {};
        renderGrants();
      });
      return true;
    } catch (error) {
      console.error("No se pudo conectar Trait Library a Firebase:", error);
      return false;
    }
  }

  function resolveForCharacter(character) {
    return engine.resolveTraitGrants(character || {}, Object.values(state.grants || {}), state.definitions || {});
  }

  function start() {
    if (!mount()) return false;
    if (connectFirebase()) return true;
    const retry = global.setInterval(() => {
      mount();
      if (connectFirebase()) global.clearInterval(retry);
    }, 250);
    return true;
  }

  const api = Object.freeze({
    ...exported,
    mount,
    open: switchDashboardTab,
    switchView,
    saveDefinition,
    deleteDefinition,
    saveGrant: async (grantInput) => {
      const validation = validateGrant(grantInput);
      if (!validation.valid) throw new Error(validation.errors.join(" · "));
      if (!state.db) throw new Error("Trait Library is not connected to Firebase.");
      const ref = state.db.ref(GRANTS_ROOT).push();
      await ref.set({ ...validation.grant, createdAt: timestamp(), updatedAt: timestamp() });
      return validation.grant;
    },
    deleteGrant,
    resolveForCharacter,
    getDefinitions: () => ({ ...state.definitions }),
    getGrants: () => grantsArray(state.grants),
  });

  global.LuminousDmTraitLibrary = api;
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(typeof window !== "undefined" ? window : globalThis);
