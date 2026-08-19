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
  const state = { base: {}, legacy: {}, players: {}, editorContext: null };

  const scenePath = () => global.LuminousTheatreState?.getPaths?.().scene || "campaña/estado_mundo/escena_actual";
  const actorPool = () => Object.assign({}, state.legacy, state.base);
  const playerLabel = (id, player) => player?.characterName || player?.character_name || player?.nombre || player?.name || id;

  function slug(value) {
    return String(value || "actor").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "actor";
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

  function missingPlayerIds() {
    return Object.entries(state.players)
      .filter(([playerId, player]) => !linkedActorId(playerId, player))
      .map(([playerId]) => playerId)
      .sort();
  }

  function syncSpawnButtonState() {
    const select = doc.getElementById("select-npc-roster");
    const spawn = doc.getElementById("btn-spawn-npc");
    if (!select || !spawn) return;
    const unlinked = String(select.value || "").startsWith("__player__:");
    spawn.dataset.unlinkedPlayer = unlinked ? "true" : "false";
    spawn.disabled = unlinked;
    spawn.title = unlinked
      ? "Crea/repara primero el actor persistente de este jugador."
      : "Añade una instancia temporal al cast de la escena actual.";
  }

  function refreshUnlinkedPlayers() {
    const select = doc.getElementById("select-npc-roster");
    if (!select) return;
    const ids = missingPlayerIds();
    const signature = ids.join("|");
    const current = select.querySelector('optgroup[data-actor-studio="unlinked"]');
    if (current?.dataset.signature === signature) {
      syncSpawnButtonState();
      return;
    }
    current?.remove();
    if (!ids.length) {
      syncSpawnButtonState();
      return;
    }

    const group = doc.createElement("optgroup");
    group.label = "JUGADORES SIN ACTOR THEATRE";
    group.dataset.actorStudio = "unlinked";
    group.dataset.signature = signature;
    ids.forEach((playerId) => {
      const option = doc.createElement("option");
      option.value = `__player__:${playerId}`;
      option.textContent = `${playerLabel(playerId, state.players[playerId])} · CREAR ACTOR`;
      option.dataset.sourceType = "unlinked-player";
      option.dataset.sourceId = playerId;
      group.appendChild(option);
    });
    select.appendChild(group);
    syncSpawnButtonState();
  }

  function field(id) { return doc.getElementById(id); }

  function createEditor() {
    let overlay = doc.getElementById("theatre-actor-studio-overlay");
    if (overlay) return overlay;
    overlay = doc.createElement("div");
    overlay.id = "theatre-actor-studio-overlay";
    overlay.className = "theatre-actor-studio-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <section class="theatre-actor-studio" role="dialog" aria-modal="true" aria-labelledby="theatre-actor-studio-title">
        <header class="theatre-actor-studio__header"><div><span class="theatre-actor-studio__eyebrow">ACTOR SOURCE / PERSISTENT DATABASE</span><h2 id="theatre-actor-studio-title" class="theatre-actor-studio__title">EDITAR ACTOR</h2></div><button class="theatre-actor-studio__close" type="button" aria-label="Cerrar">×</button></header>
        <div class="theatre-actor-studio__body"><p id="theatre-actor-studio-source" class="theatre-actor-studio__source"></p><div class="theatre-actor-studio__grid">
          <div class="theatre-actor-field"><label for="theatre-actor-name">Nombre</label><input id="theatre-actor-name" type="text"></div>
          <div class="theatre-actor-field"><label for="theatre-actor-title">Título</label><input id="theatre-actor-title" type="text"></div>
          <div class="theatre-actor-field"><label for="theatre-actor-type">Tipo</label><select id="theatre-actor-type"><option value="NPC">NPC</option><option value="Jugador">Jugador</option></select></div>
          <div class="theatre-actor-field"><label for="theatre-actor-scale">Escala</label><input id="theatre-actor-scale" type="number" min="0.25" max="3" step="0.05" value="1"></div>
          <div class="theatre-actor-field theatre-actor-field--wide"><label for="theatre-actor-icon">Icono · log/HUD</label><input id="theatre-actor-icon" type="url" placeholder="https://... icono"></div>
          <div class="theatre-actor-field theatre-actor-field--wide"><label for="theatre-actor-sprite">Sprite · escena</label><input id="theatre-actor-sprite" type="url" placeholder="https://... sprite"></div>
          <div class="theatre-actor-field"><label for="theatre-actor-name-color">Color nombre</label><input id="theatre-actor-name-color" type="text" placeholder="#4a4a4a"></div>
          <div class="theatre-actor-field"><label for="theatre-actor-title-color">Color título</label><input id="theatre-actor-title-color" type="text" placeholder="#4a4a4a"></div>
        </div></div>
        <footer class="theatre-actor-studio__footer"><button class="theatre-actor-studio__cancel" type="button">CANCELAR</button><button class="theatre-actor-studio__save" type="button">GUARDAR FUENTE</button></footer>
      </section>`;
    doc.body.appendChild(overlay);

    const close = () => {
      overlay.classList.remove("open");
      overlay.setAttribute("aria-hidden", "true");
      state.editorContext = null;
    };
    overlay.querySelector(".theatre-actor-studio__close")?.addEventListener("click", close);
    overlay.querySelector(".theatre-actor-studio__cancel")?.addEventListener("click", close);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
    overlay.querySelector(".theatre-actor-studio__save")?.addEventListener("click", saveEditor);
    return overlay;
  }

  function openEditor(context) {
    const overlay = createEditor();
    state.editorContext = context;
    const data = context.data || {};
    const isPlayer = Boolean(context.playerId) || data.tipo === "Jugador";
    field("theatre-actor-studio-title").textContent = context.mode === "new" ? "NUEVO ACTOR PERSISTENTE" : "EDITAR ACTOR PERSISTENTE";
    field("theatre-actor-studio-source").textContent = context.mode === "new"
      ? "Se guardará en campaña/base_datos_npcs y quedará reutilizable entre escenas."
      : context.unlinked
        ? `Jugador ${context.playerId}: se creará y enlazará su actor Theatre persistente.`
        : `Fuente: ${context.root}/${context.actorId}. El cast actual se sincronizará al guardar.`;
    field("theatre-actor-name").value = data.nombre || data.characterName || data.character_name || data.name || "";
    field("theatre-actor-title").value = data.titulo || data.identity || "";
    field("theatre-actor-type").value = isPlayer ? "Jugador" : (data.tipo || "NPC");
    field("theatre-actor-type").disabled = Boolean(context.playerId);
    field("theatre-actor-scale").value = String(Number(data.escala) || 1);
    field("theatre-actor-icon").value = data.icono || data.icono_jugador || data.icon_url || "";
    field("theatre-actor-sprite").value = data.sprite || data.url || "";
    field("theatre-actor-name-color").value = data.color_nombre || "";
    field("theatre-actor-title-color").value = data.color_titulo || "";
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    field("theatre-actor-name").focus();
  }

  async function resolveSelectedContext() {
    const select = doc.getElementById("select-npc-roster");
    const option = select?.options?.[select.selectedIndex];
    if (!select?.value || !option) return null;
    if (select.value.startsWith("__player__:")) {
      const playerId = option.dataset.sourceId || select.value.slice("__player__:".length);
      const player = state.players[playerId] || (await db.ref(`${ROOTS.players}/${playerId}`).once("value")).val() || {};
      return { mode: "edit", unlinked: true, playerId, data: player };
    }
    const record = persistentRecord(select.value);
    if (!record) return null;
    const sourceType = option.dataset.sourceType || "npc";
    const sourceId = option.dataset.sourceId || record.actorId;
    return { mode: "edit", actorId: record.actorId, root: record.root, data: record.data, playerId: sourceType === "player-profile" ? sourceId : (record.data?.vinculo_jugador || null) };
  }

  function editorPayload(context) {
    const payload = {
      nombre: String(field("theatre-actor-name").value || "").trim(),
      titulo: String(field("theatre-actor-title").value || "").trim(),
      tipo: context.playerId ? "Jugador" : field("theatre-actor-type").value,
      icono: String(field("theatre-actor-icon").value || "").trim(),
      sprite: String(field("theatre-actor-sprite").value || "").trim(),
      color_nombre: String(field("theatre-actor-name-color").value || "").trim(),
      color_titulo: String(field("theatre-actor-title-color").value || "").trim(),
      escala: Math.max(.25, Math.min(3, Number(field("theatre-actor-scale").value) || 1)),
    };
    if (context.playerId) payload.vinculo_jugador = context.playerId;
    return payload;
  }

  async function propagateActorSource(actorId, playerId, payload) {
    const live = (await db.ref(`${scenePath()}/actores`).once("value")).val() || {};
    const updates = {};
    Object.entries(live).forEach(([instanceId, actor]) => {
      const match = actor?.identityId === actorId || actor?.sourceId === actorId || (playerId && actor?.sourceId === playerId);
      if (!match) return;
      ["nombre", "titulo", "tipo", "icono", "sprite", "color_nombre", "color_titulo", "escala"].forEach((key) => {
        updates[`${scenePath()}/actores/${instanceId}/${key}`] = payload[key] ?? "";
      });
    });
    if (Object.keys(updates).length) await db.ref().update(updates);
  }

  async function saveEditor() {
    const context = state.editorContext;
    if (!context) return;
    const save = doc.querySelector(".theatre-actor-studio__save");
    const payload = editorPayload(context);
    if (!payload.nombre) return global.alert?.("El actor necesita un nombre.");
    save.disabled = true;
    save.textContent = "GUARDANDO...";
    try {
      let actorId = context.actorId;
      let root = context.root || ROOTS.base;
      if (context.mode === "new") {
        const ref = db.ref(ROOTS.base).push();
        actorId = ref.key;
        await ref.set(Object.assign({ identityId: actorId }, payload));
      } else if (context.unlinked && context.playerId) {
        const player = state.players[context.playerId] || {};
        actorId = player.actorId && !persistentRecord(player.actorId) ? player.actorId : `jugador_${slug(context.playerId)}`;
        root = ROOTS.base;
        await db.ref(`${root}/${actorId}`).set(Object.assign({ identityId: actorId }, payload));
        await db.ref(`${ROOTS.players}/${context.playerId}/actorId`).set(actorId);
      } else {
        await db.ref(`${root}/${actorId}`).update(payload);
      }
      await propagateActorSource(actorId, context.playerId || null, payload);
      save.textContent = "GUARDADO";
      global.setTimeout(() => {
        const overlay = doc.getElementById("theatre-actor-studio-overlay");
        overlay?.classList.remove("open");
        overlay?.setAttribute("aria-hidden", "true");
        state.editorContext = null;
      }, 350);
    } catch (error) {
      console.error("No se pudo guardar el actor persistente:", error);
      global.alert?.("No se pudo guardar el actor. Revisa permisos y consola.");
      save.textContent = "GUARDAR FUENTE";
    } finally { save.disabled = false; }
  }

  function findUniqueActorIdByName(name) {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) return null;
    const matches = Object.entries(actorPool()).filter(([, actor]) => String(actor?.nombre || "").trim().toLowerCase() === normalized);
    return matches.length === 1 ? matches[0][0] : null;
  }

  function decorateLiveCards() {
    doc.querySelectorAll("#live-actors-list .actor-control-card").forEach((card) => {
      if (card.querySelector(".btn-edit-source")) return;
      const actorId = findUniqueActorIdByName(card.querySelector(".actor-name")?.textContent || "");
      const record = persistentRecord(actorId);
      const buttons = card.querySelector(".actor-buttons");
      if (!record || !buttons) return;
      const button = doc.createElement("button");
      button.type = "button";
      button.className = "btn-edit-source";
      button.textContent = "EDITAR ACTOR FUENTE";
      button.addEventListener("click", () => {
        const fresh = persistentRecord(actorId) || record;
        openEditor({ mode: "edit", actorId, root: fresh.root, data: fresh.data, playerId: fresh.data?.vinculo_jugador || null });
      });
      buttons.appendChild(button);
    });
  }

  function mountControls() {
    const section = doc.querySelector(".npc-spawner-section");
    const select = doc.getElementById("select-npc-roster");
    const spawn = doc.getElementById("btn-spawn-npc");
    if (!section || !select || !spawn || section.dataset.actorStudioReady === "true") return;
    section.dataset.actorStudioReady = "true";
    spawn.textContent = "AÑADIR AL CAST (TEMPORAL)";
    spawn.title = "Solo crea una instancia en la escena actual; no crea una fuente persistente.";

    const actions = doc.createElement("div");
    actions.className = "theatre-actor-source-actions";
    actions.innerHTML = '<button id="btn-edit-actor-source" type="button">EDITAR / REPARAR FUENTE</button><button id="btn-new-persistent-actor" type="button">NUEVO ACTOR PERSISTENTE</button>';
    const note = doc.createElement("p");
    note.className = "theatre-actor-source-note";
    note.innerHTML = "<strong>CAST TEMPORAL:</strong> solo escena actual. <strong>ACTOR PERSISTENTE:</strong> queda en la base y se reutiliza entre escenas.";
    section.append(actions, note);

    select.addEventListener("change", syncSpawnButtonState);
    actions.querySelector("#btn-edit-actor-source")?.addEventListener("click", async () => {
      const context = await resolveSelectedContext();
      if (context) openEditor(context);
      else global.alert?.("Selecciona un actor o jugador antes de editarlo.");
    });
    actions.querySelector("#btn-new-persistent-actor")?.addEventListener("click", () => openEditor({ mode: "new", data: { tipo: "NPC", escala: 1 } }));
    syncSpawnButtonState();

    new MutationObserver(refreshUnlinkedPlayers).observe(select, { childList: true, subtree: true });
    const liveList = doc.getElementById("live-actors-list");
    if (liveList) new MutationObserver(decorateLiveCards).observe(liveList, { childList: true, subtree: true });
  }

  function subscribe() {
    db.ref(ROOTS.base).on("value", (snap) => { state.base = snap.val() || {}; refreshUnlinkedPlayers(); decorateLiveCards(); });
    db.ref(ROOTS.legacy).on("value", (snap) => { state.legacy = snap.val() || {}; refreshUnlinkedPlayers(); decorateLiveCards(); });
    db.ref(ROOTS.players).on("value", (snap) => { state.players = snap.val() || {}; refreshUnlinkedPlayers(); });
  }

  function boot() {
    createEditor();
    mountControls();
    subscribe();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousTheatreActorStudio = Object.freeze({ persistentRecord, linkedActorId, refreshUnlinkedPlayers, resolveSelectedContext, propagateActorSource });
})(window);
