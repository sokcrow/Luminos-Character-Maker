(function (global) {
  "use strict";

  if (global.LuminousEnchantmentCatalog) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousEnchantmentCatalog;
    return;
  }

  const VERSION = 1;
  const FAMILY = "enchantments";
  const SUPPORTED_RANKS = Object.freeze([1, 2, 3]);
  const BASE_SLOT_COST_BY_RANK = Object.freeze({ 1: 1, 2: 2, 3: 3 });
  const TH_BY_RANK = Object.freeze({ 1: 22, 2: 28, 3: 34 });
  const LABOR_FLOOR_AHN_BY_RANK = Object.freeze({ 1: 750000, 2: 2500000, 3: 7500000 });
  const RANK_FACTOR_BY_RANK = Object.freeze({ 1: 0.75, 2: 1.50, 3: 3.00 });
  const DAMAGE_PERCENT_BY_RANK = Object.freeze({ 1: 10, 2: 15, 3: 25 });
  const SECONDARY_DAMAGE_PERCENT_BY_RANK = Object.freeze({ 1: 4, 2: 8, 3: 18 });

  const ELIGIBLE_ITEM_KINDS = Object.freeze(["weapon", "armor", "shield", "accessory", "valuable"]);
  const APPLIED_SOURCES = Object.freeze(["direct", "gem"]);
  const APPLIED_PROPERTIES = Object.freeze(["bind", "curse"]);

  const EFFECT_TYPES = Object.freeze([
    "damage_percent",
    "secondary_damage_percent",
    "magic_hit",
    "resistance_percent",
    "status_resistance_percent",
    "max_hp_percent",
    "max_sp_percent",
    "speed_percent",
    "initiative_flat",
    "status_apply",
    "spell_grant",
    "passive_flag",
  ]);

  const ACTIVATION_TRIGGERS = Object.freeze([
    "passive",
    "on_hit",
    "on_skill",
    "on_spell",
    "on_damage_received",
    "action",
    "bonus_action",
    "reaction",
    "manual",
    "channel",
    "item_spell",
  ]);

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function normalizeId(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeIds(values) {
    return Object.freeze([...(values || [])].map(normalizeId).filter(Boolean));
  }

  function normalizeKinds(values) {
    const out = [...new Set([...(values || [])].map(normalizeId).filter((id) => ELIGIBLE_ITEM_KINDS.includes(id)))];
    return Object.freeze(out);
  }

  function hasExecutablePayload(value, seen = new Set()) {
    if (typeof value === "function") return true;
    if (!value || typeof value !== "object") return false;
    if (seen.has(value)) return false;
    seen.add(value);
    for (const [key, child] of Object.entries(value)) {
      const id = normalizeId(key);
      if (["eval", "script", "code", "javascript", "handler_function", "function_body"].includes(id)) return true;
      if (hasExecutablePayload(child, seen)) return true;
    }
    return false;
  }

  function normalizeEffect(raw = {}) {
    const type = normalizeId(raw.type);
    const trigger = normalizeId(raw.trigger || "passive");
    const effect = {
      type,
      trigger,
      polarity: normalizeId(raw.polarity || "positive") || "positive",
    };

    const passthrough = [
      "value", "damageType", "statusId", "axis", "spellId", "flag",
      "target", "scope", "duration", "stacks", "magicHitScope",
    ];
    for (const key of passthrough) {
      if (raw[key] !== undefined) effect[key] = clone(raw[key]);
    }

    if (raw.tags !== undefined) effect.tags = normalizeIds(raw.tags);
    return Object.freeze(effect);
  }

  function normalizeRankData(rank, raw = {}) {
    const r = Number(rank);
    return Object.freeze({
      rank: r,
      slotCost: Number.isInteger(Number(raw.slotCost))
        ? Number(raw.slotCost)
        : BASE_SLOT_COST_BY_RANK[r],
      threshold: Number.isFinite(Number(raw.threshold)) ? Number(raw.threshold) : TH_BY_RANK[r],
      laborFloorAhn: Number.isFinite(Number(raw.laborFloorAhn))
        ? Math.max(0, Math.round(Number(raw.laborFloorAhn)))
        : LABOR_FLOOR_AHN_BY_RANK[r],
      rankFactor: Number.isFinite(Number(raw.rankFactor)) ? Number(raw.rankFactor) : RANK_FACTOR_BY_RANK[r],
      effects: Object.freeze((raw.effects || []).map(normalizeEffect)),
      magicalWear: raw.magicalWear == null ? null : Math.max(0, Number(raw.magicalWear) || 0),
    });
  }

  function enchantment(def = {}) {
    const rankData = {};
    for (const rank of SUPPORTED_RANKS) {
      if (!def.rankData?.[rank]) continue;
      rankData[rank] = normalizeRankData(rank, def.rankData[rank]);
    }

    return Object.freeze({
      id: normalizeId(def.id),
      name: String(def.name || "").trim(),
      description: String(def.description || "").trim(),
      family: FAMILY,
      catalogStatus: normalizeId(def.catalogStatus || "core"),
      tags: normalizeIds(def.tags),
      categories: normalizeIds(def.categories),
      eligibleItemKinds: normalizeKinds(def.eligibleItemKinds || ELIGIBLE_ITEM_KINDS),
      ineligibleItemKinds: normalizeKinds(def.ineligibleItemKinds || []),
      allowedEquipmentSlots: normalizeIds(def.allowedEquipmentSlots),
      maxCopiesPerItem: Math.max(1, Math.trunc(Number(def.maxCopiesPerItem) || 1)),
      stacking: normalizeId(def.stacking || "non_stackable"),
      removable: def.removable !== false,
      replaceable: def.replaceable !== false,
      allowedProperties: normalizeIds(def.allowedProperties || APPLIED_PROPERTIES),
      interaction: Object.freeze({
        hardConflicts: normalizeIds(def.interaction?.hardConflicts),
        exclusiveChannel: normalizeId(def.interaction?.exclusiveChannel || ""),
        exclusivePerAction: def.interaction?.exclusivePerAction === true,
        synergizesWith: normalizeIds(def.interaction?.synergizesWith),
      }),
      compatibility: Object.freeze({
        primaryResonances: normalizeIds(def.compatibility?.primaryResonances),
        acceptedResonances: normalizeIds(def.compatibility?.acceptedResonances),
        materialTags: normalizeIds(def.compatibility?.materialTags),
      }),
      recipe: Object.freeze({
        requiredTags: normalizeIds(def.recipe?.requiredTags),
        consumedRequirements: Object.freeze(clone(def.recipe?.consumedRequirements || [])),
      }),
      rankData: Object.freeze(rankData),
    });
  }

  function validateEffect(effect = {}) {
    const errors = [];
    const type = normalizeId(effect.type);
    const trigger = normalizeId(effect.trigger || "passive");
    if (!EFFECT_TYPES.includes(type)) errors.push("unsupported_effect_type");
    if (!ACTIVATION_TRIGGERS.includes(trigger)) errors.push("unsupported_activation_trigger");
    if (hasExecutablePayload(effect)) errors.push("executable_effect_payload_forbidden");
    if (["damage_percent", "secondary_damage_percent", "resistance_percent", "status_resistance_percent", "max_hp_percent", "max_sp_percent", "speed_percent", "initiative_flat"].includes(type)) {
      if (!Number.isFinite(Number(effect.value))) errors.push("effect_value_must_be_numeric");
    }
    if (type === "magic_hit" && effect.value !== undefined && typeof effect.value !== "boolean") {
      errors.push("magic_hit_value_must_be_boolean");
    }
    if (type === "status_apply" && !normalizeId(effect.statusId)) errors.push("status_effect_requires_status_id");
    if (type === "spell_grant" && !normalizeId(effect.spellId)) errors.push("spell_grant_requires_spell_id");
    if (type === "passive_flag" && !normalizeId(effect.flag)) errors.push("passive_flag_requires_flag");
    return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
  }

  function validateDefinition(def = {}) {
    const errors = [];
    const id = normalizeId(def.id);
    if (!id) errors.push("missing_id");
    if (!String(def.name || "").trim()) errors.push("missing_name");
    if (hasExecutablePayload(def)) errors.push("executable_definition_payload_forbidden");

    const eligible = (def.eligibleItemKinds || []).map(normalizeId).filter(Boolean);
    if (!eligible.length) errors.push("missing_eligible_item_kinds");
    if (eligible.some((kind) => !ELIGIBLE_ITEM_KINDS.includes(kind))) errors.push("unsupported_eligible_item_kind");

    const rankKeys = Object.keys(def.rankData || {}).map(Number).filter(Number.isInteger);
    if (!rankKeys.length) errors.push("missing_rank_data");
    for (const rank of rankKeys) {
      if (!SUPPORTED_RANKS.includes(rank)) {
        errors.push("unsupported_rank");
        continue;
      }
      const data = def.rankData[rank];
      if (!data || Number(data.slotCost) !== BASE_SLOT_COST_BY_RANK[rank]) errors.push("rank_slot_cost_mismatch");
      if (!Array.isArray(data.effects)) {
        errors.push("rank_effects_must_be_array");
        continue;
      }
      for (const effect of data.effects) {
        const result = validateEffect(effect);
        if (!result.valid) errors.push(...result.errors.map((error) => `rank_${rank}_${error}`));
      }
    }

    const interaction = def.interaction || {};
    if (interaction.exclusivePerAction === true && !normalizeId(interaction.exclusiveChannel)) {
      errors.push("exclusive_per_action_requires_channel");
    }

    const allowedProperties = (def.allowedProperties || []).map(normalizeId).filter(Boolean);
    if (allowedProperties.some((property) => !APPLIED_PROPERTIES.includes(property))) {
      errors.push("unsupported_applied_property");
    }

    return Object.freeze({
      valid: errors.length === 0,
      id,
      errors: Object.freeze([...new Set(errors)]),
    });
  }

  function R(rank, effects, extra = {}) {
    return {
      slotCost: BASE_SLOT_COST_BY_RANK[rank],
      threshold: TH_BY_RANK[rank],
      laborFloorAhn: LABOR_FLOOR_AHN_BY_RANK[rank],
      rankFactor: RANK_FACTOR_BY_RANK[rank],
      effects,
      ...extra,
    };
  }

  const DEFINITIONS = Object.freeze([
    enchantment({
      id: "flamebound",
      name: "Flamebound",
      description: "Channels an authored fire resonance through the equipped Item.",
      catalogStatus: "core_seed",
      tags: ["elemental", "fire", "heat", "damage"],
      categories: ["offensive", "elemental"],
      eligibleItemKinds: ["weapon"],
      interaction: {
        exclusiveChannel: "elemental_weapon",
        exclusivePerAction: true,
        synergizesWith: ["fire", "heat", "vigor"],
      },
      compatibility: {
        primaryResonances: ["fire"],
        acceptedResonances: ["heat", "vigor"],
      },
      recipe: {
        requiredTags: ["enchantment_material"],
      },
      rankData: {
        1: R(1, [{ type:"damage_percent", trigger:"on_skill", value:DAMAGE_PERCENT_BY_RANK[1], damageType:"fire" }]),
        2: R(2, [{ type:"damage_percent", trigger:"on_skill", value:DAMAGE_PERCENT_BY_RANK[2], damageType:"fire" }]),
        3: R(3, [{ type:"damage_percent", trigger:"on_skill", value:DAMAGE_PERCENT_BY_RANK[3], damageType:"fire" }]),
      },
    }),
    enchantment({
      id: "frostbound",
      name: "Frostbound",
      description: "Channels an authored cold resonance through the equipped Item.",
      catalogStatus: "core_seed",
      tags: ["elemental", "cold", "ice", "damage"],
      categories: ["offensive", "elemental"],
      eligibleItemKinds: ["weapon"],
      interaction: {
        exclusiveChannel: "elemental_weapon",
        exclusivePerAction: true,
        synergizesWith: ["cold", "ice", "focus"],
      },
      compatibility: {
        primaryResonances: ["cold"],
        acceptedResonances: ["ice", "focus"],
      },
      recipe: {
        requiredTags: ["enchantment_material"],
      },
      rankData: {
        1: R(1, [{ type:"damage_percent", trigger:"on_skill", value:DAMAGE_PERCENT_BY_RANK[1], damageType:"cold" }]),
        2: R(2, [{ type:"damage_percent", trigger:"on_skill", value:DAMAGE_PERCENT_BY_RANK[2], damageType:"cold" }]),
        3: R(3, [{ type:"damage_percent", trigger:"on_skill", value:DAMAGE_PERCENT_BY_RANK[3], damageType:"cold" }]),
      },
    }),
  ]);

  const BY_ID = Object.freeze(Object.fromEntries(DEFINITIONS.map((def) => [def.id, def])));

  for (const definition of DEFINITIONS) {
    const validation = validateDefinition(definition);
    if (!validation.valid) throw new Error(`Invalid canonical Enchantment "${definition.id}": ${validation.errors.join(", ")}`);
  }

  function get(id) {
    const found = BY_ID[normalizeId(id)];
    return found ? clone(found) : null;
  }

  function list(options = {}) {
    const tag = normalizeId(options.tag);
    const category = normalizeId(options.category);
    const itemKind = normalizeId(options.itemKind);
    return DEFINITIONS
      .filter((def) => !tag || def.tags.includes(tag))
      .filter((def) => !category || def.categories.includes(category))
      .filter((def) => !itemKind || def.eligibleItemKinds.includes(itemKind))
      .map(clone);
  }

  function resolveRank(definitionOrId, rank) {
    const def = typeof definitionOrId === "string" ? get(definitionOrId) : clone(definitionOrId);
    const r = Number(rank);
    if (!def || !SUPPORTED_RANKS.includes(r) || !def.rankData?.[r]) return null;
    return clone(def.rankData[r]);
  }

  const API = Object.freeze({
    VERSION,
    FAMILY,
    SUPPORTED_RANKS,
    BASE_SLOT_COST_BY_RANK,
    TH_BY_RANK,
    LABOR_FLOOR_AHN_BY_RANK,
    RANK_FACTOR_BY_RANK,
    DAMAGE_PERCENT_BY_RANK,
    SECONDARY_DAMAGE_PERCENT_BY_RANK,
    ELIGIBLE_ITEM_KINDS,
    APPLIED_SOURCES,
    APPLIED_PROPERTIES,
    EFFECT_TYPES,
    ACTIVATION_TRIGGERS,
    DEFINITIONS,
    normalizeId,
    hasExecutablePayload,
    validateEffect,
    validateDefinition,
    get,
    list,
    resolveRank,
  });

  global.LuminousEnchantmentCatalog = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : window);
