(function (global) {
  "use strict";

  const manager = global.LuminousCharacterManager;
  const bonds = global.LuminousBondManager;
  if (!manager || !bonds) return;
  if (global.__luminousCharacterSocialStudioInstalled) return;
  global.__luminousCharacterSocialStudioInstalled = true;

  const doc = global.document;
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

  async function persistTags() {
    const input = $("character-manager-tags");
    const name = $("character-manager-name")?.value?.trim();
    if (!input || !name) return;
    const tags = normalizeTags(input.value);
    const existingId = currentActorId();
    const actorId = existingId || slug(name);
    const record = manager.getActor(actorId);
    await manager.saveActor({
      actorId,
      root: record?.root || manager.PATHS.actors[0],
      actor: { etiquetas: tags, tags },
    });
  }

  function relationIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6M13.5 19c.3-3 1.5-4.5 3.8-4.5 2.2 0 3.6 1.5 4.2 4.5"/></svg>';
  }

  async function saveRelation(row) {
    const actorId = currentActorId();
    const playerId = row.dataset.playerId;
    if (!actorId || !playerId) return;
    const known = Boolean(row.querySelector(".cm-bond-known")?.checked);
    const level = Number(row.querySelector(".cm-bond-level")?.value) || 0;
    const status = row.querySelector(".cm-bond-state")?.value || "neutral";
    row.dataset.saving = "true";
    try {
      await bonds.setBond(playerId, actorId, { conocido: known, nivel: level, estado: status });
    } catch (error) {
      console.error("No se pudo guardar el vínculo social:", error);
    } finally {
      row.dataset.saving = "false";
    }
  }

  function renderRelations() {
    const host = $("character-manager-relations-list");
    if (!host) return;
    host.innerHTML = "";
    const actorId = currentActorId();
    if (!actorId) {
      const empty = doc.createElement("div");
      empty.className = "cm-social-empty";
      empty.textContent = "GUARDA EL ACTOR PARA CREAR VÍNCULOS";
      host.appendChild(empty);
      return;
    }

    manager.listPlayers().sort((a, b) => a.label.localeCompare(b.label)).forEach(({ playerId, label }) => {
      const bond = bonds.getBond(playerId, actorId);
      const row = doc.createElement("div");
      row.className = "cm-bond-row";
      row.dataset.playerId = playerId;
      row.innerHTML = `
        <div class="cm-bond-player"><strong></strong><code></code></div>
        <label class="cm-bond-known-wrap"><input class="cm-bond-known" type="checkbox"><span>CONOCE</span></label>
        <div class="cm-bond-meter"><input class="cm-bond-level" type="range" min="0" max="5" step="1"><output></output></div>
        <select class="cm-bond-state" aria-label="Estado del vínculo"><option value="neutral">NEUTRAL</option><option value="confianza">CONFIANZA</option><option value="aliado">ALIADO</option><option value="rival">RIVAL</option><option value="hostil">HOSTIL</option></select>
      `;
      row.querySelector("strong").textContent = label;
      row.querySelector("code").textContent = playerId;
      const known = row.querySelector(".cm-bond-known");
      const level = row.querySelector(".cm-bond-level");
      const output = row.querySelector("output");
      const status = row.querySelector(".cm-bond-state");
      known.checked = bond.conocido;
      level.value = bond.nivel;
      output.value = bond.nivel;
      output.textContent = `LV ${bond.nivel}`;
      status.value = bond.estado;
      level.addEventListener("input", () => { output.textContent = `LV ${level.value}`; });
      [known, status].forEach((control) => control.addEventListener("change", () => saveRelation(row)));
      level.addEventListener("change", () => saveRelation(row));
      host.appendChild(row);
    });
  }

  function ensureUi() {
    const panel = $("character-manager-studio");
    if (!panel) return false;

    const rosterHeading = panel.querySelector(".cm-roster-heading");
    if (rosterHeading && !$("character-manager-group-mode")) {
      const select = doc.createElement("select");
      select.id = "character-manager-group-mode";
      select.className = "cm-group-mode";
      select.setAttribute("aria-label", "Agrupar roster");
      select.innerHTML = '<option value="type">TIPO</option><option value="faction">FACCIÓN</option><option value="tag">ETIQUETA</option>';
      select.addEventListener("change", () => {
        state.groupMode = select.value;
        applyGrouping(true);
      });
      rosterHeading.insertBefore(select, rosterHeading.lastElementChild);
    }

    const assignment = panel.querySelector('[data-module="assignment"]');
    const grid = assignment?.querySelector(".cm-field-grid");
    if (grid && !$("character-manager-tags")) {
      const tagField = doc.createElement("label");
      tagField.className = "cm-field cm-wide";
      tagField.innerHTML = '<span>ETIQUETAS</span><input id="character-manager-tags" type="text" placeholder="aliado, corporación, contacto" autocomplete="off">';
      grid.appendChild(tagField);
    }

    if (assignment && !$("character-manager-relations")) {
      const relations = doc.createElement("section");
      relations.id = "character-manager-relations";
      relations.className = "cm-social-relations";
      relations.innerHTML = `
        <header><span class="cm-social-title">${relationIcon()}<b>RELACIONES</b></span><small>PLAYER / ACTOR</small></header>
        <div id="character-manager-relations-list" class="cm-relations-list"></div>
      `;
      assignment.appendChild(relations);
    }

    const roster = $("character-manager-roster");
    if (roster && !roster.dataset.socialObserver) {
      const observer = new MutationObserver(() => {
        if (!state.grouping) scheduleGrouping(false);
      });
      observer.observe(roster, { childList: true });
      roster.dataset.socialObserver = "true";
      roster.addEventListener("click", (event) => {
        if (!event.target.closest(".cm-roster-entry")) return;
        global.setTimeout(() => {
          populateTags();
          renderRelations();
          scheduleGrouping(true);
        }, 0);
      });
    }

    $("character-manager-new")?.addEventListener("click", () => {
      global.setTimeout(() => {
        if ($("character-manager-tags")) $("character-manager-tags").value = "";
        renderRelations();
      }, 0);
    });
    $("character-manager-save")?.addEventListener("click", () => {
      persistTags().then(() => scheduleGrouping(true)).catch((error) => console.error("No se pudieron guardar etiquetas:", error));
    });

    populateTags();
    renderRelations();
    scheduleGrouping(true);
    return true;
  }

  manager.subscribeActors(() => {
    if (ensureUi()) scheduleGrouping(true);
  });
  manager.subscribePlayers(() => renderRelations());
  bonds.subscribe(() => renderRelations());

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", ensureUi, { once: true });
  else ensureUi();
})(window);
