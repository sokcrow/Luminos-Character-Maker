(function (global) {
  "use strict";

  if (global.LuminousLootKnowledgeRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootKnowledgeRuntime;
    return;
  }

  const VERSION = 1;
  const SCHEMA_VERSION = 1;

  const SECTIONS = Object.freeze(["combat", "biology", "loot", "environment", "stats", "notes"]);
  const VISIBILITY = Object.freeze(["private", "shared", "direct"]);

  const RARITY_LABELS = Object.freeze({
    impossible: "Impossible",
    very_rare: "Very Rare",
    rare: "Rare",
    uncommon: "Uncommon",
    common: "Common",
    likely: "Likely",
    guaranteed: "Guaranteed",
  });

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }
  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }
  function numberOr(value, fallback = 0) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).map((v) => String(v ?? "").trim()).filter(Boolean))];
  }
  function factId(section, key) {
    return `${normalizeId(section)}.${normalizeId(key)}`;
  }
  function canonicalUnitId(unit = {}, fallback = "") {
    return normalizeId(unit.canonicalUnitId ?? unit.libraryUnitId ?? unit.definitionId ?? unit.id ?? fallback);
  }
  function actorIdOf(actor = {}, fallback = "") {
    return String(actor.playerId ?? actor.uid ?? actor.actorId ?? actor.combatId ?? actor.instanceId ?? actor.id ?? fallback).trim();
  }

  function makeFact(section, key, value, options = {}) {
    const normalizedSection = normalizeId(section);
    if (!SECTIONS.includes(normalizedSection)) throw new Error(`UNKNOWN_KNOWLEDGE_SECTION:${normalizedSection}`);
    const normalizedKey = normalizeId(key);
    if (!normalizedKey) throw new Error("KNOWLEDGE_FACT_KEY_REQUIRED");
    return deepFreeze({
      id: factId(normalizedSection, normalizedKey),
      section: normalizedSection,
      key: normalizedKey,
      value: clone(value),
      confidence: Math.max(0, Math.min(1, numberOr(options.confidence, 1))),
      discoveredBy: String(options.discoveredBy || "").trim() || null,
      discoveredAt: options.discoveredAt == null ? null : Number(options.discoveredAt),
      source: normalizeId(options.source || "unknown"),
      provenance: deepFreeze(clone(options.provenance || {})),
      visibility: VISIBILITY.includes(normalizeId(options.visibility)) ? normalizeId(options.visibility) : "private",
    });
  }

  function bodyFacts(unit = {}, options = {}) {
    const body = unit.bodyProfile || {};
    const facts = [];
    const common = { ...options, source: options.source || "autopsy" };
    if (body.kind) facts.push(makeFact("biology", "body_kind", normalizeId(body.kind), common));
    if (body.sizeClass) facts.push(makeFact("biology", "size_class", normalizeId(body.sizeClass), common));
    if (Array.isArray(body.materials) && body.materials.length) {
      facts.push(makeFact("biology", "materials", body.materials.map(normalizeId).filter(Boolean), common));
    }
    if (typeof body.edible === "boolean") facts.push(makeFact("biology", "edible", body.edible, common));
    return facts;
  }

  function harvestFacts(unit = {}, postCombatState = {}, options = {}) {
    const bodyResources = Array.isArray(unit.bodyProfile?.resources) ? unit.bodyProfile.resources : [];
    const stateResources = Array.isArray(postCombatState.harvest?.resources) ? postCombatState.harvest.resources : [];
    const stateMap = new Map(stateResources.map((entry) => [normalizeId(entry.resourceId || entry.id), entry]));
    const facts = [];
    const resources = bodyResources.map((resource) => {
      const id = normalizeId(resource.id ?? resource.integrityFamily);
      const state = stateMap.get(id);
      return {
        id,
        itemId: normalizeId(resource.itemId),
        catalogFamily: normalizeId(resource.catalogFamily),
        integrityFamily: normalizeId(resource.integrityFamily),
        sourceMaterial: normalizeId(resource.sourceMaterial),
        valuable: resource.valuable === true,
        culinary: resource.culinary === true,
        knownUses: uniqueStrings(resource.knownUses || []).map(normalizeId).filter(Boolean),
        knownIntegrity: state?.integrity ? {
          status: normalizeId(state.integrity.status),
          integrityPercent: Number.isFinite(Number(state.integrity.integrityPercent)) ? Number(state.integrity.integrityPercent) : null,
          contaminated: state.integrity.contaminated === true,
        } : null,
      };
    });
    if (resources.length) {
      facts.push(makeFact("biology", "harvestable_resources", resources, {
        ...options,
        source: options.source || "autopsy",
      }));
    }
    return facts;
  }

  function equipmentFacts(postCombatState = {}, options = {}) {
    const items = Array.isArray(postCombatState.equipment?.items) ? postCombatState.equipment.items : [];
    if (!items.length) return [];
    const observed = items.map((entry) => ({
      definitionId: normalizeId(entry.definitionId),
      weaponId: normalizeId(entry.weaponId),
      equipmentId: normalizeId(entry.equipmentId),
      range: normalizeId(entry.range),
      ammoType: normalizeId(entry.ammoType),
      condition: Number.isFinite(Number(entry.condition)) ? Number(entry.condition) : null,
    }));
    return [makeFact("loot", "observed_equipment", observed, {
      ...options,
      source: options.source || "examine",
    })];
  }

  function contextFacts(postCombatState = {}, lootInstance = {}, options = {}) {
    const context = lootInstance.context || options.context || {};
    const facts = [];
    if (context.provenance?.zoneProfileId || context.provenance?.zoneId) {
      const zoneValue = {
        zoneId: context.provenance?.zoneId ?? null,
        zoneProfileId: context.provenance?.zoneProfileId ?? null,
        tags: uniqueStrings(context.tags || []),
      };
      facts.push(makeFact("environment", "encounter_zone", zoneValue, { ...options, source: options.source || "examine" }));
      const variantId = normalizeId(context.provenance?.zoneProfileId || context.provenance?.zoneId);
      if (variantId) facts.push(makeFact("environment", `zone_variant_${variantId}`, zoneValue, { ...options, source: options.source || "examine" }));
    }
    const eventTypes = uniqueStrings(context.provenance?.eventTypes || []);
    if (eventTypes.length) {
      facts.push(makeFact("environment", "encounter_events", eventTypes.map(normalizeId), {
        ...options,
        source: options.source || "examine",
      }));
    }
    return facts;
  }

  function observedLootFacts(postCombatState = {}, options = {}) {
    const facts = [];
    const discoveredItems = (postCombatState.carried || [])
      .filter((entry) => (entry.discoveredBy || []).length || (entry.recoveredBy || []).length || entry.remaining <= 0)
      .map((entry) => normalizeId(entry.definitionId))
      .filter(Boolean);
    if (discoveredItems.length) {
      facts.push(makeFact("loot", "observed_carried_items", [...new Set(discoveredItems)], {
        ...options,
        source: options.source || "search",
      }));
    }
    if ((postCombatState.currency?.discoveredBy || []).length || (postCombatState.currency?.recoveredBy || []).length || postCombatState.currency?.remaining === 0) {
      const amount = numberOr(postCombatState.currency?.amount, 0);
      facts.push(makeFact("loot", "observed_currency", {
        currencyId: normalizeId(postCombatState.currency?.currencyId || "ahn"),
        minObserved: amount,
        maxObserved: amount,
      }, { ...options, source: options.source || "search" }));
    }
    return facts;
  }

  function valuableResourceFacts(unit = {}, options = {}) {
    const resources = (unit.bodyProfile?.resources || [])
      .filter((resource) => resource.valuable === true)
      .map((resource) => ({
        resourceId: normalizeId(resource.id ?? resource.integrityFamily),
        itemId: normalizeId(resource.itemId),
        catalogFamily: normalizeId(resource.catalogFamily),
        knownUses: uniqueStrings(resource.knownUses || []).map(normalizeId).filter(Boolean),
      }));
    if (!resources.length) return [];
    return [makeFact("loot", "valuable_resources", resources, {
      ...options,
      source: options.source || "autopsy_medicine",
    })];
  }

  function resourceUseFacts(unit = {}, options = {}) {
    const resources = (unit.bodyProfile?.resources || [])
      .map((resource) => ({
        resourceId: normalizeId(resource.id ?? resource.integrityFamily),
        itemId: normalizeId(resource.itemId),
        uses: uniqueStrings(resource.knownUses || []).map(normalizeId).filter(Boolean),
      }))
      .filter((resource) => resource.uses.length);
    if (!resources.length) return [];
    return [makeFact("loot", "known_resource_uses", resources, {
      ...options,
      source: options.source || "autopsy_medicine",
    })];
  }

  function edibleResourceFacts(unit = {}, options = {}) {
    if (unit.bodyProfile?.edible !== true) return [];
    const edibleFamilies = new Set(["meat", "ooze_gel", "raw_fiber"]);
    const resources = (unit.bodyProfile?.resources || [])
      .filter((resource) => edibleFamilies.has(normalizeId(resource.integrityFamily)))
      .map((resource) => ({
        resourceId: normalizeId(resource.id ?? resource.integrityFamily),
        integrityFamily: normalizeId(resource.integrityFamily),
        sourceMaterial: normalizeId(resource.sourceMaterial),
      }));
    if (!resources.length) return [];
    return [makeFact("loot", "edible_resources", resources, {
      ...options,
      source: options.source || "autopsy_medicine",
    })];
  }

  function rarityFacts(unit = {}, options = {}) {
    const entries = Array.isArray(unit.lootProfile?.carried) ? unit.lootProfile.carried : [];
    const labels = entries
      .filter((entry) => normalizeId(entry.itemId))
      .map((entry) => ({
        itemId: normalizeId(entry.itemId),
        rarity: normalizeId(entry.rarity || "common"),
        label: RARITY_LABELS[normalizeId(entry.rarity || "common")] || "Common",
      }));
    if (!labels.length) return [];
    return [makeFact("loot", "known_rarity_labels", labels, {
      ...options,
      source: options.source || "investigation",
    })];
  }

  function combatObservationFacts(observation = {}, unitId = "", options = {}) {
    const common = {
      discoveredBy: options.discoveredBy || null,
      discoveredAt: options.discoveredAt,
      visibility: options.visibility || "private",
      source: "combat_observation",
      provenance: {
        sourceUnitId: normalizeId(unitId || observation.sourceUnitId),
        encounterId: observation.encounterId || null,
        observationId: observation.observationId || null,
      },
    };
    const facts = [];
    if (observation.speed != null) facts.push(makeFact("combat", "observed_speed", clone(observation.speed), common));
    const skills = uniqueStrings(observation.usedSkills || observation.skills).map(normalizeId).filter(Boolean);
    if (skills.length) facts.push(makeFact("combat", "observed_skills", skills, common));
    const traits = uniqueStrings(observation.visibleTraits || observation.traits).map(normalizeId).filter(Boolean);
    if (traits.length) facts.push(makeFact("combat", "visible_traits", traits, common));
    const defenses = Array.isArray(observation.defenseInteractions) ? observation.defenseInteractions.map((entry) => ({
      damageType: normalizeId(entry.damageType),
      observedResult: normalizeId(entry.observedResult || entry.result),
    })).filter((entry) => entry.damageType && entry.observedResult) : [];
    if (defenses.length) facts.push(makeFact("combat", "observed_defense_interactions", defenses, common));
    return deepFreeze(facts);
  }

  function highMarginStatFacts(unit = {}, check = {}, skill = "", options = {}) {
    if (check.success !== true || numberOr(check.margin, 0) < 10) return [];
    const scores = unit.scores || unit.stats || {};
    const normalizedSkill = normalizeId(skill);
    const facts = [];
    if (normalizedSkill === "medicine" && Number.isFinite(Number(scores.con))) {
      facts.push(makeFact("stats", "constitution_score", Number(scores.con), {
        ...options,
        source: "autopsy_medicine_high_margin",
        confidence: 1,
      }));
    }
    if (normalizedSkill === "investigation" && Number.isFinite(Number(unit.defensiveLevel ?? unit.mechanics?.defensiveLevel))) {
      facts.push(makeFact("stats", "defensive_level", Number(unit.defensiveLevel ?? unit.mechanics?.defensiveLevel), {
        ...options,
        source: "examine_investigation_high_margin",
        confidence: 1,
      }));
    }
    return facts;
  }

  function discoverPostCombatFacts(unit = {}, postCombatState = {}, lootInstance = {}, check = {}, options = {}) {
    if (check.success !== true) return deepFreeze([]);
    const skill = normalizeId(check.skill || options.skill);
    const sourceUnitId = canonicalUnitId(unit, postCombatState.sourceUnitId);
    const provenance = {
      sourceUnitId,
      sourceUnitInstanceId: postCombatState.sourceUnitInstanceId || lootInstance.sourceUnitInstanceId || null,
      corpseId: postCombatState.corpseId || lootInstance.corpseId || null,
      encounterId: postCombatState.encounterId || lootInstance.encounterId || null,
      lootInstanceId: postCombatState.lootInstanceId || lootInstance.lootInstanceId || null,
      checkId: check.checkId || null,
      skill,
      total: check.total,
      threshold: check.threshold,
      margin: check.margin,
    };
    const common = {
      discoveredBy: options.discoveredBy || null,
      discoveredAt: options.discoveredAt,
      visibility: options.visibility || "private",
      provenance,
    };

    let facts = [];
    if (skill === "medicine") {
      facts = [
        ...bodyFacts(unit, { ...common, source: "autopsy_medicine" }),
        ...harvestFacts(unit, postCombatState, { ...common, source: "autopsy_medicine" }),
        ...valuableResourceFacts(unit, { ...common, source: "autopsy_medicine" }),
        ...resourceUseFacts(unit, { ...common, source: "autopsy_medicine" }),
        ...edibleResourceFacts(unit, { ...common, source: "autopsy_medicine" }),
      ];
    } else if (skill === "investigation") {
      facts = [
        ...equipmentFacts(postCombatState, { ...common, source: "examine_investigation" }),
        ...contextFacts(postCombatState, lootInstance, { ...common, source: "examine_investigation" }),
        ...observedLootFacts(postCombatState, { ...common, source: "examine_investigation" }),
        ...rarityFacts(unit, { ...common, source: "examine_investigation" }),
      ];
    }
    facts.push(...highMarginStatFacts(unit, check, skill, common));
    return deepFreeze(facts);
  }

  function materializedLootFacts(items = [], options = {}) {
    const knownUses = [];
    const valuable = [];

    for (const item of Array.isArray(items) ? items : []) {
      const itemId = normalizeId(item.definitionId ?? item.itemId ?? item.id);
      if (!itemId) continue;
      const harvest = item.customData?.harvest || {};
      const def = harvest.definition || {};
      const tags = new Set([...(def.tags || []), ...(item.tags || [])].map(normalizeId).filter(Boolean));
      const useTags = [...(def.useTags || []), ...(item.useTags || [])].map(normalizeId).filter(Boolean);
      const family = normalizeId(def.family || item.family);
      const category = normalizeId(def.category || item.category);
      const itemType = normalizeId(def.itemType || item.itemType);

      const uses = new Set();
      if (def.edibleRaw === true || family === "meat" || tags.has("meat") || item.culinaryAffinityProfileId || (item.culinaryProperties || []).length) {
        uses.add("cooking");
      }
      if (def.rawCraftingReagent === true || itemType === "material" || tags.has("crafting_input") || useTags.length) {
        uses.add("crafting");
      }
      if (uses.size) {
        knownUses.push({
          itemId,
          uses: [...uses],
          useTags,
        });
      }

      const medicalStandard = Number(def.transplantMedicalStandardMediumValueAhn);
      const medicalRange = def.transplantMedicalRangeAhn;
      const valuableTags = ["rare", "exotic", "precious", "precious_metal", "gemstone"];
      const taggedValuable = valuableTags.some((tag) => tags.has(tag));
      const medicallyValuable = Number.isFinite(medicalStandard) || (medicalRange && (medicalRange.minAhn != null || medicalRange.maxAhn != null));
      if (taggedValuable || medicallyValuable) {
        valuable.push({
          itemId,
          reasons: [
            ...(medicallyValuable ? ["medical_value"] : []),
            ...(taggedValuable ? ["rare_or_exotic_material"] : []),
          ],
          medicalValueAhn: Number.isFinite(medicalStandard) ? medicalStandard : null,
          medicalRangeAhn: clone(medicalRange || null),
          observedUnitValueAhn: numberOr(def.unitValueAhn, 0) || null,
        });
      }
    }

    const facts = [];
    if (knownUses.length) {
      facts.push(makeFact("loot", "known_uses", knownUses, {
        ...options,
        source: options.source || "materialized_recovery",
      }));
    }
    if (valuable.length) {
      facts.push(makeFact("loot", "valuable_organs_materials", valuable, {
        ...options,
        source: options.source || "materialized_recovery",
      }));
    }
    return deepFreeze(facts);
  }

  function createCompendium(playerId, options = {}) {
    const id = String(playerId || "").trim();
    if (!id) throw new Error("COMPENDIUM_PLAYER_ID_REQUIRED");
    return deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      playerId: id,
      updatedAt: options.now == null ? null : Number(options.now),
      units: {},
    });
  }

  function entryFor(compendium = {}, unitId, create = false) {
    const id = normalizeId(unitId);
    const existing = compendium.units?.[id];
    if (existing) return clone(existing);
    if (!create) return null;
    return {
      unitId: id,
      facts: {},
      notes: [],
      updatedAt: null,
    };
  }

  function mergeArrayByKey(prior = [], next = [], keyFn) {
    const map = new Map();
    for (const value of [...(prior || []), ...(next || [])]) map.set(keyFn(value), clone(value));
    return [...map.values()];
  }

  function mergeFactValue(priorFact, nextFact) {
    const id = String(nextFact?.id || "");
    const prior = priorFact?.value;
    const next = nextFact?.value;

    if (id === "loot.observed_carried_items" && Array.isArray(next)) {
      return [...new Set([...(Array.isArray(prior) ? prior : []), ...next].map(normalizeId).filter(Boolean))];
    }
    if (id === "loot.observed_currency" && next && typeof next === "object") {
      if (!prior || normalizeId(prior.currencyId) !== normalizeId(next.currencyId)) return clone(next);
      return {
        currencyId: normalizeId(next.currencyId),
        minObserved: Math.min(numberOr(prior.minObserved, next.minObserved), numberOr(next.minObserved, prior.minObserved)),
        maxObserved: Math.max(numberOr(prior.maxObserved, next.maxObserved), numberOr(next.maxObserved, prior.maxObserved)),
      };
    }
    if (id === "loot.observed_equipment" && Array.isArray(next)) {
      return mergeArrayByKey(Array.isArray(prior) ? prior : [], next, (entry) => JSON.stringify([
        normalizeId(entry.definitionId),
        normalizeId(entry.weaponId),
        normalizeId(entry.equipmentId),
        normalizeId(entry.range),
        normalizeId(entry.ammoType),
      ]));
    }
    if (id === "biology.harvestable_resources" && Array.isArray(next)) {
      return mergeArrayByKey(Array.isArray(prior) ? prior : [], next, (entry) => normalizeId(entry.id || entry.resourceId || entry.integrityFamily));
    }
    if (id === "loot.edible_resources" && Array.isArray(next)) {
      return mergeArrayByKey(Array.isArray(prior) ? prior : [], next, (entry) => normalizeId(entry.resourceId || entry.integrityFamily));
    }
    if (id === "loot.known_rarity_labels" && Array.isArray(next)) {
      return mergeArrayByKey(Array.isArray(prior) ? prior : [], next, (entry) => normalizeId(entry.itemId));
    }
    if (id === "loot.known_uses" && Array.isArray(next)) {
      return mergeArrayByKey(Array.isArray(prior) ? prior : [], next, (entry) => normalizeId(entry.itemId));
    }
    if (id === "loot.valuable_organs_materials" && Array.isArray(next)) {
      return mergeArrayByKey(Array.isArray(prior) ? prior : [], next, (entry) => normalizeId(entry.itemId));
    }
    return clone(next);
  }

  function mergeFacts(compendium = {}, unitId, facts = [], options = {}) {
    const id = normalizeId(unitId);
    if (!id) throw new Error("COMPENDIUM_UNIT_ID_REQUIRED");
    const next = clone(compendium);
    next.units = next.units || {};
    const entry = entryFor(next, id, true);
    entry.facts = entry.facts || {};
    for (const raw of facts || []) {
      const fact = clone(raw);
      if (!fact?.id || !SECTIONS.includes(normalizeId(fact.section))) continue;
      const prior = entry.facts[fact.id];
      entry.facts[fact.id] = {
        ...(prior || {}),
        ...fact,
        value: mergeFactValue(prior, fact),
        provenance: clone(fact.provenance || prior?.provenance || {}),
        visibility: normalizeId(options.visibility || fact.visibility || prior?.visibility || "private"),
      };
    }
    entry.updatedAt = options.now == null ? entry.updatedAt ?? null : Number(options.now);
    next.units[id] = entry;
    next.updatedAt = options.now == null ? next.updatedAt ?? null : Number(options.now);
    return deepFreeze(next);
  }

  function addNote(compendium = {}, unitId, note = {}, options = {}) {
    const authorId = String(note.authorId || options.authorId || compendium.playerId || "").trim();
    const text = String(note.text || "").trim();
    if (!authorId) throw new Error("COMPENDIUM_NOTE_AUTHOR_REQUIRED");
    if (!text) throw new Error("COMPENDIUM_NOTE_TEXT_REQUIRED");
    const id = normalizeId(unitId);
    const next = clone(compendium);
    next.units = next.units || {};
    const entry = entryFor(next, id, true);
    const noteId = String(note.id || `note_${authorId}_${Number(options.now ?? note.createdAt ?? Date.now())}`);
    entry.notes = [...(entry.notes || []), {
      id: noteId,
      authorId,
      text,
      createdAt: options.now == null ? (note.createdAt ?? null) : Number(options.now),
      visibility: VISIBILITY.includes(normalizeId(note.visibility)) ? normalizeId(note.visibility) : "private",
    }];
    entry.updatedAt = options.now == null ? entry.updatedAt ?? null : Number(options.now);
    next.units[id] = entry;
    next.updatedAt = options.now == null ? next.updatedAt ?? null : Number(options.now);
    return deepFreeze(next);
  }

  function selectFacts(entry = {}, factIds = null) {
    const facts = Object.values(entry.facts || {});
    if (!Array.isArray(factIds) || !factIds.length) return facts;
    const wanted = new Set(factIds.map((id) => String(id)));
    return facts.filter((fact) => wanted.has(fact.id));
  }

  function shareFacts(local = {}, shared = {}, unitId, factIds = null, options = {}) {
    const source = entryFor(local, unitId, false);
    if (!source) return deepFreeze(clone(shared));
    const facts = selectFacts(source, factIds).map((fact) => ({
      ...clone(fact),
      visibility: "shared",
      provenance: {
        ...clone(fact.provenance || {}),
        sharedBy: String(options.sharedBy || local.playerId || "").trim() || null,
        sharedAt: options.now == null ? null : Number(options.now),
      },
    }));
    return mergeFacts(shared, unitId, facts, { visibility: "shared", now: options.now });
  }

  function transferFacts(local = {}, recipient = {}, unitId, factIds = null, options = {}) {
    const source = entryFor(local, unitId, false);
    if (!source) return deepFreeze(clone(recipient));
    const facts = selectFacts(source, factIds).map((fact) => ({
      ...clone(fact),
      visibility: "direct",
      provenance: {
        ...clone(fact.provenance || {}),
        transferredBy: String(options.transferredBy || local.playerId || "").trim() || null,
        transferredTo: String(recipient.playerId || "").trim() || null,
        transferredAt: options.now == null ? null : Number(options.now),
      },
    }));
    return mergeFacts(recipient, unitId, facts, { visibility: "direct", now: options.now });
  }

  function shareNotes(local = {}, shared = {}, unitId, noteIds = null, options = {}) {
    const source = entryFor(local, unitId, false);
    if (!source) return deepFreeze(clone(shared));
    const wanted = Array.isArray(noteIds) && noteIds.length ? new Set(noteIds.map(String)) : null;
    let next = clone(shared);
    for (const note of source.notes || []) {
      if (wanted && !wanted.has(String(note.id))) continue;
      next = clone(addNote(next, unitId, {
        ...clone(note),
        id: note.id,
        authorId: note.authorId,
        visibility: "shared",
      }, { now: note.createdAt }));
    }
    return deepFreeze(next);
  }

  function persistencePaths(playerId, options = {}) {
    const campaignRoot = String(options.campaignRoot || "campaña").replace(/\/+$/g, "");
    const player = String(playerId || "").trim();
    if (!player) throw new Error("COMPENDIUM_PLAYER_ID_REQUIRED");
    return deepFreeze({
      local: `${campaignRoot}/jugadores/${player}/compendium`,
      shared: `${campaignRoot}/compendium_shared`,
    });
  }

  function databaseFrom(options = {}) {
    if (options.database) return options.database;
    if (global.firebase?.database) {
      try { return global.firebase.database(); } catch (_) {}
    }
    return null;
  }

  async function writePath(path, value, options = {}) {
    const db = databaseFrom(options);
    if (!db) throw new Error("COMPENDIUM_DATABASE_REQUIRED");
    if (typeof db.ref === "function") {
      const ref = db.ref(path);
      if (typeof ref.set === "function") return ref.set(clone(value));
      if (typeof ref.update === "function") return ref.update(clone(value));
    }
    if (typeof db.set === "function") return db.set(path, clone(value));
    if (typeof db.update === "function") return db.update(path, clone(value));
    throw new Error("COMPENDIUM_DATABASE_WRITE_UNSUPPORTED");
  }

  async function persistLocal(compendium, options = {}) {
    const path = persistencePaths(compendium.playerId, options).local;
    await writePath(path, compendium, options);
    return deepFreeze({ path, saved: true });
  }

  async function persistShared(shared, ownerPlayerId, options = {}) {
    const path = persistencePaths(ownerPlayerId, options).shared;
    await writePath(path, shared, options);
    return deepFreeze({ path, saved: true });
  }

  function validateCompendium(compendium = {}) {
    const errors = [];
    if (Number(compendium.schemaVersion) !== SCHEMA_VERSION) errors.push("COMPENDIUM_SCHEMA_VERSION_INVALID");
    if (!String(compendium.playerId || "").trim()) errors.push("COMPENDIUM_PLAYER_ID_REQUIRED");
    if (!compendium.units || typeof compendium.units !== "object") errors.push("COMPENDIUM_UNITS_REQUIRED");
    for (const [unitId, entry] of Object.entries(compendium.units || {})) {
      if (normalizeId(unitId) !== normalizeId(entry.unitId)) errors.push(`COMPENDIUM_UNIT_ID_MISMATCH:${unitId}`);
      for (const fact of Object.values(entry.facts || {})) {
        if (!SECTIONS.includes(normalizeId(fact.section))) errors.push(`COMPENDIUM_UNKNOWN_FACT_SECTION:${fact.section}`);
      }
      for (const note of entry.notes || []) {
        if (!note.authorId) errors.push(`COMPENDIUM_NOTE_AUTHOR_REQUIRED:${unitId}`);
      }
    }
    return deepFreeze({ valid: errors.length === 0, errors: deepFreeze(errors) });
  }

  const API = Object.freeze({
    VERSION,
    SCHEMA_VERSION,
    SECTIONS,
    VISIBILITY,
    RARITY_LABELS,
    normalizeId,
    factId,
    canonicalUnitId,
    actorIdOf,
    makeFact,
    bodyFacts,
    harvestFacts,
    equipmentFacts,
    contextFacts,
    observedLootFacts,
    valuableResourceFacts,
    resourceUseFacts,
    edibleResourceFacts,
    rarityFacts,
    combatObservationFacts,
    highMarginStatFacts,
    discoverPostCombatFacts,
    materializedLootFacts,
    createCompendium,
    entryFor,
    mergeArrayByKey,
    mergeFactValue,
    mergeFacts,
    addNote,
    selectFacts,
    shareFacts,
    transferFacts,
    shareNotes,
    persistencePaths,
    writePath,
    persistLocal,
    persistShared,
    validateCompendium,
  });

  global.LuminousLootKnowledgeRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
