(function (global) {
  "use strict";
  if (global.LuminousCombatEventRuntime) return;

  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const list = value => Array.isArray(value) ? value : [];
  const adapters = new Map();
  let dependencies = null;
  const scripts = new Map();
  function normalizeTrigger(value) {
    const id = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (["combat_start", "on_combat_start", "on_encounter_start"].includes(id)) return "encounter_start";
    return id === "on_clash_win" ? "clash_win" : id;
  }
  function register(id, adapter) { adapters.set(id, adapter); }
  function notify(trigger, unit, input = {}) {
    if (!unit) return;
    for (const adapter of adapters.values()) adapter.dispatch?.(normalizeTrigger(trigger), unit, input);
  }
  function load(src, name) {
    if (global[name]) return Promise.resolve();
    if (scripts.has(src)) return scripts.get(src);
    const promise = new Promise((resolve, reject) => {
      const doc = global.document;
      if (!doc) return reject(new Error(`Missing combat dependency: ${name}`));
      const existing = [...doc.querySelectorAll("script[src]")].find(node =>
        String(node.getAttribute("src") || "").split("?")[0] === src);
      const node = existing || doc.createElement("script");
      node.addEventListener("load", () => global[name] ? resolve() : reject(new Error(`Missing combat API: ${name}`)), { once: true });
      node.addEventListener("error", () => reject(new Error(`Failed combat dependency: ${src}`)), { once: true });
      if (!existing) { node.src = src; node.async = false; (doc.head || doc.documentElement).appendChild(node); }
    });
    scripts.set(src, promise);
    promise.catch(() => scripts.delete(src));
    return promise;
  }
  async function prepare(units) {
    if (!dependencies) dependencies = (async () => {
      await load("js/status-library.js", "LuminousStatusLibrary");
      await load("js/status-engine.js", "LuminousStatusEngine");
      await load("js/trait-engine.js", "LuminousTraitEngine");
      await load("js/trait-catalog-core.js", "LuminousTraitCatalogCore");
      await load("js/archetype-engine.js", "LuminousArchetypeEngine");
      await load("js/archetype-trait-catalog.js", "LuminousArchetypeTraitCatalog");
      await load("js/class-runtime-bootstrap.js", "LuminousClassRuntimeBootstrap");
    })().catch(error => { dependencies = null; throw error; });
    await dependencies;
    // Use the existing manifest and its dependency graph for every build in the
    // roster. The DM is not restricted to the class of the focused player.
    for (const unit of units) {
      const result = await global.LuminousClassRuntimeBootstrap.boot({ context: "player", character: unit });
      if (!result?.ok) throw new Error("No se pudieron cargar las reglas de clase del combate.");
    }
    for (const adapter of adapters.values()) adapter.install?.();
    global.LuminousCombatStepRuntime?.refreshPlayback?.();
  }
  function normalizeTrait(trait) {
    const rules = list(trait.rules).map(rule => ({ ...rule,
      ...(rule.type === "status" ? { statusId: rule.statusId || rule.status,
        action: rule.action || (rule.target === "target" ? "inflict" : "gain") } : {}),
      trigger: normalizeTrigger(rule.trigger || rule.tag || "passive") }));
    const effects = [];
    for (const effect of list(trait.effects)) {
      const trigger = normalizeTrigger(effect.trigger || effect.tag);
      if (effect.type === "status" && effect.status && !effect.operations) {
        rules.push({ ...effect, type: "status", statusId: effect.status, trigger,
          action: effect.target === "target" ? "inflict" : "gain", target: effect.target || "self" });
      } else effects.push({ ...effect, trigger });
    }
    return { ...trait, effects, rules,
    };
  }
  function equippedItems(unit) {
    if (unit.equipment?.equipmentInactive === true) return [];
    const equipment = unit.equipment || {}, seen = new Set();
    const refs = [equipment.mainHand, equipment.offHand, equipment.armor, equipment.shield, ...list(equipment.accessories)];
    return refs.map(ref => {
      const id = typeof ref === "object" ? ref?.instanceId || ref?.instance_id : ref;
      const inventory = Object.values(unit.inventario_activo || {});
      return inventory.find(item => id && String(item?.instanceId || item?.instance_id) === String(id)) || (typeof ref === "object" ? ref : null);
    }).filter(item => {
      if (!item || Number(item.quantity ?? item.cantidad ?? 1) <= 0) return false;
      const id = item.instanceId || item.instance_id || item;
      if (seen.has(id)) return false;
      seen.add(id);
      if (item.requiresAttunement === true || item.requires_attunement === true || item.magic?.requiresAttunement === true || item.runtime?.magic?.requiresAttunement === true) {
        return global.LuminousItemMagicRuntime?.isAttuned?.(unit, item) === true;
      }
      return true;
    });
  }
  function traitsForUnit(unit) {
    const core = global.LuminousTraitCatalogCore, racial = global.LuminousRacialTraitCatalog;
    const definitions = { ...core?.allDefinitions?.(), ...racial?.allDefinitions?.(), ...global.LuminousArchetypeTraitCatalog?.allDefinitions?.() };
    const engine = global.LuminousTraitEngine;
    const granted = engine.resolveTraitGrants(unit, core?.allGrants?.() || [], definitions);
    const selected = global.LuminousClassMilestones?.resolveSelectedGeneralTraits?.(unit, definitions) || [];
    const rows = [...granted, ...(racial?.resolveTraitGrants?.(unit, definitions) || []),
      ...(global.LuminousArchetypeTraitCatalog?.resolveTraitGrants?.(unit, definitions) || []),
      ...selected, ...list(unit.traitDefinitions), ...list(unit.traits).filter(value => value && typeof value === "object")];
    const unique = new Map();
    for (const row of rows) if (row?.id && !unique.has(row.id)) unique.set(row.id, normalizeTrait(row));
    // Equipment rules share TraitEngine's conditions, formulas and Status store.
    // Scope IDs by instance: two distinct equipped items may grant the same rule.
    for (const [index, item] of equippedItems(unit).entries()) {
      const id = String(item.instanceId || item.instance_id || index);
      const details = item.weapon_details || item.armor_details || item.shield_details || item.accessory_details || {};
      const traits = [...list(item.traitDefinitions), ...list(item.runtime?.traits)];
      traits.push({ id: "effects", effects: [...list(item.effects), ...list(details.effects)], rules: list(details.passives || details.rules) });
      for (const trait of traits) unique.set(`equipment:${id}:${trait.id}`, normalizeTrait({ ...trait, id: `equipment:${id}:${trait.id}` }));
    }
    return [...unique.values()];
  }
  function syncResult(unit, result) {
    const status = global.LuminousStatusEngine;
    for (const outcome of result.outcomes || []) {
      if (outcome.type === "apply_status" || (outcome.type === "rule_status" && outcome.target === "self" && outcome.action !== "remove")) {
        status?.applyStatus?.(unit, outcome.statusId, { ...outcome.status, mode: "set" });
      }
      if (outcome.type === "rule_status" && outcome.target !== "self") {
        const target = result.runtime?.target || result.runtime?.defender;
        if (target && outcome.status) status?.applyStatus?.(target, outcome.statusId, { ...outcome.status, mode: "set" });
      }
      if (outcome.type === "rule_status_protection") status?.protectStatus?.(unit, outcome.statusId, { from: outcome.from, sourceTraitId: outcome.traitId });
      if (["resource", "rule_resource"].includes(outcome.type) && outcome.resourceId !== "sp") {
        unit.resources ||= {};
        unit.resources[outcome.resourceId] = outcome.after;
      }
      if (outcome.type === "gain_shield") {
        unit.shieldPools ||= { ephemeral: 0, frozen: 0 };
        unit.shieldPools.ephemeral = Math.max(0, Number(unit.shieldPools.ephemeral) || 0) + Math.max(0, outcome.after - outcome.before);
      }
      if (outcome.type === "remove_status" || (outcome.type === "rule_status" && outcome.action === "remove" && outcome.target === "self")) status?.removeStatus?.(unit, outcome.statusId, { protectedStatuses: result.state?.protectedStatuses });
    }
  }
  function dispatch(trigger, unit, input = {}) {
    const event = normalizeTrigger(trigger), engine = global.LuminousTraitEngine;
    if (!unit || !engine?.dispatchCombatEvent) throw new Error("Combat TraitEngine is not ready");
    unit.combatTraitState ||= engine.createState();
    unit.combatTraitState.statuses = clone(unit.statusEffects || {});
    for (const [id, resource] of Object.entries(unit.resources || {})) {
      const value = Number(typeof resource === "object" ? resource?.value : resource);
      if (Number.isFinite(value)) unit.combatTraitState.resources[id] = { ...unit.combatTraitState.resources[id], value, min: 0 };
    }
    const before = { hp: unit.hp, sp: unit.sp };
    unit.currentHp = unit.hp; unit.currentSp = unit.sp;
    const result = engine.dispatchCombatEvent(event, { ...input, context: "combat", character: unit, self: unit,
      traits: traitsForUnit(unit), state: unit.combatTraitState });
    syncResult(unit, result);
    // Existing sheet handlers and the live engine use different HP/SP aliases.
    if (unit.hp === before.hp && unit.currentHp !== before.hp) unit.hp = Math.max(0, Math.min(Number(unit.maxHp), Number(unit.currentHp)));
    if (unit.sp === before.sp && unit.currentSp !== before.sp) unit.sp = Number(unit.currentSp);
    unit.currentHp = unit.hp; unit.currentSp = unit.sp;
    notify(event, unit, input);
    return result;
  }
  function activate(trait, unit, input = {}) {
    const engine = global.LuminousTraitEngine;
    unit.combatTraitState ||= engine.createState();
    unit.combatTraitState.statuses = clone(unit.statusEffects || {});
    const units = input.units || [unit], beforeStatuses = units.map(row => clone(row.statusEffects || {}));
    const beforeVitals = units.map(row => ({ hp: row.hp, sp: row.sp }));
    units.forEach(row => { row.currentHp = row.hp; row.currentSp = row.sp; });
    const result = engine.activateTrait(trait, { ...input, context: "combat", character: unit, self: unit, actor: unit }, unit.combatTraitState);
    if (!result?.available) return result;
    syncResult(unit, result);
    for (const [index, target] of units.entries()) {
      const old = beforeVitals[index];
      if (target.hp === old.hp && target.currentHp !== old.hp && Number.isFinite(Number(target.currentHp))) target.hp = Math.max(0, Math.min(Number(target.maxHp), Number(target.currentHp)));
      if (target.sp === old.sp && target.currentSp !== old.sp && Number.isFinite(Number(target.currentSp))) target.sp = Number(target.currentSp);
      target.currentHp = target.hp; target.currentSp = target.sp;
    }
    stampInitialStatuses(units, beforeStatuses, Number(input.round) || 1);
    return result;
  }
  function active(unit) { return unit && unit.battleActive !== false && !unit.isBackup && !unit.dead && !unit.defeated && Number(unit.hp ?? unit.currentHp ?? 1) > 0; }
  function stampInitialStatuses(units, before, round) {
    units.forEach((unit, index) => {
      for (const [id, status] of Object.entries(unit.statusEffects || {})) {
        if (!status || typeof status !== "object") continue;
        const changed = JSON.stringify(status) !== JSON.stringify(before[index]?.[id]);
        if (changed || status.appliedRound == null || !Number.isFinite(Number(status.appliedRound))) {
          // The live viewer expires total_loss statuses by appliedRound, not by
          // TraitEngine's duration label. Include allied adapter targets too.
          status.appliedRound = Math.max(round, Number(status.appliedRound) || round);
          if (unit.combatTraitState?.statuses?.[id]) unit.combatTraitState.statuses[id] = clone(status);
        }
      }
    });
  }
  async function planEncounterStart(units, { encounterId, round = 1, engine = global.CombatEngine, withRandom = callback => callback() } = {}) {
    if (!encounterId) throw new Error("Encounter Start requires an encounter identity");
    const drafts = clone(units), fresh = drafts.filter(unit => active(unit) && unit.combatEventState?.encounterStarted !== String(encounterId));
    if (!fresh.length) return { units: drafts, started: 0 };
    const before = drafts.map(unit => clone(unit.statusEffects || {}));
    const startRound = Math.max(1, Math.trunc(Number(round) || 1));
    await prepare(fresh);
    return withRandom(() => {
    for (const adapter of adapters.values()) adapter.encounterStart?.(fresh, { units: drafts.filter(active), engine });
    for (const unit of fresh) {
      // Seed aliases once so sheet-based operations modify the live HP/SP.
      unit.currentHp = unit.hp; unit.currentSp = unit.sp;
      dispatch("encounter_start", unit, { units: drafts.filter(active), engine, round: startRound, turnNumber: startRound });
      unit.combatEventState = { ...unit.combatEventState, encounterStarted: String(encounterId) };
    }
    stampInitialStatuses(drafts, before, startRound);
    return { units: drafts, started: fresh.length };
    });
  }
  const api = Object.freeze({ version: 1, normalizeTrigger, register, prepare, traitsForUnit, equippedItems, dispatch, activate, notify, planEncounterStart });
  global.LuminousCombatEventRuntime = api;
  global.addEventListener?.("luminous:combat073-hydrated", () => {
    const units = Object.values(global.LuminousCombat073?.combatants?.() || {});
    if (units.length) prepare(units).catch(error => global.console?.error?.("Combat event dependencies:", error));
  });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
