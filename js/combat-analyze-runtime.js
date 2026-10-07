(function (global) {
  "use strict";

  if (global.LuminousCombatAnalyzeRuntime) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousCombatAnalyzeRuntime;
    return;
  }

  function safeRequire(path) {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  }

  const contract = () => global.LuminousCombatAnalyzeCheckContract || safeRequire("./combat-analyze-check-contract.js");
  const checks = () => global.LuminousLootCheckRuntime || safeRequire("./loot-check-runtime.js");
  const knowledge = () => global.LuminousLootKnowledgeRuntime || safeRequire("./loot-knowledge-runtime.js");

  const VERSION = 1;

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
  function entityId(entity = {}) {
    return String(entity.id ?? entity.unitId ?? entity.characterId ?? entity.actorId ?? entity.combatId ?? "").trim();
  }
  function actorKnowledgeId(actor = {}) {
    return String(actor.playerId ?? actor.ownerPlayerId ?? actor.uid ?? actor.actorId ?? actor.id ?? "").trim();
  }
  function asArray(value) {
    return value == null ? [] : (Array.isArray(value) ? value : [value]);
  }
  function uniqueIds(values) {
    return [...new Set(asArray(values).map((entry) => normalizeId(typeof entry === "object" ? (entry.id ?? entry.skillId ?? entry.traitId ?? entry.name) : entry)).filter(Boolean))];
  }
  function isAnalyzeAction(action = {}) {
    const id = normalizeId(action?.source?.id ?? action?.actionId ?? action?.id);
    return action?.source?.type === "universal" && ["analyze", "analyse"].includes(id);
  }

  function speedObservation(target = {}, context = {}) {
    const targetId = entityId(target);
    const explicit = context.observedSpeedByTarget?.[targetId]
      ?? context.observations?.[targetId]?.speed
      ?? target.observationTelemetry?.speed
      ?? target.observedSpeed;
    if (explicit != null) return clone(explicit);

    const min = Number(target.mechanics?.minSpeed ?? target.minSpeed);
    const max = Number(target.mechanics?.maxSpeed ?? target.maxSpeed);
    if (Number.isFinite(min) || Number.isFinite(max)) {
      return {
        min: Number.isFinite(min) ? min : null,
        max: Number.isFinite(max) ? max : null,
      };
    }
    const raw = String(target.mechanics?.speed ?? target.speed ?? "").trim();
    const match = raw.match(/^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (match) return { min: Number(match[1]), max: Number(match[2]) };
    return raw || null;
  }

  function usedSkillsObservation(target = {}, context = {}) {
    const targetId = entityId(target);
    const explicit = [
      context.usedSkillIdsByTarget?.[targetId],
      context.observedSkillsByTarget?.[targetId],
      context.observations?.[targetId]?.usedSkills,
      target.observationTelemetry?.usedSkillIds,
      target.observationTelemetry?.usedSkills,
      target.usedSkillIds,
      target.observedSkills,
    ];
    return uniqueIds(explicit.flatMap(asArray));
  }

  function visibleTraitsObservation(target = {}, context = {}) {
    const targetId = entityId(target);
    const explicit = [
      context.visibleTraitsByTarget?.[targetId],
      context.observations?.[targetId]?.visibleTraits,
      target.observationTelemetry?.visibleTraits,
      target.visibleTraits,
    ];
    const ids = uniqueIds(explicit.flatMap(asArray));
    for (const trait of asArray(target.traits)) {
      if (!trait || typeof trait !== "object") continue;
      if (trait.visible === true || trait.public === true || trait.observable === true || trait.combatVisible === true) {
        const id = normalizeId(trait.id ?? trait.traitId ?? trait.name);
        if (id && !ids.includes(id)) ids.push(id);
      }
    }
    return ids;
  }

  function defenseInteractionsObservation(target = {}, context = {}) {
    const targetId = entityId(target);
    const values = context.defenseInteractionsByTarget?.[targetId]
      ?? context.observations?.[targetId]?.defenseInteractions
      ?? target.observationTelemetry?.defenseInteractions
      ?? target.observedDefenseInteractions
      ?? [];
    return asArray(values)
      .map((entry) => ({
        damageType: normalizeId(entry?.damageType ?? entry?.type),
        observedResult: normalizeId(entry?.observedResult ?? entry?.result ?? entry?.outcome),
      }))
      .filter((entry) => entry.damageType && entry.observedResult);
  }

  function collectObservableFacts(target = {}, context = {}) {
    return deepFreeze({
      sourceUnitId: normalizeId(target.canonicalUnitId ?? target.libraryUnitId ?? target.definitionId ?? target.id),
      encounterId: context.encounterId ?? context.encounter?.id ?? null,
      observationId: context.observationId ?? null,
      speed: speedObservation(target, context),
      usedSkills: usedSkillsObservation(target, context),
      visibleTraits: visibleTraitsObservation(target, context),
      defenseInteractions: defenseInteractionsObservation(target, context),
    });
  }

  function finalPowerBonus(action = {}) {
    return asArray(action.modifiers).reduce((sum, modifier) => {
      if (normalizeId(modifier?.type) !== "final_power") return sum;
      const value = Number(modifier.amount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
  }

  function applyPowerBonus(result = {}, bonus = 0) {
    const amount = Number(bonus);
    if (!Number.isFinite(amount) || amount === 0) return result;
    const threshold = Number.isFinite(Number(result.threshold)) ? Number(result.threshold) : null;
    const total = Number(result.total || 0) + amount;
    return deepFreeze({
      ...clone(result),
      total,
      success: threshold == null ? result.success : total >= threshold,
      margin: threshold == null ? result.margin : total - threshold,
      finalPowerBonus: amount,
    });
  }

  function resolveCheck(actor = {}, action = {}, context = {}) {
    const runtime = checks();
    if (!runtime?.createLootCheckDefinition || !runtime?.rollCheck) {
      return { ok: false, reason: "loot_check_runtime_required" };
    }
    const threshold = Number(action.resolution?.check?.threshold);
    const definition = runtime.createLootCheckDefinition(actor, "analyze", {
      threshold: Number.isFinite(threshold) && threshold > 0 ? threshold : Number(context.analyzeThreshold ?? 10),
      metadata: {
        actionId: action.id || null,
        targetId: action.targeting?.mainTargetId || null,
      },
    });
    const rolled = runtime.rollCheck(definition, { rng: context.random });
    return { ok: true, result: applyPowerBonus(rolled, finalPowerBonus(action)) };
  }

  function automaticResult(source = "generic_analyze", threshold = null) {
    return deepFreeze({
      checkId: "analyze",
      label: "Analyze",
      phase: "combat",
      skill: "perception",
      ability: "wis",
      base: null,
      total: null,
      heads: null,
      tails: null,
      coinCount: 0,
      headBonus: 0,
      headsChance: null,
      threshold: Number.isFinite(Number(threshold)) ? Number(threshold) : null,
      success: true,
      margin: null,
      coins: Object.freeze([]),
      math: null,
      metadata: null,
      engine: "automatic_bypass",
      bypassSource: source,
    });
  }

  function observationEntry(fact, actorId, visibility, source) {
    return {
      id: fact.id,
      section: fact.section,
      key: fact.key,
      value: clone(fact.value),
      discoveredBy: actorId || null,
      visibility,
      source,
      provenance: clone(fact.provenance || {}),
    };
  }

  function mergeObservationKnown(target = {}, facts = [], options = {}) {
    if (!target || typeof target !== "object") return [];
    const actorId = String(options.actorId || "").trim() || null;
    const visibility = normalizeId(options.visibility || "private") || "private";
    const source = normalizeId(options.source || "generic_analyze") || "generic_analyze";
    const existing = Array.isArray(target.observationKnown) ? target.observationKnown : [];
    const next = existing.map(clone);

    for (const fact of facts) {
      const entry = observationEntry(fact, actorId, visibility, source);
      const index = next.findIndex((row) => {
        if (typeof row === "string") return row === fact.id;
        return row?.id === fact.id && (row?.discoveredBy ?? null) === actorId && normalizeId(row?.visibility || "private") === visibility;
      });
      if (index >= 0) next[index] = entry;
      else next.push(entry);
    }
    target.observationKnown = next;
    return clone(next);
  }

  function mergeCompendium(facts = [], target = {}, actor = {}, context = {}, options = {}) {
    const runtime = knowledge();
    if (!runtime?.mergeFacts || !facts.length) return null;
    const local = context.compendium ?? context.localCompendium ?? null;
    if (!local) return null;
    const unitId = runtime.canonicalUnitId?.(target, target.id) || normalizeId(target.id);
    const merged = runtime.mergeFacts(local, unitId, facts, {
      visibility: options.visibility || "private",
      now: context.now,
    });
    if (typeof context.updateCompendium === "function") {
      context.updateCompendium({ actor, target, compendium: merged, facts, visibility: options.visibility || "private" });
    }
    return merged;
  }

  function factsForObservation(observation = {}, target = {}, actor = {}, context = {}, options = {}) {
    const runtime = knowledge();
    if (!runtime?.combatObservationFacts) return [];
    return runtime.combatObservationFacts(observation, target.canonicalUnitId ?? target.libraryUnitId ?? target.definitionId ?? target.id, {
      discoveredBy: actorKnowledgeId(actor),
      discoveredAt: context.now,
      visibility: options.visibility || "private",
    });
  }

  function resolveAnalyze(action = {}, actor = {}, target = {}, context = {}) {
    if (!isAnalyzeAction(action)) return { resolved: false, reason: "not_analyze_action" };
    if (!target) return { resolved: false, reason: "analyze_target_required" };

    const analyzeContract = contract();
    const contractResult = analyzeContract?.resolveAnalyzeContract
      ? analyzeContract.resolveAnalyzeContract(actor, target, {
          ...context,
          threshold: action.resolution?.check?.threshold ?? context.analyzeThreshold ?? 10,
        })
      : { type: "check", check: { stat: "wis", skill: "perception", threshold: context.analyzeThreshold ?? 10 } };

    let check;
    if (contractResult.type === "automatic" || contractResult.bypassCheck === true || contractResult.automaticSuccess === true) {
      check = automaticResult(contractResult.source, action.resolution?.check?.threshold);
    } else {
      const resolved = resolveCheck(actor, action, context);
      if (!resolved.ok) return { resolved: false, reason: resolved.reason };
      check = resolved.result;
    }

    const success = check.success === true;
    const observation = collectObservableFacts(target, context);
    const visibility = normalizeId(action.metadata?.knowledgeVisibility ?? context.knowledgeVisibility ?? "private") || "private";
    const source = normalizeId(contractResult.source || "generic_analyze") || "generic_analyze";
    const facts = success ? factsForObservation(observation, target, actor, context, { visibility }) : [];
    const observationKnown = success
      ? mergeObservationKnown(target, facts, { actorId: actorKnowledgeId(actor), visibility, source })
      : clone(target.observationKnown || []);
    const compendium = success ? mergeCompendium(facts, target, actor, context, { visibility }) : null;

    const result = deepFreeze({
      resolved: true,
      type: contractResult.type === "automatic" ? "automatic_analyze" : "check",
      success,
      check,
      analyzeContract: clone(contractResult),
      observation,
      facts: deepFreeze(clone(facts)),
      observationKnown: deepFreeze(clone(observationKnown)),
      compendium: compendium ? deepFreeze(clone(compendium)) : null,
      visibility,
      source,
    });

    if (typeof context.onAnalyzeResolved === "function") {
      context.onAnalyzeResolved({ action, actor, target, result });
    }
    return result;
  }

  const API = Object.freeze({
    VERSION,
    normalizeId,
    entityId,
    actorKnowledgeId,
    isAnalyzeAction,
    speedObservation,
    usedSkillsObservation,
    visibleTraitsObservation,
    defenseInteractionsObservation,
    collectObservableFacts,
    finalPowerBonus,
    applyPowerBonus,
    resolveCheck,
    automaticResult,
    mergeObservationKnown,
    mergeCompendium,
    factsForObservation,
    resolveAnalyze,
  });

  global.LuminousCombatAnalyzeRuntime = API;
  if (typeof module !== "undefined" && module.exports) module.exports = API;
})(typeof window !== "undefined" ? window : globalThis);
