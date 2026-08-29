(function (global) {
  "use strict";

  if (global.LuminousItemRealtimeSync) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemRealtimeSync;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const persistence = () => global.LuminousItemPersistenceRuntime || safeRequire("./item-persistence-runtime.js");
  const inventory = () => global.LuminousItemInventoryRuntime || safeRequire("./item-inventory-runtime.js");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const STASH_ACCESS_PATH = "campaña/ajustes_globales/alijo_desbloqueado";

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function normalizeRole(value) {
    const role = String(value || "player").trim().toLowerCase();
    return role === "dm" ? "dm" : "player";
  }

  function playerPaths(playerId, options = {}) {
    const runtime = persistence();
    if (runtime?.playerPaths) return runtime.playerPaths(playerId, options);
    const root = String(options.playerRoot || "campaña/jugadores").replace(/\/+$/g, "");
    const id = String(playerId || "").trim();
    if (!id) return null;
    const base = `${root}/${id}`;
    return {
      base,
      active: `${base}/inventario_activo`,
      stash: `${base}/inventario_stash`,
      schemaVersion: `${base}/itemInventorySchemaVersion`,
      equipmentRefs: `${base}/itemEquipmentRefs`,
      attunement: `${base}/attunedItemInstanceIds`,
    };
  }

  function subscribeStashAccess(db, callback, options = {}) {
    if (!db || typeof db.ref !== "function" || typeof callback !== "function") return () => {};
    const path = String(options.stashAccessPath || STASH_ACCESS_PATH);
    const ref = db.ref(path);
    const handler = (snap) => callback(snap?.val?.() === true, { path, snapshot: snap });
    ref.on("value", handler);
    return () => ref.off?.("value", handler);
  }

  async function setStashAccess(db, unlocked, options = {}) {
    if (!db || typeof db.ref !== "function") return { saved: false, reason: "firebase_db_unavailable" };
    const path = String(options.stashAccessPath || STASH_ACCESS_PATH);
    const ref = db.ref(path);
    if (typeof ref.set !== "function") return { saved: false, reason: "firebase_write_unavailable", path };
    await ref.set(unlocked === true);
    const result = { saved: true, path, unlocked: unlocked === true };
    emit("luminous:stash-access-written", result);
    return result;
  }

  function bindPeer(options = {}) {
    const runtime = persistence();
    const db = options.db;
    const playerId = String(options.playerId || "").trim();
    const role = normalizeRole(options.role);
    const unit = options.unit && typeof options.unit === "object" ? options.unit : {};
    if (!runtime?.subscribePlayerInventory || !runtime?.applyInventoryState || !runtime?.saveInventoryState) {
      return { bound: false, reason: "item_persistence_runtime_unavailable", role, playerId, unit, dispose() {} };
    }
    if (!db || typeof db.ref !== "function") {
      return { bound: false, reason: "firebase_db_unavailable", role, playerId, unit, dispose() {} };
    }
    if (!playerId) return { bound: false, reason: "missing_player_id", role, playerId, unit, dispose() {} };

    let disposed = false;
    let revision = 0;
    let stashUnlocked = null;
    let lastState = null;
    const disposers = [];

    const unsubscribeInventory = runtime.subscribePlayerInventory(db, playerId, (state) => {
      if (disposed) return;
      const applied = runtime.applyInventoryState(unit, state, options);
      if (!applied?.applied) {
        options.onError?.({ source: "inventory", reason: applied?.reason || "inventory_apply_failed", state });
        return;
      }
      revision += 1;
      lastState = clone(state);
      const detail = { role, playerId, revision, state: clone(state), unit, source: "firebase" };
      options.onInventory?.(detail);
      emit("luminous:inventory-realtime", detail);
    }, options);
    disposers.push(unsubscribeInventory);

    if (options.watchStashAccess !== false) {
      const unsubscribeAccess = subscribeStashAccess(db, (unlocked, meta) => {
        if (disposed) return;
        stashUnlocked = unlocked;
        unit.stashUnlocked = unlocked;
        const detail = { role, playerId, unlocked, path: meta.path, unit, source: "firebase" };
        options.onStashAccess?.(detail);
        emit("luminous:stash-access-changed", detail);
      }, options);
      disposers.push(unsubscribeAccess);
    }

    async function save(unitOrState = unit, saveOptions = {}) {
      if (disposed) return { saved: false, reason: "peer_disposed" };
      const result = await runtime.saveInventoryState(db, playerId, unitOrState, { ...options, ...saveOptions });
      if (result?.saved) emit("luminous:inventory-realtime-write", { role, playerId, result });
      return result;
    }

    async function move(ref, direction, amount = null, moveOptions = {}) {
      if (disposed) return { moved: false, saved: false, reason: "peer_disposed" };
      const itemRuntime = inventory();
      if (!itemRuntime) return { moved: false, saved: false, reason: "item_inventory_runtime_unavailable" };
      const normalized = String(direction || "").trim().toLowerCase();
      const moved = normalized === "to_stash" || normalized === "stash"
        ? itemRuntime.moveToStash(unit, ref, amount, moveOptions)
        : normalized === "to_active" || normalized === "active"
          ? itemRuntime.moveToActive(unit, ref, amount, moveOptions)
          : { moved: false, reason: "invalid_move_direction" };
      if (!moved?.moved) return { ...moved, saved: false };
      const persisted = await save(unit, moveOptions);
      return { ...moved, saved: persisted?.saved === true, persistence: persisted };
    }

    async function setStashUnlocked(unlocked, accessOptions = {}) {
      if (role !== "dm" && accessOptions.allowPlayerWrite !== true) {
        return { saved: false, reason: "dm_role_required" };
      }
      return setStashAccess(db, unlocked, { ...options, ...accessOptions });
    }

    function dispose() {
      if (disposed) return;
      disposed = true;
      while (disposers.length) {
        try { disposers.pop()?.(); } catch (_) {}
      }
      emit("luminous:inventory-realtime-disposed", { role, playerId });
    }

    return {
      bound: true,
      role,
      playerId,
      unit,
      paths: playerPaths(playerId, options),
      get revision() { return revision; },
      get state() { return clone(lastState); },
      get stashUnlocked() { return stashUnlocked; },
      save,
      move,
      setStashUnlocked,
      dispose,
    };
  }

  function bindPlayerInventory(options = {}) { return bindPeer({ ...options, role: "player" }); }
  function bindDmInventory(options = {}) { return bindPeer({ ...options, role: "dm" }); }

  const api = Object.freeze({
    version: 1,
    STASH_ACCESS_PATH,
    normalizeRole,
    playerPaths,
    subscribeStashAccess,
    setStashAccess,
    bindPeer,
    bindPlayerInventory,
    bindDmInventory,
  });

  global.LuminousItemRealtimeSync = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
