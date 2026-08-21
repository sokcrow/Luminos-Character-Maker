(function (global) {
  "use strict";

  const doc = global.document;
  const firebase = global.firebase;
  if (!doc || !firebase?.database) return;

  const db = firebase.database();
  const DEFAULT_ROOM_ID = "default";
  const CONFIG_PATH = "campaña/config/theatre_rolls";
  const MAX_RECENT_AGE_MS = 20000;
  const DEFAULT_DURATION_MS = 7000;
  const COIN_COUNT = 5;
  const COIN_HEAD_BONUS = 4;
  const VISIBILITY = Object.freeze({
    PUBLIC: "public",
    TOTAL: "total",
    HIDDEN: "hidden",
  });
  const HIDDEN_OUTPUT = Object.freeze({
    NONE: "none",
    OUTCOME: "outcome",
    CUSTOM: "custom",
  });

  let config = {
    visibility: VISIBILITY.PUBLIC,
    hiddenOutput: HIDDEN_OUTPUT.NONE,
    hiddenOutcome: "success",
    hiddenText: "",
    durationMs: DEFAULT_DURATION_MS,
  };
  let pendingLocalRoll = null;
  let rollQuery = null;
  let configRef = null;
  let closeButtonObserver = null;
  const renderedKeys = new Set();
  const removalTimers = new Map();

  function isDmView() {
    return Boolean(doc.body?.classList?.contains("on-game-dashboard"));
  }

  function getRoomId() {
    return doc.body?.dataset?.theatreRoomId || DEFAULT_ROOM_ID;
  }

  function resolveRollPath(roomId) {
    const normalized = roomId && roomId !== DEFAULT_ROOM_ID ? String(roomId) : DEFAULT_ROOM_ID;
    if (normalized === DEFAULT_ROOM_ID) return "campaña/teatro/tiradas";
    return `campaña/teatro/salas/${normalized}/tiradas`;
  }

  function normalizeVisibility(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return Object.values(VISIBILITY).includes(normalized) ? normalized : VISIBILITY.PUBLIC;
  }

  function normalizeHiddenOutput(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return Object.values(HIDDEN_OUTPUT).includes(normalized) ? normalized : HIDDEN_OUTPUT.NONE;
  }

  function normalizeConfig(value) {
    const source = value || {};
    const duration = Number(source.durationMs);
    return {
      visibility: normalizeVisibility(source.visibility),
      hiddenOutput: normalizeHiddenOutput(source.hiddenOutput),
      hiddenOutcome: String(source.hiddenOutcome || "success").toLowerCase() === "failure" ? "failure" : "success",
      hiddenText: String(source.hiddenText || "").trim().slice(0, 80),
      durationMs: Number.isFinite(duration) ? Math.max(2500, Math.min(15000, duration)) : DEFAULT_DURATION_MS,
    };
  }

  function playerData() {
    return global.datosJugador || {};
  }

  function assignedActor() {
    try {
      return typeof global.getAssignedTheatreActor === "function"
        ? (global.getAssignedTheatreActor() || {})
        : {};
    } catch (_) {
      return {};
    }
  }

  function getRollerIdentity() {
    const data = playerData();
    const actor = assignedActor();
    const user = firebase.auth?.().currentUser || null;
    const name = String(
      actor.nombre ||
      actor.name ||
      data.characterName ||
      data.character_name ||
      data.nombre ||
      data.name ||
      "PLAYER"
    ).trim() || "PLAYER";
    const actorId = actor.actorId || actor.id || data.actorId || data.vinculo_jugador || null;
    return {
      uid: user?.uid || null,
      actorId: actorId ? String(actorId) : null,
      name,
    };
  }

  function numberFromText(node) {
    if (!node) return null;
    const parsed = Number.parseInt(String(node.textContent || "").trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function captureLocalRollStart() {
    const panel = doc.getElementById("coin-toss-panel");
    const label = doc.getElementById("coin-toss-skill-name");
    const result = doc.getElementById("roll-total-score");
    if (!panel || panel.style.display === "none") return;

    global.setTimeout(() => {
      const base = numberFromText(result);
      pendingLocalRoll = {
        label: String(label?.textContent || "TIRADA").trim() || "TIRADA",
        base,
        startedAt: Date.now(),
      };
    }, 40);
  }

  function countHeads(base, total) {
    if (!Number.isFinite(base) || !Number.isFinite(total)) return null;
    const delta = total - base;
    if (delta < 0 || delta % COIN_HEAD_BONUS !== 0) return null;
    const heads = delta / COIN_HEAD_BONUS;
    return Math.max(0, Math.min(COIN_COUNT, heads));
  }

  async function publishRoll(payload) {
    const source = payload || {};
    const total = Number(source.total);
    if (!Number.isFinite(total)) return { published: false, reason: "invalid-total" };

    const base = Number(source.base);
    const normalizedBase = Number.isFinite(base) ? base : null;
    const heads = source.heads == null ? countHeads(normalizedBase, total) : Number(source.heads);
    const safeHeads = Number.isFinite(heads) ? Math.max(0, Math.min(COIN_COUNT, Math.trunc(heads))) : null;
    const effectiveConfig = normalizeConfig(config);
    const roller = source.roller || getRollerIdentity();
    const ref = db.ref(resolveRollPath(getRoomId())).push();

    await ref.set({
      schemaVersion: 1,
      kind: String(source.kind || "coin-roll"),
      roller: {
        uid: roller.uid || null,
        actorId: roller.actorId || null,
        name: String(roller.name || "PLAYER").slice(0, 80),
      },
      label: String(source.label || "TIRADA").slice(0, 100),
      base: normalizedBase,
      total: Math.trunc(total),
      heads: safeHeads,
      coinCount: COIN_COUNT,
      coinHeadBonus: COIN_HEAD_BONUS,
      visibility: effectiveConfig.visibility,
      hiddenOutput: effectiveConfig.hiddenOutput,
      hiddenOutcome: effectiveConfig.hiddenOutcome,
      hiddenText: effectiveConfig.hiddenText,
      durationMs: effectiveConfig.durationMs,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      clientCreatedAt: Date.now(),
      roomId: getRoomId(),
    });

    return { published: true, key: ref.key };
  }

  function finalizeLocalRoll() {
    if (!pendingLocalRoll) return;
    const result = doc.getElementById("roll-total-score");
    const total = numberFromText(result);
    const pending = pendingLocalRoll;
    pendingLocalRoll = null;
    if (!Number.isFinite(total)) return;

    publishRoll({
      label: pending.label,
      base: pending.base,
      total,
      heads: countHeads(pending.base, total),
    }).catch((error) => console.warn("No se pudo publicar la tirada en Theatre:", error));
  }

  function installCoinCapture() {
    const closeButton = doc.getElementById("coin-toss-close-btn");
    if (!closeButton || closeButtonObserver) return false;

    closeButtonObserver = new MutationObserver(() => {
      if (closeButton.disabled) captureLocalRollStart();
      else finalizeLocalRoll();
    });
    closeButtonObserver.observe(closeButton, { attributes: true, attributeFilter: ["disabled"] });

    doc.addEventListener("click", (event) => {
      if (!event.target?.closest?.(".sheet-roll-skill-btn, [data-dnd-roll]")) return;
      global.setTimeout(captureLocalRollStart, 0);
    }, true);

    return true;
  }

  function ensureLayer() {
    const stage = doc.getElementById("theatre-stage");
    if (!stage) return null;
    let layer = stage.querySelector(":scope > #theatre-roll-layer");
    if (!layer) {
      layer = doc.createElement("div");
      layer.id = "theatre-roll-layer";
      layer.className = "theatre-roll-layer";
      layer.setAttribute("aria-live", "polite");
      layer.setAttribute("aria-label", "Tiradas del Theatre");
      stage.appendChild(layer);
    }
    return layer;
  }

  function textNode(className, value) {
    const node = doc.createElement("div");
    node.className = className;
    node.textContent = String(value ?? "");
    return node;
  }

  function visibilityLabel(value) {
    if (value === VISIBILITY.TOTAL) return "TOTAL";
    if (value === VISIBILITY.HIDDEN) return "OCULTA";
    return "PÚBLICA";
  }

  function shouldHideFromPlayer(roll) {
    return !isDmView() &&
      normalizeVisibility(roll?.visibility) === VISIBILITY.HIDDEN &&
      normalizeHiddenOutput(roll?.hiddenOutput) === HIDDEN_OUTPUT.NONE;
  }

  function hiddenPlayerMessage(roll) {
    const output = normalizeHiddenOutput(roll?.hiddenOutput);
    if (output === HIDDEN_OUTPUT.OUTCOME) {
      return String(roll?.hiddenOutcome || "").toLowerCase() === "failure" ? "FALLO" : "ÉXITO";
    }
    if (output === HIDDEN_OUTPUT.CUSTOM) {
      return String(roll?.hiddenText || "").trim() || "RESULTADO OCULTO";
    }
    return "";
  }

  function buildCoinRow(roll) {
    const row = doc.createElement("div");
    row.className = "theatre-roll-coins";
    const count = Number.isFinite(Number(roll?.coinCount)) ? Math.max(1, Math.min(10, Number(roll.coinCount))) : COIN_COUNT;
    const heads = Number.isFinite(Number(roll?.heads)) ? Math.max(0, Math.min(count, Number(roll.heads))) : null;
    for (let index = 0; index < count; index += 1) {
      const coin = doc.createElement("i");
      coin.className = "theatre-roll-coin";
      if (heads == null) coin.dataset.side = "unknown";
      else coin.dataset.side = index < heads ? "head" : "tail";
      coin.setAttribute("aria-hidden", "true");
      row.appendChild(coin);
    }
    if (heads != null) row.setAttribute("aria-label", `${heads} caras de ${count}`);
    return row;
  }

  function buildFullCard(card, roll) {
    const base = Number(roll?.base);
    const heads = Number(roll?.heads);
    const headBonus = Number(roll?.coinHeadBonus) || COIN_HEAD_BONUS;
    card.appendChild(buildCoinRow(roll));

    const detail = doc.createElement("div");
    detail.className = "theatre-roll-detail";
    if (Number.isFinite(base)) detail.appendChild(textNode("theatre-roll-detail-item", `BASE ${base >= 0 ? "+" : ""}${base}`));
    if (Number.isFinite(heads)) detail.appendChild(textNode("theatre-roll-detail-item", `HEADS ${heads} × ${headBonus}`));
    card.appendChild(detail);
  }

  function buildRollCard(key, roll) {
    const visibility = normalizeVisibility(roll?.visibility);
    if (shouldHideFromPlayer(roll)) return null;

    const card = doc.createElement("article");
    card.className = "theatre-roll-card";
    card.dataset.rollKey = key;
    card.dataset.visibility = visibility;

    const head = doc.createElement("header");
    head.className = "theatre-roll-card-header";
    head.appendChild(textNode("theatre-roll-roller", roll?.roller?.name || "PLAYER"));
    head.appendChild(textNode("theatre-roll-mode", visibilityLabel(visibility)));
    card.appendChild(head);

    card.appendChild(textNode("theatre-roll-label", roll?.label || "TIRADA"));

    if (!isDmView() && visibility === VISIBILITY.HIDDEN) {
      card.classList.add("is-hidden-result");
      card.appendChild(textNode("theatre-roll-hidden-result", hiddenPlayerMessage(roll)));
      return card;
    }

    if (visibility === VISIBILITY.PUBLIC || isDmView()) buildFullCard(card, roll);
    if (visibility === VISIBILITY.TOTAL && !isDmView()) card.classList.add("is-total-only");

    const total = textNode("theatre-roll-total", roll?.total ?? "—");
    total.setAttribute("aria-label", `Total ${roll?.total ?? "desconocido"}`);
    card.appendChild(total);

    if (isDmView() && visibility !== VISIBILITY.PUBLIC) {
      card.appendChild(textNode(
        "theatre-roll-director-note",
        visibility === VISIBILITY.HIDDEN ? "OCULTA PARA JUGADORES" : "JUGADORES VEN SOLO EL TOTAL"
      ));
    }

    return card;
  }

  function eventTimestamp(roll) {
    const server = Number(roll?.createdAt);
    if (Number.isFinite(server) && server > 0) return server;
    const client = Number(roll?.clientCreatedAt);
    return Number.isFinite(client) ? client : 0;
  }

  function renderIncomingRoll(snapshot) {
    const key = snapshot?.key;
    const roll = snapshot?.val?.() || {};
    if (!key || renderedKeys.has(key)) return;

    const timestamp = eventTimestamp(roll);
    if (timestamp && Date.now() - timestamp > MAX_RECENT_AGE_MS) {
      renderedKeys.add(key);
      return;
    }

    const layer = ensureLayer();
    if (!layer) return;
    const card = buildRollCard(key, roll);
    renderedKeys.add(key);
    if (!card) return;

    layer.appendChild(card);
    while (layer.children.length > 3) layer.firstElementChild?.remove();

    const duration = normalizeConfig({ durationMs: roll.durationMs }).durationMs;
    removalTimers.set(key, global.setTimeout(() => {
      card.classList.add("is-leaving");
      global.setTimeout(() => card.remove(), 260);
      removalTimers.delete(key);
    }, duration));
  }

  function bindRollStream() {
    if (rollQuery) rollQuery.off();
    rollQuery = db.ref(resolveRollPath(getRoomId())).limitToLast(8);
    rollQuery.on("child_added", renderIncomingRoll);
  }

  function setControlState(root) {
    if (!root) return;
    root.querySelectorAll("[data-roll-visibility]").forEach((button) => {
      const active = button.dataset.rollVisibility === config.visibility;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    const output = root.querySelector("[data-roll-hidden-output]");
    const outcome = root.querySelector("[data-roll-hidden-outcome]");
    const custom = root.querySelector("[data-roll-hidden-text]");
    if (output) output.value = config.hiddenOutput;
    if (outcome) outcome.value = config.hiddenOutcome;
    if (custom && doc.activeElement !== custom) custom.value = config.hiddenText;
    root.dataset.visibility = config.visibility;
    root.dataset.hiddenOutput = config.hiddenOutput;
  }

  function writeConfig(patch) {
    if (!isDmView()) return Promise.resolve(false);
    return db.ref(CONFIG_PATH).update(patch).then(() => true);
  }

  function mountDirectorControls() {
    if (!isDmView()) return null;
    const panel = doc.getElementById("theatre-director-panel");
    if (!panel) return null;
    let root = panel.querySelector(".theatre-roll-director");
    if (root) {
      setControlState(root);
      return root;
    }

    root = doc.createElement("section");
    root.className = "theatre-roll-director";
    root.innerHTML = `
      <div class="theatre-roll-director-title">VISIBILIDAD DE TIRADAS</div>
      <div class="theatre-roll-visibility-buttons" role="group" aria-label="Visibilidad de tiradas">
        <button type="button" data-roll-visibility="public" aria-pressed="false">PÚBLICA</button>
        <button type="button" data-roll-visibility="total" aria-pressed="false">TOTAL</button>
        <button type="button" data-roll-visibility="hidden" aria-pressed="false">OCULTA</button>
      </div>
      <div class="theatre-roll-hidden-options">
        <label>SALIDA OCULTA
          <select data-roll-hidden-output>
            <option value="none">NADA</option>
            <option value="outcome">ÉXITO / FALLO</option>
            <option value="custom">TEXTO DM</option>
          </select>
        </label>
        <label>RESULTADO
          <select data-roll-hidden-outcome>
            <option value="success">ÉXITO</option>
            <option value="failure">FALLO</option>
          </select>
        </label>
        <label class="theatre-roll-hidden-text-label">TEXTO
          <input type="text" maxlength="80" data-roll-hidden-text placeholder="Mensaje visible para jugadores">
        </label>
      </div>`;

    const composer = panel.querySelector(".theatre-controls");
    if (composer) panel.insertBefore(root, composer);
    else panel.appendChild(root);

    root.addEventListener("click", (event) => {
      const button = event.target?.closest?.("[data-roll-visibility]");
      if (!button) return;
      writeConfig({ visibility: button.dataset.rollVisibility }).catch((error) => console.warn("No se pudo cambiar visibilidad de tiradas:", error));
    });

    root.querySelector("[data-roll-hidden-output]")?.addEventListener("change", (event) => {
      writeConfig({ hiddenOutput: event.target.value }).catch((error) => console.warn("No se pudo cambiar salida oculta:", error));
    });
    root.querySelector("[data-roll-hidden-outcome]")?.addEventListener("change", (event) => {
      writeConfig({ hiddenOutcome: event.target.value }).catch((error) => console.warn("No se pudo cambiar resultado oculto:", error));
    });
    root.querySelector("[data-roll-hidden-text]")?.addEventListener("change", (event) => {
      writeConfig({ hiddenText: String(event.target.value || "").trim().slice(0, 80) }).catch((error) => console.warn("No se pudo cambiar texto oculto:", error));
    });

    setControlState(root);
    return root;
  }

  function bindConfig() {
    configRef = db.ref(CONFIG_PATH);
    configRef.on("value", (snapshot) => {
      config = normalizeConfig(snapshot.val());
      setControlState(doc.querySelector(".theatre-roll-director"));
    });
  }

  function boot() {
    ensureLayer();
    installCoinCapture();
    bindConfig();
    bindRollStream();
    mountDirectorControls();

    const observer = new MutationObserver(() => {
      ensureLayer();
      installCoinCapture();
      mountDirectorControls();
    });
    observer.observe(doc.body, { childList: true, subtree: true });
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousTheatreRolls = Object.freeze({
    VISIBILITY,
    HIDDEN_OUTPUT,
    resolveRollPath,
    normalizeConfig,
    publishRoll,
    renderIncomingRoll,
    getConfig: () => Object.assign({}, config),
  });
})(window);
