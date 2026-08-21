(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || !doc.body?.classList?.contains("on-game-dashboard")) return;

  const state = {
    sceneActors: {},
    sceneRef: null,
    managerUnsubscribe: null,
    running: false,
    mounted: false,
  };

  const $ = (id) => doc.getElementById(id);

  function dependenciesReady() {
    return Boolean(
      global.firebase?.database
      && global.LuminousTheatreState?.getPaths
      && global.LuminousTheatreRolls?.publishRoll
      && global.LuminousCharacterManager?.getActor
      && global.LuminousNpcStats?.rollDefinition
      && global.LuminousCoinEngine?.runAnimatedRoll
    );
  }

  function resolveMasterRecord(sceneActorId, sceneActor = {}) {
    const manager = global.LuminousCharacterManager;
    const candidates = [
      sceneActorId,
      sceneActor.identityId,
      sceneActor.sourceActorId,
      sceneActor.sourceId,
      sceneActor.actorId,
    ].filter(Boolean);
    for (const candidate of candidates) {
      const record = manager.getActor(String(candidate));
      if (record) return record;
    }
    return null;
  }

  function sceneNpcEntries() {
    const result = [];
    for (const [sceneActorId, sceneActor] of Object.entries(state.sceneActors || {})) {
      const record = resolveMasterRecord(sceneActorId, sceneActor);
      if (!record || !global.LuminousNpcStats.canDmControl(record)) continue;
      result.push({
        sceneActorId,
        record,
        actor: record.actor || sceneActor || {},
      });
    }
    return result.sort((a, b) => String(a.actor.nombre || a.sceneActorId).localeCompare(String(b.actor.nombre || b.sceneActorId)));
  }

  function formatModifier(value) {
    const numeric = Number(value) || 0;
    return numeric >= 0 ? `+${numeric}` : String(numeric);
  }

  function mount() {
    if (!dependenciesReady()) return false;
    const director = $("theatre-director-panel");
    if (!director) return false;
    if ($("theatre-npc-roll-director")) {
      state.mounted = true;
      return true;
    }

    const panel = doc.createElement("section");
    panel.id = "theatre-npc-roll-director";
    panel.className = "theatre-npc-roll-director";
    panel.innerHTML = `
      <div class="theatre-npc-roll-title"><span>NPC CHECK CONSOLE</span><small>COIN ENGINE</small></div>
      <div class="theatre-npc-roll-grid">
        <label><span>NPC EN ESCENA</span><select id="theatre-npc-roll-actor"><option value="">SIN NPC DISPONIBLE</option></select></label>
        <label><span>TIRADA</span><select id="theatre-npc-roll-kind"><option value="ability">ABILITY</option><option value="save">SAVING THROW</option><option value="skill">SKILL</option></select></label>
        <label><span>STAT</span><select id="theatre-npc-roll-ability"></select></label>
        <label id="theatre-npc-roll-skill-field" hidden><span>SKILL</span><select id="theatre-npc-roll-skill"></select></label>
      </div>
      <div class="theatre-npc-roll-preview">
        <div><span>BASE</span><strong id="theatre-npc-roll-base">—</strong></div>
        <div><span>HEADS</span><strong id="theatre-npc-roll-heads">—</strong></div>
        <div class="wide"><span id="theatre-npc-roll-label">SELECT NPC</span><small>5 COINS · +4 / HEAD · NPC AUTO</small></div>
      </div>
      <details class="theatre-npc-check-options">
        <summary>CHECK / THRESHOLD OPCIONAL</summary>
        <div class="theatre-npc-check-grid">
          <label><span>THRESHOLD</span><input id="theatre-npc-roll-threshold" type="number" min="0" step="1" placeholder="—"></label>
          <label><span>MODIFIER</span><select id="theatre-npc-roll-modifier"><option value="neutral">NEUTRAL</option><option value="advantage">ADVANTAGE</option><option value="disadvantage">DISADVANTAGE</option></select></label>
          <label><span>X</span><input id="theatre-npc-roll-x" type="number" min="0" step="1" value="0"></label>
          <label class="theatre-npc-hidden-threshold"><input id="theatre-npc-roll-hidden-threshold" type="checkbox"><span>THRESHOLD OCULTO</span></label>
          <label class="wide"><span>TIP / RAZÓN</span><input id="theatre-npc-roll-tip" type="text" maxlength="180" placeholder="Opcional"></label>
        </div>
      </details>
      <button id="theatre-npc-roll-button" class="theatre-npc-roll-button" type="button">TIRAR NPC</button>
      <div id="theatre-npc-roll-feedback" class="theatre-npc-roll-feedback" aria-live="polite"></div>`;

    const composer = director.querySelector(".theatre-controls");
    if (composer) director.insertBefore(panel, composer);
    else director.appendChild(panel);

    const abilitySelect = $("theatre-npc-roll-ability");
    global.LuminousNpcStats.ABILITIES.forEach((ability) => {
      const option = doc.createElement("option");
      option.value = ability.id;
      option.textContent = `${ability.code} · ${ability.name}`;
      abilitySelect.appendChild(option);
    });

    $("theatre-npc-roll-actor")?.addEventListener("change", refreshPreview);
    $("theatre-npc-roll-kind")?.addEventListener("change", () => {
      syncSkillField();
      refreshPreview();
    });
    abilitySelect?.addEventListener("change", () => {
      syncSkillField();
      refreshPreview();
    });
    $("theatre-npc-roll-skill")?.addEventListener("change", refreshPreview);
    $("theatre-npc-roll-button")?.addEventListener("click", () => runNpcRoll().catch((error) => {
      console.error("NPC roll failed:", error);
      feedback(`ERROR / ${error.message || error}`, "error");
      state.running = false;
      syncButton();
    }));

    state.mounted = true;
    bindData();
    renderActors();
    syncSkillField();
    refreshPreview();
    return true;
  }

  function bindData() {
    const db = global.firebase.database();
    const scenePath = global.LuminousTheatreState.getPaths().scene;
    state.sceneRef?.off?.();
    state.sceneRef = db.ref(`${scenePath}/actores`);
    state.sceneRef.on("value", (snapshot) => {
      state.sceneActors = snapshot.val() || {};
      renderActors();
    });
    if (!state.managerUnsubscribe) {
      state.managerUnsubscribe = global.LuminousCharacterManager.subscribeAll?.(() => renderActors()) || null;
    }
  }

  function renderActors() {
    const select = $("theatre-npc-roll-actor");
    if (!select) return;
    const previous = select.value;
    const entries = sceneNpcEntries();
    select.replaceChildren();
    if (!entries.length) {
      const option = doc.createElement("option");
      option.value = "";
      option.textContent = "SIN NPC EN ESCENA";
      select.appendChild(option);
      refreshPreview();
      return;
    }
    entries.forEach((entry) => {
      const option = doc.createElement("option");
      option.value = entry.record.actorId;
      option.dataset.sceneActorId = entry.sceneActorId;
      option.textContent = entry.actor.nombre || entry.record.actorId;
      select.appendChild(option);
    });
    if (entries.some((entry) => entry.record.actorId === previous)) select.value = previous;
    refreshPreview();
  }

  function syncSkillField() {
    const api = global.LuminousNpcStats;
    const kind = $("theatre-npc-roll-kind")?.value || "ability";
    const ability = api.abilityById($("theatre-npc-roll-ability")?.value) || api.ABILITIES[0];
    const field = $("theatre-npc-roll-skill-field");
    const skillSelect = $("theatre-npc-roll-skill");
    if (!field || !skillSelect) return;
    field.hidden = kind !== "skill";
    skillSelect.replaceChildren();
    ability.skills.forEach((skill) => {
      const option = doc.createElement("option");
      option.value = skill.id;
      option.textContent = `${skill.name} · ${skill.spanish}`;
      skillSelect.appendChild(option);
    });
    if (kind === "skill" && !ability.skills.length) {
      const option = doc.createElement("option");
      option.value = "";
      option.textContent = "SIN SKILLS";
      skillSelect.appendChild(option);
    }
  }

  function currentDefinition() {
    const actorId = $("theatre-npc-roll-actor")?.value;
    if (!actorId) return null;
    return global.LuminousNpcStats.rollDefinition(actorId, {
      kind: $("theatre-npc-roll-kind")?.value || "ability",
      abilityId: $("theatre-npc-roll-ability")?.value || "str",
      skillId: $("theatre-npc-roll-skill")?.value || null,
    });
  }

  function refreshPreview() {
    if (!state.mounted) return;
    const definition = currentDefinition();
    $("theatre-npc-roll-base").textContent = definition ? formatModifier(definition.base) : "—";
    $("theatre-npc-roll-heads").textContent = definition ? `${definition.headsChance}%` : "—";
    $("theatre-npc-roll-label").textContent = definition
      ? `${String(definition.actor?.nombre || definition.actorId).toUpperCase()} / ${definition.label.toUpperCase()}`
      : "SELECT NPC";
    syncButton();
  }

  function syncButton() {
    const button = $("theatre-npc-roll-button");
    if (!button) return;
    button.disabled = state.running || !currentDefinition();
    button.textContent = state.running ? "TIRANDO..." : "TIRAR NPC";
  }

  function buildCheck() {
    const rawText = String($("theatre-npc-roll-threshold")?.value || "").trim();
    if (!rawText) return {};
    const raw = Number(rawText);
    if (!Number.isFinite(raw)) return {};
    const x = Math.max(0, Math.trunc(Number($("theatre-npc-roll-x")?.value) || 0));
    return {
      thresholdRaw: Math.max(0, Math.trunc(raw)),
      hiddenThreshold: Boolean($("theatre-npc-roll-hidden-threshold")?.checked),
      modifierType: x > 0 ? ($("theatre-npc-roll-modifier")?.value || "neutral") : "neutral",
      modifierValue: x,
      tipText: x > 0 ? String($("theatre-npc-roll-tip")?.value || "").trim().slice(0, 180) : "",
    };
  }

  function ensureLocalHud(definition, check) {
    const stage = $("theatre-stage");
    if (!stage) return null;
    let layer = $("dm-npc-roll-local-layer");
    if (!layer) {
      layer = doc.createElement("div");
      layer.id = "dm-npc-roll-local-layer";
      layer.className = "dm-npc-roll-local-layer";
      stage.appendChild(layer);
    }
    layer.replaceChildren();
    const threshold = Number.isFinite(Number(check.thresholdRaw))
      ? global.LuminousTheatreRolls.effectiveThreshold(check)
      : null;
    const hud = doc.createElement("article");
    hud.className = "dm-npc-roll-hud is-rolling";
    hud.dataset.modifier = check.modifierType || "neutral";
    hud.innerHTML = `
      <div class="dm-npc-roll-hud-kicker">NPC ROLL / ${String(definition.actor?.nombre || definition.actorId).toUpperCase()}</div>
      <div class="dm-npc-roll-hud-label">${definition.label}</div>
      <div class="dm-npc-roll-hud-coins" data-npc-coins></div>
      <div class="dm-npc-roll-hud-metrics">
        ${Number.isFinite(threshold) ? `<div><span>THRESHOLD</span><strong data-npc-threshold>${threshold}</strong></div><b class="dm-npc-roll-vs">VS</b>` : ""}
        <div><span>OUTCOME</span><strong data-npc-total>${definition.base}</strong></div>
      </div>
      <div class="dm-npc-roll-hud-status" data-npc-status>ROLLING...</div>`;
    layer.appendChild(hud);
    return hud;
  }

  function updateHudProgress(hud, detail) {
    const totalNode = hud?.querySelector("[data-npc-total]");
    if (totalNode) totalNode.textContent = String(detail.currentTotal);
    const status = hud?.querySelector("[data-npc-status]");
    if (status) status.textContent = `${detail.resolved} / ${detail.coinCount} COINS`;
  }

  function resolveHud(hud, total, check) {
    if (!hud) return;
    const status = hud.querySelector("[data-npc-status]");
    const outcome = global.LuminousTheatreRolls.checkOutcome(total, check);
    if (status) {
      status.textContent = outcome === "passed" ? "CHECK PASSED" : outcome === "failed" ? "CHECK FAILED" : "ROLL COMPLETE";
      status.classList.toggle("is-pass", outcome === "passed");
      status.classList.toggle("is-fail", outcome === "failed");
    }
    hud.classList.remove("is-rolling");
    hud.classList.add("is-resolved");
  }

  async function runNpcRoll() {
    if (state.running) return;
    const definition = currentDefinition();
    if (!definition) throw new Error("Selecciona un NPC válido de la escena.");
    const check = buildCheck();
    state.running = true;
    syncButton();
    feedback("NPC ROLL EN CURSO", "busy");

    const hud = ensureLocalHud(definition, check);
    const coinContainer = hud?.querySelector("[data-npc-coins]");
    const totalNode = hud?.querySelector("[data-npc-total]");
    if (!coinContainer || !totalNode) throw new Error("No se pudo montar el HUD local del NPC.");

    try {
      const result = await global.LuminousCoinEngine.runAnimatedRoll({
        document: doc,
        container: coinContainer,
        totalNode,
        base: definition.base,
        headsChance: definition.headsChance,
        coinCount: 5,
        intervalMs: 600,
        auto: true,
        onCoinResolved: (detail) => updateHudProgress(hud, detail),
      });
      resolveHud(hud, result.total, check);

      const published = await global.LuminousTheatreRolls.publishRoll({
        roller: {
          uid: global.firebase.auth?.().currentUser?.uid || null,
          actorId: definition.actorId,
          name: definition.actor?.nombre || definition.actorId,
        },
        label: definition.label,
        base: result.base,
        total: result.total,
        coins: result.coins,
        check,
      });
      if (!published?.published) throw new Error(`No se publicó la tirada: ${published?.reason || "unknown"}`);
      feedback(`PUBLICADO / ${definition.actor?.nombre || definition.actorId} / ${result.total}`, "ok");
      global.setTimeout(() => {
        hud?.classList.add("is-leaving");
        global.setTimeout(() => hud?.remove(), 260);
      }, 7000);
    } finally {
      state.running = false;
      syncButton();
    }
  }

  function feedback(text, mode = "") {
    const node = $("theatre-npc-roll-feedback");
    if (!node) return;
    node.textContent = text || "";
    node.dataset.mode = mode;
  }

  function start() {
    let attempts = 0;
    const timer = global.setInterval(() => {
      attempts += 1;
      if (mount() || attempts > 150) global.clearInterval(timer);
    }, 100);
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(window);
