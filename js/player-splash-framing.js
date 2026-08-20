(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  const PLAYERS_ROOT = "campaña/jugadores";
  const DEFAULT_FRAME = Object.freeze({ x: 50, y: 50, zoom: 1 });
  const state = {
    dmMounted: false,
    dmPlayerId: "",
    dmFrame: { ...DEFAULT_FRAME },
    dmLoadToken: 0,
    playerMounted: false,
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
  const numberOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  function normalizeFrame(source) {
    const raw = source || {};
    return {
      x: Math.round(clamp(numberOr(raw.x, DEFAULT_FRAME.x), 0, 100)),
      y: Math.round(clamp(numberOr(raw.y, DEFAULT_FRAME.y), 0, 100)),
      zoom: Math.round(clamp(numberOr(raw.zoom, DEFAULT_FRAME.zoom), 1, 2.5) * 100) / 100,
    };
  }

  function frameFromPlayer(player) {
    return normalizeFrame(
      player?.sheetArtFraming ||
      player?.playerSheetArtFraming ||
      player?.sheetArtCrop ||
      DEFAULT_FRAME
    );
  }

  function currentPlayerData() {
    return global.datosJugador || {};
  }

  function playerSheetArt(data = currentPlayerData()) {
    return String(data?.sheetArt || data?.playerSheetArt || "").trim();
  }

  function applyFrame(image, frame) {
    if (!image) return;
    const normalized = normalizeFrame(frame);
    image.style.objectPosition = `${normalized.x}% ${normalized.y}%`;
    image.style.transformOrigin = `${normalized.x}% ${normalized.y}%`;
    image.style.transform = `scale(${normalized.zoom})`;
  }

  function markDmDirty() {
    const feedback = doc.getElementById("dm-player-dnd-feedback");
    if (feedback && !/GUARDANDO|GUARDADOS|ERROR/.test(feedback.textContent || "")) {
      feedback.textContent = "CAMBIOS SIN GUARDAR";
    }
  }

  function dmArtUrl() {
    return String(doc.getElementById("dm-player-dnd-art")?.value || "").trim();
  }

  function syncDmPreview() {
    const image = doc.querySelector("[data-dm-splash-framing-preview]");
    const empty = doc.querySelector("[data-dm-splash-framing-empty]");
    const copy = doc.querySelector("[data-dm-splash-framing-copy]");
    const zoom = doc.querySelector("[data-dm-splash-zoom]");
    if (!image || !empty || !copy) return;

    const art = dmArtUrl();
    if (art) {
      if (image.getAttribute("src") !== art) image.src = art;
      image.hidden = false;
      empty.hidden = true;
      image.onerror = () => {
        image.hidden = true;
        empty.hidden = false;
      };
    } else {
      image.hidden = true;
      image.removeAttribute("src");
      empty.hidden = false;
    }

    applyFrame(image, state.dmFrame);
    copy.textContent = `X ${state.dmFrame.x}% · Y ${state.dmFrame.y}% · ZOOM ${Math.round(state.dmFrame.zoom * 100)}%`;
    if (zoom && doc.activeElement !== zoom) zoom.value = String(state.dmFrame.zoom);
  }

  function setDmFrame(next, dirty = true) {
    state.dmFrame = normalizeFrame({ ...state.dmFrame, ...next });
    syncDmPreview();
    if (dirty) markDmDirty();
  }

  function nudgeDmFrame(direction) {
    const step = 5;
    if (direction === "up") setDmFrame({ y: state.dmFrame.y - step });
    if (direction === "down") setDmFrame({ y: state.dmFrame.y + step });
    if (direction === "left") setDmFrame({ x: state.dmFrame.x - step });
    if (direction === "right") setDmFrame({ x: state.dmFrame.x + step });
  }

  function resetDmFrame() {
    state.dmFrame = { ...DEFAULT_FRAME };
    syncDmPreview();
    markDmDirty();
  }

  async function loadDmFrame(playerId) {
    const token = ++state.dmLoadToken;
    state.dmPlayerId = playerId || "";
    if (!playerId || !global.firebase?.database) {
      state.dmFrame = { ...DEFAULT_FRAME };
      syncDmPreview();
      return;
    }

    try {
      const snapshot = await global.firebase.database().ref(`${PLAYERS_ROOT}/${playerId}`).once("value");
      if (token !== state.dmLoadToken) return;
      const player = snapshot.val() || {};
      state.dmFrame = frameFromPlayer(player);
      syncDmPreview();
    } catch (error) {
      console.warn("No se pudo cargar el encuadre del splash art:", error);
      state.dmFrame = { ...DEFAULT_FRAME };
      syncDmPreview();
    }
  }

  async function saveDmFrame() {
    const playerId = String(doc.getElementById("dm-player-dnd-select")?.value || "");
    if (!playerId || !global.firebase?.database) return false;
    const frame = normalizeFrame(state.dmFrame);
    try {
      await global.firebase.database().ref(`${PLAYERS_ROOT}/${playerId}`).update({
        "sheetArtFraming/x": frame.x,
        "sheetArtFraming/y": frame.y,
        "sheetArtFraming/zoom": frame.zoom,
      });
      return true;
    } catch (error) {
      console.error("No se pudo guardar el encuadre del splash art:", error);
      return false;
    }
  }

  function mountDmControls() {
    if (state.dmMounted && doc.querySelector(".dm-player-splash-framing")) return true;
    const editor = doc.getElementById("dm-player-dnd-editor");
    const artRow = editor?.querySelector?.(".dm-player-dnd-art-row");
    const artInput = doc.getElementById("dm-player-dnd-art");
    if (!editor || !artRow || !artInput) return false;

    artRow.classList.add("splash-framing-active");

    const framing = doc.createElement("section");
    framing.className = "dm-player-splash-framing";
    framing.innerHTML = `
      <div class="dm-player-splash-preview-shell">
        <div class="dm-player-splash-preview" aria-label="Vista del recorte que verá el jugador">
          <img data-dm-splash-framing-preview alt="Previsualización del encuadre del splash art" hidden>
          <div class="dm-player-splash-preview-empty" data-dm-splash-framing-empty>SIN SPLASH ART</div>
          <span class="dm-player-splash-crop-label">PLAYER VIEW · CROP</span>
        </div>
      </div>
      <div class="dm-player-splash-controls">
        <header><span>SPLASH ART · ENCUADRE</span><b data-dm-splash-framing-copy>X 50% · Y 50% · ZOOM 100%</b></header>
        <p>Mueve la ventana del splash sin modificar la imagen original. El botón ⛶ del jugador muestra el arte completo.</p>
        <div class="dm-player-splash-control-grid">
          <div class="dm-player-splash-pad" aria-label="Mover encuadre">
            <button type="button" data-splash-nudge="up" aria-label="Mover arriba">↑</button>
            <button type="button" data-splash-nudge="left" aria-label="Mover izquierda">←</button>
            <button type="button" data-splash-center aria-label="Centrar encuadre">●</button>
            <button type="button" data-splash-nudge="right" aria-label="Mover derecha">→</button>
            <button type="button" data-splash-nudge="down" aria-label="Mover abajo">↓</button>
          </div>
          <label class="dm-player-splash-zoom">
            <span>ZOOM</span>
            <div><button type="button" data-splash-zoom-step="-0.05" aria-label="Alejar">−</button><input data-dm-splash-zoom type="range" min="1" max="2.5" step="0.05" value="1"><button type="button" data-splash-zoom-step="0.05" aria-label="Acercar">+</button></div>
          </label>
        </div>
        <button type="button" class="dm-player-splash-reset" data-splash-reset>RESTABLECER · 50 / 50 / 100%</button>
      </div>`;

    artRow.insertAdjacentElement("afterend", framing);

    framing.querySelectorAll("[data-splash-nudge]").forEach((button) => {
      button.addEventListener("click", () => nudgeDmFrame(button.dataset.splashNudge));
    });
    framing.querySelector("[data-splash-center]")?.addEventListener("click", () => {
      setDmFrame({ x: 50, y: 50 });
    });
    framing.querySelector("[data-splash-reset]")?.addEventListener("click", resetDmFrame);
    framing.querySelectorAll("[data-splash-zoom-step]").forEach((button) => {
      button.addEventListener("click", () => {
        setDmFrame({ zoom: state.dmFrame.zoom + numberOr(button.dataset.splashZoomStep, 0) });
      });
    });
    framing.querySelector("[data-dm-splash-zoom]")?.addEventListener("input", (event) => {
      setDmFrame({ zoom: numberOr(event.target.value, 1) });
    });
    artInput.addEventListener("input", syncDmPreview);

    const select = doc.getElementById("dm-player-dnd-select");
    select?.addEventListener("change", () => loadDmFrame(select.value));
    doc.getElementById("dm-player-dnd-save")?.addEventListener("click", () => {
      void saveDmFrame();
    });

    state.dmMounted = true;
    state.dmPlayerId = String(select?.value || "");
    void loadDmFrame(state.dmPlayerId);
    syncDmPreview();
    return true;
  }

  function ensureLightbox() {
    let overlay = doc.getElementById("player-splash-lightbox");
    if (overlay) return overlay;

    overlay = doc.createElement("div");
    overlay.id = "player-splash-lightbox";
    overlay.className = "player-splash-lightbox";
    overlay.hidden = true;
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Splash art completo");
    overlay.innerHTML = `
      <button type="button" class="player-splash-lightbox-close" data-player-splash-close aria-label="Cerrar splash art">×</button>
      <div class="player-splash-lightbox-stage">
        <img data-player-splash-full alt="Splash art completo del jugador">
      </div>
      <span class="player-splash-lightbox-caption">SPLASH ART · FULL VIEW</span>`;

    doc.body.appendChild(overlay);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay || event.target.closest?.("[data-player-splash-close]")) closeLightbox();
    });
    doc.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !overlay.hidden) closeLightbox();
    });
    return overlay;
  }

  function openLightbox() {
    const art = playerSheetArt();
    if (!art) return;
    const overlay = ensureLightbox();
    const image = overlay.querySelector("[data-player-splash-full]");
    if (image) image.src = art;
    overlay.hidden = false;
    doc.body.classList.add("player-splash-lightbox-open");
    overlay.querySelector("[data-player-splash-close]")?.focus?.();
  }

  function closeLightbox() {
    const overlay = doc.getElementById("player-splash-lightbox");
    if (!overlay) return;
    overlay.hidden = true;
    doc.body.classList.remove("player-splash-lightbox-open");
  }

  function syncPlayerFrame() {
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    if (!panel) return false;
    const image = panel.querySelector("[data-player-sheet-art]");
    if (!image) return false;

    const data = currentPlayerData();
    const frame = frameFromPlayer(data);
    applyFrame(image, frame);

    let expand = panel.querySelector("[data-player-splash-expand]");
    if (!expand) {
      const artPanel = panel.querySelector(".player-stats-character-panel");
      if (!artPanel) return false;
      expand = doc.createElement("button");
      expand.type = "button";
      expand.className = "player-splash-expand";
      expand.dataset.playerSplashExpand = "true";
      expand.setAttribute("aria-label", "Ver splash art completo");
      expand.title = "Ver splash art completo";
      expand.textContent = "⛶";
      expand.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openLightbox();
      });
      artPanel.appendChild(expand);
    }

    expand.hidden = !playerSheetArt(data);
    return true;
  }

  function boot() {
    const tick = () => {
      if (doc.getElementById("dashboard-jugadores")) {
        mountDmControls();
        const selected = String(doc.getElementById("dm-player-dnd-select")?.value || "");
        if (selected !== state.dmPlayerId) void loadDmFrame(selected);
        if (state.dmMounted) syncDmPreview();
      }

      if (doc.querySelector(".sheet-phone-wrapper")) {
        state.playerMounted = syncPlayerFrame() || state.playerMounted;
      }
    };

    tick();
    global.setInterval(tick, 500);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousPlayerSplashFraming = Object.freeze({
    DEFAULT_FRAME,
    normalizeFrame,
    frameFromPlayer,
    applyFrame,
    openLightbox,
    closeLightbox,
    syncPlayerFrame,
  });
})(window);
