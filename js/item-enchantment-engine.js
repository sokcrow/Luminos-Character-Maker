(function (global) {
  "use strict";

  if (global.LuminousItemEnchantmentEngine) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousItemEnchantmentEngine;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const Catalog = global.LuminousEnchantmentCatalog || safeRequire("./item-catalog-enchantments.js");
  if (!Catalog) throw new Error("LuminousEnchantmentCatalog is required before LuminousItemEnchantmentEngine.");

  const VERSION = 1;
  const TIER_BASE_SLOT_CAPACITY = Object.freeze({ 1: 0, 2: 1, 3: 1, 4: 2, 5: 3 });
  const BIND_POSITIVE_MULTIPLIER = 1.25;
  const CURSE_POSITIVE_MULTIPLIER = 1.50;
  const SUPPORTED_APPLICATION_SOURCES = Object.freeze(["direct"]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeId(value) {
    return Catalog.normalizeId(value);
  }

  function asArray(value) {
    return value == null ? [] : (Array.isArray(value) ? value : [value]);
  }

  function itemKindOf(item = {}) {
    return normalizeId(
      item.itemType ||
      item.category ||
      item.equipment?.kind ||
      item.equipmentSchema?.kind ||
      item.kind ||
      item.type
    );
  }

  function tierOf(item = {}) {
    const raw = item.itemTier ?? item.item_tier ?? item.tier ?? item.equipment?.tier ?? item.equipmentSchema?.tier;
    if (Number.isInteger(Number(raw))) {
      const numeric = Number(raw);
      return numeric >= 1 && numeric <= 5 ? numeric : null;
    }
    const roman = String(raw || "").trim().toUpperCase();
    const map = { I:1, II:2, III:3, IV:4, V:5 };
    return map[roman] || null;
  }

  function baseSlotCapacity(itemOrTier) {
    const tier = typeof itemOrTier === "number" || typeof itemOrTier === "string"
      ? tierOf({ tier:itemOrTier })
      : tierOf(itemOrTier || {});
    return tier == null ? null : TIER_BASE_SLOT_CAPACITY[tier];
  }

  function magicStateOf(item = {}) {
    const runtime = item.runtime && typeof item.runtime === "object" ? item.runtime : {};
    const state = item.magic && typeof item.magic === "object"
      ? item.magic
      : runtime.magic && typeof runtime.magic === "object"
        ? runtime.magic
        : {};
    return clone(state);
  }

  function appliedEnchantments(item = {}) {
    const magic = magicStateOf(item);
    return asArray(magic.enchantments).filter((entry) => entry && typeof entry === "object").map(clone);
  }

  function normalizeProperties(values) {
    return [...new Set(asArray(values).map(normalizeId).filter(Boolean))];
  }

  function validateAppliedProperties(values, definition = null) {
    const properties = normalizeProperties(values);
    const errors = [];
    for (const property of properties) {
      if (!Catalog.APPLIED_PROPERTIES.includes(property)) errors.push("unsupported_applied_property");
      if (definition && !definition.allowedProperties.includes(property)) errors.push("property_not_allowed_by_enchantment");
    }
    if (properties.includes("bind") && properties.includes("curse")) errors.push("bind_and_curse_are_distinct_curse_states");
    return Object.freeze({ valid: errors.length === 0, properties:Object.freeze(properties), errors:Object.freeze([...new Set(errors)]) });
  }

  function normalizeAppliedReference(raw = {}) {
    const definitionId = normalizeId(raw.definitionId || raw.enchantmentId || raw.id);
    const rank = Number(raw.rank);
    const source = normalizeId(raw.source || "direct") || "direct";
    const properties = normalizeProperties(raw.properties || (raw.bind ? ["bind"] : raw.curse ? ["curse"] : []));
    return Object.freeze({
      definitionId,
      rank,
      source,
      properties:Object.freeze(properties),
      anchorId: raw.anchorId == null ? null : String(raw.anchorId),
      dormant: raw.dormant === true,
      disabled: raw.disabled === true,
    });
  }

  function validateAppliedReference(raw = {}, options = {}) {
    const ref = normalizeAppliedReference(raw);
    const errors = [];
    const definition = Catalog.get(ref.definitionId);

    if (!definition) errors.push("unknown_enchantment");
    if (!Catalog.SUPPORTED_RANKS.includes(ref.rank)) errors.push("unsupported_rank");
    if (!Catalog.APPLIED_SOURCES.includes(ref.source)) errors.push("unsupported_application_source");
    if (!SUPPORTED_APPLICATION_SOURCES.includes(ref.source) && options.allowFutureSource !== true) {
      errors.push("application_source_runtime_not_ready");
    }

    if (definition) {
      if (!definition.rankData?.[ref.rank]) errors.push("rank_not_authored");
      const propertyValidation = validateAppliedProperties(ref.properties, definition);
      if (!propertyValidation.valid) errors.push(...propertyValidation.errors);
    }

    return Object.freeze({
      valid: errors.length === 0,
      reference:ref,
      definition:definition ? Object.freeze(definition) : null,
      errors:Object.freeze([...new Set(errors)]),
    });
  }

  function directSlotCost(ref, definition = null) {
    const normalized = normalizeAppliedReference(ref);
    if (normalized.source !== "direct") return 0;
    const def = definition || Catalog.get(normalized.definitionId);
    return Math.max(0, Number(def?.rankData?.[normalized.rank]?.slotCost) || 0);
  }

  function slotsUsed(refs = []) {
    return asArray(refs).reduce((sum, raw) => {
      const ref = normalizeAppliedReference(raw);
      return sum + directSlotCost(ref);
    }, 0);
  }

  function definitionsConflict(a, b) {
    if (!a || !b) return false;
    return a.interaction.hardConflicts.includes(b.id) || b.interaction.hardConflicts.includes(a.id);
  }

  function validateLoadout(item = {}, refs = appliedEnchantments(item), options = {}) {
    const errors = [];
    const kind = itemKindOf(item);
    const tier = tierOf(item);
    const capacity = baseSlotCapacity(item);
    const normalized = [];
    const definitions = [];
    const counts = new Map();

    if (!Catalog.ELIGIBLE_ITEM_KINDS.includes(kind)) errors.push("ineligible_equipment_kind");
    if (tier == null) errors.push("missing_or_invalid_item_tier");

    for (const raw of asArray(refs)) {
      const check = validateAppliedReference(raw, options);
      if (!check.valid) {
        errors.push(...check.errors);
        continue;
      }

      const ref = check.reference;
      const def = check.definition;
      if (!def.eligibleItemKinds.includes(kind) || def.ineligibleItemKinds.includes(kind)) {
        errors.push("enchantment_item_kind_incompatible");
      }

      const nextCount = (counts.get(def.id) || 0) + 1;
      counts.set(def.id, nextCount);
      if (nextCount > def.maxCopiesPerItem || (def.stacking === "non_stackable" && nextCount > 1)) {
        errors.push("duplicate_non_stackable_enchantment");
      }

      for (const other of definitions) {
        if (definitionsConflict(def, other)) errors.push("hard_conflict");
      }

      normalized.push(ref);
      definitions.push(def);
    }

    const used = slotsUsed(normalized);
    if (capacity != null && used > capacity) errors.push("base_enchantment_slots_exceeded");

    return Object.freeze({
      valid: errors.length === 0,
      errors:Object.freeze([...new Set(errors)]),
      itemKind:kind,
      itemTier:tier,
      slots:Object.freeze({ used, max:capacity }),
      enchantments:Object.freeze(normalized.map(clone)),
    });
  }

  function existingIndex(refs, definitionId) {
    const wanted = normalizeId(definitionId);
    return refs.findIndex((entry) => normalizeAppliedReference(entry).definitionId === wanted);
  }

  function validateApplication(item = {}, definitionOrId, rank = 1, options = {}) {
    const definition = typeof definitionOrId === "string" ? Catalog.get(definitionOrId) : clone(definitionOrId);
    if (!definition) return Object.freeze({ allowed:false, reason:"unknown_enchantment" });

    const definitionValidation = Catalog.validateDefinition(definition);
    if (!definitionValidation.valid) {
      return Object.freeze({ allowed:false, reason:"invalid_enchantment_definition", errors:definitionValidation.errors });
    }

    const source = normalizeId(options.source || "direct") || "direct";
    if (!SUPPORTED_APPLICATION_SOURCES.includes(source)) {
      return Object.freeze({ allowed:false, reason:"application_source_runtime_not_ready", source });
    }

    const propertyValidation = validateAppliedProperties(options.properties, definition);
    if (!propertyValidation.valid) {
      return Object.freeze({ allowed:false, reason:"invalid_enchantment_properties", errors:propertyValidation.errors });
    }

    const refs = appliedEnchantments(item);
    if (existingIndex(refs, definition.id) >= 0 && definition.stacking === "non_stackable") {
      return Object.freeze({ allowed:false, reason:"enchantment_already_installed", definitionId:definition.id });
    }

    const candidate = normalizeAppliedReference({
      definitionId:definition.id,
      rank,
      source,
      properties:propertyValidation.properties,
    });
    const refValidation = validateAppliedReference(candidate);
    if (!refValidation.valid) {
      return Object.freeze({ allowed:false, reason:"invalid_applied_enchantment", errors:refValidation.errors });
    }

    const validation = validateLoadout(item, [...refs, candidate]);
    if (!validation.valid) {
      return Object.freeze({ allowed:false, reason:validation.errors[0] || "invalid_enchantment_loadout", validation });
    }

    return Object.freeze({
      allowed:true,
      definition:Object.freeze(definition),
      reference:candidate,
      validation,
    });
  }

  function withMagicState(item, refs) {
    const out = clone(item || {});
    const current = magicStateOf(out);
    const capacity = baseSlotCapacity(out);
    const used = slotsUsed(refs);
    out.magic = {
      ...current,
      enabled:true,
      enchantments:refs.map((entry) => clone(normalizeAppliedReference(entry))),
      enchantmentSlots:{ max:capacity, used },
    };
    return out;
  }

  function applyEnchantment(item = {}, definitionOrId, rank = 1, options = {}) {
    const gate = validateApplication(item, definitionOrId, rank, options);
    if (!gate.allowed) return Object.freeze({ applied:false, ...clone(gate), item:clone(item) });
    const refs = appliedEnchantments(item);
    refs.push(gate.reference);
    const out = withMagicState(item, refs);
    return Object.freeze({
      applied:true,
      item:Object.freeze(out),
      definition:gate.definition,
      reference:gate.reference,
      slots:gate.validation.slots,
    });
  }

  function validateStrengthening(item = {}, definitionId, targetRank, options = {}) {
    const refs = appliedEnchantments(item);
    const index = existingIndex(refs, definitionId);
    if (index < 0) return Object.freeze({ allowed:false, reason:"enchantment_not_installed" });

    const current = normalizeAppliedReference(refs[index]);
    const nextRank = Number(targetRank);
    if (nextRank !== current.rank + 1) {
      return Object.freeze({ allowed:false, reason:"strengthening_must_advance_one_rank", currentRank:current.rank, targetRank:nextRank });
    }

    const definition = Catalog.get(current.definitionId);
    if (!definition?.rankData?.[nextRank]) {
      return Object.freeze({ allowed:false, reason:"target_rank_not_authored", currentRank:current.rank, targetRank:nextRank });
    }

    const next = normalizeAppliedReference({ ...current, rank:nextRank });
    const candidateRefs = refs.slice();
    candidateRefs[index] = next;
    const validation = validateLoadout(item, candidateRefs, options);
    if (!validation.valid) {
      return Object.freeze({ allowed:false, reason:validation.errors[0] || "invalid_enchantment_loadout", validation });
    }

    return Object.freeze({ allowed:true, index, current, next, definition:Object.freeze(definition), validation });
  }

  function strengthenEnchantment(item = {}, definitionId, targetRank, options = {}) {
    const gate = validateStrengthening(item, definitionId, targetRank, options);
    if (!gate.allowed) return Object.freeze({ strengthened:false, ...clone(gate), item:clone(item) });

    const refs = appliedEnchantments(item);
    refs[gate.index] = gate.next;
    const out = withMagicState(item, refs);
    return Object.freeze({
      strengthened:true,
      item:Object.freeze(out),
      previous:gate.current,
      reference:gate.next,
      slots:gate.validation.slots,
    });
  }

  function canRemoveEnchantment(item = {}, definitionId) {
    const refs = appliedEnchantments(item);
    const index = existingIndex(refs, definitionId);
    if (index < 0) return Object.freeze({ allowed:false, reason:"enchantment_not_installed" });
    const ref = normalizeAppliedReference(refs[index]);
    const definition = Catalog.get(ref.definitionId);
    if (!definition) return Object.freeze({ allowed:false, reason:"unknown_enchantment" });
    if (!definition.removable) return Object.freeze({ allowed:false, reason:"enchantment_not_removable" });
    if (ref.properties.includes("bind")) return Object.freeze({ allowed:false, reason:"bound_enchantment_not_removable" });
    return Object.freeze({ allowed:true, index, reference:ref, definition:Object.freeze(definition) });
  }

  function removeEnchantment(item = {}, definitionId) {
    const gate = canRemoveEnchantment(item, definitionId);
    if (!gate.allowed) return Object.freeze({ removed:false, ...clone(gate), item:clone(item) });
    const refs = appliedEnchantments(item);
    refs.splice(gate.index, 1);
    const out = withMagicState(item, refs);
    if (!refs.length) out.magic.enabled = false;
    return Object.freeze({ removed:true, item:Object.freeze(out), removedReference:gate.reference });
  }

  function positiveEffectMultiplier(ref) {
    const properties = normalizeProperties(ref?.properties);
    if (properties.includes("bind")) return BIND_POSITIVE_MULTIPLIER;
    if (properties.includes("curse")) return CURSE_POSITIVE_MULTIPLIER;
    return 1;
  }

  function scaledEffect(effect = {}, ref = {}) {
    const out = clone(effect);
    if (normalizeId(effect.polarity || "positive") !== "positive") return out;
    if (!Number.isFinite(Number(effect.value))) return out;
    const multiplier = positiveEffectMultiplier(ref);
    out.baseValue = Number(effect.value);
    out.value = Number(effect.value) * multiplier;
    out.propertyMultiplier = multiplier;
    return out;
  }

  function resolvedEnchantments(item = {}, options = {}) {
    const includeDormant = options.includeDormant === true;
    const results = [];
    for (const raw of appliedEnchantments(item)) {
      const ref = normalizeAppliedReference(raw);
      if (!includeDormant && (ref.dormant || ref.disabled)) continue;
      const definition = Catalog.get(ref.definitionId);
      const rank = Catalog.resolveRank(definition, ref.rank);
      if (!definition || !rank) continue;
      results.push(Object.freeze({
        reference:ref,
        definition:Object.freeze(definition),
        rank:Object.freeze(rank),
        effects:Object.freeze(rank.effects.map((effect) => Object.freeze(scaledEffect(effect, ref)))),
      }));
    }
    return Object.freeze(results);
  }

  function actionChannels(item = {}) {
    const groups = new Map();
    for (const entry of resolvedEnchantments(item)) {
      const channel = normalizeId(entry.definition.interaction?.exclusiveChannel);
      if (!channel || entry.definition.interaction?.exclusivePerAction !== true) continue;
      if (!groups.has(channel)) groups.set(channel, []);
      groups.get(channel).push(entry.definition.id);
    }
    return Object.freeze(
      [...groups.entries()].map(([channel, definitionIds]) => Object.freeze({
        channel,
        definitionIds:Object.freeze(definitionIds.slice()),
        requiresChoice:definitionIds.length > 1,
      }))
    );
  }

  function resolveEffectsForAction(item = {}, context = {}) {
    const selected = context.selectedChannels && typeof context.selectedChannels === "object"
      ? context.selectedChannels
      : {};
    const effects = [];
    const unresolvedChannels = [];

    for (const entry of resolvedEnchantments(item)) {
      const interaction = entry.definition.interaction || {};
      const channel = normalizeId(interaction.exclusiveChannel);
      if (channel && interaction.exclusivePerAction === true) {
        const choices = actionChannels(item).find((row) => row.channel === channel);
        const selectedId = normalizeId(selected[channel]);
        if (choices?.requiresChoice && !selectedId) {
          if (!unresolvedChannels.includes(channel)) unresolvedChannels.push(channel);
          continue;
        }
        if (selectedId && selectedId !== entry.definition.id) continue;
      }

      for (const effect of entry.effects) {
        effects.push(Object.freeze({
          ...clone(effect),
          sourceEnchantmentId:entry.definition.id,
          sourceRank:entry.reference.rank,
          sourceProperties:Object.freeze(entry.reference.properties.slice()),
        }));
      }
    }

    return Object.freeze({
      resolved:unresolvedChannels.length === 0,
      unresolvedChannels:Object.freeze(unresolvedChannels),
      effects:Object.freeze(effects),
    });
  }

  const API = Object.freeze({
    VERSION,
    TIER_BASE_SLOT_CAPACITY,
    BIND_POSITIVE_MULTIPLIER,
    CURSE_POSITIVE_MULTIPLIER,
    SUPPORTED_APPLICATION_SOURCES,
    normalizeId,
    itemKindOf,
    tierOf,
    baseSlotCapacity,
    magicStateOf,
    appliedEnchantments,
    normalizeAppliedReference,
    validateAppliedProperties,
    validateAppliedReference,
    directSlotCost,
    slotsUsed,
    definitionsConflict,
    validateLoadout,
    validateApplication,
    applyEnchantment,
    validateStrengthening,
    strengthenEnchantment,
    canRemoveEnchantment,
    removeEnchantment,
    positiveEffectMultiplier,
    resolvedEnchantments,
    actionChannels,
    resolveEffectsForAction,
  });

  global.LuminousItemEnchantmentEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
