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

  function onReady(callback) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", callback, { once: true });
    else callback();
  }

  function readStored(key, fallback) {
    try {
      const value = global.localStorage?.getItem(key);
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      global.localStorage?.setItem(key, String(value));
    } catch (_) {}
  }

  function escapeXml(value) {
    return String(value || "?")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function initialsIcon(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    const initials = (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : parts[0]?.slice(0, 2) || "?").toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#17130f"/><path d="M50 4 87 20 98 55 76 96 24 96 2 55 13 20Z" fill="none" stroke="#b98a32" stroke-width="5"/><text x="50" y="59" text-anchor="middle" font-family="monospace" font-size="34" font-weight="700" fill="#e6d7b8">${escapeXml(initials)}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }

  function getActorRecords() {
    const cache = global.allActoresCache;
    return cache && typeof cache === "object" ? Object.values(cache) : [];
  }

  function findActorByName(name) {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) return null;
    return getActorRecords().find((actor) =>
      String(actor?.nombre || actor?.name || "").trim().toLowerCase() === normalized
    ) || null;
  }

  function actorAssignedIcon(actor) {
    if (!actor) return "";
    return actor.icono || actor.icono_jugador || actor.icon_url || "";
  }

  function polishLogRows() {
    const log = doc.getElementById("theatre-log-container");
    if (!log) return;

    log.querySelectorAll(".dialogue-row").forEach((row) => {
      const img = row.querySelector(".hex-portrait img");
      if (!img) return;
      const displayedName = row.querySelector(".character-name")?.textContent || img.alt || "Desconocido";
      const actor = findActorByName(displayedName);
      const assignedIcon = actorAssignedIcon(actor);
      const forbiddenSources = [actor?.sprite, actor?.url, actor?.avatar].filter(Boolean);
      const current = img.getAttribute("src") || "";

      if (assignedIcon) {
        if (current !== assignedIcon) img.src = assignedIcon;
      } else if (actor && forbiddenSources.includes(current)) {
        img.src = initialsIcon(displayedName);
      }

      img.classList.add("theatre-log-actor-icon");
      img.addEventListener("error", () => {
        img.src = initialsIcon(displayedName);
      }, { once: true });
    });
  }

  function watchTheatreLog() {
    const run = () => polishLogRows();
    run();
    const observer = new MutationObserver(run);
    observer.observe(doc.body, { childList: true, subtree: true });
    global.setInterval(run, 1500);
  }

  function renameRelationshipUx() {
    const apegoButton = doc.querySelector('[name="act_hud_apego"]');
    if (apegoButton) {
      const label = apegoButton.querySelector("span");
      if (label) label.textContent = "Vínculos";
      apegoButton.title = "Vínculos y relaciones personales";
      apegoButton.setAttribute("aria-label", "Abrir vínculos y relaciones personales");
    }

    const apegoModal = doc.getElementById("apego-modal");
    if (apegoModal) {
      apegoModal.querySelectorAll("h1,h2,h3,h4").forEach((heading) => {
        if (/apego/i.test(heading.textContent || "")) heading.textContent = "VÍNCULOS / RELACIONES";
      });
    }

    const directoryButton = doc.getElementById("btn-show-contacts");
    if (directoryButton) {
      directoryButton.textContent = "DIRECTORIO";
      directoryButton.title = "Directorio de red: números y alias usados por Email/Chat";
      directoryButton.setAttribute("aria-label", "Abrir directorio de red para mensajería");
    }

    const directory = doc.getElementById("subtab-contacts");
    if (directory && !directory.querySelector(".player-network-directory-note")) {
      const note = doc.createElement("p");
      note.className = "player-network-directory-note";
      note.innerHTML = "<strong>DIRECTORIO DE RED:</strong> guarda números y alias para comunicación. Las relaciones personales, afinidad y progreso social se administran en <strong>VÍNCULOS</strong> desde el HUD.";
      const list = directory.querySelector("#contacts-list");
      if (list) directory.insertBefore(note, list);
      else directory.prepend(note);
    }
  }

  function currentMuteState() {
    const button = doc.getElementById("btn-toggle-mute");
    if (!button) return false;
    const text = button.textContent || "";
    return text.includes("🔕") || button.getAttribute("aria-pressed") === "true" || button.dataset.muted === "true";
  }

  function applyVolume(volume) {
    const normalized = Math.max(0, Math.min(1, Number(volume)));
    doc.querySelectorAll("audio, video").forEach((media) => {
      try { media.volume = normalized; } catch (_) {}
    });
    return normalized;
  }

  function applyBooleanSetting(inputId, storageKey, className) {
    const input = doc.getElementById(inputId);
    if (!input) return;
    const enabled = readStored(storageKey, "0") === "1";
    input.checked = enabled;
    doc.body.classList.toggle(className, enabled);
    input.addEventListener("change", () => {
      doc.body.classList.toggle(className, input.checked);
      writeStored(storageKey, input.checked ? "1" : "0");
    });
  }

  function buildSettingsPanel() {
    const settingsBody = doc.querySelector(".sheet-tab-settings .sheet-app-body");
    if (!settingsBody || settingsBody.dataset.playerUxReady === "true") return;
    settingsBody.dataset.playerUxReady = "true";

    settingsBody.innerHTML = `
      <div class="player-settings-console">
        <section class="player-settings-section" aria-labelledby="player-settings-audio-title">
          <h3 id="player-settings-audio-title">AUDIO / NOTIFICACIONES</h3>
          <p>Controles locales del dispositivo del jugador.</p>
          <label class="player-setting-row">
            <span class="player-setting-copy">
              <span class="player-setting-label">Silenciar alertas</span>
              <span class="player-setting-help">Usa el mismo estado de silencio que la campana del terminal.</span>
            </span>
            <input id="player-setting-mute" class="player-setting-toggle" type="checkbox">
          </label>
          <label class="player-setting-row">
            <span class="player-setting-copy">
              <span class="player-setting-label">Volumen maestro local</span>
              <span class="player-setting-help">Afecta audio y video reproducidos en este navegador.</span>
            </span>
            <span class="player-setting-volume-wrap">
              <input id="player-setting-volume" type="range" min="0" max="100" step="5">
              <output id="player-setting-volume-value">100%</output>
            </span>
          </label>
        </section>

        <section class="player-settings-section" aria-labelledby="player-settings-interface-title">
          <h3 id="player-settings-interface-title">INTERFAZ</h3>
          <p>Preferencias de lectura y densidad guardadas solo en este dispositivo.</p>
          <label class="player-setting-row">
            <span class="player-setting-copy">
              <span class="player-setting-label">Reducir movimiento</span>
              <span class="player-setting-help">Minimiza transiciones y animaciones decorativas.</span>
            </span>
            <input id="player-setting-reduce-motion" class="player-setting-toggle" type="checkbox">
          </label>
          <label class="player-setting-row">
            <span class="player-setting-copy">
              <span class="player-setting-label">Texto grande</span>
              <span class="player-setting-help">Aumenta la escala de lectura del Personal Terminal.</span>
            </span>
            <input id="player-setting-large-text" class="player-setting-toggle" type="checkbox">
          </label>
          <label class="player-setting-row">
            <span class="player-setting-copy">
              <span class="player-setting-label">Interfaz compacta</span>
              <span class="player-setting-help">Reduce altura de módulos para ver más contenido.</span>
            </span>
            <input id="player-setting-compact" class="player-setting-toggle" type="checkbox">
          </label>
        </section>

        <section class="player-settings-section" aria-labelledby="player-settings-network-title">
          <h3 id="player-settings-network-title">COMUNICACIÓN</h3>
          <p>El Directorio de Red y Vínculos son sistemas diferentes.</p>
          <div class="player-setting-row">
            <span class="player-setting-copy">
              <span class="player-setting-label">Directorio de Red</span>
              <span class="player-setting-help">Números y alias para Email/Chat. No modifica relaciones.</span>
            </span>
          </div>
          <div class="player-setting-row">
            <span class="player-setting-copy">
              <span class="player-setting-label">Vínculos</span>
              <span class="player-setting-help">Afinidad, relaciones y progreso social. Se abre desde el HUD superior.</span>
            </span>
          </div>
        </section>

        <section class="player-settings-section" aria-labelledby="player-settings-reset-title">
          <h3 id="player-settings-reset-title">DISPOSITIVO</h3>
          <p>Restablece solo preferencias visuales y de audio locales.</p>
          <button id="player-settings-reset" class="player-settings-action" type="button">RESTABLECER PREFERENCIAS</button>
        </section>
      </div>
    `;

    const volume = doc.getElementById("player-setting-volume");
    const volumeOutput = doc.getElementById("player-setting-volume-value");
    const storedVolume = Math.round(Number(readStored(STORAGE.volume, "1")) * 100);
    volume.value = String(Number.isFinite(storedVolume) ? Math.max(0, Math.min(100, storedVolume)) : 100);
    volumeOutput.value = `${volume.value}%`;
    applyVolume(Number(volume.value) / 100);
    volume.addEventListener("input", () => {
      const normalized = applyVolume(Number(volume.value) / 100);
      volumeOutput.value = `${Math.round(normalized * 100)}%`;
      writeStored(STORAGE.volume, normalized);
    });

    const muteSetting = doc.getElementById("player-setting-mute");
    const muteButton = doc.getElementById("btn-toggle-mute");
    const syncMute = () => { if (muteSetting) muteSetting.checked = currentMuteState(); };
    syncMute();
    muteSetting?.addEventListener("change", () => {
      if (!muteButton) return;
      if (muteSetting.checked !== currentMuteState()) muteButton.click();
      global.setTimeout(syncMute, 0);
    });
    if (muteButton) new MutationObserver(syncMute).observe(muteButton, { childList: true, characterData: true, subtree: true, attributes: true });

    applyBooleanSetting("player-setting-reduce-motion", STORAGE.reduceMotion, "player-reduce-motion");
    applyBooleanSetting("player-setting-large-text", STORAGE.largeText, "player-terminal-large-text");
    applyBooleanSetting("player-setting-compact", STORAGE.compact, "player-terminal-compact");

    doc.getElementById("player-settings-reset")?.addEventListener("click", () => {
      Object.values(STORAGE).forEach((key) => {
        try { global.localStorage?.removeItem(key); } catch (_) {}
      });
      doc.body.classList.remove("player-reduce-motion", "player-terminal-large-text", "player-terminal-compact");
      if (volume) volume.value = "100";
      if (volumeOutput) volumeOutput.value = "100%";
      applyVolume(1);
      ["player-setting-reduce-motion", "player-setting-large-text", "player-setting-compact"].forEach((id) => {
        const input = doc.getElementById(id);
        if (input) input.checked = false;
      });
    });
  }

  function bindMediaVolume() {
    doc.addEventListener("play", (event) => {
      const target = event.target;
      if (!(target instanceof global.HTMLMediaElement)) return;
      const volume = Number(readStored(STORAGE.volume, "1"));
      try { target.volume = Math.max(0, Math.min(1, volume)); } catch (_) {}
    }, true);
  }

  function boot() {
    renameRelationshipUx();
    buildSettingsPanel();
    bindMediaVolume();
    watchTheatreLog();

    const domObserver = new MutationObserver(() => {
      renameRelationshipUx();
      buildSettingsPanel();
    });
    domObserver.observe(doc.body, { childList: true, subtree: true });
  }

  onReady(boot);

  global.LuminousPlayerUxPolish = Object.freeze({
    initialsIcon,
    actorAssignedIcon,
    polishLogRows,
    renameRelationshipUx,
    buildSettingsPanel,
  });
})(window);
