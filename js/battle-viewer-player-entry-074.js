(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousBattleViewerPlayerEntry074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const ROOTS = Object.freeze({
    players: "campaña/jugadores",
    actors: "campaña/actores",
    units: "campaña/base_datos_unidades",
    skills: "campaña/base_datos_skills",
    combatants: "campaña/combate/combatants",
  });
  const CARD_ID = "dm074-player-entry";
  const SELECT_ID = "dm074-player-entry-select";
  const ADD_ID = "dm074-player-entry-add";
  const STATUS_ID = "dm074-player-entry-status";

  const state = {
    db: null,
    players: {},
    actors: {},
    units: {},
    skills: {},
    combatants: {},
    subscriptions: [],
    started: false,
    mountTimer: null,
  };

  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  const safeKey = (value, fallback = "player") => clean(value).replace(/[.#$\[\]\/]/g, "_") || fallback;
  const htmlEscape = (value) => clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");


  // Character-sheet spell loadouts. Only canonical spells that already have a
  // Limbus implementation are included here; unsupported sheet spells are not
  // represented by placeholders.
  const KNOWN_PLAYER_SPELL_LOADOUTS = Object.freeze([
    Object.freeze({
      id: "calipsys",
      aliases: Object.freeze(["calipsys"]),
      combatSpellIds: Object.freeze(["fire_bolt", "absorb_elements", "thunderwave", "calm_emotions", "mirror_image"]),
      roleSpellIds: Object.freeze([]),
      spellCastOverrides: Object.freeze({
        thunderwave: Object.freeze({ classId: "artificer", source: "armorer" }),
        calm_emotions: Object.freeze({ classId: "artificer", abilityId: "cha", source: "lanae" }),
        mirror_image: Object.freeze({ classId: "artificer", source: "armorer" }),
      }),
    }),
    Object.freeze({
      id: "pierre_careme_kikunae",
      aliases: Object.freeze(["pierre careme kikunae"]),
      combatSpellIds: Object.freeze([
        "poison_spray", "mind_sliver", "chill_touch", "absorb_elements", "shield", "thunderwave",
        "chromatic_orb", "dissonant_whispers", "crown_of_madness", "scorching_ray",
        "animal_friendship", "suggestion",
      ]),
      roleSpellIds: Object.freeze(["message", "thaumaturgy"]),
      spellCastOverrides: Object.freeze({}),
    }),
    Object.freeze({
      id: "angelo_v",
      aliases: Object.freeze(["angelo v"]),
      combatSpellIds: Object.freeze([
        "vicious_mockery", "silvery_barbs", "calm_emotions", "mirror_image",
        "hold_person", "suggestion", "hypnotic_pattern",
      ]),
      roleSpellIds: Object.freeze([
        "mage_hand", "prestidigitation", "distort_value", "comprehend_languages", "speak_with_animals",
      ]),
      spellCastOverrides: Object.freeze({
        mirror_image: Object.freeze({ classId: "bard", source: "character_sheet" }),
      }),
    }),
  ]);

  const KNOWN_PLAYER_SKILL_LOADOUTS = Object.freeze([
    Object.freeze({
      id: "angelo_v",
      aliases: Object.freeze(["angelo v"]),
      skillSlotIds: Object.freeze([
        "angelo_steps_to_perfection",
        "angelo_blood_art",
        "angelo_my_masterpiece",
      ]),
    }),
  ]);


  function normalizeKnownPlayerName(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function knownSpellLoadoutForActor(actor = {}) {
    const raw = actor?.raw && typeof actor.raw === "object" ? actor.raw : {};
    const candidates = [
      actor.name, actor.characterName, actor.character_name, actor.playerId, actor.sourceId,
      raw.characterName, raw.character_name, raw.nombre, raw.name,
    ].map(normalizeKnownPlayerName).filter(Boolean);
    const match = KNOWN_PLAYER_SPELL_LOADOUTS.find((entry) => entry.aliases.some((alias) => {
      const wanted = normalizeKnownPlayerName(alias);
      return candidates.some((candidate) => candidate === wanted || candidate.startsWith(`${wanted} `));
    }));
    return match ? clone(match) : null;
  }


  function knownSkillLoadoutForActor(actor = {}) {
    const raw = actor?.raw && typeof actor.raw === "object" ? actor.raw : {};
    const candidates = [
      actor.name, actor.characterName, actor.character_name, actor.playerId, actor.sourceId,
      raw.characterName, raw.character_name, raw.nombre, raw.name,
    ].map(normalizeKnownPlayerName).filter(Boolean);
    const match = KNOWN_PLAYER_SKILL_LOADOUTS.find((entry) => entry.aliases.some((alias) => {
      const wanted = normalizeKnownPlayerName(alias);
      return candidates.some((candidate) => candidate === wanted || candidate.startsWith(`${wanted} `));
    }));
    return match ? clone(match) : null;
  }

  function applyKnownSkillLoadoutToCombatant(record = {}, loadout = null) {
    const next = clone(record || {}) || {};
    if (!loadout) return next;
    const signatureIds = [...new Set((loadout.skillSlotIds || []).map(clean).filter(Boolean))];
    const existingSlots = Array.isArray(next.skillSlotIds)
      ? next.skillSlotIds.map(clean).filter(Boolean)
      : Array.isArray(next.skillIds) ? next.skillIds.map(clean).filter(Boolean) : [];
    const skillSlotIds = [...signatureIds, ...existingSlots.filter((id) => !signatureIds.includes(id))];
    const skillIds = [...new Set(skillSlotIds)];
    next.skillSlotIds = skillSlotIds;
    next.skillIds = skillIds;
    next.equippedSkillIndex = {
      ...(next.equippedSkillIndex && typeof next.equippedSkillIndex === "object" ? next.equippedSkillIndex : {}),
      ...Object.fromEntries(skillIds.map((id) => [id, true])),
    };
    const characterBuild = next.characterBuild && typeof next.characterBuild === "object" ? clone(next.characterBuild) : {};
    next.characterBuild = {
      ...characterBuild,
      signatureSkillIds: signatureIds,
      signatureSkillLoadoutSource: "character_sheet",
      signatureSkillCharacterId: loadout.id,
    };
    return next;
  }

  function signatureSkillUpdatePatch(record = {}, loadout = null) {
    if (!loadout) return null;
    const next = applyKnownSkillLoadoutToCombatant(record, loadout);
    return {
      skillSlotIds: next.skillSlotIds,
      skillIds: next.skillIds,
      equippedSkillIndex: next.equippedSkillIndex,
      "characterBuild/signatureSkillIds": next.characterBuild.signatureSkillIds,
      "characterBuild/signatureSkillLoadoutSource": next.characterBuild.signatureSkillLoadoutSource,
      "characterBuild/signatureSkillCharacterId": next.characterBuild.signatureSkillCharacterId,
    };
  }

  async function syncKnownPlayerSkillLoadout(actor = {}, options = {}) {
    const loadout = options.loadout || knownSkillLoadoutForActor(actor);
    if (!loadout) return { matched: false, synced: false, loadout: null };
    const db = options.db || state.db;
    if (!db?.ref) return { matched: true, synced: false, reason: "FIREBASE_DATABASE_REQUIRED", loadout };
    const combatants = options.combatants || state.combatants || {};
    const existing = playerAlreadyInCombat(actor, combatants);
    if (!existing?.key) return { matched: true, synced: false, reason: "COMBATANT_NOT_FOUND", loadout };
    const patchedCombatant = applyKnownSkillLoadoutToCombatant(existing.combatant, loadout);
    const patch = signatureSkillUpdatePatch(existing.combatant, loadout);
    const ref = db.ref(`${ROOTS.combatants}/${existing.key}`);
    if (typeof ref?.update === "function") await ref.update(patch);
    if (state.combatants?.[existing.key]) state.combatants[existing.key] = patchedCombatant;
    return {
      matched: true,
      synced: true,
      loadout,
      combatantKey: existing.key,
      combatant: patchedCombatant,
    };
  }

  function buildSpellSelectionIndex(ids = []) {
    return Object.fromEntries([...new Set((ids || []).map(clean).filter(Boolean))].map((id) => [id, true]));
  }

  function applyKnownSpellLoadoutToRecord(record = {}, loadout = null) {
    const next = clone(record || {}) || {};
    if (!loadout) return next;
    const combatSpellIds = [...new Set((loadout.combatSpellIds || []).map(clean).filter(Boolean))];
    const roleSpellIds = [...new Set((loadout.roleSpellIds || []).map(clean).filter(Boolean))];
    const spellCastOverrides = clone(loadout.spellCastOverrides || {});
    const characterBuild = next.characterBuild && typeof next.characterBuild === "object" ? clone(next.characterBuild) : {};
    const selectionIndex = buildSpellSelectionIndex(combatSpellIds);

    // Replace every canonical selection carrier used by the combat runtime so
    // stale/test placeholder ids cannot shadow the character-sheet loadout.
    next.spellIds = combatSpellIds;
    next.spellSelections = combatSpellIds;
    next.spellSelectionIndex = selectionIndex;
    next.characterBuild = {
      ...characterBuild,
      spellIds: combatSpellIds,
      spellSelections: combatSpellIds,
      spellSelectionIndex: selectionIndex,
      roleSpellSelections: roleSpellIds,
      spellCastOverrides,
      spellLoadoutSource: "character_sheet",
      spellLoadoutCharacterId: loadout.id,
    };
    return next;
  }

  function spellLoadoutUpdatePatch(loadout = null) {
    if (!loadout) return null;
    const record = applyKnownSpellLoadoutToRecord({}, loadout);
    return {
      spellIds: record.spellIds,
      spellSelections: record.spellSelections,
      spellSelectionIndex: record.spellSelectionIndex,
      "characterBuild/spellIds": record.characterBuild.spellIds,
      "characterBuild/spellSelections": record.characterBuild.spellSelections,
      "characterBuild/spellSelectionIndex": record.characterBuild.spellSelectionIndex,
      "characterBuild/roleSpellSelections": record.characterBuild.roleSpellSelections,
      "characterBuild/spellCastOverrides": record.characterBuild.spellCastOverrides,
      "characterBuild/spellLoadoutSource": record.characterBuild.spellLoadoutSource,
      "characterBuild/spellLoadoutCharacterId": record.characterBuild.spellLoadoutCharacterId,
    };
  }

  async function syncKnownPlayerSpellLoadout(actor = {}, options = {}) {
    const loadout = options.loadout || knownSpellLoadoutForActor(actor);
    if (!loadout) return { matched: false, synced: false, loadout: null };
    const db = options.db || state.db;
    if (!db?.ref) return { matched: true, synced: false, reason: "FIREBASE_DATABASE_REQUIRED", loadout };
    const playerId = clean(actor.playerId || actor.sourceId);
    if (!playerId) return { matched: true, synced: false, reason: "PLAYER_ID_REQUIRED", loadout };

    const patch = spellLoadoutUpdatePatch(loadout);
    const playerRef = db.ref(`${ROOTS.players}/${playerId}`);
    if (typeof playerRef?.update === "function") await playerRef.update(patch);

    const currentPlayer = options.players?.[playerId] || state.players?.[playerId] || actor.raw || {};
    const patchedPlayer = applyKnownSpellLoadoutToRecord(currentPlayer, loadout);
    if (state.players?.[playerId]) state.players[playerId] = patchedPlayer;

    const combatants = options.combatants || state.combatants || {};
    const existing = playerAlreadyInCombat(actor, combatants);
    let patchedCombatant = existing?.combatant ? applyKnownSpellLoadoutToRecord(existing.combatant, loadout) : null;
    if (existing?.key) {
      const combatantRef = db.ref(`${ROOTS.combatants}/${existing.key}`);
      if (typeof combatantRef?.update === "function") await combatantRef.update(patch);
      if (state.combatants?.[existing.key]) state.combatants[existing.key] = patchedCombatant;
    }

    return {
      matched: true,
      synced: true,
      loadout,
      playerId,
      player: patchedPlayer,
      combatantKey: existing?.key || null,
      combatant: patchedCombatant,
    };
  }

  function actorLibrary() {
    if (global?.LuminousVttActorLibrary) return global.LuminousVttActorLibrary;
    if (typeof require === "function") {
      try { return require("./vtt/actor-library.js"); } catch (_) {}
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

  function normalizePlayerActors(players = {}, actors = {}) {
    const library = actorLibrary();
    if (!library?.normalizePlayerActor) throw new Error("ACTOR_LIBRARY_REQUIRED");
    return Object.entries(players || {})
      .map(([id, player]) => library.normalizePlayerActor(id, player || {}, actors || {}))
      .sort((a, b) => clean(a.name).localeCompare(clean(b.name)));
  }

  function playerCombatantKey(actor = {}) {
    return `player:${safeKey(actor.playerId || actor.sourceId || actor.actorId)}`;
  }

  function identitySet(entity = {}) {
    const actorRef = entity.actorRef && typeof entity.actorRef === "object" ? entity.actorRef : {};
    return new Set([
      entity.id,
      entity.combatId,
      entity.combat_id,
      entity.playerId,
      entity.player_id,
      entity.ownerPlayerId,
      entity.owner_player_id,
      entity.ownerUid,
      entity.canonicalOwnerUid,
      entity.canonicalPlayerKey,
      entity.actorId,
      entity.actor_id,
      actorRef.id,
    ].map(clean).filter(Boolean));
  }

  function playerAlreadyInCombat(actor, combatants = {}) {
    if (!actor) return null;
    const wanted = new Set([
      playerCombatantKey(actor),
      actor.playerId,
      actor.sourceId,
      actor.ownerUid,
      actor.actorId,
      actor.linkedActorId,
    ].map(clean).filter(Boolean));
    for (const [key, combatant] of Object.entries(combatants || {})) {
      const ids = identitySet({ ...(combatant || {}), id: combatant?.id || key });
      if ([...wanted].some((id) => ids.has(id))) return { key, combatant };
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

  function resolvePlayerUnit(actor, units = state.units) {
    const runtime = skillLoadoutRuntime();
    if (!runtime?.resolvePlayerUnit) return { ok: false, reason: "SKILL_LOADOUT_RUNTIME_REQUIRED", unitId: null, unit: null, matches: [] };
    return runtime.resolvePlayerUnit(actor, units || {});
  }

  function buildPlayerCombatant(actor, options = {}) {
    if (!actor || clean(actor.category) !== "player") throw new Error("PLAYER_ACTOR_REQUIRED");
    const playerId = clean(actor.playerId || actor.sourceId);
    const ownerUid = clean(actor.ownerUid) || null;
    const actorId = clean(actor.linkedActorId || actor.actorId);
    if (!playerId) throw new Error("PLAYER_ID_REQUIRED");
    if (!actor.linkedActorId) throw new Error("PLAYER_ACTOR_LINK_REQUIRED");

    const knownSpellLoadout = knownSpellLoadoutForActor(actor);
    const raw = applyKnownSpellLoadoutToRecord(clone(actor.raw || {}) || {}, knownSpellLoadout);
    const combatId = playerCombatantKey(actor);
    const maxHp = firstFinite(raw.maxHp, raw.maxHP, raw.hp_max, raw.combatStats?.hp_max);
    const hp = firstFinite(raw.hp, raw.currentHp, raw.currentHP, raw.hp_actual, raw.combatStats?.hp_actual, maxHp);
    const sp = firstFinite(raw.sp, raw.currentSp, raw.currentSP, raw.sp_actual, raw.combatStats?.sp_actual, 0);
    const actionSlots = Math.max(1, Math.trunc(firstFinite(raw.actionSlots, raw.activeSlots, raw.action_slots_count, 1) || 1));
    const actionSlotIndex = buildActionSlotIndex(actionSlots);

    const unitResolution = options.unitResolution || resolvePlayerUnit(actor, options.units || state.units);
    if (unitResolution?.reason === "AMBIGUOUS_PLAYER_UNIT") throw new Error("AMBIGUOUS_PLAYER_UNIT");
    const loadoutRuntime = skillLoadoutRuntime();
    const sourceUnit = unitResolution?.ok ? unitResolution.unit : null;
    const skillSlotIds = sourceUnit && loadoutRuntime?.skillSlotIdsFor ? loadoutRuntime.skillSlotIdsFor(sourceUnit) : [];
    const skillIds = sourceUnit && loadoutRuntime?.skillIdsFor ? loadoutRuntime.skillIdsFor(sourceUnit) : [];
    const equippedSkillIndex = sourceUnit && loadoutRuntime?.buildEquippedSkillIndex ? loadoutRuntime.buildEquippedSkillIndex(skillIds) : {};
    const hydrated = sourceUnit && loadoutRuntime?.hydrateLoadout ? loadoutRuntime.hydrateLoadout(sourceUnit, options.skills || state.skills) : null;

    let combatant = {
      ...raw,
      id: combatId,
      combatId,
      name: clean(actor.name) || playerId,
      characterName: clean(actor.name) || playerId,
      actorCategory: "player",
      category: "player",
      isPlayer: true,
      type: raw.type || "player",
      playerId,
      ownerPlayerId: playerId,
      ownerUid,
      actorId,
      actorRef: { scope: "players", id: clean(actor.sourceId || playerId) },
      canonicalScope: "player",
      canonicalPlayerKey: playerId,
      canonicalOwnerUid: ownerUid,
      characterLink: { mode: "player", uid: ownerUid, playerId, actorId },
      dynamicActorToken: false,
      icono: actor.icono || raw.icono || null,
      tokenImage: actor.tokenImage || actor.icono || raw.icono || null,
      portrait: actor.portrait || actor.icono || raw.icono || null,
      actionSlots,
      activeSlots: actionSlots,
      actionSlotIndex,
      skillSlotIds,
      skillIds,
      equippedSkillIndex,
      skillLoadoutState: !sourceUnit ? "unit_not_found" : hydrated?.hasErrors ? "invalid" : "ready",
      skillLoadoutMissingIds: hydrated?.missingIds || [],
      skillLoadoutInvalidIds: hydrated?.invalidIds || [],
      statusEffects: raw.statusEffects && typeof raw.statusEffects === "object" ? clone(raw.statusEffects) : {},
      entrySource: "dm_player_entry_074",
      enteredCombatAt: Number.isFinite(Number(options.now)) ? Number(options.now) : Date.now(),
    };
    if (unitResolution?.ok) combatant.unitRef = { scope: "units", id: clean(unitResolution.unitId) };
    if (maxHp != null) combatant.maxHp = maxHp;
    if (hp != null) combatant.hp = hp;
    if (sp != null) combatant.sp = sp;
    combatant = applyKnownSkillLoadoutToCombatant(combatant, knownSkillLoadoutForActor(actor));
    return combatant;
  }

  function playerEntries(players = state.players, actors = state.actors, combatants = state.combatants, units = state.units, skills = state.skills) {
    const loadoutRuntime = skillLoadoutRuntime();
    return normalizePlayerActors(players, actors).map((actor) => {
      const unitResolution = resolvePlayerUnit(actor, units);
      const loadout = unitResolution.ok && loadoutRuntime?.hydrateLoadout ? loadoutRuntime.hydrateLoadout(unitResolution.unit, skills) : null;
      return {
        actor,
        linked: Boolean(actor.linkedActorId),
        existing: playerAlreadyInCombat(actor, combatants),
        unitResolution,
        loadout,
        spellLoadout: knownSpellLoadoutForActor(actor),
        skillLoadout: knownSkillLoadoutForActor(actor),
      };
    });
  }

  async function addPlayerActor(actor, options = {}) {
    const db = options.db || state.db;
    if (!db?.ref) throw new Error("FIREBASE_DATABASE_REQUIRED");

    const loadout = knownSpellLoadoutForActor(actor);
    const synced = loadout
      ? await syncKnownPlayerSpellLoadout(actor, { ...options, db, loadout, combatants: options.combatants || state.combatants })
      : { matched: false, synced: false, loadout: null };
    const effectiveActor = synced.player ? { ...actor, raw: synced.player } : actor;
    const signatureLoadout = knownSkillLoadoutForActor(effectiveActor);

    let signatureSynced = { matched: Boolean(signatureLoadout), synced: false, loadout: signatureLoadout };
    const beforeExisting = playerAlreadyInCombat(effectiveActor, options.combatants || state.combatants);
    if (signatureLoadout && beforeExisting) {
      signatureSynced = await syncKnownPlayerSkillLoadout(effectiveActor, {
        ...options,
        db,
        loadout: signatureLoadout,
        combatants: options.combatants || state.combatants,
      });
    }

    const existing = playerAlreadyInCombat(effectiveActor, options.combatants || state.combatants);
    if (existing) {
      let combatant = signatureSynced.combatant || synced.combatant || existing.combatant;
      combatant = applyKnownSkillLoadoutToCombatant(applyKnownSpellLoadoutToRecord(combatant, loadout), signatureLoadout);
      return {
        added: false,
        reason: "already_in_combat",
        key: existing.key,
        combatant: clone(combatant),
        spellLoadoutSynced: synced.synced,
        spellLoadout: loadout,
        signatureSkillLoadoutSynced: signatureSynced.synced,
        signatureSkillLoadout: signatureLoadout,
      };
    }

    const unitResolution = options.unitResolution || resolvePlayerUnit(effectiveActor, options.units || state.units);
    if (unitResolution?.reason === "AMBIGUOUS_PLAYER_UNIT") return { added: false, reason: "ambiguous_player_unit", key: null, combatant: null };
    const combatant = buildPlayerCombatant(effectiveActor, { ...options, unitResolution });
    const key = playerCombatantKey(effectiveActor);
    const ref = db.ref(`${ROOTS.combatants}/${key}`);
    let occupied = false;
    const result = await ref.transaction((current) => {
      if (current) { occupied = true; return; }
      return combatant;
    });
    if (!result?.committed) {
      return { added: false, reason: occupied ? "already_in_combat" : "write_aborted", key, combatant: clone(result?.snapshot?.val?.() || null) };
    }
    return {
      added: true,
      reason: null,
      key,
      combatant: clone(result.snapshot?.val?.() || combatant),
      spellLoadoutSynced: synced.synced,
      spellLoadout: loadout,
      signatureSkillLoadoutSynced: Boolean(signatureLoadout),
      signatureSkillLoadout: signatureLoadout,
    };
  }

  function setStatus(message, kind = "info") {
    const node = global.document?.getElementById?.(STATUS_ID);
    if (!node) return;
    node.textContent = message || "";
    node.dataset.kind = kind;
    node.style.color = kind === "error" ? "#ff8b78" : kind === "ok" ? "#8fd6a0" : "#8a8a8a";
  }

  function render() {
    const select = global.document?.getElementById?.(SELECT_ID);
    const add = global.document?.getElementById?.(ADD_ID);
    if (!select || !add) return false;
    const previous = select.value;
    const entries = playerEntries();
    select.innerHTML = '<option value="">— Select campaign Player —</option>' + entries.map(({ actor, linked, existing, unitResolution, loadout, spellLoadout, skillLoadout }) => {
      const key = actor.key;
      let suffix = existing ? " · IN COMBAT" : linked ? " · READY" : " · NO ACTOR LINK";
      if (!existing && linked) {
        if (unitResolution.reason === "AMBIGUOUS_PLAYER_UNIT") suffix = " · AMBIGUOUS UNIT";
        else if (!unitResolution.ok) suffix = " · NO UNIT LOADOUT";
        else suffix = ` · UNIT · ${loadout?.skillIds?.length || 0} SKILLS`;
      }
      if (spellLoadout) suffix += ` · ${spellLoadout.combatSpellIds.length} SPELLS`;
      if (skillLoadout) suffix += ` · ${skillLoadout.skillSlotIds.length} SIGNATURE SKILLS`;
      return `<option value="${htmlEscape(key)}">${htmlEscape(actor.name)}${suffix}</option>`;
    }).join("");
    if (previous && entries.some(({ actor }) => actor.key === previous)) select.value = previous;
    const selected = entries.find(({ actor }) => actor.key === select.value) || null;
    const ambiguous = selected?.unitResolution?.reason === "AMBIGUOUS_PLAYER_UNIT";
    const canSyncExistingLoadout = Boolean(selected?.existing && (selected?.spellLoadout || selected?.skillLoadout));
    add.disabled = !selected || (!canSyncExistingLoadout && (!selected.linked || Boolean(selected.existing) || ambiguous));
    add.textContent = canSyncExistingLoadout ? "SYNC LOADOUT" : "ADD PLAYER";
    if (!entries.length) setStatus("No campaign Players found.");
    else if (selected?.existing && (selected?.spellLoadout || selected?.skillLoadout)) {
      const parts = [];
      if (selected.spellLoadout) parts.push(`${selected.spellLoadout.combatSpellIds.length} Spells`);
      if (selected.skillLoadout) parts.push(`${selected.skillLoadout.skillSlotIds.length} Signature Skills`);
      setStatus(`Player is already in combat · ${parts.join(" · ")} ready to sync.`);
    }
    else if (selected?.existing) setStatus("Player is already in combat.");
    else if (selected && !selected.linked) setStatus("Player has no assigned Actor; cannot create a canonical combatant.", "error");
    else if (ambiguous) setStatus("Multiple Player Units match this Player. Resolve the Unit linkage before entering combat.", "error");
    else if (selected && !selected.unitResolution.ok) setStatus(`Ready: ${selected.actor.name} · no linked Unit loadout; combatant will have 0 equipped Skills.`);
    else if (selected?.loadout?.hasErrors) setStatus(`Ready: ${selected.actor.name} · loadout has missing/invalid Skill IDs.`, "error");
    else if (selected) setStatus(`Ready: ${selected.actor.name} · ${selected.loadout?.skillIds?.length || 0} equipped Skills.`);
    else setStatus("Select a Player to add to combat.");
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
        <div class="dm074-title">Campaign Players → Combat</div>
        <div class="dm074-row">
          <select id="${SELECT_ID}"><option value="">— Select campaign Player —</option></select>
          <button id="${ADD_ID}" type="button">ADD PLAYER</button>
        </div>
        <div id="${STATUS_ID}" class="dm074-muted" style="margin-top:6px;font-size:10px">Loading campaign Players…</div>`;
      const firstCard = body.querySelector(".dm074-card");
      if (firstCard) body.insertBefore(card, firstCard);
      else body.appendChild(card);
      const select = card.querySelector(`#${SELECT_ID}`);
      const add = card.querySelector(`#${ADD_ID}`);
      select.addEventListener("change", render);
      add.addEventListener("click", async () => {
        const entry = playerEntries().find(({ actor }) => actor.key === select.value);
        if (!entry) return;
        add.disabled = true;
        setStatus(`Adding ${entry.actor.name}…`);
        try {
          const result = await addPlayerActor(entry.actor, { unitResolution: entry.unitResolution });
          const syncedExisting = result.reason === "already_in_combat" && (result.spellLoadoutSynced || result.signatureSkillLoadoutSynced);
          setStatus(
            result.added
              ? `${entry.actor.name} added to combat${result.spellLoadoutSynced || result.signatureSkillLoadout ? " · sheet loadout synced." : "."}`
              : result.reason === "ambiguous_player_unit"
                ? `${entry.actor.name} has ambiguous Unit linkage.`
                : syncedExisting
                  ? `${entry.actor.name} · sheet loadout synced; Player remains in combat.`
                  : `${entry.actor.name} is already in combat.`,
            result.added || syncedExisting ? "ok" : result.reason === "ambiguous_player_unit" ? "error" : "info"
          );
        } catch (error) {
          setStatus(`Could not add Player: ${error?.message || error}`, "error");
        }
        render();
      });
    }
    render();
    return true;
  }

  function scheduleMount() {
    const root = global;
    if (!root.document || state.mountTimer) return;
    let attempts = 0;
    state.mountTimer = root.setInterval?.(() => {
      attempts += 1;
      if (mount() || attempts >= 200) {
        root.clearInterval?.(state.mountTimer);
        state.mountTimer = null;
      }
    }, 25) || null;
  }

  function subscribe(path, assign) {
    if (!state.db?.ref) return;
    const ref = state.db.ref(path);
    const handler = (snapshot) => { assign(snapshot.val() || {}); mount(); render(); };
    ref.on("value", handler);
    state.subscriptions.push(() => ref.off("value", handler));
  }

  function init(options = {}) {
    if (state.started) { mount(); return true; }
    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);
    if (!state.db && global.document) return false;
    state.started = true;
    subscribe(ROOTS.players, (value) => { state.players = value; });
    subscribe(ROOTS.actors, (value) => { state.actors = value; });
    subscribe(ROOTS.units, (value) => { state.units = value; skillLoadoutRuntime()?.applyUnits?.(value); });
    subscribe(ROOTS.skills, (value) => { state.skills = value; skillLoadoutRuntime()?.applySkills?.(value); });
    subscribe(ROOTS.combatants, (value) => { state.combatants = value; });
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
    KNOWN_PLAYER_SPELL_LOADOUTS,
    KNOWN_PLAYER_SKILL_LOADOUTS,
    normalizeKnownPlayerName,
    knownSkillLoadoutForActor,
    applyKnownSkillLoadoutToCombatant,
    signatureSkillUpdatePatch,
    syncKnownPlayerSkillLoadout,
    knownSpellLoadoutForActor,
    buildSpellSelectionIndex,
    applyKnownSpellLoadoutToRecord,
    spellLoadoutUpdatePatch,
    syncKnownPlayerSpellLoadout,
    normalizePlayerActors,
    playerCombatantKey,
    playerAlreadyInCombat,
    buildActionSlotIndex,
    resolvePlayerUnit,
    buildPlayerCombatant,
    playerEntries,
    addPlayerActor,
    mount,
    render,
    init,
    stop,
  });
});
