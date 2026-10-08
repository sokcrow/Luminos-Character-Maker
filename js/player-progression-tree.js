(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerProgressionTree) return;

  const PLAYER_ROOT = "campaña/jugadores";
  const PLAYER_ID_STORAGE_KEY = "playerId";
  const state = {
    db: null,
    playerId: null,
    character: null,
    playerRef: null,
    playerListener: null,
    root: null,
    detail: null,
    detailAnchor: null,
    signature: "",
    retryTimer: null,
    booted: false,
  };

  const clean = (value) => String(value ?? "").trim();
  const core = () => global.LuminousPlayerProgressionTreeCore || null;
  const mobileLayout = global.matchMedia?.("(max-width: 760px)") || null;

  function ensureStyles() {
    if (doc.getElementById("player-progression-tree-stylesheet")) return;
    const link = doc.createElement("link");
    link.id = "player-progression-tree-stylesheet";
    link.rel = "stylesheet";
    link.href = "css/player-progression-tree.css";
    link.dataset.ui = "player-progression";
    (doc.head || doc.documentElement).appendChild(link);
  }

  function currentPlayerId() {
    return clean(global.localStorage?.getItem?.(PLAYER_ID_STORAGE_KEY) || global.currentPlayerId || state.playerId);
  }

  function currentCharacter() {
    return state.character || global.datosJugador || {};
  }

  function statusLabel(status) {
    return ({
      earned: "OBTENIDO",
      future: "FUTURO",
      selected: "ELEGIDO",
      available: "DISPONIBLE",
      locked: "BLOQUEADO",
      preview: "PREVIEW",
    })[status] || String(status || "").toUpperCase();
  }

  function nodeTitle(node) {
    if (!node?.items?.length) return `LV.${node?.level || "?"}`;
    if (node.items.length === 1) return node.items[0].name;
    return `${node.items.length} mejoras`;
  }

  function formulaLabel(path) {
    return String(path || "Formula")
      .replace(/\.mechanics\./g, " · ")
      .replace(/\.rules\.\d+\./g, " · ")
      .replace(/\.effects\.\d+\./g, " · ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_\.]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function clearDetail() {
    if (!state.detail) return;
    state.detail.hidden = true;
    state.detailAnchor = null;
    state.detail.replaceChildren();
  }

  function syncDetailPlacement() {
    if (!state.detail || state.detail.hidden) return;
    const anchor = state.detailAnchor;
    if (mobileLayout?.matches && anchor && state.root?.contains(anchor) && anchor.parentElement) {
      // The mobile grid shows the detail after the tapped milestone.
      anchor.after(state.detail);
    } else if (state.root?.parentElement) {
      // On desktop the detail spans the full width, never a 150px tree track.
      state.root.after(state.detail);
    }
  }

  function placeDetail(anchor) {
    if (!state.detail) return;
    state.detailAnchor = anchor;
    state.detail.hidden = false;
    syncDetailPlacement();
  }

  function showNodeDetail(classModel, node, branch = null, anchor = null) {
    if (!state.detail || !node) return;
    placeDetail(anchor);
    const items = (node.items || []).map((item) => {
      const formulas = (item.formulas || []).map((formula) => {
        const value = formula.value == null ? "—" : String(Number.isFinite(Number(formula.value)) ? Math.round(Number(formula.value) * 100) / 100 : formula.value);
        return `<li><span>${escapeHtml(formulaLabel(formula.path))}</span><code>${escapeHtml(String(formula.formula))}</code><b>${escapeHtml(value)}</b></li>`;
      }).join("");
      return `
        <article class="player-progression-detail__item">
          <div class="player-progression-detail__item-head">
            <span class="player-progression-kind">${escapeHtml(item.kind)}</span>
            <strong>${escapeHtml(item.name)}</strong>
          </div>
          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
          ${formulas ? `
            <div class="player-progression-formulas">
              <small>PREVIEW FIJO EN CLASS LV.${node.level}</small>
              <ul>${formulas}</ul>
            </div>` : ""}
        </article>`;
    }).join("");

    state.detail.innerHTML = `
      <header class="player-progression-detail__header">
        <div>
          <span>${escapeHtml(classModel.className)}${branch ? ` · ${escapeHtml(branch.name)}` : ""}</span>
          <h3>CLASS LV.${node.level}</h3>
        </div>
        <b class="player-progression-state is-${escapeHtml(node.status)}">${escapeHtml(statusLabel(node.status))}</b>
      </header>
      <div class="player-progression-detail__items">${items || "<p>Sin recompensas registradas en este nodo.</p>"}</div>`;
  }

  function showBranchDetail(classModel, branch, anchor = null) {
    if (!state.detail || !branch) return;
    placeDetail(anchor);
    const stateCopy = branch.status === "selected"
      ? `Elegido en Class LV.${branch.selectedAtClassLevel || branch.unlockLevel}. Esta elección queda fijada salvo reset del DM.`
      : branch.status === "locked"
        ? "Bloqueado porque esta clase ya eligió otro arquetipo. Puedes seguir inspeccionando esta rama."
        : branch.status === "available"
          ? "Este arquetipo está disponible para elegir ahora."
          : `Se desbloquea en Class LV.${branch.unlockLevel}.`;

    state.detail.innerHTML = `
      <header class="player-progression-detail__header">
        <div>
          <span>${escapeHtml(classModel.className)} · ARCHETYPE</span>
          <h3>${escapeHtml(branch.name)}</h3>
        </div>
        <b class="player-progression-state is-${escapeHtml(branch.status)}">${escapeHtml(statusLabel(branch.status))}</b>
      </header>
      <div class="player-progression-detail__branch">
        <p>${escapeHtml(branch.description || "Sin descripción registrada.")}</p>
        <p><strong>Unlock:</strong> Class LV.${branch.unlockLevel}</p>
        <p>${escapeHtml(stateCopy)}</p>
      </div>`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function createNode(classModel, node, branch = null) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = `player-progression-node is-${node.status}`;
    button.dataset.progressionLevel = String(node.level);
    button.dataset.progressionStatus = node.status;
    button.innerHTML = `
      <span class="player-progression-node__level">LV.${node.level}</span>
      <strong>${escapeHtml(nodeTitle(node))}</strong>
      <small>${escapeHtml(statusLabel(node.status))}</small>`;
    button.setAttribute("aria-controls", "player-progression-detail");
    const inspect = () => showNodeDetail(classModel, node, branch, button);
    button.addEventListener("mouseenter", inspect);
    button.addEventListener("focus", inspect);
    button.addEventListener("click", inspect);
    return button;
  }

  async function selectArchetype(classId, archetypeId) {
    const character = currentCharacter();
    const engine = global.LuminousArchetypeEngine;
    const catalog = global.LuminousArchetypeTraitCatalog;
    const playerId = currentPlayerId();
    const db = state.db || global.firebase?.database?.();
    if (!engine?.selectArchetype || !catalog?.allArchetypes) {
      throw new Error("El catálogo de arquetipos todavía no está disponible.");
    }
    if (!db?.ref || !playerId) {
      throw new Error("No hay conexión para guardar el arquetipo. Comprueba tu sesión.");
    }
    const selections = engine.selectArchetype(character, classId, archetypeId, catalog.allArchetypes());
    // Persist first. Do not pretend a local-only choice was saved.
    await db.ref(`${PLAYER_ROOT}/${playerId}/characterBuild/archetypes`).set(selections);
    if (!character.characterBuild || typeof character.characterBuild !== "object") character.characterBuild = {};
    character.characterBuild.archetypes = selections;
    global.LuminousPlayerTraitRuntime?.refresh?.();
    return true;
  }

  function branchCell(classModel, branch) {
    const card = doc.createElement("article");
    card.className = `player-progression-branch-label is-${branch.status}`;
    card.dataset.progressionKey = `${classModel.classId}:archetype:${branch.id}`;
    card.setAttribute("aria-pressed", "false");
    const header = doc.createElement("div");
    header.className = "player-progression-branch-label__identity";
    header.innerHTML = `
      <span>LV. ${branch.unlockLevel} REQUERIDO</span>
      <strong>${escapeHtml(branch.name)}</strong>
      <small>${escapeHtml(statusLabel(branch.status))}</small>`;
    const actions = doc.createElement("div");
    actions.className = "player-progression-branch-label__actions";
    const preview = doc.createElement("button");
    preview.type = "button";
    preview.className = "player-progression-branch-preview";
    preview.textContent = "VER HITOS";
    preview.setAttribute("aria-controls", "player-progression-detail");
    const inspect = () => showBranchDetail(classModel, branch, card);
    card.__inspect = inspect;
    preview.addEventListener("click", inspect);
    actions.appendChild(preview);
    card.append(header, actions);
    if (branch.status === "available") {
      const choose = doc.createElement("button");
      choose.type = "button";
      choose.className = "player-progression-branch-choose";
      choose.textContent = "ELEGIR ARQUETIPO";
      choose.setAttribute("aria-label", `Elegir ${branch.name} para ${classModel.className}`);
      const feedback = doc.createElement("p");
      feedback.className = "player-progression-choose-error";
      feedback.setAttribute("role", "alert");
      feedback.hidden = true;
      choose.addEventListener("click", async () => {
        choose.disabled = true;
        choose.textContent = "GUARDANDO…";
        feedback.hidden = true;
        try {
          await selectArchetype(classModel.classId, branch.id);
          state.selectedKey = card.dataset.progressionKey;
          render(true);
        } catch (error) {
          feedback.textContent = error?.message || "No se pudo guardar el arquetipo.";
          feedback.hidden = false;
          choose.disabled = false;
          choose.textContent = "ELEGIR ARQUETIPO";
        }
      });
      actions.appendChild(choose);
      card.appendChild(feedback);
    } else {
      const status = doc.createElement("span");
      status.className = "player-progression-branch-status";
      status.textContent = branch.status === "selected" ? "ELEGIDO"
        : branch.status === "locked" ? "OTRA RAMA ELEGIDA"
        : `DISPONIBLE EN LV. ${branch.unlockLevel}`;
      actions.appendChild(status);
    }
    return card;
  }

  function installHorizontalWheel(scroller) {
    if (!scroller || scroller.__progressionWheelBound) return;
    scroller.__progressionWheelBound = true;
    scroller.addEventListener("wheel", (event) => {
      if (scroller.scrollWidth <= scroller.clientWidth + 2) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      const before = scroller.scrollLeft;
      scroller.scrollLeft += event.deltaY;
      if (scroller.scrollLeft !== before) event.preventDefault();
    }, { passive: false });
  }

  function renderClassTree(classModel) {
    const section = doc.createElement("section");
    section.className = "player-progression-class";
    section.dataset.classId = classModel.classId;
    const heading = doc.createElement("header");
    heading.className = "player-progression-class__header";
    heading.innerHTML = `<div><span>AVANCE DE CLASE</span><h2>${escapeHtml(classModel.className)}</h2></div><b>LV. ${classModel.classLevel}</b>`;
    section.appendChild(heading);
    const milestones = doc.createElement("section");
    milestones.className = "player-progression-milestones";
    milestones.innerHTML = `<header class="player-progression-section-title"><h3>Hitos</h3><span>Selecciona un nivel para ver sus mejoras</span></header>`;
    const list = doc.createElement("div");
    list.className = "player-progression-grid player-progression-milestone-list";
    const nodes = [
      ...classModel.commonNodes.map(node=>({node,branch:null})),
      ...classModel.branches.filter(b=>b.status==="selected").flatMap(branch=>branch.nodes.map(node=>({node,branch})))
    ].sort((a,b)=>a.node.level-b.node.level);
    nodes.forEach(({node,branch})=>list.appendChild(createNode(classModel,node,branch)));
    if (!nodes.length) {
      const empty = doc.createElement("p");
      empty.className = "player-progression-class__empty";
      empty.textContent = "Sin hitos de clase registrados. Revisa los arquetipos debajo.";
      list.appendChild(empty);
    }
    milestones.appendChild(list);
    section.appendChild(milestones);
    if (classModel.branches.length) {
      const archetypes = doc.createElement("section");
      archetypes.className = "player-progression-archetypes";
      archetypes.innerHTML = `<header class="player-progression-section-title"><h3>Arquetipos</h3><span>Elige uno cuando alcance el nivel requerido</span></header>`;
      const cards = doc.createElement("div");
      cards.className = "player-progression-archetype-list";
      classModel.branches.forEach(branch=>cards.appendChild(branchCell(classModel,branch)));
      archetypes.appendChild(cards);
      section.appendChild(archetypes);
    }
    return section;
  }

  function removeLegacyArchetypeSelector() {
    doc.getElementById("player-archetype-selector")?.remove();
  }

  function render(force = false) {
    const host = doc.getElementById("player-progression-tree-host");
    if (!host || !core()) return false;
    state.root = host;
    state.detail = doc.getElementById("player-progression-detail") || state.detail;
    removeLegacyArchetypeSelector();

    const character = currentCharacter();
    const model = core().buildProgressionModel(character, {
      traitCatalog: global.LuminousTraitCatalogCore,
      archetypeCatalog: global.LuminousArchetypeTraitCatalog,
      traitEngine: global.LuminousTraitEngine,
      classDefinitions: global.LuminousCharacterBuildRules?.CLASSES || [],
    });
    const signature = JSON.stringify({
      playerId: currentPlayerId(),
      model,
      catalogVersion: global.LuminousTraitCatalogCore?.VERSION || global.LuminousTraitCatalogCore?.version || null,
    });
    if (!force && signature === state.signature) return true;
    state.signature = signature;

    // Only move the shared panel before actually replacing the tree.
    // Otherwise an unrelated HP/player-data update would displace an open
    // mobile detail from its selected milestone.
    if (state.detail && host.contains(state.detail)) host.after(state.detail);
    host.replaceChildren();
    if (!model.classes.length) {
      const empty = doc.createElement("div");
      empty.className = "player-progression-empty";
      empty.innerHTML = "<strong>SIN CLASE ASIGNADA</strong><span>Tu build todavía no contiene niveles de clase.</span>";
      host.appendChild(empty);
      clearDetail();
      return true;
    }

    model.classes.forEach((classModel) => host.appendChild(renderClassTree(classModel)));
    clearDetail();
    return true;
  }

  function bindPlayer() {
    const playerId = currentPlayerId();
    state.playerId = playerId || state.playerId;
    state.character = global.datosJugador || state.character || {};
    return Boolean(state.playerId || state.character);
  }

  function handlePlayerData(event) {
    const detail = event?.detail || {};
    const incomingId = clean(detail.playerId || currentPlayerId());
    const activeId = currentPlayerId();
    if (incomingId && activeId && incomingId !== activeId) return;
    state.playerId = incomingId || state.playerId;
    state.character = detail.data || global.datosJugador || {};
    render(false);
  }

  function connectFirebase() {
    if (state.db) return true;
    if (!global.firebase?.database || !global.firebase?.apps?.length) return false;
    state.db = global.firebase.database();
    return true;
  }

  function refresh() {
    state.signature = "";
    bindPlayer();
    return render(true);
  }

  function boot() {
    if (state.booted) return true;
    ensureStyles();
    if (!doc.getElementById("player-progression-tree-host") || !core()) return false;
    connectFirebase();
    bindPlayer();
    render(true);
    global.addEventListener?.("luminous:player-data", handlePlayerData);
    mobileLayout?.addEventListener?.("change", syncDetailPlacement);

    [
      "luminous:traits-refreshed",
      "luminous:class-runtimes-ready",
      "luminous:class-runtime-loaded",
      "luminous:archetype-selection-changed",
    ].forEach((name) => global.addEventListener?.(name, () => refresh()));

    const perksButton = doc.querySelector('[name="act_hud_perks"]');
    perksButton?.addEventListener("click", () => global.setTimeout(() => refresh(), 0));
    state.booted = true;
    return true;
  }

  const api = Object.freeze({
    version: "0.1.0",
    handlesArchetypeSelection: true,
    state,
    render,
    refresh,
    selectArchetype,
  });
  global.LuminousPlayerProgressionTree = api;

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", () => {
      if (boot()) return;
      state.retryTimer = global.setInterval(() => {
        if (boot()) {
          global.clearInterval(state.retryTimer);
          state.retryTimer = null;
        }
      }, 250);
    }, { once: true });
  } else if (!boot()) {
    state.retryTimer = global.setInterval(() => {
      if (boot()) {
        global.clearInterval(state.retryTimer);
        state.retryTimer = null;
      }
    }, 250);
  }
})(typeof window !== "undefined" ? window : globalThis);
