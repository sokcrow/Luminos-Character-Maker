(function (root, factory) {
  const api = factory(root || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const LANGUAGE_ROOTS = ["campaña/idiomas", "campaña/teatro/idiomas"];
  const LEGACY_UNDERSTANDING_KEYS = ["distortion_languages", "distortionLanguages", "distortions"];
  const CANONICAL_LANGUAGE_KEYS = ["idiomas", "lenguajes", "languages", "conocimiento_idiomas", "languageKnowledge"];

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function normalizeIdList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    if (typeof value === "object") return Object.keys(value).sort().map((key) => value[key]).filter(Boolean).map(String);
    return [String(value)];
  }

  function isSpecialDefinition(definition) {
    const system = String(definition?.sistema || definition?.system || "").toLowerCase();
    const type = String(definition?.tipo || definition?.type || "").toLowerCase();
    return definition?.especial === true
      || definition?.special === true
      || definition?.binario === true
      || definition?.binary === true
      || definition?.distortion === true
      || system === "special"
      || ["distortion", "distorsion", "singularity", "singularidad", "special"].includes(type);
  }

  function isSpecialLanguage(languageId, definition) {
    if (isSpecialDefinition(definition)) return true;
    return /^(?:distortion|distorsion|singularity|singularidad|special)_/i.test(String(languageId || ""));
  }

  function specialAccess(value) {
    if (typeof value === "number" || typeof value === "string") {
      const percentage = Math.max(0, Math.min(100, Number(value) || 0));
      return { habla: percentage > 0, entiende: false, porcentaje: percentage };
    }
    if (!value || typeof value !== "object") return { habla: false, entiende: false, porcentaje: 0 };
    const percentage = Math.max(0, Math.min(100, Number(value.porcentaje ?? value.percent ?? value.conocimiento ?? value.knowledge ?? 0) || 0));
    return {
      habla: Boolean(value.habla ?? value.speaks ?? value.canSpeak ?? percentage > 0),
      entiende: Boolean(value.entiende ?? value.understands ?? value.comprendido ?? value.understood ?? value.distortionUnderstood ?? false),
      porcentaje: percentage,
    };
  }

  function canonicalUnderstanding(profile, languageId) {
    if (!profile || !languageId) return { found: false, value: false };
    for (const key of CANONICAL_LANGUAGE_KEYS) {
      const container = profile[key];
      if (!container || typeof container !== "object" || !Object.prototype.hasOwnProperty.call(container, languageId)) continue;
      const entry = container[languageId];
      if (typeof entry === "boolean") return { found: true, value: entry };
      if (!entry || typeof entry !== "object") return { found: true, value: false };
      const fields = ["entiende", "understands", "comprendido", "understood", "distortionUnderstood"];
      for (const field of fields) {
        if (Object.prototype.hasOwnProperty.call(entry, field)) return { found: true, value: Boolean(entry[field]) };
      }
      // Una entrada canónica existente sin permiso ENTIENDE explícito cuenta como apagada.
      // Así un permiso legacy antiguo no puede reabrir un idioma que el DM acaba de bloquear.
      return { found: true, value: false };
    }
    return { found: false, value: false };
  }

  function legacyUnderstanding(profile, languageId) {
    if (!profile || !languageId) return false;
    for (const key of LEGACY_UNDERSTANDING_KEYS) {
      const entry = profile[key]?.[languageId];
      if (entry === true) return true;
      if (entry && typeof entry === "object" && (entry.entiende === true || entry.understands === true || entry.comprendido === true || entry.understood === true)) return true;
    }
    return false;
  }

  function resolveSpecialUnderstanding(profiles, languageId) {
    const list = Array.isArray(profiles) ? profiles : [profiles];
    // La primera fuente canónica que tenga el idioma es autoritativa, incluso cuando vale false.
    for (const profile of list) {
      const canonical = canonicalUnderstanding(profile, languageId);
      if (canonical.found) return canonical.value;
    }
    // Legacy solo sirve de fallback si ninguna fuente canónica define este idioma.
    return list.some((profile) => legacyUnderstanding(profile, languageId));
  }


  function clampPercentage(value) {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  function canonicalKnowledgePercentage(profile, languageId) {
    if (!profile || !languageId) return { found: false, value: 0 };
    for (const key of CANONICAL_LANGUAGE_KEYS) {
      const container = profile[key];
      if (!container || typeof container !== "object" || !Object.prototype.hasOwnProperty.call(container, languageId)) continue;
      const entry = container[languageId];
      if (typeof entry === "boolean") return { found: true, value: entry ? 100 : 0 };
      if (typeof entry === "number" || typeof entry === "string") {
        return { found: true, value: clampPercentage(entry) };
      }
      if (!entry || typeof entry !== "object") return { found: true, value: 0 };

      const rawPercentage = entry.porcentaje ?? entry.percent ?? entry.conocimiento ?? entry.knowledge;
      if (rawPercentage !== undefined && rawPercentage !== null && rawPercentage !== "") {
        return { found: true, value: clampPercentage(rawPercentage) };
      }

      const understands = entry.entiende ?? entry.understands ?? entry.comprendido ?? entry.understood;
      if (understands !== undefined) return { found: true, value: understands ? 100 : 0 };
      const speaks = entry.habla ?? entry.speaks ?? entry.canSpeak;
      if (speaks !== undefined) return { found: true, value: speaks ? 100 : 0 };
      return { found: true, value: 0 };
    }
    return { found: false, value: 0 };
  }

  function resolveLanguageKnowledgePercentage(profiles, languageId, definition = {}) {
    if (!languageId || languageId === "common" || definition?.universal === true) return 100;
    const list = Array.isArray(profiles) ? profiles : [profiles];
    for (const profile of list) {
      const resolved = canonicalKnowledgePercentage(profile, languageId);
      if (resolved.found) return resolved.value;
    }
    return 0;
  }

  function stableHash(value) {
    const text = String(value || "");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  const RUNE_GLYPHS = Array.from("ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛋᛏᛒᛖᛗᛚᛜᛞᛟ");

  function maskedWord(word, style, seed) {
    if (style === "runes" || style === "rune" || style === "runas") {
      return Array.from(word).map((_, index) => {
        const runeIndex = stableHash(`${seed}|${word}|${index}`) % RUNE_GLYPHS.length;
        return RUNE_GLYPHS[runeIndex];
      }).join("");
    }
    if (style === "blocks" || style === "block" || style === "redacted") {
      return "█".repeat(Math.max(1, Array.from(word).length));
    }
    return "…";
  }

  function obfuscateByKnowledge(text, percentage, definition = {}, seed = "") {
    const raw = String(text || "");
    const knowledge = clampPercentage(percentage);
    if (!raw || knowledge >= 100) return raw;

    const prefixMatch = raw.match(/^\/em\s+/i);
    const prefix = prefixMatch?.[0] || "";
    const body = prefix ? raw.slice(prefix.length) : raw;
    const tokenRegex = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
    const tokens = Array.from(body.matchAll(tokenRegex));
    if (!tokens.length) return raw;

    let revealCount = Math.round(tokens.length * knowledge / 100);
    if (knowledge <= 0) revealCount = 0;
    else if (knowledge < 100 && tokens.length === 1) revealCount = 0;
    else if (knowledge > 0 && revealCount === 0) revealCount = 1;
    if (knowledge < 100) revealCount = Math.min(revealCount, Math.max(0, tokens.length - 1));

    const ranked = tokens.map((match, index) => ({
      index,
      score: stableHash(`${seed}|${body}|${match[0]}|${match.index}|${index}`),
    })).sort((a, b) => (a.score - b.score) || (a.index - b.index));
    const revealed = new Set(ranked.slice(0, revealCount).map((entry) => entry.index));

    const style = String(
      definition?.estilo_ofuscacion
      || definition?.obfuscationStyle
      || definition?.obfuscation
      || "ellipsis"
    ).toLowerCase();

    let cursor = 0;
    let output = "";
    tokens.forEach((match, index) => {
      const start = Number(match.index) || 0;
      const word = match[0];
      output += body.slice(cursor, start);
      output += revealed.has(index) ? word : maskedWord(word, style, `${seed}|${index}`);
      cursor = start + word.length;
    });
    output += body.slice(cursor);
    return prefix + output;
  }

  function resolveLanguageText(message, definitions, profiles) {
    const raw = String(message?.mensaje || message?.message || "");
    const languageId = clean(message?.idiomaId || message?.languageId || message?.idioma);
    if (!languageId) return raw;

    const definition = definitions?.[languageId] || {};
    if (languageId === "common" || definition?.universal === true) return raw;

    if (isSpecialLanguage(languageId, definition)) {
      return resolveSpecialUnderstanding(profiles, languageId)
        ? raw
        : unknownTextForDefinition(definition);
    }

    const percentage = resolveLanguageKnowledgePercentage(profiles, languageId, definition);
    return obfuscateByKnowledge(raw, percentage, definition, languageId);
  }

  function preferredSpecialLanguage(definitions, knowledge) {
    const candidates = Object.entries(definitions || {})
      .filter(([languageId, definition]) => languageId !== "common" && isSpecialLanguage(languageId, definition))
      .filter(([languageId]) => specialAccess(knowledge?.[languageId]).habla)
      .map(([languageId]) => languageId);
    return candidates.length === 1 ? candidates[0] : null;
  }

  function unknownTextForDefinition(definition) {
    const kind = String(definition?.subtipo || definition?.specialKind || definition?.tipo || definition?.type || "").toLowerCase();
    return String(
      definition?.texto_desconocido
      || definition?.unknownText
      || definition?.distortionText
      || (kind.includes("sing") ? "[No puedes interpretar esta Singularidad.]" : "[No comprendes este lenguaje especial.]")
    );
  }

  const api = Object.freeze({
    isSpecialDefinition,
    isSpecialLanguage,
    specialAccess,
    canonicalUnderstanding,
    resolveSpecialUnderstanding,
    canonicalKnowledgePercentage,
    resolveLanguageKnowledgePercentage,
    obfuscateByKnowledge,
    resolveLanguageText,
    preferredSpecialLanguage,
    unknownTextForDefinition,
  });

  if (!global?.document || !global?.firebase?.database) return api;
  if (global.LuminousSpecialLanguageEnforcement) return global.LuminousSpecialLanguageEnforcement;
  global.LuminousSpecialLanguageEnforcement = api;

  const doc = global.document;
  const db = global.firebase.database();
  const sources = {};
  let definitions = {};
  let players = {};
  let currentScene = {};
  let currentDialogue = {};
  let sceneRef = null;
  let dialogueRef = null;
  let sceneListener = null;
  let dialogueListener = null;
  let boundScenePath = null;
  let boundDialoguePath = null;
  let textObserver = null;
  let observedTextElement = null;
  let enforcingText = false;
  let manualLanguageOverrideSpeaker = null;
  let lastAutoSpeaker = null;
  let rebindingTimer = null;

  function isDmView() {
    return Boolean(doc.body?.classList.contains("on-game-dashboard"));
  }

  function theatrePaths() {
    return global.LuminousTheatreState?.getPaths?.() || {
      scene: "campaña/estado_mundo/escena_actual",
      dialogue: "campaña/estado_mundo/dialogo_activo",
    };
  }

  function playerMatchesAuth(playerId, player, user) {
    if (!player || !user) return false;
    return playerId === user.uid
      || player.uid === user.uid
      || player.userId === user.uid
      || player.authUid === user.uid
      || Boolean(user.email && (player.email === user.email || player.correo === user.email));
  }

  function authUser() {
    try { return global.firebase.auth?.().currentUser || null; } catch (_) { return null; }
  }

  function assignedActor() {
    try { return global.getAssignedTheatreActor?.() || null; } catch (_) { return null; }
  }

  function viewerProfiles() {
    const result = [];
    const seen = new Set();
    const push = (profile) => {
      if (!profile || typeof profile !== "object" || seen.has(profile)) return;
      seen.add(profile);
      result.push(profile);
    };

    const user = authUser();
    let matchedPlayer = null;
    for (const [playerId, player] of Object.entries(players)) {
      if (playerMatchesAuth(playerId, player, user)) {
        matchedPlayer = player;
        break;
      }
    }

    const actor = assignedActor();
    const actorIds = [actor?.actorId, actor?.id, actor?.identityId, actor?.identidadId].filter(Boolean).map(String);
    if (!matchedPlayer && actor?.sourceId && players[actor.sourceId]) matchedPlayer = players[actor.sourceId];
    if (!matchedPlayer && actorIds.length) {
      for (const player of Object.values(players)) {
        const assigned = normalizeIdList(player?.actorIds || player?.actores || player?.actorId);
        if (actorIds.some((id) => assigned.includes(id))) {
          matchedPlayer = player;
          break;
        }
      }
    }

    // El registro vivo del jugador es la autoridad primaria para ENTIENDE.
    push(matchedPlayer);
    push(actor);
    push(global.datosJugador);
    push(global.currentCharacterData);
    push(global.currentPlayerData);
    push(global.playerData);
    return result;
  }

  function currentLanguageState() {
    const languageId = clean(currentDialogue?.idiomaId || currentDialogue?.languageId || currentDialogue?.idioma);
    if (!languageId) {
      return { languageId: null, definition: null, special: false, blocked: false, filtered: false, percentage: 100, text: "" };
    }

    const definition = definitions[languageId] || {};
    const profiles = viewerProfiles();
    const special = isSpecialLanguage(languageId, definition);
    const percentage = special
      ? (resolveSpecialUnderstanding(profiles, languageId) ? 100 : 0)
      : resolveLanguageKnowledgePercentage(profiles, languageId, definition);
    const text = resolveLanguageText(currentDialogue, definitions, profiles);
    return {
      languageId,
      definition,
      special,
      blocked: special ? percentage < 100 : percentage <= 0,
      filtered: percentage < 100,
      percentage,
      text,
    };
  }

  function ensureTextObserver() {
    const textEl = doc.getElementById("dialogue-text");
    if (!textEl) return null;
    if (observedTextElement === textEl && textObserver) return textEl;
    textObserver?.disconnect();
    observedTextElement = textEl;
    textObserver = new MutationObserver(() => {
      if (!enforcingText) enforcePlayerLanguagePrivacy();
    });
    textObserver.observe(textEl, { childList: true, characterData: true, subtree: true });
    return textEl;
  }

  function enforcePlayerLanguagePrivacy() {
    if (isDmView()) return;
    const textEl = ensureTextObserver();
    if (!textEl) return;

    const state = currentLanguageState();
    textEl.dataset.languageId = state.languageId || "";
    textEl.dataset.languageKnowledgePercent = String(state.percentage);
    textEl.dataset.languageObfuscated = state.filtered ? "true" : "false";
    textEl.dataset.specialLanguage = state.special ? (state.languageId || "special") : "";
    textEl.dataset.specialLanguageBlocked = state.special && state.blocked ? "true" : "false";

    // 100% comprehension keeps the existing typewriter untouched.
    if (!state.languageId || !state.filtered) return;
    if (textEl.textContent === state.text) return;

    enforcingText = true;
    try {
      // The typewriter may keep writing raw text. MutationObserver runs before the
      // next paint and reapplies the viewer-specific comprehension filter.
      textEl.textContent = state.text;
      textEl.setAttribute("aria-label", state.text);
    } finally {
      enforcingText = false;
    }
  }

  function speakerKnowledge() {
    const select = doc.getElementById("theatre-speaker-select");
    const speakerId = select?.value;
    if (!speakerId || speakerId === "narrador") return { speakerId: speakerId || "narrador", knowledge: {}, all: true };
    const live = currentScene?.actores?.[speakerId] || {};
    const masterId = live.identityId || live.identidadId || live.sourceActorId || live.sourceId || speakerId;
    const manager = global.LuminousCharacterManager;
    const record = manager?.getActor?.(masterId);
    const knowledge = record?.actor?.idiomas || record?.actor?.languages || live.idiomas || live.languages || {};
    return { speakerId, knowledge, all: false };
  }

  function ensureDmLanguageBadge() {
    if (!isDmView()) return null;
    const select = doc.getElementById("theatre-language-select");
    if (!select) return null;
    let badge = doc.getElementById("theatre-special-language-output");
    if (!badge) {
      badge = doc.createElement("span");
      badge.id = "theatre-special-language-output";
      badge.style.cssText = "display:inline-flex;align-items:center;min-height:28px;padding:0 8px;border:1px solid #53606d;background:#0b0f14;color:#b9c6d2;font:10px 'Share Tech Mono',monospace;letter-spacing:.7px;white-space:nowrap;";
      select.insertAdjacentElement("afterend", badge);
    }
    return badge;
  }

  function updateDmBadge() {
    if (!isDmView()) return;
    const select = doc.getElementById("theatre-language-select");
    const badge = ensureDmLanguageBadge();
    if (!select || !badge) return;
    const languageId = select.value;
    const definition = languageId ? definitions[languageId] : null;
    const label = languageId ? clean(definition?.nombre || definition?.name) || languageId : "COMÚN";
    badge.textContent = `SALIDA · ${label.toUpperCase()}`;
    badge.dataset.special = languageId && isSpecialLanguage(languageId, definition) ? "true" : "false";
  }

  function autoSelectDmSpecialLanguage() {
    if (!isDmView()) return;
    const speakerSelect = doc.getElementById("theatre-speaker-select");
    const languageSelect = doc.getElementById("theatre-language-select");
    if (!speakerSelect || !languageSelect) return;

    const source = speakerKnowledge();
    const speakerId = source.speakerId;
    if (speakerId === "narrador" || source.all) {
      if (lastAutoSpeaker !== speakerId) languageSelect.value = "";
      lastAutoSpeaker = speakerId;
      manualLanguageOverrideSpeaker = null;
      updateDmBadge();
      return;
    }

    if (manualLanguageOverrideSpeaker === speakerId) {
      updateDmBadge();
      return;
    }

    const preferred = preferredSpecialLanguage(definitions, source.knowledge);
    if (preferred && Array.from(languageSelect.options).some((option) => option.value === preferred)) {
      languageSelect.value = preferred;
      languageSelect.dataset.autoSpecialLanguage = preferred;
      const definition = definitions[preferred] || {};
      languageSelect.title = `AUTO · ${clean(definition.nombre || definition.name) || preferred}`;
    } else if (lastAutoSpeaker !== speakerId) {
      languageSelect.value = "";
      delete languageSelect.dataset.autoSpecialLanguage;
      languageSelect.title = "Idioma del diálogo";
    }
    lastAutoSpeaker = speakerId;
    updateDmBadge();
  }

  function scheduleDmAutoselect() {
    if (!isDmView()) return;
    global.setTimeout(autoSelectDmSpecialLanguage, 0);
    global.setTimeout(autoSelectDmSpecialLanguage, 80);
  }

  function bindTheatreRefs() {
    const paths = theatrePaths();
    if (paths.scene && paths.scene !== boundScenePath) {
      if (sceneRef && sceneListener) sceneRef.off("value", sceneListener);
      boundScenePath = paths.scene;
      sceneRef = db.ref(paths.scene);
      sceneListener = (snapshot) => {
        currentScene = snapshot.val() || {};
        if (isDmView()) scheduleDmAutoselect();
      };
      sceneRef.on("value", sceneListener);
    }
    if (paths.dialogue && paths.dialogue !== boundDialoguePath) {
      if (dialogueRef && dialogueListener) dialogueRef.off("value", dialogueListener);
      boundDialoguePath = paths.dialogue;
      dialogueRef = db.ref(paths.dialogue);
      dialogueListener = (snapshot) => {
        currentDialogue = snapshot.val() || {};
        if (!isDmView()) {
          if (typeof global.queueMicrotask === "function") global.queueMicrotask(enforcePlayerLanguagePrivacy);
          else global.setTimeout(enforcePlayerLanguagePrivacy, 0);
        }
      };
      dialogueRef.on("value", dialogueListener);
    }
  }

  LANGUAGE_ROOTS.forEach((root) => {
    db.ref(root).on("value", (snapshot) => {
      sources[root] = snapshot.val() || {};
      definitions = Object.assign({}, ...LANGUAGE_ROOTS.map((key) => sources[key] || {}));
      if (isDmView()) scheduleDmAutoselect();
      else enforcePlayerLanguagePrivacy();
    });
  });

  db.ref("campaña/jugadores").on("value", (snapshot) => {
    players = snapshot.val() || {};
    if (!isDmView()) enforcePlayerLanguagePrivacy();
  });

  doc.addEventListener("change", (event) => {
    if (!isDmView()) return;
    if (event.target?.id === "theatre-speaker-select") {
      manualLanguageOverrideSpeaker = null;
      lastAutoSpeaker = null;
      scheduleDmAutoselect();
    }
    if (event.target?.id === "theatre-language-select") {
      const speakerId = doc.getElementById("theatre-speaker-select")?.value || null;
      manualLanguageOverrideSpeaker = speakerId;
      delete event.target.dataset.autoSpecialLanguage;
      event.target.title = "Idioma seleccionado manualmente";
      updateDmBadge();
    }
  });

  function boot() {
    bindTheatreRefs();
    if (isDmView()) {
      ensureDmLanguageBadge();
      scheduleDmAutoselect();
    } else {
      ensureTextObserver();
      enforcePlayerLanguagePrivacy();
    }
    const resync = () => {
      bindTheatreRefs();
      if (isDmView()) updateDmBadge();
      else enforcePlayerLanguagePrivacy();
    };
    global.addEventListener?.("actoresCacheUpdated", resync);
    global.addEventListener?.("luminous:player-data", resync);
    global.addEventListener?.("luminous:player-instance-changed", resync);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  try {
    global.firebase.auth?.().onAuthStateChanged?.(() => { if (!isDmView()) enforcePlayerLanguagePrivacy(); });
  } catch (_) {}

  return api;
});
