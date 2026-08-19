(function (global) {
  "use strict";

  const doc = global.document;
  const firebase = global.firebase;
  if (!doc || !firebase?.database) return;

  const db = firebase.database();
  const ROOTS = {
    base: "campaña/base_datos_npcs",
    legacy: "campaña/actores",
    players: "campaña/jugadores",
  };

  const state = {
    base: {},
    legacy: {},
    players: {},
    context: null,
    filter: "",
  };

  const scenePath = () => global.LuminousTheatreState?.getPaths?.().scene || "campaña/estado_mundo/escena_actual";
  const actorPool = () => Object.assign({}, state.legacy, state.base);
  const field = (id) => doc.getElementById(id);
  const playerLabel = (id, player) => player?.characterName || player?.character_name || player?.nombre || player?.name || id;

  function slug(value) {
    return String(value || "actor")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "actor";
  }

  function persistentRecord(actorId) {
    if (actorId && Object.prototype.hasOwnProperty.call(state.base, actorId)) {
      return { actorId, root: ROOTS.base, data: state.base[actorId] || {} };
    }
    if (actorId && Object.prototype.hasOwnProperty.call(state.legacy, actorId)) {
      return { actorId, root: ROOTS.legacy, data: state.legacy[actorId] || {} };
    }
    return null;
  }

  function linkedActorId(playerId, player) {
    const pool = actorPool();
    if (player?.actorId && pool[player.actorId]) return player.actorId;
    return Object.keys(pool).find((actorId) => {
      const actor = pool[actorId];
      return actor?.vinculo_jugador === playerId && actor?.tipo === "Jugador";
    }) || null;
  }

  function actorLinkedPlayerId(actorId, actor) {
    if (actor?.vinculo_jugador && state.players[actor.vinculo_jugador]) return actor.vinculo_jugador;
    return Object.keys(state.players).find((playerId) => state.players[playerId]?.actorId === actorId) || null;
  }

  function expressionSprite(value) {
    if (typeof value === "string") return value;
    return value?.sprite || value?.url || value?.imagen || "";
  }

  function sourceLabel(root) {
    if (root === ROOTS.base) return "BASE PRINCIPAL";
    if (root === ROOTS.legacy) return "BASE LEGACY";
    return "NUEVO REGISTRO";
  }

  function mountMasterPanel() {
    const director = doc.getElementById("theatre-director-panel");
    const quickCast = doc.querySelector(".npc-spawner-section");
    if (!director || !quickCast || doc.getElementById("theatre-actor-master-panel")) return;

    const panel = doc.createElement("section");
    panel.id = "theatre-actor-master-panel";
    panel.className = "theatre-actor-master-panel";
    panel.innerHTML = `
      <header class="theatre-master-header">
        <div>
          <span class="theatre-master-eyebrow">MASTER DATABASE / DM AUTHORITY</span>
          <h4>CONTROL MAESTRO DE ACTORES</h4>
          <p>Administra la fuente persistente. El cast de escena es temporal y se controla por separado.</p>
        </div>
        <span id="theatre-master-status" class="theatre-master-status">SIN SELECCIÓN</span>
      </header>

      <div class="theatre-master-layout">
        <aside class="theatre-master-browser">
          <label for="theatre-master-search">BUSCAR</label>
          <input id="theatre-master-search" type="search" placeholder="Jugador, NPC, actorId..." autocomplete="off">
          <label for="theatre-master-source-select">FUENTES PERSISTENTES / JUGADORES</label>
          <select id="theatre-master-source-select" size="11" aria-label="Fuentes persistentes de actores"></select>
          <div class="theatre-master-browser-actions">
            <button id="theatre-master-new-npc" type="button">+ NUEVO NPC</button>
            <button id="theatre-master-reload" type="button">RECARGAR LISTA</button>
          </div>
          <p class="theatre-master-help"><strong>JUGADORES:</strong> siempre aparecen aquí. Si uno no tiene actor Theatre, selecciónalo y guarda para crearlo/repararlo.</p>
        </aside>

        <div class="theatre-master-editor">
          <div class="theatre-master-source-meta">
            <span id="theatre-master-source-kind">NUEVO REGISTRO</span>
            <code id="theatre-master-source-path">campaña/base_datos_npcs</code>
          </div>

          <div class="theatre-master-fields">
            <label class="theatre-master-field">
              <span>Nombre</span>
              <input id="theatre-master-name" type="text" autocomplete="off">
            </label>
            <label class="theatre-master-field">
              <span>Título</span>
              <input id="theatre-master-title" type="text" autocomplete="off">
            </label>
            <label class="theatre-master-field">
              <span>Tipo</span>
              <select id="theatre-master-type"><option value="NPC">NPC</option><option value="Jugador">Jugador</option></select>
            </label>
            <label class="theatre-master-field">
              <span>Jugador vinculado</span>
              <select id="theatre-master-player-link"><option value="">— Sin vínculo —</option></select>
            </label>
            <label class="theatre-master-field">
              <span>Escala</span>
              <input id="theatre-master-scale" type="number" min="0.25" max="3" step="0.05" value="1">
            </label>
            <label class="theatre-master-field">
              <span>Color nombre</span>
              <input id="theatre-master-name-color" type="text" placeholder="#4a4a4a">
            </label>
            <label class="theatre-master-field">
              <span>Color título</span>
              <input id="theatre-master-title-color" type="text" placeholder="#4a4a4a">
            </label>
            <label class="theatre-master-field theatre-master-field--wide">
              <span>Icono · log / HUD</span>
              <input id="theatre-master-icon" type="url" placeholder="https://... icono">
            </label>
            <label class="theatre-master-field theatre-master-field--wide">
              <span>Sprite base · escena</span>
              <input id="theatre-master-sprite" type="url" placeholder="https://... sprite">
            </label>
          </div>

          <details class="theatre-master-advanced">
            <summary>EXPRESIONES / AVANZADO</summary>
            <p>Mapa JSON de expresiones. Se conserva como parte de la fuente persistente.</p>
            <textarea id="theatre-master-expressions" spellcheck="false" placeholder='{"Neutral":"https://...","Enojado":"https://..."}'></textarea>
          </details>

          <div class="theatre-master-actions">
            <button id="theatre-master-save" type="button" class="is-primary">GUARDAR EN BASE</button>
            <button id="theatre-master-add-cast" type="button">AÑADIR AL CAST</button>
            <button id="theatre-master-delete" type="button" class="is-danger">ELIMINAR ACTOR</button>
            <button id="theatre-master-clear" type="button">LIMPIAR / NUEVO</button>
          </div>
          <p id="theatre-master-feedback" class="theatre-master-feedback" aria-live="polite"></p>
        </div>
      </div>
    `;

    director.insertBefore(panel, quickCast);
    quickCast.classList.add("theatre-quick-cast");
    const quickTitle = doc.createElement("div");
    quickTitle.className = "theatre-quick-cast-title";
    quickTitle.innerHTML = "<strong>CAST RÁPIDO DE ESCENA</strong><span>Instancias temporales; no modifica la base maestra.</span>";
    quickCast.prepend(quickTitle);

    bindMasterPanel();
    renderPlayerLinkOptions();
    renderSourceList();
    beginNewActor();
  }

  function bindMasterPanel() {
    field("theatre-master-search")?.addEventListener("input", (event) => {
      state.filter = String(event.target.value || "").trim().toLowerCase();
      renderSourceList();
    });

    field("theatre-master-source-select")?.addEventListener("change", () => {
      loadSelection(field("theatre-master-source-select").value);
    });

    field("theatre-master-new-npc")?.addEventListener("click", beginNewActor);
    field("theatre-master-clear")?.addEventListener("click", beginNewActor);
    field("theatre-master-reload")?.addEventListener("click", () => {
      renderPlayerLinkOptions();
      renderSourceList();
      feedback("Lista reconstruida desde Firebase.", "ok");
    });
    field("theatre-master-save")?.addEventListener("click", saveCurrentActor);
    field("theatre-master-delete")?.addEventListener("click", deleteCurrentActor);
    field("theatre-master-add-cast")?.addEventListener("click", addCurrentActorToCast);
    field("theatre-master-player-link")?.addEventListener("change", (event) => {
      if (event.target.value) field("theatre-master-type").value = "Jugador";
    });
  }

  function renderPlayerLinkOptions() {
    const select = field("theatre-master-player-link");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">— Sin vínculo —</option>';
    Object.entries(state.players)
      .sort((a, b) => playerLabel(a[0], a[1]).localeCompare(playerLabel(b[0], b[1])))
      .forEach(([playerId, player]) => {
        const option = doc.createElement("option");
        option.value = playerId;
        option.textContent = playerLabel(playerId, player);
        select.appendChild(option);
      });
    if (previous && state.players[previous]) select.value = previous;
  }

  function renderSourceList() {
    const select = field("theatre-master-source-select");
    if (!select) return;
    const previous = select.value;
    select.innerHTML = "";
    const filter = state.filter;

    const playerGroup = doc.createElement("optgroup");
    playerGroup.label = "JUGADORES";
    Object.entries(state.players)
      .sort((a, b) => playerLabel(a[0], a[1]).localeCompare(playerLabel(b[0], b[1])))
      .forEach(([playerId, player]) => {
        const actorId = linkedActorId(playerId, player);
        const actor = actorId ? persistentRecord(actorId)?.data : null;
        const label = `${playerLabel(playerId, player)} ${actorId ? `· ${actor?.nombre || actorId}` : "· SIN ACTOR THEATRE"}`;
        if (filter && !`${label} ${playerId} ${actorId || ""}`.toLowerCase().includes(filter)) return;
        const option = doc.createElement("option");
        option.value = `player:${playerId}`;
        option.textContent = label;
        option.dataset.missingActor = actorId ? "false" : "true";
        playerGroup.appendChild(option);
      });
    if (playerGroup.children.length) select.appendChild(playerGroup);

    const linked = new Set(Object.keys(state.players).map((playerId) => linkedActorId(playerId, state.players[playerId])).filter(Boolean));
    const actorGroup = doc.createElement("optgroup");
    actorGroup.label = "NPCs / ACTORES SIN JUGADOR";
    Object.entries(actorPool())
      .filter(([actorId]) => !linked.has(actorId))
      .sort((a, b) => String(a[1]?.nombre || a[0]).localeCompare(String(b[1]?.nombre || b[0])))
      .forEach(([actorId, actor]) => {
        const record = persistentRecord(actorId);
        const label = `${actor?.tipo === "Jugador" ? "[PJ]" : "[NPC]"} ${actor?.nombre || actorId} · ${sourceLabel(record?.root)}`;
        if (filter && !`${label} ${actorId} ${actor?.titulo || ""}`.toLowerCase().includes(filter)) return;
        const option = doc.createElement("option");
        option.value = `actor:${actorId}`;
        option.textContent = label;
        actorGroup.appendChild(option);
      });
    if (actorGroup.children.length) select.appendChild(actorGroup);

    if (Array.from(select.options).some((option) => option.value === previous)) select.value = previous;
  }

  function beginNewActor() {
    state.context = { mode: "new", root: ROOTS.base, actorId: null, playerId: null, data: {} };
    const sourceSelect = field("theatre-master-source-select");
    if (sourceSelect) sourceSelect.selectedIndex = -1;
    setEditorValues({ tipo: "NPC", escala: 1, expresiones: {} }, "");
    setSourceMeta("NUEVO ACTOR PERSISTENTE", ROOTS.base);
    setStatus("NUEVO", "new");
    feedback("Completa los datos y pulsa GUARDAR EN BASE.");
    field("theatre-master-delete").disabled = true;
    field("theatre-master-add-cast").disabled = true;
  }

  function loadSelection(value) {
    if (!value) return beginNewActor();
    if (value.startsWith("player:")) {
      const playerId = value.slice("player:".length);
      const player = state.players[playerId] || {};
      const actorId = linkedActorId(playerId, player);
      const record = persistentRecord(actorId);
      if (record) {
        state.context = { mode: "edit", actorId, root: record.root, playerId, data: record.data };
        setEditorValues(record.data, playerId);
        setSourceMeta(`JUGADOR · ${playerLabel(playerId, player)}`, `${record.root}/${actorId}`);
        setStatus("PERSISTENTE", "ok");
        field("theatre-master-delete").disabled = false;
        field("theatre-master-add-cast").disabled = false;
        feedback("Editando la fuente persistente vinculada a este jugador.");
      } else {
        state.context = { mode: "repair-player", actorId: null, root: ROOTS.base, playerId, data: player };
        setEditorValues({
          nombre: playerLabel(playerId, player),
          titulo: player?.titulo || player?.identity || "",
          tipo: "Jugador",
          escala: 1,
          icono: player?.icono || player?.icono_jugador || player?.icon_url || "",
          sprite: player?.sprite || "",
          expresiones: {},
        }, playerId);
        setSourceMeta("JUGADOR SIN ACTOR THEATRE", `${ROOTS.players}/${playerId}`);
        setStatus("REPARAR", "warn");
        field("theatre-master-delete").disabled = true;
        field("theatre-master-add-cast").disabled = true;
        feedback("Este jugador no tiene fuente Theatre. GUARDAR EN BASE la crea y enlaza.", "warn");
      }
      return;
    }

    if (value.startsWith("actor:")) {
      const actorId = value.slice("actor:".length);
      const record = persistentRecord(actorId);
      if (!record) {
        feedback("La fuente seleccionada ya no existe.", "error");
        renderSourceList();
        return;
      }
      const playerId = actorLinkedPlayerId(actorId, record.data);
      state.context = { mode: "edit", actorId, root: record.root, playerId, data: record.data };
      setEditorValues(record.data, playerId || "");
      setSourceMeta(record.data?.tipo === "Jugador" ? "ACTOR DE JUGADOR" : "NPC / ACTOR", `${record.root}/${actorId}`);
      setStatus("PERSISTENTE", "ok");
      field("theatre-master-delete").disabled = false;
      field("theatre-master-add-cast").disabled = false;
      feedback("Fuente persistente lista para edición.");
    }
  }

  function setEditorValues(data, playerId) {
    field("theatre-master-name").value = data?.nombre || data?.characterName || data?.character_name || data?.name || "";
    field("theatre-master-title").value = data?.titulo || data?.identity || "";
    field("theatre-master-type").value = playerId ? "Jugador" : (data?.tipo || "NPC");
    field("theatre-master-player-link").value = playerId || "";
    field("theatre-master-scale").value = String(Number(data?.escala) || 1);
    field("theatre-master-name-color").value = data?.color_nombre || "";
    field("theatre-master-title-color").value = data?.color_titulo || "";
    field("theatre-master-icon").value = data?.icono || data?.icono_jugador || data?.icon_url || "";
    field("theatre-master-sprite").value = data?.sprite || data?.url || "";
    field("theatre-master-expressions").value = Object.keys(data?.expresiones || {}).length
      ? JSON.stringify(data.expresiones, null, 2)
      : "";
  }

  function setSourceMeta(kind, path) {
    field("theatre-master-source-kind").textContent = kind;
    field("theatre-master-source-path").textContent = path;
  }

  function setStatus(text, tone) {
    const status = field("theatre-master-status");
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone || "";
  }

  function feedback(text, tone) {
    const node = field("theatre-master-feedback");
    if (!node) return;
    node.textContent = text || "";
    node.dataset.tone = tone || "";
  }

  function parseExpressions() {
    const raw = String(field("theatre-master-expressions")?.value || "").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("EXPRESIONES_NOT_OBJECT");
    return parsed;
  }

  function buildPayload() {
    const linkedPlayer = field("theatre-master-player-link").value || "";
    let expressions;
    try {
      expressions = parseExpressions();
    } catch (_) {
      global.alert?.("Expresiones debe ser un objeto JSON válido.");
      return null;
    }

    const payload = {
      nombre: String(field("theatre-master-name").value || "").trim(),
      titulo: String(field("theatre-master-title").value || "").trim(),
      tipo: linkedPlayer ? "Jugador" : field("theatre-master-type").value,
      vinculo_jugador: linkedPlayer || null,
      escala: Math.max(.25, Math.min(3, Number(field("theatre-master-scale").value) || 1)),
      color_nombre: String(field("theatre-master-name-color").value || "").trim(),
      color_titulo: String(field("theatre-master-title-color").value || "").trim(),
      icono: String(field("theatre-master-icon").value || "").trim(),
      sprite: String(field("theatre-master-sprite").value || "").trim(),
      expresiones: expressions,
    };
    if (!payload.nombre) {
      global.alert?.("El actor necesita un nombre.");
      return null;
    }
    return payload;
  }

  async function syncPlayerLink(actorId, oldPlayerId, newPlayerId) {
    const updates = {};
    if (oldPlayerId && oldPlayerId !== newPlayerId && state.players[oldPlayerId]?.actorId === actorId) {
      updates[`${ROOTS.players}/${oldPlayerId}/actorId`] = null;
    }
    if (newPlayerId) updates[`${ROOTS.players}/${newPlayerId}/actorId`] = actorId;
    if (Object.keys(updates).length) await db.ref().update(updates);
  }

  async function propagateActorSource(actorId, playerId, payload) {
    const live = (await db.ref(`${scenePath()}/actores`).once("value")).val() || {};
    const updates = {};
    Object.entries(live).forEach(([instanceId, actor]) => {
      const match = actor?.identityId === actorId || actor?.sourceId === actorId || (playerId && actor?.sourceId === playerId);
      if (!match) return;
      ["nombre", "titulo", "tipo", "icono", "sprite", "color_nombre", "color_titulo", "escala", "expresiones"].forEach((key) => {
        updates[`${scenePath()}/actores/${instanceId}/${key}`] = payload[key] ?? null;
      });
    });
    if (Object.keys(updates).length) await db.ref().update(updates);
  }

  async function saveCurrentActor() {
    const context = state.context || { mode: "new", root: ROOTS.base };
    const payload = buildPayload();
    if (!payload) return;
    const save = field("theatre-master-save");
    const oldPlayerId = context.playerId || context.data?.vinculo_jugador || "";
    const newPlayerId = payload.vinculo_jugador || "";
    save.disabled = true;
    save.textContent = "GUARDANDO...";
    feedback("Escribiendo fuente persistente...", "warn");

    try {
      let actorId = context.actorId;
      let root = context.root || ROOTS.base;

      if (context.mode === "new") {
        const ref = db.ref(ROOTS.base).push();
        actorId = ref.key;
        root = ROOTS.base;
        await ref.set(Object.assign({ identityId: actorId }, payload));
      } else if (context.mode === "repair-player") {
        const preferred = state.players[context.playerId]?.actorId || `jugador_${slug(context.playerId)}`;
        actorId = persistentRecord(preferred) ? db.ref(ROOTS.base).push().key : preferred;
        root = ROOTS.base;
        payload.tipo = "Jugador";
        payload.vinculo_jugador = context.playerId;
        await db.ref(`${root}/${actorId}`).set(Object.assign({ identityId: actorId }, payload));
      } else {
        await db.ref(`${root}/${actorId}`).update(payload);
      }

      await syncPlayerLink(actorId, oldPlayerId, payload.vinculo_jugador || "");
      await propagateActorSource(actorId, payload.vinculo_jugador || oldPlayerId || null, payload);

      state.context = { mode: "edit", actorId, root, playerId: payload.vinculo_jugador || null, data: payload };
      setSourceMeta(payload.tipo === "Jugador" ? "ACTOR DE JUGADOR" : "NPC / ACTOR", `${root}/${actorId}`);
      setStatus("GUARDADO", "ok");
      field("theatre-master-delete").disabled = false;
      field("theatre-master-add-cast").disabled = false;
      feedback("Fuente persistente guardada. Las instancias actuales del cast fueron sincronizadas.", "ok");
      renderSourceList();
      selectContextInBrowser(actorId, payload.vinculo_jugador || "");
    } catch (error) {
      console.error("No se pudo guardar el actor persistente:", error);
      setStatus("ERROR", "error");
      feedback("No se pudo guardar. Revisa permisos/Firebase y consola.", "error");
      global.alert?.("No se pudo guardar el actor persistente.");
    } finally {
      save.disabled = false;
      save.textContent = "GUARDAR EN BASE";
    }
  }

  function selectContextInBrowser(actorId, playerId) {
    const select = field("theatre-master-source-select");
    if (!select) return;
    const preferred = playerId ? `player:${playerId}` : `actor:${actorId}`;
    if (Array.from(select.options).some((option) => option.value === preferred)) select.value = preferred;
  }

  async function addCurrentActorToCast() {
    const context = state.context;
    if (!context?.actorId) {
      global.alert?.("Guarda primero el actor en la base maestra.");
      return;
    }
    const record = persistentRecord(context.actorId) || { data: context.data || {} };
    const actor = record.data || {};
    const playerId = actorLinkedPlayerId(context.actorId, actor) || context.playerId || null;
    const instanceId = `actor_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const expressions = actor.expresiones || {};
    const firstExpression = Object.keys(expressions)[0] || "";
    const baseSprite = actor.sprite || actor.url || expressionSprite(expressions[firstExpression]) || "";

    const payload = {
      nombre: actor.nombre || context.actorId,
      titulo: actor.titulo || "",
      tipo: actor.tipo || (playerId ? "Jugador" : "NPC"),
      color_nombre: actor.color_nombre || "",
      color_titulo: actor.color_titulo || "",
      identityId: actor.identityId || context.actorId,
      sourceId: playerId || context.actorId,
      sourceType: playerId ? "player-profile" : "npc",
      sprite: baseSprite,
      icono: actor.icono || actor.icono_jugador || actor.icon_url || "",
      expresiones: expressions,
      x: 0,
      y: 0,
      escala: Number(actor.escala) || 1,
      orientacion: "normal",
      spawnedAt: global.firebase.database.ServerValue.TIMESTAMP,
    };

    try {
      await db.ref(`${scenePath()}/actores/${instanceId}`).set(payload);
      feedback(`${payload.nombre} añadido al cast temporal de la escena.`, "ok");
    } catch (error) {
      console.error("No se pudo añadir actor al cast:", error);
      feedback("No se pudo añadir al cast.", "error");
    }
  }

  async function deleteCurrentActor() {
    const context = state.context;
    if (!context?.actorId || !context.root) return;
    const record = persistentRecord(context.actorId) || { data: context.data || {} };
    const actor = record.data || {};
    const name = actor.nombre || context.actorId;
    const linkedPlayer = actorLinkedPlayerId(context.actorId, actor) || context.playerId || null;
    if (!global.confirm?.(`Eliminar permanentemente el actor "${name}" de la base maestra?\n\nTambién se retirarán sus instancias de la escena actual. El jugador, si existe, NO se elimina; quedará sin actor Theatre.`)) return;

    const button = field("theatre-master-delete");
    button.disabled = true;
    feedback("Eliminando fuente persistente...", "warn");
    try {
      const live = (await db.ref(`${scenePath()}/actores`).once("value")).val() || {};
      const instanceIds = Object.entries(live)
        .filter(([, liveActor]) => liveActor?.identityId === context.actorId || liveActor?.sourceId === context.actorId || (linkedPlayer && liveActor?.sourceId === linkedPlayer))
        .map(([instanceId]) => instanceId);

      for (const instanceId of instanceIds) {
        if (global.LuminousTheatreState?.removeVisibleActor) {
          await global.LuminousTheatreState.removeVisibleActor(instanceId).catch(() => {});
        }
        await db.ref(`${scenePath()}/actores/${instanceId}`).remove();
      }

      await db.ref(`${context.root}/${context.actorId}`).remove();
      if (linkedPlayer && state.players[linkedPlayer]?.actorId === context.actorId) {
        await db.ref(`${ROOTS.players}/${linkedPlayer}/actorId`).remove();
      }

      setStatus("ELIMINADO", "warn");
      feedback(`Actor ${name} eliminado.`, "ok");
      beginNewActor();
    } catch (error) {
      console.error("No se pudo eliminar el actor:", error);
      feedback("No se pudo eliminar el actor.", "error");
      button.disabled = false;
    }
  }

  function decorateQuickCast() {
    const spawn = doc.getElementById("btn-spawn-npc");
    if (spawn) {
      spawn.textContent = "AÑADIR AL CAST (TEMPORAL)";
      spawn.title = "Crea una instancia temporal de la selección en la escena actual.";
    }

    doc.querySelectorAll("#live-actors-list .actor-control-card").forEach((card) => {
      if (card.querySelector(".btn-edit-source")) return;
      const actorName = String(card.querySelector(".actor-name")?.textContent || "").trim().toLowerCase();
      const matches = Object.entries(actorPool()).filter(([, actor]) => String(actor?.nombre || "").trim().toLowerCase() === actorName);
      if (matches.length !== 1) return;
      const actorId = matches[0][0];
      const buttons = card.querySelector(".actor-buttons");
      if (!buttons) return;
      const edit = doc.createElement("button");
      edit.type = "button";
      edit.className = "btn-edit-source";
      edit.textContent = "ABRIR EN CONTROL MAESTRO";
      edit.addEventListener("click", () => {
        const record = persistentRecord(actorId);
        if (!record) return;
        const playerId = actorLinkedPlayerId(actorId, record.data);
        const sourceSelect = field("theatre-master-source-select");
        const value = playerId ? `player:${playerId}` : `actor:${actorId}`;
        if (sourceSelect && Array.from(sourceSelect.options).some((option) => option.value === value)) {
          sourceSelect.value = value;
          loadSelection(value);
          field("theatre-actor-master-panel")?.scrollIntoView?.({ behavior: "smooth", block: "start" });
        }
      });
      buttons.appendChild(edit);
    });
  }

  function subscribe() {
    db.ref(ROOTS.base).on("value", (snap) => {
      state.base = snap.val() || {};
      renderSourceList();
      decorateQuickCast();
    });
    db.ref(ROOTS.legacy).on("value", (snap) => {
      state.legacy = snap.val() || {};
      renderSourceList();
      decorateQuickCast();
    });
    db.ref(ROOTS.players).on("value", (snap) => {
      state.players = snap.val() || {};
      renderPlayerLinkOptions();
      renderSourceList();
    });

    const liveList = doc.getElementById("live-actors-list");
    if (liveList) new MutationObserver(decorateQuickCast).observe(liveList, { childList: true, subtree: true });
  }

  function boot() {
    mountMasterPanel();
    decorateQuickCast();
    subscribe();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousTheatreActorStudio = Object.freeze({
    persistentRecord,
    linkedActorId,
    actorLinkedPlayerId,
    renderSourceList,
    loadSelection,
    propagateActorSource,
    addCurrentActorToCast,
  });
})(window);
