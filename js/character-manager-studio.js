(function (global) {
  "use strict";

  const doc = global.document;
  const manager = global.LuminousCharacterManager;
  if (!doc || !manager) return;

  const state = {
    actorId: null,
    root: null,
    snapshot: { actors: {}, players: {}, languages: {}, actorSources: {} },
    unsubscribe: null,
  };

  const $ = (id) => doc.getElementById(id);
  const value = (id) => $(id)?.value ?? "";

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
    return actorRecord?.playerId || value("character-manager-player") || null;
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
      <header class="cm-header">
        <div>
          <span class="cm-eyebrow">CHARACTER MANAGER ENGINE</span>
          <h3>Gestor persistente de actores</h3>
          <p>Fuente maestra para NPCs, PJ vinculados, expresiones e idiomas. Los cambios se escriben en Firebase y llegan a Theatre por sus listeners en tiempo real.</p>
        </div>
        <span id="character-manager-status" class="cm-status">CARGANDO</span>
      </header>

      <div class="cm-layout">
        <aside class="cm-browser">
          <input id="character-manager-search" type="search" placeholder="Buscar actor o jugador..." autocomplete="off">
          <select id="character-manager-actor-select" size="12" aria-label="Actores persistentes"></select>
          <div class="cm-actions-row">
            <button id="character-manager-new" type="button">+ NUEVO NPC</button>
            <button id="character-manager-refresh" type="button">RECARGAR</button>
          </div>
        </aside>

        <div class="cm-editor">
          <div class="cm-grid">
            <label><span>Nombre</span><input id="character-manager-name" type="text"></label>
            <label><span>Título</span><input id="character-manager-title" type="text"></label>
            <label><span>Tipo</span><select id="character-manager-type"><option value="NPC">NPC</option><option value="Jugador">Jugador</option><option value="Aliado">Aliado</option><option value="Enemigo">Enemigo</option><option value="Neutral">Neutral</option></select></label>
            <label><span>Jugador asignado</span><select id="character-manager-player"><option value="">— Sin asignar —</option></select></label>
            <label><span>Facción</span><input id="character-manager-faction" type="text"></label>
            <label><span>Escala</span><input id="character-manager-scale" type="number" min="0.25" max="3" step="0.05" value="1"></label>
            <label><span>Color nombre</span><input id="character-manager-name-color" type="text" placeholder="#ffffff"></label>
            <label><span>Color título</span><input id="character-manager-title-color" type="text" placeholder="#ffffff"></label>
            <label class="cm-wide"><span>Icono</span><input id="character-manager-icon" type="url" placeholder="https://..."></label>
            <label class="cm-wide"><span>Sprite base</span><input id="character-manager-sprite" type="url" placeholder="https://..."></label>
          </div>

          <details open class="cm-section">
            <summary>EXPRESIONES</summary>
            <div id="character-manager-expressions" class="cm-expression-list"></div>
            <button id="character-manager-add-expression" type="button">+ AGREGAR EXPRESIÓN</button>
          </details>

          <details open class="cm-section">
            <summary>IDIOMAS / COMPRENSIÓN</summary>
            <p id="character-manager-language-target" class="cm-help"></p>
            <div id="character-manager-languages" class="cm-language-list"></div>
          </details>

          <div class="cm-actions-row cm-editor-actions">
            <button id="character-manager-save" class="cm-primary" type="button">GUARDAR EN FIREBASE</button>
            <button id="character-manager-delete" class="cm-danger" type="button">ELIMINAR ACTOR</button>
          </div>
          <p id="character-manager-feedback" class="cm-feedback" aria-live="polite"></p>
        </div>
      </div>
    `;

    host.prepend(panel);
    bindPanel();
    return panel;
  }

  function expressionRow(name = "", sprite = "") {
    const row = doc.createElement("div");
    row.className = "cm-expression-row";
    row.innerHTML = `
      <input class="cm-expression-name" type="text" placeholder="Nombre (Neutral, Enojado...)">
      <input class="cm-expression-sprite" type="url" placeholder="URL del sprite">
      <button class="cm-expression-remove" type="button" title="Quitar expresión">×</button>
    `;
    row.querySelector(".cm-expression-name").value = name;
    row.querySelector(".cm-expression-sprite").value = sprite;
    row.querySelector(".cm-expression-remove").addEventListener("click", () => row.remove());
    return row;
  }

  function renderExpressions(expressions = {}) {
    const host = $("character-manager-expressions");
    if (!host) return;
    host.innerHTML = "";
    const entries = Object.entries(expressions || {});
    if (!entries.length) entries.push(["Neutral", ""]);
    entries.forEach(([name, entry]) => host.appendChild(expressionRow(name, expressionSprite(entry))));
  }

  function collectExpressions() {
    const expressions = {};
    doc.querySelectorAll("#character-manager-expressions .cm-expression-row").forEach((row) => {
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
        ? `Se guardará en campaña/jugadores/${playerId}/idiomas y también en el actor persistente para mantener una fuente portable.`
        : "Se guardará en idiomas del actor. Theatre puede consultar este mismo formato cuando el actor sea usado por otros sistemas.";
    }

    const languages = Object.entries(state.snapshot.languages || {})
      .sort((a, b) => languageLabel(a[0], a[1]).localeCompare(languageLabel(b[0], b[1])));

    if (!languages.length) {
      host.innerHTML = '<p class="cm-help">No hay idiomas configurados en campaña/idiomas o campaña/teatro/idiomas.</p>';
      return;
    }

    languages.forEach(([languageId, language]) => {
      const knowledge = knowledgeEntry(source, languageId);
      const row = doc.createElement("div");
      row.className = "cm-language-row";
      row.dataset.languageId = languageId;
      row.innerHTML = `
        <div class="cm-language-name"><strong></strong><code></code></div>
        <input class="cm-language-range" type="range" min="0" max="100" step="1">
        <input class="cm-language-percent" type="number" min="0" max="100" step="1">
        <label class="cm-language-understood"><input type="checkbox"> Comprende distorsión</label>
      `;
      row.querySelector("strong").textContent = languageLabel(languageId, language);
      row.querySelector("code").textContent = languageId;
      const range = row.querySelector(".cm-language-range");
      const percent = row.querySelector(".cm-language-percent");
      const checkbox = row.querySelector(".cm-language-understood input");
      range.value = knowledge.porcentaje;
      percent.value = knowledge.porcentaje;
      checkbox.checked = knowledge.comprendido;
      range.addEventListener("input", () => { percent.value = range.value; });
      percent.addEventListener("input", () => {
        const numeric = Math.max(0, Math.min(100, Number(percent.value) || 0));
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
      const comprendido = Boolean(row.querySelector(".cm-language-understood input")?.checked);
      idiomas[languageId] = { porcentaje, comprendido };
    });
    return idiomas;
  }

  function renderPlayerOptions(selected = "") {
    const select = $("character-manager-player");
    if (!select) return;
    select.innerHTML = '<option value="">— Sin asignar —</option>';
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

  function renderActorList() {
    const select = $("character-manager-actor-select");
    if (!select) return;
    const filter = value("character-manager-search").trim().toLowerCase();
    const previous = state.actorId;
    select.innerHTML = "";

    const playersGroup = doc.createElement("optgroup");
    playersGroup.label = "PERSONAJES DE JUGADOR";
    const npcGroup = doc.createElement("optgroup");
    npcGroup.label = "NPC / ACTORES";

    manager.listActors()
      .sort((a, b) => String(a.actor?.nombre || a.actorId).localeCompare(String(b.actor?.nombre || b.actorId)))
      .forEach((record) => {
        const playerName = record.playerId ? playerLabel(record.playerId, state.snapshot.players[record.playerId]) : "";
        const label = `${record.actor?.nombre || record.actorId}${playerName ? ` · ${playerName}` : ""}`;
        if (filter && !`${label} ${record.actorId} ${record.actor?.titulo || ""}`.toLowerCase().includes(filter)) return;
        const option = doc.createElement("option");
        option.value = record.actorId;
        option.textContent = label;
        (record.playerId || record.actor?.tipo === "Jugador" ? playersGroup : npcGroup).appendChild(option);
      });

    if (playersGroup.children.length) select.appendChild(playersGroup);
    if (npcGroup.children.length) select.appendChild(npcGroup);
    if (previous && Array.from(select.options).some((option) => option.value === previous)) select.value = previous;
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
    $("character-manager-name-color").value = actor.color_nombre || "";
    $("character-manager-title-color").value = actor.color_titulo || "";
    $("character-manager-icon").value = actor.icono || "";
    $("character-manager-sprite").value = actor.sprite || "";
    renderPlayerOptions(record.playerId || "");
    renderExpressions(actor.expresiones || {});
    renderLanguages(record);
    $("character-manager-delete").disabled = false;
    setStatus(`${actorId} · ${record.root === manager.PATHS.actors[0] ? "BASE" : "LEGACY"}`, "ok");
    feedback("Actor cargado desde la fuente persistente.");
  }

  function beginNew() {
    state.actorId = null;
    state.root = manager.PATHS.actors[0];
    ["name", "title", "faction", "name-color", "title-color", "icon", "sprite"].forEach((suffix) => {
      const input = $(`character-manager-${suffix}`);
      if (input) input.value = "";
    });
    $("character-manager-type").value = "NPC";
    $("character-manager-scale").value = 1;
    renderPlayerOptions("");
    renderExpressions({ Neutral: "" });
    renderLanguages(null);
    $("character-manager-delete").disabled = true;
    setStatus("NUEVO ACTOR", "new");
    feedback("Completa el actor. El ID se generará desde el nombre.");
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
    if (!name) return feedback("El nombre es obligatorio.", "error");
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
    feedback("Guardando cambios...", "busy");
    try {
      const saved = await manager.saveActor({
        actorId: state.actorId,
        root: state.root || manager.PATHS.actors[0],
        actor,
        playerId,
      });
      state.actorId = saved.actorId;
      state.root = saved.root;
      feedback("Guardado. Firebase propagará el cambio a Theatre y demás consumidores en tiempo real.", "ok");
      setStatus(`${saved.actorId} · GUARDADO`, "ok");
    } catch (error) {
      console.error("Character Manager save failed:", error);
      feedback(`No se pudo guardar: ${error.message || error}`, "error");
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
      feedback("Actor eliminado y vínculo de jugador limpiado.", "ok");
    } catch (error) {
      console.error("Character Manager delete failed:", error);
      feedback(`No se pudo eliminar: ${error.message || error}`, "error");
    }
  }

  function bindPanel() {
    $("character-manager-search")?.addEventListener("input", renderActorList);
    $("character-manager-actor-select")?.addEventListener("change", (event) => loadActor(event.target.value));
    $("character-manager-new")?.addEventListener("click", beginNew);
    $("character-manager-refresh")?.addEventListener("click", () => {
      renderActorList();
      renderPlayerOptions(currentActor()?.playerId || "");
      renderLanguages(currentActor());
      feedback("Vista reconstruida desde el cache en tiempo real.", "ok");
    });
    $("character-manager-add-expression")?.addEventListener("click", () => {
      $("character-manager-expressions")?.appendChild(expressionRow());
    });
    $("character-manager-player")?.addEventListener("change", () => {
      if (value("character-manager-player")) $("character-manager-type").value = "Jugador";
      renderLanguages(currentActor());
    });
    $("character-manager-save")?.addEventListener("click", save);
    $("character-manager-delete")?.addEventListener("click", removeActor);
  }

  function start() {
    manager.init();
    if (!createPanel()) return;
    state.unsubscribe = manager.subscribeAll((next) => {
      state.snapshot = next;
      renderActorList();
      renderPlayerOptions(currentActor()?.playerId || value("character-manager-player"));
      if (state.actorId && manager.getActor(state.actorId)) {
        const record = manager.getActor(state.actorId);
        renderLanguages(record);
      }
    });
    beginNew();
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})(window);
