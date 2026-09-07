(function (global) {
  "use strict";
  if (global.LuminousBattleViewerTimeline073) return;
  const ACTIVE_FIELD_CAP = 8;
  const numberOr = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
  const state = { clashOverrides: {}, seq: 0 };
  function lexical(name, fallback = null) { try { return typeof global.eval === "function" ? global.eval(`typeof ${name} !== 'undefined' ? ${name} : undefined`) ?? fallback : fallback; } catch (_) { return fallback; } }
  function combatData() { return global.combatData || lexical("combatData", {}) || {}; }
  function slotTargets() { return global.slotTargets || lexical("slotTargets", {}) || {}; }
  function attackVectors() { return global.attackVectors || lexical("attackVectors", {}) || {}; }
  function unitIdFromSlot(slotId) { return String(slotId || "").split("_slot_")[0]; }
  function unitForSlot(slotId) { return combatData()[unitIdFromSlot(slotId)] || null; }
  function speedForSlot(slotId) { const u = unitForSlot(slotId); return numberOr(u?.resolvedSpeed ?? u?.currentSpeed ?? u?.speed, 0); }
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
    const previous = currentClashForTarget(targetSlotId); state.clashOverrides[targetSlotId] = interceptorSlotId;
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
  function eventValidity(event) {
    const rt = global.LuminousConditionRuntime, actor = unitForSlot(event.actorSlotId), target = event.targetSlotId ? unitForSlot(event.targetSlotId) : null;
    if (!isActive(actor)) return { valid: false, reason: "actor_inactive" };
    if (target && !isActive(target)) return { valid: false, reason: "target_inactive" };
    const action = rt?.actionAvailability?.(actor, "action", { viewerEvent: event });
    if (action?.available === false) return { valid: false, reason: action.reason };
    if (target && rt?.canTarget?.(actor, target, event.skill || {}, { viewerEvent: event })?.allowed === false) return { valid: false, reason: "condition_target_block" };
    if (event.type === "clash" && event.opponentSlotId) {
      const opponent = unitForSlot(event.opponentSlotId);
      if (!isActive(opponent)) return { valid: false, reason: "opponent_inactive" };
      if (rt?.canTarget?.(opponent, actor, event.opponentSkill || {}, { viewerEvent: event })?.allowed === false) return { valid: false, reason: "opponent_condition_target_block" };
    }
    return { valid: true };
  }
  function buildEvents() {
    const targets = slotTargets(), vectors = attackVectors(), events = [], consumed = new Set();
    const slots = [...new Set([...Object.keys(targets), ...Object.keys(vectors)])].sort((a, b) => speedForSlot(b) - speedForSlot(a));
    for (const slot of slots) {
      if (consumed.has(slot)) continue;
      const target = state.clashOverrides[slot] || vectors[slot]?.target || targets[slot];
      if (!target) continue;
      const mutual = targets[target] === slot || state.clashOverrides[target] === slot;
      if (mutual) {
        consumed.add(slot); consumed.add(target);
        events.push({ id: `clash_${++state.seq}`, type: "clash", actorSlotId: slot, targetSlotId: target, opponentSlotId: target, participants: [unitIdFromSlot(slot), unitIdFromSlot(target)] });
      } else events.push({ id: `attack_${++state.seq}`, type: "attack", actorSlotId: slot, targetSlotId: target, participants: [unitIdFromSlot(slot), unitIdFromSlot(target)] });
    }
    return events;
  }
  function groupEvents(events) {
    const groups = [];
    for (const event of events) {
      const touching = groups.filter((group) => event.participants.some((p) => group.participants.has(p)));
      if (!touching.length) groups.push({ participants: new Set(event.participants), events: [event] });
      else {
        const first = touching[0]; event.participants.forEach((p) => first.participants.add(p)); first.events.push(event);
        for (const extra of touching.slice(1)) { extra.participants.forEach((p) => first.participants.add(p)); first.events.push(...extra.events); groups.splice(groups.indexOf(extra), 1); }
      }
    }
    return groups;
  }
  function escapeCss(value) { return global.CSS?.escape ? global.CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
  function tokenNodes(id) { return global.document ? [...global.document.querySelectorAll(`#token-${escapeCss(id)},[data-unit-id="${String(id).replace(/"/g, '\\"')}"]`)] : []; }
  function applyCombatFocus(participants = []) {
    if (!global.document) return;
    const set = new Set(participants.map(String));
    Object.keys(combatData()).forEach((id) => tokenNodes(id).forEach((node) => { node.classList.toggle("luminous-combat-participant", set.has(String(id))); node.classList.toggle("luminous-combat-spectator", !set.has(String(id))); }));
  }
  async function resolveEvent(event) {
    const check = eventValidity(event); if (!check.valid) return { event, resolved: false, ...check };
    const actor = unitForSlot(event.actorSlotId), target = unitForSlot(event.targetSlotId);
    if (!actor || !target) return { event, resolved: false, reason: "unit_missing" };
    if (event.type === "clash" && global.CombatEngine?.resolveStandardClash) {
      const skillA = actor.selectedSkill || event.skill, skillB = target.selectedSkill || event.opponentSkill;
      if (skillA && skillB) return { event, resolved: true, result: global.CombatEngine.resolveStandardClash(actor, skillA, target, skillB) };
    }
    const skill = actor.selectedSkill || event.skill;
    if (skill && global.CombatEngine?.resolveUnilateralWithCounter) return { event, resolved: true, result: global.CombatEngine.resolveUnilateralWithCounter(actor, skill, target, null, {}) };
    return { event, resolved: false, reason: "resolver_missing" };
  }
  async function runTimeline(events = buildEvents()) {
    const groups = groupEvents(events);
    const results = await Promise.all(groups.map(async (group) => {
      const output = [];
      for (const event of group.events) { applyCombatFocus(event.participants); output.push(await resolveEvent(event)); await new Promise((resolve) => global.setTimeout(resolve, 120)); }
      return output;
    }));
    applyCombatFocus(Object.keys(combatData()));
    return results.flat();
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
  const api = Object.freeze({ ACTIVE_FIELD_CAP, state, combatData, slotTargets, attackVectors, canOverwriteClash, requestClashOverwrite, confirmOverwriteClash, eventValidity, buildEvents, groupEvents, runTimeline, executeCombatTimeline, applyCombatFocus, updateInvisiblePresentation, ensureStyle, ensureModal });
  global.LuminousBattleViewerTimeline073 = api;
  ensureStyle(); ensureModal();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
