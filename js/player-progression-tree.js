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
    selectedKey: null,
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
    if (!doc.getElementById("player-progression-mystic-stylesheet")) {
      const mystic = doc.createElement("link");
      mystic.id = "player-progression-mystic-stylesheet";
      mystic.rel = "stylesheet";
      mystic.href = "css/player-progression-mystic.css";
      mystic.dataset.ui = "player-progression";
      (doc.head || doc.documentElement).appendChild(mystic);
    }
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

  // Hand-drawn-style vector sigils are decorative only; the names and
  // unlock rules always come from the real character progression model.
  const SIGILS = Object.freeze({
    compass: '<circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="7"/><path d="M32 3 38 23 61 32 38 39 32 61 25 39 3 32 25 25Z"/><path d="M13 13 20 20M51 13 44 20M13 51 20 44M51 51 44 44"/>',
    book: '<path d="M32 50C24 45 15 45 7 48V15c10-4 18-2 25 3 7-5 15-7 25-3v33c-8-3-17-3-25 2Z"/><path d="M32 18v32M13 23c7-2 12-1 16 2M35 25c6-3 10-4 16-2M13 31c7-2 12-1 16 2M35 33c6-3 10-4 16-2"/>',
    moon: '<path d="M45 10A23 23 0 1 0 54 45 23 23 0 0 1 45 10Z"/><path d="m45 16 2 4 5 1-5 2-2 4-2-4-5-2 5-1 2-4ZM15 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>',
    flame: '<path d="M34 5c5 14-5 17 4 29 2-9 9-13 9-13 13 25-1 37-15 37-15 0-25-12-17-29 1 10 10 13 10 13C16 25 29 16 34 5Z"/><path d="M32 32c6 10-1 12 1 18-10 1-15-9-1-18Z"/>',
    star: '<path d="M32 4 38 25 60 32 38 38 32 60 26 38 4 32 26 25Z"/><circle cx="32" cy="32" r="6"/><path d="M10 10l7 7M54 10l-7 7M10 54l7-7M54 54l-7-7"/>',
    rune: '<circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="15"/><path d="M32 5v54M5 32h54M14 14l36 36M50 14 14 50"/><path d="m32 16 14 24H18Z"/>',
    sword: '<path d="m47 5 10 10-27 27-10-10Z"/><path d="m17 29 18 18M18 44l-9 9M8 56l-3-3 12-12"/><path d="m47 5 4 16 6-6Z"/>',
    shield: '<path d="M32 5 53 13v16c0 15-9 24-21 30C20 53 11 44 11 29V13Z"/><path d="M32 16v31M21 32h22"/>',
    crown: '<path d="m8 21 12 10 12-19 12 19 12-10-5 26H13Z"/><path d="M14 52h36M20 41h24"/>',
    hourglass: '<path d="M17 7h30M17 57h30M21 8c0 15 11 15 11 24s-11 9-11 24M43 8c0 15-11 15-11 24s11 9 11 24"/><path d="m26 23 6 7 6-7M26 49l6-8 6 8"/>',
    crystal: '<path d="m20 5 23 0 13 22-24 32L8 27Z"/><path d="M20 5 17 27l15 32 15-32-4-22M8 27h48M17 27h30"/>',
    hand: '<path d="M23 52V33l-5-12c-2-5 3-8 6-3l8 12V8c0-5 7-5 7 0v17-10c0-5 7-5 7 0v14-8c0-5 7-5 7 0v15c0 13-8 23-19 23H23Z"/><path d="M17 52h28"/>',
  });

  function sigilSvg(kind) {
    const glyph = SIGILS[kind] || SIGILS.star;
    return `<svg class="player-progression-sigil" viewBox="0 0 64 64" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>`;
  }

  function sigilFor(name, index = 0) {
    const label = clean(name).toLowerCase();
    if (/shadow|night|moon|whisper|intrigue|mastermind|rogue/.test(label)) return "moon";
    if (/song|bard|spell|wizard|arcane|lore|book|college/.test(label)) return "book";
    if (/devil|zealot|rage|fire|fury|flame|berserk/.test(label)) return "flame";
    if (/champion|samurai|fighter|blade|sword/.test(label)) return "sword";
    if (/ranger|marksman|buccaneer|demolisher|shot/.test(label)) return "crystal";
    if (/healing|guardian|protect|armor|shield/.test(label)) return "shield";
    if (/leader|banneret|king|knight|royal/.test(label)) return "crown";
    if (/time|slow|fast|speed|rest/.test(label)) return "hourglass";
    return ["star", "rune", "hand", "compass", "moon", "crystal"][index % 6];
  }

  function branchMilestones(classModel, branch) {
    const recorded = new Map((branch.nodes || []).map((node) => [Number(node.level), node]));
    const levels = [...new Set([
      ...(Array.isArray(branch.traitLevels) ? branch.traitLevels : []),
      ...recorded.keys(),
    ].map(Number).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
    return levels.map((level) => recorded.get(level) || {
      level,
      items: [],
      status: branch.status === "locked" ? "locked"
        : branch.status === "selected"
          ? (level <= classModel.classLevel ? "earned" : "future")
          : "preview",
    });
  }

  function clearDetail() {
    if (!state.detail) return;
    state.detail.hidden = true;
    state.detailAnchor?.classList?.remove("is-inspected");
    state.detailAnchor?.setAttribute?.("aria-pressed", "false");
    state.detailAnchor = null;
    state.selectedKey = null;
    state.detail.replaceChildren();
  }

  function syncDetailPlacement() {
    if (!state.detail || state.detail.hidden) return;
    const anchor = state.detailAnchor;
    // Details belong outside the painted tree, never in a narrow node/branch
    // column where they break connectors or obscure selectable circles.
    if (anchor && state.root?.contains(anchor)) {
      const classSection = anchor.closest?.(".player-progression-class");
      if (classSection?.parentElement) classSection.after(state.detail);
      else if (state.root?.parentElement) state.root.after(state.detail);
    } else if (state.root?.parentElement) {
      state.root.after(state.detail);
    }
  }

  function placeDetail(anchor) {
    if (!state.detail || !anchor) return;
    if (state.detailAnchor !== anchor) {
      state.detailAnchor?.classList?.remove("is-inspected");
      state.detailAnchor?.setAttribute?.("aria-pressed", "false");
    }
    state.detailAnchor = anchor;
    state.selectedKey = anchor.dataset.progressionKey || null;
    anchor.classList.add("is-inspected");
    anchor.setAttribute("aria-pressed", "true");
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
          <h3>Hito · Nivel ${node.level}</h3>
        </div>
        <b class="player-progression-state is-${escapeHtml(node.status)}">${escapeHtml(statusLabel(node.status))}</b>
      </header>
      <p class="player-progression-detail__guidance">Los hitos se obtienen automáticamente al alcanzar el nivel. Aquí puedes consultar sus recompensas.</p>
      <div class="player-progression-detail__items">${items || "<p>Sin recompensas registradas en este hito.</p>"}</div>`;
  }

  function showBranchDetail(classModel, branch, anchor = null) {
    if (!state.detail || !branch) return;
    placeDetail(anchor);
    const message = branch.status === "selected"
      ? "Este arquetipo ya está elegido para tu clase."
      : branch.status === "locked"
        ? "Ya elegiste otro arquetipo para esta clase. El DM debe restablecer la elección para cambiarla."
        : branch.status === "available"
          ? "Puedes elegir este arquetipo ahora con el botón de su tarjeta."
          : `Disponible al alcanzar el nivel ${branch.unlockLevel} en ${classModel.className}.`;
    const milestones = branchMilestones(classModel, branch).map(node => `
      <li><b>LV. ${node.level}</b><span>${(node.items || []).map(item=>escapeHtml(item.name)).join(", ") || "Mejora del arquetipo"}</span></li>`).join("");
    state.detail.innerHTML = `
      <header class="player-progression-detail__header">
        <div><span>${escapeHtml(classModel.className)} · ARQUETIPO</span><h3>${escapeHtml(branch.name)}</h3></div>
        <b class="player-progression-state is-${escapeHtml(branch.status)}">${escapeHtml(statusLabel(branch.status))}</b>
      </header>
      <div class="player-progression-detail__branch">
        ${branch.description ? `<p>${escapeHtml(branch.description)}</p>` : ""}
        <p class="player-progression-detail__guidance">${escapeHtml(message)}</p>
        ${milestones ? `<strong>Hitos de esta rama</strong><ul class="player-progression-archetype-rewards">${milestones}</ul>` : ""}
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
    button.className = `player-progression-node is-${node.status} ${branch ? "is-archetype-milestone" : "is-class-milestone"}`;
    button.dataset.progressionLevel = String(node.level);
    button.dataset.progressionStatus = node.status;
    button.dataset.progressionKey = `${classModel.classId}:milestone:${branch?.id || "base"}:${node.level}`;
    button.setAttribute("aria-controls", "player-progression-detail");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("aria-label", `Ver hito de ${classModel.className} nivel ${node.level}: ${nodeTitle(node)}`);
    button.innerHTML = `
      <span class="player-progression-node__seal">${sigilSvg(sigilFor(nodeTitle(node), node.level))}</span>
      <span class="player-progression-node__level">LV. ${node.level}</span>
      <strong>${escapeHtml(nodeTitle(node))}</strong>
      <small>${escapeHtml(statusLabel(node.status))}</small>`;
    const inspect = () => showNodeDetail(classModel, node, branch, button);
    button.__inspect = inspect;
    button.addEventListener("click", inspect);
    button.addEventListener("click", () => state.detail?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }));
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

  function branchCell(classModel, branch, index = 0) {
    const card = doc.createElement("article");
    card.className = `player-progression-branch-label is-${branch.status}`;
    card.dataset.progressionKey = `${classModel.classId}:archetype:${branch.id}`;
    card.setAttribute("role", "group");
    card.setAttribute("aria-label", `${branch.name}, ${statusLabel(branch.status)}`);

    const preview = doc.createElement("button");
    preview.type = "button";
    preview.className = "player-progression-branch-preview";
    preview.setAttribute("aria-controls", "player-progression-detail");
    preview.setAttribute("aria-pressed", "false");
    preview.setAttribute("aria-label", `Ver rama ${branch.name} y sus hitos`);
    preview.dataset.progressionKey = card.dataset.progressionKey;
    preview.innerHTML = `
      <span class="player-progression-branch-preview__seal">${sigilSvg(sigilFor(branch.name, index))}</span>
      <strong>${escapeHtml(branch.name)}</strong>
      <small>LV. ${branch.unlockLevel} · ${escapeHtml(statusLabel(branch.status))}</small>`;
    const inspect = () => showBranchDetail(classModel, branch, preview);
    card.__inspect = inspect;
    preview.__inspect = inspect;
    preview.addEventListener("click", inspect);
    preview.addEventListener("click", () => state.detail?.scrollIntoView?.({ behavior: "smooth", block: "nearest" }));
    card.appendChild(preview);

    const actions = doc.createElement("div");
    actions.className = "player-progression-branch-label__actions";
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
      card.append(actions, feedback);
    } else {
      const status = doc.createElement("span");
      status.className = "player-progression-branch-status";
      status.textContent = branch.status === "selected" ? "✦ ELEGIDO"
        : branch.status === "locked" ? "OTRA RAMA ELEGIDA"
        : `DISPONIBLE EN LV. ${branch.unlockLevel}`;
      actions.appendChild(status);
      card.appendChild(actions);
    }

    const route = doc.createElement("div");
    route.className = "player-progression-branch-milestones";
    route.setAttribute("aria-label", `Hitos de ${branch.name}`);
    branchMilestones(classModel, branch).forEach((node) => {
      route.appendChild(createNode(classModel, node, branch));
    });
    if (!route.children.length) {
      const empty = doc.createElement("span");
      empty.className = "player-progression-route-empty";
      empty.textContent = "HITOS PENDIENTES DE REGISTRO";
      route.appendChild(empty);
    }
    card.appendChild(route);
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
    section.className = "player-progression-class player-progression-mystic-class";
    section.dataset.classId = classModel.classId;

    const heading = doc.createElement("header");
    heading.className = "player-progression-class__header";
    heading.innerHTML = `
      <div><span>ÁRBOL DE ESPECIALIZACIÓN</span><h2>${escapeHtml(classModel.className)}</h2></div>
      <b>CLASS LV. ${classModel.classLevel}</b>`;
    section.appendChild(heading);

    const tools = doc.createElement("div");
    tools.className = "player-progression-tree-tools";
    const hint = doc.createElement("span");
    hint.className = "player-progression-tree-hint";
    hint.textContent = "Explora las ramas · toca un símbolo para ver sus hitos";
    const nav = doc.createElement("div");
    nav.className = "player-progression-tree-navigation";
    const previous = doc.createElement("button");
    previous.type = "button";
    previous.className = "player-progression-tree-arrow";
    previous.textContent = "‹";
    previous.setAttribute("aria-label", "Desplazar árbol hacia la izquierda");
    const next = doc.createElement("button");
    next.type = "button";
    next.className = "player-progression-tree-arrow";
    next.textContent = "›";
    next.setAttribute("aria-label", "Desplazar árbol hacia la derecha");
    nav.append(previous, next);
    tools.append(hint, nav);
    section.appendChild(tools);

    const viewport = doc.createElement("div");
    viewport.className = "player-progression-tree-scroll player-progression-mystic-scroll";
    viewport.tabIndex = 0;
    viewport.setAttribute("role", "region");
    viewport.setAttribute("aria-label", `Árbol de ${classModel.className}. Desliza o usa las flechas para explorar ramas.`);
    viewport.dataset.classId = classModel.classId;
    const tree = doc.createElement("div");
    tree.className = "player-progression-ritual-tree";
    tree.style.setProperty?.("--branch-count", String(Math.max(1, classModel.branches.length)));
    if (classModel.branches.length === 1) tree.classList.add("is-single-branch");

    const root = doc.createElement("div");
    root.className = "player-progression-root";
    root.innerHTML = `
      <span class="player-progression-root__seal">${sigilSvg("compass")}</span>
      <small>✦ NÚCLEO DE CLASE ✦</small>
      <strong>${escapeHtml(classModel.className)}</strong>`;
    tree.appendChild(root);

    const trunk = doc.createElement("section");
    trunk.className = "player-progression-milestones player-progression-trunk";
    trunk.innerHTML = `
      <header class="player-progression-section-title">
        <h3>HITOS DE CLASE</h3>
        <span>Se obtienen al alcanzar su nivel</span>
      </header>`;
    const list = doc.createElement("div");
    list.className = "player-progression-grid player-progression-milestone-list";
    classModel.commonNodes.forEach((node) => list.appendChild(createNode(classModel, node)));
    if (!classModel.commonNodes.length) {
      const empty = doc.createElement("p");
      empty.className = "player-progression-class__empty";
      empty.textContent = "No hay hitos de clase registrados en el catálogo.";
      list.appendChild(empty);
    }
    trunk.appendChild(list);
    tree.appendChild(trunk);

    if (classModel.branches.length) {
      const archetypes = doc.createElement("section");
      archetypes.className = "player-progression-archetypes player-progression-fork";
      archetypes.innerHTML = `
        <header class="player-progression-section-title">
          <h3>ARQUETIPOS</h3>
          <span>Elige una rama desbloqueada; las demás siguen visibles</span>
        </header>`;
      const cards = doc.createElement("div");
      cards.className = "player-progression-archetype-list";
      classModel.branches.forEach((branch, index) => cards.appendChild(branchCell(classModel, branch, index)));
      archetypes.appendChild(cards);
      tree.appendChild(archetypes);
    }

    viewport.appendChild(tree);
    section.appendChild(viewport);

    const syncArrows = () => {
      previous.disabled = viewport.scrollLeft <= 3;
      next.disabled = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 3;
    };
    const move = (direction) => {
      const distance = Math.max(180, Math.round(viewport.clientWidth * 0.65)) * direction;
      if (typeof viewport.scrollBy === "function") viewport.scrollBy({ left: distance, behavior: "smooth" });
      else viewport.scrollLeft += distance;
      syncArrows();
    };
    previous.addEventListener("click", () => move(-1));
    next.addEventListener("click", () => move(1));
    viewport.addEventListener("scroll", syncArrows, { passive: true });
    // A deferred update measures the stage after the modal's layout settles.
    global.requestAnimationFrame?.(syncArrows);
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

    const previousSelection = state.selectedKey;
    const scrollPositions = new Map(
      [...host.querySelectorAll(".player-progression-mystic-scroll")].map(node => [node.dataset.classId, node.scrollLeft]),
    );
    model.classes.forEach((classModel) => host.appendChild(renderClassTree(classModel)));
    host.querySelectorAll(".player-progression-mystic-scroll").forEach((viewport) => {
      const previous = scrollPositions.get(viewport.dataset.classId);
      if (Number.isFinite(previous)) viewport.scrollLeft = previous;
      else if (mobileLayout?.matches) viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
    });
    const selected = previousSelection
      ? [...host.querySelectorAll("[data-progression-key]")].find(item=>item.dataset.progressionKey===previousSelection)
      : null;
    if (selected?.__inspect) selected.__inspect();
    else clearDetail();
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
