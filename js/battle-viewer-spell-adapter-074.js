(function (global, factory) {
  "use strict";
  const api = factory(global);
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (global && api) global.LuminousBattleViewerSpellAdapter074 = api;
})(typeof window !== "undefined" ? window : globalThis, function (global) {
  "use strict";

  const VERSION = "0.7.4";
  const clean = (value) => String(value ?? "").trim();
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  let installedBase = null;

  function baseAdapter() {
    if (installedBase) return installedBase;
    if (global?.LuminousBattleViewerActionAdapter073 && !global.LuminousBattleViewerActionAdapter073.__spellAdapter074) return global.LuminousBattleViewerActionAdapter073;
    if (typeof require === "function") {
      try { return require("./battle-viewer-action-adapter-073.js"); } catch (_) {}
    }
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

  function combatData(base) { return base?.combatData?.() || global.combatData || {}; }
  function unitIdFromSlot(base, slotId) { return base?.unitIdFromSlot?.(slotId) || clean(slotId).split("_slot_")[0]; }
  function planForSlot(base, slotId) { return base?.planForSlot?.(slotId) || null; }

  function spellIdForPlan(plan = {}, data = {}) {
    return clean(plan.spellId || plan.sourceId || data.libraryKey || data.spellId || data.id);
  }

  function isPlayerActor(actor = {}, plan = {}) {
    const category = normalizeId(actor.actorCategory || actor.category || actor.type);
    return plan.__ownerPlayerId != null || actor.isPlayer === true || category === "player" || normalizeId(actor.canonicalScope) === "player";
  }

  function planKind(plan = {}, data = {}) {
    return normalizeId(plan.type || plan.kind || data.kind || data.type);
  }

  function isSpellPlan(plan = {}, data = {}) {
    const kind = planKind(plan, data);
    return ["spell", "spells", "magic"].includes(kind) || (kind === "auto" && normalizeId(data.kind) === "spell") || Boolean(plan.spellId);
  }

  function trustedSpell(actor = {}, plan = {}, data = {}) {
    const spellId = spellIdForPlan(plan, data);
    if (!spellId) return { ok: false, reason: "spell_id_required", spellId: null, spell: null };
    const runtime = spellLoadoutRuntime();
    if (!runtime?.resolveSpellForCombatant) return { ok: false, reason: "spell_loadout_runtime_required", spellId, spell: null };
    const result = runtime.resolveSpellForCombatant(actor, spellId, { classId: plan.classId });
    return result.ok
      ? { ok: true, reason: null, spellId, spell: result.spell, classId: result.classId, entry: result.entry || null }
      : { ok: false, reason: String(result.reason || "spell_unavailable").toLowerCase(), spellId, spell: null, classId: null };
  }

  function requestedSlotLevel(plan = {}, spell = {}) {
    const baseLevel = Math.max(0, Math.trunc(Number(spell.level ?? spell.spellLevel ?? spell.slotLevel ?? 0) || 0));
    if (spell.cantrip === true || baseLevel === 0) return 0;
    const requested = Number(plan.slotLevel ?? plan.castLevel);
    return Math.max(baseLevel, Number.isFinite(requested) ? Math.trunc(requested) : baseLevel);
  }

  function canonicalCastResource(spell, classId, slotLevel, overcast) {
    return {
      owner: "source",
      type: "spell_cast",
      id: clean(spell.id || spell.spellId),
      amount: 1,
      metadata: { classId: clean(classId), slotLevel: Math.max(0, Number(slotLevel) || 0), overcast: overcast === true },
    };
  }

  function applyCanonicalSave(action, actor, classId, spell) {
    if (action?.resolution?.type !== "save") return action;
    const runtime = spellcastingRuntime();
    const resolved = runtime?.resolveSpellSave?.(actor, classId, spell);
    if (resolved && Number.isFinite(Number(resolved.dc))) action.resolution.save.dc = Number(resolved.dc);
    return action;
  }

  function compileTrustedPlayerSpell(base, slotId, explicitTargetSlotId, plan, actor, data) {
    const embedded = plan.combatAction || (plan.schemaVersion && plan.source && plan.resolution ? plan : null);
    if (embedded) return { action: null, plan, reason: "player_embedded_spell_action_forbidden" };

    const trusted = trustedSpell(actor, plan, data);
    if (!trusted.ok) return { action: null, plan, reason: trusted.reason, kind: "spell", spellId: trusted.spellId };
    const slotLevel = requestedSlotLevel(plan, trusted.spell);
    if (slotLevel > 9) return { action: null, plan, reason: "spell_slot_level_invalid", kind: "spell", spellId: trusted.spellId };

    const trustedPlan = {
      ...clone(plan),
      type: "spell",
      kind: "spell",
      spellId: trusted.spellId,
      classId: trusted.classId,
      slotLevel,
      data: clone(trusted.spell),
      spell: undefined,
      definition: undefined,
      sourceDefinition: undefined,
      combatAction: undefined,
    };
    const compiled = base.compilePlan(slotId, explicitTargetSlotId, trustedPlan);
    if (!compiled?.action) return compiled;
    compiled.action.source = { type: "spell", id: trusted.spellId };
    compiled.action.resources = trusted.spell.cantrip === true || slotLevel === 0
      ? []
      : [canonicalCastResource(trusted.spell, trusted.classId, slotLevel, plan.overcast === true)];
    compiled.action.metadata = {
      ...(compiled.action.metadata || {}),
      loadoutSpellId: trusted.spellId,
      canonicalSpell: true,
      sourceClassId: trusted.classId,
      slotLevel,
      overcast: plan.overcast === true,
      sourceDefinition: clone(trusted.spell),
      viewerPlan: clone(plan),
    };
    applyCanonicalSave(compiled.action, actor, trusted.classId, trusted.spell);
    return { ...compiled, source: "spell", spellId: trusted.spellId, canonicalSpell: true };
  }

  function install() {
    const base = baseAdapter();
    if (!base?.compilePlan) return false;
    if (global.LuminousBattleViewerActionAdapter073?.__spellAdapter074) return true;
    installedBase = base;

    const wrapped = Object.freeze({
      ...base,
      __spellAdapter074: true,
      spellIdForPlan,
      isSpellPlan,
      trustedSpell,
      requestedSlotLevel,
      canonicalCastResource,
      compilePlan(slotId, explicitTargetSlotId = null, providedPlan = null) {
        const plan = providedPlan || planForSlot(base, slotId);
        if (!plan) return base.compilePlan(slotId, explicitTargetSlotId, providedPlan);
        const actor = combatData(base)[unitIdFromSlot(base, slotId)] || null;
        if (!actor) return base.compilePlan(slotId, explicitTargetSlotId, providedPlan);
        const data = plan.data || plan.sourceDefinition || plan.definition || plan.spell || plan;
        if (isPlayerActor(actor, plan) && isSpellPlan(plan, data)) return compileTrustedPlayerSpell(base, slotId, explicitTargetSlotId, plan, actor, data);
        return base.compilePlan(slotId, explicitTargetSlotId, providedPlan);
      },
    });
    global.LuminousBattleViewerActionAdapter073 = wrapped;
    return true;
  }

  const api = Object.freeze({ version: VERSION, spellIdForPlan, isSpellPlan, trustedSpell, requestedSlotLevel, canonicalCastResource, compileTrustedPlayerSpell, install });
  install();
  return api;
});