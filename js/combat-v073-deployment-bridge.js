(function (global) {
  "use strict";

  if (global.LuminousCombatDeploymentBridge073) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCombatDeploymentBridge073;
    return;
  }

  const ROOTS = Object.freeze({
    combatants: "campaña/combate/combatants",
    reserves: "campaña/combate/reserves",
    defeated: "campaña/combate/defeated",
    departed: "campaña/combate/departed",
  });
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const clean = (value) => String(value ?? "").trim();
  const safe = (value, fallback = "unit") => clean(value).replace(/[.#$\[\]\/]/g, "_") || fallback;
  const finiteInt = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;

  const state = {
    started: false,
    reserves: {},
    reserveRef: null,
    reserveHandler: null,
    writeChain: Promise.resolve(),
    sequence: 0,
    metrics: { transitions: 0, batches: 0, hydrates: 0, reserveEvents: 0 },
    lastBatch: null,
  };

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }
  function deployment() {
    return global.LuminousCombatDeploymentRuntime || safeRequire("./combat-deployment-runtime.js");
  }
  function adapter() { return global.LuminousCombatLiveAdapter073 || null; }
  function adapterState() { return adapter()?.state || null; }
  function runtime() { return global.LuminousCombat073 || null; }
  function isDm() { return adapterState()?.role === "dm"; }
  function db() { return adapterState()?.db || null; }
  function round() { return Math.max(1, finiteInt(adapterState()?.round, 1)); }

  function identityValues(unit = {}, fallback = "") {
    return [...new Set([
      fallback,
      unit.id,
      unit.combatId,
      unit.instanceId,
      unit.unitId,
      unit.characterId,
      unit.actorId,
    ].map(clean).filter(Boolean))];
  }

  function fieldKeyForUnit(unit = {}) {
    const rows = adapterState()?.combatants || {};
    const wanted = new Set(identityValues(unit));
    for (const [key, raw] of Object.entries(rows)) {
      if (wanted.has(key) || identityValues(raw, key).some((value) => wanted.has(value))) return key;
    }
    return null;
  }

  function mergeLiveState(raw = {}, live = {}) {
    const out = { ...clone(raw), ...clone(live) };
    const preserved = ["inventory", "equipment", "equippedItems", "items", "weaponLoadout", "threat", "experience", "loot", "dropTable"];
    for (const key of preserved) if (raw?.[key] !== undefined) out[key] = clone(raw[key]);
    return out;
  }

  function reserveEntries(side = null) {
    return deployment()?.sortedBackupEntries?.(state.reserves, side) || [];
  }

  function backupUnits(side = null) {
    return reserveEntries(side).map((entry) => entry.unit);
  }

  function setReserveCache(value = {}) {
    state.reserves = value && typeof value === "object" ? clone(value) : {};
    state.metrics.reserveEvents += 1;
    return state.reserves;
  }

  function queueUpdate(updates = {}) {
    if (!isDm() || !db()?.ref || !Object.keys(updates).length) return Promise.resolve({ persisted: false, reason: "dm_authority_required_or_no_updates" });
    const run = async () => {
      await db().ref().update(updates);
      return { persisted: true, updateCount: Object.keys(updates).length };
    };
    state.writeChain = state.writeChain.then(run, run);
    return state.writeChain;
  }

  function refreshRuntimeOnce() {
    const bridge = adapter();
    const s = adapterState();
    if (!bridge?.hydrateNow || !s) return false;
    s.lastSignature = "";
    const result = bridge.hydrateNow();
    state.metrics.hydrates += 1;
    return result;
  }

  function emit(detail = {}) {
    try {
      global.dispatchEvent?.(new global.CustomEvent("luminous:combat073-deployment-change", {
        detail: { version: "0.7.3-deployment.1", ...clone(detail) },
      }));
    } catch (_) {}
  }

  function nextBackupKey(unit = {}, prefix = "backup") {
    state.sequence += 1;
    const root = safe(unit.instanceId || unit.combatId || unit.id || unit.unitId || prefix);
    const occupied = (key) => Object.prototype.hasOwnProperty.call(state.reserves, key)
      || Object.prototype.hasOwnProperty.call(adapterState()?.combatants || {}, key);
    if (!occupied(root)) return root;
    let key = `${root}_backup_${state.sequence}`;
    while (occupied(key)) {
      state.sequence += 1;
      key = `${root}_backup_${state.sequence}`;
    }
    return key;
  }

  function enqueueBackupUnit(unit = {}, options = {}) {
    const api = deployment();
    if (!api) return { added: false, reason: "deployment_runtime_unavailable" };
    const side = api.sideOf(unit);
    const key = safe(options.key || nextBackupKey(unit));
    const order = api.nextQueueOrder(state.reserves, side, options.position === "front" ? "front" : "back");
    const backup = api.markBackup(unit, {
      queueOrder: order,
      round: options.round ?? round(),
      reason: options.reason || "added",
    });
    state.reserves[key] = backup;
    const updates = { [`${ROOTS.reserves}/${key}`]: backup };
    state.metrics.transitions += 1;
    if (options.persist !== false) queueUpdate(updates);
    emit({ type: "backup_added", side, key, position: options.position === "front" ? "front" : "back" });
    return { added: true, key, unit: backup, side, order, updates };
  }

  function promoteNextBackupLocal(side, outgoing = {}, options = {}, updates = {}) {
    const api = deployment();
    const combatants = adapterState()?.combatants || {};
    if (!api?.canEnterField?.(combatants, side)) return { promoted: false, reason: "field_cap_reached" };
    const entry = api.nextBackup(state.reserves, side);
    if (!entry) return { promoted: false, reason: "no_backup" };
    const incoming = api.preparePromotion(entry.unit, outgoing, {
      round: options.round ?? round(),
      reason: options.reason || "replacement",
      inheritActionSlotsCap: options.inheritActionSlotsCap ?? 2,
    });
    incoming.id = entry.key;
    incoming.combatId = entry.key;
    incoming.replacementPendingPlanning = true;
    combatants[entry.key] = incoming;
    delete state.reserves[entry.key];
    updates[`${ROOTS.reserves}/${entry.key}`] = null;
    updates[`${ROOTS.combatants}/${entry.key}`] = incoming;
    return { promoted: true, key: entry.key, unit: incoming, side: api.sideOf(incoming) };
  }

  function promoteNextBackup(side, options = {}) {
    if (!isDm()) return { promoted: false, reason: "dm_authority_required" };
    const updates = {};
    const result = promoteNextBackupLocal(side, options.outgoingUnit || {}, options, updates);
    if (!result.promoted) return result;
    refreshRuntimeOnce();
    queueUpdate(updates);
    state.metrics.transitions += 1;
    emit({ type: "backup_promoted", side: result.side, key: result.key, reason: options.reason || "manual" });
    return { ...result, updates };
  }

  function archiveDefeatedLocal(unit, options = {}, updates = {}) {
    const api = deployment();
    const s = adapterState();
    if (!api || !s) return { archived: false, reason: "deployment_runtime_unavailable" };
    const key = fieldKeyForUnit(unit);
    if (!key) return { archived: false, reason: "field_unit_missing" };
    const raw = s.combatants?.[key] || {};
    const merged = mergeLiveState(raw, unit);
    const side = api.sideOf(merged);
    const defeated = api.markDefeated(merged, {
      round: options.round ?? round(),
      reason: options.reason || "hp_zero",
      lootEligible: true,
    });
    delete s.combatants[key];
    updates[`${ROOTS.combatants}/${key}`] = null;
    updates[`${ROOTS.defeated}/${key}`] = defeated;
    const replacement = options.promote === false
      ? { promoted: false, reason: "promotion_disabled" }
      : promoteNextBackupLocal(side, unit, { ...options, reason: "defeat_replacement" }, updates);
    return { archived: true, key, side, defeated, replacement };
  }

  function reconcileDefeatedRuntime(options = {}) {
    if (!isDm()) return { changed: false, reason: "dm_authority_required", transitions: [] };
    const api = deployment();
    const units = Object.values(runtime()?.combatants?.() || {});
    if (!api) return { changed: false, reason: "deployment_runtime_unavailable", transitions: [] };
    const candidates = units.filter((unit) => api.isField(unit) && api.isDefeated(unit));
    if (!candidates.length) return { changed: false, transitions: [] };
    const updates = {};
    const transitions = candidates.map((unit) => archiveDefeatedLocal(unit, options, updates)).filter((row) => row.archived);
    if (!transitions.length) return { changed: false, transitions: [] };
    refreshRuntimeOnce();
    queueUpdate(updates);
    state.metrics.transitions += transitions.length;
    state.metrics.batches += 1;
    state.lastBatch = { type: "defeat", transitions: clone(transitions), updateCount: Object.keys(updates).length };
    emit({ type: "defeat_batch", transitions, source: options.source || null });
    return { changed: true, transitions, updates };
  }

  function retreatUnit(unit = {}, options = {}) {
    if (!isDm()) return { handled: true, changed: false, reason: "remote_authority" };
    const api = deployment();
    const s = adapterState();
    const key = fieldKeyForUnit(unit);
    if (!api || !s || !key) return { handled: false, changed: false, reason: "field_unit_missing" };
    const raw = s.combatants[key] || {};
    const merged = mergeLiveState(raw, unit);
    const side = api.sideOf(merged);
    const order = api.nextQueueOrder(state.reserves, side, "front");
    const backup = api.markBackup(merged, { queueOrder: order, round: options.round ?? round(), reason: "retreat" });
    delete s.combatants[key];
    state.reserves[key] = backup;
    const updates = {
      [`${ROOTS.combatants}/${key}`]: null,
      [`${ROOTS.reserves}/${key}`]: backup,
    };
    refreshRuntimeOnce();
    queueUpdate(updates);
    state.metrics.transitions += 1;
    emit({ type: "retreat", side, key, queueOrder: order });
    return { handled: true, changed: true, key, side, unit: backup, promoted: false, updates };
  }

  function escapeUnit(unit = {}, options = {}) {
    if (!isDm()) return { handled: true, changed: false, reason: "remote_authority" };
    const api = deployment();
    const s = adapterState();
    const key = fieldKeyForUnit(unit);
    if (!api || !s || !key) return { handled: false, changed: false, reason: "field_unit_missing" };
    const raw = s.combatants[key] || {};
    const merged = mergeLiveState(raw, unit);
    const side = api.sideOf(merged);
    const departed = api.markEscaped(merged, { round: options.round ?? round(), reason: "escape" });
    delete s.combatants[key];
    const updates = {
      [`${ROOTS.combatants}/${key}`]: null,
      [`${ROOTS.departed}/${key}`]: departed,
    };
    const replacement = promoteNextBackupLocal(side, unit, { ...options, reason: "escape_replacement" }, updates);
    refreshRuntimeOnce();
    queueUpdate(updates);
    state.metrics.transitions += 1;
    emit({ type: "escape", side, key, replacement });
    return { handled: true, changed: true, key, side, unit: departed, replacement, updates };
  }

  function resolveRetreatEffect({ actor, effect } = {}) {
    return retreatUnit(actor || {}, { inheritActionSlotsCap: effect?.inheritActionSlotsCap ?? 2, reason: "retreat" });
  }

  function resolveEscapeEffect({ actor } = {}) {
    return escapeUnit(actor || {}, { reason: "escape" });
  }

  function commandEncounter(activeUnits = []) {
    const api = deployment();
    const active = Array.isArray(activeUnits) ? activeUnits.filter((unit) => api?.isField?.(unit) !== false) : [];
    return {
      allies: {
        active: active.filter((unit) => api?.sideOf?.(unit) === "ally").map((unit) => ({ unit })),
        backups: backupUnits("ally").map((unit) => ({ unit })),
      },
      enemies: {
        active: active.filter((unit) => api?.sideOf?.(unit) === "enemy").map((unit) => ({ unit })),
        backups: backupUnits("enemy").map((unit) => ({ unit })),
      },
    };
  }

  function detachReserves() {
    if (state.reserveRef && state.reserveHandler) {
      try { state.reserveRef.off("value", state.reserveHandler); } catch (_) {}
    }
    state.reserveRef = null;
    state.reserveHandler = null;
    return true;
  }

  function attachReserves() {
    if (!isDm() || !db()?.ref || state.reserveRef) return false;
    const ref = db().ref(ROOTS.reserves);
    const handler = (snapshot) => setReserveCache(snapshot.val() || {});
    ref.on("value", handler);
    state.reserveRef = ref;
    state.reserveHandler = handler;
    return true;
  }

  function syncSubscription() {
    if (isDm()) return attachReserves() || Boolean(state.reserveRef);
    detachReserves();
    return false;
  }

  function start() {
    if (state.started) return true;
    state.started = true;
    global.addEventListener?.("luminous:combat073-hydrated", syncSubscription);
    global.addEventListener?.("luminous:combat073-view-lifecycle", syncSubscription);
    syncSubscription();
    return true;
  }

  function stop() {
    detachReserves();
    global.removeEventListener?.("luminous:combat073-hydrated", syncSubscription);
    global.removeEventListener?.("luminous:combat073-view-lifecycle", syncSubscription);
    state.started = false;
    return true;
  }

  global.addEventListener?.("beforeunload", stop, { once: true });

  const api = Object.freeze({
    version: "0.7.3-deployment.1",
    ROOTS,
    state,
    isDm,
    fieldKeyForUnit,
    reserveEntries,
    backupUnits,
    setReserveCache,
    enqueueBackupUnit,
    promoteNextBackup,
    reconcileDefeatedRuntime,
    retreatUnit,
    escapeUnit,
    resolveRetreatEffect,
    resolveEscapeEffect,
    commandEncounter,
    attachReserves,
    detachReserves,
    syncSubscription,
    start,
    stop,
  });

  global.LuminousCombatDeploymentBridge073 = api;
  start();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
