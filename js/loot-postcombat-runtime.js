(function (global) {
  "use strict";

  if (global.LuminousLootPostCombatRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousLootPostCombatRuntime;
    return;
  }

  const VERSION = 2;
  const SCHEMA_VERSION = 1;

  const ACTION_PROFILES = Object.freeze({
    search: Object.freeze({ id: "search", checkId: "search", defaultDc: 10 }),
    pickpocket: Object.freeze({ id: "pickpocket", checkId: "pickpocket", defaultDc: 10 }),
    harvest: Object.freeze({ id: "harvest", checkId: "harvest", defaultDc: 10 }),
    extract: Object.freeze({ id: "extract", checkId: "extract", defaultDc: 12 }),
    salvage: Object.freeze({ id: "salvage", checkId: "salvage", defaultDc: 10 }),
    autopsy: Object.freeze({ id: "autopsy", checkId: "autopsy", defaultDc: 12 }),
    examine: Object.freeze({ id: "examine", checkId: "autopsy", defaultDc: 10, defaultSkill: "investigation" }),
  });

  const DELICATE_FAMILIES = Object.freeze(new Set([
    "organ_internal",
    "organ_sensory",
    "organ_brain",
    "organ_gland",
    "venom_secretion",
  ]));

  const SALVAGE_MATERIALS = Object.freeze(new Set([
    "metal",
    "mechanical",
    "stone",
    "mineral",
    "synthetic",
    "crystal",
  ]));

  function checks() { return global.LuminousLootCheckRuntime || null; }
  function inventory() { return global.LuminousItemInventoryRuntime || null; }
  function knowledge() { return global.LuminousLootKnowledgeRuntime || null; }

  function normalizeId(value) {
    return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
    return value;
  }

  function integer(value, fallback = 0) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function actorIdOf(actor = {}, options = {}) {
    return String(
      options.actorId ??
      actor.playerId ??
      actor.uid ??
      actor.actorId ??
      actor.combatId ??
      actor.instanceId ??
      actor.id ??
      ""
    ).trim();
  }

  function requireLockedLootInstance(instance = {}) {
    if (!instance.lootInstanceId) throw new Error("LOOT_INSTANCE_REQUIRED");
    if (instance.locked !== true) throw new Error("LOOT_INSTANCE_MUST_BE_LOCKED_BEFORE_POST_COMBAT");
    return instance;
  }

  function trackedCarried(instance = {}) {
    return deepFreeze((instance.carried || []).map((item) => ({
      instanceId: String(item.instanceId || ""),
      definitionId: String(item.definitionId || ""),
      item: clone(item),
      quantity: Math.max(0, integer(item.quantity, 0)),
      remaining: Math.max(0, integer(item.quantity, 0)),
      discoveredBy: [],
      recoveredBy: [],
    })));
  }

  function trackedResources(instance = {}) {
    return deepFreeze((instance.harvest?.resources || []).map((resource) => ({
      ...clone(resource),
      resourceId: normalizeId(resource.id),
      remaining: Math.max(0, integer(resource.remaining ?? resource.capacity, 0)),
      depleted: Math.max(0, integer(resource.remaining ?? resource.capacity, 0)) <= 0,
      recoveredBy: [],
    })));
  }

  function createInteractionState(instance = {}, options = {}) {
    requireLockedLootInstance(instance);
    return deepFreeze({
      schemaVersion: SCHEMA_VERSION,
      runtimeVersion: VERSION,
      lootInstanceId: instance.lootInstanceId,
      sourceUnitId: instance.sourceUnitId,
      sourceUnitInstanceId: instance.sourceUnitInstanceId,
      corpseId: instance.corpseId,
      encounterId: instance.encounterId,
      sourceDigest: instance.sourceDigest,
      lootGeneration: instance.generation,
      initializedAt: options.now == null ? null : Number(options.now),
      revision: 0,
      carried: trackedCarried(instance),
      currency: deepFreeze({
        currencyId: normalizeId(instance.currency?.currencyId || "ahn") || "ahn",
        amount: Math.max(0, integer(instance.currency?.amount, 0)),
        remaining: Math.max(0, integer(instance.currency?.amount, 0)),
        discoveredBy: [],
        recoveredBy: [],
        provenance: clone(instance.currency?.provenance || {}),
      }),
      equipment: deepFreeze(clone(instance.equipment || { source: "none", items: [] })),
      harvest: deepFreeze({
        bodyKind: normalizeId(instance.harvest?.bodyKind),
        sizeClass: normalizeId(instance.harvest?.sizeClass),
        resources: trackedResources(instance),
      }),
      attempts: deepFreeze([]),
      history: deepFreeze([]),
      pendingDeliveries: deepFreeze([]),
    });
  }

  function attemptKey(actorId, actionId, options = {}) {
    const target = normalizeId(options.targetItemId ?? options.targetResourceId ?? (options.targetCurrency ? "currency" : "general"));
    return `${actorId}|${actionId}|${target || "general"}`;
  }

  function hasAttempted(state = {}, actorId, actionId, options = {}) {
    const key = attemptKey(actorId, actionId, options);
    return (state.attempts || []).some((entry) => entry.key === key);
  }

  // All Loot skill checks require full proficiency in their actual selected
  // skill. Explicit class/trait expertise in the activity can waive +8 TH.
  const UNTRAINED_LOOT_DC = 8;
  const ANATOMY_ACTIONS = Object.freeze(new Set(["harvest", "extract", "autopsy"]));
  const hasGrant = (value, action, skill) => value === true || value === "all" ||
    Array.isArray(value) && (value.includes(action) || value.includes(skill) ||
      ANATOMY_ACTIONS.has(action) && (value.includes("anatomy") || value.includes("medicine"))) ||
    Boolean(value && typeof value === "object" && (
      value.all === true || value[action] === true || value[skill] === true ||
      value.actions?.[action] === true || value.skills?.[skill] === true ||
      ANATOMY_ACTIONS.has(action) && (value.anatomy === true || value.medicine === true)
    ));
  function hasLootKnowledge(actor = {}, actionId = "", skillId = "") {
    const action = normalizeId(actionId), skill = normalizeId(skillId);
    const sources = [
      actor.lootKnowledge, actor.postCombatKnowledge,
      actor.mechanics?.lootKnowledge, actor.classFeatures?.lootKnowledge,
      actor.traitGrants?.lootKnowledge,
    ];
    for (const collection of [
      actor.traits, actor.classTraits, actor.features, actor.generalTraits,
      actor.grantedTraits, actor.classFeatures, actor.mechanics?.traits,
      actor.characterBuild?.traits,
    ]) {
      const features = Array.isArray(collection) ? collection :
        collection && typeof collection === "object" ? Object.values(collection) : [];
      for (const feature of features) {
        if (!feature || typeof feature !== "object") continue;
        sources.push(
          feature.lootKnowledge, feature.postCombatKnowledge,
          feature.grants?.lootKnowledge, feature.grants?.postCombatKnowledge,
          feature.effects?.lootKnowledge,
        );
      }
    }
    return sources.some(grant => hasGrant(grant, action, skill));
  }
  function hasAnatomyKnowledge(actor = {}, actionId = "") {
    const action = normalizeId(actionId);
    return ANATOMY_ACTIONS.has(action) && hasLootKnowledge(actor, action, "medicine");
  }
  function lootSkillForAction(actionId = "", options = {}) {
    const runtime = checks(), action = normalizeId(actionId);
    const profile = ACTION_PROFILES[action];
    if (!profile) return "";
    return normalizeId(options.skill || profile.defaultSkill ||
      runtime?.getCheckProfile?.(profile.checkId)?.defaultSkill || "");
  }
  function lootProficiencyPenalty(actor = {}, actionId = "", options = {}) {
    const skill = lootSkillForAction(actionId, options);
    if (!skill) return 0;
    const state = checks()?.skillProficiencyState?.(actor, skill) || "none";
    if (state === "proficient" || state === "expertise" ||
      hasLootKnowledge(actor, actionId, skill)) return 0;
    return UNTRAINED_LOOT_DC;
  }
  // Existing HUD callers use the original export name.
  function anatomyPenalty(actor = {}, actionId = "", options = {}) {
    return lootProficiencyPenalty(actor, actionId, options);
  }
  function checkDefinition(actor = {}, actionId, options = {}) {
    const runtime = checks();
    if (!runtime?.createLootCheckDefinition) throw new Error("LOOT_CHECK_RUNTIME_REQUIRED");
    const action = normalizeId(actionId), profile = ACTION_PROFILES[action];
    if (!profile) throw new Error(`UNKNOWN_POST_COMBAT_ACTION:${action}`);
    const skill = lootSkillForAction(action, options);
    const surcharge = lootProficiencyPenalty(actor, action, { skill });
    return runtime.createLootCheckDefinition(actor, profile.checkId, {
      threshold: options.threshold ?? options.dc ?? profile.defaultDc,
      thresholdModifier: Number(options.thresholdModifier ?? options.dcModifier ?? 0) + surcharge,
      skill,
      metadata: {
        corpseId: options.corpseId || null,
        targetItemId: options.targetItemId || null,
        targetResourceId: options.targetResourceId || null,
        untrainedSkillPenalty: surcharge,
        requiredProficiencySkill: skill,
      },
    });
  }

  function normalizeCheckResult(definition, provided = {}) {
    if (provided && Number.isFinite(Number(provided.total)) && typeof provided.success === "boolean") {
      return deepFreeze(clone(provided));
    }
    const runtime = checks();
    if (!runtime?.resultFromRoll) throw new Error("LOOT_CHECK_RUNTIME_REQUIRED");
    return runtime.resultFromRoll(definition, provided);
  }

  function recoveryCountFromMargin(result = {}) {
    if (result.success !== true) return 0;
    return Math.max(1, 1 + Math.floor(Math.max(0, Number(result.margin) || 0) / 5));
  }

  function acquisitionProvenance(base = {}, actionId, actorId, state = {}) {
    return deepFreeze({
      ...clone(base),
      acquisitionMethod: actionId,
      acquiredByActorId: actorId,
      lootInstanceId: state.lootInstanceId,
      corpseId: state.corpseId,
      encounterId: state.encounterId,
    });
  }

  function recoveredCarriedItem(entry = {}, actionId, actorId, state = {}) {
    return deepFreeze({
      ...clone(entry.item),
      quantity: entry.remaining,
      provenance: acquisitionProvenance(entry.item?.provenance || {}, actionId, actorId, state),
    });
  }

  function searchCandidates(state = {}, options = {}) {
    const targetId = normalizeId(options.targetItemId);
    const items = (state.carried || []).filter((entry) => {
      if (entry.remaining <= 0) return false;
      if (!targetId) return true;
      return normalizeId(entry.instanceId) === targetId || normalizeId(entry.definitionId) === targetId;
    });
    const includeCurrency = options.targetCurrency === true || (!targetId && options.includeCurrency !== false);
    return {
      items,
      includeCurrency: includeCurrency && Number(state.currency?.remaining || 0) > 0,
    };
  }

  function applySearch(state, actorId, result, options = {}) {
    const next = clone(state);
    const candidates = searchCandidates(state, options);
    const recovered = [];
    let currency = null;
    let slots = recoveryCountFromMargin(result);

    if (result.success === true && slots > 0) {
      for (const candidate of candidates.items) {
        if (slots <= 0) break;
        const index = next.carried.findIndex((entry) => entry.instanceId === candidate.instanceId);
        if (index < 0 || next.carried[index].remaining <= 0) continue;
        const item = recoveredCarriedItem(next.carried[index], "search", actorId, state);
        recovered.push(item);
        next.carried[index].discoveredBy = [...new Set([...(next.carried[index].discoveredBy || []), actorId])];
        next.carried[index].recoveredBy = [...new Set([...(next.carried[index].recoveredBy || []), actorId])];
        next.carried[index].remaining = 0;
        slots -= 1;
      }

      if (candidates.includeCurrency && slots > 0 && next.currency.remaining > 0) {
        currency = deepFreeze({
          currencyId: next.currency.currencyId,
          amount: next.currency.remaining,
          provenance: acquisitionProvenance(next.currency.provenance || {}, "search", actorId, state),
        });
        next.currency.discoveredBy = [...new Set([...(next.currency.discoveredBy || []), actorId])];
        next.currency.recoveredBy = [...new Set([...(next.currency.recoveredBy || []), actorId])];
        next.currency.remaining = 0;
      }
    }

    return {
      next,
      recovery: deepFreeze({
        items: deepFreeze(recovered),
        currency,
        hiddenItemsRemaining: next.carried.filter((entry) => entry.remaining > 0).length,
        currencyRemaining: next.currency.remaining,
      }),
    };
  }

  // Resolve exactly one previously generated carried unit OR the remaining
  // cash. The same state + actor + revision selects the same reward on Firebase
  // transaction retry; the UI never decides which hidden reward was taken.
  function stablePocketIndex(seed, length) {
    let hash = 2166136261;
    for (let i = 0; i < seed.length; i += 1) {
      hash ^= seed.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) % Math.max(1, length);
  }

  function applyPickpocket(state, actorId, result) {
    const next = clone(state);
    const remaining = next.carried
      .map((entry, index) => ({entry, index}))
      .filter(({entry}) => Number(entry.remaining || 0) > 0 && entry.item);
    remaining.sort((a,b)=>String(a.entry.instanceId).localeCompare(String(b.entry.instanceId)));
    const options = remaining.map(row => ({kind:"item", index:row.index}));
    if (Number(next.currency?.remaining || 0) > 0) options.push({kind:"currency"});
    const recovered = [];
    let currency = null;

    if (result.success === true && options.length) {
      const selector = [state.lootInstanceId, state.corpseId, actorId,
        String(state.revision || 0), String(options.length)].join("|");
      const pick = options[stablePocketIndex(selector,options.length)];
      if (pick.kind === "currency") {
        currency = deepFreeze({
          currencyId: next.currency.currencyId,
          amount: next.currency.remaining,
          provenance: acquisitionProvenance(next.currency.provenance || {}, "pickpocket", actorId, state),
        });
        next.currency.discoveredBy = [...new Set([...(next.currency.discoveredBy || []), actorId])];
        next.currency.recoveredBy = [...new Set([...(next.currency.recoveredBy || []), actorId])];
        next.currency.remaining = 0;
      } else {
        const entry = next.carried[pick.index];
        const recoveredItem = {
          ...clone(entry.item),
          quantity: 1,
          // A partially recovered stack remains a separate instance in the
          // corpse. The stolen single unit needs a unique, stable receipt ID.
          instanceId: String(entry.instanceId || entry.item.instanceId || "item") +
            "_pocket_" + stablePocketIndex(selector + "|" + pick.index, 0xFFFFFF).toString(36),
          provenance: acquisitionProvenance(entry.item.provenance || {}, "pickpocket", actorId, state),
        };
        recovered.push(deepFreeze(recoveredItem));
        entry.remaining = Math.max(0, Number(entry.remaining || 0) - 1);
        entry.discoveredBy = [...new Set([...(entry.discoveredBy || []), actorId])];
        entry.recoveredBy = [...new Set([...(entry.recoveredBy || []), actorId])];
        entry.recoveredQuantitiesBy = {
          ...(entry.recoveredQuantitiesBy || {}),
          [actorId]: Math.max(0, Number(entry.recoveredQuantitiesBy?.[actorId] || 0)) + 1,
        };
      }
    }
    return {
      next,
      recovery: deepFreeze({
        items: deepFreeze(recovered),
        currency,
        hiddenItemsRemaining: next.carried.filter(entry => Number(entry.remaining || 0) > 0).length,
        currencyRemaining: Number(next.currency?.remaining || 0),
      }),
    };
  }

  function resourceAction(resource = {}, bodyKind = "") {
    const family = normalizeId(resource.integrityFamily);
    const material = normalizeId(resource.sourceMaterial);
    if (DELICATE_FAMILIES.has(family)) return "extract";
    if (SALVAGE_MATERIALS.has(material) || ["construct", "mineral", "synthetic"].includes(normalizeId(bodyKind))) return "salvage";
    return "harvest";
  }

  function eligibleResources(state = {}, actionId, options = {}) {
    const action = normalizeId(actionId);
    const target = normalizeId(options.targetResourceId);
    return (state.harvest?.resources || []).filter((resource) => {
      if (resource.remaining <= 0) return false;
      if (target && normalizeId(resource.resourceId || resource.id) !== target) return false;
      return resourceAction(resource, state.harvest?.bodyKind) === action;
    });
  }

  function applyResourceAction(state, actorId, actionId, result, options = {}) {
    const next = clone(state);
    const candidates = eligibleResources(state, actionId, options);
    const recovered = [];
    let units = recoveryCountFromMargin(result);

    if (result.success === true && units > 0) {
      for (const candidate of candidates) {
        if (units <= 0) break;
        const index = next.harvest.resources.findIndex((entry) => normalizeId(entry.resourceId || entry.id) === normalizeId(candidate.resourceId || candidate.id));
        if (index < 0) continue;
        const available = Math.max(0, integer(next.harvest.resources[index].remaining, 0));
        if (!available) continue;
        const amount = Math.min(available, units);
        next.harvest.resources[index].remaining = available - amount;
        next.harvest.resources[index].depleted = next.harvest.resources[index].remaining <= 0;
        next.harvest.resources[index].recoveredBy = [...(next.harvest.resources[index].recoveredBy || []), {
          actorId,
          actionId,
          quantity: amount,
        }];
        recovered.push(deepFreeze({
          resourceId: normalizeId(candidate.resourceId || candidate.id),
          quantity: amount,
          itemId: normalizeId(candidate.itemId),
          catalogFamily: normalizeId(candidate.catalogFamily),
          anatomicalIdentity: normalizeId(candidate.anatomicalIdentity),
          lineageId: normalizeId(candidate.lineageId),
          lineageName: candidate.lineageName || null,
          valuable: candidate.valuable === true,
          culinary: candidate.culinary === true,
          knownUses: clone(candidate.knownUses || []),
          tags: clone(candidate.tags || []),
          sizeClass: normalizeId(candidate.sizeClass || state.harvest?.sizeClass),
          integrityFamily: normalizeId(candidate.integrityFamily),
          sourceMaterial: normalizeId(candidate.sourceMaterial),
          integrity: clone(candidate.integrity || null),
          recoverableYield: clone(candidate.recoverableYield || null),
          provenance: acquisitionProvenance(candidate.provenance || {}, actionId, actorId, state),
        }));
        units -= amount;
      }
    }

    return {
      next,
      recovery: deepFreeze({
        resources: deepFreeze(recovered),
        remainingByResource: deepFreeze(Object.fromEntries(next.harvest.resources.map((resource) => [
          normalizeId(resource.resourceId || resource.id),
          resource.remaining,
        ]))),
      }),
    };
  }

  function applyKnowledgeAction(state, actorId, actionId, result, options = {}) {
    const runtime = knowledge();
    if (!runtime?.discoverPostCombatFacts) throw new Error("LOOT_KNOWLEDGE_RUNTIME_REQUIRED");
    const unit = options.unitTruth || options.unit || null;
    if (!unit) throw new Error("POST_COMBAT_UNIT_TRUTH_REQUIRED");
    const sourceUnitId = runtime.canonicalUnitId?.(unit, state.sourceUnitId) || normalizeId(unit.id);
    if (sourceUnitId && normalizeId(state.sourceUnitId) && sourceUnitId !== normalizeId(state.sourceUnitId)) {
      throw new Error("POST_COMBAT_UNIT_TRUTH_MISMATCH");
    }

    const facts = runtime.discoverPostCombatFacts(
      unit,
      state,
      options.lootInstance || {},
      result,
      {
        discoveredBy: actorId,
        discoveredAt: options.now,
        visibility: options.visibility || "private",
        skill: result.skill,
      },
    );

    let compendium = options.compendium ? clone(options.compendium) : null;
    if (compendium && facts.length) {
      compendium = clone(runtime.mergeFacts(compendium, state.sourceUnitId, facts, {
        visibility: options.visibility || "private",
        now: options.now,
      }));
    }

    return {
      next: clone(state),
      recovery: deepFreeze({
        items: deepFreeze([]),
        currency: null,
        resources: deepFreeze([]),
      }),
      knowledge: deepFreeze({
        facts,
        compendium: compendium ? deepFreeze(compendium) : null,
      }),
    };
  }

  function appendAttempt(next, actorId, actionId, result, options = {}, recovery = {}) {
    const entry = {
      key: attemptKey(actorId, actionId, options),
      actorId,
      actionId,
      targetItemId: normalizeId(options.targetItemId) || null,
      targetResourceId: normalizeId(options.targetResourceId) || null,
      targetCurrency: options.targetCurrency === true,
      checkId: result.checkId,
      skill: result.skill,
      ability: result.ability,
      total: result.total,
      threshold: result.threshold,
      success: result.success,
      margin: result.margin,
      recoveredItemIds: (recovery.items || []).map((item) => item.instanceId),
      recoveredCurrency: recovery.currency?.amount || 0,
      recoveredResources: (recovery.resources || []).map((entry) => ({ resourceId: entry.resourceId, quantity: entry.quantity })),
      discoveredFactIds: (recovery.knowledge?.facts || []).map((fact) => fact.id),
    };
    next.attempts.push(entry);
    next.history.push({ type: "post_combat_action", ...entry });
    next.revision = integer(next.revision, 0) + 1;
    return entry;
  }

  function applyResolvedAction(state = {}, actor = {}, actionId, checkResult = {}, options = {}) {
    if (!state?.lootInstanceId) throw new Error("POST_COMBAT_STATE_REQUIRED");
    // RTDB omits empty arrays. Restore them before applying the first action
    // to a persisted corpse, including currency-only search and examination.
    state = clone(state);
    for (const key of ['carried','attempts','history','pendingDeliveries']) state[key] = Array.isArray(state[key]) ? state[key] : Object.values(state[key] || {});
    state.harvest = {...state.harvest,resources:Array.isArray(state.harvest?.resources)?state.harvest.resources:Object.values(state.harvest?.resources||{})};
    const action = normalizeId(actionId);
    if (!ACTION_PROFILES[action]) throw new Error(`UNKNOWN_POST_COMBAT_ACTION:${action}`);
    const actorId = actorIdOf(actor, options);
    if (!actorId) throw new Error("POST_COMBAT_ACTOR_ID_REQUIRED");
    if (hasAttempted(state, actorId, action, options) && options.allowRetry !== true) {
      throw new Error(`POST_COMBAT_ATTEMPT_ALREADY_USED:${attemptKey(actorId, action, options)}`);
    }

    const definition = checkDefinition(actor, action, {
      ...options,
      corpseId: state.corpseId,
    });
    const result = normalizeCheckResult(definition, checkResult);
    const applied = action === "search"
      ? applySearch(state, actorId, result, options)
      : action === "pickpocket"
        ? applyPickpocket(state, actorId, result)
      : (action === "autopsy" || action === "examine")
        ? applyKnowledgeAction(state, actorId, action, result, options)
        : applyResourceAction(state, actorId, action, result, options);

    const next = applied.next;
    const recoveryForAttempt = {
      ...(applied.recovery || {}),
      knowledge: applied.knowledge || null,
    };
    const attempt = appendAttempt(next, actorId, action, result, options, recoveryForAttempt);

    return deepFreeze({
      state: deepFreeze(next),
      result: deepFreeze({
        actionId: action,
        actorId,
        check: result,
        recovery: applied.recovery,
        knowledge: applied.knowledge || null,
        attempt,
      }),
    });
  }

  function performAction(state = {}, actor = {}, actionId, options = {}) {
    const definition = checkDefinition(actor, actionId, { ...options, corpseId: state.corpseId });
    const runtime = checks();
    if (!runtime?.rollCheck) throw new Error("LOOT_CHECK_RUNTIME_REQUIRED");
    const rolled = runtime.rollCheck(definition, { rng: options.rng });
    return applyResolvedAction(state, actor, actionId, rolled, options);
  }

  async function performActionWithCoinEngine(state = {}, actor = {}, actionId, options = {}) {
    const definition = checkDefinition(actor, actionId, { ...options, corpseId: state.corpseId });
    const runtime = checks();
    if (!runtime?.rollCheckWithCoinEngine) throw new Error("LOOT_CHECK_RUNTIME_REQUIRED");
    const rolled = await runtime.rollCheckWithCoinEngine(definition, options);
    return applyResolvedAction(state, actor, actionId, rolled, options);
  }

  function validateState(state = {}) {
    const errors = [];
    if (integer(state.schemaVersion, 0) !== SCHEMA_VERSION) errors.push("POST_COMBAT_SCHEMA_VERSION_INVALID");
    if (!state.lootInstanceId) errors.push("POST_COMBAT_LOOT_INSTANCE_ID_REQUIRED");
    if (!state.corpseId) errors.push("POST_COMBAT_CORPSE_ID_REQUIRED");
    if (!Array.isArray(state.carried)) errors.push("POST_COMBAT_CARRIED_REQUIRED");
    if (!Array.isArray(state.harvest?.resources)) errors.push("POST_COMBAT_HARVEST_REQUIRED");
    return deepFreeze({ valid: errors.length === 0, errors: deepFreeze(errors) });
  }

  const API = Object.freeze({
    VERSION,
    SCHEMA_VERSION,
    ACTION_PROFILES,
    DELICATE_FAMILIES,
    SALVAGE_MATERIALS,
    normalizeId,
    actorIdOf,
    requireLockedLootInstance,
    createInteractionState,
    attemptKey,
    hasAttempted,
    hasAnatomyKnowledge,
    hasLootKnowledge,
    lootSkillForAction,
    lootProficiencyPenalty,
    anatomyPenalty,
    checkDefinition,
    recoveryCountFromMargin,
    acquisitionProvenance,
    searchCandidates,
    stablePocketIndex,
    applyPickpocket,
    resourceAction,
    eligibleResources,
    applyKnowledgeAction,
    applyResolvedAction,
    performAction,
    performActionWithCoinEngine,
    validateState,
  });

  global.LuminousLootPostCombatRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
