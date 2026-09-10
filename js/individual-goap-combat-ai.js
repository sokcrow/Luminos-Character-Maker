(function (global) {
  "use strict";

  const adapters = global.LuminousCombatActionAdapters || null;
  const schema = global.LuminousCombatAction || null;
  if (!adapters || !schema) return;

  const GOALS = Object.freeze({
    KILL_TARGET: "kill_target",
    SURVIVE: "survive",
    ESCAPE: "escape",
    PROTECT_SELF: "protect_self",
    RECOVER_RESOURCE: "recover_resource",
    GAIN_ADVANTAGE: "gain_advantage",
  });

  const SOURCE_TYPES = Object.freeze(["skill", "spell", "trait", "item", "universal"]);
  const MAX_PLANNED_SLOTS = 12;
  const INTEL_SCHEMA_VERSION = 1;

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const integer = (value, fallback = 0) => Math.trunc(finite(value, fallback));
  const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));
  const clean = (value, fallback = "") => String(value ?? fallback).trim() || fallback;
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);

  function actorIdOf(actor = {}) {
    return clean(actor.id ?? actor.unitId ?? actor.characterId);
  }

  function abilityScore(actor = {}, longName, shortName, fallback = 10) {
    const sources = [actor.scores, actor.abilityScores, actor.stats, actor.attributes, actor];
    for (const source of sources) {
      if (!source || typeof source !== "object") continue;
      const value = source[shortName] ?? source[longName] ?? source[longName.toUpperCase()];
      if (Number.isFinite(Number(value))) return clamp(value, 1, 30);
    }
    return fallback;
  }

  function ownHpRatio(actor = {}) {
    const hp = Math.max(0, finite(actor.hp ?? actor.currentHp ?? actor.currentHP, 0));
    const maxHp = Math.max(1, finite(actor.maxHp ?? actor.maxHP ?? actor.hpMax ?? actor.mechanics?.maxHp, hp || 1));
    return clamp(hp / maxHp, 0, 1);
  }

  function planningProfile(intelligenceRaw) {
    const intelligence = clamp(intelligenceRaw, 1, 30);
    if (intelligence <= 6) return Object.freeze({ intelligence, candidateLimit: 2, beamWidth: 2, comboAwareness: 0, intelAwareness: 0.05 });
    if (intelligence <= 9) return Object.freeze({ intelligence, candidateLimit: 3, beamWidth: 2, comboAwareness: 0, intelAwareness: 0.20 });
    if (intelligence <= 12) return Object.freeze({ intelligence, candidateLimit: 4, beamWidth: 3, comboAwareness: 0.20, intelAwareness: 0.40 });
    if (intelligence <= 15) return Object.freeze({ intelligence, candidateLimit: 6, beamWidth: 4, comboAwareness: 0.50, intelAwareness: 0.65 });
    if (intelligence <= 19) return Object.freeze({ intelligence, candidateLimit: 8, beamWidth: 6, comboAwareness: 0.80, intelAwareness: 0.90 });
    return Object.freeze({ intelligence, candidateLimit: 10, beamWidth: 8, comboAwareness: 1, intelAwareness: 1 });
  }

  function wisdomProfile(wisdomRaw) {
    const wisdom = clamp(wisdomRaw, 1, 30);
    return Object.freeze({
      wisdom,
      escapeHpRatio: clamp(0.12 + wisdom * 0.012, 0.13, 0.42),
      dangerWeight: 0.65 + wisdom / 20,
      resourceConservation: clamp((wisdom - 5) / 20, 0, 1),
    });
  }

  function createIntelState(seed = {}) {
    const targets = {};
    const rawTargets = seed.targets && typeof seed.targets === "object" ? seed.targets : {};
    for (const [targetId, entry] of Object.entries(rawTargets)) {
      const damageTypes = {};
      for (const [damageType, belief] of Object.entries(entry?.damageTypes || {})) {
        damageTypes[normalizeId(damageType)] = {
          multiplierEstimate: clamp(belief?.multiplierEstimate ?? belief?.multiplier ?? 1, 0.1, 2.5),
          confidence: clamp(belief?.confidence ?? 0, 0, 1),
          samples: Math.max(0, integer(belief?.samples, 0)),
        };
      }
      targets[clean(targetId)] = {
        observations: Math.max(0, integer(entry?.observations, 0)),
        threat: clamp(entry?.threat ?? 0.5, 0, 1),
        damageTypes,
      };
    }
    return { schemaVersion: INTEL_SCHEMA_VERSION, targets };
  }

  function observeDamageResult(intelRaw, observation = {}) {
    const intel = createIntelState(intelRaw || {});
    const targetId = clean(observation.targetId);
    const damageType = normalizeId(observation.damageType || "unknown") || "unknown";
    if (!targetId) return intel;

    const expected = Math.max(0.01, finite(observation.expectedDamage, 0));
    const actual = Math.max(0, finite(observation.actualDamage, 0));
    if (!(expected > 0)) return intel;

    const ratio = clamp(actual / expected, 0.1, 2.5);
    const target = intel.targets[targetId] || { observations: 0, threat: 0.5, damageTypes: {} };
    const previous = target.damageTypes[damageType] || { multiplierEstimate: 1, confidence: 0, samples: 0 };
    const samples = previous.samples + 1;
    const multiplierEstimate = ((previous.multiplierEstimate * previous.samples) + ratio) / samples;
    const confidence = clamp(0.20 + samples * 0.15, 0, 0.95);

    target.observations += 1;
    target.damageTypes[damageType] = { multiplierEstimate, confidence, samples };
    intel.targets[targetId] = target;
    return intel;
  }

  function targetIdOf(target) {
    if (typeof target === "string" || typeof target === "number") return clean(target);
    if (!target || typeof target !== "object") return "";
    // Deliberately read identity only. Individual GOAP must not inspect private combat truth
    // such as target HP, SP, resistances, skills, future slots, or planned actions.
    return clean(target.id ?? target.unitId ?? target.characterId);
  }

  function targetIdsFrom(input = {}) {
    const ids = [];
    const seen = new Set();
    for (const target of asArray(input.targets ?? input.targetIds)) {
      const id = targetIdOf(target);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }

  function bestKnownTarget(targetIds, intel) {
    if (!targetIds.length) return null;
    return [...targetIds].sort((a, b) => {
      const threatA = finite(intel.targets?.[a]?.threat, 0.5);
      const threatB = finite(intel.targets?.[b]?.threat, 0.5);
      return threatB - threatA || a.localeCompare(b);
    })[0];
  }

  function inferRole(raw = {}, definition = {}, sourceType = "skill") {
    const explicit = normalizeId(raw.role || raw.aiRole || definition.aiRole || definition.ai_role);
    if (explicit) return explicit;
    const id = normalizeId(definition.id || raw.id);
    if (sourceType === "universal" && ["escape", "retreat"].includes(id)) return "escape";

    const definitionType = normalizeId(definition.type || definition.actionType || definition.action_type);
    const defenseSubtype = normalizeId(definition.defenseSubtype || definition.defense_subtype);
    if (definition.isDefense === true || definitionType === "defense" || ["guard", "evade", "counter", "clashable_guard", "clashable_counter"].includes(defenseSubtype)) {
      return "defense";
    }

    const tags = asArray(raw.tags || definition.tags).map(normalizeId);
    if (tags.some((tag) => ["defend", "defense", "guard", "dodge", "block", "protect"].includes(tag))) return "defense";
    if (tags.some((tag) => ["heal", "recover", "recovery", "restore"].includes(tag))) return "recover";
    if (tags.some((tag) => ["buff", "setup", "control", "debuff", "advantage"].includes(tag))) return "setup";
    return "offense";
  }

  function normalizeSourceDescriptor(raw = {}, index = 0) {
    const definition = clone(raw.definition || raw.source || raw.skill || raw.spell || raw.action || raw);
    let sourceType = normalizeId(raw.sourceType || raw.source_type || raw.kind || raw.combatSourceType);
    if (!SOURCE_TYPES.includes(sourceType)) {
      const hinted = normalizeId(definition.sourceType || definition.source_type);
      sourceType = SOURCE_TYPES.includes(hinted) ? hinted : "skill";
    }
    const sourceId = clean(definition.id ?? definition.skillId ?? definition.spellId ?? raw.id, `ai_action_${index + 1}`);
    definition.id = sourceId;
    const estimateRaw = raw.estimate || raw.aiEstimate || definition.aiEstimate || {};
    const coinAmount = Math.max(0, integer(definition.coinAmount ?? definition.coinCount ?? definition.coin_count, 0));
    const roughDamage = Math.max(0, finite(definition.basePower ?? definition.base_power, 0))
      + Math.max(0, finite(definition.coinPower ?? definition.coin_power, 0)) * Math.max(1, coinAmount) * 0.5;
    const damageType = normalizeId(estimateRaw.damageType || raw.damageType || definition.damageType || definition.dmgType || definition.attackType || definition.tipo_dano);
    const role = inferRole(raw, definition, sourceType);
    return {
      key: `${sourceType}:${normalizeId(sourceId) || index}`,
      sourceType,
      sourceId,
      definition,
      role,
      fixedTargetId: clean(raw.targetId),
      available: raw.available !== false,
      availability: typeof raw.isAvailable === "function" ? raw.isAvailable : null,
      estimate: {
        damage: role === "defense" ? Math.max(0, finite(estimateRaw.damage, 0)) : Math.max(0, finite(estimateRaw.damage, roughDamage)),
        damageType,
        safety: finite(estimateRaw.safety ?? raw.safety, role === "defense" ? Math.max(4, roughDamage) : 0),
        recovery: finite(estimateRaw.recovery ?? raw.recovery, role === "recover" ? 4 : 0),
        advantage: finite(estimateRaw.advantage ?? raw.advantage, role === "setup" ? 3 : 0),
        resourceCost: Math.max(0, finite(estimateRaw.resourceCost ?? raw.resourceCost, asArray(definition.resourceCosts || definition.resource_costs).length)),
        risk: clamp(estimateRaw.risk ?? raw.risk ?? 0, 0, 10),
      },
      producesTags: asArray(raw.producesTags ?? estimateRaw.producesTags).map(normalizeId).filter(Boolean),
      consumesTags: asArray(raw.consumesTags ?? estimateRaw.consumesTags).map(normalizeId).filter(Boolean),
      metadata: raw.metadata && typeof raw.metadata === "object" ? clone(raw.metadata) : {},
    };
  }

  function makeEscapeDescriptor() {
    return normalizeSourceDescriptor({
      sourceType: "universal",
      definition: { id: "escape" },
      role: "escape",
      estimate: { safety: 10, risk: 0, resourceCost: 0 },
      metadata: { injectedByIndividualGoap: true },
    }, 999);
  }

  function resolveSlots(input = {}) {
    if (Array.isArray(input.slotIds)) return input.slotIds.slice(0, MAX_PLANNED_SLOTS).map(String);
    const count = clamp(integer(input.availableSlots ?? input.slots, 1), 0, MAX_PLANNED_SLOTS);
    return Array.from({ length: count }, (_, index) => `${actorIdOf(input.actor) || "ai"}_slot_${index}`);
  }

  function chooseGoal(input, context) {
    const explicit = normalizeId(input.goal || input.primaryGoal);
    if (Object.values(GOALS).includes(explicit)) return explicit;

    const { hpRatio, wisdomProfile: wis, hasEscape } = context;
    if (hasEscape && hpRatio <= wis.escapeHpRatio) return GOALS.ESCAPE;
    if (hpRatio <= Math.min(0.65, wis.escapeHpRatio + 0.15)) return GOALS.SURVIVE;
    return GOALS.KILL_TARGET;
  }

  function beliefMultiplier(intel, targetId, damageType, awareness) {
    if (!targetId || !damageType) return 1;
    const belief = intel.targets?.[targetId]?.damageTypes?.[damageType];
    if (!belief) return 1;
    const confidence = clamp(belief.confidence, 0, 1);
    return 1 + (clamp(belief.multiplierEstimate, 0.1, 2.5) - 1) * confidence * awareness;
  }

  function quickCandidateScore(candidate) {
    if (candidate.role === "offense") return 20 + candidate.estimate.damage - candidate.estimate.resourceCost;
    if (candidate.role === "defense") return 14 + candidate.estimate.safety;
    if (candidate.role === "recover") return 13 + candidate.estimate.recovery;
    if (candidate.role === "setup") return 12 + candidate.estimate.advantage;
    if (candidate.role === "escape") return 2;
    return 5;
  }

  function candidateScore(candidate, state, context) {
    const { goal, hpRatio, intelligenceProfile: intp, wisdomProfile: wisp, intel, targetId } = context;
    const estimate = candidate.estimate;
    const damageMultiplier = beliefMultiplier(intel, targetId, estimate.damageType, intp.intelAwareness);
    const effectiveDamage = estimate.damage * damageMultiplier;
    let score = 0;

    if (goal === GOALS.KILL_TARGET) {
      score += effectiveDamage * 2.4;
      score += estimate.advantage * (1 + intp.comboAwareness);
      score += estimate.safety * 0.25;
      if (candidate.role === "escape") score -= 14;
    } else if (goal === GOALS.ESCAPE) {
      score += estimate.safety * 2.5 + estimate.recovery * 1.2;
      score += effectiveDamage * 0.35;
      if (candidate.role === "escape") score += 42 + wisp.wisdom;
    } else if (goal === GOALS.SURVIVE || goal === GOALS.PROTECT_SELF) {
      score += estimate.safety * (1.6 + wisp.dangerWeight);
      score += estimate.recovery * 1.8;
      score += effectiveDamage * 0.75;
      if (candidate.role === "escape") score += hpRatio <= wisp.escapeHpRatio ? 30 : 5;
    } else if (goal === GOALS.RECOVER_RESOURCE) {
      score += estimate.recovery * 2.5 + estimate.safety;
      score += effectiveDamage * 0.4;
    } else if (goal === GOALS.GAIN_ADVANTAGE) {
      score += estimate.advantage * 2.5 + effectiveDamage;
      score += estimate.safety * 0.5;
    }

    score -= estimate.resourceCost * (0.75 + wisp.resourceConservation * 1.75);
    score -= estimate.risk * wisp.dangerWeight * (1.15 - hpRatio * 0.35);

    const repeats = state.sequence.filter((entry) => entry.key === candidate.key).length;
    score -= repeats * (0.5 + wisp.resourceConservation);

    if (intp.comboAwareness > 0 && candidate.consumesTags.length) {
      const matches = candidate.consumesTags.filter((tag) => state.producedTags.has(tag)).length;
      score += matches * 4 * intp.comboAwareness;
    }

    return score;
  }

  function expandState(state, candidate, score, context) {
    const producedTags = new Set(state.producedTags);
    if (context.intelligenceProfile.comboAwareness > 0) candidate.producesTags.forEach((tag) => producedTags.add(tag));
    return {
      sequence: state.sequence.concat(candidate),
      score: state.score + score,
      producedTags,
      escaped: state.escaped || candidate.role === "escape",
    };
  }

  function compileCandidate(actor, candidate, options = {}) {
    const common = {
      isAi: true,
      actionSlotId: options.actionSlotId,
      targetId: candidate.fixedTargetId || options.targetId || null,
      mainTargetId: candidate.fixedTargetId || options.targetId || null,
      metadata: {
        ...(candidate.metadata || {}),
        individualGoap: true,
        aiGoal: options.goal,
        aiScore: options.score,
      },
    };

    if (candidate.sourceType === "universal") return adapters.compileUniversalAction(actor, candidate.sourceId, common);
    if (candidate.sourceType === "skill") return adapters.compileSkillToCombatAction(actor, candidate.definition, common);
    if (candidate.sourceType === "spell") return adapters.compileSpellToCombatAction(actor, candidate.definition, common);
    if (candidate.sourceType === "trait") return adapters.compileTraitToCombatAction(actor, candidate.definition, common);
    return adapters.compileSourceToCombatAction(actor, candidate.definition, { ...common, sourceType: candidate.sourceType });
  }

  function planTurn(input = {}) {
    const actor = input.actor || {};
    const actorId = actorIdOf(actor);
    if (!actorId) return { planned: false, reason: "actor_id_required", actions: [] };

    const slots = resolveSlots(input);
    if (!slots.length) return { planned: true, reason: "no_action_slots", actorId, actions: [], sequence: [] };

    const intelligence = abilityScore(actor, "intelligence", "int", 10);
    const wisdom = abilityScore(actor, "wisdom", "wis", 10);
    const intp = planningProfile(intelligence);
    const wisp = wisdomProfile(wisdom);
    const hpRatio = ownHpRatio(actor);
    const intel = createIntelState(input.intel || {});
    const targetIds = targetIdsFrom(input);
    const targetId = clean(input.targetId) || bestKnownTarget(targetIds, intel);

    let candidates = asArray(input.sources || input.actions)
      .map(normalizeSourceDescriptor)
      .filter((candidate) => candidate.available && (!candidate.availability || candidate.availability(actor, input) !== false));

    if (input.allowEscape !== false && !candidates.some((candidate) => candidate.sourceType === "universal" && normalizeId(candidate.sourceId) === "escape")) {
      candidates.push(makeEscapeDescriptor());
    }
    if (!candidates.length) return { planned: false, reason: "no_available_actions", actorId, actions: [], sequence: [] };

    const hasEscape = candidates.some((candidate) => candidate.role === "escape");
    const goal = chooseGoal(input, { hpRatio, wisdomProfile: wisp, hasEscape });
    const context = { goal, hpRatio, intelligenceProfile: intp, wisdomProfile: wisp, intel, targetId };

    // Low INT sees a smaller menu; higher INT gets more breadth. This is the main
    // performance guard: the search never expands the full combat menu without a cap.
    candidates.sort((a, b) => quickCandidateScore(b) - quickCandidateScore(a) || a.key.localeCompare(b.key));
    candidates = candidates.slice(0, intp.candidateLimit);
    if (hasEscape && !candidates.some((candidate) => candidate.role === "escape")) candidates.push(makeEscapeDescriptor());

    let beam = [{ sequence: [], score: 0, producedTags: new Set(), escaped: false }];
    for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
      const next = [];
      for (const state of beam) {
        for (const candidate of candidates) {
          if (state.escaped && candidate.role === "escape") continue;
          const score = candidateScore(candidate, state, context);
          next.push(expandState(state, candidate, score, context));
        }
      }
      next.sort((a, b) => b.score - a.score || a.sequence.map((item) => item.key).join("|").localeCompare(b.sequence.map((item) => item.key).join("|")));
      beam = next.slice(0, intp.beamWidth);
      if (!beam.length) break;
    }

    const best = beam[0] || { sequence: [], score: 0, producedTags: new Set() };
    const perActionScore = best.sequence.length ? best.score / best.sequence.length : 0;
    const actions = best.sequence.map((candidate, index) => compileCandidate(actor, candidate, {
      actionSlotId: slots[index],
      targetId,
      goal,
      score: perActionScore,
    }));

    return {
      planned: true,
      actorId,
      goal,
      targetId,
      slotsRequested: slots.length,
      actions,
      sequence: best.sequence.map((candidate, index) => ({
        slotId: slots[index],
        sourceType: candidate.sourceType,
        sourceId: candidate.sourceId,
        role: candidate.role,
      })),
      score: best.score,
      intelligence,
      wisdom,
      profile: clone(intp),
      riskProfile: clone(wisp),
      hpRatio,
      intel: clone(intel),
    };
  }

  const api = Object.freeze({
    version: "0.1.1",
    GOALS,
    MAX_PLANNED_SLOTS,
    INTEL_SCHEMA_VERSION,
    planningProfile,
    wisdomProfile,
    createIntelState,
    observeDamageResult,
    normalizeSourceDescriptor,
    chooseGoal,
    planTurn,
  });

  global.LuminousIndividualGoapCombatAI = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
