(function (global) {
  "use strict";

  if (global.LuminousItemPersistenceRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemPersistenceRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const inventory = () => global.LuminousItemInventoryRuntime || safeRequire("./item-inventory-runtime.js");
  const workshopRuntime = () => global.LuminousWorkshopRuntime || safeRequire("./workshop-runtime.js");
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const SCHEMA_VERSION = 2;

  function emit(name, detail) {
    try {
      if (typeof global.dispatchEvent === "function" && typeof global.CustomEvent === "function") {
        global.dispatchEvent(new global.CustomEvent(name, { detail }));
      }
    } catch (_) {}
    return detail;
  }

  function objectEntries(container) {
    if (Array.isArray(container)) return container.map((item, index) => [String(index), item]);
    return container && typeof container === "object" ? Object.entries(container) : [];
  }

  function serializeContainer(container) {
    const runtime = inventory();
    const out = {};
    objectEntries(container).forEach(([key, item]) => {
      if (!item || typeof item !== "object") return;
      const serialized = runtime?.serializeItemInstance?.(item) || clone(item);
      const instanceId = String(serialized.instanceId || key);
      serialized.instanceId = instanceId;
      out[instanceId] = serialized;
    });
    return out;
  }

  function equipmentRefs(unit = {}) {
    const equipment = unit.equipment && typeof unit.equipment === "object" ? unit.equipment : {};
    const refOf = (item) => item && typeof item === "object" ? (item.instanceId || item.instance_id || null) : (typeof item === "string" ? item : null);
    return {
      mainHand: refOf(equipment.mainHand),
      offHand: refOf(equipment.offHand),
      armor: refOf(equipment.armor),
      shield: refOf(equipment.shield),
      accessoryIds: Array.isArray(equipment.accessories) ? equipment.accessories.map(refOf).filter(Boolean) : [],
    };
  }

  function serializeInventoryState(unit = {}) {
    const runtime = inventory();
    const active = runtime?.activeContainer?.(unit)?.value || unit.inventario_activo || {};
    const stash = runtime?.stashContainer?.(unit)?.value || unit.inventario_stash || {};
    return {
      schemaVersion: SCHEMA_VERSION,
      inventario_activo: serializeContainer(active),
      inventario_stash: serializeContainer(stash),
      equipmentRefs: equipmentRefs(unit),
      attunedItemInstanceIds: [...new Set((unit.attunedItemInstanceIds || []).map(String).filter(Boolean))],
    };
  }

  function deserializeContainer(raw, options = {}) {
    const runtime = inventory();
    if (!raw || typeof raw !== "object") return {};
    const out = {};
    objectEntries(raw).forEach(([key, item]) => {
      if (!item || typeof item !== "object") return;
      const instance = intOr(item.schemaVersion, 0) >= SCHEMA_VERSION && item.instanceId && item.definitionId
        ? (runtime?.deserializeItemInstance?.(item, options) || clone(item))
        : (runtime?.migrateLegacyItem?.(item, key, options) || clone(item));
      const instanceId = String(instance.instanceId || key);
      instance.instanceId = instanceId;
      out[instanceId] = instance;
    });
    return out;
  }

  function deserializeInventoryState(snapshot = {}, options = {}) {
    return {
      schemaVersion: SCHEMA_VERSION,
      inventario_activo: deserializeContainer(snapshot.inventario_activo || snapshot.activeInventory || snapshot.inventory || {}, options),
      inventario_stash: deserializeContainer(snapshot.inventario_stash || snapshot.stashInventory || snapshot.stash || {}, options),
      equipmentRefs: clone(snapshot.equipmentRefs || {}),
      attunedItemInstanceIds: [...new Set((snapshot.attunedItemInstanceIds || snapshot.attunedItems || []).map(String).filter(Boolean))],
      migratedFromVersion: intOr(snapshot.schemaVersion, 0),
    };
  }

  function findInstance(state, instanceId) {
    const id = String(instanceId || "");
    return state?.inventario_activo?.[id] || state?.inventario_stash?.[id] || null;
  }

  function restoreEquipmentRefs(unit, state) {
    const refs = state?.equipmentRefs || {};
    if (!unit.equipment || typeof unit.equipment !== "object" || Array.isArray(unit.equipment)) unit.equipment = {};
    ["mainHand", "offHand", "armor", "shield"].forEach((slot) => {
      const id = refs[slot];
      if (!id) return;
      const item = findInstance(state, id);
      if (item) unit.equipment[slot] = item;
    });
    if (Array.isArray(refs.accessoryIds)) {
      unit.equipment.accessories = refs.accessoryIds.map((id) => findInstance(state, id)).filter(Boolean);
    }
    return unit.equipment;
  }

  function applyInventoryState(unit, snapshot, options = {}) {
    if (!unit || typeof unit !== "object") return { applied: false, reason: "missing_unit" };
    const state = deserializeInventoryState(snapshot, options);
    unit.inventario_activo = state.inventario_activo;
    unit.inventario_stash = state.inventario_stash;
    unit.itemInventorySchemaVersion = SCHEMA_VERSION;
    unit.attunedItemInstanceIds = state.attunedItemInstanceIds;
    restoreEquipmentRefs(unit, state);
    const result = { applied: true, state, activeCount: Object.keys(state.inventario_activo).length, stashCount: Object.keys(state.inventario_stash).length };
    emit("luminous:inventory-state-applied", { unit, ...result });
    return result;
  }

  function playerPaths(playerId, options = {}) {
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

  function requireDb(db) {
    return Boolean(db && typeof db.ref === "function");
  }

  async function loadPlayerInventory(db, playerId, options = {}) {
    if (!requireDb(db)) return { loaded: false, reason: "firebase_db_unavailable" };
    const paths = playerPaths(playerId, options);
    if (!paths) return { loaded: false, reason: "missing_player_id" };
    const [activeSnap, stashSnap, versionSnap, equipmentSnap, attunementSnap] = await Promise.all([
      db.ref(paths.active).once("value"),
      db.ref(paths.stash).once("value"),
      db.ref(paths.schemaVersion).once("value"),
      db.ref(paths.equipmentRefs).once("value"),
      db.ref(paths.attunement).once("value"),
    ]);
    const raw = {
      schemaVersion: versionSnap?.val?.() || 0,
      inventario_activo: activeSnap?.val?.() || {},
      inventario_stash: stashSnap?.val?.() || {},
      equipmentRefs: equipmentSnap?.val?.() || {},
      attunedItemInstanceIds: attunementSnap?.val?.() || [],
    };
    const state = deserializeInventoryState(raw, options);
    const migrated = intOr(raw.schemaVersion, 0) < SCHEMA_VERSION;
    if (migrated && options.writeBackMigration === true) {
      await saveInventoryState(db, playerId, state, options);
    }
    const result = { loaded: true, playerId: String(playerId), migrated, state };
    emit("luminous:inventory-loaded", result);
    return result;
  }

  async function saveInventoryState(db, playerId, unitOrState, options = {}) {
    if (!requireDb(db)) return { saved: false, reason: "firebase_db_unavailable" };
    const paths = playerPaths(playerId, options);
    if (!paths) return { saved: false, reason: "missing_player_id" };
    const state = unitOrState?.inventario_activo || unitOrState?.inventario_stash
      ? serializeInventoryState(unitOrState)
      : deserializeInventoryState(unitOrState || {}, options);
    const updates = {
      inventario_activo: serializeContainer(state.inventario_activo),
      inventario_stash: serializeContainer(state.inventario_stash),
      itemInventorySchemaVersion: SCHEMA_VERSION,
      itemEquipmentRefs: clone(state.equipmentRefs || {}),
      attunedItemInstanceIds: clone(state.attunedItemInstanceIds || []),
    };
    const ref = db.ref(paths.base);
    if (typeof ref.update === "function") await ref.update(updates);
    else if (typeof ref.set === "function") {
      await Promise.all(Object.entries(updates).map(([key, value]) => db.ref(`${paths.base}/${key}`).set(value)));
    } else return { saved: false, reason: "firebase_write_unavailable" };
    const result = { saved: true, playerId: String(playerId), schemaVersion: SCHEMA_VERSION, state: updates };
    emit("luminous:inventory-saved", result);
    return result;
  }

  function subscribePlayerInventory(db, playerId, callback, options = {}) {
    if (!requireDb(db) || typeof callback !== "function") return () => {};
    const paths = playerPaths(playerId, options);
    if (!paths) return () => {};
    let active = {};
    let stash = {};
    let schemaVersion = 0;
    let equipment = {};
    let attunement = [];
    let scheduled = false;

    const publish = () => {
      if (scheduled) return;
      scheduled = true;
      Promise.resolve().then(() => {
        scheduled = false;
        callback(deserializeInventoryState({
          schemaVersion,
          inventario_activo: active,
          inventario_stash: stash,
          equipmentRefs: equipment,
          attunedItemInstanceIds: attunement,
        }, options));
      });
    };
    const handlers = [
      [paths.active, (snap) => { active = snap?.val?.() || {}; publish(); }],
      [paths.stash, (snap) => { stash = snap?.val?.() || {}; publish(); }],
      [paths.schemaVersion, (snap) => { schemaVersion = snap?.val?.() || 0; publish(); }],
      [paths.equipmentRefs, (snap) => { equipment = snap?.val?.() || {}; publish(); }],
      [paths.attunement, (snap) => { attunement = snap?.val?.() || []; publish(); }],
    ];
    handlers.forEach(([path, handler]) => db.ref(path).on("value", handler));
    return () => handlers.forEach(([path, handler]) => db.ref(path).off?.("value", handler));
  }

  async function readStashAccess(db, options = {}) {
    if (!requireDb(db)) return { loaded: false, reason: "firebase_db_unavailable", unlocked: false };
    const path = options.stashAccessPath || "campaña/ajustes_globales/alijo_desbloqueado";
    const snap = await db.ref(path).once("value");
    return { loaded: true, path, unlocked: snap?.val?.() === true };
  }

  function serializeWorkshopState(runtime = workshopRuntime()) {
    const list = runtime?.listWorkshops?.() || [];
    const workshopMap = {};
    list.forEach((workshop) => {
      if (workshop?.workshopId) workshopMap[workshop.workshopId] = runtime?.serializeWorkshop?.(workshop) || clone(workshop);
    });
    return { schemaVersion: 1, workshops: workshopMap };
  }

  function hydrateWorkshopState(snapshot = {}, runtime = workshopRuntime()) {
    if (!runtime?.registerWorkshop) return { hydrated: false, reason: "workshop_runtime_unavailable" };
    const source = snapshot.workshops || snapshot;
    const results = [];
    Object.values(source || {}).forEach((workshop) => {
      if (!workshop?.workshopId) return;
      results.push(runtime.registerWorkshop(workshop));
    });
    return { hydrated: true, count: results.filter((entry) => entry.registered).length, results };
  }

  async function saveWorkshopState(db, path, runtime = workshopRuntime()) {
    if (!requireDb(db)) return { saved: false, reason: "firebase_db_unavailable" };
    if (!path) return { saved: false, reason: "workshop_path_required" };
    const state = serializeWorkshopState(runtime);
    const ref = db.ref(String(path));
    if (typeof ref.set === "function") await ref.set(state);
    else if (typeof ref.update === "function") await ref.update(state);
    else return { saved: false, reason: "firebase_write_unavailable" };
    return { saved: true, path: String(path), count: Object.keys(state.workshops).length };
  }

  async function loadWorkshopState(db, path, runtime = workshopRuntime()) {
    if (!requireDb(db)) return { loaded: false, reason: "firebase_db_unavailable" };
    if (!path) return { loaded: false, reason: "workshop_path_required" };
    const snap = await db.ref(String(path)).once("value");
    const state = snap?.val?.() || { schemaVersion: 1, workshops: {} };
    const hydrated = hydrateWorkshopState(state, runtime);
    return { loaded: true, path: String(path), state, ...hydrated };
  }

  const api = Object.freeze({
    version: 1,
    schemaVersion: SCHEMA_VERSION,
    serializeContainer,
    serializeInventoryState,
    deserializeInventoryState,
    restoreEquipmentRefs,
    applyInventoryState,
    playerPaths,
    loadPlayerInventory,
    saveInventoryState,
    subscribePlayerInventory,
    readStashAccess,
    serializeWorkshopState,
    hydrateWorkshopState,
    saveWorkshopState,
    loadWorkshopState,
  });

  global.LuminousItemPersistenceRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
