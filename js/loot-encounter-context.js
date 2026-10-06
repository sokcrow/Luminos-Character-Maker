(function (global) {
  "use strict";

  if (global.LuminousLootEncounterContext) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootEncounterContext;
    return;
  }

  const VERSION = 1;

  const LOOT_CHANNELS = Object.freeze([
    "currency",
    "food",
    "medicine",
    "consumables",
    "tools",
    "valuables",
    "documents",
    "personal_items",
    "ammunition",
    "materials",
    "technology",
    "luxury",
    "gems",
    "biomaterials",
    "industrial_materials",
  ]);

  const CHANNEL_ALIASES = Object.freeze({
    consumable: "consumables",
    tool: "tools",
    valuable: "valuables",
    document: "documents",
    personal_item: "personal_items",
    material: "materials",
    biomaterial: "biomaterials",
    industrial_material: "industrial_materials",
    gem: "gems",
  });

  const ZONE_PROFILES = Object.freeze({
    forest: Object.freeze({
      id: "forest",
      tags: Object.freeze(["forest", "natural"]),
      weights: Object.freeze({ food: 1.25, biomaterials: 1.45, materials: 1.20, medicine: 0.65, technology: 0.35, gems: 0.20 }),
      impossible: Object.freeze([]),
    }),
    mine: Object.freeze({
      id: "mine",
      tags: Object.freeze(["mine", "industrial", "underground"]),
      weights: Object.freeze({ industrial_materials: 1.70, materials: 1.45, gems: 1.60, tools: 1.35, food: 0.70, medicine: 0.75 }),
      impossible: Object.freeze([]),
    }),
    industrial: Object.freeze({
      id: "industrial",
      tags: Object.freeze(["industrial"]),
      weights: Object.freeze({ industrial_materials: 1.60, materials: 1.35, tools: 1.30, technology: 1.20, food: 0.75, luxury: 0.45 }),
      impossible: Object.freeze([]),
    }),
    hospital: Object.freeze({
      id: "hospital",
      tags: Object.freeze(["hospital", "medical"]),
      weights: Object.freeze({ medicine: 2.40, technology: 1.25, documents: 1.20, tools: 1.15, ammunition: 0.35, luxury: 0.55 }),
      impossible: Object.freeze([]),
    }),
    laboratory: Object.freeze({
      id: "laboratory",
      tags: Object.freeze(["laboratory", "research"]),
      weights: Object.freeze({ technology: 2.00, documents: 1.60, tools: 1.45, medicine: 1.25, industrial_materials: 1.10, food: 0.45 }),
      impossible: Object.freeze([]),
    }),
    ruins: Object.freeze({
      id: "ruins",
      tags: Object.freeze(["ruins"]),
      weights: Object.freeze({ materials: 1.40, valuables: 1.15, documents: 0.75, technology: 0.85, food: 0.45, medicine: 0.50 }),
      impossible: Object.freeze([]),
    }),
    poor_district: Object.freeze({
      id: "poor_district",
      tags: Object.freeze(["district", "poor"]),
      weights: Object.freeze({ currency: 0.45, luxury: 0.15, technology: 0.55, food: 1.10, materials: 1.20, tools: 1.10 }),
      impossible: Object.freeze([]),
    }),
    rich_district: Object.freeze({
      id: "rich_district",
      tags: Object.freeze(["district", "wealthy"]),
      weights: Object.freeze({ currency: 1.45, luxury: 1.80, technology: 1.50, valuables: 1.45, food: 1.10, materials: 0.70 }),
      impossible: Object.freeze([]),
    }),
    swamp: Object.freeze({
      id: "swamp",
      tags: Object.freeze(["swamp", "natural"]),
      weights: Object.freeze({ biomaterials: 1.55, food: 0.85, medicine: 0.85, technology: 0.25, gems: 0.15 }),
      impossible: Object.freeze([]),
    }),
    desert: Object.freeze({
      id: "desert",
      tags: Object.freeze(["desert", "natural"]),
      weights: Object.freeze({ food: 0.55, medicine: 0.70, materials: 1.15, technology: 0.55, gems: 0.70 }),
      impossible: Object.freeze([]),
    }),
    mountain: Object.freeze({
      id: "mountain",
      tags: Object.freeze(["mountain", "natural"]),
      weights: Object.freeze({ materials: 1.35, gems: 1.15, biomaterials: 0.75, food: 0.70, technology: 0.35 }),
      impossible: Object.freeze([]),
    }),
    plains: Object.freeze({
      id: "plains",
      tags: Object.freeze(["plains", "natural"]),
      weights: Object.freeze({ food: 1.10, biomaterials: 1.05, materials: 1.00 }),
      impossible: Object.freeze([]),
    }),
  });

  const EVENT_PROFILES = Object.freeze({
    convoy: Object.freeze({
      id: "convoy",
      tags: Object.freeze(["convoy", "transport"]),
      weights: Object.freeze({ materials: 1.25, consumables: 1.25, documents: 1.10, valuables: 1.10 }),
      allowCategories: Object.freeze([]),
    }),
    robbery: Object.freeze({
      id: "robbery",
      tags: Object.freeze(["robbery"]),
      weights: Object.freeze({ valuables: 1.50, currency: 1.30, luxury: 1.25, documents: 0.80 }),
      allowCategories: Object.freeze([]),
    }),
    famine: Object.freeze({
      id: "famine",
      tags: Object.freeze(["famine"]),
      weights: Object.freeze({ food: 0.30, medicine: 0.70, currency: 0.65, materials: 1.10 }),
      quantityMultiplier: 0.80,
      qualityMultiplier: 0.90,
      allowCategories: Object.freeze([]),
    }),
    war: Object.freeze({
      id: "war",
      tags: Object.freeze(["war"]),
      weights: Object.freeze({ ammunition: 1.80, medicine: 1.45, tools: 1.20, food: 1.10, luxury: 0.35 }),
      allowCategories: Object.freeze(["ammunition"]),
    }),
    evacuation: Object.freeze({
      id: "evacuation",
      tags: Object.freeze(["evacuation"]),
      weights: Object.freeze({ food: 1.35, medicine: 1.25, personal_items: 1.40, documents: 1.15, valuables: 0.85 }),
      allowCategories: Object.freeze([]),
    }),
    plague: Object.freeze({
      id: "plague",
      tags: Object.freeze(["plague", "medical_crisis"]),
      weights: Object.freeze({ medicine: 2.00, food: 0.75, personal_items: 0.65, documents: 1.10 }),
      qualityMultiplier: 0.90,
      allowCategories: Object.freeze(["medicine"]),
    }),
    medical_shipment: Object.freeze({
      id: "medical_shipment",
      tags: Object.freeze(["shipment", "medical"]),
      weights: Object.freeze({ medicine: 2.50, technology: 1.25, tools: 1.20 }),
      quantityMultiplier: 1.25,
      allowCategories: Object.freeze(["medicine"]),
    }),
    mining_expedition: Object.freeze({
      id: "mining_expedition",
      tags: Object.freeze(["expedition", "mining"]),
      weights: Object.freeze({ tools: 1.60, industrial_materials: 1.55, materials: 1.35, gems: 1.65, food: 1.10 }),
      allowCategories: Object.freeze(["gems", "industrial_materials"]),
    }),
    smuggling_operation: Object.freeze({
      id: "smuggling_operation",
      tags: Object.freeze(["smuggling", "black_market"]),
      weights: Object.freeze({ valuables: 1.65, technology: 1.35, consumables: 1.40, luxury: 1.25, documents: 0.55 }),
      allowCategories: Object.freeze(["luxury", "technology"]),
    }),
    laboratory_escape: Object.freeze({
      id: "laboratory_escape",
      tags: Object.freeze(["laboratory", "escape"]),
      weights: Object.freeze({ technology: 1.75, medicine: 1.35, documents: 1.40, biomaterials: 1.30 }),
      allowCategories: Object.freeze(["technology", "biomaterials"]),
    }),
    treasure_expedition: Object.freeze({
      id: "treasure_expedition",
      tags: Object.freeze(["expedition", "treasure"]),
      weights: Object.freeze({ gems: 2.00, valuables: 1.70, luxury: 1.35, tools: 1.10 }),
      allowCategories: Object.freeze(["gems", "valuables", "luxury"]),
    }),
    black_market_deal: Object.freeze({
      id: "black_market_deal",
      tags: Object.freeze(["black_market", "trade"]),
      weights: Object.freeze({ valuables: 1.70, luxury: 1.50, technology: 1.40, consumables: 1.30, currency: 1.15 }),
      allowCategories: Object.freeze(["luxury", "technology", "valuables"]),
    }),
  });

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function uniqueIds(values) {
    const input = Array.isArray(values) ? values : values == null ? [] : [values];
    return [...new Set(input.map(normalizeId).filter(Boolean))];
  }
  function finite(value, fallback = 1) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  function positiveWeight(value, fallback = 1) {
    return Math.max(0, finite(value, fallback));
  }
  function canonicalChannel(value) {
    const id = normalizeId(value);
    return CHANNEL_ALIASES[id] || id;
  }
  function normalizeWeights(weights = {}) {
    const out = {};
    for (const [rawChannel, rawWeight] of Object.entries(weights || {})) {
      const channel = canonicalChannel(rawChannel);
      if (!LOOT_CHANNELS.includes(channel)) continue;
      out[channel] = positiveWeight(rawWeight, 1);
    }
    return Object.freeze(out);
  }
  function normalizeCategories(values) {
    return Object.freeze(uniqueIds(values).map(canonicalChannel).filter((id) => LOOT_CHANNELS.includes(id)));
  }

  function mergeWeights(...sources) {
    const out = {};
    for (const source of sources) {
      for (const [channel, weight] of Object.entries(source || {})) {
        const id = canonicalChannel(channel);
        if (!LOOT_CHANNELS.includes(id)) continue;
        out[id] = (out[id] ?? 1) * positiveWeight(weight, 1);
      }
    }
    return Object.freeze(out);
  }

  function normalizeZoneProfile(input = {}) {
    const presetId = normalizeId(input.profileId ?? input.zoneProfileId ?? input.id);
    const preset = ZONE_PROFILES[presetId] || null;
    const impossible = new Set([
      ...(preset?.impossible || []),
      ...normalizeCategories(input.impossibleCategories),
    ]);
    const allowed = new Set(normalizeCategories(input.allowCategories));
    for (const id of allowed) impossible.delete(id);
    return Object.freeze({
      id: normalizeId(input.id || preset?.id || "encounter_zone"),
      profileId: preset?.id || presetId || null,
      tags: Object.freeze([...new Set([...(preset?.tags || []), ...uniqueIds(input.tags)])]),
      weights: mergeWeights(preset?.weights, normalizeWeights(input.weights ?? input.availability)),
      impossibleCategories: Object.freeze([...impossible]),
      allowCategories: Object.freeze([...allowed]),
      currencyMultiplier: positiveWeight(input.currencyMultiplier, 1),
      quantityMultiplier: positiveWeight(input.quantityMultiplier, 1),
      qualityMultiplier: positiveWeight(input.qualityMultiplier, 1),
      source: normalizeId(input.source || "authored"),
      regional: input.regional && typeof input.regional === "object" ? Object.freeze(clone(input.regional)) : null,
    });
  }

  function validateZoneProfile(input = {}) {
    const errors = [];
    const presetId = normalizeId(input.profileId ?? input.zoneProfileId ?? input.id);
    if (presetId && !ZONE_PROFILES[presetId] && input.allowCustom !== true && !Object.keys(input.weights || input.availability || {}).length && !uniqueIds(input.tags).length) {
      errors.push(`UNKNOWN_ZONE_PROFILE:${presetId}`);
    }
    const impossible = normalizeCategories(input.impossibleCategories);
    const allowed = normalizeCategories(input.allowCategories);
    for (const id of impossible) if (allowed.includes(id)) errors.push(`ZONE_CATEGORY_BOTH_ALLOWED_AND_IMPOSSIBLE:${id}`);
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function normalizeEventProfile(input = {}) {
    const presetId = normalizeId(input.profileId ?? input.eventType ?? input.type ?? input.id);
    const preset = EVENT_PROFILES[presetId] || null;
    const guaranteedItems = (Array.isArray(input.guaranteedItems) ? input.guaranteedItems : []).map((entry) => Object.freeze({
      itemId: normalizeId(entry?.itemId ?? entry?.definitionId ?? entry?.id),
      min: Math.max(1, Math.trunc(finite(entry?.min ?? entry?.quantity, 1))),
      max: Math.max(1, Math.trunc(finite(entry?.max ?? entry?.quantity ?? entry?.min, 1))),
      tags: Object.freeze(uniqueIds(entry?.tags)),
    })).filter((entry) => entry.itemId);
    return Object.freeze({
      id: normalizeId(input.id || preset?.id || "encounter_event"),
      eventType: preset?.id || presetId || null,
      tags: Object.freeze([...new Set([...(preset?.tags || []), ...uniqueIds(input.tags)])]),
      weights: mergeWeights(preset?.weights, normalizeWeights(input.weights)),
      allowCategories: Object.freeze([...new Set([...(preset?.allowCategories || []), ...normalizeCategories(input.allowCategories)])]),
      blockCategories: normalizeCategories(input.blockCategories),
      guaranteedItems: Object.freeze(guaranteedItems),
      quantityMultiplier: positiveWeight(input.quantityMultiplier, preset?.quantityMultiplier ?? 1),
      qualityMultiplier: positiveWeight(input.qualityMultiplier, preset?.qualityMultiplier ?? 1),
      source: normalizeId(input.source || "authored"),
    });
  }

  function validateEventProfile(input = {}) {
    const errors = [];
    const eventType = normalizeId(input.profileId ?? input.eventType ?? input.type ?? input.id);
    const hasCustom = input.allowCustom === true || Object.keys(input.weights || {}).length || uniqueIds(input.tags).length || (Array.isArray(input.guaranteedItems) && input.guaranteedItems.length);
    if (eventType && !EVENT_PROFILES[eventType] && !hasCustom) errors.push(`UNKNOWN_EVENT_PROFILE:${eventType}`);
    for (const entry of Array.isArray(input.guaranteedItems) ? input.guaranteedItems : []) {
      if (!normalizeId(entry?.itemId ?? entry?.definitionId ?? entry?.id)) errors.push("EVENT_GUARANTEED_ITEM_ID_REQUIRED");
    }
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function terrainPreset(terrain) {
    const id = normalizeId(terrain);
    return ZONE_PROFILES[id] ? id : null;
  }

  function deriveZoneFromWorldNode(node = {}, overrides = {}) {
    const metadata = node.metadata && typeof node.metadata === "object" ? node.metadata : {};
    const authored = metadata.lootZone && typeof metadata.lootZone === "object" ? metadata.lootZone : {};
    const terrain = normalizeId(node.terrain ?? node.biome);
    const jurisdiction = normalizeId(node.jurisdiction);
    const profileId = normalizeId(overrides.profileId ?? authored.profileId ?? authored.id ?? terrainPreset(terrain) ?? "");
    return normalizeZoneProfile({
      ...authored,
      ...overrides,
      id: overrides.id || authored.id || node.key || node.zoneId || "regional_zone",
      profileId,
      tags: [
        terrain,
        jurisdiction,
        node.settlementId ? "settlement" : "",
        ...uniqueIds(authored.tags),
        ...uniqueIds(overrides.tags),
      ].filter(Boolean),
      regional: {
        key: node.key ?? null,
        terrain: terrain || null,
        jurisdiction: jurisdiction || null,
        settlementId: node.settlementId ?? null,
      },
      source: overrides.source || authored.source || "regional_world_node",
      allowCustom: true,
    });
  }

  function resolveEncounterContext({ zone = {}, events = [] } = {}) {
    const normalizedZone = normalizeZoneProfile(zone);
    const normalizedEvents = (Array.isArray(events) ? events : []).map(normalizeEventProfile);
    const impossible = new Set(normalizedZone.impossibleCategories);
    const allowed = new Set(normalizedZone.allowCategories);
    const blocked = new Set();

    for (const event of normalizedEvents) {
      for (const category of event.allowCategories) {
        allowed.add(category);
        impossible.delete(category);
        blocked.delete(category);
      }
      for (const category of event.blockCategories) {
        blocked.add(category);
        impossible.add(category);
        allowed.delete(category);
      }
    }

    const weights = mergeWeights(
      normalizedZone.weights,
      ...normalizedEvents.map((event) => event.weights),
    );
    const quantityMultiplier = normalizedEvents.reduce((value, event) => value * event.quantityMultiplier, normalizedZone.quantityMultiplier);
    const qualityMultiplier = normalizedEvents.reduce((value, event) => value * event.qualityMultiplier, normalizedZone.qualityMultiplier);
    const guaranteedItems = normalizedEvents.flatMap((event) => event.guaranteedItems.map((entry) => Object.freeze({
      ...entry,
      provenance: Object.freeze({ eventId: event.id, eventType: event.eventType }),
    })));

    return Object.freeze({
      version: VERSION,
      zone: normalizedZone,
      events: Object.freeze(normalizedEvents),
      tags: Object.freeze([...new Set([
        ...normalizedZone.tags,
        ...normalizedEvents.flatMap((event) => event.tags),
      ])]),
      weights,
      impossibleCategories: Object.freeze([...impossible]),
      allowedCategories: Object.freeze([...allowed]),
      quantityMultiplier,
      qualityMultiplier,
      currencyMultiplier: normalizedZone.currencyMultiplier,
      guaranteedItems: Object.freeze(guaranteedItems),
      provenance: Object.freeze({
        zoneId: normalizedZone.id,
        zoneProfileId: normalizedZone.profileId,
        eventIds: Object.freeze(normalizedEvents.map((event) => event.id)),
        eventTypes: Object.freeze(normalizedEvents.map((event) => event.eventType)),
      }),
    });
  }

  function categoryState(context = {}, category) {
    const id = canonicalChannel(category);
    if (!LOOT_CHANNELS.includes(id)) return Object.freeze({ category: id, state: "unknown", weight: 0 });
    if ((context.impossibleCategories || []).includes(id)) return Object.freeze({ category: id, state: "impossible", weight: 0 });
    const weight = positiveWeight(context.weights?.[id], 1);
    return Object.freeze({
      category: id,
      state: (context.allowedCategories || []).includes(id) ? "allowed_by_exception" : "allowed",
      weight,
    });
  }

  const API = Object.freeze({
    VERSION,
    LOOT_CHANNELS,
    CHANNEL_ALIASES,
    ZONE_PROFILES,
    EVENT_PROFILES,
    normalizeId,
    uniqueIds,
    canonicalChannel,
    normalizeWeights,
    normalizeCategories,
    mergeWeights,
    normalizeZoneProfile,
    validateZoneProfile,
    normalizeEventProfile,
    validateEventProfile,
    terrainPreset,
    deriveZoneFromWorldNode,
    resolveEncounterContext,
    categoryState,
  });

  global.LuminousLootEncounterContext = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
