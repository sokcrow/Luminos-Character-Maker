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

  const VERSION = 2;
  const TIER_BASE_SLOT_CAPACITY = Object.freeze({ 1: 0, 2: 1, 3: 1, 4: 2, 5: 3 });
  const BIND_POSITIVE_MULTIPLIER = 1.25;
  const CURSE_POSITIVE_MULTIPLIER = 1.50;
  const SUPPORTED_APPLICATION_SOURCES = Object.freeze(["direct", "gem"]);
  const GEM_SOCKET_HARD_MAX = 3;
  const GEM_ANCHOR_STATES = Object.freeze(["stable", "unstable", "depleted", "broken"]);

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

  function withMagicState(item, refs, anchors = gemAnchors(item)) {
    const out = clone(item || {});
    const current = magicStateOf(out);
    const capacity = baseSlotCapacity(out);
    const used = slotsUsed(refs);
    const normalizedAnchors = asArray(anchors).map(normalizeGemAnchor);
    out.magic = {
      ...current,
      enabled:refs.length > 0,
      enchantments:refs.map((entry) => clone(normalizeAppliedReference(entry))),
      enchantmentSlots:{ max:capacity, used },
      gemSockets:{ max:gemSocketCapacity(out), used:normalizedAnchors.length },
      gemAnchors:normalizedAnchors.map(clone),
    };
    return out;
  }

  function applyEnchantment(item = {}, definitionOrId, rank = 1, options = {}) {
    const gate = validateApplication(item, definitionOrId, rank, options);
    if (!gate.allowed) return Object.freeze({ applied:false, ...clone(gate), item:clone(item) });
    const refs = appliedEnchantments(item);
    refs.push(gate.reference);
    const out = withMagicState(item, refs, gate.candidateAnchors || gemAnchors(item));
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


  function validateGemAnchorApplication(item = {}, gem = {}, definitionOrId, rank = 1, options = {}) {
    const definition = typeof definitionOrId === "string" ? Catalog.get(definitionOrId) : clone(definitionOrId);
    if (!definition) return Object.freeze({ allowed:false, reason:"unknown_enchantment" });

    const gemDefinitionId = gemDefinitionIdOf(gem);
    const gemProfile = Gems.gemMagicProfile(gemDefinitionId);
    if (!gemProfile) return Object.freeze({ allowed:false, reason:"not_a_gemstone" });
    if (!gemProfile.canAnchorEnchantment) return Object.freeze({ allowed:false, reason:"gem_not_anchor_ready", gemDefinitionId });

    const quality = gemQualityOf(gem);
    const channel = Gems.validateGemChannelRank(gemDefinitionId, rank, quality);
    if (!channel.valid) return Object.freeze({ allowed:false, reason:channel.reason || "gem_rank_invalid", channel });

    const refs = appliedEnchantments(item);
    if (existingIndex(refs, definition.id) >= 0 && definition.stacking === "non_stackable") {
      return Object.freeze({ allowed:false, reason:"enchantment_already_installed", definitionId:definition.id });
    }

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
    const out = withMagicState(item, refs, anchors);
    return Object.freeze({
      mounted:true,
      item:Object.freeze(out),
      reference:gate.reference,
      anchor:gate.anchor,
      channel:gate.channel,
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

  function canRemoveGemAnchoredEnchantment(item = {}, definitionId) {
    const refs = appliedEnchantments(item);
    const index = existingIndex(refs, definitionId);
    if (index < 0) return null;
    const ref = normalizeAppliedReference(refs[index]);
    return ref.source === "gem"
      ? Object.freeze({blocked:true,reason:"gem_anchored_enchantment_requires_anchor_procedure",reference:ref})
      : null;
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
    GEM_SOCKET_HARD_MAX,
    GEM_ANCHOR_STATES,
    normalizeId,
    itemKindOf,
    tierOf,
    baseSlotCapacity,
    magicStateOf,
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
    positiveEffectMultiplier,
    resolvedEnchantments,
    actionChannels,
    resolveEffectsForAction,
  });

  global.LuminousItemEnchantmentEngine = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
