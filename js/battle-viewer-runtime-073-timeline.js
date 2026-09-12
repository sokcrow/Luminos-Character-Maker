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
  function viewerFunction(name) { const fn = global[name] || lexical(name, null); return typeof fn === "function" ? fn : null; }
  function combatData() { return global.combatData || lexical("combatData", {}) || {}; }
  function slotTargets() { return global.slotTargets || lexical("slotTargets", {}) || {}; }
  function attackVectors() { return global.attackVectors || lexical("attackVectors", {}) || {}; }
  function adapter() { return global.LuminousBattleViewerActionAdapter073 || null; }
  function resolver() { return global.LuminousCombatActionResolver || null; }
  function schema() { return global.LuminousCombatAction || null; }
  function unitIdFromSlot(slotId) { return adapter()?.unitIdFromSlot?.(slotId) || String(slotId || "").split("_slot_")[0]; }
  function slotIndexFromId(slotId) { return adapter()?.slotIndexFromId?.(slotId) ?? Number(String(slotId || "").split("_slot_")[1] || 0); }
  function unitForSlot(slotId) { return combatData()[unitIdFromSlot(slotId)] || null; }
  function speedForSlot(slotId) { const u = unitForSlot(slotId); return numberOr(u?.resolvedSpeed ?? u?.currentSpeed ?? u?.speed, 0); }
  function wait(ms) { return new Promise((resolve) => global.setTimeout(resolve, Math.max(0, Number(ms) || 0))); }
  function isActive(unit) {
    if (!unit || unit.dead || unit.defeated || unit.removed || unit.escaped || unit.annihilated || unit.isStaggered || unit.staggered) return false;
    if (Number.isFinite(Number(unit.hp)) && Number(unit.hp) <= 0) return false;
    return global.LuminousConditionRuntime?.hasStatus?.(unit, "incapacitated") !== true;
  }

  function teamSideForUnit(unit = {}) {
    const raw = normalizeId(unit.side || unit.team || unit.faction || unit.faccion);
    return raw.includes("enemy") || raw.includes("enem") || raw === "hostile" ? "enemies" : "allies";
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

  function targetSlotFor(slotId) { return state.clashOverrides[slotId] || attackVectors()[slotId]?.target || slotTargets()[slotId] || null; }
  function compileSlot(slotId, targetSlotId = null) { return adapter()?.compilePlan?.(slotId, targetSlotId) || { action: null, reason: "action_adapter_missing" }; }
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
      const participants = [unitIdFromSlot(slot)]; if (target) participants.push(unitIdFromSlot(target));
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
  function defenseSubtype(definition) { return normalizeId(definition?.defenseType || definition?.defenseSubtype || definition?.type || definition?.name); }
  function consumePreparedDefense(unit, definition) {
    if (!unit || !definition) return;
    const subtype = defenseSubtype(definition);
    if (["counter", "evade"].includes(subtype)) delete unit.__luminousPreparedDefense073;
  }
  function trackEphemeralShield(unit, amount) {
    if (!unit) return 0;
    const gain = Math.max(0, numberOr(amount, 0));
    unit.__luminousEphemeralShield073 = Math.max(0, numberOr(unit.__luminousEphemeralShield073, 0)) + gain;
    return gain;
  }
  function combatEngineBridge() {
    const engine = global.CombatEngine;
    if (!engine) return null;
    return new Proxy(engine, {
      get(target, prop, receiver) {
        if (prop !== "resolveUnilateralWithCounter") return Reflect.get(target, prop, receiver);
        return function (actor, skill, defender, counterSkill, options) {
          const prepared = counterSkill || preparedDefenseFor(defender), subtype = defenseSubtype(prepared);
          if (prepared && subtype === "evade" && typeof target.resolveEvade === "function") {
            const evadeResult = target.resolveEvade(defender, prepared, actor, skill);
            if (!evadeResult?.evadeDestroyed) return { attackLogs: [], pendingActions: [], damageTaken: 0, evaded: true, evadeResult };
            consumePreparedDefense(defender, prepared);
            const remainingCoins = Array.isArray(evadeResult.coinsBeaten) ? evadeResult.coinsBeaten : [];
            if (!remainingCoins.length) return { attackLogs: [], pendingActions: [], damageTaken: 0, evaded: true, evadeResult };
            const remainingSkill = { ...skill, coins: remainingCoins, coinAmount: remainingCoins.length };
            const hitResult = target.resolveUnilateralWithCounter(actor, remainingSkill, defender, null, options || {});
            return { ...hitResult, evadeResult, evadeDestroyed: true };
          }
          if (prepared && subtype === "counter") {
            const result = target.resolveUnilateralWithCounter(actor, skill, defender, null, options || {});
            let counterResult = null;
            if (isActive(defender) && isActive(actor)) counterResult = target.resolveUnilateralWithCounter(defender, prepared, actor, null, { skipUseHooks: false, clashResult: null, combatants: Object.values(combatData()).filter(Boolean), counterReaction073: true });
            consumePreparedDefense(defender, prepared);
            return { ...result, counterResolved: Boolean(counterResult), counterResult };
          }
          return target.resolveUnilateralWithCounter(actor, skill, defender, counterSkill || null, options || {});
        };
      },
    });
  }

  function genericItemEffect({ actor, targets, effect }) {
    const item = effect?.item || {}, target = targets?.[0] || actor, itemType = normalizeId(item.itemType || item.type);
    const consume = viewerFunction("consumeItem"), apply = viewerFunction("applyItemEffect");
    if (consume && apply) {
      if (!consume(item)) return { handled: false, reason: "item_depleted" };
      return { handled: true, result: apply(item, target?.id || actor?.id, actor?.id, effect.plan || null) };
    }
    if (Number.isFinite(Number(item.quantity))) {
      if (Number(item.quantity) <= 0) return { handled: false, reason: "item_depleted" };
      item.quantity = Math.max(0, Number(item.quantity) - 1);
    }
    const amount = Math.max(0, numberOr(item.effectAmount ?? item.amount, 0));
    if (itemType === "hp_healing" && target) {
      const maxHp = Math.max(numberOr(target.maxHp ?? target.maxHP, target.hp), numberOr(target.hp, 0));
      const before = numberOr(target.hp, 0); target.hp = Math.min(maxHp, before + amount);
      return { handled: true, healed: target.hp - before, targetId: target.id || null };
    }
    if (itemType === "sp_healing" && target) {
      const maxSp = numberOr(target.maxSp ?? target.maxSP, 45), before = numberOr(target.sp, 0); target.sp = Math.min(maxSp, before + amount);
      return { handled: true, healedSp: target.sp - before, targetId: target.id || null };
    }
    return { handled: false, reason: "viewer_item_handler_required", itemType };
  }
  function viewerEffectHandlers() {
    const hooks = global.LuminousBattleViewerCombatHooks073 || {};
    return {
      viewer_defense({ actor, effect }) {
        const definition = effect.definition || {}, subtype = normalizeId(effect.defenseType || definition.defenseType || definition.defenseSubtype || definition.name);
        if (subtype === "guard") {
          if (typeof global.CombatEngine?.resolveGuard !== "function") return { resolved: false, reason: "guard_resolver_missing" };
          const result = global.CombatEngine.resolveGuard(actor, definition);
          trackEphemeralShield(actor, result?.guardPower);
          return { resolved: true, defenseType: subtype, ...result };
        }
        if (["evade", "counter"].includes(subtype)) return { resolved: true, armed: Boolean(preparedDefenseFor(actor)), defenseType: subtype, prearmed: true };
        actor.__luminousPreparedDefense073 = definition;
        return { resolved: true, armed: true, defenseType: subtype };
      },
      viewer_item(payload) {
        if (typeof hooks.useItem === "function") return hooks.useItem(payload);
        return genericItemEffect(payload);
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

  function sharedActionMap(events = []) {
    const map = {};
    for (const event of events) {
      for (const action of [event?.action, event?.opposingAction]) {
        if (action?.id) map[action.id] = action;
      }
    }
    return map;
  }

  function eventDependencies(events = []) {
    const actionToEvent = new Map();
    for (const event of events) {
      for (const action of [event?.action, event?.opposingAction]) if (action?.id) actionToEvent.set(action.id, event.id);
    }
    const dependencies = new Map(events.map((event) => [event.id, new Set()]));
    for (const helperEvent of events) {
      for (const action of [helperEvent?.action, helperEvent?.opposingAction]) {
        if (!action || action.source?.type !== "universal" || normalizeId(action.source?.id) !== "help") continue;
        for (const effect of action.effects || []) {
          if (normalizeId(effect?.type) !== "modify_combat_action" || !effect.targetActionId) continue;
          const targetEventId = actionToEvent.get(effect.targetActionId);
          if (targetEventId && targetEventId !== helperEvent.id) dependencies.get(targetEventId)?.add(helperEvent.id);
        }
      }
    }
    return dependencies;
  }

  function createTimelineSharedContext(events = []) {
    const helpRemaining = { allies: 1, enemies: 1 };
    return {
      actionMap: sharedActionMap(events),
      dependencies: eventDependencies(events),
      completedEventIds: new Set(),
      consumeHelp({ actor } = {}) {
        const side = teamSideForUnit(actor || {});
        if ((helpRemaining[side] || 0) <= 0) return { consumed: false, reason: "team_help_spent" };
        helpRemaining[side] = 0;
        return { consumed: true, remaining: 0, side };
      },
      helpRemaining,
    };
  }

  function refreshEventActions(event, shared = {}) {
    const map = shared.actionMap || {};
    if (event?.action?.id && map[event.action.id]) event.action = map[event.action.id];
    if (event?.opposingAction?.id && map[event.opposingAction.id]) event.opposingAction = map[event.opposingAction.id];
    return event;
  }

  function resolverContext(event, shared = {}) {
    const localActionMap = Object.fromEntries([event.action, event.opposingAction].filter(Boolean).map((action) => [action.id, action]));
    return {
      phase: schema()?.PHASES?.COMBAT_PHASE || "combat_phase",
      units: Object.values(combatData()).filter(Boolean),
      combatData: combatData(),
      engine: combatEngineBridge(),
      coinwiseResolution: true,
      isTargetAvailable: (target) => isActive(target),
      effectHandlers: viewerEffectHandlers(),
      actionMap: shared.actionMap || localActionMap,
      consumeHelp: shared.consumeHelp,
      opposingAction: event.type === "clash" ? event.opposingAction : null,
    };
  }
  function armReactiveDefenses(events = []) {
    for (const event of events) for (const action of [event.action, event.opposingAction]) {
      const subtype = normalizeId(action?.metadata?.defenseSubtype);
      if (!action || !["evade", "counter"].includes(subtype)) continue;
      const actor = combatData()[action.actorId];
      if (actor) actor.__luminousPreparedDefense073 = action.metadata?.sourceDefinition || action.metadata?.viewerPlan?.data || {};
    }
  }
  function clearPreparedDefenses() { Object.values(combatData()).forEach((unit) => { if (unit) delete unit.__luminousPreparedDefense073; }); }

  function updateClaimedPlan(action, claimed) {
    if (!action || !claimed) return;
    action.metadata = { ...(action.metadata || {}), viewerPlan: claimed };
    for (const effect of action.effects || []) if (normalizeId(effect.type) === "viewer_trait_action") effect.plannedAction = claimed;
  }
  async function claimSharedAction(action) {
    const ownerPlayerId = action?.metadata?.sharedOwnerPlayerId;
    if (!ownerPlayerId) return { required: false, claimed: true, action };
    const claim = viewerFunction("claimSharedPlannedAction");
    if (!claim) return { required: true, claimed: false, reason: "shared_claim_bridge_missing", action };
    try {
      const planned = await claim(ownerPlayerId, Number(action.metadata?.viewerSlotIndex || 0));
      if (!planned) return { required: true, claimed: false, reason: "shared_action_not_claimed", action };
      if (planned.scheduledBy != null && String(planned.scheduledBy) !== String(ownerPlayerId)) return { required: true, claimed: false, reason: "shared_action_owner_mismatch", action, planned };
      updateClaimedPlan(action, planned);
      return { required: true, claimed: true, action, planned, ownerPlayerId };
    } catch (error) { return { required: true, claimed: false, reason: "shared_action_claim_error", error, action }; }
  }
  function finishPayloadFromCombatAction(action, result) {
    const traitEffect = result?.resolution?.effects?.find?.((row) => normalizeId(row?.effect?.type) === "viewer_trait_action");
    if (traitEffect?.result) return traitEffect.result;
    const available = result?.resolved === true;
    return { handled: true, planned: action?.metadata?.viewerPlan || null, result: { available, trait: { id: action?.source?.id || null }, reasons: available ? [] : [result?.reason || "combat_action_failed"] } };
  }
  async function finishSharedAction(action, result, claim) {
    if (!claim?.required || !claim?.claimed) return null;
    const finish = viewerFunction("finishSharedPlannedAction");
    if (!finish) return { finished: false, reason: "shared_finish_bridge_missing" };
    try { return { finished: true, payload: await finish(claim.ownerPlayerId, Number(action.metadata?.viewerSlotIndex || 0), finishPayloadFromCombatAction(action, result)) }; }
    catch (error) { return { finished: false, reason: "shared_finish_error", error }; }
  }

  async function resolveEvent(event, shared = {}) {
    refreshEventActions(event, shared);
    const check = eventValidity(event);
    if (!check.valid) return { event, resolved: false, ...check };
    const api = resolver();
    if (!api?.resolveCombatAction) return { event, resolved: false, reason: "combat_action_resolver_missing" };

    const claimA = await claimSharedAction(event.action);
    if (!claimA.claimed) return { event, resolved: false, reason: claimA.reason, sharedClaim: claimA };
    let claimB = { required: false, claimed: true };
    if (event.opposingAction) {
      claimB = await claimSharedAction(event.opposingAction);
      if (!claimB.claimed) {
        if (typeof schema()?.cancelCombatAction === "function") event.opposingAction = schema().cancelCombatAction(event.opposingAction, { type: claimB.reason || "shared_action_not_claimed" }).action;
        else event.opposingAction.state = "cancelled";
      }
    }

    const context = resolverContext(event, shared), result = api.resolveCombatAction(event.action, context);
    if (shared.actionMap && result?.action?.id) shared.actionMap[result.action.id] = result.action;
    if (shared.actionMap && Array.isArray(result?.actions)) {
      for (const action of result.actions) if (action?.id) shared.actionMap[action.id] = action;
    }
    const finishedA = await finishSharedAction(event.action, result, claimA);
    const finishedB = event.opposingAction ? await finishSharedAction(event.opposingAction, result, claimB) : null;
    return { event, resolved: result?.resolved !== false, result, actionId: event.action.id, opposingActionId: event.opposingAction?.id || null, shared: { claimA, claimB, finishedA, finishedB } };
  }

  async function runTimeline(events = buildEvents()) {
    const pending = [...events], active = new Map(), participantLocks = new Set(), activeParticipants = new Map();
    if (!pending.length) { applyCombatFocus([]); return []; }
    const shared = createTimelineSharedContext(events);
    armReactiveDefenses(pending);
    const startedAt = global.performance?.now?.() ?? Date.now(), results = [];
    const now = () => (global.performance?.now?.() ?? Date.now()) - startedAt;
    const dependenciesDone = (event) => [...(shared.dependencies.get(event.id) || [])].every((eventId) => shared.completedEventIds.has(eventId));
    const canLaunch = (event) => dependenciesDone(event) && event.participants.every((id) => !participantLocks.has(id));
    const refreshFocus = () => { const ids = new Set(); activeParticipants.forEach((set) => set.forEach((id) => ids.add(id))); applyCombatFocus([...ids]); };
    const launch = (event) => {
      event.participants.forEach((id) => participantLocks.add(id)); activeParticipants.set(event.id, new Set(event.participants)); refreshFocus();
      const task = (async () => {
        try { const output = await resolveEvent(event, shared); results.push(output); return output; }
        finally {
          shared.completedEventIds.add(event.id);
          event.participants.forEach((id) => participantLocks.delete(id));
          activeParticipants.delete(event.id);
          refreshFocus();
        }
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
        const wake = [wait(Math.min(55, untilReady))]; if (active.size) wake.push(Promise.race([...active.values()].map((task) => task.catch(() => null))));
        await Promise.race(wake);
      }
      return events.map((event) => results.find((row) => row.event.id === event.id) || { event, resolved: false, reason: "timeline_result_missing" });
    } finally { clearPreparedDefenses(); applyCombatFocus([]); }
  }

  async function syncCombatPhase() {
    try { viewerFunction("syncCombatEnginePhase")?.("COMBAT_ACTIVE"); } catch (_) {}
    const db = global.db || lexical("db", null), path = lexical("COMBAT_STATE_PATH", null);
    if (db?.ref && path) {
      try { await db.ref(path).set("COMBAT_ACTIVE"); } catch (error) { global.console?.error?.("No se pudo sincronizar COMBAT_ACTIVE en Firebase:", error); }
    }
  }
  async function executeCombatTimeline() { await syncCombatPhase(); return runTimeline(buildEvents()); }
  function updateInvisiblePresentation(observer = null) {
    const rt = global.LuminousConditionRuntime; if (!rt || !global.document) return;
    Object.values(combatData()).forEach((unit) => {
      if (!unit?.id || !rt.hasStatus?.(unit, "invisible")) return;
      const located = observer ? rt.hasLocatedInvisible?.(observer, unit) : false;
      tokenNodes(unit.id).forEach((node) => { node.classList.toggle("luminous-invisible-located", Boolean(located)); node.classList.toggle("luminous-invisible-undetected", Boolean(observer && !located)); });
    });
  }

  const api = Object.freeze({
    ACTIVE_FIELD_CAP, TIMELINE_SPEED_STEP_MS, state, combatData, slotTargets, attackVectors, canOverwriteClash,
    requestClashOverwrite, confirmOverwriteClash, eventValidity, buildEvents, runTimeline, resolveEvent, executeCombatTimeline,
    applyCombatFocus, updateInvisiblePresentation, armReactiveDefenses, clearPreparedDefenses, trackEphemeralShield,
    claimSharedAction, finishSharedAction, syncCombatPhase, ensureStyle, ensureModal,
    sharedActionMap, eventDependencies, createTimelineSharedContext,
  });
  global.LuminousBattleViewerTimeline073 = api;
  ensureStyle(); ensureModal();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
