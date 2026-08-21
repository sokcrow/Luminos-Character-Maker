(function (global) {
  "use strict";

  const doc = global.document;
  const firebase = global.firebase;
  if (!doc || !firebase?.database || global.LuminousTheatreOpposedChecks) return;

  const db = firebase.database();
  const DM_UID = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
  const REQUEST_ROOT = "theatre_check_requests";
  const COMMAND_ROOT = "theatre_check_commands";
  const LIVE_ROOT = "theatre_check_live";
  const OPPOSED_ROOT = "theatre_opposed_checks";
  const RESULT_ROOT = "theatre_opposed_results";
  const MAX_AGE_MS = 10 * 60 * 1000;
  const HEAD_SRC = "https://imgur.com/yshLPnQ.png";
  const TAIL_SRC = "https://imgur.com/XDx0ICt.png";

  const state = {
    mounted: false,
    players: {},
    sessions: {},
    latestOpposedCommand: null,
    activeCommand: null,
    localHud: null,
    dmHud: null,
    promptObserver: null,
    panelObserver: null,
    isolatedCloseButton: null,
    processingSessions: new Set(),
    resultKeys: new Set(),
  };

  const $ = (id) => doc.getElementById(id);
  const currentUid = () => firebase.auth?.().currentUser?.uid || null;
  const isDm = () => currentUid() === DM_UID || doc.body?.classList?.contains("on-game-dashboard");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const formatModifier = (value) => numberOr(value, 0) >= 0 ? `+${numberOr(value, 0)}` : String(numberOr(value, 0));
  const coordinator = () => global.LuminousTheatreCheckCoordinator;
  const abilities = () => coordinator()?.ABILITIES || [];
  const abilityById = (id) => abilities().find((ability) => ability.id === id) || abilities()[0] || null;
  const skillById = (ability, id) => ability?.skills?.find((skill) => skill.id === id) || null;
  const roomKey = () => coordinator()?.roomKey?.() || "default";

  function playerLabel(playerId, player) {
    return String(player?.characterName || player?.character_name || player?.nombre || player?.name || playerId || "PLAYER");
  }

  function effectiveThreshold(raw, check) {
    const threshold = Number(raw);
    if (!Number.isFinite(threshold)) return null;
    const x = Math.max(0, Math.trunc(numberOr(check?.modifierValue, 0)));
    if (check?.modifierType === "advantage") return Math.max(0, threshold - x);
    if (check?.modifierType === "disadvantage") return threshold + x;
    return threshold;
  }

  function outcomeFor(total, raw, check) {
    const threshold = effectiveThreshold(raw, check);
    if (!Number.isFinite(threshold)) return null;
    return Number(total) >= threshold ? "passed" : "failed";
  }

  function currentInitiatorSpec() {
    const kind = $("theatre-check-kind")?.value || "ability";
    const ability = abilityById($("theatre-check-ability")?.value || "str");
    if (!ability) return null;
    const skill = kind === "skill" ? skillById(ability, $("theatre-check-skill")?.value) : null;
    if (kind === "skill" && !skill) return null;
    return {
      kind,
      abilityId: ability.id,
      skillId: skill?.id || null,
      label: kind === "ability" ? ability.name : kind === "save" ? `${ability.name} Saving Throw` : skill.name,
    };
  }

  function currentRivalSpec() {
    const kind = $("theatre-opposed-rival-kind")?.value || "ability";
    const ability = abilityById($("theatre-opposed-rival-ability")?.value || "str");
    if (!ability) return null;
    const skill = kind === "skill" ? skillById(ability, $("theatre-opposed-rival-skill")?.value) : null;
    if (kind === "skill" && !skill) return null;
    return {
      kind,
      abilityId: ability.id,
      skillId: skill?.id || null,
      label: kind === "ability" ? ability.name : kind === "save" ? `${ability.name} Saving Throw` : skill.name,
    };
  }

  function currentCheckTemplate() {
    const x = Math.max(0, Math.trunc(numberOr($("theatre-check-x")?.value, 0)));
    return {
      hiddenThreshold: Boolean($("theatre-check-hidden-threshold")?.checked),
      modifierType: x > 0 ? ($("theatre-check-modifier")?.value || "neutral") : "neutral",
      modifierValue: x,
      tipText: x > 0 ? String($("theatre-check-tip")?.value || "").trim().slice(0, 180) : "",
    };
  }

  function selectedPlayerFrom(selectId) {
    const uid = $(selectId)?.value || "";
    const entry = Object.entries(state.players).find(([, player]) => player?.uid === uid);
    return entry ? { uid, playerId: entry[0], player: entry[1], name: playerLabel(entry[0], entry[1]) } : null;
  }

  function syncRivalSkills() {
    const kind = $("theatre-opposed-rival-kind")?.value || "ability";
    const ability = abilityById($("theatre-opposed-rival-ability")?.value || "str");
    const field = $("theatre-opposed-rival-skill-field");
    const select = $("theatre-opposed-rival-skill");
    if (!field || !select || !ability) return;
    field.hidden = kind !== "skill";
    select.replaceChildren();
    ability.skills.forEach((skill) => {
      const option = doc.createElement("option");
      option.value = skill.id;
      option.textContent = skill.name;
      select.appendChild(option);
    });
    if (kind === "skill" && !ability.skills.length) {
      const option = doc.createElement("option");
      option.value = "";
      option.textContent = "SIN SKILLS";
      select.appendChild(option);
    }
  }

  function populateRivalPlayers() {
    const select = $("theatre-opposed-rival-player");
    if (!select) return;
    const initiatorUid = $("theatre-check-target-player")?.value || "";
    const previous = select.value;
    select.replaceChildren();
    Object.entries(state.players)
      .filter(([, player]) => player?.uid && player.uid !== DM_UID && player.uid !== initiatorUid && player.status !== "pending")
      .sort((a, b) => playerLabel(a[0], a[1]).localeCompare(playerLabel(b[0], b[1])))
      .forEach(([playerId, player]) => {
        const option = doc.createElement("option");
        option.value = player.uid;
        option.textContent = playerLabel(playerId, player);
        select.appendChild(option);
      });
    if (!select.options.length) {
      const option = doc.createElement("option");
      option.value = "";
      option.textContent = "SIN RIVAL DISPONIBLE";
      select.appendChild(option);
    } else if (Array.from(select.options).some((option) => option.value === previous)) {
      select.value = previous;
    }
  }

  function syncModeUi() {
    const opposed = $("theatre-check-mode")?.value === "opposed";
    const fields = $("theatre-opposed-fields");
    if (fields) fields.hidden = !opposed;
    const threshold = $("theatre-check-threshold");
    if (threshold) {
      threshold.disabled = opposed;
      threshold.placeholder = opposed ? "LO GENERA EL RIVAL" : "—";
      if (opposed) threshold.value = "";
    }
    if (opposed) populateRivalPlayers();
  }

  function mountDmUi() {
    if (!isDm()) return false;
    const compose = doc.querySelector("#theatre-check-director .theatre-check-compose");
    const grid = compose?.querySelector(".theatre-check-compose-grid");
    if (!compose || !grid) return false;
    if ($("theatre-opposed-fields")) return true;

    const mode = doc.createElement("label");
    mode.className = "wide theatre-opposed-mode-field";
    mode.innerHTML = '<span>TIPO DE CHECK</span><select id="theatre-check-mode"><option value="individual">INDIVIDUAL</option><option value="opposed">ENFRENTADO</option></select>';
    grid.prepend(mode);

    const opposed = doc.createElement("section");
    opposed.id = "theatre-opposed-fields";
    opposed.className = "theatre-opposed-fields";
    opposed.hidden = true;
    opposed.innerHTML = `
      <div class="theatre-opposed-heading"><strong>RIVAL / GENERADOR DE THRESHOLD</strong><span>EL DM INTERMEDIA AMBAS TIRADAS</span></div>
      <div class="theatre-opposed-grid">
        <label class="wide"><span>RIVAL</span><select id="theatre-opposed-rival-player"></select></label>
        <label><span>TIRADA RIVAL</span><select id="theatre-opposed-rival-kind"><option value="ability">ABILITY</option><option value="save">SAVING THROW</option><option value="skill">SKILL</option></select></label>
        <label><span>STAT RIVAL</span><select id="theatre-opposed-rival-ability"></select></label>
        <label class="wide" id="theatre-opposed-rival-skill-field" hidden><span>SKILL RIVAL</span><select id="theatre-opposed-rival-skill"></select></label>
      </div>
      <div class="theatre-opposed-flow">RIVAL TIRA → THRESHOLD REGISTRADO → JUGADOR PRINCIPAL TIRA → PASS / FAIL</div>`;
    grid.insertAdjacentElement("afterend", opposed);

    const abilitySelect = $("theatre-opposed-rival-ability");
    abilities().forEach((ability) => {
      const option = doc.createElement("option");
      option.value = ability.id;
      option.textContent = `${ability.code} · ${ability.name}`;
      abilitySelect.appendChild(option);
    });

    $("theatre-check-mode")?.addEventListener("change", syncModeUi);
    $("theatre-check-target-player")?.addEventListener("change", populateRivalPlayers);
    $("theatre-opposed-rival-kind")?.addEventListener("change", syncRivalSkills);
    abilitySelect?.addEventListener("change", syncRivalSkills);

    doc.addEventListener("click", (event) => {
      const send = event.target?.closest?.("#theatre-check-send");
      if (!send || $("theatre-check-mode")?.value !== "opposed") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      issueOpposedCheck().catch((error) => {
        console.error("No se pudo iniciar la tirada enfrentada:", error);
        showDmFeedback(`ERROR / ${error.message || error}`, true);
      });
    }, true);

    syncRivalSkills();
    syncModeUi();
    bindPlayers();
    bindSessionsDm();
    return true;
  }

  function bindPlayers() {
    db.ref("campaña/jugadores").on("value", (snapshot) => {
      state.players = snapshot.val() || {};
      populateRivalPlayers();
    });
  }

  async function findMatchingPendingRequest(initiatorUid, spec) {
    const snapshot = await db.ref(REQUEST_ROOT).once("value");
    const matches = [];
    snapshot.forEach((child) => {
      const request = child.val() || {};
      if (request.status !== "pending") return;
      if (request.requesterUid !== initiatorUid || String(request.roomKey || "default") !== roomKey()) return;
      const rs = request.rollSpec || {};
      if (rs.kind !== spec.kind || rs.abilityId !== spec.abilityId || (rs.skillId || null) !== (spec.skillId || null)) return;
      matches.push({ key: child.key, request });
    });
    matches.sort((a, b) => numberOr(b.request.clientCreatedAt) - numberOr(a.request.clientCreatedAt));
    return matches[0] || null;
  }

  async function issueOpposedCheck() {
    const initiator = selectedPlayerFrom("theatre-check-target-player");
    const rival = selectedPlayerFrom("theatre-opposed-rival-player");
    const initiatorSpec = currentInitiatorSpec();
    const rivalSpec = currentRivalSpec();
    if (!initiator) throw new Error("Selecciona el jugador principal.");
    if (!rival) throw new Error("Selecciona un rival distinto.");
    if (initiator.uid === rival.uid) throw new Error("Un jugador no puede enfrentarse a sí mismo.");
    if (!initiatorSpec || !rivalSpec) throw new Error("Selecciona tiradas válidas para ambos jugadores.");

    const requestMatch = await findMatchingPendingRequest(initiator.uid, initiatorSpec);
    const sessionRef = db.ref(OPPOSED_ROOT).push();
    const sessionId = sessionRef.key;
    const checkTemplate = currentCheckTemplate();
    const session = {
      schemaVersion: 1,
      sessionId,
      roomKey: roomKey(),
      status: "awaiting_threshold",
      initiatorUid: initiator.uid,
      initiatorPlayerId: initiator.playerId,
      initiatorName: initiator.name,
      initiatorRollSpec: initiatorSpec,
      rivalUid: rival.uid,
      rivalPlayerId: rival.playerId,
      rivalName: rival.name,
      rivalRollSpec: rivalSpec,
      checkTemplate,
      requestId: requestMatch?.key || null,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      clientCreatedAt: Date.now(),
    };
    await sessionRef.set(session);

    const commandRef = db.ref(`${COMMAND_ROOT}/${rival.uid}`).push();
    await commandRef.set({
      schemaVersion: 1,
      targetUid: rival.uid,
      targetPlayerId: rival.playerId,
      targetName: rival.name,
      roomKey: roomKey(),
      requestedBy: "opposed",
      requestId: requestMatch?.key || null,
      rollSpec: rivalSpec,
      check: {
        thresholdRaw: null,
        hiddenThreshold: false,
        modifierType: "neutral",
        modifierValue: 0,
        tipText: "",
        opposedSessionId: sessionId,
        opposedPhase: "threshold",
      },
      status: "issued",
      issuedAt: firebase.database.ServerValue.TIMESTAMP,
      clientIssuedAt: Date.now(),
    });
    await sessionRef.update({ thresholdCommandId: commandRef.key });

    if (requestMatch) {
      await db.ref(`${REQUEST_ROOT}/${requestMatch.key}`).update({
        status: "approved",
        commandId: commandRef.key,
        opposedSessionId: sessionId,
        decidedAt: firebase.database.ServerValue.TIMESTAMP,
      });
    }

    showDmFeedback(`${rival.name} GENERARÁ EL THRESHOLD · LUEGO ${initiator.name} RESUELVE`, false);
    $("theatre-check-mode").value = "individual";
    syncModeUi();
  }

  function showDmFeedback(text, error) {
    const host = $("theatre-check-director");
    if (!host) return;
    const node = doc.createElement("div");
    node.className = `theatre-opposed-feedback${error ? " is-error" : ""}`;
    node.textContent = text;
    host.appendChild(node);
    global.setTimeout(() => node.remove(), 3600);
  }

  function bindSessionsDm() {
    if (!isDm()) return;
    db.ref(OPPOSED_ROOT).on("value", (snapshot) => {
      state.sessions = snapshot.val() || {};
      Object.entries(state.sessions).forEach(([sessionId, session]) => processSessionDm(sessionId, session));
    });
    db.ref(LIVE_ROOT).on("value", (snapshot) => renderDmOpposedLive(snapshot.val() || {}));
  }

  function processSessionDm(sessionId, session) {
    if (!session || String(session.roomKey || "default") !== roomKey() || state.processingSessions.has(sessionId)) return;
    if (session.status === "awaiting_threshold" && session.thresholdResult) {
      state.processingSessions.add(sessionId);
      issueResolverCommand(sessionId, session).finally(() => state.processingSessions.delete(sessionId));
    } else if (session.status === "awaiting_resolver" && session.resolverResult) {
      state.processingSessions.add(sessionId);
      finalizeOpposedSession(sessionId, session).finally(() => state.processingSessions.delete(sessionId));
    }
  }

  async function issueResolverCommand(sessionId, session) {
    const thresholdRaw = Number(session.thresholdResult?.total);
    if (!Number.isFinite(thresholdRaw)) throw new Error("El rival no produjo un Threshold válido.");
    await db.ref(`${OPPOSED_ROOT}/${sessionId}`).update({ status: "issuing_resolver" });

    const hidden = Boolean(session.checkTemplate?.hiddenThreshold);
    const commandRef = db.ref(`${COMMAND_ROOT}/${session.initiatorUid}`).push();
    await commandRef.set({
      schemaVersion: 1,
      targetUid: session.initiatorUid,
      targetPlayerId: session.initiatorPlayerId,
      targetName: session.initiatorName,
      roomKey: session.roomKey || roomKey(),
      requestedBy: "opposed",
      requestId: session.requestId || null,
      rollSpec: session.initiatorRollSpec,
      check: {
        thresholdRaw: hidden ? null : thresholdRaw,
        hiddenThreshold: hidden,
        modifierType: session.checkTemplate?.modifierType || "neutral",
        modifierValue: Math.max(0, Math.trunc(numberOr(session.checkTemplate?.modifierValue, 0))),
        tipText: String(session.checkTemplate?.tipText || ""),
        opposedSessionId: sessionId,
        opposedPhase: "resolver",
      },
      status: "issued",
      issuedAt: firebase.database.ServerValue.TIMESTAMP,
      clientIssuedAt: Date.now(),
    });

    await db.ref(`${OPPOSED_ROOT}/${sessionId}`).update({
      status: "awaiting_resolver",
      resolverCommandId: commandRef.key,
      thresholdEffective: effectiveThreshold(thresholdRaw, session.checkTemplate),
      thresholdCapturedAt: firebase.database.ServerValue.TIMESTAMP,
    });
  }

  async function finalizeOpposedSession(sessionId, session) {
    const thresholdRaw = Number(session.thresholdResult?.total);
    const resolverTotal = Number(session.resolverResult?.total);
    if (!Number.isFinite(thresholdRaw) || !Number.isFinite(resolverTotal)) throw new Error("Resultado enfrentado incompleto.");
    await db.ref(`${OPPOSED_ROOT}/${sessionId}`).update({ status: "finalizing" });

    const check = {
      thresholdRaw,
      hiddenThreshold: Boolean(session.checkTemplate?.hiddenThreshold),
      modifierType: session.checkTemplate?.modifierType || "neutral",
      modifierValue: Math.max(0, Math.trunc(numberOr(session.checkTemplate?.modifierValue, 0))),
      tipText: String(session.checkTemplate?.tipText || ""),
    };
    const outcome = outcomeFor(resolverTotal, thresholdRaw, check);
    const effective = effectiveThreshold(thresholdRaw, check);

    const published = await global.LuminousTheatreRolls?.publishRoll?.({
      roller: {
        uid: session.initiatorUid,
        actorId: session.initiatorPlayerId || null,
        name: session.initiatorName,
      },
      label: session.initiatorRollSpec?.label || "Opposed Check",
      base: numberOr(session.resolverResult?.base, resolverTotal),
      total: resolverTotal,
      coins: Array.isArray(session.resolverResult?.coins) ? session.resolverResult.coins : [],
      check,
    });
    if (published && published.published === false) throw new Error(`No se pudo publicar el resultado: ${published.reason || "unknown"}`);

    const publicForInitiator = {
      sessionId,
      role: "initiator",
      opponentName: session.rivalName,
      outcome,
      ownTotal: resolverTotal,
      thresholdHidden: Boolean(check.hiddenThreshold),
      threshold: check.hiddenThreshold ? null : effective,
      completedAt: firebase.database.ServerValue.TIMESTAMP,
      clientCompletedAt: Date.now(),
    };
    const publicForRival = {
      sessionId,
      role: "rival",
      opponentName: session.initiatorName,
      outcome,
      initiatorTotal: resolverTotal,
      threshold: thresholdRaw,
      completedAt: firebase.database.ServerValue.TIMESTAMP,
      clientCompletedAt: Date.now(),
    };
    const updates = {};
    updates[`${RESULT_ROOT}/${session.initiatorUid}/${sessionId}`] = publicForInitiator;
    updates[`${RESULT_ROOT}/${session.rivalUid}/${sessionId}`] = publicForRival;
    updates[`${OPPOSED_ROOT}/${sessionId}/status`] = "complete";
    updates[`${OPPOSED_ROOT}/${sessionId}/outcome`] = outcome;
    updates[`${OPPOSED_ROOT}/${sessionId}/finalThreshold`] = effective;
    updates[`${OPPOSED_ROOT}/${sessionId}/finalizedAt`] = firebase.database.ServerValue.TIMESTAMP;
    await db.ref().update(updates);
  }

  function bindPlayerCommands() {
    if (isDm()) return;
    const uid = currentUid();
    if (!uid) return;
    db.ref(`${COMMAND_ROOT}/${uid}`).limitToLast(20).on("child_added", (snapshot) => {
      const command = snapshot.val() || {};
      if (!command?.check?.opposedSessionId || String(command.roomKey || "default") !== roomKey()) return;
      if (Date.now() - numberOr(command.clientIssuedAt, Date.now()) > MAX_AGE_MS) return;
      state.latestOpposedCommand = { key: snapshot.key, command };
      decorateExistingPrompt();
    });
  }

  function decorateExistingPrompt() {
    if (isDm()) return;
    const prompt = $("theatre-check-command-prompt");
    const active = state.latestOpposedCommand;
    if (!prompt || !active) return;
    const phase = active.command?.check?.opposedPhase;
    prompt.dataset.opposedSessionId = active.command.check.opposedSessionId;
    prompt.dataset.opposedPhase = phase;
    const kicker = prompt.querySelector(":scope > span");
    const title = prompt.querySelector(":scope > strong");
    const meta = prompt.querySelector(":scope > small");
    if (phase === "threshold") {
      if (kicker) kicker.textContent = "TIRADA ENFRENTADA · GENERA THRESHOLD";
      if (title) title.textContent = active.command.rollSpec?.label || "RIVAL ROLL";
      if (meta) meta.textContent = "TU RESULTADO SERÁ EL THRESHOLD DEL RIVAL";
    } else if (phase === "resolver") {
      if (kicker) kicker.textContent = "TIRADA ENFRENTADA · RESUELVE CHECK";
      if (meta) meta.textContent = active.command.check.hiddenThreshold
        ? "THRESHOLD ???"
        : `THRESHOLD ${effectiveThreshold(active.command.check.thresholdRaw, active.command.check)}`;
    }
  }

  function installPromptBridge() {
    if (isDm()) return;
    const root = coordinator()?.ensureFrontLayer?.() || doc.body;
    if (!root || state.promptObserver) return;
    state.promptObserver = new MutationObserver(decorateExistingPrompt);
    state.promptObserver.observe(root, { childList: true, subtree: true });
    doc.addEventListener("click", (event) => {
      const button = event.target?.closest?.("#theatre-check-command-prompt button");
      const prompt = button?.closest?.("#theatre-check-command-prompt");
      const active = state.latestOpposedCommand;
      if (!button || !prompt?.dataset?.opposedSessionId || !active) return;
      prepareOpposedRoll(active);
    }, true);
  }

  function beginVisualizerIsolation() {
    endVisualizerIsolation();
    const panel = $("coin-toss-panel");
    const original = $("coin-toss-close-btn");
    if (panel) {
      panel.style.display = "none";
      state.panelObserver = new MutationObserver(() => {
        if (doc.body?.classList?.contains("theatre-opposed-roll-active") && panel.style.display !== "none") {
          panel.style.display = "none";
        }
      });
      state.panelObserver.observe(panel, { attributes: true, attributeFilter: ["style"] });
    }
    if (original?.parentNode) {
      const clone = original.cloneNode(true);
      original.parentNode.replaceChild(clone, original);
      state.isolatedCloseButton = { original, clone };
    }
  }

  function endVisualizerIsolation() {
    state.panelObserver?.disconnect();
    state.panelObserver = null;
    const isolated = state.isolatedCloseButton;
    if (isolated?.clone?.parentNode) isolated.clone.parentNode.replaceChild(isolated.original, isolated.clone);
    state.isolatedCloseButton = null;
  }

  function prepareOpposedRoll(active) {
    state.activeCommand = active;
    doc.body?.classList?.add("theatre-opposed-roll-active");
    doc.body?.classList?.toggle("theatre-opposed-threshold-active", active.command.check.opposedPhase === "threshold");
    doc.body?.classList?.toggle("theatre-opposed-resolver-active", active.command.check.opposedPhase === "resolver");
    beginVisualizerIsolation();
    global.setTimeout(() => global.LuminousTheatreRolls?.clearArmedCheck?.(), 0);
    renderLocalHud(active.command);
  }

  function coinImage(side, pending) {
    const img = doc.createElement("img");
    img.className = `theatre-opposed-coin${pending ? " is-pending" : ""}`;
    img.src = side === "head" ? HEAD_SRC : TAIL_SRC;
    img.alt = pending ? "Pending coin" : side === "head" ? "Head" : "Tail";
    return img;
  }

  function renderCoinRow(container, coins) {
    if (!container) return;
    const map = new Map((coins || []).map((coin) => [Number(coin.index), coin]));
    container.replaceChildren();
    for (let index = 0; index < 5; index += 1) {
      const coin = map.get(index);
      container.appendChild(coinImage(coin?.side || "tail", !coin));
    }
  }

  function renderLocalHud(command) {
    const front = coordinator()?.ensureFrontLayer?.();
    if (!front) return;
    state.localHud?.remove();
    const phase = command.check?.opposedPhase;
    const hud = doc.createElement("article");
    hud.className = `theatre-opposed-hud is-${phase}`;
    hud.dataset.sessionId = command.check.opposedSessionId;
    if (phase === "threshold") {
      hud.innerHTML = `
        <div class="theatre-opposed-caption">ENFRENTADA · GENERANDO THRESHOLD</div>
        <div class="theatre-opposed-coins" data-opposed-coins></div>
        <div class="theatre-opposed-threshold"><span>THRESHOLD</span><strong data-opposed-total>—</strong></div>
        <div class="theatre-opposed-status" data-opposed-status>ROLLING 0 / 5</div>`;
    } else {
      const threshold = command.check.hiddenThreshold ? "??" : effectiveThreshold(command.check.thresholdRaw, command.check);
      hud.innerHTML = `
        <div class="theatre-opposed-caption">ENFRENTADA · ${String(command.rollSpec?.label || "CHECK").toUpperCase()}</div>
        <div class="theatre-opposed-coins" data-opposed-coins></div>
        <div class="theatre-opposed-compare">
          <div><span>THRESHOLD</span><strong class="threshold" data-opposed-threshold>${threshold ?? "—"}</strong></div>
          <b>VS</b>
          <div><span>OUTCOME</span><strong data-opposed-total>—</strong></div>
        </div>
        <div class="theatre-opposed-status" data-opposed-status>ROLLING 0 / 5</div>`;
      if (numberOr(command.check.modifierValue, 0) > 0 && command.check.tipText) {
        const tip = doc.createElement("div");
        tip.className = "theatre-opposed-tip";
        const sign = command.check.modifierType === "advantage" ? "-" : "+";
        tip.textContent = `${command.check.modifierType === "advantage" ? "ADVANTAGE" : "DISADVANTAGE"} ${sign}${command.check.modifierValue} · ${command.check.tipText}`;
        hud.prepend(tip);
      }
    }
    front.appendChild(hud);
    state.localHud = hud;
  }

  function bindOwnLive() {
    if (isDm()) return;
    const uid = currentUid();
    if (!uid) return;
    db.ref(`${LIVE_ROOT}/${uid}`).on("value", (snapshot) => {
      const byCommand = snapshot.val() || {};
      const entries = Object.entries(byCommand)
        .map(([key, live]) => ({ key, ...live }))
        .filter((live) => live?.check?.opposedSessionId && String(live.roomKey || "default") === roomKey())
        .sort((a, b) => numberOr(b.clientUpdatedAt) - numberOr(a.clientUpdatedAt));
      const live = entries[0];
      if (!live || !state.activeCommand || live.check.opposedSessionId !== state.activeCommand.command.check.opposedSessionId) return;
      updateLocalHud(live);
      if (live.status === "complete") persistOpposedPhaseResult(live).catch((error) => console.error("No se pudo registrar la fase enfrentada:", error));
    });
  }

  function updateLocalHud(live) {
    const hud = state.localHud;
    if (!hud) return;
    renderCoinRow(hud.querySelector("[data-opposed-coins]"), live.coins || []);
    const total = hud.querySelector("[data-opposed-total]");
    if (total) total.textContent = String(numberOr(live.total, 0));
    const status = hud.querySelector("[data-opposed-status]");
    if (!status) return;
    if (live.status !== "complete") {
      status.textContent = `ROLLING ${numberOr(live.resolved, 0)} / 5`;
      return;
    }
    if (live.check?.opposedPhase === "threshold") {
      status.textContent = "THRESHOLD REGISTRADO";
      status.classList.add("is-pass");
    } else {
      status.textContent = "ESPERANDO RESULTADO DEL DM";
    }
  }

  async function persistOpposedPhaseResult(live) {
    const sessionId = live.check?.opposedSessionId;
    const phase = live.check?.opposedPhase;
    if (!sessionId || !phase) return;
    const marker = `luminousOpposed:${sessionId}:${phase}:written`;
    if (global.sessionStorage?.getItem(marker) === "1") return;
    const heads = (live.coins || []).filter((coin) => coin.side === "head").length;
    const result = {
      uid: currentUid(),
      total: numberOr(live.total, 0),
      base: numberOr(live.total, 0) - (heads * 4),
      heads,
      coins: Array.isArray(live.coins) ? live.coins : [],
      rollerClientId: global.LuminousTheatreRolls?.getClientId?.() || null,
      completedAt: firebase.database.ServerValue.TIMESTAMP,
      clientCompletedAt: Date.now(),
    };
    const child = phase === "threshold" ? "thresholdResult" : "resolverResult";
    await db.ref(`${OPPOSED_ROOT}/${sessionId}/${child}`).set(result);
    global.sessionStorage?.setItem(marker, "1");
    endVisualizerIsolation();
    if (phase === "threshold") {
      global.setTimeout(clearLocalOpposedHud, 2200);
    }
  }

  function clearLocalOpposedHud() {
    state.localHud?.remove();
    state.localHud = null;
    state.activeCommand = null;
    doc.body?.classList?.remove("theatre-opposed-roll-active", "theatre-opposed-threshold-active", "theatre-opposed-resolver-active");
  }

  function bindResultsPlayer() {
    if (isDm()) return;
    const uid = currentUid();
    if (!uid) return;
    db.ref(`${RESULT_ROOT}/${uid}`).on("child_added", (snapshot) => {
      const result = snapshot.val() || {};
      if (!result.sessionId || state.resultKeys.has(snapshot.key)) return;
      state.resultKeys.add(snapshot.key);
      const age = Date.now() - numberOr(result.clientCompletedAt, Date.now());
      if (age > MAX_AGE_MS) return;
      if (result.role === "initiator") {
        const hud = state.localHud;
        if (hud?.dataset?.sessionId === result.sessionId) {
          const status = hud.querySelector("[data-opposed-status]");
          if (status) {
            status.textContent = result.outcome === "passed" ? "CHECK PASSED" : "CHECK FAILED";
            status.classList.toggle("is-pass", result.outcome === "passed");
            status.classList.toggle("is-fail", result.outcome !== "passed");
          }
          global.setTimeout(clearLocalOpposedHud, 4200);
        }
        cleanupOwnRemoteResult();
      } else {
        const front = coordinator()?.ensureFrontLayer?.();
        if (front) {
          const notice = doc.createElement("div");
          notice.className = `theatre-opposed-result-notice ${result.outcome === "passed" ? "is-pass" : "is-fail"}`;
          notice.textContent = `${result.opponentName || "RIVAL"} · ${result.outcome === "passed" ? "CHECK PASSED" : "CHECK FAILED"}`;
          front.appendChild(notice);
          global.setTimeout(() => notice.remove(), 4200);
        }
      }
    });
  }

  function cleanupOwnRemoteResult() {
    const ownName = String(global.datosJugador?.characterName || global.datosJugador?.character_name || global.datosJugador?.nombre || "").trim().toLowerCase();
    if (!ownName) return;
    const remove = () => {
      doc.querySelectorAll(".theatre-roll-result-card").forEach((card) => {
        if (String(card.textContent || "").toLowerCase().includes(ownName)) card.remove();
      });
    };
    global.setTimeout(remove, 100);
    global.setTimeout(remove, 500);
  }

  function renderDmOpposedLive(root) {
    if (!isDm()) return;
    const entries = [];
    Object.values(root || {}).forEach((byCommand) => {
      Object.values(byCommand || {}).forEach((live) => {
        if (!live?.check?.opposedSessionId || String(live.roomKey || "default") !== roomKey()) return;
        if (Date.now() - numberOr(live.clientUpdatedAt, 0) > 20000) return;
        entries.push(live);
      });
    });
    entries.sort((a, b) => numberOr(b.clientUpdatedAt) - numberOr(a.clientUpdatedAt));
    const live = entries[0];
    state.dmHud?.remove();
    state.dmHud = null;
    doc.body?.classList?.toggle("theatre-opposed-dm-live", Boolean(live));
    if (!live) return;
    const session = state.sessions[live.check.opposedSessionId];
    const front = coordinator()?.ensureFrontLayer?.();
    if (!front || !session) return;
    const phase = live.check.opposedPhase;
    const hud = doc.createElement("article");
    hud.className = `theatre-opposed-hud theatre-opposed-hud--dm is-${phase}`;
    if (phase === "threshold") {
      hud.innerHTML = `
        <div class="theatre-opposed-caption">DM · ${String(session.rivalName || "RIVAL").toUpperCase()} · GENERA THRESHOLD</div>
        <div class="theatre-opposed-coins" data-opposed-coins></div>
        <div class="theatre-opposed-threshold"><span>THRESHOLD</span><strong data-opposed-total>${numberOr(live.total, 0)}</strong></div>
        <div class="theatre-opposed-status">${live.status === "complete" ? "THRESHOLD REGISTRADO" : `ROLLING ${numberOr(live.resolved, 0)} / 5`}</div>`;
    } else {
      const raw = Number(session.thresholdResult?.total);
      const threshold = effectiveThreshold(raw, session.checkTemplate);
      const outcome = live.status === "complete" ? outcomeFor(live.total, raw, session.checkTemplate) : null;
      hud.innerHTML = `
        <div class="theatre-opposed-caption">DM · ${String(session.initiatorName || "PLAYER").toUpperCase()} · ${String(session.initiatorRollSpec?.label || "CHECK").toUpperCase()}</div>
        <div class="theatre-opposed-coins" data-opposed-coins></div>
        <div class="theatre-opposed-compare"><div><span>THRESHOLD</span><strong class="threshold">${threshold ?? "—"}</strong></div><b>${outcome === "passed" ? "≤" : outcome === "failed" ? ">" : "VS"}</b><div><span>OUTCOME</span><strong>${numberOr(live.total, 0)}</strong></div></div>
        <div class="theatre-opposed-status ${outcome === "passed" ? "is-pass" : outcome === "failed" ? "is-fail" : ""}">${live.status === "complete" ? (outcome === "passed" ? "CHECK PASSED" : "CHECK FAILED") : `ROLLING ${numberOr(live.resolved, 0)} / 5`}</div>`;
    }
    renderCoinRow(hud.querySelector("[data-opposed-coins]"), live.coins || []);
    front.appendChild(hud);
    state.dmHud = hud;
  }

  function boot() {
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (!coordinator()) {
        if (attempts > 200) global.clearInterval(timer);
        return;
      }
      if (state.mounted) {
        global.clearInterval(timer);
        return;
      }
      state.mounted = true;
      if (isDm()) {
        let dmAttempts = 0;
        const dmTimer = global.setInterval(() => {
          dmAttempts += 1;
          if (mountDmUi() || dmAttempts > 180) global.clearInterval(dmTimer);
        }, 100);
      } else {
        bindPlayerCommands();
        installPromptBridge();
        bindOwnLive();
        bindResultsPlayer();
      }
      global.clearInterval(timer);
    }, 100);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousTheatreOpposedChecks = Object.freeze({
    OPPOSED_ROOT,
    RESULT_ROOT,
    effectiveThreshold,
    outcomeFor,
  });
})(window);
