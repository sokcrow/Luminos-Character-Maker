(function (global) {
  "use strict";

  if (global.LuminousCantripUtilityRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCantripUtilityRuntime;
    return;
  }

  const VERSION = "0.7.4-cantrips-utility-1";
  const PATCH_INTERVAL_MS = 250;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const HOUR_MS = 60 * 60 * 1000;

  const UTILITY_CANTRIPS = new Set([
    "control_flames", "gust", "mold_earth", "shape_water", "friends", "encode_thoughts",
    "guidance", "resistance", "spare_the_dying", "message", "thaumaturgy", "mage_hand",
    "prestidigitation", "magic_stone"
  ]);

  const SIN_TYPES = new Set(["wrath", "lust", "sloth", "gluttony", "gloom", "pride", "envy"]);
  const ELEMENTAL_STATUSES = new Set(["burn", "chill", "shock", "corrosion", "poison", "decay", "radiance", "sinking", "tremor"]);

  const STATUS_DEFINITIONS = Object.freeze({
    controlled_flame_light: Object.freeze({
      name: "Controlled Flame Light", type: "positive", mode: "zero",
      description: "Adjacent Units ignore Darkness Disadvantage while this controlled nonmagical flame remains active."
    }),
    guidance: Object.freeze({
      name: "Guidance", type: "positive", mode: "zero",
      description: "Gain +2 Final Power on Checks using the chosen Skill while the caster maintains Concentration."
    }),
    resistance: Object.freeze({
      name: "Resistance", type: "positive", mode: "zero",
      description: "Once per Turn, resist the chosen Sin Type or Elemental Status Effect while the caster maintains Concentration."
    }),
    thaumaturgy_booming_voice: Object.freeze({
      name: "Booming Voice", type: "positive", mode: "zero",
      description: "Gain +2 Final Power on Intimidation Checks."
    })
  });

  const state = {
    terrains: [],
    maintainedEffects: [],
    timerByItem: new Map(),
    turnSerial: 0
  };

  function emitEvent(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function baseRuntime() { return global.LuminousCantripBatchRuntime || null; }
  function statusEngine() { return global.LuminousStatusEngine || null; }
  function itemRuntime() { return global.LuminousItemInventoryRuntime || global.LuminousItemRuntime || null; }
  function entityId(entity = {}) { return String(entity.id ?? entity.unitId ?? entity.characterId ?? entity.combatId ?? "").trim(); }
  function sideOf(unit = {}) { return normalizeId(unit.side || unit.team || unit.faction || unit.allegiance || ""); }
  function sameSide(a = {}, b = {}) {
    const sa = sideOf(a), sb = sideOf(b);
    return Boolean(sa && sb && sa === sb);
  }
  function actorLevel(actor = {}) {
    if (typeof baseRuntime()?.actorLevel === "function") return baseRuntime().actorLevel(actor);
    const direct = actor.level ?? actor.Level ?? actor.characterBuild?.calculatedAtLevel;
    if (Number.isFinite(Number(direct))) return Math.max(1, intOr(direct, 1));
    const classes = Array.isArray(actor.classes) ? actor.classes : (Array.isArray(actor.characterBuild?.classes) ? actor.characterBuild.classes : []);
    return Math.max(1, classes.reduce((sum, row) => sum + Math.max(0, intOr(row?.levels ?? row?.level, 0)), 0) || 1);
  }
  function spellModFromActor(actor = {}, fallback = 0) {
    if (typeof baseRuntime()?.spellModFromActor === "function") return baseRuntime().spellModFromActor(actor, fallback);
    const direct = actor.spellMod ?? actor.spellcastingModifier ?? actor.spellcastingMod;
    return Number.isFinite(Number(direct)) ? intOr(direct, fallback) : fallback;
  }
  function speedOf(unit = {}) {
    if (typeof baseRuntime()?.speedOf === "function") return baseRuntime().speedOf(unit);
    const value = unit.speed ?? unit.currentSpeed ?? unit.velocidad ?? unit.combatStats?.speed;
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }
  function unitsFromContext(context = {}) {
    if (Array.isArray(context.units)) return context.units;
    if (context.combatData && typeof context.combatData === "object") return Object.values(context.combatData);
    if (global.combatData && typeof global.combatData === "object") return Object.values(global.combatData);
    return [];
  }
  function getStatus(unit, id) {
    if (typeof baseRuntime()?.getStatus === "function") return baseRuntime().getStatus(unit, id);
    return statusEngine()?.getStatus?.(unit, normalizeId(id)) || unit?.statusEffects?.[normalizeId(id)] || null;
  }
  function applyStatus(unit, id, input = {}) {
    if (typeof baseRuntime()?.applyStatus === "function") return baseRuntime().applyStatus(unit, id, input);
    return statusEngine()?.applyStatus?.(unit, normalizeId(id), input) || null;
  }
  function removeStatus(unit, id) {
    if (typeof baseRuntime()?.removeStatus === "function") return baseRuntime().removeStatus(unit, id);
    return statusEngine()?.removeStatus?.(unit, normalizeId(id), { from: "cantrip_utility", ignoreProtection: true }) || false;
  }

  function registerStatuses() {
    if (!global.STATUS_REGISTRY || typeof global.STATUS_REGISTRY !== "object") global.STATUS_REGISTRY = {};
    for (const [id, definition] of Object.entries(STATUS_DEFINITIONS)) {
      global.STATUS_REGISTRY[id] = { ...(global.STATUS_REGISTRY[id] || {}), ...definition };
    }
    return global.STATUS_REGISTRY;
  }

  function choiceValue(action = {}, fallback = "") {
    const choice = action?.metadata?.spellChoice || action?.metadata?.choice || action?.spellChoice || {};
    return normalizeId(choice.value ?? choice.selected ?? choice.mode ?? fallback);
  }

  function sourceDefinition(action = {}) {
    return action?.metadata?.sourceDefinition || {};
  }

  function currentSpellLevel(action, actor) {
    return Math.max(1, intOr(sourceDefinition(action).materializedAtLevel ?? actorLevel(actor), 1));
  }

  function reduceStatusPart(unit, statusId, part, amount) {
    const entry = getStatus(unit, statusId);
    if (!entry) return { changed: false, reason: "status_missing", amount: 0 };
    const key = normalizeId(part) === "potency" ? "potency" : "count";
    const before = Math.max(0, intOr(entry[key], 0));
    const after = Math.max(0, before - Math.max(0, intOr(amount, 0)));
    entry[key] = after;
    if (Math.max(0, intOr(entry.count, 0)) <= 0 && Math.max(0, intOr(entry.potency, 0)) <= 0) removeStatus(unit, statusId);
    return { changed: after !== before, part: key, before, after, amount: before - after };
  }

  function handleControlFlames(action, actor, targets, context = {}) {
    const mode = choiceValue(action, "shape");
    const target = targets?.[0] || actor;
    const amount = 1 + Math.floor(currentSpellLevel(action, actor) / 30);
    if (["feed_potency", "feed_count", "suppress_potency", "suppress_count"].includes(mode)) {
      if (!target) return { ok: false, reason: "target_missing", mode };
      if (!getStatus(target, "burn")) return { ok: false, reason: "burn_required", mode, targetId: entityId(target) };
      const part = mode.endsWith("potency") ? "potency" : "count";
      if (mode.startsWith("feed")) {
        applyStatus(target, "burn", { mode: "gain", [part]: amount, data: { sourceSpellId: "control_flames", casterId: entityId(actor) } });
        return { ok: true, mode, part, amount, targetId: entityId(target) };
      }
      const reduction = reduceStatusPart(target, "burn", part, amount);
      return { ok: true, mode, targetId: entityId(target), ...reduction };
    }
    if (mode === "control_light") {
      if (!target) return { ok: false, reason: "fire_source_anchor_required", mode };
      const expiresAt = Date.now() + HOUR_MS;
      applyStatus(target, "controlled_flame_light", {
        mode: "set", count: 1,
        data: { sourceSpellId: "control_flames", casterId: entityId(actor), expiresAt, nonmagicalFireOnly: true }
      });
      const adjacent = typeof baseRuntime()?.adjacentUnits === "function"
        ? baseRuntime().adjacentUnits(target, unitsFromContext(context)).map(entityId)
        : [];
      emitEvent("luminous:control-flames-light", { actor, target, adjacent, expiresAt });
      return { ok: true, mode, targetId: entityId(target), adjacentTargetIds: adjacent, expiresAt };
    }
    const result = { ok: true, mode, targetId: entityId(target) || null, nonmagicalFireOnly: true };
    emitEvent("luminous:control-flames-" + mode.replace(/_/g, "-"), { actor, target, result, context });
    return result;
  }

  function rollSaveHeads(engine, target, context = {}) {
    if (typeof context.rollSaveHeads === "function") return context.rollSaveHeads(target, context);
    const probability = typeof engine?.getCoinProbability === "function" ? engine.getCoinProbability(target?.sp || 0) : 50;
    const random = typeof context.random === "function" ? context.random : Math.random;
    return Array.from({ length: 5 }, () => random() * 100 < probability);
  }

  function resolveCantripSave(action, actor, target, abilityId, context = {}) {
    const engine = context.engine || global.CombatEngine;
    if (!engine?.resolveSpell || !target) return { resolved: false, reason: "save_resolver_unavailable" };
    const dc = numberOr(action?.metadata?.spellDC ?? sourceDefinition(action).spellDC, 0);
    const result = engine.resolveSpell({ statUsed: normalizeId(abilityId), saveDC: dc }, target, rollSaveHeads(engine, target, context));
    return { resolved: true, dc, result };
  }

  function handleGust(action, actor, targets, context = {}) {
    const mode = choiceValue(action, "push");
    const target = targets?.[0] || null;
    if (mode !== "push") {
      const result = { ok: true, mode, targetId: entityId(target) || null };
      emitEvent("luminous:gust-" + mode.replace(/_/g, "-"), { actor, target, result, context });
      return result;
    }
    const save = resolveCantripSave(action, actor, target, "str", context);
    if (!save.resolved) return { ok: false, mode, ...save };
    if (save.result?.isSuccess === false) {
      const amount = 2 + Math.floor(currentSpellLevel(action, actor) / 20);
      applyStatus(target, "bind", { mode: "gain", count: amount, data: { sourceSpellId: "gust", casterId: entityId(actor) } });
      return { ok: true, mode, failedSave: true, bind: amount, save: save.result, targetId: entityId(target) };
    }
    return { ok: true, mode, failedSave: false, save: save.result, targetId: entityId(target) };
  }

  function cleanupTerrains(now = Date.now()) {
    state.terrains = state.terrains.filter((entry) => numberOr(entry.expiresAt, 0) > now);
    return state.terrains;
  }

  function createTerrain(actor, sourceSpellId, kind, options = {}) {
    cleanupTerrains();
    const casterId = entityId(actor);
    const matching = state.terrains.filter((entry) => entry.casterId === casterId && entry.sourceSpellId === sourceSpellId);
    if (matching.length >= 2) {
      const oldest = matching.sort((a, b) => a.createdAt - b.createdAt)[0];
      state.terrains = state.terrains.filter((entry) => entry.id !== oldest.id);
    }
    const createdAt = Date.now();
    const terrain = {
      id: `${kind}:${casterId}:${createdAt}:${Math.random().toString(36).slice(2, 7)}`,
      kind, sourceSpellId, casterId, createdAt,
      expiresAt: createdAt + HOUR_MS,
      statusId: options.statusId,
      amount: Math.max(0, intOr(options.amount, 2))
    };
    state.terrains.push(terrain);
    emitEvent("luminous:cantrip-terrain-created", { actor, terrain: clone(terrain) });
    return terrain;
  }

  function handleMoldEarth(action, actor, targets, context = {}) {
    const mode = choiceValue(action, "difficult_terrain");
    if (mode === "difficult_terrain") return { ok: true, mode, terrain: createTerrain(actor, "mold_earth", "molded_terrain", { statusId: "bind", amount: 2 }) };
    const result = { ok: true, mode, targetId: entityId(targets?.[0]) || null };
    emitEvent("luminous:mold-earth-" + mode.replace(/_/g, "-"), { actor, target: targets?.[0] || null, result, context });
    return result;
  }

  function handleShapeWater(action, actor, targets, context = {}) {
    const mode = choiceValue(action, "freeze");
    if (mode === "freeze") return { ok: true, mode, terrain: createTerrain(actor, "shape_water", "icy_terrain", { statusId: "chill", amount: 2 }) };
    const result = { ok: true, mode, targetId: entityId(targets?.[0]) || null };
    emitEvent("luminous:shape-water-" + mode.replace(/_/g, "-"), { actor, target: targets?.[0] || null, result, context });
    return result;
  }

  function applyTerrainTurnStart(allUnits = []) {
    cleanupTerrains();
    const rows = Array.isArray(allUnits) ? allUnits : [];
    const applied = new Set();
    const results = [];
    for (const terrain of state.terrains) {
      const caster = rows.find((unit) => entityId(unit) === terrain.casterId) || global.combatData?.[terrain.casterId] || null;
      const candidates = rows
        .filter((unit) => unit && numberOr(unit.hp ?? unit.currentHp ?? unit.hp_actual, 1) > 0 && !unit.isBackgroundUnit)
        .filter((unit) => caster ? !sameSide(caster, unit) : true)
        .filter((unit) => speedOf(unit) != null)
        .sort((a, b) => speedOf(a) - speedOf(b));
      for (const target of candidates.slice(0, 3)) {
        const dedupe = `${terrain.statusId}:${entityId(target)}`;
        if (applied.has(dedupe)) continue;
        applied.add(dedupe);
        applyStatus(target, terrain.statusId, {
          mode: "gain", count: terrain.amount,
          data: { sourceSpellId: terrain.sourceSpellId, terrainId: terrain.id, casterId: terrain.casterId }
        });
        results.push({ terrainId: terrain.id, targetId: entityId(target), statusId: terrain.statusId, amount: terrain.amount });
      }
    }
    return results;
  }

  function friendsRecentlyAffected(target, actor, now = Date.now()) {
    const casterId = entityId(actor);
    const at = numberOr(target?.__luminousFriendsHistory?.[casterId], 0);
    return at > 0 && now - at < 24 * HOUR_MS;
  }

  function targetIsHumanoid(target = {}) {
    const type = normalizeId(target.creatureType || target.creature_type || target.typeCreature || target.metadata?.creatureType || "");
    return !type || type === "humanoid";
  }

  function handleFriends(action, actor, targets, context = {}) {
    const target = targets?.[0] || null;
    if (!target) return { ok: false, reason: "target_missing" };
    if (!targetIsHumanoid(target)) return { ok: false, reason: "friends_humanoid_only", targetId: entityId(target) };
    if (friendsRecentlyAffected(target, actor)) return { ok: false, reason: "friends_24h_immunity", targetId: entityId(target) };
    const fighting = context.allowFriendsInCombat !== true && !sameSide(actor, target) && (context.inCombat === true || Boolean(global.CombatEngine?.currentState));
    if (fighting) return { ok: false, reason: "friends_target_fighting_caster", targetId: entityId(target) };
    const save = resolveCantripSave(action, actor, target, "wis", context);
    if (!save.resolved) return { ok: false, ...save };
    if (save.result?.isSuccess !== false) return { ok: true, failedSave: false, save: save.result, targetId: entityId(target) };
    if (!target.__luminousFriendsHistory || typeof target.__luminousFriendsHistory !== "object") target.__luminousFriendsHistory = {};
    target.__luminousFriendsHistory[entityId(actor)] = Date.now();
    const condition = global.LuminousConditionRuntime;
    let entry = null;
    if (typeof condition?.applyCondition === "function") {
      entry = condition.applyCondition(target, "charmed", {
        mode: "set", count: 1, sourceType: "magic", removalMode: "concentration",
        sourceUnitId: entityId(actor),
        data: { sourceSpellId: "friends", casterId: entityId(actor), removalMode: "concentration" }
      });
    } else {
      entry = applyStatus(target, "charmed", { mode: "set", count: 1, data: { sourceSpellId: "friends", casterId: entityId(actor), removalMode: "concentration", sourceType: "magic" } });
    }
    return { ok: Boolean(entry), failedSave: true, save: save.result, targetId: entityId(target), condition: "charmed" };
  }

  function inventoryContainers(owner) {
    const runtime = itemRuntime();
    const values = [];
    try { const active = runtime?.activeContainer?.(owner, true)?.value; if (active) values.push(active); } catch (_) {}
    try { const stash = runtime?.stashContainer?.(owner, true)?.value; if (stash) values.push(stash); } catch (_) {}
    if (!values.length) {
      for (const key of ["inventario_activo", "activeInventory", "inventory", "inventario", "inventario_stash", "stashInventory", "stash"]) {
        if (owner?.[key] && typeof owner[key] === "object") values.push(owner[key]);
      }
    }
    return [...new Set(values)];
  }

  function eachInventoryItem(owner, visitor) {
    for (const container of inventoryContainers(owner)) {
      if (Array.isArray(container)) {
        for (let index = container.length - 1; index >= 0; index--) visitor(container[index], () => container.splice(index, 1));
      } else {
        for (const [key, item] of Object.entries(container || {})) visitor(item, () => delete container[key]);
      }
    }
  }

  function removeTemporaryItems(owner, predicate) {
    let removed = 0;
    eachInventoryItem(owner, (item, remove) => {
      if (!item || predicate(item) !== true) return;
      const id = String(item.instanceId || item.instance_id || "");
      remove();
      const timer = state.timerByItem.get(id);
      if (timer) { try { global.clearTimeout?.(timer); } catch (_) {} state.timerByItem.delete(id); }
      removed++;
      emitEvent("luminous:temporary-item-expired", { owner, item: clone(item) });
    });
    return removed;
  }

  function temporaryExpiry(item = {}) {
    return numberOr(item.customData?.temporaryUntilEpochMs ?? item.runtimeState?.temporaryUntilEpochMs ?? item.expiresAtEpochMs, 0);
  }

  function cleanupExpiredTemporaryItems(owner, now = Date.now()) {
    return removeTemporaryItems(owner, (item) => {
      const expiresAt = temporaryExpiry(item);
      return expiresAt > 0 && expiresAt <= now;
    });
  }

  function scheduleTemporaryExpiry(owner, item) {
    const expiresAt = temporaryExpiry(item);
    const instanceId = String(item?.instanceId || item?.instance_id || "");
    if (!owner || !instanceId || !expiresAt || typeof global.setTimeout !== "function") return null;
    const delay = Math.max(0, Math.min(0x7fffffff, expiresAt - Date.now()));
    const timer = global.setTimeout(() => {
      state.timerByItem.delete(instanceId);
      removeTemporaryItems(owner, (row) => String(row?.instanceId || row?.instance_id || "") === instanceId && temporaryExpiry(row) <= Date.now());
    }, delay);
    timer?.unref?.();
    state.timerByItem.set(instanceId, timer);
    return timer;
  }

  function createTemporaryItem(owner, definition, durationSeconds, options = {}) {
    if (!owner) return { ok: false, reason: "owner_missing" };
    cleanupExpiredTemporaryItems(owner);
    const runtime = itemRuntime();
    const now = Date.now();
    const expiresAt = now + Math.max(1, numberOr(durationSeconds, 1)) * 1000;
    const casterId = entityId(options.caster || owner);
    const baseDefinition = {
      id: definition.id, definitionId: definition.id,
      name: definition.name || definition.id,
      nombre: definition.nombre || definition.name || definition.id,
      category: definition.category || "item",
      itemType: definition.itemType || definition.category || "item",
      stackable: definition.stackable === true,
      iconFamily: definition.iconFamily || "magic",
      tags: clone(definition.tags || []),
      activeStackLimit: definition.activeStackLimit,
      stashStackLimit: definition.stashStackLimit
    };
    const customData = {
      ...(definition.customData || {}), ...(options.customData || {}),
      temporary: true, temporaryUntilEpochMs: expiresAt,
      sourceSpellId: options.sourceSpellId || definition.customData?.sourceSpellId || null,
      casterId
    };
    let item;
    if (typeof runtime?.createItemInstance === "function") {
      item = runtime.createItemInstance(baseDefinition, {
        quantity: Math.max(1, intOr(options.quantity, 1)),
        customData,
        runtimeState: { temporaryUntilEpochMs: expiresAt },
        variantData: { ...(definition.variantData || {}), temporary: true }
      });
    } else {
      item = { ...baseDefinition, instanceId: `${normalizeId(definition.id)}_${now}_${Math.random().toString(36).slice(2, 7)}`, quantity: Math.max(1, intOr(options.quantity, 1)), customData, runtimeState: { temporaryUntilEpochMs: expiresAt } };
    }
    let inserted = null;
    if (typeof runtime?.insertItem === "function") inserted = runtime.insertItem(owner, item, "active", { allowOverflow: false });
    else {
      if (!owner.inventory || typeof owner.inventory !== "object") owner.inventory = {};
      owner.inventory[item.instanceId] = item;
      inserted = { inserted: true, quantity: item.quantity, instanceId: item.instanceId };
    }
    if (!inserted?.inserted) return { ok: false, reason: inserted?.reason || "inventory_full", item, inserted };
    scheduleTemporaryExpiry(owner, item);
    emitEvent("luminous:temporary-item-created", { owner, item: clone(item), expiresAt, sourceSpellId: options.sourceSpellId || null });
    return { ok: true, item, inserted, expiresAt };
  }

  function handleEncodeThoughts(action, actor) {
    removeTemporaryItems(actor, (item) => item?.customData?.sourceSpellId === "encode_thoughts" && item?.customData?.casterId === entityId(actor));
    const content = action?.metadata?.thoughtContent ?? action?.metadata?.message ?? action?.metadata?.viewerPlan?.thoughtContent ?? null;
    return createTemporaryItem(actor, {
      id: "thought_strand", name: "Thought Strand", category: "item", stackable: false,
      customData: { thoughtContent: content, readableBy: ["encode_thoughts", "thought_reading"] }
    }, 8 * 60 * 60, { caster: actor, sourceSpellId: "encode_thoughts", customData: { thoughtContent: content } });
  }

  function handleGuidance(action, actor, targets) {
    const target = targets?.[0] || actor;
    const skillId = choiceValue(action);
    if (!target || !skillId) return { ok: false, reason: !target ? "target_missing" : "guidance_skill_required" };
    applyStatus(target, "guidance", { mode: "set", count: 1, data: { sourceSpellId: "guidance", casterId: entityId(actor), skillId, finalPower: 2 } });
    return { ok: true, status: "guidance", targetId: entityId(target), skillId, finalPower: 2 };
  }

  function handleResistance(action, actor, targets) {
    const target = targets?.[0] || actor;
    const raw = choiceValue(action);
    if (!target || !raw) return { ok: false, reason: !target ? "target_missing" : "resistance_choice_required" };
    const kind = raw.startsWith("sin_") ? "sin" : raw.startsWith("status_") ? "status" : null;
    const value = raw.replace(/^(sin|status)_/, "");
    if (!kind || (kind === "sin" && !SIN_TYPES.has(value)) || (kind === "status" && !ELEMENTAL_STATUSES.has(value))) {
      return { ok: false, reason: "invalid_resistance_choice", choice: raw };
    }
    applyStatus(target, "resistance", { mode: "set", count: 1, data: { sourceSpellId: "resistance", casterId: entityId(actor), kind, value, usedTurnSerial: -1 } });
    return { ok: true, status: "resistance", targetId: entityId(target), kind, value };
  }

  function handleSpareTheDying(actor, targets) {
    const target = targets?.[0] || null;
    const runtime = global.LuminousDeathSaveRuntime;
    if (!target) return { ok: false, reason: "target_missing" };
    if (typeof runtime?.stabilize !== "function") return { ok: false, reason: "death_save_runtime_stable_unavailable" };
    const result = runtime.stabilize(target, { source: "spare_the_dying", caster: actor });
    return { ok: result?.stabilized === true, result, targetId: entityId(target) };
  }

  function handleMessage(action, actor, targets, context = {}) {
    const target = targets?.[0] || null;
    if (!target) return { ok: false, reason: "target_missing" };
    const message = action?.metadata?.message ?? action?.metadata?.viewerPlan?.message ?? null;
    const result = { ok: true, private: true, casterId: entityId(actor), targetId: entityId(target), message, allowsImmediateReply: true };
    emitEvent("luminous:private-message", { actor, target, message, allowsImmediateReply: true, context });
    return result;
  }

  function recordMaintainedEffect(actor, sourceSpellId, mode, durationSeconds) {
    const now = Date.now();
    state.maintainedEffects = state.maintainedEffects.filter((entry) => entry.expiresAt > now);
    const casterId = entityId(actor);
    const same = state.maintainedEffects.filter((entry) => entry.casterId === casterId && entry.sourceSpellId === sourceSpellId);
    if (same.length >= 3) {
      const oldest = same.sort((a, b) => a.createdAt - b.createdAt)[0];
      state.maintainedEffects = state.maintainedEffects.filter((entry) => entry.id !== oldest.id);
    }
    const entry = { id: `${sourceSpellId}:${casterId}:${now}:${Math.random().toString(36).slice(2, 6)}`, casterId, sourceSpellId, mode, createdAt: now, expiresAt: now + durationSeconds * 1000 };
    state.maintainedEffects.push(entry);
    return entry;
  }

  function handleThaumaturgy(action, actor, targets, context = {}) {
    const mode = choiceValue(action, "phantom_sound");
    const target = targets?.[0] || actor;
    if (mode === "booming_voice") {
      const effect = recordMaintainedEffect(actor, "thaumaturgy", mode, 60);
      applyStatus(actor, "thaumaturgy_booming_voice", { mode: "set", count: 1, data: { sourceSpellId: "thaumaturgy", skillId: "intimidation", finalPower: 2, expiresAt: effect.expiresAt } });
      return { ok: true, mode, finalPower: 2, skillId: "intimidation", expiresAt: effect.expiresAt };
    }
    const maintained = ["altered_eyes", "fire_play", "tremors"].includes(mode) ? recordMaintainedEffect(actor, "thaumaturgy", mode, 60) : null;
    const result = { ok: true, mode, targetId: entityId(target) || null, maintained };
    emitEvent("luminous:thaumaturgy-" + mode.replace(/_/g, "-"), { actor, target, result, context });
    return result;
  }

  function handleMageHand(action, actor, context = {}) {
    const base = baseRuntime();
    if (typeof base?.spawnSpellEntity !== "function") return { ok: false, reason: "background_unit_runtime_unavailable" };
    const entity = base.spawnSpellEntity(actor, "mage_hand", { kind: "background_unit", summonerLevel: currentSpellLevel(action, actor), spellMod: action?.metadata?.spellMod, context });
    entity.name = "Mage Hand";
    entity.targetable = false;
    entity.isSummon = false;
    entity.isBackgroundUnit = true;
    entity.canAttack = false;
    entity.canActivateMagicItems = false;
    entity.expiresAt = Date.now() + 60 * 1000;
    if (typeof global.setTimeout === "function") {
      const timer = global.setTimeout(() => base.despawnEntity?.(entity, { combatData: global.combatData }), 60 * 1000);
      timer?.unref?.();
    }
    emitEvent("luminous:mage-hand-created", { actor, entity });
    return { ok: true, entity };
  }

  function handlePrestidigitation(action, actor, targets, context = {}) {
    const mode = choiceValue(action, "sensory_trick");
    const target = targets?.[0] || actor;
    if (mode === "minor_creation") {
      const requestedName = String(action?.metadata?.createdItemName ?? action?.metadata?.viewerPlan?.createdItemName ?? "Prestidigitation Creation").trim() || "Prestidigitation Creation";
      return createTemporaryItem(actor, {
        id: "prestidigitation_creation", name: requestedName, category: "item", stackable: false,
        customData: { handSizedOnly: true, noMonetaryValue: true, cannotDealDamage: true, unitValueAhn: 0 }
      }, 6, { caster: actor, sourceSpellId: "prestidigitation", customData: { handSizedOnly: true, noMonetaryValue: true, cannotDealDamage: true } });
    }
    let maintained = null;
    if (["minor_sensation", "magic_mark"].includes(mode)) maintained = recordMaintainedEffect(actor, "prestidigitation", mode, 60 * 60);
    const result = { ok: true, mode, targetId: entityId(target) || null, maintained };
    emitEvent("luminous:prestidigitation-" + mode.replace(/_/g, "-"), { actor, target, result, context });
    return result;
  }

  function handleMagicStone(action, actor) {
    const spellMod = intOr(action?.metadata?.spellMod ?? sourceDefinition(action).spellMod ?? spellModFromActor(actor, 0), 0);
    removeTemporaryItems(actor, (item) => item?.customData?.sourceSpellId === "magic_stone" && item?.customData?.casterId === entityId(actor));
    return createTemporaryItem(actor, {
      id: "magic_stone", name: "Magic Stone", category: "ammo", itemType: "ammo", stackable: true,
      tags: ["ammo", "sling_ammo", "throwable"], activeStackLimit: 20, stashStackLimit: 99,
      customData: { slingAmmo: true, throwable: true, damageType: "contundente", enchanterSpellMod: spellMod, magicStoneDamage: 2 + spellMod }
    }, 60, { caster: actor, sourceSpellId: "magic_stone", quantity: 3, customData: { slingAmmo: true, throwable: true, damageType: "contundente", enchanterSpellMod: spellMod, magicStoneDamage: 2 + spellMod } });
  }

  function resolveMagicStoneHit(item, target, options = {}) {
    if (!item || !target) return { applied: false, reason: "missing_item_or_target" };
    const damage = Math.max(0, intOr(item.customData?.magicStoneDamage, 2 + intOr(item.customData?.enchanterSpellMod, 0)));
    const engine = options.engine || global.CombatEngine;
    const result = typeof engine?.applyDamage === "function" ? engine.applyDamage(target, damage, "contundente", false, options.skill || null) : null;
    emitEvent("luminous:magic-stone-hit", { item, target, damage, result });
    return { applied: true, damage, result };
  }

  function handleAutomaticCantrip({ action, actor, targets, context } = {}) {
    const id = normalizeId(action?.source?.id);
    if (id === "control_flames") return handleControlFlames(action, actor, targets, context);
    if (id === "gust") return handleGust(action, actor, targets, context);
    if (id === "mold_earth") return handleMoldEarth(action, actor, targets, context);
    if (id === "shape_water") return handleShapeWater(action, actor, targets, context);
    if (id === "friends") return handleFriends(action, actor, targets, context);
    if (id === "encode_thoughts") return handleEncodeThoughts(action, actor);
    if (id === "guidance") return handleGuidance(action, actor, targets);
    if (id === "resistance") return handleResistance(action, actor, targets);
    if (id === "spare_the_dying") return handleSpareTheDying(actor, targets);
    if (id === "message") return handleMessage(action, actor, targets, context);
    if (id === "thaumaturgy") return handleThaumaturgy(action, actor, targets, context);
    if (id === "mage_hand") return handleMageHand(action, actor, context);
    if (id === "prestidigitation") return handlePrestidigitation(action, actor, targets, context);
    if (id === "magic_stone") return handleMagicStone(action, actor);
    return { ok: false, reason: "unsupported_utility_cantrip" };
  }

  function controlledFlameIgnoresDarkness(unit, unitsInput = []) {
    const rows = Array.isArray(unitsInput) ? unitsInput : Object.values(unitsInput || {});
    const base = baseRuntime();
    if (typeof base?.ignoresDarknessDisadvantage === "function" && base.ignoresDarknessDisadvantage(unit, rows)) return true;
    const now = Date.now();
    for (const source of rows) {
      const entry = getStatus(source, "controlled_flame_light");
      if (!entry) continue;
      const expiresAt = numberOr(entry.data?.expiresAt, 0);
      if (expiresAt && expiresAt <= now) { removeStatus(source, "controlled_flame_light"); continue; }
      const adjacent = typeof base?.adjacentUnits === "function" ? base.adjacentUnits(source, rows) : [];
      if (adjacent.some((row) => entityId(row) === entityId(unit))) return true;
    }
    return false;
  }

  function removeCasterStatuses(caster, ids, context = {}) {
    const casterId = entityId(caster);
    const units = unitsFromContext(context);
    let removed = 0;
    for (const unit of units) {
      for (const id of ids) {
        const entry = getStatus(unit, id);
        if (!entry || String(entry.data?.casterId || "") !== casterId) continue;
        if (removeStatus(unit, id)) removed++;
      }
    }
    return removed;
  }

  function patchActionAdapter() {
    const source = global.LuminousBattleViewerActionAdapter073;
    if (!source?.compilePlan || source.__cantripUtilityRuntime) return Boolean(source);
    const wrapped = Object.freeze({
      ...source,
      __cantripUtilityRuntime: true,
      compilePlan(slotId, explicitTargetSlotId = null, providedPlan = null) {
        const result = source.compilePlan(slotId, explicitTargetSlotId, providedPlan);
        const action = result?.action;
        if (!action || normalizeId(action.source?.type) !== "spell") return result;
        const id = normalizeId(action.source?.id);
        if (!UTILITY_CANTRIPS.has(id)) return result;
        action.effects = [...(action.effects || []), { type: "cantrip_utility_effect", spellId: id }];
        action.resolution = { type: "automatic" };
        return result;
      }
    });
    global.LuminousBattleViewerActionAdapter073 = wrapped;
    return true;
  }

  function installCombatHook() {
    const current = global.LuminousBattleViewerCombatHooks073 || {};
    if (current.__cantripUtilityRuntime) return true;
    global.LuminousBattleViewerCombatHooks073 = Object.freeze({
      ...current,
      __cantripUtilityRuntime: true,
      effectHandlers: Object.freeze({
        ...(current.effectHandlers || {}),
        cantrip_utility_effect: handleAutomaticCantrip
      })
    });
    return true;
  }

  function patchStatusEngine() {
    const source = global.LuminousStatusEngine;
    if (!source?.applyStatus || source.__cantripUtilityResistanceBridge) return Boolean(source);
    const wrapped = Object.freeze({
      ...source,
      __cantripUtilityResistanceBridge: true,
      applyStatus(unit, statusId, input = {}) {
        const key = normalizeId(statusId);
        const resistance = source.getStatus?.(unit, "resistance") || unit?.statusEffects?.resistance || null;
        const data = resistance?.data || {};
        let next = input;
        if (resistance && data.kind === "status" && data.value === key && data.usedTurnSerial !== state.turnSerial) {
          next = { ...input };
          const potency = Math.max(0, intOr(next.potency, 0));
          const count = Math.max(0, intOr(next.count, 0));
          if (potency > 0) next.potency = Math.max(0, potency - 1);
          else if (count > 0) next.count = Math.max(0, count - 1);
          data.usedTurnSerial = state.turnSerial;
          if (next.potency === 0 && next.count === 0 && potency + count > 0) {
            emitEvent("luminous:resistance-status-negated", { unit, statusId: key, resistance: clone(resistance) });
            return resistance;
          }
        }
        return source.applyStatus(unit, statusId, next);
      }
    });
    global.LuminousStatusEngine = wrapped;
    return true;
  }

  function patchCombatEngine() {
    const engine = global.CombatEngine;
    if (!engine || engine.__cantripUtilityRuntime) return Boolean(engine);
    const originalCalculateDndBonus = typeof engine.calculateDndBonus === "function" ? engine.calculateDndBonus : null;
    const originalCalculateCoinDamage = typeof engine.calculateCoinDamage === "function" ? engine.calculateCoinDamage : null;
    const originalTriggerPhase = typeof engine.triggerPhase === "function" ? engine.triggerPhase : null;

    if (originalCalculateDndBonus) {
      engine.calculateDndBonus = function(unit, statUsed, skillUsed, ...rest) {
        let value = originalCalculateDndBonus.call(this, unit, statUsed, skillUsed, ...rest);
        const skillId = normalizeId(skillUsed || "");
        const guidance = getStatus(unit, "guidance");
        if (guidance && skillId && normalizeId(guidance.data?.skillId) === skillId) value += 2;
        const booming = getStatus(unit, "thaumaturgy_booming_voice");
        if (booming) {
          const expiresAt = numberOr(booming.data?.expiresAt, 0);
          if (expiresAt && expiresAt <= Date.now()) removeStatus(unit, "thaumaturgy_booming_voice");
          else if (skillId === "intimidation") value += 2;
        }
        return value;
      };
    }

    if (originalCalculateCoinDamage) {
      engine.calculateCoinDamage = function(attacker, defender, skill, coinFinalPower, isCritical, clashCount, context = null) {
        let value = originalCalculateCoinDamage.call(this, attacker, defender, skill, coinFinalPower, isCritical, clashCount, context);
        const resistance = getStatus(defender, "resistance");
        const data = resistance?.data || {};
        const sin = normalizeId(skill?.sinAffinity || skill?.sin_affinity || skill?.affinity || "");
        if (resistance && data.kind === "sin" && data.value === sin && data.usedTurnSerial !== state.turnSerial) {
          value = Math.max(0, Math.floor(numberOr(value, 0) * 0.8));
          data.usedTurnSerial = state.turnSerial;
        }
        return value;
      };
    }

    if (originalTriggerPhase) {
      engine.triggerPhase = function(phaseTag, allUnits = [], ...rest) {
        const phase = normalizeId(phaseTag);
        if (["turn_start", "round_start"].includes(phase)) {
          state.turnSerial++;
          applyTerrainTurnStart(allUnits);
          for (const unit of allUnits || []) cleanupExpiredTemporaryItems(unit);
        }
        return originalTriggerPhase.call(this, phaseTag, allUnits, ...rest);
      };
    }

    Object.defineProperty(engine, "__cantripUtilityRuntime", { value: true, configurable: true });
    return true;
  }

  function patchConcentrationRuntime() {
    const source = global.LuminousSpellcastingRuntime;
    if (!source?.startConcentration || !source?.endConcentration || source.__cantripUtilityConcentrationBridge) return Boolean(source);
    const cleanup = (character, spellId) => {
      const id = normalizeId(spellId);
      if (id === "guidance") removeCasterStatuses(character, ["guidance"], { combatData: global.combatData });
      if (id === "resistance") removeCasterStatuses(character, ["resistance"], { combatData: global.combatData });
      if (id === "friends") removeCasterStatuses(character, ["charmed"], { combatData: global.combatData });
    };
    const wrapped = Object.freeze({
      ...source,
      __cantripUtilityConcentrationBridge: true,
      startConcentration(character, spell = {}, options = {}) {
        const previous = character?.spellcastingState?.concentration?.active?.spellId || null;
        const next = normalizeId(spell.id || spell.name);
        if (previous && normalizeId(previous) !== next) cleanup(character, previous);
        return source.startConcentration(character, spell, options);
      },
      endConcentration(character, reason = "ended") {
        const result = source.endConcentration(character, reason);
        const previous = result?.previous?.spellId;
        if (previous) cleanup(character, previous);
        return result;
      }
    });
    global.LuminousSpellcastingRuntime = wrapped;
    return true;
  }

  function installBaseDarknessBridge() {
    const base = global.LuminousCantripBatchRuntime;
    if (!base || base.__utilityDarknessBridge) return Boolean(base);
    global.LuminousCantripBatchRuntime = Object.freeze({
      ...base,
      __utilityDarknessBridge: true,
      ignoresDarknessDisadvantage: controlledFlameIgnoresDarkness
    });
    return true;
  }

  function install() {
    registerStatuses();
    patchActionAdapter();
    installCombatHook();
    patchStatusEngine();
    patchCombatEngine();
    patchConcentrationRuntime();
    installBaseDarknessBridge();
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    UTILITY_CANTRIPS,
    STATUS_DEFINITIONS,
    state,
    registerStatuses,
    choiceValue,
    handleAutomaticCantrip,
    handleControlFlames,
    handleGust,
    handleMoldEarth,
    handleShapeWater,
    handleFriends,
    handleEncodeThoughts,
    handleGuidance,
    handleResistance,
    handleSpareTheDying,
    handleMessage,
    handleThaumaturgy,
    handleMageHand,
    handlePrestidigitation,
    handleMagicStone,
    createTerrain,
    cleanupTerrains,
    applyTerrainTurnStart,
    createTemporaryItem,
    cleanupExpiredTemporaryItems,
    removeTemporaryItems,
    resolveMagicStoneHit,
    controlledFlameIgnoresDarkness,
    patchActionAdapter,
    installCombatHook,
    patchStatusEngine,
    patchCombatEngine,
    patchConcentrationRuntime,
    install
  });

  global.LuminousCantripUtilityRuntime = api;
  install();
  const timer = typeof global.setInterval === "function" ? global.setInterval(install, PATCH_INTERVAL_MS) : null;
  timer?.unref?.();

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
