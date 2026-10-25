/* Luminous Audio Director — one campaign soundtrack, individual listening preferences.
 * Audio sources are registered assets; the DM controls shared intent, never player volume. */
(function (global) {
  "use strict";
  if (global.LuminousAudio) return;

  const SETTINGS_KEY = "luminous.audio.preferences.v1";
  const ROOT = "campaña/audio_director";
  const BOOTSTRAP_DM = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
  const LIBRARY = Object.freeze({
    music: Object.freeze([
      Object.freeze({ id: "lament", label: "In Hell We Live, Lament — Instrumental", url: "Assets/Audio/Intro%20audio/Limbus%20Company%20OST%20-%20In%20Hell%20We%20Live%2C%20Lament%20Instrumental.mp3" })
    ]),
    ambience: Object.freeze([
      Object.freeze({ id: "bus", label: "Motor y traqueteo del bus", url: "Assets/Audio/Intro%20audio/220618_StorySound_1_busRattle.wav" })
    ]),
    sfx: Object.freeze([
      Object.freeze({ id: "coin-heads", label: "Moneda: cara", url: "Assets/Audio/SFX/UI/Coin%20SFX/Coin_Heads.wav" }),
      Object.freeze({ id: "coin-tails", label: "Moneda: cruz", url: "Assets/Audio/SFX/UI/Coin%20SFX/Coin_Tails.wav" })
    ])
  });

  function clamp(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : fallback;
  }
  function readPrefs() {
    try {
      const stored = JSON.parse(global.localStorage.getItem(SETTINGS_KEY) || "{}");
      return { music: clamp(stored.music, 40), sfx: clamp(stored.sfx, 40) };
    } catch (_) {
      return { music: 40, sfx: 40 };
    }
  }
  const prefs = readPrefs();
  const registered = new Map();
  const oneShots = new Set();
  const music = new Audio();
  const ambience = new Audio();
  music.loop = true;
  ambience.loop = true;
  music.preload = "none";
  ambience.preload = "none";

  let authenticatedUser = null;
  let isDirector = false;
  let database = null;
  let audioRef = null;
  let configRef = null;
  let offsetRef = null;
  let audioListener = null;
  let configListener = null;
  let offsetListener = null;
  let musicState = null;
  let ambienceState = null;
  let previousMusicKey = null;
  let previousAmbienceKey = null;
  let firstCueReceived = false;
  let previousCue = null;
  let ownCue = null;
  let serverOffset = 0;
  let mounted = false;
  let panel = null;
  let trigger = null;
  let lastFocus = null;
  let statusNode = null;
  let hintNode = null;

  const byId = (kind, id) => LIBRARY[kind].find((entry) => entry.id === id);
  const adjustedVolume = (bus, gain) => (prefs[bus] / 100) * gain;

  function applyVolumes() {
    music.volume = adjustedVolume("music", 1);
    ambience.volume = adjustedVolume("sfx", 1);
    registered.forEach((registration, element) => {
      element.volume = Math.max(0, Math.min(1, adjustedVolume(registration.bus, registration.gain)));
    });
    oneShots.forEach((element) => { element.volume = adjustedVolume("sfx", 1); });
    if (panel) {
      ["music", "sfx"].forEach((bus) => {
        const range = panel.querySelector('[data-audio-range="' + bus + '"]');
        const output = panel.querySelector('[data-audio-value="' + bus + '"]');
        if (range) range.value = String(prefs[bus]);
        if (output) output.textContent = prefs[bus] + "%";
      });
    }
  }
  function setVolume(bus, value) {
    if (bus !== "music" && bus !== "sfx") return;
    prefs[bus] = clamp(value, prefs[bus]);
    try { global.localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch (_) { /* local only */ }
    applyVolumes();
  }
  function registerElement(element, bus, gain) {
    if (!element || (bus !== "music" && bus !== "sfx")) return;
    registered.set(element, { bus, gain: Number.isFinite(gain) ? Math.max(0, Math.min(1, gain)) : 1 });
    applyVolumes();
  }
  function playSafely(element) {
    if (!element || !element.src) return;
    const result = element.play();
    if (result && typeof result.catch === "function") {
      result.catch(() => { setHint("El navegador requiere un toque para reproducir. Pulsa «Activar audio»."); });
    }
  }
  function setHint(message) {
    if (hintNode) hintNode.textContent = message;
  }
  function serverNow() { return Date.now() + serverOffset; }
  function syncPosition(element, state) {
    if (!element || !state || !Number.isFinite(state.startedAt) || state.startedAt <= 0) return;
    function seek() {
      if (!Number.isFinite(element.duration) || element.duration <= 0) return;
      const elapsed = Math.max(0, (serverNow() - state.startedAt) / 1000);
      const position = elapsed % element.duration;
      if (Math.abs((element.currentTime || 0) - position) > 1.25) {
        try { element.currentTime = position; } catch (_) { /* awaiting metadata */ }
      }
    }
    if (element.readyState >= 1) seek();
    else element.addEventListener("loadedmetadata", seek, { once: true });
  }
  function receiveLoop(kind, state) {
    const element = kind === "music" ? music : ambience;
    const oldKey = kind === "music" ? previousMusicKey : previousAmbienceKey;
    const entry = state && state.active === true ? byId(kind, state.trackId) : null;
    const nextKey = entry ? entry.id + ":" + String(state.startedAt || 0) : "off";
    if (kind === "music") musicState = state;
    else ambienceState = state;
    if (nextKey === oldKey) { updateStatus(); return; }
    if (kind === "music") previousMusicKey = nextKey;
    else previousAmbienceKey = nextKey;
    if (!entry) {
      element.pause();
      element.removeAttribute("src");
      element.load();
    } else {
      const absoluteUrl = new URL(entry.url, global.location.href).href;
      if (element.src !== absoluteUrl) element.src = absoluteUrl;
      syncPosition(element, state);
      playSafely(element);
    }
    updateStatus();
  }
  function playEffect(id) {
    const entry = byId("sfx", id);
    if (!entry) return false;
    // Limit concurrent bursts and always release ended audio elements.
    if (oneShots.size >= 12) return false;
    const sound = new Audio(entry.url);
    sound.volume = adjustedVolume("sfx", 1);
    oneShots.add(sound);
    const release = () => oneShots.delete(sound);
    sound.addEventListener("ended", release, { once: true });
    sound.addEventListener("error", release, { once: true });
    const result = sound.play();
    if (result && typeof result.catch === "function") result.catch(() => {
      release();
      setHint("Pulsa «Activar audio» para permitir los sonidos.");
    });
    return true;
  }
  function receiveCue(cue) {
    const token = cue && typeof cue.nonce === "string" ? cue.nonce : "";
    if (!firstCueReceived) {
      firstCueReceived = true;
      previousCue = token;
      return; // A late join never replays the last sound of a previous scene.
    }
    if (!token || token === previousCue) return;
    previousCue = token;
    if (token === ownCue) { ownCue = null; return; }
    playEffect(cue.cueId);
  }
  function updateStatus() {
    if (!statusNode) return;
    const item = musicState && musicState.active ? byId("music", musicState.trackId) : null;
    const ambiance = ambienceState && ambienceState.active ? byId("ambience", ambienceState.trackId) : null;
    statusNode.textContent = item ? "Música de campaña: " + item.label : "La campaña está en silencio.";
    if (ambiance) statusNode.textContent += " · Ambiente: " + ambiance.label;
  }
  function optionsFor(kind) {
    return LIBRARY[kind].map((entry) => '<option value="' + entry.id + '">' + entry.label + '</option>').join("");
  }
  function updateDirectorView() {
    if (!panel) return;
    const section = panel.querySelector("[data-audio-director]");
    if (section) section.hidden = !isDirector;
    panel.querySelectorAll("[data-audio-command]").forEach((button) => { button.disabled = !isDirector; });
  }
  function showPanel() {
    if (!panel) return;
    lastFocus = global.document.activeElement;
    panel.hidden = false;
    trigger && trigger.setAttribute("aria-expanded", "true");
    const first = panel.querySelector("[data-audio-close]");
    first && first.focus();
    applyVolumes();
    updateStatus();
  }
  function closePanel() {
    if (!panel) return;
    panel.hidden = true;
    if (trigger) trigger.setAttribute("aria-expanded", "false");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }
  async function directorWrite(channel, data) {
    if (!isDirector || !authenticatedUser || !audioRef) {
      setHint("Sólo el Director puede controlar el audio de campaña.");
      return;
    }
    try {
      await audioRef.child(channel).set(data);
      setHint("Se envió el cambio a la campaña.");
      return true;
    } catch (_) {
      setHint("No se pudo enviar el audio. Revisa la conexión y permisos del DM.");
      // A click can start local playback before RTDB confirms the write.
      // Always restore the last confirmed session when that write fails.
      if (channel === "music") { previousMusicKey = null; receiveLoop("music", musicState); }
      if (channel === "ambience") { previousAmbienceKey = null; receiveLoop("ambience", ambienceState); }
      return false;
    }
  }
  function previewLoopOnGesture(kind, entry) {
    // Direct user interaction unlocks audio in browsers that block remote
    // Firebase events from calling play() without a click.
    const element = kind === "music" ? music : ambience;
    const url = new URL(entry.url, global.location.href).href;
    if (element.src !== url) element.src = url;
    playSafely(element);
  }
  function command(type) {
    if (!isDirector || !audioRef) return;
    const stamp = global.firebase.database.ServerValue.TIMESTAMP;
    const selects = (kind) => panel.querySelector('[data-audio-select="' + kind + '"]');
    if (type === "play-music") {
      const trackId = selects("music").value;
      const entry = byId("music", trackId);
      if (entry) {
        previewLoopOnGesture("music", entry);
        directorWrite("music", { trackId, active: true, startedAt: stamp });
      }
    } else if (type === "stop-music") {
      directorWrite("music", { active: false, trackId: "", startedAt: 0 });
    } else if (type === "play-ambience") {
      const trackId = selects("ambience").value;
      const entry = byId("ambience", trackId);
      if (entry) {
        previewLoopOnGesture("ambience", entry);
        directorWrite("ambience", { trackId, active: true, startedAt: stamp });
      }
    } else if (type === "stop-ambience") {
      directorWrite("ambience", { active: false, trackId: "", startedAt: 0 });
    } else if (type === "cue") {
      const cueId = selects("sfx").value;
      if (!byId("sfx", cueId)) return;
      const nonce = audioRef.child("events").push().key;
      ownCue = nonce;
      playEffect(cueId); // immediate feedback from the DM's direct click
      directorWrite("cue", { cueId, nonce, at: stamp });
    }
  }
  function buildPanel() {
    if (mounted || !global.document.body) return;
    mounted = true;
    const doc = global.document;
    const hudMenu = doc.getElementById("hud-menu-dropdown");
    trigger = doc.createElement("button");
    trigger.type = "button";
    trigger.id = "luminous-audio-open";
    trigger.className = hudMenu ? "hud-menu-item luminous-audio-menu-entry" : "luminous-audio-floating";
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", "luminous-audio-panel");
    trigger.setAttribute("aria-label", "Opciones de sonido");
    trigger.innerHTML = '<span class="luminous-audio-symbol" aria-hidden="true">♫</span><span>Sonido</span>';
    if (hudMenu) hudMenu.appendChild(trigger);
    else doc.body.appendChild(trigger);

    panel = doc.createElement("section");
    panel.className = "luminous-audio-panel";
    panel.id = "luminous-audio-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", "Opciones de sonido");
    panel.hidden = true;
    panel.innerHTML = '<div class="luminous-audio-card">' +
      '<header class="luminous-audio-header"><div><p>CONFIGURACIÓN</p><h2>Audio de Luminous</h2></div>' +
      '<button type="button" data-audio-close aria-label="Cerrar opciones de sonido">×</button></header>' +
      '<div class="luminous-audio-scroll">' +
        '<p class="luminous-audio-info">Tu volumen es privado y se guarda en este dispositivo.</p>' +
        '<section class="luminous-audio-section"><h3>♫ Música</h3><label for="luminous-music-range">Volumen de música</label>' +
        '<div class="luminous-audio-slider"><input id="luminous-music-range" data-audio-range="music" type="range" min="0" max="100" step="1" aria-label="Volumen de música"><output data-audio-value="music"></output></div></section>' +
        '<section class="luminous-audio-section"><h3>Efectos de sonido</h3><label for="luminous-sfx-range">Volumen de efectos</label>' +
        '<div class="luminous-audio-slider"><input id="luminous-sfx-range" data-audio-range="sfx" type="range" min="0" max="100" step="1" aria-label="Volumen de efectos"><output data-audio-value="sfx"></output></div></section>' +
        '<button type="button" data-audio-activate class="luminous-audio-activate">Activar audio</button>' +
        '<p class="luminous-audio-status" data-audio-status aria-live="polite"></p>' +
        '<section class="luminous-audio-director" data-audio-director hidden><h3>Consola del Director</h3>' +
          '<p>Controla qué escuchan los participantes conectados.</p>' +
          '<label for="luminous-music-track">Pista musical</label><select id="luminous-music-track" data-audio-select="music">' + optionsFor("music") + '</select>' +
          '<div class="luminous-audio-actions"><button data-audio-command="play-music" type="button">Reproducir música</button><button data-audio-command="stop-music" type="button">Detener</button></div>' +
          '<label for="luminous-ambience-track">Ambiente</label><select id="luminous-ambience-track" data-audio-select="ambience">' + optionsFor("ambience") + '</select>' +
          '<div class="luminous-audio-actions"><button data-audio-command="play-ambience" type="button">Activar ambiente</button><button data-audio-command="stop-ambience" type="button">Silenciar ambiente</button></div>' +
          '<label for="luminous-sfx-track">Efecto puntual</label><select id="luminous-sfx-track" data-audio-select="sfx">' + optionsFor("sfx") + '</select>' +
          '<button data-audio-command="cue" class="luminous-audio-send" type="button">Emitir efecto a todos</button>' +
        '</section><p class="luminous-audio-hint" data-audio-hint role="status" aria-live="polite"></p>' +
      '</div></div>';
    doc.body.appendChild(panel);
    statusNode = panel.querySelector("[data-audio-status]");
    hintNode = panel.querySelector("[data-audio-hint]");
    trigger.addEventListener("click", (event) => { event.stopPropagation(); showPanel(); });
    panel.querySelector("[data-audio-close]").addEventListener("click", closePanel);
    panel.addEventListener("click", (event) => { if (event.target === panel) closePanel(); });
    panel.querySelectorAll("[data-audio-range]").forEach((range) => {
      range.addEventListener("input", () => setVolume(range.dataset.audioRange, range.value));
    });
    panel.querySelectorAll("[data-audio-command]").forEach((button) => {
      button.addEventListener("click", () => command(button.dataset.audioCommand));
    });
    panel.querySelector("[data-audio-activate]").addEventListener("click", () => {
      if (musicState && musicState.active) playSafely(music);
      if (ambienceState && ambienceState.active) playSafely(ambience);
      setHint("Intentando activar el audio. Si tu navegador lo bloquea, pulsa otra vez.");
    });
    doc.addEventListener("keydown", (event) => {
      if (panel.hidden) return;
      if (event.key === "Escape") { event.preventDefault(); closePanel(); }
      if (event.key === "Tab") {
        const nodes = Array.from(panel.querySelectorAll('button:not(:disabled):not([hidden]),input:not(:disabled),select:not(:disabled)'))
          .filter((node) => node.getClientRects().length > 0);
        if (!nodes.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    applyVolumes();
    updateStatus();
    updateDirectorView();
  }
  function detachFirebase() {
    if (audioRef && audioListener) audioRef.off("value", audioListener);
    if (configRef && configListener) configRef.off("value", configListener);
    if (offsetRef && offsetListener) offsetRef.off("value", offsetListener);
    audioRef = null;
    configRef = null;
    offsetRef = null;
    audioListener = null;
    configListener = null;
    offsetListener = null;
    firstCueReceived = false;
    previousCue = null;
    ownCue = null;
    isDirector = false;
    musicState = null;
    ambienceState = null;
    previousMusicKey = null;
    previousAmbienceKey = null;
    receiveLoop("music", null);
    receiveLoop("ambience", null);
    updateDirectorView();
  }
  function connectFirebase() {
    if (!global.firebase || !global.firebase.apps || !global.firebase.apps.length) return;
    const auth = global.firebase.auth();
    auth.onAuthStateChanged((user) => {
      detachFirebase();
      authenticatedUser = user;
      if (!user) return;
      database = global.firebase.database();
      configRef = database.ref("campaña/config/dm_uid");
      configListener = (snapshot) => {
        isDirector = user.uid === BOOTSTRAP_DM || user.uid === snapshot.val();
        updateDirectorView();
      };
      configRef.on("value", configListener, () => { isDirector = user.uid === BOOTSTRAP_DM; updateDirectorView(); });
      offsetRef = database.ref(".info/serverTimeOffset");
      offsetListener = (snapshot) => { serverOffset = Number(snapshot.val()) || 0; };
      offsetRef.on("value", offsetListener);
      audioRef = database.ref(ROOT);
      audioListener = (snapshot) => {
        const value = snapshot.val() || {};
        receiveLoop("music", value.music);
        receiveLoop("ambience", value.ambience);
        receiveCue(value.cue);
      };
      audioRef.on("value", audioListener, () => { setHint("La sincronización de audio no está disponible."); });
    });
  }
  global.addEventListener("storage", (event) => {
    if (event.key !== SETTINGS_KEY) return;
    const settings = readPrefs();
    prefs.music = settings.music;
    prefs.sfx = settings.sfx;
    applyVolumes();
  });

  function isHostedInsideAudioShell() {
    // Live combat is embedded by the player/Director shell. Those pages own
    // the music bus; a second one in the iframe would double the soundtrack.
    try {
      if (!global.parent || global.parent === global) return false;
      return /(?:^|\/)(?:hoja_personaje|hoja_de_DM|pantalla_dm|combate)\.html$/i
        .test(global.parent.location.pathname);
    } catch (_) {
      return false; // Standalone/cross-origin viewer remains independently usable.
    }
  }
  function init() {
    if (isHostedInsideAudioShell()) return;
    buildPanel();
    // These are the actual login audio elements. Voice and bus share the effects bus.
    const introVoice = global.document.getElementById("audio-inicio");
    const introFx = global.document.getElementById("audio-sfx");
    const introMusic = global.document.getElementById("audio-music");
    if (introVoice) registerElement(introVoice, "sfx", 1);
    if (introFx) registerElement(introFx, "sfx", 0.5);
    if (introMusic) registerElement(introMusic, "music", 1);
    connectFirebase();
  }
  global.LuminousAudio = Object.freeze({
    library: LIBRARY,
    getPreferences: () => ({ music: prefs.music, sfx: prefs.sfx }),
    setVolume,
    registerElement,
    playEffect,
    openOptions: showPanel
  });
  if (global.document.readyState === "loading") global.document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})(window);
