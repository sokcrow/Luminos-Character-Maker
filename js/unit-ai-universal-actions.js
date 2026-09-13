(function (global) {
  "use strict";

  if (global.LuminousUnitAiUniversalActions) {
    if (typeof module !== "undefined" && module.exports) module.exports = global.LuminousUnitAiUniversalActions;
    return;
  }

  const safeRequire = (path) => {
    if (typeof require !== "function") return null;
    try { return require(path); } catch (_) { return null; }
  };

  const baseAdapter = global.LuminousUnitAiKitAdapter || safeRequire("./unit-ai-kit-adapter.js");
  const goap = global.LuminousIndividualGoapCombatAI || safeRequire("./individual-goap-combat-ai.js");
  const combatSchema = () => global.LuminousCombatAction || safeRequire("./combat-action-schema.js");
  if (!baseAdapter || !goap?.planTurn) return;

  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const asArray = (value) => value == null ? [] : (Array.isArray(value) ? value : [value]);
  const clean = (value, fallback = "") => String(value ?? fallback).trim() || fallback;
  const normalizeId = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, finite(value, min)));

  function actorIdOf(actor = {}) {
    return clean(actor.id ?? actor.unitId ?? actor.characterId ?? actor.actorId);
  }

  function targetIdOf(target) {
    if (typeof target === "string" || typeof target === "number") return clean(target);
    if (!target || typeof target !== "object") return "";
    return clean(target.id ?? target.unitId ?? target.characterId ?? target.actorId);
  }

  function primaryTargetId(options = {}) {
    const explicit = clean(options.targetId ?? options.mainTargetId);
    if (explicit) return explicit;
    for (const target of asArray(options.targets ?? options.targetIds)) {
      const id = targetIdOf(target);
      if (id) return id;
    }
    return "";
  }

  function abilityScore(actor = {}, longName, shortName, fallback = 10) {
    const sources = [actor.scores, actor.abilityScores, actor.stats, actor.attributes, actor.mechanics?.scores, actor.mechanics?.abilityScores, actor];
    for (const source of sources) {
      if (!source || typeof source !== "object") continue;
      const value = source[shortName] ?? source[longName] ?? source[longName.toUpperCase()];
      if (Number.isFinite(Number(value))) return clamp(value, 1, 30);
    }
    return fallback;
  }

  function numericSkillBonus(actor = {}, skillId) {
    const id = normalizeId(skillId);
    const containers = [
      actor.skillBonuses,
      actor.skills && !Array.isArray(actor.skills) ? actor.skills : null,
      actor.mechanics?.skillBonuses,
      actor.mechanics?.skills,
      actor.proficiencies?.skills,
    ];
    for (const container of containers) {
      if (!container || typeof container !== "object") continue;
      const raw = container[id] ?? container[skillId];
      if (Number.isFinite(Number(raw))) return Number(raw);
      if (raw && typeof raw === "object") {
        const value = raw.total ?? raw.bonus ?? raw.modifier ?? raw.value;
        if (Number.isFinite(Number(value))) return Number(value);
      }
    }
    return 0;
  }

  function currentHpRatio(actor = {}) {
    const hp = [actor.hp, actor.currentHp, actor.currentHP, actor.mechanics?.hp].map(Number).find(Number.isFinite);
    const maxHp = [actor.maxHp, actor.maxHP, actor.hpMax, actor.mechanics?.maxHp].map(Number).find((value) => Number.isFinite(value) && value > 0);
    if (hp == null || maxHp == null) return 1;
    return clamp(hp / maxHp, 0, 1);
  }

  function immediateRetreatThreshold(actor = {}) {
    const wisdom = abilityScore(actor, "wisdom", "wis", 10);
    return clamp(0.12 + wisdom * 0.012, 0.13, 0.42);
  }

  function contestBelief(options = {}, targetId, contestId) {
    const entry = options.intel?.targets?.[targetId]?.contests?.[contestId];
    if (!entry || typeof entry !== "object") return null;
    const samples = Math.max(0, Math.trunc(finite(entry.samples, 0)));
    const wins = Math.max(0, Math.trunc(finite(entry.wins, 0)));
    const losses = Math.max(0, Math.trunc(finite(entry.losses, 0)));
    const rawEstimate = entry.successEstimate ?? entry.success ?? (samples > 0 ? wins / Math.max(1, wins + losses || samples) : null);
    const successEstimate = rawEstimate == null ? null : clamp(rawEstimate, 0, 1);
    const confidence = clamp(entry.confidence ?? (samples > 0 ? 0.2 + samples * 0.15 : 0), 0, 0.95);
    return successEstimate == null ? null : { successEstimate, confidence, samples, wins, losses };
  }

  function grappleEstimate(actor = {}, options = {}, targetId) {
    const strength = abilityScore(actor, "strength", "str", 10);
    const athletics = numericSkillBonus(actor, "athletics");
    const selfCapability = clamp(4 + (strength - 10) / 2 + athletics * 0.75, 0.5, 10);
    const belief = contestBelief(options, targetId, "grapple");
    const learned = belief ? belief.successEstimate * 10 : selfCapability;
    const blend = belief ? belief.confidence * 0.5 : 0;
    const control = clamp(selfCapability * (1 - blend) + learned * blend, 0, 10);
    return {
      control,
      advantage: control * 0.7,
      safety: Math.max(0, control - 3) * 0.35,
      risk: clamp(5.5 - control * 0.45, 0.5, 5),
      resourceCost: 0,
      selfCapability,
      contestConfidence: belief?.confidence || 0,
    };
  }

  function visibleCommittedActions(actor = {}, options = {}) {
    const selfId = actorIdOf(actor);
    return asArray(options.alliedCommittedActions ?? options.visibleAlliedActions ?? options.committedAlliedActions)
      .filter((action) => action && typeof action === "object")
      .filter((action) => clean(action.actorId) && clean(action.actorId) !== selfId)
      .filter((action) => !action.phase?.executesAt || action.phase.executesAt === "combat_phase")
      .filter((action) => clean(action.id) && clean(action.actionSlotId));
  }

  function actionSupportValue(action = {}) {
    const metadata = action.metadata || {};
    const definition = metadata.sourceDefinition || {};
    const basePower = Math.max(0, finite(metadata.basePower ?? definition.basePower, 0));
    const coinPower = Math.max(0, finite(metadata.coinPower ?? definition.coinPower, 0));
    const coinAmount = Math.max(0, Math.trunc(finite(metadata.coinAmount ?? definition.coinAmount, 0)));
    const offensiveSignal = basePower + coinPower * Math.max(1, coinAmount) * 0.5;
    const resolution = normalizeId(action.resolution?.type);
    const resolutionWeight = ["clash", "unopposed", "save", "contest"].includes(resolution) ? 1 : 0.55;
    return clamp(3.5 + offensiveSignal * 0.35 * resolutionWeight, 2, 10);
  }

  function isHelpAction(action = {}) {
    return normalizeId(action.source?.type) === "universal" && normalizeId(action.source?.id) === "help";
  }

  function helpEligibleAction(action = {}) {
    const schema = combatSchema();
    if (typeof schema?.canReceiveHelp === "function") return schema.canReceiveHelp(action) === true;
    const resolution = normalizeId(action.resolution?.type);
    return resolution === "clash" || resolution === "check";
  }

  function bestHelpTarget(actor = {}, options = {}) {
    const committed = visibleCommittedActions(actor, options);
    if (committed.some(isHelpAction)) return null;
    return committed
      .filter((action) => !isHelpAction(action) && helpEligibleAction(action))
      .map((action) => ({ action, value: actionSupportValue(action) }))
      .sort((a, b) => b.value - a.value || clean(a.action.id).localeCompare(clean(b.action.id)))[0] || null;
  }

  function explicitUniversalSet(actor = {}, options = {}) {
    if (options.allowUniversalActions === false) return new Set();
    const explicit = options.universalActions ?? actor.aiUniversalActions ?? actor.ai?.universalActions;
    if (!Array.isArray(explicit) || !explicit.length) return null;
    return new Set(explicit.map((entry) => normalizeId(typeof entry === "object" ? entry.id : entry)).filter(Boolean));
  }

  function universalAllowed(id, explicitSet) {
    return explicitSet == null || explicitSet.has(normalizeId(id));
  }

  function improviseDescriptor(actor = {}, options = {}, targetId) {
    const raw = options.improviseAction ?? actor.aiImproviseAction ?? actor.ai?.improviseAction;
    if (!raw || typeof raw !== "object") return null;
    const effects = asArray(raw.effects).filter(Boolean);
    const resolution = raw.resolution && typeof raw.resolution === "object" ? clone(raw.resolution) : null;
    if (!effects.length && !resolution) return null;
    return {
      sourceType: "universal",
      definition: { id: "improvise", aiRole: "setup" },
      role: "setup",
      targetId: clean(raw.targetId) || targetId || null,
      aiEstimate: {
        advantage: clamp(raw.aiEstimate?.advantage ?? raw.advantage ?? 4, 0, 10),
        safety: clamp(raw.aiEstimate?.safety ?? raw.safety ?? 0, 0, 10),
        risk: clamp(raw.aiEstimate?.risk ?? raw.risk ?? 2, 0, 10),
        resourceCost: Math.max(0, finite(raw.aiEstimate?.resourceCost ?? raw.resourceCost, 0)),
      },
      maxUsesPerTurn: Math.max(1, Math.trunc(finite(raw.maxUsesPerTurn, 1))),
      compileOptions: {
        ...(resolution ? { resolution } : {}),
        ...(effects.length ? { effects: clone(effects) } : {}),
        ...(raw.targeting ? { targeting: clone(raw.targeting) } : {}),
      },
      metadata: { unitAiUniversalAction: true, universalPolicy: "explicit_improvise" },
    };
  }

  function universalDescriptors(actor = {}, options = {}) {
    if (options.allowUniversalActions === false) return [];
    const explicitSet = explicitUniversalSet(actor, options);
    const targetId = primaryTargetId(options);
    const result = [];

    if (targetId && options.allowGrapple !== false && universalAllowed("grapple", explicitSet)) {
      const estimate = grappleEstimate(actor, options, targetId);
      result.push({
        sourceType: "universal",
        definition: { id: "grapple", aiRole: "control" },
        role: "control",
        targetId,
        aiEstimate: estimate,
        maxUsesPerTurn: 1,
        metadata: {
          unitAiUniversalAction: true,
          universalPolicy: "self_capability_plus_personal_intel",
          grappleSelfCapability: estimate.selfCapability,
          grappleContestConfidence: estimate.contestConfidence,
        },
      });
    }

    if (options.allowHelp !== false && universalAllowed("help", explicitSet)) {
      const help = bestHelpTarget(actor, options);
      if (help) {
        result.push({
          sourceType: "universal",
          definition: { id: "help", aiRole: "support" },
          role: "support",
          targetId: clean(help.action.actorId),
          aiEstimate: { support: help.value, advantage: help.value * 0.65, risk: 0.25, resourceCost: 0 },
          maxUsesPerTurn: 1,
          compileOptions: {
            targetUnitId: clean(help.action.actorId),
            targetActionId: clean(help.action.id),
            targetActionSlotId: clean(help.action.actionSlotId),
          },
          metadata: {
            unitAiUniversalAction: true,
            universalPolicy: "visible_committed_help_eligible_action_only",
            helpedActionId: clean(help.action.id),
          },
        });
      }
    }

    if (options.allowRetreat !== false && universalAllowed("retreat", explicitSet)) {
      const criticalWithdrawal = currentHpRatio(actor) <= immediateRetreatThreshold(actor);
      result.push({
        sourceType: "universal",
        definition: { id: "retreat", aiRole: criticalWithdrawal ? "escape" : "retreat" },
        role: criticalWithdrawal ? "escape" : "retreat",
        aiEstimate: { safety: criticalWithdrawal ? 9 : 7, recovery: 1, risk: 0.5, resourceCost: 0 },
        maxUsesPerTurn: 1,
        metadata: {
          unitAiUniversalAction: true,
          universalPolicy: criticalWithdrawal ? "critical_immediate_withdrawal" : "survival_option",
        },
      });
    }

    if (universalAllowed("improvise", explicitSet)) {
      const improvise = improviseDescriptor(actor, options, targetId);
      if (improvise) result.push(improvise);
    }

    return result;
  }

  function sourceIdOfDescriptor(descriptor = {}) {
    return clean(descriptor.definition?.id ?? descriptor.sourceId ?? descriptor.id);
  }

  function mergeDescriptors(base = [], extra = []) {
    const result = [];
    const seen = new Set();
    for (const descriptor of [...asArray(base), ...asArray(extra)]) {
      if (!descriptor) continue;
      const sourceType = normalizeId(descriptor.sourceType || descriptor.definition?.sourceType || "skill");
      const id = normalizeId(sourceIdOfDescriptor(descriptor));
      const compile = descriptor.compileOptions || {};
      const targetActionId = normalizeId(compile.targetActionId || "");
      const key = `${sourceType}:${id}:${targetActionId}`;
      if (!id || seen.has(key)) continue;
      seen.add(key);
      result.push(descriptor);
    }
    return result;
  }

  function augmentKit(baseKit = {}, actor = {}, options = {}) {
    const universals = universalDescriptors(actor, options);
    const allSources = mergeDescriptors(baseKit.allSources || baseKit.sources || [], universals);
    const sources = mergeDescriptors(baseKit.sources || [], universals.filter((entry) => entry.available !== false));
    return {
      ...baseKit,
      version: "0.3.0",
      sources,
      allSources,
      universalSources: clone(universals),
      baseSourceCount: asArray(baseKit.sources).length,
      counts: {
        ...(baseKit.counts || {}),
        usable: sources.length,
        total: allSources.length,
        universal: universals.length,
      },
    };
  }

  function buildKit(actor = {}, options = {}) {
    const baseKit = baseAdapter.buildKit(actor, options);
    return augmentKit(baseKit, actor, options);
  }

  function planUnitTurn(input = {}) {
    const actor = input.actor || {};
    const kitOptions = { ...input, ...(input.kitOptions || {}) };
    const baseKit = baseAdapter.buildKit(actor, kitOptions);
    if (!asArray(baseKit.sources).length && input.allowUniversalOnly !== true) {
      return {
        planned: false,
        reason: baseKit.unresolved?.length ? "unit_combat_sources_unresolved" : "no_unit_combat_sources",
        actorId: actorIdOf(actor),
        kit: augmentKit(baseKit, actor, kitOptions),
        actions: [],
        sequence: [],
      };
    }
    const kit = augmentKit(baseKit, actor, kitOptions);
    const plan = goap.planTurn({ ...input, actor, sources: kit.sources });
    return { ...plan, kit };
  }

  const wrappedAdapter = Object.freeze({
    ...baseAdapter,
    version: "0.3.0",
    buildKit,
    planUnitTurn,
    universalDescriptors,
    grappleEstimate,
    bestHelpTarget,
  });

  const api = Object.freeze({
    version: "0.1.3",
    universalDescriptors,
    grappleEstimate,
    visibleCommittedActions,
    bestHelpTarget,
    helpEligibleAction,
    actionSupportValue,
    currentHpRatio,
    immediateRetreatThreshold,
    augmentKit,
    baseAdapter,
    adapter: wrappedAdapter,
  });

  global.LuminousUnitAiKitAdapter = wrappedAdapter;
  global.LuminousUnitAiUniversalActions = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
