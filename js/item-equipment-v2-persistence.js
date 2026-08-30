(function (global) {
  "use strict";

  const base = global.LuminousItemPersistenceRuntime;
  if (!base || base.__luminousEquipmentV2Persistence) return;

  function itemId(item = {}) {
    return String(item.instanceId || item.instance_id || item.id || item.key || "").trim();
  }

  function findInstance(state = {}, id) {
    const wanted = String(id || "").trim();
    if (!wanted) return null;
    return state.inventario_activo?.[wanted] || state.inventario_stash?.[wanted] || null;
  }

  function augmentIds(unit = {}) {
    const source = unit.augmentations || unit.augments || unit.bodyAugmentations || [];
    return [...new Set((Array.isArray(source) ? source : []).map(itemId).filter(Boolean))];
  }

  function restoreAugments(unit, state = {}) {
    const ids = Array.isArray(state.equipmentRefs?.augmentIds) ? state.equipmentRefs.augmentIds : [];
    const restored = ids.map((id) => findInstance(state, id)).filter(Boolean);
    restored.forEach((item) => {
      item.installed = true;
      item.equipped = true;
    });
    unit.augmentations = restored;
    return restored;
  }

  function serializeInventoryState(unit = {}) {
    const state = base.serializeInventoryState(unit);
    state.equipmentRefs = {
      ...(state.equipmentRefs || {}),
      augmentIds: augmentIds(unit),
    };
    return state;
  }

  function restoreEquipmentRefs(unit, state) {
    const result = base.restoreEquipmentRefs(unit, state);
    restoreAugments(unit, state);
    return result;
  }

  function applyInventoryState(unit, snapshot, options = {}) {
    const result = base.applyInventoryState(unit, snapshot, options);
    if (result?.applied) restoreAugments(unit, result.state || {});
    return result;
  }

  async function saveInventoryState(db, playerId, unitOrState, options = {}) {
    const result = await base.saveInventoryState(db, playerId, unitOrState, options);
    if (!result?.saved || !db?.ref) return result;

    const paths = base.playerPaths?.(playerId, options);
    if (!paths?.equipmentRefs) return result;

    const ids = augmentIds(unitOrState || {});
    const equipmentRef = db.ref(paths.equipmentRefs);
    if (typeof equipmentRef.update === "function") {
      await equipmentRef.update({ augmentIds: ids.length ? ids : null });
    } else if (typeof db.ref(`${paths.equipmentRefs}/augmentIds`).set === "function") {
      await db.ref(`${paths.equipmentRefs}/augmentIds`).set(ids.length ? ids : null);
    }

    if (result.state?.itemEquipmentRefs) {
      result.state.itemEquipmentRefs.augmentIds = ids;
    }
    return result;
  }

  global.LuminousItemPersistenceRuntime = Object.freeze({
    ...base,
    __luminousEquipmentV2Persistence: true,
    serializeInventoryState,
    restoreEquipmentRefs,
    applyInventoryState,
    saveInventoryState,
    restoreAugments,
  });
})(typeof window !== "undefined" ? window : globalThis);
