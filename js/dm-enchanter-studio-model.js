(function (global) {
  "use strict";
  if (global.LuminousDmEnchanterStudioModel) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousDmEnchanterStudioModel;
    return;
  }

  const CHANNEL_LABELS = Object.freeze({
    offensive_level: "Nivel ofensivo",
    defensive_level: "Nivel defensivo",
    base_power: "Poder base",
    final_power: "Poder final",
    clash_power: "Poder de choque",
    guard_power: "Poder de guardia",
    speed: "Velocidad",
    min_speed: "Velocidad mínima",
    max_speed: "Velocidad máxima",
  });
  const KIND_LABELS = Object.freeze({
    weapon: "Arma",
    armor: "Armadura",
    shield: "Escudo",
    accessory: "Accesorio",
    valuable: "Objeto valioso",
  });
  const MESSAGES = Object.freeze({
    runtime_unavailable: "El sistema de encantamientos aún no está disponible.",
    missing_item: "Selecciona primero un objeto.",
    missing_item_instance_id: "Este objeto necesita guardarse como ejemplar individual.",
    ineligible_equipment_kind: "Este tipo de objeto no admite encantamientos.",
    item_not_enchantment_ready: "Este accesorio o artículo todavía no está preparado para encantarse.",
    unsupported_enchantment_level: "El nivel mágico permitido es de +1 a +3.",
    incompatible_enchantment_channel: "Este efecto no es compatible con el objeto.",
    already_enchanted: "Este objeto ya tiene un encantamiento. Confirma su reemplazo.",
    item_not_enchanted: "Este objeto no tiene un encantamiento que retirar.",
    enchantment_changed: "El encantamiento cambió desde que lo abriste. Vuelve a abrir el objeto.",
    invalid_change: "El cambio seleccionado no es válido.",
  });
  const clone = (v) => v == null ? v : JSON.parse(JSON.stringify(v));
  const engine = () => global.LuminousItemEnchantmentRuntime || null;
  function errorMessage(reason) { return MESSAGES[reason] || "No fue posible realizar este cambio."; }
  function snapshot(item = {}) {
    return JSON.stringify({
      instanceId: item.instanceId ?? item.instance_id ?? null,
      definitionId: item.definitionId ?? item.definition_id ?? null,
      itemType: item.itemType ?? null,
      category: item.category ?? null,
      enhancementLevel: item.enhancementLevel ?? null,
      enhancementSource: item.enhancementSource ?? null,
      enchanted: item.enchanted ?? null,
      enchantment: item.enchantment ?? null,
      enchantmentReady: item.enchantmentReady ?? null,
    });
  }
  function available(item = {}) {
    const api = engine();
    if (!api) return { eligible: false, reason: "runtime_unavailable", choices: [] };
    const kind = api.kindOf(item);
    const channels = api.CHANNELS_BY_KIND?.[kind] || [];
    const ready = !["accessory", "valuable"].includes(kind) || item.enchantmentReady === true;
    return {
      eligible: Boolean(channels.length && ready),
      reason: channels.length ? (ready ? null : "item_not_enchantment_ready") : "ineligible_equipment_kind",
      kind,
      kindLabel: KIND_LABELS[kind] || "Objeto",
      choices: channels.map((value) => ({ value, label: CHANNEL_LABELS[value] || value })),
      defaultChannel: api.FOCUS_BY_KIND?.[kind] || "",
      tiers: [...(api.TIERS || [1, 2, 3])],
    };
  }
  function current(item = {}) {
    const ench = engine()?.activeEnchantment?.(item) || null;
    return ench
      ? { enchanted: true, tier: ench.tier, channel: ench.focus.channel, label: CHANNEL_LABELS[ench.focus.channel] || ench.focus.channel }
      : { enchanted: false, tier: 0, channel: null, label: "Sin encantamiento" };
  }
  function prepare(item, request = {}, options = {}) {
    const api = engine();
    if (!api) return { prepared: false, reason: "runtime_unavailable" };
    if (request.action === "remove") {
      if (!api.activeEnchantment(item)) return { prepared: false, reason: "item_not_enchanted" };
      return { prepared: true, draft: { action: "remove" }, message: "Retirar encantamiento al guardar." };
    }
    if (request.action !== "apply") return { prepared: false, reason: "invalid_change" };
    const existing = Boolean(api.activeEnchantment(item));
    if (existing && options.replaceConfirmed !== true) return { prepared: false, reason: "already_enchanted", requiresConfirmation: true };
    const gate = api.validate(item, { level: request.level, channel: request.channel }, { replace: existing });
    if (!gate.valid) return { prepared: false, reason: gate.reason };
    return {
      prepared: true,
      draft: { action: "apply", level: gate.tier, channel: gate.channel, replace: existing },
      message: `Encantamiento +${gate.tier}: ${CHANNEL_LABELS[gate.channel] || gate.channel}. Guardar para confirmar.`,
    };
  }
  function preview(item, request = {}, options = {}) {
    const api = engine();
    if (!api) return { valid: false, reason: "runtime_unavailable", message: errorMessage("runtime_unavailable") };
    const status = current(item);
    const candidate = prepare(item, { action: "apply", ...request }, { replaceConfirmed: options.allowReplace === true });
    const prefix = status.enchanted ? `Actual: +${status.tier} · ${status.label}.` : "Actual: sin encantamiento.";
    return {
      valid: candidate.prepared,
      reason: candidate.reason || null,
      message: candidate.prepared
        ? `${prefix} Propuesto: +${candidate.draft.level} en ${CHANNEL_LABELS[candidate.draft.channel] || candidate.draft.channel}. Solo se aplica al guardar.`
        : `${prefix} ${errorMessage(candidate.reason)}`,
    };
  }
  function applyDraft(item, draft = {}) {
    const api = engine();
    if (!api) return { changed: false, reason: "runtime_unavailable" };
    const copy = clone(item);
    if (draft.action === "remove") {
      const result = api.removeEnchantment(copy);
      return result.removed ? { changed: true, item: copy } : { changed: false, reason: result.reason || "invalid_change" };
    }
    if (draft.action === "apply") {
      const result = api.applyEnchantment(copy, { level: draft.level, channel: draft.channel }, { replace: draft.replace === true });
      return result.applied ? { changed: true, item: copy } : { changed: false, reason: result.reason || "invalid_change" };
    }
    return { changed: false, reason: "invalid_change" };
  }
  const api = Object.freeze({
    CHANNEL_LABELS, KIND_LABELS, errorMessage, snapshot, available, current,
    prepare, preview, applyDraft,
  });
  global.LuminousDmEnchanterStudioModel = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
