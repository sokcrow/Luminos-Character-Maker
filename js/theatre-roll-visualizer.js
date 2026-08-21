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
  const HEAD_SRC_MARKER = "yshLPnQ";
  const TAIL_SRC_MARKER = "XDx0ICt";
  const HEAD_SRC = "https://imgur.com/yshLPnQ.png";
  const TAIL_SRC = "https://imgur.com/XDx0ICt.png";

  const VISIBILITY = Object.freeze({ PUBLIC: "public", TOTAL: "total", HIDDEN: "hidden" });
  const HIDDEN_OUTPUT = Object.freeze({ NONE: "none", OUTCOME: "outcome", CUSTOM: "custom" });
  const MODIFIER = Object.freeze({ NEUTRAL: "neutral", ADVANTAGE: "advantage", DISADVANTAGE: "disadvantage" });

  const CLIENT_ID = (() => {
    try {
      const existing = global.sessionStorage?.getItem("luminousTheatreRollClientId");
      if (existing) return existing;
      const value = `roll_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      global.sessionStorage?.setItem("luminousTheatreRollClientId", value);
      return value;
    } catch (_) {
      return `roll_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    }
  })();

  let config = {
    visibility: VISIBILITY.PUBLIC,
    hiddenOutput: HIDDEN_OUTPUT.NONE,
    hiddenOutcome: "success",
    hiddenText: "",
    durationMs: DEFAULT_DURATION_MS,
  };
  let pendingLocalRoll = null;
  let nextCheckContext = null;
  let rollQuery = null;
  let configRef = null;
  let closeButtonObserver = null;
  let coinObserver = null;
  let localHud = null;
  let localHudTimer = null;
  const renderedKeys = new Set();
  const removalTimers = new Map();

  function isDmView() {
    return Boolean(doc.body?.classList?.contains("on-game-dashboard"));
  }

  function currentUid() {
    return firebase.auth?.().currentUser?.uid || null;
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

  function normalizeModifier(value) {
    const normalized = String(value || "").trim().toLowerCase();
    return Object.values(MODIFIER).includes(normalized) ? normalized : MODIFIER.NEUTRAL;
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

  function normalizeCheckContext(value) {
    const source = value || {};
    const raw = Number(source.thresholdRaw ?? source.threshold);
    const modifierValue = Math.max(0, Math.trunc(Number(source.modifierValue ?? source.x) || 0));
    const modifierType = modifierValue > 0 ? normalizeModifier(source.modifierType) : MODIFIER.NEUTRAL;
    return {
      thresholdRaw: Number.isFinite(raw) ? Math.trunc(raw) : null,
      hiddenThreshold: Boolean(source.hiddenThreshold),
      modifierType,
      modifierValue,
      tipText: modifierValue > 0 ? String(source.tipText || source.tip || "").trim().slice(0, 180) : "",
    };
  }

  function effectiveThreshold(check) {
    const normalized = normalizeCheckContext(check);
    if (!Number.isFinite(normalized.thresholdRaw)) return null;
    if (normalized.modifierType === MODIFIER.ADVANTAGE) {
      return Math.max(0, normalized.thresholdRaw - normalized.modifierValue);
    }
    if (normalized.modifierType === MODIFIER.DISADVANTAGE) {
      return normalized.thresholdRaw + normalized.modifierValue;
    }
    return normalized.thresholdRaw;
  }

  function checkOutcome(total, check) {
    const threshold = effectiveThreshold(check);
    if (!Number.isFinite(threshold) || !Number.isFinite(Number(total))) return null;
    return Number(total) >= threshold ? "passed" : "failed";
  }

  function playerData() {
    return global.datosJugador || {};
  }

  function assignedActor() {
    try {
      return typeof global.getAssignedTheatreActor === "function" ? (global.getAssignedTheatreActor() || {}) : {};
    } catch (_) {
      return {};
    }
  }

  function getRollerIdentity() {
    const data = playerData();
    const actor = assignedActor();
    const name = String(
      actor.nombre || actor.name || data.characterName || data.character_name || data.nombre || data.name || "PLAYER"
    ).trim() || "PLAYER";
    const actorId = actor.actorId || actor.id || data.actorId || data.vinculo_jugador || null;
    return { uid: currentUid(), actorId: actorId ? String(actorId) : null, name };
  }

  function numberFromText(node) {
    if (!node) return null;
    const parsed = Number.parseInt(String(node.textContent || "").trim(), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function sideFromSrc(src) {
    const value = String(src || "");
    if (value.includes(HEAD_SRC_MARKER)) return "head";
    if (value.includes(TAIL_SRC_MARKER)) return "tail";
    return "unknown";
  }

  function captureCoinImages() {
    const images = Array.from(doc.querySelectorAll("#coin-toss-coins-container img"));
    return images.slice(0, COIN_COUNT).map((image) => {
      const src = String(image.currentSrc || image.src || "");
      const side = sideFromSrc(src);
      return {
        side,
        src: side === "head" ? HEAD_SRC : side === "tail" ? TAIL_SRC : src,
      };
    });
  }

  function countHeadsFromCoins(coins) {
    return (coins || []).filter((coin) => coin?.side === "head").length;
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

  function buildCoinImage(coin) {
    const img = doc.createElement("img");
    img.className = "theatre-check-coin-image";
    img.alt = coin?.side === "head" ? "Head" : coin?.side === "tail" ? "Tail" : "Coin";
    img.src = coin?.src || (coin?.side === "head" ? HEAD_SRC : TAIL_SRC);
    img.dataset.side = coin?.side || "unknown";
    return img;
  }

  function createLocalHud(check) {
    const layer = ensureLayer();
    if (!layer) return null;
    localHud?.remove();
    if (localHudTimer) global.clearTimeout(localHudTimer);

    const normalized = normalizeCheckContext(check);
    const hud = doc.createElement("article");
    hud.className = "theatre-check-hud is-rolling";
    hud.dataset.modifier = normalized.modifierType;

    if (normalized.modifierValue > 0 && normalized.tipText) {
      const tip = doc.createElement("section");
      tip.className = "theatre-check-tip";
      const sign = normalized.modifierType === MODIFIER.ADVANTAGE ? "-" : "+";
      const label = normalized.modifierType === MODIFIER.ADVANTAGE ? "ADVANTAGE" : "DISADVANTAGE";
      tip.appendChild(textNode("theatre-check-tip-title", `${label} ${sign}${normalized.modifierValue}`));
      tip.appendChild(textNode("theatre-check-tip-copy", normalized.tipText));
      hud.appendChild(tip);
    }

    const body = doc.createElement("section");
    body.className = "theatre-check-body";

    const coins = doc.createElement("div");
    coins.className = "theatre-check-coins";
    coins.dataset.localCoins = "true";
    body.appendChild(coins);

    const comparison = doc.createElement("div");
    comparison.className = "theatre-check-comparison";

    const thresholdBlock = doc.createElement("div");
    thresholdBlock.className = `theatre-check-block theatre-check-threshold ${normalized.modifierType}`;
    thresholdBlock.appendChild(textNode("theatre-check-block-label", "Threshold"));
    const thresholdValue = textNode("theatre-check-block-value", normalized.hiddenThreshold ? "??" : (effectiveThreshold(normalized) ?? "—"));
    thresholdValue.dataset.localThreshold = "true";
    thresholdBlock.appendChild(thresholdValue);
    const thresholdSub = textNode("theatre-check-block-sub", "");
    thresholdSub.dataset.localThresholdSub = "true";
    thresholdBlock.appendChild(thresholdSub);

    const operator = textNode("theatre-check-operator", "VS");
    operator.dataset.localOperator = "true";

    const resultBlock = doc.createElement("div");
    resultBlock.className = "theatre-check-block theatre-check-result";
    resultBlock.appendChild(textNode("theatre-check-block-label", "Outcome"));
    const resultValue = textNode("theatre-check-block-value", "—");
    resultValue.dataset.localResult = "true";
    resultBlock.appendChild(resultValue);
    resultBlock.appendChild(textNode("theatre-check-block-sub", ""));

    comparison.append(thresholdBlock, operator, resultBlock);
    body.appendChild(comparison);

    const status = textNode("theatre-check-status", "ROLLING...");
    status.dataset.localStatus = "true";
    body.appendChild(status);
    hud.appendChild(body);
    layer.appendChild(hud);
    localHud = hud;
    return hud;
  }

  function syncLocalCoinsFromEngine() {
    if (!localHud) return;
    const row = localHud.querySelector("[data-local-coins]");
    if (!row) return;
    const coins = captureCoinImages();
    row.replaceChildren(...coins.map(buildCoinImage));
  }

  function syncLocalResult(total, check) {
    if (!localHud) return;
    const normalized = normalizeCheckContext(check);
    const threshold = effectiveThreshold(normalized);
    const outcome = checkOutcome(total, normalized);
    const resultNode = localHud.querySelector("[data-local-result]");
    const operatorNode = localHud.querySelector("[data-local-operator]");
    const statusNode = localHud.querySelector("[data-local-status]");
    const thresholdSub = localHud.querySelector("[data-local-threshold-sub]");
    if (resultNode) resultNode.textContent = String(total);
    if (operatorNode) operatorNode.textContent = outcome === "passed" ? "≤" : outcome === "failed" ? ">" : "VS";
    if (thresholdSub && Number.isFinite(threshold) && normalized.modifierValue > 0) {
      if (normalized.hiddenThreshold) {
        thresholdSub.textContent = normalized.modifierType === MODIFIER.ADVANTAGE
          ? `-${normalized.modifierValue}`
          : `+${normalized.modifierValue}`;
      } else {
        thresholdSub.textContent = normalized.modifierType === MODIFIER.ADVANTAGE
          ? `${normalized.thresholdRaw} - ${normalized.modifierValue}`
          : `${normalized.thresholdRaw} + ${normalized.modifierValue}`;
      }
    }
    if (statusNode) {
      statusNode.textContent = outcome === "passed" ? "CHECK PASSED" : outcome === "failed" ? "CHECK FAILED" : "ROLL COMPLETE";
      statusNode.classList.toggle("is-pass", outcome === "passed");
      statusNode.classList.toggle("is-fail", outcome === "failed");
    }
    localHud.classList.remove("is-rolling");
    localHud.classList.add("is-resolved");
  }

  function captureLocalRollStart() {
    const panel = doc.getElementById("coin-toss-panel");
    const result = doc.getElementById("roll-total-score");
    if (!panel || panel.style.display === "none") return;

    global.setTimeout(() => {
      const check = normalizeCheckContext(nextCheckContext);
      nextCheckContext = null;
      pendingLocalRoll = {
        base: numberFromText(result),
        startedAt: Date.now(),
        check,
      };
      createLocalHud(check);
      syncLocalCoinsFromEngine();

      coinObserver?.disconnect();
      const coinContainer = doc.getElementById("coin-toss-coins-container");
      if (coinContainer) {
        coinObserver = new MutationObserver(syncLocalCoinsFromEngine);
        coinObserver.observe(coinContainer, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
      }
    }, 40);
  }

  async function publishRoll(payload) {
    const source = payload || {};
    const total = Number(source.total);
    if (!Number.isFinite(total)) return { published: false, reason: "invalid-total" };

    const effectiveConfig = normalizeConfig(config);
    const roller = source.roller || getRollerIdentity();
    const check = normalizeCheckContext(source.check);
    const coins = Array.isArray(source.coins) ? source.coins.slice(0, COIN_COUNT) : [];
    const heads = countHeadsFromCoins(coins);
    const ref = db.ref(resolveRollPath(getRoomId())).push();

    await ref.set({
      schemaVersion: 2,
      kind: Number.isFinite(check.thresholdRaw) ? "check-result" : "coin-roll-result",
      presentation: "result-only",
      roller: {
        uid: roller.uid || null,
        actorId: roller.actorId || null,
        name: String(roller.name || "PLAYER").slice(0, 80),
      },
      rollerClientId: CLIENT_ID,
      base: Number.isFinite(Number(source.base)) ? Number(source.base) : null,
      total: Math.trunc(total),
      heads,
      coinCount: coins.length || COIN_COUNT,
      coinHeadBonus: COIN_HEAD_BONUS,
      check: {
        thresholdRaw: check.thresholdRaw,
        hiddenThreshold: check.hiddenThreshold,
        modifierType: check.modifierType,
        modifierValue: check.modifierValue,
        outcome: checkOutcome(total, check),
      },
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
    coinObserver?.disconnect();
    const total = numberFromText(doc.getElementById("roll-total-score"));
    const pending = pendingLocalRoll;
    pendingLocalRoll = null;
    if (!Number.isFinite(total)) return;

    syncLocalCoinsFromEngine();
    const coins = captureCoinImages();
    syncLocalResult(total, pending.check);

    publishRoll({ base: pending.base, total, coins, check: pending.check })
      .catch((error) => console.warn("No se pudo publicar el resultado en Theatre:", error));

    localHudTimer = global.setTimeout(() => {
      localHud?.classList.add("is-leaving");
      global.setTimeout(() => {
        localHud?.remove();
        localHud = null;
      }, 260);
    }, config.durationMs);
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

  function shouldSuppressRemoteForLocalRoller(roll) {
    if (roll?.rollerClientId && roll.rollerClientId === CLIENT_ID) return true;
    const uid = currentUid();
    return Boolean(uid && roll?.roller?.uid && uid === roll.roller.uid && !isDmView());
  }

  function hiddenRemoteMessage(roll) {
    const output = normalizeHiddenOutput(roll?.hiddenOutput);
    if (output === HIDDEN_OUTPUT.OUTCOME) {
      const actual = roll?.check?.outcome;
      if (actual === "passed") return "CHECK PASSED";
      if (actual === "failed") return "CHECK FAILED";
      return String(roll?.hiddenOutcome || "").toLowerCase() === "failure" ? "FALLO" : "ÉXITO";
    }
    if (output === HIDDEN_OUTPUT.CUSTOM) return String(roll?.hiddenText || "").trim() || "RESULTADO OCULTO";
    return "";
  }

  function buildRemoteResultCard(key, roll) {
    const visibility = normalizeVisibility(roll?.visibility);
    if (!isDmView() && visibility === VISIBILITY.HIDDEN && normalizeHiddenOutput(roll?.hiddenOutput) === HIDDEN_OUTPUT.NONE) return null;

    const card = doc.createElement("article");
    card.className = "theatre-roll-result-card";
    card.dataset.rollKey = key;

    const name = textNode("theatre-roll-result-name", roll?.roller?.name || "PLAYER");
    card.appendChild(name);

    if (!isDmView() && visibility === VISIBILITY.HIDDEN) {
      card.appendChild(textNode("theatre-roll-result-outcome", hiddenRemoteMessage(roll)));
      return card;
    }

    const total = textNode("theatre-roll-result-total", roll?.total ?? "—");
    card.appendChild(total);
    const outcome = roll?.check?.outcome;
    if (outcome === "passed" || outcome === "failed") {
      const result = textNode("theatre-roll-result-outcome", outcome === "passed" ? "CHECK PASSED" : "CHECK FAILED");
      result.classList.add(outcome === "passed" ? "is-pass" : "is-fail");
      card.appendChild(result);
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
    renderedKeys.add(key);
    if (shouldSuppressRemoteForLocalRoller(roll)) return;

    const timestamp = eventTimestamp(roll);
    if (timestamp && Date.now() - timestamp > MAX_RECENT_AGE_MS) return;
    const layer = ensureLayer();
    if (!layer) return;
    const card = buildRemoteResultCard(key, roll);
    if (!card) return;

    layer.appendChild(card);
    while (layer.querySelectorAll(".theatre-roll-result-card").length > 3) {
      layer.querySelector(".theatre-roll-result-card")?.remove();
    }
    const duration = normalizeConfig({ durationMs: roll.durationMs }).durationMs;
    removalTimers.set(key, global.setTimeout(() => {
      card.classList.add("is-leaving");
      global.setTimeout(() => card.remove(), 260);
      removalTimers.delete(key);
    }, duration));
  }

  function bindRollStream() {
    rollQuery?.off();
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
    const custom = root.querySelector("[data-roll-hidden-text]");
    if (output) output.value = config.hiddenOutput;
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
      <div class="theatre-roll-director-title">RESULTADO DE TIRADAS</div>
      <div class="theatre-roll-visibility-buttons" role="group" aria-label="Visibilidad del resultado">
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
      writeConfig({ visibility: button.dataset.rollVisibility }).catch((error) => console.warn("No se pudo cambiar visibilidad:", error));
    });
    root.querySelector("[data-roll-hidden-output]")?.addEventListener("change", (event) => {
      writeConfig({ hiddenOutput: event.target.value }).catch((error) => console.warn("No se pudo cambiar salida oculta:", error));
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

  function armCheck(options) {
    nextCheckContext = normalizeCheckContext(options);
    return Object.assign({}, nextCheckContext);
  }

  function clearArmedCheck() {
    nextCheckContext = null;
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
    MODIFIER,
    HEAD_SRC,
    TAIL_SRC,
    resolveRollPath,
    normalizeConfig,
    normalizeCheckContext,
    effectiveThreshold,
    checkOutcome,
    captureCoinImages,
    armCheck,
    clearArmedCheck,
    publishRoll,
    renderIncomingRoll,
    getConfig: () => Object.assign({}, config),
  });
})(window);
