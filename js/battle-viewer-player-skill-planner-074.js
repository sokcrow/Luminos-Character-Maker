(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global) global.LuminousBattleViewerPlayerSkillPlanner074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const ROOTS = Object.freeze({
    players: "campaña/jugadores",
    combatants: "campaña/combate/combatants",
    plannedActions: "campaña/combate/plannedActions",
    combatState: "campaña/combate/estado",
  });
  const PANEL_ID = "bv074-player-skill-planner";
  const STYLE_ID = "bv074-player-skill-planner-style";
  const HOOK_GUARD = "__luminousPlayerSkillPlanner074";

  const state = {
    db: null,
    auth: null,
    players: {},
    combatants: {},
    plans: {},
    combatState: null,
    selectedSkillId: null,
    pendingTargeting: null,
    subscriptions: [],
    authUnsubscribe: null,
    started: false,
    hookTimer: null,
  };

  const clean = (value) => String(value ?? "").trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const htmlEscape = (value) => clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function ownershipRuntime() {
    if (global?.LuminousBattleViewerOwnership074) return global.LuminousBattleViewerOwnership074;
    if (typeof require === "function") {
      try { return require("./battle-viewer-ownership-074.js"); } catch (_) {}
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

  function playerUid(player = {}) {
    const ownership = ownershipRuntime();
    if (ownership?.playerUid) return clean(ownership.playerUid(player));
    return clean(player.uid || player.vinculado_a || player.vinculo_jugador);
  }

  function currentAuthUid() {
    return clean(state.auth?.currentUser?.uid);
  }

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
    const raw = clean(slotId);
    const marker = "_slot_";
    const splitAt = raw.lastIndexOf(marker);
    return splitAt >= 0 ? raw.slice(0, splitAt) : raw;
  }

  function slotIndexFromId(slotId) {
    const raw = clean(slotId);
    const marker = "_slot_";
    const splitAt = raw.lastIndexOf(marker);
    if (splitAt < 0) return null;
    const value = Number(raw.slice(splitAt + marker.length));
    return Number.isInteger(value) && value >= 0 ? value : null;
  }

  function currentOwnerContext() {
    const player = resolveAuthenticatedPlayer();
    if (!player.ok) return { ...player, combatant: null, unit: null, unitId: null };
    const combatant = resolveOwnedCombatant(player.playerId);
    if (!combatant.ok) return { ...player, combatant, unit: null, unitId: null };
    return { ...player, combatant, unit: combatant.unit, unitId: combatant.unitId };
  }

  function equippedSkillsFor(ownerPlayerId = null) {
    const owner = ownerPlayerId ? { ok: true, playerId: clean(ownerPlayerId) } : resolveAuthenticatedPlayer();
    if (!owner.ok) return [];
    const combatant = resolveOwnedCombatant(owner.playerId);
    if (!combatant.ok) return [];
    const loadout = skillLoadoutRuntime();
    const ids = loadout?.skillIdsFor ? loadout.skillIdsFor(combatant.unit) : Array.isArray(combatant.unit?.skillIds) ? combatant.unit.skillIds : [];
    const library = loadout?.skillLibrary?.() || {};
    return [...new Set(ids.map(clean).filter(Boolean))].map((id) => {
      const raw = library[id] || {};
      return { id, name: clean(raw.name || raw.nombre) || id };
    });
  }

  function ownsCombatSlot(ownerPlayerId, slotId) {
    const ownership = ownershipRuntime();
    const combatant = resolveOwnedCombatant(ownerPlayerId);
    if (!combatant.ok) return false;
    const unitId = unitIdFromSlot(slotId);
    const slotIndex = slotIndexFromId(slotId);
    if (slotIndex == null) return false;
    const ids = ownership?.unitIdentitySet?.(combatant.unit, combatant.unitId) || new Set([combatant.unitId]);
    return ids.has(unitId) && ownership?.isAuthorizedActionSlot?.(combatant.unit, slotIndex) === true;
  }

  function buildSkillPlan({ authUid = currentAuthUid(), ownerPlayerId = null, slotIndex = null, slotId = null, skillId, targetId } = {}) {
    const uid = clean(authUid);
    if (!uid) return { ok: false, reason: "AUTH_REQUIRED", payload: null };

    const player = ownerPlayerId
      ? { ok: true, playerId: clean(ownerPlayerId), player: state.players?.[clean(ownerPlayerId)] || null }
      : resolveAuthenticatedPlayer(uid);
    if (!player.ok || !player.playerId) return { ok: false, reason: player.reason || "PLAYER_NOT_FOUND", payload: null };
    if (playerUid(player.player || {}) && playerUid(player.player || {}) !== uid) return { ok: false, reason: "AUTH_UID_MISMATCH", payload: null };

    const resolved = resolveOwnedCombatant(player.playerId);
    if (!resolved.ok) return { ok: false, reason: resolved.reason || "COMBATANT_NOT_FOUND", payload: null };

    const requestedSlotIndex = slotIndex != null ? Number(slotIndex) : slotIndexFromId(slotId);
    if (!Number.isInteger(requestedSlotIndex) || requestedSlotIndex < 0) return { ok: false, reason: "ACTION_SLOT_REQUIRED", payload: null };
    if (slotId && !ownsCombatSlot(player.playerId, slotId)) return { ok: false, reason: "ACTION_SLOT_NOT_OWNED", payload: null };

    const loadout = skillLoadoutRuntime();
    const selectedSkillId = clean(skillId);
    if (!selectedSkillId) return { ok: false, reason: "SKILL_ID_REQUIRED", payload: null };
    if (!loadout?.ownsSkill?.(resolved.unit, selectedSkillId)) return { ok: false, reason: "SKILL_NOT_EQUIPPED", payload: null };

    const target = clean(targetId);
    if (!target) return { ok: false, reason: "TARGET_REQUIRED", payload: null };
    if (!state.combatants?.[target]) return { ok: false, reason: "TARGET_NOT_FOUND", payload: null };

    const unitId = clean(resolved.unitId || resolved.unit?.id || resolved.unit?.unitId);
    const payload = {
      unitId,
      kind: "skill",
      skillId: selectedSkillId,
      targetId: target,
      status: "planned",
      scheduledBy: player.playerId,
      schedulerUid: uid,
    };

    const ownership = ownershipRuntime();
    const authorization = ownership?.authorizePlanWrite?.({
      authUid: uid,
      ownerPlayerId: player.playerId,
      slotIndex: requestedSlotIndex,
      action: payload,
      combatants: state.combatants,
      players: state.players,
      allowLegacy: true,
    });
    if (!authorization?.ok) return { ok: false, reason: authorization?.reason || "PLAN_NOT_AUTHORIZED", payload: null };

    return {
      ok: true,
      reason: null,
      ownerPlayerId: player.playerId,
      unit: resolved.unit,
      unitId,
      slotIndex: requestedSlotIndex,
      payload,
    };
  }

  function planAt(ownerPlayerId, slotIndex) {
    return state.plans?.[clean(ownerPlayerId)]?.[slotIndex] || state.plans?.[clean(ownerPlayerId)]?.[String(slotIndex)] || null;
  }

  async function scheduleSkill(options = {}) {
    if (clean(state.combatState).toUpperCase() !== "PRE_COMBAT_PLANNING") return { ok: false, reason: "NOT_IN_PLANNING", payload: null };
    const built = buildSkillPlan(options);
    if (!built.ok) return built;
    const db = options.db || state.db;
    if (!db?.ref) return { ok: false, reason: "FIREBASE_DATABASE_REQUIRED", payload: null };

    const path = `${ROOTS.plannedActions}/${built.ownerPlayerId}/${built.slotIndex}`;
    const ref = db.ref(path);
    const existing = planAt(built.ownerPlayerId, built.slotIndex);
    if (existing) {
      if (clean(existing.schedulerUid) !== clean(built.payload.schedulerUid) || clean(existing.scheduledBy) !== built.ownerPlayerId || clean(existing.status) !== "planned") {
        return { ok: false, reason: "ACTION_SLOT_ALREADY_RESERVED", payload: null };
      }
      await ref.remove();
    }
    await ref.set(built.payload);
    state.plans = {
      ...(state.plans || {}),
      [built.ownerPlayerId]: {
        ...(state.plans?.[built.ownerPlayerId] || {}),
        [String(built.slotIndex)]: clone(built.payload),
      },
    };
    render();
    return { ...built, written: true };
  }

  async function cancelSkillPlan(slotIndex, options = {}) {
    const owner = options.ownerPlayerId ? { ok: true, playerId: clean(options.ownerPlayerId) } : resolveAuthenticatedPlayer();
    if (!owner.ok) return { ok: false, reason: owner.reason || "PLAYER_NOT_FOUND" };
    const index = Number(slotIndex);
    if (!Number.isInteger(index) || index < 0) return { ok: false, reason: "ACTION_SLOT_REQUIRED" };
    const existing = planAt(owner.playerId, index);
    if (!existing) return { ok: true, reason: null, removed: false };
    const uid = clean(options.authUid || currentAuthUid());
    if (clean(existing.schedulerUid) !== uid || clean(existing.scheduledBy) !== owner.playerId || clean(existing.status) !== "planned") return { ok: false, reason: "PLAN_NOT_OWNED" };
    const db = options.db || state.db;
    if (!db?.ref) return { ok: false, reason: "FIREBASE_DATABASE_REQUIRED" };
    await db.ref(`${ROOTS.plannedActions}/${owner.playerId}/${index}`).remove();
    const nextOwnerPlans = { ...(state.plans?.[owner.playerId] || {}) };
    delete nextOwnerPlans[String(index)];
    state.plans = { ...(state.plans || {}), [owner.playerId]: nextOwnerPlans };
    render();
    return { ok: true, reason: null, removed: true };
  }

  function selectSkill(skillId) {
    const id = clean(skillId);
    const owner = resolveAuthenticatedPlayer();
    if (!owner.ok) return { ok: false, reason: owner.reason || "PLAYER_NOT_FOUND" };
    const allowed = equippedSkillsFor(owner.playerId).some((row) => row.id === id);
    if (!allowed) return { ok: false, reason: "SKILL_NOT_EQUIPPED" };
    state.selectedSkillId = id;
    render();
    return { ok: true, reason: null, skillId: id };
  }

  function clearSelectedSkill() {
    state.selectedSkillId = null;
    render();
  }

  function emitLog(message, type = "normal") {
    try {
      if (typeof global.addLogEntry === "function") global.addLogEntry(message, type);
      else global.console?.log?.(`[PlayerSkillPlanner074] ${message}`);
    } catch (_) {}
  }

  function ensureStyle() {
    const doc = global.document;
    if (!doc || doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{position:fixed;left:12px;bottom:12px;z-index:16000;width:min(560px,calc(100vw - 24px));background:rgba(10,8,7,.96);border:1px solid #8a673d;box-shadow:0 8px 28px rgba(0,0,0,.65);color:#eee;font:12px Arial,sans-serif;padding:10px;box-sizing:border-box}
      #${PANEL_ID}[hidden]{display:none!important}.bv074-psp-title{font:700 15px var(--font-limbus,Arial);letter-spacing:.1em;color:#ffe877;margin-bottom:7px}.bv074-psp-meta{color:#aaa;font-size:10px;margin-bottom:7px}.bv074-psp-skills{display:flex;gap:5px;flex-wrap:wrap}.bv074-psp-skill{border:1px solid #68543a;background:#17130f;color:#ddd;padding:6px 8px;cursor:pointer}.bv074-psp-skill.selected{border-color:#ffe877;color:#ffe877;box-shadow:0 0 8px rgba(255,232,119,.25)}.bv074-psp-slots{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.bv074-psp-slot{display:flex;align-items:center;gap:5px;border:1px solid #3d342b;padding:4px 6px;color:#aaa}.bv074-psp-cancel{border:0;background:#3a1914;color:#ff9c8b;cursor:pointer;padding:2px 5px}.bv074-psp-hint{margin-top:7px;color:#8fd6a0;font-size:10px}`;
    doc.head?.appendChild(style);
  }

  function mountPanel() {
    const doc = global.document;
    if (!doc?.body) return null;
    ensureStyle();
    let panel = doc.getElementById(PANEL_ID);
    if (!panel) {
      panel = doc.createElement("section");
      panel.id = PANEL_ID;
      panel.addEventListener("click", (event) => {
        const skillButton = event.target?.closest?.("[data-bv074-skill]");
        if (skillButton) {
          selectSkill(skillButton.getAttribute("data-bv074-skill"));
          return;
        }
        const cancelButton = event.target?.closest?.("[data-bv074-cancel-slot]");
        if (cancelButton) {
          cancelSkillPlan(Number(cancelButton.getAttribute("data-bv074-cancel-slot"))).catch((error) => emitLog(`No se pudo liberar el Action Slot: ${error?.message || error}`, "interrupt"));
        }
      });
      doc.body.appendChild(panel);
    }
    return panel;
  }

  function render() {
    const panel = mountPanel();
    if (!panel) return false;
    const context = currentOwnerContext();
    if (!context.ok || !context.combatant?.ok) {
      panel.hidden = true;
      return false;
    }

    panel.hidden = false;
    const skills = equippedSkillsFor(context.playerId);
    if (state.selectedSkillId && !skills.some((row) => row.id === state.selectedSkillId)) state.selectedSkillId = null;
    const ownership = ownershipRuntime();
    const slotCount = Math.max(0, Number(ownership?.actionSlotCount?.(context.unit) || context.unit?.activeSlots || context.unit?.actionSlots || 0));
    const ownerPlans = state.plans?.[context.playerId] || {};
    const phase = clean(state.combatState).toUpperCase() || "UNKNOWN";
    const skillButtons = skills.length
      ? skills.map((skill) => `<button type="button" class="bv074-psp-skill${state.selectedSkillId === skill.id ? " selected" : ""}" data-bv074-skill="${htmlEscape(skill.id)}" title="${htmlEscape(skill.id)}">${htmlEscape(skill.name)}</button>`).join("")
      : '<span style="color:#ff9c8b">No equipped Skills.</span>';
    const slots = Array.from({ length: slotCount }, (_, index) => {
      const plan = ownerPlans[index] || ownerPlans[String(index)] || null;
      const label = plan?.kind === "skill" ? `${plan.skillId} → ${plan.targetId || "?"}` : plan ? `${plan.kind || "action"}` : "FREE";
      return `<span class="bv074-psp-slot">A${index + 1}: ${htmlEscape(label)}${plan?.status === "planned" ? `<button type="button" class="bv074-psp-cancel" data-bv074-cancel-slot="${index}" title="Cancel planned action">×</button>` : ""}</span>`;
    }).join("");
    panel.innerHTML = `
      <div class="bv074-psp-title">PLAYER SKILLS · ${htmlEscape(context.unit?.name || context.playerId)}</div>
      <div class="bv074-psp-meta">${htmlEscape(phase)} · ${skills.length} equipped Skill${skills.length === 1 ? "" : "s"}</div>
      <div class="bv074-psp-skills">${skillButtons}</div>
      <div class="bv074-psp-slots">${slots}</div>
      <div class="bv074-psp-hint">${state.selectedSkillId ? `Selected: ${htmlEscape(state.selectedSkillId)} · drag one of your Action Slots onto a target.` : "Select a Skill, then drag one of your Action Slots onto a target."}</div>`;
    return true;
  }

  function installTargetingHook() {
    if (typeof global.openTargetingMatrix !== "function" || typeof global.selectMatrixCell !== "function") return false;
    if (global.openTargetingMatrix?.[HOOK_GUARD] && global.selectMatrixCell?.[HOOK_GUARD]) return true;

    const originalOpen = global.openTargetingMatrix;
    const originalSelect = global.selectMatrixCell;

    const wrappedOpen = function (attackerSlotId, targetSlotId) {
      const selected = clean(state.selectedSkillId);
      const owner = resolveAuthenticatedPlayer();
      if (selected && owner.ok && !ownsCombatSlot(owner.playerId, attackerSlotId)) {
        emitLog("[ PLAYER SKILL ] Ese Action Slot no pertenece al Player autenticado.", "interrupt");
        state.pendingTargeting = null;
        return false;
      }
      state.pendingTargeting = { attackerSlotId: clean(attackerSlotId), targetSlotId: clean(targetSlotId) };
      return originalOpen.apply(this, arguments);
    };
    Object.defineProperty(wrappedOpen, HOOK_GUARD, { value: true, enumerable: false });

    const wrappedSelect = function () {
      const pending = state.pendingTargeting ? { ...state.pendingTargeting } : null;
      const selected = clean(state.selectedSkillId);
      const result = originalSelect.apply(this, arguments);
      state.pendingTargeting = null;
      if (selected && pending?.attackerSlotId && pending?.targetSlotId) {
        const owner = resolveAuthenticatedPlayer();
        if (!owner.ok) return result;
        const slotIndex = slotIndexFromId(pending.attackerSlotId);
        const targetId = unitIdFromSlot(pending.targetSlotId);
        scheduleSkill({ ownerPlayerId: owner.playerId, slotId: pending.attackerSlotId, slotIndex, skillId: selected, targetId })
          .then((scheduled) => {
            if (scheduled.ok) emitLog(`[ PLAYER SKILL ] ${selected} → ${targetId} reservado en Action Slot ${slotIndex + 1}.`);
            else emitLog(`[ PLAYER SKILL FAILED ] ${scheduled.reason}`, "interrupt");
          })
          .catch((error) => emitLog(`[ PLAYER SKILL FAILED ] ${error?.message || error}`, "interrupt"));
      }
      return result;
    };
    Object.defineProperty(wrappedSelect, HOOK_GUARD, { value: true, enumerable: false });

    global.openTargetingMatrix = wrappedOpen;
    global.selectMatrixCell = wrappedSelect;
    return true;
  }

  function subscribe(path, assign) {
    if (!state.db?.ref) return;
    const ref = state.db.ref(path);
    const handler = (snapshot) => { assign(snapshot.val()); render(); };
    ref.on("value", handler);
    state.subscriptions.push(() => ref.off("value", handler));
  }

  function applyPlayers(value) { state.players = value && typeof value === "object" ? value : {}; return state.players; }
  function applyCombatants(value) { state.combatants = value && typeof value === "object" ? value : {}; return state.combatants; }
  function applyPlans(value) { state.plans = value && typeof value === "object" ? value : {}; return state.plans; }
  function applyCombatState(value) { state.combatState = value == null ? null : String(value); return state.combatState; }

  function init(options = {}) {
    if (state.started) {
      installTargetingHook();
      render();
      return true;
    }
    state.db = options.db || state.db || (global.firebase?.database ? global.firebase.database() : null);
    state.auth = options.auth || state.auth || (global.firebase?.auth ? global.firebase.auth() : null);
    if (!state.db && global.document) return false;
    state.started = true;

    if (state.db) {
      subscribe(ROOTS.players, applyPlayers);
      subscribe(ROOTS.combatants, applyCombatants);
      subscribe(ROOTS.plannedActions, applyPlans);
      subscribe(ROOTS.combatState, applyCombatState);
    }
    if (state.auth?.onAuthStateChanged) {
      state.authUnsubscribe = state.auth.onAuthStateChanged(() => {
        state.selectedSkillId = null;
        render();
      });
    }

    installTargetingHook();
    if (global.document && !installTargetingHook() && typeof global.setInterval === "function") {
      state.hookTimer = global.setInterval(() => {
        if (installTargetingHook()) {
          global.clearInterval(state.hookTimer);
          state.hookTimer = null;
        }
      }, 100);
    }
    render();
    return true;
  }

  function stop() {
    state.subscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
    if (typeof state.authUnsubscribe === "function") state.authUnsubscribe();
    state.authUnsubscribe = null;
    if (state.hookTimer && typeof global.clearInterval === "function") global.clearInterval(state.hookTimer);
    state.hookTimer = null;
    state.started = false;
  }

  return Object.freeze({
    version: VERSION,
    ROOTS,
    state,
    playerUid,
    currentAuthUid,
    resolveAuthenticatedPlayer,
    resolveOwnedCombatant,
    unitIdFromSlot,
    slotIndexFromId,
    currentOwnerContext,
    equippedSkillsFor,
    ownsCombatSlot,
    buildSkillPlan,
    planAt,
    scheduleSkill,
    cancelSkillPlan,
    selectSkill,
    clearSelectedSkill,
    installTargetingHook,
    applyPlayers,
    applyCombatants,
    applyPlans,
    applyCombatState,
    render,
    init,
    stop,
  });
});