(function (global) {
  "use strict";

  if (global.LuminousGameLoading) return;

  const STYLE_ID = "luminous-game-loading-style";
  const OVERLAY_ID = "luminous-game-loading-overlay";
  const RESULT_RECAP_ID = "luminous-combat-result-recap";
  const RESULT_IMAGES = Object.freeze({
    victory: "Assets/Images/Combat/Victory_Battle_Result.png",
    defeat: "Assets/Images/Combat/Defeat_Battle_Result.png",
  });

  const state = {
    mode: "",
    title: "",
    detail: "",
    checks: new Map(),
    active: false,
    generation: 0,
  };

  function clean(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeResult(value) {
    const normalized = clean(value).toLowerCase();
    if (["victory", "win", "won"].includes(normalized)) return "victory";
    if (["defeat", "lose", "loss", "lost"].includes(normalized)) return "defeat";
    if (["cancelled", "canceled", "cancel", "aborted", "abort"].includes(normalized)) return "cancelled";
    return "";
  }

  function ensureStyle(doc) {
    if (!doc?.head || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
#${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483600;display:none;align-items:flex-end;justify-content:flex-start;padding:clamp(28px,6vw,84px);box-sizing:border-box;background:radial-gradient(circle at 68% 28%,rgba(88,58,25,.16),transparent 34%),linear-gradient(120deg,#050504 0%,#0b0907 58%,#030303 100%);color:#eee8dc;opacity:0;transition:opacity .24s ease}
#${OVERLAY_ID}.active{display:flex;opacity:1}
#${OVERLAY_ID}.error{background:radial-gradient(circle at 70% 22%,rgba(126,27,22,.18),transparent 34%),linear-gradient(120deg,#050404 0%,#0b0707 58%,#030303 100%)}
#${OVERLAY_ID}::after{content:"";position:absolute;inset:0;pointer-events:none;opacity:.12;background:repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0,rgba(255,255,255,.07) 1px,transparent 1px,transparent 4px)}
#${OVERLAY_ID} .lgl-shell{position:relative;z-index:2;width:min(720px,92vw);padding:22px 24px 20px;background:linear-gradient(100deg,rgba(5,5,5,.96),rgba(10,9,7,.86));border-left:3px solid #d99a42;border-top:1px solid rgba(217,154,66,.35);box-shadow:0 18px 60px rgba(0,0,0,.58)}
#${OVERLAY_ID}.error .lgl-shell{border-left-color:#d4544c}
#${OVERLAY_ID} .lgl-kicker{font:700 11px/1.2 "Share Tech Mono",monospace;letter-spacing:.19em;color:#a68b63;text-transform:uppercase;margin-bottom:8px}
#${OVERLAY_ID} .lgl-title{font:700 clamp(28px,4vw,48px)/.95 "BebasKai","Arial Narrow",sans-serif;letter-spacing:.055em;color:#f0d3a1;text-transform:uppercase;text-shadow:0 2px 10px #000}
#${OVERLAY_ID}.error .lgl-title{color:#ef8078}
#${OVERLAY_ID} .lgl-detail{margin-top:8px;color:#c9c2b7;font:400 14px/1.45 Roboto,Arial,sans-serif;min-height:20px}
#${OVERLAY_ID} .lgl-progress{height:9px;margin:18px 0 16px;background:#26221c;border:1px solid #3d3326;overflow:hidden}
#${OVERLAY_ID} .lgl-progress>span{display:block;height:100%;width:0;background:linear-gradient(90deg,#ba762c,#efb258);box-shadow:0 0 14px rgba(239,178,88,.34);transition:width .18s ease}
#${OVERLAY_ID}.error .lgl-progress>span{background:linear-gradient(90deg,#8c2824,#db5a52)}
#${OVERLAY_ID} .lgl-checks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 16px}
#${OVERLAY_ID} .lgl-check{display:grid;grid-template-columns:13px minmax(0,1fr);gap:8px;align-items:start;color:#8c867c;font:700 11px/1.3 "Share Tech Mono",monospace;letter-spacing:.045em;text-transform:uppercase}
#${OVERLAY_ID} .lgl-check-dot{width:8px;height:8px;margin-top:2px;border:1px solid #5e584e;background:#1b1916;transform:rotate(45deg)}
#${OVERLAY_ID} .lgl-check.ready{color:#d9cfbe}
#${OVERLAY_ID} .lgl-check.ready .lgl-check-dot{border-color:#d99a42;background:#d99a42;box-shadow:0 0 7px rgba(217,154,66,.55)}
#${OVERLAY_ID} .lgl-check.warning{color:#dfc07c}
#${OVERLAY_ID} .lgl-check.warning .lgl-check-dot{border-color:#dfc07c;background:#6d5622}
#${OVERLAY_ID} .lgl-check.error{color:#ef8078}
#${OVERLAY_ID} .lgl-check.error .lgl-check-dot{border-color:#ef8078;background:#8d2824;box-shadow:0 0 7px rgba(239,128,120,.42)}
#${OVERLAY_ID} .lgl-check small{display:block;margin-top:2px;color:#777168;font:400 10px/1.3 Roboto,Arial,sans-serif;text-transform:none;letter-spacing:0}
#${OVERLAY_ID} .lgl-retry{display:none;margin-top:15px;padding:8px 18px;border:1px solid #d4544c;background:#170a09;color:#f0a39e;font:700 12px "Share Tech Mono",monospace;letter-spacing:.08em;cursor:pointer}
#${OVERLAY_ID}.error .lgl-retry{display:inline-block}
#${RESULT_RECAP_ID}{position:fixed;right:18px;bottom:18px;z-index:2147482000;width:min(390px,calc(100vw - 36px));background:rgba(7,6,5,.96);border:1px solid #6f5a38;border-left:3px solid #d99a42;box-shadow:0 18px 46px rgba(0,0,0,.62);color:#e9e1d3;padding:12px}
#${RESULT_RECAP_ID}[data-result="defeat"]{border-left-color:#a23e39}
#${RESULT_RECAP_ID}[data-result="cancelled"]{border-left-color:#777}
#${RESULT_RECAP_ID} .lgl-result-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px;font:700 11px "Share Tech Mono",monospace;letter-spacing:.12em;color:#b79b6d;text-transform:uppercase}
#${RESULT_RECAP_ID} .lgl-result-close{border:0;background:transparent;color:#aaa;font-size:20px;line-height:1;cursor:pointer}
#${RESULT_RECAP_ID} img{display:block;width:100%;max-height:150px;object-fit:contain;background:#000}
#${RESULT_RECAP_ID} .lgl-result-text{padding:10px 4px 4px;font:700 24px "BebasKai","Arial Narrow",sans-serif;letter-spacing:.08em;text-align:center;text-transform:uppercase;color:#e7cfaa}
@media(max-width:680px){#${OVERLAY_ID}{padding:22px}#${OVERLAY_ID} .lgl-checks{grid-template-columns:1fr}}
`;
    doc.head.appendChild(style);
  }

  function ensureOverlay(doc) {
    const documentRef = doc || global.document;
    if (!documentRef?.body) return null;
    ensureStyle(documentRef);
    let overlay = documentRef.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = documentRef.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("aria-live", "polite");
    overlay.setAttribute("aria-busy", "true");
    overlay.innerHTML = `
      <div class="lgl-shell">
        <div class="lgl-kicker">LUMINOUS // SYSTEM CHECK</div>
        <div class="lgl-title">PREPARANDO SISTEMA</div>
        <div class="lgl-detail">Comprobando los recursos necesarios.</div>
        <div class="lgl-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
        <div class="lgl-checks"></div>
        <button class="lgl-retry" type="button">REINTENTAR</button>
      </div>`;
    overlay.querySelector(".lgl-retry")?.addEventListener("click", () => global.location?.reload?.());
    documentRef.body.appendChild(overlay);
    return overlay;
  }

  function render(doc) {
    const documentRef = doc || global.document;
    const overlay = ensureOverlay(documentRef);
    if (!overlay) return;
    const title = overlay.querySelector(".lgl-title");
    const detail = overlay.querySelector(".lgl-detail");
    const checksHost = overlay.querySelector(".lgl-checks");
    const progress = overlay.querySelector(".lgl-progress");
    const progressFill = progress?.querySelector("span");
    if (title) title.textContent = state.title || "PREPARANDO SISTEMA";
    if (detail) detail.textContent = state.detail || "Comprobando los recursos necesarios.";

    const rows = Array.from(state.checks.values());
    const completed = rows.filter((row) => row.status === "ready" || row.status === "warning").length;
    const percent = rows.length ? Math.round((completed / rows.length) * 100) : 0;
    if (progress) progress.setAttribute("aria-valuenow", String(percent));
    if (progressFill) progressFill.style.width = percent + "%";

    if (checksHost) {
      checksHost.innerHTML = "";
      rows.forEach((row) => {
        const node = documentRef.createElement("div");
        node.className = "lgl-check " + (row.status || "pending");
        node.dataset.check = row.id;
        node.innerHTML = '<span class="lgl-check-dot" aria-hidden="true"></span><span></span>';
        const text = node.lastElementChild;
        if (text) {
          text.textContent = row.label;
          if (row.detail) {
            const small = documentRef.createElement("small");
            small.textContent = row.detail;
            text.appendChild(small);
          }
        }
        checksHost.appendChild(node);
      });
    }

    const hasError = rows.some((row) => row.status === "error");
    overlay.classList.toggle("error", hasError);
    overlay.setAttribute("aria-busy", hasError ? "false" : "true");
  }

  function begin(options = {}) {
    const overlay = ensureOverlay(options.doc || global.document);
    if (!overlay) return 0;
    state.generation += 1;
    state.mode = clean(options.mode || "system");
    state.title = clean(options.title || "PREPARANDO SISTEMA");
    state.detail = clean(options.detail || "Comprobando los recursos necesarios.");
    state.checks.clear();
    (options.checks || []).forEach((check) => {
      const id = clean(check?.id || check);
      if (!id) return;
      state.checks.set(id, {
        id,
        label: clean(check?.label || id),
        status: clean(check?.status || "pending") || "pending",
        detail: clean(check?.detail || ""),
      });
    });
    state.active = true;
    overlay.style.opacity = "";
    overlay.classList.remove("error");
    overlay.classList.add("active");
    overlay.setAttribute("aria-busy", "true");
    render(options.doc);
    return state.generation;
  }

  function setTitle(title, detail, doc) {
    if (title) state.title = clean(title);
    if (detail !== undefined) state.detail = clean(detail);
    render(doc);
  }

  function setCheck(id, status, detail, doc) {
    const key = clean(id);
    if (!key) return false;
    const current = state.checks.get(key) || { id: key, label: key, status: "pending", detail: "" };
    current.status = clean(status || current.status || "pending") || "pending";
    if (detail !== undefined) current.detail = clean(detail);
    state.checks.set(key, current);
    render(doc);
    return true;
  }

  function fail(id, detail, doc) {
    setCheck(id, "error", detail, doc);
    setTitle("NO SE PUDO PREPARAR EL SISTEMA", detail || "Una comprobación necesaria falló.", doc);
    return false;
  }

  function complete(options = {}) {
    const documentRef = options.doc || global.document;
    const overlay = documentRef?.getElementById?.(OVERLAY_ID);
    if (!overlay) return false;
    const hasError = Array.from(state.checks.values()).some((row) => row.status === "error");
    if (hasError) return false;
    state.title = clean(options.title || state.title || "SISTEMA LISTO");
    state.detail = clean(options.detail || "");
    Array.from(state.checks.values()).forEach((row) => {
      if (row.status === "pending") row.status = "ready";
    });
    render(documentRef);
    overlay.setAttribute("aria-busy", "false");
    requestAnimationFrame(() => {
      overlay.style.opacity = "0";
      global.setTimeout(() => {
        overlay.classList.remove("active");
        overlay.style.opacity = "";
        state.active = false;
      }, 240);
    });
    return true;
  }

  function waitForConnection(db, options = {}) {
    const timeoutMs = Math.max(1000, Number(options.timeoutMs) || 10000);
    return new Promise((resolve, reject) => {
      if (!db?.ref) return reject(new Error("DATABASE_UNAVAILABLE"));
      const ref = db.ref(".info/connected");
      let done = false;
      const timer = global.setTimeout(() => {
        if (done) return;
        done = true;
        try { ref.off("value", onValue); } catch (_) {}
        reject(new Error("FIREBASE_CONNECTION_TIMEOUT"));
      }, timeoutMs);
      const finish = (fn, value) => {
        if (done) return;
        done = true;
        global.clearTimeout(timer);
        try { ref.off("value", onValue); } catch (_) {}
        fn(value);
      };
      const onValue = (snapshot) => {
        if (snapshot?.val?.() === true) finish(resolve, true);
      };
      ref.on("value", onValue, (error) => finish(reject, error));
    });
  }

  async function probeRead(db, path) {
    if (!db?.ref) throw new Error("DATABASE_UNAVAILABLE");
    await db.ref(path).once("value");
    return true;
  }

  async function probeDmWrite(db, user, options = {}) {
    const uid = clean(user?.uid);
    if (!uid || !db?.ref) throw new Error("DM_WRITE_PROBE_UNAVAILABLE");
    const ref = db.ref("campaña/runtime_health/dm_boot/" + uid);
    await ref.set({
      at: global.firebase?.database?.ServerValue?.TIMESTAMP || Date.now(),
      surface: clean(options.surface || "runtime"),
    });
    await ref.remove();
    return true;
  }

  function waitForCombatFrame(frame, options = {}) {
    const documentRef = options.doc || global.document;
    const db = options.db || global.firebase?.database?.();
    const role = clean(options.role || "viewer");
    const timeoutMs = Math.max(4000, Number(options.timeoutMs) || 25000);
    const generation = begin({
      doc: documentRef,
      mode: "combat",
      title: "PREPARANDO BATTLE",
      detail: "Validando conexión, estado del encounter y runtime de combate.",
      checks: [
        { id: "connection", label: "Conexión Firebase" },
        { id: "combat-state", label: "Estado del encounter" },
        { id: "combat-runtime", label: "Runtime de Battle" },
        { id: "combatants", label: "Combatientes sincronizados" },
      ],
    });

    return new Promise((resolve, reject) => {
      let settled = false;
      let connectionReady = false;
      let combatStateReady = false;
      let combatantsReadable = false;
      let runtimeReady = false;
      let hydrated = false;
      const finishIfReady = () => {
        if (settled || generation !== state.generation) return;
        if (!connectionReady || !combatStateReady || !combatantsReadable || !runtimeReady || !hydrated) return;
        settled = true;
        cleanup();
        complete({ doc: documentRef, title: "BATTLE LISTO", detail: role === "dm" ? "Control táctico sincronizado." : "Encounter sincronizado." });
        resolve(true);
      };
      const failLoad = (id, error) => {
        if (settled || generation !== state.generation) return;
        settled = true;
        cleanup();
        const message = clean(error?.message || error || "No se pudo completar la carga.");
        fail(id, message, documentRef);
        reject(error instanceof Error ? error : new Error(message));
      };
      const onMessage = (event) => {
        if (event?.source !== frame?.contentWindow) return;
        const payload = event?.data || {};
        if (payload.type !== "luminous:combat-bootstrap") return;
        const stage = clean(payload.stage);
        if (stage === "error") {
          failLoad("combat-runtime", new Error(clean(payload.error || payload.detail || "COMBAT_BOOT_FAILED")));
          return;
        }
        if (stage === "runtime-ready") {
          runtimeReady = true;
          setCheck("combat-runtime", "ready", "Runtime activo", documentRef);
          finishIfReady();
          return;
        }
        if (stage === "hydrated") {
          hydrated = true;
          runtimeReady = true;
          setCheck("combat-runtime", "ready", "Runtime activo", documentRef);
          setCheck(
            "combatants",
            combatantsReadable ? "ready" : "pending",
            combatantsReadable
              ? clean(payload.detail || "Datos accesibles y runtime hidratado")
              : clean(payload.detail || "Runtime hidratado · verificando datos"),
            documentRef,
          );
          finishIfReady();
          return;
        }
        if (stage) setCheck("combat-runtime", "pending", clean(payload.detail || stage), documentRef);
      };
      const cleanup = () => {
        global.clearTimeout(timer);
        global.removeEventListener?.("message", onMessage);
      };
      const timer = global.setTimeout(() => failLoad("combat-runtime", new Error("COMBAT_BOOT_TIMEOUT")), timeoutMs);
      global.addEventListener?.("message", onMessage);

      waitForConnection(db, { timeoutMs: Math.min(timeoutMs, 12000) })
        .then(() => {
          connectionReady = true;
          setCheck("connection", "ready", "En línea", documentRef);
          finishIfReady();
        })
        .catch((error) => failLoad("connection", error));

      probeRead(db, "campaña/combate/estado")
        .then(() => {
          combatStateReady = true;
          setCheck("combat-state", "ready", "Estado accesible", documentRef);
          finishIfReady();
        })
        .catch((error) => failLoad("combat-state", error));

      probeRead(db, "campaña/combate/combatants")
        .then(() => {
          combatantsReadable = true;
          if (hydrated) setCheck("combatants", "ready", "Datos accesibles y runtime hidratado", documentRef);
          else setCheck("combatants", "pending", "Datos accesibles · esperando hidratación", documentRef);
          finishIfReady();
        })
        .catch((error) => failLoad("combatants", error));

      try {
        const childState = frame?.contentWindow?.LuminousCombatBootstrapState;
        if (childState?.stage === "error") failLoad("combat-runtime", new Error(childState.error || childState.detail || "COMBAT_BOOT_FAILED"));
        else if (childState?.stage === "hydrated") {
          hydrated = true;
          runtimeReady = true;
          setCheck("combat-runtime", "ready", "Runtime activo", documentRef);
          setCheck(
            "combatants",
            combatantsReadable ? "ready" : "pending",
            combatantsReadable
              ? clean(childState.detail || "Datos accesibles y runtime hidratado")
              : clean(childState.detail || "Runtime hidratado · verificando datos"),
            documentRef,
          );
          finishIfReady();
        } else if (childState?.stage === "runtime-ready") {
          runtimeReady = true;
          setCheck("combat-runtime", "ready", "Runtime activo", documentRef);
        }
      } catch (_) {}
    });
  }

  async function waitForTheatre(options = {}) {
    const documentRef = options.doc || global.document;
    const db = options.db || global.firebase?.database?.();
    const scenePath = clean(options.scenePath || "campaña/estado_mundo/escena_actual");
    const result = normalizeResult(options.result);
    const generation = begin({
      doc: documentRef,
      mode: "theatre",
      title: "REGRESANDO AL THEATER",
      detail: result ? "Cerrando el encounter y recuperando la escena." : "Recuperando la escena activa.",
      checks: [
        { id: "connection", label: "Conexión Firebase" },
        { id: "instance", label: "Instancia Theater" },
        { id: "scene", label: "Escena activa" },
        { id: "dialogue", label: "Estado de diálogo" },
      ],
    });
    try {
      await waitForConnection(db, { timeoutMs: Number(options.timeoutMs) || 12000 });
      if (generation !== state.generation) return false;
      setCheck("connection", "ready", "En línea", documentRef);
      const instanceSnapshot = await db.ref("campaña/estado_mundo/instancia_activa").once("value");
      const instanceValue = clean(instanceSnapshot.val()).toLowerCase();
      if (!["teatro", "combat_theatre", "combat-theatre", "combat_theater", "combat-theater"].includes(instanceValue)) {
        throw new Error("THEATRE_INSTANCE_NOT_ACTIVE");
      }
      setCheck("instance", "ready", "Theater activo", documentRef);
      await probeRead(db, scenePath);
      setCheck("scene", "ready", "Escena recuperada", documentRef);
      const dialoguePath = global.LuminousTheatreState?.getPaths?.().dialogue || "campaña/estado_mundo/dialogo_activo";
      await probeRead(db, dialoguePath);
      setCheck("dialogue", "ready", "Diálogo sincronizado", documentRef);
      complete({ doc: documentRef, title: "THEATER LISTO", detail: result ? "Resultado del encounter registrado." : "Escena sincronizada." });
      return true;
    } catch (error) {
      fail("scene", clean(error?.message || error), documentRef);
      throw error;
    }
  }

  function showResultRecap(result, options = {}) {
    const documentRef = options.doc || global.document;
    const normalized = normalizeResult(result);
    if (!documentRef?.body || !normalized) return null;
    ensureStyle(documentRef);
    documentRef.getElementById(RESULT_RECAP_ID)?.remove();
    const node = documentRef.createElement("aside");
    node.id = RESULT_RECAP_ID;
    node.dataset.result = normalized;
    const label = normalized === "victory" ? "VICTORY" : normalized === "defeat" ? "DEFEAT" : "ENCOUNTER CANCELADO";
    const image = RESULT_IMAGES[normalized];
    node.innerHTML = `
      <div class="lgl-result-head"><span>RESULTADO DEL ENCOUNTER</span><button class="lgl-result-close" type="button" aria-label="Cerrar resultado">×</button></div>
      ${image ? '<img alt="' + label + '" src="' + image + '">' : ""}
      <div class="lgl-result-text">${label}</div>`;
    node.querySelector(".lgl-result-close")?.addEventListener("click", () => node.remove());
    documentRef.body.appendChild(node);
    return node;
  }

  global.LuminousGameLoading = Object.freeze({
    version: "1.0.0",
    RESULT_IMAGES,
    normalizeResult,
    begin,
    setTitle,
    setCheck,
    fail,
    complete,
    waitForConnection,
    probeRead,
    probeDmWrite,
    waitForCombatFrame,
    waitForTheatre,
    showResultRecap,
    _state: state,
  });

  if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousGameLoading;
})(typeof window !== "undefined" ? window : globalThis);
