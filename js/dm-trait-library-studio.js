(function (global) {
  "use strict";

  const doc = global.document || null;
  const engine = global.LuminousTraitEngine || (typeof require === "function" ? require("./trait-engine.js") : null);
  const TRAITS_ROOT = "campaña/config/traits";
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
    if (sourceType === "class") {
      grant.atLevel = Math.max(1, Math.min(100, Number.parseInt(input.atLevel ?? input.level ?? 1, 10) || 1));
    }
    return grant;
  }

  function validateGrant(input = {}) {
    const grant = normalizeGrant(input);
    const errors = [];
    if (!SOURCE_TYPES.includes(grant.sourceType)) errors.push(`Unsupported grant source: ${grant.sourceType || "empty"}`);
    if (!grant.sourceId) errors.push("Grant requires sourceId.");
    if (!grant.traitId) errors.push("Grant requires traitId.");
    if (grant.sourceType === "class" && (!Number.isInteger(grant.atLevel) || grant.atLevel < 1 || grant.atLevel > 100)) {
      errors.push("Class grant requires atLevel from 1 to 100.");
    }
    return { valid: !errors.length, errors, grant };
  }

  function grantIdentity(input = {}) {
    const grant = normalizeGrant(input);
    return `${grant.sourceType}:${grant.sourceId}:${grant.traitId}:${grant.sourceType === "class" ? grant.atLevel : 0}`;
  }

  function grantsArray(value) {
    return Object.entries(value || {}).map(([id, grant]) => ({ id, ...normalizeGrant(grant) }));
  }

  const portableApi = Object.freeze({
    TRAITS_ROOT,
    DEFINITIONS_ROOT,
    GRANTS_ROOT,
    SOURCE_TYPES,
    normalizeGrant,
    validateGrant,
    grantIdentity,
    grantsArray,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = portableApi;
  if (!doc || !engine || global.LuminousDmTraitLibrary) return;

  const state = {
    db: null,
    definitions: {},
    grants: {},
    mounted: false,
  };

  const $ = (id) => doc.getElementById(id);
  const now = () => global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now();
  const rules = () => global.LuminousCharacterBuildRules || null;

  function setFeedback(message, kind = "") {
    const node = $("dm-trait-feedback");
    if (!node) return;
    node.textContent = message || "";
    node.dataset.kind = kind;
  }

  function ensureBuildRules() {
    if (rules() || $("character-build-rules-script")) return;
    const script = doc.createElement("script");
    script.id = "character-build-rules-script";
    script.src = "js/character-build-rules.js";
    script.async = false;
    script.addEventListener("load", () => {
      renderSourceSelect();
      renderGrants();
    }, { once: true });
    doc.head?.appendChild(script);
  }

  function activateTab() {
    doc.querySelectorAll(".dm-tab-btn").forEach((node) => node.classList.remove("active"));
    doc.querySelectorAll(".dm-tab-pane").forEach((node) => node.classList.remove("active"));
    $("dm-tab-traits")?.classList.add("active");
    $("dashboard-traits")?.classList.add("active");
  }

  function setView(name) {
    const grants = name === "grants";
    $("dm-trait-view-library")?.classList.toggle("active", !grants);
    $("dm-trait-view-grants")?.classList.toggle("active", grants);
    if ($("dm-trait-library-view")) $("dm-trait-library-view").hidden = grants;
    if ($("dm-trait-grants-view")) $("dm-trait-grants-view").hidden = !grants;
  }

  function markup() {
    return `
      <div class="panel-cyber dm-trait-studio-panel">
        <header class="dm-trait-studio-header">
          <div><span>RULESET / TRAITS</span><h3>TRAIT LIBRARY · GRANTS</h3></div>
          <button id="dm-trait-create" class="btn-cyber" type="button">+ CREAR TRAIT</button>
        </header>
        <nav class="dm-trait-subnav">
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
            <label id="dm-trait-grant-source-select-field"><span>ORIGEN</span><select id="dm-trait-grant-source-id"></select></label>
            <label id="dm-trait-grant-lineage-field" hidden><span>LINEAGE ID</span><input id="dm-trait-grant-lineage-id" type="text" placeholder="devil_lineage" /></label>
            <label id="dm-trait-grant-level-field"><span>CLASS LEVEL</span><input id="dm-trait-grant-level" type="number" min="1" max="100" value="1" /></label>
            <button id="dm-trait-grant-save" type="button">ASIGNAR TRAIT</button>
          </div>
          <div class="dm-trait-grants-column">
            <div class="dm-trait-toolbar"><strong>GRANTS ACTIVOS</strong><span id="dm-trait-grant-count">0</span></div>
            <div id="dm-trait-grant-list" class="dm-trait-grant-list"></div>
          </div>
        </section>
      </div>

      <div id="dm-trait-builder-modal" class="dm-trait-builder-modal" hidden>
        <div class="dm-trait-builder-shell">
          <header><div><span>TRAIT BUILDER</span><strong>NUEVA DEFINICIÓN</strong></div><button id="dm-trait-builder-close" type="button">×</button></header>
          <iframe id="dm-trait-builder-frame" title="Trait Builder" src="about:blank"></iframe>
          <footer><span id="dm-trait-builder-feedback"></span><button id="dm-trait-builder-save" type="button">GUARDAR EN BIBLIOTECA</button></footer>
        </div>
      </div>`;
  }

  function mount() {
    if (state.mounted) return true;
    const nav = doc.querySelector(".dm-tabs-nav");
    const players = $("dashboard-jugadores");
    if (!nav || !players?.parentElement) return false;

    if (!$("dm-tab-traits")) {
      const tab = doc.createElement("button");
      tab.id = "dm-tab-traits";
      tab.type = "button";
      tab.className = "dm-tab-btn";
      tab.dataset.tab = "dashboard-traits";
      tab.textContent = "Traits";
      nav.insertBefore(tab, nav.querySelector('[data-tab="tab-keywords"]') || nav.lastElementChild);
      tab.addEventListener("click", activateTab);
    }

    if (!$("dashboard-traits")) {
      const pane = doc.createElement("div");
      pane.id = "dashboard-traits";
      pane.className = "dm-tab-pane";
      pane.innerHTML = markup();
      players.parentElement.insertBefore(pane, players.nextSibling);
    }

    $("dm-trait-view-library")?.addEventListener("click", () => setView("library"));
    $("dm-trait-view-grants")?.addEventListener("click", () => setView("grants"));
    $("dm-trait-create")?.addEventListener("click", openBuilder);
    $("dm-trait-builder-close")?.addEventListener("click", closeBuilder);
    $("dm-trait-builder-save")?.addEventListener("click", saveBuilderTrait);
    $("dm-trait-search")?.addEventListener("input", renderDefinitions);
    $("dm-trait-grant-source-type")?.addEventListener("change", renderSourceSelect);
    $("dm-trait-grant-save")?.addEventListener("click", saveGrantForm);
    $("dm-trait-builder-modal")?.addEventListener("click", (event) => {
      if (event.target === $("dm-trait-builder-modal")) closeBuilder();
    });

    state.mounted = true;
    ensureBuildRules();
    renderSourceSelect();
    renderDefinitions();
    renderGrants();
    return true;
  }

  function sourceCatalog(type) {
    const api = rules();
    if (!api) return [];
    if (type === "class") return (api.CLASSES || []).map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
    if (type === "race") return (api.RACES || []).map((entry) => ({ id: entry.id, label: entry.name || entry.id }));
    if (type === "background") {
      return (typeof api.backgroundGroups === "function" ? api.backgroundGroups() : [])
        .flatMap((group) => (group.entries || []).map((entry) => ({ id: entry.id, label: `${entry.name} · ${group.label}` })));
    }
    return [];
  }

  function sourceLabel(type, id) {
    if (type === "lineage") return id || "Lineage";
    return sourceCatalog(type).find((entry) => entry.id === id)?.label || id || "—";
  }

  function renderSourceSelect() {
    const type = normalizeId($("dm-trait-grant-source-type")?.value || "class");
    if ($("dm-trait-grant-source-select-field")) $("dm-trait-grant-source-select-field").hidden = type === "lineage";
    if ($("dm-trait-grant-lineage-field")) $("dm-trait-grant-lineage-field").hidden = type !== "lineage";
    if ($("dm-trait-grant-level-field")) $("dm-trait-grant-level-field").hidden = type !== "class";
    const select = $("dm-trait-grant-source-id");
    if (!select || type === "lineage") return;
    const previous = select.value;
    select.innerHTML = "";
    const entries = sourceCatalog(type);
    (entries.length ? entries : [{ id: "", label: "— Catálogo no disponible —" }]).forEach((entry) => {
      const option = doc.createElement("option");
      option.value = entry.id;
      option.textContent = entry.label;
      select.appendChild(option);
    });
    if (entries.some((entry) => entry.id === previous)) select.value = previous;
  }

  function allGrants() {
    return grantsArray(state.grants);
  }

  function renderTraitOptions() {
    const select = $("dm-trait-grant-trait");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">— Selecciona Trait —</option>';
    Object.entries(state.definitions)
      .sort((a, b) => String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0])))
      .forEach(([key, definition]) => {
        const option = doc.createElement("option");
        option.value = normalizeId(definition?.id || key);
        option.textContent = definition?.name || key;
        select.appendChild(option);
      });
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }

  function renderDefinitions() {
    const grid = $("dm-trait-library-grid");
    if (!grid) return;
    const query = normalizeId($("dm-trait-search")?.value || "");
    const entries = Object.entries(state.definitions)
      .filter(([key, definition]) => !query || normalizeId(`${key} ${definition?.name || ""} ${definition?.source?.type || ""} ${definition?.source?.id || ""}`).includes(query))
      .sort((a, b) => String(a[1]?.name || a[0]).localeCompare(String(b[1]?.name || b[0])));

    grid.innerHTML = "";
    if (!entries.length) {
      const empty = doc.createElement("p");
      empty.className = "dm-trait-empty";
      empty.textContent = Object.keys(state.definitions).length ? "No hay resultados." : "La biblioteca está vacía. Usa + CREAR TRAIT.";
      grid.appendChild(empty);
    }

    entries.forEach(([key, definition]) => {
      const validation = engine.validateTrait(definition);
      const trait = validation.trait;
      const card = doc.createElement("article");
      card.className = "dm-trait-card";

      const header = doc.createElement("header");
      const title = doc.createElement("div");
      const strong = doc.createElement("strong");
      strong.textContent = trait.name || key;
      const small = doc.createElement("small");
      small.textContent = trait.id || key;
      title.append(strong, small);
      const validity = doc.createElement("span");
      validity.className = `dm-trait-validity ${validation.valid ? "is-valid" : "is-invalid"}`;
      validity.textContent = validation.valid ? "VALID" : "INVALID";
      header.append(title, validity);

      const description = doc.createElement("p");
      description.textContent = trait.description || "Sin descripción.";
      const meta = doc.createElement("div");
      meta.className = "dm-trait-card-meta";
      const grantCount = allGrants().filter((grant) => grant.traitId === trait.id).length;
      [`Source: ${trait.source?.type || "special"}${trait.source?.id ? ` · ${trait.source.id}` : ""}`, `Context: ${(trait.contexts || ["any"]).join(", ")}`, `Activation: ${trait.activation?.type || "passive"}`, `Grants: ${grantCount}`]
        .forEach((value) => {
          const line = doc.createElement("span");
          line.textContent = value;
          meta.appendChild(line);
        });

      const footer = doc.createElement("footer");
      const assign = doc.createElement("button");
      assign.type = "button";
      assign.textContent = "ASIGNAR";
      assign.addEventListener("click", () => {
        setView("grants");
        if ($("dm-trait-grant-trait")) $("dm-trait-grant-trait").value = trait.id;
      });
      const remove = doc.createElement("button");
      remove.type = "button";
      remove.className = "danger";
      remove.textContent = "ELIMINAR";
      remove.addEventListener("click", () => deleteTrait(trait.id, trait.name));
      footer.append(assign, remove);
      card.append(header, description, meta, footer);
      grid.appendChild(card);
    });

    if ($("dm-trait-library-count")) $("dm-trait-library-count").textContent = `${Object.keys(state.definitions).length} Traits`;
    renderTraitOptions();
  }

  function renderGrants() {
    const list = $("dm-trait-grant-list");
    if (!list) return;
    const grants = allGrants().sort((a, b) => `${a.sourceType}:${a.sourceId}:${a.atLevel || 0}`.localeCompare(`${b.sourceType}:${b.sourceId}:${b.atLevel || 0}`));
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
      const strong = doc.createElement("strong");
      strong.textContent = state.definitions[grant.traitId]?.name || grant.traitId;
      const detail = doc.createElement("span");
      detail.textContent = `${grant.sourceType.toUpperCase()} · ${sourceLabel(grant.sourceType, grant.sourceId)}${grant.sourceType === "class" ? ` · Level ${grant.atLevel}` : ""}`;
      copy.append(strong, detail);
      const remove = doc.createElement("button");
      remove.type = "button";
      remove.textContent = "QUITAR";
      remove.addEventListener("click", () => deleteGrant(grant.id));
      row.append(copy, remove);
      list.appendChild(row);
    });
    if ($("dm-trait-grant-count")) $("dm-trait-grant-count").textContent = String(grants.length);
    renderDefinitions();
  }

  async function saveDefinition(input) {
    if (!state.db) throw new Error("Trait Library no está conectada a Firebase.");
    const validation = engine.validateTrait(input);
    if (!validation.valid) throw new Error(validation.errors.join(" · "));
    const trait = validation.trait;
    const previous = state.definitions[trait.id];
    const payload = { ...trait, updatedAt: now() };
    if (!previous) payload.createdAt = now();
    await state.db.ref(`${DEFINITIONS_ROOT}/${trait.id}`).set(payload);
    setFeedback(`${trait.name} guardado en la biblioteca.`, "success");
    return trait;
  }

  async function deleteTrait(traitId, name) {
    if (!state.db || !traitId) return;
    const related = Object.entries(state.grants).filter(([, grant]) => normalizeId(grant?.traitId) === traitId);
    if (!global.confirm?.(`¿Eliminar ${name || traitId}?${related.length ? ` También se quitarán ${related.length} grants.` : ""}`)) return;
    const updates = { [`definitions/${traitId}`]: null };
    related.forEach(([id]) => { updates[`grants/${id}`] = null; });
    await state.db.ref(TRAITS_ROOT).update(updates);
    setFeedback(`${name || traitId} eliminado.`, "success");
  }

  function readGrantForm() {
    const sourceType = normalizeId($("dm-trait-grant-source-type")?.value || "class");
    return normalizeGrant({
      traitId: $("dm-trait-grant-trait")?.value,
      sourceType,
      sourceId: sourceType === "lineage" ? $("dm-trait-grant-lineage-id")?.value : $("dm-trait-grant-source-id")?.value,
      atLevel: $("dm-trait-grant-level")?.value,
    });
  }

  async function saveGrantForm() {
    try {
      if (!state.db) throw new Error("Trait Library no está conectada a Firebase.");
      const validation = validateGrant(readGrantForm());
      if (!validation.valid) throw new Error(validation.errors.join(" · "));
      const grant = validation.grant;
      if (!state.definitions[grant.traitId]) throw new Error("Selecciona un Trait existente.");
      if (allGrants().some((entry) => grantIdentity(entry) === grantIdentity(grant))) throw new Error("Ese Grant ya existe.");
      await state.db.ref(GRANTS_ROOT).push().set({ ...grant, createdAt: now(), updatedAt: now() });
      setFeedback(`Asignado: ${state.definitions[grant.traitId].name || grant.traitId} → ${sourceLabel(grant.sourceType, grant.sourceId)}.`, "success");
    } catch (error) {
      console.error("Trait Grant:", error);
      setFeedback(error.message || "No se pudo asignar el Trait.", "error");
    }
  }

  async function deleteGrant(grantId) {
    if (!state.db || !grantId || !global.confirm?.("¿Quitar esta asignación?")) return;
    await state.db.ref(`${GRANTS_ROOT}/${grantId}`).remove();
    setFeedback("Grant eliminado.", "success");
  }

  function openBuilder() {
    const modal = $("dm-trait-builder-modal");
    const frame = $("dm-trait-builder-frame");
    if (!modal || !frame) return;
    if ($("dm-trait-builder-feedback")) $("dm-trait-builder-feedback").textContent = "";
    frame.src = `dm-trait-creator.html?embed=1&v=${Date.now()}`;
    modal.hidden = false;
  }

  function closeBuilder() {
    if ($("dm-trait-builder-modal")) $("dm-trait-builder-modal").hidden = true;
    if ($("dm-trait-builder-frame")) $("dm-trait-builder-frame").src = "about:blank";
  }

  async function saveBuilderTrait() {
    const frame = $("dm-trait-builder-frame");
    const message = $("dm-trait-builder-feedback");
    try {
      const builder = frame?.contentWindow?.LuminousTraitBuilder;
      if (!builder?.readTrait) throw new Error("El Trait Builder todavía no está listo.");
      if (message) message.textContent = "GUARDANDO...";
      await saveDefinition(builder.readTrait());
      closeBuilder();
      setView("library");
    } catch (error) {
      if (message) message.textContent = error.message || "ERROR";
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
      });
      state.db.ref(GRANTS_ROOT).on("value", (snapshot) => {
        state.grants = snapshot.val() || {};
        renderGrants();
      });
      return true;
    } catch (error) {
      console.error("Trait Library Firebase:", error);
      return false;
    }
  }

  function resolveForCharacter(character) {
    return engine.resolveTraitGrants(character || {}, Object.values(state.grants), state.definitions);
  }

  function start() {
    if (!mount()) return;
    if (connectFirebase()) return;
    const retry = global.setInterval(() => {
      mount();
      if (connectFirebase()) global.clearInterval(retry);
    }, 250);
  }

  global.LuminousDmTraitLibrary = Object.freeze({
    ...portableApi,
    mount,
    open: activateTab,
    saveDefinition,
    resolveForCharacter,
    getDefinitions: () => ({ ...state.definitions }),
    getGrants: () => allGrants(),
  });

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(typeof window !== "undefined" ? window : globalThis);
