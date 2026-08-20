(function (global) {
  "use strict";

  if (global.LuminousTheatreLanguagePolicy) return;
  const firebase = global.firebase;
  if (!firebase?.database) return;

  const db = firebase.database();
  const theatre = global.LuminousTheatreState || null;
  const LANGUAGE_ROOTS = ["campaña/idiomas", "campaña/teatro/idiomas"];
  const QUEUE_PATH = "campaña/teatro/cola";
  const sources = {};
  let definitions = {};
  let currentScene = {};
  let sceneRef = null;
  let scenePath = null;
  let manager = global.LuminousCharacterManager || null;
  let managerSubscribed = false;

  function isDmView() {
    return Boolean(document.body?.classList.contains("on-game-dashboard"));
  }

  function ensureRuntimeScript(id, src, datasetKey) {
    let script = document.getElementById(id);
    if (script) return script;
    script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = false;
    if (datasetKey) script.dataset[datasetKey] = "true";
    document.head?.appendChild(script);
    return script;
  }

  function ensurePlayerSpecialLanguageRuntime() {
    if (isDmView()) return;
    const ensureLog = () => ensureRuntimeScript(
      "theatre-special-language-log-runtime-script",
      "js/theatre-special-language-log-hotfix.js",
      "luminousSpecialLanguageLogRuntime",
    );
    if (global.LuminousSpecialLanguageEnforcement) {
      ensureLog();
      return;
    }
    const enforcement = ensureRuntimeScript(
      "theatre-special-language-enforcement-runtime-script",
      "js/theatre-special-language-enforcement-hotfix.js",
      "luminousSpecialLanguageEnforcementRuntime",
    );
    enforcement.addEventListener("load", ensureLog, { once: true });
  }

  function getManager() {
    if (!manager) manager = global.LuminousCharacterManager || null;
    if (manager && isDmView() && !managerSubscribed) {
      managerSubscribed = true;
      manager.subscribeActors?.(refreshDmSelector);
    }
    return manager;
  }

  function label(languageId, definition) {
    return String(definition?.nombre || definition?.name || definition?.label || languageId).toUpperCase();
  }

  function normalizeKnowledge(value) {
    if (typeof value === "number" || typeof value === "string") return { porcentaje: Math.max(0, Math.min(100, Number(value) || 0)), comprendido: false };
    if (!value || typeof value !== "object") return { porcentaje: 0, comprendido: false };
    return {
      porcentaje: Math.max(0, Math.min(100, Number(value.porcentaje ?? value.percent ?? value.conocimiento ?? value.knowledge ?? 0) || 0)),
      comprendido: Boolean(value.comprendido ?? value.understood ?? value.distortionUnderstood ?? false),
    };
  }

  function mergeKnowledge() {
    const merged = {};
    Array.from(arguments).forEach((container) => {
      if (!container || typeof container !== "object") return;
      Object.entries(container).forEach(([languageId, entry]) => { merged[languageId] = normalizeKnowledge(entry); });
    });
    return merged;
  }

  function commonOption() {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = label("common", definitions.common || { nombre: "Común" });
    option.dataset.languageId = "common";
    return option;
  }

  function fillSelector(select, knowledge, allowAll) {
    if (!select) return;
    const previous = select.value;
    const fragment = document.createDocumentFragment();
    fragment.appendChild(commonOption());
    Object.entries(definitions)
      .filter(([languageId]) => languageId !== "common")
      .sort((a, b) => label(a[0], a[1]).localeCompare(label(b[0], b[1])))
      .forEach(([languageId, definition]) => {
        const known = normalizeKnowledge(knowledge?.[languageId]);
        if (!allowAll && known.porcentaje <= 0) return;
        const option = document.createElement("option");
        option.value = languageId;
        option.textContent = label(languageId, definition);
        fragment.appendChild(option);
      });
    select.replaceChildren(fragment);
    if (previous && Array.from(select.options).some((option) => option.value === previous)) select.value = previous;
    else select.value = "";
  }

  function bindScene() {
    if (!theatre?.getPaths) return;
    const nextPath = theatre.getPaths().scene;
    if (!nextPath || nextPath === scenePath) return;
    if (sceneRef) sceneRef.off();
    scenePath = nextPath;
    sceneRef = db.ref(scenePath);
    sceneRef.on("value", (snapshot) => {
      currentScene = snapshot.val() || {};
      refreshDmSelector();
    });
  }

  function speakerKnowledge() {
    const speakerId = document.getElementById("theatre-speaker-select")?.value;
    if (!speakerId || speakerId === "narrador") return { all: true, knowledge: {} };
    const liveActor = currentScene?.actores?.[speakerId] || {};
    const masterId = liveActor.identityId || liveActor.identidadId || liveActor.sourceActorId || speakerId;
    const characterManager = getManager();
    if (characterManager?.getActor?.(masterId)) return { all: false, knowledge: characterManager.languageKnowledgeForActor(masterId) };
    return { all: false, knowledge: mergeKnowledge(liveActor.idiomas, liveActor.languages) };
  }

  function refreshDmSelector() {
    if (!isDmView()) return;
    getManager();
    bindScene();
    const select = document.getElementById("theatre-language-select");
    if (!select) return;
    const source = speakerKnowledge();
    fillSelector(select, source.knowledge, source.all);
  }

  function playerKnowledge() {
    const player = global.datosJugador || global.currentCharacterData || global.currentPlayerData || global.playerData || {};
    const actor = global.getAssignedTheatreActor?.() || {};
    return mergeKnowledge(
      actor.idiomas,
      actor.languages,
      player.idiomas,
      player.lenguajes,
      player.languages,
      player.conocimiento_idiomas,
      player.languageKnowledge
    );
  }

  function ensurePlayerSelector() {
    if (isDmView()) return null;
    const container = document.getElementById("contenedor-selectores-emocion");
    if (!container) return null;
    let select = document.getElementById("player-theatre-language-select");
    if (!select) {
      select = document.createElement("select");
      select.id = "player-theatre-language-select";
      select.className = "theatre-player-composer-select";
      select.setAttribute("aria-label", "Idioma de la intervención");
      select.title = "Idioma";
      const expression = document.getElementById("player-expression");
      container.insertBefore(select, expression || null);
    }
    fillSelector(select, playerKnowledge(), false);
    return select;
  }

  function patchPlayerQueueWrites() {
    if (isDmView()) return;
    const database = firebase.database();
    if (database.__luminousLanguageRefPatched) return;
    const originalRef = database.ref.bind(database);
    database.ref = function (path) {
      const ref = originalRef.apply(database, arguments);
      const normalized = String(path || "").replace(/^\/+|\/+$/g, "");
      if (normalized !== QUEUE_PATH || ref.__luminousLanguagePushPatched) return ref;
      const originalPush = ref.push.bind(ref);
      ref.push = function (value) {
        const next = value && typeof value === "object" ? { ...value } : value;
        const languageId = document.getElementById("player-theatre-language-select")?.value || "";
        if (next && typeof next === "object") {
          if (languageId) next.idiomaId = languageId;
          else delete next.idiomaId;
        }
        return originalPush.apply(ref, [next].concat(Array.prototype.slice.call(arguments, 1)));
      };
      ref.__luminousLanguagePushPatched = true;
      return ref;
    };
    database.__luminousLanguageRefPatched = true;
  }

  function refresh() {
    if (isDmView()) refreshDmSelector();
    else ensurePlayerSelector();
  }

  LANGUAGE_ROOTS.forEach((root) => {
    db.ref(root).on("value", (snapshot) => {
      sources[root] = snapshot.val() || {};
      definitions = Object.assign({}, ...LANGUAGE_ROOTS.map((key) => sources[key] || {}));
      refresh();
    });
  });

  if (isDmView()) {
    bindScene();
    getManager();
    const managerTimer = global.setInterval(() => {
      if (getManager()) global.clearInterval(managerTimer);
    }, 100);
    document.addEventListener("change", (event) => {
      if (event.target?.id === "theatre-speaker-select") refreshDmSelector();
    });
  } else {
    ensurePlayerSpecialLanguageRuntime();
    patchPlayerQueueWrites();
    document.addEventListener("click", (event) => {
      if (event.target?.closest?.("#btn-abrir-escritura")) global.setTimeout(ensurePlayerSelector, 0);
    }, true);
    global.addEventListener("actoresCacheUpdated", () => global.setTimeout(ensurePlayerSelector, 0));
    global.setInterval(ensurePlayerSelector, 1000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", refresh, { once: true });
  else refresh();

  global.LuminousTheatreLanguagePolicy = Object.freeze({
    refresh,
    getDefinitions: () => ({ ...definitions }),
    getPlayerKnowledge: playerKnowledge,
  });
})(window);
