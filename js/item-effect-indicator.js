(function (global) {
  "use strict";

  if (global.LuminousItemEffectIndicator) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemEffectIndicator;
    return;
  }

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const intOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : fallback;
  const normalizeId = (value) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  function maxHpOf(unit = {}) {
    const candidates = [
      unit.hp_max, unit.maxHp, unit.max_hp, unit.hpMax,
      unit.vitals?.hp_max, unit.vitals?.maxHp, unit.vitals?.max_hp,
    ];
    const value = candidates.find((entry) => Number.isFinite(Number(entry)) && Number(entry) > 0);
    return value == null ? null : Number(value);
  }

  function currentHpOf(unit = {}) {
    const candidates = [unit.hp, unit.currentHp, unit.current_hp, unit.vitals?.hp, unit.vitals?.currentHp];
    const value = candidates.find((entry) => Number.isFinite(Number(entry)));
    return value == null ? null : Number(value);
  }

  function actionCost(item = {}) {
    const runtime = item.runtime || item.itemRuntime || item.item_runtime || {};
    return normalizeId(runtime.actionCost || runtime.action_cost || item.consumable_details?.action_cost || "action");
  }

  function hpHealing(item = {}) {
    const runtime = item.runtime || {};
    return runtime.healing || runtime.hybridHealing?.hp || null;
  }

  function spHealing(item = {}) {
    const runtime = item.runtime || {};
    return runtime.spHealing || runtime.hybridHealing?.sp || null;
  }

  function hpImmediateAmount(item = {}, unit = {}) {
    const healing = hpHealing(item);
    if (!healing) {
      const runtime = item.runtime || {};
      const raw = runtime.effects?.hpRestore ?? runtime.effects?.hp_restore ?? runtime.hpRestore ?? runtime.hp_restore ?? item.consumable_details?.curacion_hp;
      return Math.max(0, Math.floor(numberOr(raw, 0)));
    }

    if (normalizeId(healing.mode) === "full") return null;

    const maxHp = maxHpOf(unit);
    if (maxHp == null) {
      const flatOnly = Math.max(0, Math.floor(numberOr(healing.flat, 0)));
      return flatOnly || null;
    }
    const raw = Math.max(0, numberOr(healing.flat, 0) + maxHp * (numberOr(healing.maxHpPercent ?? healing.max_hp_percent, 0) / 100));
    const capPercent = Math.max(0, numberOr(healing.capMaxHpPercent ?? healing.cap_max_hp_percent, 0));
    const cap = capPercent > 0 ? Math.floor(maxHp * (capPercent / 100)) : Math.floor(raw);
    return Math.max(0, Math.floor(Math.min(raw, cap)));
  }

  function hpRegenAmount(item = {}, unit = {}) {
    const regen = hpHealing(item)?.regen;
    if (!regen) return null;
    const maxHp = maxHpOf(unit);
    if (maxHp == null) {
      const flat = Math.floor(Math.max(0, numberOr(regen.flatPerTurn ?? regen.flat_per_turn, 0)));
      return flat || null;
    }
    return Math.floor(Math.max(
      0,
      numberOr(regen.flatPerTurn ?? regen.flat_per_turn, 0)
      + maxHp * (numberOr(regen.maxHpPercentPerTurn ?? regen.max_hp_percent_per_turn, 0) / 100),
    ));
  }

  function spImmediateAmount(item = {}) {
    const runtime = item.runtime || {};
    const healing = spHealing(item);
    const raw = runtime.effects?.spRestore ?? runtime.effects?.sp_restore ?? runtime.spRestore ?? runtime.sp_restore ?? healing?.immediate;
    return Math.max(0, Math.floor(numberOr(raw, 0)));
  }

  function spRegenAmount(item = {}) {
    const regen = spHealing(item)?.regen;
    if (!regen) return null;
    const raw = regen.spPerTurn ?? regen.sp_per_turn ?? regen.amountPerTurn ?? regen.amount_per_turn;
    const value = Math.floor(Math.max(0, numberOr(raw, 0)));
    return value || null;
  }

  function regenDuration(regen = {}, useTiming = "") {
    const hours = numberOr(regen.durationHours ?? regen.duration_hours, 0);
    if (hours > 0) return { kind: "time", short: hours % 1 === 0 ? `${hours}h` : `${hours.toFixed(1)}h`, long: `${hours} hour${hours === 1 ? "" : "s"}` };
    const minutes = numberOr(regen.durationMinutes ?? regen.duration_minutes, 0);
    if (minutes > 0) return { kind: "time", short: `${minutes}m`, long: `${minutes} minute${minutes === 1 ? "" : "s"}` };
    const seconds = numberOr(regen.durationSeconds ?? regen.duration_seconds, 0);
    if (seconds > 0) return { kind: "time", short: `${seconds}s`, long: `${seconds} second${seconds === 1 ? "" : "s"}` };
    const turns = Math.max(0, intOr(regen.turns, 0));
    if (turns > 0) {
      const unit = normalizeId(useTiming) === "off_combat" ? "recovery cycles" : "turns";
      return { kind: "turns", short: `×${turns}`, long: `${turns} ${unit}` };
    }
    return null;
  }

  function statusDefinition(statusId, statusLibrary = null) {
    const id = normalizeId(statusId);
    const source = statusLibrary || global.LuminousStatusLibrary;
    const def = source?.get?.(id) || global.STATUS_REGISTRY?.[id] || null;
    return def ? clone(def) : { id, name: String(statusId || id || "Status"), icon: null };
  }

  function cleanseIndicators(item = {}, statusLibrary = null) {
    const runtime = item.runtime || {};
    const adjustments = asArray(
      runtime.statusCure?.statusAdjustments
      || runtime.status_cure?.status_adjustments
      || runtime.effects?.statusAdjustments
      || runtime.effects?.status_adjustments
      || [],
    );
    const removals = asArray(runtime.removeStatuses || runtime.remove_statuses || runtime.effects?.removeStatuses || runtime.effects?.remove_statuses);
    const byStatus = new Map();

    adjustments.forEach((entry) => {
      const statusId = normalizeId(entry?.statusId || entry?.status_id);
      if (!statusId) return;
      const countDelta = numberOr(entry?.countDelta ?? entry?.count_delta, 0);
      const potencyDelta = numberOr(entry?.potencyDelta ?? entry?.potency_delta, 0);
      if (countDelta >= 0 && potencyDelta >= 0) return;
      const current = byStatus.get(statusId) || { statusId, countDelta: 0, potencyDelta: 0, fullRemove: false };
      current.countDelta += countDelta;
      current.potencyDelta += potencyDelta;
      byStatus.set(statusId, current);
    });

    removals.map(normalizeId).filter(Boolean).forEach((statusId) => {
      const current = byStatus.get(statusId) || { statusId, countDelta: 0, potencyDelta: 0, fullRemove: false };
      current.fullRemove = true;
      byStatus.set(statusId, current);
    });

    return [...byStatus.values()].map((entry) => {
      const def = statusDefinition(entry.statusId, statusLibrary);
      const parts = [];
      if (entry.fullRemove) parts.push("remove");
      if (entry.countDelta < 0) parts.push(`${Math.abs(entry.countDelta)} Count`);
      if (entry.potencyDelta < 0) parts.push(`${Math.abs(entry.potencyDelta)} Potency`);
      return {
        kind: "cleanse",
        tone: "cleanse",
        statusId: entry.statusId,
        label: def.name || entry.statusId,
        icon: def.icon || null,
        detail: `Cleanse ${def.name || entry.statusId}${parts.length ? ` · ${parts.join(" + ")}` : ""}`,
      };
    });
  }

  function indicators(item = {}, unit = {}, options = {}) {
    const resolved = options.resolveItem?.(item) || item;
    const runtimeApi = options.runtime || global.LuminousItemRuntime || null;
    const useTiming = actionCost(resolved);
    const out = [];

    const hpHealingProfile = hpHealing(resolved);
    const hpImmediate = hpImmediateAmount(resolved, unit);
    if (hpHealingProfile || hpImmediate > 0) {
      if (normalizeId(hpHealingProfile?.mode) === "full") {
        out.push({ kind: "hp", tone: "hp", label: "HP FULL", detail: "Restores HP to full on use." });
      } else if (hpImmediate == null) {
        out.push({ kind: "hp", tone: "hp", label: "HP", detail: "Restores HP on use." });
      } else if (hpImmediate > 0) {
        out.push({ kind: "hp", tone: "hp", label: `HP +${hpImmediate}`, detail: `Restore ${hpImmediate} HP on use.` });
      }
      const regen = hpHealingProfile?.regen;
      const perTick = hpRegenAmount(resolved, unit);
      if (regen && perTick > 0) {
        const duration = regenDuration(regen, useTiming);
        const suffix = duration ? ` ${duration.short}` : "";
        const timing = useTiming === "off_combat" ? "off combat" : "in combat";
        out.push({
          kind: "hp_regen",
          tone: "hp",
          label: `HP REGEN +${perTick}${suffix}`,
          detail: `HP Regen · +${perTick} HP per tick${duration ? ` for ${duration.long}` : ""} · ${timing}.`,
        });
      }
    }

    const spProfile = spHealing(resolved);
    const spImmediate = spImmediateAmount(resolved);
    if (spProfile || spImmediate > 0) {
      if (spImmediate > 0) {
        out.push({ kind: "sp", tone: "sp", label: `SP +${spImmediate}`, detail: `Restore ${spImmediate} SP on use.` });
      } else if (spProfile) {
        out.push({ kind: "sp", tone: "sp", label: "SP", detail: "Restores SP on use." });
      }
      const regen = spProfile?.regen;
      const perTick = spRegenAmount(resolved);
      if (regen && perTick > 0) {
        const duration = regenDuration(regen, useTiming);
        const suffix = duration ? ` ${duration.short}` : "";
        const timing = useTiming === "off_combat" ? "off combat" : "in combat";
        out.push({
          kind: "sp_regen",
          tone: "sp",
          label: `SP REGEN +${perTick}${suffix}`,
          detail: `SP Regen · +${perTick} SP per tick${duration ? ` for ${duration.long}` : ""} · ${timing}.`,
        });
      }
    }

    out.push(...cleanseIndicators(resolved, options.statusLibrary));
    return out;
  }

  const API = Object.freeze({
    version: 1,
    maxHpOf,
    hpImmediateAmount,
    hpRegenAmount,
    spImmediateAmount,
    spRegenAmount,
    regenDuration,
    cleanseIndicators,
    indicators,
  });

  global.LuminousItemEffectIndicator = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
