(function (global) {
  "use strict";

  const safeRequire = (path) => {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  };

  const goap = global.LuminousIndividualGoapCombatAI || safeRequire("./individual-goap-combat-ai.js");
  const ammoRuntime = () => global.LuminousUniversalRangedAmmoRuntime || safeRequire("./universal-ranged-ammo-runtime.js");
  const spellRuntime = () => global.LuminousSpellcastingRuntime || safeRequire("./spellcasting-runtime.js");

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const clean = (value, fallback = "") => String(value ?? fallback).trim() || fallback;
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  const ACTIONABLE_SOURCE_TYPES = Object.freeze(["skill", "spell", "trait", "item", "universal"]);

  function actorIdOf(actor = {}) {
    return clean(actor.id ?? actor.unitId ?? actor.characterId);
  }

  function sourceIdOf(definition = {}, fallback = "") {
    return clean(definition.id ?? definition.skillId ?? definition.spellId ?? definition.traitId ?? definition.itemId, fallback);
  }

  function resourceCostsOf(definition = {}) {
    return asArray(definition.resourceCosts || definition.resource_costs || definition.resources)
      .filter(Boolean)
      .map((resource) => ({
        owner: normalizeId(resource.owner || "source") || "source",
        type: normalizeId(resource.type || resource.resourceType),
        id: resource.id == null ? null : String(resource.id),
        amount: Math.max(0, finite(resource.amount ?? resource.value, 1)),
        metadata: resource.metadata && typeof resource.metadata === "object" ? clone(resource.metadata) : null,
      }))
      .filter((resource) => resource.type);
  }

  function isPassiveTrait(definition = {}) {
    const type = normalizeId(definition.type || definition.traitType || definition.trait_type);
    const activation = normalizeId(definition.activation || definition.activationType || definition.activation_type);
    if (definition.passive === true || type === "passive") return true;
    if (["active", "action", "quick_action", "reaction"].includes(type)) return false;
    if (["action", "quick_action", "reaction", "combat"].includes(activation)) return false;
    if (definition.combatAction || definition.action || definition.skill || definition.spell) return false;
    return type === "" && activation === "";
  }

  function isCombatItem(entry = {}) {
    const definition = entry.definition || entry.item || entry;
    if (!definition || typeof definition !== "object") return false;
    if (entry.combatAction || definition.combatAction || entry.skill || definition.skill || entry.spell || definition.spell) return true;
    if (definition.isCombatItem === true || definition.combatUsable === true || entry.combatUsable === true) return true;
    const use = normalizeId(definition.useContext || definition.context || definition.activation);
    return ["combat", "action", "quick_action"].includes(use);
  }

  function unwrapActionDefinition(entry = {}, sourceType) {
    if (!entry || typeof entry !== "object") return null;
    if (sourceType === "item") {
      const nested = entry.combatAction || entry.skill || entry.spell || entry.item?.combatAction || entry.item?.skill || entry.item?.spell;
      if (nested && typeof nested === "object") return clone({ ...nested, id: nested.id || entry.id || entry.item?.id });
      return clone(entry.definition || entry.item || entry);
    }
    if (sourceType === "trait") {
      const nested = entry.combatAction || entry.action || entry.trait?.combatAction || entry.trait?.action;
      if (nested && typeof nested === "object") return clone({ ...nested, id: nested.id || entry.id || entry.trait?.id });
      return clone(entry.definition || entry.trait || entry);
    }
    return clone(entry.definition || entry[sourceType] || entry);
  }

  function objectEntriesFrom(actor = {}, keys = []) {
    const entries = [];
    for (const key of keys) {
      for (const entry of asArray(actor[key])) {
        if (entry && typeof entry === "object") entries.push(entry);
      }
    }
    return entries;
  }

  function resolveReference(id, resolver, actor, sourceType) {
    if (!id || typeof resolver !== "function") return null;
    try {
      const value = resolver(id, actor, sourceType);
      return value && typeof value === "object" ? value : null;
    } catch (_) {
      return null;
    }
  }

  function collectSkills(actor = {}, options = {}, unresolved = []) {
    const skills = objectEntriesFrom(actor, [
      "resolvedSkills", "combatSkills", "skills",
      "attack_tier_1_sequence", "attack_tier_2_sequence", "attack_tier_3_sequence",
    ]);

    for (const raw of asArray(actor.action_slots || actor.actionSlots)) {
      if (raw && typeof raw === "object") {
        skills.push(raw);
        continue;
      }
      const id = clean(raw);
      if (!id) continue;
      const resolved = resolveReference(id, options.skillResolver, actor, "skill");
      if (resolved) skills.push(resolved);
      else if (!asArray(actor.resolvedSkills).some((skill) => sourceIdOf(skill) === id)) {
        unresolved.push({ sourceType: "skill", sourceId: id, reason: "skill_definition_unresolved" });
      }
    }
    return skills;
  }

  function collectSpells(actor = {}, options = {}, unresolved = []) {
    const spells = objectEntriesFrom(actor, ["resolvedSpells", "combatSpells", "spells"]);
    const prepared = [actor.preparedSpells, actor.spellcasting?.preparedSpells, actor.spellcasting?.prepared];
    for (const collection of prepared) {
      for (const raw of asArray(collection)) {
        if (raw && typeof raw === "object") {
          spells.push(raw);
          continue;
        }
        const id = clean(raw);
        if (!id) continue;
        const resolved = resolveReference(id, options.spellResolver, actor, "spell");
        if (resolved) spells.push(resolved);
        else unresolved.push({ sourceType: "spell", sourceId: id, reason: "spell_definition_unresolved" });
      }
    }
    return spells;
  }

  function collectTraits(actor = {}, options = {}, unresolved = []) {
    const traits = [];
    for (const raw of asArray(actor.traits || actor.combatTraits || actor.activeTraits)) {
      if (raw && typeof raw === "object") {
        const definition = raw.definition || raw.trait || raw;
        if (!isPassiveTrait(definition)) traits.push(raw);
        continue;
      }
      const id = clean(raw);
      if (!id) continue;
      const resolved = resolveReference(id, options.traitResolver, actor, "trait");
      if (resolved && !isPassiveTrait(resolved)) traits.push(resolved);
      else if (!resolved) unresolved.push({ sourceType: "trait", sourceId: id, reason: "trait_definition_unresolved" });
    }
    return traits;
  }

  function collectItems(actor = {}, options = {}, unresolved = []) {
    const items = [];
    const collections = [actor.combatItems, actor.items, actor.inventory?.active, actor.inventory?.items];
    for (const collection of collections) {
      for (const raw of asArray(collection)) {
        if (raw && typeof raw === "object") {
          if (isCombatItem(raw)) items.push(raw);
          continue;
        }
        const id = clean(raw);
        if (!id) continue;
        const resolved = resolveReference(id, options.itemResolver, actor, "item");
        if (resolved && isCombatItem(resolved)) items.push(resolved);
        else if (!resolved) unresolved.push({ sourceType: "item", sourceId: id, reason: "item_definition_unresolved" });
      }
    }
    return items;
  }

  function collectPendingWeaponRefs(actor = {}, unresolved = []) {
    for (const weapon of asArray(actor.mechanics?.weaponLoadout || actor.weaponLoadout)) {
      if (!weapon || typeof weapon !== "object") continue;
      const id = clean(weapon.skillId || weapon.weaponSkillId || weapon.weaponId || weapon.id);
      if (!id) continue;
      if (weapon.canonicalWeaponSkillPending === true || actor.metadata?.weaponSkillsPendingCanonicalCatalog === true) {
        unresolved.push({ sourceType: "skill", sourceId: id, reason: "canonical_weapon_skill_pending" });
      }
    }
  }

  function normalizeResourceHandlerResult(result, resource) {
    if (result == null) return { known: false, available: true, reason: "resource_validation_unavailable", resource };
    const available = !(result.available === false || result.valid === false || result.canUse === false || result.ok === false);
    return {
      known: true,
      available,
      reason: available ? null : (result.reason || "resource_unavailable"),
      resource,
      detail: clone(result),
    };
  }

  function validateAmmo(actor, definition, resource) {
    const runtime = ammoRuntime();
    if (!runtime) return null;
    if (typeof runtime.ammunitionHandler === "function") {
      const handler = runtime.ammunitionHandler();
      if (handler?.validate) {
        return handler.validate({
          actor,
          resource,
          action: { metadata: { sourceDefinition: definition } },
        });
      }
    }
    if (typeof runtime.ammoCount === "function") {
      const current = runtime.ammoCount(actor, resource.id);
      const required = Math.max(1, finite(resource.amount, 1));
      return { available: current >= required, current, required, reason: current >= required ? null : "ammunition_unavailable" };
    }
    return null;
  }

  function validateSpellSlot(actor, definition, resource) {
    const runtime = spellRuntime();
    if (!runtime?.canSpendSpellSlot) return null;
    const level = Math.max(0, Math.trunc(finite(resource.metadata?.slotLevel ?? definition.slotLevel ?? definition.level ?? definition.spellLevel, 0)));
    try {
      return runtime.canSpendSpellSlot(actor, resource.id, level);
    } catch (_) {
      return { available: false, reason: "spell_slot_validation_failed" };
    }
  }

  function validateResources(actor, sourceType, definition, options = {}) {
    const checks = [];
    for (const resource of resourceCostsOf(definition)) {
      let result = null;
      const direct = options.resourceHandlers?.[resource.type];
      if (direct?.validate) {
        try {
          result = direct.validate({ actor, resource, definition, sourceType });
        } catch (_) {
          result = { available: false, reason: "resource_validation_failed" };
        }
      } else if (resource.type === "ammunition") {
        result = validateAmmo(actor, definition, resource);
      } else if (resource.type === "spell_slot") {
        result = validateSpellSlot(actor, definition, resource);
      }
      const check = normalizeResourceHandlerResult(result, resource);
      checks.push(check);
      if (!check.available) return { available: false, reason: check.reason, checks };
      if (!check.known && options.strictResources === true) {
        return { available: false, reason: "resource_validation_unavailable", checks };
      }
    }
    return { available: true, reason: null, checks };
  }

  function descriptorFor(actor, sourceType, raw, options = {}) {
    const definition = unwrapActionDefinition(raw, sourceType);
    if (!definition) return null;
    const sourceId = sourceIdOf(definition, sourceIdOf(raw));
    if (!sourceId) return null;
    definition.id = sourceId;
    if (!definition.sourceType && sourceType !== "item") definition.sourceType = sourceType;

    const resources = validateResources(actor, sourceType, definition, options);
    return {
      sourceType,
      definition,
      available: resources.available,
      estimate: raw.aiEstimate || definition.aiEstimate || undefined,
      metadata: {
        ...(raw.metadata && typeof raw.metadata === "object" ? clone(raw.metadata) : {}),
        unitAiKitAdapter: true,
        resourceChecks: resources.checks,
      },
      __resourceValidation: resources,
    };
  }

  function dedupeDescriptors(descriptors = []) {
    const seen = new Set();
    const result = [];
    for (const descriptor of descriptors) {
      if (!descriptor) continue;
      const key = `${normalizeId(descriptor.sourceType)}:${normalizeId(sourceIdOf(descriptor.definition))}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(descriptor);
    }
    return result;
  }

  function buildKit(actor = {}, options = {}) {
    const actorId = actorIdOf(actor);
    const unresolved = [];
    collectPendingWeaponRefs(actor, unresolved);

    const collected = [
      ...collectSkills(actor, options, unresolved).map((entry) => ["skill", entry]),
      ...collectSpells(actor, options, unresolved).map((entry) => ["spell", entry]),
      ...collectTraits(actor, options, unresolved).map((entry) => ["trait", entry]),
      ...collectItems(actor, options, unresolved).map((entry) => ["item", entry]),
    ];

    const allSources = dedupeDescriptors(collected.map(([sourceType, entry]) => descriptorFor(actor, sourceType, entry, options)));
    const sources = allSources.filter((source) => source.available !== false);
    const unavailable = allSources
      .filter((source) => source.available === false)
      .map((source) => ({
        sourceType: source.sourceType,
        sourceId: sourceIdOf(source.definition),
        reason: source.__resourceValidation?.reason || "source_unavailable",
        resourceChecks: clone(source.__resourceValidation?.checks || []),
      }));

    return {
      version: "0.1.0",
      actorId,
      sources,
      allSources,
      unavailable,
      unresolved,
      counts: {
        usable: sources.length,
        total: allSources.length,
        unavailable: unavailable.length,
        unresolved: unresolved.length,
      },
    };
  }

  function planUnitTurn(input = {}) {
    if (!goap?.planTurn) return { planned: false, reason: "individual_goap_unavailable", actions: [], sequence: [] };
    const actor = input.actor || {};
    const kit = buildKit(actor, input.kitOptions || input);

    // A healthy Unit with no canonical combat sources must not flee merely because
    // the GOAP injected Escape as its only candidate. Surface the catalog gap instead.
    if (!kit.sources.length && input.allowEscapeOnly !== true) {
      return {
        planned: false,
        reason: kit.unresolved.length ? "unit_combat_sources_unresolved" : "no_unit_combat_sources",
        actorId: kit.actorId,
        kit,
        actions: [],
        sequence: [],
      };
    }

    const plan = goap.planTurn({ ...input, actor, sources: kit.sources });
    return { ...plan, kit };
  }

  const api = Object.freeze({
    version: "0.1.0",
    ACTIONABLE_SOURCE_TYPES,
    actorIdOf,
    resourceCostsOf,
    validateResources,
    buildKit,
    planUnitTurn,
  });

  global.LuminousUnitAiKitAdapter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
