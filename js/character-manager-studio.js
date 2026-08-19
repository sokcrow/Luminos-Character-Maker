(function (global) {
  "use strict";

  const doc = global.document;
  const manager = global.LuminousCharacterManager;
  if (!doc || !manager) return;

  const state = {
    actorId: null,
    root: null,
    activeSection: "identity",
    snapshot: { actors: {}, players: {}, languages: {}, actorSources: {} },
    unsubscribe: null,
  };

  const $ = (id) => doc.getElementById(id);
  const value = (id) => $(id)?.value ?? "";

  const ICONS = Object.freeze({
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5"/><path d="M19 12a7 7 0 1 0-2 5"/></svg>',
    save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
    identity: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20c.6-4.2 2.7-6.3 6.5-6.3s5.9 2.1 6.5 6.3"/></svg>',
    link: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 14.5 7 17a3.5 3.5 0 0 1-5-5l3-3a3.5 3.5 0 0 1 5 0"/><path d="m14.5 9.5 2.5-2.5a3.5 3.5 0 0 1 5 5l-3 3a3.5 3.5 0 0 1-5 0"/><path d="m8.5 15.5 7-7"/></svg>',
    expression: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><circle cx="9" cy="10" r="1"/><circle cx="15" cy="10" r="1"/><path d="M8 15c1.2 1 2.5 1.5 4 1.5s2.8-.5 4-1.5"/></svg>',
    language: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 4.5 6 4.5 9S15 18 12 21M12 3c-3 3-4.5 6-4.5 9S9 18 12 21"/></svg>',
    advanced: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
    distortion: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c-4 2.5-6 5.4-6 8.8 0 4 2.7 7.2 6 9.2 3.3-2 6-5.2 6-9.2C18 8.4 16 5.5 12 3Z"/><path d="M9 11c.8-.8 1.8-1.2 3-1.2s2.2.4 3 1.2M10 15h4"/></svg>',
    image: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4z"/><circle cx="9" cy="10" r="1.5"/><path d="m5 17 5-5 3 3 2-2 4 4"/></svg>',
  });

  function icon(name) {
    return ICONS[name] || ICONS.identity;
  }

  function iconButton(id, iconName, label, className = "", text = "") {
    return `<button id="${id}" class="cm-icon-button ${className}" type="button" aria-label="${label}" title="${label}">${icon(iconName)}${text ? `<span>${text}</span>` : ""}</button>`;
  }

  function mountPoint() {
    return doc.getElementById("dashboard-actores")
      || doc.getElementById("theatre-director-panel")
      || null;
  }

  function languageLabel(languageId, language) {
    return String(language?.nombre || language?.name || language?.label || languageId);
  }

  function playerLabel(playerId, player) {
    return String(player?.characterName || player?.character_name || player?.nombre || player?.name || playerId);
  }

  function expressionSprite(entry) {
    if (typeof entry === "string") return entry;
    return entry?.sprite || entry?.url || entry?.imagen || "";
  }

  function knowledgeEntry(source, languageId) {
    return manager.normalizeLanguageEntry(source?.[languageId]);
  }

  function currentActor() {
    return state.actorId ? manager.getActor(state.actorId) : null;
  }

  function currentPlayerId(actorRecord) {
    return value("character-manager-player") || actorRecord?.playerId || null;
  }

  function currentLanguageSource(actorRecord) {
    const playerId = currentPlayerId(actorRecord);
    if (playerId && state.snapshot.players[playerId]) {
      const player = state.snapshot.players[playerId];
      return player.idiomas || player.lenguajes || player.languages || player.conocimiento_idiomas || player.languageKnowledge || {};
    }
    return actorRecord?.actor?.idiomas || actorRecord?.actor?.languages || {};
  }

  function createPanel() {
    const host = mountPoint();
    if (!host || $("character-manager-studio")) return null;

    const panel = doc.createElement("section");
    panel.id = "character-manager-studio";
    panel.className = "character-manager-studio";
    panel.innerHTML = `
      <header class="cm-command-header">
        <div class="cm-brand-block">
          <span class="cm-kicker">ACTOR DATABASE</span>
          <h3>CHARACTER MANAGER</h3>
        </div>
        <div class="cm-header-state">
          <span class="cm-live-indicator"><i></i>LIVE</span>
          <span id="character-manager-status" class="cm-status">SYNC</span>
        </div>
      </header>

      <div class="cm-shell">
        <aside class="cm-roster-panel">
          <div class="cm-search-box">${icon("search")}<input id="character-manager-search" type="search" placeholder="Buscar" aria-label="Buscar actor o jugador" autocomplete="off"></div>
          <div class="cm-roster-heading"><span>ROSTER</span><code id="character-manager-count">0</code></div>
          <div id="character-manager-roster" class="cm-roster" role="listbox" aria-label="Actores persistentes"></div>
          <div class="cm-roster-actions">
            ${iconButton("character-manager-new", "plus", "Nuevo actor")}
            ${iconButton("character-manager-refresh", "refresh", "Recargar roster")}
          </div>
        </aside>

        <main class="cm-workbench">
          <section class="cm-actor-plate" aria-label="Actor seleccionado">
            <div class="cm-portrait-frame">
              <img id="character-manager-preview-image" alt="" hidden>
              <span id="character-manager-preview-fallback">CM</span>
            </div>
            <div class="cm-actor-identity">
              <span id="character-manager-preview-kind" class="cm-kind-tag">NPC</span>
              <strong id="character-manager-preview-name">NUEVO ACTOR</strong>
              <span id="character-manager-preview-title">SIN TÍTULO</span>
            </div>
            <div class="cm-actor-source"><span>SOURCE</span><code id="character-manager-source">BASE</code></div>
          </section>

          <nav class="cm-module-nav" aria-label="Módulos del actor">
            <button type="button" class="cm-module-tab is-active" data-section="identity" aria-label="Identidad" title="Identidad">${icon("identity")}<span>IDENTIDAD</span></button>
            <button type="button" class="cm-module-tab" data-section="assignment" aria-label="Asignación" title="Asignación">${icon("link")}<span>VÍNCULO</span></button>
            <button type="button" class="cm-module-tab" data-section="expressions" aria-label="Expresiones" title="Expresiones">${icon("expression")}<span>EXPRESIONES</span></button>
            <button type="button" class="cm-module-tab" data-section="languages" aria-label="Idiomas" title="Idiomas">${icon("language")}<span>IDIOMAS</span></button>
            <button type="button" class="cm-module-tab" data-section="advanced" aria-label="Configuración avanzada" title="Configuración avanzada">${icon("advanced")}<span>AJUSTES</span></button>
          </nav>

          <div class="cm-module-stack">
            <section class="cm-module is-active" data-module="identity">
              <header><span>IDENTIDAD</span><small>01</small></header>
              <div class="cm-field-grid">
                <label class="cm-field"><span>NOMBRE</span><input id="character-manager-name" type="text" autocomplete="off"></label>
                <label class="cm-field"><span>TÍTULO</span><input id="character-manager-title" type="text" autocomplete="off"></label>
              </div>
            </section>

            <section class="cm-module" data-module="assignment">
              <header><span>VÍNCULO</span><small>02</small></header>
              <div class="cm-field-grid cm-field-grid--three">
                <label class="cm-field"><span>TIPO</span><select id="character-manager-type"><option value="NPC">NPC</option><option value="Jugador">Jugador</option><option value="Aliado">Aliado</option><option value="Enemigo">Enemigo</option><option value="Neutral">Neutral</option></select></label>
                <label class="cm-field"><span>JUGADOR</span><select id="character-manager-player"><option value="">SIN ASIGNAR</option></select></label>
                <label class="cm-field"><span>FACCIÓN</span><input id="character-manager-faction" type="text" autocomplete="off"></label>
              </div>
            </section>

            <section class="cm-module" data-module="expressions">
              <header><span>EXPRESIONES</span><small id="character-manager-expression-count">00</small></header>
              <div id="character-manager-expressions" class="cm-expression-grid"></div>
              <div class="cm-inline-actions">${iconButton("character-manager-add-expression", "plus", "Agregar expresión", "cm-compact-action", "NUEVA")}</div>
            </section>

            <section class="cm-module" data-module="languages">
              <header><span>IDIOMAS</span><small id="character-manager-language-count">00</small></header>
              <div id="character-manager-language-target" class="cm-language-target"></div>
              <div id="character-manager-languages" class="cm-language-list"></div>
            </section>

            <section class="cm-module" data-module="advanced">
              <header><span>AJUSTES</span><small>05</small></header>
              <div class="cm-field-grid cm-field-grid--three">
                <label class="cm-field"><span>ESCALA</span><input id="character-manager-scale" type="number" min="0.25" max="3" step="0.05" value="1"></label>
                <label class="cm-field cm-color-field"><span>COLOR NOMBRE</span><input id="character-manager-name-color" type="color" value="#ffffff"></label>
                <label class="cm-field cm-color-field"><span>COLOR TÍTULO</span><input id="character-manager-title-color" type="color" value="#c49a00"></label>
                <label class="cm-field cm-wide"><span>ICONO</span><div class="cm-input-with-icon">${icon("image")}<input id="character-manager-icon" type="url" placeholder="URL"></div></label>
                <label class="cm-field cm-wide"><span>SPRITE BASE</span><div class="cm-input-with-icon">${icon("image")}<input id="character-manager-sprite" type="url" placeholder="URL"></div></label>
              </div>
            </section>
          </div>

          <footer class="cm-command-footer">
            <p id="character-manager-feedback" class="cm-feedback" aria-live="polite"></p>
            <div class="cm-command-actions">
              ${iconButton("character-manager-delete", "trash", "Eliminar actor", "cm-danger-action")}
              ${iconButton("character-manager-save", "save", "Guardar actor", "cm-save-action", "GUARDAR")}
            </div>
          </footer>
        </main>
      </div>
    `;

    host.prepend(panel);
    bindPanel();
    return panel;
  }

  function initials(name) {
    const words = String(name || "CM").trim().split(/\s+/).filter(Boolean);
    return (words.slice(0, 2).map((word) => word[0]).join("") || "CM").toUpperCase();
  }

  function updatePreview() {
    const record = currentActor();
    const actor = record?.actor || {};
    const name = value("character-manager-name").trim() || actor.nombre || "NUEVO ACTOR";
    const title = value("character-manager-title").trim() || actor.titulo || "SIN TÍTULO";
    const kind = value("character-manager-type") || actor.tipo || "NPC";
    const imageUrl = value("character-manager-icon").trim() || actor.icono || value("character-manager-sprite").trim() || actor.sprite || "";
    const image = $("character-manager-preview-image");
    const fallback = $("character-manager-preview-fallback");

    $("character-manager-preview-name").textContent = name;
    $("character-manager-preview-title").textContent = title;
    $("character-manager-preview-kind").textContent = kind.toUpperCase();
    fallback.textContent = initials(name);

    if (imageUrl) {
      image.src = imageUrl;
      image.hidden = false;
      fallback.hidden = true;
      image.onerror = () => {
        image.hidden = true;
        fallback.hidden = false;
      };
    } else {
      image.removeAttribute("src");
      image.hidden = true;
      fallback.hidden = false;
    }
  }

  function setSection(section) {
    state.activeSection = section;
    doc.querySelectorAll("#character-manager-studio .cm-module-tab").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.section === section);
    });
    doc.querySelectorAll("#character-manager-studio .cm-module").forEach((module) => {
      module.classList.toggle("is-active", module.dataset.module === section);
    });
  }

  function expressionRow(name = "", sprite = "") {
    const row = doc.createElement("article");
    row.className = "cm-expression-card";
    row.innerHTML = `
      <div class="cm-expression-preview"><img alt="" hidden><span>${icon("expression")}</span></div>
      <div class="cm-expression-fields">
        <input class="cm-expression-name" type="text" placeholder="NOMBRE" aria-label="Nombre de expresión">
        <input class="cm-expression-sprite" type="url" placeholder="URL DEL SPRITE" aria-label="URL del sprite de expresión">
      </div>
      ${iconButton("", "close", "Quitar expresión", "cm-expression-remove")}
    `;
    const nameInput = row.querySelector(".cm-expression-name");
    const spriteInput = row.querySelector(".cm-expression-sprite");
    const image = row.querySelector("img");
    const fallback = row.querySelector(".cm-expression-preview span");
    nameInput.value = name;
    spriteInput.value = sprite;

    const refreshPreview = () => {
      const url = spriteInput.value.trim();
      if (!url) {
        image.hidden = true;
        fallback.hidden = false;
        return;
      }
      image.src = url;
      image.hidden = false;
      fallback.hidden = true;
      image.onerror = () => {
        image.hidden = true;
        fallback.hidden = false;
      };
    };

    spriteInput.addEventListener("input", refreshPreview);
    row.querySelector(".cm-expression-remove").addEventListener("click", () => {
      row.remove();
      updateExpressionCount();
    });
    refreshPreview();
    return row;
  }

  function updateExpressionCount() {
    const count = doc.querySelectorAll("#character-manager-expressions .cm-expression-card").length;
    const node = $("character-manager-expression-count");
    if (node) node.textContent = String(count).padStart(2, "0");
  }

  function renderExpressions(expressions = {}) {
    const host = $("character-manager-expressions");
    if (!host) return;
    host.innerHTML = "";
    const entries = Object.entries(expressions || {});
    if (!entries.length) entries.push(["Neutral", ""]);
    entries.forEach(([name, entry]) => host.appendChild(expressionRow(name, expressionSprite(entry))));
    updateExpressionCount();
  }

  function collectExpressions() {
    const expressions = {};
    doc.querySelectorAll("#character-manager-expressions .cm-expression-card").forEach((row) => {
      const name = row.querySelector(".cm-expression-name")?.value.trim();
      const sprite = row.querySelector(".cm-expression-sprite")?.value.trim();
      if (name && sprite) expressions[name] = sprite;
    });
    return expressions;
  }

  function renderLanguages(actorRecord) {
    const host = $("character-manager-languages");
    if (!host) return;
    host.innerHTML = "";

    const playerId = currentPlayerId(actorRecord);
    const source = currentLanguageSource(actorRecord);
    const target = $("character-manager-language-target");
    if (target) {
      target.textContent = playerId
        ? `PJ / ${playerLabel(playerId, state.snapshot.players[playerId])}`
        : "ACTOR / PERFIL LOCAL";
    }

    const languages = Object.entries(state.snapshot.languages || {})
      .sort((a, b) => languageLabel(a[0], a[1]).localeCompare(languageLabel(b[0], b[1])));

    const countNode = $("character-manager-language-count");
    if (countNode) countNode.textContent = String(languages.length).padStart(2, "0");

    if (!languages.length) {
      const empty = doc.createElement("div");
      empty.className = "cm-empty-state";
      empty.textContent = "SIN IDIOMAS CONFIGURADOS";
      host.appendChild(empty);
      return;
    }

    languages.forEach(([languageId, language]) => {
      const knowledge = knowledgeEntry(source, languageId);
      const row = doc.createElement("div");
      row.className = "cm-language-row";
      row.dataset.languageId = languageId;
      row.innerHTML = `
        <div class="cm-language-name"><strong></strong><code></code></div>
        <div class="cm-language-meter">
          <input class="cm-language-range" type="range" min="0" max="100" step="1" aria-label="Nivel de comprensión">
          <div class="cm-language-value"><input class="cm-language-percent" type="number" min="0" max="100" step="1" aria-label="Porcentaje de comprensión"><span>%</span></div>
        </div>
        <label class="cm-distortion-toggle" title="Comprende distorsión">${icon("distortion")}<input type="checkbox" aria-label="Comprende distorsión"><span></span></label>
      `;
      row.querySelector("strong").textContent = languageLabel(languageId, language);
      row.querySelector("code").textContent = languageId;
      const range = row.querySelector(".cm-language-range");
      const percent = row.querySelector(".cm-language-percent");
      const checkbox = row.querySelector(".cm-distortion-toggle input");
      range.value = knowledge.porcentaje;
      percent.value = knowledge.porcentaje;
      checkbox.checked = knowledge.comprendido;
      range.addEventListener("input", () => { percent.value = range.value; });
      percent.addEventListener("input", () => {
        const numeric = Math.max(0, Math.min(100, Number(percent.value) || 0));
        percent.value = numeric;
        range.value = numeric;
      });
      host.appendChild(row);
    });
  }

  function collectLanguages() {
    const idiomas = {};
    doc.querySelectorAll("#character-manager-languages .cm-language-row").forEach((row) => {
      const languageId = row.dataset.languageId;
      const porcentaje = Number(row.querySelector(".cm-language-percent")?.value) || 0;
      const comprendido = Boolean(row.querySelector(".cm-distortion-toggle input")?.checked);
      idiomas[languageId] = { porcentaje, comprendido };
    });
    return idiomas;
  }

  function renderPlayerOptions(selected = "") {
    const select = $("character-manager-player");
    if (!select) return;
    select.innerHTML = '<option value="">SIN ASIGNAR</option>';
    Object.entries(state.snapshot.players || {})
      .sort((a, b) => playerLabel(a[0], a[1]).localeCompare(playerLabel(b[0], b[1])))
      .forEach(([playerId, player]) => {
        const option = doc.createElement("option");
        option.value = playerId;
        option.textContent = playerLabel(playerId, player);
        select.appendChild(option);
      });
    select.value = selected && state.snapshot.players[selected] ? selected : "";
  }

  function rosterPortrait(record) {
    return record.actor?.icono || record.actor?.sprite || "";
  }

  function renderActorList() {
    const roster = $("character-manager-roster");
    if (!roster) return;
    const filter = value("character-manager-search").trim().toLowerCase();
    roster.innerHTML = "";

    const records = manager.listActors()
      .sort((a, b) => String(a.actor?.nombre || a.actorId).localeCompare(String(b.actor?.nombre || b.actorId)))
      .filter((record) => {
        const playerName = record.playerId ? playerLabel(record.playerId, state.snapshot.players[record.playerId]) : "";
        const haystack = `${record.actor?.nombre || record.actorId} ${record.actorId} ${record.actor?.titulo || ""} ${playerName}`.toLowerCase();
        return !filter || haystack.includes(filter);
      });

    const count = $("character-manager-count");
    if (count) count.textContent = String(records.length).padStart(2, "0");

    records.forEach((record) => {
      const actor = record.actor || {};
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "cm-roster-entry";
      button.dataset.actorId = record.actorId;
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", record.actorId === state.actorId ? "true" : "false");
      if (record.actorId === state.actorId) button.classList.add("is-selected");

      const portrait = doc.createElement("span");
      portrait.className = "cm-roster-portrait";
      const portraitUrl = rosterPortrait(record);
      if (portraitUrl) {
        const image = doc.createElement("img");
        image.src = portraitUrl;
        image.alt = "";
        image.addEventListener("error", () => {
          image.remove();
          portrait.textContent = initials(actor.nombre || record.actorId);
        });
        portrait.appendChild(image);
      } else {
        portrait.textContent = initials(actor.nombre || record.actorId);
      }

      const copy = doc.createElement("span");
      copy.className = "cm-roster-copy";
      const name = doc.createElement("strong");
      name.textContent = actor.nombre || record.actorId;
      const meta = doc.createElement("small");
      meta.textContent = record.playerId ? "PJ / LINKED" : String(actor.tipo || "NPC").toUpperCase();
      copy.append(name, meta);

      const marker = doc.createElement("i");
      marker.className = record.playerId ? "cm-link-marker is-linked" : "cm-link-marker";
      marker.title = record.playerId ? "Vinculado a jugador" : "Actor persistente";

      button.append(portrait, copy, marker);
      button.addEventListener("click", () => loadActor(record.actorId));
      roster.appendChild(button);
    });

    if (!records.length) {
      const empty = doc.createElement("div");
      empty.className = "cm-empty-state";
      empty.textContent = filter ? "SIN COINCIDENCIAS" : "SIN ACTORES";
      roster.appendChild(empty);
    }
  }

  function loadActor(actorId) {
    const record = manager.getActor(actorId);
    if (!record) return beginNew();
    state.actorId = actorId;
    state.root = record.root;
    const actor = record.actor || {};
    $("character-manager-name").value = actor.nombre || "";
    $("character-manager-title").value = actor.titulo || "";
    $("character-manager-type").value = actor.tipo || "NPC";
    $("character-manager-faction").value = actor.faccion || actor.alineamiento || "";
    $("character-manager-scale").value = Number(actor.escala) || 1;
    $("character-manager-name-color").value = /^#[0-9a-f]{6}$/i.test(actor.color_nombre || "") ? actor.color_nombre : "#ffffff";
    $("character-manager-title-color").value = /^#[0-9a-f]{6}$/i.test(actor.color_titulo || "") ? actor.color_titulo : "#c49a00";
    $("character-manager-icon").value = actor.icono || "";
    $("character-manager-sprite").value = actor.sprite || "";
    renderPlayerOptions(record.playerId || "");
    renderExpressions(actor.expresiones || {});
    renderLanguages(record);
    $("character-manager-delete").disabled = false;
    $("character-manager-source").textContent = record.root === manager.PATHS.actors[0] ? "BASE" : "LEGACY";
    setStatus(actorId, "ok");
    updatePreview();
    renderActorList();
    feedback("ACTOR CARGADO", "ok");
  }

  function beginNew() {
    state.actorId = null;
    state.root = manager.PATHS.actors[0];
    ["name", "title", "faction", "icon", "sprite"].forEach((suffix) => {
      const input = $(`character-manager-${suffix}`);
      if (input) input.value = "";
    });
    $("character-manager-name-color").value = "#ffffff";
    $("character-manager-title-color").value = "#c49a00";
    $("character-manager-type").value = "NPC";
    $("character-manager-scale").value = 1;
    $("character-manager-source").textContent = "BASE";
    renderPlayerOptions("");
    renderExpressions({ Neutral: "" });
    renderLanguages(null);
    $("character-manager-delete").disabled = true;
    setStatus("NEW", "new");
    updatePreview();
    renderActorList();
    setSection("identity");
    feedback("NUEVO ACTOR", "");
  }

  function setStatus(text, mode = "") {
    const status = $("character-manager-status");
    if (!status) return;
    status.textContent = text;
    status.dataset.mode = mode;
  }

  function feedback(text, mode = "") {
    const node = $("character-manager-feedback");
    if (!node) return;
    node.textContent = text || "";
    node.dataset.mode = mode;
  }

  async function save() {
    const name = value("character-manager-name").trim();
    if (!name) {
      setSection("identity");
      return feedback("NOMBRE REQUERIDO", "error");
    }
    const playerId = value("character-manager-player") || null;
    const actor = {
      nombre: name,
      titulo: value("character-manager-title").trim(),
      tipo: playerId ? "Jugador" : value("character-manager-type"),
      faccion: value("character-manager-faction").trim(),
      escala: Number(value("character-manager-scale")) || 1,
      color_nombre: value("character-manager-name-color").trim(),
      color_titulo: value("character-manager-title-color").trim(),
      icono: value("character-manager-icon").trim(),
      sprite: value("character-manager-sprite").trim(),
      expresiones: collectExpressions(),
      idiomas: collectLanguages(),
    };

    const button = $("character-manager-save");
    button.disabled = true;
    feedback("GUARDANDO", "busy");
    try {
      const saved = await manager.saveActor({
        actorId: state.actorId,
        root: state.root || manager.PATHS.actors[0],
        actor,
        playerId,
      });
      state.actorId = saved.actorId;
      state.root = saved.root;
      $("character-manager-source").textContent = saved.root === manager.PATHS.actors[0] ? "BASE" : "LEGACY";
      feedback("SINCRONIZADO", "ok");
      setStatus(saved.actorId, "ok");
      updatePreview();
    } catch (error) {
      console.error("Character Manager save failed:", error);
      feedback(`ERROR / ${error.message || error}`, "error");
    } finally {
      button.disabled = false;
    }
  }

  async function removeActor() {
    if (!state.actorId) return;
    const record = currentActor();
    const label = record?.actor?.nombre || state.actorId;
    if (!global.confirm?.(`Eliminar permanentemente a ${label}? El jugador vinculado se conservará.`)) return;
    try {
      await manager.deleteActor(state.actorId);
      beginNew();
      feedback("ACTOR ELIMINADO", "ok");
    } catch (error) {
      console.error("Character Manager delete failed:", error);
      feedback(`ERROR / ${error.message || error}`, "error");
    }
  }

  function bindPanel() {
    $("character-manager-search")?.addEventListener("input", renderActorList);
    $("character-manager-new")?.addEventListener("click", beginNew);
    $("character-manager-refresh")?.addEventListener("click", () => {
      renderActorList();
      renderPlayerOptions(currentActor()?.playerId || "");
      renderLanguages(currentActor());
      feedback("ROSTER ACTUALIZADO", "ok");
    });
    $("character-manager-add-expression")?.addEventListener("click", () => {
      $("character-manager-expressions")?.appendChild(expressionRow());
      updateExpressionCount();
    });
    $("character-manager-player")?.addEventListener("change", () => {
      if (value("character-manager-player")) $("character-manager-type").value = "Jugador";
      renderLanguages(currentActor());
      updatePreview();
    });
    $("character-manager-save")?.addEventListener("click", save);
    $("character-manager-delete")?.addEventListener("click", removeActor);

    doc.querySelectorAll("#character-manager-studio .cm-module-tab").forEach((button) => {
      button.addEventListener("click", () => setSection(button.dataset.section));
    });

    ["character-manager-name", "character-manager-title", "character-manager-type", "character-manager-icon", "character-manager-sprite"].forEach((id) => {
      $(id)?.addEventListener("input", updatePreview);
      $(id)?.addEventListener("change", updatePreview);
    });
  }

  function start() {
    manager.init();
    if (!createPanel()) return;
    state.unsubscribe = manager.subscribeAll((next) => {
      state.snapshot = next;
      renderActorList();
      renderPlayerOptions(currentPlayerId(currentActor()) || "");
      if (state.actorId && manager.getActor(state.actorId)) renderLanguages(manager.getActor(state.actorId));
    });
    beginNew();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window);