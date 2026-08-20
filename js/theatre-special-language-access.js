(function (root, factory) {
  const helpers = factory(root || globalThis);
  if (typeof module !== "undefined" && module.exports) module.exports = helpers;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const SPECIAL_ROOT = "campaña/teatro/idiomas";
  const ACTOR_ROOTS = ["campaña/base_datos_npcs", "campaña/actores"];

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function slug(value) {
    return String(value || "special")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "special";
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

  function specialKind(definition) {
    const explicit = String(definition?.subtipo || definition?.specialKind || definition?.kind || "").toLowerCase();
    const type = String(definition?.tipo || definition?.type || "").toLowerCase();
    if (explicit.includes("sing" ) || type.includes("sing")) return "singularity";
    if (explicit.includes("dist") || type.includes("dist")) return "distortion";
    return "special";
  }

  function defaultUnknownText(kind) {
    if (kind === "distortion") return "[No comprendes esta Distortion.]";
    if (kind === "singularity") return "[No puedes interpretar esta Singularidad.]";
    return "[No comprendes este lenguaje especial.]";
  }

  function buildSpecialDefinition(options = {}) {
    const name = clean(options.name || options.nombre) || "Idioma especial";
    const kind = ["distortion", "singularity", "special"].includes(options.kind) ? options.kind : "special";
    const unknownText = clean(options.unknownText || options.texto_desconocido) || defaultUnknownText(kind);
    return {
      nombre: name,
      sistema: "special",
      tipo: kind === "distortion" ? "distortion" : "special",
      especial: true,
      binario: true,
      subtipo: kind,
      // Compatibilidad con el renderer actual: este flag activa el gate binario
      // de comprensión sin convertir la etiqueta visible en "Distortion".
      distortion: true,
      texto_desconocido: unknownText,
      estilo_ofuscacion: "ellipsis"
    };
  }

  function normalizeSpecialAccess(value = {}) {
    const percentage = Number(value?.porcentaje ?? value?.percent ?? value?.knowledge ?? 0) || 0;
    const speaks = Boolean(value?.habla ?? value?.speaks ?? value?.canSpeak ?? percentage > 0);
    const understands = Boolean(
      value?.entiende
      ?? value?.understands
      ?? value?.comprendido
      ?? value?.understood
      ?? value?.distortionUnderstood
      ?? false
    );
    return {
      habla: speaks,
      entiende: understands,
      porcentaje: speaks ? 100 : 0,
      comprendido: understands
    };
  }

  function iconFromRecord(record) {
    return clean(record?.icono)
      || clean(record?.icono_jugador)
      || clean(record?.icon_url)
      || clean(record?.avatar)
      || "";
  }

  function resolveLogIcon(message, sceneActors = {}, actorCatalogs = []) {
    const direct = iconFromRecord(message);
    if (direct) return direct;

    const catalog = Object.assign({}, ...(actorCatalogs || []).filter((entry) => entry && typeof entry === "object"));
    const actorId = clean(message?.actorId);
    const liveActor = actorId ? sceneActors?.[actorId] : null;
    const liveIcon = iconFromRecord(liveActor);
    if (liveIcon) return liveIcon;

    const stableIds = [
      actorId,
      clean(message?.identityId),
      clean(message?.identidadId),
      clean(message?.sourceId),
      clean(message?.sourceActorId),
      clean(liveActor?.identityId),
      clean(liveActor?.identidadId),
      clean(liveActor?.sourceId),
      clean(liveActor?.sourceActorId)
    ].filter(Boolean);

    for (const id of stableIds) {
      const icon = iconFromRecord(catalog[id]);
      if (icon) return icon;
    }

    const targetName = clean(message?.nombre || liveActor?.nombre).toLowerCase();
    if (targetName) {
      const byName = Object.values(catalog).find((actor) => clean(actor?.nombre).toLowerCase() === targetName);
      const icon = iconFromRecord(byName);
      if (icon) return icon;
    }
    return "";
  }

  const api = Object.freeze({
    SPECIAL_ROOT,
    slug,
    isSpecialDefinition,
    specialKind,
    buildSpecialDefinition,
    normalizeSpecialAccess,
    resolveLogIcon
  });

  if (!global?.document || !global?.firebase?.database) return api;
  if (global.LuminousSpecialLanguageAccess) return global.LuminousSpecialLanguageAccess;
  global.LuminousSpecialLanguageAccess = api;

  const doc = global.document;
  const db = global.firebase.database();
  const isDm = () => Boolean(doc.body?.classList.contains("on-game-dashboard") || doc.getElementById("dashboard-actores"));
  let ownedSpecials = {};
  let adminFeedbackTimer = null;
  let decorateTimer = null;
  let logRepairTimer = null;
  let logInstalled = false;
  const actorCatalogs = {};
  let liveSceneActors = {};

  function definitionsMap() {
    const catalog = global.LuminousLanguageCatalog;
    if (catalog?.list) {
      return Object.fromEntries(catalog.list().map(({ languageId, definition }) => [languageId, definition || {}]));
    }
    const manager = global.LuminousCharacterManager;
    if (manager?.listLanguages) {
      return Object.fromEntries(manager.listLanguages().map(({ languageId, language }) => [languageId, language || {}]));
    }
    return {};
  }

  function ensureStyles() {
    if (doc.getElementById("luminous-special-language-style")) return;
    const style = doc.createElement("style");
    style.id = "luminous-special-language-style";
    style.textContent = `
      .cm-special-language-admin{margin:0 0 12px;padding:10px;border:1px solid #40382d;background:#0b0b0a;display:grid;gap:8px}
      .cm-special-language-admin__head{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#d7b977;font-size:10px;letter-spacing:1.4px}
      .cm-special-language-admin__grid{display:grid;grid-template-columns:minmax(130px,1.2fr) 130px minmax(180px,1.6fr) auto;gap:7px}
      .cm-special-language-admin input,.cm-special-language-admin select{min-width:0;height:34px;border:1px solid #39342d;background:#0d0d0c;color:#ddd5c7;padding:0 8px}
      .cm-special-language-admin button{height:34px;border:1px solid #655335;background:#1a1711;color:#d7b977;padding:0 11px;cursor:pointer}
      .cm-special-language-admin button:hover{border-color:#b9975b}
      .cm-special-language-list{display:flex;gap:6px;flex-wrap:wrap}
      .cm-special-language-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid #302c26;background:#11100e;padding:4px 6px;color:#a59b8c;font-size:9px}
      .cm-special-language-chip b{color:#d7b977;font-weight:500}.cm-special-language-chip code{color:#71695e}
      .cm-special-language-chip button{width:22px;height:22px;padding:0;border-color:#513232;color:#b66b6b;background:#150e0e}
      .cm-language-row--special{grid-template-columns:minmax(150px,1fr) minmax(220px,1.2fr)!important;align-items:center}
      .cm-language-row--special .cm-language-meter,.cm-language-row--special .cm-distortion-toggle{display:none!important}
      .cm-special-access{display:grid;grid-template-columns:1fr 1fr;gap:6px}
      .cm-special-access label{min-height:38px;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 10px;border:1px solid #39342d;background:#0d0d0c;color:#8f8779;font-size:9px;letter-spacing:1px;cursor:pointer}
      .cm-special-access label:has(input:checked){border-color:#6d5a3c;color:#d7b977;background:#17130e}
      .cm-special-access input{accent-color:#b9975b}
      .cm-special-kind{display:inline-flex;margin-left:7px;padding:1px 5px;border:1px solid #514838;color:#b9975b;font-size:8px;letter-spacing:.8px}
      @media(max-width:820px){.cm-special-language-admin__grid{grid-template-columns:1fr 1fr}.cm-special-language-admin__grid input:nth-of-type(2){grid-column:1/-1}.cm-language-row--special{grid-template-columns:1fr!important}.cm-special-access{grid-template-columns:1fr 1fr}}
    `;
    doc.head.appendChild(style);
  }

  function adminFeedback(text, error) {
    const node = doc.getElementById("cm-special-language-feedback");
    if (!node) return;
    node.textContent = text || "";
    node.style.color = error ? "#d05a5d" : "#86a88d";
    global.clearTimeout(adminFeedbackTimer);
    adminFeedbackTimer = global.setTimeout(() => { node.textContent = ""; }, 2600);
  }

  function uniqueLanguageId(name, kind) {
    const definitions = definitionsMap();
    const prefix = kind === "distortion" ? "distortion" : kind === "singularity" ? "singularity" : "special";
    const base = `${prefix}_${slug(name)}`;
    if (!definitions[base]) return base;
    let index = 2;
    while (definitions[`${base}_${index}`]) index += 1;
    return `${base}_${index}`;
  }

  async function createSpecialFromAdmin() {
    const name = clean(doc.getElementById("cm-special-language-name")?.value);
    const kind = doc.getElementById("cm-special-language-kind")?.value || "special";
    const unknownText = clean(doc.getElementById("cm-special-language-unknown")?.value);
    if (!name) return adminFeedback("NOMBRE REQUERIDO", true);
    const existing = Object.entries(definitionsMap()).find(([, definition]) =>
      isSpecialDefinition(definition) && clean(definition?.nombre || definition?.name).toLowerCase() === name.toLowerCase()
    );
    if (existing) return adminFeedback(`YA EXISTE / ${existing[0]}`, true);
    const id = uniqueLanguageId(name, kind);
    await db.ref(`${SPECIAL_ROOT}/${id}`).set(buildSpecialDefinition({ name, kind, unknownText }));
    const nameInput = doc.getElementById("cm-special-language-name");
    const unknownInput = doc.getElementById("cm-special-language-unknown");
    if (nameInput) nameInput.value = "";
    if (unknownInput) unknownInput.value = "";
    adminFeedback(`CREADO / ${id}`, false);
  }

  async function deleteSpecial(languageId) {
    if (!ownedSpecials[languageId] || !isSpecialDefinition(ownedSpecials[languageId])) return;
    if (global.confirm && !global.confirm(`Eliminar el idioma especial ${languageId}?`)) return;
    await db.ref(`${SPECIAL_ROOT}/${languageId}`).remove();
    adminFeedback(`ELIMINADO / ${languageId}`, false);
  }

  function renderSpecialChips() {
    const host = doc.getElementById("cm-special-language-list");
    if (!host) return;
    host.innerHTML = "";
    const specials = Object.entries(definitionsMap())
      .filter(([, definition]) => isSpecialDefinition(definition))
      .sort((a, b) => clean(a[1]?.nombre).localeCompare(clean(b[1]?.nombre)));
    if (!specials.length) {
      const empty = doc.createElement("span");
      empty.className = "cm-special-language-chip";
      empty.textContent = "SIN IDIOMAS ESPECIALES";
      host.appendChild(empty);
      return;
    }
    specials.forEach(([languageId, definition]) => {
      const chip = doc.createElement("span");
      chip.className = "cm-special-language-chip";
      const kind = specialKind(definition).toUpperCase();
      chip.innerHTML = `<b>${clean(definition?.nombre || definition?.name) || languageId}</b><code>${kind}</code>`;
      if (ownedSpecials[languageId]) {
        const button = doc.createElement("button");
        button.type = "button";
        button.textContent = "×";
        button.title = `Eliminar ${languageId}`;
        button.addEventListener("click", () => deleteSpecial(languageId).catch((error) => adminFeedback(error.message || String(error), true)));
        chip.appendChild(button);
      }
      host.appendChild(chip);
    });
  }

  function ensureAdmin() {
    if (!isDm()) return false;
    const module = doc.querySelector('#character-manager-studio .cm-module[data-module="languages"]');
    if (!module) return false;
    if (!doc.getElementById("cm-special-language-admin")) {
      const panel = doc.createElement("section");
      panel.id = "cm-special-language-admin";
      panel.className = "cm-special-language-admin";
      panel.innerHTML = `
        <div class="cm-special-language-admin__head"><span>IDIOMAS ESPECIALES / BAJO DEMANDA</span><small id="cm-special-language-feedback"></small></div>
        <div class="cm-special-language-admin__grid">
          <input id="cm-special-language-name" type="text" placeholder="NOMBRE · ej. Reloj de Dante" aria-label="Nombre del idioma especial">
          <select id="cm-special-language-kind" aria-label="Tipo de idioma especial"><option value="special">ESPECIAL</option><option value="distortion">DISTORTION</option><option value="singularity">SINGULARIDAD</option></select>
          <input id="cm-special-language-unknown" type="text" placeholder="TEXTO PARA QUIEN NO ENTIENDE" aria-label="Texto desconocido">
          <button id="cm-special-language-add" type="button">AGREGAR</button>
        </div>
        <div id="cm-special-language-list" class="cm-special-language-list"></div>
      `;
      const target = doc.getElementById("character-manager-language-target");
      module.insertBefore(panel, target || module.children[1] || null);
      panel.querySelector("#cm-special-language-add")?.addEventListener("click", () => createSpecialFromAdmin().catch((error) => adminFeedback(error.message || String(error), true)));
    }
    renderSpecialChips();
    return true;
  }

  function decorateSpecialRows() {
    const definitions = definitionsMap();
    doc.querySelectorAll("#character-manager-languages .cm-language-row").forEach((row) => {
      const languageId = row.dataset.languageId;
      const definition = definitions[languageId] || {};
      if (!isSpecialDefinition(definition)) return;
      row.classList.add("cm-language-row--special");
      row.title = "HABLA controla si puede usar este idioma. ENTIENDE controla si puede descifrar lo que otros dicen.";
      const nameHost = row.querySelector(".cm-language-name");
      if (nameHost && !nameHost.querySelector(".cm-special-kind")) {
        const badge = doc.createElement("span");
        badge.className = "cm-special-kind";
        badge.textContent = specialKind(definition).toUpperCase();
        nameHost.appendChild(badge);
      }
      const percent = row.querySelector(".cm-language-percent");
      const range = row.querySelector(".cm-language-range");
      const legacyUnderstand = row.querySelector(".cm-distortion-toggle input");
      if (!percent || !range || !legacyUnderstand) return;
      let access = row.querySelector(".cm-special-access");
      if (!access) {
        access = doc.createElement("div");
        access.className = "cm-special-access";
        access.innerHTML = `
          <label><span>HABLA</span><input class="cm-special-speak" type="checkbox" aria-label="Puede hablar este idioma"></label>
          <label><span>ENTIENDE</span><input class="cm-special-understand" type="checkbox" aria-label="Puede entender este idioma"></label>
        `;
        row.appendChild(access);
        const speak = access.querySelector(".cm-special-speak");
        const understand = access.querySelector(".cm-special-understand");
        speak.checked = Number(percent.value) > 0;
        understand.checked = legacyUnderstand.checked;
        const sync = () => {
          const normalized = normalizeSpecialAccess({ habla: speak.checked, entiende: understand.checked });
          percent.value = String(normalized.porcentaje);
          range.value = String(normalized.porcentaje);
          legacyUnderstand.checked = normalized.comprendido;
        };
        speak.addEventListener("change", sync);
        understand.addEventListener("change", sync);
        sync();
      }
    });
  }

  function scheduleDecorate() {
    global.clearTimeout(decorateTimer);
    decorateTimer = global.setTimeout(() => {
      ensureStyles();
      ensureAdmin();
      decorateSpecialRows();
    }, 20);
  }

  function installCharacterManagerUi() {
    if (!isDm()) return;
    ensureStyles();
    const install = () => {
      const host = doc.getElementById("character-manager-languages");
      if (!host) return false;
      scheduleDecorate();
      if (!host.__luminousSpecialObserver) {
        const observer = new MutationObserver(scheduleDecorate);
        observer.observe(host, { childList: true });
        host.__luminousSpecialObserver = observer;
      }
      return true;
    };
    if (install()) return;
    const timer = global.setInterval(() => {
      if (install()) global.clearInterval(timer);
    }, 120);
  }

  function scheduleLogRepair(logRef) {
    if (!isDm() || !logRef) return;
    global.clearTimeout(logRepairTimer);
    logRepairTimer = global.setTimeout(async () => {
      try {
        const snapshot = await logRef.once("value");
        const catalogs = ACTOR_ROOTS.map((root) => actorCatalogs[root] || {});
        const tasks = [];
        snapshot.forEach((child) => {
          const message = child.val() || {};
          if (iconFromRecord(message)) return;
          const icon = resolveLogIcon(message, liveSceneActors, catalogs);
          if (icon) tasks.push(child.ref.update({ icono: icon }));
        });
        if (tasks.length) await Promise.all(tasks);
      } catch (error) {
        console.warn("No se pudieron reparar iconos del Theatre Log:", error);
      }
    }, 80);
  }

  function installLogIconRepair() {
    if (!isDm() || logInstalled) return;
    const theatre = global.LuminousTheatreState;
    if (!theatre?.getPaths) return;
    logInstalled = true;
    const paths = theatre.getPaths();
    const logRef = db.ref(paths.log || "campaña/teatro/log");
    const sceneRef = db.ref(paths.scene || "campaña/estado_mundo/escena_actual");
    ACTOR_ROOTS.forEach((root) => {
      db.ref(root).on("value", (snapshot) => {
        actorCatalogs[root] = snapshot.val() || {};
        scheduleLogRepair(logRef);
      });
    });
    sceneRef.on("value", (snapshot) => {
      liveSceneActors = snapshot.val()?.actores || {};
      scheduleLogRepair(logRef);
    });
    logRef.on("value", () => scheduleLogRepair(logRef));
  }

  db.ref(SPECIAL_ROOT).on("value", (snapshot) => {
    ownedSpecials = snapshot.val() || {};
    scheduleDecorate();
  });

  global.LuminousLanguageCatalog?.subscribe?.(scheduleDecorate);

  function boot() {
    installCharacterManagerUi();
    installLogIconRepair();
    if (!logInstalled && isDm()) global.setTimeout(boot, 120);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  return api;
});
