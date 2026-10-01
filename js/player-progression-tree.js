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
    signature: "",
    retryTimer: null,
    booted: false,
    activeView: "traits",
  };

  const clean = (value) => String(value ?? "").trim();
  const core = () => global.LuminousPlayerProgressionTreeCore || null;

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

  function setTextAll(selector, value) {
    doc.querySelectorAll(selector).forEach((node) => { node.textContent = String(value ?? ""); });
  }

  function syncDossierImage(imageSelector, emptySelector, src) {
    const image = doc.querySelector(imageSelector);
    const empty = doc.querySelector(emptySelector);
    const url = clean(src);
    if (!image) return;
    if (!url) {
      image.hidden = true;
      image.removeAttribute("src");
      if (empty) empty.hidden = false;
      return;
    }
    if (image.getAttribute("src") !== url) image.src = url;
    image.hidden = false;
    if (empty) empty.hidden = true;
  }

  function statsText(selector, fallback = "") {
    const value = doc.querySelector(`#stats-modal ${selector}`)?.textContent;
    return clean(value) || String(fallback ?? "");
  }

  function signed(value, fallback = "+1") {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return number >= 0 ? `+${number}` : String(number);
  }

  function syncTraitsDossier(character = currentCharacter()) {
    const data = character || {};
    const name = clean(data.characterName || data.character_name || data.nombre || data.name) || "PLAYER";
    const level = Math.max(1, Number.parseInt(data.level ?? data?.characterBuild?.calculatedAtLevel, 10) || 1);
    const art = clean(data.sheetArt || data.playerSheetArt || data.characterArt || data.portrait);
    const icon = clean(data.icono_jugador || data.icono || data?.perfil?.icono || data.characterIcon);
    const stats = global.LuminousPlayerStats;
    const xp = Math.max(0, Number.parseInt(data.xp, 10) || 0);
    const progressRaw = Number(stats?.levelProgress?.(data));
    const progress = Number.isFinite(progressRaw) ? Math.max(0, Math.min(100, Math.round(progressRaw))) : 0;
    const proficiency = stats?.proficiencyBonus?.(level);
    const offensive = stats?.combatLevelBreakdown?.("offensive", data)?.total;
    const defensive = stats?.combatLevelBreakdown?.("defensive", data)?.total;
    const heads = stats?.headsChance?.(data);

    setTextAll("[data-progression-trait-name]", name);
    setTextAll("[data-progression-trait-level]", level);
    setTextAll("[data-progression-trait-xp-current]", statsText("[data-player-xp-current]", xp));
    setTextAll("[data-progression-trait-xp-progress]", statsText("[data-player-xp-progress]", `${progress}%`));
    setTextAll("[data-progression-trait-prof]", statsText("[data-player-proficiency]", signed(proficiency)));
    setTextAll("[data-progression-trait-off]", statsText("[data-player-offensive-level]", Number.isFinite(Number(offensive)) ? offensive : level));
    setTextAll("[data-progression-trait-def]", statsText("[data-player-defensive-level]", Number.isFinite(Number(defensive)) ? defensive : level));
    setTextAll("[data-progression-trait-heads]", statsText("[data-player-heads-chance]", Number.isFinite(Number(heads)) ? `${heads}%` : "50%"));
    setTextAll("[data-progression-trait-hp-current]", statsText("[data-player-hp-current]", data.currentHp ?? data.currentHP ?? data.hp ?? 0));
    setTextAll("[data-progression-trait-hp-max]", statsText("[data-player-hp-max]", data.maxHp ?? data.maxHP ?? data.hpMax ?? 0));

    doc.querySelectorAll("[data-progression-trait-xp-fill]").forEach((node) => { node.style.width = `${progress}%`; });
    doc.querySelectorAll(".player-progression-traits-xp-track").forEach((node) => { node.setAttribute("aria-valuenow", String(progress)); });

    syncDossierImage("[data-progression-trait-art]", "[data-progression-trait-art-empty]", art);
    syncDossierImage("[data-progression-trait-icon]", "[data-progression-trait-icon-empty]", icon);
  }

  function setPrimaryView(view = "traits") {
    const next = view === "tree" ? "tree" : "traits";
    state.activeView = next;

    doc.querySelectorAll("[data-progression-view]").forEach((panel) => {
      panel.hidden = panel.dataset.progressionView !== next;
    });
    doc.querySelectorAll("[data-progression-view-target]").forEach((button) => {
      const active = button.dataset.progressionViewTarget === next;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });

    if (next === "traits") {
      global.LuminousPlayerTraitRuntime?.refresh?.();
      syncTraitsDossier(currentCharacter());
    } else {
      render(true);
    }
    return next;
  }

  function bindPrimaryViewTabs() {
    doc.querySelectorAll("[data-progression-view-target]").forEach((button) => {
      if (button.__progressionPrimaryBound) return;
      button.__progressionPrimaryBound = true;
      button.addEventListener("click", () => setPrimaryView(button.dataset.progressionViewTarget));
      button.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const next = event.key === "ArrowLeft" || event.key === "Home" ? "traits" : "tree";
        setPrimaryView(next);
        doc.querySelector(`[data-progression-view-target="${next}"]`)?.focus();
      });
    });
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
    state.detail.innerHTML = `
      <div class="player-progression-detail__empty">
        <strong>INSPECCIONA EL ÁRBOL</strong>
        <span>Pasa el mouse o enfoca un nodo para ver exactamente lo que concede en ese nivel.</span>
      </div>`;
  }

  function showNodeDetail(classModel, node, branch = null) {
    if (!state.detail || !node) return;
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

  function showBranchDetail(classModel, branch) {
    if (!state.detail || !branch) return;
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
    const inspect = () => showNodeDetail(classModel, node, branch);
    button.addEventListener("mouseenter", inspect);
    button.addEventListener("focus", inspect);
    return button;
  }

  async function selectArchetype(classId, archetypeId) {
    const character = currentCharacter();
    const runtime = global.LuminousArchetypeRuntime;
    if (runtime?.persistArchetypeSelection) {
      await runtime.persistArchetypeSelection(classId, archetypeId);
      return true;
    }

    const engine = global.LuminousArchetypeEngine;
    const catalog = global.LuminousArchetypeTraitCatalog;
    const playerId = currentPlayerId();
    if (!engine?.selectArchetype || !catalog?.allArchetypes || !state.db || !playerId) {
      throw new Error("Archetype runtime is not ready.");
    }
    const selections = engine.selectArchetype(character, classId, archetypeId, catalog.allArchetypes());
    await state.db.ref(`${PLAYER_ROOT}/${playerId}/characterBuild/archetypes`).set(selections);
    return true;
  }

  function branchCell(classModel, branch) {
    const wrap = doc.createElement("div");
    wrap.className = `player-progression-branch-label is-${branch.status}`;
    wrap.tabIndex = 0;
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", `${branch.name}, ${statusLabel(branch.status)}`);
    wrap.innerHTML = `
      <span>ARCHETYPE · LV.${branch.unlockLevel}</span>
      <strong>${escapeHtml(branch.name)}</strong>
      <small>${escapeHtml(statusLabel(branch.status))}</small>`;
    const inspect = () => showBranchDetail(classModel, branch);
    wrap.addEventListener("mouseenter", inspect);
    wrap.addEventListener("focus", inspect);

    if (branch.status === "available") {
      const choose = doc.createElement("button");
      choose.type = "button";
      choose.className = "player-progression-branch-choose";
      choose.textContent = "ELEGIR RAMA";
      choose.addEventListener("click", async (event) => {
        event.stopPropagation();
        choose.disabled = true;
        choose.textContent = "GUARDANDO...";
        try {
          await selectArchetype(classModel.classId, branch.id);
        } catch (error) {
          global.alert?.(error?.message || "No se pudo elegir el arquetipo.");
        } finally {
          choose.disabled = false;
          choose.textContent = "ELEGIR RAMA";
        }
      });
      wrap.appendChild(choose);
    }
    return wrap;
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
    heading.innerHTML = `
      <div>
        <span>CLASS PROGRESSION</span>
        <h2>${escapeHtml(classModel.className)}</h2>
      </div>
      <b>CLASS LV.${classModel.classLevel}</b>`;
    section.appendChild(heading);

    const scroller = doc.createElement("div");
    scroller.className = "player-progression-tree-scroll";
    installHorizontalWheel(scroller);

    const levels = classModel.levels.length ? classModel.levels : [1];
    const columnIndex = new Map(levels.map((level, index) => [level, index + 2]));
    const grid = doc.createElement("div");
    grid.className = "player-progression-grid";
    grid.style.gridTemplateColumns = `180px repeat(${levels.length}, 190px)`;

    const corner = doc.createElement("div");
    corner.className = "player-progression-grid__corner";
    corner.textContent = "RUTA";
    grid.appendChild(corner);

    levels.forEach((level) => {
      const marker = doc.createElement("div");
      marker.className = "player-progression-level-marker";
      marker.textContent = `LV.${level}`;
      grid.appendChild(marker);
    });

    const baseLabel = doc.createElement("div");
    baseLabel.className = "player-progression-lane-label is-base";
    baseLabel.innerHTML = "<span>BASE CLASS</span><strong>TRONCO COMÚN</strong>";
    grid.appendChild(baseLabel);
    levels.forEach(() => {
      const rail = doc.createElement("div");
      rail.className = "player-progression-rail";
      grid.appendChild(rail);
    });
    classModel.commonNodes.forEach((node) => {
      const item = createNode(classModel, node);
      item.style.gridColumn = String(columnIndex.get(node.level));
      item.style.gridRow = "2";
      grid.appendChild(item);
    });

    classModel.branches.forEach((branch, branchIndex) => {
      const row = branchIndex + 3;
      const label = branchCell(classModel, branch);
      label.style.gridColumn = "1";
      label.style.gridRow = String(row);
      grid.appendChild(label);

      levels.forEach((level) => {
        const rail = doc.createElement("div");
        rail.className = `player-progression-rail is-branch ${level < branch.unlockLevel ? "is-before-unlock" : ""}`;
        rail.style.gridRow = String(row);
        rail.style.gridColumn = String(columnIndex.get(level));
        grid.appendChild(rail);
      });

      branch.nodes.forEach((node) => {
        const item = createNode(classModel, node, branch);
        item.style.gridColumn = String(columnIndex.get(node.level));
        item.style.gridRow = String(row);
        grid.appendChild(item);
      });
    });

    if (!classModel.commonNodes.length && !classModel.branches.length) {
      const empty = doc.createElement("div");
      empty.className = "player-progression-class__empty";
      empty.textContent = "Esta clase todavía no tiene una progresión registrada en los catálogos.";
      grid.appendChild(empty);
    }

    scroller.appendChild(grid);
    section.appendChild(scroller);
    return section;
  }

  function removeLegacyArchetypeSelector() {
    doc.getElementById("player-archetype-selector")?.remove();
  }

  function render(force = false) {
    const host = doc.getElementById("player-progression-tree-host");
    if (!host || !core()) return false;
    state.root = host;
    state.detail = doc.getElementById("player-progression-detail");
    removeLegacyArchetypeSelector();

    const character = currentCharacter();
    syncTraitsDossier(character);
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
    if (!playerId || !state.db) {
      state.character = global.datosJugador || null;
      render(true);
      return false;
    }
    if (state.playerId === playerId && state.playerRef) return true;

    if (state.playerRef && state.playerListener) state.playerRef.off("value", state.playerListener);
    state.playerId = playerId;
    state.playerRef = state.db.ref(`${PLAYER_ROOT}/${playerId}`);
    state.playerListener = (snapshot) => {
      state.character = snapshot.val() || global.datosJugador || {};
      state.signature = "";
      render(true);
    };
    state.playerRef.on("value", state.playerListener);
    return true;
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
    bindPrimaryViewTabs();
    render(true);
    setPrimaryView("traits");

    [
      "luminous:traits-refreshed",
      "luminous:class-runtimes-ready",
      "luminous:class-runtime-loaded",
      "luminous:archetype-selection-changed",
    ].forEach((name) => global.addEventListener?.(name, () => refresh()));

    const perksButton = doc.querySelector('[name="act_hud_perks"]');
    perksButton?.addEventListener("click", () => global.setTimeout(() => {
      setPrimaryView("traits");
      refresh();
    }, 0));
    state.booted = true;
    return true;
  }

  const api = Object.freeze({
    version: "0.1.0",
    handlesArchetypeSelection: true,
    state,
    render,
    refresh,
    setPrimaryView,
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
