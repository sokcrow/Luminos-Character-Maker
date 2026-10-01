(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousPlayerProgressionAllocation) return;

  const PLAYER_ROOT = "campaña/jugadores";
  const PLAYER_ID_STORAGE_KEY = "playerId";
  const HISTORY_LIMIT = 20;
  const state = {
    db: null,
    playerId: null,
    character: null,
    playerRef: null,
    playerListener: null,
    draft: new Map(),
    baseSignature: "",
    addedClassIds: new Set(),
    reviewOpen: false,
    feedback: "",
    feedbackKind: "",
    host: null,
    booted: false,
    retryTimer: null,
  };

  const core = () => global.LuminousPlayerProgressionTreeCore || null;
  const rules = () => global.LuminousCharacterBuildRules || null;
  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => core()?.normalizeId?.(value) || clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function playerId() {
    return clean(global.localStorage?.getItem?.(PLAYER_ID_STORAGE_KEY) || global.currentPlayerId || state.playerId);
  }

  function character() {
    return state.character || global.datosJugador || {};
  }

  function classDefinitions() {
    return Array.isArray(rules()?.CLASSES) ? rules().CLASSES : [];
  }

  function classDefinition(classId) {
    const id = normalizeId(classId);
    return classDefinitions().find((entry) => normalizeId(entry?.id || entry?.classId) === id) || { id, name: id || "Clase", code: id.slice(0, 3).toUpperCase() };
  }

  function className(classId) {
    return String(classDefinition(classId)?.name || classId || "Clase");
  }

  function summary() {
    return core()?.classAllocationSummary?.(character()) || { earnedLevel: 0, allocatedLevel: 0, pendingLevels: 0, classes: [] };
  }

  function baseMap() {
    return new Map((summary().classes || []).map((entry) => [entry.classId, entry.levels]));
  }

  function draftSignature() {
    const info = summary();
    return JSON.stringify({
      earnedLevel: info.earnedLevel,
      classes: (info.classes || []).map((entry) => [entry.classId, entry.levels]).sort((a, b) => a[0].localeCompare(b[0])),
    });
  }

  function ensureDraft(force = false) {
    const signature = draftSignature();
    if (!force && signature === state.baseSignature) return;
    state.baseSignature = signature;
    state.draft = new Map((summary().classes || []).map((entry) => [entry.classId, entry.levels]));
    state.addedClassIds.clear();
    state.reviewOpen = false;
    state.feedback = "";
    state.feedbackKind = "";
  }

  function draftRows() {
    const ids = new Set([...state.draft.keys(), ...state.addedClassIds]);
    return [...ids]
      .map((classId) => ({ classId, levels: Math.max(0, Number.parseInt(state.draft.get(classId) || 0, 10) || 0) }))
      .sort((a, b) => className(a.classId).localeCompare(className(b.classId)));
  }

  function draftForValidation() {
    return draftRows().filter((entry) => entry.levels > 0);
  }

  function draftTotal() {
    return draftRows().reduce((sum, entry) => sum + entry.levels, 0);
  }

  function pendingDraftLevels() {
    return Math.max(0, summary().earnedLevel - draftTotal());
  }

  function setFeedback(message = "", kind = "") {
    state.feedback = String(message || "");
    state.feedbackKind = kind;
  }

  function maxForClass(classId) {
    const current = state.draft.get(classId) || 0;
    return Math.max(current, current + pendingDraftLevels());
  }

  function setDraftLevel(classId, requested) {
    const id = normalizeId(classId);
    if (!id) return;
    const base = baseMap().get(id) || 0;
    const current = state.draft.get(id) || 0;
    const otherTotal = draftTotal() - current;
    const earned = summary().earnedLevel;
    const max = Math.max(base, earned - otherTotal);
    const next = Math.max(base, Math.min(max, Math.floor(Number(requested) || 0)));
    state.draft.set(id, next);
    state.reviewOpen = false;
    setFeedback();
    render();
  }

  function addClass(classId) {
    const id = normalizeId(classId);
    if (!id) return;
    if (!classDefinitions().some((entry) => normalizeId(entry.id) === id)) return;
    if (!state.draft.has(id)) state.draft.set(id, 0);
    state.addedClassIds.add(id);
    state.reviewOpen = false;
    render();
  }

  function removeUncommittedClass(classId) {
    const id = normalizeId(classId);
    if ((baseMap().get(id) || 0) > 0) return;
    state.draft.delete(id);
    state.addedClassIds.delete(id);
    state.reviewOpen = false;
    render();
  }

  function previewCharacter() {
    const next = clone(character()) || {};
    const classes = draftForValidation();
    const persisted = classes.map((entry) => ({ classId: entry.classId, id: entry.classId, levels: entry.levels, level: entry.levels }));
    next.characterBuild = next.characterBuild && typeof next.characterBuild === "object" ? next.characterBuild : {};
    next.characterBuild.classes = clone(persisted);
    next.classes = clone(persisted);
    next.classLevels = Object.fromEntries(classes.map((entry) => [entry.classId, entry.levels]));
    return next;
  }

  function unlockedByDraft() {
    const changes = core()?.allocationChanges?.(character(), draftForValidation(), classDefinitions()) || [];
    if (!changes.length) return [];
    const beforeById = new Map(changes.map((entry) => [entry.classId, entry.before]));
    const model = core()?.buildProgressionModel?.(previewCharacter(), {
      traitCatalog: global.LuminousTraitCatalogCore,
      archetypeCatalog: global.LuminousArchetypeTraitCatalog,
      traitEngine: global.LuminousTraitEngine,
      classDefinitions: classDefinitions(),
    });
    if (!model) return [];

    const unlocks = [];
    model.classes.forEach((classModel) => {
      if (!beforeById.has(classModel.classId)) return;
      const before = beforeById.get(classModel.classId) || 0;
      const after = classModel.classLevel;
      classModel.commonNodes
        .filter((node) => node.level > before && node.level <= after)
        .forEach((node) => {
          const names = node.items.map((item) => item.name).filter(Boolean);
          unlocks.push({ classId: classModel.classId, level: node.level, label: names.length ? names.join(", ") : "Mejora de clase", type: "class" });
        });
      classModel.branches
        .filter((branch) => branch.unlockLevel > before && branch.unlockLevel <= after)
        .forEach((branch) => unlocks.push({ classId: classModel.classId, level: branch.unlockLevel, label: `Arquetipo disponible: ${branch.name}`, type: "archetype" }));
    });
    return unlocks.sort((a, b) => a.level - b.level || a.label.localeCompare(b.label));
  }

  function reviewAllocation() {
    const validation = core()?.validateClassAllocation?.(character(), draftForValidation(), classDefinitions(), { requireAll: true });
    if (!validation?.valid) {
      setFeedback(validation?.errors?.join(" ") || "La distribución no es válida.", "error");
      state.reviewOpen = false;
      render();
      return;
    }
    if (!validation.changed) {
      setFeedback("No hay niveles nuevos que guardar.", "info");
      state.reviewOpen = false;
      render();
      return;
    }
    state.reviewOpen = true;
    setFeedback();
    render();
  }

  function persistedClasses(classes) {
    return classes.map((entry) => ({
      classId: entry.classId,
      id: entry.classId,
      levels: entry.levels,
      level: entry.levels,
    }));
  }

  async function commitAllocation() {
    const runtimeCore = core();
    const definitions = classDefinitions();
    const proposed = draftForValidation();
    const initial = runtimeCore?.validateClassAllocation?.(character(), proposed, definitions, { requireAll: true });
    if (!initial?.valid || !initial.changed) {
      setFeedback(initial?.errors?.join(" ") || "La distribución ya no es válida.", "error");
      state.reviewOpen = false;
      render();
      return false;
    }

    if (!state.db || !playerId()) {
      setFeedback("Firebase o el Player ID no están disponibles.", "error");
      render();
      return false;
    }

    const commitAt = Date.now();
    const expectedLevel = initial.earnedLevel;
    const expectedBefore = JSON.stringify(initial.before);
    let abortReason = "No se pudo confirmar la progresión.";
    setFeedback("CONFIRMANDO PROGRESIÓN...", "pending");
    render();

    try {
      const result = await state.db.ref(`${PLAYER_ROOT}/${playerId()}`).transaction((current) => {
        if (!current || typeof current !== "object") {
          abortReason = "El jugador ya no existe.";
          return;
        }

        const latestSummary = runtimeCore.classAllocationSummary(current);
        if (latestSummary.earnedLevel !== expectedLevel) {
          abortReason = "Tu nivel cambió mientras editabas. Revisa la distribución otra vez.";
          return;
        }
        if (JSON.stringify(latestSummary.classes) !== expectedBefore) {
          abortReason = "Tu distribución de clases cambió mientras editabas. Revisa nuevamente.";
          return;
        }

        const validation = runtimeCore.validateClassAllocation(current, proposed, definitions, { requireAll: true });
        if (!validation.valid || !validation.changed) {
          abortReason = validation.errors?.join(" ") || "La distribución ya no es válida.";
          return;
        }

        const classes = persistedClasses(validation.classes);
        current.characterBuild = current.characterBuild && typeof current.characterBuild === "object" ? current.characterBuild : {};
        current.characterBuild.classes = clone(classes);
        current.characterBuild.calculatedAtLevel = validation.earnedLevel;
        current.classes = clone(classes);
        current.classLevels = Object.fromEntries(validation.classes.map((entry) => [entry.classId, entry.levels]));

        const history = Array.isArray(current.characterBuild.progressionHistory)
          ? current.characterBuild.progressionHistory.slice(-(HISTORY_LIMIT - 1))
          : [];
        history.push({
          type: "class_level_allocation",
          at: commitAt,
          characterLevel: validation.earnedLevel,
          before: clone(validation.before),
          after: clone(validation.classes),
        });
        current.characterBuild.progressionHistory = history;
        current.characterBuild.lastProgressionCommit = {
          type: "class_level_allocation",
          at: commitAt,
          characterLevel: validation.earnedLevel,
          before: clone(validation.before),
          after: clone(validation.classes),
        };
        return current;
      });

      if (!result?.committed) throw new Error(abortReason);
      state.reviewOpen = false;
      setFeedback("PROGRESIÓN GUARDADA.", "success");
      return true;
    } catch (error) {
      state.reviewOpen = false;
      setFeedback(error?.message || abortReason, "error");
      render();
      return false;
    }
  }

  function classRow(entry) {
    const row = doc.createElement("div");
    const definition = classDefinition(entry.classId);
    const base = baseMap().get(entry.classId) || 0;
    const pending = pendingDraftLevels();
    const max = Math.max(entry.levels, entry.levels + pending);
    const isNew = base === 0;

    row.className = "player-level-allocation__row";
    row.dataset.classId = entry.classId;
    row.innerHTML = `
      <div class="player-level-allocation__identity">
        <span>${escapeHtml(definition.code || entry.classId.slice(0, 3).toUpperCase())}</span>
        <strong>${escapeHtml(definition.name || entry.classId)}</strong>
        <small>${base ? `CONFIRMADO LV.${base}` : "NUEVA CLASE"}</small>
      </div>
      <button type="button" class="player-level-allocation__step" data-step="-1" aria-label="Quitar un nivel">−</button>
      <input class="player-level-allocation__range" type="range" min="${base}" max="${Math.max(base, max)}" step="1" value="${entry.levels}" aria-label="Niveles de ${escapeHtml(definition.name || entry.classId)}">
      <button type="button" class="player-level-allocation__step" data-step="1" aria-label="Añadir un nivel" ${pending <= 0 ? "disabled" : ""}>+</button>
      <input class="player-level-allocation__number" type="number" min="${base}" max="${Math.max(base, max)}" step="1" value="${entry.levels}" aria-label="Nivel exacto de ${escapeHtml(definition.name || entry.classId)}">
      ${isNew ? '<button type="button" class="player-level-allocation__remove" title="Quitar clase del borrador">×</button>' : '<span class="player-level-allocation__lock" title="Los niveles confirmados sólo los puede resetear el DM">LOCK</span>'}
    `;

    row.querySelectorAll(".player-level-allocation__step").forEach((button) => {
      button.addEventListener("click", () => setDraftLevel(entry.classId, entry.levels + Number(button.dataset.step || 0)));
    });
    row.querySelector(".player-level-allocation__range")?.addEventListener("input", (event) => setDraftLevel(entry.classId, event.target.value));
    row.querySelector(".player-level-allocation__number")?.addEventListener("change", (event) => setDraftLevel(entry.classId, event.target.value));
    row.querySelector(".player-level-allocation__remove")?.addEventListener("click", () => removeUncommittedClass(entry.classId));
    return row;
  }

  function reviewCard() {
    const validation = core()?.validateClassAllocation?.(character(), draftForValidation(), classDefinitions(), { requireAll: true });
    if (!state.reviewOpen || !validation?.valid) return null;
    const changes = core().allocationChanges(character(), draftForValidation(), classDefinitions());
    const unlocks = unlockedByDraft();

    const card = doc.createElement("section");
    card.className = "player-level-review";
    card.innerHTML = `
      <header>
        <div>
          <span>CONFIRMACIÓN</span>
          <h3>¿GUARDAR ESTA PROGRESIÓN?</h3>
        </div>
        <b>LV.${validation.earnedLevel}</b>
      </header>
      <div class="player-level-review__changes">
        ${changes.map((entry) => `
          <div>
            <strong>${escapeHtml(className(entry.classId))}</strong>
            <span>LV.${entry.before} → LV.${entry.after}</span>
            <b>+${entry.delta}</b>
          </div>`).join("")}
      </div>
      ${unlocks.length ? `
        <div class="player-level-review__unlocks">
          <strong>SE DESBLOQUEARÁ</strong>
          ${unlocks.map((entry) => `<span>LV.${entry.level} · ${escapeHtml(className(entry.classId))} — ${escapeHtml(entry.label)}</span>`).join("")}
        </div>` : ""}
      <p>Después de confirmar, el jugador no puede quitar ni mover niveles ya guardados. El DM podrá corregirlos mediante reset.</p>
      <div class="player-level-review__actions">
        <button type="button" data-review-cancel>CANCELAR</button>
        <button type="button" class="is-confirm" data-review-confirm>CONFIRMAR ${changes.reduce((sum, entry) => sum + entry.delta, 0)} NIVELES</button>
      </div>
    `;
    card.querySelector("[data-review-cancel]")?.addEventListener("click", () => {
      state.reviewOpen = false;
      render();
    });
    card.querySelector("[data-review-confirm]")?.addEventListener("click", async (event) => {
      event.currentTarget.disabled = true;
      await commitAllocation();
    });
    return card;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function render() {
    const host = doc.getElementById("player-progression-level-allocation-host");
    if (!host || !core() || !rules()) return false;
    state.host = host;
    ensureDraft();

    const info = summary();
    const pending = pendingDraftLevels();
    const rows = draftRows();
    const changed = core().allocationChanges(character(), draftForValidation(), classDefinitions());
    const availableClasses = classDefinitions().filter((entry) => !state.draft.has(normalizeId(entry.id)));

    host.replaceChildren();
    const panel = doc.createElement("section");
    panel.className = `player-level-allocation${pending > 0 ? " has-pending" : ""}`;
    panel.innerHTML = `
      <header class="player-level-allocation__header">
        <div>
          <span>CLASS LEVEL ALLOCATION</span>
          <h3>${pending > 0 ? `${pending} NIVEL${pending === 1 ? "" : "ES"} SIN ASIGNAR` : "NIVELES ASIGNADOS"}</h3>
        </div>
        <div class="player-level-allocation__totals">
          <span>PERSONAJE <b>LV.${info.earnedLevel}</b></span>
          <span>ASIGNADOS <b>${draftTotal()}</b></span>
          <span>PENDIENTES <b>${pending}</b></span>
        </div>
      </header>
      <p class="player-level-allocation__help">
        Arrastrar o usar +/− sólo modifica un borrador local. Nada se guarda hasta revisar y confirmar toda la distribución.
        Los niveles ya confirmados no se pueden reducir desde el Player.
      </p>
      <div class="player-level-allocation__rows"></div>
      <div class="player-level-allocation__add">
        <select aria-label="Añadir clase al borrador">
          <option value="">AÑADIR CLASE...</option>
          ${availableClasses.map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)}</option>`).join("")}
        </select>
        <button type="button" data-add-class>AÑADIR</button>
      </div>
      <div class="player-level-allocation__footer">
        <span class="player-level-allocation__feedback is-${escapeHtml(state.feedbackKind)}">${escapeHtml(state.feedback)}</span>
        <button type="button" data-reset-draft ${changed.length ? "" : "disabled"}>DESCARTAR BORRADOR</button>
        <button type="button" class="is-primary" data-review-allocation ${pending === 0 && changed.length ? "" : "disabled"}>REVISAR CAMBIOS</button>
      </div>
    `;

    const rowsHost = panel.querySelector(".player-level-allocation__rows");
    if (!rows.length) {
      const empty = doc.createElement("div");
      empty.className = "player-level-allocation__empty";
      empty.textContent = info.earnedLevel > 0
        ? "Escoge una clase para empezar a repartir tus niveles."
        : "Este personaje todavía no tiene niveles disponibles para repartir.";
      rowsHost.appendChild(empty);
    } else rows.forEach((entry) => rowsHost.appendChild(classRow(entry)));

    const select = panel.querySelector(".player-level-allocation__add select");
    panel.querySelector("[data-add-class]")?.addEventListener("click", () => {
      if (select?.value) addClass(select.value);
    });
    panel.querySelector("[data-reset-draft]")?.addEventListener("click", () => {
      ensureDraft(true);
      render();
    });
    panel.querySelector("[data-review-allocation]")?.addEventListener("click", reviewAllocation);

    host.appendChild(panel);
    const review = reviewCard();
    if (review) host.appendChild(review);
    return true;
  }

  function bindPlayer() {
    const id = playerId();
    if (!state.db || !id) {
      state.character = global.datosJugador || {};
      ensureDraft(true);
      render();
      return false;
    }
    if (state.playerId === id && state.playerRef) return true;
    if (state.playerRef && state.playerListener) state.playerRef.off("value", state.playerListener);

    state.playerId = id;
    state.playerRef = state.db.ref(`${PLAYER_ROOT}/${id}`);
    state.playerListener = (snapshot) => {
      state.character = snapshot.val() || global.datosJugador || {};
      ensureDraft(true);
      render();
      global.LuminousPlayerProgressionTree?.refresh?.();
    };
    state.playerRef.on("value", state.playerListener);
    return true;
  }

  function connectFirebase() {
    if (state.db) return true;
    if (!global.firebase?.database || !global.firebase?.apps?.length) return false;
    state.db = global.firebase.database();
    return true;
  }

  function refresh() {
    ensureDraft(false);
    return render();
  }

  function boot() {
    if (state.booted) return true;
    if (!doc.getElementById("player-progression-level-allocation-host") || !core() || !rules()) return false;
    connectFirebase();
    bindPlayer();
    render();
    doc.querySelector('[name="act_hud_perks"]')?.addEventListener("click", () => global.setTimeout(refresh, 0));
    state.booted = true;
    return true;
  }

  const api = Object.freeze({
    version: "0.1.0",
    state,
    render,
    refresh,
    reviewAllocation,
    commitAllocation,
    pendingDraftLevels,
  });
  global.LuminousPlayerProgressionAllocation = api;

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", () => {
      if (boot()) return;
      state.retryTimer = global.setInterval(() => {
        if (boot()) {
          global.clearInterval(state.retryTimer);
          state.retryTimer = null;
        }
      }, 250);
    }, { once: true });
  } else if (!boot()) {
    state.retryTimer = global.setInterval(() => {
      if (boot()) {
        global.clearInterval(state.retryTimer);
        state.retryTimer = null;
      }
    }, 250);
  }
})(typeof window !== "undefined" ? window : globalThis);
