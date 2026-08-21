(function (global) {
  "use strict";

  const doc = global.document;
  const firebase = global.firebase;
  if (!doc || !firebase?.database || global.LuminousTheatreCheckCoordinator) return;

  const db = firebase.database();
  const DM_UID = "e9JwFZrtk6g8UMqq2Hf9EHVY7Ay1";
  const REQUEST_ROOT = "theatre_check_requests";
  const COMMAND_ROOT = "theatre_check_commands";
  const LIVE_ROOT = "theatre_check_live";
  const COMMAND_MAX_AGE_MS = 10 * 60 * 1000;
  const LIVE_MAX_AGE_MS = 20 * 1000;
  const HEAD_SRC = "https://imgur.com/yshLPnQ.png";
  const TAIL_SRC = "https://imgur.com/XDx0ICt.png";

  const ABILITIES = Object.freeze([
    { id: "str", key: "fuerza", code: "STR", name: "STRENGTH", skills: [{ id: "athletics", name: "Athletics" }] },
    { id: "dex", key: "destreza", code: "DEX", name: "DEXTERITY", skills: [
      { id: "acrobatics", name: "Acrobatics" }, { id: "sleight_of_hand", name: "Sleight of Hand" }, { id: "stealth", name: "Stealth" },
    ] },
    { id: "con", key: "constitucion", code: "CON", name: "CONSTITUTION", skills: [] },
    { id: "int", key: "inteligencia", code: "INT", name: "INTELLIGENCE", skills: [
      { id: "arcana", name: "Arcana" }, { id: "history", name: "History" }, { id: "investigation", name: "Investigation" }, { id: "nature", name: "Nature" }, { id: "religion", name: "Religion" },
    ] },
    { id: "wis", key: "sabiduria", code: "WIS", name: "WISDOM", skills: [
      { id: "animal_handling", name: "Animal Handling" }, { id: "insight", name: "Insight" }, { id: "medicine", name: "Medicine" }, { id: "perception", name: "Perception" }, { id: "survival", name: "Survival" },
    ] },
    { id: "cha", key: "carisma", code: "CHA", name: "CHARISMA", skills: [
      { id: "deception", name: "Deception" }, { id: "intimidation", name: "Intimidation" }, { id: "performance", name: "Performance" }, { id: "persuasion", name: "Persuasion" },
    ] },
  ]);

  const PROFICIENCY_MULTIPLIER = Object.freeze({ none: 0, half: 0.5, proficient: 1, expertise: 2 });
  const state = {
    mounted: false,
    players: {},
    pendingRequests: {},
    knownRequestKeys: new Set(),
    editingRequestId: null,
    authorizedElement: null,
    activeCommand: null,
    commandQueue: [],
    commandPromptOpen: false,
    liveObserver: null,
    liveUpdateTimer: null,
    frontObserver: null,
    dmLiveHud: null,
    playerCommandsBound: false,
  };

  const $ = (id) => doc.getElementById(id);
  const currentUid = () => firebase.auth?.().currentUser?.uid || null;
  const isDm = () => currentUid() === DM_UID || doc.body?.classList?.contains("on-game-dashboard");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const parseSigned = (value) => {
    const match = String(value ?? "").replace(/,/g, "").match(/[+-]?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : 0;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const abilityById = (id) => ABILITIES.find((ability) => ability.id === id) || ABILITIES[0];
  const skillById = (ability, id) => ability?.skills?.find((skill) => skill.id === id) || null;

  function roomKey() {
    return String(doc.body?.dataset?.theatreRoomId || "default").replace(/[.#$\[\]\/]/g, "_") || "default";
  }

  function theatreRoot() {
    if (doc.body?.classList?.contains("on-game-dashboard")) {
      return doc.querySelector("#modulo-teatro .stage-view-wrapper") || doc.getElementById("modulo-teatro");
    }
    return doc.getElementById("theatre-view-player");
  }

  function playerTheatreActive() {
    const view = doc.getElementById("theatre-view-player");
    if (!view) return false;
    if (doc.body?.classList?.contains("player-instance-theatre")) return true;
    return view.style.display !== "none" && view.getAttribute("aria-hidden") !== "true";
  }

  function ensureFrontLayer() {
    const root = theatreRoot();
    if (!root) return null;
    let layer = root.querySelector(":scope > #theatre-check-front-layer");
    if (!layer) {
      layer = doc.createElement("div");
      layer.id = "theatre-check-front-layer";
      layer.className = "theatre-check-front-layer";
      layer.setAttribute("aria-live", "polite");
      root.appendChild(layer);
    }
    return layer;
  }

  function moveRollChildrenToFront() {
    const front = ensureFrontLayer();
    if (!front) return;
    [$("theatre-roll-layer"), $("dm-npc-roll-local-layer")].filter(Boolean).forEach((source) => {
      Array.from(source.children).forEach((child) => {
        if (child.classList.contains("theatre-check-hud") || child.classList.contains("theatre-roll-result-card") || child.classList.contains("dm-npc-roll-hud")) {
          front.appendChild(child);
        }
      });
    });
  }

  function installFrontLayerBridge() {
    const root = theatreRoot();
    if (!root || state.frontObserver) return Boolean(root);
    ensureFrontLayer();
    moveRollChildrenToFront();
    state.frontObserver = new MutationObserver(() => moveRollChildrenToFront());
    state.frontObserver.observe(root, { childList: true, subtree: true });
    return true;
  }

  function playerIdentity() {
    const data = global.datosJugador || {};
    return {
      uid: currentUid(),
      playerId: global.localStorage?.getItem("playerId") || data.playerId || data.id || "",
      actorId: data.actorId || data.vinculo_jugador || null,
      name: String(data.characterName || data.character_name || data.nombre || data.name || "PLAYER").trim() || "PLAYER",
    };
  }

  function rollSpecFromTarget(target) {
    const panel = target?.closest?.(".player-ability-console") || doc.querySelector("#stats-modal .player-ability-console");
    if (!panel) return null;
    const ability = abilityById(panel.dataset.activeStat || "str");
    const kind = target.dataset.dndRoll;
    if (!kind) return null;

    if (kind === "ability") {
      const modifier = parseSigned(panel.querySelector("[data-stat-modifier]")?.textContent);
      const proficiency = parseSigned(panel.querySelector("[data-stat-prof-value]")?.textContent);
      return { kind, abilityId: ability.id, skillId: null, label: ability.name, basePreview: modifier + proficiency };
    }
    if (kind === "save") {
      return { kind, abilityId: ability.id, skillId: null, label: `${ability.name} Saving Throw`, basePreview: parseSigned(panel.querySelector("[data-stat-save]")?.textContent) };
    }
    if (kind === "skill") {
      const skill = skillById(ability, target.dataset.skillId);
      if (!skill) return null;
      return { kind, abilityId: ability.id, skillId: skill.id, label: skill.name, basePreview: parseSigned(target.querySelector(".dnd-skill-value")?.textContent) };
    }
    return null;
  }

  function playerNotice(title, copy, mode = "pending") {
    const layer = ensureFrontLayer();
    if (!layer) return null;
    let notice = $("theatre-check-player-notice");
    if (!notice) {
      notice = doc.createElement("section");
      notice.id = "theatre-check-player-notice";
      notice.className = "theatre-check-player-notice";
      layer.appendChild(notice);
    }
    notice.dataset.mode = mode;
    notice.replaceChildren();
    const strong = doc.createElement("strong");
    strong.textContent = title;
    const small = doc.createElement("span");
    small.textContent = copy;
    notice.append(strong, small);
    return notice;
  }

  async function requestPlayerRoll(target) {
    const identity = playerIdentity();
    const rollSpec = rollSpecFromTarget(target);
    if (!identity.uid || !rollSpec) return false;

    const requestRef = db.ref(REQUEST_ROOT).push();
    await requestRef.set({
      schemaVersion: 1,
      requesterUid: identity.uid,
      playerId: identity.playerId || null,
      actorId: identity.actorId || null,
      playerName: identity.name,
      roomKey: roomKey(),
      status: "pending",
      rollSpec,
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      clientCreatedAt: Date.now(),
    });

    playerNotice("SOLICITUD ENVIADA AL DM", `${rollSpec.label} · esperando aprobación`, "pending");
    const listener = (snapshot) => {
      const value = snapshot.val() || {};
      if (value.status === "denied") {
        playerNotice("SOLICITUD RECHAZADA", `${rollSpec.label} · el DM no autorizó la tirada`, "denied");
        global.setTimeout(() => $("theatre-check-player-notice")?.remove(), 3200);
        requestRef.off("value", listener);
      } else if (value.status === "approved") {
        playerNotice("TIRADA APROBADA", `${rollSpec.label} · esperando instrucción`, "approved");
        requestRef.off("value", listener);
      }
    };
    requestRef.on("value", listener);
    return true;
  }

  function installPlayerRollGate() {
    if (isDm()) return;
    doc.addEventListener("click", (event) => {
      const target = event.target?.closest?.(".player-dnd-roll");
      if (!target || !playerTheatreActive()) return;
      if (state.authorizedElement === target) {
        state.authorizedElement = null;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      requestPlayerRoll(target).catch((error) => {
        console.error("No se pudo solicitar la tirada al DM:", error);
        playerNotice("ERROR DE SOLICITUD", "No se pudo contactar al Director", "denied");
      });
    }, true);
  }

  function normalizeProfState(value) {
    const normalized = String(value || "none").toLowerCase();
    return Object.prototype.hasOwnProperty.call(PROFICIENCY_MULTIPLIER, normalized) ? normalized : "none";
  }

  function playerProficiencyBonus(player) {
    return Math.ceil(Math.max(0, numberOr(player?.level, 1)) / 20);
  }

  function playerRollPreview(player, spec) {
    if (!player || !spec) return { base: 0, headsChance: 50 };
    const ability = abilityById(spec.abilityId);
    const score = numberOr(player?.stats?.[ability.key], 10);
    const modifier = Math.floor((score - 10) / 2);
    const profBonus = playerProficiencyBonus(player);
    const abilityState = normalizeProfState(player?.abilityProficiency?.[ability.id] ?? player?.abilityProficiency?.[ability.key]);
    const abilityProf = Math.floor(profBonus * PROFICIENCY_MULTIPLIER[abilityState]);
    let base = modifier + abilityProf;

    if (spec.kind === "skill") {
      const skill = skillById(ability, spec.skillId);
      const stored = player?.dndSkills?.[skill?.id]?.value;
      if (Number.isFinite(Number(stored))) base = Number(stored);
      else {
        const skillState = normalizeProfState(player?.skillProficiency?.[skill?.id] ?? player?.dndSkills?.[skill?.id]?.proficiency ?? player?.dndSkills?.[skill?.id]?.proficiencyState);
        base = modifier + Math.floor(profBonus * PROFICIENCY_MULTIPLIER[skillState]);
      }
    }
    const sp = numberOr(player?.combatStats?.sp_actual ?? player?.sp, 0);
    return { base, headsChance: clamp(50 + sp, 5, 95) };
  }

  function playerLabel(playerId, player) {
    return String(player?.characterName || player?.character_name || player?.nombre || player?.name || playerId || "PLAYER");
  }

  function mountDmConsole() {
    if (!isDm()) return false;
    const director = $("theatre-director-panel");
    if (!director) return false;
    if ($("theatre-check-director")) return true;

    const panel = doc.createElement("section");
    panel.id = "theatre-check-director";
    panel.className = "theatre-check-director";
    panel.innerHTML = `
      <header class="theatre-check-director-header"><div><strong>CHECK DIRECTOR</strong><span>PLAYER REQUEST / CONTROL</span></div><b id="theatre-check-pending-count">0</b></header>
      <div id="theatre-check-request-list" class="theatre-check-request-list"><div class="theatre-check-empty">SIN SOLICITUDES PENDIENTES</div></div>
      <div class="theatre-check-compose">
        <div class="theatre-check-compose-title"><span id="theatre-check-compose-mode">NUEVO CHECK</span><button id="theatre-check-compose-reset" type="button">LIMPIAR</button></div>
        <div class="theatre-check-compose-grid">
          <label class="wide"><span>JUGADOR</span><select id="theatre-check-target-player"><option value="">SIN JUGADORES</option></select></label>
          <label><span>TIRADA</span><select id="theatre-check-kind"><option value="ability">ABILITY</option><option value="save">SAVING THROW</option><option value="skill">SKILL</option></select></label>
          <label><span>STAT</span><select id="theatre-check-ability"></select></label>
          <label class="wide" id="theatre-check-skill-field" hidden><span>SKILL</span><select id="theatre-check-skill"></select></label>
          <label><span>THRESHOLD</span><input id="theatre-check-threshold" type="number" min="0" step="1" placeholder="—"></label>
          <label><span>MODIFIER</span><select id="theatre-check-modifier"><option value="neutral">NEUTRAL</option><option value="advantage">ADVANTAGE</option><option value="disadvantage">DISADVANTAGE</option></select></label>
          <label><span>X</span><input id="theatre-check-x" type="number" min="0" step="1" value="0"></label>
          <label class="theatre-check-hidden"><input id="theatre-check-hidden-threshold" type="checkbox"><span>THRESHOLD OCULTO</span></label>
          <label class="wide"><span>TIP / RAZÓN</span><input id="theatre-check-tip" type="text" maxlength="180" placeholder="Opcional"></label>
        </div>
        <div class="theatre-check-compose-preview"><span id="theatre-check-compose-label">SELECT PLAYER</span><b id="theatre-check-compose-base">—</b><small id="theatre-check-compose-heads">— HEADS</small></div>
        <div class="theatre-check-compose-actions"><button id="theatre-check-deny" type="button" hidden>RECHAZAR</button><button id="theatre-check-send" type="button">ENVIAR CHECK</button></div>
      </div>`;

    const npcPanel = $("theatre-npc-roll-director");
    const composer = director.querySelector(".theatre-controls");
    if (npcPanel) director.insertBefore(panel, npcPanel);
    else if (composer) director.insertBefore(panel, composer);
    else director.prepend(panel);

    const abilitySelect = $("theatre-check-ability");
    ABILITIES.forEach((ability) => {
      const option = doc.createElement("option");
      option.value = ability.id;
      option.textContent = `${ability.code} · ${ability.name}`;
      abilitySelect.appendChild(option);
    });

    ["theatre-check-target-player", "theatre-check-kind", "theatre-check-ability", "theatre-check-skill"].forEach((id) => {
      $(id)?.addEventListener("change", () => {
        if (id === "theatre-check-kind" || id === "theatre-check-ability") syncDmSkillField();
        refreshDmPreview();
      });
    });
    $("theatre-check-compose-reset")?.addEventListener("click", resetDmComposer);
    $("theatre-check-send")?.addEventListener("click", () => issueDmCommand().catch((error) => console.error("No se pudo enviar el Check:", error)));
    $("theatre-check-deny")?.addEventListener("click", () => denyEditingRequest().catch((error) => console.error("No se pudo rechazar la solicitud:", error)));

    syncDmSkillField();
    bindDmPlayers();
    bindDmRequests();
    bindDmLive();
    installDmBadge();
    return true;
  }

  function bindDmPlayers() {
    db.ref("campaña/jugadores").on("value", (snapshot) => {
      state.players = snapshot.val() || {};
      const select = $("theatre-check-target-player");
      if (!select) return;
      const previous = select.value;
      select.replaceChildren();
      Object.entries(state.players)
        .filter(([, player]) => player?.uid && player.uid !== DM_UID && player.status !== "pending")
        .sort((a, b) => playerLabel(a[0], a[1]).localeCompare(playerLabel(b[0], b[1])))
        .forEach(([playerId, player]) => {
          const option = doc.createElement("option");
          option.value = player.uid;
          option.dataset.playerId = playerId;
          option.textContent = playerLabel(playerId, player);
          select.appendChild(option);
        });
      if (!select.options.length) {
        const option = doc.createElement("option");
        option.value = "";
        option.textContent = "SIN JUGADORES";
        select.appendChild(option);
      } else if (Array.from(select.options).some((option) => option.value === previous)) {
        select.value = previous;
      }
      refreshDmPreview();
    });
  }

  function installDmBadge() {
    const summary = doc.querySelector(".theatre-dm-menu-toggle");
    if (!summary || $("theatre-check-request-badge")) return;
    const badge = doc.createElement("span");
    badge.id = "theatre-check-request-badge";
    badge.className = "theatre-check-request-badge";
    badge.textContent = "0";
    summary.appendChild(badge);
  }

  function updateDmBadge(count) {
    const badge = $("theatre-check-request-badge");
    if (badge) {
      badge.textContent = String(count);
      badge.classList.toggle("is-visible", count > 0);
    }
    const countNode = $("theatre-check-pending-count");
    if (countNode) countNode.textContent = String(count);
  }

  function notifyDm(request) {
    const front = ensureFrontLayer();
    if (!front) return;
    const toast = doc.createElement("div");
    toast.className = "theatre-check-dm-toast";
    const strong = doc.createElement("strong");
    strong.textContent = "SOLICITUD DE CHECK";
    const span = doc.createElement("span");
    span.textContent = `${request.playerName || "PLAYER"} · ${request.rollSpec?.label || "TIRADA"}`;
    toast.append(strong, span);
    front.appendChild(toast);
    global.setTimeout(() => toast.remove(), 4200);
  }

  function bindDmRequests() {
    db.ref(REQUEST_ROOT).on("value", (snapshot) => {
      const all = snapshot.val() || {};
      const pending = {};
      Object.entries(all).forEach(([key, request]) => {
        if (request?.status !== "pending" || String(request.roomKey || "default") !== roomKey()) return;
        pending[key] = request;
        if (!state.knownRequestKeys.has(key)) {
          if (state.knownRequestKeys.size) notifyDm(request);
          state.knownRequestKeys.add(key);
        }
      });
      state.pendingRequests = pending;
      renderDmRequests();
      updateDmBadge(Object.keys(pending).length);
    });
  }

  function renderDmRequests() {
    const host = $("theatre-check-request-list");
    if (!host) return;
    host.replaceChildren();
    const entries = Object.entries(state.pendingRequests).sort((a, b) => numberOr(a[1]?.clientCreatedAt) - numberOr(b[1]?.clientCreatedAt));
    if (!entries.length) {
      const empty = doc.createElement("div");
      empty.className = "theatre-check-empty";
      empty.textContent = "SIN SOLICITUDES PENDIENTES";
      host.appendChild(empty);
      return;
    }
    entries.forEach(([key, request]) => {
      const card = doc.createElement("article");
      card.className = "theatre-check-request-card";
      const copy = doc.createElement("div");
      const strong = doc.createElement("strong");
      strong.textContent = request.playerName || request.playerId || "PLAYER";
      const span = doc.createElement("span");
      const base = Number.isFinite(Number(request.rollSpec?.basePreview)) ? ` · BASE ${formatModifier(request.rollSpec.basePreview)}` : "";
      span.textContent = `${request.rollSpec?.label || "TIRADA"}${base}`;
      copy.append(strong, span);
      const open = doc.createElement("button");
      open.type = "button";
      open.textContent = "ABRIR";
      open.addEventListener("click", () => loadRequestIntoComposer(key, request));
      card.append(copy, open);
      host.appendChild(card);
    });
  }

  function formatModifier(value) {
    const numeric = numberOr(value, 0);
    return numeric >= 0 ? `+${numeric}` : String(numeric);
  }

  function syncDmSkillField() {
    const kind = $("theatre-check-kind")?.value || "ability";
    const ability = abilityById($("theatre-check-ability")?.value || "str");
    const field = $("theatre-check-skill-field");
    const select = $("theatre-check-skill");
    if (!field || !select) return;
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

  function selectedDmPlayer() {
    const uid = $("theatre-check-target-player")?.value || "";
    const entry = Object.entries(state.players).find(([, player]) => player?.uid === uid);
    return entry ? { uid, playerId: entry[0], player: entry[1] } : null;
  }

  function dmRollSpec() {
    const kind = $("theatre-check-kind")?.value || "ability";
    const ability = abilityById($("theatre-check-ability")?.value || "str");
    const skill = kind === "skill" ? skillById(ability, $("theatre-check-skill")?.value) : null;
    const label = kind === "ability" ? ability.name : kind === "save" ? `${ability.name} Saving Throw` : (skill?.name || "Skill");
    return { kind, abilityId: ability.id, skillId: skill?.id || null, label };
  }

  function dmCheck() {
    const rawText = String($("theatre-check-threshold")?.value || "").trim();
    const raw = rawText === "" ? null : Math.max(0, Math.trunc(numberOr(rawText, 0)));
    const x = Math.max(0, Math.trunc(numberOr($("theatre-check-x")?.value, 0)));
    return {
      thresholdRaw: raw,
      hiddenThreshold: Boolean($("theatre-check-hidden-threshold")?.checked),
      modifierType: x > 0 ? ($("theatre-check-modifier")?.value || "neutral") : "neutral",
      modifierValue: x,
      tipText: x > 0 ? String($("theatre-check-tip")?.value || "").trim().slice(0, 180) : "",
    };
  }

  function refreshDmPreview() {
    const selected = selectedDmPlayer();
    const spec = dmRollSpec();
    const preview = selected ? playerRollPreview(selected.player, spec) : null;
    const label = $("theatre-check-compose-label");
    const base = $("theatre-check-compose-base");
    const heads = $("theatre-check-compose-heads");
    if (label) label.textContent = selected ? `${playerLabel(selected.playerId, selected.player)} / ${spec.label}`.toUpperCase() : "SELECT PLAYER";
    if (base) base.textContent = preview ? formatModifier(preview.base) : "—";
    if (heads) heads.textContent = preview ? `${preview.headsChance}% HEADS` : "— HEADS";
  }

  function loadRequestIntoComposer(key, request) {
    state.editingRequestId = key;
    const target = $("theatre-check-target-player");
    if (target) target.value = request.requesterUid || "";
    const spec = request.rollSpec || {};
    if ($("theatre-check-kind")) $("theatre-check-kind").value = spec.kind || "ability";
    if ($("theatre-check-ability")) $("theatre-check-ability").value = spec.abilityId || "str";
    syncDmSkillField();
    if ($("theatre-check-skill") && spec.skillId) $("theatre-check-skill").value = spec.skillId;
    $("theatre-check-compose-mode").textContent = `SOLICITUD / ${request.playerName || "PLAYER"}`;
    $("theatre-check-send").textContent = "APROBAR Y ENVIAR";
    $("theatre-check-deny").hidden = false;
    refreshDmPreview();
  }

  function resetDmComposer() {
    state.editingRequestId = null;
    $("theatre-check-compose-mode").textContent = "NUEVO CHECK";
    $("theatre-check-send").textContent = "ENVIAR CHECK";
    $("theatre-check-deny").hidden = true;
    $("theatre-check-threshold").value = "";
    $("theatre-check-modifier").value = "neutral";
    $("theatre-check-x").value = "0";
    $("theatre-check-hidden-threshold").checked = false;
    $("theatre-check-tip").value = "";
    refreshDmPreview();
  }

  async function denyEditingRequest() {
    const requestId = state.editingRequestId;
    if (!requestId) return;
    await db.ref(`${REQUEST_ROOT}/${requestId}`).update({ status: "denied", decidedAt: firebase.database.ServerValue.TIMESTAMP });
    resetDmComposer();
  }

  async function issueDmCommand() {
    const selected = selectedDmPlayer();
    if (!selected) throw new Error("Selecciona un jugador.");
    const spec = dmRollSpec();
    if (spec.kind === "skill" && !spec.skillId) throw new Error("Selecciona una Skill válida.");
    const requestId = state.editingRequestId;
    const commandRef = db.ref(`${COMMAND_ROOT}/${selected.uid}`).push();
    const command = {
      schemaVersion: 1,
      targetUid: selected.uid,
      targetPlayerId: selected.playerId,
      targetName: playerLabel(selected.playerId, selected.player),
      roomKey: roomKey(),
      requestedBy: requestId ? "player" : "dm",
      requestId: requestId || null,
      rollSpec: spec,
      check: dmCheck(),
      status: "issued",
      issuedAt: firebase.database.ServerValue.TIMESTAMP,
      clientIssuedAt: Date.now(),
    };
    await commandRef.set(command);
    if (requestId) {
      await db.ref(`${REQUEST_ROOT}/${requestId}`).update({
        status: "approved",
        commandId: commandRef.key,
        decidedAt: firebase.database.ServerValue.TIMESTAMP,
      });
    }
    resetDmComposer();
    const feedback = doc.createElement("div");
    feedback.className = "theatre-check-sent-feedback";
    feedback.textContent = `${command.targetName} · ${spec.label} · ENVIADO`;
    $("theatre-check-director")?.appendChild(feedback);
    global.setTimeout(() => feedback.remove(), 2200);
  }

  function bindPlayerCommands() {
    if (isDm() || state.playerCommandsBound) return false;
    const uid = currentUid();
    if (!uid) return false;
    state.playerCommandsBound = true;
    db.ref(`${COMMAND_ROOT}/${uid}`).limitToLast(20).on("child_added", (snapshot) => {
      const command = snapshot.val() || {};
      if (command.targetUid !== uid || String(command.roomKey || "default") !== roomKey()) return;
      const age = Date.now() - numberOr(command.clientIssuedAt, Date.now());
      if (age > COMMAND_MAX_AGE_MS) return;
      const seenKey = `luminousTheatreCheck:${snapshot.key}`;
      if (global.sessionStorage?.getItem(seenKey) === "done") return;
      state.commandQueue.push({ key: snapshot.key, command, seenKey });
      showNextPlayerCommand();
    });
    return true;
  }

  function checkDisplay(check) {
    const raw = Number(check?.thresholdRaw);
    if (!Number.isFinite(raw)) return "SIN THRESHOLD";
    if (check?.hiddenThreshold) return "THRESHOLD ???";
    const x = Math.max(0, Math.trunc(numberOr(check?.modifierValue, 0)));
    const type = String(check?.modifierType || "neutral");
    const effective = type === "advantage" ? Math.max(0, raw - x) : type === "disadvantage" ? raw + x : raw;
    return `THRESHOLD ${effective}`;
  }

  function showNextPlayerCommand() {
    if (state.commandPromptOpen || !state.commandQueue.length) return;
    const item = state.commandQueue.shift();
    state.commandPromptOpen = true;
    const front = ensureFrontLayer();
    if (!front) {
      state.commandPromptOpen = false;
      return;
    }
    const prompt = doc.createElement("section");
    prompt.id = "theatre-check-command-prompt";
    prompt.className = "theatre-check-command-prompt";
    const kicker = doc.createElement("span");
    kicker.textContent = item.command.requestedBy === "player" ? "DM APROBÓ TU SOLICITUD" : "EL DM SOLICITA UNA TIRADA";
    const title = doc.createElement("strong");
    title.textContent = item.command.rollSpec?.label || "CHECK";
    const meta = doc.createElement("small");
    meta.textContent = checkDisplay(item.command.check);
    const button = doc.createElement("button");
    button.type = "button";
    button.textContent = "TIRAR";
    button.addEventListener("click", () => {
      button.disabled = true;
      executePlayerCommand(item).catch((error) => {
        console.error("No se pudo iniciar el Check autorizado:", error);
        playerNotice("ERROR AL INICIAR CHECK", String(error.message || error), "denied");
        state.commandPromptOpen = false;
        prompt.remove();
        showNextPlayerCommand();
      });
    });
    prompt.append(kicker, title, meta, button);
    front.appendChild(prompt);
  }

  function findPlayerRollTarget(spec) {
    const panel = doc.querySelector("#stats-modal .player-ability-console");
    if (!panel) return null;
    const abilityTab = panel.querySelector(`.player-ability[data-stat="${spec.abilityId || "str"}"]`);
    abilityTab?.click();
    if (spec.kind === "ability") return panel.querySelector(".player-stat-main.player-dnd-roll");
    if (spec.kind === "save") return panel.querySelector(".player-stat-save.player-dnd-roll");
    if (spec.kind === "skill") return panel.querySelector(`.dnd-skill.player-dnd-roll[data-skill-id="${spec.skillId || ""}"]`);
    return null;
  }

  async function executePlayerCommand(item) {
    const command = item.command;
    const target = findPlayerRollTarget(command.rollSpec || {});
    if (!target) throw new Error("La tirada solicitada no está disponible en Stats.");
    const autoToggle = $("auto-toss-toggle");
    if (autoToggle) autoToggle.checked = true;
    global.LuminousTheatreRolls?.armCheck?.(command.check || {});
    doc.body?.classList?.add("theatre-check-active");
    state.activeCommand = { key: item.key, command };
    state.authorizedElement = target;
    global.sessionStorage?.setItem(item.seenKey, "done");
    $("theatre-check-command-prompt")?.remove();
    state.commandPromptOpen = false;
    target.click();
    global.setTimeout(() => startPlayerLiveCapture(item.key, command), 80);
    global.setTimeout(showNextPlayerCommand, 120);
  }

  function sideFromImage(image) {
    const src = String(image?.currentSrc || image?.src || "");
    return src.includes("yshLPnQ") ? "head" : "tail";
  }

  function collectResolvedCoins(container) {
    return Array.from(container?.querySelectorAll?.(".coin-toss-item") || []).map((wrapper, index) => ({ wrapper, index }))
      .filter(({ wrapper }) => wrapper.dataset.stopped === "true")
      .map(({ wrapper, index }) => {
        const image = wrapper.querySelector("img");
        const side = sideFromImage(image);
        return { index, side, src: side === "head" ? HEAD_SRC : TAIL_SRC };
      });
  }

  async function startPlayerLiveCapture(commandId, command) {
    const uid = currentUid();
    if (!uid) return;
    let attempts = 0;
    const wait = global.setInterval(() => {
      attempts += 1;
      const container = $("coin-toss-coins-container");
      const wrappers = container?.querySelectorAll?.(".coin-toss-item");
      if ((!wrappers || !wrappers.length) && attempts < 50) return;
      global.clearInterval(wait);
      if (!container || !wrappers?.length) return;

      const liveRef = db.ref(`${LIVE_ROOT}/${uid}/${commandId}`);
      const update = () => {
        const coins = collectResolvedCoins(container);
        const total = parseSigned($("roll-total-score")?.textContent);
        const complete = coins.length >= 5;
        const payload = {
          targetUid: uid,
          targetPlayerId: command.targetPlayerId || playerIdentity().playerId || null,
          targetName: command.targetName || playerIdentity().name,
          roomKey: command.roomKey || roomKey(),
          rollSpec: command.rollSpec || {},
          check: command.check || {},
          total,
          resolved: coins.length,
          coinCount: 5,
          coins,
          status: complete ? "complete" : "rolling",
          clientUpdatedAt: Date.now(),
        };
        if (complete && global.LuminousTheatreRolls?.checkOutcome) {
          payload.outcome = global.LuminousTheatreRolls.checkOutcome(total, command.check || {});
          payload.completedAt = firebase.database.ServerValue.TIMESTAMP;
        }
        liveRef.update(payload).catch((error) => console.warn("No se pudo sincronizar el HUD del Check con el DM:", error));
        if (complete) {
          state.liveObserver?.disconnect();
          state.liveObserver = null;
          if (state.liveUpdateTimer) global.clearTimeout(state.liveUpdateTimer);
          global.setTimeout(() => doc.body?.classList?.remove("theatre-check-active"), 7600);
          global.setTimeout(() => liveRef.remove().catch(() => {}), 9500);
        }
      };
      const schedule = () => {
        if (state.liveUpdateTimer) global.clearTimeout(state.liveUpdateTimer);
        state.liveUpdateTimer = global.setTimeout(update, 0);
      };
      state.liveObserver?.disconnect();
      state.liveObserver = new MutationObserver(schedule);
      state.liveObserver.observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-stopped", "src"] });
      update();
    }, 40);
  }

  function effectiveThreshold(check) {
    if (global.LuminousTheatreRolls?.effectiveThreshold) return global.LuminousTheatreRolls.effectiveThreshold(check || {});
    const raw = Number(check?.thresholdRaw);
    if (!Number.isFinite(raw)) return null;
    const x = Math.max(0, Math.trunc(numberOr(check?.modifierValue, 0)));
    return check?.modifierType === "advantage" ? Math.max(0, raw - x) : check?.modifierType === "disadvantage" ? raw + x : raw;
  }

  function makeText(className, value) {
    const node = doc.createElement("div");
    node.className = className;
    node.textContent = String(value ?? "");
    return node;
  }

  function buildDmMirrorHud(live) {
    const check = live.check || {};
    const threshold = effectiveThreshold(check);
    const total = numberOr(live.total, 0);
    const complete = live.status === "complete";
    const outcome = live.outcome || (complete && global.LuminousTheatreRolls?.checkOutcome ? global.LuminousTheatreRolls.checkOutcome(total, check) : null);
    const hud = doc.createElement("article");
    hud.className = `theatre-check-hud theatre-check-hud--dm-mirror ${complete ? "is-resolved" : "is-rolling"}`;
    hud.dataset.modifier = check.modifierType || "neutral";

    const caption = makeText("theatre-check-dm-mirror-caption", `${live.targetName || "PLAYER"} · ${live.rollSpec?.label || "CHECK"}`);
    hud.appendChild(caption);

    if (numberOr(check.modifierValue, 0) > 0 && check.tipText) {
      const tip = doc.createElement("section");
      tip.className = "theatre-check-tip";
      const sign = check.modifierType === "advantage" ? "-" : "+";
      tip.appendChild(makeText("theatre-check-tip-title", `${check.modifierType === "advantage" ? "ADVANTAGE" : "DISADVANTAGE"} ${sign}${numberOr(check.modifierValue, 0)}`));
      tip.appendChild(makeText("theatre-check-tip-copy", check.tipText));
      hud.appendChild(tip);
    }

    const body = doc.createElement("section");
    body.className = "theatre-check-body";
    const coins = doc.createElement("div");
    coins.className = "theatre-check-coins";
    const resolvedByIndex = new Map((live.coins || []).map((coin) => [Number(coin.index), coin]));
    for (let index = 0; index < 5; index += 1) {
      const coin = resolvedByIndex.get(index);
      const image = doc.createElement("img");
      image.className = `theatre-check-coin-image${coin ? "" : " is-pending"}`;
      image.alt = coin ? coin.side : "Pending coin";
      image.src = coin?.src || TAIL_SRC;
      coins.appendChild(image);
    }
    body.appendChild(coins);

    const comparison = doc.createElement("div");
    comparison.className = `theatre-check-comparison${Number.isFinite(threshold) ? "" : " is-roll-only"}`;
    if (Number.isFinite(threshold)) {
      const thresholdBlock = doc.createElement("div");
      thresholdBlock.className = `theatre-check-block theatre-check-threshold ${check.modifierType || "neutral"}`;
      thresholdBlock.append(makeText("theatre-check-block-label", "Threshold"), makeText("theatre-check-block-value", threshold));
      const sub = makeText("theatre-check-block-sub", numberOr(check.modifierValue, 0) > 0 ? `${check.thresholdRaw} ${check.modifierType === "advantage" ? "-" : "+"} ${numberOr(check.modifierValue, 0)}` : "");
      thresholdBlock.appendChild(sub);
      comparison.appendChild(thresholdBlock);
      const op = makeText("theatre-check-operator", complete ? (outcome === "passed" ? "≤" : ">") : "VS");
      comparison.appendChild(op);
    }
    const result = doc.createElement("div");
    result.className = "theatre-check-block theatre-check-result";
    result.append(makeText("theatre-check-block-label", "Outcome"), makeText("theatre-check-block-value", total), makeText("theatre-check-block-sub", ""));
    comparison.appendChild(result);
    body.appendChild(comparison);

    const status = makeText("theatre-check-status", complete ? (outcome === "passed" ? "CHECK PASSED" : outcome === "failed" ? "CHECK FAILED" : "ROLL COMPLETE") : `ROLLING ${numberOr(live.resolved, 0)} / 5`);
    status.classList.toggle("is-pass", outcome === "passed");
    status.classList.toggle("is-fail", outcome === "failed");
    body.appendChild(status);
    hud.appendChild(body);
    return hud;
  }

  function bindDmLive() {
    db.ref(LIVE_ROOT).on("value", (snapshot) => {
      const root = snapshot.val() || {};
      const entries = [];
      Object.values(root).forEach((byCommand) => {
        Object.entries(byCommand || {}).forEach(([commandId, live]) => {
          if (!live || String(live.roomKey || "default") !== roomKey()) return;
          if (Date.now() - numberOr(live.clientUpdatedAt, 0) > LIVE_MAX_AGE_MS) return;
          entries.push({ commandId, ...live });
        });
      });
      entries.sort((a, b) => numberOr(b.clientUpdatedAt) - numberOr(a.clientUpdatedAt));
      const latest = entries[0];
      state.dmLiveHud?.remove();
      state.dmLiveHud = null;
      if (!latest) return;
      const front = ensureFrontLayer();
      if (!front) return;
      state.dmLiveHud = buildDmMirrorHud(latest);
      front.appendChild(state.dmLiveHud);
    });
  }

  function boot() {
    if (state.mounted) return;
    state.mounted = true;
    installFrontLayerBridge();
    installPlayerRollGate();
    bindPlayerCommands();
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      installFrontLayerBridge();
      if (!isDm()) bindPlayerCommands();
      if (isDm() && mountDmConsole()) {
        global.clearInterval(timer);
      } else if (!isDm() && attempts > 150) {
        global.clearInterval(timer);
      }
    }, 100);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();

  global.LuminousTheatreCheckCoordinator = Object.freeze({
    REQUEST_ROOT,
    COMMAND_ROOT,
    LIVE_ROOT,
    ABILITIES,
    roomKey,
    rollSpecFromTarget,
    effectiveThreshold,
    requestPlayerRoll,
    ensureFrontLayer,
  });
})(window);
