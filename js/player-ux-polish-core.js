(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc) return;

  const STORAGE = {
    volume: "luminous.player.masterVolume",
    reduceMotion: "luminous.player.reduceMotion",
    largeText: "luminous.player.largeText",
    compact: "luminous.player.compactUi",
  };

  const readStored = (key, fallback) => {
    try {
      const value = global.localStorage?.getItem(key);
      return value == null ? fallback : value;
    } catch (_) { return fallback; }
  };

  const writeStored = (key, value) => {
    try { global.localStorage?.setItem(key, String(value)); } catch (_) {}
  };

  function initialsIcon(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    const initials = (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "?").toUpperCase();
    const safe = initials.replace(/[&<>"']/g, "");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#17130f"/><path d="M50 4 87 20 98 55 76 96 24 96 2 55 13 20Z" fill="none" stroke="#b98a32" stroke-width="5"/><text x="50" y="59" text-anchor="middle" font-family="monospace" font-size="34" font-weight="700" fill="#e6d7b8">${safe}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function actorAssignedIcon(actor) {
    return actor?.icono || actor?.icono_jugador || actor?.icon_url || "";
  }

  function actorRecords() {
    const cache = global.allActoresCache;
    return cache && typeof cache === "object" ? Object.values(cache) : [];
  }

  function actorByName(name) {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) return null;
    return actorRecords().find((actor) =>
      String(actor?.nombre || actor?.name || "").trim().toLowerCase() === normalized
    ) || null;
  }

  function polishLogRows() {
    const log = doc.getElementById("theatre-log-container");
    if (!log) return;

    log.querySelectorAll(".dialogue-row").forEach((row) => {
      const img = row.querySelector(".hex-portrait img");
      if (!img) return;
      const displayedName = row.querySelector(".character-name")?.textContent || img.alt || "Desconocido";
      const actor = actorByName(displayedName);
      const assigned = actorAssignedIcon(actor);
      const current = img.getAttribute("src") || "";
      const forbidden = [actor?.sprite, actor?.url, actor?.avatar].filter(Boolean);

      if (assigned && current !== assigned) img.src = assigned;
      else if (actor && forbidden.includes(current)) img.src = initialsIcon(displayedName);

      img.classList.add("theatre-log-actor-icon");
      if (img.dataset.iconFallbackBound !== "true") {
        img.dataset.iconFallbackBound = "true";
        img.addEventListener("error", () => { img.src = initialsIcon(displayedName); }, { once: true });
      }
    });
  }

  function watchTheatreLog() {
    polishLogRows();
    const log = doc.getElementById("theatre-log-container");
    if (log) new MutationObserver(polishLogRows).observe(log, { childList: true, subtree: true });
    global.setInterval(polishLogRows, 1500);
  }

  function normalizePhoneLauncher() {
    doc.querySelectorAll(".sheet-app-grid .sheet-app-btn").forEach((button) => {
      const visibleLabel = button.querySelector(":scope > span");
      const label = String(visibleLabel?.textContent || button.getAttribute("aria-label") || button.title || "Módulo").trim();
      if (visibleLabel) visibleLabel.setAttribute("aria-hidden", "true");
      button.setAttribute("aria-label", label);
      button.title = label;
      button.dataset.launcherLabel = label;
    });

    const home = doc.querySelector(".sheet-phone-navbar .sheet-home-btn");
    if (home) {
      home.setAttribute("aria-label", "Inicio");
      home.title = "Inicio";
    }
  }

  function suppressLegacyProfileRolls() {
    const profile = doc.querySelector(".sheet-tab-profile");
    const currentStats = doc.querySelector('#stats-modal #stats-container [name="act_roll_cuerpo"]');
    if (!profile || !currentStats) return false;

    const legacyGrid = profile.querySelector(".sheet-dnd-stats-grid");
    if (!legacyGrid) return false;

    legacyGrid.hidden = true;
    legacyGrid.setAttribute("aria-hidden", "true");
    legacyGrid.dataset.legacyAttributes = "disabled";
    return true;
  }

  function renameRelationshipUx() {
    const apegoButton = doc.querySelector('[name="act_hud_apego"]');
    if (apegoButton) {
      const label = apegoButton.querySelector("span");
      if (label && label.textContent !== "Vínculos") label.textContent = "Vínculos";
      apegoButton.title = "Vínculos y relaciones personales";
      apegoButton.setAttribute("aria-label", "Abrir vínculos y relaciones personales");
    }

    doc.querySelectorAll("#apego-modal h1,#apego-modal h2,#apego-modal h3,#apego-modal h4").forEach((heading) => {
      if (/apego/i.test(heading.textContent || "")) heading.textContent = "VÍNCULOS / RELACIONES";
    });

    const directoryButton = doc.getElementById("btn-show-contacts");
    if (directoryButton) {
      if (directoryButton.textContent !== "DIRECTORIO") directoryButton.textContent = "DIRECTORIO";
      directoryButton.title = "Directorio de red: números y alias usados por Email/Chat";
      directoryButton.setAttribute("aria-label", "Abrir directorio de red para mensajería");
    }

    const directory = doc.getElementById("subtab-contacts");
    if (directory && !directory.querySelector(".player-network-directory-note")) {
      const note = doc.createElement("p");
      note.className = "player-network-directory-note";
      note.innerHTML = "<strong>DIRECTORIO DE RED:</strong> números y alias para comunicación. La afinidad y las relaciones personales viven en <strong>VÍNCULOS</strong> desde el HUD.";
      const list = directory.querySelector("#contacts-list");
      if (list) directory.insertBefore(note, list);
      else directory.prepend(note);
    }
  }

  function currentMuteState() {
    const button = doc.getElementById("btn-toggle-mute");
    const text = button?.textContent || "";
    return text.includes("🔕") || button?.getAttribute("aria-pressed") === "true" || button?.dataset.muted === "true";
  }

  function applyVolume(value) {
    const volume = Math.max(0, Math.min(1, Number(value)));
    doc.querySelectorAll("audio,video").forEach((media) => {
      try { media.volume = volume; } catch (_) {}
    });
    return volume;
  }

  function bindBooleanSetting(id, storageKey, className) {
    const input = doc.getElementById(id);
    if (!input) return;
    input.checked = readStored(storageKey, "0") === "1";
    doc.body.classList.toggle(className, input.checked);
    input.addEventListener("change", () => {
      doc.body.classList.toggle(className, input.checked);
      writeStored(storageKey, input.checked ? "1" : "0");
    });
  }

  function buildSettingsPanel() {
    const body = doc.querySelector(".sheet-tab-settings .sheet-app-body");
    if (!body || body.dataset.playerUxReady === "true") return;
    body.dataset.playerUxReady = "true";
    body.innerHTML = `
      <div class="player-settings-console">
        <section class="player-settings-section">
          <h3>AUDIO / NOTIFICACIONES</h3><p>Controles locales del dispositivo.</p>
          <label class="player-setting-row"><span class="player-setting-copy"><span class="player-setting-label">Silenciar alertas</span><span class="player-setting-help">Usa el mismo estado que la campana del terminal.</span></span><input id="player-setting-mute" class="player-setting-toggle" type="checkbox"></label>
          <label class="player-setting-row"><span class="player-setting-copy"><span class="player-setting-label">Volumen maestro</span><span class="player-setting-help">Afecta audio/video reproducido en este navegador.</span></span><span class="player-setting-volume-wrap"><input id="player-setting-volume" type="range" min="0" max="100" step="5"><output id="player-setting-volume-value">100%</output></span></label>
        </section>
        <section class="player-settings-section">
          <h3>INTERFAZ</h3><p>Preferencias guardadas en este dispositivo.</p>
          <label class="player-setting-row"><span class="player-setting-copy"><span class="player-setting-label">Reducir movimiento</span><span class="player-setting-help">Minimiza animaciones decorativas.</span></span><input id="player-setting-reduce-motion" class="player-setting-toggle" type="checkbox"></label>
          <label class="player-setting-row"><span class="player-setting-copy"><span class="player-setting-label">Texto grande</span><span class="player-setting-help">Aumenta la escala de lectura del terminal.</span></span><input id="player-setting-large-text" class="player-setting-toggle" type="checkbox"></label>
          <label class="player-setting-row"><span class="player-setting-copy"><span class="player-setting-label">Interfaz compacta</span><span class="player-setting-help">Reduce altura de módulos.</span></span><input id="player-setting-compact" class="player-setting-toggle" type="checkbox"></label>
        </section>
        <section class="player-settings-section">
          <h3>COMUNICACIÓN</h3><p>Dos sistemas con responsabilidades distintas.</p>
          <div class="player-setting-row"><span class="player-setting-copy"><span class="player-setting-label">Directorio de Red</span><span class="player-setting-help">Números y alias para Email/Chat; no modifica relaciones.</span></span></div>
          <div class="player-setting-row"><span class="player-setting-copy"><span class="player-setting-label">Vínculos</span><span class="player-setting-help">Afinidad, relaciones y progreso social; se abre desde el HUD.</span></span></div>
        </section>
        <section class="player-settings-section">
          <h3>DISPOSITIVO</h3><p>Restablece preferencias locales, no datos del personaje.</p>
          <button id="player-settings-reset" class="player-settings-action" type="button">RESTABLECER PREFERENCIAS</button>
        </section>
      </div>`;

    const volume = doc.getElementById("player-setting-volume");
    const output = doc.getElementById("player-setting-volume-value");
    const stored = Math.max(0, Math.min(1, Number(readStored(STORAGE.volume, "1")) || 0));
    volume.value = String(Math.round(stored * 100));
    output.value = `${volume.value}%`;
    applyVolume(stored);
    volume.addEventListener("input", () => {
      const next = applyVolume(Number(volume.value) / 100);
      output.value = `${Math.round(next * 100)}%`;
      writeStored(STORAGE.volume, next);
    });

    const muteSetting = doc.getElementById("player-setting-mute");
    const muteButton = doc.getElementById("btn-toggle-mute");
    const syncMute = () => { if (muteSetting) muteSetting.checked = currentMuteState(); };
    syncMute();
    muteSetting?.addEventListener("change", () => {
      if (muteButton && muteSetting.checked !== currentMuteState()) muteButton.click();
      global.setTimeout(syncMute, 0);
    });
    if (muteButton) new MutationObserver(syncMute).observe(muteButton, { childList: true, subtree: true, attributes: true });

    bindBooleanSetting("player-setting-reduce-motion", STORAGE.reduceMotion, "player-reduce-motion");
    bindBooleanSetting("player-setting-large-text", STORAGE.largeText, "player-terminal-large-text");
    bindBooleanSetting("player-setting-compact", STORAGE.compact, "player-terminal-compact");

    doc.getElementById("player-settings-reset")?.addEventListener("click", () => {
      Object.values(STORAGE).forEach((key) => { try { global.localStorage?.removeItem(key); } catch (_) {} });
      doc.body.classList.remove("player-reduce-motion", "player-terminal-large-text", "player-terminal-compact");
      ["player-setting-reduce-motion", "player-setting-large-text", "player-setting-compact"].forEach((id) => {
        const input = doc.getElementById(id); if (input) input.checked = false;
      });
      volume.value = "100";
      output.value = "100%";
      applyVolume(1);
    });
  }

  function bindMediaVolume() {
    doc.addEventListener("play", (event) => {
      const target = event.target;
      if (!global.HTMLMediaElement || !(target instanceof global.HTMLMediaElement)) return;
      try { target.volume = Math.max(0, Math.min(1, Number(readStored(STORAGE.volume, "1")))); } catch (_) {}
    }, true);
  }

  function boot() {
    normalizePhoneLauncher();
    suppressLegacyProfileRolls();
    renameRelationshipUx();
    buildSettingsPanel();
    bindMediaVolume();
    watchTheatreLog();
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousPlayerUxPolish = Object.freeze({
    initialsIcon,
    actorAssignedIcon,
    polishLogRows,
    normalizePhoneLauncher,
    suppressLegacyProfileRolls,
    renameRelationshipUx,
    buildSettingsPanel,
  });
})(window);
