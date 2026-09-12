(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousBattleViewerEncounterSetup074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const ROOTS = Object.freeze({
    players: "campaña/jugadores",
    actors: "campaña/actores",
    units: "campaña/base_datos_unidades",
    combatants: "campaña/combate/combatants",
    draftCombatants: "campaña/combate/encounterDraft/combatants",
  });

  const CARD_ID = "dm074-encounter-setup";
  const PLAYER_SELECT_ID = "dm074-encounter-player-select";
  const PLAYER_SPRITE_ID = "dm074-encounter-player-sprite";
  const PLAYER_SAVE_ID = "dm074-encounter-player-sprite-save";
  const UNIT_SELECT_ID = "dm074-encounter-unit-select";
  const UNIT_QTY_ID = "dm074-encounter-unit-qty";
  const UNIT_ENEMY_ID = "dm074-encounter-unit-enemy";
  const UNIT_ALLY_ID = "dm074-encounter-unit-ally";
  const STATUS_ID = "dm074-encounter-setup-status";
  const START_ID = "dm074-encounter-start";
  const CLEAR_ID = "dm074-encounter-clear";

  const state = {
    db: null,
    players: {},
    actors: {},
    units: {},
    combatants: {},
    subscriptions: [],
    started: false,
    mountTimer: null,
    repairingSprites: false,
  };

  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const safeKey = (value, fallback = "unit") => clean(value).replace(/[.#$\[\]\/]/g, "_") || fallback;
  const htmlEscape = (value) => clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function actorLibrary() {
    if (global?.LuminousActorLibrary) return global.LuminousActorLibrary;
    if (typeof require === "function") {
      try { return require("./actor-library.js"); } catch (_) {}
    }
    return null;
  }

  function skillLoadoutRuntime() {
    if (global?.LuminousCombatSkillLoadout074) return global.LuminousCombatSkillLoadout074;
    if (typeof require === "function") {
      try { return require("./combat-skill-loadout-074.js"); } catch (_) {}
    }
    return null;
  }

  function firstFinite(...values) {
    for (const value of values) {
      const parsed = finite(value);
      if (parsed != null) return parsed;
    }
    return null;
  }

  function buildActionSlotIndex(slotCount) {
    const count = Math.max(0, Math.trunc(Number(slotCount) || 0));
    return Object.fromEntries(Array.from({ length: count }, (_, index) => [String(index), true]));
  }

  function playerActors() {
    const library = actorLibrary();
    if (!library?.normalizePlayerActor) return [];
    return Object.entries(state.players || {})
      .map(([id, player]) => library.normalizePlayerActor(id, player || {}, state.actors || {}))
      .sort((a, b) => clean(a.name).localeCompare(clean(b.name)));
  }

  function unitActors() {
    const library = actorLibrary();
    if (!library?.normalizeActor) return [];
    return Object.entries(state.units || {})
      .map(([id, unit]) => library.normalizeActor("units", id, unit || {}))
      .sort((a, b) => clean(a.name).localeCompare(clean(b.name)));
  }

  function spriteFor(entity = {}) {
    return clean(entity.img || entity.current_sprite || entity.tokenImage || entity.icono || entity.portrait || entity.visual?.spriteUrl || entity.sprite || entity.image);
  }

  function playerCombatantKeys(actor = {}) {
    const wanted = new Set([
      actor.playerId,
      actor.sourceId,
      actor.actorId,
      actor.linkedActorId,
      `player:${safeKey(actor.playerId || actor.sourceId || actor.actorId, "player")}`,
    ].map(clean).filter(Boolean));
    return Object.entries(state.combatants || {}).filter(([key, combatant]) => {
      const refs = [
        key,
        combatant?.id,
        combatant?.combatId,
        combatant?.playerId,
        combatant?.ownerPlayerId,
        combatant?.canonicalPlayerKey,
        combatant?.actorId,
        combatant?.actorRef?.id,
      ].map(clean).filter(Boolean);
      return refs.some((value) => wanted.has(value));
    }).map(([key]) => key);
  }

  async function savePlayerSprite(actor, spriteUrl, options = {}) {
    const db = options.db || state.db;
    if (!db?.ref) throw new Error("FIREBASE_DATABASE_REQUIRED");
    if (!actor?.linkedActorId) throw new Error("PLAYER_ACTOR_LINK_REQUIRED");
    const url = clean(spriteUrl);
    if (!url) throw new Error("SPRITE_URL_REQUIRED");

    await db.ref(`${ROOTS.actors}/${actor.linkedActorId}/icono`).set(url);

    const activeKeys = playerCombatantKeys(actor);
    if (activeKeys.length) {
      const updates = {};
      activeKeys.forEach((key) => {
        updates[`${key}/img`] = url;
        updates[`${key}/icono`] = url;
        updates[`${key}/tokenImage`] = url;
        updates[`${key}/portrait`] = url;
      });
      await db.ref(ROOTS.draftCombatants).update(updates);
    }
    return { actorId: actor.linkedActorId, spriteUrl: url, activeCombatantsUpdated: activeKeys.length };
  }

  function unitActionSlots(raw = {}) {
    return Math.max(1, Math.trunc(firstFinite(
      raw.initialActionSlots,
      raw.actionSlots,
      raw.activeSlots,
      raw.action_slots_count,
      raw.maxActionSlots,
      raw.max_action_slots,
      1,
    ) || 1));
  }

  function unitHp(raw = {}) {
    const maxHp = firstFinite(raw.maxHp, raw.maxHP, raw.hp_max, raw.hpMax, raw.combatStats?.hp_max, raw.hp, raw.baseHp, 1) || 1;
    const hp = firstFinite(raw.hp, raw.currentHp, raw.currentHP, raw.hp_actual, raw.combatStats?.hp_actual, maxHp) ?? maxHp;
    return { hp, maxHp };
  }

  function buildLibraryCombatant(actor, faction = "enemy", options = {}) {
    if (!actor || actor.scope !== "units") throw new Error("UNIT_ACTOR_REQUIRED");
    const raw = clone(actor.raw || {}) || {};
    const sourceId = clean(actor.sourceId || actor.actorId);
    if (!sourceId) throw new Error("UNIT_ID_REQUIRED");
    const side = faction === "ally" ? "ally" : "enemy";
    const serial = clean(options.serial || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`);
    const id = `${side}:unit:${safeKey(sourceId)}:${serial}`;
    const image = spriteFor({ ...raw, ...actor });
    const { hp, maxHp } = unitHp(raw);
    const actionSlots = unitActionSlots(raw);
    const library = actorLibrary();
    const loadout = skillLoadoutRuntime();
    const skillSlotIds = library?.skillSlotIdsFor ? library.skillSlotIdsFor("units", raw) : (actor.skillSlotIds || []);
    const skillIds = library?.skillIdsFor ? library.skillIdsFor("units", raw) : [...new Set(skillSlotIds)];
    const equippedSkillIndex = loadout?.buildEquippedSkillIndex ? loadout.buildEquippedSkillIndex(skillIds) : {};

    return {
      ...raw,
      id,
      combatId: id,
      name: clean(actor.name) || sourceId,
      characterName: clean(actor.name) || sourceId,
      faction: side,
      faccion: side,
      category: side,
      actorCategory: side,
      isPlayer: false,
      type: clean(raw.type || raw.unitType || (raw.rank === "leader" ? "boss" : "")) || undefined,
      unitType: raw.unitType || "enemy",
      actorId: actor.actorId || sourceId,
      actorRef: { scope: "units", id: sourceId },
      unitRef: { scope: "units", id: sourceId },
      canonicalScope: "unit",
      dynamicActorToken: true,
      img: image || null,
      icono: image || null,
      tokenImage: image || null,
      portrait: image || null,
      hp,
      maxHp,
      sp: firstFinite(raw.sp, raw.currentSp, raw.currentSP, raw.sp_actual, 0) ?? 0,
      speed: firstFinite(raw.speed, raw.currentSpeed, raw.speedValue, raw.maxSpeed, raw.speedFt, 1) ?? 1,
      actionSlots,
      activeSlots: actionSlots,
      actionSlotIndex: buildActionSlotIndex(actionSlots),
      skillSlotIds,
      skillIds,
      equippedSkillIndex,
      statusEffects: raw.statusEffects && typeof raw.statusEffects === "object" ? clone(raw.statusEffects) : {},
      escala_matriz: Math.max(3, Math.trunc(firstFinite(raw.escala_matriz, raw.matrixScale, 3) || 3)),
      scale: firstFinite(raw.scale, raw.spriteScale, 1) ?? 1,
      spriteX: firstFinite(raw.spriteX, 0) ?? 0,
      spriteY: firstFinite(raw.spriteY, 0) ?? 0,
      uiX: firstFinite(raw.uiX, 0) ?? 0,
      uiY: firstFinite(raw.uiY, 0) ?? 0,
      entrySource: "dm_unit_library_074",
      libraryUnitId: sourceId,
      enteredCombatAt: Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now(),
    };
  }

  async function deployLibraryUnit(actor, faction = "enemy", quantity = 1, options = {}) {
    const db = options.db || state.db;
    if (!db?.ref) throw new Error("FIREBASE_DATABASE_REQUIRED");
    const count = Math.max(1, Math.min(20, Math.trunc(Number(quantity) || 1)));
    const updates = {};
    const created = [];
    for (let i = 0; i < count; i += 1) {
      const combatant = buildLibraryCombatant(actor, faction, { ...options, serial: `${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 7)}` });
      updates[combatant.id] = combatant;
      created.push(combatant);
    }
    await db.ref(ROOTS.draftCombatants).update(updates);
    return created;
  }

  async function repairCanonicalSprites(combatants = state.combatants, options = {}) {
    const db = options.db || state.db;
    if (!db?.ref || state.repairingSprites) return 0;
    const updates = {};
    Object.entries(combatants || {}).forEach(([key, combatant]) => {
      if (clean(combatant?.img)) return;
      const sprite = spriteFor(combatant || {});
      if (sprite) updates[`${key}/img`] = sprite;
    });
    const count = Object.keys(updates).length;
    if (!count) return 0;
    state.repairingSprites = true;
    try { await db.ref(ROOTS.draftCombatants).update(updates); }
    finally { state.repairingSprites = false; }
    return count;
  }

  function setStatus(message, kind = "info") {
    const node = global.document?.getElementById?.(STATUS_ID);
    if (!node) return;
    node.textContent = message || "";
    node.dataset.kind = kind;
    node.style.color = kind === "error" ? "#ff8b78" : kind === "ok" ? "#8fd6a0" : "#9a9a9a";
  }

  function render() {
    const doc = global.document;
    if (!doc) return false;
    const playerSelect = doc.getElementById(PLAYER_SELECT_ID);
    const spriteInput = doc.getElementById(PLAYER_SPRITE_ID);
    const spriteSave = doc.getElementById(PLAYER_SAVE_ID);
    const unitSelect = doc.getElementById(UNIT_SELECT_ID);
    if (!playerSelect || !spriteInput || !spriteSave || !unitSelect) return false;

    const previousPlayer = playerSelect.value;
    const players = playerActors();
    playerSelect.innerHTML = '<option value="">— Select Player —</option>' + players.map((actor) =>
      `<option value="${htmlEscape(actor.key)}">${htmlEscape(actor.name)}${actor.linkedActorId ? "" : " · NO ACTOR LINK"}</option>`
    ).join("");
    if (previousPlayer && players.some((actor) => actor.key === previousPlayer)) playerSelect.value = previousPlayer;
    const selectedPlayer = players.find((actor) => actor.key === playerSelect.value) || null;
    if (selectedPlayer) spriteInput.value = selectedPlayer.icono || "";
    else spriteInput.value = "";
    spriteSave.disabled = !selectedPlayer?.linkedActorId || !clean(spriteInput.value);

    const previousUnit = unitSelect.value;
    const units = unitActors();
    unitSelect.innerHTML = '<option value="">— Select Unit Library entry —</option>' + units.map((actor) => {
      const sprite = actor.icono ? " · SPRITE" : " · NO SPRITE";
      const skills = actor.skillIds?.length ? ` · ${actor.skillIds.length} SKILLS` : "";
      return `<option value="${htmlEscape(actor.key)}">${htmlEscape(actor.name)}${sprite}${skills}</option>`;
    }).join("");
    if (previousUnit && units.some((actor) => actor.key === previousUnit)) unitSelect.value = previousUnit;
    return true;
  }

  function mount() {
    const doc = global.document;
    if (!doc) return false;
    const dashboard = doc.getElementById("dm-dashboard");
    const body = doc.getElementById("dm074-body") || dashboard?.querySelector?.(".dm074-body");
    if (!dashboard || !body) return false;

    let card = doc.getElementById(CARD_ID);
    if (!card) {
      card = doc.createElement("section");
      card.id = CARD_ID;
      card.className = "dm074-card";
      card.innerHTML = `
        <div class="dm074-title">Encounter Setup · Sprites + Unit Library</div>
        <div class="dm074-muted" style="margin-bottom:6px;font-size:10px">Player sprites are stored on the assigned Actor. Players and Units are staged here. Nothing enters the live FIELD until START ENCOUNTER.</div>
        <div class="dm074-row" style="align-items:center">
          <select id="${PLAYER_SELECT_ID}"><option value="">— Select Player —</option></select>
        </div>
        <div class="dm074-row" style="margin-top:5px">
          <input id="${PLAYER_SPRITE_ID}" type="url" placeholder="Player sprite URL (https://...)" style="min-width:0;flex:1;background:#090909;color:#ddd;border:1px solid #55472f;padding:5px">
          <button id="${PLAYER_SAVE_ID}" type="button">SAVE SPRITE</button>
        </div>
        <div class="dm074-row" style="margin-top:9px">
          <select id="${UNIT_SELECT_ID}"><option value="">— Select Unit Library entry —</option></select>
          <input id="${UNIT_QTY_ID}" type="number" min="1" max="20" value="1" title="Quantity" style="width:48px;background:#090909;color:#ddd;border:1px solid #55472f;padding:5px">
        </div>
        <div class="dm074-row" style="margin-top:5px">
          <button id="${UNIT_ENEMY_ID}" type="button">STAGE ENEMY</button>
          <button id="${UNIT_ALLY_ID}" type="button">STAGE ALLY</button>
        </div>
        <div class="dm074-row" style="margin-top:7px">
          <button id="${START_ID}" type="button" style="flex:1">START ENCOUNTER</button>
          <button id="${CLEAR_ID}" type="button">CLEAR DRAFT</button>
        </div>
        <div id="${STATUS_ID}" class="dm074-muted" style="margin-top:6px;font-size:10px">Select a Player sprite or a Unit from the Library.</div>`;
      const anchor = doc.getElementById("dm074-player-entry") || body.querySelector(".dm074-card");
      if (anchor?.nextSibling) body.insertBefore(card, anchor.nextSibling);
      else body.appendChild(card);

      const playerSelect = card.querySelector(`#${PLAYER_SELECT_ID}`);
      const spriteInput = card.querySelector(`#${PLAYER_SPRITE_ID}`);
      const spriteSave = card.querySelector(`#${PLAYER_SAVE_ID}`);
      const unitSelect = card.querySelector(`#${UNIT_SELECT_ID}`);
      const qtyInput = card.querySelector(`#${UNIT_QTY_ID}`);
      const enemyButton = card.querySelector(`#${UNIT_ENEMY_ID}`);
      const allyButton = card.querySelector(`#${UNIT_ALLY_ID}`);
      const startButton = card.querySelector(`#${START_ID}`);
      const clearButton = card.querySelector(`#${CLEAR_ID}`);

      playerSelect.addEventListener("change", render);
      spriteInput.addEventListener("input", () => {
        const selected = playerActors().find((actor) => actor.key === playerSelect.value);
        spriteSave.disabled = !selected?.linkedActorId || !clean(spriteInput.value);
      });
      spriteSave.addEventListener("click", async () => {
        const actor = playerActors().find((entry) => entry.key === playerSelect.value);
        if (!actor) return;
        spriteSave.disabled = true;
        setStatus(`Saving sprite for ${actor.name}…`);
        try {
          const result = await savePlayerSprite(actor, spriteInput.value);
          setStatus(`${actor.name}: sprite saved${result.activeCombatantsUpdated ? ` and updated on ${result.activeCombatantsUpdated} active combatant(s)` : ""}.`, "ok");
        } catch (error) {
          setStatus(`Could not save Player sprite: ${error?.message || error}`, "error");
        }
        render();
      });

      const deploy = async (faction) => {
        const actor = unitActors().find((entry) => entry.key === unitSelect.value);
        if (!actor) return;
        const qty = Math.max(1, Math.min(20, Math.trunc(Number(qtyInput.value) || 1)));
        enemyButton.disabled = true;
        allyButton.disabled = true;
        setStatus(`Staging ${qty} × ${actor.name} as ${faction.toUpperCase()}…`);
        try {
          const created = await deployLibraryUnit(actor, faction, qty);
          setStatus(`${created.length} × ${actor.name} staged as ${faction.toUpperCase()} from Unit Library.`, "ok");
        } catch (error) {
          setStatus(`Could not deploy Unit: ${error?.message || error}`, "error");
        } finally {
          enemyButton.disabled = false;
          allyButton.disabled = false;
        }
      };
      enemyButton.addEventListener("click", () => deploy("enemy"));
      allyButton.addEventListener("click", () => deploy("ally"));
      startButton.addEventListener("click", async () => {
        const session = global.LuminousBattleViewerEncounterSession074;
        if (!session?.startEncounter) return setStatus("Encounter session runtime is unavailable.", "error");
        startButton.disabled = true;
        clearButton.disabled = true;
        setStatus("Starting staged encounter…");
        try {
          const result = await session.startEncounter({ db: state.db, draftCombatants: state.combatants });
          setStatus(`Encounter ${result.encounterId} started in PRE_COMBAT_PLANNING.`, "ok");
        } catch (error) {
          setStatus(error?.message === "EMPTY_ENCOUNTER_DRAFT" ? "Draft is empty. Stage Players or Units first." : `Could not start encounter: ${error?.message || error}`, "error");
        } finally {
          startButton.disabled = false;
          clearButton.disabled = false;
        }
      });
      clearButton.addEventListener("click", async () => {
        const session = global.LuminousBattleViewerEncounterSession074;
        if (!session?.clearDraft) return setStatus("Encounter session runtime is unavailable.", "error");
        clearButton.disabled = true;
        try {
          await session.clearDraft({ db: state.db });
          setStatus("Encounter draft cleared.", "ok");
        } catch (error) {
          setStatus(`Could not clear draft: ${error?.message || error}`, "error");
        } finally {
          clearButton.disabled = false;
        }
      });
    }
    render();
    return true;
  }

  function scheduleMount() {
    if (!global.document || state.mountTimer) return;
    let attempts = 0;
    state.mountTimer = global.setInterval?.(() => {
      attempts += 1;
      if (mount() || attempts >= 200) {
        global.clearInterval?.(state.mountTimer);
        state.mountTimer = null;
      }
    }, 25) || null;
  }

  function subscribe(path, assign, after = null) {
    if (!state.db?.ref) return;
    const ref = state.db.ref(path);
    const handler = (snapshot) => {
      const value = snapshot.val() || {};
      assign(value);
      try { after?.(value); } catch (_) {}
      mount();
      render();
    };
    ref.on("value", handler);
    state.subscriptions.push(() => ref.off("value", handler));
  }

  function init(options = {}) {
    if (state.started) { mount(); return true; }
    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);
    if (!state.db && global.document) return false;
    global.LuminousBattleViewerEncounterSession074?.init?.({ db: state.db });
    state.started = true;
    subscribe(ROOTS.players, (value) => { state.players = value; });
    subscribe(ROOTS.actors, (value) => { state.actors = value; });
    subscribe(ROOTS.units, (value) => { state.units = value; skillLoadoutRuntime()?.applyUnits?.(value); });
    subscribe(ROOTS.draftCombatants, (value) => { state.combatants = value; }, (value) => { repairCanonicalSprites(value).catch(() => {}); });
    if (!mount()) scheduleMount();
    return true;
  }

  function stop() {
    state.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    if (state.mountTimer) global.clearInterval?.(state.mountTimer);
    state.mountTimer = null;
    state.started = false;
  }

  return Object.freeze({
    version: VERSION,
    ROOTS,
    playerActors,
    unitActors,
    spriteFor,
    savePlayerSprite,
    buildLibraryCombatant,
    deployLibraryUnit,
    repairCanonicalSprites,
    mount,
    render,
    init,
    stop,
  });
});
