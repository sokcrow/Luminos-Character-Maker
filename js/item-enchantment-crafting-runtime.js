(function (global) {
  "use strict";
  if (global.LuminousEnchantmentCraftingRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEnchantmentCraftingRuntime;
    return;
  }
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const recipes = () => global.LuminousEnchantmentRecipeCatalog || (typeof require === "function" ? require("./item-enchantment-recipe-catalog.js") : null);
  const magic = () => global.LuminousItemEnchantmentRuntime || (typeof require === "function" ? require("./item-enchantment-runtime.js") : null);
  const refId = (item) => String(item?.instanceId || item?.instance_id || "").trim();
  const definitionId = (item) => String(item?.definitionId || item?.definition_id || item?.itemId || item?.item_id || "").trim();
  const amount = (item) => Math.max(0, Math.trunc(Number(item?.quantity ?? item?.cantidad ?? 1) || 0));
  function materialUnits(item, ingredientId) {
    if (ingredientId === "arcane_essence") {
      const essences = item?.remainingEssenceUnits ?? item?.essenceUnits;
      if (essences != null && Number.isFinite(Number(essences))) {
        return Math.max(0, Math.trunc(Number(essences)));
      }
    }
    return amount(item);
  }
  function findTarget(unit, id) {
    for (const key of ["inventario_activo", "inventario_stash"]) {
      for (const [entry, item] of Object.entries(unit?.[key] || {})) {
        if (item && refId(item) === String(id)) return { container: unit[key], entry, item, slot: key };
      }
    }
    return null;
  }
  function availableMaterials(unit, ingredientId, targetId) {
    let total = 0;
    for (const key of ["inventario_activo", "inventario_stash"]) {
      for (const item of Object.values(unit?.[key] || {})) {
        if (!item || refId(item) === String(targetId) || definitionId(item) !== String(ingredientId)) continue;
        if (item.equipped === true) continue;
        total += materialUnits(item, ingredientId);
      }
    }
    return total;
  }
  function missingMaterials(unit, prepared, targetId) {
    return (prepared?.materials || []).map((entry) => ({
      definitionId: entry.definitionId,
      name: entry.name,
      required: entry.quantity,
      owned: availableMaterials(unit, entry.definitionId, targetId),
    })).filter((entry) => entry.owned < entry.required);
  }
  function balanceAhn(unit = {}) {
    const direct = unit.finance?.currentBalance ?? unit.ahn;
    const n = Number(direct);
    return direct != null && Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
  }
  function craftUnit(player, targetId, request = {}, options = {}) {
    if (!player || typeof player !== "object") return { crafted: false, reason: "missing_player" };
    const copy = clone(player);
    const target = findTarget(copy, targetId);
    if (!target) return { crafted: false, reason: "target_not_in_inventory" };
    if (amount(target.item) !== 1) return { crafted: false, reason: "unique_item_required" };
    const prepared = recipes()?.quote?.(target.item, request);
    if (!prepared?.valid) return { crafted: false, reason: prepared?.reason || "recipe_unavailable", quote: prepared };
    const missing = missingMaterials(copy, prepared, targetId);
    if (missing.length) return { crafted: false, reason: "missing_materials", missing, quote: prepared };
    const balance = balanceAhn(copy);
    if (balance == null) return { crafted: false, reason: "finance_balance_missing", quote: prepared };
    if (balance < prepared.chargedAhn) return { crafted: false, reason: "insufficient_ahn", availableAhn: balance, quote: prepared };
    // Validate all stock and currency before changing a single value.
    for (const requirement of prepared.materials) {
      let remaining = requirement.quantity;
      for (const key of ["inventario_activo", "inventario_stash"]) {
        for (const [itemKey, item] of Object.entries(copy[key] || {})) {
          if (!remaining) break;
          if (refId(item) === String(targetId) || item?.equipped === true || definitionId(item) !== requirement.definitionId) continue;
          const unitCount = materialUnits(item, requirement.definitionId);
          const take = Math.min(remaining, unitCount);
          if (take <= 0) continue;
          const next = unitCount - take;
          if (next === 0) delete copy[key][itemKey];
          else {
            if (requirement.definitionId === "arcane_essence" && (item.essenceUnits != null || item.remainingEssenceUnits != null)) {
              item.essenceUnits = next;
              item.remainingEssenceUnits = next;
            } else {
              item.quantity = next;
              item.cantidad = next;
            }
            if (item.unitValueAhn != null) item.totalValueAhn = Number(item.unitValueAhn) * next;
          }
          remaining -= take;
        }
      }
      if (remaining) return { crafted: false, reason: "material_race_prevented" };
    }
    const applied = magic()?.applyEnchantment?.(target.item, { level: request.tier, channel: request.channel }, { replace: request.replace === true, emit: false });
    if (!applied?.applied) return { crafted: false, reason: applied?.reason || "enchantment_failed" };
    const valued = recipes()?.applyValuation?.(target.item, prepared, { mode: "craft" });
    if (!valued?.applied) return { crafted: false, reason: "valuation_failed" };
    const nextBalance = balance - prepared.chargedAhn;
    copy.ahn = nextBalance;
    copy.finance = copy.finance && typeof copy.finance === "object" ? copy.finance : {};
    copy.finance.currentBalance = nextBalance;
    const receiptKey = String(options.receiptKey || "").trim();
    if (receiptKey) {
      const concept = `Encantamiento +${prepared.tier} · ${target.item.displayName || target.item.nombre || target.item.name || "Objeto"}`;
      const timestamp = Number(options.now) || Date.now();
      const entry = {
        monto: -prepared.chargedAhn,
        concepto: concept,
        fecha: timestamp,
        timestamp,
        unread: true,
        // Keep both canonical finance and legacy transaction consumers in sync.
        amount: -prepared.chargedAhn,
        concept,
        type: "expense",
        currency: "AHN",
      };
      const asObject = (value) => value && typeof value === "object"
        ? (Array.isArray(value) ? Object.fromEntries(value.map((row, i) => [String(i), row])) : value)
        : {};
      copy.finance.transactionHistory = { ...asObject(copy.finance.transactionHistory), [receiptKey]: entry };
      copy.transacciones = { ...asObject(copy.transacciones), [receiptKey]: clone(entry) };
    }
    // A legacy embedded equipment pointer must not reference the old instance clone.
    const equipment = copy.equipment && typeof copy.equipment === "object" ? copy.equipment : null;
    if (equipment) {
      for (const slot of ["mainHand", "offHand", "armor", "shield"]) {
        if (refId(equipment[slot]) === String(targetId)) equipment[slot] = target.item;
      }
      if (Array.isArray(equipment.accessories)) {
        equipment.accessories = equipment.accessories.map((item) => refId(item) === String(targetId) ? target.item : item);
      }
    }
    return { crafted: true, player: copy, quote: prepared, target: clone(target.item), chargedAhn: prepared.chargedAhn };
  }
  async function craftPlayer(db, playerId, targetId, request = {}, options = {}) {
    const player = String(playerId || "").trim();
    if (!db?.ref || !player || !targetId) return { crafted: false, reason: "firebase_or_player_missing" };
    const root = db.ref(`campaña/jugadores/${player}`);
    if (typeof root.transaction !== "function") return { crafted: false, reason: "firebase_transaction_required" };
    const receiptKey = db.ref(`campaña/jugadores/${player}/finance/transactionHistory`).push?.().key;
    if (!receiptKey) return { crafted: false, reason: "transaction_key_unavailable" };
    let final = null;
    try {
      const receipt = await root.transaction((current) => {
        final = craftUnit(current, targetId, request, { receiptKey, now: options.now || Date.now() });
        return final.crafted ? final.player : undefined;
      }, undefined, false);
      if (receipt?.committed !== true) {
        return { crafted: false, reason: final?.reason || "transaction_not_committed", missing: final?.missing || [], quote: final?.quote || null };
      }
      return { crafted: true, quote: final?.quote || null, itemInstanceId: String(targetId), chargedAhn: final?.chargedAhn || 0 };
    } catch (error) {
      return { crafted: false, reason: "transaction_failed", message: String(error?.message || error) };
    }
  }
  const api = Object.freeze({ version: 1, findTarget, availableMaterials, missingMaterials, balanceAhn, craftUnit, craftPlayer });
  global.LuminousEnchantmentCraftingRuntime = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
