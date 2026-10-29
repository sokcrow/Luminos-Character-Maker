(function (global) {
  "use strict";

  const document = global.document;
  if (!document?.body?.classList?.contains("on-game-dashboard")) return;
  if (global.LuminousDmTheatreWorkspace) return;

  const ICONS = Object.freeze({
    speak: "Assets/Images/Buttons/Auto Dialog.svg",
    cast: "Assets/Images/Buttons/Player.svg",
    scene: "Assets/Images/Buttons/Theatre.png",
    settings: "Assets/Images/Buttons/Option.svg"
  });
  const FALLBACK_NPC = ICONS.scene;
  const FALLBACK_PLAYER = ICONS.cast;
  const state = { npcs: {}, actorLibrary: {}, players: {}, sceneActors: {}, activeTab: "voices", query: "", rosterType: "all", rosterFaction: "", rosterTag: "", rosterLimit: 48 };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function safeImage(url) {
    if (typeof url !== "string" || !url.trim()) return "";
    try {
      const resolved = new URL(url.trim(), document.baseURI);
      if (resolved.protocol === "data:") return /^data:image\//i.test(url.trim()) ? url.trim() : "";
      return ["http:", "https:", "blob:"].includes(resolved.protocol) ? resolved.href : "";
    } catch (_) {
      return "";
    }
  }

  function linkedPlayer(actorId, actor) {
    const ids = [actorId, actor.identityId, actor.identidadId, actor.sourceActorId, actor.actorId];
    if (actor.sourceType === "player-profile" && state.players[actor.sourceId]) return state.players[actor.sourceId];
    if (actor.sourceType !== "player-profile") ids.push(actor.sourceId);
    const records = [actor, ...ids.flatMap(id => [state.npcs[id], state.actorLibrary[id]]).filter(Boolean)];
    for (const record of records) if (state.players[record.vinculo_jugador]) return state.players[record.vinculo_jugador];
    const normalizedIds = new Set(ids.filter(id => typeof id === "string" && id));
    const matches = Object.values(state.players).filter(player => {
      const assigned = global.LuminousTheatreState?.normalizeAssignedActorIds?.([player?.actorIds, player?.actores, player?.actorId]) || [player?.actorId];
      return assigned.some(id => normalizedIds.has(id));
    });
    return matches.length === 1 ? matches[0] : null;
  }

  function resolveActorName(actorId, actor = {}) {
    if (actorId === "narrador") return "Narrador";
    const ids = [actorId, actor.identityId, actor.identidadId, actor.sourceActorId, actor.sourceId, actor.actorId].filter(Boolean);
    function nameFrom(record, profile = false) {
      const values = profile ? [record?.characterName, record?.character_name, record?.nombre, record?.name] : [record?.nombre, record?.name];
      return values.find(value => typeof value === "string" && value.trim() && !ids.includes(value.trim()) && !/^actor[_-]\d+/i.test(value.trim()))?.trim() || "";
    }
    return nameFrom(actor) || ids.map(id => nameFrom(state.actorLibrary[id]) || nameFrom(state.npcs[id])).find(Boolean) ||
      nameFrom(linkedPlayer(actorId, actor), true) || "Personaje sin nombre";
  }

  function resolveActorIcon(actorId, actor = {}) {
    const ux = global.LuminousTheatreInterventionUx;
    const message = { actorId, nombre: actor.nombre }, scene = { [actorId]: actor };
    const catalogs = [state.actorLibrary, state.npcs];
    const ids = [actorId, actor.identityId, actor.identidadId, actor.sourceActorId, actor.sourceId];
    // Restrict the first lookup to identity matches so a same-name NPC cannot
    // outrank the player's linked profile. Keep legacy name lookup last.
    const identityCatalogs = catalogs.map(catalog => Object.fromEntries(ids.filter(id => id && catalog[id]).map(id => [id, catalog[id]])));
    return safeImage(ux?.resolveCanonicalActorIcon(message, scene, identityCatalogs)) ||
      safeImage(ux?.iconFromActor(linkedPlayer(actorId, actor))) ||
      safeImage(ux?.resolveCanonicalActorIcon(message, scene, catalogs)) || "";
  }

  function isPlayerActor(actorId, actor = {}) {
    return actor.sourceType === "player-profile" || actor.tipo === "Jugador" || Boolean(actor.vinculo_jugador) || Boolean(linkedPlayer(actorId, actor));
  }

  function actorTags(actor) {
    const value = actor.etiquetas || actor.tags;
    return (Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : Object.values(value || {})).map(tag => String(tag).trim()).filter(Boolean);
  }
  function actorFaction(actor) { return String(actor.faccion || actor.alineamiento || "Sin facción").trim(); }

  function portrait(url, fallback, label) {
    const frame = el("span", "dm-director-portrait");
    const fallbackImg = document.createElement("img");
    fallbackImg.src = fallback;
    fallbackImg.alt = "";
    fallbackImg.setAttribute("aria-hidden", "true");
    frame.appendChild(fallbackImg);
    const source = safeImage(url);
    frame.dataset.portraitSource = source;
    if (source) {
      const img = document.createElement("img");
      img.className = "dm-director-portrait-image";
      img.src = source;
      img.alt = label || "";
      img.loading = "lazy";
      img.addEventListener("error", () => { img.remove(); }, { once: true });
      frame.appendChild(img);
    }
    return frame;
  }

  function button(label, action, icon) {
    const btn = el("button", "dm-director-action", label);
    btn.type = "button";
    if (icon) {
      const img = document.createElement("img");
      img.src = icon;
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      btn.prepend(img);
    }
    btn.addEventListener("click", action);
    return btn;
  }

  function directChildContaining(host, selector) {
    return Array.from(host.children).find(child => child.querySelector(selector)) || null;
  }

  function boot() {
    const menu = document.querySelector("#modulo-teatro > .theatre-dm-menu");
    const panel = document.getElementById("theatre-director-panel");
    const composer = panel?.querySelector(".theatre-dm-composer");
    const speakerSelect = document.getElementById("theatre-speaker-select");
    const npcSelect = document.getElementById("select-npc-roster");
    if (!menu || !panel || !composer || !speakerSelect || !npcSelect || panel.dataset.workspace) return;
    panel.dataset.workspace = "true";

    const currentTitle = panel.querySelector(".panel-title");
    if (currentTitle) currentTitle.textContent = "DIRECCIÓN DE ESCENA";

    const intro = el("p", "dm-director-intro", "Director de Teatro · Elenco, escena y ambiente");
    const nav = el("div", "dm-director-tabs");
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Herramientas del director");
    const views = new Map();
    const navButtons = new Map();

    [
      ["voices", "Teatro", ICONS.speak],
      ["cast", "Biblioteca", ICONS.cast],
      ["scenes", "Escenas", ICONS.scene],
      ["settings", "Ajustes", ICONS.settings]
    ].forEach(([key, label, icon]) => {
      const tab = button(label, () => activate(key), icon);
      tab.classList.add("dm-director-tab");
      tab.id = "dm-director-tab-" + key;
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "dm-director-view-" + key);
      const view = el("section", "dm-director-view");
      view.id = "dm-director-view-" + key;
      view.setAttribute("role", "tabpanel");
      view.setAttribute("aria-labelledby", tab.id);
      view.hidden = true;
      nav.appendChild(tab);
      views.set(key, view);
      navButtons.set(key, tab);
    });

    const originalScenario = directChildContaining(panel, "#theatre-scenario-select");
    const originalCast = panel.querySelector("#live-actors-list");
    const originalSpawner = panel.querySelector(".npc-spawner-section");
    const originalPolicy = panel.querySelector("#theatre-render-policy");
    const originalStudio = panel.querySelector("#theatre-actor-studio-loader");
    const messagePolicy = composer.querySelector("#theatre-message-policy");
    let lastTrigger = null;

    panel.insertBefore(intro, currentTitle?.nextSibling || panel.firstChild);
    intro.after(nav);
    const closeDirector = button("Volver al escenario", () => { menu.open = false; });
    closeDirector.classList.add("dm-director-close");
    nav.after(closeDirector);
    Array.from(views.values()).forEach(view => panel.appendChild(view));

    const voices = views.get("voices");
    const sections = el("nav", "dm-director-mobile-sections");
    sections.setAttribute("aria-label", "Secciones de Teatro");
    [ ["actors", "Elenco"], ["stage", "Escena"], ["tools", "Acciones"] ].forEach(([key, label]) => {
      const control = button(label, () => {
        voices.dataset.mobileView = key;
        sections.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === control)));
      });
      control.setAttribute("aria-pressed", String(key === "actors"));
      sections.appendChild(control);
    });
    voices.before(sections);
    voices.dataset.mobileView = "actors";
    const castPane = el("section", "dm-director-cast-pane dm-director-pane");
    const stagePane = el("section", "dm-director-stage-pane dm-director-pane");
    const toolsPane = el("aside", "dm-director-tools-pane dm-director-pane");
    voices.append(castPane, stagePane, toolsPane);
    castPane.appendChild(el("h4", "dm-director-section-title", "Personajes en escena"));
    const castCount = el("p", "dm-director-hint");
    castCount.id = "dm-director-cast-count";
    castPane.appendChild(castCount);
    castPane.appendChild(button("Gestionar elenco · Biblioteca", () => activate("cast"), ICONS.cast));
    castPane.appendChild(el("p", "dm-director-hint", "Mostrar y ocultar no retiran al personaje. Hablar puede mostrarlo al publicarse la intervención."));
    const voiceGrid = el("div", "dm-director-voice-grid");
    voiceGrid.id = "dm-director-voice-grid";
    toolsPane.appendChild(voiceGrid);
    const composerStatus = el("p", "dm-director-hint");
    composerStatus.setAttribute("role", "status");
    composerStatus.hidden = true;
    toolsPane.appendChild(composerStatus);
    toolsPane.prepend(el("h4", "dm-director-section-title", "Acciones rápidas"));
    toolsPane.appendChild(button("Ambiente · Music Director", () => {
      if (global.LuminousAudio) global.LuminousAudio.openOptions();
      else { composerStatus.hidden = false; composerStatus.textContent = "El audio está cargando. Intenta de nuevo."; }
    }));
    toolsPane.appendChild(button("Cambiar escenario", () => activate("scenes"), ICONS.scene));
    toolsPane.appendChild(button("Presentación y ritmo", () => activate("settings"), ICONS.settings));
    const stageSlot = el("div", "dm-director-stage-slot");
    stagePane.appendChild(stageSlot);
    const log = el("section", "");
    log.id = "theatre-log-container";
    log.setAttribute("aria-label", "Registro de Teatro");
    const logScroll = el("div", "dialogue-scroll-area");
    logScroll.appendChild(el("p", "dm-director-log-empty", "El teatro está en silencio…"));
    log.appendChild(logScroll);
    stagePane.appendChild(log);
    // Move the real stage, never clone a renderer or its IDs.
    const stage = document.querySelector("#modulo-teatro > .stage-view-wrapper");
    const stageHome = stage ? document.createComment("theatre-stage-home") : null;
    if (stage) stage.before(stageHome);
    function syncStage() {
      if (stage) {
        if (menu.open) stageSlot.appendChild(stage);
        else stageHome.after(stage);
      }
      menu.querySelector("summary")?.setAttribute("aria-expanded", String(menu.open));
    }
    syncStage();
    const nextMessage = button("Siguiente intervención", () => {
      const original = document.getElementById("btn-theatre-message-next");
      if (original && !original.disabled) original.click();
    }, "Assets/Images/Buttons/Foward.svg");
    nextMessage.classList.add("dm-director-next");
    nextMessage.disabled = true;
    toolsPane.appendChild(nextMessage);

    const cast = views.get("cast");
    cast.appendChild(el("h4", "dm-director-section-title", "Añadir personajes"));
    const search = el("input", "dm-director-search");
    search.type = "search";
    search.placeholder = "Buscar NPC o personaje...";
    search.setAttribute("aria-label", "Buscar NPC o personaje");
    const libraryStatus = el("p", "dm-director-hint");
    libraryStatus.setAttribute("role", "status");
    cast.appendChild(libraryStatus);
    document.addEventListener("luminous:theatre-cast-result", event => {
      libraryStatus.textContent = event.detail.message;
      renderRoster();
    });
    document.addEventListener("luminous:theatre-cast-ready", renderRoster);
    cast.appendChild(search);
    const libraryHelp = el("p", "dm-director-hint", "Añade un personaje al elenco para escribir como él. Esto no lo muestra en el escenario. Si falta en la biblioteca, créalo o vincúlalo en el Editor de personajes.");
    cast.appendChild(libraryHelp);
    const typeFilters = el("nav", "canonical-cast-tabs");
    typeFilters.setAttribute("aria-label", "Tipo de personaje");
    for (const [type, label] of [["all", "Todos"], ["player", "Jugadores"], ["npc", "NPC"]]) {
      const filter = button(label, () => {
        state.rosterType = type; state.rosterLimit = 48;
        typeFilters.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b === filter)));
        renderRoster();
      });
      filter.dataset.actorTypeFilter = type;
      filter.setAttribute("aria-pressed", String(type === "all"));
      typeFilters.appendChild(filter);
    }
    cast.appendChild(typeFilters);
    const facets = el("div", "dm-director-library-facets");
    function facet(label, key) {
      const field = el("label", "", label), select = el("select", "dm-director-search");
      select.setAttribute("aria-label", label);
      select.addEventListener("change", () => { state[key] = select.value; state.rosterLimit = 48; renderRoster(); });
      field.appendChild(select); facets.appendChild(field); return select;
    }
    const factionFilter = facet("Facción", "rosterFaction"), tagFilter = facet("Etiqueta", "rosterTag");
    cast.appendChild(facets);
    const rosterGrid = el("div", "dm-director-roster-grid");
    rosterGrid.id = "dm-director-roster-grid";
    cast.appendChild(rosterGrid);
    if (originalSpawner) {
      originalSpawner.classList.add("dm-director-native-controls");
      originalSpawner.hidden = true;
      originalSpawner.setAttribute("aria-label", "Selector original de elenco");
      cast.appendChild(originalSpawner);
      npcSelect.tabIndex = -1;
      const nativeSpawn = document.getElementById("btn-spawn-npc");
      if (nativeSpawn) nativeSpawn.tabIndex = -1;
    }

    if (originalCast) castPane.appendChild(originalCast);
    if (originalStudio) cast.appendChild(originalStudio);

    const scenes = views.get("scenes");
    scenes.appendChild(el("h4", "dm-director-section-title", "Biblioteca de escenarios"));
    const preview = el("div", "dm-director-scene-preview", "Selecciona un fondo para previsualizar la escena.");
    if (originalScenario) {
      scenes.appendChild(originalScenario);
      originalScenario.prepend(preview);
    } else {
      scenes.appendChild(preview);
    }

    const settings = views.get("settings");
    settings.appendChild(el("h4", "dm-director-section-title", "Presentación y ritmo"));
    if (originalPolicy) settings.appendChild(originalPolicy);
    if (!originalPolicy) settings.appendChild(el("p", "dm-director-hint", "Los ajustes de escena están cargando."));
    settings.appendChild(el("p", "dm-director-hint", "Controla cuánto permanece cada intervención en pantalla."));
    if (messagePolicy) settings.appendChild(messagePolicy);
    const realNext = document.getElementById("btn-theatre-message-next");
    function updateNextButton() {
      nextMessage.disabled = !realNext || realNext.disabled;
      nextMessage.title = nextMessage.disabled ? "No hay una intervención esperando avance" : "Avanzar mensaje";
    }
    if (realNext) new MutationObserver(updateNextButton).observe(realNext, { attributes: true, attributeFilter: ["disabled"] });
    updateNextButton();

    const modal = document.createElement("dialog");
    modal.id = "dm-theatre-composer-modal";
    modal.className = "dm-theatre-composer-modal";
    modal.setAttribute("aria-label", "Escribir intervención de Teatro");
    const modalHeading = el("div", "dm-theatre-composer-head");
    const headingLabel = el("div");
    headingLabel.appendChild(el("span", "dm-theatre-composer-eyebrow", "DIRECCIÓN / TEATRO"));
    headingLabel.appendChild(el("h3", "", "Escribir intervención"));
    modalHeading.appendChild(headingLabel);
    modalHeading.appendChild(button("Cerrar", () => modal.close()));
    modal.appendChild(modalHeading);
    modal.appendChild(composer);
    document.body.appendChild(modal);
    modal.addEventListener("click", e => { if (e.target === modal) modal.close(); });
    modal.addEventListener("close", () => {
      const target = lastTrigger?.isConnected ? lastTrigger : navButtons.get(state.activeTab);
      target?.focus({ preventScroll: true });
    });

    function openComposer(actorId) {
      composer.dataset.actorId = actorId === undefined ? speakerSelect.value : actorId;
      if (actorId !== undefined && !Array.from(speakerSelect.options).some(o => o.value === actorId)) {
        activate("voices");
        composerStatus.textContent = "Este personaje ya no está disponible para hablar. Selecciona otro del elenco.";
        composerStatus.hidden = false;
        return false;
      }
      composer.dataset.actorRetired = "false";
      modalHeading.querySelector("h3").textContent = "Escribir intervención";
      composerStatus.hidden = true;
      lastTrigger = document.activeElement;
      if (actorId !== undefined) {
        speakerSelect.value = actorId;
        speakerSelect.dispatchEvent(new Event("change", { bubbles: true }));
        const type = document.getElementById("dm-tipo-dialogo-select");
        if (type) type.value = actorId === "narrador" ? "narracion" : "dialogo";
      }
      if (!modal.open) modal.showModal();
      global.requestAnimationFrame?.(() => document.getElementById("theatre-dialogue-input")?.focus());
    }

    function activate(next) {
      state.activeTab = next;
      sections.hidden = next !== "voices";
      views.forEach((view, key) => {
        const selected = key === next;
        view.hidden = !selected;
        navButtons.get(key).setAttribute("aria-selected", String(selected));
        navButtons.get(key).tabIndex = selected ? 0 : -1;
      });
      if (next === "voices") renderSpeakers();
      if (next === "cast") { renderRoster(); decorateActors(); }
      panel.scrollTop = 0;
    }

    nav.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const keys = Array.from(views.keys());
      const i = keys.indexOf(state.activeTab);
      const target = event.key === "Home" ? 0 : event.key === "End" ? keys.length - 1 :
        (i + (event.key === "ArrowRight" ? 1 : -1) + keys.length) % keys.length;
      activate(keys[target]);
      navButtons.get(keys[target])?.focus();
    });

    function renderSpeakers() {
      const chosen = speakerSelect.value;
      castCount.textContent = Object.keys(state.sceneActors).length + " en el elenco · " +
        document.querySelectorAll('#live-actors-list [data-visible="true"]').length + " visibles";
      voiceGrid.replaceChildren();
      Array.from(speakerSelect.options).forEach(option => {
        const actorId = option.value;
        if (actorId !== "narrador") {
          const name = resolveActorName(actorId, state.sceneActors[actorId]);
          if (option.textContent !== name) option.textContent = name;
          option.dataset.nombre = name;
          return;
        }
        const data = state.sceneActors[actorId] || {};
        const icon = resolveActorIcon(actorId, data) || option.dataset.icono || "";
        const item = button("", () => openComposer(actorId));
        item.classList.add("dm-director-person-card", "dm-director-voice");
        item.dataset.selected = String(actorId === chosen);
        item.setAttribute("aria-label", "Hablar como " + (option.textContent || "Narrador"));
        item.appendChild(portrait(icon, actorId === "narrador" ? ICONS.speak : FALLBACK_NPC, option.textContent));
        const labels = el("span", "dm-director-person-text");
        labels.appendChild(el("strong", "", option.textContent || "Narrador"));
        labels.appendChild(el("small", "", actorId === "narrador" ? "Narrar escena" : "Hablar como personaje"));
        item.appendChild(labels);
        voiceGrid.appendChild(item);
      });
      if (speakerSelect.options.length === 0) voiceGrid.appendChild(el("p", "dm-director-empty", "El elenco aún no está disponible."));
    }

    function renderRoster() {
      const query = state.query;
      const options = Array.from(npcSelect.options).filter(o => o.value);
      const catalogActors = options.map(o => state.npcs[o.value] || state.actorLibrary[o.value] || {});
      for (const [select, key, values, label] of [
        [factionFilter, "rosterFaction", catalogActors.map(actorFaction), "Todas las facciones"],
        [tagFilter, "rosterTag", catalogActors.flatMap(actorTags), "Todas las etiquetas"]
      ]) {
        const available = [...new Set(values)].sort((a,b) => a.localeCompare(b, "es"));
        if (!available.includes(state[key])) state[key] = "";
        select.replaceChildren(new Option(label, ""), ...available.map(value => new Option(value, value)));
        select.value = state[key];
      }
      const items = options.filter(o => {
        const actor = state.npcs[o.value] || state.actorLibrary[o.value] || {};
        const isPlayer = o.dataset.actorType === "player" || o.dataset.sourceType === "player-profile" || isPlayerActor(o.value, actor);
        return (state.rosterType === "all" || (state.rosterType === "player") === isPlayer) &&
          (!state.rosterFaction || actorFaction(actor) === state.rosterFaction) &&
          (!state.rosterTag || actorTags(actor).includes(state.rosterTag)) &&
          [resolveActorName(o.value, actor), actor.titulo, actorFaction(actor), ...actorTags(actor)].filter(Boolean).join(" ").toLocaleLowerCase().includes(query);
      });
      rosterGrid.replaceChildren();
      if (!items.length) {
        rosterGrid.appendChild(el("p", "dm-director-empty", options.length
          ? "No hay personajes con ese nombre." : "Aún no hay personajes en la biblioteca."));
        return;
      }
      items.sort((a,b) => (a.textContent || "").localeCompare(b.textContent || "", "es"));
      items.slice(0, state.rosterLimit).forEach(option => {
        const id = option.value;
        const actor = state.npcs[id] || state.actorLibrary[id] || {};
        const isPlayer = option.dataset.actorType === "player" || option.dataset.sourceType === "player-profile" || isPlayerActor(id, actor);
        const name = resolveActorName(id, actor);
        const icon = resolveActorIcon(id, actor);
        const item = button("", () => {
          npcSelect.value = id;
          document.getElementById("btn-spawn-npc")?.click();
        });
        item.disabled = Boolean(document.getElementById("btn-spawn-npc")?.disabled);
        item.classList.add("dm-director-person-card");
        item.setAttribute("aria-label", "Añadir al elenco: " + name);
        item.appendChild(portrait(icon, isPlayer ? FALLBACK_PLAYER : FALLBACK_NPC, name));
        const labels = el("span", "dm-director-person-text");
        labels.appendChild(el("strong", "", name));
        labels.appendChild(el("small", "", isPlayer ? "Jugador · Añadir para escribir" : "NPC · Añadir para escribir"));
        labels.appendChild(el("small", "", [actorFaction(actor), ...actorTags(actor)].join(" · ")));
        item.appendChild(labels);
        rosterGrid.appendChild(item);
      });
      if (items.length > state.rosterLimit) {
        const more = button("Mostrar más personajes", () => {
          const firstNew = state.rosterLimit;
          state.rosterLimit += 48;
          renderRoster();
          rosterGrid.querySelectorAll(".dm-director-person-card")[firstNew]?.focus();
        });
        rosterGrid.appendChild(more);
      }
    }

    function decorateActors() {
      const list = document.getElementById("live-actors-list");
      if (!list) return;
      for (const card of list.querySelectorAll(".actor-control-card:not([data-dm-decorated])")) {
        card.dataset.dmDecorated = "true";
        const id = card.dataset.actorId;
        const actor = state.sceneActors[id] || {};
        const head = card.firstElementChild;
        if (head) {
          head.classList.add("dm-director-actor-head");
          const icon = resolveActorIcon(id, actor);
          head.prepend(portrait(icon, FALLBACK_NPC, resolveActorName(id, actor)));
          const speak = button("Hablar", () => openComposer(id), ICONS.speak);
          speak.classList.add("dm-director-actor-speak");
          head.appendChild(speak);
        }
        const identity = card.querySelector(".actor-identity-controls");
        if (identity) {
          const more = el("details", "dm-director-actor-advanced");
          more.appendChild(el("summary", "", "Movimiento, identidad y presentación"));
          identity.parentNode.insertBefore(more, identity);
          more.appendChild(identity);
          const actions = card.querySelector(".actor-buttons");
          if (actions) {
            const movement = el("div", "dm-director-movement");
            actions.querySelectorAll(".btn-move, .btn-flip").forEach(control => movement.appendChild(control));
            more.prepend(movement);
          }
          const expression = card.querySelector(".actor-expression-select");
          if (expression) more.prepend(expression);
        }
      }
      for (const card of list.querySelectorAll(".actor-control-card[data-dm-decorated]")) {
        const id = card.dataset.actorId, actor = state.sceneActors[id] || {};
        const frame = card.querySelector(".dm-director-actor-head > .dm-director-portrait");
        const source = resolveActorIcon(id, actor);
        const label = card.querySelector(".actor-name");
        const name = resolveActorName(id, actor);
        if (label && label.textContent !== name) label.textContent = name;
        if (frame && frame.dataset.portraitSource !== source) frame.replaceWith(portrait(source, FALLBACK_NPC, resolveActorName(id, actor)));
      }
      castCount.textContent = Object.keys(state.sceneActors).length + " en el elenco · " +
        list.querySelectorAll('[data-visible="true"]').length + " visibles";
      if (!list.querySelector(".actor-control-card") && !list.querySelector(".dm-director-empty")) {
        list.appendChild(el("p", "dm-director-empty", "No hay actores en el elenco. Añade uno de la biblioteca."));
      }
    }

    search.addEventListener("input", () => {
      state.query = search.value.trim().toLocaleLowerCase();
      state.rosterLimit = 48;
      renderRoster();
    });
    speakerSelect.addEventListener("change", event => {
      // Roster refreshes may reset the native select to Narrator. They must not
      // silently replace a retired speaker; an intentional selection does.
      if (!event.detail?.theatreRosterRefresh) {
        composer.dataset.actorId = speakerSelect.value;
        composer.dataset.actorRetired = "false";
        modalHeading.querySelector("h3").textContent = "Escribir intervención";
        composerStatus.hidden = true;
      }
      renderSpeakers();
    });
    const npcObserver = new MutationObserver(renderRoster);
    npcObserver.observe(npcSelect, { childList: true, subtree: true });
    const castList = document.getElementById("live-actors-list");
    if (castList) {
      let scheduled = false;
      const observer = new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        global.requestAnimationFrame(() => { scheduled = false; decorateActors(); });
      });
      observer.observe(castList, { childList: true });
    }

    const background = document.getElementById("theatre-background-input");
    function refreshPreview() {
      const image = safeImage(background?.value || "");
      preview.replaceChildren();
      if (!image) {
        preview.textContent = "Sin imagen de fondo seleccionada";
        return;
      }
      const img = document.createElement("img");
      img.src = image;
      img.alt = "Vista previa del fondo de escenario";
      img.addEventListener("error", () => { preview.textContent = "No se pudo mostrar el fondo de esta escena."; }, { once: true });
      preview.appendChild(img);
    }
    background?.addEventListener("input", refreshPreview);
    background?.addEventListener("change", refreshPreview);
    document.getElementById("theatre-scenario-select")?.addEventListener("change", () => {
      global.requestAnimationFrame?.(refreshPreview);
    });

    const db = global.firebase?.database?.();
    if (db) {
      const roots = [
        ["campaña/base_datos_npcs", "npcs"],
        ["campaña/actores", "actorLibrary"],
        ["campaña/jugadores", "players"]
      ];
      roots.forEach(([path, key]) => db.ref(path).on("value", snap => {
        state[key] = snap.val() || {};
        renderRoster();renderSpeakers();decorateActors();
        document.dispatchEvent(new CustomEvent("luminous:theatre-portraits-changed"));
      }));
      const scenePath = global.LuminousTheatreState?.getPaths?.().scene || "campaña/estado_mundo/escena_actual";
      db.ref(scenePath + "/actores").on("value", snap => {
        state.sceneActors = snap.val() || {};
        const selected = composer.dataset.actorId;
        if (modal.open && selected && selected !== "narrador" && !state.sceneActors[selected]) {
          composer.dataset.actorRetired = "true";
          composerStatus.textContent = "El personaje fue retirado del elenco. Conservamos tu texto; elige otro personaje para enviarlo.";
          composerStatus.hidden = false;
          modalHeading.querySelector("h3").textContent = "Personaje retirado · cierra y elige otro";
        }
        renderSpeakers();
        // Existing casting renderer owns card recreation and click handlers.
        decorateActors();
      });
    }

    menu.addEventListener("toggle", () => {
      syncStage();
      if (menu.open) activate(state.activeTab);
      else menu.querySelector("summary")?.focus({ preventScroll: true });
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && menu.open && !modal.open && document.getElementById("luminous-audio-panel")?.hidden !== false) {
        menu.open = false; menu.querySelector("summary")?.focus();
      }
    });
    renderSpeakers();
    renderRoster();
    refreshPreview();
    activate("voices");
    global.LuminousDmTheatreWorkspace = Object.freeze({ activate, openComposer, safeImage, resolveActorIcon, resolveActorName, isPlayerActor });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})(window);
