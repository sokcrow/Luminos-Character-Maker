(function (global) {
  "use strict";

  const doc = global.document;
  const manager = global.LuminousCharacterManager;
  const bonds = global.LuminousBondManager;
  const isDmContext = Boolean(doc?.getElementById("dashboard-actores"));
  if (!doc || !manager || !bonds || !isDmContext) return;
  if (global.__luminousCharacterSocialStudioInstalled) return;
  global.__luminousCharacterSocialStudioInstalled = true;

  const state = { groupMode: "type", grouping: false, groupTimer: null };

  function $(id) { return doc.getElementById(id); }

  function normalizeTags(value) {
    if (Array.isArray(value)) return value.map((tag) => String(tag || "").trim()).filter(Boolean);
    if (typeof value === "string") return value.split(",").map((tag) => tag.trim()).filter(Boolean);
    if (value && typeof value === "object") return Object.values(value).map((tag) => String(tag || "").trim()).filter(Boolean);
    return [];
  }

  function slug(value) {
    return String(value || "actor")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "") || "actor";
  }

  function currentActorId() {
    return doc.querySelector("#character-manager-roster .cm-roster-entry.is-selected")?.dataset?.actorId || null;
  }

  function currentRecord() {
    const actorId = currentActorId();
    return actorId ? manager.getActor(actorId) : null;
  }

  function groupLabel(record) {
    const actor = record?.actor || {};
    if (state.groupMode === "faction") return String(actor.faccion || actor.alineamiento || "SIN FACCIÓN").toUpperCase();
    if (state.groupMode === "tag") {
      const tags = normalizeTags(actor.etiquetas || actor.tags);
      return String(tags[0] || "SIN ETIQUETA").toUpperCase();
    }
    if (record?.playerId || actor.tipo === "Jugador") return "JUGADORES";
    return String(actor.tipo || "NPC").toUpperCase();
  }

  function decorateEntry(entry, record) {
    entry.querySelector(".cm-taxonomy-tags")?.remove();
    const tags = normalizeTags(record?.actor?.etiquetas || record?.actor?.tags);
    if (!tags.length) return;
    const host = doc.createElement("span");
    host.className = "cm-taxonomy-tags";
    tags.slice(0, 3).forEach((tag) => {
      const chip = doc.createElement("span");
      chip.textContent = tag;
      host.appendChild(chip);
    });
    entry.querySelector(".cm-roster-copy")?.appendChild(host);
  }

  function applyGrouping(force = false) {
    if (state.grouping) return;
    const roster = $("character-manager-roster");
    if (!roster) return;
    const entries = Array.from(roster.querySelectorAll(".cm-roster-entry"));
    if (!entries.length) return;
    if (!force && !Array.from(roster.children).some((child) => child.classList?.contains("cm-roster-entry"))) return;

    state.grouping = true;
    const groups = new Map();
    entries.forEach((entry) => {
      const record = manager.getActor(entry.dataset.actorId);
      if (!record) return;
      decorateEntry(entry, record);
      const label = groupLabel(record);
      if (!groups.has(label)) groups.set(label, []);
      groups.get(label).push(entry);
    });

    const fragment = doc.createDocumentFragment();
    Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0])).forEach(([label, groupEntries]) => {
      const section = doc.createElement("section");
      section.className = "cm-roster-group";
      const heading = doc.createElement("div");
      heading.className = "cm-roster-group-heading";
      heading.innerHTML = `<span></span><code></code>`;
      heading.querySelector("span").textContent = label;
      heading.querySelector("code").textContent = String(groupEntries.length).padStart(2, "0");
      section.appendChild(heading);
      groupEntries.forEach((entry) => section.appendChild(entry));
      fragment.appendChild(section);
    });

    roster.replaceChildren(fragment);
    state.grouping = false;
  }

  function scheduleGrouping(force = false) {
    global.clearTimeout(state.groupTimer);
    state.groupTimer = global.setTimeout(() => applyGrouping(force), 0);
  }

  function populateTags() {
    const input = $("character-manager-tags");
    if (!input) return;
    const record = currentRecord();
    input.value = normalizeTags(record?.actor?.etiquetas || record?.actor?.tags).join(", ");
    input.disabled = false;
  }

  const social = global.LuminousSocialLinkCore;
  let draft = social.normalizeLink();
  let loadedActorId = null;
  let loadedRecord = null;

  function collect() {
    const npc = $("character-manager-type")?.value !== "Jugador" && !$("character-manager-player")?.value;
    return social.normalizeLink({ ...draft, enabled:npc && $("character-manager-social-enabled")?.checked === true,
      combatant:$("character-manager-social-kind")?.value === "combatant",
      description:$("character-manager-social-description")?.value || "" });
  }

  function load(record) {
    loadedActorId = record?.actorId || null;
    loadedRecord = record;
    draft = social.normalizeLink(record?.actor?.socialLink);
    populateTags();
    if (!$("character-manager-social-enabled")) return;
    $("character-manager-social-enabled").checked = draft.enabled;
    $("character-manager-social-kind").value = draft.combatant ? "combatant" : "civilian";
    $("character-manager-social-description").value = draft.description;
    renderPlayers();
    updateEnabled();
    renderRelations();
  }

  function updateEnabled() {
    const npc = $("character-manager-type")?.value !== "Jugador" && !$("character-manager-player")?.value;
    const checkbox = $("character-manager-social-enabled");
    if (!checkbox) return;
    checkbox.disabled = !npc;
    $("character-manager-social-fields").hidden = !npc || !checkbox.checked;
    $("character-manager-social-help").textContent = npc
      ? "Desbloquea este vínculo únicamente para los jugadores que selecciones. Guarda el NPC para publicar los cambios."
      : "Social Link corresponde a un NPC, no a la asignación de un personaje de jugador.";
  }

  function renderPlayers() {
    const host = $("character-manager-social-players");
    if (!host) return;
    host.replaceChildren();
    const players = manager.listPlayers().sort((a,b) => a.label.localeCompare(b.label));
    if (!players.length) { host.textContent = "Todavía no hay jugadores disponibles."; return; }
    players.forEach(({playerId,label}) => {
      const row = doc.createElement("label");
      row.className = "cm-social-recipient";
      const checkbox = doc.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = draft.players[playerId] === true;
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) draft.players[playerId] = true;
        else delete draft.players[playerId];
      });
      const name = doc.createElement("span"); name.textContent = label;
      row.append(checkbox,name); host.append(row);
    });
  }

  function field(parent, label, value, multiline = false) {
    const row = doc.createElement("label"); row.className = "cm-social-field";
    const caption = doc.createElement("span"); caption.textContent = label;
    const input = doc.createElement(multiline ? "textarea" : "input");
    if (multiline) input.rows = 3;
    input.value = value; row.append(caption,input); parent.append(row);
    return input;
  }

  function renderRelations() {
    const host = $("character-manager-relations-list");
    if (!host) return;
    host.replaceChildren();
    const record = loadedRecord;
    const saved = social.normalizeLink(record?.actor?.socialLink);
    if (!loadedActorId || !saved.enabled) {
      host.textContent = "Guarda el NPC con Social Link para administrar el progreso de cada jugador.";
      return;
    }
    const existing = bonds.listForActor(loadedActorId);
    Object.keys(saved.players).forEach(playerId => {
      const player = manager.getPlayer(playerId);
      if (!player) return;
      const bond = social.normalizeProgress(existing[playerId]);
      const card = doc.createElement("details"); card.className = "cm-social-progress";
      const summary = doc.createElement("summary");
      summary.textContent = `${player.label} · Rango ${bond.nivel}`;
      const body = doc.createElement("div"); body.className = "cm-social-progress-body";
      const level = field(body,"Rango (0–10)",bond.nivel); level.type = "number"; level.min = 0; level.max = 10; level.step = 1;
      const affinity = field(body,"Afinidad hacia el siguiente rango",bond.puntos); affinity.type = "number"; affinity.step = 1;
      const story = field(body,"Historia compartida · visible para este jugador",bond.historia,true);
      const memories = field(body,"Recuerdos publicados · uno por línea",bond.recuerdos.join("\n"),true);
      const benefits = field(body,"Beneficios publicados · uno por línea",bond.beneficios.join("\n"),true);
      const status = doc.createElement("p"); status.setAttribute("role","status");
      const save = doc.createElement("button"); save.type = "button"; save.textContent = "Guardar progreso";
      save.addEventListener("click",async () => {
        if (!level.reportValidity() || !affinity.reportValidity()) return;
        const actorId = loadedActorId;
        save.disabled = true; status.textContent = "Guardando…";
        try {
          await bonds.setBond(playerId,actorId,{ nivel:Number(level.value),puntos:Number(affinity.value),
            historia:story.value,recuerdos:social.lines(memories.value),beneficios:social.lines(benefits.value) });
          status.textContent = "Progreso publicado para este jugador.";
          summary.textContent = `${player.label} · Rango ${Number(level.value)}`;
        } catch (_) { status.textContent = "No se pudo guardar. Conservamos los cambios para que puedas volver a intentarlo."; }
        finally { save.disabled = false; }
      });
      body.append(save,status); card.append(summary,body); host.append(card);
    });
    if (!host.children.length) host.textContent = "Selecciona al menos un jugador y guarda el NPC.";
  }

  function ensureUi() {
    const panel = $("character-manager-studio");
    if (!panel) return false;
    if (!$("character-manager-tags")) {
      const row = doc.createElement("label"); row.className = "cm-field cm-wide";
      row.innerHTML = '<span>ETIQUETAS</span><input id="character-manager-tags" type="text" placeholder="aliado, contacto" autocomplete="off">';
      panel.querySelector('[data-module="assignment"] .cm-field-grid')?.append(row);
    }
    if (!$("character-manager-relations")) {
      const section = doc.createElement("section"); section.id = "character-manager-relations";
      section.className = "cm-social-relations";
      section.innerHTML = `
        <label class="cm-social-toggle"><input id="character-manager-social-enabled" type="checkbox"><span>Social Link</span></label>
        <p id="character-manager-social-help" class="cm-social-help"></p>
        <div id="character-manager-social-fields" hidden>
          <label class="cm-social-field"><span>Tipo de vínculo</span><select id="character-manager-social-kind"><option value="civilian">No combatiente</option><option value="combatant">Combatiente</option></select></label>
          <label class="cm-social-field"><span>Presentación del vínculo · visible para los jugadores seleccionados</span><textarea id="character-manager-social-description" rows="3" maxlength="4000"></textarea></label>
          <fieldset class="cm-social-recipients"><legend>Desbloquear para</legend><div id="character-manager-social-players"></div></fieldset>
          <h4>Progreso individual</h4><div id="character-manager-relations-list"></div>
        </div>`;
      panel.querySelector('[data-module="assignment"]')?.append(section);
      $("character-manager-social-enabled").addEventListener("change",updateEnabled);
      ["character-manager-type","character-manager-player"].forEach(id => $(id)?.addEventListener("change",updateEnabled));
      load(currentRecord());
    }
    return true;
  }

  global.LuminousSocialLinkStudio = Object.freeze({load,collect});
  manager.subscribeActors(() => { if (ensureUi()) scheduleGrouping(true); });
  manager.subscribePlayers(() => {
    if (!ensureUi()) return;
    renderPlayers();
    if (!$("character-manager-relations-list")?.querySelector("details")) renderRelations();
  });
  // Existing editor drafts are not rebuilt by unrelated realtime bond updates.
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded",ensureUi,{once:true});
  else ensureUi();
})(window);
