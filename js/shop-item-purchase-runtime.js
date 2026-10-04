(function (global) {
  "use strict";

  if (global.LuminousShopItemPurchaseRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousShopItemPurchaseRuntime;
    return;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function clean(value) {
    return String(value ?? "").trim();
  }

  function intOr(value, fallback = 0) {
    return Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  }

  function definitionIdOf(item = {}, fallback = "") {
    return clean(
      item.definitionId ||
      item.definition_id ||
      item.canonicalId ||
      item.canonical_id ||
      item.itemId ||
      item.item_id ||
      item.id ||
      fallback
    );
  }

  function quantityOf(item = {}) {
    return Math.max(0, intOr(item.quantity ?? item.cantidad ?? item.qty ?? item.count, 1));
  }

  function tierKey(value) {
    const raw = clean(value || "I").toUpperCase();
    const roman = {
      I: 1, II: 2, III: 3, IV: 4, V: 5,
      VI: 6, VII: 7, VIII: 8, IX: 9, X: 10,
    };
    const numeric = roman[raw] || intOr(raw, 1) || 1;
    return String(Math.max(1, numeric));
  }

  function sameTier(a, b) {
    return tierKey(a) === tierKey(b);
  }

  function buildPurchasePayload(itemId, storeItem = {}, playerId = null, options = {}) {
    const source = clone(storeItem) || {};
    const definitionId = definitionIdOf(source, itemId);
    const runtime = options.inventoryRuntime || global.LuminousItemInventoryRuntime || null;

    source.id = source.id || definitionId || clean(itemId);
    source.definitionId = definitionId || clean(itemId);
    source.canonicalId = source.canonicalId || source.definitionId;
    source.quantity = 1;
    source.cantidad = 1;
    if (playerId != null) source.currentOwnerId = playerId;

    let instance = null;
    if (runtime && typeof runtime.createItemInstance === "function") {
      try {
        instance = runtime.createItemInstance(source, {
          quantity: 1,
          qualityTier: Number(source.qualityTier || 1) || 1,
          currentOwnerId: playerId,
        });
      } catch (_) {}
    }

    const payload = Object.assign({}, source, instance || {});
    payload.id = source.id || source.definitionId;
    payload.definitionId = source.definitionId || payload.id;
    payload.canonicalId = source.canonicalId || payload.definitionId;
    payload.nombre = source.nombre || source.name || payload.definitionId;
    payload.name = source.name || source.nombre || payload.nombre;
    payload.valorBase = Number(
      source.valorBase ??
      source.productionValueAhn ??
      source.unitValueAhn ??
      source.costo ??
      source.cost ??
      source.price ??
      source.precio ??
      0
    ) || 0;
    payload.quantity = 1;
    payload.cantidad = 1;
    if (playerId != null) payload.currentOwnerId = playerId;

    // Store-only metadata must not become part of the owned item instance.
    delete payload.stock_actual;
    delete payload.stock_maximo;
    delete payload.requisito_aparicion;

    return payload;
  }

  function mergePurchasedStack(existing = {}, purchased = {}, amount = 1) {
    const current = clone(existing) || {};
    const incoming = clone(purchased) || {};
    const add = Math.max(1, intOr(amount, 1));
    const total = quantityOf(current) + add;

    // Existing instance identity / ownership wins, while missing canonical
    // behavior (runtime, family, category, etc.) is repaired from the purchase.
    const merged = Object.assign({}, incoming, current);
    const preserveIfMissing = [
      "runtime",
      "category",
      "tipo_categoria",
      "itemType",
      "family",
      "iconFamily",
      "tags",
      "function",
      "functions",
      "consumable_details",
    ];
    preserveIfMissing.forEach((field) => {
      if (current[field] == null && incoming[field] != null) merged[field] = clone(incoming[field]);
    });

    merged.id = current.id || incoming.id || definitionIdOf(current) || definitionIdOf(incoming);
    merged.definitionId = definitionIdOf(current) || definitionIdOf(incoming) || merged.id;
    merged.canonicalId = current.canonicalId || incoming.canonicalId || merged.definitionId;
    merged.instanceId = current.instanceId || current.instance_id || incoming.instanceId || incoming.instance_id;
    merged.quantity = total;
    merged.cantidad = total;

    return merged;
  }

  const API = Object.freeze({
    version: 1,
    definitionIdOf,
    quantityOf,
    tierKey,
    sameTier,
    buildPurchasePayload,
    mergePurchasedStack,
  });

  global.LuminousShopItemPurchaseRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
