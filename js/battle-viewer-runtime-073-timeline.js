(function (global) {
  "use strict";
  if (global.LuminousBattleViewerTimeline073) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousBattleViewerTimeline073;
    return;
  }

  const ACTIVE_FIELD_CAP = 8;
  const TIMELINE_SPEED_STEP_MS = 170;
  const numberOr = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const state = { clashOverrides: {}, seq: 0 };

  function lexical(name, fallback = null) {
    try { return typeof global.eval === "function" ? global.eval(`typeof ${name} !== 'undefined' ? ${name} : undefined`) ?? fallback : fallback; }
    catch (_) { return fallback; }
  }
  function combatData() { return global.combatData || lexical("combatData", {}) || {}; }
  function slotTargets() { return global.slotTargets || lexical("slotTargets", {}) || {}; }
  function attackVectors() { return global.attackVectors || lexical("attackVectors", {}) || {}; }
  function adapter() { return global.LuminousBattleViewerActionAdapter073 || null; }
  function resolver() { return global.LuminousCombatActionResolver || null; }
  function schema() { return global.LuminousCombatAction || null; }
  function unitIdFromSlot(slotId) { return adapter()?.unitIdFromSlot?.(slotId) || String(slotId || "").split("_slot_")[0]; }
  function unitForSlot(slotId) { return combatData()[unitIdFromSlot(slotId)] || null; }
  function speedForSlot(slotId) { const u = unitForSlot(slotId); return numberOr(u?.resolvedSpeed ?? u?.currentSpeed ?? u?.speed, 0); }
  function wait(ms) { return new Promise((resolve) => global.setTimeout(resolve, Math.max(0, Number(ms) || 0))); }
  function isActive(unit) {
    if (!unit || unit.dead || unit.defeated || unit.removed || unit.escaped || unit.annihilated || unit.isStaggered || unit.staggered) return false;
    if (Number.isFinite(Number(unit.hp)) && Number(unit.hp) <= 0) return false;
    return global.LuminousConditionRuntime?.hasStatus?.(unit, "incapacitated") !== true;
  }

  function currentClashForTarget(targetSlotId) {
    if (state.clashOverrides[targetSlotId]) return state.clashOverrides[targetSlotId];
    const other = slotTargets()[targetSlotId];
    return other && slotTargets()[other] === targetSlotId ? other : null;
  }
  function canOverwriteClash(interceptorSlotId, targetSlotId) {
    const originalTarget = slotTargets()[targetSlotId];
    if (String(originalTarget || "") === String(interceptorSlotId)) return { allowed: true, reason: "original_target" };
    const interceptorSpeed = speedForSlot(interceptorSlotId), targetSpeed = speedForSlot(targetSlotId);
    return interceptorSpeed > targetSpeed ? { allowed: true, reason: "speed", interceptorSpeed, targetSpeed } : { allowed: false, reason: "insufficient_speed", interceptorSpeed, targetSpeed };
  }
  function confirmOverwriteClash(interceptorSlotId, targetSlotId) {
    const previous = currentClashForTarget(targetSlotId);
    state.clashOverrides[targetSlotId] = interceptorSlotId;
    try { global.dispatchEvent?.(new global.CustomEvent("luminous:clash-overwritten", { detail: { interceptorSlotId, targetSlotId, previous } })); } catch (_) {}
    return { overwritten: true, previous, interceptorSlotId, targetSlotId };
  }

  function ensureStyle() {
    if (!global.document || global.document.getElementById("luminous-bv073-style")) return;
    const style = global.document.createElement("style"); style.id = "luminous-bv073-style";
    style.textContent = `.luminous-combat-spectator{opacity:.17!important}.luminous-combat-participant{opacity:1!important}.luminous-invisible-undetected{opacity:.06!important;pointer-events:none}.luminous-invisible-located{opacity:.28!important}#luminous-clash-overwrite-modal{position:fixed;inset:0;z-index:200000;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.64)}#luminous-clash-overwrite-modal.open{display:flex}.bv073-card{min-width:min(680px,92vw);background:#111;border:2px solid #82725f;color:#eee;padding:18px;font:700 16px Arial}.bv073-row{display:grid;grid-template-columns:1fr 70px 1fr;gap:12px;align-items:center;text-align:center}.bv073-actions{display:flex;justify-content:center;gap:12px;margin-top:18px}.bv073-actions button{border:1px solid #9d8a6d;background:#201c18;color:#fff;padding:9px 18px;cursor:pointer;font-weight:800}`;
    global.document.head?.appendChild(style);
  }
  function ensureModal() {
    if (!global.document) return null;
    let modal = global.document.getElementById("luminous-clash-overwrite-modal");
    if (modal) return modal;
    modal = global.document.createElement("div"); modal.id = "luminous-clash-overwrite-modal";
    modal.innerHTML = `<div class="bv073-card"><div style="text-align:center;letter-spacing:.14em;margin-bottom:14px">OVERWRITE CLASH?</div><div class="bv073-row"><div id="bv073-left"></div><div>VS</div><div id="bv073-right"></div></div><div class="bv073-actions"><button data-action="cancel">CANCEL</button><button data-action="confirm">CONFIRM</button></div></div>`;
    global.document.body?.appendChild(modal); return modal;
  }
  function requestClashOverwrite(interceptorSlotId, targetSlotId) {
    const gate = canOverwriteClash(interceptorSlotId, targetSlotId);
    if (!gate.allowed) return Promise.resolve({ confirmed: false, gate });
    const modal = ensureModal(); if (!modal) return Promise.resolve({ confirmed: false, gate, reason: "no_dom" });
    const left = unitForSlot(interceptorSlotId), right = unitForSlot(targetSlotId);
    modal.querySelector("#bv073-left").textContent = `${left?.name || unitIdFromSlot(interceptorSlotId)} · SPD ${speedForSlot(interceptorSlotId)}`;
    modal.querySelector("#bv073-right").textContent = `${right?.name || unitIdFromSlot(targetSlotId)} · SPD ${speedForSlot(targetSlotId)}`;
    modal.classList.add("open");
    return new Promise((resolve) => {
      const done = (confirmed) => { modal.classList.remove("open"); modal.removeEventListener("click", click); global.removeEventListener?.("keydown", key); resolve({ confirmed, gate, result: confirmed ? confirmOverwriteClash(interceptorSlotId, targetSlotId) : null }); };
      const click = (e) => { if (e.target?.dataset?.action === "confirm") done(true); else if (e.target?.dataset?.action === "cancel" || e.target === modal) done(false); };
      const key = (e) => { if (e.key === "Escape" || e.key === "Backspace") { e.preventDefault(); done(false); } };
      modal.addEventListener("click", click); global.addEventListener?.("keydown", key);
    });
  }

  function actionSkill(action) { return action?.metadata?.sourceDefinition || action?.metadata?.viewerPlan?.data || {}; }
  function eventValidity(event) {
    const rt = global.LuminousConditionRuntime, actor = unitForSlot(event.actorSlotId), target = event.targetSlotId ? unitForSlot(event.targetSlotId) : null;
    if (!isActive(actor)) return { valid: false, reason: "actor_inactive" };
    if (target && !isActive(target)) return { valid: false, reason: "target_inactive" };
    if (!event.action) return { valid: false, reason: event.actionReason || "combat_action_missing" };
    const availability = rt?.actionAvailability?.(actor, "action", { viewerEvent: event, combatAction: event.action });
    if (availability?.available === false) return { valid: false, reason: availability.reason };
    if (target && rt?.canTarget?.(actor, target, actionSkill(event.action), { viewerEvent: event, combatAction: event.action })?.allowed === false) return { valid: false, reason: "condition_target_block" };
    if (event.type === "clash") {
      const opponent = unitForSlot(event.opponentSlotId);
      if (!isActive(opponent)) return { valid: false, reason: "opponent_inactive" };
      if (!event.opposingAction) return { valid: false, reason: event.opposingActionReason || "opposing_combat_action_missing" };
      if (rt?.canTarget?.(opponent, actor, actionSkill(event.opposingAction), { viewerEvent: event, combatAction: event.opposingAction })?.allowed === false) return { valid: false, reason: "opponent_condition_target_block" };
    }
    return { valid: true };
  }

  function targetSlotFor(slotId) {
    return state.clashOverrides[slotId] || attackVectors()[slotId]?.target || slotTargets()[slotId] || null;
  }
  function compileSlot(slotId, targetSlotId = null) {
    const compiled = adapter()?.compilePlan?.(slotId, targetSlotId) || { action: null, reason: "action_adapter_missing" };
    return compiled;
  }
  function plannedSlotIds() { return adapter()?.plannedSlotIds?.() || []; }
  function isClashAction(action) { return action?.resolution?.type === "clash"; }
  function buildEvents() {
    const targets = slotTargets(), vectors = attackVectors(), consumed = new Set(), events = [];
    const slots = [...new Set([...Object.keys(targets), ...Object.keys(vectors), ...plannedSlotIds()])].sort((a, b) => speedForSlot(b) - speedForSlot(a));
    const maxSpeed = slots.reduce((max, slot) => Math.max(max, speedForSlot(slot)), 0);
    for (const slot of slots) {
      if (consumed.has(slot)) continue;
      const target = targetSlotFor(slot), compiled = compileSlot(slot, target);
      const reciprocal = target && targetSlotFor(target) === slot;
      const opposing = reciprocal ? compileSlot(target, slot) : null;
      const mutualClash = Boolean(reciprocal && isClashAction(compiled.action) && isClashAction(opposing?.action));
      const participants = [unitIdFromSlot(slot)];
      if (target) participants.push(unitIdFromSlot(target));
      if (mutualClash) {
        consumed.add(slot); consumed.add(target);
        events.push({ id: `clash_${++state.seq}`, type: "clash", actorSlotId: slot, targetSlotId: target, opponentSlotId: target, action: compiled.action, actionPlan: compiled.plan, actionReason: compiled.reason, opposingAction: opposing.action, opposingPlan: opposing.plan, opposingActionReason: opposing.reason, speed: Math.max(speedForSlot(slot), speedForSlot(target)), participants: [...new Set(participants)] });
      } else {
        consumed.add(slot);
        events.push({ id: `action_${++state.seq}`, type: "action", actorSlotId: slot, targetSlotId: target, action: compiled.action, actionPlan: compiled.plan, actionReason: compiled.reason, speed: speedForSlot(slot), participants: [...new Set(participants)] });
      }
    }
    events.sort((a, b) => b.speed - a.speed || String(a.actorSlotId).localeCompare(String(b.actorSlotId)));
    events.forEach((event) => { event.readyAt = Math.max(0, (maxSpeed - event.speed) * TIMELINE_SPEED_STEP_MS); });
    return events;
  }

  function escapeCss(value) { return global.CSS?.escape ? global.CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
  function tokenNodes(id) { return global.document ? [...global.document.querySelectorAll(`#token-${escapeCss(id)},[data-unit-id="${String(id).replace(/"/g, '\\"')}"]`)] : []; }
  function applyCombatFocus(participants = []) {
    if (!global.document) return;
    const set = new Set(participants.map(String));
    Object.keys(combatData()).forEach((id) => tokenNodes(id).forEach((node) => { node.classList.toggle("luminous-combat-participant", set.has(String(id))); node.classList.toggle("luminous-combat-spectator", set.size > 0 && !set.has(String(id))); }));
  }

  function preparedDefenseFor(unit) { return unit?.__luminousPreparedDefense073 || null; }
  function consumePreparedDefense(unit, definition) {
    if (!unit || !definition) return;
    const subtype = normalizeId(definition.defenseType || definition.defenseSubtype || definition.name);
    if (subtype === "counter" || subtype === "guard") delete unit.__luminousPreparedDefense073;
  }
  function combatEngineBridge() {
    const engine = global.CombatEngine;
    if (!engine) return null;
    return new Proxy(engine, {
      get(target, prop, receiver) {
        if (prop !== "resolveUnilateralWithCounter") return Reflect.get(target, prop, receiver);
        return function (actor, skill, defender, counterSkill, options) {
          const prepared = counterSkill || preparedDefenseFor(defender);
          const result = target.resolveUnilateralWithCounter(actor, skill, defender, prepared, options || {});
          if (prepared) consumePreparedDefense(defender, prepared);
          return result;
        };
      },
    });
  }
  function viewerEffectHandlers() {
    const hooks = global.LuminousBattleViewerCombatHooks073 || {};
    return {
      viewer_defense({ actor, effect }) {
        const definition = effect.definition || {};
        actor.__luminousPreparedDefense073 = definition;
        return { armed: true, defenseType: effect.defenseType || definition.defenseType || definition.name || "defense" };
      },
      viewer_item(payload) {
        if (typeof hooks.useItem === "function") return hooks.useItem(payload);
        return { handled: false, reason: "viewer_item_handler_required" };
      },
      viewer_trait_action({ actor, effect, context }) {
        if (typeof hooks.resolveTraitAction === "function") return hooks.resolveTraitAction({ actor, effect, context });
        const plannedAction = effect.plannedAction || null, slotIndex = Number(effect.slotIndex || 0);
        if (typeof global.CombatEngine?.resolveActionSlot !== "function") return { handled: false, reason: "trait_action_resolver_missing" };
        return global.CombatEngine.resolveActionSlot(actor, slotIndex, { phase: "combat", combatData: combatData(), plannedAction, combatActionBridge: true });
      },
      ...(hooks.effectHandlers || {}),
    };
  }
  function resolverContext(event) {
    return {
      phase: schema()?.PHASES?.COMBAT_PHASE || "combat_phase",
      units: Object.values(combatData()).filter(Boolean),
      combatData: combatData(),
      engine: combatEngineBridge(),
      coinwiseResolution: true,
      isTargetAvailable: (target) => isActive(target),
      effectHandlers: viewerEffectHandlers(),
      actionMap: Object.fromEntries([event.action, event.opposingAction].filter(Boolean).map((action) => [action.id, action])),
      opposingAction: event.type === "clash" ? event.opposingAction : null,
    };
  }
  function armReactiveDefenses(events = []) {
    for (const event of events) {
      for (const action of [event.action, event.opposingAction]) {
        const subtype = normalizeId(action?.metadata?.defenseSubtype);
        if (!action || !["evade", "counter"].includes(subtype)) continue;
        const actor = combatData()[action.actorId];
        if (actor) actor.__luminousPreparedDefense073 = action.metadata?.sourceDefinition || action.metadata?.viewerPlan?.data || {};
      }
    }
  }
  function clearPreparedDefenses() { Object.values(combatData()).forEach((unit) => { if (unit) delete unit.__luminousPreparedDefense073; }); }

  async function resolveEvent(event) {
    const check = eventValidity(event);
    if (!check.valid) return { event, resolved: false, ...check };
    const api = resolver();
    if (!api?.resolveCombatAction) return { event, resolved: false, reason: "combat_action_resolver_missing" };
    const context = resolverContext(event);
    const result = api.resolveCombatAction(event.action, context);
    const handled = result?.resolved !== false;
    return { event, resolved: handled, result, actionId: event.action.id, opposingActionId: event.opposingAction?.id || null };
  }

  async function runTimeline(events = buildEvents()) {
    const pending = [...events], active = new Map(), participantLocks = new Set(), activeParticipants = new Map();
    if (!pending.length) { applyCombatFocus([]); return []; }
    armReactiveDefenses(pending);
    const startedAt = global.performance?.now?.() ?? Date.now(), results = [];
    const now = () => (global.performance?.now?.() ?? Date.now()) - startedAt;
    const canLaunch = (event) => event.participants.every((id) => !participantLocks.has(id));
    const refreshFocus = () => {
      const ids = new Set(); activeParticipants.forEach((set) => set.forEach((id) => ids.add(id))); applyCombatFocus([...ids]);
    };
    const launch = (event) => {
      event.participants.forEach((id) => participantLocks.add(id));
      activeParticipants.set(event.id, new Set(event.participants)); refreshFocus();
      const task = (async () => {
        try { const output = await resolveEvent(event); results.push(output); return output; }
        finally { event.participants.forEach((id) => participantLocks.delete(id)); activeParticipants.delete(event.id); refreshFocus(); }
      })();
      active.set(event.id, task); task.finally(() => active.delete(event.id));
    };
    try {
      while (pending.length || active.size) {
        const elapsed = now(); let launched = false;
        for (let i = 0; i < pending.length;) {
          const event = pending[i];
          if (elapsed + 1 < event.readyAt || !canLaunch(event)) { i += 1; continue; }
          pending.splice(i, 1); launch(event); launched = true;
        }
        if (!pending.length) { if (active.size) await Promise.race([...active.values()].map((task) => task.catch(() => null))); continue; }
        if (launched) { await wait(18); continue; }
        const nextReady = Math.min(...pending.map((event) => event.readyAt)), untilReady = Math.max(18, nextReady - now());
        const wake = [wait(Math.min(55, untilReady))];
        if (active.size) wake.push(Promise.race([...active.values()].map((task) => task.catch(() => null))));
        await Promise.race(wake);
      }
      return events.map((event) => results.find((row) => row.event.id === event.id) || { event, resolved: false, reason: "timeline_result_missing" });
    } finally {
      clearPreparedDefenses(); applyCombatFocus([]);
    }
  }

  async function executeCombatTimeline() {
    try { lexical("syncCombatEnginePhase", null)?.("COMBAT_ACTIVE"); } catch (_) {}
    return runTimeline(buildEvents());
  }
  function updateInvisiblePresentation(observer = null) {
    const rt = global.LuminousConditionRuntime;
    if (!rt || !global.document) return;
    Object.values(combatData()).forEach((unit) => {
      if (!unit?.id || !rt.hasStatus?.(unit, "invisible")) return;
      const located = observer ? rt.hasLocatedInvisible?.(observer, unit) : false;
      tokenNodes(unit.id).forEach((node) => { node.classList.toggle("luminous-invisible-located", Boolean(located)); node.classList.toggle("luminous-invisible-undetected", Boolean(observer && !located)); });
    });
  }

  const api = Object.freeze({
    ACTIVE_FIELD_CAP, TIMELINE_SPEED_STEP_MS, state, combatData, slotTargets, attackVectors, canOverwriteClash,
    requestClashOverwrite, confirmOverwriteClash, eventValidity, buildEvents, runTimeline, resolveEvent,
    executeCombatTimeline, applyCombatFocus, updateInvisiblePresentation, armReactiveDefenses, clearPreparedDefenses,
    ensureStyle, ensureModal,
  });
  global.LuminousBattleViewerTimeline073 = api;
  ensureStyle(); ensureModal();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
