(function (global) {
  "use strict";

  if (global.LuminousLootInstanceRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootInstanceRuntime;
    return;
  }

  const VERSION = 1;
  const SCHEMA_VERSION = 1;

  const RARITY_CHANCE = Object.freeze({
    impossible: 0,
    very_rare: 0.05,
    rare: 0.15,
    uncommon: 0.35,
    common: 0.60,
    likely: 0.80,
    guaranteed: 1,
  });

  function inventoryRuntime() { return global.LuminousItemInventoryRuntime || null; }
  function socialRuntime() { return global.LuminousLootSocialProfileContract || null; }
  function encounterRuntime() { return global.LuminousLootEncounterContext || null; }
  function corpseRuntime() { return global.LuminousCorpseHarvestRuntime || null; }
  function ammoRuntime() { return global.LuminousLootAmmoReconciliation || null; }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function finite(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, finite(value, min)));
  }

  function intRange(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.trunc(numeric) : fallback;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function stableNormalize(value) {
    if (Array.isArray(value)) return value.map(stableNormalize);
    if (!value || typeof value !== "object") return value;
    return Object.keys(value).sort().reduce((out, key) => {
      if (value[key] !== undefined) out[key] = stableNormalize(value[key]);
      return out;
    }, {});
  }

  function stableStringify(value) {
    return JSON.stringify(stableNormalize(value));
  }

  function hash32(value) {
    const text = String(value ?? "");
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
  }

  function hashHex(value) {
    return hash32(value).toString(16).padStart(8, "0");
  }

  function seededRandom(seed) {
    let state = hash32(seed) || 0x6d2b79f5;
    return function random() {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function rollInt(rng, min, max) {
    const low = Math.max(0, Math.trunc(finite(min, 0)));
    const high = Math.max(low, Math.trunc(finite(max, low)));
    if (high === low) return low;
    return low + Math.floor(rng() * (high - low + 1));
  }

  function canonicalCategory(value) {
    const encounter = encounterRuntime();
    return encounter?.canonicalChannel?.(value) || normalizeId(value);
  }

  function unitCanonicalId(unit = {}, options = {}) {
    return normalizeId(
      options.unitId ??
      unit.libraryUnitId ??
      unit.unitRef?.id ??
      unit.actorRef?.id ??
      unit.canonicalUnitId ??
      unit.definitionId ??
      unit.id
    );
  }

  function unitInstanceId(unit = {}, options = {}) {
    return String(
      options.unitInstanceId ??
      unit.combatId ??
      unit.instanceId ??
      unit.runtimeId ??
      unit.id ??
      ""
    ).trim();
  }

  function identityFor(unit = {}, options = {}) {
    const encounterId = String(options.encounterId ?? options.encounter?.id ?? "").trim();
    const sourceUnitId = unitCanonicalId(unit, options);
    const sourceUnitInstanceId = unitInstanceId(unit, options);
    const corpseId = String(options.corpseId ?? unit.corpseId ?? (sourceUnitInstanceId ? `corpse:${sourceUnitInstanceId}` : "")).trim();

    if (!encounterId) throw new Error("LOOT_ENCOUNTER_ID_REQUIRED");
    if (!sourceUnitId) throw new Error("LOOT_SOURCE_UNIT_ID_REQUIRED");
    if (!sourceUnitInstanceId) throw new Error("LOOT_UNIT_INSTANCE_ID_REQUIRED");
    if (!corpseId) throw new Error("LOOT_CORPSE_ID_REQUIRED");

    return deepFreeze({ encounterId, sourceUnitId, sourceUnitInstanceId, corpseId });
  }

  function resolveZone(options = {}) {
    const encounter = encounterRuntime();
    if (!encounter) return deepFreeze({ id: "unknown_zone", profileId: null, weights: {}, impossibleCategories: [], allowCategories: [], tags: [] });
    if (options.zone) return encounter.normalizeZoneProfile(options.zone);
    if (options.worldNode) return encounter.deriveZoneFromWorldNode(options.worldNode, options.zoneOverrides || {});
    return encounter.normalizeZoneProfile({ id: options.zoneId || "encounter_zone", allowCustom: true });
  }

  function resolveContext(options = {}) {
    const encounter = encounterRuntime();
    const zone = resolveZone(options);
    if (!encounter?.resolveEncounterContext) {
      return deepFreeze({
        version: 0,
        zone,
        events: [],
        tags: [],
        weights: {},
        rarityWeights: {},
        impossibleCategories: [],
        allowedCategories: [],
        quantityMultiplier: 1,
        qualityMultiplier: 1,
        currencyMultiplier: 1,
        guaranteedItems: [],
        provenance: { zoneId: zone.id || null, zoneProfileId: zone.profileId || null, eventIds: [], eventTypes: [] },
      });
    }
    return encounter.resolveEncounterContext({ zone, events: options.events || [] });
  }

  function neutralSocial() {
    return deepFreeze({
      valid: true,
      carriedCash: null,
      carriedCashGeneratedSeparately: true,
      itemValueMultiplier: 1,
      qualityBias: 0,
      reusedChance: 0,
      carriedCategoryWeights: {},
      guaranteedEquipmentTags: [],
      valuableLowCashAllowed: false,
      wealthProfile: null,
      roleProfile: null,
    });
  }

  function resolveSocial(unit = {}, options = {}) {
    const social = socialRuntime();
    if (!social?.resolveSocialLootModifiers) return neutralSocial();

    const hasProfile = Boolean(options.wealthProfile || unit.wealthProfile || options.roleProfile || unit.roleProfile);
    if (!hasProfile && social.isHumanoidEligible?.(unit) !== true) return neutralSocial();

    const resolved = social.resolveSocialLootModifiers(unit, {
      wealthProfile: options.wealthProfile,
      roleProfile: options.roleProfile,
    });
    if (resolved?.valid) return resolved;

    if (social.isHumanoidEligible?.(unit) === true) {
      throw new Error(`INVALID_HUMANOID_SOCIAL_LOOT_PROFILE:${(resolved?.errors || []).join("|")}`);
    }
    return neutralSocial();
  }

  function normalizeQuantity(entry = {}) {
    const min = Math.max(0, intRange(entry.min ?? entry.quantity ?? 1, 1));
    const max = Math.max(min, intRange(entry.max ?? entry.quantity ?? min, min));
    return { min, max };
  }

  function normalizeCandidate(entry = {}, source = "unit_profile", index = 0) {
    const range = normalizeQuantity(entry);
    const itemId = normalizeId(entry.itemId ?? entry.definitionId ?? entry.id);
    const category = canonicalCategory(entry.category);
    const rarity = normalizeId(entry.rarity || (source.includes("guaranteed") ? "guaranteed" : "common"));
    return deepFreeze({
      key: String(entry.key || `${source}:${itemId || category || "entry"}:${index}`),
      itemId,
      category,
      rarity: Object.prototype.hasOwnProperty.call(RARITY_CHANCE, rarity) ? rarity : "common",
      chance: entry.chance == null ? null : clamp(entry.chance, 0, 1),
      min: range.min,
      max: range.max,
      qualityTier: entry.qualityTier == null ? null : clamp(Math.round(finite(entry.qualityTier, 1)), 1, 5),
      condition: entry.condition == null ? null : clamp(entry.condition, 0, 100),
      ammoId: normalizeId(entry.ammoId),
      reconcilePostCombatAmmo: entry.reconcilePostCombatAmmo === true,
      tags: deepFreeze([...(Array.isArray(entry.tags) ? entry.tags : [])].map(normalizeId).filter(Boolean)),
      force: entry.force === true || source === "event_guaranteed" || source === "dm_guaranteed",
      source,
      sourceEventId: entry.provenance?.eventId ?? entry.sourceEventId ?? null,
      sourceEventType: entry.provenance?.eventType ?? entry.sourceEventType ?? null,
    });
  }

  function normalizeDmOverrides(value = {}) {
    const source = value && typeof value === "object" ? value : {};
    return deepFreeze({
      addCarried: deepFreeze((Array.isArray(source.addCarried) ? source.addCarried : []).map(clone)),
      guaranteedItems: deepFreeze((Array.isArray(source.guaranteedItems) ? source.guaranteedItems : []).map(clone)),
      removeItemIds: deepFreeze((Array.isArray(source.removeItemIds) ? source.removeItemIds : []).map(normalizeId).filter(Boolean)),
      allowCategories: deepFreeze((Array.isArray(source.allowCategories) ? source.allowCategories : []).map(canonicalCategory).filter(Boolean)),
      blockCategories: deepFreeze((Array.isArray(source.blockCategories) ? source.blockCategories : []).map(canonicalCategory).filter(Boolean)),
      currency: source.currency && typeof source.currency === "object" ? deepFreeze(clone(source.currency)) : null,
      addEquipment: deepFreeze((Array.isArray(source.addEquipment) ? source.addEquipment : []).map(clone)),
      removeEquipmentIds: deepFreeze((Array.isArray(source.removeEquipmentIds) ? source.removeEquipmentIds : []).map(normalizeId).filter(Boolean)),
      harvest: source.harvest && typeof source.harvest === "object" ? deepFreeze(clone(source.harvest)) : null,
      reason: String(source.reason || "").trim() || null,
    });
  }

  function candidatePool(unit = {}, context = {}, overrides = {}, options = {}) {
    const pool = [];
    const pushAll = (entries, source) => {
      (Array.isArray(entries) ? entries : []).forEach((entry, index) => pool.push(normalizeCandidate(entry, source, index)));
    };

    pushAll(unit.lootProfile?.carried, "unit_profile");
    pushAll(options.carriedCandidates, "runtime_candidates");
    pushAll(overrides.addCarried, "dm_override");
    pushAll(context.guaranteedItems, "event_guaranteed");
    pushAll(overrides.guaranteedItems, "dm_guaranteed");

    const removed = new Set(overrides.removeItemIds);
    return pool
      .filter((entry) => !entry.itemId || !removed.has(entry.itemId))
      .sort((left, right) => {
        const a = `${left.itemId}|${left.category}|${left.source}|${left.key}`;
        const b = `${right.itemId}|${right.category}|${right.source}|${right.key}`;
        return a.localeCompare(b);
      });
  }

  function impossibleCategories(unit = {}, context = {}, overrides = {}) {
    const hard = new Set((unit.lootProfile?.impossibleCategories || []).map(canonicalCategory));
    const contextual = new Set((context.impossibleCategories || []).map(canonicalCategory));

    for (const category of overrides.allowCategories) {
      hard.delete(category);
      contextual.delete(category);
    }
    for (const category of overrides.blockCategories) {
      hard.add(category);
      contextual.add(category);
    }

    return deepFreeze({
      hard: deepFreeze([...hard]),
      contextual: deepFreeze([...contextual]),
      all: deepFreeze([...new Set([...hard, ...contextual])]),
    });
  }

  function remapSocialWeights(social = {}) {
    const out = {};
    for (const [category, weight] of Object.entries(social.carriedCategoryWeights || {})) {
      const canonical = canonicalCategory(category);
      out[canonical] = (out[canonical] ?? 1) * Math.max(0, finite(weight, 1));
    }
    return out;
  }

  function chanceForCandidate(candidate, social = {}, context = {}, impossible = {}) {
    if (candidate.force) return 1;
    if (candidate.rarity === "impossible") return 0;
    if (candidate.category && (impossible.all || []).includes(candidate.category)) return 0;

    const baseChance = candidate.chance == null ? (RARITY_CHANCE[candidate.rarity] ?? RARITY_CHANCE.common) : candidate.chance;
    const socialWeights = remapSocialWeights(social);
    const categoryWeight = candidate.category
      ? Math.max(0, finite(socialWeights[candidate.category], 1)) * Math.max(0, finite(context.weights?.[candidate.category], 1))
      : 1;
    const rarityWeight = Math.max(0, finite(context.rarityWeights?.[candidate.rarity], 1));
    return clamp(baseChance * categoryWeight * rarityWeight, 0, 1);
  }

  function qualityForCandidate(candidate, social = {}, context = {}) {
    if (candidate.qualityTier != null) return candidate.qualityTier;
    const base = clamp(3 + finite(social.qualityBias, 0), 1, 5);
    return clamp(Math.round(base * Math.max(0.25, finite(context.qualityMultiplier, 1))), 1, 5);
  }

  function provenanceFor(identity, context, generation, extra = {}) {
    return deepFreeze({
      sourceUnitId: identity.sourceUnitId,
      sourceUnitInstanceId: identity.sourceUnitInstanceId,
      corpseId: identity.corpseId,
      encounterId: identity.encounterId,
      zoneId: context.provenance?.zoneId ?? null,
      zoneProfileId: context.provenance?.zoneProfileId ?? null,
      eventIds: clone(context.provenance?.eventIds || []),
      eventTypes: clone(context.provenance?.eventTypes || []),
      lootGeneration: generation,
      ...clone(extra),
    });
  }

  function deterministicItemInstanceId(identity, generation, candidate, index) {
    const base = [
      identity.encounterId,
      identity.sourceUnitInstanceId,
      identity.corpseId,
      generation,
      candidate.itemId,
      candidate.source,
      index,
    ].join("|");
    return `lootitem_${hashHex(base)}_${normalizeId(candidate.itemId || "item")}`;
  }

  function createCarriedItem(candidate, quantity, identity, context, social, generation, index, options = {}) {
    const inventory = inventoryRuntime();
    if (!inventory?.createItemInstance) throw new Error("ITEM_INVENTORY_RUNTIME_REQUIRED");
    if (!candidate.itemId) return null;

    const provenance = provenanceFor(identity, context, generation, {
      sourceMethod: "carried_loot_generation",
      sourceKind: candidate.source,
      sourceEventId: candidate.sourceEventId,
      sourceEventType: candidate.sourceEventType,
    });
    const instanceId = deterministicItemInstanceId(identity, generation, candidate, index);
    const qualityTier = qualityForCandidate(candidate, social, context);
    const definition = inventory.resolveDefinition?.(candidate.itemId, { catalog: options.catalog }) || {
      id: candidate.itemId,
      definitionId: candidate.itemId,
      category: candidate.category || "item",
    };

    const created = inventory.createItemInstance(definition, {
      catalog: options.catalog,
      instanceId,
      quantity,
      qualityTier,
      condition: candidate.condition == null ? 100 : candidate.condition,
      currentOwnerId: null,
      category: candidate.category || definition.category,
      provenance,
      customData: {
        loot: {
          source: candidate.source,
          rarity: candidate.rarity,
          category: candidate.category,
          tags: clone(candidate.tags),
          reconcilePostCombatAmmo: candidate.reconcilePostCombatAmmo === true,
          ammoId: candidate.ammoId || null,
        },
      },
    });

    return deepFreeze({
      ...created,
      ...(candidate.ammoId ? { ammoId: candidate.ammoId } : {}),
      lootSource: candidate.source,
      lootRarity: candidate.rarity,
      lootCategory: candidate.category,
      provenance,
    });
  }

  function generateCarried(unit, identity, context, social, overrides, generation, rng, options = {}) {
    const impossible = impossibleCategories(unit, context, overrides);
    const pool = candidatePool(unit, context, overrides, options);
    const carried = [];
    const rolls = [];
    const unresolved = [];
    const quantityMultiplier = Math.max(0, finite(context.quantityMultiplier, 1));

    pool.forEach((candidate, index) => {
      const chance = chanceForCandidate(candidate, social, context, impossible);
      const roll = rng();
      const blocked = candidate.category && impossible.all.includes(candidate.category) && !candidate.force;
      const selected = !blocked && roll < chance;

      if (!candidate.itemId) {
        unresolved.push(deepFreeze({ candidate, reason: "item_id_missing", chance, roll }));
        return;
      }

      let quantity = 0;
      if (selected) {
        const rawQuantity = rollInt(rng, candidate.min, candidate.max);
        const effectiveQuantityMultiplier = candidate.reconcilePostCombatAmmo === true ? 1 : quantityMultiplier;
        quantity = candidate.force
          ? Math.max(1, Math.round(rawQuantity * effectiveQuantityMultiplier))
          : Math.max(0, Math.round(rawQuantity * effectiveQuantityMultiplier));
      }

      rolls.push(deepFreeze({
        itemId: candidate.itemId,
        category: candidate.category,
        rarity: candidate.rarity,
        source: candidate.source,
        chance,
        roll,
        selected: selected && quantity > 0,
        quantity,
        blocked,
      }));

      if (!selected || quantity <= 0) return;
      const instance = createCarriedItem(candidate, quantity, identity, context, social, generation, index, options);
      if (instance) carried.push(instance);
    });

    return deepFreeze({
      items: deepFreeze(carried),
      rolls: deepFreeze(rolls),
      unresolved: deepFreeze(unresolved),
      impossible,
    });
  }

  function normalizeEquipmentId(entry = {}) {
    return normalizeId(
      entry.instanceId ??
      entry.definitionId ??
      entry.itemId ??
      entry.weaponId ??
      entry.equipmentId ??
      entry.id
    );
  }

  function equipmentSource(unit = {}, options = {}) {
    if (Array.isArray(options.equipmentInstances)) return { mode: "combat_runtime", entries: options.equipmentInstances };
    if (Array.isArray(unit.equipmentInstances)) return { mode: "combat_runtime", entries: unit.equipmentInstances };
    if (Array.isArray(unit.runtimeState?.equipmentInstances)) return { mode: "combat_runtime", entries: unit.runtimeState.equipmentInstances };
    if (Array.isArray(unit.mechanics?.weaponLoadout)) return { mode: "unit_loadout", entries: unit.mechanics.weaponLoadout };
    if (Array.isArray(unit.weaponLoadout)) return { mode: "unit_loadout", entries: unit.weaponLoadout };
    return { mode: "none", entries: [] };
  }

  function snapshotEquipment(unit, identity, context, generation, overrides, options = {}) {
    const inventory = inventoryRuntime();
    const source = equipmentSource(unit, options);
    const removed = new Set(overrides.removeEquipmentIds);
    const raw = [...source.entries, ...overrides.addEquipment];
    const equipment = [];

    raw.forEach((entry, index) => {
      const equipmentId = normalizeEquipmentId(entry);
      if (equipmentId && removed.has(equipmentId)) return;
      const provenance = provenanceFor(identity, context, generation, {
        sourceMethod: "equipment_snapshot",
        acquisitionMethod: "equipment",
        sourceKind: index < source.entries.length ? source.mode : "dm_override",
      });

      if (entry?.instanceId && inventory?.serializeItemInstance) {
        const serialized = inventory.serializeItemInstance(entry);
        equipment.push(deepFreeze({
          ...serialized,
          provenance: deepFreeze({ ...(serialized.provenance || {}), ...provenance }),
          lootEquipmentSnapshot: true,
          equipmentSource: source.mode,
        }));
        return;
      }

      equipment.push(deepFreeze({
        equipmentId: equipmentId || `equipment_${index}`,
        definitionId: normalizeId(entry?.definitionId ?? entry?.itemId),
        weaponId: normalizeId(entry?.weaponId),
        ammoType: normalizeId(entry?.ammoType),
        range: normalizeId(entry?.range),
        skillId: normalizeId(entry?.skillId),
        source: index < source.entries.length ? source.mode : "dm_override",
        actualInstance: false,
        provenance,
        raw: clone(entry),
      }));
    });

    return deepFreeze({
      source: source.mode,
      items: deepFreeze(equipment),
    });
  }

  function currencyProfile(unit = {}, overrides = {}) {
    return overrides.currency || unit.lootProfile?.currency || null;
  }

  function generateCurrency(unit, identity, context, social, overrides, generation, rng) {
    const profile = currencyProfile(unit, overrides);
    if (!profile) {
      return deepFreeze({
        currencyId: "ahn",
        amount: 0,
        generated: true,
        source: "none",
        provenance: provenanceFor(identity, context, generation, { sourceMethod: "currency_generation" }),
      });
    }

    const currencyId = normalizeId(profile.currencyId ?? profile.id ?? "ahn") || "ahn";
    const fixed = Number.isFinite(Number(profile.amount)) ? Math.max(0, Math.trunc(Number(profile.amount))) : null;
    const baseMin = Math.max(0, Math.trunc(finite(profile.min, 0)));
    const baseMax = Math.max(baseMin, Math.trunc(finite(profile.max, baseMin)));
    const currencyWeight = Math.max(0, finite(remapSocialWeights(social).currency, 1));
    const contextMultiplier = Math.max(0, finite(context.currencyMultiplier, 1));
    const scale = currencyWeight * contextMultiplier;
    const scaledMin = fixed == null ? Math.max(0, Math.floor(baseMin * scale)) : fixed;
    const scaledMax = fixed == null ? Math.max(scaledMin, Math.round(baseMax * scale)) : fixed;
    const amount = fixed == null ? rollInt(rng, scaledMin, scaledMax) : fixed;

    return deepFreeze({
      currencyId,
      amount,
      generated: true,
      source: overrides.currency ? "dm_override" : "unit_profile",
      baseRange: deepFreeze({ min: baseMin, max: baseMax }),
      resolvedRange: deepFreeze({ min: scaledMin, max: scaledMax }),
      zeroAllowed: profile.zeroAllowed !== false,
      provenance: provenanceFor(identity, context, generation, { sourceMethod: "currency_generation" }),
    });
  }

  function harvestAdjustments(overrides = {}) {
    const raw = overrides.harvest || {};
    return {
      removeResourceIds: new Set((raw.removeResourceIds || []).map(normalizeId)),
      setQuantity: raw.setQuantity && typeof raw.setQuantity === "object" ? raw.setQuantity : {},
    };
  }

  function generateHarvest(unit, identity, context, overrides, generation, rng, options = {}) {
    const corpse = corpseRuntime();
    if (!corpse?.resolveCorpseHarvest) {
      return deepFreeze({ generated: false, resources: [], reason: "corpse_harvest_runtime_unavailable" });
    }

    const resolved = corpse.resolveCorpseHarvest(unit, options.damageRecord || unit.damageRecord || null, {
      harvestEngine: options.harvestEngine,
      maxHp: options.maxHp,
    });
    const adjustments = harvestAdjustments(overrides);

    const resources = [...(resolved.resources || [])]
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
      .filter((resource) => !adjustments.removeResourceIds.has(normalizeId(resource.id)))
      .map((resource) => {
        const id = normalizeId(resource.id);
        const authored = adjustments.setQuantity[id];
        const min = Math.max(0, intRange(resource.recoverableYield?.min, 0));
        const max = Math.max(min, intRange(resource.recoverableYield?.max, min));
        const capacity = Number.isFinite(Number(authored))
          ? Math.max(0, Math.trunc(Number(authored)))
          : rollInt(rng, min, max);
        return deepFreeze({
          ...clone(resource),
          capacity,
          remaining: capacity,
          depleted: capacity <= 0,
          provenance: provenanceFor(identity, context, generation, {
            sourceMethod: "corpse_harvest_capacity",
            resourceId: id,
          }),
        });
      });

    return deepFreeze({
      generated: true,
      unitId: resolved.unitId,
      corpseId: identity.corpseId,
      bodyKind: resolved.bodyKind,
      sizeClass: resolved.sizeClass,
      resources: deepFreeze(resources),
      provenance: provenanceFor(identity, context, generation, { sourceMethod: "corpse_harvest_generation" }),
    });
  }

  function sourceSnapshot(unit, social, context, overrides, options = {}) {
    return deepFreeze({
      lootProfile: clone(unit.lootProfile || null),
      bodyProfile: clone(unit.bodyProfile || null),
      wealthProfile: clone(unit.wealthProfile || null),
      roleProfile: clone(unit.roleProfile || null),
      social: clone(social),
      encounterContext: clone(context),
      dmOverrides: clone(overrides),
      damageRecordPresent: Boolean(options.damageRecord || unit.damageRecord),
    });
  }

  function generateLootInstance(unit = {}, options = {}) {
    const identity = identityFor(unit, options);
    const generation = Math.max(0, intRange(options.generation, 0));
    const context = resolveContext(options);
    const social = resolveSocial(unit, options);
    const overrides = normalizeDmOverrides(options.dmOverrides);
    const source = sourceSnapshot(unit, social, context, overrides, options);
    const sourceDigest = hashHex(stableStringify(source));
    const seed = String(options.seed || [
      identity.encounterId,
      identity.sourceUnitId,
      identity.sourceUnitInstanceId,
      identity.corpseId,
      generation,
      sourceDigest,
    ].join("|"));
    const rng = seededRandom(seed);

    const carried = generateCarried(unit, identity, context, social, overrides, generation, rng, options);
    const equipment = snapshotEquipment(unit, identity, context, generation, overrides, options);
    const currency = generateCurrency(unit, identity, context, social, overrides, generation, rng);
    const harvest = generateHarvest(unit, identity, context, overrides, generation, rng, options);
    const lootInstanceId = String(options.lootInstanceId || `loot_${hashHex([
      identity.encounterId,
      identity.sourceUnitInstanceId,
      identity.corpseId,
      generation,
    ].join("|"))}`);

    return deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      runtimeVersion: VERSION,
      lootInstanceId,
      ...identity,
      generation,
      seedHash: hashHex(seed),
      sourceDigest,
      locked: false,
      lockedAt: null,
      generatedAt: options.now == null ? null : Number(options.now),
      carried: carried.items,
      carriedRolls: carried.rolls,
      unresolvedCarriedEntries: carried.unresolved,
      impossibleCategories: carried.impossible,
      equipment,
      currency,
      harvest,
      context: deepFreeze(clone(context)),
      social: deepFreeze(clone(social)),
      dmOverrides: overrides,
      provenance: provenanceFor(identity, context, generation, {
        sourceMethod: "loot_instance_generation",
        sourceDigest,
      }),
    });
  }

  function sameIdentity(instance = {}, identity = {}) {
    return String(instance.encounterId) === String(identity.encounterId)
      && String(instance.sourceUnitId) === String(identity.sourceUnitId)
      && String(instance.sourceUnitInstanceId) === String(identity.sourceUnitInstanceId)
      && String(instance.corpseId) === String(identity.corpseId);
  }

  function ensureLootInstance(existing, unit = {}, options = {}) {
    if (!existing) return generateLootInstance(unit, options);
    const identity = identityFor(unit, options);
    if (!sameIdentity(existing, identity)) throw new Error("LOOT_INSTANCE_IDENTITY_MISMATCH");
    return deepFreeze(clone(existing));
  }

  function regenerateLootInstance(existing, unit = {}, options = {}) {
    if (!existing) return generateLootInstance(unit, options);
    if (existing.locked === true) throw new Error("LOCKED_LOOT_INSTANCE_CANNOT_REGENERATE");
    const identity = identityFor(unit, {
      ...options,
      encounterId: options.encounterId ?? existing.encounterId,
      unitInstanceId: options.unitInstanceId ?? existing.sourceUnitInstanceId,
      corpseId: options.corpseId ?? existing.corpseId,
      unitId: options.unitId ?? existing.sourceUnitId,
    });
    if (!sameIdentity(existing, identity)) throw new Error("LOOT_INSTANCE_IDENTITY_MISMATCH");
    return generateLootInstance(unit, {
      ...options,
      encounterId: identity.encounterId,
      unitInstanceId: identity.sourceUnitInstanceId,
      corpseId: identity.corpseId,
      unitId: identity.sourceUnitId,
      generation: Math.max(0, intRange(existing.generation, 0)) + 1,
    });
  }

  function reconcileAmmoBeforeLock(instance, unit, options = {}) {
    const ammo = ammoRuntime();
    const carried = clone(instance.carried || []);
    const needs = carried.filter((item) => item?.customData?.loot?.reconcilePostCombatAmmo === true);
    if (!needs.length) return carried;
    if (!ammo?.reconcileCarriedAmmo) throw new Error("LOOT_AMMO_RECONCILIATION_RUNTIME_REQUIRED");
    if (!unit) throw new Error("LOOT_AMMO_RECONCILIATION_UNIT_REQUIRED");

    const result = ammo.reconcileCarriedAmmo(unit, needs, options.ammoOptions || {});
    if (!result.reconciled) {
      const reasons = result.errors.map((error) => `${error.ammoId || "unknown"}:${error.reason}`).join("|");
      throw new Error(`LOOT_AMMO_RECONCILIATION_REQUIRED:${reasons}`);
    }

    const reconciledById = new Map(result.entries.map((entry) => [String(entry.instanceId || entry.definitionId), entry]));
    return carried.map((item) => {
      if (item?.customData?.loot?.reconcilePostCombatAmmo !== true) return item;
      return reconciledById.get(String(item.instanceId || item.definitionId)) || item;
    });
  }

  function lockLootInstance(instance = {}, options = {}) {
    if (!instance?.lootInstanceId) throw new Error("LOOT_INSTANCE_REQUIRED");
    if (instance.locked === true) return deepFreeze(clone(instance));

    const carried = reconcileAmmoBeforeLock(instance, options.unit || null, options);
    return deepFreeze({
      ...clone(instance),
      carried,
      locked: true,
      lockedAt: options.now == null ? null : Number(options.now),
      lockReason: String(options.reason || "finalized").trim() || "finalized",
    });
  }

  function validateLootInstance(instance = {}) {
    const errors = [];
    if (intRange(instance.schemaVersion, 0) !== SCHEMA_VERSION) errors.push("LOOT_INSTANCE_SCHEMA_VERSION_INVALID");
    if (!String(instance.lootInstanceId || "").trim()) errors.push("LOOT_INSTANCE_ID_REQUIRED");
    if (!String(instance.encounterId || "").trim()) errors.push("LOOT_INSTANCE_ENCOUNTER_ID_REQUIRED");
    if (!String(instance.sourceUnitId || "").trim()) errors.push("LOOT_INSTANCE_SOURCE_UNIT_ID_REQUIRED");
    if (!String(instance.sourceUnitInstanceId || "").trim()) errors.push("LOOT_INSTANCE_SOURCE_UNIT_INSTANCE_ID_REQUIRED");
    if (!String(instance.corpseId || "").trim()) errors.push("LOOT_INSTANCE_CORPSE_ID_REQUIRED");
    if (!Array.isArray(instance.carried)) errors.push("LOOT_INSTANCE_CARRIED_REQUIRED");
    if (!instance.equipment || !Array.isArray(instance.equipment.items)) errors.push("LOOT_INSTANCE_EQUIPMENT_REQUIRED");
    if (!instance.currency || !Number.isFinite(Number(instance.currency.amount))) errors.push("LOOT_INSTANCE_CURRENCY_REQUIRED");
    if (!instance.harvest || !Array.isArray(instance.harvest.resources)) errors.push("LOOT_INSTANCE_HARVEST_REQUIRED");

    const itemIds = new Set();
    for (const item of instance.carried || []) {
      if (!item?.instanceId) errors.push("LOOT_CARRIED_ITEM_INSTANCE_ID_REQUIRED");
      if (!item?.definitionId) errors.push("LOOT_CARRIED_ITEM_DEFINITION_ID_REQUIRED");
      if (!item?.provenance?.sourceUnitId || !item?.provenance?.encounterId) errors.push("LOOT_CARRIED_ITEM_PROVENANCE_REQUIRED");
      if (item?.instanceId && itemIds.has(item.instanceId)) errors.push(`LOOT_DUPLICATE_ITEM_INSTANCE_ID:${item.instanceId}`);
      if (item?.instanceId) itemIds.add(item.instanceId);
    }

    return deepFreeze({ valid: errors.length === 0, errors: deepFreeze(errors) });
  }

  const API = Object.freeze({
    VERSION,
    SCHEMA_VERSION,
    RARITY_CHANCE,
    normalizeId,
    clone,
    stableNormalize,
    stableStringify,
    hash32,
    hashHex,
    seededRandom,
    rollInt,
    canonicalCategory,
    identityFor,
    resolveZone,
    resolveContext,
    resolveSocial,
    normalizeCandidate,
    normalizeDmOverrides,
    candidatePool,
    impossibleCategories,
    remapSocialWeights,
    chanceForCandidate,
    qualityForCandidate,
    provenanceFor,
    deterministicItemInstanceId,
    generateCarried,
    snapshotEquipment,
    generateCurrency,
    generateHarvest,
    generateLootInstance,
    ensureLootInstance,
    regenerateLootInstance,
    reconcileAmmoBeforeLock,
    lockLootInstance,
    validateLootInstance,
  });

  global.LuminousLootInstanceRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
