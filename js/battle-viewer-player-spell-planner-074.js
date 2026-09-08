(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousBattleViewerPlayerSpellPlanner074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const ROOTS = Object.freeze({
    players: "campaña/jugadores",
    combatants: "campaña/combate/combatants",
    plannedActions: "campaña/combate/plannedActions",
    combatState: "campaña/combate/estado",
  });
  const PANEL_ID = "bv074-player-spell-planner";
  const STYLE_ID = "bv074-player-spell-planner-style";
  const HOOK_GUARD = "__luminousPlayerSpellPlanner074";

  const state = {
    db: null,
    auth: null,
    players: {},
    combatants: {},
    plans: {},
    combatState: null,
    selectedSpellId: null,
    selectedClassId: null,
    selectedSlotLevel: null,
    overcast: false,
    pendingTargeting: null,
    subscriptions: [],
    authUnsubscribe: null,
    started: false,
    hookTimer: null,
  };

  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const htmlEscape = (value) => clean(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");

  function ownershipRuntime() {
    if (global?.LuminousBattleViewerOwnership074) return global.LuminousBattleViewerOwnership074;
    if (typeof require === "function") { try { return require("./battle-viewer-ownership-074.js"); } catch (_) {} }
    return null;
  }

  function spellLoadoutRuntime() {
    if (global?.LuminousCombatSpellLoadout074) return global.LuminousCombatSpellLoadout074;
    if (typeof require === "function") { try { return require("./combat-spell-loadout-074.js"); } catch (_) {} }
    return null;
  }

  function spellcastingRuntime() {
    if (global?.LuminousSpellcastingRuntime) return global.LuminousSpellcastingRuntime;
    if (typeof require === "function") {
      try { return require("./spellcasting-basic-rules-runtime.js"); } catch (_) {}
      try { return require("./spellcasting-runtime.js"); } catch (_) {}
    }
    return null;
  }

  function skillPlanner() { return global?.LuminousBattleViewerPlayerSkillPlanner074 || null; }

  function playerUid(player = {}) {
    const ownership = ownershipRuntime();
    return clean(ownership?.playerUid?.(player) || player.uid || player.vinculado_a || player.vinculo_jugador);
  }

  function currentAuthUid() { return clean(state.auth?.currentUser?.uid); }

  function resolveAuthenticatedPlayer(uid = currentAuthUid(), players = state.players) {
    const wanted = clean(uid);
    if (!wanted) return { ok: false, reason: "AUTH_REQUIRED", playerId: null, player: null, matches: [] };
    const matches = Object.entries(players || {}).filter(([, player]) => playerUid(player || {}) === wanted);
    if (!matches.length) return { ok: false, reason: "PLAYER_NOT_FOUND", playerId: null, player: null, matches: [] };
    if (matches.length > 1) return { ok: false, reason: "AMBIGUOUS_PLAYER_AUTH", playerId: null, player: null, matches: matches.map(([id]) => id) };
    return { ok: true, reason: null, playerId: matches[0][0], player: matches[0][1], matches: [matches[0][0]] };
  }

  function resolveOwnedCombatant(ownerPlayerId, combatants = state.combatants, players = state.players) {
    const ownership = ownershipRuntime();
    if (!ownership?.resolveCombatantForPlanOwner) return { ok: false, reason: "OWNERSHIP_RUNTIME_REQUIRED", unit: null, unitId: null };
    return ownership.resolveCombatantForPlanOwner(ownerPlayerId, combatants || {}, players || {}, { allowLegacy: true });
  }

  function unitIdFromSlot(slotId) {
    const raw = clean(slotId), marker = "_slot_", splitAt = raw.lastIndexOf(marker);
    return splitAt >= 0 ? raw.slice(0, splitAt) : raw;
  }

  function slotIndexFromId(slotId) {
    const raw = clean(slotId), marker = "_slot_", splitAt = raw.lastIndexOf(marker);
    if (splitAt < 0) return null;
    const value = Number(raw.slice(splitAt + marker.length));
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  function ownsCombatSlot(ownerPlayerId, slotId) {
    const ownership = ownershipRuntime();
    const resolved = resolveOwnedCombatant(ownerPlayerId);
    if (!resolved.ok) return false;
    const index = slotIndexFromId(slotId), wantedUnitId = unitIdFromSlot(slotId);
    if (index == null) return false;
    const ids = ownership?.unitIdentitySet?.(resolved.unit, resolved.unitId) || new Set([resolved.unitId]);
    return ids.has(wantedUnitId) && ownership?.isAuthorizedActionSlot?.(resolved.unit, index) === true;
  }

  function selectionRows(player = {}) {
    const raw = Array.isArray(player.characterBuild?.spellSelections) ? player.characterBuild.spellSelections : Array.isArray(player.spellSelections) ? player.spellSelections : [];
    return raw.map((entry, index) => ({ key: String(index), spellId: clean(entry?.spellId || entry?.id || entry) })).filter((row) => row.spellId);
  }

  function spellSelectionKey(player = {}, spellId) {
    const id = clean(spellId);
    return selectionRows(player).find((row) => row.spellId === id)?.key ?? null;
  }

  function selectedSpellsFor(ownerPlayerId = null) {
    const owner = ownerPlayerId ? { ok: true, playerId: clean(ownerPlayerId), player: state.players?.[clean(ownerPlayerId)] } : resolveAuthenticatedPlayer();
    if (!owner.ok) return [];
    const resolved = resolveOwnedCombatant(owner.playerId);
    if (!resolved.ok) return [];
    const loadout = spellLoadoutRuntime();
    const ids = loadout?.spellIdsFor?.(resolved.unit) || selectionRows(owner.player || {}).map((row) => row.spellId);
    return [...new Set(ids.map(clean).filter(Boolean))].map((id) => {
      const definition = loadout?.resolveSpellDefinition?.(id) || { ok: false, reason: "SPELL_LOADOUT_RUNTIME_REQUIRED" };
      return { id, ready: definition.ok === true, reason: definition.reason || null, spell: definition.spell || null, name: clean(definition.spell?.name) || id };
    });
  }

  function castClassesFor(combatant = {}, spell = {}) {
    const loadout = spellLoadoutRuntime();
    const owned = loadout?.classIdsFor?.(combatant) || [];
    const allowed = loadout?.spellAllowedClassIds?.(spell) || [];
    return owned.filter((id) => !allowed.length || allowed.includes(id));
  }

  function castResourcePreflight(combatant, spell, classId, slotLevel, overcast) {
    if (spell?.cantrip === true || Number(slotLevel) === 0) return { available: true, reason: null, cantrip: true };
    const runtime = spellcastingRuntime();
    if (!runtime) return { available: false, reason: "SPELLCASTING_RUNTIME_REQUIRED" };
    const slot = runtime.canSpendSpellSlot?.(combatant, classId, slotLevel);
    if (slot?.available) return { available: true, reason: null, slot };
    if (overcast !== true) return { available: false, reason: slot?.reason || "SPELL_SLOT_UNAVAILABLE", slot };
    const sp = runtime.readCurrentSp?.(combatant);
    if (sp == null) return { available: false, reason: "OVERCAST_SP_UNAVAILABLE", slot };
    return { available: true, reason: null, slot, overcast: true, currentSp: sp };
  }

  function buildSpellPlan({ authUid = currentAuthUid(), ownerPlayerId = null, slotIndex = null, slotId = null, spellId, classId = null, slotLevel = null, overcast = false, targetId } = {}) {
    const uid = clean(authUid);
    if (!uid) return { ok: false, reason: "AUTH_REQUIRED", payload: null };
    const player = ownerPlayerId ? { ok: true, playerId: clean(ownerPlayerId), player: state.players?.[clean(ownerPlayerId)] || null } : resolveAuthenticatedPlayer(uid);
    if (!player.ok || !player.playerId) return { ok: false, reason: player.reason || "PLAYER_NOT_FOUND", payload: null };
    if (playerUid(player.player || {}) && playerUid(player.player || {}) !== uid) return { ok: false, reason: "AUTH_UID_MISMATCH", payload: null };

    const resolved = resolveOwnedCombatant(player.playerId);
    if (!resolved.ok) return { ok: false, reason: resolved.reason || "COMBATANT_NOT_FOUND", payload: null };
    const requestedSlotIndex = slotIndex != null ? Number(slotIndex) : slotIndexFromId(slotId);
    if (!Number.isInteger(requestedSlotIndex) || requestedSlotIndex < 0) return { ok: false, reason: "ACTION_SLOT_REQUIRED", payload: null };
    if (slotId && !ownsCombatSlot(player.playerId, slotId)) return { ok: false, reason: "ACTION_SLOT_NOT_OWNED", payload: null };

    const id = clean(spellId);
    if (!id) return { ok: false, reason: "SPELL_ID_REQUIRED", payload: null };
    const selectionKey = spellSelectionKey(player.player || {}, id);
    if (selectionKey == null) return { ok: false, reason: "SPELL_NOT_SELECTED", payload: null };
    const loadout = spellLoadoutRuntime();
    const trusted = loadout?.resolveSpellForCombatant?.(resolved.unit, id, { classId });
    if (!trusted?.ok) return { ok: false, reason: trusted?.reason || "SPELL_UNAVAILABLE", payload: null };

    const baseLevel = Math.max(0, Number(trusted.spell?.level ?? trusted.spell?.spellLevel ?? 0) || 0);
    const requestedLevel = trusted.spell?.cantrip === true ? 0 : Math.max(baseLevel, Number.isFinite(Number(slotLevel)) ? Math.trunc(Number(slotLevel)) : baseLevel);
    if (requestedLevel > 9) return { ok: false, reason: "SPELL_SLOT_LEVEL_INVALID", payload: null };
    const resource = castResourcePreflight(resolved.unit, trusted.spell, trusted.classId, requestedLevel, overcast === true);
    if (!resource.available) return { ok: false, reason: resource.reason || "SPELL_RESOURCE_UNAVAILABLE", payload: null, resource };

    const target = clean(targetId || (String(trusted.spell?.targetType || trusted.spell?.target_type).toLowerCase() === "self" ? resolved.unitId : ""));
    if (!target) return { ok: false, reason: "TARGET_REQUIRED", payload: null };
    if (!state.combatants?.[target] && target !== clean(resolved.unitId)) return { ok: false, reason: "TARGET_NOT_FOUND", payload: null };

    const payload = {
      unitId: clean(resolved.unitId || resolved.unit?.id || resolved.unit?.unitId),
      kind: "spell",
      spellId: id,
      spellSelectionKey: selectionKey,
      classId: trusted.classId,
      slotLevel: requestedLevel,
      overcast: overcast === true,
      targetId: target,
      status: "planned",
      scheduledBy: player.playerId,
      schedulerUid: uid,
    };

    const authorization = ownershipRuntime()?.authorizePlanWrite?.({ authUid: uid, ownerPlayerId: player.playerId, slotIndex: requestedSlotIndex, action: payload, combatants: state.combatants, players: state.players, allowLegacy: true });
    if (!authorization?.ok) return { ok: false, reason: authorization?.reason || "PLAN_NOT_AUTHORIZED", payload: null };
    return { ok: true, reason: null, ownerPlayerId: player.playerId, unit: resolved.unit, unitId: payload.unitId, slotIndex: requestedSlotIndex, spell: trusted.spell, classId: trusted.classId, resource, payload };
  }

  function planAt(ownerPlayerId, slotIndex) { return state.plans?.[clean(ownerPlayerId)]?.[slotIndex] || state.plans?.[clean(ownerPlayerId)]?.[String(slotIndex)] || null; }

  async function scheduleSpell(options = {}) {
    if (clean(state.combatState).toUpperCase() !== "PRE_COMBAT_PLANNING") return { ok: false, reason: "NOT_IN_PLANNING", payload: null };
    const built = buildSpellPlan(options);
    if (!built.ok) return built;
    const db = options.db || state.db;
    if (!db?.ref) return { ok: false, reason: "FIREBASE_DATABASE_REQUIRED", payload: null };
    const path = `${ROOTS.plannedActions}/${built.ownerPlayerId}/${built.slotIndex}`, ref = db.ref(path), existing = planAt(built.ownerPlayerId, built.slotIndex);
    if (existing) {
      if (clean(existing.schedulerUid) !== clean(built.payload.schedulerUid) || clean(existing.scheduledBy) !== built.ownerPlayerId || clean(existing.status) !== "planned") return { ok: false, reason: "ACTION_SLOT_ALREADY_RESERVED", payload: null };
      await ref.remove();
    }
    await ref.set(built.payload);
    state.plans = { ...(state.plans || {}), [built.ownerPlayerId]: { ...(state.plans?.[built.ownerPlayerId] || {}), [String(built.slotIndex)]: clone(built.payload) } };
    render();
    return { ...built, written: true };
  }

  async function cancelSpellPlan(slotIndex, options = {}) {
    const owner = options.ownerPlayerId ? { ok: true, playerId: clean(options.ownerPlayerId) } : resolveAuthenticatedPlayer();
    if (!owner.ok) return { ok: false, reason: owner.reason || "PLAYER_NOT_FOUND" };
    const index = Number(slotIndex), existing = planAt(owner.playerId, index), uid = clean(options.authUid || currentAuthUid());
    if (!Number.isInteger(index) || index < 0) return { ok: false, reason: "ACTION_SLOT_REQUIRED" };
    if (!existing) return { ok: true, reason: null, removed: false };
    if (clean(existing.schedulerUid) !== uid || clean(existing.scheduledBy) !== owner.playerId || clean(existing.status) !== "planned") return { ok: false, reason: "PLAN_NOT_OWNED" };
    const db = options.db || state.db;
    if (!db?.ref) return { ok: false, reason: "FIREBASE_DATABASE_REQUIRED" };
    await db.ref(`${ROOTS.plannedActions}/${owner.playerId}/${index}`).remove();
    const next = { ...(state.plans?.[owner.playerId] || {}) }; delete next[String(index)];
    state.plans = { ...(state.plans || {}), [owner.playerId]: next };
    render();
    return { ok: true, reason: null, removed: true };
  }

  function selectSpell(spellId) {
    const id = clean(spellId), owner = resolveAuthenticatedPlayer();
    if (!owner.ok) return { ok: false, reason: owner.reason || "PLAYER_NOT_FOUND" };
    const row = selectedSpellsFor(owner.playerId).find((entry) => entry.id === id);
    if (!row) return { ok: false, reason: "SPELL_NOT_SELECTED" };
    if (!row.ready) return { ok: false, reason: row.reason || "SPELL_DEFINITION_NOT_FOUND" };
    const combatant = resolveOwnedCombatant(owner.playerId);
    const classes = combatant.ok ? castClassesFor(combatant.unit, row.spell) : [];
    state.selectedSpellId = id;
    state.selectedClassId = classes.length === 1 ? classes[0] : clean(row.spell?.sourceClassId || row.spell?.classId) || null;
    state.selectedSlotLevel = row.spell?.cantrip ? 0 : Math.max(1, Number(row.spell?.level ?? row.spell?.spellLevel ?? 1) || 1);
    state.overcast = false;
    const skills = skillPlanner();
    if (skills?.state) skills.state.selectedSkillId = null;
    skills?.render?.();
    render();
    return { ok: true, reason: null, spellId: id };
  }

  function clearSelectedSpell() { state.selectedSpellId = null; state.selectedClassId = null; state.selectedSlotLevel = null; state.overcast = false; render(); }

  function emitLog(message, type = "normal") {
    try { if (typeof global.addLogEntry === "function") global.addLogEntry(message, type); else global.console?.log?.(`[PlayerSpellPlanner074] ${message}`); } catch (_) {}
  }

  function ensureStyle() {
    const doc = global.document;
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style"); style.id = STYLE_ID;
    style.textContent = `#${PANEL_ID}{position:fixed;left:12px;bottom:150px;z-index:16001;width:min(620px,calc(100vw - 24px));background:rgba(8,10,16,.97);border:1px solid #596ca0;box-shadow:0 8px 28px rgba(0,0,0,.65);color:#eee;font:12px Arial,sans-serif;padding:10px;box-sizing:border-box}#${PANEL_ID}[hidden]{display:none!important}.bv074-pspell-title{font:700 15px var(--font-limbus,Arial);letter-spacing:.1em;color:#9fc6ff;margin-bottom:7px}.bv074-pspell-meta{color:#aab2c2;font-size:10px;margin-bottom:7px}.bv074-pspell-list{display:flex;gap:5px;flex-wrap:wrap}.bv074-pspell-btn{border:1px solid #485a86;background:#101522;color:#d8e6ff;padding:6px 8px;cursor:pointer}.bv074-pspell-btn.selected{border-color:#9fc6ff;color:#fff;box-shadow:0 0 8px rgba(159,198,255,.3)}.bv074-pspell-btn:disabled{opacity:.45;cursor:not-allowed}.bv074-pspell-cast{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:8px}.bv074-pspell-cast select,.bv074-pspell-cast input{background:#0b0f18;border:1px solid #485a86;color:#fff;padding:4px}.bv074-pspell-slots{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.bv074-pspell-slot{border:1px solid #343e59;padding:4px 6px;color:#aab2c2}.bv074-pspell-cancel{border:0;background:#351b25;color:#ff9cb3;cursor:pointer;padding:2px 5px}.bv074-pspell-hint{margin-top:7px;color:#a9c7ef;font-size:10px}`;
    doc.head?.appendChild(style);
  }

  function mountPanel() {
    const doc = global.document; if (!doc?.body) return null; ensureStyle();
    let panel = doc.getElementById(PANEL_ID);
    if (!panel) {
      panel = doc.createElement("section"); panel.id = PANEL_ID;
      panel.addEventListener("click", (event) => {
        const spellButton = event.target?.closest?.("[data-bv074-spell]");
        if (spellButton) { selectSpell(spellButton.getAttribute("data-bv074-spell")); return; }
        const cancel = event.target?.closest?.("[data-bv074-spell-cancel]");
        if (cancel) cancelSpellPlan(Number(cancel.getAttribute("data-bv074-spell-cancel"))).catch((error) => emitLog(`No se pudo liberar el Action Slot: ${error?.message || error}`, "interrupt"));
      });
      panel.addEventListener("change", (event) => {
        if (event.target?.id === "bv074-spell-class") state.selectedClassId = clean(event.target.value) || null;
        if (event.target?.id === "bv074-spell-level") state.selectedSlotLevel = Math.max(0, Math.trunc(Number(event.target.value) || 0));
        if (event.target?.id === "bv074-spell-overcast") state.overcast = event.target.checked === true;
        render();
      });
      doc.body.appendChild(panel);
    }
    return panel;
  }

  function render() {
    const panel = mountPanel(); if (!panel) return false;
    const owner = resolveAuthenticatedPlayer();
    if (!owner.ok) { panel.hidden = true; return false; }
    const resolved = resolveOwnedCombatant(owner.playerId), spells = selectedSpellsFor(owner.playerId);
    if (!resolved.ok || !spells.length) { panel.hidden = true; return false; }
    panel.hidden = false;
    const selected = spells.find((row) => row.id === state.selectedSpellId) || null;
    const classes = selected ? castClassesFor(resolved.unit, selected.spell) : [];
    const maxSlots = ownershipRuntime()?.actionSlotCount?.(resolved.unit) || Number(resolved.unit?.actionSlots || 1);
    const slots = Array.from({ length: maxSlots }, (_, index) => ({ index, plan: planAt(owner.playerId, index) }));
    const baseLevel = selected?.spell?.cantrip ? 0 : Math.max(1, Number(selected?.spell?.level ?? selected?.spell?.spellLevel ?? 1) || 1);
    panel.innerHTML = `<div class="bv074-pspell-title">PLAYER SPELLS · 0.7.4</div><div class="bv074-pspell-meta">${htmlEscape(owner.playerId)} · ${clean(state.combatState).toUpperCase() || "NO PHASE"} · definitions are resolved from Content Registry.</div><div class="bv074-pspell-list">${spells.map((row) => `<button type="button" class="bv074-pspell-btn${state.selectedSpellId === row.id ? " selected" : ""}" data-bv074-spell="${htmlEscape(row.id)}" ${row.ready ? "" : "disabled"} title="${htmlEscape(row.reason || "")}">${htmlEscape(row.name)}${row.ready ? "" : " · INVALID"}</button>`).join("")}</div>${selected ? `<div class="bv074-pspell-cast"><label>Class <select id="bv074-spell-class">${classes.map((id) => `<option value="${htmlEscape(id)}" ${state.selectedClassId === id ? "selected" : ""}>${htmlEscape(id)}</option>`).join("")}</select></label><label>Slot <input id="bv074-spell-level" type="number" min="${baseLevel}" max="9" value="${Number(state.selectedSlotLevel ?? baseLevel)}" ${selected.spell?.cantrip ? "disabled" : ""}></label><label><input id="bv074-spell-overcast" type="checkbox" ${state.overcast ? "checked" : ""} ${selected.spell?.cantrip ? "disabled" : ""}> Overcast</label></div>` : ""}<div class="bv074-pspell-slots">${slots.map(({ index, plan }) => `<div class="bv074-pspell-slot">SLOT ${index + 1}: ${plan ? htmlEscape(plan.spellId || plan.skillId || plan.traitId || plan.kind || "reserved") : "free"}${plan && clean(plan.schedulerUid) === currentAuthUid() && clean(plan.status) === "planned" ? ` <button class="bv074-pspell-cancel" data-bv074-spell-cancel="${index}">×</button>` : ""}</div>`).join("")}</div><div class="bv074-pspell-hint">${selected ? `Selected: ${htmlEscape(selected.name)} · drag one of your Action Slots onto a target.` : spells.some((row) => row.ready) ? "Select a valid Spell, then drag one of your Action Slots onto a target." : "Selected Spell IDs exist, but no canonical Spell definitions are registered yet."}</div>`;
    return true;
  }

  function installTargetingHook() {
    if (typeof global.openTargetingMatrix !== "function" || typeof global.selectMatrixCell !== "function") return false;
    if (global.openTargetingMatrix?.[HOOK_GUARD] && global.selectMatrixCell?.[HOOK_GUARD]) return true;
    const originalOpen = global.openTargetingMatrix, originalSelect = global.selectMatrixCell;
    const wrappedOpen = function (attackerSlotId, targetSlotId) {
      const selected = clean(state.selectedSpellId), owner = resolveAuthenticatedPlayer();
      if (selected && owner.ok && !ownsCombatSlot(owner.playerId, attackerSlotId)) { emitLog("[ PLAYER SPELL ] Ese Action Slot no pertenece al Player autenticado.", "interrupt"); state.pendingTargeting = null; return false; }
      state.pendingTargeting = { attackerSlotId: clean(attackerSlotId), targetSlotId: clean(targetSlotId) };
      return originalOpen.apply(this, arguments);
    };
    Object.defineProperty(wrappedOpen, HOOK_GUARD, { value: true, enumerable: false });
    const wrappedSelect = function () {
      const pending = state.pendingTargeting ? { ...state.pendingTargeting } : null, selected = clean(state.selectedSpellId);
      const result = originalSelect.apply(this, arguments); state.pendingTargeting = null;
      if (selected && pending?.attackerSlotId && pending?.targetSlotId) {
        const owner = resolveAuthenticatedPlayer(); if (!owner.ok) return result;
        const index = slotIndexFromId(pending.attackerSlotId), targetId = unitIdFromSlot(pending.targetSlotId);
        scheduleSpell({ ownerPlayerId: owner.playerId, slotId: pending.attackerSlotId, slotIndex: index, spellId: selected, classId: state.selectedClassId, slotLevel: state.selectedSlotLevel, overcast: state.overcast, targetId })
          .then((scheduled) => emitLog(scheduled.ok ? `[ PLAYER SPELL ] ${selected} → ${targetId} reservado en Action Slot ${index + 1}.` : `[ PLAYER SPELL FAILED ] ${scheduled.reason}`, scheduled.ok ? "normal" : "interrupt"))
          .catch((error) => emitLog(`[ PLAYER SPELL FAILED ] ${error?.message || error}`, "interrupt"));
      }
      return result;
    };
    Object.defineProperty(wrappedSelect, HOOK_GUARD, { value: true, enumerable: false });
    global.openTargetingMatrix = wrappedOpen; global.selectMatrixCell = wrappedSelect; return true;
  }

  function subscribe(path, assign) {
    if (!state.db?.ref) return;
    const ref = state.db.ref(path), handler = (snapshot) => { assign(snapshot.val() || {}); render(); };
    ref.on("value", handler); state.subscriptions.push(() => ref.off("value", handler));
  }
  function applyPlayers(value) { state.players = value && typeof value === "object" ? value : {}; return state.players; }
  function applyCombatants(value) { state.combatants = value && typeof value === "object" ? value : {}; return state.combatants; }
  function applyPlans(value) { state.plans = value && typeof value === "object" ? value : {}; return state.plans; }
  function applyCombatState(value) { state.combatState = value; return state.combatState; }

  function init(options = {}) {
    if (state.started) return true;
    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);
    state.auth = options.auth || state.auth || (global.firebase?.auth ? global.firebase.auth() : null);
    if (!state.db && global.document) return false;
    state.started = true;
    if (state.db) {
      subscribe(ROOTS.players, applyPlayers); subscribe(ROOTS.combatants, applyCombatants); subscribe(ROOTS.plannedActions, applyPlans);
      const phaseRef = state.db.ref(ROOTS.combatState), phaseHandler = (snapshot) => { applyCombatState(snapshot.val()); render(); };
      phaseRef.on("value", phaseHandler); state.subscriptions.push(() => phaseRef.off("value", phaseHandler));
    }
    if (state.auth?.onAuthStateChanged) state.authUnsubscribe = state.auth.onAuthStateChanged(() => render());
    if (global.document) {
      mountPanel();
      state.hookTimer = global.setInterval?.(() => installTargetingHook(), 250) || null;
      state.hookTimer?.unref?.();
      installTargetingHook();
    }
    render(); return true;
  }

  function stop() {
    state.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    state.authUnsubscribe?.(); state.authUnsubscribe = null;
    if (state.hookTimer) global.clearInterval?.(state.hookTimer); state.hookTimer = null;
    state.started = false;
  }

  return Object.freeze({ version: VERSION, ROOTS, state, playerUid, currentAuthUid, resolveAuthenticatedPlayer, resolveOwnedCombatant, unitIdFromSlot, slotIndexFromId, ownsCombatSlot, selectionRows, spellSelectionKey, selectedSpellsFor, castClassesFor, castResourcePreflight, buildSpellPlan, planAt, scheduleSpell, cancelSpellPlan, selectSpell, clearSelectedSpell, installTargetingHook, applyPlayers, applyCombatants, applyPlans, applyCombatState, render, init, stop });
});