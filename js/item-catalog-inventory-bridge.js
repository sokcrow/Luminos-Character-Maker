(function (global) {
  "use strict";

  if (global.LuminousItemCatalogInventoryBridge) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemCatalogInventoryBridge;
    return;
  }

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const catalog = () => global.LuminousItemCatalog;
  const inventory = () => global.LuminousItemInventoryRuntime;
  const runtime = () => global.LuminousItemRuntime;

  function catalogOptions(ref, options = {}) {
    const definition = catalog()?.resolveDefinition?.(ref);
    if (!definition) return options;
    const id = definition.canonicalId || definition.definitionId;
    return { ...options, catalog: { ...(options.catalog || {}), [id]: definition } };
  }

  function quantityOf(item = {}) {
    return runtime()?.quantityOf?.(item) ?? Math.max(0, Number(item.quantity ?? item.cantidad ?? 1) || 0);
  }

  function setQuantity(item, value) {
    if (runtime()?.setQuantity) return runtime().setQuantity(item, value);
    item.quantity = Math.max(0, Math.trunc(Number(value) || 0));
    return item.quantity;
  }

  function containerEntries(container) {
    if (Array.isArray(container)) return container.map((item, index) => [String(index), item]);
    return container && typeof container === "object" ? Object.entries(container) : [];
  }

  function addItemInstance(unit, definitionOrId, containerType = "stash", options = {}) {
    const base = inventory();
    if (!base || !unit) return { added: false, reason: "inventory_runtime_unavailable" };
    const definition = catalog()?.resolveDefinition?.(definitionOrId) || (typeof definitionOrId === "object" ? clone(definitionOrId) : null);
    if (!definition) return { added: false, reason: "unknown_definition" };
    const type = String(containerType || "stash").toLowerCase() === "active" ? "active" : "stash";
    const instance = base.createItemInstance(definition, { ...options, quantity: Math.max(1, Number(options.quantity) || 1) });
    const holder = type === "active" ? base.activeContainer(unit, true) : base.stashContainer(unit, true);
    const container = holder.value;
    const limit = base.stackLimit(instance, type);
    let remaining = quantityOf(instance);
    const insertedKeys = [];

    for (const [key, existing] of containerEntries(container)) {
      if (remaining <= 0 || !base.canStack(existing, instance)) continue;
      const room = Math.max(0, limit - quantityOf(existing));
      if (!room) continue;
      const moved = Math.min(room, remaining);
      setQuantity(existing, quantityOf(existing) + moved);
      remaining -= moved;
      insertedKeys.push(key);
    }

    while (remaining > 0) {
      if (type === "active" && containerEntries(container).filter(([, item]) => item && quantityOf(item) > 0).length >= base.activeSlotLimit(unit)) {
        return { added: insertedKeys.length > 0, partial: insertedKeys.length > 0, reason: "active_inventory_full", remaining, insertedKeys, instance };
      }
      const copy = clone(instance);
      copy.instanceId = insertedKeys.length ? base.createInstanceId(definition.canonicalId || definition.definitionId || "item") : instance.instanceId;
      setQuantity(copy, Math.min(limit, remaining));
      if (Array.isArray(container)) {
        container.push(copy);
        insertedKeys.push(String(container.length - 1));
      } else {
        container[copy.instanceId] = copy;
        insertedKeys.push(copy.instanceId);
      }
      remaining -= quantityOf(copy);
    }
    return { added: true, partial: false, insertedKeys, instance };
  }

  function install() {
    const base = inventory();
    const cat = catalog();
    if (!base || !cat) return false;
    if (base.__luminousItemCatalogBridge) return true;

    const wrapped = Object.freeze({
      ...base,
      __luminousItemCatalogBridge: true,
      resolveDefinition(ref, options = {}) {
        return cat.resolveDefinition(ref) || base.resolveDefinition(ref, options);
      },
      createItemInstance(definitionOrId, options = {}) {
        const definition = cat.resolveDefinition(definitionOrId) || definitionOrId;
        return base.createItemInstance(definition, catalogOptions(definition, options));
      },
      deserializeItemInstance(data, options = {}) {
        return base.deserializeItemInstance(data, catalogOptions(data, options));
      },
      hydrateItemInstance(instance, options = {}) {
        return base.hydrateItemInstance(instance, catalogOptions(instance, options));
      },
      resolveItem(instance, options = {}) {
        return base.resolveItem(instance, catalogOptions(instance, options));
      },
      migrateLegacyItem(item, key = null, options = {}) {
        return base.migrateLegacyItem(item, key, catalogOptions(item, options));
      },
      migrateLegacyInventory(unit, options = {}) {
        return base.migrateLegacyInventory(unit, { ...options, catalog: options.catalog || Object.fromEntries(cat.list().map((definition) => [definition.canonicalId, definition])) });
      },
      addItemInstance(unit, definitionOrId, containerType = "stash", options = {}) {
        return addItemInstance(unit, definitionOrId, containerType, options);
      }
    });

    global.LuminousItemInventoryRuntime = wrapped;
    global.LuminousItemRuntime = Object.freeze({ ...(runtime() || {}), ...wrapped, __luminousItemCatalogBridge: true });
    global.LuminousItemCatalogInventoryBridge = Object.freeze({ version: 1, install, addItemInstance, runtime: wrapped });
    return true;
  }

  install();
  if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemCatalogInventoryBridge;
})(typeof window !== "undefined" ? window : globalThis);
