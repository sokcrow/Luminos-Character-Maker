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
  const Gems = global.LuminousOreIngotGemCatalog || safeRequire("./item-catalog-ore-ingot-gem.js");
  if (!Catalog) throw new Error("LuminousEnchantmentCatalog is required before LuminousItemEnchantmentEngine.");
  if (!Gems) throw new Error("LuminousOreIngotGemCatalog is required before LuminousItemEnchantmentEngine.");

  const VERSION = 7;
  const TIER_BASE_SLOT_CAPACITY = Object.freeze({ 1: 0, 2: 1, 3: 1, 4: 2, 5: 3 });
  const BIND_POSITIVE_MULTIPLIER = 1.25;
  const CURSE_POSITIVE_MULTIPLIER = 1.50;
  const SUPPORTED_APPLICATION_SOURCES = Object.freeze(["direct", "gem"]);
  const GEM_SOCKET_HARD_MAX = 3;
  const GEM_ANCHOR_STATES = Object.freeze(["stable", "unstable", "depleted", "broken"]);
  const GEM_COMPATIBILITY_BASE_TH_ADJUSTMENT = -2;
  const GEM_QUALITY_TH_ADJUSTMENT = Object.freeze({ ruined:0, poor:0, standard:0, fine:-1, exceptional:-2 });
  const GEM_SPECIALIZATION_TH_ADJUSTMENT = -1;
  const GEM_ITEM_STABILIZATION_MAX_REDUCTION = 4;
  const OVERCHANNEL_TH_PER_RANK = 2;
  const EXTERNAL_TH_SOURCE_TYPES = Object.freeze([
    "enchantment_table", "arcane_workshop", "specialist_tools", "facility", "assistant", "improvised"
  ]);
  const INTENTIONAL_BIND_TH_ADJUSTMENT = 4;
  const INTENTIONAL_CURSE_TH_ADJUSTMENT = 6;
  const DIRECT_MAGIC_DURABILITY_RATIO = 0.50;
  const GEM_MAGIC_DURABILITY_RATIO = 0.75;
  const CURSE_REAGENT_TAGS = Object.freeze([
    "profane", "corrupted", "blood", "ichor", "necrotic", "necrotic_reagent",
    "decay_reagent", "vitality_drain", "sanity_corruption", "mental_corruption",
    "atrophy", "paralysis", "death_reagent", "abnormal_process_input"
  ]);

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


  function physicalDurabilityMaxOf(item = {}) {
    const candidates = [
      item.conditionMax,
      item.maxCondition,
      item.maxDurability,
      item.physicalDurabilityMax,
      item.physical_durability_max,
      item.durabilityProfile?.max,
      item.durability?.max,
      item.runtimeState?.conditionMax,
      item.runtime?.conditionMax,
    ];
    const explicit = candidates.find((value) => Number.isFinite(Number(value)));
    if (explicit != null) return Math.max(0, Number(explicit));

    const currentOnly = [
      item.condition,
      item.currentCondition,
      item.currentDurability,
      typeof item.durability === "number" ? item.durability : null,
    ].find((value) => Number.isFinite(Number(value)));
    return currentOnly == null ? 0 : Math.max(0, Number(currentOnly));
  }

  function inferredMagicalDurabilityMax(item = {}, refs = [], options = {}) {
    if (Number.isFinite(Number(options.max))) return Math.max(0, Number(options.max));
    const physicalMax = physicalDurabilityMaxOf(item);
    if (physicalMax <= 0) return 0;
    const hasGem = asArray(refs).map(normalizeAppliedReference).some((ref) => ref.source === "gem");
    const ratio = hasGem ? GEM_MAGIC_DURABILITY_RATIO : DIRECT_MAGIC_DURABILITY_RATIO;
    return Math.max(1, Math.round(physicalMax * ratio));
  }

  function normalizeMagicalDurability(item = {}, raw = {}, refs = [], options = {}) {
    const source = raw && typeof raw === "object" ? raw : {};
    const explicitMax = source.max != null || source.maximum != null;
    const autoManaged = source.autoManaged === true || (!explicitMax && source.authored !== true);
    const desiredMax = autoManaged
      ? inferredMagicalDurabilityMax(item, refs, options)
      : Math.max(0, Number(source.max ?? source.maximum ?? options.max ?? 0) || 0);
    const previousMax = Math.max(0, Number(source.max ?? source.maximum ?? desiredMax) || desiredMax);
    let current = source.current == null ? desiredMax : Math.max(0, Number(source.current) || 0);
    if (autoManaged && desiredMax > previousMax) current += desiredMax - previousMax;
    current = Math.min(desiredMax, current);
    return Object.freeze({
      max:desiredMax,
      current,
      depleted:desiredMax <= 0 || current <= 0,
      autoManaged,
      profile:autoManaged
        ? (asArray(refs).map(normalizeAppliedReference).some((ref) => ref.source === "gem") ? "gem_anchored" : "direct")
        : normalizeId(source.profile || "authored") || "authored",
      physicalDurabilityMax:physicalDurabilityMaxOf(item),
      physicalRatio:autoManaged
        ? (asArray(refs).map(normalizeAppliedReference).some((ref) => ref.source === "gem") ? GEM_MAGIC_DURABILITY_RATIO : DIRECT_MAGIC_DURABILITY_RATIO)
        : null,
    });
  }

  function gemSocketCapacity(item = {}) {
    const magic = magicStateOf(item);
    const explicit = magic.gemSockets?.max ?? item.enchantmentGemSocketCapacity ?? item.gemSocketCapacity;
    if (Number.isFinite(Number(explicit))) return Math.max(0, Math.min(GEM_SOCKET_HARD_MAX, Math.trunc(Number(explicit))));
    return Catalog.ELIGIBLE_ITEM_KINDS.includes(itemKindOf(item)) ? GEM_SOCKET_HARD_MAX : 0;
  }

  function gemAnchors(item = {}) {
    const magic = magicStateOf(item);
    return asArray(magic.gemAnchors).filter((entry) => entry && typeof entry === "object").map(clone);
  }

  function gemDefinitionIdOf(gem = {}) {
    return normalizeId(gem.definitionId || gem.itemId || gem.id || gem.canonicalId);
  }

  function gemInstanceIdOf(gem = {}) {
    const value = gem.instanceId || gem.instance_id || gem.sourceInstanceId || null;
    return value == null ? null : String(value);
  }

  function gemQualityOf(gem = {}) {
    return normalizeId(gem.quality || gem.baseQuality || "standard") || "standard";
  }

  function normalizeGemAnchor(raw = {}) {
    const state = normalizeId(raw.state || "stable") || "stable";
    return Object.freeze({
      anchorId:String(raw.anchorId || raw.id || ""),
      socketIndex:Math.max(0, Math.trunc(Number(raw.socketIndex) || 0)),
      gemDefinitionId:normalizeId(raw.gemDefinitionId || raw.gemId || raw.definitionId),
      gemInstanceId:raw.gemInstanceId == null ? null : String(raw.gemInstanceId),
      gemQuality:normalizeId(raw.gemQuality || raw.quality || "standard") || "standard",
      state:GEM_ANCHOR_STATES.includes(state) ? state : "stable",
      enchantmentDefinitionId:normalizeId(raw.enchantmentDefinitionId || raw.enchantmentId),
      rank:Math.max(0, Math.trunc(Number(raw.rank) || 0)),
      overchannel:raw.overchannel === true,
    });
  }

  function nextGemSocketIndex(item = {}) {
    const used = new Set(gemAnchors(item).map((anchor) => normalizeGemAnchor(anchor).socketIndex));
    for (let index = 0; index < gemSocketCapacity(item); index += 1) {
      if (!used.has(index)) return index;
    }
    return -1;
  }

  function anchorStateSupportsMagic(state) {
    return !["broken", "depleted"].includes(normalizeId(state));
  }

  function gemAnchoredRefs(refs = []) {
    return asArray(refs).map(normalizeAppliedReference).filter((ref) => ref.source === "gem");
  }

  function validateGemSocketLoadout(item = {}, refs = appliedEnchantments(item), anchors = gemAnchors(item)) {
    const errors = [];
    const normalizedAnchors = asArray(anchors).map(normalizeGemAnchor);
    const normalizedRefs = gemAnchoredRefs(refs);
    const capacity = gemSocketCapacity(item);

    if (normalizedAnchors.length > capacity || normalizedRefs.length > capacity) errors.push("gem_socket_capacity_exceeded");

    const anchorIds = new Set();
    const socketIndexes = new Set();
    for (const anchor of normalizedAnchors) {
      if (!anchor.anchorId) errors.push("gem_anchor_missing_id");
      if (anchorIds.has(anchor.anchorId)) errors.push("duplicate_gem_anchor_id");
      anchorIds.add(anchor.anchorId);
      if (socketIndexes.has(anchor.socketIndex)) errors.push("duplicate_gem_socket_index");
      socketIndexes.add(anchor.socketIndex);
      if (anchor.socketIndex >= capacity) errors.push("gem_socket_index_out_of_range");
      if (!GEM_ANCHOR_STATES.includes(anchor.state)) errors.push("invalid_gem_anchor_state");
    }

    const refAnchorIds = new Set();
    for (const ref of normalizedRefs) {
      if (!ref.anchorId) errors.push("gem_enchantment_missing_anchor");
      if (refAnchorIds.has(ref.anchorId)) errors.push("multiple_enchantments_same_gem_anchor");
      refAnchorIds.add(ref.anchorId);
    }

    for (const anchor of normalizedAnchors) {
      const linked = normalizedRefs.filter((ref) => ref.anchorId === anchor.anchorId);
      if (linked.length !== 1) errors.push(linked.length ? "multiple_enchantments_same_gem_anchor" : "gem_anchor_missing_enchantment");
      if (linked[0] && (linked[0].definitionId !== anchor.enchantmentDefinitionId || linked[0].rank !== anchor.rank)) {
        errors.push("gem_anchor_enchantment_link_mismatch");
      }
    }

    for (const ref of normalizedRefs) {
      if (!anchorIds.has(ref.anchorId)) errors.push("gem_enchantment_anchor_not_found");
    }

    const rankThreeRefs = normalizedRefs.filter((ref) => ref.rank === 3);
    if (rankThreeRefs.length > 1) errors.push("multiple_rank_three_gem_enchantments");
    if (rankThreeRefs.length === 1 && normalizedRefs.length > 1) errors.push("rank_three_gem_anchor_exclusive");

    return Object.freeze({
      valid:errors.length === 0,
      errors:Object.freeze([...new Set(errors)]),
      sockets:Object.freeze({used:normalizedAnchors.length,max:capacity}),
      anchors:Object.freeze(normalizedAnchors.map(clone)),
    });
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
    if (!SUPPORTED_APPLICATION_SOURCES.includes(ref.source)) errors.push("application_source_runtime_not_ready");
    if (ref.source === "gem" && !ref.anchorId) errors.push("gem_enchantment_requires_anchor_id");

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

    const gemValidation = validateGemSocketLoadout(item, normalized, options.gemAnchors ?? gemAnchors(item));
    if (!gemValidation.valid) errors.push(...gemValidation.errors);

    return Object.freeze({
      valid: errors.length === 0,
      errors:Object.freeze([...new Set(errors)]),
      itemKind:kind,
      itemTier:tier,
      slots:Object.freeze({ used, max:capacity }),
      gemSockets:gemValidation.sockets,
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

  function withMagicState(item, refs, anchors = gemAnchors(item), options = {}) {
    const out = clone(item || {});
    const current = magicStateOf(out);
    const capacity = baseSlotCapacity(out);
    const used = slotsUsed(refs);
    const normalizedAnchors = asArray(anchors).map(normalizeGemAnchor);
    const normalizedRefs = refs.map((entry) => clone(normalizeAppliedReference(entry)));
    const magicalDurability = refs.length
      ? normalizeMagicalDurability(out, current.magicalDurability || current.magical_durability || {}, normalizedRefs, options.magicalDurability || {})
      : clone(current.magicalDurability || current.magical_durability || null);
    out.magic = {
      ...current,
      enabled:refs.length > 0,
      enchantments:normalizedRefs,
      enchantmentSlots:{ max:capacity, used },
      gemSockets:{ max:gemSocketCapacity(out), used:normalizedAnchors.length },
      gemAnchors:normalizedAnchors.map(clone),
      ...(magicalDurability ? { magicalDurability:clone(magicalDurability) } : {}),
    };
    return out;
  }

  function applyEnchantment(item = {}, definitionOrId, rank = 1, options = {}) {
    const gate = validateApplication(item, definitionOrId, rank, options);
    if (!gate.allowed) return Object.freeze({ applied:false, ...clone(gate), item:clone(item) });
    const refs = appliedEnchantments(item);
    refs.push(gate.reference);
    const out = withMagicState(item, refs, gate.candidateAnchors || gemAnchors(item), options);
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
    const candidateAnchors = gemAnchors(item).map((anchor) => {
      const normalized = normalizeGemAnchor(anchor);
      if (normalized.anchorId !== current.anchorId) return normalized;
      return normalizeGemAnchor({...normalized, rank:nextRank});
    });
    const gemChannel = current.source === "gem"
      ? Gems.validateGemChannelRank(candidateAnchors.find((anchor) => anchor.anchorId === current.anchorId)?.gemDefinitionId, nextRank, candidateAnchors.find((anchor) => anchor.anchorId === current.anchorId)?.gemQuality)
      : null;
    if (current.source === "gem" && !gemChannel?.valid) {
      return Object.freeze({ allowed:false, reason:gemChannel?.reason || "gem_rank_invalid", currentRank:current.rank, targetRank:nextRank });
    }
    if (current.source === "gem") {
      const anchorIndex = candidateAnchors.findIndex((anchor) => anchor.anchorId === current.anchorId);
      candidateAnchors[anchorIndex] = normalizeGemAnchor({
        ...candidateAnchors[anchorIndex],
        state:gemChannel.unstable ? "unstable" : candidateAnchors[anchorIndex].state,
        overchannel:gemChannel.overchannel,
      });
    }
    const validation = validateLoadout(item, candidateRefs, { ...options, gemAnchors:candidateAnchors });
    if (!validation.valid) {
      return Object.freeze({ allowed:false, reason:validation.errors[0] || "invalid_enchantment_loadout", validation });
    }

    return Object.freeze({ allowed:true, index, current, next, definition:Object.freeze(definition), validation, candidateAnchors:Object.freeze(candidateAnchors.map(clone)) });
  }

  function strengthenEnchantment(item = {}, definitionId, targetRank, options = {}) {
    const gate = validateStrengthening(item, definitionId, targetRank, options);
    if (!gate.allowed) return Object.freeze({ strengthened:false, ...clone(gate), item:clone(item) });

    const refs = appliedEnchantments(item);
    refs[gate.index] = gate.next;
    const out = withMagicState(item, refs, gate.candidateAnchors || gemAnchors(item), options);
    return Object.freeze({
      strengthened:true,
      item:Object.freeze(out),
      previous:gate.current,
      reference:gate.next,
      slots:gate.validation.slots,
    });
  }

  function canRemoveEnchantment(item = {}, definitionId) {
    const anchored = canRemoveGemAnchoredEnchantment(item, definitionId);
    if (anchored) return Object.freeze({ allowed:false, ...anchored });
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



  function intersects(left = [], right = []) {
    const rightSet = new Set(asArray(right).map(normalizeId).filter(Boolean));
    return asArray(left).map(normalizeId).filter(Boolean).some((value) => rightSet.has(value));
  }

  function gemCompatibility(definitionOrId, gem = {}) {
    const definition = typeof definitionOrId === "string" ? Catalog.get(definitionOrId) : clone(definitionOrId);
    if (!definition) return Object.freeze({ compatible:false, level:"incompatible", reason:"unknown_enchantment" });
    const profile = Gems.gemMagicProfile(gemDefinitionIdOf(gem) || gem);
    if (!profile) return Object.freeze({ compatible:false, level:"incompatible", reason:"not_a_gemstone" });

    const compatibility = definition.compatibility || {};
    const resonances = profile.resonances || [];
    const affinities = profile.enchantmentAffinities || [];

    if (
      intersects(resonances, compatibility.incompatibleResonances) ||
      intersects(affinities, compatibility.incompatibleAffinities)
    ) {
      return Object.freeze({
        compatible:false,
        level:"incompatible",
        reason:"explicitly_incompatible",
        matched:Object.freeze([]),
      });
    }

    const primaryMatches = resonances.filter((value) => asArray(compatibility.primaryResonances).map(normalizeId).includes(normalizeId(value)));
    if (primaryMatches.length) {
      return Object.freeze({
        compatible:true,
        level:"primary",
        reason:null,
        matched:Object.freeze(primaryMatches.map(normalizeId)),
      });
    }

    const acceptedResonanceMatches = resonances.filter((value) => asArray(compatibility.acceptedResonances).map(normalizeId).includes(normalizeId(value)));
    const acceptedAffinityMatches = affinities.filter((value) => asArray(compatibility.acceptedAffinities).map(normalizeId).includes(normalizeId(value)));
    const acceptedMatches = [...new Set([...acceptedResonanceMatches, ...acceptedAffinityMatches].map(normalizeId))];
    if (acceptedMatches.length) {
      return Object.freeze({
        compatible:true,
        level:"accepted",
        reason:null,
        matched:Object.freeze(acceptedMatches),
      });
    }

    return Object.freeze({
      compatible:false,
      level:"incompatible",
      reason:"no_compatible_resonance_or_affinity",
      matched:Object.freeze([]),
    });
  }

  function gemResonanceFamily(gem = {}) {
    const profile = Gems.gemMagicProfile(gemDefinitionIdOf(gem) || gem);
    return normalizeId(profile?.resonances?.[0] || "");
  }

  function resonanceArchitecture(item = {}, candidateGem = null) {
    const families = [];
    for (const anchor of gemAnchors(item)) {
      const family = gemResonanceFamily(anchor.gemDefinitionId);
      if (family) families.push(family);
    }
    if (candidateGem) {
      const candidateFamily = gemResonanceFamily(candidateGem);
      if (candidateFamily) families.push(candidateFamily);
    }
    const unique = [...new Set(families)];
    return Object.freeze({
      families:Object.freeze(families),
      uniqueFamilies:Object.freeze(unique),
      mode:unique.length <= 1 ? (families.length ? "specialized" : "none") : "hybrid",
      specialized:families.length > 0 && unique.length === 1,
      hybrid:unique.length > 1,
    });
  }

  function externalThresholdAdjustment(options = {}) {
    let adjustment = Number(options.externalThresholdAdjustment || 0);
    if (!Number.isFinite(adjustment)) adjustment = 0;
    const applied = [];
    for (const entry of asArray(options.externalModifiers)) {
      if (!entry || typeof entry !== "object") continue;
      const sourceType = normalizeId(entry.sourceType || entry.type);
      if (!EXTERNAL_TH_SOURCE_TYPES.includes(sourceType)) continue;
      const value = Number(entry.adjustment || 0);
      if (!Number.isFinite(value) || value === 0) continue;
      adjustment += value;
      applied.push(Object.freeze({sourceType,adjustment:value}));
    }
    return Object.freeze({adjustment,applied:Object.freeze(applied)});
  }

  function gemThresholdPreview(item = {}, definitionOrId, gem = {}, rank = 1, options = {}) {
    const definition = typeof definitionOrId === "string" ? Catalog.get(definitionOrId) : clone(definitionOrId);
    if (!definition) return Object.freeze({ valid:false, reason:"unknown_enchantment" });
    const rankData = Catalog.resolveRank(definition, rank);
    if (!rankData) return Object.freeze({ valid:false, reason:"unsupported_rank" });

    const compatibility = gemCompatibility(definition, gem);
    if (!compatibility.compatible) {
      return Object.freeze({ valid:false, reason:"incompatible_gem", compatibility });
    }

    const quality = gemQualityOf(gem);
    const channel = Gems.validateGemChannelRank(gemDefinitionIdOf(gem), rank, quality);
    if (!channel.valid) return Object.freeze({ valid:false, reason:channel.reason || "gem_rank_invalid", compatibility, channel });

    const architectureBefore = resonanceArchitecture(item);
    const candidateFamily = gemResonanceFamily(gem);
    const sameFamilyExisting = architectureBefore.families.filter((family) => family === candidateFamily).length;
    const wouldBeHybrid = architectureBefore.families.some((family) => family !== candidateFamily);
    const specializationApplied = sameFamilyExisting > 0 && !wouldBeHybrid;

    const qualityAdjustment = GEM_QUALITY_TH_ADJUSTMENT[quality] ?? 0;
    const specializationAdjustment = specializationApplied ? GEM_SPECIALIZATION_TH_ADJUSTMENT : 0;
    const rawItemGemAdjustment = GEM_COMPATIBILITY_BASE_TH_ADJUSTMENT + qualityAdjustment + specializationAdjustment;
    const itemGemAdjustment = Math.max(-GEM_ITEM_STABILIZATION_MAX_REDUCTION, rawItemGemAdjustment);
    const external = externalThresholdAdjustment(options);
    const baseThreshold = Number(rankData.threshold);
    const overchannelSteps = Math.max(0, Number(rank) - Number(channel.stableRank || 0));
    const overchannelAdjustment = overchannelSteps * OVERCHANNEL_TH_PER_RANK;
    const finalThreshold = baseThreshold + itemGemAdjustment + overchannelAdjustment + external.adjustment;

    return Object.freeze({
      valid:true,
      rank:Number(rank),
      baseThreshold,
      compatibility,
      quality,
      qualityAdjustment,
      specializationApplied,
      specializationAdjustment,
      architectureBefore,
      architectureAfter:resonanceArchitecture(item, gem),
      itemGemAdjustment,
      itemGemReductionCap:GEM_ITEM_STABILIZATION_MAX_REDUCTION,
      externalAdjustment:external.adjustment,
      externalModifiers:external.applied,
      overchannel:channel.overchannel,
      overchannelSteps,
      overchannelAdjustment,
      unstable:channel.unstable,
      finalThreshold,
    });
  }


  function propertyThresholdAdjustment(properties = []) {
    const normalized = normalizeProperties(properties);
    let adjustment = 0;
    if (normalized.includes("bind")) adjustment += INTENTIONAL_BIND_TH_ADJUSTMENT;
    if (normalized.includes("curse")) adjustment += INTENTIONAL_CURSE_TH_ADJUSTMENT;
    return Object.freeze({properties:Object.freeze(normalized),adjustment});
  }

  function ritualThresholdPreview(item = {}, definitionOrId, rank = 1, options = {}) {
    const definition = typeof definitionOrId === "string" ? Catalog.get(definitionOrId) : clone(definitionOrId);
    if (!definition) return Object.freeze({valid:false,reason:"unknown_enchantment"});
    const rankData = Catalog.resolveRank(definition, rank);
    if (!rankData) return Object.freeze({valid:false,reason:"unsupported_rank"});

    let base;
    if (options.gem) {
      base = gemThresholdPreview(item, definition, options.gem, rank, options);
      if (!base.valid) return base;
    } else {
      const external = externalThresholdAdjustment(options);
      base = Object.freeze({
        valid:true,
        rank:Number(rank),
        baseThreshold:Number(rankData.threshold),
        itemGemAdjustment:0,
        externalAdjustment:external.adjustment,
        externalModifiers:external.applied,
        finalThreshold:Number(rankData.threshold) + external.adjustment,
      });
    }

    const property = propertyThresholdAdjustment(options.properties);
    return Object.freeze({
      ...clone(base),
      propertyAdjustment:property.adjustment,
      properties:property.properties,
      finalThreshold:Number(base.finalThreshold) + property.adjustment,
    });
  }

  function materialIdOf(material = {}) {
    return normalizeId(material.definitionId || material.itemId || material.id || material.canonicalId || material.key);
  }

  function materialTagsOf(material = {}) {
    return Object.freeze([...new Set([
      ...asArray(material.tags),
      ...asArray(material.useTags),
      ...asArray(material.reagentTags),
      ...asArray(material.craftTags),
      ...asArray(material.requirementTags),
    ].map(normalizeId).filter(Boolean))]);
  }

  function materialQuantityField(material = {}) {
    for (const field of ["quantity","cantidad","materialUnits","bloodUnits","essenceUnits","remainingUnits"]) {
      if (material[field] != null && Number.isFinite(Number(material[field]))) return field;
    }
    return "quantity";
  }

  function materialQuantityOf(material = {}) {
    const field = materialQuantityField(material);
    const value = Number(material[field]);
    return Number.isFinite(value) ? Math.max(0, value) : 1;
  }

  function normalizeRecipeRequirement(raw = {}, index = 0) {
    const source = typeof raw === "string" ? {exactItemId:raw} : (raw || {});
    return Object.freeze({
      id:normalizeId(source.id || `requirement_${index + 1}`),
      quantity:Math.max(1, Number(source.quantity || source.amount || 1)),
      exactItemId:normalizeId(source.exactItemId || source.itemId || ""),
      anyItemIds:Object.freeze(asArray(source.anyItemIds || source.itemIds).map(normalizeId).filter(Boolean)),
      anyTags:Object.freeze(asArray(source.anyTags || source.tagsAny || source.tag).map(normalizeId).filter(Boolean)),
      allTags:Object.freeze(asArray(source.allTags || source.tagsAll).map(normalizeId).filter(Boolean)),
    });
  }

  function requirementMatchesMaterial(requirement, material = {}) {
    const id = materialIdOf(material);
    const tags = new Set(materialTagsOf(material));
    if (requirement.exactItemId && id !== requirement.exactItemId) return false;
    if (requirement.anyItemIds.length && !requirement.anyItemIds.includes(id)) return false;
    if (requirement.anyTags.length && !requirement.anyTags.some((tag) => tags.has(tag))) return false;
    if (requirement.allTags.length && !requirement.allTags.every((tag) => tags.has(tag))) return false;
    return Boolean(requirement.exactItemId || requirement.anyItemIds.length || requirement.anyTags.length || requirement.allTags.length);
  }

  function recipeMaterialRequirements(definitionOrId, options = {}) {
    const definition = typeof definitionOrId === "string" ? Catalog.get(definitionOrId) : clone(definitionOrId);
    if (!definition) return Object.freeze([]);
    const recipe = definition.recipe || {};
    const raw = [...asArray(recipe.consumedRequirements)];
    for (const exact of asArray(recipe.exactItemRequirements)) {
      raw.push(typeof exact === "string" ? {exactItemId:exact,quantity:1} : exact);
    }
    const properties = normalizeProperties(options.properties);
    if (properties.includes("curse") && options.accidental !== true) {
      raw.push({
        id:"intentional_curse_reagent",
        anyTags:CURSE_REAGENT_TAGS,
        quantity:1,
      });
    }
    return Object.freeze(raw.map((entry,index)=>normalizeRecipeRequirement(entry,index)));
  }

  function protectedMaterialInstanceIds(options = {}) {
    const ids = [
      ...asArray(options.protectedInstanceIds),
      options.anchorGemInstanceId,
      options.gem?.instanceId,
      options.gem?.instance_id,
    ].filter((value)=>value != null).map(String);
    return new Set(ids);
  }

  function planRecipeMaterials(definitionOrId, materials = [], options = {}) {
    const requirements = recipeMaterialRequirements(definitionOrId, options);
    const protectedIds = protectedMaterialInstanceIds(options);
    const pools = asArray(materials).map((material,index)=>({
      index,
      material,
      available:materialQuantityOf(material),
      protected:protectedIds.has(String(material?.instanceId || material?.instance_id || "")),
    }));
    const allocations = [];
    const missing = [];

    for (const requirement of requirements) {
      let needed = requirement.quantity;
      for (const pool of pools) {
        if (needed <= 0) break;
        if (pool.protected || pool.available <= 0 || !requirementMatchesMaterial(requirement, pool.material)) continue;
        const amount = Math.min(pool.available, needed);
        pool.available -= amount;
        needed -= amount;
        allocations.push(Object.freeze({
          requirementId:requirement.id,
          materialIndex:pool.index,
          materialId:materialIdOf(pool.material),
          instanceId:pool.material?.instanceId == null ? null : String(pool.material.instanceId),
          quantity:amount,
        }));
      }
      if (needed > 0) missing.push(Object.freeze({requirementId:requirement.id,quantityMissing:needed}));
    }

    return Object.freeze({
      valid:missing.length === 0,
      requirements,
      allocations:Object.freeze(allocations),
      missing:Object.freeze(missing),
    });
  }

  function consumeRecipeMaterials(definitionOrId, materials = [], options = {}) {
    const plan = planRecipeMaterials(definitionOrId, materials, options);
    if (!plan.valid) return Object.freeze({consumed:false,reason:"missing_ritual_materials",plan});

    const source = asArray(materials);
    const spentByIndex = new Map();
    for (const allocation of plan.allocations) {
      spentByIndex.set(allocation.materialIndex, (spentByIndex.get(allocation.materialIndex) || 0) + allocation.quantity);
    }

    const consumed = [];
    for (const [index, amount] of spentByIndex.entries()) {
      const material = source[index];
      const field = materialQuantityField(material);
      const before = materialQuantityOf(material);
      const after = Math.max(0, before - amount);
      material[field] = after;
      if (field === "quantity" && material.cantidad != null) material.cantidad = after;
      if (field === "cantidad" && material.quantity != null) material.quantity = after;
      consumed.push(Object.freeze({
        materialId:materialIdOf(material),
        instanceId:material?.instanceId == null ? null : String(material.instanceId),
        quantity:amount,
        before,
        after,
      }));
    }

    return Object.freeze({
      consumed:true,
      begun:true,
      outcomeIndependent:true,
      plan,
      consumedMaterials:Object.freeze(consumed),
    });
  }

  function gemAttemptRiskProfile(gem = {}, rank = 1) {
    const channel = Gems.validateGemChannelRank(gemDefinitionIdOf(gem), rank, gemQualityOf(gem));
    if (!channel.valid) return Object.freeze({valid:false,reason:channel.reason || "gem_rank_invalid"});
    const riskTier = channel.overchannel ? "overchannel" : (channel.unstable ? "unstable" : "normal");
    return Object.freeze({
      valid:true,
      riskTier,
      overchannel:channel.overchannel,
      unstable:channel.unstable,
      anchorDamageEligible:channel.unstable,
      accidentalCurseEligible:channel.unstable,
    });
  }

  function validateGemAnchorApplication(item = {}, gem = {}, definitionOrId, rank = 1, options = {}) {
    const definition = typeof definitionOrId === "string" ? Catalog.get(definitionOrId) : clone(definitionOrId);
    if (!definition) return Object.freeze({ allowed:false, reason:"unknown_enchantment" });

    const gemDefinitionId = gemDefinitionIdOf(gem);
    const gemProfile = Gems.gemMagicProfile(gemDefinitionId);
    if (!gemProfile) return Object.freeze({ allowed:false, reason:"not_a_gemstone" });
    if (!gemProfile.canAnchorEnchantment) return Object.freeze({ allowed:false, reason:"gem_not_anchor_ready", gemDefinitionId });

    const refs = appliedEnchantments(item);
    const anchors = gemAnchors(item);
    const capacity = gemSocketCapacity(item);
    if (anchors.length >= capacity) {
      return Object.freeze({
        allowed:false,
        reason:"gem_socket_capacity_exceeded",
        catastrophicAvailable:anchors.length >= GEM_SOCKET_HARD_MAX,
        sockets:Object.freeze({used:anchors.length,max:capacity}),
      });
    }

    const compatibility = gemCompatibility(definition, gem);
    if (!compatibility.compatible) {
      return Object.freeze({ allowed:false, reason:"incompatible_gem", compatibility, gemDefinitionId });
    }

    const quality = gemQualityOf(gem);
    const channel = Gems.validateGemChannelRank(gemDefinitionId, rank, quality);
    if (!channel.valid) return Object.freeze({ allowed:false, reason:channel.reason || "gem_rank_invalid", channel });

    if (existingIndex(refs, definition.id) >= 0 && definition.stacking === "non_stackable") {
      return Object.freeze({ allowed:false, reason:"enchantment_already_installed", definitionId:definition.id });
    }

    const socketIndex = options.socketIndex == null ? nextGemSocketIndex(item) : Math.max(0, Math.trunc(Number(options.socketIndex) || 0));
    if (socketIndex < 0 || socketIndex >= capacity) return Object.freeze({ allowed:false, reason:"gem_socket_index_out_of_range" });
    if (anchors.some((anchor) => normalizeGemAnchor(anchor).socketIndex === socketIndex)) {
      return Object.freeze({ allowed:false, reason:"gem_socket_occupied", socketIndex });
    }

    const gemInstanceId = gemInstanceIdOf(gem);
    const anchorId = String(options.anchorId || `${gemInstanceId || gemDefinitionId}_anchor_${socketIndex + 1}`);
    if (anchors.some((anchor) => normalizeGemAnchor(anchor).anchorId === anchorId)) {
      return Object.freeze({ allowed:false, reason:"duplicate_gem_anchor_id", anchorId });
    }

    const propertyValidation = validateAppliedProperties(options.properties, definition);
    if (!propertyValidation.valid) {
      return Object.freeze({ allowed:false, reason:"invalid_enchantment_properties", errors:propertyValidation.errors });
    }

    const state = channel.unstable ? "unstable" : "stable";
    const candidateRef = normalizeAppliedReference({
      definitionId:definition.id,
      rank,
      source:"gem",
      anchorId,
      properties:propertyValidation.properties,
    });
    const candidateAnchor = normalizeGemAnchor({
      anchorId,
      socketIndex,
      gemDefinitionId,
      gemInstanceId,
      gemQuality:quality,
      state,
      enchantmentDefinitionId:definition.id,
      rank,
      overchannel:channel.overchannel,
    });

    const candidateRefs = [...refs, candidateRef];
    const candidateAnchors = [...anchors, candidateAnchor];
    const validation = validateLoadout(item, candidateRefs, { gemAnchors:candidateAnchors });
    if (!validation.valid) {
      return Object.freeze({ allowed:false, reason:validation.errors[0] || "invalid_enchantment_loadout", validation });
    }

    return Object.freeze({
      allowed:true,
      definition:Object.freeze(definition),
      reference:candidateRef,
      anchor:candidateAnchor,
      channel,
      compatibility,
      threshold:ritualThresholdPreview(item, definition, rank, {...options,gem}),
      risk:gemAttemptRiskProfile(gem, rank),
      validation,
    });
  }

  function catastrophicFourthGem(item = {}, gem = {}, options = {}) {
    const out = clone(item || {});
    const previousAnchors = gemAnchors(out).map(normalizeGemAnchor);
    const survivingGem = clone(gem);
    out.destroyed = true;
    out.condition = 0;
    if (out.currentDurability !== undefined) out.currentDurability = 0;
    if (out.durability !== undefined) out.durability = 0;
    const current = magicStateOf(out);
    out.magic = {
      ...current,
      enabled:false,
      enchantments:[],
      enchantmentSlots:{max:baseSlotCapacity(out),used:0},
      gemSockets:{max:gemSocketCapacity(out),used:0},
      gemAnchors:[],
      destroyedByGemCatastrophe:true,
    };
    return Object.freeze({
      catastrophic:true,
      destroyedItem:true,
      reason:"forced_fourth_gem_catastrophe",
      item:Object.freeze(out),
      survivingGem:Object.freeze(survivingGem),
      destroyedAnchors:Object.freeze(previousAnchors.map(clone)),
      trigger:normalizeId(options.trigger || "forced_fourth_gem"),
    });
  }

  function mountGemAnchor(item = {}, gem = {}, definitionOrId, rank = 1, options = {}) {
    const currentAnchors = gemAnchors(item);
    if (currentAnchors.length >= GEM_SOCKET_HARD_MAX && options.forceFourth === true) {
      return catastrophicFourthGem(item, gem, options);
    }

    const gate = validateGemAnchorApplication(item, gem, definitionOrId, rank, options);
    if (!gate.allowed) return Object.freeze({ mounted:false, ...clone(gate), item:clone(item) });

    const refs = appliedEnchantments(item);
    const anchors = currentAnchors;
    refs.push(gate.reference);
    anchors.push(gate.anchor);
    const out = withMagicState(item, refs, anchors, options);
    return Object.freeze({
      mounted:true,
      item:Object.freeze(out),
      reference:gate.reference,
      anchor:gate.anchor,
      channel:gate.channel,
      compatibility:gate.compatibility,
      threshold:gate.threshold,
      gemSockets:gate.validation.gemSockets,
    });
  }

  function setGemAnchorState(item = {}, anchorId, state) {
    const wanted = String(anchorId || "");
    const normalizedState = normalizeId(state);
    if (!GEM_ANCHOR_STATES.includes(normalizedState)) {
      return Object.freeze({ changed:false, reason:"invalid_gem_anchor_state", item:clone(item) });
    }

    const anchors = gemAnchors(item).map(normalizeGemAnchor);
    const index = anchors.findIndex((anchor) => anchor.anchorId === wanted);
    if (index < 0) return Object.freeze({ changed:false, reason:"gem_anchor_not_found", item:clone(item) });

    const refs = appliedEnchantments(item);
    const linkedIndex = refs.findIndex((ref) => normalizeAppliedReference(ref).anchorId === wanted);
    if (linkedIndex < 0) return Object.freeze({ changed:false, reason:"gem_anchor_enchantment_not_found", item:clone(item) });

    anchors[index] = normalizeGemAnchor({...anchors[index], state:normalizedState});
    const linked = normalizeAppliedReference(refs[linkedIndex]);
    refs[linkedIndex] = normalizeAppliedReference({
      ...linked,
      dormant:!anchorStateSupportsMagic(normalizedState),
    });

    const out = withMagicState(item, refs, anchors);
    return Object.freeze({
      changed:true,
      item:Object.freeze(out),
      anchor:anchors[index],
      reference:refs[linkedIndex],
    });
  }


  function applyGemArcaneOutcome(item = {}, anchorId, outcome, options = {}) {
    const kind = normalizeId(outcome);
    if (kind === "anchor_broken") return setGemAnchorState(item, anchorId, "broken");
    if (kind === "anchor_depleted") return setGemAnchorState(item, anchorId, "depleted");
    if (kind === "anchor_unstable") return setGemAnchorState(item, anchorId, "unstable");

    if (!["accidental_bind","accidental_curse"].includes(kind)) {
      return Object.freeze({changed:false,reason:"unsupported_arcane_outcome",item:clone(item)});
    }

    const refs = appliedEnchantments(item);
    const index = refs.findIndex((raw)=>normalizeAppliedReference(raw).anchorId === String(anchorId || ""));
    if (index < 0) return Object.freeze({changed:false,reason:"gem_anchor_enchantment_not_found",item:clone(item)});

    const current = normalizeAppliedReference(refs[index]);
    const definition = Catalog.get(current.definitionId);
    if (!definition) return Object.freeze({changed:false,reason:"unknown_enchantment",item:clone(item)});
    const allowedByRecipe = kind === "accidental_bind"
      ? definition.recipe?.outcomes?.allowAccidentalBind === true
      : definition.recipe?.outcomes?.allowAccidentalCurse === true;
    const allowedByCaller = kind === "accidental_bind"
      ? options.allowAccidentalBind === true
      : options.allowAccidentalCurse === true;
    if (!allowedByRecipe && !allowedByCaller) {
      return Object.freeze({changed:false,reason:"arcane_outcome_not_permitted",item:clone(item)});
    }

    const property = kind === "accidental_bind" ? "bind" : "curse";
    const nextProperties = [...current.properties, property];
    const propertyValidation = validateAppliedProperties(nextProperties, definition);
    if (!propertyValidation.valid) {
      return Object.freeze({changed:false,reason:"invalid_arcane_outcome_properties",errors:propertyValidation.errors,item:clone(item)});
    }

    refs[index] = normalizeAppliedReference({...current,properties:propertyValidation.properties});
    const out = withMagicState(item, refs, gemAnchors(item));
    return Object.freeze({
      changed:true,
      outcome:kind,
      item:Object.freeze(out),
      reference:refs[index],
    });
  }

  function canRemoveGemAnchoredEnchantment(item = {}, definitionId) {
    const refs = appliedEnchantments(item);
    const index = existingIndex(refs, definitionId);
    if (index < 0) return null;
    const ref = normalizeAppliedReference(refs[index]);
    return ref.source === "gem"
      ? Object.freeze({blocked:true,reason:"gem_anchored_enchantment_requires_anchor_procedure",reference:ref})
      : null;
  }



  function gemAnchorLink(item = {}, anchorId) {
    const wanted = String(anchorId || "");
    const anchors = gemAnchors(item).map(normalizeGemAnchor);
    const anchorIndex = anchors.findIndex((anchor) => anchor.anchorId === wanted);
    if (anchorIndex < 0) return Object.freeze({ found:false, reason:"gem_anchor_not_found" });

    const refs = appliedEnchantments(item).map(normalizeAppliedReference);
    const refIndex = refs.findIndex((ref) => ref.anchorId === wanted);
    if (refIndex < 0) return Object.freeze({ found:false, reason:"gem_anchor_enchantment_not_found", anchor:anchors[anchorIndex] });

    return Object.freeze({
      found:true,
      anchorIndex,
      refIndex,
      anchor:anchors[anchorIndex],
      reference:refs[refIndex],
    });
  }

  function gemDescriptorFromAnchor(anchor = {}, options = {}) {
    const normalized = normalizeGemAnchor(anchor);
    return Object.freeze({
      instanceId:normalized.gemInstanceId,
      definitionId:normalized.gemDefinitionId,
      itemId:normalized.gemDefinitionId,
      quality:normalizeId(options.quality || normalized.gemQuality || "standard") || "standard",
      enchantmentReady:true,
      magicallyWritten:options.magicallyWritten === true,
      previousAnchorId:normalized.anchorId,
    });
  }

  function boundGemAnchorRemovalCatastrophe(item = {}, anchorId, options = {}) {
    const link = gemAnchorLink(item, anchorId);
    if (!link.found) return Object.freeze({ catastrophic:false, destroyedItem:false, ...clone(link), item:clone(item) });
    if (!link.reference.properties.includes("bind")) {
      return Object.freeze({ catastrophic:false, destroyedItem:false, reason:"gem_anchor_not_bound", item:clone(item), anchor:link.anchor });
    }
    if (options.confirmDestruction !== true) {
      return Object.freeze({
        catastrophic:false,
        destroyedItem:false,
        blocked:true,
        reason:"bound_gem_removal_destroys_item",
        requiresDestructionConfirmation:true,
        item:clone(item),
        anchor:link.anchor,
        reference:link.reference,
      });
    }

    const out = clone(item || {});
    out.destroyed = true;
    out.condition = 0;
    if (out.currentCondition !== undefined) out.currentCondition = 0;
    if (out.currentDurability !== undefined) out.currentDurability = 0;
    if (typeof out.durability === "number") out.durability = 0;
    const current = magicStateOf(out);
    out.magic = {
      ...current,
      enabled:false,
      enchantments:[],
      enchantmentSlots:{max:baseSlotCapacity(out),used:0},
      gemSockets:{max:gemSocketCapacity(out),used:0},
      gemAnchors:[],
      destroyedByBoundGemRemoval:true,
    };
    return Object.freeze({
      catastrophic:true,
      destroyedItem:true,
      reason:"bound_gem_removal_destroyed_item",
      item:Object.freeze(out),
      removedAnchor:link.anchor,
      removedReference:link.reference,
      gemOutcome:"not_recovered_by_default",
    });
  }

  function itemSideRemoveGemEnchantment(item = {}, anchorId, options = {}) {
    const link = gemAnchorLink(item, anchorId);
    if (!link.found) return Object.freeze({ removed:false, ...clone(link), item:clone(item) });
    if (link.reference.properties.includes("bind")) {
      return boundGemAnchorRemovalCatastrophe(item, anchorId, options);
    }

    const requestedQuality = normalizeId(options.gemQualityAfter || options.qualityAfter || "");
    if (!requestedQuality) {
      return Object.freeze({
        removed:false,
        reason:"gem_quality_downgrade_unresolved",
        requiresAuthoredGemQualityAfter:true,
        anchor:link.anchor,
        reference:link.reference,
        item:clone(item),
      });
    }
    if (!Object.prototype.hasOwnProperty.call(Gems.GEM_STABLE_RANK_BY_QUALITY || {}, requestedQuality)) {
      return Object.freeze({ removed:false, reason:"invalid_gem_quality_after", item:clone(item), requestedQuality });
    }

    const refs = appliedEnchantments(item).map(normalizeAppliedReference);
    const anchors = gemAnchors(item).map(normalizeGemAnchor);
    refs.splice(link.refIndex,1);
    anchors.splice(link.anchorIndex,1);
    const out = withMagicState(item, refs, anchors);
    if (!refs.length) out.magic.enabled = false;

    const recoveredGem = gemDescriptorFromAnchor(link.anchor,{
      quality:requestedQuality,
      magicallyWritten:true,
    });
    return Object.freeze({
      removed:true,
      procedure:"item_side",
      item:Object.freeze(out),
      removedReference:link.reference,
      removedAnchor:link.anchor,
      recoveredGem,
      gemDestroyed:false,
      itemDestroyed:false,
    });
  }

  function anchorSideDestroyGemEnchantment(item = {}, anchorId, options = {}) {
    const link = gemAnchorLink(item, anchorId);
    if (!link.found) return Object.freeze({ removed:false, ...clone(link), item:clone(item) });
    if (link.reference.properties.includes("bind")) {
      return boundGemAnchorRemovalCatastrophe(item, anchorId, options);
    }

    const refs = appliedEnchantments(item).map(normalizeAppliedReference);
    const anchors = gemAnchors(item).map(normalizeGemAnchor);
    refs.splice(link.refIndex,1);
    anchors.splice(link.anchorIndex,1);
    const out = withMagicState(item, refs, anchors);
    if (!refs.length) out.magic.enabled = false;

    return Object.freeze({
      removed:true,
      procedure:"anchor_side",
      item:Object.freeze(out),
      removedReference:link.reference,
      removedAnchor:link.anchor,
      recoveredGem:null,
      gemDestroyed:true,
      itemDestroyed:false,
    });
  }

  function rewriteGemAnchoredEnchantment(item = {}, anchorId, nextDefinitionOrId, options = {}) {
    const link = gemAnchorLink(item, anchorId);
    if (!link.found) return Object.freeze({ rewritten:false, ...clone(link), item:clone(item) });
    if (link.reference.properties.includes("bind")) {
      return Object.freeze({ rewritten:false, reason:"bound_enchantment_not_rewritable", item:clone(item), anchor:link.anchor });
    }

    const nextDefinition = typeof nextDefinitionOrId === "string" ? Catalog.get(nextDefinitionOrId) : clone(nextDefinitionOrId);
    if (!nextDefinition) return Object.freeze({ rewritten:false, reason:"unknown_enchantment", item:clone(item) });
    const nextRank = Number(options.rank ?? link.reference.rank);
    const requestedQuality = normalizeId(options.gemQualityAfter || options.qualityAfter || "");
    if (!requestedQuality) {
      return Object.freeze({
        rewritten:false,
        reason:"gem_quality_downgrade_unresolved",
        requiresAuthoredGemQualityAfter:true,
        item:clone(item),
        anchor:link.anchor,
      });
    }
    if (!Object.prototype.hasOwnProperty.call(Gems.GEM_STABLE_RANK_BY_QUALITY || {}, requestedQuality)) {
      return Object.freeze({ rewritten:false, reason:"invalid_gem_quality_after", item:clone(item), requestedQuality });
    }

    const gem = {
      definitionId:link.anchor.gemDefinitionId,
      instanceId:link.anchor.gemInstanceId,
      quality:requestedQuality,
    };
    const compatibility = gemCompatibility(nextDefinition,gem);
    if (!compatibility.compatible) {
      return Object.freeze({ rewritten:false, reason:"incompatible_gem", compatibility, item:clone(item) });
    }
    const channel = Gems.validateGemChannelRank(link.anchor.gemDefinitionId,nextRank,requestedQuality);
    if (!channel.valid) {
      return Object.freeze({ rewritten:false, reason:channel.reason || "gem_rank_invalid", channel, item:clone(item) });
    }

    const propertyValidation = validateAppliedProperties(options.properties ?? link.reference.properties,nextDefinition);
    if (!propertyValidation.valid) {
      return Object.freeze({ rewritten:false, reason:"invalid_enchantment_properties", errors:propertyValidation.errors, item:clone(item) });
    }

    const refs = appliedEnchantments(item).map(normalizeAppliedReference);
    const anchors = gemAnchors(item).map(normalizeGemAnchor);
    refs[link.refIndex] = normalizeAppliedReference({
      definitionId:nextDefinition.id,
      rank:nextRank,
      source:"gem",
      anchorId:link.anchor.anchorId,
      properties:propertyValidation.properties,
      dormant:false,
      disabled:false,
    });
    anchors[link.anchorIndex] = normalizeGemAnchor({
      ...link.anchor,
      gemQuality:requestedQuality,
      enchantmentDefinitionId:nextDefinition.id,
      rank:nextRank,
      state:channel.unstable ? "unstable" : "stable",
      overchannel:channel.overchannel,
    });

    const validation = validateLoadout(item,refs,{gemAnchors:anchors});
    if (!validation.valid) {
      return Object.freeze({ rewritten:false, reason:validation.errors[0] || "invalid_enchantment_loadout", validation, item:clone(item) });
    }

    const out = withMagicState(item,refs,anchors);
    return Object.freeze({
      rewritten:true,
      item:Object.freeze(out),
      previousReference:link.reference,
      reference:refs[link.refIndex],
      anchor:anchors[link.anchorIndex],
      compatibility,
      channel,
      gemQualityAfter:requestedQuality,
    });
  }

  function itemMaterialTags(item = {}) {
    const tags = [
      ...asArray(item.materialTags),
      ...asArray(item.tags),
      ...asArray(item.itemTags),
      item.materialId,
      item.material,
      item.primaryMaterialId,
      item.primaryMaterial,
    ];
    for (const entry of asArray(item.composition)) {
      if (typeof entry === "string") tags.push(entry);
      else if (entry && typeof entry === "object") {
        tags.push(entry.materialId, entry.id, entry.material, ...asArray(entry.tags));
      }
    }
    return Object.freeze([...new Set(tags.map(normalizeId).filter(Boolean))]);
  }

  function materialCompatibility(item = {}, definitionOrId) {
    const definition = typeof definitionOrId === "string" ? Catalog.get(definitionOrId) : clone(definitionOrId);
    if (!definition) return Object.freeze({compatible:true,authored:false,wearMultiplier:1,matched:Object.freeze([])});
    const required = asArray(definition.compatibility?.materialTags).map(normalizeId).filter(Boolean);
    if (!required.length) return Object.freeze({compatible:true,authored:false,wearMultiplier:1,matched:Object.freeze([])});
    const itemTags = itemMaterialTags(item);
    const matched = required.filter((tag) => itemTags.includes(tag));
    const compatible = matched.length > 0;
    return Object.freeze({
      compatible,
      authored:true,
      wearMultiplier:compatible ? 1 : 2,
      required:Object.freeze(required),
      itemTags,
      matched:Object.freeze(matched),
    });
  }

  function materialWearMultiplier(item = {}, definitionOrId) {
    return materialCompatibility(item, definitionOrId).wearMultiplier;
  }

  function effectTriggerMatches(effect = {}, trigger = null) {
    const wanted = normalizeId(trigger);
    if (!wanted) return true;
    return normalizeId(effect.trigger || "passive") === wanted;
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
    if (options.magicActive === false) return Object.freeze([]);
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
        effects:Object.freeze(rank.effects
          .filter((effect) => effectTriggerMatches(effect, options.trigger))
          .map((effect) => Object.freeze({
            ...scaledEffect(effect, ref),
            sourceMagicalWear:Number(effect.magicalWear ?? rank.magicalWear ?? 0) || 0,
          }))),
      }));
    }
    return Object.freeze(results);
  }

  function actionChannels(item = {}, context = {}) {
    const groups = new Map();
    for (const entry of resolvedEnchantments(item, { trigger:context.trigger, magicActive:context.magicActive })) {
      if (context.trigger && entry.effects.length === 0) continue;
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

    for (const entry of resolvedEnchantments(item, { trigger:context.trigger, magicActive:context.magicActive })) {
      const interaction = entry.definition.interaction || {};
      const channel = normalizeId(interaction.exclusiveChannel);
      if (channel && interaction.exclusivePerAction === true) {
        const choices = actionChannels(item, context).find((row) => row.channel === channel);
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
          sourceApplicationSource:entry.reference.source,
          sourceAnchorId:entry.reference.anchorId,
          materialWearMultiplier:materialWearMultiplier(item, entry.definition),
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
    GEM_SOCKET_HARD_MAX,
    GEM_ANCHOR_STATES,
    GEM_COMPATIBILITY_BASE_TH_ADJUSTMENT,
    GEM_QUALITY_TH_ADJUSTMENT,
    GEM_SPECIALIZATION_TH_ADJUSTMENT,
    GEM_ITEM_STABILIZATION_MAX_REDUCTION,
    OVERCHANNEL_TH_PER_RANK,
    EXTERNAL_TH_SOURCE_TYPES,
    INTENTIONAL_BIND_TH_ADJUSTMENT,
    INTENTIONAL_CURSE_TH_ADJUSTMENT,
    DIRECT_MAGIC_DURABILITY_RATIO,
    GEM_MAGIC_DURABILITY_RATIO,
    CURSE_REAGENT_TAGS,
    normalizeId,
    itemKindOf,
    tierOf,
    baseSlotCapacity,
    magicStateOf,
    physicalDurabilityMaxOf,
    inferredMagicalDurabilityMax,
    normalizeMagicalDurability,
    gemSocketCapacity,
    gemAnchors,
    gemDefinitionIdOf,
    gemInstanceIdOf,
    gemQualityOf,
    normalizeGemAnchor,
    nextGemSocketIndex,
    anchorStateSupportsMagic,
    gemAnchoredRefs,
    validateGemSocketLoadout,
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
    validateGemAnchorApplication,
    catastrophicFourthGem,
    mountGemAnchor,
    setGemAnchorState,
    canRemoveGemAnchoredEnchantment,
    intersects,
    gemCompatibility,
    gemResonanceFamily,
    resonanceArchitecture,
    externalThresholdAdjustment,
    gemThresholdPreview,
    propertyThresholdAdjustment,
    ritualThresholdPreview,
    materialIdOf,
    materialTagsOf,
    materialQuantityOf,
    normalizeRecipeRequirement,
    requirementMatchesMaterial,
    recipeMaterialRequirements,
    planRecipeMaterials,
    consumeRecipeMaterials,
    gemAttemptRiskProfile,
    applyGemArcaneOutcome,
    gemAnchorLink,
    gemDescriptorFromAnchor,
    boundGemAnchorRemovalCatastrophe,
    itemSideRemoveGemEnchantment,
    anchorSideDestroyGemEnchantment,
    rewriteGemAnchoredEnchantment,
    itemMaterialTags,
    materialCompatibility,
    materialWearMultiplier,
    effectTriggerMatches,
    positiveEffectMultiplier,
    resolvedEnchantments,
    actionChannels,
    resolveEffectsForAction,
  });

  global.LuminousItemEnchantmentEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
