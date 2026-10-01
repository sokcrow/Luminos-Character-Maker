(function (global) {
  "use strict";

  const doc = global.document;
  if (!doc || global.LuminousDmPlayerLoadoutManager) return;

  const ROOTS = Object.freeze({
    players: "campaña/jugadores",
    skills: "campaña/base_datos_skills",
    units: "campaña/base_datos_unidades",
  });

  const state = {
    db: null,
    playerId: "",
    player: null,
    playerRef: null,
    playerListener: null,
    skills: {},
    units: {},
    selectedCombatSpells: new Set(),
    selectedRoleSpells: new Set(),
    search: "",
    compatibleOnly: true,
    ready: false,
    subscriptions: [],
    retryTimer: null,
  };

  const clean = (value) => String(value ?? "").trim();
  const core = () => global.LuminousDmPlayerLoadoutCore || null;
  const normalizeId = (value) => core()?.normalizeId?.(value) || clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function ensureStyles() {
    if (doc.getElementById("dm-player-loadout-manager-style")) return;
    const link = doc.createElement("link");
    link.id = "dm-player-loadout-manager-style";
    link.rel = "stylesheet";
    link.href = "css/dm-player-loadout-manager.css";
    doc.head?.appendChild(link);
  }

  function ensureScript(id, src, ready) {
    if (ready?.()) return Promise.resolve(true);
    return new Promise((resolve) => {
      let script = doc.getElementById(id);
      const done = () => resolve(Boolean(ready?.() ?? true));
      if (script) {
        if (ready?.()) return resolve(true);
        script.addEventListener("load", done, { once: true });
        script.addEventListener("error", () => resolve(false), { once: true });
        global.setTimeout(done, 1200);
        return;
      }
      script = doc.createElement("script");
      script.id = id;
      script.src = src;
      script.async = false;
      script.addEventListener("load", done, { once: true });
      script.addEventListener("error", () => resolve(false), { once: true });
      doc.head?.appendChild(script);
    });
  }

  async function ensureDependencies() {
    await ensureScript("content-registry-script", "js/content-registry.js", () => global.LuminousContentRegistry);
    await ensureScript("content-registry-bootstrap-script", "js/content-registry-bootstrap.js", () => global.LuminousContentRegistryBootstrap);
    await ensureScript("combat-skill-schema-script", "js/combat-skill-schema.js", () => global.CombatSkillSchema);
    await ensureScript("player-signature-skill-catalog-script", "js/skill-catalog-player-signature.js", () => global.LuminousPlayerSignatureSkillCatalog);
    await ensureScript("combat-skill-loadout-074-script", "js/combat-skill-loadout-074.js", () => global.LuminousCombatSkillLoadout074);
    await ensureScript("role-spell-catalog-core-script", "js/role-spell-catalog-core.js", () => global.LuminousRoleSpellCatalog);
    await ensureScript("spell-catalog-core-script", "js/spell-catalog-core.js", () => global.LuminousSpellCatalog);
    await ensureScript("combat-spell-loadout-074-script", "js/combat-spell-loadout-074.js", () => global.LuminousCombatSpellLoadout074);
    try { global.LuminousContentRegistryBootstrap?.registerAvailableCore?.(); } catch (_) {}
    global.setTimeout(() => {
      try { global.LuminousContentRegistryBootstrap?.registerAvailableCore?.(); } catch (_) {}
      render();
    }, 500);
    return true;
  }

  function connectFirebase() {
    if (state.db) return true;
    if (!global.firebase?.database || !global.firebase?.apps?.length) return false;
    state.db = global.firebase.database();

    const skillRef = state.db.ref(ROOTS.skills);
    const skillHandler = (snapshot) => {
      state.skills = snapshot.val() || {};
      global.LuminousCombatSkillLoadout074?.applySkills?.(state.skills);
      render();
    };
    skillRef.on("value", skillHandler);
    state.subscriptions.push(() => skillRef.off("value", skillHandler));

    const unitRef = state.db.ref(ROOTS.units);
    const unitHandler = (snapshot) => {
      state.units = snapshot.val() || {};
      global.LuminousCombatSkillLoadout074?.applyUnits?.(state.units);
      renderReadiness();
    };
    unitRef.on("value", unitHandler);
    state.subscriptions.push(() => unitRef.off("value", unitHandler));
    return true;
  }

  function selectedPlayerId() {
    return clean(doc.getElementById("dm-player-dnd-select")?.value || state.playerId);
  }

  function playerLabel() {
    const player = state.player || {};
    return clean(player.characterName || player.character_name || player.nombre || player.name || state.playerId) || "Jugador";
  }

  function skillLibrary() {
    const signature = global.LuminousPlayerSignatureSkillCatalog?.DEFINITIONS || {};
    return core()?.normalizedSkillLibrary?.({ ...(state.skills || {}), ...signature }) || {};
  }

  function skillEntries(tier) {
    return Object.values(skillLibrary())
      .filter((skill) => core()?.skillTier?.(skill) === tier && skill?.inDeck !== false)
      .sort((a, b) => clean(a.name || a.id).localeCompare(clean(b.name || b.id)));
  }

  function spellEntries(type = "combat") {
    const rows = new Map();
    const registry = global.LuminousContentRegistry;

    if (registry?.list) {
      const registryType = type === "role" ? "role_spell" : "spell";
      try {
        registry.list({ type: registryType }).forEach((entry) => {
          const definition = clone(entry?.definition || {}) || {};
          const id = normalizeId(definition.id || entry?.id || String(entry?.canonicalId || "").split(":").slice(1).join(":"));
          if (id) rows.set(id, { ...definition, id, __source: entry?.source || registryType });
        });
      } catch (_) {}
    }

    const source = type === "role" ? global.LuminousRoleSpellCatalog : global.LuminousSpellCatalog;
    Object.entries(source || {}).forEach(([key, raw]) => {
      const id = normalizeId(raw?.id || key);
      if (id && !rows.has(id)) rows.set(id, { ...(clone(raw) || {}), id, __source: type });
    });

    return [...rows.values()].sort((a, b) => {
      const levelA = Number(a.level ?? a.spellLevel ?? 0) || 0;
      const levelB = Number(b.level ?? b.spellLevel ?? 0) || 0;
      return levelA - levelB || clean(a.name || a.nombre || a.id).localeCompare(clean(b.name || b.nombre || b.id));
    });
  }

  function currentDeck() {
    return core()?.deckFromPlayer?.(state.player || {}, skillLibrary()) || { tier1: "", tier2: "", tier3: "" };
  }

  function syncSpellSelectionsFromPlayer() {
    const player = state.player || {};
    const combat = player?.characterBuild?.spellSelections || player?.spellSelections || player?.characterBuild?.spellIds || player?.spellIds || [];
    const role = player?.characterBuild?.roleSpellSelections || player?.roleSpellSelections || [];
    state.selectedCombatSpells = new Set(core()?.normalizeSpellIds?.(combat) || []);
    state.selectedRoleSpells = new Set(core()?.normalizeSpellIds?.(role) || []);
  }

  function bindPlayer(id) {
    const nextId = clean(id);
    if (nextId === state.playerId && state.playerRef) return;
    if (state.playerRef && state.playerListener) state.playerRef.off("value", state.playerListener);
    state.playerId = nextId;
    state.player = null;
    state.playerRef = null;
    state.playerListener = null;

    if (!state.db || !nextId) {
      syncSpellSelectionsFromPlayer();
      render();
      return;
    }

    state.playerRef = state.db.ref(`${ROOTS.players}/${nextId}`);
    state.playerListener = (snapshot) => {
      state.player = snapshot.val() || null;
      syncSpellSelectionsFromPlayer();
      render();
    };
    state.playerRef.on("value", state.playerListener);
  }

  function optionMarkup(skill, selected) {
    const name = clean(skill?.name || skill?.nombre || skill?.id);
    const sin = clean(skill?.sinAffinity || skill?.sin || "sinless").toUpperCase();
    return `<option value="${escapeHtml(skill.id)}" ${selected === skill.id ? "selected" : ""}>${escapeHtml(name)} · ${escapeHtml(sin)}</option>`;
  }

  function deckSelectMarkup(tier, selected) {
    const copies = core()?.TIER_COPIES?.[tier] || ({1:3,2:2,3:1})[tier];
    const options = skillEntries(tier);
    return `
      <label class="dm-loadout-deck-slot">
        <span>TIER ${tier} · ×${copies}</span>
        <select id="dm-loadout-tier-${tier}">
          <option value="">— Selecciona Skill Tier ${tier} —</option>
          ${options.map((skill) => optionMarkup(skill, selected)).join("")}
        </select>
        <small>${options.length} Skills disponibles</small>
      </label>`;
  }

  function presetMarkup() {
    const presets = core()?.signaturePresets?.(global.LuminousPlayerSignatureSkillCatalog) || [];
    return `
      <div class="dm-loadout-preset">
        <label>
          <span>DECK PRESET</span>
          <select id="dm-loadout-preset-select">
            <option value="">— Ninguno / Manual —</option>
            ${presets.map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.label)}</option>`).join("")}
          </select>
        </label>
        <button id="dm-loadout-apply-preset" type="button" ${presets.length ? "" : "disabled"}>APLICAR PRESET</button>
      </div>`;
  }

  function currentDraftDeckFromDom() {
    return {
      tier1: normalizeId(doc.getElementById("dm-loadout-tier-1")?.value),
      tier2: normalizeId(doc.getElementById("dm-loadout-tier-2")?.value),
      tier3: normalizeId(doc.getElementById("dm-loadout-tier-3")?.value),
    };
  }

  function spellCard(spell, type) {
    const id = normalizeId(spell.id);
    const selected = type === "role" ? state.selectedRoleSpells.has(id) : state.selectedCombatSpells.has(id);
    const compatible = core()?.spellCompatibleWithPlayer?.(spell, state.player || {}) !== false;
    const level = Number(spell.level ?? spell.spellLevel ?? 0) || 0;
    const name = clean(spell.nombre || spell.name || id);
    const classIds = core()?.spellAllowedClassIds?.(spell) || [];
    const context = Array.isArray(spell.contexts) ? spell.contexts.join(" / ") : type === "role" ? "theater" : "combat";
    return `
      <label class="dm-loadout-spell-card ${compatible ? "" : "is-incompatible"}" data-spell-name="${escapeHtml((name + " " + id).toLowerCase())}">
        <input type="checkbox" data-loadout-spell="${escapeHtml(id)}" data-spell-type="${type}" ${selected ? "checked" : ""}>
        <span class="dm-loadout-spell-level">${level === 0 ? "CANTRIP" : `LV.${level}`}</span>
        <strong>${escapeHtml(name)}</strong>
        <small>${escapeHtml(spell.school || context || "spell")} · ${classIds.length ? escapeHtml(classIds.join(", ")) : "special / any"}</small>
        ${compatible ? "" : '<b class="dm-loadout-incompatible">FUERA DE CLASE</b>'}
      </label>`;
  }

  function filteredSpells(type) {
    const query = state.search.trim().toLowerCase();
    return spellEntries(type).filter((spell) => {
      const compatible = core()?.spellCompatibleWithPlayer?.(spell, state.player || {}) !== false;
      if (state.compatibleOnly && !compatible) return false;
      if (!query) return true;
      const text = [spell.id, spell.name, spell.nombre, spell.school, ...(spell.classIds || [])].join(" ").toLowerCase();
      return text.includes(query);
    });
  }

  function playerUnitResolution() {
    const runtime = global.LuminousCombatSkillLoadout074;
    if (!runtime?.resolvePlayerUnit || !state.playerId || !state.player) return { ok: false, reason: "UNAVAILABLE" };
    const actor = {
      playerId: state.playerId,
      sourceId: state.playerId,
      ownerUid: state.player?.uid || state.player?.ownerUid || null,
      linkedActorId: state.player?.actorId || null,
      actorId: state.player?.actorId || null,
      unitId: state.player?.unitId || state.player?.unit_id || null,
      raw: state.player,
    };
    return runtime.resolvePlayerUnit(actor, state.units);
  }

  function readinessData() {
    const player = state.player || {};
    const library = skillLibrary();
    const deck = core()?.deckFromPlayer?.(player, library) || {};
    const deckValidation = core()?.validateDeck?.(deck, library) || { valid: false, errors: ["Deck unavailable"] };
    const spellCount = core()?.normalizeSpellIds?.(player?.characterBuild?.spellSelections || player?.spellSelections || [])?.length || 0;
    const classCount = core()?.normalizeClassIds?.(player)?.length || 0;
    const unit = playerUnitResolution();
    return {
      classCount,
      deckReady: deckValidation.valid,
      deckErrors: deckValidation.errors || [],
      spellCount,
      unit,
      actorLinked: Boolean(player?.actorId || player?.linkedActorId),
    };
  }

  function renderReadiness() {
    const node = doc.getElementById("dm-loadout-readiness");
    if (!node) return;
    if (!state.playerId || !state.player) {
      node.innerHTML = '<span>Selecciona un jugador para ver su estado.</span>';
      return;
    }
    const ready = readinessData();
    const rows = [
      ["CLASSES", ready.classCount > 0, ready.classCount ? `${ready.classCount}` : "0"],
      ["SKILL DECK", ready.deckReady, ready.deckReady ? "6/6" : "INCOMPLETO"],
      ["SPELLS", true, `${ready.spellCount} SELECTED`],
      ["ACTOR LINK", ready.actorLinked, ready.actorLinked ? "OK" : "MISSING"],
      ["UNIT LINK", ready.unit.ok, ready.unit.ok ? "OK" : ready.unit.reason || "MISSING"],
    ];
    node.innerHTML = rows.map(([label, ok, value]) => `
      <div class="${ok ? "is-ok" : "is-warn"}"><span>${label}</span><b>${ok ? "✓" : "!"}</b><strong>${escapeHtml(value)}</strong></div>`
    ).join("");
  }

  async function syncUnitUpdates(updates) {
    const unit = playerUnitResolution();
    if (!unit.ok || !state.db) return { synced: false, reason: unit.reason || "PLAYER_UNIT_NOT_FOUND" };
    await state.db.ref(`${ROOTS.units}/${unit.unitId}`).update(updates);
    return { synced: true, unitId: unit.unitId };
  }

  async function saveDeck() {
    const feedback = doc.getElementById("dm-loadout-deck-feedback");
    if (!state.db || !state.playerId || !state.player) {
      if (feedback) feedback.textContent = "Selecciona un jugador.";
      return false;
    }
    const built = core()?.buildSkillDeckUpdates?.(currentDraftDeckFromDom(), skillLibrary(), "dm_loadout_manager");
    if (!built?.valid) {
      if (feedback) feedback.textContent = built?.errors?.join(" ") || "Deck inválido.";
      return false;
    }

    const button = doc.getElementById("dm-loadout-save-deck");
    if (button) button.disabled = true;
    if (feedback) feedback.textContent = "GUARDANDO DECK...";
    try {
      await state.db.ref(`${ROOTS.players}/${state.playerId}`).update(built.updates);
      const unitUpdates = {
        skillDeck: built.validation.deck,
        skillSlotIds: built.validation.skillSlotIds,
        skillIds: built.validation.skillIds,
        equippedSkillIndex: built.validation.equippedSkillIndex,
        "characterBuild/skillDeck": built.validation.deck,
        "characterBuild/skillLoadoutSource": "dm_loadout_manager",
      };
      const unitSync = await syncUnitUpdates(unitUpdates).catch(() => ({ synced: false, reason: "UNIT_SYNC_FAILED" }));
      if (feedback) feedback.textContent = unitSync.synced
        ? "DECK GUARDADO · PLAYER + UNIT SINCRONIZADOS"
        : "DECK GUARDADO EN PLAYER · COMBATE USARÁ EL LOADOUT CANÓNICO";
      return true;
    } catch (error) {
      console.error("No se pudo guardar el Skill Deck:", error);
      if (feedback) feedback.textContent = "ERROR AL GUARDAR DECK";
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function saveSpells() {
    const feedback = doc.getElementById("dm-loadout-spell-feedback");
    if (!state.db || !state.playerId || !state.player) {
      if (feedback) feedback.textContent = "Selecciona un jugador.";
      return false;
    }
    const updates = core()?.buildSpellUpdates?.([...state.selectedCombatSpells], [...state.selectedRoleSpells], "dm_loadout_manager");
    const button = doc.getElementById("dm-loadout-save-spells");
    if (button) button.disabled = true;
    if (feedback) feedback.textContent = "GUARDANDO SPELLS...";
    try {
      await state.db.ref(`${ROOTS.players}/${state.playerId}`).update(updates);
      const unitSync = await syncUnitUpdates(updates).catch(() => ({ synced: false, reason: "UNIT_SYNC_FAILED" }));
      if (feedback) feedback.textContent = unitSync.synced
        ? "SPELLS GUARDADOS · PLAYER + UNIT SINCRONIZADOS"
        : "SPELLS GUARDADOS EN PLAYER";
      return true;
    } catch (error) {
      console.error("No se pudieron guardar los Spells:", error);
      if (feedback) feedback.textContent = "ERROR AL GUARDAR SPELLS";
      return false;
    } finally {
      if (button) button.disabled = false;
    }
  }

  function applyPreset() {
    const presetId = normalizeId(doc.getElementById("dm-loadout-preset-select")?.value);
    const preset = (core()?.signaturePresets?.(global.LuminousPlayerSignatureSkillCatalog) || []).find((entry) => entry.id === presetId);
    if (!preset) return;
    [1, 2, 3].forEach((tier) => {
      const select = doc.getElementById(`dm-loadout-tier-${tier}`);
      if (select) select.value = preset.deck[`tier${tier}`] || "";
    });
    const feedback = doc.getElementById("dm-loadout-deck-feedback");
    if (feedback) feedback.textContent = "PRESET CARGADO EN BORRADOR · REVISA Y GUARDA";
  }

  function bindSpellCards(host) {
    host.querySelectorAll("[data-loadout-spell]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = normalizeId(checkbox.dataset.loadoutSpell);
        const target = checkbox.dataset.spellType === "role" ? state.selectedRoleSpells : state.selectedCombatSpells;
        if (checkbox.checked) target.add(id);
        else target.delete(id);
        renderSpellCounts();
      });
    });
  }

  function renderSpellCounts() {
    const combat = doc.getElementById("dm-loadout-combat-spell-count");
    const role = doc.getElementById("dm-loadout-role-spell-count");
    if (combat) combat.textContent = `${state.selectedCombatSpells.size} SELECTED`;
    if (role) role.textContent = `${state.selectedRoleSpells.size} SELECTED`;
  }

  function render() {
    const host = doc.getElementById("dm-player-loadout-host");
    if (!host || !core()) return false;

    if (!state.playerId || !state.player) {
      host.innerHTML = `
        <section class="dm-player-loadout-manager">
          <div class="dm-loadout-empty"><strong>LOADOUT MANAGER</strong><span>Selecciona un jugador arriba para editar Deck y Spells sin salir del panel del DM.</span></div>
        </section>`;
      return true;
    }

    const deck = currentDeck();
    const combatSpells = filteredSpells("combat");
    const roleSpells = filteredSpells("role");

    host.innerHTML = `
      <section class="dm-player-loadout-manager">
        <header class="dm-loadout-header">
          <div><span>PLAYER COMBAT BUILD</span><h4>${escapeHtml(playerLabel())}</h4></div>
          <div id="dm-loadout-readiness" class="dm-loadout-readiness"></div>
        </header>

        <section class="dm-loadout-section">
          <div class="dm-loadout-section-heading">
            <div><span>SKILL DECK</span><h5>DECK 3 / 2 / 1</h5></div>
            <p>Tier 1 ×3 · Tier 2 ×2 · Tier 3 ×1. El preset sólo llena el borrador; Guardar es explícito.</p>
          </div>
          ${presetMarkup()}
          <div class="dm-loadout-deck-grid">
            ${deckSelectMarkup(1, deck.tier1)}
            ${deckSelectMarkup(2, deck.tier2)}
            ${deckSelectMarkup(3, deck.tier3)}
          </div>
          <div class="dm-loadout-actions">
            <span id="dm-loadout-deck-feedback" aria-live="polite"></span>
            <button id="dm-loadout-save-deck" type="button">GUARDAR DECK</button>
          </div>
        </section>

        <section class="dm-loadout-section">
          <div class="dm-loadout-section-heading">
            <div><span>SPELL LOADOUT</span><h5>CONJUROS DEL JUGADOR</h5></div>
            <p>El DM puede resolver la selección aquí; el Player puede usar la misma fuente canónica cuando la autogestión esté completa.</p>
          </div>
          <div class="dm-loadout-spell-toolbar">
            <input id="dm-loadout-spell-search" type="search" value="${escapeHtml(state.search)}" placeholder="Buscar Spell por nombre, ID, escuela o clase...">
            <label><input id="dm-loadout-compatible-only" type="checkbox" ${state.compatibleOnly ? "checked" : ""}> Sólo compatibles con sus clases</label>
          </div>

          <div class="dm-loadout-spell-columns">
            <section>
              <header><strong>COMBAT SPELLS</strong><span id="dm-loadout-combat-spell-count">${state.selectedCombatSpells.size} SELECTED</span></header>
              <div class="dm-loadout-spell-list" id="dm-loadout-combat-spell-list">
                ${combatSpells.length ? combatSpells.map((spell) => spellCard(spell, "combat")).join("") : '<div class="dm-loadout-list-empty">Sin resultados.</div>'}
              </div>
            </section>
            <section>
              <header><strong>THEATRE / ROLE SPELLS</strong><span id="dm-loadout-role-spell-count">${state.selectedRoleSpells.size} SELECTED</span></header>
              <div class="dm-loadout-spell-list" id="dm-loadout-role-spell-list">
                ${roleSpells.length ? roleSpells.map((spell) => spellCard(spell, "role")).join("") : '<div class="dm-loadout-list-empty">Sin resultados.</div>'}
              </div>
            </section>
          </div>

          <div class="dm-loadout-actions">
            <span id="dm-loadout-spell-feedback" aria-live="polite"></span>
            <button id="dm-loadout-save-spells" type="button">GUARDAR SPELLS</button>
          </div>
        </section>
      </section>`;

    renderReadiness();
    bindSpellCards(host);

    doc.getElementById("dm-loadout-apply-preset")?.addEventListener("click", applyPreset);
    doc.getElementById("dm-loadout-save-deck")?.addEventListener("click", saveDeck);
    doc.getElementById("dm-loadout-save-spells")?.addEventListener("click", saveSpells);
    doc.getElementById("dm-loadout-spell-search")?.addEventListener("input", (event) => {
      state.search = String(event.target.value || "");
      render();
      const search = doc.getElementById("dm-loadout-spell-search");
      search?.focus();
      if (search) search.setSelectionRange(search.value.length, search.value.length);
    });
    doc.getElementById("dm-loadout-compatible-only")?.addEventListener("change", (event) => {
      state.compatibleOnly = Boolean(event.target.checked);
      render();
    });
    return true;
  }

  function bindStudioSelect() {
    const select = doc.getElementById("dm-player-dnd-select");
    if (!select || select.dataset.loadoutManagerBound === "true") return false;
    select.dataset.loadoutManagerBound = "true";
    select.addEventListener("change", () => bindPlayer(select.value));
    bindPlayer(select.value);
    return true;
  }

  async function boot() {
    ensureStyles();
    if (!doc.getElementById("dm-player-loadout-host")) return false;
    await ensureDependencies();
    connectFirebase();
    bindStudioSelect();
    global.addEventListener?.("luminous:dm-player-selected", (event) => bindPlayer(event?.detail?.playerId), { passive: true });
    state.ready = true;
    render();
    return true;
  }

  const api = Object.freeze({
    version: "0.1.0",
    ROOTS,
    state,
    render,
    saveDeck,
    saveSpells,
    readinessData,
    playerUnitResolution,
  });
  global.LuminousDmPlayerLoadoutManager = api;

  function start() {
    Promise.resolve(boot()).then((ok) => {
      if (ok) return;
      state.retryTimer = global.setInterval(() => {
        Promise.resolve(boot()).then((ready) => {
          if (!ready) return;
          global.clearInterval(state.retryTimer);
          state.retryTimer = null;
        });
      }, 250);
    });
  }

  global.addEventListener?.("luminous:dm-player-studio-tabs-ready", start, { once: true });
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(typeof window !== "undefined" ? window : globalThis);
